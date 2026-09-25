// ============================================================
//  سجل واستعراض عمليات البيع والتصدير (Sales History & Views)
// ============================================================
// دالة تطبيع الحروف العربية لدقة البحث
function normalizeArabicHist(text) {
    if (!text) return '';
    return String(text)
        .trim()
        .toLowerCase()
        .replace(/[إأآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '');
}
window.normalizeArabicHist = normalizeArabicHist;

function handleHistorySearch(query, event) {
    const resultsDiv = document.getElementById('historySearchResults');
    const input = document.getElementById('historySearch');
    if (!resultsDiv || !input) return;

    // التعامل مع أزرار الكيبورد (ArrowDown, ArrowUp, Enter, Escape)
    if (event) {
        const items = resultsDiv.querySelectorAll('.result-item');
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (items.length > 0) {
                historySearchActiveIndex = (historySearchActiveIndex + 1) % items.length;
                updateHistorySearchHighlight(items);
            }
            return;
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (items.length > 0) {
                historySearchActiveIndex = (historySearchActiveIndex - 1 + items.length) % items.length;
                updateHistorySearchHighlight(items);
            }
            return;
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (items.length > 0 && historySearchActiveIndex >= 0 && historySearchActiveIndex < items.length) {
                items[historySearchActiveIndex].click();
            } else if (items.length > 0) {
                items[0].click(); // اختيار أول صنف إذا لم يتم التحديد
            } else {
                resultsDiv.style.display = 'none';
                renderHistoryTable(input.value.trim());
            }
            return;
        } else if (event.key === 'Escape') {
            resultsDiv.style.display = 'none';
            historySearchActiveIndex = -1;
            return;
        }
    }

    historySearchActiveIndex = -1;
    resultsDiv.innerHTML = '';
    window.historyRenderLimit = 500;

    if (!query || !query.trim()) { 
        resultsDiv.style.display = 'none'; 
        renderHistoryTable(); 
        return; 
    }

    // البحث في قاعدة البيانات لاقتراح الصنف بالاسم أو الباركود الأساسي أو باركود المقاس واللون
    const cleanQuery = String(query).trim();
    const lowerQuery = cleanQuery.toLowerCase();
    const normQuery = normalizeArabicHist(cleanQuery);

    const filtered = (productsDB || []).filter(p => {
        if (!p) return false;
        const pNameNorm = normalizeArabicHist(p.name);
        if (pNameNorm.includes(normQuery)) return true;
        if (p.barcode && String(p.barcode).trim().toLowerCase().includes(lowerQuery)) return true;
        if (p.sysCode && String(p.sysCode).trim().toLowerCase().includes(lowerQuery)) return true;
        if (p.code && String(p.code).trim().toLowerCase().includes(lowerQuery)) return true;
        // فحص باركود التشكيلات (المقاسات والألوان)
        if (p.variants && Array.isArray(p.variants)) {
            if (p.variants.some(v => v.barcode && String(v.barcode).trim().toLowerCase().includes(lowerQuery))) return true;
        }
        // فحص باركود الوحدات
        if (p.units && Array.isArray(p.units)) {
            if (p.units.some(u => u.unitBarcode && String(u.unitBarcode).trim().toLowerCase().includes(lowerQuery))) return true;
        }
        return false;
    }).slice(0, 50);

    if (filtered.length > 0) {
        resultsDiv.style.display = 'block';

        filtered.forEach((p, idx) => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.setAttribute('data-index', idx);
            div.style.cssText = 'padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-weight: 700; transition: 0.15s;';
            
            const codeSpan = p.code ? `<span style="font-size:0.75rem; color:#94a3b8; margin-right:8px;">#${p.code}</span>` : '';
            div.innerHTML = `<span>📦 ${p.name} ${codeSpan}</span><span style="font-size:0.8rem; color:#059669; font-weight:900;">${(p.stock !== undefined ? p.stock : 0)} ${p.unit || ''}</span>`;

            div.onmouseover = () => {
                historySearchActiveIndex = idx;
                updateHistorySearchHighlight(resultsDiv.querySelectorAll('.result-item'));
            };

            div.onclick = () => {
                input.value = p.name;
                resultsDiv.style.display = 'none';
                historySearchActiveIndex = -1;
                renderHistoryTable(p.name);
            };

            resultsDiv.appendChild(div);
        });
    } else { 
        resultsDiv.style.display = 'none'; 
    }
}

function updateHistorySearchHighlight(items) {
    items.forEach((item, i) => {
        if (i === historySearchActiveIndex) {
            item.classList.add('selected');
            item.style.backgroundColor = '#f3e8ff';
            item.style.color = 'var(--main-purple)';
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('selected');
            item.style.backgroundColor = '';
            item.style.color = '';
        }
    });
}

function toggleHistoryColumn(index, isVisible) {

    const cells = document.querySelectorAll(`.col-hist-${index}`);

    cells.forEach(c => c.style.display = isVisible ? '' : 'none');

    // حفظ التفضيلات

    let historyCols = JSON.parse(getStore('pos_hist_cols') || '{}');

    historyCols[index] = isVisible;

    setStore('pos_hist_cols', JSON.stringify(historyCols));

}

function applyHistoryColumnVisibility() {
    let historyCols = JSON.parse(getStore('pos_hist_cols') || '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true,"11":true}');

    for (let i = 0; i <= 11; i++) {
        const isVisible = historyCols[i] !== false;
        toggleHistoryColumn(i, isVisible);

        // تحديث الشيك بوكس في القائمة المنبثقة
        const checkbox = document.querySelector(`#historyColCheckboxes input[onchange*="(${i},"]`);
        if (checkbox) checkbox.checked = isVisible;
    }
}

// متغيرات نظام التصفح والتحميل الذكي لسجل الحركات
window.historyRenderLimit = 500;

