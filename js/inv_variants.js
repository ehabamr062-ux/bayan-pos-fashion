// ============================================================
//  مصفوفة المقاسات والألوان وطباعة الباركود وملصقات الملابس
//  (Fashion Matrix, Hangtags & Barcode Label Printing)
// ============================================================
async function printInventoryBarcode() {
    if (typeof showCustomAlert !== 'function') {
        const choice = await showCustomPrompt("1- المختارة | 2- الكل", "1");
        if (choice) executePrinting(choice === "1" ? "selected" : "all");
        return;
    }

    showCustomAlert({
        type: 'question',
        titleText: '🏷️ خيارات طباعة الباربود',
        msg: 'يرجى اختيار نطاق الطباعة المطلوب:',
        confirmText: 'طباعة كافة الأصناف كلياً',
        cancelText: 'طباعة الأصناف المختارة (✔️) فقط',
        showCancel: true,
        onConfirm: () => requestCopiesAndPrint('all'),
        onCancel: () => requestCopiesAndPrint('selected')
    });
}

async function requestCopiesAndPrint(mode) {
    const copies = await showCustomPrompt("🏷️ كم عدد الملصقات لكل صنف؟", "1") || "1";
    executePrinting(mode, parseInt(copies));
}

function getBarcodeLabelSettings() {
    try {
        const stored = typeof getStore === 'function' ? getStore('bayan_barcode_label_settings') : null;
        if (stored) {
            const parsed = JSON.parse(stored);
            return Object.assign({
                width: 50,
                height: 25,
                offsetX: 0,
                barcodeHeight: 24,
                showShopName: true,
                showItemName: true,
                showPrice: true,
                showCode: true,
                scaleEnabled: true,
                scalePrefix: '2',
                scaleType: 'weight',
                scalePluLength: 6,
                scaleValueLength: 5
            }, parsed);
        }
    } catch(e) {}
    return {
        width: 50,
        height: 25,
        offsetX: 0,
        barcodeHeight: 24,
        showShopName: true,
        showItemName: true,
        showPrice: true,
        showCode: true,
        scaleEnabled: true,
        scalePrefix: '2',
        scaleType: 'weight',
        scalePluLength: 6,
        scaleValueLength: 5
    };
}

function saveBarcodeLabelSettings() {
    const s = {
        width: parseFloat(document.getElementById('bcLabelWidth')?.value) || 50,
        height: parseFloat(document.getElementById('bcLabelHeight')?.value) || 25,
        offsetX: parseFloat(document.getElementById('bcLabelOffsetX')?.value) || 0,
        barcodeHeight: parseFloat(document.getElementById('bcBarcodeHeight')?.value) || 24,
        showShopName: document.getElementById('bcShowShopName')?.checked ?? true,
        showItemName: document.getElementById('bcShowItemName')?.checked ?? true,
        showPrice: document.getElementById('bcShowPrice')?.checked ?? true,
        showCode: document.getElementById('bcShowCode')?.checked ?? true,
        scaleEnabled: document.getElementById('scaleBarcodeEnabled')?.checked ?? true,
        scalePrefix: document.getElementById('scaleBarcodePrefix')?.value || '2',
        scaleType: document.getElementById('scaleBarcodeType')?.value || 'weight',
        scalePluLength: parseInt(document.getElementById('scalePluLength')?.value, 10) || 6,
        scaleValueLength: parseInt(document.getElementById('scaleValueLength')?.value, 10) || 5
    };
    if (typeof setStore === 'function') {
        setStore('bayan_barcode_label_settings', JSON.stringify(s));
    }
    if (typeof showToast === 'function') showToast("✅ تم حفظ إعدادات الباركود وموازين الوزن بنجاح!", "success");
}

function highlightActiveBarcodePreset(width, height) {
    document.querySelectorAll('.bc-preset-btn').forEach(btn => {
        btn.style.background = '#ffffff';
        btn.style.borderColor = '#e2e8f0';
        btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
        const badge = btn.querySelector('.preset-badge');
        if (badge) badge.style.display = 'none';
    });

    const targetId = `bc-preset-${width}-${height}`;
    const activeBtn = document.getElementById(targetId);
    if (activeBtn) {
        activeBtn.style.background = '#f0fdf4';
        activeBtn.style.borderColor = '#059669';
        activeBtn.style.boxShadow = '0 0 0 2px rgba(5, 150, 105, 0.2)';
        const badge = activeBtn.querySelector('.preset-badge');
        if (badge) badge.style.display = 'block';
    }
}

function loadBarcodeLabelSettings() {
    const s = getBarcodeLabelSettings();
    if (document.getElementById('bcLabelWidth')) document.getElementById('bcLabelWidth').value = s.width;
    if (document.getElementById('bcLabelHeight')) document.getElementById('bcLabelHeight').value = s.height;
    if (document.getElementById('bcLabelOffsetX')) document.getElementById('bcLabelOffsetX').value = s.offsetX;
    if (document.getElementById('bcBarcodeHeight')) document.getElementById('bcBarcodeHeight').value = s.barcodeHeight;
    if (document.getElementById('bcShowShopName')) document.getElementById('bcShowShopName').checked = s.showShopName;
    if (document.getElementById('bcShowItemName')) document.getElementById('bcShowItemName').checked = s.showItemName;
    if (document.getElementById('bcShowPrice')) document.getElementById('bcShowPrice').checked = s.showPrice;
    if (document.getElementById('bcShowCode')) document.getElementById('bcShowCode').checked = s.showCode;

    // Scale barcode settings
    if (document.getElementById('scaleBarcodeEnabled')) document.getElementById('scaleBarcodeEnabled').checked = s.scaleEnabled ?? true;
    if (document.getElementById('scaleBarcodePrefix')) document.getElementById('scaleBarcodePrefix').value = s.scalePrefix || '2';
    if (document.getElementById('scaleBarcodeType')) document.getElementById('scaleBarcodeType').value = s.scaleType || 'weight';
    if (document.getElementById('scalePluLength')) document.getElementById('scalePluLength').value = s.scalePluLength || 6;
    if (document.getElementById('scaleValueLength')) document.getElementById('scaleValueLength').value = s.scaleValueLength || 5;

    highlightActiveBarcodePreset(s.width, s.height);
}

function applyBarcodePreset(width, height, offsetX = 0, barcodeHeight = 24, btnElement = null) {
    if (document.getElementById('bcLabelWidth')) document.getElementById('bcLabelWidth').value = width;
    if (document.getElementById('bcLabelHeight')) document.getElementById('bcLabelHeight').value = height;
    if (document.getElementById('bcLabelOffsetX')) document.getElementById('bcLabelOffsetX').value = offsetX;
    if (document.getElementById('bcBarcodeHeight')) document.getElementById('bcBarcodeHeight').value = barcodeHeight;
    
    highlightActiveBarcodePreset(width, height);
    saveBarcodeLabelSettings();
    if (typeof showToast === 'function') {
        showToast(`🎯 تم اختيار قالب (${width}×${height} مم) وحفظه بنجاح!`, "info");
    }
}

