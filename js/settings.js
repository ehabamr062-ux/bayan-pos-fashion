// --- 0. Trash Helper ---

function addToTrash(type, data, desc) {
    const trashItem = {
        type: type,
        label: desc,
        originalData: JSON.parse(JSON.stringify(data)),
        deletedAt: new Date().toISOString(),
        deletedBy: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'نظام آلي'
    };

    if (typeof db !== 'undefined' && db.trash) {
        db.trash.add(trashItem).then(() => {
            if (typeof trashManager !== 'undefined') trashManager.loadTrash();
        });
    } else {
        // Fallback to legacy array if DB is not ready
        if (typeof trashBin === 'undefined') window.trashBin = [];
        trashBin.push({ ...trashItem, id: Date.now() });
        saveData();
    }
}

// --- 1. General Settings Logic ---

async function saveSettings() {
    const currentSettings = JSON.parse(getStore('pos_settings') || '{}');
    
    // 1. Phone Validation Logic
    const p1 = document.getElementById('shopPhone1').value.trim();
    const p2 = document.getElementById('shopPhone2').value.trim();
    const p3 = document.getElementById('shopPhone3').value.trim();
    const p4 = document.getElementById('shopPhone4').value.trim();

    const isNumeric = (str) => /^\d+$/.test(str);

    // Validate Mobile 1 (Primary)
    if (p1 && (p1.length !== 11 || !isNumeric(p1))) {
        return showToast("⚠️ الموبايل الأساسي يجب أن يكون 11 رقم بالضبط", "error");
    }
    // Validate WhatsApp
    if (p4 && (p4.length !== 11 || !isNumeric(p4))) {
        return showToast("⚠️ رقم واتساب يجب أن يكون 11 رقم بالضبط", "error");
    }
    // Validate Additional Phone
    if (p2 && (p2.length !== 11 || !isNumeric(p2))) {
        return showToast("⚠️ الهاتف الإضافي يجب أن يكون 11 رقم بالضبط", "error");
    }
    // Validate Landline
    if (p3 && (p3.length !== 10 || !isNumeric(p3))) {
        return showToast("⚠️ الخط الأرضي يجب أن يكون 10 أرقام بالضبط (كود المحافظة + الرقم)", "error");
    }

    const settings = {
        ...currentSettings,
        name: document.getElementById('shopName').value,
        phones: [p1, p2, p3, p4],
        address: document.getElementById('shopAddress').value,
        autoBackup: document.getElementById('autoBackupSetting').checked,
        autoBackupInterval: document.getElementById('autoBackupInterval').value,
        printFooterMsg: document.getElementById('printFooterMsg').value,
        printSocialQrLink: document.getElementById('printSocialQrLink') ? document.getElementById('printSocialQrLink').value.trim() : '',
        // Financial Settings
        currencySymbol: document.getElementById('appCurrencySymbol').value || "ج.م",
        currencyName: document.getElementById('appCurrencyName').value || "جنيه مصري",
        taxPercent: parseFloat(document.getElementById('appTaxPercent').value) || 0,
        taxEnabled: document.getElementById('appTaxEnabled').checked,
        allowBackdating: document.getElementById('allowBackdating').checked,
        allowHistoryEdit: document.getElementById('allowHistoryEdit').checked,
        showInquiryCostPrice: document.getElementById('showInquiryCostPrice') ? document.getElementById('showInquiryCostPrice').checked : false,
        requireOriginalInvoiceForReturn: document.getElementById('requireOriginalInvoiceForReturn') ? document.getElementById('requireOriginalInvoiceForReturn').checked : true,
        // Business Profile & UI Customization Settings
        businessType: document.getElementById('appBusinessType') ? document.getElementById('appBusinessType').value : "clothing",
        directToSalesOnLogin: document.getElementById('directToSalesOnLogin') ? document.getElementById('directToSalesOnLogin').checked : true,
        enableVariantsMatrix: document.getElementById('enableVariantsMatrix') ? document.getElementById('enableVariantsMatrix').checked : true,
        splitWholesaleRetailReports: document.getElementById('splitWholesaleRetailReports') ? document.getElementById('splitWholesaleRetailReports').checked : true,
        enableSimpleStaffDashboard: document.getElementById('enableSimpleStaffDashboard') ? document.getElementById('enableSimpleStaffDashboard').checked : true,
        visibleDashboardSections: getDashboardSectionsVisibilityState()
    };
    setStore('pos_settings', JSON.stringify(settings));

    // Apply permissions immediately
    applyPermissions();

    // Update App Title (Preserving the Rocket Emoji)
    if (settings.name) {
        const titleEl = document.getElementById('appTitle');
        if (titleEl) titleEl.innerHTML = '🚀 ' + settings.name;
    }

    if (typeof renderQuickItems === 'function') renderQuickItems();
    if (typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
    if (typeof updateAllCurrencyLabels === 'function') updateAllCurrencyLabels();
    if (typeof applyBusinessTypeUI === 'function') applyBusinessTypeUI();

    if (typeof window.saveSettingsDirect === 'function') {
        await window.saveSettingsDirect(settings);
    } else {
        await saveData();
    }
    if (typeof window.checkAndRunPeriodicBackup === 'function') {
        window.checkAndRunPeriodicBackup();
    }
    showToast("✅ تم حفظ جميع الإعدادات وتخصيصات الأقسام بنجاح!", "success");
}

function getDashboardSectionsVisibilityState() {
    const map = {};
    document.querySelectorAll('.dash-sec-toggle').forEach(chk => {
        const sec = chk.getAttribute('data-sec');
        if (sec) map[sec] = chk.checked;
    });
    return map;
}

function setAllDashboardSectionsVisibility(visible = true) {
    document.querySelectorAll('.dash-sec-toggle').forEach(chk => {
        chk.checked = visible;
    });
    
    // جمع وتطبيق الحالة مباشرة وحفظها في pos_settings
    const sectionsMap = getDashboardSectionsVisibilityState();
    let settings = {};
    try {
        settings = JSON.parse(getStore('pos_settings') || '{}');
    } catch(e) {}
    settings.visibleDashboardSections = sectionsMap;
    setStore('pos_settings', JSON.stringify(settings));

    applyBusinessTypeUI();
    if (typeof showToast === 'function') {
        showToast(visible ? "✅ تم إظهار جميع أقسام الشاشة الرئيسية!" : "⚠️ تم إخفاء الأقسام المحددة", "success");
    }
}

function applyStaffPresetVisibility() {
    // الأقسام اليومية السريعة (الموصى بها للكاشير: البيع، مرتجع البيع، القبض، الصرف، تقرير الحركة، الفواتير، الحسابات، البضاعة، كشف الحساب، تحليل المبيعات)
    const activeStaffSections = ['sales', 'sales-return', 'receipt', 'disbursement', 'daily-report', 'invoices', 'accounts', 'inventory', 'statement', 'analysis'];
    document.querySelectorAll('.dash-sec-toggle').forEach(chk => {
        const sec = chk.getAttribute('data-sec');
        chk.checked = activeStaffSections.includes(sec);
    });

    const sectionsMap = getDashboardSectionsVisibilityState();
    let settings = {};
    try {
        settings = JSON.parse(getStore('pos_settings') || '{}');
    } catch(e) {}
    settings.visibleDashboardSections = sectionsMap;
    setStore('pos_settings', JSON.stringify(settings));

    applyBusinessTypeUI();
    if (typeof showToast === 'function') {
        showToast("✨ تم تطبيق الوضع السريع الموصى به بنجاح!", "success");
    }
}

function selectBusinessType(type) {
    const hiddenInput = document.getElementById('appBusinessType');
    if (hiddenInput) hiddenInput.value = 'clothing';

    // ضبط الخيارات التلقائية لنشاط الملابس
    const variantsCheck = document.getElementById('enableVariantsMatrix');
    if (variantsCheck) variantsCheck.checked = true;

    applyBusinessTypeUI();
}

function applyBusinessTypeUI() {
    const settings = JSON.parse(getStore('pos_settings') || '{}');
    const enableVariants = true;
    const sectionsMap = settings.visibleDashboardSections || null;

    // 1. تفعيل مصفوفة المقاسات والألوان دائماً في نسخة الفاشون
    document.body.classList.add('bayan-variants-enabled');
    document.body.classList.remove('bayan-variants-disabled');

    // 2. تطبيق إظهار وإخفاء كل قسم بشكل دقيق ونظيف
    const allKnownSections = [
        'sales', 'sales-return', 'receipt', 'disbursement', 'daily-report',
        'invoices', 'accounts', 'inventory', 'product-inquiry', 'treasury',
        'statement', 'calculator', 'analysis', 'new-account', 'new-item',
        'shortcuts', 'adjustment',
        'history', 'price-mgmt', 'transfer', 'warehouse-report', 'purchase', 'purchase-return'
    ];
    const activeClothingSections = ['sales', 'sales-return', 'receipt', 'disbursement', 'daily-report', 'invoices', 'accounts', 'inventory', 'statement', 'analysis'];

    // ترقية تلقائية: ضمان ظهور قسم تحليل المبيعات افتراضياً وعدم إخفائه بسبب حفظ قديم
    if (sectionsMap && (sectionsMap.analysis === undefined || !settings._hasMigratedAnalysisSec)) {
        sectionsMap.analysis = true;
        settings._hasMigratedAnalysisSec = true;
        settings.visibleDashboardSections = sectionsMap;
        try { setStore('pos_settings', JSON.stringify(settings)); } catch(e) {}
    }

    allKnownSections.forEach(secKey => {
        let isVisible = true;
        if (sectionsMap && sectionsMap[secKey] !== undefined) {
            isVisible = !!sectionsMap[secKey];
        } else {
            isVisible = activeClothingSections.includes(secKey);
        }
        const hideClass = `bayan-hide-sec-${secKey}`;
        if (!isVisible) {
            document.body.classList.add(hideClass);
        } else {
            document.body.classList.remove(hideClass);
        }
    });

    // 3. مزامنة checkboxes في قسم الإعدادات
    document.querySelectorAll('.dash-sec-toggle').forEach(chk => {
        const sec = chk.getAttribute('data-sec');
        if (sec) {
            if (sectionsMap && sectionsMap[sec] !== undefined) {
                chk.checked = !!sectionsMap[sec];
            } else {
                chk.checked = activeClothingSections.includes(sec);
            }
        }
    });

    // 4. التحكم في الواجهة الرئيسية المبسطة
    const simpleDashboard = settings.enableSimpleStaffDashboard !== undefined ? !!settings.enableSimpleStaffDashboard : true;
    if (simpleDashboard) {
        document.body.classList.add('bayan-simple-dashboard-mode');
    } else {
        document.body.classList.remove('bayan-simple-dashboard-mode');
    }

    // 5. تحديث كارت نوع النشاط في أعلى يسار شاشة تسجيل الدخول
    const loginBadgeName = document.getElementById('loginBusinessName');
    const loginBadgeIcon = document.getElementById('loginBusinessIcon');
    if (loginBadgeName && loginBadgeIcon) {
        loginBadgeName.innerText = 'الملابس والأحذية والموضة';
        loginBadgeIcon.innerText = '👕';
        loginBadgeIcon.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    }
}

function loadSettings() {
    const settings = JSON.parse(getStore('pos_settings') || '{}');
    
    if (settings.name) {
        document.getElementById('shopName').value = settings.name;
        const titleEl = document.getElementById('appTitle');
        if (titleEl) titleEl.innerHTML = '🚀 ' + settings.name;
    }
    if (settings.address) document.getElementById('shopAddress').value = settings.address;
    if (settings.printFooterMsg) document.getElementById('printFooterMsg').value = settings.printFooterMsg;
    if (settings.printSocialQrLink && document.getElementById('printSocialQrLink')) {
        document.getElementById('printSocialQrLink').value = settings.printSocialQrLink;
    }
    if (settings.phones) {
        document.getElementById('shopPhone1').value = settings.phones[0] || '';
        document.getElementById('shopPhone2').value = settings.phones[1] || '';
        document.getElementById('shopPhone3').value = settings.phones[2] || '';
        document.getElementById('shopPhone4').value = settings.phones[3] || '';
    }
    if (settings.fontSize) {
        window.currentFontSize = settings.fontSize;
        if (typeof applyFontSize === 'function') {
            applyFontSize(window.currentFontSize);
        } else {
            const display = document.getElementById('currentFontSizeDisplay');
            if (display) display.innerText = window.currentFontSize + 'px';
            const slider = document.getElementById('globalScaleSlider');
            if (slider) slider.value = window.currentFontSize;
        }
    }
    const autoBackupEl = document.getElementById('autoBackupSetting');
    if (autoBackupEl) {
        autoBackupEl.checked = (settings.autoBackup === true || settings.autoBackup === 'true');
        autoBackupEl.onchange = function() {
            const cur = JSON.parse(getStore('pos_settings') || '{}');
            cur.autoBackup = this.checked;
            setStore('pos_settings', JSON.stringify(cur));
            if (typeof showToast === 'function') {
                showToast(this.checked ? "✅ تم تفعيل النسخ الاحتياطي التلقائي" : "⏸️ تم إيقاف النسخ الاحتياطي التلقائي", "info");
            }
        };
    }
    const autoIntervalEl = document.getElementById('autoBackupInterval');
    if (autoIntervalEl) {
        if (settings.autoBackupInterval !== undefined) autoIntervalEl.value = settings.autoBackupInterval;
        autoIntervalEl.onchange = function() {
            const cur = JSON.parse(getStore('pos_settings') || '{}');
            cur.autoBackupInterval = this.value;
            setStore('pos_settings', JSON.stringify(cur));
            if (typeof window.checkAndRunPeriodicBackup === 'function') {
                window.checkAndRunPeriodicBackup();
            }
            if (typeof showToast === 'function') {
                const label = this.options[this.selectedIndex] ? this.options[this.selectedIndex].text : this.value;
                showToast(`⏰ تكرار النسخ التلقائي: (${label})`, "info");
            }
        };
    }

    // Load Financial Settings
    if (settings.currencySymbol) document.getElementById('appCurrencySymbol').value = settings.currencySymbol;
    if (settings.currencyName) document.getElementById('appCurrencyName').value = settings.currencyName;
    if (settings.taxPercent !== undefined) document.getElementById('appTaxPercent').value = settings.taxPercent;
    if (settings.taxEnabled !== undefined) document.getElementById('appTaxEnabled').checked = settings.taxEnabled;
    if (settings.allowBackdating !== undefined) document.getElementById('allowBackdating').checked = settings.allowBackdating;
    if (settings.allowHistoryEdit !== undefined) document.getElementById('allowHistoryEdit').checked = settings.allowHistoryEdit;
    if (settings.showInquiryCostPrice !== undefined && document.getElementById('showInquiryCostPrice')) {
        document.getElementById('showInquiryCostPrice').checked = settings.showInquiryCostPrice;
    }
    if (settings.requireOriginalInvoiceForReturn !== undefined && document.getElementById('requireOriginalInvoiceForReturn')) {
        document.getElementById('requireOriginalInvoiceForReturn').checked = settings.requireOriginalInvoiceForReturn;
    }

    // Load Business Profile Settings
    const bType = settings.businessType || 'clothing';
    selectBusinessType(bType);
    if (settings.directToSalesOnLogin !== undefined && document.getElementById('directToSalesOnLogin')) {
        document.getElementById('directToSalesOnLogin').checked = settings.directToSalesOnLogin;
    }
    if (settings.enableVariantsMatrix !== undefined && document.getElementById('enableVariantsMatrix')) {
        document.getElementById('enableVariantsMatrix').checked = settings.enableVariantsMatrix;
    }
    if (settings.splitWholesaleRetailReports !== undefined && document.getElementById('splitWholesaleRetailReports')) {
        document.getElementById('splitWholesaleRetailReports').checked = settings.splitWholesaleRetailReports;
    }
    if (settings.enableSimpleStaffDashboard !== undefined && document.getElementById('enableSimpleStaffDashboard')) {
        document.getElementById('enableSimpleStaffDashboard').checked = settings.enableSimpleStaffDashboard;
    }

    // Load Checkboxes for Dashboard Sections
    const secMap = settings.visibleDashboardSections;
    if (secMap && typeof secMap === 'object') {
        document.querySelectorAll('.dash-sec-toggle').forEach(chk => {
            const sec = chk.getAttribute('data-sec');
            if (sec && secMap[sec] !== undefined) {
                chk.checked = !!secMap[sec];
            }
        });
    }
    applyBusinessTypeUI();

    if (typeof updateAllCurrencyLabels === 'function') updateAllCurrencyLabels();

    // Apply Logic Constraints based on Permissions
    applyPermissions();

    // تحميل وتثبيت إعدادات الباركود وتحديد القالب المختار دائماً
    if (typeof loadBarcodeLabelSettings === 'function') {
        loadBarcodeLabelSettings();
    }
}

function applyPermissions() {
    const settings = JSON.parse(getStore('pos_settings') || '{}');
    const canBackdate = settings.allowBackdating !== undefined ? !!settings.allowBackdating : true;
    const canEditHistory = settings.allowHistoryEdit !== undefined ? !!settings.allowHistoryEdit : true;

    // 1. Control Date & Time fields
    const dateInputs = [
        'salesDate', 'salesTime', 'purchaseDate', 'purchaseTime',
        'receiptDate', 'receiptTime', 'disburseDate', 'disburseTime',
        'salesReturnDate', 'salesReturnTime', 'purReturnDate', 'purReturnTime',
        'adjDate', 'adjTime', 'transferDate', 'transferTime'
    ];

    dateInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.readOnly = !canBackdate;
            el.disabled = false;
            el.style.opacity = canBackdate ? "1" : "0.7";
            el.style.pointerEvents = canBackdate ? "auto" : "none";
        }
    });

    // 2. Control Edit/Delete buttons in history tables
    let styleEl = document.getElementById('permissions-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'permissions-style';
        document.head.appendChild(styleEl);
    }

    if (!canEditHistory) {
        styleEl.textContent = `
            .history-table .btn-edit-row, 
            .history-table .btn-delete-row, 
            .history-table [onclick*="editSelectedInvoice"], 
            .history-table [onclick*="deleteSelectedInvoice"], 
            .history-table [onclick*="editTransaction"] {
                display: none !important;
            }
        `;
    } else {
        styleEl.textContent = '';
    }

    // 3. 🔒 التحكم في ظهور أزرار وملخصات الأرباح (شاشة البيع وتقرير الحركة اليومية)
    let canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;

    if (typeof currentUser !== 'undefined' && currentUser) {
        const uTarget = (typeof users !== 'undefined') ? users.find(u => u.pin === currentUser.pin) || currentUser : currentUser;
        if (uTarget && uTarget.permissions && uTarget.permissions.general) {
            if (uTarget.permissions.general.hideProfits !== undefined) {
                canViewProfits = !uTarget.permissions.general.hideProfits;
            } else if (uTarget.permissions.general.profits !== undefined) {
                canViewProfits = !!uTarget.permissions.general.profits;
            }
        }
    }

    const profitBtns = document.querySelectorAll('.btn-profit, #btnCurrentBillProfit, .action-btn.btn-profit');
    profitBtns.forEach(btn => {
        if (btn) {
            btn.style.setProperty('display', canViewProfits ? '' : 'none', 'important');
        }
    });

    const dailyProfitCard = document.getElementById('dailyReportProfitSummaryCard');
    if (dailyProfitCard) {
        dailyProfitCard.style.setProperty('display', canViewProfits ? '' : 'none', 'important');
    }

    // 3.2 🔒 التحكم في ظهور رصيد الدرج والرصيد السابق والنهائي بتقرير الحركة اليومية
    let hideDrawerBalance = (typeof hasPermission === 'function') ? (hasPermission('ui_hide_drawer_balance') || hasPermission('hide_drawer_balance')) : false;
    if (typeof currentUser !== 'undefined' && currentUser) {
        const uTarget = (typeof users !== 'undefined') ? users.find(u => u.pin === currentUser.pin) || currentUser : currentUser;
        if (uTarget && uTarget.permissions && uTarget.permissions.general) {
            if (uTarget.permissions.general.hideDrawerBalance !== undefined) {
                hideDrawerBalance = !!uTarget.permissions.general.hideDrawerBalance;
            } else if (uTarget.permissions.general.drawerBalance !== undefined) {
                hideDrawerBalance = !uTarget.permissions.general.drawerBalance;
            }
        }
    }
    const dailyTotalBadge = document.getElementById('dailyTotalSalesReceipts');
    if (dailyTotalBadge) {
        dailyTotalBadge.style.setProperty('display', hideDrawerBalance ? 'none' : '', 'important');
    }

    // 3.3 🔒 التحكم في قفل تاريخ تقرير الحركة اليومية على اليوم الحالي فقط
    if (typeof checkAndApplyDailyReportDateLock === 'function') {
        checkAndApplyDailyReportDateLock();
    }

    // 3.1 🔒 التحكم في ظهور أزرار المشاركة وزر جديد (F10) وتفعيل النمط المبسط لشريط الأزرار
    let hideShare = (typeof hasPermission === 'function') ? hasPermission('ui_hide_share') : false;
    let hideNew = (typeof hasPermission === 'function') ? hasPermission('ui_hide_new') : false;

    if (typeof currentUser !== 'undefined' && currentUser) {
        const uTarget = (typeof users !== 'undefined') ? users.find(u => u.pin === currentUser.pin) || currentUser : currentUser;
        if (uTarget) {
            if (uTarget.lockPriceEdit !== undefined) currentUser.lockPriceEdit = !!uTarget.lockPriceEdit;
            if (uTarget.maxDiscountPercent !== undefined) currentUser.maxDiscountPercent = uTarget.maxDiscountPercent;
            if (uTarget.maxAdditionPercent !== undefined) currentUser.maxAdditionPercent = uTarget.maxAdditionPercent;
        }
        if (uTarget && uTarget.permissions && uTarget.permissions.general) {
            if (uTarget.permissions.general.hideShare !== undefined) hideShare = !!uTarget.permissions.general.hideShare;
            if (uTarget.permissions.general.hideNew !== undefined) hideNew = !!uTarget.permissions.general.hideNew;
        }
    }

    // إخفاء/إظهار أزرار المشاركة وحاوياتها
    const shareWrappers = document.querySelectorAll('.share-btn-container');
    shareWrappers.forEach(w => {
        if (w) w.style.setProperty('display', hideShare ? 'none' : 'flex', 'important');
    });
    const shareBtns = document.querySelectorAll('.action-bar .btn-share-trigger');
    shareBtns.forEach(btn => {
        if (btn) {
            btn.style.setProperty('display', hideShare ? 'none' : '', 'important');
            if (btn.parentElement && !btn.parentElement.classList.contains('action-bar')) {
                btn.parentElement.style.setProperty('display', hideShare ? 'none' : 'flex', 'important');
            }
        }
    });

    // إخفاء/إظهار أزرار جديد (F10)
    const newBtns = document.querySelectorAll('.action-bar .btn-new');
    newBtns.forEach(btn => {
        if (btn) btn.style.setProperty('display', hideNew ? 'none' : '', 'important');
    });

    // تفعيل نمط العرض المبسط (.simplified-pos-actions) للأشرطة السفلية
    const allActionBars = document.querySelectorAll('.action-bar');
    allActionBars.forEach(bar => {
        const isSales = bar.closest('#sales-section');
        // في المبيعات، يتم التبسيط إذا أخفيت المشاركة وجديد مع حجب الأرباح؛ وفي الأقسام الأخرى إذا أخفيت المشاركة وجديد
        const shouldSimplify = isSales ? (hideShare && hideNew && !canViewProfits) : (hideShare && hideNew);
        if (shouldSimplify) {
            bar.classList.add('simplified-pos-actions');
        } else {
            bar.classList.remove('simplified-pos-actions');
        }
    });

    // 4. 🔒 تحديث ضوابط الخصم والتسعير في شاشة المبيعات فور تسجيل الدخول
    const isPriceLocked = (typeof currentUser !== 'undefined' && currentUser && currentUser.lockPriceEdit);
    const canEditPrice = !isPriceLocked && ((typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin') 
        || (typeof hasPermission === 'function' && hasPermission('docs_price_edit')));
    const headerPriceEl = document.getElementById('headerPrice');
    if (headerPriceEl) {
        headerPriceEl.readOnly = !canEditPrice;
        if (!canEditPrice) {
            headerPriceEl.style.cursor = 'not-allowed';
            headerPriceEl.style.background = '#f1f5f9';
            headerPriceEl.style.color = '#64748b';
            headerPriceEl.title = isPriceLocked ? '🔒 تعديل سعر البيع مقفل ومحمي لهذا الحساب' : '🔒 تعديل السعر مقفل للكاشير ومصرح به للمدير فقط';
        } else {
            headerPriceEl.style.cursor = '';
            headerPriceEl.style.background = '#ffffff';
            headerPriceEl.style.color = '#0f172a';
            headerPriceEl.title = '';
        }
    }

    // 5. 🔒 إخفاء الأقسام غير المصرح بها من الواجهة الرئيسية (الداشبورد) فوراً وبدقة
    const isSuperOrAdmin = (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin');
    const p = (currentUser && currentUser.permissions) ? currentUser.permissions : {};

    const toggleTile = (selector, hasPerm) => {
        const tiles = document.querySelectorAll(selector);
        tiles.forEach(tile => {
            if (tile) {
                tile.style.setProperty('display', (isSuperOrAdmin || hasPerm) ? '' : 'none', 'important');
            }
        });
    };

    // 1. قسم المبيعات
    toggleTile('.dm-sec-sales', typeof hasPermission === 'function' && hasPermission('docs_add'));
    // 2. قسم مرتجع المبيعات
    toggleTile('.dm-sec-sales-return', typeof hasPermission === 'function' && hasPermission('docs_return'));
    // 3. قسم فواتير الشراء
    toggleTile('.dm-sec-purchase', typeof hasPermission === 'function' && hasPermission('docs_purchase'));
    // 4. قسم مرتجع الشراء
    const canPurReturn = (p.docs && p.docs.purchase_return !== undefined) ? !!p.docs.purchase_return : (hasPermission('docs_purchase') || hasPermission('docs_return'));
    toggleTile('.dm-sec-purchase-return', typeof hasPermission === 'function' && canPurReturn);
    // 5. قسم سجل واستعراض الفواتير
    toggleTile('.dm-sec-invoices', typeof hasPermission === 'function' && hasPermission('docs_view'));

    // 6. قسم سندات القبض
    const canReceipt = (p.accounts && p.accounts.receipt !== undefined) ? !!p.accounts.receipt : hasPermission('accounts_add');
    toggleTile('.dm-sec-receipt', typeof hasPermission === 'function' && canReceipt);
    // 7. قسم سندات الصرف
    const canDisburse = (p.accounts && p.accounts.disbursement !== undefined) ? !!p.accounts.disbursement : hasPermission('accounts_add');
    toggleTile('.dm-sec-disbursement', typeof hasPermission === 'function' && canDisburse);
    // 8. قسم الحسابات والعملاء والموردين
    toggleTile('.dm-sec-accounts', typeof hasPermission === 'function' && hasPermission('accounts_view'));
    // 9. قسم إضافة حساب جديد
    toggleTile('.dm-sec-new-account', typeof hasPermission === 'function' && hasPermission('accounts_add'));
    // 10. قسم كشف حساب
    const canStatement = typeof hasPermission === 'function' && hasPermission('accounts_statement');
    toggleTile('.dm-sec-statement', canStatement);

    // 11. قسم مراجعة الخزينة (مقيد بالصلاحيات للموظفين)
    const canTreasury = (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin') || (typeof hasPermission === 'function' && hasPermission('accounts_treasury'));
    toggleTile('.dm-sec-treasury', canTreasury);

    // 12. قسم المخزن وبضاعة الأصناف
    toggleTile('.dm-sec-inventory', typeof hasPermission === 'function' && hasPermission('stock_view'));
    // 13. قسم إضافة صنف جديد
    toggleTile('.dm-sec-new-item', typeof hasPermission === 'function' && hasPermission('stock_add'));
    // 14. قسم إدارة الأسعار والمخازن
    toggleTile('.dm-sec-price-mgmt', typeof hasPermission === 'function' && hasPermission('stock_edit'));
    // 15. قسم تسوية مخزن
    const canAdjust = (p.stock && p.stock.adjust !== undefined) ? !!p.stock.adjust : (hasPermission('stock_edit') || hasPermission('stock_transfer'));
    toggleTile('.dm-sec-adjustment', typeof hasPermission === 'function' && canAdjust);
    // 16. قسم حركة صنف
    const canHistory = (p.stock && p.stock.history !== undefined) ? !!p.stock.history : (hasPermission('stock_view') || hasPermission('docs_view'));
    toggleTile('.dm-sec-history', typeof hasPermission === 'function' && canHistory);
    // 17. قسم تحويل المخزون
    toggleTile('.dm-sec-transfer', typeof hasPermission === 'function' && hasPermission('stock_transfer'));
    // 18. قسم أرصدة المخازن التفصيلية
    const canWarehouseReport = typeof hasPermission === 'function' && hasPermission('stock_warehouse_report');
    toggleTile('.dm-sec-warehouse-report', canWarehouseReport);
    // 19. قسم استعلام الأصناف
    const canInquiry = (p.stock && p.stock.inquiry !== undefined) ? !!p.stock.inquiry : hasPermission('stock_view');
    toggleTile('.dm-sec-product-inquiry', typeof hasPermission === 'function' && canInquiry);

    // 20. قسم تقارير الحركة اليومية
    toggleTile('.dm-sec-daily-report', typeof hasPermission === 'function' && hasPermission('general_reports'));
    // 21. قسم تقارير وتحليل الأرباح
    toggleTile('.dm-sec-analysis', typeof hasPermission === 'function' && hasPermission('general_profits'));
    // 22. قسم شاشة الإعدادات
    toggleTile('.dm-sec-settings', typeof hasPermission === 'function' && hasPermission('general_settings'));
    // 23. قسم اختصارات الكيبورد (يختفي إذا لم تكن هناك صلاحية للإعدادات)
    const canShortcuts = typeof hasPermission === 'function' && hasPermission('general_settings') && (p.general && p.general.shortcuts !== undefined ? !!p.general.shortcuts : true);
    toggleTile('.dm-sec-shortcuts', canShortcuts);

    // 🔒 إخفاء وضبط أزرار شريط الأدوات داخل شاشة الحسابات والعملاء
    toggleTile('.acc-btn-receipt', typeof hasPermission === 'function' && canReceipt);
    toggleTile('.acc-btn-disbursement', typeof hasPermission === 'function' && canDisburse);
    toggleTile('.acc-btn-edit', typeof hasPermission === 'function' && hasPermission('accounts_edit'));
    toggleTile('.acc-btn-delete', isSuperOrAdmin || (typeof hasPermission === 'function' && hasPermission('accounts_delete')));
    toggleTile('.acc-btn-statement', canStatement);
    toggleTile('.acc-btn-settings, [onclick*="exportAccountsToExcel"], [onclick*="importAccountsExcelInput"]', isSuperOrAdmin || (typeof hasPermission === 'function' && hasPermission('general_settings')));

    // 🔒 إدارة مجموعات الصف الأوسط بذكاء لمنع أي فراغات أو انحرافات بصرية
    const group2 = document.getElementById('dmMidGroup2');
    const group3 = document.getElementById('dmMidGroup3');
    if (group2) {
        const hasG2 = Array.from(group2.children).some(c => c.style.display !== 'none');
        group2.style.display = hasG2 ? 'flex' : 'none';
    }
    if (group3) {
        const hasG3 = Array.from(group3.children).some(c => c.style.display !== 'none');
        group3.style.display = hasG3 ? 'flex' : 'none';
    }
}

// =========================================================================
// 💰 دوال الاختيار السريع للعملات
// =========================================================================
function selectCurrencyQuick(symbol, name) {
    const symbolEl = document.getElementById('appCurrencySymbol');
    const nameEl = document.getElementById('appCurrencyName');
    if (symbolEl) symbolEl.value = symbol;
    if (nameEl && name) nameEl.value = name;
    if (typeof showToast === 'function') showToast(`🇸🇦 تم اختيار العملة: ${symbol} (${name})`, 'success');
}

// =========================================================================
// ⚡ قوالب الصلاحيات السريعة (Permission Presets)
// =========================================================================
function applyPermissionPreset(presetType) {
    const allCheckboxes = document.querySelectorAll('#permissionsGrid input[type="checkbox"]');
    
    if (presetType === 'select_all') {
        allCheckboxes.forEach(chk => chk.checked = true);
        if (typeof showToast === 'function') showToast("✅ تم تحديد كافة الصلاحيات بنجاح!", "success");
        return;
    }

    if (presetType === 'deselect_all') {
        allCheckboxes.forEach(chk => chk.checked = false);
        if (typeof showToast === 'function') showToast("❌ تم إلغاء كافة الصلاحيات!", "info");
        return;
    }

    // تصفير الكل أولاً
    allCheckboxes.forEach(chk => chk.checked = false);

    if (presetType === 'cashier_only') {
        // كاشير بيع فقط: إضافة فواتير بيع وخصم محدود (بدون تعديل سعر البيع، بدون ضريبة، بدون حذف)
        const cashierIds = ['perm_docs_add', 'perm_docs_discount', 'perm_gen_lock_daily_user', 'perm_gen_lock_daily_date', 'perm_gen_lock_daily_amounts'];
        cashierIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        });
        if (document.getElementById('perm_docs_price_edit')) document.getElementById('perm_docs_price_edit').checked = false;
        if (document.getElementById('perm_docs_tax')) document.getElementById('perm_docs_tax').checked = false;
        if (document.getElementById('newUserMaxDiscount')) document.getElementById('newUserMaxDiscount').value = '5';
        if (typeof showToast === 'function') showToast("🛒 تم تطبيق قالب: كاشير (بيع فقط - سعر مقفل وخصم 5%) بنجاح!", "success");
    } else if (presetType === 'stock_manager') {
        // أمين مخزن: بضاعة ومخازن ونقل أصناف فقط
        const stockIds = ['perm_stock_add', 'perm_stock_edit', 'perm_stock_transfer', 'perm_stock_view', 'perm_docs_view'];
        stockIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        });
        if (typeof showToast === 'function') showToast("📦 تم تطبيق قالب: مسؤول مخازن بنجاح!", "success");
    } else if (presetType === 'accountant') {
        // محاسب مالي: حسابات، كشوفات، تقارير مالية، أرباح
        const accIds = ['perm_acc_add', 'perm_acc_edit', 'perm_acc_statement', 'perm_acc_view', 'perm_gen_reports', 'perm_gen_profits', 'perm_docs_view', 'perm_stock_view'];
        accIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        });
        if (typeof showToast === 'function') showToast("💼 تم تطبيق قالب: محاسب مالي بنجاح!", "success");
    }
}

