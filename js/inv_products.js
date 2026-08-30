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

    const sysCode = document.getElementById('newItemSysCode').value;
    const barcode = document.getElementById('newItemBarcode').value;
    const code = document.getElementById('newItemCode').value;
    const scalePlu = document.getElementById('newItemScalePlu')?.value?.trim() || '';
    const category = document.getElementById('newItemCategory').value;
    const brand = document.getElementById('newItemBrand')?.value?.trim() || '';
    const supplier = document.getElementById('newItemSupplier')?.value?.trim() || '';
    const shelf = document.getElementById('newItemShelf').value;

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

            variants.push({
                size: vSize,
                color: vColor,
                barcode: vBarcode,
                stock: vTotalStock,
                warehouseStocks: vWarehouseStocks,
                price: priceInp ? parseFloat(priceInp.value) || price : price,
                wholesale: wsInp ? parseFloat(wsInp.value) || wholesale : wholesale,
                cost: costInp ? parseFloat(costInp.value) || cost : cost
            });
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
        if (typeof saveData === 'function') saveData();
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
    const newItem = {
        ...(existingProduct || {}),
        id: finalId,
        sysCode: sysCode || String(finalId),
        scalePlu: scalePlu,
        name, price, cost, wholesale, minPrice, discount,
        barcode, code, category, brand, supplier, shelf,
        stock, minStock, expiry, notes,
        units,
        variants,
        warehouseStocks,
        unit: units.length > 0 ? units[0].unitName : "قطعة",
        image: typeof currentProductImageData !== 'undefined' ? currentProductImageData : (existingProduct ? existingProduct.image : null),
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
        window.currentEditingProductId = null;
        if (document.getElementById('newItemName')) document.getElementById('newItemName').value = "";
        if (document.getElementById('newItemPrice')) document.getElementById('newItemPrice').value = "0";
        document.getElementById('newItemName')?.focus();
        if (typeof updateProductNavCounter === 'function') updateProductNavCounter();
    } else if (mode === 'duplicate') {
        window.currentEditingProductId = null;
        document.getElementById('newItemName')?.focus();
        alert("تم الحفظ، يمكنك تعديل الاسم الآن للتكرار.");
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
            preview.innerText = '';
            window.currentProductImageData = p.image;
            if (removeBtn) removeBtn.classList.remove('hidden');
        } else {
            preview.style.backgroundImage = 'none';
            preview.innerText = '📷';
            window.currentProductImageData = null;
            if (removeBtn) removeBtn.classList.add('hidden');
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
    } else {
        currentWhStock = parseFloat(p.stock) || 0;
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
            p.variants.forEach(v => {
                if (v.size && v.size !== 'موحد' && v.size !== 'قياسي' && v.size.trim() !== '') {
                    hasApparelSizes = true;
                }
                let vStockForActiveWH = 0;
                if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[activeWH] !== undefined) {
                    vStockForActiveWH = parseFloat(v.warehouseStocks[activeWH]) || 0;
                } else {
                    vStockForActiveWH = parseFloat(v.stock) || 0;
                }
                window.initialModalVariants.push({
                    size: v.size,
                    color: v.color,
                    barcode: v.barcode,
                    stock: vStockForActiveWH,
                    price: v.price,
                    wholesale: v.wholesale,
                    cost: v.cost
                });
                addVariantRow(v.size, v.color, v.barcode, vStockForActiveWH, v.price, v.wholesale, v.cost);
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

// توليد باركود دولي فريد تلقائياً للصنف الرئيسي
window.generateMainProductBarcode = function() {
    const sysCode = document.getElementById('newItemSysCode')?.value || String(Date.now()).slice(-6);
    const cleanSys = String(sysCode).replace(/\D/g, '').slice(-5) || '10001';
    const rand = Math.floor(1000 + Math.random() * 9000);
    const barcode = `20${cleanSys}${rand}`.slice(0, 13);
    const inp = document.getElementById('newItemBarcode');
    if (inp) {
        inp.value = barcode;
        if (typeof showToast === 'function') showToast(`⚡ تم توليد باركود فريد: ${barcode}`, 'success');
    }
};

// طباعة تيكت الباركود مباشرة من كارت الصنف
window.printCurrentProductBarcodeDirect = function() {
    const name = document.getElementById('newItemName')?.value || 'صنف جديد';
    const barcode = document.getElementById('newItemBarcode')?.value || document.getElementById('newItemSysCode')?.value || '2000000000001';
    const price = parseFloat(document.getElementById('newItemPrice')?.value) || 0;
    const brand = document.getElementById('newItemBrand')?.value || '';

    const labelItem = {
        name: name,
        barcode: barcode,
        price: price,
        brand: brand
    };

    if (typeof printHangtagSingleItem === 'function') {
        printHangtagSingleItem(labelItem);
    } else {
        const printWindow = window.open('', '_blank', 'width=380,height=420');
        if (!printWindow) return alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="utf-8">
                <title>طباعة تيكت - ${name}</title>
                <style>
                    body { font-family: 'Cairo', sans-serif; text-align: center; padding: 12px; margin: 0; }
                    .tag-card { border: 1.5px dashed #000; padding: 14px; border-radius: 10px; width: 220px; margin: auto; }
                    .brand { font-size: 11px; font-weight: bold; color: #444; }
                    .name { font-size: 13px; font-weight: 900; margin: 4px 0; }
                    .price { font-size: 16px; font-weight: 900; margin: 6px 0; color: #000; }
                    .barcode-lines { font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px; }
                    .barcode-num { font-family: monospace; font-size: 13px; font-weight: bold; margin-top: 3px; }
                </style>
            </head>
            <body>
                <div class="tag-card">
                    ${brand ? `<div class="brand">🏷️ ${brand}</div>` : ''}
                    <div class="name">${name}</div>
                    <div class="price">${price.toFixed(2)} ج.م</div>
                    <div class="barcode-lines">|||||||||||||||||||</div>
                    <div class="barcode-num">${barcode}</div>
                </div>
                <script>
                    window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
};

// =========================================================================
// 👕 دوال إدارة المقاسات والألوان وتوليد الباركودات الذكي (Variant Matrix Logic)
// =========================================================================
