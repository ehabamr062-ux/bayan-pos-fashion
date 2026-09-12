// ============================================================
//  النسخ الاحتياطي التلقائي واستعادة البيانات (Backup & Restore Engine)
// ============================================================



async function backupData() {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية تصدير النسخ الاحتياطية!", "error");
    }
    await window.executeAutoBackupToFile(false, true);
}

function restoreData(input) {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        if (input) input.value = '';
        return showToast("🚫 ليس لديك صلاحية استعادة النسخ الاحتياطية!", "error");
    }
    const file = input ? input.files[0] : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            let data;
            try {
                data = JSON.parse(e.target.result);
            } catch (parseErr) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'error',
                        titleText: '❌ خطأ في قراءة الملف',
                        msg: 'الملف المختار ليس ملف JSON صالحاً. يرجى التأكد من اختيار ملف نسخة احتياطية سليم.'
                    });
                } else {
                    alert("❌ الملف المختار ليس ملف JSON صالحاً.");
                }
                if (input) input.value = '';
                return;
            }

            // 🛑 فحص التحقق من سلامة وصلاحية محتوى النسخة الاحتياطية قبل أي تعديل
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'error',
                        titleText: '❌ تنسيق غير صالح',
                        msg: 'هذا الملف لا يحتوي على بيانات نسخة احتياطية صالحة لنظام بَيَان.'
                    });
                } else {
                    alert("❌ هذا الملف لا يحتوي على بيانات نسخة احتياطية صالحة لنظام بَيَان.");
                }
                if (input) input.value = '';
                return;
            }

            const prodCount = Array.isArray(data.products) ? data.products.length : 0;
            const txCount = Array.isArray(data.transactions) ? data.transactions.length : 0;
            const accCount = Array.isArray(data.accounts) ? data.accounts.length : 0;
            const hasSettings = data.settings && typeof data.settings === 'object';
            const hasUsers = Array.isArray(data.users) && data.users.length > 0;

            if (prodCount === 0 && txCount === 0 && accCount === 0 && !hasSettings && !hasUsers) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'error',
                        titleText: '❌ ملف فارغ أو غير متوافق',
                        msg: 'الملف المختار لا يحتوي على أي أصناف أو فواتير أو حسابات تابعة لنظام بَيَان.\n\n🛡️ تم إلغاء العملية فوراً لحماية بياناتك الحالية من المسح.'
                    });
                } else {
                    alert("❌ الملف المختار فارغ أو غير صالح لنظام بَيَان. تم إلغاء العملية لحماية بياناتك.");
                }
                if (input) input.value = '';
                return;
            }

            // وظيفة التنفيذ الفعلي بعد تأكيد المستخدم
            const executeRestore = async () => {
                const tablesToTransact = [db.products, db.transactions, db.accounts, db.users, db.trash];
                if (db.treasuryAudit) tablesToTransact.push(db.treasuryAudit);
                if (db.auditLogs) tablesToTransact.push(db.auditLogs);
                if (db.settings) tablesToTransact.push(db.settings);

                await db.transaction('rw', tablesToTransact, async () => {
                    // 1. مسح وإعادة كتابة الجداول الأساسية
                    await db.products.clear();
                    await db.transactions.clear();
                    await db.accounts.clear();
                    await db.users.clear();
                    await db.trash.clear();
                    
                    if (data.products && data.products.length > 0) await db.products.bulkPut(data.products);
                    if (data.transactions && data.transactions.length > 0) await db.transactions.bulkPut(data.transactions);
                    if (data.accounts && data.accounts.length > 0) await db.accounts.bulkPut(data.accounts);
                    if (data.users && data.users.length > 0) {
                        // 🔒 تشفير رموز الـ PIN في قاعدة البيانات عند الاسترجاع مع دعم كامل للنسخ القديمة
                        const restoredUsers = data.users.map(u => {
                            if (!u) return u;
                            const copy = { ...u };
                            const rawPin = copy.pin;
                            const plainPin = (typeof window.BayanSecurity !== 'undefined' && typeof window.BayanSecurity.decryptPin === 'function')
                                ? window.BayanSecurity.decryptPin(rawPin)
                                : rawPin;
                            copy.pin = (typeof window.BayanSecurity !== 'undefined' && typeof window.BayanSecurity.encryptPin === 'function')
                                ? window.BayanSecurity.encryptPin(plainPin)
                                : rawPin;
                            return copy;
                        });
                        await db.users.bulkPut(restoredUsers);
                    }
                    if (data.trash && data.trash.length > 0) await db.trash.bulkPut(data.trash);
                    
                    // 2. استرجاع سجلات الخزينة والورديات وسجلات التدقيق
                    if (db.treasuryAudit) {
                        await db.treasuryAudit.clear();
                        if (data.treasuryAudit && data.treasuryAudit.length > 0) {
                            await db.treasuryAudit.bulkPut(data.treasuryAudit);
                        }
                    }
                    if (db.auditLogs) {
                        await db.auditLogs.clear();
                        if (data.auditLogs && data.auditLogs.length > 0) {
                            await db.auditLogs.bulkPut(data.auditLogs);
                        }
                    }
                });

                // 3. استرجاع الإعدادات
                if (data.settings) {
                    const existingMain = await db.settings.get('main') || {};
                    await db.settings.put({ ...existingMain, ...data.settings, id: 'main' });
                    setStore('pos_settings', JSON.stringify(data.settings));
                }
                
                // 4. استرجاع المخازن المتعددة والتصنيفات وإعدادات الباركود
                if (data.warehouses && data.warehouses.length > 0) {
                    setStore('pos_warehouses', JSON.stringify(data.warehouses));
                }
                if (data.inventoryCategories && data.inventoryCategories.length > 0) {
                    setStore('bayan_inventory_categories', JSON.stringify(data.inventoryCategories));
                }
                if (data.barcodeLabelSettings && Object.keys(data.barcodeLabelSettings).length > 0) {
                    setStore('bayan_barcode_label_settings', JSON.stringify(data.barcodeLabelSettings));
                }
                if (data.discountReasons) setStore('pos_discount_reasons', JSON.stringify(data.discountReasons));
                if (data.taxReasons) setStore('pos_tax_reasons', JSON.stringify(data.taxReasons));
                if (data.purchaseDiscountReasons) setStore('pos_p_discount_reasons', JSON.stringify(data.purchaseDiscountReasons));
                if (data.purchaseTaxReasons) setStore('pos_p_tax_reasons', JSON.stringify(data.purchaseTaxReasons));

                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'success',
                        titleText: '✅ تم استعادة النسخة الاحتياطية بنجاح',
                        msg: `تمت استعادة كافة البيانات بنجاح!\n• عدد الأصناف: ${prodCount}\n• عدد الفواتير والحركات: ${txCount}\n• عدد الحسابات: ${accCount}\n\nسيتم إعادة تشغيل التطبيق لتطبيق البيانات فوراً.`,
                        confirmText: 'إعادة التشغيل الآن 🔄',
                        onConfirm: () => location.reload()
                    });
                    setTimeout(() => location.reload(), 2500);
                } else {
                    alert("✅ تم استعادة النسخة الاحتياطية بنجاح! سيتم إعادة تحميل الصفحة.");
                    location.reload();
                }
            };

            // نافذة تأكيد قبل الاسترجاع مع كشف محتويات النسخة
            const summaryHtml = `هل أنت متأكد من رغبتك في استعادة هذه النسخة الاحتياطية؟<br><br>` +
                `<div style="text-align: right; background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.95rem; line-height: 1.8;">` +
                `📦 <b>عدد الأصناف:</b> ${prodCount} صنف<br>` +
                `🧾 <b>عدد الفواتير والحركات:</b> ${txCount} حركة<br>` +
                `👥 <b>عدد الحسابات والعملاء:</b> ${accCount} حساب<br>` +
                `</div><br>` +
                `<b style="color: #dc2626;">⚠️ تحذير:</b> سيتم استبدال البيانات الحالية بالبيانات المحفوظة في هذا الملف.`;

            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تأكيد استعادة النسخة الاحتياطية',
                    msg: summaryHtml,
                    showCancel: true,
                    confirmText: 'نعم، استعد البيانات 🔄',
                    cancelText: 'إلغاء ❌',
                    onConfirm: () => executeRestore(),
                    onCancel: () => { if (input) input.value = ''; }
                });
            } else {
                if (confirm(`هل أنت متأكد من استعادة النسخة الاحتياطية؟\nالأصناف: ${prodCount}\nالفواتير: ${txCount}\nالحسابات: ${accCount}`)) {
                    executeRestore();
                } else {
                    if (input) input.value = '';
                }
            }
        } catch (err) {
            console.error("Failed to restore backup:", err);
            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'error',
                    titleText: '❌ فشل الاستعادة',
                    msg: 'حدث خطأ أثناء قراءة ملف النسخة الاحتياطية. يرجى التأكد من اختيار ملف JSON سليم.'
                });
            } else {
                alert("❌ فشل استعادة النسخة الاحتياطية، يرجى التأكد من سلامة الملف.");
            }
        }
    };
    reader.readAsText(file);
}

