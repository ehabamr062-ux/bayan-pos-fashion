// ============================================================
//  إدارة حسابات العملاء والموردين وكشوف الحساب (Partners & Statements)
// ============================================================
        window.openNewAccountModal = function(defaultType = null) {
            if (typeof checkPermission === 'function' && !checkPermission('accounts_add')) return;
            
            if (document.getElementById('editAccId')) document.getElementById('editAccId').value = '';
            document.querySelectorAll('#newAccountModal input:not([type=radio]):not([type=checkbox]):not([type=hidden]), #newAccountModal textarea').forEach(el => el.value = '');

            if (document.getElementById('accDebit')) document.getElementById('accDebit').value = '0';
            if (document.getElementById('accCredit')) document.getElementById('accCredit').value = '0';

            if (defaultType) {
                const r = document.querySelector(`input[name="accType"][value="${defaultType}"]`);
                if (r) r.checked = true;
            }

            const modal = document.getElementById('newAccountModal');
            if (modal) modal.classList.remove('hidden');

            const todayStr = new Date().toLocaleDateString('en-CA');
            if (document.getElementById('accBalDate')) document.getElementById('accBalDate').value = todayStr;
            const createdEl = document.getElementById('accCreatedAt');
            if (createdEl) createdEl.innerText = new Date().toLocaleDateString('ar-EG');
            const nameInp = document.getElementById('accName');
            if (nameInp) nameInp.focus();
        };

        window.closeNewAccountModal = function() {
            const modal = document.getElementById('newAccountModal');
            if (modal) modal.classList.add('hidden');
        };

        window.previewAccImage = function(event) {

            const file = event.target.files[0];

            if (file) {

                const reader = new FileReader();

                reader.onload = function(e) {

                    const imgPreview = document.getElementById('accImagePreview');

                    imgPreview.src = e.target.result;

                    imgPreview.dataset.base64 = e.target.result;

                };

                reader.readAsDataURL(file);

            }

        };

        async function saveAccount(isNew) {

            // التحقق من صلاحية الاستخدام قبل الحفظ

            const editId = document.getElementById('editAccId').value;

            const isEdit = !!editId;

            if (isEdit && !checkPermission('accounts_edit')) return;

            if (!isEdit && !checkPermission('accounts_add')) return;

            const name = (document.getElementById('accName').value || '').trim();

            if (!name) return alert("يرجى إدخال اسم الحساب");

            // منع تكرار اسم الحساب لتفادي تداخل المعاملات المالية
            const cleanArabic = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            const targetClean = cleanArabic(name);
            const isDuplicate = accounts.some(a => cleanArabic(a.name) === targetClean && (!editId || a.id != editId));
            if (isDuplicate) {
                if (typeof showToast === 'function') showToast(`🚫 يوجد حساب مسجل بالفعل باسم "${name}"! يرجى اختيار اسم فريد.`, "error");
                else alert(`🚫 يوجد حساب مسجل بالفعل باسم "${name}"!`);
                return;
            }

            const landValue = (document.getElementById('accLandline')?.value || '').trim();

            if (landValue && landValue.length !== 10) {

                return alert("⚠️ يجب أن يتكون رقم الخط الأرضي من 10 أرقام (مثال: 0212345678)");

            }

            const accountData = {

                id: editId ? parseInt(editId) : Date.now(),

                name: name,

                type: document.querySelector('input[name="accType"]:checked').value,

                image: document.getElementById('accImagePreview')?.dataset?.base64 || '',

                debit: document.getElementById('accDebit').value,

                credit: document.getElementById('accCredit').value,

                balanceDate: document.getElementById('accBalDate').value,

                mobile: document.getElementById('accMobile').value,

                landline: (document.getElementById('accLandline')?.value || '').trim(),

                email: document.getElementById('accEmail')?.value || '',

                address: document.getElementById('accAddress')?.value || '',

                code: document.getElementById('accCode')?.value || '',

                tax: document.getElementById('accTax')?.value || '',

                category: document.getElementById('accCategory')?.value || 'عام',

                discount: document.getElementById('accDiscount')?.value || 0,

                maxDebt: parseFloat((document.getElementById('accMaxAllowedDebtField')?.value || '0').replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])) || parseFloat(document.getElementById('accMaxAllowedDebtField')?.value || 0),

                priceLevel: document.getElementById('accPriceLevel')?.value || 'retail',

                remind: document.getElementById('accRemind')?.checked || false,

                inactive: document.getElementById('accInactive')?.checked || false,

                notes: document.getElementById('accNotes')?.value || ''

            };

            if (editId) {

                // وضع التعديل

                const targetId = Number(editId);

                const idx = accounts.findIndex(a => a.id == targetId);
                let oldName = '';

                if (idx !== -1) {
                    oldName = accounts[idx].name;
                    accounts[idx] = accountData;
                } else {
                    // إذا لم نجد الحساب في المصفوفة لسبب ما، نبحث عنه بالاسم كبديل
                    const idxByName = accounts.findIndex(a => a.name === accountData.name);
                    if (idxByName !== -1) {
                        oldName = accounts[idxByName].name;
                        accounts[idxByName] = accountData;
                    }
                }

                // 🔄 تحديث متتالي لسجل الحركات عند تغيير اسم الحساب لمنع اختفاء الفواتير التاريخية
                if (oldName && oldName !== accountData.name && typeof transactions !== 'undefined' && Array.isArray(transactions)) {
                    const cleanOld = (oldName || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
                    let changedTx = false;
                    transactions.forEach(t => {
                        const tClean = (t.partner || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
                        if (t.partner === oldName || tClean === cleanOld) {
                            t.partner = accountData.name;
                            changedTx = true;
                        }
                    });
                    if (changedTx && typeof db !== 'undefined' && db.transactions) {
                        try {
                            await db.transactions.bulkPut(transactions);
                        } catch (txErr) {
                            console.warn("⚠️ تعذر تحديث اسم الطرف في قاعدة البيانات محلياً:", txErr);
                        }
                    }
                }

                await db.accounts.put(accountData); // حفظ مباشر وإلزامي في قاعدة البيانات

            } else {

                // وضع جديد

                accounts.unshift(accountData);

                await db.accounts.add(accountData); // إضافة مباشرة للداتا بيز

            }

            try {

                await saveData();

            } catch (err) {

                console.error("❌ فشل حفظ البيانات:", err);

                return alert("⚠️ حدث خطأ أثناء حفظ البيانات في قاعدة البيانات: " + err.message);

            }

            if (isNew) {

                // حفظ وإضافة آخر: تصفير كل الحقول بما فيها الحقل المختفي الخاص بالـ ID للتعديل

                document.getElementById('editAccId').value = '';

                document.querySelectorAll('#newAccountModal input:not([type=radio]):not([type=checkbox]):not([type=hidden]), #newAccountModal textarea').forEach(el => el.value = '');

                // تصفير الأرصدة الافتراضية للتأكد من عدم تكرارها

                if (document.getElementById('accDebit')) document.getElementById('accDebit').value = '0';

                if (document.getElementById('accCredit')) document.getElementById('accCredit').value = '0';

                document.getElementById('accBalDate').value = new Date().toLocaleDateString('en-CA');

                document.getElementById('accName').focus();

                // تصفير الصورة

                const imgPreview = document.getElementById('accImagePreview');

                if (imgPreview) {

                    imgPreview.src = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22avatarGrad%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%236366f1%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%233b82f6%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22url(%23avatarGrad)%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2240%22%20r%3D%2216%22%20fill%3D%22%23ffffff%22%2F%3E%3Cpath%20d%3D%22M25%2075c0-12%2012-16%2025-16s25%204%2025%2016v5H25v-5z%22%20fill%3D%22%23ffffff%22%2F%3E%3C%2Fsvg%3E';

                    delete imgPreview.dataset.base64;

                }

                const imgInput = document.getElementById('accImageInput');

                if (imgInput) imgInput.value = '';

                // تنبيه صغير وسريع

                const notification = document.createElement('div');

                notification.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:var(--main-green); color:white; padding:10px 30px; border-radius:30px; z-index:9000; box-shadow:0 5px 15px rgba(0,0,0,0.2);";

                notification.innerText = "✅ تم حفظ الحساب وبدء حساب جديد";

                document.body.appendChild(notification);

                setTimeout(() => notification.remove(), 2000);

            } else {

                showToast(`✅ تم حفظ تعديلات "${name}" (الحد: ${accountData.maxDebt})`, "success");

                closeNewAccountModal();

            }

            // تحديث الجدول إذا كان مفتوحاً

            if (!document.getElementById('accounts-section').classList.contains('hidden')) renderAccountsTable();

        }

        // ================= منطق جدول الحسابات العام (Accounts Table Logic) =================

        // --- تحسينات إدارة الحسابات (Accounts Enhancements) ---

        // تهيئة التخصيص لجدول الحسابات (الترتيب المعتمد الجديد: تحديد، م، الكود، الاسم، مدين، دائن، إجمالي البيع، آخر حركة، آخر قبض، طبيعة الحساب، التصنيف)
        const DEFAULT_ACCOUNTS_COL_ORDER = [10, 0, 1, 2, 5, 6, 7, 9, 8, 3, 4];

        let accountsColumnVisibility = JSON.parse(getStore('pos_acc_cols') || '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true}');

        let accountsColumnOrder;
        try {
            const savedOrder = getStore('pos_acc_cols_order_v2');
            if (savedOrder) {
                const parsed = JSON.parse(savedOrder);
                if (Array.isArray(parsed) && parsed.length === 11) {
                    accountsColumnOrder = parsed;
                } else {
                    accountsColumnOrder = [...DEFAULT_ACCOUNTS_COL_ORDER];
                    setStore('pos_acc_cols_order_v2', JSON.stringify(accountsColumnOrder));
                }
            } else {
                accountsColumnOrder = [...DEFAULT_ACCOUNTS_COL_ORDER];
                setStore('pos_acc_cols_order_v2', JSON.stringify(accountsColumnOrder));
            }
        } catch (e) {
            accountsColumnOrder = [...DEFAULT_ACCOUNTS_COL_ORDER];
        }

        function toggleAccountsColumn(index, isVisible) {

            accountsColumnVisibility[index] = isVisible;

            setStore('pos_acc_cols', JSON.stringify(accountsColumnVisibility));

            renderAccountsTable();
        }

        function showInventoryColumnCustomizer() {
            const cols = [
                { id: 0, name: "مربع التحديد (✔️)" },
                { id: 1, name: "م (الترقيم)" },
                { id: "quick", name: "صنف سريع ⚡" },
                { id: 2, name: "كود الصنف" },
                { id: "internal", name: "كود داخلي" },
                { id: 3, name: "اسم الصنف" },
                { id: 4, name: "الباركود" },
                { id: 5, name: "المكان / الرف" },
                { id: 6, name: "رصيد البداية" },
                { id: 7, name: "الوارد (+)" },
                { id: 8, name: "المنصرف (-)" },
                { id: 13, name: "بيع جملة" },
                { id: 10, name: "بيع قطاعي" },
                { id: "margin", name: "نسبة الربح %" },
                { id: 11, name: "آخر شراء" },
                { id: 12, name: "متوسط التكلفة" },
                { id: "detailed", name: "الوحدات والعبوات" },
                { id: 9, name: "الرصيد النهائي" }
            ];

            let html = `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 15px; max-height: 55vh; overflow-y: auto;">`;
            cols.forEach(c => {
                const checked = inventoryColumnVisibility[c.id] !== false ? 'checked' : '';
                html += `
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px 14px; background: #f8fafc; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 0.88rem; font-weight: 700; color: #1e293b; transition: all 0.2s;"
                           onmouseover="this.style.background='#eff6ff'; this.style.borderColor='#3b82f6';"
                           onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0';">
                        <input type="checkbox" class="inv-col-custom-chk" data-col-id="${c.id}" ${checked} 
                               onchange="toggleInventoryColumn('${c.id}', this.checked)"
                               style="width: 17px; height: 17px; cursor: pointer; accent-color: #7c3aed;">
                        <span>${c.name}</span>
                    </label>`;
            });
            html += `</div>`;

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 99999; animation: fadeIn 0.2s ease-out;';

            modal.innerHTML = `
                <div style="width: 520px; max-width: 95vw; background: #ffffff; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.35); border: 2.5px solid #7c3aed; overflow: hidden; display: flex; flex-direction: column; text-align: right; direction: rtl;">
                    <!-- هيدر النافذة -->
                    <div style="background: linear-gradient(135deg, #1e1b4b, #3730a3); padding: 14px 20px; border-bottom: 2px solid #7c3aed; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.3rem;">⚙️</span>
                            <h3 style="margin: 0; color: #ffffff; font-size: 1.1rem; font-weight: 900;">تخصيص أعمدة جدول المخزن</h3>
                        </div>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="background: rgba(255,255,255,0.15); border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 1.1rem; cursor: pointer; color: #ffffff; display: flex; align-items: center; justify-content: center; transition: 0.2s;"
                                onmouseover="this.style.background='rgba(239, 68, 68, 0.8)';"
                                onmouseout="this.style.background='rgba(255,255,255,0.15)';">&times;</button>
                    </div>

                    <!-- شريط إجراءات سريعة لتحديد الكل أو إلغاء الكل -->
                    <div style="padding: 10px 20px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.82rem; font-weight: 700; color: #64748b;">اختر الأعمدة التي ترغب في إظهارها:</span>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="document.querySelectorAll('.inv-col-custom-chk').forEach(chk => { chk.checked = true; toggleInventoryColumn(chk.getAttribute('data-col-id'), true); });"
                                    style="padding: 4px 10px; font-size: 0.78rem; font-weight: 800; background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 6px; cursor: pointer;">
                                تحديد الكل
                            </button>
                            <button onclick="document.querySelectorAll('.inv-col-custom-chk').forEach(chk => { chk.checked = false; toggleInventoryColumn(chk.getAttribute('data-col-id'), false); });"
                                    style="padding: 4px 10px; font-size: 0.78rem; font-weight: 800; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer;">
                                إلغاء الكل
                            </button>
                        </div>
                    </div>

                    <!-- قائمة مربعات الأعمدة -->
                    ${html}

                    <!-- فوتر النافذة -->
                    <div style="padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                        <button style="width: 100%; height: 44px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); transition: all 0.2s;"
                                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(124, 58, 237, 0.4)';"
                                onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(124, 58, 237, 0.3)';"
                                onclick="this.closest('.modal-overlay').remove()">
                            💾 حفظ التخصيص وإغلاق
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        }

        // ================= تخصيص أعمدة كشف الحساب (Statement Columns) =================

        let statementColumnVisibility = JSON.parse(getStore('pos_stmt_cols') || '{"0":false,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true}');

        function toggleStatementColumn(index, isVisible) {

            statementColumnVisibility[index] = isVisible;

            setStore('pos_stmt_cols', JSON.stringify(statementColumnVisibility));

            generateAccountStatement(); // تحديث العرض فورياً

        }

        function showStatementColumnCustomizer() {

            const cols = [

                { id: 0, name: "تحديد" },

                { id: 1, name: "التاريخ" },

                { id: 2, name: "نوع الحركة" },

                { id: 3, name: "البيان" },

                { id: 4, name: "مدين (عليه)" },

                { id: 5, name: "دائن (له)" },

                { id: 6, name: "الرصيد" }

            ];

            let html = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; padding:15px;">`;

            cols.forEach(c => {

                const checked = statementColumnVisibility[c.id] ? 'checked' : '';

                html += `<label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:8px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; font-size:0.85rem;">

                            <input type="checkbox" ${checked} onchange="toggleStatementColumn(${c.id}, this.checked)"> ${c.name}

                         </label>`;

            });

            html += `</div>`;

            const modal = document.createElement('div');

            modal.className = 'modal-overlay';

            modal.style.zIndex = '10005';

            modal.innerHTML = `

                <div class="login-box" style="width: 400px; text-align: right; padding: 25px;">

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1.5px solid #3498db; padding-bottom:10px;">

                        <h3 style="margin:0; color:#2c3e50;">⚙️ تخصيص أعمدة كشف الحساب</h3>

                        <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#95a5a6;">&times;</button>

                    </div>

                    ${html}

                    <button class="action-btn btn-save" style="width:100%; margin-top:15px; background:#2c3e50; color:white;" onclick="this.closest('.modal-overlay').remove()">✅ حفظ وإغلاق</button>

                </div>

            `;

            document.body.appendChild(modal);

        }

        function toggleAccountsColumn(index, isVisible) {
            accountsColumnVisibility[index] = isVisible;
            setStore('pos_acc_cols', JSON.stringify(accountsColumnVisibility));
            renderAccountsTable();

            // تحديث البطاقة والمفتاح فورياً في النافذة إذا كانت مفتوحة
            const card = document.getElementById(`accColCard_${index}`);
            const input = document.getElementById(`accColInput_${index}`);
            const slider = document.getElementById(`accColSlider_${index}`);
            const circle = document.getElementById(`accColCircle_${index}`);

            if (card) {
                if (isVisible) {
                    card.style.background = '#fdf2f8';
                    card.style.borderColor = '#ec4899';
                } else {
                    card.style.background = '#f8fafc';
                    card.style.borderColor = '#e2e8f0';
                }
            }
            if (slider) {
                slider.style.background = isVisible ? '#be185d' : '#cbd5e1';
            }
            if (circle) {
                circle.style.left = isVisible ? '23px' : '3px';
            }
            if (input && input.checked !== isVisible) {
                input.checked = isVisible;
            }
        }

        function setAccountsAllColumns(isVisible) {
            const allIds = [10, 0, 1, 2, 5, 6, 7, 9, 8, 3, 4];
            allIds.forEach(id => {
                accountsColumnVisibility[id] = isVisible;
            });
            setStore('pos_acc_cols', JSON.stringify(accountsColumnVisibility));
            renderAccountsTable();
            showAccountsColumnCustomizer();
            if (typeof showToast === 'function') {
                showToast(isVisible ? '👁️ تم إظهار جميع الأعمدة بنجاح' : '⚠️ تم إخفاء جميع الأعمدة', isVisible ? 'success' : 'info');
            }
        }

        function resetAccountsColumnsToDefault() {
            accountsColumnOrder = [...DEFAULT_ACCOUNTS_COL_ORDER];
            setStore('pos_acc_cols_order_v2', JSON.stringify(accountsColumnOrder));
            accountsColumnVisibility = {"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true,"10":true};
            setStore('pos_acc_cols', JSON.stringify(accountsColumnVisibility));
            renderAccountsTable();
            showAccountsColumnCustomizer();
            if (typeof showToast === 'function') showToast('✅ تم إعادة ضبط الأعمدة للوضع الافتراضي', 'success');
        }

        function showAccountsColumnCustomizer() {
            const allCols = [
                { id: 10, name: "تحديد الحساب", icon: "🔘", desc: "دائرة اختيار وتحديد الحساب" },
                { id: 0, name: "م (المسلسل)", icon: "🔢", desc: "الترقيم التلقائي للأسطر" },
                { id: 1, name: "كود الحساب", icon: "🏷️", desc: "كود العميل أو المورد" },
                { id: 2, name: "اسم الحساب", icon: "👤", desc: "الاسم وشارات التجميد والتنبيه" },
                { id: 5, name: "مدين (عليه)", icon: "🔴", desc: "المبالغ المطلوبة من العميل" },
                { id: 6, name: "دائن (له)", icon: "🟢", desc: "المبالغ المستحقة للطرف" },
                { id: 7, name: "إجمالي البيع", icon: "📊", desc: "صافي مسحوبات ومبيعات العميل" },
                { id: 9, name: "آخر حركة", icon: "⏱️", desc: "تاريخ آخر عملية مسجلة" },
                { id: 8, name: "آخر تاريخ قبض", icon: "💰", desc: "تاريخ آخر سند قبض مستلم" },
                { id: 3, name: "طبيعة الحساب", icon: "🤝", desc: "عميل / مورد / مندوب..." },
                { id: 4, name: "التصنيف", icon: "📁", desc: "عام / جملة / قطاعي / موزع" }
            ];

            let cardsHtml = '';

            allCols.forEach(c => {
                const isChecked = accountsColumnVisibility[c.id] !== false;
                const activeBg = isChecked ? '#fdf2f8' : '#f8fafc';
                const activeBorder = isChecked ? '#ec4899' : '#e2e8f0';

                cardsHtml += `
                    <div id="accColCard_${c.id}" 
                         onclick="toggleAccountsColumn(${c.id}, !document.getElementById('accColInput_${c.id}').checked)"
                         style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:${activeBg}; border:2px solid ${activeBorder}; border-radius:12px; cursor:pointer; transition:all 0.2s ease; user-select:none; box-shadow:0 2px 5px rgba(0,0,0,0.03);">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.3rem; display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; background:#ffffff; border-radius:8px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05); flex-shrink:0;">${c.icon}</span>
                            <div>
                                <div style="font-weight:900; font-size:0.95rem; color:#0f172a;">${c.name}</div>
                                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${c.desc}</div>
                            </div>
                        </div>
                        <div onclick="event.stopPropagation();" style="display:flex; align-items:center;">
                            <label style="position:relative; display:inline-block; width:44px; height:24px; margin:0; cursor:pointer;">
                                <input type="checkbox" id="accColInput_${c.id}" ${isChecked ? 'checked' : ''} 
                                       onchange="toggleAccountsColumn(${c.id}, this.checked)"
                                       style="opacity:0; width:0; height:0; position:absolute;">
                                <span id="accColSlider_${c.id}" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:${isChecked ? '#be185d' : '#cbd5e1'}; transition:0.3s; border-radius:24px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.2);">
                                    <span id="accColCircle_${c.id}" style="position:absolute; content:''; height:18px; width:18px; left:${isChecked ? '23px' : '3px'}; bottom:3px; background:white; transition:0.3s; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.25);"></span>
                                </span>
                            </label>
                        </div>
                    </div>
                `;
            });

            // إزالة المودال القديم إذا وجد
            const oldModal = document.querySelector('.accounts-cols-customizer');
            if (oldModal) oldModal.remove();

            const modal = document.createElement('div');
            modal.className = 'modal-overlay accounts-cols-customizer';
            modal.style.zIndex = '10006';
            modal.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
            modal.style.backdropFilter = 'none';

            modal.innerHTML = `
                <div style="width: 600px; max-width: 95vw; background:#ffffff; border:2.5px solid #1e293b; border-radius:18px; box-shadow:0 25px 60px rgba(15, 23, 42, 0.5); overflow:hidden; display:flex; flex-direction:column; text-align:right; animation:modalPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
                    
                    <!-- الهيدر الكحلي الفاخر -->
                    <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color:#ffffff; padding:18px 24px; display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #334155;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:42px; height:42px; border-radius:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.35rem;">
                                ⚙️
                            </div>
                            <div>
                                <h3 style="margin:0; font-size:1.15rem; font-weight:900; color:#ffffff; letter-spacing:-0.3px;">إظهار وإخفاء أعمدة الحسابات</h3>
                                <p style="margin:2px 0 0 0; font-size:0.8rem; color:#94a3b8;">تحكّم في إظهار أو إخفاء أي عمود في جدول الحسابات بكل سهولة</p>
                            </div>
                        </div>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); width:34px; height:34px; border-radius:8px; font-size:1.4rem; cursor:pointer; color:#ffffff; display:flex; align-items:center; justify-content:center; line-height:1; transition:0.2s;"
                                onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">&times;</button>
                    </div>

                    <!-- شريط أدوات سريع (إظهار الكل / استعادة الافتراضي) -->
                    <div style="background:#f1f5f9; padding:10px 20px; border-bottom:1.5px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.82rem; font-weight:bold; color:#475569;">💡 انقر على أي خانة لتفعيلها أو إخفائها فوراً:</span>
                        <div style="display:flex; gap:8px;">
                            <button type="button" onclick="setAccountsAllColumns(true)" 
                                    style="background:#ffffff; border:1.5px solid #cbd5e1; color:#0f172a; padding:5px 12px; border-radius:7px; font-size:0.8rem; font-weight:bold; cursor:pointer; transition:0.2s;"
                                    onmouseover="this.style.borderColor='#be185d'; this.style.color='#be185d';" onmouseout="this.style.borderColor='#cbd5e1'; this.style.color='#0f172a';">
                                👁️ إظهار الكل
                            </button>
                            <button type="button" onclick="resetAccountsColumnsToDefault()" 
                                    style="background:#ffffff; border:1.5px solid #cbd5e1; color:#0f172a; padding:5px 12px; border-radius:7px; font-size:0.8rem; font-weight:bold; cursor:pointer; transition:0.2s;"
                                    onmouseover="this.style.borderColor='#0284c7'; this.style.color='#0284c7';" onmouseout="this.style.borderColor='#cbd5e1'; this.style.color='#0f172a';">
                                🔄 الوضع الافتراضي
                            </button>
                        </div>
                    </div>

                    <!-- شبكة الأعمدة (Cards Grid) -->
                    <div style="padding:16px 20px; max-height:430px; overflow-y:auto; display:grid; grid-template-columns: 1fr 1fr; gap:10px; background:#f8fafc;">
                        ${cardsHtml}
                    </div>

                    <!-- الفوتر وزر الإغلاق -->
                    <div style="background:#ffffff; padding:14px 20px; border-top:1.5px solid #e2e8f0; display:flex; justify-content:flex-end;">
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" 
                                style="width:100%; height:46px; background:linear-gradient(135deg, #0f172a, #1e293b); color:#ffffff; font-size:0.95rem; font-weight:900; border:none; border-radius:10px; cursor:pointer; transition:0.2s; box-shadow:0 4px 12px rgba(15, 23, 42, 0.2);"
                                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(15, 23, 42, 0.3)'" 
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(15, 23, 42, 0.2)'">
                            ✅ حفظ وإغلاق
                        </button>
                    </div>

                </div>
            `;

            document.body.appendChild(modal);
        }

        function renderAccountsTable() {

            const tbody = document.getElementById('accountsTableBody');

            if (!tbody) return;

            tbody.innerHTML = '';

            // --- ⚙️ منطق إعادة ترتيب الأعمدة برمجياً ---

            const thead = document.querySelector('#accountsTableHead tr') || 

                          document.querySelector('.accounts-table-wrapper thead tr') ||

                          document.querySelector('[id$="-section"] .invoice-table thead tr');

            const tfoot = document.querySelector('#accountsTableFoot tr');

            // 1. إعادة ترتيب رؤوس الجدول (Thead)

            const thMap = {
                0: `<th class="col-acc-0" style="width: 35px; text-align: center; padding: 8px 4px;">م</th>`,
                1: `<th class="col-acc-code" style="width: 80px; text-align: center; padding: 8px 4px;">كود الحساب</th>`,
                2: `<th class="col-acc-1" style="min-width: 130px; text-align: right; padding: 8px 10px;">اسم الحساب</th>`,
                3: `<th class="col-acc-2" style="width: 80px; text-align: center; padding: 8px 4px;">طبيعة الحساب</th>`,
                4: `<th class="col-acc-3" style="width: 75px; text-align: center; padding: 8px 4px;">التصنيف</th>`,
                5: `<th class="col-acc-4" style="width: 85px; text-align: center; padding: 8px 4px;">مدين (عليه)</th>`,
                6: `<th class="col-acc-5" style="width: 85px; text-align: center; padding: 8px 4px;">دائن (له)</th>`,
                7: `<th class="col-acc-6" style="width: 85px; text-align: center; padding: 8px 4px;">إجمالي البيع</th>`,
                8: `<th class="col-acc-7" style="width: 90px; text-align: center; padding: 8px 4px;">آخر تاريخ قبض</th>`,
                9: `<th class="col-acc-8" style="width: 90px; text-align: center; padding: 8px 4px;">آخر حركة</th>`,
                10: `<th class="col-acc-9" style="width: 60px; min-width: 60px; text-align: center; white-space: nowrap; padding: 8px 4px; background: #9d174d;">تحديد</th>`
            };

            let thOrderHtml = '';

            accountsColumnOrder.forEach(idx => {

                const isVisible = accountsColumnVisibility[idx];

                const th = thMap[idx];

                const style = isVisible ? '' : 'style="display:none;"';

                thOrderHtml += th.replace('<th ', `<th ${style} `);

            });

            if (thead) thead.innerHTML = thOrderHtml;

            // 2. إعادة ترتيب تذييل الجدول (Tfoot)

            const tfMap = {

                0: `<td></td>`,

                1: `<td></td>`,

                2: `<td style="text-align:left; font-weight:900;">إجمالي الأرصدة:</td>`,

                3: `<td></td>`,

                4: `<td></td>`,

                5: `<td><span id="totalGlobalDebit" class="color-danger" style="font-weight:900; font-size:1.1rem;">0.00</span></td>`,

                6: `<td><span id="totalGlobalCredit" class="color-success" style="font-weight:900; font-size:1.1rem;">0.00</span></td>`,

                7: `<td></td>`,

                8: `<td></td>`,

                9: `<td></td>`,

                10: `<td></td>`

            };

            let tfOrderHtml = '<tr>';

            accountsColumnOrder.forEach(idx => {

                const isVisible = accountsColumnVisibility[idx];

                const tf = tfMap[idx];

                const style = isVisible ? '' : 'style="display:none;"';

                tfOrderHtml += tf.replace('<td ', `<td ${style} `);

            });

            tfOrderHtml += '</tr>';

            if (tfoot) tfoot.innerHTML = tfOrderHtml;

            const cleanArabicStr = (str) => (str || '').toString().trim().toLowerCase()
                .replace(/[أإآ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/[ىي]/g, 'ي')
                .replace(/\s+/g, ' ');

            const searchInput = document.getElementById('accSearchName');
            const rawSearch = (searchInput ? searchInput.value : '').trim().toLowerCase();
            const searchClean = cleanArabicStr(rawSearch);

            const typeFilter = document.getElementById('accFilterType')?.value || 'all';

            const catFilter = document.getElementById('accFilterCat')?.value || 'all';

            let globalTotalDebit = 0;

            let globalTotalCredit = 0;

            const filtered = accounts.filter(acc => {

                const nameClean = cleanArabicStr(acc.name);
                const matchName = nameClean.includes(searchClean);

                const matchCode = (acc.code || '').toString().toLowerCase().includes(rawSearch);

                const phoneStr = (acc.phone || acc.mobile || '').toString().toLowerCase();
                const matchPhone = phoneStr.includes(rawSearch);

                const matchType = typeFilter === 'all' || acc.type === typeFilter || (acc.type === 'mixed' && (typeFilter === 'client' || typeFilter === 'supplier'));

                const matchCat = catFilter === 'all' || acc.category === catFilter;

                return (matchName || matchCode || matchPhone) && matchType && matchCat;

            });

            filtered.forEach((acc, idx) => {

                const targetAccNameClean = cleanArabicStr(acc.name);
                const targetAccCode = (acc.code || '').toString().trim();

                const currentBalance = getAccountBalance(acc.name);

                let lastTransDate = acc.balanceDate || '-';
                let totalSales = 0;
                let lastReceiptDate = '-';

                // فلترة حركات الحساب بدقة مع مراعاة توحيد الهمزات والمسافات والكود
                const accTrans = (typeof transactions !== 'undefined' ? transactions : []).filter(t => {
                    if (!t) return false;
                    if (t.partner === acc.name) return true;
                    if (targetAccNameClean && cleanArabicStr(t.partner) === targetAccNameClean) return true;
                    if (targetAccCode && (t.partnerCode === targetAccCode || t.accountCode === targetAccCode)) return true;
                    return false;
                });

                accTrans.forEach(t => {
                    const transType = (t.type || '');
                    const val = parseFloat(t.total !== undefined ? t.total : (t.price || 0)) || 0;

                    // حساب صافي المبيعات (خصم أي مرتجع بيع أو مرتجع مبيعات)
                    const isSale = transType.includes('بيع') && !transType.includes('مرتجع');
                    const isSaleReturn = transType.includes('مرتجع') && (transType.includes('بيع') || transType.includes('مبيعات'));

                    if (isSale) {
                        totalSales += val;
                    } else if (isSaleReturn) {
                        totalSales -= val;
                    }

                    // تاريخ آخر سند قبض
                    if (transType.includes('قبض') && t.dateISO) {
                        if (lastReceiptDate === '-' || t.dateISO > lastReceiptDate) {
                            lastReceiptDate = t.dateISO;
                        }
                    }

                    // تاريخ آخر حركة مسجلة
                    if (t.dateISO) {
                        if (lastTransDate === '-' || t.dateISO > lastTransDate) {
                            lastTransDate = t.dateISO;
                        }
                    }

                });

                // --- منطق فلترة الأرصدة (Zero Balance Logic) ---

                const balanceFilter = document.getElementById('accFilterBalance') ? document.getElementById('accFilterBalance').value : 'all';

                const isZero = Math.abs(currentBalance) < 0.01;

                if (balanceFilter === 'nonzero' && isZero) return;

                if (balanceFilter === 'zero' && !isZero) return;

                if (balanceFilter === 'debit' && currentBalance <= 0) return;

                if (balanceFilter === 'credit' && currentBalance >= 0) return;

                let displayDebit = currentBalance > 0 ? currentBalance : 0;

                let displayCredit = currentBalance < 0 ? Math.abs(currentBalance) : 0;

                globalTotalDebit += displayDebit;

                globalTotalCredit += displayCredit;

                const typeLabels = { client: 'عميل', supplier: 'مورد', delegate: 'مندوب', mixed: 'عميل ومورد', other: 'أخرى' };

                const row = document.createElement('tr');
                row.style.cursor = 'pointer';
                if (selectedAccountID === acc.id) {
                    row.classList.add('acc-selected-row');
                }
                row.onclick = () => selectAccountRow(acc.id);
                row.ondblclick = () => {
                    if (typeof hasPermission === 'function' && !hasPermission('accounts_statement')) {
                        if (typeof showToast === 'function') showToast('⛔ عذراً، لا تمتلك صلاحية لعرض كشف الحساب', 'warning');
                        return;
                    }
                    openSelectedAccountStatement();
                };

                const frozenBadge = (acc.inactive === true || acc.inactive === 'true' || acc.isFrozen === true) 
                    ? `<span style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; font-size: 0.75rem; font-weight: 800; padding: 2px 8px; border-radius: 12px; margin-right: 6px; display: inline-flex; align-items: center; gap: 3px;">❄️ مجمد</span>` 
                    : '';

                const notifyBadge = (acc.remind === true || acc.remind === 'true')
                    ? `<span title="التنبيهات مفعلة لهذا الحساب" style="font-size: 0.85rem; margin-right: 4px;">🔔</span>`
                    : '';

                const thMapData = {

                    0: idx + 1,

                    1: `<span style="color:var(--text-secondary); font-family:monospace;">${acc.code || '-'}</span>`,

                    2: `<span style="font-weight:bold;">${acc.name}</span>${frozenBadge}${notifyBadge}`,

                    3: `<span class="stock-badge">${typeLabels[acc.type] || acc.type}</span>`,

                    4: acc.category || '-',

                    5: `<span class="color-danger" style="font-weight:bold;">${displayDebit > 0 ? displayDebit.toFixed(2) : '-'}</span>`,

                    6: `<span class="color-success" style="font-weight:bold;">${displayCredit > 0 ? displayCredit.toFixed(2) : '-'}</span>`,

                    7: `<span style="color:var(--text-primary);">${totalSales.toFixed(2)}</span>`,

                    8: lastReceiptDate,
                    9: lastTransDate,
                    10: `<div style="display:flex; justify-content:center; align-items:center; width:100%;"><input type="radio" name="accSelect" ${selectedAccountID === acc.id ? 'checked' : ''} onclick="event.stopPropagation(); selectAccountRow(${acc.id});" style="width: 20px; height: 20px; accent-color: #be185d; cursor: pointer;"></div>`
                };

                accountsColumnOrder.forEach(colIdx => {
                    const data = thMapData[colIdx];
                    const isVisible = accountsColumnVisibility[colIdx];
                    const td = document.createElement('td');
                    td.innerHTML = data;
                    if (colIdx === 10) {
                        td.style.width = '60px';
                        td.style.minWidth = '60px';
                        td.style.textAlign = 'center';
                        td.style.padding = '6px 4px';
                    }
                    if (!isVisible) td.style.display = 'none';
                    row.appendChild(td);
                });

                tbody.appendChild(row);

            });

            // تحديث إجمالي المديونيات في الأسفل

            const totalDebitEl = document.getElementById('totalGlobalDebit');

            const totalCreditEl = document.getElementById('totalGlobalCredit');

            if (totalDebitEl) totalDebitEl.innerText = globalTotalDebit.toFixed(2);

            if (totalCreditEl) totalCreditEl.innerText = globalTotalCredit.toFixed(2);

        }

        function selectAccountRow(id) {
            selectedAccountID = id;
            window.selectedAccountID = id;
            renderAccountsTable(); // إعادة رسم لتحديث التحديد البصري
        }

        window.openSelectedAccountStatement = function() {
            if (typeof checkPermission === 'function' && !checkPermission('accounts_statement')) {
                return;
            }
            if (!selectedAccountID) {
                if (typeof showToast === 'function') showToast("⚠️ يرجى تحديد واختيار حساب من الجدول أولاً!", "warning");
                else alert("⚠️ يرجى تحديد واختيار حساب من الجدول أولاً!");
                return;
            }
            const acc = accounts.find(a => a.id === selectedAccountID);
            if (!acc) {
                if (typeof showToast === 'function') showToast("⚠️ لم يتم العثور على الحساب المختار!", "error");
                return;
            }

            if (typeof switchSection === 'function') switchSection('statement');
            if (document.getElementById('stmtAccountSelector')) {
                document.getElementById('stmtAccountSelector').value = acc.name;
                if (typeof toggleStmtClearBtn === 'function') toggleStmtClearBtn();
            }
            if (typeof updateActiveTabTitle === 'function') updateActiveTabTitle(acc.name, 'كشف حساب');
            generateAccountStatement(acc.id);
        };

        async function editSelectedAccount() {

            if (!checkPermission('accounts_edit')) return;

            if (!selectedAccountID) return alert("⚠️ يرجى اختيار حساب من الجدول أولاً!");

            // جلب البيانات مباشرة من قاعدة البيانات لضمان الحصول على أحدث القيم المسجلة

            const acc = await db.accounts.get(selectedAccountID);

            if (!acc) return;

            // فتح المودال وتعبئة البيانات

            document.getElementById('newAccountModal').classList.remove('hidden');

            document.getElementById('editAccId').value = acc.id;

            document.getElementById('accName').value = acc.name;

            // تحميل صورة الهوية إن وجدت

            const imgPreview = document.getElementById('accImagePreview');

            if (imgPreview) {

                if (acc.image) {

                    imgPreview.src = acc.image;

                    imgPreview.dataset.base64 = acc.image;

                } else {

                    imgPreview.src = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22avatarGrad%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%236366f1%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%233b82f6%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22url(%23avatarGrad)%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2240%22%20r%3D%2216%22%20fill%3D%22%23ffffff%22%2F%3E%3Cpath%20d%3D%22M25%2075c0-12%2012-16%2025-16s25%204%2025%2016v5H25v-5z%22%20fill%3D%22%23ffffff%22%2F%3E%3C%2Fsvg%3E';

                    delete imgPreview.dataset.base64;

                }

            }

            const imgInput = document.getElementById('accImageInput');

            if (imgInput) imgInput.value = '';

            // اختيار نوع الحساب (Radio)

            const typeRadio = document.querySelector(`input[name="accType"][value="${acc.type}"]`);

            if (typeRadio) typeRadio.checked = true;

            document.getElementById('accDebit').value = acc.debit || 0;

            document.getElementById('accCredit').value = acc.credit || 0;

            document.getElementById('accBalDate').value = acc.balanceDate || '';

            document.getElementById('accMobile').value = acc.mobile || '';

            if (document.getElementById('accLandline')) document.getElementById('accLandline').value = acc.landline || '';

            if (document.getElementById('accEmail')) document.getElementById('accEmail').value = acc.email || '';

            if (document.getElementById('accAddress')) document.getElementById('accAddress').value = acc.address || '';

            if (document.getElementById('accCode')) document.getElementById('accCode').value = acc.code || '';

            if (document.getElementById('accTax')) document.getElementById('accTax').value = acc.tax || '';

            if (document.getElementById('accCategory')) document.getElementById('accCategory').value = acc.category || 'عام';

            if (document.getElementById('accDiscount')) document.getElementById('accDiscount').value = acc.discount || 0;

            const debtField = document.getElementById('accMaxAllowedDebtField');

            if (debtField) {

                const val = (acc.maxDebt !== undefined && acc.maxDebt !== null) ? acc.maxDebt : 0;

                // تعيين فوري

                debtField.value = val;

                // تعيين احتياطي بعد تأخير بسيط

                setTimeout(() => {

                    debtField.value = val;

                    debtField.defaultValue = val;

                }, 100);

                console.log(`✅ Multi-stage Load maxDebt for ${acc.name}:`, val);

            }

            if (document.getElementById('accPriceLevel')) document.getElementById('accPriceLevel').value = acc.priceLevel || 'retail';

            if (document.getElementById('accRemind')) document.getElementById('accRemind').checked = acc.remind || false;

            if (document.getElementById('accInactive')) document.getElementById('accInactive').checked = acc.inactive || false;

            if (document.getElementById('accNotes')) document.getElementById('accNotes').value = acc.notes || '';

            const createdEl = document.getElementById('accCreatedAt');
            if (createdEl) {
                const cDate = acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('ar-EG') : new Date().toLocaleDateString('ar-EG');
                createdEl.innerText = cDate;
            }

            document.getElementById('accName').focus();

        }

        async function deleteSelectedAccount() {
            if (!checkPermission('accounts_delete')) return;
            if (!selectedAccountID) return alert("⚠️ يرجى اختيار حساب من الجدول أولاً!");

            const acc = accounts.find(a => a.id === selectedAccountID);
            if (!acc) return;

            const actualBal = typeof getAccountBalance === 'function' ? getAccountBalance(acc.name) : ((parseFloat(acc.debit) || 0) - (parseFloat(acc.credit) || 0));
            const bal = Math.abs(actualBal);
            if (bal > 0.01) {
                if (typeof showToast === 'function') showToast(`⚠️ لا يمكن حذف الحساب "${acc.name}" لأنه يحتوي على رصيد قائم (${bal.toFixed(2)} ج.م)! يرجى تسوية الحساب أولاً.`, "warning");
                else alert(`لا يمكن حذف الحساب "${acc.name}" لأنه يحتوي على رصيد قائم!`);
                return;
            }

            if (confirm(`🚨 هل أنت متأكد من حذف الحساب "${acc.name}" ونقله لسلة المحذوفات؟`)) {
                const hasTrans = transactions.some(t => t.partner === acc.name);
                if (hasTrans) {
                    if (!confirm("⚠️ هذا الحساب له حركات (فواتير/سندات) مسجلة. حذفه قد يؤدي لتضارب في التقارير. هل تريد الاستمرار؟")) return;
                }

                if (typeof trashManager !== 'undefined' && trashManager.moveToTrash) {
                    await trashManager.moveToTrash(acc, 'account', `حساب: ${acc.name}`);
                } else if (typeof addToTrash === 'function') {
                    addToTrash('account', acc, `حساب: ${acc.name}`);
                }

                accounts = accounts.filter(a => a.id !== selectedAccountID);
                await db.accounts.delete(selectedAccountID);
                await saveData();

                selectedAccountID = null;
                renderAccountsTable();
                showToast("✅ تم نقل الحساب إلى سلة المحذوفات");
            }
        }

        window.printStatement = function() {
            const shopName = document.getElementById('shopName')?.value || 'Bayan POS';
            const shopPhone = document.getElementById('shopPhone')?.value || '';
            const logoSrc = document.getElementById('logoPreview')?.src || '';
            const logoHTML = logoSrc && !logoSrc.includes('undefined') ? `<img src="${logoSrc}" style="max-height: 70px; max-width: 120px;">` : `<div style="width:100px; height:60px; background:#f0f0f0; border:1px dashed #ccc; display:flex; align-items:center; justify-content:center; color:#999; font-size:12px;">Logo</div>`;

            const accName = document.getElementById('statementHeaderAccName').innerText || 'كشف حساب';
            const balanceText = document.getElementById('stmtFinalBalance').innerText || '0.00';
            const tableElement = document.getElementById('stmtMasterTable').cloneNode(true);
            
            // Remove hidden columns if any
            tableElement.querySelectorAll('tr').forEach(row => {
                row.querySelectorAll('th, td').forEach(col => {
                    if (col.style.display === 'none') col.remove();
                });
            });

            const fromDate = document.getElementById('stmtDateFrom').value || '---';
            const toDate = document.getElementById('stmtDateTo').value || '---';

            // إنشاء Iframe مخفي للطباعة
            let iframe = document.getElementById('print-iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'print-iframe';
                iframe.style.cssText = 'position:fixed;right:100%;bottom:100%;width:0;height:0;border:none;';
                document.body.appendChild(iframe);
            }
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`
                <html dir="rtl">
                <head>
                    <title>كشف حساب - ${accName}</title>
                    <style>
                        @page { size: A4 portrait; margin: 10mm; }
                        * { box-sizing: border-box; }
                        body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; background: #fff; color: #000; padding: 0; margin: 0; width: 100%; max-width: 100%; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 20px; }
                        .shop-info { text-align: right; flex: 1; }
                        .shop-info h2 { font-size: 1.4rem; font-weight: 900; margin: 0 0 5px 0; color: #0f172a; }
                        .shop-info p { font-size: 0.9rem; color: #333; margin: 3px 0; font-weight: bold; }
                        .title-container { text-align: center; flex: 1; }
                        .title-box { display: inline-block; background: #10b981; color: #fff; padding: 8px 25px; border-radius: 5px; font-size: 1.2rem; font-weight: bold; }
                        .logo-container { text-align: left; flex: 1; }
                        .info-grid { display: flex; justify-content: space-between; margin-bottom: 15px; width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc; }
                        .info-box { flex: 1; padding: 12px; }
                        .info-box.left { border-left: 1px solid #e2e8f0; }
                        .info-box.right { text-align: right; }
                        .info-label { font-size: 0.85rem; color: #64748b; margin-bottom: 5px; font-weight: bold; }
                        .info-val { font-size: 1.3rem; font-weight: 900; color: #0f172a; }
                        .info-val.green { color: #10b981; }
                        .date-period { margin-bottom: 15px; font-size: 0.9rem; background: #f1f5f9; padding: 8px 15px; border-radius: 5px; display: inline-block; font-weight: bold; color: #334155; border: 1px solid #cbd5e1; }
                        table { width: 100%; max-width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 0.8rem; }
                        th { background: #e2e8f0; color: #1e293b; padding: 8px 4px; border: 1px solid #cbd5e1; font-weight: 900; text-align: center; }
                        td { padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: bold; }
                        tbody tr:nth-child(even) { background: #f8fafc; }
                        .signatures { margin-top: 50px; display: flex; justify-content: space-between; padding: 0 50px; }
                        .sig-box { text-align: center; }
                        .sig-title { font-weight: bold; margin-bottom: 50px; color: #475569; }
                        .sig-line { color: #cbd5e1; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="shop-info">
                            <h2>${shopName}</h2>
                            <p>📞 هاتف: ${shopPhone}</p>
                            <p>📅 التاريخ: ${new Date().toLocaleString('ar-EG')}</p>
                        </div>
                        <div class="title-container">
                            <div class="title-box">كشف حساب تفصيلي</div>
                        </div>
                        <div class="logo-container">
                            ${logoHTML}
                        </div>
                    </div>
                    <div class="info-grid">
                        <div class="info-box left">
                            <div class="info-label">👤 اسم الحساب:</div>
                            <div class="info-val">${accName}</div>
                        </div>
                        <div class="info-box right">
                            <div class="info-label">💰 الرصيد النهائي:</div>
                            <div class="info-val green">${balanceText.trim()}</div>
                        </div>
                    </div>
                    <div class="date-period">
                        📅 الفترة: من ${fromDate} إلى ${toDate}
                    </div>
                    <table>
                        <thead>${tableElement.querySelector('thead').innerHTML}</thead>
                        <tbody>${tableElement.querySelector('tbody').innerHTML}</tbody>
                        ${tableElement.querySelector('tfoot') && tableElement.querySelector('tfoot').innerHTML.trim() ? `<tfoot>${tableElement.querySelector('tfoot').innerHTML}</tfoot>` : ''}
                    </table>
                    <div class="signatures">
                        <div class="sig-box">
                            <div class="sig-title">توقيع العميل</div>
                            <div class="sig-line">............................</div>
                        </div>
                        <div class="sig-box">
                            <div class="sig-title">ختم المؤسسة / التوقيع</div>
                            <div class="sig-line">............................</div>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #94a3b8;">تم إصدار هذا التقرير من نظام بيان المحاسبي</div>
                </body>
                </html>
            `);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 600);
        };

        // تم دمج دالة تعديل الحساب مع الدالة الأساسية في الأعلى لمنع التكرار وحل مشكلة اختفاء الحقول (الكود، الحد الأقصى للمديونية، ومستوى السعر)

        window.initStatementSection = function() {
            // No need to populate datalist anymore since we use custom dropdown
        };

        window.toggleStmtClearBtn = function() {
            const input = document.getElementById('stmtAccountSelector');
            const clearBtn = document.getElementById('stmtClearSearchBtn');
            if (input && clearBtn) {
                clearBtn.style.display = (input.value && input.value.trim().length > 0) ? 'block' : 'none';
            }
        };

        window.clearStmtAccountSearch = function(event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            const input = document.getElementById('stmtAccountSelector');
            const dropdown = document.getElementById('stmtAccountDropdown');
            const clearBtn = document.getElementById('stmtClearSearchBtn');

            selectedAccountID = null;
            window.selectedAccountID = null;
            window.currentStmtInvoiceId = null;

            if (input) {
                input.value = '';
            }
            if (clearBtn) {
                clearBtn.style.display = 'none';
            }
            if (dropdown) {
                dropdown.style.display = 'none';
                dropdown.innerHTML = '';
            }
            generateAccountStatement(null);
        };

        window.selectStmtAccount = function(accountId) {
            const acc = accounts.find(a => a.id === accountId);
            if (!acc) return;

            selectedAccountID = acc.id;
            window.selectedAccountID = acc.id;
            const input = document.getElementById('stmtAccountSelector');
            if (input) {
                input.value = acc.name;
            }
            const dropdown = document.getElementById('stmtAccountDropdown');
            if (dropdown) {
                dropdown.style.display = 'none';
            }
            window.toggleStmtClearBtn();
            if (typeof updateActiveTabTitle === 'function') updateActiveTabTitle(acc.name, 'كشف حساب');
            generateAccountStatement(acc.id);
        };

        window.filterStmtAccounts = function(e) {
            const input = document.getElementById('stmtAccountSelector');
            const dropdown = document.getElementById('stmtAccountDropdown');
            if (!input || !dropdown) return;
            
            window.toggleStmtClearBtn();
            
            const rawVal = input.value;
            const filter = rawVal.trim().toLowerCase();
            dropdown.innerHTML = '';
            
            const cleanAr = (str) => (str || '').trim().toLowerCase()
                .replace(/[أإآ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/[ىي]/g, 'ي')
                .replace(/\s+/g, ' ');

            const filterClean = cleanAr(filter);

            const matched = accounts.filter(a => {
                if (!a) return false;
                const nameClean = cleanAr(a.name);
                const codeStr = String(a.code || '').toLowerCase();
                const mobileStr = String(a.mobile || '').toLowerCase();
                return nameClean.includes(filterClean) || (filter && (codeStr.includes(filter) || mobileStr.includes(filter)));
            });
            
            // عند الضغط على زر Enter واختيار أول نتيجة متطابقة مباشرة
            if (e && e.key === 'Enter') {
                if (matched.length > 0) {
                    window.selectStmtAccount(matched[0].id);
                    return;
                }
            }

            if (filter === '' && document.activeElement !== input) {
                dropdown.style.display = 'none';
                return;
            }
            
            if (matched.length === 0) {
                dropdown.innerHTML = '<div style="padding: 12px; color: #94a3b8; text-align: center; font-weight: bold;">⚠️ لا توجد حسابات مطابقة</div>';
            } else {
                matched.forEach(acc => {
                    const div = document.createElement('div');
                    div.style.cssText = 'padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: bold; transition: 0.15s; display: flex; justify-content: space-between; align-items: center;';
                    const codeBadge = acc.code ? `<span style="font-size:0.8rem; background:#e2e8f0; color:#475569; padding:2px 7px; border-radius:4px; font-family:monospace;">#${acc.code}</span>` : '';
                    const phoneText = acc.mobile ? `<span style="font-size:0.8rem; color:#64748b;">📞 ${acc.mobile}</span>` : '';
                    div.innerHTML = `<span>${acc.name}</span><div style="display:flex; gap:6px; align-items:center;">${codeBadge}${phoneText}</div>`;
                    div.onmouseover = () => div.style.background = '#f1f5f9';
                    div.onmouseout = () => div.style.background = 'transparent';
                    div.onclick = (ev) => {
                        ev.stopPropagation();
                        window.selectStmtAccount(acc.id);
                    };
                    dropdown.appendChild(div);
                });
            }
            dropdown.style.display = 'block';
        };

        // Hide dropdown when clicking outside
        document.addEventListener('click', function(e) {
            const input = document.getElementById('stmtAccountSelector');
            const dropdown = document.getElementById('stmtAccountDropdown');
            const clearBtn = document.getElementById('stmtClearSearchBtn');
            if (input && dropdown && !input.contains(e.target) && !dropdown.contains(e.target) && (!clearBtn || !clearBtn.contains(e.target))) {
                dropdown.style.display = 'none';
            }
        });

        window.loadSelectedAccountStatement = function() {
            const input = document.getElementById('stmtAccountSelector');
            if (!input) return;
            const val = input.value.trim();
            if (!val) {
                selectedAccountID = null;
                window.selectedAccountID = null;
                generateAccountStatement(null);
                return;
            }

            const cleanAr = (str) => (str || '').trim().toLowerCase()
                .replace(/[أإآ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/[ىي]/g, 'ي')
                .replace(/\s+/g, ' ');
            const valClean = cleanAr(val);

            // مطابقة ذكية: بالاسم الدقيق، أو الكود، أو الاسم بعد تنظيف الهمزات
            let acc = accounts.find(a => a.name === val || String(a.code || '').trim() === val);
            if (!acc) {
                acc = accounts.find(a => cleanAr(a.name) === valClean);
            }
            if (!acc) {
                acc = accounts.find(a => cleanAr(a.name).includes(valClean) || String(a.code || '').includes(val));
            }

            if (acc) {
                window.selectStmtAccount(acc.id);
            } else {
                selectedAccountID = null;
                window.selectedAccountID = null;
                generateAccountStatement(null);
            }
        };

        function generateAccountStatement(accountId) {
            if (!checkPermission('accounts_statement')) return;

            let targetId = accountId;
            if (!targetId) {
                const selectorInput = document.getElementById('stmtAccountSelector');
                const typedVal = selectorInput ? selectorInput.value.trim() : '';
                
                if (typedVal) {
                    const cleanAr = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
                    const typedClean = cleanAr(typedVal);
                    const matchedAcc = accounts.find(a => a.name === typedVal || String(a.code || '').trim() === typedVal || cleanAr(a.name) === typedClean);
                    if (matchedAcc) targetId = matchedAcc.id;
                }
                
                if (!targetId && typeof selectedAccountID !== 'undefined' && selectedAccountID) {
                    targetId = selectedAccountID;
                }
            }

            if (!targetId) {
                document.getElementById('statementTableBody').innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 30px; font-weight: bold; color: #64748b;">الرجاء اختيار الحساب أولاً لعرض التقرير</td></tr>';
                document.getElementById('statementDetailsBody').innerHTML = '<tr><td colspan="10" style="padding: 40px; color: #94a3b8; font-size: 1.1rem; text-align: center;">اضغط على إحدى الحركات بالأعلى لعرض تفاصيلها هنا</td></tr>';
                if (document.getElementById('statementTableFoot')) document.getElementById('statementTableFoot').innerHTML = '';
                document.getElementById('stmtFinalBalance').innerText = '0.00';
                document.getElementById('statementHeaderAccName').style.display = 'none';
                
                // Disable action buttons
                if (document.getElementById('stmtActionPrintDoc')) document.getElementById('stmtActionPrintDoc').disabled = true;
                if (document.getElementById('stmtActionEdit')) document.getElementById('stmtActionEdit').disabled = true;
                if (document.getElementById('stmtActionDelete')) document.getElementById('stmtActionDelete').disabled = true;
                return;
            }

            const acc = accounts.find(a => a.id === targetId);
            if (!acc) return;

            selectedAccountID = acc.id;
            window.selectedAccountID = acc.id;

            if (document.getElementById('stmtAccountSelector')) {
                document.getElementById('stmtAccountSelector').value = acc.name;
                window.toggleStmtClearBtn();
            }
            if (document.getElementById('statementHeaderAccName')) {
                document.getElementById('statementHeaderAccName').innerText = acc.name;
                document.getElementById('statementHeaderAccName').style.display = 'block';
            }

            // تعيين التاريخ تلقائياً إذا كان فارغاً
            const todayISO = new Date().toLocaleDateString('en-CA');
            if (!document.getElementById('stmtDateFrom').value) {
                const firstDay = new Date();
                firstDay.setDate(1);
                document.getElementById('stmtDateFrom').value = firstDay.toLocaleDateString('en-CA');
            }
            if (!document.getElementById('stmtDateTo').value) {
                document.getElementById('stmtDateTo').value = todayISO;
            }

            const fromDate = document.getElementById('stmtDateFrom').value;
            const toDate = document.getElementById('stmtDateTo').value;

            // تحديث خانة المجموع السابقة لتفادي ترحيل الأعمدة

            if (typeof statementColumnVisibility !== 'undefined' && Array.isArray(statementColumnVisibility)) {
                const prevBalanceRow = document.querySelector('#stmtMasterTable tr[style*="background-color: #f1f5f9"]');
                if (prevBalanceRow) {
                    prevBalanceRow.querySelectorAll('td').forEach((td, i) => {
                        td.style.display = statementColumnVisibility[i] ? '' : 'none';
                    });
                }
            }

            // 1. تجميع الحركات الخاصة بالحساب

            // نبدأ بالرصيد الافتتاحي (إذا وجد)

            let runningBalance = 0;

            let rowsHTML = '';

            const openDebit = parseFloat(acc.debit) || 0;

            const openCredit = parseFloat(acc.credit) || 0;

            let startBalance = openDebit - openCredit; // موجب = عليه، سالب = له

            runningBalance = startBalance;

            const cleanAr = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            const targetPartnerClean = cleanAr(acc.name);

            // فلترة العمليات من سجل الحركات (transactions) مع مطابقة مرنة للأسماء والهمزات
            const accTrans = transactions.filter(t => t.partner === acc.name || cleanAr(t.partner) === targetPartnerClean);

            // ترتيب العمليات حسب التاريخ لضمان تسلسل الرصيد
            accTrans.sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));

            // تجميع الحركات (Grouping by InvoiceID)

            let groupedTrans = [];

            let ivMap = {};

            accTrans.forEach(t => {

                const isInvoice = (t.type.includes('بيع') || t.type.includes('شراء')) && t.invoiceId;

                if (isInvoice) {

                    const isReturn = t.type.includes('مرتجع');
                    const isSale = t.type.includes('بيع');
                    const isPurchase = t.type.includes('شراء');
                    const prefix = isReturn ? "RET_" : "INV_";
                    const cat = isSale ? "SALE_" : (isPurchase ? "PURCH_" : (t.type.split(' ')[0] + "_"));
                    const key = prefix + cat + t.invoiceId; 

                    if (!ivMap[key]) {
                        ivMap[key] = {
                            dateISO: t.dateISO,
                            timeISO: t.timeISO || (t.date && t.date.includes(' ') ? t.date.split(' ')[1] : '-'),
                            editDate: t.editDate || t.updatedAt || '-',
                            type: t.type,
                            invoiceId: t.invoiceId,
                            product: (isReturn ? 'مرتجع ' : 'فاتورة ') + (t.type.includes('بيع') ? 'مبيعات' : 'مشتريات') + ' رقم ' + t.invoiceId,
                            total: 0,
                            paid: 0,
                            isInvoice: true,
                            isReturn: isReturn,
                            method: t.method || 'نقدي',
                            warehouse: t.warehouse || t.sourceWarehouse || t.from || t.to || (window.currentUser ? window.currentUser.warehouseName : 'المخزن الرئيسي')
                        };
                        groupedTrans.push(ivMap[key]);
                    }

                    ivMap[key].total += (parseFloat(t.total) || 0);

                    if (t.isInvoiceHead || t.paidAmount !== undefined || t.paid !== undefined) {
                        const pVal = parseFloat(t.paidAmount != null ? t.paidAmount : (t.paid != null ? t.paid : 0));
                        if (!isNaN(pVal)) {
                            ivMap[key].paid = pVal;
                        }
                        if (t.editDate || t.updatedAt) ivMap[key].editDate = t.editDate || t.updatedAt;
                    }

                } else {

                    // حركات يدوية (قبض/صرف) أو مرتجعات بدون ID
                    groupedTrans.push({
                        dateISO: t.dateISO,
                        timeISO: t.timeISO || (t.date && t.date.includes(' ') ? t.date.split(' ')[1] : '-'),
                        editDate: t.editDate || t.updatedAt || '-',
                        type: t.type,
                        invoiceId: t.invoiceId,
                        product: t.product || t.type,
                        total: (parseFloat(t.total) || parseFloat(t.price) || 0),
                        paid: (t.type.includes('قبض') || t.type.includes('مرتجع بيع')) ? (parseFloat(t.total) || parseFloat(t.price)) : 0,
                        isInvoice: false,
                        method: t.method || 'نقدي',
                        warehouse: t.warehouse || t.sourceWarehouse || t.from || t.to || (window.currentUser ? window.currentUser.warehouseName : 'المخزن الرئيسي')
                    });

                }

            });

            // إعادة الفلترة للعرض بعد التجميع

            let priorDebit = 0;
            let priorCredit = 0;

            if (fromDate) {

                const beforeGrouped = groupedTrans.filter(t => t.dateISO < fromDate);

                beforeGrouped.forEach(t => {

                    let debit = 0; let credit = 0;

                    if (t.isInvoice) {

                        if (t.type.includes('بيع')) {

                            if (t.type.includes('مرتجع')) { debit = t.paid; credit = t.total; }

                            else { debit = t.total; credit = t.paid; }

                        } else if (t.type.includes('شراء')) {

                            if (t.type.includes('مرتجع')) { debit = t.total; credit = t.paid; }

                            else { debit = t.paid; credit = t.total; }

                        }

                    } else {

                        if (t.type.includes('قبض') || t.type.includes('مرتجع بيع')) credit = t.total;

                        else if (t.type.includes('صرف') || t.type.includes('بيع') || t.type.includes('مرتجع شراء')) debit = t.total;

                    }

                    runningBalance += (debit - credit);

                });

                priorDebit = (runningBalance > 0) ? runningBalance : 0;
                priorCredit = (runningBalance < 0) ? Math.abs(runningBalance) : 0;

                rowsHTML += `
                    <tr style="background-color: #f1f5f9; font-weight:bold; border-bottom: 2px solid #cbd5e1;">
                        <td>${fromDate}</td>
                        <td>-</td>
                        <td>-</td>
                        <td style="font-weight:900; color:#334155;">رصيد سابق (حتى ${fromDate})</td>
                        <td>-</td>
                        <td>-</td>
                        <td style="font-weight:900; color:${runningBalance >= 0 ? '#c0392b' : 'var(--main-green)'};">${runningBalance.toFixed(2)}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>`;

                displayTrans = groupedTrans.filter(t => t.dateISO >= fromDate && (!toDate || t.dateISO <= toDate));

            } else {

                rowsHTML += `
                    <tr style="background-color: #fff3cd; font-weight:bold; border-bottom: 2px solid #fde047;">
                        <td>${acc.balanceDate || '-'}</td>
                        <td>-</td>
                        <td>-</td>
                        <td style="font-weight:900; color:#854d0e;">رصيد افتتاحي (بداية المدة)</td>
                        <td style="color:#c0392b; font-weight:bold;">${openDebit > 0 ? openDebit.toFixed(2) : '-'}</td>
                        <td style="color:var(--main-green); font-weight:bold;">${openCredit > 0 ? openCredit.toFixed(2) : '-'}</td>
                        <td style="font-weight:900; color:${runningBalance >= 0 ? '#c0392b' : 'var(--main-green)'};">${runningBalance.toFixed(2)}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                    </tr>`;

                priorDebit = openDebit;
                priorCredit = openCredit;
                displayTrans = groupedTrans;

                if (toDate) displayTrans = displayTrans.filter(t => t.dateISO <= toDate);

            }

            const typeFilter = document.getElementById('stmtTypeFilter').value;

            let periodDebit = 0;

            let periodCredit = 0;

            let filteredRunningBal = runningBalance;

            displayTrans.forEach(t => {

                let debit = 0; let credit = 0;

                if (t.isInvoice) {

                    if (t.type.includes('بيع')) {

                        if (t.type.includes('مرتجع')) {

                            debit = t.paid;

                            credit = t.total;

                        } else {

                            debit = t.total;

                            credit = t.paid;

                        }

                    } else if (t.type.includes('شراء')) {

                        if (t.type.includes('مرتجع')) {

                            debit = t.total;

                            credit = t.paid;

                        } else {

                            debit = t.paid;

                            credit = t.total;

                        }

                    }

                } else {

                    if (t.type.includes('قبض') || t.type.includes('مرتجع بيع')) credit = t.total;

                    else if (t.type.includes('صرف') || t.type.includes('بيع') || t.type.includes('مرتجع شراء')) debit = t.total;

                }

                runningBalance += (debit - credit);

                // تطبيق فلتر نوع الحركة (العرض فقط)

                let matchesFilter = true;

                if (typeFilter !== 'all') {

                    if (typeFilter === 'sales') matchesFilter = t.type.includes('بيع') && !t.type.includes('مرتجع');

                    else if (typeFilter === 'purchase') matchesFilter = t.type.includes('شراء') && !t.type.includes('مرتجع');

                    else if (typeFilter === 'receipt') matchesFilter = t.type.includes('قبض');

                    else if (typeFilter === 'disbursement') matchesFilter = t.type.includes('صرف');

                    else if (typeFilter === 'returns') matchesFilter = t.type.includes('مرتجع');

                }

                if (matchesFilter) {

                    periodDebit += debit;

                    periodCredit += credit;

                    filteredRunningBal += (debit - credit);

                    const rowDisplayBalance = (typeFilter === 'all') ? runningBalance : filteredRunningBal;

                    rowsHTML += `
                        <tr data-trans-id="${t.invoiceId || ''}" data-type="${t.type}" data-total="${t.total}" onclick="loadStatementDetails('${t.invoiceId || ''}', '${t.type}', this)">
                            <td>${t.dateISO || '-'}</td>
                            <td>${t.timeISO || '-'}</td>
                            <td style="color:#64748b; font-size:0.85rem;">${t.editDate || '-'}</td>
                            <td>${t.type}</td>
                            <td style="color:#c0392b; font-weight:bold;">${debit > 0 ? debit.toFixed(2) : '-'}</td>
                            <td style="color:var(--main-green); font-weight:bold;">${credit > 0 ? credit.toFixed(2) : '-'}</td>
                            <td style="font-weight:bold; background:rgba(0,0,0,0.02); color:${rowDisplayBalance >= 0 ? '#c0392b' : 'var(--main-green)'};">${rowDisplayBalance.toFixed(2)}</td>
                            <td>${t.invoiceId || '-'}</td>
                            <td>${t.method || 'نقدي'}</td>
                            <td>${t.warehouse || (window.currentUser ? window.currentUser.warehouseName : 'المخزن الرئيسي')}</td>
                        </tr>
                    `;
                }
            });

            // إعداد شريط الإجماليات الختامي (الخيار 2: سطر لحركات الفترة وسطر للرصيد الختامي الشامل)
            const netPeriod = periodDebit - periodCredit;
            const totalGrandDebit = priorDebit + periodDebit;
            const totalGrandCredit = priorCredit + periodCredit;
            const finalBalance = runningBalance;

            const footEl = document.getElementById('statementTableFoot');
            if (footEl) {
                footEl.innerHTML = `
                    <!-- 1. سطر حركات الفترة المعروضة فقط -->
                    <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #cbd5e1; border-bottom: 1px dashed #cbd5e1; font-size: 0.88rem;">
                        <td colspan="4" style="text-align: right; color: #475569; padding: 7px 12px;">
                            📊 حركات الفترة المعروضة:
                        </td>
                        <td style="color:#c0392b; font-weight:800; text-align: center;">${periodDebit > 0 ? periodDebit.toFixed(2) : '0.00'}</td>
                        <td style="color:var(--main-green); font-weight:800; text-align: center;">${periodCredit > 0 ? periodCredit.toFixed(2) : '0.00'}</td>
                        <td style="font-weight:800; text-align: center; color: ${netPeriod >= 0 ? '#c0392b' : 'var(--main-green)'};">
                            ${netPeriod.toFixed(2)}
                        </td>
                        <td colspan="3" style="color: #64748b; font-size: 0.8rem; text-align: center;">
                            صافي حركات الفترة: <b>${Math.abs(netPeriod).toFixed(2)} ${netPeriod >= 0 ? 'مدين (عليه)' : 'دائن (له)'}</b>
                        </td>
                    </tr>
                    <!-- 2. سطر الرصيد النهائي الشامل (شاملاً الرصيد السابق) -->
                    <tr style="background: #e2e8f0; font-weight: 900; border-bottom: 2.5px solid #0f172a; font-size: 0.95rem;">
                        <td colspan="4" style="text-align: right; color: #0f172a; padding: 9px 12px; font-weight: 900;">
                            🏁 الرصيد الختامي الإجمالي (شاملاً الرصيد السابق):
                        </td>
                        <td style="color:#b91c1c; font-weight:900; text-align: center; font-size: 1rem;">${totalGrandDebit.toFixed(2)}</td>
                        <td style="color:#047857; font-weight:900; text-align: center; font-size: 1rem;">${totalGrandCredit.toFixed(2)}</td>
                        <td style="font-weight:900; text-align: center; font-size: 1.05rem; background: #ffffff; color: ${finalBalance >= 0 ? '#b91c1c' : '#047857'}; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">
                            ${Math.abs(finalBalance).toFixed(2)}
                        </td>
                        <td colspan="3" style="color: #0f172a; font-size: 0.9rem; text-align: center; font-weight: 900;">
                            الرصيد النهائي: <span style="color: ${finalBalance >= 0 ? '#b91c1c' : '#047857'};">${Math.abs(finalBalance).toFixed(2)} ${finalBalance >= 0 ? 'مدين (عليه)' : 'دائن (له)'}</span>
                        </td>
                    </tr>
                `;
            }

            // عرض البيانات في النافذة
            document.getElementById('statementHeaderAccName').innerText = acc.name;
            const balBox = document.getElementById('stmtBalanceBox');
            const balText = document.getElementById('stmtFinalBalance');
            
            if (finalBalance >= 0) {
                balBox.className = 'stmt-balance-box debt';
                balText.innerText = finalBalance.toFixed(2) + ' عليه';
            } else {
                balBox.className = 'stmt-balance-box';
                balText.innerText = Math.abs(finalBalance).toFixed(2) + ' له';
            }

            document.getElementById('statementTableBody').innerHTML = rowsHTML;
            document.getElementById('statementDetailsBody').innerHTML = '<tr><td colspan="10" style="padding: 40px; color: #94a3b8; font-size: 1.1rem; text-align: center;">اضغط على إحدى الحركات بالأعلى لعرض تفاصيلها هنا</td></tr>';
            document.getElementById('stmtActionPrintDoc').disabled = true;
            document.getElementById('stmtActionEdit').disabled = true;
            document.getElementById('stmtActionDelete').disabled = true;
            window.currentStmtInvoiceId = null;
            if (document.getElementById('statement-section')?.classList.contains('hidden')) {
                switchSection('statement');
            }
        }

        // ================= تفاصيل الحركة (Master-Detail) =================
        window.loadStatementDetails = function(invoiceId, type, rowElement) {
            // تظليل الصف المختار
            document.querySelectorAll('#stmtMasterTable tbody tr').forEach(tr => tr.classList.remove('active-row'));
            if (rowElement) rowElement.classList.add('active-row');
            
            window.currentStmtInvoiceId = invoiceId;
            window.currentStmtType = type;
            
            // تفعيل الأزرار الجانبية
            if (invoiceId) {
                document.getElementById('stmtActionPrintDoc').disabled = false;
                document.getElementById('stmtActionEdit').disabled = false;
                document.getElementById('stmtActionDelete').disabled = false;
            } else {
                document.getElementById('stmtActionPrintDoc').disabled = true;
                document.getElementById('stmtActionEdit').disabled = true;
                document.getElementById('stmtActionDelete').disabled = true;
            }

            // الحركات المالية (قبض وصرف) لا تحتوي على أصناف
            if (type && (type.includes('قبض') || type.includes('صرف'))) {
                document.getElementById('statementDetailsBody').innerHTML = '<tr><td colspan="10" style="padding: 40px; color: #94a3b8; font-size: 1.1rem; text-align: center;">لا توجد تفاصيل أصناف (حركة مالية)</td></tr>';
                return;
            }
            
            if (!invoiceId) {
                document.getElementById('statementDetailsBody').innerHTML = '<tr><td colspan="10" style="padding: 20px; text-align: center;">لا توجد تفاصيل أصناف لهذه الحركة</td></tr>';
                return;
            }
            
            const matchesStmtType = (tType, targetType) => {
                if (!targetType || !tType) return true;
                if (typeof window.isMatchingInvoiceType === 'function') {
                    return window.isMatchingInvoiceType(tType, targetType);
                }
                const clean = (s) => String(s || '').replace(/[^\u0621-\u064A]/g, '').trim();
                return clean(tType) === clean(targetType) || clean(tType).includes(clean(targetType)) || clean(targetType).includes(clean(tType));
            };

            let invoiceItems = transactions.filter(t => String(t.invoiceId) === String(invoiceId) && matchesStmtType(t.type, type) && t.product);
            
            if (invoiceItems.length === 0) {
                invoiceItems = transactions.filter(t => String(t.invoiceId) === String(invoiceId) && matchesStmtType(t.type, type));
            }
            
            if (invoiceItems.length === 0) {
                document.getElementById('statementDetailsBody').innerHTML = '<tr><td colspan="10" style="padding: 20px; text-align: center;">لا توجد تفاصيل أصناف (حركة مالية أو قيد)</td></tr>';
                return;
            }

            // محاولة جلب الفاتورة الأساسية للحصول على الخصم والإضافة الإجمالية إن وجدت
            let parentDoc = null;
            if (typeof invoicesDB !== 'undefined' && Array.isArray(invoicesDB)) {
                parentDoc = invoicesDB.find(inv => String(inv.id) === String(invoiceId) || String(inv.invoiceId) === String(invoiceId));
            }
            
            const totalInvoiceSubtotal = invoiceItems.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.price || 0)), 0);
            const globalDiscount = parentDoc ? parseFloat(parentDoc.discount || parentDoc.discountValue || 0) : 0;
            const globalAddition = parentDoc ? parseFloat(parentDoc.tax || parentDoc.taxAmount || parentDoc.globalTax || parentDoc.addition || parentDoc.additionValue || 0) : 0;

            let html = '';
            invoiceItems.forEach(i => {
                const qty = parseFloat(i.qty || 0);
                const price = parseFloat(i.price || 0);
                const subtotal = qty * price;

                // 3. حساب الإجمالي النهائي للصنف
                let total = parseFloat(i.total != null ? i.total : subtotal);

                // 1. حساب الخصم: إما المباشر من الصنف، أو من الفرق بين (السعر * الكمية) والإجمالي، أو من الخصم الموزع
                let discount = parseFloat(i.discount || i.discountValue || i.itemDiscount || 0);
                if (discount === 0 && subtotal > total && total > 0) {
                    discount = subtotal - total;
                } else if (discount === 0 && globalDiscount > 0 && totalInvoiceSubtotal > 0) {
                    discount = (subtotal / totalInvoiceSubtotal) * globalDiscount;
                }

                // 2. حساب الإضافة: إما المباشرة من الصنف، أو من الفرق المباشر، أو من الإضافة الموزعة
                let addition = parseFloat(i.addition || i.itemAddition || i.tax || i.taxValue || i.additionValue || 0);
                if (addition === 0 && total > (subtotal - discount) && subtotal > 0) {
                    addition = total - (subtotal - discount);
                } else if (addition === 0 && globalAddition > 0 && totalInvoiceSubtotal > 0) {
                    addition = (subtotal / totalInvoiceSubtotal) * globalAddition;
                }

                // محاولة جلب الصنف من قاعدة البيانات للحصول على التصنيف والملاحظات
                const productDbInfo = (typeof productsDB !== 'undefined') ? productsDB.find(p => p.name === i.product) : null;
                const category = (productDbInfo && productDbInfo.category) ? productDbInfo.category : (i.category || '-');
                const itemNotes = i.notes || (parentDoc && parentDoc.notes) || i.note || '-';
                
                html += `
                    <tr>
                        <td>${productDbInfo ? productDbInfo.id : '-'}</td>
                        <td style="font-weight:bold; text-align:right;">${i.product || '-'}</td>
                        <td>${i.unit || '-'}</td>
                        <td>${qty}</td>
                        <td>${price.toFixed(2)}</td>
                        <td style="color:#e11d48; font-weight:bold;">${discount > 0 ? discount.toFixed(2) : '0.00'}</td>
                        <td style="color:#2563eb; font-weight:bold;">${addition > 0 ? '+' + addition.toFixed(2) : '0.00'}</td>
                        <td style="font-weight:bold; color:var(--main-green);">${total.toFixed(2)}</td>
                        <td>${category}</td>
                        <td style="color: #64748b; font-size: 0.85rem;">${itemNotes}</td>
                    </tr>
                `;
            });
            document.getElementById('statementDetailsBody').innerHTML = html;
        };

        window.handleStmtAction = function(action) {
            if (!window.currentStmtInvoiceId || !window.currentStmtType) {
                const firstRow = document.querySelector('#statementTableBody tr[data-trans-id]');
                if (firstRow && firstRow.getAttribute('data-trans-id')) {
                    window.currentStmtInvoiceId = firstRow.getAttribute('data-trans-id');
                    window.currentStmtType = firstRow.getAttribute('data-type');
                }
            }
            if (!window.currentStmtInvoiceId || !window.currentStmtType) {
                if (typeof showToast === 'function') showToast("⚠️ يرجى تحديد حركة أو فاتورة من الجدول أولاً", "warning");
                return;
            }
            let id = window.currentStmtInvoiceId;
            let type = window.currentStmtType;
            
            if (action === 'print') {
                viewInvoiceItems(id, type, true); // Opens modal and auto-prints (we can adapt this if needed)
            } else if (action === 'edit') {
                let cleanType = '';
                if (type.includes('بيع') && !type.includes('مرتجع')) cleanType = 'بيع';
                else if (type.includes('شراء') && !type.includes('مرتجع')) cleanType = 'شراء';
                else if (type.includes('مرتجع بيع')) cleanType = 'مرتجع بيع';
                else if (type.includes('مرتجع شراء')) cleanType = 'مرتجع شراء';
                else if (type.includes('تسوية')) cleanType = 'تسوية';
                else if (type.includes('قبض')) cleanType = 'قبض';
                else if (type.includes('صرف')) cleanType = 'صرف';
                else if (type.includes('تحويل')) cleanType = 'تحويل';

                if (window.editTransaction) {
                    if (document.getElementById('statementModal')) {
                        document.getElementById('statementModal').classList.add('hidden');
                    }
                    window.editTransaction(id, cleanType);
                } else {
                    if(typeof showToast !== 'undefined') showToast('دالة التعديل غير متوفرة حالياً.', 'error');
                    else alert('دالة التعديل غير متوفرة حالياً.');
                }
            } else if (action === 'delete') {
                if (typeof deleteInvoiceGlobal === 'function') {
                    deleteInvoiceGlobal(id, type);
                }
                setTimeout(() => { if (typeof generateAccountStatement === 'function') generateAccountStatement(); }, 1200);
            }
        };

        window.exportAccountStatementToExcel = function() {
            const table = document.getElementById('stmtMasterTable') || document.querySelector('#statement-section .stmt-table');
            if (!table) return alert('❌ لا توجد بيانات لتصديرها');

            const accName = document.getElementById('statementHeaderAccName')?.innerText || document.getElementById('stmtAccountSelector')?.value || 'كشف_حساب';
            const fileName = `كشف_حساب_${accName.trim().replace(/\s+/g, '_')}_${new Date().toLocaleDateString('ar-EG')}.csv`;

            let csv = "\uFEFF"; // BOM for Excel UTF-8
            const rows = table.querySelectorAll('tr');

            rows.forEach(row => {
                const cols = row.querySelectorAll('th, td');
                const rowData = [];
                cols.forEach(col => {
                    if (col.style.display !== 'none') {
                        rowData.push('"' + col.innerText.replace(/"/g, '""').trim() + '"');
                    }
                });
                if (rowData.length > 0) csv += rowData.join(',') + "\r\n";
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();

            if (typeof showToast === 'function') showToast("✅ تم تصدير كشف الحساب إلى Excel بنجاح", "success");
        };

        window.shareAccountStatement = function(platform) {
            const accName = document.getElementById('statementHeaderAccName')?.innerText || document.getElementById('stmtAccountSelector')?.value || 'العميل';
            const fromDate = document.getElementById('stmtDateFrom')?.value || '---';
            const toDate = document.getElementById('stmtDateTo')?.value || '---';
            const balanceText = document.getElementById('stmtFinalBalance')?.innerText || '0.00';
            const shopName = document.getElementById('shopName')?.value || (typeof getStore === 'function' ? getStore('shopName') : '') || 'بيان POS';

            const message = `📄 *كشف حساب تفصيلي*\n` +
                          `👤 *الطرف:* ${accName}\n` +
                          `📅 *الفترة:* من ${fromDate} إلى ${toDate}\n` +
                          `💰 *الرصيد الحالي:* ${balanceText.trim()}\n` +
                          `بواسطة: *${shopName}*`;

            const encodedMessage = encodeURIComponent(message);
            const url = (platform === 'whatsapp') ? 
                `https://wa.me/?text=${encodedMessage}` : 
                `https://t.me/share/url?url=${encodedMessage}`;

            window.open(url, '_blank');
        };

        window.shareSelectedStatementTransactions = function(platform) {
            const accName = document.getElementById('statementHeaderAccName')?.innerText || document.getElementById('stmtAccountSelector')?.value || 'العميل';
            const balanceText = document.getElementById('stmtFinalBalance')?.innerText || '0.00';
            const shopName = document.getElementById('shopName')?.value || (typeof getStore === 'function' ? getStore('shopName') : '') || 'بيان POS';

            const message = `📄 *كشف حساب*\n👤 *الطرف:* ${accName}\n💰 *الرصيد:* ${balanceText.trim()}\nبواسطة: *${shopName}*`;
            const encodedMessage = encodeURIComponent(message);
            const url = (platform === 'whatsapp') ? 
                `https://wa.me/?text=${encodedMessage}` : 
                `https://t.me/share/url?url=${encodedMessage}`;

            window.open(url, '_blank');
        };

        function printAccountStatement() {

            const shopName = document.getElementById('shopName')?.value || getStore('shopName') || 'بَيَان POS';

            const shopPhone = document.getElementById('shopPhone')?.value || '';

            const today = new Date().toLocaleDateString('ar-EG');

            // جلب الجدول الحالي المعروض على الشاشة

            const tableEl = document.getElementById('accountsTableBody');

            if (!tableEl) return alert('❌ لا يوجد بيانات للطباعة');

            // نسخ الجدول وتنظيفه من أزرار الاختيار والتحديد
            const tableClone = tableEl.cloneNode(true);

            // إزالة عمود التحديد (الراديو) من كل صف لضمان تطابق الأعمدة المطبوعة
            tableClone.querySelectorAll('tr').forEach(tr => {
                const radioInput = tr.querySelector('input[type="radio"], input[name="accSelect"]');
                if (radioInput && radioInput.closest('td')) {
                    radioInput.closest('td').remove();
                } else if (tr.children.length === accountsColumnOrder.length && accountsColumnOrder[0] === 10) {
                    tr.children[0].remove();
                }
            });
            tableClone.querySelectorAll('input[type="checkbox"], button').forEach(el => el.remove());

            const rowsHTML = tableClone.innerHTML;

            // توليد رؤوس الأعمدة المطبوعة ديناميكياً بنفس ترتيب الشاشة
            const colTitles = {
                0: 'م',
                1: 'كود الحساب',
                2: 'اسم الحساب',
                3: 'طبيعة الحساب',
                4: 'التصنيف',
                5: 'مدين (عليه)',
                6: 'دائن (له)',
                7: 'إجمالي البيع',
                8: 'آخر تاريخ قبض',
                9: 'آخر حركة'
            };

            let printTheadHtml = '<tr>';
            accountsColumnOrder.forEach(colId => {
                if (colId === 10) return; // تخطي عمود التحديد في الطباعة
                if (!accountsColumnVisibility[colId]) return;
                printTheadHtml += `<th>${colTitles[colId] || ''}</th>`;
            });
            printTheadHtml += '</tr>';

            // حساب الإجماليات من السطر الأخير المرئي

            const totalDebit = document.querySelector('#accountsTableBody tr:last-child td')?.innerText || '';

            const summaryRow = document.querySelector('.accounts-summary, #accountsSummaryRow');

            const shopLogo = document.getElementById('logoPreview')?.src || '';

            const logoHTML = shopLogo && !shopLogo.includes('undefined') 

                ? `<img src="${shopLogo}" style="max-height:60px; max-width:100px;">` 

                : '';

            // إنشاء Iframe مخفي للطباعة

            let iframe = document.getElementById('print-iframe');

            if (!iframe) {

                iframe = document.createElement('iframe');

                iframe.id = 'print-iframe';

                iframe.style.cssText = 'position:fixed;right:100%;bottom:100%;width:0;height:0;border:none;';

                document.body.appendChild(iframe);

            }

            const doc = iframe.contentWindow.document;

            doc.open();

            doc.write(`

                <html dir="rtl">

                <head>

                    <title>كشف الحسابات - ${shopName}</title>

                    <style>

                        @page { size: A4 landscape; margin: 10mm; }

                        * { box-sizing: border-box; }

                        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; width: 100%; max-width: 100%; }

                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 15px; width: 100%; }

                        .shop-info { flex: 1; text-align: right; }

                        .report-title-container { flex: 1; text-align: center; }

                        .logo-container { flex: 1; text-align: left; }

                        .shop-info h2 { margin: 0; font-size: 1.4rem; font-weight: 900; }

                        .shop-info p { margin: 3px 0; font-size: 0.9rem; color: #222; font-weight: bold; }

                        .report-title { display: inline-block; background: #000; color: #fff; padding: 8px 25px; border-radius: 6px; font-size: 1.1rem; font-weight: 900; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }

                        table { width: 100%; max-width: 100%; border-collapse: collapse; font-size: 0.85rem; page-break-inside: auto; table-layout: auto; }

                        tr { page-break-inside: avoid; page-break-after: auto; }

                        thead { display: table-header-group; }

                        tfoot { display: table-footer-group; }

                        thead tr { background: #e0e0e0; color: #000; border-bottom: 2px solid #000; }

                        th { padding: 8px 4px; border: 1px solid #777; text-align: right; font-weight: bold; }

                        td { padding: 6px 4px; border: 1px solid #999; text-align: right; vertical-align: middle; word-wrap: break-word; }

                        tbody tr:nth-child(even) { background: #f5f5f5; }

                        .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 0.85rem; color: #222; font-weight: bold; border-top: 2px solid #000; padding-top: 10px; width: 100%; page-break-inside: avoid; }

                        .badge, .accounts-type-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; border: 1px solid #000; color: #000 !important; background: transparent !important; }

                    </style>

                </head>

                <body>

                    <div class="header">

                        <div class="shop-info">

                            <h2>${shopName}</h2>

                            <p>📞 ${shopPhone}</p>

                            <p>📅 ${today}</p>

                        </div>

                        <div class="report-title-container">

                            <div class="report-title">📋 كشف إجمالي الحسابات</div>

                        </div>

                        <div class="logo-container">

                            ${logoHTML}

                        </div>

                    </div>

                    <table>

                        <thead>
                            ${printTheadHtml}
                        </thead>

                        <tbody>${rowsHTML}</tbody>

                    </table>

                    <div class="footer">

                        <span>بواسطة: نظام بَيَان POS النسخة الذهبية</span>

                        <span>وقت الطباعة: ${new Date().toLocaleString('ar-EG')}</span>

                    </div>

                </body>

                </html>

            `);

            doc.close();

            setTimeout(() => {

                iframe.contentWindow.focus();

                iframe.contentWindow.print();

            }, 600);

        }

        // --- تصدير قائمة الحسابات إلى إكسيل ---

        function exportAccountsToExcel() {
            try {
                const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : (typeof window.XLSX !== 'undefined' ? window.XLSX : null)));
                const search = (document.getElementById('accSearchName')?.value || '').toLowerCase();
                const typeFilter = document.getElementById('accFilterType')?.value || 'all';
                const catFilter = document.getElementById('accFilterCat')?.value || 'all';
                const balanceFilter = document.getElementById('accFilterBalance') ? document.getElementById('accFilterBalance').value : 'all';

                const filtered = accounts.filter(acc => {
                    const matchName = (acc.name || '').toLowerCase().includes(search);
                    const matchCode = (acc.code || '').toString().toLowerCase().includes(search);
                    const matchType = typeFilter === 'all' || acc.type === typeFilter || (acc.type === 'mixed' && (typeFilter === 'client' || typeFilter === 'supplier'));
                    const matchCat = catFilter === 'all' || acc.category === catFilter;
                    return (matchName || matchCode) && matchType && matchCat;
                });

                const typeLabels = { client: 'عميل', supplier: 'مورد', delegate: 'مندوب', mixed: 'عميل ومورد', other: 'أخرى' };
                const exportData = [];

                const cleanArabicStr = (str) => (str || '').trim().toLowerCase()
                    .replace(/[أإآ]/g, 'ا')
                    .replace(/ة/g, 'ه')
                    .replace(/[ىي]/g, 'ي')
                    .replace(/\s+/g, ' ');

                filtered.forEach((acc, idx) => {
                    let initialDebit = parseFloat(acc.debit) || 0;
                    let initialCredit = parseFloat(acc.credit) || 0;
                    let currentBalance = getAccountBalance(acc.name);
                    let totalSales = 0;

                    const targetAccNameClean = cleanArabicStr(acc.name);
                    const targetAccCode = (acc.code || '').toString().trim();

                    const accTrans = (typeof transactions !== 'undefined' ? transactions : []).filter(t => {
                        if (!t) return false;
                        if (t.partner === acc.name) return true;
                        if (targetAccNameClean && cleanArabicStr(t.partner) === targetAccNameClean) return true;
                        if (targetAccCode && (t.partnerCode === targetAccCode || t.accountCode === targetAccCode)) return true;
                        return false;
                    });

                    accTrans.forEach(t => {
                        const transType = (t.type || '');
                        const val = parseFloat(t.total !== undefined ? t.total : (t.price || 0)) || 0;
                        const isSale = transType.includes('بيع') && !transType.includes('مرتجع');
                        const isSaleReturn = transType.includes('مرتجع') && (transType.includes('بيع') || transType.includes('مبيعات'));
                        if (isSale) totalSales += val;
                        else if (isSaleReturn) totalSales -= val;
                    });

                    exportData.push({
                        "م": idx + 1,
                        "كود الحساب": acc.code || '---',
                        "اسم الحساب": acc.name || '',
                        "مدين (عليه)": currentBalance > 0 ? currentBalance.toFixed(2) : '0.00',
                        "دائن (له)": currentBalance < 0 ? Math.abs(currentBalance).toFixed(2) : '0.00',
                        "إجمالي البيع": totalSales.toFixed(2),
                        "طبيعة الحساب": typeLabels[acc.type] || acc.type || 'عام',
                        "التصنيف": acc.category || 'عام',
                        "رقم الهاتف": acc.phone || '---',
                        "العنوان": acc.address || '---'
                    });
                });

                if (exportData.length === 0) {
                    if (typeof showToast === 'function') showToast("⚠️ لا توجد حسابات مطابقة للتصدير", "warning");
                    else alert("⚠️ لا توجد حسابات مطابقة للتصدير");
                    return;
                }

                const fileName = "دليل_الحسابات_" + new Date().toLocaleDateString('ar-EG').replace(/[\\\/:*?"<>|]/g, '_');

                if (XLSXLib && XLSXLib.utils) {
                    const ws = XLSXLib.utils.json_to_sheet(exportData);
                    ws['!dir'] = 'rtl';
                    const wb = XLSXLib.utils.book_new();
                    XLSXLib.utils.book_append_sheet(wb, ws, "دليل الحسابات");
                    XLSXLib.writeFile(wb, fileName + '.xlsx');
                    if (typeof showToast === 'function') showToast("✅ تم تصدير دليل الحسابات إلى ملف Excel بنجاح", "success");
                    return;
                }

                // fallback في حال لم تكن المكتبة محملة
                const keys = Object.keys(exportData[0]);
                const aoaTable = [keys];
                exportData.forEach(row => aoaTable.push(keys.map(k => row[k])));
                if (typeof downloadAOAAsExcelCSV === 'function') {
                    downloadAOAAsExcelCSV(aoaTable, fileName);
                } else if (typeof window.downloadAOAAsExcelCSV === 'function') {
                    window.downloadAOAAsExcelCSV(aoaTable, fileName);
                }
                if (typeof showToast === 'function') showToast("✅ تم تصدير دليل الحسابات إلى ملف Excel/CSV بنجاح", "success");
            } catch (err) {
                console.error("Export Accounts Error:", err);
                if (typeof showToast === 'function') showToast("⚠️ حدث خطأ أثناء تصدير ملف Excel: " + err.message, "error");
            }
        }

        // ─── استيراد دليل الحسابات من Excel ────────────────────────────────────────
        async function importAccountsFromExcel(event) {
            const file = event.target.files[0];
            if (!file) return;
            event.target.value = '';
            if (typeof showToast === 'function') showToast("⏳ جاري تحليل ملف Excel واستيراد الحسابات...", "info");
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const XLSXLib = (typeof getXLSXLibrary === 'function' ? getXLSXLibrary() : (typeof XLSX !== 'undefined' ? XLSX : (typeof window.XLSX !== 'undefined' ? window.XLSX : null)));
                    if (!XLSXLib || !XLSXLib.read) {
                        throw new Error("مكتبة Excel غير جاهزة، يرجى إعادة محاولة فتح الصفحة.");
                    }

                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSXLib.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSXLib.utils.sheet_to_json(worksheet, { header: 1 });

                    if (!jsonData || jsonData.length < 1) throw new Error("الملف المختار فارغ أو لا يحتوي على بيانات!");

                    // تنظيف أولاً من أي حسابات تلفانة رموز غريبة دخلت بسبب محاولة القراءة الخاطئة
                    try {
                        const currentAccs = await db.accounts.toArray();
                        const bogusIds = currentAccs.filter(a => a.name && (a.name.includes('') || a.name.includes('PK') || a.name.length > 80)).map(a => a.id);
                        if (bogusIds.length > 0) {
                            await db.accounts.bulkDelete(bogusIds);
                        }
                    } catch(cleanErr) {}

                    // البحث الذكي عن الصف الذي يحتوي على العناوين (قد يكون الصف الأول أو الثاني أو الثالث)
                    let headerRowIdx = 0;
                    let nameIdx = -1;
                    let headers = [];

                    for (let r = 0; r < Math.min(5, jsonData.length); r++) {
                        const candidateHeaders = (jsonData[r] || []).map(h => String(h || "").trim().toLowerCase());
                        const findInCandidate = (keys) => {
                            let idx = candidateHeaders.findIndex(h => keys.some(k => h === k.toLowerCase()));
                            if (idx !== -1) return idx;
                            return candidateHeaders.findIndex(h => keys.some(k => h.includes(k.toLowerCase())));
                        };
                        const foundIdx = findInCandidate(['اسم الحساب', 'اسم', 'name', 'الاسم', 'العميل', 'المورد', 'اسم العميل', 'اسم المورد', 'الحساب', 'الجهة', 'الطرف']);
                        if (foundIdx !== -1) {
                            headerRowIdx = r;
                            nameIdx = foundIdx;
                            headers = candidateHeaders;
                            break;
                        }
                    }

                    // إذا لم يجد اسم الهيدر صراحة، نعتمد الصف الأول كعناوين ونفترض أن العمود الثاني أو الأول (إن كان نصاً) هو الاسم
                    if (nameIdx === -1) {
                        headerRowIdx = 0;
                        headers = (jsonData[0] || []).map(h => String(h || "").trim().toLowerCase());
                        // البحث عن أول عمود يحتوي على نص في الصفوف التالية
                        const firstDataRow = jsonData[1] || jsonData[0];
                        if (firstDataRow && firstDataRow.length > 1 && isNaN(firstDataRow[1])) {
                            nameIdx = 1; // العمود الثاني (مثلاً بعد م أو الكود)
                        } else {
                            nameIdx = 0; // العمود الأول
                        }
                    }

                    const findCol = (keys) => {
                        let idx = headers.findIndex(h => keys.some(k => h === k.toLowerCase()));
                        if (idx !== -1) return idx;
                        return headers.findIndex(h => keys.some(k => h.includes(k.toLowerCase())));
                    };

                    const typeIdx    = findCol(['نوع الحساب', 'النوع', 'نوع', 'type', 'تصنيف الحساب']);
                    const categoryIdx= findCol(['التصنيف', 'تصنيف', 'category']);
                    const phoneIdx   = findCol(['رقم الهاتف', 'هاتف', 'تليفون', 'phone', 'جوال', 'موبايل']);
                    const emailIdx   = findCol(['البريد الإلكتروني', 'بريد', 'email', 'ايميل']);
                    const addressIdx = findCol(['العنوان', 'عنوان', 'address']);
                    const notesIdx   = findCol(['الملاحظات', 'ملاحظات', 'notes', 'note']);
                    const balanceIdx = findCol(['الرصيد الحالى', 'الرصيد', 'رصيد', 'balance', 'مديونية']);
                    const debitIdx   = findCol(['مدين (عليه)', 'مدين']);
                    const creditIdx  = findCol(['دائن (له)', 'دائن']);
                    const codeIdx    = findCol(['كود الحساب', 'كود', 'code', 'الكود']);

                    const rows = jsonData.slice(headerRowIdx + 1);
                    let added = 0, updated = 0, skipped = 0;
                    
                    const dbAccounts = await db.accounts.toArray();

                    for (const row of rows) {
                        const name = row[nameIdx] ? String(row[nameIdx]).trim() : "";
                        // تجاهل الصفوف الفارغة كلياً أو صفوف الإجماليات
                        if (!name || name === 'م' || name.includes('إجمالي') || name.includes('مجموع')) { 
                            skipped++; 
                            continue; 
                        }
                        
                        let accType = 'client'; // نوع الحساب الافتراضي عميل إن لم يحدد
                        if (typeIdx !== -1 && row[typeIdx]) {
                            const t = String(row[typeIdx]).trim().toLowerCase();
                            if (t.includes('مور') || t === 'supplier') accType = 'supplier';
                            else if (t.includes('مندوب') || t === 'delegate') accType = 'delegate';
                            else if (t.includes('مشترك') || t.includes('عميل ومورد') || t === 'mixed') accType = 'mixed';
                        }
                        
                        const category= categoryIdx!== -1 ? String(row[categoryIdx]|| "").trim() : "عام";
                        const phone   = phoneIdx   !== -1 ? String(row[phoneIdx]   || "").trim() : "";
                        const email   = emailIdx   !== -1 ? String(row[emailIdx]   || "").trim() : "";
                        const address = addressIdx !== -1 ? String(row[addressIdx] || "").trim() : "";
                        const notes   = notesIdx   !== -1 ? String(row[notesIdx]   || "").trim() : "";
                        const code    = codeIdx    !== -1 ? String(row[codeIdx]    || "").trim() : "";

                        // حساب الرصيد الابتدائي (مدين ودائن أو رصيد مباشر)
                        let initialDebit = 0;
                        let initialCredit = 0;

                        if (debitIdx !== -1 && row[debitIdx] !== undefined) {
                            initialDebit = parseFloat(row[debitIdx]) || 0;
                        }
                        if (creditIdx !== -1 && row[creditIdx] !== undefined) {
                            initialCredit = parseFloat(row[creditIdx]) || 0;
                        }
                        if (debitIdx === -1 && creditIdx === -1 && balanceIdx !== -1 && row[balanceIdx] !== undefined) {
                            const bal = parseFloat(row[balanceIdx]) || 0;
                            if (bal > 0) initialDebit = bal;
                            else if (bal < 0) initialCredit = Math.abs(bal);
                        }

                        const existing = dbAccounts.find(a => a.name && a.name.trim().toLowerCase() === name.toLowerCase());

                        if (existing) {
                            const updateData = {
                                ...existing,
                                mobile: phone || existing.mobile,
                                email: email || existing.email,
                                address: address || existing.address,
                                notes: notes || existing.notes,
                                code: code || existing.code,
                                category: category || existing.category,
                                type: accType
                            };
                            await db.accounts.put(updateData);
                            updated++;
                        } else {
                            const newAccount = {
                                id: Date.now() + Math.floor(Math.random() * 1000000),
                                name,
                                type: accType,
                                category,
                                mobile: phone,
                                email,
                                address,
                                notes,
                                code,
                                debit: initialDebit,
                                credit: initialCredit,
                                balanceDate: new Date().toLocaleDateString('en-CA'),
                                createdAt: new Date().toISOString()
                            };
                            await db.accounts.add(newAccount);
                            added++;
                        }
                    }
                    
                    // إعادة تحميل مصفوفة الحسابات وتحديث الجدول
                    accounts = await db.accounts.toArray();
                    renderAccountsTable();
                    if (typeof showToast === 'function') showToast(`✅ تم الاستيراد: ${added} جديد، ${updated} محدَّث، ${skipped} مُتخطَّى`, 'success');
                } catch (err) {
                    console.error("Import Accounts Error:", err);
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({
                            titleText: '⚠️ فشل الاستيراد',
                            msg: err.message || 'حدث خطأ غير متوقع أثناء تحليل الملف.',
                            type: 'error'
                        });
                    } else {
                        alert("⚠️ فشل استيراد الحسابات: " + err.message);
                    }
                }
            };
            reader.readAsArrayBuffer(file);
        }

        window.renderAccountsTable = renderAccountsTable;
        window.selectAccountRow = selectAccountRow;
        window.editSelectedAccount = editSelectedAccount;
        window.deleteSelectedAccount = deleteSelectedAccount;
        window.printAccountStatement = printAccountStatement;
        window.exportAccountsToExcel = exportAccountsToExcel;
        window.importAccountsFromExcel = importAccountsFromExcel;

