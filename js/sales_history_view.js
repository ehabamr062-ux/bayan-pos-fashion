// ============================================================
//  سجل واستعراض عمليات البيع والتصدير (Sales History & Views)
// ============================================================
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

    if (!query || !query.trim()) { 
        resultsDiv.style.display = 'none'; 
        renderHistoryTable(); 
        return; 
    }

    // البحث في قاعدة البيانات لاقتراح الصنف
    const lowerQuery = query.toLowerCase().trim();
    const filtered = (productsDB || []).filter(p =>
        (p.name && p.name.toLowerCase().includes(lowerQuery)) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(lowerQuery)) ||
        (p.sysCode && String(p.sysCode).toLowerCase().includes(lowerQuery)) ||
        (p.code && String(p.code).toLowerCase().includes(lowerQuery))
    ).slice(0, 50);

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

// متخصص لفلترة الفترة في صفحة الحركة

function applyHistoryPeriodFilter(period) {

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
function computeTransactionRunningBalances() {
    const balanceMap = new Map();
    if (typeof transactions === 'undefined' || !Array.isArray(transactions) || transactions.length === 0) {
        return balanceMap;
    }

    const productGroups = {};

    transactions.forEach((t, origIdx) => {
        if (!t || !t.product) return;
        const isInvTx = ['بيع', 'شراء', 'مرتجع', 'تسوية', 'تحويل'].some(k => t.type && t.type.includes(k));
        if (!isInvTx) return;

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

    Object.values(productGroups).forEach(grp => {
        const p = (typeof productsDB !== 'undefined' && Array.isArray(productsDB))
            ? productsDB.find(x => x && (x.name === grp.productName || x.id === grp.productName))
            : null;

        let currentStock = 0;
        if (p) {
            if (grp.size || grp.color) {
                const v = (p.variants && Array.isArray(p.variants))
                    ? p.variants.find(x => 
                        (!grp.size || String(x.size || '').trim() === grp.size) && 
                        (!grp.color || String(x.color || '').trim() === grp.color)
                    ) : null;
                currentStock = v ? (parseFloat(v.stock) || 0) : (parseFloat(p.stock) || 0);
            } else {
                currentStock = parseFloat(p.stock) || 0;
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
            if (type.includes('شراء') && !type.includes('مرتجع')) delta = qty;
            else if (type.includes('مرتجع بيع')) delta = qty;
            else if (type.includes('بيع') && !type.includes('مرتجع')) delta = -qty;
            else if (type.includes('مرتجع شراء')) delta = -qty;
            else if (type.includes('تسوية')) delta = qty;
            else if (type.includes('تحويل')) delta = -qty;

            running = running - delta;
        }
    });

    return balanceMap;
}

function renderHistoryTable(filterName = null) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    const fromDate = document.getElementById('historyDateFrom')?.value;
    const toDate = document.getElementById('historyDateTo')?.value;
    const typeFilter = document.getElementById('historyTypeFilter')?.value;
    const methodFilter = document.getElementById('historyMethodFilter')?.value;

    if (!filterName) {
        const searchVal = document.getElementById('historySearch')?.value?.trim();
        if (searchVal) filterName = searchVal;
    }

    tbody.innerHTML = '';

    // حساب الأرصدة التراكمية الدقيقة لكافة الحركات
    const balanceMap = computeTransactionRunningBalances();

    // إضافة index أصلي لكل عنصر للتمكن من حذفه بشكل صحيح
    let data = transactions.map((t, i) => ({ ...t, originalIndex: i }));

    // 1. فلترة إجبارية: عرض الحركات المخزنية فقط (استبعاد القبض والصرف المالي البحت)
    data = data.filter(t => ['بيع', 'شراء', 'مرتجع', 'تسوية', 'تحويل'].some(k => t.type && t.type.includes(k)));

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
            data = data.filter(t => t.method && (t.method.includes('نقدية') || t.method.includes('نقدي') || t.method.includes('فودافون')));
        } else if (methodFilter === 'credit') {
            data = data.filter(t => t.method && t.method.includes('آجل'));
        }
    }

    // فلترة بالاسم (إذا تم تمريره)
    if (filterName) {
        const fLower = filterName.toLowerCase();
        data = data.filter(t => (t.product && t.product.toLowerCase().includes(fLower)));
    }

    // فلترة برقم الفاتورة أو العميل إذا تم إدخالها
    const invClientFilter = document.getElementById('historyInvoiceClientFilter')?.value?.trim()?.toLowerCase();
    if (invClientFilter) {
        data = data.filter(t => 
            (t.invoiceId && String(t.invoiceId).toLowerCase().includes(invClientFilter)) ||
            (t.partner && String(t.partner).toLowerCase().includes(invClientFilter))
        );
    }

    // 📊 حساب إحصائيات الكروت العلوية من واقع الحركات المعروضة
    let totalInQty = 0;
    let totalOutQty = 0;
    let totalAmountSum = 0;

    data.forEach(t => {
        const factor = parseFloat(t.unitFactor) || 1;
        const qty = (parseFloat(t.qty) || 0) * factor;
        const total = parseFloat(t.total) || 0;
        totalAmountSum += total;

        const type = t.type || '';
        if ((type.includes('شراء') && !type.includes('مرتجع')) || type.includes('مرتجع بيع')) {
            totalInQty += qty;
        } else if ((type.includes('بيع') && !type.includes('مرتجع')) || type.includes('مرتجع شراء')) {
            totalOutQty += qty;
        } else if (type.includes('تسوية') || type.includes('تحويل')) {
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

    let rowsHtml = '';
    data.forEach(t => {
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
                        (t.type.includes('قبض') ? 'badge-receipt' : (t.type.includes('صرف') ? 'badge-disburse' : '')))}">
                        ${t.type}
                    </span>
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

    tbody.innerHTML = rowsHtml || `<tr><td colspan="12" style="text-align:center; padding:20px;">لا توجد حركات مسجلة</td></tr>`;

    if (document.getElementById('historyBadgeCount')) document.getElementById('historyBadgeCount').innerText = 'عدد: ' + data.length;

    if (typeof applyHistoryColumnVisibility === 'function') {
        applyHistoryColumnVisibility();
    }
}

// متغيرات للتحكم في ظهور الأعمدة مع الحفظ في localStorage

let invoicesColumnVisibility = JSON.parse(getStore('pos_inv_cols_visible') || '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true,"11":true,"12":true,"13":true}');

// دالة لتحديث أنماط الجدول بالكامل دفعة واحدة (تمنع الترحيل وتدعم الأداء)

function updateInvoicesTableStyles() {

    let styleEl = document.getElementById('style-invoices-cols-global');

    if (!styleEl) {

        styleEl = document.createElement('style');

        styleEl.id = 'style-invoices-cols-global';

        document.head.appendChild(styleEl);

    }

    let css = '';

    for (let i = 0; i <= 13; i++) {

        if (invoicesColumnVisibility[i] === false) {

            css += `#invoicesMainTable .col-inv-${i} { display: none !important; }\n`;

        }

    }

    styleEl.innerHTML = css;

}

// دالة لتهيئة ظهور الأعمدة عند تحميل الصفحة

function initInvoicesColumns() {

    updateInvoicesTableStyles();

    // مزامنة حالة مربعات الاختيار في نافذة التخصيص
    for (let i = 0; i <= 13; i++) {
        const isVisible = invoicesColumnVisibility[i] !== false;
        const checkbox = document.querySelector(`#invoicesColSelectorPopup input[onchange*="(${i},"]`);
        if (checkbox) checkbox.checked = isVisible;
    }

}

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

function setInvoicesTypeFilter(type, btn) {

    // إزالة الحالة النشطة من جميع التبويبات

    document.querySelectorAll('.invoice-tab').forEach(t => t.classList.remove('active'));

    // إضافة الحالة النشطة للتبويب المختار

    btn.classList.add('active');

    // تحديث قيمة الـ select المخفية للحفاظ على التوافق مع الكود الحالي

    const filterEl = document.getElementById('invoicesTypeFilter');

    if (filterEl) {

        filterEl.value = type;

        // استدعاء التحديث

        renderInvoicesTable();

    }

}

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

    const isActive = menu.classList.contains('active');

    // إغلاق أي قائمة مفتوحة أخرى

    document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('active'));

    if (!isActive) {

        menu.classList.add('active');

    }

}

// إغلاق القائمة عند النقر في أي مكان آخر

window.addEventListener('click', function (e) {

    if (!e.target.closest('.share-menu') && !e.target.closest('.action-btn') && !e.target.closest('.acc-action-btn') && !e.target.closest('.v-btn') && !e.target.closest('.btn-excel') && !e.target.closest('.btn-share-trigger')) {

        document.querySelectorAll('.share-menu').forEach(m => m.classList.remove('active'));

    }

});

// النسخ الاحتياطي التلقائي عند الإغلاق

window.addEventListener('beforeunload', (e) => {
    const settings = JSON.parse(getStore('pos_settings') || '{}');
    if (settings.autoBackup) {
        backupData();
        const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
        if (!isElectron) {
            e.preventDefault();
            e.returnValue = ''; // مطلوب لبعض المتصفحات لإظهار رسالة التأكيد والسماح بالتحميل
        }
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
