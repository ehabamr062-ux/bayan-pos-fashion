const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// =========================================================================
// 🔒 1. إدارة الجلسة المفردة وحماية الأجهزة من التكرار والتعليق
// =========================================================================
// 🛡️ صمام الأمان الفولاذي: تحسينات فائقة للأجهزة الضعيفة والمتوسطة (Ultra-Low Spec Optimization)
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('renderer-process-limit', '2');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512 --expose-gc');

// تنظيف دوري للرامات بالخلفية
setInterval(() => {
    if (global.gc) {
        try { global.gc(); } catch (e) {}
    }
}, 60000);

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
            devTools: false,
            spellcheck: false, // تعطيل التدقيق الإملائي لتوفير الرامات والمعالج
            backgroundThrottling: false // الحفاظ على أداء سريع حتى عند تصغير النافذة
        },
        icon: path.join(__dirname, 'media', 'bayan_logo.png')
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

        // منع F12 و Ctrl+Shift+I و Ctrl+Shift+J و Ctrl+Shift+C
        if (
            input.key === 'F12' || 
            (input.control && input.shift && (key === 'i' || key === 'j' || key === 'c'))
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

    // 🔒 إغلاق أدوات المطور فوراً
    win.webContents.on('devtools-opened', () => {
        win.webContents.closeDevTools();
    });

    // إغلاق نظيف وسريع بدون تعليق عمليات النظام
    win.on('close', () => {
        openWindows.delete(win);
        if (openWindows.size === 0) {
            isQuitting = true;
            try {
                win.webContents.send('trigger-backup-before-quit');
            } catch(err) {}
            setTimeout(() => {
                app.exit(0);
            }, 300);
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

    return win;
}

// تهيئة التطبيق وإحالة الجلسة المكررة إلى النافذة المفتوحة
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.whenReady().then(() => {
    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // فحص التحديثات تلقائياً بعد 5 ثوانٍ من تشغيل التطبيق
    setTimeout(() => {
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
    const newWin = createWindow();
    return true;
});

ipcMain.on('open-new-window', () => {
    createWindow();
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
    isQuitting = false;
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
            path.join(os.homedir(), 'bayan_backups'),
            path.join(__dirname, 'bayan_backups'),
            path.join(process.cwd(), 'bayan_backups'),
            path.join(process.cwd(), 'backups')
        ];

        legacyDirs.forEach(dir => {
            if (fs.existsSync(dir) && dir !== backupDir) {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    if (file.endsWith('.json')) {
                        const src = path.join(dir, file);
                        const dest = path.join(backupDir, file);
                        if (!fs.existsSync(dest)) {
                            fs.copyFileSync(src, dest);
                            console.log(`📦 Migrated legacy backup file: ${file} -> ${dest}`);
                        }
                        try { fs.unlinkSync(src); } catch (e) {}
                    }
                });
                try {
                    const remaining = fs.readdirSync(dir);
                    if (remaining.length === 0) {
                        fs.rmdirSync(dir);
                        console.log(`🧹 Cleaned up legacy backup folder: ${dir}`);
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

// فتح مجلد النسخ الاحتياطية بـ shell.openPath()
ipcMain.handle('open-backup-folder', async () => {
    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        await shell.openPath(backupDir);
        return true;
    } catch (err) {
        console.error("Failed to open backup path:", err);
        return false;
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
        console.log('[Updater] Update available:', info ? info.version : 'unknown');
        if (mainWindow) {
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

ipcMain.handle('check-for-updates', async () => {
    console.log('[Updater] Triggering check-for-updates via IPC...');
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