// =========================================================================
// 💳 إدارة تسجيل وقراءة كروت NFC / RFID للموظفين
// =========================================================================
window.isListeningForNfcRegistration = false;

function startNfcRegistration() {
    window.isListeningForNfcRegistration = true;
    const modal = document.getElementById('nfcRegistrationModal');
    const input = document.getElementById('nfcManualUidInput');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
    }
}
window.startNfcScanForUser = startNfcRegistration;
window.startNfcRegistration = startNfcRegistration;

function closeNfcRegistrationModal() {
    window.isListeningForNfcRegistration = false;
    const modal = document.getElementById('nfcRegistrationModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function saveManualNfcUid(scannedUid) {
    const input = document.getElementById('nfcManualUidInput');
    const uid = (scannedUid || (input ? input.value : '')).trim();

    if (!uid) {
        if (typeof showToast === 'function') showToast("⚠️ يرجى تمرير الكارت أو كتابة رمزه UID", "error");
        return;
    }

    // 1. إذا كانت شاشة تسجيل الدخول الرئيسية مفتوحة -> نقوم بتسجيل دخول الموظف فوراً
    const isLoginOpen = document.getElementById('loginModal') && !document.getElementById('loginModal').classList.contains('hidden');
    if (isLoginOpen && !window.isListeningForNfcRegistration) {
        closeNfcRegistrationModal();
        if (typeof attemptNfcLogin === 'function') {
            attemptNfcLogin(uid);
        }
        return;
    }

    // 2. إذا كنا في شاشة إعدادات المستخدمين -> نقوم بربط الكارت بالموظف
    const existingUser = users.find(u => u.nfcUid === uid && u.id !== window.editingUserId);
    if (existingUser) {
        if (typeof showToast === 'function') showToast(`🚫 هذا الكارت مربوط بالفعل بالموظف (${existingUser.name})!`, "error");
        return;
    }

    const nfcInput = document.getElementById('newUserNfcUid');
    if (nfcInput) {
        nfcInput.value = uid;
        nfcInput.style.color = '#10b981';
    }

    closeNfcRegistrationModal();
    if (typeof showToast === 'function') showToast(`✅ تم ربط كارت NFC (${uid}) بنجاح!`, "success");
}

function clearUserNfc() {
    const nfcInput = document.getElementById('newUserNfcUid');
    if (nfcInput) {
        nfcInput.value = '';
    }
    if (typeof showToast === 'function') showToast("🗑️ تم فك ارتباط كارت NFC", "info");
}

// --- 2. User Management Logic ---

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let rowsHtml = '';
    users.forEach((u, idx) => {
        const isSuperAdmin = (u.id === 1);
        const isFrozen = !!u.isFrozen;
        const nfcBadge = u.nfcUid 
            ? `<span style="background: #eff6ff; color: #1d4ed8; border: 2px solid #93c5fd; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 5px;">💳 ${u.nfcUid}</span>`
            : `<span style="color: #000000; font-size: 0.92rem; font-weight: 900; background: #f1f5f9; padding: 5px 12px; border-radius: 8px; border: 2px solid #cbd5e1;">غير مربوط</span>`;

        const statusBadge = isFrozen
            ? `<span style="background: #fef2f2; color: #b91c1c; border: 2px solid #fca5a5; padding: 5px 14px; border-radius: 50px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">❄️ مجمّد</span>`
            : `<span style="background: #ecfdf5; color: #047857; border: 2px solid #86efac; padding: 5px 14px; border-radius: 50px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">🟢 نشط</span>`;

        let whBadge = `<span style="background: #f0fdf4; color: #15803d; border: 2px solid #86efac; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">🌐 كافة الفروع</span>`;
        if (u.warehouseScope === 'main') {
            whBadge = `<span style="background: #f1f5f9; color: #000000; border: 2px solid #94a3b8; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">🏢 المخزن الرئيسي</span>`;
        } else if (u.warehouseScope === 'specific' && u.assignedWarehouse) {
            whBadge = `<span style="background: #faf5ff; color: #6b21a8; border: 2px solid #d8b4fe; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">🏬 ${u.assignedWarehouse}</span>`;
        }

        let invScopeBadge = `<span style="background: #f0fdf4; color: #15803d; border: 2px solid #86efac; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">🌐 كافة الفواتير</span>`;
        if (u.invoiceScope === 'user_only') {
            invScopeBadge = `<span style="background: #eff6ff; color: #1d4ed8; border: 2px solid #93c5fd; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">👤 فواتيره فقط</span>`;
        } else if (u.invoiceScope === 'hide_admin') {
            invScopeBadge = `<span style="background: #fef2f2; color: #b91c1c; border: 2px solid #fca5a5; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">🛡️ حجب المدير</span>`;
        } else if (u.invoiceScope === 'terminal_only') {
            invScopeBadge = `<span style="background: #f5f3ff; color: #6b21a8; border: 2px solid #c4b5fd; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">💻 جهازه فقط</span>`;
        } else if (u.invoiceScope === 'warehouse_only') {
            invScopeBadge = `<span style="background: #f0fdfa; color: #0f766e; border: 2px solid #5eead4; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">🏢 فرعه فقط</span>`;
        } else if (u.invoiceScope === 'hide_master') {
            invScopeBadge = `<span style="background: #fff7ed; color: #c2410c; border: 2px solid #fdba74; padding: 5px 12px; border-radius: 8px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">🛡️ حجب الماستر</span>`;
        }

        const roleBadge = (u.role === 'admin')
            ? `<span style="background: #fffbeb; color: #92400e; border: 2px solid #f59e0b; padding: 5px 14px; border-radius: 50px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">⭐ مدير نظام</span>`
            : `<span style="background: #f1f5f9; color: #000000; border: 2px solid #94a3b8; padding: 5px 14px; border-radius: 50px; font-size: 0.92rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">👤 موظف</span>`;

        rowsHtml += `
            <tr style="border-bottom: 2px solid #e2e8f0; transition: background 0.15s; ${isFrozen ? 'opacity: 0.85; background: #fff5f5;' : 'background: #ffffff;'}">
                <td style="padding: 14px 16px; font-weight: 900; color: #000000; font-size: 1.05rem;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: #f1f5f9; width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; border: 2px solid #cbd5e1;">👤</span>
                        <div>
                            <span style="color: #000000; font-weight: 900; font-size: 1.05rem;">${u.name}</span>
                            ${isSuperAdmin ? '<span style="font-size: 0.85rem; color: #0284c7; font-weight: 900; display: block; margin-top: 2px;">المدير الأساسي</span>' : ''}
                        </div>
                    </div>
                </td>
                <td style="padding: 14px 16px; text-align: center;">
                    <span style="font-family: monospace; letter-spacing: 2px; font-weight: 900; font-size: 1.05rem; background: #f8fafc; padding: 5px 12px; border-radius: 8px; border: 2px solid #cbd5e1; color: #000000;">
                        ${(u.role === 'admin' && !isSuperAdmin) ? '••••' : u.pin}
                    </span>
                </td>
                <td style="padding: 14px 16px; text-align: center;">${nfcBadge}</td>
                <td style="padding: 14px 16px; text-align: center;">${roleBadge}</td>
                <td style="padding: 14px 16px; text-align: center;">${whBadge}</td>
                <td style="padding: 14px 16px; text-align: center;">${invScopeBadge}</td>
                <td style="padding: 14px 16px; text-align: center;">${statusBadge}</td>
                <td style="padding: 14px 16px; text-align: center;">
                    <div style="display: inline-flex; gap: 6px; justify-content: center; align-items: center;">
                        
                        <!-- زر التعديل -->
                        <button type="button" onclick="editUser(${idx})" title="تعديل الموظف"
                            style="background: #eff6ff; color: #1d4ed8; border: 2px solid #bfdbfe; height: 38px; padding: 0 14px; border-radius: 8px; font-weight: 900; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <span>✏️</span> تعديل
                        </button>

                        <!-- زر نسخ الصلاحيات -->
                        <button type="button" onclick="openCopyPermissionsModal(${idx})" title="نسخ صلاحيات من موظف آخر"
                            style="background: #f0fdfa; color: #0f766e; border: 2px solid #99f6e4; height: 38px; padding: 0 14px; border-radius: 8px; font-weight: 900; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <span>📋</span> نسخ
                        </button>

                        <!-- زر تغيير رمز PIN -->
                        <button type="button" onclick="changeUserPin(${idx})" title="تغيير رمز الدخول PIN"
                            style="background: #fffbeb; color: #b45309; border: 2px solid #fde68a; height: 38px; padding: 0 14px; border-radius: 8px; font-weight: 900; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <span>🔑</span> PIN
                        </button>

                        ${!isSuperAdmin ? `
                            <!-- زر التجميد / التنشيط -->
                            <button type="button" onclick="toggleFreezeUser(${idx})" title="${isFrozen ? 'تفعيل الحساب' : 'تجميد الحساب'}"
                                style="background: ${isFrozen ? '#ecfdf5' : '#f8fafc'}; color: ${isFrozen ? '#047857' : '#000000'}; border: 2px solid ${isFrozen ? '#86efac' : '#cbd5e1'}; height: 38px; padding: 0 14px; border-radius: 8px; font-weight: 900; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                ${isFrozen ? '<span>🟢</span> تنشيط' : '<span>❄️</span> تجميد'}
                            </button>

                            <!-- زر الحذف -->
                            <button type="button" onclick="deleteUser(${idx})" title="حذف الموظف نهائياً"
                                style="background: #fef2f2; color: #dc2626; border: 2px solid #fecaca; height: 38px; padding: 0 14px; border-radius: 8px; font-weight: 900; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                <span>🗑️</span> حذف
                            </button>
                        ` : `
                            <span style="background: #f1f5f9; color: #000000; border: 2px solid #cbd5e1; height: 38px; padding: 0 14px; border-radius: 8px; font-weight: 900; font-size: 0.92rem; display: inline-flex; align-items: center; gap: 4px;" title="حساب المدير محمي من الحذف والتجميد">
                                <span>🛡️</span> محمي
                            </span>
                        `}
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;
}

function toggleFreezeUser(idx) {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية تجميد أو تنشيط المستخدمين!", "error");
    }
    const u = users[idx];
    if (!u) return;
    if (u.id === 1 || u.role === 'admin' || u.name === 'المدير') return showToast("🛡️ لا يمكن تجميد حساب مدير النظام الرئيسي!", "error");

    u.isFrozen = !u.isFrozen;
    window.users = users;
    saveData();
    renderUsersTable();
    if (typeof updateLoginUsersList === 'function') updateLoginUsersList();

    const msg = u.isFrozen ? `❄️ تم تجميد حساب الموظف (${u.name})` : `🟢 تم إلغاء تجميد وتفعيل حساب الموظف (${u.name})`;
    showToast(msg, u.isFrozen ? "info" : "success");

    if (typeof logAuditAction === 'function') logAuditAction(u.isFrozen ? 'تجميد موظف' : 'تفعيل موظف', `الاسم: ${u.name}`);

    // لو كان المستخدم المجمّد هو نفسه المستخدم المسجل حالياً → تسجيل خروج فوري
    if (currentUser && (currentUser.id === u.id || currentUser.pin === u.pin) && u.isFrozen) {
        setTimeout(() => {
            if (typeof logoutUser === 'function') logoutUser();
            else if (typeof openLoginModal === 'function') openLoginModal();
        }, 800);
    }
}

function changeUserPin(idx) {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية تعديل رموز المستخدمين!", "error");
    }
    const u = users[idx];
    if (!u) return;

    if ((u.id === 1 || u.role === 'admin' || u.name === 'المدير') && (!currentUser || currentUser.role !== 'admin')) {
        return showToast("🛡️ لا يمكن تعديل رمز حساب المدير إلا بواسطة المدير نفسه!", "error");
    }

    const existingModal = document.getElementById('changePinModalOverlay');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="changePinModalOverlay" class="usr-modal-overlay">
            <div style="background: #ffffff; border-radius: 22px; width: 100%; max-width: 430px; overflow: hidden; box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.45); border: 1.5px solid #cbd5e1; animation: userModalPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 18px 22px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #d97706;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.4rem;">🔑</span>
                        <div>
                            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 900; color: #ffffff;">تغيير رمز الدخول (PIN)</h4>
                            <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 700;">الموظف: <strong style="color: #f59e0b;">${u.name}</strong></span>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('changePinModalOverlay').remove()" style="background: rgba(255,255,255,0.1); border: none; color: #cbd5e1; width: 34px; height: 34px; border-radius: 10px; cursor: pointer; font-size: 1.1rem; font-weight: 900;">✕</button>
                </div>
                <div style="padding: 22px 24px; display: flex; flex-direction: column; gap: 16px;">
                    <div>
                        <label style="display: block; font-weight: 900; font-size: 0.85rem; color: #334155; margin-bottom: 8px;">رمز الدخول الجديد (PIN مكون من 4 أرقام):</label>
                        <input type="password" id="customNewPinInput" maxlength="4" placeholder="••••" autofocus
                            style="width: 100%; height: 48px; border: 2px solid #cbd5e1; border-radius: 12px; font-family: monospace; font-size: 1.3rem; font-weight: 900; letter-spacing: 6px; text-align: center; box-sizing: border-box; outline: none; transition: border-color 0.2s;"
                            onfocus="this.style.borderColor='#d97706'" onblur="this.style.borderColor='#cbd5e1'"
                            onkeydown="if(event.key==='Enter') executeChangeUserPin(${idx})">
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
                        <button type="button" onclick="document.getElementById('changePinModalOverlay').remove()" style="background: #f1f5f9; color: #64748b; border: 1.5px solid #cbd5e1; padding: 10px 18px; border-radius: 12px; font-weight: 800; font-size: 0.88rem; cursor: pointer;">إلغاء</button>
                        <button type="button" onclick="executeChangeUserPin(${idx})" style="background: linear-gradient(135deg, #d97706, #b45309); color: white; border: none; padding: 10px 24px; border-radius: 12px; font-weight: 900; font-size: 0.9rem; cursor: pointer; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);">💾 حفظ الرمز الجديد</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
        const inp = document.getElementById('customNewPinInput');
        if (inp) inp.focus();
    }, 100);
}
window.changeUserPin = changeUserPin;

function executeChangeUserPin(idx) {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية تعديل رموز المستخدمين!", "error");
    }
    const u = users[idx];
    if (!u) return;

    if ((u.id === 1 || u.role === 'admin' || u.name === 'المدير') && (!currentUser || currentUser.role !== 'admin')) {
        return showToast("🛡️ لا يمكن تعديل رمز حساب المدير إلا بواسطة المدير نفسه!", "error");
    }

    const inp = document.getElementById('customNewPinInput');
    if (!inp) return;
    const cleanPin = String(inp.value).trim();
    if (!cleanPin || cleanPin.length !== 4 || isNaN(cleanPin)) {
        return showToast("⚠️ يجب أن يكون الرمز PIN مكوناً من 4 أرقام عددية!", "error");
    }
    const pinExists = users.some((other, i) => i !== idx && other.pin === cleanPin);
    if (pinExists) {
        return showToast("🚫 رمز PIN هذا مستخدم بالفعل لموظف آخر!", "error");
    }
    u.pin = cleanPin;
    if (currentUser && (currentUser.id === u.id || currentUser.name === u.name)) {
        currentUser.pin = cleanPin;
        window.currentUser = currentUser;
        if (typeof setStore === 'function') {
            setStore('pos_session_user', JSON.stringify(currentUser));
        }
    }
    saveData();
    renderUsersTable();
    if (typeof updateLoginUsersList === 'function') updateLoginUsersList();
    const modal = document.getElementById('changePinModalOverlay');
    if (modal) modal.remove();
    showToast(`✅ تم تغيير رمز PIN للموظف (${u.name}) بنجاح!`, "success");
    if (typeof logAuditAction === 'function') logAuditAction('تغيير PIN لموظف', `الاسم: ${u.name}`);
}
window.executeChangeUserPin = executeChangeUserPin;

function openCopyPermissionsModal(targetIdx) {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية إدارة وصلاحيات المستخدمين!", "error");
    }
    const targetUser = users[targetIdx];
    if (!targetUser) return;

    const otherUsers = users.filter((u, i) => i !== targetIdx);
    if (otherUsers.length === 0) {
        return showToast("⚠️ لا يوجد موظفون آخرون لنسخ الصلاحيات منهم!", "info");
    }

    let optionsHtml = otherUsers.map(u => `<option value="${u.id}">${u.name} (${u.role === 'admin' ? 'مدير' : 'موظف'})</option>`).join('');

    const modalHtml = `
        <div id="copyPermModalOverlay" class="usr-modal-overlay">
            <div style="background:white; border-radius:22px; width:480px; max-width:92%; overflow:hidden; box-shadow:0 25px 50px -12px rgba(15,23,42,0.4); border: 1.5px solid #cbd5e1; animation: userModalPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 18px 24px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0284c7;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:1.3rem;">📋</span>
                        <div>
                            <h4 style="margin:0; font-size:1.05rem; color:#ffffff; font-weight:900;">نسخ الصلاحيات</h4>
                            <span style="font-size:0.78rem; color:#94a3b8; font-weight:700;">إلى الموظف: <strong style="color:#38bdf8;">${targetUser.name}</strong></span>
                        </div>
                    </div>
                    <button onclick="document.getElementById('copyPermModalOverlay').remove()" style="background:rgba(255,255,255,0.1); border:none; font-size:1.1rem; cursor:pointer; color:#cbd5e1; width:34px; height:34px; border-radius:10px; font-weight:900;">✕</button>
                </div>
                <div style="padding:22px 24px; display:flex; flex-direction:column; gap:16px;">
                    <div>
                        <label style="display:block; font-weight:900; color:#334155; margin-bottom:8px; font-size:0.88rem;">اختر الموظف المُراد نسخ صلاحياته:</label>
                        <select id="sourceUserSelect" style="width:100%; height:46px; border-radius:12px; border:1.5px solid #cbd5e1; font-weight:800; padding:0 14px; font-size:0.92rem; outline:none; background:white; font-family:inherit;">
                            ${optionsHtml}
                        </select>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                        <button onclick="document.getElementById('copyPermModalOverlay').remove()" style="padding:10px 20px; border-radius:12px; background:#f1f5f9; border:1.5px solid #cbd5e1; font-weight:800; color:#64748b; cursor:pointer;">إلغاء</button>
                        <button onclick="executeCopyPermissions(${targetIdx})" style="padding:10px 26px; border-radius:12px; background:linear-gradient(135deg, #0284c7, #0369a1); border:none; font-weight:900; color:white; cursor:pointer; box-shadow:0 4px 12px rgba(2,132,199,0.3);">تأكيد النسخ 📋</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existing = document.getElementById('copyPermModalOverlay');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function executeCopyPermissions(targetIdx) {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية إدارة وصلاحيات المستخدمين!", "error");
    }
    const select = document.getElementById('sourceUserSelect');
    if (!select) return;
    const sourceId = select.value;
    const sourceUser = users.find(u => String(u.id) === String(sourceId));
    const targetUser = users[targetIdx];

    if (!sourceUser || !targetUser) return;

    // نسخ الصلاحيات والدور بعمق (مع حماية رتبة المدير الأساسي رقم 1 من الانخفاض)
    if (targetUser.id !== 1 && targetUser.id !== '1') {
        targetUser.role = sourceUser.role;
    }
    targetUser.permissions = JSON.parse(JSON.stringify(sourceUser.permissions || {}));
    if (sourceUser.maxDiscountPercent !== undefined) {
        targetUser.maxDiscountPercent = sourceUser.maxDiscountPercent;
    }

    saveData();
    renderUsersTable();
    const modal = document.getElementById('copyPermModalOverlay');
    if (modal) modal.remove();

    showToast(`✅ تم نسخ صلاحيات (${sourceUser.name}) إلى (${targetUser.name}) بنجاح!`, "success");
    if (typeof logAuditAction === 'function') logAuditAction('نسخ صلاحيات', `من: ${sourceUser.name} إلى: ${targetUser.name}`);
}

function populateUserSpecificWarehouseSelect() {
    const sel = document.getElementById('newUserSpecificWarehouse');
    if (!sel) return;
    const list = (typeof warehouses !== 'undefined' && Array.isArray(warehouses)) ? warehouses : [{ name: 'المخزن الرئيسي' }];
    sel.innerHTML = list.map(w => `<option value="${w.name}">${w.name}</option>`).join('');
}
window.populateUserSpecificWarehouseSelect = populateUserSpecificWarehouseSelect;

function onUserWarehouseScopeChange(scope) {
    const grp = document.getElementById('newUserSpecificWarehouseGroup');
    if (!grp) return;
    if (scope === 'specific') {
        populateUserSpecificWarehouseSelect();
        grp.style.display = 'block';
    } else {
        grp.style.display = 'none';
    }
}
window.onUserWarehouseScopeChange = onUserWarehouseScopeChange;

function addUser() {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية إدارة وصلاحيات المستخدمين!", "error");
    }
    const name = document.getElementById('newUserName').value.trim();
    const pin = document.getElementById('newUserPin').value.trim();
    let role = document.getElementById('newUserRole').value;
    const nfcUid = (document.getElementById('newUserNfcUid') ? document.getElementById('newUserNfcUid').value.trim() : '');
    const warehouseScope = document.getElementById('newUserWarehouseScope') ? document.getElementById('newUserWarehouseScope').value : 'all';
    const invoiceScope = document.getElementById('newUserInvoiceScope') ? document.getElementById('newUserInvoiceScope').value : (role === 'admin' ? 'all' : 'user_only');
    const assignedWarehouse = (warehouseScope === 'specific' && document.getElementById('newUserSpecificWarehouse'))
        ? document.getElementById('newUserSpecificWarehouse').value
        : (warehouseScope === 'main' ? 'المخزن الرئيسي' : '');

    if (!name || !pin) return showToast("⚠️ يرجى إدخال اسم المستخدم ورمز الدخول", "error");

    const duplicateNameUser = users.find(u => u.name && u.name.trim().toLowerCase() === name.toLowerCase() && u.id !== (window.editingUserId || 0));
    if (duplicateNameUser) {
        return showToast(`🚫 اسم الموظف (${name}) مستخدم بالفعل لموظف آخر!`, "error");
    }

    const duplicatePinUser = users.find(u => u.pin === pin && u.id !== (window.editingUserId || 0));
    if (duplicatePinUser) {
        return showToast(`🚫 رمز الدخول PIN (${pin}) مستخدم بالفعل للموظف (${duplicatePinUser.name})!`, "error");
    }

    if (window.editingUserId === 1 || window.editingUserId === '1') {
        role = 'admin'; // حماية رتبة مدير النظام الأساسي من التخفيض
    }

    if (nfcUid) {
        const existingUser = users.find(u => u.nfcUid === nfcUid && u.id !== window.editingUserId);
        if (existingUser) return showToast(`🚫 كارت NFC (${nfcUid}) مربوط بالفعل بموظف آخر (${existingUser.name})!`, "error");
    }

    const canReceipt = document.getElementById('perm_sec_receipt') ? document.getElementById('perm_sec_receipt').checked : false;
    const canDisburse = document.getElementById('perm_sec_disburse') ? document.getElementById('perm_sec_disburse').checked : false;
    const canPurReturn = document.getElementById('perm_sec_pur_return') ? document.getElementById('perm_sec_pur_return').checked : false;
    const canWarehouseReport = document.getElementById('perm_sec_warehouse_report') ? document.getElementById('perm_sec_warehouse_report').checked : false;
    const canTreasury = document.getElementById('perm_sec_treasury') ? document.getElementById('perm_sec_treasury').checked : false;

    let isHideProfits = false;
    if (role === 'admin') {
        const adminEl = document.getElementById('adminHideProfits');
        if (adminEl) isHideProfits = adminEl.checked;
    } else {
        const permEl = document.getElementById('perm_ui_hide_profits');
        if (permEl) isHideProfits = permEl.checked;
    }

    let isHideDrawerBalance = false;
    if (role === 'admin') {
        const adminEl = document.getElementById('adminHideDrawerBalance');
        if (adminEl) isHideDrawerBalance = adminEl.checked;
    } else {
        const permEl = document.getElementById('perm_ui_hide_drawer_balance');
        const permGenEl = document.getElementById('perm_gen_drawer_balance');
        if (permEl) {
            isHideDrawerBalance = permEl.checked;
        } else if (permGenEl) {
            isHideDrawerBalance = !permGenEl.checked;
        }
    }

    const permissions = {
        docs: {
            add: document.getElementById('perm_docs_add') ? document.getElementById('perm_docs_add').checked : true,
            purchase: document.getElementById('perm_docs_purchase') ? document.getElementById('perm_docs_purchase').checked : false,
            return: document.getElementById('perm_docs_return') ? document.getElementById('perm_docs_return').checked : false,
            purchase_return: canPurReturn,
            purchase_price: document.getElementById('perm_docs_purchase_price') ? document.getElementById('perm_docs_purchase_price').checked : false,
            edit: document.getElementById('perm_docs_edit') ? document.getElementById('perm_docs_edit').checked : false,
            delete: document.getElementById('perm_docs_delete') ? document.getElementById('perm_docs_delete').checked : false,
            view: document.getElementById('perm_docs_view') ? document.getElementById('perm_docs_view').checked : true,
            price_edit: document.getElementById('perm_docs_price_edit') ? document.getElementById('perm_docs_price_edit').checked : false,
            discount: document.getElementById('perm_docs_discount') ? document.getElementById('perm_docs_discount').checked : true,
            tax: document.getElementById('perm_docs_tax') ? document.getElementById('perm_docs_tax').checked : true
        },
        stock: {
            add: document.getElementById('perm_stock_add') ? document.getElementById('perm_stock_add').checked : false,
            edit: document.getElementById('perm_stock_edit') ? document.getElementById('perm_stock_edit').checked : false,
            delete: document.getElementById('perm_stock_delete') ? document.getElementById('perm_stock_delete').checked : false,
            transfer: document.getElementById('perm_stock_transfer') ? document.getElementById('perm_stock_transfer').checked : false,
            view: document.getElementById('perm_stock_view') ? document.getElementById('perm_stock_view').checked : false,
            adjust: document.getElementById('perm_stock_adjust') ? document.getElementById('perm_stock_adjust').checked : false,
            history: document.getElementById('perm_stock_history') ? document.getElementById('perm_stock_history').checked : false,
            inquiry: document.getElementById('perm_stock_inquiry') ? document.getElementById('perm_stock_inquiry').checked : false,
            warehouse_report: canWarehouseReport
        },
        accounts: {
            add: document.getElementById('perm_acc_add') ? document.getElementById('perm_acc_add').checked : false,
            receipt: canReceipt,
            disbursement: canDisburse,
            edit: document.getElementById('perm_acc_edit') ? document.getElementById('perm_acc_edit').checked : false,
            delete: document.getElementById('perm_acc_delete') ? document.getElementById('perm_acc_delete').checked : false,
            statement: document.getElementById('perm_acc_statement') ? document.getElementById('perm_acc_statement').checked : false,
            treasury: canTreasury,
            view: document.getElementById('perm_acc_view') ? document.getElementById('perm_acc_view').checked : false
        },
        general: {
            reports: document.getElementById('perm_gen_reports') ? document.getElementById('perm_gen_reports').checked : false,
            profits: !isHideProfits,
            hideProfits: isHideProfits,
            drawerBalance: !isHideDrawerBalance,
            hideDrawerBalance: isHideDrawerBalance,
            lockDailyUser: (role === 'admin') ? false : (document.getElementById('perm_gen_lock_daily_user') ? document.getElementById('perm_gen_lock_daily_user').checked : true),
            lockDailyDate: (role === 'admin') ? false : (document.getElementById('perm_gen_lock_daily_date') ? document.getElementById('perm_gen_lock_daily_date').checked : true),
            lockDailyAmounts: (role === 'admin') ? false : (document.getElementById('perm_gen_lock_daily_amounts') ? document.getElementById('perm_gen_lock_daily_amounts').checked : true),
            hideShare: (role === 'admin' && document.getElementById('adminHideShare')) ? document.getElementById('adminHideShare').checked : (document.getElementById('perm_ui_hide_share') ? document.getElementById('perm_ui_hide_share').checked : false),
            hideNew: (role === 'admin' && document.getElementById('adminHideNew')) ? document.getElementById('adminHideNew').checked : (document.getElementById('perm_ui_hide_new') ? document.getElementById('perm_ui_hide_new').checked : false),
            settings: document.getElementById('perm_gen_settings') ? document.getElementById('perm_gen_settings').checked : false,
            shortcuts: document.getElementById('perm_gen_shortcuts') ? document.getElementById('perm_gen_shortcuts').checked : false,
            users: document.getElementById('perm_gen_users') ? document.getElementById('perm_gen_users').checked : false
        }
    };

    const existingTarget = window.editingUserId ? users.find(u => u.id === window.editingUserId) : null;
    const isFrozen = existingTarget ? !!existingTarget.isFrozen : false;

    let maxDiscountPercent = 5;
    let maxAdditionPercent = 15;
    let lockPriceEdit = false;

    if (role === 'admin') {
        maxDiscountPercent = document.getElementById('adminMaxDiscount')
            ? Math.max(0, Math.min(100, parseFloat(document.getElementById('adminMaxDiscount').value) || 0))
            : 100;
        maxAdditionPercent = document.getElementById('adminMaxAddition')
            ? Math.max(0, Math.min(100, parseFloat(document.getElementById('adminMaxAddition').value) || 0))
            : 100;
        lockPriceEdit = document.getElementById('adminLockPriceEdit') ? document.getElementById('adminLockPriceEdit').checked : false;
    } else {
        maxDiscountPercent = document.getElementById('newUserMaxDiscount') 
            ? Math.max(0, Math.min(100, parseFloat(document.getElementById('newUserMaxDiscount').value) || 0)) 
            : 5;
        maxAdditionPercent = document.getElementById('newUserMaxAddition') 
            ? Math.max(0, Math.min(100, parseFloat(document.getElementById('newUserMaxAddition').value) || 0)) 
            : 15;
        lockPriceEdit = document.getElementById('perm_docs_price_edit') ? !document.getElementById('perm_docs_price_edit').checked : true;
    }

    const newUser = { 
        id: window.editingUserId || Date.now(), 
        name, 
        pin, 
        role, 
        nfcUid: nfcUid || '',
        isFrozen: isFrozen,
        warehouseScope,
        assignedWarehouse,
        invoiceScope,
        maxDiscountPercent,
        maxAdditionPercent,
        lockPriceEdit,
        permissions 
    };

    const isUpdating = !!window.editingUserId;
    if (window.editingUserId) {
        const idx = users.findIndex(u => u.id === window.editingUserId);
        if (idx !== -1) users[idx] = newUser;
        window.editingUserId = null;
        showToast("✅ تم تحديث بيانات الموظف بنجاح", "success");
    } else {
        users.push(newUser);
        showToast("✅ تم إضافة الموظف الجديد بنجاح", "success");
    }

    // مزامنة فورية للجلسة الحالية إذا قام المستخدم بتعديل بيانات حسابه المفتوح
    if (currentUser && (currentUser.id === newUser.id || currentUser.name === newUser.name)) {
        currentUser = { ...currentUser, ...newUser };
        window.currentUser = currentUser;
        if (typeof setStore === 'function') {
            setStore('pos_session_user', JSON.stringify(currentUser));
        }
    }

    window.users = users;
    saveData();
    renderUsersTable();
    hideUserFormCard();
    if (typeof applyPermissions === 'function') applyPermissions();
    if (typeof updateLoginUsersList === 'function') updateLoginUsersList();
    
    if (typeof logAuditAction === 'function') logAuditAction(isUpdating ? 'تحديث موظف' : 'إضافة موظف جديد', `الاسم: ${newUser.name}, الدور: ${newUser.role}, المخزن: ${warehouseScope === 'specific' ? assignedWarehouse : (warehouseScope === 'main' ? 'الرئيسي فقط' : 'كافة المخازن')}`);
    if (typeof syncUsersToCloud === 'function') syncUsersToCloud();
}

function toggleAdminPermsUI(role) {
    const container = document.getElementById('permPanelsContainer');
    const msg = document.getElementById('adminFullAccessMsg');
    const adminNotice = document.getElementById('adminNotice');
    const restrictionsBox = document.getElementById('userCashierRestrictionsBox');
    
    if (role === 'admin') {
        if (container) container.style.display = 'none';
        if (msg) msg.style.display = 'block';
        if (adminNotice) adminNotice.style.display = 'block';
        if (restrictionsBox) restrictionsBox.style.display = 'none';
    } else {
        if (container) container.style.display = 'block';
        if (msg) msg.style.display = 'none';
        if (adminNotice) adminNotice.style.display = 'none';
        if (restrictionsBox) restrictionsBox.style.display = 'grid';
    }
}

window.editingUserId = null;
function editUser(idx) {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية تعديل بيانات المستخدمين!", "error");
    }
    const u = users[idx];
    if (!u) return;
    window.editingUserId = u.id;
    document.getElementById('newUserName').value = u.name;
    document.getElementById('newUserPin').value = u.pin;
    document.getElementById('newUserRole').value = u.role;
    if (document.getElementById('newUserNfcUid')) {
        document.getElementById('newUserNfcUid').value = u.nfcUid || '';
    }

    const scopeEl = document.getElementById('newUserWarehouseScope');
    if (scopeEl) {
        scopeEl.value = u.warehouseScope || 'all';
        onUserWarehouseScopeChange(scopeEl.value);
        if (u.warehouseScope === 'specific' && u.assignedWarehouse) {
            const specificSel = document.getElementById('newUserSpecificWarehouse');
            if (specificSel) specificSel.value = u.assignedWarehouse;
        }
    }

    const invScopeEl = document.getElementById('newUserInvoiceScope');
    if (invScopeEl) {
        invScopeEl.value = u.invoiceScope || (u.role === 'admin' ? 'all' : 'user_only');
        if (typeof updateInvoiceScopeHelpHint === 'function') {
            updateInvoiceScopeHelpHint(invScopeEl.value);
        }
    }

    toggleAdminPermsUI(u.role);

    const p = u.permissions || {};
    if (p.docs) {
        document.getElementById('perm_docs_add').checked = !!p.docs.add;
        if (document.getElementById('perm_docs_purchase')) document.getElementById('perm_docs_purchase').checked = !!p.docs.purchase;
        if (document.getElementById('perm_docs_return')) document.getElementById('perm_docs_return').checked = !!p.docs.return;
        if (document.getElementById('perm_sec_pur_return')) {
            document.getElementById('perm_sec_pur_return').checked = (p.docs.purchase_return !== undefined) ? !!p.docs.purchase_return : !!(p.docs.purchase || p.docs.return);
        }
        document.getElementById('perm_docs_purchase_price').checked = !!p.docs.purchase_price;
        document.getElementById('perm_docs_edit').checked = !!p.docs.edit;
        document.getElementById('perm_docs_delete').checked = !!p.docs.delete;
        document.getElementById('perm_docs_view').checked = !!p.docs.view;
        if (document.getElementById('perm_docs_price_edit')) document.getElementById('perm_docs_price_edit').checked = !!p.docs.price_edit;
        if (document.getElementById('perm_docs_discount')) document.getElementById('perm_docs_discount').checked = (p.docs.discount !== undefined) ? !!p.docs.discount : true;
        if (document.getElementById('perm_docs_tax')) document.getElementById('perm_docs_tax').checked = (p.docs.tax !== undefined) ? !!p.docs.tax : true;
    } else {
        if (document.getElementById('perm_docs_price_edit')) document.getElementById('perm_docs_price_edit').checked = false;
        if (document.getElementById('perm_docs_discount')) document.getElementById('perm_docs_discount').checked = true;
        if (document.getElementById('perm_docs_tax')) document.getElementById('perm_docs_tax').checked = true;
    }

    if (document.getElementById('newUserMaxDiscount')) {
        document.getElementById('newUserMaxDiscount').value = (u.maxDiscountPercent !== undefined) ? u.maxDiscountPercent : 5;
    }
    if (document.getElementById('newUserMaxAddition')) {
        document.getElementById('newUserMaxAddition').value = (u.maxAdditionPercent !== undefined) ? u.maxAdditionPercent : 15;
    }
    if (document.getElementById('adminMaxDiscount')) {
        document.getElementById('adminMaxDiscount').value = (u.maxDiscountPercent !== undefined) ? u.maxDiscountPercent : 100;
    }
    if (document.getElementById('adminMaxAddition')) {
        document.getElementById('adminMaxAddition').value = (u.maxAdditionPercent !== undefined) ? u.maxAdditionPercent : 100;
    }
    if (document.getElementById('adminLockPriceEdit')) {
        document.getElementById('adminLockPriceEdit').checked = !!u.lockPriceEdit;
    }
    if (p.stock) {
        document.getElementById('perm_stock_add').checked = !!p.stock.add;
        document.getElementById('perm_stock_edit').checked = !!p.stock.edit;
        document.getElementById('perm_stock_delete').checked = !!p.stock.delete;
        document.getElementById('perm_stock_transfer').checked = !!p.stock.transfer;
        document.getElementById('perm_stock_view').checked = !!p.stock.view;
        if (document.getElementById('perm_stock_adjust')) {
            document.getElementById('perm_stock_adjust').checked = (p.stock.adjust !== undefined) ? !!p.stock.adjust : (!!p.stock.edit || !!p.stock.transfer);
        }
        if (document.getElementById('perm_stock_history')) {
            document.getElementById('perm_stock_history').checked = (p.stock.history !== undefined) ? !!p.stock.history : !!p.stock.view;
        }
        if (document.getElementById('perm_stock_inquiry')) {
            document.getElementById('perm_stock_inquiry').checked = (p.stock.inquiry !== undefined) ? !!p.stock.inquiry : !!p.stock.view;
        }
        if (document.getElementById('perm_sec_warehouse_report')) {
            document.getElementById('perm_sec_warehouse_report').checked = (p.stock.warehouse_report !== undefined) ? !!p.stock.warehouse_report : !!p.stock.view;
        }
    }
    if (p.accounts) {
        document.getElementById('perm_acc_add').checked = !!p.accounts.add;
        if (document.getElementById('perm_sec_receipt')) {
            document.getElementById('perm_sec_receipt').checked = (p.accounts.receipt !== undefined) ? !!p.accounts.receipt : !!p.accounts.add;
        }
        if (document.getElementById('perm_sec_disburse')) {
            document.getElementById('perm_sec_disburse').checked = (p.accounts.disbursement !== undefined) ? !!p.accounts.disbursement : !!p.accounts.add;
        }
        document.getElementById('perm_acc_edit').checked = !!p.accounts.edit;
        document.getElementById('perm_acc_delete').checked = !!p.accounts.delete;
        document.getElementById('perm_acc_statement').checked = !!p.accounts.statement;
        if (document.getElementById('perm_sec_treasury')) {
            document.getElementById('perm_sec_treasury').checked = (p.accounts.treasury !== undefined) ? !!p.accounts.treasury : false;
        }
        document.getElementById('perm_acc_view').checked = !!p.accounts.view;
    }
    if (p.general) {
        document.getElementById('perm_gen_reports').checked = !!p.general.reports;
        document.getElementById('perm_gen_profits').checked = !!p.general.profits;
        document.getElementById('perm_gen_settings').checked = !!p.general.settings;
        if (document.getElementById('perm_gen_shortcuts')) {
            document.getElementById('perm_gen_shortcuts').checked = (p.general.shortcuts !== undefined) ? !!p.general.shortcuts : !!p.general.settings;
        }
        document.getElementById('perm_gen_users').checked = !!p.general.users;
    }

    const isProfitsHidden = (p.general && p.general.hideProfits !== undefined) 
        ? !!p.general.hideProfits 
        : ((p.general && p.general.profits !== undefined) ? !p.general.profits : false);

    const adminHideProfitsEl = document.getElementById('adminHideProfits');
    if (adminHideProfitsEl) {
        adminHideProfitsEl.checked = isProfitsHidden;
    }
    const permHideProfitsEl = document.getElementById('perm_ui_hide_profits');
    if (permHideProfitsEl) {
        permHideProfitsEl.checked = isProfitsHidden;
    }
    const adminHideShareEl = document.getElementById('adminHideShare');
    if (adminHideShareEl) {
        adminHideShareEl.checked = (p.general && p.general.hideShare !== undefined) ? !!p.general.hideShare : false;
    }
    const adminHideNewEl = document.getElementById('adminHideNew');
    if (adminHideNewEl) {
        adminHideNewEl.checked = (p.general && p.general.hideNew !== undefined) ? !!p.general.hideNew : false;
    }

    const permHideShareEl = document.getElementById('perm_ui_hide_share');
    if (permHideShareEl) {
        permHideShareEl.checked = (p.general && p.general.hideShare !== undefined) ? !!p.general.hideShare : false;
    }
    const permHideNewEl = document.getElementById('perm_ui_hide_new');
    if (permHideNewEl) {
        permHideNewEl.checked = (p.general && p.general.hideNew !== undefined) ? !!p.general.hideNew : false;
    }

    const isDrawerBalanceHidden = (p.general && p.general.hideDrawerBalance !== undefined)
        ? !!p.general.hideDrawerBalance
        : ((p.general && p.general.drawerBalance !== undefined) ? !p.general.drawerBalance : false);

    const adminHideDrawerBalanceEl = document.getElementById('adminHideDrawerBalance');
    if (adminHideDrawerBalanceEl) adminHideDrawerBalanceEl.checked = isDrawerBalanceHidden;
    const permHideDrawerBalanceEl = document.getElementById('perm_ui_hide_drawer_balance');
    if (permHideDrawerBalanceEl) permHideDrawerBalanceEl.checked = isDrawerBalanceHidden;
    const permGenDrawerBalanceEl = document.getElementById('perm_gen_drawer_balance');
    if (permGenDrawerBalanceEl) permGenDrawerBalanceEl.checked = !isDrawerBalanceHidden;

    const lockDailyUserEl = document.getElementById('perm_gen_lock_daily_user');
    if (lockDailyUserEl) {
        lockDailyUserEl.checked = (p.general && p.general.lockDailyUser !== undefined) ? !!p.general.lockDailyUser : (u.role !== 'admin');
    }
    const lockDailyDateEl = document.getElementById('perm_gen_lock_daily_date');
    if (lockDailyDateEl) {
        lockDailyDateEl.checked = (p.general && p.general.lockDailyDate !== undefined) ? !!p.general.lockDailyDate : (u.role !== 'admin');
    }
    const lockDailyAmountsEl = document.getElementById('perm_gen_lock_daily_amounts');
    if (lockDailyAmountsEl) {
        lockDailyAmountsEl.checked = (p.general && p.general.lockDailyAmounts !== undefined) ? !!p.general.lockDailyAmounts : (u.role !== 'admin');
    }
    
    const formCard = document.getElementById('userFormCard');
    const titleEl = document.getElementById('userFormCardTitle');
    if (titleEl) titleEl.innerHTML = '✏️ تعديل بيانات وصلاحيات الموظف: <span style="color:#38bdf8; margin-right: 6px;">' + u.name + '</span>';
    
    if (typeof switchPermCategory === 'function') switchPermCategory('sales');

    if (formCard) {
        formCard.classList.remove('hidden');
        formCard.style.setProperty('display', 'flex', 'important');
    }

    showToast("✏️ جاري تعديل بيانات " + u.name, "info");
}

