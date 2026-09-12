// ============================================================
//  مرتجع ومستبدل المبيعات والمشتريات (Sales & Purchase Returns)
// ============================================================
function updateReturnTotal(type) {

    let data = returnCart;

    let totalAmountId = 'returnTotalAmount';

    let discountId = 'salesReturnDiscount';

    let taxId = 'salesReturnTax';

    let tableBodyId = 'returnCartBody';

    // معرفات الملخص الجديد

    let itemsCountId = 'returnItemsCount';

    let totalQtyId = 'returnTotalQty';

    let subTotalDisplayId = 'salesReturnSubTotal';

    let discDispId = 'salesReturnDiscountAmountDisplay';

    let taxDispId = 'salesReturnTaxAmountDisplay';

    if (type === 'purchase') {

        data = purReturnCart;

        totalAmountId = 'purReturnTotalAmount';

        discountId = 'purReturnDiscount';

        taxId = 'purReturnTax';

        tableBodyId = 'purReturnCartBody';

        itemsCountId = 'purReturnItemsCount';

        totalQtyId = 'purReturnTotalQty';

        subTotalDisplayId = 'purReturnSubTotal';

        discDispId = 'purReturnDiscountAmountDisplay';

        taxDispId = 'purReturnTaxAmountDisplay';

    }

    const subTotal = data.reduce((a, b) => a + (b.price * b.qty), 0);

    // تحديث الإحصائيات في الملخص

    const totalQty = data.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);

    if (document.getElementById(itemsCountId)) document.getElementById(itemsCountId).innerText = data.length;

    if (document.getElementById(totalQtyId)) document.getElementById(totalQtyId).innerText = totalQty;

    if (document.getElementById(subTotalDisplayId)) document.getElementById(subTotalDisplayId).innerText = subTotal.toFixed(2);

    // حساب الخصم

    let discVal = 0;

    const discEl = document.getElementById(discountId);

    if (discEl) discVal = parseFloat(discEl.value) || 0;

    const discTypeEl = document.getElementById(discountId + 'Type');

    const discType = discTypeEl ? discTypeEl.value : 'fixed';

    let discAmount = (discType === 'perc') ? (subTotal * discVal / 100) : discVal;

    if (document.getElementById(discDispId)) document.getElementById(discDispId).innerText = discAmount.toFixed(2);

    // حساب الإضافة/الضريبة

    let taxVal = 0;

    const taxEl = document.getElementById(taxId);

    if (taxEl) taxVal = parseFloat(taxEl.value) || 0;

    const taxTypeEl = document.getElementById(taxId + 'Type');

    const taxType = taxTypeEl ? taxTypeEl.value : 'fixed';

    let taxAmount = (taxType === 'perc') ? (subTotal * taxVal / 100) : taxVal;

    if (document.getElementById(taxDispId)) document.getElementById(taxDispId).innerText = taxAmount.toFixed(2);

    let finalTotal = subTotal - discAmount + taxAmount;

    if (finalTotal < 0) finalTotal = 0;

    document.getElementById(totalAmountId).innerText = finalTotal.toFixed(2);

    const bigTotalId = (type === 'purchase') ? 'purReturnFinalTotalBig' : 'salesReturnFinalTotalBig';

    const bigTotalEl = document.getElementById(bigTotalId);

    if (bigTotalEl) bigTotalEl.innerText = finalTotal.toFixed(2);

    // تحديث السطور ليعكس توزيع الخصم والضريبة

    if (subTotal > 0) {

        const ratio = finalTotal / subTotal;

        const rows = document.querySelectorAll(`#${tableBodyId} tr`);

        data.forEach((item, index) => {

            const row = rows[index];

            if (row) {

                const totalCell = row.cells[5];

                totalCell.innerText = (item.price * item.qty * ratio).toFixed(2);

            }

        });

    }

    // تحديث الرصيد المتوقع بعد تغيير الإجمالي

    const retType = (type === 'purchase') ? 'purchase' : 'sales';

    if (typeof updateProjectedAccountBalance === 'function') {

        updateProjectedAccountBalance(retType);

    }

}

// --- 1. مرتجع المبيعات (Sales Return) ---

function addToReturnCart(productId) {

    const product = productsDB.find(p => p.id === productId);

    if (!product) return;

    if (product.units && product.units.length > 1) {

        showUnitSelectionModal(product, 'sales-return');

        return;

    }

    const defUnit = (product.units && product.units.length > 0) ? product.units[0] : null;

    completeAddToReturnCart(product, defUnit);

}

function completeAddToReturnCart(product, selectedUnit) {

    let price = product.price;

    if (selectedUnit) {

        price = parseFloat(selectedUnit.price) || product.price;

    }

    returnCart.push({

        id: product.id,

        name: product.name,

        code: product.code || '---',

        price: price,

        qty: 1,

        maxQty: 9999,

        selectedUnit: selectedUnit

    });

    renderReturnCart();

}

// --- 2. مرتجع الشراء (Purchase Return) ---

function addToPurReturnCart(productId) {

    const product = productsDB.find(p => p.id === productId);

    if (!product) return;

    if (product.units && product.units.length > 1) {

        showUnitSelectionModal(product, 'purchase-return');

        return;

    }

    const defUnit = (product.units && product.units.length > 0) ? product.units[0] : null;

    completeAddToPurReturnCart(product, defUnit);

}

function completeAddToPurReturnCart(product, selectedUnit) {

    let cost = product.cost || 0;

    if (selectedUnit) {

        cost = parseFloat(selectedUnit.cost) || product.cost || 0;

    }

    purReturnCart.push({

        id: product.id,

        name: product.name,

        code: product.code || '---',

        price: cost,

        qty: 1,

        maxQty: 9999,

        selectedUnit: selectedUnit

    });

    renderPurReturnCart();

}

function renderReturnCart() {

    const tbody = document.getElementById('returnCartBody');

    if (!tbody) return;

    tbody.innerHTML = '';

    let totalQty = 0;

    returnCart.forEach((item, idx) => {

        const itemTotal = item.price * item.qty;

        totalQty += (parseFloat(item.qty) || 0);

        const product = productsDB.find(p => p.id === item.id);

        let unitOptions = `<option value="base" ${!item.selectedUnit ? 'selected' : ''}>${(product ? (product.unit || 'قطعة') : 'قطعة')}</option>`;

        if (product && product.units && product.units.length > 0) {

            unitOptions = product.units.map(u =>

                `<option value="${u.unitName}" ${item.selectedUnit && item.selectedUnit.unitName === u.unitName ? 'selected' : ''}>${u.unitName}</option>`

            ).join('');

        }

        const { sizeElement, colorElement } = renderVariantSelectElements(item, idx, 'return');

        const tr = document.createElement('tr');
        tr.setAttribute('data-index', idx);
        tr.style.transition = "0.2s";
        tr.innerHTML = `
                    <td style="text-align: center; color: #94a3b8; font-size: 0.8rem;">${idx + 1}</td>
                    <td style="font-size: 0.85rem; color: #64748b; text-align: center; font-family: monospace;">${item.code || '---'}</td>
                    <td style="font-weight: 600; color: #1e293b;">${item.name}</td>
                    <td class="col-variant-size" style="text-align: center;">${sizeElement}</td>
                    <td class="col-variant-color" style="text-align: center;">${colorElement}</td>
                    <td>
                        <select onchange="updateReturnItemUnit(${idx}, this.value)" ${item.invoiceId ? 'disabled' : ''} 
                            style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 0.9rem; ${item.invoiceId ? 'opacity: 0.7; cursor: not-allowed;' : ''}">
                            ${unitOptions}
                        </select>
                    </td>

                    <td>

                        <input type="text" value="${item.qty}" 

                               inputmode="decimal"

                               oninput="this.value = this.value.replace(/[^0-9.]/g, ''); updateReturnItem(${idx}, 'qty', this.value, false)" 

                               onchange="updateReturnItem(${idx}, 'qty', this.value, true)"

                               onclick="this.select()" 

                               style="width: 100%; text-align: center; border: 1px solid transparent; background: transparent; padding: 6px; font-weight: bold; font-size: 1rem; color: #1e293b;">

                    </td>

                    <td>

                        <input type="text" value="${(parseFloat(item.price) || 0).toFixed(2)}" 

                               inputmode="decimal"

                               oninput="this.value = this.value.replace(/[^0-9.]/g, ''); updateReturnItem(${idx}, 'price', this.value, false)" 

                               onchange="updateReturnItem(${idx}, 'price', this.value, true)"

                               onclick="this.select()" 

                               style="width: 100%; text-align: center; border: 1px solid transparent; background: transparent; padding: 6px; font-weight: 800; font-size: 1rem; color: var(--main-orange);">

                    </td>

                    <td class="row-total" style="text-align: center; font-weight: 800; color: #0f172a; font-size: 1.05rem;">${itemTotal.toFixed(2)}</td>

                    <td style="text-align: center;">

                        <button class="btn-delete-row-minimal" onclick="returnCart.splice(${idx},1); renderReturnCart();" title="حذف" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.2rem; opacity: 0.6; transition: 0.2s;">🗑️</button>

                    </td>

                `;

        tbody.appendChild(tr);

    });

    updateReturnTotal();

}

function updateReturnItemUnit(idx, unitName) {

    const item = returnCart[idx];

    const product = productsDB.find(p => p.name === item.name);

    if (!product) return;

    const unit = product.units ? product.units.find(u => u.unitName === unitName) : null;

    if (unit) {

        item.selectedUnit = unit;

        item.unitFactor = parseFloat(unit.factor) || 1;

        item.price = parseFloat(unit.price) || 0;

    } else {

        item.selectedUnit = null;

        item.unitFactor = 1;

        item.price = parseFloat(product.price) || 0;

    }

    renderReturnCart();

}

function updateReturnItem(idx, field, val, shouldReRender = true) {

    const item = returnCart[idx];

    if (!item) return;

    let numericVal = parseFloat(val) || 0;

    if (field === 'qty') {

        if (numericVal > item.maxQty) {

            alert(`⚠️ الكمية لا يمكن أن تتجاوز الكمية المتاحة بالفاتورة وهي (${item.maxQty})`);

            numericVal = item.maxQty;

            const tbody = document.getElementById('returnCartBody');

            if (tbody) {

                const row = tbody.querySelector(`tr[data-index="${idx}"]`);

                if (row) {

                    const qtyInput = row.querySelector('input[inputmode="decimal"]');

                    if (qtyInput) qtyInput.value = numericVal;

                }

            }

        }

        item.qty = numericVal;

    } else if (field === 'price') {

        item.price = numericVal;

    }

    if (!shouldReRender) {

        const itemTotal = item.price * item.qty;

        const tbody = document.getElementById('returnCartBody');

        if (tbody) {

            const row = tbody.querySelector(`tr[data-index="${idx}"]`);

            if (row) {

                const totalCell = row.querySelector('.row-total');

                if (totalCell) totalCell.innerText = itemTotal.toFixed(2);

            }

        }

        updateReturnTotal();

    } else {

        renderReturnCart();

    }

}

function updatePurReturnItem(idx, field, val, shouldReRender = true) {

    const item = purReturnCart[idx];

    if (!item) return;

    let numericVal = parseFloat(val) || 0;

    if (field === 'qty') {

        if (numericVal > item.maxQty) {

            alert(`⚠️ الكمية لا يمكن أن تتجاوز الكمية المتاحة بالفاتورة وهي (${item.maxQty})`);

            numericVal = item.maxQty;

            const tbody = document.getElementById('purReturnCartBody');

            if (tbody) {

                const row = tbody.querySelector(`tr[data-index="${idx}"]`);

                if (row) {

                    const qtyInput = row.querySelector('input[inputmode="decimal"]');

                    if (qtyInput) qtyInput.value = numericVal;

                }

            }

        }

        item.qty = numericVal;

    } else if (field === 'price') {

        item.price = numericVal;

    }

    if (!shouldReRender) {

        const itemTotal = item.price * item.qty;

        const tbody = document.getElementById('purReturnCartBody');

        if (tbody) {

            const row = tbody.querySelector(`tr[data-index="${idx}"]`);

            if (row) {

                const totalCell = row.querySelector('.row-total');

                if (totalCell) totalCell.innerText = itemTotal.toFixed(2);

            }

        }

        updateReturnTotal('purchase');

    } else {

        renderPurReturnCart();

    }

}

function updateReturnQty(idx, val) {

    // بقيت هنا للتوافق مع استدعاءات قديمة إن وجدت

    updateReturnItem(idx, 'qty', val, true);

}

