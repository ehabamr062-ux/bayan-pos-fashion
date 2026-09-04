// ============================================================
//  فواتير الشراء وإدخال بضاعة الموردين (Purchases Management)
// ============================================================
function updateHeaderPartnerInfo() {

    // تحديث شارة اسم العميل/المورد في هيدر الفاتورة

    const sPB = document.getElementById('salesPartnerBadge');

    const sCode = document.getElementById('customerCodeDisplay');

    const sBalance = document.getElementById('customerBalanceDisplay');

    if (sPB && document.getElementById('customerName')) {

        const name = document.getElementById('customerName').value || '---';

        sPB.innerText = '👤 عميل: ' + name;

        const acc = accounts.find(a => a.name === name);

        if (acc) {

            if (sCode) sCode.innerText = acc.code || '---';

            if (sBalance) {

                const bal = getAccountBalance(name);

                sBalance.innerText = bal.toFixed(2);

                // رصيد سابق في شاشة المبيعات

                if (document.getElementById('prevBalanceDisplay')) {

                    document.getElementById('prevBalanceDisplay').innerText = bal.toFixed(2);

                    // استدعاء الحساب لتحديث الإجمالي الكلي

                    if (typeof calculateTotals === 'function') calculateTotals();

                }

                // تلوين الرصيد (أخضر للمديونية "عليه"، أحمر للدائن "له") حسب طلب المستخدم

                sBalance.style.color = (bal > 0) ? 'var(--main-green)' : (bal < 0 ? '#c0392b' : 'white');

                sBalance.parentElement.style.backgroundColor = (bal > 0) ? 'rgba(39, 174, 96, 0.2)' : (bal < 0 ? 'rgba(192, 57, 43, 0.2)' : '#444');

            }

        } else {

            if (sCode) sCode.innerText = '---';

            if (sBalance) {

                sBalance.innerText = '0.00';

                sBalance.style.color = 'white';

                sBalance.parentElement.style.backgroundColor = '#444';

            }

            if (document.getElementById('prevBalanceDisplay')) {

                document.getElementById('prevBalanceDisplay').innerText = '0.00';

                if (typeof calculateTotals === 'function') calculateTotals();

            }

        }

    }

    const pPB = document.getElementById('purchasePartnerBadge');

    const pCode = document.getElementById('supplierCodeDisplay');

    const pBalance = document.getElementById('supplierBalanceDisplay');

    if (pPB && document.getElementById('supplierName')) {

        const name = document.getElementById('supplierName').value || '---';

        pPB.innerText = '👤 مورد: ' + name;

        const acc = accounts.find(a => a.name === name);

        if (acc) {

            if (pCode) pCode.innerText = acc.code || '---';

            if (pBalance) {

                const bal = getAccountBalance(name);

                pBalance.innerText = bal.toFixed(2);

                if (document.getElementById('purchasePrevBalanceDisplay')) {

                    document.getElementById('purchasePrevBalanceDisplay').innerText = bal.toFixed(2);

                    if (typeof calculatePurchaseTotals === 'function') calculatePurchaseTotals();

                }

                // تلوين الرصيد (أخضر للمديونية "عليه"، أحمر للدائن "له")

                pBalance.style.color = (bal > 0) ? 'var(--main-green)' : (bal < 0 ? '#c0392b' : 'white');

                pBalance.parentElement.style.backgroundColor = (bal > 0) ? 'rgba(39, 174, 96, 0.2)' : (bal < 0 ? 'rgba(192, 57, 43, 0.2)' : '#444');

            }

        } else {

            if (pCode) pCode.innerText = '---';

            if (pBalance) {

                pBalance.innerText = '0.00';

                pBalance.style.color = 'white';

                pBalance.parentElement.style.backgroundColor = '#444';

            }

            if (document.getElementById('purchasePrevBalanceDisplay')) {

                document.getElementById('purchasePrevBalanceDisplay').innerText = '0.00';

                if (typeof calculatePurchaseTotals === 'function') calculatePurchaseTotals();

            }

        }

    }

    const srPB = document.getElementById('salesReturnPartnerBadge');

    if (srPB && document.getElementById('salesReturnPartnerDisplay')) {

        const name = document.getElementById('salesReturnPartnerDisplay').innerText || '---';

        srPB.innerText = '👤 عميل: ' + name;

    }

    const prPB = document.getElementById('purReturnPartnerBadge');

    if (prPB && document.getElementById('purReturnPartnerDisplay')) {

        const name = document.getElementById('purReturnPartnerDisplay').innerText || '---';

        prPB.innerText = '👤 مورد: ' + name;

    }

}

window.POSState = window.POSState || {};
window.POSState.purchases = window.POSState.purchases || {
    searchSelectedIndex: -1,
    headerProductId: null,
    headerUnit: null
};

// دالة لاختيار الصنف وتعبئة بياناته في هيدر المشتريات (المربعات الملونة)

async function selectProductToPurchaseHeader(productId) {

    const product = (typeof db !== 'undefined') ? await db.products.get(productId) : productsDB.find(p => p.id === productId);

    if (!product) return;

    const resultsDiv = document.getElementById('purchaseSearchResults');
    if (resultsDiv) resultsDiv.style.display = 'none';

    // إذا كان للصنف تشكيلات مقاسات وألوان، نفتح نافذة المقاس واللون الموحدة فوراً
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        if (typeof showVariantSelectionModal === 'function') {
            showVariantSelectionModal(product, 'purchase');
            return;
        }
    }

    // إذا كان المنتج له وحدات متعددة، نفتح نافذة اختيار الوحدات
    if (product.units && product.units.length > 1) {
        addToPurchaseCart(productId);
        const pSearch = document.getElementById('purchaseSearch');
        if (pSearch) pSearch.value = '';
        return;
    }

    POSState.purchases.headerProductId = productId;

    const pSearch = document.getElementById('purchaseSearch');

    const hQty = document.getElementById('purchaseHeaderQty');

    const hPrice = document.getElementById('purchaseHeaderPrice');

    if (pSearch) pSearch.value = product.name;

    // في المشتريات نستخدم سعر التكلفة (Cost) وأسعار البيع الحالية

    if (hPrice) hPrice.value = (parseFloat(product.cost) || 0).toFixed(2);

    const hSale = document.getElementById('purchaseHeaderSalePrice');

    const hWholesale = document.getElementById('purchaseHeaderWholesalePrice');

    if (hSale) hSale.value = (parseFloat(product.price) || 0).toFixed(2);

    if (hWholesale) hWholesale.value = (parseFloat(product.wholesale) || 0).toFixed(2);

    if (hQty) {

        hQty.value = 1;

        hQty.focus();

        hQty.select();

    }

}

// let currentPurchaseHeaderUnit = null; (Moved to POSState)

function fillPurchaseHeaderWithUnit(product, unit) {

    POSState.purchases.headerProductId = product.id;

    POSState.purchases.headerUnit = unit;

    const pSearch = document.getElementById('purchaseSearch');

    const hQty = document.getElementById('purchaseHeaderQty');

    const hPrice = document.getElementById('purchaseHeaderPrice');

    const hSale = document.getElementById('purchaseHeaderSalePrice');

    const hWholesale = document.getElementById('purchaseHeaderWholesalePrice');

    if (pSearch) pSearch.value = product.name;

    if (hPrice) hPrice.value = (parseFloat(unit.cost) || parseFloat(product.cost) || 0).toFixed(2);

    if (hSale) hSale.value = (parseFloat(product.price) || parseFloat(unit.price) || 0).toFixed(2);

    if (hWholesale) hWholesale.value = (parseFloat(product.wholesale) || parseFloat(unit.wholesale) || 0).toFixed(2);

    if (hQty) {

        hQty.value = 1;

        hQty.focus();

        hQty.select();

    }

}

