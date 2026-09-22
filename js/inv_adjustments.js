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

window.getAdjustmentPriceType = function() {
    let aType = null;
    if (typeof getStore === 'function') {
        aType = getStore('adjustmentPriceType');
    }
    if (!aType) {
        try {
            const settingsObj = JSON.parse((typeof getStore === 'function' ? getStore('pos_settings') : null) || '{}');
            aType = settingsObj.adjustmentPriceType;
        } catch(e) {}
    }
    return aType || 'retail';
};

window.getAdjustmentPriceLabel = function() {
    const priceType = window.getAdjustmentPriceType();
    if (priceType === 'cost') return 'سعر التكلفة';
    if (priceType === 'wholesale') return 'سعر الجملة';
    return 'سعر القطاعي';
};

window.getEffectiveAdjustmentPrice = function(product, variant = null, unit = null) {
    if (!product) return 0;
    const priceType = window.getAdjustmentPriceType();
    const factor = (unit && unit.factor) ? parseFloat(unit.factor) : 1;

    let price = 0;
    if (variant) {
        if (priceType === 'cost') {
            const baseCost = parseFloat(product.cost) || 0;
            let vCost = parseFloat(variant.cost);
            if (isNaN(vCost) || vCost <= 0) vCost = baseCost;
            if (baseCost > 0 && Array.isArray(product.variants) && product.variants.length > 0) {
                const firstC = parseFloat(product.variants[0].cost) || 0;
                const allSameC = product.variants.every(v => (parseFloat(v.cost) || 0) === firstC);
                if (allSameC && Math.abs(vCost - baseCost) > 0.01) vCost = baseCost;
            }
            price = vCost || baseCost || 0;
        } else if (priceType === 'wholesale') {
            const baseWs = parseFloat(product.wholesale) || parseFloat(product.wholesalePrice) || 0;
            let vWs = parseFloat(variant.wholesale) || parseFloat(variant.wholesalePrice);
            if (isNaN(vWs) || vWs <= 0) vWs = baseWs;
            if (baseWs > 0 && Array.isArray(product.variants) && product.variants.length > 0) {
                const firstWs = parseFloat(product.variants[0].wholesale || product.variants[0].wholesalePrice) || 0;
                const allSameWs = product.variants.every(v => (parseFloat(v.wholesale || v.wholesalePrice) || 0) === firstWs);
                if (allSameWs && Math.abs(vWs - baseWs) > 0.01) vWs = baseWs;
            }
            price = vWs || baseWs || parseFloat(variant.price) || parseFloat(product.price) || 0;
        } else {
            // retail (الافتراضي لحماية الخصوصية)
            const basePrice = parseFloat(product.price) || 0;
            let vPrice = parseFloat(variant.price);
            if (isNaN(vPrice) || vPrice <= 0) vPrice = basePrice;
            if (basePrice > 0 && Array.isArray(product.variants) && product.variants.length > 0) {
                const firstP = parseFloat(product.variants[0].price) || 0;
                const allSameP = product.variants.every(v => (parseFloat(v.price) || 0) === firstP);
                if (allSameP && Math.abs(vPrice - basePrice) > 0.01) {
                    vPrice = basePrice;
                }
            }
            price = vPrice || basePrice || 0;
        }
    } else {
        if (priceType === 'cost') {
            price = (unit && unit.cost !== undefined && parseFloat(unit.cost) > 0) ? parseFloat(unit.cost) : (parseFloat(product.cost) || 0);
        } else if (priceType === 'wholesale') {
            price = (unit && unit.wholesale !== undefined && parseFloat(unit.wholesale) > 0) ? parseFloat(unit.wholesale) : (parseFloat(product.wholesale) || parseFloat(product.wholesalePrice) || parseFloat(product.price) || 0);
        } else {
            // retail (الافتراضي لحماية الخصوصية)
            price = (unit && unit.price !== undefined && parseFloat(unit.price) > 0) ? parseFloat(unit.price) : (parseFloat(product.price) || 0);
        }
    }

    if (unit && factor > 1 && priceType !== 'cost' && (!unit.price || unit.price === product.price)) {
        price = price * factor;
    }
    return parseFloat(price) || 0;
};

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

    const pLabel = (typeof window.getAdjustmentPriceLabel === 'function') ? window.getAdjustmentPriceLabel() : 'سعر القطاعي';
    if (document.getElementById('adjPriceLabelText')) document.getElementById('adjPriceLabelText').innerText = pLabel;
    if (document.getElementById('adjThPrice')) document.getElementById('adjThPrice').innerText = pLabel;

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

    const calculatedPrice = (typeof window.getEffectiveAdjustmentPrice === 'function')
        ? window.getEffectiveAdjustmentPrice(product, null, unit)
        : (typeof getProductLastPurchasePrice === 'function' ? getProductLastPurchasePrice(product.name, product.cost) : (parseFloat(product.cost) || 0));
    if (document.getElementById('adjPrice')) document.getElementById('adjPrice').value = calculatedPrice.toFixed(2);

    const factor = (unit && unit.factor) ? parseFloat(unit.factor) : 1;
    const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
    let whStock = 0;
    if (product.warehouseStocks && typeof product.warehouseStocks === 'object' && product.warehouseStocks[activeWH] !== undefined) {
        whStock = parseFloat(product.warehouseStocks[activeWH]) || 0;
    } else if (activeWH === 'المخزن الرئيسي' || !product.warehouseStocks) {
        whStock = parseFloat(product.stock) || 0;
    }
    const displayStock = whStock / factor;
    document.querySelectorAll('.adj-current-stock-val').forEach(el => {
        el.innerText = `${displayStock.toFixed(2)} ${unit ? unit.unitName : (product.unit || 'قطعة')}`;
    });

    const pLabel = (typeof window.getAdjustmentPriceLabel === 'function') ? window.getAdjustmentPriceLabel() : 'سعر القطاعي';
    if (document.getElementById('adjPriceLabelText')) document.getElementById('adjPriceLabelText').innerText = pLabel;

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
                price: (typeof window.getEffectiveAdjustmentPrice === 'function')
                    ? window.getEffectiveAdjustmentPrice(pMatch, matchingVariant)
                    : (parseFloat(matchingVariant.cost) || parseFloat(pMatch.cost) || 0),
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

    // 2. بحث بالتطابق التام للاسم أولاً أو الباركود الأساسي أو الكود
    if (!pMatch) {
        const normClean = (typeof window.normalizeSearchQuery === 'function')
            ? window.normalizeSearchQuery(cleanQuery)
            : cleanQuery.trim().toLowerCase();

        pMatch = productsDB.find(p => {
            const pNorm = (typeof window.normalizeSearchQuery === 'function')
                ? window.normalizeSearchQuery(p.name)
                : String(p.name || '').trim().toLowerCase();
            return pNorm === normClean;
        });
    }

    if (!pMatch) {
        pMatch = productsDB.find(p => String(p.barcode || '').trim() === cleanQuery || String(p.code || '').trim() === cleanQuery);
    }

    // 3. بحث بوحدات الصنف
    if (!pMatch) {
        pMatch = productsDB.find(p => p.units && p.units.some(u => String(u.unitBarcode || '').trim() === cleanQuery));
    }

    // 4. بحث عبر محرك البحث المرتب
    if (!pMatch) {
        const matches = (typeof window.searchProductsRanked === 'function')
            ? window.searchProductsRanked(cleanQuery, { limit: 10 })
            : productsDB.filter(p => p.name && p.name.toLowerCase().includes(cleanQuery.toLowerCase()));
        
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
                    price: (typeof window.getEffectiveAdjustmentPrice === 'function')
                        ? window.getEffectiveAdjustmentPrice(pMatch, null, defUnit)
                        : (parseFloat(pMatch.cost) || 0),
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
        fillAdjustmentHeaderWithUnit(pMatch, (pMatch.units && pMatch.units.length > 0) ? pMatch.units[0] : { unitName: pMatch.unit || 'قطعة', factor: 1, cost: pMatch.cost, price: pMatch.price, wholesale: pMatch.wholesale });
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

    const filtered = (typeof window.searchProductsRanked === 'function')
        ? window.searchProductsRanked(query)
        : (productsDB || []).filter(p => (p.name && p.name.includes(query)) || (p.barcode && String(p.barcode).includes(query)));

    if (filtered.length > 0) {
        const priceTitle = (typeof window.getAdjustmentPriceLabel === 'function') ? window.getAdjustmentPriceLabel() : 'سعر القطاعي';
        resultsDiv.innerHTML = `
            <div class="pos-search-panel" style="width: 100%; max-width: 650px; min-width: 320px; position: absolute; top: 100%; right: 0; z-index: 99999; background: white; border-radius: 14px; box-shadow: 0 15px 35px rgba(0,0,0,0.25); border: 2px solid #a7f3d0; direction: rtl; text-align: right; margin-top: 6px; animation: modalFadeIn 0.2s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #ecfdf5; border-bottom: 1px solid #d1fae5; border-top-left-radius: 14px; border-top-right-radius: 14px;">
                    <span style="font-weight: 800; font-size: 0.88rem; color: #047857;">🔍 نتائج بحث تسوية المخزون (${filtered.length} صنف)</span>
                    <button onclick="document.getElementById('adjSearchResults').style.display='none';" class="pos-search-close-btn" title="إغلاق النافذة">❌</button>
                </div>
                <div style="max-height: 380px; overflow-y: auto; padding: 6px; scrollbar-gutter: stable;">
                    ${filtered.map(p => {
                        const priceVal = (typeof window.getEffectiveAdjustmentPrice === 'function') ? window.getEffectiveAdjustmentPrice(p) : (parseFloat(p.price) || 0);
                        const activeWhName = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
                        const stockVal = typeof getWarehouseStock === 'function' ? getWarehouseStock(p.name, activeWhName) : (parseFloat(p.stock) || 0);
                        const sizesList = (p.variants && Array.isArray(p.variants)) 
                            ? [...new Set(p.variants.map(v => String(v.size || '').trim()).filter(s => s && s !== '-' && s !== 'موحد' && s !== 'قياسي'))] 
                            : [];
                        const sizesHtml = sizesList.length > 0 
                            ? `<span style="background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; border: 1px solid #a7f3d0;">📏 مقاسات: ${sizesList.slice(0, 5).join(', ')}${sizesList.length > 5 ? '...' : ''}</span>`
                            : '';
                        return `
                            <div class="pos-search-row adj-search-row" onclick="
                                document.getElementById('adjSearchResults').style.display='none';
                                const pSelected = productsDB.find(x => x.id === ${p.id});
                                if (pSelected && pSelected.variants && pSelected.variants.length > 0) {
                                    showVariantSelectionModal(pSelected, 'adj');
                                } else if (typeof showUnitSelectionModal === 'function' && ${p.units && p.units.length > 1}) {
                                    showUnitSelectionModal(pSelected, 'adjustment');
                                } else {
                                    fillAdjustmentHeaderWithUnit(pSelected, ${JSON.stringify((p.units && p.units.length > 0) ? p.units[0] : { unitName: p.unit || 'قطعة', factor: 1, cost: p.cost, price: p.price, wholesale: p.wholesale }).replace(/"/g, '&quot;')});
                                }" 
                                style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: all 0.15s ease; border-radius: 10px; gap: 8px;">
                                <div style="flex: 1.5; min-width: 180px;">
                                    <div style="font-weight: 900; font-size: 0.98rem; color: #1e293b;">${p.name}</div>
                                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                                        <span>🏷️ كود: <b style="color:#047857;">${p.code || p.id}</b> | باركود: <b>${p.barcode || '---'}</b></span>
                                        ${sizesHtml}
                                    </div>
                                </div>
                                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                                    <div style="text-align: center; background: rgba(59, 130, 246, 0.08); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.25);">
                                        <div style="font-size: 0.7rem; color: #1d4ed8; font-weight: 800;">📦 الرصيد (${activeWhName})</div>
                                        <div style="font-weight: 900; font-size: 0.95rem; color: ${stockVal <= 5 ? '#ef4444' : '#1d4ed8'};">${stockVal} <span style="font-size:0.7rem;">${p.unit || 'قطعة'}</span></div>
                                    </div>
                                    <div style="text-align: center; background: rgba(34, 197, 94, 0.08); padding: 5px 14px; border-radius: 8px; border: 1.5px solid rgba(34, 197, 94, 0.25);">
                                        <div style="font-size: 0.7rem; color: #15803d; font-weight: 800;">💰 ${priceTitle}</div>
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
    const defaultAdjPrice = (typeof window.getEffectiveAdjustmentPrice === 'function')
        ? window.getEffectiveAdjustmentPrice(window.selectedAdjItem, null, currentAdjHeaderUnit)
        : (parseFloat(window.selectedAdjItem.cost) || 0);
    const price = (document.getElementById('adjPrice') && document.getElementById('adjPrice').value !== '')
        ? (parseFloat(document.getElementById('adjPrice').value) || 0)
        : defaultAdjPrice;
    const notes = document.getElementById('adjNotes') ? document.getElementById('adjNotes').value.trim() : '';

    if (!window.adjCart) window.adjCart = [];
    const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();

    const sSize = window.selectedAdjItem.selectedSize || window.selectedAdjItem.size || '';
    const sColor = window.selectedAdjItem.selectedColor || window.selectedAdjItem.color || '';

    let liveStock = 0;
    const p = (typeof productsDB !== 'undefined' && Array.isArray(productsDB))
        ? productsDB.find(x => x.id === window.selectedAdjItem.id)
        : null;
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
    if (liveStock === 0 && window.selectedAdjItem && window.selectedAdjItem.stock !== undefined) {
        liveStock = parseFloat(window.selectedAdjItem.stock) || 0;
    }

    const existing = window.adjCart.find(it => 
        it.id === window.selectedAdjItem.id && 
        ((it.size || it.selectedSize || '') === sSize) && 
        ((it.color || it.selectedColor || '') === sColor)
    );

    if (existing) {
        existing.qty = qty;
        existing.price = price;
        if (notes) existing.notes = notes;
        if (existing.stock !== undefined && existing.stock !== null) {
            liveStock = existing.stock;
        }
    } else {
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
    // الاحتفاظ برصيد الصنف المضاف في صندوق الرصيد الفعلي بدلاً من تصفيره ليبقى ظاهراً للعميل
    document.querySelectorAll('.adj-current-stock-val').forEach(el => el.innerText = liveStock);
    window.selectedAdjItem = null;
    document.getElementById('adjSearch').focus();
}

function renderAdjTable() {
    const tbody = document.getElementById('adjTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const priceLabel = (typeof window.getAdjustmentPriceLabel === 'function') ? window.getAdjustmentPriceLabel() : 'سعر القطاعي';
    const adjThPrice = document.getElementById('adjThPrice');
    if (adjThPrice) adjThPrice.innerText = priceLabel;
    const adjPriceLabelText = document.getElementById('adjPriceLabelText');
    if (adjPriceLabelText) adjPriceLabelText.innerText = priceLabel;

    if (!window.adjCart || window.adjCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 25px; color: #7f8c8d; font-weight: bold; font-size: 0.95rem;">ابدأ بمسح باركود الصنف بالسكانر أو البحث بالاسم</td></tr>';
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
                <td class="col-adj-idx" style="text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
                <td class="col-adj-code" style="font-family: monospace; font-weight: bold; color: #334155; font-size: 0.85rem;">${item.code || item.id}</td>
                <td class="col-adj-name" style="font-weight: 900; color: #1e293b;">${item.name}</td>
                <td class="col-variant-size col-adj-size" style="text-align: center;">${sizeElement}</td>
                <td class="col-variant-color col-adj-color" style="text-align: center;">${colorElement}</td>
                <td class="col-adj-book" style="background: rgba(51, 65, 85, 0.05); text-align: center; font-weight: 900; color: #334155; font-size: 1.05rem;" title="الرصيد الدفتري المسجل في المخزن">${stockBefore}</td>
                <td class="col-adj-actual" style="background: rgba(37, 99, 235, 0.05); text-align: center;">
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
                <td class="col-adj-diff" style="text-align: center; background: ${diffQty < 0 ? 'rgba(239, 68, 68, 0.04)' : (diffQty > 0 ? 'rgba(34, 197, 94, 0.04)' : 'transparent')};">${diffBadge}</td>
                <td class="col-adj-after" style="background: rgba(5, 150, 105, 0.08); text-align: center; font-weight: 900; color: #047857; font-size: 1.15rem;" title="الرصيد بعد اعتماد التسوية">${stockAfter}</td>
                <td class="col-adj-unit">
                    <select class="unit-select" onchange="updateAdjItemUnit(${idx}, this.value)" style="width: 100%; padding: 3px 4px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 0.82rem;">
                        ${unitOptions}
                    </select>
                </td>
                <td class="col-adj-price">
                    <input type="number" class="price-input" value="${parseFloat(item.price).toFixed(2)}" min="0" step="0.01"
                        style="width: 75px; text-align: center; padding: 3px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 0.85rem;"
                        onchange="window.adjCart[${idx}].price = parseFloat(this.value) || 0; renderAdjTable();" title="${priceLabel}">
                </td>
                <td class="col-adj-diffval" style="text-align: center; font-weight: 900; font-size: 0.95rem; color: ${diffTotal < 0 ? '#dc2626' : (diffTotal > 0 ? '#16a34a' : '#64748b')}; direction: ltr;">
                    ${(diffTotal > 0 ? '+' : '')}${diffTotal.toFixed(2)}
                </td>
                <td class="col-adj-actions" style="text-align: center; width: 45px;">
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
        item.price = (typeof window.getEffectiveAdjustmentPrice === 'function')
            ? window.getEffectiveAdjustmentPrice(product, null, unit)
            : ((!isNaN(parseFloat(unit.cost)) && parseFloat(unit.cost) > 0) ? parseFloat(unit.cost) : ((parseFloat(product.cost) || 0) * item.unitFactor));
    } else {
        item.selectedUnit = null;
        item.unitFactor = 1;
        item.price = (typeof window.getEffectiveAdjustmentPrice === 'function')
            ? window.getEffectiveAdjustmentPrice(product, null, null)
            : (parseFloat(product.cost) || 0);
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
        const origDt = (typeof editingOriginalDate !== 'undefined' && editingOriginalDate && editingOriginalDate.full)
            ? editingOriginalDate
            : ((typeof window.editingOriginalDate !== 'undefined' && window.editingOriginalDate && window.editingOriginalDate.full) ? window.editingOriginalDate : null);

        const inputDateVal = document.getElementById('adjDate')?.value;
        const isDateManuallyChanged = (isEditing || isEditMode) && origDt && origDt.iso && inputDateVal && (inputDateVal !== origDt.iso);

        const dt = ((isEditing || isEditMode) && origDt && !isDateManuallyChanged)
            ? origDt
            : (typeof getTransactionDateTime === 'function' ? getTransactionDateTime('adjDate', 'adjTime') : { full: new Date().toLocaleString('ar-EG'), iso: new Date().toISOString(), time: '' });

        const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';

        const itemsToProcess = [...(window.adjCart || [])];
        window.adjCart = []; // تفريغ فوري لمنع المعالجة المكررة

        const affectedProducts = [];
        itemsToProcess.forEach(item => {
            const p = productsDB.find(x => x.id === item.id || x.name === item.name);
            if (p) {
                if (!affectedProducts.includes(p)) affectedProducts.push(p);
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
                    // مزامنة رصيد الصنف الأساسي ورصيد المخزن مع مجموع التشكيلات بدقة تامة
                    p.stock = p.variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
                    p.warehouseStocks[activeWH] = p.variants.reduce((sum, v) => {
                        const vWhStock = (v.warehouseStocks && v.warehouseStocks[activeWH] !== undefined)
                            ? parseFloat(v.warehouseStocks[activeWH])
                            : (activeWH === 'المخزن الرئيسي' ? (parseFloat(v.stock) || 0) : 0);
                        return sum + (isNaN(vWhStock) ? 0 : vWhStock);
                    }, 0);
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

        const newAdjRows = transactions.filter(t => String(t.invoiceId) === String(adjId));
        if (typeof window.saveTransactionChanges === 'function') {
            await window.saveTransactionChanges({
                newTransactions: newAdjRows,
                modifiedProducts: affectedProducts,
                modifiedAccounts: []
            });
        } else if (typeof saveData === 'function') {
            await saveData();
        }

        if (!isEditing && !isEditMode && typeof window.updateLastSavedSequence === 'function') {
            window.updateLastSavedSequence('تسوية', adjId);
        }

        // إبطال كاش الأرصدة وحركات المخزون لضمان انعكاس التسوية فوراً في أرصدة المخازن وحركة الصنف
        if (typeof invalidateStockCache === 'function') invalidateStockCache();
        if (typeof window.invalidateStockCache === 'function') window.invalidateStockCache();

        if (typeof renderInventoryTable === 'function') renderInventoryTable();
        if (typeof renderWarehouseReportTable === 'function') renderWarehouseReportTable();
        if (typeof renderHistoryTable === 'function') renderHistoryTable();
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();

        alert("✅ تم الحفظ بنجاح!!");

        if (typeof isEditMode !== 'undefined') { isEditMode = false; window.isEditMode = false; }
        if (typeof editingInvoiceId !== 'undefined') { editingInvoiceId = null; window.editingInvoiceId = null; }
        if (typeof editingOriginalDate !== 'undefined') { editingOriginalDate = null; window.editingOriginalDate = null; }

        resetAdjustment();
        if (typeof window.clearRevertedInvoiceBackup === 'function') {
            window.clearRevertedInvoiceBackup();
        }

        return true;
    } catch (err) {
        console.error("❌ خطأ أثناء حفظ التسوية المخزنية:", err);
        if (isEditing && typeof window.rollbackLastRevertedInvoice === 'function') {
            await window.rollbackLastRevertedInvoice();
        }
        if (itemsToProcess && itemsToProcess.length > 0) {
            window.adjCart = itemsToProcess;
            if (typeof renderAdjustmentCart === 'function') renderAdjustmentCart();
        }
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'error',
                titleText: isEditing ? '⚠️ تعذر حفظ التعديل' : 'خطأ في الحفظ',
                msg: isEditing 
                    ? ('حدث خطأ أثناء حفظ التعديل، وتم الحفاظ على حركة التسوية الأصلية واستعادتها بالكامل دون أي فقدان للبيانات.\n\nتفاصيل الخطأ: ' + (err?.message || err))
                    : 'حدث خطأ غير متوقع أثناء حفظ التسوية المخزنية. تم الاحتفاظ بالأصناف في القائمة، يرجى المحاولة مرة أخرى.'
            });
        } else {
            alert('❌ حدث خطأ أثناء محاولة حفظ التسوية المخزنية. تم الاحتفاظ بالأصناف.');
        }
        return false;
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
    if (discInput.disabled) {
        if (typeof showToast === 'function') showToast("🔒 الخصم غير مصرح به لهذا الحساب!", "warning");
        return;
    }
    let currentTotal = parseFloat(totalEl.innerText || totalEl.value) || 0;
    let fraction = currentTotal - Math.floor(currentTotal);

    if (fraction > 0) {
        if (discTypeEl) {
            if ([...discTypeEl.options].some(o => o.value === 'val')) {
                discTypeEl.value = 'val';
            } else if ([...discTypeEl.options].some(o => o.value === 'fixed')) {
                discTypeEl.value = 'fixed';
            }
        }

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
// ============================================================
// 🏷️ المنصة الشاملة لتسعير وتكاليف الملابس والتشكيلات (Fashion & Price Management)
// ============================================================
function openPriceAdjustmentModal() {
    try {
        if (typeof currentUser !== 'undefined' && currentUser && typeof checkPermission === 'function' && !checkPermission('stock_edit')) return;

        const modal = document.getElementById('priceAdjustmentModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.setProperty('display', 'flex', 'important');
        }

        const allProds = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []);

        const catSelect = document.getElementById('priceAdjCategory');
        if (catSelect) {
            catSelect.innerHTML = '<option value="all">📁 كافة الأقسام</option>';
            const cats = [...new Set(allProds.map(p => p.category).filter(c => c))];
            cats.forEach(c => {
                catSelect.innerHTML += `<option value="${c}">${c}</option>`;
            });
            catSelect.value = 'all';
        }

        const typeSelect = document.getElementById('priceAdjTypeFilter');
        if (typeSelect) typeSelect.value = 'all';

        const stockSelect = document.getElementById('priceAdjStockFilter');
        if (stockSelect) stockSelect.value = 'all';

        // فلتر المقاسات التفاعلي
        const sizeSelect = document.getElementById('priceAdjSizeFilter');
        if (sizeSelect) {
            sizeSelect.innerHTML = '<option value="all">📏 كافة المقاسات</option>';
            const allSizes = new Set();
            allProds.forEach(p => {
                if (p.variants && Array.isArray(p.variants)) {
                    p.variants.forEach(v => {
                        if (v.size && String(v.size).trim() && String(v.size).trim() !== '-') {
                            allSizes.add(String(v.size).trim());
                        }
                    });
                }
            });
            [...allSizes].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).forEach(sz => {
                sizeSelect.innerHTML += `<option value="${sz}">${sz}</option>`;
            });
            sizeSelect.value = 'all';
        }

        // فلتر الألوان التفاعلي
        const colorSelect = document.getElementById('priceAdjColorFilter');
        if (colorSelect) {
            colorSelect.innerHTML = '<option value="all">🎨 كافة الألوان</option>';
            const allColors = new Set();
            allProds.forEach(p => {
                if (p.variants && Array.isArray(p.variants)) {
                    p.variants.forEach(v => {
                        if (v.color && String(v.color).trim() && String(v.color).trim() !== 'افتراضي') {
                            allColors.add(String(v.color).trim());
                        }
                    });
                }
            });
            [...allColors].sort().forEach(col => {
                colorSelect.innerHTML += `<option value="${col}">${col}</option>`;
            });
            colorSelect.value = 'all';
        }

        const selectedIds = Array.from(window.selectedInventoryIds || []);
        loadPriceAdjustmentData(selectedIds);

        if (document.getElementById('priceAdjBulkPercent')) {
            document.getElementById('priceAdjBulkPercent').value = '0';
        }

        window.priceAdjUndoStack = [];
        if (typeof updateUndoButtonState === 'function') updateUndoButtonState();

        if (!window._priceAdjUndoKeyAttached) {
            window._priceAdjUndoKeyAttached = true;
            document.addEventListener('keydown', (e) => {
                const modal = document.getElementById('priceAdjustmentModal');
                if (!modal || modal.classList.contains('hidden') || modal.style.display === 'none') return;
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
                    if (activeTag === 'input' || activeTag === 'textarea') return;
                    e.preventDefault();
                    if (typeof undoLastPriceAdjustment === 'function') undoLastPriceAdjustment();
                }
            });
        }

        if (typeof applyPriceAdjColumnVisibility === 'function') {
            setTimeout(applyPriceAdjColumnVisibility, 100);
        }
    } catch (err) {
        console.error("خطأ أثناء فتح منصة تعديل الأسعار:", err);
        if (typeof showToast === 'function') showToast("حدث خطأ أثناء فتح منصة تعديل الأسعار: " + err.message, "error");
    }
}
window.openPriceAdjustmentModal = openPriceAdjustmentModal;

function closePriceAdjustmentModal() {
    const modal = document.getElementById('priceAdjustmentModal');
    if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        modal.classList.add('hidden');
    }
    if (typeof closeFashionVariantsPriceModal === 'function') closeFashionVariantsPriceModal();
    if (document.getElementById('priceAdjSearch')) document.getElementById('priceAdjSearch').value = '';
    if (document.getElementById('priceAdjSizeFilter')) document.getElementById('priceAdjSizeFilter').value = 'all';
    if (document.getElementById('priceAdjColorFilter')) document.getElementById('priceAdjColorFilter').value = 'all';
    if (document.getElementById('priceAdjBulkPercent')) document.getElementById('priceAdjBulkPercent').value = '0';
    window.priceAdjData = [];
    window.priceAdjCurrentFiltered = null;
    window.priceAdjUndoStack = [];
    if (typeof updateUndoButtonState === 'function') updateUndoButtonState();
}
window.closePriceAdjustmentModal = closePriceAdjustmentModal;

window.priceAdjData = window.priceAdjData || [];
window.priceAdjCurrentFiltered = null;

function loadPriceAdjustmentData(selectedIds = []) {
    const tbody = document.getElementById('priceAdjustmentTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding:60px; font-size:1.1rem; color:#4338ca; font-weight:bold;">⏳ جاري فحص ومزامنة بيانات الموديلات والتشكيلات...</td></tr>';

    try {
        const allProds = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []);
        if (!Array.isArray(allProds) || allProds.length === 0) {
            tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding:50px; color:#ef4444; font-weight:bold;">⚠️ قاعدة بيانات الأصناف غير متوفرة حالياً، يرجى إعادة المحاولة.</td></tr>';
            return;
        }

        const searchQ = document.getElementById('priceAdjSearch') ? document.getElementById('priceAdjSearch').value.toLowerCase().trim() : '';
        const catQ = document.getElementById('priceAdjCategory') ? document.getElementById('priceAdjCategory').value : 'all';

        let targets = [];

        if (selectedIds.length > 0 && !searchQ) {
            targets = allProds.filter(p => selectedIds.includes(p.id));
        } else if (searchQ.length > 0 || catQ !== 'all') {
            targets = allProds.filter(p => {
                const nameMatch = String(p.name || '').toLowerCase().includes(searchQ);
                const codeMatch = String(p.code || '').toLowerCase().includes(searchQ);
                const barcodeMatch = String(p.barcode || '').toLowerCase().includes(searchQ);
                let variantMatch = false;
                if (p.variants && Array.isArray(p.variants)) {
                    variantMatch = p.variants.some(v => 
                        String(v.size || '').toLowerCase().includes(searchQ) ||
                        String(v.color || '').toLowerCase().includes(searchQ) ||
                        String(v.barcode || '').toLowerCase().includes(searchQ)
                    );
                }
                const catMatch = (catQ === 'all') || (p.category === catQ);
                return (nameMatch || codeMatch || barcodeMatch || variantMatch) && catMatch;
            });
            if (targets.length > 500) targets = targets.slice(0, 500);
        } else {
            targets = allProds;
        }

        window.priceAdjData = [];

        // خريطة سريعة لآخر سعر شراء لتسريع الاستجابة
        const lastBuyMap = {};
        if (Array.isArray(transactions)) {
            for (let i = transactions.length - 1; i >= 0; i--) {
                const t = transactions[i];
                if (t.product && t.type && t.type.includes('شراء') && !t.type.includes('مرتجع')) {
                    if (lastBuyMap[t.product] === undefined) {
                        lastBuyMap[t.product] = parseFloat(t.price) || 0;
                    }
                }
            }
        }

        const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName)
            ? currentUser.warehouseName
            : ((typeof getStore === 'function' ? getStore('activeWarehouse') : localStorage.getItem('activeWarehouse')) || 'المخزن الرئيسي')).trim();

        targets.forEach(p => {
            const itemName = p.name || 'صنف غير مسمى';
            const itemCode = p.code || '';
            const itemBarcode = p.barcode || '';
            
            // حساب الرصيد الحي الفعلي للصنف في المخزن النشط
            let liveStock = 0;
            if (typeof getWarehouseStock === 'function') {
                const st = getWarehouseStock(itemName, activeWH);
                if (st !== undefined && !isNaN(st)) liveStock = Number(st);
            } else if (p.warehouseStocks && typeof p.warehouseStocks === 'object' && p.warehouseStocks[activeWH] !== undefined) {
                liveStock = parseFloat(p.warehouseStocks[activeWH]) || 0;
            } else if (activeWH === 'المخزن الرئيسي' || !p.warehouseStocks || Object.keys(p.warehouseStocks).length === 0) {
                liveStock = parseFloat(p.stock) || 0;
            }

            const liveAvgCost = parseFloat(p.cost) || 0; 
            const lastPPrice = lastBuyMap[itemName] !== undefined ? lastBuyMap[itemName] : liveAvgCost;

            // هل الصنف فاشون وله مصفوفة مقاسات وألوان؟
            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                let vStockSum = 0;
                const variantsCopy = p.variants.map((v, vIdx) => {
                    const vCost = parseFloat(v.cost) || liveAvgCost;
                    const vPrice = parseFloat(v.price) || parseFloat(p.price) || 0;
                    const vWholesale = parseFloat(v.wholesale) || parseFloat(v.wholesalePrice) || parseFloat(p.wholesale) || 0;
                    const vMinPrice = parseFloat(v.minPrice) || parseFloat(p.minPrice) || 0;
                    
                    // حساب رصيد التشكيلة الفعلي في المخزن النشط
                    let vStock = 0;
                    if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[activeWH] !== undefined) {
                        vStock = parseFloat(v.warehouseStocks[activeWH]) || 0;
                    } else if (activeWH === 'المخزن الرئيسي' || !v.warehouseStocks || Object.keys(v.warehouseStocks).length === 0) {
                        vStock = parseFloat(v.stock) || 0;
                    } else {
                        vStock = 0;
                    }
                    vStockSum += vStock;

                    return {
                        variantIndex: vIdx,
                        size: String(v.size || '').trim(),
                        color: String(v.color || '').trim(),
                        barcode: String(v.barcode || '').trim() || itemBarcode,
                        cost: vCost,
                        wholesale: vWholesale,
                        price: vPrice,
                        minPrice: vMinPrice,
                        stock: vStock
                    };
                });

                // سطر واحد فقط يمثل الموديل بالكامل
                window.priceAdjData.push({
                    id: p.id,
                    name: itemName,
                    image: p.image || null,
                    code: itemCode,
                    sysCode: p.sysCode || p.id,
                    barcode: itemBarcode,
                    category: p.category || 'عام',
                    unit: p.unit || 'قطعة',
                    lastBuyPrice: lastPPrice,
                    avgBuyPrice: liveAvgCost,
                    wholesale: parseFloat(p.wholesale) || 0,
                    retail: parseFloat(p.price) || 0,
                    minPrice: parseFloat(p.minPrice) || 0,
                    discount: parseFloat(p.discount) || 0,
                    stock: (liveStock > 0 || (p.warehouseStocks && p.warehouseStocks[activeWH] !== undefined)) ? liveStock : vStockSum,
                    hasVariants: true,
                    variantsCount: variantsCopy.length,
                    variants: variantsCopy,
                    profitMargin: (liveAvgCost > 0 && isFinite(liveAvgCost)) ? (((parseFloat(p.price) || 0) - liveAvgCost) / liveAvgCost * 100).toFixed(1) : '0.0'
                });
            } else if (p.units && Array.isArray(p.units) && p.units.length > 1) {
                // صنف وحدات متعددة
                window.priceAdjData.push({
                    id: p.id,
                    name: itemName,
                    image: p.image || null,
                    code: itemCode,
                    sysCode: p.sysCode || p.id,
                    barcode: itemBarcode,
                    category: p.category || 'عام',
                    unit: p.unit || (p.units[0] && p.units[0].unitName) || 'قطعة',
                    lastBuyPrice: lastPPrice,
                    avgBuyPrice: liveAvgCost,
                    wholesale: parseFloat(p.wholesale) || 0,
                    retail: parseFloat(p.price) || 0,
                    minPrice: parseFloat(p.minPrice) || 0,
                    discount: parseFloat(p.discount) || 0,
                    stock: liveStock,
                    hasVariants: false,
                    variantsCount: 0,
                    variants: [],
                    hasUnits: true,
                    units: p.units,
                    profitMargin: (liveAvgCost > 0 && isFinite(liveAvgCost)) ? (((parseFloat(p.price) || 0) - liveAvgCost) / liveAvgCost * 100).toFixed(1) : '0.0'
                });
            } else {
                // صنف عام مفرد قياسي
                window.priceAdjData.push({
                    id: p.id,
                    name: itemName,
                    image: p.image || null,
                    code: itemCode,
                    sysCode: p.sysCode || p.id,
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
                    hasVariants: false,
                    variantsCount: 0,
                    variants: [],
                    profitMargin: (liveAvgCost > 0 && isFinite(liveAvgCost)) ? (((parseFloat(p.price) || 0) - liveAvgCost) / liveAvgCost * 100).toFixed(1) : '0.0'
                });
            }
        });

        renderPriceAdjustmentTable();
        updatePriceAdjStats();

        if (selectedIds.length > 0 && targets.length > 0) {
            showToast(`✅ تم تحميل عدد (${targets.length}) موديل وصنف للأسعار`, 'success');
        }
    } catch (err) {
        console.error("Price Adjustment Data Load Error:", err);
        tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:50px; color:#ef4444; font-weight:bold;">❌ حدث خطأ أثناء المعالجة: ${err.message}</td></tr>`;
    }
}

function renderPriceAdjustmentTable(filteredData = null) {
    const tbody = document.getElementById('priceAdjustmentTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const dataToRender = filteredData || window.priceAdjData;

    if (!dataToRender || dataToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding:60px; color:#64748b; font-size:1.1rem; font-weight:800;">ℹ️ لا توجد موديلات أو أصناف مطابقة للبحث أو الفلتر الحالي.</td></tr>';
        if (document.getElementById('priceAdjCount')) document.getElementById('priceAdjCount').innerText = '0';
        if (document.getElementById('priceAdjVariantsCount')) document.getElementById('priceAdjVariantsCount').innerText = '0';
        return;
    }

    let htmlBuffer = [];
    dataToRender.forEach((p, renderIndex) => {
        const originalIndex = window.priceAdjData.indexOf(p);
        const costVal = parseFloat(p.avgBuyPrice) || 0;
        const retailVal = parseFloat(p.retail) || 0;
        const profitVal = retailVal - costVal;
        const profitPerc = costVal > 0 ? (profitVal / costVal * 100).toFixed(1) : 0;
        const profitColor = profitPerc > 25 ? '#15803d' : (profitPerc > 10 ? '#b45309' : (profitPerc >= 0 ? '#4338ca' : '#dc2626'));
        const profitBg = profitPerc > 25 ? '#dcfce7' : (profitPerc > 10 ? '#fef3c7' : (profitPerc >= 0 ? '#e0e7ff' : '#fee2e2'));

        let fashionColumnHtml = '';
        if (p.hasVariants) {
            fashionColumnHtml = `
                <button type="button" onclick="openFashionVariantsPriceModal(${originalIndex})"
                    style="padding: 5px 12px; background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; border: none; border-radius: 8px; font-weight: 900; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(79,70,229,0.3); transition: 0.2s;"
                    onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                    👗 مقاسات وألوان (${p.variantsCount}) ⚡
                </button>
            `;
        } else {
            fashionColumnHtml = `
                <span style="display: inline-flex; align-items: center; gap: 4px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.78rem;">
                    📦 صنف قياسي
                </span>
            `;
        }

        htmlBuffer.push(`
            <tr style="background: #ffffff; border-bottom: 1px solid #e2e8f0; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc';" onmouseout="this.style.background='#ffffff';" data-orig-idx="${originalIndex}">
                <td class="col-adj-1" style="text-align:center; font-weight:bold; color:#64748b; padding:8px 4px; border-right: ${p.hasVariants ? '3px solid #6366f1' : '1px solid #e2e8f0'};">
                    ${renderIndex + 1}
                </td>
                <td class="col-adj-image" style="text-align:center; padding: 6px 8px; width: 145px; min-width: 140px;">
                    ${p.image ? `
                        <div style="display:inline-flex; align-items:center; justify-content:center;">
                            <img src="${p.image}" alt="${(p.name || '').replace(/"/g, '&quot;')}" 
                                 style="width: 88px; height: 88px; object-fit: cover; border-radius: 10px; border: 2px solid #cbd5e1; box-shadow: 0 3px 8px rgba(0,0,0,0.14); cursor: pointer; transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s; vertical-align: middle;" 
                                 onmouseover="this.style.transform='scale(1.15)'; this.style.borderColor='#6366f1'; this.style.boxShadow='0 6px 16px rgba(99,102,241,0.35)';" 
                                 onmouseout="this.style.transform='scale(1)'; this.style.borderColor='#cbd5e1'; this.style.boxShadow='0 3px 8px rgba(0,0,0,0.14)';"
                                 onclick="event.stopPropagation(); if(typeof window.openProductImagePreview==='function') window.openProductImagePreview(${p.id}, event);"
                                 title="🔍 اضغط لتكبير ومعاينة صورة الموديل">
                        </div>
                    ` : `
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 82px; height: 82px; border-radius: 10px; background: #f8fafc; border: 2px dashed #cbd5e1; color: #94a3b8; font-size: 2.3rem; user-select: none;" title="لا توجد صورة لهذا الموديل">
                            👗
                        </span>
                    `}
                </td>
                <td class="col-adj-internal" style="text-align:center; font-weight:bold; color:#64748b; font-size:0.82rem;">
                    ${p.sysCode || p.id}
                </td>
                <td class="col-adj-2" style="font-weight:900; color:#4338ca; text-align:center; font-size:0.82rem;">
                    ${p.code || '-'}
                </td>
                <td class="col-adj-3" style="font-weight:800; color:#0f172a; padding:6px 12px; font-size:0.92rem;">
                    <span>${p.name}</span>
                </td>
                <td class="col-adj-fashion" style="text-align:center; padding:4px 6px;">
                    ${fashionColumnHtml}
                </td>
                <td class="col-adj-4" style="text-align:center; padding:4px;">
                    <span style="display:inline-block; padding:3px 8px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; font-family:monospace; font-weight:800; font-size:0.82rem; color:#475569; user-select:all;" title="الباركود ثابت من كارت الصنف">
                        ${p.barcode || '-'}
                    </span>
                </td>
                <td class="col-adj-6" style="font-size:0.82rem; text-align:center; font-weight:800; color:#475569;">
                    ${p.unit || 'قطعة'}
                </td>
                <td class="col-adj-12" style="text-align:center; padding:4px;">
                    <div style="display:inline-flex; align-items:center; justify-content:center; gap:4px; width:95%; height:32px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:6px; font-weight:900; color:#64748b; font-size:0.88rem; cursor:not-allowed;" title="متوسط التكلفة محسوب تلقائياً من فواتير الشراء (للقراءة فقط لمنع الأخطاء)">
                        <span style="font-size:0.75rem; opacity:0.6;">🔒</span>
                        <span>${Number(p.avgBuyPrice || 0).toFixed(2)}</span>
                    </div>
                </td>
                <td class="col-adj-11" style="text-align:center; font-weight:bold; color:#991b1b; font-size:0.84rem; background:rgba(254,226,226,0.2);">
                    ${p.lastBuyPrice ? p.lastBuyPrice.toFixed(2) : '0.00'}
                </td>
                <td class="col-adj-13" style="text-align:center; padding:4px;">
                    <input type="number" data-field="wholesale" data-row="${renderIndex}" step="0.5" value="${p.wholesale}" 
                        style="width:95%; height:32px; border:1.5px solid #c7d2fe; border-radius:6px; text-align:center; font-weight:900; color:#3730a3; background:#eef2ff; font-size:0.88rem;"
                        onchange="updateRowPriceAdj(${originalIndex}, 'wholesale', this.value)"
                        onkeydown="handlePriceAdjKeyNav(event, this)">
                </td>
                <td class="col-adj-10" style="text-align:center; padding:4px;">
                    <input type="number" data-field="retail" data-row="${renderIndex}" step="0.5" value="${p.retail}" 
                        style="width:95%; height:32px; border:1.5px solid #bae6fd; border-radius:6px; text-align:center; font-weight:900; color:#0369a1; background:#f0f9ff; font-size:0.92rem;"
                        onchange="updateRowPriceAdj(${originalIndex}, 'retail', this.value)"
                        onkeydown="handlePriceAdjKeyNav(event, this)">
                </td>
                <td class="col-adj-profit" style="padding:4px; text-align:center;">
                    <span class="profit-badge" style="display:inline-block; padding:3px 8px; border-radius:6px; font-weight:900; font-size:0.82rem; color:${profitColor}; background:${profitBg};">
                        ${profitPerc}%
                    </span>
                </td>
                <td class="col-adj-min" style="text-align:center; padding:4px;">
                    <input type="number" data-field="minPrice" data-row="${renderIndex}" step="0.5" value="${p.minPrice}" 
                        style="width:95%; height:32px; border:1px solid #cbd5e1; border-radius:6px; text-align:center; font-weight:800; color:#64748b; background:white; font-size:0.85rem;"
                        onchange="updateRowPriceAdj(${originalIndex}, 'minPrice', this.value)"
                        onkeydown="handlePriceAdjKeyNav(event, this)">
                </td>
                <td class="col-adj-9" style="text-align:center; font-weight:900; color:${p.stock > 0 ? '#15803d' : '#dc2626'}; background:rgba(241,245,249,0.5); font-size:0.88rem;">
                    ${Number(p.stock || 0).toFixed(2).replace(/\.00$/, '')}
                </td>
            </tr>
        `);
    });

    tbody.innerHTML = htmlBuffer.join('');

    if (typeof applyPriceAdjColumnVisibility === 'function') {
        applyPriceAdjColumnVisibility();
    }
}