async function saveSalesReturn(force = false, accountChecked = false) {

    if (!checkPermission('docs_return')) return false;

    if (window.isSavingTransaction) return false;

    window.isSavingTransaction = true;

    // تعطيل أزرار الحفظ فوراً لمنع الضغط المزدوج
    const saveBtns = document.querySelectorAll('#sales-return-section .btn-save, #sales-return-section .action-btn');
    saveBtns.forEach(b => { b.disabled = true; b.style.pointerEvents = 'none'; b.style.opacity = '0.6'; });

    try {

        // --- 🛑 التحقق من حدود الباقة المجانية ---

        const currentPlan = window.getBayanPlan();

        if (!isEditMode && !window.enforceSubscriptionCheck('invoice')) {
            return false;
        }

        if (returnCart.length === 0) {

            alert("⚠️ لا توجد أصناف للمرتجع! لا يمكن الحفظ.");

            return false;

        }

        let partner = document.getElementById('salesReturnAccountInput')?.value || document.getElementById('salesReturnPartnerDisplay')?.innerText || '';
        if (partner === '---') partner = '';
        partner = partner.trim();

        const selectedMethod = (typeof getSelectedPaymentMethod === 'function') 
            ? getSelectedPaymentMethod('sales-return-section') 
            : (document.getElementById('sales-return-sectionPaymentMethodSelect')?.value || 'نقدي');
        const method = selectedMethod;
        const isCredit = (typeof window.isTransactionCredit === 'function') ? window.isTransactionCredit(method, 1, 0, 1) : false;

        if (!accountChecked) {
            const ok = await window.ensurePartnerAccountExists(partner, 'عميل', isCredit, () => {
                window.isSavingTransaction = false;
                saveSalesReturn(force, true);
            });
            if (!ok) return false;
        }

        const finalPartner = partner || 'عميل عام';

        if (finalPartner && finalPartner !== 'عميل عام' && finalPartner !== '---' && typeof checkAccountFrozenAndAlert === 'function') {
            if (checkAccountFrozenAndAlert(finalPartner)) {
                return false;
            }
        }

        const originalInvoiceId = (document.getElementById('salesReturnInvoiceDisplay')?.innerText || '').trim();

        // 🛑 فحص الأمان: التحقق من سياسة إلزام الفاتورة الأصلية لمنع التلاعب بأموال الخزينة
        const posSettings = JSON.parse(getStore('pos_settings') || '{}');
        const requireOrigInv = (posSettings.requireOriginalInvoiceForReturn !== undefined) 
            ? !!posSettings.requireOriginalInvoiceForReturn 
            : true;

        if (requireOrigInv && (!originalInvoiceId || originalInvoiceId === '---' || originalInvoiceId === '')) {
            if (window.BayanBarcode && typeof BayanBarcode.playBeep === 'function') {
                BayanBarcode.playBeep(false);
            }
            saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
            window.isSavingTransaction = false;

            showCustomAlert({
                type: 'error',
                titleText: '🚫 المرتجع مقيد بفاتورة أصلية',
                msg: 'عذراً، سياسة أمان النظام تمنع إجراء أي مرتجع نقدي إلا باستدعاء فاتورة بيع أصلية مسجلة بالنظام لضمان عدم التلاعب بالخزينة أو صرف مبالغ غير حقيقية.\n\nيرجى الضغط على زر (استدعاء فاتورة) واختيار الفاتورة أولاً.'
            });
            return false;
        }

        // 🛑 فحص حاسم: التأكد من عدم تجاوز كمية أي صنف للكمية المتاحة في الفاتورة الأصلية
        if (originalInvoiceId && originalInvoiceId !== '---') {
            const cleanStr = (s) => (s || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            for (const item of returnCart) {
                const itemClean = cleanStr(item.name);
                const itemSize = (item.selectedSize || item.size || '').trim();
                const itemColor = (item.selectedColor || item.color || '').trim();

                const origItems = transactions.filter(t => 
                    String(t.invoiceId) === String(originalInvoiceId) && 
                    (cleanStr(t.product) === itemClean || cleanStr(t.productName) === itemClean || (item.id && (t.productId == item.id || t.product == item.id))) && 
                    (!itemSize || (t.size || t.selectedSize || '').trim() === itemSize) &&
                    (!itemColor || (t.color || t.selectedColor || '').trim() === itemColor) &&
                    t.type && t.type.includes('بيع') && !t.type.includes('مرتجع')
                );
                
                const totalSoldQty = origItems.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
                
                if (totalSoldQty > 0) {
                    const otherReturns = transactions.filter(t => 
                        String(t.originalInvoiceId) === String(originalInvoiceId) && 
                        (cleanStr(t.product) === itemClean || cleanStr(t.productName) === itemClean || (item.id && (t.productId == item.id || t.product == item.id))) && 
                        (!itemSize || (t.size || t.selectedSize || '').trim() === itemSize) &&
                        (!itemColor || (t.color || t.selectedColor || '').trim() === itemColor) &&
                        t.type && t.type.includes('مرتجع') &&
                        (!isEditMode || String(t.invoiceId) !== String(editingInvoiceId))
                    );
                    const alreadyReturned = otherReturns.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
                    const maxAllowed = Math.max(0, totalSoldQty - alreadyReturned);

                    if (item.qty > maxAllowed) {
                        const varLabel = (itemSize || itemColor) ? ` (${[itemSize, itemColor].filter(Boolean).join(' - ')})` : '';
                        saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
                        window.isSavingTransaction = false;
                        showCustomAlert({
                            type: 'error',
                            titleText: '⚠️ خطأ في كمية المرتجع',
                            msg: `الكمية المراد إرجاعها للصنف "<b>${item.name}${varLabel}</b>" هي (<b>${item.qty}</b>) وتتجاوز أقصى كمية مسموح بإرجاعها من الفاتورة الأصلية رقم #${originalInvoiceId} وهي (<b>${maxAllowed}</b>).`
                        });
                        return false;
                    }
                }
            }
        }

        const reason = document.getElementById('salesReturnReason').value;

        const dt = getTransactionDateTime('salesReturnDate', 'salesReturnTime');

        const subTotal = returnCart.reduce((sum, i) => sum + (i.price * i.qty), 0);

        const discVal = parseFloat(document.getElementById('salesReturnDiscount').value) || 0;

        const discType = document.getElementById('salesReturnDiscountType').value;

        const discAmount = (discType === 'perc') ? (subTotal * discVal / 100) : discVal;

        const taxVal = parseFloat(document.getElementById('salesReturnTax').value) || 0;

        const taxType = document.getElementById('salesReturnTaxType').value;

        const taxAmount = (taxType === 'perc') ? (subTotal * taxVal / 100) : taxVal;

        const finalTotal = subTotal - discAmount + taxAmount;

        const ratio = subTotal > 0 ? (finalTotal / subTotal) : 1;

        // isCash محدد من خيار المستخدم في الواجهة
        const isCash = !isCredit;

        // 🛑 فحص الفواتير الآجلة: تنبيه الكاشير إذا كانت الفاتورة الأصلية آجلة وعليها دين
        if (isCash && originalInvoiceId && !force) {
            const origInvTrans = transactions.filter(t => String(t.invoiceId) === String(originalInvoiceId) && t.type && t.type.includes('بيع') && !t.type.includes('مرتجع'));
            const origWasCredit = origInvTrans.some(t => {
                const m = String(t.method || '');
                return m.includes('آجل') || m.includes('حساب') || (t.paidAmount !== undefined && parseFloat(t.paidAmount) < parseFloat(t.total));
            });
            const clientBal = typeof getAccountBalance === 'function' ? getAccountBalance(finalPartner) : 0;
            if (origWasCredit && clientBal > 0) {
                saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
                window.isSavingTransaction = false;
                showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه: الفاتورة الأصلية مسجلة بالآجل',
                    msg: `الفاتورة الأصلية رقم #${originalInvoiceId} كانت بالآجل، والعميل "<b>${finalPartner}</b>" عليه مديونية حالية قدرها (<b>${clientBal.toFixed(2)} ج.م</b>).<br><br>هل تريد <b>خصم قيمة المرتجع من مديونية العميل</b> أم صرفها <b>نقداً من الخزينة</b>؟`,
                    showCancel: true,
                    confirmText: 'خصم من حساب العميل (الموصى به)',
                    cancelText: 'صرف كاش من الخزينة',
                    onConfirm: () => {
                        const sel = document.getElementById('sales-return-sectionPaymentMethodSelect');
                        if (sel) {
                            const creditOpt = Array.from(sel.options).find(o => 
                                o.value.includes('خصم') || o.value.includes('أجل') || o.value.includes('حساب') ||
                                o.text.includes('خصم') || o.text.includes('أجل') || o.text.includes('حساب')
                            );
                            if (creditOpt) sel.value = creditOpt.value;
                            else sel.value = 'خصم من حساب العميل';
                        }
                        saveSalesReturn(true, true);
                    },
                    onCancel: () => {
                        saveSalesReturn(true, true);
                    }
                });
                return false;
            }
        }

        // 🛑 فحص رصيد الدرج / الخزينة قبل صرف المرتجع النقدي
        if (isCash && !force) {
            const currentCash = (function() {
                let c = 0;
                const isNonCash = (m) => {
                    if (!m) return false;
                    const s = String(m).toLowerCase();
                    return s.includes('فيزا') || s.includes('بنك') || s.includes('شيك') || s.includes('تحويل') || s.includes('آجل') || s.includes('حساب');
                };
                (window.transactions || []).forEach(t => {
                    if (isNonCash(t.method)) return;
                    const type = t.type || '';
                    const amt = (t.isInvoiceHead || t.isInvoiceHead === undefined) ? (parseFloat(t.paidAmount !== undefined ? t.paidAmount : (t.paid !== undefined ? t.paid : t.total)) || 0) : 0;
                    if (type.includes('بيع') && !type.includes('مرتجع')) c += amt;
                    else if (type.includes('قبض')) c += (parseFloat(t.total) || 0);
                    else if (type.includes('مرتجع شراء')) c += amt;
                    else if (type.includes('شراء') && !type.includes('مرتجع')) c -= amt;
                    else if (type.includes('صرف')) c -= (parseFloat(t.total) || 0);
                    else if (type.includes('مرتجع بيع')) c -= amt;
                });
                return c;
            })();
            if (currentCash < finalTotal) {
                saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
                window.isSavingTransaction = false;
                showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ رصيد الخزينة غير كافٍ',
                    msg: `مبلغ المرتجع المطلوب صرفه نقداً هو (<b>${finalTotal.toFixed(2)} ج.م</b>) بينما النقدية المتوفرة بالدرج حالياً هي (<b>${currentCash.toFixed(2)} ج.م</b>).<br><br>هل تريد المتابعة والسماح برصيد سالب بالدرج؟`,
                    showCancel: true,
                    confirmText: 'نعم، تابع واصرف',
                    cancelText: 'إلغاء المرتجع',
                    onConfirm: () => {
                        saveSalesReturn(true, true);
                    }
                });
                return false;
            }
        }

        let returnInvoiceId;

        if (isEditMode && editingInvoiceId) {

            returnInvoiceId = editingInvoiceId;

            if (window.revertAndClearOldInvoice) {

                await window.revertAndClearOldInvoice(editingInvoiceId, editingInvoiceType);

            }

        } else {

            returnInvoiceId = getNextSequence('مرتجع بيع');

        }

        const newReturnRows = [];
        const affectedProducts = [];

        returnCart.forEach((item, idx) => {

            const p = productsDB.find(x => x && (x.name === item.name || x.id === item.id));

            const factor = parseFloat(item.unitFactor) || 1;

            const baseQty = (parseFloat(item.qty) || 0) * factor;

            const sSize = String(item.selectedSize || item.size || '').trim();
            const sColor = String(item.selectedColor || item.color || '').trim();

            // تحديد المخزن: من الصنف المرتجع، أو مخزن المستخدم الحالي الحاضر (أولوية للمقر الفعلي)، أو الفاتورة الأصلية، أو الرئيسي
            const origMatch = originalInvoiceId ? (transactions.find(t => 
                String(t.invoiceId) === String(originalInvoiceId) && 
                (t.product === item.name || t.productName === item.name) &&
                (!sSize || (t.size || t.selectedSize || '').trim() === sSize) &&
                (!sColor || (t.color || t.selectedColor || '').trim() === sColor) &&
                t.type && t.type.includes('بيع') && !t.type.includes('مرتجع')
            ) || transactions.find(t => 
                String(t.invoiceId) === String(originalInvoiceId) && 
                (t.product === item.name || t.productName === item.name) &&
                t.type && t.type.includes('بيع') && !t.type.includes('مرتجع')
            )) : null;

            const activeWH = (item.warehouse && item.warehouse.trim() !== '')
                ? item.warehouse.trim()
                : (((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : (origMatch ? origMatch.warehouse : 'المخزن الرئيسي')) || 'المخزن الرئيسي').trim();

            if (p) {
                p.stock = (parseFloat(p.stock) || 0) + baseQty;
                if (!p.warehouseStocks) p.warehouseStocks = {};
                p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;

                // تحديث رصيد التشكيلة (المقاس واللون) في مصفوفة الصنف بدقة وتطابق تام
                if (p.variants && Array.isArray(p.variants)) {
                    if (sSize || sColor) {
                        const cleanV = (s) => String(s || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
                        const cSize = cleanV(sSize);
                        const cColor = cleanV(sColor);
                        const matchedVar = p.variants.find(v => 
                            (!cSize || cleanV(v.size) === cSize) && 
                            (!cColor || cleanV(v.color) === cColor)
                        );
                        if (matchedVar) {
                            matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                            if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                            matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                        }
                    }
                    if (p.variants.length > 0) {
                        p.stock = p.variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
                        if (!p.warehouseStocks) p.warehouseStocks = {};
                        p.warehouseStocks[activeWH] = p.variants.reduce((sum, v) => {
                            const vWh = (v.warehouseStocks && v.warehouseStocks[activeWH] !== undefined)
                                ? parseFloat(v.warehouseStocks[activeWH])
                                : (activeWH === 'المخزن الرئيسي' ? (parseFloat(v.stock) || 0) : 0);
                            return sum + vWh;
                        }, 0);
                    }
                }

                if (!affectedProducts.some(ap => ap.id === p.id)) {
                    affectedProducts.push(p);
                }
            }

            const itemNetTotal = parseFloat((item.price * item.qty * ratio).toFixed(2));

            // حساب الربح "المسترد" بناءً على هامش ربح الصنف والمقاس نفسه في الفاتورة الأصلية بدقة
            const originalInvItem = transactions.find(t => 
                String(t.invoiceId) === String(originalInvoiceId) && 
                (t.product === item.name || t.productName === item.name) && 
                (t.type && t.type.includes('بيع') && !t.type.includes('مرتجع')) &&
                (!sSize || String(t.size || t.selectedSize || '').trim() === sSize) &&
                (!sColor || String(t.color || t.selectedColor || '').trim() === sColor)
            ) || transactions.find(t => 
                String(t.invoiceId) === String(originalInvoiceId) && 
                (t.product === item.name || t.productName === item.name) && 
                (t.type && t.type.includes('بيع') && !t.type.includes('مرتجع'))
            );

            let profitLost = 0;
            if (originalInvItem) {
                const origQty = parseFloat(originalInvItem.qty) || 1;
                const origProfit = parseFloat(originalInvItem.profit) || 0;
                const origUnitProfit = origProfit / origQty;
                profitLost = -(origUnitProfit * item.qty);
            } else {
                const baseCost = p ? (parseFloat(p.cost) || 0) : 0;
                const itemTotalCost = baseCost * baseQty;
                profitLost = -(itemNetTotal - itemTotalCost);
            }

            // جلب بيانات الفاتورة الأصلية للمرجعية

            const originalInv = transactions.find(t => t.invoiceId == originalInvoiceId && !t.type.includes('مرتجع'));

            const originalDate = originalInv ? originalInv.date : '-';

            const originalMethod = originalInv ? originalInv.method : '-';

            const originalPartner = originalInv ? originalInv.partner : '-';

            // الحساب المختار حالياً (مأخوذ من النطاق الخارجي finalPartner)

            const newReturnRow = {

                date: dt.full,

                dateISO: dt.iso,

                timeISO: dt.time,

                type: 'مرتجع بيع 🔄',

                method: selectedMethod,

                invoiceId: returnInvoiceId,

                originalInvoiceId: originalInvoiceId || '-',

                originalDate: originalDate,

                originalMethod: originalMethod,

                originalPartner: originalPartner,

                product: item.name,

                warehouse: activeWH,
                terminal: (window.BayanNetworkHub && typeof window.BayanNetworkHub.getTerminalDisplayName === 'function') ? window.BayanNetworkHub.getTerminalDisplayName() : 'الجهاز الرئيسي 💻',
                terminalLetter: (window.BayanNetworkHub && typeof window.BayanNetworkHub.getTerminalLetter === 'function') ? window.BayanNetworkHub.getTerminalLetter() : 'MASTER',
                terminalOrder: (window.BayanNetworkHub && typeof window.BayanNetworkHub.getPairingOrder === 'function') ? window.BayanNetworkHub.getPairingOrder() : 0,
                terminalId: (window.BayanNetworkHub && window.BayanNetworkHub.deviceId) || '',

                unit: item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة'),

                size: item.selectedSize || item.size || '',

                color: item.selectedColor || item.color || '',

                qty: item.qty,

                price: item.price,

                total: itemNetTotal,

                profit: profitLost.toFixed(2), // حفظ الربح المفقود

                partner: finalPartner,

                reason: reason,

                user: currentUser ? currentUser.name : '-',

                paidAmount: (idx === 0) ? (isCash ? finalTotal : 0) : 0,

                isInvoiceHead: (idx === 0),

                unitFactor: factor,

                editDate: isEditMode ? new Date().toLocaleString('ar-EG') : '-'

            };

            transactions.push(newReturnRow);
            newReturnRows.push(newReturnRow);

        });

        if (originalInvoiceId && originalInvoiceId !== '---') {

            transactions.forEach(t => {

                if (t.invoiceId == originalInvoiceId && t.type.includes('بيع') && !t.type.includes('مرتجع')) {

                    t.is_returned = true;

                }

            });

        }

        // ⚡ حفظ فائق السرعة للمعاملات والأصناف المتأثرة (جديد وتعديل)
        if (typeof window.saveTransactionChanges === 'function') {
            const affectedAccountsList = [];
            if (!isCash && finalPartner && Array.isArray(accounts)) {
                const targetAcc = accounts.find(a => a.name === finalPartner);
                if (targetAcc) affectedAccountsList.push(targetAcc);
            }
            await window.saveTransactionChanges({
                newTransactions: newReturnRows,
                modifiedProducts: affectedProducts,
                modifiedAccounts: affectedAccountsList
            });
        } else {
            await saveData();
        }
        if (typeof window.invalidateAccountBalancesCache === 'function') window.invalidateAccountBalancesCache();
        window.accountBalancesCache = {};

        showCustomAlert({

            type: 'success',

            titleText: isEditMode ? '✅ تم تحديث المرتجع' : '✅ تم حفظ المرتجع',

            msg: `تم ${isEditMode ? 'تحديث' : 'حفظ'} مرتجع البيع رقم #${returnInvoiceId} بنجاح.`

        });

        isEditMode = false;

        editingInvoiceId = null;

        editingOriginalDate = null;

        editingInvoiceType = null;

        // تم إيقاف الطباعة التلقائية بناءً على طلب المستخدم (الحفظ فقط)

        // if (typeof printReturnReceipt === 'function') printReturnReceipt('sales');

        resetReturn();

        // العودة للسجل

        viewOldInvoice(returnInvoiceId, 'مرتجع بيع', true);

        return true;

    } finally {

        const saveBtns = document.querySelectorAll('#sales-return-section .btn-save, #sales-return-section .action-btn');
        saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
        window.isSavingTransaction = false;

    }

}

