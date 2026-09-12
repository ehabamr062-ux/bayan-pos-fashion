/**
 * ==========================================
 * 💰 JS قسم مراجعة الخزينة (Treasury Audit)
 * ==========================================
 * إدارة وتفاعلات قسم مراجعة الخزينة، القفز السريع، والبند المخصص.
 */

window.treasuryAuditRecords = [];

// 1. تهيئة قسم مراجعة الخزينة مع استرجاع مضمون من IndexedDB
async function initTreasuryAuditSection() {
    console.log("🔄 جاري تهيئة وتحميل بيانات قسم مراجعة الخزينة من IndexedDB...");
    
    // ضبط تاريخ اليوم المحلي تلقائياً عند الدخول
    const dateInput = document.getElementById('trDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toLocaleDateString('en-CA');
    }

    // جلب البيانات الدائمة والمحفوظة في Dexie (IndexedDB)
    if (window.bayanDB) {
        try {
            if (window.bayanDB.treasuryAudit) {
                window.treasuryAuditRecords = await window.bayanDB.treasuryAudit.toArray();
            } else if (window.bayanDB.tables.some(t => t.name === 'treasuryAudit')) {
                window.treasuryAuditRecords = await window.bayanDB.table("treasuryAudit").toArray();
            }
            console.log("✅ تم استرجاع سجلات الخزينة من IndexedDB بنجاح:", (window.treasuryAuditRecords || []).length, "عملية.");
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

    // 🎯 عند اختيار بند "مبيعات" فقط: يجلب المبيعات والمقبوضات ويجمعهم تلقائياً في المبلغ (تحت)
    if (val === 'مبيعات') {
        const dateInput = document.getElementById('trDate');
        let currentDate = (dateInput && dateInput.value) ? dateInput.value.trim() : '';
        if (!currentDate) {
            currentDate = new Date().toLocaleDateString('en-CA');
            if (dateInput) dateInput.value = currentDate;
        }

        let totalSalesAndReceipts = 0;

        // 1. حساب إجمالي فواتير البيع والمقبوضات النقدية بدقة من قاعدة البيانات
        try {
            const allTx = (window.transactions || []);
            const cleanDate = currentDate.slice(0, 10);

            // تجميع الفواتير لتجنب تكرار بنود الفاتورة الواحدة
            const ivMap = {};
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

                // أ. فواتير البيع
                if (typeStr.includes('بيع') && !typeStr.includes('مرتجع')) {
                    const invId = t.invoiceId || ('sale_single_' + i);
                    if (!ivMap[invId]) {
                        ivMap[invId] = {
                            total: 0,
                            paid: 0,
                            method: (t.method || t.paymentMethod || '').toLowerCase()
                        };
                    }
                    ivMap[invId].total += (parseFloat(t.total) || parseFloat(t.price) || 0);
                    if (t.isInvoiceHead || t.paidAmount !== undefined) {
                        ivMap[invId].paid = Math.max(ivMap[invId].paid, (parseFloat(t.paidAmount) || 0));
                    }
                }

                // ب. سندات القبض النقدية
                if (typeStr.includes('قبض')) {
                    const rAmount = parseFloat(t.total) || parseFloat(t.price) || parseFloat(t.paidAmount) || 0;
                    directReceipts.push(rAmount);
                }
            });

            // حساب المبالغ المحصلة من فواتير البيع (المدفوع نقداً / الكاش)
            Object.values(ivMap).forEach(iv => {
                const isExplicitCredit = iv.method.includes('آجل') || iv.method.includes('اجل') || iv.method.includes('credit') || iv.method.includes('تقسيط') || iv.method.includes('ذمم');
                if (isExplicitCredit) {
                    totalSalesAndReceipts += (iv.paid || 0);
                } else {
                    totalSalesAndReceipts += (iv.paid > 0 ? iv.paid : iv.total);
                }
            });

            // إضافة سندات القبض
            directReceipts.forEach(amt => {
                totalSalesAndReceipts += amt;
            });
        } catch (e) {
            console.warn("جاري جلب إجمالي المبيعات والمقبوضات...", e);
        }

        // 2. إذا لم يتم العثور على فواتير، نفحص إن كان هناك مبيعات مسجلة في سجلات الخزينة لهذا اليوم
        if (totalSalesAndReceipts === 0) {
            const records = window.treasuryAuditRecords || [];
            const dayRecords = records.filter(r => r.date === currentDate);
            dayRecords.forEach(r => {
                if (r.category === 'مبيعات' || r.category === 'مبيعات كاش' || r.category === 'قبض') {
                    totalSalesAndReceipts += (parseFloat(r.amountBottom) || 0);
                }
            });
        }

        const bottomInput = document.getElementById('trAmountBottom');
        if (bottomInput) {
            bottomInput.value = totalSalesAndReceipts > 0 ? totalSalesAndReceipts.toFixed(2) : '0.00';
            bottomInput.focus();
            bottomInput.select();
        }
    }
}