window.loadMoreHistory = function(step) {
    if (step === 0) {
        window.historyRenderLimit = Infinity;
    } else {
        window.historyRenderLimit = (window.historyRenderLimit || 500) + step;
    }
    renderHistoryTable();
};

// متخصص لفلترة الفترة في صفحة الحركة
function applyHistoryPeriodFilter(period) {
    window.historyRenderLimit = 500;

    const fromInput = document.getElementById('historyDateFrom');

    const toInput = document.getElementById('historyDateTo');

    const customDatesDiv = document.getElementById('historyCustomDates');

    const today = new Date();

    const todayStr = today.toLocaleDateString('en-CA');

    if (period === 'custom') {

        customDatesDiv.style.opacity = '1';

        customDatesDiv.style.pointerEvents = 'auto';

        return; // نترك المستخدم يختار

    }

    if (period === 'today') {

        fromInput.value = todayStr;

        toInput.value = todayStr;

    } else if (period === 'yesterday') {

        const yest = new Date();

        yest.setDate(yest.getDate() - 1);

        const yestStr = yest.toLocaleDateString('en-CA');

        fromInput.value = yestStr;

        toInput.value = yestStr;

    } else if (period === 'last7days') {

        const last7 = new Date();

        last7.setDate(last7.getDate() - 7);

        fromInput.value = last7.toLocaleDateString('en-CA');

        toInput.value = todayStr;

    } else if (period === 'thismonth') {

        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

        fromInput.value = firstDay.toLocaleDateString('en-CA');

        toInput.value = todayStr;

    } else if (period === 'all') {

        fromInput.value = '';

        toInput.value = '';

    }

    renderHistoryTable();

    if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

}

/**
 * 🧮 حساب الرصيد التراكمي الفعلي لكل صنف وتشكيلة لحظة كل حركة تاريخية (Running Ledger Balance)
 */
function computeTransactionRunningBalances(targetWarehouse = 'all') {
    const balanceMap = new Map();
    if (typeof transactions === 'undefined' || !Array.isArray(transactions) || transactions.length === 0) {
        return balanceMap;
    }

    const isSpecificWh = (targetWarehouse && targetWarehouse !== 'all');
    const productGroups = {};

    transactions.forEach((t, origIdx) => {
        if (!t || !t.product) return;
        const isInvTx = ['بيع', 'شراء', 'مرتجع', 'تسوية', 'تحويل'].some(k => t.type && t.type.includes(k));
        if (!isInvTx) return;
        if (t.type && t.type.includes('تحويل') && t.transferStatus === 'rejected') return;

        // فلترة الحركات الخاصة بالمخزن عند تحديد مخزن معين
        if (isSpecificWh) {
            const isTransfer = t.type && t.type.includes('تحويل');
            if (isTransfer) {
                const src = t.sourceWarehouse || t.fromWarehouse || t.warehouse;
                const dst = t.toWarehouse || t.destWarehouse;
                if (src !== targetWarehouse && dst !== targetWarehouse) return;
            } else {
                const tWh = t.warehouse || 'المخزن الرئيسي';
                if (tWh !== targetWarehouse) return;
            }
        }

        const pName = String(t.product || '').trim();
        const sSize = String(t.size || t.selectedSize || '').trim();
        const sColor = String(t.color || t.selectedColor || '').trim();
        const key = `${pName}___${sSize}___${sColor}`;

        if (!productGroups[key]) {
            productGroups[key] = {
                productName: pName,
                size: sSize,
                color: sColor,
                txList: []
            };
        }
        productGroups[key].txList.push({ t, origIdx });
    });

    const prodMap = new Map();
    if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
        for (let pi = 0; pi < productsDB.length; pi++) {
            const item = productsDB[pi];
            if (item) {
                if (item.name) prodMap.set(String(item.name).trim(), item);
                if (item.id) prodMap.set(String(item.id), item);
            }
        }
    }

    Object.values(productGroups).forEach(grp => {
        const p = prodMap.get(grp.productName) || null;

        let currentStock = 0;
        if (p) {
            if (grp.size || grp.color) {
                const v = (p.variants && Array.isArray(p.variants))
                    ? p.variants.find(x => 
                        (!grp.size || String(x.size || '').trim() === grp.size) && 
                        (!grp.color || String(x.color || '').trim() === grp.color)
                    ) : null;
                if (v) {
                    if (isSpecificWh && v.warehouseStocks && v.warehouseStocks[targetWarehouse] !== undefined) {
                        currentStock = parseFloat(v.warehouseStocks[targetWarehouse]) || 0;
                    } else if (isSpecificWh) {
                        currentStock = (targetWarehouse === 'المخزن الرئيسي') ? (parseFloat(v.stock) || 0) : 0;
                    } else {
                        currentStock = parseFloat(v.stock) || 0;
                    }
                } else {
                    if (isSpecificWh && p.warehouseStocks && p.warehouseStocks[targetWarehouse] !== undefined) {
                        currentStock = parseFloat(p.warehouseStocks[targetWarehouse]) || 0;
                    } else if (isSpecificWh) {
                        currentStock = (targetWarehouse === 'المخزن الرئيسي') ? (parseFloat(p.stock) || 0) : 0;
                    } else {
                        currentStock = parseFloat(p.stock) || 0;
                    }
                }
            } else {
                if (isSpecificWh && p.warehouseStocks && p.warehouseStocks[targetWarehouse] !== undefined) {
                    currentStock = parseFloat(p.warehouseStocks[targetWarehouse]) || 0;
                } else if (isSpecificWh) {
                    currentStock = (targetWarehouse === 'المخزن الرئيسي') ? (parseFloat(p.stock) || 0) : 0;
                } else {
                    currentStock = parseFloat(p.stock) || 0;
                }
            }
        }

        let running = currentStock;
        for (let i = grp.txList.length - 1; i >= 0; i--) {
            const item = grp.txList[i];
            balanceMap.set(item.origIdx, running);

            const factor = parseFloat(item.t.unitFactor) || 1;
            const qty = (parseFloat(item.t.qty) || 0) * factor;
            const type = item.t.type || '';

            let delta = 0;
            if (type.includes('تحويل')) {
                if (item.t.transferStatus === 'received') {
                    if (isSpecificWh) {
                        const src = item.t.sourceWarehouse || item.t.fromWarehouse || item.t.warehouse;
                        const dst = item.t.toWarehouse || item.t.destWarehouse;
                        if (dst === targetWarehouse) {
                            delta = qty; // وارد للمخزن
                        } else if (src === targetWarehouse) {
                            delta = -qty; // صادر من المخزن
                        } else {
                            delta = -qty;
                        }
                    } else {
                        delta = -qty;
                    }
                } else {
                    delta = 0; // تحويل معلق أو مرفوض لا يؤثر على حركة الرصيد
                }
            } else if (type.includes('شراء') && !type.includes('مرتجع')) {
                delta = qty;
            } else if (type.includes('مرتجع بيع')) {
                delta = qty;
            } else if (type.includes('بيع') && !type.includes('مرتجع')) {
                delta = -qty;
            } else if (type.includes('مرتجع شراء')) {
                delta = -qty;
            } else if (type.includes('تسوية')) {
                delta = qty;
            }

            running = running - delta;
        }
    });

    return balanceMap;
}

