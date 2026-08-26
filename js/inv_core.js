// تهيئة قائمة المعرفات المختارة لتظل محفوظة عند التنقل بين الأقسام
window.selectedInventoryIds = window.selectedInventoryIds || new Set();
window.inventoryLastUpdate = Date.now();

let _invSummaryCache = null;
let _invSummaryKey = null;

function invalidateInvSummaryCache() {
    _invSummaryCache = null;
    _invSummaryKey = null;
    window.inventoryLastUpdate = Date.now();
}
window.invalidateInvSummaryCache = invalidateInvSummaryCache;

function getInvSummaryMap(currentWH) {
    const key = `${window.inventoryLastUpdate}_${productsDB.length}_${currentWH}`;
    if (_invSummaryCache && _invSummaryKey === key) return _invSummaryCache;

    const productMapByName = {};
    productsDB.forEach(p => { if (p.name) productMapByName[p.name] = p; });

    const summary = {};
    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        const pName = t.product;
        if (!pName) continue;

        const pRef = productMapByName[pName];
        let factor = 1;
        if (pRef && t.unit && pRef.units) {
            const u = pRef.units.find(un => un.unitName === t.unit);
            if (u) factor = parseFloat(u.factor) || 1;
        }

        if (!summary[pName]) summary[pName] = { in: 0, out: 0, lastPur: 0, totalCost: 0, totalQty: 0, wStock: 0, globalChange: 0 };
        const s = summary[pName];

        const qty = (parseFloat(t.qty || 0)) * factor; 
        const price = (parseFloat(t.price || 0)) / factor;
        const type = t.type || '';
        const tWH = (t.warehouse || 'المخزن الرئيسي').trim();

        let change = 0;
        if (type.includes('شراء') && !type.includes('مرتجع')) {
            change = qty; s.in += qty; s.lastPur = price; s.totalCost += qty * price; s.totalQty += qty;
        } else if (type.includes('مرتجع بيع')) {
            change = qty; s.in += qty;
        } else if (type.includes('بيع') && !type.includes('مرتجع')) {
            change = -qty; s.out += qty;
        } else if (type.includes('مرتجع شراء')) {
            change = -qty; s.out += qty;
        } else if (type.includes('تسوية')) {
            change = type.includes('+') ? qty : -qty;
        }

        if (!type.includes('تحويل')) s.globalChange += change;
        if (tWH === currentWH) s.wStock += change;

        if (type.includes('تحويل')) {
            const parts = (t.partner || '').split(' -> ');
            if (parts.length === 2) {
                if (parts[1].trim() === currentWH) s.wStock += qty;
                if (parts[0].trim() === currentWH) s.wStock -= qty;
            }
        }
    }

    _invSummaryCache = summary;
    _invSummaryKey = key;
    return summary;
}

// دالة مساعدة لحساب متوسط التكلفة لصنف واحد بناءً على الحركات (تم تسريعها لتكون O(1))
window.getProductAverageCost = function(productName, fallbackCost = 0) {
    if (!productName) return parseFloat(fallbackCost) || 0;
    const cleanName = String(productName).trim();
    const currentWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
    const summaryMap = getInvSummaryMap(currentWH);
    const s = summaryMap[cleanName];
    if (s && s.totalQty > 0) {
        const avg = s.totalCost / s.totalQty;
        if (!isNaN(avg)) return avg;
    }
    const pRef = productsDB.find(x => x && x.name && x.name.trim() === cleanName);
    return pRef ? (parseFloat(pRef.cost) || parseFloat(fallbackCost) || 0) : (parseFloat(fallbackCost) || 0);
};

// دالة مساعدة لحساب آخر سعر شراء لصنف واحد بناءً على الحركات (تم تسريعها لتكون O(1))
window.getProductLastPurchasePrice = function(productName, fallbackCost = 0) {
    if (!productName) return parseFloat(fallbackCost) || 0;
    const cleanName = String(productName).trim();
    const currentWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
    const summaryMap = getInvSummaryMap(currentWH);
    const s = summaryMap[cleanName];
    if (s && s.lastPur > 0) {
        return s.lastPur;
    }
    const pRef = productsDB.find(x => x && x.name && x.name.trim() === cleanName);
    return pRef ? (parseFloat(pRef.cost) || parseFloat(fallbackCost) || 0) : (parseFloat(fallbackCost) || 0);
};


