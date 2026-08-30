// ============================================================
//  النسخ الاحتياطي التلقائي واستعادة البيانات (Backup & Restore Engine)
// ============================================================

async function resetAllData() {
    const confirm1 = confirm("⚠️ تنبيه خطير جداً:\nسيتم حذف كافة البيانات (المنتجات، الحركات، الحسابات، الإعدادات) بشكل نهائي.\nهل أنت متأكد؟");
    if (confirm1) {
        const confirm2 = await showCustomPrompt("⚠️ لتأكيد عملية المسح الشامل، يرجى كتابة (مسح الكل) في المربع أدناه:");
        if (confirm2 === "مسح الكل") {
            clearStore();
            alert("✅ تم مسح كافة البيانات بنجاح. سيتم الآن إعادة تشغيل التطبيق.");
            location.reload();
        } else {
            alert("❌ لم يتم كتابة عبارة التأكيد بشكل صحيح. تم إلغاء الأمر.");
        }
    }
}

async function backupData() {
    await window.executeAutoBackupToFile(false, true);
}

function restoreData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // تأمين العملية باستخدام المعاملات (Transaction) لحماية البيانات من الضياع
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
                if (data.users && data.users.length > 0) await db.users.bulkPut(data.users);
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
                    msg: 'تمت استعادة كافة المنتجات، الفواتير، الحسابات، سجلات الخزينة، والمخازن بنجاح!\nسيتم إعادة تشغيل التطبيق لتطبيق البيانات فوراً.',
                    confirmText: 'إعادة التشغيل الآن 🔄',
                    onConfirm: () => location.reload()
                });
                setTimeout(() => location.reload(), 2500);
            } else {
                alert("✅ تم استعادة النسخة الاحتياطية بنجاح! سيتم إعادة تحميل الصفحة.");
                location.reload();
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
            -webkit-
            z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: center;
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

window.openBackupFolder = function() {
    try {
        const { shell } = require('electron');
        const path = require('path');
        const os = require('os');
        const defaultPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Bayan POS', 'backups');
        if (shell) shell.openPath(defaultPath);
        else alert(`📍 مسار مجلد النسخ الاحتياطية هو:\n${defaultPath}`);
    } catch(e) {
        console.log("Error opening backup folder:", e);
    }
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

    const data = {
        version: "2.0",
        backupDate: new Date().toISOString(),
        products: productsDB || [],
        transactions: transactions || [],
        settings: JSON.parse(getStore('pos_settings') || '{}'),
        users: users || [],
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

    // محاولة الحفظ المباشر في مجلد التطبيق الموحد (AppData/Roaming/Bayan POS/backups)
    try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const { ipcRenderer } = require('electron');
        
        let backupDir = '';
        if (ipcRenderer) {
            try {
                backupDir = await ipcRenderer.invoke('get-backup-dir');
            } catch(e) {}
        }
        if (!backupDir) {
            backupDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Bayan POS', 'backups');
        }
        backupDirDisplay = backupDir;
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const pad = (n) => String(n).padStart(2, '0');
        const d = new Date();
        const timestamp = `${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}__${pad(d.getHours())}_${pad(d.getMinutes())}`;
        const prefix = isManual ? 'backup_pos_manual_' : 'backup_pos_auto_';
        const fileName = `${prefix}${timestamp}.json`;
        savedFilePath = path.join(backupDir, fileName);
        
        fs.writeFileSync(savedFilePath, JSON.stringify(data, null, 2), 'utf8');
        console.log("Backup successfully saved to local path:", savedFilePath);
        success = true;

        // 🧹 إدارة تدوير النسخ الاحتياطية الاحتفاظ بـ 100 نسخة فقط (أو القيمة المخزنة في الإعدادات)
        try {
            const settings = JSON.parse(getStore('pos_settings') || '{}');
            const maxBackups = parseInt(settings.maxBackupFiles) || 100;
            const { ipcRenderer } = require('electron');
            if (ipcRenderer) {
                await ipcRenderer.invoke('rotate-backups', maxBackups);
            }
        } catch(rotErr) {
            console.warn("Backup rotation failed:", rotErr);
        }

    } catch (e) {
        console.log("Fallback to browser-style download backup.", e);
        try {
            const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_pos_${isManual ? 'manual' : 'auto'}_${new Date().toLocaleDateString('en-CA')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            success = true;
        } catch (downloadErr) {
            console.error("Browser download backup failed:", downloadErr);
        }
    }
    
    if (!silent) {
        await new Promise(resolve => setTimeout(resolve, 800));
        window.hideBackupProgressOverlay();

        if (success) {
            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'success',
                    titleText: '✅ تم إنشاء النسخة الاحتياطية بنجاح',
                    msg: `
                        <div style="text-align: right; direction: rtl; font-family: 'Cairo', sans-serif;">
                            <p style="margin-bottom: 12px; font-weight: 800; color: #1e293b;">تم حفظ وتأمين كافة بيانات النظام (المنتجات، الحركات، الخزينة، والمخازن) بأمان.</p>
                            <div style="background: #f1f5f9; padding: 12px; border-radius: 12px; border: 1px solid #cbd5e1; margin-bottom: 15px;">
                                <div style="font-size: 0.85rem; color: #64748b; font-weight: 800; margin-bottom: 4px;">📍 مكان الحفظ:</div>
                                <div style="font-size: 0.9rem; font-weight: 800; color: #0f172a; direction: ltr; text-align: left; font-family: monospace; word-break: break-all;">${backupDirDisplay || 'bayan_backups'}</div>
                            </div>
                            <button onclick="window.openBackupFolder()" style="width: 100%; height: 45px; background: #2563eb; color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                                📂 فتح مجلد النسخ الاحتياطية
                            </button>
                        </div>
                    `,
                    confirmText: 'إغلاق ✖️'
                });
            } else {
                alert(`✅ تم إنشاء النسخة الاحتياطية بنجاح في: ${savedFilePath || backupDirDisplay}`);
            }
        }
    }
    
    return success;
};

