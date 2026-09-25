// ============================================================
//  مصفوفة المقاسات والألوان وطباعة الباركود وملصقات الملابس
//  (Fashion Matrix, Hangtags & Barcode Label Printing)
// ============================================================
async function printInventoryBarcode() {
    const hasSelected = (window.selectedInventoryIds && window.selectedInventoryIds.size > 0) || !!window.selectedInventoryId;

    if (typeof showCustomAlert !== 'function') {
        const choice = await showCustomPrompt("1- المختارة | 2- الكل", hasSelected ? "1" : "2");
        if (choice) executePrinting(choice === "1" ? "selected" : "all");
        return;
    }

    showCustomAlert({
        type: 'question',
        titleText: '🏷️ خيارات طباعة الباركود',
        msg: hasSelected 
            ? 'يرجى اختيار نطاق طباعة ملصقات الباركود:' 
            : 'لم تقم بتحديد أصناف معينة من الجدول.<br>هل ترغب في طباعة باركودات <b>كافة الأصناف</b> المسجلة؟',
        confirmText: 'طباعة كافة الأصناف كلياً',
        cancelText: hasSelected ? 'طباعة الأصناف المختارة (✔️) فقط' : 'إلغاء',
        showCancel: true,
        onConfirm: () => requestCopiesAndPrint('all'),
        onCancel: () => {
            if (hasSelected) {
                requestCopiesAndPrint('selected');
            }
        }
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

/**
 * تنسيق ذكي وأنيق لبيانات المقاس واللون على ملصق وتيكت الباركود:
 * - لو الصنف بلون فقط (مثل شنطة سوداء): يطبع "أسود" فقط ويتجاهل كلمة "قياسي" أو "موحد".
 * - لو الصنف بمقاس فقط (مثل تيشرت XL): يطبع "XL" فقط ويتجاهل كلمة "موحد".
 * - لو الصنف بمقاس ولون (مثل شبشب 35 أخضر): يطبع "أخضر 35".
 * - لو الصنف عام عادي بدون مقاس ولا لون: يترك فارغاً بنظافة وشياكة.
 */
function formatBarcodeVariantLabel(size, color) {
    let s = String(size || '').trim();
    let c = String(color || '').trim();

    // إزالة أي أقواس أو علامات ترقيم حول الكلمة مثل (قياسي) أو [موحد]
    s = s.replace(/^[\(\[\{'"«]/, '').replace(/[\)\]\}'"»]$/, '').trim();
    c = c.replace(/^[\(\[\{'"«]/, '').replace(/[\)\]\}'"»]$/, '').trim();

    const dummyWords = [
        'قياسي', 'قياسى', 'مقاس قياسي', 'مقاس قياسى',
        'موحد', 'موحدة', 'مقاس موحد', 'مقاس موحدة', 'لون موحد',
        'فري سايز', 'فريسايز', 'فري', 'free size', 'freesize', 'free',
        'عام', 'عادي', 'افتراضي', 'إفتراضي', 'بدون', 'لا يوجد',
        '-', '--', '---', '/', 'n/a', 'na', 'none', 'null', 'undefined', 'default', 'standard', 'onesize', 'one size'
    ];

    const isDummySize = !s || dummyWords.includes(s.toLowerCase());
    const isDummyColor = !c || dummyWords.includes(c.toLowerCase());

    const parts = [];
    if (!isDummyColor) parts.push(c);
    if (!isDummySize) parts.push(s);

    return parts.join(' ');
}
window.formatBarcodeVariantLabel = formatBarcodeVariantLabel;

async function executePrinting(modeOrTargets, copies = 1) {
    let targets = [];
    if (Array.isArray(modeOrTargets)) {
        targets = modeOrTargets;
    } else if (modeOrTargets === "selected") {
        let selectedIds = Array.from(window.selectedInventoryIds || []);
        if (selectedIds.length === 0 && window.selectedInventoryId) {
            selectedIds.push(window.selectedInventoryId);
        }
        if (selectedIds.length === 0) return showToast("⚠️ عفواً، يجب عليك اختيار صنف واحد على الأقل من الجدول أولاً!", "error");

        selectedIds.forEach(id => {
            const p = (typeof productsDB !== 'undefined' && Array.isArray(productsDB))
                ? productsDB.find(x => String(x.id) === String(id) || String(x.barcode) === String(id) || String(x.code) === String(id))
                : null;
            if (p) targets.push(p);
        });

        if (targets.length === 0 && typeof db !== 'undefined' && db.products) {
            try {
                for (const id of selectedIds) {
                    const dbP = await db.products.get(Number(id)) || await db.products.get(String(id));
                    if (dbP) targets.push(dbP);
                }
            } catch(e) {}
        }

        if (targets.length === 0) return showToast("⚠️ لم يتم العثور على بيانات الصنف المحدد للطباعة!", "error");
    } else {
        // وضع كافة الأصناف: استخدام الأصناف المحملة بالذاكرة أو جلبها عند الحاجة فقط
        if (typeof productsDB !== 'undefined' && Array.isArray(productsDB) && productsDB.length > 0) {
            targets = productsDB;
        } else if (typeof window.productsDB !== 'undefined' && Array.isArray(window.productsDB) && window.productsDB.length > 0) {
            targets = window.productsDB;
        } else if (typeof db !== 'undefined' && db.products) {
            try {
                const dbProds = await db.products.toArray();
                if (Array.isArray(dbProds) && dbProds.length > 0) {
                    targets = dbProds;
                }
            } catch(e) {
                console.warn("DB load in executePrinting error:", e);
            }
        }
        if (targets.length === 0) return showToast("⚠️ المخزن فارغ!", "error");
    }

    const bSettings = getBarcodeLabelSettings();
    const shopName = (document.getElementById('shopName') ? document.getElementById('shopName').value : '') || (typeof getMerchantStoreName === 'function' ? getMerchantStoreName() : '') || (typeof window.getMerchantStoreName === 'function' ? window.getMerchantStoreName() : '') || 'بيان فاشون';
    const currency = typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : 'ج.م';

    // توسيع قائمة الأصناف لتشمل كل تركيبة مقاس ولون (Variant) كملصق مستقل ودقيق
    const printableItems = [];
    targets.forEach(p => {
        if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
            p.variants.forEach((v, vIdx) => {
                let vBc = String(v.barcode || '').trim();
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
                    copies: parseInt(v.stock || p.copies || copies) || 1
                });
            });
        } else {
            let barcodeVal = String(p.barcode || p.code || '').trim();
            if (!barcodeVal) {
                barcodeVal = (typeof generateVariantBarcode === 'function') ? generateVariantBarcode('', '', 1) : ('20' + String(Date.now()).slice(-8));
                p.barcode = barcodeVal;
            }
            printableItems.push({
                name: p.name,
                size: p.size || '',
                color: p.color || '',
                code: p.code || barcodeVal,
                barcode: barcodeVal,
                price: parseFloat(p.price) || 0,
                copies: parseInt(p.copies || copies) || 1
            });
        }
    });

    if (printableItems.length === 0) {
        return showToast("⚠️ لا توجد أصناف قابلة للطباعة!", "warning");
    }

    const labelWidth = parseFloat(bSettings.width) || 50;
    const labelHeight = parseFloat(bSettings.height) || 25;
    const isSmall = labelWidth <= 42 || labelHeight <= 28;
    
    // سُمك خطوط الباركود عريض وسريع القراءة مع مسافة أمان لمنع الخروج عن الحواف
    const barcodeW = isSmall ? 1.25 : 1.35;
    const barcodeH = parseInt(bSettings.barcodeHeight || (isSmall ? 18 : 22), 10);

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
        const priceFormatted = (parseFloat(item.price) || 0).toFixed(2);
        const variantText = formatBarcodeVariantLabel(item.size, item.color);

        for (let i = 0; i < item.copies; i++) {
            labelIdx++;
            const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgEl.id = `temp-barcode-${labelIdx}`;
            tempContainer.appendChild(svgEl);

            if (window.JsBarcode) {
                try {
                    let bcStr = String(item.barcode || item.code || '1000001').trim();
                    if (!bcStr || /[^\x00-\x7F]/.test(bcStr)) {
                        bcStr = '20' + String(Date.now()).slice(-8);
                    }
                    window.JsBarcode(svgEl, bcStr, {
                        format: "CODE128",
                        width: barcodeW,
                        height: barcodeH,
                        displayValue: true,
                        fontSize: isSmall ? 7.8 : 8.8,
                        font: "Segoe UI, Arial, sans-serif",
                        fontOptions: "bold",
                        textMargin: 1,
                        margin: 2 // مسافة أمان بيضاء على اليمين واليسار تمنع أكل الخطوط من الحواف
                    });
                } catch(err) {
                    console.warn("Barcode rendering error:", err);
                }
            }

            const svgString = svgEl.outerHTML;

            labelsHtml += `
                <div class="barcode-label">
                    ${bSettings.showShopName ? `<div class="shop-title">${shopName}</div>` : ''}
                    <div class="divider-line"></div>
                    ${bSettings.showItemName ? `<div class="item-name" title="${item.name}">${item.name}</div>` : ''}
                    <div class="svg-wrap">
                        ${svgString}
                    </div>
                    <div class="bottom-row">
                        ${variantText ? `<div class="variant-text" title="${variantText}"><bdi>${variantText}</bdi></div>` : '<div class="variant-text"></div>'}
                        ${bSettings.showPrice ? `<div class="price-val">${priceFormatted}</div>` : ''}
                    </div>
                </div>
            `;
        }
    });

    // إزالة الحاوية المؤقتة
    document.body.removeChild(tempContainer);

    const fullPrintHtml = `
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
                    width: 100%;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
                    direction: rtl;
                    text-align: center;
                    background: #ffffff;
                    color: #000000;
                }
                .label-container {
                    width: ${bSettings.width}mm;
                    margin: 0 auto;
                    padding: 0;
                    ${parseFloat(bSettings.offsetX) ? `transform: translateX(${parseFloat(bSettings.offsetX)}mm);` : ''}
                }
                .barcode-label { 
                    width: ${bSettings.width}mm;
                    height: ${bSettings.height}mm;
                    max-height: ${bSettings.height}mm;
                    padding: 0.8mm 2mm;
                    margin: 0 auto !important;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    page-break-after: always;
                    break-after: page;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    overflow: hidden;
                    box-sizing: border-box;
                    text-align: center;
                }
                .shop-title { 
                    font-size: ${isSmall ? '6.8pt' : '7.8pt'}; 
                    font-weight: 900; 
                    color: #000000; 
                    line-height: 1.1; 
                    margin: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                    text-align: center;
                    letter-spacing: 0.2px;
                    padding: 0 1.5mm;
                }
                .divider-line {
                    width: 100%;
                    border-bottom: 1px solid #000000;
                    margin: 0.2mm 0;
                }
                .item-name { 
                    font-size: ${isSmall ? '7.2pt' : '8.2pt'}; 
                    font-weight: 900; 
                    margin: 0; 
                    white-space: nowrap; 
                    overflow: hidden; 
                    text-overflow: ellipsis; 
                    max-width: 100%; 
                    color: #000000; 
                    line-height: 1.1; 
                    text-align: center;
                    padding: 0 1.5mm;
                }
                .svg-wrap {
                    width: 100%;
                    max-width: 95%;
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
                .bottom-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                    padding: 0 1.2mm;
                    margin: 0;
                    line-height: 1.15;
                    box-sizing: border-box;
                }
                .variant-text {
                    font-size: ${isSmall ? '7.2pt' : '8.2pt'};
                    font-weight: 900;
                    color: #000000;
                    text-align: right;
                    direction: rtl;
                    unicode-bidi: isolate;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    flex: 1;
                    min-width: 0;
                    padding-left: 1.5mm;
                }
                .variant-text bdi {
                    display: inline-block;
                    max-width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    vertical-align: bottom;
                }
                .price-val {
                    font-size: ${isSmall ? '8pt' : '9.5pt'};
                    font-weight: 900;
                    color: #000000;
                    text-align: left;
                    direction: ltr;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                @media print {
                    .no-print { display: none !important; }
                    html, body { 
                        width: 100% !important; 
                        height: auto !important; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        overflow: visible !important;
                    }
                    .label-container {
                        width: ${bSettings.width}mm !important;
                        margin: 0 auto !important;
                        ${parseFloat(bSettings.offsetX) ? `transform: translateX(${parseFloat(bSettings.offsetX)}mm) !important;` : ''}
                    }
                    .barcode-label { 
                        width: ${bSettings.width}mm !important;
                        height: ${bSettings.height}mm !important;
                        padding: 0.8mm 2mm !important;
                        border: none !important; 
                        box-shadow: none !important; 
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="text-align: center; margin-bottom: 12px; padding: 10px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-family: 'Segoe UI', Tahoma, sans-serif;">
                <button onclick="window.print()" style="background: #2563eb; color: white; padding: 8px 22px; font-size: 15px; border: none; border-radius: 7px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-left: 8px;">🖨️ طباعة الآن</button>
                <button onclick="window.close()" style="background: #ef4444; color: white; padding: 8px 22px; font-size: 15px; border: none; border-radius: 7px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">❌ إغلاق</button>
            </div>
            <div class="label-container">
                ${labelsHtml}
            </div>
            <script>
                function triggerPrint() {
                    window.focus();
                    window.print();
                }
                if (document.readyState === 'complete') {
                    setTimeout(triggerPrint, 350);
                } else {
                    window.addEventListener('load', function() {
                        setTimeout(triggerPrint, 350);
                    });
                }
            </script>
        </body>
        </html>
    `;

    // 2. استخدام نافذة طباعة مخصصة وموثوقة بنسبة 100% متوافقة مع Electron وكافة المتصفحات (نفس أسلوب طباعة الفواتير الناجح)
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(fullPrintHtml);
        printWindow.document.close();
    } else {
        // بديل أمان فوري في حال حظر النوافذ المنبثقة بالمتصفح
        let printIframe = document.getElementById('bayan-barcode-print-iframe');
        if (!printIframe) {
            printIframe = document.createElement('iframe');
            printIframe.id = 'bayan-barcode-print-iframe';
            printIframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;border:none;background:#ffffff;';
            document.body.appendChild(printIframe);
        }
        const pDoc = printIframe.contentWindow.document;
        pDoc.open();
        pDoc.write(fullPrintHtml);
        pDoc.close();
        setTimeout(() => {
            try {
                printIframe.contentWindow.focus();
                printIframe.contentWindow.print();
            } catch(e) {
                console.error("Iframe print error:", e);
            }
        }, 400);
    }
}
window.executePrinting = executePrinting;
window.printInventoryBarcode = printInventoryBarcode;

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

window.copyVariantBarcode = function(btn) {
    const row = btn.closest('tr');
    const inp = row ? row.querySelector('.var-barcode-input') : null;
    if (inp && inp.value.trim()) {
        const val = inp.value.trim();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(() => {
                if (typeof showToast === 'function') showToast(`📋 تم نسخ باركود المقاس: ${val}`, 'success');
            }).catch(() => {
                inp.select();
                document.execCommand('copy');
                if (typeof showToast === 'function') showToast(`📋 تم نسخ باركود المقاس: ${val}`, 'success');
            });
        } else {
            inp.select();
            document.execCommand('copy');
            if (typeof showToast === 'function') showToast(`📋 تم نسخ باركود المقاس: ${val}`, 'success');
        }
    }
};

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
        <td style="min-width: 155px;">
            <div style="display: flex; gap: 4px; align-items: center;">
                <input type="text" class="search-input var-barcode-input" value="${autoBarcode}" placeholder="باركود القطعة" readonly
                    onclick="this.select()"
                    style="height: 32px; font-family: monospace; font-weight: 800; text-align: center; border: 1.5px solid #cbd5e1; border-radius: 6px; letter-spacing: 0.5px; font-size: 0.82rem; width: 100%; box-sizing: border-box; background: #f8fafc; color: #1e293b; cursor: default;"
                    title="🔒 باركود فريد محمي تلقائياً - غير قابل للمسح أو التعديل العرضي">
                <button type="button" onclick="copyVariantBarcode(this)" title="نسخ باركود هذا المقاس"
                    style="padding: 0 7px; height: 32px; background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; transition: 0.15s;"
                    onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">📋</button>
            </div>
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
            <button type="button" onclick="printSingleVariantBarcode(this, event)" title="🖨️ طباعة باركود هذا المقاس واللون فقط (Shift+نقر لتحديد عدد النسخ)"
                style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; padding: 4px 6px; cursor: pointer; font-weight: bold; margin-left: 3px;"
                onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">🖨️</button>
            <button type="button" onclick="restoreSingleVariantRow(this)" title="استعادة القيم الأصلية لهذا الصف"
                style="background: #f0fdf4; color: #166534; border: 1px solid #86efac; border-radius: 6px; padding: 4px 6px; cursor: pointer; font-weight: bold; margin-left: 3px;"
                onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">🔄</button>
            <button type="button" onclick="this.closest('tr').remove(); updateVariantsCountBadge(); renderSmartMatrixView();"
                style="background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-weight: bold;"
                onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'" title="حذف هذا الصف">✕</button>
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
        <table class="bayan-table" style="margin: 0; width: 100%; font-size: 0.88rem; text-align: center; border-collapse: separate; border-spacing: 0; border: 2px solid #64748b; border-radius: 8px; overflow: hidden;">
            <thead style="position: sticky; top: 0; background: #0f172a; color: white; z-index: 5;">
                <tr>
                    <th style="padding: 12px 14px; width: 140px; min-width: 140px; background: #0f172a; color: #f8fafc; font-weight: 900; border-bottom: 3px solid #334155; border-left: 2px solid #475569; text-align: right;">
                        <span style="font-size: 0.95rem;">🎨 اللون \\ 📏 المقاس</span>
                    </th>
                    ${sizes.map(s => `
                        <th style="padding: 10px 8px; min-width: 90px; background: #1e293b; color: white; border-bottom: 3px solid #334155; border-left: 2px solid #475569; text-align: center;" title="عمود المقاس: ${s}">
                            <div style="display: inline-flex; align-items: center; justify-content: center; min-width: 56px; padding: 5px 12px; background: #0f172a; color: #38bdf8; border: 2px solid #0284c7; border-radius: 8px; font-size: 1.15rem; font-weight: 900; box-shadow: 0 2px 5px rgba(0,0,0,0.35);">
                                ${s}
                            </div>
                        </th>
                    `).join('')}
                    <th style="padding: 10px 14px; width: 110px; min-width: 110px; background: #0f172a; color: #38bdf8; border-bottom: 3px solid #334155; border-left: 2px solid #475569; text-align: center; font-weight: 900;">
                        <span>📊 إجمالي اللون</span>
                    </th>
                    <th style="padding: 10px 8px; width: 65px; min-width: 65px; background: #0f172a; color: #ef4444; border-bottom: 3px solid #334155; text-align: center; font-weight: 900;">
                        <span>إجراء</span>
                    </th>
                </tr>
            </thead>
            <tbody>
    `;

    colors.forEach(col => {
        let rowSum = 0;
        let cellsHtml = '';

        sizes.forEach((sz, sIdx) => {
            const item = matrixMap[`${col}__${sz}`];
            const stockVal = item ? item.stock : 0;
            const rIdx = item ? item.rowIndex : -1;
            const origVal = item ? item.origStock : 0;
            const isChanged = item && origVal !== undefined && origVal !== stockVal;
            rowSum += stockVal;
            colTotals[sz] += stockVal;
            grandTotalStock += stockVal;

            const colBg = (sIdx % 2 === 0) ? '#ffffff' : '#f8fafc';

            if (item) {
                cellsHtml += `
                    <td style="padding: 8px 4px; border-bottom: 1.5px solid #cbd5e1; border-left: 2px solid #94a3b8; background: ${colBg}; text-align: center; vertical-align: middle;">
                        <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                            <input type="number" value="${stockVal}" min="0" data-row-index="${rIdx}" data-orig-stock="${origVal}" data-size="${sz}" data-color="${col}"
                                ${isLocked ? 'readonly' : ''}
                                onchange="syncMatrixInputToDetailedRow(${rIdx}, this.value)"
                                onfocus="if(window.isVariantsStockLocked) { this.blur(); if(typeof showToast==='function') showToast('🔒 الكميات مقفلة ومحمية. انقر على زر القفل 🔓 في الأعلى للتعديل', 'warning'); } else { this.select(); }"
                                style="width: 70px; height: 36px; font-size: 1.1rem; font-weight: 900; text-align: center; border: 2px solid ${isChanged ? '#f59e0b' : (isLocked ? '#94a3b8' : '#2563eb')}; border-radius: 8px; color: ${stockVal > 0 ? '#047857' : '#64748b'}; background: ${isLocked ? (stockVal > 0 ? '#f0fdf4' : '#ffffff') : '#eff6ff'}; cursor: ${isLocked ? 'not-allowed' : 'text'}; transition: 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.06);"
                                title="المقاس: ${sz} | اللون: ${col}${isChanged ? ` (الأصل: ${origVal})` : ''}">
                        </div>
                    </td>
                `;
            } else {
                cellsHtml += `
                    <td style="padding: 8px 4px; border-bottom: 1.5px solid #cbd5e1; border-left: 2px solid #94a3b8; background: #f1f5f9; text-align: center; vertical-align: middle;">
                        <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                            <button type="button" onclick="createVariantAndRenderMatrix('${sz}', '${col}')"
                                style="border: 1.5px dashed #94a3b8; background: #ffffff; color: #475569; font-weight: 800; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 0.8rem; transition: 0.2s;"
                                onmouseover="this.style.borderColor='#2563eb'; this.style.color='#2563eb';"
                                onmouseout="this.style.borderColor='#94a3b8'; this.style.color='#475569';"
                                title="إضافة مقاس ${sz} للون ${col}">+ إضافة</button>
                        </div>
                    </td>
                `;
            }
        });

        tableHtml += `
            <tr style="border-bottom: 1.5px solid #cbd5e1; transition: background 0.15s;" onmouseover="this.style.background='rgba(59,130,246,0.04)'" onmouseout="this.style.background=''">
                <td style="padding: 10px 14px; font-weight: 900; color: #1e293b; text-align: right; background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; border-left: 2px solid #94a3b8;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 1.05rem;">🎨</span>
                        <span style="font-size: 0.95rem; font-weight: 900; color: #0f172a;">${col}</span>
                    </div>
                </td>
                ${cellsHtml}
                <td style="padding: 8px 12px; font-weight: 900; font-size: 1.05rem; color: #0284c7; background: #f0f9ff; border-bottom: 1.5px solid #cbd5e1; border-left: 2px solid #94a3b8; text-align: center;">
                    <span style="background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 6px; border: 1.5px solid #bae6fd; display: inline-block;">${rowSum}</span>
                </td>
                <td style="padding: 6px; border-bottom: 1.5px solid #cbd5e1; text-align: center; white-space: nowrap;">
                    <button type="button" onclick="restoreColorRowInMatrix('${col}')"
                        style="background: #f0fdf4; color: #166534; border: 1.5px solid #86efac; border-radius: 6px; width: 30px; height: 30px; cursor: pointer; font-weight: 900; margin-left: 3px;" title="استعادة أرصدة هذا اللون للأصل">🔄</button>
                    <button type="button" onclick="removeColorRowFromMatrix('${col}')"
                        style="background: #fee2e2; color: #dc2626; border: 1.5px solid #fca5a5; border-radius: 6px; width: 30px; height: 30px; cursor: pointer; font-weight: 900;" title="حذف كل مقاسات هذا اللون">✕</button>
                </td>
            </tr>
        `;
    });

    // سطر إجمالي المقاسات (الفوتر الذكي مع فواصل الأعمدة)
    tableHtml += `
            </tbody>
            <tfoot style="position: sticky; bottom: 0; background: #f8fafc; font-weight: 900; border-top: 3px solid #64748b; z-index: 4;">
                <tr>
                    <td style="padding: 10px 14px; text-align: right; color: #1e293b; font-weight: 900; background: #f1f5f9; border-left: 2px solid #94a3b8;">
                        <span>📌 إجمالي المقاس:</span>
                    </td>
                    ${sizes.map((s, sIdx) => {
                        const colBg = (sIdx % 2 === 0) ? '#fdf4ff' : '#faf5ff';
                        return `
                            <td style="padding: 10px 6px; font-size: 1.05rem; font-weight: 900; color: #6d28d9; background: ${colBg}; border-left: 2px solid #94a3b8; text-align: center;">
                                <span style="background: #ede9fe; color: #6d28d9; padding: 4px 12px; border-radius: 6px; border: 1.5px solid #ddd6fe; display: inline-block; min-width: 44px;">
                                    ${colTotals[s]}
                                </span>
                            </td>
                        `;
                    }).join('')}
                    <td style="padding: 10px 12px; font-size: 1.15rem; font-weight: 900; color: #047857; background: #ecfdf5; border-left: 2px solid #94a3b8; text-align: center;">
                        <span style="background: #d1fae5; color: #065f46; padding: 4px 14px; border-radius: 8px; border: 1.5px solid #a7f3d0; display: inline-block;">
                            ${grandTotalStock}
                        </span>
                    </td>
                    <td style="background: #f1f5f9;"></td>
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

// طباعة تيكت باركود فردي لصف محدد في جدول التشكيلات
window.printSingleVariantBarcode = async function(btn, event) {
    const tr = btn.closest('tr');
    if (!tr) return;

    const prodName = document.getElementById('newItemName')?.value?.trim() || 'صنف فاشون';
    const size = tr.querySelector('.var-size-input')?.value?.trim() || '';
    const color = tr.querySelector('.var-color-input')?.value?.trim() || '';
    const barcode = tr.querySelector('.var-barcode-input')?.value?.trim() || tr.dataset.origBarcode || '';
    const priceInput = tr.querySelector('.var-price-input');
    const price = (priceInput && priceInput.value !== '') ? parseFloat(priceInput.value) : (parseFloat(document.getElementById('newItemPrice')?.value) || 0);
    const code = document.getElementById('newItemCode')?.value?.trim() || document.getElementById('newItemSysCode')?.value?.trim() || barcode;

    if (!barcode) {
        if (typeof showToast === 'function') {
            showToast('⚠️ لا يوجد باركود محدد لهذا الصف للطباعة!', 'warning');
        }
        return;
    }

    let copies = 1;
    const evt = event || (typeof window !== 'undefined' ? window.event : null);
    if (evt && (evt.shiftKey || evt.ctrlKey)) {
        if (typeof showCustomPrompt === 'function') {
            const inputCopies = await showCustomPrompt("🏷️ كم عدد الملصقات المطلوب طباعتها لهذا المقاس؟", "1");
            if (!inputCopies) return;
            copies = Math.max(1, parseInt(inputCopies) || 1);
        }
    }

    const singleItem = {
        name: prodName,
        size: size,
        color: color,
        code: code,
        barcode: barcode,
        price: price,
        copies: copies
    };

    if (typeof executePrinting === 'function') {
        executePrinting([singleItem], copies);
        if (typeof showToast === 'function') {
            const desc = formatBarcodeVariantLabel(size, color);
            showToast(`🖨️ جاري طباعة ملصق الباركود: ${barcode}${desc ? ' (' + desc + ')' : ''}`, 'success');
        }
    } else {
        if (typeof showToast === 'function') {
            showToast('⚠️ دالة طباعة الباركود غير متاحة حالياً', 'error');
        }
    }
};

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

window.hasSyncedVariantPrices = true;

window.checkIfVariantsNeedPriceSync = function() {
    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    if (rows.length === 0) return false;
    const mainPrice = parseFloat(document.getElementById('newItemPrice')?.value) || 0;

    for (let i = 0; i < rows.length; i++) {
        const pVal = parseFloat(rows[i].querySelector('.var-price-input')?.value);
        if (isNaN(pVal) || Math.abs(pVal - mainPrice) > 0.01) return true;
    }
    return false;
};

window.updateVariantPriceSyncUI = function() {
    const banner = document.getElementById('variantPriceSyncPromptBanner');
    const tabBadge = document.getElementById('variantsTabSyncBadge');
    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    const mainPrice = parseFloat(document.getElementById('newItemPrice')?.value) || 0;
    const currentPriceEl = document.getElementById('syncCardCurrentPriceText');
    if (currentPriceEl) currentPriceEl.innerText = mainPrice.toFixed(2);

    window.hasSyncedVariantPrices = true;

    if (rows.length === 0) {
        if (banner) banner.classList.add('hidden');
        if (tabBadge) tabBadge.classList.add('hidden');
        return;
    }

    const hasCustomPrices = window.checkIfVariantsNeedPriceSync();

    if (banner) {
        banner.classList.remove('hidden');
        if (hasCustomPrices) {
            banner.className = 'bayan-sync-banner state-custom-prices';
            const arrowEl = document.getElementById('variantPriceSyncArrow');
            if (arrowEl) {
                arrowEl.innerText = '🎨';
                arrowEl.style.display = 'inline-block';
            }
            const titleEl = document.getElementById('variantPriceSyncTitle');
            if (titleEl) {
                titleEl.innerHTML = `<span>💡 أسعار مخصصة للمقاسات:</span><span>يمكنك تعميم السعر الأساسي (${mainPrice.toFixed(2)} ج.م) بنقرة واحدة، أو إبقاء كل مقاس بسعره المستقل</span>`;
                titleEl.style.color = '#1e40af';
            }
            const subEl = document.getElementById('variantPriceSyncSub');
            if (subEl) {
                subEl.innerHTML = `توجد مقاسات مسجلة بأسعار خاصة ومستقلة — الحفظ متاح دائماً بدون أي قيود`;
                subEl.style.color = '#3b82f6';
            }
            const btn = document.getElementById('btnBannerSyncVariants');
            if (btn) {
                btn.className = 'bayan-btn';
                btn.style.background = 'linear-gradient(135deg, #4f46e5, #0284c7)';
                btn.style.color = '#ffffff';
                btn.style.border = 'none';
                btn.style.borderRadius = '8px';
                btn.style.padding = '6px 16px';
                btn.style.fontWeight = '800';
                btn.style.boxShadow = '0 2px 8px rgba(79, 70, 229, 0.25)';
                btn.innerHTML = `<span>⚡</span><span>تعميم السعر على الكل (اختياري)</span>`;
            }
        } else {
            banner.className = 'bayan-sync-banner state-synced';
            const arrowEl = document.getElementById('variantPriceSyncArrow');
            if (arrowEl) {
                arrowEl.innerText = '✅';
                arrowEl.style.display = 'inline-block';
            }
            const titleEl = document.getElementById('variantPriceSyncTitle');
            if (titleEl) {
                titleEl.innerHTML = `<span>✅ الأسعار موحدة:</span><span>كافة المقاسات (${rows.length}) متطابقة مع سعر الصنف (${mainPrice.toFixed(2)} ج.م)</span>`;
                titleEl.style.color = '#065f46';
            }
            const subEl = document.getElementById('variantPriceSyncSub');
            if (subEl) {
                subEl.innerHTML = `جميع المقاسات موحدة بالسعر الأساسي، ويمكنك تغيير سعر أي مقاس من الجدول بحرية`;
                subEl.style.color = '#047857';
            }
            const btn = document.getElementById('btnBannerSyncVariants');
            if (btn) {
                btn.className = 'bayan-btn';
                btn.style.background = '#ffffff';
                btn.style.color = '#047857';
                btn.style.border = '1.5px solid #10b981';
                btn.style.borderRadius = '8px';
                btn.style.padding = '5px 14px';
                btn.style.fontWeight = '800';
                btn.style.boxShadow = 'none';
                btn.innerHTML = `<span>🔄</span><span>إعادة تعميم السعر</span>`;
            }
        }
    }

    if (tabBadge) {
        tabBadge.classList.remove('hidden');
        if (hasCustomPrices) {
            tabBadge.innerText = '🎨 أسعار مخصصة';
            tabBadge.style.background = '#4f46e5';
            tabBadge.style.color = 'white';
        } else {
            tabBadge.innerText = '✅ أسعار موحدة';
            tabBadge.style.background = '#10b981';
            tabBadge.style.color = 'white';
        }
    }
};

window.highlightVariantSyncPrompt = function() {
    // لم يعد هناك اهتزاز أو إجبار
};

// تعميم السعر والجملة والتكلفة من كارت الصنف الرئيسي على كافة المقاسات والألوان
window.syncCardPriceAndDiscountToVariants = function(showSuccessToast = true) {
    const mainPrice = parseFloat(document.getElementById('newItemPrice')?.value) || 0;
    const mainWs = parseFloat(document.getElementById('newItemWholesale')?.value) || 0;
    const mainCost = parseFloat(document.getElementById('newItemCost')?.value) || 0;

    const rows = document.getElementById('productVariantsTableBody')?.rows || [];
    if (rows.length === 0) {
        if (showSuccessToast && typeof showToast === 'function') showToast('⚠️ لا توجد تشكيلات حالياً لتعميم الأسعار عليها!', 'warning');
        return;
    }

    for (let i = 0; i < rows.length; i++) {
        const priceInp = rows[i].querySelector('.var-price-input');
        const wsInp = rows[i].querySelector('.var-ws-input');
        const costInp = rows[i].querySelector('.var-cost-input');

        if (priceInp) priceInp.value = mainPrice;
        if (wsInp) wsInp.value = mainWs;
        if (costInp) costInp.value = mainCost;

        rows[i].dataset.origPrice = mainPrice;
        rows[i].dataset.origWs = mainWs;
        rows[i].dataset.origCost = mainCost;
    }

    window.hasSyncedVariantPrices = true;
    if (typeof renderSmartMatrixView === 'function') renderSmartMatrixView();
    window.updateVariantPriceSyncUI();

    if (showSuccessToast && typeof showToast === 'function') {
        showToast(`⚡ تم تعميم سعر البيع (${mainPrice.toFixed(2)} ج.م) والتكلفة على كافة المقاسات (${rows.length}) بنجاح!`, 'success');
    }
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

    if (typeof executePrinting === 'function') {
        executePrinting(targets, 1);
        if (typeof showToast === 'function') {
            showToast(`🖨️ جاري إرسال (${targets.length}) تشكيلة للطباعة بالقالب الموحد...`, "success");
        }
    } else {
        if (typeof showToast === 'function') {
            showToast('⚠️ دالة طباعة الباركود غير متاحة حالياً', 'error');
        }
    }
}
window.printProductVariantHangtags = printProductVariantHangtags;

function updateVariantsCountBadge() {
    const count = document.getElementById('productVariantsTableBody')?.rows?.length || 0;
    const badge = document.getElementById('variantsCountBadge');
    if (badge) badge.innerText = count;
    if (typeof window.updateVariantPriceSyncUI === 'function') {
        window.updateVariantPriceSyncUI();
    }
}

function initVariantPriceSyncListeners() {
    ['newItemPrice', 'newItemWholesale', 'newItemCost', 'newItemDiscount'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el._hasPriceSyncListener) {
            el._hasPriceSyncListener = true;
            el.addEventListener('input', () => {
                const rows = document.getElementById('productVariantsTableBody')?.rows || [];
                if (rows.length > 0) {
                    window.hasSyncedVariantPrices = false;
                    if (typeof window.updateVariantPriceSyncUI === 'function') {
                        window.updateVariantPriceSyncUI();
                    }
                }
            });
        }
    });

    const vBody = document.getElementById('productVariantsTableBody');
    if (vBody && !vBody._hasPriceSyncListener) {
        vBody._hasPriceSyncListener = true;
        vBody.addEventListener('input', (e) => {
            if (e.target.classList.contains('var-price-input') || e.target.classList.contains('var-ws-input') || e.target.classList.contains('var-cost-input')) {
                if (typeof window.updateVariantPriceSyncUI === 'function') {
                    window.updateVariantPriceSyncUI();
                }
            }
        });
    }
}
setTimeout(initVariantPriceSyncListeners, 500);


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