function resetUserForm() {
    window.editingUserId = null;
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserPin').value = '';
    document.getElementById('newUserRole').value = 'user';
    if (document.getElementById('newUserNfcUid')) {
        document.getElementById('newUserNfcUid').value = '';
    }
    const scopeEl = document.getElementById('newUserWarehouseScope');
    if (scopeEl) {
        scopeEl.value = 'all';
        onUserWarehouseScopeChange('all');
    }
    const invScopeEl = document.getElementById('newUserInvoiceScope');
    if (invScopeEl) {
        invScopeEl.value = 'user_only';
        if (typeof updateInvoiceScopeHelpHint === 'function') {
            updateInvoiceScopeHelpHint('user_only');
        }
    }
    if (typeof applyPermissionPreset === 'function') {
        applyPermissionPreset('cashier_only', true);
    }
    if (document.getElementById('newUserMaxDiscount')) document.getElementById('newUserMaxDiscount').value = '5';
    if (document.getElementById('newUserMaxAddition')) document.getElementById('newUserMaxAddition').value = '15';
    if (document.getElementById('adminMaxDiscount')) document.getElementById('adminMaxDiscount').value = '100';
    if (document.getElementById('adminMaxAddition')) document.getElementById('adminMaxAddition').value = '100';
    if (document.getElementById('adminLockPriceEdit')) document.getElementById('adminLockPriceEdit').checked = false;
    if (document.getElementById('adminHideProfits')) document.getElementById('adminHideProfits').checked = false;
    if (document.getElementById('perm_ui_hide_profits')) document.getElementById('perm_ui_hide_profits').checked = false;
    if (document.getElementById('adminHideShare')) document.getElementById('adminHideShare').checked = false;
    if (document.getElementById('adminHideNew')) document.getElementById('adminHideNew').checked = false;
    if (document.getElementById('perm_ui_hide_share')) document.getElementById('perm_ui_hide_share').checked = false;
    if (document.getElementById('perm_ui_hide_new')) document.getElementById('perm_ui_hide_new').checked = false;
    if (document.getElementById('adminHideDrawerBalance')) document.getElementById('adminHideDrawerBalance').checked = false;
    if (document.getElementById('perm_ui_hide_drawer_balance')) document.getElementById('perm_ui_hide_drawer_balance').checked = false;
    if (document.getElementById('perm_gen_drawer_balance')) document.getElementById('perm_gen_drawer_balance').checked = true;
    if (document.getElementById('perm_gen_lock_daily_user')) document.getElementById('perm_gen_lock_daily_user').checked = true;
    if (document.getElementById('perm_gen_lock_daily_date')) document.getElementById('perm_gen_lock_daily_date').checked = true;
    if (document.getElementById('perm_gen_lock_daily_amounts')) document.getElementById('perm_gen_lock_daily_amounts').checked = true;
    if (typeof switchPermCategory === 'function') {
        switchPermCategory('sales');
    }
}