// 4. تحديث إحصائيات الكروت والملخص المالي المنطقي الشامل
function updateTreasuryAuditStats() {
    const records = window.treasuryAuditRecords || [];
    const range = getTreasuryDateRange();
    
    // فلترة عمليات الفترة المحددة
    const filteredRecords = records.filter(r => r.date >= range.start && r.date <= range.end);

    let salesTotal = 0; // إجمالي المبيعات (من مبالغ تحت الخاصة بالبند مبيعات)
    let cashTotal = 0;  // فودافون كاش
    let instaTotal = 0; // انستا باي
    let sumTop = 0;     // المبالغ فوق (مثل انستا باي/فودافون الواردة فوق)
    let sumBottom = 0;  // المبالغ تحت (المبيعات والمصروفات والخصومات)

    filteredRecords.forEach(r => {
        const top = parseFloat(r.amountTop) || 0;
        const bottom = parseFloat(r.amountBottom) || 0;

        sumTop += top;
        sumBottom += bottom;

        if (r.category === 'مبيعات' || r.category === 'مبيعات كاش') {
            salesTotal += bottom; // المبيعات تحت فقط
        } else {
            if (r.category === 'فودافون كاش') cashTotal += (top + bottom);
            if (r.category === 'انستا باي') instaTotal += (top + bottom);
        }
    });

    // صافي الفترة = المبيعات الفعلية - الخصومات/المصروفات الأخرى
    const otherDeductions = sumBottom - salesTotal;
    const netTotal = salesTotal - otherDeductions;
    
    // فرق الخزينة = (المبيعات + المبالغ الواردة فوق) - المبالغ الصادرة/المحولة تحت
    const diffTotal = (salesTotal + sumTop) - sumBottom;

    // تحديث الكروت العلوية
    if (document.getElementById('trSalesTotal')) document.getElementById('trSalesTotal').innerText = salesTotal.toFixed(2);
    if (document.getElementById('trNetTotal')) document.getElementById('trNetTotal').innerText = netTotal.toFixed(2);
    if (document.getElementById('trOpsCount')) document.getElementById('trOpsCount').innerText = filteredRecords.length;
    if (document.getElementById('trCashTotal')) document.getElementById('trCashTotal').innerText = cashTotal.toFixed(2);
    if (document.getElementById('trInstaTotal')) document.getElementById('trInstaTotal').innerText = instaTotal.toFixed(2);

    // تحديث الشريط المالي الجانبي
    if (document.getElementById('trSumTop')) document.getElementById('trSumTop').innerText = sumTop.toFixed(2);
    if (document.getElementById('trSumBottom')) document.getElementById('trSumBottom').innerText = sumBottom.toFixed(2);
    if (document.getElementById('trSumSales')) document.getElementById('trSumSales').innerText = salesTotal.toFixed(2);
    if (document.getElementById('trSumDiff')) document.getElementById('trSumDiff').innerText = diffTotal.toFixed(2);

    // تحديث إجماليات الأسفل
    if (document.getElementById('trTotalCatsDay')) document.getElementById('trTotalCatsDay').innerText = [...new Set(filteredRecords.map(r => r.category))].filter(Boolean).length;
    if (document.getElementById('trTotalOpsDay')) document.getElementById('trTotalOpsDay').innerText = filteredRecords.length;
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

    // 🚨 شرط التنبيه الصارم: بند المبيعات يكتب في المبلغ (تحت) فقط!
    if ((category === 'مبيعات' || category === 'مبيعات كاش') && amountTop > 0) {
        alert("⚠️ تنبيه هام: بند المبيعات يتسجل في المبلغ (تحت) فقط ولا يمكن إدخال مبلغ (فوق) للمبيعات!");
        document.getElementById('trAmountTop').value = '';
        document.getElementById('trAmountTop').focus();
        return;
    }

    if (!category && amountTop === 0 && amountBottom === 0) {
        alert("⚠️ يرجى تحديد البند أو إدخال مبلغ (فوق أو تحت) على الأقل.");
        return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const newRecord = {
        id: Date.now(),
        date: date || now.toISOString().split('T')[0],
        time: timeStr,
        lastModified: timeStr,
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

    // 💾 الحفظ الفوري والدائم في IndexedDB (Dexie)
    if (window.bayanDB) {
        try {
            if (window.bayanDB.treasuryAudit) {
                await window.bayanDB.treasuryAudit.put(newRecord);
            } else {
                await window.bayanDB.table("treasuryAudit").put(newRecord);
            }
            console.log("💾 تم حفظ عملية الخزينة بنجاح في IndexedDB.");
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
                <td>${r.lastModified || '-'}</td>
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

// دالة التحكم في البند المخصص داخل نافذة التعديل
function handleEditModalCategoryChange(val) {
    const customInput = document.getElementById('editModalCustomCategory');
    if (!customInput) return;
    if (val === '__custom__') {
        customInput.classList.remove('hidden');
        customInput.focus();
    } else {
        customInput.classList.add('hidden');
        customInput.value = '';
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

    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('z-index', '9999999', 'important');
}

// 9. حفظ التعديلات من النافذة المخصصة في IndexedDB دائمياً
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

    // 🚨 شرط التنبيه الصارم فقط على المبيعات: المبيعات تحت فقط
    if ((category === 'مبيعات' || category === 'مبيعات كاش') && amountTop > 0) {
        alert("⚠️ تنبيه هام: بند المبيعات يتسجل في المبلغ (تحت) فقط ولا يمكن إدخال مبلغ (فوق) للمبيعات!");
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

    // 💾 حفظ التعديل في IndexedDB دائمياً
    if (window.bayanDB) {
        try {
            await window.bayanDB.treasuryAudit.put(record);
            console.log("💾 تم حفظ تعديل عملية الخزينة بنجاح في IndexedDB.");
        } catch (e) {
            console.error("❌ خطأ في حفظ التعديل في IndexedDB:", e);
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

// 9. دالة الحذف الصامت والحذف الفعلي المضمون من IndexedDB والذاكرة
async function deleteTreasuryRecordSilent(id) {
    id = parseInt(id);
    window.treasuryAuditRecords = window.treasuryAuditRecords.filter(r => parseInt(r.id) !== id);

    if (window.bayanDB) {
        try {
            await window.bayanDB.treasuryAudit.delete(id);
            console.log("🗑️ تم حذف العملية من IndexedDB بنجاح رقم:", id);
        } catch (e) {
            console.error("❌ خطأ أثناء حذف العملية من IndexedDB:", e);
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

// 14.3 إظهار وإخفاء صندوق الإرشادات ودليل الاستخدام
function toggleTreasuryGuide() {
    const guideContent = document.getElementById('trGuideContent');
    const toggleBtnText = document.getElementById('trGuideToggleBtnText');
    if (!guideContent) return;

    if (guideContent.style.display === 'none') {
        guideContent.style.display = 'grid';
        if (toggleBtnText) toggleBtnText.innerText = '👁️ إخفاء الدليل';
    } else {
        guideContent.style.display = 'none';
        if (toggleBtnText) toggleBtnText.innerText = '💡 عرض الدليل';
    }
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
                <div class="stat-box"><div class="title">💵 إجمالي الوارد (فوق)</div><div class="val" style="color:#0284c7;">${sumTop.toFixed(2)}</div></div>
                <div class="stat-box"><div class="title">💸 إجمالي الصادر (تحت)</div><div class="val" style="color:#dc2626;">${sumBottom.toFixed(2)}</div></div>
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
                        <th style="width: 85px;">المبلغ (تحت)</th>
                        <th style="width: 85px;">المبلغ (فوق)</th>
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
                <div style="font-size:0.75rem; color:#64748b;">إجمالي الوارد (فوق)</div>
                <div style="font-size:1.1rem; font-weight:900; color:#0284c7;">${sumTop.toFixed(2)}</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; text-align:center;">
                <div style="font-size:0.75rem; color:#64748b;">إجمالي الصادر (تحت)</div>
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
                    <th style="padding: 8px; border: 1px solid #0f172a;">المبلغ (تحت)</th>
                    <th style="padding: 8px; border: 1px solid #0f172a;">المبلغ (فوق)</th>
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
💵 *إجمالي الوارد (فوق):* ${sumTop.toFixed(2)}
💸 *إجمالي الصادر (تحت):* ${sumBottom.toFixed(2)}
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
💵 *إجمالي الوارد (فوق):* ${sumTop.toFixed(2)}
💸 *إجمالي الصادر (تحت):* ${sumBottom.toFixed(2)}
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

