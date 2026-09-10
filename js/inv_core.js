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

        if (type.includes('تحويل') && t.transferStatus === 'received') {
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

window.handleInventorySearchKeyDown = function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const inp = document.getElementById('invSearchInput');
        const query = (inp ? inp.value : '').trim();
        if (!query) return;

        const allProducts = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : [];
        const cleanAr = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
        const rawQ = query.toLowerCase();
        const q = cleanAr(query);

        // 1. فحص التطابق التام مع أي باركود (صنف، تشكيلة مقاس/لون، وحدة، كود ميزان، كود)
        let matchedProduct = allProducts.find(p => {
            if (p.barcode && (cleanAr(p.barcode) === q || String(p.barcode).trim().toLowerCase() === rawQ)) return true;
            if (p.code && (cleanAr(p.code) === q || String(p.code).trim().toLowerCase() === rawQ)) return true;
            if (p.scalePlu && (String(p.scalePlu).trim() === rawQ || cleanAr(p.scalePlu) === q)) return true;
            if (p.sysCode && String(p.sysCode).trim().toLowerCase() === rawQ) return true;
            if (p.units && p.units.some(u => u.unitBarcode && (cleanAr(u.unitBarcode) === q || String(u.unitBarcode).trim().toLowerCase() === rawQ))) return true;
            if (p.variants && p.variants.some(v => v.barcode && (cleanAr(v.barcode) === q || String(v.barcode).trim().toLowerCase() === rawQ))) return true;
            return false;
        });

        // 2. إذا لم يكن هناك تطابق تام، نختار أول سطر معروض حالياً في الجدول
        if (!matchedProduct) {
            const firstRow = document.querySelector('#inventoryTableBody tr[data-id]');
            if (firstRow) {
                const pid = Number(firstRow.getAttribute('data-id'));
                if (pid) matchedProduct = allProducts.find(p => p.id === pid);
            }
        }

        if (matchedProduct) {
            if (window.selectedInventoryIds) {
                window.selectedInventoryIds.clear();
                window.selectedInventoryIds.add(matchedProduct.id);
                window.selectedInventoryId = matchedProduct.id;
            }
            renderInventoryTable();

            setTimeout(() => {
                const targetRow = document.querySelector(`#inventoryTableBody tr[data-id="${matchedProduct.id}"]`);
                if (targetRow) {
                    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetRow.classList.add('selected-row-gold');
                }
            }, 50);

            if (inp) inp.select(); // تحديد النص ليكون السكانر جاهز للمسحة التالية فوراً
        }
    }
};

function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    if (typeof hasPermission === 'function' && !hasPermission('stock_view')) {
        tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center; padding:50px; color:#64748b; font-weight:bold;">ليس لديك صلاحية لعرض المخزن</td></tr>';
        return;
    }

    const searchInput = document.getElementById('invSearchInput');
    const rawSearch = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const cleanAr = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
    const search = cleanAr(rawSearch);
    const catFilter = document.getElementById('invCategoryFilter')?.value || 'all';

    if (rawSearch === '' && typeof updateCategoryFilterOptions === 'function') updateCategoryFilterOptions();

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

        if (rawSearch) {
            const nameMatch = p.name && cleanAr(p.name).includes(search);
            const barcodeMatch = p.barcode && (cleanAr(p.barcode) === search || String(p.barcode).toLowerCase().includes(rawSearch));
            const codeMatch = p.code && (cleanAr(p.code) === search || String(p.code).toLowerCase().includes(rawSearch));
            const sysCodeMatch = (p.sysCode && String(p.sysCode).toLowerCase().includes(rawSearch)) || (String(p.id) === rawSearch);
            const scalePluMatch = p.scalePlu && (String(p.scalePlu).trim() === rawSearch || cleanAr(p.scalePlu) === search);
            const unitBarcodeMatch = p.units && p.units.some(u => u.unitBarcode && (cleanAr(u.unitBarcode) === search || String(u.unitBarcode).toLowerCase().includes(rawSearch)));
            const variantBarcodeMatch = p.variants && p.variants.some(v => v.barcode && (cleanAr(v.barcode) === search || String(v.barcode).trim().toLowerCase().includes(rawSearch)));

            if (!nameMatch && !barcodeMatch && !codeMatch && !sysCodeMatch && !scalePluMatch && !unitBarcodeMatch && !variantBarcodeMatch) {
                return;
            }
        }

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

window.getSafeWhClass = function(whName) {
    if (!whName) return 'col-wh-unknown';
    const safe = String(whName).trim().replace(/[^\w\u0600-\u06FF]/g, '_');
    return 'col-wh-' + safe;
};

window.toggleWrColMenu = function(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('wrColMenu');
    const overlay = document.getElementById('wrColOverlay');
    if (menu) menu.classList.toggle('hidden');
    if (overlay) overlay.classList.toggle('hidden');

    const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
    const canViewCost = (typeof hasPermission === 'function') ? hasPermission('docs_purchase_price') : true;

    const optCost = document.getElementById('wrOptCost');
    const optVal = document.getElementById('wrOptTotalVal');
    const optWh = document.getElementById('wrOptProfitWh');
    const optRt = document.getElementById('wrOptProfitRt');
    if (optCost) optCost.style.display = canViewCost ? 'flex' : 'none';
    if (optVal) optVal.style.display = canViewCost ? 'flex' : 'none';
    if (optWh) optWh.style.display = canViewProfits ? 'flex' : 'none';
    if (optRt) optRt.style.display = canViewProfits ? 'flex' : 'none';
};

window.toggleWrCol = function(colClass, isVisible) {
    const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
    const canViewCost = (typeof hasPermission === 'function') ? hasPermission('docs_purchase_price') : true;
    if (!canViewCost && (colClass === 'col-wr-cost' || colClass === 'col-wr-total-val')) return;
    if (!canViewProfits && (colClass === 'col-wr-profit-wh' || colClass === 'col-wr-profit-rt')) return;

    const settings = JSON.parse(getStore('wrColSettings') || '{}');
    settings[colClass] = isVisible;
    setStore('wrColSettings', JSON.stringify(settings));
    applyWrColVisibility();
};

