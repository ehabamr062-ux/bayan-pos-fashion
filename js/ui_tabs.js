// ============================================================
//  إدارة التبويبات المتعددة والتنقل وحفظ الحالة (Multi-Tab Engine)
// ============================================================
        function initConfirmModalHandlers() {
            const yesBtn = document.getElementById('confirmYesBtn');
            const noBtn = document.getElementById('confirmNoBtn');
            const backBtn = document.getElementById('confirmBackBtn');

            if (yesBtn) {
                yesBtn.onclick = function () {
                    if (!pendingCloseSection) return;

                    if (pendingCloseSection === 'ALL_OVERALL_RELOAD') {
                        // حفظ الكل وإعادة التحميل - لمحاكاة الـ Refresh
                        // هنا نكتفي بالقول أنه من الصعب تقنياً حفظ الكل في دورة واحدة وإعادة التحميل،
                        // لذا سنعرض رسالة تخبره بضرورة الحفظ اليدوي أو مجرد إعادة تحميل
                        location.reload();
                        return;
                    }

                    const tab = openTabs.find(t => t.id === pendingCloseSection);
                    if (!tab) { closeConfirmModal(); return; }

                    let saved = false;
                    if (tab.type === 'sales') saved = saveBill();
                    else if (tab.type === 'purchase') saved = savePurchase();
                    else if (tab.type === 'receipt') saved = saveReceipt();
                    else if (tab.type === 'disbursement') saved = saveDisbursement();
                    else if (tab.type === 'sales-return') saved = saveSalesReturn();
                    else if (tab.type === 'purchase-return') saved = savePurchaseReturn();
                    else if (tab.type === 'adjustment') saved = saveAdjustment();
                    else saved = true;

                    if (saved) {
                        actuallyCloseTab(pendingCloseSection);
                        closeConfirmModal();
                    }
                };
            }

            if (noBtn) {
                noBtn.onclick = function () {
                    if (pendingCloseSection === 'ALL_OVERALL_RELOAD') {
                        location.reload();
                    } else if (pendingCloseSection) {
                        actuallyCloseTab(pendingCloseSection);
                    }
                    closeConfirmModal();
                };
            }

            if (backBtn) {
                backBtn.onclick = function () {
                    closeConfirmModal();
                };
            }
        }

        function closeConfirmModal() {
            const modal = document.getElementById('confirmModal');
            if (modal) modal.classList.add('hidden');
            pendingCloseSection = null;
        }

        function showCloseWarning(tabId) {
            const modal = document.getElementById('confirmModal');
            if (modal) {
                let label = 'الفاتورة';
                if (tabId === 'ALL_OVERALL_RELOAD') {
                    label = 'كافة التبويبات والمتابعة في التحديث';
                } else {
                    const tab = openTabs.find(t => t.id === (tabId || pendingCloseSection));
                    label = tab ? (tab.label || tab.type) : 'الفاتورة';
                }
                const msgEl = modal.querySelector('p');
                if (msgEl) msgEl.innerText = `هل تريد حفظ ${label}؟`;
                modal.classList.remove('hidden');
            }
        }

        // حماية البيانات عند تحديث المتصفح (Refresh) أو الإغلاق
        window.onbeforeunload = function (e) {
            if (hasAnyUnsavedData()) {
                const msg = "⚠️ تنبيه: لديك بيانات غير محفوظة في بعض التبويبات. هل تريد المغادرة حقاً؟";
                e.returnValue = msg;
                return msg;
            }
        };

        function hasAnyUnsavedData() {
            // التحقق من كافة التبويبات المفتوحة
            for (const tab of openTabs) {
                const state = tabStates[tab.id];
                const type = tab.type;
                const isActive = (activeTabId === tab.id);

                if (isActive) {
                    if (type === 'sales' && cart.length > 0) return true;
                    if (type === 'purchase' && purchaseCart.length > 0) return true;
                    if (type === 'sales-return' && returnCart.length > 0) return true;
                    if (type === 'purchase-return' && purReturnCart.length > 0) return true;
                    if (type === 'adjustment' && adjCart.length > 0) return true;
                    if (type === 'receipt' || type === 'disbursement') {
                        const amId = (type === 'receipt') ? 'receiptAmount' : 'disburseAmount';
                        const el = document.getElementById(amId);
                        if (el && parseFloat(el.value) > 0) return true;
                    }
                } else if (state) {
                    if (state.cart && state.cart.length > 0) return true;
                    if ((type === 'receipt' || type === 'disbursement') && parseFloat(state.amount) > 0) return true;
                }
            }
            return false;
        }

        // استدعاء التهيئة عند تحميل المستند
        document.addEventListener('DOMContentLoaded', () => {
            try { initConfirmModalHandlers(); } catch(e) {}
            try { initLicense(); } catch(e) {}
            try { loadSettings(); } catch(e) {} // إعادة تفعيل تحميل الإعدادات لإصلاح العطل

            // تحميل شعار المؤسسة (Logo Loading)
            try {
                const savedLogo = getStore('bayan_business_logo');
                if (savedLogo) {
                    setTimeout(() => updateLogoDisplays(savedLogo), 100);
                }
            } catch(e) {}

            // تحميل خلفية المحل المخصصة (Wallpaper)
            try { loadWallpaper(); } catch(e) {}

            // تهيئة أعمدة المخازن
            try {
                if (typeof applyInventoryColumnVisibility === 'function') {
                    applyInventoryColumnVisibility();
                }
            } catch(e) {}

            // تهيئة أعمدة الفواتير
            try {
                if (typeof initInvoicesColumns === 'function') initInvoicesColumns();
            } catch(e) {}
        });

        // ================= وظائف مركز التقارير (Reports Logic) =================
        function switchSection(sectionType, fromTab = false, tabId = null) {
            // إذا كان التبويب النشط حالياً هو الحاسبة والتبويب الجديد ليس الحاسبة، نخفي الحاسبة
            if (activeTabId === 'calculator' && sectionType !== 'calculator') {
                const modal = document.getElementById('royalCalculator');
                if (modal && modal.classList.contains('visible')) {
                    modal.classList.remove('visible');
                }
            }

            if (sectionType === 'calculator') {
                restoreCalculator();
                return;
            }

            // التحقق من الصلاحيات الصارمة لكل الأقسام
            if (sectionType === 'settings') {
                if (!checkPermission('general_settings')) return;
            } else if (sectionType === 'sales') {
                if (typeof hasPermission === 'function' && !hasPermission('docs_add')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية للوصول لنقطة البيع', 'error');
                    return;
                }
            } else if (sectionType === 'purchase') {
                if (typeof hasPermission === 'function' && !hasPermission('docs_purchase')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية للوصول لقسم المشتريات', 'error');
                    return;
                }
            } else if (sectionType === 'sales-return' || sectionType === 'purchase-return') {
                if (typeof hasPermission === 'function' && !hasPermission('docs_return')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية للوصول لقسم المرتجعات', 'error');
                    return;
                }
            } else if (sectionType === 'history' || sectionType === 'invoices' || sectionType === 'item-history') {
                if (typeof hasPermission === 'function' && !hasPermission('docs_view')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية لعرض سجل الفواتير والحركات', 'error');
                    return;
                }
            } else if (sectionType === 'inventory' || sectionType === 'warehouse-report' || sectionType === 'product-inquiry') {
                if (typeof hasPermission === 'function' && !hasPermission('stock_view') && !hasPermission('stock_add')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية للوصول لقسم المخازن والبضاعة', 'error');
                    return;
                }
            } else if (sectionType === 'adjustment') {
                if (typeof hasPermission === 'function' && !hasPermission('stock_edit') && !hasPermission('stock_transfer')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية للتسويات والتحويلات المخزنية', 'error');
                    return;
                }
            } else if (sectionType === 'accounts' || sectionType === 'statement') {
                if (typeof hasPermission === 'function' && !hasPermission('accounts_view')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية للوصول لقسم الحسابات', 'error');
                    return;
                }
            } else if (sectionType === 'receipt' || sectionType === 'disbursement') {
                if (typeof hasPermission === 'function' && !hasPermission('accounts_add')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية لسندات القبض والصرف', 'error');
                    return;
                }
            } else if (sectionType === 'analysis') {
                if (typeof hasPermission === 'function' && !hasPermission('general_profits')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية لرؤية التحليلات والأرباح', 'error');
                    return;
                }
            } else if (sectionType === 'daily-report' || sectionType === 'reports-hub' || sectionType === 'treasury-audit') {
                if (typeof hasPermission === 'function' && !hasPermission('general_reports')) {
                    if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية للوصول لقسم التقارير المالية', 'error');
                    return;
                }
            }

            // 1. حفظ الحالة الحالية للتبويب النشط حالياً قبل الانتقال
            saveCurrentTabState();

            if (typeof applyPermissions === 'function') {
                applyPermissions();
            }

            let targetTab;

            // إذا كان الطلب فتح تبويب جديد (نقرة من الداشبورد مثلاً)
            if (!fromTab && !tabId) {
                // الأقسام التي تدعم تعدد النوافذ
                const multiInstanceSections = [
                    'sales', 'purchase', 'receipt', 'disbursement',
                    'sales-return', 'purchase-return', 'inventory',
                    'accounts', 'daily-report', 'history', 'invoices',
                    'analysis', 'item-history', 'adjustment', 'reports-hub', 'warehouse-report', 'price-tracking', 'product-inquiry', 'ai-assistant', 'statement', 'treasury-audit'
                ];

                // التحقق من صلاحية كل قسم بشكل مستقل ودقيق
                if (sectionType === 'sales') {
                    if (!checkPermission('docs_add')) return;
                } else if (sectionType === 'purchase') {
                    if (!checkPermission('docs_purchase')) return;
                } else if (sectionType === 'sales-return' || sectionType === 'purchase-return') {
                    if (!checkPermission('docs_return')) return;
                } else if (sectionType === 'receipt' || sectionType === 'disbursement') {
                    if (!checkPermission('accounts_add')) return;
                } else if (sectionType === 'adjustment') {
                    if (!checkPermission('stock_edit') && !checkPermission('stock_transfer')) return;
                } else if (['inventory', 'warehouse-report', 'product-inquiry'].includes(sectionType)) {
                    if (!checkPermission('stock_view')) return;
                } else if (['accounts', 'statement'].includes(sectionType)) {
                    if (!checkPermission('accounts_view')) return;
                } else if (['analysis'].includes(sectionType)) {
                    if (!checkPermission('general_profits')) return;
                } else if (['daily-report', 'reports-hub', 'treasury-audit'].includes(sectionType)) {
                    if (!checkPermission('general_reports')) return;
                } else if (['history', 'invoices', 'item-history'].includes(sectionType)) {
                    if (!checkPermission('docs_view')) return;
                }

                if (multiInstanceSections.includes(sectionType)) {
                    // التحقق من وجود تبويب مفتوح مسبقاً من نفس النوع
                    const existingTab = openTabs.find(t => t.type === sectionType);
                    if (existingTab) {
                        targetTab = existingTab;
                    } else {
                        // إدارة العداد التلقائي
                        if (!tabCounters[sectionType]) tabCounters[sectionType] = 0;
                        tabCounters[sectionType]++;

                        const newId = sectionType + '_' + Date.now();
                        const labels = {
                            'sales': 'فاتورة بيع', 'purchase': 'توريد شراء',
                            'receipt': 'سند قبض', 'disbursement': 'سند صرف',
                            'sales-return': 'مرتجع بيع', 'purchase-return': 'مرتجع شراء',
                            'inventory': 'المخازن', 'accounts': 'الحسابات',
                            'daily-report': 'تقرير الحركة اليومية', 'history': 'الحركة',
                            'invoices': 'الفواتير', 'analysis': 'تحليل المبيعات',
                            'item-history': 'حركة صنف', 'adjustment': 'تسوية',
                            'reports-hub': 'مركز التقارير', 'warehouse-report': 'أرصدة المخازن',
                            'price-tracking': 'متابعة الأسعار', 'product-inquiry': 'استعلام الأصناف', 'ai-assistant': '🤖 مساعد بيان',
                            'statement': 'كشف حساب', 'treasury-audit': '💰 مراجعة الخزينة'
                        };

                        targetTab = {
                            id: newId,
                            type: sectionType,
                            label: `${labels[sectionType] || sectionType} ${tabCounters[sectionType]}`
                        };
                        openTabs.push(targetTab);
                    }
                } else {
                    // الأقسام الوحيدة
                    targetTab = openTabs.find(t => t.type === sectionType);
                    if (!targetTab) {
                        targetTab = { id: sectionType, type: sectionType, label: null };
                        openTabs.push(targetTab);
                    }
                }
            } else {
                // الانتقال لتبويب موجود بالفعل
                targetTab = openTabs.find(t => t.id === (tabId || sectionType));
            }

            if (!targetTab) return;

            activeTabId = targetTab.id;

            // إخفاء الكل
            document.querySelectorAll('.section-view').forEach(s => s.classList.add('hidden'));

            // إظهار القسم المطلوب وإعادة تحميل حالته
            const sectionEl = document.getElementById(targetTab.type + '-section');
            if (sectionEl) sectionEl.classList.remove('hidden');

            renderTabs();
            updateTabUI(targetTab.id);

            // 🔥 تأجيل تنفيذ رسم الجداول الثقيلة (Asynchronous Deferring)
            // لضمان استجابة الواجهة فوراً (Zero Delay) دون تجميد المتصفح
            setTimeout(() => {
                // تحميل بيانات التبويب المستهدف
                restoreTabState(targetTab.id, targetTab.type);
                if (typeof window.syncReceiptDisburseCheckboxes === 'function') {
                    window.syncReceiptDisburseCheckboxes();
                }
                if (typeof updateHeaderPartnerInfo === 'function') updateHeaderPartnerInfo();

                // منطق خاص لكل قسم أساسي
                if (targetTab.type === 'dashboard') {
                    if (typeof updateDashboard === 'function') updateDashboard();
                    if (typeof updateDashboardPermissions === 'function') updateDashboardPermissions();
                }
                if (targetTab.type === 'treasury-audit') {
                    if (typeof initTreasuryAuditSection === 'function') initTreasuryAuditSection();
                }
                if (targetTab.type === 'settings') { 
                    loadSettings(); 
                    if (typeof openSettingsTab === 'function') {
                        const activeBtn = document.querySelector('#premium-settings-sidebar .premium-tab-btn.active');
                        if (activeBtn) {
                            activeBtn.click();
                        } else {
                            openSettingsTab('business');
                        }
                    }
                    renderUsersTable(); 
                    renderTrashTable(); 
                    renderWarehousesTable();
                    updateSettingsWarehouseSelect();
                    if (typeof renderPaymentMethodsSettings === 'function') renderPaymentMethodsSettings();
                }
                if (['sales', 'purchase', 'sales-return', 'purchase-return', 'receipt', 'disbursement'].includes(targetTab.type)) {
                    if (typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
                    if (targetTab.type === 'sales' && typeof loadPinnedPriceLevel === 'function') loadPinnedPriceLevel();
                }
                if (targetTab.type === 'sales') {
                    setTimeout(() => {
                        const el = document.getElementById('productSearch');
                        if (el) { el.focus(); el.select(); }
                    }, 120);
                } else if (targetTab.type === 'purchase') {
                    setTimeout(() => {
                        const el = document.getElementById('purchaseSearch');
                        if (el) { el.focus(); el.select(); }
                    }, 120);
                } else if (targetTab.type === 'adjustment') {
                    setTimeout(() => {
                        const el = document.getElementById('adjSearch');
                        if (el) { el.focus(); el.select(); }
                    }, 120);
                }
                if (typeof BayanBarcode !== 'undefined' && typeof BayanBarcode.autoFocusActiveInput === 'function') {
                    setTimeout(() => BayanBarcode.autoFocusActiveInput(), 150);
                }
                if (targetTab.type === 'inventory') {
                    renderInventoryTable();
                    setTimeout(() => {
                        const searchInput = document.getElementById('invSearchInput');
                        if (searchInput) {
                            searchInput.focus();
                            searchInput.select(); // تحديد النص الموجود (إن وجد) لمسحه عند الكتابة
                        }
                    }, 100);
                }
                if (targetTab.type === 'accounts') renderAccountsTable();
                if (targetTab.type === 'statement') {
                    if (typeof initStatementSection === 'function') initStatementSection();
                }

                // --- تحديث التاريخ والوقت تلقائياً عند فتح الأقسام المالية ---
                const now = new Date();
                const todayNow = now.toLocaleDateString('en-CA');
                const timeNow = now.toTimeString().slice(0, 5);

                const sectionsWithDateTime = [
                    { s: 'sales', d: 'salesDate', t: 'salesTime' },
                    { s: 'purchase', d: 'purchaseDate', t: 'purchaseTime' },
                    { s: 'receipt', d: 'receiptDate', t: 'receiptTime' },
                    { s: 'disbursement', d: 'disburseDate', t: 'disburseTime' },
                    { s: 'sales-return', d: 'salesReturnDate', t: 'salesReturnTime' },
                    { s: 'purchase-return', d: 'purReturnDate', t: 'purReturnTime' },
                    { s: 'adjustment', d: 'adjDate', t: 'adjTime' },
                    { s: 'history', d: 'historyDateFrom', t: 'historyDateTo' },
                    { s: 'analysis', d: 'anDateFrom', t: 'anDateTo' },
                    { s: 'invoices', d: 'invoicesDateFrom', t: 'invoicesDateTo' },
                    { s: 'daily-report', d: 'reportDateFrom', t: 'reportDateTo' }
                ];

                sectionsWithDateTime.forEach(config => {
                    if (targetTab.type === config.s) {
                        const dEl = document.getElementById(config.d);
                        const tEl = document.getElementById(config.t);
                        const secSaved = window.savedSectionDateFilters ? window.savedSectionDateFilters[targetTab.type] : null;
                        // تحديث أوفلاين/افتراضي فقط إذا لم يكن هناك تاريخ أو فلتر محفوظ سابقاً
                        if (!tabStates[targetTab.id]?.periodFilter && !tabStates[targetTab.id]?.dateFrom && !secSaved) {
                            if (dEl && !dEl.value) dEl.value = todayNow;
                            if (tEl && !tEl.value) tEl.value = todayNow;
                        }

                        // تحديث أرقام الفواتير (رقم ف) عند الفتح لأول مرة
                        if (config.s === 'sales') {
                            const count = typeof getNextSequence === 'function' ? getNextSequence('بيع') : 1;
                            if (document.getElementById('salesBadgeID')) document.getElementById('salesBadgeID').innerText = count;
                            if (typeof renderQuickItems === 'function') renderQuickItems(); // تحديث الأصناف السريعة تلقائياً
                        }
                        if (config.s === 'sales-return') {
                            const count = typeof getNextSequence === 'function' ? getNextSequence('مرتجع بيع') : 1;
                            if (document.getElementById('salesReturnBadgeID')) document.getElementById('salesReturnBadgeID').innerText = count;
                        }
                        if (config.s === 'purchase-return') {
                            const count = typeof getNextSequence === 'function' ? getNextSequence('مرتجع شراء') : 1;
                            if (document.getElementById('purReturnBadgeID')) document.getElementById('purReturnBadgeID').innerText = count;
                        }
                        if (config.s === 'purchase') {
                            const count = typeof getNextSequence === 'function' ? getNextSequence('شراء') : 1;
                            if (document.getElementById('purchaseBadgeID')) document.getElementById('purchaseBadgeID').innerText = count;
                        }
                        if (config.s === 'adjustment') {
                            const count = typeof getNextSequence === 'function' ? getNextSequence('تسوية') : 1;
                            if (document.getElementById('adjBadgeID')) document.getElementById('adjBadgeID').innerText = count;
                        }

                        // تركيز تلقائي على البحث عند فتح قسم البيع
                        if (config.s === 'sales') {
                            setTimeout(() => {
                                const ps = document.getElementById('productSearch');
                                if (ps) ps.focus();
                            }, 50);
                        }

                        // --- تلقائياً فتح نافذة البحث عند فتح أقسام المرتجعات ---
                        if (config.s === 'sales-return' || config.s === 'purchase-return') {
                            setTimeout(() => {
                                const modal = document.getElementById('searchInvoiceModal');
                                if (modal) {
                                    // تصفير النافذة قبل الفتح لضمان عدم بقاء بيانات قديمة
                                    if (typeof resetSearchInvoiceModal === 'function') resetSearchInvoiceModal();

                                    modal.classList.remove('hidden');
                                    // تعيين التاريخ الافتراضي للبحث (اختياري، مثلاً اليوم)
                                    document.getElementById('searchInvoiceDateFrom').value = todayNow;
                                    document.getElementById('searchInvoiceDateTo').value = todayNow;
                                }
                            }, 100);
                        }
                    }
                });

                if (targetTab.type === 'invoices') renderInvoicesTable();
                if (targetTab.type === 'analysis') {
                    const anVal = document.getElementById('anPeriodFilter')?.value;
                    if (anVal && typeof applyAnalysisPeriodFilter === 'function' && anVal !== 'custom') {
                        applyAnalysisPeriodFilter(anVal);
                    } else {
                        renderAnalysisTable();
                    }
                }
                if (targetTab.type === 'warehouse-report') {
                    const wrVal = document.getElementById('wrPeriodFilter')?.value || 'total';
                    if (typeof applyWarehouseReportPeriodFilter === 'function') applyWarehouseReportPeriodFilter(wrVal);
                    else renderWarehouseReportTable();
                }
                if (targetTab.type === 'history') {
                    const hVal = document.getElementById('historyPeriodFilter')?.value;
                    if (hVal && typeof applyHistoryPeriodFilter === 'function' && hVal !== 'custom') {
                        applyHistoryPeriodFilter(hVal);
                    } else {
                        renderHistoryTable();
                    }
                }
                if (targetTab.type === 'daily-report') generateDailyReport();
                if (targetTab.type === 'statement') {
                    if (typeof loadSelectedAccountStatement === 'function') loadSelectedAccountStatement();
                }
            }, 10);
        }

        function saveCurrentTabState() {
            if (!activeTabId || activeTabId === 'dashboard') return;

            const currentTab = openTabs.find(t => t.id === activeTabId);
            if (!currentTab) return;

            // حفظ بيانات البيع
            if (currentTab.type === 'sales') {
                const salesMethodSelect = document.getElementById('sales-sectionPaymentMethodSelect') || document.getElementById('salesPaymentMethodSelect');
                tabStates[activeTabId] = {
                    cart: [...cart],
                    customer: document.getElementById('customerName').value,
                    received: document.getElementById('tenderedAmount').value,
                    discount: document.getElementById('discountInput').value,
                    discountType: document.getElementById('discountType').value,
                    tax: document.getElementById('taxInput').value,
                    taxType: document.getElementById('taxType').value,
                    total: currentTotal,
                    date: document.getElementById('salesDate').value,
                    time: document.getElementById('salesTime').value,
                    method: salesMethodSelect ? salesMethodSelect.value : (document.querySelector('#sales-section .payment-methods .method-btn.selected')?.innerText || 'نقدي'),
                    isEditMode: Boolean(isEditMode),
                    editingInvoiceId: editingInvoiceId || null,
                    editingOriginalDate: editingOriginalDate || null,
                    editingInvoiceType: editingInvoiceType || null,
                    editingOriginalItems: Array.isArray(editingOriginalItems) ? [...editingOriginalItems] : []
                };
            }
            // حفظ بيانات المشتريات
            if (currentTab.type === 'purchase') {
                const purMethodSelect = document.getElementById('purchase-sectionPaymentMethodSelect') || document.getElementById('purchasePaymentMethodSelect');
                tabStates[activeTabId] = {
                    cart: [...purchaseCart],
                    supplier: document.getElementById('supplierName').value,
                    received: document.getElementById('purchasePaid').value,
                    discount: document.getElementById('purchaseDiscount')?.value || 0,
                    discountType: document.getElementById('purchaseDiscountType')?.value || 'val',
                    tax: document.getElementById('purchaseTax')?.value || 0,
                    taxType: document.getElementById('purchaseTaxType')?.value || 'val',
                    total: purchaseCart.reduce((s, i) => s + (i.price * i.qty), 0),
                    date: document.getElementById('purchaseDate').value,
                    time: document.getElementById('purchaseTime').value,
                    method: purMethodSelect ? purMethodSelect.value : 'نقدي',
                    isEditMode: Boolean(isEditMode),
                    editingInvoiceId: editingInvoiceId || null,
                    editingOriginalDate: editingOriginalDate || null,
                    editingInvoiceType: editingInvoiceType || null,
                    editingOriginalItems: Array.isArray(editingOriginalItems) ? [...editingOriginalItems] : []
                };
            }
            // حفظ بيانات المرتجعات (بيع)
            if (currentTab.type === 'sales-return') {
                tabStates[activeTabId] = {
                    cart: [...returnCart],
                    partner: document.getElementById('salesReturnPartnerDisplay') ? document.getElementById('salesReturnPartnerDisplay').innerText : '---',
                    invoice: document.getElementById('salesReturnInvoiceDisplay') ? document.getElementById('salesReturnInvoiceDisplay').innerText : '---',
                    reason: document.getElementById('salesReturnReason') ? document.getElementById('salesReturnReason').value : '',
                    date: document.getElementById('salesReturnDate') ? document.getElementById('salesReturnDate').value : '',
                    time: document.getElementById('salesReturnTime') ? document.getElementById('salesReturnTime').value : '',
                    discount: document.getElementById('salesReturnDiscount') ? document.getElementById('salesReturnDiscount').value : 0,
                    tax: document.getElementById('salesReturnTax') ? document.getElementById('salesReturnTax').value : 0,
                    isEditMode: Boolean(isEditMode),
                    editingInvoiceId: editingInvoiceId || null,
                    editingOriginalDate: editingOriginalDate || null,
                    editingInvoiceType: editingInvoiceType || null,
                    editingOriginalItems: Array.isArray(editingOriginalItems) ? [...editingOriginalItems] : []
                };
            }
            // حفظ بيانات المرتجعات (شراء)
            if (currentTab.type === 'purchase-return') {
                tabStates[activeTabId] = {
                    cart: [...purReturnCart],
                    partner: document.getElementById('purReturnPartnerDisplay') ? document.getElementById('purReturnPartnerDisplay').innerText : '---',
                    invoice: document.getElementById('purReturnInvoiceDisplay') ? document.getElementById('purReturnInvoiceDisplay').innerText : '---',
                    reason: document.getElementById('purReturnReason') ? document.getElementById('purReturnReason').value : '',
                    date: document.getElementById('purReturnDate') ? document.getElementById('purReturnDate').value : '',
                    time: document.getElementById('purReturnTime') ? document.getElementById('purReturnTime').value : '',
                    discount: document.getElementById('purReturnDiscount') ? document.getElementById('purReturnDiscount').value : 0,
                    tax: document.getElementById('purReturnTax') ? document.getElementById('purReturnTax').value : 0,
                    isEditMode: Boolean(isEditMode),
                    editingInvoiceId: editingInvoiceId || null,
                    editingOriginalDate: editingOriginalDate || null,
                    editingInvoiceType: editingInvoiceType || null,
                    editingOriginalItems: Array.isArray(editingOriginalItems) ? [...editingOriginalItems] : []
                };
            }
            // حفظ بيانات التسوية
            if (currentTab.type === 'adjustment') {
                const curAdjCart = (typeof window.adjCart !== 'undefined' && Array.isArray(window.adjCart)) ? window.adjCart : ((typeof adjCart !== 'undefined' && Array.isArray(adjCart)) ? adjCart : []);
                tabStates[activeTabId] = {
                    cart: [...curAdjCart],
                    date: document.getElementById('adjDate') ? document.getElementById('adjDate').value : '',
                    time: document.getElementById('adjTime') ? document.getElementById('adjTime').value : '',
                    isEditMode: Boolean(isEditMode),
                    editingInvoiceId: editingInvoiceId || null,
                    editingOriginalDate: editingOriginalDate || null,
                    editingInvoiceType: editingInvoiceType || null,
                    editingOriginalItems: Array.isArray(editingOriginalItems) ? [...editingOriginalItems] : []
                };
            }
            // حفظ بيانات السندات (قبض/صرف)
            if (currentTab.type === 'receipt') {
                tabStates[activeTabId] = {
                    id: document.getElementById('receiptID').value,
                    date: document.getElementById('receiptDate').value,
                    time: document.getElementById('receiptTime').value,
                    customer: document.getElementById('receiptCustomer').value,
                    amount: document.getElementById('receiptAmount').value,
                    notes: document.getElementById('receiptNotes').value,
                    type: document.getElementById('receiptType') ? document.getElementById('receiptType').value : 'أخرى',
                    balance: document.getElementById('receiptAccountBalance') ? document.getElementById('receiptAccountBalance').innerText : '0.00',
                    isEditMode: Boolean(isEditMode),
                    editingInvoiceId: editingInvoiceId || null,
                    editingOriginalDate: editingOriginalDate || null,
                    editingInvoiceType: editingInvoiceType || null,
                    editingOriginalItems: Array.isArray(editingOriginalItems) ? [...editingOriginalItems] : []
                };
            }
            if (currentTab.type === 'disbursement') {
                tabStates[activeTabId] = {
                    id: document.getElementById('disburseID').value,
                    date: document.getElementById('disburseDate').value,
                    time: document.getElementById('disburseTime').value,
                    payee: document.getElementById('disbursePayee').value,
                    amount: document.getElementById('disburseAmount').value,
                    notes: document.getElementById('disburseNotes').value,
                    type: document.getElementById('disburseType') ? document.getElementById('disburseType').value : 'أخرى',
                    balance: document.getElementById('disburseAccountBalance') ? document.getElementById('disburseAccountBalance').innerText : '0.00',
                    isEditMode: Boolean(isEditMode),
                    editingInvoiceId: editingInvoiceId || null,
                    editingOriginalDate: editingOriginalDate || null,
                    editingInvoiceType: editingInvoiceType || null,
                    editingOriginalItems: Array.isArray(editingOriginalItems) ? [...editingOriginalItems] : []
                };
            }
            if (currentTab.type === 'product-inquiry') {
                const activeItem = document.querySelector('.inquiry-product-item.active');
                tabStates[activeTabId] = {
                    searchQuery: document.getElementById('inquirySearchInput') ? document.getElementById('inquirySearchInput').value : '',
                    selectedId: activeItem ? activeItem.id.replace('inquiry-item-', '') : null
                };
            }

            // حفظ فلاتر الفترة والتواريخ المخصصة لكل قسم تقارير بشكل مستقل
            const dateFilterConfigs = [
                { type: 'invoices', periodId: 'invoicesPeriodFilter', fromId: 'invoicesDateFrom', toId: 'invoicesDateTo' },
                { type: 'analysis', periodId: 'anPeriodFilter', fromId: 'anDateFrom', toId: 'anDateTo' },
                { type: 'history', periodId: 'historyPeriodFilter', fromId: 'historyDateFrom', toId: 'historyDateTo' },
                { type: 'warehouse-report', periodId: 'wrPeriodFilter', fromId: 'wrStartDate', toId: 'wrEndDate' },
                { type: 'daily-report', periodId: 'dailyReportPeriodFilter', fromId: 'reportDateFrom', toId: 'reportDateTo' },
                { type: 'statement', periodId: 'stmtPeriodFilter', fromId: 'stmtDateFrom', toId: 'stmtDateTo' }
            ];

            const curDateConfig = dateFilterConfigs.find(c => c.type === currentTab.type);
            if (curDateConfig) {
                const pEl = document.getElementById(curDateConfig.periodId);
                const fEl = document.getElementById(curDateConfig.fromId);
                const tEl = document.getElementById(curDateConfig.toId);
                const filterStateObj = {
                    periodFilter: pEl ? pEl.value : null,
                    dateFrom: fEl ? fEl.value : null,
                    dateTo: tEl ? tEl.value : null
                };
                tabStates[activeTabId] = {
                    ...(tabStates[activeTabId] || {}),
                    ...filterStateObj
                };
                if (!window.savedSectionDateFilters) window.savedSectionDateFilters = {};
                window.savedSectionDateFilters[currentTab.type] = filterStateObj;
            }
        }

        function restoreTabState(tabId, type) {
            const state = tabStates[tabId];

                        if (type === 'product-inquiry') {
                if (state) {
                    document.getElementById('inquirySearchInput').value = state.searchQuery || '';
                    if (typeof handleInquirySearch === 'function') handleInquirySearch(state.searchQuery || '');
                    if (state.selectedId) {
                        setTimeout(() => {
                            if (typeof selectProductForInquiry === 'function') selectProductForInquiry(Number(state.selectedId));
                        }, 50);
                    }
                } else {
                    document.getElementById('inquirySearchInput').value = '';
                    const emptyState = document.getElementById('inquiryEmptyState');
                    const detailsContent = document.getElementById('inquiryDetailsContent');
                    if (emptyState) emptyState.classList.remove('hidden');
                    if (detailsContent) detailsContent.classList.add('hidden');
                    if (typeof handleInquirySearch === 'function') handleInquirySearch('');
                }
            }

            if (type === 'sales') {
                if (state) {
                    cart = state.cart;
                    document.getElementById('customerName').value = state.customer;
                    document.getElementById('tenderedAmount').value = state.received;
                    document.getElementById('discountInput').value = state.discount;
                    if (state.discountType) document.getElementById('discountType').value = state.discountType;
                    document.getElementById('taxInput').value = state.tax || 0;
                    if (state.taxType) document.getElementById('taxType').value = state.taxType;
                    if (state.date) document.getElementById('salesDate').value = state.date;
                    if (state.time) document.getElementById('salesTime').value = state.time;

                    // استعادة حالة التعديل المعزولة لهذا التبويب
                    isEditMode = Boolean(state.isEditMode);
                    editingInvoiceId = state.editingInvoiceId || null;
                    editingOriginalDate = state.editingOriginalDate || null;
                    editingInvoiceType = state.editingInvoiceType || null;
                    editingOriginalItems = Array.isArray(state.editingOriginalItems) ? [...state.editingOriginalItems] : [];

                    // استعادة طريقة الدفع بدقة
                    if (state.method) {
                        const salesMethodSelect = document.getElementById('sales-sectionPaymentMethodSelect') || document.getElementById('salesPaymentMethodSelect');
                        if (salesMethodSelect) {
                            salesMethodSelect.value = state.method;
                            if (typeof selectMethod === 'function') selectMethod(salesMethodSelect);
                        }
                        document.querySelectorAll('#sales-section .payment-methods .method-btn').forEach(btn => {
                            btn.classList.toggle('selected', btn.innerText.includes(state.method));
                        });
                    }

                    updateActiveTabTitle(state.customer, isEditMode ? `تعديل #${editingInvoiceId}` : 'بيع');
                } else {
                    cart = [];
                    isEditMode = false;
                    editingInvoiceId = null;
                    editingOriginalDate = null;
                    editingInvoiceType = null;
                    editingOriginalItems = [];
                    document.getElementById('customerName').value = '';
                    document.getElementById('tenderedAmount').value = '';
                    document.getElementById('discountInput').value = '0';
                    document.getElementById('taxInput').value = '0';
                    // تعيين التاريخ والوقت الحالي للتبويب الجديد
                    const now = new Date();
                    document.getElementById('salesDate').value = now.toLocaleDateString('en-CA');
                    document.getElementById('salesTime').value = now.toTimeString().slice(0, 5);
                }

                // تمييز أو إعادة تعيين زر الحفظ
                const salesSaveBtn = document.querySelector('#sales-section .btn-save');
                if (salesSaveBtn) {
                    if (isEditMode) {
                        salesSaveBtn.style.background = 'var(--main-orange, #f59e0b)';
                        salesSaveBtn.innerText = '💾 حفظ التعديلات (F9)';
                    } else {
                        salesSaveBtn.style.background = '';
                        salesSaveBtn.innerText = '💾 حفظ الفاتورة (F9)';
                    }
                }

                renderCart();
            }

            if (type === 'purchase') {
                if (state) {
                    purchaseCart = state.cart;
                    document.getElementById('supplierName').value = state.supplier;
                    document.getElementById('purchasePaid').value = state.received;
                    if (document.getElementById('purchaseDiscount')) document.getElementById('purchaseDiscount').value = state.discount || 0;
                    if (document.getElementById('purchaseDiscountType') && state.discountType) document.getElementById('purchaseDiscountType').value = state.discountType;
                    if (document.getElementById('purchaseTax')) document.getElementById('purchaseTax').value = state.tax || 0;
                    if (document.getElementById('purchaseTaxType') && state.taxType) document.getElementById('purchaseTaxType').value = state.taxType;
                    if (state.date) document.getElementById('purchaseDate').value = state.date;
                    if (state.time) document.getElementById('purchaseTime').value = state.time;

                    isEditMode = Boolean(state.isEditMode);
                    editingInvoiceId = state.editingInvoiceId || null;
                    editingOriginalDate = state.editingOriginalDate || null;
                    editingInvoiceType = state.editingInvoiceType || null;
                    editingOriginalItems = Array.isArray(state.editingOriginalItems) ? [...state.editingOriginalItems] : [];

                    if (state.method) {
                        const purMethodSelect = document.getElementById('purchase-sectionPaymentMethodSelect') || document.getElementById('purchasePaymentMethodSelect');
                        if (purMethodSelect) {
                            purMethodSelect.value = state.method;
                            if (typeof selectMethod === 'function') selectMethod(purMethodSelect);
                        }
                    }

                    updateActiveTabTitle(state.supplier, isEditMode ? `تعديل #${editingInvoiceId}` : 'شراء');
                } else {
                    purchaseCart = [];
                    isEditMode = false;
                    editingInvoiceId = null;
                    editingOriginalDate = null;
                    editingInvoiceType = null;
                    editingOriginalItems = [];
                    document.getElementById('supplierName').value = '';
                    document.getElementById('purchasePaid').value = '';
                    const now = new Date();
                    document.getElementById('purchaseDate').value = now.toLocaleDateString('en-CA');
                    document.getElementById('purchaseTime').value = now.toTimeString().slice(0, 5);
                }

                const purSaveBtn = document.querySelector('#purchase-section .btn-save');
                if (purSaveBtn) {
                    if (isEditMode) {
                        purSaveBtn.style.background = 'var(--main-orange, #f59e0b)';
                        purSaveBtn.innerText = '💾 حفظ التعديلات (F9)';
                    } else {
                        purSaveBtn.style.background = '';
                        purSaveBtn.innerText = '💾 حفظ الفاتورة (F9)';
                    }
                }

                renderPurchaseCart_Finalized_V3();
            }

            if (type === 'sales-return') {
                if (state) {
                    returnCart = state.cart;
                    document.getElementById('salesReturnPartnerDisplay').innerText = state.partner;
                    const invDisp = document.getElementById('salesReturnInvoiceDisplay');
                    if (invDisp) invDisp.innerText = state.invoice;
                    document.getElementById('salesReturnReason').value = state.reason;
                    if (state.date) document.getElementById('salesReturnDate').value = state.date;
                    if (state.time) document.getElementById('salesReturnTime').value = state.time;
                    if (state.discount) document.getElementById('salesReturnDiscount').value = state.discount;
                    if (state.tax) document.getElementById('salesReturnTax').value = state.tax;

                    isEditMode = Boolean(state.isEditMode);
                    editingInvoiceId = state.editingInvoiceId || null;
                    editingOriginalDate = state.editingOriginalDate || null;
                    editingInvoiceType = state.editingInvoiceType || null;
                    editingOriginalItems = Array.isArray(state.editingOriginalItems) ? [...state.editingOriginalItems] : [];

                    updateActiveTabTitle(state.partner, isEditMode ? `تعديل #${editingInvoiceId}` : 'م.بيع');
                } else {
                    returnCart = [];
                    isEditMode = false;
                    editingInvoiceId = null;
                    editingOriginalDate = null;
                    editingInvoiceType = null;
                    editingOriginalItems = [];
                    document.getElementById('salesReturnPartnerDisplay').innerText = '---';
                    const invDisp = document.getElementById('salesReturnInvoiceDisplay');
                    if (invDisp) invDisp.innerText = '---';
                    document.getElementById('salesReturnReason').value = 'تالف';
                    const now = new Date();
                    document.getElementById('salesReturnDate').value = now.toLocaleDateString('en-CA');
                    document.getElementById('salesReturnTime').value = now.toTimeString().slice(0, 5);
                }

                const srSaveBtn = document.querySelector('#sales-return-section .btn-save');
                if (srSaveBtn) {
                    if (isEditMode) {
                        srSaveBtn.style.background = 'var(--main-orange, #f59e0b)';
                        srSaveBtn.innerText = '💾 حفظ التعديلات (F9)';
                    } else {
                        srSaveBtn.style.background = '';
                        srSaveBtn.innerText = '💾 حفظ المرتجع (F9)';
                    }
                }

                renderReturnCart();
            }

            if (type === 'purchase-return') {
                if (state) {
                    purReturnCart = state.cart;
                    document.getElementById('purReturnPartnerDisplay').innerText = state.partner;
                    const invDisp = document.getElementById('purReturnInvoiceDisplay');
                    if (invDisp) invDisp.innerText = state.invoice;
                    document.getElementById('purReturnReason').value = state.reason;
                    if (state.date) document.getElementById('purReturnDate').value = state.date;
                    if (state.time) document.getElementById('purReturnTime').value = state.time;
                    if (state.discount) document.getElementById('purReturnDiscount').value = state.discount;
                    if (state.tax) document.getElementById('purReturnTax').value = state.tax;

                    isEditMode = Boolean(state.isEditMode);
                    editingInvoiceId = state.editingInvoiceId || null;
                    editingOriginalDate = state.editingOriginalDate || null;
                    editingInvoiceType = state.editingInvoiceType || null;
                    editingOriginalItems = Array.isArray(state.editingOriginalItems) ? [...state.editingOriginalItems] : [];

                    updateActiveTabTitle(state.partner, isEditMode ? `تعديل #${editingInvoiceId}` : 'م.شراء');
                } else {
                    purReturnCart = [];
                    isEditMode = false;
                    editingInvoiceId = null;
                    editingOriginalDate = null;
                    editingInvoiceType = null;
                    editingOriginalItems = [];
                    document.getElementById('purReturnPartnerDisplay').innerText = '---';
                    const invDisp = document.getElementById('purReturnInvoiceDisplay');
                    if (invDisp) invDisp.innerText = '---';
                    document.getElementById('purReturnReason').value = 'تالف';
                    const now = new Date();
                    document.getElementById('purReturnDate').value = now.toLocaleDateString('en-CA');
                    document.getElementById('purReturnTime').value = now.toTimeString().slice(0, 5);
                }

                const prSaveBtn = document.querySelector('#purchase-return-section .btn-save');
                if (prSaveBtn) {
                    if (isEditMode) {
                        prSaveBtn.style.background = 'var(--main-orange, #f59e0b)';
                        prSaveBtn.innerText = '💾 حفظ التعديلات (F9)';
                    } else {
                        prSaveBtn.style.background = '';
                        prSaveBtn.innerText = '💾 حفظ المرتجع (F9)';
                    }
                }

                renderPurReturnCart();
            }

            if (type === 'adjustment') {
                if (state) {
                    window.adjCart = state.cart || [];
                    if (typeof adjCart !== 'undefined') adjCart = window.adjCart;
                    if (state.date) document.getElementById('adjDate').value = state.date;
                    if (state.time) document.getElementById('adjTime').value = state.time;

                    isEditMode = Boolean(state.isEditMode);
                    editingInvoiceId = state.editingInvoiceId || null;
                    editingOriginalDate = state.editingOriginalDate || null;
                    editingInvoiceType = state.editingInvoiceType || null;
                    editingOriginalItems = Array.isArray(state.editingOriginalItems) ? [...state.editingOriginalItems] : [];
                } else {
                    window.adjCart = [];
                    if (typeof adjCart !== 'undefined') adjCart = [];
                    isEditMode = false;
                    editingInvoiceId = null;
                    editingOriginalDate = null;
                    editingInvoiceType = null;
                    editingOriginalItems = [];
                    const now = new Date();
                    document.getElementById('adjDate').value = now.toLocaleDateString('en-CA');
                    document.getElementById('adjTime').value = now.toTimeString().slice(0, 5);
                }

                const adjSaveBtn = document.querySelector('#adjustment-section .btn-save');
                if (adjSaveBtn) {
                    if (isEditMode) {
                        adjSaveBtn.style.background = 'var(--main-orange, #f59e0b)';
                        adjSaveBtn.innerText = '💾 حفظ التعديلات (F9)';
                    } else {
                        adjSaveBtn.style.background = '';
                        adjSaveBtn.innerText = '💾 حفظ التسوية (F9)';
                    }
                }

                renderAdjTable();
            }

            if (type === 'receipt') {
                if (state) {
                    document.getElementById('receiptID').value = state.id;
                    document.getElementById('receiptDate').value = state.date;
                    if (document.getElementById('receiptTime')) document.getElementById('receiptTime').value = state.time || '';
                    document.getElementById('receiptCustomer').value = state.customer;
                    document.getElementById('receiptAmount').value = state.amount;
                    document.getElementById('receiptNotes').value = state.notes;
                    if (document.getElementById('receiptType')) document.getElementById('receiptType').value = state.type || 'أخرى';
                    if (document.getElementById('receiptAccountBalance')) document.getElementById('receiptAccountBalance').innerText = state.balance || '0.00';

                    isEditMode = Boolean(state.isEditMode);
                    editingInvoiceId = state.editingInvoiceId || null;
                    editingOriginalDate = state.editingOriginalDate || null;
                    editingInvoiceType = state.editingInvoiceType || null;
                    editingOriginalItems = Array.isArray(state.editingOriginalItems) ? [...state.editingOriginalItems] : [];
                } else {
                    isEditMode = false;
                    editingInvoiceId = null;
                    editingOriginalDate = null;
                    editingInvoiceType = null;
                    editingOriginalItems = [];
                    document.getElementById('receiptID').value = getNextSequence('قبض');
                    const now = new Date();
                    document.getElementById('receiptDate').value = now.toLocaleDateString('en-CA');
                    if (document.getElementById('receiptTime')) document.getElementById('receiptTime').value = now.toTimeString().slice(0, 5);
                    document.getElementById('receiptCustomer').value = '';
                    document.getElementById('receiptAmount').value = '';
                    document.getElementById('receiptNotes').value = '';
                    if (document.getElementById('receiptAccountBalance')) document.getElementById('receiptAccountBalance').innerText = '0.00';
                }

                const recSaveBtn = document.querySelector('#receipt-section .btn-save');
                if (recSaveBtn) {
                    if (isEditMode) {
                        recSaveBtn.style.background = 'var(--main-orange, #f59e0b)';
                        recSaveBtn.innerText = '💾 حفظ التعديلات (F9)';
                    } else {
                        recSaveBtn.style.background = '';
                        recSaveBtn.innerText = '💾 حفظ السند (F9)';
                    }
                }
            }

            if (type === 'disbursement') {
                if (state) {
                    document.getElementById('disburseID').value = state.id;
                    document.getElementById('disburseDate').value = state.date;
                    if (document.getElementById('disburseTime')) document.getElementById('disburseTime').value = state.time || '';
                    document.getElementById('disbursePayee').value = state.payee;
                    document.getElementById('disburseAmount').value = state.amount;
                    document.getElementById('disburseNotes').value = state.notes;
                    if (document.getElementById('disburseType')) document.getElementById('disburseType').value = state.type || 'أخرى';
                    if (document.getElementById('disburseAccountBalance')) document.getElementById('disburseAccountBalance').innerText = state.balance || '0.00';

                    isEditMode = Boolean(state.isEditMode);
                    editingInvoiceId = state.editingInvoiceId || null;
                    editingOriginalDate = state.editingOriginalDate || null;
                    editingInvoiceType = state.editingInvoiceType || null;
                    editingOriginalItems = Array.isArray(state.editingOriginalItems) ? [...state.editingOriginalItems] : [];
                } else {
                    isEditMode = false;
                    editingInvoiceId = null;
                    editingOriginalDate = null;
                    editingInvoiceType = null;
                    editingOriginalItems = [];
                    document.getElementById('disburseID').value = getNextSequence('صرف');
                    const now = new Date();
                    document.getElementById('disburseDate').value = now.toLocaleDateString('en-CA');
                    if (document.getElementById('disburseTime')) document.getElementById('disburseTime').value = now.toTimeString().slice(0, 5);
                    document.getElementById('disbursePayee').value = '';
                    document.getElementById('disburseAmount').value = '';
                    document.getElementById('disburseNotes').value = '';
                    if (document.getElementById('disburseAccountBalance')) document.getElementById('disburseAccountBalance').innerText = '0.00';
                }

                const disSaveBtn = document.querySelector('#disbursement-section .btn-save');
                if (disSaveBtn) {
                    if (isEditMode) {
                        disSaveBtn.style.background = 'var(--main-orange, #f59e0b)';
                        disSaveBtn.innerText = '💾 حفظ التعديلات (F9)';
                    } else {
                        disSaveBtn.style.background = '';
                        disSaveBtn.innerText = '💾 حفظ السند (F9)';
                    }
                }
            }
            if (type === 'price-tracking') {
                if (typeof initPriceTracking === 'function') initPriceTracking();
            }
                        if (type === 'product-inquiry') {
                setTimeout(() => {
                    const searchInput = document.getElementById('inquirySearchInput');
                    if (searchInput) searchInput.focus();
                }, 100);
            }
            // استعادة فلاتر الفترة والتواريخ المخصصة المحفوظة للقسم
            const dateFilterConfigs = [
                { type: 'invoices', periodId: 'invoicesPeriodFilter', fromId: 'invoicesDateFrom', toId: 'invoicesDateTo' },
                { type: 'analysis', periodId: 'anPeriodFilter', fromId: 'anDateFrom', toId: 'anDateTo' },
                { type: 'history', periodId: 'historyPeriodFilter', fromId: 'historyDateFrom', toId: 'historyDateTo' },
                { type: 'warehouse-report', periodId: 'wrPeriodFilter', fromId: 'wrStartDate', toId: 'wrEndDate' },
                { type: 'daily-report', periodId: 'dailyReportPeriodFilter', fromId: 'reportDateFrom', toId: 'reportDateTo' },
                { type: 'statement', periodId: 'stmtPeriodFilter', fromId: 'stmtDateFrom', toId: 'stmtDateTo' }
            ];

            const curDateConfig = dateFilterConfigs.find(c => c.type === type);
            const savedState = (state && (state.periodFilter !== undefined || state.dateFrom))
                ? state
                : (window.savedSectionDateFilters ? window.savedSectionDateFilters[type] : null);

            if (curDateConfig && savedState) {
                const pEl = document.getElementById(curDateConfig.periodId);
                const fEl = document.getElementById(curDateConfig.fromId);
                const tEl = document.getElementById(curDateConfig.toId);
                if (pEl && savedState.periodFilter !== undefined && savedState.periodFilter !== null) {
                    pEl.value = savedState.periodFilter;
                }
                if (fEl && savedState.dateFrom) fEl.value = savedState.dateFrom;
                if (tEl && savedState.dateTo) tEl.value = savedState.dateTo;

                // التوافق مع إظهار حقول التاريخ المخصص في الأقسام ذات الحقول المخفية
                if (type === 'warehouse-report') {
                    const customContainer = document.getElementById('wrCustomDateContainer');
                    if (customContainer) {
                        if (savedState.periodFilter === 'custom') customContainer.classList.remove('hidden');
                        else customContainer.classList.add('hidden');
                    }
                } else if (type === 'history') {
                    const customDatesDiv = document.getElementById('historyCustomDates');
                    if (customDatesDiv) {
                        if (savedState.periodFilter === 'custom') {
                            customDatesDiv.style.opacity = '1';
                            customDatesDiv.style.pointerEvents = 'auto';
                        }
                    }
                }
            }
        }

        function renderTabs() {
            const tabBar = document.getElementById('tabBar');
            if (!tabBar) return;

            const sectionsLocal = {
                'dashboard': '🏠 الرئيسية',
                'sales': '🛒 البيع',
                'purchase': '🚐 المشتريات',
                'inventory': '📦 المخازن',
                'accounts': '📂 الحسابات',
                'analysis': '📊 التحليل',
                'receipt': '💰 القبض',
                'disbursement': '💸 الصرف',
                'daily-report': '🗓️ التقارير',
                'history': '📜 الحركة',
                'invoices': '📄 الفواتير',
                'sales-return': '🔄 مرتجع بيع',
                'purchase-return': '🔄 مرتجع شراء',
                'settings': '⚙️ الإعدادات',
                'adjustment': '⚖️ تسوية',
                'reports-hub': '📈 مركز التقارير',
                'price-tracking': '💰 الأسعار',
                'product-inquiry': '🔍 استعلام',
                'ai-assistant': '🤖 مساعد'
            };

            tabBar.innerHTML = '';

            // 1. حاوية التبويبات المرنة القابلة للسحب والترتيب
            const listWrapper = document.createElement('div');
            listWrapper.id = 'tabBarList';
            listWrapper.className = 'tab-bar-list';

            openTabs.forEach(tab => {
                const tabEl = document.createElement('div');
                tabEl.className = 'app-tab-item' + (tab.id === activeTabId ? ' active' : '');
                tabEl.id = 'tab-' + tab.id;
                tabEl.setAttribute('data-type', tab.type); 
                tabEl.onclick = () => switchSection(tab.type, true, tab.id);

                const label = document.createElement('span');
                label.className = 'app-tab-title';
                label.innerText = tab.label || sectionsLocal[tab.type] || tab.type;
                tabEl.appendChild(label);

                if (tab.type !== 'dashboard') {
                    const closeBtn = document.createElement('span');
                    closeBtn.className = 'app-tab-close';
                    closeBtn.innerHTML = '&times;';
                    closeBtn.title = 'إغلاق التبويب';
                    closeBtn.onclick = (e) => {
                        e.stopPropagation();
                        closeTab(tab.id, e);
                    };
                    tabEl.appendChild(closeBtn);
                }

                listWrapper.appendChild(tabEl);
            });

            tabBar.appendChild(listWrapper);

            // 2. زر إضافة تبويب جديد (+) الثابت دائماً على اليسار Sticky Add Button
            const addBtn = document.createElement('div');
            addBtn.className = 'app-tab-add';
            addBtn.title = 'فتح نافذة جديدة';
            addBtn.innerHTML = '+';
            addBtn.onclick = () => showQuickNav();
            tabBar.appendChild(addBtn);

            // التمرير التلقائي لرؤية التبويب النشط
            setTimeout(() => {
                const activeEl = listWrapper.querySelector('.app-tab-item.active');
                if (activeEl && typeof activeEl.scrollIntoView === 'function') {
                    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            }, 50);

            if (typeof initTabSortable === 'function') initTabSortable();
        }

        let tabSortableInstance = null;
        function initTabSortable() {
            try {
                const el = document.getElementById('tabBarList');
                if (!el || typeof Sortable === 'undefined') return;

                if (tabSortableInstance && typeof tabSortableInstance.destroy === 'function') {
                    try { tabSortableInstance.destroy(); } catch(e) {}
                    tabSortableInstance = null;
                }

                if (typeof Sortable === 'function') {
                    tabSortableInstance = new Sortable(el, {
                        animation: 180,
                        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
                        draggable: ".app-tab-item:not(#tab-dashboard)",
                        ghostClass: "sortable-tab-ghost",
                        chosenClass: "sortable-tab-chosen",
                        dragClass: "sortable-tab-drag",
                        direction: 'horizontal',
                        delay: 0,
                        touchStartThreshold: 3,
                        onMove: function (evt) {
                            if (evt.related && evt.related.id === 'tab-dashboard') {
                                return false;
                            }
                        },
                        onEnd: function (evt) {
                            const newOrder = [];
                            const items = el.querySelectorAll('.app-tab-item');
                            items.forEach(item => {
                                const idStr = item.id.replace('tab-', '');
                                const tab = openTabs.find(t => String(t.id) === String(idStr));
                                if (tab) newOrder.push(tab);
                            });

                            if (newOrder.length === openTabs.length) {
                                openTabs = newOrder;
                            }
                        }
                    });
                }
            } catch(e) {
                console.warn("Tab sortable warning:", e);
            }
        }

        function showQuickNav() {
            document.getElementById('quickNavModal').classList.remove('hidden');
        }

        function updateTabUI(activeId) {
            document.querySelectorAll('.app-tab-item').forEach(t => t.classList.remove('active'));
            const activeTab = document.getElementById('tab-' + activeId);
            if (activeTab) {
                activeTab.classList.add('active');
                activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
            }
        }

        function closeTab(tabId, event) {
            if (event) event.stopPropagation();
            if (tabId === 'dashboard') return;

            const currentTab = openTabs.find(t => t.id === tabId);
            if (!currentTab) return;

            const financialTypes = ['sales', 'purchase', 'receipt', 'disbursement', 'sales-return', 'purchase-return', 'adjustment'];
            if (financialTypes.includes(currentTab.type)) {
                let hasData = false;
                const state = tabStates[tabId];
                const type = currentTab.type;

                if (activeTabId === tabId) {
                    if (type === 'sales' && (cart.length > 0 || document.getElementById('customerName').value.trim() !== '')) hasData = true;
                    if (type === 'purchase' && (purchaseCart.length > 0 || document.getElementById('supplierName').value.trim() !== '')) hasData = true;
                    if (type === 'sales-return' && returnCart.length > 0) hasData = true;
                    if (type === 'purchase-return' && purReturnCart.length > 0) hasData = true;
                    if (type === 'adjustment' && adjCart.length > 0) hasData = true;

                    if (type === 'receipt' || type === 'disbursement') {
                        const amId = (type === 'receipt') ? 'receiptAmount' : 'disburseAmount';
                        const partnerId = (type === 'receipt') ? 'receiptCustomer' : 'disbursePayee';
                        if (parseFloat(document.getElementById(amId).value) > 0 || document.getElementById(partnerId).value.trim() !== '') hasData = true;
                    }
                } else if (state) {
                    if (state.cart && state.cart.length > 0) hasData = true;
                    if ((type === 'receipt' || type === 'disbursement') && parseFloat(state.amount) > 0) {
                        hasData = true;
                    }
                }

                if (hasData) {
                    pendingCloseSection = tabId;
                    showCloseWarning(tabId);
                    return;
                }
            }
            actuallyCloseTab(tabId);
        }

        function actuallyCloseTab(tabId) {
            if (tabId === 'calculator') {
                const modal = document.getElementById('royalCalculator');
                if (modal) modal.classList.remove('visible');
            }
            const index = openTabs.findIndex(t => t.id === tabId);
            if (index > -1) {
                const isActive = (activeTabId === tabId);
                openTabs.splice(index, 1);
                delete tabStates[tabId];
                renderTabs();
                if (isActive) {
                    const nextIndex = Math.max(0, index - 1);
                    const nextTab = openTabs[nextIndex] || openTabs[0];
                    if (nextTab) {
                        switchSection(nextTab.type, true, nextTab.id);
                    }
                }
            }
        }
        window.closeTab = closeTab;
        window.actuallyCloseTab = actuallyCloseTab;

        function closeCurrentSectionTab(sectionType) {
            const tabToClose = openTabs.find(t => t.id === activeTabId && t.type === sectionType) || 
                               openTabs.find(t => t.type === sectionType) ||
                               openTabs.find(t => t.id === sectionType);
            if (tabToClose) {
                actuallyCloseTab(tabToClose.id);
            } else {
                if (typeof switchSection === 'function') switchSection('dashboard');
            }
        }
        window.closeCurrentSectionTab = closeCurrentSectionTab;

        function showCloseWarning() {
            document.getElementById('confirmModal').classList.remove('hidden');
        }

        function hideCloseWarning() {
            document.getElementById('confirmModal').classList.add('hidden');
            pendingCloseSection = null;
        }

        function initConfirmModal() {
            const backBtn = document.getElementById('confirmBackBtn');
            const noBtn = document.getElementById('confirmNoBtn');
            const yesBtn = document.getElementById('confirmYesBtn');

            if (backBtn) backBtn.onclick = hideCloseWarning;

            if (noBtn) {
                noBtn.onclick = () => {
                    actuallyCloseTab(pendingCloseSection);
                    hideCloseWarning();
                };
            }

            if (yesBtn) {
                yesBtn.onclick = () => {
                    if (pendingCloseSection) {
                        const tabToSave = openTabs.find(t => t.id === pendingCloseSection);
                        if (tabToSave) {
                            switchSection(tabToSave.type, false, tabToSave.id);
                            let saved = false;
                            const type = tabToSave.type;
                            if (type === 'sales') saved = saveBill();
                            else if (type === 'purchase') saved = savePurchase();
                            else if (type === 'sales-return') saved = saveSalesReturn();
                            else if (type === 'purchase-return') saved = savePurchaseReturn();
                            else if (type === 'adjustment') saved = saveAdjustment();
                            else if (type === 'receipt') saved = saveReceipt();
                            else if (type === 'disbursement') saved = saveDisbursement();
                            if (saved) {
                                actuallyCloseTab(pendingCloseSection);
                                hideCloseWarning();
                            } else {
                                hideCloseWarning();
                            }
                        }
                    }
                };
            }
        }

        // ================= نظام الترخيص والاشتراك (Bayan License System) =================