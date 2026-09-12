// ============================================================
//  التحويلات بين المخازن والفروع (Warehouse Transfers Engine)
// ============================================================
window.transferItemsBatch = window.transferItemsBatch || [];
var transferItemsBatch = window.transferItemsBatch;

        window.getTransferPriceType = function() {
            let tType = null;
            if (typeof getStore === 'function') {
                tType = getStore('transferPriceType');
            }
            if (!tType) {
                try {
                    const settingsObj = JSON.parse((typeof getStore === 'function' ? getStore('pos_settings') : null) || '{}');
                    tType = settingsObj.transferPriceType;
                } catch(e) {}
            }
            return tType || 'cost';
        };

        window.getTransferPriceLabel = function() {
            const priceType = window.getTransferPriceType();
            if (priceType === 'retail') return 'سعر التحويل (قطاعي)';
            if (priceType === 'wholesale') return 'سعر التحويل (جملة)';
            return 'سعر التحويل (التكلفة)';
        };

        window.getEffectiveTransferPrice = function(product, variant = null, unit = null) {
            if (!product) return 0;
            const priceType = window.getTransferPriceType();
            const factor = (unit && unit.factor) ? parseFloat(unit.factor) : 1;

            let price = 0;
            if (variant) {
                if (priceType === 'retail') {
                    price = parseFloat(variant.price) || parseFloat(product.price) || 0;
                } else if (priceType === 'wholesale') {
                    price = parseFloat(variant.wholesale) || parseFloat(variant.wholesalePrice) || parseFloat(product.wholesale) || parseFloat(product.wholesalePrice) || parseFloat(variant.price) || parseFloat(product.price) || 0;
                } else {
                    // cost (افتراضي)
                    price = parseFloat(variant.cost) || parseFloat(product.cost) || 0;
                }
            } else {
                if (priceType === 'retail') {
                    price = (unit && unit.price !== undefined && parseFloat(unit.price) > 0) ? parseFloat(unit.price) : (parseFloat(product.price) || 0);
                } else if (priceType === 'wholesale') {
                    price = (unit && unit.wholesale !== undefined && parseFloat(unit.wholesale) > 0) ? parseFloat(unit.wholesale) : (parseFloat(product.wholesale) || parseFloat(product.wholesalePrice) || parseFloat(product.price) || 0);
                } else {
                    // cost (افتراضي)
                    price = (unit && unit.cost !== undefined && parseFloat(unit.cost) > 0) ? parseFloat(unit.cost) : (parseFloat(product.cost) || 0);
                }
            }

            if (unit && factor > 1 && priceType !== 'cost' && (!unit.price || unit.price === product.price)) {
                price = price * factor;
            }
            return parseFloat(price) || 0;
        };

        window.openTransferModal = function(isEdit = false) {
            if (typeof checkPermission === 'function' && !checkPermission('stock_transfer')) return;

            if (!isEdit) {
                window.transferItemsBatch = [];
                transferItemsBatch = window.transferItemsBatch;
            }

            const tbody = document.getElementById('transferTableBody');

            if (tbody) tbody.innerHTML = '';

            // تهيئة التاريخ والوقت تلقائياً
            if (!isEdit) {
                if (document.getElementById('transferDate')) {
                    document.getElementById('transferDate').value = new Date().toLocaleDateString('en-CA');
                }
                if (document.getElementById('transferTime')) {
                    document.getElementById('transferTime').value = new Date().toTimeString().slice(0, 5);
                }
                if (document.getElementById('transferNotes')) {
                    document.getElementById('transferNotes').value = '';
                }
            } else {
                if (document.getElementById('transferDate') && editingOriginalDate && editingOriginalDate.iso) {
                    document.getElementById('transferDate').value = editingOriginalDate.iso;
                }
                if (document.getElementById('transferTime') && editingOriginalDate && editingOriginalDate.time) {
                    document.getElementById('transferTime').value = editingOriginalDate.time;
                }
            }

            // حساب إجمالي المخزون في كل الفروع

            const totalStock = productsDB.reduce((acc, p) => acc + (parseFloat(p.stock) || 0), 0);

            const totalValue = productsDB.reduce((acc, p) => acc + ((parseFloat(p.stock) || 0) * (parseFloat(p.cost) || 0)), 0);

            const stockCountElem = document.getElementById('allWhStockCount');
            const stockValueElem = document.getElementById('allWhStockValue');

            if (stockCountElem) stockCountElem.innerText = `${totalStock.toLocaleString()} قطعة`;
            if (stockValueElem) stockValueElem.innerText = `${totalValue.toLocaleString()} ج.م`;

            document.getElementById('transferModal').classList.remove('hidden');

            // 1. جمع الأصناف فقط إذا تم تحديد مربعات صح (Checkbox) صريحة في جدول المخزن
            const checkedBoxes = document.querySelectorAll('.inv-row-check:checked');
            if (!isEdit && checkedBoxes.length > 0) {
                if (!window.transferItemsBatch) window.transferItemsBatch = [];
                checkedBoxes.forEach(chk => {
                    const tr = chk.closest('tr');
                    const pId = tr ? tr.getAttribute('data-id') : null;
                    const product = pId ? productsDB.find(p => p.id == pId) : null;
                    if (product && !window.transferItemsBatch.some(item => item.id == product.id)) {
                        window.transferItemsBatch.push({ 
                            id: product.id, 
                            name: product.name, 
                            stock: product.stock, 
                            sourceStock: product.stock,
                            qty: 1, 
                            price: window.getEffectiveTransferPrice(product),
                            unitName: product.unit || 'قطعة',
                            unitFactor: 1
                        });
                    }
                });
                transferItemsBatch = window.transferItemsBatch;
            }

            // 2. تصفير مربع البحث وحقول الهيدر بالكامل
            const pSearch = document.getElementById('transferProductSearch');
            if (pSearch) pSearch.value = '';

            const searchResults = document.getElementById('transferSearchResults');
            if (searchResults) {
                searchResults.innerHTML = '';
                searchResults.classList.add('hidden');
            }

            if (document.getElementById('transferSize')) document.getElementById('transferSize').value = '';
            if (document.getElementById('transferColor')) document.getElementById('transferColor').value = '';
            if (document.getElementById('transferQty')) document.getElementById('transferQty').value = '1';
            if (document.getElementById('transferPrice')) document.getElementById('transferPrice').value = '';
            selectedTransferProductId = null;
            currentTransferHeaderUnit = null;
            window._pendingTransferVariant = null;

            // 3. تعبئة قائمة المخازن
            const wFrom = document.getElementById('transferFrom');

            if (wFrom) {

                wFrom.innerHTML = '';

                const whList = (typeof warehouses !== 'undefined' && Array.isArray(warehouses)) ? warehouses : (window.warehouses || []);

                whList.forEach(w => {

                    if (w && w.name) {
                        wFrom.innerHTML += `<option value="${w.name}">${w.name}</option>`;
                    }

                });

                updateTransferToList();

            }

            renderTransferTable();

            // تطبيق تخصيص الأعمدة فور الفتح

            applyTransferColVisibility();

            document.getElementById('transferModal').classList.remove('hidden');

            // تركيز تلقائي على أول خانة كمية لسرعة الإنجاز

            setTimeout(() => {

                const firstQty = document.querySelector('#transferBatchTableBody input');

                if (firstQty) firstQty.focus();

            }, 300);

        }

        window.closeTransferModal = function() {
            document.getElementById('transferModal').classList.add('hidden');

            // إعادة ضبط وضع التعديل وتفريغ القائمة بالكامل
            isEditMode = false;
            editingInvoiceId = null;
            editingOriginalDate = null;
            editingInvoiceType = null;
            window.transferItemsBatch = [];
            transferItemsBatch = window.transferItemsBatch;

            const pSearch = document.getElementById('transferProductSearch');
            if (pSearch) pSearch.value = '';
            const searchResults = document.getElementById('transferSearchResults');
            if (searchResults) {
                searchResults.innerHTML = '';
                searchResults.classList.add('hidden');
            }
            if (document.getElementById('transferSize')) document.getElementById('transferSize').value = '';
            if (document.getElementById('transferColor')) document.getElementById('transferColor').value = '';
            if (document.getElementById('transferQty')) document.getElementById('transferQty').value = '1';
            if (document.getElementById('transferPrice')) document.getElementById('transferPrice').value = '';
            if (document.getElementById('transferNotes')) document.getElementById('transferNotes').value = '';
            selectedTransferProductId = null;
            currentTransferHeaderUnit = null;
            window._pendingTransferVariant = null;

            renderTransferTable();
        }

        let currentTransferHeaderUnit = null;

        window.fillTransferHeaderWithUnit = function(product, unit) {

            selectedTransferProductId = product.id;

            currentTransferHeaderUnit = unit;

            document.getElementById('transferProductSearch').value = product.name;

            // تحديث مربع الإجمالي ليظهر مجموع المخزنين المختارين حالياً للصنف

            const wFrom = document.getElementById('transferFrom').value;

            const wTo = document.getElementById('transferTo').value;

            if (typeof getWarehouseStock === 'function') {

                const s1 = getWarehouseStock(product.name, wFrom);

                const s2 = getWarehouseStock(product.name, wTo);

                const total = s1 + s2;

                const stockElem = document.getElementById('allWhStockCount');

                if (stockElem) stockElem.innerText = `${total.toFixed(2)} ${unit.unitName}`;

            }

            const priceInput = document.getElementById('transferPrice');

            if (priceInput) {

                priceInput.value = window.getEffectiveTransferPrice(product, null, unit).toFixed(2);

            }

            document.getElementById('transferQty').focus();

            document.getElementById('transferQty').select();

        }

        window.showCombinedStock = function() {

            if (!selectedTransferProductId) {

                return showToast("🔍 يرجى البحث عن صنف أولاً لعرض أرصدته في المخازن", "info");

            }

            const p = productsDB.find(x => x.id == selectedTransferProductId);

            if (!p) return;

            const unitName = currentTransferHeaderUnit ? currentTransferHeaderUnit.unitName : (p.unit || 'قطعة');

            const factor = currentTransferHeaderUnit ? parseFloat(currentTransferHeaderUnit.factor) : 1;

            if (typeof getWarehouseStock === 'function') {

                let whRows = '';

                let grandTotal = 0;

                warehouses.forEach(wh => {

                    const stock = getWarehouseStock(p.name, wh.name) / factor;

                    grandTotal += stock;

                    whRows += `

                        <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-family: 'Segoe UI', Tahoma, sans-serif;">

                            <span style="font-weight:700; color:#475569;">🏢 ${wh.name}:</span>

                            <span style="color:#4f46e5; font-weight:900; background: #eef2ff; padding: 2px 10px; border-radius: 8px;">${stock.toFixed(2)} ${unitName}</span>

                        </div>

                    `;

                });

                showCustomAlert({

                    type: 'info',

                    titleText: `📊 تفاصيل الأرصدة: ${p.name}`,

                    msg: `

                        <div style="text-align:right; max-height: 350px; overflow-y: auto; padding-right: 5px;">

                            ${whRows}

                            <div style="display:flex; justify-content:space-between; padding: 15px; margin-top: 15px; border: 2px solid #e0e7ff; background: #f8fafc; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">

                                <span style="font-weight:900; color:#1e1b4b;">🌍 الإجمالي في كل المخازن:</span>

                                <span style="color:#4338ca; font-weight:900; font-size:1.2rem;">${grandTotal.toFixed(2)} ${unitName}</span>

                            </div>

                        </div>

                    `,

                    confirmText: 'فهمت ✅'

                });

            }

        }

        window.renderTransferTable = function() {
            const tbody = document.getElementById('transferTableBody');
            const emptyState = document.getElementById('transferEmptyState');
            if (!tbody) return;

            // ضمان المزامنة الكاملة لمصفوفة التحويلات
            if (!window.transferItemsBatch) window.transferItemsBatch = [];
            transferItemsBatch = window.transferItemsBatch;

            // تحديث اسم عمود السعر في جدول التحويل حسب الإعدادات
            const thPrice = document.querySelector('.col-tr-price');
            if (thPrice && typeof window.getTransferPriceLabel === 'function') {
                thPrice.innerText = window.getTransferPriceLabel();
            }

            tbody.innerHTML = '';
            let totalVal = 0;
            let itemsCount = window.transferItemsBatch.length;

            if (itemsCount === 0) {
                if (emptyState) emptyState.style.display = 'block';
            } else {
                if (emptyState) emptyState.style.display = 'none';
            }

            const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
            const wFrom = (document.getElementById('transferFrom')?.value || document.getElementById('transferFromWarehouse')?.value || activeWH).trim();

            window.transferItemsBatch.forEach((item, index) => {
                // تحديث الرصيد الفعلي للصنف والتشكيلة في المخزن المحول منه فوراً
                const p = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB.find(prod => prod.id === item.id || prod.name === item.name) : null;
                if (p) {
                    const factor = parseFloat(item.unitFactor) || 1;
                    if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                        const sSize = String(item.size || item.selectedSize || '').trim();
                        const sColor = String(item.color || item.selectedColor || '').trim();
                        const matchedVar = p.variants.find(v => 
                            (String(v.size || '').trim() === sSize) && 
                            (String(v.color || '').trim() === sColor)
                        ) || p.variants.find(v => 
                            (!sSize || String(v.size || '').trim() === sSize) && 
                            (!sColor || String(v.color || '').trim() === sColor)
                        );
                        if (matchedVar) {
                            let srcStock = 0;
                            if (matchedVar.warehouseStocks && typeof matchedVar.warehouseStocks === 'object' && matchedVar.warehouseStocks[wFrom] !== undefined) {
                                srcStock = parseFloat(matchedVar.warehouseStocks[wFrom]) || 0;
                            } else if (wFrom === 'المخزن الرئيسي') {
                                srcStock = parseFloat(matchedVar.stock) || 0;
                            } else {
                                srcStock = 0;
                            }
                            item.stock = srcStock / factor;
                            item.sourceStock = item.stock;
                        } else {
                            item.stock = 0;
                            item.sourceStock = 0;
                        }
                    } else {
                        let srcStock = 0;
                        if (p.warehouseStocks && typeof p.warehouseStocks === 'object' && p.warehouseStocks[wFrom] !== undefined) {
                            srcStock = parseFloat(p.warehouseStocks[wFrom]) || 0;
                        } else if (wFrom === 'المخزن الرئيسي') {
                            srcStock = parseFloat(p.stock) || 0;
                        } else {
                            srcStock = 0;
                        }
                        item.stock = srcStock / factor;
                        item.sourceStock = item.stock;
                    }
                }

                const itemTotal = (item.qty * item.price);
                totalVal += itemTotal;

                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';

                const { sizeElement, colorElement } = (typeof renderVariantSelectElements === 'function')
                    ? renderVariantSelectElements(item, index, 'transfer')
                    : { sizeElement: `<span style="color:#cbd5e1;">-</span>`, colorElement: `<span style="color:#cbd5e1;">-</span>` };

                tr.innerHTML = `

                    <td class="col-tr-name" style="padding: 12px 15px; font-size: 0.95rem; font-weight: bold; color: #1e293b; border-left: 1px solid #e2e8f0; text-align: right;">

                        ${item.name} 

                        <span style="font-size:0.75rem; color:#64748b; font-weight:normal;">(${item.unitName || '---'})</span>

                    </td>

                    <td class="col-tr-size" style="padding: 8px; text-align: center; border-left: 1px solid #e2e8f0;">
                        ${sizeElement}
                    </td>

                    <td class="col-tr-color" style="padding: 8px; text-align: center; border-left: 1px solid #e2e8f0;">
                        ${colorElement}
                    </td>

                    <td class="col-tr-stock" style="padding: 12px; text-align: center; color: #64748b; font-size: 0.9rem; font-weight: bold; border-left: 1px solid #e2e8f0;">${item.stock}</td>

                    <td class="col-tr-qty" style="padding: 12px; border-left: 1px solid #e2e8f0;">

                        <input type="number" value="${item.qty}" min="1" max="${item.stock || 99999}" class="search-input" 

                            style="height: 38px; border-radius: 8px; text-align: center; font-weight: 900; border: 2px solid #e2e8f0; width: 100%;"

                            oninput="window.updateTransferItem(${index}, 'qty', this.value, false, this)"
                            onblur="window.updateTransferItem(${index}, 'qty', this.value, true, this)"
                            onchange="window.updateTransferItem(${index}, 'qty', this.value, true, this)">

                    </td>

                    <td class="col-tr-price" style="padding: 12px; border-left: 1px solid #e2e8f0;">

                        <input type="number" value="${item.price}" class="search-input" 

                            style="height: 38px; border-radius: 8px; text-align: center; color: var(--main-blue); font-weight: 900; border: 2px solid #e2e8f0; width: 100%;"

                            oninput="window.updateTransferItem(${index}, 'price', this.value, false, this)"
                            onblur="window.updateTransferItem(${index}, 'price', this.value, true, this)">

                    </td>

                    <td class="col-tr-total" style="padding: 12px; text-align: center; font-weight: 900; color: #1a4d2e; font-size: 1rem; background: rgba(26, 77, 46, 0.03); border-left: 1px solid #e2e8f0;">

                        ${itemTotal.toFixed(2)}

                    </td>

                    <td class="col-tr-delete" style="padding: 12px; text-align: center;">

                        <button onclick="window.removeTransferItem(${index})" style="background: #fee2e2; border: none; color: #ef4444; width: 35px; height: 35px; border-radius: 10px; cursor: pointer; font-size: 1rem; transition: 0.3s; display: flex; align-items: center; justify-content: center; margin: 0 auto;">🗑️</button>

                    </td>

                `;

                tbody.appendChild(tr);

            });

            // تحديث الإجماليات في الفوتر

            const totalValElem = document.getElementById('transferTotalValue');

            const itemsCountElem = document.getElementById('transferItemsCount');

            if (totalValElem) totalValElem.innerText = totalVal.toFixed(2) + ' ج.م';

            if (itemsCountElem) itemsCountElem.innerText = itemsCount;

            // إعادة تطبيق حالة الأعمدة المخصصة

            applyTransferColVisibility();

        }

        function printTransferNote() {
            const batch = window.transferItemsBatch || [];
            if (batch.length === 0) return showToast("⚠️ القائمة فارغة!", "warning");

            const wFrom = document.getElementById('transferFrom').value;

            const wTo = document.getElementById('transferTo').value;

            const shopName    = document.getElementById('shopName')?.value || 'بـيـان POS';
            const shopAddress = document.getElementById('shopAddress')?.value || '';
            const shopPhone   = document.getElementById('shopPhone1')?.value || '';
            const footerMsg   = document.getElementById('printFooterMsg')?.value || 'شكراً لزيارتكم!';

            let itemsHtml = (window.transferItemsBatch || []).map((item, idx) => {
                const pInfo = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB.find(p => p.id === item.id || p.name === item.name) : null;
                const variants = (pInfo && pInfo.variants && Array.isArray(pInfo.variants)) ? pInfo.variants : [];

                let sSize = item.size || item.selectedSize || '';
                let sColor = item.color || item.selectedColor || '';

                if ((!sSize || sSize === '-') && variants.length === 1) {
                    sSize = variants[0].size || '';
                }
                if ((!sColor || sColor === '-') && variants.length === 1) {
                    sColor = variants[0].color || '';
                }

                const displaySize = (sSize && sSize !== '-') ? sSize : 'عام';
                const displayColor = (sColor && sColor !== '-') ? sColor : 'عام';

                return `
                <tr>
                    <td style="padding: 6px 8px; border: 1px solid #000;">${idx + 1}</td>
                    <td style="text-align:right; padding: 6px 10px; border: 1px solid #000; font-weight:bold;">
                        ${item.name}
                    </td>
                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#047857;">${displaySize}</td>
                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#1d4ed8;">${displayColor}</td>
                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${item.qty} ${item.unitName || ''}</td>
                    <td style="padding: 6px 8px; border: 1px solid #000;">${(parseFloat(item.price) || 0).toFixed(2)}</td>
                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}</td>
                </tr>
                `;
            }).join('');

            const totalValue = (window.transferItemsBatch || []).reduce((acc, item) => acc + (item.qty * item.price), 0);

            const content = `

                <div class="print-container" style="direction:rtl; font-family:Cairo, sans-serif; padding: 20px;">

                    <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">

                        <h1 style="margin:0;">${shopName}</h1>
                        ${shopAddress ? `<div style="font-size:12px; color:#555; margin-top:2px;">${shopAddress}</div>` : ''}
                        ${shopPhone ? `<div style="font-size:12px; color:#555; margin-top:2px;">هاتف: ${shopPhone}</div>` : ''}

                        <h2 style="margin:5px 0; background:#000; color:#fff; display:inline-block; padding:5px 20px; border-radius:5px;">إذن تحويل مخزني</h2>

                    </div>

                    <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-weight:bold;">

                        <div>من مخزن: <span style="text-decoration:underline;">${wFrom}</span></div>

                        <div>إلى مخزن: <span style="text-decoration:underline;">${wTo}</span></div>

                        <div>التاريخ: ${new Date().toLocaleString('ar-EG')}</div>

                    </div>

                    <table style="width:100%; border-collapse:collapse; text-align:center;" border="1">

                        <thead>

                            <tr style="background:#f0f0f0;">

                                <th style="padding: 8px; border: 1px solid #000;">م</th>

                                <th style="padding: 8px; border: 1px solid #000; text-align:right;">الصنف</th>

                                <th style="padding: 8px; border: 1px solid #000;">المقاس</th>

                                <th style="padding: 8px; border: 1px solid #000;">اللون</th>

                                <th style="padding: 8px; border: 1px solid #000;">الكمية</th>

                                <th style="padding: 8px; border: 1px solid #000;">${typeof window.getTransferPriceLabel === 'function' ? window.getTransferPriceLabel() : 'سعر التحويل'}</th>

                                <th style="padding: 8px; border: 1px solid #000;">الإجمالي</th>

                            </tr>

                        </thead>

                        <tbody>${itemsHtml}</tbody>

                        <tfoot>

                            <tr style="font-weight:bold; background:#f0f0f0;">

                                <td colspan="6" style="padding: 8px; border: 1px solid #000;">إجمالي قيمة التحويل</td>

                                <td style="padding: 8px; border: 1px solid #000;">${totalValue.toFixed(2)}</td>

                            </tr>

                        </tfoot>

                    </table>

                    <div style="margin-top:50px; display:flex; justify-content:space-between;">

                        <div style="text-align:center;">توقيع أمين المخزن (المصدر)<br><br>...........................</div>

                        <div style="text-align:center;">توقيع المستلم (الوجهة)<br><br>...........................</div>

                    </div>
                    
                    <div style="text-align:center; margin-top:30px; border-top:1px dashed #000; padding-top:10px; font-size:12px;">
                        <div style="font-weight:bold;">${footerMsg}</div>
                        <div>نظام بيان POS - مبيعات متكامل</div>
                    </div>

                </div>

            `;

            const printArea = document.getElementById('receipt-area');

            if (printArea) {

                printArea.innerHTML = content;

                window.print();

            }

        }

        window.updateTransferTotals = function() {
            const batch = window.transferItemsBatch || [];
            let totalVal = 0;
            batch.forEach(it => {
                totalVal += ((parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0));
            });
            const totalValElem = document.getElementById('transferTotalValue');
            const itemsCountElem = document.getElementById('transferItemsCount');
            if (totalValElem) totalValElem.innerText = totalVal.toFixed(2) + ' ج.م';
            if (itemsCountElem) itemsCountElem.innerText = batch.length;
        };

        window.updateTransferItem = function(index, key, val, isBlur = false, inputElem = null) {
            if (!window.transferItemsBatch) window.transferItemsBatch = [];
            transferItemsBatch = window.transferItemsBatch;
            const item = window.transferItemsBatch[index];
            if (!item) return;

            if (key === 'qty') {
                const rawVal = String(val !== undefined && val !== null ? val : '').trim();
                if (rawVal === '' && !isBlur) {
                    return;
                }

                let numVal = parseFloat(val);
                const avail = parseFloat(item.stock) || 0;
                const fromWh = (document.getElementById('transferFrom')?.value || 'المخزن الرئيسي').trim();

                // 🚨 إذا كان الرصيد المتاح صفر أو الرقم المدخل أكبر من الرصيد المتاح في المخزن المصدر
                if (avail <= 0 || numVal > avail) {
                    if (typeof BayanBarcode !== 'undefined' && typeof BayanBarcode.playBeep === 'function') {
                        BayanBarcode.playBeep(false);
                    }
                    const vDetails = (item.size || item.color) ? ` [${item.size ? 'مقاس: ' + item.size : ''}${item.color ? ' - لون: ' + item.color : ''}]` : '';
                    const availStr = Math.max(0, avail).toFixed(2).replace(/\.00$/, '');
                    if (typeof showToast === 'function') {
                        showToast(`🚫 عذراً، لا يمكن تجاوز الرصيد المتاح! أقصى كمية متاحة للصنف (${item.name}${vDetails}) في [${fromWh}] هي (${availStr}) فقط!`, 'error', 4000);
                    }
                    // إرجاع الكمية إجبارياً للحد الأقصى المتاح أو 0
                    item.qty = avail > 0 ? avail : 0;
                    if (inputElem) inputElem.value = item.qty;
                    renderTransferTable();
                    return;
                }

                // التحقق من الأرقام السالبة أو الصفر أو الحقل الفارغ
                if (isNaN(numVal) || numVal <= 0) {
                    if (isBlur) {
                        item.qty = 1;
                        if (inputElem) inputElem.value = 1;
                        renderTransferTable();
                    }
                    return;
                }

                item.qty = numVal;
                if (isBlur) {
                    renderTransferTable();
                } else {
                    const tbody = document.getElementById('transferTableBody');
                    if (tbody && tbody.children[index]) {
                        const row = tbody.children[index];
                        const totalCell = row.querySelector('.col-tr-total');
                        if (totalCell) {
                            totalCell.innerText = ((item.qty * (parseFloat(item.price) || 0))).toFixed(2);
                        }
                    }
                    window.updateTransferTotals();
                }
                return;
            }

            if (key === 'price') {
                const numPrice = parseFloat(val);
                if (!isNaN(numPrice) && numPrice >= 0) {
                    item.price = numPrice;
                    if (isBlur) {
                        renderTransferTable();
                    } else {
                        const tbody = document.getElementById('transferTableBody');
                        if (tbody && tbody.children[index]) {
                            const row = tbody.children[index];
                            const totalCell = row.querySelector('.col-tr-total');
                            if (totalCell) {
                                totalCell.innerText = (((parseFloat(item.qty) || 0) * item.price)).toFixed(2);
                            }
                        }
                        window.updateTransferTotals();
                    }
                }
                return;
            }

            item[key] = val;
            renderTransferTable();
        };

        window.handleTransferProductSearch = function(query) {

            const resultsDiv = document.getElementById('transferSearchResults');

            if (!resultsDiv) return;

            transferSearchSelectedIndex = -1;

            const queryLower = (query || "").toLowerCase().trim();

            let filtered = [];

            if (!queryLower) {

                // عرض أول 15 صنف عند الضغط على الحقل وهو فارغ

                filtered = productsDB.slice(0, 15);

            } else {

                filtered = productsDB.filter(p => 
                    (p.name && p.name.toLowerCase().includes(queryLower)) || 
                    (p.barcode && String(p.barcode).toLowerCase().includes(queryLower)) ||
                    (p.code && String(p.code).toLowerCase().includes(queryLower)) ||
                    (p.variants && Array.isArray(p.variants) && p.variants.some(v => v.barcode && String(v.barcode).toLowerCase().includes(queryLower)))
                ).slice(0, 15);
            }

            resultsDiv.innerHTML = '';

            resultsDiv.classList.remove('hidden');

            resultsDiv.style.display = 'block'; // التأكيد على الظهور

            if (filtered.length > 0) {

                filtered.forEach(p => {

                    const div = document.createElement('div');

                    div.className = 'transfer-search-card';
                    div.style.cssText = 'padding: 8px 12px; margin-bottom: 6px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #ffffff; cursor: pointer; transition: all 0.2s ease; display: flex; justify-content: space-between; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); box-sizing: border-box; width: 100%; overflow: hidden;';

                    const fromWh = document.getElementById('transferFrom') ? document.getElementById('transferFrom').value : (typeof getStore === 'function' ? getStore('activeWarehouse') : 'المخزن الرئيسي') || 'المخزن الرئيسي';
                    let currentWhStock = 0;
                    if (typeof getWarehouseStock === 'function') {
                        currentWhStock = getWarehouseStock(p.name, fromWh);
                    } else if (p.warehouseStocks && p.warehouseStocks[fromWh] !== undefined) {
                        currentWhStock = parseFloat(p.warehouseStocks[fromWh]) || 0;
                    } else {
                        currentWhStock = parseFloat(p.stock) || 0;
                    }

                    const displayPrice = (typeof window.getEffectiveTransferPrice === 'function')
                        ? window.getEffectiveTransferPrice(p)
                        : (parseFloat(p.price) || 0);

                    const priceBadgeLabel = (typeof window.getTransferPriceLabel === 'function')
                        ? window.getTransferPriceLabel().replace('سعر التحويل ', '').replace(/[()]/g, '')
                        : 'سعر التحويل';

                    const stockColor = currentWhStock <= 0 ? '#ef4444' : (currentWhStock <= 5 ? '#f59e0b' : '#10b981');

                    div.className = 'transfer-search-card';
                    div.style.cssText = 'padding: 10px 14px; margin-bottom: 8px; border-radius: 14px; border: 1.5px solid #e2e8f0; background: #ffffff; cursor: pointer; transition: all 0.2s ease; display: flex; justify-content: space-between; align-items: center; gap: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); box-sizing: border-box; width: 100%;';

                    const safeName = (window.escapeHtml ? window.escapeHtml(p.name) : p.name);
                    const safeCode = (window.escapeHtml ? window.escapeHtml(p.code || p.id) : (p.code || p.id));
                    const safeBarcode = (window.escapeHtml ? window.escapeHtml(p.barcode || '---') : (p.barcode || '---'));

                    div.innerHTML = `
                        <div style="flex: 1; min-width: 180px; text-align: right;">
                            <div style="font-weight: 900; font-size: 1.02rem; color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; line-height: 1.3;">
                                <span style="color: #0284c7; font-size: 1.1rem; flex-shrink: 0;">🏷️</span>
                                <span style="color: #0f172a;">${safeName}</span>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                <span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 0.76rem; font-weight: 800; border: 1px solid #e2e8f0;">
                                    كود: <b style="color: #0284c7; font-family: monospace;">${safeCode}</b>
                                </span>
                                <span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 0.76rem; font-weight: 800; border: 1px solid #e2e8f0;">
                                    باركود: <b style="color: #334155; font-family: monospace;">${safeBarcode}</b>
                                </span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                            <div style="text-align: center; background: ${currentWhStock > 0 ? '#ecfdf5' : '#fef2f2'}; border: 1.5px solid ${currentWhStock > 0 ? '#a7f3d0' : '#fecaca'}; padding: 6px 10px; border-radius: 10px; min-width: 85px;">
                                <div style="font-size: 0.68rem; color: ${currentWhStock > 0 ? '#047857' : '#b91c1c'}; font-weight: 800; white-space: nowrap;">رصيد (${fromWh})</div>
                                <div style="font-weight: 900; font-size: 0.96rem; color: ${stockColor}; line-height: 1.2; white-space: nowrap;">
                                    ${currentWhStock} <span style="font-size: 0.68rem;">${p.unit || 'قطعة'}</span>
                                </div>
                            </div>
                            <div style="text-align: center; background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; padding: 6px 12px; border-radius: 10px; min-width: 90px; box-shadow: 0 3px 8px rgba(2, 132, 199, 0.25);">
                                <div style="font-size: 0.68rem; color: #e0f2fe; font-weight: 800; white-space: nowrap;">${priceBadgeLabel}</div>
                                <div style="font-weight: 900; font-size: 0.96rem; line-height: 1.2; white-space: nowrap;">${displayPrice.toFixed(2)} ج.م</div>
                            </div>
                        </div>
                    `;

                    div.onclick = (e) => {

                        e.preventDefault();

                        e.stopPropagation();

                        window.selectTransferProduct(p.id, p.name);

                    };

                    div.onmouseenter = () => {
                        div.style.background = '#f0f9ff';
                        div.style.borderColor = '#0284c7';
                        div.style.transform = 'translateX(-3px)';
                        div.style.boxShadow = '0 4px 14px rgba(2, 132, 199, 0.15)';
                    };

                    div.onmouseleave = () => {
                        div.style.background = '#ffffff';
                        div.style.borderColor = '#e2e8f0';
                        div.style.transform = 'none';
                        div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)';
                    };

                    resultsDiv.appendChild(div);

                });

            } else {

                const safeQuery = (window.escapeHtml ? window.escapeHtml(query) : query);
                resultsDiv.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;"><div style="font-size:2rem; margin-bottom:10px;">🔍</div>لا توجد نتائج مطابقة لـ "' + safeQuery + '"</div>';

            }

        }

        window.selectTransferProduct = function(id, name) {

            const p = productsDB.find(x => x.id == id);

            if (!p) return;

            document.getElementById('transferSearchResults').classList.add('hidden');

            transferSearchSelectedIndex = -1;

            // إذا كان للصنف تشكيلات مقاسات وألوان، نفتح نافذة المقاس واللون فوراً
            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                if (typeof showVariantSelectionModal === 'function') {
                    showVariantSelectionModal(p, 'transfer');
                    return;
                }
            }

            // إذا كان المنتج له أكثر من وحدة، نفتح نافذة الاختيار

            if (p.units && p.units.length > 1) {

                if (typeof showUnitSelectionModal === 'function') {

                    showUnitSelectionModal(p, 'transfer');

                }

            } else {

                // وحدة واحدة أو لا يوجد

                const defUnit = (p.units && p.units.length > 0) ? p.units[0] : null;

                window.fillTransferHeaderWithUnit(p, defUnit || { unitName: p.unit || 'قطعة', factor: 1, cost: p.cost });

            }

        }

        document.getElementById('transferProductSearch').addEventListener('keydown', function(e) {
            const resultsDiv = document.getElementById('transferSearchResults');
            const items = resultsDiv ? resultsDiv.querySelectorAll('.transfer-search-card, .search-item') : [];

            if (e.key === 'ArrowDown') {
                if (!resultsDiv || resultsDiv.classList.contains('hidden') || items.length === 0) return;
                e.preventDefault();
                transferSearchSelectedIndex = (transferSearchSelectedIndex + 1) % items.length;
                updateTransferSearchSelection(items);
                return;
            } else if (e.key === 'ArrowUp') {
                if (!resultsDiv || resultsDiv.classList.contains('hidden') || items.length === 0) return;
                e.preventDefault();
                transferSearchSelectedIndex = (transferSearchSelectedIndex - 1 + items.length) % items.length;
                updateTransferSearchSelection(items);
                return;
            } else if (e.key === 'Enter') {
                if (typeof window.isBayanRecentScan === 'function' && window.isBayanRecentScan()) {
                    e.preventDefault();
                    e.target.value = '';
                    if (resultsDiv) resultsDiv.classList.add('hidden');
                    return;
                }
                if (transferSearchSelectedIndex > -1 && items.length > 0) {
                    e.preventDefault();
                    items[transferSearchSelectedIndex].click();
                } else {
                    const query = e.target.value.trim();
                    if (query) {
                        // فحص الباركود الدقيق التلقائي فوراً
                        if (typeof window.dispatchSearchBarcode === 'function') {
                            if (window.dispatchSearchBarcode(query, 'transfer')) {
                                e.preventDefault();
                                return;
                            }
                        }

                        // 1. بحث فوري في باركود التشكيلات (Variant Barcode Match)
                        let matchingVariant = null;
                        let match = productsDB.find(p => {
                            if (p.variants && Array.isArray(p.variants)) {
                                const vFound = p.variants.find(v => v.barcode && String(v.barcode).trim() === query);
                                if (vFound) {
                                    matchingVariant = vFound;
                                    return true;
                                }
                            }
                            return false;
                        });

                        if (match && matchingVariant) {
                            e.preventDefault();
                            if (!window.transferItemsBatch) window.transferItemsBatch = [];
                            const vSize = matchingVariant.size || '';
                            const vColor = matchingVariant.color || '';
                            const fromWh = (document.getElementById('transferFrom')?.value || 'المخزن الرئيسي').trim();
                            
                            let currentWhStock = 0;
                            if (matchingVariant.warehouseStocks && typeof matchingVariant.warehouseStocks === 'object' && matchingVariant.warehouseStocks[fromWh] !== undefined) {
                                currentWhStock = parseFloat(matchingVariant.warehouseStocks[fromWh]) || 0;
                            } else if (fromWh === 'المخزن الرئيسي') {
                                currentWhStock = parseFloat(matchingVariant.stock) || 0;
                            } else {
                                currentWhStock = 0;
                            }

                            // التحقق الفوري من الرصيد قبل الإضافة
                            const existing = window.transferItemsBatch.find(it => it.id === match.id && ((it.size || it.selectedSize || '') === vSize) && ((it.color || it.selectedColor || '') === vColor));
                            const currentBatchQty = existing ? (parseFloat(existing.qty) || 0) : 0;

                            if (currentWhStock <= 0 || (currentBatchQty + 1) > currentWhStock) {
                                if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(false);
                                if (typeof showToast === 'function') {
                                    showToast(`🚫 لا يمكن الإضافة: رصيد [${match.name} - مقاس: ${vSize || '-'} لون: ${vColor || '-'}] في (${fromWh}) هو (${currentWhStock}) فقط!`, 'error', 4500);
                                }
                                resultsDiv.classList.add('hidden');
                                e.target.value = '';
                                return;
                            }

                            if (existing) {
                                existing.qty = (parseFloat(existing.qty) || 0) + 1;
                            } else {
                                const vPrice = window.getEffectiveTransferPrice(match, matchingVariant);
                                window.transferItemsBatch.push({
                                    id: match.id,
                                    name: match.name,
                                    code: matchingVariant.barcode || match.code || match.id,
                                    selectedSize: vSize,
                                    selectedColor: vColor,
                                    size: vSize,
                                    color: vColor,
                                    stock: currentWhStock,
                                    sourceStock: currentWhStock,
                                    qty: 1,
                                    price: vPrice,
                                    unitName: match.unit || 'قطعة',
                                    unitFactor: 1
                                });
                            }
                            transferItemsBatch = window.transferItemsBatch;
                            renderTransferTable();
                            resultsDiv.classList.add('hidden');
                            e.target.value = '';
                            if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
                            if (typeof showToast === 'function') showToast(`✅ [تحويل سريع] +1 ${match.name} (مقاس: ${vSize} - لون: ${vColor})`, 'success');
                            return;
                        }

                        // 2. بحث بالباركود الأساسي أو الكود
                        if (!match) {
                            match = productsDB.find(p => (p.barcode && String(p.barcode) === query) || (p.code && String(p.code) === query));
                        }

                        if (match) {
                            e.preventDefault();
                            selectTransferProduct(match.id, match.name);
                        } else if (items.length > 0) {
                            e.preventDefault();
                            items[0].click();
                        } else {
                            if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(false);
                            if (typeof showToast === 'function') showToast(`⚠️ باركود غير مسجل: (${query})`, 'error');
                        }
                    }
                }
            } else if (e.key === 'Escape') {
                resultsDiv.classList.add('hidden');
            }

        });

        function updateTransferSearchSelection(items) {

            items.forEach((item, index) => {

                if (index === transferSearchSelectedIndex) {

                    item.style.background = '#e8f0fe';

                    item.style.borderRight = '4px solid var(--main-blue)';

                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                } else {

                    item.style.background = '';

                    item.style.borderRight = 'none';

                }

            });

        }

        // إغلاق قائمة البحث عند النقر في أي مكان آخر

        document.addEventListener('click', function(e) {

            const resultsDiv = document.getElementById('transferSearchResults');

            const searchInput = document.getElementById('transferProductSearch');

            if (resultsDiv && !resultsDiv.contains(e.target) && e.target !== searchInput) {

                resultsDiv.classList.add('hidden');

            }

        });

        window.addManualTransferItem = function() {
            const pId = selectedTransferProductId;
            const qty = parseFloat(document.getElementById('transferQty').value) || 1;
            const price = parseFloat(document.getElementById('transferPrice').value) || 0;
            const size = document.getElementById('transferSize') ? document.getElementById('transferSize').value.trim() : '';
            const color = document.getElementById('transferColor') ? document.getElementById('transferColor').value.trim() : '';

            if (!pId) return showToast("⚠️ يرجى اختيار صنف أولاً", "warning");

            const product = productsDB.find(p => p.id == pId);
            if (!product) return;

            const wFrom = (document.getElementById('transferFrom')?.value || 'المخزن الرئيسي').trim();
            const factor = currentTransferHeaderUnit ? parseFloat(currentTransferHeaderUnit.factor) : 1;
            const requiredBaseQty = qty * factor;

            // 1. فحص الرصيد الفعلي للمقاس/اللون في المخزن المصدر قبل الإضافة
            let availStock = 0;
            let effVariant = null;

            if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
                if (size || color) {
                    effVariant = product.variants.find(v => 
                        (!size || String(v.size || '').trim() === size) && 
                        (!color || String(v.color || '').trim() === color)
                    );
                } else if (product.variants.length === 1) {
                    effVariant = product.variants[0];
                }
            }

            if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
                if (effVariant) {
                    if (effVariant.warehouseStocks && typeof effVariant.warehouseStocks === 'object' && effVariant.warehouseStocks[wFrom] !== undefined) {
                        availStock = parseFloat(effVariant.warehouseStocks[wFrom]) || 0;
                    } else if (wFrom === 'المخزن الرئيسي') {
                        availStock = parseFloat(effVariant.stock) || 0;
                    } else {
                        availStock = 0;
                    }
                } else {
                    availStock = 0;
                }
            } else {
                if (product.warehouseStocks && typeof product.warehouseStocks === 'object' && product.warehouseStocks[wFrom] !== undefined) {
                    availStock = parseFloat(product.warehouseStocks[wFrom]) || 0;
                } else if (wFrom === 'المخزن الرئيسي') {
                    availStock = parseFloat(product.stock) || 0;
                } else {
                    availStock = 0;
                }
            }

            const availInUnit = (availStock / factor);

            // منع الإضافة فوراً إذا كان الرصيد صفر أو أقل من المطلوب
            if (availStock <= 0 || requiredBaseQty > availStock) {
                const varInfo = effVariant ? ` [مقاس: ${size || '-'} لون: ${color || '-'}]` : '';
                if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(false);
                return showToast(`🚫 لا يمكن الإضافة: رصيد (${product.name}${varInfo}) في [${wFrom}] هو (${availInUnit.toFixed(2).replace(/\.00$/, '')}) فقط!`, 'error', 5000);
            }

            // منع التكرار لنفس الوحدة والمقاس واللون
            const unitName = currentTransferHeaderUnit ? currentTransferHeaderUnit.unitName : (product.unit || 'قطعة');

            if (!window.transferItemsBatch) window.transferItemsBatch = [];
            transferItemsBatch = window.transferItemsBatch;

            const existing = window.transferItemsBatch.find(item => item.id == pId && item.unitName == unitName && (item.size || '') == size && (item.color || '') == color);
            if (existing) {
                if ((existing.qty + qty) * factor > availStock) {
                    return showToast(`🚫 لا يمكن زيادة الكمية: إجمالي المطلوب سيتجاوز الرصيد المتاح (${availInUnit.toFixed(2).replace(/\.00$/, '')}) في [${wFrom}]`, 'error');
                }
                existing.qty += qty;
                renderTransferTable();
                showToast(`✅ تم تحديث كمية (${product.name}) إلى ${existing.qty}`, 'success');

                document.getElementById('transferProductSearch').value = '';
                if (document.getElementById('transferSize')) document.getElementById('transferSize').value = '';
                if (document.getElementById('transferColor')) document.getElementById('transferColor').value = '';
                document.getElementById('transferQty').value = '1';
                document.getElementById('transferPrice').value = '0.00';
                selectedTransferProductId = null;
                currentTransferHeaderUnit = null;
                document.getElementById('transferProductSearch').focus();
                return;
            }

            window.transferItemsBatch.push({
                id: product.id,
                name: product.name,
                size: size,
                color: color,
                stock: availInUnit,
                sourceStock: availInUnit,
                qty: qty,
                price: price,
                unitName: unitName,
                unitFactor: factor
            });
            transferItemsBatch = window.transferItemsBatch;

            renderTransferTable();

            // تصفير البحث والمدخلات بعد الإضافة
            document.getElementById('transferProductSearch').value = '';
            if (document.getElementById('transferSize')) document.getElementById('transferSize').value = '';
            if (document.getElementById('transferColor')) document.getElementById('transferColor').value = '';
            document.getElementById('transferQty').value = '1';
            document.getElementById('transferPrice').value = '0.00';
            selectedTransferProductId = null;
            currentTransferHeaderUnit = null;
            document.getElementById('transferProductSearch').focus();
            if (typeof BayanBarcode !== 'undefined') BayanBarcode.playBeep(true);
            showToast(`✅ تمت إضافة (${product.name}) لقائمة التحويل`, 'success');
        };

        window.removeTransferItem = function(index) {
            if (!window.transferItemsBatch) window.transferItemsBatch = [];
            window.transferItemsBatch.splice(index, 1);
            transferItemsBatch = window.transferItemsBatch;
            renderTransferTable();
        }

        // ----------------------------------------------------
        // 🏭 خاصية الإضافة السريعة لمخزن جديد من شاشة التحويل
        // ----------------------------------------------------
        let _quickAddWarehouseTarget = 'to';

        window.openQuickAddWarehouseModal = function(target = 'to') {
            _quickAddWarehouseTarget = target;
            const modal = document.getElementById('quickWarehouseModal');
            if (!modal) return;

            const nameInput = document.getElementById('quickWhNameInput');
            const addrInput = document.getElementById('quickWhAddressInput');
            if (nameInput) nameInput.value = '';
            if (addrInput) addrInput.value = '';

            modal.classList.remove('hidden');
            setTimeout(() => {
                if (nameInput) nameInput.focus();
            }, 100);
        };

        window.closeQuickAddWarehouseModal = function() {
            const modal = document.getElementById('quickWarehouseModal');
            if (modal) modal.classList.add('hidden');
        };

        window.saveQuickWarehouseFromTransfer = async function() {
            const nameInput = document.getElementById('quickWhNameInput');
            const addrInput = document.getElementById('quickWhAddressInput');
            if (!nameInput) return;

            const name = nameInput.value.trim();
            const address = addrInput ? addrInput.value.trim() : '';

            if (!name) {
                if (typeof showToast === 'function') showToast("يرجى كتابة اسم المخزن أو الفرع الجديد!", "error");
                else alert("يرجى كتابة اسم المخزن الجديد");
                nameInput.focus();
                return;
            }

            if (!Array.isArray(window.warehouses)) {
                window.warehouses = (typeof warehouses !== 'undefined' && Array.isArray(warehouses)) ? warehouses : [];
            }

            // فحص هل الاسم مكرر
            if (window.warehouses.some(w => w && w.name && w.name.trim().toLowerCase() === name.toLowerCase())) {
                if (typeof showToast === 'function') showToast(`اسم المخزن "${name}" مسجل بالفعل!`, "warning");
                else alert(`اسم المخزن "${name}" مسجل بالفعل!`);
                nameInput.focus();
                return;
            }

            const newWh = {
                id: Date.now(),
                name: name,
                address: address || ''
            };

            window.warehouses.push(newWh);
            if (typeof warehouses !== 'undefined') {
                warehouses = window.warehouses;
            }

            // حفظ فوري في قاعدة البيانات
            try {
                if (typeof db !== 'undefined' && db.warehouses) {
                    await db.warehouses.put(newWh);
                }
            } catch (e) {
                console.warn("⚠️ خطأ أثناء حفظ المخزن في db.warehouses:", e);
            }

            // حفظ عام في النظام
            if (typeof saveData === 'function') {
                try { saveData(); } catch (e) {}
            }

            // تحديث شاشات وجداول النظام
            if (typeof renderWarehousesTable === 'function') renderWarehousesTable();
            if (typeof updateSettingsWarehouseSelect === 'function') updateSettingsWarehouseSelect();
            if (typeof window.updateHeaderWarehouseSelect === 'function') window.updateHeaderWarehouseSelect();
            if (typeof renderInventoryTable === 'function') renderInventoryTable();

            // تحديث قوائم التحويل فورياً
            const wFrom = document.getElementById('transferFrom');
            const wTo = document.getElementById('transferTo');
            const previousFromVal = wFrom ? wFrom.value : '';

            if (wFrom) {
                wFrom.innerHTML = '';
                window.warehouses.forEach(w => {
                    wFrom.innerHTML += `<option value="${w.name}">${w.name}</option>`;
                });
                if (_quickAddWarehouseTarget === 'from') {
                    wFrom.value = name;
                } else if (previousFromVal && window.warehouses.some(w => w.name === previousFromVal)) {
                    wFrom.value = previousFromVal;
                }
            }

            if (typeof window.updateTransferToList === 'function') {
                window.updateTransferToList();
            }

            if (wTo && _quickAddWarehouseTarget === 'to') {
                wTo.value = name;
            }

            window.closeQuickAddWarehouseModal();

            if (typeof showToast === 'function') {
                showToast(`تمت إضافة المخزن "${name}" بنجاح وجرى تحديده للتحويل ✅`, "success");
            }

            if (typeof renderTransferTable === 'function') {
                renderTransferTable();
            }
        };

        window.updateTransferToList = function() {

            const wFromVal = document.getElementById('transferFrom').value;

            const wTo = document.getElementById('transferTo');

            if (!wTo) return;

            const prevToVal = wTo.value;

            wTo.innerHTML = '';

            const currentWarehouses = (typeof warehouses !== 'undefined' && Array.isArray(warehouses)) ? warehouses : (window.warehouses || []);

            const filteredWarehouses = currentWarehouses.filter(w => w && w.name !== wFromVal);

            if (filteredWarehouses.length === 0) {
                wTo.innerHTML = '<option value="" disabled selected>⚠️ لا توجد فروع أخرى (اضغط ➕ مخزن جديد)</option>';
            } else {
                filteredWarehouses.forEach(w => {
                    wTo.innerHTML += `<option value="${w.name}">${w.name}</option>`;
                });
                if (prevToVal && filteredWarehouses.some(w => w.name === prevToVal)) {
                    wTo.value = prevToVal;
                }
            }

            renderTransferTable();

        }

        window.processBatchTransfer = async function() {
            if (window.isSavingTransaction) {
                console.warn("⚠️ تم تجاهل ضغطة مكررة أثناء تنفيذ التحويل المخزني.");
                return;
            }

            if (!checkPermission('stock_transfer')) return;

            if (!window.transferItemsBatch) window.transferItemsBatch = [];
            transferItemsBatch = window.transferItemsBatch;

            if (window.transferItemsBatch.length === 0) return showToast("⚠️ قائمة التحويل فارغة!", "error");

            const wFrom = document.getElementById('transferFrom').value;
            const wTo = document.getElementById('transferTo').value;

            if (!wTo || wFrom === wTo) return showToast("🚫 يرجى اختيار مخزن وجهة مختلف عن المصدر", "error");

            showCustomAlert({
                type: 'warning',
                titleText: '⚠️ تأكيد إرسال إذن التحويل',
                msg: `هل أنت متأكد من إرسال إذن تحويل (${window.transferItemsBatch.length}) أصناف من [${wFrom}] إلى [${wTo}]؟\n\nستظل البضاعة مسجلة برصيد [${wFrom}] حتى يقوم أمين المخزن [${wTo}] بتأكيد الاستلام والقبول الفعلي.`,
                showCancel: true,
                confirmText: 'نعم، أرسل إذن التحويل 🚚',
                onConfirm: async () => {
                    if (window.isSavingTransaction) return;
                    window.isSavingTransaction = true;

                    // قفل أزرار نافذة التحويل لمنع التكرار
                    const transferBtns = document.querySelectorAll('#transferModal button');
                    transferBtns.forEach(b => {
                        b.disabled = true;
                        b.style.pointerEvents = 'none';
                        b.style.opacity = '0.6';
                    });

                    try {
                        let processedCount = 0;

                        for (let item of window.transferItemsBatch) {
                            if (item.qty <= 0) continue;

                            const factor = parseFloat(item.unitFactor) || 1;
                            const requiredBaseQty = item.qty * factor;

                            const p = productsDB.find(prod => prod && (prod.name === item.name || prod.id === item.id));
                            
                            const sSize = String(item.size || item.selectedSize || '').trim();
                            const sColor = String(item.color || item.selectedColor || '').trim();
                            let effVariant = null;
                            let availStock = 0;

                            if (p && p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                                // إذا كان الصنف له تشكيلات، ابحث عن التشكيلة المطابقة
                                if (sSize || sColor) {
                                    effVariant = p.variants.find(v => 
                                        (!sSize || String(v.size || '').trim() === sSize) && 
                                        (!sColor || String(v.color || '').trim() === sColor)
                                    );
                                } else if (p.variants.length === 1) {
                                    effVariant = p.variants[0];
                                }
                            }

                            if (p && p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                                if (effVariant) {
                                    // التحقق يعتمد كلياً على رصيد الـ variant المحدد في المخزن المصدر
                                    if (effVariant.warehouseStocks && typeof effVariant.warehouseStocks === 'object' && effVariant.warehouseStocks[wFrom] !== undefined) {
                                        availStock = parseFloat(effVariant.warehouseStocks[wFrom]) || 0;
                                    } else if (wFrom === 'المخزن الرئيسي') {
                                        availStock = parseFloat(effVariant.stock) || 0;
                                    } else {
                                        availStock = 0;
                                    }
                                } else {
                                    // الصنف له تشكيلات لكن المقاس/اللون المختار غير موجود أصلاً في تشكيلات الصنف
                                    availStock = 0;
                                }
                            } else {
                                // الصنف بدون تشكيلات
                                if (p && p.warehouseStocks && typeof p.warehouseStocks === 'object' && p.warehouseStocks[wFrom] !== undefined) {
                                    availStock = parseFloat(p.warehouseStocks[wFrom]) || 0;
                                } else if (wFrom === 'المخزن الرئيسي') {
                                    availStock = p ? (parseFloat(p.stock) || 0) : 0;
                                } else {
                                    availStock = 0;
                                }
                            }

                            if (availStock <= 0 || requiredBaseQty > availStock) {
                                const varInfo = (sSize || sColor) ? ` [${sSize ? 'مقاس: ' + sSize : ''}${sColor ? ' - لون: ' + sColor : ''}]` : '';
                                const availInUnit = (Math.max(0, availStock) / factor).toFixed(2).replace(/\.00$/, '');
                                return alert(`🚫 رصيد غير كافٍ لتحويل الصنف (${item.name}${varInfo}):\nالكمية المطلوبة: ${item.qty} ${item.unitName || ''}\nالرصيد المتاح حالياً لهذا المقاس/اللون في مخزن (${wFrom}): ${availInUnit} ${item.unitName || ''}\n\nيرجى تعديل الكمية أو التشكيلة للمتابعة.`);
                            }
                        }

                        const transId = isEditMode ? editingInvoiceId : ('TR-' + Date.now().toString().slice(-6));

                        const inputDate = document.getElementById('transferDate')?.value || new Date().toLocaleDateString('en-CA');
                        const inputTime = document.getElementById('transferTime')?.value || new Date().toTimeString().slice(0, 5);
                        const transferNotes = document.getElementById('transferNotes')?.value || '';

                        const dt = {
                            full: `${new Date(inputDate).toLocaleDateString('ar-EG')}، ${inputTime}`,
                            iso: inputDate,
                            time: inputTime
                        };

                        if (isEditMode && window.revertAndClearOldInvoice) {
                            await window.revertAndClearOldInvoice(editingInvoiceId, editingInvoiceType);
                        }

                        const totalTransferValue = (window.transferItemsBatch || []).reduce((acc, item) => acc + (parseFloat(item.qty) * parseFloat(item.price)), 0);

                        (window.transferItemsBatch || []).forEach((item, idx) => {
                            if (item.qty > 0) {
                                const factor = parseFloat(item.unitFactor) || 1;
                                const baseQty = (parseFloat(item.qty) || 0) * factor;

                                // ⏳ ملاحظة محاسبية دقيقة: لا يتم خصم رصيد الصنف أو تشكيلاته (المقاس واللون) من المخزن المصدر أثناء حالة الانتظار (pending)
                                // تظل البضاعة مسجلة بكامل رصيدها في كارت الصنف ومصفوفة [wFrom] حتى يقوم المخزن المستلم بتأكيد الاستلام والقبول الفعلي
                                const p = productsDB.find(prod => prod && (prod.name === item.name || prod.id === item.id));

                                const sSize = item.size || item.selectedSize || '';
                                const sColor = item.color || item.selectedColor || '';

                                transactions.push({
                                    invoiceId: transId,
                                    isInvoiceHead: (idx === 0),
                                    date: dt.full,
                                    dateISO: dt.iso,
                                    timeISO: dt.time,
                                    type: 'تحويل مخزني 🚚',
                                    transferStatus: 'pending',
                                    receivedBy: null,
                                    receivedAt: null,
                                    product: item.name,
                                    size: sSize,
                                    color: sColor,
                                    selectedSize: sSize,
                                    selectedColor: sColor,
                                    qty: item.qty,
                                    unit: item.unitName,
                                    unitFactor: factor,
                                    price: item.price,
                                    total: item.qty * item.price,
                                    paidAmount: (idx === 0) ? totalTransferValue : 0,
                                    method: 'تحويل داخلي',
                                    warehouse: wTo,
                                    sourceWarehouse: wFrom,
                                    partner: `${wFrom} -> ${wTo}`,
                                    notes: transferNotes,
                                    user: currentUser ? currentUser.name : '-',
                                    editDate: isEditMode ? new Date().toLocaleString('ar-EG') : '-'
                                });

                                processedCount++;
                            }
                        });

                        if (processedCount > 0) {
                            const newTransferRows = transactions.filter(t => String(t.invoiceId) === String(transId));
                            if (typeof window.saveTransactionChanges === 'function') {
                                await window.saveTransactionChanges({
                                    newTransactions: newTransferRows,
                                    modifiedProducts: [],
                                    modifiedAccounts: []
                                });
                            } else {
                                await saveData();
                            }
                            if (typeof invalidateStockCache === 'function') invalidateStockCache();

                            // إشعار السيرفر المحلي بإذن التحويل الجديد فوراً لساحة الانتظار
                            const sUrl = (window.BayanNetworkHub && window.BayanNetworkHub.serverUrl) ? window.BayanNetworkHub.serverUrl : '';
                            if (sUrl || window.location.protocol.startsWith('http')) {
                                try {
                                    const ep = sUrl ? `${sUrl}/api/transfers/create` : '/api/transfers/create';
                                    fetch(ep, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            id: transId,
                                            invoiceId: transId,
                                            sourceWarehouse: wFrom,
                                            warehouse: wTo,
                                            toWarehouse: wTo,
                                            date: dt.full,
                                            dateISO: dt.iso,
                                            timeISO: dt.time,
                                            transferStatus: 'pending',
                                            itemsCount: processedCount,
                                            totalValue: totalTransferValue,
                                            user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '-'
                                        })
                                    }).catch(() => {});
                                } catch(e) {}
                            }

                            // إعادة ضبط وضع التعديل
                            isEditMode = false;
                            editingInvoiceId = null;
                            editingOriginalDate = null;
                            editingInvoiceType = null;

                            showToast(`✅ تم بنجاح تحويل ( ${processedCount} ) أصناف من [${wFrom}] إلى [${wTo}]`, "success");

                            window.transferItemsBatch = [];
                            transferItemsBatch = window.transferItemsBatch;
                            renderTransferTable();

                            // تفريغ وتصفير حقول الإدخال والبحث بالكامل لضمان فتح شاشة نظيفة وفارغة في المرة القادمة
                            const pSearch = document.getElementById('transferProductSearch');
                            if (pSearch) pSearch.value = '';
                            const searchResults = document.getElementById('transferSearchResults');
                            if (searchResults) {
                                searchResults.innerHTML = '';
                                searchResults.classList.add('hidden');
                            }
                            if (document.getElementById('transferSize')) document.getElementById('transferSize').value = '';
                            if (document.getElementById('transferColor')) document.getElementById('transferColor').value = '';
                            if (document.getElementById('transferQty')) document.getElementById('transferQty').value = '1';
                            if (document.getElementById('transferPrice')) document.getElementById('transferPrice').value = '';
                            if (document.getElementById('transferNotes')) document.getElementById('transferNotes').value = '';
                            selectedTransferProductId = null;
                            currentTransferHeaderUnit = null;
                            window._pendingTransferVariant = null;

                            // إلغاء تحديد الأصناف في جدول المخزن الرئيسي حتى لا تظهر تلقائياً
                            document.querySelectorAll('.inv-row-check:checked').forEach(c => { c.checked = false; });
                            if (window.selectedInventoryIds) window.selectedInventoryIds.clear();
                            if (typeof selectedInventoryId !== 'undefined') selectedInventoryId = null;
                            if (typeof window.selectedInventoryId !== 'undefined') window.selectedInventoryId = null;
                            document.querySelectorAll('#inventoryTableBody tr.selected, #inventoryTableBody tr.active-row').forEach(r => r.classList.remove('selected', 'active-row'));

                            document.getElementById('transferModal').classList.add('hidden');

                            // تحديث كافة الجداول والتقارير المرتبطة
                            if (typeof renderInventoryTable === 'function') renderInventoryTable();
                            if (typeof renderWarehouseReportTable === 'function') renderWarehouseReportTable();
                            if (typeof renderHistoryTable === 'function') renderHistoryTable();
                            if (typeof updateDashboard === 'function') updateDashboard();
                            if (typeof updateInventoryStats === 'function') updateInventoryStats();
                            if (typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();
                            if (typeof updateNotifications === 'function') updateNotifications();
                        }
                    } catch (err) {
                        console.error("Error processing batch transfer:", err);
                        showToast("❌ حدث خطأ أثناء تنفيذ التحويل", "error");
                    } finally {
                        window.isSavingTransaction = false;
                        transferBtns.forEach(b => {
                            b.disabled = false;
                            b.style.pointerEvents = 'auto';
                            b.style.opacity = '1';
                        });
                    }
                }
            });
        }

        // --- تخصيص أعمدة التحويل (Transfer Column Customization) ---

        window.toggleTransferColMenu = function(event) {

            if (event) event.stopPropagation();

            const menu = document.getElementById('transferColMenu');

            if (menu) menu.classList.toggle('hidden');

        }

        window.toggleTransferCol = function(colClass, isVisible) {

            const settings = JSON.parse(getStore('transferColSettings') || '{}');

            settings[colClass] = isVisible;

            setStore('transferColSettings', JSON.stringify(settings));

            applyTransferColVisibility();

        }

        window.applyTransferColVisibility = function() {

            const settings = JSON.parse(getStore('transferColSettings') || '{"col-tr-stock":true,"col-tr-price":true,"col-tr-total":true}');

            Object.keys(settings).forEach(colClass => {

                const isVisible = settings[colClass];

                document.querySelectorAll(`.${colClass}`).forEach(el => {

                    el.style.display = isVisible ? '' : 'none';

                });

                // تحديث حالة الـ Checkbox في القائمة

                const chk = document.querySelector(`#transferColMenu input[onchange*="${colClass}"]`);

                if (chk) chk.checked = isVisible;

            });

        }

        // إغلاق القائمة عند النقر خارجها

        document.addEventListener('click', (event) => {

            const menu = document.getElementById('transferColMenu');

            if (menu && !menu.classList.contains('hidden')) {

                // إذا لم يتم النقر داخل القائمة، قم بإغلاقها

                if (!menu.contains(event.target)) {
                    menu.classList.add('hidden');
                }
            }
        });

        // =========================================================================
        // 🚚 تنبيه فوري واستلام أذونات التحويل الواردة (Live Incoming Transfer Alerts)
        // =========================================================================
        function getAlertedTransfers() {
            try {
                const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'default').trim();
                const raw = sessionStorage.getItem(`bayan_alerted_transfers_${activeWH}`);
                return raw ? JSON.parse(raw) : [];
            } catch(e) { return []; }
        }

        function markTransferAlerted(id) {
            try {
                const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'default').trim();
                const list = getAlertedTransfers();
                if (!list.includes(id)) {
                    list.push(id);
                    sessionStorage.setItem(`bayan_alerted_transfers_${activeWH}`, JSON.stringify(list));
                }
            } catch(e) {}
        }

        window.checkIncomingTransfersAlert = function() {
            if (typeof transactions === 'undefined' || !Array.isArray(transactions)) return;
            if (document.getElementById('incomingTransferApprovalModal')) return; // لا تكرار للنافذة إذا كانت مفتوحة

            // تنظيف أي مفاتيح قديمة كانت متزامنة عبر الذاكرة وتمنع ظهور الإشعار في الأجهزة الأخرى
            try {
                if (typeof window.AppStore !== 'undefined' && window.AppStore.bayan_alerted_transfers) {
                    delete window.AppStore.bayan_alerted_transfers;
                }
            } catch(e) {}

            const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();

            const pendingForThisWH = transactions.filter(t => 
                t.type && t.type.includes('تحويل') && 
                t.transferStatus === 'pending' && 
                (String(t.warehouse || '').trim() === activeWH || String(t.toWarehouse || '').trim() === activeWH)
            );

            const alertedList = getAlertedTransfers();
            const grouped = {};
            pendingForThisWH.forEach(t => {
                const invId = t.invoiceId || 'TR-UNKNOWN';
                if (!grouped[invId]) grouped[invId] = { id: invId, sourceWarehouse: t.sourceWarehouse, warehouse: t.warehouse, items: [] };
                grouped[invId].items.push(t);
            });

            Object.values(grouped).forEach(tr => {
                if (!alertedList.includes(tr.id)) {
                    markTransferAlerted(tr.id);
                    if (typeof BayanBarcode !== 'undefined' && BayanBarcode.playBeep) BayanBarcode.playBeep(true);
                    if (typeof showToast === 'function') {
                        showToast(`🚚 إذن تحويل وارد جديد #${tr.id} من [${tr.sourceWarehouse}]!`, 'info', 6000);
                    }
                    window.showIncomingTransferApprovalModal(tr.id);
                }
            });

            if (typeof updateNotifications === 'function') updateNotifications();
        };

        window.showIncomingTransferApprovalModal = function(invId) {
            if (!invId) return;
            let transItems = (typeof transactions !== 'undefined' && Array.isArray(transactions))
                ? transactions.filter(t => (String(t.invoiceId) === String(invId) || String(t.id) === String(invId)) && t.type && t.type.includes('تحويل') && t.transferStatus === 'pending')
                : [];

            if (transItems.length === 0 && Array.isArray(window.inTransitTransfersCache)) {
                const cachedTr = window.inTransitTransfersCache.find(t => String(t.id) === String(invId) || String(t.invoiceId) === String(invId));
                if (cachedTr && Array.isArray(cachedTr.items) && cachedTr.items.length > 0) {
                    transItems = cachedTr.items.map(it => ({
                        invoiceId: invId,
                        product: it.product,
                        size: it.size,
                        color: it.color,
                        selectedSize: it.size,
                        selectedColor: it.color,
                        qty: it.qty,
                        unit: it.unit || 'قطعة',
                        sourceWarehouse: cachedTr.sourceWarehouse,
                        warehouse: cachedTr.warehouse || cachedTr.toWarehouse
                    }));
                }
            }

            if (transItems.length === 0) return;

            const first = transItems[0];
            const modalId = 'incomingTransferApprovalModal';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.className = 'confirm-modal-overlay';
                modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,0.75); z-index:999999999; display:flex; align-items:center; justify-content:center;';
                document.body.appendChild(modal);
            }

            const itemsHtml = transItems.map((it, idx) => `
                <tr style="border-bottom:1px solid #e2e8f0; ${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
                    <td style="padding:10px 14px; font-weight:bold; color:#0f172a; text-align:right;">${it.product}</td>
                    <td style="padding:10px; text-align:center; color:#047857; font-weight:800;">${(it.selectedSize || it.size) && (it.selectedSize || it.size) !== '-' ? (it.selectedSize || it.size) : 'عام'}</td>
                    <td style="padding:10px; text-align:center; color:#1d4ed8; font-weight:800;">${(it.selectedColor || it.color) && (it.selectedColor || it.color) !== '-' ? (it.selectedColor || it.color) : 'عام'}</td>
                    <td style="padding:10px; text-align:center; font-weight:900; color:#047857; font-size:1.1rem;">${it.qty} <span style="font-size:0.75rem; color:#64748b;">${it.unit || 'قطعة'}</span></td>
                </tr>
            `).join('');

            const totalQty = transItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0);

            modal.innerHTML = `
                <div style="background:#ffffff; padding:28px 24px; border-radius:24px; width:560px; max-width:94%; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.35); border:2.5px solid #059669; direction:rtl; font-family:inherit; position:relative;">
                    <button onclick="document.getElementById('${modalId}').remove()" style="position:absolute; top:16px; left:16px; background:#f1f5f9; border:none; color:#64748b; width:32px; height:32px; border-radius:50%; font-size:1.2rem; cursor:pointer; font-weight:bold;">&times;</button>
                    <div style="font-size:2.8rem; margin-bottom:6px;">🚚✨</div>
                    <h3 style="margin:0 0 6px 0; color:#064e3b; font-size:1.35rem; font-weight:900;">
                        إذن تحويل بضاعة وارد جديد #${invId}
                    </h3>
                    <p style="color:#64748b; font-size:0.92rem; margin-bottom:15px;">
                        تم إرسال بضاعة من <b style="color:#2563eb;">[${first.sourceWarehouse || 'المخزن الرئيسي'}]</b> إلى مخزنك <b style="color:#047857;">[${first.warehouse}]</b>:
                    </p>

                    <div style="max-height:220px; overflow-y:auto; border:1.5px solid #cbd5e1; border-radius:14px; margin-bottom:15px;" class="fast-scrollbar">
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <thead style="background:#f1f5f9; color:#334155; position:sticky; top:0; z-index:1;">
                                <tr>
                                    <th style="padding:8px 14px; text-align:right;">الصنف</th>
                                    <th style="padding:8px; text-align:center;">المقاس</th>
                                    <th style="padding:8px; text-align:center;">اللون</th>
                                    <th style="padding:8px; text-align:center;">الكمية</th>
                                </tr>
                            </thead>
                            <tbody>${itemsHtml}</tbody>
                        </table>
                    </div>

                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; padding:10px 16px; border-radius:12px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:bold; color:#065f46; font-size:0.9rem;">📦 إجمالي القطع الواردة:</span>
                        <span style="font-weight:900; color:#047857; font-size:1.15rem;">${totalQty} قطعة</span>
                    </div>

                    <div style="display:flex; gap:12px; justify-content:center;">
                        <button onclick="document.getElementById('${modalId}').remove(); window.rejectTransferFromNotify('${invId}');" 
                            style="flex:1; background:#fee2e2; color:#b91c1c; border:1.5px solid #fca5a5; padding:12px; border-radius:12px; font-weight:bold; font-size:0.95rem; cursor:pointer; transition:0.2s;">
                            ❌ رفض التحويل
                        </button>
                        <button onclick="document.getElementById('${modalId}').remove(); window.acceptTransferFromNotify('${invId}');" 
                            style="flex:2; background:linear-gradient(135deg, #059669, #047857); color:#ffffff; border:none; padding:12px; border-radius:12px; font-weight:900; font-size:1.05rem; cursor:pointer; box-shadow:0 4px 12px rgba(4,120,87,0.3); transition:0.2s;">
                            ✅ تأكيد واستلام البضاعة بالمخزن
                        </button>
                    </div>
                </div>
            `;
        };

        // =========================================================================
        // 🚚 قبول واستلام أو رفض أذونات التحويل من ساحة الانتظار / الإشعارات
        // =========================================================================
        window.acceptTransferFromNotify = async function(invId) {
            if (!invId) return;
            const transItems = (typeof transactions !== 'undefined' && Array.isArray(transactions))
                ? transactions.filter(t => (String(t.invoiceId) === String(invId) || String(t.id) === String(invId)) && t.type && t.type.includes('تحويل'))
                : [];

            if (transItems.length === 0) {
                if (typeof showToast === 'function') showToast('⚠️ إذن التحويل غير موجود', 'error');
                return;
            }

            const currentStatus = transItems[0].transferStatus || 'pending';
            if (currentStatus === 'received') {
                if (typeof showToast === 'function') showToast('ℹ️ تم استلام وقبول إذن التحويل هذا مسبقاً!', 'info');
                return;
            }
            if (currentStatus === 'rejected') {
                if (typeof showToast === 'function') showToast('⚠️ هذا الإذن تم رفضه مسبقاً ولا يمكن استلامه الآن.', 'warning');
                return;
            }

            const receiverUser = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : 'أمين المخزن';
            const nowFull = new Date().toLocaleString('ar-EG');

            const affectedProducts = [];
            transItems.forEach(item => {
                item.transferStatus = 'received';
                item.receivedBy = receiverUser;
                item.receivedAt = nowFull;

                // 🚚 في لحظة التأكيد والاستلام الفعلي: يتم الخصم من المخزن المصدر والإضافة للمخزن المستلم
                const factor = parseFloat(item.unitFactor) || 1;
                const baseQty = (parseFloat(item.qty) || 0) * factor;
                const wFrom = (item.sourceWarehouse || 'المخزن الرئيسي').trim();
                const wTo = (item.warehouse || '').trim();

                const p = productsDB.find(prod => prod && (prod.name === item.product || prod.id === item.id));
                if (p) {
                    if (!affectedProducts.includes(p)) affectedProducts.push(p);
                    if (!p.warehouseStocks) p.warehouseStocks = {};

                    // 1. خصم الكمية من المخزن المصدر
                    const currentSrcPStock = (p.warehouseStocks[wFrom] !== undefined && !isNaN(parseFloat(p.warehouseStocks[wFrom])))
                        ? parseFloat(p.warehouseStocks[wFrom])
                        : (wFrom === 'المخزن الرئيسي' ? (parseFloat(p.stock) || 0) : 0);
                    p.warehouseStocks[wFrom] = Math.max(0, currentSrcPStock - baseQty);

                    // 2. إضافة الكمية للمخزن المستلم
                    const currentDstPStock = (p.warehouseStocks[wTo] !== undefined && !isNaN(parseFloat(p.warehouseStocks[wTo])))
                        ? parseFloat(p.warehouseStocks[wTo])
                        : (wTo === 'المخزن الرئيسي' ? (parseFloat(p.stock) || 0) : 0);
                    p.warehouseStocks[wTo] = currentDstPStock + baseQty;

                    // معالجة التشكيلات (المقاس واللون) بدقة تامة
                    if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                        const norm = (str) => String(str || '').trim().toLowerCase();
                        const nSize = norm(item.size || item.selectedSize || '');
                        const nColor = norm(item.color || item.selectedColor || '');
                        if (nSize || nColor) {
                            const matchedVar = p.variants.find(v => 
                                (norm(v.size) === nSize) && 
                                (norm(v.color) === nColor)
                            ) || p.variants.find(v => 
                                (!nSize || norm(v.size) === nSize) && 
                                (!nColor || norm(v.color) === nColor)
                            );
                            if (matchedVar) {
                                if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};

                                // خصم من تشكيلة المخزن المصدر
                                const currentSrcVarStock = (matchedVar.warehouseStocks[wFrom] !== undefined && !isNaN(parseFloat(matchedVar.warehouseStocks[wFrom])))
                                    ? parseFloat(matchedVar.warehouseStocks[wFrom])
                                    : (wFrom === 'المخزن الرئيسي' ? (parseFloat(matchedVar.stock) || 0) : 0);
                                matchedVar.warehouseStocks[wFrom] = Math.max(0, currentSrcVarStock - baseQty);

                                // إضافة لتشكيلة المخزن المستلم
                                const currentDstVarStock = (matchedVar.warehouseStocks[wTo] !== undefined && !isNaN(parseFloat(matchedVar.warehouseStocks[wTo])))
                                    ? parseFloat(matchedVar.warehouseStocks[wTo])
                                    : (wTo === 'المخزن الرئيسي' ? (parseFloat(matchedVar.stock) || 0) : 0);
                                matchedVar.warehouseStocks[wTo] = currentDstVarStock + baseQty;

                                // مزامنة حقل stock المباشر للتشكيلة ليكون مجموع كافة المخازن (حتى لا تتبخر البضاعة المحولة)
                                matchedVar.stock = Object.values(matchedVar.warehouseStocks).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                            }
                        }

                        const getVarStockInWH = (v, wh) => {
                            if (v.warehouseStocks && v.warehouseStocks[wh] !== undefined && !isNaN(parseFloat(v.warehouseStocks[wh]))) {
                                return parseFloat(v.warehouseStocks[wh]);
                            }
                            return (wh === 'المخزن الرئيسي' ? (parseFloat(v.stock) || 0) : 0);
                        };

                        // مزامنة إجمالي رصيد كارت الصنف مع مجموع تشكيلاته
                        p.stock = p.variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
                        if (p.warehouseStocks) {
                            p.warehouseStocks[wFrom] = p.variants.reduce((sum, v) => sum + getVarStockInWH(v, wFrom), 0);
                            p.warehouseStocks[wTo] = p.variants.reduce((sum, v) => sum + getVarStockInWH(v, wTo), 0);
                        }
                    } else {
                        // الصنف بدون تشكيلات: مزامنة إجمالي رصيد الصنف ليكون مجموع بضاعة كافة المخازن
                        if (p.warehouseStocks) {
                            p.stock = Object.values(p.warehouseStocks).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                        }
                    }
                }
            });

            if (typeof window.saveTransactionChanges === 'function') {
                await window.saveTransactionChanges({
                    newTransactions: transItems,
                    modifiedProducts: affectedProducts,
                    modifiedAccounts: []
                });
            } else {
                await saveData();
            }
            if (typeof invalidateStockCache === 'function') invalidateStockCache();

            // إشعار السيرفر المحلي
            if (window.BayanNetworkHub && window.BayanNetworkHub.serverUrl) {
                try {
                    fetch(`${window.BayanNetworkHub.serverUrl}/api/transfers/accept`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ transferId: invId, receiverName: receiverUser })
                    }).catch(() => {});
                } catch(e) {}
            }

            if (typeof showToast === 'function') {
                showToast(`🎉 تم تأكيد استلام إذن التحويل #${invId} وإضافة البضاعة لرصيد المخزن بنجاح!`, 'success');
            }
            if (typeof updateNotifications === 'function') updateNotifications();
            if (typeof renderInventoryTable === 'function') renderInventoryTable();
            if (typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();
            if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
            if (typeof renderHistoryTable === 'function') renderHistoryTable();
            if (typeof generateDailyReport === 'function' && document.getElementById('opsSummaryBody')) generateDailyReport();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('transfers');
            }
        };

        window.rejectTransferFromNotify = async function(invId) {
            if (!invId) return;
            const transItems = (typeof transactions !== 'undefined' && Array.isArray(transactions))
                ? transactions.filter(t => (String(t.invoiceId) === String(invId) || String(t.id) === String(invId)) && t.type && t.type.includes('تحويل'))
                : [];

            if (transItems.length === 0) {
                if (typeof showToast === 'function') showToast('⚠️ إذن التحويل غير موجود', 'error');
                return;
            }

            const currentStatus = transItems[0].transferStatus || 'pending';
            if (currentStatus === 'received') {
                if (typeof showToast === 'function') showToast('⚠️ تم استلام وقبول هذا الإذن بالفعل، لا يمكن رفضه الآن.', 'warning');
                return;
            }
            if (currentStatus === 'rejected') {
                if (typeof showToast === 'function') showToast('ℹ️ تم رفض هذا الإذن مسبقاً!', 'info');
                return;
            }

            const rejectorUser = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : 'أمين المخزن';
            const nowFull = new Date().toLocaleString('ar-EG');

            // تسجيل حالة الرفض - لا يتم تعديل أي أرصدة لأن البضاعة لم تخصم من المخزن المصدر في حالة الانتظار
            transItems.forEach(item => {
                item.transferStatus = 'rejected';
                item.rejectedBy = rejectorUser;
                item.rejectedAt = nowFull;
            });

            if (typeof window.saveTransactionChanges === 'function') {
                await window.saveTransactionChanges({
                    newTransactions: transItems,
                    modifiedProducts: [],
                    modifiedAccounts: []
                });
            } else {
                await saveData();
            }
            if (typeof invalidateStockCache === 'function') invalidateStockCache();

            const sUrl = (window.BayanNetworkHub && window.BayanNetworkHub.serverUrl) ? window.BayanNetworkHub.serverUrl : '';
            if (sUrl || window.location.protocol.startsWith('http')) {
                try {
                    const ep = sUrl ? `${sUrl}/api/transfers/reject` : '/api/transfers/reject';
                    fetch(ep, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ transferId: invId, rejectorName: rejectorUser })
                    }).catch(() => {});
                } catch(e) {}
            }

            if (typeof showToast === 'function') {
                showToast(`⚠️ تم رفض إذن التحويل #${invId}. تظل البضاعة مسجلة بالكامل برصيد ومصفوفة المخزن المصدر.`, 'warning');
            }
            if (typeof updateNotifications === 'function') updateNotifications();
            if (typeof renderInventoryTable === 'function') renderInventoryTable();
            if (typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();
            if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
            if (typeof renderHistoryTable === 'function') renderHistoryTable();
            if (typeof generateDailyReport === 'function' && document.getElementById('opsSummaryBody')) generateDailyReport();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('transfers');
            }
        };
