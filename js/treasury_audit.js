/**
 * ==========================================
 * 💰 JS قسم مراجعة الخزينة (Treasury Audit)
 * ==========================================
 * إدارة وتفاعلات قسم مراجعة الخزينة، القفز السريع، والبند المخصص.
 */

window.treasuryAuditRecords = [];

// 1. تهيئة قسم مراجعة الخزينة مع استرجاع مضمون من SQLite
async function initTreasuryAuditSection() {
    console.log("🔄 جاري تهيئة وتحميل بيانات قسم مراجعة الخزينة من SQLite...");
    
    // ضبط تاريخ اليوم المحلي تلقائياً عند الدخول
    const dateInput = document.getElementById('trDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toLocaleDateString('en-CA');
    }

    // جلب البيانات الدائمة والمحفوظة في SQLite
    if (window.bayanDB) {
        try {
            if (window.bayanDB.treasuryAudit) {
                window.treasuryAuditRecords = await window.bayanDB.treasuryAudit.toArray();
            } else if (window.bayanDB.tables.some(t => t.name === 'treasuryAudit')) {
                window.treasuryAuditRecords = await window.bayanDB.table("treasuryAudit").toArray();
            }
            console.log("✅ تم استرجاع سجلات الخزينة من SQLite بنجاح:", (window.treasuryAuditRecords || []).length, "عملية.");
        } catch (e) {
            console.warn("⚠️ تم تجهيز السجلات بنجاح في الذاكرة الحية.", e.message);
        }
    }

    updateTreasuryAuditStats();
    renderTreasuryAuditTable();
    loadTreasuryNotesContent();
}

// 2. دالة القفز السريع للتاريخ (اليوم، الأمس، الأسبوع الحالي، الأسبوع السابق، الشهر الحالي، الشهر السابق، العام الحالي، العام السابق)
function handleTreasuryQuickJump(val) {
    const dateInput = document.getElementById('trDate');
    if (!dateInput) return;

    const now = new Date();
    
    if (val === 'today') {
        dateInput.value = now.toLocaleDateString('en-CA');
    } else if (val === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        dateInput.value = y.toLocaleDateString('en-CA');
    } else if (val === 'this_week') {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        dateInput.value = startOfWeek.toLocaleDateString('en-CA');
    } else if (val === 'last_week') {
        const dayOfWeek = now.getDay();
        const startOfLastWeek = new Date(now);
        startOfLastWeek.setDate(now.getDate() - dayOfWeek - 7);
        dateInput.value = startOfLastWeek.toLocaleDateString('en-CA');
    } else if (val === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateInput.value = startOfMonth.toLocaleDateString('en-CA');
    } else if (val === 'last_month') {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        dateInput.value = startOfLastMonth.toLocaleDateString('en-CA');
    } else if (val === 'this_year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateInput.value = startOfYear.toLocaleDateString('en-CA');
    } else if (val === 'last_year') {
        const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
        dateInput.value = startOfLastYear.toLocaleDateString('en-CA');
    }

    updateTreasuryAuditStats();
    renderTreasuryAuditTable();

    // ⚡ تحديث المبلغ تلقائياً فوراً إذا كان البند المختار "مبيعات"
    const catSelect = document.getElementById('trCategory');
    if (catSelect && catSelect.value === 'مبيعات') {
        handleTreasuryCategoryChange('مبيعات');
    }
}

// 2.01 دالة التعامل المباشر عند تغيير مدخل التاريخ بيدك
function handleTreasuryDateInputChange() {
    const quickSelect = document.getElementById('trQuickJump');
    if (quickSelect) {
        // نضبط خيار القفز السريع ليطابق التاريخ أو نجعله فارغاً/مخصصاً لتجنب التضارب
        quickSelect.value = 'custom';
    }
    updateTreasuryAuditStats();
    renderTreasuryAuditTable();

    // ⚡ تحديث المبلغ تلقائياً فوراً إذا كان البند المختار "مبيعات"
    const catSelect = document.getElementById('trCategory');
    if (catSelect && catSelect.value === 'مبيعات') {
        handleTreasuryCategoryChange('مبيعات');
    }
}

// 2.1 دالة مساعدة للحصول على نطاق تاريخ بداية ونهاية حسب الخيار المحدد
function getTreasuryDateRange() {
    const quickJump = document.getElementById('trQuickJump') ? document.getElementById('trQuickJump').value : 'custom';
    const dateInputVal = document.getElementById('trDate') ? document.getElementById('trDate').value : new Date().toLocaleDateString('en-CA');
    
    const now = new Date();

    if (quickJump === 'today') {
        const todayStr = now.toLocaleDateString('en-CA');
        return { start: todayStr, end: todayStr };
    } else if (quickJump === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const yStr = y.toLocaleDateString('en-CA');
        return { start: yStr, end: yStr };
    } else if (quickJump === 'this_week') {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return { start: startOfWeek.toLocaleDateString('en-CA'), end: endOfWeek.toLocaleDateString('en-CA') };
    } else if (quickJump === 'last_week') {
        const dayOfWeek = now.getDay();
        const startOfLastWeek = new Date(now);
        startOfLastWeek.setDate(now.getDate() - dayOfWeek - 7);
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        return { start: startOfLastWeek.toLocaleDateString('en-CA'), end: endOfLastWeek.toLocaleDateString('en-CA') };
    } else if (quickJump === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: startOfMonth.toLocaleDateString('en-CA'), end: endOfMonth.toLocaleDateString('en-CA') };
    } else if (quickJump === 'last_month') {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: startOfLastMonth.toLocaleDateString('en-CA'), end: endOfLastMonth.toLocaleDateString('en-CA') };
    } else if (quickJump === 'this_year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        return { start: startOfYear.toLocaleDateString('en-CA'), end: endOfYear.toLocaleDateString('en-CA') };
    } else if (quickJump === 'last_year') {
        const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
        return { start: startOfLastYear.toLocaleDateString('en-CA'), end: endOfLastYear.toLocaleDateString('en-CA') };
    }

    return { start: dateInputVal, end: dateInputVal };
}

// 3. دالة التحكم في البند المخصص وتعبئة إجمالي المبيعات والمقبوضات تلقائياً عند اختيار "مبيعات"
function handleTreasuryCategoryChange(val) {
    const customInput = document.getElementById('trCustomCategory');
    if (customInput) {
        if (val === '__custom__') {
            customInput.classList.remove('hidden');
            customInput.focus();
        } else {
            customInput.classList.add('hidden');
            customInput.value = '';
        }
    }

    // 🎯 عند اختيار بند "مبيعات": يحسب صافي النقدية بالدرج بدقة
    if (val === 'مبيعات' || val === 'مبيعات كاش') {
        const dateInput = document.getElementById('trDate');
        let currentDate = (dateInput && dateInput.value) ? dateInput.value.trim() : '';
        if (!currentDate) {
            currentDate = new Date().toLocaleDateString('en-CA');
            if (dateInput) dateInput.value = currentDate;
        }

        const res = calculateNetCashDrawerInflow(currentDate);

        const bottomInput = document.getElementById('trAmountBottom');
        if (bottomInput) {
            bottomInput.value = res.netCashInflow.toFixed(2);
            bottomInput.focus();
            bottomInput.select();
        }

        const notesInput = document.getElementById('trNotes');
        if (notesInput && (!notesInput.value || notesInput.value.startsWith('صافي مبيعات كاش وقبض'))) {
            notesInput.value = res.notesBreakdown;
        }

        if (typeof showToast === 'function') {
            showToast(`✅ تم جلب صافي حركة المبيعات النقدية بالدرج: ${res.netCashInflow.toFixed(2)} ج.م`, 'info');
        }
    }
}

