const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// =========================================================================
// 🚀 1. تسريع الأداء وضبط كروت الشاشة المدمجة (Intel HD Graphics & Low-End POS Profile)
// =========================================================================
// ⚡ إجبار إلكترون على تشغيل تسريع الرسوميات ومشاركة رامات الجهاز الـ 8GB لتفادي اختناق كرت الشاشة الـ 113MB
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
// 💾 تقليل العمليات الخلفية المجهدة للهارد الميكانيكي HDD
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,CalculateNativeWinOcclusion,SpareRendererForSitePerProcess');
// 🧠 ضبط استهلاك الذاكرة لمحرك V8 لمنح البرنامج سلاسة فائقة ومنع التجميد الدوري (GC Thrashing)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048');


const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('⚠️ نسخة أخرى من تطبيق Bayan POS تعمل بالفعل بالخلفية. إغلاق النسخة المكررة فوراً...');
    app.exit(0);
} else {
    app.on('second-instance', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

let openWindows = new Set();
let mainWindow;
let isQuitting = false;
let autoUpdater = null;
const LICENSE_SECRET = 'BAYAN_POS_SECRET_KEY_2026';

function createWindow() {
    Menu.setApplicationMenu(null); // إلغاء القوائم الافتراضية

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#0f172a', // لون خلفية داكن أنيق ومتطابق مع هوية بيان بدلاً من الوميض الأبيض المزعج
        show: false, // لا تظهر النافذة إلا بعد اكتمال الرسم لمنع أي وميض أو شاشة معلقة
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
            devTools: false,
            spellcheck: false, // تعطيل التدقيق الإملائي لتوفير الرامات والمعالج
            backgroundThrottling: false // الحفاظ على أداء سريع حتى عند تصغير النافذة
        },
        icon: path.join(__dirname, 'media', 'logo.ico')
    });

    // إظهار النافذة فور جاهزيتها
    win.once('ready-to-show', () => {
        if (!win.isDestroyed()) win.show();
    });

    // صمام أمان لظهور النافذة خلال 1.5 ثانية كحد أقصى حتى لو تأخر حدث ready-to-show
    setTimeout(() => {
        if (!win.isDestroyed() && !win.isVisible()) {
            win.show();
        }
    }, 1500);

    // التعافي التلقائي في حال حدوث توقف
    win.webContents.on('render-process-gone', (event, details) => {
        console.error("⚠️ Renderer process gone:", details.reason);
        if (details.reason !== 'clean-exit') {
            win.reload();
        }
    });

    win.webContents.on('unresponsive', () => {
        console.warn("⚠️ [Main] Window is temporarily busy or unresponsive. Waiting for tasks to complete without reloading to preserve current invoice state.");
    });

    win.webContents.on('responsive', () => {
        console.log("✅ [Main] Window has recovered responsiveness.");
    });

    if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = win;
    }
    openWindows.add(win);

    win.loadFile(path.join(__dirname, 'index.html'));

    // منع اختصارات لوحة المفاتيح الخاصة بالـ Console والـ Reload + إضافة اختصار Ctrl+N لفتح نافذة جديدة
    win.webContents.on('before-input-event', (event, input) => {
        const key = input.key.toLowerCase();
        
        // Ctrl+N لفتح نافذة جديدة موازية
        if (input.control && key === 'n') {
            event.preventDefault();
            createWindow();
            return;
        }

        // منع F12 و Ctrl+Shift+I و Ctrl+Shift+J و Ctrl+Shift+C و Ctrl+U
        if (
            input.key === 'F12' || 
            (input.control && input.shift && (key === 'i' || key === 'j' || key === 'c')) ||
            (input.control && key === 'u')
        ) {
            event.preventDefault();
            return;
        }

        // إعادة التحميل في تطبيق إلكترون المثبت ديسكتوب عبر Ctrl+R
        if (input.control && key === 'r') {
            event.preventDefault();
            win.reload();
            return;
        }

        // منع إعادة التحميل العادية F5 لحماية شاشة الكاشير وسلة المبيعات من التفريغ بالخطأ
        if (input.key === 'F5') {
            event.preventDefault();
            return;
        }

        // F11 للشاشة الكاملة
        if (input.key === 'F11') {
            win.setFullScreen(!win.isFullScreen());
            event.preventDefault();
            return;
        }
    });

    // 🔒 منع القائمة المنبثقة بالزر الأيمن لمنع أي فحص للعناصر نهائياً (Inspect Element)
    win.webContents.on('context-menu', (e) => {
        e.preventDefault();
    });

    // 🔒 إغلاق أدوات المطور فوراً
    win.webContents.on('devtools-opened', () => {
        win.webContents.closeDevTools();
    });

    // إغلاق نظيف وسريع مع حماية البيانات غير المحفوظة والنسخ الاحتياطي التلقائي
    win.on('close', (event) => {
        if (isQuitting) {
            // تم إنهاء النسخ مسبقاً والموافقة على الخروج
            openWindows.delete(win);
            return;
        }

        // إذا كان هناك أكثر من نافذة فرعية مفتوحة، نسمح بإغلاق هذه النافذة فقط
        if (openWindows.size > 1) {
            openWindows.delete(win);
            return;
        }

        // 🔒 صمام الأمان: إيقاف الإغلاق المؤقت لمنح الريندرر وقتاً لحفظ النسخة وفحص البيانات غير المحفوظة
        event.preventDefault();

        try {
            if (!win.isDestroyed() && win.webContents) {
                win.webContents.send('trigger-backup-before-quit');
            } else {
                isQuitting = true;
                app.quit();
                return;
            }
        } catch (err) {
            console.error('Error sending trigger-backup-before-quit:', err);
            isQuitting = true;
            app.quit();
            return;
        }

        // صمام أمان زمني في حال تعليق الريندرر (3.5 ثوانٍ كحد أقصى لمنع أي بطء في النظام)
        if (global.quitTimeout) clearTimeout(global.quitTimeout);
        global.quitTimeout = setTimeout(() => {
            console.warn('⚠️ Backup before quit timeout reached, forcing exit...');
            isQuitting = true;
            try {
                if (server_hub && typeof server_hub.stopServer === 'function') {
                    server_hub.stopServer();
                }
            } catch (e) {}
            app.exit(0);
        }, 3500);
    });

    win.on('closed', () => {
        openWindows.delete(win);
        if (openWindows.size === 0) {
            app.exit(0);
        }
    });

    // إدارة التحميلات الآمنة
    win.webContents.session.on('will-download', (event, item, webContents) => {
        item.setSaveDialogOptions({
            defaultPath: path.join(app.getPath('desktop'), item.getFilename())
        });
    });

    // 🔒 صمام الأمان الفولاذي: منع فتح أي نوافذ جديدة داخل بيئة Electron وتوجيه الروابط الآمنة للمتصفح الافتراضي مع السماح بنوافذ الطباعة المحلية
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url) || /^tel:/i.test(url) || /^anydesk:/i.test(url)) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        // السماح بنوافذ الطباعة المحلية الفارغة (about:blank) لضمان عدم توقف الطباعة نهائياً
        if (url === 'about:blank' || !url || url === '') {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                }
            };
        }
        return { action: 'deny' };
    });

    // 🔒 صمام الأمان الفولاذي: منع الانتقال خارج واجهة البرنامج index.html نهائياً لحماية صلاحيات Node.js
    win.webContents.on('will-navigate', (event, url) => {
        try {
            const parsedUrl = new URL(url);
            const indexFilePath = path.resolve(__dirname, 'index.html').replace(/\\/g, '/').toLowerCase();
            let parsedPath = decodeURIComponent(parsedUrl.pathname).replace(/\\/g, '/').toLowerCase();
            if (process.platform === 'win32' && parsedPath.startsWith('/')) {
                parsedPath = parsedPath.slice(1);
            }
            let normalizedIndex = indexFilePath;
            if (process.platform === 'win32' && normalizedIndex.startsWith('/')) {
                normalizedIndex = normalizedIndex.slice(1);
            }

            // السماح فقط بالبقاء داخل index.html (التنقل بالهاش أو نفس مسار الصفحة)
            if (parsedUrl.protocol === 'file:' && (parsedPath === normalizedIndex || parsedPath.endsWith('/index.html'))) {
                return;
            }
        } catch (e) {
            // URL غير صالح
        }

        event.preventDefault();
        if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url) || /^tel:/i.test(url)) {
            shell.openExternal(url);
        }
    });

    return win;
}