// ================= منطق إضافة حساب جديد (New Account Logic) =================
window.copyPaymentNumber = function(text) {
    if (!text || text === '---' || text === 'غير محدد') {
        alert('لا يوجد كود جهاز لنسخه!');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        alert('تم نسخ كود الجهاز بنجاح! 📋\n' + text);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        const tempInput = document.createElement('input');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        alert('تم نسخ كود الجهاز بنجاح! 📋\n' + text);
    });
};

// ================= خدمة النسخ الاحتياطي التلقائي المطور (Advanced Auto-Backup) =================

window.showBackupProgressOverlay = function() {
    let backupPathDisplay = 'C:\\Users\\...\\AppData\\Roaming\\Bayan POS\\backups';
    try {
        const path = require('path');
        const os = require('os');
        backupPathDisplay = path.join(os.homedir(), 'AppData', 'Roaming', 'Bayan POS', 'backups');
    } catch(e) {}

    let overlay = document.getElementById('backupProgressOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'backupProgressOverlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.92); 
            z-index: 2147483647; display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: white; font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px;
        `;
        
        overlay.innerHTML = `
            <div style="background: rgba(30, 41, 59, 0.95); border: 2px solid #3b82f6; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 30px rgba(59,130,246,0.3); border-radius: 24px; padding: 40px 30px; text-align: center; max-width: 440px; width: 90%; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: rgba(59, 130, 246, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px dashed #60a5fa;">
                    <div style="font-size: 2.5rem; animation: spinPulse 2s infinite linear;">💾</div>
                </div>
                <h3 style="margin: 0 0 10px 0; font-size: 1.4rem; color: #f8fafc; font-weight: 900;">جاري إنشاء النسخة الاحتياطية...</h3>
                <p style="margin: 0 0 20px 0; font-size: 0.9rem; color: #94a3b8; line-height: 1.6;">يتم الآن تأمين وحفظ كافة المنتجات، الفواتير، الحسابات، والخزينة بأمان فائق.</p>
                <div style="width: 100%; height: 8px; background: #334155; border-radius: 99px; overflow: hidden; position: relative;">
                    <div style="position: absolute; top:0; left:0; bottom:0; background: linear-gradient(90deg, #3b82f6, #60a5fa); width: 100%; animation: backupProgress 1.5s infinite ease-in-out;"></div>
                </div>
            </div>
            <style>
                @keyframes spinPulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
                @keyframes backupProgress { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
            </style>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.style.display = 'flex';
    }
};