function testPrintBarcodeLabel() {
    const testItem = {
        id: 999,
        name: 'قميص كاجوال رجالي',
        size: 'M',
        color: 'أبيض',
        code: 'TEST-101',
        barcode: '2026010199',
        price: 350.00
    };
    if (typeof executePrinting === 'function') {
        executePrinting([testItem], 1);
    } else if (typeof showToast === 'function') {
        showToast("⚠️ جاري تجهيز معاينة ملصق الباركود...", "info");
    }
}

window.getBarcodeLabelSettings = getBarcodeLabelSettings;
window.saveBarcodeLabelSettings = saveBarcodeLabelSettings;
window.loadBarcodeLabelSettings = loadBarcodeLabelSettings;
window.testPrintBarcodeLabel = testPrintBarcodeLabel;
window.applyBarcodePreset = applyBarcodePreset;

function isBarcodeInUseAnywhere(barcode, excludeBarcode = null) {
    if (!barcode) return false;
    const clean = String(barcode).trim();
    if (!clean) return false;

    if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
        for (const p of productsDB) {
            if (p.barcode && String(p.barcode).trim() === clean && clean !== excludeBarcode) return true;
            if (p.code && String(p.code).trim() === clean && clean !== excludeBarcode) return true;
            if (p.units && Array.isArray(p.units)) {
                if (p.units.some(u => String(u.unitBarcode || '').trim() === clean && clean !== excludeBarcode)) return true;
            }
            if (p.variants && Array.isArray(p.variants)) {
                if (p.variants.some(v => String(v.barcode || '').trim() === clean && clean !== excludeBarcode)) return true;
            }
        }
    }

    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    for (let i = 0; i < rows.length; i++) {
        const inp = rows[i].querySelector('.var-barcode-input');
        if (inp && inp.value.trim() === clean && clean !== excludeBarcode) return true;
    }

    return false;
}
window.isBarcodeInUseAnywhere = isBarcodeInUseAnywhere;

async function executePrinting(modeOrTargets, copies = 1) {
    let targets = [];
    if (Array.isArray(modeOrTargets)) {
        targets = modeOrTargets;
    } else if (modeOrTargets === "selected") {
        const selectedIds = Array.from(window.selectedInventoryIds || []);
        if (selectedIds.length === 0) return showToast("⚠️ عفواً، يجب عليك اختيار صنف واحد على الأقل من الجدول أولاً!", "error");

        selectedIds.forEach(id => {
            const p = productsDB.find(x => x.id === id);
            if (p) targets.push(p);
        });
    } else {
        if (productsDB.length === 0) return showToast("⚠️ المخزن فارغ!", "error");
        targets = [...productsDB];
    }

    const bSettings = getBarcodeLabelSettings();
    const shopName = (document.getElementById('shopName') ? document.getElementById('shopName').value : '') || 'بيان فاشون';
    const currency = typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : 'ج.م';

    // توسيع قائمة الأصناف لتشمل كل تركيبة مقاس ولون (Variant) كملصق مستقل ودقيق
    const printableItems = [];
    targets.forEach(p => {
        if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
            p.variants.forEach((v, vIdx) => {
                let vBc = v.barcode || '';
                if (!vBc) {
                    vBc = generateVariantBarcode(v.size, v.color, vIdx + 1);
                    v.barcode = vBc;
                }
                const vPrice = (v.price !== undefined && v.price !== null && v.price !== '') ? parseFloat(v.price) : (parseFloat(p.price) || 0);
                printableItems.push({
                    name: p.name,
                    size: v.size || '',
                    color: v.color || '',
                    code: p.code || p.id,
                    barcode: vBc,
                    price: vPrice,
                    copies: copies
                });
            });
        } else {
            const codeVal = p.code || p.barcode || p.id;
            const barcodeVal = p.barcode || p.code || p.id;
            printableItems.push({
                name: p.name,
                size: p.size || '',
                color: p.color || '',
                code: codeVal,
                barcode: barcodeVal,
                price: parseFloat(p.price) || 0,
                copies: copies
            });
        }
    });

    const labelWidth = parseFloat(bSettings.width) || 50;
    const labelHeight = parseFloat(bSettings.height) || 25;
    const isSmall = labelWidth <= 42 || labelHeight <= 28;
    
    // إذا كانت باقي العناصر مخفية، يكبر ارتفاع الباركود لملء الملصق في المنتصف
    const isMinimal = !bSettings.showShopName && !bSettings.showPrice;
    let baseH = parseInt(bSettings.barcodeHeight || (isSmall ? 18 : 22), 10);
    if (isMinimal) {
        baseH = Math.max(baseH, isSmall ? 20 : 25);
    }
    const barcodeH = baseH;
    const barcodeW = isSmall ? 1.0 : 1.18;

    // 1. إنشاء عناصر الباركود ورسم الـ SVG محلياً عبر JsBarcode الموجود في النافذة
    let labelsHtml = '';
    let labelIdx = 0;

    // حاوية مؤقتة لرسم الباركود بدقة
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    document.body.appendChild(tempContainer);

    printableItems.forEach(item => {
        const priceFormatted = (item.price || 0).toFixed(2) + ' ' + currency;
        const hasVariantInfo = !!(item.size || item.color);

        for (let i = 0; i < item.copies; i++) {
            labelIdx++;
            const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgEl.id = `temp-barcode-${labelIdx}`;
            tempContainer.appendChild(svgEl);

            if (window.JsBarcode) {
                try {
                    const bcStr = String(item.barcode || item.code || '1000001').trim();
                    window.JsBarcode(svgEl, bcStr, {
                        format: "CODE128",
                        width: barcodeW,
                        height: barcodeH,
                        displayValue: true,
                        fontSize: isSmall ? 7.5 : 8.5,
                        font: "Segoe UI, Arial, sans-serif",
                        fontOptions: "bold",
                        textMargin: 1,
                        margin: 3 // مسافة أمان بيضاء على اليمين واليسار تمنع أكل الخطوط من الحواف
                    });
                } catch(err) {
                    console.warn("Barcode rendering error:", err);
                }
            }

            const svgString = svgEl.outerHTML;

            labelsHtml += `
                <div class="barcode-label">
                    ${bSettings.showShopName ? `<div class="shop-title">${shopName}</div>` : ''}
                    ${(hasVariantInfo || (bSettings.showCode && item.code)) ? `
                        <div class="meta-row">
                            ${item.size ? `<span class="size-badge">${item.size}</span>` : ''}
                            ${item.color ? `<span class="color-badge">${item.color}</span>` : ''}
                            ${(bSettings.showCode && item.code) ? `<span class="code-badge">#${item.code}</span>` : ''}
                        </div>
                    ` : ''}
                    <div class="svg-wrap">
                        ${svgString}
                    </div>
                    ${bSettings.showItemName ? `<div class="item-name" title="${item.name}">${item.name}</div>` : ''}
                    ${bSettings.showPrice ? `<div class="price-badge"><span class="price-val">${priceFormatted}</span></div>` : ''}
                </div>
            `;
        }
    });

    // إزالة الحاوية المؤقتة
    document.body.removeChild(tempContainer);

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        return showToast("⚠️ يرجى السماح بالنوافذ المنبثقة للطباعة!", "error");
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة ملصقات الباركود والملابس</title>
            <style>
                @page {
                    size: ${bSettings.width}mm ${bSettings.height}mm;
                    margin: 0mm !important;
                }
                * { 
                    box-sizing: border-box !important; 
                    -webkit-print-color-adjust: exact !important; 
                    print-color-adjust: exact !important; 
                }
                html, body {
                    width: ${bSettings.width}mm;
                    height: ${bSettings.height}mm;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
                    direction: rtl;
                    text-align: center;
                    background: #ffffff;
                    color: #000000;
                    overflow: hidden;
                }
                .label-container {
                    width: ${bSettings.width}mm;
                    margin: 0 auto;
                    padding: 0;
                }
                .barcode-label { 
                    width: ${bSettings.width}mm;
                    height: ${bSettings.height}mm;
                    max-height: ${bSettings.height}mm;
                    padding: 0.5mm 0.8mm;
                    margin: 0 auto !important;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.8mm;
                    page-break-after: always;
                    page-break-inside: avoid;
                    overflow: hidden;
                    box-sizing: border-box;
                    text-align: center;
                }
                .shop-title { 
                    font-size: ${isSmall ? '6.5pt' : '7.8pt'}; 
                    font-weight: 900; 
                    color: #000000; 
                    line-height: 1; 
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                    text-align: center;
                    letter-spacing: 0.2px;
                }
                .item-name { 
                    font-size: ${isSmall ? '6.8pt' : '8pt'}; 
                    font-weight: 900; 
                    margin: 0; 
                    white-space: nowrap; 
                    overflow: hidden; 
                    text-overflow: ellipsis; 
                    max-width: 100%; 
                    color: #000000; 
                    line-height: 1.1; 
                    text-align: center;
                }
                .meta-row { 
                    display: flex; 
                    justify-content: center; 
                    gap: 3px; 
                    align-items: center; 
                    width: 100%; 
                    font-size: ${isSmall ? '6.0pt' : '7.0pt'}; 
                    font-weight: 900; 
                    margin: 0;
                    line-height: 1;
                    white-space: nowrap;
                    overflow: hidden;
                }
                .size-badge { 
                    background: #000000; 
                    color: #ffffff; 
                    padding: 0.5px 3.5px; 
                    border-radius: 2.5px; 
                    font-weight: 900;
                    font-size: ${isSmall ? '6.0pt' : '7.0pt'};
                }
                .color-badge { 
                    color: #000000; 
                    font-weight: 800;
                }
                .code-badge { 
                    color: #222222; 
                    font-weight: 800;
                }
                .svg-wrap {
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0 auto;
                    text-align: center;
                    overflow: hidden;
                }
                svg { 
                    max-width: 95% !important; 
                    width: auto !important;
                    height: auto !important;
                    margin: 0 auto !important; 
                    display: block !important; 
                }
                .price-badge { 
                    font-size: ${isSmall ? '8pt' : '9.5pt'}; 
                    font-weight: 900; 
                    color: #000000; 
                    border: 1.2px solid #000000; 
                    padding: 0.2mm 2.5mm; 
                    border-radius: 2.5px; 
                    background: #ffffff; 
                    line-height: 1; 
                    margin: 0 auto; 
                    display: inline-block;
                    white-space: nowrap;
                }
                @media print {
                    html, body { width: ${bSettings.width}mm; height: ${bSettings.height}mm; margin: 0 !important; padding: 0 !important; }
                    .barcode-label { border: none !important; box-shadow: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="label-container">
                ${labelsHtml}
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 400);
}

