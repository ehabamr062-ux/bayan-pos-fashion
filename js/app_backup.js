// ============================================================
//  النسخ الاحتياطي التلقائي واستعادة البيانات (Backup & Restore Engine)
// ============================================================



async function backupData() {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية تصدير النسخ الاحتياطية!", "error");
    }
    await window.executeAutoBackupToFile(false, true);
}

function restoreData(input, isEmergencyBypass = false) {
    if (!isEmergencyBypass && typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        if (input) input.value = '';
        return showToast("🚫 ليس لديك صلاحية استعادة النسخ الاحتياطية!", "error");
    }
    const file = input ? input.files[0] : null;
    if (!file) {
        if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
            window.resetLoginEmergencyRestoreCard();
        }
        return;
    }
    const reader = new FileReader();

    // 📊 متابعة تقدم قراءة الملفات الكبيرة لحظياً (حتى لو وصل حجم الملف لعشرات الميجابايت)
    reader.onprogress = function (e) {
        if (e.lengthComputable && e.total > 0) {
            const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
            const loadedMb = (e.loaded / (1024 * 1024)).toFixed(1);
            const totalMb = (e.total / (1024 * 1024)).toFixed(1);
            const titleEl = document.getElementById('loginRestoreTitle');
            const subEl = document.getElementById('loginRestoreSubtitle');
            if (titleEl) {
                titleEl.innerHTML = `<span style="color: #38bdf8;">جاري القراءة: ${percent}% (${loadedMb}/${totalMb} MB) ⏳</span>`;
            }
            if (subEl) {
                subEl.innerHTML = `ملف كبير (${totalMb} MB)، يرجى الانتظار لحين اكتمال المعالجة...`;
            }
        }
    };

    reader.onerror = function (err) {
        console.error("FileReader error:", err);
        if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
            window.resetLoginEmergencyRestoreCard();
        }
        alert("❌ تعذر قراءة الملف. قد يكون حجم الملف كبيراً جداً على ذاكرة المتصفح.");
        if (input) input.value = '';
    };

    reader.onload = async function (e) {
        await window.restoreDataFromContent(e.target.result, file ? file.name : '', isEmergencyBypass, input);
    };
    reader.readAsText(file);
}
window.restoreData = restoreData;

