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

            // 1. حساب الرصيد السابق الموحد لمجموع الحركات النقدية قبل تاريخ البداية
            let previousBalance = 0;
            const priorRaw = transactions.filter(t => t.dateISO && t.dateISO < fromDate);
            const priorGrouped = getGroupedTransactions(priorRaw);

            priorGrouped.forEach(g => {
                const paid = g.paid || 0;
                const total = g.total || 0;
                const gType = g.type || '';

                if (gType.includes('قبض')) {
                    previousBalance += total;
                } else if (gType.includes('صرف')) {
                    previousBalance -= total;
                } else if (gType.includes('بيع') && !gType.includes('مرتجع')) {
                    previousBalance += paid;
                } else if ((gType.includes('شراء') || gType.includes('مشتريات')) && !gType.includes('مرتجع')) {
                    previousBalance -= paid;
                } else if (gType.includes('مرتجع بيع')) {
                    previousBalance -= paid;
                } else if (gType.includes('مرتجع شراء')) {
                    previousBalance += paid;
                }
            });

            // 2. فلترة وتجميع حركات الفترة المحددة بالدالة الموحدة
            const currentRaw = transactions.filter(t => t.dateISO && t.dateISO >= fromDate && t.dateISO <= toDate);
            const currentGrouped = getGroupedTransactions(currentRaw);

            // تهيئة العدادات مع فصل الجملة عن القطاعي (Retail vs Wholesale)
            let sales = { count: 0, total: 0, cash: 0, credit: 0 };
            let retailSales = { count: 0, total: 0, cash: 0, credit: 0 };
            let wholesaleSales = { count: 0, total: 0, cash: 0, credit: 0 };

            let salesReturn = { count: 0, total: 0, cash: 0, credit: 0 };
            let purchases = { count: 0, total: 0, cash: 0, credit: 0 };
            let purchasesReturn = { count: 0, total: 0, cash: 0, credit: 0 };
            let receipts = { count: 0, total: 0 };
            let disbursements = { count: 0, total: 0 };
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
                } else if (gType.includes('صرف')) {
                    disbursements.count++;
                    disbursements.total += total;
                } else if (gType.includes('تسوية')) {
                    adjustments.count++;
                    adjustments.total += total;
                } else if (gType.includes('تحويل')) {
                    transfers.count++;
                    transfers.total += total;
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
                <tr><td>💰 قبض (إيرادات)</td><td>${receipts.count}</td><td>${receipts.total.toFixed(2)}</td><td>${receipts.total.toFixed(2)}</td><td>0.00</td></tr>
                <tr><td>💸 صرف (مصروفات)</td><td>${disbursements.count}</td><td>${disbursements.total.toFixed(2)}</td><td>${disbursements.total.toFixed(2)}</td><td>0.00</td></tr>
                <tr style="background: rgba(142, 68, 173, 0.05);"><td>⚖️ تسوية المخزن</td><td>${adjustments.count}</td><td>${adjustments.total.toFixed(2)}</td><td>-</td><td>-</td></tr>
                <tr style="background: rgba(94, 51, 112, 0.1);"><td>🚚 تحويل مخزني</td><td>${transfers.count}</td><td>${transfers.total.toFixed(2)}</td><td>-</td><td>-</td></tr>
                <tr style="font-weight:900; background:#f1f5f9; border-top:2px solid #cbd5e1;">
                    <td>📊 إجمالي الحركة والإيرادات (المبيعات + القبض)</td>
                    <td>${sales.count + receipts.count}</td>
                    <td style="color:#1e293b;">${(sales.total + receipts.total).toFixed(2)}</td>
                    <td style="color:var(--main-green);">${(sales.cash + receipts.total).toFixed(2)}</td>
                    <td style="color:#d97706;">${sales.credit.toFixed(2)}</td>
                </tr>
            `;

            // إجمالي اليومية الفعلي (ما يجب أن يكون في الدرج حالياً)
            const dailyTotal = (sales.cash || 0) + (receipts.total || 0) + (purchasesReturn.cash || 0) 
                             - (salesReturn.cash || 0) - (purchases.cash || 0) - (disbursements.total || 0);
                             
            const dailyTotalEl = document.getElementById('dailyTotalVal');
            if (dailyTotalEl) {
                dailyTotalEl.innerText = dailyTotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
                const parentBadge = document.getElementById('dailyTotalSalesReceipts');
                if (parentBadge) {
                    // تحديث دالة إظهار التفاصيل إذا أردنا إرسال كل المعاملات لاحقاً
                    parentBadge.onclick = () => showDailyTotalBreakdown(sales.cash || 0, receipts.total || 0, disbursements.total || 0, dailyTotal);
                }
            }

            const lastUpdateEl = document.getElementById('reportLastUpdate');
            if (lastUpdateEl) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                const dateStr = now.toLocaleDateString('ar-EG');
                lastUpdateEl.innerHTML = `آخر تحديث: <b style="color:var(--main-green);">${timeStr}</b> | م ${dateStr}`;
            }

            // حساب القيم النهائية للخزينة (بدون تضمين تسويات المخزن لأنها لا تؤثر على الكاش)
            const netCashMovement = (sales.cash + receipts.total + purchasesReturn.cash) - (purchases.cash + disbursements.total + salesReturn.cash);
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
                <tr><td>💰 قبض (إيرادات)</td><td style="color:var(--main-green); font-weight:bold;">${receipts.total.toFixed(2)}</td></tr>
                <tr><td>💸 صرف (مصروفات)</td><td style="color:var(--box-red); font-weight:bold;">${disbursements.total.toFixed(2)}</td></tr>
                <tr style="background: rgba(142, 68, 173, 0.05);"><td>⚖️ تسوية المخزن (غير مؤثرة على الكاش)</td><td style="color:${adjustments.total >= 0 ? 'var(--main-green)' : 'var(--box-red)'}; font-weight:bold;">${adjustments.total.toFixed(2)}</td></tr>
                <tr style="background: rgba(94, 51, 112, 0.1);"><td>🚚 تحويل مخزني (غير مؤثر على الكاش)</td><td style="color:#5e3370; font-weight:bold;">${transfers.total.toFixed(2)}</td></tr>
                <tr style="font-weight:bold; background:#f9f9f9; border-top:2px dashed #ccc;">
                    <td>⏺️ رصيد سابق (افتتاحي)</td>
                    <td style="color:#2c3e50;">${previousBalance.toFixed(2)}</td>
                </tr>
                <tr style="background:rgba(211, 211, 211, 0.2); font-weight:900;">
                    <td>🔄 صافي الحركة اليومية</td>
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

            const profitBody = document.getElementById('profitSummaryBody');
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

            window.dailyReportData = {
                netProfit: netProfit,
                grossProfit: totalGrossProfit,
                retailGrossProfit: retailGrossProfit,
                wholesaleGrossProfit: wholesaleGrossProfit,
                retailSalesTotal: retailSales.total,
                wholesaleSalesTotal: wholesaleSales.total,
                totalSales: sales.total,
                totalPurchases: purchases.total,
                totalReceipts: receipts.total,
                totalExpenses: disbursements.total
            };

            showToast("✅ تم تحديث وتفصيل تقارير الحركة والأرباح بنجاح");
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

            const opsSummary = document.getElementById('opsSummaryBody').innerHTML.replace(/📤|📥|🔄|🔙|💵|💸|⚖️|🚚|🛒|🧺|📦|💰|🌗|✅|⏳/g, '');

            const treasurySummary = document.getElementById('treasurySummaryBody').innerHTML.replace(/📤|📥|🔄|🔙|💵|💸|⚖️|🚚|🛒|🧺|📦|💰|🌗|✅|⏳|⏺️/g, '');

            const from = document.getElementById('reportDateFrom').value;

            const to = document.getElementById('reportDateTo').value;

            const businessName = getStore('bayan_business_name') || 'بيان POS للطلب والمبيعات';

            const content = `

                <div class="print-container" style="direction: rtl; font-family: 'Tahoma', 'Arial', sans-serif; padding: 10px; color: #000; width: 100%; box-sizing: border-box;">

                    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">

                        <h1 style="margin: 0; font-size: 22px; font-weight: 900;">${businessName}</h1>

                        <h2 style="margin: 5px 0; font-size: 18px; font-weight: 800;">تقرير الحركة اليومية</h2>

                        <div style="font-size: 14px; margin-top: 5px; font-weight: bold; border: 1px solid #000; padding: 5px; border-radius: 5px;">

                            من: ${from} <br> إلى: ${to}

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

                    <div style="margin-bottom: 20px;">

                        <h3 style="border-right: 4px solid #000; padding-right: 8px; margin-bottom: 10px; font-size: 16px; font-weight: 900;">ملخص الأرباح</h3>

                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 14px;">

                            <tbody style="font-weight: bold;">

                                ${document.getElementById('profitSummaryBody').innerHTML.replace(/📤|📥|🔄|🔙|💵|💸|⚖️|🚚|🛒|🧺|📦|💰|🌗|✅|⏳/g, '')}

                            </tbody>

                        </table>

                    </div>

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

            let totalQty = 0;
            let totalValue = 0;

            let rows = window.adjCart.map((item, idx) => {
                const qty = parseFloat(item.qty) || 0;
                const price = parseFloat(item.price) || 0;
                const lineTotal = qty * price;
                totalQty += qty;
                totalValue += lineTotal;

                const sSize = item.size || item.selectedSize || '-';
                const sColor = item.color || item.selectedColor || '-';
                const unitName = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');

                return `
                    <tr>
                        <td style="padding: 6px 8px; border: 1px solid #000;">${idx + 1}</td>
                        <td style="text-align:right; padding: 6px 10px; border: 1px solid #000; font-weight:bold;">${item.name}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#047857;">${sSize}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold; color:#1d4ed8;">${sColor}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${qty} ${unitName}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000;">${price.toFixed(2)}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; font-weight:bold;">${lineTotal.toFixed(2)}</td>
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

                        <h2 style="margin:5px 0; background:#000; color:#fff; display:inline-block; padding:5px 20px; border-radius:5px;">إذن تسوية مخزنية</h2>

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
                                <th style="padding: 8px; border: 1px solid #000;">الكمية الفعلية</th>
                                <th style="padding: 8px; border: 1px solid #000;">السعر</th>
                                <th style="padding: 8px; border: 1px solid #000;">الإجمالي</th>
                                <th style="padding: 8px; border: 1px solid #000;">الملاحظات</th>
                            </tr>
                        </thead>

                        <tbody>${rows}</tbody>

                        <tfoot>
                            <tr style="font-weight:bold; background:#f0f0f0;">
                                <td colspan="4" style="padding: 8px; border: 1px solid #000;">الإجمالي الكلي</td>
                                <td style="padding: 8px; border: 1px solid #000;">${totalQty}</td>
                                <td style="padding: 8px; border: 1px solid #000;">-</td>
                                <td style="padding: 8px; border: 1px solid #000;">${totalValue.toFixed(2)}</td>
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

        // ================= منطق تحليل المبيعات (Sales Analysis Logic) =================

        function setAnalysisMode(mode) {

            currentAnalysisMode = mode;

            renderAnalysisTable();

        }

        function shareAnalysisReport(platform) {

            const totalSales = document.getElementById('anTotalSales').innerText;

            const totalProfit = document.getElementById('anTotalProfit').innerText;

            const fromDate = document.getElementById('anDateFrom').value || 'بداية السجل';

            const toDate = document.getElementById('anDateTo').value || 'اليوم';

            const shopName = document.getElementById('shopName').value || 'متجر السعادة';

            let text = `📊 *تقرير تحليل المبيعات - ${shopName}*\n`;

            text += `🗓️ الفترة: من ${fromDate} إلى ${toDate}\n`;

            text += `------------------\n`;

            text += `💰 إجمالي المبيعات: *${totalSales} ج.م*\n`;

            text += `📊 إجمالي تحليل المبيعات: *${totalProfit} ج.م*\n`;

            text += `------------------\n`;

            text += `✅ تم استخراج التقرير بتاريخ: ${new Date().toLocaleDateString('ar-EG')}`;

            const encodedText = encodeURIComponent(text);

            let url = '';

            if (platform === 'whatsapp') {

                url = `https://wa.me/?text=${encodedText}`;

            } else if (platform === 'telegram') {

                url = `https://t.me/share/url?url=${encodedText}`;

            }

            if (url) window.open(url, '_blank');

        }

        let salesTrendChartInstance = null;

        let categoryChartInstance = null;

        function updateAnalysisCharts(data) {

            const trendData = {};

            const catData = {};

            let totalQty = 0;

            let invoiceIds = new Set();

            data.forEach(t => {

                const isReturn = t.type.includes('مرتجع');

                const qty = parseFloat(t.qty) || 0;

                const total = parseFloat(t.total) || 0;

                const date = t.dateISO;

                if (t.invoiceId) invoiceIds.add(t.invoiceId);

                // Trend

                if (!trendData[date]) trendData[date] = 0;

                trendData[date] += isReturn ? -total : total;

                // التجميع حسب اسم المنتج بدلاً من التصنيف

                const productName = t.product || 'غير معروف';

                if (!catData[productName]) catData[productName] = 0;

                catData[productName] += isReturn ? -total : total;

                totalQty += isReturn ? -qty : qty;

            });

            // تحويل البيانات لترتيبها واختيار الأفضل

            let productSalesArray = Object.keys(catData).map(name => ({

                name: name,

                total: catData[name]

            })).sort((a, b) => b.total - a.total);

            // نأخذ أفضل 7 منتجات والباقي نضعه في "أخرى"

            let finalLabels = [];

            let finalValues = [];

            if (productSalesArray.length > 7) {

                const top7 = productSalesArray.slice(0, 7);

                const others = productSalesArray.slice(7).reduce((sum, p) => sum + p.total, 0);

                finalLabels = top7.map(p => p.name);

                finalValues = top7.map(p => p.total);

                if (others > 0) {

                    finalLabels.push("أصناف أخرى");

                    finalValues.push(others);

                }

            } else {

                finalLabels = productSalesArray.map(p => p.name);

                finalValues = productSalesArray.map(p => p.total);

            }

            // Update KPI Cards

            const invoiceCountEl = document.getElementById('kpi-invoice-count');

            const totalQtyEl = document.getElementById('kpi-total-qty');

            if (invoiceCountEl) invoiceCountEl.innerText = invoiceIds.size;

            if (totalQtyEl) totalQtyEl.innerText = totalQty.toFixed(0);

            // Chart 1: Sales Trend

            const trendLabels = Object.keys(trendData).sort();

            const trendValues = trendLabels.map(l => trendData[l]);

            const trendCtx = document.getElementById('salesTrendChart');

            if (trendCtx) {

                if (salesTrendChartInstance) salesTrendChartInstance.destroy();

                salesTrendChartInstance = new Chart(trendCtx.getContext('2d'), {

                    type: 'line',

                    data: {

                        labels: trendLabels,

                        datasets: [{

                            label: 'المبيعات',

                            data: trendValues,

                            borderColor: '#4f46e5',

                            backgroundColor: 'rgba(79, 70, 229, 0.1)',

                            fill: true,

                            tension: 0.4,

                            borderWidth: 3,

                            pointRadius: 4,

                            pointBackgroundColor: '#4f46e5'

                        }]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio: false,

                        plugins: { 

                            legend: { display: false },

                            title: { display: true, text: '📈 اتجاه المبيعات', font: { family: 'Cairo', size: 14, weight: 'bold' }, color: '#1e293b' }

                        },

                        scales: { 

                            y: { beginAtZero: true, grid: { display: false } },

                            x: { grid: { display: false } }

                        }

                    }

                });

            }

            // Chart 2: Top Products Distribution

            const catCtx = document.getElementById('categoryChart');

            if (catCtx) {

                if (categoryChartInstance) categoryChartInstance.destroy();

                categoryChartInstance = new Chart(catCtx.getContext('2d'), {

                    type: 'doughnut',

                    data: {

                        labels: finalLabels,

                        datasets: [{

                            data: finalValues,

                            backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#94a3b8', '#cbd5e1'],

                            borderWidth: 0

                        }]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio: false,

                        plugins: { 

                            legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Cairo', size: 10 } } },

                            title: { display: true, text: '🏆 الأصناف الأكثر مبيعاً', font: { family: 'Cairo', size: 14, weight: 'bold' }, color: '#1e293b' }

                        },

                        cutout: '70%'

                    }

                });

            }

        }

        // متغيرات للتحكم في فرز جدول التحليل المبيعات حسب التاريخ
        let analysisDateSortDir = 'desc'; // desc = من الأحدث للأقدم، asc = من الأقدم للأحدث

        function toggleAnalysisDateSort() {
            analysisDateSortDir = (analysisDateSortDir === 'desc') ? 'asc' : 'desc';
            
            // تحديث الأيقونات في ترويسة الجدول
            const sortIcon = document.getElementById('anSortDateIcon');
            if (sortIcon) {
                sortIcon.innerText = (analysisDateSortDir === 'desc') ? ' 🔽' : ' 🔼';
            }
            
            renderAnalysisTable();
        }
        window.toggleAnalysisDateSort = toggleAnalysisDateSort;

        function renderAnalysisTable() {

            const tbody = document.getElementById('analysisTableBody');

            tbody.innerHTML = '';

            // 1. جلب الفلاتر

            const fromDate = document.getElementById('anDateFrom').value;

            const toDate = document.getElementById('anDateTo').value;

            const methodFilter = document.getElementById('anMethod').value;

            const accFilter = document.getElementById('anAccount').value;

            const catFilter = document.getElementById('anCategory').value;

            // تعبئة قائمة الحسابات إذا كانت فارغة

            const accSelect = document.getElementById('anAccount');

            if (accSelect.options.length === 1) {

                accounts.forEach(a => {

                    const opt = document.createElement('option');

                    opt.value = a.name;

                    opt.innerText = a.name;

                    accSelect.appendChild(opt);

                });

            }

            // تعبئة قائمة التصنيفات إذا كانت فارغة

            const catSelect = document.getElementById('anCategory');

            if (catSelect.options.length === 1) {

                const cats = [...new Set(productsDB.map(p => p.category).filter(c => c))];

                cats.forEach(c => {

                    const opt = document.createElement('option');

                    opt.value = c;

                    opt.innerText = c;

                    catSelect.appendChild(opt);

                });

            }

            // 2. فلترة البيانات (نبحث في transactions عن عمليات البيع فقط)

            let data = transactions.filter(t => (t.type.includes('بيع') || t.type.includes('مرتجع بيع')));

            if (fromDate) data = data.filter(t => t.dateISO >= fromDate);

            if (toDate) data = data.filter(t => t.dateISO <= toDate);

            if (accFilter !== 'all') data = data.filter(t => t.partner === accFilter);

            if (methodFilter !== 'all') {
                if (methodFilter === 'نقدية' || methodFilter === 'نقدي' || methodFilter === 'cash') {
                    data = data.filter(t => {
                        const m = ((t.method || t.paymentMethod || '') + '').toLowerCase();
                        return m.includes('نقدي') || m.includes('نقدية') || m.includes('نقدا') || m.includes('كاش') || m.includes('cash') || m.includes('فودافون') || m.includes('درج') || (!m.includes('اجل') && !m.includes('آجل') && !m.includes('تقسيط') && !m.includes('credit'));
                    });
                } else {
                    data = data.filter(t => t.method && t.method.includes(methodFilter));
                }
            }

            if (catFilter !== 'all') {

                data = data.filter(t => {

                    const prod = productsDB.find(p => p.name === t.product);

                    return prod && prod.category === catFilter;

                });

            }

            // تطبيق فرز وتريب التاريخ والوقت قبل العرض
            data.sort((a, b) => {
                const dateA = a.dateISO || '';
                const dateB = b.dateISO || '';
                const timeA = a.timeISO || '00:00';
                const timeB = b.timeISO || '00:00';
                
                const datetimeA = dateA + ' ' + timeA;
                const datetimeB = dateB + ' ' + timeB;
                
                if (analysisDateSortDir === 'desc') {
                    return datetimeB.localeCompare(datetimeA);
                } else {
                    return datetimeA.localeCompare(datetimeB);
                }
            });

            // 3. حساب الإجماليات للفترة المحددة (لحساب النسب)

            let totalPeriodProfit = 0;

            let totalPeriodSales = 0;

            data.forEach(t => {

                const isReturn = t.type.includes('مرتجع');

                let profit = parseFloat(t.profit);

                let total = parseFloat(t.total) || 0;

                if (isNaN(profit)) {

                    const p = productsDB.find(x => x.name === t.product);

                    const cost = p ? (parseFloat(p.cost) || parseFloat(p.buyPrice) || 0) : 0;

                    profit = (parseFloat(t.price) - cost) * parseFloat(t.qty);

                }

                if (isReturn) {

                    totalPeriodProfit -= profit;

                    totalPeriodSales -= total;

                } else {

                    totalPeriodProfit += profit;

                    totalPeriodSales += total;

                }

            });

            document.getElementById('anTotalSales').innerText = totalPeriodSales.toFixed(2);

            document.getElementById('anTotalProfit').innerText = totalPeriodProfit.toFixed(2);

            // تحديث كروت الـ KPI الجديدة

            const kpiSales = document.getElementById('kpi-total-sales');

            const kpiProfit = document.getElementById('kpi-total-profit');

            if (kpiSales) kpiSales.innerText = totalPeriodSales.toLocaleString('en-US', { minimumFractionDigits: 2 });

            if (kpiProfit) kpiProfit.innerText = totalPeriodProfit.toLocaleString('en-US', { minimumFractionDigits: 2 });

            // تحديث الرسوم البيانية

            updateAnalysisCharts(data);

            // 4. رسم الجدول

            if (data.length === 0) {

                tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:20px;">لا توجد مبيعات في هذه الفترة</td></tr>';

                return;

            }

            if (currentAnalysisMode === 'detailed') {

                data.forEach((t, idx) => {

                    const isReturn = t.type.includes('مرتجع');

                    const qty = parseFloat(t.qty) || 0;
                    const price = parseFloat(t.price) || 0;
                    const absQty = Math.abs(qty) || 1;

                    // تنظيف وتثبيت قيمة الربح
                    let rawProfit = parseFloat(t.profit);
                    
                    // جلب التكلفة الأساسية ومعامل التحويل من قاعدة البيانات
                    const p = productsDB.find(x => x.name === t.product);
                    let dbCost = p ? (parseFloat(p.cost) || parseFloat(p.buyPrice) || 0) : 0;
                    
                    // استخراج معامل التحويل: إما المخزن في الحركة (unitFactor) أو نجده بمطابقة اسم الوحدة المستخدمة في الحركة
                    let factor = parseFloat(t.unitFactor) || 1;
                    if (p && (!t.unitFactor || t.unitFactor === 1)) {
                        // إذا كانت الوحدة المستخدمة فرعية وليست الأساسية، نبحث عن معاملها في قاعدة البيانات
                        const isSubUnit = p.subUnits && p.subUnits.find(u => u.unitName === t.unit);
                        if (isSubUnit) {
                            factor = parseFloat(isSubUnit.factor) || 1;
                        }
                    }

                    // إذا كان المنتج يحتوي على معامل تحويل والعملية تمت بوحدة فرعية، نضرب التكلفة الأساسية في المعامل
                    if (factor !== 1) {
                        dbCost = dbCost * factor;
                    }
                    
                    // إذا كان الربح المخزن بالعملية غير صالح، أو إذا كان الربح المستخرج (بالمطلق) أكبر من إجمالي المبيعات نفسها (مما يعني خطأ بالتجميع أو تداخل الوحدات الفرعية)
                    if (isNaN(rawProfit) || Math.abs(rawProfit) > (price * absQty)) {
                        // الربح = (سعر بيع القطعة الحالي - التكلفة المسجلة للقطعة) * الكمية المطلقة
                        rawProfit = (price - dbCost) * absQty;
                    }

                    // التكلفة الفردية = سعر البيع للقطعة - (الربح للسطر / الكمية المطلقة)
                    let costPrice = price - (rawProfit / absQty);
                    if (costPrice < 0) costPrice = 0; // لضمان عدم ظهور تكلفة سالبة

                    // الربح المعروض للسطر: سالب دائماً للمرتجع
                    const displayProfit = isReturn ? -rawProfit : rawProfit;

                    // 100% للإجمالي: نسبة ربح هذا السطر إلى إجمالي ربح الفترة بالكامل
                    const profitPercentTotal = totalPeriodProfit !== 0 ? ((displayProfit / totalPeriodProfit) * 100).toFixed(1) : 0;

                    // 100% للتكلفة: نسبة الربح إلى تكلفة السطر
                    const lineCostTotal = costPrice * absQty;
                    const profitPercentCost = lineCostTotal > 0 ? ((displayProfit / lineCostTotal) * 100).toFixed(1) : 0;

                    const isLoss = displayProfit < 0;

                    const rowClass = isReturn ? 'return-row' : (isLoss ? 'loss-row' : '');

                    tbody.innerHTML += `

                        <tr class="${rowClass}">

                            <td style="text-align:center;"><input type="checkbox" onclick="event.stopPropagation()" class="inv-row-check" onchange="if(this.checked) { document.querySelectorAll('#analysisTableBody input.inv-row-check').forEach(box => { if(box !== this) box.checked = false; }); }"></td>

                            <td>${t.invoiceId || '-'}</td>

                            <td>${t.dateISO}</td>

                            <td>${t.timeISO || '-'}</td>

                            <td style="font-weight:bold; color:${isReturn ? '#ef4444' : '#10b981'}; cursor:pointer;" onclick="event.stopPropagation(); if('${t.invoiceId}' !== '-') viewInvoiceItems('${t.invoiceId}', '${t.type}');">${t.type || 'بيع'}</td>

                            <td>${t.partner}</td>

                            <td>
                                <div>${isReturn ? '↩️ ' : ''}${t.product}</div>
                                ${(t.size || t.color) ? `<div style="font-size:0.75rem; color:#4338ca; font-weight:bold; margin-top:2px;">${t.size ? `[مقاس: ${t.size}] ` : ''}${t.color ? `(لون: ${t.color})` : ''}</div>` : ''}
                            </td>

                            <td>${isReturn ? '-' : ''}${qty} ${t.unit ? `<small style="color:#64748b;">${t.unit}</small>` : ''}</td>

                            <td>${costPrice.toFixed(2)} <span style="font-size:0.75rem; color:#64748b; font-weight:normal;">(${(costPrice * absQty).toFixed(2)})</span></td>

                            <td>${price.toFixed(2)}</td>

                            <td class="profit-col" style="color:${isLoss ? '#ef4444' : '#10b981'}; font-weight:bold;">${displayProfit.toFixed(2)}</td>

                            <td class="profit-col">${profitPercentTotal}%</td>

                            <td class="profit-col">${profitPercentCost}%</td>

                        </tr>

                    `;

                });

            } else {

                const groups = {};

                data.forEach(t => {

                    const isReturn = t.type.includes('مرتجع');

                    if (!groups[t.product]) {

                        groups[t.product] = { name: t.product, qty: 0, total: 0, profit: 0, cost: 0 };

                    }

                    const qty = parseFloat(t.qty);

                    const total = parseFloat(t.total);

                    let profit = parseFloat(t.profit);

                    let costPrice = 0;

                    if (isNaN(profit)) {

                        const p = productsDB.find(x => x.name === t.product);

                        costPrice = p ? (parseFloat(p.cost) || parseFloat(p.buyPrice) || 0) : 0;

                        profit = (parseFloat(t.price) - costPrice) * qty;

                    } else {

                        const price = parseFloat(t.price);

                        costPrice = price - (profit / qty);

                    }

                    if (isReturn) {

                        groups[t.product].qty -= qty;

                        groups[t.product].total -= total;

                        groups[t.product].profit -= profit;

                        groups[t.product].cost -= (costPrice * qty);

                    } else {

                        groups[t.product].qty += qty;

                        groups[t.product].total += total;

                        groups[t.product].profit += profit;

                        groups[t.product].cost += (costPrice * qty);

                    }

                });

                Object.values(groups).forEach((g, idx) => {

                    const avgPrice = g.qty !== 0 ? g.total / g.qty : 0;

                    const profitPercentTotal = totalPeriodProfit !== 0 ? ((g.profit / totalPeriodProfit) * 100).toFixed(1) : 0;

                    const profitPercentCost = g.cost > 0 ? ((g.profit / g.cost) * 100).toFixed(1) : 0;

                    const isLoss = g.profit < 0;

                    const rowClass = isLoss ? 'loss-row' : '';

                    tbody.innerHTML += `

                        <tr class="${rowClass}" style="background: rgba(255,255,255,0.5);">

                            <td style="text-align:center;"><input type="checkbox" class="inv-row-check" onchange="if(this.checked) { document.querySelectorAll('#analysisTableBody input.inv-row-check').forEach(box => { if(box !== this) box.checked = false; }); }"></td>

                            <td style="font-weight:900;">${idx + 1}</td>

                            <td style="color:#64748b;">مجمع مبيعات</td> <!-- التاريخ -->

                            <td style="color:#64748b;">-</td> <!-- الوقت -->

                            <td style="color:#64748b;">-</td> <!-- نوع العملية -->

                            <td style="color:#64748b;">-</td> <!-- العميل -->

                            <td style="font-weight:bold; color:var(--main-purple); font-size:1rem;">📦 ${g.name}</td> <!-- الصنف -->

                            <td style="font-weight:bold; text-align:center;">${g.qty}</td> <!-- الكمية -->

                            <td style="color:#64748b;">${(g.cost / (g.qty || 1)).toFixed(2)}</td> <!-- التكلفة (متوسط التكلفة للقطعة) -->

                            <td style="font-weight:bold;">${avgPrice.toFixed(2)}</td> <!-- سعر البيع (متوسط سعر البيع) -->

                            <td class="profit-col" style="color:${isLoss ? '#ef4444' : '#10b981'}; font-weight:900; font-size:1.1rem;">${g.profit.toFixed(2)}</td> <!-- الربح -->

                            <td class="profit-col" style="font-weight:bold;">${profitPercentTotal}%</td> <!-- % للإجمالي -->

                            <td class="profit-col">${g.cost > 0 ? profitPercentCost + '%' : '-'}</td> <!-- % للتكلفة -->

                        </tr>

                    `;

                });

            }

            applyAnalysisColumnVisibility();

        }

        // --- تخصيص أعمدة تحليل المبيعات ---

        let analysisColumnVisibility = JSON.parse(getStore('pos_an_cols') || '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true,"11":true,"12":true}');

        function toggleAnalysisColumn(index, isVisible) {

            analysisColumnVisibility[index] = isVisible;

            setStore('pos_an_cols', JSON.stringify(analysisColumnVisibility));

            applyAnalysisColumnVisibility();

        }

        function applyAnalysisColumnVisibility() {

            const table = document.querySelector('#analysis-section .invoice-table');

            if (!table) return;

            const theadRows = table.querySelectorAll('thead th');

            const tbodyRows = table.querySelectorAll('tbody tr');

            theadRows.forEach((th, i) => {

                th.style.display = analysisColumnVisibility[i] ? '' : 'none';

            });

            tbodyRows.forEach(tr => {

                const tds = tr.querySelectorAll('td');

                tds.forEach((td, i) => {

                    td.style.display = (analysisColumnVisibility[i] !== undefined) ? (analysisColumnVisibility[i] ? '' : 'none') : '';

                });

            });

        }

        function showAnalysisColumnCustomizer() {

            const cols = [

                { id: 0, name: "تحديد" },

                { id: 1, name: "#" },

                { id: 2, name: "التاريخ" },

                { id: 3, name: "الوقت" },

                { id: 4, name: "نوع العملية" },

                { id: 5, name: "العميل" },

                { id: 6, name: "الصنف" },

                { id: 7, name: "الكمية" },

                { id: 8, name: "التكلفة" },

                { id: 9, name: "سعر البيع" },

                { id: 10, name: "الربح" },

                { id: 11, name: "% للإجمالي" },

                { id: 12, name: "% للتكلفة" }

            ];

            let html = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; padding:15px 0;">`;

            cols.forEach(c => {

                const checked = analysisColumnVisibility[c.id] ? 'checked' : '';

                html += `<label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:10px 12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; font-size:0.9rem; font-weight:bold; color:#334155; transition: all 0.2s ease-in-out; user-select:none;" onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0';">

                            <input type="checkbox" ${checked} onchange="toggleAnalysisColumn(${c.id}, this.checked)" style="width:16px; height:16px; accent-color:#4f46e5; cursor:pointer;"> ${c.name}

                         </label>`;

            });

            html += `</div>`;

            const modal = document.createElement('div');

            modal.className = 'modal-overlay';

            modal.style.cssText = `

                position: fixed; top: 0; left: 0; width: 100%; height: 100%;

                background: rgba(15, 23, 42, 0.6); 

                z-index: 12000; display: flex; align-items: center; justify-content: center;

                direction: rtl; font-family: 'Cairo', sans-serif;

            `;

            modal.innerHTML = `

                <div style="background: white; width: 460px; max-width: 90%; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.4); padding: 25px; display:flex; flex-direction:column; gap:15px; animation: modalFadeIn 0.3s ease-out;">

                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f1f5f9; padding-bottom:12px;">

                        <h3 style="margin:0; font-size:1.15rem; font-weight:900; color:#1e293b; display:flex; align-items:center; gap:8px;">⚙️ تخصيص أعمدة التحليل</h3>

                        <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#94a3b8; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:0.2s;" onmouseover="this.style.background='#f1f5f9'; this.style.color='#ef4444';" onmouseout="this.style.background='none'; this.style.color='#94a3b8';">&times;</button>

                    </div>

                    ${html}

                    <button class="action-btn btn-save" style="width:100%; margin-top:10px; height:42px; background:linear-gradient(135deg, #4f46e5, #4338ca) !important; color:white !important; border:none !important; border-radius:10px !important; font-weight:900 !important; font-size:0.95rem !important; cursor:pointer; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2); transition: 0.2s;" onmouseover="this.style.transform='translateY(-1px)';" onmouseout="this.style.transform='none';" onclick="this.closest('.modal-overlay').remove()">حفظ وإغلاق</button>

                </div>

            `;

            document.body.appendChild(modal);

        }

        // دالة لفتح الفاتورة للصف المحدد في جدول تحليل المبيعات
        function viewSelectedAnalysisInvoice() {
            const checkedBox = document.querySelector('#analysisTableBody input.inv-row-check:checked');
            if (!checkedBox) {
                return showCustomAlert ? showCustomAlert({ type: 'warning', titleText: '⚠️ تنبيه', msg: 'يرجى اختيار وتحديد عملية من الجدول أولاً.' }) : alert('يرجى تحديد عملية أولاً.');
            }
            // السطر الأب للـ checkbox
            const row = checkedBox.closest('tr');
            if (!row) return;
            
            // قراءة رقم الفاتورة ونوع العملية من السطور المقابلة
            const invoiceIdCell = row.cells[1];
            const typeCell = row.cells[4];
            
            if (invoiceIdCell && typeCell) {
                const invoiceId = invoiceIdCell.innerText.trim();
                const type = typeCell.innerText.trim();
                if (invoiceId && invoiceId !== '-') {
                    viewInvoiceItems(invoiceId, type);
                } else {
                    if (showCustomAlert) showCustomAlert({ type: 'warning', titleText: '⚠️ تنبيه', msg: 'لا توجد فاتورة مرتبطة بهذه العملية.' });
                    else alert('لا توجد فاتورة مرتبطة بهذه العملية.');
                }
            }
        }
        window.viewSelectedAnalysisInvoice = viewSelectedAnalysisInvoice;

        function applyAnalysisPeriodFilter(period) {

            const fromInput = document.getElementById('anDateFrom');

            const toInput = document.getElementById('anDateTo');

            const today = new Date();

            const todayStr = today.toLocaleDateString('en-CA');

            if (period === 'custom') return;

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

                const start = new Date(today); start.setDate(today.getDate() - day);

                fromInput.value = start.toLocaleDateString('en-CA');

                toInput.value = todayStr;

            } else if (period === 'lastweek') {

                const start = new Date(today); start.setDate(today.getDate() - today.getDay() - 7);

                const end = new Date(today); end.setDate(today.getDate() - today.getDay() - 1);

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

        function exportAnalysisToExcel() {

            const table = document.querySelector('#analysis-section .invoice-table');

            let csv = [];

            const rows = table.querySelectorAll("tr");

            for (let i = 0; i < rows.length; i++) {

                let row = [], cols = rows[i].querySelectorAll("td, th");

                for (let j = 0; j < cols.length; j++) row.push(cols[j].innerText);

                csv.push(row.join(","));

            }

            const blob = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });

            const link = document.createElement("a");

            link.href = URL.createObjectURL(blob);

            link.download = `sales_analysis_${currentAnalysisMode}.csv`;

            link.click();

        }

        function printAnalysisReport() {

            const content = document.querySelector('#analysis-section .table-container').innerHTML;

            const header = `

                <div style="text-align:center; margin-bottom:20px;">

                    <h2>تقرير تحليل المبيعات</h2>

                    <p>الفترة من: ${document.getElementById('anDateFrom').value} إلى: ${document.getElementById('anDateTo').value}</p>

                    <div style="display:flex; justify-content:center; gap:20px; font-weight:bold; margin-top:10px;">

                        <span>إجمالي المبيعات: ${document.getElementById('anTotalSales').innerText}</span>

                        <span>إجمالي تحليل المبيعات: ${document.getElementById('anTotalProfit').innerText}</span>

                    </div>

                </div>

            `;

            document.getElementById('receipt-area').innerHTML = `<div class="print-container">${header}${content}</div>`;

            window.print();

        }

        // --- تقرير العملاء الأكثر إرجاعاً ---

        // --- تقرير العملاء الأكثر إرجاعاً (معدل ليحترم الفلترة) ---

        function renderMostReturningCustomers() {

            const tbody = document.getElementById('analysisTableBody');

            if (!tbody) return;

            tbody.innerHTML = '';

            // 1. جلب الفلاتر الزمنية

            const fromDate = document.getElementById('anDateFrom').value;

            const toDate = document.getElementById('anDateTo').value;

            // 2. تصفية عمليات مرتجع البيع بناءً على الفترة

            let returns = transactions.filter(t => t.type.includes('مرتجع بيع'));

            if (fromDate) returns = returns.filter(t => t.dateISO >= fromDate);

            if (toDate) returns = returns.filter(t => t.dateISO <= toDate);

            if (returns.length === 0) {

                tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:30px; font-weight:bold; color:#64748b;">لا توجد عمليات إرجاع مسجلة في هذه الفترة 🔍</td></tr>';

                return;

            }

            // 3. تجميع حسب العميل (الطرف الثاني)

            const groups = {};

            returns.forEach(t => {

                const partner = t.partner || 'غير محدد';

                if (!groups[partner]) groups[partner] = { name: partner, count: 0, total: 0, products: new Set() };

                groups[partner].count++;

                groups[partner].total += Math.abs(parseFloat(t.total) || 0);

                groups[partner].products.add(t.product);

            });

            // 4. ترتيب تنازلي حسب القيمة الإجمالية للمرتجعات

            const sorted = Object.values(groups).sort((a, b) => b.total - a.total);

            sorted.forEach((g, idx) => {

                const productList = Array.from(g.products);

                const displayProducts = productList.length > 2 ? productList.slice(0, 2).join(' + ') + ` (+${productList.length - 2})` : productList.join(' + ');

                tbody.innerHTML += `

                    <tr style="background-color: #fef2f2; border-right: 4px solid #ef4444;">

                        <td style="text-align:center;"><input type="checkbox"></td>

                        <td style="font-weight:900;">${idx + 1}</td>

                        <td style="color:#64748b;">تقرير مجمع</td>

                        <td style="font-weight:bold; color:#1e293b;">${g.name}</td>

                        <td style="color:#ef4444; font-weight:bold;">🔄 ${displayProducts}</td>

                        <td style="text-align:center; font-weight:bold;">${g.count} فواتير</td>

                        <td>-</td>

                        <td style="font-weight:900; color:#ef4444;">${g.total.toFixed(2)}</td>

                        <td class="profit-col" style="color:#64748b;">-</td>

                        <td class="profit-col">-</td>

                        <td class="profit-col">-</td>

                    </tr>

                `;

            });

            showToast("📊 تم عرض تقرير المرتجعات للفترة المحددة");

        }

        // ================= منطق لوحة التحكم (Dashboard) =================

        function updateDashboard() {

            // تم نقل الإحصائيات إلى تقرير الحركة اليومية، اللوحة الرئيسية الآن للتنقل

        }

        // ================= منطق المخازن (Inventory Logic) =================

        let currentInvFilter = 'all';

        let selectedInventoryId = null;

        let currentEditingProductId = null;

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
