// ============================================================
//  إدارة الفواتير السابقة وتعديلها واستعراض بنودها (Invoices Management)
// ============================================================
        // 🔒 خاصية إظهار / إخفاء المبالغ المالية في تقرير الحركة اليومية للحفاظ على الخصوصية مع حماية برمز PIN المدير
        window.toggleDailyReportAmountsPrivacy = async function() {
            const isCurrentlyHidden = document.body.classList.contains('daily-amounts-hidden');
            const iconEl = document.getElementById('dailyAmountsEyeIcon');
            const textEl = document.getElementById('dailyAmountsEyeText');
            const btn = document.getElementById('toggleDailyAmountsBtn');

            const curUser = (typeof currentUser !== 'undefined') ? currentUser : null;
            const isAdmin = curUser ? (curUser.role === 'admin') : true;

            let requiresAdminPin = false;
            if (curUser && !isAdmin) {
                const uTarget = (typeof users !== 'undefined' && Array.isArray(users))
                    ? (users.find(u => u.pin === curUser.pin || u.name === curUser.name) || curUser)
                    : curUser;

                if (uTarget && uTarget.permissions && uTarget.permissions.general && uTarget.permissions.general.lockDailyAmounts !== undefined) {
                    requiresAdminPin = !!uTarget.permissions.general.lockDailyAmounts;
                } else {
                    requiresAdminPin = true;
                }
            }

            // 🛡️ إذا كانت المبالغ مخفية حالياً والمستخدم موظف مفعل عليه قفل المبالغ -> نطلب رمز PIN المدير إجبارياً
            if (isCurrentlyHidden && requiresAdminPin) {
                if (typeof window.verifyAdminPinAuthorization === 'function') {
                    const ok = await window.verifyAdminPinAuthorization('👁️ كشف وإظهار المبالغ المالية', 'يتطلب إظهار المبالغ المالية في تقرير الحركة اليومية إدخال رمز PIN الخاص بالمدير.');
                    if (!ok) return;
                }
            }

            const isHidden = document.body.classList.toggle('daily-amounts-hidden');

            if (isHidden) {
                if (iconEl) iconEl.innerText = '🔒';
                if (textEl) textEl.innerText = 'إظهار المبالغ';
                if (btn) {
                    btn.style.background = '#fef3c7';
                    btn.style.borderColor = '#fde68a';
                    btn.style.color = '#b45309';
                    btn.title = requiresAdminPin ? 'انقر لإدخال رمز PIN المدير وإظهار المبالغ المالية' : 'إظهار المبالغ المالية';
                }
                if (typeof showToast === 'function') showToast('🔒 تم إخفاء وتأمين المبالغ المالية بنجاح', 'info');
            } else {
                if (iconEl) iconEl.innerText = '👁️';
                if (textEl) textEl.innerText = 'إخفاء المبالغ';
                if (btn) {
                    btn.style.background = '#f1f5f9';
                    btn.style.borderColor = '#cbd5e1';
                    btn.style.color = '#475569';
                    btn.title = 'إخفاء المبالغ المالية فوراً للحفاظ على الخصوصية';
                }
                if (typeof showToast === 'function') showToast(requiresAdminPin ? '👁️ تم إظهار المبالغ المالية بنجاح بإذن المدير' : '👁️ تم إظهار المبالغ المالية بنجاح', 'success');
            }
        };

        // 🏷️ توليد شارة ملونة ومميزة للجهاز وحرفه في جدول الفواتير
        function getTerminalBadgeHtml(t) {
            const rawTerminal = t.terminal || 'الجهاز الرئيسي 💻';
            let letter = t.terminalLetter;
            if (!letter) {
                const match = rawTerminal.match(/\(([A-Z])\)/i);
                if (match) letter = match[1].toUpperCase();
                else if (rawTerminal.includes('الرئيسي') || rawTerminal.includes('Master')) letter = 'MASTER';
                else letter = 'A';
            }

            const isMaster = letter === 'MASTER' || rawTerminal.includes('الرئيسي') || rawTerminal.includes('Master');

            // ألوان وهوية بصرية مميزة لكل جهاز وحرف
            const colorMap = {
                'MASTER': { bg: '#ecfdf5', border: '#10b981', color: '#065f46', dot: '#10b981', label: '💻 الرئيسي (ماستر)' },
                'A': { bg: '#f5f3ff', border: '#8b5cf6', color: '#5b21b6', dot: '#7c3aed', label: '📱 فرعي (A)' },
                'B': { bg: '#fff7ed', border: '#f97316', color: '#9a3412', dot: '#ea580c', label: '📱 فرعي (B)' },
                'C': { bg: '#ecfeff', border: '#06b6d4', color: '#155e75', dot: '#0891b2', label: '📱 فرعي (C)' },
                'D': { bg: '#fff1f2', border: '#f43f5e', color: '#9f1239', dot: '#e11d48', label: '📱 فرعي (D)' },
                'E': { bg: '#fefce8', border: '#eab308', color: '#854d0e', dot: '#ca8a04', label: '📱 فرعي (E)' }
            };

            const style = colorMap[letter] || { bg: '#f8fafc', border: '#94a3b8', color: '#334155', dot: '#64748b', label: rawTerminal };
            const label = isMaster ? '💻 الرئيسي' : (t.terminal || style.label);
            const safeInvId = String(t.invoiceId || t.id || '').replace(/'/g, "\\'");

            return `
                <div style="display:inline-flex; align-items:center; gap:4px; margin-top:2px;">
                    <span style="font-size:0.73rem; background:${style.bg}; color:${style.color}; border:1px solid ${style.border}; padding:1px 6px; border-radius:6px; font-weight:800; display:inline-flex; align-items:center; gap:4px; box-shadow:0 1px 3px rgba(0,0,0,0.04);" title="${rawTerminal}">
                        <span style="width:6px; height:6px; border-radius:50%; background:${style.dot}; display:inline-block;"></span>
                        <span>${label}</span>
                    </span>
                    <button type="button" onclick="event.stopPropagation(); window.showTerminalInfoModal('${safeInvId}')" 
                        style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:50%; width:18px; height:18px; font-size:0.68rem; font-weight:900; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; padding:0; line-height:1; transition:0.2s;" 
                        title="تفاصيل جهاز البيع والمزامنة">❓</button>
                </div>
            `;
        }

        // ❓ نافذة الاستعلام التوضيحية لجهاز إصدار الفاتورة
        window.showTerminalInfoModal = function(invoiceId) {
            if (!window.transactions) return;
            const tx = transactions.find(t => String(t.invoiceId || t.id) === String(invoiceId) && t.isInvoiceHead)
                || transactions.find(t => String(t.invoiceId || t.id) === String(invoiceId));
            if (!tx) {
                if (typeof showToast === 'function') showToast('لم يتم العثور على بيانات الفاتورة', 'warning');
                return;
            }

            const rawTerminal = tx.terminal || 'الجهاز الرئيسي 💻';
            let letter = tx.terminalLetter;
            if (!letter) {
                const match = rawTerminal.match(/\(([A-Z])\)/i);
                if (match) letter = match[1].toUpperCase();
                else if (rawTerminal.includes('الرئيسي') || rawTerminal.includes('Master')) letter = 'MASTER';
                else letter = 'A';
            }

            const isMaster = letter === 'MASTER' || rawTerminal.includes('الرئيسي') || rawTerminal.includes('Master');
            const order = tx.terminalOrder != null ? tx.terminalOrder : (isMaster ? 0 : (letter === 'A' ? 1 : (letter === 'B' ? 2 : (letter === 'C' ? 3 : 1))));

            let syncOrderDescription = '';
            if (isMaster) {
                syncOrderDescription = 'الجهاز الماستر الرئيسي (سيرفر المنظومة المضيف لقاعدة البيانات المركزية)';
            } else if (order === 1 || letter === 'A') {
                syncOrderDescription = 'أول جهاز فرعي تم إقرانه ومزامنته مع المنظومة (كاشير فرعي 1)';
            } else if (order === 2 || letter === 'B') {
                syncOrderDescription = 'ثاني جهاز فرعي تم إقرانه ومزامنته مع المنظومة (كاشير فرعي 2)';
            } else if (order === 3 || letter === 'C') {
                syncOrderDescription = 'ثالث جهاز فرعي تم إقرانه ومزامنته مع المنظومة (كاشير فرعي 3)';
            } else if (order === 4 || letter === 'D') {
                syncOrderDescription = 'رابع جهاز فرعي تم إقرانه ومزامنته مع المنظومة (كاشير فرعي 4)';
            } else {
                syncOrderDescription = `جهاز فرعي مقترن ومزامن مع المنظومة (الترتيب: رقم ${order})`;
            }

            const modalId = 'terminalInfoDetailsModal';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.className = 'confirm-modal-overlay';
                modal.style.zIndex = '9999999999';
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div style="background:#ffffff; padding:28px 24px; border-radius:22px; width:460px; max-width:92%; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.3); border:2px solid ${isMaster ? '#10b981' : '#7c3aed'}; direction:rtl; font-family:inherit; animation:fadeIn 0.2s ease;">
                    <div style="font-size:2.8rem; margin-bottom:8px;">${isMaster ? '🖥️' : '📱'}</div>
                    <h3 style="margin:0 0 6px; color:#0f172a; font-size:1.25rem; font-weight:900;">
                        تفاصيل جهاز إصدار العملية
                    </h3>
                    <div style="color:#64748b; font-size:0.85rem; font-weight:700; margin-bottom:16px;">
                        فاتورة رقم: <span style="font-family:monospace; color:#2563eb; font-weight:900;">#${tx.invoiceId || tx.id}</span>
                    </div>

                    <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px; margin-bottom:16px; text-align:right; font-size:0.88rem; line-height:1.7;">
                        <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#64748b; font-weight:bold;">جهاز البيع / الإصدار:</span>
                            <span style="font-weight:900; color:#0f172a;">${tx.terminal || (isMaster ? 'الجهاز الرئيسي 💻' : 'كاشير فرعي 📱')}</span>
                        </div>

                        <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#64748b; font-weight:bold;">الرمز الأبجدي للجهاز:</span>
                            <span style="background:${isMaster ? '#10b981' : '#7c3aed'}; color:white; font-weight:900; padding:2px 10px; border-radius:6px; font-family:monospace; font-size:0.88rem;">
                                ${letter}
                            </span>
                        </div>

                        <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#64748b; font-weight:bold;">المستخدم / الكاشير:</span>
                            <span style="font-weight:800; color:#1e293b;">👤 ${tx.user || '-'}</span>
                        </div>

                        <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#64748b; font-weight:bold;">المخزن / القسم:</span>
                            <span style="font-weight:800; color:#047857;">🏢 ${tx.warehouse || 'المخزن الرئيسي'}</span>
                        </div>

                        <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#64748b; font-weight:bold;">تاريخ وتوقيت العملية:</span>
                            <span style="font-weight:800; color:#475569; font-size:0.82rem;">${tx.date || ''} ${tx.timeISO || ''}</span>
                        </div>

                        ${tx.terminalId ? `
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#64748b; font-weight:bold;">معرّف الجهاز (Device ID):</span>
                            <span style="font-family:monospace; color:#64748b; font-size:0.8rem;">${tx.terminalId}</span>
                        </div>
                        ` : ''}
                    </div>

                    <div style="background:${isMaster ? '#ecfdf5' : '#f5f3ff'}; border:1px solid ${isMaster ? '#a7f3d0' : '#ddd6fe'}; border-radius:12px; padding:12px 14px; margin-bottom:18px; text-align:right; font-size:0.84rem; color:${isMaster ? '#065f46' : '#5b21b6'}; font-weight:700; line-height:1.5;">
                        ℹ️ <strong>حالة الجهاز في المنظومة:</strong><br>
                        ${syncOrderDescription}
                    </div>

                    <button onclick="document.getElementById('${modalId}').remove()" style="background:#0f172a; color:#ffffff; border:none; padding:11px 30px; border-radius:12px; font-weight:bold; font-size:0.95rem; cursor:pointer; width:100%; transition:0.2s;">
                        إغلاق النافذة
                    </button>
                </div>
            `;
        };

        window.accountBalancesCache = {};
        window._partnerTransactionsIndex = null;
        window._accountsByNameClean = null;
        window._cleanArabicCache = new Map();

        // ⚡ دالة تطبيع الحروف العربية فائقة السرعة مع تخزين مؤقت للنتائج
        function cleanArabicCached(str) {
            if (!str) return '';
            let val = window._cleanArabicCache.get(str);
            if (val !== undefined) return val;
            val = String(str).trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            if (window._cleanArabicCache.size > 8000) window._cleanArabicCache.clear();
            window._cleanArabicCache.set(str, val);
            return val;
        }
        window.cleanArabicCached = cleanArabicCached;

        // ⚡ فهرس ذكي فوري يجمع معاملات كل شريك مرة واحدة O(N) بدلاً من ملايين التكرارات O(N*M)
        function ensurePartnerTransactionsIndex() {
            if (window._partnerTransactionsIndex instanceof Map) return window._partnerTransactionsIndex;
            const index = new Map();
            const txs = (typeof transactions !== 'undefined' && Array.isArray(transactions)) ? transactions : [];
            for (let i = 0; i < txs.length; i++) {
                const t = txs[i];
                if (!t || !t.partner) continue;
                const pClean = cleanArabicCached(t.partner);
                if (!pClean) continue;
                let list = index.get(pClean);
                if (!list) {
                    list = [];
                    index.set(pClean, list);
                }
                list.push(t);
            }
            window._partnerTransactionsIndex = index;
            return index;
        }

        // ⚡ جلب الحساب فورياً بالاسم المنظف O(1)
        function getAccountByNameCached(targetNameClean) {
            if (!window._accountsByNameClean) {
                const map = new Map();
                const accs = (typeof accounts !== 'undefined' && Array.isArray(accounts)) ? accounts : [];
                for (let i = 0; i < accs.length; i++) {
                    const a = accs[i];
                    if (a && a.name) {
                        map.set(cleanArabicCached(a.name), a);
                    }
                }
                window._accountsByNameClean = map;
            }
            return window._accountsByNameClean.get(targetNameClean);
        }

        window.invalidateAccountBalancesCache = function(partnerName = null) {
            if (partnerName) {
                const targetNameClean = cleanArabicCached(partnerName);
                if (window.accountBalancesCache) {
                    for (const k in window.accountBalancesCache) {
                        if (k.startsWith(targetNameClean + "_")) {
                            delete window.accountBalancesCache[k];
                        }
                    }
                }
                if (window._partnerTransactionsIndex instanceof Map) {
                    const txs = (typeof transactions !== 'undefined' && Array.isArray(transactions)) ? transactions : [];
                    const pList = [];
                    for (let i = 0; i < txs.length; i++) {
                        const t = txs[i];
                        if (t && t.partner && cleanArabicCached(t.partner) === targetNameClean) {
                            pList.push(t);
                        }
                    }
                    window._partnerTransactionsIndex.set(targetNameClean, pList);
                }
            } else {
                window.accountBalancesCache = {};
                window._partnerTransactionsIndex = null;
                window._accountsByNameClean = null;
            }
        };

        // ⚡ دالة حساب رصيد العميل/المورد فائقة السرعة مع الفهرس المباشر
        function getAccountBalance(name, excludeInvoiceId = null) {
            if (!name || (window.isGenericCashPartner && window.isGenericCashPartner(name))) return 0;
            const targetNameClean = cleanArabicCached(name);
            const activeExcludeId = excludeInvoiceId ? String(excludeInvoiceId) : null;
            const cacheKey = targetNameClean + "_" + (activeExcludeId || 'none');

            if (window.accountBalancesCache && window.accountBalancesCache[cacheKey] !== undefined) {
                return window.accountBalancesCache[cacheKey];
            }

            const acc = getAccountByNameCached(targetNameClean);
            if (!acc) return 0;

            let initialDebit = parseFloat(acc.debit) || 0;
            let initialCredit = parseFloat(acc.credit) || 0;
            let currentBalance = initialDebit - initialCredit;

            const partnerIndex = ensurePartnerTransactionsIndex();
            const partnerAllTxs = partnerIndex.get(targetNameClean) || [];

            const accTrans = activeExcludeId 
                ? partnerAllTxs.filter(t => String(t.invoiceId) !== activeExcludeId)
                : partnerAllTxs;

            const ivMap = {};
            const singleTrans = [];

            for (let i = 0; i < accTrans.length; i++) {
                const t = accTrans[i];
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
            }

            const ivs = Object.values(ivMap);
            for (let i = 0; i < ivs.length; i++) {
                const iv = ivs[i];
                if (iv.paid === 0 && iv.total > 0) {
                    const m = String(iv.method || '').trim();
                    const isCreditMethod = typeof window.isTransactionCredit === 'function'
                        ? window.isTransactionCredit(m, 0, 0, 0)
                        : (m.includes('آجل') || m.includes('اجل') || m.includes('ذمم') || m.includes('credit'));
                    if (!isCreditMethod) {
                        iv.paid = iv.total;
                    }
                }
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
            }

            for (let i = 0; i < singleTrans.length; i++) {
                const t = singleTrans[i];
                const amount = parseFloat(t.total) || parseFloat(t.price) || 0;
                if (t.type.includes('قبض') || t.type.includes('مرتجع بيع')) {
                    currentBalance -= amount;
                } else if (t.type.includes('صرف') || t.type.includes('مرتجع شراء') || t.type.includes('بيع')) {
                    currentBalance += amount;
                }
            }

            if (!window.accountBalancesCache) window.accountBalancesCache = {};
            window.accountBalancesCache[cacheKey] = currentBalance;

            return currentBalance;
        }

        window.getAccountBalance = getAccountBalance;

        // دالة حساب الرصيد التاريخي للعميل/المورد عند لحظة إصدار فاتورة معينة
        function getHistoricalPartnerBalance(name, invoiceId = null, beforeIndex = null) {
            if (!name || (window.isGenericCashPartner && window.isGenericCashPartner(name))) return 0;
            const targetNameClean = cleanArabicCached(name);

            const acc = getAccountByNameCached(targetNameClean);
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

            const partnerIndex = ensurePartnerTransactionsIndex();
            const partnerAllTxs = partnerIndex.get(targetNameClean) || [];

            const priorTrans = partnerAllTxs.filter(t => {
                const origIdx = (t.originalIndex !== undefined) ? t.originalIndex : allTrans.indexOf(t);
                return origIdx < cutoffIdx;
            });

            const ivMap = {};
            const singleTrans = [];

            for (let i = 0; i < priorTrans.length; i++) {
                const t = priorTrans[i];
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
            }

            const ivs = Object.values(ivMap);
            for (let i = 0; i < ivs.length; i++) {
                const iv = ivs[i];
                if (iv.paid === 0 && iv.total > 0) {
                    const m = String(iv.method || '').trim();
                    const isCreditMethod = typeof window.isTransactionCredit === 'function'
                        ? window.isTransactionCredit(m, 0, 0, 0)
                        : (m.includes('آجل') || m.includes('اجل') || m.includes('ذمم') || m.includes('credit'));
                    if (!isCreditMethod) {
                        iv.paid = iv.total;
                    }
                }
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
            }

            for (let i = 0; i < singleTrans.length; i++) {
                const t = singleTrans[i];
                const amount = parseFloat(t.total) || parseFloat(t.price) || 0;
                if (t.type.includes('قبض') || t.type.includes('مرتجع بيع')) {
                    balance -= amount;
                } else if (t.type.includes('صرف') || t.type.includes('مرتجع شراء') || t.type.includes('بيع')) {
                    balance += amount;
                }
            }

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
                        transferStatus: t.transferStatus || null,
                        sourceWarehouse: t.sourceWarehouse || t.fromWarehouse || null,
                        toWarehouse: t.toWarehouse || t.destWarehouse || null,
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

                if (t.transferStatus) groups[key].transferStatus = t.transferStatus;
                if (t.sourceWarehouse) groups[key].sourceWarehouse = t.sourceWarehouse;
                if (t.toWarehouse) groups[key].toWarehouse = t.toWarehouse;

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
                const rawM = String(g.method || '').toLowerCase().trim();
                const cleanM = rawM.replace(/[أإآ]/g, 'ا');
                const isExplicitCredit = cleanM.includes('اجل') || cleanM.includes('ذمم') || cleanM.includes('ذمه') || cleanM.includes('تقسيط') || cleanM.includes('حساب') || cleanM.includes('credit') || cleanM.includes('deferred') || (g.remaining > 0);
                
                if (isExplicitCredit) {
                    g.remaining = Math.max(0, g.total - (parseFloat(g.paid) || 0));
                } else if (cleanM.includes('نقدي') || cleanM.includes('نقديه') || cleanM.includes('كاش') || cleanM.includes('تحويل') || cleanM.includes('بنك') || cleanM.includes('شبكه') || cleanM.includes('فيزا') || cleanM.includes('فودافون') || cleanM.includes('vodafone') || cleanM.includes('انستا') || cleanM.includes('insta') || cleanM.includes('محفظه') || cleanM.includes('wallet') || cleanM.includes('اورنج') || cleanM.includes('اتصالات') || g.type.includes('تسوية') || g.type.includes('قبض') || g.type.includes('صرف')) {
                    if (g.paid === 0 && (!g.remaining || g.remaining === 0)) {
                        g.paid = g.total;
                        g.remaining = 0;
                    } else if (g.paid > 0 && g.paid < g.total) {
                        g.remaining = Math.max(0, g.total - g.paid);
                    } else {
                        g.remaining = 0;
                    }
                } else {
                    g.remaining = Math.max(0, g.total - (parseFloat(g.paid) || 0));
                }
            });

            return Object.values(groups);
        }
        window.getGroupedTransactions = getGroupedTransactions;

        // نظام التصفح والتحميل الذكي لفواتير العمليات
        window.invoicesRenderLimit = 100;

        // ⚡ محرك تأخير ذكي للبحث فائق السرعة (Search Debounce) لمنع أي بطء أو تكرار عمليات الفلترة مع البيانات الضخمة
        let _invoicesSearchDebounceTimer = null;
        window.debouncedRenderInvoicesTable = function(delay = 140) {
            if (_invoicesSearchDebounceTimer) {
                clearTimeout(_invoicesSearchDebounceTimer);
            }
            _invoicesSearchDebounceTimer = setTimeout(() => {
                _invoicesSearchDebounceTimer = null;
                renderInvoicesTable();
            }, delay);
        };

        window.loadMoreInvoices = function(step) {
            if (step === 0) {
                window.invoicesRenderLimit = Infinity;
            } else {
                window.invoicesRenderLimit = (window.invoicesRenderLimit || 100) + step;
            }
            renderInvoicesTable(true);
        };

        async function renderInvoicesTable(isLoadMore = false) {
            // إلغاء أي مؤقت بحث مؤجل لضمان التنفيذ المباشر فوراً عند الاستدعاء الصريح
            if (_invoicesSearchDebounceTimer) {
                clearTimeout(_invoicesSearchDebounceTimer);
                _invoicesSearchDebounceTimer = null;
            }

            if (!isLoadMore) {
                window.invoicesRenderLimit = window.invoicesRenderLimit || 100;
            }

            const searchId = (document.getElementById('invoicesSearchId')?.value || '').toLowerCase();
            const fromDate = document.getElementById('invoicesDateFrom')?.value || '';
            const toDate = document.getElementById('invoicesDateTo')?.value || '';

            // ⚡ جلب الفواتير السابقة أو المحددة من SQLite عند الطلب
            if (searchId && typeof window.ensureInvoiceLoaded === 'function') {
                await window.ensureInvoiceLoaded(searchId);
            }
            if ((fromDate || toDate) && typeof window.loadTransactionsForDateRange === 'function') {
                const todayISO = new Date().toLocaleDateString('en-CA');
                if (fromDate < todayISO || toDate < todayISO) {
                    await window.loadTransactionsForDateRange(fromDate, toDate);
                }
            }

            if (typeof renderInvoicesWarehouseChips === 'function') {
                const whChipsBar = document.getElementById('invoicesWarehouseChipsBar');
                if (whChipsBar && whChipsBar.children.length <= 1) {
                    renderInvoicesWarehouseChips();
                }
            }

            const tbody = document.getElementById('invoicesTableBody');

            tbody.innerHTML = '';

            const searchPartner = document.getElementById('invoicesSearchPartner').value.toLowerCase();

            const searchProduct = document.getElementById('invoicesSearchProduct') ? document.getElementById('invoicesSearchProduct').value.toLowerCase() : '';

            const searchMethod = document.getElementById('invoicesSearchMethod').value;

            const typeFilter = document.getElementById('invoicesTypeFilter').value;

            // الحفاظ على الفهرس الأصلي للعملية بدون استهلاك الذاكرة أو استنساخ آلاف الكائنات
            for (let i = 0; i < transactions.length; i++) {
                transactions[i].originalIndex = i;
            }
            let rawData = transactions;

            // 🔒 خصوصية وسرية الفواتير بحسب دور ونطاق المستخدم الحالي
            const activeUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : window.currentUser;
            if (activeUser && activeUser.role !== 'admin') {
                const invScope = activeUser.invoiceScope || 'user_only';
                const myName = (activeUser.name || '').trim().toLowerCase();
                const adminNames = (typeof window.getAdminUserNames === 'function') 
                    ? window.getAdminUserNames() 
                    : new Set(['المدير', 'المدير العام', 'مدير النظام', 'admin']);

                if (invScope === 'user_only') {
                    // 👤 حصر تام بفواتير هذا الموظف فقط (حسب حسابه الشخصي وورديته)
                    rawData = rawData.filter(t => {
                        const tUser = (t.user || '').trim().toLowerCase();
                        return tUser && tUser === myName;
                    });
                } else if (invScope === 'hide_admin') {
                    // 🛡️ حجب فواتير كافة حسابات مديري النظام ديناميكياً
                    rawData = rawData.filter(t => {
                        const tUser = (t.user || '').trim().toLowerCase();
                        return !adminNames.has(tUser);
                    });
                } else if (invScope === 'terminal_only') {
                    // حصر الفواتير بجهاز الموظف الحالي أو اسمه فقط
                    let myLetter = (window.BayanNetworkHub && typeof window.BayanNetworkHub.getTerminalLetter === 'function') 
                        ? window.BayanNetworkHub.getTerminalLetter() 
                        : (window.localNetworkHub && window.localNetworkHub.deviceLetter) || (typeof getStore === 'function' ? getStore('local_device_letter') : '') || '';
                    rawData = rawData.filter(t => {
                        const tUser = (t.user || '').trim().toLowerCase();
                        let tLetter = t.terminalLetter;
                        if (!tLetter && t.terminal) {
                            const match = t.terminal.match(/\(([A-Z])\)/i);
                            if (match) tLetter = match[1].toUpperCase();
                        }
                        const isMyTerminal = myLetter && (tLetter && tLetter.toUpperCase() === myLetter.toUpperCase());
                        const isMyUser = tUser && (tUser === myName);
                        return isMyTerminal || isMyUser;
                    });
                } else if (invScope === 'warehouse_only') {
                    // حصر الفواتير بفرع ومخزن الموظف المصرح له فقط
                    const userWh = (activeUser.warehouseScope === 'main') 
                        ? 'المخزن الرئيسي' 
                        : (activeUser.assignedWarehouse || 'المخزن الرئيسي');
                    rawData = rawData.filter(t => (t.warehouse || 'المخزن الرئيسي') === userWh);
                } else if (invScope === 'hide_master') {
                    // حجب فواتير ومبيعات الجهاز الرئيسي (Master) وحسابات الإدارة
                    rawData = rawData.filter(t => {
                        const rawTerminal = t.terminal || '';
                        let letter = t.terminalLetter;
                        if (!letter) {
                            const match = rawTerminal.match(/\(([A-Z])\)/i);
                            if (match) letter = match[1].toUpperCase();
                            else if (rawTerminal.includes('الرئيسي') || rawTerminal.includes('Master')) letter = 'MASTER';
                        }
                        const tUser = (t.user || '').trim().toLowerCase();
                        const isMaster = (letter === 'MASTER') || rawTerminal.includes('الرئيسي') || rawTerminal.includes('Master') || adminNames.has(tUser);
                        return !isMaster;
                    });
                }
            }

            const cleanAr = (str) => cleanArabicCached(str);

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

            // 🏢 تصفية حسب المخزن / الفرع المختار من التبويبات الأفقية
            if (window.currentInvoicesWarehouseFilter && window.currentInvoicesWarehouseFilter !== 'all') {
                const whFilter = window.currentInvoicesWarehouseFilter;
                rawData = rawData.filter(t => (t.warehouse || 'المخزن الرئيسي') === whFilter);
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

                const matchingSet = new Set(matchingAccountNames);

                rawData = rawData.filter(t => {
                    if (!t || !t.partner) return false;
                    const pName = cleanAr(t.partner);
                    if (pName.includes(cleanSearch)) return true;
                    if (matchingSet.has(pName)) return true;
                    for (let mIdx = 0; mIdx < matchingAccountNames.length; mIdx++) {
                        const m = matchingAccountNames[mIdx];
                        if (pName.includes(m) || m.includes(pName)) return true;
                    }
                    return false;
                });
            }

            if (searchProduct) {
                const cleanProdQ = cleanAr(searchProduct);
                rawData = rawData.filter(t => t.product && cleanAr(t.product).includes(cleanProdQ));
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
                const isRejectedTransfer = t.type && t.type.includes('تحويل') && t.transferStatus === 'rejected';
                if (isRejectedTransfer) {
                    // التحويلات المرفوضة ملغاة ولا تدخل في إجماليات الفواتير المحاسبية
                    return;
                }

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

            const totalMatchingInvoices = finalData.length;
            const limit = window.invoicesRenderLimit || 500;
            const displayedInvoices = finalData.slice(0, limit);
            const hasMore = totalMatchingInvoices > displayedInvoices.length;

            if (document.getElementById('invSumCount')) {
                document.getElementById('invSumCount').innerHTML = hasMore
                    ? `${displayedInvoices.length} <small style="font-size:0.7rem; opacity:0.85;">من ${totalMatchingInvoices}</small>`
                    : totalMatchingInvoices;
            }

            if (document.getElementById('invSumTotal')) document.getElementById('invSumTotal').innerText = sumTotal.toFixed(2);

            if (document.getElementById('invSumPaid')) document.getElementById('invSumPaid').innerText = sumPaid.toFixed(2);

            if (document.getElementById('invSumDebt')) document.getElementById('invSumDebt').innerText = sumDebt.toFixed(2);

            if (document.getElementById('invSumProfit')) document.getElementById('invSumProfit').innerText = sumProfit.toFixed(2);

            // إخفاء/إظهار كارت الأرباح وعمود الأرباح برمجياً وبهدوء تام بدون أي نوافذ تنبيه منبثقة
            const hasProfitPerm = (typeof hasPermission === 'function') ? hasPermission('general_profits') : true;

            const profitCard = document.getElementById('invProfitCard');
            if (profitCard) profitCard.style.display = hasProfitPerm ? 'flex' : 'none';

            // تحديث استايلات الأعمدة (بدون المساس بمصفوفة تخصيص الأعمدة المحفوظة)
            updateInvoicesTableStyles();

            // تنظيف أي ستايلات display مضمنة قديمة على الرؤوس لضمان سيادة قواعد CSS العامة
            const invHeadCells = document.querySelectorAll('#invoicesMainTable thead th');
            invHeadCells.forEach((th) => {
                th.style.display = '';
            });

            let rowsHtml = '';
            displayedInvoices.forEach((t) => {
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

                const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

                if (currentInvoicesView === 'operation') {

                    if (isFinancial) {

                        displayProduct = `<div title="حركة نقدية لـ: ${esc(t.partner || '-')}"><b>${esc(t.partner || '-')}</b> (حركة نقدية) • <small style="color:#888;">${esc(t.product !== 'أخرى' ? t.product : 'صرف/قبض نقدية')}</small></div>`;

                    } else {

                        displayProduct = `<div title="فاتورة رقم #${esc(t.invoiceId)} - اضغط على زر التفاصيل لرؤية الأصناف" style="display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap;"><b>${esc(t.partner || '-')}</b> (عدد ${t.itemsCount} أصناف) <button class="tool-btn" style="padding: 2px 6px; font-size: 0.7rem; background: #9b59b6; color:white; border-radius:10px; margin: 0; line-height: 1;" onclick="viewInvoiceItems('${esc(t.invoiceId || -1)}', '${esc(t.type)}')">📄 التفاصيل</button></div>`;

                    }

                } else {

                    const hoverTitle = `الصنف: ${esc(t.product || '-')}\nالكمية: ${t.qty || 0}\nالسعر: ${t.price || 0}\nالإجمالي: ${t.total || 0}\nالمخزن: ${esc(t.warehouse || '-')}`;

                    displayProduct = `<span title="${hoverTitle}" style="cursor:help; border-bottom:1px dotted #aaa;">${esc(t.product || '-')} ${(!isFinancial && t.qty) ? '(x' + t.qty + ')' : ''}</span>`;

                }

                const isRejectedTransfer = t.type && t.type.includes('تحويل') && t.transferStatus === 'rejected';

                const totalTextFinal = (t.total || t.price || 0);

                let paid = (t.paid !== undefined) ? (typeof t.paid === 'number' ? t.paid.toFixed(2) : t.paid) : parseFloat(totalTextFinal || 0).toFixed(2);

                let remaining = (t.remaining !== undefined) ? (typeof t.remaining === 'number' ? t.remaining.toFixed(2) : t.remaining) : 0;

                // إذا كانت العملية تحويلاً مخزنياً، نفترض أنها مدفوعة بالكامل (عملية داخلية) حتى لا تظهر في مديونية الفواتير
                if (t.type.includes('تحويل')) {
                    if (isRejectedTransfer) {
                        paid = '-';
                        remaining = '-';
                    } else {
                        paid = parseFloat(totalTextFinal || 0).toFixed(2);
                    }
                }

                const isV = (idx) => {
                    if (idx === 5 && !hasProfitPerm) return false;
                    return invoicesColumnVisibility[idx] !== false;
                };

                const displayTotalHtml = isRejectedTransfer
                    ? `<span style="text-decoration:line-through; color:#94a3b8; font-weight:normal;">${parseFloat(totalTextFinal || 0).toFixed(2)}</span> <span style="color:#dc2626; font-size:0.75rem; font-weight:900;">(ملغي)</span>`
                    : parseFloat(totalTextFinal || 0).toFixed(2);

                rowsHtml += `
                    <tr class="${isSelected ? 'selected-row' : ''}" style="${isRejectedTransfer ? 'background:#fff5f5; opacity:0.85;' : ''}" data-orig-index="${t.originalIndex}" onclick="selectInvoiceRow(${t.originalIndex}, this)" ondblclick="if(window.viewSelectedInvoice) window.viewSelectedInvoice();">
                        <td class="col-inv-0" style="${isV(0) ? '' : 'display:none;'}"><input type="radio" name="invRad" ${isSelected ? 'checked' : ''}></td>
                        <td class="col-inv-1" style="${isV(1) ? '' : 'display:none;'}">
                            <div style="display:flex; flex-direction:row; gap:4px; align-items:center; justify-content:center; flex-wrap:wrap;">
                                <span style="background:rgba(0,0,0,0.05); padding:2px 5px; border-radius:4px; font-weight:bold; font-size:0.75rem;">${t.invoiceId || '-'} ${t.is_returned ? '<span title="تم الإرجاع" style="color:#ef4444; margin-right:2px;">↩️</span>' : ''}</span>
                                ${isRejectedTransfer ? '<span style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:1px 5px; font-size:0.7rem; border-radius:4px; font-weight:900;">ملغي ❌</span>' : ''}
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
                                    if (t.transferStatus === 'pending') {
                                        return `<span class="stock-badge badge-transfer" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a;" title="تحويل مخزني معلق بانتظار الاستلام">🚚 تحويل (معلق ⏳)</span>`;
                                    } else if (t.transferStatus === 'rejected') {
                                        return `<span class="stock-badge badge-transfer" style="background:#fee2e2; color:#991b1b; border:1.5px solid #f87171; font-weight:900;" title="تحويل مخزني مرفوض وملغي - لم تنفذ العملية">❌ تحويل (مرفوض / ملغي)</span>`;
                                    }
                                    return `<span class="stock-badge badge-transfer" style="background:#dcfce7; color:#15803d; border:1px solid #86efac;" title="تحويل مخزني مستلم">🚚 تحويل (مستلم ✅)</span>`;
                                } else if (type.includes('تسوية')) {
                                    return `<span class="stock-badge badge-adj" title="تسوية مخزنية">⚖️ تسوية مخزنية</span>`;
                                }
                                return `<span class="stock-badge" style="background:#f1f5f9; color:#475569;">${type}</span>`;
                            })()}
                        </td>
                        <td class="col-inv-4" style="font-weight:bold; ${isV(4) ? '' : 'display:none;'}">${displayProduct}</td>
                        <td class="col-inv-5" style="color:${profitColor}; font-weight:bold; ${isV(5) ? '' : 'display:none;'}">${profitText}</td>
                        <td class="col-inv-6" style="${isV(6) ? '' : 'display:none;'}">
                            <span style="font-weight:800; color:#1e293b; font-size:0.83rem;">🏢 ${warehouse}</span>
                        </td>
                        <td class="col-inv-14" style="text-align:center; ${isV(14) ? '' : 'display:none;'}">
                            ${getTerminalBadgeHtml(t)}
                        </td>
                        <td class="col-inv-7" style="font-weight:bold; color:${isRejectedTransfer ? '#94a3b8' : 'var(--main-blue)'}; ${isV(7) ? '' : 'display:none;'}">${displayTotalHtml}</td>
                        <td class="col-inv-8" style="color:${isRejectedTransfer ? '#94a3b8' : 'blue'}; font-weight:bold; ${isV(8) ? '' : 'display:none;'}">${paid}</td>
                        <td class="col-inv-9" style="color:${isRejectedTransfer ? '#94a3b8' : 'red'}; font-weight:bold; ${isV(9) ? '' : 'display:none;'}">${remaining}</td>
                        <td class="col-inv-10" style="${isV(10) ? '' : 'display:none;'}">${esc(t.partner || '-')}</td>
                        <td class="col-inv-11" style="font-size:0.8rem; ${isV(11) ? '' : 'display:none;'}">${esc(t.user || '-')}</td>
                        <td class="col-inv-12" style="font-size:0.8rem; color: #888; ${isV(12) ? '' : 'display:none;'}">${esc(t.editDate || '-')}</td>
                        <td class="col-inv-13" style="${isV(13) ? '' : 'display:none;'}">${esc(t.notes || '-')}</td>
                    </tr>
                `;
            });

            if (hasMore) {
                rowsHtml += `
                    <tr id="invoicesLoadMoreRow" style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); text-align: center;">
                        <td colspan="15" style="padding: 16px; border-top: 2px dashed #cbd5e1;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap;">
                                <span style="font-weight: 800; color: #475569; font-size: 0.92rem;">
                                    📊 تم عرض <strong style="color: #2563eb; font-size: 1.05rem;">${displayedInvoices.length}</strong> من إجمالي <strong style="color: #1e293b; font-size: 1.05rem;">${totalMatchingInvoices}</strong> فاتورة
                                </span>
                                <button type="button" onclick="loadMoreInvoices(500)" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border: none; padding: 7px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.3); font-family: 'Cairo', sans-serif; transition: 0.2s;">
                                    ➕ عرض 500 أخرى
                                </button>
                                <button type="button" onclick="loadMoreInvoices(0)" style="background: white; color: #475569; border: 1.5px solid #cbd5e1; padding: 7px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; font-family: 'Cairo', sans-serif; transition: 0.2s;">
                                    ⚡ عرض الكل (${totalMatchingInvoices})
                                </button>
                            </div>
                        </td>
                    </tr>`;
            }

            tbody.innerHTML = rowsHtml || '<tr><td colspan="13" style="text-align:center; padding:20px;">لا توجد بيانات تطابق البحث</td></tr>';
        }

        // دالة لعرض تفاصيل الفاتورة في تنبيه أو نافذة

        async function viewInvoiceItems(invoiceId, type = '', autoPrint = false) {
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
            
            // ⚡ إذا لم تكن في الذاكرة (فاتورة قديمة)، نستدعيها من SQLite فوراً
            if (invoiceItems.length === 0 && typeof window.ensureInvoiceLoaded === 'function') {
                await window.ensureInvoiceLoaded(invoiceId);
                invoiceItems = transactions.filter(t => {
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
                if (category === 'sales' || category === 'purchase' || category === 'return_sales' || category === 'return_purchase') {
                    invoiceItems = invoiceItems.filter(t => t.type && !t.type.includes('قبض') && !t.type.includes('صرف'));
                }
            }

            if (invoiceItems.length === 0) return alert('خطأ: لم يتم العثور على تفاصيل الفاتورة.');
            
            let head = invoiceItems.find(t => t.isInvoiceHead) || invoiceItems[0];
            let tx = { ...head };
            tx.invoiceId = invoiceId;
            tx.warehouse = head.warehouse || 'المخزن الرئيسي';
            tx.terminal = head.terminal || 'الجهاز الرئيسي 💻';
            tx.partner = head.partner || head.customer || 'عميل نقدي';
            tx.method = head.method || head.paymentMethod || 'كاش (نقدي)';
            tx.notes = invoiceItems.find(t => t.notes)?.notes || tx.notes || '';

            // استخراج بيانات الخصم والإضافات الإجمالية للفاتورة
            const invDisc = parseFloat(head.invoiceDiscount != null ? head.invoiceDiscount : (head.discount != null ? head.discount : (head.discountAmount || 0))) || 0;
            const invDiscType = head.invoiceDiscountType || head.discountType || 'val';
            const invExtra = parseFloat(head.invoiceTax != null ? head.invoiceTax : (head.invoiceExtra != null ? head.invoiceExtra : (head.tax != null ? head.tax : (head.extra || head.addition || 0)))) || 0;
            const invExtraType = head.invoiceTaxType || head.invoiceExtraType || head.taxType || 'val';
            const invGrandTotal = parseFloat(head.invoiceGrandTotal != null ? head.invoiceGrandTotal : (head.finalTotal != null ? head.finalTotal : (head.grandTotal || 0))) || 0;

            tx.invoiceDiscount = invDisc;
            tx.discount = invDisc;
            tx.discountType = invDiscType;
            tx.invoiceDiscountType = invDiscType;
            tx.invoiceTax = invExtra;
            tx.extra = invExtra;
            tx.tax = invExtra;
            tx.invoiceTaxType = invExtraType;
            tx.invoiceGrandTotal = invGrandTotal;
            
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

            // تم إلغاء دمج الأصناف المتشابهة لعرض الفاتورة بنفس عدد السطور الأصلية تماماً مع رصد الخصم والإضافة بدقة
            tx.items = rawItems.map(i => {
                const qty = parseFloat(i.qty != null ? i.qty : (i.quantity || 0));
                const price = parseFloat(i.price != null ? i.price : (i.costPrice || i.purchasePrice || 0));
                let disc = parseFloat(i.discount != null ? i.discount : (i.itemDiscount != null ? i.itemDiscount : 0)) || 0;
                const discType = i.discountType || i.itemDiscountType || 'val';
                let addition = parseFloat(i.addition != null ? i.addition : (i.extra != null ? i.extra : 0)) || 0;
                const total = parseFloat(i.total != null ? i.total : (qty * price - disc + addition));
                
                // في حال عدم وجود خصم أو إضافة مسجل صراحة على السطر ولكن الإجمالي الفعلي يختلف عن (الكمية × السعر)
                if (disc === 0 && addition === 0 && qty > 0 && price > 0) {
                    const gross = qty * price;
                    if (gross > total + 0.01) {
                        disc = gross - total;
                    } else if (total > gross + 0.01) {
                        addition = total - gross;
                    }
                }

                return {
                    name: i.product || i.productName || i.name || 'صنف غير محدد',
                    qty: qty,
                    unit: i.unit || '-',
                    size: i.size || i.selectedSize || '',
                    color: i.color || i.selectedColor || '',
                    price: price,
                    discount: disc,
                    discountType: discType,
                    addition: addition,
                    extra: addition,
                    total: total
                };
            });
            
            // سحب المدفوع والمتبقي من رأس الفاتورة بشكل صحيح وموثوق
            tx.paid = parseFloat(head.paidAmount != null ? head.paidAmount : (head.paid != null ? head.paid : 0));
            if (isNaN(tx.paid)) tx.paid = 0;
            
            const headTotal = parseFloat(head.invoiceGrandTotal != null ? head.invoiceGrandTotal : (head.finalTotal != null ? head.finalTotal : (head.grandTotal || head.total || 0))) || 0;
            const isExplicitCredit = (head.method && (head.method.includes('آجل') || head.method.includes('أجل') || head.method.includes('ذمم') || head.method.includes('credit') || head.method.includes('تقسيط')));
            
            if (head.deferred != null && !isNaN(parseFloat(head.deferred)) && parseFloat(head.deferred) > 0.001) {
                tx.deferred = parseFloat(head.deferred);
            } else if (head.remaining != null && !isNaN(parseFloat(head.remaining)) && parseFloat(head.remaining) > 0.001) {
                tx.deferred = parseFloat(head.remaining);
            } else if (isExplicitCredit || (headTotal > tx.paid && tx.paid >= 0)) {
                tx.deferred = Math.max(0, headTotal - tx.paid);
            } else {
                tx.deferred = 0;
            }
            tx.remaining = tx.deferred;
            
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

            const items = transactions.filter(t => String(t.invoiceId) === String(invId));

            const isGoods = items.some(it => it.type.includes('بيع') || it.type.includes('شراء') || it.type.includes('تحويل') || it.type.includes('مرتجع'));

            const displayItems = isGoods ? items.filter(it => it.type.includes('بيع') || it.type.includes('شراء') || it.type.includes('تحويل') || it.type.includes('مرتجع')) : items;

            const head = displayItems[0] || items[0];

            let productOptions = '';

            if (typeof productsDB !== 'undefined') {

                productsDB.forEach(p => { productOptions += `<option value="${p.name}">`; });

            }

            let rowsHtml = '';

            displayItems.forEach((it, idx) => {

                const itSize = it.selectedSize || it.size || '';
                const itColor = it.selectedColor || it.color || '';
                const variantBadge = (itSize || itColor) 
                    ? `<div style="font-size:0.75rem; color:#4338ca; background:#e0e7ff; padding:2px 8px; border-radius:4px; margin-top:4px; display:inline-block; font-weight:700;">المقاس: ${itSize || '-'} | اللون: ${itColor || '-'}</div>` 
                    : '';

                rowsHtml += `

                <tr class="edit-row" data-id="${it.invoiceId}" data-tx-id="${it.id || ''}" data-product="${it.product}" data-size="${itSize}" data-color="${itColor}">

                    <td style="padding:10px; border:1px solid #ddd; background:#f9f9f9;">
                        <input type="text" class="edit-name-input" list="editItemsList" value="${it.product}" oninput="window.updateEditPrice(this)" style="width:100%; border:1px solid #ccc; padding:5px; border-radius:4px; font-weight:bold;">
                        ${variantBadge}
                    </td>

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

            const oldItems = transactions.filter(t => String(t.invoiceId) === String(invId));
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

            const affectedProducts = [];
            const updatedInvoiceRows = [];
            rows.forEach(row => {

                const originalProductName = row.dataset.product;

                const newProductName = row.querySelector('.edit-name-input').value.trim();

                const newQty = parseFloat(row.querySelector('.edit-q-input').value) || 0;

                const newPrice = parseFloat(row.querySelector('.edit-p-input').value) || 0;

                const newTotal = newQty * newPrice;

                // البحث عن السجل الأصلي لتعديله بدقة باستخدام معرف الحركة ID الفريد ثم التشكيلة
                const txId = row.dataset.txId;
                const rowSize = row.dataset.size || '';
                const rowColor = row.dataset.color || '';

                let transaction = txId ? transactions.find(t => String(t.id) === String(txId)) : null;
                if (!transaction) {
                    transaction = transactions.find(t => 
                        String(t.invoiceId) === String(invId) && 
                        t.product === originalProductName &&
                        (!rowSize || (t.size || t.selectedSize) === rowSize) &&
                        (!rowColor || (t.color || t.selectedColor) === rowColor)
                    ) || transactions.find(t => String(t.invoiceId) === String(invId) && t.product === originalProductName);
                }

                if (transaction) {
                    updatedInvoiceRows.push(transaction);

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

                    // حساب الربح الجديد بناءً على التكلفة (مع مراعاة تكلفة المقاس المخصص في الفاشون)

                    const p = productsDB.find(x => x.name === newProductName);

                    if (p) {
                        if (!affectedProducts.includes(p)) affectedProducts.push(p);

                        let effCost = parseFloat(p.cost) || 0;
                        const sSize = String(transaction.selectedSize || transaction.size || rowSize || '').trim();
                        const sColor = String(transaction.selectedColor || transaction.color || rowColor || '').trim();

                        if (p.variants && Array.isArray(p.variants) && (sSize || sColor)) {
                            const matchedVarForCost = p.variants.find(v => 
                                (!sSize || String(v.size || '').trim() === sSize) && 
                                (!sColor || String(v.color || '').trim() === sColor)
                            );
                            if (matchedVarForCost && matchedVarForCost.cost) {
                                effCost = parseFloat(matchedVarForCost.cost) || effCost;
                            }
                        }

                        const factor = parseFloat(transaction.unitFactor) || 1;

                        const totalCost = effCost * newQty * factor;

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

            if (typeof window.saveTransactionChanges === 'function') {
                await window.saveTransactionChanges({
                    newTransactions: updatedInvoiceRows,
                    modifiedProducts: affectedProducts,
                    modifiedAccounts: []
                });
            } else {
                await saveData();
            }

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
                    window.isEditMode = true;
                    editingInvoiceId = invId;
                    window.editingInvoiceId = invId;

                    let timeVal = head.timeISO || t.timeISO || '';
                    let dateVal = head.dateISO || t.dateISO || '';

                    if (dateVal) {
                        dateVal = String(dateVal).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
                        if (dateVal.includes('T')) dateVal = dateVal.split('T')[0];
                        if (dateVal.includes(' ')) dateVal = dateVal.split(' ')[0];
                        const dmy = dateVal.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
                        if (dmy) {
                            dateVal = `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
                        }
                    }

                    // استخراج التاريخ بدقة بصيغة YYYY-MM-DD في حال عدم وجود dateISO صريح
                    if (!dateVal && t.date) {
                        const normalized = String(t.date).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d\/-]/g, ' ').trim();
                        const isoMatch = normalized.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
                        if (isoMatch) {
                            dateVal = `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;
                        } else {
                            const dmyMatch = normalized.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
                            if (dmyMatch) {
                                dateVal = `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, '0')}-${String(dmyMatch[1]).padStart(2, '0')}`;
                            }
                        }
                    }

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
                    editingOriginalDate = {
                        full: t.date || (dateVal ? `${dateVal} ${timeVal}` : new Date().toLocaleString('ar-EG')),
                        iso: dateVal || t.dateISO || new Date().toLocaleDateString('en-CA'),
                        time: timeVal || t.timeISO || new Date().toTimeString().slice(0, 5)
                    };
                    window.editingOriginalDate = editingOriginalDate;
                    editingInvoiceType = t.type;
                    window.editingInvoiceType = t.type;
                    window.editingOriginalPartner = partnerName;
                    window.editingOriginalMethod = paymentMethod;
                    window.editingOriginalUser = t.user || '';
                    editingOriginalItems = JSON.parse(JSON.stringify(invItems)); // نسخة أصلية للعكس والمطابقة
                    window.editingOriginalItems = editingOriginalItems;

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
                                    if (typeof window.isVodafonePaymentMethod === 'function' && window.isVodafonePaymentMethod(paymentMethod)) {
                                        matchedOpt = Array.from(methodSelect.options).find(o => window.isVodafonePaymentMethod(o.value) || window.isVodafonePaymentMethod(o.text));
                                    } else if (paymentMethod.includes('آجل') || paymentMethod.includes('اجل')) {
                                        matchedOpt = Array.from(methodSelect.options).find(o => o.value.includes('آجل') || o.value.includes('اجل'));
                                    } else if (paymentMethod.includes('تحويل') || paymentMethod.includes('بنك') || paymentMethod.includes('شيك') || paymentMethod.includes('فيزا') || paymentMethod.includes('شبكة')) {
                                        matchedOpt = Array.from(methodSelect.options).find(o => o.value.includes('تحويل') || o.value.includes('بنك') || o.value.includes('شيك'));
                                    } else {
                                        matchedOpt = Array.from(methodSelect.options).find(o => {
                                            const isNon = (typeof window.isNonCashPaymentMethod === 'function') ? window.isNonCashPaymentMethod(o.value) : false;
                                            return !isNon && (o.value.includes('نقدي') || o.value.includes('كاش'));
                                        });
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
                                    if (typeof window.isVodafonePaymentMethod === 'function' && window.isVodafonePaymentMethod(paymentMethod)) {
                                        matchedOpt = Array.from(purMethodSelect.options).find(o => window.isVodafonePaymentMethod(o.value) || window.isVodafonePaymentMethod(o.text));
                                    } else if (paymentMethod.includes('آجل') || paymentMethod.includes('اجل')) {
                                        matchedOpt = Array.from(purMethodSelect.options).find(o => o.value.includes('آجل') || o.value.includes('اجل'));
                                    } else if (paymentMethod.includes('شيك') || paymentMethod.includes('تحويل') || paymentMethod.includes('بنك')) {
                                        matchedOpt = Array.from(purMethodSelect.options).find(o => o.value.includes('شيك') || o.value.includes('تحويل') || o.value.includes('بنك'));
                                    } else {
                                        matchedOpt = Array.from(purMethodSelect.options).find(o => {
                                            const isNon = (typeof window.isNonCashPaymentMethod === 'function') ? window.isNonCashPaymentMethod(o.value) : false;
                                            return !isNon && (o.value.includes('نقدي') || o.value.includes('كاش'));
                                        });
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
                                if (!matchedOpt && typeof window.isVodafonePaymentMethod === 'function' && window.isVodafonePaymentMethod(paymentMethod)) {
                                    matchedOpt = Array.from(returnMethodSelect.options).find(o => window.isVodafonePaymentMethod(o.value) || window.isVodafonePaymentMethod(o.text));
                                }
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
                                if (!matchedOpt && typeof window.isVodafonePaymentMethod === 'function' && window.isVodafonePaymentMethod(paymentMethod)) {
                                    matchedOpt = Array.from(purReturnMethodSelect.options).find(o => window.isVodafonePaymentMethod(o.value) || window.isVodafonePaymentMethod(o.text));
                                }
                                if (matchedOpt) purReturnMethodSelect.value = matchedOpt.value;
                                if (typeof selectMethod === 'function') selectMethod(purReturnMethodSelect);
                            }

                            renderPurReturnCart();
                            if (typeof calculatePurReturnTotals === 'function') calculatePurReturnTotals();
                            if (typeof saveCurrentTabState === 'function') saveCurrentTabState();

                        } else if (section === 'transfer') {

                            window.transferItemsBatch = invItems.filter(x => x.product).map(it => {
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
                            transferItemsBatch = window.transferItemsBatch;

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

                            const rMethodSelect = document.getElementById('receiptTreasurySelect') || document.getElementById('receiptMethodSelect') || document.getElementById('receiptPaymentMethod');
                            if (rMethodSelect) {
                                if (rMethodSelect.options.length === 0 && typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
                                let opt = Array.from(rMethodSelect.options).find(o => o.value === paymentMethod || o.text.trim() === paymentMethod);
                                if (!opt && typeof window.isVodafonePaymentMethod === 'function' && window.isVodafonePaymentMethod(paymentMethod)) {
                                    opt = Array.from(rMethodSelect.options).find(o => window.isVodafonePaymentMethod(o.value) || window.isVodafonePaymentMethod(o.text));
                                }
                                if (opt) rMethodSelect.value = opt.value;
                                else rMethodSelect.value = paymentMethod || 'كاش (نقدي)';
                            }

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

                            const dMethodSelect = document.getElementById('disburseTreasurySelect') || document.getElementById('disburseMethodSelect') || document.getElementById('disbursePaymentMethod');
                            if (dMethodSelect) {
                                if (dMethodSelect.options.length === 0 && typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
                                let opt = Array.from(dMethodSelect.options).find(o => o.value === paymentMethod || o.text.trim() === paymentMethod);
                                if (!opt && typeof window.isVodafonePaymentMethod === 'function' && window.isVodafonePaymentMethod(paymentMethod)) {
                                    opt = Array.from(dMethodSelect.options).find(o => window.isVodafonePaymentMethod(o.value) || window.isVodafonePaymentMethod(o.text));
                                }
                                if (opt) dMethodSelect.value = opt.value;
                                else dMethodSelect.value = paymentMethod || 'كاش (نقدي)';
                            }

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
                                const baseAdjDiff = (parseFloat(it.qty) || 0) * factor;

                                let liveStock = 0;
                                if (p) {
                                    if (p.variants && Array.isArray(p.variants)) {
                                        const sSize = it.selectedSize || it.size || '';
                                        const sColor = it.selectedColor || it.color || '';
                                        const matchedVar = p.variants.find(v => (!sSize || v.size === sSize) && (!sColor || v.color === sColor));
                                        if (matchedVar) {
                                            liveStock = (matchedVar.warehouseStocks && matchedVar.warehouseStocks[activeWH] !== undefined)
                                                ? (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0)
                                                : (activeWH === 'المخزن الرئيسي' ? (parseFloat(matchedVar.stock) || 0) : 0);
                                        } else {
                                            liveStock = typeof getWarehouseStock === 'function' ? getWarehouseStock(p.name, activeWH) : (parseFloat(p.stock) || 0);
                                        }
                                    } else {
                                        liveStock = typeof getWarehouseStock === 'function' ? getWarehouseStock(p.name, activeWH) : (parseFloat(p.stock) || 0);
                                    }
                                }

                                // في التسوية: الفرق = الفعلي - الدفتري، وبالتالي: الدفتري = الحالي - الفرق، والفعلي المجرود = الدفتري + الفرق = الحالي
                                let origStockBefore = (liveStock - baseAdjDiff) / factor;
                                let origCountedQty = origStockBefore + (parseFloat(it.qty) || 0);

                                if (it.notes && typeof it.notes === 'string') {
                                    const actualMatch = it.notes.match(/فعلي\s+([\d.-]+)/);
                                    const bookMatch = it.notes.match(/دفتري\s+([\d.-]+)/);
                                    if (actualMatch && !isNaN(parseFloat(actualMatch[1]))) {
                                        origCountedQty = parseFloat(actualMatch[1]) / factor;
                                    }
                                    if (bookMatch && !isNaN(parseFloat(bookMatch[1]))) {
                                        origStockBefore = parseFloat(bookMatch[1]) / factor;
                                    }
                                }

                                return {
                                    id: p ? p.id : (Date.now() + Math.random()),
                                    name: it.product,
                                    code: (p && p.variants && (it.selectedSize || it.size)) ? (p.variants.find(v => (v.size === (it.selectedSize || it.size) && (!it.color || v.color === (it.selectedColor || it.color))))?.barcode || p.code) : (p ? p.code : ''),
                                    selectedSize: it.selectedSize || it.size || '',
                                    selectedColor: it.selectedColor || it.color || '',
                                    size: it.selectedSize || it.size || '',
                                    color: it.selectedColor || it.color || '',
                                    qty: Math.max(0, origCountedQty),
                                    price: parseFloat(it.price) || 0,
                                    unit: it.unit || 'قطعة',
                                    unitFactor: factor,
                                    selectedUnit: u,
                                    units: p ? (p.units || []) : [],
                                    stock: origStockBefore,
                                    notes: it.notes || ''
                                };
                            });

                            window.adjCart = adjCart;

                            if (document.getElementById('adjBadgeID')) document.getElementById('adjBadgeID').innerText = invId;
                            if (document.getElementById('adjDate')) document.getElementById('adjDate').value = dateVal || t.dateISO || '';
                            if (document.getElementById('adjTime')) document.getElementById('adjTime').value = timeVal || t.timeISO || '';

                            if (typeof renderAdjTable === 'function') renderAdjTable();

                        }

                        // تأكيد متغيرات وضع التعديل عالمياً داخل التبويب
                        isEditMode = true;
                        window.isEditMode = true;
                        editingInvoiceId = invId;
                        window.editingInvoiceId = invId;
                        editingOriginalDate = {
                            full: t.date || (dateVal ? `${dateVal} ${timeVal}` : new Date().toLocaleString('ar-EG')),
                            iso: dateVal || t.dateISO || new Date().toLocaleDateString('en-CA'),
                            time: timeVal || t.timeISO || new Date().toTimeString().slice(0, 5)
                        };
                        window.editingOriginalDate = editingOriginalDate;
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

        // دالة موحدة لمطابقة نوع الفاتورة والحركة بدقة لمنع تداخل البيع مع المرتجع
        window.isMatchingInvoiceType = function(txType, targetType) {
            if (!targetType) return true;
            if (!txType) return false;
            const sTx = String(txType).trim();
            const sTarget = String(targetType).trim();
            const isTargetReturn = sTarget.includes('مرتجع');
            const isTxReturn = sTx.includes('مرتجع');
            if (isTargetReturn !== isTxReturn) return false;
            if (sTarget.includes('بيع') && sTx.includes('بيع')) return true;
            if (sTarget.includes('شراء') && sTx.includes('شراء')) return true;
            if (sTarget.includes('تسوية') && sTx.includes('تسوية')) return true;
            if (sTarget.includes('تحويل') && sTx.includes('تحويل')) return true;
            if (sTarget.includes('قبض') && sTx.includes('قبض')) return true;
            if (sTarget.includes('صرف') && sTx.includes('صرف')) return true;
            return sTx.includes(sTarget) || sTarget.includes(sTx);
        };

        // دالة مساعدة لتنفيذ منطق الحذف في التعديل (تحتاج لاستدعاء من الحفظ)
        window.revertAndClearOldInvoice = async function(invId, type) {
            if (!invId) return;

            const cleanType = type ? String(type).replace(/📤|📥|↩️|⚖️/g, '').trim() : '';

            // إذا لم تكن editingOriginalItems محملة، نحاول جلب السجلات القديمة من transactions مع مطابقة دقيقة للنوع
            const oldItems = (typeof editingOriginalItems !== 'undefined' && editingOriginalItems && editingOriginalItems.length > 0) ? 
                editingOriginalItems : 
                (typeof transactions !== 'undefined' && Array.isArray(transactions) ? transactions.filter(t => {
                    const hasInvId = t.invoiceId != null && t.invoiceId !== '';
                    const isMatch = hasInvId ? (String(t.invoiceId) === String(invId)) : (String(t.id) === String(invId));
                    return isMatch && (!cleanType || window.isMatchingInvoiceType(t.type, cleanType));
                }) : []);

            // إنشاء نسخة حماية سريعة في الذاكرة (Fail-Safe Snapshot) قبل أي مساس بالمخزن أو الحركات
            const affectedProductIdentifiers = new Set();
            oldItems.forEach(it => {
                if (it) {
                    if (it.productId) affectedProductIdentifiers.add(String(it.productId));
                    if (it.product) affectedProductIdentifiers.add(String(it.product));
                }
            });

            const backupProducts = [];
            if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
                productsDB.forEach(p => {
                    if (p && (affectedProductIdentifiers.has(String(p.id)) || affectedProductIdentifiers.has(String(p.name)))) {
                        backupProducts.push(JSON.parse(JSON.stringify(p)));
                    }
                });
            }

            window._revertedInvoiceBackup = {
                invId: invId,
                type: type,
                cleanType: cleanType,
                oldItems: JSON.parse(JSON.stringify(oldItems)),
                backupProducts: backupProducts,
                timestamp: Date.now()
            };

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
                        // لا يتم تعديل أو عكس الأرصدة إلا إذا كان التحويل قد تم استلامه بالفعل (received)
                        // أما إذا كان معلقاً (pending) فلم يخصم أصلاً من المخزن المصدر
                        if (item.transferStatus === 'received') {
                            const srcWH = (item.sourceWarehouse || defaultWH || 'المخزن الرئيسي').trim();
                            const dstWH = (item.warehouse || '').trim();
                            if (!p.warehouseStocks) p.warehouseStocks = {};
                            p.warehouseStocks[srcWH] = (parseFloat(p.warehouseStocks[srcWH]) || 0) + baseQty;
                            if (dstWH) {
                                p.warehouseStocks[dstWH] = Math.max(0, (parseFloat(p.warehouseStocks[dstWH]) || 0) - baseQty);
                            }
                            if (srcWH === 'المخزن الرئيسي') p.stock = p.warehouseStocks[srcWH];
                            if (dstWH === 'المخزن الرئيسي') p.stock = p.warehouseStocks[dstWH];
                        }
                    }

                    // عكس رصيد التشكيلة (المقاس واللون) في مصفوفة الصنف بدقة
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
                                if (!matchedVar.warehouseStocks || typeof matchedVar.warehouseStocks !== 'object') matchedVar.warehouseStocks = {};
                                if (itType.includes('مرتجع بيع')) {
                                    matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                    matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                } else if (itType.includes('مرتجع شراء')) {
                                    matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                    matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                } else if (itType.includes('بيع')) {
                                    matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                    matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                } else if (itType.includes('شراء')) {
                                    matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                    matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                } else if (itType.includes('تسوية') || itType.includes('جرد') || itType.includes('adj')) {
                                    matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                    matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                } else if (itType.includes('تحويل')) {
                                    if (item.transferStatus === 'received') {
                                        const srcWH = (item.sourceWarehouse || defaultWH || 'المخزن الرئيسي').trim();
                                        const dstWH = (item.warehouse || '').trim();
                                        if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                                        matchedVar.warehouseStocks[srcWH] = (parseFloat(matchedVar.warehouseStocks[srcWH]) || 0) + baseQty;
                                        if (dstWH) matchedVar.warehouseStocks[dstWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[dstWH]) || 0) - baseQty);
                                        if (srcWH === 'المخزن الرئيسي') matchedVar.stock = matchedVar.warehouseStocks[srcWH];
                                        if (dstWH === 'المخزن الرئيسي') matchedVar.stock = matchedVar.warehouseStocks[dstWH];
                                    }
                                }
                            }
                        }
                        if (p.variants.length > 0) {
                            p.stock = p.variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
                            p.warehouseStocks[activeWH] = p.variants.reduce((sum, v) => {
                                const vWh = (v.warehouseStocks && v.warehouseStocks[activeWH] !== undefined)
                                    ? parseFloat(v.warehouseStocks[activeWH])
                                    : (activeWH === 'المخزن الرئيسي' ? (parseFloat(v.stock) || 0) : 0);
                                return sum + (isNaN(vWh) ? 0 : vWh);
                            }, 0);
                        }
                    }

                }

            });

            // 2. حذف السجلات القديمة من الذاكرة بدقة بدون حذف سجلات أخرى تحمل نفس الـ id التلقائي
            if (typeof transactions !== 'undefined' && Array.isArray(transactions)) {
                transactions = transactions.filter(t => {
                    const hasInvId = t.invoiceId != null && t.invoiceId !== '';
                    const isMatch = hasInvId ? (String(t.invoiceId) === String(invId)) : (String(t.id) === String(invId));
                    return !(isMatch && (!cleanType || window.isMatchingInvoiceType(t.type, cleanType)));
                });
            }

            // 3. مسح كاش أرصدة المخازن والحسابات فوراً
            if (typeof invalidateStockCache === 'function') invalidateStockCache();
            if (typeof window.invalidateAccountBalancesCache === 'function') window.invalidateAccountBalancesCache();
            window.accountBalancesCache = {};

            // 4. الحذف الفعلي والنهائي من قاعدة البيانات لمنع التكرار (الدبلرة) عند التعديل
            try {

                if (typeof db !== 'undefined' && db.transactions) {
                    await db.transactions.where('invoiceId').equals(invId.toString()).filter(t => !cleanType || window.isMatchingInvoiceType(t.type, cleanType)).delete();

                    if (!isNaN(Number(invId))) {
                        await db.transactions.where('invoiceId').equals(Number(invId)).filter(t => !cleanType || window.isMatchingInvoiceType(t.type, cleanType)).delete();
                    }
                }

            } catch (e) {

                console.warn("⚠️ فشل الحذف المباشر من القاعدة، سيتم الاعتماد على الحفظ الكلي لاحقاً:", e);

            }

        };

        // 🛡️ آلية حزام الأمان والتراجع التلقائي في حال تعثر حفظ التعديل (Fail-Safe Rollback)
        window.rollbackLastRevertedInvoice = async function() {
            if (!window._revertedInvoiceBackup) return false;

            const backup = window._revertedInvoiceBackup;
            console.warn(`🛡️ تفعيل حزام الأمان: جاري استعادة الفاتورة الأصلية #${backup.invId}...`);

            try {
                // 1. استعادة حالة المنتجات كما كانت قبل التعديل في الذاكرة
                if (backup.backupProducts && Array.isArray(backup.backupProducts) && typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
                    backup.backupProducts.forEach(savedP => {
                        const targetP = productsDB.find(p => p && (p.id === savedP.id || p.name === savedP.name));
                        if (targetP) {
                            Object.assign(targetP, JSON.parse(JSON.stringify(savedP)));
                        }
                    });

                    // تحديث المنتجات في SQLite إن وُجد
                    if (typeof db !== 'undefined' && db.products && typeof db.products.bulkPut === 'function') {
                        try {
                            await db.products.bulkPut(backup.backupProducts);
                        } catch (pErr) {
                            console.warn("⚠️ تعذر تحديث المنتجات المستعادة في SQLite مباشرة:", pErr);
                        }
                    }
                }

                // 2. إعادة إدراج حركات الفاتورة القديمة بالكامل في مصفوفة transactions
                if (backup.oldItems && Array.isArray(backup.oldItems) && backup.oldItems.length > 0) {
                    if (typeof transactions !== 'undefined' && Array.isArray(transactions)) {
                        // تصفية أي سجلات قديمة أو جزئية لنفس الفاتورة لضمان عدم التكرار
                        transactions = transactions.filter(t => {
                            const hasInvId = t.invoiceId != null && t.invoiceId !== '';
                            const isMatch = hasInvId ? (String(t.invoiceId) === String(backup.invId)) : (String(t.id) === String(backup.invId));
                            return !(isMatch && (!backup.cleanType || window.isMatchingInvoiceType(t.type, backup.cleanType)));
                        });

                        // إعادة الصفوف الأصلية بحالتها
                        backup.oldItems.forEach(origRow => {
                            transactions.push(JSON.parse(JSON.stringify(origRow)));
                        });
                    }

                    // إعادة إدراج السجلات في SQLite
                    if (typeof db !== 'undefined' && db.transactions && typeof db.transactions.bulkPut === 'function') {
                        try {
                            await db.transactions.bulkPut(backup.oldItems);
                        } catch (tErr) {
                            console.warn("⚠️ تعذر إعادة السجلات إلى SQLite:", tErr);
                        }
                    }
                }

                // 3. إبطال الكاش لإعادة حساب الأرصدة بدقة تامة
                if (typeof invalidateStockCache === 'function') invalidateStockCache();
                if (typeof window.invalidateStockCache === 'function') window.invalidateStockCache();
                if (typeof window.invalidateAccountBalancesCache === 'function') window.invalidateAccountBalancesCache();
                window.accountBalancesCache = {};

                // 4. تنظيف كائن النسخة الاحتياطية
                window._revertedInvoiceBackup = null;
                console.log(`✅ تم استرجاع الفاتورة الأصلية #${backup.invId} بنجاح تام 100%.`);
                return true;
            } catch (rbErr) {
                console.error("❌ فشل استرجاع الفاتورة السابقة:", rbErr);
                return false;
            }
        };

        // مسح نسخة الأمان بعد نجاح حفظ التعديل بشكل نهائي
        window.clearRevertedInvoiceBackup = function() {
            window._revertedInvoiceBackup = null;
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

                        const invId = (t.invoiceId != null && t.invoiceId !== '') ? String(t.invoiceId) : null;

                        // تصفية السجلات المراد حذفها باستخدام مطابقة دقيقة للنوع لمنع حذف المرتجعات عند حذف المبيعات
                        const itemsToRemove = invId ? transactions.filter(x => String(x.invoiceId) === invId && window.isMatchingInvoiceType(x.type, t.type)) : [t];

                        // 🗑️ نقل للقمامة قبل الحذف

                        const label = invId ? `فاتورة #${invId} (${t.type})` : `حركة: ${t.product || t.type}`;

                        await trashManager.moveToTrash(itemsToRemove, 'transaction', label);

                        const affectedRevertProducts = [];
                        // 1. عكس المخزن
                        itemsToRemove.forEach(item => {

                            const p = productsDB.find(p => p && (p.name === item.product || p.id === item.productId || p.id === item.product));

                            if (p) {
                                if (!affectedRevertProducts.includes(p)) affectedRevertProducts.push(p);

                                let factor = parseFloat(item.unitFactor) || 1;

                                if (item.unit && p.units) {

                                    const u = p.units.find(u => u && u.unitName === item.unit);

                                    if (u) factor = parseFloat(u.factor) || 1;

                                }

                                const baseQty = parseFloat(item.qty) * factor;

                                const activeWH = (item.warehouse || item.sourceWarehouse || (t && t.warehouse ? t.warehouse : '') || 'المخزن الرئيسي').trim();
                                if (!p.warehouseStocks) p.warehouseStocks = {};

                                const itType = String(item.type || (t && t.type) || '');

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
                                    if (item.transferStatus === 'received') {
                                        const srcWH = (item.sourceWarehouse || 'المخزن الرئيسي').trim();
                                        const dstWH = (item.warehouse || '').trim();
                                        if (!p.warehouseStocks) p.warehouseStocks = {};
                                        p.warehouseStocks[srcWH] = (parseFloat(p.warehouseStocks[srcWH]) || 0) + baseQty;
                                        if (dstWH) {
                                            p.warehouseStocks[dstWH] = Math.max(0, (parseFloat(p.warehouseStocks[dstWH]) || 0) - baseQty);
                                        }
                                        if (srcWH === 'المخزن الرئيسي') p.stock = p.warehouseStocks[srcWH];
                                        if (dstWH === 'المخزن الرئيسي') p.stock = p.warehouseStocks[dstWH];
                                    }
                                }

                                // عكس رصيد التشكيلة (المقاس واللون) في مصفوفة الصنف عند الحذف
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
                                            if (!matchedVar.warehouseStocks || typeof matchedVar.warehouseStocks !== 'object') matchedVar.warehouseStocks = {};
                                            if (itType.includes('مرتجع بيع')) {
                                                matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                                matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                            } else if (itType.includes('مرتجع شراء')) {
                                                matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                                matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                            } else if (itType.includes('بيع')) {
                                                matchedVar.stock = (parseFloat(matchedVar.stock) || 0) + baseQty;
                                                matchedVar.warehouseStocks[activeWH] = (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) + baseQty;
                                            } else if (itType.includes('شراء')) {
                                                matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                                matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                            } else if (itType.includes('تسوية') || itType.includes('جرد') || itType.includes('adj')) {
                                                matchedVar.stock = Math.max(0, (parseFloat(matchedVar.stock) || 0) - baseQty);
                                                matchedVar.warehouseStocks[activeWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[activeWH]) || 0) - baseQty);
                                            } else if (itType.includes('تحويل')) {
                                                if (item.transferStatus === 'received') {
                                                    const srcWH = (item.sourceWarehouse || 'المخزن الرئيسي').trim();
                                                    const dstWH = (item.warehouse || '').trim();
                                                    if (!matchedVar.warehouseStocks) matchedVar.warehouseStocks = {};
                                                    matchedVar.warehouseStocks[srcWH] = (parseFloat(matchedVar.warehouseStocks[srcWH]) || 0) + baseQty;
                                                    if (dstWH) matchedVar.warehouseStocks[dstWH] = Math.max(0, (parseFloat(matchedVar.warehouseStocks[dstWH]) || 0) - baseQty);
                                                    if (srcWH === 'المخزن الرئيسي') matchedVar.stock = matchedVar.warehouseStocks[srcWH];
                                                    if (dstWH === 'المخزن الرئيسي') matchedVar.stock = matchedVar.warehouseStocks[dstWH];
                                                }
                                            }
                                        }
                                    }
                                    if (p.variants.length > 0) {
                                        p.stock = p.variants.reduce((sum, v) => sum + (parseFloat(v.stock) || 0), 0);
                                        p.warehouseStocks[activeWH] = p.variants.reduce((sum, v) => {
                                            const vWh = (v.warehouseStocks && v.warehouseStocks[activeWH] !== undefined)
                                                ? parseFloat(v.warehouseStocks[activeWH])
                                                : (activeWH === 'المخزن الرئيسي' ? (parseFloat(v.stock) || 0) : 0);
                                            return sum + (isNaN(vWh) ? 0 : vWh);
                                        }, 0);
                                    }
                                }

                            }

                        });

                        // 2. الحذف من المصفوفة والتحقق من الربط لتنظيف علامة الإرجاع

                        const originalInvIdToClean = itemsToRemove.find(it => it.originalInvoiceId)?.originalInvoiceId;

                        const originalTypeToClean = itemsToRemove[0]?.type.includes('بيع') ? 'بيع' : 'شراء';

                        if (invId) {

                            transactions = transactions.filter(x => !(String(x.invoiceId) === invId && window.isMatchingInvoiceType(x.type, t.type)));

                            // 🛑 الحذف النهائي من قاعدة البيانات

                            const invIdStr = invId.toString();

                            const invIdNum = !isNaN(Number(invId)) ? Number(invId) : null;
                            const searchKeys = invIdNum !== null ? [invIdStr, invIdNum] : [invIdStr];

                            // البحث عن المعرفات الفرعية (id) في قاعدة البيانات لهذه السجلات

                            const dbItems = await db.transactions

                                .where('invoiceId').anyOf(searchKeys)

                                .toArray();

                            // فلترة السجلات التي تطابق النوع بدقة لضمان عدم حذف المرتجعات عند حذف المبيعات

                            const idsToDelete = dbItems

                                .filter(x => window.isMatchingInvoiceType(x.type, t.type))

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

                        if (typeof db !== 'undefined' && db && db.products && affectedRevertProducts.length > 0) {
                            await db.products.bulkPut(affectedRevertProducts);
                        } else if (typeof saveData === 'function') {
                            await saveData();
                        }

                        if (window.BayanNetworkHub && typeof window.BayanNetworkHub.onDataSaved === 'function') {
                            window.BayanNetworkHub.onDataSaved();
                        }

                        if (typeof invalidateStockCache === 'function') invalidateStockCache();
                        if (typeof window.invalidateStockCache === 'function') window.invalidateStockCache();
                        if (typeof window.invalidateAccountBalancesCache === 'function') window.invalidateAccountBalancesCache();
                        window.accountBalancesCache = {};

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
                if (type.includes('مرتجع بيع')) cleanType = 'مرتجع بيع';
                else if (type.includes('مرتجع شراء')) cleanType = 'مرتجع شراء';
                else if (type.includes('بيع')) cleanType = 'بيع';
                else if (type.includes('شراء')) cleanType = 'شراء';
                else if (type.includes('قبض')) cleanType = 'قبض';
                else if (type.includes('صرف')) cleanType = 'صرف';
                else if (type.includes('تحويل')) cleanType = 'تحويل';
                else if (type.includes('تسوية')) cleanType = 'تسوية';

                filterEl.value = cleanType;

                document.querySelectorAll('.invoice-tab').forEach(btn => {
                    const bTxt = btn.innerText.trim();
                    btn.classList.toggle('active', cleanType === 'all' ? bTxt.includes('الكل') : bTxt.includes(cleanType));
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