function switchPermCategory(category) {
    const panels = {
        sales: document.getElementById('permCategory_sales'),
        accounts: document.getElementById('permCategory_accounts'),
        stock: document.getElementById('permCategory_stock'),
        system: document.getElementById('permCategory_system')
    };
    const btns = {
        sales: document.getElementById('tabBtn_sales'),
        accounts: document.getElementById('tabBtn_accounts'),
        stock: document.getElementById('tabBtn_stock'),
        system: document.getElementById('tabBtn_system'),
        all: document.getElementById('tabBtn_all')
    };

    Object.values(btns).forEach(btn => {
        if (btn) {
            btn.style.background = '#f8fafc';
            btn.style.color = '#475569';
            btn.style.borderColor = '#cbd5e1';
            btn.classList.remove('active');
        }
    });

    if (category === 'all') {
        Object.values(panels).forEach(p => { if (p) p.style.display = 'block'; });
        if (btns.all) {
            btns.all.style.background = '#0284c7';
            btns.all.style.color = '#ffffff';
            btns.all.style.borderColor = '#0284c7';
            btns.all.classList.add('active');
        }
    } else {
        Object.keys(panels).forEach(k => {
            if (panels[k]) panels[k].style.display = (k === category) ? 'block' : 'none';
        });
        if (btns[category]) {
            btns[category].style.background = '#0284c7';
            btns[category].style.color = '#ffffff';
            btns[category].style.borderColor = '#0284c7';
            btns[category].classList.add('active');
        }
    }
}
window.switchPermCategory = switchPermCategory;

