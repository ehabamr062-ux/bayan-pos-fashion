// ============================================================
//  إدارة كروت الأصناف وإضافة وتعديل المنتجات (Products Management)
// ============================================================
async function saveNewItem(mode = 'save') {
    const isEdit = typeof currentEditingProductId !== 'undefined' && !!currentEditingProductId;
    if (isEdit && typeof checkPermission === 'function' && !checkPermission('stock_edit')) return false;
    if (!isEdit && typeof checkPermission === 'function' && !checkPermission('stock_add')) return false;

    const name = document.getElementById('newItemName').value;
    const price = parseFloat(document.getElementById('newItemPrice').value) || 0;
    const cost = parseFloat(document.getElementById('newItemCost').value) || 0;
    const wholesale = parseFloat(document.getElementById('newItemWholesale').value) || 0;
    const minPrice = parseFloat(document.getElementById('newItemMinPrice').value) || 0;
    const discount = parseFloat(document.getElementById('newItemDiscount').value) || 0;

    const sysCode = document.getElementById('newItemSysCode')?.value || '';
    let barcode = document.getElementById('newItemBarcode')?.value?.trim() || '';
    if (!barcode) {
        if (typeof generateVariantBarcode === 'function') {
            barcode = generateVariantBarcode('', '', 1);
        } else {
            barcode = '20' + String(Date.now()).slice(-8);
        }
        if (document.getElementById('newItemBarcode')) {
            document.getElementById('newItemBarcode').value = barcode;
        }
    }
    const code = document.getElementById('newItemCode')?.value?.trim() || '';
    const scalePlu = document.getElementById('newItemScalePlu')?.value?.trim() || '';
    const category = document.getElementById('newItemCategory')?.value || '';
    const brand = document.getElementById('newItemBrand')?.value?.trim() || '';
    const supplier = document.getElementById('newItemSupplier')?.value?.trim() || '';
    const shelf = document.getElementById('newItemShelf')?.value || '';

    let stock = parseFloat(document.getElementById('newItemStock').value) || 0;
    const minStock = parseFloat(document.getElementById('newItemMinStock').value) || 0;
    const expiry = document.getElementById('newItemExpiry').value;
    const notes = document.getElementById('newItemNotes').value;

    if (!name || price === 0) {
        if (mode === 'silent') {
            if (!name && !currentEditingProductId) return true;
            showToast("⚠️ يرجى إدخال اسم الصنف وسعر البيع للحفظ التلقائي", "warning");
            return false;
        }
        return alert("⚠️ يرجى إدخال اسم الصنف وسعر البيع على الأقل.");
    }

    if (price < cost || wholesale < cost) {
        if (mode === 'silent') {
            showToast("❌ تعذر الحفظ التلقائي: سعر البيع أقل من التكلفة!", "error");
            return false;
        }
        if (price < cost) return alert("❌ خطأ: سعر البيع القطاعي أقل من سعر التكلفة!");
        if (wholesale < cost) return alert("❌ خطأ: سعر بيع الجملة أقل من سعر التكلفة!");
    }

    // تعميم الأسعار اختياري وليس إجبارياً: يُسمح بحرية كاملة لكل مقاس أن يحمل سعراً وتكلفة مستقلة

    const activeProductId = (typeof currentEditingProductId !== 'undefined' && currentEditingProductId) ? currentEditingProductId : null;

    // 🛑 فهرس الباركودات فائق السرعة O(1) لفحص التكرار لحظياً دون استهلاك المعالج
    const existingBarcodesMap = new Map();
    if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
        for (let idx = 0; idx < productsDB.length; idx++) {
            const p = productsDB[idx];
            if (!p || (activeProductId && (p.id === activeProductId || String(p.id) === String(activeProductId)))) continue;
            if (p.barcode) existingBarcodesMap.set(String(p.barcode).trim(), p);
            if (p.code) existingBarcodesMap.set(String(p.code).trim(), p);
            if (p.units && Array.isArray(p.units)) {
                for (let u = 0; u < p.units.length; u++) {
                    if (p.units[u].unitBarcode) existingBarcodesMap.set(String(p.units[u].unitBarcode).trim(), p);
                }
            }
            if (p.variants && Array.isArray(p.variants)) {
                for (let v = 0; v < p.variants.length; v++) {
                    if (p.variants[v].barcode) existingBarcodesMap.set(String(p.variants[v].barcode).trim(), p);
                }
            }
        }
    }

    // فحص أمان صارم: منع تكرار الباركود الأساسي
    if (barcode) {
        const cleanBc = String(barcode).trim();
        const duplicateProduct = existingBarcodesMap.get(cleanBc);

        if (duplicateProduct) {
            const errorMsg = `⚠️ تنبيه أمان: الباركود (${cleanBc}) مسجل مسبقاً للصنف "${duplicateProduct.name}"!\nيرجى استخدام باركود مختلف لمنع تضارب الأصناف في الكاشير.`;
            if (mode === 'silent') {
                showToast(errorMsg, "error");
                return false;
            }
            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'error',
                    titleText: '⚠️ تكرار في الباركود',
                    msg: errorMsg
                });
            } else {
                alert(errorMsg);
            }
            return false;
        }
    }

    const units = [];
    const rows = document.getElementById('productUnitsTableBody')?.rows || [];
    for (let i = 0; i < rows.length; i++) {
        const unitSelect = rows[i].cells[0].querySelector('select');
        if (!unitSelect) continue;

        const bQty = parseFloat(rows[i].cells[1].querySelector('input').value) || 1;
        const sQty = parseFloat(rows[i].cells[2].querySelector('input').value) || 1;
        const cLabel = rows[i].querySelector('.u-cost-label');

        units.push({
            unitName: unitSelect.value,
            base_qty: bQty,
            sub_unit_quantity: sQty,
            factor: bQty / sQty,
            wholesale: parseFloat(rows[i].cells[3].querySelector('input').value) || 0,
            price: parseFloat(rows[i].cells[4].querySelector('input').value) || 0,
            cost: cLabel ? parseFloat(cLabel.innerText) : 0,
            isDefaultSale: rows[i].cells[6].querySelector('input').checked,
            isDefaultPurchase: rows[i].cells[7].querySelector('input').checked,
            unitBarcode: rows[i].cells[8].querySelector('input').value
        });
    }

    // تجميع مصفوفة المقاسات والألوان إن وجدت مع ضمان وجود باركود فريد لكل تشكيلة
    const existingProduct = (typeof currentEditingProductId !== 'undefined' && currentEditingProductId)
        ? productsDB.find(p => p.id === currentEditingProductId)
        : null;

    const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName)
        ? currentUser.warehouseName
        : 'المخزن الرئيسي';

    // تجميع مصفوفة المقاسات والألوان إن وجدت مع ضمان وجود باركود فريد لكل تشكيلة والاحتفاظ بأرصدة المخازن
    const variants = [];
    const vRows = document.getElementById('productVariantsTableBody')?.rows || [];
    // فحص ما إذا كانت كافة صفوف التشكيلات تمتلك نفس السعر ولم تُخصص لكل مقاس على حدة
    let allVRowsSamePrice = true;
    let firstRowPrice = null;
    let allVRowsSameWs = true;
    let firstRowWs = null;
    let allVRowsSameCost = true;
    let firstRowCost = null;

    for (let j = 0; j < vRows.length; j++) {
        const pInp = vRows[j].querySelector('.var-price-input');
        const wInp = vRows[j].querySelector('.var-ws-input');
        const cInp = vRows[j].querySelector('.var-cost-input');

        const curP = pInp ? parseFloat(pInp.value) : null;
        if (curP !== null && !isNaN(curP)) {
            if (firstRowPrice === null) firstRowPrice = curP;
            else if (Math.abs(curP - firstRowPrice) > 0.01) allVRowsSamePrice = false;
        }

        const curWs = wInp ? parseFloat(wInp.value) : null;
        if (curWs !== null && !isNaN(curWs)) {
            if (firstRowWs === null) firstRowWs = curWs;
            else if (Math.abs(curWs - firstRowWs) > 0.01) allVRowsSameWs = false;
        }

        const curCost = cInp ? parseFloat(cInp.value) : null;
        if (curCost !== null && !isNaN(curCost)) {
            if (firstRowCost === null) firstRowCost = curCost;
            else if (Math.abs(curCost - firstRowCost) > 0.01) allVRowsSameCost = false;
        }
    }

    // 🛡️ فحص أمني: منع تكرار نفس المقاس واللون في جدول التشكيلات لتفادي تضارب الباركود وتشتت الرصيد
    const seenVariantKeys = new Set();
    for (let k = 0; k < vRows.length; k++) {
        const szInp = vRows[k].querySelector('.var-size-input');
        const clInp = vRows[k].querySelector('.var-color-input');
        const checkSz = szInp ? szInp.value.trim() : '';
        const checkCl = clInp ? clInp.value.trim() : '';
        if (checkSz || checkCl) {
            const normKey = `${checkSz.toLowerCase()}___${checkCl.toLowerCase()}`;
            if (seenVariantKeys.has(normKey)) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'warning',
                        titleText: '⚠️ تشكيلة مكررة',
                        msg: `عذراً، المقاس "<b>${checkSz || 'عام'}</b>" واللون "<b>${checkCl || 'عام'}</b>" مكرر أكثر من مرة في جدول التشكيلات!<br>يرجى دمج الكميات في صف واحد لحماية دقة الجرد والباركود.`
                    });
                } else if (typeof showToast === 'function') {
                    showToast(`⚠️ تنبيه: المقاس (${checkSz || 'عام'}) واللون (${checkCl || 'عام'}) مكرر في جدول التشكيلات! يرجى دمج الكميات في صف واحد.`, 'warning');
                } else {
                    alert(`⚠️ المقاس (${checkSz}) واللون (${checkCl}) مكرر في جدول التشكيلات! يرجى دمجهما.`);
                }
                return;
            }
            seenVariantKeys.add(normKey);
        }
    }

    for (let i = 0; i < vRows.length; i++) {
        const sizeInp = vRows[i].querySelector('.var-size-input');
        const colorInp = vRows[i].querySelector('.var-color-input');
        const barcodeInp = vRows[i].querySelector('.var-barcode-input');
        const stockInp = vRows[i].querySelector('.var-stock-input');
        const priceInp = vRows[i].querySelector('.var-price-input');
        const wsInp = vRows[i].querySelector('.var-ws-input');
        const costInp = vRows[i].querySelector('.var-cost-input');

        const vSize = sizeInp ? sizeInp.value.trim() : '';
        const vColor = colorInp ? colorInp.value.trim() : '';
        let vBarcode = barcodeInp ? barcodeInp.value.trim() : '';
        const vStock = stockInp ? parseFloat(stockInp.value) || 0 : 0;

        if (vSize || vColor || vBarcode) {
            if (!vBarcode) {
                if (typeof generateVariantBarcode === 'function') {
                    vBarcode = generateVariantBarcode(vSize, vColor, i + 1);
                } else {
                    vBarcode = `20${String(Date.now()).slice(-6)}${i + 1}`;
                }
                if (barcodeInp) barcodeInp.value = vBarcode;
            }

            // البحث عن التشكيلة المطابقة في بيانات الصنف السابقة للاحتفاظ بأرصدتها في كل مخزن
            let vWarehouseStocks = {};
            const existingVar = existingProduct && existingProduct.variants && Array.isArray(existingProduct.variants)
                ? existingProduct.variants.find(ev => (ev.barcode && ev.barcode === vBarcode) || (ev.size === vSize && ev.color === vColor))
                : null;

            if (existingVar && existingVar.warehouseStocks && typeof existingVar.warehouseStocks === 'object') {
                vWarehouseStocks = { ...existingVar.warehouseStocks };
                vWarehouseStocks[activeWH] = vStock;
            } else {
                vWarehouseStocks = { [activeWH]: vStock };
            }

            // حساب الرصيد الإجمالي للـ variant عبر جميع المخازن
            const vTotalStock = Object.values(vWarehouseStocks).reduce((sum, q) => sum + (parseFloat(q) || 0), 0);

            // الحفاظ على السعر والتكلفة المحددة للمقاس بدقة (دعم تخصيص سعر مختلف لكل مقاس بحرية)
            let itemPrice = (priceInp && priceInp.value !== '' && !isNaN(parseFloat(priceInp.value)) && parseFloat(priceInp.value) > 0)
                ? parseFloat(priceInp.value)
                : (price > 0 ? price : 0);

            let itemWs = (wsInp && wsInp.value !== '' && !isNaN(parseFloat(wsInp.value)))
                ? parseFloat(wsInp.value)
                : wholesale;

            let itemCost = (costInp && costInp.value !== '' && !isNaN(parseFloat(costInp.value)))
                ? parseFloat(costInp.value)
                : cost;

            variants.push({
                size: vSize,
                color: vColor,
                barcode: vBarcode,
                stock: vTotalStock,
                warehouseStocks: vWarehouseStocks,
                price: itemPrice,
                wholesale: itemWs,
                cost: itemCost
            });
        }
    }

    // 🛑 فحص أمان صارم: منع تكرار باركود التشكيلات (المقاسات والألوان) سواء داخلياً أو مع أصناف أخرى
    if (variants.length > 0) {
        const vSeen = new Set();
        if (barcode) vSeen.add(String(barcode).trim());

        for (const v of variants) {
            const vBc = String(v.barcode || '').trim();
            if (!vBc) continue;

            if (vSeen.has(vBc)) {
                const dupMsg = `⚠️ تنبيه أمان: باركود التشكيلة (${vBc}) مكرر داخل نفس الصنف (المقاس: ${v.size || '-'} / اللون: ${v.color || '-'})!`;
                if (mode === 'silent') { showToast(dupMsg, "error"); return false; }
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({ type: 'error', titleText: '⚠️ تكرار في الباركود', msg: dupMsg });
                } else { alert(dupMsg); }
                return false;
            }
            vSeen.add(vBc);

            const dupProduct = existingBarcodesMap.get(vBc);

            if (dupProduct) {
                const dupMsg = `⚠️ تنبيه أمان: باركود التشكيلة (${vBc}) مسجل مسبقاً للصنف "${dupProduct.name}"! يرجى تغييره.`;
                if (mode === 'silent') { showToast(dupMsg, "error"); return false; }
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({ type: 'error', titleText: '⚠️ تكرار في الباركود', msg: dupMsg });
                } else { alert(dupMsg); }
                return false;
            }
        }
    }

    // جمع رصيد كافة المقاسات والألوان تلقائياً ليكون هو الرصيد الإجمالي للصنف
    if (variants.length > 0) {
        const totalVariantsStock = variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
        stock = totalVariantsStock;
        if (document.getElementById('newItemStock')) {
            document.getElementById('newItemStock').value = stock;
        }
    }

    if (category && window.inventoryCategories && !window.inventoryCategories.includes(category)) {
        window.inventoryCategories.push(category);
        if (typeof updateDatalists === 'function') updateDatalists();
        if (typeof setStore === 'function') setStore('bayan_inventory_categories', JSON.stringify(window.inventoryCategories));
    }

    let warehouseStocks = {};
    if (existingProduct && existingProduct.warehouseStocks && typeof existingProduct.warehouseStocks === 'object') {
        warehouseStocks = { ...existingProduct.warehouseStocks };
    }
    
    if (variants.length > 0) {
        // إذا كان للصنف تشكيلات، نحسب رصيد كل مخزن من مجموع تشكيلاته في ذلك المخزن
        const allWhNames = new Set(Object.keys(warehouseStocks));
        allWhNames.add(activeWH);
        if (typeof warehouses !== 'undefined' && Array.isArray(warehouses)) {
            warehouses.forEach(w => allWhNames.add(w.name));
        }
        allWhNames.forEach(wName => {
            let whSum = 0;
            variants.forEach(v => {
                if (v.warehouseStocks && v.warehouseStocks[wName] !== undefined) {
                    whSum += parseFloat(v.warehouseStocks[wName]) || 0;
                }
            });
            warehouseStocks[wName] = whSum;
        });
    } else if (existingProduct) {
        const stockDelta = stock - (parseFloat(existingProduct.stock) || 0);
        if (Math.abs(stockDelta) > 0.0001) {
            warehouseStocks[activeWH] = Math.max(0, (parseFloat(warehouseStocks[activeWH]) || 0) + stockDelta);
            if (typeof transactions !== 'undefined') {
                const now = new Date();
                const dt = {
                    full: now.toLocaleString('ar-EG'),
                    iso: now.toLocaleDateString('en-CA'),
                    time: now.toTimeString().slice(0, 5)
                };
                transactions.push({
                    date: dt.full,
                    dateISO: dt.iso,
                    timeISO: dt.time,
                    type: 'تسوية مخزن ⚖️',
                    method: '-',
                    invoiceId: 'ADJ-CARD-' + Date.now().toString().slice(-6),
                    product: name,
                    unit: units.length > 0 ? units[0].unitName : "قطعة",
                    qty: stockDelta,
                    price: cost || price || 0,
                    total: (stockDelta * (cost || price || 0)).toFixed(2),
                    partner: 'جرد مباشر من كارت الصنف',
                    warehouse: activeWH,
                    user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '-',
                    notes: `تعديل يدوي للرصيد من (${existingProduct.stock || 0}) إلى (${stock})`,
                    unitFactor: 1,
                    editDate: new Date().toLocaleString('ar-EG')
                });
            }
        }
    } else {
        warehouseStocks = { [activeWH]: stock };
        if (!existingProduct && stock > 0 && typeof transactions !== 'undefined') {
            const now = new Date();
            const dt = {
                full: now.toLocaleString('ar-EG'),
                iso: now.toLocaleDateString('en-CA'),
                time: now.toTimeString().slice(0, 5)
            };
            transactions.push({
                date: dt.full,
                dateISO: dt.iso,
                timeISO: dt.time,
                type: 'تسوية مخزن ⚖️',
                method: '-',
                invoiceId: 'INIT-' + Date.now().toString().slice(-6),
                product: name,
                unit: units.length > 0 ? units[0].unitName : "قطعة",
                qty: stock,
                price: cost || price || 0,
                total: (stock * (cost || price || 0)).toFixed(2),
                partner: 'رصيد افتتاحي أولي',
                warehouse: activeWH,
                user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '-',
                notes: `إضافة رصيد افتتاحي أولي للصنف الجديد (${stock})`,
                unitFactor: 1,
                editDate: '-'
            });
        }
    }

    const finalId = (typeof currentEditingProductId !== 'undefined' && currentEditingProductId) ? currentEditingProductId : Date.now();
    const safeName = typeof sanitizeInput === 'function' ? sanitizeInput(name) : name;
    const safeNotes = typeof sanitizeInput === 'function' ? sanitizeInput(notes) : notes;
    const safeCategory = typeof sanitizeInput === 'function' ? sanitizeInput(category) : category;
    const safeBrand = typeof sanitizeInput === 'function' ? sanitizeInput(brand) : brand;
    const safeSupplier = typeof sanitizeInput === 'function' ? sanitizeInput(supplier) : supplier;
    const safeShelf = typeof sanitizeInput === 'function' ? sanitizeInput(shelf) : shelf;

    // 🛡️ تحديد صورة الصنف بدقة فائقة وحمايتها التامة من الاختفاء عند تعديل أي بيانات
    const previewEl = document.getElementById('productImagePreview');
    const isExplicitlyRemoved = (window.productImageRemoved === true) || (previewEl && previewEl.dataset && previewEl.dataset.removed === 'true');
    
    let resolvedImage = null;
    if (isExplicitlyRemoved) {
        resolvedImage = null;
    } else if (window.currentProductImageData) {
        resolvedImage = window.currentProductImageData;
    } else if (typeof currentProductImageData !== 'undefined' && currentProductImageData) {
        resolvedImage = currentProductImageData;
    } else if (previewEl && previewEl.dataset && previewEl.dataset.image) {
        resolvedImage = previewEl.dataset.image;
    } else if (existingProduct && existingProduct.image) {
        resolvedImage = existingProduct.image;
    }

    const newItem = {
        ...(existingProduct || {}),
        id: finalId,
        sysCode: sysCode || String(finalId),
        scalePlu: scalePlu,
        name: safeName,
        price, cost, wholesale, minPrice, discount,
        barcode, code,
        category: safeCategory,
        brand: safeBrand,
        supplier: safeSupplier,
        shelf: safeShelf,
        stock, minStock, expiry,
        notes: safeNotes,
        units,
        variants,
        warehouseStocks,
        unit: units.length > 0 ? units[0].unitName : "قطعة",
        image: resolvedImage,
        isQuick: document.getElementById('isQuickItem') ? document.getElementById('isQuickItem').checked : false
    };

    if (typeof currentEditingProductId !== 'undefined' && currentEditingProductId) {
        const idx = productsDB.findIndex(p => p.id === currentEditingProductId);
        if (idx !== -1) productsDB[idx] = newItem;
        await db.products.put(newItem);
    } else {
        window.currentEditingProductId = newItem.id;
        productsDB.push(newItem);
        await db.products.add(newItem);
    }

    if (typeof invalidateStockCache === 'function') invalidateStockCache();
    if (typeof window.invalidateStockCache === 'function') window.invalidateStockCache();
    if (typeof updateNotifications === 'function') updateNotifications();
    if (typeof updateDatalists === 'function') updateDatalists();
    if (typeof renderProductsGrid === 'function') renderProductsGrid();

    const qAddCtx = typeof currentQuickAddContext !== 'undefined' ? currentQuickAddContext : null;
    if (qAddCtx === 'sales' && typeof addToCart === 'function') addToCart(newItem.id);
    else if (qAddCtx === 'purchase' && typeof addToPurchaseCart === 'function') addToPurchaseCart(newItem.id);

    window.currentQuickAddContext = null;
    if (mode !== 'silent') {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'success',
                titleText: 'عملية ناجحة',
                msg: 'تم حفظ الصنف بنجاح بنظام بيان ',
                confirmText: 'حسناً'
            });
        } else {
            alert("تم حفظ الصنف بنجاح!");
        }
    } else {
        showToast("✅ تم الحفظ التلقائي للصنف بنجاح", "success");
    }

    renderInventoryTable();
    if (typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();

    if (mode === 'save') {
        document.getElementById('newItemModal')?.classList.add('hidden');
    } else if (mode === 'new') {
        // 🔄 تفريغ وتصفير شامل لكافة حقول كارت الصنف والتبويبات للبدء الفوري بصنف جديد نظيف تماماً
        window.currentEditingProductId = null;

        // 1. تصفير الحقول العلوية (الاسم والأسعار والخصم)
        if (document.getElementById('newItemName')) document.getElementById('newItemName').value = "";
        if (document.getElementById('newItemPrice')) document.getElementById('newItemPrice').value = "0";
        if (document.getElementById('newItemWholesale')) document.getElementById('newItemWholesale').value = "0";
        if (document.getElementById('newItemCost')) document.getElementById('newItemCost').value = "0";
        if (document.getElementById('newItemCostQty')) document.getElementById('newItemCostQty').value = "0";
        if (document.getElementById('newItemMinPrice')) document.getElementById('newItemMinPrice').value = "0";
        if (document.getElementById('newItemDiscount')) document.getElementById('newItemDiscount').value = "0";

        // 2. تصفير الأكواد والباركود والتصنيف والبيانات الإضافية
        if (document.getElementById('newItemBarcode')) document.getElementById('newItemBarcode').value = "";
        if (document.getElementById('newItemCode')) document.getElementById('newItemCode').value = "";
        if (document.getElementById('newItemSysCode')) document.getElementById('newItemSysCode').value = "";
        if (document.getElementById('newItemScalePlu')) document.getElementById('newItemScalePlu').value = "";
        if (document.getElementById('newItemCategory')) document.getElementById('newItemCategory').value = "عام";
        if (document.getElementById('newItemBrand')) document.getElementById('newItemBrand').value = "";
        if (document.getElementById('newItemSupplier')) document.getElementById('newItemSupplier').value = "";
        if (document.getElementById('newItemShelf')) document.getElementById('newItemShelf').value = "";
        if (document.getElementById('newItemNotes')) document.getElementById('newItemNotes').value = "";
        if (document.getElementById('newItemExpiry')) document.getElementById('newItemExpiry').value = "";
        if (document.getElementById('isQuickItem')) document.getElementById('isQuickItem').checked = false;

        // 3. تصفير الأرصدة والمخازن
        const mainStockInp = document.getElementById('newItemStock');
        if (mainStockInp) {
            mainStockInp.value = "0";
            mainStockInp.dataset.origStock = "0";
        }
        if (document.getElementById('newItemMinStock')) document.getElementById('newItemMinStock').value = "10";
        if (typeof renderProductWarehouseStocksTable === 'function') {
            renderProductWarehouseStocksTable(null);
        }

        // 4. تصفير وتفريغ جدول ومولدات المقاسات والألوان تماماً
        if (document.getElementById('variantSizesInput')) document.getElementById('variantSizesInput').value = '';
        if (document.getElementById('variantColorsInput')) document.getElementById('variantColorsInput').value = '';
        if (document.getElementById('colorOnlyInput')) document.getElementById('colorOnlyInput').value = '';
        const vBody = document.getElementById('productVariantsTableBody');
        if (vBody) vBody.innerHTML = '';
        window.initialModalVariants = [];
        const vCountBadge = document.getElementById('variantsCountBadge');
        if (vCountBadge) vCountBadge.innerText = '0';
        const matrixWrapper = document.getElementById('smartMatrixWrapper');
        if (matrixWrapper) {
            matrixWrapper.innerHTML = `
                <div style="padding: 30px; text-align: center; color: #94a3b8; font-weight: bold; font-size: 0.95rem;">
                    <span>👕📦 لا توجد تشكيلات مضافة بعد. اختر قالباً أو أضف ألواناً لتظهر في الشبكة الذكية هنا.</span>
                </div>
            `;
        }

        // 5. إعادة تعيين جدول الوحدات لقطعة افتراضية
        const uBody = document.getElementById('productUnitsTableBody');
        if (uBody) uBody.innerHTML = '';
        if (typeof addProductUnitRow === 'function') addProductUnitRow('قطعة');

        // 6. تصفير الصورة
        const imgPreview = document.getElementById('productImagePreview');
        if (imgPreview) {
            imgPreview.style.backgroundImage = 'none';
            imgPreview.dataset.image = '';
            imgPreview.dataset.removed = 'false';
            imgPreview.innerText = '📷';
        }
        window.currentProductImageData = null;
        window.productImageRemoved = false;
        if (typeof currentProductImageData !== 'undefined') currentProductImageData = null;
        document.getElementById('removeProductImageBtn')?.classList.add('hidden');

        // 7. توجيه المؤشر لاسم الصنف والتحويل لتبويب البيانات العامة
        if (typeof switchBayanTab === 'function') {
            switchBayanTab('general', document.querySelector('.bayan-tab'));
        }
        if (typeof updateProductNavCounter === 'function') updateProductNavCounter();
        if (typeof window.updateVariantPriceSyncUI === 'function') window.updateVariantPriceSyncUI();

        setTimeout(() => {
            document.getElementById('newItemName')?.focus();
        }, 150);
    } else if (mode === 'duplicate') {
        window.currentEditingProductId = null;
        // 🔄 توليد باركود دولي فريد جديد للصنف المكرر لمنع أي تعارض أمني عند الحفظ
        if (typeof generateVariantBarcode === 'function') {
            const newMainBc = generateVariantBarcode('', '', 1);
            if (document.getElementById('newItemBarcode')) document.getElementById('newItemBarcode').value = newMainBc;
        } else {
            if (document.getElementById('newItemBarcode')) document.getElementById('newItemBarcode').value = '20' + String(Date.now()).slice(-8);
        }
        if (document.getElementById('newItemSysCode')) {
            document.getElementById('newItemSysCode').value = '';
        }

        // توليد باركودات جديدة لكل المقاسات في الجدول لمنع تكرار باركودات المقاسات
        const vRows = document.getElementById('productVariantsTableBody')?.rows || [];
        for (let i = 0; i < vRows.length; i++) {
            const bcInp = vRows[i].querySelector('.var-barcode-input');
            const szInp = vRows[i].querySelector('.var-size-input');
            const clInp = vRows[i].querySelector('.var-color-input');
            const s = szInp ? szInp.value.trim() : '';
            const c = clInp ? clInp.value.trim() : '';
            if (bcInp) {
                if (typeof generateVariantBarcode === 'function') {
                    bcInp.value = generateVariantBarcode(s, c, i + 1);
                } else {
                    bcInp.value = `20${String(Date.now()).slice(-6)}${i + 1}`;
                }
            }
        }

        document.getElementById('newItemName')?.focus();
        showToast("✅ تم حفظ الصنف الأصلي بنجاح، وتم تجهيز كارت صنف مكرر مع باركودات جديدة. يمكنك تغيير الاسم الآن!", "info");
        if (typeof updateProductNavCounter === 'function') updateProductNavCounter();
    }

    try {
        if (typeof _quickAddTargetSection !== 'undefined' && _quickAddTargetSection && newItem) {
            if (_quickAddTargetSection === 'sales' && typeof addToCart === 'function') {
                addToCart(newItem.id);
            } else if (_quickAddTargetSection === 'purchase' && typeof addToPurchaseCart === 'function') {
                addToPurchaseCart(newItem.id);
            } else if (_quickAddTargetSection === 'salesReturn' && typeof addToReturnCart === 'function') {
                addToReturnCart({ name: newItem.name, price: newItem.price, qty: 1, maxQty: 9999 });
            } else if (_quickAddTargetSection === 'purchaseReturn' && typeof addPurToReturnCart === 'function') {
                addPurToReturnCart({ name: newItem.name, price: newItem.cost || newItem.price, qty: 1, maxQty: 9999 });
            } else if (_quickAddTargetSection === 'adj') {
                window.selectedAdjItem = newItem;
                const sEl = document.getElementById('adjSearch');
                const pEl = document.getElementById('adjPrice');
                const qEl = document.getElementById('adjQty');
                if (sEl) sEl.value = newItem.name;
                if (pEl) pEl.value = newItem.cost || 0;
                document.querySelectorAll('.adj-current-stock-val').forEach(el => el.innerText = newItem.stock || 0);
                if (qEl) qEl.focus();
            }
        }
    } catch(e) {
        console.warn("Auto add target section warning:", e);
    } finally {
        window._quickAddTargetSection = null;
    }
}