// =========================================================================
// 📥 المعالج المركزي لاستعادة البيانات من نص JSON (يدعم IPC والمتصفح ويوجه للـ Roaming تلقائياً)
// =========================================================================
window.restoreDataFromContent = async function (jsonContent, fileName = '', isEmergencyBypass = false, input = null) {
    const titleEl = document.getElementById('loginRestoreTitle');
    const subEl = document.getElementById('loginRestoreSubtitle');
    if (titleEl) {
        titleEl.innerHTML = `<span>جاري فحص وتجهيز البيانات... ⚙️</span>`;
    }
    if (subEl) {
        subEl.innerHTML = `جاري تحليل الجداول والتحقق من سلامة البيانات...`;
    }
    await new Promise(r => setTimeout(r, 60));

    try {
        let data;
        try {
            data = JSON.parse(jsonContent);
        } catch (parseErr) {
            console.error("JSON parse error:", parseErr);
            if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
                window.resetLoginEmergencyRestoreCard();
            }
            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'error',
                    titleText: '❌ خطأ في قراءة الملف',
                    msg: 'الملف المختار ليس ملف JSON صالحاً أو تالفاً بسبب انقطاع التصدير. يرجى اختيار ملف نسخة احتياطية سليم.'
                });
            } else {
                alert("❌ الملف المختار ليس ملف JSON صالحاً.");
            }
            if (input) input.value = '';
            return;
        }

        // 🛑 فحص التحقق من سلامة وصلاحية محتوى النسخة الاحتياطية قبل أي تعديل
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
                window.resetLoginEmergencyRestoreCard();
            }
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

        // 🛡️ تنظيف وتجهيز البيانات للتأكد من خلوها من أي عناصر تالفة أو null
        const cleanProducts = Array.isArray(data.products) ? data.products.filter(p => p && typeof p === 'object' && p.id != null) : [];
        const cleanTransactions = Array.isArray(data.transactions) ? data.transactions.filter(t => t && typeof t === 'object' && t.id != null) : [];
        const cleanAccounts = Array.isArray(data.accounts) ? data.accounts.filter(a => a && typeof a === 'object' && a.id != null) : [];
        const cleanTrash = Array.isArray(data.trash) ? data.trash.filter(t => t && typeof t === 'object') : [];
        const cleanTreasury = Array.isArray(data.treasuryAudit) ? data.treasuryAudit.filter(t => t && typeof t === 'object') : [];
        const cleanAuditLogs = Array.isArray(data.auditLogs) ? data.auditLogs.filter(l => l && typeof l === 'object') : [];
        const cleanWarehouses = Array.isArray(data.warehouses) ? data.warehouses.filter(w => w && typeof w === 'object') : [];
        const cleanWallpapers = Array.isArray(data.wallpapers) ? data.wallpapers.filter(w => w && typeof w === 'object') : [];

        const prodCount = cleanProducts.length;
        const txCount = cleanTransactions.length;
        const accCount = cleanAccounts.length;
        const hasSettings = data.settings && typeof data.settings === 'object';
        const hasUsers = Array.isArray(data.users) && data.users.length > 0;

        if (prodCount === 0 && txCount === 0 && accCount === 0 && !hasSettings && !hasUsers) {
            if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
                window.resetLoginEmergencyRestoreCard();
            }
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
            const titleEl = document.getElementById('loginRestoreTitle');
            const subEl = document.getElementById('loginRestoreSubtitle');
            const iconBox = document.getElementById('loginRestoreIconBox');
            if (titleEl) {
                titleEl.innerHTML = `<span style="color: #10b981; font-weight: bold;">جاري كتابة البيانات في قاعدة البيانات... 💾</span>`;
            }
            if (subEl) {
                subEl.innerHTML = `جاري استرجاع ${prodCount} صنف و ${txCount} حركة... يرجى الانتظار`;
            }
            if (iconBox) {
                iconBox.innerHTML = '⏳';
            }

            await new Promise(r => setTimeout(r, 60));

            try {
                let restoredUsers = [];
                if (hasUsers) {
                    restoredUsers = data.users.filter(u => u && typeof u === 'object').map(u => {
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
                }

                let shouldTouchUsers = false;
                if (restoredUsers.length > 0) {
                    shouldTouchUsers = true;
                } else {
                    let currentDbUsers = [];
                    try {
                        if (typeof db !== 'undefined' && db && db.users) {
                            currentDbUsers = await db.users.toArray();
                        }
                    } catch (e) {}

                    if (!currentDbUsers || currentDbUsers.length === 0) {
                        restoredUsers = [{
                            id: 1,
                            name: 'المدير',
                            role: 'admin',
                            pin: (typeof window.BayanSecurity !== 'undefined' && typeof window.BayanSecurity.encryptPin === 'function')
                                ? window.BayanSecurity.encryptPin('')
                                : '',
                            permissions: ['all']
                        }];
                        shouldTouchUsers = true;
                    } else {
                        shouldTouchUsers = false;
                        console.log("🛡️ تم الإبقاء على قائمة المستخدمين الحالية لعدم وجود مستخدمين بملف النسخة الاحتياطية.");
                    }
                }

                const tablesToTransact = [db.products, db.transactions, db.accounts, db.trash];
                if (shouldTouchUsers) tablesToTransact.push(db.users);
                if (db.treasuryAudit) tablesToTransact.push(db.treasuryAudit);
                if (db.auditLogs) tablesToTransact.push(db.auditLogs);
                if (db.warehouses) tablesToTransact.push(db.warehouses);
                if (db.wallpapers) tablesToTransact.push(db.wallpapers);

                await db.transaction('rw', tablesToTransact, async () => {
                    await db.products.clear();
                    await db.transactions.clear();
                    await db.accounts.clear();
                    await db.trash.clear();
                    if (shouldTouchUsers) {
                        await db.users.clear();
                    }

                    const CHUNK_SIZE = 50;
                    for (let i = 0; i < cleanProducts.length; i += CHUNK_SIZE) {
                        await db.products.bulkPut(cleanProducts.slice(i, i + CHUNK_SIZE));
                    }

                    for (let i = 0; i < cleanTransactions.length; i += 100) {
                        await db.transactions.bulkPut(cleanTransactions.slice(i, i + 100));
                    }

                    if (cleanAccounts.length > 0) await db.accounts.bulkPut(cleanAccounts);
                    if (cleanTrash.length > 0) await db.trash.bulkPut(cleanTrash);
                    if (shouldTouchUsers && restoredUsers.length > 0) {
                        await db.users.bulkPut(restoredUsers);
                    }

                    if (db.treasuryAudit) {
                        await db.treasuryAudit.clear();
                        if (cleanTreasury.length > 0) {
                            await db.treasuryAudit.bulkPut(cleanTreasury);
                        }
                    }
                    if (db.auditLogs) {
                        await db.auditLogs.clear();
                        if (cleanAuditLogs.length > 0) {
                            await db.auditLogs.bulkPut(cleanAuditLogs);
                        }
                    }

                    if (db.warehouses) {
                        await db.warehouses.clear();
                        if (cleanWarehouses.length > 0) {
                            await db.warehouses.bulkPut(cleanWarehouses);
                        }
                    }

                    if (db.wallpapers) {
                        await db.wallpapers.clear();
                        if (cleanWallpapers.length > 0) {
                            await db.wallpapers.bulkPut(cleanWallpapers);
                        }
                    }
                });

                if (data.settings && typeof data.settings === 'object') {
                    try {
                        const existingMain = (db && db.settings) ? (await db.settings.get('main') || {}) : {};
                        if (db && db.settings) {
                            await db.settings.put({ ...existingMain, ...data.settings, id: 'main' });
                        }
                    } catch (e) {}
                    setStore('pos_settings', JSON.stringify(data.settings));
                }

                if (data.warehouses && data.warehouses.length > 0) {
                    setStore('pos_warehouses', JSON.stringify(data.warehouses));
                }
                if (data.inventoryCategories && data.inventoryCategories.length > 0) {
                    setStore('bayan_inventory_categories', JSON.stringify(data.inventoryCategories));
                }
                if (data.barcodeLabelSettings && Object.keys(data.barcodeLabelSettings).length > 0) {
                    setStore('bayan_barcode_label_settings', JSON.stringify(data.barcodeLabelSettings));
                }
                if (data.barcodeCenterSettings && Object.keys(data.barcodeCenterSettings).length > 0) {
                    setStore('bayan_barcode_center_settings', JSON.stringify(data.barcodeCenterSettings));
                }
                if (data.paymentMethods && Array.isArray(data.paymentMethods) && data.paymentMethods.length > 0) {
                    setStore('bayan_payment_methods', JSON.stringify(data.paymentMethods));
                }
                if (data.globalUnits && Array.isArray(data.globalUnits) && data.globalUnits.length > 0) {
                    setStore('bayan_global_units', JSON.stringify(data.globalUnits));
                }

                if (data.businessLogo) {
                    setStore('bayan_business_logo', data.businessLogo);
                }
                if (data.userConfirmedCustomLogo) {
                    setStore('bayan_user_confirmed_custom_logo', data.userConfirmedCustomLogo);
                }
                if (data.theme) {
                    setStore('pos_theme', data.theme);
                }
                if (data.wallpaper) {
                    setStore('bayan_wallpaper', data.wallpaper);
                }
                if (data.wallpaperType) {
                    setStore('bayan_wallpaper_type', data.wallpaperType);
                }
                if (data.savedWallpaper) {
                    setStore('bayan_saved_wallpaper', data.savedWallpaper);
                }

                if (data.printSettings && Object.keys(data.printSettings).length > 0) {
                    setStore('bayan_print_settings', JSON.stringify(data.printSettings));
                }
                if (data.printStyle) {
                    setStore('bayan_print_style', data.printStyle);
                }
                if (data.printTemplateChoice && Object.keys(data.printTemplateChoice).length > 0) {
                    setStore('bayan_print_template_choice', JSON.stringify(data.printTemplateChoice));
                }
                if (data.userTemplates && Array.isArray(data.userTemplates) && data.userTemplates.length > 0) {
                    setStore('bayan_user_templates', JSON.stringify(data.userTemplates));
                }
                if (data.autoPrintEnabled !== undefined && data.autoPrintEnabled !== null) {
                    setStore('pos_auto_print_enabled', String(data.autoPrintEnabled));
                }

                if (data.treasuryNotes) {
                    setStore('bayan_treasury_notes', data.treasuryNotes);
                }
                if (data.treasuryNotesConfig) {
                    if (data.treasuryNotesConfig.borderColor) setStore('tr_notes_border_color', data.treasuryNotesConfig.borderColor);
                    if (data.treasuryNotesConfig.customTitle) setStore('tr_notes_custom_title', data.treasuryNotesConfig.customTitle);
                    if (data.treasuryNotesConfig.saveSystem) setStore('tr_notes_save_system', data.treasuryNotesConfig.saveSystem);
                }
                if (data.receiptLog && Array.isArray(data.receiptLog) && data.receiptLog.length > 0) {
                    setStore('bayan_receipt_log', JSON.stringify(data.receiptLog));
                }
                if (data.calcHistory && Array.isArray(data.calcHistory) && data.calcHistory.length > 0) {
                    setStore('bayan_calc_history', JSON.stringify(data.calcHistory));
                }

                if (data.tableColumnsSettings) {
                    if (data.tableColumnsSettings.wrCols) setStore('wrColSettings', JSON.stringify(data.tableColumnsSettings.wrCols));
                    if (data.tableColumnsSettings.invCols) setStore('pos_inv_cols_visible', JSON.stringify(data.tableColumnsSettings.invCols));
                    if (data.tableColumnsSettings.invColsLegacy) setStore('pos_inv_cols', JSON.stringify(data.tableColumnsSettings.invColsLegacy));
                    if (data.tableColumnsSettings.histCols) setStore('pos_hist_cols', JSON.stringify(data.tableColumnsSettings.histCols));
                    if (data.tableColumnsSettings.accCols) setStore('pos_acc_cols', JSON.stringify(data.tableColumnsSettings.accCols));
                    if (data.tableColumnsSettings.accColsOrder) setStore('pos_acc_cols_order_v2', JSON.stringify(data.tableColumnsSettings.accColsOrder));
                    if (data.tableColumnsSettings.anCols) setStore('pos_an_cols', JSON.stringify(data.tableColumnsSettings.anCols));
                    if (data.tableColumnsSettings.stmtCols) setStore('pos_stmt_cols', JSON.stringify(data.tableColumnsSettings.stmtCols));
                    if (data.tableColumnsSettings.inquiryVariantsCols) setStore('pos_inquiry_variants_cols', JSON.stringify(data.tableColumnsSettings.inquiryVariantsCols));
                    if (data.tableColumnsSettings.transferCols) setStore('transferColSettings', JSON.stringify(data.tableColumnsSettings.transferCols));
                    if (data.tableColumnsSettings.priceAdjCols) setStore('priceAdjHiddenCols', JSON.stringify(data.tableColumnsSettings.priceAdjCols));
                    if (data.tableColumnsSettings.priceAdjColsAlt) setStore('bayan_adj_hidden_columns', JSON.stringify(data.tableColumnsSettings.priceAdjColsAlt));
                }

                if (data.viewPreferences) {
                    if (data.viewPreferences.variantViewMode) setStore('bayan_variant_view_mode', data.viewPreferences.variantViewMode);
                    if (data.viewPreferences.variantViewModePinned) setStore('bayan_variant_view_mode_pinned', data.viewPreferences.variantViewModePinned);
                    if (data.viewPreferences.inquiryViewMode) setStore('pos_inquiry_view_mode', data.viewPreferences.inquiryViewMode);
                    if (data.viewPreferences.showQuickItems !== undefined) setStore('showQuickItems', String(data.viewPreferences.showQuickItems));
                    if (data.viewPreferences.pinnedPaymentMethod) setStore('pinned_payment_method', data.viewPreferences.pinnedPaymentMethod);
                    if (data.viewPreferences.pinnedPriceLevel) {
                        setStore('pos_pinned_price_level', data.viewPreferences.pinnedPriceLevel);
                        setStore('pos_price_level_pinned', data.viewPreferences.pinnedPriceLevel);
                    }
                }

                if (data.discountReasons) setStore('pos_discount_reasons', JSON.stringify(data.discountReasons));
                if (data.taxReasons) setStore('pos_tax_reasons', JSON.stringify(data.taxReasons));
                if (data.purchaseDiscountReasons) setStore('pos_p_discount_reasons', JSON.stringify(data.purchaseDiscountReasons));
                if (data.purchaseTaxReasons) setStore('pos_p_tax_reasons', JSON.stringify(data.purchaseTaxReasons));
                if (data.drawerClosures && Array.isArray(data.drawerClosures) && data.drawerClosures.length > 0) {
                    try {
                        localStorage.setItem('bayan_drawer_closures', JSON.stringify(data.drawerClosures));
                        setStore('bayan_drawer_closures', JSON.stringify(data.drawerClosures));
                    } catch (e) {}
                }

                if (titleEl) {
                    titleEl.innerHTML = `<span style="color: #10b981; font-weight: bold;">✅ اكتملت الاستعادة بنجاح!</span>`;
                }
                if (subEl) {
                    subEl.innerHTML = `جاري إعادة تشغيل النظام لتطبيق البيانات...`;
                }

                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'success',
                        titleText: '✅ تم استعادة النسخة الاحتياطية بنجاح',
                        msg: `تمت استعادة كافة البيانات بنجاح!\n• عدد الأصناف: ${prodCount}\n• عدد الفواتير والحركات: ${txCount}\n• عدد الحسابات: ${accCount}${shouldTouchUsers ? `\n• عدد المستخدمين: ${restoredUsers.length}` : '\n• المستخدمون: تم الحفاظ على المستخدمين الحاليين'}\n\nسيتم إعادة تشغيل التطبيق لتطبيق البيانات وتحديث النظام فوراً.`,
                        confirmText: 'إعادة التشغيل الآن 🔄',
                        onConfirm: () => location.reload()
                    });
                    setTimeout(() => location.reload(), 2200);
                } else {
                    alert("✅ تم استعادة النسخة الاحتياطية بنجاح! سيتم إعادة تحميل الصفحة.");
                    location.reload();
                }
            } catch (err) {
                console.error("Critical error in executeRestore:", err);
                if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
                    window.resetLoginEmergencyRestoreCard();
                }
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'error',
                        titleText: '❌ فشل استعادة النسخة الاحتياطية',
                        msg: `حدث خطأ غير متوقع أثناء كتابة البيانات:\n${err.message || err}\n\nتم إلغاء العملية لحماية بياناتك.`
                    });
                } else {
                    alert("❌ فشل استعادة النسخة الاحتياطية: " + (err.message || err));
                }
            }
        };

        // نافذة تأكيد قبل الاسترجاع مع كشف محتويات النسخة
        const summaryHtml = `هل أنت متأكد من رغبتك في استعادة هذه النسخة الاحتياطية؟<br><br>` +
            `<div style="text-align: right; background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.95rem; line-height: 1.8;">` +
            `📦 <b>عدد الأصناف:</b> ${prodCount} صنف<br>` +
            `🧾 <b>عدد الفواتير والحركات:</b> ${txCount} حركة<br>` +
            `👥 <b>عدد الحسابات والعملاء:</b> ${accCount} حساب<br>` +
            (hasUsers 
                ? `👤 <b>عدد المستخدمين والموظفين:</b> ${data.users.length} مستخدم<br>` 
                : `<span style="color: #0284c7; font-size: 0.88rem;">🛡️ سيتم الاحتفاظ بحسابات المستخدمين الحالية بالنظام</span><br>`) +
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
                onCancel: () => {
                    if (input) input.value = '';
                    if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
                        window.resetLoginEmergencyRestoreCard();
                    }
                }
            });
        } else {
            if (confirm(`هل أنت متأكد من استعادة النسخة الاحتياطية؟\nالأصناف: ${prodCount}\nالفواتير: ${txCount}\nالحسابات: ${accCount}${hasUsers ? `\nالمستخدمين: ${data.users.length}` : ''}`)) {
                executeRestore();
            } else {
                if (input) input.value = '';
                if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
                    window.resetLoginEmergencyRestoreCard();
                }
            }
        }
    } catch (err) {
        console.error("Failed to restore backup:", err);
        if (typeof window.resetLoginEmergencyRestoreCard === 'function') {
            window.resetLoginEmergencyRestoreCard();
        }
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

// 📂 استعادة النسخة من الإعدادات مع التوجيه التلقائي لمجلد النسخ الاحتياطية في Roaming
window.triggerAppRestore = async function() {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية استعادة النسخ الاحتياطية!", "error");
    }

    let ipc = null;
    try {
        if (typeof window !== 'undefined' && window.require) {
            ipc = window.require('electron').ipcRenderer;
        } else if (typeof require !== 'undefined') {
            ipc = require('electron').ipcRenderer;
        }
    } catch(e) {}

    if (ipc) {
        try {
            const res = await ipc.invoke('select-backup-file');
            if (!res || res.canceled) return;
            if (res.error) {
                return alert("❌ خطأ في فتح الملف: " + res.error);
            }
            return await window.restoreDataFromContent(res.content, res.fileName, false, null);
        } catch(e) {
            console.warn("Fallback to file input:", e);
        }
    }

    const input = document.getElementById('restoreFile');
    if (input) {
        input.value = '';
        input.click();
    }
};

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