window.applyWrColVisibility = function() {
    const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
    const canViewCost = (typeof hasPermission === 'function') ? hasPermission('docs_purchase_price') : true;

    const settings = JSON.parse(getStore('wrColSettings') || '{"col-wr-cost":true,"col-wr-total-val":true,"col-wr-profit-wh":true,"col-wr-profit-rt":true}');
    
    // إخفاء أعمدة التكلفة والأرباح حتمياً إذا لم تكن الصلاحية ممنوحة
    if (!canViewCost) {
        settings['col-wr-cost'] = false;
        settings['col-wr-total-val'] = false;
    }
    if (!canViewProfits) {
        settings['col-wr-profit-wh'] = false;
        settings['col-wr-profit-rt'] = false;
    }

    Object.keys(settings).forEach(colClass => {
        const isVisible = settings[colClass];
        try {
            document.querySelectorAll('.' + colClass).forEach(el => {
                el.style.display = isVisible ? '' : 'none';
            });
        } catch (err) {
            console.warn("Error applying column visibility for:", colClass, err);
        }

        try {
            const checkbox = document.querySelector(`input[onchange*="'${colClass}'"]`);
            if (checkbox) checkbox.checked = isVisible;
        } catch (err) {}
    });

    const optCost = document.getElementById('wrOptCost');
    const optVal = document.getElementById('wrOptTotalVal');
    const optWh = document.getElementById('wrOptProfitWh');
    const optRt = document.getElementById('wrOptProfitRt');
    if (optCost) optCost.style.display = canViewCost ? 'flex' : 'none';
    if (optVal) optVal.style.display = canViewCost ? 'flex' : 'none';
    if (optWh) optWh.style.display = canViewProfits ? 'flex' : 'none';
    if (optRt) optRt.style.display = canViewProfits ? 'flex' : 'none';
};