function handlePriceAdjKeyNav(e, input) {
    if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
        const currentRow = parseInt(input.getAttribute('data-row'));
        const currentField = input.getAttribute('data-field');
        const nextInput = document.querySelector(`input[data-field="${currentField}"][data-row="${currentRow + 1}"]`);
        if (nextInput) {
            nextInput.focus();
            if (typeof nextInput.select === 'function') nextInput.select();
        }
    }
}
window.handlePriceAdjKeyNav = handlePriceAdjKeyNav;

async function updateRowPriceAdj(adjIndex, field, value) {
    if (field === 'avgBuyPrice') return; // 🔒 حماية مطلقة: متوسط التكلفة للقراءة فقط ويتحدث آلياً من فواتير الشراء
    const item = window.priceAdjData[adjIndex];
    if (!item) return;

    let newValue = value;
    if (field === 'barcode') {
        item.barcode = String(value || '').trim();
    } else {
        newValue = parseFloat(value) || 0;
        item[field] = newValue;

        if (field === 'retail' || field === 'avgBuyPrice') {
            item.profitMargin = item.avgBuyPrice > 0 ? (((item.retail - item.avgBuyPrice) / item.avgBuyPrice) * 100).toFixed(1) : '0.0';
        }
    }

    // تحديث شارة الربح في السطر الحالي مباشرة بدون هدم وإعادة بناء الجدول
    const costVal = parseFloat(item.avgBuyPrice) || 0;
    const retailVal = parseFloat(item.retail) || 0;
    const profitVal = retailVal - costVal;
    const profitPerc = costVal > 0 ? (profitVal / costVal * 100).toFixed(1) : 0;
    const profitColor = profitPerc > 25 ? '#15803d' : (profitPerc > 10 ? '#b45309' : (profitPerc >= 0 ? '#4338ca' : '#dc2626'));
    const profitBg = profitPerc > 25 ? '#dcfce7' : (profitPerc > 10 ? '#fef3c7' : (profitPerc >= 0 ? '#e0e7ff' : '#fee2e2'));

    const currentTr = document.querySelector(`tr[data-orig-idx="${adjIndex}"]`);
    if (currentTr) {
        const pBadge = currentTr.querySelector('.profit-badge');
        if (pBadge) {
            pBadge.innerText = `${profitPerc}%`;
            pBadge.style.color = profitColor;
            pBadge.style.background = profitBg;
        }
    }

    // إذا كان الموديل يحتوي على مقاسات وألوان، نحدث كافة التشكيلات التابعة له
    if (item.hasVariants && Array.isArray(item.variants) && field !== 'barcode') {
        item.variants.forEach(v => {
            if (field === 'retail') v.price = newValue;
            else if (field === 'wholesale') v.wholesale = newValue;
            else if (field === 'avgBuyPrice') v.cost = newValue;
            else if (field === 'minPrice') v.minPrice = newValue;
        });
    }

    updatePriceAdjStats();

    // حفظ لحظي في قاعدة بيانات IndexedDB
    try {
        let pInDB = null;
        if (item.id !== undefined && item.id !== null) {
            pInDB = await db.products.get(item.id);
            if (!pInDB && !isNaN(Number(item.id))) {
                pInDB = await db.products.get(Number(item.id));
            }
        }
        if (!pInDB && item.code) {
            pInDB = await db.products.where('code').equals(item.code).first();
        }
        if (!pInDB && Array.isArray(productsDB)) {
            pInDB = productsDB.find(x => (item.id && String(x.id) === String(item.id)) || (item.code && x.code === item.code));
        }

        if (pInDB) {
            if (field === 'barcode') {
                pInDB.barcode = item.barcode;
            } else {
                const numVal = parseFloat(value) || 0;
                if (field === 'retail') pInDB.price = numVal;
                else if (field === 'wholesale') pInDB.wholesale = numVal;
                else if (field === 'avgBuyPrice') pInDB.cost = numVal;
                else if (field === 'minPrice') pInDB.minPrice = numVal;

                if (Array.isArray(pInDB.variants)) {
                    pInDB.variants.forEach(v => {
                        if (field === 'retail') v.price = numVal;
                        else if (field === 'wholesale') v.wholesale = numVal;
                        else if (field === 'avgBuyPrice') v.cost = numVal;
                        else if (field === 'minPrice') v.minPrice = numVal;
                    });
                }
            }

            pInDB.updatedAt = new Date().toISOString();
            await db.products.put(pInDB);
            if (Array.isArray(productsDB)) {
                const memIdx = productsDB.findIndex(x => String(x.id) === String(item.id) || (item.code && x.code === item.code));
                if (memIdx !== -1) productsDB[memIdx] = pInDB;
            }
        }
    } catch (err) {
        console.error("Auto-save failed in updateRowPriceAdj:", err);
    }
}