// تهيئة التطبيق وإحالة الجلسة المكررة إلى النافذة المفتوحة
app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    } else {
        // 🛡️ صمام أمان: فتح النافذة فوراً إذا كانت العملية تعمل بالخلفية بدون واجهة
        createWindow();
    }
});

const os = require('os');
const server_hub = require('./server_hub.js');

const configDir = path.join(os.homedir(), '.bayan_pos');
const roleConfigFile = path.join(configDir, 'terminal_role.json');

function getPersistedTerminalRole() {
    try {
        if (fs.existsSync(roleConfigFile)) {
            const data = JSON.parse(fs.readFileSync(roleConfigFile, 'utf8'));
            if (data && (data.role === 'client' || data.role === 'master')) {
                return data.role;
            }
        }
    } catch(e) {}
    return 'master';
}

function setPersistedTerminalRole(role) {
    try {
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(roleConfigFile, JSON.stringify({ role, updatedAt: new Date().toISOString() }), 'utf8');
        return true;
    } catch(e) {
        return false;
    }
}

app.whenReady().then(() => {
    createWindow();

    // تشغيل السيرفر الشبكي المحلي المدمج فقط إذا كان هذا الجهاز معرّفاً كـ جهاز رئيسي (Master)
    const activeRole = getPersistedTerminalRole();
    if (activeRole === 'master') {
        try {
            server_hub.startServer(__dirname, (event, data) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send(event, data);
                }
            });
            console.log('🖥️ [Main] Started local server in MASTER mode.');
        } catch (err) {
            console.error('[ServerHub] Failed to start local server:', err.message);
        }
    } else {
        console.log('💻 [Main] Running in CLIENT mode. Local server is NOT started (connected to Master).');
    }

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // فحص التحديثات تلقائياً بعد 5 ثوانٍ من تشغيل التطبيق (مع التحقق الصارم من سياسة التجميد)
    setTimeout(() => {
        if (typeof isAutoUpdatesFrozenOnDisk === 'function' && isAutoUpdatesFrozenOnDisk()) {
            console.log('[Updater] 🔒 تخطي الفحص التلقائي عند بدء التشغيل: التحديثات مجمدة تماماً بناءً على اختيار العميل.');
            return;
        }
        if (autoUpdater) {
            autoUpdater.checkForUpdates().catch(err => {
                console.warn('Auto check for updates failed (safe to ignore if offline):', err.message);
            });
        }
    }, 5000);
});