async function handlePurchaseSearch(query) {

    const resultsDiv = document.getElementById('purchaseSearchResults');

    resultsDiv.innerHTML = '';
    POSState.purchases.searchSelectedIndex = -1;
    
    // منع قص النوافذ المنبثقة الجديدة وإلغاء القيود القديمة للفئة search-results
    resultsDiv.style.setProperty('overflow', 'visible', 'important');
    resultsDiv.style.setProperty('max-height', 'none', 'important');
    resultsDiv.style.setProperty('border', 'none', 'important');
    resultsDiv.style.setProperty('background', 'transparent', 'important');
    resultsDiv.style.setProperty('box-shadow', 'none', 'important');

    if (!query || !query.trim()) { 
        resultsDiv.style.display = 'none'; 
        resultsDiv.innerHTML = '';
        return; 
    }

    // 1. البحث الحي الموحد بالاسم أو الباركود أو الكود (Live Search)
    const queryLower = query.trim().toLowerCase();

    const filtered = productsDB.filter(p =>
        (p.name && p.name.toLowerCase().includes(queryLower)) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(queryLower)) ||
        (p.code && String(p.code).toLowerCase().includes(queryLower)) ||
        (p.units && p.units.some(u => u.unitBarcode && String(u.unitBarcode).toLowerCase().includes(queryLower)))
    ).slice(0, 10);

    if (filtered.length > 0) {
        resultsDiv.innerHTML = `
            <div class="pos-search-panel" style="width: calc(100% + 340px); max-width: 580px; min-width: 320px; position: absolute; top: 100%; left: 50%; transform: translateX(50%); z-index: 99999; background: white; border-radius: 14px; box-shadow: 0 15px 35px rgba(0,0,0,0.2); border: 1px solid #cbd5e1; direction: rtl; text-align: right; margin-top: 6px; animation: modalFadeIn 0.2s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-top-left-radius: 14px; border-top-right-radius: 14px;">
                    <span style="font-weight: 800; font-size: 0.88rem; color: #5e3370;">🔍 نتائج بحث الشراء (${filtered.length} صنف)</span>
                    <button onclick="document.getElementById('purchaseSearchResults').style.display='none';" class="pos-search-close-btn" title="إغلاق النافذة">❌</button>
                </div>
                <div style="max-height: 380px; overflow-y: auto; padding: 6px; scrollbar-gutter: stable;">
                    ${filtered.map(p => {
                        const costVal = parseFloat(p.cost) || 0;
                        const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
                        const stockVal = typeof getWarehouseStock === 'function' ? getWarehouseStock(p.name, activeWH) : 0;
                        return `
                            <div class="pos-search-row" onclick="selectProductToPurchaseHeader(${p.id});" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: 0.15s; border-radius: 10px; gap: 8px;">
                                <div style="flex: 1.5; min-width: 180px;">
                                    <div style="font-weight: 900; font-size: 0.98rem; color: #1e293b;">${p.name}</div>
                                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">🏷️ كود: <b style="color:#5e3370;">${p.code || p.id}</b> | باركود: <b>${p.barcode || '---'}</b></div>
                                </div>
                                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                                    <div style="text-align: center; background: #f8fafc; padding: 5px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                                        <div style="font-size: 0.7rem; color: #64748b;">📦 الرصيد الحالي</div>
                                        <div style="font-weight: 900; font-size: 0.95rem; color: #10b981;">${stockVal} <span style="font-size:0.7rem;">${p.unit || 'قطعة'}</span></div>
                                    </div>
                                    <div style="text-align: center; background: rgba(59, 130, 246, 0.08); padding: 5px 14px; border-radius: 8px; border: 1.5px solid rgba(59, 130, 246, 0.25);">
                                        <div style="font-size: 0.7rem; color: #1d4ed8; font-weight: 800;">💰 سعر التكلفة</div>
                                        <div style="font-weight: 900; font-size: 1rem; color: #1e40af;">${costVal.toFixed(2)} ج.م</div>
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

        resultsDiv.innerHTML = `

                <div style="display:flex; flex-direction:column; gap:5px; padding:5px;">

                    <button class="result-item fast-add-btn" onclick="fastQuickAddProduct('${query.replace(/'/g, "\\'")}', 'purchase')" 

                        style="width:100%; border: 2px solid var(--main-green); background: rgba(39, 174, 96, 0.1); color: var(--main-green); font-weight: bold; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:10px; padding:12px; cursor:pointer; transition:0.3s; margin:0;">

                        <span style="font-size:1.2rem;">⚡</span>

                        <span>إضافة سريعة ومباشرة: "${query}"</span>

                    </button>

                </div>`;

    }

}

async function handlePurchaseSearchEnter(query, event, forceAdd = false) {

    const cleanQuery = String(query || '').trim();

    if (!forceAdd && typeof POSState.purchases.headerProductId !== 'undefined' && POSState.purchases.headerProductId) {
        const selectedProd = productsDB.find(p => p.id === POSState.purchases.headerProductId);
        if (selectedProd && String(selectedProd.name).trim() === cleanQuery) {
            forceAdd = true;
        }
    }

    if (forceAdd && typeof POSState.purchases.headerProductId !== 'undefined' && POSState.purchases.headerProductId) {

        const product = productsDB.find(p => p.id === POSState.purchases.headerProductId);

        if (product) {

            completeAddToPurchaseCart(product, POSState.purchases.headerUnit);

            POSState.purchases.headerProductId = null;

            POSState.purchases.headerUnit = null;

            document.getElementById('purchaseSearch').value = '';

            document.getElementById('purchaseSearchResults').style.display = 'none';

            // التعديل: لا نرجع الفوكس للبحث إلا لو كنا في الهيدر أصلاً

            if (event && event.target && event.target.id !== 'purchaseHeaderWholesalePrice') {

                document.getElementById('purchaseSearch').focus();

            } else if (!event) {

                document.getElementById('purchaseSearch').focus();

            }

        }

        return;

    }

    if (!query || query.trim() === "") return;

    // إذا كان مسح باركود تم بواسطة السكانر المركزي للتو، نتجاهل ضغطة Enter الزائدة
    if (typeof window.isBayanRecentScan === 'function' && window.isBayanRecentScan()) {
        const pInp = document.getElementById('purchaseSearch');
        if (pInp) pInp.value = '';
        const rDiv = document.getElementById('purchaseSearchResults');
        if (rDiv) rDiv.style.display = 'none';
        return;
    }

    // فحص الباركود الدقيق التلقائي فوراً
    if (typeof window.dispatchSearchBarcode === 'function') {
        if (window.dispatchSearchBarcode(cleanQuery, 'purchase')) return;
    }

    // 1. بحث فوري دقيق في باركود تشكيلات المقاسات والألوان (Variant Barcode Match)
    let matchingVariant = null;
    let pMatch = productsDB.find(p => {
        if (p.variants && Array.isArray(p.variants)) {
            const vFound = p.variants.find(v => v.barcode && String(v.barcode).trim() === cleanQuery);
            if (vFound) {
                matchingVariant = vFound;
                return true;
            }
        }
        return false;
    });

    if (pMatch && matchingVariant) {
        addToPurchaseCart(pMatch.id, null, null, matchingVariant);
        const resultsDiv = document.getElementById('purchaseSearchResults');
        if (resultsDiv) resultsDiv.style.display = 'none';
        const pInp = document.getElementById('purchaseSearch');
        if (pInp) pInp.value = '';
        if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
        return;
    }

    // 2. البحث بالباركود الأساسي أو الكود
    if (!pMatch) {
        pMatch = productsDB.find(p => String(p.barcode || '').trim() === cleanQuery || String(p.code || '').trim() === cleanQuery);
    }

    // 3. البحث في باركود الوحدات
    if (!pMatch) {
        pMatch = productsDB.find(p => p.units && p.units.some(u => String(u.unitBarcode || '').trim() === cleanQuery));
    }

    // 3. البحث بالاسم الجزئي كحل أخير
    if (!pMatch) {
        const queryLower = cleanQuery.toLowerCase();
        const matches = productsDB.filter(p =>
            (p.name && p.name.toLowerCase().includes(queryLower))
        );
        
        if (matches.length === 1) {
            pMatch = matches[0];
        } else if (matches.length > 1) {
            // أكثر من منتج يتطابق مع كلمة عامة مثل "جزمه"، ننتظر المستخدم ليختار
            return;
        }
    }
    
    if (pMatch) {
        if (forceAdd) {
            addToPurchaseCart(pMatch.id);
            document.getElementById('purchaseSearch').value = '';
            document.getElementById('purchaseSearchResults').style.display = 'none';
            document.getElementById('purchaseSearch').focus();
        } else {
            if (pMatch.variants && Array.isArray(pMatch.variants) && pMatch.variants.length > 0) {
                const resultsDiv = document.getElementById('purchaseSearchResults');
                if (resultsDiv) resultsDiv.style.display = 'none';
                if (typeof showVariantSelectionModal === 'function') {
                    showVariantSelectionModal(pMatch, 'purchase');
                    return;
                }
            }

            selectProductToPurchaseHeader(pMatch.id);
        }
    } else {
        if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(false);
        if (typeof showToast === 'function') showToast(`⚠️ باركود غير مسجل: (${cleanQuery})`, 'error');
    }
}
window.handlePurchaseSearchEnter = handlePurchaseSearchEnter;

