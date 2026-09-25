// ============================================================
//  نافذة اختيار المقاس واللون وسرعة الكاشير (Fashion Matrix Picker)
// ============================================================

// ترتيب تلقائي للمقاسات والألوان لكي تكون المجموعات مرتبة منطقياً
function getSizeWeight(s) {
    if (!s) return 999;
    let str = String(s).toUpperCase().trim();
    if (str === 'XXS') return 0;
    if (str === 'XS') return 1;
    if (str === 'S' || str === 'SMALL') return 2;
    if (str === 'M' || str === 'MEDIUM') return 3;
    if (str === 'L' || str === 'LARGE') return 4;
    if (str === 'XL') return 5;
    if (str === 'XXL' || str === '2XL') return 6;
    if (str === 'XXXL' || str === '3XL') return 7;
    if (str === '4XL') return 8;
    if (str === '5XL') return 9;
    if (str === '6XL') return 10;
    let num = parseFloat(str);
    if (!isNaN(num)) return 100 + num; // الأرقام مثل 36, 38, 40 تأتي بعد الحروف
    return 900;
}

// دالة مساعدة لتحديد المخزن النشط حسب السياق
function getVariantModalActiveWH(context) {
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
        activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || (typeof getStore === 'function' ? getStore('activeWarehouse') : 'المخزن الرئيسي') || 'المخزن الرئيسي';
    }
    return String(activeWH).trim();
}

// دالة مساعدة لحساب السعر والرصيد لأي تشكيلة
function getVariantPricingAndStock(product, v, context, activeWH, priceLevel) {
    let vPrice = 0;
    let priceTitle = 'سعر البيع';

    if (context === 'transfer') {
        if (typeof window.getEffectiveTransferPrice === 'function') {
            vPrice = window.getEffectiveTransferPrice(product, v);
            priceTitle = window.getTransferPriceLabel ? window.getTransferPriceLabel() : 'سعر التحويل';
        } else {
            vPrice = parseFloat(v.cost) || parseFloat(product.cost) || 0;
            priceTitle = 'سعر التحويل';
        }
    } else if (context === 'adj') {
        if (typeof window.getEffectiveAdjustmentPrice === 'function') {
            vPrice = window.getEffectiveAdjustmentPrice(product, v);
            priceTitle = window.getAdjustmentPriceLabel ? window.getAdjustmentPriceLabel() : 'سعر القطاعي';
        } else {
            const basePrice = parseFloat(product.price) || 0;
            let pVal = parseFloat(v.price) || basePrice;
            if (Array.isArray(product.variants) && product.variants.length > 0 && basePrice > 0) {
                const firstP = parseFloat(product.variants[0].price) || 0;
                const allSameP = product.variants.every(x => (parseFloat(x.price) || 0) === firstP);
                if (allSameP && Math.abs(pVal - basePrice) > 0.01) pVal = basePrice;
            }
            vPrice = pVal || 0;
            priceTitle = 'سعر القطاعي';
        }
    } else if (context === 'purchase' || context === 'purReturn') {
        vPrice = parseFloat(v.cost) || parseFloat(product.cost) || 0;
        priceTitle = 'سعر التكلفة';
    } else {
        const basePrice = parseFloat(product.price) || 0;
        const baseWs = parseFloat(product.wholesale) || parseFloat(product.wholesalePrice) || 0;
        let pVal = (priceLevel === 'wholesale') 
            ? (parseFloat(v.wholesale) || parseFloat(v.wholesalePrice) || parseFloat(v.price) || baseWs || basePrice)
            : (parseFloat(v.price) || basePrice);

        // ذكاء اصطناعي: إذا كانت كافة المقاسات تمتلك نفس السعر ولم يتم تخصيص أسعار منفصلة لكل مقاس
        if (Array.isArray(product.variants) && product.variants.length > 0) {
            if (priceLevel === 'wholesale' && baseWs > 0) {
                const firstWs = parseFloat(product.variants[0].wholesale || product.variants[0].wholesalePrice) || 0;
                const allSameWs = product.variants.every(x => (parseFloat(x.wholesale || x.wholesalePrice) || 0) === firstWs);
                if (allSameWs && Math.abs(pVal - baseWs) > 0.01) pVal = baseWs;
            } else if (basePrice > 0) {
                const firstP = parseFloat(product.variants[0].price) || 0;
                const allSameP = product.variants.every(x => (parseFloat(x.price) || 0) === firstP);
                if (allSameP && Math.abs(pVal - basePrice) > 0.01) pVal = basePrice;
            }
        }
        vPrice = pVal || 0;
        priceTitle = (priceLevel === 'wholesale') ? 'سعر الجملة' : 'سعر البيع';
    }

    let stockVal = 0;
    if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[activeWH] !== undefined) {
        stockVal = parseFloat(v.warehouseStocks[activeWH]) || 0;
    } else if (activeWH === 'المخزن الرئيسي') {
        stockVal = parseFloat(v.stock) || 0;
    } else {
        stockVal = 0;
    }

    return { vPrice, priceTitle, stockVal };
}

