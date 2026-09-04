// ============================================================
//  تسوية المخزون وتعديل الأسعار الجماعي (Stock & Price Adjustments)
// ============================================================
function goToAdjustmentWithSelected() {
    if (window.selectedInventoryIds.size > 0) {
        const id = Array.from(window.selectedInventoryIds)[0];
        const p = productsDB.find(x => x.id === id);
        if (p) {
            if (typeof switchSection === 'function') switchSection('adjustment');
            setTimeout(() => {
                const adjSearchInput = document.getElementById('adjSearch');
                if (adjSearchInput) {
                    adjSearchInput.value = p.name;
                }
                
                if (p.units && p.units.length > 1) {
                    if (typeof showUnitSelectionModal === 'function') {
                        showUnitSelectionModal(p, 'adjustment');
                    }
                } else {
                    const defUnit = (p.units && p.units.length > 0) ? p.units[0] : null;
                    if (typeof fillAdjustmentHeaderWithUnit === 'function') {
                        fillAdjustmentHeaderWithUnit(p, defUnit || { unitName: p.unit || 'قطعة', factor: 1, cost: p.cost });
                    }
                }
            }, 150);
            return;
        }
    }
    if (typeof switchSection === 'function') switchSection('adjustment');
}

function goToHistoryWithSelected() {
    if (window.selectedInventoryIds.size > 0) {
        const id = Array.from(window.selectedInventoryIds)[0];
        const p = productsDB.find(x => x.id === id);
        if (p) {
            if (typeof switchSection === 'function') switchSection('history');
            setTimeout(() => {
                const input = document.getElementById('historySearch');
                if (input) {
                    input.value = p.name;
                    if (typeof renderHistoryTable === 'function') {
                        renderHistoryTable(p.name);
                    }
                }
            }, 150);
            return;
        }
    }
    if (typeof switchSection === 'function') switchSection('history');
}

// منطق تسوية المخزن (Adjustment Logic)
window.adjCart = window.adjCart || [];
window.selectedAdjItem = window.selectedAdjItem || null;

function resetAdjustment() {
    window.adjCart = [];
    window.selectedAdjItem = null;
    currentAdjHeaderUnit = null;

    if (typeof isEditMode !== 'undefined') isEditMode = false;
    if (typeof window.isEditMode !== 'undefined') window.isEditMode = false;
    if (typeof editingInvoiceId !== 'undefined') editingInvoiceId = null;
    if (typeof window.editingInvoiceId !== 'undefined') window.editingInvoiceId = null;
    if (typeof editingInvoiceType !== 'undefined') editingInvoiceType = null;
    if (typeof window.editingInvoiceType !== 'undefined') window.editingInvoiceType = null;
    if (typeof editingOriginalItems !== 'undefined') editingOriginalItems = [];
    if (typeof window.editingOriginalItems !== 'undefined') window.editingOriginalItems = [];

    const saveBtn = document.querySelector('#adjustment-section .btn-save') || document.querySelector('#adjustment-section .acc-action-btn[onclick*="save"]');
    if (saveBtn) {
        saveBtn.style.background = 'linear-gradient(135deg, #16a34a, #15803d)';
        saveBtn.innerText = '💾';
    }

    if (document.getElementById('adjSearch')) document.getElementById('adjSearch').value = '';
    if (document.getElementById('adjQty')) document.getElementById('adjQty').value = '1';
    if (document.getElementById('adjPrice')) document.getElementById('adjPrice').value = '';
    if (document.getElementById('adjNotes')) document.getElementById('adjNotes').value = '';
    if (document.getElementById('adjBadgeID') && typeof getNextSequence === 'function') document.getElementById('adjBadgeID').innerText = getNextSequence('تسوية');

    renderAdjTable();

    const now = new Date();
    if (document.getElementById('adjDate')) document.getElementById('adjDate').value = now.toLocaleDateString('en-CA');
    if (document.getElementById('adjTime')) document.getElementById('adjTime').value = now.toTimeString().slice(0, 5);

    document.getElementById('adjSearch')?.focus();
}

let currentAdjHeaderUnit = null;

function fillAdjustmentHeaderWithUnit(product, unit) {
    window.selectedAdjItem = product;
    currentAdjHeaderUnit = unit;

    if (document.getElementById('adjSearch')) document.getElementById('adjSearch').value = product.name;

    const lastPurchasePrice = typeof getProductLastPurchasePrice === 'function' ? getProductLastPurchasePrice(product.name, product.cost) : (parseFloat(product.cost) || 0);
    const factor = parseFloat(unit.factor) || 1;
    const calculatedPrice = lastPurchasePrice * factor;
    if (document.getElementById('adjPrice')) document.getElementById('adjPrice').value = calculatedPrice.toFixed(2);

    const displayStock = (parseFloat(product.stock) || 0) / factor;
    document.querySelectorAll('.adj-current-stock-val').forEach(el => {
        el.innerText = `${displayStock.toFixed(2)} ${unit.unitName}`;
    });

    document.getElementById('adjQty')?.focus();
    document.getElementById('adjQty')?.select();
}

function handleAdjSearchEnter(query, event) {
    if (!query || query.trim() === "") return;

    // إذا كان مسح باركود تم بواسطة السكانر المركزي للتو، نتجاهل ضغطة Enter الزائدة
    if (typeof window.isBayanRecentScan === 'function' && window.isBayanRecentScan()) {
        const aInp = document.getElementById('adjSearch');
        if (aInp) aInp.value = '';
        const rDiv = document.getElementById('adjSearchResults');
        if (rDiv) rDiv.style.display = 'none';
        return;
    }

    const cleanQuery = String(query).trim();

    // فحص الباركود الدقيق التلقائي فوراً
    if (typeof window.dispatchSearchBarcode === 'function') {
        if (window.dispatchSearchBarcode(cleanQuery, 'adj')) return;
    }

    let pMatch = null;
    let matchingVariant = null;

    if (typeof window !== 'undefined' && window.selectedAdjItem && String(window.selectedAdjItem.name).trim() === cleanQuery) {
        pMatch = window.selectedAdjItem;
    } else {
        // 1. بحث فوري في باركود التشكيلات (Variant Barcode Match)
        pMatch = productsDB.find(p => {
            if (p.variants && Array.isArray(p.variants)) {
                const vFound = p.variants.find(v => v.barcode && String(v.barcode).trim() === cleanQuery);
                if (vFound) {
                    matchingVariant = vFound;
                    return true;
                }
            }
            return false;
        });
    }
    const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();

    if (pMatch && matchingVariant) {
        if (!window.adjCart) window.adjCart = [];
        const vSize = matchingVariant.size || '';
        const vColor = matchingVariant.color || '';
        const existing = window.adjCart.find(it => it.id === pMatch.id && ((it.size || it.selectedSize || '') === vSize) && ((it.color || it.selectedColor || '') === vColor));
        if (existing) {
            existing.qty = (parseFloat(existing.qty) || 0) + 1;
        } else {
            let liveStock = 0;
            if (matchingVariant.warehouseStocks && typeof matchingVariant.warehouseStocks === 'object' && matchingVariant.warehouseStocks[activeWH] !== undefined) {
                liveStock = parseFloat(matchingVariant.warehouseStocks[activeWH]) || 0;
            } else if (activeWH === 'المخزن الرئيسي' || !matchingVariant.warehouseStocks) {
                liveStock = parseFloat(matchingVariant.stock) || 0;
            }
            window.adjCart.push({
                ...pMatch,
                id: pMatch.id,
                name: pMatch.name,
                code: matchingVariant.barcode || pMatch.code || pMatch.id,
                selectedSize: vSize,
                selectedColor: vColor,
                size: vSize,
                color: vColor,
                stock: liveStock,
                qty: 1,
                price: parseFloat(matchingVariant.cost) || parseFloat(pMatch.cost) || 0,
                notes: '',
                unitFactor: 1,
                selectedUnit: null
            });
        }
        renderAdjTable();
        const resultsDiv = document.getElementById('adjSearchResults');
        if (resultsDiv) resultsDiv.style.display = 'none';
        const sEl = document.getElementById('adjSearch');
        if (sEl) sEl.value = '';
        if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
        if (typeof showToast === 'function') showToast(`✅ [جرد وتسويه] +1 ${pMatch.name} (مقاس: ${vSize} - لون: ${vColor})`, 'success');
        return;
    }

    // 2. بحث بالباركود الأساسي أو الكود
    if (!pMatch) {
        pMatch = productsDB.find(p => String(p.barcode || '').trim() === cleanQuery || String(p.code || '').trim() === cleanQuery);
    }

    // 3. بحث بوحدات الصنف
    if (!pMatch) {
        pMatch = productsDB.find(p => p.units && p.units.some(u => String(u.unitBarcode || '').trim() === cleanQuery));
    }

    // 4. بحث بالاسم
    if (!pMatch) {
        const queryLower = cleanQuery.toLowerCase();
        const matches = productsDB.filter(p => p.name && p.name.toLowerCase().includes(queryLower));
        
        if (matches.length === 1) {
            pMatch = matches[0];
        } else if (matches.length > 1) {
            return;
        }
    }

    if (pMatch) {
        if (pMatch.variants && Array.isArray(pMatch.variants) && pMatch.variants.length > 0) {
            const resultsDiv = document.getElementById('adjSearchResults');
            if (resultsDiv) resultsDiv.style.display = 'none';
            if (typeof showVariantSelectionModal === 'function') {
                showVariantSelectionModal(pMatch, 'adj');
                return;
            }
        } else {
            // صنف عام بدون تشكيلات ينزل مباشرة في الجرد بالسكانر
            if (!window.adjCart) window.adjCart = [];
            const existing = window.adjCart.find(it => it.id === pMatch.id && !it.selectedSize && !it.selectedColor);
            if (existing) {
                existing.qty = (parseFloat(existing.qty) || 0) + 1;
            } else {
                let liveStock = 0;
                if (pMatch.warehouseStocks && typeof pMatch.warehouseStocks === 'object' && pMatch.warehouseStocks[activeWH] !== undefined) {
                    liveStock = parseFloat(pMatch.warehouseStocks[activeWH]) || 0;
                } else if (activeWH === 'المخزن الرئيسي' || !pMatch.warehouseStocks) {
                    liveStock = parseFloat(pMatch.stock) || 0;
                }
                const defUnit = (pMatch.units && pMatch.units.length > 0) ? pMatch.units[0] : null;
                window.adjCart.push({
                    ...pMatch,
                    id: pMatch.id,
                    name: pMatch.name,
                    code: pMatch.barcode || pMatch.code || pMatch.id,
                    selectedSize: '',
                    selectedColor: '',
                    size: '',
                    color: '',
                    stock: liveStock,
                    qty: 1,
                    price: parseFloat(pMatch.cost) || 0,
                    notes: '',
                    unitFactor: defUnit ? (defUnit.factor || 1) : 1,
                    selectedUnit: defUnit || null
                });
            }
            renderAdjTable();
            const resultsDiv = document.getElementById('adjSearchResults');
            if (resultsDiv) resultsDiv.style.display = 'none';
            const sEl = document.getElementById('adjSearch');
            if (sEl) sEl.value = '';
            if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
            if (typeof showToast === 'function') showToast(`✅ [جرد وتسويه] +1 ${pMatch.name}`, 'success');
            return;
        }
        fillAdjustmentHeaderWithUnit(pMatch, (pMatch.units && pMatch.units.length > 0) ? pMatch.units[0] : { unitName: pMatch.unit || 'قطعة', factor: 1, cost: pMatch.cost });
        const resultsDiv = document.getElementById('adjSearchResults');
        if (resultsDiv) resultsDiv.style.display = 'none';
    } else {
        if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(false);
        if (typeof showToast === 'function') showToast(`⚠️ باركود غير مسجل: (${cleanQuery})`, 'error');
    }
}
window.handleAdjSearchEnter = handleAdjSearchEnter;