// فحص النسخ الاحتياطي الدوري في الخلفية
window.checkAndRunPeriodicBackup = function() {
    const settings = JSON.parse(getStore('pos_settings') || '{}');
    if (!settings.autoBackup || !settings.autoBackupInterval || settings.autoBackupInterval === 'close') return;
    
    const intervalHours = parseFloat(settings.autoBackupInterval);
    if (isNaN(intervalHours)) return;
    
    const lastBackup = parseFloat(getStore('pos_last_backup_time') || '0');
    const now = Date.now();
    const elapsedMs = now - lastBackup;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    if (elapsedMs >= intervalMs) {
        console.log(`Periodic backup triggered: every ${intervalHours} hour(s).`);
        window.executeAutoBackupToFile(true);
    }
};

// تشغيل الفحص الدوري كل 5 دقائق
setInterval(window.checkAndRunPeriodicBackup, 5 * 60 * 1000);
setTimeout(window.checkAndRunPeriodicBackup, 8000); // تشغيل أولي بعد 8 ثواني من الإقلاع

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

            // 2. إذا كانت كافة البيانات محفوظة ولا توجد أصناف معلقة، نقوم بالنسخ الاحتياطي ثم الخروج
            const settings = JSON.parse(getStore('pos_settings') || '{}');
            if (settings.autoBackup !== false) { // مفعل تلقائياً كخيار أمان أقصى
                await window.executeAutoBackupToFile(false);
            }

            // إكمال عملية الخروج بأمان بعد إنهاء النسخ الاحتياطي
            if (electron && electron.ipcRenderer) electron.ipcRenderer.send('proceed-quit');
        });
    }
} catch (e) {
    console.log("Not running in Electron environment or ipcRenderer unavailable.");
}