function handlePurchaseSearchKeydown(e) {
    const resultsDiv = document.getElementById('purchaseSearchResults');
    if (!resultsDiv || resultsDiv.style.display === 'none') {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePurchaseSearchEnter(e.target.value, e);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            document.getElementById('purchaseHeaderQty')?.focus();
        }
        return;
    }

    const items = resultsDiv.querySelectorAll('.pos-search-row, .search-item, .result-item');
    if (items.length === 0) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePurchaseSearchEnter(e.target.value, e);
        }
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        POSState.purchases.searchSelectedIndex = (POSState.purchases.searchSelectedIndex + 1) % items.length;
        updatePurchaseSearchSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        POSState.purchases.searchSelectedIndex = (POSState.purchases.searchSelectedIndex - 1 + items.length) % items.length;
        updatePurchaseSearchSelection(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (POSState.purchases.searchSelectedIndex > -1 && items[POSState.purchases.searchSelectedIndex]) {
            e.stopPropagation();
            items[POSState.purchases.searchSelectedIndex].click();
        } else {
            handlePurchaseSearchEnter(e.target.value, e);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        resultsDiv.style.display = 'none';
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        document.getElementById('purchaseHeaderQty')?.focus();
    }
}
window.handlePurchaseSearchKeydown = handlePurchaseSearchKeydown;

function updatePurchaseSearchSelection(items) {
    items.forEach((item, index) => {
        if (index === POSState.purchases.searchSelectedIndex) {
            item.style.setProperty('background', '#eff6ff', 'important');
            item.style.setProperty('border-right', '5px solid #3b82f6', 'important');
            item.style.setProperty('box-shadow', '0 2px 8px rgba(59, 130, 246, 0.15)', 'important');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.style.background = '';
            item.style.borderRight = 'none';
            item.style.boxShadow = 'none';
        }
    });
}

function handleSupplierSearch(query) {

    const resultsDiv = document.getElementById('supplierSearchResults');

    resultsDiv.innerHTML = '';

    if (!query) { resultsDiv.style.display = 'none'; return; }

    const filtered = accounts.filter(a => a.name.includes(query));

    if (filtered.length > 0) {

        resultsDiv.style.display = 'block';

        filtered.forEach(a => {

            const div = document.createElement('div');

            div.className = 'result-item';

            div.innerHTML = `<span>${a.name}</span><span class="stock-badge">${a.type === 'supplier' ? 'مورد' : (a.type === 'mixed' ? 'مشترك' : 'حساب')}</span>`;

            div.onclick = () => {

                document.getElementById('supplierName').value = a.name;

                resultsDiv.style.display = 'none';

                updateHeaderPartnerInfo();

            };

            resultsDiv.appendChild(div);

        });

    } else { resultsDiv.style.display = 'none'; }

}

function addToPurchaseCart(id, unitName = null, manualQty = null, manualCost = null, preSelectedVariant = null) {

    // دعم تلقائي في حال تمرير كائن التشكيلة كمعامل رابع
    if (typeof manualCost === 'object' && manualCost !== null && !preSelectedVariant) {
        preSelectedVariant = manualCost;
        manualCost = null;
    }

    const product = productsDB.find(p => p.id === id);

    if (!product) return;

    const effVariant = preSelectedVariant || window._pendingPurchaseVariant || null;

    if (effVariant) {
        const defUnit = (product.units && product.units.length > 0) ? product.units[0] : null;
        completeAddToPurchaseCart(product, defUnit, manualQty, manualCost, effVariant);
        return;
    }

    if (product.variants && product.variants.length > 0 && !effVariant) {
        showVariantSelectionModal(product, 'purchase');
        return;
    }

    // إذا كان تم تحديد وحدة مسبقاً (باركود وحدة مثلاً)

    if (unitName) {

        const unit = product.units ? product.units.find(u => u.unitName === unitName) : null;

        completeAddToPurchaseCart(product, unit, manualQty, manualCost);

        return;

    }

    // إذا كان له أكثر من وحدة ولم يتم تحديد واحدة

    if (product.units && product.units.length > 1) {

        showUnitSelectionModal(product, 'purchase');

        return;

    }

    // وحدة واحدة أو لا يوجد

    const defUnit = (product.units && product.units.length > 0) ? product.units[0] : null;

    completeAddToPurchaseCart(product, defUnit, manualQty, manualCost);

}

function completeAddToPurchaseCart(product, selectedUnit, manualQty = null, manualCost = null, selectedVariant = null) {

    let qtyToAdd = 1;

    const hQtyInput = document.getElementById('purchaseHeaderQty');

    const hPriceInput = document.getElementById('purchaseHeaderPrice');

    if (manualQty !== null) {

        qtyToAdd = parseFloat(manualQty) || 1;

    } else {

        qtyToAdd = hQtyInput ? (parseFloat(hQtyInput.value) || 1) : 1;

    }

    const effVariant = selectedVariant || window._pendingPurchaseVariant || null;
    const vSize = effVariant ? (effVariant.size || '') : '';
    const vColor = effVariant ? (effVariant.color || '') : '';

    const existing = purchaseCart.find(item =>

        item.id === product.id &&

        ((!item.selectedUnit && !selectedUnit) || (item.selectedUnit && selectedUnit && item.selectedUnit.unitName === selectedUnit.unitName)) &&

        ((item.selectedSize || '') === vSize) &&

        ((item.selectedColor || '') === vColor)

    );

    // استخدام الوحدة المختارة من المتغير العالمي إذا لم يتم تمرير واحدة

    const finalUnit = selectedUnit || POSState.purchases.headerUnit;

    const factor = finalUnit ? parseFloat(finalUnit.factor) : 1;

    // أسعار البيع من الهيدر (لو موجودة ومكتوبة) أو من الصنف/التشكيلة نفسها
    const hSalePrice = document.getElementById('purchaseHeaderSalePrice');
    const hWholesalePrice = document.getElementById('purchaseHeaderWholesalePrice');

    const defaultSalePrice = selectedVariant 
        ? (parseFloat(selectedVariant.price) || parseFloat(product.price) || 0) 
        : (selectedUnit ? (parseFloat(selectedUnit.price) || parseFloat(product.price) || 0) : (parseFloat(product.price) || 0));

    const defaultWholesalePrice = selectedVariant 
        ? (parseFloat(selectedVariant.wholesale) || parseFloat(product.wholesale) || 0) 
        : (selectedUnit ? (parseFloat(selectedUnit.wholesale) || parseFloat(product.wholesale) || 0) : (parseFloat(product.wholesale) || 0));

    const salePrice = (hSalePrice && hSalePrice.value.trim() !== '') 
        ? (parseFloat(hSalePrice.value) || 0) 
        : defaultSalePrice;

    const wholesalePrice = (hWholesalePrice && hWholesalePrice.value.trim() !== '') 
        ? (parseFloat(hWholesalePrice.value) || 0) 
        : defaultWholesalePrice;

    let cost = 0;

    if (manualCost !== null) {

        cost = parseFloat(manualCost) || 0;

    } else {

        cost = (hPriceInput && hPriceInput.value) ? parseFloat(hPriceInput.value) : (selectedVariant && selectedVariant.cost ? parseFloat(selectedVariant.cost) : (selectedUnit ? (parseFloat(selectedUnit.cost) || parseFloat(product.cost) || 0) : (parseFloat(product.cost) || 0)));

    }

    if (existing) {
        existing.qty += qtyToAdd;
        if (cost > 0) existing.cost = cost;
        existing.price = cost;
        existing.salePrice = salePrice;
        existing.wholesalePrice = wholesalePrice;
    } else {
        purchaseCart.push({
            id: product.id,
            code: (selectedVariant && selectedVariant.barcode) ? selectedVariant.barcode : product.code,
            name: product.name,
            selectedSize: vSize,
            selectedColor: vColor,
            selectedVariant: selectedVariant,
            price: cost,
            cost: cost,
            salePrice: salePrice,
            wholesalePrice: wholesalePrice,
            qty: qtyToAdd,
            units: product.units || [],
            selectedUnit: finalUnit,
            unitFactor: factor,
            expiry: product.expiry || ''
        });
    }

    // تصفير المتغير العالمي للوحدة والمقاس بعد الإضافة
    POSState.purchases.headerUnit = null;
    window._pendingPurchaseVariant = null;

    // تصفير مدخلات الهيدر للاستعداد للصنف التالي

    if (hQtyInput) hQtyInput.value = 1;

    if (hPriceInput) hPriceInput.value = '';

    const hSale = document.getElementById('purchaseHeaderSalePrice');

    const hWholesale = document.getElementById('purchaseHeaderWholesalePrice');

    if (hSale) hSale.value = '';

    if (hWholesale) hWholesale.value = '';

    const pSearch = document.getElementById('purchaseSearch');

    if (pSearch) {

        pSearch.value = '';

        pSearch.focus();

    }

    renderPurchaseCart_Finalized_V3();

    calculatePurchaseTotals();

}