// ============================================================
// 👗 نافذة مصفوفة المقاسات والألوان المنبثقة (Fashion Variant Price Modal)
// ============================================================
window.activeFashionModalIndex = null;
window.activeFashionItem = null;
window.fvpCurrentPriceMode = 'price'; // 'price' | 'wholesale' | 'cost' | 'minPrice'
window.fvpCurrentColorFilter = 'all';
window.fvpCurrentSizeFilter = 'all';

function setFvpMatrixPriceMode(mode) {
    window.fvpCurrentPriceMode = mode || 'price';
    const modes = [
        { id: 'price', bg: '#0284c7', text: '#ffffff', shadow: 'rgba(2,132,199,0.35)' },
        { id: 'wholesale', bg: '#4f46e5', text: '#ffffff', shadow: 'rgba(79,70,229,0.35)' },
        { id: 'cost', bg: '#475569', text: '#ffffff', shadow: 'rgba(71,85,105,0.35)' },
        { id: 'minPrice', bg: '#e11d48', text: '#ffffff', shadow: 'rgba(225,29,72,0.35)' }
    ];

    modes.forEach(m => {
        const btn = document.getElementById(`fvpPriceMode_${m.id}`);
        if (!btn) return;
        if (m.id === window.fvpCurrentPriceMode) {
            btn.style.background = m.bg;
            btn.style.color = m.text;
            btn.style.boxShadow = `0 2px 5px ${m.shadow}`;
        } else {
            btn.style.background = 'transparent';
            btn.style.color = '#475569';
            btn.style.boxShadow = 'none';
        }
    });

    if (window.activeFashionItem) {
        renderFvpMatrixGrid(window.activeFashionItem);
    }
}
window.setFvpMatrixPriceMode = setFvpMatrixPriceMode;