window.hideBackupProgressOverlay = function() {
    const overlay = document.getElementById('backupProgressOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
};

window.openBackupFolder = async function() {
    console.log("📂 جاري فتح مجلد النسخ الاحتياطية على نظام ويندوز...");

    // 1. استدعاء Main Process عبر IPC في بيئة Electron
    let ipc = null;
    try {
        if (typeof window !== 'undefined' && window.require) {
            ipc = window.require('electron').ipcRenderer;
        } else if (typeof require !== 'undefined') {
            ipc = require('electron').ipcRenderer;
        }
    } catch (e) {}

    if (ipc && typeof ipc.invoke === 'function') {
        try {
            const ok = await ipc.invoke('open-backup-folder');
            if (ok) {
                console.log("✅ تم فتح مجلد النسخ بنجاح عبر IPC.");
                return true;
            }
        } catch (ipcErr) {
            console.warn("⚠️ IPC open-backup-folder warning, trying fallbacks:", ipcErr);
        }
    }

    // 2. استخدام Node.js child_process لتشغيل explorer.exe مباشرة
    try {
        const cp = (typeof window !== 'undefined' && window.require) ? window.require('child_process') : (typeof require !== 'undefined' ? require('child_process') : null);
        const os = (typeof window !== 'undefined' && window.require) ? window.require('os') : (typeof require !== 'undefined' ? require('os') : null);
        const path = (typeof window !== 'undefined' && window.require) ? window.require('path') : (typeof require !== 'undefined' ? require('path') : null);
        const fs = (typeof window !== 'undefined' && window.require) ? window.require('fs') : (typeof require !== 'undefined' ? require('fs') : null);

        if (cp && os && path) {
            const defaultPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Bayan POS', 'backups');
            if (fs && !fs.existsSync(defaultPath)) {
                fs.mkdirSync(defaultPath, { recursive: true });
            }
            cp.exec(`explorer.exe "${defaultPath}"`);
            console.log("✅ تم فتح المجلد عبر explorer.exe:", defaultPath);
            return true;
        }
    } catch (cpErr) {
        console.warn("⚠️ Direct child_process fallback warning:", cpErr);
    }

    // 3. المحاولة عبر electron.shell
    try {
        const electron = (typeof window !== 'undefined' && window.require) ? window.require('electron') : (typeof require !== 'undefined' ? require('electron') : null);
        if (electron && electron.shell && typeof electron.shell.openPath === 'function') {
            const os = (typeof window !== 'undefined' && window.require) ? window.require('os') : require('os');
            const path = (typeof window !== 'undefined' && window.require) ? window.require('path') : require('path');
            const defaultPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Bayan POS', 'backups');
            await electron.shell.openPath(defaultPath);
            return true;
        }
    } catch (shellErr) {}

    // 4. في حالة المتصفح العادي (Browser بدون Electron)
    if (typeof showCustomAlert === 'function') {
        showCustomAlert({
            type: 'info',
            titleText: '📂 مجلد النسخ الاحتياطية للنظام',
            cardWidth: '820px',
            maxWidth: '95vw',
            cardPadding: '20px 26px',
            hideIcon: true,
            msg: `
                <div style="text-align: right; direction: rtl; font-family: 'Cairo', sans-serif;">
                    <!-- شريط الهوية ومجال النشاط التجاري (أفقي أنيق) -->
                    <div style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #1e293b, #0f172a); color: white; padding: 10px 18px; border-radius: 12px; margin-bottom: 14px; border: 1.5px solid #334155; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">👗👠</span>
                            <div>
                                <div style="font-size: 1rem; font-weight: 900; color: #ffffff; line-height: 1.2;">بَيَان POS فاشون (Bayan POS Fashion)</div>
                                <div style="font-size: 0.76rem; color: #94a3b8; font-weight: 700; margin-top: 2px;">إدارة محلات ونشاط الملابس والأحذية والأزياء والمخازن</div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.72rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 3px 10px; border-radius: 20px; font-weight: 800;">بيانات مشفرة ومؤمنة 🛡️</span>
                        </div>
                    </div>

                    <!-- شبكة المسارات الأفقية (عمودين متجاورين جنباً إلى جنب) -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px;">
                        
                        <!-- بطاقة 1: تطبيق الديسكتوب (Electron) -->
                        <div style="background: #f8fafc; padding: 14px; border-radius: 12px; border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                            <div>
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                    <div style="font-size: 0.88rem; color: #0f172a; font-weight: 900; display: flex; align-items: center; gap: 6px;">
                                        <span>💻</span> تطبيق الديسكتوب (Electron):
                                    </div>
                                    <span style="font-size: 0.72rem; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 6px; font-weight: 800;">حفظ صامت وتلقائي</span>
                                </div>
                                <div style="font-size: 0.78rem; color: #64748b; font-weight: 700; margin-bottom: 8px; line-height: 1.4;">
                                    المجلد المخصص للنظام (تدوير تلقائي لآخر 100 نسخة):
                                </div>
                                <div style="background: #ffffff; padding: 8px 10px; border-radius: 8px; border: 1px solid #cbd5e1; direction: ltr; text-align: left; font-family: monospace; font-size: 0.82rem; font-weight: 800; color: #0f172a; word-break: break-all; white-space: normal; line-height: 1.4; margin-bottom: 10px;">
                                    C:\\Users\\%USERNAME%\\AppData\\Roaming\\Bayan POS\\backups
                                </div>
                            </div>
                            <button type="button" onclick="navigator.clipboard.writeText('C:\\\\Users\\\\' + (window.process ? '' : '') + 'AppData\\\\Roaming\\\\Bayan POS\\\\backups'); if(typeof showToast==='function') showToast('📋 تم نسخ مسار مجلد النظام للحافظة!', 'success');" style="width: 100%; height: 34px; background: #ffffff; color: #1e293b; border: 1.5px solid #cbd5e1; border-radius: 8px; font-weight: 800; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: 0.2s;" onmouseover="this.style.background='#e2e8f0';" onmouseout="this.style.background='#ffffff';">
                                📋 نسخ مسار النظام
                            </button>
                        </div>

                        <!-- بطاقة 2: المتصفح (Downloads) -->
                        <div style="background: #eff6ff; padding: 14px; border-radius: 12px; border: 1.5px solid #bfdbfe; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                            <div>
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                    <div style="font-size: 0.88rem; color: #1e40af; font-weight: 900; display: flex; align-items: center; gap: 6px;">
                                        <span>🌐</span> عند العمل عبر المتصفح (Browser):
                                    </div>
                                    <span style="font-size: 0.72rem; background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; padding: 2px 8px; border-radius: 6px; font-weight: 800;">تنزيل فوري</span>
                                </div>
                                <div style="font-size: 0.78rem; color: #475569; font-weight: 700; margin-bottom: 8px; line-height: 1.4;">
                                    تُنزل ملفات النسخ فوراً في مجلد التنزيلات بجهازك:
                                </div>
                                <div style="background: #ffffff; padding: 8px 10px; border-radius: 8px; border: 1px solid #cbd5e1; direction: ltr; text-align: left; font-family: monospace; font-size: 0.82rem; font-weight: 800; color: #0f172a; word-break: break-all; white-space: normal; line-height: 1.4; margin-bottom: 10px;">
                                    C:\\Users\\%USERNAME%\\Downloads
                                </div>
                            </div>
                            <button type="button" onclick="navigator.clipboard.writeText('C:\\\\Users\\\\' + (window.process ? '' : '') + 'Downloads'); if(typeof showToast==='function') showToast('📋 تم نسخ مسار التنزيلات للحافظة!', 'success');" style="width: 100%; height: 34px; background: #ffffff; color: #1e40af; border: 1.5px solid #bfdbfe; border-radius: 8px; font-weight: 800; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: 0.2s;" onmouseover="this.style.background='#dbeafe';" onmouseout="this.style.background='#ffffff';">
                                📋 نسخ مسار التنزيلات
                            </button>
                        </div>

                    </div>

                    <div style="text-align: center; color: #64748b; font-size: 0.78rem; font-weight: 700;">
                        💡 يُنصح بنسخ ملفات النسخ الاحتياطية دورياً إلى فلاش ميموري (USB) لحماية إضافية للبيانات.
                    </div>
                </div>
            `,
            confirmText: 'إغلاق ✖️'
        });
    } else {
        alert("📂 مكان النسخ الاحتياطية:\nفي المتصفح: مجلد Downloads بجهازك.\nفي تطبيق الديسكتوب: AppData\\Roaming\\Bayan POS\\backups");
    }
    return false;
};

window.executeAutoBackupToFile = async function(silent = false, isManual = false) {
    if (!silent) {
        window.showBackupProgressOverlay();
    }
    
    // جلب كافة الجداول الإضافية من IndexedDB (سجلات الخزينة والتدقيق)
    let treasuryData = [];
    let auditLogData = [];
    try {
        if (db && db.treasuryAudit) treasuryData = await db.treasuryAudit.toArray();
        if (db && db.auditLogs) auditLogData = await db.auditLogs.toArray();
    } catch(e) {
        console.warn("Error reading treasuryAudit or auditLogs for backup:", e);
    }
    if (treasuryData.length === 0 && typeof treasuryAuditRecords !== 'undefined' && Array.isArray(treasuryAuditRecords)) {
        treasuryData = treasuryAuditRecords;
    }
    if (auditLogData.length === 0 && typeof auditLogs !== 'undefined' && Array.isArray(auditLogs)) {
        auditLogData = auditLogs;
    }

    // 🔒 تأمين وتشفير رموز الـ PIN للمستخدمين في ملف النسخة الاحتياطية لمنع كشفها
    const securedUsers = (users || []).map(u => {
        if (!u) return u;
        const copy = { ...u };
        if (copy.pin != null && copy.pin !== '' && typeof window.BayanSecurity !== 'undefined' && typeof window.BayanSecurity.encryptPin === 'function') {
            copy.pin = window.BayanSecurity.encryptPin(copy.pin);
        }
        return copy;
    });

    const data = {
        version: "2.0",
        backupDate: new Date().toISOString(),
        products: productsDB || [],
        transactions: transactions || [],
        settings: JSON.parse(getStore('pos_settings') || '{}'),
        users: securedUsers,
        accounts: accounts || [],
        trash: trashBin || [],
        treasuryAudit: treasuryData,
        auditLogs: auditLogData,
        warehouses: (typeof warehouses !== 'undefined' && warehouses.length > 0) ? warehouses : JSON.parse(getStore('pos_warehouses') || '[]'),
        inventoryCategories: (window.inventoryCategories && window.inventoryCategories.length > 0) ? window.inventoryCategories : JSON.parse(getStore('bayan_inventory_categories') || '[]'),
        barcodeLabelSettings: JSON.parse(getStore('bayan_barcode_label_settings') || '{}'),
        discountReasons: (typeof discountReasons !== 'undefined') ? discountReasons : JSON.parse(getStore('pos_discount_reasons') || '[]'),
        taxReasons: (typeof taxReasons !== 'undefined') ? taxReasons : JSON.parse(getStore('pos_tax_reasons') || '[]'),
        purchaseDiscountReasons: (typeof purchaseDiscountReasons !== 'undefined') ? purchaseDiscountReasons : JSON.parse(getStore('pos_p_discount_reasons') || '[]'),
        purchaseTaxReasons: (typeof purchaseTaxReasons !== 'undefined') ? purchaseTaxReasons : JSON.parse(getStore('pos_p_tax_reasons') || '[]')
    };
    
    setStore('pos_last_backup_time', Date.now());
    
    let success = false;
    let savedFilePath = '';
    let backupDirDisplay = '';
    let finalFileName = '';

    // 1. المحاولة الأولى: الحفظ المباشر عبر IPC في بيئة ديسكتوب (Electron)
    let ipc = null;
    try {
        if (typeof window !== 'undefined' && window.require) {
            ipc = window.require('electron').ipcRenderer;
        } else if (typeof require !== 'undefined') {
            ipc = require('electron').ipcRenderer;
        }
    } catch (e) {}

    if (ipc && typeof ipc.invoke === 'function') {
        try {
            const dataStr = JSON.stringify(data, null, 2);
            const saveRes = await ipc.invoke('save-backup-data', { isManual, dataStr });
            if (saveRes && saveRes.success) {
                savedFilePath = saveRes.filePath;
                backupDirDisplay = saveRes.backupDir;
                finalFileName = saveRes.fileName;
                success = true;
                console.log("Backup successfully saved via Electron IPC:", savedFilePath);

                // إدارة تدوير النسخ
                try {
                    const settings = JSON.parse(getStore('pos_settings') || '{}');
                    const maxBackups = parseInt(settings.maxBackupFiles) || 100;
                    await ipc.invoke('rotate-backups', maxBackups);
                } catch(rotErr) {}
            }
        } catch (ipcErr) {
            console.warn("Electron IPC save-backup-data failed, trying node/browser fallback:", ipcErr);
        }
    }

    // 2. المحاولة الثانية: عبر Node.js fs مباشرة إن كانت متاحة
    if (!success) {
        try {
            const fs = (typeof window !== 'undefined' && window.require) ? window.require('fs') : (typeof require !== 'undefined' ? require('fs') : null);
            const path = (typeof window !== 'undefined' && window.require) ? window.require('path') : (typeof require !== 'undefined' ? require('path') : null);
            const os = (typeof window !== 'undefined' && window.require) ? window.require('os') : (typeof require !== 'undefined' ? require('os') : null);

            if (fs && path && os) {
                let backupDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Bayan POS', 'backups');
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }
                const pad = (n) => String(n).padStart(2, '0');
                const d = new Date();
                const timestamp = `${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}__${pad(d.getHours())}_${pad(d.getMinutes())}`;
                const prefix = isManual ? 'backup_pos_manual_' : 'backup_pos_auto_';
                finalFileName = `${prefix}${timestamp}.json`;
                savedFilePath = path.join(backupDir, finalFileName);
                backupDirDisplay = backupDir;

                fs.writeFileSync(savedFilePath, JSON.stringify(data, null, 2), 'utf8');
                console.log("Backup successfully saved to local fs path:", savedFilePath);
                success = true;
            }
        } catch (fsErr) {
            console.warn("Node fs fallback failed:", fsErr);
        }
    }

    // 3. المحاولة الثالثة: عبر تنزيل ملف المتصفح (Web Browser Download)
    if (!success) {
        const settings = JSON.parse(getStore('pos_settings') || '{}');
        const canDownloadInBrowser = isManual || (settings.autoBackup === true && !silent);

        if (canDownloadInBrowser) {
            try {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const d = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const timestamp = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
                finalFileName = `backup_pos_${isManual ? 'manual' : 'auto'}_${timestamp}.json`;
                a.download = finalFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                success = true;
                backupDirDisplay = 'مجلد التنزيلات (Downloads)';
                savedFilePath = `Downloads/${finalFileName}`;
                console.log("Backup file downloaded via browser to Downloads folder:", finalFileName);
            } catch (downloadErr) {
                console.error("Browser download backup failed:", downloadErr);
            }
        }
    }
    
    if (!silent) {
        await new Promise(resolve => setTimeout(resolve, 800));
        window.hideBackupProgressOverlay();

        if (success) {
            const isDownloads = backupDirDisplay.includes('Downloads') || backupDirDisplay.includes('التنزيلات');
            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'success',
                    titleText: '✅ تم حفظ النسخة الاحتياطية بنجاح',
                    msg: `
                        <div style="text-align: right; direction: rtl; font-family: 'Cairo', sans-serif;">
                            <p style="margin-bottom: 12px; font-weight: 800; color: #1e293b;">تم تأمين وحفظ كامل بيانات النظام (الأصناف، الفواتير، الحسابات، والخزينة) بنجاح على جهازك.</p>
                            
                            <div style="background: ${isDownloads ? '#eff6ff' : '#f1f5f9'}; padding: 12px; border-radius: 12px; border: 1.5px solid ${isDownloads ? '#93c5fd' : '#cbd5e1'}; margin-bottom: 15px;">
                                <div style="font-size: 0.85rem; color: ${isDownloads ? '#1d4ed8' : '#64748b'}; font-weight: 800; margin-bottom: 4px;">📍 مكان وجود النسخة على جهازك:</div>
                                <div style="font-size: 0.95rem; font-weight: 900; color: ${isDownloads ? '#1e3a8a' : '#0f172a'}; margin-bottom: 4px;">
                                    ${isDownloads ? '📁 مجلد التنزيلات (Downloads)' : backupDirDisplay}
                                </div>
                                <div style="font-size: 0.8rem; font-weight: 800; color: #475569; direction: ltr; text-align: left; font-family: monospace; word-break: break-all;">
                                    📄 ${finalFileName || 'backup_pos.json'}
                                </div>
                            </div>

                            <button onclick="window.openBackupFolder()" style="width: 100%; height: 45px; background: #2563eb; color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                                📂 فتح مجلد النسخ الاحتياطية الآن
                            </button>
                        </div>
                    `,
                    confirmText: 'تم ✖️'
                });
            } else {
                alert(`✅ تم حفظ النسخة الاحتياطية بنجاح في: ${backupDirDisplay}`);
            }
        }
    }
    
    return success;
};