app.on('window-all-closed', function () {
    try {
        if (server_hub && typeof server_hub.stopServer === 'function') {
            server_hub.stopServer();
        }
    } catch (e) {}
    app.exit(0);
});

// قنوات الاتصال (IPC) لفتح نافذة جديدة
ipcMain.handle('open-new-window', () => {
    createWindow();
    return true;
});

// 📂 اختيار ملف نسخة احتياطية مع التوجيه المباشر لمجلد النسخ في AppData/Roaming/Bayan POS/backups
ipcMain.handle('select-backup-file', async () => {
    try {
        const backupDir = path.join(app.getPath('appData'), 'Bayan POS', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const result = await dialog.showOpenDialog({
            title: 'اختر ملف النسخة الاحتياطية',
            defaultPath: backupDir,
            properties: ['openFile'],
            filters: [
                { name: 'نسخ احتياطية لنظام بيان (*.json)', extensions: ['json'] },
                { name: 'كافة الملفات (*.*)', extensions: ['*'] }
            ]
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return { canceled: true };
        }
        const chosenFile = result.filePaths[0];
        const content = fs.readFileSync(chosenFile, 'utf8');
        return {
            canceled: false,
            filePath: chosenFile,
            fileName: path.basename(chosenFile),
            fileSize: fs.statSync(chosenFile).size,
            content: content
        };
    } catch(err) {
        console.error("select-backup-file error:", err);
        return { error: err.message };
    }
});

// 📦 إدارة ومسار قاعدة بيانات SQLite على القرص الصلب
ipcMain.handle('get-sqlite-status', () => {
    try {
        const sqliteFile = path.join(os.homedir(), '.bayan_pos', 'bayan_pos.db');
        const exists = fs.existsSync(sqliteFile);
        let size = 0;
        if (exists) {
            size = fs.statSync(sqliteFile).size;
        }
        return {
            enabled: true,
            filePath: sqliteFile,
            exists: exists,
            sizeBytes: size,
            sizeFormatted: exists ? (size / 1024).toFixed(1) + ' KB' : '0 KB'
        };
    } catch (e) {
        return { enabled: true, error: e.message };
    }
});

ipcMain.handle('open-sqlite-folder', () => {
    try {
        const sqliteDir = path.join(os.homedir(), '.bayan_pos');
        if (!fs.existsSync(sqliteDir)) {
            fs.mkdirSync(sqliteDir, { recursive: true });
        }
        const dbPath = path.join(sqliteDir, 'bayan_pos.db');
        if (fs.existsSync(dbPath)) {
            shell.showItemInFolder(dbPath);
        } else {
            shell.openPath(sqliteDir);
        }
        return true;
    } catch(e) {}
    return false;
});

// قنوات الاتصال (IPC)
ipcMain.on('save-backup-and-quit', (event, backupData) => {
    try {
        const desktopDir = app.getPath('desktop');
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '_');
        const backupPath = path.join(desktopDir, 'backup_pos_' + timestamp + '.json');
        
        fs.writeFileSync(backupPath, backupData, 'utf-8');
        console.log('Backup saved to', backupPath);
    } catch (err) {
        console.error('Failed to save backup:', err);
    } finally {
        isQuitting = true;
        try {
            if (server_hub && typeof server_hub.stopServer === 'function') {
                server_hub.stopServer();
            }
        } catch (e) {}
        app.exit(0);
    }
});

ipcMain.on('cancel-quit', () => {
    if (global.quitTimeout) {
        clearTimeout(global.quitTimeout);
        global.quitTimeout = null;
    }
    isQuitting = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
        openWindows.add(mainWindow);
    }
    console.log('Quit cancelled by Renderer (unsaved data found).');
});