// دالة بناء كارت التشكيلة
function renderVariantPickerCardHtml(product, v, context, activeWH, priceLevel, isVerticalMode = false) {
    const { vPrice, priceTitle, stockVal } = getVariantPricingAndStock(product, v, context, activeWH, priceLevel);
    const stockColor = stockVal > 0 ? '#047857' : '#dc2626';
    const stockBg = stockVal > 0 ? '#ecfdf5' : '#fef2f2';
    const hasSize = v.size && v.size !== 'موحد' && v.size !== 'قياسي' && v.size.trim() !== '';

    const prodDisc = (context === 'sales' && product.discount) ? parseFloat(product.discount) : 0;
    let priceSnippet = '';
    if (prodDisc > 0) {
        const netPrice = vPrice - (vPrice * prodDisc / 100);
        priceSnippet = `
            <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.1;">
                <span style="color: #047857; font-weight: 900; font-size: 1.05rem; white-space: nowrap; direction: ltr;">
                    ${netPrice.toFixed(2)} <span style="font-size: 0.7rem; font-weight: bold;">ج.م</span>
                </span>
                <div style="display: flex; gap: 4px; align-items: center; font-size: 0.72rem;">
                    <span style="text-decoration: line-through; color: #94a3b8; font-weight: 700;">${vPrice.toFixed(2)}</span>
                    <span style="background: #fee2e2; color: #b91c1c; font-weight: 900; padding: 0 4px; border-radius: 4px;">-${prodDisc}%</span>
                </div>
            </div>
        `;
    } else {
        priceSnippet = `
            <span style="color: #047857; font-weight: 900; font-size: 1.05rem; white-space: nowrap; direction: ltr; display: inline-block;">
                ${vPrice.toFixed(2)} <span style="font-size: 0.7rem; font-weight: bold;">ج.م</span>
            </span>
        `;
    }

    const isOutOfStockBlocked = ((context === 'sales' || context === 'transfer') && stockVal <= 0);
    const cardBorderColor = isOutOfStockBlocked ? '#fca5a5' : '#e2e8f0';
    const cardBgColor = isOutOfStockBlocked ? '#fff8f8' : 'white';
    const cardOpacity = isOutOfStockBlocked ? '0.78' : '1';

    if (isVerticalMode) {
        // الوضع الرأسي (طلب العميل: تتابع المقاسات تحت اللون بشكل طولي متناسق بدون أي تداخل أو خروج للكلام)
        return `
            <div class="variant-picker-card" data-index="${v._origIndex}" data-size="${(v.size || '').trim()}" data-color="${(v.color || '').trim()}" data-barcode="${(v.barcode || '').trim()}"
                onclick="selectVariantAndAddToCart(${product.id}, ${v._origIndex}, '${context}')"
                onmouseenter="setVariantModalSelectedIndexByCard(this);"
                style="background: ${cardBgColor}; border: 2px solid ${cardBorderColor}; border-radius: 12px; padding: 10px 12px; cursor: pointer; transition: all 0.15s ease; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.03); user-select: none; width: 100%; box-sizing: border-box; overflow: hidden; opacity: ${cardOpacity};">
                
                <!-- السطر الأول: المقاس في اليمين، وسعر البيع في اليسار -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 6px; box-sizing: border-box;">
                    <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; min-width: 0;">
                        ${hasSize
                            ? `<span class="variant-size-badge" style="background: ${isOutOfStockBlocked ? '#64748b' : '#1e293b'}; color: white; padding: 3px 10px; border-radius: 8px; font-weight: 900; font-size: 0.95rem; min-width: 36px; text-align: center; white-space: nowrap; flex-shrink: 0;">${v.size}</span>
                               <span style="font-weight: 800; color: #475569; font-size: 0.84rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">مقاس ${v.size}</span>`
                            : `<span class="variant-size-badge" style="background: ${isOutOfStockBlocked ? '#64748b' : 'linear-gradient(135deg, #059669, #047857)'}; color: white; padding: 3px 10px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; white-space: nowrap;">🎨 ${v.color || 'تشكيلة أساسية'}</span>`
                        }
                    </div>
                    <div style="text-align: left; flex-shrink: 0;">
                        ${priceSnippet}
                    </div>
                </div>

                <!-- السطر الثاني: الرصيد المتاح ونوع السعر -->
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-top: 1px dashed #e2e8f0; padding-top: 6px; box-sizing: border-box; gap: 6px;">
                    <span style="color: ${stockColor}; background: ${stockBg}; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%; border: ${isOutOfStockBlocked ? '1px solid #fca5a5' : 'none'};" title="المخزن: ${activeWH}">
                        ${isOutOfStockBlocked ? '🛑 المتاح: <b>0</b>' : `📦 المتاح: <b>${stockVal}</b>`}
                    </span>
                    <span style="font-size: 0.72rem; color: #64748b; font-weight: bold; white-space: nowrap; flex-shrink: 0;">
                        ${priceTitle}
                    </span>
                </div>
            </div>
        `;
    }

    // الوضع الأفقي (الألوان داخل المقاس في شبكة أفقية)
    return `
        <div class="variant-picker-card" data-index="${v._origIndex}" data-size="${(v.size || '').trim()}" data-color="${(v.color || '').trim()}" data-barcode="${(v.barcode || '').trim()}"
            onclick="selectVariantAndAddToCart(${product.id}, ${v._origIndex}, '${context}')"
            onmouseenter="setVariantModalSelectedIndexByCard(this);"
            style="background: ${cardBgColor}; border: 2px solid ${cardBorderColor}; border-radius: 12px; padding: 10px 12px; cursor: pointer; transition: all 0.15s ease; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.03); user-select: none; width: 100%; box-sizing: border-box; overflow: hidden; opacity: ${cardOpacity};">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 6px; box-sizing: border-box;">
                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; min-width: 0;">
                    <span class="variant-size-badge" style="background: ${isOutOfStockBlocked ? '#64748b' : 'linear-gradient(135deg, #059669, #047857)'}; color: white; padding: 3px 10px; border-radius: 8px; font-weight: 900; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        🎨 ${v.color || 'موحد'}
                    </span>
                </div>
                <div style="text-align: left; flex-shrink: 0;">
                    ${priceSnippet}
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-top: 1px dashed #e2e8f0; padding-top: 6px; box-sizing: border-box; gap: 6px;">
                <span style="color: ${stockColor}; background: ${stockBg}; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%; border: ${isOutOfStockBlocked ? '1px solid #fca5a5' : 'none'};" title="المخزن: ${activeWH}">
                    ${isOutOfStockBlocked ? '🛑 المتاح: <b>0</b>' : `📦 المتاح: <b>${stockVal}</b>`}
                </span>
                <span style="font-size: 0.72rem; color: #64748b; font-weight: bold; white-space: nowrap; flex-shrink: 0;">
                    ${priceTitle}
                </span>
            </div>
        </div>
    `;
}