// فحص وتكرار النسخ الاحتياطي الدوري في الخلفية (كل ساعة، ساعتين، 12، 24)
window.checkAndRunPeriodicBackup = function() {
    const settings = JSON.parse(getStore('pos_settings') || '{}');
    const interval = settings.autoBackupInterval;
    
    // إذا كان الخيار غير محدد أو كان "close" (فقط عند الإغلاق/الخروج)، لا نقوم بنسخ دوري أثناء ساعات العمل
    if (!interval || interval === 'close') return;
    
    const intervalHours = parseFloat(interval);
    if (isNaN(intervalHours) || intervalHours <= 0) return;
    
    const lastBackup = parseFloat(getStore('pos_last_backup_time') || '0');
    const now = Date.now();
    const elapsedMs = now - lastBackup;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    if (elapsedMs >= intervalMs) {
        console.log(`⏰ [AutoBackup] تم استحقاق النسخ الدوري: كل (${intervalHours}) ساعة. (انقضى: ${(elapsedMs/3600000).toFixed(2)} ساعة).`);
        window.executeAutoBackupToFile(true);
    }
};

// تشغيل الفحص الدوري كل دقيقتين بدقة عالية
setInterval(window.checkAndRunPeriodicBackup, 2 * 60 * 1000);
setTimeout(window.checkAndRunPeriodicBackup, 6000); // تشغيل أولي بعد 6 ثواني من الإقلاع