// =========================================================================
// 📸 محرك ضغط وتصغير صور الأصناف تلقائياً لتقليص حجم النسخ الاحتياطية بنسبة 90%
// =========================================================================
window.compressBase64Image = function(base64Str, maxWidth = 320, maxHeight = 320, quality = 0.75) {
    return new Promise((resolve) => {
        if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image')) {
            return resolve(base64Str);
        }
        if (base64Str.length < 35000) {
            return resolve(base64Str); // الصورة خفيفة بالفعل (< 25KB) لا تحتاج لإعادة ضغط
        }
        try {
            const img = new Image();
            img.onload = () => {
                try {
                    let w = img.width;
                    let h = img.height;
                    if (w > maxWidth || h > maxHeight) {
                        if (w > h) {
                            h = Math.round((h * maxWidth) / w);
                            w = maxWidth;
                        } else {
                            w = Math.round((w * maxHeight) / h);
                            h = maxHeight;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, w, h);
                    const compressed = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressed);
                } catch(e) {
                    resolve(base64Str);
                }
            };
            img.onerror = () => resolve(base64Str);
            img.src = base64Str;
        } catch(e) {
            resolve(base64Str);
        }
    });
};

window.optimizeAllProductImagesInDB = async function() {
    if (typeof db === 'undefined' || !db || !db.products) return 0;
    try {
        const prods = await db.products.toArray();
        let changed = 0;
        for (let i = 0; i < prods.length; i++) {
            const p = prods[i];
            if (p && p.image && typeof p.image === 'string' && p.image.length > 35000) {
                const newImg = await window.compressBase64Image(p.image, 320, 320, 0.75);
                if (newImg && newImg.length < p.image.length) {
                    p.image = newImg;
                    changed++;
                }
            }
        }
        if (changed > 0) {
            await db.products.bulkPut(prods);
            if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
                window.productsDB = prods;
            }
            console.log(`✅ [ImageOptimizer] تم ضغط وتحسين صور ${changed} صنف بنجاح في قاعدة البيانات.`);
        }
        return changed;
    } catch(err) {
        console.error("Error optimizing product images in DB:", err);
        return 0;
    }
};