function applyPermissionPreset(presetKey, silent = false) {
    const setChecked = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    };

    const maxDiscountEl = document.getElementById('newUserMaxDiscount');
    const priceEditEl = document.getElementById('perm_docs_price_edit');

    if (presetKey === 'cashier_only') {
        // كاشير مبيعات: بيع، مرتجع، سند قبض، سجل الفواتير، تقارير يومية
        toggleAllUserSections(false, true);
        setChecked('perm_docs_add', true);
        setChecked('perm_docs_return', true);
        setChecked('perm_sec_receipt', true);
        setChecked('perm_docs_view', true);
        setChecked('perm_gen_reports', true);
        setChecked('perm_docs_discount', true);
        setChecked('perm_docs_tax', true);
        setChecked('perm_gen_lock_daily_user', true);
        setChecked('perm_gen_lock_daily_date', true);
        setChecked('perm_gen_lock_daily_amounts', true);

        const maxAdditionEl = document.getElementById('newUserMaxAddition');
        if (priceEditEl) priceEditEl.checked = false;
        if (maxDiscountEl) maxDiscountEl.value = '5';
        if (maxAdditionEl) maxAdditionEl.value = '15';
        const invScopeEl = document.getElementById('newUserInvoiceScope');
        if (invScopeEl) {
            invScopeEl.value = 'user_only';
            if (typeof updateInvoiceScopeHelpHint === 'function') updateInvoiceScopeHelpHint('user_only');
        }
        if (!silent && typeof showToast === 'function') showToast("🛒 تم تفعيل أقسام: كاشير مبيعات (بيع ومرتجع وقبض مع حصر فواتيره فقط)", "success");

    } else if (presetKey === 'stock_manager') {
        // أمين مخزن: المخزن وبضاعة الأصناف، أرصدة المخازن، فواتير الشراء، مرتجع الشراء، تسوية، حركة صنف، تحويل، استعلام
        toggleAllUserSections(false, true);
        setChecked('perm_stock_view', true);
        setChecked('perm_sec_warehouse_report', true);
        setChecked('perm_stock_add', true);
        setChecked('perm_stock_edit', true);
        setChecked('perm_stock_adjust', true);
        setChecked('perm_stock_history', true);
        setChecked('perm_stock_transfer', true);
        setChecked('perm_stock_inquiry', true);
        setChecked('perm_docs_purchase', true);
        setChecked('perm_sec_pur_return', true);
        setChecked('perm_docs_view', true);
        setChecked('perm_docs_purchase_price', false);
        setChecked('perm_gen_profits', false);

        const maxAdditionEl = document.getElementById('newUserMaxAddition');
        if (priceEditEl) priceEditEl.checked = false;
        if (maxDiscountEl) maxDiscountEl.value = '0';
        if (maxAdditionEl) maxAdditionEl.value = '0';
        if (!silent && typeof showToast === 'function') showToast("📦 تم تفعيل أقسام: أمين مخزن (مخازن وبضاعة ومشتريات)", "success");

    } else if (presetKey === 'accountant') {
        // محاسب مالي: حسابات، سندات قبض وصرف، فواتير، تقارير، أرباح، أرصدة مخازن، كشف حساب
        toggleAllUserSections(false, true);
        setChecked('perm_sec_receipt', true);
        setChecked('perm_sec_disburse', true);
        setChecked('perm_acc_view', true);
        setChecked('perm_acc_add', true);
        setChecked('perm_acc_statement', true);
        setChecked('perm_sec_treasury', true);
        setChecked('perm_docs_view', true);
        setChecked('perm_docs_add', true);
        setChecked('perm_docs_return', true);
        setChecked('perm_docs_purchase', true);
        setChecked('perm_sec_warehouse_report', true);
        setChecked('perm_gen_reports', true);
        setChecked('perm_gen_profits', true);
        setChecked('perm_docs_purchase_price', true);

        const maxAdditionEl = document.getElementById('newUserMaxAddition');
        if (priceEditEl) priceEditEl.checked = true;
        if (maxDiscountEl) maxDiscountEl.value = '10';
        if (maxAdditionEl) maxAdditionEl.value = '20';
        if (!silent && typeof showToast === 'function') showToast("💼 تم تفعيل أقسام: محاسب مالي (حسابات وقبض وصرف وأرباح)", "success");
    }
}
window.applyPermissionPreset = applyPermissionPreset;

function toggleAllUserSections(checked, silent = false) {
    const ids = [
        'perm_docs_add', 'perm_docs_return', 'perm_docs_purchase', 'perm_sec_pur_return', 'perm_docs_view',
        'perm_sec_receipt', 'perm_sec_disburse', 'perm_acc_view', 'perm_acc_add', 'perm_acc_statement', 'perm_sec_treasury',
        'perm_stock_view', 'perm_stock_add', 'perm_stock_edit', 'perm_stock_adjust', 'perm_stock_history',
        'perm_stock_transfer', 'perm_sec_warehouse_report', 'perm_stock_inquiry',
        'perm_gen_reports', 'perm_gen_profits', 'perm_gen_settings', 'perm_gen_shortcuts'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = !!checked;
    });
    if (document.getElementById('perm_docs_discount')) document.getElementById('perm_docs_discount').checked = !!checked;
    if (document.getElementById('perm_docs_tax')) document.getElementById('perm_docs_tax').checked = !!checked;
    if (!silent && typeof showToast === 'function') showToast(checked ? "✔️ تم تحديد كافة الأقسام للموظف" : "❌ تم إلغاء تحديد كافة الأقسام", "info");
}
window.toggleAllUserSections = toggleAllUserSections;

function quickSelectUserPreset(presetKey) {
    if (presetKey === 'admin') {
        const roleEl = document.getElementById('newUserRole');
        if (roleEl) roleEl.value = 'admin';
        toggleAdminPermsUI('admin');
        if (document.getElementById('adminHideProfits')) document.getElementById('adminHideProfits').checked = false;
        if (document.getElementById('adminHideShare')) document.getElementById('adminHideShare').checked = false;
        if (document.getElementById('adminHideNew')) document.getElementById('adminHideNew').checked = false;
        if (document.getElementById('adminMaxDiscount')) document.getElementById('adminMaxDiscount').value = '100';
        if (document.getElementById('adminMaxAddition')) document.getElementById('adminMaxAddition').value = '100';
        if (document.getElementById('adminLockPriceEdit')) document.getElementById('adminLockPriceEdit').checked = false;
        const maxDiscountEl = document.getElementById('newUserMaxDiscount');
        if (maxDiscountEl) maxDiscountEl.value = '100';
        const maxAdditionEl = document.getElementById('newUserMaxAddition');
        if (maxAdditionEl) maxAdditionEl.value = '100';
        const priceEditEl = document.getElementById('perm_docs_price_edit');
        if (priceEditEl) priceEditEl.checked = true;
        const invScopeEl = document.getElementById('newUserInvoiceScope');
        if (invScopeEl) {
            invScopeEl.value = 'all';
            if (typeof updateInvoiceScopeHelpHint === 'function') updateInvoiceScopeHelpHint('all');
        }
        if (document.getElementById('perm_gen_lock_daily_user')) document.getElementById('perm_gen_lock_daily_user').checked = false;
        if (document.getElementById('perm_gen_lock_daily_date')) document.getElementById('perm_gen_lock_daily_date').checked = false;
        toggleAllUserSections(true, true);
        if (typeof showToast === 'function') showToast("⭐ تم تطبيق قالب: مدير عام (كافة الأقسام والصلاحيات)", "success");
    } else {
        const roleEl = document.getElementById('newUserRole');
        if (roleEl) roleEl.value = 'user';
        toggleAdminPermsUI('user');
        applyPermissionPreset(presetKey, false);
    }
}
window.quickSelectUserPreset = quickSelectUserPreset;

function toggleUserPinVisibility() {
    const pinEl = document.getElementById('newUserPin');
    if (!pinEl) return;
    if (pinEl.type === 'password') {
        pinEl.type = 'text';
    } else {
        pinEl.type = 'password';
    }
}
window.toggleUserPinVisibility = toggleUserPinVisibility;

function showAddUserFormCard() {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية إضافة مستخدمين جدد!", "error");
    }
    resetUserForm();
    const formCard = document.getElementById('userFormCard');
    const titleEl = document.getElementById('userFormCardTitle');
    if (titleEl) titleEl.innerHTML = '➕ إضافة موظف جديد وتحديد الأقسام المصرّح بها';
    
    if (typeof switchPermCategory === 'function') switchPermCategory('sales');

    if (formCard) {
        formCard.classList.remove('hidden');
        formCard.style.setProperty('display', 'flex', 'important');
    }
}
window.showAddUserFormCard = showAddUserFormCard;

function hideUserFormCard() {
    resetUserForm();
    const formCard = document.getElementById('userFormCard');
    if (formCard) {
        formCard.classList.add('hidden');
        formCard.style.setProperty('display', 'none', 'important');
    }
}
window.hideUserFormCard = hideUserFormCard;