function initFvpModalFilters(item) {
    window.fvpCurrentColorFilter = 'all';
    window.fvpCurrentSizeFilter = 'all';

    const colorSelect = document.getElementById('fvpModalColorFilter');
    const sizeSelect = document.getElementById('fvpModalSizeFilter');
    const badge = document.getElementById('fvpFilteredBadge');
    if (badge) badge.style.display = 'none';

    if (!item || !Array.isArray(item.variants)) return;

    const colors = [...new Set(item.variants.map(v => (v.color || 'عام').trim()))].filter(Boolean);
    const sizes = [...new Set(item.variants.map(v => (v.size || '-').trim()))].filter(Boolean);

    if (colorSelect) {
        colorSelect.innerHTML = `<option value="all">🎨 كافة الألوان (${colors.length})</option>` +
            colors.map(c => `<option value="${c}">🎨 ${c}</option>`).join('');
        colorSelect.value = 'all';
    }

    if (sizeSelect) {
        sizeSelect.innerHTML = `<option value="all">📏 كافة المقاسات (${sizes.length})</option>` +
            sizes.map(s => `<option value="${s}">📏 ${s}</option>`).join('');
        sizeSelect.value = 'all';
    }
}
window.initFvpModalFilters = initFvpModalFilters;

function handleFvpModalFilterChange() {
    const colorSelect = document.getElementById('fvpModalColorFilter');
    const sizeSelect = document.getElementById('fvpModalSizeFilter');
    const badge = document.getElementById('fvpFilteredBadge');

    window.fvpCurrentColorFilter = colorSelect ? colorSelect.value : 'all';
    window.fvpCurrentSizeFilter = sizeSelect ? sizeSelect.value : 'all';

    const isFiltered = (window.fvpCurrentColorFilter !== 'all' || window.fvpCurrentSizeFilter !== 'all');
    if (badge) {
        if (isFiltered) {
            badge.style.display = 'inline-block';
            let label = 'فلترة: ';
            if (window.fvpCurrentColorFilter !== 'all') label += `اللون (${window.fvpCurrentColorFilter}) `;
            if (window.fvpCurrentSizeFilter !== 'all') label += `المقاس (${window.fvpCurrentSizeFilter})`;
            badge.innerText = label;
        } else {
            badge.style.display = 'none';
        }
    }

    if (window.activeFashionItem) {
        renderFvpListTable(window.activeFashionItem);
        renderFvpMatrixGrid(window.activeFashionItem);
    }
}
window.handleFvpModalFilterChange = handleFvpModalFilterChange;

function resetFvpModalFilters() {
    const colorSelect = document.getElementById('fvpModalColorFilter');
    const sizeSelect = document.getElementById('fvpModalSizeFilter');
    if (colorSelect) colorSelect.value = 'all';
    if (sizeSelect) sizeSelect.value = 'all';
    handleFvpModalFilterChange();
}
window.resetFvpModalFilters = resetFvpModalFilters;