async function renderHistoryTable(filterName = null) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    const fromDate = document.getElementById('historyDateFrom')?.value;
    const toDate = document.getElementById('historyDateTo')?.value;
    const typeFilter = document.getElementById('historyTypeFilter')?.value;
    const methodFilter = document.getElementById('historyMethodFilter')?.value;
    const whFilter = document.getElementById('historyWarehouseFilter')?.value || 'all';

    // ⚡ جلب حركات الفترة المحددة من SQLite عند الطلب
    if (typeof window.loadTransactionsForDateRange === 'function' && (fromDate || toDate)) {
        const todayISO = new Date().toLocaleDateString('en-CA');
        if (fromDate < todayISO || toDate < todayISO) {
            await window.loadTransactionsForDateRange(fromDate, toDate);
        }
    }

    if (!filterName) {
        const searchVal = document.getElementById('historySearch')?.value?.trim();
        if (searchVal) filterName = searchVal;
    }

    tbody.innerHTML = '';

    // حساب الأرصدة التراكمية الدقيقة لكافة الحركات بناءً على فلتر المخزن
    const balanceMap = computeTransactionRunningBalances(whFilter);

    // الحفاظ على الفهرس الأصلي للعملية بدون استهلاك الذاكرة أو استنساخ آلاف الكائنات
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i]) transactions[i].originalIndex = i;
    }
    let data = transactions;

    // 🔒 حماية وخصوصية حركات المبيعات بحسب دور ونطاق المستخدم الحالي
    const activeUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : window.currentUser;
    if (activeUser && activeUser.role !== 'admin') {
        const invScope = activeUser.invoiceScope || 'user_only';
        const myName = (activeUser.name || '').trim().toLowerCase();
        const adminNames = (typeof window.getAdminUserNames === 'function') 
            ? window.getAdminUserNames() 
            : new Set(['المدير', 'المدير العام', 'مدير النظام', 'admin']);

        if (invScope === 'user_only') {
            // 👤 حصر تام بمبيعات وحركات هذا الموظف فقط (حسب حسابه الشخصي وورديته)
            data = data.filter(t => {
                const tUser = (t.user || '').trim().toLowerCase();
                return tUser && tUser === myName;
            });
        } else if (invScope === 'hide_admin') {
            // 🛡️ حجب فواتير كافة حسابات مديري النظام ديناميكياً
            data = data.filter(t => {
                const tUser = (t.user || '').trim().toLowerCase();
                return !adminNames.has(tUser);
            });
        } else if (invScope === 'terminal_only') {
            let myLetter = (window.BayanNetworkHub && typeof window.BayanNetworkHub.getTerminalLetter === 'function') 
                ? window.BayanNetworkHub.getTerminalLetter() 
                : (window.localNetworkHub && window.localNetworkHub.deviceLetter) || (typeof getStore === 'function' ? getStore('local_device_letter') : '') || '';
            data = data.filter(t => {
                const tUser = (t.user || '').trim().toLowerCase();
                let tLetter = t.terminalLetter;
                if (!tLetter && t.terminal) {
                    const match = t.terminal.match(/\(([A-Z])\)/i);
                    if (match) tLetter = match[1].toUpperCase();
                }
                const isMyTerminal = myLetter && (tLetter && tLetter.toUpperCase() === myLetter.toUpperCase());
                const isMyUser = tUser && (tUser === myName);
                return isMyTerminal || isMyUser;
            });
        } else if (invScope === 'warehouse_only') {
            const userWh = (activeUser.warehouseScope === 'main') 
                ? 'المخزن الرئيسي' 
                : (activeUser.assignedWarehouse || 'المخزن الرئيسي');
            data = data.filter(t => (t.warehouse || 'المخزن الرئيسي') === userWh);
        } else if (invScope === 'hide_master') {
            data = data.filter(t => {
                const rawTerminal = t.terminal || '';
                let letter = t.terminalLetter;
                if (!letter) {
                    const match = rawTerminal.match(/\(([A-Z])\)/i);
                    if (match) letter = match[1].toUpperCase();
                    else if (rawTerminal.includes('الرئيسي') || rawTerminal.includes('Master')) letter = 'MASTER';
                }
                const tUser = (t.user || '').trim().toLowerCase();
                const isMaster = (letter === 'MASTER') || rawTerminal.includes('الرئيسي') || rawTerminal.includes('Master') || adminNames.has(tUser);
                return !isMaster;
            });
        }
    }

    // 1. فلترة إجبارية: عرض الحركات المخزنية فقط (استبعاد القبض والصرف المالي البحت، واستبعاد التحويلات المرفوضة الملغاة)
    data = data.filter(t => ['بيع', 'شراء', 'مرتجع', 'تسوية', 'تحويل'].some(k => t.type && t.type.includes(k)));
    data = data.filter(t => !(t.type && t.type.includes('تحويل') && t.transferStatus === 'rejected'));

    // 2. فلترة الأصناف: استبعاد سجلات الرأس (Head) التي لا تحتوي على صنف فعلي
    data = data.filter(t => t.product);

    // فلترة بالتاريخ (مرنة تدعم dateISO و date)
    if (fromDate) data = data.filter(t => (t.dateISO ? t.dateISO >= fromDate : (t.date && t.date >= fromDate)));
    if (toDate) data = data.filter(t => (t.dateISO ? t.dateISO <= toDate : (t.date && t.date <= toDate)));

    if (typeFilter && typeFilter !== 'all') {
        if (typeFilter === 'بيع') {
            data = data.filter(t => t.type.includes('بيع') && !t.type.includes('مرتجع'));
        } else if (typeFilter === 'شراء') {
            data = data.filter(t => t.type.includes('شراء') && !t.type.includes('مرتجع'));
        } else {
            data = data.filter(t => t.type.includes(typeFilter));
        }
    }

    // فلترة بطريقة السداد
    if (methodFilter && methodFilter !== 'all') {
        if (methodFilter === 'cash') {
            data = data.filter(t => t.method && (t.method.includes('نقدية') || t.method.includes('نقدي') || t.method.includes('كاش')) && !t.method.includes('فودافون') && !t.method.includes('فودافن') && !t.method.includes('vodafone') && !t.method.includes('voda') && !t.method.includes('اورنج') && !t.method.includes('اتصالات') && !t.method.includes('انستا') && !t.method.includes('فيزا') && !t.method.includes('بنك'));
        } else if (methodFilter === 'credit') {
            data = data.filter(t => t.method && (t.method.includes('آجل') || t.method.includes('اجل') || t.method.includes('ذمم')));
        }
    }

    // فلترة بالاسم أو الباركود (إذا تم تمريره)
    if (filterName) {
        const cleanFilter = String(filterName).trim();
        const fNorm = (typeof normalizeArabicHist === 'function') ? normalizeArabicHist(cleanFilter) : cleanFilter.toLowerCase();
        
        // فحص ما إذا كان المدخل باركود صنف أو تشكيلة أو كود
        let matchedProductNames = new Set();
        if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
            productsDB.forEach(p => {
                if (!p) return;
                const pNorm = (typeof normalizeArabicHist === 'function') ? normalizeArabicHist(p.name) : (p.name || '').toLowerCase();
                const isBarcodeMatch = (p.barcode && String(p.barcode).trim() === cleanFilter) ||
                                       (p.code && String(p.code).trim() === cleanFilter) ||
                                       (p.sysCode && String(p.sysCode).trim() === cleanFilter) ||
                                       (p.variants && p.variants.some(v => v.barcode && String(v.barcode).trim() === cleanFilter)) ||
                                       (p.units && p.units.some(u => u.unitBarcode && String(u.unitBarcode).trim() === cleanFilter));
                if (isBarcodeMatch || (pNorm && pNorm.includes(fNorm))) {
                    matchedProductNames.add(p.name);
                }
            });
        }

        data = data.filter(t => {
            if (!t.product) return false;
            if (matchedProductNames.has(t.product)) return true;
            const tNorm = (typeof normalizeArabicHist === 'function') ? normalizeArabicHist(t.product) : t.product.toLowerCase();
            return tNorm.includes(fNorm);
        });
    }

    // فلترة برقم الفاتورة أو العميل إذا تم إدخالها
    const invClientFilter = document.getElementById('historyInvoiceClientFilter')?.value?.trim();
    if (invClientFilter) {
        const icNorm = (typeof normalizeArabicHist === 'function') ? normalizeArabicHist(invClientFilter) : invClientFilter.toLowerCase();
        data = data.filter(t => {
            const invNorm = String(t.invoiceId || '').toLowerCase();
            const partnerNorm = (typeof normalizeArabicHist === 'function') ? normalizeArabicHist(t.partner) : String(t.partner || '').toLowerCase();
            return invNorm.includes(icNorm) || partnerNorm.includes(icNorm);
        });
    }

    // فلترة بالمخزن المحدد
    if (whFilter && whFilter !== 'all') {
        const targetWh = String(whFilter).trim();
        data = data.filter(t => {
            if (t.type && t.type.includes('تحويل')) {
                const w = String(t.warehouse || '').trim();
                const sw = String(t.sourceWarehouse || t.fromWarehouse || '').trim();
                const dw = String(t.toWarehouse || t.destWarehouse || '').trim();
                return (w === targetWh || sw === targetWh || dw === targetWh);
            }
            const tWh = String(t.warehouse || 'المخزن الرئيسي').trim();
            return (tWh === targetWh);
        });
    }

    // 📊 حساب إحصائيات الكروت العلوية من واقع الحركات المعروضة بناءً على المخزن المحدد
    let totalInQty = 0;
    let totalOutQty = 0;
    let totalAmountSum = 0;

    data.forEach(t => {
        const factor = parseFloat(t.unitFactor) || 1;
        const qty = (parseFloat(t.qty) || 0) * factor;
        const total = parseFloat(t.total) || 0;
        totalAmountSum += total;

        const type = t.type || '';
        if (type.includes('تحويل')) {
            if (t.transferStatus === 'received' && whFilter && whFilter !== 'all') {
                const src = t.sourceWarehouse || t.fromWarehouse || t.warehouse;
                const dst = t.toWarehouse || t.destWarehouse;
                if (dst === whFilter) {
                    totalInQty += qty;
                } else if (src === whFilter) {
                    totalOutQty += qty;
                } else {
                    if (qty >= 0) totalInQty += qty; else totalOutQty += Math.abs(qty);
                }
            }
        } else if ((type.includes('شراء') && !type.includes('مرتجع')) || type.includes('مرتجع بيع')) {
            totalInQty += qty;
        } else if ((type.includes('بيع') && !type.includes('مرتجع')) || type.includes('مرتجع شراء')) {
            totalOutQty += qty;
        } else if (type.includes('تسوية')) {
            if (qty >= 0) totalInQty += qty;
            else totalOutQty += Math.abs(qty);
        }
    });

    const netQty = totalInQty - totalOutQty;

    // تحديث الكروت العلوية
    const inCardEl = document.getElementById('histCardInQty');
    const outCardEl = document.getElementById('histCardOutQty');
    const netCardEl = document.getElementById('histCardNetQty');
    const amtCardEl = document.getElementById('histCardTotalAmount');

    if (inCardEl) inCardEl.innerText = totalInQty % 1 === 0 ? totalInQty : totalInQty.toFixed(2);
    if (outCardEl) outCardEl.innerText = totalOutQty % 1 === 0 ? totalOutQty : totalOutQty.toFixed(2);
    if (netCardEl) {
        netCardEl.innerText = (netQty > 0 ? '+' : '') + (netQty % 1 === 0 ? netQty : netQty.toFixed(2));
        netCardEl.style.color = netQty >= 0 ? '#1e40af' : '#dc2626';
    }
    if (amtCardEl) amtCardEl.innerHTML = `${totalAmountSum.toFixed(2)} <span style="font-size:0.75rem;">ج.م</span>`;

    const totalMatchingCount = data.length;
    const limit = window.historyRenderLimit || 500;
    const displayedData = data.slice(0, limit);
    const hasMore = totalMatchingCount > displayedData.length;

    let rowsHtml = '';
    displayedData.forEach(t => {
        const isSelected = (selectedHistoryIndex === t.originalIndex);

        const sSize = t.size || t.selectedSize || '';
        const sColor = t.color || t.selectedColor || '';
        const whName = t.warehouse || '';

        let fashionBadges = '';
        if (sSize || sColor || whName) {
            fashionBadges = `
                <div style="display: flex; gap: 4px; margin-top: 3px; font-size: 0.75rem; flex-wrap: wrap; align-items: center;">
                    ${sSize ? `<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 1px 6px; border-radius: 4px; font-weight: 800;">${sSize}</span>` : ''}
                    ${sColor ? `<span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 1px 6px; border-radius: 4px; font-weight: 800;">${sColor}</span>` : ''}
                    ${whName ? `<span style="background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 700;">🏢 ${whName}</span>` : ''}
                </div>
            `;
        }

        // الرصيد بعد العملية التراكمي الفعلي
        const bal = balanceMap.get(t.originalIndex);
        let balHtml = '<span style="color:#94a3b8; font-weight:700;">—</span>';
        if (bal !== undefined && bal !== null) {
            if (bal > 0) {
                balHtml = `<span style="color: #059669; font-weight: 900;">▲ ${bal % 1 === 0 ? bal : bal.toFixed(2)}</span>`;
            } else if (bal < 0) {
                balHtml = `<span style="color: #dc2626; font-weight: 900;">▼ ${Math.abs(bal % 1 === 0 ? bal : bal.toFixed(2))}</span>`;
            } else {
                balHtml = `<span style="color: #94a3b8; font-weight: 800;">0</span>`;
            }
        }

        rowsHtml += `
            <tr data-orig-index="${t.originalIndex}" class="${isSelected ? 'selected-row' : ''}" onclick="selectHistoryRow(${t.originalIndex})">
                <td class="col-hist-0"><input type="radio" name="histRad" ${isSelected ? 'checked' : ''}></td>
                <td class="col-hist-1"><span style="background:#eee; padding:2px 6px; border-radius:4px; font-weight:bold;">${t.invoiceId || '-'}</span></td>
                <td class="col-hist-2">${t.date || '-'}</td>
                <td class="col-hist-3">
                    <span class="stock-badge ${t.type.includes('بيع') ? (t.type.includes('مرتجع') ? 'badge-return' : 'badge-sale') :
                        (t.type.includes('شراء') ? (t.type.includes('مرتجع') ? 'badge-return' : 'badge-purchase') :
                        (t.type.includes('قبض') ? 'badge-receipt' : (t.type.includes('صرف') ? 'badge-disburse' : (t.type.includes('تحويل') ? 'badge-transfer' : ''))))}">
                        ${t.type}
                    </span>
                    ${t.type.includes('تحويل') ? (
                        t.transferStatus === 'pending' ? '<span style="display:block; margin-top:2px; font-size:0.72rem; color:#b45309; font-weight:800; background:#fef3c7; border:1px solid #fde68a; border-radius:10px; padding:1px 6px;">معلق ⏳</span>' :
                        (t.transferStatus === 'rejected' ? '<span style="display:block; margin-top:2px; font-size:0.72rem; color:#b91c1c; font-weight:800; background:#fee2e2; border:1px solid #fca5a5; border-radius:10px; padding:1px 6px;">مرفوض ❌</span>' :
                        '<span style="display:block; margin-top:2px; font-size:0.72rem; color:#15803d; font-weight:800; background:#dcfce7; border:1px solid #86efac; border-radius:10px; padding:1px 6px;">مستلم ✅</span>')
                    ) : ''}
                </td>
                <td class="col-hist-4" style="text-align: right;">
                    <div style="font-weight: 800; color: #1e293b;">${t.product || '-'}</div>
                    ${fashionBadges}
                </td>
                <td class="col-hist-5" style="font-weight: bold;">${t.qty || 0}</td>
                <td class="col-hist-6">${parseFloat(t.price || 0).toFixed(2)}</td>
                <td class="col-hist-7" style="font-weight:bold; color:var(--main-blue);">${parseFloat(t.total || 0).toFixed(2)}</td>
                <td class="col-hist-8">${t.partner || '-'}</td>
                <td class="col-hist-9" style="font-size:0.75rem; color:#64748b;">${t.editDate || '-'}</td>
                <td class="col-hist-10" style="font-size:0.85rem; color:#0f766e; font-weight:bold;">${t.user || '-'}</td>
                <td class="col-hist-11" style="text-align: center; background: linear-gradient(135deg, rgba(124,58,237,0.05), rgba(245,158,11,0.05)); font-weight: 900;">${balHtml}</td>
            </tr>`;
    });

    if (hasMore) {
        rowsHtml += `
            <tr id="historyLoadMoreRow" style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); text-align: center;">
                <td colspan="12" style="padding: 16px; border-top: 2px dashed #cbd5e1;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap;">
                        <span style="font-weight: 800; color: #475569; font-size: 0.92rem;">
                            📊 تم عرض <strong style="color: #7c3aed; font-size: 1.05rem;">${displayedData.length}</strong> من إجمالي <strong style="color: #1e293b; font-size: 1.05rem;">${totalMatchingCount}</strong> حركة
                        </span>
                        <button type="button" onclick="loadMoreHistory(500)" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; border: none; padding: 7px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(124,58,237,0.3); font-family: 'Cairo', sans-serif; transition: 0.2s;">
                            ➕ عرض 500 أخرى
                        </button>
                        <button type="button" onclick="loadMoreHistory(0)" style="background: white; color: #475569; border: 1.5px solid #cbd5e1; padding: 7px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; font-family: 'Cairo', sans-serif; transition: 0.2s;">
                            ⚡ عرض الكل (${totalMatchingCount})
                        </button>
                    </div>
                </td>
            </tr>`;
    }

    tbody.innerHTML = rowsHtml || `<tr><td colspan="12" style="text-align:center; padding:20px;">لا توجد حركات مسجلة</td></tr>`;

    if (document.getElementById('historyBadgeCount')) {
        document.getElementById('historyBadgeCount').innerText = hasMore
            ? `معروض ${displayedData.length} من ${totalMatchingCount}`
            : 'عدد: ' + totalMatchingCount;
    }

    if (typeof applyHistoryColumnVisibility === 'function') {
        applyHistoryColumnVisibility();
    }
}

// متغيرات للتحكم في ظهور الأعمدة مع الحفظ في SQLite (getStore)

let invoicesColumnVisibility = JSON.parse(getStore('pos_inv_cols_visible') || '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true,"11":true,"12":true,"13":true,"14":true}');
window.invoicesColumnVisibility = invoicesColumnVisibility;

// دالة مركزية لاسترجاع تخصيص أعمدة الفواتير من الذاكرة وقاعدة البيانات لحظياً
function loadInvoicesColumnPreferences() {
    const saved = (typeof getStore === 'function') ? getStore('pos_inv_cols_visible') : null;
    if (saved) {
        try {
            const parsed = (typeof saved === 'string') ? JSON.parse(saved) : saved;
            if (parsed && typeof parsed === 'object') {
                for (let k in parsed) {
                    invoicesColumnVisibility[k] = parsed[k];
                }
            }
        } catch (e) {
            console.warn("Failed to parse pos_inv_cols_visible:", e);
        }
    }
    return invoicesColumnVisibility;
}
window.loadInvoicesColumnPreferences = loadInvoicesColumnPreferences;

// دالة لتحديث أنماط الجدول بالكامل دفعة واحدة (تمنع الترحيل وتدعم الأداء)
function updateInvoicesTableStyles() {
    loadInvoicesColumnPreferences();

    let styleEl = document.getElementById('style-invoices-cols-global');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'style-invoices-cols-global';
        document.head.appendChild(styleEl);
    }

    const hasProfitPerm = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
    let css = '';

    for (let i = 0; i <= 14; i++) {
        const isHiddenByPref = invoicesColumnVisibility[i] === false;
        const isProfitHidden = (i === 5 && !hasProfitPerm);

        if (isHiddenByPref || isProfitHidden) {
            css += `#invoicesMainTable .col-inv-${i} { display: none !important; }\n`;
        }
    }

    styleEl.innerHTML = css;
}
window.updateInvoicesTableStyles = updateInvoicesTableStyles;