function updateInvoiceScopeHelpHint(val) {
    const hintContainer = document.getElementById('newUserInvoiceScopeHint');
    const hintText = document.getElementById('newUserInvoiceScopeHintText');
    if (!hintContainer || !hintText) return;

    const scopeDescriptions = {
        'all': {
            badge: 'وصول شامل',
            badgeBg: '#10b981',
            containerBg: '#ecfdf5',
            borderColor: '#a7f3d0',
            text: 'يشوف كل الفواتير (ممتاز لعمل المرتجعات والتعاون بين الكاشيرات)'
        },
        'user_only': {
            badge: 'حصر فواتيره',
            badgeBg: '#f59e0b',
            containerBg: '#fffbeb',
            borderColor: '#fde68a',
            text: 'يشوف فواتيره فقط وتختفي فواتير المدير تماماً عن عينيه'
        },
        'hide_admin': {
            badge: 'حجب الإدارة',
            badgeBg: '#3b82f6',
            containerBg: '#eff6ff',
            borderColor: '#bfdbfe',
            text: 'حجب فواتير الإدارة فقط ومشاركة فواتير باقي الموظفين للتعاون'
        },
        'terminal_only': {
            badge: 'حصر بالجهاز',
            badgeBg: '#8b5cf6',
            containerBg: '#f5f3ff',
            borderColor: '#ddd6fe',
            text: 'حصر الفواتير بجهاز هذا الكاشير فقط ومنع رؤية أجهزة غيره'
        },
        'warehouse_only': {
            badge: 'حصر بالفرع',
            badgeBg: '#06b6d4',
            containerBg: '#ecfeff',
            borderColor: '#a5f3fc',
            text: 'حصر الفواتير بمخزن وفرع هذا الموظف فقط وعزل بقية الفروع'
        },
        'hide_master': {
            badge: 'حجب السيرفر',
            badgeBg: '#ef4444',
            containerBg: '#fef2f2',
            borderColor: '#fecaca',
            text: 'حجب كمبيوتر السيرفر الرئيسي عن أجهزة التابلت والفرعيات'
        }
    };

    const info = scopeDescriptions[val] || scopeDescriptions['user_only'];
    hintContainer.style.background = info.containerBg;
    hintContainer.style.borderColor = info.borderColor;
    hintText.innerHTML = `<span style="display:inline-block; padding:2px 7px; border-radius:5px; background:${info.badgeBg}; color:#ffffff; font-size:0.75rem; font-weight:bold; margin-left:6px;">${info.badge}</span> <span style="color:#1e293b; font-weight:600;">${info.text}</span>`;
}
window.updateInvoiceScopeHelpHint = updateInvoiceScopeHelpHint;

