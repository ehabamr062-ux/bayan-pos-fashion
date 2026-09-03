// ============================================================
//  إدارة الفواتير السابقة وتعديلها واستعراض بنودها (Invoices Management)
// ============================================================
        // 🙈 خاصية إظهار / إخفاء المبالغ المالية في تقرير الحركة اليومية للحفاظ على الخصوصية
        window.toggleDailyReportAmountsPrivacy = function() {
            const isHidden = document.body.classList.toggle('daily-amounts-hidden');
            const iconEl = document.getElementById('dailyAmountsEyeIcon');
            const textEl = document.getElementById('dailyAmountsEyeText');
            const btn = document.getElementById('toggleDailyAmountsBtn');

            if (isHidden) {
                if (iconEl) iconEl.innerText = '🙈';
                if (textEl) textEl.innerText = 'إظهار المبالغ';
                if (btn) {
                    btn.style.background = '#fee2e2';
                    btn.style.borderColor = '#fca5a5';
                    btn.style.color = '#dc2626';
                }
                if (typeof showToast === 'function') showToast('🙈 تم إخفاء المبالغ المالية للخصوصية', 'info');
            } else {
                if (iconEl) iconEl.innerText = '👁️';
                if (textEl) textEl.innerText = 'إخفاء المبالغ';
                if (btn) {
                    btn.style.background = '#f1f5f9';
                    btn.style.borderColor = '#cbd5e1';
                    btn.style.color = '#475569';
                }
                if (typeof showToast === 'function') showToast('👁️ تم إظهار المبالغ المالية', 'success');
            }
        };

        window.accountBalancesCache = {};

        function getAccountBalance(name, excludeInvoiceId = null) {
            if (!name || (window.isGenericCashPartner && window.isGenericCashPartner(name))) return 0;
            const cleanArabic = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            const targetNameClean = cleanArabic(name);
            const activeExcludeId = excludeInvoiceId ? String(excludeInvoiceId) : null;
            const cacheKey = targetNameClean + "_" + (activeExcludeId || 'none');

            if (window.accountBalancesCache && window.accountBalancesCache[cacheKey] !== undefined) {
                return window.accountBalancesCache[cacheKey];
            }

            const acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => cleanArabic(a.name) === targetNameClean);
            if (!acc) return 0;

            let initialDebit = parseFloat(acc.debit) || 0;
            let initialCredit = parseFloat(acc.credit) || 0;
            let currentBalance = initialDebit - initialCredit;

            const accTrans = (typeof transactions !== 'undefined' ? transactions : []).filter(t => 
                cleanArabic(t.partner) === targetNameClean && 
                (!activeExcludeId || String(t.invoiceId) !== activeExcludeId)
            );

            const ivMap = {};
            const singleTrans = [];

            accTrans.forEach(t => {
                const isInvoice = (t.type && (t.type.includes('بيع') || t.type.includes('شراء'))) && t.invoiceId;
                if (isInvoice) {
                    const isReturn = t.type.includes('مرتجع');
                    const cleanT = t.type.replace(/📤|📥|↩️/g, '').trim();
                    const key = (isReturn ? "RET_" : "") + cleanT + "_" + t.invoiceId;
                    if (!ivMap[key]) {
                        ivMap[key] = {
                            type: t.type,
                            invoiceId: t.invoiceId,
                            method: t.method || '',
                            total: 0,
                            paid: 0,
                            isReturn: isReturn
                        };
                    }
                    ivMap[key].total += (parseFloat(t.total) || 0);
                    if (t.isInvoiceHead || t.paidAmount !== undefined || t.paid !== undefined) {
                        const pAmt = parseFloat(t.paidAmount !== undefined ? t.paidAmount : t.paid) || 0;
                        ivMap[key].paid = Math.max(ivMap[key].paid, pAmt);
                    }
                } else {
                    singleTrans.push(t);
                }
            });

            Object.values(ivMap).forEach(iv => {
                let debit = 0;
                let credit = 0;

                if (iv.type.includes('بيع')) {
                    if (iv.type.includes('مرتجع')) {
                        debit = iv.paid;     // كاش مسترد للمشتري عند الإرجاع
                        credit = iv.total;   // قيمة الصنف المرتجع تخصم من حسابه
                    } else {
                        debit = iv.total;    // قيمة الفاتورة تضاف على العميل (مدين)
                        credit = iv.paid;    // ما دفعه العميل نقداً يخصم من حسابه
                    }
                } else if (iv.type.includes('شراء')) {
                    if (iv.type.includes('مرتجع')) {
                        debit = iv.total;    // قيمة البضاعة المرتجعة للمورد تخصم من مديونيته
                        credit = iv.paid;    // ما استرددناه كاش
                    } else {
                        debit = iv.paid;     // ما سددناه للمورد نقداً
                        credit = iv.total;   // قيمة فاتورة التوريد تضاف للمورد (دائن)
                    }
                }

                currentBalance += (debit - credit);
            });

            singleTrans.forEach(t => {
                const amount = parseFloat(t.total) || parseFloat(t.price) || 0;
                if (t.type.includes('قبض') || t.type.includes('مرتجع بيع')) {
                    currentBalance -= amount;
                } else if (t.type.includes('صرف') || t.type.includes('مرتجع شراء') || t.type.includes('بيع')) {
                    currentBalance += amount;
                }
            });

            if (!window.accountBalancesCache) window.accountBalancesCache = {};
            window.accountBalancesCache[cacheKey] = currentBalance;

            return currentBalance;
        }

        window.getAccountBalance = getAccountBalance;

        // دالة حساب الرصيد التاريخي للعميل/المورد عند لحظة إصدار فاتورة معينة
        function getHistoricalPartnerBalance(name, invoiceId = null, beforeIndex = null) {
            if (!name || (window.isGenericCashPartner && window.isGenericCashPartner(name))) return 0;
            const cleanArabic = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            const targetNameClean = cleanArabic(name);

            const acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => cleanArabic(a.name) === targetNameClean);
            if (!acc) return 0;

            let balance = (parseFloat(acc.debit) || 0) - (parseFloat(acc.credit) || 0);
            const allTrans = (typeof transactions !== 'undefined' ? transactions : []);

            let cutoffIdx = allTrans.length;
            if (beforeIndex !== null && beforeIndex !== undefined && beforeIndex >= 0) {
                cutoffIdx = beforeIndex;
            } else if (invoiceId) {
                const firstIdx = allTrans.findIndex(t => String(t.invoiceId) === String(invoiceId));
                if (firstIdx !== -1) {
                    cutoffIdx = firstIdx;
                }
            }

            const priorTrans = allTrans.slice(0, cutoffIdx).filter(t => cleanArabic(t.partner) === targetNameClean);

            const ivMap = {};
            const singleTrans = [];

            priorTrans.forEach(t => {
                const isInvoice = (t.type && (t.type.includes('بيع') || t.type.includes('شراء'))) && t.invoiceId;
                if (isInvoice) {
                    const isReturn = t.type.includes('مرتجع');
                    const cleanT = t.type.replace(/📤|📥|↩️/g, '').trim();
                    const key = (isReturn ? "RET_" : "") + cleanT + "_" + t.invoiceId;
                    if (!ivMap[key]) {
                        ivMap[key] = {
                            type: t.type,
                            invoiceId: t.invoiceId,
                            method: t.method || '',
                            total: 0,
                            paid: 0,
                            isReturn: isReturn
                        };
                    }
                    ivMap[key].total += (parseFloat(t.total) || 0);
                    if (t.isInvoiceHead || t.paidAmount !== undefined || t.paid !== undefined) {
                        const pAmt = parseFloat(t.paidAmount !== undefined ? t.paidAmount : t.paid) || 0;
                        ivMap[key].paid = Math.max(ivMap[key].paid, pAmt);
                    }
                } else {
                    singleTrans.push(t);
                }
            });

            Object.values(ivMap).forEach(iv => {
                let debit = 0;
                let credit = 0;
                if (iv.type.includes('بيع')) {
                    if (iv.type.includes('مرتجع')) {
                        debit = iv.paid;
                        credit = iv.total;
                    } else {
                        debit = iv.total;
                        credit = iv.paid;
                    }
                } else if (iv.type.includes('شراء')) {
                    if (iv.type.includes('مرتجع')) {
                        debit = iv.total;
                        credit = iv.paid;
                    } else {
                        debit = iv.paid;
                        credit = iv.total;
                    }
                }
                balance += (debit - credit);
            });

            singleTrans.forEach(t => {
                const amount = parseFloat(t.total) || parseFloat(t.price) || 0;
                if (t.type.includes('قبض') || t.type.includes('مرتجع بيع')) {
                    balance -= amount;
                } else if (t.type.includes('صرف') || t.type.includes('مرتجع شراء') || t.type.includes('بيع')) {
                    balance += amount;
                }
            });

            return balance;
        }

        window.getHistoricalPartnerBalance = getHistoricalPartnerBalance;

        // دالة موحدة لتجميع الحركات والفواتير بحسب الفاتورة لمنع أي تباين في الحسابات
        function getGroupedTransactions(txList) {
            if (!Array.isArray(txList)) return [];
            const groups = {};

            txList.forEach((t, i) => {
                const key = (t.invoiceId || 'single_' + (t.originalIndex !== undefined ? t.originalIndex : i)) + '_' + t.type;
                if (!groups[key]) {
                    groups[key] = {
                        invoiceId: t.invoiceId,
                        date: t.date,
                        dateISO: t.dateISO,
                        type: t.type,
                        partner: t.partner,
                        method: t.method || t.paymentMethod,
                        user: t.user,
                        itemsCount: 0,
                        total: 0,
                        profit: 0,
                        paid: 0,
                        remaining: 0,
                        warehouse: t.warehouse,
                        editDate: t.editDate,
                        notes: t.notes,
                        originalIndex: t.originalIndex !== undefined ? t.originalIndex : i,
                        is_returned: t.is_returned || false,
                        products: []
                    };
                }

                if (t.partner && (!groups[key].partner || groups[key].partner === 'عميل نقدي' || groups[key].partner === 'مورد نقدي')) {
                    groups[key].partner = t.partner;
                }
                if (t.method) {
                    groups[key].method = t.method;
                }
                if (t.is_returned) groups[key].is_returned = true;
                if (t.product) {
                    groups[key].itemsCount++;
                    groups[key].products.push(`${t.product} (x${t.qty || 0})`);
                }

                groups[key].total += (parseFloat(t.total) || parseFloat(t.price) || 0);

                const pRaw = parseFloat(t.profit) || 0;
                let itemProfit = pRaw;
                if (t.type && t.type.includes('مرتجع بيع')) {
                    itemProfit = pRaw > 0 ? -pRaw : pRaw;
                } else if (t.type && t.type.includes('مرتجع شراء')) {
                    itemProfit = 0;
                }
                groups[key].profit += itemProfit;

                if (t.isInvoiceHead || t.paidAmount !== undefined) {
                    groups[key].paid = Math.max(groups[key].paid, (parseFloat(t.paidAmount) || 0));
                } else if (!t.invoiceId) {
                    groups[key].paid = (parseFloat(t.total) || parseFloat(t.price) || 0);
                }
            });

            Object.values(groups).forEach(g => {
                const m = (g.method || '').toLowerCase();
                const isExplicitCredit = m.includes('آجل') || m.includes('أجل') || m.includes('ذمم') || m.includes('credit') || m.includes('تقسيط');
                
                if (isExplicitCredit) {
                    g.remaining = Math.max(0, g.total - g.paid);
                } else if (m.includes('نقدي') || m.includes('نقدية') || m.includes('كاش') || m.includes('تحويل') || m.includes('بنك') || m.includes('شبكة') || m.includes('فيزا') || g.type.includes('تسوية') || g.type.includes('قبض') || g.type.includes('صرف')) {
                    g.paid = g.total;
                    g.remaining = 0;
                } else {
                    g.remaining = Math.max(0, g.total - g.paid);
                }
            });

            return Object.values(groups);
        }
        window.getGroupedTransactions = getGroupedTransactions;

        function renderInvoicesTable() {

            const tbody = document.getElementById('invoicesTableBody');

            tbody.innerHTML = '';

            const searchId = document.getElementById('invoicesSearchId').value.toLowerCase();

            const searchPartner = document.getElementById('invoicesSearchPartner').value.toLowerCase();

            const searchProduct = document.getElementById('invoicesSearchProduct') ? document.getElementById('invoicesSearchProduct').value.toLowerCase() : '';

            const searchMethod = document.getElementById('invoicesSearchMethod').value;

            const typeFilter = document.getElementById('invoicesTypeFilter').value;

            const fromDate = document.getElementById('invoicesDateFrom').value;

            const toDate = document.getElementById('invoicesDateTo').value;

            // إضافة index أصلي لكل عنصر للتمكن من حذفه أو تعديله

            let rawData = transactions.map((t, i) => ({ ...t, originalIndex: i }));

            const cleanAr = (str) => (str || '').toString().trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');

            // فلترة التاريخ بمرونة
            if (fromDate) {
                rawData = rawData.filter(t => {
                    const iso = t.dateISO || (t.date ? t.date.split(' ')[0] : '');
                    return iso ? (iso >= fromDate) : true;
                });
            }

            if (toDate) {
                rawData = rawData.filter(t => {
                    const iso = t.dateISO || (t.date ? t.date.split(' ')[0] : '');
                    return iso ? (iso <= toDate) : true;
                });
            }

            // تصفية أصلية (Modified for Tabs)
            if (typeFilter === 'all') {
                // لا نستثني أياً من العمليات ليظهر الكل بما في ذلك تسوية المخزون والتحويلات
            } else {
                rawData = rawData.filter(t => {
                    const tType = t.type || '';
                    if (typeFilter === 'بيع') {
                        return tType.includes('بيع') && !tType.includes('مرتجع');
                    }
                    if (typeFilter === 'شراء') {
                        return (tType.includes('شراء') || tType.includes('مشتريات')) && !tType.includes('مرتجع');
                    }
                    if (typeFilter === 'مرتجع بيع') {
                        return tType.includes('مرتجع') && tType.includes('بيع');
                    }
                    if (typeFilter === 'مرتجع شراء') {
                        return tType.includes('مرتجع') && (tType.includes('شراء') || tType.includes('مشتريات'));
                    }
                    return tType.includes(typeFilter);
                });
            }

            if (searchId) {
                rawData = rawData.filter(t => t.invoiceId && t.invoiceId.toString().includes(searchId));
            }

            if (searchPartner) {
                const cleanSearch = cleanAr(searchPartner);
                const matchingAccountNames = accounts.filter(acc => {
                    const nameMatch = acc.name && cleanAr(acc.name).includes(cleanSearch);
                    const codeMatch = acc.code && acc.code.toString().toLowerCase().includes(searchPartner);
                    const phoneMatch = (acc.mobile && acc.mobile.toString().includes(searchPartner)) || (acc.landline && acc.landline.toString().includes(searchPartner));
                    return nameMatch || codeMatch || phoneMatch;
                }).map(acc => cleanAr(acc.name));

                rawData = rawData.filter(t => {
                    const pName = cleanAr(t.partner);
                    return pName.includes(cleanSearch) || matchingAccountNames.some(m => pName.includes(m) || m.includes(pName));
                });
            }

            if (searchProduct) {
                rawData = rawData.filter(t => t.product && t.product.toLowerCase().includes(searchProduct));
            }

            let finalData = [];

            if (currentInvoicesView === 'operation') {
                finalData = getGroupedTransactions(rawData);
            } else {
                // عرض الأصناف تفصيلياً - نستبعد سجلات الرأس الفارغة (مثل رأس التسوية) لمنع التكرار
                finalData = rawData.filter(t => t.product || t.type.includes('قبض') || t.type.includes('صرف'));
            }

            // تطبيق فلترة طريقة السداد بدقة بعد التجميع (نقدي / آجل / الكل)
            if (searchMethod !== 'all') {
                if (searchMethod === 'cash') {
                    finalData = finalData.filter(t => {
                        const m = ((t.method || t.paymentMethod || '') + '').toLowerCase();
                        const isCreditMethod = m.includes('آجل') || m.includes('اجل') || m.includes('credit') || m.includes('تقسيط') || m.includes('ذمم');
                        const hasRemaining = (parseFloat(t.remaining) || 0) > 0.001;
                        // الفاتورة النقدية: ليست بطريقة آجل وليس عليها أي متبقي
                        return !isCreditMethod && !hasRemaining;
                    });
                } else if (searchMethod === 'credit') {
                    finalData = finalData.filter(t => {
                        const m = ((t.method || t.paymentMethod || '') + '').toLowerCase();
                        const isCreditMethod = m.includes('آجل') || m.includes('اجل') || m.includes('credit') || m.includes('تقسيط') || m.includes('ذمم');
                        const hasRemaining = (parseFloat(t.remaining) || 0) > 0.001;
                        // الفاتورة الآجلة: طريقة دفعها آجل أو عليها متبقي
                        return isCreditMethod || hasRemaining;
                    });
                }
            }

            finalData.reverse(); // عرض الأحدث أولاً

            // 🆕 حساب الإجماليات للشريط الملخص

            let sumTotal = 0, sumPaid = 0, sumDebt = 0, sumProfit = 0;

            finalData.forEach(t => {

                sumTotal += (parseFloat(t.total) || 0);

                sumPaid += (parseFloat(t.paid) || 0);

                sumDebt += (parseFloat(t.remaining) || 0);

                // حساب وتخصيص الربح الصافي بما يشمل خصم مرتجع البيع بالسالب
                const rawP = parseFloat(t.profit) || 0;
                if (t.type && t.type.includes('مرتجع بيع')) {
                    sumProfit += (rawP > 0 ? -rawP : rawP);
                } else if (t.type && !t.type.includes('مرتجع')) {
                    sumProfit += rawP;
                }

            });

            if (document.getElementById('invSumCount')) document.getElementById('invSumCount').innerText = finalData.length;

            if (document.getElementById('invSumTotal')) document.getElementById('invSumTotal').innerText = sumTotal.toFixed(2);

            if (document.getElementById('invSumPaid')) document.getElementById('invSumPaid').innerText = sumPaid.toFixed(2);

            if (document.getElementById('invSumDebt')) document.getElementById('invSumDebt').innerText = sumDebt.toFixed(2);

            if (document.getElementById('invSumProfit')) document.getElementById('invSumProfit').innerText = sumProfit.toFixed(2);

            // إخفاء/إظهار كارت الأرباح بناءً على الصلاحيات

            const hasProfitPerm = checkPermission('general_profits');

            const profitCard = document.getElementById('invProfitCard');

            if (profitCard) profitCard.style.display = hasProfitPerm ? 'flex' : 'none';

            // إخفاء عمود الربح في الجدول برمجياً إذا لم يكن هناك صلاحية

            invoicesColumnVisibility[5] = hasProfitPerm;

            updateInvoicesTableStyles();

            // تحديث رؤوس الجدول يدوياً لضمان المطابقة الكاملة ومنع الترحيل

            const invHeadCells = document.querySelectorAll('#invoicesMainTable thead th');

            invHeadCells.forEach((th, idx) => {

                if (invoicesColumnVisibility[idx] === false) th.style.display = 'none';
                else th.style.display = '';
            });

            let rowsHtml = '';
            finalData.forEach((t) => {
                const isSelected = (selectedInvoiceIndex === t.originalIndex);

                // حساب وتنسيق عرض الربح للمرتجعات في الجدول بالسالب وباللون المناسب
                const rawProfit = parseFloat(t.profit) || 0;
                let displayProfit = rawProfit;
                if (t.type && t.type.includes('مرتجع بيع')) {
                    displayProfit = rawProfit > 0 ? -rawProfit : rawProfit;
                } else if (t.type && t.type.includes('مرتجع شراء')) {
                    displayProfit = 0;
                }

                const profitText = (t.profit !== undefined && t.profit !== '-') ? displayProfit.toFixed(2) : '-';
                const profitColor = displayProfit < 0 ? '#ef4444' : (displayProfit > 0 ? '#10b981' : '#64748b');

                const warehouse = t.warehouse || 'المخزن الرئيسي';

                let displayProduct = '';

                const isFinancial = t.type.includes('قبض') || t.type.includes('صرف');
                const isSalesOrPurchase = t.type.includes('بيع') || t.type.includes('شراء') || t.type.includes('مبيعات') || t.type.includes('مشتريات');

                if (currentInvoicesView === 'operation') {

                    if (isFinancial) {

                        displayProduct = `<div title="حركة نقدية لـ: ${t.partner || '-'}"><b>${t.partner || '-'}</b> (حركة نقدية) • <small style="color:#888;">${t.product !== 'أخرى' ? t.product : 'صرف/قبض نقدية'}</small></div>`;

                    } else {

                        displayProduct = `<div title="فاتورة رقم #${t.invoiceId} - اضغط على زر التفاصيل لرؤية الأصناف" style="display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;"><b>${t.partner || '-'}</b> (عدد ${t.itemsCount} أصناف) <button class="tool-btn" style="padding: 2px 6px; font-size: 0.7rem; background: #9b59b6; color:white; border-radius:10px; margin: 0; line-height: 1;" onclick="viewInvoiceItems('${t.invoiceId || -1}', '${t.type}')">📄 التفاصيل</button></div>`;

                    }

                } else {

                    const hoverTitle = `الصنف: ${t.product || '-'}\nالكمية: ${t.qty || 0}\nالسعر: ${t.price || 0}\nالإجمالي: ${t.total || 0}\nالمخزن: ${t.warehouse || '-'}`;

                    displayProduct = `<span title="${hoverTitle}" style="cursor:help; border-bottom:1px dotted #aaa;">${t.product || '-'} ${(!isFinancial && t.qty) ? '(x' + t.qty + ')' : ''}</span>`;

                }

                const totalTextFinal = (t.total || t.price || 0);

                let paid = (t.paid !== undefined) ? (typeof t.paid === 'number' ? t.paid.toFixed(2) : t.paid) : parseFloat(totalTextFinal || 0).toFixed(2);

                const remaining = (t.remaining !== undefined) ? (typeof t.remaining === 'number' ? t.remaining.toFixed(2) : t.remaining) : 0;

                // إذا كانت العملية تحويلاً مخزنياً، نفترض أنها مدفوعة بالكامل (عملية داخلية) حتى لا تظهر في مديونية الفواتير

                if (t.type.includes('تحويل')) {
                    paid = parseFloat(totalTextFinal || 0).toFixed(2);
                }

                const isV = (idx) => invoicesColumnVisibility[idx] !== false;

                rowsHtml += `
                    <tr class="${isSelected ? 'selected-row' : ''}" onclick="selectInvoiceRow(${t.originalIndex})" ondblclick="if(window.viewSelectedInvoice) window.viewSelectedInvoice();">
                        <td class="col-inv-0" style="${isV(0) ? '' : 'display:none;'}"><input type="radio" name="invRad" ${isSelected ? 'checked' : ''}></td>
                        <td class="col-inv-1" style="${isV(1) ? '' : 'display:none;'}">
                            <div style="display:flex; flex-direction:row; gap:4px; align-items:center; justify-content:center; flex-wrap:wrap;">
                                <span style="background:rgba(0,0,0,0.05); padding:2px 5px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${t.invoiceId || '-'} ${t.is_returned ? '<span title="تم الإرجاع" style="color:#ef4444; margin-right:2px;">↩️</span>' : ''}</span>
                                ${isSalesOrPurchase ? (() => {
                                    const m = (t.method || '').toLowerCase();
                                    const isCreditMethod = m.includes('آجل') || m.includes('اجل') || m.includes('ذمم') || m.includes('credit') || m.includes('تقسيط');
                                    let bText = 'مدفوع';
                                    let bClass = 'status-paid';
                                    if (isCreditMethod) {
                                        if (remaining <= 0) {
                                            bText = 'آجل (مسدد)';
                                            bClass = 'status-paid';
                                        } else if (paid > 0) {
                                            bText = 'آجل (جزئي)';
                                            bClass = 'status-partial';
                                        } else {
                                            bText = 'آجل';
                                            bClass = 'status-debt';
                                        }
                                    } else {
                                        if (remaining <= 0) {
                                            bText = 'مدفوع';
                                            bClass = 'status-paid';
                                        } else if (paid > 0) {
                                            bText = 'جزئي';
                                            bClass = 'status-partial';
                                        } else {
                                            bText = 'آجل';
                                            bClass = 'status-debt';
                                        }
                                    }
                                    return `<span class="${bClass}" style="padding: 1px 5px; font-size: 0.7rem; border-radius: 4px; font-weight: 800;">${bText}</span>`;
                                })() : ''}
                            </div>
                        </td>
                        <td class="col-inv-2" style="${isV(2) ? '' : 'display:none;'}">${t.date}</td>
                        <td class="col-inv-3" style="${isV(3) ? '' : 'display:none;'}">
                            ${(() => {
                                const type = t.type || '';
                                if (type.includes('مرتجع') && (type.includes('بيع') || type.includes('مبيعات'))) {
                                    return `<span class="stock-badge badge-return-sale" title="مرتجع مبيعات">↩️🛒 مرتجع بيع</span>`;
                                } else if (type.includes('مرتجع') && (type.includes('شراء') || type.includes('مشتريات'))) {
                                    return `<span class="stock-badge badge-return-purchase" title="مرتجع مشتريات">↩️📥 مرتجع شراء</span>`;
                                } else if (type.includes('بيع') || type.includes('مبيعات')) {
                                    return `<span class="stock-badge badge-sale" title="فاتورة مبيعات">🛒 فاتورة بيع</span>`;
                                } else if (type.includes('شراء') || type.includes('مشتريات')) {
                                    return `<span class="stock-badge badge-purchase" title="فاتورة مشتريات">📥 فاتورة شراء</span>`;
                                } else if (type.includes('قبض')) {
                                    return `<span class="stock-badge badge-receipt" title="سند قبض نقدية">💵 سند قبض</span>`;
                                } else if (type.includes('صرف')) {
                                    return `<span class="stock-badge badge-disburse" title="سند صرف نقدية">💸 سند صرف</span>`;
                                } else if (type.includes('تحويل')) {
                                    return `<span class="stock-badge badge-transfer" title="تحويل مخزني">🚚 تحويل مخزن</span>`;
                                } else if (type.includes('تسوية')) {
                                    return `<span class="stock-badge badge-adj" title="تسوية مخزنية">⚖️ تسوية مخزنية</span>`;
                                }
                                return `<span class="stock-badge" style="background:#f1f5f9; color:#475569;">${type}</span>`;
                            })()}
                        </td>
                        <td class="col-inv-4" style="font-weight:bold; ${isV(4) ? '' : 'display:none;'}">${displayProduct}</td>
                        <td class="col-inv-5" style="color:${profitColor}; font-weight:bold; ${isV(5) ? '' : 'display:none;'}">${profitText}</td>
                        <td class="col-inv-6" style="${isV(6) ? '' : 'display:none;'}">
                            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;">
                                <span style="font-weight:800; color:#1e293b; font-size:0.83rem;">🏢 ${warehouse}</span>
                                <span style="font-size:0.72rem; color:#64748b; background:rgba(0,0,0,0.04); padding:1px 6px; border-radius:4px; font-weight:700;">${t.terminal || 'الجهاز الرئيسي 💻'}</span>
                            </div>
                        </td>
                        <td class="col-inv-7" style="font-weight:bold; color:var(--main-blue); ${isV(7) ? '' : 'display:none;'}">${parseFloat(totalTextFinal || 0).toFixed(2)}</td>
                        <td class="col-inv-8" style="color:blue; font-weight:bold; ${isV(8) ? '' : 'display:none;'}">${paid}</td>
                        <td class="col-inv-9" style="color:red; font-weight:bold; ${isV(9) ? '' : 'display:none;'}">${remaining}</td>
                        <td class="col-inv-10" style="${isV(10) ? '' : 'display:none;'}">${t.partner || '-'}</td>
                        <td class="col-inv-13" style="${isV(13) ? '' : 'display:none;'}">${t.notes || '-'}</td>
                        <td class="col-inv-11" style="font-size:0.8rem; ${isV(11) ? '' : 'display:none;'}">${t.user || '-'}</td>
                        <td class="col-inv-12" style="font-size:0.8rem; color: #888; ${isV(12) ? '' : 'display:none;'}">${t.editDate || '-'}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = rowsHtml || '<tr><td colspan="13" style="text-align:center; padding:20px;">لا توجد بيانات تطابق البحث</td></tr>';
        }

        // دالة لعرض تفاصيل الفاتورة في تنبيه أو نافذة

        function viewInvoiceItems(invoiceId, type = '', autoPrint = false) {
            if (!checkPermission('docs_view')) return;
            
            // تحديد فئة المعاملة المطلوبة لتجنب خلط السندات والفواتير التي تحمل نفس المعرّف
            let category = '';
            if (type) {
                const typeClean = String(type);
                if (typeClean.includes('مرتجع بيع') || typeClean.includes('مرتجع مبيعات') || typeClean === 'sales-return' || typeClean === 'sale_return') category = 'return_sales';
                else if (typeClean.includes('مرتجع شراء') || typeClean.includes('مرتجع مشتريات') || typeClean === 'purchase-return' || typeClean === 'purchase_return') category = 'return_purchase';
                else if (typeClean.includes('بيع') || typeClean.includes('مبيعات')) category = 'sales';
                else if (typeClean.includes('شراء') || typeClean.includes('مشتريات')) category = 'purchase';
                else if (typeClean.includes('قبض')) category = 'receipt';
                else if (typeClean.includes('صرف')) category = 'disbursement';
                else if (typeClean.includes('تسوية')) category = 'adjustment';
                else if (typeClean.includes('تحويل')) category = 'transfer';
            }

            // فلترة الحركات التي تطابق رقم الفاتورة والنوع/الفئة بدقة بدون خلط مع معرفات الحركات الأخرى
            let invoiceItems = transactions.filter(t => {
                const hasInvId = t.invoiceId != null && t.invoiceId !== '';
                if (hasInvId) {
                    if (String(t.invoiceId) !== String(invoiceId)) return false;
                } else {
                    if (String(t.id) !== String(invoiceId)) return false;
                }
                if (category) {
                    const tType = String(t.type || '');
                    if (category === 'return_sales') return tType.includes('مرتجع بيع') || tType.includes('مرتجع مبيعات');
                    if (category === 'return_purchase') return tType.includes('مرتجع شراء') || tType.includes('مرتجع مشتريات');
                    if (category === 'sales') return (tType.includes('بيع') || tType.includes('مبيعات')) && !tType.includes('مرتجع');
                    if (category === 'purchase') return (tType.includes('شراء') || tType.includes('مشتريات')) && !tType.includes('مرتجع');
                    if (category === 'receipt') return tType.includes('قبض');
                    if (category === 'disbursement') return tType.includes('صرف');
                    if (category === 'adjustment') return tType.includes('تسوية');
                    if (category === 'transfer') return tType.includes('تحويل');
                }
                return true;
            });
            
            // إذا كانت الفاتورة تجارية، نستبعد حركات المقبوضات والمدفوعات الفردية المرتبطة بها من جدول الأصناف
            if (category === 'sales' || category === 'purchase' || category === 'return_sales' || category === 'return_purchase') {
                invoiceItems = invoiceItems.filter(t => t.type && !t.type.includes('قبض') && !t.type.includes('صرف'));
            }
            
            if (invoiceItems.length === 0) return alert('خطأ: لم يتم العثور على تفاصيل الفاتورة.');
            
            let head = invoiceItems.find(t => t.isInvoiceHead) || invoiceItems[0];
            let tx = { ...head };
            tx.invoiceId = invoiceId;
            tx.warehouse = head.warehouse || 'المخزن الرئيسي';
            tx.terminal = head.terminal || 'الجهاز الرئيسي 💻';
            tx.partner = head.partner || head.customer || 'عميل نقدي';
            tx.method = head.method || head.paymentMethod || 'نقدي';
            tx.notes = invoiceItems.find(t => t.notes)?.notes || tx.notes || '';
            
            // أخذ كافة العناصر التي تحتوي على أصناف فعلية واستبعاد أسطر الهيدر المالي الخالية من اسم الصنف
            let rawItems = invoiceItems.filter(i => {
                const pName = (i.product || i.productName || i.name || '').trim();
                // استبعاد السطر إذا لم يكن يحتوي على اسم صنف وكانت هناك أصناف أخرى حقيقية في الفاتورة
                if (!pName || pName === 'صنف غير محدد') {
                    const hasRealProducts = invoiceItems.some(x => (x.product || x.productName || x.name || '').trim());
                    if (hasRealProducts) return false;
                }
                return true;
            });

            // تم إلغاء دمج الأصناف المتشابهة لعرض الفاتورة بنفس عدد السطور الأصلية تماماً
            tx.items = rawItems.map(i => ({
                name: i.product || i.productName || i.name || 'صنف غير محدد',
                qty: parseFloat(i.qty || 0),
                unit: i.unit || '-',
                size: i.size || i.selectedSize || '',
                color: i.color || i.selectedColor || '',
                price: parseFloat(i.price || 0),
                total: parseFloat(i.total != null ? i.total : (parseFloat(i.qty || 0) * parseFloat(i.price || 0)))
            }));
            
            // سحب المدفوع والمتبقي من رأس الفاتورة بشكل صحيح وموثوق
            tx.paid = parseFloat(head.paidAmount != null ? head.paidAmount : (head.paid || 0));
            tx.deferred = parseFloat(head.deferred != null ? head.deferred : (head.remaining || 0));
            
            if (typeof window.renderCustomInvoiceModal === 'function') {
                window.renderCustomInvoiceModal(tx, autoPrint);
            } else {
                alert("جاري تحميل واجهة العرض...");
            }
        }
        window.updateEditPrice = function(input) {

            const row = input.closest('tr');

            const name = input.value.trim();

            const p = productsDB.find(x => x.name === name);

            if (p) {

                // جلب سعر المستهلك الافتراضي (أو السعر المسجل)

                row.querySelector('.edit-p-input').value = p.price || 0;

                window.calcEditRow(input); // إعادة حساب الإجماليات

            }

        };
        window.viewInvoiceItems = viewInvoiceItems;

        window.calcEditRow = function(input) {

            const row = input.closest('tr');

            const q = parseFloat(row.querySelector('.edit-q-input').value) || 0;

            const p = parseFloat(row.querySelector('.edit-p-input').value) || 0;

            const total = q * p;

            row.querySelector('.edit-t-cell').innerText = total.toFixed(2);

            // تحديث الإجمالي الكلي

            let grandTotal = 0;

            document.querySelectorAll('.edit-t-cell').forEach(cell => {

                grandTotal += parseFloat(cell.innerText) || 0;

            });

            document.getElementById('advEditGrandTotal').innerText = grandTotal.toFixed(2);

        };

        window.openAdvancedEditModal = async function(invId = null) {

            if (!checkPermission('docs_edit')) return;

            if (!invId) {

                 if (typeof selectedInvoiceIndex === 'undefined' || selectedInvoiceIndex === null) return showCustomAlert({ type: 'warning', titleText: '⚠️ تنبيه', msg: 'يرجى تحديد فاتورة أولاً.' });

                 invId = transactions[selectedInvoiceIndex].invoiceId;

            }

            if (!invId) return showToast("❌ لا يمكن تعديل هذه الحركة مباشرة", "error");

            const items = transactions.filter(t => t.invoiceId == invId);

            const isGoods = items.some(it => it.type.includes('بيع') || it.type.includes('شراء') || it.type.includes('تحويل') || it.type.includes('مرتجع'));

            const displayItems = isGoods ? items.filter(it => it.type.includes('بيع') || it.type.includes('شراء') || it.type.includes('تحويل') || it.type.includes('مرتجع')) : items;

            const head = displayItems[0] || items[0];

            let productOptions = '';

            if (typeof productsDB !== 'undefined') {

                productsDB.forEach(p => { productOptions += `<option value="${p.name}">`; });

            }

            let rowsHtml = '';

            displayItems.forEach((it, idx) => {

                rowsHtml += `

                <tr class="edit-row" data-id="${it.invoiceId}" data-product="${it.product}">

                    <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9;"><input type="text" class="edit-name-input" list="editItemsList" value="${it.product}" oninput="window.updateEditPrice(this)" style="width:100%; border:1px solid #ccc; padding:5px; border-radius:4px; font-weight:bold;"></td>

                    <td style="padding:10px; border:1px solid #ddd;"><input type="number" step="0.01" class="edit-q-input" value="${it.qty}" oninput="window.calcEditRow(this)" style="width:70px; border:1px solid #ccc; padding:5px; border-radius:4px;"></td>

                    <td style="padding:10px; border:1px solid #ddd;"><input type="number" step="0.01" class="edit-p-input" value="${it.price}" oninput="window.calcEditRow(this)" style="width:90px; border:1px solid #ccc; padding:5px; border-radius:4px;"></td>

                    <td style="padding:10px; border:1px solid #ddd; font-weight:bold; color:var(--main-blue);" class="edit-t-cell">${(parseFloat(it.total) || parseFloat(it.price) || 0).toFixed(2)}</td>

                </tr>`;

            });

            const isCash = (head.method && (head.method.includes('نقدي') || head.method.includes('كاش') || head.method.includes('نقدية')));

            const content = `

            <div style="direction:rtl; text-align:right;">

                <datalist id="editItemsList">${productOptions}</datalist>

                <div style="background:var(--main-purple); color:white; padding:15px; border-radius:10px 10px 0 0; margin:-20px -20px 20px -20px; display:flex; justify-content:space-between; align-items:center;">

                    <h3 style="margin:0;">⚙️ التعديل الشامل - ${isGoods ? 'فاتورة' : 'سند'} #${invId}</h3>

                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:20px; background:#f0f2f5; padding:15px; border-radius:10px;">

                    <div><label style="font-size:0.8rem;">👤 الطرف</label><input type="text" id="advEditPartner" value="${head.partner || ''}" class="search-input" style="width:100%;"></div>

                    <div><label style="font-size:0.8rem;">💳 طريقة الدفع</label><select id="advEditMethod" class="search-input" style="width:100%;"><option value="نقدي" ${isCash ? 'selected' : ''}>نقدي</option><option value="آجل" ${!isCash ? 'selected' : ''}>آجل</option></select></div>

                    <div><label style="font-size:0.8rem;">📅 التاريخ</label><input type="date" id="advEditDate" value="${head.dateISO || ''}" class="search-input" style="width:100%;"></div>

                    <div><label style="font-size:0.8rem;">⏰ الوقت</label><input type="time" id="advEditTime" value="${head.timeISO || ''}" class="search-input" style="width:100%;"></div>

                </div>

                <div style="max-height:300px; overflow-y:auto; border:2px solid #ddd; border-radius:8px; margin-bottom:20px;">

                    <table style="width:100%; border-collapse:collapse;">

                        <thead style="background:#34495e; color:white; position:sticky; top:0;"><tr><th style="padding:10px;">الصنف</th><th style="padding:10px;">الكمية</th><th style="padding:10px;">السعر</th><th style="padding:10px;">الإجمالي</th></tr></thead>

                        <tbody>${rowsHtml}</tbody>

                    </table>

                </div>

                <div style="background:#fff; border:2px solid var(--main-blue); padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">

                    <div style="font-weight:bold;">الإجمالي الجديد: <span id="advEditGrandTotal" style="color:var(--main-blue); font-size:1.5rem;">${displayItems.reduce((a,b)=>a+(parseFloat(b.total)||0),0).toFixed(2)}</span> ج.م</div>

                    <div style="display:flex; gap:10px;"><button onclick="closeCustomModal()" class="action-btn">إلغاء</button><button onclick="window.saveAdvancedInvoiceChanges('${invId}')" style="padding:10px 30px; background:var(--main-green); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">💾 حفظ التعديلات</button></div>

                </div>

            </div>`;

            showProfessionalModal(content);

        };

        window.saveAdvancedInvoiceChanges = async function(invId) {

            const rows = document.querySelectorAll('.edit-row');

            const newPartner = document.getElementById('advEditPartner').value;

            const newMethod = document.getElementById('advEditMethod').value;

            const oldItems = transactions.filter(t => t.invoiceId == invId);
            const origHead = oldItems.find(t => t.isInvoiceHead) || oldItems[0];
            const newDate = document.getElementById('advEditDate').value || (origHead ? (origHead.dateISO || origHead.date) : '');
            const newTime = document.getElementById('advEditTime').value || (origHead ? (origHead.timeISO || origHead.time) : '');

            // التحقق من صحة المنطق: عميل نقدي لا يمكنه عمل آجل

            if ((newPartner.includes('نقدي') || newPartner.includes('كاش')) && newMethod === 'آجل') {

                return showCustomAlert({ 

                    type: 'warning', 

                    titleText: '⚠️ خطأ في المنطق المحاسبي', 

                    msg: 'لا يمكن عمل فاتورة "آجل" لحساب "عميل نقدي". الحساب النقدي يجب أن يكون مدفوعاً بالكامل ولا يظهر في كشف الحساب كمديونية.' 

                });

            }

            const defaultWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';

            oldItems.forEach(item => {
                if (!item) return;
                const p = productsDB.find(x => x.name === item.product);
                if (p) {
                    let factor = parseFloat(item.unitFactor) || 1;
                    if (item.unit && p.units && Array.isArray(p.units)) {
                        const u = p.units.find(u => u && u.unitName === item.unit);
                        if (u) factor = parseFloat(u.factor) || 1;
                    }
                    const baseQty = (parseFloat(item.qty) || 0) * factor;
                    const activeWH = (item.warehouse || item.sourceWarehouse || (oldItems[0] && oldItems[0].warehouse) || defaultWH || 'المخزن الرئيسي').trim();

                    if (!p.warehouseStocks || typeof p.warehouseStocks !== 'object') p.warehouseStocks = {};

                    if (item.type.includes('مرتجع بيع')) {
                        p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                        p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                    } else if (item.type.includes('مرتجع شراء')) {
                        p.stock = (parseFloat(p.stock) || 0) + baseQty;
                        p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                    } else if (item.type.includes('بيع')) {
                        p.stock = (parseFloat(p.stock) || 0) + baseQty;
                        p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                    } else if (item.type.includes('شراء')) {
                        p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                        p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                    }

                    if (p.variants && Array.isArray(p.variants)) {
                        const sSize = String(item.size || '').trim();
                        const sColor = String(item.color || '').trim();
                        if (sSize || sColor) {
                            const matchedVar = p.variants.find(v => 
                                (!sSize || String(v.size || '').trim() === sSize) && 
                                (!sColor || String(v.color || '').trim() === sColor)
                            );
                            if (matchedVar) {
                                if (!matchedVar.warehouseStocks || typeof matchedVar.warehouseStocks !== 'object') matchedVar.warehouseStocks = {};
                                if (item.type.includes('مرتجع بيع')) {
                                    matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                    matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                } else if (item.type.includes('مرتجع شراء')) {
                                    matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                    matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                } else if (item.type.includes('بيع')) {
                                    matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                    matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                } else if (item.type.includes('شراء')) {
                                    matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                    matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                }
                            }
                        }
                    }
                }
            });

            // حساب الإجمالي الكلي أولاً لتعيينه في خانة المدفوع إذا كانت نقدية

            let totalOfInvoice = 0;

            rows.forEach(r => {

                const q = parseFloat(r.querySelector('.edit-q-input').value) || 0;

                const p = parseFloat(r.querySelector('.edit-p-input').value) || 0;

                totalOfInvoice += (q * p);

            });

            let firstRowHeaderProcessed = false;

            rows.forEach(row => {

                const originalProductName = row.dataset.product;

                const newProductName = row.querySelector('.edit-name-input').value.trim();

                const newQty = parseFloat(row.querySelector('.edit-q-input').value) || 0;

                const newPrice = parseFloat(row.querySelector('.edit-p-input').value) || 0;

                const newTotal = newQty * newPrice;

                // البحث عن السجل الأصلي لتعديله

                const transaction = transactions.find(t => t.invoiceId == invId && t.product === originalProductName);

                if (transaction) {

                    transaction.product = newProductName; // تحديث الاسم الجديد

                    transaction.partner = newPartner;

                    transaction.method = newMethod;

                    transaction.date = newDate;

                    transaction.dateISO = newDate;

                    transaction.timeISO = newTime;

                    transaction.qty = newQty;

                    transaction.price = newPrice;

                    transaction.total = newTotal.toFixed(2);

                    // تسجيل تاريخ التعديل واسم المستخدم الذي قام به

                    const editorName = currentUser ? currentUser.name : 'مجهول';

                    transaction.editDate = `${new Date().toLocaleString('ar-EG')} (بواسطة: ${editorName})`;

                    transaction.user = editorName; // تحديث المستخدم ليكون آخر من عدل الفاتورة

                    // حساب الربح الجديد بناءً على التكلفة

                    const p = productsDB.find(x => x.name === newProductName);

                    if (p) {

                        const cost = parseFloat(p.cost) || 0;

                        const factor = parseFloat(transaction.unitFactor) || 1;

                        const totalCost = cost * newQty * factor;

                        if (transaction.type.includes('بيع')) {

                            transaction.profit = (newTotal - totalCost).toFixed(2);

                        } else {

                            transaction.profit = 0; // المشتريات ليس لها ربح مباشر

                        }

                        // تحديث المخزن (خصم الكمية الجديدة) مع مراعاة المخزن والتشكيلة
                        const baseQty = newQty * factor;
                        const activeWH = (transaction.warehouse || transaction.sourceWarehouse || (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) || 'المخزن الرئيسي').trim();
                        if (!p.warehouseStocks || typeof p.warehouseStocks !== 'object') p.warehouseStocks = {};

                        if (transaction.type.includes('مرتجع بيع')) {
                            p.stock = (parseFloat(p.stock) || 0) + baseQty;
                            p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                        } else if (transaction.type.includes('مرتجع شراء')) {
                            p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                            p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                        } else if (transaction.type.includes('بيع')) {
                            p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                            p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                        } else if (transaction.type.includes('شراء')) {
                            p.stock = (parseFloat(p.stock) || 0) + baseQty;
                            p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                        }

                        // تحديث رصيد المقاس واللون إن وجد
                        if (p.variants && Array.isArray(p.variants)) {
                            const sSize = String(transaction.selectedSize || transaction.size || '').trim();
                            const sColor = String(transaction.selectedColor || transaction.color || '').trim();
                            if (sSize || sColor) {
                                const matchedVar = p.variants.find(v => 
                                    (!sSize || String(v.size || '').trim() === sSize) && 
                                    (!sColor || String(v.color || '').trim() === sColor)
                                );
                                if (matchedVar) {
                                    if (!matchedVar.warehouseStocks || typeof matchedVar.warehouseStocks !== 'object') matchedVar.warehouseStocks = {};
                                    if (transaction.type.includes('مرتجع بيع')) {
                                        matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                        matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                    } else if (transaction.type.includes('مرتجع شراء')) {
                                        matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                        matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                    } else if (transaction.type.includes('بيع')) {
                                        matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                        matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                    } else if (transaction.type.includes('شراء')) {
                                        matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                        matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                    }
                                }
                            }
                        }

                    }

                    if (!firstRowHeaderProcessed) {

                        transaction.isInvoiceHead = true;

                        // تصحيح: المدفوع هو إجمالي الفاتورة كلها لو نقدي، أو 0 لو آجل

                        const isCash = (newMethod.includes('نقدي') || newMethod.includes('نقدية') || newMethod.includes('كاش'));

                        transaction.paidAmount = (isCash ? totalOfInvoice : 0);

                        firstRowHeaderProcessed = true;

                    } else transaction.isInvoiceHead = false;

                }

            });

            await saveData();

            closeCustomModal();

            renderInvoicesTable();

            showToast("✅ تم تحديث الفاتورة والمخازن بنجاح", "success");

        };

        // ================= وظيفة التعديل الشامل للعمليات (Edit System) =================

        window.editTransaction = async function(invId, type) {
            if (!checkPermission('docs_edit')) return;

            const settings = JSON.parse(getStore('pos_settings') || '{}');
            // التعديل مسموح به مالم يتم تعطيله صراحة
            const canEditHistory = settings.allowHistoryEdit !== false;
            if (!canEditHistory) {
                showToast("🚫 صلاحية تعديل السجل غير مفعلة من الإعدادات", "error");
                return;
            }

            // البحث عن الفاتورة باستخدام الرقم والنوع لضمان الدقة المطلقة
            const typeClean = String(type || '').trim();
            const typeRegex = new RegExp(typeClean, 'i');

            const t = transactions.find(tx => (String(tx.invoiceId) === String(invId) || String(tx.id) === String(invId)) && typeRegex.test(tx.type || ''));

            if (!t) {
                showToast(`⚠️ لم يتم العثور على الفاتورة #${invId}`, "error");
                return;
            }

            showCustomAlert({

                type: 'question',

                titleText: '⚠️ تعديل عملية',

                msg: `هل أنت متأكد من فتح العملية رقم #${invId} للتعديل؟\nسيتم تحميل كافة البيانات في القسم المختص.`,

                showCancel: true,

                confirmText: 'نعم، ابدأ التعديل',

                onConfirm: async () => {

                    // جلب كافة بنود الفاتورة بالكامل بدقة برقم الفاتورة فقط لمنع ظهور أي صنف غريب
                    const invItems = transactions.filter(x => {
                        const hasInvId = x.invoiceId != null && x.invoiceId !== '';
                        if (hasInvId) {
                            if (String(x.invoiceId) !== String(invId)) return false;
                        } else {
                            if (String(x.id) !== String(invId)) return false;
                        }
                        return typeRegex.test(x.type || '');
                    });
                    const head = invItems.find(x => x.isInvoiceHead) || invItems[0] || t;

                    // استخراج أدق البيانات الأصلية للفاتورة
                    const partnerName = head.partner || head.customer || head.supplier || head.account || t.partner || '';
                    const paymentMethod = String(head.method || head.paymentMethod || t.method || t.paymentMethod || 'نقدي').trim();
                    const paidValue = head.paidAmount !== undefined ? parseFloat(head.paidAmount) : (head.paid !== undefined ? parseFloat(head.paid) : (t.paidAmount !== undefined ? parseFloat(t.paidAmount) : 0));
                    const discountVal = head.invoiceDiscount !== undefined ? parseFloat(head.invoiceDiscount) : (head.discount !== undefined ? parseFloat(head.discount) : 0);
                    const discountTypeVal = head.invoiceDiscountType || head.discountType || 'val';
                    const taxVal = head.invoiceTax !== undefined ? parseFloat(head.invoiceTax) : (head.tax !== undefined ? parseFloat(head.tax) : 0);
                    const taxTypeVal = head.invoiceTaxType || head.taxType || 'val';
                    const notesVal = head.notes || t.notes || '';

                    // 1. تفعيل وضع التعديل (Edit Mode) عالمياً
                    isEditMode = true;
                    editingInvoiceId = invId;

                    let timeVal = head.timeISO || t.timeISO || '';
                    let dateVal = head.dateISO || t.dateISO || '';
                    if (!timeVal && t.date) {
                        if (t.date.includes('،')) {
                            const dateParts = t.date.split('،');
                            if (dateParts[1]) {
                                timeVal = dateParts[1].trim().substring(0, 5)
                                    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
                            }
                        } else if (t.date.includes(' ')) {
                            const dateParts = t.date.split(' ');
                            const lastPart = dateParts[dateParts.length - 1];
                            if (lastPart && lastPart.includes(':')) {
                                timeVal = lastPart.trim().substring(0, 5);
                            }
                        }
                    }
                    editingOriginalDate = { full: t.date, iso: dateVal, time: timeVal };
                    editingInvoiceType = t.type;
                    window.editingOriginalPartner = partnerName;
                    window.editingOriginalMethod = paymentMethod;
                    window.editingOriginalUser = t.user || '';
                    editingOriginalItems = JSON.parse(JSON.stringify(invItems)); // نسخة أصلية للعكس والمطابقة

                    // 2. فتح القسم أولاً لضمان وجود تبويب نشط
                    const mainType = t.type || '';
                    let section = 'sales';
                    let tabSection = 'sales';

                    if (mainType.includes('شراء') && !mainType.includes('مرتجع')) {
                        section = 'purchase';
                        tabSection = 'purchase';
                    } else if (mainType.includes('مرتجع بيع')) {
                        section = 'sales-return';
                        tabSection = 'sales-return';
                    } else if (mainType.includes('مرتجع شراء')) {
                        section = 'purchase-return';
                        tabSection = 'purchase-return';
                    } else if (mainType.includes('قبض')) {
                        section = 'receipt';
                        tabSection = 'receipt';
                    } else if (mainType.includes('صرف')) {
                        section = 'disbursement';
                        tabSection = 'disbursement';
                    } else if (mainType.includes('تسوية')) {
                        section = 'adjustment';
                        tabSection = 'adjustment';
                    } else if (mainType.includes('تحويل')) {
                        section = 'transfer';
                        tabSection = 'inventory';
                    }

                    switchSection(tabSection);

                    // 3. حقن وتثبيت البيانات في القسم النشط
                    setTimeout(() => {

                        if (section === 'sales') {

                            cart = invItems.filter(x => x.product).map(it => {
                                const p = productsDB.find(x => x.name === it.product);
                                const u = (p && p.units) ? p.units.find(un => un.unitName === it.unit) : null;
                                return {
                                    id: p ? p.id : (Date.now() + Math.random()),
                                    code: it.code || (p ? p.code : ''),
                                    name: it.product,
                                    qty: parseFloat(it.qty || 1),
                                    price: parseFloat(it.price || 0),
                                    unit: it.unit || 'قطعة',
                                    unitFactor: parseFloat(it.unitFactor) || (u ? (parseFloat(u.factor) || 1) : 1),
                                    selectedUnit: u,
                                    selectedSize: it.selectedSize || it.size || '',
                                    selectedColor: it.selectedColor || it.color || '',
                                    units: p ? (p.units || []) : []
                                };
                            });

                            // تثبيت اسم العميل والتاريخ والوقت
                            const custInp = document.getElementById('customerName');
                            if (custInp) custInp.value = partnerName;
                            if (document.getElementById('salesDate')) document.getElementById('salesDate').value = dateVal;
                            if (document.getElementById('salesTime')) document.getElementById('salesTime').value = timeVal;
                            if (document.getElementById('salesBadgeID')) document.getElementById('salesBadgeID').innerText = invId;

                            // 1. استرجاع وتثبيت طريقة الدفع الأصلية الحقيقية (آجل / كاش / بنك)
                            if (typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
                            const methodSelect = document.getElementById('sales-sectionPaymentMethodSelect') || document.getElementById('salesPaymentMethodSelect');
                            if (methodSelect) {
                                if (methodSelect.options.length === 0 && typeof populatePaymentMethodSelects === 'function') {
                                    populatePaymentMethodSelects();
                                }
                                let matchedOpt = Array.from(methodSelect.options).find(o => o.value === paymentMethod || o.text.trim() === paymentMethod);
                                if (!matchedOpt) {
                                    if (paymentMethod.includes('آجل') || paymentMethod.includes('اجل')) {
                                        matchedOpt = Array.from(methodSelect.options).find(o => o.value.includes('آجل') || o.value.includes('اجل'));
                                    } else if (paymentMethod.includes('تحويل') || paymentMethod.includes('بنك') || paymentMethod.includes('شيك') || paymentMethod.includes('فيزا') || paymentMethod.includes('شبكة')) {
                                        matchedOpt = Array.from(methodSelect.options).find(o => o.value.includes('تحويل') || o.value.includes('بنك') || o.value.includes('شيك'));
                                    } else {
                                        matchedOpt = Array.from(methodSelect.options).find(o => o.value.includes('نقدي') || o.value.includes('كاش'));
                                    }
                                }
                                if (matchedOpt) {
                                    methodSelect.value = matchedOpt.value;
                                }
                                if (typeof selectMethod === 'function') selectMethod(methodSelect);
                            }
                            selectedMethod = methodSelect ? methodSelect.value : paymentMethod;
                            window.selectedMethod = selectedMethod;

                            // 2. استرجاع الخصم والضريبة
                            const discInput = document.getElementById('discountInput') || document.getElementById('salesDiscountInput');
                            let totalDiscount = discountVal;
                            if (totalDiscount === 0) {
                                const cartBaseTotal = invItems.reduce((acc, it) => acc + (parseFloat(it.qty || 0) * parseFloat(it.price || 0)), 0);
                                const cartNetTotal = invItems.reduce((acc, it) => acc + parseFloat(it.total || 0), 0);
                                if (cartBaseTotal > cartNetTotal) {
                                    totalDiscount = cartBaseTotal - cartNetTotal;
                                } else {
                                    totalDiscount = invItems.reduce((acc, it) => acc + parseFloat(it.discount || 0), 0);
                                }
                            }
                            if (discInput) discInput.value = totalDiscount > 0 ? totalDiscount : 0;
                            if (document.getElementById('discountType')) document.getElementById('discountType').value = discountTypeVal;

                            const taxInp = document.getElementById('taxInput') || document.getElementById('salesTaxInput');
                            if (taxInp) taxInp.value = taxVal > 0 ? taxVal : 0;
                            if (document.getElementById('taxType')) document.getElementById('taxType').value = taxTypeVal;

                            // 3. استرجاع المدفوع والملاحظات
                            const tendInp = document.getElementById('tenderedAmount');
                            if (tendInp) tendInp.value = paidValue;
                            if (document.getElementById('salesNotes')) document.getElementById('salesNotes').value = notesVal;

                            // 4. تحديث معلومات العميل والبطاقات وحساب الإجماليات
                            if (typeof updateHeaderPartnerInfo === 'function') {
                                updateHeaderPartnerInfo();
                            }
                            if (typeof updateActiveTabTitle === 'function') {
                                updateActiveTabTitle(partnerName ? `تعديل #${invId} (${partnerName})` : `تعديل #${invId}`, 'بيع');
                            }

                            renderCart();
                            if (typeof calculateTotals === 'function') calculateTotals();
                            if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

                        } else if (section === 'purchase') {

                            purchaseCart = invItems.filter(x => x.product).map(it => {
                                const p = productsDB.find(x => x.name === it.product);
                                const u = (p && p.units) ? p.units.find(un => un.unitName === it.unit) : null;
                                const defaultSale = u ? (parseFloat(u.price) || 0) : (p ? (parseFloat(p.price) || 0) : 0);
                                const defaultWholesale = u ? (parseFloat(u.wholesale) || 0) : (p ? (parseFloat(p.wholesale) || 0) : 0);
                                return {
                                    id: p ? p.id : (Date.now() + Math.random()),
                                    code: it.code || (p ? p.code : ''),
                                    name: it.product,
                                    selectedSize: it.selectedSize || it.size || '',
                                    selectedColor: it.selectedColor || it.color || '',
                                    size: it.selectedSize || it.size || '',
                                    color: it.selectedColor || it.color || '',
                                    qty: parseFloat(it.qty || 1),
                                    price: parseFloat(it.price || 0),
                                    salePrice: parseFloat(it.salePrice) > 0 ? parseFloat(it.salePrice) : defaultSale,
                                    wholesalePrice: parseFloat(it.wholesalePrice) > 0 ? parseFloat(it.wholesalePrice) : defaultWholesale,
                                    unit: it.unit || 'قطعة',
                                    unitFactor: parseFloat(it.unitFactor) || (u ? (parseFloat(u.factor) || 1) : 1),
                                    selectedUnit: u,
                                    units: p ? (p.units || []) : []
                                };
                            });

                            const suppInp = document.getElementById('supplierName');
                            if (suppInp) suppInp.value = partnerName;
                            if (document.getElementById('purchaseDate')) document.getElementById('purchaseDate').value = dateVal;
                            if (document.getElementById('purchaseTime')) document.getElementById('purchaseTime').value = timeVal;
                            if (document.getElementById('purchaseBadgeID')) document.getElementById('purchaseBadgeID').innerText = invId;

                            // 1. استرجاع طريقة الدفع للشراء
                            if (typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
                            const purMethodSelect = document.getElementById('purchase-sectionPaymentMethodSelect') || document.getElementById('purchasePaymentMethodSelect');
                            if (purMethodSelect) {
                                if (purMethodSelect.options.length === 0 && typeof populatePaymentMethodSelects === 'function') {
                                    populatePaymentMethodSelects();
                                }
                                let matchedOpt = Array.from(purMethodSelect.options).find(o => o.value === paymentMethod || o.text.trim() === paymentMethod);
                                if (!matchedOpt) {
                                    if (paymentMethod.includes('آجل') || paymentMethod.includes('اجل')) {
                                        matchedOpt = Array.from(purMethodSelect.options).find(o => o.value.includes('آجل') || o.value.includes('اجل'));
                                    } else if (paymentMethod.includes('شيك') || paymentMethod.includes('تحويل') || paymentMethod.includes('بنك')) {
                                        matchedOpt = Array.from(purMethodSelect.options).find(o => o.value.includes('شيك') || o.value.includes('تحويل') || o.value.includes('بنك'));
                                    } else {
                                        matchedOpt = Array.from(purMethodSelect.options).find(o => o.value.includes('نقدي') || o.value.includes('كاش'));
                                    }
                                }
                                if (matchedOpt) {
                                    purMethodSelect.value = matchedOpt.value;
                                }
                                if (typeof selectMethod === 'function') selectMethod(purMethodSelect);
                            }

                            // 2. الخصم والضريبة والمدفوع
                            const purDiscInput = document.getElementById('purchaseDiscount');
                            if (purDiscInput) purDiscInput.value = discountVal > 0 ? discountVal : 0;
                            if (document.getElementById('purchaseDiscountType')) document.getElementById('purchaseDiscountType').value = discountTypeVal;

                            const purTaxInput = document.getElementById('purchaseTax');
                            if (purTaxInput) purTaxInput.value = taxVal > 0 ? taxVal : 0;
                            if (document.getElementById('purchaseTaxType')) document.getElementById('purchaseTaxType').value = taxTypeVal;

                            if (document.getElementById('purchasePaid')) document.getElementById('purchasePaid').value = paidValue;
                            if (document.getElementById('purchaseNotes')) document.getElementById('purchaseNotes').value = notesVal;

                            if (typeof updatePurchaseHeaderPartnerInfo === 'function') {
                                updatePurchaseHeaderPartnerInfo();
                            }
                            if (typeof updateActiveTabTitle === 'function') {
                                updateActiveTabTitle(partnerName ? `تعديل مشتريات #${invId} (${partnerName})` : `تعديل مشتريات #${invId}`, 'شراء');
                            }

                            renderPurchaseCart_Finalized_V3();
                            if (typeof calculatePurchaseTotals === 'function') calculatePurchaseTotals();
                            if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

                        } else if (section === 'sales-return') {

                            returnCart = invItems.filter(x => x.product).map(it => {
                                const p = productsDB.find(x => x.name === it.product);
                                const u = (p && p.units) ? p.units.find(un => un.unitName === it.unit) : null;
                                return {
                                    name: it.product,
                                    selectedSize: it.selectedSize || it.size || '',
                                    selectedColor: it.selectedColor || it.color || '',
                                    size: it.selectedSize || it.size || '',
                                    color: it.selectedColor || it.color || '',
                                    qty: parseFloat(it.qty || 1),
                                    price: parseFloat(it.price || 0),
                                    unit: it.unit || 'قطعة',
                                    unitFactor: parseFloat(it.unitFactor) || 1,
                                    selectedUnit: u,
                                    units: p ? (p.units || []) : []
                                };
                            });

                            if (document.getElementById('salesReturnPartnerDisplay')) document.getElementById('salesReturnPartnerDisplay').innerText = partnerName || '---';
                            if (document.getElementById('salesReturnAccountInput')) document.getElementById('salesReturnAccountInput').value = partnerName || '';
                            if (document.getElementById('salesReturnInvoiceDisplay')) document.getElementById('salesReturnInvoiceDisplay').innerText = t.originalInvoiceId || t.invoiceId || invId;
                            if (document.getElementById('salesReturnDate')) document.getElementById('salesReturnDate').value = dateVal;
                            if (document.getElementById('salesReturnTime')) document.getElementById('salesReturnTime').value = timeVal;
                            if (document.getElementById('salesReturnBadgeID')) document.getElementById('salesReturnBadgeID').innerText = invId;

                            const returnMethodSelect = document.getElementById('sales-return-sectionPaymentMethodSelect') || document.getElementById('salesReturnPaymentMethodSelect');
                            if (returnMethodSelect) {
                                if (returnMethodSelect.options.length === 0 && typeof populatePaymentMethodSelects === 'function') {
                                    populatePaymentMethodSelects();
                                }
                                let matchedOpt = Array.from(returnMethodSelect.options).find(o => o.value === paymentMethod || o.text.trim() === paymentMethod);
                                if (matchedOpt) returnMethodSelect.value = matchedOpt.value;
                                if (typeof selectMethod === 'function') selectMethod(returnMethodSelect);
                            }

                            renderReturnCart();
                            if (typeof calculateReturnTotals === 'function') calculateReturnTotals();
                            if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

                        } else if (section === 'purchase-return') {

                            purReturnCart = invItems.filter(x => x.product).map(it => {
                                const p = productsDB.find(x => x.name === it.product);
                                const u = (p && p.units) ? p.units.find(un => un.unitName === it.unit) : null;
                                return {
                                    name: it.product,
                                    selectedSize: it.selectedSize || it.size || '',
                                    selectedColor: it.selectedColor || it.color || '',
                                    size: it.selectedSize || it.size || '',
                                    color: it.selectedColor || it.color || '',
                                    qty: parseFloat(it.qty || 1),
                                    price: parseFloat(it.price || 0),
                                    unit: it.unit || 'قطعة',
                                    unitFactor: parseFloat(it.unitFactor) || 1,
                                    selectedUnit: u,
                                    units: p ? (p.units || []) : []
                                };
                            });

                            if (document.getElementById('purReturnPartnerDisplay')) document.getElementById('purReturnPartnerDisplay').innerText = partnerName || '---';
                            if (document.getElementById('purReturnAccountInput')) document.getElementById('purReturnAccountInput').value = partnerName || '';
                            if (document.getElementById('purReturnInvoiceDisplay')) document.getElementById('purReturnInvoiceDisplay').innerText = t.originalInvoiceId || t.invoiceId || invId;
                            if (document.getElementById('purReturnDate')) document.getElementById('purReturnDate').value = dateVal;
                            if (document.getElementById('purReturnTime')) document.getElementById('purReturnTime').value = timeVal;
                            if (document.getElementById('purReturnBadgeID')) document.getElementById('purReturnBadgeID').innerText = invId;

                            const purReturnMethodSelect = document.getElementById('purchase-return-sectionPaymentMethodSelect') || document.getElementById('purReturnPaymentMethodSelect');
                            if (purReturnMethodSelect) {
                                if (purReturnMethodSelect.options.length === 0 && typeof populatePaymentMethodSelects === 'function') {
                                    populatePaymentMethodSelects();
                                }
                                let matchedOpt = Array.from(purReturnMethodSelect.options).find(o => o.value === paymentMethod || o.text.trim() === paymentMethod);
                                if (matchedOpt) purReturnMethodSelect.value = matchedOpt.value;
                                if (typeof selectMethod === 'function') selectMethod(purReturnMethodSelect);
                            }

                            renderPurReturnCart();
                            if (typeof calculatePurReturnTotals === 'function') calculatePurReturnTotals();
                            if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

                        } else if (section === 'transfer') {

                            transferItemsBatch = invItems.filter(x => x.product).map(it => {
                                const p = productsDB.find(x => x.name === it.product || x.id === it.productId);
                                return {
                                    id: p ? p.id : (Date.now() + Math.random()),
                                    name: it.product,
                                    selectedSize: it.selectedSize || it.size || '',
                                    selectedColor: it.selectedColor || it.color || '',
                                    size: it.selectedSize || it.size || '',
                                    color: it.selectedColor || it.color || '',
                                    stock: p ? p.stock : 0,
                                    qty: parseFloat(it.qty),
                                    price: parseFloat(it.price),
                                    unit: it.unit || 'قطعة',
                                    unitFactor: parseFloat(it.unitFactor) || 1
                                };
                            });

                            const parts = (partnerName || '').split('->');
                            const wFrom = parts[0]?.trim();
                            const wTo = parts[1]?.trim();

                            openTransferModal(true); 

                            const applyValues = () => {
                                if (wFrom) document.getElementById('transferFrom').value = wFrom;
                                updateTransferToList(); 
                                if (wTo) document.getElementById('transferTo').value = wTo;
                                renderTransferTable();
                            };

                            applyValues();
                            setTimeout(applyValues, 250);

                        } else if (section === 'receipt') {

                            const payerName = partnerName;
                            if (document.getElementById('receiptCustomer')) document.getElementById('receiptCustomer').value = payerName;
                            if (document.getElementById('receiptAmount')) document.getElementById('receiptAmount').value = parseFloat(head.total || head.price || head.paidAmount || 0);
                            if (document.getElementById('receiptDate')) document.getElementById('receiptDate').value = dateVal;
                            if (document.getElementById('receiptTime')) document.getElementById('receiptTime').value = timeVal;
                            if (document.getElementById('receiptNotes')) document.getElementById('receiptNotes').value = head.product || head.notes || '';
                            if (document.getElementById('receiptID')) document.getElementById('receiptID').value = invId;

                            const rMethodSelect = document.getElementById('receiptMethodSelect') || document.getElementById('receiptPaymentMethod');
                            if (rMethodSelect) rMethodSelect.value = paymentMethod || 'نقدية';

                            if (payerName && typeof getAccountBalance === 'function') {
                                const bal = getAccountBalance(payerName);
                                const formattedBal = (bal < 0 ? '-' : '') + Math.abs(bal).toLocaleString('en-US', { minimumFractionDigits: 2 });
                                const balEl = document.getElementById('receiptAccountBalance');
                                if (balEl) balEl.innerText = formattedBal;
                            }

                            const clearBtn = document.getElementById('receiptCustomerClear');
                            if (clearBtn && payerName) clearBtn.style.display = 'block';
                            if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

                        } else if (section === 'disbursement') {

                            const payeeName = partnerName;
                            if (document.getElementById('disbursePayee')) document.getElementById('disbursePayee').value = payeeName;
                            if (document.getElementById('disburseAmount')) document.getElementById('disburseAmount').value = parseFloat(head.total || head.price || head.paidAmount || 0);
                            if (document.getElementById('disburseDate')) document.getElementById('disburseDate').value = dateVal;
                            if (document.getElementById('disburseTime')) document.getElementById('disburseTime').value = timeVal;
                            if (document.getElementById('disburseNotes')) document.getElementById('disburseNotes').value = head.product || head.notes || '';
                            if (document.getElementById('disburseID')) document.getElementById('disburseID').value = invId;

                            const dMethodSelect = document.getElementById('disburseMethodSelect') || document.getElementById('disbursePaymentMethod');
                            if (dMethodSelect) dMethodSelect.value = paymentMethod || 'نقدية';

                            if (payeeName && typeof getAccountBalance === 'function') {
                                const bal = getAccountBalance(payeeName);
                                const formattedBal = (bal < 0 ? '-' : '') + Math.abs(bal).toLocaleString('en-US', { minimumFractionDigits: 2 });
                                const balEl = document.getElementById('disburseAccountBalance');
                                if (balEl) balEl.innerText = formattedBal;
                            }

                            const clearBtn = document.getElementById('disbursePayeeClear');
                            if (clearBtn && payeeName) clearBtn.style.display = 'block';
                            if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

                        } else if (section === 'adjustment') {

                            const activeWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';
                            adjCart = invItems.filter(x => x.product).map(it => {
                                const p = productsDB.find(x => x.name === it.product || x.id === it.productId);
                                const u = (p && p.units) ? p.units.find(un => un.unitName === it.unit) : null;
                                const factor = parseFloat(it.unitFactor) || 1;
                                const baseAdjQty = (parseFloat(it.qty) || 0) * factor;

                                let liveStock = 0;
                                if (p) {
                                    if (p.variants && Array.isArray(p.variants)) {
                                        const sSize = it.selectedSize || it.size || '';
                                        const sColor = it.selectedColor || it.color || '';
                                        const matchedVar = p.variants.find(v => (!sSize || v.size === sSize) && (!sColor || v.color === sColor));
                                        if (matchedVar) {
                                            liveStock = (matchedVar.warehouseStocks && matchedVar.warehouseStocks[activeWH] !== undefined)
                                                ? (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0)
                                                : (parseFloat(matchedVar.stock) || 0);
                                        } else {
                                            liveStock = typeof getWarehouseStock === 'function' ? getWarehouseStock(p.name, activeWH) : (parseFloat(p.stock) || 0);
                                        }
                                    } else {
                                        liveStock = typeof getWarehouseStock === 'function' ? getWarehouseStock(p.name, activeWH) : (parseFloat(p.stock) || 0);
                                    }
                                }

                                // الرصيد قبل التسوية = الرصيد الحالي ناقص كمية الفاتورة التي تم تطبيقها سابقاً
                                const origStockBefore = (liveStock - baseAdjQty) / factor;

                                return {
                                    id: p ? p.id : (Date.now() + Math.random()),
                                    name: it.product,
                                    selectedSize: it.selectedSize || it.size || '',
                                    selectedColor: it.selectedColor || it.color || '',
                                    size: it.selectedSize || it.size || '',
                                    color: it.selectedColor || it.color || '',
                                    qty: parseFloat(it.qty),
                                    price: parseFloat(it.price),
                                    unit: it.unit,
                                    unitFactor: factor,
                                    selectedUnit: u,
                                    units: p ? (p.units || []) : [],
                                    stock: origStockBefore
                                };
                            });

                               if (document.getElementById('adjBadgeID')) document.getElementById('adjBadgeID').innerText = invId;
                            document.getElementById('adjDate').value = t.dateISO || '';
                            document.getElementById('adjTime').value = t.timeISO || '';

                            if (typeof renderAdjTable === 'function') renderAdjTable();

                        }

                        // تأكيد متغيرات وضع التعديل عالمياً داخل التبويب
                        isEditMode = true;
                        window.isEditMode = true;
                        editingInvoiceId = invId;
                        window.editingInvoiceId = invId;
                        editingInvoiceType = t.type;
                        window.editingInvoiceType = t.type;
                        editingOriginalItems = JSON.parse(JSON.stringify(invItems));
                        window.editingOriginalItems = editingOriginalItems;

                        // حفظ الحالة في التبويب فوراً لمنع المسح
                        if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

                        showToast(`🛠️ وضع التعديل: فاتورة #${invId}`, "info");

                        // تمييز زر الحفظ
                        const activeView = document.getElementById(section + '-section');
                        if (activeView) {
                            const saveBtn = activeView.querySelector('.btn-save') || activeView.querySelector('.acc-action-btn[onclick*="save"]');
                            if (saveBtn) {
                                saveBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                                saveBtn.innerText = '💾 حفظ التعديلات (F9)';
                            }
                        }

                    }, 200); // تأخير بسيط لضمان انتهاء دالة switchSection
                }
            });
        };

        // دالة مساعدة لتنفيذ منطق الحذف في التعديل (تحتاج لاستدعاء من الحفظ)
        window.revertAndClearOldInvoice = async function(invId, type) {
            if (!invId) return;

            const cleanType = type ? String(type).replace(/📤|📥|↩️|⚖️/g, '').trim() : '';

            // إذا لم تكن editingOriginalItems محملة، نحاول جلب السجلات القديمة من transactions
            const oldItems = (typeof editingOriginalItems !== 'undefined' && editingOriginalItems && editingOriginalItems.length > 0) ? 
                editingOriginalItems : 
                (typeof transactions !== 'undefined' && Array.isArray(transactions) ? transactions.filter(t => {
                    const hasInvId = t.invoiceId != null && t.invoiceId !== '';
                    if (hasInvId) return String(t.invoiceId) === String(invId);
                    return String(t.id) === String(invId);
                }) : []);

            const defaultWH = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';

            // 1. عكس المخزن
            oldItems.forEach(item => {
                if (!item || typeof productsDB === 'undefined' || !Array.isArray(productsDB)) return;

                const p = productsDB.find(p => p && (p.name === item.product || p.id === item.productId || p.id === item.product));
                if (p) {
                    let factor = parseFloat(item.unitFactor) || 1;
                    if (item.unit && p.units && Array.isArray(p.units)) {
                        const u = p.units.find(u => u && u.unitName === item.unit);
                        if (u) factor = parseFloat(u.factor) || 1;
                    }

                    const baseQty = (parseFloat(item.qty) || 0) * factor;
                    const activeWH = (item.warehouse || item.sourceWarehouse || (oldItems[0]?.warehouse) || defaultWH || 'المخزن الرئيسي').trim();
                    if (!p.warehouseStocks || typeof p.warehouseStocks !== 'object') p.warehouseStocks = {};

                    const itType = String(item.type || cleanType || '');
                    if (itType.includes('مرتجع بيع')) {
                        p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                        p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                    } else if (itType.includes('مرتجع شراء')) {
                        p.stock = (parseFloat(p.stock) || 0) + baseQty;
                        p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                    } else if (itType.includes('بيع')) {
                        p.stock = (parseFloat(p.stock) || 0) + baseQty;
                        p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                    } else if (itType.includes('شراء')) {
                        p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                        p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                        if (item.previousCost !== undefined && item.previousCost !== null && !isNaN(parseFloat(item.previousCost))) {
                            p.cost = parseFloat(item.previousCost);
                        }
                    } else if (itType.includes('تسوية') || itType.includes('جرد') || itType.includes('adj')) {
                        p.stock = (parseFloat(p.stock) || 0) - baseQty;
                        p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty;
                    } else if (itType.includes('تحويل')) {
                        const srcWH = (item.sourceWarehouse || defaultWH || 'المخزن الرئيسي').trim();
                        const dstWH = (item.warehouse || '').trim();
                        p.warehouseStocks[srcWH] = (parseFloat(p.warehouseStocks[srcWH]) || 0) + baseQty;
                        if (dstWH) {
                            p.warehouseStocks[dstWH] = Math.max(0, (parseFloat(p.warehouseStocks[dstWH]) || 0) - baseQty);
                        }
                    }

                    // عكس رصيد التشكيلة (المقاس واللون) في مصفوفة الصنف بدقة
                    if (p.variants && Array.isArray(p.variants)) {
                        const sSize = String(item.selectedSize || item.size || '').trim();
                        const sColor = String(item.selectedColor || item.color || '').trim();
                        if (sSize || sColor) {
                            const matchedVar = p.variants.find(v => 
                                (!sSize || String(v.size || '').trim() === sSize) && 
                                (!sColor || String(v.color || '').trim() === sColor)
                            );
                            if (matchedVar) {
                                if (!matchedVar.warehouseStocks || typeof matchedVar.warehouseStocks !== 'object') matchedVar.warehouseStocks = {};
                                if (item.type && item.type.includes('مرتجع بيع')) {
                                    matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                    matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                } else if (item.type && item.type.includes('مرتجع شراء')) {
                                    matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                    matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                } else if (item.type && item.type.includes('بيع')) {
                                    matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                    matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                } else if (item.type && item.type.includes('شراء')) {
                                    matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                    matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                } else if (item.type && item.type.includes('تسوية')) {
                                    matchedVar.stock = (parseFloat(matchedVar.stock) || 0) - baseQty;
                                    matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty;
                                } else if (item.type && item.type.includes('تحويل')) {
                                    const srcWH = (item.sourceWarehouse || defaultWH || 'المخزن الرئيسي').trim();
                                    const dstWH = (item.warehouse || '').trim();
                                    matchedVar.warehouseStocks[srcWH] = (parseFloat(matchedVar.warehouseStocks[srcWH]) || 0) + baseQty;
                                    if (dstWH) matchedVar.warehouseStocks[dstWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[dstWH]) || 0) - baseQty);
                                }
                            }
                        }
                    }

                }

            });

            // 2. حذف السجلات القديمة من الذاكرة بدقة بدون حذف سجلات أخرى تحمل نفس الـ id التلقائي
            if (typeof transactions !== 'undefined' && Array.isArray(transactions)) {
                transactions = transactions.filter(t => {
                    const hasInvId = t.invoiceId != null && t.invoiceId !== '';
                    const isMatch = hasInvId ? (String(t.invoiceId) === String(invId)) : (String(t.id) === String(invId));
                    return !(isMatch && (!cleanType || (t.type && t.type.includes(cleanType))));
                });
            }

            // 3. مسح كاش أرصدة المخازن فوراً
            if (typeof invalidateStockCache === 'function') {
                invalidateStockCache();
            }

            // 4. الحذف الفعلي والنهائي من قاعدة البيانات لمنع التكرار (الدبلرة) عند التعديل
            try {

                if (typeof db !== 'undefined' && db.transactions) {
                    await db.transactions.where('invoiceId').equals(invId.toString()).filter(t => !cleanType || t.type.includes(cleanType)).delete();

                    if (!isNaN(Number(invId))) {
                        await db.transactions.where('invoiceId').equals(Number(invId)).filter(t => !cleanType || t.type.includes(cleanType)).delete();
                    }
                }

            } catch (e) {

                console.warn("⚠️ فشل الحذف المباشر من القاعدة، سيتم الاعتماد على الحفظ الكلي لاحقاً:", e);

            }

        };

        async function deleteTransaction(idx) {

            if (!checkPermission('docs_delete')) return;

            if (window.isDeletingTransaction) return;

            const t = transactions[idx];

            if (!t) return;

            const msg = t.invoiceId ? `🚨 هل أنت متأكد من حذف الفاتورة رقم #${t.invoiceId} بالكامل؟` : `🚨 هل أنت متأكد من حذف هذه الحركة؟`;

            showCustomAlert({

                type: 'error',

                titleText: '⚠️ حذف نهائي',

                msg: msg + '\nسيتم حذف كافة السجلات المرتبطة وتعديل أرصدة المخازن والحسابات فوراً.',

                showCancel: true,

                confirmText: 'نعم، احذف نهائياً',

                onConfirm: async () => {

                    if (window.isDeletingTransaction) return;
                    window.isDeletingTransaction = true;

                    try {

                        const invId = t.invoiceId;

                        const cleanType = t.type.split(' ')[0]; // استخراج الكلمة الأولى من النوع (بيع، شراء، تسوية، إلخ) لضمان المطابقة

                        const itemsToRemove = invId ? transactions.filter(x => x.invoiceId == invId && x.type.includes(cleanType)) : [t];

                        // 🗑️ نقل للقمامة قبل الحذف

                        const label = invId ? `فاتورة #${invId} (${t.type})` : `حركة: ${t.product || t.type}`;

                        await trashManager.moveToTrash(itemsToRemove, 'transaction', label);

                        // 1. عكس المخزن
                        itemsToRemove.forEach(item => {

                            const p = productsDB.find(p => p.name === item.product || p.id === item.productId || p.id === item.product);

                            if (p) {

                                let factor = parseFloat(item.unitFactor) || 1;

                                if (item.unit && p.units) {

                                    const u = p.units.find(u => u.unitName === item.unit);

                                    if (u) factor = parseFloat(u.factor) || 1;

                                }

                                const baseQty = parseFloat(item.qty) * factor;

                                const activeWH = item.warehouse || item.sourceWarehouse || (t && t.warehouse ? t.warehouse : '') || 'المخزن الرئيسي';
                                if (!p.warehouseStocks) p.warehouseStocks = {};

                                if (item.type.includes('مرتجع بيع')) {
                                    p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                                    p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                                } else if (item.type.includes('مرتجع شراء')) {
                                    p.stock = (parseFloat(p.stock) || 0) + baseQty;
                                    p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                                } else if (item.type.includes('بيع')) {
                                    p.stock = (parseFloat(p.stock) || 0) + baseQty;
                                    p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) + baseQty;
                                } else if (item.type.includes('شراء')) {
                                    p.stock = Math.max(0, (parseFloat(p.stock) || 0) - baseQty);
                                    p.warehouseStocks[activeWH] = Math.max(0, (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty);
                                    if (item.previousCost !== undefined && item.previousCost !== null && !isNaN(parseFloat(item.previousCost))) {
                                        p.cost = parseFloat(item.previousCost);
                                    }
                                } else if (item.type.includes('تسوية')) {
                                    p.stock = (parseFloat(p.stock) || 0) - baseQty;
                                    p.warehouseStocks[activeWH] = (parseFloat(p.warehouseStocks[activeWH]) || 0) - baseQty;
                                } else if (item.type.includes('تحويل')) {
                                    const srcWH = item.sourceWarehouse || 'المخزن الرئيسي';
                                    const dstWH = item.warehouse || '';
                                    p.warehouseStocks[srcWH] = (parseFloat(p.warehouseStocks[srcWH]) || 0) + baseQty;
                                    if (dstWH) {
                                        p.warehouseStocks[dstWH] = Math.max(0, (parseFloat(p.warehouseStocks[dstWH]) || 0) - baseQty);
                                    }
                                }

                                // عكس رصيد التشكيلة (المقاس واللون) في مصفوفة الصنف عند الحذف
                                if (p.variants && Array.isArray(p.variants)) {
                                    const sSize = item.selectedSize || item.size || '';
                                    const sColor = item.selectedColor || item.color || '';
                                    if (sSize || sColor) {
                                        const matchedVar = p.variants.find(v => 
                                            (!sSize || v.size === sSize) && 
                                            (!sColor || v.color === sColor)
                                        );
                                        if (matchedVar) {
                                            if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                                            if (item.type && item.type.includes('مرتجع بيع')) {
                                                matchedVar.stock = (parseFloat(matchedVar.stock) || 0) - baseQty;
                                                matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                            } else if (item.type && item.type.includes('مرتجع شراء')) {
                                                matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                                matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                            } else if (item.type && item.type.includes('بيع')) {
                                                matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                                matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                            } else if (item.type && item.type.includes('شراء')) {
                                                matchedVar.stock = (parseFloat(matchedVar.stock) || 0) - baseQty;
                                                matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                            } else if (item.type && item.type.includes('تسوية')) {
                                                matchedVar.stock = (parseFloat(matchedVar.stock) || 0) - baseQty;
                                                matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty;
                                            } else if (item.type && item.type.includes('تحويل')) {
                                                const srcWH = item.sourceWarehouse || 'المخزن الرئيسي';
                                                const dstWH = item.warehouse || '';
                                                matchedVar.warehouseStocks[srcWH] = (parseFloat(matchedVar.warehouseStocks[srcWH]) || 0) + baseQty;
                                                if (dstWH) matchedVar.warehouseStocks[dstWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[dstWH]) || 0) - baseQty);
                                            }
                                        }
                                    }
                                }

                            }

                        });

                        // 2. الحذف من المصفوفة والتحقق من الربط لتنظيف علامة الإرجاع

                        const originalInvIdToClean = itemsToRemove.find(it => it.originalInvoiceId)?.originalInvoiceId;

                        const originalTypeToClean = itemsToRemove[0]?.type.includes('بيع') ? 'بيع' : 'شراء';

                        if (invId) {

                            transactions = transactions.filter(x => !(x.invoiceId == invId && x.type.includes(cleanType)));

                            // 🛑 الحذف النهائي من قاعدة البيانات

                            const invIdStr = invId.toString();

                            const invIdNum = Number(invId);

                            // البحث عن المعرفات الفرعية (id) في قاعدة البيانات لهذه السجلات

                            const dbItems = await db.transactions

                                .where('invoiceId').anyOf([invIdStr, invIdNum])

                                .toArray();

                            // فلترة السجلات التي تطابق النوع أيضاً لضمان الدقة

                            const idsToDelete = dbItems

                                .filter(x => x.type.includes(cleanType))

                                .map(x => x.id);

                            if (idsToDelete.length > 0) {

                                await db.transactions.bulkDelete(idsToDelete);

                            }

                        } else {

                            // لو حركة فردية بدون رقم فاتورة

                            const targetId = t.id;

                            if (targetId) await db.transactions.delete(targetId);

                            transactions.splice(idx, 1);

                        }

                        // 3. تنظيف علامة الإرجاع (is_returned) في الفاتورة الأصلية إذا لم يتبقَ لها مرتجعات أخرى

                        if (originalInvIdToClean) {

                            const remainingReturns = transactions.filter(x => x.originalInvoiceId == originalInvIdToClean && x.type.includes('مرتجع'));

                            if (remainingReturns.length === 0) {

                                transactions.forEach(x => {

                                    if (x.invoiceId == originalInvIdToClean && x.type.includes(originalTypeToClean) && !x.type.includes('مرتجع')) {

                                        x.is_returned = false;

                                    }

                                });

                            }

                        }

                        await saveData();

                        renderInvoicesTable();

                        if (typeof renderAccountsTable === 'function') renderAccountsTable();

                        if (typeof renderHistoryTable === 'function') renderHistoryTable();

                        if (typeof renderDailyMovementReport === 'function') renderDailyMovementReport();

                        if (typeof renderInventoryTable === 'function') renderInventoryTable();

                        if (typeof updateCashBoxDisplay === 'function') updateCashBoxDisplay();

                        showToast("✅ تم النقل للسلة وتصحيح الأرصدة بنجاح.");

                        closeCustomModal();

                    } finally {
                        window.isDeletingTransaction = false;
                    }

                }

            });

        }

        // دالة مساعدة لعرض مودال احترافي للمحتوى

        function viewOldInvoice(invoiceId, type = 'بيع', autoSwitch = true) {
            if (autoSwitch) {
                if (typeof hasPermission === 'function' && !hasPermission('docs_view')) {
                    return; // منع التحويل التلقائي لقسم الفواتير لمن ليس لديه صلاحية عرض الفواتير
                }
                switchSection('invoices');
            }

            // تصفير الفلاتر لضمان ظهور الفاتورة

            if (document.getElementById('invoicesDateFrom')) document.getElementById('invoicesDateFrom').value = '';

            if (document.getElementById('invoicesDateTo')) document.getElementById('invoicesDateTo').value = '';

            // تحديد نوع الفلترة في جدول الفواتير وتحديث التبويب النشط

            const filterEl = document.getElementById('invoicesTypeFilter');

            if (filterEl) {

                let cleanType = 'all';
                if (type.includes('مرتجع بيع')) cleanType = 'sales-return';
                else if (type.includes('مرتجع شراء')) cleanType = 'purchase-return';
                else if (type.includes('بيع')) cleanType = 'sales';
                else if (type.includes('شراء')) cleanType = 'purchase';

                filterEl.value = cleanType;

                document.querySelectorAll('.invoice-tab').forEach(btn => {

                    btn.classList.toggle('active', btn.innerText.includes(type) || btn.innerText.includes(cleanType));

                });

            }

            if (document.getElementById('invoicesSearchId')) document.getElementById('invoicesSearchId').value = invoiceId;

            renderInvoicesTable();

            if (document.getElementById('statementModal')) document.getElementById('statementModal').classList.add('hidden');

            setTimeout(() => {

                if (typeof viewInvoiceItems === 'function') viewInvoiceItems(invoiceId, type);

            }, 300);

        }

        // ================= منطق كشف الحساب (Account Statement) =================
        window.deleteInvoiceGlobal = async function(invId, type) {
            if (!invId) return;
            const idx = transactions.findIndex(t => (t.invoiceId == invId || t.id == invId) && (!type || (t.type && t.type.includes(type))));
            if (idx !== -1 && typeof deleteTransaction === 'function') {
                await deleteTransaction(idx);
            } else {
                if (typeof showToast === 'function') showToast('لم يتم العثور على الفاتورة المطلوبة للحذف', 'error');
            }
        };

        // ================= تقرير المديونيات (Debt Tracking) =================