function openFashionVariantsPriceModal(itemIndex) {
    const item = (window.priceAdjData && window.priceAdjData[itemIndex]) 
        ? window.priceAdjData[itemIndex] 
        : (window.priceAdjCurrentFiltered ? window.priceAdjCurrentFiltered[itemIndex] : null);
    if (!item || !item.hasVariants || !Array.isArray(item.variants) || item.variants.length === 0) {
        if (typeof showToast === 'function') showToast("⚠️ هذا الصنف ليس له تشكيلات مقاسات وألوان", "warning");
        return;
    }

    window.activeFashionModalIndex = itemIndex;
    window.activeFashionItem = item;

    const modal = document.getElementById('fashionVariantPriceModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
    }

    const nameEl = document.getElementById('fvpModelName');
    if (nameEl) nameEl.innerText = item.name || '-';

    const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName)
        ? currentUser.warehouseName
        : ((typeof getStore === 'function' ? getStore('activeWarehouse') : localStorage.getItem('activeWarehouse')) || 'المخزن الرئيسي')).trim();

    const codeEl = document.getElementById('fvpModelCode');
    if (codeEl) {
        const parts = [];
        if (item.code) parts.push(`كود: ${item.code}`);
        if (item.barcode) parts.push(`باركود: ${item.barcode}`);
        parts.push(`المخزن: [${activeWH}]`);
        codeEl.innerText = parts.join(' | ');
    }

    // تعبئة حقول التسعير الموحد الافتراضية
    const defRetail = document.getElementById('fvpUniformRetail');
    const defWholesale = document.getElementById('fvpUniformWholesale');
    const defCost = document.getElementById('fvpUniformCost');
    if (defRetail) defRetail.value = item.retail || '';
    if (defWholesale) defWholesale.value = item.wholesale || '';
    if (defCost) defCost.value = item.avgBuyPrice || '';

    let totStock = 0;
    item.variants.forEach(v => { totStock += (parseFloat(v.stock) || 0); });
    const totStockEl = document.getElementById('fvpTotalStockCount');
    if (totStockEl) totStockEl.innerText = totStock;

    // تهيئة الفلاتر ومود الأسعار بالمصفوفة
    initFvpModalFilters(item);
    setFvpMatrixPriceMode('price');

    renderFvpListTable(item);
    renderFvpMatrixGrid(item);
    switchFvpTab('list');
}
window.openFashionVariantsPriceModal = openFashionVariantsPriceModal;

function closeFashionVariantsPriceModal() {
    const modal = document.getElementById('fashionVariantPriceModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
    window.activeFashionModalIndex = null;
    window.activeFashionItem = null;
}
window.closeFashionVariantsPriceModal = closeFashionVariantsPriceModal;

function switchFvpTab(tabName) {
    const listView = document.getElementById('fvpListView');
    const matrixView = document.getElementById('fvpMatrixView');
    const listBtn = document.getElementById('fvpTabListBtn');
    const matrixBtn = document.getElementById('fvpTabMatrixBtn');

    if (tabName === 'matrix') {
        if (window.activeFashionItem) renderFvpMatrixGrid(window.activeFashionItem);
        if (listView) listView.style.display = 'none';
        if (matrixView) matrixView.style.display = 'block';
        if (matrixBtn) {
            matrixBtn.style.background = '#ffffff';
            matrixBtn.style.color = '#312e81';
            matrixBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';
        }
        if (listBtn) {
            listBtn.style.background = 'transparent';
            listBtn.style.color = '#64748b';
            listBtn.style.boxShadow = 'none';
        }
    } else {
        if (window.activeFashionItem) renderFvpListTable(window.activeFashionItem);
        if (listView) listView.style.display = 'block';
        if (matrixView) matrixView.style.display = 'none';
        if (listBtn) {
            listBtn.style.background = '#ffffff';
            listBtn.style.color = '#312e81';
            listBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';
        }
        if (matrixBtn) {
            matrixBtn.style.background = 'transparent';
            matrixBtn.style.color = '#64748b';
            matrixBtn.style.boxShadow = 'none';
        }
    }
}
window.switchFvpTab = switchFvpTab;

function renderFvpListTable(item) {
    const tbody = document.getElementById('fvpTableBody');
    if (!tbody || !item || !item.variants) return;
    tbody.innerHTML = '';

    const colorFilter = window.fvpCurrentColorFilter || 'all';
    const sizeFilter = window.fvpCurrentSizeFilter || 'all';

    let html = '';
    let visibleCount = 0;

    item.variants.forEach((v, idx) => {
        const vCol = (v.color || 'عام').trim();
        const vSz = (v.size || '-').trim();

        if (colorFilter !== 'all' && vCol !== colorFilter) return;
        if (sizeFilter !== 'all' && vSz !== sizeFilter) return;

        visibleCount++;
        const vCost = parseFloat(v.cost) || 0;
        const vPrice = parseFloat(v.price) || 0;
        const profitVal = vPrice - vCost;
        const profitPerc = vCost > 0 ? (profitVal / vCost * 100).toFixed(1) : '0.0';
        const profitColor = profitPerc > 25 ? '#15803d' : (profitPerc > 10 ? '#b45309' : (profitPerc >= 0 ? '#4338ca' : '#dc2626'));
        const profitBg = profitPerc > 25 ? '#dcfce7' : (profitPerc > 10 ? '#fef3c7' : (profitPerc >= 0 ? '#e0e7ff' : '#fee2e2'));

        html += `
            <tr data-vidx="${idx}" style="border-bottom: 1px solid #f1f5f9; transition: 0.15s;" onmouseover="this.style.background='#f8fafc';" onmouseout="this.style.background='#ffffff';">
                <td style="text-align: center; font-weight: bold; color: #64748b; padding: 8px 4px;">${idx + 1}</td>
                <td style="text-align: center; padding: 4px;">
                    <span style="display: inline-flex; align-items: center; gap: 4px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.85rem;">
                        🎨 ${vCol}
                    </span>
                </td>
                <td style="text-align: center; padding: 4px;">
                    <span style="display: inline-flex; align-items: center; gap: 4px; background: #fdf2f8; color: #9d174d; border: 1px solid #fbcfe8; padding: 3px 10px; border-radius: 6px; font-weight: 900; font-size: 0.85rem;">
                        📏 ${vSz}
                    </span>
                </td>
                <td style="text-align: center; padding: 4px;">
                    <span style="display: inline-block; padding: 3px 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-family: monospace; font-weight: 800; font-size: 0.82rem; color: #475569; user-select: all;" title="الباركود ثابت من كارت الصنف">
                        ${v.barcode || '-'}
                    </span>
                </td>
                <td style="text-align: center; padding: 4px;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 95%; height: 32px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 6px; font-weight: 900; color: #64748b; font-size: 0.88rem; cursor: not-allowed;" title="سعر التكلفة محدد آلياً من فواتير الشراء (للقراءة فقط)">
                        <span style="font-size: 0.75rem; opacity: 0.6;">🔒</span>
                        <span>${Number(v.cost || 0).toFixed(2)}</span>
                    </div>
                </td>
                <td style="text-align: center; padding: 4px;">
                    <input type="number" step="0.5" value="${v.wholesale}" data-field="wholesale" data-vidx="${idx}"
                        style="width: 95%; height: 32px; border: 1.5px solid #c7d2fe; border-radius: 6px; text-align: center; font-weight: 900; color: #3730a3; background: #eef2ff; font-size: 0.88rem;"
                        onchange="updateSingleVariantPrice(${idx}, 'wholesale', this.value)"
                        onkeydown="handleFvpKeyNav(event, this)">
                </td>
                <td style="text-align: center; padding: 4px;">
                    <input type="number" step="0.5" value="${v.price}" data-field="price" data-vidx="${idx}"
                        style="width: 95%; height: 32px; border: 1.5px solid #bae6fd; border-radius: 6px; text-align: center; font-weight: 900; color: #0369a1; background: #f0f9ff; font-size: 0.92rem;"
                        onchange="updateSingleVariantPrice(${idx}, 'price', this.value)"
                        onkeydown="handleFvpKeyNav(event, this)">
                </td>
                <td style="text-align: center; padding: 4px;">
                    <span class="fvp-profit-badge" style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-weight: 900; font-size: 0.82rem; color: ${profitColor}; background: ${profitBg};">
                        ${profitPerc}%
                    </span>
                </td>
                <td style="text-align: center; padding: 4px;">
                    <input type="number" step="0.5" value="${v.minPrice || 0}" data-field="minPrice" data-vidx="${idx}"
                        style="width: 95%; height: 32px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center; font-weight: 800; color: #64748b; font-size: 0.85rem;"
                        onchange="updateSingleVariantPrice(${idx}, 'minPrice', this.value)"
                        onkeydown="handleFvpKeyNav(event, this)">
                </td>
                <td style="text-align: center; font-weight: 900; color: ${v.stock > 0 ? '#15803d' : '#dc2626'}; font-size: 0.88rem;">
                    ${v.stock || 0}
                </td>
            </tr>
        `;
    });

    if (visibleCount === 0) {
        html = `<tr><td colspan="10" style="text-align: center; padding: 30px; color: #94a3b8; font-weight: 800;">لا توجد تشكيلات مطابقة للفلاتر المختارة</td></tr>`;
    }

    tbody.innerHTML = html;

    const totVariantsEl = document.getElementById('fvpTotalVariantsCount');
    if (totVariantsEl) {
        if (visibleCount < item.variants.length) {
            totVariantsEl.innerHTML = `<span style="color:#2563eb;">${visibleCount}</span> <span style="font-size:0.75rem; color:#64748b;">(من أصل ${item.variants.length})</span>`;
        } else {
            totVariantsEl.innerText = item.variants.length;
        }
    }
}

function handleFvpKeyNav(e, input) {
    if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
        const currentVidx = parseInt(input.getAttribute('data-vidx'));
        const currentField = input.getAttribute('data-field');
        const nextInput = document.querySelector(`#fvpTableBody input[data-field="${currentField}"][data-vidx="${currentVidx + 1}"]`);
        if (nextInput) {
            nextInput.focus();
            if (typeof nextInput.select === 'function') nextInput.select();
        }
    }
}
window.handleFvpKeyNav = handleFvpKeyNav;

function renderFvpMatrixGrid(item) {
    const container = document.getElementById('fvpMatrixContainer');
    if (!container || !item || !item.variants) return;

    container.style.maxHeight = '65vh';
    container.style.overflow = 'auto';

    const colorFilter = window.fvpCurrentColorFilter || 'all';
    const sizeFilter = window.fvpCurrentSizeFilter || 'all';
    const mode = window.fvpCurrentPriceMode || 'price';

    // استخراج الألوان والمقاسات حسب الفلاتر النشطة
    let allColors = [...new Set(item.variants.map(v => (v.color || 'افتراضي').trim()))];
    let allSizes = [...new Set(item.variants.map(v => (v.size || '-').trim()))];

    let colors = (colorFilter !== 'all') ? allColors.filter(c => c === colorFilter) : allColors;
    let sizes = (sizeFilter !== 'all') ? allSizes.filter(s => s === sizeFilter) : allSizes;

    if (colors.length === 0) colors = allColors;
    if (sizes.length === 0) sizes = allSizes;

    // خصائص الأنماط بحسب نوع السعر النشط
    const modeMeta = {
        price: { title: 'سعر القطاعي', border: '#38bdf8', bg: '#f0f9ff', text: '#0369a1' },
        wholesale: { title: 'سعر الجملة', border: '#818cf8', bg: '#eef2ff', text: '#3730a3' },
        cost: { title: 'سعر التكلفة (للقراءة فقط 🔒)', border: '#cbd5e1', bg: '#f8fafc', text: '#475569' },
        minPrice: { title: 'أدنى سعر', border: '#f43f5e', bg: '#fff1f2', text: '#be123c' }
    }[mode] || { title: 'سعر القطاعي', border: '#38bdf8', bg: '#f0f9ff', text: '#0369a1' };

    let tableHtml = `
        <table class="invoice-table" style="width: 100%; border-collapse: separate; border-spacing: 0; min-width: 500px; border: 1.5px solid #cbd5e1; border-radius: 10px;">
            <thead style="position: sticky; top: 0; z-index: 30; background: #1e1b4b; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                <tr>
                    <th style="position: sticky; top: 0; right: 0; z-index: 40; padding: 10px 14px; text-align: center; background: #0f172a; color: #fcd34d; width: 130px; border-bottom: 2px solid #6366f1; border-left: 2px solid #cbd5e1; box-shadow: 2px 2px 5px rgba(0,0,0,0.2);">
                        <div style="font-size: 0.82rem; font-weight: 900;">🎨 اللون / 📏 المقاس</div>
                        <div style="font-size: 0.72rem; color: #a5b4fc; font-weight: 700; margin-top: 2px;">تعديل: ${modeMeta.title}</div>
                    </th>
    `;

    sizes.forEach(sz => {
        tableHtml += `<th style="position: sticky; top: 0; z-index: 30; padding: 10px 14px; text-align: center; font-size: 0.95rem; font-weight: 900; background: #1e1b4b; color: #ffffff; border-bottom: 2px solid #6366f1; border-left: 1px solid rgba(255,255,255,0.1); box-shadow: 0 2px 5px rgba(0,0,0,0.15);">${sz}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;

    colors.forEach((col, rIdx) => {
        tableHtml += `
            <tr style="background: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                <td style="position: sticky; right: 0; z-index: 20; font-weight: 900; color: #1e1b4b; background: #f1f5f9; text-align: center; padding: 8px 12px; border-left: 2px solid #cbd5e1; border-bottom: 1px solid #e2e8f0; font-size: 0.88rem; box-shadow: 2px 0 5px rgba(0,0,0,0.05); white-space: nowrap;">
                    🎨 ${col}
                </td>
        `;

        sizes.forEach(sz => {
            const foundIdx = item.variants.findIndex(v => (v.color || 'افتراضي').trim() === col && (v.size || '-').trim() === sz);
            if (foundIdx !== -1) {
                const v = item.variants[foundIdx];
                const activeVal = (v[mode] !== undefined && v[mode] !== null) ? v[mode] : 0;

                let subInfo = '';
                if (mode === 'price') {
                    subInfo = `ج: <strong style="color:#4338ca">${v.wholesale || 0}</strong> | ت: <strong style="color:#9a3412">${v.cost || 0}</strong>`;
                } else if (mode === 'wholesale') {
                    subInfo = `ق: <strong style="color:#0369a1">${v.price || 0}</strong> | ت: <strong style="color:#9a3412">${v.cost || 0}</strong>`;
                } else if (mode === 'cost') {
                    subInfo = `ق: <strong style="color:#0369a1">${v.price || 0}</strong> | ج: <strong style="color:#4338ca">${v.wholesale || 0}</strong>`;
                } else if (mode === 'minPrice') {
                    subInfo = `ق: <strong style="color:#0369a1">${v.price || 0}</strong> | ج: <strong style="color:#4338ca">${v.wholesale || 0}</strong>`;
                }

                tableHtml += `
                    <td style="text-align: center; padding: 6px 8px; border-left: 1px solid #f1f5f9; vertical-align: middle;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            ${mode === 'cost' ? `
                                <div style="width: 82px; height: 32px; border: 1.5px solid #e2e8f0; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; color: #64748b; background: #f8fafc; font-size: 0.88rem; cursor: not-allowed;" title="سعر التكلفة محدد آلياً من فواتير الشراء (للقراءة فقط)">
                                    🔒 ${Number(activeVal || 0).toFixed(2)}
                                </div>
                            ` : `
                                <input type="number" step="0.5" value="${activeVal}" data-vidx="${foundIdx}" data-field="${mode}" data-col="${col}" data-sz="${sz}"
                                    style="width: 82px; height: 32px; border: 1.5px solid ${modeMeta.border}; border-radius: 7px; text-align: center; font-weight: 900; color: ${modeMeta.text}; background: ${modeMeta.bg}; font-size: 0.92rem; outline: none; transition: 0.15s;"
                                    onfocus="this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.25)';" onblur="this.style.boxShadow='none';"
                                    onchange="updateSingleVariantPrice(${foundIdx}, '${mode}', this.value); renderFvpListTable(window.activeFashionItem);"
                                    onkeydown="handleFvpMatrixKeyNav(event, this)">
                            `}
                            <div style="font-size: 0.71rem; color: #64748b; font-weight: 700; white-space: nowrap; margin-top: 1px;">
                                ${subInfo}
                            </div>
                        </div>
                    </td>
                `;
            } else {
                tableHtml += `<td style="text-align: center; color: #cbd5e1; font-weight: bold; background: #f8fafc;">-</td>`;
            }
        });

        tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}