ipcMain.on('proceed-quit', () => {
    if (global.quitTimeout) {
        clearTimeout(global.quitTimeout);
        global.quitTimeout = null;
    }
    isQuitting = true;
    try {
        if (server_hub && typeof server_hub.stopServer === 'function') {
            server_hub.stopServer();
        }
    } catch (e) {}
    app.exit(0);
});

ipcMain.on('quit-directly', () => {
    if (global.quitTimeout) {
        clearTimeout(global.quitTimeout);
        global.quitTimeout = null;
    }
    isQuitting = true;
    try {
        if (server_hub && typeof server_hub.stopServer === 'function') {
            server_hub.stopServer();
        }
    } catch (e) {}
    app.exit(0);
});

// فتح الروابط الخارجية بأمان مع التحقق من الـ Protocol
ipcMain.handle('open-url', async (event, url) => {
    try {
        if (!url || typeof url !== 'string') return false;
        const cleanUrl = url.trim();
        // بروتوكول AnyDesk المباشر
        if (/^anydesk:/i.test(cleanUrl)) {
            await shell.openExternal(cleanUrl);
            return true;
        }
        // ✅ أمان: السماح فقط بـ http و https و mailto و tel ومنع أي بروتوكول آخر قد ينفّذ أوامر نظام
        const parsedUrl = new URL(cleanUrl);
        const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:', 'anydesk:'];
        if (!allowedProtocols.includes(parsedUrl.protocol.toLowerCase())) {
            console.error('⚠️ محاولة فتح رابط غير مسموح: ' + cleanUrl);
            return false;
        }
        await shell.openExternal(parsedUrl.href);
        return true;
    } catch (err) {
        console.error('Failed to open URL:', err);
        return false;
    }
});

// 🖥️ فتح تطبيق AnyDesk والاتصال المباشر بالكود فوراً
ipcMain.handle('launch-anydesk', async (event, code) => {
    try {
        const cleanCode = String(code || '').replace(/[^a-zA-Z0-9@._-]/g, '').trim();
        const { spawn, exec } = require('child_process');
        const fs = require('fs');

        const possiblePaths = [
            'C:\\Program Files (x86)\\AnyDesk\\AnyDesk.exe',
            'C:\\Program Files\\AnyDesk\\AnyDesk.exe',
            process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'AnyDesk', 'AnyDesk.exe') : null,
            process.env.APPDATA ? path.join(process.env.APPDATA, 'AnyDesk', 'AnyDesk.exe') : null
        ].filter(Boolean);

        const anydeskExe = possiblePaths.find(p => fs.existsSync(p));

        if (anydeskExe) {
            const args = cleanCode ? [cleanCode] : [];
            const child = spawn(anydeskExe, args, { detached: true, stdio: 'ignore' });
            child.unref();
            return { success: true, method: 'direct_exe' };
        }

        // في حال عدم وجود المسار الثابت، استخدام بروتوكول anydesk أو أمر start
        const targetProtocol = cleanCode ? `anydesk:${cleanCode}` : 'anydesk:';
        try {
            await shell.openExternal(targetProtocol);
            return { success: true, method: 'protocol' };
        } catch (e) {
            exec(cleanCode ? `start anydesk ${cleanCode}` : 'start anydesk', (err) => {
                if (err) console.error('Error starting anydesk via start command:', err);
            });
            return { success: true, method: 'cmd' };
        }
    } catch (err) {
        console.error('Error launching AnyDesk:', err);
        return { success: false, error: err.message };
    }
});

// تشفير وتوقيع التراخيص
ipcMain.handle('generate-license-signature', (event, plan, expiry, machineId) => {
    try {
        const dataString = plan + '_' + expiry + '_' + machineId;
        return crypto.createHmac('sha256', LICENSE_SECRET).update(dataString).digest('hex').substring(0, 16).toUpperCase();
    } catch (err) {
        console.error('Failed to generate signature:', err);
        return '';
    }
});

