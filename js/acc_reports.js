// ============================================================
//  تقرير الحركة اليومية وتحليل الأرباح والديون (Daily & Analysis Reports)
// ============================================================
        function generateDailyReport() {

            const fromDate = document.getElementById('reportDateFrom').value;

            const toDate = document.getElementById('reportDateTo').value;

            if (!fromDate || !toDate) {

                showToast("⚠️ يرجى تحديد الفترة الزمنية أولاً");

                return;

            }

            // حفظ الفلاتر (Flexible Reports: Save Filters)

            setStore('pos_report_filters', JSON.stringify({

                dateFrom: fromDate,

                dateTo: toDate

            }));

            // دالة مساعدة لحساب المدفوع نقداً والآجل بدقة بناءً على طريقة الدفع واسم الشريك
            function getTxPaymentDetails(t) {
                const total = parseFloat(t.total) || parseFloat(t.price) || 0;
                const method = String(t.method || t.paymentMethod || '').toLowerCase();
                const partner = String(t.partner || '').trim();

                const isDeferred = method.includes('آجل') || method.includes('deferred') || method.includes('ذمم') || method.includes('آجلة');
                const isCash = method.includes('نقد') || method.includes('كاش') || method.includes('cash') ||
                               (!isDeferred && (partner === 'عميل نقدي' || partner === 'مورد نقدي' || partner === 'نقدي' || partner === 'كاش' || !partner || partner === 'بدون'));

                let paid = 0;
                let credit = 0;

                if (isCash) {
                    paid = total;
                    credit = 0;
                } else if (isDeferred) {
                    paid = parseFloat(t.paidAmount != null ? t.paidAmount : (t.paid || 0));
                    if (paid > total) paid = total;
                    credit = Math.max(0, total - paid);
                } else {
                    if (t.paidAmount != null && parseFloat(t.paidAmount) > 0) {
                        paid = parseFloat(t.paidAmount);
                        credit = Math.max(0, total - paid);
                    } else {
                        paid = total;
                        credit = 0;
                    }
                }
                return { total, paid, credit };
            }

            const isNonCashMethod = (m) => {
                if (!m) return false;
                const str = String(m).toLowerCase();
                return str.includes('بنك') || str.includes('تحويل') || str.includes('فيزا') || str.includes('شيك') || str.includes('شبكة') || str.includes('فودافون') || str.includes('انستاباي') || str.includes('إنستاباي') || str.includes('insta') || str.includes('محفظة');
            };

            const selectedWarehouse = document.getElementById('dailyReportWarehouseSelect')?.value || 'all';

            // دالة مساعدة لفحص مطابقة الحركة للمخزن المحدد
            const matchesSelectedWarehouse = (t) => {
                if (selectedWarehouse === 'all') return true;
                if (!t) return false;
                const isTransfer = t.type && t.type.includes('تحويل');
                if (isTransfer) {
                    return (t.warehouse === selectedWarehouse || 
                            t.sourceWarehouse === selectedWarehouse || 
                            t.toWarehouse === selectedWarehouse || 
                            t.destWarehouse === selectedWarehouse || 
                            t.fromWarehouse === selectedWarehouse);
                }
                return (t.warehouse === selectedWarehouse || (!t.warehouse && selectedWarehouse === 'المخزن الرئيسي'));
            };

            // 1. حساب الرصيد السابق الموحد لمجموع الحركات النقدية قبل تاريخ البداية
            let previousBalance = 0;
            const priorRaw = transactions.filter(t => t.dateISO && t.dateISO < fromDate && matchesSelectedWarehouse(t));
            const priorGrouped = getGroupedTransactions(priorRaw);

            priorGrouped.forEach(g => {
                const paid = g.paid || 0;
                const total = g.total || 0;
                const gType = g.type || '';
                const isNonCash = isNonCashMethod(g.method);

                if (gType.includes('قبض')) {
                    if (!isNonCash) previousBalance += total;
                } else if (gType.includes('صرف')) {
                    if (!isNonCash) previousBalance -= total;
                } else if (gType.includes('بيع') && !gType.includes('مرتجع')) {
                    if (!isNonCash) previousBalance += paid;
                } else if ((gType.includes('شراء') || gType.includes('مشتريات')) && !gType.includes('مرتجع')) {
                    if (!isNonCash) previousBalance -= paid;
                } else if (gType.includes('مرتجع بيع')) {
                    if (!isNonCash) previousBalance -= paid;
                } else if (gType.includes('مرتجع شراء')) {
                    if (!isNonCash) previousBalance += paid;
                }
            });

            // 2. فلترة وتجميع حركات الفترة المحددة بالدالة الموحدة
            const currentRaw = transactions.filter(t => t.dateISO && t.dateISO >= fromDate && t.dateISO <= toDate && matchesSelectedWarehouse(t));
            const currentGrouped = getGroupedTransactions(currentRaw);

            // تهيئة العدادات مع فصل الجملة عن القطاعي (Retail vs Wholesale)
            let sales = { count: 0, total: 0, cash: 0, credit: 0 };
            let retailSales = { count: 0, total: 0, cash: 0, credit: 0 };
            let wholesaleSales = { count: 0, total: 0, cash: 0, credit: 0 };

            let salesReturn = { count: 0, total: 0, cash: 0, credit: 0 };
            let purchases = { count: 0, total: 0, cash: 0, credit: 0 };
            let purchasesReturn = { count: 0, total: 0, cash: 0, credit: 0 };
            let receipts = { count: 0, total: 0, cash: 0, nonCash: 0 };
            let disbursements = { count: 0, total: 0, cash: 0, nonCash: 0 };
            let adjustments = { count: 0, total: 0 };
            let transfers = { count: 0, total: 0 };

            currentGrouped.forEach(g => {
                const total = g.total || 0;
                const paid = g.paid || 0;
                const credit = g.remaining || 0;
                const gType = g.type || '';

                if (gType.includes('مرتجع بيع')) {
                    salesReturn.count++;
                    salesReturn.total += total;
                    salesReturn.cash += paid;
                    salesReturn.credit += credit;
                } else if (gType.includes('بيع')) {
                    sales.count++;
                    sales.total += total;
                    sales.cash += paid;
                    sales.credit += credit;

                    // فحص هل الفاتورة جملة أم قطاعي (تجزئة)
                    const isWholesale = (g.priceLevel === 'wholesale') || (g.items && g.items.some(it => it.priceLevel === 'wholesale'));
                    if (isWholesale) {
                        wholesaleSales.count++;
                        wholesaleSales.total += total;
                        wholesaleSales.cash += paid;
                        wholesaleSales.credit += credit;
                    } else {
                        retailSales.count++;
                        retailSales.total += total;
                        retailSales.cash += paid;
                        retailSales.credit += credit;
                    }
                } else if (gType.includes('مرتجع شراء')) {
                    purchasesReturn.count++;
                    purchasesReturn.total += total;
                    purchasesReturn.cash += paid;
                    purchasesReturn.credit += credit;
                } else if (gType.includes('شراء') || gType.includes('مشتريات')) {
                    purchases.count++;
                    purchases.total += total;
                    purchases.cash += paid;
                    purchases.credit += credit;
                } else if (gType.includes('قبض')) {
                    receipts.count++;
                    receipts.total += total;
                    if (isNonCashMethod(g.method)) receipts.nonCash = (receipts.nonCash || 0) + total;
                    else receipts.cash = (receipts.cash || 0) + total;
                } else if (gType.includes('صرف')) {
                    disbursements.count++;
                    disbursements.total += total;
                    if (isNonCashMethod(g.method)) disbursements.nonCash = (disbursements.nonCash || 0) + total;
                    else disbursements.cash = (disbursements.cash || 0) + total;
                } else if (gType.includes('تسوية')) {
                    adjustments.count++;
                    adjustments.total += total;
                } else if (gType.includes('تحويل')) {
                    if (g.transferStatus !== 'rejected') {
                        transfers.count++;
                        transfers.total += total;
                    }
                }
            });

            // تعبئة جدول العمليات مع إبراز الجملة والتجزئة
            const opsBody = document.getElementById('opsSummaryBody');
            opsBody.innerHTML = `
                <tr style="background: rgba(16, 185, 129, 0.08); font-weight: 800;">
                    <td>🛍️ مبيعات التجزئة (قطاعي)</td>
                    <td>${retailSales.count}</td>
                    <td style="color:#059669; font-weight:900;">${retailSales.total.toFixed(2)}</td>
                    <td>${retailSales.cash.toFixed(2)}</td>
                    <td>${retailSales.credit.toFixed(2)}</td>
                </tr>
                <tr style="background: rgba(59, 130, 246, 0.08); font-weight: 800;">
                    <td>📦 مبيعات الجملة</td>
                    <td>${wholesaleSales.count}</td>
                    <td style="color:#2563eb; font-weight:900;">${wholesaleSales.total.toFixed(2)}</td>
                    <td>${wholesaleSales.cash.toFixed(2)}</td>
                    <td>${wholesaleSales.credit.toFixed(2)}</td>
                </tr>
                <tr style="background: #f8fafc; font-weight: 900; border-top: 1px dashed #cbd5e1;">
                    <td>🛒 إجمالي المبيعات العامة (تجزئة + جملة)</td>
                    <td>${sales.count}</td>
                    <td style="color:#0f172a; font-size:1.05rem;">${sales.total.toFixed(2)}</td>
                    <td style="color:#059669;">${sales.cash.toFixed(2)}</td>
                    <td style="color:#d97706;">${sales.credit.toFixed(2)}</td>
                </tr>
                <tr><td>🔄 مرتجع مبيعات</td><td>${salesReturn.count}</td><td>${salesReturn.total.toFixed(2)}</td><td>${salesReturn.cash.toFixed(2)}</td><td>${salesReturn.credit.toFixed(2)}</td></tr>
                <tr><td>🧺 مشتريات</td><td>${purchases.count}</td><td>${purchases.total.toFixed(2)}</td><td>${purchases.cash.toFixed(2)}</td><td>${purchases.credit.toFixed(2)}</td></tr>
                <tr><td>🔙 مرتجع مشتريات</td><td>${purchasesReturn.count}</td><td>${purchasesReturn.total.toFixed(2)}</td><td>${purchasesReturn.cash.toFixed(2)}</td><td>${purchasesReturn.credit.toFixed(2)}</td></tr>
                <tr><td>💰 قبض (إيرادات)</td><td>${receipts.count}</td><td>${receipts.total.toFixed(2)}</td><td>${receipts.cash.toFixed(2)}</td><td>${receipts.nonCash.toFixed(2)}</td></tr>
                <tr><td>💸 صرف (مصروفات)</td><td>${disbursements.count}</td><td>${disbursements.total.toFixed(2)}</td><td>${disbursements.cash.toFixed(2)}</td><td>${disbursements.nonCash.toFixed(2)}</td></tr>
                <tr style="background: rgba(142, 68, 173, 0.05);"><td>⚖️ تسوية المخزن</td><td>${adjustments.count}</td><td>${adjustments.total.toFixed(2)}</td><td>-</td><td>-</td></tr>
                <tr style="background: rgba(94, 51, 112, 0.1);"><td>🚚 تحويل مخزني</td><td>${transfers.count}</td><td>${transfers.total.toFixed(2)}</td><td>-</td><td>-</td></tr>
                <tr style="font-weight:900; background:#f1f5f9; border-top:2px solid #cbd5e1;">
                    <td>📊 إجمالي الحركة والإيرادات (المبيعات + القبض)</td>
                    <td>${sales.count + receipts.count}</td>
                    <td style="color:#1e293b;">${(sales.total + receipts.total).toFixed(2)}</td>
                    <td style="color:var(--main-green);">${(sales.cash + receipts.cash).toFixed(2)}</td>
                    <td style="color:#d97706;">${(sales.credit + receipts.nonCash).toFixed(2)}</td>
                </tr>
            `;

            // إجمالي اليومية الفعلي (ما يجب أن يكون في الدرج الورقي حالياً)
            const cashReceipts = receipts.cash !== undefined ? receipts.cash : receipts.total;
            const cashDisbursements = disbursements.cash !== undefined ? disbursements.cash : disbursements.total;

            const dailyTotal = (sales.cash || 0) + (cashReceipts || 0) + (purchasesReturn.cash || 0) 
                             - (salesReturn.cash || 0) - (purchases.cash || 0) - (cashDisbursements || 0);
                             
            const dailyTotalEl = document.getElementById('dailyTotalVal');
            if (dailyTotalEl) {
                dailyTotalEl.innerText = dailyTotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
                const parentBadge = document.getElementById('dailyTotalSalesReceipts');
                if (parentBadge) {
                    parentBadge.onclick = () => showDailyTotalBreakdown(sales.cash || 0, cashReceipts || 0, cashDisbursements || 0, dailyTotal);
                }
            }

            const lastUpdateEl = document.getElementById('reportLastUpdate');
            if (lastUpdateEl) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                const dateStr = now.toLocaleDateString('ar-EG');
                lastUpdateEl.innerHTML = `آخر تحديث: <b style="color:var(--main-green);">${timeStr}</b> | م ${dateStr}`;
            }

            // حساب القيم النهائية للخزينة (الكاش الفعلي بالدرج)
            const netCashMovement = (sales.cash + cashReceipts + purchasesReturn.cash) - (purchases.cash + cashDisbursements + salesReturn.cash);
            const finalCashBalance = previousBalance + netCashMovement;
            const movementColor = netCashMovement >= 0 ? "var(--main-green)" : "var(--box-red)";
            const balanceColor = finalCashBalance >= 0 ? "var(--main-green)" : "var(--box-red)";

            // تعبئة جدول الخزينة
            const treasuryBody = document.getElementById('treasurySummaryBody');
            treasuryBody.innerHTML = `
                <tr><td>🛒 مبيعات نقدية</td><td style="color:var(--main-green); font-weight:bold;">${sales.cash.toFixed(2)}</td></tr>
                <tr><td>🔄 مرتجع مبيعات نقدي</td><td style="color:var(--box-red); font-weight:bold;">${salesReturn.cash.toFixed(2)}</td></tr>
                <tr><td>🧺 مشتريات نقدية</td><td style="color:var(--box-red); font-weight:bold;">${purchases.cash.toFixed(2)}</td></tr>
                <tr><td>🔙 مرتجع مشتريات نقدي</td><td style="color:var(--main-green); font-weight:bold;">${purchasesReturn.cash.toFixed(2)}</td></tr>
                <tr><td>💰 قبض نقدي (إيرادات الدرج)</td><td style="color:var(--main-green); font-weight:bold;">${cashReceipts.toFixed(2)}</td></tr>
                ${(receipts.nonCash && receipts.nonCash > 0) ? `<tr><td>💳 قبض بنكي / إلكتروني</td><td style="color:#2563eb; font-weight:bold;">${receipts.nonCash.toFixed(2)}</td></tr>` : ''}
                <tr><td>💸 صرف نقدي (مصروفات الدرج)</td><td style="color:var(--box-red); font-weight:bold;">${cashDisbursements.toFixed(2)}</td></tr>
                ${(disbursements.nonCash && disbursements.nonCash > 0) ? `<tr><td>🏦 صرف بنكي / إلكتروني</td><td style="color:#7c3aed; font-weight:bold;">${disbursements.nonCash.toFixed(2)}</td></tr>` : ''}
                <tr style="background: rgba(142, 68, 173, 0.05);"><td>⚖️ تسوية المخزن (غير مؤثرة على الكاش)</td><td style="color:${adjustments.total >= 0 ? 'var(--main-green)' : 'var(--box-red)'}; font-weight:bold;">${adjustments.total.toFixed(2)}</td></tr>
                <tr style="background: rgba(94, 51, 112, 0.1);"><td>🚚 تحويل مخزني (غير مؤثر على الكاش)</td><td style="color:#5e3370; font-weight:bold;">${transfers.total.toFixed(2)}</td></tr>
                <tr style="font-weight:bold; background:#f9f9f9; border-top:2px dashed #ccc;">
                    <td>⏺️ رصيد سابق (افتتاحي نقدية)</td>
                    <td style="color:#2c3e50;">${previousBalance.toFixed(2)}</td>
                </tr>
                <tr style="background:rgba(211, 211, 211, 0.2); font-weight:900;">
                    <td>🔄 صافي الحركة النقدية بالدرج</td>
                    <td style="color:${movementColor}; font-size:1.1rem;">${netCashMovement.toFixed(2)}</td>
                </tr>
                <tr style="background:var(--main-blue); color:white; font-weight:bold; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <td>💰 الرصيد النهائي بالدرج</td>
                    <td style="color:white; font-size:1.3rem; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${finalCashBalance.toFixed(2)}</td>
                </tr>
            `;

            // حساب الأرباح المفصلة (أرباح قطاعي - أرباح جملة - مرتجعات - الصافي العام)
            let retailGrossProfit = 0;
            let wholesaleGrossProfit = 0;
            let returnSalesProfitLost = 0;

            currentRaw.forEach(t => {
                if (t.invoiceId && t.profit !== undefined && t.profit !== '-') {
                    const pVal = parseFloat(t.profit) || 0;
                    if (t.type.includes('بيع') && !t.type.includes('مرتجع')) {
                        if (t.priceLevel === 'wholesale') {
                            wholesaleGrossProfit += pVal;
                        } else {
                            retailGrossProfit += pVal;
                        }
                    } else if (t.type.includes('مرتجع بيع')) {
                        returnSalesProfitLost += Math.abs(pVal);
                    }
                }
            });

            const totalGrossProfit = retailGrossProfit + wholesaleGrossProfit;
            const netProfit = totalGrossProfit - returnSalesProfitLost;

            const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;

            const profitCard = document.getElementById('dailyReportProfitSummaryCard');
            if (profitCard) {
                profitCard.style.setProperty('display', canViewProfits ? '' : 'none', 'important');
            }

            const profitBody = document.getElementById('profitSummaryBody');
            if (profitBody) {
                if (canViewProfits) {
                    profitBody.innerHTML = `
                        <tr style="background:rgba(16, 185, 129, 0.08);">
                            <td>🛍️ أرباح مبيعات التجزئة (قطاعي)</td>
                            <td style="color:#059669; font-weight:900; font-size:1.05rem;">${retailGrossProfit.toFixed(2)} ج.م</td>
                        </tr>
                        <tr style="background:rgba(59, 130, 246, 0.08);">
                            <td>📦 أرباح مبيعات الجملة</td>
                            <td style="color:#2563eb; font-weight:900; font-size:1.05rem;">${wholesaleGrossProfit.toFixed(2)} ج.م</td>
                        </tr>
                        <tr style="background:rgba(39, 174, 96, 0.05); border-top:1px dashed #cbd5e1;">
                            <td>📈 إجمالي أرباح المبيعات المشتركة</td>
                            <td style="color:var(--main-green); font-weight:900; font-size:1.1rem;">${totalGrossProfit.toFixed(2)} ج.م</td>
                        </tr>
                        <tr style="background:rgba(239, 68, 68, 0.05);">
                            <td>📉 إجمالي أرباح مرتجعات البيع</td>
                            <td style="color:#ef4444; font-weight:900; font-size:1.1rem;">-${returnSalesProfitLost.toFixed(2)} ج.م</td>
                        </tr>
                        <tr style="background:rgba(142, 68, 173, 0.12); font-weight:900; border-top:2.5px solid var(--main-purple);">
                            <td>📊 صافي الربح النهائي الشامل</td>
                            <td style="color:${netProfit >= 0 ? 'var(--main-purple)' : '#ef4444'}; font-size:1.35rem; text-shadow:0 1px 2px rgba(0,0,0,0.1);">${netProfit.toFixed(2)} ج.م</td>
                        </tr>
                    `;
                } else {
                    profitBody.innerHTML = '';
                }
            }

            window.dailyReportData = {
                netProfit: canViewProfits ? netProfit : 0,
                grossProfit: canViewProfits ? totalGrossProfit : 0,
                retailGrossProfit: canViewProfits ? retailGrossProfit : 0,
                wholesaleGrossProfit: canViewProfits ? wholesaleGrossProfit : 0,
                retailSalesTotal: retailSales.total,
                wholesaleSalesTotal: wholesaleSales.total,
                totalSales: sales.total,
                totalPurchases: purchases.total,
                totalReceipts: receipts.total,
                totalExpenses: disbursements.total,
                selectedWarehouse: selectedWarehouse
            };

            showToast(canViewProfits ? "✅ تم تحديث وتفصيل تقارير الحركة والأرباح بنجاح" : "✅ تم تحديث وتفصيل تقرير الحركة اليومية بنجاح");
        }

        function showDailyTotalBreakdown(cashSales, receiptsTotal, disbursementsTotal, netTotal) {

            let existingModal = document.getElementById('dailyTotalBreakdownModal');

            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');

            modal.id = 'dailyTotalBreakdownModal';

            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; display: flex; justify-content: center; align-items: center;  animation: fadeIn 0.2s;';

            modal.innerHTML = `

                <div style="background: var(--surface-color, #fff); color: var(--text-color, #0f172a); border-radius: 16px; padding: 25px; width: 90%; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); position: relative; animation: slideUp 0.3s ease;">

                    <h3 style="margin-top: 0; color: var(--main-purple); border-bottom: 2px solid var(--border-color, #f1f5f9); padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">

                        تفاصيل إجمالي اليومية

                        <button onclick="copyDailyTotalFromModal('${netTotal}')" title="نسخ الإجمالي" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">📋</button>

                    </h3>

                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 1.05rem;">

                        <span>(+) إجمالي البيع النقدي:</span>

                        <span style="color: var(--main-green); font-weight: bold;">${cashSales.toLocaleString('en-US', {minimumFractionDigits:2})}</span>

                    </div>

                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 1.05rem;">

                        <span>(+) إجمالي القبض:</span>

                        <span style="color: var(--main-green); font-weight: bold;">${receiptsTotal.toLocaleString('en-US', {minimumFractionDigits:2})}</span>

                    </div>

                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 1.05rem; border-bottom: 2px dashed var(--border-color, #e2e8f0); padding-bottom: 12px;">

                        <span>(-) إجمالي الصرف:</span>

                        <span style="color: var(--box-red); font-weight: bold;">${disbursementsTotal.toLocaleString('en-US', {minimumFractionDigits:2})}</span>

                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 1.3rem; font-weight: bold; align-items: center;">

                        <span>الصافي لليومية:</span>

                        <span style="color: ${netTotal >= 0 ? 'var(--main-green)' : 'var(--box-red)'}; background: ${netTotal >= 0 ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)'}; padding: 4px 10px; border-radius: 8px;">${netTotal.toLocaleString('en-US', {minimumFractionDigits:2})}</span>

                    </div>

                    <button onclick="this.closest('#dailyTotalBreakdownModal').remove()" style="width: 100%; margin-top: 25px; background: var(--main-purple); color: white; border: none; padding: 12px; border-radius: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">إغلاق</button>

                </div>

            `;

            document.body.appendChild(modal);

        }

        function copyDailyTotalFromModal(val) {
            if (!val) return;
            const numVal = parseFloat(val).toLocaleString('en-US', {minimumFractionDigits:2});
            navigator.clipboard.writeText(numVal).then(() => {
                showToast("📋 تم نسخ الإجمالي: " + numVal);
            });
        }

        window.copyDailyTotal = function() {
            const el = document.getElementById('dailyTotalSalesReceipts');
            if (!el) return;
            const text = el.innerText || el.textContent || '';
            const cleanNum = text.replace(/[^0-9.]/g, '');
            if (cleanNum && navigator.clipboard) {
                navigator.clipboard.writeText(cleanNum).then(() => {
                    if (typeof showToast === 'function') showToast("📋 تم نسخ إجمالي اليومية: " + cleanNum, "success");
                }).catch(() => {
                    if (typeof showToast === 'function') showToast("📋 " + text, "info");
                });
            }
        };

        window.switchSubTab = function(btnEl, targetId) {
            if (!btnEl) return;
            const parentContainer = btnEl.closest('.sub-tabs') || btnEl.parentElement;
            if (parentContainer) {
                parentContainer.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
            }
            btnEl.classList.add('active');
            
            const tabArea = document.getElementById(targetId);
            if (tabArea) {
                const areaParent = tabArea.parentElement;
                if (areaParent) {
                    areaParent.querySelectorAll('.tab-content-area').forEach(a => {
                        if (a.id !== targetId) a.style.display = 'none';
                    });
                }
                tabArea.style.display = 'block';
            }
        };

        window.loadPendingInvoices = function() {
            const tbody = document.getElementById('pendingInvoicesBody');
            if (!tbody) return;
            const customer = document.getElementById('receiptCustomer')?.value;
            if (!customer || customer.includes('اختر') || customer === '-') {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">يرجى اختيار العميل أولاً لعرض الفواتير المسددة</td></tr>';
                return;
            }
            const userTx = (typeof transactions !== 'undefined' ? transactions : []).filter(t => t.partner === customer && (t.type?.includes('بيع') || t.type?.includes('قبض'))).slice(-10);
            if (userTx.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">لا توجد فواتير سابقة لهذا العميل</td></tr>';
                return;
            }
            tbody.innerHTML = userTx.map(t => `
                <tr>
                    <td style="padding:6px 8px;">${t.date ? t.date.split('T')[0] : '-'}</td>
                    <td style="padding:6px 8px; font-weight:bold; color:#10b981;">${parseFloat(t.total || 0).toFixed(2)}</td>
                    <td style="padding:6px 8px;">${t.type || 'فاتورة'}</td>
                    <td style="padding:6px 8px; text-align:center;">
                        <button type="button" onclick="if(typeof viewTransactionDetails === 'function') viewTransactionDetails('${t.id}')" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="عرض التفاصيل">👁️</button>
                    </td>
                </tr>
            `).join('');
        };

        window.loadPendingBills = function() {
            const tbody = document.getElementById('pendingBillsBody') || document.getElementById('disburse-settlement');
            if (!tbody) return;
            const supplier = document.getElementById('disburseSupplier')?.value;
            if (!supplier || supplier.includes('اختر') || supplier === '-') {
                if (tbody.tagName === 'TBODY') {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">يرجى اختيار المورد أولاً</td></tr>';
                }
                return;
            }
        };

        window.renderAnalysisReport = function() {
            if (typeof renderAnalysisTable === 'function') {
                renderAnalysisTable();
            }
        };

        window.exportSelectedToExcel = function() {
            if (typeof exportToExcel === 'function') {
                exportToExcel();
            }
        };

        // ================= منطق المبيعات (Sales Logic) =================

        // --- 1. منطق البحث والإضافة ---

        function printReportData() {
            if (typeof validateDocumentData === 'function') {
                if (!validateDocumentData('dailyReport', 'الطباعة')) return;
            } else {
                const fromD = document.getElementById('reportDateFrom')?.value || new Date().toLocaleDateString('en-CA');
                const toD = document.getElementById('reportDateTo')?.value || new Date().toLocaleDateString('en-CA');
                const periodTxs = (typeof transactions !== 'undefined' && Array.isArray(transactions)) ? transactions.filter(t => t.dateISO && t.dateISO >= fromD && t.dateISO <= toD) : [];
                const repData = window.dailyReportData || {};
                const hasActivity = (periodTxs.length > 0 || (repData.totalSales || 0) > 0 || (repData.totalPurchases || 0) > 0 || (repData.totalReceipts || 0) > 0 || (repData.totalExpenses || 0) > 0);
                if (!hasActivity) {
                    if (typeof showToast === 'function') showToast("⚠️ لا توجد أي معاملات أو حركات مسجلة في هذا اليوم لطباعتها!", "warning");
                    else alert("⚠️ لا توجد أي معاملات أو حركات مسجلة في هذا اليوم لطباعتها!");
                    return;
                }
            }

            const opsSummary = document.getElementById('opsSummaryBody').innerHTML.replace(/📤|📥|🔄|🔙|💵|💸|⚖️|🚚|🛒|🧺|📦|💰|🌗|✅|⏳/g, '');

            const treasurySummary = document.getElementById('treasurySummaryBody').innerHTML.replace(/📤|📥|🔄|🔙|💵|💸|⚖️|🚚|🛒|🧺|📦|💰|🌗|✅|⏳|⏺️/g, '');

            const from = document.getElementById('reportDateFrom').value;

            const to = document.getElementById('reportDateTo').value;

            const selectedWh = document.getElementById('dailyReportWarehouseSelect')?.value || (window.dailyReportData?.selectedWarehouse || 'all');

            const businessName = getStore('bayan_business_name') || 'بيان POS للطلب والمبيعات';

            const canViewProfits = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;
            let profitSummaryPrintSection = '';
            if (canViewProfits) {
                const profitEl = document.getElementById('profitSummaryBody');
                const profitHtml = profitEl ? profitEl.innerHTML.replace(/📤|📥|🔄|🔙|💵|💸|⚖️|🚚|🛒|🧺|📦|💰|🌗|✅|⏳/g, '') : '';
                if (profitHtml.trim()) {
                    profitSummaryPrintSection = `
                    <div style="margin-bottom: 20px;">
                        <h3 style="border-right: 4px solid #000; padding-right: 8px; margin-bottom: 10px; font-size: 16px; font-weight: 900;">ملخص الأرباح</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 14px;">
                            <tbody style="font-weight: bold;">
                                ${profitHtml}
                            </tbody>
                        </table>
                    </div>
                    `;
                }
            }

            const content = `
                <div class="print-container" style="direction: rtl; font-family: 'Tahoma', 'Arial', sans-serif; padding: 10px; color: #000; width: 100%; box-sizing: border-box;">
                    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: 900;">${businessName}</h1>
                        <h2 style="margin: 5px 0; font-size: 18px; font-weight: 800;">تقرير الحركة اليومية</h2>
                        <div style="font-size: 14px; margin-top: 5px; font-weight: bold; border: 1px solid #000; padding: 5px; border-radius: 5px;">
                            من: ${from} <br> إلى: ${to}
                            ${(selectedWh && selectedWh !== 'all') ? `<br>🏢 المخزن: ${selectedWh}` : ''}
                        </div>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h3 style="border-right: 4px solid #000; padding-right: 8px; margin-bottom: 10px; font-size: 16px; font-weight: 900;">ملخص العمليات المالية</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 13px;">
                            <thead>
                                <tr style="border-bottom: 2px solid #000;">
                                    <th style="padding: 6px; border-left: 1px solid #000; text-align: right;">البيان</th>
                                    <th style="padding: 6px; border-left: 1px solid #000; text-align: center;">العدد</th>
                                    <th style="padding: 6px; border-left: 1px solid #000; text-align: center;">الإجمالي</th>
                                    <th style="padding: 6px; border-left: 1px solid #000; text-align: center;">نقدي</th>
                                    <th style="padding: 6px; text-align: center;">آجل</th>
                                </tr>
                            </thead>
                            <tbody style="text-align: right;">${opsSummary}</tbody>
                        </table>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <h3 style="border-right: 4px solid #000; padding-right: 8px; margin-bottom: 10px; font-size: 16px; font-weight: 900;">ملخص حركة الخزينة</h3>
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 14px;">
                            <thead>
                                <tr style="border-bottom: 2px solid #000;">
                                    <th style="padding: 8px; border-left: 1px solid #000; text-align: right;">البيان</th>
                                    <th style="padding: 8px; text-align: center;">القيمة</th>
                                </tr>
                            </thead>
                            <tbody style="font-weight: bold;">${treasurySummary}</tbody>
                        </table>
                    </div>
                    ${profitSummaryPrintSection}

                    <div style="margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; font-size: 11px; text-align: center; line-height: 1.6;">

                        <div style="font-weight: bold;">تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</div>

                        <div>بواسطة: ${currentUser ? currentUser.name : 'النظام'}</div>

                        <div style="font-weight: 900; margin-top: 5px; font-size: 12px; border: 1px solid #000; display: inline-block; padding: 2px 10px;">بيان POS - نظام مبيعات متكامل</div>

                    </div>

                </div>

            `;

            const printWindow = window.open('', '_blank');

            printWindow.document.write(`

                <html dir="rtl" lang="ar">

                    <head>

                        <title>طباعة تقرير الحركة اليومية</title>

                        <style>

                            @page { margin: 0; }

                            body { margin: 0 0 0 auto; padding: 5px; width: 80mm; font-family: 'Arial', sans-serif; text-align: right; }

                            table th, table td { padding: 4px; border: 1px solid #000 !important; color: #000 !important; }

                            * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }

                            /* إخفاء الخلفيات في الطباعة لضمان الوضوح */

                            tr, td, th { background-color: transparent !important; }

                        </style>

                    </head>

                    <body>

                        ${content}

                        <script>

                            window.onload = function() {

                                setTimeout(function() {

                                    window.focus();

                                    window.print();

                                    setTimeout(function() { window.close(); }, 500);

                                }, 300);

                            };

                        <\/script>

                    </body>

                </html>

            `);

            printWindow.document.close();

        }

         function printAdjustmentData() {

            if (!window.adjCart || window.adjCart.length === 0) return alert("لا توجد بيانات للطباعة");

            const shopName    = document.getElementById('shopName')?.value || 'بـيـان POS';
            const shopAddress = document.getElementById('shopAddress')?.value || '';
            const shopPhone   = document.getElementById('shopPhone1')?.value || '';
            const footerMsg   = document.getElementById('printFooterMsg')?.value || 'شكراً لزيارتكم!';
            const activeWH    = (typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي';

            let totalCountedQty = 0;
            let totalDiffQty = 0;
            let totalDiffValue = 0;

            let rows = window.adjCart.map((item, idx) => {
                const factor = parseFloat(item.unitFactor) || 1;
                const counted = (parseFloat(item.qty) || 0) * factor;
                const book = parseFloat(item.stock) || 0;
                const diff = counted - book;
                const price = parseFloat(item.price) || 0;
                const diffTotal = diff * price;

                totalCountedQty += counted;
                totalDiffQty += diff;
                totalDiffValue += diffTotal;

                const sSize = item.size || item.selectedSize || '-';
                const sColor = item.color || item.selectedColor || '-';
                const unitName = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');
                const diffLabel = diff < 0 ? `عجز (${Math.abs(diff)})` : (diff > 0 ? `زيادة (+${diff})` : 'مطابق (0)');

                return `
                    <tr>
                        <td style="padding: 6px 8px; border: 1px solid #000;">${idx + 1}</td>
                        <td style="text-align:right; padding: 6px 10px; border: 1px solid #000; font-weight:bold;">${item.name}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#047857;">${sSize}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#1d4ed8;">${sColor}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; background:#f8fafc;">${book}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; background:#eff6ff;">${counted} ${unitName}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:${diff < 0 ? '#dc2626' : (diff > 0 ? '#16a34a' : '#000')};">${diffLabel}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000;">${price.toFixed(2)}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${diffTotal.toFixed(2)}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-size:11px;">${item.notes || '-'}</td>
                    </tr>
                `;
            }).join('');

            const dtObj = typeof getTransactionDateTime === 'function' ? getTransactionDateTime('adjDate', 'adjTime') : { full: new Date().toLocaleString('ar-EG') };

            const content = `

                <div class="print-container" style="direction:rtl; font-family:Cairo, sans-serif; padding: 20px;">

                    <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">

                        <h1 style="margin:0;">${shopName}</h1>
                        ${shopAddress ? `<div style="font-size:12px; color:#555; margin-top:2px;">${shopAddress}</div>` : ''}
                        ${shopPhone ? `<div style="font-size:12px; color:#555; margin-top:2px;">هاتف: ${shopPhone}</div>` : ''}

                        <h2 style="margin:5px 0; background:#000; color:#fff; display:inline-block; padding:5px 20px; border-radius:5px;">إذن جرد وتسوية مخزنية</h2>

                    </div>

                    <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-weight:bold;">
                        <div>المخزن: <span style="text-decoration:underline;">${activeWH}</span></div>
                        <div>التاريخ: ${dtObj.full}</div>
                    </div>

                    <table style="width:100%; border-collapse:collapse; text-align:center; margin-bottom:20px;" border="1">

                        <thead>
                            <tr style="background:#f0f0f0;">
                                <th style="padding: 8px; border: 1px solid #000;">م</th>
                                <th style="padding: 8px; border: 1px solid #000; text-align:right;">الصنف</th>
                                <th style="padding: 8px; border: 1px solid #000;">المقاس</th>
                                <th style="padding: 8px; border: 1px solid #000;">اللون</th>
                                <th style="padding: 8px; border: 1px solid #000;">الدفتري</th>
                                <th style="padding: 8px; border: 1px solid #000;">الفعلي</th>
                                <th style="padding: 8px; border: 1px solid #000;">الفرق</th>
                                <th style="padding: 8px; border: 1px solid #000;">${(typeof window.getAdjustmentPriceLabel === 'function') ? window.getAdjustmentPriceLabel() : 'السعر'}</th>
                                <th style="padding: 8px; border: 1px solid #000;">قيمة الفرق</th>
                                <th style="padding: 8px; border: 1px solid #000;">الملاحظات</th>
                            </tr>
                        </thead>

                        <tbody>${rows}</tbody>

                        <tfoot>
                            <tr style="font-weight:bold; background:#f0f0f0;">
                                <td colspan="4" style="padding: 8px; border: 1px solid #000;">الإجمالي الكلي</td>
                                <td style="padding: 8px; border: 1px solid #000;">-</td>
                                <td style="padding: 8px; border: 1px solid #000;">${totalCountedQty}</td>
                                <td style="padding: 8px; border: 1px solid #000; color:${totalDiffQty < 0 ? '#dc2626' : (totalDiffQty > 0 ? '#16a34a' : '#000')};">${totalDiffQty >= 0 ? '+' : ''}${totalDiffQty}</td>
                                <td style="padding: 8px; border: 1px solid #000;">-</td>
                                <td style="padding: 8px; border: 1px solid #000;">${totalDiffValue.toFixed(2)}</td>
                                <td style="padding: 8px; border: 1px solid #000;">-</td>
                            </tr>
                        </tfoot>

                    </table>

                    <div style="margin-top:50px; display:flex; justify-content:space-between;">
                        <div style="text-align:center;">توقيع المسؤول:<br><br>...........................</div>
                        <div style="text-align:center;">توقيع أمين المخزن:<br><br>...........................</div>
                    </div>
                    
                    <div style="text-align:center; margin-top:30px; border-top:1px dashed #000; padding-top:10px; font-size:12px;">
                        <div style="font-weight:bold;">${footerMsg}</div>
                        <div>نظام بيان POS - مبيعات متكامل</div>
                    </div>

                </div>

             `;

            let receiptArea = document.getElementById('receipt-area');
            if (!receiptArea) {
                receiptArea = document.createElement('div');
                receiptArea.id = 'receipt-area';
                document.body.appendChild(receiptArea);
            }
            receiptArea.innerHTML = content;

            window.print();

        }

        // ================= منطق تحليل المبيعات المطور (Advanced Sales Analysis Logic) =================

        window.salesTrendChartInstance = window.salesTrendChartInstance || null;
        window.categoryChartInstance = window.categoryChartInstance || null;
        window.analysisDateSortDir = window.analysisDateSortDir || 'desc';
        if (typeof currentAnalysisMode !== 'undefined') {
            currentAnalysisMode = 'summary';
        } else {
            window.currentAnalysisMode = 'summary';
        }

        function setAnalysisMode(mode, shouldScroll = true) {
            currentAnalysisMode = mode;
            
            // تحديث تصميم الأزرار النشطة لجميع الأنماط
            const modeButtons = [
                { id: 'summary', el: document.getElementById('anModeSummaryBtn') },
                { id: 'detailed', el: document.getElementById('anModeDetailedBtn') },
                { id: 'customers', el: document.getElementById('anModeCustomerBtn') },
                { id: 'categories', el: document.getElementById('anModeCategoryBtn') },
                { id: 'returns', el: document.getElementById('anModeReturnBtn') }
            ];

            modeButtons.forEach(m => {
                if (m.el) {
                    const isActive = (mode === m.id);
                    m.el.className = isActive ? 'an-btn-mode active' : 'an-btn-mode';
                    m.el.style.background = isActive ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#f1f5f9';
                    m.el.style.color = isActive ? '#ffffff' : '#475569';
                    m.el.style.border = isActive ? 'none' : '1px solid #cbd5e1';
                }
            });

            renderAnalysisTable();

            if (shouldScroll) {
                setTimeout(() => {
                    const tableContainer = document.getElementById('analysisTableContainer');
                    if (tableContainer) {
                        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }, 80);
            }
        }
        window.setAnalysisMode = setAnalysisMode;

        function toggleAnalysisCharts() {
            const chartsArea = document.getElementById('analysis-charts-area');
            const btnText = document.getElementById('anToggleChartsText');
            const btn = document.getElementById('anToggleChartsBtn');
            if (!chartsArea) return;

            const isHidden = (chartsArea.style.display === 'none');
            if (isHidden) {
                chartsArea.style.display = 'grid';
                if (btnText) btnText.innerText = 'إخفاء الرسوم';
                if (btn) {
                    btn.style.background = '#f8fafc';
                    btn.style.color = '#4f46e5';
                    btn.style.borderColor = '#c7d2fe';
                }
                if (typeof setStore === 'function') setStore('pos_an_charts', 'true');
            } else {
                chartsArea.style.display = 'none';
                if (btnText) btnText.innerText = 'إظهار الرسوم 📈';
                if (btn) {
                    btn.style.background = '#eef2ff';
                    btn.style.color = '#4338ca';
                    btn.style.borderColor = '#6366f1';
                }
                if (typeof setStore === 'function') setStore('pos_an_charts', 'false');
            }
        }
        window.toggleAnalysisCharts = toggleAnalysisCharts;

        function shareAnalysisReport(platform) {
            const totalSales = document.getElementById('anTotalSales')?.innerText || '0.00';
            const totalProfit = document.getElementById('anTotalProfit')?.innerText || '0.00';
            const profitMargin = document.getElementById('anProfitMargin')?.innerText || '0.0%';
            const fromDate = document.getElementById('anDateFrom')?.value || 'بداية السجل';
            const toDate = document.getElementById('anDateTo')?.value || 'الآن';
            const shopName = (typeof getStore === 'function' ? getStore('shop_name') : null) || document.getElementById('shopName')?.value || 'متجر بيان POS';

            let text = `📊 *تقرير تحليل المبيعات والأرباح - ${shopName}*\n`;
            text += `🗓️ الفترة: من ${fromDate} إلى ${toDate}\n`;
            text += `----------------------------------\n`;
            text += `💰 صافي المبيعات: *${totalSales} ج.م*\n`;
            text += `📈 صافي الأرباح: *${totalProfit} ج.م*\n`;
            text += `🎯 هامش الربح: *${profitMargin}*\n`;
            text += `----------------------------------\n`;
            text += `✅ استخراج تلقائي بواسطة منظومة بيان POS | ${new Date().toLocaleDateString('ar-EG')}`;

            const encodedText = encodeURIComponent(text);
            let url = '';
            if (platform === 'whatsapp') {
                url = `https://wa.me/?text=${encodedText}`;
            } else if (platform === 'telegram') {
                url = `https://t.me/share/url?url=${encodedText}`;
            }
            if (url) window.open(url, '_blank');
        }
        window.shareAnalysisReport = shareAnalysisReport;

        // دالة مساعدة لحساب الربح الصافي الدقيق لكل حركة (بيع أو مرتجع)
        function getTransactionReliableProfit(t) {
            const isReturn = t.type && t.type.includes('مرتجع');
            const qty = Math.abs(parseFloat(t.qty) || 0);
            const price = parseFloat(t.price) || 0;
            const itemTotal = Math.abs(parseFloat(t.total) || (price * qty) || 0);

            // 1. إذا كان الربح مسجلاً ومخزناً بالعملية
            if (t.profit !== undefined && t.profit !== null && !isNaN(parseFloat(t.profit)) && parseFloat(t.profit) !== 0) {
                return Math.abs(parseFloat(t.profit));
            }

            // 2. حساب بديل من قاعدة البيانات إذا لم يتوفر الربح
            const p = (window.productsDB || []).find(x => x.name === t.product || x.id === t.productId || x.barcode === t.barcode);
            let baseCost = p ? (parseFloat(p.cost) || parseFloat(p.buyPrice) || 0) : 0;
            let factor = parseFloat(t.unitFactor) || 1;
            if (p && (!t.unitFactor || t.unitFactor === 1)) {
                const isSubUnit = p.subUnits && p.subUnits.find(u => u.unitName === t.unit);
                if (isSubUnit) factor = parseFloat(isSubUnit.factor) || 1;
            }
            const unitCost = baseCost * factor;
            const unitProfit = Math.max(0, price - unitCost);
            return unitProfit * qty;
        }

        function updateAnalysisCharts(data) {
            if (typeof Chart === 'undefined') return;

            const trendData = {};
            const catData = {};
            let totalQty = 0;
            let invoiceIds = new Set();
            let totalReturnsCount = 0;
            let totalReturnsAmount = 0;

            data.forEach(t => {
                const isReturn = t.type && t.type.includes('مرتجع');
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                const date = t.dateISO || 'غير مؤرخ';

                if (t.invoiceId && t.invoiceId !== '-') {
                    invoiceIds.add(t.invoiceId);
                }

                if (isReturn) {
                    totalReturnsCount++;
                    totalReturnsAmount += total;
                    totalQty -= qty;
                } else {
                    totalQty += qty;
                }

                // Trend data: Net sales per day
                if (!trendData[date]) trendData[date] = 0;
                trendData[date] += isReturn ? -total : total;

                // Category/product sales distribution (Always gross positive for doughnut chart)
                const prodName = t.product || 'صنف حر';
                if (!isReturn) {
                    if (!catData[prodName]) catData[prodName] = 0;
                    catData[prodName] += total;
                }
            });

            // Update KPI Cards
            const invoiceCountEl = document.getElementById('kpi-invoice-count');
            const totalQtyEl = document.getElementById('kpi-total-qty');
            const returnCountEl = document.getElementById('kpi-return-count');
            const returnAmountEl = document.getElementById('kpi-return-amount');

            if (invoiceCountEl) invoiceCountEl.innerText = invoiceIds.size.toLocaleString('en-US');
            if (totalQtyEl) totalQtyEl.innerText = Math.max(0, totalQty).toLocaleString('en-US');
            if (returnCountEl) returnCountEl.innerText = totalReturnsCount.toLocaleString('en-US');
            if (returnAmountEl) returnAmountEl.innerText = totalReturnsAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            // Chart 1: Sales Trend
            const trendLabels = Object.keys(trendData).sort();
            const trendValues = trendLabels.map(l => Math.round(trendData[l] * 100) / 100);
            const trendCtx = document.getElementById('salesTrendChart');

            if (trendCtx) {
                if (salesTrendChartInstance) {
                    try { salesTrendChartInstance.destroy(); } catch (e) {}
                    salesTrendChartInstance = null;
                }

                salesTrendChartInstance = new Chart(trendCtx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: trendLabels.length ? trendLabels : ['لا توجد مبيعات'],
                        datasets: [{
                            label: 'صافي المبيعات (ج.م)',
                            data: trendValues.length ? trendValues : [0],
                            borderColor: '#4f46e5',
                            backgroundColor: 'rgba(79, 70, 229, 0.08)',
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2.5,
                            pointRadius: 3.5,
                            pointBackgroundColor: '#4f46e5',
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            title: {
                                display: true,
                                text: '📈 اتجاه صافي المبيعات اليومية',
                                font: { family: 'Cairo', size: 13, weight: 'bold' },
                                color: '#1e293b'
                            },
                            tooltip: {
                                titleFont: { family: 'Cairo' },
                                bodyFont: { family: 'Cairo' }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(0,0,0,0.04)' },
                                ticks: { font: { family: 'Cairo', size: 10 } }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { font: { family: 'Cairo', size: 10 } }
                            }
                        }
                    }
                });
            }

            // Chart 2: Top Selling Products
            let productSalesArray = Object.keys(catData).map(name => ({
                name: name,
                total: catData[name]
            })).sort((a, b) => b.total - a.total);

            let finalLabels = [];
            let finalValues = [];

            if (productSalesArray.length > 6) {
                const top6 = productSalesArray.slice(0, 6);
                const others = productSalesArray.slice(6).reduce((sum, p) => sum + p.total, 0);
                finalLabels = top6.map(p => p.name);
                finalValues = top6.map(p => Math.round(p.total * 100) / 100);
                if (others > 0) {
                    finalLabels.push("أصناف أخرى");
                    finalValues.push(Math.round(others * 100) / 100);
                }
            } else {
                finalLabels = productSalesArray.map(p => p.name);
                finalValues = productSalesArray.map(p => Math.round(p.total * 100) / 100);
            }

            const catCtx = document.getElementById('categoryChart');
            if (catCtx) {
                if (categoryChartInstance) {
                    try { categoryChartInstance.destroy(); } catch (e) {}
                    categoryChartInstance = null;
                }

                const colors = ['#4f46e5', '#059669', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#64748b'];

                categoryChartInstance = new Chart(catCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: finalLabels.length ? finalLabels : ['لا توجد مبيعات'],
                        datasets: [{
                            data: finalValues.length ? finalValues : [1],
                            backgroundColor: finalValues.length ? colors.slice(0, finalLabels.length) : ['#e2e8f0'],
                            borderWidth: 2,
                            borderColor: '#ffffff'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    boxWidth: 12,
                                    font: { family: 'Cairo', size: 10, weight: 'bold' }
                                }
                            },
                            title: {
                                display: true,
                                text: '🏆 الأصناف الأعلى مبيعاً',
                                font: { family: 'Cairo', size: 13, weight: 'bold' },
                                color: '#1e293b'
                            },
                            tooltip: {
                                titleFont: { family: 'Cairo' },
                                bodyFont: { family: 'Cairo' }
                            }
                        },
                        cutout: '68%'
                    }
                });
            }
        }
        window.updateAnalysisCharts = updateAnalysisCharts;

        function toggleAnalysisDateSort() {
            analysisDateSortDir = (analysisDateSortDir === 'desc') ? 'asc' : 'desc';
            const sortIcon = document.getElementById('anSortDateIcon');
            if (sortIcon) {
                sortIcon.innerText = (analysisDateSortDir === 'desc') ? ' 🔽' : ' 🔼';
            }
            renderAnalysisTable();
        }
        window.toggleAnalysisDateSort = toggleAnalysisDateSort;

        // دالة تحديد الصف المطور مع مؤشر الدائرة الأملس
        function selectAnalysisRow(rowEl, invoiceId, type, productName) {
            if (!rowEl) return;
            const allRows = document.querySelectorAll('#analysisTableBody tr.an-row');
            allRows.forEach(r => r.classList.remove('selected-row'));

            rowEl.classList.add('selected-row');

            window.selectedAnalysisInvoice = {
                id: (invoiceId && invoiceId !== '-' && invoiceId !== 'undefined') ? invoiceId : null,
                type: type || 'بيع',
                product: productName || '',
                row: rowEl
            };
        }
        window.selectAnalysisRow = selectAnalysisRow;

        function renderAnalysisTable() {
            const tbody = document.getElementById('analysisTableBody');
            if (!tbody) return;

            // 1. جلب قيم الفلاتر والبحث
            const fromDate = document.getElementById('anDateFrom')?.value || '';
            const toDate = document.getElementById('anDateTo')?.value || '';
            const searchQuery = (document.getElementById('anSearchInput')?.value || '').trim().toLowerCase();
            const accFilter = document.getElementById('anAccount')?.value || 'all';
            const methodFilter = document.getElementById('anMethod')?.value || 'all';
            const catFilter = document.getElementById('anCategory')?.value || 'all';
            const whFilter = document.getElementById('anWarehouse')?.value || 'all';
            const userFilter = document.getElementById('anUser')?.value || 'all';

            // 2. تحديث وتعبئة القوائم الديناميكية
            const accSelect = document.getElementById('anAccount');
            if (accSelect && accSelect.options.length <= 1) {
                const partners = [...new Set((window.transactions || []).map(t => t.partner).filter(p => p && p !== '-'))].sort();
                partners.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.innerText = `👤 ${p}`;
                    accSelect.appendChild(opt);
                });
            }

            const methodSelect = document.getElementById('anMethod');
            if (methodSelect && methodSelect.options.length <= 1) {
                let dynamicMethods = [];
                if (typeof getPaymentMethods === 'function') {
                    dynamicMethods = getPaymentMethods().filter(m => m.active !== false).map(m => m.name);
                }
                const txMethods = [...new Set((window.transactions || []).map(t => t.method).filter(m => m && m !== '-'))];
                const allMethods = [...new Set([...dynamicMethods, ...txMethods, 'نقدي', 'آجل'])];
                allMethods.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.innerText = `💳 ${m}`;
                    methodSelect.appendChild(opt);
                });
            }

            const catSelect = document.getElementById('anCategory');
            if (catSelect && catSelect.options.length <= 1) {
                const cats = [...new Set((window.productsDB || []).map(p => p.category).filter(c => c && c.trim()))].sort();
                cats.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.innerText = `📦 ${c}`;
                    catSelect.appendChild(opt);
                });
            }

            const whSelect = document.getElementById('anWarehouse');
            if (whSelect && whSelect.options.length <= 1) {
                const warehouses = [...new Set((window.transactions || []).map(t => t.warehouse).filter(w => w && w !== '-'))].sort();
                warehouses.forEach(w => {
                    const opt = document.createElement('option');
                    opt.value = w;
                    opt.innerText = `🏢 ${w}`;
                    whSelect.appendChild(opt);
                });
            }

            const userSelect = document.getElementById('anUser');
            if (userSelect && userSelect.options.length <= 1) {
                const users = [...new Set((window.transactions || []).map(t => t.user).filter(u => u && u !== '-'))].sort();
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u;
                    opt.innerText = `🧑‍💼 ${u}`;
                    userSelect.appendChild(opt);
                });
            }

            // استعادة حالة الرسوم البيانية المحفوظة
            const chartsArea = document.getElementById('analysis-charts-area');
            const chartsBtnText = document.getElementById('anToggleChartsText');
            const chartsBtn = document.getElementById('anToggleChartsBtn');
            const savedChartsPref = typeof getStore === 'function' ? getStore('pos_an_charts') : null;
            if (chartsArea) {
                if (savedChartsPref === 'false') {
                    chartsArea.style.display = 'none';
                    if (chartsBtnText) chartsBtnText.innerText = 'إظهار الرسوم 📈';
                    if (chartsBtn) {
                        chartsBtn.style.background = '#eef2ff';
                        chartsBtn.style.color = '#4338ca';
                        chartsBtn.style.borderColor = '#6366f1';
                    }
                } else if (savedChartsPref === 'true') {
                    chartsArea.style.display = 'grid';
                    if (chartsBtnText) chartsBtnText.innerText = 'إخفاء الرسوم';
                    if (chartsBtn) {
                        chartsBtn.style.background = '#f8fafc';
                        chartsBtn.style.color = '#4f46e5';
                        chartsBtn.style.borderColor = '#c7d2fe';
                    }
                }
            }

            // 3. فلترة البيانات الأساسية (حركات البيع ومرتجع البيع فقط)
            let data = (window.transactions || []).filter(t => t.type && (t.type.includes('بيع') || t.type.includes('مرتجع بيع')));

            if (fromDate) data = data.filter(t => (t.dateISO || '') >= fromDate);
            if (toDate) data = data.filter(t => (t.dateISO || '') <= toDate);

            // فلتر البحث النصي الفوري
            if (searchQuery) {
                data = data.filter(t => {
                    const prod = (t.product || '').toLowerCase();
                    const partner = (t.partner || '').toLowerCase();
                    const invId = (t.invoiceId || '').toLowerCase();
                    const size = (t.size || '').toLowerCase();
                    const color = (t.color || '').toLowerCase();
                    const barcode = (t.barcode || '').toLowerCase();
                    return prod.includes(searchQuery) ||
                           partner.includes(searchQuery) ||
                           invId.includes(searchQuery) ||
                           size.includes(searchQuery) ||
                           color.includes(searchQuery) ||
                           barcode.includes(searchQuery);
                });
            }

            if (accFilter !== 'all') {
                data = data.filter(t => t.partner === accFilter);
            }

            if (methodFilter !== 'all') {
                data = data.filter(t => {
                    const m = (t.method || '').toLowerCase();
                    const target = methodFilter.toLowerCase();
                    return m.includes(target) || target.includes(m);
                });
            }

            if (catFilter !== 'all') {
                data = data.filter(t => {
                    const prod = (window.productsDB || []).find(p => p.name === t.product || p.id === t.productId || p.barcode === t.barcode);
                    return prod && prod.category === catFilter;
                });
            }

            if (whFilter !== 'all') {
                data = data.filter(t => t.warehouse === whFilter);
            }

            if (userFilter !== 'all') {
                data = data.filter(t => t.user === userFilter);
            }

            // 4. فرز التاريخ والوقت
            data.sort((a, b) => {
                const dtA = (a.dateISO || '') + ' ' + (a.timeISO || '00:00');
                const dtB = (b.dateISO || '') + ' ' + (b.timeISO || '00:00');
                return (analysisDateSortDir === 'desc') ? dtB.localeCompare(dtA) : dtA.localeCompare(dtB);
            });

            // 5. حساب الإجماليات الحسابية الدقيقة وساعات الذروة والعميل الأكثر شراءً
            let totalPeriodSales = 0;
            let totalPeriodProfit = 0;
            let totalPeriodCost = 0;
            let totalPeriodQty = 0;
            let totalReturnsAmount = 0;
            let totalReturnsCount = 0;

            const hourSales = {};
            const customerSalesMap = {};

            data.forEach(t => {
                const isReturn = t.type && t.type.includes('مرتجع');
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                const lineProfit = getTransactionReliableProfit(t);

                if (isReturn) {
                    totalPeriodSales -= total;
                    totalPeriodProfit -= lineProfit;
                    totalPeriodCost -= Math.max(0, total - lineProfit);
                    totalPeriodQty -= qty;
                    totalReturnsAmount += total;
                    totalReturnsCount++;
                } else {
                    totalPeriodSales += total;
                    totalPeriodProfit += lineProfit;
                    totalPeriodCost += Math.max(0, total - lineProfit);
                    totalPeriodQty += qty;
                }

                // حساب ساعة الذروة
                if (t.timeISO) {
                    const timeMatch = String(t.timeISO).match(/(\d{1,2}):(\d{2})/);
                    if (timeMatch) {
                        let h = parseInt(timeMatch[1], 10);
                        const isPM = String(t.timeISO).toLowerCase().includes('pm') || String(t.timeISO).includes('م');
                        const isAM = String(t.timeISO).toLowerCase().includes('am') || String(t.timeISO).includes('ص');
                        if (isPM && h < 12) h += 12;
                        if (isAM && h === 12) h = 0;
                        if (h >= 0 && h <= 23) {
                            if (!hourSales[h]) hourSales[h] = 0;
                            hourSales[h] += isReturn ? -total : total;
                        }
                    }
                }

                // حساب مبيعات العملاء لاكتشاف العميل الأكثر شراءً
                const partnerName = t.partner || 'عميل نقدي';
                if (!customerSalesMap[partnerName]) customerSalesMap[partnerName] = 0;
                customerSalesMap[partnerName] += isReturn ? -total : total;
            });

            // استخراج وتنسيق ساعة الذروة (Peak Hour)
            let peakHour = null;
            let maxHourSales = 0;
            Object.keys(hourSales).forEach(hKey => {
                const hVal = hourSales[hKey];
                if (hVal > maxHourSales) {
                    maxHourSales = hVal;
                    peakHour = parseInt(hKey, 10);
                }
            });

            const peakHourEl = document.getElementById('anPeakHourValue');
            if (peakHourEl) {
                if (peakHour !== null && maxHourSales > 0) {
                    const start12 = peakHour % 12 === 0 ? 12 : peakHour % 12;
                    const endH = (peakHour + 1) % 24;
                    const end12 = endH % 12 === 0 ? 12 : endH % 12;
                    const startPeriod = peakHour >= 12 ? 'م' : 'ص';
                    const endPeriod = endH >= 12 ? 'م' : 'ص';
                    peakHourEl.innerText = `${start12}:00 ${startPeriod} - ${end12}:00 ${endPeriod} (${maxHourSales.toLocaleString('en-US', { maximumFractionDigits: 0 })} ج.م)`;
                } else {
                    peakHourEl.innerText = 'ساعات متوازنة';
                }
            }

            // استخراج وتنسيق العميل الأكثر شراءً
            let topCustomerName = null;
            let maxCustSales = 0;
            const custKeys = Object.keys(customerSalesMap);
            // تفضيل العملاء المعرّفين بالاسم أولاً
            const namedPool = custKeys.filter(k => k && k !== 'عميل نقدي' && k !== '-' && customerSalesMap[k] > 0);
            const activePool = namedPool.length > 0 ? namedPool : custKeys.filter(k => customerSalesMap[k] > 0);
            activePool.forEach(cKey => {
                if (customerSalesMap[cKey] > maxCustSales) {
                    maxCustSales = customerSalesMap[cKey];
                    topCustomerName = cKey;
                }
            });

            const topCustEl = document.getElementById('anTopCustomerValue');
            if (topCustEl) {
                if (topCustomerName && maxCustSales > 0) {
                    topCustEl.innerText = `${topCustomerName} (${maxCustSales.toLocaleString('en-US', { maximumFractionDigits: 0 })} ج.م)`;
                } else {
                    topCustEl.innerText = 'عميل نقدي';
                }
            }

            const profitMarginPct = totalPeriodSales > 0 ? ((totalPeriodProfit / totalPeriodSales) * 100).toFixed(1) : '0.0';

            const anTotalSalesEl = document.getElementById('anTotalSales');
            const anTotalProfitEl = document.getElementById('anTotalProfit');
            const anProfitMarginEl = document.getElementById('anProfitMargin');

            if (anTotalSalesEl) anTotalSalesEl.innerText = totalPeriodSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (anTotalProfitEl) anTotalProfitEl.innerText = totalPeriodProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (anProfitMarginEl) anProfitMarginEl.innerText = profitMarginPct + '%';

            const kpiSales = document.getElementById('kpi-total-sales');
            const kpiProfit = document.getElementById('kpi-total-profit');
            const kpiMargin = document.getElementById('kpi-profit-margin');

            if (kpiSales) kpiSales.innerText = totalPeriodSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (kpiProfit) kpiProfit.innerText = totalPeriodProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (kpiMargin) kpiMargin.innerText = profitMarginPct + '%';

            // 6. تحديث الرسوم البيانية والكروت
            updateAnalysisCharts(data);

            // 7. توجيه العرض حسب النمط الحالي
            if (currentAnalysisMode === 'returns') {
                renderMostReturningCustomers();
                return;
            }
            if (currentAnalysisMode === 'customers') {
                renderCustomerAnalysisReport(data, totalPeriodSales);
                return;
            }
            if (currentAnalysisMode === 'categories') {
                renderCategoryAnalysisReport(data, totalPeriodSales);
                return;
            }

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:35px; font-weight:bold; color:#64748b;">لا توجد حركات بيع أو مرتجعات مطابقة للفترة المحددة 🔍</td></tr>';
                return;
            }

            const rowsHtml = [];

            // 8. بناء الجدول - النمط التفصيلي (Detailed Mode)
            if (currentAnalysisMode === 'detailed') {
                data.forEach((t, idx) => {
                    const isReturn = t.type && t.type.includes('مرتجع');
                    const qty = Math.abs(parseFloat(t.qty) || 0);
                    const price = parseFloat(t.price) || 0;
                    const total = Math.abs(parseFloat(t.total) || (price * qty) || 0);
                    const lineProfit = getTransactionReliableProfit(t);
                    const unitCost = qty > 0 ? Math.max(0, (total - lineProfit) / qty) : 0;
                    const displayProfit = isReturn ? -lineProfit : lineProfit;
                    const profitMargin = total > 0 ? ((lineProfit / total) * 100).toFixed(1) : '0.0';
                    const profitShare = totalPeriodSales > 0 ? ((total / totalPeriodSales) * 100).toFixed(1) : '0.0';

                    const rowClass = isReturn ? 'return-row' : (displayProfit < 0 ? 'loss-row' : '');
                    const profitColor = isReturn ? '#ef4444' : (displayProfit < 0 ? '#ef4444' : '#10b981');
                    const typeBadge = isReturn 
                        ? `<span class="badge-return" style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">↩️ مرتجع</span>`
                        : `<span class="badge-sale" style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">📤 بيع</span>`;

                    const isSelected = idx === 0;
                    const safeProdName = (t.product || '').replace(/'/g, "\\'");
                    if (isSelected) {
                        window.selectedAnalysisInvoice = {
                            id: t.invoiceId,
                            type: t.type || 'بيع',
                            product: t.product
                        };
                    }

                    rowsHtml.push(`
                        <tr class="an-row ${rowClass} ${isSelected ? 'selected-row' : ''}"
                            data-invoice="${t.invoiceId || ''}"
                            data-type="${t.type || 'بيع'}"
                            data-product="${safeProdName}"
                            onclick="selectAnalysisRow(this, '${t.invoiceId}', '${t.type}', '${safeProdName}')"
                            ondblclick="viewInvoiceItems('${t.invoiceId}', '${t.type}')">
                            <td style="text-align:center;">
                                <div class="an-radio-circle" title="تحديد الفاتورة"></div>
                            </td>
                            <td style="font-weight:900; color:#64748b;">${idx + 1}</td>
                            <td style="white-space:nowrap;">
                                <div style="font-weight:800; color:#1e293b;">${t.dateISO || '-'}</div>
                                <div style="font-size:0.75rem; color:#94a3b8;">${t.timeISO || '-'}</div>
                            </td>
                            <td style="font-weight:900; color:#4f46e5;">
                                <span style="background:#eef2ff; padding:3px 8px; border-radius:6px; font-size:0.85rem;">#${t.invoiceId || '-'}</span>
                            </td>
                            <td>${typeBadge}</td>
                            <td style="font-weight:800; color:#334155;">${t.partner || 'عميل نقدي'}</td>
                            <td>
                                <div style="font-weight:900; color:#1e293b;">${isReturn ? '↩️ ' : ''}${t.product}</div>
                                ${(t.size || t.color) ? `<div style="font-size:0.75rem; color:#6366f1; font-weight:bold; margin-top:2px;">${t.size ? `[مقاس: ${t.size}] ` : ''}${t.color ? `(لون: ${t.color})` : ''}</div>` : ''}
                            </td>
                            <td style="font-weight:900; text-align:center; color:${isReturn ? '#ef4444' : '#1e293b'};">
                                ${isReturn ? '-' : ''}${qty} <small style="color:#64748b; font-weight:normal;">${t.unit || 'قطعة'}</small>
                            </td>
                            <td style="font-weight:800;">${price.toFixed(2)}</td>
                            <td style="color:#64748b; font-weight:600;">${unitCost.toFixed(2)}</td>
                            <td class="profit-col" style="color:${profitColor}; font-weight:900; font-size:0.95rem;">
                                ${isReturn ? '-' : (displayProfit >= 0 ? '+' : '')}${displayProfit.toFixed(2)}
                            </td>
                            <td class="profit-col" style="font-weight:800; color:#4f46e5;">${profitMargin}%</td>
                            <td class="profit-col" style="color:#64748b; font-weight:600;">${profitShare}%</td>
                        </tr>
                    `);
                });
            } else {
                // 9. بناء الجدول - النمط التجميعي (Summary Mode)
                const groups = {};
                data.forEach(t => {
                    const isReturn = t.type && t.type.includes('مرتجع');
                    const prodName = t.product || 'صنف غير محدد';
                    if (!groups[prodName]) {
                        groups[prodName] = {
                            name: prodName,
                            qty: 0,
                            salesQty: 0,
                            returnQty: 0,
                            totalSales: 0,
                            totalReturns: 0,
                            netTotal: 0,
                            profit: 0,
                            cost: 0,
                            unit: t.unit || 'قطعة',
                            latestInvoiceId: t.invoiceId || '',
                            latestInvoiceType: t.type || 'بيع'
                        };
                    } else if (t.invoiceId) {
                        groups[prodName].latestInvoiceId = t.invoiceId;
                        groups[prodName].latestInvoiceType = t.type || 'بيع';
                    }

                    const qty = Math.abs(parseFloat(t.qty) || 0);
                    const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                    const lineProfit = getTransactionReliableProfit(t);
                    const lineCost = Math.max(0, total - lineProfit);

                    if (isReturn) {
                        groups[prodName].qty -= qty;
                        groups[prodName].returnQty += qty;
                        groups[prodName].totalReturns += total;
                        groups[prodName].netTotal -= total;
                        groups[prodName].profit -= lineProfit;
                        groups[prodName].cost -= lineCost;
                    } else {
                        groups[prodName].qty += qty;
                        groups[prodName].salesQty += qty;
                        groups[prodName].totalSales += total;
                        groups[prodName].netTotal += total;
                        groups[prodName].profit += lineProfit;
                        groups[prodName].cost += lineCost;
                    }
                });

                const sortedGroups = Object.values(groups).sort((a, b) => b.netTotal - a.netTotal);

                sortedGroups.forEach((g, idx) => {
                    const avgPrice = g.qty !== 0 ? g.netTotal / g.qty : 0;
                    const avgCost = g.qty !== 0 ? g.cost / g.qty : 0;
                    const profitMargin = g.netTotal > 0 ? ((g.profit / g.netTotal) * 100).toFixed(1) : '0.0';
                    const profitShare = totalPeriodSales > 0 ? ((g.netTotal / totalPeriodSales) * 100).toFixed(1) : '0.0';
                    const isLoss = g.profit < 0;

                    const isSelected = idx === 0;
                    const safeProdName = (g.name || '').replace(/'/g, "\\'");
                    if (isSelected) {
                        window.selectedAnalysisInvoice = {
                            id: g.latestInvoiceId || null,
                            type: g.latestInvoiceType || 'بيع',
                            product: g.name
                        };
                    }

                    rowsHtml.push(`
                        <tr class="an-row ${isLoss ? 'loss-row' : ''} ${isSelected ? 'selected-row' : ''}"
                            data-invoice="${g.latestInvoiceId || ''}"
                            data-type="${g.latestInvoiceType || 'بيع'}"
                            data-product="${safeProdName}"
                            onclick="selectAnalysisRow(this, '${g.latestInvoiceId || ''}', '${g.latestInvoiceType || 'بيع'}', '${safeProdName}')"
                            ondblclick="viewSelectedAnalysisInvoice()">
                            <td style="text-align:center;"><div class="an-radio-circle" title="تحديد الصنف"></div></td>
                            <td style="font-weight:900; color:#64748b;">${idx + 1}</td>
                            <td style="color:#64748b;">-</td>
                            <td style="font-weight:800; color:#4f46e5;">${g.latestInvoiceId ? `<span style="background:#eef2ff; padding:2px 6px; border-radius:4px; font-size:0.8rem;">#${g.latestInvoiceId}</span>` : '-'}</td>
                            <td><span style="background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:6px; font-weight:bold; font-size:0.8rem;">📦 تجميعي</span></td>
                            <td style="color:#64748b;">-</td>
                            <td style="font-weight:900; color:#1e293b; font-size:0.95rem;">📦 ${g.name}</td>
                            <td style="font-weight:900; text-align:center; color:#1e293b;">
                                ${g.qty} <small style="color:#64748b; font-weight:normal;">${g.unit}</small>
                                ${g.returnQty > 0 ? `<div style="font-size:0.72rem; color:#ef4444; font-weight:bold;">(-${g.returnQty} مرتجع)</div>` : ''}
                            </td>
                            <td style="font-weight:800;">${avgPrice.toFixed(2)}</td>
                            <td style="color:#64748b; font-weight:600;">${avgCost.toFixed(2)}</td>
                            <td class="profit-col" style="color:${isLoss ? '#ef4444' : '#10b981'}; font-weight:900; font-size:1rem;">
                                ${g.profit >= 0 ? '+' : ''}${g.profit.toFixed(2)}
                            </td>
                            <td class="profit-col" style="font-weight:800; color:#4f46e5;">${profitMargin}%</td>
                            <td class="profit-col" style="color:#64748b; font-weight:600;">${profitShare}%</td>
                        </tr>
                    `);
                });
            }

            // إدراج الجدول دفعة واحدة لسرعة قصوى وأداء صاروخي
            tbody.innerHTML = rowsHtml.join('');
            applyAnalysisColumnVisibility();
        }
        window.renderAnalysisTable = renderAnalysisTable;

        // --- 1. تقرير كبار العملاء ومسحوباتهم ومديونياتهم التنازلية ---
        function renderCustomerAnalysisReport(data, totalPeriodSales) {
            const tbody = document.getElementById('analysisTableBody');
            if (!tbody) return;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:35px; font-weight:bold; color:#64748b;">لا توجد حركات بيع للعملاء في الفترة المحددة 🔍</td></tr>';
                return;
            }

            const custGroups = {};
            const invoiceTracker = new Set();

            data.forEach(t => {
                const partner = t.partner || 'عميل نقدي';
                const isReturn = t.type && t.type.includes('مرتجع');
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                const profit = getTransactionReliableProfit(t);

                if (!custGroups[partner]) {
                    custGroups[partner] = {
                        name: partner,
                        grossPurchases: 0,
                        totalReturns: 0,
                        netPurchases: 0,
                        totalQty: 0,
                        profit: 0,
                        invoices: new Set(),
                        paid: 0,
                        remaining: 0,
                        products: {},
                        lastDate: t.dateISO || '-',
                        latestInvoiceId: t.invoiceId || '',
                        latestType: t.type || 'بيع'
                    };
                } else if (t.invoiceId) {
                    custGroups[partner].latestInvoiceId = t.invoiceId;
                    custGroups[partner].latestType = t.type || 'بيع';
                }

                if (isReturn) {
                    custGroups[partner].totalReturns += total;
                    custGroups[partner].netPurchases -= total;
                    custGroups[partner].totalQty -= qty;
                    custGroups[partner].profit -= profit;
                } else {
                    custGroups[partner].grossPurchases += total;
                    custGroups[partner].netPurchases += total;
                    custGroups[partner].totalQty += qty;
                    custGroups[partner].profit += profit;
                }

                if (t.invoiceId && t.invoiceId !== '-') {
                    custGroups[partner].invoices.add(t.invoiceId);
                    
                    if (t.isInvoiceHead || !invoiceTracker.has(t.invoiceId)) {
                        invoiceTracker.add(t.invoiceId);
                        const invTotal = parseFloat(t.invoiceGrandTotal) || total;
                        const paid = parseFloat(t.paidAmount);
                        if (!isNaN(paid) && paid > 0) {
                            custGroups[partner].paid += paid;
                            const rem = Math.max(0, invTotal - paid);
                            custGroups[partner].remaining += rem;
                        } else {
                            if (t.method && (t.method.includes('آجل') || t.method.includes('اجل') || t.method.includes('ذمم'))) {
                                custGroups[partner].remaining += invTotal;
                            } else {
                                custGroups[partner].paid += invTotal;
                            }
                        }
                    }
                }

                if (t.product) {
                    custGroups[partner].products[t.product] = (custGroups[partner].products[t.product] || 0) + qty;
                }
                if (t.dateISO && t.dateISO > custGroups[partner].lastDate) {
                    custGroups[partner].lastDate = t.dateISO;
                }
            });

            // ترتيب العملاء تنازلياً من الأكثر سحباً للأقل سحباً
            const sortedCustomers = Object.values(custGroups).sort((a, b) => b.netPurchases - a.netPurchases);

            const rowsHtml = [];
            sortedCustomers.forEach((c, idx) => {
                const isSelected = idx === 0;
                const safeCustName = (c.name || '').replace(/'/g, "\\'");
                if (isSelected) {
                    window.selectedAnalysisInvoice = {
                        id: c.latestInvoiceId || null,
                        type: c.latestType || 'بيع',
                        product: safeCustName
                    };
                }

                // أكثر صنفين طلباً للعميل
                const topProdsList = Object.keys(c.products).sort((x, y) => c.products[y] - c.products[x]);
                const displayTopProds = topProdsList.length > 2 
                    ? topProdsList.slice(0, 2).join(' + ') + ` (+${topProdsList.length - 2} أصناف)`
                    : (topProdsList.join(' + ') || 'متنوع');

                const share = (totalPeriodSales > 0 && c.netPurchases > 0) ? ((c.netPurchases / totalPeriodSales) * 100).toFixed(1) : '0.0';
                const invCount = c.invoices.size || 1;

                // تمييز ترتيب المراكز الأولى ببادجات احترافية
                let rankBadge = `<span style="font-weight:900; color:#64748b;">${idx + 1}</span>`;
                if (idx === 0) rankBadge = `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">🥇 الأول</span>`;
                else if (idx === 1) rankBadge = `<span style="background:#f1f5f9; color:#334155; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">🥈 الثاني</span>`;
                else if (idx === 2) rankBadge = `<span style="background:#ffedd5; color:#c2410c; padding:2px 8px; border-radius:6px; font-weight:900; font-size:0.82rem;">🥉 الثالث</span>`;

                const hasRemaining = c.remaining > 0;

                rowsHtml.push(`
                    <tr class="an-row ${isSelected ? 'selected-row' : ''}"
                        data-invoice="${c.latestInvoiceId || ''}"
                        data-type="${c.latestType || 'بيع'}"
                        data-product="${safeCustName}"
                        onclick="selectAnalysisRow(this, '${c.latestInvoiceId || ''}', '${c.latestType || 'بيع'}', '${safeCustName}')"
                        ondblclick="filterAndShowCustomerInvoices('${safeCustName}')"
                        title="انقر نقراً مزدوجاً للانتقال فوراً لكافة فواتير هذا العميل">
                        <td style="text-align:center;"><div class="an-radio-circle" title="تحديد"></div></td>
                        <td style="text-align:center;">${rankBadge}</td>
                        <td style="white-space:nowrap; font-weight:bold; color:#1e293b;">${c.lastDate}</td>
                        <td style="font-weight:800; color:#4f46e5;">
                            ${c.latestInvoiceId ? `<span style="background:#eef2ff; padding:2px 6px; border-radius:4px; font-size:0.8rem;">#${c.latestInvoiceId}</span>` : '-'}
                        </td>
                        <td>
                            <span style="background:${idx < 3 ? '#ecfdf5' : '#f8fafc'}; color:${idx < 3 ? '#047857' : '#475569'}; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">
                                ${idx === 0 ? '👑 عميل VIP' : (idx < 5 ? '⭐ عميل مميز' : '👤 عميل')}
                            </span>
                        </td>
                        <td style="font-weight:900; color:#1e293b; font-size:0.92rem;">👤 ${c.name}</td>
                        <td style="font-weight:700; color:#4338ca; font-size:0.85rem;" title="${displayTopProds}">📦 ${displayTopProds}</td>
                        <td style="font-weight:900; text-align:center; color:#1e293b;">${c.totalQty} قطعة</td>
                        <td style="font-weight:900; color:#059669; font-size:0.95rem;">${c.netPurchases.toFixed(2)}</td>
                        <td style="font-weight:800; color:#2563eb;">${c.paid.toFixed(2)}</td>
                        <td style="font-weight:900; color:${hasRemaining ? '#ef4444' : '#64748b'};">
                            ${hasRemaining ? `<span style="background:#fee2e2; padding:2px 6px; border-radius:4px;">${c.remaining.toFixed(2)} (آجل)</span>` : '0.00'}
                        </td>
                        <td class="profit-col" style="font-weight:900; color:#10b981;">+${c.profit.toFixed(2)}</td>
                        <td class="profit-col" style="font-weight:800; color:#4f46e5;">${share}% (${invCount} فاتورة)</td>
                    </tr>
                `);
            });

            tbody.innerHTML = rowsHtml.join('');
            applyAnalysisColumnVisibility();
        }
        window.renderCustomerAnalysisReport = renderCustomerAnalysisReport;

        // دالة انتقال سريعة لفواتير العميل عند النقر المزدوج
        function filterAndShowCustomerInvoices(customerName) {
            const searchInput = document.getElementById('anSearchInput');
            if (searchInput) {
                searchInput.value = customerName;
                const clearBtn = document.getElementById('anSearchClearBtn');
                if (clearBtn) clearBtn.style.display = 'flex';
                setAnalysisMode('detailed');
                if (typeof showToast === 'function') {
                    showToast(`🔍 تم الانتقال لفواتير العميل: ${customerName}`);
                }
            }
        }
        window.filterAndShowCustomerInvoices = filterAndShowCustomerInvoices;

        // --- 2. تقرير تصنيفات البضاعة والأصناف ---
        function renderCategoryAnalysisReport(data, totalPeriodSales) {
            const tbody = document.getElementById('analysisTableBody');
            if (!tbody) return;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:35px; font-weight:bold; color:#64748b;">لا توجد مبيعات للتصنيفات في الفترة المحددة 🔍</td></tr>';
                return;
            }

            const catGroups = {};

            data.forEach(t => {
                const isReturn = t.type && t.type.includes('مرتجع');
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const total = Math.abs(parseFloat(t.total) || (parseFloat(t.price) * qty) || 0);
                const profit = getTransactionReliableProfit(t);
                const cost = Math.max(0, total - profit);

                const prod = (window.productsDB || []).find(p => p.name === t.product || p.id === t.productId || p.barcode === t.barcode);
                const catName = (prod && prod.category && prod.category.trim()) ? prod.category.trim() : 'عام / غير مصنف';

                if (!catGroups[catName]) {
                    catGroups[catName] = {
                        name: catName,
                        qty: 0,
                        totalSales: 0,
                        cost: 0,
                        profit: 0,
                        products: new Set(),
                        invoices: new Set(),
                        latestInvoiceId: t.invoiceId || '',
                        latestType: t.type || 'بيع'
                    };
                } else if (t.invoiceId) {
                    catGroups[catName].latestInvoiceId = t.invoiceId;
                    catGroups[catName].latestType = t.type || 'بيع';
                }

                if (isReturn) {
                    catGroups[catName].qty -= qty;
                    catGroups[catName].totalSales -= total;
                    catGroups[catName].cost -= cost;
                    catGroups[catName].profit -= profit;
                } else {
                    catGroups[catName].qty += qty;
                    catGroups[catName].totalSales += total;
                    catGroups[catName].cost += cost;
                    catGroups[catName].profit += profit;
                }

                if (t.product) catGroups[catName].products.add(t.product);
                if (t.invoiceId) catGroups[catName].invoices.add(t.invoiceId);
            });

            // ترتيب التصنيفات تنازلياً حسب إجمالي المبيعات
            const sortedCategories = Object.values(catGroups).sort((a, b) => b.totalSales - a.totalSales);

            const rowsHtml = [];
            sortedCategories.forEach((cat, idx) => {
                const isSelected = idx === 0;
                const safeCatName = (cat.name || '').replace(/'/g, "\\'");
                if (isSelected) {
                    window.selectedAnalysisInvoice = {
                        id: cat.latestInvoiceId || null,
                        type: cat.latestType || 'بيع',
                        product: safeCatName
                    };
                }

                const margin = (cat.totalSales > 0) ? ((cat.profit / cat.totalSales) * 100).toFixed(1) : '0.0';
                const share = (totalPeriodSales > 0 && cat.totalSales > 0) ? ((cat.totalSales / totalPeriodSales) * 100).toFixed(1) : '0.0';

                rowsHtml.push(`
                    <tr class="an-row ${isSelected ? 'selected-row' : ''}"
                        data-invoice="${cat.latestInvoiceId || ''}"
                        data-type="${cat.latestType || 'بيع'}"
                        data-product="${safeCatName}"
                        onclick="selectAnalysisRow(this, '${cat.latestInvoiceId || ''}', '${cat.latestType || 'بيع'}', '${safeCatName}')"
                        ondblclick="filterAndShowCategorySales('${safeCatName}')"
                        title="انقر نقراً مزدوجاً لتصفية المبيعات بهذا التصنيف">
                        <td style="text-align:center;"><div class="an-radio-circle" title="تحديد"></div></td>
                        <td style="font-weight:900; color:#64748b;">${idx + 1}</td>
                        <td style="color:#64748b;">-</td>
                        <td style="font-weight:800; color:#4f46e5;">
                            ${cat.latestInvoiceId ? `<span style="background:#eef2ff; padding:2px 6px; border-radius:4px; font-size:0.8rem;">#${cat.latestInvoiceId}</span>` : '-'}
                        </td>
                        <td><span style="background:#ede9fe; color:#6d28d9; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">🏷️ تصنيف</span></td>
                        <td style="font-weight:800; color:#475569;">${cat.products.size} أصناف بالتصنيف</td>
                        <td style="font-weight:900; color:#1e293b; font-size:0.95rem;">📦 ${cat.name}</td>
                        <td style="font-weight:900; text-align:center; color:#1e293b;">${cat.qty} قطعة</td>
                        <td style="font-weight:900; color:#059669; font-size:0.95rem;">${cat.totalSales.toFixed(2)}</td>
                        <td style="color:#64748b; font-weight:600;">${cat.cost.toFixed(2)}</td>
                        <td class="profit-col" style="color:#10b981; font-weight:900; font-size:1rem;">+${cat.profit.toFixed(2)}</td>
                        <td class="profit-col" style="font-weight:800; color:#4f46e5;">${margin}%</td>
                        <td class="profit-col" style="color:#64748b; font-weight:600;">${share}% (${cat.invoices.size} فاتورة)</td>
                    </tr>
                `);
            });

            tbody.innerHTML = rowsHtml.join('');
            applyAnalysisColumnVisibility();
        }
        window.renderCategoryAnalysisReport = renderCategoryAnalysisReport;

        // دالة تصفية سريعة بالتصنيف عند النقر المزدوج
        function filterAndShowCategorySales(categoryName) {
            const catSelect = document.getElementById('anCategory');
            if (catSelect) {
                catSelect.value = categoryName;
                setAnalysisMode('summary');
                if (typeof showToast === 'function') {
                    showToast(`📦 تم تصفية المبيعات بالتصنيف: ${categoryName}`);
                }
            }
        }
        window.filterAndShowCategorySales = filterAndShowCategorySales;

        // --- تخصيص أعمدة تحليل المبيعات ---
        var analysisColumnVisibility = JSON.parse((typeof getStore === 'function' ? getStore('pos_an_cols') : null) || '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true,"11":true,"12":true}');

        function toggleAnalysisColumn(index, isVisible) {
            analysisColumnVisibility[index] = isVisible;
            if (typeof setStore === 'function') {
                setStore('pos_an_cols', JSON.stringify(analysisColumnVisibility));
            }
            applyAnalysisColumnVisibility();
        }
        window.toggleAnalysisColumn = toggleAnalysisColumn;

        function applyAnalysisColumnVisibility() {
            const table = document.querySelector('#analysis-section .invoice-table');
            if (!table) return;

            const theadRows = table.querySelectorAll('thead th');
            const tbodyRows = table.querySelectorAll('tbody tr');

            theadRows.forEach((th, i) => {
                th.style.display = (analysisColumnVisibility[i] !== undefined) ? (analysisColumnVisibility[i] ? '' : 'none') : '';
            });

            tbodyRows.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                tds.forEach((td, i) => {
                    td.style.display = (analysisColumnVisibility[i] !== undefined) ? (analysisColumnVisibility[i] ? '' : 'none') : '';
                });
            });
        }
        window.applyAnalysisColumnVisibility = applyAnalysisColumnVisibility;

        function showAnalysisColumnCustomizer() {
            const cols = [
                { id: 0, name: "تحديد" },
                { id: 1, name: "#" },
                { id: 2, name: "التاريخ والوقت" },
                { id: 3, name: "رقم الفاتورة" },
                { id: 4, name: "نوع العملية" },
                { id: 5, name: "العميل" },
                { id: 6, name: "الصنف والمواصفات" },
                { id: 7, name: "الكمية" },
                { id: 8, name: "سعر البيع" },
                { id: 9, name: "التكلفة" },
                { id: 10, name: "صافي الربح" },
                { id: 11, name: "% لهامش الربح" },
                { id: 12, name: "% لمبيعات الفترة" }
            ];

            let html = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; padding:15px 0;">`;
            cols.forEach(c => {
                const checked = analysisColumnVisibility[c.id] ? 'checked' : '';
                html += `<label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:8px 12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; font-size:0.88rem; font-weight:bold; color:#334155; transition: 0.2s;" onmouseover="this.style.background='#f1f5f9';" onmouseout="this.style.background='#f8fafc';">
                            <input type="checkbox" ${checked} onchange="toggleAnalysisColumn(${c.id}, this.checked)" style="width:16px; height:16px; accent-color:#4f46e5; cursor:pointer;"> ${c.name}
                         </label>`;
            });
            html += `</div>`;

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); z-index: 12000; display: flex; align-items: center; justify-content: center; direction: rtl; font-family: 'Cairo', sans-serif;`;
            modal.innerHTML = `
                <div style="background: white; width: 440px; max-width: 90%; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.4); padding: 22px; display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">
                        <h3 style="margin:0; font-size:1.1rem; font-weight:900; color:#1e293b; display:flex; align-items:center; gap:8px;">⚙️ تخصيص أعمدة التحليل</h3>
                        <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:#94a3b8; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%;">&times;</button>
                    </div>
                    ${html}
                    <button style="width:100%; height:40px; background:linear-gradient(135deg, #4f46e5, #4338ca); color:white; border:none; border-radius:10px; font-weight:900; font-size:0.9rem; cursor:pointer; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);" onclick="this.closest('.modal-overlay').remove()">حفظ وإغلاق</button>
                </div>
            `;
            document.body.appendChild(modal);
        }
        window.showAnalysisColumnCustomizer = showAnalysisColumnCustomizer;

        function viewSelectedAnalysisInvoice() {
            let invoiceId = '';
            let type = 'بيع';

            // 1. فحص الكائن العالمي المسجل عند اختيار الصف
            if (window.selectedAnalysisInvoice && window.selectedAnalysisInvoice.id) {
                invoiceId = window.selectedAnalysisInvoice.id;
                type = window.selectedAnalysisInvoice.type || 'بيع';
            }

            // 2. إذا لم يكن مسجلاً، فحص الصف النشط بصرياً في الجدول
            if (!invoiceId) {
                const selectedRow = document.querySelector('#analysisTableBody tr.selected-row');
                if (selectedRow) {
                    invoiceId = selectedRow.getAttribute('data-invoice');
                    type = selectedRow.getAttribute('data-type') || 'بيع';
                }
            }

            // 3. التحديد التلقائي للصف الأول كحل ذكي وسريع إذا لم يحدد المستخدم أي صف بعد
            if (!invoiceId) {
                const firstRow = document.querySelector('#analysisTableBody tr.an-row');
                if (firstRow) {
                    firstRow.click();
                    if (window.selectedAnalysisInvoice && window.selectedAnalysisInvoice.id) {
                        invoiceId = window.selectedAnalysisInvoice.id;
                        type = window.selectedAnalysisInvoice.type || 'بيع';
                    }
                }
            }

            // 4. فتح الفاتورة إذا كان المعرف صالحاً
            if (invoiceId && invoiceId !== '-' && invoiceId !== 'undefined' && typeof viewInvoiceItems === 'function') {
                viewInvoiceItems(invoiceId, type);
            } else {
                // إذا كنا في النمط التجميعي ولم توجد فاتورة، ننتقل للنمط التفصيلي المفلتر بهذا الصنف لتسهيل الوصول للفواتير
                if (currentAnalysisMode === 'summary' && window.selectedAnalysisInvoice && window.selectedAnalysisInvoice.product) {
                    const searchInput = document.getElementById('anSearchInput');
                    if (searchInput) {
                        searchInput.value = window.selectedAnalysisInvoice.product;
                        const clearBtn = document.getElementById('anSearchClearBtn');
                        if (clearBtn) clearBtn.style.display = 'flex';
                        setAnalysisMode('detailed');
                        if (typeof showToast === 'function') {
                            showToast(`🔍 تم الانتقال للفواتير التفصيلية للصنف: ${window.selectedAnalysisInvoice.product}`);
                        }
                        return;
                    }
                }

                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({ type: 'warning', titleText: '⚠️ تنبيه', msg: 'يرجى اختيار وتحديد فاتورة من الجدول أولاً لعرض تفاصيلها.' });
                } else {
                    alert('يرجى اختيار وتحديد فاتورة من الجدول أولاً.');
                }
            }
        }
        window.viewSelectedAnalysisInvoice = viewSelectedAnalysisInvoice;

        function applyAnalysisPeriodFilter(period) {
            const fromInput = document.getElementById('anDateFrom');
            const toInput = document.getElementById('anDateTo');
            const customContainer = document.getElementById('anCustomDates');

            const today = new Date();
            const todayStr = today.toLocaleDateString('en-CA');

            if (period === 'custom') {
                if (customContainer) {
                    customContainer.style.background = '#e0e7ff';
                    customContainer.style.borderColor = '#6366f1';
                }
                if (fromInput) fromInput.focus();
                return;
            } else {
                if (customContainer) {
                    customContainer.style.background = '#f1f5f9';
                    customContainer.style.borderColor = '#e2e8f0';
                }
            }

            if (period === 'today') {
                fromInput.value = todayStr;
                toInput.value = todayStr;
            } else if (period === 'yesterday') {
                const yest = new Date();
                yest.setDate(yest.getDate() - 1);
                fromInput.value = yest.toLocaleDateString('en-CA');
                toInput.value = yest.toLocaleDateString('en-CA');
            } else if (period === 'thisweek') {
                const day = today.getDay();
                const start = new Date(today);
                start.setDate(today.getDate() - day);
                fromInput.value = start.toLocaleDateString('en-CA');
                toInput.value = todayStr;
            } else if (period === 'lastweek') {
                const day = today.getDay();
                const start = new Date(today);
                start.setDate(today.getDate() - day - 7);
                const end = new Date(today);
                end.setDate(today.getDate() - day - 1);
                fromInput.value = start.toLocaleDateString('en-CA');
                toInput.value = end.toLocaleDateString('en-CA');
            } else if (period === 'thismonth') {
                const first = new Date(today.getFullYear(), today.getMonth(), 1);
                fromInput.value = first.toLocaleDateString('en-CA');
                toInput.value = todayStr;
            } else if (period === 'lastmonth') {
                const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const last = new Date(today.getFullYear(), today.getMonth(), 0);
                fromInput.value = first.toLocaleDateString('en-CA');
                toInput.value = last.toLocaleDateString('en-CA');
            } else if (period === 'thisyear') {
                const first = new Date(today.getFullYear(), 0, 1);
                fromInput.value = first.toLocaleDateString('en-CA');
                toInput.value = todayStr;
            } else if (period === 'lastyear') {
                const first = new Date(today.getFullYear() - 1, 0, 1);
                const last = new Date(today.getFullYear() - 1, 11, 31);
                fromInput.value = first.toLocaleDateString('en-CA');
                toInput.value = last.toLocaleDateString('en-CA');
            } else if (period === 'all') {
                fromInput.value = '';
                toInput.value = '';
            }

            renderAnalysisTable();
            if (typeof saveCurrentTabState === 'function') saveCurrentTabState();
        }
        window.applyAnalysisPeriodFilter = applyAnalysisPeriodFilter;

        // تصدير فائق واحترافي لملفات Excel (.xlsx) عبر SheetJS
        function exportAnalysisToExcel() {
            try {
                if (typeof XLSX === 'undefined') {
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({ type: 'warning', titleText: '⚠️ تنبيه', msg: 'مكتبة Excel غير محملة.' });
                    } else {
                        alert('مكتبة Excel غير محملة.');
                    }
                    return;
                }

                const table = document.querySelector('#analysis-section .invoice-table');
                if (!table) return;

                const rows = table.querySelectorAll('tbody tr');
                if (rows.length === 0 || (rows.length === 1 && rows[0].innerText.includes('لا توجد'))) {
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({ type: 'warning', titleText: '⚠️ تنبيه', msg: 'لا توجد بيانات متاحة للتصدير في هذه الفترة.' });
                    } else {
                        alert('لا توجد بيانات متاحة للتصدير في هذه الفترة.');
                    }
                    return;
                }

                const exportData = [];
                const isDetailed = (currentAnalysisMode === 'detailed');
                const isReturns = (currentAnalysisMode === 'returns');
                const isCustomers = (currentAnalysisMode === 'customers');
                const isCategories = (currentAnalysisMode === 'categories');

                rows.forEach((r, idx) => {
                    const cells = r.querySelectorAll('td');
                    if (cells.length < 10) return;

                    if (isDetailed) {
                        exportData.push({
                            '#': cells[1]?.innerText?.trim() || (idx + 1),
                            'التاريخ والوقت': cells[2]?.innerText?.trim() || '-',
                            'رقم الفاتورة': cells[3]?.innerText?.trim() || '-',
                            'نوع العملية': cells[4]?.innerText?.trim() || '-',
                            'العميل': cells[5]?.innerText?.trim() || '-',
                            'الصنف والمواصفات': cells[6]?.innerText?.replace(/\n/g, ' ')?.trim() || '-',
                            'الكمية': cells[7]?.innerText?.trim() || '0',
                            'سعر البيع': cells[8]?.innerText?.trim() || '0',
                            'التكلفة': cells[9]?.innerText?.trim() || '0',
                            'صافي الربح': cells[10]?.innerText?.trim() || '0',
                            'هامش الربح %': cells[11]?.innerText?.trim() || '0%',
                            '% لمبيعات الفترة': cells[12]?.innerText?.trim() || '0%'
                        });
                    } else if (isCustomers) {
                        exportData.push({
                            '# الترتيب': cells[1]?.innerText?.trim() || (idx + 1),
                            'آخر حركة': cells[2]?.innerText?.trim() || '-',
                            'أحدث فاتورة': cells[3]?.innerText?.trim() || '-',
                            'فئة العميل': cells[4]?.innerText?.trim() || '-',
                            'اسم العميل': cells[5]?.innerText?.trim() || '-',
                            'الأصناف الأكثر طلباً': cells[6]?.innerText?.replace(/\n/g, ' ')?.trim() || '-',
                            'إجمالي القطع': cells[7]?.innerText?.trim() || '0',
                            'إجمالي المسحوبات': cells[8]?.innerText?.trim() || '0',
                            'المدفوع': cells[9]?.innerText?.trim() || '0',
                            'المتبقي (الآجل)': cells[10]?.innerText?.trim() || '0',
                            'صافي الربح': cells[11]?.innerText?.trim() || '0',
                            '% من المبيعات': cells[12]?.innerText?.trim() || '0%'
                        });
                    } else if (isCategories) {
                        exportData.push({
                            '#': cells[1]?.innerText?.trim() || (idx + 1),
                            'التصنيف': cells[6]?.innerText?.replace(/\n/g, ' ')?.trim() || '-',
                            'عدد الأصناف': cells[5]?.innerText?.trim() || '-',
                            'إجمالي القطع المباعة': cells[7]?.innerText?.trim() || '0',
                            'إجمالي المبيعات': cells[8]?.innerText?.trim() || '0',
                            'التكلفة': cells[9]?.innerText?.trim() || '0',
                            'صافي الربح': cells[10]?.innerText?.trim() || '0',
                            'هامش الربح %': cells[11]?.innerText?.trim() || '0%',
                            '% لمبيعات الفترة': cells[12]?.innerText?.trim() || '0%'
                        });
                    } else if (isReturns) {
                        exportData.push({
                            '#': cells[1]?.innerText?.trim() || (idx + 1),
                            'التاريخ': cells[2]?.innerText?.trim() || '-',
                            'نوع العملية': cells[4]?.innerText?.trim() || '-',
                            'العميل': cells[5]?.innerText?.trim() || '-',
                            'الأصناف المرتجعة': cells[6]?.innerText?.trim() || '-',
                            'الكمية المرتجعة': cells[7]?.innerText?.trim() || '0',
                            'قيمة المرتجع': cells[8]?.innerText?.trim() || '0',
                            'الربح المفقود': cells[10]?.innerText?.trim() || '0',
                            'نسبة المرتجع %': cells[11]?.innerText?.trim() || '0%',
                            'عدد الفواتير': cells[12]?.innerText?.trim() || '0'
                        });
                    } else {
                        exportData.push({
                            '#': cells[1]?.innerText?.trim() || (idx + 1),
                            'الصنف': cells[6]?.innerText?.replace(/\n/g, ' ')?.trim() || '-',
                            'صافي الكمية': cells[7]?.innerText?.trim() || '0',
                            'متوسط سعر البيع': cells[8]?.innerText?.trim() || '0',
                            'متوسط التكلفة': cells[9]?.innerText?.trim() || '0',
                            'صافي الربح': cells[10]?.innerText?.trim() || '0',
                            'هامش الربح %': cells[11]?.innerText?.trim() || '0%',
                            '% لمبيعات الفترة': cells[12]?.innerText?.trim() || '0%'
                        });
                    }
                });

                const ws = XLSX.utils.json_to_sheet(exportData);
                ws['!dir'] = 'rtl';
                const wb = XLSX.utils.book_new();
                const sheetTitle = isCustomers ? "تحليل كبار العملاء" : (isCategories ? "تحليل التصنيفات" : (isReturns ? "تقرير المرتجعات" : (isDetailed ? "تحليل مبيعات تفصيلي" : "تحليل مبيعات تجميعي")));
                XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

                const dateStr = new Date().toISOString().slice(0, 10);
                XLSX.writeFile(wb, `Bayan_POS_Sales_Analysis_${currentAnalysisMode}_${dateStr}.xlsx`);
                if (typeof showToast === 'function') {
                    showToast("✅ تم تصدير تقرير تحليل المبيعات إلى Excel بنجاح!");
                }
            } catch (err) {
                console.error("Export analysis error:", err);
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({ type: 'error', titleText: 'خطأ في التصدير', msg: err.message });
                }
            }
        }
        window.exportAnalysisToExcel = exportAnalysisToExcel;

        // طباعة تقرير تحليل المبيعات بتنسيق احترافي
        function printAnalysisReport() {
            try {
                let receiptArea = document.getElementById('receipt-area');
                if (!receiptArea) {
                    receiptArea = document.createElement('div');
                    receiptArea.id = 'receipt-area';
                    document.body.appendChild(receiptArea);
                }

                const fromDate = document.getElementById('anDateFrom')?.value || 'بداية السجل';
                const toDate = document.getElementById('anDateTo')?.value || 'الآن';
                const totalSales = document.getElementById('kpi-total-sales')?.innerText || '0.00';
                const totalProfit = document.getElementById('kpi-total-profit')?.innerText || '0.00';
                const profitMargin = document.getElementById('kpi-profit-margin')?.innerText || '0.0%';
                const shopName = (typeof getStore === 'function' ? getStore('shop_name') : null) || document.getElementById('shopName')?.value || 'بيان POS';

                const table = document.querySelector('#analysis-section .invoice-table');
                if (!table) return;

                const printTable = table.cloneNode(true);
                printTable.querySelectorAll('tr').forEach(tr => {
                    const firstCell = tr.children[0];
                    if (firstCell) firstCell.remove(); // إخفاء عمود checkboxes أثناء الطباعة
                });

                let reportSubtitle = "📊 تقرير تحليل ومراقبة المبيعات";
                if (currentAnalysisMode === 'customers') reportSubtitle = "👑 تقرير كبار العملاء والمسحوبات والمديونيات";
                else if (currentAnalysisMode === 'categories') reportSubtitle = "🏷️ تقرير أداء ومبيعات التصنيفات";
                else if (currentAnalysisMode === 'returns') reportSubtitle = "🔄 تقرير تحليل المرتجعات والعملاء الأكثر إرجاعاً";
                else if (currentAnalysisMode === 'detailed') reportSubtitle = "📑 تقرير المبيعات التفصيلي بالفواتير";

                const headerHtml = `
                    <div style="direction:rtl; text-align:center; padding:15px; font-family:'Cairo',sans-serif; border-bottom:2px solid #1e293b; margin-bottom:15px;">
                        <h1 style="margin:0 0 5px 0; font-size:1.5rem; color:#1e293b;">${shopName}</h1>
                        <h2 style="margin:0 0 10px 0; font-size:1.2rem; color:#4f46e5;">${reportSubtitle}</h2>
                        <div style="display:flex; justify-content:center; gap:20px; font-size:0.9rem; color:#475569; margin-bottom:10px;">
                            <span>🗓️ الفترة: من <b>${fromDate}</b> إلى <b>${toDate}</b></span>
                            <span>🕒 تاريخ الطباعة: <b>${new Date().toLocaleString('ar-EG')}</b></span>
                        </div>
                        <div style="display:flex; justify-content:center; gap:25px; background:#f1f5f9; padding:8px; border-radius:8px; font-weight:bold; font-size:0.95rem;">
                            <span>💰 إجمالي المبيعات: <b style="color:#059669;">${totalSales} ج.م</b></span>
                            <span>📈 صافي الأرباح: <b style="color:#2563eb;">${totalProfit} ج.م</b></span>
                            <span>🎯 هامش الربح: <b style="color:#7c3aed;">${profitMargin}</b></span>
                        </div>
                    </div>
                `;

                receiptArea.innerHTML = `
                    <div class="print-container" style="direction:rtl; font-family:'Cairo',sans-serif; padding:10px;">
                        ${headerHtml}
                        <div style="overflow-x:auto;">
                            ${printTable.outerHTML}
                        </div>
                    </div>
                `;

                window.print();
            } catch (err) {
                console.error("Print analysis error:", err);
            }
        }
        window.printAnalysisReport = printAnalysisReport;

        // --- تقرير العملاء الأكثر إرجاعاً المطور والمحاذى بدقة ---
        function renderMostReturningCustomers() {
            currentAnalysisMode = 'returns';

            const modeButtons = [
                { id: 'summary', el: document.getElementById('anModeSummaryBtn') },
                { id: 'detailed', el: document.getElementById('anModeDetailedBtn') },
                { id: 'customers', el: document.getElementById('anModeCustomerBtn') },
                { id: 'categories', el: document.getElementById('anModeCategoryBtn') },
                { id: 'returns', el: document.getElementById('anModeReturnBtn') }
            ];
            modeButtons.forEach(m => {
                if (m.el) {
                    const isActive = (m.id === 'returns');
                    m.el.className = isActive ? 'an-btn-mode active' : 'an-btn-mode';
                    m.el.style.background = isActive ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#f1f5f9';
                    m.el.style.color = isActive ? '#ffffff' : '#475569';
                    m.el.style.border = isActive ? 'none' : '1px solid #cbd5e1';
                }
            });

            const tbody = document.getElementById('analysisTableBody');
            if (!tbody) return;

            const fromDate = document.getElementById('anDateFrom')?.value;
            const toDate = document.getElementById('anDateTo')?.value;
            const searchQuery = (document.getElementById('anSearchInput')?.value || '').trim().toLowerCase();

            let returns = (window.transactions || []).filter(t => t.type && t.type.includes('مرتجع بيع'));
            if (fromDate) returns = returns.filter(t => (t.dateISO || '') >= fromDate);
            if (toDate) returns = returns.filter(t => (t.dateISO || '') <= toDate);

            if (searchQuery) {
                returns = returns.filter(t => {
                    return (t.product || '').toLowerCase().includes(searchQuery) ||
                           (t.partner || '').toLowerCase().includes(searchQuery) ||
                           (t.invoiceId || '').toLowerCase().includes(searchQuery);
                });
            }

            const accFilter = document.getElementById('anAccount')?.value || 'all';
            const methodFilter = document.getElementById('anMethod')?.value || 'all';
            const catFilter = document.getElementById('anCategory')?.value || 'all';
            const whFilter = document.getElementById('anWarehouse')?.value || 'all';
            const userFilter = document.getElementById('anUser')?.value || 'all';

            if (accFilter !== 'all') returns = returns.filter(t => t.partner === accFilter);
            if (methodFilter !== 'all') {
                returns = returns.filter(t => {
                    const m = (t.method || '').toLowerCase();
                    const target = methodFilter.toLowerCase();
                    return m.includes(target) || target.includes(m);
                });
            }
            if (catFilter !== 'all') {
                returns = returns.filter(t => {
                    const prod = (window.productsDB || []).find(p => p.name === t.product || p.id === t.productId || p.barcode === t.barcode);
                    return prod && prod.category === catFilter;
                });
            }
            if (whFilter !== 'all') returns = returns.filter(t => t.warehouse === whFilter);
            if (userFilter !== 'all') returns = returns.filter(t => t.user === userFilter);

            if (returns.length === 0) {
                const salesCount = (window.transactions || []).filter(t => {
                    const isRet = t.type && t.type.includes('مرتجع');
                    if (isRet) return false;
                    if (fromDate && (t.dateISO || '') < fromDate) return false;
                    if (toDate && (t.dateISO || '') > toDate) return false;
                    return true;
                }).length;

                tbody.innerHTML = `
                    <tr>
                        <td colspan="13" style="text-align:center; padding:45px 20px; color:#475569;">
                            <div style="font-size:2.8rem; margin-bottom:10px;">🔄</div>
                            <div style="font-size:1.15rem; font-weight:900; color:#1e293b; margin-bottom:6px;">لا توجد أي عمليات إرجاع مسجلة في هذه الفترة</div>
                            <div style="font-size:0.85rem; color:#64748b; margin-bottom:18px;">سجل الفترة المحددة خالٍ تماماً من المرتجعات 👍</div>
                            <button onclick="setAnalysisMode('detailed')" style="background:linear-gradient(135deg, #4f46e5, #4338ca); color:white; border:none; padding:11px 24px; border-radius:10px; font-weight:900; font-size:0.92rem; cursor:pointer; box-shadow:0 4px 15px rgba(79,70,229,0.35); display:inline-flex; align-items:center; gap:8px; transition:0.2s;">
                                <span>📑</span> اضغط هنا للانتقال لعرض فواتير المبيعات (${salesCount} حركة بيع)
                            </button>
                        </td>
                    </tr>
                `;
                applyAnalysisColumnVisibility();
                setTimeout(() => {
                    const tableContainer = document.getElementById('analysisTableContainer');
                    if (tableContainer) {
                        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }, 80);
                return;
            }

            const groups = {};
            let totalAllReturnsAmount = 0;

            returns.forEach(t => {
                const partner = t.partner || 'عميل نقدي';
                const total = Math.abs(parseFloat(t.total) || 0);
                const qty = Math.abs(parseFloat(t.qty) || 0);
                const profitLost = getTransactionReliableProfit(t);

                totalAllReturnsAmount += total;

                if (!groups[partner]) {
                    groups[partner] = {
                        name: partner,
                        count: 0,
                        totalQty: 0,
                        total: 0,
                        profitLost: 0,
                        products: new Set(),
                        lastDate: t.dateISO || '-',
                        latestInvoiceId: t.invoiceId || '',
                        latestType: t.type || 'مرتجع بيع'
                    };
                } else if (t.invoiceId) {
                    groups[partner].latestInvoiceId = t.invoiceId;
                    groups[partner].latestType = t.type || 'مرتجع بيع';
                }

                groups[partner].count++;
                groups[partner].totalQty += qty;
                groups[partner].total += total;
                groups[partner].profitLost += profitLost;
                if (t.product) groups[partner].products.add(t.product);
                if (t.dateISO) groups[partner].lastDate = t.dateISO;
            });

            const sorted = Object.values(groups).sort((a, b) => b.total - a.total);
            const rowsHtml = [];

            sorted.forEach((g, idx) => {
                const productList = Array.from(g.products);
                const displayProducts = productList.length > 2 
                    ? productList.slice(0, 2).join(' + ') + ` (+${productList.length - 2} أصناف)`
                    : (productList.join(' + ') || 'متنوع');

                const percentOfReturns = totalAllReturnsAmount > 0 ? ((g.total / totalAllReturnsAmount) * 100).toFixed(1) : '0.0';

                const isSelected = idx === 0;
                const safePartner = (g.name || '').replace(/'/g, "\\'");
                if (isSelected) {
                    window.selectedAnalysisInvoice = {
                        id: g.latestInvoiceId || null,
                        type: g.latestType || 'مرتجع بيع',
                        product: safePartner
                    };
                }

                // 13 خلية مضبوطة تماماً تحت الـ 13 عمود في الترويسة
                rowsHtml.push(`
                    <tr class="an-row return-row ${isSelected ? 'selected-row' : ''}" 
                        style="background-color:#fef2f2; border-right:4px solid #ef4444;"
                        data-invoice="${g.latestInvoiceId || ''}"
                        data-type="${g.latestType || 'مرتجع بيع'}"
                        data-product="${safePartner}"
                        onclick="selectAnalysisRow(this, '${g.latestInvoiceId || ''}', '${g.latestType || 'مرتجع بيع'}', '${safePartner}')"
                        ondblclick="viewSelectedAnalysisInvoice()">
                        <td style="text-align:center;"><div class="an-radio-circle" title="تحديد"></div></td>
                        <td style="font-weight:900; color:#64748b;">${idx + 1}</td>
                        <td style="font-weight:bold; color:#1e293b;">${g.lastDate}</td>
                        <td style="font-weight:800; color:#4f46e5;">${g.latestInvoiceId ? `<span style="background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; font-size:0.8rem;">#${g.latestInvoiceId}</span>` : '-'}</td>
                        <td><span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.8rem;">🔄 مرتجع</span></td>
                        <td style="font-weight:800; color:#1e293b;">👤 ${g.name}</td>
                        <td style="font-weight:700; color:#4338ca;">${displayProducts}</td>
                        <td style="text-align:center; font-weight:900; color:#ef4444;">${g.totalQty} قطعة</td>
                        <td style="font-weight:800; color:#ef4444;">${g.total.toFixed(2)}</td>
                        <td style="color:#64748b;">-</td>
                        <td class="profit-col" style="color:#ef4444; font-weight:900;">-${g.profitLost.toFixed(2)}</td>
                        <td class="profit-col" style="font-weight:800; color:#b91c1c;">${percentOfReturns}%</td>
                        <td class="profit-col" style="font-weight:800; color:#475569;">${g.count} فواتير</td>
                    </tr>
                `);
            });

            tbody.innerHTML = rowsHtml.join('');
            applyAnalysisColumnVisibility();
            if (typeof showToast === 'function') showToast("📊 تم عرض تقرير العملاء الأكثر إرجاعاً للفترة المحددة");
            setTimeout(() => {
                const tableContainer = document.getElementById('analysisTableContainer');
                if (tableContainer) {
                    tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 80);
        }
        window.renderMostReturningCustomers = renderMostReturningCustomers;

        // ================= منطق لوحة التحكم (Dashboard) =================

        function updateDashboard() {

            // تم نقل الإحصائيات إلى تقرير الحركة اليومية، اللوحة الرئيسية الآن للتنقل

        }

        // ================= منطق المخازن (Inventory Logic) =================

        var currentInvFilter = 'all';
        var selectedInventoryId = null;
        var currentEditingProductId = null;

        function filterInventory(type, btn) {

            currentInvFilter = type;

            document.querySelectorAll('.inv-filters .filter-btn').forEach(b => b.classList.remove('active'));

            btn.classList.add('active');

            renderInventoryTable();

        }

        // ================= رفع صورة الهوية للحساب =================

        function generateDebtReport() {

            const debtors = accounts.map(a => {
                const bal = typeof getAccountBalance === 'function' ? getAccountBalance(a.name) : ((parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0));
                return { ...a, realBalance: bal };
            }).filter(a => a.realBalance > 0); // عليه فلوس

            if (debtors.length === 0) return alert("لا توجد مديونيات مستحقة حالياً.");

            let rows = '';

            let totalDebt = 0;

            debtors.forEach(a => {

                const debt = a.realBalance;

                totalDebt += debt;

                rows += `<tr><td>${a.name}</td><td>${a.mobile || '-'}</td><td>${debt.toFixed(2)}</td></tr>`;

            });

            const content = `

                <div class="print-container">

                    <div class="print-header"><div class="print-title">تقرير المديونيات المستحقة (الآجل)</div></div>

                    <table class="print-table"><thead><tr><th>العميل</th><th>رقم الهاتف</th><th>المبلغ المستحق</th></tr></thead><tbody>${rows}</tbody></table>

                    <div class="print-total-box">إجمالي الديون: ${totalDebt.toFixed(2)}</div>

                </div>`;

            document.getElementById('receipt-area').innerHTML = content;

            window.print();

        }

        // ================= تقرير تجاوز الحد الائتماني (Over Limit Report) =================

        function generateOverLimitReport() {

            const overLimitAccounts = accounts.filter(a => {

                const limit = parseFloat(a.maxDebt) || 0;

                if (limit <= 0) return false; // لا يوجد حد

                const balance = (parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0);

                return balance > limit;

            });

            if (overLimitAccounts.length === 0) return alert("✅ ممتاز! لا يوجد عملاء متجاوزين للحد الائتماني.");

            let rows = '';

            overLimitAccounts.forEach(a => {

                const balance = (parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0);

                const limit = parseFloat(a.maxDebt);

                const diff = balance - limit;

                rows += `<tr><td>${a.name}</td><td>${a.mobile || '-'}</td><td>${limit.toFixed(2)}</td><td style="color:red; font-weight:bold;">${balance.toFixed(2)}</td><td style="color:#c0392b;">+${diff.toFixed(2)}</td></tr>`;

            });

            const content = `

                <div class="print-container">

                    <div class="print-header">

                        <div class="print-title">⚠️ تقرير العملاء المتجاوزين للحد الائتماني</div>

                        <div>تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</div>

                    </div>

                    <table class="print-table">

                        <thead><tr><th>العميل</th><th>رقم الهاتف</th><th>الحد المسموح</th><th>الرصيد الحالي</th><th>قيمة التجاوز</th></tr></thead>

                        <tbody>${rows}</tbody>

                    </table>

                </div>`;

            document.getElementById('receipt-area').innerHTML = content;

            window.print();

        }

        // حفظ وإدارة المستخدمين محلياً 100%
        async function syncUsersToCloud() {
            // معطل ومحلي 100%
        }

        // ================= دوال إدارة المخازن (Warehouses) =================