function applyPresetSizes(presetType) {
    const input = document.getElementById('variantSizesInput');
    if (!input) return;
    if (presetType === 'clothes') {
        input.value = 'S, M, L, XL, XXL, 3XL';
    } else if (presetType === 'pants') {
        input.value = '28, 30, 32, 34, 36, 38, 40, 42';
    } else if (presetType === 'shoes') {
        input.value = '38, 39, 40, 41, 42, 43, 44, 45';
    } else if (presetType === 'kids') {
        input.value = '0-3M, 3-6M, 1Y, 2Y, 4Y, 6Y, 8Y, 10Y, 12Y';
    } else if (presetType === 'suits') {
        input.value = '48, 50, 52, 54, 56, 58';
    }
}

function generateVariantBarcode(size = '', color = '', index = 1) {
    const baseCode = document.getElementById('newItemSysCode')?.value || document.getElementById('newItemBarcode')?.value || document.getElementById('newItemCode')?.value || String(Date.now()).slice(-6);
    const cleanBase = String(baseCode).replace(/\D/g, '').slice(-4) || '1001';
    
    let candidate = '';
    let attempts = 0;
    do {
        attempts++;
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        candidate = `20${cleanBase}${String(index).padStart(2, '0')}${randSuffix}`.slice(0, 13);
    } while (isBarcodeInUseAnywhere(candidate) && attempts < 100);

    return candidate;
}

function addVariantRow(size = '', color = '', barcode = '', stock = 1, price = null, wholesale = null, cost = null) {
    const tbody = document.getElementById('productVariantsTableBody');
    if (!tbody) return;

    const rowIdx = tbody.rows.length + 1;
    const defaultPrice = price !== null ? price : (parseFloat(document.getElementById('newItemPrice')?.value) || 0);
    const defaultWs = wholesale !== null ? wholesale : (parseFloat(document.getElementById('newItemWholesale')?.value) || 0);
    const defaultCost = cost !== null ? cost : (parseFloat(document.getElementById('newItemCost')?.value) || 0);
    const autoBarcode = barcode || generateVariantBarcode(size, color, rowIdx);
    const effectiveStock = (stock !== undefined && stock !== null && stock !== '') ? stock : 1;
    const isLocked = (typeof window.isVariantsStockLocked !== 'undefined') ? window.isVariantsStockLocked : true;

    const tr = document.createElement('tr');
    tr.dataset.origStock = effectiveStock;
    tr.dataset.origPrice = defaultPrice;
    tr.dataset.origWs = defaultWs;
    tr.dataset.origCost = defaultCost;
    tr.dataset.origBarcode = autoBarcode;
    tr.dataset.origSize = size;
    tr.dataset.origColor = color;

    tr.innerHTML = `
        <td style="font-weight: bold; color: #64748b;">${rowIdx}</td>
        <td>
            <input type="text" class="search-input var-size-input" value="${size}" placeholder="اختياري"
                style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px;">
        </td>
        <td>
            <input type="text" class="search-input var-color-input" value="${color}" placeholder="مثال: أسود"
                style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px;">
        </td>
        <td>
            <input type="text" class="search-input var-barcode-input" value="${autoBarcode}" placeholder="باركود القطعة"
                style="height: 32px; font-family: monospace; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; letter-spacing: 0.5px; font-size: 0.8rem; width: 100%; box-sizing: border-box;">
        </td>
        <td>
            <input type="number" class="search-input var-stock-input" value="${effectiveStock}" min="0" data-orig-stock="${effectiveStock}"
                ${isLocked ? 'readonly' : ''}
                onfocus="if(window.isVariantsStockLocked) { this.blur(); if(typeof showToast==='function') showToast('🔒 الكميات مقفلة ومحمية. انقر على زر القفل 🔓 في الأعلى للتعديل', 'warning'); } else { this.select(); }"
                style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; background: ${isLocked ? '#f8fafc' : '#ffffff'}; cursor: ${isLocked ? 'not-allowed' : 'text'};">
        </td>
        <td>
            <input type="number" class="search-input var-price-input" value="${defaultPrice}" data-orig-price="${defaultPrice}"
                style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; color: #047857;">
        </td>
        <td>
            <input type="number" class="search-input var-ws-input" value="${defaultWs}" data-orig-ws="${defaultWs}"
                style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; color: #0284c7;">
        </td>
        <td>
            <input type="number" class="search-input var-cost-input" value="${defaultCost}" data-orig-cost="${defaultCost}"
                style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; color: #d97706;">
        </td>
        <td style="white-space: nowrap; padding: 4px;">
            <button type="button" onclick="restoreSingleVariantRow(this)" title="استعادة القيم الأصلية لهذا الصف"
                style="background: #f0fdf4; color: #166534; border: 1px solid #86efac; border-radius: 6px; padding: 4px 6px; cursor: pointer; font-weight: bold; margin-left: 3px;">🔄</button>
            <button type="button" onclick="this.closest('tr').remove(); updateVariantsCountBadge(); renderSmartMatrixView();"
                style="background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-weight: bold;" title="حذف هذا الصف">✕</button>
        </td>
    `;
    tbody.appendChild(tr);
    updateVariantsCountBadge();
    if (currentVariantsViewMode === 'matrix') {
        renderSmartMatrixView();
    }
}