function printReturnReceipt(type = 'sales') {
    const isSalesRet = (type === 'sales' || type === 'salesReturn');
    const partner = isSalesRet 
        ? (document.getElementById('salesReturnPartnerDisplay')?.innerText || document.getElementById('salesReturnAccountInput')?.value || 'عميل نقدي')
        : (document.getElementById('purReturnPartnerDisplay')?.innerText || document.getElementById('purReturnAccountInput')?.value || 'مورد نقدي');
    const invId = isSalesRet 
        ? (document.getElementById('salesReturnBadgeID')?.innerText || 'RET-01')
        : (document.getElementById('purReturnBadgeID')?.innerText || 'PRET-01');
    const cartArr = isSalesRet 
        ? (typeof returnCart !== 'undefined' ? returnCart : []) 
        : (typeof purReturnCart !== 'undefined' ? purReturnCart : []);

    if (cartArr.length > 0 && typeof printInvoice === 'function') {
        const subTotal = cartArr.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 1)), 0);
        printInvoice({
            invoiceNumber: invId,
            invoiceType: isSalesRet ? 'مرتجع مبيعات' : 'مرتجع مشتريات',
            paymentMethod: 'نقدي',
            isReturn: true,
            isPurchase: !isSalesRet,
            docTitle: isSalesRet ? 'مرتجع مبيعات' : 'مرتجع مشتريات',
            docType: isSalesRet ? 'return_sales' : 'return_purchase',
            date: new Date().toLocaleDateString('en-CA'),
            time: new Date().toTimeString().slice(0, 5),
            cashier: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '',
            customer: partner,
            items: cartArr.map(it => ({
                name: it.name || it.product,
                qty: parseFloat(it.qty || 1),
                price: parseFloat(it.price || 0),
                total: parseFloat(it.total != null ? it.total : ((parseFloat(it.price) || 0) * (parseFloat(it.qty) || 1))),
                unit: it.unit || 'قطعة',
                size: it.size || it.selectedSize || (it.selectedVariant && it.selectedVariant.size) || '',
                color: it.color || it.selectedColor || (it.selectedVariant && it.selectedVariant.color) || ''
            })),
            totalAmount: subTotal,
            paid: subTotal,
            deferred: 0
        });
        return;
    }

    const sectionType = (type === 'purchase' || type === 'purchaseReturn') ? 'purchaseReturn' : 'salesReturn';
    if (typeof prepareBillHTML === 'function') prepareBillHTML(sectionType);
    const receiptArea = document.getElementById('receipt-area');
    if (receiptArea && receiptArea.children.length > 0 && receiptArea.innerText.trim() !== '') {
        if (typeof exportElementToPDF === 'function') {
            exportElementToPDF(receiptArea, type === 'sales' ? 'مرتجع_مبيعات' : 'مرتجع_مشتريات');
        } else {
            window.print();
        }
    } else {
        if (typeof exportCurrentBill === 'function') exportCurrentBill(sectionType, 'pdf');
        else if (typeof showToast === 'function') showToast("⚠️ لا توجد بيانات مرتجع للطباعة حالياً", "warning");
    }
}
window.printReturnReceipt = printReturnReceipt;

function resetReturn() {

    returnCart = [];

    if (document.getElementById('returnProductSearch')) document.getElementById('returnProductSearch').value = '';

    if (document.getElementById('salesReturnAccountInput')) document.getElementById('salesReturnAccountInput').value = '';

    const partnerDisp = document.getElementById('salesReturnPartnerDisplay');

    if (partnerDisp) partnerDisp.innerText = '---';

    const invDisp = document.getElementById('salesReturnInvoiceDisplay');

    if (invDisp) invDisp.innerText = '---';

    const now = new Date();

    if (document.getElementById('salesReturnDate')) document.getElementById('salesReturnDate').value = now.toLocaleDateString('en-CA');

    if (document.getElementById('salesReturnTime')) document.getElementById('salesReturnTime').value = now.toTimeString().slice(0, 5);

    if (document.getElementById('returnItemsCount')) document.getElementById('returnItemsCount').innerText = '0';

    if (document.getElementById('returnTotalQty')) document.getElementById('returnTotalQty').innerText = '0';

    const nextId = getNextSequence('مرتجع بيع');

    if (document.getElementById('salesReturnBadgeID')) document.getElementById('salesReturnBadgeID').innerText = nextId;

    renderReturnCart();

}

// --- 2. مرتجع الشراء (Purchase Return) ---

function renderPurReturnCart() {

    const tbody = document.getElementById('purReturnCartBody');

    tbody.innerHTML = '';

    let subTotal = 0;

    let totalQty = 0;

    purReturnCart.forEach((item, idx) => {

        const itemTotal = item.price * item.qty;

        subTotal += itemTotal;

        totalQty += (parseFloat(item.qty) || 0);

        const product = productsDB.find(p => p.name === item.name);

        let unitOptions = `<option value="base" ${!item.selectedUnit ? 'selected' : ''}>${(product ? product.unit : 'قطعة') || 'قطعة'}</option>`;

        if (product && product.units && product.units.length > 0) {

            unitOptions = product.units.map(u =>

                `<option value="${u.unitName}" ${item.selectedUnit && item.selectedUnit.unitName === u.unitName ? 'selected' : ''}>${u.unitName}</option>`

            ).join('');

        }

        const { sizeElement, colorElement } = renderVariantSelectElements(item, idx, 'purReturn');

        const tr = document.createElement('tr');
        tr.setAttribute('data-index', idx);
        tr.innerHTML = `
                    <td style="text-align: center; color: #94a3b8; font-size: 0.8rem;">${idx + 1}</td>
                    <td style="font-size: 0.85rem; color: #64748b; text-align: center; font-family: monospace;">${item.code || '---'}</td>
                    <td style="font-weight: 600; color: #1e293b;">${item.name}</td>
                    <td class="col-variant-size" style="text-align: center;">${sizeElement}</td>
                    <td class="col-variant-color" style="text-align: center;">${colorElement}</td>
                    <td>
                        <select class="unit-select" onchange="updatePurReturnItemUnit(${idx}, this.value)" ${item.invoiceId ? 'disabled' : ''} 
                            style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 0.9rem; ${item.invoiceId ? 'opacity: 0.7; cursor: not-allowed;' : ''}">
                            ${unitOptions}
                        </select>
                    </td>

                    <td>

                        <input type="text" value="${item.qty}" 

                               inputmode="decimal"

                               oninput="this.value = this.value.replace(/[^0-9.]/g, ''); updatePurReturnItem(${idx}, 'qty', this.value, false)" 

                               onchange="updatePurReturnItem(${idx}, 'qty', this.value, true)"

                               onclick="this.select()" 

                               style="width: 100%; text-align: center; border: 1px solid transparent; background: transparent; padding: 6px; font-weight: bold; font-size: 1rem; color: #1e293b;">

                    </td>

                    <td>

                        <input type="text" value="${(parseFloat(item.price) || 0).toFixed(2)}" 

                               inputmode="decimal"

                               oninput="this.value = this.value.replace(/[^0-9.]/g, ''); updatePurReturnItem(${idx}, 'price', this.value, false)" 

                               onchange="updatePurReturnItem(${idx}, 'price', this.value, true)"

                               onclick="this.select()" 

                               style="width: 100%; text-align: center; border: 1px solid transparent; background: transparent; padding: 6px; font-weight: 800; font-size: 1rem; color: #ef4444;">

                    </td>

                    <td class="row-total" style="text-align: center; font-weight: 800; color: #0f172a; font-size: 1rem;">${itemTotal.toFixed(2)}</td>

                    <td style="text-align: center; width: 50px;">

                        <button class="btn-delete-row-minimal" onclick="purReturnCart.splice(${idx},1); renderPurReturnCart();" title="حذف" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.2rem; opacity: 0.6; transition: 0.2s;">🗑️</button>

                    </td>

                `;

        tbody.appendChild(tr);

    });

    if (document.getElementById('purReturnItemsCount')) document.getElementById('purReturnItemsCount').innerText = purReturnCart.length;

    if (document.getElementById('purReturnTotalQty')) document.getElementById('purReturnTotalQty').innerText = totalQty;

    updateReturnTotal('purchase');

}