ipcMain.handle('verify-license-signature', (event, plan, expiry, machineId, userSig) => {
    try {
        const dataString = plan + '_' + expiry + '_' + machineId;
        const expectedSig = crypto.createHmac('sha256', LICENSE_SECRET).update(dataString).digest('hex').substring(0, 16).toUpperCase();
        return userSig === expectedSig;
    } catch (err) {
        console.error('Failed to verify signature in Main Process:', err);
        return false;
    }
});

ipcMain.handle('hash-activation-payload', (event, payload) => {
    try {
        return crypto.createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex').substring(0, 16).toUpperCase();
    } catch (err) {
        console.error('Failed to hash activation payload:', err);
        return '';
    }
});

// =========================================================================
// 📁 1. نظام إدارة مجلد والنسخ الاحتياطية (Smart Backup System)
// =========================================================================

// =========================================================================
// 📁 1. نظام مسار البيانات والتخزين الموحد (AppData/Roaming/Bayan POS)
// =========================================================================
const userDataPath = path.join(app.getPath('appData'), 'Bayan POS');
app.setPath('userData', userDataPath);
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

// 🔒 استرجاع وتوليد كود الجهاز المشفر الثابت وغير القابل للتغيير (Hardware UUID / Machine GUID)
ipcMain.handle('get-hardware-uuid', () => {
    try {
        const keyFile = path.join(userDataPath, 'device_hwid.key');
        if (fs.existsSync(keyFile)) {
            const saved = fs.readFileSync(keyFile, 'utf8').trim();
            if (saved && /^BNC-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(saved)) {
                return saved.toUpperCase();
            }
        }

        let rawGuid = '';
        if (process.platform === 'win32') {
            try {
                const { execSync } = require('child_process');
                const out = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
                    encoding: 'utf8',
                    stdio: ['pipe', 'pipe', 'ignore'],
                    timeout: 2000
                });
                const match = out.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/i);
                if (match && match[1]) rawGuid = match[1].trim();
            } catch(e) {}
        }

        if (!rawGuid) {
            rawGuid = `${os.hostname()}_${os.platform()}_${os.arch()}_${os.cpus()[0]?.model || 'CPU'}`;
        }

        const hash = crypto.createHash('sha256').update(rawGuid).digest('hex').toUpperCase();
        const part1 = hash.substring(0, 4);
        const part2 = hash.substring(4, 8);
        const hwid = `BNC-${part1}-${part2}`;

        try {
            fs.writeFileSync(keyFile, hwid, 'utf8');
        } catch(e) {}

        return hwid;
    } catch(err) {
        console.warn('[Main] get-hardware-uuid fallback:', err.message);
        return null;
    }
});

const backupDir = path.join(userDataPath, 'backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// دالة الهجرة الآمنة لنقل الملفات من المجلدات القديمة إلى AppData/Roaming/Bayan POS/backups
function autoMigrateLegacyBackups() {
    try {
        const legacyDirs = [
            path.join(os.homedir(), 'Downloads'),
            path.join(os.homedir(), 'bayan_backups'),
            path.join(__dirname, 'bayan_backups'),
            path.join(process.cwd(), 'bayan_backups'),
            path.join(process.cwd(), 'backups')
        ];

        legacyDirs.forEach(dir => {
            if (fs.existsSync(dir) && dir !== backupDir) {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    if ((file.startsWith('backup_pos_') || file.startsWith('backup_complete_')) && file.endsWith('.json')) {
                        const src = path.join(dir, file);
                        const dest = path.join(backupDir, file);
                        if (!fs.existsSync(dest)) {
                            fs.copyFileSync(src, dest);
                            console.log(`📦 Synced backup file: ${file} -> ${dest}`);
                        }
                        // حذف الملفات القديمة فقط إذا لم تكن في مجلد التنزيلات
                        if (dir !== path.join(os.homedir(), 'Downloads')) {
                            try { fs.unlinkSync(src); } catch (e) {}
                        }
                    }
                });
                try {
                    if (dir !== path.join(os.homedir(), 'Downloads')) {
                        const remaining = fs.readdirSync(dir);
                        if (remaining.length === 0) {
                            fs.rmdirSync(dir);
                            console.log(`🧹 Cleaned up legacy backup folder: ${dir}`);
                        }
                    }
                } catch (e) {}
            }
        });
    } catch (err) {
        console.warn("⚠️ Legacy backup migration warning:", err.message);
    }
}
// تشغيل فحص ونقل النسخ الاحتياطية القديمة بعد 10 ثوانٍ في الخلفية بهدوء لعدم تعطيل إقلاع البرنامج نهائياً
setTimeout(() => {
    try {
        autoMigrateLegacyBackups();
    } catch(e) {
        console.warn("Background backup migration:", e);
    }
}, 10000);