async function autoSaveCurrentProductSilent() {
    const nameInput = document.getElementById('newItemName');
    if (!nameInput) return true;
    const nameVal = nameInput.value.trim();

    if (!nameVal && (typeof currentEditingProductId === 'undefined' || !currentEditingProductId)) return true;

    if (!nameVal) {
        showToast("⚠️ يرجى إدخال اسم الصنف أولاً للحفظ", "warning");
        return false;
    }

    const price = parseFloat(document.getElementById('newItemPrice').value) || 0;
    const cost = parseFloat(document.getElementById('newItemCost').value) || 0;

    if (price > 0 && cost > 0 && price < cost) {
        showToast("⚠️ تنبيه: سعر البيع أقل من التكلفة للصنف الحالي", "warning");
    }

    try {
        await saveNewItem('silent');
        return true;
    } catch (err) {
        console.error("Auto save error:", err);
        return true;
    }
}

async function navigateProduct(direction) {
    if (!Array.isArray(productsDB) || productsDB.length === 0) {
        showToast("ℹ️ لا يوجد أصناف مسجلة في المخزن حتى الآن", "info");
        return;
    }

    let curIdx = -1;

    // 1. البحث الدقيق بحسب ID الصنف أو كود النظام
    if (typeof currentEditingProductId !== 'undefined' && currentEditingProductId !== null && currentEditingProductId !== '') {
        const idStr = String(currentEditingProductId).trim();
        curIdx = productsDB.findIndex(p => p && (
            String(p.id).trim() === idStr ||
            String(p.sysCode || '').trim() === idStr ||
            String(p.code || '').trim() === idStr ||
            String(p.barcode || '').trim() === idStr
        ));
    }

    // 2. مطابقة احتياطية بحسب قيم الحقول بالواجهة عند تعذر الوصول بـ ID
    if (curIdx === -1) {
        const sysInp = document.getElementById('newItemSysCode')?.value?.trim();
        const nameInp = document.getElementById('newItemName')?.value?.trim();
        const barInp = document.getElementById('newItemBarcode')?.value?.trim();

        if (sysInp || nameInp || barInp) {
            curIdx = productsDB.findIndex(p => p && (
                (sysInp && String(p.sysCode || '').trim() === sysInp) ||
                (nameInp && p.name && p.name.trim() === nameInp) ||
                (barInp && String(p.barcode || '').trim() === barInp)
            ));
        }
    }

    // 3. التنقل بالتتابع الدقيق صنفاً تلو الآخر
    if (curIdx === -1) {
        curIdx = (direction > 0) ? -1 : productsDB.length;
    }

    let targetIdx = curIdx + direction;

    if (targetIdx < 0) {
        targetIdx = 0;
        showToast("ℹ️ هذا هو أول صنف في السجل (الصنف 1)", "info");
    } else if (targetIdx >= productsDB.length) {
        targetIdx = productsDB.length - 1;
        showToast(`ℹ️ هذا هو آخر صنف في السجل (الصنف ${productsDB.length})`, "info");
    }

    const targetProduct = productsDB[targetIdx];
    if (targetProduct) {
        window.currentEditingProductId = targetProduct.id;
        fillProductModal(targetProduct);
        updateProductNavCounter();
    }
}