window.toggleProductVariantsRow = function(productId, btn) {
    const subRow = document.getElementById(`wr-variants-${productId}`);
    if (!subRow) return;
    const isHidden = subRow.style.display === 'none';
    subRow.style.display = isHidden ? 'table-row' : 'none';
    if (btn) {
        if (isHidden) {
            btn.innerHTML = btn.innerHTML.replace('▾', '▴');
            btn.style.background = '#5e3370';
            btn.style.color = '#ffffff';
        } else {
            btn.innerHTML = btn.innerHTML.replace('▴', '▾');
            btn.style.background = '#e0e7ff';
            btn.style.color = '#3730a3';
        }
    }
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
    const settings = JSON.parse(getStore('wrColSettings') || '{}');

    if (!head || !body) return;

    const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
    const canViewCost = (typeof hasPermission === 'function') ? hasPermission('docs_purchase_price') : true;

    if (!canViewCost) {
        settings['col-wr-cost'] = false;
        settings['col-wr-total-val'] = false;
    }
    if (!canViewProfits) {
        settings['col-wr-profit-wh'] = false;
        settings['col-wr-profit-rt'] = false;
    }

    if (!window.wrRenderState || isSearchTrigger) {
        window.wrRenderState = { limit: 100 };
    }

    const cleanAr = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[\u064B-\u065F]/g, '')
            .trim()
            .toLowerCase();
    };

    const whToggles = document.getElementById('wrWarehouseToggles');
    if (whToggles && typeof warehouses !== 'undefined') {
        const existingClasses = new Set(Array.from(whToggles.querySelectorAll('input[onchange]')).map(inp => {
            const m = inp.getAttribute('onchange')?.match(/toggleWrCol\('([^']+)'/);
            return m ? m[1] : null;
        }).filter(Boolean));

        let addedAny = false;
        warehouses.forEach(w => {
            const colClass = getSafeWhClass(w.name);
            if (!existingClasses.has(colClass)) {
                if (settings[colClass] === undefined) settings[colClass] = true;

                const label = document.createElement('label');
                label.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 8px 15px; background: #f1f5f9; border-radius: 10px; cursor: pointer; font-size: 0.85rem;";
                label.innerHTML = `
                    <span style="font-weight: 700; color: #475569;">كمية ${w.name}</span>
                    <input type="checkbox" ${settings[colClass] !== false ? 'checked' : ''} onchange="toggleWrCol('${colClass}', this.checked)" style="accent-color: #5e3370;">
                `;
                whToggles.appendChild(label);
                addedAny = true;
            }
        });
        if (addedAny) setStore('wrColSettings', JSON.stringify(settings));
    }

    let headHTML = `
        <tr style="background: #f8fafc; color: #1e293b; border-bottom: 2px solid #e2e8f0;">
            <th style="width:50px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; border-radius: 12px 0 0 0;">#</th>
            <th style="width:110px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0;">الكود</th>
            <th style="padding: 15px; text-align: right; font-weight: 800; border: 1px solid #e2e8f0; padding-right: 20px;">اسم الصنف</th>
            <th class="col-wr-cost" style="width:100px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; ${!canViewCost ? 'display:none;' : ''}">التكلفة</th>
    `;

    if (typeof warehouses !== 'undefined') {
        warehouses.forEach(w => {
            const colClass = getSafeWhClass(w.name);
            headHTML += `<th class="${colClass}" style="min-width:110px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0;">كمية ${w.name}</th>`;
        });
    }

    headHTML += `
            <th style="width:110px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; background: rgba(212,175,55,0.05); color: #8c6a24;">إجمالي الكمية</th>
            <th class="col-wr-total-val" style="width:130px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; background: rgba(33,115,70,0.05); color: #15803d; ${!canViewCost ? 'display:none;' : ''}">إجمالي القيمة</th>
            <th class="col-wr-profit-wh" style="width:120px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; background: rgba(39,174,96,0.05); color: #27ae60; ${!canViewProfits ? 'display:none;' : ''}">ربح الجملة</th>
            <th class="col-wr-profit-rt" style="width:120px; padding: 15px; text-align: center; font-weight: 800; border: 1px solid #e2e8f0; background: rgba(33,150,243,0.05); color: #2196f3; border-radius: 0 12px 0 0; ${!canViewProfits ? 'display:none;' : ''}">ربح التجزئة</th>
        </tr>
    `;
    head.innerHTML = headHTML;

    body.innerHTML = '';
    let totalGlobalQty = 0;
    let totalGlobalValue = 0;
    let totalGlobalProfitWH = 0;
    let totalGlobalProfitRT = 0;
    let warehouseStats = (typeof warehouses !== 'undefined') ? warehouses.map(w => ({ name: w.name, qty: 0, val: 0, items: 0 })) : [];

    const searchRaw = searchInput ? searchInput.value.trim() : '';
    const searchClean = cleanAr(searchRaw);

    const filteredProducts = productsDB.filter(p => {
        if (!p) return false;
        if (!searchClean) return true;
        if (cleanAr(p.name).includes(searchClean)) return true;
        if (p.barcode && String(p.barcode).includes(searchRaw)) return true;
        if (p.code && String(p.code).toLowerCase().includes(searchClean)) return true;
        if (p.variants && Array.isArray(p.variants)) {
            return p.variants.some(v => 
                (v.barcode && String(v.barcode).includes(searchRaw)) ||
                (v.size && cleanAr(v.size).includes(searchClean)) ||
                (v.color && cleanAr(v.color).includes(searchClean))
            );
        }
        return false;
    });

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
    const totalCols = 7 + (typeof warehouses !== 'undefined' ? warehouses.length : 0);

    visibleProducts.forEach((p, idx) => {
        const cost = parseFloat(p.cost) || 0;
        let rowQty = 0;
        let warehouseCols = '';

        if (typeof warehouses !== 'undefined') {
            warehouses.forEach((w) => {
                const colClass = getSafeWhClass(w.name);
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

        const hasVariants = p.variants && Array.isArray(p.variants) && p.variants.length > 0;
        const variantBtn = hasVariants 
            ? `<button type="button" onclick="window.toggleProductVariantsRow('${p.id}', this)" style="display:inline-flex; align-items:center; gap:4px; margin-right:8px; padding:2px 8px; background:#e0e7ff; color:#3730a3; border:1px solid #c7d2fe; border-radius:6px; font-size:0.75rem; font-weight:800; cursor:pointer; vertical-align:middle; transition:0.2s;" title="عرض تفاصيل المقاسات والألوان">👗 ${p.variants.length} مقاس/لون ▾</button>` 
            : '';

        htmlRows.push(`
            <tr class="wr-table-row" style="border-bottom: 1px solid #f1f5f9;">
                <td style="text-align:center; color:#94a3b8; font-size: 0.8rem;">${idx + 1}</td>
                <td style="text-align:center; font-weight:bold; color:#5e3370;">${p.code || p.id}</td>
                <td style="text-align:right; font-weight:800; color: #1e293b; padding-right: 20px;">
                    ${p.name}
                    ${variantBtn}
                </td>
                <td class="col-wr-cost num-cell" style="color:#64748b; font-weight: 700; ${!canViewCost ? 'display:none;' : ''}">${cost.toFixed(2)}</td>
                ${warehouseCols}
                <td class="num-cell" style="background:rgba(212,175,55,0.05); font-weight:900; color:#8c6a24; font-size: 1.1rem;">${rowQty}</td>
                <td class="col-wr-total-val num-cell" style="background:rgba(33,115,70,0.05); font-weight:900; color:#15803d; ${!canViewCost ? 'display:none;' : ''}">${rowValue.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td class="col-wr-profit-wh num-cell" style="background:rgba(39,174,96,0.02); font-weight:900; color:#27ae60; ${!canViewProfits ? 'display:none;' : ''}">${rowProfitWH.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                <td class="col-wr-profit-rt num-cell" style="background:rgba(33,150,243,0.02); font-weight:900; color:#2196f3; ${!canViewProfits ? 'display:none;' : ''}">${rowProfitRT.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
            </tr>
        `);

        if (hasVariants) {
            let varSubRows = '';
            p.variants.forEach((v, vIdx) => {
                let vTotalQty = 0;
                let vWhCols = '';
                if (typeof warehouses !== 'undefined') {
                    warehouses.forEach(w => {
                        const colClass = getSafeWhClass(w.name);
                        let vSt = 0;
                        if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[w.name] !== undefined) {
                            vSt = parseFloat(v.warehouseStocks[w.name]) || 0;
                        } else if (w.name === 'المخزن الرئيسي') {
                            vSt = parseFloat(v.stock) || 0;
                        }
                        vTotalQty += vSt;
                        vWhCols += `<td class="${colClass}" style="padding:6px 10px; text-align:center; font-weight:800; color:${vSt > 0 ? '#10b981' : (vSt < 0 ? '#ef4444' : '#94a3b8')}; border:1px solid #e2e8f0;">${vSt}</td>`;
                    });
                }
                varSubRows += `
                    <tr style="border-bottom:1px dashed #cbd5e1;">
                        <td style="padding:6px; text-align:center; color:#64748b; font-size:0.8rem; border:1px solid #e2e8f0;">${vIdx + 1}</td>
                        <td style="padding:6px 10px; text-align:center; font-family:monospace; font-weight:bold; color:#5e3370; border:1px solid #e2e8f0;">${v.barcode || '-'}</td>
                        <td style="padding:6px 10px; text-align:center; font-weight:800; color:#1e293b; border:1px solid #e2e8f0;">${v.size || v.name || '-'}</td>
                        <td style="padding:6px 10px; text-align:center; font-weight:700; color:#475569; border:1px solid #e2e8f0;">${v.color || '-'}</td>
                        ${vWhCols}
                        <td style="padding:6px 10px; text-align:center; font-weight:900; color:#8c6a24; background:rgba(212,175,55,0.05); border:1px solid #e2e8f0;">${vTotalQty}</td>
                    </tr>
                `;
            });

            let vWhHeaders = '';
            if (typeof warehouses !== 'undefined') {
                warehouses.forEach(w => {
                    const colClass = getSafeWhClass(w.name);
                    vWhHeaders += `<th class="${colClass}" style="padding:6px; text-align:center; border:1px solid #cbd5e1;">${w.name}</th>`;
                });
            }

            htmlRows.push(`
                <tr id="wr-variants-${p.id}" class="wr-variant-subrow" style="display:none; background:#faf5ff;">
                    <td colspan="${totalCols}" style="padding:12px 25px; border-bottom:2px solid #cbd5e1;">
                        <div style="background:white; border-radius:10px; padding:12px; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                            <div style="font-weight:900; font-size:0.85rem; color:#5e3370; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                                <span>👗 تفاصيل المقاسات والألوان للصنف: ${p.name}</span>
                            </div>
                            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                                <thead>
                                    <tr style="background:#f1f5f9; color:#334155; font-size:0.8rem;">
                                        <th style="padding:6px; text-align:center; width:35px; border:1px solid #cbd5e1;">#</th>
                                        <th style="padding:6px; text-align:center; width:130px; border:1px solid #cbd5e1;">الباركود</th>
                                        <th style="padding:6px; text-align:center; border:1px solid #cbd5e1;">المقاس</th>
                                        <th style="padding:6px; text-align:center; border:1px solid #cbd5e1;">اللون</th>
                                        ${vWhHeaders}
                                        <th style="padding:6px; text-align:center; width:90px; border:1px solid #cbd5e1; background:rgba(212,175,55,0.1); color:#8c6a24;">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${varSubRows}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            `);
        }
    });

    if (filteredProducts.length > window.wrRenderState.limit) {
        const remaining = filteredProducts.length - window.wrRenderState.limit;
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
                ${canViewCost ? `<div style="font-size: 0.95rem; font-weight: 800; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 6px; padding-top: 4px; color: #60a5fa;">${totalGlobalValue.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} <span style="font-size: 0.75rem;">ج.م</span></div>` : ''}
            </div>
        `;

        if (canViewProfits) {
            cardsHTML += `
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
        }

        warehouseStats.forEach(ws => {
            cardsHTML += `
                <div class="summary-card-white" style="padding: 12px 16px; background: linear-gradient(135deg, #334155, #0f172a); color: white; border-radius: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1); border-right: 5px solid #f59e0b; display: flex; flex-direction: column; justify-content: center; transition: 0.3s;">
                    <div style="font-size: 0.8rem; color: #fcd34d; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">🏬 كمية ${ws.name}</div>
                    <div style="font-size: 1.25rem; font-weight: 900; color: white;">${ws.qty.toLocaleString()} <span style="font-size: 0.75rem; color: #94a3b8; font-weight: normal;">قطعة</span></div>
                    ${canViewCost ? `<div style="font-size: 0.95rem; color: #34d399; font-weight: 800; margin-top: 2px;">${ws.val.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} <span style="font-size: 0.65rem;">ج.م</span></div>` : ''}
                    <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 3px;">(${ws.items} صنف نشط)</div>
                </div>
            `;
        });
        summaryContainer.innerHTML = cardsHTML;
    }
}

