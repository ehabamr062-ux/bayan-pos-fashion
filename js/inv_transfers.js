// ============================================================
//  التحويلات بين المخازن والفروع (Warehouse Transfers Engine)
// ============================================================
        window.openTransferModal = function(isEdit = false) {

            if (!isEdit) transferItemsBatch = [];

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

            // 1. جمع الأصناف المختارة بعلامة الصح ✅

            const checkedBoxes = document.querySelectorAll('.inv-row-check:checked');

            checkedBoxes.forEach(chk => {

                const tr = chk.closest('tr');

                const pId = tr.getAttribute('data-id');

                const product = productsDB.find(p => p.id == pId);

                if (product && !transferItemsBatch.some(item => item.id == product.id)) {

                    transferItemsBatch.push({ 

                        id: product.id, 

                        name: product.name, 

                        stock: product.stock, 

                        qty: 1,

                        price: parseFloat(product.cost) || 0 // القيمة الافتراضية هي التكلفة

                    });

                }

            });

            // 2. إذا لم يكن هناك "صح" نأخذ الصنف "المظلل بالذهبي" حالياً

            if (transferItemsBatch.length === 0 && selectedInventoryId) {

                const product = productsDB.find(p => p.id == selectedInventoryId);

                if (product) {

                    transferItemsBatch.push({ 

                        id: product.id, 

                        name: product.name, 

                        stock: product.stock, 

                        qty: 1,

                        price: parseFloat(product.cost) || 0

                    });

                }

            }

            // 3. تصفير مربع البحث عند الفتح

            const pSearch = document.getElementById('transferProductSearch');

            if (pSearch) pSearch.value = '';

            document.getElementById('transferSearchResults').innerHTML = '';

            document.getElementById('transferSearchResults').classList.add('hidden');

            selectedTransferProductId = null;

            // 4. تعبئة قائمة المخازن

            const wFrom = document.getElementById('transferFrom');

            if (wFrom) {

                wFrom.innerHTML = '';

                warehouses.forEach(w => {

                    wFrom.innerHTML += `<option value="${w.name}">${w.name}</option>`;

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

            // إعادة ضبط وضع التعديل إذا كان نشطاً

            isEditMode = false;

            editingInvoiceId = null;

            editingOriginalDate = null;

            editingInvoiceType = null;

            transferItemsBatch = [];

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

                priceInput.value = (parseFloat(unit.cost) || parseFloat(product.cost) || 0).toFixed(2);

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

            tbody.innerHTML = '';
            let totalVal = 0;
            let itemsCount = transferItemsBatch.length;

            if (itemsCount === 0) {
                if (emptyState) emptyState.style.display = 'block';
            } else {
                if (emptyState) emptyState.style.display = 'none';
            }

            const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
            const wFrom = (document.getElementById('transferFrom')?.value || document.getElementById('transferFromWarehouse')?.value || activeWH).trim();

            transferItemsBatch.forEach((item, index) => {
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
                            } else if (wFrom === 'المخزن الرئيسي' || !matchedVar.warehouseStocks) {
                                srcStock = parseFloat(matchedVar.stock) || 0;
                            }
                            item.stock = srcStock / factor;
                            item.sourceStock = item.stock;
                        }
                    } else {
                        let srcStock = 0;
                        if (typeof getWarehouseStock === 'function') {
                            srcStock = getWarehouseStock(p.name, wFrom);
                        } else if (p.warehouseStocks && typeof p.warehouseStocks === 'object' && p.warehouseStocks[wFrom] !== undefined) {
                            srcStock = parseFloat(p.warehouseStocks[wFrom]) || 0;
                        } else if (wFrom === 'المخزن الرئيسي' || !p.warehouseStocks) {
                            srcStock = parseFloat(p.stock) || 0;
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

                        <input type="number" value="${item.qty}" class="search-input" 

                            style="height: 38px; border-radius: 8px; text-align: center; font-weight: 900; border: 2px solid #e2e8f0; width: 100%;"

                            oninput="window.updateTransferItem(${index}, 'qty', this.value)">

                    </td>

                    <td class="col-tr-price" style="padding: 12px; border-left: 1px solid #e2e8f0;">

                        <input type="number" value="${item.price}" class="search-input" 

                            style="height: 38px; border-radius: 8px; text-align: center; color: var(--main-blue); font-weight: 900; border: 2px solid #e2e8f0; width: 100%;"

                            oninput="window.updateTransferItem(${index}, 'price', this.value)">

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

            if (transferItemsBatch.length === 0) return showToast("⚠️ القائمة فارغة!", "warning");

            const wFrom = document.getElementById('transferFrom').value;

            const wTo = document.getElementById('transferTo').value;

            const shopName    = document.getElementById('shopName')?.value || 'بـيـان POS';
            const shopAddress = document.getElementById('shopAddress')?.value || '';
            const shopPhone   = document.getElementById('shopPhone1')?.value || '';
            const footerMsg   = document.getElementById('printFooterMsg')?.value || 'شكراً لزيارتكم!';

            let itemsHtml = transferItemsBatch.map((item, idx) => {
                const sSize = item.size || item.selectedSize || '-';
                const sColor = item.color || item.selectedColor || '-';
                return `
                <tr>
                    <td style="padding: 6px 8px; border: 1px solid #000;">${idx + 1}</td>
                    <td style="text-align:right; padding: 6px 10px; border: 1px solid #000; font-weight:bold;">
                        ${item.name}
                    </td>
                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#047857;">${sSize}</td>
                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#1d4ed8;">${sColor}</td>
                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${item.qty} ${item.unitName || ''}</td>
                    <td style="padding: 6px 8px; border: 1px solid #000;">${(parseFloat(item.price) || 0).toFixed(2)}</td>
                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}</td>
                </tr>
                `;
            }).join('');

            const totalValue = transferItemsBatch.reduce((acc, item) => acc + (item.qty * item.price), 0);

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

                                <th style="padding: 8px; border: 1px solid #000;">سعر التحويل</th>

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

        window.updateTransferItem = function(index, key, val) {

            transferItemsBatch[index][key] = parseFloat(val) || 0;

            renderTransferTable();

        }

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

                    (p.code && String(p.code).toLowerCase().includes(queryLower))

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

                    const retailPrice = parseFloat(p.price) || 0;
                    const stockColor = currentWhStock <= 0 ? '#ef4444' : (currentWhStock <= 5 ? '#f59e0b' : '#10b981');

                    div.innerHTML = `
                        <div style="flex: 1; min-width: 0; text-align: right; overflow: hidden;">
                            <div style="font-weight: 900; font-size: 0.98rem; color: #0f172a; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                <span style="color: #0284c7; font-size: 1.05rem; flex-shrink: 0;">🏷️</span>
                                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
                            </div>
                            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: nowrap; overflow: hidden;">
                                <span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 5px; font-size: 0.73rem; font-weight: 700; border: 1px solid #e2e8f0; white-space: nowrap; flex-shrink: 0;">
                                    كود: <b style="color: #0284c7; font-family: monospace;">${p.code || p.id}</b>
                                </span>
                                <span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 5px; font-size: 0.73rem; font-weight: 700; border: 1px solid #e2e8f0; white-space: nowrap; flex-shrink: 0;">
                                    باركود: <b style="color: #334155; font-family: monospace;">${p.barcode || '---'}</b>
                                </span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                            <div style="text-align: center; background: ${currentWhStock > 0 ? '#ecfdf5' : '#fef2f2'}; border: 1.5px solid ${currentWhStock > 0 ? '#a7f3d0' : '#fecaca'}; padding: 4px 8px; border-radius: 8px; min-width: 78px; flex-shrink: 0;">
                                <div style="font-size: 0.65rem; color: ${currentWhStock > 0 ? '#047857' : '#b91c1c'}; font-weight: 800; white-space: nowrap;">رصيد (${fromWh})</div>
                                <div style="font-weight: 900; font-size: 0.92rem; color: ${stockColor}; line-height: 1.2; white-space: nowrap;">
                                    ${currentWhStock} <span style="font-size: 0.65rem;">${p.unit || 'قطعة'}</span>
                                </div>
                            </div>
                            <div style="text-align: center; background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; padding: 4px 10px; border-radius: 8px; min-width: 82px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);">
                                <div style="font-size: 0.65rem; color: #e0f2fe; font-weight: 800; white-space: nowrap;">سعر قطاعي</div>
                                <div style="font-weight: 900; font-size: 0.92rem; line-height: 1.2; white-space: nowrap;">${retailPrice.toFixed(2)} ج.م</div>
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

                resultsDiv.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;"><div style="font-size:2rem; margin-bottom:10px;">🔍</div>لا توجد نتائج مطابقة لـ "' + query + '"</div>';

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

            const items = resultsDiv.querySelectorAll('.search-item');

            if (resultsDiv.classList.contains('hidden')) return;

            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {

                e.preventDefault();

                transferSearchSelectedIndex = (transferSearchSelectedIndex + 1) % items.length;

                updateTransferSearchSelection(items);

            } else if (e.key === 'ArrowUp') {

                e.preventDefault();

                transferSearchSelectedIndex = (transferSearchSelectedIndex - 1 + items.length) % items.length;

                updateTransferSearchSelection(items);

            } else if (e.key === 'Enter') {
                if (transferSearchSelectedIndex > -1) {
                    e.preventDefault();
                    items[transferSearchSelectedIndex].click();
                } else {
                    const query = e.target.value.trim();
                    if (query) {
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
                            const existing = window.transferItemsBatch.find(it => it.id === match.id && ((it.size || it.selectedSize || '') === vSize) && ((it.color || it.selectedColor || '') === vColor));
                            if (existing) {
                                existing.qty = (parseFloat(existing.qty) || 0) + 1;
                            } else {
                                const vCost = parseFloat(matchingVariant.cost) || parseFloat(match.cost) || 0;
                                const fromWh = document.getElementById('transferFrom') ? document.getElementById('transferFrom').value : (typeof getStore === 'function' ? getStore('activeWarehouse') : 'المخزن الرئيسي') || 'المخزن الرئيسي';
                                if (matchingVariant) {
                                    if (matchingVariant.warehouseStocks && matchingVariant.warehouseStocks[fromWh] !== undefined) {
                                        currentWhStock = parseFloat(matchingVariant.warehouseStocks[fromWh]) || 0;
                                    } else if (matchingVariant.stock !== undefined) {
                                        currentWhStock = parseFloat(matchingVariant.stock) || 0;
                                    }
                                }

                                window.transferItemsBatch.push({
                                    id: match.id,
                                    name: match.name,
                                    code: matchingVariant.barcode || match.code || match.id,
                                    selectedSize: vSize,
                                    selectedColor: vColor,
                                    size: vSize,
                                    color: vColor,
                                    stock: currentWhStock,
                                    qty: 1,
                                    price: vCost
                                });
                            }
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

            if (product) {

                // منع التكرار لنفس الوحدة والمقاس واللون
                const unitName = currentTransferHeaderUnit ? currentTransferHeaderUnit.unitName : (product.unit || 'قطعة');

                if (transferItemsBatch.some(item => item.id == pId && item.unitName == unitName && (item.size || '') == size && (item.color || '') == color)) {

                    return showToast("📋 هذا الصنف بنفس المقاس واللون والوحدة موجود بالفعل في القائمة", "info");

                }

                transferItemsBatch.push({

                    id: product.id,

                    name: product.name,

                    size: size,

                    color: color,

                    stock: product.stock,

                    qty: qty,

                    price: price,

                    unitName: unitName,

                    unitFactor: currentTransferHeaderUnit ? parseFloat(currentTransferHeaderUnit.factor) : 1

                });

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

            }

        }

        window.filterStmtAccounts = function() {
            const input = document.getElementById('stmtAccountSelector');
            const dropdown = document.getElementById('stmtAccountDropdown');
            if (!input || !dropdown) return;
            
            const filter = input.value.trim().toLowerCase();
            
            if (filter === '' && document.activeElement !== input) {
                dropdown.style.display = 'none';
                dropdown.innerHTML = '';
                return;
            }
            
            const matched = accounts.filter(a => a.name && a.name.toLowerCase().includes(filter)).slice(0, 50);
            
            if (matched.length === 0) {
                dropdown.innerHTML = '<div style="padding: 10px; color: #94a3b8; text-align: center;">لا يوجد نتائج</div>';
            } else {
                dropdown.innerHTML = matched.map(acc => 
                    `<div class="stmt-acc-item" data-acc-name="${acc.name.replace(/"/g, '&quot;')}" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: bold; transition: 0.15s;">${acc.name}</div>`
                ).join('');

                dropdown.querySelectorAll('.stmt-acc-item').forEach(el => {
                    el.onmouseover = () => el.style.background = '#f8fafc';
                    el.onmouseout = () => el.style.background = 'transparent';
                    el.onclick = () => {
                        input.value = el.getAttribute('data-acc-name');
                        dropdown.style.display = 'none';
                        window.loadSelectedAccountStatement();
                    };
                });
            }
            dropdown.style.display = 'block';
        };

        window.removeTransferItem = function(index) {

            transferItemsBatch.splice(index, 1);

            renderTransferTable();

        }

        window.updateTransferToList = function() {

            const wFromVal = document.getElementById('transferFrom').value;

            const wTo = document.getElementById('transferTo');

            if (!wTo) return;

            wTo.innerHTML = '';

            const filteredWarehouses = warehouses.filter(w => w.name !== wFromVal);

            filteredWarehouses.forEach(w => {

                wTo.innerHTML += `<option value="${w.name}">${w.name}</option>`;

            });

            renderTransferTable();

        }

        window.processBatchTransfer = async function() {
            if (window.isSavingTransaction) {
                console.warn("⚠️ تم تجاهل ضغطة مكررة أثناء تنفيذ التحويل المخزني.");
                return;
            }

            if (!checkPermission('stock_transfer')) return;

            if (transferItemsBatch.length === 0) return showToast("⚠️ قائمة التحويل فارغة!", "error");

            const wFrom = document.getElementById('transferFrom').value;
            const wTo = document.getElementById('transferTo').value;

            if (!wTo || wFrom === wTo) return showToast("🚫 يرجى اختيار مخزن وجهة مختلف عن المصدر", "error");

            showCustomAlert({
                type: 'warning',
                titleText: '⚠️ تأكيد التحويل المجمّع',
                msg: `هل أنت متأكد من تحويل (${transferItemsBatch.length}) أصناف من [${wFrom}] إلى [${wTo}]؟\nهذا الإجراء سيقوم بتعديل أرصدة المخازن فوراً.`,
                showCancel: true,
                confirmText: 'نعم، نفّذ التحويل',
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

                        for (let item of transferItemsBatch) {
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

                            if (effVariant) {
                                // التحقق يعتمد كلياً على رصيد الـ variant المحدد في المخزن المصدر
                                if (effVariant.warehouseStocks && effVariant.warehouseStocks[wFrom] !== undefined) {
                                    availStock = parseFloat(effVariant.warehouseStocks[wFrom]) || 0;
                                } else {
                                    availStock = parseFloat(effVariant.stock) || 0;
                                }
                            } else {
                                // الصنف بدون تشكيلات
                                if (p && p.warehouseStocks && p.warehouseStocks[wFrom] !== undefined) {
                                    availStock = parseFloat(p.warehouseStocks[wFrom]) || 0;
                                } else if (typeof getWarehouseStock === 'function') {
                                    availStock = getWarehouseStock(item.name, wFrom);
                                } else {
                                    availStock = p ? (parseFloat(p.stock) || 0) : 0;
                                }
                            }

                            if (requiredBaseQty > availStock) {
                                const varInfo = effVariant ? ` [${sSize ? 'مقاس: ' + sSize : ''} ${sColor ? 'لون: ' + sColor : ''}]` : '';
                                const availInUnit = (availStock / factor).toFixed(2).replace(/\.00$/, '');
                                return alert(`🚫 رصيد غير كافٍ لتحويل الصنف (${item.name}${varInfo}):\nالكمية المطلوبة: ${item.qty} ${item.unitName || ''}\nالرصيد المتاح حالياً لهذا المقاس/اللون في (${wFrom}): ${availInUnit} ${item.unitName || ''}\n\nيرجى تعديل الكمية للمتابعة.`);
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

                        const totalTransferValue = transferItemsBatch.reduce((acc, item) => acc + (parseFloat(item.qty) * parseFloat(item.price)), 0);

                        transferItemsBatch.forEach((item, idx) => {
                            if (item.qty > 0) {
                                const factor = parseFloat(item.unitFactor) || 1;
                                const baseQty = (parseFloat(item.qty) || 0) * factor;

                                // خصم الرصيد من المخزن المصدر فوراً ووضعه في حالة الانتظار (In-Transit)
                                const p = productsDB.find(prod => prod.name === item.name || prod.id === item.id);
                                if (p) {
                                    if (!p.warehouseStocks) p.warehouseStocks = {};
                                    p.warehouseStocks[wFrom] = Math.max(0, (parseFloat(p.warehouseStocks[wFrom]) || 0) - baseQty);

                                    // خصم رصيد التشكيلة (المقاس واللون) من المخزن المصدر
                                    if (p.variants && Array.isArray(p.variants)) {
                                        const sSize = String(item.size || item.selectedSize || '').trim();
                                        const sColor = String(item.color || item.selectedColor || '').trim();
                                        if (sSize || sColor) {
                                            const matchedVar = p.variants.find(v => 
                                                (String(v.size || '').trim() === sSize) && 
                                                (String(v.color || '').trim() === sColor)
                                            ) || p.variants.find(v => 
                                                (!sSize || String(v.size || '').trim() === sSize) && 
                                                (!sColor || String(v.color || '').trim() === sColor)
                                            );
                                            if (matchedVar) {
                                                if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                                                matchedVar.warehouseStocks[wFrom] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[wFrom]) || 0) - baseQty);
                                            }
                                        }
                                    }
                                }

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
                            await saveData();
                            if (typeof invalidateStockCache === 'function') invalidateStockCache();

                            // إعادة ضبط وضع التعديل
                            isEditMode = false;
                            editingInvoiceId = null;
                            editingOriginalDate = null;
                            editingInvoiceType = null;

                            showToast(`✅ تم بنجاح تحويل ( ${processedCount} ) أصناف من [${wFrom}] إلى [${wTo}]`, "success");

                            transferItemsBatch = [];
                            renderTransferTable();
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
        // 🚚 قبول واستلام أو رفض أذونات التحويل من ساحة الانتظار / الإشعارات
        // =========================================================================
        window.acceptTransferFromNotify = async function(invId) {
            if (!invId) return;
            const transItems = (typeof transactions !== 'undefined' && Array.isArray(transactions))
                ? transactions.filter(t => t.invoiceId === invId && t.type && t.type.includes('تحويل'))
                : [];

            if (transItems.length === 0) {
                if (typeof showToast === 'function') showToast('⚠️ إذن التحويل غير موجود', 'error');
                return;
            }

            const receiverUser = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : 'أمين المخزن';
            const nowFull = new Date().toLocaleString('ar-EG');

            transItems.forEach(item => {
                item.transferStatus = 'received';
                item.receivedBy = receiverUser;
                item.receivedAt = nowFull;

                // إضافة الكمية رسمياً لرصيد المخزن المستلم
                const factor = parseFloat(item.unitFactor) || 1;
                const baseQty = (parseFloat(item.qty) || 0) * factor;
                const wTo = item.warehouse;

                const p = productsDB.find(prod => prod.name === item.product || prod.id === item.id);
                if (p) {
                    if (!p.warehouseStocks) p.warehouseStocks = {};
                    p.warehouseStocks[wTo] = (parseFloat(p.warehouseStocks[wTo]) || 0) + baseQty;

                    if (p.variants && Array.isArray(p.variants)) {
                        const sSize = String(item.size || item.selectedSize || '').trim();
                        const sColor = String(item.color || item.selectedColor || '').trim();
                        if (sSize || sColor) {
                            const matchedVar = p.variants.find(v => 
                                (String(v.size || '').trim() === sSize) && 
                                (String(v.color || '').trim() === sColor)
                            ) || p.variants.find(v => 
                                (!sSize || String(v.size || '').trim() === sSize) && 
                                (!sColor || String(v.color || '').trim() === sColor)
                            );
                            if (matchedVar) {
                                if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                                matchedVar.warehouseStocks[wTo] = (parseFloat(matchedVar.warehouseStocks[wTo]) || 0) + baseQty;
                            }
                        }
                    }
                }
            });

            await saveData();
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
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('transfers');
            }
        };

        window.rejectTransferFromNotify = async function(invId) {
            if (!invId) return;
            const transItems = (typeof transactions !== 'undefined' && Array.isArray(transactions))
                ? transactions.filter(t => t.invoiceId === invId && t.type && t.type.includes('تحويل'))
                : [];

            if (transItems.length === 0) {
                if (typeof showToast === 'function') showToast('⚠️ إذن التحويل غير موجود', 'error');
                return;
            }

            const rejectorUser = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : 'أمين المخزن';
            const nowFull = new Date().toLocaleString('ar-EG');

            // استرجاع البضاعة للمخزن المصدر
            transItems.forEach(item => {
                item.transferStatus = 'rejected';
                item.rejectedBy = rejectorUser;
                item.rejectedAt = nowFull;

                const factor = parseFloat(item.unitFactor) || 1;
                const baseQty = (parseFloat(item.qty) || 0) * factor;
                const wFrom = item.sourceWarehouse;

                const p = productsDB.find(prod => prod.name === item.product || prod.id === item.id);
                if (p) {
                    if (!p.warehouseStocks) p.warehouseStocks = {};
                    p.warehouseStocks[wFrom] = (parseFloat(p.warehouseStocks[wFrom]) || 0) + baseQty;

                    if (p.variants && Array.isArray(p.variants)) {
                        const sSize = String(item.size || item.selectedSize || '').trim();
                        const sColor = String(item.color || item.selectedColor || '').trim();
                        if (sSize || sColor) {
                            const matchedVar = p.variants.find(v => 
                                (String(v.size || '').trim() === sSize) && 
                                (String(v.color || '').trim() === sColor)
                            ) || p.variants.find(v => 
                                (!sSize || String(v.size || '').trim() === sSize) && 
                                (!sColor || String(v.color || '').trim() === sColor)
                            );
                            if (matchedVar) {
                                if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                                matchedVar.warehouseStocks[wFrom] = (parseFloat(matchedVar.warehouseStocks[wFrom]) || 0) + baseQty;
                            }
                        }
                    }
                }
            });

            await saveData();
            if (typeof invalidateStockCache === 'function') invalidateStockCache();

            if (typeof showToast === 'function') {
                showToast(`⚠️ تم رفض إذن التحويل #${invId} وإرجاع البضاعة للمخزن المصدر.`, 'warning');
            }

            if (typeof updateNotifications === 'function') updateNotifications();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('transfers');
            }
        };