function generateVariantsMatrix() {
    const sizesStr = document.getElementById('variantSizesInput')?.value || '';
    const colorsStr = document.getElementById('variantColorsInput')?.value || '';

    const sizes = sizesStr.split(/[,،\s]+/).map(s => s.trim()).filter(Boolean);
    const colors = colorsStr.split(/[,،\s]+/).map(c => c.trim()).filter(Boolean);

    if (sizes.length === 0 && colors.length === 0) {
        return showToast("⚠️ يرجى كتابة مقاسات أو ألوان لتوليد التشكيلة!", "warning");
    }

    const tbody = document.getElementById('productVariantsTableBody');
    if (!tbody) return;

    // الأسعار والتكاليف الافتراضية المأخوذة من كارت الصنف الرئيسي
    const cardPrice = parseFloat(document.getElementById('newItemPrice')?.value);
    const cardWs = parseFloat(document.getElementById('newItemWholesale')?.value);
    const cardCost = parseFloat(document.getElementById('newItemCost')?.value);

    const curPrice = (!isNaN(cardPrice) && cardPrice >= 0) ? cardPrice : 0;
    const curWs = (!isNaN(cardWs) && cardWs >= 0) ? cardWs : 0;
    const curCost = (!isNaN(cardCost) && cardCost >= 0) ? cardCost : 0;

    const listSizes = sizes.length > 0 ? sizes : [''];
    const listColors = colors.length > 0 ? colors : ['موحد'];

    // فحص الصفوف الموجودة مسبقاً للاحتفاظ بأسعارها وباركوداتها إذا كانت مطابقة
    const existingRows = Array.from(tbody.rows);
    const existingMap = new Map();
    existingRows.forEach(r => {
        const s = (r.querySelector('.var-size-input')?.value || '').trim();
        const c = (r.querySelector('.var-color-input')?.value || '').trim();
        const b = (r.querySelector('.var-barcode-input')?.value || '').trim();
        const st = parseFloat(r.querySelector('.var-stock-input')?.value) || 1;
        const p = parseFloat(r.querySelector('.var-price-input')?.value);
        const ws = parseFloat(r.querySelector('.var-ws-input')?.value);
        const co = parseFloat(r.querySelector('.var-cost-input')?.value);
        existingMap.set(`${s}___${c}`, {
            barcode: b,
            stock: st,
            price: (!isNaN(p) && p >= 0) ? p : curPrice,
            wholesale: (!isNaN(ws) && ws >= 0) ? ws : curWs,
            cost: (!isNaN(co) && co >= 0) ? co : curCost
        });
    });

    let generatedCount = 0;
    tbody.innerHTML = ''; // مسح الجدول القديم لمنع تكرار الصفوف قبل توليد التشكيلة المحدثة
    listSizes.forEach(sz => {
        listColors.forEach(col => {
            const key = `${sz}___${col}`;
            if (existingMap.has(key)) {
                // إذا كانت التشكيلة موجودة مسبقاً، نحافظ على بياناتها
                const existing = existingMap.get(key);
                addVariantRow(sz, col, existing.barcode, existing.stock, existing.price, existing.wholesale, existing.cost);
            } else {
                addVariantRow(sz, col, '', 1, curPrice, curWs, curCost);
            }
            generatedCount++;
        });
    });

    showToast(`✅ تم توليد (${generatedCount}) تشكيلة بنجاح!`, "success");
    renderSmartMatrixView();
}
// =========================================================================
let currentVariantPickerMode = 'apparel';

function setVariantPickerMode(mode = 'apparel') {
    currentVariantPickerMode = mode;
    const apparelBtn = document.getElementById('variantModeApparelBtn');
    const colorsBtn = document.getElementById('variantModeColorsOnlyBtn');
    const apparelSection = document.getElementById('apparelMatrixGeneratorSection');
    const colorsSection = document.getElementById('colorsOnlyMatrixGeneratorSection');
    const thSize = document.getElementById('thVarSize');

    if (mode === 'colorsOnly') {
        if (apparelBtn) {
            apparelBtn.style.background = '#f8fafc';
            apparelBtn.style.color = '#475569';
            apparelBtn.style.border = '2px solid #cbd5e1';
            apparelBtn.style.boxShadow = 'none';
        }
        if (colorsBtn) {
            colorsBtn.style.background = 'linear-gradient(135deg, #059669, #047857)';
            colorsBtn.style.color = '#ffffff';
            colorsBtn.style.border = '2px solid #059669';
            colorsBtn.style.boxShadow = '0 4px 12px rgba(5,150,105,0.3)';
        }
        if (apparelSection) apparelSection.style.display = 'none';
        if (colorsSection) colorsSection.style.display = 'block';
        if (thSize) thSize.innerText = 'المقاس (اختياري)';

        // تركيز مؤشر الكتابة في حقل اللون
        setTimeout(() => document.getElementById('colorOnlyInput')?.focus(), 50);
    } else {
        if (colorsBtn) {
            colorsBtn.style.background = '#f8fafc';
            colorsBtn.style.color = '#475569';
            colorsBtn.style.border = '2px solid #cbd5e1';
            colorsBtn.style.boxShadow = 'none';
        }
        if (apparelBtn) {
            apparelBtn.style.background = 'linear-gradient(135deg, #7c3aed, #6d28d9)';
            apparelBtn.style.color = '#ffffff';
            apparelBtn.style.border = '2px solid #7c3aed';
            apparelBtn.style.boxShadow = '0 4px 12px rgba(124,58,237,0.3)';
        }
        if (colorsSection) colorsSection.style.display = 'none';
        if (apparelSection) apparelSection.style.display = 'block';
        if (thSize) thSize.innerText = 'المقاس (Size)';
    }
}