function updateProductNavCounter() {
    const textEl = document.getElementById('productNavCounterText');
    if (!textEl) return;

    const total = (productsDB && productsDB.length) || 0;
    let idx = -1;
    if (typeof currentEditingProductId !== 'undefined' && currentEditingProductId !== null && currentEditingProductId !== '' && productsDB) {
        const idStr = String(currentEditingProductId).trim();
        idx = productsDB.findIndex(p => p && (
            String(p.id).trim() === idStr ||
            String(p.sysCode || '').trim() === idStr ||
            String(p.code || '').trim() === idStr
        ));
    }

    if (idx === -1 && productsDB) {
        const nameInp = document.getElementById('newItemName')?.value?.trim();
        if (nameInp) {
            idx = productsDB.findIndex(p => p && p.name && p.name.trim() === nameInp);
        }
    }

    if (idx !== -1) {
        textEl.innerText = `الصنف ${idx + 1} من إجمالي ${total} صنف`;
    } else {
        textEl.innerText = `صنف جديد (إجمالي الأصناف: ${total})`;
    }
}

function fillProductModal(p) {
    window.currentEditingProductId = p.id;
    const preview = document.getElementById('productImagePreview');
    const removeBtn = document.getElementById('removeProductImageBtn');
    if (preview) {
        if (p.image) {
            preview.style.backgroundImage = `url(${p.image})`;
            preview.dataset.image = p.image;
            preview.dataset.removed = 'false';
            preview.innerText = '';
            window.currentProductImageData = p.image;
            window.productImageRemoved = false;
            if (typeof currentProductImageData !== 'undefined') currentProductImageData = p.image;
            if (removeBtn) {
                removeBtn.classList.remove('hidden');
                removeBtn.style.display = 'flex';
            }
        } else {
            preview.style.backgroundImage = 'none';
            preview.dataset.image = '';
            preview.dataset.removed = 'false';
            preview.innerText = '📷';
            window.currentProductImageData = null;
            window.productImageRemoved = false;
            if (typeof currentProductImageData !== 'undefined') currentProductImageData = null;
            if (removeBtn) {
                removeBtn.classList.add('hidden');
                removeBtn.style.display = 'none';
            }
        }
    }

    if (document.getElementById('newItemName')) document.getElementById('newItemName').value = p.name || '';
    if (document.getElementById('newItemSysCode')) document.getElementById('newItemSysCode').value = p.sysCode || p.id || '';
    if (document.getElementById('newItemPrice')) document.getElementById('newItemPrice').value = p.price || 0;
    if (document.getElementById('newItemWholesale')) document.getElementById('newItemWholesale').value = p.wholesale || 0;
    if (document.getElementById('newItemCost')) document.getElementById('newItemCost').value = p.cost || 0;
    const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : (typeof getStore === 'function' ? getStore('activeWarehouse') : 'المخزن الرئيسي') || 'المخزن الرئيسي';
    let currentWhStock = 0;
    if (p.warehouseStocks && typeof p.warehouseStocks === 'object' && p.warehouseStocks[activeWH] !== undefined) {
        currentWhStock = parseFloat(p.warehouseStocks[activeWH]) || 0;
    } else if (activeWH === 'المخزن الرئيسي' || !p.warehouseStocks) {
        currentWhStock = parseFloat(p.stock) || 0;
    } else {
        currentWhStock = 0;
    }

    if (document.getElementById('newItemMinPrice')) document.getElementById('newItemMinPrice').value = p.minPrice || 0;
    if (document.getElementById('newItemDiscount')) document.getElementById('newItemDiscount').value = p.discount || 0;
    if (document.getElementById('newItemBarcode')) document.getElementById('newItemBarcode').value = p.barcode || '';
    if (document.getElementById('newItemCode')) document.getElementById('newItemCode').value = p.code || '';
    if (document.getElementById('newItemScalePlu')) document.getElementById('newItemScalePlu').value = p.scalePlu || '';
    if (document.getElementById('newItemCategory')) document.getElementById('newItemCategory').value = p.category || 'عام';
    if (document.getElementById('newItemBrand')) document.getElementById('newItemBrand').value = p.brand || '';
    if (document.getElementById('newItemSupplier')) document.getElementById('newItemSupplier').value = p.supplier || '';
    if (document.getElementById('newItemShelf')) document.getElementById('newItemShelf').value = p.shelf || '';
    if (document.getElementById('newItemStock')) {
        document.getElementById('newItemStock').value = currentWhStock;
        document.getElementById('newItemStock').dataset.origStock = currentWhStock;
    }
    if (document.getElementById('newItemMinStock')) document.getElementById('newItemMinStock').value = p.minStock || 0;
    if (document.getElementById('newItemCostQty')) document.getElementById('newItemCostQty').value = p.cost || 0;
    if (document.getElementById('newItemExpiry')) document.getElementById('newItemExpiry').value = p.expiry || '';
    if (document.getElementById('newItemNotes')) document.getElementById('newItemNotes').value = p.notes || '';

    const tbody = document.getElementById('productUnitsTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        if (p.units && p.units.length > 0 && typeof addProductUnitRow === 'function') {
            p.units.forEach((u, idx) => {
                addProductUnitRow(u.unitName, u.base_qty || u.factor || 1, u.sub_unit_quantity || 1);
                const lastRow = tbody.rows[tbody.rows.length - 1];

                const wInp = lastRow.cells[3].querySelector('input');
                const pInp = lastRow.cells[4].querySelector('input');
                const cLabel = lastRow.querySelector('.u-cost-label');
                const saleCheck = lastRow.cells[6].querySelector('input');
                const purCheck = lastRow.cells[7].querySelector('input');
                const bInp = lastRow.cells[8].querySelector('input');

                if (wInp) wInp.value = u.wholesale || 0;
                if (pInp) pInp.value = u.price || 0;
                if (cLabel) cLabel.innerText = (u.cost || 0).toFixed(2);
                if (saleCheck) saleCheck.checked = !!u.isDefaultSale;
                if (purCheck) purCheck.checked = !!u.isDefaultPurchase;
                if (bInp) bInp.value = u.unitBarcode || '';

                if (idx > 0) {
                    if (wInp) wInp.dataset.manual = 'true';
                    if (pInp) pInp.dataset.manual = 'true';
                }
            });
        } else if (typeof addProductUnitRow === 'function') {
            addProductUnitRow('قطعة');
        }
    }

    const quickCheck = document.getElementById('isQuickItem');
    if (quickCheck) quickCheck.checked = !!p.isQuick;

    // تعبئة جدول المقاسات والألوان إن وجدت وتحديث الماتريكس الذكية
    const vBody = document.getElementById('productVariantsTableBody');
    if (vBody) {
        vBody.innerHTML = '';
        window.initialModalVariants = [];
        let hasApparelSizes = false;
        if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
            const baseP = parseFloat(p.price) || 0;
            const baseWs = parseFloat(p.wholesale) || 0;
            const baseCost = parseFloat(p.cost) || 0;

            p.variants.forEach(v => {
                if (v.size && v.size !== 'موحد' && v.size !== 'قياسي' && v.size.trim() !== '') {
                    hasApparelSizes = true;
                }
                let vStockForActiveWH = 0;
                if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[activeWH] !== undefined) {
                    vStockForActiveWH = parseFloat(v.warehouseStocks[activeWH]) || 0;
                } else if (activeWH === 'المخزن الرئيسي' || !v.warehouseStocks) {
                    vStockForActiveWH = parseFloat(v.stock) || 0;
                } else {
                    vStockForActiveWH = 0;
                }

                // الحفاظ على السعر والتكلفة والجملة المحددة لكل مقاس بدقة دون إجبار على التوحيد
                let effectiveVarPrice = (v.price !== undefined && v.price !== null && v.price !== '' && !isNaN(parseFloat(v.price)))
                    ? parseFloat(v.price)
                    : baseP;

                let effectiveVarWs = (v.wholesale !== undefined && v.wholesale !== null && v.wholesale !== '' && !isNaN(parseFloat(v.wholesale)))
                    ? parseFloat(v.wholesale)
                    : baseWs;

                let effectiveVarCost = (v.cost !== undefined && v.cost !== null && v.cost !== '' && !isNaN(parseFloat(v.cost)))
                    ? parseFloat(v.cost)
                    : baseCost;

                window.initialModalVariants.push({
                    size: v.size,
                    color: v.color,
                    barcode: v.barcode,
                    stock: vStockForActiveWH,
                    price: effectiveVarPrice,
                    wholesale: effectiveVarWs,
                    cost: effectiveVarCost
                });
                addVariantRow(v.size, v.color, v.barcode, vStockForActiveWH, effectiveVarPrice, effectiveVarWs, effectiveVarCost);
            });
        }
        updateVariantsCountBadge();

        if (typeof setVariantPickerMode === 'function') {
            setVariantPickerMode(hasApparelSizes ? 'apparel' : (p.variants && p.variants.length > 0 ? 'colorsOnly' : 'apparel'));
        }

        if (typeof toggleVariantsViewMode === 'function') {
            toggleVariantsViewMode('matrix');
        } else if (typeof renderSmartMatrixView === 'function') {
            renderSmartMatrixView();
        }
    }

    if (typeof calculateUnitPrices === 'function') calculateUnitPrices();
    if (typeof renderProductWarehouseStocksTable === 'function') renderProductWarehouseStocksTable(p);
    updateProductNavCounter();
    if (typeof window.updateVariantPriceSyncUI === 'function') window.updateVariantPriceSyncUI();
}