// دالة توليد محتوى المجموعات حسب الوضع المختار (باللون أو بالمقاس)
function buildVariantGroupsHtml(product, context, mode = 'by_color') {
    const variants = product.variants || [];
    let indexedVariants = variants.map((v, origIndex) => ({ ...v, _origIndex: origIndex }));
    const priceLevelSelect = document.getElementById('salesPriceLevel');
    const priceLevel = priceLevelSelect ? priceLevelSelect.value : 'retail';
    const activeWH = getVariantModalActiveWH(context);

    if (mode === 'by_color') {
        // ============================================
        // وضع التجميع باللون (رأسي - المقاسات تتابع تحت اللون)
        // ============================================
        const colorGroupsMap = {};
        indexedVariants.forEach(item => {
            const rawColor = (item.color || '').trim();
            const groupKey = rawColor || '__NO_COLOR__';
            if (!colorGroupsMap[groupKey]) {
                colorGroupsMap[groupKey] = {
                    color: rawColor,
                    items: []
                };
            }
            colorGroupsMap[groupKey].items.push(item);
        });

        const sortedColors = Object.keys(colorGroupsMap).filter(k => k !== '__NO_COLOR__');
        sortedColors.sort((a, b) => a.localeCompare(b, 'ar'));
        if (colorGroupsMap['__NO_COLOR__']) {
            sortedColors.push('__NO_COLOR__');
        }

        return sortedColors.map(key => {
            const group = colorGroupsMap[key];
            const isNoColor = (key === '__NO_COLOR__');
            const colorTitle = isNoColor ? '🎨 ألوان عامة / موحدة' : `🎨 اللون: ${group.color}`;

            // ترتيب المقاسات تصاعدياً بالأوزان
            group.items.sort((a, b) => {
                let wa = getSizeWeight(a.size);
                let wb = getSizeWeight(b.size);
                if (wa !== wb) return wa - wb;
                return (a.size || '').localeCompare(b.size || '', 'ar');
            });

            const cardsInColorGroup = group.items.map(v => 
                renderVariantPickerCardHtml(product, v, context, activeWH, priceLevel, true)
            ).join('');

            return `
                <div class="variant-color-group" data-color="${isNoColor ? '' : group.color}" 
                    style="display: flex; flex-direction: column; gap: 8px; width: 100%; min-width: 0; background: #f8fafc; padding: 12px; border-radius: 14px; border: 1.5px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.02); box-sizing: border-box;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 14px; background: rgba(59, 130, 246, 0.08); border-right: 4px solid #3b82f6; border-radius: 8px;">
                        <span style="font-weight: 900; font-size: 0.95rem; color: #1d4ed8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${colorTitle}
                        </span>
                        <span style="font-size: 0.75rem; color: #475569; background: white; border: 1px solid #cbd5e1; padding: 2px 10px; border-radius: 12px; font-weight: 800; white-space: nowrap; flex-shrink: 0;">
                            ${group.items.length} ${group.items.length === 1 && !group.items[0].size ? 'تشكيلة' : 'مقاسات'}
                        </span>
                    </div>

                    <div class="variant-cards-column" style="display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;">
                        ${cardsInColorGroup}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============================================
    // وضع التجميع بالمقاس (أفقي - الألوان في صف تحت كل مقاس)
    // ============================================
    const sizeGroupsMap = {};
    indexedVariants.forEach(item => {
        const rawSize = (item.size || '').trim();
        const groupKey = rawSize || '__NO_SIZE__';
        if (!sizeGroupsMap[groupKey]) {
            sizeGroupsMap[groupKey] = {
                size: rawSize,
                items: []
            };
        }
        sizeGroupsMap[groupKey].items.push(item);
    });

    const dynamicSizes = Object.keys(sizeGroupsMap)
        .filter(k => k !== '__NO_SIZE__')
        .sort((a, b) => {
            let wa = getSizeWeight(a);
            let wb = getSizeWeight(b);
            if (wa !== wb) return wa - wb;
            return a.localeCompare(b, 'ar');
        });

    const sortedGroupKeys = [...dynamicSizes];
    if (sizeGroupsMap['__NO_SIZE__']) {
        sortedGroupKeys.push('__NO_SIZE__');
    }

    return sortedGroupKeys.map(key => {
        const group = sizeGroupsMap[key];
        const isNoSize = (key === '__NO_SIZE__');
        const sizeTitle = isNoSize ? '🎨 ألوان قياسية (بدون مقاس)' : `📏 مقاس: ${group.size}`;
        const headerBg = isNoSize ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)';
        const headerBorder = isNoSize ? '#3b82f6' : '#10b981';
        const headerTextColor = isNoSize ? '#1d4ed8' : '#047857';

        group.items.sort((a, b) => (a.color || '').localeCompare(b.color || '', 'ar'));

        const cardsInGroup = group.items.map(v => 
            renderVariantPickerCardHtml(product, v, context, activeWH, priceLevel, false)
        ).join('');

        return `
            <div class="variant-size-group" data-size="${isNoSize ? '' : group.size}" style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 12px; background: ${headerBg}; border-right: 4px solid ${headerBorder}; border-radius: 8px;">
                    <span style="font-weight: 900; font-size: 0.92rem; color: ${headerTextColor};">
                        ${sizeTitle}
                    </span>
                    <span style="font-size: 0.72rem; color: #64748b; background: white; border: 1px solid #e2e8f0; padding: 1px 8px; border-radius: 12px; font-weight: 800;">
                        ${group.items.length} تشكيلة
                    </span>
                </div>
                <div class="variant-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px;">
                    ${cardsInGroup}
                </div>
            </div>
        `;
    }).join('');
}

function showVariantSelectionModal(product, context = 'sales') {
    closeVariantSelectionModal(); // إغلاق أي نافذة قديمة وتنظيف المستمعات

    const variants = product.variants || [];
    if (variants.length === 0) {
        addToCart(product.id);
        return;
    }

    variantModalProduct = product;
    variantModalContext = context;
    variantModalSelectedIndex = 0;

    // استخراج المقاسات الموجودة فعلياً في هذا الصنف لأزرار الفلترة
    const sizeGroupsMap = {};
    variants.forEach(item => {
        const rawSize = (item.size || '').trim();
        if (rawSize) sizeGroupsMap[rawSize] = true;
    });
    const dynamicSizes = Object.keys(sizeGroupsMap).sort((a, b) => {
        let wa = getSizeWeight(a);
        let wb = getSizeWeight(b);
        if (wa !== wb) return wa - wb;
        return a.localeCompare(b, 'ar');
    });

    // استخراج الألوان الموجودة فعلياً في هذا الصنف لأزرار الفلترة
    const dynamicColors = [...new Set(variants.map(v => (v.color || '').trim()).filter(c => c !== ''))];
    dynamicColors.sort((a, b) => a.localeCompare(b, 'ar'));

    // استرجاع الوضع المفضل (افتراضياً: باللون رأسي لطلب العميل) عبر SQLite
    let currentMode = (typeof getStore === 'function' ? getStore('bayan_variant_view_mode') : null) || 'by_color';
    if (!['by_size', 'by_color'].includes(currentMode)) currentMode = 'by_color';
    const isPinned = (typeof getStore === 'function' ? getStore('bayan_variant_view_mode_pinned') : null) === 'true';

    // بناء محتوى المجموعات
    const groupsHtml = buildVariantGroupsHtml(product, context, currentMode);

    // بناء أزرار فلتر المقاسات
    let sizeFilterButtonsHtml = '';
    if (dynamicSizes.length > 0) {
        sizeFilterButtonsHtml = `
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 0.8rem; font-weight: 900; color: #475569;">📏 المقاس:</span>
                <button type="button" class="variant-size-filter-btn active" data-size="ALL" onclick="setVariantSizeFilter('ALL', this)" style="padding: 3px 10px; border-radius: 6px; border: 1.5px solid #10b981; background: #10b981; color: white; font-weight: 800; font-size: 0.78rem; cursor: pointer; transition: 0.15s;">الكل</button>
                ${dynamicSizes.map(s => `
                    <button type="button" class="variant-size-filter-btn" data-size="${s}" onclick="setVariantSizeFilter('${s}', this)" style="padding: 3px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 800; font-size: 0.78rem; cursor: pointer; transition: 0.15s;">${s}</button>
                `).join('')}
            </div>
        `;
    }

    // بناء أزرار فلتر الألوان
    let colorFilterButtonsHtml = '';
    if (dynamicColors.length > 0) {
        colorFilterButtonsHtml = `
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 0.8rem; font-weight: 900; color: #475569;">🎨 اللون:</span>
                <button type="button" class="variant-color-filter-btn active" data-color="ALL" onclick="setVariantColorFilter('ALL', this)" style="padding: 3px 10px; border-radius: 6px; border: 1.5px solid #10b981; background: #10b981; color: white; font-weight: 800; font-size: 0.78rem; cursor: pointer; transition: 0.15s;">الكل</button>
                ${dynamicColors.map(c => `
                    <button type="button" class="variant-color-filter-btn" data-color="${c}" onclick="setVariantColorFilter('${c}', this)" style="padding: 3px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; background: #f8fafc; color: #334155; font-weight: 800; font-size: 0.78rem; cursor: pointer; transition: 0.15s;">${c}</button>
                `).join('')}
            </div>
        `;
    }

    const containerStyle = (currentMode === 'by_color')
        ? 'display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px; align-items:start; max-height:460px; overflow-y:auto; padding:6px; box-sizing:border-box; scrollbar-gutter:stable;'
        : 'display:flex; flex-direction:column; gap:14px; max-height:460px; overflow-y:auto; padding:6px; box-sizing:border-box; scrollbar-gutter:stable;';

    const modalHtml = `
        <div id="bayanVariantPickerOverlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.75); z-index:11500; display:flex; align-items:center; justify-content:center; direction:rtl; font-family:'Cairo',sans-serif;" onclick="if(event.target === this) closeVariantSelectionModal();">
            <div style="background:white; border-radius:24px; width:980px; max-width:96%; padding:18px 24px; box-shadow:0 25px 60px rgba(0,0,0,0.35); border:2.5px solid #10b981; animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1); display:flex; flex-direction:column; max-height:92vh;">
                
                <!-- رأس النافذة وأزرار التبديل والتثبيت -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #f1f5f9; padding-bottom:10px; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                    <div>
                        <h3 style="margin:0; font-size:1.18rem; color:#1e293b; font-weight:900;">
                            👕 اختر المقاس واللون للموديل: <span style="color:#047857;">${product.name}</span>
                        </h3>
                        <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                            <span style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:800;">
                                ⌨️ تحكم بالأسهم ( ⬅️ ➡️ ⬆️ ⬇️ ) + اضغط Enter للاختيار السريع
                            </span>
                        </div>
                    </div>

                    <!-- أزرار تبديل الوضعين مع الدبوس والتثبيت -->
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="display:inline-flex; background:#f1f5f9; padding:2px; border-radius:10px; border:1.5px solid #cbd5e1;">
                            <button type="button" id="bayanViewModeColorBtn" onclick="switchVariantPickerViewMode('by_color')" 
                                title="عرض رأسي: المقاسات متتابعة تحت كل لون"
                                style="padding: 5px 12px; border-radius: 8px; border: none; font-weight: 800; font-size: 0.78rem; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 4px; font-family:'Cairo',sans-serif;">
                                🎨 باللون (رأسي)
                            </button>
                            <button type="button" id="bayanViewModeSizeBtn" onclick="switchVariantPickerViewMode('by_size')" 
                                title="عرض أفقي: الألوان في صف تحت كل مقاس"
                                style="padding: 5px 12px; border-radius: 8px; border: none; font-weight: 800; font-size: 0.78rem; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 4px; font-family:'Cairo',sans-serif;">
                                📏 بالمقاس (أفقي)
                            </button>
                        </div>

                        <!-- زر تثبيت الوضع الافتراضي -->
                        <button type="button" id="bayanViewModePinBtn" onclick="toggleVariantPickerPin()" 
                            title="تثبيت هذا الوضع كافتراضي دائم للنظام"
                            style="padding: 5px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; font-weight: 800; font-size: 0.78rem; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 4px; font-family:'Cairo',sans-serif;">
                            <span id="bayanPinIcon">📌</span>
                            <span id="bayanPinText">تثبيت</span>
                        </button>

                        <!-- زر الإغلاق -->
                        <button onclick="closeVariantSelectionModal()" style="background:#f1f5f9; border:none; width:34px; height:34px; border-radius:50%; font-size:1.3rem; cursor:pointer; color:#64748b; font-weight:900; display:flex; align-items:center; justify-content:center; transition:0.2s;" onmouseover="this.style.background='#fee2e2'; this.style.color='#dc2626';" onmouseout="this.style.background='#f1f5f9'; this.style.color='#64748b';">&times;</button>
                    </div>
                </div>

                <!-- شريط البحث والفلترة -->
                <div style="display:flex; flex-direction:column; gap:8px; background:#f8fafc; padding:10px 14px; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:12px;">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <div style="position:relative; flex:1; min-width:200px;">
                            <input id="bayanVariantSearch" type="text" placeholder="🔍 بحث سريع بالمقاس أو اللون أو الباركود..."
                                oninput="filterBayanVariantsModal()"
                                style="width:100%; box-sizing:border-box; padding:6px 12px; border-radius:8px; border:1.5px solid #cbd5e1; font-family:'Cairo',sans-serif; font-size:0.82rem; outline:none; transition:0.2s;"
                                onfocus="this.style.borderColor='#10b981';" onblur="this.style.borderColor='#cbd5e1';">
                        </div>
                    </div>
                    ${sizeFilterButtonsHtml ? `<div style="padding-top:2px;">${sizeFilterButtonsHtml}</div>` : ''}
                    ${colorFilterButtonsHtml ? `<div style="padding-top:2px;">${colorFilterButtonsHtml}</div>` : ''}
                </div>

                <!-- منطقة المجموعات والبطاقات (Scrollable) -->
                <div id="bayanVariantGroupsContainer" style="${containerStyle}">
                    ${groupsHtml}
                    <div id="bayanVariantNoResults" style="display:none; text-align:center; padding:30px 10px; color:#64748b; font-weight:800; font-size:0.95rem; width:100%;">
                        ⚠️ لا توجد تشكيلات مطابقة للبحث أو الفلتر المحدد!
                    </div>
                </div>

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // ضبط ستايل أزرار الوضع والدبوس
    updateVariantPickerModeButtonsUI(currentMode);
    updateVariantPickerPinUI(isPinned, currentMode);

    window.addEventListener('keydown', handleVariantPickerKeydown, true);

    setTimeout(() => {
        updateVariantModalSelection();
    }, 40);
}

// دالة تحديث ستايل أزرار تبديل الوضع
function updateVariantPickerModeButtonsUI(mode) {
    const btnColor = document.getElementById('bayanViewModeColorBtn');
    const btnSize = document.getElementById('bayanViewModeSizeBtn');
    if (!btnColor || !btnSize) return;

    if (mode === 'by_color') {
        btnColor.style.background = '#3b82f6';
        btnColor.style.color = '#ffffff';
        btnColor.style.boxShadow = '0 2px 6px rgba(59, 130, 246, 0.35)';

        btnSize.style.background = 'transparent';
        btnSize.style.color = '#475569';
        btnSize.style.boxShadow = 'none';
    } else {
        btnSize.style.background = '#10b981';
        btnSize.style.color = '#ffffff';
        btnSize.style.boxShadow = '0 2px 6px rgba(16, 185, 129, 0.35)';

        btnColor.style.background = 'transparent';
        btnColor.style.color = '#475569';
        btnColor.style.boxShadow = 'none';
    }
}

// دالة تحديث ستايل زر التثبيت الدبوس
function updateVariantPickerPinUI(isPinned, currentMode) {
    const pinBtn = document.getElementById('bayanViewModePinBtn');
    const pinText = document.getElementById('bayanPinText');
    if (!pinBtn || !pinText) return;

    if (isPinned) {
        pinBtn.style.background = '#fef3c7';
        pinBtn.style.borderColor = '#f59e0b';
        pinBtn.style.color = '#b45309';
        pinBtn.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.25)';
        pinText.innerText = 'مثبت كافتراضي';
        pinBtn.title = 'الوضع مثبت كافتراضي للنظام - اضغط لإلغاء التثبيت';
    } else {
        pinBtn.style.background = '#ffffff';
        pinBtn.style.borderColor = '#cbd5e1';
        pinBtn.style.color = '#64748b';
        pinBtn.style.boxShadow = 'none';
        pinText.innerText = 'تثبيت';
        pinBtn.title = 'اضغط لتثبيت هذا الوضع كافتراضي دائم لجميع الشاشات';
    }
}

// دالة التبديل بين العرضين
function switchVariantPickerViewMode(mode) {
    if (!['by_size', 'by_color'].includes(mode)) mode = 'by_color';
    if (typeof setStore === 'function') setStore('bayan_variant_view_mode', mode);

    const container = document.getElementById('bayanVariantGroupsContainer');
    if (container && variantModalProduct) {
        if (mode === 'by_color') {
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
            container.style.flexDirection = '';
            container.style.flexWrap = '';
            container.style.gap = '14px';
            container.style.alignItems = 'start';
        } else {
            container.style.display = 'flex';
            container.style.gridTemplateColumns = '';
            container.style.flexDirection = 'column';
            container.style.flexWrap = 'nowrap';
            container.style.gap = '14px';
            container.style.alignItems = 'stretch';
        }

        const newHtml = buildVariantGroupsHtml(variantModalProduct, variantModalContext, mode);
        container.innerHTML = newHtml + `
            <div id="bayanVariantNoResults" style="display:none; text-align:center; padding:30px 10px; color:#64748b; font-weight:800; font-size:0.95rem; width:100%;">
                ⚠️ لا توجد تشكيلات مطابقة للبحث أو الفلتر المحدد!
            </div>
        `;
        filterBayanVariantsModal();
    }

    updateVariantPickerModeButtonsUI(mode);
    const isPinned = (typeof getStore === 'function' ? getStore('bayan_variant_view_mode_pinned') : null) === 'true';
    updateVariantPickerPinUI(isPinned, mode);
}
window.switchVariantPickerViewMode = switchVariantPickerViewMode;

// دالة تثبيت/إلغاء تثبيت الوضع الافتراضي بالدبوس
function toggleVariantPickerPin() {
    const isPinned = (typeof getStore === 'function' ? getStore('bayan_variant_view_mode_pinned') : null) === 'true';
    const newPinned = !isPinned;
    if (typeof setStore === 'function') setStore('bayan_variant_view_mode_pinned', newPinned ? 'true' : 'false');

    const currentMode = (typeof getStore === 'function' ? getStore('bayan_variant_view_mode') : null) || 'by_color';
    updateVariantPickerPinUI(newPinned, currentMode);

    if (typeof showToast === 'function') {
        if (newPinned) {
            const modeLabel = currentMode === 'by_color' ? 'العرض الرأسي باللون' : 'العرض الأفقي بالمقاس';
            showToast(`📌 تم تثبيت [${modeLabel}] كوضع افتراضي دائم للنظام`, 'success');
        } else {
            showToast('🔓 تم إلغاء تثبيت الوضع الافتراضي', 'info');
        }
    }
}
window.toggleVariantPickerPin = toggleVariantPickerPin;

function setVariantSizeFilter(size, btnEl) {
    const overlay = document.getElementById('bayanVariantPickerOverlay');
    if (!overlay) return;
    overlay.querySelectorAll('.variant-size-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = '#f8fafc';
        btn.style.color = '#334155';
        btn.style.borderColor = '#cbd5e1';
    });
    if (btnEl) {
        btnEl.classList.add('active');
        btnEl.style.background = '#10b981';
        btnEl.style.color = 'white';
        btnEl.style.borderColor = '#10b981';
    }
    filterBayanVariantsModal();
}
window.setVariantSizeFilter = setVariantSizeFilter;

function setVariantColorFilter(color, btnEl) {
    const overlay = document.getElementById('bayanVariantPickerOverlay');
    if (!overlay) return;
    overlay.querySelectorAll('.variant-color-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = '#f8fafc';
        btn.style.color = '#334155';
        btn.style.borderColor = '#cbd5e1';
    });
    if (btnEl) {
        btnEl.classList.add('active');
        btnEl.style.background = '#10b981';
        btnEl.style.color = 'white';
        btnEl.style.borderColor = '#10b981';
    }
    filterBayanVariantsModal();
}
window.setVariantColorFilter = setVariantColorFilter;