function quickAppendColorToMatrix(colorName) {
    if (!colorName) return;
    const cleanColor = colorName.trim();
    const colorInput = document.getElementById('colorOnlyInput');
    const qtyInput = document.getElementById('colorOnlyQtyInput');
    const stock = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;
    
    // فحص إذا كان اللون مضافاً مسبقاً في الجدول
    const existingRows = document.getElementById('productVariantsTableBody')?.rows || [];
    for (let i = 0; i < existingRows.length; i++) {
        const cVal = existingRows[i].querySelector('.var-color-input')?.value?.trim();
        const sVal = existingRows[i].querySelector('.var-size-input')?.value?.trim();
        if (cVal === cleanColor && (!sVal || sVal === 'موحد' || sVal === 'قياسي')) {
            showToast(`⚠️ تنبيه: لون (${cleanColor}) مضاف مسبقاً في الجدول!`, "warning");
            const stockInp = existingRows[i].querySelector('.var-stock-input');
            if (stockInp) {
                stockInp.focus();
                stockInp.select();
            }
            return;
        }
    }

    // إضافة اللون فوراً للجدول
    const curPrice = parseFloat(document.getElementById('newItemPrice')?.value) || 0;
    const curWs = parseFloat(document.getElementById('newItemWholesale')?.value) || 0;
    const curCost = parseFloat(document.getElementById('newItemCost')?.value) || 0;

    addVariantRow('', cleanColor, '', stock, curPrice, curWs, curCost);
    if (typeof showToast === 'function') showToast(`🎨 تمت إضافة لون (${cleanColor}) بنجاح!`, "success");
    if (colorInput) colorInput.focus();
    renderSmartMatrixView();
}

function addColorOnlyVariant() {
    const colorInput = document.getElementById('colorOnlyInput');
    const qtyInput = document.getElementById('colorOnlyQtyInput');
    if (!colorInput) return;

    const colorsStr = colorInput.value.trim();
    if (!colorsStr) return showToast("⚠️ يرجى إدخال اسم اللون أولاً!", "warning");

    const colors = colorsStr.split(/[,،\s]+/).map(c => c.trim()).filter(Boolean);
    const stock = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;

    const curPrice = parseFloat(document.getElementById('newItemPrice')?.value) || 0;
    const curWs = parseFloat(document.getElementById('newItemWholesale')?.value) || 0;
    const curCost = parseFloat(document.getElementById('newItemCost')?.value) || 0;

    const existingRows = document.getElementById('productVariantsTableBody')?.rows || [];
    let addedCount = 0;
    let duplicateColors = [];

    colors.forEach(col => {
        let isDup = false;
        for (let i = 0; i < existingRows.length; i++) {
            const cVal = existingRows[i].querySelector('.var-color-input')?.value?.trim();
            const sVal = existingRows[i].querySelector('.var-size-input')?.value?.trim();
            if (cVal === col && (!sVal || sVal === 'موحد' || sVal === 'قياسي')) {
                isDup = true;
                break;
            }
        }

        if (isDup) {
            duplicateColors.push(col);
        } else {
            addVariantRow('', col, '', stock, curPrice, curWs, curCost);
            addedCount++;
        }
    });

    if (duplicateColors.length > 0) {
        showToast(`⚠️ تم تخطي الألوان المضافة مسبقاً: (${duplicateColors.join('، ')})`, "warning");
    }

    if (addedCount > 0) {
        showToast(`✅ تمت إضافة (${addedCount}) ألوان بنجاح!`, "success");
    }

    colorInput.value = '';
    colorInput.focus();
    renderSmartMatrixView();
}

// =========================================================================
// 📊 نظام عرض الشبكة الذكية (Interactive Matrix View)
// =========================================================================
let currentVariantsViewMode = 'matrix';

function toggleVariantsViewMode(mode = 'matrix') {
    currentVariantsViewMode = mode;
    const btnMatrix = document.getElementById('btnViewMatrix');
    const btnDetail = document.getElementById('btnViewDetail');
    const matrixCont = document.getElementById('variantsMatrixGridContainer');
    const detailCont = document.getElementById('variantsDetailTableContainer');

    if (mode === 'matrix') {
        if (btnMatrix) {
            btnMatrix.style.background = '#1e1b4b';
            btnMatrix.style.color = '#ffffff';
            btnMatrix.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        }
        if (btnDetail) {
            btnDetail.style.background = 'transparent';
            btnDetail.style.color = '#475569';
            btnDetail.style.boxShadow = 'none';
        }
        if (matrixCont) matrixCont.style.display = 'block';
        if (detailCont) detailCont.style.display = 'none';
        renderSmartMatrixView();
    } else {
        if (btnDetail) {
            btnDetail.style.background = '#1e1b4b';
            btnDetail.style.color = '#ffffff';
            btnDetail.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        }
        if (btnMatrix) {
            btnMatrix.style.background = 'transparent';
            btnMatrix.style.color = '#475569';
            btnMatrix.style.boxShadow = 'none';
        }
        if (matrixCont) matrixCont.style.display = 'none';
        if (detailCont) detailCont.style.display = 'block';
    }
}

// متغيرات حالة القفل والحماية للأرصدة
window.isVariantsStockLocked = true;
window.isMainStockLocked = true;