async function fastQuickAddProduct(name, context) {

    if (!name) return;

    // تحقق من وجود المنتج مسبقاً لتجنب التكرار

    const exists = productsDB.find(p => p.name.trim() === name.trim());

    if (exists) {

        if (context === 'purchase') addToPurchaseCart(exists.id);

        else if (context === 'sales') addToCart(exists.id);

        document.getElementById('purchaseSearch').value = '';

        document.getElementById('purchaseSearchResults').style.display = 'none';

        return;

    }

    const newItem = {

        id: Date.now(),

        name: name.trim(),

        price: 0,

        cost: 0,

        wholesale: 0,

        minPrice: 0,

        discount: 0,

        barcode: '',

        code: '',

        category: 'عام',

        shelf: '',

        stock: 0,

        minStock: 0,

        expiry: '',

        notes: 'إضافة سريعة من شاشة الشراء',

        units: [{

            unitName: 'قطعة',

            factor: 1,

            wholesale: 0,

            price: 0,

            cost: 0,

            isDefaultSale: true,

            isDefaultPurchase: true,

            unitBarcode: ''

        }],

        image: null

    };

    try {

        await db.products.add(newItem);

        productsDB.push(newItem);

        if (context === 'purchase') {

            addToPurchaseCart(newItem.id);

            document.getElementById('purchaseSearch').value = '';

        } else if (context === 'sales') {

            addToCart(newItem.id);

            if (document.getElementById('productSearch')) document.getElementById('productSearch').value = '';

        }

        const resultsDiv = document.getElementById(context === 'purchase' ? 'purchaseSearchResults' : 'searchResults');

        if (resultsDiv) resultsDiv.style.display = 'none';

        if (typeof showToast === 'function') showToast(`تمت إضافة "${name}" بنجاح ⚡`, 'success');

    } catch (err) {

        console.error("Fast Add Error:", err);

        alert("حدث خطأ أثناء الإضافة السريعة");

    }

}

// دالة حساب الرصيد المتوقع بعد المرتجع

function updateProjectedAccountBalance(type) {

    if (type !== 'sales' && type !== 'purchase') return;

    const isSales = type === 'sales';

    const prefix = isSales ? 'sr' : 'pr';

    const selectId = isSales ? 'sales-return-sectionPaymentMethodSelect' : 'purchase-return-sectionPaymentMethodSelect';

    const amountId = isSales ? 'returnTotalAmount' : 'purReturnTotalAmount';

    const accountCard = document.getElementById(prefix + 'ReturnAccountCard');

    const container = document.getElementById(prefix + 'AccAfterReturnContainer');

    const balanceAfterEl = document.getElementById(prefix + 'AccBalanceAfter');

    const currentBalanceEl = document.getElementById(prefix + 'AccBalance');

    if (!accountCard || accountCard.style.display === 'none') {

        if (container) container.style.display = 'none';

        return;

    }

    const selectEl = document.getElementById(selectId);

    const amountEl = document.getElementById(amountId);

    if (!selectEl || !amountEl || !container || !balanceAfterEl || !currentBalanceEl) return;

    const paymentMethod = selectEl.value;

    const returnTotal = parseFloat(amountEl.innerText) || 0;

    // استخراج الرصيد الحالي من الخاصية المخفية التي وضعناها في دالة التحديث

    let currentBalance = parseFloat(currentBalanceEl.dataset.rawBalance) || 0;

    // إذا كان المرتجع نقدي، الرصيد لن يتأثر - نعرضه كما هو مع وصف

    if (paymentMethod.includes('نقدي')) {

        container.style.display = 'block';

        balanceAfterEl.innerText = Math.abs(currentBalance).toFixed(2);

        if (currentBalance > 0) {

            balanceAfterEl.style.color = isSales ? '#dc2626' : '#be123c';

            balanceAfterEl.innerText += ' (عليه - لم يتغير)';

        } else if (currentBalance < 0) {

            balanceAfterEl.style.color = '#16a34a';

            balanceAfterEl.innerText += ' (له - لم يتغير)';

        } else {

            balanceAfterEl.style.color = '#333';

            balanceAfterEl.innerText = '0.00 (خالص)';

        }

        return;

    }

    // إذا كان خصم من حساب العميل أو إضافة لحساب المورد

    let newBalance = currentBalance;

    if (isSales && paymentMethod === 'خصم من حساب العميل') {

        // العميل قام بإرجاع بضاعة، وبالتالي فإن دينه لنا (owes) يقل، أو مستحقاته تزيد (owed)

        // newBalance = owes - (owed + returnTotal) = currentBalance - returnTotal

        newBalance = currentBalance - returnTotal;

    } else if (!isSales && paymentMethod === 'إضافة إلى حساب المورد') {

        // أرجعنا بضاعة للمورد، وبالتالي فإن ديننا للمورد (owes) يقل

        // newBalance = (owes - returnTotal) - owed = currentBalance - returnTotal

        newBalance = currentBalance - returnTotal;

    }

    container.style.display = 'block';

    balanceAfterEl.innerText = Math.abs(newBalance).toFixed(2);

    if (newBalance > 0) {

        // عليه (مدين)

        balanceAfterEl.style.color = isSales ? '#dc2626' : '#be123c';

        balanceAfterEl.innerText += ' (عليه)';

    } else if (newBalance < 0) {

        // له (دائن)

        balanceAfterEl.style.color = '#16a34a';

        balanceAfterEl.innerText += ' (له)';

    } else {

        balanceAfterEl.style.color = '#333';

        balanceAfterEl.innerText = '0.00 (خالص)';

    }

}

// إضافة مستمعات الأحداث للقوائم المنسدلة لطرق الدفع في شاشات المرتجع

setTimeout(() => {

    const sSelect = document.getElementById('sales-return-sectionPaymentMethodSelect');

    if(sSelect) sSelect.addEventListener('change', () => updateProjectedAccountBalance('sales'));

    const pSelect = document.getElementById('purchase-return-sectionPaymentMethodSelect');

    if(pSelect) pSelect.addEventListener('change', () => updateProjectedAccountBalance('purchase'));

}, 1000);

