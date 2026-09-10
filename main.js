const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// =========================================================================
// 🚀 1. تسريع الأداء الفائق والرسوميات (Native GPU Hardware Acceleration)
// يمنح Electron نفس سرعة وسلاسة متصفح جوجل كروم (60 FPS) مع استهلاك خفيف للموارد
// =========================================================================
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');


const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('⚠️ نسخة أخرى من تطبيق Bayan POS تعمل بالفعل بالخلفية. إغلاق النسخة المكررة فوراً...');
    app.exit(0);
}

let openWindows = new Set();
let mainWindow;
let isQuitting = false;
const LICENSE_SECRET = 'BAYAN_POS_SECRET_KEY_2026';

function createWindow() {
    Menu.setApplicationMenu(null); // إلغاء القوائم الافتراضية

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff',
        show: false, // لا تظهر النافذة إلا بعد اكتمال الرسم لمنع أي وميض أبيض أو شاشة معلقة
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
        console.warn("⚠️ Window became unresponsive. Reloading...");
        win.reload();
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

        // منع إعادة التحميل العادية F5 أو Ctrl+R
        if (input.key === 'F5' || (input.control && key === 'r')) {
            win.webContents.reload();
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

    // إغلاق نظيف وسريع مع حماية البيانات غير المحفوظة
    win.on('close', () => {
        openWindows.delete(win);
        if (openWindows.size === 0) {
            isQuitting = true;
            try {
                win.webContents.send('trigger-backup-before-quit');
            } catch(err) {}
            if (global.quitTimeout) clearTimeout(global.quitTimeout);
            global.quitTimeout = setTimeout(() => {
                app.exit(0);
            }, 800);
        }
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

    // 🔒 صمام الأمان الفولاذي: منع فتح أي نوافذ جديدة داخل بيئة Electron وتوجيه الروابط الآمنة للمتصفح الافتراضي
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url) || /^tel:/i.test(url)) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // 🔒 منع الانتقال إلى أي روابط خارجية غير ملفات النظام المحلية لحماية صلاحيات Node.js
    win.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
            if (/^https?:\/\//i.test(url)) {
                shell.openExternal(url);
            }
        }
    });

    return win;
}

// تهيئة التطبيق وإحالة الجلسة المكررة إلى النافذة المفتوحة
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

const server_hub = require('./server_hub.js');

app.whenReady().then(() => {
    createWindow();

    // تشغيل السيرفر الشبكي المحلي المدمج لربط أجهزة التابلت والفروع
    try {
        server_hub.startServer(__dirname, (event, data) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(event, data);
            }
        });
    } catch (err) {
        console.error('[ServerHub] Failed to start local server:', err.message);
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
    app.exit(0);
});

// قنوات الاتصال (IPC) لفتح نافذة جديدة
ipcMain.handle('open-new-window', () => {
    createWindow();
    return true;
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
        app.quit();
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
    isQuitting = true;
    app.quit();
});

ipcMain.on('quit-directly', () => {
    isQuitting = true;
    app.quit();
});

// فتح الروابط الخارجية بأمان مع التحقق من الـ Protocol
ipcMain.handle('open-url', async (event, url) => {
    try {
        // ✅ أمان: السماح فقط بـ http و https و mailto ومنع أي بروتوكول آخر قد ينفّذ أوامر نظام
        const parsedUrl = new URL(url);
        const allowedProtocols = ['http:', 'https:', 'mailto:'];
        if (!allowedProtocols.includes(parsedUrl.protocol)) {
            console.error('⚠️ محاولة فتح رابط غير مسموح: ' + url);
            return false;
        }
        await shell.openExternal(parsedUrl.href);
    } catch (err) {
        console.error('Failed to open URL:', err);
    }
    return true;
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
const os = require('os');
const userDataPath = path.join(app.getPath('appData'), 'Bayan POS');
app.setPath('userData', userDataPath);
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

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
autoMigrateLegacyBackups();

// الحصول على المسار الحقيقي لمجلد النسخ الاحتياطية
ipcMain.handle('get-backup-dir', () => {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
});

// حفظ نسخة احتياطية مباشرة في مجلد النظام عبر IPC
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
        fs.writeFileSync(filePath, payload?.dataStr || '{}', 'utf8');
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
let autoUpdater = null;
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

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
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