function handleFvpMatrixKeyNav(e, input) {
    if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
        const currentSz = input.getAttribute('data-sz');
        const currentInputs = Array.from(document.querySelectorAll('#fvpMatrixContainer input'));
        const currentIndex = currentInputs.indexOf(input);

        // الانتقال للخلية التي في نفس العمود بالسطر التالي
        const sameColInputs = currentInputs.filter(inp => inp.getAttribute('data-sz') === currentSz);
        const colIdx = sameColInputs.indexOf(input);

        if (colIdx !== -1 && colIdx + 1 < sameColInputs.length) {
            sameColInputs[colIdx + 1].focus();
            if (typeof sameColInputs[colIdx + 1].select === 'function') sameColInputs[colIdx + 1].select();
        } else if (currentIndex !== -1 && currentIndex + 1 < currentInputs.length) {
            currentInputs[currentIndex + 1].focus();
            if (typeof currentInputs[currentIndex + 1].select === 'function') currentInputs[currentIndex + 1].select();
        }
    }
}
window.handleFvpMatrixKeyNav = handleFvpMatrixKeyNav;

function updateSingleVariantPrice(vIndex, field, value) {
    if (field === 'cost') return; // 🔒 حماية مطلقة: سعر التكلفة للتشكيلة للقراءة فقط ويتحدث آلياً من فواتير الشراء
    const item = window.activeFashionItem;
    if (!item || !item.variants || !item.variants[vIndex]) return;

    if (field === 'barcode') {
        item.variants[vIndex].barcode = String(value || '').trim();
    } else {
        const numVal = parseFloat(value) || 0;
        item.variants[vIndex][field] = numVal;

        // تحديث شارة الربح في جدول التفاصيل إن وجدت
        const tr = document.querySelector(`#fvpTableBody tr[data-vidx="${vIndex}"]`);
        if (tr) {
            const v = item.variants[vIndex];
            const vCost = parseFloat(v.cost) || 0;
            const vPrice = parseFloat(v.price) || 0;
            const profitVal = vPrice - vCost;
            const profitPerc = vCost > 0 ? (profitVal / vCost * 100).toFixed(1) : '0.0';
            const profitColor = profitPerc > 25 ? '#15803d' : (profitPerc > 10 ? '#b45309' : (profitPerc >= 0 ? '#4338ca' : '#dc2626'));
            const profitBg = profitPerc > 25 ? '#dcfce7' : (profitPerc > 10 ? '#fef3c7' : (profitPerc >= 0 ? '#e0e7ff' : '#fee2e2'));

            const pBadge = tr.querySelector('.fvp-profit-badge');
            if (pBadge) {
                pBadge.innerText = `${profitPerc}%`;
                pBadge.style.color = profitColor;
                pBadge.style.background = profitBg;
            }
        }
    }
}
window.updateSingleVariantPrice = updateSingleVariantPrice;

function applyUniformVariantPrice() {
    const item = window.activeFashionItem;
    if (!item || !item.variants) return;

    const rVal = parseFloat(document.getElementById('fvpUniformRetail')?.value);
    const wVal = parseFloat(document.getElementById('fvpUniformWholesale')?.value);

    let appliedCount = 0;
    item.variants.forEach(v => {
        if (!isNaN(rVal) && rVal > 0) v.price = rVal;
        if (!isNaN(wVal) && wVal > 0) v.wholesale = wVal;
        appliedCount++;
    });

    renderFvpListTable(item);
    renderFvpMatrixGrid(item);

    if (typeof showToast === 'function') {
        showToast(`⚡ تم تطبيق السعر الموحد على (${appliedCount}) تشكيلة بنجاح`, "success");
    }
}
window.applyUniformVariantPrice = applyUniformVariantPrice;

async function saveFashionVariantsPrice() {
    const item = window.activeFashionItem;
    if (!item || !item.variants) {
        closeFashionVariantsPriceModal();
        return;
    }

    try {
        let pInDB = null;
        if (item.id !== undefined && item.id !== null) {
            pInDB = await db.products.get(item.id);
            if (!pInDB && !isNaN(Number(item.id))) {
                pInDB = await db.products.get(Number(item.id));
            }
        }
        if (!pInDB && item.code) {
            pInDB = await db.products.where('code').equals(item.code).first();
        }
        if (!pInDB && Array.isArray(productsDB)) {
            pInDB = productsDB.find(x => (item.id && String(x.id) === String(item.id)) || (item.code && x.code === item.code));
        }

        if (pInDB) {
            if (!pInDB.variants) pInDB.variants = [];
            item.variants.forEach((v, idx) => {
                const targetIdx = (v.variantIndex !== undefined && pInDB.variants[v.variantIndex]) ? v.variantIndex : idx;
                if (pInDB.variants[targetIdx]) {
                    pInDB.variants[targetIdx].price = parseFloat(v.price) || 0;
                    pInDB.variants[targetIdx].wholesale = parseFloat(v.wholesale) || 0;
                    pInDB.variants[targetIdx].cost = (pInDB.variants[targetIdx].cost !== undefined && pInDB.variants[targetIdx].cost !== null && pInDB.variants[targetIdx].cost > 0) ? pInDB.variants[targetIdx].cost : (parseFloat(v.cost) || 0);
                    pInDB.variants[targetIdx].minPrice = parseFloat(v.minPrice) || 0;
                    if (v.barcode) pInDB.variants[targetIdx].barcode = v.barcode;
                }
            });

            // تحديث سعر الصنف الأب في الذاكرة والقاعدة
            if (item.variants.length > 0) {
                pInDB.price = parseFloat(item.variants[0].price) || pInDB.price;
                pInDB.wholesale = parseFloat(item.variants[0].wholesale) || pInDB.wholesale;
                pInDB.cost = (pInDB.cost !== undefined && pInDB.cost !== null && pInDB.cost > 0) ? pInDB.cost : (parseFloat(item.variants[0].cost) || pInDB.cost || 0);
                item.retail = pInDB.price;
                item.wholesale = pInDB.wholesale;
                item.avgBuyPrice = pInDB.cost;
            }

            pInDB.updatedAt = new Date().toISOString();
            await db.products.put(pInDB);

            // تحديث المصفوفة المركزية للمنتجات في الذاكرة
            if (typeof db !== 'undefined' && db && db.products) {
                productsDB = await db.products.toArray();
                window.productsDB = productsDB;
            } else if (Array.isArray(productsDB)) {
                const mIdx = productsDB.findIndex(x => x.id === item.id);
                if (mIdx !== -1) productsDB[mIdx] = pInDB;
            }

            if (window.BayanNetworkHub && typeof window.BayanNetworkHub.onDataSaved === 'function') {
                window.BayanNetworkHub.onDataSaved();
            }

            // تحديث كائن الصنف في نافذة تعديل الأسعار الرئيسية
            if (Array.isArray(window.priceAdjData)) {
                const pIdx = window.priceAdjData.findIndex(x => x.id === item.id);
                if (pIdx !== -1) {
                    window.priceAdjData[pIdx].retail = pInDB.price;
                    window.priceAdjData[pIdx].wholesale = pInDB.wholesale;
                    window.priceAdjData[pIdx].avgBuyPrice = pInDB.cost;
                    window.priceAdjData[pIdx].variants = JSON.parse(JSON.stringify(pInDB.variants || []));
                }
            }
        }

        // إعادة تصيير جدول تعديل الأسعار الرئيسي والإحصائيات
        renderPriceAdjustmentTable(window.priceAdjCurrentFiltered);
        updatePriceAdjStats();

        // ⚡ مزامنة فورية وتسميع في كافة شاشات وأقسام النظام
        if (typeof renderInventoryTable === 'function') renderInventoryTable();
        if (typeof renderWarehouseReportTable === 'function') renderWarehouseReportTable();
        if (typeof renderProductsGrid === 'function') renderProductsGrid();
        if (typeof updateInventoryStats === 'function') updateInventoryStats();
        if (typeof updateDashboard === 'function') updateDashboard();
        if (typeof updateDatalists === 'function') updateDatalists();
        if (typeof syncFashionGrid === 'function') syncFashionGrid();
        if (typeof renderSectionInquiryGrid === 'function') renderSectionInquiryGrid();

        // إطلاق أحداث المزامنة العامة
        window.dispatchEvent(new CustomEvent('productsUpdated', { detail: { productId: item.id } }));
        window.dispatchEvent(new CustomEvent('inventoryUpdated'));

        closeFashionVariantsPriceModal();

        if (typeof showToast === 'function') {
            showToast("✅ تم حفظ وتحديث أسعار التشكيلات وتسميعها في كافة الأقسام بنجاح!", "success");
        }
    } catch (err) {
        console.error("Save fashion variants price error:", err);
        alert("❌ حدث خطأ أثناء الحفظ: " + err.message);
    }
}
window.saveFashionVariantsPrice = saveFashionVariantsPrice;