function renderPurchaseCart_Finalized_V3() {

    const tbody = document.getElementById('purchaseTableBody');

    if (!tbody) return;

    tbody.innerHTML = '';

    updateHeaderPartnerInfo();

    let sub = 0;

    purchaseCart.forEach((item, idx) => {

        // التأكد من أن السعر والكمية أرقام صحيحة لضمان دقة الإجمالي

        const price = parseFloat(item.price) || 0;

        const qty = parseFloat(item.qty) || 0;

        const total = price * qty;

        sub += total;

        // إنشاء قائمة الوحدات

        let unitOptions = `<option value="base" ${!item.selectedUnit ? 'selected' : ''}>${item.unit || 'قطعة'}</option>`;

        if (item.units && item.units.length > 0) {

            unitOptions = item.units.map(u =>

                `<option value="${u.unitName}" ${item.selectedUnit && item.selectedUnit.unitName === u.unitName ? 'selected' : ''}>${u.unitName}</option>`

            ).join('');

        }

        const { sizeElement, colorElement } = (typeof renderVariantSelectElements === 'function')
            ? renderVariantSelectElements(item, idx, 'purchase')
            : { sizeElement: `<span style="color:#cbd5e1;">-</span>`, colorElement: `<span style="color:#cbd5e1;">-</span>` };

        const tr = document.createElement('tr');
        tr.setAttribute('data-index', idx);
        tr.className = 'purchase-row';
        tr.innerHTML = `
                    <td style="text-align: center; color: #94a3b8; font-size: 0.8rem;">${idx + 1}</td>
                    <td style="font-size: 0.85rem; color: #64748b; text-align: center; font-family: monospace;">${item.code || '---'}</td>
                    <td style="font-weight: 700; color: #1e293b;">${item.name}</td>
                    <td class="col-variant-size" style="text-align: center;">${sizeElement}</td>
                    <td class="col-variant-color" style="text-align: center;">${colorElement}</td>
                    <td>
                        <input type="text" class="qty-input-styled" value="${item.qty}" 
                               inputmode="decimal"
                               oninput="this.value = this.value.replace(/[^0-9.]/g, ''); updatePurchaseItem(${idx}, 'qty', this.value, false)" 
                               onchange="updatePurchaseItem(${idx}, 'qty', this.value, true)"
                               onclick="this.select()" 
                               style="width: 100%; text-align: center; border: 1.5px solid #cbd5e1; background: #fff; border-radius: 6px; padding: 6px; font-weight: bold; font-size: 1rem; color: #1e293b; transition: all 0.2s; outline: none;">
                    </td>
                    <td>
                        <input type="number" class="final-editable-purchase-price" value="${price}" 
                               step="0.01"
                               oninput="updatePurchaseItem(${idx}, 'price', this.value, false)" 
                               onchange="updatePurchaseItem(${idx}, 'price', this.value, true)"
                               onclick="this.select()" 
                               style="width: 100% !important; text-align: center !important; border: 2px solid #3b82f6 !important; background: #ffffff !important; border-radius: 8px !important; padding: 8px !important; font-weight: 900 !important; font-size: 1rem !important; color: #1e3a8a !important; display: block !important; outline: none !important; cursor: text !important;">
                    </td>
                    <td style="background: rgba(34, 197, 94, 0.05);">
                        <input type="text" class="retail-input-styled" value="${item.salePrice || 0}" 
                               inputmode="decimal"
                               oninput="this.value = this.value.replace(/[^0-9.]/g, ''); updatePurchaseItem(${idx}, 'salePrice', this.value, false)" 
                               onchange="updatePurchaseItem(${idx}, 'salePrice', this.value, true)"
                               onclick="this.select()" 
                               style="width: 100%; text-align: center; border: 1.5px solid #cbd5e1; background: #fff; border-radius: 6px; padding: 6px; font-weight: bold; font-size: 0.9rem; color: #16a34a; outline: none;">
                    </td>
                    <td class="row-total" style="text-align: center; font-weight: 900; color: #0f172a; font-size: 1.05rem;">${total.toFixed(2)}</td>
                    <td style="text-align:center; width: 50px;">
                        <button class="btn-delete-row-minimal" onclick="removePurchaseItem(${idx})" title="حذف" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.2rem; opacity: 0.8; transition: 0.2s;">🗑️</button>
                    </td>
                `;

        tbody.appendChild(tr);

    });

    const subTotalEl = document.getElementById('purchaseSubTotal');

    if (subTotalEl) subTotalEl.innerText = sub.toFixed(2);

    calculatePurchaseTotals(sub);

}

function updatePurchaseItemUnit(idx, unitName) {

    const item = purchaseCart[idx];

    const product = productsDB.find(p => p.id === item.id);

    if (!product) return;

    const unit = product.units ? product.units.find(u => u.unitName === unitName) : null;

    if (unit) {

        item.selectedUnit = unit;

        item.unitFactor = parseFloat(unit.factor) || 1;

        item.price = parseFloat(unit.cost) || 0; // في المشتريات نستخدم التكلفة

    } else {

        item.selectedUnit = null;

        item.unitFactor = 1;

        item.price = parseFloat(product.cost) || 0;

    }

    renderPurchaseCart_Finalized_V3();

}

function removePurchaseItem(index) {
    if (isEditMode && !checkPermission('docs_edit')) return;
    const item = purchaseCart[index];
    if (item) addToTrash('draft_item', item, `حذف من فاتورة شراء (مسودة): ${item.name}`);
    purchaseCart.splice(index, 1);
    renderPurchaseCart_Finalized_V3();
}

function updatePurchaseItem(idx, field, val, shouldReRender = true) {

    // التحقق من الصلاحيات

    if (field === 'price') {

        // إذا كان تحديثاً نهائياً (عند تغيير الخانة) نخرج رسالة تنبيه لو مفيش صلاحية

        if (shouldReRender) {

            if (!checkPermission('docs_purchase_price')) return renderPurchaseCart_Finalized_V3();

        } else {

            // أثناء الكتابة، نتحقق بصمت عشان ميبقاش فيه إزعاج (Has vs Check)

            if (!hasPermission('docs_purchase_price') && !hasPermission('docs_edit')) return;

        }

    } else {

        if (!hasPermission('docs_edit') && !hasPermission('docs_add')) {

            if (shouldReRender) return checkPermission('docs_edit');

            return;

        }

    }

    const numericVal = parseFloat(val) || 0;

    purchaseCart[idx][field] = numericVal;

    // تحديث الصنف في قاعدة البيانات والذاكرة لو كان التغيير في أي من الأسعار (شراء، قطاعي، جملة)

    if (shouldReRender && (field === 'salePrice' || field === 'wholesalePrice' || field === 'price')) {

        updateProductPricesInDB(purchaseCart[idx]);

    }

    if (!shouldReRender) {

        // تحديث السطر الحالي والمجاميع فقط بدون إعادة رسم الجدول (للحفاظ على التركيز)

        const item = purchaseCart[idx];

        const total = item.price * item.qty;

        const tbody = document.getElementById('purchaseTableBody');

        if (tbody) {

            const row = tbody.querySelector(`tr[data-index="${idx}"]`);

            if (row) {

                const totalCell = row.querySelector('.row-total');

                if (totalCell) totalCell.innerText = total.toFixed(2);

            }

        }

        const sub = purchaseCart.reduce((a, b) => a + (b.price * b.qty), 0);

        const subTotalEl = document.getElementById('purchaseSubTotal');

        if (subTotalEl) subTotalEl.innerText = sub.toFixed(2);

        calculatePurchaseTotals(sub);

    } else {

        renderPurchaseCart_Finalized_V3();

    }

}

function updateProductPricesInDB(item) {

    if (!item || !item.id) return;

    db.products.get(item.id).then(product => {

        if (!product) return;

        // حساب متوسط التكلفة الجديد (Weighted Average Cost)

        const oldStock = parseFloat(product.stock) || 0;

        const oldCost = parseFloat(product.cost) || 0;

        const newQty = parseFloat(item.qty) || 0;

        const newPurchasePrice = parseFloat(item.price) || 0;

        let averageCost = newPurchasePrice;

        if (oldStock > 0) {

            averageCost = ((oldStock * oldCost) + (newQty * newPurchasePrice)) / (oldStock + newQty);

        } else if (oldCost > 0) {

            // إذا كان الرصيد صفر ولكن هناك تكلفة مسجلة مسبقاً (تكلفة افتراضية)

            averageCost = (oldCost + newPurchasePrice) / 2;

        }

        // تحديث السعر في الوحدة المختارة أو السعر الأساسي

        if (item.selectedUnit) {

            const unitIdx = product.units.findIndex(u => u.unitName === item.selectedUnit.unitName);

            if (unitIdx !== -1) {

                product.units[unitIdx].price = item.salePrice;

                product.units[unitIdx].wholesale = item.wholesalePrice;

                product.units[unitIdx].cost = newPurchasePrice; // آخر سعر شراء

                product.units[unitIdx].avgBuyPrice = averageCost; // متوسط التكلفة

            }

        } else {

            product.price = item.salePrice;

            product.wholesale = item.wholesalePrice;

            product.cost = newPurchasePrice; // آخر سعر شراء

            product.avgBuyPrice = averageCost; // متوسط التكلفة

        }

        db.products.put(product).then(() => {

            // تحديث المصفوفة في الذاكرة لضمان المزامنة اللحظية في قسم البضاعة

            const memIdx = productsDB.findIndex(p => p.id === item.id);

            if (memIdx !== -1) {

                productsDB[memIdx] = JSON.parse(JSON.stringify(product));

            }

            if (typeof showToast === 'function') {

                showToast(`تم تحديث أسعار "${item.name}" في قسم البضاعة ✅`, 'info');

            }

        });

    }).catch(err => console.error("Update DB Price Error:", err));

}