// دالة لتهيئة ظهور الأعمدة عند تحميل الصفحة أو التنقل
function initInvoicesColumns() {
    loadInvoicesColumnPreferences();
    updateInvoicesTableStyles();

    // مزامنة حالة مربعات الاختيار في نافذة التخصيص
    for (let i = 0; i <= 14; i++) {
        const isVisible = invoicesColumnVisibility[i] !== false;
        const checkbox = document.querySelector(`#invoicesColSelectorPopup input[onchange*="(${i},"]`);
        if (checkbox) checkbox.checked = isVisible;
    }

    if (typeof renderInvoicesWarehouseChips === 'function') {
        renderInvoicesWarehouseChips();
    }
}
window.initInvoicesColumns = initInvoicesColumns;

function setInvoicesView(view) {

    currentInvoicesView = view;

    // تحديث شكل الأزرار

    const opBtn = document.getElementById('viewOperationBtn');

    const itBtn = document.getElementById('viewItemsBtn');

    if (view === 'operation') {

        opBtn.style.background = '#34495e'; opBtn.style.color = 'white';

        itBtn.style.background = '#ecf0f1'; itBtn.style.color = '#7f8c8d';

    } else {

        itBtn.style.background = '#34495e'; itBtn.style.color = 'white';

        opBtn.style.background = '#ecf0f1'; opBtn.style.color = '#7f8c8d';

    }

    renderInvoicesTable();

}