function printWarehouseReport() {
    const shopName = document.getElementById('shopName')?.value || 'متجر بيان';
    const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
    const canViewCost = (typeof hasPermission === 'function') ? hasPermission('docs_purchase_price') : true;

    const rawSettings = JSON.parse(getStore('wrColSettings') || '{"col-wr-cost":true,"col-wr-total-val":true,"col-wr-profit-wh":true,"col-wr-profit-rt":true}');
    const settings = { ...rawSettings };
    if (!canViewCost) {
        settings['col-wr-cost'] = false;
        settings['col-wr-total-val'] = false;
    }
    if (!canViewProfits) {
        settings['col-wr-profit-wh'] = false;
        settings['col-wr-profit-rt'] = false;
    }

    const sDate = (window.wrFilterState && window.wrFilterState.startDate) ? window.wrFilterState.startDate : null;
    const eDate = (window.wrFilterState && window.wrFilterState.endDate) ? window.wrFilterState.endDate : null;

    const cleanAr = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[\u064B-\u065F]/g, '')
            .trim()
            .toLowerCase();
    };

    const searchRaw = document.getElementById('wrSearchInput')?.value.trim() || '';
    const searchClean = cleanAr(searchRaw);

    const filtered = productsDB.filter(p => {
        if (!p) return false;
        if (!searchClean) return true;
        if (cleanAr(p.name).includes(searchClean)) return true;
        if (p.barcode && String(p.barcode).includes(searchRaw)) return true;
        if (p.code && String(p.code).toLowerCase().includes(searchClean)) return true;
        if (p.variants && Array.isArray(p.variants)) {
            return p.variants.some(v => 
                (v.barcode && String(v.barcode).includes(searchRaw)) ||
                (v.size && cleanAr(v.size).includes(searchClean)) ||
                (v.color && cleanAr(v.color).includes(searchClean))
            );
        }
        return false;
    });

    if (filtered.length === 0) return alert("لا توجد بيانات للطباعة وفقاً للبحث الحالي");

    const headers = ["#", "كود الصنف", "اسم الصنف"];
    if (settings['col-wr-cost'] !== false) headers.push("التكلفة");

    const visibleWhs = [];
    if (typeof warehouses !== 'undefined') {
        warehouses.forEach(w => {
            const colClass = getSafeWhClass(w.name);
            if (settings[colClass] !== false) {
                headers.push("كمية " + w.name);
                visibleWhs.push(w);
            }
        });
    }

    headers.push("إجمالي الكمية");
    if (settings['col-wr-total-val'] !== false) headers.push("إجمالي القيمة");
    if (settings['col-wr-profit-wh'] !== false) headers.push("ربح الجملة");
    if (settings['col-wr-profit-rt'] !== false) headers.push("ربح التجزئة");

    let printGlobalQty = 0;
    let printGlobalVal = 0;
    let printGlobalProfitWH = 0;
    let printGlobalProfitRT = 0;
    const whTotals = visibleWhs.map(() => 0);

    let rowsHtml = '';
    filtered.forEach((p, idx) => {
        const cost = parseFloat(p.cost) || 0;
        const retailPrice = parseFloat(p.price) || 0;
        const wholesalePrice = parseFloat(p.wholesale) || 0;
        let rowQty = 0;
        let whTds = '';

        if (typeof warehouses !== 'undefined') {
            warehouses.forEach(w => {
                const st = getWarehouseStock(p.name, w.name, sDate, eDate);
                rowQty += st;
                const colClass = getSafeWhClass(w.name);
                if (settings[colClass] !== false) {
                    const wIdx = visibleWhs.indexOf(w);
                    if (wIdx !== -1) whTotals[wIdx] += st;
                    whTds += `<td>${st}</td>`;
                }
            });
        }

        const rowVal = rowQty * cost;
        const rowProfitWH = (wholesalePrice > 0) ? rowQty * (wholesalePrice - cost) : 0;
        const rowProfitRT = (retailPrice > 0) ? rowQty * (retailPrice - cost) : 0;

        printGlobalQty += rowQty;
        printGlobalVal += rowVal;
        printGlobalProfitWH += rowProfitWH;
        printGlobalProfitRT += rowProfitRT;

        const varNote = (p.variants && p.variants.length > 0)
            ? `<div style="font-size:9px; color:#64748b; font-weight:normal; margin-top:2px;">👗 (${p.variants.length} مقاس/لون)</div>`
            : '';

        rowsHtml += `<tr>
            <td>${idx + 1}</td>
            <td>${p.code || p.id}</td>
            <td style="text-align:right; font-weight:bold;">
                ${p.name}
                ${varNote}
            </td>
            ${settings['col-wr-cost'] !== false ? `<td>${cost.toFixed(2)}</td>` : ''}
            ${whTds}
            <td style="font-weight:bold;">${rowQty}</td>
            ${settings['col-wr-total-val'] !== false ? `<td>${rowVal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>` : ''}
            ${settings['col-wr-profit-wh'] !== false ? `<td>${rowProfitWH.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>` : ''}
            ${settings['col-wr-profit-rt'] !== false ? `<td>${rowProfitRT.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>` : ''}
        </tr>`;
    });

    let footerTds = '';
    visibleWhs.forEach((w, wIdx) => {
        footerTds += `<td>${whTotals[wIdx].toLocaleString()}</td>`;
    });

    const footerHtml = `
        <tr style="background:#eee; font-weight:900;">
            <td colspan="${settings['col-wr-cost'] !== false ? 4 : 3}">الإجمالي العام</td>
            ${footerTds}
            <td>${printGlobalQty.toLocaleString()}</td>
            ${settings['col-wr-total-val'] !== false ? `<td>${printGlobalVal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} ج.م</td>` : ''}
            ${settings['col-wr-profit-wh'] !== false ? `<td>${printGlobalProfitWH.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} ج.م</td>` : ''}
            ${settings['col-wr-profit-rt'] !== false ? `<td>${printGlobalProfitRT.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} ج.م</td>` : ''}
        </tr>
    `;

    const summaryCards = document.querySelectorAll('#wrSummaryCards > div');
    let summaryHtml = '<div style="margin-bottom:15px; border:1px solid #000; padding:10px; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">';
    summaryCards.forEach(card => {
        const title = card.querySelector('div:first-child')?.innerText.replace(/📊|💵|💎|🏬|⚙️/g, '').trim() || '';
        const val = card.querySelector('div:nth-child(2)')?.innerText || '0';
        summaryHtml += `<div style="border:1px solid #ddd; padding:6px 10px; border-radius:4px; font-size:12px;">
            <div style="font-weight:bold; color:#444;">${title}</div>
            <div style="font-size:14px; font-weight:900; margin-top:2px;">${val}</div>
        </div>`;
    });
    summaryHtml += '</div>';

    let dateText = '';
    if (sDate && eDate) dateText = `عن الفترة من ${sDate} إلى ${eDate}`;
    else if (eDate) dateText = `حتى تاريخ ${eDate}`;
    else dateText = `الرصيد الفعلي الحالي بتاريخ: ${new Date().toLocaleString('ar-EG')}`;

    const content = `
        <div style="direction:rtl; font-family:'Arial', sans-serif; padding:15px; color:#000; width:100%; box-sizing:border-box;">
            <div style="text-align:center; border-bottom:3px solid #000; padding-bottom:15px; margin-bottom:20px;">
                <h1 style="margin:0; font-size:22px; font-weight:900;">${shopName}</h1>
                <h2 style="margin:10px 0; font-size:18px; font-weight:bold; border:2px solid #000; display:inline-block; padding:5px 20px; border-radius:8px;">تقرير أرصدة المخازن التفصيلي</h2>
                <div style="font-size:12px; margin-top:5px; font-weight:bold;">${dateText}</div>
                <div style="font-size:11px; color:#555; margin-top:3px;">عدد الأصناف المشمولة: ${filtered.length} صنف</div>
            </div>

            ${summaryHtml}

            <table style="width:100%; border-collapse:collapse; font-size:11px; border:2px solid #000; table-layout: auto;">
                <thead>
                    <tr style="background: #f1f5f9; -webkit-print-color-adjust: exact;">
                        ${headers.map(h => `<th style="padding:8px; border:1px solid #000; text-align:center;">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody style="text-align:center;">${rowsHtml}</tbody>
                <tfoot>${footerHtml}</tfoot>
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

    const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
    const canViewCost = (typeof hasPermission === 'function') ? hasPermission('docs_purchase_price') : true;

    const sDate = (window.wrFilterState && window.wrFilterState.startDate) ? window.wrFilterState.startDate : null;
    const eDate = (window.wrFilterState && window.wrFilterState.endDate) ? window.wrFilterState.endDate : null;

    const table = [];
    const headerRow = ["#", "كود الصنف", "اسم الصنف"];
    if (canViewCost) headerRow.push("تكلفة الوحدة");
    if (typeof warehouses !== 'undefined') {
        warehouses.forEach(w => headerRow.push("كمية " + w.name));
    }
    headerRow.push("إجمالي الكمية");
    if (canViewCost) headerRow.push("إجمالي القيمة التقديرية");
    if (canViewProfits) headerRow.push("ربح الجملة", "ربح التجزئة");
    table.push(headerRow);

    const cleanAr = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[\u064B-\u065F]/g, '')
            .trim()
            .toLowerCase();
    };

    const searchRaw = document.getElementById('wrSearchInput')?.value.trim() || '';
    const searchClean = cleanAr(searchRaw);

    const filtered = productsDB.filter(p => {
        if (!p) return false;
        if (!searchClean) return true;
        if (cleanAr(p.name).includes(searchClean)) return true;
        if (p.barcode && String(p.barcode).includes(searchRaw)) return true;
        if (p.code && String(p.code).toLowerCase().includes(searchClean)) return true;
        if (p.variants && Array.isArray(p.variants)) {
            return p.variants.some(v => 
                (v.barcode && String(v.barcode).includes(searchRaw)) ||
                (v.size && cleanAr(v.size).includes(searchClean)) ||
                (v.color && cleanAr(v.color).includes(searchClean))
            );
        }
        return false;
    });

    let totalGlobalQty = 0;
    let totalGlobalVal = 0;
    let totalGlobalProfitWH = 0;
    let totalGlobalProfitRT = 0;
    const whTotals = (typeof warehouses !== 'undefined') ? warehouses.map(() => 0) : [];

    filtered.forEach((p, idx) => {
        const cost = parseFloat(p.cost) || 0;
        const retailPrice = parseFloat(p.price) || 0;
        const wholesalePrice = parseFloat(p.wholesale) || 0;

        const row = [idx + 1, p.code || p.id, p.name];
        if (canViewCost) row.push(cost);
        let rowQty = 0;
        if (typeof warehouses !== 'undefined') {
            warehouses.forEach((w, wIdx) => {
                const st = getWarehouseStock(p.name, w.name, sDate, eDate);
                row.push(st);
                rowQty += st;
                whTotals[wIdx] += st;
            });
        }
        const rowVal = rowQty * cost;
        const rowProfitWH = (wholesalePrice > 0) ? rowQty * (wholesalePrice - cost) : 0;
        const rowProfitRT = (retailPrice > 0) ? rowQty * (retailPrice - cost) : 0;

        totalGlobalQty += rowQty;
        totalGlobalVal += rowVal;
        totalGlobalProfitWH += rowProfitWH;
        totalGlobalProfitRT += rowProfitRT;

        row.push(rowQty);
        if (canViewCost) row.push(rowVal);
        if (canViewProfits) {
            row.push(rowProfitWH, rowProfitRT);
        }
        table.push(row);
    });

    // سطر الإجمالي العام في ملف الإكسيل
    const totalRow = ["الإجمالي العام", "", ""];
    if (canViewCost) totalRow.push("");
    whTotals.forEach(wt => totalRow.push(wt));
    totalRow.push(totalGlobalQty);
    if (canViewCost) totalRow.push(totalGlobalVal);
    if (canViewProfits) {
        totalRow.push(totalGlobalProfitWH, totalGlobalProfitRT);
    }
    table.push(totalRow);

    const dateSuffix = eDate ? `_${eDate}` : `_${new Date().toLocaleDateString('ar-EG')}`;

    if (XLSXLib && XLSXLib.utils) {
        try {
            const ws = XLSXLib.utils.aoa_to_sheet(table);
            const wb = XLSXLib.utils.book_new();
            XLSXLib.utils.book_append_sheet(wb, ws, "أرصدة المخازن");
            XLSXLib.writeFile(wb, `تقرير_أرصدة_المخازن${dateSuffix}.xlsx`);
            if (typeof showToast === 'function') showToast("✅ تم تصدير التقرير بنجاح", "success");
            return;
        } catch (e) { console.warn("Excel XLSX fallback activated:", e); }
    }

    if (typeof downloadAOAAsExcelCSV === 'function') {
        downloadAOAAsExcelCSV(table, `تقرير_أرصدة_المخازن${dateSuffix}`);
    } else if (typeof window.downloadAOAAsExcelCSV === 'function') {
        window.downloadAOAAsExcelCSV(table, `تقرير_أرصدة_المخازن${dateSuffix}`);
    }
}
window.exportWarehouseReportToExcel = exportWarehouseReportToExcel;

