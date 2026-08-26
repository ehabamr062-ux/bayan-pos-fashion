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
            return JSON.parse(stored);
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
        showCode: true
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
        showCode: document.getElementById('bcShowCode')?.checked ?? true
    };
    if (typeof setStore === 'function') {
        setStore('bayan_barcode_label_settings', JSON.stringify(s));
    }
    if (typeof showToast === 'function') showToast("✅ تم حفظ إعدادات ومقاسات طابعة الباركود بنجاح!", "success");
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
}

function testPrintBarcodeLabel() {
    const testItem = {
        id: 999,
        name: 'منتج تجريبي للتجربة',
        code: 'TEST-101',
        barcode: '123456789012',
        price: 99.00
    };
    executePrinting([testItem], 1);
}

window.getBarcodeLabelSettings = getBarcodeLabelSettings;
window.saveBarcodeLabelSettings = saveBarcodeLabelSettings;
window.loadBarcodeLabelSettings = loadBarcodeLabelSettings;
window.testPrintBarcodeLabel = testPrintBarcodeLabel;

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
                size: '',
                color: '',
                code: codeVal,
                barcode: barcodeVal,
                price: parseFloat(p.price) || 0,
                copies: copies
            });
        }
    });

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>طباعة ملصقات الباركود والملابس</title>
            <style>
                @page {
                    size: ${bSettings.width}mm ${bSettings.height}mm;
                    margin: 0mm;
                }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
                html, body {
                    width: ${bSettings.width}mm;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    direction: rtl;
                    text-align: center;
                    background: #fff;
                    color: #000;
                }
                .label-container {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    padding: 0;
                }
                .barcode-label { 
                    width: ${bSettings.width}mm;
                    height: ${bSettings.height}mm;
                    max-height: ${bSettings.height}mm;
                    padding: 0.8mm 1.5mm;
                    margin: 0 auto;
                    position: relative;
                    left: ${bSettings.offsetX}mm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-around;
                    page-break-after: always;
                    page-break-inside: avoid;
                    overflow: hidden;
                    border: 1px dashed #ccc;
                    box-sizing: border-box;
                }
                .shop-title { font-size: 7.5pt; font-weight: 800; color: #000; line-height: 1; margin: 0; }
                .item-name { font-size: 8.5pt; font-weight: 900; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; color: #000; line-height: 1.1; }
                .variant-badge-row { display: flex; justify-content: center; gap: 4px; align-items: center; width: 100%; font-size: 7pt; font-weight: 800; }
                .size-badge { background: #000; color: #fff; padding: 0.5px 3px; border-radius: 2px; }
                .color-badge { color: #333; }
                .item-code-line { font-size: 6.5pt; font-weight: 900; color: #000; margin: 0; line-height: 1; }
                .price-tag { font-size: 9.5pt; font-weight: 900; color: #000; border: 1.2px solid #000; padding: 0.5mm 5mm; border-radius: 3px; background: #fff; line-height: 1.1; margin: 0; }
                svg { max-width: 96%; height: ${bSettings.barcodeHeight || 24}px; margin: 0 auto; display: block; }
                @media print {
                    html, body { width: ${bSettings.width}mm; margin: 0 !important; padding: 0 !important; }
                    .barcode-label { border: none !important; box-shadow: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="label-container" id="printableLabels"></div>
        </body>
        </html>
    `);

    const labelsDiv = printWindow.document.getElementById('printableLabels');
    let labelIdx = 0;

    printableItems.forEach(item => {
        const priceFormatted = (item.price || 0).toFixed(2) + ' ' + currency;
        const hasVariantInfo = !!(item.size || item.color);

        for (let i = 0; i < item.copies; i++) {
            labelIdx++;
            const label = printWindow.document.createElement('div');
            label.className = 'barcode-label';
            label.innerHTML = `
                ${bSettings.showShopName ? `<div class="shop-title">${shopName}</div>` : ''}
                ${bSettings.showItemName ? `<div class="item-name" title="${item.name}">${item.name}</div>` : ''}
                ${hasVariantInfo ? `
                    <div class="variant-badge-row">
                        ${item.size ? `<span class="size-badge">SIZE: ${item.size}</span>` : ''}
                        ${item.color ? `<span class="color-badge">لون: ${item.color}</span>` : ''}
                    </div>
                ` : ''}
                ${bSettings.showCode && item.code ? `<div class="item-code-line">كود: ${item.code}</div>` : ''}
                <svg id="barcode-${labelIdx}"></svg>
                ${bSettings.showPrice ? `<div class="price-tag">${priceFormatted}</div>` : ''}
            `;
            labelsDiv.appendChild(label);

            if (window.JsBarcode) {
                try {
                    window.JsBarcode(label.querySelector('svg'), String(item.barcode), {
                        format: "CODE128",
                        width: 1.3,
                        height: bSettings.barcodeHeight || 24,
                        displayValue: true,
                        fontSize: 8,
                        textMargin: 0,
                        margin: 0
                    });
                } catch(err) {
                    console.warn("Barcode rendering error:", err);
                }
            }
        }
    });

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
    } else if (presetType === 'shoes') {
        input.value = '38, 39, 40, 41, 42, 43, 44, 45';
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

    const tr = document.createElement('tr');
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
            <div style="display: flex; gap: 4px; align-items: center;">
                <input type="text" class="search-input var-barcode-input" value="${autoBarcode}" placeholder="باركود القطعة"
                    style="height: 32px; font-family: monospace; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; letter-spacing: 0.5px; font-size: 0.8rem;">
                <button type="button" class="bayan-btn" onclick="this.previousElementSibling.value = generateVariantBarcode();"
                    style="padding: 2px 6px; height: 32px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.75rem;" title="توليد باركود جديد">⚡</button>
            </div>
        </td>
        <td>
            <div style="display: flex; gap: 3px; align-items: center; justify-content: center;">
                <button type="button" class="var-lock-btn" onclick="toggleDetailedStockLock(this)"
                    data-locked="true"
                    style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; width: 24px; height: 32px; cursor: pointer; font-size: 0.75rem; padding: 0;"
                    title="قفل الحقل ضد التعديل بالخطأ (اضغط لفتح القفل)">🔒</button>
                <input type="number" class="search-input var-stock-input" value="${effectiveStock}" min="0"
                    data-original-stock="${effectiveStock}"
                    readonly
                    style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; cursor: not-allowed;">
                <button type="button" class="var-undo-btn" onclick="undoDetailedStockChange(this)"
                    style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; width: 24px; height: 32px; cursor: pointer; font-size: 0.8rem; padding: 0; color: #64748b;"
                    title="استرجاع الكمية السابقة (${effectiveStock})">↩️</button>
            </div>
        </td>
        <td>
            <input type="number" class="search-input var-price-input" value="${defaultPrice}"
                style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; color: #047857;">
        </td>
        <td>
            <input type="number" class="search-input var-ws-input" value="${defaultWs}"
                style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; color: #0284c7;">
        </td>
        <td>
            <input type="number" class="search-input var-cost-input" value="${defaultCost}"
                style="height: 32px; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px; color: #d97706;">
        </td>
        <td>
            <button type="button" onclick="this.closest('tr').remove(); updateVariantsCountBadge(); renderSmartMatrixView();"
                style="background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-weight: bold;">✕</button>
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
    const matrixMap = {}; // key: `${color}__${size}` => { rowIndex, stock, barcode, price, cost }

    for (let i = 0; i < rows.length; i++) {
        const size = rows[i].querySelector('.var-size-input')?.value?.trim() || 'موحد';
        const color = rows[i].querySelector('.var-color-input')?.value?.trim() || 'موحد';
        const stockInp = rows[i].querySelector('.var-stock-input');
        const stock = parseFloat(stockInp?.value) || 0;
        
        // قراءة الكمية الأصلية الثابتة التي دخل بها الصنف للتعديل
        let origStock = stockInp ? stockInp.dataset.originalStock : undefined;
        if (origStock === undefined || origStock === null) {
            origStock = String(stock);
            if (stockInp) stockInp.dataset.originalStock = origStock;
        }

        sizeSet.add(size);
        colorSet.add(color);

        matrixMap[`${color}__${size}`] = {
            rowIndex: i,
            stock: stock,
            originalStock: origStock
        };
    }

    const sizes = Array.from(sizeSet);
    const colors = Array.from(colorSet);

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
            const origStockVal = item ? item.originalStock : '0';
            const rIdx = item ? item.rowIndex : -1;
            rowSum += stockVal;
            colTotals[sz] += stockVal;
            grandTotalStock += stockVal;

            if (item) {
                cellsHtml += `
                    <td style="padding: 6px; border: 1px solid #f1f5f9;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                            <button type="button" class="matrix-lock-btn" onclick="toggleMatrixStockLock(this)"
                                data-locked="true"
                                style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; width: 22px; height: 26px; cursor: pointer; font-size: 0.72rem; padding: 0;"
                                title="قفل الحقل ضد التعديل بالخطأ (اضغط لفتح القفل)">🔒</button>
                            <input type="number" value="${stockVal}" min="0" data-row-index="${rIdx}"
                                data-original-stock="${origStockVal}"
                                oninput="syncMatrixInputToDetailedRow(${rIdx}, this.value, false)"
                                onchange="syncMatrixInputToDetailedRow(${rIdx}, this.value, true)"
                                onfocus="this.select()"
                                readonly
                                style="width: 52px; height: 30px; font-size: 0.95rem; font-weight: 900; text-align: center; border: 1.5px solid #cbd5e1; border-radius: 6px; color: ${stockVal > 0 ? '#047857' : '#94a3b8'}; background: #f8fafc; cursor: not-allowed;">
                            <button type="button" class="matrix-undo-btn" onclick="undoMatrixStockChange(this, ${rIdx})"
                                style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; width: 22px; height: 26px; cursor: pointer; font-size: 0.75rem; padding: 0; color: #64748b;"
                                title="استرجاع الكمية الأصلية السابقة (${origStockVal})">↩️</button>
                        </div>
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
                <td style="padding: 6px; border: 1px solid #f1f5f9;">
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

// 🔒 دالة قفل / فتح تعديل الكمية في الشبكة الذكية
window.toggleMatrixStockLock = function(btn) {
    const container = btn.closest('div');
    if (!container) return;
    const input = container.querySelector('input[type="number"]');
    if (!input) return;

    const isLocked = btn.dataset.locked === 'true';
    if (isLocked) {
        // فتح القفل
        btn.dataset.locked = 'false';
        btn.innerText = '🔓';
        btn.style.background = '#dcfce7';
        btn.style.borderColor = '#86efac';
        input.removeAttribute('readonly');
        input.style.cursor = 'text';
        input.style.background = '#fff';
        input.style.borderColor = '#10b981';
        input.focus();
        input.select();
        showToast("🔓 تم فتح قفل الكمية للتعديل", "info");
    } else {
        // إعادة القفل
        btn.dataset.locked = 'true';
        btn.innerText = '🔒';
        btn.style.background = '#f1f5f9';
        btn.style.borderColor = '#cbd5e1';
        input.setAttribute('readonly', 'true');
        input.style.cursor = 'not-allowed';
        input.style.background = '#f8fafc';
        input.style.borderColor = '#cbd5e1';
    }
};

// ↩️ دالة استرجاع الكمية السابقة في الشبكة الذكية
window.undoMatrixStockChange = function(btn, rowIndex) {
    const container = btn.closest('div');
    if (!container) return;
    const input = container.querySelector('input[type="number"]');
    if (!input) return;

    const origStock = input.dataset.originalStock || '0';
    input.value = origStock;
    syncMatrixInputToDetailedRow(rowIndex, origStock);
    showToast(`↩️ تم استرجاع الكمية الأصلية: (${origStock})`, "success");
};

// 🔒 دالة قفل / فتح تعديل الكمية في الجدول التفصيلي
window.toggleDetailedStockLock = function(btn) {
    const container = btn.closest('div');
    if (!container) return;
    const input = container.querySelector('.var-stock-input');
    if (!input) return;

    const isLocked = btn.dataset.locked === 'true';
    if (isLocked) {
        btn.dataset.locked = 'false';
        btn.innerText = '🔓';
        btn.style.background = '#dcfce7';
        btn.style.borderColor = '#86efac';
        input.removeAttribute('readonly');
        input.style.cursor = 'text';
        input.style.background = '#fff';
        input.style.borderColor = '#10b981';
        input.focus();
        input.select();
        showToast("🔓 تم فتح قفل الكمية للتعديل", "info");
    } else {
        btn.dataset.locked = 'true';
        btn.innerText = '🔒';
        btn.style.background = '#f1f5f9';
        btn.style.borderColor = '#cbd5e1';
        input.setAttribute('readonly', 'true');
        input.style.cursor = 'not-allowed';
        input.style.background = '#f8fafc';
        input.style.borderColor = '#cbd5e1';
    }
};

// ↩️ دالة استرجاع الكمية السابقة في الجدول التفصيلي
window.undoDetailedStockChange = function(btn) {
    const container = btn.closest('div');
    if (!container) return;
    const input = container.querySelector('.var-stock-input');
    if (!input) return;

    const origStock = input.dataset.originalStock || '0';
    input.value = origStock;
    renderSmartMatrixView();
    showToast(`↩️ تم استرجاع الكمية الأصلية: (${origStock})`, "success");
};

function createVariantAndRenderMatrix(size, color) {
    const curPrice = parseFloat(document.getElementById('newItemPrice')?.value) || 0;
    const curWs = parseFloat(document.getElementById('newItemWholesale')?.value) || 0;
    const curCost = parseFloat(document.getElementById('newItemCost')?.value) || 0;

    addVariantRow(size, color, '', 1, curPrice, curWs, curCost);
    renderSmartMatrixView();
}

// 🗑️ سلة التراجع عن حذف التشكيلات
window._deletedVariantsStack = window._deletedVariantsStack || [];

function removeColorRowFromMatrix(colorName) {
    const tbody = document.getElementById('productVariantsTableBody');
    if (!tbody) return;

    const rows = Array.from(tbody.rows);
    const deletedInThisAction = [];

    rows.forEach(r => {
        const cVal = r.querySelector('.var-color-input')?.value?.trim() || 'موحد';
        if (cVal === colorName) {
            deletedInThisAction.push({
                size: r.querySelector('.var-size-input')?.value || '',
                color: cVal,
                barcode: r.querySelector('.var-barcode-input')?.value || '',
                stock: parseFloat(r.querySelector('.var-stock-input')?.value) || 0,
                price: parseFloat(r.querySelector('.var-price-input')?.value) || null,
                wholesale: parseFloat(r.querySelector('.var-ws-input')?.value) || null,
                cost: parseFloat(r.querySelector('.var-cost-input')?.value) || null
            });
            r.remove();
        }
    });

    if (deletedInThisAction.length > 0) {
        window._deletedVariantsStack.push(deletedInThisAction);
    }

    updateVariantsCountBadge();
    renderSmartMatrixView();
    showToast(`🗑️ تم حذف لون (${colorName}) - اضغط زر "↩️ تراجع عن الحذف" للاسترجاع`, "warning");
}

// ↩️ دالة التراجع عن آخر حذف في كارت الصنف
window.undoLastDeletedVariants = function() {
    if (!window._deletedVariantsStack || window._deletedVariantsStack.length === 0) {
        return showToast("⚠️ لا توجد عناصر محذوفة مؤخراً لاسترجاعها!", "info");
    }

    const lastDeleted = window._deletedVariantsStack.pop();
    if (Array.isArray(lastDeleted) && lastDeleted.length > 0) {
        lastDeleted.forEach(v => {
            addVariantRow(v.size, v.color, v.barcode, v.stock, v.price, v.wholesale, v.cost);
        });
        updateVariantsCountBadge();
        renderSmartMatrixView();
        showToast(`✅ تم استرجاع (${lastDeleted.length}) تشكيلات محذوفة بنجاح!`, "success");
    }
};

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