function filterBayanVariantsModal() {
    const overlay = document.getElementById('bayanVariantPickerOverlay');
    if (!overlay) return;

    const searchInput = document.getElementById('bayanVariantSearch');
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const activeSizeBtn = overlay.querySelector('.variant-size-filter-btn.active');
    const selectedSize = activeSizeBtn ? (activeSizeBtn.dataset.size || '').trim() : 'ALL';

    const activeColorBtn = overlay.querySelector('.variant-color-filter-btn.active');
    const selectedColor = activeColorBtn ? (activeColorBtn.dataset.color || '').trim() : 'ALL';

    let totalVisible = 0;
    const groups = overlay.querySelectorAll('.variant-size-group, .variant-color-group');
    groups.forEach(group => {
        let visibleInGroup = 0;
        const cards = group.querySelectorAll('.variant-picker-card');
        cards.forEach(card => {
            const cColor = (card.dataset.color || '').trim().toLowerCase();
            const cSize = (card.dataset.size || '').trim().toLowerCase();
            const cBarcode = (card.dataset.barcode || '').trim().toLowerCase();

            const isSizeMatch = (selectedSize === 'ALL') || (cSize === selectedSize.toLowerCase());
            const isColorMatch = (selectedColor === 'ALL') || (cColor === selectedColor.toLowerCase());
            const isSearchMatch = !query || cSize.includes(query) || cColor.includes(query) || cBarcode.includes(query);

            if (isSizeMatch && isColorMatch && isSearchMatch) {
                card.style.display = 'flex';
                visibleInGroup++;
                totalVisible++;
            } else {
                card.style.display = 'none';
            }
        });

        group.style.display = (visibleInGroup > 0) ? 'flex' : 'none';
    });

    const noResultsEl = document.getElementById('bayanVariantNoResults');
    if (noResultsEl) {
        noResultsEl.style.display = (totalVisible === 0) ? 'block' : 'none';
    }

    variantModalSelectedIndex = 0;
    updateVariantModalSelection();
}
window.filterBayanVariantsModal = filterBayanVariantsModal;