function downloadProductTemplate() {
    const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : null));

    const data = [
        ["كود الصنف", "كود داخلي", "اسم الصنف (الموديل)", "المقاس", "اللون", "باركود المقاس/القطعة", "سعر البيع", "سعر الجملة", "سعر الشراء", "الكمية", "الوحدة", "المكان/الرف", "الفئة/القسم", "حد الطلب"]
    ];

    if (productsDB.length > 0) {
        productsDB.forEach(p => {
            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                p.variants.forEach(v => {
                    data.push([
                        p.sysCode || p.id || "",
                        p.code || "",
                        p.name || "",
                        v.size || "",
                        v.color || "",
                        v.barcode || p.barcode || "",
                        v.price !== undefined ? v.price : (p.price || 0),
                        v.wholesale !== undefined ? v.wholesale : (p.wholesale || 0),
                        v.cost !== undefined ? v.cost : (p.cost || 0),
                        v.stock !== undefined ? v.stock : 0,
                        p.unit || "قطعة",
                        p.shelf || "",
                        p.category || "عام",
                        p.minStock || 0
                    ]);
                });
            } else {
                data.push([
                    p.sysCode || p.id || "",
                    p.code || "",
                    p.name || "",
                    "",
                    "",
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
            }
        });
    } else {
        data.push(["تلقائي", "MOD-101", "قميص كاجوال رجالي", "M", "أبيض", "20260101", "350", "280", "200", "15", "قطعة", "رف أ1", "ملابس رجالي", "5"]);
        data.push(["تلقائي", "MOD-101", "قميص كاجوال رجالي", "L", "أبيض", "20260102", "350", "280", "200", "20", "قطعة", "رف أ1", "ملابس رجالي", "5"]);
        data.push(["تلقائي", "MOD-101", "قميص كاجوال رجالي", "XL", "أسود", "20260103", "350", "280", "200", "10", "قطعة", "رف أ1", "ملابس رجالي", "5"]);
        data.push(["تلقائي", "MOD-102", "بنطلون جينز كلاسيك", "32", "أزرق", "20260201", "450", "380", "300", "25", "قطعة", "رف ب2", "ملابس رجالي", "5"]);
    }

    if (XLSXLib && XLSXLib.utils) {
        const ws = XLSXLib.utils.aoa_to_sheet(data);
        const wb = XLSXLib.utils.book_new();
        XLSXLib.utils.book_append_sheet(wb, ws, "المنتجات_والأزياء");
        ws['!cols'] = [
            { wch: 14 }, // كود الصنف
            { wch: 14 }, // كود داخلي
            { wch: 28 }, // اسم الصنف
            { wch: 10 }, // المقاس
            { wch: 12 }, // اللون
            { wch: 20 }, // باركود القطعة
            { wch: 11 }, // سعر البيع
            { wch: 11 }, // سعر الجملة
            { wch: 11 }, // سعر الشراء
            { wch: 10 }, // الكمية
            { wch: 10 }, // الوحدة
            { wch: 12 }, // المكان
            { wch: 15 }, // الفئة
            { wch: 10 }  // حد الطلب
        ];
        XLSXLib.writeFile(wb, "نموذج_أصناف_ومقاسات_بيان_فاشون.xlsx");
        if (typeof showToast === 'function') showToast("✅ تم استخراج نموذج فاشون بنجاح", "success");
    } else if (typeof downloadAOAAsExcelCSV === 'function') {
        downloadAOAAsExcelCSV(data, "نموذج_أصناف_ومقاسات_بيان_فاشون");
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
                const nameKeys = ['اسم الصنف', 'اسم الصنف (الموديل)', 'الموديل', 'اسم', 'item name', 'name'];
                let idx = headers.findIndex(h => nameKeys.some(k => h === k.toLowerCase()));
                if (idx !== -1) return idx;
                return headers.findIndex(h => !h.includes('كود') && !h.includes('code') && ['اسم', 'item', 'name', 'صنف', 'موديل'].some(k => h.includes(k)));
            })();
            const sizeIdx = findCol(['المقاس', 'مقاس', 'size']);
            const colorIdx = findCol(['اللون', 'لون', 'color']);
            const barIdx = findCol(['باركود المقاس/القطعة', 'باركود', 'باربود', 'barcode']);
            const priceIdx = findCol(['سعر البيع', 'بيع', 'retail', 'price']);
            const wholesaleIdx = findCol(['سعر الجملة', 'جملة', 'wholesale']);
            const costIdx = findCol(['سعر الشراء', 'تكلفة', 'شراء', 'cost']);
            const qtyIdx = findCol(['الكمية الحالية', 'الكمية', 'كمية', 'رصيد', 'stock', 'qty']);
            const unitIdx = findCol(['الوحدة', 'وحدة', 'unit']);
            const shelfIdx = findCol(['المكان/الرف', 'مكان', 'رف', 'shelf']);
            const catIdx = findCol(['الفئة/القسم', 'فئة', 'تصنيف', 'قسم', 'category']);
            const minStockIdx = findCol(['حد الطلب', 'min']);

            if (nameIdx === -1) throw new Error("لم نتمكن من العثور على عمود 'اسم الصنف' في الملف!");

            const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName)
                ? currentUser.warehouseName
                : 'المخزن الرئيسي';

            const rows = jsonData.slice(1);
            let added = 0;
            let updated = 0;
            let skippedEmpty = 0;
            let variantsProcessed = 0;
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
                    const rawBarcode = barIdx !== -1 ? String(row[barIdx] || "").trim() : "";
                    const vSize = sizeIdx !== -1 ? String(row[sizeIdx] || "").trim() : "";
                    const vColor = colorIdx !== -1 ? String(row[colorIdx] || "").trim() : "";
                    const price = parseFloat(row[priceIdx]) || 0;
                    const wholesale = wholesaleIdx !== -1 ? (parseFloat(row[wholesaleIdx]) || price) : price;
                    const cost = parseFloat(row[costIdx]) || 0;
                    const rowStock = parseFloat(row[qtyIdx]) || 0;
                    const unit = unitIdx !== -1 ? String(row[unitIdx] || "قطعة").trim() : "قطعة";
                    const shelf = shelfIdx !== -1 ? String(row[shelfIdx] || "").trim() : "";
                    const category = catIdx !== -1 ? String(row[catIdx] || "عام").trim() : "عام";
                    const minStock = minStockIdx !== -1 ? (parseFloat(row[minStockIdx]) || 0) : 0;

                    let existing = productsDB.find(p => 
                        (sysCode && sysCode !== "تلقائي" && (p.sysCode === sysCode || String(p.id) === sysCode)) ||
                        (name.toLowerCase() === p.name.toLowerCase())
                    );

                    let targetProduct = existing;
                    let isNewProduct = false;

                    if (!targetProduct) {
                        const newId = Date.now() + i;
                        targetProduct = {
                            id: newId,
                            sysCode: (sysCode && sysCode !== "تلقائي") ? sysCode : String(newId),
                            code: intCode,
                            name,
                            barcode: rawBarcode,
                            price, wholesale, cost,
                            stock: 0,
                            unit, shelf, category, minStock,
                            variants: [],
                            warehouseStocks: { [activeWH]: 0 },
                            units: [{ unitName: unit, factor: 1, cost, price, wholesale, isDefaultSale: true, isDefaultPurchase: true }]
                        };
                        productsDB.push(targetProduct);
                        isNewProduct = true;
                        added++;
                    } else {
                        if (intCode) targetProduct.code = intCode;
                        if (price) targetProduct.price = price;
                        if (wholesale) targetProduct.wholesale = wholesale;
                        if (cost) targetProduct.cost = cost;
                        if (unit) targetProduct.unit = unit;
                        if (shelf) targetProduct.shelf = shelf;
                        if (category) targetProduct.category = category;
                        if (minStock) targetProduct.minStock = minStock;
                        if (!isNewProduct) updated++;
                    }

                    // معالجة مصفوفة المقاسات والألوان (Fashion Variants Matrix)
                    if (vSize || vColor || (rawBarcode && (sizeIdx !== -1 || colorIdx !== -1))) {
                        if (!targetProduct.variants || !Array.isArray(targetProduct.variants)) {
                            targetProduct.variants = [];
                        }

                        let effVarBarcode = rawBarcode;
                        if (!effVarBarcode) {
                            if (typeof generateVariantBarcode === 'function') {
                                effVarBarcode = generateVariantBarcode(vSize, vColor, targetProduct.variants.length + 1);
                            } else {
                                effVarBarcode = `20${String(Date.now()).slice(-6)}${targetProduct.variants.length + 1}`;
                            }
                        }

                        let matchedVar = targetProduct.variants.find(v => 
                            (effVarBarcode && v.barcode === effVarBarcode) ||
                            (v.size === vSize && v.color === vColor)
                        );

                        if (matchedVar) {
                            matchedVar.size = vSize || matchedVar.size;
                            matchedVar.color = vColor || matchedVar.color;
                            matchedVar.barcode = effVarBarcode;
                            matchedVar.price = price || matchedVar.price || targetProduct.price;
                            matchedVar.wholesale = wholesale || matchedVar.wholesale || targetProduct.wholesale;
                            matchedVar.cost = cost || matchedVar.cost || targetProduct.cost;
                            
                            if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                            matchedVar.warehouseStocks[activeWH] = rowStock;
                            matchedVar.stock = Object.values(matchedVar.warehouseStocks).reduce((s, q) => s + (parseFloat(q) || 0), 0);
                        } else {
                            targetProduct.variants.push({
                                size: vSize,
                                color: vColor,
                                barcode: effVarBarcode,
                                price: price || targetProduct.price,
                                wholesale: wholesale || targetProduct.wholesale,
                                cost: cost || targetProduct.cost,
                                stock: rowStock,
                                warehouseStocks: { [activeWH]: rowStock }
                            });
                        }
                        variantsProcessed++;

                        // إعادة حساب إجمالي رصيد الصنف من كافة التشكيلات
                        const totalVarStock = targetProduct.variants.reduce((s, v) => s + (parseFloat(v.stock) || 0), 0);
                        targetProduct.stock = totalVarStock;
                        if (!targetProduct.warehouseStocks) targetProduct.warehouseStocks = {};
                        targetProduct.warehouseStocks[activeWH] = targetProduct.variants.reduce((s, v) => s + (parseFloat(v.warehouseStocks?.[activeWH]) || 0), 0);
                    } else {
                        // صنف بدون مقاسات أو ألوان
                        if (rawBarcode && rawBarcode !== "-") targetProduct.barcode = rawBarcode;
                        targetProduct.stock = rowStock;
                        if (!targetProduct.warehouseStocks) targetProduct.warehouseStocks = {};
                        targetProduct.warehouseStocks[activeWH] = rowStock;
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
            if (typeof invalidateStockCache === 'function') invalidateStockCache();

            renderInventoryTable();
            if (typeof updateDatalists === 'function') updateDatalists();
            if (typeof renderProductsGrid === 'function') renderProductsGrid();

            let summaryMsg = `✅ اكتملت عملية استيراد الإكسيل بنجاح:\n`;
            summaryMsg += `🔹 إجمالي الأسطر المقروءة: ${totalScanned}\n`;
            summaryMsg += `🔹 أصناف جديدة أضيفت: ${added}\n`;
            summaryMsg += `🔹 أصناف تم تحديثها: ${updated}\n`;
            if (variantsProcessed > 0) summaryMsg += `🔹 تشكيلات (مقاسات وألوان) تم تجميعها: ${variantsProcessed}\n`;
            if (skippedEmpty > 0) summaryMsg += `🔹 أسطر فارغة تم تجاهلها: ${skippedEmpty}\n`;
            summaryMsg += `\n🏢 تم إسناد الأرصدة إلى: [${activeWH}]`;

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

    const btns = ['invEditBtn', 'invDeleteBtn'];
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
let _stockHistoryCache = null;
let _stockHistoryCacheKey = null;

function invalidateStockCache() {
    _stockCache = null;
    _stockCacheKey = null;
    _stockHistoryCache = null;
    _stockHistoryCacheKey = null;
}
window.invalidateStockCache = invalidateStockCache;

function getLiveProductWhStock(p, targetWH) {
    if (!p) return 0;
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

function getWarehouseStock(productName, warehouseName, startDate = null, endDate = null) {
    if (!productName) return 0;
    const targetWH = (warehouseName || (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || 'المخزن الرئيسي').trim();

    const p = productsDB.find(prod => prod && (prod.name === productName || prod.name?.trim() === productName.trim()));
    if (!p) return 0;

    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // إذا لم يكن هناك تاريخ نهاية أو كان تاريخ النهاية هو اليوم أو في المستقبل، نرجع الرصيد الفعلي الحي
    if (!endDate || endDate >= todayISO) {
        return getLiveProductWhStock(p, targetWH);
    }

    // إذا كان تاريخ النهاية في الماضي، نحسب الرصيد التاريخي بأثر رجعي من الرصيد الحالي بطرح الحركات التي حدثت بعد تاريخ النهاية
    const cacheKey = `${endDate}_${transactions.length}_${productsDB.length}`;
    if (!_stockHistoryCache || _stockHistoryCacheKey !== cacheKey) {
        _stockHistoryCache = {};
        _stockHistoryCacheKey = cacheKey;

        const prodIndex = {};
        productsDB.forEach(prod => {
            if (prod && prod.name) {
                const n = prod.name.trim();
                prodIndex[n] = prod;
                prodIndex[n.toLowerCase()] = prod;
                _stockHistoryCache[n] = {};
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

            // الحركات التي تمت بعد تاريخ النهاية فقط هي التي غيرت الرصيد من ذلك التاريخ إلى رصيد اليوم
            if (tDateISO <= endDate) continue;

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

            if (!_stockHistoryCache[pName]) _stockHistoryCache[pName] = {};
            if (!_stockHistoryCache[pName][tWH]) _stockHistoryCache[pName][tWH] = 0;
            _stockHistoryCache[pName][tWH] += change;

            if (type.includes('تحويل') && t.transferStatus === 'received') {
                const parts = (t.partner || '').split(' -> ');
                if (parts.length === 2) {
                    const wTo = parts[1].trim();
                    const wFrom = parts[0].trim();
                    if (!_stockHistoryCache[pName][wTo]) _stockHistoryCache[pName][wTo] = 0;
                    _stockHistoryCache[pName][wTo] += qty;
                    if (!_stockHistoryCache[pName][wFrom]) _stockHistoryCache[pName][wFrom] = 0;
                    _stockHistoryCache[pName][wFrom] -= qty;
                }
            }
        }
    }

    const currentLive = getLiveProductWhStock(p, targetWH);
    const postEndDateChange = (_stockHistoryCache[(p.name || '').trim()] && _stockHistoryCache[(p.name || '').trim()][targetWH]) || 0;
    return currentLive - postEndDateChange;
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