// 🔒 دالة فحص وجود بيانات غير محفوظة في كافة التبويبات المفتوحة قبل الخروج
window.checkUnsavedDataInAllTabs = function() {
    if (typeof openTabs === 'undefined' || !Array.isArray(openTabs)) return null;

    // 1. حفظ حالة التبويب النشط حالياً على الشاشة أولاً
    if (typeof saveCurrentTabState === 'function') {
        saveCurrentTabState();
    }

    // 2. فحص كافة التبويبات المفتوحة
    for (const tab of openTabs) {
        const tabId = tab.id;
        const type = tab.type;
        const label = tab.label || tab.type;

        let hasData = false;
        let reason = '';

        // إذا كان التبويب هو الفعّال حالياً
        if (typeof activeTabId !== 'undefined' && activeTabId === tabId) {
            if (type === 'sales') {
                if (typeof cart !== 'undefined' && cart.length > 0) {
                    hasData = true; reason = `سلة المبيعات تحتوي على (${cart.length}) صنف غير محفوظ`;
                } else {
                    const cInput = document.getElementById('customerName');
                    if (cInput && cInput.value.trim() !== '') { hasData = true; reason = 'تم إدخال اسم عميل في فاتورة البيع ولم تحفظ'; }
                }
            } else if (type === 'purchase') {
                if (typeof purchaseCart !== 'undefined' && purchaseCart.length > 0) {
                    hasData = true; reason = `سلة المشتريات تحتوي على (${purchaseCart.length}) صنف غير محفوظ`;
                } else {
                    const sInput = document.getElementById('supplierName');
                    if (sInput && sInput.value.trim() !== '') { hasData = true; reason = 'تم إدخال اسم مورد في فاتورة الشراء ولم تحفظ'; }
                }
            } else if (type === 'sales-return') {
                if (typeof returnCart !== 'undefined' && returnCart.length > 0) {
                    hasData = true; reason = `سلة مرتجع المبيعات تحتوي على (${returnCart.length}) صنف غير محفوظ`;
                }
            } else if (type === 'purchase-return') {
                if (typeof purReturnCart !== 'undefined' && purReturnCart.length > 0) {
                    hasData = true; reason = `سلة مرتجع المشتريات تحتوي على (${purReturnCart.length}) صنف غير محفوظ`;
                }
            } else if (type === 'adjustment') {
                if (typeof adjCart !== 'undefined' && adjCart.length > 0) {
                    hasData = true; reason = `سلة تسوية المخزن تحتوي على (${adjCart.length}) صنف غير محفوظ`;
                }
            } else if (type === 'receipt') {
                const am = parseFloat(document.getElementById('receiptAmount')?.value || 0);
                const cName = document.getElementById('receiptCustomer')?.value.trim() || '';
                if (am > 0 || cName !== '') { hasData = true; reason = 'توجد بيانات مبلغ أو عميل غير محفوظة في سند القبض'; }
            } else if (type === 'disbursement') {
                const am = parseFloat(document.getElementById('disburseAmount')?.value || 0);
                const pName = document.getElementById('disbursePayee')?.value.trim() || '';
                if (am > 0 || pName !== '') { hasData = true; reason = 'توجد بيانات مبلغ أو مستفيد غير محفوظة في سند الصرف'; }
            }
        } 
        
        // إذا كان التبويب محفوطاً في التبويبات الأخرى (Background Tabs)
        if (!hasData && typeof tabStates !== 'undefined' && tabStates[tabId]) {
            const state = tabStates[tabId];
            if (type === 'sales' && state.cart && state.cart.length > 0) {
                hasData = true; reason = `سلة المبيعات تحتوي على (${state.cart.length}) صنف غير محفوظ`;
            } else if (type === 'purchase' && state.purchaseCart && state.purchaseCart.length > 0) {
                hasData = true; reason = `سلة المشتريات تحتوي على (${state.purchaseCart.length}) صنف غير محفوظ`;
            } else if (type === 'sales-return' && state.returnCart && state.returnCart.length > 0) {
                hasData = true; reason = 'توجد أصناف غير محفوظة في مرتجع المبيعات';
            } else if (type === 'purchase-return' && state.purReturnCart && state.purReturnCart.length > 0) {
                hasData = true; reason = 'توجد أصناف غير محفوظة في مرتجع المشتريات';
            } else if (type === 'adjustment' && state.adjCart && state.adjCart.length > 0) {
                hasData = true; reason = 'توجد أصناف غير محفوظة في تسوية المخزن';
            } else if ((type === 'receipt' || type === 'disbursement') && (parseFloat(state.amount) > 0 || (state.partnerName && state.partnerName.trim() !== ''))) {
                hasData = true; reason = 'توجد بيانات غير محفوظة في السند';
            }
        }

        if (hasData) {
            return {
                hasUnsaved: true,
                tabId: tabId,
                tabType: type,
                tabLabel: label,
                reason: reason
            };
        }
    }

    return null;
};