function handleAdjSearch(query) {
    const resultsDiv = document.getElementById('adjSearchResults');
    if (!resultsDiv) return;
    resultsDiv.innerHTML = '';
    
    // منع قص النوافذ المنبثقة الجديدة وإلغاء القيود القديمة للفئة search-results
    resultsDiv.style.setProperty('overflow', 'visible', 'important');
    resultsDiv.style.setProperty('max-height', 'none', 'important');
    resultsDiv.style.setProperty('border', 'none', 'important');
    resultsDiv.style.setProperty('background', 'transparent', 'important');
    resultsDiv.style.setProperty('box-shadow', 'none', 'important');

    if (!query) { resultsDiv.style.display = 'none'; return; }

    const queryLower = query.toLowerCase();
    const filtered = productsDB.filter(p => 
        p.name.toLowerCase().includes(queryLower) || 
        (p.barcode && String(p.barcode).toLowerCase().includes(queryLower)) ||
        (p.code && String(p.code).toLowerCase().includes(queryLower)) ||
        (p.units && p.units.some(u => String(u.unitBarcode).toLowerCase().includes(queryLower)))
    ).slice(0, 10);

    if (filtered.length > 0) {
        resultsDiv.innerHTML = `
            <div class="pos-search-panel" style="width: 100%; max-width: 650px; min-width: 320px; position: absolute; top: 100%; right: 0; z-index: 99999; background: white; border-radius: 14px; box-shadow: 0 15px 35px rgba(0,0,0,0.25); border: 2px solid #a7f3d0; direction: rtl; text-align: right; margin-top: 6px; animation: modalFadeIn 0.2s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #ecfdf5; border-bottom: 1px solid #d1fae5; border-top-left-radius: 14px; border-top-right-radius: 14px;">
                    <span style="font-weight: 800; font-size: 0.88rem; color: #047857;">🔍 نتائج بحث تسوية المخزون (${filtered.length} صنف)</span>
                    <button onclick="document.getElementById('adjSearchResults').style.display='none';" class="pos-search-close-btn" title="إغلاق النافذة">❌</button>
                </div>
                <div style="max-height: 380px; overflow-y: auto; padding: 6px; scrollbar-gutter: stable;">
                    ${filtered.map(p => {
                        const costVal = parseFloat(p.cost) || 0;
                        const priceVal = parseFloat(p.price) || 0;
                        const activeWhName = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
                        const stockVal = typeof getWarehouseStock === 'function' ? getWarehouseStock(p.name, activeWhName) : (parseFloat(p.stock) || 0);
                        return `
                            <div class="pos-search-row adj-search-row" onclick="
                                document.getElementById('adjSearchResults').style.display='none';
                                const pSelected = productsDB.find(x => x.id === ${p.id});
                                if (pSelected && pSelected.variants && pSelected.variants.length > 0) {
                                    showVariantSelectionModal(pSelected, 'adj');
                                } else if (typeof showUnitSelectionModal === 'function' && ${p.units && p.units.length > 1}) {
                                    showUnitSelectionModal(pSelected, 'adjustment');
                                } else {
                                    fillAdjustmentHeaderWithUnit(pSelected, ${JSON.stringify((p.units && p.units.length > 0) ? p.units[0] : { unitName: p.unit || 'قطعة', factor: 1, cost: p.cost }).replace(/"/g, '&quot;')});
                                }" 
                                style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: all 0.15s ease; border-radius: 10px; gap: 8px;">
                                <div style="flex: 1.5; min-width: 180px;">
                                    <div style="font-weight: 900; font-size: 0.98rem; color: #1e293b;">${p.name}</div>
                                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">🏷️ كود: <b style="color:#047857;">${p.code || p.id}</b> | باركود: <b>${p.barcode || '---'}</b></div>
                                </div>
                                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                                    <div style="text-align: center; background: rgba(59, 130, 246, 0.08); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.25);">
                                        <div style="font-size: 0.7rem; color: #1d4ed8; font-weight: 800;">📦 الرصيد (${activeWhName})</div>
                                        <div style="font-weight: 900; font-size: 0.95rem; color: ${stockVal <= 5 ? '#ef4444' : '#1d4ed8'};">${stockVal} <span style="font-size:0.7rem;">${p.unit || 'قطعة'}</span></div>
                                    </div>
                                    <div style="text-align: center; background: rgba(34, 197, 94, 0.08); padding: 5px 14px; border-radius: 8px; border: 1.5px solid rgba(34, 197, 94, 0.25);">
                                        <div style="font-size: 0.7rem; color: #15803d; font-weight: 800;">💰 سعر البيع</div>
                                        <div style="font-weight: 900; font-size: 1rem; color: #166534;">${priceVal.toFixed(2)} ج.م</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.style.display = 'block';
        const div = document.createElement('div');
        div.className = 'result-item';
        div.style.cssText = 'color:var(--main-green); font-weight:bold; justify-content:center; border: 1.5px dashed var(--main-green); background: rgba(16,185,129,0.05); cursor: pointer; padding: 12px;';
        div.innerHTML = `<span>➕ إضافة تفصيلية لصنف جديد: (${query})</span>`;
        div.onclick = () => {
            resultsDiv.style.display = 'none';
            quickAddProduct(query, 'adj');
        };
        resultsDiv.appendChild(div);
    }
}

function addAdjItem() {
    if (!window.selectedAdjItem) return alert("يرجى اختيار صنف أولاً");
    const qty = Math.max(0, parseFloat(document.getElementById('adjQty').value) || 0);
    const price = parseFloat(document.getElementById('adjPrice').value) || window.selectedAdjItem.cost || 0;
    const notes = document.getElementById('adjNotes') ? document.getElementById('adjNotes').value.trim() : '';

    if (!window.adjCart) window.adjCart = [];
    const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();

    const sSize = window.selectedAdjItem.selectedSize || window.selectedAdjItem.size || '';
    const sColor = window.selectedAdjItem.selectedColor || window.selectedAdjItem.color || '';

    const existing = window.adjCart.find(it => 
        it.id === window.selectedAdjItem.id && 
        ((it.size || it.selectedSize || '') === sSize) && 
        ((it.color || it.selectedColor || '') === sColor)
    );

    if (existing) {
        existing.qty = qty;
        existing.price = price;
        if (notes) existing.notes = notes;
    } else {
        let liveStock = 0;
        const p = productsDB.find(x => x.id === window.selectedAdjItem.id);
        if (p) {
            if (p.variants && Array.isArray(p.variants)) {
                const v = p.variants.find(va => (va.size || '') === sSize && (va.color || '') === sColor);
                if (v) {
                    if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[activeWH] !== undefined) {
                        liveStock = parseFloat(v.warehouseStocks[activeWH]) || 0;
                    } else if (activeWH === 'المخزن الرئيسي' || !v.warehouseStocks) {
                        liveStock = parseFloat(v.stock) || 0;
                    }
                }
            }
            if (liveStock === 0 && (!p.variants || p.variants.length === 0)) {
                if (p.warehouseStocks && typeof p.warehouseStocks === 'object' && p.warehouseStocks[activeWH] !== undefined) {
                    liveStock = parseFloat(p.warehouseStocks[activeWH]) || 0;
                } else if (activeWH === 'المخزن الرئيسي' || !p.warehouseStocks) {
                    liveStock = parseFloat(p.stock) || 0;
                }
            }
        }
        window.adjCart.push({ 
            ...window.selectedAdjItem, 
            id: window.selectedAdjItem.id,
            name: window.selectedAdjItem.name,
            code: window.selectedAdjItem.barcode || window.selectedAdjItem.code || window.selectedAdjItem.id,
            selectedSize: sSize,
            selectedColor: sColor,
            size: sSize,
            color: sColor,
            stock: liveStock,
            qty: qty, 
            price: price,
            notes: notes,
            unitFactor: currentAdjHeaderUnit ? parseFloat(currentAdjHeaderUnit.factor) : 1,
            selectedUnit: currentAdjHeaderUnit 
        });
    }
    renderAdjTable();

    document.getElementById('adjSearch').value = '';
    document.getElementById('adjQty').value = '1';
    document.getElementById('adjPrice').value = '';
    if (document.getElementById('adjNotes')) document.getElementById('adjNotes').value = '';
    document.querySelectorAll('.adj-current-stock-val').forEach(el => el.innerText = '0');
    window.selectedAdjItem = null;
    document.getElementById('adjSearch').focus();
}

function renderAdjTable() {
    const tbody = document.getElementById('adjTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!window.adjCart || window.adjCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding: 25px; color: #7f8c8d; font-weight: bold; font-size: 0.95rem;">ابدأ بمسح باركود الصنف بالسكانر أو البحث بالاسم</td></tr>';
        if (document.getElementById('adjItemsCount')) document.getElementById('adjItemsCount').innerText = '0';
        if (document.getElementById('adjTotalQty')) document.getElementById('adjTotalQty').innerText = '0';
        if (document.getElementById('headerAdjTotalQty')) document.getElementById('headerAdjTotalQty').innerText = '0';
        if (document.getElementById('adjShortageQty')) document.getElementById('adjShortageQty').innerText = '0';
        if (document.getElementById('adjShortageVal')) document.getElementById('adjShortageVal').innerText = '0.00';
        if (document.getElementById('adjSurplusQty')) document.getElementById('adjSurplusQty').innerText = '0';
        if (document.getElementById('adjSurplusVal')) document.getElementById('adjSurplusVal').innerText = '0.00';
        if (document.getElementById('adjGrandTotal')) document.getElementById('adjGrandTotal').innerText = '0.00';
        if (document.getElementById('headerAdjGrandTotal')) document.getElementById('headerAdjGrandTotal').innerText = '0.00';
        return;
    }

    let totalCountedQty = 0;
    let totalShortageQty = 0;
    let totalShortageVal = 0;
    let totalSurplusQty = 0;
    let totalSurplusVal = 0;
    let netDiffGrandTotal = 0;

    let rowsHtml = '';
    window.adjCart.forEach((item, idx) => {
        const factor = parseFloat(item.unitFactor) || 1;
        const countedQty = parseFloat(item.qty) || 0;
        const baseCounted = countedQty * factor;
        const stockBefore = parseFloat(item.stock) || 0;
        const diffQty = baseCounted - stockBefore;
        const stockAfter = baseCounted;

        const lineCost = parseFloat(item.price) || 0;
        const diffTotal = diffQty * lineCost;

        totalCountedQty += countedQty;
        if (diffQty < 0) {
            totalShortageQty += Math.abs(diffQty);
            totalShortageVal += Math.abs(diffTotal);
        } else if (diffQty > 0) {
            totalSurplusQty += diffQty;
            totalSurplusVal += diffTotal;
        }
        netDiffGrandTotal += diffTotal;

        const { sizeElement, colorElement } = (typeof renderVariantSelectElements === 'function') 
            ? renderVariantSelectElements(item, idx, 'adj') 
            : { sizeElement: `<span style="color:#cbd5e1;">-</span>`, colorElement: `<span style="color:#cbd5e1;">-</span>` };

        let unitOptions = `<option value="base" ${!item.selectedUnit ? 'selected' : ''}>${item.unit || 'قطعة'}</option>`;
        if (item.units && item.units.length > 0) {
            unitOptions = item.units.map(u => 
                `<option value="${u.unitName}" ${item.selectedUnit && item.selectedUnit.unitName === u.unitName ? 'selected' : ''}>${u.unitName}</option>`
            ).join('');
        }

        let diffBadge = '';
        if (diffQty < 0) {
            diffBadge = `<span style="background: #fee2e2; color: #dc2626; border: 1.5px solid #ef4444; padding: 3px 8px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(220,38,38,0.15);" title="عجز بمقدار ${Math.abs(diffQty)} قطعة">🔻 عجز ${Math.abs(diffQty)}</span>`;
        } else if (diffQty > 0) {
            diffBadge = `<span style="background: #dcfce7; color: #15803d; border: 1.5px solid #22c55e; padding: 3px 8px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(34,197,94,0.15);" title="زيادة بمقدار ${diffQty} قطعة">🟢 زيادة +${diffQty}</span>`;
        } else {
            diffBadge = `<span style="background: #f1f5f9; color: #475569; border: 1.5px solid #cbd5e1; padding: 3px 8px; border-radius: 8px; font-weight: 900; font-size: 0.86rem; display: inline-flex; align-items: center; gap: 4px;" title="الرصيد الفعلي مطابق تماماً للرصيد الدفتري بالمخزن">✔️ مطابق 0</span>`;
        }

        rowsHtml += `
            <tr style="transition: background 0.15s ease;">
                <td style="text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
                <td style="font-family: monospace; font-weight: bold; color: #334155; font-size: 0.85rem;">${item.code || item.id}</td>
                <td style="font-weight: 900; color: #1e293b;">${item.name}</td>
                <td class="col-variant-size" style="text-align: center;">${sizeElement}</td>
                <td class="col-variant-color" style="text-align: center;">${colorElement}</td>
                <td style="background: rgba(51, 65, 85, 0.05); text-align: center; font-weight: 900; color: #334155; font-size: 1.05rem;" title="الرصيد الدفتري المسجل في المخزن">${stockBefore}</td>
                <td style="background: rgba(37, 99, 235, 0.05); text-align: center;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; gap: 3px;">
                        <button type="button" onclick="adjustItemCountedQty(${idx}, -1)" 
                            style="width: 26px; height: 30px; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 6px; font-weight: 900; cursor: pointer; color: #475569; transition: 0.15s;" 
                            title="إنقاص 1" onmouseover="this.style.background='#fee2e2'; this.style.color='#dc2626';" onmouseout="this.style.background='#ffffff'; this.style.color='#475569';">-</button>
                        <input type="number" class="qty-input" value="${item.qty}" step="0.01" min="0"
                            style="width: 65px; text-align: center; font-weight: 900; color: #1d4ed8; border: 2px solid #3b82f6; border-radius: 8px; height: 30px; background: #fff; font-size: 1rem;"
                            onchange="window.adjCart[${idx}].qty = Math.max(0, parseFloat(this.value) || 0); renderAdjTable();" title="تعديل الكمية المجرودة الفعلية">
                        <button type="button" onclick="adjustItemCountedQty(${idx}, 1)" 
                            style="width: 26px; height: 30px; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 6px; font-weight: 900; cursor: pointer; color: #475569; transition: 0.15s;" 
                            title="زيادة 1" onmouseover="this.style.background='#dcfce7'; this.style.color='#15803d';" onmouseout="this.style.background='#ffffff'; this.style.color='#475569';">+</button>
                    </div>
                </td>
                <td style="text-align: center; background: ${diffQty < 0 ? 'rgba(239, 68, 68, 0.04)' : (diffQty > 0 ? 'rgba(34, 197, 94, 0.04)' : 'transparent')};">${diffBadge}</td>
                <td style="background: rgba(5, 150, 105, 0.08); text-align: center; font-weight: 900; color: #047857; font-size: 1.15rem;" title="الرصيد بعد اعتماد التسوية">${stockAfter}</td>
                <td>
                    <select class="unit-select" onchange="updateAdjItemUnit(${idx}, this.value)" style="width: 100%; padding: 3px 4px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 0.82rem;">
                        ${unitOptions}
                    </select>
                </td>
                <td>
                    <input type="number" class="price-input" value="${parseFloat(item.price).toFixed(2)}" min="0" step="0.01"
                        style="width: 75px; text-align: center; padding: 3px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 0.85rem;"
                        onchange="window.adjCart[${idx}].price = parseFloat(this.value) || 0; renderAdjTable();" title="سعر التكلفة">
                </td>
                <td style="text-align: center; font-weight: 900; font-size: 0.95rem; color: ${diffTotal < 0 ? '#dc2626' : (diffTotal > 0 ? '#16a34a' : '#64748b')}; direction: ltr;">
                    ${(diffTotal > 0 ? '+' : '')}${diffTotal.toFixed(2)}
                </td>
                <td style="min-width: 120px;">
                    <input type="text" value="${item.notes || ''}" placeholder="ملاحظة..."
                        style="width: 100%; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; box-sizing: border-box;"
                        onchange="window.adjCart[${idx}].notes = this.value;">
                </td>
                <td style="text-align: center; width: 40px;">
                    <button class="btn-delete-row" onclick="removeAdjItem(${idx})" title="حذف الصنف">❌</button>
                </td>
            </tr>`;
    });
    tbody.innerHTML = rowsHtml;

    if (document.getElementById('adjItemsCount')) document.getElementById('adjItemsCount').innerText = window.adjCart.length;
    if (document.getElementById('adjTotalQty')) document.getElementById('adjTotalQty').innerText = totalCountedQty;
    if (document.getElementById('headerAdjTotalQty')) document.getElementById('headerAdjTotalQty').innerText = totalCountedQty;
    if (document.getElementById('adjShortageQty')) document.getElementById('adjShortageQty').innerText = totalShortageQty;
    if (document.getElementById('adjShortageVal')) document.getElementById('adjShortageVal').innerText = totalShortageVal.toFixed(2);
    if (document.getElementById('adjSurplusQty')) document.getElementById('adjSurplusQty').innerText = totalSurplusQty;
    if (document.getElementById('adjSurplusVal')) document.getElementById('adjSurplusVal').innerText = totalSurplusVal.toFixed(2);

    const grandTotalEl = document.getElementById('adjGrandTotal');
    if (grandTotalEl) {
        grandTotalEl.innerText = (netDiffGrandTotal > 0 ? '+' : '') + netDiffGrandTotal.toFixed(2);
        grandTotalEl.style.color = netDiffGrandTotal < 0 ? '#dc2626' : (netDiffGrandTotal > 0 ? '#16a34a' : '#b45309');
    }
    const headerGrandTotalEl = document.getElementById('headerAdjGrandTotal');
    if (headerGrandTotalEl) {
        headerGrandTotalEl.innerText = (netDiffGrandTotal > 0 ? '+' : '') + netDiffGrandTotal.toFixed(2);
    }
}

function adjustItemCountedQty(idx, delta) {
    if (window.adjCart && window.adjCart[idx]) {
        const cur = parseFloat(window.adjCart[idx].qty) || 0;
        window.adjCart[idx].qty = Math.max(0, cur + delta);
        renderAdjTable();
    }
}
window.adjustItemCountedQty = adjustItemCountedQty;

function updateAdjItemUnit(idx, unitName) {
    const item = window.adjCart[idx];
    const product = productsDB.find(p => p.id === item.id);
    if (!product) return;

    const unit = product.units ? product.units.find(u => u.unitName === unitName) : null;

    if (unit) {
        item.selectedUnit = unit;
        item.unitFactor = parseFloat(unit.factor) || 1;
        const lastPurchasePrice = typeof getProductLastPurchasePrice === 'function' ? getProductLastPurchasePrice(product.name, product.cost) : (parseFloat(product.cost) || 0);
        const unitCost = parseFloat(unit.cost);
        item.price = (!isNaN(unitCost) && unitCost > 0) ? unitCost : (lastPurchasePrice * item.unitFactor);
    } else {
        item.selectedUnit = null;
        item.unitFactor = 1;
        item.price = typeof getProductLastPurchasePrice === 'function' ? getProductLastPurchasePrice(product.name, product.cost) : (parseFloat(product.cost) || 0);
    }
    renderAdjTable();
}

function removeAdjItem(index) {
    const item = window.adjCart[index];
    if (typeof addToTrash === 'function') addToTrash('draft_item', item, `حذف من تسوية الجرد: ${item.name}`);
    window.adjCart.splice(index, 1);
    renderAdjTable();
}

function removeAdjRow() {
    if (window.adjCart && window.adjCart.length > 0) {
        removeAdjItem(window.adjCart.length - 1);
    } else {
        alert("لا توجد عناصر لحذفها");
    }
}

// دالة عرض الشرح والتوضيح التفاعلي لرؤوس أعمدة الجرد والتسوية
function showAdjColumnHelp(colType) {
    const helpData = {
        book: {
            title: '📦 الرصيد الدفتري (المخزني)',
            msg: `<b>ما هو الرصيد الدفتري؟</b><br>
هو رصيد الصنف المسجل حالياً في قاعدة بيانات النظام لهذا المخزن قبل البدء في عملية الجرد.<br><br>
💡 <b>الفائدة:</b> يمثل هذا الرقم ما يتوقعه النظام وجوده فعلياً في الرفوف بناءً على فواتير البيع والشراء السابقة.`
        },
        actual: {
            title: '🎯 الرصيد الفعلي (المجرود)',
            msg: `<b>ما هو الرصيد الفعلي المجرود؟</b><br>
هو عدد القطع الفعلي الموجود على أرض الواقع بعد عدّها في المحل/المخزن.<br><br>
💡 <b>طريقة الاستخدام بالسكانر:</b><br>
امسك السكانر واضرب القطع قطعة قطعة؛ كل ضربة باركود ستزيد هذا الرقم (+1) تلقائياً.<br>
كما يمكنك كتابة العدد الإجمالي بيدك مباشرة في خانة الإدخال إذا قمت بعدّه مسبقاً، أو استخدام زري (+) و (-) للتعديل السريع.`
        },
        diff: {
            title: '⚖️ فرق الجرد (عجز / زيادة)',
            msg: `<b>ما هو فرق الجرد؟</b><br>
هو ناتج المقارنة بين الرصيد الفعلي المجرود والرصيد الدفتري المسجل (<b>الفعلي - الدفتري</b>):<br><br>
🔻 <b style="color:#dc2626;">عجز (أحمر)</b>: إذا كان الفعلي أقل من الدفتري (بضاعة مفقودة أو مسروقة أو غير مسجلة).<br>
🟢 <b style="color:#16a34a;">زيادة (أخضر)</b>: إذا كان الفعلي أكبر من الدفتري (بضاعة متوفرة زائدة عن المسجل).<br>
✔️ <b style="color:#475569;">مطابق (رمادي)</b>: الرصيد الفعلي مطابق 100% للرصيد الدفتري (لا يوجد عجز أو زيادة).`
        },
        after: {
            title: '✅ الرصيد بعد التسوية',
            msg: `<b>ما هو الرصيد بعد التسوية؟</b><br>
هو الرصيد النهائي المعتمد الذي سيصبح رصيد المخزن الفعلي في النظام فور الضغط على زر <b>حفظ التسوية 💾</b>.<br><br>
💡 <b>الفائدة:</b> يقوم النظام تلقائياً بتصحيح وتحديث رصيد المخزن ليصبح مساوياً تماماً للرصيد الفعلي الذي جرده المستخدم.`
        },
        diffVal: {
            title: '💰 قيمة الفرق المالية',
            msg: `<b>ما هي قيمة الفرق المالية؟</b><br>
هي القيمة المالية الإجمالية بالجنيه للعجز أو الزيادة، محسوبة بضرب (فرق الجرد × سعر التكلفة).<br><br>
💡 <b>الفائدة:</b> معرفة الخسارة المالية الناتجة عن العجز أو المكسب الناتج عن الزيادة بدقة محاسبية.`
        }
    };

    const data = helpData[colType];
    if (!data) return;

    if (typeof showCustomAlert === 'function') {
        showCustomAlert({
            type: 'info',
            titleText: data.title,
            msg: data.msg
        });
    } else {
        alert(`${data.title}\n\n${data.msg.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')}`);
    }
}
window.showAdjColumnHelp = showAdjColumnHelp;

async function saveAdjustment() {
    if (typeof checkPermission === 'function' && !checkPermission('stock_edit')) return false;
    if (typeof window.enforceSubscriptionCheck === 'function' && !window.enforceSubscriptionCheck('other')) return false;

    if (window.isSavingTransaction) return false;
    window.isSavingTransaction = true;

    const saveBtns = document.querySelectorAll('#adjustment-section .btn-save, #adjustment-section .action-btn');
    saveBtns.forEach(b => { b.disabled = true; b.style.pointerEvents = 'none'; b.style.opacity = '0.6'; });

    try {
        if (!window.adjCart || window.adjCart.length === 0) {
            alert("⚠️ قائمة التسوية فارغة! لا يمكن الحفظ.");
            return false;
        }

        const isEditing = Boolean((typeof isEditMode !== 'undefined' && isEditMode) || (typeof window.isEditMode !== 'undefined' && window.isEditMode));
        const editId = (typeof editingInvoiceId !== 'undefined' && editingInvoiceId) || (typeof window.editingInvoiceId !== 'undefined' && window.editingInvoiceId) || null;
        const editType = (typeof editingInvoiceType !== 'undefined' && editingInvoiceType) || (typeof window.editingInvoiceType !== 'undefined' && window.editingInvoiceType) || 'تسوية مخزن ⚖️';

        let adjId;
        if (isEditing && editId) {
            adjId = editId;
            if (window.revertAndClearOldInvoice) {
                await window.revertAndClearOldInvoice(editId, editType);
            }
        } else {
            adjId = typeof getNextSequence === 'function' ? getNextSequence('تسوية') : ('ADJ-' + Date.now());
        }
        let grandTotal = 0;
        const dt = (isEditing && typeof editingOriginalDate !== 'undefined' && editingOriginalDate && editingOriginalDate.full)
            ? editingOriginalDate
            : (typeof getTransactionDateTime === 'function' ? getTransactionDateTime('adjDate', 'adjTime') : { full: new Date().toLocaleString('ar-EG'), iso: new Date().toISOString(), time: '' });

        const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';

        const itemsToProcess = [...window.adjCart];
        window.adjCart = []; // تفريغ فوري لمنع المعالجة المكررة

        itemsToProcess.forEach(item => {
            const p = productsDB.find(x => x.id === item.id || x.name === item.name);
            if (p) {
                const factor = parseFloat(item.unitFactor) || 1;
                const countedBase = (parseFloat(item.qty) || 0) * factor;
                const stockBefore = parseFloat(item.stock) || 0;
                // فرق الجرد: الرصيد الفعلي المجرود - الرصيد الدفتري المسجل بالمخزن
                const diffStock = countedBase - stockBefore;
                const newBaseStock = diffStock;

                const prevPStock = parseFloat(p.stock) || 0;
                p.stock = Math.max(0, prevPStock + newBaseStock);
                if (!p.warehouseStocks) p.warehouseStocks = {};
                const currentPWhStock = (p.warehouseStocks[activeWH] !== undefined && !isNaN(parseFloat(p.warehouseStocks[activeWH])))
                    ? parseFloat(p.warehouseStocks[activeWH])
                    : (activeWH === 'المخزن الرئيسي' ? prevPStock : 0);
                p.warehouseStocks[activeWH] = Math.max(0, currentPWhStock + newBaseStock);

                let matchedVar = null;
                if (p.variants && Array.isArray(p.variants)) {
                    const sVal = item.selectedSize || item.size || '';
                    const cVal = item.selectedColor || item.color || '';
                    matchedVar = p.variants.find(v => 
                        (v.size || '') === sVal && (v.color || '') === cVal
                    ) || p.variants.find(v => 
                        (!sVal || v.size === sVal) && (!cVal || v.color === cVal)
                    );
                    if (matchedVar) {
                        const prevVarStock = parseFloat(matchedVar.stock) || 0;
                        matchedVar.stock = Math.max(0, prevVarStock + newBaseStock);
                        if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                        const currentVarWhStock = (matchedVar.warehouseStocks[activeWH] !== undefined && !isNaN(parseFloat(matchedVar.warehouseStocks[activeWH])))
                            ? parseFloat(matchedVar.warehouseStocks[activeWH])
                            : (activeWH === 'المخزن الرئيسي' ? prevVarStock : 0);
                        matchedVar.warehouseStocks[activeWH] = Math.max(0, currentVarWhStock + newBaseStock);
                    }
                }

                const lineTotal = diffStock * (parseFloat(item.price) || 0);
                grandTotal += lineTotal;

                const diffDesc = diffStock < 0 ? `عجز (${Math.abs(diffStock)})` : (diffStock > 0 ? `زيادة (+${diffStock})` : 'مطابق (0)');
                const customNotes = item.notes || (document.getElementById('adjNotes') ? document.getElementById('adjNotes').value.trim() : '');
                const fullNotes = `جرد مخزن [${activeWH}]: دفتري ${stockBefore} | فعلي ${countedBase} | ${diffDesc}${customNotes ? ' - ' + customNotes : ''}`;

                transactions.push({
                    date: dt.full,
                    dateISO: dt.iso,
                    timeISO: dt.time,
                    type: 'تسوية مخزن ⚖️',
                    method: '-',
                    invoiceId: adjId,
                    product: p.name,
                    unit: item.selectedUnit ? item.selectedUnit.unitName : (p.unit || 'قطعة'),
                    size: item.selectedSize || item.size || '',
                    color: item.selectedColor || item.color || '',
                    qty: diffStock,
                    price: item.price,
                    total: Math.abs(lineTotal),
                    partner: 'جرد',
                    warehouse: activeWH,
                    user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '-',
                    notes: fullNotes,
                    unitFactor: factor,
                    editDate: (typeof isEditMode !== 'undefined' && isEditMode) ? new Date().toLocaleString('ar-EG') : '-'
                });
            }
        });

        transactions.push({
            date: dt.full,
            dateISO: dt.iso,
            timeISO: dt.time,
            type: 'تسوية مخزن ⚖️',
            isInvoiceHead: true,
            invoiceId: adjId,
            total: 0,
            partner: 'جرد (تسوية)',
            warehouse: activeWH,
            user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '-',
            notes: document.getElementById('adjNotes') ? document.getElementById('adjNotes').value.trim() : '',
            editDate: '-'
        });

        if (typeof saveData === 'function') await saveData();

        if (typeof renderInventoryTable === 'function') renderInventoryTable();
        if (typeof renderWarehouseReportTable === 'function') renderWarehouseReportTable();
        if (typeof renderHistoryTable === 'function') renderHistoryTable();
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();

        alert("✅ تم الحفظ بنجاح!!");

        if (typeof isEditMode !== 'undefined') window.isEditMode = false;
        if (typeof editingInvoiceId !== 'undefined') window.editingInvoiceId = null;

        resetAdjustment();
        return true;
    } finally {
        saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
        window.isSavingTransaction = false;
    }
}

// دالة خصم الفكة بتقريب المبلغ للأصغر
function applyFractionalDiscount(type) {
    let totalEl, discInput, discTypeEl, discReasonEl, calcFn, reasonsArr;

    if (type === 'sales') {
        totalEl = document.getElementById('totalAmount');
        discInput = document.getElementById('discountInput');
        discTypeEl = document.getElementById('discountType');
        discReasonEl = document.getElementById('discountReason');
        reasonsArr = (typeof discountReasons !== 'undefined') ? discountReasons : [];
        calcFn = typeof calculateTotals === 'function' ? calculateTotals : () => {};
    } else if (type === 'salesReturn') {
        totalEl = document.getElementById('returnTotalAmount');
        discInput = document.getElementById('salesReturnDiscount');
        discTypeEl = document.getElementById('salesReturnDiscountType');
        discReasonEl = document.getElementById('salesReturnDiscountReason');
        reasonsArr = [];
        calcFn = () => { if (typeof updateReturnTotal === 'function') updateReturnTotal(); };
    } else if (type === 'purchaseReturn') {
        totalEl = document.getElementById('purReturnTotalAmount');
        discInput = document.getElementById('purReturnDiscount');
        discTypeEl = document.getElementById('purReturnDiscountType');
        discReasonEl = document.getElementById('purReturnDiscountReason');
        reasonsArr = [];
        calcFn = () => { if (typeof updateReturnTotal === 'function') updateReturnTotal('purchase'); };
    } else {
        totalEl = document.getElementById('purchaseTotal');
        discInput = document.getElementById('purchaseDiscount');
        discTypeEl = document.getElementById('purchaseDiscountType');
        discReasonEl = document.getElementById('purchaseDiscountReason');
        reasonsArr = (typeof purchaseDiscountReasons !== 'undefined') ? purchaseDiscountReasons : [];
        calcFn = typeof calculatePurchaseTotals === 'function' ? calculatePurchaseTotals : () => {};
    }

    if (!totalEl || !discInput) return;
    let currentTotal = parseFloat(totalEl.innerText) || 0;
    let fraction = currentTotal - Math.floor(currentTotal);

    if (fraction > 0) {
        if (discTypeEl) discTypeEl.value = 'fixed';

        let currentDisc = parseFloat(discInput.value) || 0;
        discInput.value = (currentDisc + fraction).toFixed(2);

        if (reasonsArr && !reasonsArr.includes('خصم فكة')) {
            reasonsArr.push('خصم فكة');
        }

        if (discReasonEl) {
            if (discReasonEl.tagName === 'SELECT') {
                let found = false;
                for (let i = 0; i < discReasonEl.options.length; i++) {
                    if (discReasonEl.options[i].value === 'خصم فكة') { found = true; break; }
                }
                if (!found) {
                    let opt = document.createElement('option');
                    opt.value = 'خصم فكة'; opt.text = 'خصم فكة 🪙';
                    discReasonEl.add(opt);
                }
            }
            discReasonEl.value = 'خصم فكة';
        }

        calcFn();

        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'info',
                titleText: '🪙 تسوية الفكة',
                msg: `تم خصم مبلغ (<b>${fraction.toFixed(2)}</b>) بنجاح لتصحيح الفاتورة إلى عدد صحيح.`
            });
        }
    } else {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'warning',
                titleText: '⚠️ لا توجد فكة',
                msg: 'المبلغ الحالي هو عدد صحيح بالفعل ولا يحتوي على فكة للخصم.'
            });
        }
    }
}