function updatePurReturnItemUnit(idx, unitName) {

    const item = purReturnCart[idx];

    const product = productsDB.find(p => p.name === item.name);

    if (!product) return;

    const unit = product.units ? product.units.find(u => u.unitName === unitName) : null;

    if (unit) {

        item.selectedUnit = unit;

        item.unitFactor = parseFloat(unit.factor) || 1;

        item.price = parseFloat(unit.cost) || 0;

    } else {

        item.selectedUnit = null;

        item.unitFactor = 1;

        item.price = parseFloat(product.cost) || 0;

    }

    renderPurReturnCart();

}

function updatePurReturnQty(idx, val) {

    updatePurReturnItem(idx, 'qty', val, true);

}

async function savePurchaseReturn(force = false, accountChecked = false) {

    if (!checkPermission('docs_return')) return false;

    if (window.isSavingTransaction) return false;

    window.isSavingTransaction = true;

    // تعطيل أزرار الحفظ فوراً لمنع الضغط المزدوج
    const saveBtns = document.querySelectorAll('#purchase-return-section .btn-save, #purchase-return-section .action-btn');
    saveBtns.forEach(b => { b.disabled = true; b.style.pointerEvents = 'none'; b.style.opacity = '0.6'; });

    try {

        // --- 🛑 التحقق من حدود الباقة المجانية ---

        const currentPlan = window.getBayanPlan();

        if (!isEditMode && !window.enforceSubscriptionCheck('invoice')) {
            return false;
        }

        if (purReturnCart.length === 0) {

            alert("⚠️ لا توجد أصناف للمرتجع! لا يمكن الحفظ.");

            return false;

        }

        let partner = document.getElementById('purReturnAccountInput')?.value || document.getElementById('purReturnPartnerDisplay')?.innerText || '';
        if (partner === '---') partner = '';
        partner = partner.trim();

        const reason = document.getElementById('purReturnReason').value;

        const dt = getTransactionDateTime('purReturnDate', 'purReturnTime');

        const selectedMethod = (typeof getSelectedPaymentMethod === 'function') 
            ? getSelectedPaymentMethod('purchase-return-section') 
            : (document.getElementById('purchase-return-sectionPaymentMethodSelect')?.value || 'نقدي (إلى الخزنة)');
        const method = selectedMethod;
        const isCredit = (typeof window.isTransactionCredit === 'function') ? window.isTransactionCredit(method, 1, 0, 1) : false;

        if (!accountChecked) {
            const ok = await window.ensurePartnerAccountExists(partner, 'مورد', isCredit, () => {
                window.isSavingTransaction = false;
                savePurchaseReturn(force, true);
            });
            if (!ok) return false;
        }

        const finalPartner = partner || 'مورد عام';

        if (finalPartner && finalPartner !== 'مورد عام' && finalPartner !== '---' && typeof checkAccountFrozenAndAlert === 'function') {
            if (checkAccountFrozenAndAlert(finalPartner)) {
                return false;
            }
        }

        const isCash = !isCredit;

        const subTotal = purReturnCart.reduce((a, b) => a + (b.price * b.qty), 0);

        const discVal = parseFloat(document.getElementById('purReturnDiscount').value) || 0;

        const discType = document.getElementById('purReturnDiscountType').value;

        const discAmount = (discType === 'perc') ? (subTotal * discVal / 100) : discVal;

        const taxVal = parseFloat(document.getElementById('purReturnTax').value) || 0;

        const taxType = document.getElementById('purReturnTaxType').value;

        const taxAmount = (taxType === 'perc') ? (subTotal * taxVal / 100) : taxVal;

        const finalTotal = subTotal - discAmount + taxAmount;

        const ratio = subTotal > 0 ? (finalTotal / subTotal) : 1;

        const originalInvoiceId = (document.getElementById('purReturnInvoiceDisplay')?.innerText || '').trim();

        // 🛑 فحص فواتير الشراء الآجلة: تنبيه المستخدم إذا كانت الفاتورة الأصلية مسجلة بالآجل والمورد له مستحقات
        if (isCash && originalInvoiceId && originalInvoiceId !== '---' && !force) {
            const origInvTrans = transactions.filter(t => String(t.invoiceId) === String(originalInvoiceId) && t.type && t.type.includes('شراء') && !t.type.includes('مرتجع'));
            const origWasCredit = origInvTrans.some(t => {
                const m = String(t.method || '');
                return m.includes('آجل') || m.includes('حساب') || (t.paidAmount !== undefined && parseFloat(t.paidAmount) < parseFloat(t.total));
            });
            const suppBal = typeof getAccountBalance === 'function' ? getAccountBalance(finalPartner) : 0;
            if (origWasCredit && suppBal < 0) {
                saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
                window.isSavingTransaction = false;
                showCustomAlert({
                    type: 'warning',
                    titleText: '⚠️ تنبيه: فاتورة الشراء الأصلية مسجلة بالآجل',
                    msg: `فاتورة الشراء الأصلية رقم #${originalInvoiceId} كانت بالآجل، والمورد "<b>${finalPartner}</b>" له مستحقات مفتوحة قدرها (<b>${Math.abs(suppBal).toFixed(2)} ج.م</b>).<br><br>هل تريد <b>خصم قيمة المرتجع من حساب المورد</b> أم استردادها <b>نقداً إلى الخزينة</b>؟`,
                    showCancel: true,
                    confirmText: 'خصم من حساب المورد (الموصى به)',
                    cancelText: 'استرداد نقدي للخزينة',
                    onConfirm: () => {
                        const sel = document.getElementById('purchase-return-sectionPaymentMethodSelect');
                        if (sel) {
                            const creditOpt = Array.from(sel.options).find(o => 
                                o.value.includes('خصم') || o.value.includes('أجل') || o.value.includes('حساب') ||
                                o.text.includes('خصم') || o.text.includes('أجل') || o.text.includes('حساب')
                            );
                            if (creditOpt) sel.value = creditOpt.value;
                            else sel.value = 'خصم من حساب المورد';
                        }
                        savePurchaseReturn(true, true);
                    },
                    onCancel: () => {
                        savePurchaseReturn(true, true);
                    }
                });
                return false;
            }
        }

        let returnInvoiceId;

        if (isEditMode && editingInvoiceId) {

            returnInvoiceId = editingInvoiceId;

            if (window.revertAndClearOldInvoice) {

                await window.revertAndClearOldInvoice(editingInvoiceId, editingInvoiceType);

            }

        } else {

            returnInvoiceId = getNextSequence('مرتجع شراء');

        }

        // 🛑 فحص حاسم: التأكد من عدم تجاوز كمية أي صنف للكمية المتاحة في الفاتورة الأصلية
        if (originalInvoiceId && originalInvoiceId !== '---') {
            const cleanStr = (s) => (s || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            for (const item of purReturnCart) {
                const itemClean = cleanStr(item.name);
                const itemSize = (item.selectedSize || item.size || '').trim();
                const itemColor = (item.selectedColor || item.color || '').trim();

                const origItems = transactions.filter(t => 
                    String(t.invoiceId) === String(originalInvoiceId) && 
                    (cleanStr(t.product) === itemClean || cleanStr(t.productName) === itemClean || (item.id && (t.productId == item.id || t.product == item.id))) && 
                    (!itemSize || (t.size || t.selectedSize || '').trim() === itemSize) &&
                    (!itemColor || (t.color || t.selectedColor || '').trim() === itemColor) &&
                    t.type && t.type.includes('شراء') && !t.type.includes('مرتجع')
                );
                
                const totalBoughtQty = origItems.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
                
                if (totalBoughtQty > 0) {
                    const otherReturns = transactions.filter(t => 
                        String(t.originalInvoiceId) === String(originalInvoiceId) && 
                        (cleanStr(t.product) === itemClean || cleanStr(t.productName) === itemClean || (item.id && (t.productId == item.id || t.product == item.id))) && 
                        (!itemSize || (t.size || t.selectedSize || '').trim() === itemSize) &&
                        (!itemColor || (t.color || t.selectedColor || '').trim() === itemColor) &&
                        t.type && t.type.includes('مرتجع') &&
                        (!isEditMode || String(t.invoiceId) !== String(editingInvoiceId))
                    );
                    const alreadyReturned = otherReturns.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
                    const maxAllowed = Math.max(0, totalBoughtQty - alreadyReturned);

                    if (item.qty > maxAllowed) {
                        const varLabel = (itemSize || itemColor) ? ` (${[itemSize, itemColor].filter(Boolean).join(' - ')})` : '';
                        showCustomAlert({
                            type: 'error',
                            titleText: '⚠️ خطأ في كمية المرتجع',
                            msg: `الكمية المراد إرجاعها للصنف "<b>${item.name}${varLabel}</b>" هي (<b>${item.qty}</b>) وتتجاوز أقصى كمية مسموح بإرجاعها من الفاتورة الأصلية رقم #${originalInvoiceId} وهي (<b>${maxAllowed}</b>).`
                        });
                        return false;
                    }
                }
            }
        }

        // 🛑 فحص رصيد المخزن المتاح لمرتجع الشراء (منع إرجاع بضاعة غير متوفرة بالمخزن)
        let purReturnStockErrors = [];
        purReturnCart.forEach(item => {
            const p = productsDB.find(x => x.name === item.name || x.id === item.id);
            if (p) {
                const factor = item.unitFactor || 1;
                const baseQty = item.qty * factor;
                let effVariant = null;
                if (p.variants && Array.isArray(p.variants)) {
                    const sSize = item.selectedSize || item.size || '';
                    const sColor = item.selectedColor || item.color || '';
                    if (sSize || sColor) {
                        effVariant = p.variants.find(v => 
                            (!sSize || v.size === sSize) && 
                            (!sColor || v.color === sColor)
                        );
                    }
                }
                const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';
                const availStock = effVariant 
                    ? ((effVariant.warehouseStocks && effVariant.warehouseStocks[activeWH] !== undefined) ? (parseFloat(effVariant.warehouseStocks[activeWH]) || 0) : (parseFloat(effVariant.stock) || 0)) 
                    : ((p.warehouseStocks && p.warehouseStocks[activeWH] !== undefined) ? (parseFloat(p.warehouseStocks[activeWH]) || 0) : (parseFloat(p.stock) || 0));
                if (baseQty > availStock) {
                    const variantInfo = effVariant ? ` [${effVariant.size || ''} ${effVariant.color || ''}]` : '';
                    const availInUnit = (availStock / factor).toFixed(2).replace(/\.00$/, '');
                    purReturnStockErrors.push(`❌ ${item.name}${variantInfo}: مطلوب إرجاعه (${item.qty}) / متوفر بالمخزن (${availInUnit})`);
                }
            }
        });

        if (purReturnStockErrors.length > 0) {
            showCustomAlert({
                type: 'error',
                titleText: '🚫 رصيد المخزن غير كافٍ لمرتجع الشراء',
                msg: 'لا يمكن إتمام مرتجع الشراء لأن الكميات التالية غير متوفرة في مخزنك حالياً:\n\n' + purReturnStockErrors.join('\n') + '\n\nيرجى مراجعة وتعديل الكميات للمتابعة.',
                confirmText: 'حسناً، فهمت'
            });
            return false;
        }

        const newPurReturnRows = [];
        const affectedProducts = [];

        purReturnCart.forEach((item, idx) => {

            const p = productsDB.find(x => x && (x.name === item.name || x.id === item.id));

            const factor = parseFloat(item.unitFactor) || 1;

            const baseQty = (parseFloat(item.qty) || 0) * factor;

            // تحديد المخزن: من الصنف المرتجع، أو مخزن المستخدم الحالي الحاضر (أولوية للمقر الفعلي)، أو الفاتورة الأصلية، أو الرئيسي
            const origMatch = originalInvoiceId ? transactions.find(t => String(t.invoiceId) === String(originalInvoiceId) && (t.product === item.name || t.productName === item.name)) : null;
            const activeWH = (item.warehouse || (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || (origMatch && origMatch.warehouse) || 'المخزن الرئيسي').trim();

            if (p) {
                p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                if (!p.warehouseStocks || typeof p.warehouseStocks !== 'object') p.warehouseStocks = {};
                p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);

                // تحديث رصيد التشكيلة (المقاس واللون) في مصفوفة الصنف عند مرتجع الشراء بدقة وتطابق تام
                if (p.variants && Array.isArray(p.variants)) {
                    const sSize = String(item.selectedSize || item.size || '').trim();
                    const sColor = String(item.selectedColor || item.color || '').trim();
                    if (sSize || sColor) {
                        const cleanV = (s) => String(s || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
                        const cSize = cleanV(sSize);
                        const cColor = cleanV(sColor);
                        const matchedVar = p.variants.find(v => 
                            (!cSize || cleanV(v.size) === cSize) && 
                            (!cColor || cleanV(v.color) === cColor)
                        );
                        if (matchedVar) {
                            matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                            if (!matchedVar.warehouseStocks || typeof matchedVar.warehouseStocks !== 'object') matchedVar.warehouseStocks = {};
                            matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                        }
                    }
                    if (p.variants.length > 0) {
                        p.stock = p.variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
                        if (!p.warehouseStocks) p.warehouseStocks = {};
                        p.warehouseStocks[activeWH] = p.variants.reduce((sum, v) => {
                            const vWh = (v.warehouseStocks && v.warehouseStocks[activeWH] !== undefined)
                                ? parseFloat(v.warehouseStocks[activeWH])
                                : (activeWH === 'المخزن الرئيسي' ? (parseFloat(v.stock) || 0) : 0);
                            return sum + vWh;
                        }, 0);
                    }
                }

                if (!affectedProducts.some(ap => ap.id === p.id)) {
                    affectedProducts.push(p);
                }
            }

            const itemNetTotal = parseFloat((item.price * item.qty * ratio).toFixed(2));

            // جلب بيانات الفاتورة الأصلية للمرجعية

            const originalInv = transactions.find(t => t.invoiceId == originalInvoiceId && !t.type.includes('مرتجع'));

            const originalDate = originalInv ? originalInv.date : '-';

            const originalMethod = originalInv ? originalInv.method : '-';

            const originalPartner = originalInv ? originalInv.partner : '-';

            // الحساب المختار حالياً (مأخوذ من النطاق الخارجي finalPartner)

            const newPurReturnRow = {

                date: dt.full,

                dateISO: dt.iso,

                timeISO: dt.time,

                type: 'مرتجع شراء 📤',

                method: isCash ? (selectedMethod || 'نقدي (استرداد للخزنة)') : (selectedMethod || 'خصم من حساب المورد'),

                invoiceId: returnInvoiceId,

                originalInvoiceId: originalInvoiceId || '-',

                originalDate: originalDate,

                originalMethod: originalMethod,

                originalPartner: originalPartner,

                product: item.name,

                warehouse: activeWH,
                terminal: (window.BayanNetworkHub && typeof window.BayanNetworkHub.getTerminalDisplayName === 'function') ? window.BayanNetworkHub.getTerminalDisplayName() : 'الجهاز الرئيسي 💻',
                terminalLetter: (window.BayanNetworkHub && typeof window.BayanNetworkHub.getTerminalLetter === 'function') ? window.BayanNetworkHub.getTerminalLetter() : 'MASTER',
                terminalOrder: (window.BayanNetworkHub && typeof window.BayanNetworkHub.getPairingOrder === 'function') ? window.BayanNetworkHub.getPairingOrder() : 0,
                terminalId: (window.BayanNetworkHub && window.BayanNetworkHub.deviceId) || '',

                unit: item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (p ? p.unit : 'قطعة'),

                size: item.selectedSize || item.size || '',

                color: item.selectedColor || item.color || '',

                qty: item.qty,

                price: item.price,

                total: itemNetTotal,

                profit: 0, // مرتجع الشراء ليس له ربح

                partner: finalPartner,

                reason: reason,

                user: currentUser ? currentUser.name : '-',

                paidAmount: (idx === 0) ? (isCash ? finalTotal : 0) : 0,

                isInvoiceHead: (idx === 0),

                unitFactor: factor,

                editDate: isEditMode ? new Date().toLocaleString('ar-EG') : '-'

            };

            transactions.push(newPurReturnRow);
            newPurReturnRows.push(newPurReturnRow);

        });

        if (originalInvoiceId && originalInvoiceId !== '---') {

            transactions.forEach(t => {

                if (t.invoiceId == originalInvoiceId && t.type.includes('شراء') && !t.type.includes('مرتجع')) {

                    t.is_returned = true;

                }

            });

        }

        // ⚡ حفظ فائق السرعة للمعاملات والأصناف المتأثرة (جديد وتعديل)
        if (typeof window.saveTransactionChanges === 'function') {
            await window.saveTransactionChanges({
                newTransactions: newPurReturnRows,
                modifiedProducts: affectedProducts
            });
        } else {
            await saveData();
        }
        if (typeof window.invalidateAccountBalancesCache === 'function') window.invalidateAccountBalancesCache();
        window.accountBalancesCache = {};

        showCustomAlert({

            type: 'success',

            titleText: isEditMode ? '✅ تم تحديث المرتجع' : '✅ تم حفظ المرتجع',

            msg: `تم ${isEditMode ? 'تحديث' : 'حفظ'} مرتجع الشراء رقم #${returnInvoiceId} بنجاح.`

        });

        isEditMode = false;

        editingInvoiceId = null;

        editingOriginalDate = null;

        editingInvoiceType = null;

        // تم إيقاف الطباعة التلقائية بناءً على طلب المستخدم (الحفظ فقط)

        // if (typeof printReturnReceipt === 'function') printReturnReceipt('purchase');

        resetPurReturn();

        // العودة للسجل

        viewOldInvoice(returnInvoiceId, 'مرتجع شراء', true);

        return true;

    } finally {

        const saveBtns = document.querySelectorAll('#purchase-return-section .btn-save, #purchase-return-section .action-btn');
        saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
        window.isSavingTransaction = false;

    }

}

function resetPurReturn() {

    purReturnCart = [];

    if (document.getElementById('purReturnProductSearch')) document.getElementById('purReturnProductSearch').value = '';

    if (document.getElementById('purReturnAccountInput')) document.getElementById('purReturnAccountInput').value = '';

    const partnerDisp = document.getElementById('purReturnPartnerDisplay');

    if (partnerDisp) partnerDisp.innerText = '---';

    const invDisp = document.getElementById('purReturnInvoiceDisplay');

    if (invDisp) invDisp.innerText = '---';

    const now = new Date();

    if (document.getElementById('purReturnDate')) document.getElementById('purReturnDate').value = now.toLocaleDateString('en-CA');

    if (document.getElementById('purReturnTime')) document.getElementById('purReturnTime').value = now.toTimeString().slice(0, 5);

    if (document.getElementById('purReturnItemsCount')) document.getElementById('purReturnItemsCount').innerText = '0';

    if (document.getElementById('purReturnTotalQty')) document.getElementById('purReturnTotalQty').innerText = '0';

    const nextId = getNextSequence('مرتجع شراء');

    if (document.getElementById('purReturnBadgeID')) document.getElementById('purReturnBadgeID').innerText = nextId;

    renderPurReturnCart();

}

// ================= دالة فلترة التواريخ السريعة =================

async function handleReturnSearch(query, type) {

    const resultsDiv = document.getElementById(type === 'sales' ? 'returnSearchResults' : 'purReturnSearchResults');

    if (!query || query.trim() === "") {
        if (resultsDiv) resultsDiv.style.display = 'none';
        return;
    }

    const queryLower = query.toLowerCase();

    const results = productsDB.filter(p =>

        (p.name && p.name.toLowerCase().includes(queryLower)) ||

        (p.code && String(p.code).toLowerCase().includes(queryLower)) ||

        (p.barcode && String(p.barcode).toLowerCase().includes(queryLower)) ||

        (p.units && p.units.some(u => u.unitBarcode && String(u.unitBarcode).toLowerCase().includes(queryLower)))

    ).slice(0, 15);

    if (results.length === 0) {

        resultsDiv.innerHTML = '<div style="padding: 10px; color: #dc2626; text-align: center;">لم يتم العثور على صنف</div>';

        resultsDiv.style.display = 'block';

        return;

    }

    let html = '';

    results.forEach((p, index) => {

        const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
        const stockVal = typeof getWarehouseStock === 'function' ? getWarehouseStock(p.name, activeWH) : 0;

        let stockText = `<span style="font-size: 0.75rem; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">المخزون (${activeWH}): ${stockVal}</span>`;

        if (p.units && p.units.length > 1) {

            html += `

                        <div class="search-result-item" tabindex="0" onclick="selectReturnProductToHeader('${p.id}', '${type}')" style="display:flex; justify-content:space-between; align-items:center;">

                            <div style="flex:1;">

                                <div style="font-weight:bold; color:#1e293b; font-size:0.9rem;">${p.name} <span style="font-size:0.7rem; color:#f59e0b; background:#fef3c7; padding:1px 4px; border-radius:4px;">📦 متعدد الوحدات</span></div>

                                <div style="font-size:0.75rem; color:#64748b;">الكود: ${p.code || '-'}</div>

                            </div>

                            <div style="text-align:left;">

                                ${stockText}

                            </div>

                        </div>`;

        } else {

            let unitPrice = p.price;

            html += `

                        <div class="search-result-item" tabindex="0" onclick="selectReturnProductToHeader('${p.id}', '${type}')" style="display:flex; justify-content:space-between; align-items:center;">

                            <div style="flex:1;">

                                <div style="font-weight:bold; color:#1e293b; font-size:0.9rem;">${p.name}</div>

                                <div style="font-size:0.75rem; color:#64748b;">السعر: ${parseFloat(unitPrice).toFixed(2)} ج.م</div>

                            </div>

                            <div style="text-align:left;">

                                ${stockText}

                            </div>

                        </div>`;

        }

    });

    resultsDiv.innerHTML = html;

    resultsDiv.style.display = 'block';

}

function selectReturnProductToHeader(productId, type) {

    const product = productsDB.find(p => p.id === productId);

    if (!product) return;

    const resultsDiv = document.getElementById(type === 'sales' ? 'salesReturnSearchResults' : 'purReturnSearchResults');
    if (resultsDiv) resultsDiv.style.display = 'none';

    // إذا كان للصنف تشكيلات مقاسات وألوان، نفتح نافذة المقاس واللون فوراً
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        if (typeof showVariantSelectionModal === 'function') {
            showVariantSelectionModal(product, type === 'sales' ? 'salesReturn' : 'purReturn');
            return;
        }
    }

    if (product.units && product.units.length > 1) {

        showUnitSelectionModal(product, type === 'sales' ? 'sales-return-header' : 'purchase-return-header');

    } else {

        const defUnit = (product.units && product.units.length > 0) ? product.units[0] : null;

        fillReturnHeaderWithUnit(product, defUnit, type);

    }

}

function fillReturnHeaderWithUnit(product, unit, type) {

    currentReturnHeaderProductId = product.id;

    currentReturnHeaderUnit = unit;

    const resultsDiv = document.getElementById(type === 'sales' ? 'returnSearchResults' : 'purReturnSearchResults');

    const pSearch = document.getElementById(type === 'sales' ? 'returnProductSearch' : 'purReturnProductSearch');

    const hQty = document.getElementById(type === 'sales' ? 'returnHeaderQty' : 'purReturnHeaderQty');

    const hPrice = document.getElementById(type === 'sales' ? 'returnHeaderPrice' : 'purReturnHeaderPrice');

    if (pSearch) pSearch.value = product.name;

    if (hPrice) {

        let p = product.price;

        if (unit) {

            p = parseFloat(unit.price) || product.price;

        }

        hPrice.value = parseFloat(p).toFixed(2);

    }

    if (hQty) {

        hQty.value = 1;

        hQty.focus();

        setTimeout(() => hQty.select(), 10);

    }

    if (resultsDiv) resultsDiv.style.display = 'none';

}

async function handleReturnSearchEnter(query, event, type, forceAdd = false) {

    const cleanQuery = String(query || '').trim();

    if (!forceAdd && typeof currentReturnHeaderProductId !== 'undefined' && currentReturnHeaderProductId) {
        const selectedProd = productsDB.find(p => p.id === currentReturnHeaderProductId);
        if (selectedProd && String(selectedProd.name).trim() === cleanQuery) {
            forceAdd = true;
        }
    }

    if (forceAdd && typeof currentReturnHeaderProductId !== 'undefined' && currentReturnHeaderProductId) {

        const product = productsDB.find(p => p.id === currentReturnHeaderProductId);

        const hQty = document.getElementById(type === 'sales' ? 'returnHeaderQty' : 'purReturnHeaderQty');

        const hPrice = document.getElementById(type === 'sales' ? 'returnHeaderPrice' : 'purReturnHeaderPrice');

        const pSearch = document.getElementById(type === 'sales' ? 'returnProductSearch' : 'purReturnProductSearch');

        const qty = parseFloat(hQty.value) || 1;

        const price = parseFloat(hPrice.value) || 0;

        if (type === 'sales') {

            const effVar = window._pendingSalesReturnVariant || null;
            returnCart.push({

                id: product.id,

                name: product.name,

                code: effVar ? (effVar.barcode || product.code || '---') : (product.code || '---'),

                price: price,

                qty: qty,

                maxQty: 9999, // Allow free returns without invoice limit

                selectedSize: effVar ? (effVar.size || '') : '',

                selectedColor: effVar ? (effVar.color || '') : '',

                selectedVariant: effVar,

                selectedUnit: currentReturnHeaderUnit,

                unitFactor: currentReturnHeaderUnit ? currentReturnHeaderUnit.factor : 1

            });

            renderReturnCart();

        } else {

            const effVar = window._pendingPurReturnVariant || null;
            purReturnCart.push({

                id: product.id,

                name: product.name,

                code: effVar ? (effVar.barcode || product.code || '---') : (product.code || '---'),

                price: price,

                qty: qty,

                maxQty: 9999,

                selectedSize: effVar ? (effVar.size || '') : '',

                selectedColor: effVar ? (effVar.color || '') : '',

                selectedVariant: effVar,

                selectedUnit: currentReturnHeaderUnit,

                unitFactor: currentReturnHeaderUnit ? currentReturnHeaderUnit.factor : 1

            });

            renderPurReturnCart();

        }

        // reset

        currentReturnHeaderProductId = null;

        currentReturnHeaderUnit = null;
        window._pendingSalesReturnVariant = null;
        window._pendingPurReturnVariant = null;

        if (pSearch) pSearch.value = '';

        if (hQty) hQty.value = '1';

        if (hPrice) hPrice.value = '';

        if (pSearch) pSearch.focus();

        return;

    }

    if (!query || query.trim() === "") return;

    // فحص الباركود الدقيق التلقائي فوراً
    const retContext = (type === 'sales') ? 'salesReturn' : 'purReturn';
    if (typeof window.dispatchSearchBarcode === 'function') {
        if (window.dispatchSearchBarcode(cleanQuery, retContext)) return;
    }

    let pInDB = productsDB.find(p => String(p.barcode) === String(query) || String(p.code) === String(query));

    if (!pInDB) {

        pInDB = productsDB.find(p => p.units && p.units.some(u => String(u.unitBarcode) === String(query)));

    }

    if (!pInDB) {
        const queryLower = cleanQuery.toLowerCase();
        const matches = productsDB.filter(p =>
            (p.name && p.name.toLowerCase().includes(queryLower)) ||
            (p.code && String(p.code).toLowerCase().includes(queryLower))
        );
        
        if (matches.length === 1) {
            pInDB = matches[0];
        } else if (matches.length > 1) {
            return;
        }
    }

    if (pInDB) {

        selectReturnProductToHeader(pInDB.id, type);

    } else {

        showCustomAlert({ titleText: '⚠️ تنبيه', msg: 'الصنف غير موجود!' });

    }

}

function filterSalesReturnCartItems(query) {

    const rows = document.querySelectorAll('#returnCartBody tr');

    const q = query.trim().toLowerCase();

    let firstMatch = null;

    rows.forEach(row => {

        const rowText = row.innerText.toLowerCase();

        if (rowText.includes(q)) {

            row.style.display = "";

            row.style.background = q !== "" ? "rgba(230, 126, 34, 0.15)" : "";

            if (q !== "" && !firstMatch) firstMatch = row;

        } else {

            row.style.display = "none";

        }

    });

    if (firstMatch && q !== "") {

        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });

    }

}

