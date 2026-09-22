/**
 * ============================================================
 *  مركز طباعة الباركود المخصص لقطاع الملابس والأحذية والأصناف العامة
 *  Bayan POS - Barcode & Fashion Label Printing Engine
 *  Version: 3.1.1
 * ============================================================
 */

(function (window) {
    'use strict';

    // قائمة الأصناف المجهزة للطباعة (Print Queue)
    let bpQueue = [];

    // الإعدادات الافتراضية للملصق
    const DEFAULT_BP_SETTINGS = {
        width: 50,
        height: 25,
        barcodeHeight: 20,
        barcodeWidth: 1.3,
        showShopName: true,
        shopName: '',
        showItemName: true,
        showPrice: true,
        showVariant: true,
        showBarcodeText: true,
        fontSize: 8.5
    };

    let bpCurrentSettings = Object.assign({}, DEFAULT_BP_SETTINGS);

    // متغير الصنف النشط حالياً لاختيار المقاسات والألوان في النافذة المنبثقة
    let bpActiveModalProduct = null;

    /**
     * جلب اسم المحل / المتجر الخاص بالتاجر من إعدادات النظام الرئيسية
     */
    function getMerchantStoreName() {
        let storeName = '';

        // 1. من كائن pos_settings المخزن محلياً (المصدر الأساسي والدائم لإعدادات المنشأة والمحل)
        try {
            const rawPos = (typeof getStore === 'function') ? getStore('pos_settings') : localStorage.getItem('pos_settings');
            if (rawPos) {
                const parsed = JSON.parse(rawPos);
                if (parsed && parsed.name && String(parsed.name).trim()) {
                    storeName = String(parsed.name).trim();
                }
            }
        } catch (e) {}

        // 2. من حقل إدخال اسم المحل في شاشة الإعدادات إذا تم إدخاله أو تعديله
        if (!storeName) {
            const shopInput = document.getElementById('shopName');
            if (shopInput && shopInput.value && shopInput.value.trim()) {
                storeName = shopInput.value.trim();
            }
        }

        // 3. من أي مفتاح مباشر آخر باسم shopName
        if (!storeName) {
            try {
                const direct = (typeof getStore === 'function') ? getStore('shopName') : localStorage.getItem('shopName');
                if (direct && String(direct).trim()) {
                    storeName = String(direct).trim();
                }
            } catch (e) {}
        }

        // 4. من اسم التطبيق في الشريط العلوي إذا كان يحتوي على اسم التاجر
        if (!storeName) {
            const titleEl = document.getElementById('appTitle');
            if (titleEl && titleEl.innerText && titleEl.innerText.trim()) {
                const clean = titleEl.innerText.replace(/🚀/g, '').replace(/بَيَان POS لخدمات.*/g, '').replace(/بيان فاشون.*/g, '').trim();
                if (clean) storeName = clean;
            }
        }

        // 5. من اسم المتجر المعروض في رأس الصفحة إن وجد
        if (!storeName) {
            const prev = document.getElementById('prevShopName');
            if (prev && prev.innerText && prev.innerText.trim() && !prev.innerText.includes('بَيَان POS لخدمات') && !prev.innerText.includes('بيان فاشون')) {
                storeName = prev.innerText.trim();
            }
        }

        return storeName;
    }

    /**
     * جلب اسم المخزن النشط الحالي للمستخدم
     */
    function getBpActiveWarehouse() {
        return ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName)
            ? currentUser.warehouseName
            : ((typeof getStore === 'function' ? getStore('activeWarehouse') : localStorage.getItem('activeWarehouse')) || 'المخزن الرئيسي')).trim();
    }

    /**
     * جلب الرصيد الفعلي للصنف في المخزن النشط بدقة تامة
     */
    function getBpProductStock(p, whName = null) {
        if (!p) return 0;
        const targetWH = (whName || getBpActiveWarehouse()).trim();
        if (typeof getWarehouseStock === 'function') {
            const st = getWarehouseStock(p.name, targetWH);
            if (st !== undefined && !isNaN(st)) return Number(st);
        }
        if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
            return p.variants.reduce((sum, v) => sum + getBpVariantStock(v, targetWH), 0);
        }
        if (p.warehouseStocks && typeof p.warehouseStocks === 'object' && p.warehouseStocks[targetWH] !== undefined) {
            return parseFloat(p.warehouseStocks[targetWH]) || 0;
        }
        if (targetWH === 'المخزن الرئيسي' || !p.warehouseStocks || Object.keys(p.warehouseStocks).length === 0) {
            return parseFloat(p.stock) || 0;
        }
        return 0;
    }

    /**
     * جلب الرصيد الفعلي للتشكيلة (المقاس واللون) في المخزن النشط بدقة تامة
     */
    function getBpVariantStock(v, whName = null) {
        if (!v) return 0;
        const targetWH = (whName || getBpActiveWarehouse()).trim();
        if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[targetWH] !== undefined) {
            return parseFloat(v.warehouseStocks[targetWH]) || 0;
        }
        if (targetWH === 'المخزن الرئيسي' || !v.warehouseStocks || Object.keys(v.warehouseStocks).length === 0) {
            return parseFloat(v.stock) || 0;
        }
        return 0;
    }

    /**
     * تحميل إعدادات الملصق المحفوظة مع جلب اسم محل التاجر الحقيقي
     */
    function loadBpSettings() {
        try {
            const saved = (typeof getStore === 'function' ? getStore('bayan_barcode_label_settings') : null) || (typeof localStorage !== 'undefined' ? localStorage.getItem('bayan_barcode_label_settings') : null);
            if (saved) {
                const parsed = typeof saved === 'object' ? saved : JSON.parse(saved);
                bpCurrentSettings = Object.assign({}, DEFAULT_BP_SETTINGS, parsed);
            }
        } catch (e) {
            console.warn("Error loading barcode settings:", e);
            bpCurrentSettings = Object.assign({}, DEFAULT_BP_SETTINGS);
        }

        // اسم المحل يؤخذ دائماً من اسم متجر التاجر الحقيقي المسجل في إعدادات المنشأة
        const realShopName = getMerchantStoreName();
        if (realShopName) {
            bpCurrentSettings.shopName = realShopName;
        } else if (bpCurrentSettings.shopName === 'بيان فاشون') {
            bpCurrentSettings.shopName = '';
        }

        syncBpSettingsToUI();
    }

    /**
     * حفظ إعدادات الملصق في التخزين المحلي
     */
    function saveBpSettings() {
        try {
            readBpSettingsFromUI();
            if (typeof setStore === 'function') {
                setStore('bayan_barcode_label_settings', JSON.stringify(bpCurrentSettings));
            }
            if (typeof localStorage !== 'undefined') {
                try { localStorage.removeItem('bayan_barcode_label_settings'); } catch(e) {}
            }
            renderBpPreview();
            if (typeof showToast === 'function') {
                showToast("✅ تم حفظ إعدادات ملصق الباركود بنجاح", "success");
            }
        } catch (e) {
            console.error("Error saving barcode settings:", e);
        }
    }

    /**
     * مزامنة الإعدادات مع عناصر واجهة المستخدم
     */
    function syncBpSettingsToUI() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };

        setVal('bpSetWidth', bpCurrentSettings.width);
        setVal('bpSetHeight', bpCurrentSettings.height);
        setVal('bpSetBarcodeHeight', bpCurrentSettings.barcodeHeight);
        setVal('bpSetFontSize', bpCurrentSettings.fontSize);
        setVal('bpSetShopNameInput', bpCurrentSettings.shopName || '');

        setCheck('bpSetShowShop', bpCurrentSettings.showShopName);
        setCheck('bpSetShowItem', bpCurrentSettings.showItemName);
        setCheck('bpSetShowPrice', bpCurrentSettings.showPrice);
        setCheck('bpSetShowVariant', bpCurrentSettings.showVariant);
        setCheck('bpSetShowBarcodeDigits', bpCurrentSettings.showBarcodeText);

        // مطابقة قائمة المقاسات الجاهزة (Preset Select)
        const presetEl = document.getElementById('bpPresetSelect');
        if (presetEl) {
            const key = `${bpCurrentSettings.width}x${bpCurrentSettings.height}`;
            presetEl.value = ['50x25', '38x25', '40x25', '50x30', '60x40'].includes(key) ? key : 'custom';
        }
    }

    /**
     * قراءة الإعدادات من عناصر واجهة المستخدم
     */
    function readBpSettingsFromUI() {
        const getVal = (id, def) => {
            const el = document.getElementById(id);
            return el ? parseFloat(el.value) || def : def;
        };
        const getCheck = (id, def) => {
            const el = document.getElementById(id);
            return el ? el.checked : def;
        };
        const getText = (id, def) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : def;
        };

        bpCurrentSettings.width = getVal('bpSetWidth', 50);
        bpCurrentSettings.height = getVal('bpSetHeight', 25);
        bpCurrentSettings.barcodeHeight = getVal('bpSetBarcodeHeight', 20);
        bpCurrentSettings.fontSize = getVal('bpSetFontSize', 8.5);
        // اسم المتجر يؤخذ دائماً من بيانات المحل والمؤسسة الخاصة بالتاجر
        const merchantName = getMerchantStoreName();
        const customShopEl = document.getElementById('bpSetShopNameInput');
        if (customShopEl && customShopEl.value && customShopEl.value.trim()) {
            bpCurrentSettings.shopName = customShopEl.value.trim();
        } else {
            bpCurrentSettings.shopName = merchantName || '';
        }

        bpCurrentSettings.showShopName = getCheck('bpSetShowShop', true);
        bpCurrentSettings.showItemName = getCheck('bpSetShowItem', true);
        bpCurrentSettings.showPrice = getCheck('bpSetShowPrice', true);
        bpCurrentSettings.showVariant = getCheck('bpSetShowVariant', true);
        bpCurrentSettings.showBarcodeText = getCheck('bpSetShowBarcodeDigits', true);

        // تعديل كثافة خطوط الباركود بحسب الحجم
        bpCurrentSettings.barcodeWidth = bpCurrentSettings.width <= 40 ? 1.2 : 1.35;
    }

    /**
     * تغيير المقاس السريع بناءً على القائمة المنسدلة للنماذج الجاهزة
     */
    function onBpPresetChange(val) {
        if (!val || val === 'custom') return;
        const parts = val.split('x');
        if (parts.length === 2) {
            document.getElementById('bpSetWidth').value = parts[0];
            document.getElementById('bpSetHeight').value = parts[1];
            readBpSettingsFromUI();
            renderBpPreview();
        }
    }

    /**
     * محرك البحث المباشر عن الأصناف والمقاسات والألوان
     */
    /**
     * تعبئة القوائم المنسدلة للمقاسات والألوان المتاحة بالمخزن
     */
    function populateBpFilters() {
        const sizeSelect = document.getElementById('bpFilterSizeSelect');
        const colorSelect = document.getElementById('bpFilterColorSelect');
        if (!sizeSelect || !colorSelect) return;

        const prods = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : [];
        const sizesSet = new Set();
        const colorsSet = new Set();

        prods.forEach(p => {
            if (p.size && String(p.size).trim()) sizesSet.add(String(p.size).trim());
            if (p.color && String(p.color).trim()) colorsSet.add(String(p.color).trim());

            if (p.variants && Array.isArray(p.variants)) {
                p.variants.forEach(v => {
                    if (v.size && String(v.size).trim()) sizesSet.add(String(v.size).trim());
                    if (v.color && String(v.color).trim()) colorsSet.add(String(v.color).trim());
                });
            }
        });

        // ترتيب ذكي للمقاسات
        const sortedSizes = Array.from(sizesSet).sort((a, b) => {
            const weightA = typeof getSizeWeight === 'function' ? getSizeWeight(a) : 999;
            const weightB = typeof getSizeWeight === 'function' ? getSizeWeight(b) : 999;
            if (weightA !== weightB) return weightA - weightB;
            return a.localeCompare(b, 'ar');
        });

        // ترتيب الألوان أبجدياً
        const sortedColors = Array.from(colorsSet).sort((a, b) => a.localeCompare(b, 'ar'));

        const currentSelectedSize = sizeSelect.value;
        const currentSelectedColor = colorSelect.value;

        let sizeHtml = '<option value="">📐 كل المقاسات</option>';
        sortedSizes.forEach(s => {
            const isSel = s === currentSelectedSize ? 'selected' : '';
            sizeHtml += `<option value="${s}" ${isSel}>${s}</option>`;
        });
        sizeSelect.innerHTML = sizeHtml;

        let colorHtml = '<option value="">🎨 كل الألوان</option>';
        sortedColors.forEach(c => {
            const isSel = c === currentSelectedColor ? 'selected' : '';
            colorHtml += `<option value="${c}" ${isSel}>${c}</option>`;
        });
        colorSelect.innerHTML = colorHtml;
    }

    /**
     * تنفيذ البحث والتصفية المباشرة الشاملة (الاسم، كود الموديل، الباركود، المقاس، اللون)
     */
    function performBpSearch(query = '', filterSize = '', filterColor = '') {
        const dropdown = document.getElementById('bpSearchResultsDropdown');
        if (!dropdown) return;

        const cleanAr = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
        const q = String(query || '').trim().toLowerCase();
        const qClean = cleanAr(query);
        const fSize = String(filterSize || '').trim().toLowerCase();
        const fColor = String(filterColor || '').trim().toLowerCase();

        // إذا كانت خانة البحث وفلاتر المقاس واللون فارغة كلها، نغلق القائمة المنسدلة
        if (!q && !fSize && !fColor) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }

        const prods = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : [];
        if (prods.length === 0) {
            dropdown.innerHTML = '<div style="padding:16px; text-align:center; color:#94a3b8; font-weight:800;">⚠️ لا توجد أصناف مسجلة بالمخزن</div>';
            dropdown.classList.add('active');
            return;
        }

        const matched = [];

        for (const p of prods) {
            const pName = String(p.name || '').trim().toLowerCase();
            const pNameClean = cleanAr(p.name);
            const pCode = String(p.code || p.sysCode || '').trim().toLowerCase();
            const pModel = String(p.modelCode || p.model_code || p.model || '').trim().toLowerCase();
            const pBarcode = String(p.barcode || '').trim().toLowerCase();
            const pSize = String(p.size || '').trim().toLowerCase();
            const pColor = String(p.color || '').trim().toLowerCase();
            const qNoSpaces = q ? q.replace(/\s+/g, '') : '';

            // فحص تطابق المقاس واللون في الصنف المباشر وتشكيلاته
            let sizeMatches = !fSize;
            let colorMatches = !fColor;
            let matchedVariantItems = [];

            // تتبع تطابق التشكيلات لحساب الأولوية
            let variantHasExactMatch = false;
            let variantHasPrefixMatch = false;
            let variantHasContainsMatch = false;

            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const vSize = String(v.size || '').trim().toLowerCase();
                    const vColor = String(v.color || '').trim().toLowerCase();
                    const vBarcode = String(v.barcode || '').trim().toLowerCase();
                    const vCode = String(v.code || '').trim().toLowerCase();

                    let vSizeMatches = !fSize || vSize === fSize || vSize.includes(fSize);
                    let vColorMatches = !fColor || vColor === fColor || vColor.includes(fColor);

                    let vMatchesText = false;
                    if (!q) {
                        vMatchesText = true;
                    } else {
                        if (vBarcode === q || (qNoSpaces && vBarcode === qNoSpaces) || vCode === q) {
                            variantHasExactMatch = true;
                            vMatchesText = true;
                        } else if (vBarcode.startsWith(q) || (qNoSpaces && vBarcode.startsWith(qNoSpaces)) || vCode.startsWith(q)) {
                            variantHasPrefixMatch = true;
                            vMatchesText = true;
                        } else if (vBarcode.includes(q) || (qNoSpaces && vBarcode.includes(qNoSpaces)) || vCode.includes(q) || vSize.includes(q) || vColor.includes(q)) {
                            variantHasContainsMatch = true;
                            vMatchesText = true;
                        }
                    }

                    if (vSizeMatches && vColorMatches && (vMatchesText || !q)) {
                        matchedVariantItems.push(v);
                    }
                });

                if (matchedVariantItems.length > 0) {
                    sizeMatches = true;
                    colorMatches = true;
                } else {
                    if (fSize && pSize && (pSize === fSize || pSize.includes(fSize))) sizeMatches = true;
                    if (fColor && pColor && (pColor === fColor || pColor.includes(fColor))) colorMatches = true;
                }
            } else {
                if (fSize) sizeMatches = pSize && (pSize === fSize || pSize.includes(fSize));
                if (fColor) colorMatches = pColor && (pColor === fColor || pColor.includes(fColor));
            }

            // فحص تطابق النص وحساب درجة الأولوية والفرز الذكي (Relevance Score)
            let textMatches = false;
            let score = 0;

            if (!q) {
                textMatches = true;
                score = 1;
            } else {
                // 1. أعلى أولوية مطلقة: تطابق تام مع اسم الصنف (مثل صنف 118) أو الباركود الأساسي أو الكود
                if (pNameClean === qClean || pName === q || (qNoSpaces && pNameClean.replace(/\s+/g, '') === qNoSpaces)) {
                    score = Math.max(score, 1200);
                    textMatches = true;
                }
                if (pBarcode === q || (qNoSpaces && pBarcode === qNoSpaces)) {
                    score = Math.max(score, 1050);
                    textMatches = true;
                }
                if (pCode === q || (qNoSpaces && pCode === qNoSpaces)) {
                    score = Math.max(score, 1000);
                    textMatches = true;
                }
                if (pModel === q || (qNoSpaces && pModel === qNoSpaces)) {
                    score = Math.max(score, 995);
                    textMatches = true;
                }
                if (variantHasExactMatch) {
                    score = Math.max(score, 980);
                    textMatches = true;
                }

                // 2. أولوية عالية: بداية اسم الصنف أو بداية الكود أو الموديل أو الباركود (Prefix / Starts With)
                if (pNameClean.startsWith(qClean) || pName.startsWith(q)) {
                    score = Math.max(score, 850);
                    textMatches = true;
                }
                if (pCode.startsWith(q) || (qNoSpaces && pCode.startsWith(qNoSpaces))) {
                    score = Math.max(score, 800 - Math.min(pCode.length, 30));
                    textMatches = true;
                }
                if (pModel.startsWith(q) || (qNoSpaces && pModel.startsWith(qNoSpaces))) {
                    score = Math.max(score, 790 - Math.min(pModel.length, 30));
                    textMatches = true;
                }
                if (pBarcode.startsWith(q) || (qNoSpaces && pBarcode.startsWith(qNoSpaces))) {
                    score = Math.max(score, 750 - Math.min(pBarcode.length, 30));
                    textMatches = true;
                }
                if (variantHasPrefixMatch) {
                    score = Math.max(score, 720);
                    textMatches = true;
                }

                // 3. أولوية متوسطة: تطابق جزئي داخل الكود أو الموديل أو الباركود أو الاسم (Contains)
                if (pCode.includes(q) || (qNoSpaces && pCode.includes(qNoSpaces))) {
                    score = Math.max(score, 500);
                    textMatches = true;
                }
                if (pModel.includes(q) || (qNoSpaces && pModel.includes(qNoSpaces))) {
                    score = Math.max(score, 490);
                    textMatches = true;
                }
                if (pBarcode.includes(q) || (qNoSpaces && pBarcode.includes(qNoSpaces))) {
                    score = Math.max(score, 450);
                    textMatches = true;
                }
                if (variantHasContainsMatch) {
                    score = Math.max(score, 400);
                    textMatches = true;
                }
                if (pNameClean.includes(qClean) || pName.includes(q)) {
                    score = Math.max(score, 350);
                    textMatches = true;
                }

                if (pSize.includes(q) || pColor.includes(q)) {
                    score = Math.max(score, 200);
                    textMatches = true;
                }

                // فحص الكلمات المتعددة إذا كان البحث يحتوي على أكثر من كلمة
                if (!textMatches && q.includes(' ')) {
                    const words = q.split(/\s+/).filter(w => w.length > 0);
                    const allWordsMatch = words.every(w => pName.includes(w) || pCode.includes(w) || pModel.includes(w));
                    if (allWordsMatch) {
                        score = Math.max(score, 250);
                        textMatches = true;
                    }
                }
            }

            // إذا كان الصنف يطابق فلاتر المقاس/اللون المطلوبة
            if (matchedVariantItems.length > 0) {
                textMatches = true;
                if (score === 0) score = 100;
            }

            if (textMatches && sizeMatches && colorMatches) {
                matched.push({ product: p, matchedVariantsCount: matchedVariantItems.length, score });
            }
        }

        if (matched.length === 0) {
            dropdown.innerHTML = `
                <div style="padding: 18px; text-align: center; color: #475569; font-weight: 800;">
                    🔍 لا توجد نتائج تطابق البحث والمقاسات والألوان المحددة
                </div>`;
            dropdown.classList.add('active');
            return;
        }

        // فرز النتائج تنازلياً حسب درجة التطابق (الأعلى أولوية والتطابق التام يظهر أولاً)
        matched.sort((a, b) => b.score - a.score);

        // أخذ أفضل 30 نتيجة بعد الترتيب الدقيق
        const topMatched = matched.slice(0, 30);

        let html = '';
        topMatched.forEach(({ product: p, matchedVariantsCount }) => {
            const hasVariants = p.variants && Array.isArray(p.variants) && p.variants.length > 0;
            const priceFormatted = (parseFloat(p.price) || 0).toFixed(2);
            const totalStock = getBpProductStock(p);
            const currency = (typeof getCurrencySymbol === 'function') ? getCurrencySymbol() : 'ج.م';
            const modelCodeDisplay = p.modelCode || p.code || '';

            html += `
                <div class="bp-search-result-item" onclick="window.onBpSelectProduct('${p.id}')">
                    <div class="bp-res-info-main">
                        <div class="bp-res-title">
                            ${p.name}
                            ${hasVariants ? `<span class="bp-tag-fashion">👗 ${p.variants.length} مقاس/لون</span>` : ''}
                        </div>
                        <div class="bp-res-meta">
                            ${p.barcode ? `<span class="bp-tag-barcode">باركد: ${p.barcode}</span>` : ''}
                            ${modelCodeDisplay ? `<span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-weight:800;">كود: ${modelCodeDisplay}</span>` : ''}
                            ${p.size ? `<span style="background:#e0e7ff; color:#3730a3; padding:2px 7px; border-radius:6px; font-weight:900;">📐 ${p.size}</span>` : ''}
                            ${p.color ? `<span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:6px; font-weight:900;">🎨 ${p.color}</span>` : ''}
                            <span class="bp-tag-price">💰 ${priceFormatted} ${currency}</span>
                            <span class="bp-tag-stock">📦 المتاح: ${totalStock}</span>
                        </div>
                    </div>
                    <div>
                        <button type="button" class="bp-btn bp-btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">
                            ➕ إضافة
                        </button>
                    </div>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.classList.add('active');
    }

    /**
     * حدث الكتابة في خانة البحث
     */
    function onBpSearchInput(e) {
        const query = e && e.target ? e.target.value : (document.getElementById('bpSearchInput')?.value || '');
        const sizeVal = document.getElementById('bpFilterSizeSelect')?.value || '';
        const colorVal = document.getElementById('bpFilterColorSelect')?.value || '';
        performBpSearch(query, sizeVal, colorVal);
    }

    /**
     * حدث تغيير القوائم المنسدلة للمقاس أو اللون
     */
    function onBpQuickFilterChange() {
        const query = document.getElementById('bpSearchInput')?.value || '';
        const sizeVal = document.getElementById('bpFilterSizeSelect')?.value || '';
        const colorVal = document.getElementById('bpFilterColorSelect')?.value || '';
        performBpSearch(query, sizeVal, colorVal);
    }

    /**
     * مسح وإعادة ضبط فلاتر البحث والمقاس واللون
     */
    function resetBpQuickFilters() {
        const sizeSelect = document.getElementById('bpFilterSizeSelect');
        const colorSelect = document.getElementById('bpFilterColorSelect');
        const searchInput = document.getElementById('bpSearchInput');
        const dropdown = document.getElementById('bpSearchResultsDropdown');

        if (sizeSelect) sizeSelect.value = '';
        if (colorSelect) colorSelect.value = '';
        if (searchInput) searchInput.value = '';
        if (dropdown) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
        }
        if (searchInput) searchInput.focus();
    }

    /**
     * دعم جهاز الاسكانر وزر Enter للإضافة الفورية
     */
    function onBpSearchKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = (e.target.value || '').trim();
            if (!query) return;

            const prods = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : [];
            // 1. فحص باركود التشكيلة المباشر (Variant Barcode)
            for (const p of prods) {
                if (p.variants && Array.isArray(p.variants)) {
                    for (let idx = 0; idx < p.variants.length; idx++) {
                        const v = p.variants[idx];
                        if (String(v.barcode || '').trim().toLowerCase() === query.toLowerCase()) {
                            const vPrice = (v.price !== undefined && v.price !== null && v.price !== '') ? parseFloat(v.price) : (parseFloat(p.price) || 0);
                            const vStock = getBpVariantStock(v);
                            addSingleItemToQueue({
                                productId: p.id,
                                name: p.name,
                                variantId: idx,
                                size: v.size || '',
                                color: v.color || '',
                                barcode: String(v.barcode).trim(),
                                price: vPrice,
                                stock: vStock,
                                copies: 1,
                                isMaster: false
                            });
                            e.target.value = '';
                            const dropdown = document.getElementById('bpSearchResultsDropdown');
                            if (dropdown) dropdown.classList.remove('active');
                            if (window.BayanBarcode && typeof BayanBarcode.playBeep === 'function') BayanBarcode.playBeep(true);
                            return;
                        }
                    }
                }
            }

            // 2. فحص باركود أو كود أو كود الموديل أو اسم الصنف العام
            const qClean = query.toLowerCase();
            const qCleanNoSpaces = qClean.replace(/\s+/g, '');
            const exactProduct = prods.find(p => {
                const pBarcode = String(p.barcode || '').trim().toLowerCase();
                const pCode = String(p.code || p.sysCode || '').trim().toLowerCase();
                const pModel = String(p.modelCode || p.model_code || p.model || '').trim().toLowerCase();
                const pName = String(p.name || '').trim().toLowerCase();

                return pBarcode === qClean || (qCleanNoSpaces && pBarcode === qCleanNoSpaces) ||
                       pCode === qClean || (qCleanNoSpaces && pCode === qCleanNoSpaces) ||
                       pModel === qClean || (qCleanNoSpaces && pModel === qCleanNoSpaces) ||
                       pName === qClean;
            });

            if (exactProduct) {
                onBpSelectProduct(exactProduct.id);
                e.target.value = '';
                const dropdown = document.getElementById('bpSearchResultsDropdown');
                if (dropdown) dropdown.classList.remove('active');
                if (window.BayanBarcode && typeof BayanBarcode.playBeep === 'function') BayanBarcode.playBeep(true);
                return;
            }

            // 3. إذا لم يوجد تطابق تام مباشر ولكن القائمة المنسدلة بها نتائج مرتبة، يتم اختيار أول نتيجة (الأعلى أولوية)
            const dropdown = document.getElementById('bpSearchResultsDropdown');
            if (dropdown && dropdown.classList.contains('active')) {
                const firstResult = dropdown.querySelector('.bp-search-result-item');
                if (firstResult) {
                    firstResult.click();
                    e.target.value = '';
                    dropdown.classList.remove('active');
                    if (window.BayanBarcode && typeof BayanBarcode.playBeep === 'function') BayanBarcode.playBeep(true);
                }
            }
        }
    }

    /**
     * اختيار صنف من نتائج البحث
     */
    function onBpSelectProduct(productId) {
        const dropdown = document.getElementById('bpSearchResultsDropdown');
        if (dropdown) dropdown.classList.remove('active');

        const searchInput = document.getElementById('bpSearchInput');
        if (searchInput) searchInput.value = '';

        const prods = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : [];
        const product = prods.find(p => String(p.id) === String(productId));
        if (!product) return;

        // إذا كان الصنف له مقاسات وألوان متعددة، نفتح نافذة الخيارات الذكية
        if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
            openBpVariantModal(product);
        } else {
            // صنف عادي بدون مقاسات: إضافته فوراً للقائمة
            addSingleItemToQueue({
                productId: product.id,
                name: product.name,
                variantId: null,
                size: product.size || '',
                color: product.color || '',
                barcode: String(product.barcode || product.code || generateFallbackBarcode()).trim(),
                price: parseFloat(product.price) || 0,
                stock: getBpProductStock(product),
                copies: 1,
                isMaster: true
            });
        }
    }

    /**
     * توليد باركود تلقائي فريد إذا لم يكن الصنف مسجلاً له باركود
     */
    function generateFallbackBarcode() {
        return '20' + String(Date.now()).slice(-8);
    }

    /**
     * فتح نافذة اختيار مقاسات وألوان الصنف
     */
    function openBpVariantModal(product) {
        bpActiveModalProduct = product;
        const modal = document.getElementById('bpVariantModal');
        if (!modal) return;

        const activeWH = getBpActiveWarehouse();
        document.getElementById('bpModalProdTitle').innerText = product.name;
        document.getElementById('bpModalProdMeta').innerText = `الموديل العام: ${product.code || 'بدون كود'} | الباركود العام: ${product.barcode || 'غير محدد'} | المخزن: [${activeWH}] | إجمالي المقاسات: ${product.variants.length}`;

        const tbody = document.getElementById('bpModalVariantsTableBody');
        if (!tbody) return;

        let html = '';
        product.variants.forEach((v, idx) => {
            const vPrice = (v.price !== undefined && v.price !== null && v.price !== '') ? parseFloat(v.price) : (parseFloat(product.price) || 0);
            const vStock = getBpVariantStock(v, activeWH);
            const vBarcode = v.barcode || `${product.barcode || '1000'}-${idx + 1}`;

            html += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 8px; text-align: center;">
                        <input type="checkbox" class="bp-variant-modal-checkbox" data-idx="${idx}" checked style="width: 19px; height: 19px; accent-color: #10b981; cursor: pointer;">
                    </td>
                    <td style="padding: 10px 8px; font-weight: 900; color: #0f172a;">
                        <span style="background: #f1f5f9; color: #0f172a; padding: 4px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 900; font-size: 0.92rem;">
                            ${v.size || 'حر'} - ${v.color || 'عام'}
                        </span>
                    </td>
                    <td style="padding: 10px 8px; font-family: monospace; color: #0284c7; font-weight: 900; font-size: 0.92rem;">
                        <span style="background: #f0f9ff; padding: 3px 8px; border-radius: 6px; border: 1px solid #bae6fd;">${vBarcode}</span>
                    </td>
                    <td style="padding: 10px 8px; font-weight: 900; color: #059669; font-size: 0.95rem;">
                        ${vPrice.toFixed(2)}
                    </td>
                    <td style="padding: 10px 8px; font-weight: 900; color: ${vStock > 0 ? '#b45309' : '#dc2626'}; font-size: 0.95rem;" title="الرصيد المتاح بمخزن [${activeWH}]">
                        ${vStock}
                    </td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <input type="number" min="1" class="bp-input-sm bp-variant-modal-copies" data-idx="${idx}" value="1" style="width: 70px; text-align: center; border: 1.5px solid #cbd5e1; background: #ffffff; color: #0f172a; font-weight: 900; font-size: 0.95rem; border-radius: 8px; height: 32px;">
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        modal.classList.remove('hidden');
    }

    /**
     * إغلاق نافذة المقاسات المنبثقة
     */
    function closeBpVariantModal() {
        const modal = document.getElementById('bpVariantModal');
        if (modal) modal.classList.add('hidden');
        bpActiveModalProduct = null;
    }

    /**
     * تأكيد اختيار المقاسات المحددة من النافذة المنبثقة
     */
    function confirmBpModalSelectedVariants() {
        if (!bpActiveModalProduct) return;
        const checkboxes = document.querySelectorAll('.bp-variant-modal-checkbox:checked');
        if (checkboxes.length === 0) {
            if (typeof showToast === 'function') showToast("⚠️ يرجى تحديد مقاس واحد على الأقل!", "warning");
            return;
        }

        const itemsToAdd = [];
        checkboxes.forEach(cb => {
            const idx = parseInt(cb.getAttribute('data-idx'), 10);
            const v = bpActiveModalProduct.variants[idx];
            if (!v) return;

            const copiesInput = document.querySelector(`.bp-variant-modal-copies[data-idx="${idx}"]`);
            const copies = copiesInput ? parseInt(copiesInput.value, 10) || 1 : 1;
            const vPrice = (v.price !== undefined && v.price !== null && v.price !== '') ? parseFloat(v.price) : (parseFloat(bpActiveModalProduct.price) || 0);
            const vStock = getBpVariantStock(v);
            const vBarcode = String(v.barcode || `${bpActiveModalProduct.barcode || '1000'}-${idx + 1}`).trim();

            itemsToAdd.push({
                productId: bpActiveModalProduct.id,
                name: bpActiveModalProduct.name,
                variantId: idx,
                size: v.size || '',
                color: v.color || '',
                barcode: vBarcode,
                price: vPrice,
                stock: vStock,
                copies: copies,
                isMaster: false
            });
        });

        addBulkItemsToQueue(itemsToAdd);
        closeBpVariantModal();
    }

    /**
     * إضافة كافة مقاسات الصنف دفعة واحدة بضغطة زر
     */
    function addAllVariantsOfCurrentModal() {
        if (!bpActiveModalProduct || !bpActiveModalProduct.variants) return;
        const itemsToAdd = [];
        bpActiveModalProduct.variants.forEach((v, idx) => {
            const vPrice = (v.price !== undefined && v.price !== null && v.price !== '') ? parseFloat(v.price) : (parseFloat(bpActiveModalProduct.price) || 0);
            const vStock = getBpVariantStock(v);
            const vBarcode = String(v.barcode || `${bpActiveModalProduct.barcode || '1000'}-${idx + 1}`).trim();

            itemsToAdd.push({
                productId: bpActiveModalProduct.id,
                name: bpActiveModalProduct.name,
                variantId: idx,
                size: v.size || '',
                color: v.color || '',
                barcode: vBarcode,
                price: vPrice,
                stock: vStock,
                copies: 1,
                isMaster: false
            });
        });

        addBulkItemsToQueue(itemsToAdd);
        closeBpVariantModal();
    }

    /**
     * إضافة الباركود العام للموديل فقط
     */
    function addMasterBarcodeOfCurrentModal() {
        if (!bpActiveModalProduct) return;
        addSingleItemToQueue({
            productId: bpActiveModalProduct.id,
            name: bpActiveModalProduct.name,
            variantId: null,
            size: '',
            color: '',
            barcode: String(bpActiveModalProduct.barcode || bpActiveModalProduct.code || generateFallbackBarcode()).trim(),
            price: parseFloat(bpActiveModalProduct.price) || 0,
            stock: getBpProductStock(bpActiveModalProduct),
            copies: 1,
            isMaster: true
        });
        closeBpVariantModal();
    }

    /**
     * إضافة عنصر منفرد لقائمة الطباعة
     */
    function addSingleItemToQueue(item) {
        addBulkItemsToQueue([item]);
    }

    /**
     * إضافة مجموعة عناصر لقائمة الطباعة مع منع التكرار وزيادة النسخ
     */
    function addBulkItemsToQueue(items) {
        items.forEach(newItem => {
            // البحث عن عنصر مطابق تماماً بالباركود
            const existing = bpQueue.find(x => x.barcode === newItem.barcode);
            if (existing) {
                existing.copies += newItem.copies;
            } else {
                newItem.queueId = 'bpq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                bpQueue.push(newItem);
            }
        });

        updateBpQueueUI();
        if (typeof showToast === 'function') {
            showToast(`✅ تمت إضافة ${items.length} صنف/مقاس لقائمة طباعة الباركود`, "success");
        }
    }

    /**
     * حذف عنصر من قائمة الطباعة
     */
    function removeBpQueueItem(queueId) {
        bpQueue = bpQueue.filter(x => x.queueId !== queueId);
        updateBpQueueUI();
    }

    /**
     * تعديل عدد النسخ لعنصر في القائمة (+1 أو -1 أو قيمة صريحة)
     */
    function updateBpItemCopies(queueId, deltaOrValue, isExplicit = false) {
        const item = bpQueue.find(x => x.queueId === queueId);
        if (!item) return;

        if (isExplicit) {
            item.copies = Math.max(1, parseInt(deltaOrValue, 10) || 1);
        } else {
            item.copies = Math.max(1, item.copies + deltaOrValue);
        }

        updateBpQueueUI(false); // تحديث بدون إعادة بناء كاملة
    }

    /**
     * تطبيق عدد نسخ موحد على كافة الأصناف بالقائمة
     */
    async function setUniformCopiesForAll() {
        if (bpQueue.length === 0) {
            if (typeof showToast === 'function') showToast("⚠️ قائمة الطباعة فارغة!", "warning");
            return;
        }
        let valStr = null;
        if (typeof window.showCustomPrompt === 'function') {
            valStr = await window.showCustomPrompt("🏷️ أدخل عدد الملصقات الموحد لكافة الأصناف المجهزة للطباعة:", "1", "number");
        } else {
            valStr = prompt("🏷️ أدخل عدد الملصقات الموحد لكافة الأصناف المجهزة للطباعة:", "1");
        }
        if (!valStr) return;
        const count = parseInt(valStr, 10);
        if (isNaN(count) || count <= 0) return;

        bpQueue.forEach(item => { item.copies = count; });
        updateBpQueueUI();
        if (typeof showToast === 'function') showToast(`✅ تم توحيد عدد النسخ إلى (${count}) لكل الأصناف`, "success");
    }

    /**
     * ضبط عدد النسخ مساوياً لرصيد المخزن المتاح لكل صنف/مقاس
     */
    function setCopiesFromCurrentStock() {
        if (bpQueue.length === 0) return;
        let appliedCount = 0;
        bpQueue.forEach(item => {
            const st = parseInt(item.stock, 10);
            item.copies = (st > 0) ? st : 1;
            appliedCount++;
        });

        updateBpQueueUI();
        if (typeof showToast === 'function') {
            showToast(`📦 تم ضبط عدد الملصقات طبقاً لرصيد المخزن المتاح (${appliedCount} صنف)`, "success");
        }
    }

    /**
     * تفريغ قائمة الطباعة بالكامل
     */
    function clearBpQueue() {
        if (bpQueue.length === 0) {
            if (typeof showToast === 'function') showToast("قائمة الطباعة فارغة بالفعل", "info");
            return;
        }

        if (typeof window.showCustomAlert === 'function') {
            window.showCustomAlert({
                type: 'error',
                titleText: '⚠️ تفريغ قائمة الطباعة',
                msg: 'هل أنت متأكد من تفريغ كافة الأصناف من قائمة الطباعة؟<br><span style="color:#64748b; font-size:0.86rem; font-weight:700; margin-top:4px; display:inline-block;">سيتم مسح الأصناف المجهزة للطباعة فقط دون أي تأثير على بيانات وأرصدة المخزن.</span>',
                confirmText: '🗑️ نعم، تفريغ القائمة',
                cancelText: 'تراجع وإلغاء',
                showCancel: true,
                onConfirm: () => {
                    bpQueue = [];
                    updateBpQueueUI();
                    if (typeof showToast === 'function') showToast("🗑️ تم تفريغ قائمة الطباعة بنجاح", "info");
                }
            });
        } else {
            if (confirm("هل أنت متأكد من تفريغ كافة الأصناف من قائمة الطباعة؟")) {
                bpQueue = [];
                updateBpQueueUI();
                if (typeof showToast === 'function') showToast("🗑️ تم تفريغ قائمة الطباعة بنجاح", "info");
            }
        }
    }

    /**
     * تفريغ قائمة الطباعة صامتاً (تُستدعى عند إغلاق التبويب)
     */
    function clearBpQueueSilently() {
        bpQueue = [];
        updateBpQueueUI();
    }

    /**
     * التحقق مما إذا كانت قائمة طباعة الباركود تحتوي على أصناف
     */
    function hasBpQueueItems() {
        return bpQueue && bpQueue.length > 0;
    }

    /**
     * إرجاع عدد الأصناف المسجلة حالياً بقائمة طباعة الباركود
     */
    function getBpQueueCount() {
        return bpQueue ? bpQueue.length : 0;
    }

    /**
     * تحديث واجهة قائمة الطباعة وجدول الأصناف
     */
    function updateBpQueueUI(fullRebuild = true) {
        const tbody = document.getElementById('bpQueueTableBody');
        const emptyState = document.getElementById('bpEmptyQueueState');
        const totalChip = document.getElementById('bpTotalLabelsCount');
        const itemsCountLabel = document.getElementById('bpTotalItemsCount');

        let totalStickers = 0;
        bpQueue.forEach(x => { totalStickers += x.copies; });

        if (totalChip) totalChip.innerText = `${totalStickers} ملصق`;
        if (itemsCountLabel) itemsCountLabel.innerText = `${bpQueue.length} صنف مسجل`;

        if (!tbody) return;

        if (bpQueue.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            renderBpPreview();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        if (fullRebuild) {
            let html = '';
            const currency = (typeof getCurrencySymbol === 'function') ? getCurrencySymbol() : 'ج.م';

            bpQueue.forEach((item, index) => {
                const cleanVariant = (typeof window.formatBarcodeVariantLabel === 'function')
                    ? window.formatBarcodeVariantLabel(item.size, item.color)
                    : [item.color, item.size].filter(Boolean).join(' ');

                const variantLabel = cleanVariant 
                    ? `<span class="bp-variant-pill"><span class="bp-variant-color-dot" style="background:${getVariantHexColor(item.color)};"></span>${cleanVariant}</span>`
                    : `<span style="color:#64748b; font-size:0.8rem; font-weight:800; background:#f1f5f9; padding:3px 8px; border-radius:6px;">عام (رئيسي)</span>`;

                html += `
                    <tr data-qid="${item.queueId}">
                        <td style="padding: 10px 8px;">
                            <button type="button" class="bp-btn bp-btn-danger" onclick="window.removeBpQueueItem('${item.queueId}')" style="padding: 5px 10px; font-size: 0.8rem;" title="حذف من القائمة">
                                🗑️
                            </button>
                        </td>
                        <td style="font-weight: 900; color: #0f172a; text-align: right; padding-right: 14px; font-size: 0.96rem;">
                            ${item.name}
                        </td>
                        <td>${variantLabel}</td>
                        <td style="font-family: monospace; color: #0284c7; font-weight: 900; font-size: 0.95rem;">
                            <span style="background:#f0f9ff; padding: 3px 8px; border-radius: 6px; border: 1px solid #bae6fd;">${item.barcode}</span>
                        </td>
                        <td style="font-weight: 900; color: #059669; font-size: 1rem;">${(item.price || 0).toFixed(2)} ${currency}</td>
                        <td style="font-weight: 900; color: #b45309; font-size: 0.95rem;">${item.stock}</td>
                        <td>
                            <div class="bp-qty-stepper">
                                <button type="button" class="bp-stepper-btn" onclick="window.updateBpItemCopies('${item.queueId}', -1)">-</button>
                                <input type="number" min="1" class="bp-stepper-input" value="${item.copies}" onchange="window.updateBpItemCopies('${item.queueId}', this.value, true)">
                                <button type="button" class="bp-stepper-btn" onclick="window.updateBpItemCopies('${item.queueId}', 1)">+</button>
                            </div>
                        </td>
                        <td>
                            <svg class="bp-mini-barcode-svg" id="bp-mini-bc-${index}"></svg>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;

            // رسم الباركودات المصغرة داخل الجدول
            bpQueue.forEach((item, index) => {
                const el = document.getElementById(`bp-mini-bc-${index}`);
                if (el && window.JsBarcode) {
                    try {
                        window.JsBarcode(el, item.barcode, {
                            format: "CODE128",
                            width: 1.1,
                            height: 18,
                            displayValue: false,
                            margin: 1
                        });
                    } catch (err) {
                        console.warn("Mini barcode render error:", err);
                    }
                }
            });
        } else {
            // تحديث قيم الـ input فقط دون إعادة بناء الـ DOM
            bpQueue.forEach(item => {
                const row = tbody.querySelector(`tr[data-qid="${item.queueId}"]`);
                if (row) {
                    const inp = row.querySelector('.bp-stepper-input');
                    if (inp) inp.value = item.copies;
                }
            });
        }

        renderBpPreview();
    }

    /**
     * لون تقريبي لكبسولة الألوان في الملابس
     */
    function getVariantHexColor(colorName) {
        if (!colorName) return '#94a3b8';
        const map = {
            'أسود': '#000000', 'black': '#000000',
            'أبيض': '#ffffff', 'white': '#ffffff',
            'أحمر': '#ef4444', 'red': '#ef4444',
            'أزرق': '#3b82f6', 'blue': '#3b82f6',
            'كحلي': '#1e3a8a', 'navy': '#1e3a8a',
            'أخضر': '#10b981', 'green': '#10b981',
            'أصفر': '#eab308', 'yellow': '#eab308',
            'رمادي': '#64748b', 'gray': '#64748b',
            'بيج': '#d4b895', 'beige': '#d4b895',
            'بني': '#78350f', 'brown': '#78350f',
            'وردي': '#ec4899', 'pink': '#ec4899',
            'بنفسجي': '#8b5cf6', 'purple': '#8b5cf6'
        };
        return map[colorName.toLowerCase().trim()] || '#d4af37';
    }

    /**
     * إظهار أو إخفاء عمود المعاينة الحية لتوفير أقصى مساحة ممكنة للجدول
     */
    function toggleBpPreviewColumn(forceState) {
        const grid = document.getElementById('bpMainLayoutGrid');
        const sidebar = document.getElementById('bpSidebarCol');
        const toggleBtn = document.getElementById('bpTogglePreviewBtn');
        const iconEl = document.getElementById('bpPreviewToggleIcon');
        const textEl = document.getElementById('bpPreviewToggleText');

        if (!grid || !sidebar) return;

        let shouldBeVisible;
        if (typeof forceState === 'boolean') {
            shouldBeVisible = forceState;
        } else {
            // التبديل بين الظهور والإخفاء
            shouldBeVisible = sidebar.classList.contains('hidden');
        }

        if (shouldBeVisible) {
            sidebar.classList.remove('hidden');
            grid.classList.remove('preview-hidden');
            if (toggleBtn) toggleBtn.classList.add('active');
            if (iconEl) iconEl.textContent = '👁️‍🗨️';
            if (textEl) textEl.textContent = 'المعاينة الحية: إخفاء';
            if (typeof setStore === 'function') setStore('bayan_bp_preview_visible', 'true');
            if (typeof localStorage !== 'undefined') {
                try { localStorage.removeItem('bayan_bp_preview_visible'); } catch(e) {}
            }
            // رسم المعاينة فور إظهارها
            renderBpPreview(true);
        } else {
            sidebar.classList.add('hidden');
            grid.classList.add('preview-hidden');
            if (toggleBtn) toggleBtn.classList.remove('active');
            if (iconEl) iconEl.textContent = '👁️';
            if (textEl) textEl.textContent = 'المعاينة الحية: إظهار';
            if (typeof setStore === 'function') setStore('bayan_bp_preview_visible', 'false');
            if (typeof localStorage !== 'undefined') {
                try { localStorage.removeItem('bayan_bp_preview_visible'); } catch(e) {}
            }
        }
    }

    /**
     * توليد المعاينة الحية لملصقات الباركود في الحاوية الجانبية
     */
    function renderBpPreview(forceRender = false) {
        const previewContainer = document.getElementById('bpLivePreviewWrapper');
        if (!previewContainer) return;

        // إذا كانت المعاينة الحية مخفية ولم يُطلب فرض الرسم، نتجاوز المعالجة لتوفير موارد المتصفح
        const sidebar = document.getElementById('bpSidebarCol');
        if (!forceRender && sidebar && sidebar.classList.contains('hidden')) {
            return;
        }

        if (bpQueue.length === 0) {
            previewContainer.innerHTML = `
                <div style="padding: 40px 10px; text-align: center; color: #64748b;">
                    <div style="font-size: 2.2rem; margin-bottom: 6px;">🏷️</div>
                    <div style="font-weight: 800; font-size: 0.88rem;">المعاينة الحية فارغة</div>
                    <div style="font-size: 0.75rem; margin-top: 2px;">أضف أصنافاً للقائمة لمعاينة شكل الملصق الحراري</div>
                </div>`;
            return;
        }

        readBpSettingsFromUI();
        const currentShopName = getMerchantStoreName() || bpCurrentSettings.shopName || '';
        bpCurrentSettings.shopName = currentShopName;

        // نحسب أبعاد العرض والارتفاع للمعاينة (التحويل من mm إلى px بنسبة تقريبية للشاشة)
        const scale = 3.6; // معامل تحويل العرض لشاشة الـ Preview
        const previewW = Math.round(bpCurrentSettings.width * scale);
        const previewH = Math.round(bpCurrentSettings.height * scale);

        // نعرض عينة من الأصناف المختارة (أول 3 ملصقات على الأكثر كمعاينة بصرية واقعية)
        const sampleItems = bpQueue.slice(0, 3);
        let previewHtml = '';

        sampleItems.forEach((item, sIdx) => {
            const variantText = (typeof window.formatBarcodeVariantLabel === 'function')
                ? window.formatBarcodeVariantLabel(item.size, item.color)
                : [item.color, item.size].filter(Boolean).join(' ');
            const priceFormatted = (parseFloat(item.price) || 0).toFixed(2);

            previewHtml += `
                <div class="bp-live-sticker" style="width: ${previewW}px; height: ${previewH}px; min-height: ${previewH}px; padding: 4px 6px;">
                    ${(bpCurrentSettings.showShopName && currentShopName) ? `<div class="bp-stk-shop" style="font-weight:900; font-size: 11px;">${currentShopName}</div>` : ''}
                    <div style="width: 100%; border-bottom: 1px solid #000000; margin: 1px 0;"></div>
                    ${bpCurrentSettings.showItemName ? `<div class="bp-stk-item" style="font-weight:900; font-size: 11px;" title="${item.name}">${item.name}</div>` : ''}
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%;">
                        <svg id="bp-preview-svg-${sIdx}" class="bp-stk-barcode-svg"></svg>
                    </div>
                    <div class="bp-stk-bottom-row" style="font-weight:900;">
                        ${bpCurrentSettings.showVariant && variantText ? `<div class="bp-stk-variant" style="font-weight:900; font-size: 11px;"><bdi>${variantText}</bdi></div>` : '<div></div>'}
                        ${bpCurrentSettings.showPrice ? `<div class="bp-stk-price" style="font-weight:900; font-size: 12px;">${priceFormatted}</div>` : ''}
                    </div>
                </div>
            `;
        });

        if (bpQueue.length > 3) {
            previewHtml += `<div style="font-size: 0.75rem; color: #94a3b8; font-weight: 800;">+ ${bpQueue.length - 3} ملصقات إضافية بالقائمة...</div>`;
        }

        previewContainer.innerHTML = previewHtml;

        // رسم الـ SVG لكل ملصق عينة
        sampleItems.forEach((item, sIdx) => {
            const svgEl = document.getElementById(`bp-preview-svg-${sIdx}`);
            if (svgEl && window.JsBarcode) {
                try {
                    window.JsBarcode(svgEl, item.barcode, {
                        format: "CODE128",
                        width: bpCurrentSettings.barcodeWidth,
                        height: bpCurrentSettings.barcodeHeight,
                        displayValue: bpCurrentSettings.showBarcodeText,
                        fontSize: bpCurrentSettings.fontSize,
                        font: "Segoe UI, Arial, sans-serif",
                        fontOptions: "bold",
                        textMargin: 1,
                        margin: 2
                    });
                } catch (e) {
                    console.warn("Preview JsBarcode error:", e);
                }
            }
        });
    }

    /**
     * تنفيذ الطباعة المباشرة لملصقات الباركود باستخدام دالة الطباعة المركزية المعتمدة
     * (executePrinting) لضمان تطابق شكل وحجم وتنسيق الملصق 100% مع الطبعة المعتمدة
     */
    function printBarcodeQueue() {
        if (bpQueue.length === 0) {
            if (typeof showToast === 'function') showToast("⚠️ قائمة طباعة الباركود فارغة!", "warning");
            return;
        }

        let totalStickers = 0;
        bpQueue.forEach(x => { totalStickers += (parseInt(x.copies, 10) || 1); });
        if (totalStickers === 0) {
            if (typeof showToast === 'function') showToast("⚠️ يرجى تحديد عدد نسخ أكبر من صفر!", "warning");
            return;
        }

        readBpSettingsFromUI();
        if (typeof setStore === 'function') {
            setStore('bayan_barcode_label_settings', JSON.stringify(bpCurrentSettings));
        }
        try { localStorage.setItem('bayan_barcode_label_settings', JSON.stringify(bpCurrentSettings)); } catch (e) {}

        // تحويل عناصر القائمة المجهزة إلى الصيغة المعتمدة لدالة executePrinting المركزية
        const targets = bpQueue.map(item => ({
            name: item.name,
            size: item.size || '',
            color: item.color || '',
            code: item.code || item.barcode,
            barcode: item.barcode,
            price: parseFloat(item.price) || 0,
            copies: parseInt(item.copies, 10) || 1
        }));

        if (typeof window.executePrinting === 'function') {
            window.executePrinting(targets, 1);
        } else if (typeof executePrinting === 'function') {
            executePrinting(targets, 1);
        } else {
            if (typeof showToast === 'function') showToast("⚠️ دالة طباعة الباركود غير متاحة حالياً!", "error");
        }
    }

    /**
     * إضافة كافة أصناف المخزن دفعة واحدة للقائمة
     */
    function addAllInventoryToBpQueue() {
        const prods = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : [];
        if (prods.length === 0) {
            if (typeof showToast === 'function') showToast("⚠️ المخزن فارغ!", "warning");
            return;
        }

        if (!confirm(`هل تريد إضافة كافة أصناف المخزن (${prods.length} صنف بمقاساتهم) إلى قائمة طباعة الباركود؟`)) {
            return;
        }

        const itemsToAdd = [];
        prods.forEach(p => {
            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                p.variants.forEach((v, idx) => {
                    const vPrice = (v.price !== undefined && v.price !== null && v.price !== '') ? parseFloat(v.price) : (parseFloat(p.price) || 0);
                    const vStock = getBpVariantStock(v);
                    const vBarcode = String(v.barcode || `${p.barcode || '1000'}-${idx + 1}`).trim();
                    itemsToAdd.push({
                        productId: p.id,
                        name: p.name,
                        variantId: idx,
                        size: v.size || '',
                        color: v.color || '',
                        barcode: vBarcode,
                        price: vPrice,
                        stock: vStock,
                        copies: 1,
                        isMaster: false
                    });
                });
            } else {
                itemsToAdd.push({
                    productId: p.id,
                    name: p.name,
                    variantId: null,
                    size: p.size || '',
                    color: p.color || '',
                    barcode: String(p.barcode || p.code || generateFallbackBarcode()).trim(),
                    price: parseFloat(p.price) || 0,
                    stock: getBpProductStock(p),
                    copies: 1,
                    isMaster: true
                });
            }
        });

        addBulkItemsToQueue(itemsToAdd);
    }

    /**
     * التهيئة الشاملة لقسم طباعة الباركود عند فتحه
     */
    function initBarcodePrintSection() {
        loadBpSettings();
        updateBpQueueUI();
        populateBpFilters();

        // تطبيق حالة إظهار/إخفاء المعاينة الحية (الافتراضي: مخفية لتوسيع مساحة العمل)
        let savedPreview = false;
        try {
            const raw = (typeof getStore === 'function' ? getStore('bayan_bp_preview_visible') : null) || (typeof localStorage !== 'undefined' ? localStorage.getItem('bayan_bp_preview_visible') : null);
            savedPreview = raw === 'true' || raw === true;
        } catch (e) {}
        toggleBpPreviewColumn(savedPreview);

        // إغلاق القائمة المنسدلة للبحث عند النقر خارجها
        document.addEventListener('click', function (e) {
            const dropdown = document.getElementById('bpSearchResultsDropdown');
            const searchWrap = document.querySelector('.bp-search-input-wrap');
            if (dropdown && searchWrap && !searchWrap.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        // اختصارات الكيبورد داخل قسم طباعة الباركود
        if (!window._bpKeydownBound) {
            window._bpKeydownBound = true;
            document.addEventListener('keydown', function (e) {
                const sec = document.getElementById('barcode-print-section');
                if (!sec || sec.classList.contains('hidden')) return;

                if (e.key === 'F2') {
                    e.preventDefault();
                    const el = document.getElementById('bpSearchInput');
                    if (el) { el.focus(); el.select(); }
                } else if (e.key === 'Escape') {
                    const modal = document.getElementById('bpVariantModal');
                    if (modal && !modal.classList.contains('hidden')) {
                        closeBpVariantModal();
                        return;
                    }
                    const dropdown = document.getElementById('bpSearchResultsDropdown');
                    if (dropdown && dropdown.classList.contains('active')) {
                        dropdown.classList.remove('active');
                    }
                }
            });
        }

        // تركيز المؤشر في خانة البحث تلقائياً
        setTimeout(() => {
            const el = document.getElementById('bpSearchInput');
            if (el) {
                el.focus();
                el.select();
            }
        }, 120);
    }

    // ============================================================
    // تصدير الدوال إلى النطاق العام (window) لتتفاعل مع الـ HTML
    // تصدير الدوال إلى النطاق العام (window) لتتفاعل مع الـ HTML
    window.initBarcodePrintSection = initBarcodePrintSection;
    window.toggleBpPreviewColumn = toggleBpPreviewColumn;
    window.getMerchantStoreName = getMerchantStoreName;
    window.onBpSearchInput = onBpSearchInput;
    window.onBpQuickFilterChange = onBpQuickFilterChange;
    window.resetBpQuickFilters = resetBpQuickFilters;
    window.onBpSearchKeyDown = onBpSearchKeyDown;
    window.populateBpFilters = populateBpFilters;
    window.onBpSelectProduct = onBpSelectProduct;
    window.onBpPresetChange = onBpPresetChange;
    window.saveBpSettings = saveBpSettings;
    window.readBpSettingsFromUI = readBpSettingsFromUI;
    window.renderBpPreview = renderBpPreview;
    window.printBarcodeQueue = printBarcodeQueue;
    window.clearBpQueue = clearBpQueue;
    window.clearBpQueueSilently = clearBpQueueSilently;
    window.hasBpQueueItems = hasBpQueueItems;
    window.getBpQueueCount = getBpQueueCount;
    window.setUniformCopiesForAll = setUniformCopiesForAll;
    window.setCopiesFromCurrentStock = setCopiesFromCurrentStock;
    window.addAllInventoryToBpQueue = addAllInventoryToBpQueue;
    window.removeBpQueueItem = removeBpQueueItem;
    window.updateBpItemCopies = updateBpItemCopies;

    // دوال نافذة المقاسات المنبثقة
    window.closeBpVariantModal = closeBpVariantModal;
    window.confirmBpModalSelectedVariants = confirmBpModalSelectedVariants;
    window.addAllVariantsOfCurrentModal = addAllVariantsOfCurrentModal;
    window.addMasterBarcodeOfCurrentModal = addMasterBarcodeOfCurrentModal;

})(window);
