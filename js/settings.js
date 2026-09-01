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

    await saveData();
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
    // الأقسام اليومية السريعة (الموصى بها للكاشير: البيع، مرتجع البيع، القبض، الصرف، تقرير الحركة، الفواتير، الحسابات، البضاعة، كشف الحساب)
    const activeStaffSections = ['sales', 'sales-return', 'receipt', 'disbursement', 'daily-report', 'invoices', 'accounts', 'inventory', 'statement'];
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
    const activeClothingSections = ['sales', 'sales-return', 'receipt', 'disbursement', 'daily-report', 'invoices', 'accounts', 'inventory', 'statement'];

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
    if (settings.autoBackup !== undefined) document.getElementById('autoBackupSetting').checked = settings.autoBackup;
    if (settings.autoBackupInterval !== undefined) document.getElementById('autoBackupInterval').value = settings.autoBackupInterval;

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
        // كاشير بيع فقط: إضافة فواتير بيع فقط وحفظها، وإغلاق سجل الفواتير والمخازن والتقارير وباقي الأقسام
        const cashierIds = ['perm_docs_add'];
        cashierIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        });
        if (typeof showToast === 'function') showToast("🛒 تم تطبيق قالب: كاشير (بيع فقط) بنجاح!", "success");
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
            ? `<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px;">💳 ${u.nfcUid}</span>`
            : `<span style="color: #94a3b8; font-size: 0.78rem; font-weight: bold;">غير مربوط</span>`;

        const statusBadge = isFrozen
            ? `<span style="background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; padding: 3px 10px; border-radius: 50px; font-size: 0.75rem; font-weight: 900;">❄️ مجمّد</span>`
            : `<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 3px 10px; border-radius: 50px; font-size: 0.75rem; font-weight: 900;">🟢 نشط</span>`;

        rowsHtml += `
            <tr style="${isFrozen ? 'opacity: 0.65; background: #fff5f5;' : ''}">
                <td style="font-weight: 800; color: #1e293b;">${u.name}</td>
                <td style="font-family: monospace; letter-spacing: 1px; text-align: center; font-weight: bold;">${(u.role === 'admin' && !isSuperAdmin) ? '****' : u.pin}</td>
                <td style="text-align: center;">${nfcBadge}</td>
                <td style="text-align: center;">
                    <span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}" 
                          style="padding: 4px 10px; border-radius: 50px; font-size: 0.75rem; font-weight: 900; background: ${u.role === 'admin' ? '#ebfbee' : '#f1f5f9'}; color: ${u.role === 'admin' ? '#1e8449' : '#475569'}; border: 1px solid ${u.role === 'admin' ? '#c3e6cb' : '#e2e8f0'};">
                        ${u.role === 'admin' ? '⭐ مدير نظام' : '🔹 موظف'}
                    </span>
                </td>
                <td style="text-align: center;">${statusBadge}</td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center; flex-wrap: wrap;">
                        <button class="btn-delete-row" style="color: #6366f1; background: #eef2ff; padding: 4px 8px; font-size: 0.85rem;" onclick="editUser(${idx})" title="تعديل المستخدم">✏️</button>
                        <button class="btn-delete-row" style="color: #0284c7; background: #f0f9ff; padding: 4px 8px; font-size: 0.85rem;" onclick="openCopyPermissionsModal(${idx})" title="نسخ صلاحيات إلى هذا المستخدم">📋</button>
                        <button class="btn-delete-row" style="color: #d97706; background: #fefce8; padding: 4px 8px; font-size: 0.85rem;" onclick="changeUserPin(${idx})" title="تغيير رمز PIN">🔑</button>
                        ${!isSuperAdmin ? `
                            <button class="btn-delete-row" style="color: ${isFrozen ? '#059669' : '#0284c7'}; background: ${isFrozen ? '#ecfdf5' : '#f0f9ff'}; padding: 4px 8px; font-size: 0.85rem;" onclick="toggleFreezeUser(${idx})" title="${isFrozen ? 'تفعيل الحساب' : 'تجميد الحساب'}">
                                ${isFrozen ? '🟢 تفعيل' : '❄️ تجميد'}
                            </button>
                            <button class="btn-delete-row" style="color: #ef4444; background: #fef2f2; padding: 4px 8px; font-size: 0.85rem;" onclick="deleteUser(${idx})" title="حذف">🗑️</button>
                        ` : '<span title="المدير الرئيسي محمي من التجميد والحذف">🛡️</span>'}
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;
}

function toggleFreezeUser(idx) {
    const u = users[idx];
    if (!u) return;
    if (u.id === 1) return showToast("🛡️ لا يمكن تجميد حساب مدير النظام الرئيسي!", "error");

    u.isFrozen = !u.isFrozen;
    saveData();
    renderUsersTable();

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
    const u = users[idx];
    if (!u) return;

    const newPin = prompt(`🔑 أدخل رمز الدخول الجديد (PIN مكون من 4 أرقام) للموظف [${u.name}]:`, u.pin);
    if (newPin === null) return;
    const cleanPin = String(newPin).trim();

    if (!cleanPin || cleanPin.length !== 4 || isNaN(cleanPin)) {
        return showToast("⚠️ يجب أن يكون الرمز PIN مكوناً من 4 أرقام عددية!", "error");
    }

    const pinExists = users.some((other, i) => i !== idx && other.pin === cleanPin);
    if (pinExists) {
        return showToast("🚫 رمز PIN هذا مستخدم بالفعل لموظف آخر!", "error");
    }

    u.pin = cleanPin;
    saveData();
    renderUsersTable();
    showToast(`✅ تم تغيير رمز PIN للموظف (${u.name}) بنجاح!`, "success");

    if (typeof logAuditAction === 'function') logAuditAction('تغيير PIN لموظف', `الاسم: ${u.name}`);
}

function openCopyPermissionsModal(targetIdx) {
    const targetUser = users[targetIdx];
    if (!targetUser) return;

    const otherUsers = users.filter((u, i) => i !== targetIdx);
    if (otherUsers.length === 0) {
        return showToast("⚠️ لا يوجد موظفون آخرون لنسخ الصلاحيات منهم!", "info");
    }

    let optionsHtml = otherUsers.map(u => `<option value="${u.id}">${u.name} (${u.role === 'admin' ? 'مدير' : 'موظف'})</option>`).join('');

    const modalHtml = `
        <div id="copyPermModalOverlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6);  z-index:12000; display:flex; align-items:center; justify-content:center; direction:rtl; font-family:'Cairo',sans-serif;">
            <div style="background:white; border-radius:20px; width:450px; max-width:90%; padding:25px; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #f1f5f9; padding-bottom:12px; margin-bottom:18px;">
                    <h3 style="margin:0; font-size:1.15rem; color:#1e293b; font-weight:900;">📋 نسخ الصلاحيات إلى: <span style="color:#0284c7;">${targetUser.name}</span></h3>
                    <button onclick="document.getElementById('copyPermModalOverlay').remove()" style="background:transparent; border:none; font-size:1.3rem; cursor:pointer; color:#94a3b8;">&times;</button>
                </div>
                <div style="margin-bottom:20px;">
                    <label style="display:block; font-weight:800; color:#475569; margin-bottom:8px; font-size:0.9rem;">اختر الموظف المُراد نسخ صلاحياته:</label>
                    <select id="sourceUserSelect" style="width:100%; height:45px; border-radius:12px; border:2px solid #e2e8f0; font-weight:bold; padding:0 12px; font-size:0.9rem;">
                        ${optionsHtml}
                    </select>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button onclick="document.getElementById('copyPermModalOverlay').remove()" style="padding:10px 20px; border-radius:10px; background:#f1f5f9; border:none; font-weight:bold; color:#64748b; cursor:pointer;">إلغاء</button>
                    <button onclick="executeCopyPermissions(${targetIdx})" style="padding:10px 25px; border-radius:10px; background:linear-gradient(135deg, #0284c7, #0369a1); border:none; font-weight:900; color:white; cursor:pointer;">تأكيد النسخ 📋</button>
                </div>
            </div>
        </div>
    `;

    const existing = document.getElementById('copyPermModalOverlay');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function executeCopyPermissions(targetIdx) {
    const select = document.getElementById('sourceUserSelect');
    if (!select) return;
    const sourceId = select.value;
    const sourceUser = users.find(u => String(u.id) === String(sourceId));
    const targetUser = users[targetIdx];

    if (!sourceUser || !targetUser) return;

    // نسخ الصلاحيات والدور بعمق
    targetUser.role = sourceUser.role;
    targetUser.permissions = JSON.parse(JSON.stringify(sourceUser.permissions || {}));

    saveData();
    renderUsersTable();
    const modal = document.getElementById('copyPermModalOverlay');
    if (modal) modal.remove();

    showToast(`✅ تم نسخ صلاحيات (${sourceUser.name}) إلى (${targetUser.name}) بنجاح!`, "success");
    if (typeof logAuditAction === 'function') logAuditAction('نسخ صلاحيات', `من: ${sourceUser.name} إلى: ${targetUser.name}`);
}

function addUser() {
    const name = document.getElementById('newUserName').value.trim();
    const pin = document.getElementById('newUserPin').value.trim();
    const role = document.getElementById('newUserRole').value;
    const nfcUid = (document.getElementById('newUserNfcUid') ? document.getElementById('newUserNfcUid').value.trim() : '');

    if (!name || !pin) return showToast("⚠️ يرجى إدخال اسم المستخدم ورمز الدخول", "error");

    if (nfcUid) {
        const existingUser = users.find(u => u.nfcUid === nfcUid && u.id !== window.editingUserId);
        if (existingUser) return showToast(`🚫 كارت NFC (${nfcUid}) مربوط بالفعل بموظف آخر (${existingUser.name})!`, "error");
    }

    const permissions = {
        docs: {
            add: document.getElementById('perm_docs_add').checked,
            purchase: document.getElementById('perm_docs_purchase') ? document.getElementById('perm_docs_purchase').checked : false,
            return: document.getElementById('perm_docs_return') ? document.getElementById('perm_docs_return').checked : false,
            purchase_price: document.getElementById('perm_docs_purchase_price').checked,
            edit: document.getElementById('perm_docs_edit').checked,
            delete: document.getElementById('perm_docs_delete').checked,
            view: document.getElementById('perm_docs_view').checked
        },
        stock: {
            add: document.getElementById('perm_stock_add').checked,
            edit: document.getElementById('perm_stock_edit').checked,
            delete: document.getElementById('perm_stock_delete').checked,
            transfer: document.getElementById('perm_stock_transfer').checked,
            view: document.getElementById('perm_stock_view').checked
        },
        accounts: {
            add: document.getElementById('perm_acc_add').checked,
            edit: document.getElementById('perm_acc_edit').checked,
            delete: document.getElementById('perm_acc_delete').checked,
            statement: document.getElementById('perm_acc_statement').checked,
            view: document.getElementById('perm_acc_view').checked
        },
        general: {
            reports: document.getElementById('perm_gen_reports').checked,
            profits: document.getElementById('perm_gen_profits').checked,
            settings: document.getElementById('perm_gen_settings').checked,
            users: document.getElementById('perm_gen_users').checked
        }
    };

    const existingTarget = window.editingUserId ? users.find(u => u.id === window.editingUserId) : null;
    const isFrozen = existingTarget ? !!existingTarget.isFrozen : false;

    const newUser = { 
        id: window.editingUserId || Date.now(), 
        name, 
        pin, 
        role, 
        nfcUid: nfcUid || '',
        isFrozen: isFrozen,
        permissions 
    };

    const isUpdating = !!window.editingUserId;
    if (window.editingUserId) {
        const idx = users.findIndex(u => u.id === window.editingUserId);
        if (idx !== -1) users[idx] = newUser;
        window.editingUserId = null;
        showToast("✅ تم تحديث بيانات الموظف بنجاح", "success");
    } else {
        if (users.some(u => u.name === name)) return showToast("🚫 اسم المستخدم موجود بالفعل!", "error");
        users.push(newUser);
        showToast("✅ تم إضافة الموظف الجديد بنجاح", "success");
    }

    saveData();
    renderUsersTable();
    resetUserForm();
    
    if (typeof logAuditAction === 'function') logAuditAction(isUpdating ? 'تحديث موظف' : 'إضافة موظف جديد', `الاسم: ${newUser.name}, الدور: ${newUser.role}, كارت NFC: ${newUser.nfcUid || 'لا يوجد'}`);
    if (typeof syncUsersToCloud === 'function') syncUsersToCloud();
}

function toggleAdminPermsUI(role) {
    const container = document.getElementById('permPanelsContainer');
    const msg = document.getElementById('adminFullAccessMsg');
    if (!container || !msg) return;
    if (role === 'admin') {
        container.style.display = 'none';
        msg.style.display = 'block';
    } else {
        container.style.display = 'block';
        msg.style.display = 'none';
    }
}

window.editingUserId = null;
function editUser(idx) {
    const u = users[idx];
    window.editingUserId = u.id;
    document.getElementById('newUserName').value = u.name;
    document.getElementById('newUserPin').value = u.pin;
    document.getElementById('newUserRole').value = u.role;
    if (document.getElementById('newUserNfcUid')) {
        document.getElementById('newUserNfcUid').value = u.nfcUid || '';
    }
    toggleAdminPermsUI(u.role);

    const p = u.permissions || {};
    if (p.docs) {
        document.getElementById('perm_docs_add').checked = !!p.docs.add;
        if (document.getElementById('perm_docs_purchase')) document.getElementById('perm_docs_purchase').checked = !!p.docs.purchase;
        if (document.getElementById('perm_docs_return')) document.getElementById('perm_docs_return').checked = !!p.docs.return;
        document.getElementById('perm_docs_purchase_price').checked = !!p.docs.purchase_price;
        document.getElementById('perm_docs_edit').checked = !!p.docs.edit;
        document.getElementById('perm_docs_delete').checked = !!p.docs.delete;
        document.getElementById('perm_docs_view').checked = !!p.docs.view;
    }
    if (p.stock) {
        document.getElementById('perm_stock_add').checked = !!p.stock.add;
        document.getElementById('perm_stock_edit').checked = !!p.stock.edit;
        document.getElementById('perm_stock_delete').checked = !!p.stock.delete;
        document.getElementById('perm_stock_transfer').checked = !!p.stock.transfer;
        document.getElementById('perm_stock_view').checked = !!p.stock.view;
    }
    if (p.accounts) {
        document.getElementById('perm_acc_add').checked = !!p.accounts.add;
        document.getElementById('perm_acc_edit').checked = !!p.accounts.edit;
        document.getElementById('perm_acc_delete').checked = !!p.accounts.delete;
        document.getElementById('perm_acc_statement').checked = !!p.accounts.statement;
        document.getElementById('perm_acc_view').checked = !!p.accounts.view;
    }
    if (p.general) {
        document.getElementById('perm_gen_reports').checked = !!p.general.reports;
        document.getElementById('perm_gen_profits').checked = !!p.general.profits;
        document.getElementById('perm_gen_settings').checked = !!p.general.settings;
        document.getElementById('perm_gen_users').checked = !!p.general.users;
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
    document.querySelectorAll('#permissionsGrid input[type="checkbox"]').forEach(chk => {
        chk.checked = chk.id.includes('view') || chk.id.includes('reports') || chk.id.includes('add');
    });
}

function deleteUser(idx) {
    if (confirm("هل أنت متأكد من حذف هذا المستخدم؟")) {
        const u = users[idx];
        if (typeof addToTrash === 'function') addToTrash('user', u, `مستخدم: ${u.name}`);
        const deletedName = u.name;
        users.splice(idx, 1);
        saveData();
        renderUsersTable();
        if (typeof trashManager !== 'undefined' && trashManager.renderTrashTable) trashManager.renderTrashTable();

        if (typeof logAuditAction === 'function') logAuditAction('حذف مستخدم', `الاسم: ${deletedName}`);
        if (typeof syncUsersToCloud === 'function') syncUsersToCloud();
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
    // ✅ أمان: التحقق من صحة المستخدم عبر مصفوفة users المحملة من IndexedDB
    // لا نثق بالبيانات المخزنة في localStorage مباشرة لأن أي شخص يستطيع تعديلها
    if (!currentUser) return false;

    // إعادة التحقق من الـ PIN مقابل مصفوفة users الحقيقية من IndexedDB
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

        // نستخدم بيانات المستخدم الحقيقية من IndexedDB (ليس من localStorage)
        if (realUser.role === 'admin') return true;

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
        if (userPerms && userPerms[perm]) return true;

        showCustomAlert({
            type: 'error',
            titleText: '🚫 وصول مرفوض',
            msg: 'عذراً، ليس لديك صلاحية للقيام بهذا الإجراء (' + (action.replace('_', ' ')) + '). يرجى مراجعة مدير النظام.'
        });
        return false;
    }

    // Fallback: لو مصفوفة users لم تُحمَّل بعد، نعتمد على currentUser المحمل في الذاكرة
    if (currentUser.isFrozen) return false;
    if (currentUser.role === 'admin') return true;

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
    if (userPerms && userPerms[perm]) return true;

    showCustomAlert({
        type: 'error',
        titleText: '🚫 وصول مرفوض',
        msg: 'عذراً، ليس لديك صلاحية للقيام بهذا الإجراء (' + (action.replace('_', ' ')) + '). يرجى مراجعة مدير النظام.'
    });
    return false;
}

function hasPermission(action) {
    if (!currentUser) return false;
    // ✅ أمان: التحقق من الـ PIN مقابل مصفوفة users من IndexedDB
    if (typeof users !== 'undefined' && users.length > 0) {
        const realUser = users.find(u => u.pin === currentUser.pin);
        if (!realUser) return false;
        if (realUser.isFrozen) return false;
        if (realUser.role === 'admin') return true;
        if (!realUser.permissions) return false;
        const { module, perm } = resolvePermissionKey(action);
        const userPerms = realUser.permissions[module];
        return !!(userPerms && userPerms[perm]);
    }
    // Fallback لو users لم تُحمَّل بعد
    if (currentUser.isFrozen) return false;
    if (currentUser.role === 'admin') return true;
    if (!currentUser.permissions) return false;
    const { module, perm } = resolvePermissionKey(action);
    const userPerms = currentUser.permissions[module];
    return !!(userPerms && userPerms[perm]);
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
                if (typeof setStore === 'function') setStore('pos_session_user', JSON.stringify(currentUser));
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
            <tr style="border-bottom: 1px solid #f1f5f9; ${isCurrent ? 'background: #fffdf0;' : ''}">
                <td style="padding: 10px 12px; font-weight: 800; color: #1e293b; white-space: nowrap;">
                    ${w.name} ${isCurrent ? '<span style="background: #f59e0b; color: #1a1600; padding: 2px 6px; border-radius: 6px; font-size: 0.72rem; font-weight: 900; margin-right: 4px; display: inline-block;">نشط</span>' : ''}
                </td>
                <td style="padding: 10px 12px; color: #64748b; font-weight: 600;">${w.address || '-'}</td>
                <td style="padding: 10px 12px; text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                        <button type="button" style="padding: 5px 10px; font-size: 0.8rem; background: #f59e0b; color: #ffffff; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;" onclick="editWarehouse(${idx})">تعديل</button>
                        <button type="button" style="padding: 5px 10px; font-size: 0.8rem; background: #ef4444; color: #ffffff; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;" onclick="deleteWarehouse(${idx})">حذف</button>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;

    updateSettingsWarehouseSelect();
    initTransferPriceTypeSetting();
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
        : ((typeof getStore === 'function' ? getStore('transferPriceType') : localStorage.getItem('transferPriceType')) || 'cost');
    sel.value = current;
};

window.saveTransferPriceTypeSetting = async function(val) {
    if (!val) val = 'cost';
    if (typeof setStore === 'function') {
        setStore('transferPriceType', val);
    }
    localStorage.setItem('transferPriceType', val);

    try {
        const settingsObj = JSON.parse((typeof getStore === 'function' ? getStore('pos_settings') : null) || localStorage.getItem('pos_settings') || '{}');
        settingsObj.transferPriceType = val;
        if (typeof setStore === 'function') setStore('pos_settings', JSON.stringify(settingsObj));
        localStorage.setItem('pos_settings', JSON.stringify(settingsObj));
    } catch(e) {}

    if (typeof saveData === 'function') {
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

function applyWarehouseSwitchFromSettings() {
    const val = document.getElementById('settingsActiveWarehouseSelect').value;
    if (currentUser) {
        currentUser.warehouseName = val;
        // ✅ أمان: نحفظ pin فقط (لا role أو permissions)
        setStore('pos_session_user', JSON.stringify({ pin: currentUser.pin, warehouseName: val }));
        const whHeader = document.getElementById('currentWarehouseName');
        if (whHeader) whHeader.innerText = ` 📦 ${val}`;
        showToast(`تم تغيير المستودع النشط إلى: ${val}`, "success");
        updateWarehousesSummaryBoard();
        
        // تحديث كافة الجداول لعرض بيانات المخزن الجديد فوراً
        if (typeof renderInventoryTable === 'function') renderInventoryTable();
        if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
        if (typeof renderPOSCart === 'function') renderPOSCart();
        if (typeof updateNotifications === 'function') updateNotifications();
        if (typeof window.checkIncomingTransfersAlert === 'function') window.checkIncomingTransfersAlert();
    }
}

window.filterInventoryByWarehouse = function(whName) {
    if (!whName) return;
    if (typeof currentUser !== 'undefined' && currentUser) {
        currentUser.warehouseName = whName;
        if (typeof setStore === 'function') {
            setStore('pos_session_user', JSON.stringify(currentUser));
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
 * تقوم بحذف كافة البيانات من Dexie ومسح الإعدادات مع الحفاظ على هوية الجهاز
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
                // 1. مسح جداول البيانات فقط من Dexie (نحافظ على جدول settings الذي يحتوي HWID + الترخيص + مفتاح AI)
                const tables = ['products', 'transactions', 'accounts', 'users', 'trash', 'auditLogs', 'wallpapers'];
                if (typeof db !== 'undefined') {
                    for (const table of tables) {
                        if (db[table]) await db[table].clear();
                    }
                }

                // 2. مسح localStorage بالكامل (البيانات الحساسة في IndexedDB settings الآن)
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
    await saveData();
}

function changeAppColor(color) {
    document.documentElement.style.setProperty('--main-green', color);
    const settings = JSON.parse(getStore('pos_settings') || '{}');
    settings.mainColor = color;
    setStore('pos_settings', JSON.stringify(settings));
}



