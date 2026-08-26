// ============================================================
//  نافذة اختيار المقاس واللون وسرعة الكاشير (Fashion Matrix Picker)
// ============================================================
function showVariantSelectionModal(product, context = 'sales') {
    closeVariantSelectionModal(); // إغلاق أي نافذة قديمة وتنظيف المستمعات

    const variants = product.variants || [];
    if (variants.length === 0) {
        addToCart(product.id);
        return;
    }

    // ترتيب تلقائي للمقاسات والألوان لكي تكون المجموعات مرتبة منطقياً بجانب بعضها
    function getSizeWeight(s) {
        if (!s) return 999;
        let str = String(s).toUpperCase().trim();
        if (str === 'XS') return 1;
        if (str === 'S' || str === 'SMALL') return 2;
        if (str === 'M' || str === 'MEDIUM') return 3;
        if (str === 'L' || str === 'LARGE') return 4;
        if (str === 'XL') return 5;
        if (str === 'XXL' || str === '2XL') return 6;
        if (str === 'XXXL' || str === '3XL') return 7;
        if (str === '4XL') return 8;
        if (str === '5XL') return 9;
        let num = parseFloat(str);
        if (!isNaN(num)) return 100 + num; // الأرقام تأتي بعد الحروف
        return 999;
    }

    variants.sort((a, b) => {
        let wa = getSizeWeight(a.size);
        let wb = getSizeWeight(b.size);
        if (wa !== wb) return wa - wb;
        let ca = a.color || '';
        let cb = b.color || '';
        return ca.localeCompare(cb, 'ar');
    });

    variantModalProduct = product;
    variantModalContext = context;
    variantModalSelectedIndex = 0;

    const priceLevelSelect = document.getElementById('salesPriceLevel');
    const priceLevel = priceLevelSelect ? priceLevelSelect.value : 'retail';

    // تحديد المخزن النشط حسب السياق المعروض
    let activeWH = 'المخزن الرئيسي';
    if (context === 'transfer') {
        activeWH = document.getElementById('transferFrom')?.value || (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || 'المخزن الرئيسي';
    } else if (context === 'sales' || context === 'salesReturn') {
        activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || 'المخزن الرئيسي';
    } else if (context === 'purchase' || context === 'purReturn') {
        activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || 'المخزن الرئيسي';
    } else if (context === 'adj') {
        activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || 'المخزن الرئيسي';
    } else {
        activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || ((typeof getStore === 'function' ? getStore('activeWarehouse') : null) || 'المخزن الرئيسي');
    }
    activeWH = String(activeWH).trim();

    let cardsHtml = variants.map((v, i) => {
        let vPrice = 0;
        let priceTitle = 'سعر البيع';

        if (context === 'purchase' || context === 'purReturn' || context === 'transfer' || context === 'adj') {
            vPrice = parseFloat(v.cost) || parseFloat(product.cost) || 0;
            priceTitle = 'سعر التكلفة';
        } else {
            vPrice = (priceLevel === 'wholesale') 
                ? (parseFloat(v.wholesale) || parseFloat(v.price) || parseFloat(product.wholesale) || parseFloat(product.price) || 0)
                : (parseFloat(v.price) || parseFloat(product.price) || 0);
            priceTitle = (priceLevel === 'wholesale') ? 'سعر الجملة' : 'سعر البيع';
        }

        // حساب الرصيد الخاص بالمخزن النشط فقط
        let stockVal = 0;
        if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[activeWH] !== undefined) {
            stockVal = parseFloat(v.warehouseStocks[activeWH]) || 0;
        } else {
            stockVal = parseFloat(v.stock) || 0;
        }

        const stockColor = stockVal > 0 ? '#047857' : '#dc2626';
        const stockBg = stockVal > 0 ? '#ecfdf5' : '#fef2f2';

        const isColorOnly = !v.size || v.size === 'موحد' || v.size === 'قياسي' || v.size.trim() === '';

        return `
            <div class="variant-picker-card" data-index="${i}" onclick="selectVariantAndAddToCart(${product.id}, ${i}, '${context}')"
                onmouseenter="variantModalSelectedIndex = ${i}; updateVariantModalSelection();"
                style="background: white; border: 2px solid #e2e8f0; border-radius: 14px; padding: 12px; cursor: pointer; transition: all 0.15s ease; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.03); user-select: none;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    ${isColorOnly 
                        ? `<span class="variant-size-badge" style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 3px 12px; border-radius: 8px; font-weight: 900; font-size: 0.95rem;">🎨 ${v.color || 'لون مميز'}</span>
                           <span style="font-weight: 800; color: #64748b; font-size: 0.8rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">لون فقط</span>`
                        : `<span class="variant-size-badge" style="background: #1e293b; color: white; padding: 3px 12px; border-radius: 8px; font-weight: 900; font-size: 1rem;">${v.size}</span>
                           <span style="font-weight: 800; color: #475569; font-size: 0.9rem;">🎨 ${v.color || 'موحد'}</span>`
                    }
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
                    <span style="color: ${stockColor}; background: ${stockBg}; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 800;">
                        المتاح (${activeWH}): ${stockVal}
                    </span>
                    <div style="text-align: left;">
                        <span style="font-size: 0.68rem; color: #64748b; display: block; font-weight: bold;">${priceTitle}</span>
                        <span style="color: #047857; font-weight: 900; font-size: 1.05rem;">
                            ${vPrice.toFixed(2)} ج.م
                        </span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const modalHtml = `
        <div id="bayanVariantPickerOverlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75);  z-index:11500; display:flex; align-items:center; justify-content:center; direction:rtl; font-family:'Cairo',sans-serif;" onclick="if(event.target === this) closeVariantSelectionModal();">
            <div style="background:white; border-radius:24px; width:920px; max-width:96%; padding:24px; box-shadow:0 25px 60px rgba(0,0,0,0.35); border:2.5px solid #10b981; animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #f1f5f9; padding-bottom:12px; margin-bottom:14px;">
                    <div>
                        <h3 style="margin:0; font-size:1.25rem; color:#1e293b; font-weight:900;">
                            👕 اختر المقاس واللون للموديل: <span style="color:#047857;">${product.name}</span>
                        </h3>
                        <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                            <span style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:2px 8px; border-radius:6px; font-size:0.78rem; font-weight:800;">
                                ⌨️ تحكم بالأسهم ( ⬅️ ➡️ ⬆️ ⬇️ ) + اضغط Enter للاختيار السريع
                            </span>
                        </div>
                    </div>
                    <button onclick="closeVariantSelectionModal()" style="background:#f1f5f9; border:none; width:34px; height:34px; border-radius:50%; font-size:1.3rem; cursor:pointer; color:#64748b; font-weight:900; display:flex; align-items:center; justify-content:center; transition:0.2s;" onmouseover="this.style.background='#fee2e2'; this.style.color='#dc2626';" onmouseout="this.style.background='#f1f5f9'; this.style.color='#64748b';">&times;</button>
                </div>
                <div class="variant-cards-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:14px; max-height:480px; overflow-y:auto; padding:6px;">
                    ${cardsHtml}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    window.addEventListener('keydown', handleVariantPickerKeydown, true);

    setTimeout(() => {
        updateVariantModalSelection();
    }, 40);
}

function handleVariantPickerKeydown(e) {
    const overlay = document.getElementById('bayanVariantPickerOverlay');
    if (!overlay || !variantModalProduct || !variantModalProduct.variants) return;

    const total = variantModalProduct.variants.length;
    if (total === 0) return;

    const cards = overlay.querySelectorAll('.variant-picker-card');
    if (!cards || cards.length === 0) return;

    // حساب عدد الأعمدة ديناميكياً بناءً على موضع أول كارتين
    let cols = 3;
    if (cards.length >= 2) {
        const firstTop = cards[0].offsetTop;
        let cCount = 0;
        for (let i = 0; i < cards.length; i++) {
            if (cards[i].offsetTop === firstTop) cCount++;
            else break;
        }
        if (cCount > 0) cols = cCount;
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
    }

    if (e.key === 'Escape') {
        closeVariantSelectionModal();
        return;
    }

    if (e.key === 'Enter') {
        if (variantModalSelectedIndex >= 0 && variantModalSelectedIndex < total) {
            selectVariantAndAddToCart(variantModalProduct.id, variantModalSelectedIndex, variantModalContext);
        }
        return;
    }

    if (e.key === 'ArrowLeft') {
        // في RTL: السهم الأيسر يتحرك للكارت التالي
        variantModalSelectedIndex = (variantModalSelectedIndex + 1) % total;
        updateVariantModalSelection();
    } else if (e.key === 'ArrowRight') {
        // في RTL: السهم الأيمن يتحرك للكارت السابق
        variantModalSelectedIndex = (variantModalSelectedIndex - 1 + total) % total;
        updateVariantModalSelection();
    } else if (e.key === 'ArrowDown') {
        if (variantModalSelectedIndex + cols < total) {
            variantModalSelectedIndex += cols;
        } else {
            variantModalSelectedIndex = Math.min(total - 1, variantModalSelectedIndex + 1);
        }
        updateVariantModalSelection();
    } else if (e.key === 'ArrowUp') {
        if (variantModalSelectedIndex - cols >= 0) {
            variantModalSelectedIndex -= cols;
        } else {
            variantModalSelectedIndex = Math.max(0, variantModalSelectedIndex - 1);
        }
        updateVariantModalSelection();
    }
}

function updateVariantModalSelection() {
    const overlay = document.getElementById('bayanVariantPickerOverlay');
    if (!overlay) return;

    const cards = overlay.querySelectorAll('.variant-picker-card');
    cards.forEach((card, idx) => {
        if (idx === variantModalSelectedIndex) {
            card.style.borderColor = '#10b981';
            card.style.background = 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)';
            card.style.transform = 'scale(1.05)';
            card.style.boxShadow = '0 12px 28px rgba(16, 185, 129, 0.4)';
            card.style.outline = '3px solid #10b981';
            card.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        } else {
            card.style.borderColor = '#e2e8f0';
            card.style.background = 'white';
            card.style.transform = 'none';
            card.style.boxShadow = '0 2px 5px rgba(0,0,0,0.03)';
            card.style.outline = 'none';
        }
    });
}

function closeVariantSelectionModal() {
    const overlay = document.getElementById('bayanVariantPickerOverlay');
    if (overlay) overlay.remove();
    window.removeEventListener('keydown', handleVariantPickerKeydown, true);
    const prevContext = variantModalContext;
    variantModalProduct = null;
    
    if (prevContext === 'transfer') {
        const searchInput = document.getElementById('transferProductSearch');
        if (searchInput) searchInput.focus();
    } else if (prevContext === 'purchase') {
        const searchInput = document.getElementById('purchaseSearch');
        if (searchInput) searchInput.focus();
    } else if (prevContext === 'adj') {
        const searchInput = document.getElementById('adjSearch');
        if (searchInput) searchInput.focus();
    } else if (prevContext === 'salesReturn') {
        const searchInput = document.getElementById('salesReturnSearch');
        if (searchInput) searchInput.focus();
    } else if (prevContext === 'purReturn') {
        const searchInput = document.getElementById('purReturnSearch');
        if (searchInput) searchInput.focus();
    } else {
        const searchInput = document.getElementById('productSearch');
        if (searchInput) searchInput.focus();
    }
}
window.closeVariantSelectionModal = closeVariantSelectionModal;

function selectVariantAndAddToCart(productId, variantIndex, context = 'sales') {
    const product = productsDB.find(p => p.id === productId);
    if (!product || !product.variants || !product.variants[variantIndex]) return;

    const variant = product.variants[variantIndex];
    closeVariantSelectionModal();

    const defUnit = (product.units && product.units.length > 0) ? product.units[0] : null;
    const unitName = defUnit ? defUnit.unitName : (product.unit || 'قطعة');
    const factor = defUnit ? parseFloat(defUnit.factor) : 1;

    if (context === 'transfer') {
        // تعبئة حقول هيدر التحويل المخزني فوراً بالصنف والمقاس واللون والتكلفة
        if (typeof fillTransferHeaderWithUnit === 'function') {
            fillTransferHeaderWithUnit(product, defUnit || { unitName: product.unit || 'قطعة', factor: 1, cost: product.cost });
        }
        
        const sizeInput = document.getElementById('transferSize');
        const colorInput = document.getElementById('transferColor');
        const priceInput = document.getElementById('transferPrice');
        const qtyInput = document.getElementById('transferQty');

        if (sizeInput) sizeInput.value = variant.size || '';
        if (colorInput) colorInput.value = variant.color || '';
        if (priceInput) {
            const vCost = parseFloat(variant.cost) || parseFloat(product.cost) || 0;
            priceInput.value = vCost.toFixed(2);
        }

        // قفز المؤشر فوراً لمربع الكمية مع تحديد الرقم لسرعة الضغط على Enter
        if (qtyInput) {
            qtyInput.value = '1';
            qtyInput.focus();
            setTimeout(() => qtyInput.select(), 20);
        }
    } else if (context === 'purchase') {
        // تعبئة هيدر الشراء والتوريد فوراً وتخطي إعادة فتح النافذة
        currentPurchaseHeaderProductId = product.id;
        currentPurchaseHeaderUnit = defUnit;
        window._pendingPurchaseVariant = variant;

        const pSearch = document.getElementById('purchaseSearch');
        const hPrice = document.getElementById('purchaseHeaderPrice');
        const hSale = document.getElementById('purchaseHeaderSalePrice');
        const hWholesale = document.getElementById('purchaseHeaderWholesalePrice');
        const hQty = document.getElementById('purchaseHeaderQty');

        if (pSearch) pSearch.value = product.name;
        if (hPrice) hPrice.value = (parseFloat(variant.cost) || parseFloat(product.cost) || 0).toFixed(2);
        if (hSale) hSale.value = (parseFloat(variant.price) || parseFloat(product.price) || 0).toFixed(2);
        if (hWholesale) hWholesale.value = (parseFloat(variant.wholesale) || parseFloat(product.wholesale) || 0).toFixed(2);

        if (hQty) {
            hQty.value = '1';
            hQty.focus();
            setTimeout(() => hQty.select(), 20);
        }
    } else if (context === 'adj') {
        // تعبئة هيدر الجرد والتسوية
        window.selectedAdjItem = {
            ...product,
            selectedSize: variant.size || '',
            selectedColor: variant.color || '',
            size: variant.size || '',
            color: variant.color || '',
            cost: parseFloat(variant.cost) || parseFloat(product.cost) || 0,
            stock: variant.stock !== undefined ? variant.stock : product.stock
        };
        const sEl = document.getElementById('adjSearch');
        const pEl = document.getElementById('adjPrice');
        const qEl = document.getElementById('adjQty');
        if (sEl) sEl.value = product.name + (variant.size ? ` [${variant.size}]` : '') + (variant.color ? ` (${variant.color})` : '');
        if (pEl) pEl.value = (parseFloat(variant.cost) || parseFloat(product.cost) || 0).toFixed(2);
        document.querySelectorAll('.adj-current-stock-val').forEach(el => el.innerText = variant.stock !== undefined ? variant.stock : (product.stock || 0));
        if (qEl) {
            qEl.value = '1';
            qEl.focus();
            setTimeout(() => qEl.select(), 20);
        }
    } else if (context === 'sales') {
        // تعبئة هيدر المبيعات بالصنف والمقاس واللون والسعر والقفز للكمية
        currentHeaderProductId = product.id;
        currentHeaderUnit = defUnit;
        window._pendingSalesVariant = variant;

        const pSearch = document.getElementById('productSearch');
        const hPrice = document.getElementById('headerPrice');
        const hQty = document.getElementById('headerQty');

        if (pSearch) pSearch.value = product.name;
        if (hPrice) {
            const priceLevelSelect = document.getElementById('salesPriceLevel');
            const priceLevel = priceLevelSelect ? priceLevelSelect.value : 'retail';
            const vPrice = (priceLevel === 'wholesale') 
                ? (parseFloat(variant.wholesale) || parseFloat(variant.price) || parseFloat(product.wholesale) || parseFloat(product.price) || 0)
                : (parseFloat(variant.price) || parseFloat(product.price) || 0);
            hPrice.value = vPrice.toFixed(2);
        }

        if (hQty) {
            hQty.value = '1';
            hQty.focus();
            setTimeout(() => hQty.select(), 20);
        }
    } else if (context === 'salesReturn') {
        // تعبئة هيدر مرتجع البيع بالصنف والمقاس واللون والسعر والقفز للكمية
        currentReturnHeaderProductId = product.id;
        currentReturnHeaderUnit = defUnit;
        window._pendingSalesReturnVariant = variant;

        const pSearch = document.getElementById('returnProductSearch');
        const hPrice = document.getElementById('returnHeaderPrice');
        const hQty = document.getElementById('returnHeaderQty');

        if (pSearch) pSearch.value = product.name;
        if (hPrice) {
            const vPrice = parseFloat(variant.price) || parseFloat(product.price) || 0;
            hPrice.value = vPrice.toFixed(2);
        }

        if (hQty) {
            hQty.value = '1';
            hQty.focus();
            setTimeout(() => hQty.select(), 20);
        }
    } else if (context === 'purReturn') {
        // تعبئة هيدر مرتجع الشراء بالصنف والمقاس واللون والسعر والقفز للكمية
        currentReturnHeaderProductId = product.id;
        currentReturnHeaderUnit = defUnit;
        window._pendingPurReturnVariant = variant;

        const pSearch = document.getElementById('purReturnProductSearch');
        const hPrice = document.getElementById('purReturnHeaderPrice');
        const hQty = document.getElementById('purReturnHeaderQty');

        if (pSearch) pSearch.value = product.name;
        if (hPrice) {
            const vCost = parseFloat(variant.cost) || parseFloat(product.cost) || 0;
            hPrice.value = vCost.toFixed(2);
        }

        if (hQty) {
            hQty.value = '1';
            hQty.focus();
            setTimeout(() => hQty.select(), 20);
        }
    }
}
window.selectVariantAndAddToCart = selectVariantAndAddToCart;
window.showVariantSelectionModal = showVariantSelectionModal;

function renderVariantSelectElements(item, index, cartType = 'sales') {
    const pInfo = productsDB.find(p => p.id === item.id || p.name === item.name);
    const variants = (pInfo && pInfo.variants && Array.isArray(pInfo.variants)) ? pInfo.variants : [];

    const currentSize = item.selectedSize || item.size || '';
    const currentColor = item.selectedColor || item.color || '';

    // 1. خيارات المقاسات (Dropdown للمقاسات بدون أي شرطة)
    const availableSizes = [...new Set(variants.map(v => v.size).filter(s => s && String(s).trim() !== '' && String(s).trim() !== '-'))];
    if (currentSize && currentSize !== '-' && !availableSizes.includes(currentSize)) {
        availableSizes.unshift(currentSize);
    }

    let sizeElement = `<span style="color:#94a3b8; font-weight:bold;">عام</span>`;
    if (availableSizes.length > 1) {
        const sizeOptions = availableSizes.map(s => `<option value="${s}" ${currentSize === s ? 'selected' : ''}>${s}</option>`).join('');
        sizeElement = `<select onchange="updateItemVariantAttr(${index}, 'size', this.value, '${cartType}')" title="اختر المقاس"
            style="width: 80px; max-width: 100%; border: 1.5px solid #a7f3d0; background: #ecfdf5; color: #047857; border-radius: 6px; padding: 4px 2px; font-weight: 900; font-size: 0.85rem; outline: none; cursor: pointer; text-align: center;">
            ${sizeOptions}
        </select>`;
    } else if (availableSizes.length === 1 || (currentSize && currentSize !== '-')) {
        const displaySize = availableSizes[0] || currentSize;
        sizeElement = `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">${displaySize}</span>`;
    }

    // 2. خيارات الألوان (Dropdown للألوان بدون أي شرطة)
    const availableColors = [...new Set(variants.map(v => v.color).filter(c => c && String(c).trim() !== '' && String(c).trim() !== '-'))];
    if (currentColor && currentColor !== '-' && !availableColors.includes(currentColor)) {
        availableColors.unshift(currentColor);
    }

    let colorElement = `<span style="color:#94a3b8; font-weight:bold;">عام</span>`;
    if (availableColors.length > 1) {
        const colorOptions = availableColors.map(c => `<option value="${c}" ${currentColor === c ? 'selected' : ''}>${c}</option>`).join('');
        colorElement = `<select onchange="updateItemVariantAttr(${index}, 'color', this.value, '${cartType}')" title="اختر اللون"
            style="width: 80px; max-width: 100%; border: 1.5px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 6px; padding: 4px 2px; font-weight: 900; font-size: 0.85rem; outline: none; cursor: pointer; text-align: center;">
            ${colorOptions}
        </select>`;
    } else if (availableColors.length === 1 || (currentColor && currentColor !== '-')) {
        const displayColor = availableColors[0] || currentColor;
        colorElement = `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">${displayColor}</span>`;
    }

    return { sizeElement, colorElement };
}
window.renderVariantSelectElements = renderVariantSelectElements;

function updateItemVariantAttr(index, attr, value, cartType = 'sales') {
    let currentCart = cart;
    if (cartType === 'purchase') currentCart = purchaseCart;
    else if (cartType === 'return') currentCart = returnCart;
    else if (cartType === 'purReturn') currentCart = purReturnCart;
    else if (cartType === 'adj') currentCart = (typeof window.adjCart !== 'undefined' ? window.adjCart : []);
    else if (cartType === 'transfer') currentCart = (typeof window.transferItemsBatch !== 'undefined' ? window.transferItemsBatch : []);

    const item = currentCart[index];
    if (!item) return;

    if (attr === 'size') {
        item.selectedSize = value;
        item.size = value;
    } else if (attr === 'color') {
        item.selectedColor = value;
        item.color = value;
    }

    // البحث عن التشكيلة المطابقة لتحديث السعر والباركود
    const pInfo = productsDB.find(p => p.id === item.id || p.name === item.name);
    if (pInfo && pInfo.variants && Array.isArray(pInfo.variants)) {
        const matchedVariant = pInfo.variants.find(v => 
            (!item.selectedSize || v.size === item.selectedSize) && 
            (!item.selectedColor || v.color === item.selectedColor)
        );
        if (matchedVariant) {
            if (matchedVariant.barcode) item.barcode = matchedVariant.barcode;
            if (matchedVariant.cost && (cartType === 'transfer' || cartType === 'purchase')) {
                item.price = parseFloat(matchedVariant.cost) || item.price;
            }
            if (matchedVariant.price && cartType === 'sales' && parseFloat(matchedVariant.price) > 0) {
                const priceLevel = document.getElementById('salesPriceLevel')?.value || 'retail';
                const vPrice = (priceLevel === 'wholesale' && parseFloat(matchedVariant.wholesale) > 0) ? parseFloat(matchedVariant.wholesale) : parseFloat(matchedVariant.price);
                item.price = vPrice;
                item.originalPrice = vPrice;
            }
        }
    }

    if (cartType === 'sales') {
        renderCart();
        if (typeof saveCurrentTabState === 'function') saveCurrentTabState();
    } else if (cartType === 'purchase') {
        if (typeof renderPurchaseCart_Finalized_V3 === 'function') renderPurchaseCart_Finalized_V3();
        if (typeof saveCurrentTabState === 'function') saveCurrentTabState();
    } else if (cartType === 'return') {
        if (typeof renderReturnCart === 'function') renderReturnCart();
    } else if (cartType === 'purReturn') {
        if (typeof renderPurReturnCart === 'function') renderPurReturnCart();
    } else if (cartType === 'adj') {
        if (typeof renderAdjTable === 'function') renderAdjTable();
    } else if (cartType === 'transfer') {
        if (typeof renderTransferTable === 'function') renderTransferTable();
    }
}
window.updateItemVariantAttr = updateItemVariantAttr;