function toggleInvoicesColumn(index, isVisible, shouldSave = true) {
    invoicesColumnVisibility[index] = isVisible;
    if (shouldSave) {
        setStore('pos_inv_cols_visible', JSON.stringify(invoicesColumnVisibility));
    }
    updateInvoicesTableStyles();
}
window.toggleInvoicesColumn = toggleInvoicesColumn;

function setInvoicesAllCols(makeVisible) {
    for (let i = 0; i <= 14; i++) {
        if (i === 0 || i === 1) {
            // الاحتفاظ بعمود الاختيار ورقم الفاتورة مفعلين دوماً لضمان التفاعل
            invoicesColumnVisibility[i] = true;
        } else {
            invoicesColumnVisibility[i] = makeVisible;
        }
        const checkbox = document.querySelector(`#invoicesColSelectorPopup input[onchange*="(${i},"]`);
        if (checkbox) checkbox.checked = invoicesColumnVisibility[i];
    }
    setStore('pos_inv_cols_visible', JSON.stringify(invoicesColumnVisibility));
    updateInvoicesTableStyles();
}
window.setInvoicesAllCols = setInvoicesAllCols;

function setInvoicesTypeFilter(type, btn) {

    // إزالة الحالة النشطة من جميع تبويبات أنواع العمليات
    document.querySelectorAll('#invoicesChipBar .invoice-tab').forEach(t => t.classList.remove('active'));

    // إضافة الحالة النشطة للتبويب المختار
    if (btn) btn.classList.add('active');

    // تحديث قيمة الـ select المخفية للحفاظ على التوافق مع الكود الحالي
    const filterEl = document.getElementById('invoicesTypeFilter');
    if (filterEl) {
        filterEl.value = type;
        renderInvoicesTable();
    }
}
window.setInvoicesTypeFilter = setInvoicesTypeFilter;

