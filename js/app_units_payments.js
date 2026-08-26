// ============================================================
//  الوحدات المتعددة وطرق الدفع والعملات (Units, Payments & Currency)
// ============================================================
        function getGlobalUnits() {
            try {
                const stored = getStore('bayan_global_units');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (e) {
                console.error("خطأ في قراءة الوحدات المحفوظة:", e);
            }
            return ['قطعة', 'علبة', 'كرتونة', 'رابطة', 'بالتة', 'رول'];
        }

        function saveGlobalUnits(unitsArray) {
            setStore('bayan_global_units', JSON.stringify(unitsArray));
        }

        function openGlobalUnitsManager() {
            document.getElementById('globalUnitsModal').classList.remove('hidden');
            renderGlobalUnitsList();
        }

        function renderGlobalUnitsList() {
            const units = getGlobalUnits();
            const listDiv = document.getElementById('globalUnitsList');
            const countSpan = document.getElementById('unitsTotalCount');
            if (countSpan) countSpan.innerText = units.length;

            if (listDiv) {
                listDiv.innerHTML = units.map((u, i) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #94a3b8; font-size: 0.8rem;">${i + 1}#</span>
                            <span style="font-weight: 800; color: #1e293b;">${u}</span>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="editGlobalUnit(${i})" 
                                style="width: 32px; height: 32px; border-radius: 8px; border: none; background: #f1f5f9; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;" title="تعديل">✏️</button>
                            <button onclick="deleteGlobalUnit(${i})" 
                                style="width: 32px; height: 32px; border-radius: 8px; border: none; background: #fee2e2; color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;" title="حذف">🗑️</button>
                        </div>
                    </div>
                `).join('');
            }
            updateAllUnitSelects();
        }

        async function editGlobalUnit(index) {
            const units = getGlobalUnits();
            const oldName = units[index];
            const newName = await showCustomPrompt("📝 تعديل اسم الوحدة:", oldName);

            if (newName && newName.trim() !== "" && newName !== oldName) {
                if (units.includes(newName.trim())) {
                    return alert("⚠️ هذا الاسم موجود بالفعل!");
                }
                units[index] = newName.trim();
                saveGlobalUnits(units);
                showToast("✅ تم تعديل اسم الوحدة بنجاح", "success");
                renderGlobalUnitsList();
            }
        }

        function addGlobalUnit() {
            const inputEl = document.getElementById('newGlobalUnitName');
            const name = inputEl ? inputEl.value.trim() : "";
            if (!name) return;
            const units = getGlobalUnits();
            if (units.includes(name)) return alert("⚠️ هذا النوع موجود بالفعل");
            units.push(name);
            saveGlobalUnits(units);
            if (inputEl) inputEl.value = "";
            showToast("✨ تم إضافة الوحدة الجديدة", "success");
            renderGlobalUnitsList();
        }

        function deleteGlobalUnit(index) {
            const units = getGlobalUnits();
            if (confirm("🚨 هل أنت متأكد من حذف نوع الوحدة هذا؟ سيؤثر ذلك على القوائم المتاحة فقط.")) {
                units.splice(index, 1);
                saveGlobalUnits(units);
                showToast("🗑️ تم حذف الوحدة", "info");
                renderGlobalUnitsList();
            }
        }

        function updateAllUnitSelects() {
            const units = getGlobalUnits();
            const selects = document.querySelectorAll('.unit-type-select');
            const optionsHtml = units.map(u => `<option value="${u}">${u}</option>`).join('');
            selects.forEach(s => {
                const currentVal = s.value;
                s.innerHTML = optionsHtml;
                if (currentVal && units.includes(currentVal)) {
                    s.value = currentVal;
                }
            });
        }

        window.getGlobalUnits = getGlobalUnits;
        window.openGlobalUnitsManager = openGlobalUnitsManager;
        window.renderGlobalUnitsList = renderGlobalUnitsList;
        window.editGlobalUnit = editGlobalUnit;
        window.addGlobalUnit = addGlobalUnit;
        window.deleteGlobalUnit = deleteGlobalUnit;
        window.updateAllUnitSelects = updateAllUnitSelects;

        // --- منطق نافذة بَيَان الاحترافية لبطاقة الصنف ---
        function switchBayanTab(tabId, el) {
            const parent = document.getElementById('bayanTabContent');
            for (let child of parent.children) {
                child.classList.add('hidden');
            }
            const target = document.getElementById('tab-' + tabId);
            if (target) target.classList.remove('hidden');

            const tabBtns = document.querySelectorAll('.bayan-tab');
            tabBtns.forEach(btn => btn.classList.remove('active'));
            el.classList.add('active');

            if (tabId === 'variants' && typeof renderSmartMatrixView === 'function') {
                setTimeout(renderSmartMatrixView, 30);
            }
        }

        function addProductUnitRow(unitName = "", bVal = 1, sVal = 1) {
            const tbody = document.getElementById('productUnitsTableBody');
            const tr = document.createElement('tr');
            const units = getGlobalUnits();

            let selectHtml = `<select class="unit-type-select" style="width:100%; border:1px solid var(--border-color); background:#ffffff; color:#000000; text-align:center; cursor:pointer; border-radius:4px; padding:2px;">`;
            units.forEach(u => {
                selectHtml += `<option value="${u}" ${u === unitName ? 'selected' : ''} style="background:#ffffff; color:#000000;">${u}</option>`;
            });
            selectHtml += `</select>`;

            tr.innerHTML = `
                <td>${selectHtml}</td>
                <td><input type="number" class="base-qty" value="${bVal}" ${tbody.rows.length === 0 ? 'disabled' : ''} oninput="calculateUnitPrices()" style="text-align:center;"></td>
                <td><input type="number" class="sub-qty" value="${sVal}" ${tbody.rows.length === 0 ? 'disabled' : ''} oninput="calculateUnitPrices()" style="text-align:center;"></td>
                <td><input type="number" class="u-wholesale" value="0" oninput="this.dataset.manual='true'" style="text-align:center;"></td>
                <td><input type="number" class="u-price" value="0" oninput="this.dataset.manual='true'" style="text-align:center;"></td>
                <td><span class="u-cost-label" style="font-weight:bold; color:#64748b;">0.00</span></td>
                <td><input type="checkbox" ${tbody.rows.length === 0 ? 'checked' : ''} style="cursor:pointer;"></td>
                <td><input type="checkbox" ${tbody.rows.length === 0 ? 'checked' : ''} style="cursor:pointer;"></td>
                <td><input type="text" placeholder="باركود الوحدة" style="text-align:center;"></td>
            `;
            tbody.appendChild(tr);
            calculateUnitPrices();
        }

        function removeProductUnitRow() {
            const tbody = document.getElementById('productUnitsTableBody');
            if (tbody.rows.length > 1) {
                tbody.deleteRow(-1);
            }
        }

        function calculateUnitPrices() {
            const mainPrice = parseFloat(document.getElementById('newItemPrice').value) || 0;
            const mainCostEl = document.getElementById('newItemCost');
            const mainCost = parseFloat(mainCostEl ? mainCostEl.value : 0) || 0;
            const mainWholesale = parseFloat(document.getElementById('newItemWholesale').value) || 0;
            const costQtyEl = document.getElementById('newItemCostQty');
            if (costQtyEl && mainCostEl && document.activeElement === mainCostEl) {
                costQtyEl.value = mainCostEl.value;
            }
            const rows = document.getElementById('productUnitsTableBody').rows;

            for (let i = 0; i < rows.length; i++) {
                const bInput = rows[i].querySelector('.base-qty');
                const sInput = rows[i].querySelector('.sub-qty');
                if (!bInput || !sInput) continue;

                const baseQty = parseFloat(bInput.value) || 1;
                const subQty = parseFloat(sInput.value) || 1;

                // معامل التحويل الذكي: السعر = (سعر الأساس * كمية الأساس) / كمية الفرع
                const factor = baseQty / subQty;

                if (i === 0) {
                    rows[i].querySelector('.u-wholesale').value = mainWholesale;
                    rows[i].querySelector('.u-price').value = mainPrice;
                    const firstCostLabel = rows[i].querySelector('.u-cost-label');
                    if (firstCostLabel) firstCostLabel.innerText = mainCost.toFixed(2);
                } else {
                    const wInput = rows[i].querySelector('.u-wholesale');
                    const pInput = rows[i].querySelector('.u-price');
                    const cLabel = rows[i].querySelector('.u-cost-label');

                    if (wInput && wInput.dataset.manual !== 'true') wInput.value = (mainWholesale * factor).toFixed(2);
                    if (pInput && pInput.dataset.manual !== 'true') pInput.value = (mainPrice * factor).toFixed(2);
                    if (cLabel) cLabel.innerText = (mainCost * factor).toFixed(2);

                    // فحص الخسارة (سعر البيع أقل من التكلفة)
                    const costVal = cLabel ? parseFloat(cLabel.innerText) : 0;
                    if (wInput) wInput.style.backgroundColor = (parseFloat(wInput.value) < costVal) ? '#fee2e2' : 'white';
                    if (pInput) pInput.style.backgroundColor = (parseFloat(pInput.value) < costVal) ? '#fee2e2' : 'white';
                }

                // فحص الحقول الرئيسية فوق
                const mainCostEl = document.getElementById('newItemCost');
                const mainPriceEl = document.getElementById('newItemPrice');
                const mainWholesaleEl = document.getElementById('newItemWholesale');

                if (mainCostEl) {
                    const mCost = parseFloat(mainCostEl.value) || 0;

                    if (mainPriceEl) mainPriceEl.style.border = (parseFloat(mainPriceEl.value) < mCost) ? '2px solid #ef4444' : '';
                    if (mainWholesaleEl) mainWholesaleEl.style.border = (parseFloat(mainWholesaleEl.value) < mCost) ? '2px solid #ef4444' : '';
                }
            }
        }

        let currentProductImageData = null;

function getCurrencySymbol() {
    try {
        const stored = typeof getStore === 'function' ? getStore('pos_settings') : null;
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.currencySymbol) return parsed.currencySymbol;
        }
        const inputEl = document.getElementById('appCurrencySymbol');
        if (inputEl && inputEl.value) return inputEl.value;
    } catch(e) {}
    return 'ج.م';
}
window.getCurrencySymbol = getCurrencySymbol;

function updateAllCurrencyLabels() {
    const symbol = getCurrencySymbol();
    
    // 1. تحديث خيارات الخصم والإضافة في فواتير البيع والشراء والمرتجعات
    const discountAdditionSelects = [
        'salesDiscountType', 'salesAdditionType',
        'purDiscountType', 'purAdditionType',
        'salesReturnDiscountType', 'salesReturnAdditionType',
        'purReturnDiscountType', 'purReturnAdditionType'
    ];
    discountAdditionSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            Array.from(el.options).forEach(opt => {
                if (opt.value === 'val') {
                    opt.textContent = symbol;
                }
            });
        }
    });

    document.querySelectorAll('.currency-symbol-dynamic, select option[value="val"]').forEach(opt => {
        opt.textContent = symbol;
    });

    // 2. تحديث كروت الأصناف السريعة
    if (typeof renderQuickItems === 'function') renderQuickItems();
}
window.updateAllCurrencyLabels = updateAllCurrencyLabels;

// =========================================================================
// 💳 نظام وسائل وطرق الدفع المخصصة الديناميكية (Dynamic Payment Methods System)
// =========================================================================

window.DEFAULT_PAYMENT_METHODS = [
    { id: 'cash', name: 'كاش (نقدي)', type: 'cash', active: true, isSystem: true },
    { id: 'network', name: 'شبكة / مدى', type: 'bank', active: true, isSystem: false },
    { id: 'transfer', name: 'تحويل بنكي', type: 'bank', active: true, isSystem: false },
    { id: 'credit', name: 'أجل (حساب عميل/مورد)', type: 'credit', active: true, isSystem: true },
    { id: 'ninja', name: 'نينجا (Ninja)', type: 'bank', active: true, isSystem: false },
    { id: 'tamara', name: 'تمارا (Tamara)', type: 'bank', active: true, isSystem: false },
    { id: 'stc_pay', name: 'STC Pay', type: 'bank', active: true, isSystem: false },
    { id: 'visa', name: 'فيزا / ماستركارد', type: 'bank', active: true, isSystem: false }
];

function getPaymentMethods() {
    try {
        const stored = typeof getStore === 'function' ? getStore('bayan_payment_methods') : null;
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch(e) {}
    return window.DEFAULT_PAYMENT_METHODS;
}

function savePaymentMethods(methodsList) {
    if (typeof setStore === 'function') {
        setStore('bayan_payment_methods', JSON.stringify(methodsList));
    }
    populatePaymentMethodSelects();
    renderPaymentMethodsSettings();
}

function populatePaymentMethodSelects() {
    const methods = getPaymentMethods().filter(m => m.active !== false);
    
    const targetSelectIds = [
        'sales-sectionPaymentMethodSelect',
        'purchase-sectionPaymentMethodSelect',
        'sales-return-sectionPaymentMethodSelect',
        'purchase-return-sectionPaymentMethodSelect',
        'receiptTreasurySelect',
        'disburseTreasurySelect',
        'dailyReportTreasurySelect',
        'paymentMethod',
        'salePaymentMethod',
        'purchasePaymentMethod',
        'trFormPaymentMethod',
        'trPaymentMethodFilter',
        'acFilterPaymentMethod',
        'treasuryFilterPaymentMethod',
        'quickPaymentMethodSelect'
    ];

    const dynamicSelects = document.querySelectorAll('select[id*="PaymentMethod"], select[id*="paymentMethod"], select[name*="paymentMethod"]');
    const allSelects = new Set([...dynamicSelects]);
    
    targetSelectIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) allSelects.add(el);
    });

    allSelects.forEach(selectEl => {
        if (!selectEl) return;
        const currentVal = selectEl.value;
        const isFilter = selectEl.id && selectEl.id.toLowerCase().includes('filter');
        
        let html = isFilter ? '<option value="">كل وسائل الدفع...</option>' : '';
        methods.forEach(m => {
            const icon = m.type === 'cash' ? '💵' : (m.type === 'credit' ? '⏳' : '🏦');
            html += `<option value="${m.name}">${icon} ${m.name}</option>`;
        });
        selectEl.innerHTML = html;
        if (currentVal && Array.from(selectEl.options).some(o => o.value === currentVal)) {
            selectEl.value = currentVal;
        }
    });
}

function renderPaymentMethodsSettings() {
    const tbody = document.getElementById('paymentMethodsTableBody');
    if (!tbody) return;

    const methods = getPaymentMethods();
    let html = '';

    methods.forEach((m, idx) => {
        const isProtected = m.isSystem || m.id === 'cash' || m.id === 'credit' || m.type === 'cash' || m.type === 'credit';

        const typeBadge = m.type === 'cash' 
            ? '<span style="background:#ecfdf5; color:#047857; padding:4px 12px; border-radius:12px; font-weight:bold; font-size:0.8rem;">💵 نقدي (كاش)</span>'
            : m.type === 'credit'
            ? '<span style="background:#fffbeb; color:#b45309; padding:4px 12px; border-radius:12px; font-weight:bold; font-size:0.8rem;">📝 أجل (ذمم)</span>'
            : '<span style="background:#f0f9ff; color:#0369a1; padding:4px 12px; border-radius:12px; font-weight:bold; font-size:0.8rem;">🏦 بنكي / إلكتروني</span>';

        const statusBadge = isProtected 
            ? '<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:8px; font-weight:900; font-size:0.8rem;">🟢 مفعّل دائمًا</span>'
            : (m.active !== false
                ? '<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:8px; font-weight:900; font-size:0.8rem;">🟢 مفعّل</span>'
                : '<span style="background:#fee2e2; color:#b91c1c; padding:4px 10px; border-radius:8px; font-weight:900; font-size:0.8rem;">🔴 معطّل</span>');

        const orderButtons = `
            <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                <button type="button" onclick="movePaymentMethodUp(${idx})" ${idx === 0 ? 'disabled style="opacity:0.35; cursor:not-allowed; border:1px solid #e2e8f0; background:#f8fafc;"' : 'style="cursor:pointer; background:#ffffff; border:1.5px solid #cbd5e1;"'} class="btn-delete-row" title="تقديم للأعلى" style="padding:6px 10px; border-radius:10px; font-size:0.85rem; transition:0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.03);" onmouseover="if(!this.disabled) { this.style.borderColor='#3b82f6'; this.style.transform='translateY(-1px)'; }" onmouseout="if(!this.disabled) { this.style.borderColor='#cbd5e1'; this.style.transform='none'; }">
                    ⬆️
                </button>
                <button type="button" onclick="movePaymentMethodDown(${idx})" ${idx === methods.length - 1 ? 'disabled style="opacity:0.35; cursor:not-allowed; border:1px solid #e2e8f0; background:#f8fafc;"' : 'style="cursor:pointer; background:#ffffff; border:1.5px solid #cbd5e1;"'} class="btn-delete-row" title="تأخير للأسفل" style="padding:6px 10px; border-radius:10px; font-size:0.85rem; transition:0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.03);" onmouseover="if(!this.disabled) { this.style.borderColor='#3b82f6'; this.style.transform='translateY(-1px)'; }" onmouseout="if(!this.disabled) { this.style.borderColor='#cbd5e1'; this.style.transform='none'; }">
                    ⬇️
                </button>
            </div>
        `;

        const actionsHtml = isProtected ? `
            <div style="display: flex; justify-content: center; align-items: center;">
                <span style="background: #f8fafc; color: #475569; padding: 6px 16px; border-radius: 12px; font-weight: 800; font-size: 0.8rem; border: 1.5px solid #e2e8f0; display: inline-flex; align-items: center; gap: 6px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);">
                    🔒 وسيلة أساسية بالنظام
                </span>
            </div>
        ` : `
            <div style="display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap;">
                <button type="button" onclick="openAddPaymentMethodModal(${idx})" style="padding:6px 14px; border-radius:10px; border:1.5px solid #bfdbfe; background:linear-gradient(135deg, #eff6ff, #dbeafe); color:#1d4ed8; cursor:pointer; font-weight:900; font-size:0.82rem; font-family:'Cairo',sans-serif; display:inline-flex; align-items:center; gap:5px; transition:0.25s; box-shadow:0 2px 6px rgba(29,78,216,0.08);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 10px rgba(29,78,216,0.18)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 6px rgba(29,78,216,0.08)'">
                    ✏️ تعديل
                </button>
                <button type="button" onclick="togglePaymentMethodActive(${idx})" style="padding:6px 14px; border-radius:10px; border:1.5px solid ${m.active !== false ? '#fed7aa' : '#bbf7d0'}; background:linear-gradient(135deg, ${m.active !== false ? '#fff7ed, #ffedd5' : '#f0fdf4, #dcfce7'}); color:${m.active !== false ? '#c2410c' : '#15803d'}; cursor:pointer; font-weight:900; font-size:0.82rem; font-family:'Cairo',sans-serif; display:inline-flex; align-items:center; gap:5px; transition:0.25s; box-shadow:0 2px 6px rgba(0,0,0,0.05);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.05)'">
                    ${m.active !== false ? '⏸️ تعطيل' : '▶️ تفعيل'}
                </button>
                <button type="button" onclick="deletePaymentMethod(${idx})" title="حذف وسيلة الدفع" style="padding:6px 12px; border-radius:10px; border:1.5px solid #fecaca; background:linear-gradient(135deg, #fef2f2, #fee2e2); color:#dc2626; cursor:pointer; font-weight:900; font-size:0.85rem; font-family:'Cairo',sans-serif; display:inline-flex; align-items:center; justify-content:center; transition:0.25s; box-shadow:0 2px 6px rgba(220,38,38,0.08);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 10px rgba(220,38,38,0.2)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 6px rgba(220,38,38,0.08)'">
                    🗑️ حذف
                </button>
            </div>
        `;

        html += `
            <tr style="border-bottom:1px solid #f1f5f9; transition:0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <td style="padding:12px 10px; font-weight:900; color:#64748b; text-align:center;">${idx + 1}</td>
                <td style="padding:12px 15px; font-weight:900; color:#1e293b; font-size:0.95rem;">${m.name}</td>
                <td style="padding:12px 15px;">${typeBadge}</td>
                <td style="padding:12px 15px; text-align:center;">${statusBadge}</td>
                <td style="padding:12px 15px; text-align:center;">${orderButtons}</td>
                <td style="padding:12px 15px; text-align:center;">${actionsHtml}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function openAddPaymentMethodModal(editIdx = null) {
    const modal = document.getElementById('addPaymentMethodModal');
    if (!modal) return;
    const titleEl = document.getElementById('pmModalTitle');
    
    if (editIdx !== null && editIdx !== undefined && editIdx !== '') {
        const methods = getPaymentMethods();
        const m = methods[editIdx];
        if (m) {
            if (m.isSystem || m.id === 'cash' || m.id === 'credit' || m.type === 'cash' || m.type === 'credit') {
                if (typeof showToast === 'function') showToast("🔒 عذراً، لا يمكن تعديل وسائل الدفع الأساسية للنظام (نقدي / أجل)", "warning");
                return;
            }
            if (titleEl) titleEl.innerHTML = '✏️ تعديل وسيلة الدفع';
            document.getElementById('pmEditId').value = editIdx;
            document.getElementById('pmNameInput').value = m.name;
            document.getElementById('pmTypeSelect').value = m.type || 'bank';
        }
    } else {
        if (titleEl) titleEl.innerHTML = '💳 إضافة وسيلة دفع جديدة';
        document.getElementById('pmEditId').value = '';
        document.getElementById('pmNameInput').value = '';
        document.getElementById('pmTypeSelect').value = 'bank';
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setTimeout(() => {
        const inp = document.getElementById('pmNameInput');
        if (inp) inp.focus();
    }, 100);
}

function closeAddPaymentMethodModal() {
    const modal = document.getElementById('addPaymentMethodModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

function savePaymentMethodFromModal() {
    const nameInput = document.getElementById('pmNameInput');
    const typeSelect = document.getElementById('pmTypeSelect');
    const editIdInput = document.getElementById('pmEditId');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    const type = typeSelect ? typeSelect.value : 'bank';
    const editIdx = editIdInput ? editIdInput.value : '';

    if (!name) {
        if (typeof showToast === 'function') showToast("⚠️ يرجى إدخال اسم وسيلة الدفع", "error");
        return;
    }

    const methods = getPaymentMethods();
    if (editIdx !== '' && editIdx !== null && methods[editIdx]) {
        if (methods[editIdx].isSystem || methods[editIdx].id === 'cash' || methods[editIdx].id === 'credit') {
            if (typeof showToast === 'function') showToast("🔒 لا يمكن تعديل وسائل النظام الأساسية", "warning");
            return;
        }
        methods[editIdx].name = name;
        methods[editIdx].type = type;
        if (typeof showToast === 'function') showToast(`✅ تم تحديث وسيلة الدفع (${name}) بنجاح!`, "success");
    } else {
        methods.push({
            id: 'pm_' + Date.now(),
            name: name,
            type: type,
            active: true,
            isSystem: false
        });
        if (typeof showToast === 'function') showToast(`✅ تم إضافة وسيلة الدفع (${name}) بنجاح!`, "success");
    }

    savePaymentMethods(methods);
    closeAddPaymentMethodModal();
}

function togglePaymentMethodActive(idx) {
    const methods = getPaymentMethods();
    if (methods[idx]) {
        if (methods[idx].isSystem || methods[idx].id === 'cash' || methods[idx].id === 'credit' || methods[idx].type === 'cash' || methods[idx].type === 'credit') {
            if (typeof showToast === 'function') showToast("🔒 وسيلة الدفع هذه أساسية في المنظومة ولا يمكن تعطيلها", "warning");
            return;
        }
        methods[idx].active = !methods[idx].active;
        savePaymentMethods(methods);
        if (typeof showToast === 'function') {
            showToast(`${methods[idx].active ? '🟢 تم تفعيل' : '⏸️ تم تعطيل'} وسيلة (${methods[idx].name})`);
        }
    }
}

function deletePaymentMethod(idx) {
    const methods = getPaymentMethods();
    if (methods[idx] && !methods[idx].isSystem) {
        const name = methods[idx].name;
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'error',
                titleText: '🗑️ تأكيد حذف وسيلة الدفع',
                msg: `هل أنت متأكد من رغبتك في حذف وسيلة الدفع (<b style="color:#ef4444;">${name}</b>) نهائياً من النظام؟`,
                confirmText: 'نعم، حذف نهائي',
                cancelText: 'إلغاء',
                showCancel: true,
                onConfirm: () => {
                    methods.splice(idx, 1);
                    savePaymentMethods(methods);
                    if (typeof showToast === 'function') showToast(`🗑️ تم حذف وسيلة الدفع (${name}) بنجاح!`, "info");
                }
            });
        } else {
            methods.splice(idx, 1);
            savePaymentMethods(methods);
        }
    }
}

function movePaymentMethodUp(idx) {
    const methods = getPaymentMethods();
    if (idx > 0 && idx < methods.length) {
        const temp = methods[idx];
        methods[idx] = methods[idx - 1];
        methods[idx - 1] = temp;
        savePaymentMethods(methods);
        if (typeof showToast === 'function') showToast(`⬆️ تم تقديم وسيلة (${temp.name}) للأعلى`);
    }
}

function movePaymentMethodDown(idx) {
    const methods = getPaymentMethods();
    if (idx >= 0 && idx < methods.length - 1) {
        const temp = methods[idx];
        methods[idx] = methods[idx + 1];
        methods[idx + 1] = temp;
        savePaymentMethods(methods);
        if (typeof showToast === 'function') showToast(`⬇️ تم تأخير وسيلة (${temp.name}) للأسفل`);
    }
}

// تصدير كافة الدوال لـ window لضمان عملها عالمياً في أي مكان
window.getPaymentMethods = getPaymentMethods;
window.savePaymentMethods = savePaymentMethods;
window.populatePaymentMethodSelects = populatePaymentMethodSelects;
window.renderPaymentMethodsSettings = renderPaymentMethodsSettings;
window.openAddPaymentMethodModal = openAddPaymentMethodModal;
window.closeAddPaymentMethodModal = closeAddPaymentMethodModal;
window.savePaymentMethodFromModal = savePaymentMethodFromModal;
window.togglePaymentMethodActive = togglePaymentMethodActive;
window.deletePaymentMethod = deletePaymentMethod;
window.movePaymentMethodUp = movePaymentMethodUp;
window.movePaymentMethodDown = movePaymentMethodDown;

// تشغيل وسائط الدفع عند بدء التطبيق
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        populatePaymentMethodSelects();
        renderPaymentMethodsSettings();
    }, 400);
});
