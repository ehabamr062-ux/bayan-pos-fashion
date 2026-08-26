// ============================================================
//  الأدوات والدوال المساعدة العامة والتنبيهات (General Helpers & UI Alerts)
// ============================================================
        // دالة التأخير (Debounce) لتحسين الأداء عند الكتابة في خانات البحث
        function debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        // --- النسخ المؤجلة (Debounced Versions) للوظائف المكثفة ---
        const debouncedHandleSearch = debounce((val) => { if (typeof handleSearch === 'function') handleSearch(val); }, 300);
        const debouncedHandleReturnSearch = debounce((val, type) => { if (typeof handleReturnSearch === 'function') handleReturnSearch(val, type); }, 300);
        const debouncedHandleCustomerSearch = debounce((val) => { if (typeof handleCustomerSearch === 'function') handleCustomerSearch(val); }, 300);
        const debouncedRenderInventoryTable = debounce(() => { if (typeof renderInventoryTable === 'function') renderInventoryTable(); }, 350);
        const debouncedHandlePriceAdjSearch = debounce(() => { if (typeof handlePriceAdjSearch === 'function') handlePriceAdjSearch(); }, 300);
        const debouncedHandleSupplierSearch = debounce((val) => { if (typeof handleSupplierSearch === 'function') handleSupplierSearch(val); }, 300);
        const debouncedHandlePurchaseSearch = debounce((val) => { if (typeof handlePurchaseSearch === 'function') handlePurchaseSearch(val); }, 300);



        async function getUniqueHWID() {
            let hwid = getStore('bayan_hwid');
            if (hwid) return hwid;

            try {
                if (typeof db !== 'undefined' && db.settings) {
                    const stored = await db.settings.get('hwid');
                    if (stored && stored.value) {
                        setStore('bayan_hwid', stored.value);
                        return stored.value;
                    }
                }
            } catch(e) {}

            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let part1 = '', part2 = '';
            for(let i=0; i<4; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
            for(let i=0; i<4; i++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
            hwid = `BNC-${part1}-${part2}`;

            try {
                if (typeof db !== 'undefined' && db.settings) {
                    await db.settings.put({ id: 'hwid', value: hwid });
                }
            } catch(e) {}
            setStore('bayan_hwid', hwid);
            return hwid;
        }
        window.getUniqueHWID = getUniqueHWID;

        // دالة نسخ كود الجهاز للحافظة
        function copyHwid() {
            const hwid = document.getElementById('displayHwid')?.innerText;
            if(!hwid || hwid.includes('جاري')) return;
            navigator.clipboard.writeText(hwid).then(() => {
                showToast("✅ تم نسخ كود الجهاز (HWID) بنجاح");
            });
        }

        // فتح رابط خارجي بأمان عبر IPC (Electron) أو متصفح عادي
        function openExternalUrl(url) {
            try {
                // الطريقة الأولى: ipcRenderer (الأسرع والأكثر أماناً مع main.js الحالي)
                if (window.require) {
                    const { ipcRenderer } = window.require('electron');
                    if (ipcRenderer) { ipcRenderer.invoke('open-url', url); return; }
                }
            } catch(e) {}
            // الطريقة الاحتياطية: فتح في المتصفح الافتراضي
            window.open(url, '_blank');
        }

        // تحديث واجهة الاشتراك في النافذة (Modal) بناءً على طلب المستخدم
        function copyText(text, btn) {
            navigator.clipboard.writeText(text).then(() => {
                const originalHTML = btn.innerHTML;
                // تبديل للأيقونة "صح" مع تغيير اللون لأخضر
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: white;"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                btn.style.background = "#27ae60";
                btn.style.borderColor = "#27ae60";

                if (typeof showToast === 'function') {
                    showToast("تم النسخ بنجاح ✨");
                }

                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.background = "#f8fafc";
                    btn.style.borderColor = "#e2e8f0";
                }, 1500);
            }).catch(err => {
                console.error('فشل النسخ: ', err);
            });
        }

        // 1. إنشاء قاعدة البيانات (BayanDatabase)
        function logAuditAction(action, details) {
            const entry = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                user: currentUser ? currentUser.name : 'System',
                userId: currentUser ? currentUser.id : 0,
                action: action, // e.g., 'DELETE_TRANSACTION', 'EDIT_USER'
                details: details,
                warehouse: currentUser ? currentUser.warehouseName : 'Unknown'
            };
            auditLogs.push(entry);
            console.log(`🛡️ Audit Log: ${action}`, entry);
            saveData(); // حفظ السجلات فورياً
        }
        let returnCart = []; // سلة مرتجع البيع
        let purReturnCart = []; // سلة مرتجع الشراء
        let currentAnalysisMode = 'detailed'; // وضع تحليل المبيعات (تفصيلي/تجميعي)
        function updateDatalists() {
            fillDatalist('discountReason', discountReasons);
            fillDatalist('taxReason', taxReasons);
            fillDatalist('purchaseDiscountReason', purchaseDiscountReasons);
            fillDatalist('purchaseTaxReason', purchaseTaxReasons);
            fillDatalist('categoriesList', window.inventoryCategories);
        }

        function fillDatalist(listId, array) {
            const list = document.getElementById(listId);
            if (!list) return;
            list.innerHTML = '';

            // إذا كان العنصر select، نضيف خيار "اختر" أولاً
            if (list.tagName === 'SELECT') {
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.innerText = '--- اختر ---';
                list.appendChild(emptyOpt);
            }

            array.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item;
                if (list.tagName === 'SELECT') opt.innerText = item;
                list.appendChild(opt);
            });
        }

        function addNewReason(value, array, listId) {
            if (value && !array.includes(value)) {
                array.push(value);
                saveData();
                updateDatalists();
            }
        }

        // --- دالة توليد الأرقام المتسلسلة ---
        function getNextSequence(typeKeyword) {
            // بحث عن جميع الحركات التي تطابق النوع المحدد حصراً
            const filtered = (typeof transactions !== 'undefined' ? transactions : []).filter(t => {
                if (!t || !t.type || t.invoiceId == null) return false;
                const tType = t.type;
                if (typeKeyword === 'بيع') return tType.includes('بيع') && !tType.includes('مرتجع');
                if (typeKeyword === 'شراء') return tType.includes('شراء') && !tType.includes('مرتجع');
                if (typeKeyword === 'مرتجع بيع') return tType.includes('مرتجع بيع') || (tType.includes('مرتجع') && tType.includes('بيع'));
                if (typeKeyword === 'مرتجع شراء') return tType.includes('مرتجع شراء') || (tType.includes('مرتجع') && tType.includes('شراء'));
                return tType.includes(typeKeyword);
            });
            if (filtered.length === 0) return 1;
            
            // إيجاد أعلى رقم فاتورة مستخدم بدلاً من عدّ الأسطر
            const maxId = Math.max(0, ...filtered.map(t => parseInt(t.invoiceId) || 0));
            return maxId + 1;
        }

        // --- مراقبة حالة الاتصال (Offline/Online) المباشرة والدورية ---
        window.addEventListener('online', () => updateConnectionStatus(true));
        window.addEventListener('offline', () => updateConnectionStatus(false));
        
        // فحص دوري تلقائي كل 8 ثواني لضمان تحول الحالة فورياً دون ريفريش
        setInterval(updateConnectionStatus, 8000);
        setTimeout(updateConnectionStatus, 1000);

        let _cachedStatusDiv = null;
        let _cachedStatusText = null;
        let _lastConnectionState = null;

        async function updateConnectionStatus(forcedState = null) {
            if (!_cachedStatusDiv) _cachedStatusDiv = document.getElementById('connectionStatus');
            if (!_cachedStatusText) _cachedStatusText = document.getElementById('statusText');
            if (!_cachedStatusDiv || !_cachedStatusText) return;
            
            const isOnline = typeof forcedState === 'boolean' ? forcedState : navigator.onLine;
            if (_lastConnectionState === isOnline) return; // منع إعادة الرسم غير الضروري
            _lastConnectionState = isOnline;
            
            if (isOnline) {
                _cachedStatusDiv.className = 'connection-status online';
                _cachedStatusText.innerText = 'متصل';
            } else {
                _cachedStatusDiv.className = 'connection-status offline';
                _cachedStatusText.innerText = 'أوفلاين';
            }
        }

        // --- تحديث الساعة والتاريخ المباشر (Optimized) ---
        let cachedTimeEl, cachedDateEl, cachedUserNameLabels, cachedTimeLabels;
        function updateTime() {
            if (!cachedTimeEl) cachedTimeEl = document.getElementById("time");
            if (!cachedDateEl) cachedDateEl = document.getElementById("date");

            let now = new Date();
            let timeStr = now.toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            let dateStr = now.toLocaleDateString("ar-EG", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            if (cachedTimeEl) cachedTimeEl.innerText = timeStr;
            if (cachedDateEl) cachedDateEl.innerText = dateStr;

            if (!cachedTimeLabels || now.getSeconds() % 5 === 0) {
                cachedTimeLabels = document.querySelectorAll('.timeLabel');
                cachedUserNameLabels = document.querySelectorAll('.userNameLabel');
            }

            cachedTimeLabels.forEach(el => el.innerText = timeStr);
            const userName = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'المدير العام (مدير)';
            cachedUserNameLabels.forEach(el => {
                if (el.innerText !== userName) el.innerText = userName;
            });

            const currentTab = (typeof openTabs !== 'undefined' && Array.isArray(openTabs)) ? openTabs.find(t => t.id === activeTabId) : null;
            if (currentTab) {
                const cfg = [
                    { s: 'sales', d: 'salesDate', t: 'salesTime' },
                    { s: 'purchase', d: 'purchaseDate', t: 'purchaseTime' },
                    { s: 'receipt', d: 'receiptDate', t: 'receiptTime' },
                    { s: 'disbursement', d: 'disburseDate', t: 'disburseTime' },
                    { s: 'sales-return', d: 'salesReturnDate', t: 'salesReturnTime' },
                    { s: 'purchase-return', d: 'purReturnDate', t: 'purReturnTime' },
                    { s: 'adjustment', d: 'adjDate', t: 'adjTime' }
                ].find(c => c.s === currentTab.type);

                if (cfg) {
                    const dEl = document.getElementById(cfg.d);
                    const tEl = document.getElementById(cfg.t);

                    if (dEl && document.activeElement !== dEl) {
                        const todayLocal = new Date().toLocaleDateString('en-CA');
                        if (dEl.readOnly || dEl.getAttribute('data-touched') !== 'true') {
                            dEl.value = todayLocal;
                        }
                    }
                    if (tEl && document.activeElement !== tEl) {
                        const timeISO = now.toTimeString().slice(0, 5);
                        if (tEl.readOnly || tEl.getAttribute('data-touched') !== 'true') {
                            tEl.value = timeISO;
                        }
                    }
                }
            }
        }

        updateTime();
        setInterval(updateTime, 1000);

        window.acknowledgedLowStock = [];
        window.acknowledgedExpiry = [];
        window.acknowledgedDebt = [];
        window.acknowledgedDelayed = [];

        window.isAccountFrozen = function(accountNameOrId) {
            if (!accountNameOrId) return false;
            let acc = null;
            if (typeof accountNameOrId === 'object') {
                acc = accountNameOrId;
            } else if (typeof accountNameOrId === 'number' || (!isNaN(Number(accountNameOrId)) && typeof accountNameOrId !== 'boolean')) {
                acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => a.id == accountNameOrId);
            }
            if (!acc && typeof accountNameOrId === 'string') {
                const trimmed = accountNameOrId.trim();
                acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => a.name && a.name.trim() === trimmed);
            }
            return acc ? (acc.inactive === true || acc.inactive === 'true' || acc.isFrozen === true) : false;
        };

        window.checkAccountFrozenAndAlert = function(accountNameOrId) {
            if (!accountNameOrId) return false;
            let accName = accountNameOrId;
            let acc = null;
            if (typeof accountNameOrId === 'object') {
                acc = accountNameOrId;
                accName = acc.name;
            } else if (typeof accountNameOrId === 'number' || (!isNaN(Number(accountNameOrId)) && typeof accountNameOrId !== 'boolean')) {
                acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => a.id == accountNameOrId);
                if (acc) accName = acc.name;
            }
            if (!acc && typeof accountNameOrId === 'string') {
                const trimmed = accountNameOrId.trim();
                acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => a.name && a.name.trim() === trimmed);
            }

            if (acc && (acc.inactive === true || acc.inactive === 'true' || acc.isFrozen === true)) {
                const msgText = '⚠️ الحساب "' + accName + '" مجمد حالياً!\nلا يمكن إجراء أي معاملات مالية أو فواتير (بيع / شراء / مرتجعات / سندات) على هذا الحساب حتى يتم إلغاء التجميد من قسم الحسابات.';
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'error',
                        titleText: '❄️ الحساب مجمد',
                        msg: msgText,
                        confirmText: 'حسناً',
                        cancelText: '✏️ تعديل الحساب',
                        showCancel: true,
                        onCancel: () => {
                            if (typeof switchSection === 'function') {
                                switchSection('accounts');
                            }
                            if (typeof selectAccountRow === 'function' && acc.id) {
                                selectAccountRow(acc.id);
                            }
                            if (typeof editSelectedAccount === 'function') {
                                setTimeout(() => {
                                    editSelectedAccount();
                                }, 150);
                            }
                        }
                    });
                } else {
                    alert(msgText);
                }
                return true;
            }
            return false;
        };

        function updateNotifications() {
            try {
                const raw = (typeof getStore === 'function') ? getStore('acknowledged_low_stock') : null;
                window.acknowledgedLowStock = raw ? JSON.parse(raw) : [];
            } catch(e) { window.acknowledgedLowStock = []; }
            try {
                const raw = (typeof getStore === 'function') ? getStore('acknowledged_expiry') : null;
                window.acknowledgedExpiry = raw ? JSON.parse(raw) : [];
            } catch(e) { window.acknowledgedExpiry = []; }
            try {
                const raw = (typeof getStore === 'function') ? getStore('acknowledged_debt') : null;
                window.acknowledgedDebt = raw ? JSON.parse(raw) : [];
            } catch(e) { window.acknowledgedDebt = []; }
            try {
                const raw = (typeof getStore === 'function') ? getStore('acknowledged_delayed') : null;
                window.acknowledgedDelayed = raw ? JSON.parse(raw) : [];
            } catch(e) { window.acknowledgedDelayed = []; }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const lowStockItems = (typeof productsDB !== 'undefined' ? productsDB : []).filter(p => (parseFloat(p.stock) || 0) <= (parseFloat(p.minStock) || 5) && !window.acknowledgedLowStock.includes(p.id));

            const expiringItems = (typeof productsDB !== 'undefined' ? productsDB : []).filter(p => {
                if (!p.expiry) return false;
                const exp = new Date(p.expiry);
                if (isNaN(exp.getTime())) return false;
                exp.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
                return diffDays <= 30 && !window.acknowledgedExpiry.includes(p.id);
            });

            const debtAccounts = (typeof accounts !== 'undefined' ? accounts : []).filter(a => {
                const debit = parseFloat(a.debit) || 0;
                const credit = parseFloat(a.credit) || 0;
                const balance = debit - credit;
                return (a.type === 'client' || a.type === 'mixed') && balance > 0 && !window.acknowledgedDebt.includes(a.id);
            });

            const delayedAccounts = (typeof accounts !== 'undefined' ? accounts : []).filter(a => {
                const balance = (parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0);
                if (!((a.type === 'client' || a.type === 'mixed') && balance > 0)) return false;
                if (window.acknowledgedDelayed.includes(a.id)) return false;

                const lastTrans = (typeof transactions !== 'undefined' ? transactions : []).filter(t => t.partnerId === a.id || t.account === a.name || t.partner === a.name).sort((x, y) => new Date(y.date || y.timestamp) - new Date(x.date || x.timestamp))[0];
                if (!lastTrans) return true;
                const lastDate = new Date(lastTrans.date || lastTrans.timestamp);
                const diffDays = Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24));
                return diffDays > 30;
            });

            const total = lowStockItems.length + expiringItems.length + debtAccounts.length + delayedAccounts.length;
            const badge = document.getElementById('notificationsBadge') || document.getElementById('bellBadge');
            if (badge) {
                badge.innerText = total;
                badge.style.display = total > 0 ? 'flex' : 'none';
            }
        }

        window.acknowledgeNotification = function(type, id, returnTab = 'products') {
            if (type === 'low-stock') {
                if (!window.acknowledgedLowStock.includes(id)) window.acknowledgedLowStock.push(id);
                const str = JSON.stringify(window.acknowledgedLowStock);
                setStore('acknowledged_low_stock', str);
            } else if (type === 'expiry') {
                if (!window.acknowledgedExpiry.includes(id)) window.acknowledgedExpiry.push(id);
                const str = JSON.stringify(window.acknowledgedExpiry);
                setStore('acknowledged_expiry', str);
            } else if (type === 'debt') {
                if (!window.acknowledgedDebt.includes(id)) window.acknowledgedDebt.push(id);
                const str = JSON.stringify(window.acknowledgedDebt);
                setStore('acknowledged_debt', str);
            } else if (type === 'delayed') {
                if (!window.acknowledgedDelayed.includes(id)) window.acknowledgedDelayed.push(id);
                const str = JSON.stringify(window.acknowledgedDelayed);
                setStore('acknowledged_delayed', str);
            }
            updateNotifications();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal(returnTab);
            }
            showToast("✅ تم وضع علامة استلام على التنبيه");
        };

        window.unacknowledgeNotification = function(type, id) {
            if (type === 'low-stock') {
                window.acknowledgedLowStock = window.acknowledgedLowStock.filter(x => x !== id);
                const str = JSON.stringify(window.acknowledgedLowStock);
                setStore('acknowledged_low_stock', str);
            } else if (type === 'expiry') {
                window.acknowledgedExpiry = window.acknowledgedExpiry.filter(x => x !== id);
                const str = JSON.stringify(window.acknowledgedExpiry);
                setStore('acknowledged_expiry', str);
            } else if (type === 'debt') {
                window.acknowledgedDebt = window.acknowledgedDebt.filter(x => x !== id);
                const str = JSON.stringify(window.acknowledgedDebt);
                setStore('acknowledged_debt', str);
            } else if (type === 'delayed') {
                window.acknowledgedDelayed = window.acknowledgedDelayed.filter(x => x !== id);
                const str = JSON.stringify(window.acknowledgedDelayed);
                setStore('acknowledged_delayed', str);
            }
            updateNotifications();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('archived');
            }
            showToast("🔄 تم استعادة التنبيه للنشط");
        };

        window.acknowledgeAllProductsNotifications = function() {
            const allLowStock = (typeof productsDB !== 'undefined' ? productsDB : []).filter(p => (parseFloat(p.stock) || 0) <= (parseFloat(p.minStock) || 5));
            allLowStock.forEach(p => {
                if (!window.acknowledgedLowStock.includes(p.id)) window.acknowledgedLowStock.push(p.id);
            });
            const str = JSON.stringify(window.acknowledgedLowStock);
            setStore('acknowledged_low_stock', str);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const allExpiring = (typeof productsDB !== 'undefined' ? productsDB : []).filter(p => {
                if (!p.expiry) return false;
                const exp = new Date(p.expiry);
                if (isNaN(exp.getTime())) return false;
                exp.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
                return diffDays <= 30;
            });
            allExpiring.forEach(p => {
                if (!window.acknowledgedExpiry.includes(p.id)) window.acknowledgedExpiry.push(p.id);
            });
            const expStr = JSON.stringify(window.acknowledgedExpiry);
            setStore('acknowledged_expiry', expStr);

            updateNotifications();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('products');
            }
            showToast("✅ تم تأكيد استلام كافة تنبيهات البضاعة والصلاحية!", "success");
        };

        window.acknowledgeAllAccountsNotifications = function() {
            const today = new Date();
            const allDebtAccounts = (typeof accounts !== 'undefined' ? accounts : []).filter(a => {
                const debit = parseFloat(a.debit) || 0;
                const credit = parseFloat(a.credit) || 0;
                const balance = debit - credit;
                return (a.type === 'client' || a.type === 'mixed') && balance > 0;
            });
            const allDelayed = (typeof accounts !== 'undefined' ? accounts : []).filter(a => {
                const balance = (parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0);
                if (!((a.type === 'client' || a.type === 'mixed') && balance > 0)) return false;
                const lastTrans = (typeof transactions !== 'undefined' ? transactions : []).filter(t => t.partnerId === a.id || t.account === a.name || t.partner === a.name).sort((x, y) => new Date(y.date || y.timestamp) - new Date(x.date || x.timestamp))[0];
                if (!lastTrans) return true;
                const lastDate = new Date(lastTrans.date || lastTrans.timestamp);
                const diffDays = Math.ceil((today - lastDate) / (1000 * 60 * 60 * 24));
                return diffDays > 30;
            });

            allDebtAccounts.forEach(a => {
                if (!window.acknowledgedDebt.includes(a.id)) window.acknowledgedDebt.push(a.id);
            });
            allDelayed.forEach(a => {
                if (!window.acknowledgedDelayed.includes(a.id)) window.acknowledgedDelayed.push(a.id);
            });

            const debtStr = JSON.stringify(window.acknowledgedDebt);
            const delayedStr = JSON.stringify(window.acknowledgedDelayed);
            setStore('acknowledged_debt', debtStr);
            setStore('acknowledged_delayed', delayedStr);

            updateNotifications();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('accounts');
            }
            showToast("✅ تم تأكيد استلام جميع تنبيهات الحسابات!", "success");
        };

        window.acknowledgeAllNotifications = function() {
            window.acknowledgeAllProductsNotifications();
            window.acknowledgeAllAccountsNotifications();
        };

        window.resetAcknowledgedNotifications = function() {
            window.acknowledgedLowStock = [];
            window.acknowledgedExpiry = [];
            window.acknowledgedDebt = [];
            window.acknowledgedDelayed = [];
            removeStore('acknowledged_low_stock');
            removeStore('acknowledged_expiry');
            removeStore('acknowledged_debt');
            removeStore('acknowledged_delayed');
            updateNotifications();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('archived');
            }
            showToast("🔄 تم تصفير الأرشيف واستعادة كافة التنبيهات للقوائم النشطة");
        };

        function getTransactionDateTime(dateId, timeId) {
            const now = new Date();
            const fallback = {
                full: now.toLocaleString('ar-EG'),
                iso: now.toLocaleDateString('en-CA'),
                time: now.toTimeString().slice(0, 5)
            };

            if (!dateId) return fallback;

            const dEl = typeof dateId === 'string' ? document.getElementById(dateId) : dateId;
            const tEl = typeof timeId === 'string' ? document.getElementById(timeId) : timeId;

            const d = dEl && dEl.value ? dEl.value : null;
            const t = tEl && tEl.value ? tEl.value : null;

            if (!d) return fallback;

            const dateObj = new Date(d + (t ? 'T' + t : 'T00:00'));
            return {
                full: isNaN(dateObj.getTime()) ? fallback.full : dateObj.toLocaleString('ar-EG'),
                iso: d,
                time: t || fallback.time
            };
        }

        // ================= منطق المشتريات (Purchase Logic) =================
        let purchaseCart = [];
        let purchaseTotalVal = 0;

        window.isGenericCashPartner = function(partnerName) {
            if (!partnerName) return true;
            const p = String(partnerName).trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            return p === '' || p === '-' || p === '---' || p === 'نقدي' || p === 'كاش' || p === 'عميل نقدي' || p === 'عميل عام' || p === 'مورد نقدي' || p === 'مورد عام' || p === 'غير محدد' || p === 'عام';
        };

        window.isTransactionCredit = function(methodName, total = 0, paid = 0, deferred = 0) {
            const mStr = String(methodName || '').toLowerCase().trim();
            
            // 1. إذا كانت طريقة الدفع صراحة آجل أو ذمم أو حساب
            if (mStr.includes('آجل') || mStr.includes('أجل') || mStr.includes('ذمم') || mStr.includes('حساب') || mStr.includes('دين') || mStr.includes('credit')) {
                return true;
            }
            
            // 2. التحقق من وسائل الدفع المعرفة في النظام
            if (typeof getPaymentMethods === 'function') {
                const methods = getPaymentMethods();
                const found = methods.find(m => m.name && m.name.toLowerCase().trim() === mStr);
                if (found) {
                    if (found.type === 'credit') return true;
                    if (found.type === 'cash' || found.type === 'bank') return false;
                }
            }

            // 3. إذا كانت الطريقة نقدي أو كاش أو شبكة أو بنك -> ليست آجلة أبداً
            if (mStr.includes('نقدي') || mStr.includes('كاش') || mStr.includes('cash') || mStr.includes('تحويل') || mStr.includes('فيزا') || mStr.includes('شبكة') || mStr.includes('بنك') || mStr.includes('bank') || mStr.includes('مدى') || mStr.includes('stc') || mStr.includes('فودافون') || mStr.includes('انستا')) {
                return false;
            }
            
            // 4. في حالة وجود متبقي حقيقي وتم تسجيل مدفوع جزئي (معاملة مختلطة غير نقدية بالكامل)
            if (deferred > 0.001) return true;
            if (total > 0 && paid > 0 && (total - paid) > 0.001) return true;

            return false;
        };

        window.ensurePartnerAccountExists = async function(partnerName, partnerType /* 'عميل' | 'مورد' */, isCredit, onApproved) {
            const isCash = window.isGenericCashPartner(partnerName);
            
            // 1. إذا كانت المعاملة آجلة والاسم نقدي أو فارغ -> نمنع الحفظ نهائياً
            if (isCredit && isCash) {
                showCustomAlert({
                    type: 'error',
                    titleText: `⚠️ مطلوب تحديد ${partnerType}`,
                    msg: `لا يمكن حفظ فاتورة أو حركة "آجلة" لحساب "نقدي" أو بدون تحديد طرف التعامل.<br><br>المعاملات الآجلة والمديونيات تتطلب <b>إلزامياً</b> اختيار أو تسجيل <b>${partnerType}</b> مسجل في قسم الحسابات لمتابعة رصيده وديونه.`
                });
                return false;
            }
            
            // 2. إذا كانت المعاملة نقدية (كاش) -> نسمح فوراً بالحفظ سواء كان الحساب نقدي عام أو اسم عميل اختياري
            if (!isCredit) {
                return true;
            }
            
            // 3. إذا كانت المعاملة آجلة، نتحقق هل الاسم مسجل في الحسابات أم لا
            const cleanArabic = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            const partnerClean = cleanArabic(partnerName);
            
            const existingAcc = (typeof accounts !== 'undefined' ? accounts : []).find(a => cleanArabic(a.name) === partnerClean);
            
            if (existingAcc) {
                return true; // موجود بالفعل -> تستمر العملية الأصلية بدون أي كولباك متكرر
            }
            
            // 4. الاسم غير مسجل في الحسابات -> نطلب من المستخدم إضافة سريعة وتسجيله في الحسابات فوراً
            showCustomAlert({
                type: 'question',
                titleText: `➕ تسجيل ${partnerType} جديد`,
                msg: `الاسم "<b>${partnerName}</b>" غير مسجل في شجرة الحسابات.<br><br>المعاملات الآجلة تتطلب تسجيل الطرف لمتابعة حسابه.<br><br>هل تريد إضافته كـ <b>${partnerType} جديد</b> في قسم الحسابات وحفظ الفاتورة مباشرة؟`,
                showCancel: true,
                confirmText: `نعم، سجّل كـ ${partnerType} واحفظ`,
                cancelText: 'إلغاء وتعديل الاسم',
                onConfirm: async () => {
                    const accType = partnerType === 'مورد' ? 'supplier' : 'client';
                    const codePrefix = partnerType === 'مورد' ? 'SUP-' : 'CLI-';
                    const newAcc = {
                        id: Date.now().toString(),
                        name: partnerName.trim(),
                        type: accType,
                        code: codePrefix + Math.floor(1000 + Math.random() * 9000),
                        debit: 0,
                        credit: 0,
                        balance: 0,
                        createdAt: new Date().toISOString()
                    };
                    
                    if (typeof accounts !== 'undefined') {
                        accounts.push(newAcc);
                    }
                    if (typeof db !== 'undefined' && db.accounts) {
                        try { await db.accounts.put(newAcc); } catch(e) { console.warn("DB account put:", e); }
                    }
                    if (typeof saveData === 'function') {
                        await saveData();
                    }
                    if (typeof renderAccountsTable === 'function') {
                        renderAccountsTable();
                    }
                    if (typeof showToast === 'function') {
                        showToast(`✅ تم تسجيل ${partnerType} "${partnerName}" بنجاح في الحسابات`, 'success');
                    }
                    if (typeof onApproved === 'function') onApproved(newAcc);
                }
            });
            
            return false;
        };

        function calculateChange() {
            const tenderedInput = document.getElementById('tenderedAmount');
            const tendered = parseFloat(tenderedInput ? tenderedInput.value : 0) || 0;
            const method = typeof getSelectedPaymentMethod === 'function' ? getSelectedPaymentMethod('sales-section') : 'نقدي';

            const changeElem = document.getElementById('changeAmount');
            const grandDebtElem = document.getElementById('grandDebtDisplay');
            const prevBal = parseFloat(document.getElementById('prevBalanceDisplay')?.innerText) || 0;

            const isCredit = window.isTransactionCredit(method, currentTotal, tendered, currentTotal - tendered);

            if (isCredit) {
                // في حالة البيع الآجل: العميل يدفع جزءاً من الفاتورة أو لا يدفع
                const remainingOnInvoice = Math.max(0, currentTotal - tendered);
                if (changeElem) changeElem.innerText = '0.00 (آجل)';

                // المديونية الكلية المتراكمة = المديونية السابقة + المتبقي غير المدفوع من الفاتورة الحالية
                const grandTotalDebt = prevBal + remainingOnInvoice;
                if (grandDebtElem) grandDebtElem.innerText = grandTotalDebt.toFixed(2);
            } else {
                // في حالة البيع النقدي أو البنكي:
                const change = Math.max(0, tendered - currentTotal);
                if (changeElem) changeElem.innerText = change.toFixed(2);

                // في الكاش لا تضاف مديونية جديدة من هذه الفاتورة
                if (grandDebtElem) grandDebtElem.innerText = prevBal.toFixed(2);
            }
        }

        function createBtn(container, value) {
            const btn = document.createElement('button');
            btn.className = 'quick-btn';
            btn.innerText = value;
            btn.onclick = () => {
                document.getElementById('tenderedAmount').value = value;
                calculateChange();
            };
            container.appendChild(btn);
        }

        function selectMethod(el) {
            let method = '';
            const section = el.closest('.section-view');

            if (el.tagName === 'SELECT') {
                method = el.value;
            } else {
                el.parentElement.querySelectorAll('.method-btn').forEach(b => b.classList.remove('selected'));
                el.classList.add('selected');
                method = el.innerText.trim();
            }

            const isCredit = window.isTransactionCredit(method);

            if (section) {
                // قسم البيع
                if (section.id === 'sales-section') {
                    const paidBox = document.getElementById('paidBox');
                    const remainingBox = document.getElementById('remainingBox');
                    const btnContainer = document.getElementById('dynamicButtons');
                    const tenderedInput = document.getElementById('tenderedAmount');

                    if (isCredit || method.includes('شيك')) {
                        if (paidBox) paidBox.style.display = 'flex';
                        if (remainingBox) remainingBox.style.display = 'flex';
                        if (btnContainer) btnContainer.style.display = 'flex';

                        // تصفير المدفوع تلقائياً عند اختيار آجل لضمان حساب المتبقي صح
                        if (tenderedInput) tenderedInput.value = 0;

                        // --- ميزة التنبيه الذكي والانتقال الفوري لمربع العميل عند اختيار آجل ---
                        const custInput = document.getElementById('customerName');
                        if (custInput) {
                            setTimeout(() => {
                                custInput.focus();
                                custInput.select();
                                if (typeof debouncedHandleCustomerSearch === 'function') {
                                    debouncedHandleCustomerSearch(custInput.value);
                                }
                            }, 50);
                            custInput.style.transition = 'all 0.3s ease';
                            custInput.style.backgroundColor = '#fef2f2';
                            custInput.style.border = '2.5px solid #ef4444';
                            custInput.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.35)';

                            if (window.isGenericCashPartner(custInput.value)) {
                                if (typeof showToast === 'function') {
                                    showToast("⚠️ البيع الآجل يتطلب تحديد واختيار حساب العميل", "warning");
                                }
                            }

                            setTimeout(() => {
                                custInput.style.backgroundColor = '';
                                custInput.style.border = '';
                                custInput.style.boxShadow = '';
                            }, 3500);
                        }

                        if (typeof calculateTotals === 'function') calculateTotals();
                    } else {
                        if (paidBox) paidBox.style.display = 'none';
                        if (remainingBox) remainingBox.style.display = 'none';
                        if (btnContainer) btnContainer.style.display = 'none';
                    }
                }
                // قسم الشراء
                else if (section.id === 'purchase-section') {
                    const purchasePaidBox = document.getElementById('purchasePaidBox');
                    const purchaseRemainingBox = document.getElementById('purchaseRemainingBox');
                    const purchasePaidInput = document.getElementById('purchasePaid');

                    if (isCredit || method.includes('شيك')) {
                        if (purchasePaidBox) purchasePaidBox.style.display = 'flex';
                        if (purchaseRemainingBox) purchaseRemainingBox.style.display = 'flex';

                        // تصفير المدفوع للمورد تلقائياً عند اختيار آجل
                        if (purchasePaidInput) purchasePaidInput.value = 0;

                        // تنبيه وانتقال فوري لمربع المورد
                        const supInput = document.getElementById('supplierName');
                        if (supInput) {
                            setTimeout(() => {
                                supInput.focus();
                                supInput.select();
                                if (typeof debouncedHandleSupplierSearch === 'function') {
                                    debouncedHandleSupplierSearch(supInput.value);
                                }
                            }, 50);
                            supInput.style.transition = 'all 0.3s ease';
                            supInput.style.backgroundColor = '#fef2f2';
                            supInput.style.border = '2.5px solid #ef4444';
                            supInput.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.35)';

                            if (window.isGenericCashPartner(supInput.value) && typeof showToast === 'function') {
                                showToast("⚠️ الشراء الآجل يتطلب تحديد واختيار حساب المورد", "warning");
                            }

                            setTimeout(() => {
                                supInput.style.backgroundColor = '';
                                supInput.style.border = '';
                                supInput.style.boxShadow = '';
                            }, 3500);
                        }

                        if (typeof calculatePurchaseTotals === 'function') calculatePurchaseTotals();
                    } else {
                        // في حالة النقدي، نخفي المربعات ونجعل المدفوع = الإجمالي
                        if (purchasePaidBox) purchasePaidBox.style.display = 'none';
                        if (purchaseRemainingBox) purchaseRemainingBox.style.display = 'none';

                        if (purchasePaidInput) {
                            const totalVal = parseFloat(document.getElementById('purchaseTotal')?.innerText) || 0;
                            purchasePaidInput.value = totalVal;
                        }

                        if (typeof calculatePurchaseTotals === 'function') calculatePurchaseTotals();
                    }
                }
            }
        }

        function getSelectedPaymentMethod(sectionId) {
            const select = document.getElementById(sectionId + 'PaymentMethodSelect');
            if (select) return select.value;

            const btn = document.querySelector('#' + sectionId + ' .method-btn.selected');
            return btn ? btn.innerText.trim() : 'نقدي';
        }

        // --- 3. الوظائف التشغيلية (حفظ، طباعة) ---

        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast-msg toast-${type}`;
            const icon = type === 'success' ? '✅' : (type === 'error' ? '🚫' : 'ℹ️');
            toast.innerHTML = `<span>${icon}</span> ${message}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 500);
            }, 3000);
        }

        // نافذة توجيه ذكية تظهر عند الضغط على أزرار التحكم بدون تحديد صنف
        window.showInventorySelectionGuide = function(actionType = 'تعديل') {
            if (document.getElementById('inv-selection-guide-modal')) return;

            const overlay = document.createElement('div');
            overlay.id = 'inv-selection-guide-modal';
            overlay.style.cssText = `
                position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75);
                z-index: 9999999; display: flex; align-items: center; justify-content: center;
                animation: updaterFadeIn 0.25s ease; direction: rtl; font-family: 'Cairo', 'Segoe UI', sans-serif;
            `;

            overlay.innerHTML = `
                <div style="background: #ffffff; border: 2.5px solid #7c3aed; border-radius: 24px; padding: 28px 32px; width: 480px; max-width: 92vw; box-shadow: 0 20px 50px rgba(124, 58, 237, 0.28); text-align: center; color: #0f172a; position: relative;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #ede9fe, #ddd6fe); border: 2px solid #7c3aed; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 16px; box-shadow: 0 6px 16px rgba(124, 58, 237, 0.2);">
                        💡
                    </div>
                    <h3 style="margin: 0 0 10px; font-size: 1.28rem; font-weight: 900; color: #1e1b4b;">
                        يرجى تحديد صنف من الجدول أولاً
                    </h3>
                    <p style="margin: 0 0 20px; font-size: 0.92rem; color: #475569; line-height: 1.8; font-weight: 700;">
                        لتتمكن من تنفيذ عملية <strong style="color: #7c3aed; background: #f5f3ff; padding: 2px 8px; border-radius: 6px; border: 1px solid #ddd6fe;">${actionType}</strong>، يجب أولاً اختيار الصنف المطلوب من جدول البضاعة.
                    </p>
                    
                    <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 14px 16px; margin-bottom: 22px; text-align: right; font-size: 0.88rem; color: #334155; font-weight: 800; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #10b981; font-size: 1.1rem;">✔️</span>
                            <span><strong>طريقة 1:</strong> اضغط كليك بالماوس على صف الصنف مباشرة في الجدول.</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #3b82f6; font-size: 1.1rem;">☑️</span>
                            <span><strong>طريقة 2:</strong> ضع علامة في المربع الصغير الموجود بجانب اسم الصنف.</span>
                        </div>
                    </div>

                    <button onclick="document.getElementById('inv-selection-guide-modal').remove();" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.96rem; cursor: pointer; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35); transition: 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        فهمت ذلك، حسناً ✅
                    </button>
                </div>
            `;

            document.body.appendChild(overlay);
        };

        // دالة التعديل من شريط الأدوات الذكي (مطورة لدعم التحديد المتعدد)
        function editSelectedInventoryItem() {
            if (typeof checkPermission === 'function' && !checkPermission('stock_edit')) return;
            
            // جمع المعرفات المحددة عبر كافة الطرق
            let targetIds = [];
            if (window.selectedInventoryIds && window.selectedInventoryIds.size > 0) {
                targetIds = Array.from(window.selectedInventoryIds);
            } else {
                const checkedBoxes = document.querySelectorAll('.inv-row-check:checked');
                checkedBoxes.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.getAttribute('data-id')) targetIds.push(parseInt(row.getAttribute('data-id')));
                });
            }

            if (targetIds.length === 0 && window.selectedInventoryId) {
                targetIds.push(window.selectedInventoryId);
            }

            if (targetIds.length === 0) {
                return showInventorySelectionGuide('تعديل بيانات الصنف');
            }

            if (targetIds.length === 1) {
                const p = productsDB.find(x => x.id === targetIds[0]);
                if (p) openNewItemModal(p);
            } else {
                // إذا كان أكثر من صنف، نفتح تعديل الأسعار المجمع
                openPriceAdjustmentModal();
            }
        }

        // دالة الحذف من شريط الأدوات الذكي (مطورة للحذف الجماعي وبأعلى طبقة ظهور)
        async function deleteSelectedInventoryItem() {
            if (typeof checkPermission === 'function' && !checkPermission('stock_delete')) return;
            
            let targetIds = [];
            if (window.selectedInventoryIds && window.selectedInventoryIds.size > 0) {
                targetIds = Array.from(window.selectedInventoryIds);
            } else {
                const checkedBoxes = document.querySelectorAll('.inv-row-check:checked');
                checkedBoxes.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.getAttribute('data-id')) targetIds.push(parseInt(row.getAttribute('data-id')));
                });
            }

            if (targetIds.length === 0 && window.selectedInventoryId) {
                targetIds.push(window.selectedInventoryId);
            }

            if (targetIds.length === 0) {
                return showInventorySelectionGuide('حذف الصنف');
            }

            const msg = targetIds.length === 1 ? "هل أنت متأكد من حذف هذا الصنف ونقله إلى سلة المحذوفات؟" : `هل أنت متأكد من حذف عدد (${targetIds.length}) أصناف مختارة ونقلها إلى سلة المحذوفات؟`;

            const proceedDelete = async () => {
                try {
                    // قبل الحذف، ننقلهم للسلة
                    for (const id of targetIds) {
                        const item = productsDB.find(p => p.id === id);
                        if (item && typeof trashManager !== 'undefined' && trashManager.moveToTrash) {
                            await trashManager.moveToTrash(item, 'product', item.name);
                        }
                    }

                    // حذف جماعي من قاعدة البيانات
                    await db.products.bulkDelete(targetIds);

                    // تحديث المصفوفة المحلية
                    productsDB = productsDB.filter(x => !targetIds.includes(x.id));

                    if (targetIds.includes(selectedInventoryId)) selectedInventoryId = null;
                    if (window.selectedInventoryIds) {
                        targetIds.forEach(id => window.selectedInventoryIds.delete(id));
                    }

                    renderInventoryTable();
                    if (typeof updateInventorySelectionUI === 'function') updateInventorySelectionUI();
                    showToast(`✅ تم نقل ${targetIds.length} أصناف إلى سلة المحذوفات بنجاح`, "success");
                } catch (err) {
                    console.error("Error in bulk delete:", err);
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({ type: 'error', titleText: 'خطأ', msg: 'حدث خطأ أثناء الحذف' });
                    } else {
                        alert("❌ حدث خطأ أثناء الحذف");
                    }
                }
            };

            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'error',
                    titleText: '🗑️ تأكيد حذف الصنف',
                    msg: msg,
                    confirmText: 'نعم، احذف الصنف',
                    cancelText: 'إلغاء وتراجع',
                    showCancel: true,
                    onConfirm: proceedDelete
                });
            } else if (confirm(msg)) {
                await proceedDelete();
            }
        }

        function toggleInventoryColumn(idx, show) {
            inventoryColumnVisibility[idx] = show;
            const jsonStr = JSON.stringify(inventoryColumnVisibility);
            setStore('pos_inv_cols', jsonStr);
            
            applyInventoryColumnVisibility();
        }

        function applyInventoryColumnVisibility() {
            const saved = getStore('pos_inv_cols');
            if (saved) {
                try {
                    inventoryColumnVisibility = JSON.parse(saved);
                } catch(e) {}
            }

            const allCols = ["0","1","quick","3","13","10","11","9","12","detailed","6","7","8","5","4","margin","2","internal"];
            allCols.forEach(idx => {
                const show = inventoryColumnVisibility[idx] !== false;
                const cells = document.querySelectorAll(`.col-inv-${idx}`);
                cells.forEach(c => {
                    c.style.display = show ? '' : 'none';
                });
                const check = document.getElementById(`inv_col_check_${idx}`);
                if (check) check.checked = show;
            });
        }

        async function saveInvEdits() {
            const id = parseInt(document.getElementById('invSelectedId').value);
            if (!id) return alert('⚠️ يرجى تحديد صنف من الجدول أولاً');

            const p = productsDB.find(x => x.id === id);
            if (!p) return alert('❌ الصنف غير موجود');

            const newCode = document.getElementById('invDisplayCode').value.trim();
            const newUnit = document.getElementById('invDisplayUnit').value;
            const newCost = parseFloat(document.getElementById('invDisplayCost').value) || 0;
            const newPrice = parseFloat(document.getElementById('invDisplayPrice').value) || 0;

            if (newPrice <= 0) return alert('⚠️ يرجى إدخال سعر بيع صحيح');

            p.code = newCode;
            p.unit = newUnit;
            p.cost = newCost;
            p.price = newPrice;

            await saveData();
            renderInventoryTable();
            alert(`✅ تم حفظ تعديلات الصنف: ${p.name}`);
        }

        function handleProductImage(event) {
            const file = event && event.target && event.target.files ? event.target.files[0] : null;
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('productImagePreview');
                const removeBtn = document.getElementById('removeProductImageBtn');
                currentProductImageData = e.target.result;
                if (preview) {
                    preview.style.backgroundImage = `url(${e.target.result})`;
                    Array.from(preview.childNodes).forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE) node.textContent = '';
                    });
                }
                if (removeBtn) {
                    removeBtn.classList.remove('hidden');
                    removeBtn.style.display = 'flex';
                }
            };
            reader.readAsDataURL(file);
        }

        function removeProductImage(event) {
            if (event) event.stopPropagation();
            const preview = document.getElementById('productImagePreview');
            const removeBtn = document.getElementById('removeProductImageBtn');
            const fileInput = document.getElementById('newItemImage');
            if (preview) {
                preview.style.backgroundImage = 'none';
                let hasText = false;
                Array.from(preview.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.textContent = '📷';
                        hasText = true;
                    }
                });
                if (!hasText) preview.insertAdjacentText('afterbegin', '📷');
            }
            currentProductImageData = null;
            if (removeBtn) {
                removeBtn.classList.add('hidden');
                removeBtn.style.display = 'none';
            }
            if (fileInput) fileInput.value = '';
        }

        function openNewItemModal(product = null) {
            document.getElementById('newItemModal').classList.remove('hidden');
            const nameEl = document.getElementById('newItemName');
            const preview = document.getElementById('productImagePreview');
            const removeBtn = document.getElementById('removeProductImageBtn');

            // تصفير الحقول قبل البدء
            document.querySelectorAll('#newItemModal input:not([type=radio]):not([type=checkbox]):not([type=file])').forEach(el => {
                if(el.type === 'number') el.value = "0";
                else el.value = "";
            });
            document.getElementById('newItemNotes').value = "";
            document.getElementById('productUnitsTableBody').innerHTML = "";

            // تعبئة قائمة التصنيفات في الداتاليست
            if (typeof updateDatalists === 'function') updateDatalists();

            // إعادة تعيين الصورة
            preview.style.backgroundImage = 'none';
            preview.innerText = '📷';
            currentProductImageData = null;
            if (removeBtn) removeBtn.classList.add('hidden');

            if (product && typeof product === 'object') {
                currentEditingProductId = product.id;
                fillProductModal(product);
            } else {
                currentEditingProductId = null;
                if (typeof product === 'string') nameEl.value = product;
                document.getElementById('newItemCategory').value = "عام";
                document.getElementById('isQuickItem').checked = false; // تصفير الاختيار للأصناف الجديدة
                addProductUnitRow('قطعة');
            }

            document.getElementById('newItemBarcode').focus();
            switchBayanTab('general', document.querySelector('.bayan-tab'));
            updateAllUnitSelects();
            if (typeof updateProductNavCounter === 'function') updateProductNavCounter();
        }
        window.showCustomPrompt = function(message, defaultValue = '') {
            return new Promise((resolve) => {
                const modal = document.getElementById('customPromptModal');
                const title = document.getElementById('customPromptTitle');
                const input = document.getElementById('customPromptInput');
                const confirmBtn = document.getElementById('customPromptConfirmBtn');
                const cancelBtn = document.getElementById('customPromptCancelBtn');
                
                if (!modal || !title || !input || !confirmBtn || !cancelBtn) {
                    resolve(prompt(message, defaultValue));
                    return;
                }
                
                title.innerText = message;
                input.value = defaultValue;
                modal.style.zIndex = '2147483647';
                modal.classList.remove('hidden');
                setTimeout(() => {
                    input.focus();
                    input.select();
                }, 50);
                
                function cleanup() {
                    modal.classList.add('hidden');
                    confirmBtn.onclick = null;
                    cancelBtn.onclick = null;
                    input.onkeydown = null;
                }
                
                confirmBtn.onclick = () => {
                    const val = input.value;
                    cleanup();
                    resolve(val);
                };
                
                cancelBtn.onclick = () => {
                    cleanup();
                    resolve(null);
                };
                
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        confirmBtn.click();
                    } else if (e.key === 'Escape') {
                        cancelBtn.click();
                    }
                };
            });
        };

        let activeAlertTimeout = null;
        window.closeCustomAlert = function() {
            const modal = document.getElementById('alertModal');
            if (modal) modal.classList.add('hidden');
            if (activeAlertTimeout) {
                clearTimeout(activeAlertTimeout);
                activeAlertTimeout = null;
            }
        };

        function showCustomAlert(options = {}) {
            if (activeAlertTimeout) {
                clearTimeout(activeAlertTimeout);
                activeAlertTimeout = null;
            }
            const modal = document.getElementById('alertModal');
            const icon = document.getElementById('alertIcon');
            const title = document.getElementById('alertTitle');
            const message = document.getElementById('alertMessage');
            const confirmBtn = document.getElementById('alertConfirmBtn');
            const cancelBtn = document.getElementById('alertCancelBtn');

            const {
                type = 'warning',
                titleText = 'تنبيه',
                msg = '',
                confirmText = 'حسناً',
                cancelText = 'تراجع',
                showCancel = false,
                timeout = (options.type === 'success' ? 5000 : null),
                onConfirm = () => { },
                onCancel = () => { }
            } = options;

            title.innerText = titleText;
            message.innerHTML = msg; // تم التغيير ليدعم الروابط
            confirmBtn.innerText = confirmText;
            cancelBtn.innerText = cancelText;

            // إعادة ضبط الستايلات الافتراضية
            confirmBtn.style.color = '#fff';
            cancelBtn.style.color = '#555';
            cancelBtn.style.background = '#edf0f2';

            // ضبط الأيقونة والألوان بناءً على النوع
            if (type === 'error') {
                icon.innerText = '🚫';
                title.style.color = '#c0392b';
                confirmBtn.style.setProperty('background', '#c0392b', 'important');
                confirmBtn.style.setProperty('color', '#ffffff', 'important');
                if (showCancel) {
                    cancelBtn.style.setProperty('background', '#2563eb', 'important');
                    cancelBtn.style.setProperty('color', '#ffffff', 'important');
                }
            } else if (type === 'success') {
                icon.innerText = '✅';
                title.style.color = '#1e8449';
                confirmBtn.style.setProperty('background', '#1e8449', 'important');
                confirmBtn.style.setProperty('color', '#ffffff', 'important');
            } else if (type === 'info') {
                icon.innerText = '👤';
                title.style.color = '#2980b9';
                confirmBtn.style.setProperty('background', '#2980b9', 'important');
                confirmBtn.style.setProperty('color', '#ffffff', 'important');
            } else if (type === 'question') {
                icon.innerText = '❓';
                title.style.color = '#8e44ad'; // Purple
                confirmBtn.style.setProperty('background', '#27ae60', 'important'); // Green
                confirmBtn.style.setProperty('color', '#ffffff', 'important');

                cancelBtn.style.setProperty('background', '#2980b9', 'important'); // Blue
                cancelBtn.style.setProperty('color', '#ffffff', 'important');
            } else {
                icon.innerText = '⚠️';
                title.style.color = '#f39c12';
                confirmBtn.style.setProperty('background', '#1e8449', 'important');
                confirmBtn.style.setProperty('color', '#ffffff', 'important');
            }

            cancelBtn.classList.toggle('hidden', !showCancel);

            confirmBtn.onclick = async () => {
                if (activeAlertTimeout) {
                    clearTimeout(activeAlertTimeout);
                    activeAlertTimeout = null;
                }
                modal.classList.add('hidden');
                try {
                    await onConfirm();
                } catch(err) {
                    console.error("Alert onConfirm error:", err);
                }
            };
            cancelBtn.onclick = async () => {
                if (activeAlertTimeout) {
                    clearTimeout(activeAlertTimeout);
                    activeAlertTimeout = null;
                }
                modal.classList.add('hidden');
                try {
                    await onCancel();
                } catch(err) {
                    console.error("Alert onCancel error:", err);
                }
            };


            modal.style.zIndex = '2147483647';
            modal.classList.remove('hidden');

            if (timeout && typeof timeout === 'number') {
                activeAlertTimeout = setTimeout(() => {
                    confirmBtn.click();
                }, timeout);
            }
        }

        function contactDeveloper() {
            let modal = document.getElementById('bayanHelpModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.remove('hidden');
            } else {
                window.open('https://wa.me/201006825905', '_blank');
            }
        }

        // --- دوال إعدادات الخط والتبويبات ---
        function adjustFontSize(change) {
            currentFontSize += change;
            applyFontSize(currentFontSize);
        }

        function adjustFontSizeExplicit(value) {
            currentFontSize = parseInt(value);
            applyFontSize(currentFontSize);
        }

        function applyFontSize(size) {
            if (size < 10) size = 10;
            if (size > 24) size = 24;
            currentFontSize = size;

            document.documentElement.style.setProperty('--app-font-size', size + 'px');
            const display = document.getElementById('currentFontSizeDisplay');
            if (display) display.innerText = size + 'px';

            const slider = document.getElementById('globalScaleSlider');
            if (slider) slider.value = size;

            // حفظ الإعداد مباشرة
            const settings = JSON.parse(getStore('pos_settings') || '{}');
            settings.fontSize = size;
            setStore('pos_settings', JSON.stringify(settings));
        }

        function openSettingsTab(tabName, btn) {
            document.querySelectorAll('.settings-tab-content').forEach(el => el.classList.add('hidden'));
            const target = document.getElementById('set-tab-' + tabName);
            if (target) target.classList.remove('hidden');

            // Handle all setting tab button classes & set active highlight
            document.querySelectorAll('.settings-tab-btn, .settings-tab-btn-premium, .premium-tab-btn').forEach(b => b.classList.remove('active'));
            if (btn) {
                btn.classList.add('active');
            } else {
                const targetBtn = document.querySelector(`.premium-tab-btn[onclick*="'${tabName}'"]`) ||
                                  document.querySelector(`.settings-tab-btn[onclick*="'${tabName}'"]`) ||
                                  document.querySelector(`.settings-tab-btn-premium[onclick*="'${tabName}'"]`) ||
                                  document.querySelector(`[data-tab="${tabName}"]`);
                if (targetBtn) targetBtn.classList.add('active');
            }

            if (tabName === 'general') {
                if (typeof renderPaymentMethodsSettings === 'function') renderPaymentMethodsSettings();
            } else if (tabName === 'users') {
                if (typeof renderUsersTable === 'function') renderUsersTable();
            } else if (tabName === 'printing') {
                loadPrintSettings();
                loadPrintTemplateChoice();
                if (typeof loadBarcodeLabelSettings === 'function') loadBarcodeLabelSettings();
            } else if (tabName === 'warehouses') {
                renderWarehousesTable();
                updateSettingsWarehouseSelects();
            } else if (tabName === 'trash') {
                if (typeof trashManager !== 'undefined' && trashManager.loadTrash) {
                    trashManager.loadTrash();
                } else if (typeof renderTrashTable === 'function') {
                    renderTrashTable();
                }
            }
        }

        function updateSettingsWarehouseSelects() {
            const select = document.getElementById('settingsActiveWarehouseSelect');
            if (!select) return;
            select.innerHTML = warehouses.map(w => `<option value="${w.name}" ${currentUser && currentUser.warehouseName === w.name ? 'selected' : ''}>${w.name}</option>`).join('');
        }

        // --- فلترة محتويات السلة (Cart Filter Logic) ---
        function filterCartItems(query) {
            const rows = document.querySelectorAll('#cartTableBody tr');
            const q = query.trim().toLowerCase();
            let firstMatch = null;

            rows.forEach(row => {
                // البحث في كل محتوى السطر (الاسم، السعر، الكمية، إلخ)
                const rowText = row.innerText.toLowerCase();
                if (rowText.includes(q)) {
                    row.style.display = "";
                    row.style.background = q !== "" ? "rgba(39, 174, 96, 0.15)" : ""; // تمييز باللون الأخضر
                    if (q !== "" && !firstMatch) firstMatch = row;
                } else {
                    row.style.display = "none";
                }
            });

            // تمرير تلقائي لأول صنف متطابق لسهولة التأكد
            if (firstMatch && q !== "") {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function filterPurchaseCartItems(query) {
            const rows = document.querySelectorAll('#purchaseTableBody tr');
            const q = query.trim().toLowerCase();
            let firstMatch = null;

            rows.forEach(row => {
                const rowText = row.innerText.toLowerCase();
                if (rowText.includes(q)) {
                    row.style.display = "";
                    row.style.background = q !== "" ? "rgba(52, 152, 219, 0.15)" : ""; // تمييز بالأزرق للمشتريات
                    if (q !== "" && !firstMatch) firstMatch = row;
                } else {
                    row.style.display = "none";
                }
            });

            if (firstMatch && q !== "") {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function openNewAccountModal() {
            // تصفير معرف التعديل لضمان أنها إضافة جديدة
            document.getElementById('editAccId').value = '';

            // تصفير الحقول
            document.querySelectorAll('#newAccountModal input:not([type=radio]):not([type=checkbox]):not([type=hidden]), #newAccountModal textarea').forEach(el => el.value = '');

            // تصفير الأرصدة الافتراضية
            if (document.getElementById('accDebit')) document.getElementById('accDebit').value = '0';
            if (document.getElementById('accCredit')) document.getElementById('accCredit').value = '0';

            document.getElementById('newAccountModal').classList.remove('hidden');
            // تعيين تاريخ اليوم للرصيد وتاريخ إنشاء الحساب في الفوتر
            const todayStr = new Date().toLocaleDateString('en-CA');
            document.getElementById('accBalDate').value = todayStr;
            const createdEl = document.getElementById('accCreatedAt');
            if (createdEl) createdEl.innerText = new Date().toLocaleDateString('ar-EG');
            document.getElementById('accName').focus();
        }

        function closeNewAccountModal() {
            document.getElementById('newAccountModal').classList.add('hidden');
        }

        function safeSetText(id, text) {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        }

        // ================= منطق استعلام الأصناف (Product Inquiry Logic) =================
        function handleInquirySearch(query) {
            query = query.trim().toLowerCase();
            const productListEl = document.getElementById('inquiryProductList');
            if (!productListEl) return;

            if (!query) {
                renderInquiryProductList(productsDB);
                return;
            }

            const filtered = productsDB.filter(p => {
                const nameMatch = p.name && p.name.toLowerCase().includes(query);
                const codeMatch = p.code && p.code.toLowerCase().includes(query);
                const barcodeMatch = p.barcode && p.barcode.toLowerCase() === query;
                const barcodeInclude = p.barcode && p.barcode.toLowerCase().includes(query);
                const unitBarcodeMatch = p.units && p.units.some(u => u.unitBarcode && u.unitBarcode.toLowerCase() === query);
                const unitBarcodeInclude = p.units && p.units.some(u => u.unitBarcode && u.unitBarcode.toLowerCase().includes(query));

                return nameMatch || codeMatch || barcodeMatch || barcodeInclude || unitBarcodeMatch || unitBarcodeInclude;
            });

            renderInquiryProductList(filtered);

            // اختيار تلقائي للصنف إذا كان هناك تطابق تام للباركود
            const exactMatch = filtered.find(p => 
                (p.barcode && p.barcode.toLowerCase() === query) || 
                (p.units && p.units.some(u => u.unitBarcode && u.unitBarcode.toLowerCase() === query))
            );
            if (exactMatch) {
                selectProductForInquiry(exactMatch.id);
            }
        }

        function renderInquiryProductList(products) {
            const productListEl = document.getElementById('inquiryProductList');
            if (!productListEl) return;

            if (products.length === 0) {
                productListEl.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 0.9rem;">⚠️ لا توجد نتائج مطابقة</div>';
                return;
            }

            productListEl.innerHTML = products.map(p => `
                <div class="inquiry-product-item" id="inquiry-item-${p.id}" onclick="selectProductForInquiry(${p.id})">
                    <div style="display: flex; flex-direction: column; gap: 4px; text-align: right;">
                        <div class="name">${p.name}</div>
                        <div class="code">كود: ${p.code || '---'} | باركود: ${p.barcode || '---'}</div>
                    </div>
                    <span style="font-size: 0.95rem; font-weight: 900; color: #6d28d9; white-space: nowrap;">${parseFloat(p.price || 0).toFixed(2)} ج.م</span>
                </div>
            `).join('');
        }

        function selectProductForInquiry(productId) {
            const product = productsDB.find(p => p.id === productId);
            if (!product) return;

            // تمييز العنصر النشط في القائمة
            document.querySelectorAll('.inquiry-product-item').forEach(el => el.classList.remove('active'));
            const activeItem = document.getElementById(`inquiry-item-${productId}`);
            if (activeItem) activeItem.classList.add('active');

            // إخفاء واجهة البداية وعرض المحتوى
            document.getElementById('inquiryEmptyState').classList.add('hidden');
            document.getElementById('inquiryDetailsContent').classList.remove('hidden');

            // تعبئة البيانات الأساسية
            document.getElementById('inquiryProductName').textContent = product.name;
            document.getElementById('inquiryProductCode').textContent = product.code || '---';
            document.getElementById('inquiryProductShelf').textContent = product.shelf || 'غير محدد';
            document.getElementById('inquiryProductCategory').textContent = product.category || 'عام';

            // الأسعار
            document.getElementById('inquiryPriceRetail').textContent = parseFloat(product.price || 0).toFixed(2);
            document.getElementById('inquiryPriceWholesale').textContent = parseFloat(product.wholesale || 0).toFixed(2);

            const costCard = document.getElementById('inquiryCostCard');
            if (checkPermission('docs_purchase_price')) {
                costCard.style.display = 'flex';
                document.getElementById('inquiryPriceCost').textContent = parseFloat(product.cost || product.cost_price || 0).toFixed(2);
            } else {
                costCard.style.display = 'none';
            }

            // توليد الباركود
            const svgEl = document.getElementById('inquiryBarcodeSvg');
            const barcodeValEl = document.getElementById('inquiryBarcodeValue');
            if (product.barcode) {
                try {
                    svgEl.style.display = 'block';
                    JsBarcode(svgEl, product.barcode, {
                        format: "CODE128",
                        width: 1.5,
                        height: 40,
                        displayValue: false
                    });
                    barcodeValEl.textContent = product.barcode;
                } catch (e) {
                    console.error("Barcode generation error:", e);
                    svgEl.style.display = 'none';
                    barcodeValEl.textContent = product.barcode + " (فشل التوليد البصري)";
                }
            } else {
                svgEl.style.display = 'none';
                barcodeValEl.textContent = "لا يوجد باركود";
            }

            // توزيع المخزون
            const stockTableBody = document.getElementById('inquiryWarehouseStockTableBody');
            let totalStock = 0;

            if (window.warehouses && window.warehouses.length > 0) {
                stockTableBody.innerHTML = window.warehouses.map(w => {
                    const qty = typeof getWarehouseStock === 'function' ? getWarehouseStock(product.name, w.name) : 0;
                    totalStock += qty;

                    let statusBadge = '';
                    if (qty <= 0) {
                        statusBadge = '<span style="background: #fee2e2; color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">نفذت الكمية</span>';
                    } else if (qty <= (product.minStock || 5)) {
                        statusBadge = '<span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">مخزون منخفض</span>';
                    } else {
                        statusBadge = '<span style="background: #dcfce7; color: #22c55e; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">متوفر</span>';
                    }

                    return `
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">${w.name} ${window.currentUser && window.currentUser.warehouseName === w.name ? '<span style="color: #10b981; font-size: 0.75rem;">(المخزن النشط حالياً)</span>' : ''}</td>
                            <td style="padding: 10px; text-align: center; font-weight: 900; font-size: 1rem; color: #1e293b;">${qty}</td>
                            <td style="padding: 10px; text-align: center;">${statusBadge}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                stockTableBody.innerHTML = `
                    <tr>
                        <td style="padding: 10px; font-weight: bold;">المخزن الرئيسي</td>
                        <td style="padding: 10px; text-align: center; font-weight: 900; font-size: 1rem; color: #1e293b;">${product.stock || 0}</td>
                        <td style="padding: 10px; text-align: center;">
                            ${(product.stock || 0) <= 0 ? '<span style="background: #fee2e2; color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">نفذت الكمية</span>' : '<span style="background: #dcfce7; color: #22c55e; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">متوفر</span>'}
                        </td>
                    </tr>
                `;
                totalStock = product.stock || 0;
            }

            document.getElementById('inquiryTotalStockBadge').textContent = `الإجمالي: ${totalStock}`;

            // جدول تشكيلات المقاسات والألوان (Variants Matrix)
            const variantsContainer = document.getElementById('inquiryVariantsContainer');
            const variantsTableBody = document.getElementById('inquiryVariantsTableBody');
            const variantsCountBadge = document.getElementById('inquiryVariantsCountBadge');
            
            if (variantsContainer && variantsTableBody) {
                const variants = (product.variants && Array.isArray(product.variants) && product.variants.length > 0) ? product.variants : [];
                if (variants.length > 0) {
                    variantsContainer.style.display = 'block';
                    if (variantsCountBadge) variantsCountBadge.textContent = `${variants.length} تشكيلة`;
                    
                    variantsTableBody.innerHTML = variants.map((v, idx) => {
                        const stockVal = parseFloat(v.stock !== undefined ? v.stock : 0);
                        const vRetail = parseFloat(v.price !== undefined ? v.price : product.price) || 0;
                        const vWs = parseFloat(v.wholesale !== undefined ? v.wholesale : product.wholesale) || 0;
                        
                        let stockBadge = '';
                        if (stockVal <= 0) {
                            stockBadge = '<span style="background: #fee2e2; color: #ef4444; padding: 2px 8px; border-radius: 10px; font-weight: 800; font-size: 0.78rem;">0 (نفذ)</span>';
                        } else {
                            stockBadge = `<span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 10px; font-weight: 900; font-size: 0.85rem;">${stockVal}</span>`;
                        }

                        return `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 8px; font-weight: 800; color: #64748b;">${idx + 1}</td>
                                <td style="padding: 8px;"><span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 6px; font-weight: 900;">${v.size || 'قياسي'}</span></td>
                                <td style="padding: 8px;"><span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px; font-weight: 900;">${v.color || 'موحد'}</span></td>
                                <td style="padding: 8px;">${stockBadge}</td>
                                <td style="padding: 8px; font-weight: 900; color: #1e3a8a;">${vRetail.toFixed(2)} ج.م</td>
                                <td style="padding: 8px; font-weight: 800; color: #166534;">${vWs.toFixed(2)} ج.م</td>
                                <td style="padding: 8px; font-family: monospace; font-weight: bold; color: #475569;">${v.barcode || '---'}</td>
                            </tr>
                        `;
                    }).join('');
                } else {
                    variantsContainer.style.display = 'none';
                }
            }

            // جدول الوحدات
            const unitsTableBody = document.getElementById('inquiryUnitsTableBody');
            if (product.units && product.units.length > 0) {
                unitsTableBody.innerHTML = product.units.map(u => `
                    <tr>
                        <td style="padding: 10px; font-weight: bold;">${u.unitName}</td>
                        <td style="padding: 10px; text-align: center; font-weight: 800;">${u.factor || 1}</td>
                        <td style="padding: 10px; text-align: center; font-weight: 900; color: #1e3a8a;">${parseFloat(u.price || 0).toFixed(2)} ج.م</td>
                        <td style="padding: 10px; text-align: center; font-family: monospace; color: #475569;">${u.unitBarcode || '---'}</td>
                    </tr>
                `).join('');
            } else {
                unitsTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; color: #94a3b8; padding: 15px;">لا توجد وحدات إضافية لهذا الصنف</td>
                    </tr>
                `;
            }
        }

        // --- وظائف المشاركة والطباعة الفورية ---

        // ================= 🤖 مساعد بيان الذكي (Gemini AI Assistant Logic) =================
        let isAIVoiceActive = false;
        let aiRecognition = null;
function buildInvoiceHTML(data, templateChoice) {
    const itemsHtml = data.items.map(item => {
        const unitName = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');
        return `
            <tr style="border-bottom:1px solid #ddd; font-style:normal !important;">
                <td style="padding:5px; text-align:right; font-style:normal !important; font-weight:bold;">${item.name}</td>
                <td style="padding:5px; text-align:center; font-style:normal !important; font-weight:bold;">${item.qty} ${unitName}</td>
                <td style="padding:5px; text-align:center; font-style:normal !important; font-weight:bold;">${(parseFloat(item.price) || 0).toFixed(2)}</td>
                <td style="padding:5px; text-align:left; font-style:normal !important; font-weight:bold;">${((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0)).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const compactItemsHtml = data.items.map(item => {
        const unitName = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');
        return `
            <tr style="font-style:normal !important; border-bottom:1px solid #ccc;">
                <td style="text-align:right; font-style:normal !important; font-weight:900; color:#000; padding:2px 0;">${item.name}</td>
                <td style="text-align:center; font-style:normal !important; font-weight:900; color:#000; padding:2px 0;">${item.qty}</td>
                <td style="text-align:left; font-style:normal !important; font-weight:900; color:#000; padding:2px 0;">${((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0)).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    let layout = '';

    if (templateChoice === 'A4 Professional' || templateChoice === 'A4') {
        layout = `
            <div class="print-container" style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction:rtl; padding:40px; background:#fff; color:#333; font-style:normal !important;">
                <div style="display:flex; justify-content:space-between; border-bottom:2px solid #2c3e50; padding-bottom:20px; margin-bottom:30px;">
                    <div>
                        <h1 style="margin:0; color:#2c3e50; font-size:2rem; font-style:normal !important;">${data.shopName}</h1>
                        <p style="margin:5px 0 0 0; color:#7f8c8d; font-style:normal !important;">${data.shopAddress}</p>
                        <p style="margin:5px 0 0 0; color:#7f8c8d; font-style:normal !important;">${data.shopPhone}</p>
                    </div>
                    <div style="text-align:left;">
                        <h2 style="margin:0; color:#e74c3c; font-size:1.8rem; font-style:normal !important;">${data.title}</h2>
                        <p style="margin:5px 0 0 0; font-weight:bold; font-style:normal !important;">رقم المستند: #${data.id}</p>
                        <p style="margin:5px 0 0 0; font-style:normal !important;">التاريخ: ${data.date}</p>
                    </div>
                </div>

                <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:30px; display:flex; justify-content:space-between;">
                    <div>
                        <strong style="color:#2c3e50; font-style:normal !important;">${data.partnerLabel}:</strong> ${data.partnerName} <br>
                        ${data.partnerAddress ? `<span style="color:#7f8c8d; font-style:normal !important;">العنوان: ${data.partnerAddress}</span>` : ''}
                    </div>
                    <div style="text-align:left;">
                        <strong style="color:#2c3e50; font-style:normal !important;">الكاشير:</strong> ${data.cashier}<br>
                        <strong style="color:#2c3e50; font-style:normal !important;">طريقة الدفع:</strong> ${data.paymentMethod}
                    </div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
                    <thead>
                        <tr style="background:#2c3e50; color:white;">
                            <th style="padding:12px; text-align:right; border:1px solid #34495e; font-style:normal !important;">الصنف</th>
                            <th style="padding:12px; text-align:center; border:1px solid #34495e; font-style:normal !important;">الكمية</th>
                            <th style="padding:12px; text-align:center; border:1px solid #34495e; font-style:normal !important;">سعر الوحدة</th>
                            <th style="padding:12px; text-align:left; border:1px solid #34495e; font-style:normal !important;">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="display:flex; justify-content:flex-end;">
                    <div style="width:300px; background:#f9f9f9; padding:20px; border-radius:8px; border:1px solid #eee;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:1.2rem; font-weight:bold; color:#2c3e50;">
                            <span style="font-style:normal !important;">الإجمالي الكلي:</span>
                            <span style="font-style:normal !important;">${data.total.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:#27ae60;">
                            <span style="font-style:normal !important;">المدفوع:</span>
                            <span style="font-style:normal !important;">${data.paid.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:#c0392b; font-weight:bold;">
                            <span style="font-style:normal !important;">المتبقي:</span>
                            <span style="font-style:normal !important;">${data.credit.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-top:50px; text-align:center; border-top:1px solid #ddd; padding-top:20px; color:#7f8c8d; font-style:normal !important;">
                    <p style="font-style:normal !important;">${data.footerMsg}</p>
                </div>
            </div>
        `;
    } else if (templateChoice === 'A5 Modern' || templateChoice === 'A5') {
        layout = `
            <div class="print-container" style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction:rtl; padding:20px; background:#fff; color:#333; font-style:normal !important;">
                <div style="text-align:center; margin-bottom:20px;">
                    <h1 style="margin:0; color:#34495e; font-size:1.6rem; font-style:normal !important;">${data.shopName}</h1>
                    <h2 style="margin:5px 0 0 0; color:#e67e22; font-size:1.2rem; font-style:normal !important;">${data.title}</h2>
                </div>

                <table style="width:100%; font-size:0.9rem; margin-bottom:15px;">
                    <tr>
                        <td style="width:50%; font-style:normal !important;"><b>رقم:</b> #${data.id}</td>
                        <td style="width:50%; text-align:left; font-style:normal !important;"><b>التاريخ:</b> ${data.date}</td>
                    </tr>
                    <tr>
                        <td style="width:50%; font-style:normal !important;"><b>${data.partnerLabel}:</b> ${data.partnerName}</td>
                        <td style="width:50%; text-align:left; font-style:normal !important;"><b>الدفع:</b> ${data.paymentMethod}</td>
                    </tr>
                </table>

                <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:0.9rem;">
                    <thead>
                        <tr style="background:#ecf0f1; border-bottom:2px solid #bdc3c7;">
                            <th style="padding:8px; text-align:right; font-style:normal !important;">الصنف</th>
                            <th style="padding:8px; text-align:center; font-style:normal !important;">الكمية</th>
                            <th style="padding:8px; text-align:center; font-style:normal !important;">السعر</th>
                            <th style="padding:8px; text-align:left; font-style:normal !important;">إجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <table style="width:100%; font-size:1rem; border-top:2px solid #34495e; padding-top:10px;">
                    <tr>
                        <td style="font-weight:bold; font-style:normal !important;">الصافي المطلوب:</td>
                        <td style="text-align:left; font-weight:bold; font-size:1.2rem; font-style:normal !important;">${data.total.toFixed(2)} ج.م</td>
                    </tr>
                    ${data.credit > 0 ? `
                    <tr>
                        <td style="color:#27ae60; font-size:0.9rem; font-style:normal !important;">المدفوع: ${data.paid.toFixed(2)}</td>
                        <td style="text-align:left; color:#c0392b; font-size:0.9rem; font-style:normal !important;">المتبقي: ${data.credit.toFixed(2)}</td>
                    </tr>` : ''}
                </table>

                <div style="text-align:center; margin-top:30px; font-size:0.8rem; color:#7f8c8d; font-style:normal !important;">
                    ${data.footerMsg}
                </div>
            </div>
        `;
    } else if (templateChoice === '57mm Mobile' || templateChoice === '57mm') {
        layout = `
            <div class="print-container" style="width:57mm; font-family:Arial, sans-serif; direction:rtl; padding:2mm; margin:0 auto; color:#000; font-size:11px; font-style:normal !important; font-weight:bold;">
                <div style="text-align:center; margin-bottom:5px; border-bottom:1px dashed #000; padding-bottom:5px;">
                    <strong style="font-size:14px; font-style:normal !important;">${data.shopName}</strong><br>
                    <span style="font-style:normal !important;">${data.title}</span>
                </div>
                <div style="margin-bottom:5px; font-style:normal !important;">
                    #${data.id} | ${data.date}<br>
                    ${data.partnerLabel}: ${data.partnerName}<br>
                    الدفع: ${data.paymentMethod}
                </div>
                <table style="width:100%; border-collapse:collapse; margin-bottom:5px; border-top:1px dashed #000; border-bottom:1px dashed #000;">
                    <tr style="border-bottom:1px solid #000;">
                        <th style="text-align:right; font-style:normal !important;">الصنف</th>
                        <th style="text-align:center; font-style:normal !important;">ك</th>
                        <th style="text-align:left; font-style:normal !important;">ق</th>
                    </tr>
                    ${compactItemsHtml}
                </table>
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:13px; font-style:normal !important;">
                    <span style="font-style:normal !important;">المطلوب:</span>
                    <span style="font-style:normal !important;">${data.total.toFixed(2)}</span>
                </div>
                ${data.credit > 0 ? `
                <div style="display:flex; justify-content:space-between; font-size:11px; font-style:normal !important;">
                    <span style="font-style:normal !important;">مدفوع:</span><span style="font-style:normal !important;">${data.paid.toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px; font-style:normal !important;">
                    <span style="font-style:normal !important;">باقي:</span><span style="font-style:normal !important;">${data.credit.toFixed(2)}</span>
                </div>` : ''}
                <div style="text-align:center; margin-top:5px; border-top:1px dashed #000; padding-top:5px; font-size:10px; font-style:normal !important;">
                    ${data.footerMsg}
                </div>
            </div>
        `;
    } else if (templateChoice === '80mm Compact') {
         layout = `
            <div class="print-container" style="width:80mm; font-family:Arial, sans-serif; direction:rtl; padding:3mm; margin:0 auto; color:#000; font-size:13px; font-style:normal !important; font-weight:900;">
                <div style="text-align:center; margin-bottom:5px; border-bottom:2px solid #000; padding-bottom:5px;">
                    <strong style="font-size:22px; font-weight:900; color:#000; font-style:normal !important;">${data.shopName}</strong><br>
                    ${data.shopAddress ? `<span style="font-size:14px; font-weight:900; color:#000; font-style:normal !important;">${data.shopAddress}</span><br>` : ''}
                    ${data.shopPhone ? `<span style="font-size:14px; font-weight:900; color:#000; font-style:normal !important;">ت: ${data.shopPhone}</span><br>` : ''}
                    <span style="font-size:16px; font-weight:900; border:2px solid #000; padding:2px 10px; display:inline-block; margin-top:5px; font-style:normal !important;">${data.title}</span>
                </div>

                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:900; margin-bottom:5px; font-style:normal !important; color:#000;">
                    <div style="text-align:right;">
                        <span style="font-style:normal !important;">كاشير: ${data.cashier}</span><br>
                        <span style="font-style:normal !important;">التاريخ: ${data.date}</span>
                    </div>
                    <div style="text-align:left;">
                        <span style="font-size:15px; font-style:normal !important;">رقم: #${data.id}</span>
                    </div>
                </div>

                <div style="font-size:13px; font-weight:900; border-bottom:2px solid #000; padding-bottom:3px; margin-bottom:5px; font-style:normal !important; color:#000;">
                    <div style="font-style:normal !important;">${data.partnerLabel}: ${data.partnerName}</div>
                    <div style="font-style:normal !important;">الدفع: ${data.paymentMethod}</div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:5px; border-top:2px solid #000; border-bottom:2px solid #000; font-weight:900; color:#000;">
                    <thead>
                        <tr style="border-bottom:2px solid #000;">
                            <th style="text-align:right; padding:2px; font-size:16px; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000; font-style:normal !important;">الصنف</th>
                            <th style="text-align:center; padding:2px; font-size:16px; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000; font-style:normal !important;">الكمية</th>
                            <th style="text-align:left; padding:2px; font-size:16px; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000; font-style:normal !important;">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${compactItemsHtml}
                    </tbody>
                </table>

                <div style="margin-bottom:5px; font-weight:900; font-size:14px; font-style:normal !important; color:#000;">
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">مبلغ الفاتورة:</span>
                        <span style="font-style:normal !important;">${(data.invoiceAmount || data.total).toFixed(2)}</span>
                    </div>
                    ${(data.prevBalance && data.prevBalance > 0) ? `
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">الرصيد السابق للعميل:</span>
                        <span style="font-style:normal !important;">${data.prevBalance.toFixed(2)}</span>
                    </div>` : ''}
                    <div style="display:flex; justify-content:space-between; font-size:17px; border-top:2px dashed #000; border-bottom:2px dashed #000; margin:3px 0; padding:2px 0; font-style:normal !important;">
                        <span style="font-style:normal !important;">الإجمالي المستحق:</span>
                        <span style="font-style:normal !important;">${data.total.toFixed(2)} ج.م</span>
                    </div>
                    ${data.credit > 0 ? `
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">المدفوع:</span>
                        <span style="font-style:normal !important;">${data.paid.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">الرصيد النهائي:</span>
                        <span style="font-style:normal !important;">${data.credit.toFixed(2)}</span>
                    </div>` : ''}
                </div>

                <div style="text-align:center; margin-top:10px; font-size:15px; font-weight:900; color:#000; font-style:normal !important;">
                    ${data.footerMsg}
                </div>
            </div>
        `;
    } else {
        // Default: 80mm Standard
        layout = `
            <div class="print-container" style="width:80mm; font-family:'Arial', 'Segoe UI', sans-serif; direction:rtl; padding:5px; color:#000; box-sizing:border-box; line-height:1.5; font-weight:bold; font-style:normal !important;">
                <div style="text-align:center; border-bottom:3px solid #000; padding-bottom:5px; margin-bottom:10px; font-style:normal !important;">
                    <div style="font-size:24px; font-weight:bold; font-style:normal !important;">${data.shopName}</div>
                    <div style="font-size:18px; font-weight:bold; border:2px solid #000; display:inline-block; padding:3px 15px; margin-top:5px; font-style:normal !important;">${data.title}</div>
                </div>

                <div style="font-size:13px; font-weight:bold; margin-bottom:10px; border-bottom:2px solid #000; padding-bottom:5px; font-style:normal !important;">
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">رقم: #${data.id}</span>
                        <span style="font-style:normal !important;">التاريخ: ${data.date}</span>
                    </div>
                    <div style="margin-top:3px; font-style:normal !important;">${data.partnerLabel}: ${data.partnerName} ${data.partnerAddress ? ' (' + data.partnerAddress + ')' : ''}</div>
                    <div style="display:flex; justify-content:space-between; margin-top:3px; font-style:normal !important;">
                        <span style="font-style:normal !important;">كاشير: ${data.cashier}</span>
                        <span style="font-style:normal !important;">الدفع: ${data.paymentMethod}</span>
                    </div>
                </div>

                <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:10px; border:2px solid #000; font-weight:bold; font-style:normal !important;">
                    <thead>
                        <tr style="border-bottom:2px solid #000; background:#fff; font-style:normal !important;">
                            <th style="text-align:right; padding:5px 2px; border-left:1px solid #000; font-size:15px; font-style:normal !important; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000;">الصنف</th>
                            <th style="padding:5px 2px; border-left:1px solid #000; font-size:15px; font-style:normal !important; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000;">الكمية</th>
                            <th style="padding:5px 2px; border-left:1px solid #000; font-size:15px; font-style:normal !important; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000;">السعر</th>
                            <th style="text-align:left; padding:5px 2px; font-size:15px; font-style:normal !important; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000;">إجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="margin-bottom:10px; font-size:14px; font-style:normal !important;">
                    <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:900; border-top:2px solid #000; border-bottom:2px solid #000; padding:5px 0; margin-bottom:5px; font-style:normal !important;">
                        <span style="font-style:normal !important;">صافي المطلوب:</span>
                        <span style="font-style:normal !important;">${data.total.toFixed(2)}</span>
                    </div>
                    ${data.credit > 0 ? `
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px; font-style:normal !important;">
                        <span style="font-style:normal !important;">المدفوع:</span>
                        <span style="font-style:normal !important;">${data.paid.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px; font-style:normal !important;">
                        <span style="font-style:normal !important;">المتبقي:</span>
                        <span style="font-style:normal !important;">${data.credit.toFixed(2)}</span>
                    </div>` : ''}
                </div>

                <div style="text-align:center; border-top:2px dashed #000; padding-top:10px; font-size:12px; font-style:normal !important;">
                    ${data.footerMsg}
                </div>
            </div>
        `;
    }

    return layout;
}

// ================= نظام إدارة تراخيص وصلاحيات الباقات الموحد =================
window.aiConversationHistory = window.aiConversationHistory || [];

function toggleAICopilot() {
    const drawer = document.getElementById('aiCopilotDrawer');
    if (!drawer) return;

    const isHidden = drawer.style.right === '-420px' || drawer.style.right === '';
    if (isHidden) {
        drawer.style.right = '0px';
        const alertBox = document.getElementById('aiKeyAlertBox');
        window.getGeminiApiKeys().then(keys => {
            if (alertBox) alertBox.style.display = (keys.length === 0) ? 'block' : 'none';
        });
        setTimeout(() => {
            document.getElementById('aiChatInput')?.focus();
        }, 400);
    } else {
        drawer.style.right = '-420px';
        if (typeof isAIVoiceActive !== 'undefined' && isAIVoiceActive) stopAIVoice();
    }
}

async function saveQuickAIKey() {
    const key = document.getElementById('aiQuickApiKeyInput').value.trim();
    if (!key) return alert('⚠️ يرجى إدخال مفتاح API صحيح');
    try {
        if (typeof db !== 'undefined' && db.settings) {
            await db.settings.put({ id: 'gemini_key', value: key });
            removeStore('bayan_gemini_key');
        }
    } catch(e) {
        setStore('bayan_gemini_key', key);
    }

    const settingsInput = document.getElementById('geminiApiKeyInput');
    if (settingsInput) settingsInput.value = key;

    document.getElementById('aiKeyAlertBox').style.display = 'none';
    showToast('✅ تم حفظ مفتاح API وتفعيل المساعد بنجاح!', 'success');
}

function getAILocalDatabaseContext() {
    const accountsList = (window.accounts || []).slice(0, 50).map(a => {
        const bal = typeof getAccountBalance === 'function' ? getAccountBalance(a.name) : 0;
        return `- ${a.name} (${a.type}): رصيده ${bal.toFixed(2)} ج.م`;
    }).join('\n');

    const productsList = (window.productsDB || []).slice(0, 100).map(p => {
        return `- ${p.name} (كود: ${p.code || '---'}, باركود: ${p.barcode || '---'}): المخزون العام: ${p.stock || 0} ${p.unit || 'قطعة'}, سعر البيع: ${p.price || 0} ج.م`;
    }).join('\n');

    const recentTransactions = (window.transactions || []).slice(-30).map(t => {
        return `- فاتورة #${t.invoiceId || 'بدون'} | التاريخ: ${t.date} | النوع: ${t.type} | الطرف: ${t.partner || 'عام'} | الإجمالي: ${t.total || t.price || 0} ج.م`;
    }).join('\n');

    const activeTab = window.activeTabId || 'dashboard';
    const user = (window.currentUser && window.currentUser.name) ? window.currentUser.name : 'المدير';

    return `
=== حالة النظام الحالية ===
- المستخدم الحالي: ${user}
- التبويب المفتوح حالياً: ${activeTab}

=== قائمة العملاء والموردين وأرصدتهم الحالية ===
${accountsList || 'لا توجد حسابات مسجلة حالياً.'}

=== قائمة المنتجات والأسعار والمخزون الحالي ===
${productsList || 'لا توجد أصناف في المخزن حالياً.'}

=== ملخص آخر 30 حركة مالية وفواتير ===
${recentTransactions || 'لا توجد فواتير مسجلة حالياً.'}
`;
}

window.getGeminiApiKeys = async function() {

    let apiKeys = [];
    try {
        if (typeof db !== 'undefined' && db.settings) {
            const stored = await db.settings.get('gemini_key');
            if (stored && stored.value) {
                apiKeys = stored.value.split(/[\s,;\|]+/).map(k => k.trim()).filter(Boolean);
            }
        }
    } catch(e) {}

    if (apiKeys.length === 0) {
        const userKeys = getStore('bayan_gemini_key');
        if (userKeys) {
            apiKeys = userKeys.split(/[\s,;\|]+/).map(k => k.trim()).filter(Boolean);
        }
    }
    return apiKeys;
};

function checkAILimits() {
    let usage = JSON.parse(getStore('bayan_ai_usage'));
    if (!usage) {
        usage = {
            currentCount: 0,
            lastResetTime: Date.now(),
            weeklyCount: 0,
            weeklyResetTime: Date.now()
        };
    }

    const now = Date.now();
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    if (now - usage.lastResetTime >= twelveHoursMs) {
        usage.currentCount = 0;
        usage.lastResetTime = now;
    }
    if (now - usage.weeklyResetTime >= sevenDaysMs) {
        usage.weeklyCount = 0;
        usage.weeklyResetTime = now;
    }

    setStore('bayan_ai_usage', JSON.stringify(usage));
    return usage;
}

function incrementAIUsage() {
    let usage = checkAILimits();
    usage.currentCount++;
    usage.weeklyCount++;
    setStore('bayan_ai_usage', JSON.stringify(usage));
    if (typeof window.updateAILimitsUI === 'function') window.updateAILimitsUI();
}

window.updateAILimitsUI = function() {
    const usage = checkAILimits();
    const currentPct = Math.min(100, Math.round((usage.currentCount / AI_LIMIT_12H) * 100));
    const currentTextEl = document.getElementById('aiCurrentUsageText');
    const currentBarEl = document.getElementById('aiCurrentUsageBar');

    if (currentTextEl) currentTextEl.innerText = `تم استخدام ${currentPct}%`;
    if (currentBarEl) {
        currentBarEl.style.width = `${currentPct}%`;
        currentBarEl.style.background = currentPct >= 100 ? '#ef4444' : '#f8fafc';
    }
};

async function sendAIChatMessage() {
    const usage = checkAILimits();
    if (usage.currentCount >= AI_LIMIT_12H) {
        showCustomAlert({
            type: 'warning',
            titleText: '⚠️ تنبيه!',
            msg: `لقد استنفدت الحد الأقصى للمساعد الذكي (${AI_LIMIT_12H} رسائل). يُعاد ضبط السقف خلال 12 ساعة.`
        });
        return;
    }

    const inputEl = document.getElementById('aiChatInput');
    const query = inputEl.value.trim();
    if (!query) return;

    const apiKeys = await window.getGeminiApiKeys();
    if (apiKeys.length === 0) {
        alert('⚠️ يرجى تعيين مفتاح Gemini API أولاً لتشغيل المساعد.');
        document.getElementById('aiKeyAlertBox').style.display = 'flex';
        return;
    }

    appendAIChatBubble(query, 'user');
    inputEl.value = '';

    const loadingId = 'ai-loading-' + Date.now();
    const messagesContainer = document.getElementById('aiChatMessages');
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'ai-loading-msg';
    loadingBubble.id = loadingId;
    loadingBubble.innerHTML = `<div class="ai-loading-dot"></div><div class="ai-loading-dot"></div><div class="ai-loading-dot"></div>`;
    messagesContainer.appendChild(loadingBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
        const dbContext = getAILocalDatabaseContext();
        const systemInstruction = `أنت "مساعد بَيَان الذكي" (Bayan AI Copilot)، خبير مالي وإداري محترف في نظام بَيَان المحاسبي. أجب باللغة العربية بأسلوب راقي ومبسط.`;
        const fullPrompt = `${systemInstruction}\n\nبيانات البرامج الحالية:\n${dbContext}\n\nسؤال المستخدم: ${query}`;

        let response = null;
        let lastError = null;
        for (let k = 0; k < apiKeys.length; k++) {
            try {
                response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKeys[k]}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] })
                });
                if (response.ok) { lastError = null; break; }
            } catch (e) { lastError = e; }
        }

        if (lastError || !response || !response.ok) throw lastError || new Error("فشلت المحاولة.");

        const data = await response.json();
        const replyText = data.candidates[0].content.parts[0].text || 'فشل في توليد إجابة.';

        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();

        incrementAIUsage();
        appendAIChatBubble(replyText, 'bot');
    } catch (err) {
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();
        appendAIChatBubble(`⚠️ مساعد بَيَان الذكي قيد التحديث، يرجى المحاولة لاحقاً.`, 'bot');
    }
}

function appendAIChatBubble(text, sender) {
    const messagesContainer = document.getElementById('aiChatMessages');
    if (!messagesContainer) return;

    const bubble = document.createElement('div');
    bubble.className = sender === 'user' ? 'ai-user-msg' : 'ai-bot-msg';

    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

    bubble.innerHTML = `<div style="line-height: 1.6;">${formattedText}</div>`;
    messagesContainer.appendChild(bubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ================= نافذة التنبيه وقف الحساب التلقائي (Bayan License Lock Modal) =================
function handleInquirySearch(query) {
    query = query.trim().toLowerCase();
    const productListEl = document.getElementById('inquiryProductList');
    if (!productListEl) return;

    if (!query) {
        renderInquiryProductList(productsDB);
        return;
    }

    const filtered = productsDB.filter(p => {
        const nameMatch = p.name && p.name.toLowerCase().includes(query);
        const codeMatch = p.code && p.code.toLowerCase().includes(query);
        const barcodeMatch = p.barcode && p.barcode.toLowerCase() === query;
        const barcodeInclude = p.barcode && p.barcode.toLowerCase().includes(query);
        return nameMatch || codeMatch || barcodeMatch || barcodeInclude;
    });

    renderInquiryProductList(filtered);
}

function renderInquiryProductList(products) {
    const productListEl = document.getElementById('inquiryProductList');
    if (!productListEl) return;

    if (products.length === 0) {
        productListEl.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 0.9rem;">⚠️ لا توجد نتائج مطابقة</div>';
        return;
    }

    productListEl.innerHTML = products.map(p => `
        <div class="inquiry-product-item" id="inquiry-item-${p.id}" onclick="selectProductForInquiry(${p.id})">
            <div style="display: flex; flex-direction: column; gap: 4px; text-align: right;">
                <div class="name">${p.name}</div>
                <div class="code">كود: ${p.code || '---'} | باركود: ${p.barcode || '---'}</div>
            </div>
            <span style="font-size: 0.95rem; font-weight: 900; color: #6d28d9; white-space: nowrap;">${parseFloat(p.price || 0).toFixed(2)} ${typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : 'ج.م'}</span>
        </div>
    `).join('');
}

// =========================================================================
// 💰 دالة رمز العملة الشاملة والموحدة (Global Reactive Currency Symbol)
// =========================================================================