// عرض توزيع الرصيد على المخازن والفروع المسجلة
window.renderProductWarehouseStocksTable = function(p) {
    const tbody = document.getElementById('productWarehouseStocksBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const whList = (window.warehouses && Array.isArray(window.warehouses) && window.warehouses.length > 0)
        ? window.warehouses
        : [{ name: 'المخزن الرئيسي' }];

    const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName)
        ? currentUser.warehouseName
        : 'المخزن الرئيسي';

    whList.forEach(w => {
        const whName = typeof w === 'string' ? w : (w.name || 'المخزن الرئيسي');
        let stockInWh = 0;
        if (p && p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
            stockInWh = p.variants.reduce((sum, v) => {
                const q = (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[whName] !== undefined)
                    ? parseFloat(v.warehouseStocks[whName])
                    : (whName === 'المخزن الرئيسي' ? parseFloat(v.stock) || 0 : 0);
                return sum + (isNaN(q) ? 0 : q);
            }, 0);
        } else if (p && p.warehouseStocks && typeof p.warehouseStocks === 'object' && p.warehouseStocks[whName] !== undefined) {
            stockInWh = parseFloat(p.warehouseStocks[whName]) || 0;
        } else if (p && whName === 'المخزن الرئيسي') {
            stockInWh = parseFloat(p.stock) || 0;
        }

        const isActive = whName === activeWH;
        const tr = document.createElement('tr');
        tr.style.background = isActive ? '#f0fdf4' : 'transparent';
        tr.innerHTML = `
            <td style="padding: 8px 10px; text-align: right; font-weight: 800; color: #1e293b;">
                ${isActive ? '⭐ ' : '🏢 '} ${whName} ${isActive ? '<span style="font-size: 0.72rem; color: #047857; background: #dcfce7; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">(الفرع النشط)</span>' : ''}
            </td>
            <td style="padding: 8px 10px; font-weight: 900; font-size: 0.95rem; color: ${stockInWh > 0 ? '#047857' : '#94a3b8'};">
                ${stockInWh}
            </td>
            <td style="padding: 8px 10px;">
                ${stockInWh > 0 
                    ? '<span style="color: #047857; font-weight: 800; font-size: 0.78rem;">متوفر ✅</span>' 
                    : '<span style="color: #ef4444; font-weight: 800; font-size: 0.78rem;">نفذ ⚠️</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// توليد باركود دولي فريد تلقائياً للصنف الرئيسي مع حماية من التغيير العرضي
window.generateMainProductBarcode = function(force = false) {
    const inp = document.getElementById('newItemBarcode');
    if (!inp) return;
    const currentVal = inp.value.trim();
    if (currentVal && !force) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'warning',
                titleText: '⚠️ تنبيه: الصنف لديه باركود بالفعل',
                msg: `الصنف مسجل له باركود بالفعل (${currentVal})، هل أنت متأكد من رغبتك في تغييره وإعادة توليد باركود جديد؟`,
                confirmText: 'نعم، تغيير وتوليد جديد',
                cancelText: 'إلغاء والاحتفاظ بالباركود الحالي',
                showCancel: true,
                onConfirm: () => window.generateMainProductBarcode(true)
            });
            return;
        }
    }
    const sysCode = document.getElementById('newItemSysCode')?.value || String(Date.now()).slice(-6);
    const cleanSys = String(sysCode).replace(/\D/g, '').slice(-5) || '10001';
    const rand = Math.floor(1000 + Math.random() * 9000);
    const barcode = `20${cleanSys}${rand}`.slice(0, 13);
    inp.value = barcode;
    if (typeof showToast === 'function') showToast(`⚡ تم توليد باركود فريد: ${barcode}`, 'success');
};

// وظيفة إدخال أو مسح باركود دولي يدوي مع حماية من التعديل العرضي
window.promptManualBarcodeEntry = async function(force = false) {
    const inp = document.getElementById('newItemBarcode');
    if (!inp) return;
    const currentVal = inp.value.trim();
    if (currentVal && !force) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'warning',
                titleText: '⚠️ تنبيه: الصنف لديه باركود بالفعل',
                msg: `الصنف مسجل له باركود بالفعل (${currentVal})، هل أنت متأكد من رغبتك في استبداله بباركود جديد؟`,
                confirmText: 'نعم، إدخال باركود جديد',
                cancelText: 'إلغاء والاحتفاظ بالباركود الحالي',
                showCancel: true,
                onConfirm: () => window.promptManualBarcodeEntry(true)
            });
            return;
        }
    }
    
    let entered = null;
    if (typeof showCustomPrompt === 'function') {
        entered = await showCustomPrompt('📷 يرجى تمرير الاسكانر لقراءة باركود الصنف أو كتابته يدوياً:', currentVal || '', 'text');
    } else {
        entered = prompt('📷 يرجى مسح الباركود بجهاز الاسكانر أو كتابته يدوياً:', currentVal || '');
    }

    if (entered !== null && entered !== undefined) {
        const clean = String(entered).trim();
        if (clean) {
            inp.value = clean;
            if (typeof showToast === 'function') showToast(`✅ تم تعيين الباركود بنجاح: ${clean}`, 'success');
        }
    }
};

// وظيفة نسخ محتوى الحقل بنقرة واحدة
window.copyFieldContent = function(elementId, labelName = 'الكود') {
    const el = document.getElementById(elementId);
    if (!el || !el.value.trim()) {
        if (typeof showToast === 'function') showToast(`⚠️ لا يوجد ${labelName} لنسخه!`, 'warning');
        return;
    }
    const val = el.value.trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(() => {
            if (typeof showToast === 'function') showToast(`📋 تم نسخ ${labelName}: ${val} بنجاح!`, 'success');
        }).catch(() => {
            el.select();
            document.execCommand('copy');
            if (typeof showToast === 'function') showToast(`📋 تم نسخ ${labelName} بنجاح!`, 'success');
        });
    } else {
        el.select();
        document.execCommand('copy');
        if (typeof showToast === 'function') showToast(`📋 تم نسخ ${labelName} بنجاح!`, 'success');
    }
};

// وظيفة إظهار/إخفاء شروحات علامة الاستفهام
window.toggleFieldHelp = function(helpBoxId) {
    const box = document.getElementById(helpBoxId);
    if (!box) return;
    box.classList.toggle('hidden');
};

// طباعة تيكت الباركود مباشرة من كارت الصنف
window.printCurrentProductBarcodeDirect = function() {
    const name = document.getElementById('newItemName')?.value || 'صنف جديد';
    const barcode = document.getElementById('newItemBarcode')?.value || document.getElementById('newItemSysCode')?.value || '2000000000001';
    const price = parseFloat(document.getElementById('newItemPrice')?.value) || 0;
    const brand = document.getElementById('newItemBrand')?.value || '';

    // إذا كان الموديل يحتوي على مقاسات وألوان مسجلة في جدول التشكيلات
    const vRows = document.getElementById('productVariantsTableBody')?.rows || [];
    if (vRows.length > 0 && typeof window.printProductVariantHangtags === 'function') {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'question',
                titleText: '🏷️ خيارات طباعة التيكت',
                msg: `يحتوي هذا الصنف على (${vRows.length}) تشكيلة مقاس ولون مسجلة.<br>هل ترغب في طباعة تيكتات كافة المقاسات والألوان أم باركود الموديل العام فقط؟`,
                confirmText: 'طباعة تيكتات المقاسات والألوان',
                cancelText: 'طباعة باركود الموديل العام فقط',
                showCancel: true,
                onConfirm: () => {
                    window.printProductVariantHangtags();
                },
                onCancel: () => {
                    const labelItem = {
                        name: name,
                        barcode: barcode,
                        price: price,
                        brand: brand,
                        copies: 1
                    };
                    if (typeof executePrinting === 'function') {
                        executePrinting([labelItem], 1);
                    }
                }
            });
            return;
        }
    }

    const labelItem = {
        name: name,
        barcode: barcode,
        price: price,
        brand: brand,
        copies: 1
    };

    if (typeof executePrinting === 'function') {
        executePrinting([labelItem], 1);
    } else if (typeof printHangtagSingleItem === 'function') {
        printHangtagSingleItem(labelItem);
    }
};

// =========================================================================
// 👕 دوال إدارة المقاسات والألوان وتوليد الباركودات الذكي (Variant Matrix Logic)
// =========================================================================

// =========================================================================
// 📸 ضغط وتصغير صور الأصناف تلقائياً (Smart Image Compression for Low RAM/DB)
// =========================================================================
window.handleProductImage = function(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const rawData = e.target.result;
        const img = new Image();
        img.onload = function() {
            try {
                const maxDim = 400; // أبعاد قصوى ممتازة للوضوح والطباعة بحجم خفيف جداً
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, w, h);
                // ضغط الصورة إلى JPEG عالي النقاء بحجم 25-45KB فقط
                const compressedData = canvas.toDataURL('image/jpeg', 0.82);
                applyCompressedImageData(compressedData);
            } catch(err) {
                applyCompressedImageData(rawData);
            }
        };
        img.onerror = function() {
            applyCompressedImageData(rawData);
        };
        img.src = rawData;
    };
    reader.readAsDataURL(file);

    function applyCompressedImageData(finalData) {
        const preview = document.getElementById('productImagePreview');
        const removeBtn = document.getElementById('removeProductImageBtn');
        window.currentProductImageData = finalData;
        window.productImageRemoved = false;
        if (typeof currentProductImageData !== 'undefined') currentProductImageData = finalData;
        if (preview) {
            preview.dataset.image = finalData;
            preview.dataset.removed = 'false';
            preview.style.backgroundImage = `url(${finalData})`;
            Array.from(preview.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) node.textContent = '';
            });
        }
        if (removeBtn) {
            removeBtn.classList.remove('hidden');
            removeBtn.style.display = 'flex';
        }
    }
};