function calculatePurchaseTotals(sub) {

    if (sub === undefined) sub = purchaseCart.reduce((a, b) => a + (b.price * b.qty), 0);

    // تحديث إجمالي الأصناف والكمية

    const itemsCount = purchaseCart.length;

    const totalQty = purchaseCart.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);

    if (document.getElementById('purchaseItemsCount')) document.getElementById('purchaseItemsCount').innerText = itemsCount;

    if (document.getElementById('purchaseTotalQty')) document.getElementById('purchaseTotalQty').innerText = totalQty;

    if (document.getElementById('purchaseSubTotal')) document.getElementById('purchaseSubTotal').innerText = sub.toFixed(2);

    // حساب الخصم

    let discVal = parseFloat(document.getElementById('purchaseDiscount')?.value) || 0;

    const discType = document.getElementById('purchaseDiscountType')?.value || 'val';

    let discAmount = (discType === 'perc') ? (sub * discVal / 100) : discVal;

    if (document.getElementById('purchaseDiscountAmountDisplay')) document.getElementById('purchaseDiscountAmountDisplay').innerText = discAmount.toFixed(2);

    // حساب الإضافة

    let taxVal = parseFloat(document.getElementById('purchaseTax')?.value) || 0;

    const taxType = document.getElementById('purchaseTaxType')?.value || 'val';

    let taxAmount = (taxType === 'perc') ? (sub * taxVal / 100) : taxVal;

    if (document.getElementById('purchaseTaxAmountDisplay')) document.getElementById('purchaseTaxAmountDisplay').innerText = taxAmount.toFixed(2);

    let globalTaxAmount = 0;
    try {
        const settings = typeof getStore === 'function' ? JSON.parse(getStore('pos_settings') || '{}') : {};
        const globalTaxEnabled = settings.taxEnabled || false;
        const globalTaxPercent = parseFloat(settings.taxPercent) || 0;
        globalTaxAmount = globalTaxEnabled ? (sub * globalTaxPercent / 100) : 0;
    } catch(e) {}

    purchaseTotalVal = sub - discAmount + taxAmount + globalTaxAmount;

    if (purchaseTotalVal < 0) purchaseTotalVal = 0;

    if (document.getElementById('purchaseTotal')) document.getElementById('purchaseTotal').innerText = purchaseTotalVal.toFixed(2);

    // تحديث الرصيد السابق والمطلوب النهائي للمورد / الشريك
    const partnerName = document.getElementById('supplierName') ? document.getElementById('supplierName').value.trim() : '';
    let rawBal = 0;
    if (typeof getAccountBalance === 'function' && partnerName) {
        rawBal = getAccountBalance(partnerName);
    } else {
        const prevText = parseFloat(document.getElementById('purchasePrevBalanceDisplay')?.innerText) || 0;
        const balBadge = document.getElementById('supplierBalanceDisplay');
        const isDebt = balBadge && (balBadge.parentElement?.style?.backgroundColor?.includes('39, 174, 96') || balBadge.style?.color?.includes('green'));
        rawBal = isDebt ? prevText : -prevText;
    }

    if (document.getElementById('purchaseGrandTotalDisplay')) {
        const paid = parseFloat(document.getElementById('purchasePaid')?.value || 0);
        const newDebt = purchaseTotalVal - paid; // الجزء الآجل غير المدفوع من الفاتورة الحالية

        let finalGrandTotal = 0;

        if (rawBal > 0) {
            // الشريك مدين (عليه فلوس للمحل): المشتريات الآجلة تُخصم وتُسدد من مديونيته
            finalGrandTotal = rawBal - newDebt;
        } else if (rawBal < 0) {
            // الشريك دائن (له فلوس عند المحل): المشتريات الآجلة تزيد مستحقاته التي له
            finalGrandTotal = Math.abs(rawBal) + newDebt;
        } else {
            // لا يملك رصيد سابق
            finalGrandTotal = newDebt;
        }

        document.getElementById('purchaseGrandTotalDisplay').innerText = Math.abs(finalGrandTotal).toFixed(2);
    }

    calculatePurchaseChange();

    // تحديث إجمالي كل سطر في الجدول ليعكس التكلفة الإجمالية بعد توزيع أي قيم أخرى إن وجدت

    if (sub > 0) {

        const rows = document.querySelectorAll('#purchaseTableBody tr');

        purchaseCart.forEach((item, index) => {

            const row = rows[index];

            if (row) {

                const totalCell = row.cells[8]; // عمود الإجمالي هو العمود رقم 9 (اندكس 8)

                if (totalCell) totalCell.innerText = (item.price * item.qty).toFixed(2);

            }

        });

    }

}

function calculatePurchaseChange() {

    const paidInput = document.getElementById('purchasePaid');
    const paid = parseFloat(paidInput ? paidInput.value : 0) || 0;

    const remEl = document.getElementById('purchaseRemaining');
    if (remEl) {
        remEl.innerText = (purchaseTotalVal - paid).toFixed(2);
    }

}