function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    if (typeof hasPermission === 'function' && !hasPermission('stock_view')) {
        tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding:50px; color:#64748b; font-weight:bold;">ليس لديك صلاحية لعرض المخزن</td></tr>';
        return;
    }

    const searchInput = document.getElementById('invSearchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const catFilter = document.getElementById('invCategoryFilter')?.value || 'all';

    if (search === '' && typeof updateCategoryFilterOptions === 'function') updateCategoryFilterOptions();

    tbody.innerHTML = '';
    let totalStockSum = 0;
    let totalItemsDisplay = 0;

    const currentWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();

    // خريطة تلخيص الحركات المحفوظة في الذاكرة لتجنب الفرز المكرر
    const summary = getInvSummaryMap(currentWH);

    const htmlRows = [];

    productsDB.forEach((p, idx) => {
        const s = summary[p.name] || { in: 0, out: 0, lastPur: 0, totalCost: 0, totalQty: 0, wStock: 0, globalChange: 0 };
        
        let currentStock = 0;
        if (typeof getWarehouseStock === 'function') {
            currentStock = getWarehouseStock(p.name, currentWH);
        } else {
            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                currentStock = p.variants.reduce((sum, v) => sum + (parseFloat(v.warehouseStocks?.[currentWH] ?? (currentWH === 'المخزن الرئيسي' ? v.stock : 0)) || 0), 0);
            } else if (p.warehouseStocks && p.warehouseStocks[currentWH] !== undefined) {
                currentStock = parseFloat(p.warehouseStocks[currentWH]) || 0;
            } else if (currentWH === 'المخزن الرئيسي') {
                currentStock = parseFloat(p.stock) || 0;
            }
        }
        
        const avgCost = s.totalQty > 0 ? (s.totalCost / s.totalQty) : (parseFloat(p.cost) || 0);
        const retail = parseFloat(p.price) || 0;
        const profitMargin = retail > 0 ? (((retail - avgCost) / retail) * 100).toFixed(1) : 0;
        const marginColor = profitMargin < 10 ? '#ef4444' : (profitMargin > 30 ? '#10b981' : '#f59e0b');

        if (!p.name.toLowerCase().includes(search) && !(p.barcode && String(p.barcode).includes(search)) && !(p.code && String(p.code).includes(search))) return;
        if (catFilter !== 'all' && (p.category || '').trim() !== catFilter.trim()) return;

        const targetMinStock = parseFloat(p.minStock) || 5;

        if (typeof currentInvFilter !== 'undefined') {
            if (currentInvFilter === 'active' && currentStock <= 0) return;
            if (currentInvFilter === 'low' && (currentStock > targetMinStock || currentStock <= 0)) return;
            if (currentInvFilter === 'zero' && currentStock > 0) return;
        }

        totalStockSum += currentStock;
        totalItemsDisplay++;

        let baseUnitName = (p.unit && p.unit !== 'وحدة') ? p.unit : "قطعة";
        let detailed = `${Number(currentStock.toFixed(2))} ${baseUnitName}`;

        if (p.units && p.units.length > 0) {
            const baseUnitObj = p.units[0];
            baseUnitName = baseUnitObj.unitName;

            const sub = p.units.find(u => u.factor < 1);

            if (sub) {
                const baseUnits = Math.trunc(currentStock + 0.00001);
                const subUnits = Math.round((currentStock - baseUnits) / sub.factor);

                if (baseUnits === 0 && subUnits !== 0) {
                    detailed = `<b>${subUnits}</b> ${sub.unitName}`;
                } else if (subUnits === 0) {
                    detailed = `<b>${baseUnits}</b> ${baseUnitName}`;
                } else {
                    detailed = `<b>${baseUnits}</b> ${baseUnitName} و <b>${subUnits}</b> ${sub.unitName}`;
                }
            }
        }

        const displayStock = Number(currentStock.toFixed(3));

        const isLowStock = currentStock <= (parseFloat(p.minStock) || 0) && currentStock > 0;
        const isOutOfStock = currentStock <= 0;
        let rowBg = '';
        if (isOutOfStock) rowBg = 'rgba(231, 76, 60, 0.08)';
        else if (isLowStock) rowBg = 'rgba(243, 156, 18, 0.08)';

        const isSelected = window.selectedInventoryIds.has(p.id);

        htmlRows.push(`
            <tr onclick="toggleInventoryRowSelection(${p.id}, this, event)" data-id="${p.id}" class="${isSelected ? 'selected-row-gold' : ''}" style="background:${rowBg}">
                <td onclick="handleInventoryCheckClick(event, ${p.id}, this.parentElement)" class="col-inv-0"><input type="checkbox" class="inv-row-check" ${isSelected ? 'checked' : ''}></td>
                <td class="col-inv-1">${idx + 1}</td>
                <td class="col-inv-quick" style="text-align:center;">
                    <button onclick="toggleQuickStatus(event, ${p.id})" 
                        style="background:none; border:none; cursor:pointer; font-size:1.2rem; transition:0.3s; transform: ${p.isQuick ? 'scale(1.2)' : 'scale(1)'}; opacity: ${p.isQuick ? '1' : '0.2'};"
                        title="${p.isQuick ? 'إزالة من الأصناف السريعة' : 'إضافة للأصناف السريعة'}">
                        ⚡
                    </button>
                </td>
                <td class="col-inv-3" style="font-weight:bold;">${p.name}</td>
                <td class="col-inv-13 num-cell" style="color:var(--main-orange); font-weight:900;">${(parseFloat(p.wholesale) || 0).toFixed(2)}</td>
                <td class="col-inv-10 num-cell" style="color:var(--main-blue); font-weight:900;">${retail.toFixed(2)}</td>
                <td class="col-inv-11 num-cell" style="color:#333;">${s.lastPur.toFixed(2)}</td>
                <td class="col-inv-9 num-cell" style="font-size:1.1rem; font-weight:900; color:${currentStock <= 0 ? 'red' : 'var(--main-green)'}">${displayStock}</td>
                <td class="col-inv-12 num-cell" style="color:#666;">${avgCost.toFixed(2)}</td>
                <td class="col-inv-detailed" style="font-size:0.9rem; text-align:center;">${detailed}</td>
                <td class="col-inv-6 num-cell">${(currentStock - s.in + s.out).toFixed(2)}</td>
                <td class="col-inv-7 num-cell" style="color:var(--main-green);">${s.in.toFixed(2)}</td>
                <td class="col-inv-8 num-cell" style="color:#c0392b;">${s.out.toFixed(2)}</td>
                <td class="col-inv-5">${p.shelf || '---'}</td>
                <td class="col-inv-4">${p.barcode || '-'}</td>
                <td class="col-inv-margin" style="text-align:center; font-weight:bold; color:${marginColor}">${profitMargin}%</td>
                <td class="col-inv-2" style="color:var(--main-green); font-weight:bold;">${p.sysCode || p.id}</td>
                <td class="col-inv-internal" style="color:#64748b;">${p.code || '-'}</td>
            </tr>
        `);
    });

    tbody.innerHTML = htmlRows.join('');

    if (typeof applyInventoryColumnVisibility === 'function') applyInventoryColumnVisibility();
    if (document.getElementById('totalItemsCount')) document.getElementById('totalItemsCount').innerText = totalItemsDisplay;
    if (document.getElementById('totalStockQtyDisplay')) document.getElementById('totalStockQtyDisplay').innerText = totalStockSum;
    updateInventorySelectionUI();

    // مزامنة شريط التمرير العلوي مع السفلي ديناميكياً
    setTimeout(() => {
        const topScroll = document.getElementById('invTopScrollbarContainer');
        const bottomScroll = document.querySelector('.inventory-scroll-wrapper');
        const filler = document.getElementById('invTopScrollbarFiller');
        const table = document.querySelector('.inventory-scroll-wrapper table');
        if (topScroll && bottomScroll && filler && table) {
            filler.style.width = table.offsetWidth + 'px';
            topScroll.onscroll = function() {
                if (bottomScroll.scrollLeft !== topScroll.scrollLeft) {
                    bottomScroll.scrollLeft = topScroll.scrollLeft;
                }
            };
            bottomScroll.onscroll = function() {
                if (topScroll.scrollLeft !== bottomScroll.scrollLeft) {
                    topScroll.scrollLeft = bottomScroll.scrollLeft;
                }
            };
        }
    }, 100);
}

async function updateQuickPrices() {
    let targetId = typeof selectedInventoryId !== 'undefined' ? selectedInventoryId : null;
    if (!targetId) {
        const checked = document.querySelector('.inv-row-check:checked');
        if (checked) targetId = parseInt(checked.closest('tr').getAttribute('data-id'));
    }

    if (!targetId) return showToast("⚠️ يرجى اختيار صنف أولاً", "error");

    const retail = parseFloat(document.getElementById('quickEditRetail').value) || 0;
    const wholesale = parseFloat(document.getElementById('quickEditWholesale').value) || 0;
    const cost = parseFloat(document.getElementById('quickEditCost').value) || 0;

    const pIdx = productsDB.findIndex(p => p.id === targetId);
    if (pIdx === -1) return;

    const p = productsDB[pIdx];
    p.price = retail;
    p.wholesale = wholesale;
    p.cost = cost;

    if (p.units && p.units.length > 0) {
        const base = p.units.find(u => u.unitName === p.unit) || p.units[0];
        base.price = retail;
        base.wholesale = wholesale;
        base.cost = cost;
    }

    const subSection = document.getElementById('quickEditSubUnitSection');
    if (subSection && subSection.style.display !== 'none' && p.units && p.units.length > 1) {
        const subRet = parseFloat(document.getElementById('quickEditSubRetail').value) || 0;
        const subWhol = parseFloat(document.getElementById('quickEditSubWholesale').value) || 0;
        const subUnitField = p.units.find(u => u.unitName === document.getElementById('quickEditSubUnitName').innerText);
        if (subUnitField) {
            subUnitField.price = subRet;
            subUnitField.wholesale = subWhol;
            subUnitField.cost = subUnitField.factor > 0 ? (cost / subUnitField.factor) : cost;
        }
    }

    await db.products.put(p);

    if (typeof syncProductsToSupabase === 'function' && typeof supabaseClient !== 'undefined' && supabaseClient) {
        try { await syncProductsToSupabase(); } catch(e) { console.warn("Cloud sync deferred", e); }
    }

    showToast("✅ تم تحديث الأسعار والمزامنة بنجاح", "success");
    closeQuickEditFloating();
    renderInventoryTable();
    if (typeof renderProductsGrid === 'function') renderProductsGrid();
}