// الحصول على المسار الحقيقي لمجلد النسخ الاحتياطية
ipcMain.handle('get-backup-dir', () => {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
});

// حفظ نسخة احتياطية مباشرة في مجلد النظام عبر IPC (غير متزامن Asynchronous لمنع أي تجميد للواجهة)
ipcMain.handle('save-backup-data', async (_e, payload) => {
    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const pad = (n) => String(n).padStart(2, '0');
        const d = new Date();
        const timestamp = `${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}__${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;
        const prefix = payload?.isManual ? 'backup_pos_manual_' : 'backup_pos_auto_';
        const fileName = `${prefix}${timestamp}.json`;
        const filePath = path.join(backupDir, fileName);
        await fs.promises.writeFile(filePath, payload?.dataStr || '{}', 'utf8');

        // إذا كان النسخ يدوياً، نقوم بحفظ نسخة إضافية فورية على سطح المكتب Desktop ليجدها العميل أمامه مباشرة
        if (payload?.isManual) {
            try {
                const desktopDir = app.getPath('desktop');
                const desktopFilePath = path.join(desktopDir, fileName);
                await fs.promises.writeFile(desktopFilePath, payload?.dataStr || '{}', 'utf8');
                console.log("Manual backup also saved to Desktop:", desktopFilePath);
            } catch(deskErr) {
                console.warn("Could not save copy to desktop:", deskErr);
            }
        }

        return { success: true, filePath, fileName, backupDir };
    } catch (err) {
        console.error("save-backup-data IPC error:", err);
        return { success: false, error: err.message };
    }
});

// فتح مجلد النسخ الاحتياطية بـ shell.openPath() أو explorer.exe المباشر
ipcMain.handle('open-backup-folder', async () => {
    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        // مزامنة أي نسخ جديدة نزلت في مجلد التنزيلات أولاً لكي تظهر فوراً للمستخدم
        autoMigrateLegacyBackups();

        const openErr = await shell.openPath(backupDir);
        if (openErr) {
            console.warn("shell.openPath warning, using explorer fallback:", openErr);
            const { exec } = require('child_process');
            exec(`explorer.exe "${backupDir}"`);
        }
        return true;
    } catch (err) {
        console.error("Failed to open backup path, fallback to explorer:", err);
        try {
            const { exec } = require('child_process');
            exec(`explorer.exe "${backupDir}"`);
            return true;
        } catch (e2) {
            return false;
        }
    }
});

// إدارة وتدوير النسخ الاحتياطية الاحتفاظ بأحدث N (الافتراضي 100) وحذف الأقدم تلقائياً
ipcMain.handle('rotate-backups', async (event, maxKeep = 100) => {
    try {
        if (!fs.existsSync(backupDir)) return { success: true, count: 0 };

        const files = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup_pos_') && f.endsWith('.json'))
            .map(f => {
                const fp = path.join(backupDir, f);
                const stat = fs.statSync(fp);
                return { name: f, path: fp, time: stat.mtimeMs };
            })
            .sort((a, b) => b.time - a.time);

        let deleted = 0;
        if (files.length > maxKeep) {
            const toDelete = files.slice(maxKeep);
            for (const fileObj of toDelete) {
                fs.unlinkSync(fileObj.path);
                deleted++;
            }
            console.log(`🧹 Rotated backup folder: deleted ${deleted} old file(s).`);
        }
        return { success: true, count: files.length, deleted: deleted };
    } catch (err) {
        console.error("Failed to rotate backup files:", err);
        return { success: false, error: err.message };
    }
});

// =========================================================================
// 🔒 سياسة تجميد وإيقاف التحديثات التلقائية المباشرة (Auto-Updates Policy Storage)
// =========================================================================
function getUpdatePolicyFilePath() {
    try {
        return path.join(app.getPath('userData'), 'update-policy.json');
    } catch (e) {
        return null;
    }
}

function isAutoUpdatesFrozenOnDisk() {
    try {
        const p = getUpdatePolicyFilePath();
        if (p && fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf8');
            const data = JSON.parse(content);
            return data && (data.autoUpdatesDisabled === true || data.disabled === true);
        }
    } catch (e) {
        console.warn('[Updater] Could not read update-policy.json:', e.message);
    }
    return false;
}

function setAutoUpdatesFrozenOnDisk(disabled) {
    try {
        const p = getUpdatePolicyFilePath();
        if (p) {
            fs.writeFileSync(p, JSON.stringify({
                autoUpdatesDisabled: !!disabled,
                version: app.getVersion(),
                updatedAt: new Date().toISOString()
            }, null, 2), 'utf8');
            console.log(`[Updater] 🔒 تم حفظ سياسة التحديثات على القرص: ${disabled ? 'مجمدة ومقفولة' : 'مفعلة'}`);
            return true;
        }
    } catch (e) {
        console.error('[Updater] Could not write update-policy.json:', e.message);
    }
    return false;
}

// =========================================================================
// 🚀 2. نظام التحديثات التلقائية المباشرة بالخلفية (Electron Auto Updater)
// =========================================================================
try {
    const { autoUpdater: updater } = require('electron-updater');
    autoUpdater = updater;
    autoUpdater.autoDownload = false; // التنزيل بالخلفية عند طلب المستخدم فقط
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;

    autoUpdater.on('checking-for-update', () => {
        console.log('[Updater] Checking for updates...');
        if (mainWindow) mainWindow.webContents.send('update-checking');
    });

    autoUpdater.on('update-available', (info) => {
        if (isAutoUpdatesFrozenOnDisk()) {
            console.log('[Updater] 🔒 تم حجب إشعار توفر التحديث لأن التحديثات التلقائية مجمدة ومقفولة.');
            return;
        }
        console.log('[Updater] Update available:', info ? info.version : 'unknown');
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('update-available', {
                currentVersion: app.getVersion(),
                newVersion: info ? info.version : '',
                releaseNotes: info ? (info.releaseNotes || 'تحسينات جديدة وتحديثات أمان مستقرة.') : '',
                releaseDate: info ? (info.releaseDate || '') : '',
                files: info ? (info.files || []) : []
            });
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('[Updater] Update not available. Current app version is latest:', info ? info.version : app.getVersion());
        if (mainWindow) mainWindow.webContents.send('update-not-available');
    });

    autoUpdater.on('error', (err) => {
        const errorMsg = err ? (err.message || String(err)) : 'Unknown updater error';
        console.error('[Updater] Error:', errorMsg);
        if (mainWindow) mainWindow.webContents.send('update-error', errorMsg);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const pct = Math.round(progressObj.percent || 0);
        console.log(`[Updater] Download progress: ${pct}% | Transferred: ${progressObj.transferred} / ${progressObj.total}`);
        if (mainWindow) {
            mainWindow.webContents.send('update-download-progress', {
                percent: pct,
                transferred: progressObj.transferred || 0,
                total: progressObj.total || 0,
                bytesPerSecond: progressObj.bytesPerSecond || 0
            });
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[Updater] Download completed. Update downloaded successfully:', info ? info.version : '');
        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded', {
                version: info ? info.version : '',
                releaseNotes: info ? info.releaseNotes : ''
            });
        }
    });

} catch (e) {
    console.warn('[Updater] electron-updater not loaded:', e.message);
}

ipcMain.handle('get-auto-updates-policy', () => {
    return { frozen: isAutoUpdatesFrozenOnDisk() };
});

ipcMain.handle('set-auto-updates-policy', (_event, disabled) => {
    const success = setAutoUpdatesFrozenOnDisk(disabled);
    return { success, frozen: !!disabled };
});

ipcMain.handle('check-for-updates', async () => {
    console.log('[Updater] Triggering check-for-updates via IPC...');
    if (isAutoUpdatesFrozenOnDisk()) {
        console.log('[Updater] 🔒 Check blocked via IPC: Auto-updates are frozen.');
        return { success: false, frozen: true, message: 'التحديثات التلقائية مجمدة ومقفولة بناءً على رغبة العميل.' };
    }
    if (!autoUpdater) return { success: false, message: 'AutoUpdater not ready' };
    try {
        const checkResult = await autoUpdater.checkForUpdates();
        console.log('[Updater] checkResult version:', checkResult && checkResult.updateInfo ? checkResult.updateInfo.version : 'N/A');
        return { success: true, updateInfo: checkResult ? checkResult.updateInfo : null };
    } catch (err) {
        console.error("[Updater] Check updates failed:", err.message);
        if (mainWindow) mainWindow.webContents.send('update-error', err.message);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('start-download-update', async () => {
    console.log('[Updater] Download started via IPC...');
    if (!autoUpdater) return { success: false, error: 'AutoUpdater not ready' };
    try {
        if (mainWindow) {
            mainWindow.webContents.send('trigger-auto-backup-before-update');
        }
        // إجبار فحص التحديثات إذا لم يكن كائن updateInfo مخزناً لضمان بدء التنزيل فوراً
        if (!autoUpdater.updateInfo) {
            console.log('[Updater] updateInfo is null, running checkForUpdates before download...');
            await autoUpdater.checkForUpdates();
        }
        console.log('[Updater] Calling autoUpdater.downloadUpdate()...');
        await autoUpdater.downloadUpdate();
        console.log('[Updater] autoUpdater.downloadUpdate() initiated.');
        return { success: true };
    } catch (err) {
        console.error("[Updater] downloadUpdate failed:", err.message);
        if (mainWindow) mainWindow.webContents.send('update-error', err.message);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('quit-and-install-update', () => {
    console.log('[Updater] quit-and-install-update requested via IPC.');
    if (autoUpdater) {
        if (mainWindow) {
            mainWindow.webContents.send('trigger-auto-backup-before-update');
        }
        setTimeout(() => {
            isQuitting = true;
            autoUpdater.quitAndInstall(false, true);
        }, 800);
    }
});

try { ipcMain.removeHandler('get-app-version'); } catch(e) {}
ipcMain.handle('get-app-version', () => {
    return app.getVersion() || '3.2.2';
});

// =========================================================================
// 🌐 Local Server Hub IPC Handlers
// =========================================================================
ipcMain.handle('get-local-server-info', () => {
    try {
        return {
            isRunning: true,
            ip: server_hub.getLocalIPAddress(),
            port: server_hub.SERVER_PORT,
            pairedCount: (server_hub.getPairedDevicesList() || []).length,
            pendingTransfersCount: (server_hub.getInTransitTransfersList() || []).filter(t => t.transferStatus === 'pending').length
        };
    } catch (e) {
        return { isRunning: false, ip: '127.0.0.1', port: 4545, pairedCount: 0, pendingTransfersCount: 0 };
    }
});

ipcMain.handle('get-paired-devices', () => {
    try {
        return server_hub.getPairedDevicesList() || [];
    } catch (e) {
        return [];
    }
});

ipcMain.handle('remove-paired-device', (event, deviceId) => {
    try {
        return server_hub.removePairedDevice(deviceId);
    } catch (e) {
        return [];
    }
});

ipcMain.handle('update-paired-device-name', (event, { deviceId, newName }) => {
    try {
        return server_hub.updatePairedDeviceName(deviceId, newName);
    } catch (e) {
        return false;
    }
});

ipcMain.handle('get-pending-pairing-requests', () => {
    try {
        return server_hub.getPendingPairingRequests() || [];
    } catch (e) {
        return [];
    }
});

ipcMain.handle('approve-pairing-request', (event, reqId) => {
    try {
        return server_hub.approvePairingRequest(reqId);
    } catch (e) {
        return false;
    }
});

ipcMain.handle('get-in-transit-transfers', () => {
    try {
        return server_hub.getInTransitTransfersList() || [];
    } catch (e) {
        return [];
    }
});

ipcMain.handle('sync-in-transit-transfers', (event, list) => {
    try {
        return server_hub.updateInTransitTransfersList(list);
    } catch (e) {
        return [];
    }
});

ipcMain.handle('sync-master-db', (event, dbData) => {
    try {
        if (server_hub && typeof server_hub.updateMasterDbData === 'function') {
            return server_hub.updateMasterDbData(dbData, 'DEV-HOST', true);
        }
        return { success: true };
    } catch (err) {
        console.error('[Main] sync-master-db error:', err);
        return { success: false, message: err.message };
    }
});

ipcMain.handle('get-master-db', () => {
    try {
        return server_hub.getMasterDbData();
    } catch (e) {
        return null;
    }
});

ipcMain.handle('check-firewall-status', async () => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
        exec('netsh advfirewall firewall show rule name="Bayan POS Local Server"', (err, stdout) => {
            const isOpen = !err && stdout && stdout.includes('Enabled:') && stdout.includes('Yes') && stdout.includes('4545');
            resolve({ success: true, isOpen: !!isOpen });
        });
    });
});

ipcMain.handle('fix-firewall-rule', async () => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
        const cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList \'/c netsh advfirewall firewall delete rule name=\\\"Bayan POS Local Server\\\" & netsh advfirewall firewall add rule name=\\\"Bayan POS Local Server\\\" dir=in action=allow protocol=TCP localport=4545 profile=any\' -Verb RunAs"';
        exec(cmd, (err) => {
            if (err) resolve({ success: false, message: err.message });
            else resolve({ success: true });
        });
    });
});

ipcMain.handle('get-terminal-role', () => {
    return getPersistedTerminalRole();
});

ipcMain.handle('set-terminal-role', (event, role) => {
    const success = setPersistedTerminalRole(role);
    if (role === 'master') {
        try {
            server_hub.startServer(__dirname, (evt, data) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send(evt, data);
                }
            });
        } catch(e) {}
    } else {
        try {
            server_hub.stopServer();
        } catch(e) {}
    }
    return { success, role };
});