// --- فلترة سلة مرتجع الشراء ---

function filterPurReturnCartItems(query) {

    const rows = document.querySelectorAll('#purReturnCartBody tr');

    const q = query.trim().toLowerCase();

    let firstMatch = null;

    rows.forEach(row => {

        const rowText = row.innerText.toLowerCase();

        if (rowText.includes(q)) {

            row.style.display = "";

            row.style.background = q !== "" ? "rgba(192, 57, 43, 0.15)" : "";

            if (q !== "" && !firstMatch) firstMatch = row;

        } else {

            row.style.display = "none";

        }

    });

    if (firstMatch && q !== "") {

        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });

    }

}

// --- نافذة تعديل أسعار البيع (Price Adjustment Window) ---

// ================= نظام السرعة والتركيز العالمي (Universal POS Speed Kit) =================

document.addEventListener('keydown', (e) => {
    if (!e || typeof e.key !== 'string') return;

    const currentTab = openTabs.find(t => t.id === activeTabId);

    if (!currentTab) return;

    // خريطة الخانات حسب القسم

    const searchMap = {

        'sales': 'productSearch',

        'purchase': 'purchaseSearch',

        'sales-return': 'returnSearchInput',

        'purchase-return': 'purReturnSearchInput',

        'adjustment': 'adjSearch'

    };

    const targetId = searchMap[currentTab.type] || null;

    if (!targetId) return;

    const active = document.activeElement;

    const isInput = (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') && !active.readOnly;

    const isChar = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

    if (!isInput && isChar) {

        const target = document.getElementById(targetId);

        if (target) {

            target.focus();

        }

    }

    // ميزة الحذف السريع بـ Delete لصنف الفاتورة الأخير

    if (!isInput && e.key === 'Delete' && activeTabId === 'sales') {

        if (cart.length > 0) {

            if (confirm(`🗑️ هل تريد حذف ( ${cart[cart.length - 1].name} ) من الفاتورة؟`)) {

                removeFromCart(cart.length - 1);

            }

        }

    }

});

// تفعيل الأسهم والـ Enter لجميع خانات البحث المتاحة (Unified Keyboard Navigation)

let universalSelectedIndex = -1;

document.addEventListener('keydown', function (e) {
    if (!e || typeof e.key !== 'string') return;

    const currentTab = openTabs.find(t => t.id === activeTabId);

    if (!currentTab) return;

    // خريطة الحوايات حسب القسم

    const containerMap = {

        'sales': 'searchResults',

        'purchase': 'purchaseSearchResults',

        'sales-return': 'returnSearchResults',

        'purchase-return': 'purReturnSearchResults',

        'adjustment': 'adjSearchResults'

    };

    const containerId = containerMap[currentTab.type];

    if (!containerId) return;

    const resultsDiv = document.getElementById(containerId);

    if (!resultsDiv || resultsDiv.style.display === 'none') return;

    const items = resultsDiv.querySelectorAll('.pos-search-row, .search-item, .result-item');

    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {

        e.preventDefault();

        universalSelectedIndex = (universalSelectedIndex + 1) % items.length;

        updateUniversalSelection(items, universalSelectedIndex);

    } else if (e.key === 'ArrowUp') {

        e.preventDefault();

        universalSelectedIndex = (universalSelectedIndex - 1 + items.length) % items.length;

        updateUniversalSelection(items, universalSelectedIndex);

    } else if (e.key === 'Enter') {

        if (universalSelectedIndex > -1 && items[universalSelectedIndex]) {

            e.preventDefault();

            e.stopImmediatePropagation();

            items[universalSelectedIndex].click();

        }

    }

});

function updateUniversalSelection(items, idx) {

    items.forEach((it, i) => {

        if (i === idx) {
            it.style.background = '#eff6ff';
            it.style.borderRight = '5px solid #3b82f6';
            it.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)';
            it.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            it.style.background = '';
            it.style.borderRight = 'none';
            it.style.boxShadow = 'none';
        }

    });

}