// 🎯 دالة مركزية لحساب صافي حركة النقدية الصافية بالدرج لتاريخ محدد (مبيعات كاش + قبض كاش + مرتجع شراء كاش - مرتجع بيع كاش فقط)
function calculateNetCashDrawerInflow(targetDate) {
    let currentDate = targetDate ? String(targetDate).trim() : '';
    if (!currentDate) {
        const dateInput = document.getElementById('trDate');
        currentDate = (dateInput && dateInput.value) ? dateInput.value.trim() : new Date().toLocaleDateString('en-CA');
    }

    let netCashInflow = 0;
    let totalCashSales = 0;
    let totalCashReceipts = 0;
    let totalCashPurReturns = 0;
    let totalCashSalesReturns = 0;

    const isNonCashMethod = (m) => {
        if (!m) return false;
        const s = String(m).toLowerCase();
        return s.includes('بنك') || s.includes('تحويل') || s.includes('فيزا') || s.includes('شيك') || s.includes('شبكة') || s.includes('فودافون') || s.includes('انستاباي') || s.includes('إنستاباي') || s.includes('insta') || s.includes('محفظة');
    };

    const isDeferredMethod = (m) => {
        if (!m) return false;
        const s = String(m).toLowerCase();
        return s.includes('آجل') || s.includes('اجل') || s.includes('ذمم') || s.includes('credit') || s.includes('تقسيط') || s.includes('حساب');
    };

    try {
        const allTx = (window.transactions || []);
        const cleanDate = currentDate.slice(0, 10);

        const salesInvoices = {};
        const salesReturnsInvoices = {};
        const purReturnsInvoices = {};
        const directReceipts = [];

        allTx.forEach((t, i) => {
            let tDate = (t.dateISO || t.date || '').trim();
            if (tDate.includes('T')) tDate = tDate.split('T')[0];
            else if (tDate.match(/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4}/)) {
                const parts = tDate.split(/[\/\.-]/);
                tDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (tDate.length > 10) {
                tDate = tDate.slice(0, 10);
            }

            if (tDate !== cleanDate) return;

            const typeStr = String(t.type || '');
            const methodStr = String(t.method || t.paymentMethod || '');
            const partnerStr = String(t.partner || '').trim();
            const totalAmt = parseFloat(t.total) || parseFloat(t.price) || 0;
            const paidAmt = parseFloat(t.paidAmount != null ? t.paidAmount : (t.paid || 0));

            // 1. فواتير البيع
            if (typeStr.includes('بيع') && !typeStr.includes('مرتجع')) {
                const invId = t.invoiceId || ('sale_' + i);
                if (!salesInvoices[invId]) {
                    salesInvoices[invId] = { total: 0, paid: 0, method: methodStr, partner: partnerStr };
                }
                salesInvoices[invId].total += totalAmt;
                if (t.isInvoiceHead || t.paidAmount !== undefined || t.paid !== undefined) {
                    salesInvoices[invId].paid = Math.max(salesInvoices[invId].paid, paidAmt);
                }
            }
            // 2. مرتجع بيع
            else if (typeStr.includes('مرتجع بيع')) {
                const invId = t.invoiceId || ('ret_sale_' + i);
                if (!salesReturnsInvoices[invId]) {
                    salesReturnsInvoices[invId] = { total: 0, paid: 0, method: methodStr, partner: partnerStr };
                }
                salesReturnsInvoices[invId].total += totalAmt;
                if (t.isInvoiceHead || t.paidAmount !== undefined || t.paid !== undefined) {
                    salesReturnsInvoices[invId].paid = Math.max(salesReturnsInvoices[invId].paid, paidAmt);
                }
            }
            // 3. مرتجع شراء
            else if (typeStr.includes('مرتجع شراء')) {
                const invId = t.invoiceId || ('ret_pur_' + i);
                if (!purReturnsInvoices[invId]) {
                    purReturnsInvoices[invId] = { total: 0, paid: 0, method: methodStr, partner: partnerStr };
                }
                purReturnsInvoices[invId].total += totalAmt;
                if (t.isInvoiceHead || t.paidAmount !== undefined || t.paid !== undefined) {
                    purReturnsInvoices[invId].paid = Math.max(purReturnsInvoices[invId].paid, paidAmt);
                }
            }
            // 4. سندات القبض
            else if (typeStr.includes('قبض')) {
                if (!isNonCashMethod(methodStr) && !isDeferredMethod(methodStr)) {
                    directReceipts.push(totalAmt > 0 ? totalAmt : paidAmt);
                }
            }
        });

        // مبيعات كاش
        Object.values(salesInvoices).forEach(iv => {
            if (isNonCashMethod(iv.method)) return;
            if (isDeferredMethod(iv.method)) {
                totalCashSales += (iv.paid || 0);
            } else {
                totalCashSales += (iv.paid > 0 ? iv.paid : iv.total);
            }
        });

        // سندات قبض كاش
        directReceipts.forEach(amt => {
            totalCashReceipts += amt;
        });

        // مرتجع شراء كاش (مسترد كاش بالدرج: +)
        Object.values(purReturnsInvoices).forEach(iv => {
            if (isNonCashMethod(iv.method)) return;
            if (isDeferredMethod(iv.method)) {
                totalCashPurReturns += (iv.paid || 0);
            } else {
                totalCashPurReturns += (iv.paid > 0 ? iv.paid : iv.total);
            }
        });

        // مرتجع بيع كاش (مردود كاش للزبون من الدرج: -)
        Object.values(salesReturnsInvoices).forEach(iv => {
            if (isNonCashMethod(iv.method)) return;
            if (isDeferredMethod(iv.method)) {
                totalCashSalesReturns += (iv.paid || 0); // الآجل لا يمس الدرج
            } else {
                totalCashSalesReturns += (iv.paid > 0 ? iv.paid : iv.total);
            }
        });

        netCashInflow = (totalCashSales + totalCashReceipts + totalCashPurReturns) - totalCashSalesReturns;
    } catch (e) {
        console.warn("خطأ في جلب صافي حركة المبيعات بالدرج:", e);
    }

    let parts = [`مبيعات كاش: ${totalCashSales.toFixed(2)}`];
    if (totalCashSalesReturns > 0) parts.push(`مرتجع كاش: -${totalCashSalesReturns.toFixed(2)}`);
    if (totalCashReceipts > 0) parts.push(`قبض: +${totalCashReceipts.toFixed(2)}`);
    if (totalCashPurReturns > 0) parts.push(`مرتجع شراء كاش: +${totalCashPurReturns.toFixed(2)}`);
    const notesBreakdown = `صافي مبيعات كاش وقبض (${parts.join(' | ')})`;

    return {
        netCashInflow,
        totalCashSales,
        totalCashReceipts,
        totalCashPurReturns,
        totalCashSalesReturns,
        notesBreakdown
    };
}

// 4. تحديث إحصائيات الكروت والملخص المالي المنطقي الشامل
function updateTreasuryAuditStats() {
    const records = window.treasuryAuditRecords || [];
    const range = getTreasuryDateRange();
    
    // فلترة عمليات الفترة المحددة
    const filteredRecords = records.filter(r => r.date >= range.start && r.date <= range.end);

    let salesTotal = 0;       // إجمالي المبيعات (المطلوبة)
    let cashTotal = 0;        // فودافون كاش
    let instaTotal = 0;       // انستا باي
    let actualCollected = 0;  // إجمالي المحصل الفعلي (انستاباي، فودافون كاش، مقبوضات)
    let expensesTotal = 0;    // المصروفات والمنصرف
    let sumTop = 0;
    let sumBottom = 0;

    filteredRecords.forEach(r => {
        const top = parseFloat(r.amountTop) || 0;
        const bottom = parseFloat(r.amountBottom) || 0;
        const rowTotal = top + bottom;

        sumTop += top;
        sumBottom += bottom;

        const cat = String(r.category || '').trim();

        if (cat === 'مبيعات' || cat === 'مبيعات كاش') {
            salesTotal += rowTotal;
        } else if (cat === 'مصروفات خزانة' || cat === 'تحويلات خارجية' || cat.includes('مصروف') || cat.includes('سلفة') || cat.includes('خصم')) {
            expensesTotal += rowTotal;
        } else {
            // انستاباي، فودافون كاش، أو أي متحصلات
            actualCollected += rowTotal;
            if (cat === 'فودافون كاش') cashTotal += rowTotal;
            if (cat === 'انستا باي') instaTotal += rowTotal;
        }
    });

    // 🎯 المعادلة المحاسبية الحقيقية والمنطقية:
    // الفارق = (الفلوس الفعلية المحصلة - المصروفات) - المبيعات المطلوبة
    // 1. لو المحصل 500 والمبيعات 168.5 👈 زيادة +331.50 ج.م 🟢
    // 2. لو المحصل 200 والمبيعات 500 👈 عجز -300.00 ج.م 🔴
    // 3. لو المحصل 500 والمبيعات 500 👈 متطابق 0.00 ⚖️
    let netDiff = 0;
    const netActual = actualCollected - expensesTotal;
    if (actualCollected > 0 || expensesTotal > 0) {
        netDiff = netActual - salesTotal;
    } else {
        // مبيعات فقط دون إدخال مدفوعات أخرى
        netDiff = 0;
    }

    // تحديث الكروت العلوية
    if (document.getElementById('trSalesTotal')) document.getElementById('trSalesTotal').innerText = salesTotal.toFixed(2);
    if (document.getElementById('trOpsCount')) document.getElementById('trOpsCount').innerText = filteredRecords.length;
    if (document.getElementById('trCashTotal')) document.getElementById('trCashTotal').innerText = cashTotal.toFixed(2);
    if (document.getElementById('trInstaTotal')) document.getElementById('trInstaTotal').innerText = instaTotal.toFixed(2);

    // ⚖️ تحديث كارت "صافي اليوم" بالفرق المحاسبي الصريح
    const netCard = document.getElementById('trNetTotalCard');
    const netBadge = document.getElementById('trNetStatusBadge');
    const netSubtext = document.getElementById('trNetTotalSubtext');
    const netValEl = document.getElementById('trNetTotal');

    if (Math.abs(netDiff) < 0.001) {
        // متطابق 0.00 ⚖️
        if (netValEl) netValEl.innerText = "0.00";
        if (netCard) {
            netCard.className = 'tr-stat-card tr-card-green';
            netCard.style.borderColor = '#34d399';
            netCard.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.3)';
        }
        if (netBadge) {
            netBadge.innerHTML = 'متطابق ⚖️';
            netBadge.style.background = 'rgba(0, 0, 0, 0.5)';
            netBadge.style.color = '#ffffff';
            netBadge.style.border = '1px solid #34d399';
            netBadge.style.padding = '3px 10px';
            netBadge.style.fontWeight = '900';
            netBadge.style.borderRadius = '8px';
        }
        if (netSubtext) {
            netSubtext.innerHTML = `<span style="background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.25); color: #ffffff; padding: 4px 10px; border-radius: 8px; font-weight: 800; display: inline-block; margin-top: 4px; font-size: 0.82rem;">✅ الحسابات متطابقة تماماً (0.00 ج.م)</span>`;
        }
    } else if (netDiff > 0) {
        // زيادة بالموجب (+) 🟢 فلوس زيادة في الخزينة
        if (netValEl) netValEl.innerText = `+${netDiff.toFixed(2)}`;
        if (netCard) {
            netCard.className = 'tr-stat-card tr-card-green';
            netCard.style.borderColor = '#10b981';
            netCard.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.4)';
        }
        if (netBadge) {
            netBadge.innerHTML = '🟢 زيادة بالخزينة';
            netBadge.style.background = 'rgba(0, 0, 0, 0.55)';
            netBadge.style.color = '#ffffff';
            netBadge.style.border = '1.5px solid #34d399';
            netBadge.style.padding = '3px 10px';
            netBadge.style.fontWeight = '900';
            netBadge.style.borderRadius = '8px';
        }
        if (netSubtext) {
            netSubtext.innerHTML = `<span style="background: rgba(0, 0, 0, 0.5); border: 1.5px solid rgba(255, 255, 255, 0.3); color: #ffffff; padding: 4px 12px; border-radius: 8px; font-weight: 900; display: inline-block; margin-top: 5px; font-size: 0.82rem;">🟢 زيادة في الخزينة بمبلغ: <strong style="color: #6ee7b7; font-size: 0.95rem;">+${netDiff.toFixed(2)} ج.م</strong></span>`;
        }
    } else {
        // عجز بالسالب (-) 🔴 فلوس ناقصة
        if (netValEl) netValEl.innerText = `-${Math.abs(netDiff).toFixed(2)}`;
        if (netCard) {
            netCard.className = 'tr-stat-card tr-card-red';
            netCard.style.borderColor = '#f87171';
            netCard.style.boxShadow = '0 8px 25px rgba(220, 38, 38, 0.45)';
        }
        if (netBadge) {
            netBadge.innerHTML = '🔴 عجز بالخزينة';
            netBadge.style.background = 'rgba(0, 0, 0, 0.65)';
            netBadge.style.color = '#ffffff';
            netBadge.style.border = '1.5px solid #fca5a5';
            netBadge.style.padding = '3px 10px';
            netBadge.style.fontWeight = '900';
            netBadge.style.borderRadius = '8px';
            netBadge.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
        }
        if (netSubtext) {
            netSubtext.innerHTML = `<span style="background: rgba(0, 0, 0, 0.55); border: 1.5px solid rgba(255, 255, 255, 0.35); color: #ffffff; padding: 4px 12px; border-radius: 8px; font-weight: 900; display: inline-block; margin-top: 5px; text-shadow: 0 1px 3px rgba(0,0,0,0.8); font-size: 0.82rem;">⚠️ عجز في الخزينة بمبلغ: <strong style="color: #fde047; font-size: 0.95rem;">-${Math.abs(netDiff).toFixed(2)} ج.م</strong></span>`;
        }
    }

    // 📊 تحديث الشريط المالي الجانبي (ملخص مالي سريع بدقة ومطابقة تامة)
    if (document.getElementById('trSumSales')) {
        document.getElementById('trSumSales').innerText = salesTotal.toFixed(2);
    }
    const collectedEl = document.getElementById('trSumCollected') || document.getElementById('trSumTop');
    if (collectedEl) {
        collectedEl.innerText = actualCollected.toFixed(2);
    }
    const expensesEl = document.getElementById('trSumExpenses') || document.getElementById('trSumBottom');
    if (expensesEl) {
        expensesEl.innerText = expensesTotal.toFixed(2);
    }
    
    const diffEl = document.getElementById('trSumDiff');
    if (diffEl) {
        if (Math.abs(netDiff) < 0.001) {
            diffEl.innerText = '0.00 (متطابق ⚖️)';
            diffEl.style.color = '#38bdf8';
        } else if (netDiff > 0) {
            diffEl.innerText = `+${netDiff.toFixed(2)} (زيادة 🟢)`;
            diffEl.style.color = '#34d399';
        } else {
            diffEl.innerText = `-${Math.abs(netDiff).toFixed(2)} (عجز 🔴)`;
            diffEl.style.color = '#f87171';
        }
    }

    // تحديث إجماليات الأسفل
    if (document.getElementById('trTotalCatsDay')) document.getElementById('trTotalCatsDay').innerText = [...new Set(filteredRecords.map(r => r.category))].filter(Boolean).length;
    if (document.getElementById('trTotalOpsDay')) document.getElementById('trTotalOpsDay').innerText = filteredRecords.length;

    // تحديث نافذة التفاصيل إذا كانت مفتوحة حالياً
    const detModal = document.getElementById('treasuryDetailsModal');
    if (detModal && detModal.style.display === 'flex' && typeof refreshTreasuryDetailsModal === 'function') {
        refreshTreasuryDetailsModal();
    }
}