async function toggleQuickStatus(event, productId) {
    if (event) event.stopPropagation(); // منع فتح تفاصيل السطر

    const pIdx = productsDB.findIndex(p => p.id === productId);
    if (pIdx === -1) return;

    const p = productsDB[pIdx];
    p.isQuick = !p.isQuick;

    await db.products.put(p);

    renderInventoryTable();
    if (typeof renderQuickItems === 'function') renderQuickItems();

    const action = p.isQuick ? "إضافته للأصناف السريعة ⚡" : "إزالته من الأصناف السريعة";
    showToast(`✅ تم ${action} بنجاح`, "success");
}
window.toggleQuickStatus = toggleQuickStatus;

function shareWarehouseReport(platform) {
    let summaryText = '';
    let grandVal = 0;
    let shopName = (typeof systemConfig !== 'undefined' && systemConfig.shopName) ? systemConfig.shopName : (document.getElementById('shopName')?.value || 'متجر بيان');

    if (typeof warehouses !== 'undefined') {
        warehouses.forEach(w => {
            let iCount = 0, qSum = 0, vSum = 0;
            productsDB.forEach(p => {
                const st = getWarehouseStock(p.name, w.name);
                if (st !== 0) {
                    iCount++; qSum += st;
                    vSum += (st * (parseFloat(p.cost) || 0));
                }
            });
            if (iCount > 0) {
                summaryText += '🏬 *' + w.name + '*: (حوالي ' + iCount + ' صنف) | كمية: ' + qSum + ' | قيمة: ' + vSum.toLocaleString() + ' ج.م\n';
                grandVal += vSum;
            }
        });
    }

    let text = '📊 *أرصدة المخازن - ' + shopName + '*\n';
    text += `📅 بتاريخ: ${new Date().toLocaleDateString('ar-EG')}\n`;
    text += `--------------------------\n`;
    text += summaryText;
    text += `--------------------------\n`;
    text += `💰 *إجمالي قيمة البضاعة*: *${grandVal.toLocaleString()} ج.م*\n`;
    text += `⚙️ *تم استخراجه من نظام بيان POS.*`;

    const encodedText = encodeURIComponent(text);
    let url = platform === 'whatsapp' ? `https://wa.me/?text=${encodedText}` : `https://t.me/share/url?url=${encodedText}`;
    window.open(url, '_blank');
}

function updateCategoryFilterOptions() {
    const filter = document.getElementById('invCategoryFilter');
    if (!filter) return;

    const currentVal = filter.value || 'all';
    const categories = [...new Set(productsDB.map(p => (p.category || '').trim()).filter(c => c))].sort();

    // التحقق مما إذا كانت الخيارات الحالية هي نفس التصنيفات لتفادي إعادة الإنشاء والتصفير
    const existingValues = [...filter.options].map(o => o.value).filter(v => v !== 'all');
    const isSame = existingValues.length === categories.length && existingValues.every((v, i) => v === categories[i]);

    if (!isSame) {
        filter.innerHTML = '<option value="all">كافة التصنيفات</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = `📁 ${cat}`;
            filter.appendChild(opt);
        });
    }

    if ([...filter.options].some(o => o.value === currentVal)) {
        filter.value = currentVal;
    } else {
        filter.value = 'all';
    }
}

window.toggleWrColMenu = function(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('wrColMenu');
    const overlay = document.getElementById('wrColOverlay');
    if (menu) menu.classList.toggle('hidden');
    if (overlay) overlay.classList.toggle('hidden');
};

window.toggleWrCol = function(colClass, isVisible) {
    const settings = JSON.parse(getStore('wrColSettings') || '{}');
    settings[colClass] = isVisible;
    setStore('wrColSettings', JSON.stringify(settings));
    applyWrColVisibility();
};

window.applyWrColVisibility = function() {
    const settings = JSON.parse(getStore('wrColSettings') || '{"col-wr-cost":true,"col-wr-total-val":true,"col-wr-profit-wh":true,"col-wr-profit-rt":true}');
    Object.keys(settings).forEach(colClass => {
        const isVisible = settings[colClass];
        document.querySelectorAll('.' + colClass).forEach(el => {
            el.style.display = isVisible ? '' : 'none';
        });

        const checkbox = document.querySelector(`input[onchange*="'${colClass}'"]`);
        if (checkbox) checkbox.checked = isVisible;
    });
};

window.wrFilterState = window.wrFilterState || { startDate: null, endDate: null };

window.applyWarehouseReportPeriodFilter = function(period) {
    const customContainer = document.getElementById('wrCustomDateContainer');
    const today = new Date();
    let start = null;
    let end = null;

    if (period === 'custom') {
        if (customContainer) customContainer.classList.remove('hidden');
        applyWarehouseReportCustomFilter();
        return;
    } else {
        if (customContainer) customContainer.classList.add('hidden');
    }

    const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (period === 'today') {
        start = formatDate(today);
        end = start;
    } else if (period === 'yesterday') {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        start = formatDate(y);
        end = start;
    } else if (period === 'thisweek') {
        const first = new Date(today);
        const day = first.getDay();
        const diff = first.getDate() - (day === 6 ? 0 : day + 1);
        first.setDate(diff);
        start = formatDate(first);
        end = formatDate(today);
    } else if (period === 'lastweek') {
        const first = new Date(today);
        const day = first.getDay();
        const diff = first.getDate() - (day === 6 ? 0 : day + 1) - 7;
        first.setDate(diff);
        const last = new Date(first);
        last.setDate(first.getDate() + 6);
        start = formatDate(first);
        end = formatDate(last);
    } else if (period === 'thismonth') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        start = formatDate(firstDay);
        end = formatDate(today);
    } else if (period === 'thisyear') {
        start = `${today.getFullYear()}-01-01`;
        end = formatDate(today);
    } else if (period === 'lastyear') {
        start = `${today.getFullYear() - 1}-01-01`;
        end = `${today.getFullYear() - 1}-12-31`;
    } else if (period === 'total') {
        start = null;
        end = null;
    }

    window.wrFilterState = { startDate: start, endDate: end };
    if (typeof invalidateStockCache === 'function') invalidateStockCache();
    renderWarehouseReportTable();
    if (typeof saveCurrentTabState === 'function') saveCurrentTabState();
};

window.applyWarehouseReportCustomFilter = function() {
    const sInput = document.getElementById('wrStartDate');
    const eInput = document.getElementById('wrEndDate');
    const start = sInput ? sInput.value : null;
    const end = eInput ? eInput.value : null;

    window.wrFilterState = { startDate: start || null, endDate: end || null };
    if (typeof invalidateStockCache === 'function') invalidateStockCache();
    renderWarehouseReportTable();
    if (typeof saveCurrentTabState === 'function') saveCurrentTabState();
};