function renderSmartMatrixView() {
    const wrapper = document.getElementById('smartMatrixWrapper');
    if (!wrapper) return;

    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    if (rows.length === 0) {
        wrapper.innerHTML = `
            <div style="padding: 30px; text-align: center; color: #94a3b8; font-weight: bold; font-size: 0.95rem;">
                <span>👕📦 لا توجد تشكيلات مضافة بعد. اختر قالباً أو أضف ألواناً لتظهر في الشبكة الذكية هنا.</span>
            </div>
        `;
        return;
    }

    // استخراج كافة المقاسات والألوان الفريدة
    const sizeSet = new Set();
    const colorSet = new Set();
    const matrixMap = {}; // key: `${color}__${size}` => { rowIndex, stock, origStock, barcode, price, cost }

    for (let i = 0; i < rows.length; i++) {
        const size = rows[i].querySelector('.var-size-input')?.value?.trim() || 'موحد';
        const color = rows[i].querySelector('.var-color-input')?.value?.trim() || 'موحد';
        const stockInput = rows[i].querySelector('.var-stock-input');
        const stock = parseFloat(stockInput?.value) || 0;
        const origStock = (stockInput && stockInput.dataset.origStock !== undefined) ? parseFloat(stockInput.dataset.origStock) : stock;

        sizeSet.add(size);
        colorSet.add(color);

        matrixMap[`${color}__${size}`] = {
            rowIndex: i,
            stock: stock,
            origStock: origStock
        };
    }

    const sizes = Array.from(sizeSet);
    const colors = Array.from(colorSet);
    const isLocked = (typeof window.isVariantsStockLocked !== 'undefined') ? window.isVariantsStockLocked : true;

    // حساب إجماليات المقاسات (الأعمدة)
    const colTotals = {};
    sizes.forEach(s => colTotals[s] = 0);
    let grandTotalStock = 0;

    let tableHtml = `
        <table class="bayan-table" style="margin: 0; width: 100%; font-size: 0.88rem; text-align: center; border-collapse: collapse;">
            <thead style="position: sticky; top: 0; background: #1e293b; color: white; z-index: 5;">
                <tr>
                    <th style="padding: 10px 14px; width: 130px; border-bottom: 2px solid #334155;">اللون / المقاس</th>
                    ${sizes.map(s => `<th style="padding: 10px 12px; border-bottom: 2px solid #334155; font-size: 0.95rem; font-weight: 900;">${s}</th>`).join('')}
                    <th style="padding: 10px 14px; width: 110px; background: #0f172a; color: #38bdf8; border-bottom: 2px solid #334155;">إجمالي اللون</th>
                    <th style="padding: 10px 8px; width: 50px; border-bottom: 2px solid #334155;">حذف</th>
                </tr>
            </thead>
            <tbody>
    `;

    colors.forEach(col => {
        let rowSum = 0;
        let cellsHtml = '';

        sizes.forEach(sz => {
            const item = matrixMap[`${col}__${sz}`];
            const stockVal = item ? item.stock : 0;
            const rIdx = item ? item.rowIndex : -1;
            const origVal = item ? item.origStock : 0;
            const isChanged = item && origVal !== undefined && origVal !== stockVal;
            rowSum += stockVal;
            colTotals[sz] += stockVal;
            grandTotalStock += stockVal;

            if (item) {
                cellsHtml += `
                    <td style="padding: 6px; border: 1px solid #f1f5f9; position: relative;">
                        <input type="number" value="${stockVal}" min="0" data-row-index="${rIdx}" data-orig-stock="${origVal}"
                            ${isLocked ? 'readonly' : ''}
                            onchange="syncMatrixInputToDetailedRow(${rIdx}, this.value)"
                            onfocus="if(window.isVariantsStockLocked) { this.blur(); if(typeof showToast==='function') showToast('🔒 الكميات مقفلة ومحمية. انقر على زر القفل 🔓 في الأعلى للتعديل', 'warning'); } else { this.select(); }"
                            style="width: 58px; height: 32px; font-size: 1rem; font-weight: 900; text-align: center; border: 1.5px solid ${isChanged ? '#f59e0b' : (isLocked ? '#cbd5e1' : '#3b82f6')}; border-radius: 6px; color: ${stockVal > 0 ? '#047857' : '#64748b'}; background: ${isLocked ? (stockVal > 0 ? '#f8fafc' : '#ffffff') : '#eff6ff'}; cursor: ${isLocked ? 'not-allowed' : 'text'};"
                            title="${isChanged ? `القيمة الأصلية السابقة: ${origVal}` : ''}">
                    </td>
                `;
            } else {
                cellsHtml += `
                    <td style="padding: 6px; border: 1px solid #f1f5f9; background: #f8fafc;">
                        <button type="button" onclick="createVariantAndRenderMatrix('${sz}', '${col}')"
                            style="border: 1px dashed #cbd5e1; background: transparent; color: #94a3b8; font-weight: bold; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 0.75rem;">+ إضافة</button>
                    </td>
                `;
            }
        });

        tableHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: 900; color: #1e293b; text-align: right; background: #f8fafc; border: 1px solid #f1f5f9;">
                    <span style="font-size: 0.95rem;">🎨 ${col}</span>
                </td>
                ${cellsHtml}
                <td style="padding: 8px 12px; font-weight: 900; font-size: 1rem; color: #0284c7; background: #f0f9ff; border: 1px solid #e0f2fe;">
                    ${rowSum}
                </td>
                <td style="padding: 6px; border: 1px solid #f1f5f9; white-space: nowrap;">
                    <button type="button" onclick="restoreColorRowInMatrix('${col}')"
                        style="background: #f0fdf4; color: #166534; border: 1px solid #86efac; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-weight: 900; margin-left: 3px;" title="استعادة أرصدة هذا اللون للأصل">🔄</button>
                    <button type="button" onclick="removeColorRowFromMatrix('${col}')"
                        style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-weight: 900;" title="حذف كل مقاسات هذا اللون">✕</button>
                </td>
            </tr>
        `;
    });

    // سطر إجمالي المقاسات (الفوتر الذكي)
    tableHtml += `
            </tbody>
            <tfoot style="position: sticky; bottom: 0; background: #f8fafc; font-weight: 900; border-top: 2px solid #cbd5e1; z-index: 4;">
                <tr>
                    <td style="padding: 10px 14px; text-align: right; color: #475569; font-weight: 900;">إجمالي المقاس:</td>
                    ${sizes.map(s => `<td style="padding: 10px; font-size: 1rem; color: #7c3aed; background: #f5f3ff;">${colTotals[s]}</td>`).join('')}
                    <td style="padding: 10px 14px; font-size: 1.15rem; color: #047857; background: #ecfdf5; border: 2px solid #86efac; border-radius: 6px;">
                        ${grandTotalStock}
                    </td>
                    <td></td>
                </tr>
            </tfoot>
        </table>
    `;

    wrapper.innerHTML = tableHtml;
}

function syncMatrixInputToDetailedRow(rowIndex, newStock) {
    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    if (rows[rowIndex]) {
        const stockInp = rows[rowIndex].querySelector('.var-stock-input');
        if (stockInp) {
            stockInp.value = newStock;
        }
    }
    renderSmartMatrixView();
}

// استعادة القيم الأصلية لصف واحد في جدول التشكيلات
window.restoreSingleVariantRow = function(btn) {
    const tr = btn.closest('tr');
    if (!tr) return;
    const stockInp = tr.querySelector('.var-stock-input');
    const priceInp = tr.querySelector('.var-price-input');
    const wsInp = tr.querySelector('.var-ws-input');
    const costInp = tr.querySelector('.var-cost-input');

    if (stockInp && stockInp.dataset.origStock !== undefined) stockInp.value = stockInp.dataset.origStock;
    if (priceInp && priceInp.dataset.origPrice !== undefined) priceInp.value = priceInp.dataset.origPrice;
    if (wsInp && wsInp.dataset.origWs !== undefined) wsInp.value = wsInp.dataset.origWs;
    if (costInp && costInp.dataset.origCost !== undefined) costInp.value = costInp.dataset.origCost;

    renderSmartMatrixView();
    if (typeof showToast === 'function') showToast('🔄 تمت استعادة القيم الأصلية لهذا الصف', 'success');
};

// استعادة أرصدة لون محدد في الماتريكس
window.restoreColorRowInMatrix = function(col) {
    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
        const colInp = rows[i].querySelector('.var-color-input');
        if (colInp && colInp.value.trim() === col) {
            const stockInp = rows[i].querySelector('.var-stock-input');
            if (stockInp && stockInp.dataset.origStock !== undefined) {
                stockInp.value = stockInp.dataset.origStock;
                count++;
            }
        }
    }
    renderSmartMatrixView();
    if (typeof showToast === 'function') showToast(`🔄 تم استعادة أرصدة لون (${col}) للأصل`, 'success');
};

// تبديل حالة قفل كميات المقاسات والألوان
window.toggleVariantsStockLock = function() {
    window.isVariantsStockLocked = !window.isVariantsStockLocked;
    const btn = document.getElementById('btnToggleVariantsLock');
    const icon = document.getElementById('variantsLockIcon');
    const text = document.getElementById('variantsLockText');
    if (window.isVariantsStockLocked) {
        if (icon) icon.innerText = '🔒';
        if (text) text.innerText = 'الكميات مقفلة (محمية)';
        if (btn) {
            btn.style.background = '#fffbeb';
            btn.style.borderColor = '#f59e0b';
            btn.style.color = '#b45309';
        }
        if (typeof showToast === 'function') showToast('🔒 تم قفل وحماية الكميات من التعديل العفوي', 'info');
    } else {
        if (icon) icon.innerText = '🔓';
        if (text) text.innerText = 'تعديل الكميات متاح';
        if (btn) {
            btn.style.background = '#ecfdf5';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#047857';
        }
        if (typeof showToast === 'function') showToast('🔓 تم فتح تعديل الكميات. يمكنك التعديل الآن بحرية', 'success');
    }
    renderSmartMatrixView();
    syncDetailedTableLockState();
};

// مزامنة حالة القفل مع جدول التشكيلات التفصيلي
window.syncDetailedTableLockState = function() {
    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    for (let i = 0; i < rows.length; i++) {
        const stockInp = rows[i].querySelector('.var-stock-input');
        if (stockInp) {
            if (window.isVariantsStockLocked) {
                stockInp.setAttribute('readonly', 'true');
                stockInp.style.background = '#f8fafc';
                stockInp.style.cursor = 'not-allowed';
            } else {
                stockInp.removeAttribute('readonly');
                stockInp.style.background = '#ffffff';
                stockInp.style.cursor = 'text';
            }
        }
    }
};

// استعادة كافة الأرصدة والتشكيلات الأصلية المحفوظة
window.restoreAllVariantsStock = function() {
    const tbody = document.getElementById('productVariantsTableBody');
    if (!tbody) return;

    // إذا كانت هناك نسخة أصلية محفوظة للصنف عند فتحه، نقوم بإعادة بناء أي صفوف حُذفت
    if (window.initialModalVariants && Array.isArray(window.initialModalVariants) && window.initialModalVariants.length > 0) {
        tbody.innerHTML = '';
        window.initialModalVariants.forEach(v => {
            addVariantRow(v.size, v.color, v.barcode, v.stock, v.price, v.wholesale, v.cost);
        });
    } else {
        const rows = tbody.rows || [];
        for (let i = 0; i < rows.length; i++) {
            const stockInp = rows[i].querySelector('.var-stock-input');
            const priceInp = rows[i].querySelector('.var-price-input');
            const wsInp = rows[i].querySelector('.var-ws-input');
            const costInp = rows[i].querySelector('.var-cost-input');

            if (stockInp && stockInp.dataset.origStock !== undefined) stockInp.value = stockInp.dataset.origStock;
            if (priceInp && priceInp.dataset.origPrice !== undefined) priceInp.value = priceInp.dataset.origPrice;
            if (wsInp && wsInp.dataset.origWs !== undefined) wsInp.value = wsInp.dataset.origWs;
            if (costInp && costInp.dataset.origCost !== undefined) costInp.value = costInp.dataset.origCost;
        }
    }
    updateVariantsCountBadge();
    renderSmartMatrixView();
    if (typeof showToast === 'function') showToast(`🔄 تمت استعادة كافة الأرصدة والتشكيلات الأصلية السابقة بنجاح`, 'success');
};

// تطبيق كمية موحدة على جميع التشكيلات بنقرة واحدة
window.applyUniformQtyToAllVariants = function() {
    const qty = parseFloat(document.getElementById('fillAllVariantsQtyInput')?.value);
    if (isNaN(qty) || qty < 0) {
        if (typeof showToast === 'function') showToast('⚠️ يرجى إدخال كمية صحيحة للتعبئة الموحدة!', 'warning');
        return;
    }
    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    if (rows.length === 0) {
        if (typeof showToast === 'function') showToast('⚠️ لا توجد تشكيلات حالياً لتطبيق الكمية عليها!', 'warning');
        return;
    }
    for (let i = 0; i < rows.length; i++) {
        const stockInp = rows[i].querySelector('.var-stock-input');
        if (stockInp) {
            stockInp.value = qty;
        }
    }
    renderSmartMatrixView();
    if (typeof showToast === 'function') showToast(`⚡ تم تطبيق كمية (${qty}) على جميع التشكيلات بنجاح`, 'success');
};

// قفل / فتح رصيد الصنف الافتتاحي في تبويب الكميات
window.toggleMainStockLock = function() {
    window.isMainStockLocked = !window.isMainStockLocked;
    const inp = document.getElementById('newItemStock');
    const btn = document.getElementById('toggleMainStockLockBtn');
    if (!inp || !btn) return;
    if (window.isMainStockLocked) {
        inp.setAttribute('readonly', 'true');
        inp.style.background = '#f8fafc';
        inp.style.cursor = 'not-allowed';
        btn.innerHTML = '🔒 مقفل';
        btn.style.background = '#fffbeb';
        btn.style.color = '#b45309';
        btn.style.borderColor = '#f59e0b';
        if (typeof showToast === 'function') showToast('🔒 تم قفل الرصيد الافتتاحي وحمايته', 'info');
    } else {
        inp.removeAttribute('readonly');
        inp.style.background = '#ffffff';
        inp.style.cursor = 'text';
        btn.innerHTML = '🔓 تعديل';
        btn.style.background = '#ecfdf5';
        btn.style.color = '#047857';
        btn.style.borderColor = '#10b981';
        if (typeof showToast === 'function') showToast('🔓 تم فتح الرصيد الافتتاحي للتعديل', 'success');
    }
};

// استعادة رصيد الصنف الافتتاحي الأصلي
window.restoreMainStock = function() {
    const inp = document.getElementById('newItemStock');
    if (inp && inp.dataset.origStock !== undefined) {
        inp.value = inp.dataset.origStock;
        if (typeof showToast === 'function') showToast('🔄 تمت استعادة الرصيد الافتتاحي الأصلي بنجاح', 'success');
    }
};

function createVariantAndRenderMatrix(size, color) {
    const curPrice = parseFloat(document.getElementById('newItemPrice')?.value) || 0;
    const curWs = parseFloat(document.getElementById('newItemWholesale')?.value) || 0;
    const curCost = parseFloat(document.getElementById('newItemCost')?.value) || 0;

    addVariantRow(size, color, '', 1, curPrice, curWs, curCost);
    renderSmartMatrixView();
}

function removeColorRowFromMatrix(colorName) {
    const tbody = document.getElementById('productVariantsTableBody');
    if (!tbody) return;

    const rows = Array.from(tbody.rows);
    rows.forEach(r => {
        const cVal = r.querySelector('.var-color-input')?.value?.trim() || 'موحد';
        if (cVal === colorName) {
            r.remove();
        }
    });

    updateVariantsCountBadge();
    renderSmartMatrixView();
    showToast(`🗑️ تم حذف تشكيلات لون (${colorName})`, "info");
}

window.toggleVariantsViewMode = toggleVariantsViewMode;
window.renderSmartMatrixView = renderSmartMatrixView;
window.syncMatrixInputToDetailedRow = syncMatrixInputToDetailedRow;
window.createVariantAndRenderMatrix = createVariantAndRenderMatrix;
window.removeColorRowFromMatrix = removeColorRowFromMatrix;

function generateAllVariantBarcodes() {
    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    if (rows.length === 0) return showToast("⚠️ لا توجد مقاسات مسجلة لتوليد الباركود لها", "info");

    for (let i = 0; i < rows.length; i++) {
        const barcodeInp = rows[i].querySelector('.var-barcode-input');
        const sizeInp = rows[i].querySelector('.var-size-input');
        const colorInp = rows[i].querySelector('.var-color-input');
        if (barcodeInp) {
            barcodeInp.value = generateVariantBarcode(sizeInp ? sizeInp.value : '', colorInp ? colorInp.value : '', i + 1);
        }
    }
    showToast("✅ تم توليد الباركودات لكافة المقاسات والألوان بنجاح!", "success");
}

// =========================================================================
// 🏷️ طباعة تيكتات وملصقات الملابس والأحذية (Clothing Hangtags & Labels)
// =========================================================================

function printProductVariantHangtags() {
    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    const productName = document.getElementById('newItemName')?.value || 'موديل ملابس';
    const shopName = (document.getElementById('shopName') ? document.getElementById('shopName').value : '') || 'بيان فاشون';
    const currency = typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : 'ج.م';

    if (rows.length === 0) {
        return showToast("⚠️ لا توجد مقاسات مسجلة لطباعة تيكتات لها!", "warning");
    }

    const targets = [];
    for (let i = 0; i < rows.length; i++) {
        const size = rows[i].querySelector('.var-size-input')?.value || 'قياسي';
        const color = rows[i].querySelector('.var-color-input')?.value || 'موحد';
        let barcode = rows[i].querySelector('.var-barcode-input')?.value || '';
        if (!barcode) {
            barcode = generateVariantBarcode(size, color, i + 1);
            if (rows[i].querySelector('.var-barcode-input')) rows[i].querySelector('.var-barcode-input').value = barcode;
        }
        const price = parseFloat(rows[i].querySelector('.var-price-input')?.value) || parseFloat(document.getElementById('newItemPrice')?.value) || 0;
        const stock = parseInt(rows[i].querySelector('.var-stock-input')?.value) || 1;

        targets.push({
            name: productName,
            size: size,
            color: color,
            barcode: barcode,
            price: price,
            copies: Math.max(1, stock)
        });
    }

    const bSettings = (typeof getBarcodeLabelSettings === 'function') ? getBarcodeLabelSettings() : { width: 50, height: 35, offsetX: 0, barcodeHeight: 28 };
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    printWindow.document.write(`
        <html>
        <head>
            <title>طباعة تيكتات الملابس - ${productName}</title>
            <style>
                @page {
                    size: ${bSettings.width || 50}mm ${bSettings.height || 35}mm;
                    margin: 0mm;
                }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
                html, body {
                    width: ${bSettings.width || 50}mm;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    direction: rtl;
                    text-align: center;
                    background: #fff;
                    color: #000;
                }
                .hangtag-label { 
                    width: ${bSettings.width || 50}mm;
                    height: ${bSettings.height || 35}mm;
                    padding: 1.5mm 2mm;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    page-break-after: always;
                    page-break-inside: avoid;
                    overflow: hidden;
                    border: 1px dashed #ccc;
                }
                .shop-name { font-size: 8pt; font-weight: 900; color: #1e293b; line-height: 1; border-bottom: 1px solid #000; width: 100%; padding-bottom: 1mm; margin-bottom: 0.5mm; }
                .model-name { font-size: 8.5pt; font-weight: 800; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; line-height: 1.1; }
                .variant-badge-row { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0 1mm; }
                .size-badge { font-size: 8pt; font-weight: 900; background: #000; color: #fff; padding: 0.5mm 2.5mm; border-radius: 2px; }
                .color-badge { font-size: 7.5pt; font-weight: 800; color: #333; }
                .price-badge { font-size: 9.5pt; font-weight: 900; color: #000; border: 1.5px solid #000; padding: 0.5mm 3.5mm; border-radius: 3px; line-height: 1; }
                svg { max-width: 96%; height: 26px; margin: 0 auto; display: block; }
                @media print {
                    html, body { width: ${bSettings.width || 50}mm; margin: 0 !important; padding: 0 !important; }
                    .hangtag-label { border: none !important; box-shadow: none !important; }
                }
            </style>
        </head>
        <body>
            <div id="labelsContainer"></div>
        </body>
        </html>
    `);

    const container = printWindow.document.getElementById('labelsContainer');
    let svgIndex = 0;

    targets.forEach(t => {
        for (let c = 0; c < t.copies; c++) {
            svgIndex++;
            const label = printWindow.document.createElement('div');
            label.className = 'hangtag-label';
            label.innerHTML = `
                <div class="shop-name">${shopName}</div>
                <div class="model-name">${t.name}</div>
                <div class="variant-badge-row">
                    <span class="size-badge">SIZE: ${t.size}</span>
                    <span class="color-badge">اللون: ${t.color}</span>
                </div>
                <svg id="ht-svg-${svgIndex}"></svg>
                <div class="price-badge">${t.price.toFixed(2)} ${currency}</div>
            `;
            container.appendChild(label);

            if (window.JsBarcode) {
                try {
                    window.JsBarcode(label.querySelector('svg'), String(t.barcode), {
                        format: "CODE128",
                        width: 1.3,
                        height: 24,
                        displayValue: true,
                        fontSize: 9,
                        textMargin: 1,
                        margin: 0
                    });
                } catch(e) {
                    console.warn("JsBarcode error:", e);
                }
            }
        }
    });

    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 400);

    showToast(`🖨️ جاري إرسال (${svgIndex}) تيكت للطباعة...`, "success");
}

function updateVariantsCountBadge() {
    const count = document.getElementById('productVariantsTableBody')?.rows?.length || 0;
    const badge = document.getElementById('variantsCountBadge');
    if (badge) badge.innerText = count;
}

function initBarcodeScannerHandlers() {
    const bcInput = document.getElementById('newItemBarcode');
    if (!bcInput || bcInput._hasBarcodeHandlers) return;
    bcInput._hasBarcodeHandlers = true;

    bcInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nameInp = document.getElementById('newItemName');
            if (nameInp) nameInp.focus();
        }
    });

    bcInput.addEventListener('change', async (e) => {
        const val = e.target.value.trim();
        if (val) {
            const curEditId = typeof currentEditingProductId !== 'undefined' ? currentEditingProductId : null;
            if (typeof BayanBarcode !== 'undefined' && BayanBarcode.isDuplicate(val, curEditId)) {
                const exists = productsDB.find(p => p.barcode === val && p.id !== curEditId);
                const pName = exists ? exists.name : '';
                if (typeof showToast === 'function') {
                    showToast(`⚠️ تنبيه: هذا الباربود مسجل مسبقاً لصنف (${pName})`, 'warning');
                }
                if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(false);
                bcInput.style.border = '2px solid red';
            } else {
                bcInput.style.border = '1px solid #ddd';
            }
        }
    });
}
setTimeout(initBarcodeScannerHandlers, 1000);