// تصفير مؤشر البحث عند كل كتابة جديدة في أي خانة بحث

document.addEventListener('input', (e) => {

    if (e.target.classList.contains('search-input')) {

        universalSelectedIndex = -1;

    }

});

// ================= وظائف الأصناف السريعة (Quick Items Logic) =================

function updateSearchInvoiceDates(range) {

    const now = new Date();

    let fromDate = new Date();

    let toDate = new Date();

    const formatDate = (date) => date.toLocaleDateString('en-CA');

    switch (range) {

        case 'today':

            break;

        case 'yesterday':

            fromDate.setDate(now.getDate() - 1);

            toDate.setDate(now.getDate() - 1);

            break;

        case 'thisWeek':

            let day = now.getDay();

            let diff = (day + 1) % 7;

            fromDate.setDate(now.getDate() - diff);

            break;

        case 'lastWeek':

            let dayLW = now.getDay();

            let diffLW = (dayLW + 1) % 7;

            fromDate.setDate(now.getDate() - diffLW - 7);

            toDate.setDate(now.getDate() - diffLW - 1);

            break;

        case 'thisMonth':

            fromDate.setDate(1);

            break;

        case 'lastMonth':

            fromDate.setMonth(now.getMonth() - 1);

            fromDate.setDate(1);

            toDate = new Date(now.getFullYear(), now.getMonth(), 0);

            break;

        case 'thisYear':

            fromDate.setMonth(0);

            fromDate.setDate(1);

            break;

        case 'all':

            fromDate = new Date(2020, 0, 1);

            break;

    }

    document.getElementById('searchInvoiceDateFrom').value = formatDate(fromDate);

    document.getElementById('searchInvoiceDateTo').value = formatDate(toDate);

    executeInvoiceSearch();

}

function resetSearchInvoiceModal() {

    // تصفير المدخلات

    document.getElementById('searchInvoiceRef').value = '';

    document.getElementById('searchInvoiceAccount').value = '';

    document.getElementById('searchInvoiceTableBody').innerHTML = '<tr><td colspan="7" style="padding: 30px; color: #94a3b8; text-align: center;">ابدأ البحث برقم الفاتورة أو اسم العميل...</td></tr>';

    // تعبئة قائمة الحسابات (Autocomplete)

    const list = document.getElementById('searchAccountsList');

    if (list) {

        list.innerHTML = '';

        accounts.forEach(acc => {

            // إضافة خيار بالاسم

            const opt = document.createElement('option');

            opt.value = acc.name;

            opt.innerText = acc.code ? `${acc.name} (${acc.code})` : acc.name;

            list.appendChild(opt);

            // إضافة خيار بالكود لتسهيل الإكمال التلقائي بالكود

            if (acc.code) {

                const optCode = document.createElement('option');

                optCode.value = acc.code;

                optCode.innerText = `${acc.name} (${acc.code})`;

                list.appendChild(optCode);

            }

        });

    }

    // تركيز تلقائي على البحث

    setTimeout(() => {

        const refInput = document.getElementById('searchInvoiceRef');

        if (refInput) refInput.focus();

    }, 300);

}

window.openSearchInvoiceModal = function () {

    const modal = document.getElementById('searchInvoiceModal');

    modal.classList.remove('hidden');

    // جعل محتوى المودال قابلاً للتحريك

    const content = modal.querySelector('.modal-content');

    if (content && typeof makeElementDraggable === 'function') {

        makeElementDraggable(content);

    }

    resetSearchInvoiceModal();

    updateSearchInvoiceDates('all'); // تفعيل "كل الفترات" تلقائياً عند الفتح

};

function executeInvoiceSearch() {

    const ref = document.getElementById('searchInvoiceRef').value.trim();

    const account = document.getElementById('searchInvoiceAccount').value.trim().toLowerCase();

    // السماح بالبحث حتى لو الخانات فارغة لعرض كافة فواتير الفترة المختارة

    const dateFrom = document.getElementById('searchInvoiceDateFrom').value;

    const dateTo = document.getElementById('searchInvoiceDateTo').value;

    const currentTab = typeof openTabs !== 'undefined' ? openTabs.find(t => t.id === activeTabId) : null;

    const isSalesReturn = document.getElementById('sales-return-section') && !document.getElementById('sales-return-section').classList.contains('hidden');

    const targetType = isSalesReturn ? 'بيع' : 'شراء';

    // العثور على أسماء الحسابات التي تطابق المدخل (اسم، كود، أو هاتف)

    const matchingAccountNames = account ? accounts.filter(acc => {

        const nameMatch = acc.name && acc.name.toLowerCase().includes(account);

        const codeMatch = acc.code && acc.code.toString().toLowerCase().includes(account);

        const phoneMatch = (acc.mobile && acc.mobile.toString().includes(account)) || (acc.landline && acc.landline.toString().includes(account));

        return nameMatch || codeMatch || phoneMatch;

    }).map(acc => acc.name.toLowerCase()) : [];

    let results = transactions.filter(t => {

        const isCorrectType = t.type.includes(targetType) && !t.type.includes('مرتجع');

        if (!isCorrectType) return false;

        const matchRef = !ref || (t.invoiceId && t.invoiceId.toString().includes(ref));

        // البحث عن الحساب بالاسم المكتوب أو عبر تطابق الكود/الهاتف المستنتج

        const matchAccount = !account || (t.partner && (

            t.partner.toLowerCase().includes(account) ||

            matchingAccountNames.includes(t.partner.toLowerCase())

        ));

        const matchDate = (!dateFrom || t.dateISO >= dateFrom) && (!dateTo || t.dateISO <= dateTo);

        return matchRef && matchAccount && matchDate;

    });

    // تجميع النتائج حسب رقم الفاتورة وحساب الصافي بعد المرتجعات

    const grouped = {};

    results.forEach(t => {

        if (!grouped[t.invoiceId]) {

            // حساب إجمالي المرتجعات لهذه الفاتورة (باستخدام معرف الربط)

            const returnedVal = transactions

                .filter(rt => rt.originalInvoiceId == t.invoiceId && rt.type.includes('مرتجع'))

                .reduce((sum, rt) => sum + (parseFloat(rt.total) || 0), 0);

            // استخراج الوقت والتاريخ من dateISO إذا أمكن

            let timeStr = '-';

            let dateStr = t.date;

            try {

                if (t.dateISO) {

                    const d = new Date(t.dateISO);

                    timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

                }

            } catch (e) { }

            grouped[t.invoiceId] = {

                id: t.invoiceId,

                date: dateStr,

                time: timeStr,

                partner: t.partner || '-',

                originalTotal: 0,

                returnedTotal: returnedVal,

                is_returned: t.is_returned || (returnedVal > 0),

                warehouse: t.warehouse || 'المخزن الرئيسي',

                user: t.user || 'أدمن'

            };

        }

        grouped[t.invoiceId].originalTotal += parseFloat(t.total) || 0;

    });

    const tbody = document.getElementById('searchInvoiceTableBody');

    tbody.innerHTML = '';

    Object.values(grouped).reverse().forEach((inv, idx) => {

        const netTotal = inv.originalTotal - inv.returnedTotal;

        const isFullyReturned = netTotal <= 0.01 && inv.returnedTotal > 0;

        const tr = document.createElement('tr');

        tr.style.cursor = 'pointer';

        if (isFullyReturned) {

            tr.style.opacity = '0.6';

            tr.style.background = '#f1f5f9';

        }

        tr.onclick = function () {

            if (isFullyReturned) {

                if (typeof showToast === 'function') {

                    showToast("⚠️ الفاتورة مسترجعة بالكامل ولا يوجد متبقي!", "error");

                } else {

                    alert("⚠️ الفاتورة مسترجعة بالكامل ولا يوجد متبقي!");

                }

                return;

            }

            // Unselect all other radios

            document.querySelectorAll('.invoice-radio-select').forEach(r => r.checked = false);

            document.querySelectorAll('#searchInvoiceTableBody tr').forEach(r => r.style.background = '');

            const radio = tr.querySelector('.invoice-radio-select');

            if (radio) {

                radio.checked = true;

                tr.style.background = '#d1e7dd';

            }

        };

        tr.ondblclick = function () {

            if (isFullyReturned) return;

            openSelectReturnItemsModal(inv.id);

        };

        tr.innerHTML = `

                    <td style="border: 1px solid #ddd; padding: 5px;">

                        <input type="radio" name="selectedReturnInvoice" value="${inv.id}" class="invoice-radio-select" style="cursor: pointer; transform: scale(1.3); ${isFullyReturned ? 'opacity: 0.4;' : ''}">

                    </td>

                    <td style="border: 1px solid #ddd; padding: 5px;">${inv.date}</td>

                    <td style="border: 1px solid #ddd; padding: 5px;">${inv.time}</td>

                    <td style="border: 1px solid #ddd; padding: 5px; font-weight: bold;">${inv.id} ${isFullyReturned ? '<span style="color:#ef4444; font-size:0.7rem;">(مسترجعة)</span>' : ''}</td>

                    <td style="border: 1px solid #ddd; padding: 5px;">${inv.partner}</td>

                    <td style="border: 1px solid #ddd; padding: 5px; direction: ltr;">${netTotal.toFixed(2)}</td>

                    <td style="border: 1px solid #ddd; padding: 5px;">${inv.warehouse}</td>

                    <td style="border: 1px solid #ddd; padding: 5px; color: #1e8449;">${inv.user}</td>

                `;

        tbody.appendChild(tr);

    });

    if (Object.keys(grouped).length === 0) {

        tbody.innerHTML = '<tr><td colspan="7" style="padding: 30px; color: #94a3b8; text-align: center;">لا توجد فواتير تطابق البحث</td></tr>';

    }

}