function renderWarehouseReportTable(isSearchTrigger = false) {
    const head = document.getElementById('wrTableHead');
    const body = document.getElementById('wrTableBody');
    const summaryContainer = document.getElementById('wrSummaryCards');
    const searchInput = document.getElementById('wrSearchInput');
    const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const settings = JSON.parse(getStore('wrColSettings') || '{}');

    if (!head || !body) return;

    if (!window.wrRenderState || isSearchTrigger) {
        window.wrRenderState = { limit: 100 };
    }

    const whToggles = document.getElementById('wrWarehouseToggles');
    if (whToggles && whToggles.children.length <= 1 && typeof warehouses !== 'undefined') {
        warehouses.forEach(w => {
            const colClass = `col-wh-${w.name.replace(/\s+/g, '_')}`;
            if (settings[colClass] === undefined) settings[colClass] = true;

            const label = document.createElement('label');
            label.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 8px 15px; background: #f1f5f9; border-radius: 10px; cursor: pointer; font-size: 0.85rem;";
            label.innerHTML = `
                <span style="font-weight: 700; color: #475569;">كمية ${w.name}</span>
                <input type="checkbox" ${settings[colClass] !== false ? 'checked' : ''} onchange="toggleWrCol('${colClass}', this.checked)" style="accent-color: #5e3370;">
            `;
            whToggles.appendChild(label);
        });
        setStore('wrColSettings', JSON.stringify(settings));
    }

    let headHTML = `
        <tr style="background: #f8fafc; color: #1e293b; border-bottom: 2px solid #e2e8f0;">
            <th style="width:50px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; border-radius: 12px 0 0 0;">#</th>
            <th style="width:100px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0;">الكود</th>
            <th style="padding: 15px; text-align: right; font-weight: 800; border: 1px solid #e2e8f0; padding-right: 20px;">اسم الصنف</th>
            <th class="col-wr-cost" style="width:100px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0;">التكلفة</th>
    `;

    if (typeof warehouses !== 'undefined') {
        warehouses.forEach(w => {
            const colClass = `col-wh-${w.name.replace(/\s+/g, '_')}`;
            headHTML += `<th class="${colClass}" style="min-width:110px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0;">كمية ${w.name}</th>`;
        });
    }

    headHTML += `
            <th style="width:110px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; background: rgba(212,175,55,0.05); color: #8c6a24;">إجمالي الكمية</th>
            <th class="col-wr-total-val" style="width:130px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; background: rgba(33,115,70,0.05); color: #15803d;">إجمالي القيمة</th>
            <th class="col-wr-profit-wh" style="width:120px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; background: rgba(39,174,96,0.05); color: #27ae60;">ربح الجملة</th>
            <th class="col-wr-profit-rt" style="width:120px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; background: rgba(33,150,243,0.05); color: #2196f3; border-radius: 0 12px 0 0;">ربح التجزئة</th>
        </tr>
    `;
    head.innerHTML = headHTML;

    body.innerHTML = '';
    let totalGlobalQty = 0;
    let totalGlobalValue = 0;
    let totalGlobalProfitWH = 0;
    let totalGlobalProfitRT = 0;
    let warehouseStats = (typeof warehouses !== 'undefined') ? warehouses.map(w => ({ name: w.name, qty: 0, val: 0, items: 0 })) : [];

    const filteredProducts = productsDB.filter(p => 
        !search || 
        (p.name && p.name.toLowerCase().includes(search)) || 
        (p.barcode && String(p.barcode).toLowerCase().includes(search)) ||
        (p.code && String(p.code).toLowerCase().includes(search))
    );

    const sDate = (window.wrFilterState && window.wrFilterState.startDate) ? window.wrFilterState.startDate : null;
    const eDate = (window.wrFilterState && window.wrFilterState.endDate) ? window.wrFilterState.endDate : null;

    // حساب الإجماليات الدقيقة على جميع المنتجات المفلترة
    filteredProducts.forEach((p) => {
        const cost = parseFloat(p.cost) || 0;
        let rowQty = 0;

        if (typeof warehouses !== 'undefined') {
            warehouses.forEach((w, wIdx) => {
                const st = getWarehouseStock(p.name, w.name, sDate, eDate);
                rowQty += st;
                if (warehouseStats[wIdx]) {
                    warehouseStats[wIdx].qty += st;
                    warehouseStats[wIdx].val += (st * cost);
                    if (st !== 0) warehouseStats[wIdx].items++;
                }
            });
        }

        const rowValue = rowQty * cost;
        const retailPrice = parseFloat(p.price) || 0;
        const wholesalePrice = parseFloat(p.wholesale) || 0;

        const rowProfitWH = (wholesalePrice > 0) ? rowQty * (wholesalePrice - cost) : 0;
        const rowProfitRT = (retailPrice > 0) ? rowQty * (retailPrice - cost) : 0;

        totalGlobalQty += rowQty;
        totalGlobalValue += rowValue;
        totalGlobalProfitWH += rowProfitWH;
        totalGlobalProfitRT += rowProfitRT;
    });

    // اقتطاع العرض التجزيئي (Chunked Limit) لسرعة الـ Rendering وتجنب إرهاق الـ DOM
    const visibleProducts = filteredProducts.slice(0, window.wrRenderState.limit);
    const htmlRows = [];

    visibleProducts.forEach((p, idx) => {
        const cost = parseFloat(p.cost) || 0;
        let rowQty = 0;
        let warehouseCols = '';

        if (typeof warehouses !== 'undefined') {
            warehouses.forEach((w) => {
                const colClass = `col-wh-${w.name.replace(/\s+/g, '_')}`;
                const st = getWarehouseStock(p.name, w.name, sDate, eDate);
                rowQty += st;

                warehouseCols += `<td class="${colClass} num-cell" style="font-weight:900; color:${st < 0 ? '#ef4444' : (st > 0 ? '#10b981' : '#94a3b8')}; border-left: 1px solid #f1f5f9;">${st}</td>`;
            });
        }

        const rowValue = rowQty * cost;
        const retailPrice = parseFloat(p.price) || 0;
        const wholesalePrice = parseFloat(p.wholesale) || 0;

        const rowProfitWH = (wholesalePrice > 0) ? rowQty * (wholesalePrice - cost) : 0;
        const rowProfitRT = (retailPrice > 0) ? rowQty * (retailPrice - cost) : 0;

        htmlRows.push(`
            <tr class="wr-table-row" style="border-bottom: 1px solid #f1f5f9;">
                <td style="text-align:center; color:#94a3b8; font-size: 0.8rem;">${idx + 1}</td>
                <td style="text-align:center; font-weight:bold; color:#5e3370;">${p.code || p.id}</td>
                <td style="text-align:right; font-weight:800; color: #1e293b; padding-right: 20px;">${p.name}</td>
                <td class="col-wr-cost num-cell" style="color:#64748b; font-weight: 700;">${cost.toFixed(2)}</td>
                ${warehouseCols}
                <td class="num-cell" style="background:rgba(212,175,55,0.05); font-weight:900; color:#8c6a24; font-size: 1.1rem;">${rowQty}</td>
                <td class="col-wr-total-val num-cell" style="background:rgba(33,115,70,0.05); font-weight:900; color:#15803d;">${rowValue.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td class="col-wr-profit-wh num-cell" style="background:rgba(39,174,96,0.02); font-weight:900; color:#27ae60;">${rowProfitWH.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td class="col-wr-profit-rt num-cell" style="background:rgba(33,150,243,0.02); font-weight:900; color:#2196f3;">${rowProfitRT.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
            </tr>
        `);
    });

    if (filteredProducts.length > window.wrRenderState.limit) {
        const remaining = filteredProducts.length - window.wrRenderState.limit;
        const totalCols = 7 + (typeof warehouses !== 'undefined' ? warehouses.length : 0);
        htmlRows.push(`
            <tr id="wrLoadMoreRow" style="background: #f8fafc; text-align: center;">
                <td colspan="${totalCols}" style="padding: 15px;">
                    <button onclick="window.wrRenderState.limit += 200; renderWarehouseReportTable();" 
                        style="padding: 10px 25px; background: #5e3370; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(94,51,112,0.2);">
                        ➕ عرض المزيد من الأصناف (متبقي ${remaining.toLocaleString()} صنف)
                    </button>
                </td>
            </tr>
        `);
    }

    body.innerHTML = htmlRows.join('');
    applyWrColVisibility();

    if (summaryContainer) {
        let cardsHTML = `
            <div class="summary-card-gold" style="padding: 12px 16px; background: linear-gradient(135deg, #1e293b, #0f172a); color: white; border-radius: 14px; box-shadow: 0 4px 15px rgba(15,23,42,0.15); border: 1px solid rgba(255,255,255,0.1); border-right: 5px solid #3b82f6; display: flex; flex-direction: column; justify-content: center; transition: 0.3s;">
                <div style="font-size: 0.8rem; font-weight: 800; color: #93c5fd; margin-bottom: 4px;">📊 إجمالي المخزون (بكل الفروع)</div>
                <div style="font-size: 1.35rem; font-weight: 900; color: white;">${totalGlobalQty.toLocaleString()} <span style="font-size: 0.75rem; color: #94a3b8; font-weight: normal;">قطعة</span></div>
                <div style="font-size: 0.95rem; font-weight: 800; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 6px; padding-top: 4px; color: #60a5fa;">${totalGlobalValue.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} <span style="font-size: 0.75rem;">ج.م</span></div>
            </div>

            <div class="summary-card-profit-wh" style="padding: 12px 16px; background: linear-gradient(135deg, #064e3b, #052e16); color: white; border-radius: 14px; box-shadow: 0 4px 15px rgba(6,78,59,0.15); border: 1px solid rgba(255,255,255,0.1); border-right: 5px solid #10b981; display: flex; flex-direction: column; justify-content: center; transition: 0.3s;">
                <div style="font-size: 0.8rem; font-weight: 800; color: #6ee7b7; margin-bottom: 4px;">💵 إجمالي ربح الجملة</div>
                <div style="font-size: 1.35rem; font-weight: 900; color: white;">${totalGlobalProfitWH.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} <span style="font-size: 0.75rem;">ج.م</span></div>
                <div style="font-size: 0.72rem; margin-top: 4px; color: #34d399; opacity: 0.9;">(بناءً على الأرصدة الحالية)</div>
            </div>

            <div class="summary-card-profit-rt" style="padding: 12px 16px; background: linear-gradient(135deg, #1e3a8a, #172554); color: white; border-radius: 14px; box-shadow: 0 4px 15px rgba(30,58,138,0.15); border: 1px solid rgba(255,255,255,0.1); border-right: 5px solid #60a5fa; display: flex; flex-direction: column; justify-content: center; transition: 0.3s;">
                <div style="font-size: 0.8rem; font-weight: 800; color: #93c5fd; margin-bottom: 4px;">💎 إجمالي ربح التجزئة</div>
                <div style="font-size: 1.35rem; font-weight: 900; color: white;">${totalGlobalProfitRT.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} <span style="font-size: 0.75rem;">ج.م</span></div>
                <div style="font-size: 0.72rem; margin-top: 4px; color: #93c5fd; opacity: 0.9;">(بناءً على الأرصدة الحالية)</div>
            </div>
        `;

        warehouseStats.forEach(ws => {
            cardsHTML += `
                <div class="summary-card-white" style="padding: 12px 16px; background: linear-gradient(135deg, #334155, #0f172a); color: white; border-radius: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1); border-right: 5px solid #f59e0b; display: flex; flex-direction: column; justify-content: center; transition: 0.3s;">
                    <div style="font-size: 0.8rem; color: #fcd34d; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">🏬 كمية ${ws.name}</div>
                    <div style="font-size: 1.25rem; font-weight: 900; color: white;">${ws.qty.toLocaleString()} <span style="font-size: 0.75rem; color: #94a3b8; font-weight: normal;">قطعة</span></div>
                    <div style="font-size: 0.95rem; color: #34d399; font-weight: 800; margin-top: 2px;">${ws.val.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} <span style="font-size: 0.65rem;">ج.م</span></div>
                    <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 3px;">(${ws.items} صنف نشط)</div>
                </div>
            `;
        });
        summaryContainer.innerHTML = cardsHTML;
    }
}