function getVisibleVariantCards() {
    const overlay = document.getElementById('bayanVariantPickerOverlay');
    if (!overlay) return [];
    return Array.from(overlay.querySelectorAll('.variant-picker-card')).filter(card => {
        const group = card.closest('.variant-size-group, .variant-color-group');
        return card.style.display !== 'none' && (!group || group.style.display !== 'none');
    });
}

function setVariantModalSelectedIndexByCard(cardElement) {
    const visibleCards = getVisibleVariantCards();
    const idx = visibleCards.indexOf(cardElement);
    if (idx !== -1) {
        variantModalSelectedIndex = idx;
        updateVariantModalSelection();
    }
}
window.setVariantModalSelectedIndexByCard = setVariantModalSelectedIndexByCard;

function handleVariantPickerKeydown(e) {
    if (!e || typeof e.key !== 'string') return;
    const overlay = document.getElementById('bayanVariantPickerOverlay');
    if (!overlay || !variantModalProduct) return;

    const visibleCards = getVisibleVariantCards();
    const total = visibleCards.length;

    if (e.key === 'Escape') {
        closeVariantSelectionModal();
        return;
    }

    const searchInput = document.getElementById('bayanVariantSearch');
    const isSearchFocused = (document.activeElement === searchInput);

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
        if (!isSearchFocused || ['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    if (total === 0) return;

    if (e.key === 'Enter') {
        if (variantModalSelectedIndex >= 0 && variantModalSelectedIndex < total) {
            visibleCards[variantModalSelectedIndex].click();
        }
        return;
    }

    const currentCard = visibleCards[variantModalSelectedIndex];
    const currentRect = currentCard ? currentCard.getBoundingClientRect() : null;

    if (e.key === 'ArrowDown') {
        let bestIdx = -1;
        let minDistance = Infinity;
        if (currentRect) {
            visibleCards.forEach((card, idx) => {
                const r = card.getBoundingClientRect();
                if (r.top > currentRect.top + 5) {
                    const dist = Math.abs(r.left - currentRect.left) * 2 + (r.top - currentRect.top);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestIdx = idx;
                    }
                }
            });
        }
        if (bestIdx !== -1) {
            variantModalSelectedIndex = bestIdx;
        } else {
            variantModalSelectedIndex = Math.min(total - 1, variantModalSelectedIndex + 1);
        }
        updateVariantModalSelection();
    } else if (e.key === 'ArrowUp') {
        let bestIdx = -1;
        let minDistance = Infinity;
        if (currentRect) {
            visibleCards.forEach((card, idx) => {
                const r = card.getBoundingClientRect();
                if (r.bottom < currentRect.bottom - 5) {
                    const dist = Math.abs(r.left - currentRect.left) * 2 + (currentRect.bottom - r.bottom);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestIdx = idx;
                    }
                }
            });
        }
        if (bestIdx !== -1) {
            variantModalSelectedIndex = bestIdx;
        } else {
            variantModalSelectedIndex = Math.max(0, variantModalSelectedIndex - 1);
        }
        updateVariantModalSelection();
    } else if (e.key === 'ArrowLeft') {
        // في RTL: السهم الأيسر يتحرك لليسار بصرياً (Next column / card to the left)
        let bestIdx = -1;
        let minDistance = Infinity;
        if (currentRect) {
            visibleCards.forEach((card, idx) => {
                const r = card.getBoundingClientRect();
                if (r.left < currentRect.left - 5) {
                    const dist = Math.abs(r.top - currentRect.top) * 2 + (currentRect.left - r.left);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestIdx = idx;
                    }
                }
            });
        }
        if (bestIdx !== -1) {
            variantModalSelectedIndex = bestIdx;
        } else {
            variantModalSelectedIndex = (variantModalSelectedIndex + 1) % total;
        }
        updateVariantModalSelection();
    } else if (e.key === 'ArrowRight') {
        // في RTL: السهم الأيمن يتحرك لليمين بصرياً (Previous column / card to the right)
        let bestIdx = -1;
        let minDistance = Infinity;
        if (currentRect) {
            visibleCards.forEach((card, idx) => {
                const r = card.getBoundingClientRect();
                if (r.right > currentRect.right + 5) {
                    const dist = Math.abs(r.top - currentRect.top) * 2 + (r.right - currentRect.right);
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestIdx = idx;
                    }
                }
            });
        }
        if (bestIdx !== -1) {
            variantModalSelectedIndex = bestIdx;
        } else {
            variantModalSelectedIndex = (variantModalSelectedIndex - 1 + total) % total;
        }
        updateVariantModalSelection();
    }
}