// 🏢 إدارة فلترة وتبويبات المخازن والفروع في قسم الفواتير
window.currentInvoicesWarehouseFilter = 'all';

function setInvoicesWarehouseFilter(wh, btn) {
    window.currentInvoicesWarehouseFilter = wh;
    document.querySelectorAll('#invoicesWarehouseChipsBar .invoice-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (typeof renderInvoicesTable === 'function') {
        renderInvoicesTable();
    }
}
window.setInvoicesWarehouseFilter = setInvoicesWarehouseFilter;

function renderInvoicesWarehouseChips() {
    const container = document.getElementById('invoicesWarehouseChipsBar');
    if (!container) return;

    const activeUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : window.currentUser;
    if (activeUser && activeUser.role !== 'admin') {
        if (activeUser.invoiceScope === 'user_only') {
            container.innerHTML = `
                <button class="invoice-tab active" style="border-radius: 20px; font-weight: 700; font-size: 0.85rem; padding: 6px 14px; white-space: nowrap; background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe;">
                    <span>👤</span> فواتيرك وحسابك فقط (${activeUser.name})
                </button>
            `;
            return;
        }

        if (activeUser.invoiceScope === 'hide_admin') {
            container.innerHTML = `
                <button class="invoice-tab active" style="border-radius: 20px; font-weight: 700; font-size: 0.85rem; padding: 6px 14px; white-space: nowrap; background: #fef2f2; color: #b91c1c; border: 1.5px solid #fecaca;">
                    <span>🛡️</span> فواتير المبيعات (حجب مبيعات الإدارة)
                </button>
            `;
            return;
        }

        if (activeUser.invoiceScope === 'terminal_only') {
            const myLetter = (window.BayanNetworkHub && typeof window.BayanNetworkHub.getTerminalLetter === 'function')
                ? window.BayanNetworkHub.getTerminalLetter()
                : (window.localNetworkHub && window.localNetworkHub.deviceLetter) || (typeof getStore === 'function' ? getStore('local_device_letter') : '') || 'كاشير فرعي';
            container.innerHTML = `
                <button class="invoice-tab active" style="border-radius: 20px; font-weight: 700; font-size: 0.85rem; padding: 6px 14px; white-space: nowrap;">
                    <span>💻</span> فواتير جهازك الحالي فقط (${myLetter})
                </button>
            `;
            return;
        }

        const isRestrictedWarehouse = (
            activeUser.invoiceScope === 'warehouse_only' ||
            activeUser.warehouseScope === 'specific' ||
            activeUser.warehouseScope === 'main'
        );

        if (isRestrictedWarehouse) {
            const allowedWh = (activeUser.warehouseScope === 'main') 
                ? 'المخزن الرئيسي' 
                : (activeUser.assignedWarehouse || 'المخزن الرئيسي');
            window.currentInvoicesWarehouseFilter = allowedWh;
            const safeName = String(allowedWh).replace(/'/g, "\\'");
            container.innerHTML = `
                <button class="invoice-tab active" onclick="setInvoicesWarehouseFilter('${safeName}', this)" style="border-radius: 20px; font-weight: 700; font-size: 0.85rem; padding: 6px 14px; white-space: nowrap;">
                    <span>🏬</span> فرعك المصرّح به: ${allowedWh}
                </button>
            `;
            return;
        }
    }

    let whNames = [];
    if (window.warehouses && Array.isArray(window.warehouses)) {
        whNames = window.warehouses.map(w => (typeof w === 'string' ? w : (w ? w.name : ''))).filter(Boolean);
    }
    if (whNames.length === 0 && typeof warehouses !== 'undefined' && Array.isArray(warehouses)) {
        whNames = warehouses.map(w => (typeof w === 'string' ? w : (w ? w.name : ''))).filter(Boolean);
    }
    if (typeof transactions !== 'undefined' && Array.isArray(transactions)) {
        transactions.forEach(t => {
            if (t && t.warehouse && !whNames.includes(t.warehouse)) {
                whNames.push(t.warehouse);
            }
        });
    }
    if (whNames.length === 0) {
        whNames = ['المخزن الرئيسي'];
    }

    const currentFilter = window.currentInvoicesWarehouseFilter || 'all';

    let html = `
        <button class="invoice-tab ${currentFilter === 'all' ? 'active' : ''}" onclick="setInvoicesWarehouseFilter('all', this)" style="border-radius: 20px; font-weight: 700; font-size: 0.85rem; padding: 6px 14px; white-space: nowrap;">
            <span>🏢</span> كافة الفروع والمخازن
        </button>
    `;

    whNames.forEach(name => {
        const isActive = (currentFilter === name);
        const safeName = String(name).replace(/'/g, "\\'");
        html += `
            <button class="invoice-tab ${isActive ? 'active' : ''}" onclick="setInvoicesWarehouseFilter('${safeName}', this)" style="border-radius: 20px; font-weight: 700; font-size: 0.85rem; padding: 6px 14px; white-space: nowrap;">
                <span>🏬</span> ${name}
            </button>
        `;
    });

    container.innerHTML = html;
}
window.renderInvoicesWarehouseChips = renderInvoicesWarehouseChips;

function applyQuickDateFilter(rangeType, fromId, toId) {

    if (!rangeType) return;

    const now = new Date();

    let fromDate = new Date();

    let toDate = new Date();

    const formatDate = (date) => date.toLocaleDateString('en-CA');

    switch (rangeType) {

        case 'today':

            break;

        case 'yesterday':

            fromDate.setDate(now.getDate() - 1);

            toDate.setDate(now.getDate() - 1);

            break;

        case 'thisWeek':

            // نفترض أن الأسبوع يبدأ من السبت (0 = الأحد، فـ 6 = السبت)

            let day = now.getDay();

            let diff = (day + 1) % 7; // الأيام منذ السبت

            fromDate.setDate(now.getDate() - diff);

            break;

        case 'lastWeek':

            let dayLast = now.getDay();

            let diffToSat = (dayLast + 1) % 7;

            fromDate.setDate(now.getDate() - diffToSat - 7);

            toDate.setDate(now.getDate() - diffToSat - 1);

            break;

        case 'thisMonth':

            fromDate.setDate(1);

            break;

        case 'lastMonth':

            fromDate.setMonth(now.getMonth() - 1);

            fromDate.setDate(1);

            toDate = new Date(now.getFullYear(), now.getMonth(), 0);

            break;

        case 'thisYear':

            fromDate.setMonth(0, 1);

            break;

        case 'lastYear':

            fromDate.setFullYear(now.getFullYear() - 1, 0, 1);

            toDate.setFullYear(now.getFullYear() - 1, 11, 31);

            break;

    }

    document.getElementById(fromId).value = formatDate(fromDate);

    document.getElementById(toId).value = formatDate(toDate);

    if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

}

function toggleShareMenu(menuId, event) {
    if (event) event.stopPropagation(); // منع الانتشار لعدم تفعيل مستمع النافذة
    const menu = document.getElementById(menuId);
    if (!menu) return;

    const isActive = menu.classList.contains('active');

    // إغلاق أي قائمة مفتوحة أخرى
    document.querySelectorAll('.share-menu').forEach(m => {
        m.classList.remove('active');
        m.style.display = '';
    });

    if (!isActive) {
        menu.classList.add('active');
        if (typeof autoFillSharePhone === 'function') {
            autoFillSharePhone(menuId);
        }
    }
}

// إغلاق القائمة عند النقر في أي مكان آخر

window.addEventListener('click', function (e) {
    if (!e.target.closest('.share-menu') && !e.target.closest('.action-btn') && !e.target.closest('.acc-action-btn') && !e.target.closest('.v-btn') && !e.target.closest('.btn-excel') && !e.target.closest('.btn-share-trigger')) {
        document.querySelectorAll('.share-menu').forEach(m => {
            m.classList.remove('active');
            m.style.display = '';
        });
    }
});

// النسخ الاحتياطي التلقائي عند الإغلاق (في بيئة الديسكتوب فقط وبشرط تفعيله صراحة)

window.addEventListener('beforeunload', (e) => {
    const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
    // في المتصفح العادي لا نقوم بتنزيل ملفات تلقائياً عند مجرد عمل ريلود للصفحة
    if (!isElectron) return;

    const settings = JSON.parse(getStore('pos_settings') || '{}');
    if (settings.autoBackup === true) {
        backupData();
    }
});

// تمت إزالة منطق الحقن لصالح الزر العائم الثابت

// ================= Radial Menu Logic =================

// --- دالة عالمية لجلب معرفات الأصناف المختارة من جدول البضاعة (Centralized Helper) ---

function getSelectedInventoryIds() {

    const checkedBoxes = document.querySelectorAll('.inv-row-check:checked');

    return Array.from(checkedBoxes).map(cb => {

        const tr = cb.closest('tr');

        return tr ? parseInt(tr.getAttribute('data-id')) : null;

    }).filter(id => id !== null);

}

function downloadExcelTemplate() {
    const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : null));
    if (!XLSXLib) return alert("❌ مكتبة Excel غير محملة حالياً.");

    const data = [
        ["اسم الصنف", "الكمية الحالية", "سعر الشراء", "سعر البيع", "الوحدة", "الباركود"],
        ["منتج تجريبي 1", "10", "100", "150", "قطعة", "1001"],
        ["منتج تجريبي 2", "5", "50", "80", "كيلو", "1002"]
    ];

    const ws = XLSXLib.utils.aoa_to_sheet(data);
    const wb = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(wb, ws, "الأصناف");
    XLSXLib.writeFile(wb, "نموذج_أصناف_بيان_POS.xlsx");
}

// --- دالة معالجة واستيراد ملف الإكسيل ---

// --- ميزات بحث مرتجع سريعة ---

let currentReturnHeaderProductId = null;

let currentReturnHeaderUnit = null;

// إغلاق قائمة الإجراءات السريعة عند النقر خارجها
document.addEventListener('click', (e) => {
    const qa = document.getElementById('invoiceQuickActions');
    if (qa && !qa.classList.contains('hidden')) {
        const btn = e.target.closest('button[onclick*="invoiceQuickActions"]');
        if (!btn && !qa.contains(e.target)) {
            qa.classList.add('hidden');
        }
    }
});