function printWarehouseReport() {
    const shopName = document.getElementById('shopName')?.value || 'متجر بيان';

    const originalHead = document.getElementById('wrTableHead');
    const originalBody = document.getElementById('wrTableBody');

    if (!originalHead || !originalBody) return alert("لا توجد بيانات للطباعة");

    const headers = Array.from(originalHead.querySelectorAll('th')).map(th => th.innerText.replace(/📊|💵|💎|🏬|⚙️/g, '').trim());
    const rows = Array.from(originalBody.querySelectorAll('tr')).filter(tr => tr.style.display !== 'none');

    const summaryCards = document.querySelectorAll('#wrSummaryCards > div');
    let summaryHtml = '<div style="margin-bottom:15px; border:1px solid #000; padding:10px;">';
    summaryCards.forEach(card => {
        const title = card.querySelector('div:first-child')?.innerText.replace(/📊|💵|💎|🏬|⚙️/g, '') || '';
        const val = card.querySelector('div:nth-child(2)')?.innerText || '0';
        summaryHtml += `<div style="display:flex; justify-content:space-between; border-bottom:1px dashed #000; padding:3px 0; font-size:13px;">
            <span>${title}:</span>
            <span style="font-weight:900;">${val}</span>
        </div>`;
    });
    summaryHtml += '</div>';

    let rowsHtml = rows.map(tr => {
        const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    }).join('');

    const content = `
        <div style="direction:rtl; font-family:'Arial', sans-serif; padding:15px; color:#000; width:100%; box-sizing:border-box;">
            <div style="text-align:center; border-bottom:3px solid #000; padding-bottom:15px; margin-bottom:20px;">
                <h1 style="margin:0; font-size:22px; font-weight:900;">${shopName}</h1>
                <h2 style="margin:10px 0; font-size:18px; font-weight:bold; border:2px solid #000; display:inline-block; padding:5px 20px; border-radius:8px;">تقرير أرصدة المخازن التفصيلي</h2>
                <div style="font-size:12px; margin-top:5px; font-weight:bold;">بتاريخ: ${new Date().toLocaleString('ar-EG')}</div>
            </div>

            ${summaryHtml}

            <table style="width:100%; border-collapse:collapse; font-size:11px; border:2px solid #000; table-layout: auto;">
                <thead>
                    <tr style="background: #f1f5f9; -webkit-print-color-adjust: exact;">
                        ${headers.map(h => `<th style="padding:8px; border:1px solid #000; text-align:center;">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody style="text-align:center;">${rowsHtml}</tbody>
            </table>

            <div style="margin-top:30px; text-align:center; font-size:11px; border-top:1px dashed #000; padding-top:15px;">
                <div style="font-weight:bold;">تم استخراج التقرير بواسطة نظام بيان POS</div>
            </div>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>طباعة تقرير المخزون</title>
                <style>
                    @page { margin: 10mm; size: auto; }
                    body { margin: 0; padding: 0; direction: rtl; }
                    table th, table td { padding: 6px; border: 1px solid #000 !important; color: #000 !important; }
                    th { background: #eee !important; font-weight: 900; }
                    tr:nth-child(even) { background: #f9f9f9; }
                </style>
            </head>
            <body>
                ${content}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                <\/script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

function exportWarehouseReportToExcel() {
    const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : null));

    const table = [];
    const headerRow = ["#", "كود الصنف", "اسم الصنف", "تكلفة الوحدة"];
    if (typeof warehouses !== 'undefined') {
        warehouses.forEach(w => headerRow.push("كمية " + w.name));
    }
    headerRow.push("إجمالي الكمية", "إجمالي القيمة التقديرية", "ربح الجملة", "ربح التجزئة");
    table.push(headerRow);

    const search = document.getElementById('wrSearchInput')?.value.toLowerCase() || '';
    const filtered = productsDB.filter(p => 
        p.name.toLowerCase().includes(search) || 
        (p.barcode && String(p.barcode).toLowerCase().includes(search)) ||
        (p.code && String(p.code).toLowerCase().includes(search))
    );

    filtered.forEach((p, idx) => {
        const cost = parseFloat(p.cost) || 0;
        const row = [idx + 1, p.code || p.id, p.name, cost];
        let rowQty = 0;
        if (typeof warehouses !== 'undefined') {
            warehouses.forEach(w => {
                const st = getWarehouseStock(p.name, w.name);
                row.push(st);
                rowQty += st;
            });
        }
        row.push(rowQty, rowQty * cost, rowQty * ((parseFloat(p.wholesale) || 0) - cost), rowQty * ((parseFloat(p.price) || 0) - cost));
        table.push(row);
    });

    if (XLSXLib && XLSXLib.utils) {
        try {
            const ws = XLSXLib.utils.aoa_to_sheet(table);
            const wb = XLSXLib.utils.book_new();
            XLSXLib.utils.book_append_sheet(wb, ws, "أرصدة المخازن");
            XLSXLib.writeFile(wb, `تقرير_أرصدة_المخازن_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
            if (typeof showToast === 'function') showToast("✅ تم تصدير التقرير بنجاح", "success");
            return;
        } catch (e) { console.warn("Excel XLSX fallback activated:", e); }
    }

    if (typeof downloadAOAAsExcelCSV === 'function') {
        downloadAOAAsExcelCSV(table, `تقرير_أرصدة_المخازن_${new Date().toLocaleDateString('ar-EG')}`);
    } else if (typeof window.downloadAOAAsExcelCSV === 'function') {
        window.downloadAOAAsExcelCSV(table, `تقرير_أرصدة_المخازن_${new Date().toLocaleDateString('ar-EG')}`);
    }
}
window.exportWarehouseReportToExcel = exportWarehouseReportToExcel;

function downloadProductTemplate() {
    const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : null));

    const data = [
        ["كود الصنف", "كود داخلي", "اسم الصنف", "الباربود", "سعر البيع", "سعر الجملة", "سعر الشراء", "الكمية الحالية", "الوحدة", "المكان", "الفئة", "حد الطلب"]
    ];

    if (productsDB.length > 0) {
        productsDB.forEach(p => {
            data.push([
                p.sysCode || p.id || "",
                p.code || "",
                p.name || "",
                p.barcode || "",
                p.price || 0,
                p.wholesale || 0,
                p.cost || 0,
                p.stock || 0,
                p.unit || "قطعة",
                p.shelf || "",
                p.category || "عام",
                p.minStock || 0
            ]);
        });
    } else {
        data.push(["تلقائي", "101", "مثال: صنف جديد 1", "123456789", "100", "90", "80", "50", "قطعة", "رف أ1", "عام", "5"]);
    }

    if (XLSXLib && XLSXLib.utils) {
        const ws = XLSXLib.utils.aoa_to_sheet(data);
        const wb = XLSXLib.utils.book_new();
        XLSXLib.utils.book_append_sheet(wb, ws, "المنتجات");
        ws['!cols'] = [ {wch: 15}, {wch: 12}, {wch: 25}, {wch: 15}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 12}, {wch: 12}, {wch: 10} ];
        XLSXLib.writeFile(wb, "نموذج_مخزن_بيان_المتكامل.xlsx");
        if (typeof showToast === 'function') showToast("✅ تم استخراج النموذج بنجاح", "success");
    } else if (typeof downloadAOAAsExcelCSV === 'function') {
        downloadAOAAsExcelCSV(data, "نموذج_مخزن_بيان_المتكامل");
    }
}

async function importProductsFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (typeof showToast === 'function') showToast("🔄 جاري تحليل ملف الإكسيل...", "info");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : null));
            if (!XLSXLib) throw new Error("مكتبة Excel غير محملة أو غير جاهزة حالياً!");

            const data = new Uint8Array(e.target.result);
            const workbook = XLSXLib.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSXLib.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) throw new Error("الملف المختار فارغ أو لا يحتوي على بيانات!");

            const headers = jsonData[0].map(h => String(h || "").toLowerCase().trim());
            const findCol = (keys) => {
                let idx = headers.findIndex(h => keys.some(k => h === k.toLowerCase()));
                if (idx !== -1) return idx;
                return headers.findIndex(h => keys.some(k => h.includes(k.toLowerCase())));
            };

            const sysCodeIdx = findCol(['كود الصنف', 'sys', 'system']);
            const intCodeIdx = findCol(['كود داخلي', 'داخلي', 'internal']);
            const nameIdx = (() => {
                const nameKeys = ['اسم الصنف', 'اسم', 'item name', 'name'];
                let idx = headers.findIndex(h => nameKeys.some(k => h === k.toLowerCase()));
                if (idx !== -1) return idx;
                return headers.findIndex(h => !h.includes('كود') && !h.includes('code') && ['اسم', 'item', 'name', 'صنف'].some(k => h.includes(k)));
            })();
            const barIdx = findCol(['باربود', 'barcode']);
            const priceIdx = findCol(['سعر البيع', 'بيع', 'retail', 'price']);
            const wholesaleIdx = findCol(['جملة', 'wholesale']);
            const costIdx = findCol(['تكلفة', 'شراء', 'cost']);
            const qtyIdx = findCol(['كمية', 'رصيد', 'stock', 'qty']);
            const unitIdx = findCol(['وحدة', 'unit']);
            const shelfIdx = findCol(['مكان', 'رف', 'shelf']);
            const catIdx = findCol(['فئة', 'تصنيف', 'قسم', 'category']);
            const minStockIdx = findCol(['حد الطلب', 'min']);

            if (nameIdx === -1) throw new Error("لم نتمكن من العثور على عمود 'اسم الصنف' في الملف!");

            const rows = jsonData.slice(1);
            let added = 0;
            let updated = 0;
            let skippedEmpty = 0;
            let totalScanned = rows.length;

            await new Promise(resolve => setTimeout(resolve, 100));

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                try {
                    const name = row[nameIdx] ? String(row[nameIdx]).trim() : "";
                    if (!name) {
                        skippedEmpty++;
                        continue;
                    }

                    const sysCode = sysCodeIdx !== -1 ? String(row[sysCodeIdx] || "").trim() : "";
                    const intCode = intCodeIdx !== -1 ? String(row[intCodeIdx] || "").trim() : "";
                    const barcode = barIdx !== -1 ? String(row[barIdx] || "").trim() : "";
                    const price = parseFloat(row[priceIdx]) || 0;
                    const wholesale = wholesaleIdx !== -1 ? (parseFloat(row[wholesaleIdx]) || price) : price;
                    const cost = parseFloat(row[costIdx]) || 0;
                    const stock = parseFloat(row[qtyIdx]) || 0;
                    const unit = unitIdx !== -1 ? String(row[unitIdx] || "قطعة").trim() : "قطعة";
                    const shelf = shelfIdx !== -1 ? String(row[shelfIdx] || "").trim() : "";
                    const category = catIdx !== -1 ? String(row[catIdx] || "عام").trim() : "عام";
                    const minStock = minStockIdx !== -1 ? (parseFloat(row[minStockIdx]) || 0) : 0;

                    let existing = productsDB.find(p => 
                        (sysCode && sysCode !== "تلقائي" && (p.sysCode === sysCode || String(p.id) === sysCode)) ||
                        (barcode && p.barcode === barcode && barcode !== "-") ||
                        (name.toLowerCase() === p.name.toLowerCase())
                    );

                    if (existing) {
                        if (intCode) existing.code = intCode;
                        if (barcode && barcode !== "-") existing.barcode = barcode;
                        existing.price = price || existing.price;
                        existing.wholesale = wholesale || existing.wholesale;
                        existing.cost = cost || existing.cost;
                        existing.stock = stock;
                        existing.unit = unit || existing.unit;
                        existing.shelf = shelf || existing.shelf;
                        existing.category = category || existing.category;
                        existing.minStock = minStock || existing.minStock;
                        updated++;
                    } else {
                        const newId = Date.now() + i;
                        const newProduct = {
                            id: newId,
                            sysCode: (sysCode && sysCode !== "تلقائي") ? sysCode : String(newId),
                            code: intCode,
                            name, barcode, price, wholesale, cost, stock, unit, shelf, category, minStock,
                            units: [{ unitName: unit, factor: 1, cost, price, wholesale, isDefaultSale: true, isDefaultPurchase: true }]
                        };
                        productsDB.push(newProduct);
                        added++;
                    }

                    if (category && window.inventoryCategories && !window.inventoryCategories.includes(category)) {
                        window.inventoryCategories.push(category);
                        setStore('pos_inv_cats', JSON.stringify(window.inventoryCategories));
                    }
                } catch (rowErr) {
                    console.warn("خطأ في السطر " + (i + 2), rowErr);
                }
            }

            if (typeof saveData === 'function') await saveData();

            renderInventoryTable();
            if (typeof updateDatalists === 'function') updateDatalists();
            if (typeof renderProductsGrid === 'function') renderProductsGrid();

            let summaryMsg = `✅ اكتملت العملية:\n`;
            summaryMsg += `🔹 إجمالي الأسطر: ${totalScanned}\n`;
            summaryMsg += `🔹 تم التحديث: ${updated}\n`;
            summaryMsg += `🔹 تم الإضافة: ${added}\n`;
            if (skippedEmpty > 0) summaryMsg += `🔹 تم تجاهله (بدون اسم): ${skippedEmpty}`;

            alert(summaryMsg);
            event.target.value = ""; 

        } catch (err) {
            console.error('Import error:', err);
            alert("❌ حدث خطأ أثناء الاستيراد:\n" + err.message);
        }
    };
    reader.onerror = () => {
        showToast("❌ فشل قراءة الملف من الجهاز", "error");
    };
    reader.readAsArrayBuffer(file);
}

function selectAllInventory(checked) {
    document.querySelectorAll('.inv-row-check').forEach(chk => {
        chk.checked = checked;
        const tr = chk.closest('tr');
        if (tr) {
            const id = parseInt(tr.getAttribute('data-id'));
            if (checked) {
                window.selectedInventoryIds.add(id);
                tr.classList.add('selected-row-gold');
            } else {
                window.selectedInventoryIds.delete(id);
                tr.classList.remove('selected-row-gold');
            }
        }
    });
    updateInventorySelectionUI();
}

function handleInventoryCheckClick(event, id, tr) {
    event.stopPropagation();
    const chk = event.target.closest('input[type="checkbox"]');
    if (chk) {
        if (chk.checked) {
            window.selectedInventoryIds.add(id);
            window.selectedInventoryId = id;
            tr.classList.add('selected-row-gold');
        } else {
            window.selectedInventoryIds.delete(id);
            if (window.selectedInventoryId === id) window.selectedInventoryId = null;
            tr.classList.remove('selected-row-gold');
        }
    }
    updateInventorySelectionUI();
}

function updateInventorySelectionUI() {
    const checkedCount = window.selectedInventoryIds.size;

    const badge = document.getElementById('priceAdjSelectCount');
    if (badge) {
        if (checkedCount > 0) {
            badge.innerText = checkedCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    const btns = ['invEditBtn', 'invDeleteBtn', 'invPriceAdjBtn'];
    btns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
            if (checkedCount > 0) {
                btn.style.opacity = '1';
                btn.style.filter = 'none';
            } else {
                btn.style.opacity = '0.95';
                btn.style.filter = 'none';
            }
        }
    });
}

function toggleInventoryRowSelection(id, tr, event) {
    if (event && event.target.closest('.col-inv-0')) return;

    const chk = tr.querySelector('.inv-row-check');
    if (chk) {
        chk.checked = !chk.checked;
        if (chk.checked) {
            window.selectedInventoryIds.add(id);
            window.selectedInventoryId = id;
            tr.classList.add('selected-row-gold');
        } else {
            window.selectedInventoryIds.delete(id);
            if (window.selectedInventoryId === id) window.selectedInventoryId = null;
            tr.classList.remove('selected-row-gold');
        }
    }
    updateInventorySelectionUI();
}

function updateSideStockCard(productId) {
    const card = document.getElementById('sideStockCard');
    if(!card) return;

    const p = productsDB.find(x => x.id == productId);
    if(!p) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    if (document.getElementById('sideStockProductName')) document.getElementById('sideStockProductName').innerText = p.name;
    if (document.getElementById('sideStockUnit')) document.getElementById('sideStockUnit').innerText = p.unit || 'قطعة';

    const currentWh = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';
    if (document.getElementById('sideStockCurrentWarehouseName')) document.getElementById('sideStockCurrentWarehouseName').innerText = currentWh;

    const currentStockVal = getWarehouseStock(p.name, currentWh);
    if (document.getElementById('sideStockCurrentVal')) document.getElementById('sideStockCurrentVal').innerText = currentStockVal;

    const othersContainer = document.getElementById('sideStockOtherWarehouses');
    if(othersContainer && typeof warehouses !== 'undefined') {
        othersContainer.innerHTML = '';
        warehouses.forEach(w => {
            if(w.name === currentWh) return;
            const st = getWarehouseStock(p.name, w.name);
            const row = document.createElement('div');
            row.style.cssText = "display:flex; justify-content:space-between; font-size:0.8rem; border-bottom:1px solid rgba(255,255,255,0.05); padding:4px 0;";
            row.innerHTML = `<span style="color:#aaa;">${w.name}</span><span style="font-weight:bold; color:${st < 0 ? '#e74c3c' : (st > 0 ? '#27ae60' : '#888')};">${st}</span>`;
            othersContainer.appendChild(row);
        });
    }
}

let _stockCache = null;
let _stockCacheKey = null;

function invalidateStockCache() {
    _stockCache = null;
    _stockCacheKey = null;
}
window.invalidateStockCache = invalidateStockCache;

function getWarehouseStock(productName, warehouseName, startDate = null, endDate = null) {
    if (!productName) return 0;
    const targetWH = (warehouseName || (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || 'المخزن الرئيسي').trim();

    const p = productsDB.find(prod => prod && (prod.name === productName || prod.name?.trim() === productName.trim()));
    if (!p) return 0;

    // إذا لم يكن هناك فلتر تاريخ، نرجع الرصيد الفعلي المحدث والمحفوظ للصنف في هذا المخزن مباشرة
    if (!startDate && !endDate) {
        if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
            let varSum = 0;
            p.variants.forEach(v => {
                if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[targetWH] !== undefined) {
                    varSum += parseFloat(v.warehouseStocks[targetWH]) || 0;
                } else if (targetWH === 'المخزن الرئيسي') {
                    varSum += parseFloat(v.stock) || 0;
                }
            });
            return varSum;
        }

        if (p.warehouseStocks && typeof p.warehouseStocks === 'object' && p.warehouseStocks[targetWH] !== undefined) {
            return parseFloat(p.warehouseStocks[targetWH]) || 0;
        }
        if (targetWH === 'المخزن الرئيسي') {
            return parseFloat(p.stock) || 0;
        }
        return 0;
    }

    const cacheKey = `${startDate || ''}_${endDate || ''}_${transactions.length}_${productsDB.length}`;
    if (!_stockCache || _stockCacheKey !== cacheKey) {
        _stockCache = {};
        _stockCacheKey = cacheKey;

        const prodIndex = {};
        const globalChangeMap = {};
        productsDB.forEach(prod => {
            if (prod.name) {
                const n = prod.name.trim();
                prodIndex[n] = prod;
                prodIndex[n.toLowerCase()] = prod;
                _stockCache[n] = {};
                globalChangeMap[n] = 0;
            }
        });

        for (let i = 0; i < transactions.length; i++) {
            const t = transactions[i];
            const rawName = (t.product || t.productName || t.name || '').trim();
            if (!rawName) continue;
            const pRef = prodIndex[rawName] || prodIndex[rawName.toLowerCase()];
            if (!pRef) continue;
            const pName = pRef.name.trim();

            let tDateISO = (t.dateISO || t.date || '').trim();
            if (tDateISO.includes('T')) tDateISO = tDateISO.split('T')[0];
            else if (tDateISO.match(/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4}/)) {
                const parts = tDateISO.split(/[\/\.-]/);
                tDateISO = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (tDateISO.length > 10) {
                tDateISO = tDateISO.slice(0, 10);
            }

            if (startDate && tDateISO < startDate) continue;
            if (endDate && tDateISO > endDate) continue;

            let factor = 1;
            if (pRef.units && t.unit) {
                const u = pRef.units.find(un => un.unitName === t.unit);
                if (u) factor = parseFloat(u.factor) || 1;
            }

            const qty = (parseFloat(t.qty || 0)) * factor;
            const type = t.type || '';
            const tWH = (t.warehouse || 'المخزن الرئيسي').trim();

            let change = 0;
            if (type.includes('شراء') && !type.includes('مرتجع')) change = qty;
            else if (type.includes('مرتجع بيع')) change = qty;
            else if (type.includes('بيع') && !type.includes('مرتجع')) change = -qty;
            else if (type.includes('مرتجع شراء')) change = -qty;
            else if (type.includes('تسوية')) change = qty;

            if (!type.includes('تحويل')) {
                globalChangeMap[pName] += change;
            }

            if (!_stockCache[pName][tWH]) _stockCache[pName][tWH] = 0;
            _stockCache[pName][tWH] += change;

            if (type.includes('تحويل')) {
                const parts = (t.partner || '').split(' -> ');
                if (parts.length === 2) {
                    const wTo = parts[1].trim();
                    const wFrom = parts[0].trim();
                    if (!_stockCache[pName][wTo]) _stockCache[pName][wTo] = 0;
                    _stockCache[pName][wTo] += qty;
                    if (!_stockCache[pName][wFrom]) _stockCache[pName][wFrom] = 0;
                    _stockCache[pName][wFrom] -= qty;
                }
            }
        }
    }

    const pStocks = _stockCache[(productName || '').trim()];
    return pStocks ? (pStocks[targetWH] || 0) : 0;
}

function showInvDetails(id) {
    const p = productsDB.find(x => x.id === id);
    if (!p) return;

    const idEl = document.getElementById('invSelectedId');
    if (idEl) idEl.value = id;

    const stockEl = document.getElementById('invDisplayStock');
    if (stockEl) stockEl.innerText = p.stock || 0;

    const costEl = document.getElementById('invDisplayCost');
    if (costEl) costEl.value = p.cost || 0;

    const priceEl = document.getElementById('invDisplayPrice');
    if (priceEl) priceEl.value = p.price || 0;

    const unitSel = document.getElementById('invDisplayUnit');
    if (unitSel && p.unit) {
        for (let opt of unitSel.options) {
            if (opt.value === p.unit) { opt.selected = true; break; }
        }
    }

    updateSideStockCard(id);
}

function openQuickEditFloating(id) {
    const p = productsDB.find(x => x.id === id);
    if (!p) return;

    const floatingWin = document.getElementById('quickEditFloatingWindow');
    const floatingTitle = document.getElementById('floatingEditTitle');

    if (floatingWin) {
        floatingWin.classList.remove('hidden');
        if (floatingTitle) floatingTitle.innerText = `✏️ تعديل: ${p.name}`;

        document.getElementById('quickEditBaseUnitName').innerText = p.unit || 'قطعة';
        document.getElementById('quickEditRetail').value = p.price || 0;
        document.getElementById('quickEditWholesale').value = p.wholesale || 0;
        document.getElementById('quickEditCost').value = p.cost || 0;

        const subUnit = (p.units && p.units.length > 1) ? p.units.find(u => u.factor > 1 || u.unitName !== p.unit) : null;
        const subSection = document.getElementById('quickEditSubUnitSection');

        if (subUnit) {
            subSection.style.display = 'block';
            document.getElementById('quickEditSubUnitName').innerText = subUnit.unitName;
            document.getElementById('quickEditSubRetail').value = subUnit.price || 0;
            document.getElementById('quickEditSubWholesale').value = subUnit.wholesale || 0;
        } else if (subSection) {
            subSection.style.display = 'none';
        }

        setTimeout(() => document.getElementById('quickEditRetail')?.focus(), 100);
    }
}

function closeQuickEditFloating() {
    const floatingWin = document.getElementById('quickEditFloatingWindow');
    if (floatingWin) floatingWin.classList.add('hidden');
}

function showQuickEditManual() {
    let targetId = typeof selectedInventoryId !== 'undefined' ? selectedInventoryId : null;
    if (!targetId) {
        const checked = document.querySelector('.inv-row-check:checked');
        if (checked) targetId = parseInt(checked.closest('tr').getAttribute('data-id'));
    }

    if (!targetId) {
        return showToast("⚠️ يرجى تحديد صنف من الجدول أولاً", "error");
    }

    openQuickEditFloating(targetId);
}

function quickAddProduct(name, context) {
    if (typeof currentQuickAddContext !== 'undefined') window.currentQuickAddContext = context;
    if (typeof openNewItemModal === 'function') openNewItemModal(name);
}