function updateVariantModalSelection() {
    const overlay = document.getElementById('bayanVariantPickerOverlay');
    if (!overlay) return;

    const visibleCards = getVisibleVariantCards();
    visibleCards.forEach((card, idx) => {
        if (idx === variantModalSelectedIndex) {
            card.style.borderColor = '#10b981';
            card.style.background = 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)';
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.28)';
            card.style.outline = '2.5px solid #10b981';
            card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

    // 🛑 1. صمام أمان المبيعات والتحويل المخزني: إذا كان الرصيد المتاح 0 في المخزن الحالي، نمنع إغلاق النافذة ونمنع النقل للهيدر
    if (context === 'sales' || context === 'transfer') {
        const activeWH = (typeof getVariantModalActiveWH === 'function')
            ? getVariantModalActiveWH(context)
            : ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();

        let stockVal = 0;
        if (variant.warehouseStocks && typeof variant.warehouseStocks === 'object' && variant.warehouseStocks[activeWH] !== undefined) {
            stockVal = parseFloat(variant.warehouseStocks[activeWH]) || 0;
        } else if (activeWH === 'المخزن الرئيسي' || !variant.warehouseStocks || Object.keys(variant.warehouseStocks).length === 0) {
            stockVal = parseFloat(variant.stock) || 0;
        } else {
            stockVal = (variant.warehouseStocks && variant.warehouseStocks[activeWH] !== undefined)
                ? (parseFloat(variant.warehouseStocks[activeWH]) || 0)
                : (parseFloat(variant.stock) || 0);
        }

        if (stockVal <= 0) {
            const varLabel = (variant.size ? `[مقاس: ${variant.size}] ` : '') + (variant.color ? `(لون: ${variant.color})` : '');
            const whDesc = (context === 'transfer') ? `بالمخزن المحول منه (${activeWH})` : `بمخزن (${activeWH})`;
            if (typeof showToast === 'function') {
                showToast(`🚫 هذا المقاس/اللون ${varLabel}غير متوفر ${whDesc} - الرصيد: 0! يرجى اختيار مقاس أو لون متاح للتحويل.`, 'warning');
            }
            if (typeof BayanBarcode !== 'undefined' && typeof BayanBarcode.playBeep === 'function') {
                BayanBarcode.playBeep(false);
            }

            // اهتزاز بصري للكارت للتنبيه دون إغلاق النافذة
            const overlay = document.getElementById('bayanVariantPickerOverlay');
            if (overlay) {
                const cardEl = overlay.querySelector(`.variant-picker-card[data-index="${variantIndex}"]`);
                if (cardEl) {
                    cardEl.style.transition = 'all 0.08s ease';
                    cardEl.style.borderColor = '#ef4444';
                    cardEl.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.45)';
                    cardEl.style.transform = 'translateX(-8px)';
                    setTimeout(() => { if (cardEl) cardEl.style.transform = 'translateX(8px)'; }, 60);
                    setTimeout(() => { if (cardEl) cardEl.style.transform = 'translateX(-5px)'; }, 120);
                    setTimeout(() => { if (cardEl) cardEl.style.transform = 'translateX(5px)'; }, 180);
                    setTimeout(() => {
                        if (cardEl) {
                            cardEl.style.transform = 'none';
                            cardEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.03)';
                            cardEl.style.borderColor = '#fca5a5';
                        }
                    }, 240);
                }
            }
            return; // ⛔ توقف تام! النافذة تظل مفتوحة ولا يتم الذهاب لمربعات الهيدر إطلاقاً
        }
    }

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
            const effPrice = (typeof window.getEffectiveTransferPrice === 'function')
                ? window.getEffectiveTransferPrice(product, variant, defUnit)
                : (parseFloat(variant.cost) || parseFloat(product.cost) || 0);
            priceInput.value = effPrice.toFixed(2);
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
        const effPrice = (typeof window.getEffectiveAdjustmentPrice === 'function')
            ? window.getEffectiveAdjustmentPrice(product, variant, defUnit)
            : (parseFloat(variant.price) || parseFloat(product.price) || 0);
        
        const activeWH = (typeof getVariantModalActiveWH === 'function') 
            ? getVariantModalActiveWH('adj') 
            : ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();

        let liveStockVal = 0;
        if (variant && variant.warehouseStocks && typeof variant.warehouseStocks === 'object' && variant.warehouseStocks[activeWH] !== undefined) {
            liveStockVal = parseFloat(variant.warehouseStocks[activeWH]) || 0;
        } else if (activeWH === 'المخزن الرئيسي' || !variant || !variant.warehouseStocks) {
            liveStockVal = variant ? (parseFloat(variant.stock) || 0) : (parseFloat(product.stock) || 0);
        } else {
            liveStockVal = 0;
        }

        window.selectedAdjItem = {
            ...product,
            selectedSize: variant.size || '',
            selectedColor: variant.color || '',
            size: variant.size || '',
            color: variant.color || '',
            cost: effPrice,
            stock: liveStockVal
        };
        const sEl = document.getElementById('adjSearch');
        const pEl = document.getElementById('adjPrice');
        const qEl = document.getElementById('adjQty');
        if (sEl) sEl.value = product.name + (variant.size ? ` [${variant.size}]` : '') + (variant.color ? ` (${variant.color})` : '');
        if (pEl) pEl.value = effPrice.toFixed(2);
        document.querySelectorAll('.adj-current-stock-val').forEach(el => el.innerText = liveStockVal);
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
    // 🔒 إذا كان المرتجع مربوطاً بفاتورة أصلية، يتم تثبيت المقاس واللون منعاً للتلاعب أو تغيير التشكيلة
    if (cartType === 'return' && item.invoiceId) {
        const displaySize = item.selectedSize || item.size || 'عام';
        const displayColor = item.selectedColor || item.color || 'عام';
        const sizeElement = `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:3px 10px; border-radius:6px; font-weight:900; font-size:0.82rem; display:inline-flex; align-items:center; gap:3px;" title="المقاس مثبت من الفاتورة الأصلية">${displaySize} <span style="font-size:0.7rem;">🔒</span></span>`;
        const colorElement = `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:3px 10px; border-radius:6px; font-weight:900; font-size:0.82rem; display:inline-flex; align-items:center; gap:3px;" title="اللون مثبت من الفاتورة الأصلية">${displayColor} <span style="font-size:0.7rem;">🔒</span></span>`;
        return { sizeElement, colorElement };
    }

    const pInfo = productsDB.find(p => p.id === item.id || p.name === item.name);
    const variants = (pInfo && pInfo.variants && Array.isArray(pInfo.variants)) ? pInfo.variants : [];
    
    // تحديد المخزن الفعلي للتحقق من الرصيد (في حالة التحويل نأخذ المخزن المصدر)
    let activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
    if (cartType === 'transfer') {
        activeWH = (document.getElementById('transferFrom')?.value || document.getElementById('transferFromWarehouse')?.value || 'المخزن الرئيسي').trim();
    }

    const currentSize = String(item.selectedSize || item.size || '').trim();
    const currentColor = String(item.selectedColor || item.color || '').trim();

    // دالة مساعدة لحساب رصيد تشكيلة معينة في المخزن الفعلي المحدد
    const getVarStockInWH = (s, c) => {
        const v = variants.find(varObj => 
            (!s || String(varObj.size || '').trim() === String(s).trim()) &&
            (!c || String(varObj.color || '').trim() === String(c).trim())
        );
        if (!v) return 0;
        if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[activeWH] !== undefined) {
            return parseFloat(v.warehouseStocks[activeWH]) || 0;
        } else if (activeWH === 'المخزن الرئيسي') {
            return parseFloat(v.stock) || 0;
        }
        return 0;
    };

    const showStock = (cartType === 'sales' || cartType === 'transfer');

    // 1. خيارات المقاسات: مرتبطة باللون الحالي المحدد حصراً لمنع ظهور مقاسات ألوان أخرى أو إكسات (0 ❌)
    const colorMatchedVariants = (currentColor && currentColor !== '-' && currentColor !== 'عام' && currentColor !== 'موحد')
        ? variants.filter(v => String(v.color || '').trim() === currentColor)
        : variants;

    const availableSizes = [...new Set(colorMatchedVariants
        .map(v => String(v.size || '').trim())
        .filter(s => s && s !== '-' && s !== 'عام' && s !== 'موحد' && s !== 'قياسي')
    )];

    if (currentSize && currentSize !== '-' && currentSize !== 'عام' && currentSize !== 'قياسي' && !availableSizes.includes(currentSize)) {
        availableSizes.unshift(currentSize);
    }

    // لا نفرض مقاساً وهمياً إذا كان هذا اللون ملوش مقاسات أصلاً
    if (!currentSize && availableSizes.length > 0 && colorMatchedVariants.some(v => String(v.size || '').trim() !== '')) {
        item.selectedSize = availableSizes[0];
        item.size = availableSizes[0];
    } else if (availableSizes.length === 0) {
        item.selectedSize = '';
        item.size = '';
    }

    let sizeElement = `<span style="color:#94a3b8; font-weight:bold;">عام</span>`;
    if (availableSizes.length > 1) {
        const sizeOptions = availableSizes.map(s => {
            const st = getVarStockInWH(s, currentColor);
            const isSelected = (item.selectedSize || currentSize) === s;
            const stockLabel = showStock ? ` (${st > 0 ? st : '0 ❌'})` : '';
            return `<option value="${s}" ${isSelected ? 'selected' : ''} ${showStock && st <= 0 && !isSelected ? 'style="color:#94a3b8;"' : ''}>${s}${stockLabel}</option>`;
        }).join('');
        sizeElement = `<select onchange="updateItemVariantAttr(${index}, 'size', this.value, '${cartType}')" title="اختر المقاس"
            style="width: 90px; max-width: 100%; border: 1.5px solid #a7f3d0; background: #ecfdf5; color: #047857; border-radius: 6px; padding: 4px 2px; font-weight: 900; font-size: 0.82rem; outline: none; cursor: pointer; text-align: center;">
            ${sizeOptions}
        </select>`;
    } else if (availableSizes.length === 1) {
        const displaySize = availableSizes[0];
        sizeElement = `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">${displaySize}</span>`;
    } else if (currentSize && currentSize !== '-' && currentSize !== 'عام' && currentSize !== 'قياسي') {
        sizeElement = `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">${currentSize}</span>`;
    }

    // 2. خيارات الألوان: مرتبطة بالمقاس الحالي المحدد حصراً
    const sizeMatchedVariants = (currentSize && currentSize !== '-' && currentSize !== 'عام' && currentSize !== 'قياسي')
        ? variants.filter(v => String(v.size || '').trim() === currentSize)
        : variants;

    const availableColors = [...new Set(sizeMatchedVariants
        .map(v => String(v.color || '').trim())
        .filter(c => c && c !== '-' && c !== 'عام' && c !== 'موحد' && c !== 'قياسي')
    )];

    if (currentColor && currentColor !== '-' && currentColor !== 'عام' && currentColor !== 'موحد' && !availableColors.includes(currentColor)) {
        availableColors.unshift(currentColor);
    }

    if (!currentColor && availableColors.length > 0 && sizeMatchedVariants.some(v => String(v.color || '').trim() !== '')) {
        item.selectedColor = availableColors[0];
        item.color = availableColors[0];
    } else if (availableColors.length === 0) {
        item.selectedColor = '';
        item.color = '';
    }

    let colorElement = `<span style="color:#94a3b8; font-weight:bold;">عام</span>`;
    if (availableColors.length > 1) {
        const colorOptions = availableColors.map(c => {
            const st = getVarStockInWH(currentSize, c);
            const isSelected = (item.selectedColor || currentColor) === c;
            const stockLabel = showStock ? ` (${st > 0 ? st : '0 ❌'})` : '';
            return `<option value="${c}" ${isSelected ? 'selected' : ''} ${showStock && st <= 0 && !isSelected ? 'style="color:#94a3b8;"' : ''}>${c}${stockLabel}</option>`;
        }).join('');
        colorElement = `<select onchange="updateItemVariantAttr(${index}, 'color', this.value, '${cartType}')" title="اختر اللون"
            style="width: 90px; max-width: 100%; border: 1.5px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 6px; padding: 4px 2px; font-weight: 900; font-size: 0.82rem; outline: none; cursor: pointer; text-align: center;">
            ${colorOptions}
        </select>`;
    } else if (availableColors.length === 1) {
        const displayColor = availableColors[0];
        colorElement = `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">${displayColor}</span>`;
    } else if (currentColor && currentColor !== '-' && currentColor !== 'عام' && currentColor !== 'موحد') {
        colorElement = `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">${currentColor}</span>`;
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

    const prevSize = String(item.selectedSize || item.size || '').trim();
    const prevColor = String(item.selectedColor || item.color || '').trim();

    let candidateSize = (attr === 'size') ? String(value || '').trim() : prevSize;
    let candidateColor = (attr === 'color') ? String(value || '').trim() : prevColor;

    const pInfo = productsDB.find(p => p.id === item.id || p.name === item.name);

    // تكييف المقاس أو اللون المتبادل ذكياً إذا كان التشكيل الجديد لا يحتوي على الخيار السابق
    if (pInfo && pInfo.variants && Array.isArray(pInfo.variants)) {
        if (attr === 'color') {
            const varsForNewColor = pInfo.variants.filter(v => String(v.color || '').trim() === candidateColor);
            const sizesForNewColor = [...new Set(varsForNewColor.map(v => String(v.size || '').trim()).filter(s => s && s !== '-' && s !== 'عام' && s !== 'قياسي' && s !== 'موحد'))];
            if (sizesForNewColor.length > 0) {
                if (!sizesForNewColor.includes(candidateSize)) {
                    candidateSize = sizesForNewColor[0];
                }
            } else {
                candidateSize = '';
            }
        } else if (attr === 'size') {
            const varsForNewSize = pInfo.variants.filter(v => String(v.size || '').trim() === candidateSize);
            const colorsForNewSize = [...new Set(varsForNewSize.map(v => String(v.color || '').trim()).filter(c => c && c !== '-' && c !== 'عام' && c !== 'موحد' && c !== 'قياسي'))];
            if (colorsForNewSize.length > 0) {
                if (!colorsForNewSize.includes(candidateColor)) {
                    candidateColor = colorsForNewSize[0];
                }
            } else {
                candidateColor = '';
            }
        }
    }

    // تحديد المخزن المستهدف للفحص: في التحويل نأخذ المخزن المحول منه، وفي المبيعات نأخذ المخزن الحالي
    let targetWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
    if (cartType === 'transfer') {
        targetWH = (document.getElementById('transferFrom')?.value || document.getElementById('transferFromWarehouse')?.value || 'المخزن الرئيسي').trim();
    }

    // التحقق الصارم من رصيد المقاس واللون في المخزن المحدد (للمبيعات وتحويلات المخازن)
    if ((cartType === 'sales' || cartType === 'transfer') && pInfo && pInfo.variants && Array.isArray(pInfo.variants)) {
        const matchedVar = pInfo.variants.find(v => 
            (!candidateSize || String(v.size || '').trim() === candidateSize) && 
            (!candidateColor || String(v.color || '').trim() === candidateColor)
        );

        let candidateStock = 0;
        if (matchedVar) {
            if (matchedVar.warehouseStocks && typeof matchedVar.warehouseStocks === 'object' && matchedVar.warehouseStocks[targetWH] !== undefined) {
                candidateStock = parseFloat(matchedVar.warehouseStocks[targetWH]) || 0;
            } else if (targetWH === 'المخزن الرئيسي') {
                candidateStock = parseFloat(matchedVar.stock) || 0;
            } else {
                candidateStock = 0;
            }
        }

        const factor = parseFloat(item.unitFactor) || 1;
        const requestedBaseQty = (parseFloat(item.qty) || 1) * factor;

        if (!matchedVar || candidateStock < requestedBaseQty || candidateStock <= 0) {
            const attrLabel = attr === 'size' ? 'المقاس' : 'اللون';
            const varDesc = candidateSize && candidateColor ? `[${candidateSize} - ${candidateColor}]` : `[${value}]`;
            const actionDesc = cartType === 'transfer' ? 'للتحويل من' : 'للبيع من';

            if (typeof showToast === 'function') {
                showToast(`🚫 ${attrLabel} ${varDesc} غير متوفر ${actionDesc} مخزن (${targetWH})! الرصيد المتاح (${candidateStock}) فقط`, 'error', 4500);
            }
            if (typeof BayanBarcode !== 'undefined' && typeof BayanBarcode.playBeep === 'function') {
                BayanBarcode.playBeep(false);
            }
            // إعادة رسم الجدول للتراجع عن الاختيار غير المتاح في الـ select وإبقائه على القيمة السابقة
            if (cartType === 'sales') {
                renderCart();
            } else if (cartType === 'transfer') {
                if (typeof renderTransferTable === 'function') renderTransferTable();
            }
            return;
        }
    }

    item.selectedSize = candidateSize;
    item.size = candidateSize;
    item.selectedColor = candidateColor;
    item.color = candidateColor;

    // البحث عن التشكيلة المطابقة لتحديث السعر والباركود والرصيد المخزني الفعلي للتشكيلة الجديدة
    if (pInfo && pInfo.variants && Array.isArray(pInfo.variants)) {
        const sSize = String(item.selectedSize || item.size || '').trim();
        const sColor = String(item.selectedColor || item.color || '').trim();

        const matchedVariant = pInfo.variants.find(v => 
            (String(v.size || '').trim() === sSize) && 
            (String(v.color || '').trim() === sColor)
        ) || pInfo.variants.find(v => 
            (!sSize || String(v.size || '').trim() === sSize) && 
            (!sColor || String(v.color || '').trim() === sColor)
        );

        if (matchedVariant) {
            if (matchedVariant.barcode) {
                item.barcode = matchedVariant.barcode;
                item.code = matchedVariant.barcode;
            }

            let variantLiveStock = 0;
            if (matchedVariant.warehouseStocks && typeof matchedVariant.warehouseStocks === 'object' && matchedVariant.warehouseStocks[targetWH] !== undefined) {
                variantLiveStock = parseFloat(matchedVariant.warehouseStocks[targetWH]) || 0;
            } else if (targetWH === 'المخزن الرئيسي') {
                variantLiveStock = parseFloat(matchedVariant.stock) || 0;
            } else {
                variantLiveStock = 0;
            }

            const factor = parseFloat(item.unitFactor) || 1;

            // تحديث رصيد الصنف اللحظي (الرصيد قبل / الدفتري) في التسوية والمبيعات والمرتجعات والتحويل
            if (cartType === 'adj' || cartType === 'sales' || cartType === 'return' || cartType === 'purReturn') {
                item.stock = variantLiveStock / factor;
            } else if (cartType === 'transfer') {
                const wFrom = (document.getElementById('transferFrom')?.value || document.getElementById('transferFromWarehouse')?.value || 'المخزن الرئيسي').trim();
                let srcStock = 0;
                if (matchedVariant.warehouseStocks && typeof matchedVariant.warehouseStocks === 'object' && matchedVariant.warehouseStocks[wFrom] !== undefined) {
                    srcStock = parseFloat(matchedVariant.warehouseStocks[wFrom]) || 0;
                } else if (wFrom === 'المخزن الرئيسي') {
                    srcStock = parseFloat(matchedVariant.stock) || 0;
                } else {
                    srcStock = 0;
                }
                item.stock = srcStock / factor;
                item.sourceStock = item.stock;
            }

            if (cartType === 'transfer') {
                if (typeof window.getEffectiveTransferPrice === 'function') {
                    item.price = window.getEffectiveTransferPrice(item, matchedVariant);
                } else {
                    item.price = parseFloat(matchedVariant.cost) || item.price;
                }
            } else if (cartType === 'adj') {
                if (typeof window.getEffectiveAdjustmentPrice === 'function') {
                    item.price = window.getEffectiveAdjustmentPrice(item, matchedVariant);
                } else {
                    item.price = parseFloat(matchedVariant.price) || item.price;
                }
            } else if (matchedVariant.cost && (cartType === 'purchase' || cartType === 'purReturn')) {
                item.price = parseFloat(matchedVariant.cost) || item.price;
            }
            if (matchedVariant.price && (cartType === 'sales' || cartType === 'return') && parseFloat(matchedVariant.price) > 0) {
                const priceLevel = document.getElementById('salesPriceLevel')?.value || 'retail';
                const vPrice = (priceLevel === 'wholesale' && parseFloat(matchedVariant.wholesale) > 0) ? parseFloat(matchedVariant.wholesale) : parseFloat(matchedVariant.price);
                item.price = vPrice;
                item.originalPrice = vPrice;
            }
        }
    }

    // فحص دمج التشكيلات المكررة في جدول التسوية والجرد لمنع أي تضارب
    if (cartType === 'adj' && window.adjCart && Array.isArray(window.adjCart)) {
        const sSize = String(item.selectedSize || item.size || '').trim();
        const sColor = String(item.selectedColor || item.color || '').trim();
        const dupIndex = window.adjCart.findIndex((it, i) => 
            i !== index && 
            it.id === item.id && 
            String(it.selectedSize || it.size || '').trim() === sSize && 
            String(it.selectedColor || it.color || '').trim() === sColor
        );
        if (dupIndex !== -1) {
            window.adjCart[dupIndex].qty = (parseFloat(window.adjCart[dupIndex].qty) || 0) + (parseFloat(item.qty) || 0);
            window.adjCart.splice(index, 1);
            if (typeof showToast === 'function') {
                showToast(`🔄 تم دمج الصنف مع السطر المسجل لنفس المقاس واللون (${sSize} - ${sColor})`, 'info');
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