function showInvoiceScopeHelpModal() {
    const htmlContent = `
        <div style="text-align: right; font-family: inherit; font-size: 0.88rem; display: flex; flex-direction: column; gap: 8px; margin-top: 8px; max-height: 60vh; overflow-y: auto; padding-left: 4px;">
            <div style="background: #ecfdf5; border-right: 4px solid #10b981; padding: 8px 12px; border-radius: 8px;">
                <div style="font-weight: 800; color: #047857; margin-bottom: 2px; font-size: 0.92rem;">🌐 كافة فواتير النظام (وصول شامل)</div>
                <div style="color: #065f46; font-size: 0.82rem; line-height: 1.4;">يشوف كل الفواتير (ممتاز لعمل المرتجعات والتعاون بين الكاشيرات)</div>
            </div>

            <div style="background: #fffbeb; border-right: 4px solid #f59e0b; padding: 8px 12px; border-radius: 8px;">
                <div style="font-weight: 800; color: #b45309; margin-bottom: 2px; font-size: 0.92rem;">👤 فواتير هذا الموظف فقط</div>
                <div style="color: #92400e; font-size: 0.82rem; line-height: 1.4;">يشوف فواتيره فقط وتختفي فواتير المدير تماماً عن عينيه</div>
            </div>

            <div style="background: #eff6ff; border-right: 4px solid #3b82f6; padding: 8px 12px; border-radius: 8px;">
                <div style="font-weight: 800; color: #1d4ed8; margin-bottom: 2px; font-size: 0.92rem;">🛡️ حجب فواتير المدير العام</div>
                <div style="color: #1e40af; font-size: 0.82rem; line-height: 1.4;">حجب فواتير الإدارة فقط ومشاركة فواتير باقي الموظفين للتعاون</div>
            </div>

            <div style="background: #f5f3ff; border-right: 4px solid #8b5cf6; padding: 8px 12px; border-radius: 8px;">
                <div style="font-weight: 800; color: #6d28d9; margin-bottom: 2px; font-size: 0.92rem;">💻 فواتير جهازه فقط (الكاشير الحالي)</div>
                <div style="color: #5b21b6; font-size: 0.82rem; line-height: 1.4;">حصر الفواتير بجهاز هذا الكاشير فقط ومنع رؤية أجهزة غيره</div>
            </div>

            <div style="background: #ecfeff; border-right: 4px solid #06b6d4; padding: 8px 12px; border-radius: 8px;">
                <div style="font-weight: 800; color: #0e7490; margin-bottom: 2px; font-size: 0.92rem;">🏢 فواتير فرعه ومخزنه فقط</div>
                <div style="color: #155e75; font-size: 0.82rem; line-height: 1.4;">حصر الفواتير بمخزن وفرع هذا الموظف فقط وعزل بقية الفروع</div>
            </div>

            <div style="background: #fef2f2; border-right: 4px solid #ef4444; padding: 8px 12px; border-radius: 8px;">
                <div style="font-weight: 800; color: #b91c1c; margin-bottom: 2px; font-size: 0.92rem;">🛡️ حجب فواتير الجهاز الرئيسي (Master)</div>
                <div style="color: #991b1b; font-size: 0.82rem; line-height: 1.4;">حجب كمبيوتر السيرفر الرئيسي عن أجهزة التابلت والفرعيات</div>
            </div>
        </div>
    `;

    if (typeof showCustomAlert === 'function') {
        showCustomAlert({
            type: 'info',
            titleText: 'دليل خيارات خصوصية الفواتير والمبيعات',
            msg: htmlContent,
            confirmText: 'فهمت ذلك ✔️',
            cardWidth: '550px'
        });
    } else {
        const old = document.getElementById('invScopeHelpOverlay');
        if (old) old.remove();
        const overlay = document.createElement('div');
        overlay.id = 'invScopeHelpOverlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px);';
        overlay.innerHTML = `
            <div style="background:#fff; border-radius:14px; padding:22px; max-width:540px; width:92%; box-shadow:0 12px 30px rgba(0,0,0,0.25); font-family:inherit;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                    <div style="font-weight:bold; font-size:1.05rem; color:#0f172a;">🔒 دليل خيارات خصوصية الفواتير</div>
                    <button onclick="document.getElementById('invScopeHelpOverlay').remove()" style="background:none; border:none; font-size:1.3rem; cursor:pointer; color:#64748b;">✕</button>
                </div>
                ${htmlContent}
                <div style="text-align:center; margin-top:16px;">
                    <button onclick="document.getElementById('invScopeHelpOverlay').remove()" style="background:#0284c7; color:#fff; border:none; padding:8px 24px; border-radius:8px; font-weight:bold; cursor:pointer;">فهمت ذلك ✔️</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
}
window.showInvoiceScopeHelpModal = showInvoiceScopeHelpModal;

if (typeof document !== 'undefined') {
    const initScopeHint = () => {
        const el = document.getElementById('newUserInvoiceScope');
        if (el && typeof updateInvoiceScopeHelpHint === 'function') updateInvoiceScopeHelpHint(el.value);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScopeHint);
    } else {
        setTimeout(initScopeHint, 100);
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('userFormCard');
        if (modal && (!modal.classList.contains('hidden') || modal.style.display !== 'none')) {
            hideUserFormCard();
        }
        const pinModal = document.getElementById('changePinModalOverlay');
        if (pinModal) pinModal.remove();
        const copyModal = document.getElementById('copyPermModalOverlay');
        if (copyModal) copyModal.remove();
    }
});

function deleteUser(idx) {
    if (typeof checkPermission === 'function' && !checkPermission('general_settings')) {
        return showToast("🚫 ليس لديك صلاحية حذف المستخدمين!", "error");
    }
    const u = users[idx];
    if (!u) return;

    if (u.id === 1 || u.id === '1' || u.role === 'admin' || u.name === 'المدير') {
        return showToast("🛡️ لا يمكن حذف حساب مدير النظام الرئيسي نهائياً!", "error");
    }

    if (users.length <= 1) {
        return showToast("⚠️ لا يمكن حذف آخر مستخدم في النظام!", "error");
    }

    if (currentUser && (currentUser.id === u.id || currentUser.pin === u.pin)) {
        return showToast("🚫 لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول به!", "error");
    }

    if (confirm(`هل أنت متأكد من حذف الموظف (${u.name}) نهائياً؟`)) {
        if (typeof addToTrash === 'function') addToTrash('user', u, `مستخدم: ${u.name}`);
        const deletedName = u.name;
        const deletedId = u.id;

        if (!window.deletedItemIds) window.deletedItemIds = {};
        if (!window.deletedItemIds.users) window.deletedItemIds.users = [];
        window.deletedItemIds.users.push(deletedId);

        users.splice(idx, 1);
        window.users = users;

        // حذف مباشر وفوري من جدول قاعدة البيانات SQLite لمنع أي بقاء له على القرص
        if (typeof db !== 'undefined' && db.users) {
            db.users.delete(deletedId).catch(e => console.warn("Direct db.users.delete notice:", e));
        }

        saveData();
        renderUsersTable();

        // تحديث فوري لقائمة المستخدمين في شاشة تسجيل الدخول بدون تسجيل خروج
        if (typeof updateLoginUsersList === 'function') {
            updateLoginUsersList();
        }

        if (typeof trashManager !== 'undefined' && trashManager.renderTrashTable) trashManager.renderTrashTable();

        if (typeof logAuditAction === 'function') logAuditAction('حذف مستخدم', `الاسم: ${deletedName}`);
        if (typeof syncUsersToCloud === 'function') syncUsersToCloud();
        showToast(`🗑️ تم حذف الموظف (${deletedName}) بنجاح`, "info");
    }
}

function switchPermTab(panelId, btn) {
    // تحديث الأزرار
    document.querySelectorAll('.perm-tab').forEach(t => {
        t.classList.remove('active');
        t.style.background = 'transparent';
        t.style.color = '#64748b';
        t.style.boxShadow = 'none';
    });
    
    // تحديث الألواح
    document.querySelectorAll('.perm-panel').forEach(p => {
        p.style.display = 'none';
    });

    // تفعيل المختار
    if (btn) {
        btn.classList.add('active');
        btn.style.background = 'white';
        btn.style.color = '#1e293b';
        btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)';
    }
    
    const target = document.getElementById('perm-panel-' + panelId);
    if (target) {
        target.style.display = 'grid';
    }
}

function resolvePermissionKey(action) {
    if (!action) return { module: '', perm: '' };
    let act = String(action).toLowerCase().trim();
    
    // توحيد المرادفات
    if (act === 'sec_receipt' || act === 'receipt') act = 'accounts_receipt';
    if (act === 'sec_disburse' || act === 'disburse' || act === 'disbursement') act = 'accounts_disbursement';
    if (act === 'sec_pur_return' || act === 'purchase-return' || act === 'purchase_return') act = 'docs_purchase_return';
    if (act === 'sec_warehouse_report' || act === 'warehouse_report' || act === 'warehouse-report') act = 'stock_warehouse_report';
    if (act === 'stock_adjust' || act === 'adjustment') act = 'stock_adjust';
    if (act === 'stock_history' || act === 'history' || act === 'item-history') act = 'stock_history';
    if (act === 'stock_inquiry' || act === 'product-inquiry') act = 'stock_inquiry';
    if (act === 'accounts_statement' || act === 'statement') act = 'accounts_statement';
    if (act === 'accounts_treasury' || act === 'sec_treasury' || act === 'treasury' || act === 'treasury-audit' || act === 'treasury_audit') act = 'accounts_treasury';
    if (act === 'general_shortcuts' || act === 'shortcuts') act = 'general_shortcuts';
    if (act === 'ui_hide_share' || act === 'hide_share') return { module: 'general', perm: 'hideShare' };
    if (act === 'ui_hide_new' || act === 'hide_new') return { module: 'general', perm: 'hideNew' };
    if (act.startsWith('acc_')) act = 'accounts_' + act.substring(4);
    if (act.startsWith('gen_')) act = 'general_' + act.substring(4);
    if (act.startsWith('products_')) act = 'stock_' + act.substring(9);
    if (act.startsWith('items_')) act = 'stock_' + act.substring(6);
    if (act.startsWith('invoices_')) act = 'docs_' + act.substring(9);

    const parts = act.split('_');
    const module = parts[0];
    const perm = parts.slice(1).join('_');
    return { module, perm };
}

function checkPermission(action) {
    // ✅ أمان: التحقق من صحة المستخدم عبر مصفوفة users المحملة من SQLite
    if (!currentUser) return false;

    // إعادة التحقق من الـ PIN مقابل مصفوفة users الحقيقية من SQLite
    if (typeof users !== 'undefined' && users.length > 0) {
        const pin = currentUser.pin;
        const realUser = users.find(u => u.pin === pin);
        if (!realUser) {
            // الـ PIN لا يطابق أي مستخدم حقيقي → رفض الوصول وتسجيل خروج
            currentUser = null;
            removeStore('pos_session_user');
            return false;
        }

        // الحساب المجمّد ممنوع من كل الإجراءات
        if (realUser.isFrozen) {
            showCustomAlert({
                type: 'error',
                titleText: '❄️ حساب مجمّد',
                msg: 'هذا الحساب مجمّد حالياً من قبل مدير النظام ولا يمكنه تنفيذ أي عملية.'
            });
            return false;
        }

        // نستخدم بيانات المستخدم الحقيقية من SQLite
        if (realUser.role === 'admin') {
            const isProfitsBlocked = realUser.permissions?.general && (realUser.permissions.general.hideProfits === true || realUser.permissions.general.profits === false);
            if (action === 'general_profits' && isProfitsBlocked) {
                showCustomAlert({
                    type: 'error',
                    titleText: '🚫 وصول مرفوض',
                    msg: 'عذراً، تم تعطيل رؤية الأرباح لهذا الحساب.'
                });
                return false;
            }
            return true;
        }

        if (!realUser.permissions) {
            showCustomAlert({
                type: 'error',
                titleText: '⚠️ تنبيه أمني',
                msg: 'هذا الحساب لا يمتلك صلاحيات محددة. يرجى مراجعة المدير.'
            });
            return false;
        }

        const { module, perm } = resolvePermissionKey(action);
        const userPerms = realUser.permissions[module];
        if (userPerms) {
            if (module === 'docs' && perm === 'purchase_return') {
                if (userPerms.purchase_return !== undefined) return !!userPerms.purchase_return;
                return !!(userPerms.purchase || userPerms.return);
            }
            if (module === 'accounts' && perm === 'receipt') {
                if (userPerms.receipt !== undefined) return !!userPerms.receipt;
                return !!userPerms.add;
            }
            if (module === 'accounts' && perm === 'disbursement') {
                if (userPerms.disbursement !== undefined) return !!userPerms.disbursement;
                return !!userPerms.add;
            }
            if (module === 'stock' && perm === 'warehouse_report') {
                if (userPerms.warehouse_report !== undefined) return !!userPerms.warehouse_report;
                return !!(userPerms.view || userPerms.add);
            }
            if (module === 'stock' && perm === 'adjust') {
                if (userPerms.adjust !== undefined) return !!userPerms.adjust;
                return !!(userPerms.edit || userPerms.transfer);
            }
            if (module === 'stock' && perm === 'history') {
                if (userPerms.history !== undefined) return !!userPerms.history;
                return !!userPerms.view;
            }
            if (module === 'stock' && perm === 'inquiry') {
                if (userPerms.inquiry !== undefined) return !!userPerms.inquiry;
                return !!userPerms.view;
            }
            if (module === 'accounts' && perm === 'statement') {
                if (userPerms.statement !== undefined) return !!userPerms.statement;
                return false;
            }
            if (module === 'accounts' && perm === 'treasury') {
                if (userPerms.treasury !== undefined) return !!userPerms.treasury;
                return false;
            }
            if (module === 'general' && perm === 'shortcuts') {
                if (userPerms.shortcuts !== undefined) return !!userPerms.shortcuts && !!userPerms.settings;
                return !!userPerms.settings;
            }
            if (userPerms[perm]) return true;
        }

        showCustomAlert({
            type: 'error',
            titleText: '🚫 وصول مرفوض',
            msg: 'عذراً، ليس لديك صلاحية للقيام بهذا الإجراء (' + (action.replace('_', ' ')) + '). يرجى مراجعة مدير النظام.'
        });
        return false;
    }

    // Fallback: لو مصفوفة users لم تُحمَّل بعد، نعتمد على currentUser المحمل في الذاكرة
    if (currentUser.isFrozen) return false;
    if (currentUser.role === 'admin') {
        const isProfitsBlocked = currentUser.permissions?.general && (currentUser.permissions.general.hideProfits === true || currentUser.permissions.general.profits === false);
        if (action === 'general_profits' && isProfitsBlocked) {
            showCustomAlert({
                type: 'error',
                titleText: '🚫 وصول مرفوض',
                msg: 'عذراً، تم تعطيل رؤية الأرباح لهذا الحساب.'
            });
            return false;
        }
        return true;
    }

    if (!currentUser.permissions) {
        showCustomAlert({
            type: 'error',
            titleText: '⚠️ تنبيه أمني',
            msg: 'هذا الحساب لا يمتلك صلاحيات محددة. يرجى مراجعة المدير.'
        });
        return false;
    }

    const { module, perm } = resolvePermissionKey(action);
    const userPerms = currentUser.permissions[module];
    if (userPerms) {
        if (module === 'docs' && perm === 'purchase_return') {
            if (userPerms.purchase_return !== undefined) return !!userPerms.purchase_return;
            return !!(userPerms.purchase || userPerms.return);
        }
        if (module === 'accounts' && perm === 'receipt') {
            if (userPerms.receipt !== undefined) return !!userPerms.receipt;
            return !!userPerms.add;
        }
        if (module === 'accounts' && perm === 'disbursement') {
            if (userPerms.disbursement !== undefined) return !!userPerms.disbursement;
            return !!userPerms.add;
        }
        if (module === 'stock' && perm === 'warehouse_report') {
            if (userPerms.warehouse_report !== undefined) return !!userPerms.warehouse_report;
            return !!(userPerms.view || userPerms.add);
        }
        if (module === 'stock' && perm === 'adjust') {
            if (userPerms.adjust !== undefined) return !!userPerms.adjust;
            return !!(userPerms.edit || userPerms.transfer);
        }
        if (module === 'stock' && perm === 'history') {
            if (userPerms.history !== undefined) return !!userPerms.history;
            return !!userPerms.view;
        }
        if (module === 'stock' && perm === 'inquiry') {
            if (userPerms.inquiry !== undefined) return !!userPerms.inquiry;
            return !!userPerms.view;
        }
        if (module === 'accounts' && perm === 'statement') {
            if (userPerms.statement !== undefined) return !!userPerms.statement;
            return false;
        }
        if (module === 'accounts' && perm === 'treasury') {
            if (userPerms.treasury !== undefined) return !!userPerms.treasury;
            return false;
        }
        if (module === 'general' && perm === 'shortcuts') {
            if (userPerms.shortcuts !== undefined) return !!userPerms.shortcuts && !!userPerms.settings;
            return !!userPerms.settings;
        }
        if (userPerms[perm]) return true;
    }

    showCustomAlert({
        type: 'error',
        titleText: '🚫 وصول مرفوض',
        msg: 'عذراً، ليس لديك صلاحية للقيام بهذا الإجراء (' + (action.replace('_', ' ')) + '). يرجى مراجعة مدير النظام.'
    });
    return false;
}

function hasPermission(action) {
    if (!currentUser) return false;
    // ✅ أمان: التحقق من الـ PIN مقابل مصفوفة users من SQLite
    if (typeof users !== 'undefined' && users.length > 0) {
        const realUser = users.find(u => u.pin === currentUser.pin);
        if (!realUser) return false;
        if (realUser.isFrozen) return false;
        if (realUser.role === 'admin') {
            if (action === 'general_profits') {
                if (realUser.permissions?.general) {
                    if (realUser.permissions.general.hideProfits !== undefined) return !realUser.permissions.general.hideProfits;
                    if (realUser.permissions.general.profits === false) return false;
                }
                return true;
            }
            if (action === 'ui_hide_share' || action === 'hide_share') {
                return !!(realUser.permissions?.general && realUser.permissions.general.hideShare);
            }
            if (action === 'ui_hide_new' || action === 'hide_new') {
                return !!(realUser.permissions?.general && realUser.permissions.general.hideNew);
            }
            if (action === 'ui_hide_drawer_balance' || action === 'hide_drawer_balance') {
                return !!(realUser.permissions?.general && (realUser.permissions.general.hideDrawerBalance || realUser.permissions.general.drawerBalance === false));
            }
            if (action === 'general_drawer_balance' || action === 'drawer_balance') {
                if (realUser.permissions?.general) {
                    if (realUser.permissions.general.hideDrawerBalance !== undefined) return !realUser.permissions.general.hideDrawerBalance;
                    if (realUser.permissions.general.drawerBalance !== undefined) return !!realUser.permissions.general.drawerBalance;
                }
                return true;
            }
            return true;
        }
        if (!realUser.permissions) return false;
        const { module, perm } = resolvePermissionKey(action);
        const userPerms = realUser.permissions[module];
        if (userPerms) {
            if (module === 'docs' && perm === 'purchase_return') {
                if (userPerms.purchase_return !== undefined) return !!userPerms.purchase_return;
                return !!(userPerms.purchase || userPerms.return);
            }
            if (module === 'accounts' && perm === 'receipt') {
                if (userPerms.receipt !== undefined) return !!userPerms.receipt;
                return !!userPerms.add;
            }
            if (module === 'accounts' && perm === 'disbursement') {
                if (userPerms.disbursement !== undefined) return !!userPerms.disbursement;
                return !!userPerms.add;
            }
            if (module === 'stock' && perm === 'warehouse_report') {
                if (userPerms.warehouse_report !== undefined) return !!userPerms.warehouse_report;
                return !!(userPerms.view || userPerms.add);
            }
            if (module === 'stock' && perm === 'adjust') {
                if (userPerms.adjust !== undefined) return !!userPerms.adjust;
                return !!(userPerms.edit || userPerms.transfer);
            }
            if (module === 'stock' && perm === 'history') {
                if (userPerms.history !== undefined) return !!userPerms.history;
                return !!userPerms.view;
            }
            if (module === 'stock' && perm === 'inquiry') {
                if (userPerms.inquiry !== undefined) return !!userPerms.inquiry;
                return !!userPerms.view;
            }
            if (module === 'accounts' && perm === 'statement') {
                if (userPerms.statement !== undefined) return !!userPerms.statement;
                return false;
            }
            if (module === 'accounts' && perm === 'treasury') {
                if (userPerms.treasury !== undefined) return !!userPerms.treasury;
                return false;
            }
            if (module === 'general' && perm === 'shortcuts') {
                if (userPerms.shortcuts !== undefined) return !!userPerms.shortcuts && !!userPerms.settings;
                return !!userPerms.settings;
            }
            if (action === 'ui_hide_drawer_balance' || action === 'hide_drawer_balance' || (module === 'general' && (perm === 'ui_hide_drawer_balance' || perm === 'hide_drawer_balance'))) {
                return !!(userPerms && (userPerms.hideDrawerBalance || userPerms.drawerBalance === false));
            }
            if (action === 'general_drawer_balance' || action === 'drawer_balance' || (module === 'general' && (perm === 'drawer_balance' || perm === 'drawerBalance'))) {
                if (userPerms.hideDrawerBalance !== undefined) return !userPerms.hideDrawerBalance;
                if (userPerms.drawerBalance !== undefined) return !!userPerms.drawerBalance;
                return true;
            }
            return !!userPerms[perm];
        }
        return false;
    }
    // Fallback لو users لم تُحمَّل بعد
    if (currentUser.isFrozen) return false;
    if (currentUser.role === 'admin') {
        if (action === 'general_profits') {
            if (currentUser.permissions?.general) {
                if (currentUser.permissions.general.hideProfits !== undefined) return !currentUser.permissions.general.hideProfits;
                if (currentUser.permissions.general.profits === false) return false;
            }
            return true;
        }
        if (action === 'ui_hide_share' || action === 'hide_share') {
            return !!(currentUser.permissions?.general && currentUser.permissions.general.hideShare);
        }
        if (action === 'ui_hide_new' || action === 'hide_new') {
            return !!(currentUser.permissions?.general && currentUser.permissions.general.hideNew);
        }
        if (action === 'ui_hide_drawer_balance' || action === 'hide_drawer_balance') {
            return !!(currentUser.permissions?.general && (currentUser.permissions.general.hideDrawerBalance || currentUser.permissions.general.drawerBalance === false));
        }
        if (action === 'general_drawer_balance' || action === 'drawer_balance') {
            if (currentUser.permissions?.general) {
                if (currentUser.permissions.general.hideDrawerBalance !== undefined) return !currentUser.permissions.general.hideDrawerBalance;
                if (currentUser.permissions.general.drawerBalance !== undefined) return !!currentUser.permissions.general.drawerBalance;
            }
            return true;
        }
        return true;
    }
    if (!currentUser.permissions) return false;
    const { module, perm } = resolvePermissionKey(action);
    const userPerms = currentUser.permissions[module];
    if (userPerms) {
        if (module === 'docs' && perm === 'purchase_return') {
            if (userPerms.purchase_return !== undefined) return !!userPerms.purchase_return;
            return !!(userPerms.purchase || userPerms.return);
        }
        if (module === 'accounts' && perm === 'receipt') {
            if (userPerms.receipt !== undefined) return !!userPerms.receipt;
            return !!userPerms.add;
        }
        if (module === 'accounts' && perm === 'disbursement') {
            if (userPerms.disbursement !== undefined) return !!userPerms.disbursement;
            return !!userPerms.add;
        }
        if (module === 'stock' && perm === 'warehouse_report') {
            if (userPerms.warehouse_report !== undefined) return !!userPerms.warehouse_report;
            return !!(userPerms.view || userPerms.add);
        }
        if (module === 'stock' && perm === 'adjust') {
            if (userPerms.adjust !== undefined) return !!userPerms.adjust;
            return !!(userPerms.edit || userPerms.transfer);
        }
        if (module === 'stock' && perm === 'history') {
            if (userPerms.history !== undefined) return !!userPerms.history;
            return !!userPerms.view;
        }
        if (module === 'stock' && perm === 'inquiry') {
            if (userPerms.inquiry !== undefined) return !!userPerms.inquiry;
            return !!userPerms.view;
        }
        if (module === 'accounts' && perm === 'statement') {
            if (userPerms.statement !== undefined) return !!userPerms.statement;
            return false;
        }
        if (module === 'accounts' && perm === 'treasury') {
            if (userPerms.treasury !== undefined) return !!userPerms.treasury;
            return false;
        }
        if (module === 'general' && perm === 'shortcuts') {
            if (userPerms.shortcuts !== undefined) return !!userPerms.shortcuts && !!userPerms.settings;
            return !!userPerms.settings;
        }
        if (action === 'ui_hide_drawer_balance' || action === 'hide_drawer_balance' || (module === 'general' && (perm === 'ui_hide_drawer_balance' || perm === 'hide_drawer_balance'))) {
            return !!(userPerms && (userPerms.hideDrawerBalance || userPerms.drawerBalance === false));
        }
        if (action === 'general_drawer_balance' || action === 'drawer_balance' || (module === 'general' && (perm === 'drawer_balance' || perm === 'drawerBalance'))) {
            if (userPerms.hideDrawerBalance !== undefined) return !userPerms.hideDrawerBalance;
            if (userPerms.drawerBalance !== undefined) return !!userPerms.drawerBalance;
            return true;
        }
        return !!userPerms[perm];
    }
    return false;
}

// --- 3. Warehouse Management Logic ---

function openWarehouseModal() {
    const modal = document.getElementById('warehouseModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const titleEl = document.getElementById('warehouseModalTitle');
    if (titleEl) titleEl.innerText = '🏭 إضافة مخزن / فرع جديد';
    document.getElementById('editWarehouseId').value = '';
    document.getElementById('warehouseName').value = '';
    document.getElementById('warehouseAddress').value = '';
    document.getElementById('warehouseName').focus();
}

function editWarehouse(idx) {
    const w = warehouses[idx];
    if (!w) return;
    const modal = document.getElementById('warehouseModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const titleEl = document.getElementById('warehouseModalTitle');
    if (titleEl) titleEl.innerText = '✍️ تعديل بيانات الفرع / المخزن';
    document.getElementById('editWarehouseId').value = idx;
    document.getElementById('warehouseName').value = w.name;
    document.getElementById('warehouseAddress').value = w.address || '';
    document.getElementById('warehouseName').focus();
}

async function deleteWarehouse(idx) {
    if (!warehouses || warehouses.length <= 1) {
        if (typeof showToast === 'function') showToast("⚠️ لا يمكن حذف المخزن الوحيد المتبقي بالنظام!", "warning");
        else alert("لا يمكن حذف المخزن الوحيد المتبقي بالنظام!");
        return;
    }
    const targetWH = warehouses[idx];
    if (!targetWH) return;

    if (currentUser && currentUser.warehouseName === targetWH.name) {
        if (typeof showToast === 'function') showToast("⚠️ لا يمكن حذف المخزن المعتمد للجهاز الحالي! قم بالتبديل إلى مخزن آخر أولاً.", "warning");
        else alert("لا يمكن حذف المخزن المعتمد للجهاز الحالي!");
        return;
    }

    // فحص أمني: هل المخزن يحتوي على بضاعة مسجلة؟
    let totalItemsCount = 0;
    const prodsList = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []);
    if (Array.isArray(prodsList)) {
        prodsList.forEach(p => {
            if (!p) return;
            if (p.warehouseStocks && parseFloat(p.warehouseStocks[targetWH.name]) > 0) {
                totalItemsCount += parseFloat(p.warehouseStocks[targetWH.name]) || 0;
            } else if (p.variants && Array.isArray(p.variants)) {
                p.variants.forEach(v => {
                    if (v && v.warehouseStocks && parseFloat(v.warehouseStocks[targetWH.name]) > 0) {
                        totalItemsCount += parseFloat(v.warehouseStocks[targetWH.name]) || 0;
                    }
                });
            }
        });
    }

    if (totalItemsCount > 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'error',
                titleText: '🚫 لا يمكن حذف المخزن',
                msg: `عذراً، المخزن "<b>${targetWH.name}</b>" يحتوي حالياً على (<b>${totalItemsCount}</b>) قطعة بضاعة مسجلة.<br>يرجى تحويل البضاعة أولاً إلى مخزن آخر أو تصفيرها قبل التمكن من حذف المخزن.`
            });
        } else {
            alert(`🚫 لا يمكن حذف المخزن "${targetWH.name}" لأنه يحتوي على ${totalItemsCount} قطعة بضاعة! يرجى تحويل البضاعة أولاً.`);
        }
        return;
    }

    if (!confirm(`هل أنت تأكد من نقل المخزن "${targetWH.name}" وبضاعته إلى سلة المحذوفات؟`)) return;

    // جلب البضاعة والكميات المسجلة في هذا المخزن لحفظها في السلة
    let warehouseStock = [];
    if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
        warehouseStock = productsDB.map(p => {
            if (p && p.warehouseStocks && p.warehouseStocks[targetWH.name] !== undefined) {
                return { productId: p.id, barcode: p.barcode, name: p.name, quantity: p.warehouseStocks[targetWH.name] };
            }
            return null;
        }).filter(Boolean);
    }

    const trashPayload = {
        warehouse: { ...targetWH },
        stock: warehouseStock
    };

    if (typeof trashManager !== 'undefined' && trashManager.moveToTrash) {
        await trashManager.moveToTrash(trashPayload, 'warehouse', `مخزن: ${targetWH.name}`);
    }

    warehouses.splice(idx, 1);
    if (typeof users !== 'undefined' && Array.isArray(users)) {
        users.forEach(u => {
            if (u.assignedWarehouse === targetWH.name) {
                u.warehouseScope = 'all';
                u.assignedWarehouse = '';
            }
        });
        renderUsersTable();
    }
    if (typeof populateUserSpecificWarehouseSelect === 'function') populateUserSpecificWarehouseSelect();
    if (typeof saveData === 'function') saveData();
    renderWarehousesTable();
    if (typeof renderInventoryTable === 'function') renderInventoryTable();
}

function saveWarehouse() {
    const nameEl = document.getElementById('warehouseName');
    const addrEl = document.getElementById('warehouseAddress');
    const idEl = document.getElementById('editWarehouseId');
    if (!nameEl) return;

    const name = nameEl.value.trim();
    const address = addrEl ? addrEl.value.trim() : '';
    const id = idEl ? idEl.value : '';

    if (!name) {
        if (typeof showToast === 'function') showToast("يرجى كتابة اسم المخزن أو الفرع!", "error");
        else alert("يرجى كتابة اسم المخزن");
        return;
    }

    if (id !== '') {
        const idx = parseInt(id, 10);
        const w = warehouses[idx];
        if (w) {
            const oldName = w.name;
            w.name = name; 
            w.address = address;

            if (currentUser && currentUser.warehouseName === oldName) {
                currentUser.warehouseName = name;
                if (typeof setStore === 'function') {
                    const encPin = (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
                        ? window.BayanSecurity.encryptPin(currentUser.pin)
                        : currentUser.pin;
                    setStore('pos_session_user', JSON.stringify({ pin: encPin, warehouseName: name }));
                }
                if (document.getElementById('currentWarehouseName')) {
                    document.getElementById('currentWarehouseName').innerText = ` 📦 ${name}`;
                }
            }

            if (typeof transactions !== 'undefined' && Array.isArray(transactions)) {
                transactions.forEach(t => {
                    let changed = false;
                    if (t.warehouse === oldName) { t.warehouse = name; changed = true; }
                    if (t.sourceWarehouse === oldName) { t.sourceWarehouse = name; changed = true; }
                    if (t.partner && typeof t.partner === 'string') {
                        const parts = t.partner.split(' -> ');
                        if (parts.length === 2) {
                            let fromW = parts[0].trim();
                            let toW = parts[1].trim();
                            let partnerChanged = false;
                            if (fromW === oldName) { fromW = name; partnerChanged = true; }
                            if (toW === oldName) { toW = name; partnerChanged = true; }
                            if (partnerChanged) { t.partner = `${fromW} -> ${toW}`; changed = true; }
                        } else if (t.partner === oldName) {
                            t.partner = name;
                            changed = true;
                        }
                    }
                });
            }

            if (typeof users !== 'undefined' && Array.isArray(users)) {
                users.forEach(u => {
                    if (u.assignedWarehouse === oldName) {
                        u.assignedWarehouse = name;
                    }
                });
            }
        }
    } else {
        // فحص هل الاسم مكرر
        if (warehouses.some(w => w.name.trim() === name)) {
            if (typeof showToast === 'function') showToast("اسم هذا المخزن مسجل بالفعل!", "warning");
            else alert("اسم المخزن مسجل بالفعل!");
            return;
        }
        warehouses.push({ id: Date.now(), name, address });
    }

    if (typeof saveData === 'function') saveData();
    renderWarehousesTable();
    const modal = document.getElementById('warehouseModal');
    if (modal) modal.classList.add('hidden');
    if (typeof showToast === 'function') showToast("تم حفظ بيانات الموقع بنجاح ✅", "success");
    if (typeof renderInventoryTable === 'function') renderInventoryTable();

    // مزامنة قوائم شاشة التحويل المخزني إذا كانت مفتوحة
    if (typeof window.updateTransferToList === 'function') {
        const wFrom = document.getElementById('transferFrom');
        if (wFrom) {
            const currentFrom = wFrom.value;
            wFrom.innerHTML = (window.warehouses || warehouses || []).map(w => `<option value="${w.name}">${w.name}</option>`).join('');
            if (currentFrom) wFrom.value = currentFrom;
        }
        window.updateTransferToList();
    }
}

function renderWarehousesTable() {
    const tbody = document.getElementById('warehousesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!warehouses || warehouses.length === 0) {
        warehouses = [{ id: Date.now(), name: 'المخزن الرئيسي', address: 'المقر الرئيسي' }];
    }

    let rowsHtml = '';
    warehouses.forEach((w, idx) => {
        const isCurrent = currentUser && currentUser.warehouseName === w.name;
        rowsHtml += `
            <tr style="border-bottom: 2px solid #e2e8f0; ${isCurrent ? 'background: #fffdf0;' : 'background: #ffffff;'}">
                <td style="padding: 14px 16px; font-weight: 900; color: #000000; white-space: nowrap; font-size: 1.05rem;">
                    ${w.name} ${isCurrent ? '<span style="background: #f59e0b; color: #000000; padding: 4px 10px; border-radius: 8px; font-size: 0.88rem; font-weight: 900; margin-right: 8px; display: inline-block; border: 1.5px solid #d97706;">نشط</span>' : ''}
                </td>
                <td style="padding: 14px 16px; color: #000000; font-weight: 900; font-size: 1.02rem;">${w.address || '-'}</td>
                <td style="padding: 14px 16px; text-align: center;">
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <button type="button" style="padding: 8px 16px; font-size: 0.95rem; background: #f59e0b; color: #000000; border: 2px solid #d97706; border-radius: 8px; font-weight: 900; cursor: pointer; min-height: 38px;" onclick="editWarehouse(${idx})">✏️ تعديل</button>
                        <button type="button" style="padding: 8px 16px; font-size: 0.95rem; background: #ef4444; color: #ffffff; border: 2px solid #b91c1c; border-radius: 8px; font-weight: 900; cursor: pointer; min-height: 38px;" onclick="deleteWarehouse(${idx})">🗑️ حذف</button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;

    updateSettingsWarehouseSelect();
    initTransferPriceTypeSetting();
    initAdjustmentPriceTypeSetting();
    if (typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();
}

function updateSettingsWarehouseSelect() {
    const select = document.getElementById('settingsActiveWarehouseSelect');
    if (!select) return;
    if (!warehouses || warehouses.length === 0) {
        warehouses = [{ id: Date.now(), name: 'المخزن الرئيسي', address: 'المقر الرئيسي' }];
    }
    const currentWH = (currentUser && currentUser.warehouseName) ? currentUser.warehouseName : warehouses[0].name;
    select.innerHTML = warehouses.map(w => `<option value="${w.name}" title="${w.name}" ${currentWH === w.name ? 'selected="selected"' : ''}>${w.name}</option>`).join('');
    select.value = currentWH;
}

window.initTransferPriceTypeSetting = function() {
    const sel = document.getElementById('settingsTransferPriceType');
    if (!sel) return;
    const current = (typeof window.getTransferPriceType === 'function')
        ? window.getTransferPriceType()
        : ((typeof getStore === 'function' ? getStore('transferPriceType') : null) || 'cost');
    sel.value = current;
};

window.saveTransferPriceTypeSetting = async function(val) {
    if (!val) val = 'cost';
    if (typeof setStore === 'function') {
        setStore('transferPriceType', val);
    }

    try {
        const settingsObj = JSON.parse((typeof getStore === 'function' ? getStore('pos_settings') : null) || '{}');
        settingsObj.transferPriceType = val;
        if (typeof setStore === 'function') setStore('pos_settings', JSON.stringify(settingsObj));
    } catch(e) {}

    if (typeof window.saveSettingsDirect === 'function') {
        await window.saveSettingsDirect();
    } else if (typeof saveData === 'function') {
        await saveData();
    }
    const labelMap = {
        'cost': 'سعر التكلفة (Cost Price)',
        'retail': 'سعر البيع القطاعي (Retail Price)',
        'wholesale': 'سعر البيع الجملة (Wholesale Price)'
    };
    if (typeof showToast === 'function') {
        showToast(`✅ تم حفظ سياسة تسعير التحويل: [ ${labelMap[val] || val} ]`, 'success');
    }
};

window.initAdjustmentPriceTypeSetting = function() {
    const sel = document.getElementById('settingsAdjustmentPriceType');
    if (!sel) return;
    const current = (typeof window.getAdjustmentPriceType === 'function')
        ? window.getAdjustmentPriceType()
        : ((typeof getStore === 'function' ? getStore('adjustmentPriceType') : null) || 'retail');
    sel.value = current;
};

window.saveAdjustmentPriceTypeSetting = async function(val) {
    if (!val) val = 'retail';
    if (typeof setStore === 'function') {
        setStore('adjustmentPriceType', val);
    }

    try {
        const settingsObj = JSON.parse((typeof getStore === 'function' ? getStore('pos_settings') : null) || '{}');
        settingsObj.adjustmentPriceType = val;
        if (typeof setStore === 'function') setStore('pos_settings', JSON.stringify(settingsObj));
    } catch(e) {}

    if (typeof window.saveSettingsDirect === 'function') {
        await window.saveSettingsDirect();
    } else if (typeof saveData === 'function') {
        await saveData();
    }
    const labelMap = {
        'retail': 'سعر البيع القطاعي (Retail Price)',
        'cost': 'سعر التكلفة (Cost Price)',
        'wholesale': 'سعر البيع الجملة (Wholesale Price)'
    };
    if (typeof renderAdjTable === 'function') {
        renderAdjTable();
    }
    if (typeof showToast === 'function') {
        showToast(`✅ تم حفظ سياسة تسعير تسوية وجرد المخزون: [ ${labelMap[val] || val} ]`, 'success');
    }
};

function applyWarehouseSwitchFromSettings() {
    const val = document.getElementById('settingsActiveWarehouseSelect').value;
    if (currentUser) {
        if (currentUser.role !== 'admin' && currentUser.warehouseScope === 'main' && val !== 'المخزن الرئيسي') {
            return showToast("⛔ عذراً، حسابك مقيد بالمخزن الرئيسي فقط ولا يمكنك التبديل لمخزن آخر.", "error");
        }
        if (currentUser.role !== 'admin' && currentUser.warehouseScope === 'specific' && currentUser.assignedWarehouse && val !== currentUser.assignedWarehouse) {
            return showToast(`⛔ عذراً، حسابك مقيد بـ (${currentUser.assignedWarehouse}) فقط ولا يمكنك التبديل لمخزن آخر.`, "error");
        }
        currentUser.warehouseName = val;
        // ✅ أمان: نحفظ pin مشفراً فقط
        const encWhPin = (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
            ? window.BayanSecurity.encryptPin(currentUser.pin)
            : currentUser.pin;
        setStore('pos_session_user', JSON.stringify({ pin: encWhPin, warehouseName: val }));
        const whHeader = document.getElementById('currentWarehouseName');
        if (whHeader) whHeader.innerText = ` 📦 ${val}`;
        if (typeof window.updateHeaderWarehouseSelect === 'function') window.updateHeaderWarehouseSelect();
        showToast(`تم تغيير المستودع النشط إلى: ${val}`, "success");
        updateWarehousesSummaryBoard();
        
        // تحديث كافة الجداول لعرض بيانات المخزن الجديد فوراً
        if (typeof renderInventoryTable === 'function') renderInventoryTable();
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
        if (typeof renderCart === 'function') renderCart();
        if (typeof renderPOSCart === 'function') renderPOSCart();
        if (typeof renderProductsGrid === 'function') renderProductsGrid();
        if (typeof updateNotifications === 'function') updateNotifications();
        if (typeof window.checkIncomingTransfersAlert === 'function') window.checkIncomingTransfersAlert();
    }
}

window.updateHeaderWarehouseSelect = function() {
    const sel = document.getElementById('headerActiveWarehouseSelect');
    const lockBadge = document.getElementById('warehouseLockBadge');
    if (!sel) return;

    const allWh = ['المخزن الرئيسي'];
    if (typeof warehouses !== 'undefined' && Array.isArray(warehouses)) {
        warehouses.forEach(w => {
            if (w.name && !allWh.includes(w.name)) allWh.push(w.name);
        });
    }

    const currentWh = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName)
        ? currentUser.warehouseName
        : 'المخزن الرئيسي';

    // فحص صلاحيات المستخدم الحالي
    let isRestricted = false;
    let allowedList = allWh;

    if (typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'admin') {
        if (currentUser.warehouseScope === 'main') {
            isRestricted = true;
            allowedList = ['المخزن الرئيسي'];
        } else if (currentUser.warehouseScope === 'specific' && currentUser.assignedWarehouse) {
            isRestricted = true;
            allowedList = [currentUser.assignedWarehouse];
        }
    }

    sel.innerHTML = allowedList.map(w => `<option value="${w}" style="background: #0f172a; color: #fff;" ${w === currentWh ? 'selected' : ''}>${w}</option>`).join('');
    sel.value = currentWh;

    if (isRestricted) {
        sel.disabled = true;
        sel.style.opacity = '0.85';
        sel.style.cursor = 'not-allowed';
        if (lockBadge) lockBadge.style.display = 'inline-block';
    } else {
        sel.disabled = false;
        sel.style.opacity = '1';
        sel.style.cursor = 'pointer';
        if (lockBadge) lockBadge.style.display = 'none';
    }

    const legacySpan = document.getElementById('currentWarehouseName');
    if (legacySpan) legacySpan.innerText = ` 📦 ${currentWh}`;
};

window.switchWarehouseFromHeader = function(val) {
    if (!val) return;
    if (typeof currentUser !== 'undefined' && currentUser) {
        if (currentUser.role !== 'admin' && currentUser.warehouseScope === 'main' && val !== 'المخزن الرئيسي') {
            window.updateHeaderWarehouseSelect();
            return showToast("⛔ عذراً، حسابك مقيد بالمخزن الرئيسي فقط ولا يمكنك التبديل لمخزن آخر.", "error");
        }
        if (currentUser.role !== 'admin' && currentUser.warehouseScope === 'specific' && currentUser.assignedWarehouse && val !== currentUser.assignedWarehouse) {
            window.updateHeaderWarehouseSelect();
            return showToast(`⛔ عذراً، حسابك مقيد بـ (${currentUser.assignedWarehouse}) فقط ولا يمكنك التبديل لمخزن آخر.`, "error");
        }

        currentUser.warehouseName = val;
        const encHeaderPin = (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
            ? window.BayanSecurity.encryptPin(currentUser.pin)
            : currentUser.pin;
        setStore('pos_session_user', JSON.stringify({ pin: encHeaderPin, warehouseName: val }));
        window.updateHeaderWarehouseSelect();

        const settingsSel = document.getElementById('settingsActiveWarehouseSelect');
        if (settingsSel) settingsSel.value = val;

        showToast(`🏬 تم تغيير المستودع النشط إلى: ${val}`, "success");
        if (typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();

        // تحديث كافة الجداول لعرض بيانات المخزن الجديد فوراً
        if (typeof renderInventoryTable === 'function') renderInventoryTable();
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
        if (typeof renderCart === 'function') renderCart();
        if (typeof renderPOSCart === 'function') renderPOSCart();
        if (typeof renderProductsGrid === 'function') renderProductsGrid();
        if (typeof updateNotifications === 'function') updateNotifications();
        if (typeof window.checkIncomingTransfersAlert === 'function') window.checkIncomingTransfersAlert();
    }
};

window.filterInventoryByWarehouse = function(whName) {
    if (!whName) return;
    if (typeof currentUser !== 'undefined' && currentUser) {
        if (currentUser.role !== 'admin' && currentUser.warehouseScope === 'main' && whName !== 'المخزن الرئيسي') {
            return showToast("⛔ عذراً، حسابك مقيد بالمخزن الرئيسي فقط ولا يمكنك التبديل لمخزن آخر.", "error");
        }
        if (currentUser.role !== 'admin' && currentUser.warehouseScope === 'specific' && currentUser.assignedWarehouse && whName !== currentUser.assignedWarehouse) {
            return showToast(`⛔ عذراً، حسابك مقيد بـ (${currentUser.assignedWarehouse}) فقط ولا يمكنك التبديل لمخزن آخر.`, "error");
        }

        currentUser.warehouseName = whName;
        if (typeof setStore === 'function') {
            const encFilterPin = (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
                ? window.BayanSecurity.encryptPin(currentUser.pin)
                : currentUser.pin;
            setStore('pos_session_user', JSON.stringify({ pin: encFilterPin, warehouseName: whName }));
        }
    }
    if (typeof renderInventoryTable === 'function') renderInventoryTable();
    if (typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();
    if (typeof updateNotifications === 'function') updateNotifications();
    if (typeof window.checkIncomingTransfersAlert === 'function') window.checkIncomingTransfersAlert();
    if (typeof showToast === 'function') showToast(`🏬 تم تصفية العرض حسب: ${whName}`, "info");
};

function updateWarehousesSummaryBoard() {
    const board = document.getElementById('warehousesSummaryBoard');
    if (!board) return;
    // ⚡ حماية الأداء: إذا كان قسم المخازن غير معروض حالياً على الشاشة، نتخطى الحسابات لتسريع حفظ الأصناف والفواتير
    const sec = board.closest('.section-view');
    if (sec && sec.classList.contains('hidden')) return;

    board.innerHTML = '';

    warehouses.forEach(w => {
        let itemsCount = 0;
        let totalQty = 0;
        let totalValue = 0;

        productsDB.forEach(p => {
            if (typeof getWarehouseStock === 'function') {
                const stockInWarehouse = getWarehouseStock(p.name, w.name);
                if (stockInWarehouse !== 0) {
                    itemsCount++;
                    totalQty += stockInWarehouse;

                    let factor = 1;
                    if (p.units && p.units.length > 0) {
                        const mainU = p.units[0];
                        if (mainU && mainU.factor) factor = parseFloat(mainU.factor) || 1;
                    }
                    totalValue += ((stockInWarehouse / factor) * (parseFloat(p.cost) || 0));
                }
            }
        });

        const div = document.createElement('div');
        const isCurrentWH = currentUser && currentUser.warehouseName === w.name;
        div.style = `background: ${isCurrentWH ? '#fffdf0' : 'white'}; padding: 15px; border-radius: 12px; border: ${isCurrentWH ? '2px solid #f59e0b' : '1px solid rgba(201,168,76,0.2)'}; box-shadow: 0 4px 10px rgba(0,0,0,0.05); transition: 0.3s; cursor: pointer; border-right: 5px solid ${isCurrentWH ? '#f59e0b' : 'var(--gold)'};`;
        div.onclick = () => window.filterInventoryByWarehouse(w.name);
        div.innerHTML = `
            <div style="font-weight: bold; color: #2c3e50; font-size: 1rem; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                <span>🏬 ${w.name}</span>
                ${isCurrentWH ? '<span style="background:#f59e0b; color:#1a1600; font-size:0.7rem; padding:3px 8px; border-radius:10px; font-weight:900;">المخزن النشط</span>' : '<span style="color:#64748b; font-size:0.75rem;">اضغط للتصفية 🔍</span>'}
            </div>
            <hr style="border:0; border-top:1px solid #eee; margin-bottom:10px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="font-size: 0.85rem; color: #666; display: flex; justify-content: space-between;">
                    <span> عدد الأصناف:</span>
                    <span style="font-weight: bold; color:#000;">${itemsCount}</span>
                </div>
                <div style="font-size: 0.85rem; color: #666; display: flex; justify-content: space-between;">
                    <span> إجمالي الكمية:</span>
                    <span style="font-weight: bold; color:#2ecc71;">${totalQty.toFixed(2)}</span>
                </div>
                <div style="font-size: 0.85rem; color: #666; display: flex; justify-content: space-between; border-top: 1px dashed #eee; padding-top: 5px; margin-top: 5px;">
                    <span> قيمة المخزن (تكلفة):</span>
                    <span style="font-weight: bold; color:var(--main-blue);">${totalValue.toFixed(2)} ج.م</span>
                </div>
            </div>
        `;
        board.appendChild(div);
    });
}

// --- 4. Aesthetics & Theme Logic ---

function changeLanguage(lang) {
    window.currentLanguage = lang;
    const settings = JSON.parse(getStore('pos_settings') || '{}');

    if (lang === 'ar') {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'ar';
    } else {
        document.documentElement.dir = 'ltr';
        document.documentElement.lang = lang;
    }

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key === 'app_title' && settings.name) return;

        if (window.translations && window.translations[lang] && window.translations[lang][key]) {
            if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
                el.placeholder = window.translations[lang][key];
            } else {
                el.innerText = window.translations[lang][key];
            }
        }
    });

    settings.language = lang;
    setStore('pos_settings', JSON.stringify(settings));

    const select = document.getElementById('appLanguageSelect');
    if (select) select.value = lang;
}

/**
 * دالة تصفير قاعدة البيانات بالكامل (Reset Database)
 * تقوم بحذف كافة البيانات من SQLite ومسح الإعدادات مع الحفاظ على هوية الجهاز
 */
async function confirmFullReset() {
    if (typeof showCustomAlert !== 'function') {
        alert("وظيفة التنبيهات المخصصة غير متوفرة.");
        return;
    }

    showCustomAlert({
        type: 'error',
        titleText: '🚨 تحذير نهائي خطير',
        msg: `
            <div style="text-align: right; color: #b91c1c;">
                <p style="font-weight: 900; font-size: 1.1rem; margin-bottom: 10px;">هل أنت متأكد من رغبتك في تدمير كافة البيانات؟</p>
                <p style="font-size: 0.9rem; margin-bottom: 20px; color: #475569;">لا يمكن استعادة البيانات بعد هذه الخطوة نهائياً إلا إذا كنت تملك نسخة احتياطية خارجية.</p>
                <label style="font-weight: bold; color: #1e293b;">🔐 للأمان، يرجى إدخال رمز الدخول (PIN) لتأكيد العملية:</label>
                <input type="password" id="resetPinInput" placeholder="****" 
                    style="width: 100%; padding: 12px; margin-top: 10px; border-radius: 10px; border: 2px solid #cbd5e1; text-align: center; font-size: 1.5rem; letter-spacing: 5px; outline: none; transition: 0.3s;"
                    onfocus="this.style.borderColor='#e11d48'">
            </div>
        `,
        confirmText: 'تدمير كافة البيانات 💣',
        cancelText: 'إلغاء 🛡️',
        showCancel: true,
        onConfirm: async () => {
            const pinInput = document.getElementById('resetPinInput');
            const pin = pinInput ? pinInput.value.trim() : '';

            if (!pin) {
                return showToast("❌ تم إلغاء العملية: يجب إدخال الرمز السري.", "error");
            }
            
            if (typeof currentUser !== 'undefined' && currentUser.pin !== pin) {
                return showToast("❌ رمز الدخول غير صحيح، تم إلغاء العملية.", "error");
            }

            showToast("⏳ جاري تصفير قاعدة البيانات... يرجى عدم إغلاق المتصفح", "info");

            try {
                // 1. مسح جداول البيانات فقط من SQLite (نحافظ على جدول settings الذي يحتوي HWID + الترخيص)
                const tables = ['products', 'transactions', 'accounts', 'users', 'trash', 'auditLogs', 'wallpapers'];
                if (typeof db !== 'undefined') {
                    for (const table of tables) {
                        if (db[table]) await db[table].clear();
                    }
                }

                // 2. مسح جدول settings في SQLite بالكامل عبر clearStore()
                clearStore();

                showToast("✅ تم تصفير النظام بنجاح. سيتم إعادة تحميل الصفحة الآن.", "success");
                
                setTimeout(() => {
                    window.location.reload();
                }, 2000);

            } catch (error) {
                console.error("فشل تصفير قاعدة البيانات:", error);
                showToast("❌ حدث خطأ أثناء تصفير البيانات: " + error.message, "error");
            }
        }
    });
}

async function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    setStore('pos_theme', isDark ? 'dark' : 'light');

    const themeBtn = document.querySelector('.theme-toggle-btn');
    if (themeBtn) {
        themeBtn.innerText = isDark ? '☀️ ' : '';
    }
    if (typeof window.saveSettingsDirect === 'function') {
        await window.saveSettingsDirect();
    } else {
        await saveData();
    }
}

function changeAppColor(color) {
    document.documentElement.style.setProperty('--main-green', color);
    const settings = JSON.parse(getStore('pos_settings') || '{}');
    settings.mainColor = color;
    setStore('pos_settings', JSON.stringify(settings));
}



