// ============================================================
//  سندات القبض وسندات الصرف والعمليات المالية (Receipts & Disbursements)
// ============================================================
        function resetReceipt() {

            if (document.getElementById('receiptAmount')) document.getElementById('receiptAmount').value = '';

            if (document.getElementById('receiptCustomer')) document.getElementById('receiptCustomer').value = '';

            if (document.getElementById('receiptAccountBalance')) document.getElementById('receiptAccountBalance').innerText = '0.00';

            if (document.getElementById('receiptNotes')) document.getElementById('receiptNotes').value = '';

            if (document.getElementById('receiptType')) document.getElementById('receiptType').value = 'أخرى';

            // تعيين التاريخ والوقت ورقم الحركة بالتسلسل

            const now = new Date();

            if (document.getElementById('receiptDate')) document.getElementById('receiptDate').value = now.toLocaleDateString('en-CA');

            if (document.getElementById('receiptTime')) document.getElementById('receiptTime').value = now.toTimeString().slice(0, 5);

            // رقم الحركة يبدأ من 1 ويتسلسل

            if (document.getElementById('receiptID')) {

                document.getElementById('receiptID').value = getNextSequence('قبض');

            }

            if (document.getElementById('pendingInvoicesBody')) document.getElementById('pendingInvoicesBody').innerHTML = '';

            if (document.getElementById('receiptAmount')) document.getElementById('receiptAmount').focus();

        }

        let isReceiptSaving = false; // حماية ضد النقرة المزدوجة

        async function saveReceipt(closeAfterExplicit = false, accountChecked = false) {

            if (isReceiptSaving) return false; // منع التكرار لو العملية جارية
            isReceiptSaving = true;

            const saveBtns = document.querySelectorAll('#receipt-section .btn-save, #receipt-section .action-btn');
            saveBtns.forEach(b => { b.disabled = true; b.style.pointerEvents = 'none'; b.style.opacity = '0.6'; });

            try {
                if (!checkPermission('sec_receipt')) return false;

                const amount = parseFloat(document.getElementById('receiptAmount').value);

                const payer = (document.getElementById('receiptCustomer')?.value || '').trim();

                if (payer && typeof checkAccountFrozenAndAlert === 'function') {
                    if (checkAccountFrozenAndAlert(payer)) {
                        return false;
                    }
                }

                const type = document.getElementById('receiptType').value;

                if (!amount || amount <= 0) {

                    alert("⚠️ يرجى إدخال مبلغ صحيح");

                    return false;

                }

                if (!payer || window.isGenericCashPartner(payer)) {

                    showCustomAlert({
                        type: 'error',
                        titleText: '⚠️ مطلوب اختيار العميل',
                        msg: 'سندات القبض تتطلب تحديد حساب عميل مسجل لتسجيل المبالغ في كشف حسابه.'
                    });

                    return false;

                }

                if (!accountChecked) {
                    const ok = await window.ensurePartnerAccountExists(payer, 'عميل', true, () => {
                        isReceiptSaving = false;
                        saveReceipt(closeAfterExplicit, true);
                    });
                    if (!ok) return false;
                }

                const dt = getTransactionDateTime('receiptDate', 'receiptTime');

                const notes = document.getElementById('receiptNotes') ? document.getElementById('receiptNotes').value.trim() : "";

                const finalDescription = (type === 'أخرى' && notes) ? notes : type;

                const receiptID = isEditMode ? editingInvoiceId : (document.getElementById('receiptID') ? document.getElementById('receiptID').value : getNextSequence('قبض'));

                if (!isEditMode && transactions.some(t => String(t.invoiceId) === String(receiptID) && t.type && t.type.includes('قبض'))) {
                    console.warn("Duplicate Receipt Blocked");
                    return false;
                }
                if (isEditMode && editingInvoiceId) {

                    if (window.revertAndClearOldInvoice) {

                        await window.revertAndClearOldInvoice(editingInvoiceId, editingInvoiceType);

                    }

                }

                // --- 🛑 التحقق من حدود الباقة المجانية ---

                const currentPlan = window.getBayanPlan();

                if (!isEditMode && !window.enforceSubscriptionCheck('receipt')) {
                    return false;
                }

                const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
                const tInfo = (window.BayanNetworkHub && typeof window.BayanNetworkHub.getTerminalInfo === 'function')
                    ? window.BayanNetworkHub.getTerminalInfo()
                    : { terminal: 'الجهاز الرئيسي 💻', terminalLetter: 'MASTER', terminalOrder: 0, terminalId: '' };
                const terminalName = tInfo.terminal;
                const receiptTreasury = document.getElementById('receiptTreasurySelect')?.value || 'نقدية';
                const receiptMethod = (receiptTreasury.includes('بنك') || receiptTreasury.includes('فيزا') || receiptTreasury.includes('تحويل')) ? receiptTreasury : 'نقدية';

                // تسجيل الحركة في السجل العام

                transactions.push({

                    date: dt.full,

                    dateISO: dt.iso,

                    timeISO: dt.time,

                    type: 'قبض 📥',

                    method: receiptMethod,

                    invoiceId: receiptID,

                    product: finalDescription,

                    notes: notes,

                    qty: 1,

                    price: Number(amount) || 0,

                    total: Number((Number(amount) || 0).toFixed(2)),

                    paidAmount: Number((Number(amount) || 0).toFixed(2)),

                    partner: payer,

                    warehouse: activeWH,
                    terminal: terminalName,
                    terminalLetter: tInfo.terminalLetter,
                    terminalOrder: tInfo.terminalOrder,
                    terminalId: tInfo.terminalId,

                    user: currentUser ? currentUser.name : '-',

                    editDate: isEditMode ? `${new Date().toLocaleString('ar-EG')} (تعديل بواسطة: ${currentUser ? currentUser.name : 'مجهول'})` : '-'

                });

                await saveData();

                if (typeof logAuditAction === 'function') {
                    const auditAction = isEditMode ? 'تحديث سند قبض' : 'حفظ سند قبض جديد';
                    logAuditAction(auditAction, `سند قبض رقم #${receiptID}, المبلغ: ${amount.toFixed(2)} ج.م, العميل: ${payer}`);
                }

                showCustomAlert({

                    type: 'success',

                    titleText: isEditMode ? '✅ تم تحديث السند' : '✅ تم الحفظ بنجاح',

                    msg: `تم ${isEditMode ? 'تحديث' : 'حفظ'} سند القبض رقم #${receiptID} بنجاح.`

                });

                isEditMode = false;

                editingInvoiceId = null;

                editingOriginalDate = null;

                editingInvoiceType = null;

                const isPrintChecked = document.getElementById('receiptPrintCheck')?.checked || false;
                const isCloseChecked = closeAfterExplicit || document.getElementById('receiptCloseCheck')?.checked || false;

                if (isPrintChecked && typeof printReceiptData === 'function') {
                    try { printReceiptData(); } catch(e) { console.warn(e); }
                }

                resetReceipt();

                if (isCloseChecked) {
                    setTimeout(() => {
                        if (typeof closeTab === 'function') closeTab('receipt');
                        if (typeof switchSection === 'function') switchSection('dashboard');
                    }, 300);
                }

                return true;
            } finally {
                const saveBtns = document.querySelectorAll('#receipt-section .btn-save, #receipt-section .action-btn');
                saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
                isReceiptSaving = false;
            }

        }

        // ================= منطق الصرف (Disbursement Logic) =================

        function resetDisbursement() {

            if (document.getElementById('disburseAmount')) document.getElementById('disburseAmount').value = '';

            if (document.getElementById('disbursePayee')) document.getElementById('disbursePayee').value = '';

            if (document.getElementById('disburseAccountBalance')) document.getElementById('disburseAccountBalance').innerText = '0.00';

            if (document.getElementById('disburseNotes')) document.getElementById('disburseNotes').value = '';

            if (document.getElementById('disburseType')) document.getElementById('disburseType').value = 'أخرى';

            // رقم الحركة يبدأ من 1 ويتسلسل

            if (document.getElementById('disburseID')) {

                document.getElementById('disburseID').value = getNextSequence('صرف');

            }

            // تعيين التاريخ والوقت الحالي

            const now = new Date();

            if (document.getElementById('disburseDate')) document.getElementById('disburseDate').value = now.toLocaleDateString('en-CA');

            if (document.getElementById('disburseTime')) document.getElementById('disburseTime').value = now.toTimeString().slice(0, 5);

            if (document.getElementById('pendingBillsBody')) document.getElementById('pendingBillsBody').innerHTML = '';

            if (document.getElementById('disburseAmount')) document.getElementById('disburseAmount').focus();

        }

        let isDisburseSaving = false;

        async function saveDisbursement(closeAfterExplicit = false, accountChecked = false, force = false) {

            if (isDisburseSaving) return false;
            isDisburseSaving = true;

            const saveBtns = document.querySelectorAll('#disbursement-section .btn-save, #disbursement-section .action-btn');
            saveBtns.forEach(b => { b.disabled = true; b.style.pointerEvents = 'none'; b.style.opacity = '0.6'; });

            try {
                if (!checkPermission('sec_disburse')) return false;

                const amount = parseFloat(document.getElementById('disburseAmount').value);

                const payee = (document.getElementById('disbursePayee')?.value || '').trim();

                if (payee && typeof checkAccountFrozenAndAlert === 'function') {
                    if (checkAccountFrozenAndAlert(payee)) {
                        return false;
                    }
                }

                const type = document.getElementById('disburseType').value;

                if (!amount || amount <= 0) {

                    alert("⚠️ يرجى إدخال مبلغ صرف صحيح!");

                    return false;

                }

                if (!payee || window.isGenericCashPartner(payee)) {

                    showCustomAlert({
                        type: 'error',
                        titleText: '⚠️ مطلوب اختيار المستلم / المورد',
                        msg: 'سندات الصرف تتطلب تحديد حساب مورد أو جهة مسجلة لمتابعة الحسابات.'
                    });

                    return false;

                }

                if (!accountChecked) {
                    const ok = await window.ensurePartnerAccountExists(payee, 'مورد', true, () => {
                        isDisburseSaving = false;
                        saveDisbursement(closeAfterExplicit, true, force);
                    });
                    if (!ok) return false;
                }

                const disburseTreasury = document.getElementById('disburseTreasurySelect')?.value || 'نقدية';
                const disburseMethod = (disburseTreasury.includes('بنك') || disburseTreasury.includes('فيزا') || disburseTreasury.includes('تحويل')) ? disburseTreasury : 'نقدية';
                const isCash = !disburseMethod.includes('بنك') && !disburseMethod.includes('فيزا') && !disburseMethod.includes('تحويل');

                // 🛑 فحص رصيد الدرج / الخزينة قبل صرف النقدية لمنع العجز غير المراقب
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

                    if (currentCash < amount) {
                        saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
                        isDisburseSaving = false;
                        showCustomAlert({
                            type: 'warning',
                            titleText: '⚠️ رصيد الخزينة غير كافٍ',
                            msg: `مبلغ الصرف المطلوب نقداً هو (<b>${amount.toFixed(2)} ج.م</b>) بينما النقدية المتوفرة بالدرج حالياً هي (<b>${currentCash.toFixed(2)} ج.م</b>).<br><br>هل تريد المتابعة والسماح برصيد سالب بالدرج؟`,
                            showCancel: true,
                            confirmText: 'نعم، تابع واصرف',
                            cancelText: 'إلغاء الصرف',
                            onConfirm: () => {
                                saveDisbursement(closeAfterExplicit, accountChecked, true);
                            }
                        });
                        return false;
                    }
                }

                const dt = getTransactionDateTime('disburseDate', 'disburseTime');

                const notes = document.getElementById('disburseNotes') ? document.getElementById('disburseNotes').value.trim() : "";

                const finalDescription = (type === 'أخرى' && notes) ? notes : type;
                if (isEditMode && editingInvoiceId) {

                    if (window.revertAndClearOldInvoice) {

                        await window.revertAndClearOldInvoice(editingInvoiceId, editingInvoiceType);

                    }

                }

                // --- 🛑 التحقق من حدود الباقة المجانية ---

                const currentPlan = window.getBayanPlan();

                if (!isEditMode && !window.enforceSubscriptionCheck('disbursement')) {
                    return false;
                }

                const disburseID = isEditMode ? editingInvoiceId : (document.getElementById('disburseID')?.value || (typeof getNextSequence === 'function' ? getNextSequence('صرف') : 1));

                if (!isEditMode && transactions.some(t => String(t.invoiceId) === String(disburseID) && t.type && t.type.includes('صرف'))) {
                    console.warn("Duplicate Disbursement Blocked");
                    return false;
                }

                const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
                const tInfo = (window.BayanNetworkHub && typeof window.BayanNetworkHub.getTerminalInfo === 'function')
                    ? window.BayanNetworkHub.getTerminalInfo()
                    : { terminal: 'الجهاز الرئيسي 💻', terminalLetter: 'MASTER', terminalOrder: 0, terminalId: '' };
                const terminalName = tInfo.terminal;

                // تسجيل الحركة في السجل العام

                transactions.push({

                    date: dt.full,

                    dateISO: dt.iso,

                    timeISO: dt.time,

                    type: 'صرف 📤',

                    method: disburseMethod,

                    invoiceId: disburseID,

                    product: finalDescription,

                    notes: notes,

                    qty: 1,

                    price: Number(amount) || 0,

                    total: Number((Number(amount) || 0).toFixed(2)),

                    paidAmount: Number((Number(amount) || 0).toFixed(2)),

                    partner: payee,

                    warehouse: activeWH,
                    terminal: terminalName,
                    terminalLetter: tInfo.terminalLetter,
                    terminalOrder: tInfo.terminalOrder,
                    terminalId: tInfo.terminalId,

                    user: currentUser ? currentUser.name : '-',

                    editDate: isEditMode ? `${new Date().toLocaleString('ar-EG')} (تعديل بواسطة: ${currentUser ? currentUser.name : 'مجهول'})` : '-'

                });

                await saveData();

                if (typeof logAuditAction === 'function') {
                    const auditAction = isEditMode ? 'تحديث سند صرف' : 'حفظ سند صرف جديد';
                    logAuditAction(auditAction, `سند صرف رقم #${disburseID}, المبلغ: ${amount.toFixed(2)} ج.م, المستلم/المورد: ${payee}`);
                }

                showCustomAlert({

                    type: 'success',

                    titleText: isEditMode ? '✅ تم تحديث السند' : '✅ تم الحفظ بنجاح',

                    msg: `تم ${isEditMode ? 'تحديث' : 'حفظ'} سند الصرف رقم #${disburseID} بنجاح.`

                });

                isEditMode = false;

                editingInvoiceId = null;

                editingOriginalDate = null;

                editingInvoiceType = null;

                const isPrintChecked = document.getElementById('disbursePrintCheck')?.checked || false;
                const isCloseChecked = closeAfterExplicit || document.getElementById('disburseCloseCheck')?.checked || false;

                if (isPrintChecked && typeof printDisbursementData === 'function') {
                    try { printDisbursementData(); } catch(e) { console.warn(e); }
                }

                resetDisbursement();

                if (isCloseChecked) {
                    setTimeout(() => {
                        if (typeof closeTab === 'function') closeTab('disbursement');
                        if (typeof switchSection === 'function') switchSection('dashboard');
                    }, 300);
                }

                return true;
            } finally {
                const saveBtns = document.querySelectorAll('#disbursement-section .btn-save, #disbursement-section .action-btn');
                saveBtns.forEach(b => { b.disabled = false; b.style.pointerEvents = 'auto'; b.style.opacity = '1'; });
                isDisburseSaving = false;
            }

        }

        // ================= منطق تقرير الحركة اليومية (Daily Report Logic) =================

        function printReceiptData() {
            const payer = (document.getElementById('receiptCustomer')?.value || '').trim();
            const amount = parseFloat(document.getElementById('receiptAmount')?.value) || 0;
            const isPayerEmpty = (!payer || payer === 'غير محدد' || payer === 'عميل نقدي' || payer === 'عميل');

            if (amount <= 0 && isPayerEmpty) {
                if (typeof showToast === 'function') showToast("⚠️ لا يمكن الطباعة: يرجى كتابة اسم العميل وإدخال مبلغ سند القبض أولاً!", "warning");
                else alert("⚠️ لا يمكن الطباعة: يرجى كتابة اسم العميل وإدخال مبلغ سند القبض أولاً!");
                return;
            } else if (amount <= 0) {
                if (typeof showToast === 'function') showToast("⚠️ لا يمكن الطباعة: يرجى إدخال مبلغ صحيح لسند القبض أولاً!", "warning");
                else alert("⚠️ لا يمكن الطباعة: يرجى إدخال مبلغ صحيح لسند القبض أولاً!");
                return;
            } else if (isPayerEmpty) {
                if (typeof showToast === 'function') showToast("⚠️ لا يمكن الطباعة: يرجى كتابة وتحديد اسم العميل أولاً للسند!", "warning");
                else alert("⚠️ لا يمكن الطباعة: يرجى كتابة وتحديد اسم العميل أولاً للسند!");
                return;
            }

            const id = document.getElementById('receiptID')?.value || '';
            const date = document.getElementById('receiptDate')?.value || new Date().toLocaleDateString('en-CA');
            const time = document.getElementById('receiptTime')?.value || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

            let savedPosSettings = {};
            try { savedPosSettings = JSON.parse(getStore('pos_settings') || '{}'); } catch(e) {}
            const shopName = savedPosSettings.name || document.getElementById('shopName')?.value || 'مؤسستي';
            const footerMsg = savedPosSettings.printFooterMsg || document.getElementById('printFooterMsg')?.value || 'شكراً لتعاملكم معنا!';

            const isAlreadySaved = transactions.some(t => String(t.invoiceId) === String(id) && (t.type || '').includes('قبض'));
            const currentBalance = typeof getAccountBalance === 'function' ? getAccountBalance(payer) : 0;
            let balBefore, balAfter;
            if (isAlreadySaved) {
                balAfter = currentBalance;
                balBefore = currentBalance + amount;
            } else {
                balBefore = currentBalance;
                balAfter = currentBalance - amount;
            }

            const formatMoney = (num) => {
                const isNeg = num < 0;
                const formatted = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return isNeg ? `-${formatted}` : formatted;
            };

            const htmlContent = `
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="utf-8">
                    <title>سند قبض #${id} - ${shopName}</title>
                    <style>
                        @page { margin: 0; size: 80mm auto; }
                        *, *::before, *::after { box-sizing: border-box !important; }
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                            max-width: 80mm !important;
                            background: #fff !important;
                            color: #000 !important;
                            font-family: 'Cairo', 'Segoe UI', Arial, sans-serif !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .receipt-card {
                            width: 72mm;
                            margin: 0 auto;
                            padding: 3mm 2mm;
                            text-align: center;
                        }
                        .shop-header {
                            font-size: 19px;
                            font-weight: 900;
                            margin-bottom: 5px;
                            color: #000;
                        }
                        .doc-badge {
                            font-size: 14px;
                            font-weight: 900;
                            border: 2px solid #000;
                            display: inline-block;
                            padding: 2px 14px;
                            border-radius: 4px;
                            margin-bottom: 8px;
                        }
                        .meta-row {
                            display: flex;
                            justify-content: space-between;
                            font-size: 12px;
                            font-weight: 800;
                            border-bottom: 1.5px solid #000;
                            padding-bottom: 5px;
                            margin-bottom: 8px;
                        }
                        .box-info {
                            border: 1.5px solid #000;
                            border-radius: 6px;
                            padding: 8px;
                            margin-bottom: 10px;
                            text-align: right;
                            font-size: 13px;
                            font-weight: 700;
                        }
                        .amount-container {
                            margin-top: 6px;
                            text-align: center;
                            font-size: 13px;
                            font-weight: 900;
                        }
                        .amount-val {
                            font-size: 22px;
                            font-weight: 900;
                            border: 2px solid #000;
                            display: inline-block;
                            padding: 2px 12px;
                            border-radius: 6px;
                            margin-top: 3px;
                            font-family: 'Segoe UI', Arial, sans-serif;
                            direction: ltr !important;
                        }
                        .summary-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 12px;
                            border: 1.5px solid #000;
                        }
                        .summary-table th {
                            border: 1px solid #000;
                            padding: 4px 2px;
                            font-size: 11px;
                            font-weight: 900;
                            color: #000 !important;
                            background: #ffffff;
                        }
                        .summary-table td {
                            border: 1px solid #000;
                            padding: 6px 2px;
                            font-size: 12px;
                            font-weight: 900;
                            text-align: center;
                            font-family: 'Segoe UI', Arial, sans-serif;
                            direction: ltr !important;
                            white-space: nowrap;
                        }
                        .sign-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 15px;
                            margin-top: 20px;
                            font-size: 12px;
                            font-weight: 800;
                        }
                        .sign-line {
                            border-top: 1.5px solid #000;
                            padding-top: 4px;
                            text-align: center;
                        }
                        .footer-text {
                            margin-top: 15px;
                            border-top: 1px dashed #000;
                            padding-top: 8px;
                            font-size: 11px;
                            font-weight: 700;
                            color: #333;
                        }
                    </style>
                </head>
                <body>
                    <div class="receipt-card">
                        <div class="shop-header">${shopName}</div>
                        <div class="doc-badge">سند قبض نقدية</div>
                        <div class="meta-row">
                            <span>رقم: ${id}</span>
                            <span>التاريخ: ${date}</span>
                        </div>

                        <div class="box-info">
                            <div>وصلنا من السيد: <b style="font-size:14px; font-weight:900;">${payer}</b></div>
                            <div class="amount-container">
                                <div>المبلغ المقبوض:</div>
                                <div class="amount-val">${formatMoney(amount)}</div>
                            </div>
                        </div>

                        <table class="summary-table">
                            <thead>
                                <tr>
                                    <th style="width:33%;">الرصيد السابق</th>
                                    <th style="width:34%;">المبلغ المقبوض</th>
                                    <th style="width:33%;">المتبقي عليه</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${formatMoney(balBefore)}</td>
                                    <td>${formatMoney(amount)}</td>
                                    <td>${formatMoney(balAfter)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="sign-grid">
                            <div class="sign-line">توقيع المستلم</div>
                            <div class="sign-line">الختم والاعتماد</div>
                        </div>

                        <div class="footer-text">
                            <div>${footerMsg}</div>
                            <div style="font-size:9px; color:#666; margin-top:3px;">نظام بَيَان POS المتكامل</div>
                        </div>
                    </div>
                    <script>
                        window.onload = function() {
                            window.focus();
                            setTimeout(function() {
                                window.print();
                                setTimeout(function() { window.close(); }, 500);
                            }, 200);
                        };
                    <\/script>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
            } else {
                document.getElementById('receipt-area').innerHTML = htmlContent;
                window.print();
            }
        }

        function printDisbursementData() {
            const payee = (document.getElementById('disbursePayee')?.value || '').trim();
            const amount = parseFloat(document.getElementById('disburseAmount')?.value) || 0;
            const isPayeeEmpty = (!payee || payee === 'غير محدد' || payee === 'مورد نقدي' || payee === 'جهة');

            if (amount <= 0 && isPayeeEmpty) {
                if (typeof showToast === 'function') showToast("⚠️ لا يمكن الطباعة: يرجى كتابة اسم المستلم/المورد وإدخال مبلغ سند الصرف أولاً!", "warning");
                else alert("⚠️ لا يمكن الطباعة: يرجى كتابة اسم المستلم/المورد وإدخال مبلغ سند الصرف أولاً!");
                return;
            } else if (amount <= 0) {
                if (typeof showToast === 'function') showToast("⚠️ لا يمكن الطباعة: يرجى إدخال مبلغ صحيح لسند الصرف أولاً!", "warning");
                else alert("⚠️ لا يمكن الطباعة: يرجى إدخال مبلغ صحيح لسند الصرف أولاً!");
                return;
            } else if (isPayeeEmpty) {
                if (typeof showToast === 'function') showToast("⚠️ لا يمكن الطباعة: يرجى كتابة اسم المستلم / المورد أولاً للسند!", "warning");
                else alert("⚠️ لا يمكن الطباعة: يرجى كتابة اسم المستلم / المورد أولاً للسند!");
                return;
            }

            const id = document.getElementById('disburseID')?.value || '';
            const date = document.getElementById('disburseDate')?.value || new Date().toLocaleDateString('en-CA');
            const time = document.getElementById('disburseTime')?.value || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

            let savedPosSettings = {};
            try { savedPosSettings = JSON.parse(getStore('pos_settings') || '{}'); } catch(e) {}
            const shopName = savedPosSettings.name || document.getElementById('shopName')?.value || 'مؤسستي';
            const footerMsg = savedPosSettings.printFooterMsg || document.getElementById('printFooterMsg')?.value || 'شكراً لتعاملكم معنا!';

            const isAlreadySaved = transactions.some(t => String(t.invoiceId) === String(id) && (t.type || '').includes('صرف'));
            const currentBalance = typeof getAccountBalance === 'function' ? getAccountBalance(payee) : 0;
            let balBefore, balAfter;
            if (isAlreadySaved) {
                balAfter = currentBalance;
                balBefore = currentBalance - amount;
            } else {
                balBefore = currentBalance;
                balAfter = currentBalance + amount;
            }

            const formatMoney = (num) => {
                const isNeg = num < 0;
                const formatted = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return isNeg ? `-${formatted}` : formatted;
            };

            const htmlContent = `
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="utf-8">
                    <title>سند صرف #${id} - ${shopName}</title>
                    <style>
                        @page { margin: 0; size: 80mm auto; }
                        *, *::before, *::after { box-sizing: border-box !important; }
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                            max-width: 80mm !important;
                            background: #fff !important;
                            color: #000 !important;
                            font-family: 'Cairo', 'Segoe UI', Arial, sans-serif !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .receipt-card {
                            width: 72mm;
                            margin: 0 auto;
                            padding: 3mm 2mm;
                            text-align: center;
                        }
                        .shop-header {
                            font-size: 19px;
                            font-weight: 900;
                            margin-bottom: 5px;
                            color: #000;
                        }
                        .doc-badge {
                            font-size: 14px;
                            font-weight: 900;
                            border: 2px solid #000;
                            display: inline-block;
                            padding: 2px 14px;
                            border-radius: 4px;
                            margin-bottom: 8px;
                        }
                        .meta-row {
                            display: flex;
                            justify-content: space-between;
                            font-size: 12px;
                            font-weight: 800;
                            border-bottom: 1.5px solid #000;
                            padding-bottom: 5px;
                            margin-bottom: 8px;
                        }
                        .box-info {
                            border: 1.5px solid #000;
                            border-radius: 6px;
                            padding: 8px;
                            margin-bottom: 10px;
                            text-align: right;
                            font-size: 13px;
                            font-weight: 700;
                        }
                        .amount-container {
                            margin-top: 6px;
                            text-align: center;
                            font-size: 13px;
                            font-weight: 900;
                        }
                        .amount-val {
                            font-size: 22px;
                            font-weight: 900;
                            border: 2px solid #000;
                            display: inline-block;
                            padding: 2px 12px;
                            border-radius: 6px;
                            margin-top: 3px;
                            font-family: 'Segoe UI', Arial, sans-serif;
                            direction: ltr !important;
                        }
                        .summary-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 12px;
                            border: 1.5px solid #000;
                        }
                        .summary-table th {
                            border: 1px solid #000;
                            padding: 4px 2px;
                            font-size: 11px;
                            font-weight: 900;
                            color: #000 !important;
                            background: #ffffff;
                        }
                        .summary-table td {
                            border: 1px solid #000;
                            padding: 6px 2px;
                            font-size: 12px;
                            font-weight: 900;
                            text-align: center;
                            font-family: 'Segoe UI', Arial, sans-serif;
                            direction: ltr !important;
                            white-space: nowrap;
                        }
                        .sign-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 15px;
                            margin-top: 20px;
                            font-size: 12px;
                            font-weight: 800;
                        }
                        .sign-line {
                            border-top: 1.5px solid #000;
                            padding-top: 4px;
                            text-align: center;
                        }
                        .footer-text {
                            margin-top: 15px;
                            border-top: 1px dashed #000;
                            padding-top: 8px;
                            font-size: 11px;
                            font-weight: 700;
                            color: #333;
                        }
                    </style>
                </head>
                <body>
                    <div class="receipt-card">
                        <div class="shop-header">${shopName}</div>
                        <div class="doc-badge">سند صرف نقدية</div>
                        <div class="meta-row">
                            <span>رقم: ${id}</span>
                            <span>التاريخ: ${date}</span>
                        </div>

                        <div class="box-info">
                            <div>صرف للسيد: <b style="font-size:14px; font-weight:900;">${payee}</b></div>
                            <div class="amount-container">
                                <div>المبلغ المنصرف:</div>
                                <div class="amount-val">${formatMoney(amount)}</div>
                            </div>
                        </div>

                        <table class="summary-table">
                            <thead>
                                <tr>
                                    <th style="width:33%;">كان له</th>
                                    <th style="width:34%;">المنصرف</th>
                                    <th style="width:33%;">المتبقي له</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${formatMoney(balBefore)}</td>
                                    <td>${formatMoney(amount)}</td>
                                    <td>${formatMoney(balAfter)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="sign-grid">
                            <div class="sign-line">توقيع المستلم</div>
                            <div class="sign-line">المدير المالي</div>
                        </div>

                        <div class="footer-text">
                            <div>${footerMsg}</div>
                            <div style="font-size:9px; color:#666; margin-top:3px;">نظام بَيَان POS المتكامل</div>
                        </div>
                    </div>
                    <script>
                        window.onload = function() {
                            window.focus();
                            setTimeout(function() {
                                window.print();
                                setTimeout(function() { window.close(); }, 500);
                            }, 200);
                        };
                    <\/script>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
            } else {
                document.getElementById('receipt-area').innerHTML = htmlContent;
                window.print();
            }
        }

        function quickTransaction(type) {
            if (type === 'receipt' && typeof checkPermission === 'function' && !checkPermission('sec_receipt')) return;
            if (type === 'disbursement' && typeof checkPermission === 'function' && !checkPermission('sec_disburse')) return;

            const accId = window.selectedAccountID || (typeof selectedAccountID !== 'undefined' ? selectedAccountID : null);
            if (!accId) return alert("⚠️ يرجى تحديد حساب أولاً (بالضغط عليه في الجدول) قبل الضغط على قبض أو صرف!");

            const allAccs = window.accounts || (typeof accounts !== 'undefined' ? accounts : []);
            const acc = allAccs.find(a => a.id == accId || a.id === accId);
            if (!acc) return alert("⚠️ لم يتم العثور على بيانات الحساب المحدد!");

            // فحص التجميد مباشرة
            const isFrozen = (acc.inactive === true || acc.inactive === 'true' || acc.isFrozen === true);
            if (isFrozen) {
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'error',
                        titleText: '❄️ الحساب مجمّد',
                        msg: `عذراً، الحساب "<b>${acc.name}</b>" مجمّد حالياً من قبل الإدارة.<br>لا يمكن إنشاء سندات قبض أو صرف له حتى يتم إلغاء التجميد.`
                    });
                } else {
                    alert(`❄️ عذراً، الحساب "${acc.name}" مجمّد حالياً ولا يمكن إجراء حركات مالية عليه.`);
                }
                return;
            }

            const balance = typeof getAccountBalance === 'function' ? getAccountBalance(acc.name) : (acc.balance || 0);
            let formattedBal = '0.00 ج.م (خالص)';
            if (balance > 0.005) {
                formattedBal = `${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م (عليه)`;
            } else if (balance < -0.005) {
                formattedBal = `${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} ج.م (له)`;
            }

            if (type === 'receipt') {
                switchSection('receipt');

                setTimeout(() => {
                    const customerInput = document.getElementById('receiptCustomer');
                    if (customerInput) {
                        customerInput.value = acc.name;
                    }

                    const clearBtn = document.getElementById('receiptCustomerClear');
                    if (clearBtn) clearBtn.style.display = 'block';

                    const balEl = document.getElementById('receiptAccountBalance');
                    if (balEl) balEl.innerText = formattedBal;

                    const amountInput = document.getElementById('receiptAmount');
                    if (amountInput) {
                        amountInput.focus();
                        amountInput.select();
                    }
                }, 50);
            } else {
                switchSection('disbursement');

                setTimeout(() => {
                    const payeeInput = document.getElementById('disbursePayee');
                    if (payeeInput) {
                        payeeInput.value = acc.name;
                    }

                    const clearBtn = document.getElementById('disbursePayeeClear');
                    if (clearBtn) clearBtn.style.display = 'block';

                    const balEl = document.getElementById('disburseAccountBalance');
                    if (balEl) balEl.innerText = formattedBal;

                    const amountInput = document.getElementById('disburseAmount');
                    if (amountInput) {
                        amountInput.focus();
                        amountInput.select();
                    }
                }, 50);
            }
        }
        window.quickTransaction = quickTransaction;