window.executeAutoBackupToFile = async function(silent = false, isManual = false) {
    if (!silent) {
        window.showBackupProgressOverlay();
    }
    
    // 1. قراءة كافة الجداول الأساسية من SQLite مباشرة لضمان أعلى دقة وشمولية
    let productsData = [];
    try {
        if (typeof db !== 'undefined' && db && db.products) productsData = await db.products.toArray();
    } catch(e) {}
    if (productsData.length === 0 && typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
        productsData = productsDB;
    }
    productsData = (productsData || []).filter(p => p && typeof p === 'object' && p.id != null);

    // 📸 ضغط وتحسين صور الأصناف الكبيرة تلقائياً لتخفيض حجم ملف النسخة الاحتياطية بنسبة تصل إلى 90%
    if (typeof window.compressBase64Image === 'function') {
        let anyCompressed = false;
        for (let i = 0; i < productsData.length; i++) {
            const p = productsData[i];
            if (p && p.image && typeof p.image === 'string' && p.image.length > 35000) {
                try {
                    const newImg = await window.compressBase64Image(p.image, 320, 320, 0.75);
                    if (newImg && newImg.length < p.image.length) {
                        p.image = newImg;
                        anyCompressed = true;
                    }
                } catch(e) {}
            }
        }
        // حفظ الأصناف المضغوطة في قاعدة البيانات لتخفيف قاعدة البيانات للأبد وتسريع المرات القادمة
        if (anyCompressed && typeof db !== 'undefined' && db && db.products) {
            db.products.bulkPut(productsData).catch(() => {});
            if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
                window.productsDB = productsData;
            }
        }
    }

    let transactionsData = [];
    try {
        if (typeof db !== 'undefined' && db && db.transactions) transactionsData = await db.transactions.toArray();
    } catch(e) {}
    if (transactionsData.length === 0 && typeof transactions !== 'undefined' && Array.isArray(transactions)) {
        transactionsData = transactions;
    }
    transactionsData = (transactionsData || []).filter(t => t && typeof t === 'object' && t.id != null);

    let accountsData = [];
    try {
        if (typeof db !== 'undefined' && db && db.accounts) accountsData = await db.accounts.toArray();
    } catch(e) {}
    if (accountsData.length === 0 && typeof accounts !== 'undefined' && Array.isArray(accounts)) {
        accountsData = accounts;
    }
    accountsData = (accountsData || []).filter(a => a && typeof a === 'object' && a.id != null);

    let trashData = [];
    try {
        if (typeof db !== 'undefined' && db && db.trash) trashData = await db.trash.toArray();
    } catch(e) {}
    if (trashData.length === 0 && typeof trashBin !== 'undefined' && Array.isArray(trashBin)) {
        trashData = trashBin;
    }
    trashData = (trashData || []).filter(t => t && typeof t === 'object');

    // 2. جلب كافة الجداول الإضافية من SQLite (سجلات الخزينة، التدقيق، المخازن، والخلفيات المخصصة)
    let treasuryData = [];
    let auditLogData = [];
    let warehousesData = [];
    let wallpapersData = [];
    try {
        if (db && db.treasuryAudit) treasuryData = await db.treasuryAudit.toArray();
        if (db && db.auditLogs) auditLogData = await db.auditLogs.toArray();
        if (db && db.warehouses) warehousesData = await db.warehouses.toArray();
        if (db && db.wallpapers) wallpapersData = await db.wallpapers.toArray();
    } catch(e) {
        console.warn("Error reading secondary tables for backup:", e);
    }
    if (treasuryData.length === 0 && typeof treasuryAuditRecords !== 'undefined' && Array.isArray(treasuryAuditRecords)) {
        treasuryData = treasuryAuditRecords;
    }
    if (auditLogData.length === 0 && typeof auditLogs !== 'undefined' && Array.isArray(auditLogs)) {
        auditLogData = auditLogs;
    }
    if (warehousesData.length === 0 && typeof warehouses !== 'undefined' && Array.isArray(warehouses) && warehouses.length > 0) {
        warehousesData = warehouses;
    }
    if (warehousesData.length === 0) {
        try {
            warehousesData = JSON.parse(getStore('pos_warehouses') || '[]');
        } catch(e) {}
    }

    // 🔒 قراءة وتأمين وتشفير رموز الـ PIN للمستخدمين في ملف النسخة الاحتياطية
    let usersList = [];
    try {
        if (typeof db !== 'undefined' && db && db.users) usersList = await db.users.toArray();
    } catch(e) {}
    if ((!usersList || usersList.length === 0) && typeof users !== 'undefined' && Array.isArray(users)) {
        usersList = users;
    }
    const securedUsers = (usersList || []).filter(u => u && typeof u === 'object').map(u => {
        if (!u) return u;
        const copy = { ...u };
        if (copy.pin != null && copy.pin !== '' && typeof window.BayanSecurity !== 'undefined' && typeof window.BayanSecurity.encryptPin === 'function') {
            copy.pin = window.BayanSecurity.encryptPin(copy.pin);
        }
        return copy;
    });

    const _safeParse = (val, fallback) => {
        if (val === null || val === undefined || val === '') return fallback;
        if (typeof val === 'object') return val;
        try {
            return JSON.parse(val);
        } catch (e) {
            return fallback;
        }
    };

    const data = {
        version: window.appVersion || "3.2.2",
        backupDate: new Date().toISOString(),
        products: productsData,
        transactions: transactionsData,
        settings: _safeParse(getStore('pos_settings'), {}),
        users: securedUsers,
        accounts: accountsData,
        trash: trashData,
        treasuryAudit: treasuryData,
        auditLogs: auditLogData,
        warehouses: warehousesData,
        wallpapers: wallpapersData,
        inventoryCategories: (window.inventoryCategories && window.inventoryCategories.length > 0) ? window.inventoryCategories : _safeParse(getStore('bayan_inventory_categories'), []),
        barcodeLabelSettings: _safeParse(getStore('bayan_barcode_label_settings'), {}),
        barcodeCenterSettings: _safeParse(getStore('bayan_barcode_center_settings'), {}),
        paymentMethods: _safeParse(getStore('bayan_payment_methods'), []),
        globalUnits: _safeParse(getStore('bayan_global_units'), []),
        businessLogo: getStore('bayan_business_logo') || '',
        userConfirmedCustomLogo: getStore('bayan_user_confirmed_custom_logo') || '',
        theme: getStore('pos_theme') || '',
        wallpaper: getStore('bayan_wallpaper') || '',
        wallpaperType: getStore('bayan_wallpaper_type') || '',
        savedWallpaper: getStore('bayan_saved_wallpaper') || '',
        printSettings: _safeParse(getStore('bayan_print_settings'), {}),
        printStyle: getStore('bayan_print_style') || '',
        printTemplateChoice: _safeParse(getStore('bayan_print_template_choice'), {}),
        userTemplates: _safeParse(getStore('bayan_user_templates'), []),
        autoPrintEnabled: getStore('pos_auto_print_enabled') || '',
        receiptLog: _safeParse(getStore('bayan_receipt_log'), []),
        calcHistory: _safeParse(getStore('bayan_calc_history'), []),
        treasuryNotes: getStore('bayan_treasury_notes') || '',
        treasuryNotesConfig: {
            borderColor: getStore('tr_notes_border_color') || '',
            customTitle: getStore('tr_notes_custom_title') || '',
            saveSystem: getStore('tr_notes_save_system') || ''
        },
        tableColumnsSettings: {
            wrCols: _safeParse(getStore('wrColSettings'), {}),
            invCols: _safeParse(getStore('pos_inv_cols_visible'), {}),
            invColsLegacy: _safeParse(getStore('pos_inv_cols'), {}),
            histCols: _safeParse(getStore('pos_hist_cols'), {}),
            accCols: _safeParse(getStore('pos_acc_cols'), {}),
            accColsOrder: _safeParse(getStore('pos_acc_cols_order_v2'), []),
            anCols: _safeParse(getStore('pos_an_cols'), {}),
            stmtCols: _safeParse(getStore('pos_stmt_cols'), {}),
            inquiryVariantsCols: _safeParse(getStore('pos_inquiry_variants_cols'), {}),
            transferCols: _safeParse(getStore('transferColSettings'), {}),
            priceAdjCols: _safeParse(getStore('priceAdjHiddenCols'), []),
            priceAdjColsAlt: _safeParse(getStore('bayan_adj_hidden_columns'), [])
        },
        viewPreferences: {
            variantViewMode: getStore('bayan_variant_view_mode') || '',
            variantViewModePinned: getStore('bayan_variant_view_mode_pinned') || '',
            inquiryViewMode: getStore('pos_inquiry_view_mode') || '',
            showQuickItems: getStore('showQuickItems') || '',
            pinnedPaymentMethod: getStore('pinned_payment_method') || '',
            pinnedPriceLevel: getStore('pos_pinned_price_level') || getStore('pos_price_level_pinned') || ''
        },
        discountReasons: (typeof discountReasons !== 'undefined') ? discountReasons : _safeParse(getStore('pos_discount_reasons'), []),
        taxReasons: (typeof taxReasons !== 'undefined') ? taxReasons : _safeParse(getStore('pos_tax_reasons'), []),
        purchaseDiscountReasons: (typeof purchaseDiscountReasons !== 'undefined') ? purchaseDiscountReasons : _safeParse(getStore('pos_p_discount_reasons'), []),
        purchaseTaxReasons: (typeof purchaseTaxReasons !== 'undefined') ? purchaseTaxReasons : _safeParse(getStore('pos_p_tax_reasons'), []),
        drawerClosures: _safeParse(localStorage.getItem('bayan_drawer_closures') || getStore('bayan_drawer_closures'), [])
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
    // إذا كان النسخ يدوياً، نقوم بتنزيل الملف دائماً في المتصفح / مجلد Downloads ليراه العميل أمامه فوراً
    if (isManual || !success) {
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
                const timestamp = `${d.getFullYear()}_${pad(d.getMonth()+1)}_${pad(d.getDate())}__${pad(d.getHours())}_${pad(d.getMinutes())}`;
                finalFileName = `backup_pos_${isManual ? 'manual' : 'auto'}_${timestamp}.json`;
                a.download = finalFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                success = true;
                backupDirDisplay = 'سطح المكتب (Desktop) ومجلد التنزيلات (Downloads)';
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
    const isAutoBackupEnabled = (settings.autoBackup === true || settings.autoBackup === 'true');
    if (!isAutoBackupEnabled) return;

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
            const unsaved = (typeof window.checkUnsavedDataInAllTabs === 'function')
                ? window.checkUnsavedDataInAllTabs()
                : null;

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

            // 2. إذا كانت كافة البيانات محفوظة، نقوم بالنسخ الاحتياطي إذا كان مفعلاً
            try {
                const settings = JSON.parse(getStore('pos_settings') || '{}');
                const isAutoBackupEnabled = (settings.autoBackup === true || settings.autoBackup === 'true');
                const shouldBackup = isAutoBackupEnabled;

                if (shouldBackup) {
                    if (typeof window.showBackupProgressOverlay === 'function') {
                        window.showBackupProgressOverlay();
                    }
                    if (typeof window.executeAutoBackupToFile === 'function') {
                        await window.executeAutoBackupToFile(true);
                    }
                    // مهلة بصرية قصيرة جداً (350ms) لإتمام الرسم والحفظ بسلاسة
                    await new Promise(r => setTimeout(r, 350));
                }
            } catch (err) {
                console.error("Backup before quit error:", err);
            } finally {
                // إكمال عملية الخروج بأمان بعد إنهاء النسخ الاحتياطي
                if (electron && electron.ipcRenderer) {
                    electron.ipcRenderer.send('proceed-quit');
                }
            }
        });
    }
} catch (e) {
    console.log("Not running in Electron environment or ipcRenderer unavailable.");
}

// دعم تحذير الخروج في المتصفح العادي (Browser) عند وجود بيانات غير محفوظة
window.addEventListener('beforeunload', (e) => {
    // في بيئة Electron نتخطى هذا لأن main.js يدير دورة الإغلاق والأمان كاملاً
    try {
        if (typeof window !== 'undefined' && window.require && window.require('electron')) return;
    } catch(err) {}

    const unsaved = (typeof window.checkUnsavedDataInAllTabs === 'function')
        ? window.checkUnsavedDataInAllTabs()
        : null;

    if (unsaved && unsaved.hasUnsaved) {
        e.preventDefault();
        e.returnValue = `تنبيه: توجد بيانات غير محفوظة في (${unsaved.tabLabel}).`;
        return e.returnValue;
    }
});