function handlePriceAdjSearch() {
    const query = document.getElementById('priceAdjSearch')?.value.toLowerCase().trim() || '';
    const cat = document.getElementById('priceAdjCategory')?.value || 'all';
    const typeFilter = document.getElementById('priceAdjTypeFilter')?.value || 'all';
    const stockFilter = document.getElementById('priceAdjStockFilter')?.value || 'all';
    const sizeFilter = document.getElementById('priceAdjSizeFilter')?.value || 'all';
    const colorFilter = document.getElementById('priceAdjColorFilter')?.value || 'all';

    const filtered = (window.priceAdjData || []).filter(p => {
        const nameMatch = (p.name || '').toLowerCase().includes(query) || 
                         (p.barcode && String(p.barcode).toLowerCase().includes(query)) ||
                         (p.code && String(p.code).toLowerCase().includes(query));

        let variantSearchMatch = false;
        if (p.hasVariants && Array.isArray(p.variants)) {
            variantSearchMatch = p.variants.some(v => 
                String(v.size || '').toLowerCase().includes(query) ||
                String(v.color || '').toLowerCase().includes(query) ||
                String(v.barcode || '').toLowerCase().includes(query)
            );
        }

        const catMatch = (cat === 'all' || p.category === cat);

        let stockMatch = true;
        if (stockFilter === 'in') stockMatch = (p.stock > 0);
        else if (stockFilter === 'out') stockMatch = (p.stock <= 0);

        let typeMatch = true;
        if (typeFilter === 'variants') {
            typeMatch = (p.hasVariants === true);
        } else if (typeFilter === 'regular') {
            typeMatch = (p.hasVariants !== true);
        }

        // فلترة المقاس واللون المتقدمة للموديلات والتشكيلات
        let sizeMatch = (sizeFilter === 'all');
        let colorMatch = (colorFilter === 'all');
        if (p.hasVariants && Array.isArray(p.variants)) {
            if (sizeFilter !== 'all') {
                sizeMatch = p.variants.some(v => String(v.size || '').trim() === sizeFilter);
            }
            if (colorFilter !== 'all') {
                colorMatch = p.variants.some(v => String(v.color || '').trim() === colorFilter);
            }
        } else {
            // صنف عادي ليس به مقاسات أو ألوان: يظهر فقط عند اختيار "كافة المقاسات" و "كافة الألوان"
            if (sizeFilter !== 'all' || colorFilter !== 'all') {
                sizeMatch = false;
                colorMatch = false;
            }
        }

        return (nameMatch || variantSearchMatch) && catMatch && stockMatch && typeMatch && sizeMatch && colorMatch;
    });

    const isFiltered = query !== '' || cat !== 'all' || stockFilter !== 'all' || typeFilter !== 'all' || sizeFilter !== 'all' || colorFilter !== 'all';
    window.priceAdjCurrentFiltered = isFiltered ? filtered : null;
    renderPriceAdjustmentTable(filtered);
    updatePriceAdjStats();
}
window.handlePriceAdjSearch = handlePriceAdjSearch;

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
        if (typeof showToast === 'function') showToast("❌ لا توجد أصناف معروضة في الجدول لتطبيق النسبة عليها", "error");
        else alert("❌ لا توجد أصناف معروضة في الجدول لتطبيق النسبة عليها");
        return;
    }

    const targetTypeName = targetType === 'retail' ? 'سعر القطاعي' : (targetType === 'wholesale' ? 'سعر الجملة' : 'سعر القطاعي والجملة معاً');
    const factor = 1 + (percent / 100);

    // 📸 حفظ نسخة احتياطية فورية (Snapshot) قبل تطبيق التعديل لتمكين التراجع
    window.priceAdjUndoStack = window.priceAdjUndoStack || [];
    const snapshot = targetItems.map(p => ({
        id: p.id,
        retail: p.retail,
        wholesale: p.wholesale,
        minPrice: p.minPrice,
        profitMargin: p.profitMargin,
        variants: (p.hasVariants && Array.isArray(p.variants))
            ? p.variants.map(v => ({
                variantIndex: v.variantIndex,
                price: v.price,
                wholesale: v.wholesale
            }))
            : null
    }));
    window.priceAdjUndoStack.push({
        items: snapshot,
        targetTypeName: targetTypeName,
        percent: percent
    });

    // تطبيق التعديل الفوري
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
        p.profitMargin = buyCost > 0 ? (((parseFloat(p.retail) || 0) - buyCost) / buyCost * 100).toFixed(1) : '0.0';

        // تطبيق النسبة على كافة تشكيلات الموديل أيضاً
        if (p.hasVariants && Array.isArray(p.variants)) {
            p.variants.forEach(v => {
                if (targetType === 'retail' || targetType === 'both') {
                    const cRet = parseFloat(v.price) || 0;
                    v.price = Number((Math.round(cRet * factor * 100) / 100).toFixed(2));
                }
                if (targetType === 'wholesale' || targetType === 'both') {
                    const cWs = parseFloat(v.wholesale) || 0;
                    v.wholesale = Number((Math.round(cWs * factor * 100) / 100).toFixed(2));
                }
            });
        }
    });

    renderPriceAdjustmentTable(window.priceAdjCurrentFiltered);
    updatePriceAdjStats();
    updateUndoButtonState();

    if (typeof showToast === 'function') {
        showToast(`✅ تم تطبيق ${percent > 0 ? 'زيادة' : 'خفض'} (${Math.abs(percent)}%) على ${targetTypeName} بنجاح! يمكنك التراجع في أي وقت أو حفظ التعديلات.`, 'success');
    }
}
window.applyBulkPriceAdjustment = applyBulkPriceAdjustment;

window.priceAdjUndoStack = window.priceAdjUndoStack || [];

function updateUndoButtonState() {
    const btn = document.getElementById('priceAdjUndoBtn');
    if (!btn) return;
    const count = (window.priceAdjUndoStack && Array.isArray(window.priceAdjUndoStack)) ? window.priceAdjUndoStack.length : 0;
    if (count > 0) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.background = '#d97706';
        btn.style.boxShadow = '0 2px 6px rgba(217,119,6,0.35)';
        btn.innerHTML = `<span>↩️ تراجع (${count})</span>`;
        btn.title = `تراجع عن آخر تعديل واسترجاع الأسعار السابقة (${count} عملية محفوظة)`;
    } else {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.style.background = '#64748b';
        btn.style.boxShadow = 'none';
        btn.innerHTML = `<span>↩️ تراجع واسترجاع</span>`;
        btn.title = 'لا توجد عمليات سابقة للتراجع عنها';
    }
}
window.updateUndoButtonState = updateUndoButtonState;

function undoLastPriceAdjustment() {
    if (!window.priceAdjUndoStack || window.priceAdjUndoStack.length === 0) {
        if (typeof showToast === 'function') showToast("ℹ️ لا توجد عمليات سابقة للتراجع عنها", "info");
        return;
    }

    const lastAction = window.priceAdjUndoStack.pop();
    const snapItems = lastAction.items || [];
    const snapMap = new Map();
    snapItems.forEach(s => {
        if (s.id !== undefined && s.id !== null) snapMap.set(String(s.id), s);
    });

    let restoredCount = 0;
    const allItems = window.priceAdjData || [];
    allItems.forEach(p => {
        const snap = snapMap.get(String(p.id));
        if (snap) {
            p.retail = snap.retail;
            p.wholesale = snap.wholesale;
            p.minPrice = snap.minPrice;
            p.profitMargin = snap.profitMargin;

            if (snap.variants && Array.isArray(p.variants)) {
                snap.variants.forEach((sv, idx) => {
                    if (p.variants[idx]) {
                        p.variants[idx].price = sv.price;
                        p.variants[idx].wholesale = sv.wholesale;
                    }
                });
            }
            restoredCount++;
        }
    });

    renderPriceAdjustmentTable(window.priceAdjCurrentFiltered);
    updatePriceAdjStats();
    updateUndoButtonState();

    if (typeof showToast === 'function') {
        showToast(`↩️ تم التراجع بنجاح واسترجاع الأسعار السابقة لـ (${restoredCount}) صنف!`, "success");
    }
}
window.undoLastPriceAdjustment = undoLastPriceAdjustment;

function updatePriceAdjStats() {
    let totalCost = 0;
    let totalSale = 0;
    const currentList = window.priceAdjCurrentFiltered || window.priceAdjData || [];

    let variantsCount = 0;

    currentList.forEach(p => {
        if (p.hasVariants && Array.isArray(p.variants)) {
            variantsCount += p.variants.length;
        }
        const rowCost = (parseFloat(p.avgBuyPrice) || 0) * (parseFloat(p.stock) || 0);
        const rowSale = (parseFloat(p.retail) || 0) * (parseFloat(p.stock) || 0);
        totalCost += rowCost;
        totalSale += rowSale;
    });

    const totalProfit = totalSale - totalCost;

    if (document.getElementById('priceAdjCount')) document.getElementById('priceAdjCount').innerText = currentList.length;
    if (document.getElementById('priceAdjVariantsCount')) document.getElementById('priceAdjVariantsCount').innerText = variantsCount;
    if (document.getElementById('priceAdjTotalCost')) document.getElementById('priceAdjTotalCost').innerText = totalCost.toFixed(2);
    if (document.getElementById('priceAdjTotalSale')) document.getElementById('priceAdjTotalSale').innerText = totalSale.toFixed(2);
    if (document.getElementById('priceAdjTotalProfit')) document.getElementById('priceAdjTotalProfit').innerText = totalProfit.toFixed(2);
}

async function savePriceAdjustments() {
    if (typeof window.enforceSubscriptionCheck === 'function' && !window.enforceSubscriptionCheck('other')) return false;
    if (!window.priceAdjData || window.priceAdjData.length === 0) {
        closePriceAdjustmentModal();
        return;
    }

    const saveBtn = document.getElementById('savePriceAdjBtn') || document.querySelector('button[onclick*="savePriceAdjustments"]');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
    }

    if (typeof showToast === 'function') showToast("🔄 جاري حفظ التعديلات وتحديث قاعدة البيانات...", 'info');

    try {
        const dataToSave = [...window.priceAdjData];
        if (!Array.isArray(productsDB)) productsDB = [];

        const touchedProducts = [];
        dataToSave.forEach(item => {
            const p = productsDB.find(x => 
                (item.id !== undefined && item.id !== null && String(x.id) === String(item.id)) ||
                (item.code && String(x.code).trim() === String(item.code).trim()) ||
                (item.barcode && String(x.barcode).trim() === String(item.barcode).trim()) ||
                (item.name && String(x.name).trim() === String(item.name).trim())
            );

            if (p) {
                if (!touchedProducts.includes(p)) touchedProducts.push(p);
                p.price = parseFloat(item.retail) || 0;
                p.wholesale = parseFloat(item.wholesale) || 0;
                p.cost = (p.cost !== undefined && p.cost !== null && p.cost > 0) ? p.cost : (parseFloat(item.avgBuyPrice) || 0);
                p.minPrice = parseFloat(item.minPrice) || 0;
                if (item.barcode) p.barcode = String(item.barcode).trim();

                if (item.hasVariants && Array.isArray(item.variants)) {
                    if (!p.variants) p.variants = [];
                    item.variants.forEach((v, vIdx) => {
                        const targetIdx = (v.variantIndex !== undefined && p.variants[v.variantIndex]) ? v.variantIndex : vIdx;
                        if (p.variants[targetIdx]) {
                            p.variants[targetIdx].price = parseFloat(v.price) || 0;
                            p.variants[targetIdx].wholesale = parseFloat(v.wholesale) || 0;
                            p.variants[targetIdx].cost = (p.variants[targetIdx].cost !== undefined && p.variants[targetIdx].cost !== null && p.variants[targetIdx].cost > 0) ? p.variants[targetIdx].cost : (parseFloat(v.cost) || 0);
                            p.variants[targetIdx].minPrice = parseFloat(v.minPrice) || 0;
                            if (v.barcode) p.variants[targetIdx].barcode = String(v.barcode).trim();
                        }
                    });
                }

                p.updatedAt = new Date().toISOString();
            }
        });

        window.productsDB = productsDB;

        // 2. الحفظ الذري المباشر والسريع للأصناف المعدلة فقط
        if (typeof db !== 'undefined' && db && db.products && touchedProducts.length > 0) {
            await db.products.bulkPut(touchedProducts);
        } else if (typeof saveData === 'function') {
            await saveData();
        }

        if (window.BayanNetworkHub && typeof window.BayanNetworkHub.onDataSaved === 'function') {
            window.BayanNetworkHub.onDataSaved();
        }

        if (typeof showToast === 'function') {
            showToast("✅ تم حفظ وتحديث كافة أسعار وتكاليف الموديلات والتشكيلات بنجاح!", 'success');
        }

        closePriceAdjustmentModal();

        // 3. تحديث كافة واجهات العرض المرتبطة بأمان
        try {
            if (typeof renderInventoryTable === 'function') renderInventoryTable();
            if (typeof renderWarehouseReportTable === 'function') renderWarehouseReportTable();
            if (typeof renderProductsGrid === 'function') renderProductsGrid();
            if (typeof updateInventoryStats === 'function') updateInventoryStats();
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof updateDatalists === 'function') updateDatalists();
            if (typeof syncFashionGrid === 'function') syncFashionGrid();
            if (typeof renderSectionInquiryGrid === 'function') renderSectionInquiryGrid();
        } catch (uiErr) {
            console.warn("⚠️ UI refresh notice after price save:", uiErr);
        }

        // إطلاق أحداث المزامنة العامة
        window.dispatchEvent(new CustomEvent('inventoryUpdated'));

    } catch (error) {
        console.error("❌ Error saving prices:", error);
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'error',
                titleText: '❌ خطأ أثناء الحفظ',
                msg: 'حدث خطأ أثناء حفظ الأسعار:\n' + (error.message || error)
            });
        } else {
            alert("❌ حدث خطأ أثناء الحفظ: " + error.message);
        }
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
        }
    }
}
window.savePriceAdjustments = savePriceAdjustments;