// 5. إضافة عملية جديدة مع قواعد التحقق والتنبيه
async function addTreasuryAuditRecord() {
    const date = document.getElementById('trDate').value;
    let category = document.getElementById('trCategory').value;
    const customCategory = document.getElementById('trCustomCategory').value;
    const notes = document.getElementById('trNotes').value;
    const amountTop = parseFloat(document.getElementById('trAmountTop').value) || 0;
    const amountBottom = parseFloat(document.getElementById('trAmountBottom').value) || 0;

    if (category === '__custom__') {
        category = customCategory.trim() || 'بند مخصص';
    }

    // 🚨 شرط التنبيه الصارم: بند المبيعات يكتب في درج النقدية فقط!
    if ((category === 'مبيعات' || category === 'مبيعات كاش') && amountTop > 0) {
        alert("⚠️ تنبيه هام: بند المبيعات يتسجل في خانة (الدرج) فقط ولا يمكن إدخال مبيعات في الخزينة الرئيسية!");
        document.getElementById('trAmountTop').value = '';
        document.getElementById('trAmountTop').focus();
        return;
    }

    if (!category && amountTop === 0 && amountBottom === 0) {
        alert("⚠️ يرجى تحديد البند أو إدخال مبلغ (في الخزينة أو الدرج) على الأقل.");
        return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const newRecord = {
        id: Date.now(),
        date: date || now.toISOString().split('T')[0],
        time: timeStr,
        lastModified: '-',
        device: 'جهاز رئيسي',
        category: category || 'عام',
        amountBottom: amountBottom,
        amountTop: amountTop,
        soldQty: 1,
        total: amountTop + amountBottom,
        notes: notes || '-',
        user: (window.currentUser ? window.currentUser.name : 'مدير النظام')
    };

    window.treasuryAuditRecords.unshift(newRecord);

    // 💾 الحفظ الفوري والدائم في SQLite
    if (window.bayanDB) {
        try {
            if (window.bayanDB.treasuryAudit) {
                await window.bayanDB.treasuryAudit.put(newRecord);
            } else {
                await window.bayanDB.table("treasuryAudit").put(newRecord);
            }
            console.log("💾 تم حفظ عملية الخزينة بنجاح في SQLite.");
            window.treasuryAudit = window.treasuryAuditRecords;
            if (window.BayanNetworkHub && typeof window.BayanNetworkHub.onDataSaved === 'function') {
                window.BayanNetworkHub.onDataSaved();
            }
        } catch (e) {
            console.warn("⚠️ حفظ تلقائي للعملية بالذاكرة والسجلات...", e);
        }
    }

    resetTreasuryAuditForm();
    updateTreasuryAuditStats();
    renderTreasuryAuditTable();
}

// 6. تفريغ النموذج مع التنبيه
function resetTreasuryAuditForm() {
    const cat = document.getElementById('trCategory').value;
    const customInput = document.getElementById('trCustomCategory');
    const customVal = customInput ? customInput.value : '';
    const notes = document.getElementById('trNotes').value;
    const amountTop = document.getElementById('trAmountTop').value;
    const amountBottom = document.getElementById('trAmountBottom').value;

    const isEmpty = (!cat && !customVal && !notes && !amountTop && !amountBottom);

    if (isEmpty) {
        alert("⚠️ لا يوجد أي بيانات في الخانات لتفريغها!");
        return;
    }

    document.getElementById('trCategory').value = '';
    if (customInput) {
        customInput.value = '';
        customInput.classList.add('hidden');
    }
    document.getElementById('trNotes').value = '';
    document.getElementById('trAmountTop').value = '';
    document.getElementById('trAmountBottom').value = '';
}

// 7. عرض السجل في الجدول
function renderTreasuryAuditTable() {
    const tbody = document.getElementById('treasuryAuditTableBody');
    if (!tbody) return;

    const records = window.treasuryAuditRecords || [];
    const range = getTreasuryDateRange();

    const filteredRecords = records.filter(r => r.date >= range.start && r.date <= range.end);

    if (filteredRecords.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="padding: 30px; color: #64748b; font-weight: 700;">لا توجد بيانات لعرضها في هذه الفترة</td></tr>`;
        return;
    }

    let html = '';
    filteredRecords.forEach((r, idx) => {
        html += `
            <tr id="tr-row-${r.id}">
                <td>${idx + 1}</td>
                <td>${r.time || '-'}</td>
                <td>${(r.lastModified && r.lastModified !== r.time && r.lastModified !== '-') ? r.lastModified : '-'}</td>
                <td><span style="background: rgba(59,130,246,0.15); color:#60a5fa; padding:4px 10px; border-radius:12px;">${r.category}</span></td>
                <td style="color:#f87171; font-weight:800;">${r.amountBottom ? r.amountBottom.toFixed(2) : '0.00'}</td>
                <td style="color:#34d399; font-weight:800;">${r.amountTop ? r.amountTop.toFixed(2) : '0.00'}</td>
                <td style="color:#fbbf24; font-weight:900;">${(r.total || 0).toFixed(2)}</td>
                <td>${r.notes}</td>
                <td>${r.user}</td>
                <td>
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                        <button onclick="editTreasuryRecord(${r.id})" style="background:#3b82f6; border:none; color:white; border-radius:8px; padding:5px 10px; cursor:pointer; font-weight:800;" title="تعديل العملية">✏️ تعديل</button>
                        <button onclick="deleteTreasuryRecord(${r.id})" style="background:#ef4444; border:none; color:white; border-radius:8px; padding:5px 10px; cursor:pointer; font-weight:800;" title="حذف العملية">🗑️ حذف</button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// دالة التحكم في البند المخصص وتحديث المبالغ تلقائياً عند اختيار مبيعات في نافذة التعديل
function handleEditModalCategoryChange(val) {
    const customInput = document.getElementById('editModalCustomCategory');
    if (customInput) {
        if (val === '__custom__') {
            customInput.classList.remove('hidden');
            customInput.focus();
        } else {
            customInput.classList.add('hidden');
            customInput.value = '';
        }
    }

    // ⚡ عند اختيار "مبيعات": تحديث المبلغ والملاحظات تلقائياً لأحدث قيمة محسوبة
    if (val === 'مبيعات' || val === 'مبيعات كاش') {
        const id = parseInt(document.getElementById('editModalRecordId').value);
        const record = (window.treasuryAuditRecords || []).find(r => r.id === id);
        const targetDate = record ? record.date : (document.getElementById('trDate') ? document.getElementById('trDate').value : '');

        const res = calculateNetCashDrawerInflow(targetDate);
        const bottomInput = document.getElementById('editModalAmountBottom');
        if (bottomInput) {
            bottomInput.value = res.netCashInflow.toFixed(2);
            bottomInput.focus();
            bottomInput.select();
        }
        const notesInput = document.getElementById('editModalNotes');
        if (notesInput) {
            notesInput.value = res.notesBreakdown;
        }
        if (typeof showToast === 'function') {
            showToast(`✅ تم تحديث صافي المبيعات والقبض بالدرج: ${res.netCashInflow.toFixed(2)} ج.م`, 'info');
        }
    }
}

// 8. دالة تعديل عنصر من السجل (فتح النافذة المخصصة مثل الصورة)
function editTreasuryRecord(id) {
    console.log("✏️ جاري فتح نافذة تعديل العملية رقم:", id);
    const record = window.treasuryAuditRecords.find(r => r.id === id);
    if (!record) {
        console.warn("⚠️ لم يتم العثور على العملية رقم:", id);
        return;
    }

    const modal = document.getElementById('editTreasuryRecordModal');
    if (!modal) {
        console.error("❌ لم يتم العثور على النافذة editTreasuryRecordModal في الصفحة");
        return;
    }

    document.getElementById('editModalRecordId').value = record.id;
    document.getElementById('editModalSubTitle').innerText = `تعديل بيانات عملية: ${record.category || 'عام'}`;

    const catSelect = document.getElementById('editModalCategory');
    const customInput = document.getElementById('editModalCustomCategory');
    const standardCategories = ['مبيعات', 'مبيعات كاش', 'فودافون كاش', 'انستا باي', 'مصروفات خزانة', 'تحويلات خارجية', 'تسوية خزينة'];

    if (catSelect) {
        if (standardCategories.includes(record.category)) {
            catSelect.value = record.category;
            if (customInput) customInput.classList.add('hidden');
        } else {
            catSelect.value = '__custom__';
            if (customInput) {
                customInput.classList.remove('hidden');
                customInput.value = record.category || '';
            }
        }
    }

    if (document.getElementById('editModalAmountTop')) document.getElementById('editModalAmountTop').value = record.amountTop || '';
    if (document.getElementById('editModalAmountBottom')) document.getElementById('editModalAmountBottom').value = record.amountBottom || '';
    if (document.getElementById('editModalNotes')) document.getElementById('editModalNotes').value = record.notes !== '-' ? record.notes : '';

    // ⚡ إذا كانت العملية "مبيعات"، نحسب لها أحدث قيمة فورية ونضعها في الحقل
    if (record.category === 'مبيعات' || record.category === 'مبيعات كاش') {
        const res = calculateNetCashDrawerInflow(record.date);
        if (document.getElementById('editModalAmountBottom')) {
            document.getElementById('editModalAmountBottom').value = res.netCashInflow.toFixed(2);
        }
        if (document.getElementById('editModalNotes') && (!record.notes || record.notes === '-' || record.notes.startsWith('صافي مبيعات كاش وقبض'))) {
            document.getElementById('editModalNotes').value = res.notesBreakdown;
        }
    }

    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('z-index', '9999999', 'important');
}

// 9. حفظ التعديلات من النافذة المخصصة في SQLite دائمياً
async function saveTreasuryRecordEdit() {
    const id = parseInt(document.getElementById('editModalRecordId').value);
    const record = window.treasuryAuditRecords.find(r => r.id === id);
    if (!record) return;

    let category = document.getElementById('editModalCategory').value;
    const customCategory = document.getElementById('editModalCustomCategory').value;

    if (category === '__custom__') {
        category = customCategory.trim() || 'بند مخصص';
    }

    const amountTop = parseFloat(document.getElementById('editModalAmountTop').value) || 0;
    const amountBottom = parseFloat(document.getElementById('editModalAmountBottom').value) || 0;
    const notes = document.getElementById('editModalNotes').value;

    // 🚨 شرط التنبيه الصارم فقط على المبيعات: المبيعات في الدرج فقط
    if ((category === 'مبيعات' || category === 'مبيعات كاش') && amountTop > 0) {
        alert("⚠️ تنبيه هام: بند المبيعات يتسجل في خانة (الدرج) فقط ولا يمكن إدخال مبيعات في الخزينة الرئيسية!");
        document.getElementById('editModalAmountTop').value = '';
        document.getElementById('editModalAmountTop').focus();
        return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    record.category = category;
    record.amountTop = amountTop;
    record.amountBottom = amountBottom;
    record.total = amountTop + amountBottom;
    record.notes = notes || '-';
    record.lastModified = timeStr;

    // 💾 حفظ التعديل في SQLite دائمياً
    if (window.bayanDB) {
        try {
            await window.bayanDB.treasuryAudit.put(record);
            console.log("💾 تم حفظ تعديل عملية الخزينة بنجاح في SQLite.");
        } catch (e) {
            console.error("❌ خطأ في حفظ التعديل في SQLite:", e);
        }
    }

    closeTreasuryRecordEditModal();
    updateTreasuryAuditStats();
    renderTreasuryAuditTable();
}

// إغلاق نافذة التعديل المخصصة
function closeTreasuryRecordEditModal() {
    const modal = document.getElementById('editTreasuryRecordModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.setProperty('display', 'none', 'important');
}

// 9. دالة الحذف الصامت والحذف الفعلي المضمون من SQLite والذاكرة
async function deleteTreasuryRecordSilent(id) {
    id = parseInt(id);
    window.treasuryAuditRecords = window.treasuryAuditRecords.filter(r => parseInt(r.id) !== id);

    if (window.bayanDB) {
        try {
            await window.bayanDB.treasuryAudit.delete(id);
            console.log("🗑️ تم حذف العملية من SQLite بنجاح رقم:", id);
        } catch (e) {
            console.error("❌ خطأ أثناء حذف العملية من SQLite:", e);
        }
    }
}

// دالة حذف عنصر من السجل مع تأكيد المستخدم عبر النافذة الحديثة للتطبيق
async function deleteTreasuryRecord(id) {
    id = parseInt(id);

    if (window.showCustomAlert) {
        window.showCustomAlert({
            type: 'error',
            titleText: '⚠️ تأكيد حذف العملية',
            msg: 'هل أنت متأكد من حذف هذه العملية نهائياً من مراجعة الخزينة؟',
            confirmText: '🗑️ نعم، احذف العملية',
            cancelText: 'إلغاء',
            showCancel: true,
            onConfirm: async () => {
                await deleteTreasuryRecordSilent(id);
                updateTreasuryAuditStats();
                renderTreasuryAuditTable();
                if (window.showToast) window.showToast("🗑️ تم حذف العملية بنجاح من مراجعة الخزينة", "success");
            }
        });
    } else {
        if (!confirm("هل أنت متأكد من حذف هذه العملية من مراجعة الخزينة؟")) return;
        await deleteTreasuryRecordSilent(id);
        updateTreasuryAuditStats();
        renderTreasuryAuditTable();
    }
}

// 10. فلترة الجدول بالبحث اللحظي
function filterTreasuryAuditTable() {
    const q = (document.getElementById('trTableSearch').value || '').toLowerCase();
    const rows = document.querySelectorAll('#treasuryAuditTableBody tr');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

// 11. نافذة خيارات الجدول (إظهار/إخفاء الأعمدة)
function toggleTreasuryTableOptionsModal() {
    const modal = document.getElementById('treasuryOptionsModal');
    if (!modal) return;

    if (modal.style.display === 'none' || modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('z-index', '9999999', 'important');
    } else {
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
    }
}

// 12. دالة التحكم بفيزيائية الأعمدة وإظهارها/إخفائها
function toggleTreasuryColumn(colIndex, isVisible) {
    const displayStyle = isVisible ? '' : 'none';
    
    // رأس الجدول
    const th = document.querySelector(`#trTableHeadRow th:nth-child(${colIndex + 1})`);
    if (th) th.style.display = displayStyle;

    // خلايا الجدول
    const tds = document.querySelectorAll(`#treasuryAuditTableBody tr td:nth-child(${colIndex + 1})`);
    tds.forEach(td => td.style.display = displayStyle);
}

// 13. التحكم الجماعي في إظهار أو إخفاء كافة الأعمدة بنقرة واحدة
function toggleAllTreasuryColumns(isVisible) {
    const checkboxes = document.querySelectorAll('.tr-col-check');
    checkboxes.forEach((cb, index) => {
        cb.checked = isVisible;
        toggleTreasuryColumn(index + 1, isVisible);
    });
}

// 14.2 تبديل الوضع الفاتح والداكن الخاص بالقسم
function toggleTreasuryThemeMode() {
    if (typeof toggleTheme === 'function') {
        toggleTheme();
    } else {
        document.body.classList.toggle('dark-mode');
        document.body.classList.toggle('light-mode');
    }

    const btnText = document.getElementById('trThemeBtnText');
    if (btnText) {
        const isDark = document.body.classList.contains('dark-mode');
        btnText.innerText = isDark ? '☀️ الوضع الفاتح' : '🌙 الوضع الداكن';
    }
}

// 14.3 إدارة نافذة الدليل التفاعلي الشامل لقسم مراجعة الخزينة (للمبتدئين والعملاء الجدد)
let currentTreasuryGuideTab = 1;

function openTreasuryGuideModal() {
    const modal = document.getElementById('treasuryGuideModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
    switchTreasuryGuideTab(1);

    modal.onclick = function(e) {
        if (e.target === modal) {
            closeTreasuryGuideModal();
        }
    };
}

function closeTreasuryGuideModal() {
    const modal = document.getElementById('treasuryGuideModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
    }
}

function switchTreasuryGuideTab(tabIdx) {
    currentTreasuryGuideTab = tabIdx;
    
    // إخفاء كافة التبويبات وتفعيل التبويب المختار
    for (let i = 1; i <= 5; i++) {
        const panel = document.getElementById(`trGuideTab${i}`);
        const btn = document.getElementById(`trTabBtn${i}`);
        if (panel) {
            if (i === tabIdx) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        }
        if (btn) {
            if (i === tabIdx) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }

    // تحديث أزرار التالي والسابق
    const prevBtn = document.getElementById('trGuidePrevBtn');
    const nextBtn = document.getElementById('trGuideNextBtn');
    if (prevBtn) {
        prevBtn.style.visibility = (tabIdx === 1) ? 'hidden' : 'visible';
    }
    if (nextBtn) {
        if (tabIdx === 5) {
            nextBtn.innerText = '✓ ختام الدليل';
            nextBtn.onclick = closeTreasuryGuideModal;
        } else {
            nextBtn.innerText = 'الخطوة التالية ⬅️';
            nextBtn.onclick = () => navigateTreasuryGuide(1);
        }
    }
}

function navigateTreasuryGuide(step) {
    let nextTab = currentTreasuryGuideTab + step;
    if (nextTab < 1) nextTab = 1;
    if (nextTab > 5) nextTab = 5;
    switchTreasuryGuideTab(nextTab);
}

// دالة توافقية مع أي استدعاء قديم
function toggleTreasuryGuide() {
    openTreasuryGuideModal();
}

// 15. فتح نافذة ملاحظاتي اليومية والمفكرة
function openTreasuryNotesModal() {
    const modal = document.getElementById('treasuryNotesModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
    loadTreasuryNotesContent();
}

// 16. إغلاق النافذة
function closeTreasuryNotesModal() {
    const modal = document.getElementById('treasuryNotesModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
    }
}

// 17. إظهار/إخفاء شريط الإعدادات
function toggleTreasuryNotesSettings() {
    const settingsBox = document.getElementById('trNotesSettingsBox');
    if (!settingsBox) return;
    settingsBox.style.display = (settingsBox.style.display === 'none' || !settingsBox.style.display) ? 'flex' : 'none';
}

// 17.1 تحديث وحفظ الاسم المخصص للمفكرة والملاحظات
function updateTreasuryNotesCustomTitle(newTitle) {
    const titleVal = newTitle ? newTitle.trim() : '';
    setStore('tr_notes_custom_title', titleVal);
    
    const displayTitle = titleVal || 'الملاحظات اليومية والمفكرة';
    
    const modalTitleEl = document.getElementById('trNotesModalTitleText');
    if (modalTitleEl) modalTitleEl.innerText = displayTitle;
    
    const cardTitleEl = document.getElementById('trNotesTitleCardText');
    if (cardTitleEl) cardTitleEl.innerText = displayTitle;
}

// 18. تحميل الملاحظات المحفوظة
function loadTreasuryNotesContent() {
    const customTitle = getStore('tr_notes_custom_title') || '';
    const titleInput = document.getElementById('trNotesCustomTitleInput');
    if (titleInput) titleInput.value = customTitle;
    
    const displayTitle = customTitle || 'الملاحظات اليومية والمفكرة';
    const modalTitleEl = document.getElementById('trNotesModalTitleText');
    if (modalTitleEl) modalTitleEl.innerText = displayTitle;
    const cardTitleEl = document.getElementById('trNotesTitleCardText');
    if (cardTitleEl) cardTitleEl.innerText = displayTitle;

    const saveSystem = getStore('tr_notes_save_system') || 'persistent';
    const systemSelect = document.getElementById('trNotesSaveSystem');
    if (systemSelect) systemSelect.value = saveSystem;

    const borderColor = getStore('tr_notes_border_color') || '#10b981';
    setTreasuryNotesBorderColor(borderColor, false);

    const currentDate = document.getElementById('trDate') ? document.getElementById('trDate').value : new Date().toLocaleDateString('en-CA');
    const key = (saveSystem === 'daily') ? `tr_notes_${currentDate}` : 'tr_notes_persistent';

    const content = getStore(key) || '';
    const textarea = document.getElementById('trNotesTextarea');
    if (textarea) textarea.value = content;

    updateNotesCountDisplay(content);
}

// 19. حفظ الملاحظات
function saveTreasuryNotesContent() {
    const textarea = document.getElementById('trNotesTextarea');
    if (!textarea) return;

    const saveSystem = getStore('tr_notes_save_system') || 'persistent';
    const currentDate = document.getElementById('trDate') ? document.getElementById('trDate').value : new Date().toLocaleDateString('en-CA');
    const key = (saveSystem === 'daily') ? `tr_notes_${currentDate}` : 'tr_notes_persistent';

    setStore(key, textarea.value);
    updateNotesCountDisplay(textarea.value);

    // تنبيه نجاح الحفظ
    alert("✅ تم حفظ الملاحظات والمفكرة بنجاح!");
}

// 20. إدراج الترقيم والوقت والتاريخ تلقائياً
function insertTreasuryNotesTimestamp() {
    const textarea = document.getElementById('trNotesTextarea');
    if (!textarea) return;

    const text = textarea.value;
    const lines = text.split('\n').filter(l => l.includes('📌 ملاحظة رقم'));
    const noteNum = lines.length + 1;

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-EG');
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const newNoteHeader = `\n📌 ملاحظة رقم ${noteNum}\n⏰ ${timeStr} - ${dateStr}\n📝 تفاصيل:\n`;

    if (textarea.value.trim() === '') {
        textarea.value = newNoteHeader.trimStart();
    } else {
        textarea.value = textarea.value.trimEnd() + '\n\n' + newNoteHeader;
    }

    textarea.focus();
    textarea.scrollTop = textarea.scrollHeight;
}

// 21. تغيير لون الإطار
function setTreasuryNotesBorderColor(color, shouldSave = true) {
    const container = document.getElementById('trNotesModalContainer');
    const textarea = document.getElementById('trNotesTextarea');
    if (container) container.style.borderColor = color;
    if (textarea) textarea.style.borderColor = color;

    if (shouldSave) {
        setStore('tr_notes_border_color', color);
    }
}

// 22. حفظ الإعدادات
function saveTreasuryNotesSettings() {
    const systemSelect = document.getElementById('trNotesSaveSystem');
    if (systemSelect) {
        setStore('tr_notes_save_system', systemSelect.value);
        loadTreasuryNotesContent();
    }
}

// 23. تحديث عدد الملاحظات في كارت الشاشة
function updateNotesCountDisplay(content) {
    const display = document.getElementById('trNotesCountDisplay');
    if (!display) return;

    if (!content || content.trim() === '') {
        display.innerText = '0 ملاحظة';
        return;
    }

    const matches = content.match(/📌 ملاحظة رقم/g);
    const count = matches ? matches.length : (content.trim().length > 0 ? 1 : 0);
    display.innerText = `${count} ملاحظة`;
}

// 24. طباعة تقرير مراجعة الخزينة الشامل (دعم RTL ومتصفح وإلكترون)
function printTreasuryAuditReport() {
    const range = getTreasuryDateRange();
    const records = window.treasuryAuditRecords || [];
    const filteredRecords = records.filter(r => r.date >= range.start && r.date <= range.end);

    if (filteredRecords.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'warning',
                titleText: '⚠️ لا توجد بيانات للطباعة',
                msg: `لا توجد أي حركات أو عمليات مسجلة في سجل الخزينة للفترة من (${range.start}) إلى (${range.end}).`
            });
        } else {
            alert(`⚠️ لا توجد أي عمليات مسجلة للطباعة للفترة من ${range.start} إلى ${range.end}`);
        }
        return;
    }

    let salesTotal = 0, cashTotal = 0, instaTotal = 0, sumTop = 0, sumBottom = 0;
    filteredRecords.forEach(r => {
        const top = parseFloat(r.amountTop) || 0;
        const bottom = parseFloat(r.amountBottom) || 0;
        sumTop += top;
        sumBottom += bottom;
        if (r.category === 'مبيعات' || r.category === 'مبيعات كاش') {
            salesTotal += bottom;
        } else {
            if (r.category === 'فودافون كاش') cashTotal += (top + bottom);
            if (r.category === 'انستا باي') instaTotal += (top + bottom);
        }
    });

    const otherDeductions = sumBottom - salesTotal;
    const netTotal = salesTotal - otherDeductions;
    const diffTotal = (salesTotal + sumTop) - sumBottom;
    const shopName = (document.getElementById('shopName') ? document.getElementById('shopName').value : '') || 'بيان POS';
    const now = new Date().toLocaleString('ar-EG');

    const tableRows = filteredRecords.map((r, i) => `
        <tr>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${i + 1}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${r.time || '-'}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${r.category || '-'}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${(parseFloat(r.amountBottom) || 0).toFixed(2)}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${(parseFloat(r.amountTop) || 0).toFixed(2)}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${(parseFloat(r.total) || 0).toFixed(2)}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${r.notes || '-'}</td>
            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${r.user || '-'}</td>
        </tr>
    `).join('');

    const printHTML = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير مراجعة الخزينة - ${shopName}</title>
            <style>
                body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: right; padding: 20px; color: #0f172a; background: #fff; margin: 0; }
                .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
                .header h1 { margin: 0 0 6px; font-size: 1.6rem; color: #0f172a; }
                .header h2 { margin: 0 0 6px; font-size: 1.2rem; color: #0284c7; }
                .meta-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569; margin-bottom: 16px; font-weight: bold; }
                .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
                .stat-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center; }
                .stat-box .title { font-size: 0.78rem; color: #64748b; font-weight: bold; margin-bottom: 4px; }
                .stat-box .val { font-size: 1.1rem; font-weight: 900; color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85rem; }
                th { background: #0f172a; color: #fff; padding: 8px; border: 1px solid #0f172a; text-align: center; }
                .footer { margin-top: 30px; text-align: center; font-size: 0.8rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${shopName}</h1>
                <h2>📊 تقرير كشف ومراجعة الخزينة اليومي</h2>
            </div>
            <div class="meta-row">
                <div>📅 نطاق التقرير: ${range.start} إلى ${range.end}</div>
                <div>⏰ تاريخ وساعة الطباعة: ${now}</div>
                <div>👤 المستخدم الحالي: ${(window.currentUser ? window.currentUser.name : '-')}</div>
            </div>

            <div class="stats-grid">
                <div class="stat-box"><div class="title">📈 إجمالي المبيعات</div><div class="val" style="color:#059669;">${salesTotal.toFixed(2)}</div></div>
                <div class="stat-box"><div class="title">💵 الخزينة الرئيسية (فوق)</div><div class="val" style="color:#0284c7;">${sumTop.toFixed(2)}</div></div>
                <div class="stat-box"><div class="title">💸 درج النقدية (الدرج)</div><div class="val" style="color:#dc2626;">${sumBottom.toFixed(2)}</div></div>
                <div class="stat-box"><div class="title">💰 الصافي المحقق</div><div class="val" style="color:#2563eb;">${netTotal.toFixed(2)}</div></div>
                <div class="stat-box"><div class="title">📱 فودافون كاش</div><div class="val">${cashTotal.toFixed(2)}</div></div>
                <div class="stat-box"><div class="title">⚡ انستا باي</div><div class="val">${instaTotal.toFixed(2)}</div></div>
                <div class="stat-box"><div class="title">🔢 عدد العمليات</div><div class="val">${filteredRecords.length}</div></div>
                <div class="stat-box"><div class="title">⚖️ فرق الخزينة</div><div class="val" style="color:#7c3aed;">${diffTotal.toFixed(2)}</div></div>
            </div>

            <h3 style="margin-bottom: 8px; font-size: 1rem; color: #0f172a;">تفاصيل وحركات سجل الخزينة:</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 35px;">م</th>
                        <th style="width: 65px;">الوقت</th>
                        <th>الفئة / البند</th>
                        <th style="width: 85px;">الدرج</th>
                        <th style="width: 85px;">الخزينة الرئيسية</th>
                        <th style="width: 85px;">الإجمالي</th>
                        <th>الملاحظات</th>
                        <th style="width: 85px;">المستخدم</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <div class="footer">
                نظام بَيَان POS لإدارة المحلات والمبيعات - تم التصدير تلقائياً
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 400);
                };
            </script>
        </body>
        </html>
    `;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (printWin) {
        printWin.document.open();
        printWin.document.write(printHTML);
        printWin.document.close();
    }
}

// 25. تصدير PDF حقيقي ودعم التنزيل المباشر والعربية بالكامل
async function exportTreasuryAuditPDF() {
    const range = getTreasuryDateRange();
    const records = window.treasuryAuditRecords || [];
    const filteredRecords = records.filter(r => r.date >= range.start && r.date <= range.end);

    if (filteredRecords.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'warning',
                titleText: '⚠️ لا توجد بيانات للتصدير',
                msg: `لا توجد أي حركات أو عمليات مسجلة في سجل الخزينة للتصدير للفترة من (${range.start}) إلى (${range.end}).`
            });
        } else {
            alert(`⚠️ لا توجد أي عمليات مسجلة للتصدير للفترة من ${range.start} إلى ${range.end}`);
        }
        return;
    }

    if (typeof showToast === 'function') showToast("📄 جاري إعداد وتوليد ملف PDF لتقرير الخزينة...");

    // للتأكد من وجود html2canvas أو تحميله
    if (typeof html2canvas === 'undefined') {
        try {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'lib/html2canvas.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        } catch (e) {
            console.warn("Could not load html2canvas dynamic script", e);
        }
    }

    const shopName = (document.getElementById('shopName') ? document.getElementById('shopName').value : '') || 'بيان POS';
    const now = new Date().toLocaleString('ar-EG');

    let salesTotal = 0, sumTop = 0, sumBottom = 0;
    filteredRecords.forEach(r => {
        sumTop += (parseFloat(r.amountTop) || 0);
        sumBottom += (parseFloat(r.amountBottom) || 0);
        if (r.category === 'مبيعات' || r.category === 'مبيعات كاش') salesTotal += (parseFloat(r.amountBottom) || 0);
    });

    const netTotal = salesTotal - (sumBottom - salesTotal);
    const diffTotal = (salesTotal + sumTop) - sumBottom;

    // بناء حاوية مؤقتة للحصول على تصميم PDF أنيق
    const pdfContainer = document.createElement('div');
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.top = '-9999px';
    pdfContainer.style.width = '800px';
    pdfContainer.style.background = '#ffffff';
    pdfContainer.style.color = '#0f172a';
    pdfContainer.style.padding = '30px';
    pdfContainer.style.fontFamily = "'Cairo', 'Segoe UI', sans-serif";
    pdfContainer.style.direction = 'rtl';

    pdfContainer.innerHTML = `
        <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px;">
            <h1 style="margin: 0; font-size: 1.8rem; color: #0f172a;">${shopName}</h1>
            <h2 style="margin: 6px 0 0; font-size: 1.25rem; color: #0284c7;">📊 تقرير كشف ومراجعة الخزينة الشامل</h2>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569; font-weight: bold; margin-bottom: 16px;">
            <div>📅 الفترة: ${range.start} إلى ${range.end}</div>
            <div>⏰ تاريخ التصدير: ${now}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
                <div style="font-size:0.75rem; color:#64748b;">إجمالي المبيعات</div>
                <div style="font-size:1.1rem; font-weight:900; color:#059669;">${salesTotal.toFixed(2)}</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
                <div style="font-size:0.75rem; color:#64748b;">الخزينة الرئيسية (فوق)</div>
                <div style="font-size:1.1rem; font-weight:900; color:#0284c7;">${sumTop.toFixed(2)}</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
                <div style="font-size:0.75rem; color:#64748b;">درج النقدية (الدرج)</div>
                <div style="font-size:1.1rem; font-weight:900; color:#dc2626;">${sumBottom.toFixed(2)}</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
                <div style="font-size:0.75rem; color:#64748b;">الصافي المحقق</div>
                <div style="font-size:1.1rem; font-weight:900; color:#2563eb;">${netTotal.toFixed(2)}</div>
            </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: center;">
            <thead>
                <tr style="background: #0f172a; color: #ffffff;">
                    <th style="padding: 8px; border: 1px solid #0f172a;">م</th>
                    <th style="padding: 8px; border: 1px solid #0f172a;">الوقت</th>
                    <th style="padding: 8px; border: 1px solid #0f172a; text-align: right;">الفئة</th>
                    <th style="padding: 8px; border: 1px solid #0f172a;">الدرج</th>
                    <th style="padding: 8px; border: 1px solid #0f172a;">الخزينة الرئيسية</th>
                    <th style="padding: 8px; border: 1px solid #0f172a;">الإجمالي</th>
                    <th style="padding: 8px; border: 1px solid #0f172a; text-align: right;">الملاحظات</th>
                </tr>
            </thead>
            <tbody>
                ${filteredRecords.map((r, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td style="padding: 6px; border: 1px solid #cbd5e1;">${i + 1}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1;">${r.time || '-'}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${r.category || '-'}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1;">${(parseFloat(r.amountBottom) || 0).toFixed(2)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1;">${(parseFloat(r.amountTop) || 0).toFixed(2)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${(parseFloat(r.total) || 0).toFixed(2)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: right;">${r.notes || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div style="margin-top: 25px; text-align: center; font-size: 0.8rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            نظام بَيَان POS - تقرير الخزينة المصدّر
        </div>
    `;

    document.body.appendChild(pdfContainer);

    try {
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            
            // إنشاء نافذة حفظ/تنزيل مباشرة للملف
            const link = document.createElement('a');
            link.download = `تقرير_الخزينة_${range.start}_إلى_${range.end}.png`;
            link.href = imgData;
            link.click();
            
            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'success',
                    titleText: '✅ تم تصدير التقرير بنجاح',
                    msg: 'تم تصدير وحفظ التقرير بدقة عالية وجاهز للاستخدام والتنزيل.'
                });
            }
        } else {
            // fallback إلى نافذة الطباعة / الحفظ كـ PDF للمتصفح والإلكترون
            printTreasuryAuditReport();
        }
    } catch (e) {
        console.error("PDF Export error:", e);
        printTreasuryAuditReport();
    } finally {
        pdfContainer.remove();
    }
}

// 26. مشاركة ملخص التقرير عبر WhatsApp
function shareTreasuryAuditWhatsApp() {
    const range = getTreasuryDateRange();
    const records = window.treasuryAuditRecords || [];
    const filteredRecords = records.filter(r => r.date >= range.start && r.date <= range.end);

    if (filteredRecords.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'warning',
                titleText: '⚠️ لا توجد بيانات للمشاركة',
                msg: `لا توجد أي حركات أو عمليات مسجلة في سجل الخزينة لإرسالها عبر WhatsApp للفترة من (${range.start}) إلى (${range.end}).`
            });
        } else {
            alert(`⚠️ لا توجد أي عمليات مسجلة للمشاركة للفترة من ${range.start} إلى ${range.end}`);
        }
        return;
    }

    const shopName = (document.getElementById('shopName') ? document.getElementById('shopName').value : '') || 'بيان POS';

    let salesTotal = 0, sumTop = 0, sumBottom = 0;
    filteredRecords.forEach(r => {
        sumTop += (parseFloat(r.amountTop) || 0);
        sumBottom += (parseFloat(r.amountBottom) || 0);
        if (r.category === 'مبيعات' || r.category === 'مبيعات كاش') salesTotal += (parseFloat(r.amountBottom) || 0);
    });

    const netTotal = salesTotal - (sumBottom - salesTotal);
    const diffTotal = (salesTotal + sumTop) - sumBottom;
    const now = new Date().toLocaleString('ar-EG');

    const msgText = 
`📊 *تقرير مراجعة الخزينة - ${shopName}*
📅 *الفترة:* من ${range.start} إلى ${range.end}
⏰ *وقت التقرير:* ${now}

📈 *إجمالي المبيعات:* ${salesTotal.toFixed(2)}
💵 *الخزينة الرئيسية (فوق):* ${sumTop.toFixed(2)}
💸 *درج النقدية (الدرج):* ${sumBottom.toFixed(2)}
💰 *الصافي المحقق:* ${netTotal.toFixed(2)}
🔢 *عدد المعاملات:* ${filteredRecords.length}
⚖️ *فرق الخزينة:* ${diffTotal.toFixed(2)}

تم الإرسال تلقائياً عبر نظام *بَيَان POS* 🚀`;

    const encodedMsg = encodeURIComponent(msgText);
    const waUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;

    if (typeof window.openExternalUrl === 'function') {
        window.openExternalUrl(waUrl);
    } else {
        window.open(waUrl, '_blank');
    }
}

// 27. مشاركة ملخص التقرير عبر Telegram
function shareTreasuryAuditTelegram() {
    const range = getTreasuryDateRange();
    const records = window.treasuryAuditRecords || [];
    const filteredRecords = records.filter(r => r.date >= range.start && r.date <= range.end);

    if (filteredRecords.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'warning',
                titleText: '⚠️ لا توجد بيانات للمشاركة',
                msg: `لا توجد أي حركات أو عمليات مسجلة في سجل الخزينة لإرسالها عبر Telegram للفترة من (${range.start}) إلى (${range.end}).`
            });
        } else {
            alert(`⚠️ لا توجد أي عمليات مسجلة للمشاركة للفترة من ${range.start} إلى ${range.end}`);
        }
        return;
    }

    const shopName = (document.getElementById('shopName') ? document.getElementById('shopName').value : '') || 'بيان POS';

    let salesTotal = 0, sumTop = 0, sumBottom = 0;
    filteredRecords.forEach(r => {
        sumTop += (parseFloat(r.amountTop) || 0);
        sumBottom += (parseFloat(r.amountBottom) || 0);
        if (r.category === 'مبيعات' || r.category === 'مبيعات كاش') salesTotal += (parseFloat(r.amountBottom) || 0);
    });

    const netTotal = salesTotal - (sumBottom - salesTotal);
    const diffTotal = (salesTotal + sumTop) - sumBottom;
    const now = new Date().toLocaleString('ar-EG');

    const msgText = 
`📊 *تقرير مراجعة الخزينة - ${shopName}*
📅 *الفترة:* من ${range.start} إلى ${range.end}
⏰ *وقت التقرير:* ${now}

📈 *إجمالي المبيعات:* ${salesTotal.toFixed(2)}
💵 *الخزينة الرئيسية (فوق):* ${sumTop.toFixed(2)}
💸 *درج النقدية (الدرج):* ${sumBottom.toFixed(2)}
💰 *الصافي المحقق:* ${netTotal.toFixed(2)}
🔢 *عدد المعاملات:* ${filteredRecords.length}
⚖️ *فرق الخزينة:* ${diffTotal.toFixed(2)}

تم الإرسال تلقائياً عبر نظام *بَيَان POS* 🚀`;

    const encodedMsg = encodeURIComponent(msgText);
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodedMsg}`;

    if (typeof window.openExternalUrl === 'function') {
        window.openExternalUrl(tgUrl);
    } else {
        window.open(tgUrl, '_blank');
    }
}

// إتاحة الدوال عالمياً
window.initTreasuryAuditSection = initTreasuryAuditSection;
window.handleTreasuryQuickJump = handleTreasuryQuickJump;
window.handleTreasuryDateInputChange = handleTreasuryDateInputChange;
window.handleTreasuryCategoryChange = handleTreasuryCategoryChange;
window.handleEditModalCategoryChange = handleEditModalCategoryChange;
window.updateTreasuryAuditStats = updateTreasuryAuditStats;
window.addTreasuryAuditRecord = addTreasuryAuditRecord;
window.resetTreasuryAuditForm = resetTreasuryAuditForm;
window.renderTreasuryAuditTable = renderTreasuryAuditTable;
window.editTreasuryRecord = editTreasuryRecord;
window.saveTreasuryRecordEdit = saveTreasuryRecordEdit;
window.closeTreasuryRecordEditModal = closeTreasuryRecordEditModal;
window.deleteTreasuryRecordSilent = deleteTreasuryRecordSilent;
window.deleteTreasuryRecord = deleteTreasuryRecord;
window.filterTreasuryAuditTable = filterTreasuryAuditTable;
window.toggleTreasuryTableOptionsModal = toggleTreasuryTableOptionsModal;
window.toggleTreasuryColumn = toggleTreasuryColumn;
window.toggleAllTreasuryColumns = toggleAllTreasuryColumns;
window.toggleTreasuryGuide = toggleTreasuryGuide;
window.openTreasuryGuideModal = openTreasuryGuideModal;
window.closeTreasuryGuideModal = closeTreasuryGuideModal;
window.switchTreasuryGuideTab = switchTreasuryGuideTab;
window.navigateTreasuryGuide = navigateTreasuryGuide;
window.toggleTreasuryThemeMode = toggleTreasuryThemeMode;
window.openTreasuryNotesModal = openTreasuryNotesModal;
window.closeTreasuryNotesModal = closeTreasuryNotesModal;
window.toggleTreasuryNotesSettings = toggleTreasuryNotesSettings;
window.updateTreasuryNotesCustomTitle = updateTreasuryNotesCustomTitle;
window.saveTreasuryNotesContent = saveTreasuryNotesContent;
window.insertTreasuryNotesTimestamp = insertTreasuryNotesTimestamp;
window.setTreasuryNotesBorderColor = setTreasuryNotesBorderColor;
window.saveTreasuryNotesSettings = saveTreasuryNotesSettings;
window.printTreasuryAuditReport = printTreasuryAuditReport;
window.exportTreasuryAuditPDF = exportTreasuryAuditPDF;
window.shareTreasuryAuditWhatsApp = shareTreasuryAuditWhatsApp;
window.shareTreasuryAuditTelegram = shareTreasuryAuditTelegram;

// =========================================================================
// 🌟 دوال التحكم في نافذة: المشاركة والإعدادات الأفقية الحديثة
// =========================================================================
function openTreasuryShareModal() {
    const modal = document.getElementById('treasuryShareModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
}
window.openTreasuryShareModal = openTreasuryShareModal;

function closeTreasuryShareModal() {
    const modal = document.getElementById('treasuryShareModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
    }
}
window.closeTreasuryShareModal = closeTreasuryShareModal;

function executeShareModalAction(actionType) {
    closeTreasuryShareModal();

    setTimeout(() => {
        if (actionType === 'options') {
            if (typeof toggleTreasuryTableOptionsModal === 'function') toggleTreasuryTableOptionsModal();
        } else if (actionType === 'print') {
            if (typeof printTreasuryAuditReport === 'function') printTreasuryAuditReport();
        } else if (actionType === 'pdf') {
            if (typeof exportTreasuryAuditPDF === 'function') exportTreasuryAuditPDF();
        } else if (actionType === 'whatsapp') {
            if (typeof shareTreasuryAuditWhatsApp === 'function') shareTreasuryAuditWhatsApp();
        } else if (actionType === 'telegram') {
            if (typeof shareTreasuryAuditTelegram === 'function') shareTreasuryAuditTelegram();
        } else if (actionType === 'log' || actionType === 'sijill') {
            if (typeof openTreasuryNotesModal === 'function') {
                openTreasuryNotesModal();
            } else {
                const tableWrapper = document.querySelector('.tr-table-wrapper');
                if (tableWrapper) tableWrapper.scrollIntoView({ behavior: 'smooth' });
            }
            if (typeof showToast === 'function') {
                showToast("📜 تم فتح مفكرة وملاحظات الخزينة بنجاح", "info");
            }
        }
    }, 120);
}
window.executeShareModalAction = executeShareModalAction;

// توافقية كاملة مع الاستدعاءات السابقة
function toggleRadialActionMenu(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    openTreasuryShareModal();
}
window.toggleRadialActionMenu = toggleRadialActionMenu;

function closeRadialActionMenu() {
    closeTreasuryShareModal();
}
window.closeRadialActionMenu = closeRadialActionMenu;

function triggerRadialAction(actionType, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    executeShareModalAction(actionType);
}
window.triggerRadialAction = triggerRadialAction;

// مستمع للنقر خارج القائمة لإغلاقها تلقائياً
if (!window._radialMenuListenersAttached) {
    window._radialMenuListenersAttached = true;
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('trRadialActionMenu');
        if (menu && menu.classList.contains('is-open') && !menu.contains(e.target)) {
            closeRadialActionMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeRadialActionMenu();
        }
    });
}

// =========================================================================
// 💎 نافذة تفاصيل الكاش وانستا باي الفاخرة (مطابقة للتصميم والصورة 100%)
// =========================================================================
window.currentTreasuryDetailType = 'cash';
window.currentTreasuryDetailRawRecords = [];

function openTreasuryDetailsModal(type = 'cash') {
    window.currentTreasuryDetailType = type;
    const modal = document.getElementById('treasuryDetailsModal');
    if (!modal) return;

    // ضبط العنوان والأيقونة
    const titleEl = document.getElementById('trDetailModalTitle');
    const iconEl = document.getElementById('trDetailModalIcon');
    const searchInput = document.getElementById('trDetailSearchInput');

    if (searchInput) searchInput.value = '';

    if (type === 'cash') {
        if (titleEl) titleEl.innerText = 'تفاصيل الكاش (شامل فودافون)';
        if (iconEl) iconEl.innerText = '📖';
    } else if (type === 'instapay') {
        if (titleEl) titleEl.innerText = 'تفاصيل انستا باي (InstaPay)';
        if (iconEl) iconEl.innerText = '⚡';
    } else if (type === 'sales') {
        if (titleEl) titleEl.innerText = 'تفاصيل المبيعات النقدية';
        if (iconEl) iconEl.innerText = '📈';
    } else {
        if (titleEl) titleEl.innerText = `تفاصيل ${type}`;
        if (iconEl) iconEl.innerText = '📊';
    }

    refreshTreasuryDetailsModal();

    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');

    setTimeout(() => {
        if (searchInput) searchInput.focus();
    }, 150);
}
window.openTreasuryDetailsModal = openTreasuryDetailsModal;

function closeTreasuryDetailsModal() {
    const modal = document.getElementById('treasuryDetailsModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
    }
}
window.closeTreasuryDetailsModal = closeTreasuryDetailsModal;

function refreshTreasuryDetailsModal() {
    const type = window.currentTreasuryDetailType || 'cash';
    const range = typeof getTreasuryDateRange === 'function' ? getTreasuryDateRange() : {
        start: document.getElementById('trDate') ? document.getElementById('trDate').value : new Date().toLocaleDateString('en-CA'),
        end: document.getElementById('trDate') ? document.getElementById('trDate').value : new Date().toLocaleDateString('en-CA')
    };

    const allRecords = window.treasuryAuditRecords || [];
    const dateFiltered = allRecords.filter(r => r.date >= range.start && r.date <= range.end);

    let matchedRecords = [];
    if (type === 'cash') {
        matchedRecords = dateFiltered.filter(r => {
            const cat = String(r.category || '').toLowerCase();
            return cat.includes('فودافون') || cat.includes('كاش') || cat.includes('cash');
        });
    } else if (type === 'instapay') {
        matchedRecords = dateFiltered.filter(r => {
            const cat = String(r.category || '').toLowerCase();
            return cat.includes('انستا') || cat.includes('insta');
        });
    } else if (type === 'sales') {
        matchedRecords = dateFiltered.filter(r => {
            const cat = String(r.category || '').toLowerCase();
            return cat.includes('مبيعات') || cat.includes('بيع');
        });
    } else {
        matchedRecords = dateFiltered.filter(r => String(r.category || '') === type);
    }

    window.currentTreasuryDetailRawRecords = matchedRecords;

    const searchInput = document.getElementById('trDetailSearchInput');
    const q = (searchInput ? searchInput.value : '').trim().toLowerCase();

    if (q) {
        filterTreasuryDetailModalRecords();
    } else {
        renderTreasuryDetailModalContent(matchedRecords);
    }
}
window.refreshTreasuryDetailsModal = refreshTreasuryDetailsModal;

function filterTreasuryDetailModalRecords() {
    const q = (document.getElementById('trDetailSearchInput') ? document.getElementById('trDetailSearchInput').value : '').trim().toLowerCase();
    const raw = window.currentTreasuryDetailRawRecords || [];

    if (!q) {
        renderTreasuryDetailModalContent(raw);
        return;
    }

    const filtered = raw.filter(r => {
        const timeStr = String(r.time || '').toLowerCase();
        const bStr = String(r.amountBottom != null ? r.amountBottom : '');
        const tStr = String(r.amountTop != null ? r.amountTop : '');
        const notesStr = String(r.notes || '').toLowerCase();
        const catStr = String(r.category || '').toLowerCase();
        const dateStr = String(r.date || '');

        return timeStr.includes(q) || bStr.includes(q) || tStr.includes(q) || notesStr.includes(q) || catStr.includes(q) || dateStr.includes(q);
    });

    renderTreasuryDetailModalContent(filtered);
}
window.filterTreasuryDetailModalRecords = filterTreasuryDetailModalRecords;

function renderTreasuryDetailModalContent(records = []) {
    const profitEl = document.getElementById('trDetailProfitVal');
    const totalBottomEl = document.getElementById('trDetailTotalBottom');
    const avgEl = document.getElementById('trDetailAvg');
    const minEl = document.getElementById('trDetailMin');
    const countEl = document.getElementById('trDetailCount');
    const maxEl = document.getElementById('trDetailMax');
    const tbody = document.getElementById('trDetailTableBody');
    const footerBar = document.getElementById('trDetailFooterBar');

    let totalProfit = 0;
    let totalBottom = 0;
    const amountsForStats = [];

    records.forEach(r => {
        const top = parseFloat(r.amountTop) || 0;
        const bottom = parseFloat(r.amountBottom) || 0;

        totalBottom += bottom;

        // حساب ربح الخدمة (بعت كام - تحت خد كام)
        if (top > bottom && bottom > 0) {
            totalProfit += (top - bottom);
        }

        // المبالغ المستخدمة في الإحصائيات (الدرج تحت أو العملية)
        const opAmount = bottom > 0 ? bottom : top;
        if (opAmount > 0) {
            amountsForStats.push(opAmount);
        }
    });

    const count = records.length;
    const maxVal = amountsForStats.length ? Math.max(...amountsForStats) : 0;
    const minVal = amountsForStats.length ? Math.min(...amountsForStats) : 0;
    const avgVal = amountsForStats.length ? (totalBottom / amountsForStats.length) : 0;

    const formatNum = (n) => {
        if (!n && n !== 0) return '0';
        return Number(n).toLocaleString('en-US', {
            minimumFractionDigits: (n % 1 === 0 ? 0 : 2),
            maximumFractionDigits: 2
        });
    };

    if (profitEl) profitEl.innerText = formatNum(totalProfit);
    if (totalBottomEl) totalBottomEl.innerText = formatNum(totalBottom);
    if (avgEl) avgEl.innerText = formatNum(avgVal);
    if (minEl) minEl.innerText = formatNum(minVal);
    if (countEl) countEl.innerText = count;
    if (maxEl) maxEl.innerText = formatNum(maxVal);

    if (footerBar) {
        if (count === 0) {
            footerBar.innerText = 'لا توجد عمليات مسجلة لهذه الفترة';
        } else if (count === 1) {
            footerBar.innerText = 'إجمالي العمليات: عملية واحدة فقط';
        } else if (count === 2) {
            footerBar.innerText = 'إجمالي العمليات: عمليتان';
        } else {
            footerBar.innerText = `إجمالي العمليات: ${count} عمليات مسجلة`;
        }
    }

    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 26px; color: #94a3b8; font-weight: 700; font-size: 0.95rem;">
                    🔍 لا توجد عمليات مطابقة لخيارات البحث أو في هذه الفترة.
                </td>
            </tr>
        `;
        return;
    }

    let rowsHtml = '';
    records.forEach(r => {
        const bottom = parseFloat(r.amountBottom) || 0;
        const time = r.time || '-';
        const notes = r.notes && r.notes !== '-' ? r.notes : '-';

        rowsHtml += `
            <tr>
                <td style="color: #cbd5e1; font-size: 0.88rem; font-weight: 700;">${time}</td>
                <td style="font-weight: 900; color: #38bdf8; font-size: 0.95rem;">${formatNum(bottom)}</td>
                <td style="color: #e2e8f0; font-weight: 700;">${notes}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

// إغلاق النوافذ بزر Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('treasuryDetailsModal');
        if (modal && modal.style.display === 'flex') {
            closeTreasuryDetailsModal();
        }
        const shareModal = document.getElementById('treasuryShareModal');
        if (shareModal && shareModal.style.display === 'flex') {
            closeTreasuryShareModal();
        }
    }
});