async function savePurchase(force = false, accountChecked = false) {

    if (typeof checkPermission === 'function' && !checkPermission('docs_purchase')) return false;

    if (window.isSavingTransaction) return false;

    window.isSavingTransaction = true;

    // تعطيل أزرار الحفظ فوراً لمنع الضغط المزدوج
    const saveBtns = document.querySelectorAll('#purchase-section .btn-save, #purchase-section .action-btn');
    saveBtns.forEach(b => { b.disabled = true; b.style.pointerEvents = 'none'; b.style.opacity = '0.6'; });

    try {

        // --- 🛑 التحقق من حدود الباقة المجانية ---

        if (!isEditMode && typeof window.enforceSubscriptionCheck === 'function' && !window.enforceSubscriptionCheck('invoice')) {
            return false;
        }

        if (!purchaseCart || purchaseCart.length === 0) {

            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه',
                    msg: 'الفاتورة فارغة! لا يمكن الحفظ.'
                });
            } else {
                alert('⚠️ الفاتورة فارغة! لا يمكن الحفظ.');
            }

            return false;

        }

        const supplierInput = document.getElementById('supplierName');
        const supplier = supplierInput ? supplierInput.value.trim() : '';

        if (supplier && typeof checkAccountFrozenAndAlert === 'function') {
            if (checkAccountFrozenAndAlert(supplier)) {
                return false;
            }
        }

        const selectedMethod = (typeof getSelectedPaymentMethod === 'function') ? getSelectedPaymentMethod('purchase-section') : 'نقدي';
        const purchasePaidInput = document.getElementById('purchasePaid');
        const paidAmount = parseFloat(purchasePaidInput ? purchasePaidInput.value : 0) || 0;

        const subTotalInit = purchaseCart.reduce((a, b) => a + (b.price * b.qty), 0);
        const discValInit = parseFloat(document.getElementById('purchaseDiscount')?.value) || 0;
        const discTypeInit = document.getElementById('purchaseDiscountType')?.value || 'val';
        const discAmountInit = (discTypeInit === 'perc') ? (subTotalInit * discValInit / 100) : discValInit;
        const taxValInit = parseFloat(document.getElementById('purchaseTax')?.value) || 0;
        const taxTypeInit = document.getElementById('purchaseTaxType')?.value || 'val';
        const taxAmountInit = (taxTypeInit === 'perc') ? (subTotalInit * taxValInit / 100) : taxValInit;
        const finalTotalInit = subTotalInit - discAmountInit + taxAmountInit;

        const isCredit = (typeof window.isTransactionCredit === 'function')
            ? window.isTransactionCredit(selectedMethod, finalTotalInit, paidAmount, finalTotalInit - paidAmount)
            : false;

        if (!accountChecked && typeof window.ensurePartnerAccountExists === 'function') {
            const ok = await window.ensurePartnerAccountExists(supplier, 'مورد', isCredit, () => {
                window.isSavingTransaction = false;
                savePurchase(force, true);
            });
            if (!ok) return false;
        }

        const finalPartner = supplier || 'مورد نقدي';

        // التعامل مع الـ ID والتاريخ في وضع التعديل الرجعي

        let purchaseId;

        if (isEditMode && editingInvoiceId) {

            purchaseId = editingInvoiceId;

            // 🛑 عكس المخزن القديم وحذف السجلات السابقة باستخدام الوظيفة المركزية

            if (window.revertAndClearOldInvoice) {

                await window.revertAndClearOldInvoice(editingInvoiceId, editingInvoiceType);

            }

        } else {

            const badgeEl = document.getElementById('purchaseBadgeID');
            purchaseId = badgeEl ? badgeEl.innerText.trim() : (typeof getNextSequence === 'function' ? getNextSequence('شراء') : 1);

        }

        const dt = (isEditMode && editingOriginalDate && typeof editingOriginalDate === 'object' && editingOriginalDate.full)
            ? editingOriginalDate
            : (typeof getTransactionDateTime === 'function'
                ? getTransactionDateTime('purchaseDate', 'purchaseTime')
                : {
                    full: new Date().toLocaleString('ar-EG'),
                    iso: new Date().toLocaleDateString('en-CA'),
                    time: new Date().toTimeString().slice(0, 5)
                });

        const safeDate = (dt && dt.full) ? dt.full : new Date().toLocaleString('ar-EG');
        const safeDateISO = (dt && dt.iso) ? dt.iso : new Date().toLocaleDateString('en-CA');
        const safeTimeISO = (dt && dt.time) ? dt.time : new Date().toTimeString().slice(0, 5);

        // حساب النسبة لتوزيع الخصم والضريبة على الأصناف في السجل

        const itemsToProcess = [...purchaseCart];

        const subTotal = itemsToProcess.reduce((a, b) => a + (b.price * b.qty), 0);

        const discVal = parseFloat(document.getElementById('purchaseDiscount')?.value) || 0;

        const discType = document.getElementById('purchaseDiscountType')?.value || 'val';

        const discAmount = (discType === 'perc') ? (subTotal * discVal / 100) : discVal;

        const taxVal = parseFloat(document.getElementById('purchaseTax')?.value) || 0;

        const taxType = document.getElementById('purchaseTaxType')?.value || 'val';

        const taxAmount = (taxType === 'perc') ? (subTotal * taxVal / 100) : taxVal;

        const finalTotalVal = subTotal - discAmount + taxAmount;

        const ratio = subTotal > 0 ? (finalTotalVal / subTotal) : 1;

        const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';

        const isCash = typeof selectedMethod === 'string' && (selectedMethod.includes('نقدي') || selectedMethod.includes('نقدية') || selectedMethod.includes('كاش'));

        let purchasePaidAmount = 0;

        if (isCash) {

            purchasePaidAmount = parseFloat(finalTotalVal) || 0; // دفع كامل في الكاش

        } else {

            purchasePaidAmount = parseFloat(document.getElementById('purchasePaid')?.value) || 0; // المبلغ المدخل في الآجل

        }

        if (typeof window.productsDB === 'undefined') window.productsDB = [];
        if (typeof window.transactions === 'undefined') window.transactions = [];
        if (typeof window.accounts === 'undefined') window.accounts = [];

        itemsToProcess.forEach((item, idx) => {
            const p = (window.productsDB || []).find(x => x.id === item.id || x.name === item.name);
            const factor = item.unitFactor || 1;
            const itemUnitPriceBase = item.price / factor;
            const oldStock = p ? (parseFloat(p.stock) || 0) : 0;
            const oldCost = p ? (parseFloat(p.cost) || 0) : itemUnitPriceBase;

            if (p) {
                const baseQty = item.qty * factor;
                const totalOldValue = oldStock * oldCost;
                const totalAddedValue = baseQty * itemUnitPriceBase;
                const finalStockCount = oldStock + baseQty;

                if (oldStock > 0) {
                    p.cost = (totalOldValue + totalAddedValue) / finalStockCount;
                } else if (oldCost > 0) {
                    // إذا كان الرصيد صفر ولكن هناك تكلفة مسجلة مسبقاً
                    p.cost = (oldCost + itemUnitPriceBase) / 2;
                } else {
                    p.cost = itemUnitPriceBase;
                }

                // 3. تحديث الرصيد المخزني النهائي ورصيد المخزن المحدد
                p.stock = finalStockCount;
                if (!p.warehouseStocks) p.warehouseStocks = {};
                p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;

                // 3.5 تحديث رصيد وسعر التشكيلة المحددة (المقاس واللون) في مصفوفة الصنف
                if (p.variants && Array.isArray(p.variants)) {
                    const sSize = String(item.selectedSize || item.size || '').trim();
                    const sColor = String(item.selectedColor || item.color || '').trim();
                    if (sSize || sColor) {
                        const matchedVar = p.variants.find(v => 
                            (String(v.size || '').trim() === sSize) && 
                            (String(v.color || '').trim() === sColor)
                        ) || p.variants.find(v => 
                            (!sSize || String(v.size || '').trim() === sSize) && 
                            (!sColor || String(v.color || '').trim() === sColor)
                        );
                        if (matchedVar) {
                            const oldVarStock = (parseFloat(matchedVar.stock) || 0);
                            matchedVar.stock = oldVarStock + baseQty;
                            if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                            matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                            if (parseFloat(item.salePrice) > 0) {
                                matchedVar.price = parseFloat(item.salePrice);
                            }
                            // 🌟 تحديث تكلفة المقاس المحدد (Variant Cost) بدقة
                            if (itemUnitPriceBase > 0) {
                                const oldVarCost = (matchedVar.cost !== undefined && !isNaN(parseFloat(matchedVar.cost)) && parseFloat(matchedVar.cost) > 0)
                                    ? parseFloat(matchedVar.cost)
                                    : (parseFloat(p.cost) || itemUnitPriceBase);
                                if (oldVarStock > 0) {
                                    matchedVar.cost = parseFloat((((oldVarStock * oldVarCost) + (baseQty * itemUnitPriceBase)) / (oldVarStock + baseQty)).toFixed(2));
                                } else {
                                    matchedVar.cost = parseFloat(itemUnitPriceBase.toFixed(2));
                                }
                            }
                        }
                    } else if (parseFloat(item.salePrice) > 0) {
                        // إذا تم تعديل السعر للصنف العام بدون تحديد مقاس، نحدث السعر لكل التشكيلات التي كانت تحمل السعر الافتراضي
                        p.variants.forEach(v => {
                            v.price = parseFloat(item.salePrice);
                        });
                    }
                }

                // 4. تحديث أسعار البيع النهائية (القطاعي والجملة) بدقة لكل وحدة

                const salePrice = parseFloat(item.salePrice) || 0;

                const wholesalePrice = parseFloat(item.wholesalePrice) || 0;

                if (salePrice > 0 || wholesalePrice > 0) {

                    // إذا كانت الوحدة المشتراة هي الوحدة الأساسية (المعامل = 1)

                    if (factor === 1) {

                        if (salePrice > 0) {
                            p.price = salePrice;
                            // تحديث كافة التشكيلات غير المخصصة بسعر منفصل
                            if (p.variants && Array.isArray(p.variants)) {
                                p.variants.forEach(v => {
                                    if (!v.price || v.price === p.price || !item.selectedSize) {
                                        v.price = salePrice;
                                    }
                                });
                            }
                        }

                        if (wholesalePrice > 0) p.wholesale = wholesalePrice;

                        // تحديث الوحدة المقابلة في مصفوفة الوحدات أيضاً لضمان التزامن

                        if (p.units && p.units.length > 0) {

                            const baseU = p.units.find(u => parseFloat(u.factor) === 1) || p.units[0];

                            if (baseU) {

                                if (salePrice > 0) baseU.price = salePrice;

                                if (wholesalePrice > 0) baseU.wholesale = wholesalePrice;

                            }

                        }

                    } else {

                        // إذا كانت وحدة فرعية، نبحث عنها في المصفوفة ونحدث أسعارها هي فقط

                        if (p.units) {

                            const subU = p.units.find(u => u.unitName === (item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : item.unit));

                            if (subU) {

                                if (salePrice > 0) subU.price = salePrice;

                                if (wholesalePrice > 0) subU.wholesale = wholesalePrice;

                            }

                        }

                    }

                }

            }

            const itemNetTotal = (item.price * item.qty * ratio).toFixed(2);

            // تسجيل الحركة في سجل المعاملات

            transactions.push({

                date: safeDate,

                dateISO: safeDateISO,

                timeISO: safeTimeISO,

                type: 'شراء 📥',

                method: selectedMethod,

                invoiceId: purchaseId,

                product: p ? p.name : item.name,

                size: item.selectedSize || item.size || '',

                color: item.selectedColor || item.color || '',

                unit: item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة'),

                qty: item.qty,

                price: item.price,
                cost: itemUnitPriceBase,
                previousCost: oldCost,
                previousStock: oldStock,
                unitFactor: factor,

                salePrice: parseFloat(item.salePrice) || 0,

                wholesalePrice: parseFloat(item.wholesalePrice) || 0,

                total: itemNetTotal,

                partner: finalPartner,

                user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '-',

                notes: document.getElementById('purchaseNotes') ? document.getElementById('purchaseNotes').value.trim() : '',

                paidAmount: (idx === 0) ? purchasePaidAmount : 0,

                isInvoiceHead: (idx === 0),

                invoiceDiscount: (idx === 0) ? (parseFloat(document.getElementById('purchaseDiscount')?.value) || 0) : 0,
                invoiceDiscountType: (idx === 0) ? (document.getElementById('purchaseDiscountType')?.value || 'val') : 'val',
                invoiceTax: (idx === 0) ? (parseFloat(document.getElementById('purchaseTax')?.value) || 0) : 0,
                invoiceTaxType: (idx === 0) ? (document.getElementById('purchaseTaxType')?.value || 'val') : 'val',

                warehouse: activeWH,
                terminal: (window.BayanNetworkHub && window.BayanNetworkHub.isMasterServer) ? 'الجهاز الرئيسي 💻' : (((typeof getStore === 'function' ? getStore('bayan_device_name') : null)) || 'جهاز فرعي 📱'),

                editDate: isEditMode ? `${new Date().toLocaleString('ar-EG')} (تعديل بواسطة: ${(typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'مجهول'})` : '-'

            });

        });

        // ضمان وجود حساب المورد في قاعدة البيانات وتوليد كود تلقائي إذا لزم الأمر

        if (supplier && Array.isArray(accounts) && !accounts.find(a => a.name === supplier)) {

            const newAcc = {

                id: Date.now().toString(),

                name: supplier,

                type: 'supplier',

                code: 'SUP-' + Math.floor(1000 + Math.random() * 9000),

                debit: 0,

                credit: 0,

                createdAt: new Date().toISOString()

            };

            accounts.push(newAcc);
            if (typeof db !== 'undefined' && db.accounts) {
                try { await db.accounts.put(newAcc); } catch(e) { console.warn("DB account put:", e); }
            }

        }

        const pDiscReasonEl = document.getElementById('purchaseDiscountReason');
        const pDiscReason = pDiscReasonEl ? pDiscReasonEl.value.trim() : '';

        const pTaxReasonEl = document.getElementById('purchaseTaxReason');
        const pTaxReason = pTaxReasonEl ? pTaxReasonEl.value.trim() : '';

        if (pDiscReason && typeof addNewReason === 'function' && typeof purchaseDiscountReasons !== 'undefined') {
            addNewReason(pDiscReason, purchaseDiscountReasons, 'purchaseDiscountReasonsList');
        }

        if (pTaxReason && typeof addNewReason === 'function' && typeof purchaseTaxReasons !== 'undefined') {
            addNewReason(pTaxReason, purchaseTaxReasons, 'purchaseTaxReasonsList');
        }

        if (document.getElementById('purchaseDiscount')) document.getElementById('purchaseDiscount').value = 0;

        if (document.getElementById('purchaseTax')) document.getElementById('purchaseTax').value = 0;

        if (typeof saveData === 'function') {
            await saveData();
        }

        if (!isEditMode && typeof window.registerTrialInvoiceCreation === 'function') {
            window.registerTrialInvoiceCreation();
        }

        if (typeof logAuditAction === 'function') {
            const auditAction = isEditMode ? 'تحديث فاتورة شراء' : 'حفظ فاتورة شراء جديدة';
            logAuditAction(auditAction, `فاتورة شراء رقم #${purchaseId}, الإجمالي: ${finalTotalVal.toFixed(2)} ج.م, المورد: ${finalPartner}, طريقة الدفع: ${selectedMethod}`);
        }

        // إظهار رسالة النجاح

        if (typeof showCustomAlert === 'function') {
            showCustomAlert({

                type: 'success',

                titleText: isEditMode ? '✅ تم التعديل' : '✅ تم الحفظ بنجاح',

                msg: `تم ${isEditMode ? 'تحديث' : 'حفظ'} فاتورة الشراء رقم #${purchaseId} ومزامنة الأسعار مع المخزن.`

            });
        } else {
            alert(`✅ تم ${isEditMode ? 'تحديث' : 'حفظ'} فاتورة الشراء رقم #${purchaseId} بنجاح.`);
        }

        // تصفير الفاتورة والعودة للوضع الافتراضي (فاتورة جديدة فارغة)

        resetPurchase();

        return true;

    } catch (err) {
        console.error("❌ خطأ أثناء حفظ فاتورة الشراء:", err);
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'error',
                titleText: '❌ خطأ أثناء الحفظ',
                msg: 'حدث خطأ غير متوقع أثناء حفظ فاتورة الشراء:\n' + (err.message || err)
            });
        } else {
            alert('❌ خطأ أثناء حفظ فاتورة الشراء: ' + (err.message || err));
        }
        return false;
    } finally {

        const saveBtns = document.querySelectorAll('#purchase-section .btn-save, #purchase-section .action-btn');
        saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
        window.isSavingTransaction = false;

    }

}