// فتح مودال تحديد الأصناف للفاتورة المحددة من قائمة البحث

function openSelectReturnItemsForSelected() {

    const checked = document.querySelector('input[name="selectedReturnInvoice"]:checked');

    if (!checked) {

        alert('الرجاء اختيار فاتورة أولاً!');

        return;

    }

    openSelectReturnItemsModal(checked.value);

}

function confirmSelectedInvoiceForReturn(invoiceId) {

    if (!invoiceId) {

        const checked = document.querySelector('input[name="selectedReturnInvoice"]:checked');

        if (!checked) return alert('الرجاء اختيار فاتورة أولاً!');

        invoiceId = checked.value;

    }

    const currentTab = typeof openTabs !== 'undefined' ? openTabs.find(t => t.id === activeTabId) : null;

    const isSalesReturn = document.getElementById('sales-return-section') && !document.getElementById('sales-return-section').classList.contains('hidden');

    const targetType = isSalesReturn ? 'بيع' : 'شراء';

    // جلب أصناف الفاتورة الأصلية

    const originalInvoiceItems = transactions.filter(t => t.invoiceId == invoiceId && t.type.includes(targetType) && !t.type.includes('مرتجع'));

    if (originalInvoiceItems.length === 0) {

        alert("تعذر العثور على أصناف لهذه الفاتورة!");

        return;

    }

    const selectedItems = [];

    originalInvoiceItems.forEach((originalItem) => {

        const itemSize = (originalItem.selectedSize || originalItem.size || '').trim();
        const itemColor = (originalItem.selectedColor || originalItem.color || '').trim();

        // حساب الكمية المتاحة فعلياً (الأصلية - المرتجع سابقاً) مع مطابقة المقاس واللون بدقة
        const returnedQty = transactions
            .filter(t => t.originalInvoiceId == originalItem.invoiceId && t.type.includes('مرتجع') && 
                (t.product === originalItem.product || t.productName === originalItem.product) &&
                (!itemSize || (t.size || t.selectedSize || '').trim() === itemSize) &&
                (!itemColor || (t.color || t.selectedColor || '').trim() === itemColor)
            )
            .reduce((sum, t) => sum + (parseFloat(t.qty) || 0), 0);

        const availableQty = parseFloat(originalItem.qty) - returnedQty;

        if (availableQty > 0) {

            const p = productsDB.find(x => x.name === originalItem.product || x.id === originalItem.productId);

            let selectedUnitObj = null;

            let unitFactor = parseFloat(originalItem.unitFactor) || 1;

            if (p && p.units) {

                const foundUnit = p.units.find(u => u.unitName === originalItem.unit);

                if (foundUnit) {

                    selectedUnitObj = foundUnit;

                    unitFactor = parseFloat(foundUnit.factor) || unitFactor;

                }

            }

            selectedItems.push({

                id: p ? p.id : (originalItem.productId || ''),

                name: originalItem.product,

                price: (function() {
                    const oPrice = parseFloat(originalItem.price) || 0;
                    const oTotal = parseFloat(originalItem.total) || 0;
                    const oQty = parseFloat(originalItem.qty) || 1;
                    const netU = (oQty > 0 && oTotal > 0) ? (oTotal / oQty) : oPrice;
                    return parseFloat(netU.toFixed(2));
                })(),

                qty: availableQty, // تنزيل كامل الكمية المتبقية تلقائياً

                maxQty: availableQty, // حفظ المتاح كحد أقصى

                unit: originalItem.unit,

                selectedUnit: selectedUnitObj,

                unitFactor: unitFactor,

                size: itemSize,

                selectedSize: itemSize,

                color: itemColor,

                selectedColor: itemColor,

                selectedVariant: originalItem.selectedVariant || null,

                code: originalItem.code || '---',

                invoiceId: originalItem.invoiceId

            });

        }

    });

    if (selectedItems.length === 0) {

        alert("⚠️ عذراً، جميع أصناف هذه الفاتورة تم إرجاعها بالكامل بالفعل!");

        return;

    }

    const firstItem = originalInvoiceItems[0];

    const pName = firstItem.partner || (isSalesReturn ? 'عميل عام' : 'مورد عام');

    const invNo = firstItem.invoiceId || '---';

    if (isSalesReturn) {

        returnCart = selectedItems;

        const partnerEl = document.getElementById('salesReturnPartnerDisplay');

        const partnerBadge = document.getElementById('salesReturnPartnerBadge');

        const invEl = document.getElementById('salesReturnInvoiceDisplay');

        const badgeID = document.getElementById('salesReturnBadgeID');

        if (partnerEl) partnerEl.innerText = pName;

        if (partnerBadge) partnerBadge.innerHTML = '👤 عميل: ' + pName;

        const accInput = document.getElementById('salesReturnAccountInput');

        if (accInput) accInput.value = pName;

        if (invEl) invEl.innerText = invNo;

        if (badgeID) badgeID.innerText = invNo;

        if (typeof renderReturnCart === 'function') renderReturnCart();

    } else {

        purReturnCart = selectedItems;

        const partnerEl = document.getElementById('purReturnPartnerDisplay');

        const partnerBadge = document.getElementById('purReturnPartnerBadge');

        const invEl = document.getElementById('purReturnInvoiceDisplay');

        const badgeID = document.getElementById('purReturnBadgeID');

        if (partnerEl) partnerEl.innerText = pName;

        if (partnerBadge) partnerBadge.innerHTML = '👤 مورد: ' + pName;

        const accInput = document.getElementById('purReturnAccountInput');

        if (accInput) accInput.value = pName;

        if (invEl) invEl.innerText = invNo;

        if (badgeID) badgeID.innerText = invNo;

        if (typeof renderPurReturnCart === 'function') renderPurReturnCart();

    }

    // إغلاق نافذة البحث

    document.getElementById('searchInvoiceModal').classList.add('hidden');

    showToast("✅ تم استيراد أصناف الفاتورة مباشرة بنجاح");

    // تحديث بطاقة الفاتورة والحساب

    const retType = isSalesReturn ? 'sales' : 'purchase';

    updateReturnInvoiceCard(invoiceId, retType);

    updateReturnAccountBalance(pName, retType);

}

let currentReturnInvoiceItems = [];

function openSelectReturnItemsModal(invoiceId) {

    const modal = document.getElementById('selectReturnItemsModal');

    if (modal && typeof makeElementDraggable === 'function') {

        const content = modal.querySelector('.modal-content');

        if (content) makeElementDraggable(content);

    }

    const currentTab = typeof openTabs !== 'undefined' ? openTabs.find(t => t.id === activeTabId) : null;

    const isSalesReturn = document.getElementById('sales-return-section') && !document.getElementById('sales-return-section').classList.contains('hidden');

    const targetType = isSalesReturn ? 'بيع' : 'شراء';

    // جلب أصناف الفاتورة الأصلية

    currentReturnInvoiceItems = transactions.filter(t => t.invoiceId == invoiceId && t.type.includes(targetType) && !t.type.includes('مرتجع'));

    if (currentReturnInvoiceItems.length === 0) {

        alert("تعذر العثور على أصناف لهذه الفاتورة!");

        return;

    }

    // حساب إجماليات الفاتورة بالكامل لربطها بما تم إرجاعه

    const origTotal = currentReturnInvoiceItems.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

    const totalReturnedVal = transactions

        .filter(t => t.originalInvoiceId == invoiceId && t.type.includes('مرتجع'))

        .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

    const remainingTotalVal = origTotal - totalReturnedVal;

    // تحديث واجهة العرض (المعلومات العلوية)

    document.getElementById('returnItemsInvoiceInfo').style.display = 'grid';

    document.getElementById('returnItemsInvNo').innerText = '#' + invoiceId;

    document.getElementById('returnItemsAccount').innerText = currentReturnInvoiceItems[0].partner;

    document.getElementById('returnItemsDate').innerText = currentReturnInvoiceItems[0].date;

    document.getElementById('returnItemsOrigTotal').innerText = origTotal.toFixed(2);

    document.getElementById('returnItemsPrevRet').innerText = totalReturnedVal.toFixed(2);

    document.getElementById('returnItemsRemainingTotal').innerText = remainingTotalVal.toFixed(2);

    document.getElementById('returnItemsCount').innerText = currentReturnInvoiceItems.length;

    // تصفير خانة البحث عند فتح المودال

    const searchInput = document.getElementById('returnItemsSearch');

    if (searchInput) searchInput.value = '';

    // إغلاق مودال البحث وفتح مودال الاختيار

    document.getElementById('searchInvoiceModal').classList.add('hidden');

    document.getElementById('selectReturnItemsModal').classList.remove('hidden');

    const tbody = document.getElementById('selectReturnItemsTableBody');

    if (!tbody) return;

    tbody.innerHTML = '';

    // حساب الكميات المرجعة مسبقاً لكل صنف ورسم الجدول

    currentReturnInvoiceItems.forEach((item, idx) => {

        const itemSize = (item.selectedSize || item.size || '').trim();
        const itemColor = (item.selectedColor || item.color || '').trim();

        const returnedQty = transactions
            .filter(t => t.originalInvoiceId == invoiceId && t.type.includes('مرتجع') && 
                (t.product === item.product || t.productName === item.product) &&
                (!itemSize || (t.size || t.selectedSize || '').trim() === itemSize) &&
                (!itemColor || (t.color || t.selectedColor || '').trim() === itemColor)
            )
            .reduce((sum, t) => sum + (parseFloat(t.qty) || 0), 0);

        const availableQty = parseFloat(item.qty) - returnedQty;

        const varInfo = [itemSize, itemColor].filter(Boolean).join(' - ');
        const varBadge = varInfo 
            ? `<span style="display:inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; padding: 2px 8px; font-size: 0.78rem; font-weight: 900; margin-right: 8px;">🏷️ ${varInfo}</span>` 
            : '';

        const tr = document.createElement('tr');

        tr.innerHTML = `

                    <td style="text-align: center;">

                        <input type="checkbox" class="return-item-check" data-index="${idx}" onchange="calculateReturnModalTotal()" ${availableQty <= 0 ? 'disabled' : 'checked'} style="width: 18px; height: 18px; cursor: pointer;">

                    </td>

                    <td style="text-align: center; color: #64748b;">${idx + 1}</td>

                    <td style="font-weight: 800; color: #1e293b; text-align: right; padding-right: 15px;">${item.product} ${varBadge}</td>

                    <td style="text-align: center;">${item.unit || 'عدد'}</td>

                    <td style="text-align: center; font-weight: bold; color: #94a3b8;">${item.qty}</td>

                    <td style="text-align: center; color: #ef4444; font-weight: bold;">${returnedQty}</td>

                    <td style="text-align: center; color: var(--main-green); font-weight: 900; font-size: 1.1rem; background: rgba(16, 185, 129, 0.05);">${availableQty}</td>

                    <td>

                        <input type="number" class="return-item-qty" data-index="${idx}" value="${availableQty}" min="0" max="${availableQty}" 

                               oninput="calculateReturnModalTotal()" 

                               style="width: 75px; text-align: center; padding: 6px; border: 2px solid #fbbf24; border-radius: 8px; font-weight: 900; color: #b45309;"

                               ${availableQty <= 0 ? 'disabled' : ''}>

                    </td>

                    <td style="text-align: center;">
                        ${(function() {
                            const oP = parseFloat(item.price) || 0;
                            const oT = parseFloat(item.total) || 0;
                            const oQ = parseFloat(item.qty) || 1;
                            const nU = (oQ > 0 && oT > 0) ? (oT / oQ) : oP;
                            const dispP = parseFloat(nU.toFixed(2));
                            const hasD = (oP - dispP) > 0.01;
                            return hasD 
                                ? `<div style="font-weight:900; color:var(--main-blue); font-size:0.95rem;">${dispP.toFixed(2)}</div><div style="font-size:0.72rem; color:#dc2626; font-weight:bold;">(صافي بعد الخصم)</div>`
                                : `<div style="font-weight:900; color:var(--main-blue); font-size:0.95rem;">${dispP.toFixed(2)}</div>`;
                        })()}
                    </td>

                `;

        tbody.appendChild(tr);

    });

    calculateReturnModalTotal();

}