function exportPriceAdjToExcel() {
    try {
        const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : (typeof window.XLSX !== 'undefined' ? window.XLSX : null)));
        
        const filtered = window.priceAdjCurrentFiltered || window.priceAdjData || [];

        if (filtered.length === 0) {
            if (typeof showToast === 'function') showToast("⚠️ لا توجد بيانات لتصديرها حالياً", "warning");
            else alert("⚠️ لا توجد بيانات لتصديرها حالياً.");
            return;
        }

        const tableData = [];
        const headerRow = ["مسلسل", "الكود الداخلي", "كود الصنف", "اسم الموديل / الصنف", "نوع الصنف / التشكيلات", "الباركود", "الوحدة", "متوسط التكلفة", "آخر شراء", "سعر الجملة", "سعر القطاعي", "نسبة الربح %", "أدنى سعر", "الرصيد الكلي"];
        tableData.push(headerRow);

        filtered.forEach((p, index) => {
            tableData.push([
                index + 1,
                p.sysCode || p.id,
                p.code || "-",
                p.name,
                p.hasVariants ? `موديل ملابس (${p.variantsCount} تشكيلة)` : "صنف قياسي",
                p.barcode || "",
                p.unit || "قطعة",
                p.avgBuyPrice ? parseFloat(p.avgBuyPrice).toFixed(2) : "0.00",
                p.lastBuyPrice ? parseFloat(p.lastBuyPrice).toFixed(2) : "0.00",
                p.wholesale ? parseFloat(p.wholesale).toFixed(2) : "0.00",
                p.retail ? parseFloat(p.retail).toFixed(2) : "0.00",
                (p.profitMargin || 0) + "%",
                p.minPrice ? parseFloat(p.minPrice).toFixed(2) : "0.00",
                p.stock != null ? p.stock : 0
            ]);
        });

        const fileName = `تقرير_أسعار_الموديلات_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}`;

        if (XLSXLib && XLSXLib.utils) {
            try {
                const ws = XLSXLib.utils.aoa_to_sheet(tableData);
                const wb = XLSXLib.utils.book_new();
                XLSXLib.utils.book_append_sheet(wb, ws, "أسعار وتكاليف الموديلات");
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

// =========================================================================
// ⚙️ إدارة وتخصيص أعمدة شاشة إدارة وتسعير الموديلات (مودال شيك بالمنتصف مطابق لقسم البضاعة)
// =========================================================================
const priceAdjColumnsList = [
    { id: 1, name: "المسلسل (#)" },
    { id: 'image', name: "صورة الموديل 🖼️" },
    { id: 'internal', name: "الكود الداخلي" },
    { id: 2, name: "كود الصنف" },
    { id: 3, name: "اسم الصنف / الموديل" },
    { id: 'fashion', name: "المقاسات والتشكيلات" },
    { id: 4, name: "الباركود" },
    { id: 6, name: "الوحدة" },
    { id: 12, name: "متوسط التكلفة" },
    { id: 11, name: "آخر شراء" },
    { id: 13, name: "سعر الجملة" },
    { id: 10, name: "سعر القطاعي" },
    { id: 'profit', name: "الربح %" },
    { id: 'min', name: "أدنى سعر" },
    { id: 9, name: "الرصيد الكلي" }
];
window.priceAdjColumnsList = priceAdjColumnsList;

function openPriceAdjColumnModal() {
    // إغلاق أي نافذة سابقة لمنع التكرار
    const oldModal = document.querySelector('.price-adj-col-modal-overlay');
    if (oldModal) oldModal.remove();

    let saved = typeof getStore === 'function' ? getStore('priceAdjHiddenCols') : null;
    if (!saved && typeof localStorage !== 'undefined') saved = localStorage.getItem('priceAdjHiddenCols');
    let hiddenCols = [];
    try {
        if (saved) hiddenCols = JSON.parse(saved);
    } catch(e) {}

    let gridHtml = `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 16px; max-height: 55vh; overflow-y: auto;">`;
    priceAdjColumnsList.forEach(col => {
        const isChecked = !hiddenCols.includes(String(col.id));
        gridHtml += `
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px 14px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 0.88rem; font-weight: 800; color: #1e293b; transition: all 0.2s;"
                   onmouseover="this.style.background='#eff6ff'; this.style.borderColor='#6366f1';"
                   onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0';">
                <input type="checkbox" class="price-adj-col-custom-chk" data-col-id="${col.id}" ${isChecked ? 'checked' : ''}
                       onchange="window.toggleSinglePriceAdjColumn('${col.id}', this.checked)"
                       style="width: 18px; height: 18px; cursor: pointer; accent-color: #6366f1;">
                <span>${col.name}</span>
            </label>
        `;
    });
    gridHtml += `</div>`;

    const modal = document.createElement('div');
    modal.className = 'price-adj-col-modal-overlay modal-overlay';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 9999999; animation: fadeIn 0.2s ease-out; direction: rtl; font-family: Cairo, sans-serif;';

    modal.innerHTML = `
        <div style="width: 530px; max-width: 95vw; background: #ffffff; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.4); border: 2.5px solid #6366f1; overflow: hidden; display: flex; flex-direction: column; text-align: right;">
            <!-- هيدر النافذة الملكي -->
            <div style="background: linear-gradient(135deg, #1e1b4b, #312e81, #0f172a); padding: 14px 20px; border-bottom: 2.5px solid #6366f1; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.3rem;">⚙️</span>
                    <div>
                        <h3 style="margin: 0; color: #ffffff; font-size: 1.15rem; font-weight: 900;">تخصيص أعمدة إدارة وتسعير الموديلات</h3>
                        <small style="color: #a5b4fc; font-size: 0.78rem; font-weight: bold;">تحكم في إظهار وإخفاء الأعمدة في جدول الأسعار المجمع</small>
                    </div>
                </div>
                <button type="button" onclick="this.closest('.price-adj-col-modal-overlay').remove()" 
                        style="background: rgba(255,255,255,0.15); border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 1.1rem; cursor: pointer; color: #ffffff; display: flex; align-items: center; justify-content: center; transition: 0.2s;"
                        onmouseover="this.style.background='rgba(239, 68, 68, 0.8)';"
                        onmouseout="this.style.background='rgba(255,255,255,0.15)';">&times;</button>
            </div>

            <!-- شريط الإجراءات السريعة (تحديد الكل / إلغاء الكل) -->
            <div style="padding: 10px 20px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.84rem; font-weight: 800; color: #475569;">اختر الأعمدة التي ترغب في إظهارها:</span>
                <div style="display: flex; gap: 8px;">
                    <button type="button" onclick="document.querySelectorAll('.price-adj-col-custom-chk').forEach(chk => { chk.checked = true; window.toggleSinglePriceAdjColumn(chk.getAttribute('data-col-id'), true); });"
                            style="padding: 4px 12px; font-size: 0.78rem; font-weight: 800; background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 6px; cursor: pointer; transition: 0.2s;">
                        تحديد الكل
                    </button>
                    <button type="button" onclick="document.querySelectorAll('.price-adj-col-custom-chk').forEach(chk => { chk.checked = false; window.toggleSinglePriceAdjColumn(chk.getAttribute('data-col-id'), false); });"
                            style="padding: 4px 12px; font-size: 0.78rem; font-weight: 800; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; transition: 0.2s;">
                        إلغاء الكل
                    </button>
                </div>
            </div>

            <!-- شبكة الأعمدة -->
            ${gridHtml}

            <!-- فوتر الحفظ والإغلاق -->
            <div style="padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                <button type="button" style="width: 100%; height: 44px; background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35); transition: all 0.2s;"
                        onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 18px rgba(99, 102, 241, 0.45)';"
                        onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 14px rgba(99, 102, 241, 0.35)';"
                        onclick="this.closest('.price-adj-col-modal-overlay').remove()">
                    💾 حفظ التخصيص وإغلاق
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}
window.openPriceAdjColumnModal = openPriceAdjColumnModal;
window.togglePriceAdjColumnManager = openPriceAdjColumnModal;

window.toggleSinglePriceAdjColumn = function(colId, isVisible) {
    const cells = document.querySelectorAll(`.col-adj-${colId}`);
    cells.forEach(c => {
        c.style.display = isVisible ? '' : 'none';
    });

    let saved = typeof getStore === 'function' ? getStore('priceAdjHiddenCols') : null;
    if (!saved && typeof localStorage !== 'undefined') saved = localStorage.getItem('priceAdjHiddenCols');
    let hiddenCols = [];
    try {
        if (saved) hiddenCols = JSON.parse(saved);
    } catch(e) {}

    const sColId = String(colId);
    if (!isVisible && !hiddenCols.includes(sColId)) {
        hiddenCols.push(sColId);
    } else if (isVisible && hiddenCols.includes(sColId)) {
        hiddenCols = hiddenCols.filter(id => id !== sColId);
    }

    const jsonStr = JSON.stringify(hiddenCols);
    if (typeof setStore === 'function') setStore('priceAdjHiddenCols', jsonStr);
    if (typeof localStorage !== 'undefined') localStorage.setItem('priceAdjHiddenCols', jsonStr);
};

window.applyPriceAdjColumnVisibility = function() {
    let saved = typeof getStore === 'function' ? getStore('priceAdjHiddenCols') : null;
    if (!saved && typeof localStorage !== 'undefined') saved = localStorage.getItem('priceAdjHiddenCols');
    let hiddenCols = [];
    try {
        if (saved) hiddenCols = JSON.parse(saved);
    } catch(e) {}

    priceAdjColumnsList.forEach(col => {
        const isVisible = !hiddenCols.includes(String(col.id));
        const cells = document.querySelectorAll(`.col-adj-${col.id}`);
        cells.forEach(c => {
            c.style.display = isVisible ? '' : 'none';
        });
    });
};

// ============================================================
//  إدارة وتخصيص أعمدة جدول التسوية والجرد (Adjustment Column Manager)
// ============================================================
const ADJ_TABLE_COLUMNS = [
    { key: 'col-adj-idx', label: '🔢 م (الرقم التسلسلي)' },
    { key: 'col-adj-code', label: '🏷️ كود / باركود' },
    { key: 'col-adj-name', label: '📝 اسم الصنف' },
    { key: 'col-variant-size', label: '📏 المقاس' },
    { key: 'col-variant-color', label: '🎨 اللون' },
    { key: 'col-adj-book', label: '📦 الرصيد الدفتري' },
    { key: 'col-adj-actual', label: '🎯 الفعلي (المجرود)' },
    { key: 'col-adj-diff', label: '⚖️ الفرق (عجز/زيادة)' },
    { key: 'col-adj-after', label: '✅ الرصيد بعد' },
    { key: 'col-adj-unit', label: '📐 الوحدة' },
    { key: 'col-adj-price', label: '💰 السعر (قطاعي/تكلفة)' },
    { key: 'col-adj-diffval', label: '💵 قيمة الفرق' },
    { key: 'col-adj-actions', label: '🗑️ إجراءات (حذف)' }
];

function getAdjHiddenColumns() {
    try {
        const stored = getStore('bayan_adj_hidden_columns');
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
}

function saveAdjHiddenColumns(hiddenList) {
    try {
        const json = JSON.stringify(hiddenList);
        setStore('bayan_adj_hidden_columns', json);
    } catch (e) {}
    applyAdjColumnsVisibility();
}

function applyAdjColumnsVisibility() {
    const hiddenList = getAdjHiddenColumns();
    let styleEl = document.getElementById('bayanAdjColumnsCustomStyles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'bayanAdjColumnsCustomStyles';
        document.head.appendChild(styleEl);
    }
    if (!Array.isArray(hiddenList) || hiddenList.length === 0) {
        styleEl.textContent = '';
        return;
    }
    styleEl.textContent = hiddenList.map(c => `.${c} { display: none !important; }`).join('\n');
}

function openAdjColumnSettingsModal() {
    const modal = document.getElementById('adjColumnSettingsModal');
    const container = document.getElementById('adjColumnsCheckboxList');
    if (!modal || !container) return;

    const hiddenList = getAdjHiddenColumns();
    container.innerHTML = ADJ_TABLE_COLUMNS.map(col => {
        const isChecked = !hiddenList.includes(col.key);
        return `
            <label style="display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: ${isChecked ? '#f0fdf4' : '#f8fafc'}; border: 1.5px solid ${isChecked ? '#86efac' : '#cbd5e1'}; border-radius: 10px; cursor: pointer; transition: 0.15s; font-size: 0.85rem; font-weight: 800; color: ${isChecked ? '#166534' : '#64748b'}; user-select: none;">
                <input type="checkbox" data-col-key="${col.key}" ${isChecked ? 'checked' : ''} onchange="handleAdjColumnToggle(this)" style="width: 17px; height: 17px; accent-color: #0284c7; cursor: pointer;">
                <span>${col.label}</span>
            </label>
        `;
    }).join('');

    modal.style.display = 'flex';
    modal.classList.remove('hidden');
}

function closeAdjColumnSettingsModal() {
    const modal = document.getElementById('adjColumnSettingsModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
}

function handleAdjColumnToggle(inputEl) {
    const colKey = inputEl.getAttribute('data-col-key');
    if (!colKey) return;
    let hiddenList = getAdjHiddenColumns();
    if (inputEl.checked) {
        hiddenList = hiddenList.filter(k => k !== colKey);
        inputEl.closest('label').style.background = '#f0fdf4';
        inputEl.closest('label').style.borderColor = '#86efac';
        inputEl.closest('label').style.color = '#166534';
    } else {
        if (!hiddenList.includes(colKey)) hiddenList.push(colKey);
        inputEl.closest('label').style.background = '#f8fafc';
        inputEl.closest('label').style.borderColor = '#cbd5e1';
        inputEl.closest('label').style.color = '#64748b';
    }
    saveAdjHiddenColumns(hiddenList);
}

function selectAllAdjColumns(showAll = true) {
    let hiddenList = [];
    if (!showAll) {
        hiddenList = ADJ_TABLE_COLUMNS.map(c => c.key);
    }
    saveAdjHiddenColumns(hiddenList);
    openAdjColumnSettingsModal();
}

function resetAdjColumnsToDefault() {
    saveAdjHiddenColumns([]);
    openAdjColumnSettingsModal();
    if (typeof showToast === 'function') showToast("🔄 تم استعادة إظهار كافة الأعمدة بالوضع الافتراضي", "info");
}

window.openAdjColumnSettingsModal = openAdjColumnSettingsModal;
window.closeAdjColumnSettingsModal = closeAdjColumnSettingsModal;
window.handleAdjColumnToggle = handleAdjColumnToggle;
window.selectAllAdjColumns = selectAllAdjColumns;
window.resetAdjColumnsToDefault = resetAdjColumnsToDefault;
window.applyAdjColumnsVisibility = applyAdjColumnsVisibility;

// تطبيق الإعدادات عند تشغيل التطبيق
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAdjColumnsVisibility);
} else {
    applyAdjColumnsVisibility();
}