function resetPurchase() {

    purchaseCart = [];

    // إنهاء وضع التعديل إذا كان نشطاً

    isEditMode = false;

    editingInvoiceId = null;

    editingOriginalDate = null;

    editingInvoiceType = null;

    const mainSaveBtn = document.querySelector('#purchase-section .btn-save');

    if (mainSaveBtn) {

        mainSaveBtn.style.background = '';

        mainSaveBtn.innerText = '💾 حفظ الفاتورة (F9)';

    }

    if (document.getElementById('supplierName')) document.getElementById('supplierName').value = '';

    if (document.getElementById('purchaseSearch')) document.getElementById('purchaseSearch').value = '';

    // تصفير مربع فلترة المشتريات

    const purchaseFilterInput = document.getElementById('purchaseCartFilterInput');

    if (purchaseFilterInput) {

        purchaseFilterInput.value = '';

        if (typeof filterPurchaseCartItems === 'function') filterPurchaseCartItems('');

    }

    if (document.getElementById('purchaseDiscount')) document.getElementById('purchaseDiscount').value = 0;

    if (document.getElementById('purchaseTax')) document.getElementById('purchaseTax').value = 0;

    if (document.getElementById('purchasePaid')) document.getElementById('purchasePaid').value = 0;

    if (document.getElementById('purchaseNotes')) document.getElementById('purchaseNotes').value = '';

    // إعادة ضبط نوع السداد للوضع الافتراضي (نقدي)

    const purchaseMethodSelect = document.getElementById('purchase-sectionPaymentMethodSelect');

    if (purchaseMethodSelect) {

        purchaseMethodSelect.value = 'نقدي';

        const purchasePaidBox = document.getElementById('purchasePaidBox');

        const purchaseRemainingBox = document.getElementById('purchaseRemainingBox');

        if (purchasePaidBox) purchasePaidBox.style.display = 'none';

        if (purchaseRemainingBox) purchaseRemainingBox.style.display = 'none';

    }

    const now = new Date();

    if (document.getElementById('purchaseDate')) document.getElementById('purchaseDate').value = now.toLocaleDateString('en-CA');

    if (document.getElementById('purchaseTime')) document.getElementById('purchaseTime').value = now.toTimeString().slice(0, 5);

    if (document.getElementById('purchaseBadgeID')) {
        document.getElementById('purchaseBadgeID').innerText = typeof getNextSequence === 'function' ? getNextSequence('شراء') : 1;
    }

    if (typeof renderPurchaseCart_Finalized_V3 === 'function') renderPurchaseCart_Finalized_V3();

    if (typeof saveCurrentTabState === 'function') saveCurrentTabState();
    if (typeof updateActiveTabTitle === 'function') updateActiveTabTitle('', 'شراء');
}

// ================= منطق حركة الصنف (History Logic) =================

let historySearchActiveIndex = -1;