function toggleAllReturnItems(el) {

    const checks = document.querySelectorAll('.return-item-check:not(:disabled)');

    checks.forEach(c => c.checked = el.checked);

    calculateReturnModalTotal();

}

function calculateReturnModalTotal() {

    let total = 0;

    const rows = document.querySelectorAll('#selectReturnItemsTableBody tr');

    rows.forEach((row, idx) => {

        const check = row.querySelector('.return-item-check');

        const qtyInput = row.querySelector('.return-item-qty');

        if (check && check.checked && qtyInput) {

            let qty = parseFloat(qtyInput.value) || 0;

            const max = parseFloat(qtyInput.getAttribute('max')) || 0;

            if (qty > max) {

                qty = max;

                qtyInput.value = max;

            }

            if (currentReturnInvoiceItems[idx]) {

                const itm = currentReturnInvoiceItems[idx];
                const oP = parseFloat(itm.price) || 0;
                const oT = parseFloat(itm.total) || 0;
                const oQ = parseFloat(itm.qty) || 1;
                const netPrice = (oQ > 0 && oT > 0) ? (oT / oQ) : oP;

                total += qty * netPrice;

            }

        }

    });

    const totalEl = document.getElementById('totalReturnAmount');

    if (totalEl) totalEl.innerText = total.toFixed(2);

}

function filterReturnItems(query) {

    const q = query.toLowerCase().trim();

    const rows = document.querySelectorAll('#selectReturnItemsTableBody tr');

    let visibleCount = 0;

    rows.forEach(row => {

        const productName = row.cells[2]?.innerText.toLowerCase() || '';

        if (productName.includes(q)) {

            row.style.display = '';

            visibleCount++;

        } else {

            row.style.display = 'none';

        }

    });

    // تحديث العداد بالنتائج الظاهرة

    const countEl = document.getElementById('returnItemsCount');

    if (countEl) countEl.innerText = visibleCount + ' من ' + currentReturnInvoiceItems.length;

}

async function confirmReturnItemsSelection() {

    const selectedItems = [];

    const rows = document.querySelectorAll('#selectReturnItemsTableBody tr');

    rows.forEach((row, idx) => {

        const check = row.querySelector('.return-item-check');

        const qtyInput = row.querySelector('.return-item-qty');

        if (check && check.checked && qtyInput) {

            let qty = parseFloat(qtyInput.value) || 0;

            const originalItem = currentReturnInvoiceItems[idx];

            const itemSize = (originalItem.selectedSize || originalItem.size || '').trim();
            const itemColor = (originalItem.selectedColor || originalItem.color || '').trim();

            // حساب الكمية المتاحة فعلياً (الأصلية - المرتجع سابقاً) مع مطابقة المقاس واللون
            const returnedQty = transactions
                .filter(t => t.originalInvoiceId == originalItem.invoiceId && t.type.includes('مرتجع') && 
                    (t.product === originalItem.product || t.productName === originalItem.product) &&
                    (!itemSize || (t.size || t.selectedSize || '').trim() === itemSize) &&
                    (!itemColor || (t.color || t.selectedColor || '').trim() === itemColor)
                )
                .reduce((sum, t) => sum + (parseFloat(t.qty) || 0), 0);

            const availableQty = parseFloat(originalItem.qty) - returnedQty;

            if (qty > availableQty) {

                alert(`⚠️ الصنف "${originalItem.product}" الكمية المتاحة منه للإرجاع هي (${availableQty}) فقط!`);

                qty = availableQty;

                qtyInput.value = availableQty;

            }

            if (qty > 0) {

                const p = productsDB.find(x => x.name === originalItem.product || x.id === originalItem.productId);
                let selectedUnitObj = null;
                let unitFactor = parseFloat(originalItem.unitFactor) || 1;

                if (p && p.units) {
                    const foundUnit = p.units.find(u => u.unitName === originalItem.unit);
                    if (foundUnit) {
                        selectedUnitObj = foundUnit;
                        unitFactor = parseFloat(foundUnit.factor) || unitFactor;
                    }
                }

                selectedItems.push({

                    id: p ? p.id : (originalItem.productId || ''),

                    name: originalItem.product,

                    price: (function() {
                        const oPrice = parseFloat(originalItem.price) || 0;
                        const oTotal = parseFloat(originalItem.total) || 0;
                        const oQty = parseFloat(originalItem.qty) || 1;
                        const netU = (oQty > 0 && oTotal > 0) ? (oTotal / oQty) : oPrice;
                        return parseFloat(netU.toFixed(2));
                    })(),

                    qty: qty,

                    maxQty: availableQty, // حفظ المتاح كحد أقصى وليس إجمالي الفاتورة

                    unit: originalItem.unit,

                    selectedUnit: selectedUnitObj,

                    unitFactor: unitFactor,

                    size: itemSize,

                    selectedSize: itemSize,

                    color: itemColor,

                    selectedColor: itemColor,

                    selectedVariant: originalItem.selectedVariant || null,

                    code: originalItem.code || '---',

                    invoiceId: originalItem.invoiceId // حفظ رقم الفاتورة الأصلية في الصنف

                });

            }

        }

    });

    if (selectedItems.length === 0) {

        alert("يرجى اختيار صنف واحد على الأقل للإرجاع!");

        return;

    }

    const currentTab = typeof openTabs !== 'undefined' ? openTabs.find(t => t.id === activeTabId) : null;

    const isSalesReturn = document.getElementById('sales-return-section') && !document.getElementById('sales-return-section').classList.contains('hidden');

    const firstItem = currentReturnInvoiceItems[0];

    if (isSalesReturn) {

        returnCart = selectedItems;

        const partnerEl = document.getElementById('salesReturnPartnerDisplay');

        const partnerBadge = document.getElementById('salesReturnPartnerBadge');

        const invEl = document.getElementById('salesReturnInvoiceDisplay');

        const badgeID = document.getElementById('salesReturnBadgeID');

        const pName = firstItem.partner || 'عميل عام';

        const invNo = firstItem.invoiceId || '---';

        if (partnerEl) partnerEl.innerText = pName;

        if (partnerBadge) partnerBadge.innerHTML = '👤 عميل: ' + pName;

        const accInput = document.getElementById('salesReturnAccountInput');

        if (accInput) accInput.value = pName;

        if (invEl) invEl.innerText = invNo;

        if (badgeID) badgeID.innerText = invNo;

        if (typeof renderReturnCart === 'function') renderReturnCart();

    } else {

        purReturnCart = selectedItems;

        const partnerEl = document.getElementById('purReturnPartnerDisplay');

        const partnerBadge = document.getElementById('purReturnPartnerBadge');

        const invEl = document.getElementById('purReturnInvoiceDisplay');

        const badgeID = document.getElementById('purReturnBadgeID');

        const pName = firstItem.partner || 'مورد عام';

        const invNo = firstItem.invoiceId || '---';

        if (partnerEl) partnerEl.innerText = pName;

        if (partnerBadge) partnerBadge.innerHTML = '👤 مورد: ' + pName;

        const accInput = document.getElementById('purReturnAccountInput');

        if (accInput) accInput.value = pName;

        if (invEl) invEl.innerText = invNo;

        if (badgeID) badgeID.innerText = invNo;

        if (typeof renderPurReturnCart === 'function') renderPurReturnCart();

    }

    document.getElementById('selectReturnItemsModal').classList.add('hidden');

    showToast("✅ تم استيراد الأصناف المحددة للمرتجع بنجاح");

    // تحديث بطاقة الفاتورة والحساب

    const retType2 = isSalesReturn ? 'sales' : 'purchase';

    const invNo2 = firstItem ? firstItem.invoiceId : null;

    const pName2 = firstItem ? (firstItem.partner || (isSalesReturn ? 'عميل عام' : 'مورد عام')) : '';

    updateReturnInvoiceCard(invNo2, retType2);

    updateReturnAccountBalance(pName2, retType2);

}

// --- تحويل وظائف البحث لوظائف مؤجلة (Debounced) لتحسين سرعة البرنامج ---

if (typeof debounce === 'function') {

    const originalHandleSearch = handleSearch;

    handleSearch = debounce(function (query) {

        originalHandleSearch(query);

    }, 300);

    const originalHandlePurchaseSearch = handlePurchaseSearch;

    handlePurchaseSearch = debounce(function (query) {

        originalHandlePurchaseSearch(query);

    }, 300);

    const originalHandleCustomerSearch = handleCustomerSearch;

    handleCustomerSearch = debounce(function (query) {

        originalHandleCustomerSearch(query);

    }, 300);

    const originalHandleSupplierSearch = handleSupplierSearch;

    handleSupplierSearch = debounce(function (query) {

        originalHandleSupplierSearch(query);

    }, 300);

}

// ================= بطاقة رصيد الحساب وتفاصيل الفاتورة في المرتجعات =================

function updateReturnAccountBalance(accountName, type) {

    const isSales = type === 'sales';

    const cardId = isSales ? 'srReturnAccountCard' : 'prReturnAccountCard';

    const balanceId = isSales ? 'srAccBalance' : 'prAccBalance';

    const card = document.getElementById(cardId);

    // 1. التحقق من وجود اسم

    if (!accountName || !accountName.trim() || accountName === '---') {

        if (card) card.style.display = 'none';

        return;

    }

    let name = accountName.trim();

    // 2. التحقق مما إذا كان العميل/المورد مسجلاً في الحسابات (بالاسم، الكود، أو الهاتف)

    let acc = accounts.find(a => a.name === name || (a.code && a.code.toString() === name) || (a.mobile && a.mobile.toString() === name) || (a.landline && a.landline.toString() === name));

    if (!acc) {

        // عميل نقدي -> لا يوجد له كشف حساب ولا مديونية معلقة

        if (card) card.style.display = 'none';

        return;

    }

    // إذا تم العثور على الحساب عن طريق الكود أو الهاتف، نقوم بتحديث قيمة الحقل بالاسم الأصلي للوضوح

    if (acc.name !== name) {

        name = acc.name;

        const inputId = isSales ? 'salesReturnAccountInput' : 'purReturnAccountInput';

        const inputEl = document.getElementById(inputId);

        if (inputEl) inputEl.value = name;

    }

    if (!acc) {

        // عميل نقدي -> لا يوجد له كشف حساب ولا مديونية معلقة

        if (card) card.style.display = 'none';

        return;

    }

    // 3. للعميل المسجل، يتم جلب الرصيد الدقيق باستخدام الدالة المحاسبية المركزية

    const balance = typeof getAccountBalance === 'function' ? getAccountBalance(name) : 0;

    if (card) {

        const balEl = document.getElementById(balanceId);

        balEl.innerText = Math.abs(balance).toFixed(2);

        balEl.dataset.rawBalance = balance; // حفظ الإشارة لاستخدامها لاحقاً في حساب الرصيد المتوقع

        if (balance > 0) {

            balEl.style.color = isSales ? '#dc2626' : '#be123c'; // مدين (عليه)

            balEl.innerText += ' (عليه)';

        } else if (balance < 0) {

            balEl.style.color = '#16a34a'; // دائن (له)

            balEl.innerText += ' (له)';

        } else {

            balEl.style.color = '#64748b';

            balEl.innerText += ' (خالص)';

        }

        card.style.display = 'block';

    }

    if (typeof updateProjectedAccountBalance === 'function') {

        updateProjectedAccountBalance(type);

    }

}

function updateReturnInvoiceCard(invoiceId, type) {

    const isSales = type === 'sales';

    const cardId = isSales ? 'srReturnInvoiceCard' : 'prReturnInvoiceCard';

    const totalId = isSales ? 'srInvTotal' : 'prInvTotal';

    const returnedId = isSales ? 'srInvReturned' : 'prInvReturned';

    const remainingId = isSales ? 'srInvRemaining' : 'prInvRemaining';

    const card = document.getElementById(cardId);

    if (!invoiceId || invoiceId === '---' || !card) {

        if (card) card.style.display = 'none';

        return;

    }

    const invoiceType = isSales ? 'بيع' : 'شراء';

    const origItems = transactions.filter(t =>

        t.invoiceId == invoiceId && t.type.includes(invoiceType) && !t.type.includes('مرتجع')

    );

    const origTotal = origItems.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

    const returnedVal = transactions

        .filter(t => t.originalInvoiceId == invoiceId && t.type.includes('مرتجع'))

        .reduce((sum, t) => sum + Math.abs(parseFloat(t.total) || 0), 0);

    const remaining = origTotal - returnedVal;

    const totalEl = document.getElementById(totalId);
    if (totalEl) totalEl.innerText = origTotal.toFixed(2);

    const returnedEl = document.getElementById(returnedId);
    if (returnedEl) returnedEl.innerText = returnedVal.toFixed(2);

    const remEl = document.getElementById(remainingId);
    if (remEl) {
        remEl.innerText = remaining.toFixed(2);
        remEl.style.color = remaining <= 0 ? '#dc2626' : '#16a34a';
    }

    card.style.display = 'block';
}

// استدعاء التحميل التلقائي لمستوى السعر المثبت بالدبوس عند بدء تشغيل البرنامج
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (typeof loadPinnedPriceLevel === 'function') loadPinnedPriceLevel();
        }, 150);
    });
}