// تسجيل مستمع حدث الإغلاق من عملية Electron الرئيسية
try {
    const electron = window.require ? window.require('electron') : (typeof require !== 'undefined' ? require('electron') : null);
    if (electron && electron.ipcRenderer) {
        electron.ipcRenderer.on('trigger-backup-before-quit', async () => {
            // 1. فحص هل هناك أي بيانات غير محفوظة في التبويبات المفتوحة قبل أي شيء
            const unsaved = window.checkUnsavedDataInAllTabs();

            if (unsaved && unsaved.hasUnsaved) {
                // إلغاء الإغلاق فوراً
                if (electron && electron.ipcRenderer) electron.ipcRenderer.send('cancel-quit');

                // التوجه والرجوع التلقائي للتبويب المفتوح الذي يحتوي على البيانات غير المحفوظة
                if (typeof switchSection === 'function') {
                    switchSection(unsaved.tabType, true, unsaved.tabId);
                }

                // إظهار تنبيه حاسم ومحذر للمستخدم
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        titleText: '⚠️ تنبيه أمان: بيانات غير محفوظة!',
                        msg: `تنبيه: لا يمكن خروج البرنامج لأن هناك بيانات غير محفوظة في (${unsaved.tabLabel}).\n\n📌 السبب: ${unsaved.reason}.\n\nيرجى حفظ الفاتورة/المستند أولاً أو إفراغ البيانات قبل إغلاق البرنامج.`,
                        type: 'warning'
                    });
                } else {
                    alert(`⚠️ تنبيه أمان: توجد بيانات غير محفوظة في (${unsaved.tabLabel}).\n${unsaved.reason}.\n\nيرجى حفظ البيانات أو إلغاؤها أولاً قبل الخروج.`);
                }
                return;
            }

            // 2. إذا كانت كافة البيانات محفوظة ولا توجد أصناف معلقة، نقوم بالنسخ الاحتياطي إذا كان مفعلاً صراحة
            const settings = JSON.parse(getStore('pos_settings') || '{}');
            if (settings.autoBackup === true) {
                await window.executeAutoBackupToFile(false);
            }

            // إكمال عملية الخروج بأمان بعد إنهاء النسخ الاحتياطي
            if (electron && electron.ipcRenderer) electron.ipcRenderer.send('proceed-quit');
        });
    }
} catch (e) {
    console.log("Not running in Electron environment or ipcRenderer unavailable.");
}