// أزرار التنقل السريع (Navigation Logic)
function openPriceAdjustmentModal() {
    if (typeof checkPermission === 'function' && !checkPermission('products_edit')) return;

    const selectedIds = Array.from(window.selectedInventoryIds);
    document.getElementById('priceAdjustmentModal')?.classList.remove('hidden');

    const catSelect = document.getElementById('priceAdjCategory');
    if (catSelect) {
        catSelect.innerHTML = '<option value="all">كافة التصنيفات</option>';
        const cats = [...new Set(productsDB.map(p => p.category).filter(c => c))];
        cats.forEach(c => {
            catSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }

    loadPriceAdjustmentData(selectedIds);

    if (typeof applyPriceAdjColumnVisibility === 'function') {
        setTimeout(applyPriceAdjColumnVisibility, 100);
    }
}

function closePriceAdjustmentModal() {
    document.getElementById('priceAdjustmentModal')?.classList.add('hidden');
    if (document.getElementById('priceAdjSearch')) document.getElementById('priceAdjSearch').value = '';
    window.priceAdjData = [];
}

window.priceAdjData = window.priceAdjData || [];

function loadPriceAdjustmentData(selectedIds = []) {
    const tbody = document.getElementById('priceAdjustmentTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:50px;">⏳ جاري فحص ومزامنة البيانات...</td></tr>';

    try {
        if (!Array.isArray(productsDB) || productsDB.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:50px; color:#ef4444;">⚠️ قاعدة بيانات الأصناف غير متوفرة حالياً، يرجى إعادة المحاولة.</td></tr>';
            return;
        }

        const searchQ = document.getElementById('priceAdjSearch') ? document.getElementById('priceAdjSearch').value.toLowerCase().trim() : '';
        const catQ = document.getElementById('priceAdjCategory') ? document.getElementById('priceAdjCategory').value : 'all';

        let targets = [];

        if (selectedIds.length > 0 && !searchQ) {
            targets = productsDB.filter(p => selectedIds.includes(p.id));
        } else if (searchQ.length > 0 || catQ !== 'all') {
            targets = productsDB.filter(p => {
                const nameMatch = String(p.name || '').toLowerCase().includes(searchQ);
                const codeMatch = String(p.code || '').toLowerCase().includes(searchQ);
                const barcodeMatch = String(p.barcode || '').toLowerCase().includes(searchQ);
                const catMatch = (catQ === 'all') || (p.category === catQ);
                return (nameMatch || codeMatch || barcodeMatch) && catMatch;
            });
            if (targets.length > 500) targets = targets.slice(0, 500);
        } else {
            targets = productsDB;
        }

        window.priceAdjData = [];
        const currentWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';

        // إنشاء خريطة سريعة لآخر سعر شراء لتجنب فلترة المعاملات آلاف المرات
        const lastBuyMap = {};
        for (let i = transactions.length - 1; i >= 0; i--) {
            const t = transactions[i];
            if (t.product && t.type && t.type.includes('شراء') && !t.type.includes('مرتجع')) {
                if (lastBuyMap[t.product] === undefined) {
                    lastBuyMap[t.product] = parseFloat(t.price) || 0;
                }
            }
        }

        targets.forEach(p => {
            const itemName = p.name || 'صنف غير مسمى';
            const itemCode = p.code || '';
            const itemBarcode = p.barcode || '';
            const liveStock = parseFloat(p.stock) || 0;
            const liveAvgCost = parseFloat(p.cost) || 0; 
            const lastPPrice = lastBuyMap[itemName] !== undefined ? lastBuyMap[itemName] : liveAvgCost;

            if (!p.units || p.units.length === 0) {
                window.priceAdjData.push({
                    id: p.id,
                    unitIndex: -1,
                    name: itemName,
                    code: itemCode,
                    barcode: itemBarcode,
                    category: p.category || 'عام',
                    unit: p.unit || 'قطعة',
                    lastBuyPrice: lastPPrice,
                    avgBuyPrice: liveAvgCost,
                    wholesale: parseFloat(p.wholesale) || 0,
                    retail: parseFloat(p.price) || 0,
                    minPrice: parseFloat(p.minPrice) || 0,
                    discount: parseFloat(p.discount) || 0,
                    stock: liveStock,
                    profitMargin: (liveAvgCost > 0 && isFinite(liveAvgCost)) ? (((parseFloat(p.price) || 0) - liveAvgCost) / liveAvgCost * 100).toFixed(1) : '0.0'
                });
            } else {
                p.units.forEach((u, uIdx) => {
                    const uCost = (liveAvgCost * (u.factor || 1));
                    const uRetail = parseFloat(u.price) || 0;
                    window.priceAdjData.push({
                        id: p.id,
                        unitIndex: uIdx,
                        name: itemName,
                        code: itemCode,
                        barcode: itemBarcode,
                        category: p.category || 'عام',
                        unit: u.unitName,
                        lastBuyPrice: (lastPPrice * (u.factor || 1)),
                        avgBuyPrice: uCost,
                        wholesale: parseFloat(u.wholesale) || 0,
                        retail: uRetail,
                        minPrice: parseFloat(p.minPrice) || 0, 
                        discount: parseFloat(p.discount) || 0,
                        stock: liveStock / (u.factor || 1),
                        profitMargin: uCost > 0 ? ((uRetail - uCost) / uCost * 100).toFixed(1) : 0
                    });
                });
            }
        });

        renderPriceAdjustmentTable();
        updatePriceAdjStats();

        if (selectedIds.length > 0 && targets.length > 0) {
            showToast(`✅ تم تحميل عدد (${targets.length}) صنف و (${window.priceAdjData.length}) وحدة بيع`, 'success');
        }
    } catch (err) {
        console.error("Price Adjustment Data Load Error:", err);
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:50px; color:#ef4444;">❌ حدث خطأ أثناء المعالجة: ${err.message}</td></tr>`;
    }
}

function renderPriceAdjustmentTable(filteredData = null) {
    const tbody = document.getElementById('priceAdjustmentTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const dataToRender = filteredData || window.priceAdjData;

    if (dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:50px; color:#64748b;">ℹ️ لم يتم العثور على أي بيانات لعرضها.</td></tr>';
        if (document.getElementById('priceAdjCount')) document.getElementById('priceAdjCount').innerText = '0';
        return;
    }

    let htmlBuffer = [];
    dataToRender.forEach((p) => {
        const originalIndex = window.priceAdjData.findIndex(item => item.id === p.id && item.unitIndex === p.unitIndex);
        const isSubUnit = p.unitIndex > 0;
        const isEven = originalIndex % 2 === 0;
        const rowBg = isSubUnit ? 'rgba(255, 255, 255, 0.6)' : (isEven ? 'rgba(39, 174, 96, 0.1)' : 'rgba(197, 160, 89, 0.1)');
        const accentColor = isSubUnit ? '#94a3b8' : (isEven ? '#27ae60' : '#c9a84c');

        const profitVal = p.retail - p.avgBuyPrice;
        const profitPerc = p.avgBuyPrice > 0 ? (profitVal / p.avgBuyPrice * 100).toFixed(1) : 0;
        const profitColor = profitPerc > 20 ? '#16a34a' : (profitPerc > 5 ? '#ca8a04' : '#dc2626');

        htmlBuffer.push(`
            <tr style="background: ${rowBg}; border-bottom: 2px solid white; transition:0.3s;" data-orig-idx="${originalIndex}">
                <td class="col-adj-1" style="text-align:center; font-weight:bold; color:#64748b; border-right: 4px solid ${accentColor};">${originalIndex + 1}</td>
                <td class="col-adj-internal" style="text-align:center; font-weight:bold; color:#94a3b8; font-size:0.8rem;">${p.code || '-'}</td>
                <td class="col-adj-2" style="font-weight:bold; color:var(--main-purple); text-align:center;">${p.sysCode || p.id}</td>
                <td class="col-adj-3" style="font-weight:700; color:#1e293b; ${isSubUnit ? 'padding-right:20px;' : ''}">
                    ${p.name}
                </td>
                <td class="col-adj-4" style="text-align:center; font-size:0.8rem;">${p.barcode || '-'}</td>
                <td class="col-adj-6" style="font-size:0.8rem; text-align:center;">
                    <span style="display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; font-weight:bold; ${isSubUnit ? 'background:#e2e8f0; color:#475569;' : 'background:#dcfce7; color:#15803d; border:1px solid #86efac;'}">
                        ${isSubUnit ? '🔹' : '⭐'} ${p.unit || "قطعة"} ${isSubUnit ? '(فرعية)' : '(أساسية)'}
                    </span>
                </td>
                <td class="col-adj-12" style="text-align: center; font-weight: 900; color: #9a3412; background: #fffcf0; padding: 10px; border: 1px solid #fee2e2;">
                    ${p.avgBuyPrice.toFixed(2)}
                </td>
                <td class="col-adj-11" style="background:rgba(255,255,255,0.4); font-weight:bold; color:#991b1b; text-align:center;">${p.lastBuyPrice.toFixed(2)}</td>
                <td class="col-adj-13" style="padding: 5px;">
                    <input type="number" value="${p.wholesale}" 
                        style="width:100%; border:2px solid ${accentColor}; padding:6px; border-radius:6px; text-align:center; font-weight:900; background:white;" 
                        onchange="updateRowPriceAdj(${originalIndex}, 'wholesale', this.value)">
                </td>
                <td class="col-adj-10" style="padding: 5px;">
                    <input type="number" value="${p.retail}" 
                        style="width:100%; border:2px solid ${accentColor}; padding:6px; border-radius:6px; text-align:center; font-weight:900; background:white;" 
                        onchange="updateRowPriceAdj(${originalIndex}, 'retail', this.value)">
                </td>
                <td class="col-adj-profit" style="padding: 5px; text-align: center; font-weight: 900; color: ${profitColor}; background: rgba(255,255,255,0.5);">
                    ${profitPerc}%
                </td>
                <td class="col-adj-min" style="padding: 5px;">
                    <input type="number" value="${p.minPrice}" 
                        style="width:100%; border:1px solid #cbd5e1; padding:6px; border-radius:6px; text-align:center; background:white;" 
                        onchange="updateRowPriceAdj(${originalIndex}, 'minPrice', this.value)">
                </td>
                <td class="col-adj-9" style="text-align:center; font-weight:900; color:#334155; background:rgba(255,255,255,0.2);">${Number(p.stock).toFixed(2).replace(/\.00$/, '')}</td>
            </tr>
        `);
    });
    tbody.innerHTML = htmlBuffer.join('');
    if (document.getElementById('priceAdjCount')) document.getElementById('priceAdjCount').innerText = dataToRender.length;

    if (typeof applyPriceAdjColumnVisibility === 'function') applyPriceAdjColumnVisibility();
}

async function updateRowPriceAdj(adjIndex, field, value) {
    const item = window.priceAdjData[adjIndex];
    if (item) {
        const newValue = parseFloat(value) || 0;
        item[field] = newValue;

        if (field === 'retail' || field === 'avgBuyPrice') {
            item.profitMargin = item.avgBuyPrice > 0 ? ((item.retail - item.avgBuyPrice) / item.avgBuyPrice * 100).toFixed(1) : 0;
        }

        renderPriceAdjustmentTable(window.priceAdjCurrentFiltered);
        updatePriceAdjStats();

        try {
            const pInDB = await db.products.get(item.id);
            if (pInDB) {
                if (item.unitIndex === -1) {
                    if (field === 'retail') pInDB.price = newValue;
                    else if (field === 'wholesale') pInDB.wholesale = newValue;
                    else if (field === 'minPrice') pInDB.minPrice = newValue;
                    else if (field === 'discount') pInDB.discount = newValue;
                    else if (field === 'avgBuyPrice') pInDB.cost = newValue;
                } else {
                    if (pInDB.units && pInDB.units[item.unitIndex]) {
                        if (field === 'retail') pInDB.units[item.unitIndex].price = newValue;
                        else if (field === 'wholesale') pInDB.units[item.unitIndex].wholesale = newValue;
                        else if (field === 'avgBuyPrice') pInDB.units[item.unitIndex].cost = newValue;

                        if (item.unitIndex === 0) {
                            if (field === 'retail') pInDB.price = newValue;
                            else if (field === 'wholesale') pInDB.wholesale = newValue;
                            else if (field === 'avgBuyPrice') pInDB.cost = newValue;
                        }
                    }
                }
                await db.products.put(pInDB);
                productsDB = await db.products.toArray();
            }
        } catch (err) {
            console.error("Auto-save failed:", err);
        }
    }
}

window.priceAdjCurrentFiltered = null;

function handlePriceAdjSearch() {
    const query = document.getElementById('priceAdjSearch')?.value.toLowerCase() || '';
    const cat = document.getElementById('priceAdjCategory')?.value || 'all';
    const stockFilter = document.getElementById('priceAdjStockFilter')?.value || 'all';

    const filtered = window.priceAdjData.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(query) || 
                         (p.barcode && p.barcode.includes(query)) ||
                         (p.code && String(p.code).includes(query));

        const catMatch = (cat === 'all' || p.category === cat);

        let stockMatch = true;
        if (stockFilter === 'in') stockMatch = (p.stock > 0);
        else if (stockFilter === 'out') stockMatch = (p.stock <= 0);

        return nameMatch && catMatch && stockMatch;
    });

    const isFiltered = query !== '' || cat !== 'all' || stockFilter !== 'all';
    window.priceAdjCurrentFiltered = isFiltered ? filtered : null;
    renderPriceAdjustmentTable(filtered);
}

async function applyBulkPriceAdjustment(direction = 1) {
    const inputEl = document.getElementById('priceAdjBulkPercent');
    const inputVal = parseFloat(inputEl ? inputEl.value : 0);
    if (isNaN(inputVal) || inputVal <= 0) {
        if (typeof showToast === 'function') showToast("⚠️ يرجى إدخال نسبة مئوية صحيحة (مثلاً 5 أو 10)", "warning");
        else alert("⚠️ يرجى إدخال نسبة مئوية صحيحة");
        if (inputEl) { inputEl.focus(); inputEl.select(); }
        return;
    }

    const percent = inputVal * direction;
    const targetSelect = document.getElementById('priceAdjBulkTarget');
    const targetType = targetSelect ? targetSelect.value : 'both';

    const targetItems = (window.priceAdjCurrentFiltered && window.priceAdjCurrentFiltered.length > 0) 
        ? window.priceAdjCurrentFiltered 
        : (window.priceAdjData || []);

    if (!targetItems || targetItems.length === 0) {
        if (typeof showToast === 'function') showToast("❌ لا توجد أصناف في الجدول لتعديلها", "error");
        else alert("❌ لا توجد أصناف في الجدول لتعديلها");
        return;
    }

    const targetTypeName = targetType === 'retail' ? 'سعر القطاعي' : (targetType === 'wholesale' ? 'سعر الجملة' : 'سعر القطاعي والجملة معاً');

    const factor = 1 + (percent / 100);

    // تطبيق التعديل الفوري على البيانات
    targetItems.forEach(p => {
        if (targetType === 'retail' || targetType === 'both') {
            const currentRetail = parseFloat(p.retail) || 0;
            p.retail = Number((Math.round(currentRetail * factor * 100) / 100).toFixed(2));
            if (p.minPrice > 0) {
                p.minPrice = Number((Math.round(parseFloat(p.minPrice) * factor * 100) / 100).toFixed(2));
            }
        }
        if (targetType === 'wholesale' || targetType === 'both') {
            const currentWS = parseFloat(p.wholesale) || 0;
            p.wholesale = Number((Math.round(currentWS * factor * 100) / 100).toFixed(2));
        }
        const buyCost = parseFloat(p.avgBuyPrice) || 0;
        p.profitMargin = buyCost > 0 ? (((parseFloat(p.retail) || 0) - buyCost) / buyCost * 100).toFixed(1) : 0;
    });

    // إعادة رسم الجدول فوراً بالقيم الجديدة
    renderPriceAdjustmentTable(window.priceAdjCurrentFiltered);
    updatePriceAdjStats();

    if (typeof showToast === 'function') {
        showToast(`✅ تم تطبيق ${percent > 0 ? 'زيادة' : 'خفض'} (${Math.abs(percent)}%) على ${targetTypeName} بنجاح! يرجى الضغط على "حفظ التعديلات" أدناه لتأكيدها.`, 'success');
    }
}

function updatePriceAdjStats() {
    let totalCost = 0;
    let totalSale = 0;
    if (window.priceAdjData) {
        window.priceAdjData.forEach(p => {
            if (p.unitIndex === -1 || p.unitIndex === 0) {
                const rowCost = p.avgBuyPrice * p.stock;
                const rowProfit = (p.retail > 0) ? (p.retail - p.avgBuyPrice) * p.stock : 0;

                totalCost += rowCost;
                totalSale += (rowCost + rowProfit);
            }
        });
    }
    if (document.getElementById('priceAdjTotalCost')) document.getElementById('priceAdjTotalCost').innerText = totalCost.toFixed(2);
    if (document.getElementById('priceAdjTotalSale')) document.getElementById('priceAdjTotalSale').innerText = totalSale.toFixed(2);
}

async function savePriceAdjustments() {
    if (typeof window.enforceSubscriptionCheck === 'function' && !window.enforceSubscriptionCheck('other')) return false;
    if (!window.priceAdjData || window.priceAdjData.length === 0) {
        closePriceAdjustmentModal();
        return;
    }
    const dataToSave = [...window.priceAdjData];
    closePriceAdjustmentModal();
    showToast("🔄 جاري حفظ التعديلات في الخلفية...", 'info');

    try {
        const grouped = {};
        dataToSave.forEach(item => {
            if (!grouped[item.id]) grouped[item.id] = [];
            grouped[item.id].push(item);
        });

        for (let prodId in grouped) {
            const idNum = parseInt(prodId);
            const pInDB = await db.products.get(idNum);

            if (pInDB) {
                const changes = grouped[prodId];
                changes.forEach(ch => {
                    if (ch.unitIndex === -1) {
                        pInDB.price = ch.retail;
                        pInDB.wholesale = ch.wholesale;
                        pInDB.minPrice = ch.minPrice;
                        pInDB.discount = ch.discount;
                        pInDB.cost = ch.avgBuyPrice; 
                    } else {
                        if (pInDB.units && pInDB.units[ch.unitIndex]) {
                            pInDB.units[ch.unitIndex].price = ch.retail;
                            pInDB.units[ch.unitIndex].wholesale = ch.wholesale;
                            pInDB.units[ch.unitIndex].cost = ch.avgBuyPrice; 

                            if (ch.unitIndex === 0) {
                                pInDB.price = ch.retail;
                                pInDB.wholesale = ch.wholesale;
                                pInDB.minPrice = ch.minPrice;
                                pInDB.discount = ch.discount;
                                pInDB.cost = ch.avgBuyPrice;
                            }
                        }
                    }
                });
                await db.products.put(pInDB);
            }
        }


        productsDB = await db.products.toArray();

        showToast("✅ تم حفظ كافة تعديلات الأسعار بنجاح!", 'success');

        if (typeof renderInventoryTable === 'function') renderInventoryTable();
        if (typeof renderWarehouseReportTable === 'function') renderWarehouseReportTable();
        if (typeof renderProductsGrid === 'function') renderProductsGrid();
        if (typeof updateInventoryStats === 'function') updateInventoryStats();
        if (typeof updateDashboard === 'function') updateDashboard();

    } catch (error) {
        console.error("Error saving prices:", error);
        alert("❌ حدث خطأ أثناء الحفظ: " + error.message);
    }
}

document.addEventListener('keydown', (e) => {
    const activeTab = (typeof openTabs !== 'undefined') ? openTabs.find(t => t.id === activeTabId) : null;
    if (activeTab && activeTab.type === 'inventory') {
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
        if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const searchInput = document.getElementById('invSearchInput');
            if (searchInput) {
                searchInput.focus();
            }
        }
    }
});

function exportPriceAdjToExcel() {
    try {
        const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : (typeof window.XLSX !== 'undefined' ? window.XLSX : null)));
        
        const query = document.getElementById('priceAdjSearch')?.value.toLowerCase() || '';
        const cat = document.getElementById('priceAdjCategory')?.value || 'all';
        const stockFilter = document.getElementById('priceAdjStockFilter')?.value || 'all';

        const filtered = (window.priceAdjData || []).filter(p => {
            const nameMatch = p.name.toLowerCase().includes(query) || 
                             (p.barcode && String(p.barcode).toLowerCase().includes(query)) ||
                             (p.code && String(p.code).toLowerCase().includes(query));
            const catMatch = (cat === 'all' || p.category === cat);
            let stockMatch = true;
            if (stockFilter === 'in') stockMatch = (p.stock > 0);
            else if (stockFilter === 'out') stockMatch = (p.stock <= 0);
            return nameMatch && catMatch && stockMatch;
        });

        if (filtered.length === 0) {
            if (typeof showToast === 'function') showToast("⚠️ لا توجد بيانات لتصديرها حالياً", "warning");
            else alert("⚠️ لا توجد بيانات لتصديرها حالياً.");
            return;
        }

        const tableData = [];
        const headerRow = ["مسلسل", "الكود الداخلي", "كود الصنف", "اسم الصنف", "الباركود", "الوحدة", "متوسط التكلفة", "آخر شراء", "سعر الجملة", "سعر القطاعي", "نسبة الربح %", "أدنى سعر", "الرصيد الفعلي"];
        tableData.push(headerRow);

        filtered.forEach((p, index) => {
            tableData.push([
                index + 1,
                p.sysCode || p.id,
                p.code || "-",
                p.name,
                p.barcode || "",
                p.unit || "قطعة",
                p.avgBuyPrice ? parseFloat(p.avgBuyPrice).toFixed(2) : "0.00",
                p.lastBuyPrice ? parseFloat(p.lastBuyPrice).toFixed(2) : "0.00",
                p.wholesale ? parseFloat(p.wholesale).toFixed(2) : "0.00",
                p.retail ? parseFloat(p.retail).toFixed(2) : "0.00",
                (p.profitMargin || 0) + "%",
                p.minPrice ? parseFloat(p.minPrice).toFixed(2) : "0.00",
                p.stock
            ]);
        });

        const fileName = `تقرير_أسعار_المخزن_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}`;

        if (XLSXLib && XLSXLib.utils) {
            try {
                const ws = XLSXLib.utils.aoa_to_sheet(tableData);
                const wb = XLSXLib.utils.book_new();
                XLSXLib.utils.book_append_sheet(wb, ws, "أسعار المخزون");
                XLSXLib.writeFile(wb, `${fileName}.xlsx`);
                if (typeof showToast === 'function') showToast("✅ تم تصدير ملف الإكسيل بنجاح", "success");
                return;
            } catch (err) {
                console.warn("XLSX lib error, switching to direct download:", err);
            }
        }

        if (typeof downloadAOAAsExcelCSV === 'function') {
            downloadAOAAsExcelCSV(tableData, fileName);
        } else if (typeof window.downloadAOAAsExcelCSV === 'function') {
            window.downloadAOAAsExcelCSV(tableData, fileName);
        }
    } catch (err) {
        console.error("Export Error:", err);
        if (typeof showToast === 'function') showToast("❌ حدث خطأ أثناء التصدير", "error");
    }
}
window.exportPriceAdjToExcel = exportPriceAdjToExcel;
