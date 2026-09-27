// ============================================================
//  تقرير الحركة اليومية وتحليل الأرباح والديون (Daily & Analysis Reports)
// ============================================================

        function populateDailyReportUserSelect() {
            const selectEl = document.getElementById('dailyReportUserSelect');
            if (!selectEl) return;

            const curUser = (typeof currentUser !== 'undefined') ? currentUser : null;
            const isAdmin = curUser ? (curUser.role === 'admin') : true;

            let isLockedUser = !isAdmin;
            const uTarget = (curUser && typeof users !== 'undefined' && Array.isArray(users))
                ? (users.find(u => u.pin === curUser.pin || u.name === curUser.name) || curUser)
                : curUser;

            if (uTarget && uTarget.permissions && uTarget.permissions.general && uTarget.permissions.general.lockDailyUser !== undefined) {
                isLockedUser = !!uTarget.permissions.general.lockDailyUser;
            }
            if (!isAdmin && uTarget && (uTarget.invoiceScope === 'user_only' || (curUser && curUser.invoiceScope === 'user_only'))) {
                isLockedUser = true;
            }

            if (isLockedUser) {
                const myName = (curUser && curUser.name) ? curUser.name : 'الكاشير الحالي';
                selectEl.innerHTML = `<option value="${myName}" selected>🔒 ورديتك الحالية: ${myName}</option>`;
                selectEl.disabled = true;
                selectEl.style.backgroundColor = '#f1f5f9';
                selectEl.style.cursor = 'not-allowed';
                selectEl.title = 'تم قفل التقرير على ورديتك الحالية لحماية الخصوصية ومنع استعراض تقارير الآخرين';
                return;
            }

            selectEl.disabled = false;
            selectEl.style.backgroundColor = '#ffffff';
            selectEl.style.cursor = 'pointer';
            selectEl.title = 'اختر مستخدم أو كاشير محدد لاستعراض ورديته، أو اختر كافة المستخدمين';

            const currentVal = selectEl.value || 'all';

            const userMap = new Map();
            if (typeof users !== 'undefined' && Array.isArray(users)) {
                users.forEach(u => {
                    if (u && u.name) {
                        const trimmed = u.name.trim();
                        userMap.set(trimmed, { name: trimmed, role: u.role || 'user' });
                    }
                });
            }
            if (typeof transactions !== 'undefined' && Array.isArray(transactions)) {
                transactions.forEach(t => {
                    const tUser = (t.user || '').trim();
                    if (tUser && tUser !== '-' && !userMap.has(tUser)) {
                        const isLikelyAdmin = tUser.toLowerCase().includes('مدير') || tUser.toLowerCase().includes('admin');
                        userMap.set(tUser, { name: tUser, role: isLikelyAdmin ? 'admin' : 'user' });
                    }
                });
            }

            let opts = `<option value="all">👥 كافة المستخدمين والكاشيرات (إجمالي شامل)</option>`;
            const adminNames = (typeof window.getAdminUserNames === 'function')
                ? window.getAdminUserNames()
                : new Set(['المدير', 'المدير العام', 'مدير النظام', 'admin']);
            const shouldHideAdmin = !isAdmin && uTarget && (uTarget.invoiceScope === 'hide_admin' || (curUser && curUser.invoiceScope === 'hide_admin'));

            userMap.forEach((uObj, uName) => {
                const isAdm = (uObj.role === 'admin' || adminNames.has(uName.toLowerCase()) || uName.toLowerCase().includes('مدير') || uName.toLowerCase().includes('admin'));
                if (shouldHideAdmin && isAdm) {
                    return; // إخفاء حسابات الإدارة من قائمة الاختيار للموظف
                }
                if (isAdm) {
                    opts += `<option value="${uName}">⭐ المدير: ${uName}</option>`;
                } else {
                    opts += `<option value="${uName}">👤 كاشير: ${uName}</option>`;
                }
            });

            selectEl.innerHTML = opts;
            if (userMap.has(currentVal) || currentVal === 'all') {
                selectEl.value = currentVal;
            } else {
                selectEl.value = 'all';
            }
        }
        window.populateDailyReportUserSelect = populateDailyReportUserSelect;

        function checkAndApplyDailyReportDateLock() {
            const curUser = (typeof currentUser !== 'undefined') ? currentUser : null;
            const isAdmin = curUser ? (curUser.role === 'admin') : true;

            let isLockedDate = false;
            if (curUser && !isAdmin) {
                const uTarget = (typeof users !== 'undefined' && Array.isArray(users))
                    ? (users.find(u => u.pin === curUser.pin || u.name === curUser.name) || curUser)
                    : curUser;

                if (uTarget && uTarget.permissions && uTarget.permissions.general && uTarget.permissions.general.lockDailyDate !== undefined) {
                    isLockedDate = !!uTarget.permissions.general.lockDailyDate;
                } else {
                    isLockedDate = true; // الافتراضي للموظفين القفل لحماية سرية المبيعات السابقة
                }
            }

            const fromEl = document.getElementById('reportDateFrom');
            const toEl = document.getElementById('reportDateTo');
            const periodEl = document.getElementById('dailyReportPeriodFilter');
            const todayISO = new Date().toLocaleDateString('en-CA');

            if (isLockedDate) {
                if (fromEl) {
                    fromEl.value = todayISO;
                    fromEl.disabled = true;
                    fromEl.style.backgroundColor = '#f1f5f9';
                    fromEl.style.cursor = 'not-allowed';
                    fromEl.style.color = '#475569';
                    fromEl.title = '🔒 تم قفل التاريخ على اليوم الحالي لحماية سرية مبيعات الفترات السابقة';
                }
                if (toEl) {
                    toEl.value = todayISO;
                    toEl.disabled = true;
                    toEl.style.backgroundColor = '#f1f5f9';
                    toEl.style.cursor = 'not-allowed';
                    toEl.style.color = '#475569';
                    toEl.title = '🔒 تم قفل التاريخ على اليوم الحالي لحماية سرية مبيعات الفترات السابقة';
                }
                if (periodEl) {
                    periodEl.value = 'today';
                    periodEl.disabled = true;
                    periodEl.style.backgroundColor = '#f1f5f9';
                    periodEl.style.cursor = 'not-allowed';
                    periodEl.title = '🔒 تم قفل التقرير على اليوم الحالي فقط';
                }
            } else {
                if (fromEl) {
                    fromEl.disabled = false;
                    fromEl.style.backgroundColor = '';
                    fromEl.style.cursor = '';
                    fromEl.style.color = '';
                    fromEl.title = '';
                }
                if (toEl) {
                    toEl.disabled = false;
                    toEl.style.backgroundColor = '';
                    toEl.style.cursor = '';
                    toEl.style.color = '';
                    toEl.title = '';
                }
                if (periodEl) {
                    periodEl.disabled = false;
                    periodEl.style.backgroundColor = '';
                    periodEl.style.cursor = '';
                    periodEl.title = '';
                }
            }

            return isLockedDate;
        }
        window.checkAndApplyDailyReportDateLock = checkAndApplyDailyReportDateLock;

        // 🔒 فحص وتطبيق الإخفاء التلقائي لمبالغ تقرير اليومية بناءً على صلاحية الموظف
        function checkAndApplyDailyReportAmountsLock() {
            const curUser = (typeof currentUser !== 'undefined') ? currentUser : null;
            const isAdmin = curUser ? (curUser.role === 'admin') : true;

            let isLockedAmounts = false;
            if (curUser && !isAdmin) {
                const uTarget = (typeof users !== 'undefined' && Array.isArray(users))
                    ? (users.find(u => u.pin === curUser.pin || u.name === curUser.name) || curUser)
                    : curUser;

                if (uTarget && uTarget.permissions && uTarget.permissions.general && uTarget.permissions.general.lockDailyAmounts !== undefined) {
                    isLockedAmounts = !!uTarget.permissions.general.lockDailyAmounts;
                } else {
                    isLockedAmounts = true; // الافتراضي للموظفين حماية الأرقام
                }
            }

            if (isLockedAmounts) {
                if (!document.body.classList.contains('daily-amounts-hidden')) {
                    document.body.classList.add('daily-amounts-hidden');
                }
                const iconEl = document.getElementById('dailyAmountsEyeIcon');
                const textEl = document.getElementById('dailyAmountsEyeText');
                const btn = document.getElementById('toggleDailyAmountsBtn');
                if (iconEl) iconEl.innerText = '🔒';
                if (textEl) textEl.innerText = 'إظهار المبالغ';
                if (btn) {
                    btn.style.background = '#fef3c7';
                    btn.style.borderColor = '#fde68a';
                    btn.style.color = '#b45309';
                    btn.title = 'انقر لإدخال رمز PIN المدير وإظهار المبالغ المالية';
                }
            }
            return isLockedAmounts;
        }
        // =========================================================================
        // ⚙️ محرك تخصيص بنود وعناصر تقرير الحركة اليومية (Daily Report Customizer Engine)
        // =========================================================================

        const DEFAULT_DAILY_REPORT_CUSTOM_CONFIG = {
            showTreasuryTable: true, // إظهار أو إخفاء جدول حركة الخزينة والدرج بالكامل
            opsRows: {
                retailSales: true,        // مبيعات التجزئة (قطاعي)
                wholesaleSales: true,     // مبيعات الجملة
                totalSales: true,         // إجمالي المبيعات العامة
                vodafoneSales: true,      // مبيعات فودافون كاش
                discounts: true,          // إجمالي الخصومات الممنوحة
                additions: true,          // إجمالي الإضافات والضرائب
                salesReturn: true,        // مرتجع مبيعات
                purchases: true,          // مشتريات
                purchasesReturn: true,    // مرتجع مشتريات
                receipts: true,           // قبض (إيرادات)
                disbursements: true,      // صرف (مصروفات)
                adjustments: true,        // تسوية المخزن
                transfers: true,          // تحويل مخزني
                netRevenue: true,         // صافي الإيرادات والتحصيلات
                allOpsTotal: true         // إجمالي حركة التداول لكافة العمليات
            },
            treasuryRows: {
                cashSales: true,          // مبيعات نقدية (درج الكاش)
                electronicWallets: true,  // فودافون كاش والمحافظ والفيزا
                cashSalesReturn: true,    // مرتجع مبيعات نقدي
                nonCashSalesReturn: true, // مرتجع مبيعات بنكي / فيزا
                cashPurchases: true,      // مشتريات نقدية
                nonCashPurchases: true,   // مشتريات بنكي / فيزا
                cashPurchasesReturn: true,// مرتجع مشتريات نقدي
                nonCashPurchasesReturn: true,// مرتجع مشتريات بنكي / فيزا
                cashReceipts: true,       // قبض نقدي
                nonCashReceipts: true,    // قبض بنكي / إلكتروني
                cashDisbursements: true,  // صرف نقدي
                nonCashDisbursements: true,// صرف بنكي / إلكتروني
                adjustments: true,        // تسوية المخزن
                transfers: true,          // تحويل مخزني
                nonCashNet: true,         // صافي العمليات البنكية والفيزا
                netCashMovement: true,    // صافي نقدية حركة اليوم بالدرج
                previousBalance: true,    // رصيد سابق تراكمي
                finalCashBalance: true    // الإجمالي الدفتري التراكمي
            }
        };
        window.DEFAULT_DAILY_REPORT_CUSTOM_CONFIG = DEFAULT_DAILY_REPORT_CUSTOM_CONFIG;

        function getDailyReportCustomConfig() {
            try {
                const raw = (typeof getStore === 'function')
                    ? (getStore('bayan_daily_report_custom_rows') || localStorage.getItem('bayan_daily_report_custom_rows'))
                    : localStorage.getItem('bayan_daily_report_custom_rows');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    return {
                        showTreasuryTable: parsed.showTreasuryTable !== false,
                        opsRows: { ...DEFAULT_DAILY_REPORT_CUSTOM_CONFIG.opsRows, ...(parsed.opsRows || {}) },
                        treasuryRows: { ...DEFAULT_DAILY_REPORT_CUSTOM_CONFIG.treasuryRows, ...(parsed.treasuryRows || {}) }
                    };
                }
            } catch (e) {}
            return JSON.parse(JSON.stringify(DEFAULT_DAILY_REPORT_CUSTOM_CONFIG));
        }
        window.getDailyReportCustomConfig = getDailyReportCustomConfig;

        function saveDailyReportCustomConfig(cfg) {
            try {
                const str = JSON.stringify(cfg);
                if (typeof setStore === 'function') setStore('bayan_daily_report_custom_rows', str);
                try { localStorage.setItem('bayan_daily_report_custom_rows', str); } catch(e) {}
                return true;
            } catch (e) {
                console.error("Error saving daily report custom config:", e);
                return false;
            }
        }
        window.saveDailyReportCustomConfig = saveDailyReportCustomConfig;

        function resetDailyReportCustomConfig() {
            const def = JSON.parse(JSON.stringify(DEFAULT_DAILY_REPORT_CUSTOM_CONFIG));
            saveDailyReportCustomConfig(def);
            return def;
        }
        window.resetDailyReportCustomConfig = resetDailyReportCustomConfig;

        // دالة فتح نافذة تخصيص بنود وعناصر تقرير الحركة اليومية
        window.openDailyReportCustomizerModal = function() {
            if (typeof checkColumnCustomizationPermission === 'function' && !checkColumnCustomizationPermission()) return;
            let existing = document.getElementById('dailyReportCustomizerModal');
            if (existing) existing.remove();

            const currentCfg = window.getDailyReportCustomConfig();

            const opsItems = [
                { key: 'retailSales', icon: '🛍️', label: 'مبيعات التجزئة (قطاعي)' },
                { key: 'wholesaleSales', icon: '📦', label: 'مبيعات الجملة' },
                { key: 'totalSales', icon: '🛒', label: 'إجمالي المبيعات العامة' },
                { key: 'vodafoneSales', icon: '📱', label: 'مبيعات فودافون كاش' },
                { key: 'discounts', icon: '🏷️', label: 'إجمالي الخصومات الممنوحة' },
                { key: 'additions', icon: '➕', label: 'إجمالي الإضافات والضرائب' },
                { key: 'salesReturn', icon: '🔄', label: 'مرتجع مبيعات' },
                { key: 'purchases', icon: '🧺', label: 'مشتريات' },
                { key: 'purchasesReturn', icon: '🔙', label: 'مرتجع مشتريات' },
                { key: 'receipts', icon: '💰', label: 'قبض (إيرادات)' },
                { key: 'disbursements', icon: '💸', label: 'صرف (مصروفات)' },
                { key: 'adjustments', icon: '⚖️', label: 'تسوية المخزن' },
                { key: 'transfers', icon: '🚚', label: 'تحويل مخزني' },
                { key: 'netRevenue', icon: '💰', label: 'صافي الإيرادات والتحصيلات' },
                { key: 'allOpsTotal', icon: '🎯', label: 'صافي نقدية اليومية والتقفيل (جرد الدرج)' }
            ];

            const trItems = [
                { key: 'cashSales', icon: '🛒', label: 'مبيعات نقدية (درج الكاش)' },
                { key: 'electronicWallets', icon: '📱', label: 'فودافون كاش والمحافظ والفيزا' },
                { key: 'cashSalesReturn', icon: '🔄', label: 'مرتجع مبيعات نقدي' },
                { key: 'nonCashSalesReturn', icon: '💳', label: 'مرتجع مبيعات بنكي / فيزا' },
                { key: 'cashPurchases', icon: '🧺', label: 'مشتريات نقدية' },
                { key: 'nonCashPurchases', icon: '🏦', label: 'مشتريات بنكي / فيزا' },
                { key: 'cashPurchasesReturn', icon: '🔙', label: 'مرتجع مشتريات نقدي' },
                { key: 'nonCashPurchasesReturn', icon: '💳', label: 'مرتجع مشتريات بنكي / فيزا' },
                { key: 'cashReceipts', icon: '💰', label: 'قبض نقدي' },
                { key: 'nonCashReceipts', icon: '💳', label: 'قبض بنكي / إلكتروني' },
                { key: 'cashDisbursements', icon: '💸', label: 'صرف نقدي' },
                { key: 'nonCashDisbursements', icon: '🏦', label: 'صرف بنكي / إلكتروني' },
                { key: 'adjustments', icon: '⚖️', label: 'تسوية المخزن' },
                { key: 'transfers', icon: '🚚', label: 'تحويل مخزني' },
                { key: 'nonCashNet', icon: '💳', label: 'صافي العمليات البنكية والفيزا' },
                { key: 'netCashMovement', icon: '🔄', label: 'صافي نقدية حركة اليوم بالدرج' },
                { key: 'previousBalance', icon: '⏺️', label: 'رصيد سابق تراكمي' },
                { key: 'finalCashBalance', icon: '💰', label: 'الإجمالي الدفتري التراكمي' }
            ];

            const modal = document.createElement('div');
            modal.id = 'dailyReportCustomizerModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px); z-index: 100000; display: flex; justify-content: center; align-items: center; padding: 15px; box-sizing: border-box; direction: rtl; font-family: inherit; animation: fadeIn 0.2s;';

            modal.innerHTML = `
                <div style="background: #ffffff; color: #0f172a; border-radius: 24px; width: 100%; max-width: 760px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 35px 80px rgba(15, 23, 42, 0.28); border: 2px solid #e2e8f0; animation: slideUp 0.3s ease; overflow: hidden;">
                    
                    <!-- الهيدر بتدرج داكن وفخم متناسق تماماً -->
                    <div style="padding: 16px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color: white; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #4f46e5, #4338ca); display: flex; align-items: center; justify-content: center; font-size: 1.35rem; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">
                                ⚙️
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.22rem; font-weight: 900; color: #f8fafc; letter-spacing: -0.3px;">تخصيص بنود وعناصر تقرير الحركة اليومية</h3>
                                <p style="margin: 2px 0 0; font-size: 0.78rem; color: #94a3b8; font-weight: 700;">تحكم في إظهار أو إخفاء البنود والصفوف المحددة بحسب طبيعة نشاطك التجاري</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('dailyReportCustomizerModal').remove()" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: #fff; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.85)'" onmouseout="this.style.background='rgba(255,255,255,0.12)'">&times;</button>
                    </div>

                    <!-- شريط التبويبات العلوي (Custom Tabs Bar - خانتان رئيسيتان بالأعلى: يمين وشمال وبينهما فاصل) -->
                    <div style="display: flex; align-items: stretch; background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 8px 16px 0 16px; gap: 4px;">
                        
                        <!-- الخانة الأولى: ملخص العمليات المالية (ناحية اليمين) -->
                        <div id="tabBtn_customizer_ops" onclick="window.switchDailyCustomizerTab('ops')" 
                            style="flex: 1; padding: 12px 14px; text-align: center; cursor: pointer; font-weight: 900; font-size: 0.94rem; transition: all 0.2s; border-radius: 12px 12px 0 0; border: 1.5px solid #cbd5e1; border-bottom: 3.5px solid #10b981; color: #047857; background: #ffffff; box-shadow: 0 -2px 10px rgba(0,0,0,0.04); display: flex; align-items: center; justify-content: center; gap: 8px;"
                            onmouseover="if(document.getElementById('tabContent_customizer_ops').style.display !== 'block') this.style.background='#f1f5f9';"
                            onmouseout="if(document.getElementById('tabContent_customizer_ops').style.display !== 'block') this.style.background='transparent';">
                            <span>📊 الخانة الأولى: ملخص العمليات المالية</span>
                            <span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-size: 0.74rem; font-weight: 900; padding: 2px 8px; border-radius: 12px;">15 بند</span>
                        </div>

                        <!-- فاصل رأسي أنيق بين الخانة الأولى والخانة الثانية -->
                        <div style="width: 2px; height: 32px; background: #cbd5e1; border-radius: 2px; align-self: center; margin: 0 4px;"></div>

                        <!-- الخانة الثانية: حركة الخزينة والدرج (ناحية الشمال) -->
                        <div id="tabBtn_customizer_tr" onclick="window.switchDailyCustomizerTab('tr')" 
                            style="flex: 1; padding: 12px 14px; text-align: center; cursor: pointer; font-weight: 900; font-size: 0.94rem; transition: all 0.2s; border-radius: 12px 12px 0 0; border: 1.5px solid transparent; border-bottom: 3.5px solid transparent; color: #64748b; background: transparent; display: flex; align-items: center; justify-content: center; gap: 8px;"
                            onmouseover="if(document.getElementById('tabContent_customizer_tr').style.display !== 'block') this.style.background='#f1f5f9';"
                            onmouseout="if(document.getElementById('tabContent_customizer_tr').style.display !== 'block') this.style.background='transparent';">
                            <span>💰 الخانة الثانية: حركة الخزينة والدرج</span>
                            <span style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.74rem; font-weight: 900; padding: 2px 8px; border-radius: 12px;">18 بند</span>
                        </div>
                    </div>

                    <!-- المحتوى القابل للتمرير -->
                    <div style="padding: 18px 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px;">

                        <!-- محتوى التبويب الأول: ملخص العمليات المالية -->
                        <div id="tabContent_customizer_ops" style="display: block;">
                            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 0.88rem; color: #334155;">
                                    <span>⚙️</span> حدد البنود المراد ظهورها في جدول ملخص العمليات اليومية:
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button type="button" onclick="window.setAllCustomizerCheckboxes('ops', true)" style="background: #ffffff; border: 1.5px solid #cbd5e1; padding: 5px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; color: #047857; cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='#10b981'">✅ تحديد الكل</button>
                                    <button type="button" onclick="window.setAllCustomizerCheckboxes('ops', false)" style="background: #ffffff; border: 1.5px solid #cbd5e1; padding: 5px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; color: #b91c1c; cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='#ef4444'">❌ إلغاء الكل</button>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                ${opsItems.map(item => {
                                    const isChecked = currentCfg.opsRows[item.key] !== false;
                                    return `
                                    <label style="display: flex; align-items: center; gap: 10px; background: ${isChecked ? '#f8fafc' : '#ffffff'}; border: 1.5px solid ${isChecked ? '#cbd5e1' : '#f1f5f9'}; padding: 10px 12px; border-radius: 12px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='#10b981'; this.style.background='#ecfdf5';" onmouseout="this.style.borderColor='${isChecked ? '#cbd5e1' : '#f1f5f9'}'; this.style.background='${isChecked ? '#f8fafc' : '#ffffff'}';">
                                        <input type="checkbox" id="chk_ops_${item.key}" class="customizer-ops-chk" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #059669; cursor: pointer;">
                                        <span style="font-size: 1.15rem;">${item.icon}</span>
                                        <span style="font-weight: 800; font-size: 0.88rem; color: #1e293b;">${item.label}</span>
                                    </label>`;
                                }).join('')}
                            </div>
                        </div>

                        <!-- محتوى التبويب الثاني: حركة الخزينة والدرج -->
                        <div id="tabContent_customizer_tr" style="display: none;">
                            <!-- شريط المفتاح الرئيسي للجدول كاملاً -->
                            <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1.5px solid #bfdbfe; padding: 12px 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 1.3rem;">⚡</span>
                                    <div>
                                        <div style="font-weight: 900; font-size: 0.95rem; color: #1e40af;">التحكم الرئيسي بجدول الخزينة والدرج</div>
                                        <div style="font-size: 0.78rem; color: #3b82f6; font-weight: 700;">يمكنك إظهار أو إخفاء جدول حركة الخزينة بالكامل بنقرة واحدة</div>
                                    </div>
                                </div>
                                <label style="display: flex; align-items: center; gap: 8px; background: #ffffff; border: 2px solid #3b82f6; padding: 6px 14px; border-radius: 10px; cursor: pointer; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.15);">
                                    <input type="checkbox" id="customTrMasterSwitch" ${currentCfg.showTreasuryTable !== false ? 'checked' : ''} onchange="window.handleTreasuryMasterSwitch(this.checked)" style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;">
                                    <span style="font-size: 0.86rem; font-weight: 900; color: #1d4ed8;">إظهار الجدول</span>
                                </label>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 12px;">
                                <div style="font-weight: 800; font-size: 0.86rem; color: #475569;">
                                    تحكم منفرد في بنود وحركات النقدية بالدرج:
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button type="button" onclick="window.setAllCustomizerCheckboxes('tr', true)" style="background: #ffffff; border: 1.5px solid #cbd5e1; padding: 5px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; color: #1d4ed8; cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='#3b82f6'">✅ تحديد الكل</button>
                                    <button type="button" onclick="window.setAllCustomizerCheckboxes('tr', false)" style="background: #ffffff; border: 1.5px solid #cbd5e1; padding: 5px 12px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; color: #b91c1c; cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='#ef4444'">❌ إلغاء الكل</button>
                                </div>
                            </div>

                            <div id="trCheckboxesGrid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; opacity: ${currentCfg.showTreasuryTable !== false ? '1' : '0.4'}; pointer-events: ${currentCfg.showTreasuryTable !== false ? 'auto' : 'none'}; transition: opacity 0.25s;">
                                ${trItems.map(item => {
                                    const isChecked = currentCfg.treasuryRows[item.key] !== false;
                                    return `
                                    <label style="display: flex; align-items: center; gap: 10px; background: ${isChecked ? '#f8fafc' : '#ffffff'}; border: 1.5px solid ${isChecked ? '#cbd5e1' : '#f1f5f9'}; padding: 10px 12px; border-radius: 12px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.borderColor='#2563eb'; this.style.background='#eff6ff';" onmouseout="this.style.borderColor='${isChecked ? '#cbd5e1' : '#f1f5f9'}'; this.style.background='${isChecked ? '#f8fafc' : '#ffffff'}';">
                                        <input type="checkbox" id="chk_tr_${item.key}" class="customizer-tr-chk" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;">
                                        <span style="font-size: 1.15rem;">${item.icon}</span>
                                        <span style="font-weight: 800; font-size: 0.88rem; color: #1e293b;">${item.label}</span>
                                    </label>`;
                                }).join('')}
                            </div>
                        </div>

                        <!-- 🔒 التنبيه الأمني الثابت -->
                        <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 10px 14px; font-size: 0.82rem; color: #92400e; font-weight: 700; line-height: 1.5; display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <span style="font-size: 1.25rem;">🔒</span>
                            <span><b>تذكير:</b> لوحة <b>نقدية الدرج الورقي المطلوب وجرد الوردية (المطلوب والفعلي والعجز والزيادة)</b> تظل ثابتة ومفعلة دائماً لضمان دقة الحسابات، وملخص الأرباح يُدار من إعدادات الصلاحيات.</span>
                        </div>

                    </div>

                    <!-- الفوتر وأزرار التحكم -->
                    <div style="padding: 14px 22px; background: #f8fafc; border-top: 1.5px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <button type="button" onclick="window.applyAndSaveDailyReportCustomizer()" style="background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; border: none; padding: 11px 26px; border-radius: 12px; font-weight: 900; font-size: 0.98rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                            <span>💾</span> حفظ وتطبيق التخصيص
                        </button>
                        <div style="display: flex; gap: 10px;">
                            <button type="button" onclick="window.resetDailyReportCustomizerUI()" style="background: #ffffff; color: #475569; border: 1.5px solid #cbd5e1; padding: 10px 18px; border-radius: 12px; font-weight: 800; font-size: 0.9rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#f1f5f9'">
                                🔄 استعادة الافتراضي
                            </button>
                            <button type="button" onclick="document.getElementById('dailyReportCustomizerModal').remove()" style="background: #ffffff; color: #dc2626; border: 1.5px solid #fca5a5; padding: 10px 18px; border-radius: 12px; font-weight: 800; font-size: 0.9rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#fef2f2'">
                                إلغاء ✕
                            </button>
                        </div>
                    </div>

                </div>
            `;

            modal.addEventListener('click', function(ev) {
                if (ev.target === modal) modal.remove();
            });

            document.body.appendChild(modal);
        };

        window.switchDailyCustomizerTab = function(tab) {
            const btnOps = document.getElementById('tabBtn_customizer_ops');
            const btnTr = document.getElementById('tabBtn_customizer_tr');
            const contentOps = document.getElementById('tabContent_customizer_ops');
            const contentTr = document.getElementById('tabContent_customizer_tr');

            if (!btnOps || !btnTr || !contentOps || !contentTr) return;

            if (tab === 'ops') {
                btnOps.style.border = '1.5px solid #cbd5e1';
                btnOps.style.borderBottom = '3.5px solid #10b981';
                btnOps.style.color = '#047857';
                btnOps.style.background = '#ffffff';
                btnOps.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.04)';

                btnTr.style.border = '1.5px solid transparent';
                btnTr.style.borderBottom = '3.5px solid transparent';
                btnTr.style.color = '#64748b';
                btnTr.style.background = 'transparent';
                btnTr.style.boxShadow = 'none';

                contentOps.style.display = 'block';
                contentTr.style.display = 'none';
            } else {
                btnTr.style.border = '1.5px solid #cbd5e1';
                btnTr.style.borderBottom = '3.5px solid #2563eb';
                btnTr.style.color = '#1d4ed8';
                btnTr.style.background = '#ffffff';
                btnTr.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.04)';

                btnOps.style.border = '1.5px solid transparent';
                btnOps.style.borderBottom = '3.5px solid transparent';
                btnOps.style.color = '#64748b';
                btnOps.style.background = 'transparent';
                btnOps.style.boxShadow = 'none';

                contentTr.style.display = 'block';
                contentOps.style.display = 'none';
            }
        };

        window.setAllCustomizerCheckboxes = function(type, checked) {
            const selector = type === 'ops' ? '.customizer-ops-chk' : '.customizer-tr-chk';
            document.querySelectorAll(selector).forEach(chk => {
                chk.checked = checked;
            });
        };

        window.handleTreasuryMasterSwitch = function(checked) {
            const trGrid = document.getElementById('trCheckboxesGrid');
            if (trGrid) {
                trGrid.style.opacity = checked ? '1' : '0.4';
                trGrid.style.pointerEvents = checked ? 'auto' : 'none';
            }
        };

        window.applyAndSaveDailyReportCustomizer = function() {
            const modal = document.getElementById('dailyReportCustomizerModal');
            const showTr = document.getElementById('customTrMasterSwitch')?.checked ?? true;

            const opsItems = ['retailSales', 'wholesaleSales', 'totalSales', 'vodafoneSales', 'discounts', 'additions', 'salesReturn', 'purchases', 'purchasesReturn', 'receipts', 'disbursements', 'adjustments', 'transfers', 'netRevenue', 'allOpsTotal'];
            const trItems = ['cashSales', 'electronicWallets', 'cashSalesReturn', 'nonCashSalesReturn', 'cashPurchases', 'nonCashPurchases', 'cashPurchasesReturn', 'nonCashPurchasesReturn', 'cashReceipts', 'nonCashReceipts', 'cashDisbursements', 'nonCashDisbursements', 'adjustments', 'transfers', 'nonCashNet', 'netCashMovement', 'previousBalance', 'finalCashBalance'];

            const newCfg = {
                showTreasuryTable: showTr,
                opsRows: {},
                treasuryRows: {}
            };

            opsItems.forEach(k => {
                const chk = document.getElementById(`chk_ops_${k}`);
                newCfg.opsRows[k] = chk ? chk.checked : true;
            });

            trItems.forEach(k => {
                const chk = document.getElementById(`chk_tr_${k}`);
                newCfg.treasuryRows[k] = chk ? chk.checked : true;
            });

            window.saveDailyReportCustomConfig(newCfg);
            if (modal) modal.remove();

            if (typeof generateDailyReport === 'function') {
                generateDailyReport();
            }

            if (typeof showToast === 'function') {
                showToast("✅ تم حفظ وتطبيق تخصيص بنود تقرير الحركة اليومية بنجاح", "success");
            }
        };

        window.resetDailyReportCustomizerUI = function() {
            window.resetDailyReportCustomConfig();
            const modal = document.getElementById('dailyReportCustomizerModal');
            if (modal) modal.remove();
            if (typeof generateDailyReport === 'function') {
                generateDailyReport();
            }
            if (typeof showToast === 'function') {
                showToast("🔄 تمت استعادة الترتيب الافتراضي لكافة البنود بنجاح", "info");
            }
        };

        async function generateDailyReport() {
            // 🔒 فحص وتطبيق قفل التاريخ على اليوم الحالي لمنع التلاعب
            const isDateLocked = (typeof checkAndApplyDailyReportDateLock === 'function')
                ? checkAndApplyDailyReportDateLock()
                : false;

            // 🔒 فحص وتطبيق قفل المبالغ التلقائي على الموظف
            if (typeof checkAndApplyDailyReportAmountsLock === 'function') {
                checkAndApplyDailyReportAmountsLock();
            }

            const todayISO = new Date().toLocaleDateString('en-CA');
            const fromDate = isDateLocked ? todayISO : (document.getElementById('reportDateFrom')?.value || todayISO);
            const toDate = isDateLocked ? todayISO : (document.getElementById('reportDateTo')?.value || todayISO);

            if (!fromDate || !toDate) {
                showToast("⚠️ يرجى تحديد الفترة الزمنية أولاً");
                return;
            }

            // ⚡ جلب حركات الفترة المحددة من SQLite عند الطلب
            if (typeof window.loadTransactionsForDateRange === 'function' && (fromDate < todayISO || toDate < todayISO)) {
                await window.loadTransactionsForDateRange(fromDate, toDate);
            }

            // حفظ الفلاتر (Flexible Reports: Save Filters)

            setStore('pos_report_filters', JSON.stringify({

                dateFrom: fromDate,

                dateTo: toDate

            }));

            // التأكد من تهيئة وتعبئة قائمة المستخدمين مع الصلاحيات
            if (typeof populateDailyReportUserSelect === 'function') {
                const uSel = document.getElementById('dailyReportUserSelect');
                if (!uSel || uSel.options.length <= 1) {
                    populateDailyReportUserSelect();
                }
            }

            // ⚙️ تطبيق إعدادات تخصيص بنود وعناصر تقرير الحركة اليومية
            const customCfg = (typeof window.getDailyReportCustomConfig === 'function')
                ? window.getDailyReportCustomConfig()
                : (window.DEFAULT_DAILY_REPORT_CUSTOM_CONFIG || {});
            const opsCfg = (customCfg && customCfg.opsRows) ? customCfg.opsRows : {};
            const trCfg = (customCfg && customCfg.treasuryRows) ? customCfg.treasuryRows : {};

            const trWrap = document.getElementById('dailyTreasuryTableCardWrap');
            if (trWrap) {
                trWrap.style.display = (customCfg.showTreasuryTable !== false) ? 'flex' : 'none';
            }

            const isNonCashMethod = (m) => {
                if (!m) return false;
                if (typeof window.isNonCashPaymentMethod === 'function') {
                    return window.isNonCashPaymentMethod(m);
                }
                const str = String(m).toLowerCase().trim();
                return str.includes('بنك') || str.includes('تحويل') || str.includes('فيزا') || 
                       str.includes('شيك') || str.includes('شبكة') || str.includes('فودافون') || 
                       str.includes('فودافن') || str.includes('vodafone') || str.includes('voda') || 
                       str.includes('اورنج') || str.includes('أورانج') || str.includes('orange') || 
                       str.includes('اتصالات') || str.includes('etisalat') || str.includes('وي') || 
                       str.includes('we') || str.includes('انستاباي') || str.includes('إنستاباي') || 
                       str.includes('انستا') || str.includes('insta') || str.includes('محفظة') || 
                       str.includes('wallet') || str.includes('مدى') || str.includes('mada') || 
                       str.includes('master') || str.includes('بطاقة') || str.includes('card') ||
                       str === 'vodafone_cash';
            };

            const isDeferredMethod = (m) => {
                if (!m) return false;
                const str = String(m).toLowerCase().trim().replace(/[أإآ]/g, 'ا');
                return str.includes('اجل') || str.includes('ذمم') || str.includes('ذمه') || 
                       str.includes('تقسيط') || str.includes('حساب') || str.includes('credit') || 
                       str.includes('deferred');
            };

            // دالة مساعدة لحساب المدفوع نقداً والآجل بدقة بناءً على طريقة الدفع واسم الشريك
            function getTxPaymentDetails(t) {
                const total = parseFloat(t.total) || parseFloat(t.price) || 0;
                const method = String(t.method || t.paymentMethod || t.treasury || '').toLowerCase();
                const partner = String(t.partner || '').trim();

                const isDeferred = isDeferredMethod(method);
                const isNonCash = isNonCashMethod(method);
                const isCash = !isNonCash && !isDeferred && (method.includes('نقد') || method.includes('كاش') || method.includes('cash') ||
                               (!isDeferred && (partner === 'عميل نقدي' || partner === 'مورد نقدي' || partner === 'نقدي' || partner === 'كاش' || !partner || partner === 'بدون')));

                let paid = 0;
                let credit = 0;

                if (isCash) {
                    paid = (t.paidAmount != null && parseFloat(t.paidAmount) > 0) ? parseFloat(t.paidAmount) : total;
                    credit = Math.max(0, total - paid);
                } else if (isDeferred) {
                    paid = parseFloat(t.paidAmount != null ? t.paidAmount : (t.paid || 0));
                    if (paid > total) paid = total;
                    credit = Math.max(0, total - paid);
                } else {
                    if (t.paidAmount != null && parseFloat(t.paidAmount) >= 0) {
                        paid = parseFloat(t.paidAmount);
                        credit = Math.max(0, total - paid);
                    } else {
                        paid = total;
                        credit = 0;
                    }
                }
                return { total, paid, credit, isCash, isNonCash, isDeferred };
            }

            const selectedWarehouse = document.getElementById('dailyReportWarehouseSelect')?.value || 'all';
            const selectedTreasury = document.getElementById('dailyReportTreasurySelect')?.value || 'all';

            // 🔒 استخراج المستخدم المحدد مع حماية برمجية حاسمة لمنع التطفل
            const curUser = (typeof currentUser !== 'undefined') ? currentUser : null;
            const isAdmin = curUser ? (curUser.role === 'admin') : true;
            let isLockedUser = !isAdmin;
            const uTarget = (curUser && typeof users !== 'undefined' && Array.isArray(users))
                ? (users.find(u => u.pin === curUser.pin || u.name === curUser.name) || curUser)
                : curUser;

            if (uTarget && uTarget.permissions && uTarget.permissions.general && uTarget.permissions.general.lockDailyUser !== undefined) {
                isLockedUser = !!uTarget.permissions.general.lockDailyUser;
            }
            if (!isAdmin && uTarget && (uTarget.invoiceScope === 'user_only' || (curUser && curUser.invoiceScope === 'user_only'))) {
                isLockedUser = true;
            }

            let selectedUser = document.getElementById('dailyReportUserSelect')?.value || 'all';
            if (isLockedUser && curUser && curUser.name) {
                selectedUser = curUser.name;
                const uSel = document.getElementById('dailyReportUserSelect');
                if (uSel && uSel.value !== curUser.name) {
                    uSel.value = curUser.name;
                }
            }

            // دالة مساعدة لفحص مطابقة الحركة للمخزن المحدد
            const matchesSelectedWarehouse = (t) => {
                if (selectedWarehouse === 'all') return true;
                if (!t) return false;
                const isTransfer = t.type && t.type.includes('تحويل');
                if (isTransfer) {
                    return (t.warehouse === selectedWarehouse || 
                            t.sourceWarehouse === selectedWarehouse || 
                            t.toWarehouse === selectedWarehouse || 
                            t.destWarehouse === selectedWarehouse || 
                            t.fromWarehouse === selectedWarehouse);
                }
                return (t.warehouse === selectedWarehouse || (!t.warehouse && selectedWarehouse === 'المخزن الرئيسي'));
            };

            // دالة مساعدة لفحص مطابقة الحركة للخزينة / طريقة الدفع المحددة بدقة تامة وبدون تداخل
            const matchesSelectedTreasury = (t) => {
                if (!selectedTreasury || selectedTreasury === 'all') return true;
                if (!t) return false;
                const m = String(t.method || t.paymentMethod || t.treasury || '').trim().toLowerCase();
                const sel = selectedTreasury.trim().toLowerCase();

                // فحص هل المختار هو الدرج النقدي الفعلي (وليس محفظة إلكترونية أو وسيلة دفع أخرى كفودافون كاش)
                const isSelCash = !isNonCashMethod(sel) && (sel.includes('نقد') || sel.includes('كاش') || sel.includes('cash') || sel.includes('الدرج') || sel.includes('خزينة') || sel === 'نقدية');
                if (isSelCash) {
                    if (!m) return true;
                    return !isNonCashMethod(m) && !isDeferredMethod(m);
                }

                // إذا كان المختار وسيلة بنكية أو محفظة محددة (فودافون كاش / إنستاباي / فيزا ...)
                const clean = str => str.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
                const cleanSel = clean(sel);
                const cleanM = clean(m);

                // فحص دقيق لمحفظة فودافون كاش لمنع أي تداخل مع الكاش العادي
                const isVodafoneSel = cleanSel.includes('فودافون') || cleanSel.includes('فودافن') || cleanSel.includes('vodafone') || cleanSel.includes('voda') || cleanSel === 'vodafone_cash';
                if (isVodafoneSel) {
                    return cleanM.includes('فودافون') || cleanM.includes('فودافن') || cleanM.includes('vodafone') || cleanM.includes('voda') || cleanM === 'vodafone_cash';
                }

                // فحص دقيق لإنستاباي
                const isInstaSel = cleanSel.includes('انستاباي') || cleanSel.includes('إنستاباي') || cleanSel.includes('انستا') || cleanSel.includes('insta');
                if (isInstaSel) {
                    return cleanM.includes('انستاباي') || cleanM.includes('إنستاباي') || cleanM.includes('انستا') || cleanM.includes('insta');
                }

                // فحص دقيق لأورانج كاش
                const isOrangeSel = cleanSel.includes('اورنج') || cleanSel.includes('أورانج') || cleanSel.includes('orange');
                if (isOrangeSel) {
                    return cleanM.includes('اورنج') || cleanM.includes('أورانج') || cleanM.includes('orange');
                }

                // فحص دقيق لاتصالات كاش
                const isEtisalatSel = cleanSel.includes('اتصالات') || cleanSel.includes('etisalat');
                if (isEtisalatSel) {
                    return cleanM.includes('اتصالات') || cleanM.includes('etisalat');
                }

                // فحص دقيق لـ وي باي
                const isWeSel = cleanSel.includes('وي') || cleanSel.includes('we');
                if (isWeSel) {
                    return cleanM.includes('وي') || cleanM.includes('we');
                }

                // باقي الوسائل والفيزا
                return cleanM === cleanSel || cleanM.includes(cleanSel) || cleanSel.includes(cleanM);
            };

            // دالة مساعدة لفحص مطابقة الحركة للمستخدم / الوردية المحددة
            const adminNames = (typeof window.getAdminUserNames === 'function')
                ? window.getAdminUserNames()
                : new Set(['المدير', 'المدير العام', 'مدير النظام', 'admin']);
            const matchesSelectedUser = (t) => {
                if (!t) return false;
                const tUser = String(t.user || '').trim().toLowerCase();
                if (curUser && !isAdmin && (curUser.invoiceScope === 'hide_admin' || (uTarget && uTarget.invoiceScope === 'hide_admin'))) {
                    if (adminNames.has(tUser)) return false;
                }
                if (curUser && !isAdmin && (curUser.invoiceScope === 'user_only' || isLockedUser)) {
                    const myName = String(curUser.name || '').trim().toLowerCase();
                    return tUser === myName;
                }
                if (!selectedUser || selectedUser === 'all') return true;
                const target = selectedUser.trim().toLowerCase();
                return tUser === target;
            };

            const isTreasurySpecificNonCash = selectedTreasury !== 'all' && isNonCashMethod(selectedTreasury);

            // 1. حساب الرصيد السابق الموحد لمجموع الحركات النقدية قبل تاريخ البداية عبر استعلام SQLite سريع ومفهرس
            let previousBalance = 0;
            let priorGrouped = [];

            if (window.BayanSQLite && window.BayanSQLite.db) {
                try {
                    const stmt = window.BayanSQLite.db.prepare("SELECT type, method, total, paidAmount, remaining, warehouse, cashier, invoiceId, raw_json FROM transactions WHERE dateISO < ?");
                    stmt.bind([fromDate]);
                    const dbPriorRows = [];
                    while (stmt.step()) {
                        const row = stmt.getAsObject();
                        if (row) {
                            if (!row.user && row.cashier) row.user = row.cashier;
                            if (row.raw_json) {
                                try {
                                    const parsed = JSON.parse(row.raw_json);
                                    if (parsed.user) row.user = parsed.user;
                                    if (parsed.isInvoiceHead !== undefined) row.isInvoiceHead = parsed.isInvoiceHead;
                                } catch(jsonErr) {}
                            }
                            if (matchesSelectedWarehouse(row) && matchesSelectedTreasury(row) && matchesSelectedUser(row)) {
                                dbPriorRows.push(row);
                            }
                        }
                    }
                    stmt.free();
                    priorGrouped = getGroupedTransactions(dbPriorRows);
                } catch (e) {
                    console.warn("DB prior balance notice:", e);
                }
            }
            if (priorGrouped.length === 0) {
                const priorRaw = transactions.filter(t => t.dateISO && t.dateISO < fromDate && matchesSelectedWarehouse(t) && matchesSelectedTreasury(t) && matchesSelectedUser(t));
                priorGrouped = getGroupedTransactions(priorRaw);
            }

            priorGrouped.forEach(g => {
                const paid = g.paid || 0;
                const total = g.total || 0;
                const gType = g.type || '';
                const isNonCash = isNonCashMethod(g.method);

                // إذا تم اختيار خزينة بنكية محددة نحسب حركاتها، وإذا كان الكل أو كاش نحسب النقدية (درج الكاش)
                const countThisTx = isTreasurySpecificNonCash ? isNonCash : !isNonCash;

                if (countThisTx) {
                    if (gType.includes('قبض')) {
                        previousBalance += total;
                    } else if (gType.includes('صرف')) {
                        previousBalance -= total;
                    } else if (gType.includes('بيع') && !gType.includes('مرتجع')) {
                        previousBalance += paid;
                    } else if ((gType.includes('شراء') || gType.includes('مشتريات')) && !gType.includes('مرتجع')) {
                        previousBalance -= paid;
                    } else if (gType.includes('مرتجع بيع')) {
                        previousBalance -= paid;
                    } else if (gType.includes('مرتجع شراء')) {
                        previousBalance += paid;
                    }
                }
            });

            // 2. فلترة وتجميع حركات الفترة المحددة
            const periodAllRaw = transactions.filter(t => t.dateISO && t.dateISO >= fromDate && t.dateISO <= toDate && matchesSelectedWarehouse(t) && matchesSelectedUser(t));
            const periodAllGrouped = getGroupedTransactions(periodAllRaw);

            const currentRaw = (selectedTreasury === 'all') 
                ? periodAllRaw 
                : periodAllRaw.filter(t => matchesSelectedTreasury(t));
            const currentGrouped = (selectedTreasury === 'all') 
                ? periodAllGrouped 
                : getGroupedTransactions(currentRaw);

            // تهيئة العدادات مع فصل الجملة عن القطاعي وفصل النقدي عن الإلكتروني وفودافون كاش
            let sales = { count: 0, total: 0, cash: 0, nonCash: 0, credit: 0, vodafoneCash: 0 };
            let retailSales = { count: 0, total: 0, cash: 0, nonCash: 0, credit: 0, vodafoneCash: 0 };
            let wholesaleSales = { count: 0, total: 0, cash: 0, nonCash: 0, credit: 0, vodafoneCash: 0 };
            let vodafoneSales = { count: 0, total: 0, cash: 0, nonCash: 0, credit: 0 };

            let salesReturn = { count: 0, total: 0, cash: 0, nonCash: 0, credit: 0, vodafoneCash: 0 };
            let purchases = { count: 0, total: 0, cash: 0, nonCash: 0, credit: 0, vodafoneCash: 0 };
            let purchasesReturn = { count: 0, total: 0, cash: 0, nonCash: 0, credit: 0, vodafoneCash: 0 };
            let receipts = { count: 0, total: 0, cash: 0, nonCash: 0, vodafoneCash: 0 };
            let disbursements = { count: 0, total: 0, cash: 0, nonCash: 0, vodafoneCash: 0 };
            let adjustments = { count: 0, total: 0 };
            let transfers = { count: 0, total: 0 };

            // 📱 تتبع وتجميع تحصيلات وسائل الدفع والمحافظ الإلكترونية بدقة
            const paymentMethodsSummary = {};
            const recordPaymentMethodOp = (rawMethod, amount, type) => {
                if (!amount || amount === 0) return;
                let method = String(rawMethod || '').trim();
                if (!method) method = 'كاش (نقدي)';

                const cleanName = method.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim() || method;
                const lower = cleanName.toLowerCase();

                if (!paymentMethodsSummary[cleanName]) {
                    let icon = '💳';
                    let badgeBg = 'linear-gradient(135deg, #3b82f6, #2563eb)';
                    let isVodafone = lower.includes('فودافون') || lower.includes('فودافن') || lower.includes('vodafone') || lower.includes('voda') || cleanName === 'vodafone_cash';
                    let isInsta = lower.includes('انستاباي') || lower.includes('إنستاباي') || lower.includes('انستا') || lower.includes('insta');
                    let isCash = !isNonCashMethod(cleanName) && (lower.includes('نقدي') || lower.includes('كاش') || lower.includes('cash'));

                    if (isVodafone) {
                        icon = '📱';
                        badgeBg = 'linear-gradient(135deg, #e60000, #b91c1c)';
                    } else if (isInsta) {
                        icon = '⚡';
                        badgeBg = 'linear-gradient(135deg, #7c3aed, #6d28d9)';
                    } else if (lower.includes('اورنج') || lower.includes('أورانج') || lower.includes('orange')) {
                        icon = '🍊';
                        badgeBg = 'linear-gradient(135deg, #ea580c, #c2410c)';
                    } else if (lower.includes('اتصالات') || lower.includes('etisalat')) {
                        icon = '🟢';
                        badgeBg = 'linear-gradient(135deg, #10b981, #047857)';
                    } else if (lower.includes('وي') || lower.includes('we')) {
                        icon = '🟣';
                        badgeBg = 'linear-gradient(135deg, #6b21a8, #4c1d95)';
                    } else if (lower.includes('فيزا') || lower.includes('ماستر') || lower.includes('visa') || lower.includes('master') || lower.includes('شبكة')) {
                        icon = '💳';
                        badgeBg = 'linear-gradient(135deg, #0284c7, #0369a1)';
                    } else if (isCash) {
                        icon = '💵';
                        badgeBg = 'linear-gradient(135deg, #10b981, #059669)';
                    }

                    paymentMethodsSummary[cleanName] = {
                        name: cleanName,
                        icon,
                        badgeBg,
                        isVodafone,
                        isInsta,
                        isCash,
                        salesTotal: 0,
                        salesCount: 0,
                        returnsTotal: 0,
                        returnsCount: 0,
                        receiptsTotal: 0,
                        receiptsCount: 0,
                        disbursementsTotal: 0,
                        disbursementsCount: 0,
                        purchasesTotal: 0,
                        purchasesCount: 0,
                        purchasesReturnTotal: 0,
                        purchasesReturnCount: 0,
                        netTotal: 0
                    };
                }

                const entry = paymentMethodsSummary[cleanName];
                if (type === 'sale') {
                    entry.salesTotal += amount;
                    entry.salesCount++;
                    entry.netTotal += amount;
                } else if (type === 'saleReturn') {
                    entry.returnsTotal += amount;
                    entry.returnsCount++;
                    entry.netTotal -= amount;
                } else if (type === 'receipt') {
                    entry.receiptsTotal = (entry.receiptsTotal || 0) + amount;
                    entry.receiptsCount = (entry.receiptsCount || 0) + 1;
                    entry.netTotal += amount;
                } else if (type === 'disbursement') {
                    entry.disbursementsTotal = (entry.disbursementsTotal || 0) + amount;
                    entry.disbursementsCount = (entry.disbursementsCount || 0) + 1;
                    entry.netTotal -= amount;
                } else if (type === 'purchase') {
                    entry.purchasesTotal = (entry.purchasesTotal || 0) + amount;
                    entry.purchasesCount = (entry.purchasesCount || 0) + 1;
                    entry.netTotal -= amount;
                } else if (type === 'purchaseReturn') {
                    entry.purchasesReturnTotal = (entry.purchasesReturnTotal || 0) + amount;
                    entry.purchasesReturnCount = (entry.purchasesReturnCount || 0) + 1;
                    entry.netTotal += amount;
                }
            };

            // 📱 تجميع وتتبع وسائل الدفع والمحافظ الإلكترونية من كافة حركات الفترة (لضمان بقاء الشارات العلوية معبرة عن حركة اليوم بدقة)
            periodAllGrouped.forEach(g => {
                const paid = g.paid || 0;
                const total = g.total || 0;
                const gType = g.type || '';
                const rawMethod = g.method || g.paymentMethod || 'كاش (نقدي)';
                if (paid > 0) {
                    if (gType.includes('مرتجع بيع')) recordPaymentMethodOp(rawMethod, paid, 'saleReturn');
                    else if (gType.includes('مرتجع شراء')) recordPaymentMethodOp(rawMethod, paid, 'purchaseReturn');
                    else if (gType.includes('بيع')) recordPaymentMethodOp(rawMethod, paid, 'sale');
                    else if (gType.includes('شراء') || gType.includes('مشتريات')) recordPaymentMethodOp(rawMethod, paid, 'purchase');
                }
                if (total > 0) {
                    if (gType.includes('قبض')) recordPaymentMethodOp(rawMethod, total, 'receipt');
                    else if (gType.includes('صرف')) recordPaymentMethodOp(rawMethod, total, 'disbursement');
                }
            });

            currentGrouped.forEach(g => {
                const total = g.total || 0;
                const paid = g.paid || 0;
                const credit = g.remaining || 0;
                const gType = g.type || '';
                const rawMethod = g.method || g.paymentMethod || g.treasury || (g.items && g.items.find(it => it.method || it.paymentMethod)?.method) || '';
                const isNonCash = isNonCashMethod(rawMethod);
                const isVf = (typeof window.isVodafonePaymentMethod === 'function') 
                    ? (window.isVodafonePaymentMethod(rawMethod) || window.isVodafonePaymentMethod(g.treasury)) 
                    : (String(rawMethod).toLowerCase().includes('فودافون') || String(rawMethod).toLowerCase().includes('voda') || String(g.treasury || '').toLowerCase().includes('فودافون'));

                const paidVf = isVf ? paid : 0;
                const paidCash = (isNonCash || isVf) ? 0 : paid;
                const paidOtherNonCash = (isNonCash && !isVf) ? paid : 0;

                if (gType.includes('مرتجع بيع')) {
                    salesReturn.count++;
                    salesReturn.total += total;
                    salesReturn.cash += paidCash;
                    salesReturn.vodafoneCash += paidVf;
                    salesReturn.nonCash += (paidOtherNonCash + paidVf);
                    salesReturn.credit += credit;
                } else if (gType.includes('بيع')) {
                    sales.count++;
                    sales.total += total;
                    sales.cash += paidCash;
                    sales.vodafoneCash += paidVf;
                    sales.nonCash += (paidOtherNonCash + paidVf);
                    sales.credit += credit;

                    if (isVf) {
                        vodafoneSales.count++;
                        vodafoneSales.total += total;
                        vodafoneSales.cash += paidCash;
                        vodafoneSales.nonCash += paidVf;
                        vodafoneSales.credit += credit;
                    }

                    // فحص هل الفاتورة جملة أم قطاعي (تجزئة)
                    const isWholesale = (g.priceLevel === 'wholesale') || (g.items && g.items.some(it => it.priceLevel === 'wholesale'));
                    if (isWholesale) {
                        wholesaleSales.count++;
                        wholesaleSales.total += total;
                        wholesaleSales.cash += paidCash;
                        wholesaleSales.vodafoneCash += paidVf;
                        wholesaleSales.nonCash += (paidOtherNonCash + paidVf);
                        wholesaleSales.credit += credit;
                    } else {
                        retailSales.count++;
                        retailSales.total += total;
                        retailSales.cash += paidCash;
                        retailSales.vodafoneCash += paidVf;
                        retailSales.nonCash += (paidOtherNonCash + paidVf);
                        retailSales.credit += credit;
                    }
                } else if (gType.includes('مرتجع شراء')) {
                    purchasesReturn.count++;
                    purchasesReturn.total += total;
                    purchasesReturn.cash += paidCash;
                    purchasesReturn.vodafoneCash += paidVf;
                    purchasesReturn.nonCash += (paidOtherNonCash + paidVf);
                    purchasesReturn.credit += credit;
                } else if (gType.includes('شراء') || gType.includes('مشتريات')) {
                    purchases.count++;
                    purchases.total += total;
                    purchases.cash += paidCash;
                    purchases.vodafoneCash += paidVf;
                    purchases.nonCash += (paidOtherNonCash + paidVf);
                    purchases.credit += credit;
                } else if (gType.includes('قبض')) {
                    receipts.count++;
                    receipts.total += total;
                    if (isVf) {
                        receipts.vodafoneCash += total;
                        receipts.nonCash = (receipts.nonCash || 0) + total;
                    } else if (isNonCash) {
                        receipts.nonCash = (receipts.nonCash || 0) + total;
                    } else {
                        receipts.cash = (receipts.cash || 0) + total;
                    }
                } else if (gType.includes('صرف')) {
                    disbursements.count++;
                    disbursements.total += total;
                    if (isVf) {
                        disbursements.vodafoneCash += total;
                        disbursements.nonCash = (disbursements.nonCash || 0) + total;
                    } else if (isNonCash) {
                        disbursements.nonCash = (disbursements.nonCash || 0) + total;
                    } else {
                        disbursements.cash = (disbursements.cash || 0) + total;
                    }
                } else if (gType.includes('تسوية')) {
                    adjustments.count++;
                    adjustments.total += total;
                } else if (gType.includes('تحويل')) {
                    if (g.transferStatus !== 'rejected') {
                        transfers.count++;
                        transfers.total += total;
                    }
                }
            });

            // 🏷️ حساب إجمالي الخصومات والإضافات لفواتير المبيعات بدقة تامة طبقاً لفلاتر التقرير
            let totalSalesDiscounts = 0;
            let totalSalesAdditions = 0;
            let discountedInvoicesCount = 0;
            let addedInvoicesCount = 0;

            const salesInvoiceMap = new Map();
            periodAllRaw.forEach(t => {
                if (!t) return;
                const tType = String(t.type || '');
                if (tType.includes('بيع') && !tType.includes('مرتجع')) {
                    const invKey = String(t.invoiceId || 'single_' + (t.originalIndex !== undefined ? t.originalIndex : Math.random()));
                    if (!salesInvoiceMap.has(invKey)) {
                        salesInvoiceMap.set(invKey, {
                            head: null,
                            items: [],
                            subTotal: 0,
                            netTotal: 0
                        });
                    }
                    const grp = salesInvoiceMap.get(invKey);
                    if (t.isInvoiceHead) {
                        grp.head = t;
                    }
                    grp.items.push(t);
                    const q = parseFloat(t.qty) || 1;
                    const p = parseFloat(t.price) || 0;
                    const tot = parseFloat(t.total) || (p * q);
                    grp.subTotal += (p * q);
                    grp.netTotal += tot;
                }
            });

            salesInvoiceMap.forEach(grp => {
                const head = grp.head || grp.items.find(it => it.isInvoiceHead) || grp.items[0];
                const subTotal = grp.subTotal;
                const netTotal = grp.netTotal;

                // 1. حساب خصم الفاتورة الفعلي بالجنيه
                let invDisc = 0;
                if (head && head.invoiceDiscount != null && parseFloat(head.invoiceDiscount) > 0) {
                    const dVal = parseFloat(head.invoiceDiscount) || 0;
                    const dType = head.invoiceDiscountType || head.discountType || 'val';
                    if (dType === 'perc') {
                        invDisc = (subTotal * dVal / 100);
                    } else {
                        invDisc = dVal;
                    }
                } else {
                    const itemsDiscSum = grp.items.reduce((s, it) => s + (parseFloat(it.discount) || 0), 0);
                    if (itemsDiscSum > 0) {
                        invDisc = itemsDiscSum;
                    } else if (subTotal > netTotal + 0.01) {
                        invDisc = subTotal - netTotal;
                    }
                }

                // 2. حساب إضافات/ضرائب الفاتورة الفعلية بالجنيه
                let invExtra = 0;
                if (head && (head.invoiceTax != null || head.invoiceExtra != null) && (parseFloat(head.invoiceTax || head.invoiceExtra) > 0)) {
                    const xVal = parseFloat(head.invoiceTax || head.invoiceExtra) || 0;
                    const xType = head.invoiceTaxType || head.invoiceExtraType || head.taxType || 'val';
                    if (xType === 'perc') {
                        invExtra = (subTotal * xVal / 100);
                    } else {
                        invExtra = xVal;
                    }
                } else {
                    const itemsExtraSum = grp.items.reduce((s, it) => s + (parseFloat(it.addition) || 0), 0);
                    if (itemsExtraSum > 0) {
                        invExtra = itemsExtraSum;
                    } else if (netTotal > subTotal + 0.01) {
                        invExtra = netTotal - subTotal;
                    }
                }

                if (invDisc > 0.001) {
                    totalSalesDiscounts += invDisc;
                    discountedInvoicesCount++;
                }
                if (invExtra > 0.001) {
                    totalSalesAdditions += invExtra;
                    addedInvoicesCount++;
                }
            });

            // 📊 حساب إجماليات كافة العمليات المالية بالكامل (بيع قطاعي وجملة + شراء + قبض + صرف + مرتجعات)
            const allOpsCount = sales.count + salesReturn.count + purchases.count + purchasesReturn.count + receipts.count + disbursements.count;
            const allOpsTotal = sales.total + salesReturn.total + purchases.total + purchasesReturn.total + receipts.total + disbursements.total;
            const allOpsCash = sales.cash + salesReturn.cash + purchases.cash + purchasesReturn.cash + (receipts.cash || 0) + (disbursements.cash || 0);
            const allOpsNonCash = sales.nonCash + salesReturn.nonCash + purchases.nonCash + purchasesReturn.nonCash + (receipts.nonCash || 0) + (disbursements.nonCash || 0);
            const allOpsCredit = sales.credit + salesReturn.credit + purchases.credit + purchasesReturn.credit;

            // تعبئة جدول العمليات مع إبراز الجملة والتجزئة وإجمالي الخصومات والإضافات وفودافون كاش والمرتجعات
            const opsBody = document.getElementById('opsSummaryBody');
            const netSalesTotal = sales.total - salesReturn.total;
            const netSalesCash = sales.cash - salesReturn.cash;
            const netSalesVf = (sales.vodafoneCash || 0) - (salesReturn.vodafoneCash || 0);
            const netSalesNonCash = sales.nonCash - salesReturn.nonCash;
            const netSalesCredit = sales.credit - salesReturn.credit;

            const netOpsRevenueTotal = netSalesTotal + receipts.total;
            const netOpsRevenueCash = netSalesCash + (receipts.cash || 0);
            const netOpsRevenueVf = netSalesVf + (receipts.vodafoneCash || 0);
            const netOpsRevenueNonCash = netSalesNonCash + (receipts.nonCash || 0);
            const netOpsRevenueCredit = netSalesCredit;

            const totalNetVfMovement = ((sales.vodafoneCash || 0) + (purchasesReturn.vodafoneCash || 0) + (receipts.vodafoneCash || 0)) - ((salesReturn.vodafoneCash || 0) + (purchases.vodafoneCash || 0) + (disbursements.vodafoneCash || 0));

            let opsHtml = '';
            if (opsCfg.retailSales !== false) {
                opsHtml += `
                <tr style="background: rgba(16, 185, 129, 0.08); font-weight: 800;">
                    <td>🛍️ مبيعات التجزئة (قطاعي)</td>
                    <td style="text-align:center;">${retailSales.count}</td>
                    <td style="color:#059669; font-weight:900; text-align:center;">${retailSales.total.toFixed(2)}</td>
                    <td style="color:#059669; font-weight:800; text-align:center;">${retailSales.cash.toFixed(2)}</td>
                    <td style="color:#2563eb; font-weight:800; text-align:center;">${(retailSales.vodafoneCash || 0).toFixed(2)}</td>
                    <td style="color:#d97706; text-align:center;">${retailSales.credit.toFixed(2)}</td>
                </tr>`;
            }
            if (opsCfg.wholesaleSales !== false) {
                opsHtml += `
                <tr style="background: rgba(59, 130, 246, 0.08); font-weight: 800;">
                    <td>📦 مبيعات الجملة</td>
                    <td style="text-align:center;">${wholesaleSales.count}</td>
                    <td style="color:#2563eb; font-weight:900; text-align:center;">${wholesaleSales.total.toFixed(2)}</td>
                    <td style="color:#059669; font-weight:800; text-align:center;">${wholesaleSales.cash.toFixed(2)}</td>
                    <td style="color:#2563eb; font-weight:800; text-align:center;">${(wholesaleSales.vodafoneCash || 0).toFixed(2)}</td>
                    <td style="color:#d97706; text-align:center;">${wholesaleSales.credit.toFixed(2)}</td>
                </tr>`;
            }
            if (opsCfg.totalSales !== false) {
                opsHtml += `
                <tr style="background: #f8fafc; font-weight: 900; border-top: 1px dashed #cbd5e1;">
                    <td>🛒 إجمالي المبيعات العامة (تجزئة + جملة)</td>
                    <td style="text-align:center;">${sales.count}</td>
                    <td style="color:#0f172a; font-size:1.05rem; text-align:center;">${sales.total.toFixed(2)}</td>
                    <td style="color:#059669; font-weight:900; text-align:center;">${sales.cash.toFixed(2)}</td>
                    <td style="color:#2563eb; font-weight:900; text-align:center;">${(sales.vodafoneCash || 0).toFixed(2)}</td>
                    <td style="color:#d97706; text-align:center;">${sales.credit.toFixed(2)}</td>
                </tr>`;
            }
            if (opsCfg.vodafoneSales !== false) {
                opsHtml += `
                <tr style="background: rgba(220, 38, 38, 0.06); font-weight: 800; border-top: 1px dashed #fca5a5;">
                    <td style="color:#b91c1c;">📱 مبيعات فودافون كاش (إجمالي المحفظة)</td>
                    <td style="text-align:center;">${vodafoneSales.count}</td>
                    <td style="color:#dc2626; font-weight:900; text-align:center;">${vodafoneSales.total.toFixed(2)}</td>
                    <td style="color:#64748b; font-size:0.85rem; text-align:center;">-</td>
                    <td style="color:#dc2626; font-weight:900; text-align:center;">${(sales.vodafoneCash || (vodafoneSales.nonCash + vodafoneSales.cash)).toFixed(2)}</td>
                    <td style="color:#d97706; text-align:center;">${vodafoneSales.credit.toFixed(2)}</td>
                </tr>`;
            }
            if (opsCfg.discounts !== false) {
                opsHtml += `
                <tr style="background: rgba(239, 68, 68, 0.05); font-weight: 800; border-top: 1px dotted #fca5a5;">
                    <td style="color:#dc2626;">🏷️ إجمالي الخصومات الممنوحة</td>
                    <td style="text-align:center;">${discountedInvoicesCount}</td>
                    <td style="color:#dc2626; font-weight:900; text-align:center;">-${totalSalesDiscounts.toFixed(2)}</td>
                    <td style="color:#64748b; font-size:0.85rem; text-align:center;">-</td>
                    <td style="color:#64748b; font-size:0.85rem; text-align:center;">-</td>
                    <td style="color:#64748b; font-size:0.85rem; text-align:center;">-</td>
                </tr>`;
            }
            if (opsCfg.additions !== false && totalSalesAdditions > 0) {
                opsHtml += `
                <tr style="background: rgba(2, 132, 199, 0.05); font-weight: 800; border-top: 1px dotted #bae6fd;">
                    <td style="color:#0284c7;">➕ إجمالي الإضافات والخدمات والضرائب</td>
                    <td style="text-align:center;">${addedInvoicesCount}</td>
                    <td style="color:#0284c7; font-weight:900; text-align:center;">+${totalSalesAdditions.toFixed(2)}</td>
                    <td style="color:#64748b; font-size:0.85rem; text-align:center;">-</td>
                    <td style="color:#64748b; font-size:0.85rem; text-align:center;">-</td>
                    <td style="color:#64748b; font-size:0.85rem; text-align:center;">-</td>
                </tr>`;
            }
            if (opsCfg.salesReturn !== false) {
                opsHtml += `
                <tr style="background: rgba(239, 68, 68, 0.05); font-weight: 800;">
                    <td style="color:#dc2626;">🔄 مرتجع مبيعات (يخصم من المبيعات)</td>
                    <td style="text-align:center;">${salesReturn.count}</td>
                    <td style="color:#dc2626; font-weight:900; text-align:center;">-${salesReturn.total.toFixed(2)}</td>
                    <td style="color:#dc2626; font-weight:bold; text-align:center;">-${salesReturn.cash.toFixed(2)}</td>
                    <td style="color:#dc2626; font-weight:bold; text-align:center;">-${(salesReturn.vodafoneCash || 0).toFixed(2)}</td>
                    <td style="color:#dc2626; text-align:center;">-${salesReturn.credit.toFixed(2)}</td>
                </tr>`;
            }
            if (opsCfg.purchases !== false) {
                opsHtml += `
                <tr>
                    <td>🧺 مشتريات</td>
                    <td style="text-align:center;">${purchases.count}</td>
                    <td style="text-align:center;">${purchases.total.toFixed(2)}</td>
                    <td style="text-align:center;">${purchases.cash.toFixed(2)}</td>
                    <td style="color:#2563eb; font-weight:800; text-align:center;">${(purchases.vodafoneCash || 0).toFixed(2)}</td>
                    <td style="text-align:center;">${purchases.credit.toFixed(2)}</td>
                </tr>`;
            }
            if (opsCfg.purchasesReturn !== false) {
                opsHtml += `
                <tr style="background: rgba(16, 185, 129, 0.05); font-weight: 800;">
                    <td style="color:#059669;">🔙 مرتجع مشتريات (استرداد نقدية للمحل)</td>
                    <td style="text-align:center;">${purchasesReturn.count}</td>
                    <td style="color:#059669; font-weight:900; text-align:center;">+${purchasesReturn.total.toFixed(2)}</td>
                    <td style="color:#059669; font-weight:bold; text-align:center;">+${purchasesReturn.cash.toFixed(2)}</td>
                    <td style="color:#2563eb; font-weight:bold; text-align:center;">+${(purchasesReturn.vodafoneCash || 0).toFixed(2)}</td>
                    <td style="color:#059669; text-align:center;">+${purchasesReturn.credit.toFixed(2)}</td>
                </tr>`;
            }
            if (opsCfg.receipts !== false) {
                opsHtml += `
                <tr>
                    <td>💰 قبض (إيرادات وتحصيلات)</td>
                    <td style="text-align:center;">${receipts.count}</td>
                    <td style="text-align:center;">${receipts.total.toFixed(2)}</td>
                    <td style="color:#059669; font-weight:800; text-align:center;">${receipts.cash.toFixed(2)}</td>
                    <td style="color:#2563eb; font-weight:800; text-align:center;">${(receipts.vodafoneCash || 0).toFixed(2)}</td>
                    <td style="color:#64748b; font-size:0.85rem; text-align:center;">-</td>
                </tr>`;
            }
            if (opsCfg.disbursements !== false) {
                opsHtml += `
                <tr>
                    <td>💸 صرف (مصروفات ومدفوعات)</td>
                    <td style="text-align:center;">${disbursements.count}</td>
                    <td style="text-align:center;">${disbursements.total.toFixed(2)}</td>
                    <td style="color:#dc2626; font-weight:800; text-align:center;">${disbursements.cash.toFixed(2)}</td>
                    <td style="color:#dc2626; font-weight:800; text-align:center;">${(disbursements.vodafoneCash || 0).toFixed(2)}</td>
                    <td style="color:#64748b; font-size:0.85rem; text-align:center;">-</td>
                </tr>`;
            }
            if (opsCfg.adjustments !== false) {
                opsHtml += `<tr style="background: rgba(142, 68, 173, 0.05);"><td>⚖️ تسوية المخزن</td><td style="text-align:center;">${adjustments.count}</td><td style="text-align:center;">${adjustments.total.toFixed(2)}</td><td style="text-align:center;">-</td><td style="text-align:center;">-</td><td style="text-align:center;">-</td></tr>`;
            }
            if (opsCfg.transfers !== false) {
                opsHtml += `<tr style="background: rgba(94, 51, 112, 0.1);"><td>🚚 تحويل مخزني</td><td style="text-align:center;">${transfers.count}</td><td style="text-align:center;">${transfers.total.toFixed(2)}</td><td style="text-align:center;">-</td><td style="text-align:center;">-</td><td style="text-align:center;">-</td></tr>`;
            }
            if (opsCfg.netRevenue !== false) {
                opsHtml += `
                <tr style="font-weight:800; background:#f8fafc; border-top:2px solid #cbd5e1;">
                    <td style="color:#0f172a;">💰 صافي الإيرادات والتحصيلات (المبيعات بعد المرتجع + القبض)</td>
                    <td style="text-align:center;">${sales.count + salesReturn.count + receipts.count}</td>
                    <td style="color:#059669; font-weight:900; text-align:center;">${netOpsRevenueTotal.toFixed(2)}</td>
                    <td style="color:var(--main-green); font-weight:900; text-align:center;">${netOpsRevenueCash.toFixed(2)}</td>
                    <td style="color:#2563eb; font-weight:900; text-align:center;">${netOpsRevenueVf.toFixed(2)}</td>
                    <td style="color:#d97706; font-weight:900; text-align:center;">${netOpsRevenueCredit.toFixed(2)}</td>
                </tr>`;
            }
            // إجمالي اليومية الفعلي (ما يجب أن يكون في الدرج الورقي أو الخزينة المحددة)
            const cashReceipts = receipts.cash || 0;
            const cashDisbursements = disbursements.cash || 0;

            const effectiveCashSales = isTreasurySpecificNonCash ? sales.nonCash : sales.cash;
            const effectiveReceipts = isTreasurySpecificNonCash ? receipts.nonCash : cashReceipts;
            const effectivePurReturns = isTreasurySpecificNonCash ? purchasesReturn.nonCash : purchasesReturn.cash;
            const effectiveSalesReturns = isTreasurySpecificNonCash ? salesReturn.nonCash : salesReturn.cash;
            const effectivePurchases = isTreasurySpecificNonCash ? purchases.nonCash : purchases.cash;
            const effectiveDisbursements = isTreasurySpecificNonCash ? disbursements.nonCash : cashDisbursements;

            // نقدية اليوم بيومه: الداخل نقداً للدرج (+) والمنصرف نقداً من الدرج (-)
            const totalDrawerCashIn = effectiveCashSales + effectiveReceipts + effectivePurReturns;
            const totalDrawerCashOut = effectiveSalesReturns + effectivePurchases + effectiveDisbursements;
            const dailyTotal = totalDrawerCashIn - totalDrawerCashOut;

            // صافي النشاط المالي الإجمالي والآجل (مستبعد منه التسويات والتحويلات المخزنية كحركات بضاعة)
            const netFinancialActivityTotal = (sales.total + receipts.total + purchasesReturn.total) - (salesReturn.total + purchases.total + disbursements.total);
            const netFinancialActivityCredit = (sales.credit - salesReturn.credit) - (purchases.credit - purchasesReturn.credit);

            // استخراج العد الفعلي إن كان مدخلاً أو من محضر التقفيل المسجل لليوم لتحديث بادج الجرد فوراً
            const inpActual = document.getElementById('drawerActualCashInput');
            let liveActual = null;
            if (inpActual && inpActual.value.trim() !== '' && !isNaN(parseFloat(inpActual.value))) {
                liveActual = parseFloat(inpActual.value);
            } else {
                try {
                    const closures = typeof window.getSavedDrawerClosures === 'function' 
                        ? window.getSavedDrawerClosures() 
                        : [];
                    const curDate = fromDate || new Date().toLocaleDateString('en-CA');
                    const targetCls = closures.find(c => 
                        (c.dateISO === curDate || c.dateFrom === curDate) && 
                        (selectedUser === 'all' || c.userShift === selectedUser || c.userShift === 'كافة المستخدمين' || !c.userShift)
                    );
                    if (targetCls && targetCls.actualCash !== undefined && targetCls.actualCash !== null) {
                        liveActual = parseFloat(targetCls.actualCash);
                    }
                } catch (e) {}
            }

            let auditBadgeHtml = '';
            if (liveActual === null) {
                auditBadgeHtml = `<span id="opsRowAuditStatusBadge" style="background:rgba(255,255,255,0.18); color:#f8fafc; border:1px solid rgba(255,255,255,0.3); padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:800;">⏳ بانتظار العد</span>`;
            } else {
                const currentExpected = window.currentDrawerClosingState?.includePrevBalance ? (previousBalance + dailyTotal) : dailyTotal;
                const diff = liveActual - currentExpected;
                const absDiff = Math.abs(diff);
                if (absDiff < 0.01) {
                    auditBadgeHtml = `<span id="opsRowAuditStatusBadge" style="background:#ecfdf5; color:#059669; border:1.5px solid #10b981; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:900;">✅ متطابق تماماً</span>`;
                } else if (diff < 0) {
                    auditBadgeHtml = `<span id="opsRowAuditStatusBadge" style="background:#fee2e2; color:#dc2626; border:1.5px solid #ef4444; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:900;">⚠️ عجز: -${absDiff.toFixed(2)} ج.م</span>`;
                } else {
                    auditBadgeHtml = `<span id="opsRowAuditStatusBadge" style="background:#eff6ff; color:#2563eb; border:1.5px solid #3b82f6; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:900;">💡 زيادة: +${absDiff.toFixed(2)} ج.م</span>`;
                }
            }

            window.lastDailyBreakdownConfig = {
                cashSales: effectiveCashSales,
                cashReceipts: effectiveReceipts,
                cashDisbursements: effectiveDisbursements,
                cashPurchases: effectivePurchases,
                cashSalesReturns: effectiveSalesReturns,
                cashPurReturns: effectivePurReturns,
                netTotal: dailyTotal,
                previousBalance: previousBalance,
                finalCashBalance: (previousBalance + dailyTotal),
                visaSales: (sales.nonCash || 0),
                vodafoneCash: (sales.vodafoneCash || (vodafoneSales.cash + vodafoneSales.nonCash)),
                vfPurchases: (purchases.vodafoneCash || 0),
                vfSalesReturns: (salesReturn.vodafoneCash || 0),
                vfPurReturns: (purchasesReturn.vodafoneCash || 0),
                vfReceipts: (receipts.vodafoneCash || 0),
                vfDisbursements: (disbursements.vodafoneCash || 0),
                totalNetVfMovement: totalNetVfMovement,
                isSpecificTreasury: selectedTreasury !== 'all',
                treasuryName: selectedTreasury,
                selectedUser: selectedUser
            };

            if (opsCfg.allOpsTotal !== false) {
                opsHtml += `
                <tr class="all-ops-grand-total-row" id="opsRowDrawerAudit" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; font-weight: 900; border-top: 3px solid #3b82f6; box-shadow: 0 4px 12px rgba(15,23,42,0.25);">
                    <td style="padding: 10px 8px;">
                        <span style="display:inline-flex; align-items:center; justify-content:space-between; width:100%; gap:8px; flex-wrap:wrap;">
                            <span style="display:inline-flex; align-items:center; gap:8px;">
                                <span style="font-size:1.15rem;">🎯</span>
                                <span style="color:#ffffff; font-weight:900; font-size:0.95rem;">صافي نقدية اليومية (المطلوب بالدرج)</span>
                                <button type="button" onclick="showDailyTotalBreakdown()"
                                    style="background:rgba(255,255,255,0.2); color:#ffffff; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:800; border:1px solid rgba(255,255,255,0.38); cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:0.2s;"
                                    onmouseover="this.style.background='rgba(255,255,255,0.35)'"
                                    onmouseout="this.style.background='rgba(255,255,255,0.2)'"
                                    title="عرض تفاصيل احتساب صافي نقدية اليومية والدرج">
                                    🔍 عرض التفاصيل
                                </button>
                            </span>
                            ${auditBadgeHtml}
                        </span>
                    </td>
                    <td style="color:#94a3b8; font-weight:800; text-align:center;">${allOpsCount}</td>
                    <td class="grand-total-val" style="color:#38bdf8; font-size:1.12rem; font-weight:900; letter-spacing:0.5px; text-align:center;" title="صافي النشاط المالي الإجمالي (الوارد كلياً - المنصرف كلياً)">${netFinancialActivityTotal.toFixed(2)}</td>
                    <td id="opsRowNetCashVal" onclick="copyAllOpsGrandTotal(${dailyTotal})" style="color:${dailyTotal >= 0 ? '#4ade80' : '#f87171'}; font-size:1.22rem; font-weight:900; letter-spacing:0.5px; text-align:center; cursor:pointer;" title="المطلوب تسليمه في الدرج الورقي (انقر لنسخ المبلغ)">${(dailyTotal >= 0 ? '+' : '') + dailyTotal.toFixed(2)}</td>
                    <td style="color:#60a5fa; font-size:1.15rem; font-weight:900; text-align:center;" title="صافي حركة فودافون كاش للمحفظة (الوارد للمحفظة - المنصرف من المحفظة)">${(totalNetVfMovement >= 0 ? '+' : '') + totalNetVfMovement.toFixed(2)}</td>
                    <td style="color:#fbbf24; font-weight:900; text-align:center;" title="صافي الحركة الآجلة (المتبقي للعملاء - المتبقي للموردين)">${(netFinancialActivityCredit >= 0 ? '+' : '') + netFinancialActivityCredit.toFixed(2)}</td>
                </tr>`;
            }
            opsBody.innerHTML = opsHtml;

            // 🔒 التحقق من صلاحية إخفاء رصيد الدرج والرصيد السابق والنهائي
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

            const dailyTotalEl = document.getElementById('dailyTotalVal');
            if (dailyTotalEl) {
                dailyTotalEl.innerText = dailyTotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
            }
            const dailyDrawerFinalEl = document.getElementById('dailyDrawerFinalVal');
            if (dailyDrawerFinalEl) {
                dailyDrawerFinalEl.innerText = dailyTotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
            }
            const parentBadge = document.getElementById('dailyTotalSalesReceipts');
            if (parentBadge) {
                if (hideDrawerBalance) {
                    parentBadge.style.setProperty('display', 'none', 'important');
                } else {
                    parentBadge.style.setProperty('display', '', 'important');
                    parentBadge.onclick = () => showDailyTotalBreakdown({
                        cashSales: effectiveCashSales,
                        cashReceipts: effectiveReceipts,
                        cashDisbursements: effectiveDisbursements,
                        cashPurchases: effectivePurchases,
                        cashSalesReturns: effectiveSalesReturns,
                        cashPurReturns: effectivePurReturns,
                        netTotal: dailyTotal,
                        previousBalance: previousBalance,
                        finalCashBalance: (previousBalance + dailyTotal),
                        visaSales: sales.nonCash || 0,
                        vodafoneCash: (vodafoneSales.cash + vodafoneSales.nonCash),
                        isSpecificTreasury: selectedTreasury !== 'all',
                        treasuryName: selectedTreasury,
                        selectedUser: selectedUser
                    });
                }
            }

            // تحديث كارت الإضافات العلوي
            const isDailyHidden = document.body.classList.contains('daily-amounts-hidden');

            const dailyAdditionsEl = document.getElementById('dailyAdditionsVal');
            if (dailyAdditionsEl) {
                dailyAdditionsEl.innerText = totalSalesAdditions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            const dailyAdditionsBadge = document.getElementById('dailyTotalAdditionsBadge');
            if (dailyAdditionsBadge) {
                dailyAdditionsBadge.title = isDailyHidden ? '➕ إجمالي الإضافات (مخفي ومحمي)' : `إجمالي الإضافات والخدمات والضرائب: ${totalSalesAdditions.toFixed(2)} ج.م عبر (${addedInvoicesCount}) فاتورة (انقر لعرض ملخص)`;
                dailyAdditionsBadge.onclick = () => {
                    if (document.body.classList.contains('daily-amounts-hidden')) {
                        if (typeof showToast === 'function') showToast("🔒 المبالغ المالية مخفية ومحمية", "warning");
                        return;
                    }
                    if (typeof showToast === 'function') {
                        showToast(`➕ إجمالي الإضافات والضرائب بالفترة: ${totalSalesAdditions.toFixed(2)} ج.م عبر (${addedInvoicesCount}) فاتورة`, 'info');
                    }
                };
            }

            // 📱 تجميع وتحديث مربع فودافون كاش وكروت المحافظ الإلكترونية
            let vfEntry = {
                name: 'فودافون كاش',
                icon: '📱',
                salesTotal: 0,
                salesCount: 0,
                returnsTotal: 0,
                returnsCount: 0,
                receiptsTotal: 0,
                receiptsCount: 0,
                disbursementsTotal: 0,
                disbursementsCount: 0,
                purchasesTotal: 0,
                purchasesCount: 0,
                purchasesReturnTotal: 0,
                purchasesReturnCount: 0,
                netTotal: 0
            };
            const nonCashMethodsList = [];

            Object.values(paymentMethodsSummary).forEach(pm => {
                if (pm.isVodafone) {
                    vfEntry.salesTotal += (pm.salesTotal || 0);
                    vfEntry.salesCount += (pm.salesCount || 0);
                    vfEntry.returnsTotal += (pm.returnsTotal || 0);
                    vfEntry.returnsCount += (pm.returnsCount || 0);
                    vfEntry.receiptsTotal += (pm.receiptsTotal || 0);
                    vfEntry.receiptsCount += (pm.receiptsCount || 0);
                    vfEntry.disbursementsTotal += (pm.disbursementsTotal || 0);
                    vfEntry.disbursementsCount += (pm.disbursementsCount || 0);
                    vfEntry.purchasesTotal += (pm.purchasesTotal || 0);
                    vfEntry.purchasesCount += (pm.purchasesCount || 0);
                    vfEntry.purchasesReturnTotal += (pm.purchasesReturnTotal || 0);
                    vfEntry.purchasesReturnCount += (pm.purchasesReturnCount || 0);
                    vfEntry.netTotal += (pm.netTotal || 0);
                } else if (!pm.isCash && ((pm.netTotal !== 0) || (pm.salesTotal > 0) || (pm.receiptsTotal > 0))) {
                    nonCashMethodsList.push(pm);
                }
            });

            const vfNet = vfEntry.netTotal || 0;
            const totalVfOps = (vfEntry.salesCount || 0) + (vfEntry.returnsCount || 0) + (vfEntry.receiptsCount || 0) + (vfEntry.disbursementsCount || 0) + (vfEntry.purchasesCount || 0) + (vfEntry.purchasesReturnCount || 0);

            // 2. تحديث الحاوية الديناميكية لباقي وسائل الدفع والمحافظ (إنستاباي / فيزا / أورانج كاش .. إلخ)
            const dynamicBadgesContainer = document.getElementById('dailyDynamicPaymentBadges');
            if (dynamicBadgesContainer) {
                if (nonCashMethodsList.length > 0) {
                    dynamicBadgesContainer.innerHTML = nonCashMethodsList.map(pm => {
                        const pmNet = (pm.salesTotal + (pm.receiptsTotal || 0) + (pm.purchasesReturnTotal || 0)) - ((pm.returnsTotal || 0) + (pm.disbursementsTotal || 0) + (pm.purchasesTotal || 0));
                        const pmTotalOps = (pm.salesCount || 0) + (pm.returnsCount || 0) + (pm.receiptsCount || 0) + (pm.disbursementsCount || 0) + (pm.purchasesCount || 0) + (pm.purchasesReturnCount || 0);
                        const safeName = (pm.name || '').replace(/'/g, "\\'");
                        return `
                        <div class="daily-method-badge" title="${isDailyHidden ? `${pm.icon} ${pm.name} (مخفي ومحمي)` : `إجمالي صافي ${pm.name}: ${pmNet.toFixed(2)} ج.م عبر (${pmTotalOps}) حركة - انقر للتفاصيل`}"
                            style="font-size: 0.9rem; color: #fff; font-weight: bold; background: ${pm.badgeBg}; padding: 6px 15px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.15); cursor: pointer; transition: 0.3s; display: inline-flex; align-items: center; gap: 6px;"
                            onmouseover="this.style.transform='scale(1.05)'"
                            onmouseout="this.style.transform='scale(1)'"
                            onclick="if (document.body.classList.contains('daily-amounts-hidden')) { if (typeof showToast === 'function') showToast('🔒 المبالغ المالية مخفية ومحمية', 'warning'); return; } showDailyPaymentMethodBreakdown('${safeName}', window.dailyReportData?.paymentMethodsSummary?.['${safeName}'] || null);">
                            <span>${pm.icon} ${pm.name}:</span> <span class="daily-method-val">${pmNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> ج.م
                        </div>
                    `;
                    }).join('');
                } else {
                    dynamicBadgesContainer.innerHTML = '';
                }
            }

            const lastUpdateEl = document.getElementById('reportLastUpdate');
            if (lastUpdateEl) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                const dateStr = now.toLocaleDateString('ar-EG');
                lastUpdateEl.innerHTML = `آخر تحديث: <b style="color:var(--main-green);">${timeStr}</b> | م ${dateStr}`;
            }

            // مزامنة وتحديث شارة المستخدم / الوردية العلوية
            const userBadgeEl = document.getElementById('dailyReportUserShiftBadge');
            if (userBadgeEl) {
                if (selectedUser && selectedUser !== 'all') {
                    userBadgeEl.innerHTML = `👤 وردية: <strong>${selectedUser}</strong>`;
                    userBadgeEl.style.background = '#fef3c7';
                    userBadgeEl.style.color = '#92400e';
                    userBadgeEl.style.borderColor = '#fde68a';
                } else {
                    userBadgeEl.innerHTML = `👥 كافة المستخدمين`;
                    userBadgeEl.style.background = '#eff6ff';
                    userBadgeEl.style.color = '#1d4ed8';
                    userBadgeEl.style.borderColor = '#bfdbfe';
                }
            }

            // حساب القيم النهائية للخزينة (الكاش الفعلي بالدرج أو رصيد الخزينة المحددة)
            const netCashMovement = dailyTotal;
            const finalCashBalance = previousBalance + netCashMovement;
            const movementColor = netCashMovement >= 0 ? "var(--main-green)" : "var(--box-red)";
            const balanceColor = finalCashBalance >= 0 ? "var(--main-green)" : "var(--box-red)";

            // إجمالي الحركات البنكية والفيزا المستقلة عن الدرج
            const totalNonCashNet = (sales.nonCash + (receipts.nonCash || 0) + purchasesReturn.nonCash) - (purchases.nonCash + (disbursements.nonCash || 0) + salesReturn.nonCash);

            // تعبئة جدول الخزينة طبقاً لتخصيص البنود
            const treasuryBody = document.getElementById('treasurySummaryBody');
            let trHtml = '';

            if (trCfg.cashSales !== false) {
                trHtml += `<tr><td>🛒 مبيعات نقدية (درج الكاش)</td><td style="color:var(--main-green); font-weight:bold;">+${sales.cash.toFixed(2)}</td></tr>`;
            }

            if (trCfg.electronicWallets !== false) {
                trHtml += (() => {
                    let nonCashRows = '';
                    const showVfRow = (selectedTreasury === 'all') || (typeof window.isVodafonePaymentMethod === 'function' ? window.isVodafonePaymentMethod(selectedTreasury) : (selectedTreasury.toLowerCase().includes('فودافون') || selectedTreasury.toLowerCase().includes('voda')));
                    if (showVfRow && (vfEntry.salesTotal > 0 || vfEntry.receiptsTotal > 0 || vfNet !== 0)) {
                        const vfDetailsText = (vfEntry.receiptsTotal > 0 || vfEntry.disbursementsTotal > 0)
                            ? ` (صافي: مبيعات ${vfEntry.salesTotal.toFixed(2)}${vfEntry.receiptsTotal > 0 ? ` + قبض ${vfEntry.receiptsTotal.toFixed(2)}` : ''}${vfEntry.disbursementsTotal > 0 ? ` - صرف ${vfEntry.disbursementsTotal.toFixed(2)}` : ''})`
                            : '';
                        nonCashRows += `<tr><td>📱 فودافون كاش${vfDetailsText}</td><td style="color:#dc2626; font-weight:bold;">${vfNet >= 0 ? '+' : ''}${vfNet.toFixed(2)}</td></tr>`;
                    }
                    if (selectedTreasury === 'all') {
                        nonCashMethodsList.forEach(pm => {
                            const pmNet = (pm.salesTotal + (pm.receiptsTotal || 0) + (pm.purchasesReturnTotal || 0)) - ((pm.returnsTotal || 0) + (pm.disbursementsTotal || 0) + (pm.purchasesTotal || 0));
                            nonCashRows += `<tr><td>${pm.icon} صافي ${pm.name}</td><td style="color:#2563eb; font-weight:bold;">${pmNet >= 0 ? '+' : ''}${pmNet.toFixed(2)}</td></tr>`;
                        });
                        const accountedNonCash = vfEntry.salesTotal + nonCashMethodsList.reduce((s, p) => s + p.salesTotal, 0);
                        const remainderNonCash = sales.nonCash - accountedNonCash;
                        if (remainderNonCash > 0.01) {
                            nonCashRows += `<tr><td>💳 مبيعات إلكترونية أخرى</td><td style="color:#2563eb; font-weight:bold;">+${remainderNonCash.toFixed(2)}</td></tr>`;
                        } else if (sales.nonCash > 0 && accountedNonCash === 0) {
                            nonCashRows += `<tr><td>💳 مبيعات شبكة وفيزا / بنكي</td><td style="color:#2563eb; font-weight:bold;">+${sales.nonCash.toFixed(2)}</td></tr>`;
                        }
                    } else if (isTreasurySpecificNonCash && !showVfRow) {
                        const matchedPm = nonCashMethodsList.find(pm => pm.name === selectedTreasury || selectedTreasury.includes(pm.name));
                        if (matchedPm) {
                            const pmNet = (matchedPm.salesTotal + (matchedPm.receiptsTotal || 0) + (matchedPm.purchasesReturnTotal || 0)) - ((matchedPm.returnsTotal || 0) + (matchedPm.disbursementsTotal || 0) + (matchedPm.purchasesTotal || 0));
                            nonCashRows += `<tr><td>${matchedPm.icon} صافي ${matchedPm.name}</td><td style="color:#2563eb; font-weight:bold;">${pmNet >= 0 ? '+' : ''}${pmNet.toFixed(2)}</td></tr>`;
                        }
                    }
                    return nonCashRows;
                })();
            }

            if (trCfg.cashSalesReturn !== false) {
                trHtml += `<tr><td>🔄 مرتجع مبيعات نقدي (خارج من الدرج)</td><td style="color:var(--box-red); font-weight:bold;">-${salesReturn.cash.toFixed(2)}</td></tr>`;
            }
            if (trCfg.nonCashSalesReturn !== false && salesReturn.nonCash > 0) {
                trHtml += `<tr><td>💳 مرتجع مبيعات بنكي / فيزا</td><td style="color:#7c3aed; font-weight:bold;">-${salesReturn.nonCash.toFixed(2)}</td></tr>`;
            }
            if (trCfg.cashPurchases !== false) {
                trHtml += `<tr><td>🧺 مشتريات نقدية (مدفوعة من الدرج)</td><td style="color:var(--box-red); font-weight:bold;">-${purchases.cash.toFixed(2)}</td></tr>`;
            }
            if (trCfg.nonCashPurchases !== false && purchases.nonCash > 0) {
                trHtml += `<tr><td>🏦 مشتريات سداد بنكي / فيزا</td><td style="color:#7c3aed; font-weight:bold;">-${purchases.nonCash.toFixed(2)}</td></tr>`;
            }
            if (trCfg.cashPurchasesReturn !== false) {
                trHtml += `<tr><td>🔙 مرتجع مشتريات نقدي (داخل للدرج)</td><td style="color:var(--main-green); font-weight:bold;">+${purchasesReturn.cash.toFixed(2)}</td></tr>`;
            }
            if (trCfg.nonCashPurchasesReturn !== false && purchasesReturn.nonCash > 0) {
                trHtml += `<tr><td>💳 مرتجع مشتريات بنكي / فيزا</td><td style="color:#2563eb; font-weight:bold;">+${purchasesReturn.nonCash.toFixed(2)}</td></tr>`;
            }
            if (trCfg.cashReceipts !== false) {
                trHtml += `<tr><td>💰 قبض نقدي (إيرادات الدرج)</td><td style="color:var(--main-green); font-weight:bold;">+${cashReceipts.toFixed(2)}</td></tr>`;
            }
            if (trCfg.nonCashReceipts !== false && receipts.nonCash && receipts.nonCash > 0) {
                trHtml += `<tr><td>💳 قبض بنكي / إلكتروني</td><td style="color:#2563eb; font-weight:bold;">+${receipts.nonCash.toFixed(2)}</td></tr>`;
            }
            if (trCfg.cashDisbursements !== false) {
                trHtml += `<tr><td>💸 صرف نقدي (مصروفات الدرج)</td><td style="color:var(--box-red); font-weight:bold;">-${cashDisbursements.toFixed(2)}</td></tr>`;
            }
            if (trCfg.nonCashDisbursements !== false && disbursements.nonCash && disbursements.nonCash > 0) {
                trHtml += `<tr><td>🏦 صرف بنكي / إلكتروني</td><td style="color:#7c3aed; font-weight:bold;">-${disbursements.nonCash.toFixed(2)}</td></tr>`;
            }
            if (trCfg.adjustments !== false) {
                trHtml += `<tr style="background: rgba(142, 68, 173, 0.05);"><td>⚖️ تسوية المخزن (غير مؤثرة على الكاش)</td><td style="color:${adjustments.total >= 0 ? 'var(--main-green)' : 'var(--box-red)'}; font-weight:bold;">${adjustments.total.toFixed(2)}</td></tr>`;
            }
            if (trCfg.transfers !== false) {
                trHtml += `<tr style="background: rgba(94, 51, 112, 0.1);"><td>🚚 تحويل مخزني (غير مؤثر على الكاش)</td><td style="color:#5e3370; font-weight:bold;">${transfers.total.toFixed(2)}</td></tr>`;
            }
            if (trCfg.nonCashNet !== false && !isTreasurySpecificNonCash && (sales.nonCash > 0 || (receipts.nonCash && receipts.nonCash > 0) || purchases.nonCash > 0 || salesReturn.nonCash > 0)) {
                trHtml += `
                <tr style="background: rgba(37, 99, 235, 0.08); font-weight: bold; border-top: 1px solid #bfdbfe;">
                    <td style="color:#1d4ed8;">💳 صافي العمليات البنكية والفيزا (خارج الدرج)</td>
                    <td style="color:#1d4ed8; font-weight:900;">${totalNonCashNet.toFixed(2)}</td>
                </tr>`;
            }
            if (!hideDrawerBalance) {
                if (trCfg.netCashMovement !== false) {
                    trHtml += `
                    <tr style="background:rgba(16, 185, 129, 0.12); font-weight:900; border-top:2px solid var(--main-green);">
                        <td style="text-align:right; padding: 10px 14px;">
                            <span style="display:inline-flex; align-items:center; gap:6px;">
                                <span>🔄 صافي نقدية حركة اليوم ${isTreasurySpecificNonCash ? 'للخزينة' : 'بالدرج'}</span>
                                <button type="button" class="daily-help-btn" onclick="showDailyTermHelp('netCashMovement', event)" title="انقر لمعرفة شرح صافي الحركة النقدية">❓</button>
                            </span>
                        </td>
                        <td style="color:${movementColor}; font-size:1.25rem; font-weight:900;">${netCashMovement.toFixed(2)}</td>
                    </tr>`;
                }
                if (trCfg.previousBalance !== false) {
                    trHtml += `
                    <tr style="font-weight:800; background:#f8fafc; border-top:1px dashed #cbd5e1; color:#64748b; font-size:0.84rem;">
                        <td style="text-align:right; padding: 7px 14px;">
                            <span style="display:inline-flex; align-items:center; gap:6px;">
                                <span>⏺️ رصيد سابق تراكمي (تاريخي غير مصفى)</span>
                                <button type="button" class="daily-help-btn" onclick="showDailyTermHelp('previousBalance', event)" title="انقر لمعرفة شرح الرصيد السابق الافتتاحي">❓</button>
                            </span>
                        </td>
                        <td style="color:#64748b; font-weight:800; font-size:0.92rem;">${previousBalance.toFixed(2)}</td>
                    </tr>`;
                }
                if (trCfg.finalCashBalance !== false) {
                    trHtml += `
                    <tr style="background:#334155; color:white; font-weight:bold; font-size:0.86rem;">
                        <td style="text-align:right; padding: 7px 14px;">
                            <span style="display:inline-flex; align-items:center; gap:6px;">
                                <span style="color:white;">💰 الإجمالي الدفتري التراكمي (سابق + اليوم)</span>
                                <button type="button" class="daily-help-btn daily-help-btn-white" onclick="showDailyTermHelp('finalCashBalance', event)" title="انقر لمعرفة شرح الرصيد النهائي بالدرج">❓</button>
                            </span>
                        </td>
                        <td style="color:white; font-size:1.1rem; font-weight:900;">${finalCashBalance.toFixed(2)}</td>
                    </tr>`;
                }
            }
            treasuryBody.innerHTML = trHtml;

            // حساب الأرباح المفصلة (أرباح قطاعي - أرباح جملة - مرتجعات - الصافي العام)
            let retailGrossProfit = 0;
            let wholesaleGrossProfit = 0;
            let returnSalesProfitLost = 0;

            currentRaw.forEach(t => {
                if (t.invoiceId && t.profit !== undefined && t.profit !== '-') {
                    const pVal = parseFloat(t.profit) || 0;
                    if (t.type.includes('بيع') && !t.type.includes('مرتجع')) {
                        if (t.priceLevel === 'wholesale') {
                            wholesaleGrossProfit += pVal;
                        } else {
                            retailGrossProfit += pVal;
                        }
                    } else if (t.type.includes('مرتجع بيع')) {
                        returnSalesProfitLost += Math.abs(pVal);
                    }
                }
            });

            const totalGrossProfit = retailGrossProfit + wholesaleGrossProfit;
            const netProfit = totalGrossProfit - returnSalesProfitLost;

            const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;

            const profitCard = document.getElementById('dailyReportProfitSummaryCard');
            if (profitCard) {
                profitCard.style.setProperty('display', canViewProfits ? '' : 'none', 'important');
            }

            const profitBody = document.getElementById('profitSummaryBody');
            if (profitBody) {
                if (canViewProfits) {
                    profitBody.innerHTML = `
                        <tr style="background:rgba(16, 185, 129, 0.08);">
                            <td>🛍️ أرباح مبيعات التجزئة (قطاعي)</td>
                            <td style="color:#059669; font-weight:900; font-size:1.05rem;">${retailGrossProfit.toFixed(2)} ج.م</td>
                        </tr>
                        <tr style="background:rgba(59, 130, 246, 0.08);">
                            <td>📦 أرباح مبيعات الجملة</td>
                            <td style="color:#2563eb; font-weight:900; font-size:1.05rem;">${wholesaleGrossProfit.toFixed(2)} ج.م</td>
                        </tr>
                        <tr style="background:rgba(39, 174, 96, 0.05); border-top:1px dashed #cbd5e1;">
                            <td>📈 إجمالي أرباح المبيعات المشتركة</td>
                            <td style="color:var(--main-green); font-weight:900; font-size:1.1rem;">${totalGrossProfit.toFixed(2)} ج.م</td>
                        </tr>
                        <tr style="background:rgba(239, 68, 68, 0.05);">
                            <td>📉 إجمالي أرباح مرتجعات البيع</td>
                            <td style="color:#ef4444; font-weight:900; font-size:1.1rem;">-${returnSalesProfitLost.toFixed(2)} ج.م</td>
                        </tr>
                        <tr style="background:rgba(142, 68, 173, 0.12); font-weight:900; border-top:2.5px solid var(--main-purple);">
                            <td>📊 صافي الربح النهائي الشامل</td>
                            <td style="color:${netProfit >= 0 ? 'var(--main-purple)' : '#ef4444'}; font-size:1.35rem; text-shadow:0 1px 2px rgba(0,0,0,0.1);">${netProfit.toFixed(2)} ج.م</td>
                        </tr>
                    `;
                } else {
                    profitBody.innerHTML = '';
                }
            }

            window.dailyReportData = {
                netProfit: canViewProfits ? netProfit : 0,
                grossProfit: canViewProfits ? totalGrossProfit : 0,
                retailGrossProfit: canViewProfits ? retailGrossProfit : 0,
                wholesaleGrossProfit: canViewProfits ? wholesaleGrossProfit : 0,
                retailSalesTotal: retailSales.total,
                wholesaleSalesTotal: wholesaleSales.total,
                totalSales: sales.total,
                totalSalesCash: sales.cash,
                totalSalesNonCash: sales.nonCash,
                totalSalesCredit: sales.credit,
                salesCount: sales.count,
                effectiveCashSales: effectiveCashSales,
                effectiveReceipts: effectiveReceipts,
                effectivePurReturns: effectivePurReturns,
                effectiveSalesReturns: effectiveSalesReturns,
                effectivePurchases: effectivePurchases,
                effectiveDisbursements: effectiveDisbursements,
                totalCashIn: (effectiveCashSales + effectiveReceipts + effectivePurReturns),
                totalCashOut: (effectiveSalesReturns + effectivePurchases + effectiveDisbursements),
                salesReturnCount: salesReturn.count,
                salesReturnTotal: salesReturn.total,
                salesReturnCash: salesReturn.cash,
                purchasesCount: purchases.count,
                purchasesReturnCount: purchasesReturn.count,
                purchasesReturnTotal: purchasesReturn.total,
                purchasesReturnCash: purchasesReturn.cash,
                receiptsCount: receipts.count,
                disbursementsCount: disbursements.count,
                totalDiscounts: totalSalesDiscounts,
                discountedInvoicesCount: discountedInvoicesCount,
                totalAdditions: totalSalesAdditions,
                addedInvoicesCount: addedInvoicesCount,
                totalPurchases: purchases.total,
                totalPurchasesCash: purchases.cash,
                totalPurchasesNonCash: purchases.nonCash,
                totalReceipts: receipts.total,
                totalReceiptsCash: receipts.cash,
                totalReceiptsNonCash: receipts.nonCash,
                totalExpenses: disbursements.total,
                totalExpensesCash: disbursements.cash,
                totalExpensesNonCash: disbursements.nonCash,
                netCashMovement: netCashMovement,
                finalCashBalance: finalCashBalance,
                previousBalance: previousBalance,
                selectedWarehouse: selectedWarehouse,
                selectedTreasury: selectedTreasury,
                selectedUser: selectedUser,
                vodafoneCashTotal: vfNet,
                vodafoneCashSales: vfEntry.salesTotal,
                vodafoneCashReceipts: vfEntry.receiptsTotal,
                vodafoneCashDisbursements: vfEntry.disbursementsTotal,
                vodafoneCashPurchases: vfEntry.purchasesTotal,
                vodafoneCashReturns: vfEntry.returnsTotal,
                vodafoneCashCount: totalVfOps,
                vodafoneCashEntry: vfEntry,
                vodafoneSales: vodafoneSales,
                paymentMethodsSummary: paymentMethodsSummary,
                allOpsCount: allOpsCount,
                allOpsTotal: allOpsTotal,
                allOpsCash: allOpsCash,
                allOpsNonCash: allOpsNonCash,
                allOpsCredit: allOpsCredit
            };

            // 🔒 تحديث لوحة جرد وتقفيل الدرج والخزينة واحتساب العجز والزيادة
            if (typeof updateDrawerAuditPanelUI === 'function') {
                updateDrawerAuditPanelUI(previousBalance, netCashMovement, finalCashBalance, selectedUser);
            }

            showToast(canViewProfits ? "✅ تم تحديث وتفصيل تقارير الحركة والأرباح بنجاح" : "✅ تم تحديث وتفصيل تقرير الحركة اليومية بنجاح");
        }

        async function showDailyPaymentMethodBreakdown(methodName, entry) {
            if (typeof isDailyReportAmountsProtected === 'function' && isDailyReportAmountsProtected()) {
                if (typeof window.verifyAdminPinAuthorization === 'function') {
                    const ok = await window.verifyAdminPinAuthorization(`📱 كشف تفاصيل ${methodName}`, `يتطلب استعراض تفاصيل ${methodName} إدخال رمز PIN المدير.`);
                    if (!ok) return;
                } else {
                    if (typeof showToast === 'function') showToast("🔒 المبالغ المالية مخفية ومحمية، يتطلب استعراضها إذن المدير", "warning");
                    return;
                }
            }

            let existingModal = document.getElementById('dailyPaymentMethodModal');
            if (existingModal) existingModal.remove();

            const e = entry || (window.dailyReportData && window.dailyReportData.paymentMethodsSummary && window.dailyReportData.paymentMethodsSummary[methodName]) || {};
            const sales = e.salesTotal || 0;
            const salesRet = e.returnsTotal || 0;
            const receipts = e.receiptsTotal || 0;
            const disb = e.disbursementsTotal || 0;
            const pur = e.purchasesTotal || 0;
            const purRet = e.purchasesReturnTotal || 0;
            const net = (sales + receipts + purRet) - (salesRet + disb + pur);

            const modal = document.createElement('div');
            modal.id = 'dailyPaymentMethodModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 100000; display: flex; justify-content: center; align-items: center; padding: 15px; box-sizing: border-box; direction: rtl; font-family: inherit; animation: fadeIn 0.2s;';

            modal.innerHTML = `
                <div style="background: #ffffff; color: #0f172a; border-radius: 18px; padding: 22px 25px; width: 100%; max-width: 440px; box-shadow: 0 20px 45px rgba(0,0,0,0.3); position: relative; animation: slideUp 0.3s ease; border: 1.5px solid #cbd5e1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.5rem;">${e.icon || '📱'}</span>
                            <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #0f172a;">تفاصيل حركة ${methodName}</h3>
                        </div>
                        <button onclick="document.getElementById('dailyPaymentMethodModal').remove()" style="background: #f1f5f9; border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 1.1rem; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center;">✕</button>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.98rem; font-weight: 800;">
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
                            <span>(+) فواتير المبيعات:</span>
                            <span style="color: #059669; font-weight: 900;">${sales.toLocaleString('en-US', {minimumFractionDigits: 2})} ج.م <small style="color:#64748b;">(${e.salesCount || 0} فاتورة)</small></span>
                        </div>

                        ${receipts > 0 ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
                            <span>(+) سندات القبض (تحصيلات):</span>
                            <span style="color: #059669; font-weight: 900;">${receipts.toLocaleString('en-US', {minimumFractionDigits: 2})} ج.م <small style="color:#64748b;">(${e.receiptsCount || 0})</small></span>
                        </div>` : ''}

                        ${purRet > 0 ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
                            <span>(+) مرتجع مشتريات (استرداد):</span>
                            <span style="color: #059669; font-weight: 900;">${purRet.toLocaleString('en-US', {minimumFractionDigits: 2})} ج.م</span>
                        </div>` : ''}

                        ${salesRet > 0 ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #fef2f2; padding: 8px 12px; border-radius: 8px;">
                            <span>(-) مرتجع مبيعات:</span>
                            <span style="color: #dc2626; font-weight: 900;">-${salesRet.toLocaleString('en-US', {minimumFractionDigits: 2})} ج.م <small style="color:#64748b;">(${e.returnsCount || 0})</small></span>
                        </div>` : ''}

                        ${pur > 0 ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #fef2f2; padding: 8px 12px; border-radius: 8px;">
                            <span>(-) مشتريات وتوريد:</span>
                            <span style="color: #dc2626; font-weight: 900;">-${pur.toLocaleString('en-US', {minimumFractionDigits: 2})} ج.م</span>
                        </div>` : ''}

                        ${disb > 0 ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #fef2f2; padding: 8px 12px; border-radius: 8px;">
                            <span>(-) سندات صرف (مصروفات):</span>
                            <span style="color: #dc2626; font-weight: 900;">-${disb.toLocaleString('en-US', {minimumFractionDigits: 2})} ج.م <small style="color:#64748b;">(${e.disbursementsCount || 0})</small></span>
                        </div>` : ''}

                        <div style="display: flex; justify-content: space-between; align-items: center; background: ${net >= 0 ? '#ecfdf5' : '#fef2f2'}; border: 1.5px solid ${net >= 0 ? '#a7f3d0' : '#fecaca'}; padding: 12px 14px; border-radius: 12px; margin-top: 6px; font-size: 1.12rem;">
                            <span style="font-weight: 900; color: #0f172a;">صافي رصيد المحفظة بالفترة:</span>
                            <span style="font-weight: 900; color: ${net >= 0 ? '#059669' : '#dc2626'}; font-size: 1.25rem;">${net.toLocaleString('en-US', {minimumFractionDigits: 2})} ج.م</span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 18px;">
                        <button onclick="copyDailyTotalFromModal('${net}')" style="flex: 1; padding: 10px; background: #f1f5f9; color: #334155; border: 1.5px solid #cbd5e1; border-radius: 10px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            📋 نسخ الصافي
                        </button>
                        <button onclick="document.getElementById('dailyPaymentMethodModal').remove()" style="flex: 1; padding: 10px; background: #0f172a; color: #ffffff; border: none; border-radius: 10px; font-weight: 900; cursor: pointer;">
                            إغلاق
                        </button>
                    </div>
                </div>
            `;

            modal.addEventListener('click', function(ev) {
                if (ev.target === modal) modal.remove();
            });

            document.body.appendChild(modal);
        }
        window.showDailyPaymentMethodBreakdown = showDailyPaymentMethodBreakdown;

        async function showDailyTotalBreakdown(param1, param2, param3, param4) {
            let config = {};
            if (typeof param1 === 'object' && param1 !== null) {
                config = param1;
            } else if (param1 !== undefined && param1 !== null) {
                config = {
                    cashSales: Number(param1) || 0,
                    cashReceipts: Number(param2) || 0,
                    cashDisbursements: Number(param3) || 0,
                    netTotal: Number(param4) || 0,
                    cashPurchases: 0,
                    cashSalesReturns: 0,
                    cashPurReturns: 0,
                    visaSales: 0
                };
            } else if (window.lastDailyBreakdownConfig) {
                config = window.lastDailyBreakdownConfig;
            }

            const cSales = config.cashSales || 0;
            const cReceipts = config.cashReceipts || 0;
            const cPurRet = config.cashPurReturns || 0;
            const cSalesRet = config.cashSalesReturns || 0;
            const cPurchases = config.cashPurchases || 0;
            const cDisbursements = config.cashDisbursements || 0;
            const net = (config.netTotal !== undefined) ? config.netTotal : ((cSales + cReceipts + cPurRet) - (cSalesRet + cPurchases + cDisbursements));
            const visa = config.visaSales || 0;
            const vfCash = (config.vodafoneCash !== undefined) ? config.vodafoneCash : (window.dailyReportData?.vodafoneSales ? (window.dailyReportData.vodafoneSales.cash + window.dailyReportData.vodafoneSales.nonCash) : 0);
            const vfPurchases = config.vfPurchases || 0;
            const vfSalesRet = config.vfSalesReturns || 0;
            const vfPurRet = config.vfPurReturns || 0;
            const vfReceipts = config.vfReceipts || 0;
            const vfDisb = config.vfDisbursements || 0;
            const totalNetVf = config.totalNetVfMovement !== undefined ? config.totalNetVfMovement : ((vfCash + vfPurRet + vfReceipts) - (vfSalesRet + vfPurchases + vfDisb));

            const prevBal = (config.previousBalance !== undefined) ? config.previousBalance : (window.dailyReportData?.previousBalance || 0);
            const finalBal = (config.finalCashBalance !== undefined) ? config.finalCashBalance : (prevBal + net);

            // استخراج العد الفعلي الحالي من الحقل الرئيسي أو من حالة الجرد
            const mainInp = document.getElementById('drawerActualCashInput');
            let currentActualVal = (mainInp && mainInp.value.trim() !== '' && !isNaN(parseFloat(mainInp.value)))
                ? parseFloat(mainInp.value)
                : (window.currentDrawerClosingState?.actualCash !== null && window.currentDrawerClosingState?.actualCash !== undefined
                    ? window.currentDrawerClosingState.actualCash
                    : null);

            let existingModal = document.getElementById('dailyTotalBreakdownModal');
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.id = 'dailyTotalBreakdownModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); z-index: 10000; display: flex; justify-content: center; align-items: flex-start; padding: 20px 12px; overflow-y: auto; box-sizing: border-box; animation: fadeIn 0.2s;';

            modal.innerHTML = `
                <div style="background: var(--surface-color, #ffffff); color: var(--text-color, #0f172a); border-radius: 20px; padding: 24px 28px; width: 100%; max-width: 660px; box-shadow: 0 25px 60px rgba(0,0,0,0.3); position: relative; animation: slideUp 0.25s ease; direction: rtl; border: 1.5px solid var(--border-color, #e2e8f0); margin: auto 0; box-sizing: border-box;">
                    
                    <!-- ترويسة النافذة المنظمة والواسعة بدون أي اقتطاع -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color, #f1f5f9); padding-bottom: 12px; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; flex-direction: column; gap: 3px;">
                            <h3 style="margin: 0; color: var(--main-purple, #4f46e5); font-size: 1.25rem; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                                <span>📋</span> تفاصيل احتساب صافي اليومية والدرج
                            </h3>
                            <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
                                جرد تفصيلي لمبيعات الكاش، فودافون كاش، السندات، والمطابقة الفورية
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button type="button" onclick="copyDailyTotalFromModal('${net}')" title="نسخ الصافي الدفتري" style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); color: var(--main-purple, #6366f1); border-radius: 8px; padding: 5px 12px; font-size: 0.84rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: 0.2s;">
                                <span>📋</span> نسخ الصافي
                            </button>
                            <button type="button" onclick="document.getElementById('dailyTotalBreakdownModal').remove()" style="background: #f1f5f9; border: 1.5px solid #cbd5e1; color: #475569; width: 34px; height: 34px; border-radius: 8px; font-size: 1.15rem; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" title="إغلاق النافذة">
                                ✕
                            </button>
                        </div>
                    </div>

                    ${(config.selectedUser && config.selectedUser !== 'all') ? `
                    <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 7px 14px; margin-bottom: 14px; font-weight: 800; color: #1d4ed8; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                        <span>👤</span> وردية / كاشير: <span>${config.selectedUser}</span>
                    </div>` : ''}

                    <!-- 1. مبيعات نقدية (كاش الدرج) -->
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 10px; margin-bottom: 6px; background: #f8fafc; border: 1px solid #e2e8f0;">
                        <span style="font-weight: 800; color: #1e293b; font-size: 0.98rem; display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 1.05rem;">💵</span>
                            <span style="color: #059669; font-weight: 900;">(+)</span> مبيعات نقدية (درج الكاش):
                        </span>
                        <span style="min-width: 145px; text-align: left; direction: ltr; font-family: 'Consolas', monospace; font-size: 1.12rem; font-weight: 900; color: var(--main-green, #059669); font-variant-numeric: tabular-nums;">
                            +${cSales.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م
                        </span>
                    </div>

                    <!-- 2. بطاقة مبيعات وتحصيل فودافون كاش (السهم المتصل) -->
                    ${(vfCash > 0 || totalNetVf !== 0) ? `
                    <div style="position: relative; margin: 8px 0; border: 1.5px dashed #93c5fd; background: #eff6ff; border-radius: 12px; padding: 10px 38px 10px 12px;">
                        <!-- سهم الربط الجانبي المتصل بين مبيعات وتحصيل فودافون كاش -->
                        <div style="position: absolute; right: 12px; top: 16px; bottom: 16px; width: 18px; display: flex; flex-direction: column; align-items: center; justify-content: space-between;" title="سهم متصل: العملية مسجلة وتقابلها تحصيلات الهاتف">
                            <span style="font-size: 11px; color: #2563eb; line-height: 1;">▲</span>
                            <div style="width: 2.5px; flex: 1; background: linear-gradient(180deg, #2563eb 0%, #8b5cf6 50%, #dc2626 100%); margin: 2px 0; border-radius: 2px;"></div>
                            <span style="font-size: 11px; color: #dc2626; line-height: 1;">▼</span>
                        </div>

                        <!-- مبيعات فودافون كاش (+) -->
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
                            <span style="font-weight: 800; color: #1d4ed8; font-size: 0.98rem; display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 1.05rem;">📱</span>
                                <span style="color: #2563eb; font-weight: 900;">(+)</span> مبيعات فودافون كاش (محفظة):
                            </span>
                            <span style="min-width: 145px; text-align: left; direction: ltr; font-family: 'Consolas', monospace; font-size: 1.12rem; font-weight: 900; color: #2563eb; font-variant-numeric: tabular-nums;">
                                +${vfCash.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م
                            </span>
                        </div>

                        <!-- شريط السهم المتصل والتوضيح -->
                        <div style="display: flex; align-items: center; gap: 6px; padding: 3px 8px; background: rgba(255,255,255,0.85); border: 1px solid #bfdbfe; border-radius: 6px; margin: 4px 0; font-size: 0.76rem; color: #1e40af; font-weight: 800;">
                            <span>⮁ سهم متصل:</span>
                            <span>مبيعات مسجلة تقابلها تحصيلات الهاتف بالمحفظة (الأثر على كاش الدرج = 0.00 ج.م)</span>
                        </div>

                        <!-- تحصيل فودافون كاش (-) -->
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
                            <span style="font-weight: 800; color: #b91c1c; font-size: 0.98rem; display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 1.05rem;">📲</span>
                                <span style="color: #dc2626; font-weight: 900;">(-)</span> تحصيل فودافون كاش (بالمحفظة لا الدرج):
                            </span>
                            <span style="min-width: 145px; text-align: left; direction: ltr; font-family: 'Consolas', monospace; font-size: 1.12rem; font-weight: 900; color: #dc2626; font-variant-numeric: tabular-nums;">
                                -${vfCash.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م
                            </span>
                        </div>
                    </div>` : ''}

                    <!-- 3. سندات قبض نقدية -->
                    ${(cReceipts > 0) ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 10px; margin-bottom: 6px; background: #f8fafc; border: 1px solid #e2e8f0;">
                        <span style="font-weight: 800; color: #1e293b; font-size: 0.98rem; display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 1.05rem;">💰</span>
                            <span style="color: #059669; font-weight: 900;">(+)</span> سندات قبض نقدية (إيرادات وتحصيلات بالدرج):
                        </span>
                        <span style="min-width: 145px; text-align: left; direction: ltr; font-family: 'Consolas', monospace; font-size: 1.12rem; font-weight: 900; color: var(--main-green, #059669); font-variant-numeric: tabular-nums;">
                            +${cReceipts.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م
                        </span>
                    </div>` : ''}

                    <!-- 4. مرتجع مشتريات نقدي (استرداد كاش للمحل) -->
                    ${cPurRet > 0 ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 10px; margin-bottom: 6px; background: #ecfdf5; border: 1px solid #a7f3d0;">
                        <span style="font-weight: 800; color: #1e293b; font-size: 0.98rem; display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 1.05rem;">🔙</span>
                            <span style="color: #059669; font-weight: 900;">(+)</span> مرتجع مشتريات نقدي (استرداد كاش دخل الدرج):
                        </span>
                        <span style="min-width: 145px; text-align: left; direction: ltr; font-family: 'Consolas', monospace; font-size: 1.12rem; font-weight: 900; color: var(--main-green, #059669); font-variant-numeric: tabular-nums;">
                            +${cPurRet.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م
                        </span>
                    </div>` : ''}

                    <!-- 5. مرتجع مبيعات نقدي (استرجاع نقدي للعميل من الدرج) -->
                    ${cSalesRet > 0 ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 10px; margin-bottom: 6px; background: #fff5f5; border: 1px solid #fed7d7;">
                        <span style="font-weight: 800; color: #1e293b; font-size: 0.98rem; display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 1.05rem;">↩️</span>
                            <span style="color: #dc2626; font-weight: 900;">(-)</span> مرتجع مبيعات نقدي (خرج من الدرج للعميل):
                        </span>
                        <span style="min-width: 145px; text-align: left; direction: ltr; font-family: 'Consolas', monospace; font-size: 1.12rem; font-weight: 900; color: var(--box-red, #dc2626); font-variant-numeric: tabular-nums;">
                            -${cSalesRet.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م
                        </span>
                    </div>` : ''}

                    <!-- 6. مشتريات نقدية (مدفوعات من الدرج) -->
                    ${cPurchases > 0 ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 10px; margin-bottom: 6px; background: #fff5f5; border: 1px solid #fed7d7;">
                        <span style="font-weight: 800; color: #1e293b; font-size: 0.98rem; display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 1.05rem;">🧺</span>
                            <span style="color: #dc2626; font-weight: 900;">(-)</span> مشتريات نقدية (مدفوعات كاش من الدرج):
                        </span>
                        <span style="min-width: 145px; text-align: left; direction: ltr; font-family: 'Consolas', monospace; font-size: 1.12rem; font-weight: 900; color: var(--box-red, #dc2626); font-variant-numeric: tabular-nums;">
                            -${cPurchases.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م
                        </span>
                    </div>` : ''}

                    <!-- 7. سندات صرف نقدية (مصروفات ومدفوعات) -->
                    ${(cDisbursements > 0) ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 10px; margin-bottom: 8px; background: #fff5f5; border: 1px solid #fed7d7;">
                        <span style="font-weight: 800; color: #1e293b; font-size: 0.98rem; display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 1.05rem;">💸</span>
                            <span style="color: #dc2626; font-weight: 900;">(-)</span> سندات صرف نقدية (مصروفات ومدفوعات):
                        </span>
                        <span style="min-width: 145px; text-align: left; direction: ltr; font-family: 'Consolas', monospace; font-size: 1.12rem; font-weight: 900; color: var(--box-red, #dc2626); font-variant-numeric: tabular-nums;">
                            -${cDisbursements.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م
                        </span>
                    </div>` : ''}

                    <!-- 8. بطاقة صافي المطلوب بالدرج (اليوم بيومه) -->
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 1.12rem; font-weight: 900; background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 13px 16px; border-radius: 14px; box-shadow: 0 4px 16px rgba(16,185,129,0.3); margin-top: 6px;">
                        <span style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.25rem;">💰</span> صافي المطلوب بالدرج (اليوم بيومه):
                        </span>
                        <span style="min-width: 145px; text-align: left; direction: ltr; font-family: 'Consolas', monospace; font-size: 1.35rem; font-weight: 900; font-variant-numeric: tabular-nums;">
                            ${net.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م
                        </span>
                    </div>

                    <!-- 9. 🧮 قسم المطابقة الفورية والعد الفعلي للدرج المباشر -->
                    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #cbd5e1; border-radius: 16px; padding: 16px; margin-top: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <span style="font-weight: 900; font-size: 1.05rem; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                                <span>🧮</span> مطابقة العد الفعلي لكاش الدرج:
                            </span>
                            <button type="button" onclick="openDrawerDenominationsCalculator()" style="background: #f59e0b; color: white; border: none; border-radius: 8px; padding: 5px 12px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(245,158,11,0.25);" title="فتح حاسبة فئات النقدية">
                                <span>🧮</span> حاسبة الفئات
                            </button>
                        </div>

                        <!-- حقل كتابة العد الفعلي المباشر -->
                        <div style="display: flex; align-items: center; gap: 10px; background: #ffffff; border: 2px solid #f59e0b; border-radius: 12px; padding: 6px 14px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.04);">
                            <span style="font-weight: 800; color: #92400e; font-size: 0.95rem; white-space: nowrap;">
                                💵 العد الفعلي لكاش الدرج:
                            </span>
                            <input type="number" id="modalDrawerActualCashInput" step="any" min="0" 
                                value="${currentActualVal !== null ? currentActualVal : ''}" 
                                placeholder="اكتب المبلغ الفعلي بالدرج (مثال: 5)..."
                                oninput="window.handleModalActualCashInput(this.value)"
                                style="flex: 1; height: 38px; border: none; outline: none; font-size: 1.3rem; font-weight: 900; color: #78350f; text-align: center; background: transparent; font-family: 'Consolas', monospace;"
                                onfocus="this.select()">
                            <span style="font-weight: 900; color: #92400e; font-size: 0.95rem;">ج.م</span>
                        </div>

                        <!-- بطاقة نتيجة المطابقة المباشرة والتسوية -->
                        <div id="modalAuditResultCard" style="border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; border: 1.5px solid #cbd5e1; background: #ffffff; transition: all 0.2s ease;">
                            <!-- سيتم تعبئتها ديناميكياً بواسطة syncModalAuditCardUI -->
                        </div>
                    </div>

                    ${vfCash > 0 ? `
                    <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 12px 14px; margin-top: 14px; font-size: 0.88rem; color: #334155; line-height: 1.6;">
                        💡 <b>توضيح التقفيل:</b> مبيعات فودافون كاش <b>(+${vfCash.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م)</b> سُجلت كإيراد ثم استُبعدت من كاش الدرج <b>(-${vfCash.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م)</b> لأنها دُفعت على محفظة الهاتف ولم تدخل الدرج الورقي، وبذلك الصافي المطلوب وجوده بالدرج هو <b>${net.toLocaleString('en-US', {minimumFractionDigits:2})} ج.م</b> بدون أي عجز.
                    </div>` : ''}

                    <button type="button" onclick="document.getElementById('dailyTotalBreakdownModal').remove()" style="width: 100%; margin-top: 18px; background: var(--main-purple, #6366f1); color: white; border: none; padding: 12px; border-radius: 12px; font-size: 1.05rem; font-weight: 800; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(99,102,241,0.25);" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">إغلاق النافذة</button>
                </div>
            `;

            document.body.appendChild(modal);

            // تفعيل بطاقة نتيجة المطابقة فور فتح النافذة بناءً على المبلغ الفعلي المدخل مسبقاً
            if (typeof window.syncModalAuditCardUI === 'function') {
                window.syncModalAuditCardUI(currentActualVal !== null ? currentActualVal : '');
            }
        }

        window.handleModalActualCashInput = function(val) {
            const mainInp = document.getElementById('drawerActualCashInput');
            if (mainInp && mainInp.value !== val) {
                mainInp.value = val;
            }
            if (typeof window.handleDrawerActualCashInput === 'function') {
                window.handleDrawerActualCashInput(val);
            }
        };

        window.syncModalAuditCardUI = function(val) {
            const resCard = document.getElementById('modalAuditResultCard');
            if (!resCard) return;

            if (val === '' || val === null || val === undefined || isNaN(parseFloat(val))) {
                resCard.style.background = '#f8fafc';
                resCard.style.borderColor = '#cbd5e1';
                resCard.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.4rem;">⏳</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 800; color: #475569; font-size: 0.95rem;">في انتظار عد النقدية بالدرج...</span>
                            <span style="font-size: 0.78rem; color: #64748b;">اكتب المبلغ الموجود في الدرج بالأعلى لمعرفة العجز أو الزيادة فوراً</span>
                        </div>
                    </div>
                    <span style="font-weight: 800; color: #94a3b8; font-size: 0.95rem;">0.00 ج.م</span>
                `;
                return;
            }

            const actual = parseFloat(val) || 0;
            const expected = window.currentDrawerClosingState?.expectedCash !== undefined 
                ? window.currentDrawerClosingState.expectedCash 
                : (window.currentDrawerClosingState?.netCashMovement || 0);
            const diff = actual - expected;
            const absDiff = Math.abs(diff);

            if (absDiff < 0.01) {
                resCard.style.background = '#ecfdf5';
                resCard.style.borderColor = '#10b981';
                resCard.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.5rem;">✅</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 900; color: #065f46; font-size: 1.02rem;">الدرج متطابق تماماً مع الدفاتر</span>
                            <span style="font-size: 0.8rem; color: #047857;">الدرج سليم 100% ولا يوجد أي عجز أو زيادة</span>
                        </div>
                    </div>
                    <div style="text-align: left; direction: ltr;">
                        <span style="font-weight: 900; color: #059669; font-size: 1.3rem; font-family: 'Consolas', monospace;">0.00 ج.م</span>
                    </div>
                `;
            } else if (diff > 0) {
                resCard.style.background = '#eff6ff';
                resCard.style.borderColor = '#3b82f6';
                resCard.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.5rem;">💡</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 900; color: #1e40af; font-size: 1.02rem;">زيادة نقدية بالدرج (فائض كاش)</span>
                            <span style="font-size: 0.8rem; color: #1d4ed8;">الموجود بالدرج أكبر من الصافي الدفتري (+${absDiff.toFixed(2)} ج.م)</span>
                        </div>
                    </div>
                    <div style="text-align: left; direction: ltr;">
                        <span style="font-weight: 900; color: #2563eb; font-size: 1.35rem; font-family: 'Consolas', monospace;">+${absDiff.toFixed(2)} ج.م</span>
                    </div>
                `;
            } else {
                resCard.style.background = '#fef2f2';
                resCard.style.borderColor = '#ef4444';
                resCard.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.5rem;">⚠️</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 900; color: #991b1b; font-size: 1.02rem;">عجز نقدي بالدرج (نقص كاش)</span>
                            <span style="font-size: 0.8rem; color: #b91c1c;">الموجود بالدرج أقل من الصافي الدفتري (-${absDiff.toFixed(2)} ج.م)</span>
                        </div>
                    </div>
                    <div style="text-align: left; direction: ltr;">
                        <span style="font-weight: 900; color: #dc2626; font-size: 1.35rem; font-family: 'Consolas', monospace;">-${absDiff.toFixed(2)} ج.م</span>
                    </div>
                `;
            }
        };

        function copyDailyTotalFromModal(val) {
            if (!val) return;
            if (document.body.classList.contains('daily-amounts-hidden')) {
                if (typeof showToast === 'function') showToast("🔒 المبالغ المالية مخفية ومحمية", "warning");
                return;
            }
            const numVal = parseFloat(val).toLocaleString('en-US', {minimumFractionDigits:2});
            navigator.clipboard.writeText(numVal).then(() => {
                showToast("📋 تم نسخ الإجمالي: " + numVal);
            });
        }

        window.copyAllOpsGrandTotal = function(val) {
            if (document.body.classList.contains('daily-amounts-hidden')) {
                if (typeof showToast === 'function') showToast("🔒 المبالغ المالية مخفية ومحمية", "warning");
                return;
            }
            const raw = (val !== undefined && val !== null) ? val : (window.dailyReportData ? (window.dailyReportData.effectiveCashSales || 0) : 0);
            const numVal = parseFloat(raw || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            
            const doCopy = () => {
                if (typeof showToast === 'function') showToast(`📋 تم نسخ صافي نقدية اليومية والدرج بنجاح: ${numVal} ج.م`, 'success');
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(numVal).then(doCopy).catch(() => {
                    fallbackCopy(numVal);
                });
            } else {
                fallbackCopy(numVal);
            }

            function fallbackCopy(text) {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    doCopy();
                } catch (e) {}
                ta.remove();
            }
        };

        window.copyDailyTotal = function() {
            if (document.body.classList.contains('daily-amounts-hidden')) {
                if (typeof showToast === 'function') showToast("🔒 المبالغ المالية مخفية ومحمية، لا يمكن النسخ إلا بعد إظهارها بإذن المدير", "warning");
                return;
            }
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
            if (hideDrawerBalance) return;
            const el = document.getElementById('dailyTotalSalesReceipts');
            if (!el) return;
            const text = el.innerText || el.textContent || '';
            const cleanNum = text.replace(/[^0-9.]/g, '');
            if (cleanNum && navigator.clipboard) {
                navigator.clipboard.writeText(cleanNum).then(() => {
                    if (typeof showToast === 'function') showToast("📋 تم نسخ إجمالي اليومية: " + cleanNum, "success");
                }).catch(() => {
                    if (typeof showToast === 'function') showToast("📋 " + text, "info");
                });
            }
        };

        // ================= 🔒 لوحة تقفيل وجرد الدرج والخزينة واحتساب العجز والزيادة =================

        window.currentDrawerClosingState = {
            previousBalance: 0,
            netCashMovement: 0,
            finalCashBalance: 0,
            includePrevBalance: false, // 🌟 الافتراضي حركة اليوم بيومه فقط بدون تراكمات تاريخية
            expectedCash: 0,
            actualCash: null,
            difference: 0,
            status: 'pending',
            selectedUser: 'all',
            notes: '',
            denominations: null
        };

        // ================= 🛡️ إدارة تخزين واسترجاع محاضر التقفيل في محرك SQLite =================
        window.getSavedDrawerClosures = function() {
            let closures = [];
            try {
                const raw = (typeof getStore === 'function' ? getStore('bayan_drawer_closures') : null)
                         || (typeof localStorage !== 'undefined' ? localStorage.getItem('bayan_drawer_closures') : null);
                if (raw) {
                    try {
                        closures = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    } catch (e) {
                        closures = [];
                    }
                }
            } catch (err) {
                closures = [];
            }
            return Array.isArray(closures) ? closures : [];
        };

        window.saveDrawerClosuresToDb = async function(closures) {
            if (!Array.isArray(closures)) return;
            const strVal = JSON.stringify(closures);

            // 1. الحفظ في الذاكرة السريعة و localStorage
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('bayan_drawer_closures', strVal);
                }
            } catch (e) {}

            try {
                if (typeof setStore === 'function') {
                    setStore('bayan_drawer_closures', strVal);
                }
            } catch (e) {}

            // 2. الحفظ المباشر والقطعي داخل جدول settings في محرك SQLite
            try {
                const dbInst = window.bayanDB || window.db || window.BayanDBAdapter;
                if (dbInst && dbInst.settings && typeof dbInst.settings.put === 'function') {
                    await dbInst.settings.put({ id: 'bayan_drawer_closures', value: strVal });
                }
            } catch (dbErr) {
                console.warn("[SQLite] Error putting closures into settings table:", dbErr);
            }

            // 3. كتابة وتفريغ فوري على ملف الداتابيز الحقيقي على القرص الصلب (Flush to Disk)
            try {
                if (window.sqliteManager && typeof window.sqliteManager.persistNow === 'function') {
                    await window.sqliteManager.persistNow();
                } else {
                    const dbInst = window.bayanDB || window.db;
                    if (dbInst && typeof dbInst.persistNow === 'function') {
                        await dbInst.persistNow();
                    }
                }
            } catch (flushErr) {
                console.warn("[SQLite] Error persisting closures to disk:", flushErr);
            }
        };

        // تطهير تلقائي للمحاضر القديمة لربط كل محضر بتاريخه الفعلي ومنع تداخل الأيام السابقة
        try {
            const cls = window.getSavedDrawerClosures();
            if (Array.isArray(cls) && cls.length > 0) {
                let modified = false;
                cls.forEach(c => {
                    if (c.dateFrom && c.dateISO && c.dateFrom !== c.dateISO) {
                        c.dateISO = c.dateFrom;
                        modified = true;
                    }
                });
                if (modified) {
                    window.saveDrawerClosuresToDb(cls);
                }
            }
        } catch (e) {}

        window.updateDrawerAuditPanelUI = function(previousBalance, netCashMovement, finalCashBalance, selectedUser) {
            window.currentDrawerClosingState.previousBalance = parseFloat(previousBalance) || 0;
            window.currentDrawerClosingState.netCashMovement = parseFloat(netCashMovement) || 0;
            window.currentDrawerClosingState.finalCashBalance = parseFloat(finalCashBalance) || 0;
            window.currentDrawerClosingState.selectedUser = selectedUser || 'all';

            // 🌟 احتساب المطلوب بالدرج: حركة اليوم بيومه فقط (المفروض يكون معاك من حركة اليوم)
            const expected = window.currentDrawerClosingState.includePrevBalance 
                ? window.currentDrawerClosingState.finalCashBalance 
                : window.currentDrawerClosingState.netCashMovement;
            window.currentDrawerClosingState.expectedCash = expected;

            const shiftLabel = document.getElementById('drawerAuditShiftLabel');
            if (shiftLabel) {
                if (selectedUser && selectedUser !== 'all') {
                    shiftLabel.innerHTML = `👤 وردية: ${selectedUser}`;
                    shiftLabel.style.background = '#fef3c7';
                    shiftLabel.style.color = '#b45309';
                    shiftLabel.style.borderColor = '#fde68a';
                } else {
                    shiftLabel.innerHTML = `👥 كافة المستخدمين (شامل)`;
                    shiftLabel.style.background = '#eff6ff';
                    shiftLabel.style.color = '#2563eb';
                    shiftLabel.style.borderColor = '#bfdbfe';
                }
            }

            const prevEl = document.getElementById('auditCardPrevBalance');
            if (prevEl) {
                prevEl.innerText = (window.currentDrawerClosingState.previousBalance).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }

            const netEl = document.getElementById('auditCardNetMovement');
            if (netEl) {
                const net = window.currentDrawerClosingState.netCashMovement;
                netEl.innerText = (net >= 0 ? '+' : '') + net.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                netEl.style.color = net >= 0 ? '#059669' : '#dc2626';
            }

            const expEl = document.getElementById('auditCardExpectedCash');
            if (expEl) {
                expEl.innerText = expected.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }

            const vfEl = document.getElementById('auditCardVodafoneCash');
            if (vfEl) {
                const vfNet = window.dailyReportData?.vodafoneCashTotal !== undefined
                    ? window.dailyReportData.vodafoneCashTotal
                    : (window.dailyReportData?.vodafoneSales ? (window.dailyReportData.vodafoneSales.cash + window.dailyReportData.vodafoneSales.nonCash) : 0);
                vfEl.innerText = Number(vfNet || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }

            const visaEl = document.getElementById('auditCardVisaSales');
            if (visaEl) {
                let visaNet = 0;
                if (window.dailyReportData?.paymentMethodsSummary) {
                    for (const [mName, mData] of Object.entries(window.dailyReportData.paymentMethodsSummary)) {
                        if (String(mName).includes('فيزا') || String(mName).includes('شبك')) {
                            visaNet += (mData.net || 0);
                        }
                    }
                }
                visaEl.innerText = Number(visaNet || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            }

            const toggleBtn = document.getElementById('btnTogglePrevBalance');
            if (toggleBtn) {
                toggleBtn.innerText = window.currentDrawerClosingState.includePrevBalance ? '🏛️ شامل التراكمي السابق' : '🔄 اليوم بيومه';
                toggleBtn.title = window.currentDrawerClosingState.includePrevBalance ? 'معروض شامل الرصيد التاريخي السابق - انقر للتحويل إلى حركة اليوم بيومه فقط' : 'معروض صافي حركة اليوم بيومه فقط - انقر لاحتساب الرصيد التاريخي السابق';
            }

            const inputEl = document.getElementById('drawerActualCashInput');
            if (inputEl) {
                const currentReportDate = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
                const currentUserShift = window.currentDrawerClosingState.selectedUser || 'all';
                const currentReportKey = currentReportDate + '_' + currentUserShift;

                const isDateOrShiftChanged = (!window.currentDrawerClosingState.lastReportKey || window.currentDrawerClosingState.lastReportKey !== currentReportKey);
                window.currentDrawerClosingState.lastReportKey = currentReportKey;

                // 🌟 فحص سجل التقفيل المحفوظ للتاريخ والوردية المحددة لاسترجاع العد الفعلي تلقائياً
                const closures = typeof window.getSavedDrawerClosures === 'function' 
                    ? window.getSavedDrawerClosures() 
                    : [];

                const targetRecord = closures.find(c => {
                    const matchDate = (c.dateISO === currentReportDate || c.dateFrom === currentReportDate);
                    const matchShift = (currentUserShift === 'all') 
                        ? true 
                        : (c.userShift === currentUserShift || c.userShift === 'كافة المستخدمين' || !c.userShift);
                    return matchDate && matchShift;
                });

                if (isDateOrShiftChanged) {
                    if (targetRecord && targetRecord.actualCash !== undefined && targetRecord.actualCash !== null) {
                        // 🌟 تم العثور على محضر تقفيل مسجل لهذا اليوم والوردية: استرجاع العد الفعلي المحفوظ وعرض الفارق فوراً
                        const savedActual = Number(targetRecord.actualCash || 0).toFixed(2);
                        inputEl.value = savedActual;
                        window.currentDrawerClosingState.actualCash = targetRecord.actualCash;
                        window.currentDrawerClosingState.notes = targetRecord.notes || '';
                        window.currentDrawerClosingState.denominations = targetRecord.denominations || null;
                        delete window.currentDrawerClosingState.userExplicitlyCleared;
                        window.handleDrawerActualCashInput(savedActual);
                    } else {
                        // 🌟 يوم أو وردية جديدة لم تُقفل بعد: تصفير الخانة لبدء جرد جديد بدون توارث مبالغ سابقة
                        inputEl.value = '';
                        window.currentDrawerClosingState.actualCash = null;
                        window.currentDrawerClosingState.notes = '';
                        window.currentDrawerClosingState.denominations = null;
                        delete window.currentDrawerClosingState.userExplicitlyCleared;
                        window.handleDrawerActualCashInput('');
                    }
                } else if (inputEl.value.trim() !== '') {
                    // المستخدم كتب أو عدل مبلغاً وما زال في نفس اليوم/الوردية: الاحتفاظ بالمبلغ المكتوب
                    window.handleDrawerActualCashInput(inputEl.value);
                } else if (targetRecord && targetRecord.actualCash !== undefined && targetRecord.actualCash !== null && window.currentDrawerClosingState.userExplicitlyCleared !== currentReportKey) {
                    // استرجاع المحضر المحفوظ تلقائياً إذا كان المربع فارغاً ولم يقم المستخدم بمسحه يدوياً
                    const savedActual = Number(targetRecord.actualCash || 0).toFixed(2);
                    inputEl.value = savedActual;
                    window.currentDrawerClosingState.actualCash = targetRecord.actualCash;
                    window.currentDrawerClosingState.notes = targetRecord.notes || '';
                    window.currentDrawerClosingState.denominations = targetRecord.denominations || null;
                    window.handleDrawerActualCashInput(savedActual);
                } else {
                    // المربع تم تفريغه يدوياً من المستخدم: يظل فارغاً تماماً
                    window.currentDrawerClosingState.actualCash = null;
                    window.handleDrawerActualCashInput('');
                }
            }
        };

        window.toggleIncludePrevBalanceInAudit = function() {
            window.currentDrawerClosingState.includePrevBalance = !window.currentDrawerClosingState.includePrevBalance;
            window.updateDrawerAuditPanelUI(
                window.currentDrawerClosingState.previousBalance,
                window.currentDrawerClosingState.netCashMovement,
                window.currentDrawerClosingState.finalCashBalance,
                window.currentDrawerClosingState.selectedUser
            );
            if (typeof showToast === 'function') {
                showToast(window.currentDrawerClosingState.includePrevBalance 
                    ? "🏛️ تم احتساب الرصيد التراكمي السابق مع نقدية اليوم" 
                    : "🔄 تم ضبط المطلوب على حركة اليوم بيومه فقط", "info");
            }
        };

        window.handleDrawerActualCashInput = function(val) {
            const card = document.getElementById('drawerAuditResultCard');
            const icon = document.getElementById('drawerAuditResultIcon');
            const title = document.getElementById('drawerAuditResultTitle');
            const sub = document.getElementById('drawerAuditResultSub');
            const diffEl = document.getElementById('drawerAuditDiffAmount');
            const labelEl = document.getElementById('drawerAuditDiffLabel');

            if (!card || !icon || !title || !diffEl) return;

            const curReportDate = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
            const curReportShift = window.currentDrawerClosingState.selectedUser || 'all';

            if (val === '' || val === null || val === undefined || isNaN(parseFloat(val))) {
                window.currentDrawerClosingState.actualCash = null;
                window.currentDrawerClosingState.difference = 0;
                window.currentDrawerClosingState.status = 'pending';
                window.currentDrawerClosingState.userExplicitlyCleared = curReportDate + '_' + curReportShift;

                card.style.background = '#f1f5f9';
                card.style.borderColor = '#cbd5e1';
                icon.innerText = '⏳';
                title.innerText = 'في انتظار عد النقدية بالدرج...';
                title.style.color = '#334155';
                if (sub) sub.innerText = 'اكتب المبلغ الفعلي الموجود في الدرج داخل المربع الأصفر بالأعلى لمعرفة العجز أو الزيادة فوراً.';
                diffEl.innerText = '0.00 ج.م';
                diffEl.style.color = '#64748b';
                if (labelEl) labelEl.innerText = 'الفارق (الفعلي - المطلوب)';

                const opsBadge = document.getElementById('opsRowAuditStatusBadge');
                if (opsBadge) {
                    opsBadge.innerHTML = '⏳ بانتظار العد';
                    opsBadge.style.background = 'rgba(255,255,255,0.18)';
                    opsBadge.style.color = '#f8fafc';
                    opsBadge.style.borderColor = 'rgba(255,255,255,0.3)';
                }
                const modalInput = document.getElementById('modalDrawerActualCashInput');
                if (modalInput && modalInput.value !== '') {
                    modalInput.value = '';
                }
                if (typeof window.syncModalAuditCardUI === 'function') {
                    window.syncModalAuditCardUI('');
                }
                return;
            }

            if (window.currentDrawerClosingState.userExplicitlyCleared === (curReportDate + '_' + curReportShift)) {
                delete window.currentDrawerClosingState.userExplicitlyCleared;
            }

            const actual = parseFloat(val) || 0;
            const expected = window.currentDrawerClosingState.expectedCash !== undefined ? window.currentDrawerClosingState.expectedCash : window.currentDrawerClosingState.netCashMovement;
            const diff = actual - expected;
            const absDiff = Math.abs(diff);

            window.currentDrawerClosingState.actualCash = actual;
            window.currentDrawerClosingState.difference = diff;

            const opsBadge = document.getElementById('opsRowAuditStatusBadge');

            if (absDiff < 0.01) {
                window.currentDrawerClosingState.status = 'balanced';
                card.style.background = '#ecfdf5';
                card.style.borderColor = '#10b981';
                icon.innerText = '✅';
                title.innerText = 'الدرج مطابق تماماً بالقرش!';
                title.style.color = '#065f46';
                if (sub) sub.innerText = 'النقدية الفعلية بالدرج تتطابق 100% مع صافي حركة اليوم المطلوب. لا يوجد أي عجز أو زيادة.';
                diffEl.innerText = '0.00 ج.م';
                diffEl.style.color = '#059669';
                if (labelEl) {
                    labelEl.innerText = '✅ مطابق بدون عجز أو زيادة';
                    labelEl.style.color = '#059669';
                }
                if (opsBadge) {
                    opsBadge.innerHTML = '✅ متطابق تماماً';
                    opsBadge.style.background = '#ecfdf5';
                    opsBadge.style.color = '#059669';
                    opsBadge.style.borderColor = '#10b981';
                }
            } else if (diff < 0) {
                window.currentDrawerClosingState.status = 'deficit';
                card.style.background = '#fef2f2';
                card.style.borderColor = '#ef4444';
                icon.innerText = '⚠️';
                title.innerText = `فارق بالدرج (مصروفات/شنط لم تُسجل): -${absDiff.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م`;
                title.style.color = '#991b1b';
                if (sub) sub.innerText = 'المبلغ الفعلي أقل من صافي مبيعات اليوم (قد يكون هناك مصاريف نثرية، شنط، شاي، بريل، أو صدقات خرجت من الدرج ولم تُسجل بالسندات).';
                diffEl.innerText = `-${absDiff.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م`;
                diffEl.style.color = '#dc2626';
                if (labelEl) {
                    labelEl.innerText = '🔴 فارق عجز / مصاريف غير مسجلة';
                    labelEl.style.color = '#dc2626';
                }
                if (opsBadge) {
                    opsBadge.innerHTML = `⚠️ عجز: -${absDiff.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م`;
                    opsBadge.style.background = '#fee2e2';
                    opsBadge.style.color = '#dc2626';
                    opsBadge.style.borderColor = '#ef4444';
                }
            } else {
                window.currentDrawerClosingState.status = 'surplus';
                card.style.background = '#eff6ff';
                card.style.borderColor = '#3b82f6';
                icon.innerText = '📈';
                title.innerText = `توجد زيادة نقدية في الدرج بمقدار: +${absDiff.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م`;
                title.style.color = '#1e40af';
                if (sub) sub.innerText = 'المبلغ الفعلي بالدرج أكبر من صافي مبيعات اليوم (قد تكون فكة بداية أو إيراد لم يُسجل).';
                diffEl.innerText = `+${absDiff.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م`;
                diffEl.style.color = '#2563eb';
                if (labelEl) {
                    labelEl.innerText = '🟢 زيادة نقدية بالدرج';
                    labelEl.style.color = '#2563eb';
                }
                if (opsBadge) {
                    opsBadge.innerHTML = `💡 زيادة: +${absDiff.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م`;
                    opsBadge.style.background = '#eff6ff';
                    opsBadge.style.color = '#2563eb';
                    opsBadge.style.borderColor = '#3b82f6';
                }
            }

            const modalInput = document.getElementById('modalDrawerActualCashInput');
            if (modalInput && String(modalInput.value) !== String(val || '')) {
                modalInput.value = (val !== null && val !== undefined) ? val : '';
            }
            if (typeof window.syncModalAuditCardUI === 'function') {
                window.syncModalAuditCardUI(val);
            }
        };

        // --- حاسبة فئات النقدية المصرية (200، 100، 50...) ---
        window.openDrawerDenominationsCalculator = function(customDenoms, targetInputId) {
            let existing = document.getElementById('drawerDenominationsModal');
            if (existing) existing.remove();

            window.currentDrawerClosingState.targetDenomInputId = targetInputId || null;

            const denoms = [
                { val: 200, label: 'فئة 200 جنيه', color: '#1e3a8a' },
                { val: 100, label: 'فئة 100 جنيه', color: '#0369a1' },
                { val: 50,  label: 'فئة 50 جنيه',  color: '#0f766e' },
                { val: 20,  label: 'فئة 20 جنيه (جديدة/قديمة)', color: '#b45309' },
                { val: 10,  label: 'فئة 10 جنيه (بلاستيكية/ورقية)', color: '#c2410c' },
                { val: 5,   label: 'فئة 5 جنيه',   color: '#4338ca' },
                { val: 1,   label: 'فئة 1 جنيه (عملات معدنية/ورقية)', color: '#475569' },
                { val: 0.5, label: 'فئة 0.50 نصف جنيه', color: '#64748b' }
            ];

            const currentDenoms = customDenoms || window.currentDrawerClosingState.denominations || {};

            const rowsHtml = denoms.map(d => {
                const count = currentDenoms[d.val] || '';
                const subtotal = (parseFloat(count) || 0) * d.val;
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 10px; margin-bottom: 8px; border: 1px solid #e2e8f0;">
                        <div style="flex: 1.5; font-weight: 800; font-size: 0.92rem; color: ${d.color}; display: flex; align-items: center; gap: 6px;">
                            <span>💵</span> ${d.label}
                        </div>
                        <div style="flex: 1; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">العدد:</span>
                            <input type="number" min="0" step="1" class="denom-input" data-denom="${d.val}" value="${count}"
                                oninput="calculateDenominationsTotal()" placeholder="0"
                                style="width: 75px; height: 36px; text-align: center; font-size: 1rem; font-weight: 900; border: 1.5px solid #cbd5e1; border-radius: 8px; outline: none;"
                                onfocus="this.select()">
                        </div>
                        <div style="flex: 1; text-align: left; font-weight: 900; font-size: 0.95rem; color: #0f172a;">
                            <span id="denomSubtotal_${d.val.toString().replace('.', '_')}">${subtotal.toFixed(2)}</span> ج.م
                        </div>
                    </div>
                `;
            }).join('');

            const modal = document.createElement('div');
            modal.id = 'drawerDenominationsModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 15px; box-sizing: border-box; direction: rtl; font-family: inherit;';

            modal.innerHTML = `
                <div style="background: #ffffff; color: #0f172a; width: 100%; max-width: 520px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); overflow: hidden; border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; max-height: 90vh;">
                    <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 16px 20px; color: white; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">🧮</span>
                            <div>
                                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900;">حاسبة فئات النقدية بالدرج</h3>
                                <p style="margin: 2px 0 0 0; font-size: 0.78rem; opacity: 0.9;">اكتب عدد كل فئة ورقية أو معدنية ليتم احتساب الإجمالي تلقائياً</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('drawerDenominationsModal').remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; font-size: 1.1rem; cursor: pointer;">✕</button>
                    </div>

                    <div style="padding: 16px; overflow-y: auto; flex: 1;">
                        ${rowsHtml}
                    </div>

                    <div style="padding: 16px 20px; background: #f8fafc; border-top: 1.5px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                            <span style="font-weight: 900; font-size: 1.05rem; color: #1e293b;">إجمالي النقدية المحصية:</span>
                            <span id="denomGrandTotal" style="font-size: 1.45rem; font-weight: 900; color: #b45309; background: #fef3c7; padding: 4px 14px; border-radius: 10px; border: 1px solid #fde68a;">0.00 ج.م</span>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button type="button" onclick="applyDenominationsToDrawerInput()"
                                style="flex: 2; height: 44px; background: linear-gradient(135deg, #059669, #10b981); color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.98rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                                <span>✅</span> اعتماد ونقل إلى خانة الدرج
                            </button>
                            <button type="button" onclick="resetDenominationsCalculator()"
                                style="flex: 1; height: 44px; background: #ffffff; color: #dc2626; border: 1.5px solid #fca5a5; border-radius: 12px; font-weight: 800; font-size: 0.88rem; cursor: pointer;">
                                إعادة تعيين
                            </button>
                        </div>
                    </div>
                </div>
            `;

            modal.addEventListener('click', function(ev) { if (ev.target === modal) modal.remove(); });
            document.body.appendChild(modal);
            window.calculateDenominationsTotal();
        };

        window.calculateDenominationsTotal = function() {
            const inputs = document.querySelectorAll('.denom-input');
            let total = 0;
            const denomsRecord = {};

            inputs.forEach(inp => {
                const denomVal = parseFloat(inp.getAttribute('data-denom')) || 0;
                const count = parseFloat(inp.value) || 0;
                const sub = count * denomVal;
                total += sub;
                denomsRecord[denomVal] = count;

                const subEl = document.getElementById(`denomSubtotal_${denomVal.toString().replace('.', '_')}`);
                if (subEl) {
                    subEl.innerText = sub.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                }
            });

            const grandEl = document.getElementById('denomGrandTotal');
            if (grandEl) {
                grandEl.innerText = total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' ج.م';
            }

            window.currentDrawerClosingState.tempDenomTotal = total;
            window.currentDrawerClosingState.tempDenomsRecord = denomsRecord;
        };

        window.resetDenominationsCalculator = function() {
            document.querySelectorAll('.denom-input').forEach(inp => inp.value = '');
            window.calculateDenominationsTotal();
        };

        window.applyDenominationsToDrawerInput = function() {
            const total = window.currentDrawerClosingState.tempDenomTotal || 0;
            const denomsRec = window.currentDrawerClosingState.tempDenomsRecord || {};
            window.currentDrawerClosingState.denominations = denomsRec;

            const targetId = window.currentDrawerClosingState.targetDenomInputId;
            if (targetId && document.getElementById(targetId)) {
                const inp = document.getElementById(targetId);
                inp.value = total.toFixed(2);
                if (targetId === 'editActualCashAmount') {
                    window.currentDrawerClosingState.tempEditDenominations = denomsRec;
                    if (typeof window.recalcEditDrawerDiff === 'function') {
                        window.recalcEditDrawerDiff();
                    }
                } else if (targetId === 'drawerActualCashInput') {
                    window.handleDrawerActualCashInput(inp.value);
                }
            } else {
                const editInp = document.getElementById('editActualCashAmount');
                if (editInp) {
                    editInp.value = total.toFixed(2);
                    window.currentDrawerClosingState.tempEditDenominations = denomsRec;
                    if (typeof window.recalcEditDrawerDiff === 'function') {
                        window.recalcEditDrawerDiff();
                    }
                }
                const input = document.getElementById('drawerActualCashInput');
                if (input) {
                    input.value = total.toFixed(2);
                    window.handleDrawerActualCashInput(input.value);
                }
            }

            const modal = document.getElementById('drawerDenominationsModal');
            if (modal) modal.remove();

            if (typeof showToast === 'function') {
                showToast(`✅ تم نقل وتطبيق إجمالي الفئات: ${total.toLocaleString('en-US', {minimumFractionDigits: 2})} ج.م`, 'success');
            }
        };

        // --- نافذة الملاحظات على التقفيل ---
        window.openDrawerClosingNotesModal = function() {
            let existing = document.getElementById('drawerClosingNotesModal');
            if (existing) existing.remove();

            const currentNotes = window.currentDrawerClosingState.notes || '';

            const modal = document.createElement('div');
            modal.id = 'drawerClosingNotesModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 15px; box-sizing: border-box; direction: rtl; font-family: inherit;';

            modal.innerHTML = `
                <div style="background: #ffffff; color: #0f172a; width: 100%; max-width: 480px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); overflow: hidden; border: 1.5px solid #cbd5e1;">
                    <div style="background: linear-gradient(135deg, #1e293b, #334155); padding: 16px 20px; color: white; display: flex; align-items: center; justify-content: space-between;">
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                            <span>📝</span> ملاحظات تقفيل الدرج والوردية
                        </h3>
                        <button onclick="document.getElementById('drawerClosingNotesModal').remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; font-size: 1.1rem; cursor: pointer;">✕</button>
                    </div>
                    <div style="padding: 20px;">
                        <p style="margin: 0 0 10px 0; font-size: 0.88rem; color: #64748b; font-weight: 700;">
                            اكتب أي تفاصيل هامة تخص العجز أو الزيادة، أو تسليم النقدية للإدارة، أو توجيهات للوردية التالية:
                        </p>
                        <textarea id="drawerClosingNotesText" rows="4" placeholder="اكتب الملاحظات هنا..."
                            style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px; font-family: inherit; font-size: 0.95rem; box-sizing: border-box; outline: none;">${currentNotes}</textarea>
                        
                        <div style="margin-top: 16px; display: flex; gap: 10px;">
                            <button type="button" onclick="saveDrawerClosingNotes()"
                                style="flex: 1; height: 42px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border: none; border-radius: 10px; font-weight: 900; font-size: 0.95rem; cursor: pointer;">
                                حفظ الملاحظات ✅
                            </button>
                            <button type="button" onclick="document.getElementById('drawerClosingNotesModal').remove()"
                                style="height: 42px; padding: 0 16px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 10px; font-weight: 800; font-size: 0.9rem; cursor: pointer;">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            `;

            modal.addEventListener('click', function(ev) { if (ev.target === modal) modal.remove(); });
            document.body.appendChild(modal);
        };

        window.saveDrawerClosingNotes = function() {
            const ta = document.getElementById('drawerClosingNotesText');
            if (ta) {
                window.currentDrawerClosingState.notes = ta.value.trim();
            }
            const modal = document.getElementById('drawerClosingNotesModal');
            if (modal) modal.remove();
            if (typeof showToast === 'function') {
                showToast("✅ تم حفظ ملاحظات التقفيل بنجاح", "info");
            }
        };

                // --- اعتماد وتقفيل الوردية والدرج ---
        window.commitDrawerClosing = async function() {
            const actualInput = document.getElementById('drawerActualCashInput');
            if (!actualInput || actualInput.value.trim() === '') {
                if (typeof showToast === 'function') {
                    showToast("⚠️ يرجى أولاً عد النقدية وكتابة المبلغ الفعلي الموجود بالدرج في المربع الأصفر!", "warning");
                } else {
                    alert("يرجى أولاً عد النقدية وكتابة المبلغ الفعلي الموجود بالدرج!");
                }
                if (actualInput) actualInput.focus();
                return;
            }

            const state = window.currentDrawerClosingState || {};
            const expected = state.expectedCash !== undefined ? state.expectedCash : (state.netCashMovement || 0);
            const actual = parseFloat(actualInput.value) || 0;
            const diff = actual - expected;
            const absDiff = Math.abs(diff);

            const userShift = (state.selectedUser && state.selectedUser !== 'all') ? state.selectedUser : ((typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'كافة المستخدمين');

            // فحص ما إذا كان هناك محضر تقفيل سابق مسجل لنفس اليوم والوردية من SQLite
            const closures = typeof window.getSavedDrawerClosures === 'function' 
                ? window.getSavedDrawerClosures() 
                : [];

            const targetShiftDate = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
            const existingToday = closures.find(c => (c.dateISO === targetShiftDate || c.dateFrom === targetShiftDate) && (c.userShift === userShift || userShift === 'كافة المستخدمين'));

            const repData = window.dailyReportData || {};
            const payload = {
                userShift: userShift,
                expected: expected,
                actual: actual,
                diff: diff,
                absDiff: absDiff,
                state: state,
                repData: repData,
                existingToday: existingToday,
                todayISO: targetShiftDate,
                todayStr: targetShiftDate === new Date().toLocaleDateString('en-CA') ? new Date().toLocaleDateString('ar-EG') : targetShiftDate
            };

            // فتح نافذة تأكيد تطبيق بيان الشيك الحديثة بدلاً من نوافذ المتصفح الكلاسيكية
            window.showBayanShiftCloseConfirmModal(payload);
        };

        // --- نافذة تأكيد تقفيل الوردية الحديثة الشيك (Bayan Shift Close Confirmation Modal) ---
        window.showBayanShiftCloseConfirmModal = function(payload) {
            let existing = document.getElementById('bayanShiftCloseModal');
            if (existing) existing.remove();

            const { userShift, expected, actual, diff, absDiff, state, existingToday, todayStr } = payload;

            let statusCardHtml = '';
            if (absDiff < 0.01) {
                statusCardHtml = `
                    <div style="background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.5rem;">✅</span>
                            <div>
                                <div style="font-weight: 900; color: #065f46; font-size: 1rem;">الدرج مطابق تماماً بالقرش</div>
                                <div style="font-size: 0.8rem; color: #047857;">العد الفعلي يتطابق 100% مع صافي حركة اليوم (بدون أي عجز أو زيادة).</div>
                            </div>
                        </div>
                        <span style="font-weight: 900; font-size: 1.25rem; color: #059669; font-family: 'Consolas', monospace;">0.00 ج.م</span>
                    </div>
                `;
            } else if (diff < 0) {
                statusCardHtml = `
                    <div style="background: #fef2f2; border: 1.5px solid #ef4444; border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.5rem;">⚠️</span>
                            <div>
                                <div style="font-weight: 900; color: #991b1b; font-size: 1rem;">يوجد عجز نقدي بالدرج (نقص)</div>
                                <div style="font-size: 0.8rem; color: #b91c1c;">المبلغ الفعلي أقل من المطلوب (قد توجد مصاريف أو نثريات لم تُسجل بالسندات).</div>
                            </div>
                        </div>
                        <span style="font-weight: 900; font-size: 1.25rem; color: #dc2626; font-family: 'Consolas', monospace;">-${absDiff.toFixed(2)} ج.م</span>
                    </div>
                `;
            } else {
                statusCardHtml = `
                    <div style="background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.5rem;">🟢</span>
                            <div>
                                <div style="font-weight: 900; color: #1e40af; font-size: 1rem;">توجد زيادة نقدية بالدرج (فائض)</div>
                                <div style="font-size: 0.8rem; color: #2563eb;">فائض نقدي بالدرج أكبر من صافي حركة اليوم المطلوب.</div>
                            </div>
                        </div>
                        <span style="font-weight: 900; font-size: 1.25rem; color: #2563eb; font-family: 'Consolas', monospace;">+${absDiff.toFixed(2)} ج.م</span>
                    </div>
                `;
            }

            let existingAlertHtml = '';
            if (existingToday) {
                existingAlertHtml = `
                    <div style="background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px;">
                        <div style="font-weight: 900; color: #92400e; font-size: 0.92rem; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                            <span>💡</span> تنبيه: يوجد محضر تقفيل مسجل بالفعل لهذا اليوم (${existingToday.id})
                        </div>
                        <div style="font-size: 0.84rem; color: #78350f; margin-bottom: 8px;">
                            العد السابق المسجل: <b>${(existingToday.actualCash || 0).toFixed(2)} ج.م</b> &nbsp;|&nbsp; العد الفعلي الجديد الحالي: <b>${actual.toFixed(2)} ج.م</b>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.86rem; font-weight: 800; color: #92400e;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="radio" name="bayanCloseActionType" value="update" checked style="accent-color: #f59e0b; cursor: pointer;">
                                <span>تحديث وتعديل المحضر القائم بالعد الجديد الحالي</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="radio" name="bayanCloseActionType" value="new" style="accent-color: #f59e0b; cursor: pointer;">
                                <span>إصدار محضر تقفيل إضافي جديد منفصل</span>
                            </label>
                        </div>
                    </div>
                `;
            }

            const modal = document.createElement('div');
            modal.id = 'bayanShiftCloseModal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.7); backdrop-filter:blur(6px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box; direction:rtl; font-family:"Segoe UI", Tahoma, sans-serif;';

            window._bayanCurrentShiftClosePayload = payload;

            modal.innerHTML = `
                <div style="background:#ffffff; color:#0f172a; border-radius:20px; padding:24px 28px; width:100%; max-width:560px; box-shadow:0 25px 60px -15px rgba(0,0,0,0.35); position:relative; animation:modalPopIn 0.25s ease; border:1.5px solid #e2e8f0; max-height:92vh; overflow-y:auto; box-sizing:border-box;">
                    
                    <!-- ترويسة أنيقة -->
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f1f5f9; padding-bottom:12px; margin-bottom:16px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, #059669, #10b981); color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.3rem; box-shadow:0 4px 12px rgba(16,185,129,0.35);">
                                🔒
                            </div>
                            <div>
                                <h3 style="margin:0; font-size:1.25rem; font-weight:900; color:#0f172a;">اعتماد وتقفيل الوردية والدرج</h3>
                                <span style="font-size:0.8rem; color:#64748b; font-weight:600;">محضر رسمي لإغلاق حسابات الكاشير ومطابقة نقدية الدرج</span>
                            </div>
                        </div>
                        <button type="button" onclick="document.getElementById('bayanShiftCloseModal').remove()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#64748b; width:34px; height:34px; border-radius:8px; font-size:1.1rem; font-weight:900; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s;" title="إغلاق النافذة">
                            ✕
                        </button>
                    </div>

                    <!-- بطاقة معلومات الوردية -->
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:0.88rem; font-weight:800;">
                        <span style="color:#334155; display:flex; align-items:center; gap:6px;">
                            <span>📅</span> التاريخ: <b style="color:#0f172a;">${todayStr}</b>
                        </span>
                        <span style="color:#1d4ed8; background:#eff6ff; padding:3px 10px; border-radius:8px; border:1px solid #bfdbfe;">
                            👤 الوردية: <b>${userShift}</b>
                        </span>
                    </div>

                    ${existingAlertHtml}

                    <!-- شبكة مقارنة المبالغ المالية -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                        <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:14px; padding:12px 14px; text-align:center;">
                            <div style="font-size:0.82rem; font-weight:800; color:#64748b; margin-bottom:4px;">💰 المطلوب بالدرج (دفترياً)</div>
                            <div style="font-size:1.35rem; font-weight:900; color:#0f172a; font-family:'Consolas', monospace;">${expected.toFixed(2)} <span style="font-size:0.85rem;">ج.م</span></div>
                        </div>
                        <div style="background:#fffbeb; border:2px solid #f59e0b; border-radius:14px; padding:12px 14px; text-align:center; box-shadow:0 4px 12px rgba(245,158,11,0.15);">
                            <div style="font-size:0.82rem; font-weight:900; color:#92400e; margin-bottom:4px;">💵 النقدية الفعلية (العد)</div>
                            <div style="font-size:1.45rem; font-weight:900; color:#78350f; font-family:'Consolas', monospace;">${actual.toFixed(2)} <span style="font-size:0.85rem;">ج.م</span></div>
                        </div>
                    </div>

                    <!-- بطاقة حالة المطابقة -->
                    <div style="margin-bottom:14px;">
                        ${statusCardHtml}
                    </div>

                    <!-- حقل ملاحظات إضافية -->
                    <div style="margin-bottom:14px;">
                        <label style="display:block; font-size:0.84rem; font-weight:800; color:#475569; margin-bottom:4px;">📝 ملاحظات التقفيل (اختياري):</label>
                        <input type="text" id="bayanCloseModalNotes" value="${state.notes || ''}" placeholder="أي ملاحظات تخص الوردية أو العجز أو الزيادة..." style="width:100%; height:38px; border:1.5px solid #cbd5e1; border-radius:8px; padding:0 10px; font-size:0.88rem; outline:none; box-sizing:border-box; font-family:inherit;">
                    </div>

                    <!-- خيار الطباعة الفورية -->
                    <div style="background:#f1f5f9; border-radius:10px; padding:8px 12px; margin-bottom:18px; display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="bayanClosePrintReportCheck" checked style="width:18px; height:18px; accent-color:#059669; cursor:pointer;">
                        <label for="bayanClosePrintReportCheck" style="font-size:0.88rem; font-weight:800; color:#1e293b; cursor:pointer; user-select:none;">
                            🖨️ طباعة محضر تقفيل الوردية (Z-Report) فور الحفظ مباشرة
                        </label>
                    </div>

                    <!-- أزرار الإجراءات -->
                    <div style="display:flex; gap:10px;">
                        <button type="button" id="btnConfirmBayanClose" onclick="window.confirmExecuteDrawerClosing()" style="flex:1.6; height:44px; background:linear-gradient(135deg, #059669, #10b981); color:#ffffff; border:none; border-radius:10px; font-weight:900; font-size:0.95rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 4px 14px rgba(16,185,129,0.35); transition:0.2s;">
                            <span>✅</span> تأكيد وحفظ تقفيل الوردية
                        </button>
                        <button type="button" onclick="document.getElementById('bayanShiftCloseModal').remove()" style="flex:1; height:44px; background:#f1f5f9; color:#475569; border:1.5px solid #cbd5e1; border-radius:10px; font-weight:800; font-size:0.9rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; transition:0.2s;">
                            <span>❌</span> تراجع / إلغاء
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        };

        // --- تنفيذ الحفظ والتقفيل وتفريغ المربع فوراً ---
        window.confirmExecuteDrawerClosing = async function() {
            const payload = window._bayanCurrentShiftClosePayload;
            if (!payload) return;

            const notesInp = document.getElementById('bayanCloseModalNotes');
            const newNotes = notesInp ? notesInp.value.trim() : (payload.state?.notes || '');
            const printCheck = document.getElementById('bayanClosePrintReportCheck');
            const shouldPrint = printCheck ? printCheck.checked : true;

            const actionRadio = document.querySelector('input[name="bayanCloseActionType"]:checked');
            const actionType = actionRadio ? actionRadio.value : (payload.existingToday ? 'update' : 'new');

            const closures = typeof window.getSavedDrawerClosures === 'function' 
                ? window.getSavedDrawerClosures() 
                : [];

            const state = payload.state || {};
            const repData = payload.repData || {};
            const expected = payload.expected;
            const actual = payload.actual;
            const diff = payload.diff;
            const absDiff = payload.absDiff;
            const userShift = payload.userShift;

            let finalRecord = null;

            if (payload.existingToday && actionType === 'update') {
                const targetIdx = closures.findIndex(c => c.id === payload.existingToday.id);
                const existing = targetIdx !== -1 ? closures[targetIdx] : payload.existingToday;

                existing.actualCash = actual;
                existing.expectedCash = expected;
                existing.difference = diff;
                existing.status = absDiff < 0.01 ? 'balanced' : (diff < 0 ? 'deficit' : 'surplus');
                existing.notes = newNotes;
                if (state.denominations) existing.denominations = state.denominations;
                existing.isEdited = true;
                existing.editedAt = new Date().toISOString();
                existing.editedBy = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'المدير';

                existing.includePrevBalance = state.includePrevBalance || false;
                existing.salesCount = repData.salesCount || 0;
                existing.totalSales = repData.totalSales || 0;
                existing.totalSalesCash = repData.effectiveCashSales !== undefined ? repData.effectiveCashSales : (repData.totalSalesCash || 0);
                existing.totalSalesNonCash = repData.totalSalesNonCash || 0;
                existing.totalSalesCredit = repData.totalSalesCredit || 0;
                existing.effectiveReceipts = repData.effectiveReceipts !== undefined ? repData.effectiveReceipts : (repData.totalReceiptsCash || 0);
                existing.effectivePurReturns = repData.effectivePurReturns !== undefined ? repData.effectivePurReturns : (repData.purchasesReturnCash || 0);
                existing.effectiveDisbursements = repData.effectiveDisbursements !== undefined ? repData.effectiveDisbursements : (repData.totalExpensesCash || 0);
                existing.effectivePurchases = repData.effectivePurchases !== undefined ? repData.effectivePurchases : (repData.totalPurchasesCash || 0);
                existing.effectiveSalesReturns = repData.effectiveSalesReturns !== undefined ? repData.effectiveSalesReturns : (repData.salesReturnCash || 0);
                existing.totalCashIn = repData.totalCashIn || 0;
                existing.totalCashOut = repData.totalCashOut || 0;

                if (targetIdx !== -1) {
                    closures[targetIdx] = existing;
                } else {
                    closures.unshift(existing);
                }
                finalRecord = existing;
            } else {
                const targetShiftDate = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
                const targetShiftDateTo = document.getElementById('reportDateTo')?.value || targetShiftDate;
                finalRecord = {
                    id: 'CLOSE_' + Date.now(),
                    timestamp: new Date().toISOString(),
                    dateStr: targetShiftDate === new Date().toLocaleDateString('en-CA') ? new Date().toLocaleDateString('ar-EG') : targetShiftDate,
                    timeStr: new Date().toLocaleTimeString('ar-EG'),
                    dateISO: targetShiftDate,
                    closedBy: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'المدير',
                    userShift: userShift,
                    dateFrom: targetShiftDate,
                    dateTo: targetShiftDateTo,
                    includePrevBalance: state.includePrevBalance || false,
                    previousBalance: state.previousBalance || 0,
                    netCashMovement: state.netCashMovement || 0,
                    expectedCash: expected,
                    actualCash: actual,
                    difference: diff,
                    status: absDiff < 0.01 ? 'balanced' : (diff < 0 ? 'deficit' : 'surplus'),
                    notes: newNotes,
                    denominations: state.denominations || null,
                    paymentMethodsSummary: repData.paymentMethodsSummary || {},
                    salesCount: repData.salesCount || 0,
                    totalSales: repData.totalSales || 0,
                    totalSalesCash: repData.effectiveCashSales !== undefined ? repData.effectiveCashSales : (repData.totalSalesCash || 0),
                    totalSalesNonCash: repData.totalSalesNonCash || 0,
                    totalSalesCredit: repData.totalSalesCredit || 0,
                    effectiveReceipts: repData.effectiveReceipts !== undefined ? repData.effectiveReceipts : (repData.totalReceiptsCash || 0),
                    effectivePurReturns: repData.effectivePurReturns !== undefined ? repData.effectivePurReturns : (repData.purchasesReturnCash || 0),
                    effectiveDisbursements: repData.effectiveDisbursements !== undefined ? repData.effectiveDisbursements : (repData.totalExpensesCash || 0),
                    effectivePurchases: repData.effectivePurchases !== undefined ? repData.effectivePurchases : (repData.totalPurchasesCash || 0),
                    effectiveSalesReturns: repData.effectiveSalesReturns !== undefined ? repData.effectiveSalesReturns : (repData.salesReturnCash || 0),
                    totalCashIn: repData.totalCashIn || 0,
                    totalCashOut: repData.totalCashOut || 0
                };
                closures.unshift(finalRecord);
            }

            await window.saveDrawerClosuresToDb(closures);

            // 1. إغلاق مودال التأكيد
            const modal = document.getElementById('bayanShiftCloseModal');
            if (modal) modal.remove();

            // 2. تثبيت والاحتفاظ بالعد الفعلي بالمربع وتحديث بطاقة المطابقة فوراً دون مسحها
            const actualInput = document.getElementById('drawerActualCashInput');
            if (actualInput) actualInput.value = actual.toFixed(2);
            const modalInput = document.getElementById('modalDrawerActualCashInput');
            if (modalInput) modalInput.value = actual.toFixed(2);

            window.currentDrawerClosingState.actualCash = actual;
            window.currentDrawerClosingState.difference = diff;
            window.currentDrawerClosingState.status = absDiff < 0.01 ? 'balanced' : (diff < 0 ? 'deficit' : 'surplus');
            if (newNotes) window.currentDrawerClosingState.notes = newNotes;
            if (state.denominations) window.currentDrawerClosingState.denominations = state.denominations;
            delete window.currentDrawerClosingState.userExplicitlyCleared;

            window.handleDrawerActualCashInput(actual.toFixed(2));

            // تحديث بادج صف الإجمالي بالجدول إن كان معروضاً
            const opsBadge = document.getElementById('opsRowAuditStatusBadge');
            if (opsBadge) {
                if (absDiff < 0.01) {
                    opsBadge.innerHTML = '✅ متطابق تماماً';
                    opsBadge.style.background = '#ecfdf5';
                    opsBadge.style.color = '#059669';
                    opsBadge.style.borderColor = '#10b981';
                } else if (diff < 0) {
                    opsBadge.innerHTML = `⚠️ عجز: -${absDiff.toFixed(2)} ج.م`;
                    opsBadge.style.background = '#fee2e2';
                    opsBadge.style.color = '#dc2626';
                    opsBadge.style.borderColor = '#ef4444';
                } else {
                    opsBadge.innerHTML = `💡 زيادة: +${absDiff.toFixed(2)} ج.م`;
                    opsBadge.style.background = '#eff6ff';
                    opsBadge.style.color = '#2563eb';
                    opsBadge.style.borderColor = '#3b82f6';
                }
            }

            if (typeof showToast === 'function') {
                showToast("🎉 تم اعتماد وتقفيل الوردية والدرج وحفظ المحضر بنجاح!", "success");
            }

            // 3. طباعة فورية إن تم اختيارها بدون أي confirm قديم
            if (shouldPrint) {
                setTimeout(() => {
                    window.printShiftCloseReport(finalRecord);
                }, 200);
            }
        };

        // --- طباعة محضر تقفيل الوردية والدرج (Z-Report) بنفس بنود نافذة "عرض التفاصيل" وبحبر أسود ثقيل ---
        window.printShiftCloseReport = function(customRecord) {
            const repData = window.dailyReportData || {};
            const state = window.currentDrawerClosingState || {};
            const inpEl = document.getElementById('drawerActualCashInput');
            const liveActual = (inpEl && inpEl.value.trim() !== '' && !isNaN(parseFloat(inpEl.value))) ? parseFloat(inpEl.value) : null;

            const rec = customRecord || {
                id: 'CLOSE_' + Date.now(),
                dateStr: new Date().toLocaleDateString('ar-EG'),
                timeStr: new Date().toLocaleTimeString('ar-EG'),
                closedBy: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'المدير',
                userShift: (state.selectedUser && state.selectedUser !== 'all') ? state.selectedUser : ((typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'كافة المستخدمين'),
                dateFrom: document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA'),
                dateTo: document.getElementById('reportDateTo')?.value || new Date().toLocaleDateString('en-CA'),
                includePrevBalance: state.includePrevBalance || false,
                previousBalance: state.previousBalance || 0,
                netCashMovement: state.netCashMovement || 0,
                expectedCash: state.expectedCash !== undefined ? state.expectedCash : (state.includePrevBalance ? state.finalCashBalance : state.netCashMovement),
                actualCash: (liveActual !== null) ? liveActual : (state.actualCash !== null ? state.actualCash : (state.expectedCash !== undefined ? state.expectedCash : state.netCashMovement)),
                difference: (liveActual !== null) ? (liveActual - (state.expectedCash !== undefined ? state.expectedCash : state.netCashMovement)) : (state.difference || 0),
                status: state.status || 'balanced',
                notes: state.notes || '',
                denominations: state.denominations || null,
                paymentMethodsSummary: repData.paymentMethodsSummary || {},
                salesCount: repData.salesCount || 0,
                totalSales: repData.totalSales || 0,
                totalSalesCash: repData.effectiveCashSales !== undefined ? repData.effectiveCashSales : (repData.totalSalesCash || 0),
                totalSalesNonCash: repData.totalSalesNonCash || 0,
                totalSalesCredit: repData.totalSalesCredit || 0,
                effectiveReceipts: repData.effectiveReceipts !== undefined ? repData.effectiveReceipts : (repData.totalReceiptsCash || 0),
                effectivePurReturns: repData.effectivePurReturns !== undefined ? repData.effectivePurReturns : (repData.purchasesReturnCash || 0),
                effectiveDisbursements: repData.effectiveDisbursements !== undefined ? repData.effectiveDisbursements : (repData.totalExpensesCash || 0),
                effectivePurchases: repData.effectivePurchases !== undefined ? repData.effectivePurchases : (repData.totalPurchasesCash || 0),
                effectiveSalesReturns: repData.effectiveSalesReturns !== undefined ? repData.effectiveSalesReturns : (repData.salesReturnCash || 0)
            };

            const shopName = (typeof getStore === 'function' ? getStore('bayan_business_name') : null) || document.getElementById('shopName')?.value || 'بيان POS للملابس والأحذية';
            const shopPhone = document.getElementById('shopPhone1')?.value || '';

            // استخراج تفاصيل احتساب نقدية اليوم بيومه بالضبط كما في نافذة "عرض التفاصيل"
            const cSales = Number(rec.totalSalesCash !== undefined ? rec.totalSalesCash : (repData.effectiveCashSales || repData.totalSalesCash || 0));
            const vfSales = Number(repData.vodafoneSales ? (repData.vodafoneSales.cash + repData.vodafoneSales.nonCash) : (repData.vodafoneCashTotal || 0));
            const cReceipts = Number(rec.effectiveReceipts !== undefined ? rec.effectiveReceipts : (repData.effectiveReceipts || repData.totalReceiptsCash || 0));
            const cPurRet = Number(rec.effectivePurReturns !== undefined ? rec.effectivePurReturns : (repData.effectivePurReturns || repData.purchasesReturnCash || 0));
            const cSalesRet = Number(rec.effectiveSalesReturns !== undefined ? rec.effectiveSalesReturns : (repData.effectiveSalesReturns || repData.salesReturnCash || 0));
            const cPurchases = Number(rec.effectivePurchases !== undefined ? rec.effectivePurchases : (repData.effectivePurchases || repData.totalPurchasesCash || 0));
            const cDisbursements = Number(rec.effectiveDisbursements !== undefined ? rec.effectiveDisbursements : (repData.effectiveDisbursements || repData.totalExpensesCash || 0));

            const totalCashIn = cSales + cReceipts + cPurRet;
            const totalCashOut = cSalesRet + cPurchases + cDisbursements;
            const netCashDay = totalCashIn - totalCashOut;

            const isIncludePrev = !!rec.includePrevBalance;
            const prevBal = Number(rec.previousBalance || 0);
            const expected = Number(rec.expectedCash !== undefined ? rec.expectedCash : (isIncludePrev ? (prevBal + netCashDay) : netCashDay));

            let actual = expected;
            if (rec.actualCash !== undefined && rec.actualCash !== null && !isNaN(parseFloat(rec.actualCash))) {
                actual = parseFloat(rec.actualCash);
            } else if (liveActual !== null) {
                actual = liveActual;
            }

            const diff = (customRecord && customRecord.difference !== undefined && customRecord.difference !== null) 
                ? Number(customRecord.difference) 
                : (actual - expected);
            const absDiff = Math.abs(diff);

            // 1. بناء صفوف بنود احتساب نقدية الدرج المطابقة تماماً لنافذة عرض التفاصيل
            let breakdownRows = '';

            // 1- مبيعات نقدية (كاش الدرج)
            breakdownRows += `
                <tr style="border-bottom: 1px solid #000;">
                    <td style="padding: 4px 2px; font-weight: 800;">(+) مبيعات نقدية (درج الكاش):</td>
                    <td style="padding: 4px 2px; text-align: left; font-weight: 900; font-size: 13.5px;">+${cSales.toFixed(2)} ج.م</td>
                </tr>
            `;

            // 2- بطاقة فودافون كاش (السهم المتصل المتطابق مع نافذة التفاصيل)
            if (vfSales > 0) {
                breakdownRows += `
                <tr style="background: #f4f4f4;">
                    <td style="padding: 3px 2px; font-weight: 800;">(+) مبيعات فودافون كاش (محفظة):</td>
                    <td style="padding: 3px 2px; text-align: left; font-weight: 900;">+${vfSales.toFixed(2)} ج.م</td>
                </tr>
                <tr style="background: #f4f4f4;">
                    <td colspan="2" style="padding: 2px 4px; font-size: 10.5px; font-weight: 800; border-top: 1px dashed #999; border-bottom: 1px dashed #999;">
                        ⮁ سهم متصل: مبيعات مسجلة تقابلها تحصيلات الهاتف بالمحفظة (الأثر على كاش الدرج = 0.00 ج.م)
                    </td>
                </tr>
                <tr style="background: #f4f4f4; border-bottom: 1px solid #000;">
                    <td style="padding: 3px 2px; font-weight: 800;">(-) تحصيل فودافون كاش (بالمحفظة لا الدرج):</td>
                    <td style="padding: 3px 2px; text-align: left; font-weight: 900;">-${vfSales.toFixed(2)} ج.م</td>
                </tr>
                `;
            }

            // 3- سندات قبض نقدية
            if (cReceipts > 0) {
                breakdownRows += `
                <tr style="border-bottom: 1px solid #000;">
                    <td style="padding: 4px 2px; font-weight: 800;">(+) سندات قبض نقدية (إيرادات وتحصيلات بالدرج):</td>
                    <td style="padding: 4px 2px; text-align: left; font-weight: 900;">+${cReceipts.toFixed(2)} ج.م</td>
                </tr>`;
            }

            // 4- مرتجع مشتريات نقدي
            if (cPurRet > 0) {
                breakdownRows += `
                <tr style="border-bottom: 1px solid #000;">
                    <td style="padding: 4px 2px; font-weight: 800;">(+) مرتجع مشتريات نقدي (استرداد كاش دخل الدرج):</td>
                    <td style="padding: 4px 2px; text-align: left; font-weight: 900;">+${cPurRet.toFixed(2)} ج.م</td>
                </tr>`;
            }

            // 5- مرتجع مبيعات نقدي
            if (cSalesRet > 0) {
                breakdownRows += `
                <tr style="border-bottom: 1px solid #000;">
                    <td style="padding: 4px 2px; font-weight: 800;">(-) مرتجع مبيعات نقدي (خرج من الدرج للعميل):</td>
                    <td style="padding: 4px 2px; text-align: left; font-weight: 900;">-${cSalesRet.toFixed(2)} ج.م</td>
                </tr>`;
            }

            // 6- مشتريات نقدية
            if (cPurchases > 0) {
                breakdownRows += `
                <tr style="border-bottom: 1px solid #000;">
                    <td style="padding: 4px 2px; font-weight: 800;">(-) مشتريات نقدية (مدفوعات كاش من الدرج):</td>
                    <td style="padding: 4px 2px; text-align: left; font-weight: 900;">-${cPurchases.toFixed(2)} ج.م</td>
                </tr>`;
            }

            // 7- سندات صرف نقدية
            if (cDisbursements > 0) {
                breakdownRows += `
                <tr style="border-bottom: 1px solid #000;">
                    <td style="padding: 4px 2px; font-weight: 800;">(-) سندات صرف نقدية (مصروفات ومدفوعات):</td>
                    <td style="padding: 4px 2px; text-align: left; font-weight: 900;">-${cDisbursements.toFixed(2)} ج.م</td>
                </tr>`;
            }

            // 2. بطاقة نتيجة المطابقة المباشرة والتسوية
            let resultBoxHtml = '';
            if (absDiff < 0.01) {
                resultBoxHtml = `
                    <div style="border: 2.5px solid #000000; padding: 8px 6px; text-align: center; margin: 10px 0; border-radius: 5px;">
                        <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.3px;">✅ النتيجة: الدرج مطابق تماماً بالقرش</div>
                        <div style="font-size: 11px; font-weight: 900; margin-top: 3px;">(العد الفعلي يتطابق 100% مع صافي حركة اليوم المطلوب - فارق 0.00 ج.م)</div>
                    </div>
                `;
            } else if (diff < 0) {
                resultBoxHtml = `
                    <div style="border: 2.5px solid #000000; background: #000000; color: #ffffff !important; padding: 8px 6px; text-align: center; margin: 10px 0; border-radius: 5px;">
                        <div style="font-size: 14.5px; font-weight: 900; color: #ffffff !important;">⚠️ فارق / عجز بالدرج (مصروفات/شنط لم تُسجل):</div>
                        <div style="font-size: 18.5px; font-weight: 900; color: #ffffff !important; margin: 3px 0;">-${absDiff.toFixed(2)} ج.م</div>
                        <div style="font-size: 10.5px; font-weight: 800; color: #ffffff !important;">(المبلغ الفعلي أقل من صافي مبيعات اليوم المطلوب)</div>
                    </div>
                `;
            } else {
                resultBoxHtml = `
                    <div style="border: 2.5px solid #000000; padding: 8px 6px; text-align: center; margin: 10px 0; border-radius: 5px;">
                        <div style="font-size: 14.5px; font-weight: 900;">📈 توجد زيادة نقدية بالدرج (فائض):</div>
                        <div style="font-size: 18.5px; font-weight: 900; margin: 3px 0;">+${absDiff.toFixed(2)} ج.م</div>
                        <div style="font-size: 10.5px; font-weight: 900;">(فائض نقدي بالدرج أكبر من صافي حركة اليوم المطلوب)</div>
                    </div>
                `;
            }

            // 3. فئات النقدية إن وجدت
            let denomsSection = '';
            if (rec.denominations && typeof rec.denominations === 'object') {
                const activeDenomRows = Object.entries(rec.denominations)
                    .filter(([val, cnt]) => parseFloat(cnt) > 0)
                    .map(([val, cnt]) => {
                        const sub = parseFloat(val) * parseFloat(cnt);
                        return `<tr><td style="padding: 2px 4px; border: 1px solid #000; text-align: right;">فئة ${val} ج.م</td><td style="padding: 2px 4px; border: 1px solid #000; text-align: center; font-weight: 900;">${cnt}</td><td style="padding: 2px 4px; border: 1px solid #000; text-align: left; font-weight: 900;">${sub.toFixed(2)}</td></tr>`;
                    }).join('');

                if (activeDenomRows) {
                    denomsSection = `
                        <div style="margin-top: 8px;">
                            <div style="font-weight: 900; font-size: 12px; margin-bottom: 3px; border-bottom: 1.5px solid #000; padding-bottom: 2px;">🧮 تفصيل الفئات النقدية المحصية:</div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; border: 1px solid #000;">
                                <thead><tr style="border-bottom: 1.5px solid #000; background: #eee;"><th style="padding: 2px 4px; text-align: right;">الفئة</th><th style="padding: 2px 4px; text-align: center;">العدد</th><th style="padding: 2px 4px; text-align: left;">القيمة</th></tr></thead>
                                <tbody>${activeDenomRows}</tbody>
                            </table>
                        </div>
                    `;
                }
            }

            // 4. المحافظ والفيزا المستقلة عن الدرج
            let elecWalletsSection = '';
            const pmSummary = rec.paymentMethodsSummary || repData.paymentMethodsSummary || {};
            const activeWallets = Object.entries(pmSummary).filter(([k, v]) => {
                const lower = k.toLowerCase();
                if (lower.includes('نقد') || lower.includes('كاش')) return false;
                const net = (v.salesTotal || 0) + (v.receiptsTotal || 0) - (v.disbursementsTotal || 0) - (v.purchasesTotal || 0);
                return Math.abs(net) > 0.001 || (v.salesTotal || 0) > 0;
            });

            if (activeWallets.length > 0) {
                const wRows = activeWallets.map(([name, data]) => {
                    const net = (data.salesTotal || 0) + (data.receiptsTotal || 0) - (data.disbursementsTotal || 0) - (data.purchasesTotal || 0);
                    return `<tr><td style="padding: 3px 2px; border-bottom: 1px dashed #000;">📱 ${name}:</td><td style="padding: 3px 2px; border-bottom: 1px dashed #000; text-align: left; font-weight: 900;">${net.toFixed(2)} ج.م</td></tr>`;
                }).join('');

                elecWalletsSection = `
                    <div style="margin-top: 8px;">
                        <div style="font-weight: 900; font-size: 12px; margin-bottom: 3px; border-bottom: 1.5px solid #000; padding-bottom: 2px;">💳 صافي المحافظ والفيزا (خارج الدرج الورقي):</div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
                            <tbody>${wRows}</tbody>
                        </table>
                    </div>
                `;
            }

            const printHtml = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <title>محضر تقفيل وردية وجرد الدرج (Z-Report)</title>
                    <style>
                        @page { margin: 0; size: auto; }
                        body {
                            margin: 0 auto;
                            padding: 6px 8px;
                            width: 76mm;
                            max-width: 80mm;
                            font-family: 'Arial', 'Segoe UI', Tahoma, sans-serif;
                            direction: rtl;
                            text-align: right;
                            color: #000000 !important;
                            background: #ffffff !important;
                            font-size: 13px;
                            line-height: 1.35;
                            font-weight: 800;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        * {
                            color: #000000 !important;
                            box-sizing: border-box;
                            font-family: inherit;
                        }
                        table { width: 100%; border-collapse: collapse; margin: 3px 0; }
                        td, th { padding: 3px 1px; color: #000000 !important; font-size: 12.5px; }
                        .dashed-line { border-bottom: 1.5px dashed #000000 !important; margin: 5px 0; }
                        .solid-line { border-bottom: 2px solid #000000 !important; margin: 6px 0; }
                        .double-line { border-bottom: 3.5px double #000000 !important; margin: 7px 0; }
                    </style>
                </head>
                <body>
                    <!-- ترويسة التقرير -->
                    <div style="text-align: center;">
                        <h2 style="margin: 0; font-size: 19px; font-weight: 900; letter-spacing: -0.3px;">${shopName}</h2>
                        ${shopPhone ? `<div style="font-size: 12px; font-weight: 900; margin-top: 2px;">هاتف: ${shopPhone}</div>` : ''}
                        
                        <div style="margin: 6px 0; background: #000000; color: #ffffff !important; padding: 5px 0; font-size: 14px; font-weight: 900; border-radius: 4px; letter-spacing: 0.3px;">
                            محضر تقفيل وردية وجرد خزينة (Z-Report)
                        </div>
                        
                        <div style="font-size: 11.5px; font-weight: 900;">
                            رقم المحضر: ${rec.id || '---'}
                        </div>
                        
                        ${rec.isEdited ? `
                        <div style="display: inline-block; border: 1.5px solid #000; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 900; margin-top: 3px;">
                            ✏️ محضر مُعدل (آخر تحديث: ${rec.editedAt ? new Date(rec.editedAt).toLocaleTimeString('ar-EG') : ''})
                        </div>` : ''}
                    </div>

                    <div class="dashed-line"></div>

                    <!-- بيانات الوردية والمسؤول (اليوم بيومه) -->
                    <div style="font-size: 12.5px; line-height: 1.6; font-weight: 800;">
                        <div><b>التاريخ والوقت:</b> ${rec.dateStr} - ${rec.timeStr}</div>
                        <div><b>فترة التقرير:</b> ${rec.dateFrom === rec.dateTo ? `اليوم بيومه (${rec.dateFrom})` : `من ${rec.dateFrom} إلى ${rec.dateTo}`}</div>
                        <div><b>المستخدم / الوردية:</b> <span style="font-weight: 900;">${rec.userShift}</span></div>
                        <div><b>المسؤول المعتمد:</b> <span style="font-weight: 900;">${rec.closedBy}</span></div>
                    </div>

                    <div class="solid-line"></div>

                    <!-- تفاصيل احتساب صافي اليومية والدرج (المطابقة لنافذة عرض التفاصيل) -->
                    <div style="background: #000000; color: #ffffff !important; padding: 4px; font-size: 13px; font-weight: 900; text-align: center; margin: 8px 0 4px 0; border-radius: 4px;">
                        📋 تفاصيل احتساب صافي اليومية والدرج
                    </div>

                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <tbody>
                            ${breakdownRows}
                        </tbody>
                    </table>

                    <div class="dashed-line"></div>

                    <!-- بطاقة صافي المطلوب والعد الفعلي -->
                    <table style="font-size: 13px; font-weight: 900; width: 100%;">
                        ${isIncludePrev ? `
                        <tr style="font-size: 12px;">
                            <td style="padding: 2px 0;">⏺️ رصيد سابق تراكمي (افتتاحي):</td>
                            <td style="text-align: left;">${prevBal.toFixed(2)} ج.م</td>
                        </tr>
                        <tr style="border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: 14px; background: #eee;">
                            <td style="padding: 5px 0;">💰 الرصيد المطلوب بالدرج (دفترياً):</td>
                            <td style="text-align: left; font-size: 14.5px;">${expected.toFixed(2)} ج.م</td>
                        </tr>
                        ` : `
                        <tr style="border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: 14px; background: #eee;">
                            <td style="padding: 5px 0;">💰 صافي المطلوب بالدرج (اليوم بيومه):</td>
                            <td style="text-align: left; font-size: 14.5px;">${expected.toFixed(2)} ج.م</td>
                        </tr>
                        `}

                        <tr style="border-bottom: 2.5px solid #000; font-size: 14.5px;">
                            <td style="padding: 6px 0;">💵 النقدية الفعلية بالدرج (العد):</td>
                            <td style="text-align: left; font-size: 15.5px;">${actual.toFixed(2)} ج.م</td>
                        </tr>
                    </table>

                    <!-- نتيجة الجرد الصريحة والمطابقة المباشرة والتسوية -->
                    ${resultBoxHtml}

                    <!-- فئات النقدية إن وجدت -->
                    ${denomsSection}

                    <!-- المحافظ الإلكترونية والفيزا إن وجدت -->
                    ${elecWalletsSection}

                    <!-- ملاحظات التقفيل إن وجدت -->
                    ${rec.notes ? `
                    <div style="margin-top: 8px; border: 1.5px dashed #000; padding: 6px; font-size: 12px; font-weight: 800;">
                        <b>📝 ملاحظات التقفيل:</b> ${rec.notes}
                    </div>` : ''}

                    <div class="double-line"></div>

                    <!-- التوقيعات -->
                    <div style="display: flex; justify-content: space-between; margin-top: 20px; font-size: 12px; font-weight: 900; text-align: center;">
                        <div style="flex: 1;">
                            توقيع الكاشير المسلّم<br><br>
                            .........................
                        </div>
                        <div style="flex: 1;">
                            توقيع المدير المستلم<br><br>
                            .........................
                        </div>
                    </div>

                    <div style="text-align: center; margin-top: 18px; font-size: 10.5px; border-top: 1px solid #000; padding-top: 4px; font-weight: 800;">
                        نظام بيان POS لإدارة الأنشطة والمبيعات
                    </div>

                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.focus();
                                window.print();
                                setTimeout(function() { window.close(); }, 500);
                            }, 300);
                        };
                    <\/script>
                </body>
                </html>
            `;

            const pw = window.open('', '_blank');
            if (pw) {
                pw.document.write(printHtml);
                pw.document.close();
            }
        };

        // --- ✏️ تعديل العد الفعلي ومحضر تقفيل الوردية ---
        window.openEditDrawerClosingModal = function(closureId) {
            let existing = document.getElementById('editDrawerClosingModal');
            if (existing) existing.remove();

            const closures = typeof window.getSavedDrawerClosures === 'function' 
                ? window.getSavedDrawerClosures() 
                : [];

            let targetRecord = null;
            if (closureId) {
                targetRecord = closures.find(c => c.id === closureId);
            } else {
                const currentReportDate = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
                const currentUserShift = window.currentDrawerClosingState?.selectedUser || 'all';
                // البحث فقط عن محضر تقفيل لنفس اليوم والوردية المحددة بالتقرير (دون جلب محاضر من أيام سابقة)
                targetRecord = closures.find(c => (c.dateISO === currentReportDate || c.dateFrom === currentReportDate) && (c.userShift === currentUserShift || currentUserShift === 'all'));
            }

            if (!targetRecord) {
                const mainInp = document.getElementById('drawerActualCashInput');
                if (mainInp) {
                    mainInp.focus();
                    if (typeof showToast === 'function') {
                        showToast("💡 لا يوجد محضر تقفيل محفوظ لتعديله. يمكنك كتابة وتعديل العد الفعلي مباشرة في المربع الأصفر بالأسفل ثم الضغط على تقفيل الوردية.", "info");
                    }
                }
                return;
            }

            const rec = targetRecord;
            const expected = Number(rec.expectedCash !== undefined ? rec.expectedCash : (rec.netCashMovement || 0));
            const initialActual = Number(rec.actualCash !== undefined ? rec.actualCash : expected);
            const initialDiff = initialActual - expected;
            const initialAbsDiff = Math.abs(initialDiff);

            window.currentDrawerClosingState.editingClosureId = rec.id;
            window.currentDrawerClosingState.editingExpectedCash = expected;
            window.currentDrawerClosingState.tempEditDenominations = rec.denominations || null;

            let initialBadge = '';
            if (initialAbsDiff < 0.01) {
                initialBadge = `
                    <div style="background: #ecfdf5; border: 1.5px solid #10b981; color: #065f46; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.92rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>✅ النتيجة: الدرج مطابق تماماً بالقرش</span>
                        <span style="font-weight: 900; font-size: 1.05rem;">0.00 ج.م</span>
                    </div>`;
            } else if (initialDiff < 0) {
                initialBadge = `
                    <div style="background: #fef2f2; border: 1.5px solid #ef4444; color: #991b1b; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.92rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>⚠️ النتيجة: يوجد عجز نقدي بالدرج</span>
                        <span style="font-weight: 900; font-size: 1.05rem; color: #dc2626;">-${initialAbsDiff.toFixed(2)} ج.م</span>
                    </div>`;
            } else {
                initialBadge = `
                    <div style="background: #eff6ff; border: 1.5px solid #3b82f6; color: #1e40af; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.92rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>📈 النتيجة: توجد زيادة نقدية بالدرج</span>
                        <span style="font-weight: 900; font-size: 1.05rem; color: #2563eb;">+${initialAbsDiff.toFixed(2)} ج.م</span>
                    </div>`;
            }

            const modal = document.createElement('div');
            modal.id = 'editDrawerClosingModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 9999999; display: flex; align-items: center; justify-content: center; padding: 15px; box-sizing: border-box; direction: rtl; font-family: inherit;';

            modal.innerHTML = `
                <div style="background: #ffffff; color: #0f172a; width: 100%; max-width: 520px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); overflow: hidden; border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; max-height: 92vh;">
                    <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 16px 20px; color: white; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">✏️</span>
                            <div>
                                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900;">تعديل العد الفعلي ومحضر تقفيل الدرج</h3>
                                <p style="margin: 2px 0 0 0; font-size: 0.78rem; opacity: 0.9;">تعديل المبلغ الفعلي المحصي وإعادة احتساب العجز والزيادة فوراً</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('editDrawerClosingModal').remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; font-size: 1.1rem; cursor: pointer;">✕</button>
                    </div>

                    <div style="padding: 18px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px;">
                        <!-- بطاقة تفاصيل المحضر -->
                        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; font-size: 0.88rem; display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #64748b; font-weight: 700;">رقم المحضر / التاريخ:</span>
                                <span style="font-weight: 800; color: #1e293b;">${rec.id || '---'} (${rec.dateStr} - ${rec.timeStr || ''})</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #64748b; font-weight: 700;">الوردية / المسؤول:</span>
                                <span style="font-weight: 800; color: #1e3a8a;">${rec.userShift || 'كافة المستخدمين'} (${rec.closedBy || 'المدير'})</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 2px;">
                                <span style="color: #1e293b; font-weight: 900;">💰 المطلوب دفترياً من حركة الدرج:</span>
                                <span style="font-weight: 900; font-size: 1.15rem; color: #1d4ed8;">${expected.toLocaleString('en-US', {minimumFractionDigits: 2})} ج.م</span>
                            </div>
                        </div>

                        <!-- إدخال العد الفعلي الجديد -->
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <label for="editActualCashAmount" style="font-weight: 900; font-size: 0.95rem; color: #78350f;">💵 النقدية الفعلية بعد التعديل (العد الصحيح بالدرج):</label>
                                <button type="button" onclick="openDrawerDenominationsCalculator(window.currentDrawerClosingState.tempEditDenominations, 'editActualCashAmount')"
                                    style="background: #fef3c7; border: 1px solid #fde68a; color: #b45309; border-radius: 6px; padding: 2px 8px; font-size: 0.78rem; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                    <span>🧮</span> حاسبة الفئات
                                </button>
                            </div>
                            <input type="number" id="editActualCashAmount" step="any" min="0" value="${initialActual}"
                                oninput="recalcEditDrawerDiff(${expected})"
                                style="height: 44px; border: 2.5px solid #d97706; border-radius: 10px; font-size: 1.25rem; font-weight: 900; color: #78350f; text-align: center; background: #fffbeb; outline: none; padding: 0 10px;"
                                onfocus="this.select()">
                        </div>

                        <!-- بطاقة نتيجة الفارق الفوري المحدثة -->
                        <div id="editDrawerDiffContainer">
                            ${initialBadge}
                        </div>

                        <!-- سبب التعديل والملاحظات -->
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label for="editDrawerNotes" style="font-weight: 800; font-size: 0.88rem; color: #334155;">📝 سبب التعديل أو ملاحظات إضافية:</label>
                            <textarea id="editDrawerNotes" rows="3" placeholder="اكتب سبب تعديل العد الفعلي هنا (مثال: تم العثور على مبالغ منسية بالدرج، تصحيح خطأ عد، إضافة فكة)..."
                                style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px; font-family: inherit; font-size: 0.9rem; box-sizing: border-box; outline: none;">${rec.notes || ''}</textarea>
                        </div>
                    </div>

                    <div style="padding: 14px 20px; background: #f8fafc; border-top: 1.5px solid #e2e8f0; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; gap: 8px;">
                            <button type="button" onclick="saveEditedDrawerClosure('${rec.id}', false)"
                                style="flex: 1.3; height: 42px; background: linear-gradient(135deg, #059669, #10b981); color: white; border: none; border-radius: 10px; font-weight: 900; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(16,185,129,0.3);">
                                <span>💾</span> حفظ التعديل وتحديث المحضر
                            </button>
                            <button type="button" onclick="saveEditedDrawerClosure('${rec.id}', true)"
                                style="flex: 1.1; height: 42px; background: linear-gradient(135deg, #0284c7, #0369a1); color: white; border: none; border-radius: 10px; font-weight: 900; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <span>🖨️</span> حفظ وطباعة Z-Report
                            </button>
                        </div>
                        <button type="button" onclick="document.getElementById('editDrawerClosingModal').remove()"
                            style="height: 36px; background: #ffffff; color: #64748b; border: 1px solid #cbd5e1; border-radius: 10px; font-weight: 800; font-size: 0.85rem; cursor: pointer;">
                            إلغاء التعديل
                        </button>
                    </div>
                </div>
            `;

            modal.addEventListener('click', function(ev) { if (ev.target === modal) modal.remove(); });
            document.body.appendChild(modal);
            const editInp = document.getElementById('editActualCashAmount');
            if (editInp) editInp.focus();
        };

        window.recalcEditDrawerDiff = function(expectedVal) {
            const inp = document.getElementById('editActualCashAmount');
            const container = document.getElementById('editDrawerDiffContainer');
            if (!container) return;

            const expected = (expectedVal !== undefined) ? Number(expectedVal) : Number(window.currentDrawerClosingState.editingExpectedCash || 0);
            const val = inp ? inp.value.trim() : '';
            if (val === '' || isNaN(parseFloat(val))) {
                container.innerHTML = `<div style="background: #f1f5f9; border: 1.5px dashed #cbd5e1; color: #475569; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.92rem; text-align: center;">يرجى كتابة المبلغ الفعلي لاحتساب الفارق...</div>`;
                return;
            }

            const actual = parseFloat(val) || 0;
            const diff = actual - expected;
            const absDiff = Math.abs(diff);

            if (absDiff < 0.01) {
                container.innerHTML = `
                    <div style="background: #ecfdf5; border: 1.5px solid #10b981; color: #065f46; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.92rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>✅ النتيجة: الدرج مطابق تماماً بالقرش</span>
                        <span style="font-weight: 900; font-size: 1.05rem;">0.00 ج.م</span>
                    </div>
                `;
            } else if (diff < 0) {
                container.innerHTML = `
                    <div style="background: #fef2f2; border: 1.5px solid #ef4444; color: #991b1b; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.92rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>⚠️ النتيجة: يوجد عجز نقدي بالدرج</span>
                        <span style="font-weight: 900; font-size: 1.05rem; color: #dc2626;">-${absDiff.toFixed(2)} ج.م</span>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div style="background: #eff6ff; border: 1.5px solid #3b82f6; color: #1e40af; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.92rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>📈 النتيجة: توجد زيادة نقدية بالدرج</span>
                        <span style="font-weight: 900; font-size: 1.05rem; color: #2563eb;">+${absDiff.toFixed(2)} ج.م</span>
                    </div>
                `;
            }
        };

        window.saveEditedDrawerClosure = async function(closureId, andPrint) {
            const inp = document.getElementById('editActualCashAmount');
            if (!inp || inp.value.trim() === '' || isNaN(parseFloat(inp.value))) {
                if (typeof showToast === 'function') {
                    showToast("⚠️ يرجى كتابة المبلغ الفعلي المحصي بشكل صحيح!", "warning");
                } else {
                    alert("يرجى كتابة المبلغ الفعلي المحصي!");
                }
                if (inp) inp.focus();
                return;
            }

            const newActual = parseFloat(inp.value) || 0;
            const notesEl = document.getElementById('editDrawerNotes');
            const newNotes = notesEl ? notesEl.value.trim() : '';

            const closures = typeof window.getSavedDrawerClosures === 'function' 
                ? window.getSavedDrawerClosures() 
                : [];

            const idx = closures.findIndex(c => c.id === closureId);
            if (idx === -1) {
                if (typeof showToast === 'function') showToast("❌ تعذر العثور على محضر التقفيل في السجل", "error");
                return;
            }

            const rec = closures[idx];
            const expected = Number(rec.expectedCash !== undefined ? rec.expectedCash : (rec.netCashMovement || 0));
            const diff = newActual - expected;
            const absDiff = Math.abs(diff);

            rec.actualCash = newActual;
            rec.expectedCash = expected;
            rec.difference = diff;
            rec.status = absDiff < 0.01 ? 'balanced' : (diff < 0 ? 'deficit' : 'surplus');
            rec.notes = newNotes;
            if (window.currentDrawerClosingState.tempEditDenominations !== undefined && window.currentDrawerClosingState.tempEditDenominations !== null) {
                rec.denominations = window.currentDrawerClosingState.tempEditDenominations;
            }
            rec.isEdited = true;
            rec.editedAt = new Date().toISOString();
            rec.editedBy = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'المدير';

            if (rec.salesCount === undefined && window.dailyReportData?.salesCount !== undefined) {
                rec.salesCount = window.dailyReportData.salesCount;
                rec.totalSales = window.dailyReportData.totalSales;
                rec.totalSalesCash = window.dailyReportData.effectiveCashSales !== undefined ? window.dailyReportData.effectiveCashSales : (window.dailyReportData.totalSalesCash || 0);
                rec.totalSalesNonCash = window.dailyReportData.totalSalesNonCash || 0;
                rec.totalSalesCredit = window.dailyReportData.totalSalesCredit || 0;
                rec.effectiveReceipts = window.dailyReportData.effectiveReceipts !== undefined ? window.dailyReportData.effectiveReceipts : (window.dailyReportData.totalReceiptsCash || 0);
                rec.effectivePurReturns = window.dailyReportData.effectivePurReturns !== undefined ? window.dailyReportData.effectivePurReturns : (window.dailyReportData.purchasesReturnCash || 0);
                rec.effectiveDisbursements = window.dailyReportData.effectiveDisbursements !== undefined ? window.dailyReportData.effectiveDisbursements : (window.dailyReportData.totalExpensesCash || 0);
                rec.effectivePurchases = window.dailyReportData.effectivePurchases !== undefined ? window.dailyReportData.effectivePurchases : (window.dailyReportData.totalPurchasesCash || 0);
                rec.effectiveSalesReturns = window.dailyReportData.effectiveSalesReturns !== undefined ? window.dailyReportData.effectiveSalesReturns : (window.dailyReportData.salesReturnCash || 0);
                rec.totalCashIn = window.dailyReportData.totalCashIn || 0;
                rec.totalCashOut = window.dailyReportData.totalCashOut || 0;
            }

            closures[idx] = rec;
            await window.saveDrawerClosuresToDb(closures);

            // تحديث الحالة النشطة للشاشة الحالية
            window.currentDrawerClosingState.actualCash = newActual;
            window.currentDrawerClosingState.difference = diff;
            window.currentDrawerClosingState.status = rec.status;
            window.currentDrawerClosingState.notes = newNotes;
            if (rec.denominations) {
                window.currentDrawerClosingState.denominations = rec.denominations;
            }

            // تحديث خانة العد الفعلي في الشاشة الرئيسية والبطاقة الفورية
            const mainInp = document.getElementById('drawerActualCashInput');
            if (mainInp) {
                mainInp.value = newActual.toFixed(2);
                window.handleDrawerActualCashInput(mainInp.value);
            }

            // إغلاق نافذة التعديل
            const editModal = document.getElementById('editDrawerClosingModal');
            if (editModal) editModal.remove();



            if (typeof showToast === 'function') {
                showToast("✅ تم حفظ التعديل وتحديث محضر تقفيل الوردية بنجاح!", "success");
            }

            if (andPrint) {
                setTimeout(() => {
                    window.printShiftCloseReport(rec);
                }, 300);
            }
        };


        // ❓ نافذة شرح وتوضيح مصطلحات الخزينة وحركة اليومية التفاعلية
        window.showDailyTermHelp = function(termKey, e) {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }

            const helpData = {
                previousBalance: {
                    title: "⏺️ رصيد سابق (افتتاحي نقدية)",
                    tag: "الرصيد الافتتاحي للخزينة والدرج",
                    tagBg: "#e0f2fe",
                    tagColor: "#0369a1",
                    summary: "هو مجموع كافة الأموال النقدية التي دخلت وخرجت من الخزينة/الدرج <b>قبل تاريخ بداية الفترة المحددة</b> في الفلتر.",
                    points: [
                        "<b>نقطة الانطلاق:</b> يمثل النقدية التي بدأت بها اليومية أو الوردية كقاعدة أساسية (المرحلة من الأيام السابقة).",
                        "<b>العمليات المشمولة:</b> يشمل حصيلة (المبيعات النقدية + سندات القبض + مرتجع الشراء) مطروحاً منها (المصروفات + المشتريات النقدية + مرتجع البيع) حتى اللحظة السابقة لبداية التقرير.",
                        "<b>الأهمية:</b> يضمن عدم إغفال النقدية الموجودة مسبقاً في الدرج حتى يكون الحساب التراكمي للجرد سليماً ومضبوطاً 100%."
                    ],
                    formula: "الرصيد السابق = صافي النقدية المتراكمة بالدرج قبل تاريخ (من)"
                },
                netCashMovement: {
                    title: "🔄 صافي الحركة النقدية بالدرج",
                    tag: "حركة الفترة المحددة فقط",
                    tagBg: "#fef3c7",
                    tagColor: "#b45309",
                    summary: "هو الفارق الحقيقي بين إجمالي ما دخل الدرج نقداً وما خرج منه نقداً <b>خلال الفترة المحددة بالتقرير فقط</b> (دون حساب الأيام السابقة).",
                    points: [
                        "<b>الفائض أو العجز:</b> إذا كان الرقم <b>بالموجب والأخضر 🟢</b>، فهذا يعني أن الدرج حقق زيادة وسيولة نقدية جديدة خلال هذه الفترة.",
                        "<b>في حالة السالب 🔴:</b> إذا كان الرقم بالسالب، فهذا يعني أن المصروفات والمدفوعات النقدية تجاوزت الإيرادات خلال هذه الفترة المحددة.",
                        "<b>الكاش الفعلي فقط:</b> لا يشمل الحركات الآجلة، بل يعتمد حصراً على الأموال المقبوضة أو المدفوعة نقداً باليد."
                    ],
                    formula: "صافي الحركة = (مبيعات كاش + مقبوضات + مرتجع شراء نقدي) - (مصروفات + مشتريات كاش + مرتجع بيع نقدي)"
                },
                finalCashBalance: {
                    title: "💰 الرصيد النهائي بالدرج",
                    tag: "الكاش الفعلي المطلوب عند الجرد",
                    tagBg: "#dcfce7",
                    tagColor: "#15803d",
                    summary: "هو <b>المبلغ الإجمالي الفعلي</b> الواجب تواجده بالكامل نقدياً وورقياً داخل درج الكاشير في هذه اللحظة عند جرد الدرج وتقفيل اليومية.",
                    points: [
                        "<b>مطابقة الجرد اليدوي:</b> عندما يقوم الكاشير أو صاحب العمل بعدّ الفلوس الورقية والمعدنية في الدرج، يجب أن يتطابق العد الفعلي مع هذا الرقم تماماً.",
                        "<b>التسليم والاستلام:</b> هو الرقم المعتمد الذي يتم تسليمه لوردية تالية أو توريده لحساب الخزينة الرئيسية أو الإيداع البنكي.",
                        "<b>العلاقة المحاسبية:</b> يجمع بين رصيد بداية اليومية وصافي ما جرى فيها (الرصيد السابق + صافي الحركة)."
                    ],
                    formula: "الرصيد النهائي بالدرج = الرصيد الافتتاحي السابق + صافي حركة النقدية للفترة"
                }
            };

            const item = helpData[termKey];
            if (!item) return;

            let existingModal = document.getElementById('dailyTermHelpModal');
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.id = 'dailyTermHelpModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 15px; box-sizing: border-box; direction: rtl; font-family: inherit;';

            modal.innerHTML = `
                <div style="background: #ffffff; color: #0f172a; width: 100%; max-width: 490px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); overflow: hidden; border: 1.5px solid #cbd5e1;">
                    <!-- الهيدر -->
                    <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 18px 22px; color: white; display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #3b82f6;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">💡</span>
                            <div>
                                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900; color: #ffffff;">${item.title}</h3>
                                <span style="display: inline-block; background: ${item.tagBg}; color: ${item.tagColor}; padding: 2px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 900; margin-top: 4px;">${item.tag}</span>
                            </div>
                        </div>
                        <button onclick="document.getElementById('dailyTermHelpModal').remove()" style="background: rgba(255,255,255,0.15); border: none; color: white; width: 34px; height: 34px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.85)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">✕</button>
                    </div>

                    <!-- المحتوى -->
                    <div style="padding: 22px; line-height: 1.7; font-size: 0.96rem; max-height: 75vh; overflow-y: auto;">
                        <div style="background: #f8fafc; border-right: 4px solid #3b82f6; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; color: #0f172a; font-weight: 800; font-size: 0.98rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            ${item.summary}
                        </div>

                        <div style="margin-bottom: 18px;">
                            <div style="font-weight: 900; color: #0f172a; margin-bottom: 8px; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                                <span>📌</span> نقاط أساسية للتوضيح:
                            </div>
                            <ul style="margin: 0; padding-right: 20px; color: #334155; font-weight: 700; font-size: 0.92rem; display: flex; flex-direction: column; gap: 8px;">
                                ${item.points.map(p => `<li>${p}</li>`).join('')}
                            </ul>
                        </div>

                        <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1.5px solid #bfdbfe; padding: 12px 16px; border-radius: 12px; margin-bottom: 18px;">
                            <div style="font-size: 0.82rem; font-weight: 900; color: #1d4ed8; margin-bottom: 4px;">📐 طريقة الحساب الرياضية:</div>
                            <div style="font-weight: 900; color: #1e3a8a; font-size: 0.94rem; direction: rtl;">${item.formula}</div>
                        </div>

                        <button onclick="document.getElementById('dailyTermHelpModal').remove()" style="width: 100%; padding: 12px; border: none; border-radius: 12px; background: linear-gradient(135deg, #10b981, #059669); color: white; font-weight: 900; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                            فهمت، شكراً 👍
                        </button>
                    </div>
                </div>
            `;

            modal.addEventListener('click', function(ev) {
                if (ev.target === modal) modal.remove();
            });

            document.body.appendChild(modal);
        };

        window.switchSubTab = function(btnEl, targetId) {
            if (!btnEl) return;
            const parentContainer = btnEl.closest('.sub-tabs') || btnEl.parentElement;
            if (parentContainer) {
                parentContainer.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
            }
            btnEl.classList.add('active');
            
            const tabArea = document.getElementById(targetId);
            if (tabArea) {
                const areaParent = tabArea.parentElement;
                if (areaParent) {
                    areaParent.querySelectorAll('.tab-content-area').forEach(a => {
                        if (a.id !== targetId) a.style.display = 'none';
                    });
                }
                tabArea.style.display = 'block';
            }
        };

        window.loadPendingInvoices = function() {
            const tbody = document.getElementById('pendingInvoicesBody');
            if (!tbody) return;
            const customer = document.getElementById('receiptCustomer')?.value;
            if (!customer || customer.includes('اختر') || customer === '-') {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">يرجى اختيار العميل أولاً لعرض الفواتير المسددة</td></tr>';
                return;
            }
            const userTx = (typeof transactions !== 'undefined' ? transactions : []).filter(t => t.partner === customer && (t.type?.includes('بيع') || t.type?.includes('قبض'))).slice(-10);
            if (userTx.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">لا توجد فواتير سابقة لهذا العميل</td></tr>';
                return;
            }
            tbody.innerHTML = userTx.map(t => `
                <tr>
                    <td style="padding:6px 8px;">${t.date ? t.date.split('T')[0] : '-'}</td>
                    <td style="padding:6px 8px; font-weight:bold; color:#10b981;">${parseFloat(t.total || 0).toFixed(2)}</td>
                    <td style="padding:6px 8px;">${t.type || 'فاتورة'}</td>
                    <td style="padding:6px 8px; text-align:center;">
                        <button type="button" onclick="if(typeof viewTransactionDetails === 'function') viewTransactionDetails('${t.id}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="عرض التفاصيل">👁️</button>
                    </td>
                </tr>
            `).join('');
        };

        window.loadPendingBills = function() {
            const tbody = document.getElementById('pendingBillsBody') || document.getElementById('disburse-settlement');
            if (!tbody) return;
            const supplier = document.getElementById('disburseSupplier')?.value;
            if (!supplier || supplier.includes('اختر') || supplier === '-') {
                if (tbody.tagName === 'TBODY') {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">يرجى اختيار المورد أولاً</td></tr>';
                }
                return;
            }
        };

        window.renderAnalysisReport = function() {
            if (typeof renderAnalysisTable === 'function') {
                renderAnalysisTable();
            }
        };

        window.exportSelectedToExcel = function() {
            if (typeof exportToExcel === 'function') {
                exportToExcel();
            }
        };

        // ================= منطق المبيعات (Sales Logic) =================

        // --- 1. منطق البحث والإضافة ---

        async function printReportData() {
            if (typeof isDailyReportAmountsProtected === 'function' && isDailyReportAmountsProtected()) {
                if (typeof window.verifyAdminPinAuthorization === 'function') {
                    const ok = await window.verifyAdminPinAuthorization('🖨️ طباعة تقرير الحركة اليومية', 'يتطلب طباعة تقرير الحركة اليومية إدخال رمز PIN المدير لكشف المبالغ المالية المحمية.');
                    if (!ok) return;
                } else {
                    if (typeof showToast === 'function') showToast('🔒 المبالغ المالية محمية ولا يمكن طباعتها بدون إذن المدير', 'error');
                    return;
                }
            }
            const isDateLocked = (typeof checkAndApplyDailyReportDateLock === 'function')
                ? checkAndApplyDailyReportDateLock()
                : false;
            const todayISO = new Date().toLocaleDateString('en-CA');

            if (typeof validateDocumentData === 'function') {
                if (!validateDocumentData('dailyReport', 'الطباعة')) return;
            } else {
                const fromD = isDateLocked ? todayISO : (document.getElementById('reportDateFrom')?.value || todayISO);
                const toD = isDateLocked ? todayISO : (document.getElementById('reportDateTo')?.value || todayISO);
                const periodTxs = (typeof transactions !== 'undefined' && Array.isArray(transactions)) ? transactions.filter(t => t.dateISO && t.dateISO >= fromD && t.dateISO <= toD) : [];
                const repData = window.dailyReportData || {};
                const hasActivity = (periodTxs.length > 0 || (repData.totalSales || 0) > 0 || (repData.totalPurchases || 0) > 0 || (repData.totalReceipts || 0) > 0 || (repData.totalExpenses || 0) > 0);
                if (!hasActivity) {
                    if (typeof showToast === 'function') showToast("⚠️ لا توجد أي معاملات أو حركات مسجلة في هذا اليوم لطباعتها!", "warning");
                    else alert("⚠️ لا توجد أي معاملات أو حركات مسجلة في هذا اليوم لطباعتها!");
                    return;
                }
            }

            // استخراج الصفوف الظاهرة فقط واستبعاد أي صف مخفي (سواء بتخصيص البنود أو تخصيص الأعمدة)
            const opsRows = Array.from(document.querySelectorAll('#opsSummaryBody tr')).filter(tr => {
                if (tr.style.display === 'none') return false;
                if (tr.classList.contains('hidden') || tr.hasAttribute('hidden')) return false;
                if (window.getComputedStyle && window.getComputedStyle(tr).display === 'none') return false;
                return true;
            });

            const opsSummary = opsRows.map(tr => {
                const clone = tr.cloneNode(true);
                // إزالة الأزرار التفاعلية مثل عرض التفاصيل من داخل الصف المطبوع
                clone.querySelectorAll('button').forEach(b => b.remove());
                // تنظيف الإيموجي للطباعة الورقية الواضحة
                let html = clone.innerHTML.replace(/📤|📥|🔄|🔙|💵|💸|⚖️|🚚|🛒|🧺|📦|💰|🌗|✅|⏳|🏷️|🏷|➕|📱|⚡|💳|🏦|🍊|🟢|🟣/g, '');
                return `<tr style="border-bottom: 1px solid #000; ${clone.style.background ? `background:${clone.style.background}; color:#ffffff;` : ''}">${html}</tr>`;
            }).join('');

            // استخراج صفوف حركة الخزينة الظاهرة فقط
            const trRows = Array.from(document.querySelectorAll('#treasurySummaryBody tr')).filter(tr => {
                if (tr.style.display === 'none') return false;
                if (tr.classList.contains('hidden') || tr.hasAttribute('hidden')) return false;
                if (window.getComputedStyle && window.getComputedStyle(tr).display === 'none') return false;
                return true;
            });

            const treasurySummary = trRows.map(tr => {
                const clone = tr.cloneNode(true);
                clone.querySelectorAll('button').forEach(b => b.remove());
                let html = clone.innerHTML.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '').replace(/📤|📥|🔄|🔙|💵|💸|⚖️|🚚|🛒|🧺|📦|💰|🌗|✅|⏳|⏺️|❓|📱|⚡|💳|🏦|🍊|🟢|🟣/g, '');
                return `<tr style="border-bottom: 1px solid #000;">${html}</tr>`;
            }).join('');

            const from = isDateLocked ? todayISO : (document.getElementById('reportDateFrom')?.value || todayISO);

            const to = isDateLocked ? todayISO : (document.getElementById('reportDateTo')?.value || todayISO);

            const selectedWh = document.getElementById('dailyReportWarehouseSelect')?.value || (window.dailyReportData?.selectedWarehouse || 'all');
            const selectedTr = document.getElementById('dailyReportTreasurySelect')?.value || (window.dailyReportData?.selectedTreasury || 'all');
            const selectedUsr = document.getElementById('dailyReportUserSelect')?.value || (window.dailyReportData?.selectedUser || 'all');

            const businessName = getStore('bayan_business_name') || 'بيان POS للطلب والمبيعات';

            const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
            let profitSummaryPrintSection = '';
            if (canViewProfits) {
                const profitEl = document.getElementById('profitSummaryBody');
                const profitRows = profitEl ? Array.from(profitEl.querySelectorAll('tr')).filter(tr => {
                    if (tr.style.display === 'none') return false;
                    if (window.getComputedStyle && window.getComputedStyle(tr).display === 'none') return false;
                    return true;
                }) : [];
                if (profitRows.length > 0) {
                    const profitHtml = profitRows.map(tr => {
                        const clone = tr.cloneNode(true);
                        clone.querySelectorAll('button').forEach(b => b.remove());
                        return `<tr style="border-bottom: 1px solid #000;">${clone.innerHTML.replace(/📤|📥|🔄|🔙|💵|💸|⚖️|🚚|🛒|🧺|📦|💰|🌗|✅|⏳/g, '')}</tr>`;
                    }).join('');

                    profitSummaryPrintSection = `
                    <div style="margin-bottom: 20px;">
                        <h3 style="border-right: 4px solid #000; padding-right: 8px; margin-bottom: 10px; font-size: 16px; font-weight: 900;">ملخص الأرباح</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 14px;">
                            <tbody style="font-weight: bold;">
                                ${profitHtml}
                            </tbody>
                        </table>
                    </div>
                    `;
                }
            }

            const customCfg = (typeof window.getDailyReportCustomConfig === 'function')
                ? window.getDailyReportCustomConfig()
                : (window.DEFAULT_DAILY_REPORT_CUSTOM_CONFIG || {});
            const showTreasuryInPrint = customCfg.showTreasuryTable !== false;
            let treasuryPrintSection = '';
            if (showTreasuryInPrint && treasurySummary.trim()) {
                treasuryPrintSection = `
                    <div style="margin-bottom: 20px;">
                        <h3 style="border-right: 4px solid #000; padding-right: 8px; margin-bottom: 10px; font-size: 16px; font-weight: 900;">ملخص حركة الخزينة</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 14px;">
                            <thead>
                                <tr style="border-bottom: 2px solid #000; background: #eee;">
                                    <th style="padding: 8px; border-left: 1px solid #000; text-align: right;">البيان</th>
                                    <th style="padding: 8px; text-align: center;">القيمة</th>
                                </tr>
                            </thead>
                            <tbody style="font-weight: bold;">${treasurySummary}</tbody>
                        </table>
                    </div>
                `;
            }

            const content = `
                <div class="print-container" style="direction: rtl; font-family: 'Tahoma', 'Arial', sans-serif; padding: 10px; color: #000; width: 100%; box-sizing: border-box;">
                    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: 900;">${businessName}</h1>
                        <h2 style="margin: 5px 0; font-size: 18px; font-weight: 800;">تقرير الحركة اليومية</h2>
                        <div style="font-size: 14px; margin-top: 5px; font-weight: bold; border: 1px solid #000; padding: 5px; border-radius: 5px;">
                            من: ${from} <br> إلى: ${to}
                            ${(selectedWh && selectedWh !== 'all') ? `<br>🏢 المخزن: ${selectedWh}` : ''}
                            ${(selectedTr && selectedTr !== 'all') ? `<br>💰 الخزينة / وسيلة الدفع: ${selectedTr}` : ''}
                            ${(selectedUsr && selectedUsr !== 'all') ? `<br>👤 المستخدم / الوردية: ${selectedUsr}` : ''}
                        </div>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h3 style="border-right: 4px solid #000; padding-right: 8px; margin-bottom: 10px; font-size: 16px; font-weight: 900;">ملخص العمليات المالية</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 13px;">
                            <thead>
                                <tr style="border-bottom: 2px solid #000; background: #eee;">
                                    <th style="padding: 6px; border-left: 1px solid #000; text-align: right;">البيان</th>
                                    <th style="padding: 6px; border-left: 1px solid #000; text-align: center;">العدد</th>
                                    <th style="padding: 6px; border-left: 1px solid #000; text-align: center;">الإجمالي</th>
                                    <th style="padding: 6px; border-left: 1px solid #000; text-align: center;">نقدي</th>
                                    <th style="padding: 6px; border-left: 1px solid #000; text-align: center;">فودافون كاش</th>
                                    <th style="padding: 6px; text-align: center;">آجل</th>
                                </tr>
                            </thead>
                            <tbody style="text-align: right;">${opsSummary}</tbody>
                        </table>
                    </div>
                    ${treasuryPrintSection}
                    ${profitSummaryPrintSection}

                    <div style="margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; font-size: 11px; text-align: center; line-height: 1.6;">

                        <div style="font-weight: bold;">تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</div>

                        <div>بواسطة: ${currentUser ? currentUser.name : 'النظام'}</div>

                        <div style="font-weight: 900; margin-top: 5px; font-size: 12px; border: 1px solid #000; display: inline-block; padding: 2px 10px;">بيان POS - نظام مبيعات متكامل</div>

                    </div>

                </div>

            `;

            const printWindow = window.open('', '_blank');

            printWindow.document.write(`

                <html dir="rtl" lang="ar">

                    <head>

                        <title>طباعة تقرير الحركة اليومية</title>

                        <style>

                            @page { margin: 0; }

                            body { margin: 0 0 0 auto; padding: 5px; width: 80mm; font-family: 'Arial', sans-serif; text-align: right; }

                            table th, table td { padding: 4px; border: 1px solid #000 !important; color: #000 !important; }

                            * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }

                            /* إخفاء الخلفيات في الطباعة لضمان الوضوح */

                            tr, td, th { background-color: transparent !important; }

                        </style>

                    </head>

                    <body>

                        ${content}

                        <script>

                            window.onload = function() {

                                setTimeout(function() {

                                    window.focus();

                                    window.print();

                                    setTimeout(function() { window.close(); }, 500);

                                }, 300);

                            };

                        <\/script>

                    </body>

                </html>

            `);

            printWindow.document.close();

        }

         function printAdjustmentData() {

            if (!window.adjCart || window.adjCart.length === 0) return alert("لا توجد بيانات للطباعة");

            const shopName    = document.getElementById('shopName')?.value || 'بـيـان POS';
            const shopAddress = document.getElementById('shopAddress')?.value || '';
            const shopPhone   = document.getElementById('shopPhone1')?.value || '';
            const footerMsg   = document.getElementById('printFooterMsg')?.value || 'شكراً لزيارتكم!';
            const activeWH    = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';

            let totalCountedQty = 0;
            let totalDiffQty = 0;
            let totalDiffValue = 0;

            let rows = window.adjCart.map((item, idx) => {
                const factor = parseFloat(item.unitFactor) || 1;
                const counted = (parseFloat(item.qty) || 0) * factor;
                const book = parseFloat(item.stock) || 0;
                const diff = counted - book;
                const price = parseFloat(item.price) || 0;
                const diffTotal = diff * price;

                totalCountedQty += counted;
                totalDiffQty += diff;
                totalDiffValue += diffTotal;

                const sSize = item.size || item.selectedSize || '-';
                const sColor = item.color || item.selectedColor || '-';
                const unitName = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');
                const diffLabel = diff < 0 ? `عجز (${Math.abs(diff)})` : (diff > 0 ? `زيادة (+${diff})` : 'مطابق (0)');

                return `
                    <tr>
                        <td style="padding: 6px 8px; border: 1px solid #000;">${idx + 1}</td>
                        <td style="text-align:right; padding: 6px 10px; border: 1px solid #000; font-weight:bold;">${item.name}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#047857;">${sSize}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#1d4ed8;">${sColor}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; background:#f8fafc;">${book}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; background:#eff6ff;">${counted} ${unitName}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:${diff < 0 ? '#dc2626' : (diff > 0 ? '#16a34a' : '#000')};">${diffLabel}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000;">${price.toFixed(2)}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${diffTotal.toFixed(2)}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-size:11px;">${item.notes || '-'}</td>
                    </tr>
                `;
            }).join('');

            const dtObj = typeof getTransactionDateTime === 'function' ? getTransactionDateTime('adjDate', 'adjTime') : { full: new Date().toLocaleString('ar-EG') };

            const content = `

                <div class="print-container" style="direction:rtl; font-family:Cairo, sans-serif; padding: 20px;">

                    <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">

                        <h1 style="margin:0;">${shopName}</h1>
                        ${shopAddress ? `<div style="font-size:12px; color:#555; margin-top:2px;">${shopAddress}</div>` : ''}
                        ${shopPhone ? `<div style="font-size:12px; color:#555; margin-top:2px;">هاتف: ${shopPhone}</div>` : ''}

                        <h2 style="margin:5px 0; background:#000; color:#fff; display:inline-block; padding:5px 20px; border-radius:5px;">إذن جرد وتسوية مخزنية</h2>

                    </div>

                    <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-weight:bold;">
                        <div>المخزن: <span style="text-decoration:underline;">${activeWH}</span></div>
                        <div>التاريخ: ${dtObj.full}</div>
                    </div>

                    <table style="width:100%; border-collapse:collapse; text-align:center; margin-bottom:20px;" border="1">

                        <thead>
                            <tr style="background:#f0f0f0;">
                                <th style="padding: 8px; border: 1px solid #000;">م</th>
                                <th style="padding: 8px; border: 1px solid #000; text-align:right;">الصنف</th>
                                <th style="padding: 8px; border: 1px solid #000;">المقاس</th>
                                <th style="padding: 8px; border: 1px solid #000;">اللون</th>
                                <th style="padding: 8px; border: 1px solid #000;">الدفتري</th>
                                <th style="padding: 8px; border: 1px solid #000;">الفعلي</th>
                                <th style="padding: 8px; border: 1px solid #000;">الفرق</th>
                                <th style="padding: 8px; border: 1px solid #000;">${(typeof window.getAdjustmentPriceLabel === 'function') ? window.getAdjustmentPriceLabel() : 'السعر'}</th>
                                <th style="padding: 8px; border: 1px solid #000;">قيمة الفرق</th>
                                <th style="padding: 8px; border: 1px solid #000;">الملاحظات</th>
                            </tr>
                        </thead>

                        <tbody>${rows}</tbody>

                        <tfoot>
                            <tr style="font-weight:bold; background:#f0f0f0;">
                                <td colspan="4" style="padding: 8px; border: 1px solid #000;">الإجمالي الكلي</td>
                                <td style="padding: 8px; border: 1px solid #000;">-</td>
                                <td style="padding: 8px; border: 1px solid #000;">${totalCountedQty}</td>
                                <td style="padding: 8px; border: 1px solid #000; color:${totalDiffQty < 0 ? '#dc2626' : (totalDiffQty > 0 ? '#16a34a' : '#000')};">${totalDiffQty >= 0 ? '+' : ''}${totalDiffQty}</td>
                                <td style="padding: 8px; border: 1px solid #000;">-</td>
                                <td style="padding: 8px; border: 1px solid #000;">${totalDiffValue.toFixed(2)}</td>
                                <td style="padding: 8px; border: 1px solid #000;">-</td>
                            </tr>
                        </tfoot>

                    </table>

                    <div style="margin-top:50px; display:flex; justify-content:space-between;">
                        <div style="text-align:center;">توقيع المسؤول:<br><br>...........................</div>
                        <div style="text-align:center;">توقيع أمين المخزن:<br><br>...........................</div>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px; border-top:1px dashed #000; padding-top:10px; font-size:12px;">
                        <div style="font-weight:bold;">${footerMsg}</div>
                        <div>نظام بيان POS - مبيعات متكامل</div>
                    </div>

                </div>

             `;

            let receiptArea = document.getElementById('receipt-area');
            if (!receiptArea) {
                receiptArea = document.createElement('div');
                receiptArea.id = 'receipt-area';
                document.body.appendChild(receiptArea);
            }
            receiptArea.innerHTML = content;

            window.print();

        }

        // ================= منطق تحليل المبيعات المطور (Advanced Sales Analysis Logic) =================

        window.salesTrendChartInstance = window.salesTrendChartInstance || null;
        window.categoryChartInstance = window.categoryChartInstance || null;
        window.analysisDateSortDir = window.analysisDateSortDir || 'desc';
        if (typeof currentAnalysisMode !== 'undefined') {
            currentAnalysisMode = 'summary';
        } else {
            window.currentAnalysisMode = 'summary';
        }

        function setAnalysisMode(mode, shouldScroll = true) {
            currentAnalysisMode = mode;
            
            // تحديث تصميم الأزرار النشطة لجميع الأنماط
            const modeButtons = [
                { id: 'summary', el: document.getElementById('anModeSummaryBtn') },
                { id: 'detailed', el: document.getElementById('anModeDetailedBtn') },
                { id: 'customers', el: document.getElementById('anModeCustomerBtn') },
                { id: 'categories', el: document.getElementById('anModeCategoryBtn') },
                { id: 'returns', el: document.getElementById('anModeReturnBtn') }
            ];

            modeButtons.forEach(m => {
                if (m.el) {
                    const isActive = (mode === m.id);
                    m.el.className = isActive ? 'an-btn-mode active' : 'an-btn-mode';
                    m.el.style.background = isActive ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#f1f5f9';
                    m.el.style.color = isActive ? '#ffffff' : '#475569';
                    m.el.style.border = isActive ? 'none' : '1px solid #cbd5e1';
                }
            });

            renderAnalysisTable();

            if (shouldScroll) {
                setTimeout(() => {
                    const tableContainer = document.getElementById('analysisTableContainer');
                    if (tableContainer) {
                        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }, 80);
            }
        }
        window.setAnalysisMode = setAnalysisMode;

        function toggleAnalysisCharts() {
            const chartsArea = document.getElementById('analysis-charts-area');
            const btnText = document.getElementById('anToggleChartsText');
            const btn = document.getElementById('anToggleChartsBtn');
            if (!chartsArea) return;

            const isHidden = (chartsArea.style.display === 'none');
            if (isHidden) {
                chartsArea.style.display = 'grid';
                if (btnText) btnText.innerText = 'إخفاء الرسوم';
                if (btn) {
                    btn.style.background = '#f8fafc';
                    btn.style.color = '#4f46e5';
                    btn.style.borderColor = '#c7d2fe';
                }
                if (typeof setStore === 'function') setStore('pos_an_charts', 'true');
            } else {
                chartsArea.style.display = 'none';
                if (btnText) btnText.innerText = 'إظهار الرسوم 📈';
                if (btn) {
                    btn.style.background = '#eef2ff';
                    btn.style.color = '#4338ca';
                    btn.style.borderColor = '#6366f1';
                }
                if (typeof setStore === 'function') setStore('pos_an_charts', 'false');
            }
        }
        window.toggleAnalysisCharts = toggleAnalysisCharts;

        function shareAnalysisReport(platform) {
            const totalSales = document.getElementById('anTotalSales')?.innerText || '0.00';
            const totalProfit = document.getElementById('anTotalProfit')?.innerText || '0.00';
            const profitMargin = document.getElementById('anProfitMargin')?.innerText || '0.0%';
            const fromDate = document.getElementById('anDateFrom')?.value || 'بداية السجل';
            const toDate = document.getElementById('anDateTo')?.value || 'الآن';
            const shopName = (typeof getStore === 'function' ? getStore('shop_name') : null) || document.getElementById('shopName')?.value || 'متجر بيان POS';

            let text = `📊 *تقرير تحليل المبيعات والأرباح - ${shopName}*\n`;
            text += `🗓️ الفترة: من ${fromDate} إلى ${toDate}\n`;
            text += `----------------------------------\n`;
            text += `💰 صافي المبيعات: *${totalSales} ج.م*\n`;
            text += `📈 صافي الأرباح: *${totalProfit} ج.م*\n`;
            text += `🎯 هامش الربح: *${profitMargin}*\n`;
            text += `----------------------------------\n`;
            text += `✅ استخراج تلقائي بواسطة منظومة بيان POS | ${new Date().toLocaleDateString('ar-EG')}`;

            const encodedText = encodeURIComponent(text);
            let url = '';
            if (platform === 'whatsapp') {
                url = `https://wa.me/?text=${encodedText}`;
            } else if (platform === 'telegram') {
                url = `https://t.me/share/url?url=${encodedText}`;
            }
            if (url) window.open(url, '_blank');
        }
        window.shareAnalysisReport = shareAnalysisReport;

        // ⚡ كاش فهرسة الأصناف السريعة O(1) لحسابات وتحليلات التقارير بدلاً من البحث الخطي التكراري
        let _reportsProductMap = null;
        let _reportsProductMapLen = 0;
        function getReportsProductQuick(key) {
            if (!key) return null;
            const strKey = String(key).trim();
            if (!_reportsProductMap || _reportsProductMapLen !== (window.productsDB || []).length) {
                _reportsProductMap = new Map();
                (window.productsDB || []).forEach(p => {
                    if (p) {
                        if (p.name) _reportsProductMap.set(p.name.trim(), p);
                        if (p.id !== undefined && p.id !== null) _reportsProductMap.set(String(p.id).trim(), p);
                        if (p.barcode) _reportsProductMap.set(String(p.barcode).trim(), p);
                    }
                });
                _reportsProductMapLen = (window.productsDB || []).length;
            }
            return _reportsProductMap.get(strKey) || null;
        }

        // دالة مساعدة لحساب الربح الصافي الدقيق لكل حركة (بيع أو مرتجع)
        function getTransactionReliableProfit(t) {
            const isReturn = t.type && t.type.includes('مرتجع');
            const qty = Math.abs(parseFloat(t.qty) || 0);
            const price = parseFloat(t.price) || 0;
            const itemTotal = Math.abs(parseFloat(t.total) || (price * qty) || 0);

            // 1. إذا كان الربح مسجلاً ومخزناً بالعملية
            if (t.profit !== undefined && t.profit !== null && !isNaN(parseFloat(t.profit)) && parseFloat(t.profit) !== 0) {
                return Math.abs(parseFloat(t.profit));
            }

            // 2. حساب بديل من قاعدة البيانات إذا لم يتوفر الربح
            const p = getReportsProductQuick(t.product) || getReportsProductQuick(t.productId) || getReportsProductQuick(t.barcode) || null;
            let baseCost = p ? (parseFloat(p.cost) || parseFloat(p.buyPrice) || 0) : 0;
            let factor = parseFloat(t.unitFactor) || 1;
            if (p && (!t.unitFactor || t.unitFactor === 1)) {
                const isSubUnit = p.subUnits && p.subUnits.find(u => u.unitName === t.unit);
                if (isSubUnit) factor = parseFloat(isSubUnit.factor) || 1;
            }
            const unitCost = baseCost * factor;
            const unitProfit = Math.max(0, price - unitCost);
            return unitProfit * qty;
        }

        function updateAnalysisCharts(data) {
            if (typeof Chart === 'undefined') return;

            const trendData = {};
            const catData = {};
            let totalQty = 0;
            let invoiceIds = new Set();
            let totalReturnsCount = 0;
            let totalReturnsAmount = 0;

            data.forEach(t => {
                const isReturn = t.type && t.type.includes('مرتجع');
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                const date = t.dateISO || 'غير مؤرخ';

                if (t.invoiceId && t.invoiceId !== '-') {
                    invoiceIds.add(t.invoiceId);
                }

                if (isReturn) {
                    totalReturnsCount++;
                    totalReturnsAmount += total;
                    totalQty -= qty;
                } else {
                    totalQty += qty;
                }

                // Trend data: Net sales per day
                if (!trendData[date]) trendData[date] = 0;
                trendData[date] += isReturn ? -total : total;

                // Category/product sales distribution (Always gross positive for doughnut chart)
                const prodName = t.product || 'صنف حر';
                if (!isReturn) {
                    if (!catData[prodName]) catData[prodName] = 0;
                    catData[prodName] += total;
                }
            });

            // Update KPI Cards
            const invoiceCountEl = document.getElementById('kpi-invoice-count');
            const totalQtyEl = document.getElementById('kpi-total-qty');
            const returnCountEl = document.getElementById('kpi-return-count');
            const returnAmountEl = document.getElementById('kpi-return-amount');

            if (invoiceCountEl) invoiceCountEl.innerText = invoiceIds.size.toLocaleString('en-US');
            if (totalQtyEl) totalQtyEl.innerText = Math.max(0, totalQty).toLocaleString('en-US');
            if (returnCountEl) returnCountEl.innerText = totalReturnsCount.toLocaleString('en-US');
            if (returnAmountEl) returnAmountEl.innerText = totalReturnsAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            // Chart 1: Sales Trend
            const trendLabels = Object.keys(trendData).sort();
            const trendValues = trendLabels.map(l => Math.round(trendData[l] * 100) / 100);
            const trendCtx = document.getElementById('salesTrendChart');

            if (trendCtx) {
                if (salesTrendChartInstance) {
                    try { salesTrendChartInstance.destroy(); } catch (e) {}
                    salesTrendChartInstance = null;
                }

                salesTrendChartInstance = new Chart(trendCtx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: trendLabels.length ? trendLabels : ['لا توجد مبيعات'],
                        datasets: [{
                            label: 'صافي المبيعات (ج.م)',
                            data: trendValues.length ? trendValues : [0],
                            borderColor: '#4f46e5',
                            backgroundColor: 'rgba(79, 70, 229, 0.08)',
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2.5,
                            pointRadius: 3.5,
                            pointBackgroundColor: '#4f46e5',
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            title: {
                                display: true,
                                text: '📈 اتجاه صافي المبيعات اليومية',
                                font: { family: 'Cairo', size: 13, weight: 'bold' },
                                color: '#1e293b'
                            },
                            tooltip: {
                                titleFont: { family: 'Cairo' },
                                bodyFont: { family: 'Cairo' }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(0,0,0,0.04)' },
                                ticks: { font: { family: 'Cairo', size: 10 } }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { font: { family: 'Cairo', size: 10 } }
                            }
                        }
                    }
                });
            }

            // Chart 2: Top Selling Products
            let productSalesArray = Object.keys(catData).map(name => ({
                name: name,
                total: catData[name]
            })).sort((a, b) => b.total - a.total);

            let finalLabels = [];
            let finalValues = [];

            if (productSalesArray.length > 6) {
                const top6 = productSalesArray.slice(0, 6);
                const others = productSalesArray.slice(6).reduce((sum, p) => sum + p.total, 0);
                finalLabels = top6.map(p => p.name);
                finalValues = top6.map(p => Math.round(p.total * 100) / 100);
                if (others > 0) {
                    finalLabels.push("أصناف أخرى");
                    finalValues.push(Math.round(others * 100) / 100);
                }
            } else {
                finalLabels = productSalesArray.map(p => p.name);
                finalValues = productSalesArray.map(p => Math.round(p.total * 100) / 100);
            }

            const catCtx = document.getElementById('categoryChart');
            if (catCtx) {
                if (categoryChartInstance) {
                    try { categoryChartInstance.destroy(); } catch (e) {}
                    categoryChartInstance = null;
                }

                const colors = ['#4f46e5', '#059669', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#64748b'];

                categoryChartInstance = new Chart(catCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: finalLabels.length ? finalLabels : ['لا توجد مبيعات'],
                        datasets: [{
                            data: finalValues.length ? finalValues : [1],
                            backgroundColor: finalValues.length ? colors.slice(0, finalLabels.length) : ['#e2e8f0'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    boxWidth: 12,
                                    font: { family: 'Cairo', size: 10, weight: 'bold' }
                                }
                            },
                            title: {
                                display: true,
                                text: '🏆 الأصناف الأعلى مبيعاً',
                                font: { family: 'Cairo', size: 13, weight: 'bold' },
                                color: '#1e293b'
                            },
                            tooltip: {
                                titleFont: { family: 'Cairo' },
                                bodyFont: { family: 'Cairo' }
                            }
                        },
                        cutout: '68%'
                    }
                });
            }
        }
        window.updateAnalysisCharts = updateAnalysisCharts;

        function toggleAnalysisDateSort() {
            analysisDateSortDir = (analysisDateSortDir === 'desc') ? 'asc' : 'desc';
            const sortIcon = document.getElementById('anSortDateIcon');
            if (sortIcon) {
                sortIcon.innerText = (analysisDateSortDir === 'desc') ? ' 🔽' : ' 🔼';
            }
            renderAnalysisTable();
        }
        window.toggleAnalysisDateSort = toggleAnalysisDateSort;

        // دالة تحديد الصف المطور مع مؤشر الدائرة الأملس
        function selectAnalysisRow(rowEl, invoiceId, type, productName) {
            if (!rowEl) return;
            const allRows = document.querySelectorAll('#analysisTableBody tr.an-row');
            allRows.forEach(r => r.classList.remove('selected-row'));

            rowEl.classList.add('selected-row');

            window.selectedAnalysisInvoice = {
                id: (invoiceId && invoiceId !== '-' && invoiceId !== 'undefined') ? invoiceId : null,
                type: type || 'بيع',
                product: productName || '',
                row: rowEl
            };
        }
        window.selectAnalysisRow = selectAnalysisRow;

        // ⚡ مؤقت تأخير ذكي لبحث قسم التحليل السريع لمنع استهلاك المعالج أثناء الكتابة
        let _analysisSearchDebounceTimer = null;
        window.debouncedRenderAnalysisTable = function(delay = 140) {
            if (_analysisSearchDebounceTimer) {
                clearTimeout(_analysisSearchDebounceTimer);
            }
            _analysisSearchDebounceTimer = setTimeout(() => {
                _analysisSearchDebounceTimer = null;
                renderAnalysisTable();
            }, delay);
        };

        async function renderAnalysisTable() {
            if (_analysisSearchDebounceTimer) {
                clearTimeout(_analysisSearchDebounceTimer);
                _analysisSearchDebounceTimer = null;
            }

            const tbody = document.getElementById('analysisTableBody');
            if (!tbody) return;

            // 1. جلب قيم الفلاتر والبحث
            const fromDate = document.getElementById('anDateFrom')?.value || '';
            const toDate = document.getElementById('anDateTo')?.value || '';
            if (typeof window.loadTransactionsForDateRange === 'function' && (fromDate || toDate)) {
                await window.loadTransactionsForDateRange(fromDate, toDate);
            }
            const searchQuery = (document.getElementById('anSearchInput')?.value || '').trim().toLowerCase();
            const accFilter = document.getElementById('anAccount')?.value || 'all';
            const methodFilter = document.getElementById('anMethod')?.value || 'all';
            const catFilter = document.getElementById('anCategory')?.value || 'all';
            const whFilter = document.getElementById('anWarehouse')?.value || 'all';
            const userFilter = document.getElementById('anUser')?.value || 'all';

            // 2. تحديث وتعبئة القوائم الديناميكية
            const accSelect = document.getElementById('anAccount');
            if (accSelect && accSelect.options.length <= 1) {
                const partners = [...new Set((window.transactions || []).map(t => t.partner).filter(p => p && p !== '-'))].sort();
                partners.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.innerText = `👤 ${p}`;
                    accSelect.appendChild(opt);
                });
            }

            const methodSelect = document.getElementById('anMethod');
            if (methodSelect && methodSelect.options.length <= 1) {
                let dynamicMethods = [];
                if (typeof getPaymentMethods === 'function') {
                    dynamicMethods = getPaymentMethods().filter(m => m.active !== false).map(m => m.name);
                }
                const txMethods = [...new Set((window.transactions || []).map(t => t.method).filter(m => m && m !== '-'))];
                const allMethods = [...new Set([...dynamicMethods, ...txMethods, 'نقدي', 'آجل'])];
                allMethods.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.innerText = `💳 ${m}`;
                    methodSelect.appendChild(opt);
                });
            }

            const catSelect = document.getElementById('anCategory');
            if (catSelect && catSelect.options.length <= 1) {
                const cats = [...new Set((window.productsDB || []).map(p => p.category).filter(c => c && c.trim()))].sort();
                cats.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.innerText = `📦 ${c}`;
                    catSelect.appendChild(opt);
                });
            }

            const whSelect = document.getElementById('anWarehouse');
            if (whSelect && whSelect.options.length <= 1) {
                const warehouses = [...new Set((window.transactions || []).map(t => t.warehouse).filter(w => w && w !== '-'))].sort();
                warehouses.forEach(w => {
                    const opt = document.createElement('option');
                    opt.value = w;
                    opt.innerText = `🏢 ${w}`;
                    whSelect.appendChild(opt);
                });
            }

            const userSelect = document.getElementById('anUser');
            if (userSelect && userSelect.options.length <= 1) {
                const users = [...new Set((window.transactions || []).map(t => t.user).filter(u => u && u !== '-'))].sort();
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u;
                    opt.innerText = `🧑‍💼 ${u}`;
                    userSelect.appendChild(opt);
                });
            }

            // استعادة حالة الرسوم البيانية المحفوظة
            const chartsArea = document.getElementById('analysis-charts-area');
            const chartsBtnText = document.getElementById('anToggleChartsText');
            const chartsBtn = document.getElementById('anToggleChartsBtn');
            const savedChartsPref = typeof getStore === 'function' ? getStore('pos_an_charts') : null;
            if (chartsArea) {
                if (savedChartsPref === 'false') {
                    chartsArea.style.display = 'none';
                    if (chartsBtnText) chartsBtnText.innerText = 'إظهار الرسوم 📈';
                    if (chartsBtn) {
                        chartsBtn.style.background = '#eef2ff';
                        chartsBtn.style.color = '#4338ca';
                        chartsBtn.style.borderColor = '#6366f1';
                    }
                } else if (savedChartsPref === 'true') {
                    chartsArea.style.display = 'grid';
                    if (chartsBtnText) chartsBtnText.innerText = 'إخفاء الرسوم';
                    if (chartsBtn) {
                        chartsBtn.style.background = '#f8fafc';
                        chartsBtn.style.color = '#4f46e5';
                        chartsBtn.style.borderColor = '#c7d2fe';
                    }
                }
            }

            // 3. فلترة البيانات الأساسية (حركات البيع ومرتجع البيع فقط)
            let data = (window.transactions || []).filter(t => t.type && (t.type.includes('بيع') || t.type.includes('مرتجع بيع')));

            if (fromDate) data = data.filter(t => (t.dateISO || '') >= fromDate);
            if (toDate) data = data.filter(t => (t.dateISO || '') <= toDate);

            // فلتر البحث النصي الفوري
            if (searchQuery) {
                data = data.filter(t => {
                    const prod = (t.product || '').toLowerCase();
                    const partner = (t.partner || '').toLowerCase();
                    const invId = (t.invoiceId || '').toLowerCase();
                    const size = (t.size || '').toLowerCase();
                    const color = (t.color || '').toLowerCase();
                    const barcode = (t.barcode || '').toLowerCase();
                    return prod.includes(searchQuery) ||
                           partner.includes(searchQuery) ||
                           invId.includes(searchQuery) ||
                           size.includes(searchQuery) ||
                           color.includes(searchQuery) ||
                           barcode.includes(searchQuery);
                });
            }

            if (accFilter !== 'all') {
                data = data.filter(t => t.partner === accFilter);
            }

            if (methodFilter !== 'all') {
                data = data.filter(t => {
                    const m = (t.method || '').toLowerCase();
                    const target = methodFilter.toLowerCase();
                    return m.includes(target) || target.includes(m);
                });
            }

            if (catFilter !== 'all') {
                data = data.filter(t => {
                    const prod = getReportsProductQuick(t.product) || getReportsProductQuick(t.productId) || getReportsProductQuick(t.barcode);
                    return prod && prod.category === catFilter;
                });
            }

            if (whFilter !== 'all') {
                data = data.filter(t => t.warehouse === whFilter);
            }

            if (userFilter !== 'all') {
                data = data.filter(t => t.user === userFilter);
            }

            // 4. فرز التاريخ والوقت
            data.sort((a, b) => {
                const dtA = (a.dateISO || '') + ' ' + (a.timeISO || '00:00');
                const dtB = (b.dateISO || '') + ' ' + (b.timeISO || '00:00');
                return (analysisDateSortDir === 'desc') ? dtB.localeCompare(dtA) : dtA.localeCompare(dtB);
            });

            // 5. حساب الإجماليات الحسابية الدقيقة وساعات الذروة والعميل الأكثر شراءً
            let totalPeriodSales = 0;
            let totalPeriodProfit = 0;
            let totalPeriodCost = 0;
            let totalPeriodQty = 0;
            let totalReturnsAmount = 0;
            let totalReturnsCount = 0;

            const hourSales = {};
            const customerSalesMap = {};

            data.forEach(t => {
                const isReturn = t.type && t.type.includes('مرتجع');
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                const lineProfit = getTransactionReliableProfit(t);

                if (isReturn) {
                    totalPeriodSales -= total;
                    totalPeriodProfit -= lineProfit;
                    totalPeriodCost -= Math.max(0, total - lineProfit);
                    totalPeriodQty -= qty;
                    totalReturnsAmount += total;
                    totalReturnsCount++;
                } else {
                    totalPeriodSales += total;
                    totalPeriodProfit += lineProfit;
                    totalPeriodCost += Math.max(0, total - lineProfit);
                    totalPeriodQty += qty;
                }

                // حساب ساعة الذروة
                if (t.timeISO) {
                    const timeMatch = String(t.timeISO).match(/(\d{1,2}):(\d{2})/);
                    if (timeMatch) {
                        let h = parseInt(timeMatch[1], 10);
                        const isPM = String(t.timeISO).toLowerCase().includes('pm') || String(t.timeISO).includes('م');
                        const isAM = String(t.timeISO).toLowerCase().includes('am') || String(t.timeISO).includes('ص');
                        if (isPM && h < 12) h += 12;
                        if (isAM && h === 12) h = 0;
                        if (h >= 0 && h <= 23) {
                            if (!hourSales[h]) hourSales[h] = 0;
                            hourSales[h] += isReturn ? -total : total;
                        }
                    }
                }

                // حساب مبيعات العملاء لاكتشاف العميل الأكثر شراءً
                const partnerName = t.partner || 'عميل نقدي';
                if (!customerSalesMap[partnerName]) customerSalesMap[partnerName] = 0;
                customerSalesMap[partnerName] += isReturn ? -total : total;
            });

            // استخراج وتنسيق ساعة الذروة (Peak Hour)
            let peakHour = null;
            let maxHourSales = 0;
            Object.keys(hourSales).forEach(hKey => {
                const hVal = hourSales[hKey];
                if (hVal > maxHourSales) {
                    maxHourSales = hVal;
                    peakHour = parseInt(hKey, 10);
                }
            });

            const peakHourEl = document.getElementById('anPeakHourValue');
            if (peakHourEl) {
                if (peakHour !== null && maxHourSales > 0) {
                    const start12 = peakHour % 12 === 0 ? 12 : peakHour % 12;
                    const endH = (peakHour + 1) % 24;
                    const end12 = endH % 12 === 0 ? 12 : endH % 12;
                    const startPeriod = peakHour >= 12 ? 'م' : 'ص';
                    const endPeriod = endH >= 12 ? 'م' : 'ص';
                    peakHourEl.innerText = `${start12}:00 ${startPeriod} - ${end12}:00 ${endPeriod} (${maxHourSales.toLocaleString('en-US', { maximumFractionDigits: 0 })} ج.م)`;
                } else {
                    peakHourEl.innerText = 'ساعات متوازنة';
                }
            }

            // استخراج وتنسيق العميل الأكثر شراءً
            let topCustomerName = null;
            let maxCustSales = 0;
            const custKeys = Object.keys(customerSalesMap);
            // تفضيل العملاء المعرّفين بالاسم أولاً
            const namedPool = custKeys.filter(k => k && k !== 'عميل نقدي' && k !== '-' && customerSalesMap[k] > 0);
            const activePool = namedPool.length > 0 ? namedPool : custKeys.filter(k => customerSalesMap[k] > 0);
            activePool.forEach(cKey => {
                if (customerSalesMap[cKey] > maxCustSales) {
                    maxCustSales = customerSalesMap[cKey];
                    topCustomerName = cKey;
                }
            });

            const topCustEl = document.getElementById('anTopCustomerValue');
            if (topCustEl) {
                if (topCustomerName && maxCustSales > 0) {
                    topCustEl.innerText = `${topCustomerName} (${maxCustSales.toLocaleString('en-US', { maximumFractionDigits: 0 })} ج.م)`;
                } else {
                    topCustEl.innerText = 'عميل نقدي';
                }
            }

            const profitMarginPct = totalPeriodSales > 0 ? ((totalPeriodProfit / totalPeriodSales) * 100).toFixed(1) : '0.0';

            const anTotalSalesEl = document.getElementById('anTotalSales');
            const anTotalProfitEl = document.getElementById('anTotalProfit');
            const anProfitMarginEl = document.getElementById('anProfitMargin');

            if (anTotalSalesEl) anTotalSalesEl.innerText = totalPeriodSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (anTotalProfitEl) anTotalProfitEl.innerText = totalPeriodProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (anProfitMarginEl) anProfitMarginEl.innerText = profitMarginPct + '%';

            const kpiSales = document.getElementById('kpi-total-sales');
            const kpiProfit = document.getElementById('kpi-total-profit');
            const kpiMargin = document.getElementById('kpi-profit-margin');

            if (kpiSales) kpiSales.innerText = totalPeriodSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (kpiProfit) kpiProfit.innerText = totalPeriodProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (kpiMargin) kpiMargin.innerText = profitMarginPct + '%';

            // 6. تحديث الرسوم البيانية والكروت
            updateAnalysisCharts(data);

            // 7. توجيه العرض حسب النمط الحالي
            if (currentAnalysisMode === 'returns') {
                renderMostReturningCustomers();
                return;
            }
            if (currentAnalysisMode === 'customers') {
                renderCustomerAnalysisReport(data, totalPeriodSales);
                return;
            }
            if (currentAnalysisMode === 'categories') {
                renderCategoryAnalysisReport(data, totalPeriodSales);
                return;
            }

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:35px; font-weight:bold; color:#64748b;">لا توجد حركات بيع أو مرتجعات مطابقة للفترة المحددة 🔍</td></tr>';
                return;
            }

            const rowsHtml = [];

            // 8. بناء الجدول - النمط التفصيلي (Detailed Mode)
            if (currentAnalysisMode === 'detailed') {
                const totalMatching = data.length;
                const limit = window.analysisRenderLimit || 150;
                const displayedData = data.slice(0, limit);
                const hasMore = totalMatching > displayedData.length;

                displayedData.forEach((t, idx) => {
                    const isReturn = t.type && t.type.includes('مرتجع');
                    const qty = Math.abs(parseFloat(t.qty) || 0);
                    const price = parseFloat(t.price) || 0;
                    const total = Math.abs(parseFloat(t.total) || (price * qty) || 0);
                    const lineProfit = getTransactionReliableProfit(t);
                    const unitCost = qty > 0 ? Math.max(0, (total - lineProfit) / qty) : 0;
                    const displayProfit = isReturn ? -lineProfit : lineProfit;
                    const profitMargin = total > 0 ? ((lineProfit / total) * 100).toFixed(1) : '0.0';
                    const profitShare = totalPeriodSales > 0 ? ((total / totalPeriodSales) * 100).toFixed(1) : '0.0';

                    const rowClass = isReturn ? 'return-row' : (displayProfit < 0 ? 'loss-row' : '');
                    const profitColor = isReturn ? '#ef4444' : (displayProfit < 0 ? '#ef4444' : '#10b981');
                    const typeBadge = isReturn 
                        ? `<span class="badge-return" style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">↩️ مرتجع</span>`
                        : `<span class="badge-sale" style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">📤 بيع</span>`;

                    const isSelected = idx === 0;
                    const safeProdName = (t.product || '').replace(/'/g, "\\'");
                    if (isSelected) {
                        window.selectedAnalysisInvoice = {
                            id: t.invoiceId,
                            type: t.type || 'بيع',
                            product: t.product
                        };
                    }

                    rowsHtml.push(`
                        <tr class="an-row ${rowClass} ${isSelected ? 'selected-row' : ''}"
                            data-invoice="${t.invoiceId || ''}"
                            data-type="${t.type || 'بيع'}"
                            data-product="${safeProdName}"
                            onclick="selectAnalysisRow(this, '${t.invoiceId}', '${t.type}', '${safeProdName}')"
                            ondblclick="viewInvoiceItems('${t.invoiceId}', '${t.type}')">
                            <td style="text-align:center;">
                                <div class="an-radio-circle" title="تحديد الفاتورة"></div>
                            </td>
                            <td style="font-weight:900; color:#64748b;">${idx + 1}</td>
                            <td style="white-space:nowrap;">
                                <div style="font-weight:800; color:#1e293b;">${t.dateISO || '-'}</div>
                                <div style="font-size:0.75rem; color:#94a3b8;">${t.timeISO || '-'}</div>
                            </td>
                            <td style="font-weight:900; color:#4f46e5;">
                                <span style="background:#eef2ff; padding:3px 8px; border-radius:6px; font-size:0.85rem;">#${t.invoiceId || '-'}</span>
                            </td>
                            <td>${typeBadge}</td>
                            <td style="font-weight:800; color:#334155;">${t.partner || 'عميل نقدي'}</td>
                            <td>
                                <div style="font-weight:900; color:#1e293b;">${isReturn ? '↩️ ' : ''}${t.product}</div>
                                ${(t.size || t.color) ? `<div style="font-size:0.75rem; color:#6366f1; font-weight:bold; margin-top:2px;">${t.size ? `[مقاس: ${t.size}] ` : ''}${t.color ? `(لون: ${t.color})` : ''}</div>` : ''}
                            </td>
                            <td style="font-weight:900; text-align:center; color:${isReturn ? '#ef4444' : '#1e293b'};">
                                ${isReturn ? '-' : ''}${qty} <small style="color:#64748b; font-weight:normal;">${t.unit || 'قطعة'}</small>
                            </td>
                            <td style="font-weight:800;">${price.toFixed(2)}</td>
                            <td style="color:#64748b; font-weight:600;">${unitCost.toFixed(2)}</td>
                            <td class="profit-col" style="color:${profitColor}; font-weight:900; font-size:0.95rem;">
                                ${isReturn ? '-' : (displayProfit >= 0 ? '+' : '')}${displayProfit.toFixed(2)}
                            </td>
                            <td class="profit-col" style="font-weight:800; color:#4f46e5;">${profitMargin}%</td>
                            <td class="profit-col" style="color:#64748b; font-weight:600;">${profitShare}%</td>
                        </tr>
                    `);
                });

                if (hasMore) {
                    rowsHtml.push(`
                        <tr>
                            <td colspan="13" style="text-align:center; padding:15px; background:#f8fafc; border-top:1px solid #e2e8f0;">
                                <button type="button" class="tool-btn" style="padding:8px 24px; font-size:0.95rem; font-weight:bold; background:#4f46e5; color:white; border-radius:10px; border:none; cursor:pointer; box-shadow:0 2px 6px rgba(79,70,229,0.3);" onclick="window.analysisRenderLimit = (window.analysisRenderLimit || 150) + 150; renderAnalysisTable();">
                                    ⬇️ عرض المزيد (+150 حركة) - معروض ${displayedData.length} من أصل ${totalMatching}
                                </button>
                            </td>
                        </tr>
                    `);
                }
            } else {
                // 9. بناء الجدول - النمط التجميعي (Summary Mode)
                const groups = {};
                data.forEach(t => {
                    const isReturn = t.type && t.type.includes('مرتجع');
                    const prodName = t.product || 'صنف غير محدد';
                    if (!groups[prodName]) {
                        groups[prodName] = {
                            name: prodName,
                            qty: 0,
                            salesQty: 0,
                            returnQty: 0,
                            totalSales: 0,
                            totalReturns: 0,
                            netTotal: 0,
                            profit: 0,
                            cost: 0,
                            unit: t.unit || 'قطعة',
                            latestInvoiceId: t.invoiceId || '',
                            latestInvoiceType: t.type || 'بيع'
                        };
                    } else if (t.invoiceId) {
                        groups[prodName].latestInvoiceId = t.invoiceId;
                        groups[prodName].latestInvoiceType = t.type || 'بيع';
                    }

                    const qty = Math.abs(parseFloat(t.qty) || 0);
                    const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                    const lineProfit = getTransactionReliableProfit(t);
                    const lineCost = Math.max(0, total - lineProfit);

                    if (isReturn) {
                        groups[prodName].qty -= qty;
                        groups[prodName].returnQty += qty;
                        groups[prodName].totalReturns += total;
                        groups[prodName].netTotal -= total;
                        groups[prodName].profit -= lineProfit;
                        groups[prodName].cost -= lineCost;
                    } else {
                        groups[prodName].qty += qty;
                        groups[prodName].salesQty += qty;
                        groups[prodName].totalSales += total;
                        groups[prodName].netTotal += total;
                        groups[prodName].profit += lineProfit;
                        groups[prodName].cost += lineCost;
                    }
                });

                const sortedGroups = Object.values(groups).sort((a, b) => b.netTotal - a.netTotal);
                const totalGroups = sortedGroups.length;
                const gLimit = window.analysisGroupsLimit || 250;
                const displayedGroups = sortedGroups.slice(0, gLimit);
                const hasMoreGroups = totalGroups > displayedGroups.length;

                displayedGroups.forEach((g, idx) => {
                    const avgPrice = g.qty !== 0 ? g.netTotal / g.qty : 0;
                    const avgCost = g.qty !== 0 ? g.cost / g.qty : 0;
                    const profitMargin = g.netTotal > 0 ? ((g.profit / g.netTotal) * 100).toFixed(1) : '0.0';
                    const profitShare = totalPeriodSales > 0 ? ((g.netTotal / totalPeriodSales) * 100).toFixed(1) : '0.0';
                    const isLoss = g.profit < 0;

                    const isSelected = idx === 0;
                    const safeProdName = (g.name || '').replace(/'/g, "\\'");
                    if (isSelected) {
                        window.selectedAnalysisInvoice = {
                            id: g.latestInvoiceId || null,
                            type: g.latestInvoiceType || 'بيع',
                            product: g.name
                        };
                    }

                    rowsHtml.push(`
                        <tr class="an-row ${isLoss ? 'loss-row' : ''} ${isSelected ? 'selected-row' : ''}"
                            data-invoice="${g.latestInvoiceId || ''}"
                            data-type="${g.latestInvoiceType || 'بيع'}"
                            data-product="${safeProdName}"
                            onclick="selectAnalysisRow(this, '${g.latestInvoiceId || ''}', '${g.latestInvoiceType || 'بيع'}', '${safeProdName}')"
                            ondblclick="viewSelectedAnalysisInvoice()">
                            <td style="text-align:center;"><div class="an-radio-circle" title="تحديد الصنف"></div></td>
                            <td style="font-weight:900; color:#64748b;">${idx + 1}</td>
                            <td style="color:#64748b;">-</td>
                            <td style="font-weight:800; color:#4f46e5;">${g.latestInvoiceId ? `<span style="background:#eef2ff; padding:2px 6px; border-radius:4px; font-size:0.8rem;">#${g.latestInvoiceId}</span>` : '-'}</td>
                            <td><span style="background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:6px; font-weight:bold; font-size:0.8rem;">📦 تجميعي</span></td>
                            <td style="color:#64748b;">-</td>
                            <td style="font-weight:900; color:#1e293b; font-size:0.95rem;">📦 ${g.name}</td>
                            <td style="font-weight:900; text-align:center; color:#1e293b;">
                                ${g.qty} <small style="color:#64748b; font-weight:normal;">${g.unit}</small>
                                ${g.returnQty > 0 ? `<div style="font-size:0.72rem; color:#ef4444; font-weight:bold;">(-${g.returnQty} مرتجع)</div>` : ''}
                            </td>
                            <td style="font-weight:800;">${avgPrice.toFixed(2)}</td>
                            <td style="color:#64748b; font-weight:600;">${avgCost.toFixed(2)}</td>
                            <td class="profit-col" style="color:${isLoss ? '#ef4444' : '#10b981'}; font-weight:900; font-size:1rem;">
                                ${g.profit >= 0 ? '+' : ''}${g.profit.toFixed(2)}
                            </td>
                            <td class="profit-col" style="font-weight:800; color:#4f46e5;">${profitMargin}%</td>
                            <td class="profit-col" style="color:#64748b; font-weight:600;">${profitShare}%</td>
                        </tr>
                    `);
                });

                if (hasMoreGroups) {
                    rowsHtml.push(`
                        <tr>
                            <td colspan="13" style="text-align:center; padding:15px; background:#f8fafc; border-top:1px solid #e2e8f0;">
                                <button type="button" class="tool-btn" style="padding:8px 24px; font-size:0.95rem; font-weight:bold; background:#4f46e5; color:white; border-radius:10px; border:none; cursor:pointer; box-shadow:0 2px 6px rgba(79,70,229,0.3);" onclick="window.analysisGroupsLimit = (window.analysisGroupsLimit || 250) + 250; renderAnalysisTable();">
                                    ⬇️ عرض المزيد (+250 صنف) - معروض ${displayedGroups.length} من أصل ${totalGroups}
                                </button>
                            </td>
                        </tr>
                    `);
                }
            }

            // إدراج الجدول دفعة واحدة لسرعة قصوى وأداء صاروخي
            tbody.innerHTML = rowsHtml.join('');
            applyAnalysisColumnVisibility();
        }
        window.renderAnalysisTable = renderAnalysisTable;

        // --- 1. تقرير كبار العملاء ومسحوباتهم ومديونياتهم التنازلية ---
        function renderCustomerAnalysisReport(data, totalPeriodSales) {
            const tbody = document.getElementById('analysisTableBody');
            if (!tbody) return;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:35px; font-weight:bold; color:#64748b;">لا توجد حركات بيع للعملاء في الفترة المحددة 🔍</td></tr>';
                return;
            }

            const custGroups = {};
            const invoiceTracker = new Set();

            data.forEach(t => {
                const partner = t.partner || 'عميل نقدي';
                const isReturn = t.type && t.type.includes('مرتجع');
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                const profit = getTransactionReliableProfit(t);

                if (!custGroups[partner]) {
                    custGroups[partner] = {
                        name: partner,
                        grossPurchases: 0,
                        totalReturns: 0,
                        netPurchases: 0,
                        totalQty: 0,
                        profit: 0,
                        invoices: new Set(),
                        paid: 0,
                        remaining: 0,
                        products: {},
                        lastDate: t.dateISO || '-',
                        latestInvoiceId: t.invoiceId || '',
                        latestType: t.type || 'بيع'
                    };
                } else if (t.invoiceId) {
                    custGroups[partner].latestInvoiceId = t.invoiceId;
                    custGroups[partner].latestType = t.type || 'بيع';
                }

                if (isReturn) {
                    custGroups[partner].totalReturns += total;
                    custGroups[partner].netPurchases -= total;
                    custGroups[partner].totalQty -= qty;
                    custGroups[partner].profit -= profit;
                } else {
                    custGroups[partner].grossPurchases += total;
                    custGroups[partner].netPurchases += total;
                    custGroups[partner].totalQty += qty;
                    custGroups[partner].profit += profit;
                }

                if (t.invoiceId && t.invoiceId !== '-') {
                    custGroups[partner].invoices.add(t.invoiceId);
                    
                    if (t.isInvoiceHead || !invoiceTracker.has(t.invoiceId)) {
                        invoiceTracker.add(t.invoiceId);
                        const invTotal = parseFloat(t.invoiceGrandTotal) || total;
                        const paid = parseFloat(t.paidAmount);
                        if (!isNaN(paid) && paid > 0) {
                            custGroups[partner].paid += paid;
                            const rem = Math.max(0, invTotal - paid);
                            custGroups[partner].remaining += rem;
                        } else {
                            if (t.method && (t.method.includes('آجل') || t.method.includes('اجل') || t.method.includes('ذمم'))) {
                                custGroups[partner].remaining += invTotal;
                            } else {
                                custGroups[partner].paid += invTotal;
                            }
                        }
                    }
                }

                if (t.product) {
                    custGroups[partner].products[t.product] = (custGroups[partner].products[t.product] || 0) + qty;
                }
                if (t.dateISO && t.dateISO > custGroups[partner].lastDate) {
                    custGroups[partner].lastDate = t.dateISO;
                }
            });

            // ترتيب العملاء تنازلياً من الأكثر سحباً للأقل سحباً
            const sortedCustomers = Object.values(custGroups).sort((a, b) => b.netPurchases - a.netPurchases);

            const rowsHtml = [];
            sortedCustomers.forEach((c, idx) => {
                const isSelected = idx === 0;
                const safeCustName = (c.name || '').replace(/'/g, "\\'");
                if (isSelected) {
                    window.selectedAnalysisInvoice = {
                        id: c.latestInvoiceId || null,
                        type: c.latestType || 'بيع',
                        product: safeCustName
                    };
                }

                // أكثر صنفين طلباً للعميل
                const topProdsList = Object.keys(c.products).sort((x, y) => c.products[y] - c.products[x]);
                const displayTopProds = topProdsList.length > 2 
                    ? topProdsList.slice(0, 2).join(' + ') + ` (+${topProdsList.length - 2} أصناف)`
                    : (topProdsList.join(' + ') || 'متنوع');

                const share = (totalPeriodSales > 0 && c.netPurchases > 0) ? ((c.netPurchases / totalPeriodSales) * 100).toFixed(1) : '0.0';
                const invCount = c.invoices.size || 1;

                // تمييز ترتيب المراكز الأولى ببادجات احترافية
                let rankBadge = `<span style="font-weight:900; color:#64748b;">${idx + 1}</span>`;
                if (idx === 0) rankBadge = `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">🥇 الأول</span>`;
                else if (idx === 1) rankBadge = `<span style="background:#f1f5f9; color:#334155; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">🥈 الثاني</span>`;
                else if (idx === 2) rankBadge = `<span style="background:#ffedd5; color:#c2410c; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">🥉 الثالث</span>`;

                const hasRemaining = c.remaining > 0;

                rowsHtml.push(`
                    <tr class="an-row ${isSelected ? 'selected-row' : ''}"
                        data-invoice="${c.latestInvoiceId || ''}"
                        data-type="${c.latestType || 'بيع'}"
                        data-product="${safeCustName}"
                        onclick="selectAnalysisRow(this, '${c.latestInvoiceId || ''}', '${c.latestType || 'بيع'}', '${safeCustName}')"
                        ondblclick="filterAndShowCustomerInvoices('${safeCustName}')"
                        title="انقر نقراً مزدوجاً للانتقال فوراً لكافة فواتير هذا العميل">
                        <td style="text-align:center;"><div class="an-radio-circle" title="تحديد"></div></td>
                        <td style="text-align:center;">${rankBadge}</td>
                        <td style="white-space:nowrap; font-weight:bold; color:#1e293b;">${c.lastDate}</td>
                        <td style="font-weight:800; color:#4f46e5;">
                            ${c.latestInvoiceId ? `<span style="background:#eef2ff; padding:2px 6px; border-radius:4px; font-size:0.8rem;">#${c.latestInvoiceId}</span>` : '-'}
                        </td>
                        <td>
                            <span style="background:${idx < 3 ? '#ecfdf5' : '#f8fafc'}; color:${idx < 3 ? '#047857' : '#475569'}; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">
                                ${idx === 0 ? '👑 عميل VIP' : (idx < 5 ? '⭐ عميل مميز' : '👤 عميل')}
                            </span>
                        </td>
                        <td style="font-weight:900; color:#1e293b; font-size:0.92rem;">👤 ${c.name}</td>
                        <td style="font-weight:700; color:#4338ca; font-size:0.85rem;" title="${displayTopProds}">📦 ${displayTopProds}</td>
                        <td style="font-weight:900; text-align:center; color:#1e293b;">${c.totalQty} قطعة</td>
                        <td style="font-weight:900; color:#059669; font-size:0.95rem;">${c.netPurchases.toFixed(2)}</td>
                        <td style="font-weight:800; color:#2563eb;">${c.paid.toFixed(2)}</td>
                        <td style="font-weight:900; color:${hasRemaining ? '#ef4444' : '#64748b'};">
                            ${hasRemaining ? `<span style="background:#fee2e2; padding:2px 6px; border-radius:4px;">${c.remaining.toFixed(2)} (آجل)</span>` : '0.00'}
                        </td>
                        <td class="profit-col" style="font-weight:900; color:#10b981;">+${c.profit.toFixed(2)}</td>
                        <td class="profit-col" style="font-weight:800; color:#4f46e5;">${share}% (${invCount} فاتورة)</td>
                    </tr>
                `);
            });

            tbody.innerHTML = rowsHtml.join('');
            applyAnalysisColumnVisibility();
        }
        window.renderCustomerAnalysisReport = renderCustomerAnalysisReport;

        // دالة انتقال سريعة لفواتير العميل عند النقر المزدوج
        function filterAndShowCustomerInvoices(customerName) {
            const searchInput = document.getElementById('anSearchInput');
            if (searchInput) {
                searchInput.value = customerName;
                const clearBtn = document.getElementById('anSearchClearBtn');
                if (clearBtn) clearBtn.style.display = 'flex';
                setAnalysisMode('detailed');
                if (typeof showToast === 'function') {
                    showToast(`🔍 تم الانتقال لفواتير العميل: ${customerName}`);
                }
            }
        }
        window.filterAndShowCustomerInvoices = filterAndShowCustomerInvoices;

        // --- 2. تقرير تصنيفات البضاعة والأصناف ---
        function renderCategoryAnalysisReport(data, totalPeriodSales) {
            const tbody = document.getElementById('analysisTableBody');
            if (!tbody) return;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:35px; font-weight:bold; color:#64748b;">لا توجد مبيعات للتصنيفات في الفترة المحددة 🔍</td></tr>';
                return;
            }

            const catGroups = {};

            data.forEach(t => {
                const isReturn = t.type && t.type.includes('مرتجع');
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                const profit = getTransactionReliableProfit(t);
                const cost = Math.max(0, total - profit);

                const prod = getReportsProductQuick(t.product) || getReportsProductQuick(t.productId) || getReportsProductQuick(t.barcode);
                const catName = (prod && prod.category && prod.category.trim()) ? prod.category.trim() : 'عام / غير مصنف';

                if (!catGroups[catName]) {
                    catGroups[catName] = {
                        name: catName,
                        qty: 0,
                        totalSales: 0,
                        cost: 0,
                        profit: 0,
                        products: new Set(),
                        invoices: new Set(),
                        latestInvoiceId: t.invoiceId || '',
                        latestType: t.type || 'بيع'
                    };
                } else if (t.invoiceId) {
                    catGroups[catName].latestInvoiceId = t.invoiceId;
                    catGroups[catName].latestType = t.type || 'بيع';
                }

                if (isReturn) {
                    catGroups[catName].qty -= qty;
                    catGroups[catName].totalSales -= total;
                    catGroups[catName].cost -= cost;
                    catGroups[catName].profit -= profit;
                } else {
                    catGroups[catName].qty += qty;
                    catGroups[catName].totalSales += total;
                    catGroups[catName].cost += cost;
                    catGroups[catName].profit += profit;
                }

                if (t.product) catGroups[catName].products.add(t.product);
                if (t.invoiceId) catGroups[catName].invoices.add(t.invoiceId);
            });

            // ترتيب التصنيفات تنازلياً حسب إجمالي المبيعات
            const sortedCategories = Object.values(catGroups).sort((a, b) => b.totalSales - a.totalSales);

            const rowsHtml = [];
            sortedCategories.forEach((cat, idx) => {
                const isSelected = idx === 0;
                const safeCatName = (cat.name || '').replace(/'/g, "\\'");
                if (isSelected) {
                    window.selectedAnalysisInvoice = {
                        id: cat.latestInvoiceId || null,
                        type: cat.latestType || 'بيع',
                        product: safeCatName
                    };
                }

                const margin = (cat.totalSales > 0) ? ((cat.profit / cat.totalSales) * 100).toFixed(1) : '0.0';
                const share = (totalPeriodSales > 0 && cat.totalSales > 0) ? ((cat.totalSales / totalPeriodSales) * 100).toFixed(1) : '0.0';

                rowsHtml.push(`
                    <tr class="an-row ${isSelected ? 'selected-row' : ''}"
                        data-invoice="${cat.latestInvoiceId || ''}"
                        data-type="${cat.latestType || 'بيع'}"
                        data-product="${safeCatName}"
                        onclick="selectAnalysisRow(this, '${cat.latestInvoiceId || ''}', '${cat.latestType || 'بيع'}', '${safeCatName}')"
                        ondblclick="filterAndShowCategorySales('${safeCatName}')"
                        title="انقر نقراً مزدوجاً لتصفية المبيعات بهذا التصنيف">
                        <td style="text-align:center;"><div class="an-radio-circle" title="تحديد"></div></td>
                        <td style="font-weight:900; color:#64748b;">${idx + 1}</td>
                        <td style="color:#64748b;">-</td>
                        <td style="font-weight:800; color:#4f46e5;">
                            ${cat.latestInvoiceId ? `<span style="background:#eef2ff; padding:2px 6px; border-radius:4px; font-size:0.8rem;">#${cat.latestInvoiceId}</span>` : '-'}
                        </td>
                        <td><span style="background:#ede9fe; color:#6d28d9; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">🏷️ تصنيف</span></td>
                        <td style="font-weight:800; color:#475569;">${cat.products.size} أصناف بالتصنيف</td>
                        <td style="font-weight:900; color:#1e293b; font-size:0.95rem;">📦 ${cat.name}</td>
                        <td style="font-weight:900; text-align:center; color:#1e293b;">${cat.qty} قطعة</td>
                        <td style="font-weight:900; color:#059669; font-size:0.95rem;">${cat.totalSales.toFixed(2)}</td>
                        <td style="color:#64748b; font-weight:600;">${cat.cost.toFixed(2)}</td>
                        <td class="profit-col" style="color:#10b981; font-weight:900; font-size:1rem;">+${cat.profit.toFixed(2)}</td>
                        <td class="profit-col" style="font-weight:800; color:#4f46e5;">${margin}%</td>
                        <td class="profit-col" style="color:#64748b; font-weight:600;">${share}% (${cat.invoices.size} فاتورة)</td>
                    </tr>
                `);
            });

            tbody.innerHTML = rowsHtml.join('');
            applyAnalysisColumnVisibility();
        }
        window.renderCategoryAnalysisReport = renderCategoryAnalysisReport;

        // دالة تصفية سريعة بالتصنيف عند النقر المزدوج
        function filterAndShowCategorySales(categoryName) {
            const catSelect = document.getElementById('anCategory');
            if (catSelect) {
                catSelect.value = categoryName;
                setAnalysisMode('summary');
                if (typeof showToast === 'function') {
                    showToast(`📦 تم تصفية المبيعات بالتصنيف: ${categoryName}`);
                }
            }
        }
        window.filterAndShowCategorySales = filterAndShowCategorySales;

        // --- تخصيص أعمدة تحليل المبيعات ---
        var analysisColumnVisibility = JSON.parse((typeof getStore === 'function' ? getStore('pos_an_cols') : null) || '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true,"11":true,"12":true}');

        function toggleAnalysisColumn(index, isVisible) {
            analysisColumnVisibility[index] = isVisible;
            if (typeof setStore === 'function') {
                setStore('pos_an_cols', JSON.stringify(analysisColumnVisibility));
            }
            applyAnalysisColumnVisibility();
        }
        window.toggleAnalysisColumn = toggleAnalysisColumn;

        function applyAnalysisColumnVisibility() {
            const table = document.querySelector('#analysis-section .invoice-table');
            if (!table) return;

            const theadRows = table.querySelectorAll('thead th');
            const tbodyRows = table.querySelectorAll('tbody tr');

            theadRows.forEach((th, i) => {
                th.style.display = (analysisColumnVisibility[i] !== undefined) ? (analysisColumnVisibility[i] ? '' : 'none') : '';
            });

            tbodyRows.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                tds.forEach((td, i) => {
                    td.style.display = (analysisColumnVisibility[i] !== undefined) ? (analysisColumnVisibility[i] ? '' : 'none') : '';
                });
            });
        }
        window.applyAnalysisColumnVisibility = applyAnalysisColumnVisibility;

        function showAnalysisColumnCustomizer() {
            if (typeof checkColumnCustomizationPermission === 'function' && !checkColumnCustomizationPermission()) return;
            const cols = [
                { id: 0, name: "تحديد" },
                { id: 1, name: "#" },
                { id: 2, name: "التاريخ والوقت" },
                { id: 3, name: "رقم الفاتورة" },
                { id: 4, name: "نوع العملية" },
                { id: 5, name: "العميل" },
                { id: 6, name: "الصنف والمواصفات" },
                { id: 7, name: "الكمية" },
                { id: 8, name: "سعر البيع" },
                { id: 9, name: "التكلفة" },
                { id: 10, name: "صافي الربح" },
                { id: 11, name: "% لهامش الربح" },
                { id: 12, name: "% لمبيعات الفترة" }
            ];

            let html = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; padding:15px 0;">`;
            cols.forEach(c => {
                const checked = analysisColumnVisibility[c.id] ? 'checked' : '';
                html += `<label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:8px 12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; font-size:0.88rem; font-weight:bold; color:#334155; transition: 0.2s;" onmouseover="this.style.background='#f1f5f9';" onmouseout="this.style.background='#f8fafc';">
                            <input type="checkbox" ${checked} onchange="toggleAnalysisColumn(${c.id}, this.checked)" style="width:16px; height:16px; accent-color:#4f46e5; cursor:pointer;"> ${c.name}
                         </label>`;
            });
            html += `</div>`;

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); z-index: 12000; display: flex; align-items: center; justify-content: center; direction: rtl; font-family: 'Cairo', sans-serif;`;
            modal.innerHTML = `
                <div style="background: white; width: 440px; max-width: 90%; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.4); padding: 22px; display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">
                        <h3 style="margin:0; font-size:1.1rem; font-weight:900; color:#1e293b; display:flex; align-items:center; gap:8px;">⚙️ تخصيص أعمدة التحليل</h3>
                        <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:#94a3b8; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%;">&times;</button>
                    </div>
                    ${html}
                    <button style="width:100%; height:40px; background:linear-gradient(135deg, #4f46e5, #4338ca); color:white; border:none; border-radius:10px; font-weight:900; font-size:0.9rem; cursor:pointer; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);" onclick="this.closest('.modal-overlay').remove()">حفظ وإغلاق</button>
                </div>
            `;
            document.body.appendChild(modal);
        }
        window.showAnalysisColumnCustomizer = showAnalysisColumnCustomizer;

        function viewSelectedAnalysisInvoice() {
            let invoiceId = '';
            let type = 'بيع';

            // 1. فحص الكائن العالمي المسجل عند اختيار الصف
            if (window.selectedAnalysisInvoice && window.selectedAnalysisInvoice.id) {
                invoiceId = window.selectedAnalysisInvoice.id;
                type = window.selectedAnalysisInvoice.type || 'بيع';
            }

            // 2. إذا لم يكن مسجلاً، فحص الصف النشط بصرياً في الجدول
            if (!invoiceId) {
                const selectedRow = document.querySelector('#analysisTableBody tr.selected-row');
                if (selectedRow) {
                    invoiceId = selectedRow.getAttribute('data-invoice');
                    type = selectedRow.getAttribute('data-type') || 'بيع';
                }
            }

            // 3. التحديد التلقائي للصف الأول كحل ذكي وسريع إذا لم يحدد المستخدم أي صف بعد
            if (!invoiceId) {
                const firstRow = document.querySelector('#analysisTableBody tr.an-row');
                if (firstRow) {
                    firstRow.click();
                    if (window.selectedAnalysisInvoice && window.selectedAnalysisInvoice.id) {
                        invoiceId = window.selectedAnalysisInvoice.id;
                        type = window.selectedAnalysisInvoice.type || 'بيع';
                    }
                }
            }

            // 4. فتح الفاتورة إذا كان المعرف صالحاً
            if (invoiceId && invoiceId !== '-' && invoiceId !== 'undefined' && typeof viewInvoiceItems === 'function') {
                viewInvoiceItems(invoiceId, type);
            } else {
                // إذا كنا في النمط التجميعي ولم توجد فاتورة، ننتقل للنمط التفصيلي المفلتر بهذا الصنف لتسهيل الوصول للفواتير
                if (currentAnalysisMode === 'summary' && window.selectedAnalysisInvoice && window.selectedAnalysisInvoice.product) {
                    const searchInput = document.getElementById('anSearchInput');
                    if (searchInput) {
                        searchInput.value = window.selectedAnalysisInvoice.product;
                        const clearBtn = document.getElementById('anSearchClearBtn');
                        if (clearBtn) clearBtn.style.display = 'flex';
                        setAnalysisMode('detailed');
                        if (typeof showToast === 'function') {
                            showToast(`🔍 تم الانتقال للفواتير التفصيلية للصنف: ${window.selectedAnalysisInvoice.product}`);
                        }
                        return;
                    }
                }

                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({ type: 'warning', titleText: '⚠️ تنبيه', msg: 'يرجى اختيار وتحديد فاتورة من الجدول أولاً لعرض تفاصيلها.' });
                } else {
                    alert('يرجى اختيار وتحديد فاتورة من الجدول أولاً.');
                }
            }
        }
        window.viewSelectedAnalysisInvoice = viewSelectedAnalysisInvoice;

        async function applyAnalysisPeriodFilter(period) {
            window.analysisRenderLimit = 150;
            window.analysisGroupsLimit = 250;
            const fromInput = document.getElementById('anDateFrom');
            const toInput = document.getElementById('anDateTo');
            const customContainer = document.getElementById('anCustomDates');

            const today = new Date();
            const todayStr = today.toLocaleDateString('en-CA');

            if (period === 'custom') {
                if (customContainer) {
                    customContainer.style.background = '#e0e7ff';
                    customContainer.style.borderColor = '#6366f1';
                }
                if (fromInput) fromInput.focus();
                return;
            } else {
                if (customContainer) {
                    customContainer.style.background = '#f1f5f9';
                    customContainer.style.borderColor = '#e2e8f0';
                }
            }

            if (period === 'today') {
                fromInput.value = todayStr;
                toInput.value = todayStr;
            } else if (period === 'yesterday') {
                const yest = new Date();
                yest.setDate(yest.getDate() - 1);
                fromInput.value = yest.toLocaleDateString('en-CA');
                toInput.value = yest.toLocaleDateString('en-CA');
            } else if (period === 'thisweek') {
                const day = today.getDay();
                const start = new Date(today);
                start.setDate(today.getDate() - day);
                fromInput.value = start.toLocaleDateString('en-CA');
                toInput.value = todayStr;
            } else if (period === 'lastweek') {
                const day = today.getDay();
                const start = new Date(today);
                start.setDate(today.getDate() - day - 7);
                const end = new Date(today);
                end.setDate(today.getDate() - day - 1);
                fromInput.value = start.toLocaleDateString('en-CA');
                toInput.value = end.toLocaleDateString('en-CA');
            } else if (period === 'thismonth') {
                const first = new Date(today.getFullYear(), today.getMonth(), 1);
                fromInput.value = first.toLocaleDateString('en-CA');
                toInput.value = todayStr;
            } else if (period === 'lastmonth') {
                const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const last = new Date(today.getFullYear(), today.getMonth(), 0);
                fromInput.value = first.toLocaleDateString('en-CA');
                toInput.value = last.toLocaleDateString('en-CA');
            } else if (period === 'thisyear') {
                const first = new Date(today.getFullYear(), 0, 1);
                fromInput.value = first.toLocaleDateString('en-CA');
                toInput.value = todayStr;
            } else if (period === 'lastyear') {
                const first = new Date(today.getFullYear() - 1, 0, 1);
                const last = new Date(today.getFullYear() - 1, 11, 31);
                fromInput.value = first.toLocaleDateString('en-CA');
                toInput.value = last.toLocaleDateString('en-CA');
            } else if (period === 'all') {
                fromInput.value = '';
                toInput.value = '';
            }

            if (typeof window.loadTransactionsForDateRange === 'function' && (fromInput.value || toInput.value)) {
                await window.loadTransactionsForDateRange(fromInput.value, toInput.value);
            }

            renderAnalysisTable();
            if (typeof saveCurrentTabState === 'function') saveCurrentTabState();
        }
        window.applyAnalysisPeriodFilter = applyAnalysisPeriodFilter;

        // تصدير فائق واحترافي لملفات Excel (.xlsx) عبر SheetJS
        function exportAnalysisToExcel() {
            try {
                if (typeof XLSX === 'undefined') {
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({ type: 'warning', titleText: '⚠️ تنبيه', msg: 'مكتبة Excel غير محملة.' });
                    } else {
                        alert('مكتبة Excel غير محملة.');
                    }
                    return;
                }

                const table = document.querySelector('#analysis-section .invoice-table');
                if (!table) return;

                const rows = table.querySelectorAll('tbody tr');
                if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.includes('لا توجد'))) {
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({ type: 'warning', titleText: '⚠️ تنبيه', msg: 'لا توجد بيانات متاحة للتصدير في هذه الفترة.' });
                    } else {
                        alert('لا توجد بيانات متاحة للتصدير في هذه الفترة.');
                    }
                    return;
                }

                const exportData = [];
                const isDetailed = (currentAnalysisMode === 'detailed');
                const isReturns = (currentAnalysisMode === 'returns');
                const isCustomers = (currentAnalysisMode === 'customers');
                const isCategories = (currentAnalysisMode === 'categories');

                rows.forEach((r, idx) => {
                    const cells = r.querySelectorAll('td');
                    if (cells.length < 10) return;

                    if (isDetailed) {
                        exportData.push({
                            '#': cells[1]?.innerText?.trim() || (idx + 1),
                            'التاريخ والوقت': cells[2]?.innerText?.trim() || '-',
                            'رقم الفاتورة': cells[3]?.innerText?.trim() || '-',
                            'نوع العملية': cells[4]?.innerText?.trim() || '-',
                            'العميل': cells[5]?.innerText?.trim() || '-',
                            'الصنف والمواصفات': cells[6]?.innerText?.replace(/\n/g, ' ')?.trim() || '-',
                            'الكمية': cells[7]?.innerText?.trim() || '0',
                            'سعر البيع': cells[8]?.innerText?.trim() || '0',
                            'التكلفة': cells[9]?.innerText?.trim() || '0',
                            'صافي الربح': cells[10]?.innerText?.trim() || '0',
                            'هامش الربح %': cells[11]?.innerText?.trim() || '0%',
                            '% لمبيعات الفترة': cells[12]?.innerText?.trim() || '0%'
                        });
                    } else if (isCustomers) {
                        exportData.push({
                            '# الترتيب': cells[1]?.innerText?.trim() || (idx + 1),
                            'آخر حركة': cells[2]?.innerText?.trim() || '-',
                            'أحدث فاتورة': cells[3]?.innerText?.trim() || '-',
                            'فئة العميل': cells[4]?.innerText?.trim() || '-',
                            'اسم العميل': cells[5]?.innerText?.trim() || '-',
                            'الأصناف الأكثر طلباً': cells[6]?.innerText?.replace(/\n/g, ' ')?.trim() || '-',
                            'إجمالي القطع': cells[7]?.innerText?.trim() || '0',
                            'إجمالي المسحوبات': cells[8]?.innerText?.trim() || '0',
                            'المدفوع': cells[9]?.innerText?.trim() || '0',
                            'المتبقي (الآجل)': cells[10]?.innerText?.trim() || '0',
                            'صافي الربح': cells[11]?.innerText?.trim() || '0',
                            '% من المبيعات': cells[12]?.innerText?.trim() || '0%'
                        });
                    } else if (isCategories) {
                        exportData.push({
                            '#': cells[1]?.innerText?.trim() || (idx + 1),
                            'التصنيف': cells[6]?.innerText?.replace(/\n/g, ' ')?.trim() || '-',
                            'عدد الأصناف': cells[5]?.innerText?.trim() || '-',
                            'إجمالي القطع المباعة': cells[7]?.innerText?.trim() || '0',
                            'إجمالي المبيعات': cells[8]?.innerText?.trim() || '0',
                            'التكلفة': cells[9]?.innerText?.trim() || '0',
                            'صافي الربح': cells[10]?.innerText?.trim() || '0',
                            'هامش الربح %': cells[11]?.innerText?.trim() || '0%',
                            '% لمبيعات الفترة': cells[12]?.innerText?.trim() || '0%'
                        });
                    } else if (isReturns) {
                        exportData.push({
                            '#': cells[1]?.innerText?.trim() || (idx + 1),
                            'التاريخ': cells[2]?.innerText?.trim() || '-',
                            'نوع العملية': cells[4]?.innerText?.trim() || '-',
                            'العميل': cells[5]?.innerText?.trim() || '-',
                            'الأصناف المرتجعة': cells[6]?.innerText?.trim() || '-',
                            'الكمية المرتجعة': cells[7]?.innerText?.trim() || '0',
                            'قيمة المرتجع': cells[8]?.innerText?.trim() || '0',
                            'الربح المفقود': cells[10]?.innerText?.trim() || '0',
                            'نسبة المرتجع %': cells[11]?.innerText?.trim() || '0%',
                            'عدد الفواتير': cells[12]?.innerText?.trim() || '0'
                        });
                    } else {
                        exportData.push({
                            '#': cells[1]?.innerText?.trim() || (idx + 1),
                            'الصنف': cells[6]?.innerText?.replace(/\n/g, ' ')?.trim() || '-',
                            'صافي الكمية': cells[7]?.innerText?.trim() || '0',
                            'متوسط سعر البيع': cells[8]?.innerText?.trim() || '0',
                            'متوسط التكلفة': cells[9]?.innerText?.trim() || '0',
                            'صافي الربح': cells[10]?.innerText?.trim() || '0',
                            'هامش الربح %': cells[11]?.innerText?.trim() || '0%',
                            '% لمبيعات الفترة': cells[12]?.innerText?.trim() || '0%'
                        });
                    }
                });

                const ws = XLSX.utils.json_to_sheet(exportData);
                ws['!dir'] = 'rtl';
                const wb = XLSX.utils.book_new();
                const sheetTitle = isCustomers ? "تحليل كبار العملاء" : (isCategories ? "تحليل التصنيفات" : (isReturns ? "تقرير المرتجعات" : (isDetailed ? "تحليل مبيعات تفصيلي" : "تحليل مبيعات تجميعي")));
                XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

                const dateStr = new Date().toISOString().slice(0, 10);
                XLSX.writeFile(wb, `Bayan_POS_Sales_Analysis_${currentAnalysisMode}_${dateStr}.xlsx`);
                if (typeof showToast === 'function') {
                    showToast("✅ تم تصدير تقرير تحليل المبيعات إلى Excel بنجاح!");
                }
            } catch (err) {
                console.error("Export analysis error:", err);
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({ type: 'error', titleText: 'خطأ في التصدير', msg: err.message });
                }
            }
        }
        window.exportAnalysisToExcel = exportAnalysisToExcel;

        // طباعة تقرير تحليل المبيعات بتنسيق احترافي
        function printAnalysisReport() {
            try {
                let receiptArea = document.getElementById('receipt-area');
                if (!receiptArea) {
                    receiptArea = document.createElement('div');
                    receiptArea.id = 'receipt-area';
                    document.body.appendChild(receiptArea);
                }

                const fromDate = document.getElementById('anDateFrom')?.value || 'بداية السجل';
                const toDate = document.getElementById('anDateTo')?.value || 'الآن';
                const totalSales = document.getElementById('kpi-total-sales')?.innerText || '0.00';
                const totalProfit = document.getElementById('kpi-total-profit')?.innerText || '0.00';
                const profitMargin = document.getElementById('kpi-profit-margin')?.innerText || '0.0%';
                const shopName = (typeof getStore === 'function' ? getStore('shop_name') : null) || document.getElementById('shopName')?.value || 'بيان POS';

                const table = document.querySelector('#analysis-section .invoice-table');
                if (!table) return;

                const printTable = table.cloneNode(true);
                printTable.querySelectorAll('tr').forEach(tr => {
                    const firstCell = tr.children[0];
                    if (firstCell) firstCell.remove(); // إخفاء عمود checkboxes أثناء الطباعة
                });

                let reportSubtitle = "📊 تقرير تحليل ومراقبة المبيعات";
                if (currentAnalysisMode === 'customers') reportSubtitle = "👑 تقرير كبار العملاء والمسحوبات والمديونيات";
                else if (currentAnalysisMode === 'categories') reportSubtitle = "🏷️ تقرير أداء ومبيعات التصنيفات";
                else if (currentAnalysisMode === 'returns') reportSubtitle = "🔄 تقرير تحليل المرتجعات والعملاء الأكثر إرجاعاً";
                else if (currentAnalysisMode === 'detailed') reportSubtitle = "📑 تقرير المبيعات التفصيلي بالفواتير";

                const headerHtml = `
                    <div style="direction:rtl; text-align:center; padding:15px; font-family:'Cairo',sans-serif; border-bottom:2px solid #1e293b; margin-bottom:15px;">
                        <h1 style="margin:0 0 5px 0; font-size:1.5rem; color:#1e293b;">${shopName}</h1>
                        <h2 style="margin:0 0 10px 0; font-size:1.2rem; color:#4f46e5;">${reportSubtitle}</h2>
                        <div style="display:flex; justify-content:center; gap:20px; font-size:0.9rem; color:#475569; margin-bottom:10px;">
                            <span>🗓️ الفترة: من <b>${fromDate}</b> إلى <b>${toDate}</b></span>
                            <span>🕒 تاريخ الطباعة: <b>${new Date().toLocaleString('ar-EG')}</b></span>
                        </div>
                        <div style="display:flex; justify-content:center; gap:25px; background:#f1f5f9; padding:8px; border-radius:8px; font-weight:bold; font-size:0.95rem;">
                            <span>💰 إجمالي المبيعات: <b style="color:#059669;">${totalSales} ج.م</b></span>
                            <span>📈 صافي الأرباح: <b style="color:#2563eb;">${totalProfit} ج.م</b></span>
                            <span>🎯 هامش الربح: <b style="color:#7c3aed;">${profitMargin}</b></span>
                        </div>
                    </div>
                `;

                receiptArea.innerHTML = `
                    <div class="print-container" style="direction:rtl; font-family:'Cairo',sans-serif; padding:10px;">
                        ${headerHtml}
                        <div style="overflow-x:auto;">
                            ${printTable.outerHTML}
                        </div>
                    </div>
                `;

                window.print();
            } catch (err) {
                console.error("Print analysis error:", err);
            }
        }
        window.printAnalysisReport = printAnalysisReport;

        // --- تقرير العملاء الأكثر إرجاعاً المطور والمحاذى بدقة ---
        async function renderMostReturningCustomers() {
            currentAnalysisMode = 'returns';

            const modeButtons = [
                { id: 'summary', el: document.getElementById('anModeSummaryBtn') },
                { id: 'detailed', el: document.getElementById('anModeDetailedBtn') },
                { id: 'customers', el: document.getElementById('anModeCustomerBtn') },
                { id: 'categories', el: document.getElementById('anModeCategoryBtn') },
                { id: 'returns', el: document.getElementById('anModeReturnBtn') }
            ];
            modeButtons.forEach(m => {
                if (m.el) {
                    const isActive = (m.id === 'returns');
                    m.el.className = isActive ? 'an-btn-mode active' : 'an-btn-mode';
                    m.el.style.background = isActive ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#f1f5f9';
                    m.el.style.color = isActive ? '#ffffff' : '#475569';
                    m.el.style.border = isActive ? 'none' : '1px solid #cbd5e1';
                }
            });

            const tbody = document.getElementById('analysisTableBody');
            if (!tbody) return;

            const fromDate = document.getElementById('anDateFrom')?.value;
            const toDate = document.getElementById('anDateTo')?.value;
            if (typeof window.loadTransactionsForDateRange === 'function' && (fromDate || toDate)) {
                await window.loadTransactionsForDateRange(fromDate, toDate);
            }
            const searchQuery = (document.getElementById('anSearchInput')?.value || '').trim().toLowerCase();

            let returns = (window.transactions || []).filter(t => t.type && t.type.includes('مرتجع بيع'));
            if (fromDate) returns = returns.filter(t => (t.dateISO || '') >= fromDate);
            if (toDate) returns = returns.filter(t => (t.dateISO || '') <= toDate);

            if (searchQuery) {
                returns = returns.filter(t => {
                    return (t.product || '').toLowerCase().includes(searchQuery) ||
                           (t.partner || '').toLowerCase().includes(searchQuery) ||
                           (t.invoiceId || '').toLowerCase().includes(searchQuery);
                });
            }

            const accFilter = document.getElementById('anAccount')?.value || 'all';
            const methodFilter = document.getElementById('anMethod')?.value || 'all';
            const catFilter = document.getElementById('anCategory')?.value || 'all';
            const whFilter = document.getElementById('anWarehouse')?.value || 'all';
            const userFilter = document.getElementById('anUser')?.value || 'all';

            if (accFilter !== 'all') returns = returns.filter(t => t.partner === accFilter);
            if (methodFilter !== 'all') {
                returns = returns.filter(t => {
                    const m = (t.method || '').toLowerCase();
                    const target = methodFilter.toLowerCase();
                    return m.includes(target) || target.includes(m);
                });
            }
            if (catFilter !== 'all') {
                returns = returns.filter(t => {
                    const prod = getReportsProductQuick(t.product) || getReportsProductQuick(t.productId) || getReportsProductQuick(t.barcode);
                    return prod && prod.category === catFilter;
                });
            }
            if (whFilter !== 'all') returns = returns.filter(t => t.warehouse === whFilter);
            if (userFilter !== 'all') returns = returns.filter(t => t.user === userFilter);

            if (returns.length === 0) {
                const salesCount = (window.transactions || []).filter(t => {
                    const isRet = t.type && t.type.includes('مرتجع');
                    if (isRet) return false;
                    if (fromDate && (t.dateISO || '') < fromDate) return false;
                    if (toDate && (t.dateISO || '') > toDate) return false;
                    return true;
                }).length;

                tbody.innerHTML = `
                    <tr>
                        <td colspan="13" style="text-align:center; padding:45px 20px; color:#475569;">
                            <div style="font-size:2.8rem; margin-bottom:10px;">🔄</div>
                            <div style="font-size:1.15rem; font-weight:900; color:#1e293b; margin-bottom:6px;">لا توجد أي عمليات إرجاع مسجلة في هذه الفترة</div>
                            <div style="font-size:0.85rem; color:#64748b; margin-bottom:18px;">سجل الفترة المحددة خالٍ تماماً من المرتجعات 👍</div>
                            <button onclick="setAnalysisMode('detailed')" style="background:linear-gradient(135deg, #4f46e5, #4338ca); color:white; border:none; padding:11px 24px; border-radius:10px; font-weight:900; font-size:0.92rem; cursor:pointer; box-shadow:0 4px 15px rgba(79,70,229,0.35); display:inline-flex; align-items:center; gap:8px; transition:0.2s;">
                                <span>📑</span> اضغط هنا للانتقال لعرض فواتير المبيعات (${salesCount} حركة بيع)
                            </button>
                        </td>
                    </tr>
                `;
                applyAnalysisColumnVisibility();
                setTimeout(() => {
                    const tableContainer = document.getElementById('analysisTableContainer');
                    if (tableContainer) {
                        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }, 80);
                return;
            }

            const groups = {};
            let totalAllReturnsAmount = 0;

            returns.forEach(t => {
                const partner = t.partner || 'عميل نقدي';
                const total = Math.abs(parseFloat(t.total) || 0);
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const profitLost = getTransactionReliableProfit(t);

                totalAllReturnsAmount += total;

                if (!groups[partner]) {
                    groups[partner] = {
                        name: partner,
                        count: 0,
                        totalQty: 0,
                        total: 0,
                        profitLost: 0,
                        products: new Set(),
                        lastDate: t.dateISO || '-',
                        latestInvoiceId: t.invoiceId || '',
                        latestType: t.type || 'مرتجع بيع'
                    };
                } else if (t.invoiceId) {
                    groups[partner].latestInvoiceId = t.invoiceId;
                    groups[partner].latestType = t.type || 'مرتجع بيع';
                }

                groups[partner].count++;
                groups[partner].totalQty += qty;
                groups[partner].total += total;
                groups[partner].profitLost += profitLost;
                if (t.product) groups[partner].products.add(t.product);
                if (t.dateISO) groups[partner].lastDate = t.dateISO;
            });

            const sorted = Object.values(groups).sort((a, b) => b.total - a.total);
            const rowsHtml = [];

            sorted.forEach((g, idx) => {
                const productList = Array.from(g.products);
                const displayProducts = productList.length > 2 
                    ? productList.slice(0, 2).join(' + ') + ` (+${productList.length - 2} أصناف)`
                    : (productList.join(' + ') || 'متنوع');

                const percentOfReturns = totalAllReturnsAmount > 0 ? ((g.total / totalAllReturnsAmount) * 100).toFixed(1) : '0.0';

                const isSelected = idx === 0;
                const safePartner = (g.name || '').replace(/'/g, "\\'");
                if (isSelected) {
                    window.selectedAnalysisInvoice = {
                        id: g.latestInvoiceId || null,
                        type: g.latestType || 'مرتجع بيع',
                        product: safePartner
                    };
                }

                // 13 خلية مضبوطة تماماً تحت الـ 13 عمود في الترويسة
                rowsHtml.push(`
                    <tr class="an-row return-row ${isSelected ? 'selected-row' : ''}" 
                        style="background-color:#fef2f2; border-right:4px solid #ef4444;"
                        data-invoice="${g.latestInvoiceId || ''}"
                        data-type="${g.latestType || 'مرتجع بيع'}"
                        data-product="${safePartner}"
                        onclick="selectAnalysisRow(this, '${g.latestInvoiceId || ''}', '${g.latestType || 'مرتجع بيع'}', '${safePartner}')"
                        ondblclick="viewSelectedAnalysisInvoice()">
                        <td style="text-align:center;"><div class="an-radio-circle" title="تحديد"></div></td>
                        <td style="font-weight:900; color:#64748b;">${idx + 1}</td>
                        <td style="font-weight:bold; color:#1e293b;">${g.lastDate}</td>
                        <td style="font-weight:800; color:#4f46e5;">${g.latestInvoiceId ? `<span style="background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; font-size:0.8rem;">#${g.latestInvoiceId}</span>` : '-'}</td>
                        <td><span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">🔄 مرتجع</span></td>
                        <td style="font-weight:800; color:#1e293b;">👤 ${g.name}</td>
                        <td style="font-weight:700; color:#4338ca;">${displayProducts}</td>
                        <td style="text-align:center; font-weight:900; color:#ef4444;">${g.totalQty} قطعة</td>
                        <td style="font-weight:800; color:#ef4444;">${g.total.toFixed(2)}</td>
                        <td style="color:#64748b;">-</td>
                        <td class="profit-col" style="color:#ef4444; font-weight:900;">-${g.profitLost.toFixed(2)}</td>
                        <td class="profit-col" style="font-weight:800; color:#b91c1c;">${percentOfReturns}%</td>
                        <td class="profit-col" style="font-weight:800; color:#475569;">${g.count} فواتير</td>
                    </tr>
                `);
            });

            tbody.innerHTML = rowsHtml.join('');
            applyAnalysisColumnVisibility();
            if (typeof showToast === 'function') showToast("📊 تم عرض تقرير العملاء الأكثر إرجاعاً للفترة المحددة");
            setTimeout(() => {
                const tableContainer = document.getElementById('analysisTableContainer');
                if (tableContainer) {
                    tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 80);
        }
        window.renderMostReturningCustomers = renderMostReturningCustomers;

        // ================= منطق لوحة التحكم (Dashboard) =================

        function updateDashboard() {

            // تم نقل الإحصائيات إلى تقرير الحركة اليومية، اللوحة الرئيسية الآن للتنقل

        }

        // ================= منطق المخازن (Inventory Logic) =================

        var currentInvFilter = 'all';
        var selectedInventoryId = null;
        var currentEditingProductId = null;

        function filterInventory(type, btn) {

            currentInvFilter = type;

            document.querySelectorAll('.inv-filters .filter-btn').forEach(b => b.classList.remove('active'));

            btn.classList.add('active');

            renderInventoryTable();

        }

        // ================= رفع صورة الهوية للحساب =================

        function generateDebtReport() {

            const debtors = accounts.map(a => {
                const bal = typeof getAccountBalance === 'function' ? getAccountBalance(a.name) : ((parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0));
                return { ...a, realBalance: bal };
            }).filter(a => a.realBalance > 0); // عليه فلوس

            if (debtors.length === 0) return alert("لا توجد مديونيات مستحقة حالياً.");

            let rows = '';

            let totalDebt = 0;

            debtors.forEach(a => {

                const debt = a.realBalance;

                totalDebt += debt;

                rows += `<tr><td>${a.name}</td><td>${a.mobile || '-'}</td><td>${debt.toFixed(2)}</td></tr>`;

            });

            const content = `

                <div class="print-container">

                    <div class="print-header"><div class="print-title">تقرير المديونيات المستحقة (الآجل)</div></div>

                    <table class="print-table"><thead><tr><th>العميل</th><th>رقم الهاتف</th><th>المبلغ المستحق</th></tr></thead><tbody>${rows}</tbody></table>

                    <div class="print-total-box">إجمالي الديون: ${totalDebt.toFixed(2)}</div>

                </div>`;

            document.getElementById('receipt-area').innerHTML = content;

            window.print();

        }

        // ================= تقرير تجاوز الحد الائتماني (Over Limit Report) =================

        function generateOverLimitReport() {

            const overLimitAccounts = accounts.filter(a => {

                const limit = parseFloat(a.maxDebt) || 0;

                if (limit <= 0) return false; // لا يوجد حد

                const balance = (parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0);

                return balance > limit;

            });

            if (overLimitAccounts.length === 0) return alert("✅ ممتاز! لا يوجد عملاء متجاوزين للحد الائتماني.");

            let rows = '';

            overLimitAccounts.forEach(a => {

                const balance = (parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0);

                const limit = parseFloat(a.maxDebt);

                const diff = balance - limit;

                rows += `<tr><td>${a.name}</td><td>${a.mobile || '-'}</td><td>${limit.toFixed(2)}</td><td style="color:red; font-weight:bold;">${balance.toFixed(2)}</td><td style="color:#c0392b;">+${diff.toFixed(2)}</td></tr>`;

            });

            const content = `

                <div class="print-container">

                    <div class="print-header">

                        <div class="print-title">⚠️ تقرير العملاء المتجاوزين للحد الائتماني</div>

                        <div>تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</div>

                    </div>

                    <table class="print-table">

                        <thead><tr><th>العميل</th><th>رقم الهاتف</th><th>الحد المسموح</th><th>الرصيد الحالي</th><th>قيمة التجاوز</th></tr></thead>

                        <tbody>${rows}</tbody>

                    </table>

                </div>`;

            document.getElementById('receipt-area').innerHTML = content;

            window.print();

        }

        // حفظ وإدارة المستخدمين محلياً 100%
        async function syncUsersToCloud() {
            // معطل ومحلي 100%
        }

        // ================= دوال إدارة المخازن (Warehouses) =================
