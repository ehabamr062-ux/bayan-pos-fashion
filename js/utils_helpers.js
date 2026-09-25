// ============================================================
//  الأدوات والدوال المساعدة العامة والتنبيهات (General Helpers & UI Alerts)
// ============================================================
        // 🛡️ دوال التطهير والتعقيم الأمني ضد ثغرات الحقن (XSS Protection)
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
        window.escapeHtml = escapeHtml;

        function sanitizeInput(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
                .replace(/on\w+\s*=\s*[^>\s]+/gi, '')
                .replace(/javascript\s*:/gi, '')
                .trim();
        }
        window.sanitizeInput = sanitizeInput;

        // دالة التأخير (Debounce) لتحسين الأداء عند الكتابة في خانات البحث
        function debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        // --- النسخ المؤجلة (Debounced Versions) للوظائف المكثفة ---
        const debouncedHandleSearch = debounce((val) => { if (typeof handleSearch === 'function') handleSearch(val); }, 120);
        const debouncedHandleReturnSearch = debounce((val, type) => { if (typeof handleReturnSearch === 'function') handleReturnSearch(val, type); }, 200);
        const debouncedHandleCustomerSearch = debounce((val) => { if (typeof handleCustomerSearch === 'function') handleCustomerSearch(val); }, 150);
        const debouncedRenderInventoryTable = debounce(() => { if (typeof renderInventoryTable === 'function') renderInventoryTable(); }, 250);
        const debouncedHandlePriceAdjSearch = debounce(() => { if (typeof handlePriceAdjSearch === 'function') handlePriceAdjSearch(); }, 200);
        const debouncedHandleSupplierSearch = debounce((val) => { if (typeof handleSupplierSearch === 'function') handleSupplierSearch(val); }, 150);
        const debouncedHandlePurchaseSearch = debounce((val) => { if (typeof handlePurchaseSearch === 'function') handlePurchaseSearch(val); }, 120);

        window.debouncedHandleSearch = debouncedHandleSearch;
        window.debouncedHandleReturnSearch = debouncedHandleReturnSearch;
        window.debouncedHandleCustomerSearch = debouncedHandleCustomerSearch;
        window.debouncedRenderInventoryTable = debouncedRenderInventoryTable;
        window.debouncedHandlePriceAdjSearch = debouncedHandlePriceAdjSearch;
        window.debouncedHandleSupplierSearch = debouncedHandleSupplierSearch;
        window.debouncedHandlePurchaseSearch = debouncedHandlePurchaseSearch;

        // ============================================================
        //  محرك البحث الذكي الموحد والمرتب للأصناف (Smart Ranked Product Search)
        // ============================================================
        const _digitMap = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
        function normalizeSearchQuery(text) {
            if (text === null || text === undefined) return '';
            let s = String(text).trim().toLowerCase();
            s = s.replace(/[٠-٩۰-۹]/g, d => _digitMap[d] || d);
            
            // تطبيع الحروف العربية وإزالة التشكيل والتطويل
            return s
                .replace(/[أإآٱ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/[ىي]/g, 'ي')
                .replace(/ؤ/g, 'و')
                .replace(/ئ/g, 'ي')
                .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة علامات التشكيل
                .replace(/\u0640/g, '') // إزالة التطويل (الكشيدة)
                .replace(/\s+/g, ' ');
        }
        window.normalizeSearchQuery = normalizeSearchQuery;

        function getProductSearchTokens(p) {
            const currentVer = p.editDate || p.updatedAt || p.price || 1;
            if (p._searchTokens && p._searchTokensVer === currentVer) {
                return p._searchTokens;
            }
            const rawName = String(p.name || '').trim();
            const normName = normalizeSearchQuery(rawName);
            const rawBarcode = String(p.barcode || '').trim();
            const normBarcode = normalizeSearchQuery(rawBarcode);
            const lowerBarcode = rawBarcode.toLowerCase();
            const rawCode = String(p.code || p.sysCode || '').trim();
            const normCode = normalizeSearchQuery(rawCode);
            const lowerCode = rawCode.toLowerCase();
            const rawModelCode = String(p.modelCode || p.model_code || p.model || '').trim();
            const normModelCode = normalizeSearchQuery(rawModelCode);
            const lowerModelCode = rawModelCode.toLowerCase();
            const rawDirectSize = String(p.size || p.itemSize || '').trim();
            const normDirectSize = normalizeSearchQuery(rawDirectSize);

            const variantTokens = [];
            if (p.variants && Array.isArray(p.variants)) {
                for (let j = 0; j < p.variants.length; j++) {
                    const v = p.variants[j];
                    if (!v) continue;
                    const vBarcode = String(v.barcode || '').trim();
                    const vCode = String(v.code || '').trim();
                    variantTokens.push({
                        vBarcode,
                        lowerVBarcode: vBarcode.toLowerCase(),
                        normVBarcode: vBarcode ? normalizeSearchQuery(vBarcode) : '',
                        vCode,
                        lowerVCode: vCode.toLowerCase(),
                        normVCode: vCode ? normalizeSearchQuery(vCode) : '',
                        normVSize: v.size ? normalizeSearchQuery(v.size) : '',
                        normVColor: v.color ? normalizeSearchQuery(v.color) : ''
                    });
                }
            }

            const unitTokens = [];
            if (p.units && Array.isArray(p.units)) {
                for (let k = 0; k < p.units.length; k++) {
                    const u = p.units[k];
                    if (!u) continue;
                    const uBarcode = String(u.unitBarcode || '').trim();
                    unitTokens.push({
                        uBarcode,
                        lowerUBarcode: uBarcode.toLowerCase(),
                        normUBarcode: uBarcode ? normalizeSearchQuery(uBarcode) : '',
                        normUName: u.unitName ? normalizeSearchQuery(u.unitName) : ''
                    });
                }
            }

            const tokens = {
                rawName, normName,
                rawBarcode, normBarcode, lowerBarcode,
                rawCode, normCode, lowerCode,
                rawModelCode, normModelCode, lowerModelCode,
                rawDirectSize, normDirectSize,
                variantTokens,
                unitTokens
            };
            p._searchTokens = tokens;
            p._searchTokensVer = currentVer;
            return tokens;
        }

        function searchProductsRanked(query, options = {}) {
            if (!query || typeof query !== 'string' || !query.trim()) return [];
            
            const rawQuery = String(query).trim();
            const normQuery = normalizeSearchQuery(rawQuery);
            const lowerQuery = rawQuery.toLowerCase();
            if (!normQuery) return [];

            // استخراج نص الاستعلام بعد حذف بادئات مثل "مقاس" أو "نمرة" للبحث الدقيق بالمقاس
            const queryWithoutSize = normQuery.replace(/^(مقاس|نمرة|نمره|size)\s*/i, '').trim();

            const list = options.products || 
                ((typeof productsDB !== 'undefined' && Array.isArray(productsDB) && productsDB.length > 0)
                    ? productsDB 
                    : (window.productsDB || []));

            // إذا لم يتم تحديد حد صريح، نعرض جميع النتائج بلا استثناء وبدون تقييد بـ 50 أو غيره
            const limit = (options.limit && typeof options.limit === 'number' && options.limit > 0) ? options.limit : Infinity;
            const scored = [];

            for (let i = 0; i < list.length; i++) {
                const p = list[i];
                if (!p) continue;
                if (options.filterDeleted !== false && p.isDeleted) continue;

                const tok = getProductSearchTokens(p);
                let score = 0;

                // 1. تطابق تام مع اسم الصنف (أعلى أولوية مطلقة - مثل صنف اسمه "14")
                if (tok.normName === normQuery) {
                    score = Math.max(score, 25000);
                }

                // 2. تطابق تام مع الباركود الأساسي
                if (tok.normBarcode === normQuery || tok.lowerBarcode === lowerQuery) {
                    score = Math.max(score, 22000);
                }

                // 3. تطابق تام مع كود الصنف أو كود الموديل
                if (tok.normCode === normQuery || tok.lowerCode === lowerQuery || 
                    tok.normModelCode === normQuery || tok.lowerModelCode === lowerQuery) {
                    score = Math.max(score, 20000);
                }

                // 4. فحص تطابق باركود التشكيلات (المقاسات والألوان) والوحدات
                if (tok.variantTokens.length > 0) {
                    for (let j = 0; j < tok.variantTokens.length; j++) {
                        const vt = tok.variantTokens[j];
                        if (vt.vBarcode) {
                            if (vt.normVBarcode === normQuery || vt.lowerVBarcode === lowerQuery) {
                                score = Math.max(score, 18000);
                                break;
                            } else if (vt.normVBarcode.startsWith(normQuery)) {
                                score = Math.max(score, 3500);
                            } else if (vt.normVBarcode.includes(normQuery)) {
                                score = Math.max(score, 1200);
                            }
                        }
                        if (vt.vCode) {
                            if (vt.normVCode === normQuery || vt.lowerVCode === lowerQuery) {
                                score = Math.max(score, 17500);
                                break;
                            }
                        }

                        // 🌟 البحث بالمقاس في التشكيلات بدقة كاملة
                        if (vt.normVSize && (vt.normVSize === normQuery || (queryWithoutSize && vt.normVSize === queryWithoutSize))) {
                            score = Math.max(score, 14000);
                        } else if (vt.normVColor && (vt.normVColor === normQuery || vt.normVColor.includes(normQuery))) {
                            score = Math.max(score, 5500);
                        } else if (vt.normVSize && queryWithoutSize && vt.normVSize.includes(queryWithoutSize)) {
                            score = Math.max(score, 5000);
                        }
                    }
                }

                // فحص المقاس المباشر على الصنف إن وجد
                if (tok.normDirectSize) {
                    if (tok.normDirectSize === normQuery || (queryWithoutSize && tok.normDirectSize === queryWithoutSize)) {
                        score = Math.max(score, 14000);
                    } else if (queryWithoutSize && tok.normDirectSize.includes(queryWithoutSize)) {
                        score = Math.max(score, 5000);
                    }
                }

                if (tok.unitTokens.length > 0) {
                    for (let k = 0; k < tok.unitTokens.length; k++) {
                        const ut = tok.unitTokens[k];
                        if (ut.uBarcode) {
                            if (ut.normUBarcode === normQuery || ut.lowerUBarcode === lowerQuery) {
                                score = Math.max(score, 17000);
                                break;
                            } else if (ut.normUBarcode.startsWith(normQuery)) {
                                score = Math.max(score, 3400);
                            } else if (ut.normUBarcode.includes(normQuery)) {
                                score = Math.max(score, 1100);
                            }
                        }
                        if (ut.normUName && ut.normUName === normQuery) {
                            score = Math.max(score, 4000);
                        }
                    }
                }

                // 5. الاسم يبدأ بنص البحث (حتى لو حرف واحد مثل "ب")
                if (tok.normName.startsWith(normQuery)) {
                    const lengthDiff = Math.max(0, tok.normName.length - normQuery.length);
                    score = Math.max(score, 10000 - Math.min(lengthDiff * 5, 2000));
                }

                // 6. كلمة كاملة مطابقة في الاسم
                if (score < 9000) {
                    const words = tok.normName.split(/\s+/);
                    if (words.includes(normQuery)) {
                        score = Math.max(score, 8500);
                    }
                }

                // 7. الاسم يحتوي على نص البحث في أي مكان (حتى لو حرف واحد)
                if (score < 7000) {
                    const idx = tok.normName.indexOf(normQuery);
                    if (idx !== -1) {
                        score = Math.max(score, 5000 - Math.min(idx * 20, 1500));
                    }
                }

                // 8. كود الصنف أو كود الموديل يبدأ أو يحتوي على نص البحث
                if ((tok.normCode && tok.normCode.startsWith(normQuery)) || (tok.normModelCode && tok.normModelCode.startsWith(normQuery))) {
                    score = Math.max(score, 6000);
                } else if ((tok.normCode && tok.normCode.includes(normQuery)) || (tok.normModelCode && tok.normModelCode.includes(normQuery))) {
                    score = Math.max(score, 3000);
                }

                // 9. الباركود يبدأ أو يحتوي على نص البحث
                if (tok.normBarcode && tok.normBarcode.startsWith(normQuery)) {
                    score = Math.max(score, 3800);
                } else if (tok.normBarcode && tok.normBarcode.includes(normQuery)) {
                    score = Math.max(score, 1800);
                }

                if (score > 0) {
                    scored.push({ item: p, score: score });
                }
            }

            // ترتيب النتائج تنازلياً حسب درجة المطابقة
            scored.sort((a, b) => b.score - a.score);

            // إذا كان الحد غير نهائي نرجع جميع النتائج بلا استثناء
            const results = (limit === Infinity) ? scored.map(entry => entry.item) : scored.slice(0, limit).map(entry => entry.item);
            return results;
        }
        window.searchProductsRanked = searchProductsRanked;



        async function getUniqueHWID() {
            // للأجهزة والتابلت المقترنة، نعتمد كود ترخيص الجهاز الرئيسي (الماستر) لتوحيد السيريال والاشتراك
            if (typeof BayanNetworkHub !== 'undefined' && !BayanNetworkHub.isMasterServer) {
                const masterHwid = getStore('bayan_master_hwid');
                if (masterHwid) return masterHwid;
            }

            // إذا كان التطبيق يعمل في Electron، استرجاع كود الجهاز الدائم والمحمي من نظام التشغيل مباشرة (MachineGuid)
            if (typeof require !== 'undefined') {
                try {
                    const { ipcRenderer } = require('electron');
                    const nativeHwid = await ipcRenderer.invoke('get-hardware-uuid');
                    if (nativeHwid) {
                        setStore('bayan_hwid', nativeHwid);
                        if (typeof db !== 'undefined' && db.settings) {
                            try { await db.settings.put({ id: 'hwid', value: nativeHwid }); } catch(e) {}
                        }
                        return nativeHwid;
                    }
                } catch(e) {}
            }

            let hwid = getStore('bayan_hwid');
            if (hwid) return hwid;

            try {
                if (typeof db !== 'undefined' && db.settings) {
                    const stored = await db.settings.get('hwid');
                    if (stored && stored.value) {
                        setStore('bayan_hwid', stored.value);
                        return stored.value;
                    }
                }
            } catch(e) {}

            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let part1 = '', part2 = '';
            for(let i=0; i<4; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
            for(let i=0; i<4; i++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
            hwid = `BNC-${part1}-${part2}`;

            try {
                if (typeof db !== 'undefined' && db.settings) {
                    await db.settings.put({ id: 'hwid', value: hwid });
                }
            } catch(e) {}
            setStore('bayan_hwid', hwid);
            return hwid;
        }
        window.getUniqueHWID = getUniqueHWID;

        // دالة نسخ كود الجهاز الموحد للحافظة
        function copyHwid() {
            let hwid = document.getElementById('displayMachineId')?.innerText || document.getElementById('displayHwid')?.innerText;
            if (!hwid || hwid.includes('جاري') || hwid.includes('---')) {
                hwid = getStore('bayan_master_hwid') || getStore('bayan_hwid');
            }
            if(!hwid) return;
            navigator.clipboard.writeText(hwid).then(() => {
                showToast("✅ تم نسخ كود ترخيص الجهاز (HWID) الموحد بنجاح");
            });
        }

        // فتح رابط خارجي بأمان عبر IPC (Electron) أو متصفح عادي
        if (typeof window.openExternalUrl !== 'function') {
            window.openExternalUrl = function(url) {
                try {
                    if (window.require) {
                        const { ipcRenderer } = window.require('electron');
                        if (ipcRenderer) { ipcRenderer.invoke('open-url', url); return; }
                    }
                } catch(e) {}
                window.open(url, '_blank');
            };
        }

        // تحديث واجهة الاشتراك في النافذة (Modal) بناءً على طلب المستخدم
        function copyText(text, btn) {
            navigator.clipboard.writeText(text).then(() => {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: white;"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                btn.style.background = "#27ae60";
                btn.style.borderColor = "#27ae60";

                if (typeof showToast === 'function') {
                    showToast("تم النسخ بنجاح ✨");
                }

                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.background = "#f8fafc";
                    btn.style.borderColor = "#e2e8f0";
                }, 1500);
            }).catch(err => {
                console.error('فشل النسخ: ', err);
            });
        }

        // 1. إنشاء قاعدة البيانات (BayanDatabase)
        function logAuditAction(action, details) {
            const entry = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                user: currentUser ? currentUser.name : 'System',
                userId: currentUser ? currentUser.id : 0,
                action: action,
                details: details,
                warehouse: currentUser ? currentUser.warehouseName : 'Unknown'
            };
            auditLogs.push(entry);
            console.log(`🛡️ Audit Log: ${action}`, entry);
            if (typeof db !== 'undefined' && db.auditLogs) {
                db.auditLogs.add(entry).catch(() => {});
            }
        }
        let returnCart = [];
        let purReturnCart = [];
        let currentAnalysisMode = 'detailed';

        function updateDatalists() {
            fillDatalist('discountReason', discountReasons);
            fillDatalist('taxReason', taxReasons);
            fillDatalist('purchaseDiscountReason', purchaseDiscountReasons);
            fillDatalist('purchaseTaxReason', purchaseTaxReasons);
            fillDatalist('categoriesList', window.inventoryCategories);

            // تحديث قائمة الماركات
            const brands = [...new Set((typeof productsDB !== 'undefined' ? productsDB : []).map(p => p.brand).filter(Boolean))];
            fillDatalist('brandsList', brands);

            // تحديث قائمة الموردين
            const suppliers = (typeof accounts !== 'undefined' ? accounts : []).filter(a => a.type === 'supplier').map(a => a.name);
            fillDatalist('suppliersDatalist', suppliers);
        }

        function fillDatalist(listId, array) {
            const list = document.getElementById(listId);
            if (!list) return;
            list.innerHTML = '';

            if (list.tagName === 'SELECT') {
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.innerText = '--- اختر ---';
                list.appendChild(emptyOpt);
            }

            (array || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item;
                if (list.tagName === 'SELECT') opt.innerText = item;
                list.appendChild(opt);
            });
        }

        function addNewReason(value, array, listId) {
            if (value && !array.includes(value)) {
                array.push(value);
                if (typeof setStore === 'function') {
                    if (typeof discountReasons !== 'undefined' && array === discountReasons) setStore('pos_discount_reasons', JSON.stringify(discountReasons));
                    else if (typeof taxReasons !== 'undefined' && array === taxReasons) setStore('pos_tax_reasons', JSON.stringify(taxReasons));
                    else if (typeof purchaseDiscountReasons !== 'undefined' && array === purchaseDiscountReasons) setStore('pos_p_discount_reasons', JSON.stringify(purchaseDiscountReasons));
                    else if (typeof purchaseTaxReasons !== 'undefined' && array === purchaseTaxReasons) setStore('pos_p_tax_reasons', JSON.stringify(purchaseTaxReasons));
                }
                updateDatalists();
            }
        }

        // دالة الفحص الصارم لنوع الحركة لمنع التداخل بين البيع والشراء والمرتجعات
        function isTransactionOfType(t, typeKeyword) {
            if (!t || !t.type) return false;
            const typeStr = String(t.type);
            if (!typeKeyword) return true;
            
            if (typeKeyword === 'مرتجع بيع') {
                return typeStr.includes('مرتجع') && typeStr.includes('بيع');
            }
            if (typeKeyword === 'مرتجع شراء') {
                return typeStr.includes('مرتجع') && typeStr.includes('شراء');
            }
            if (typeKeyword === 'بيع') {
                return typeStr.includes('بيع') && !typeStr.includes('مرتجع');
            }
            if (typeKeyword === 'شراء') {
                return typeStr.includes('شراء') && !typeStr.includes('مرتجع');
            }
            if (typeKeyword === 'تسوية') {
                return typeStr.includes('تسوية');
            }
            if (typeKeyword === 'قبض') {
                return typeStr.includes('قبض');
            }
            if (typeKeyword === 'صرف') {
                return typeStr.includes('صرف');
            }
            return typeStr.includes(typeKeyword);
        }
        window.isTransactionOfType = isTransactionOfType;

        // دالة استخراج الرقم المتسلسل الفعلي مع عزل بادئات الأجهزة
        function extractNumericInvoiceId(invoiceId, devPrefix = '') {
            if (invoiceId === null || invoiceId === undefined || invoiceId === '') return 0;
            let raw = String(invoiceId).trim();
            if (devPrefix && raw.startsWith(devPrefix)) {
                raw = raw.slice(devPrefix.length);
            }
            const match = raw.match(/\d+/);
            if (match) {
                const num = parseInt(match[0], 10);
                return isNaN(num) ? 0 : num;
            }
            return 0;
        }
        window.extractNumericInvoiceId = extractNumericInvoiceId;

        // --- دالة توليد الأرقام المتسلسلة (دالة قراءة نقية Pure Read Function) ---
        // تحسب الرقم المتتالي دون أي تعديل أو زيادة في الذاكرة الدائمة
        function getNextSequence(typeKeyword) {
            const list = (typeof transactions !== 'undefined' && Array.isArray(transactions)) ? transactions : [];
            const isTablet = (typeof window.BayanNetworkHub !== 'undefined' && !window.BayanNetworkHub.isMasterServer);
            const savedPrefix = (typeof getStore === 'function') ? getStore('bayan_device_prefix') : null;
            let devPrefix = (savedPrefix !== null && savedPrefix !== undefined && savedPrefix !== '') ? savedPrefix : '';
            if (!devPrefix && isTablet) {
                const dId = (window.BayanNetworkHub && window.BayanNetworkHub.deviceId) ? String(window.BayanNetworkHub.deviceId) : '';
                const shortCode = dId ? dId.replace(/^DEV-/i, '').substring(0, 3).toUpperCase() : '';
                devPrefix = shortCode ? `T${shortCode}-` : 'T-';
            }

            // 1. حساب أقصى رقم موجود في الحركات المحملة بالذاكرة
            let maxId = 0;
            for (let i = 0; i < list.length; i++) {
                const t = list[i];
                if (isTransactionOfType(t, typeKeyword)) {
                    const num = extractNumericInvoiceId(t.invoiceId, devPrefix);
                    if (num > maxId) maxId = num;
                }
            }

            // 2. فحص أقصى رقم مسجل ومزامن من قاعدة البيانات (حتى لو لم تكن كل الفواتير السابقة محملة بذاكرة اليوم)
            if (typeKeyword) {
                const key = 'bayan_last_seq_' + (devPrefix || '') + typeKeyword;
                const storedVal = (typeof getStore === 'function' ? getStore(key) : null);
                const storedMax = parseInt(storedVal || '0', 10);
                if (!isNaN(storedMax) && storedMax > maxId) {
                    maxId = storedMax;
                }
            }

            // 3. الرقم التالي هو أقصى رقم مسجل + 1
            const nextNum = maxId + 1;
            return devPrefix ? `${devPrefix}${nextNum}` : nextNum;
        }
        window.getNextSequence = getNextSequence;

        // دالة تحديث أقصى رقم متسلسل مسجل (تُستدعى فقط وحصرياً عند نجاح حفظ الفاتورة في قاعدة البيانات)
        function updateLastSavedSequence(typeKeyword, invoiceId) {
            if (!typeKeyword || invoiceId === null || invoiceId === undefined) return;
            const isTablet = (typeof window.BayanNetworkHub !== 'undefined' && !window.BayanNetworkHub.isMasterServer);
            const savedPrefix = (typeof getStore === 'function') ? getStore('bayan_device_prefix') : null;
            let devPrefix = (savedPrefix !== null && savedPrefix !== undefined && savedPrefix !== '') ? savedPrefix : '';
            if (!devPrefix && isTablet) {
                const dId = (window.BayanNetworkHub && window.BayanNetworkHub.deviceId) ? String(window.BayanNetworkHub.deviceId) : '';
                const shortCode = dId ? dId.replace(/^DEV-/i, '').substring(0, 3).toUpperCase() : '';
                devPrefix = shortCode ? `T${shortCode}-` : 'T-';
            }
            const num = extractNumericInvoiceId(invoiceId, devPrefix);
            if (num > 0) {
                const key = 'bayan_last_seq_' + (devPrefix || '') + typeKeyword;
                const storedVal = (typeof getStore === 'function' ? getStore(key) : null);
                const currentStored = parseInt(storedVal || '0', 10);
                if (num > currentStored || isNaN(currentStored)) {
                    if (typeof setStore === 'function') {
                        setStore(key, String(num));
                    }
                }
            }
        }
        window.updateLastSavedSequence = updateLastSavedSequence;


        // --- مراقبة حالة الاتصال (Offline/Online) المباشرة والدورية ---
        window.addEventListener('online', () => updateConnectionStatus(true));
        window.addEventListener('offline', () => updateConnectionStatus(false));
        
        // فحص دوري تلقائي كل 8 ثواني لضمان تحول الحالة فورياً دون ريفريش
        setInterval(updateConnectionStatus, 8000);
        setTimeout(updateConnectionStatus, 1000);

        let _cachedStatusDiv = null;
        let _cachedStatusText = null;
        let _lastConnectionState = null;

        async function updateConnectionStatus(forcedState = null) {
            if (!_cachedStatusDiv) _cachedStatusDiv = document.getElementById('connectionStatus');
            if (!_cachedStatusText) _cachedStatusText = document.getElementById('statusText');
            if (!_cachedStatusDiv || !_cachedStatusText) return;
            
            const isOnline = typeof forcedState === 'boolean' ? forcedState : navigator.onLine;
            if (_lastConnectionState === isOnline) return; // منع إعادة الرسم غير الضروري
            _lastConnectionState = isOnline;
            
            if (isOnline) {
                _cachedStatusDiv.className = 'connection-status online';
                _cachedStatusText.innerText = 'متصل';
            } else {
                _cachedStatusDiv.className = 'connection-status offline';
                _cachedStatusText.innerText = 'أوفلاين';
            }
        }

        // --- تحديث الساعة والتاريخ المباشر (Optimized) ---
        let cachedTimeEl, cachedDateEl, cachedUserNameLabels, cachedTimeLabels;
        function updateTime() {
            if (!cachedTimeEl) cachedTimeEl = document.getElementById("time");
            if (!cachedDateEl) cachedDateEl = document.getElementById("date");

            let now = new Date();
            let timeStr = now.toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            let dateStr = now.toLocaleDateString("ar-EG", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            if (cachedTimeEl) cachedTimeEl.innerText = timeStr;
            if (cachedDateEl) cachedDateEl.innerText = dateStr;

            if (!cachedTimeLabels || now.getSeconds() % 5 === 0) {
                cachedTimeLabels = document.querySelectorAll('.timeLabel');
                cachedUserNameLabels = document.querySelectorAll('.userNameLabel');
            }

            cachedTimeLabels.forEach(el => el.innerText = timeStr);
            const userName = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : 'المدير العام (مدير)';
            cachedUserNameLabels.forEach(el => {
                if (el.innerText !== userName) el.innerText = userName;
            });

            const currentTab = (typeof openTabs !== 'undefined' && Array.isArray(openTabs)) ? openTabs.find(t => t.id === activeTabId) : null;
            if (currentTab) {
                const cfg = [
                    { s: 'sales', d: 'salesDate', t: 'salesTime' },
                    { s: 'purchase', d: 'purchaseDate', t: 'purchaseTime' },
                    { s: 'receipt', d: 'receiptDate', t: 'receiptTime' },
                    { s: 'disbursement', d: 'disburseDate', t: 'disburseTime' },
                    { s: 'sales-return', d: 'salesReturnDate', t: 'salesReturnTime' },
                    { s: 'purchase-return', d: 'purReturnDate', t: 'purReturnTime' },
                    { s: 'adjustment', d: 'adjDate', t: 'adjTime' }
                ].find(c => c.s === currentTab.type);

                if (cfg) {
                    const dEl = document.getElementById(cfg.d);
                    const tEl = document.getElementById(cfg.t);

                    if (dEl && document.activeElement !== dEl) {
                        const todayLocal = new Date().toLocaleDateString('en-CA');
                        if (dEl.readOnly || dEl.getAttribute('data-touched') !== 'true') {
                            dEl.value = todayLocal;
                        }
                    }
                    if (tEl && document.activeElement !== tEl) {
                        const timeISO = now.toTimeString().slice(0, 5);
                        if (tEl.readOnly || tEl.getAttribute('data-touched') !== 'true') {
                            tEl.value = timeISO;
                        }
                    }
                }
            }
        }

        updateTime();
        setInterval(updateTime, 1000);

        window.acknowledgedLowStock = [];
        window.acknowledgedExpiry = [];
        window.acknowledgedDebt = [];
        window.acknowledgedDelayed = [];

        window.isAccountFrozen = function(accountNameOrId) {
            if (!accountNameOrId) return false;
            let acc = null;
            if (typeof accountNameOrId === 'object') {
                acc = accountNameOrId;
            } else if (typeof accountNameOrId === 'number' || (!isNaN(Number(accountNameOrId)) && typeof accountNameOrId !== 'boolean')) {
                acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => a.id == accountNameOrId);
            }
            if (!acc && typeof accountNameOrId === 'string') {
                const trimmed = accountNameOrId.trim();
                acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => a.name && a.name.trim() === trimmed);
            }
            return acc ? (acc.inactive === true || acc.inactive === 'true' || acc.isFrozen === true) : false;
        };

        window.checkAccountFrozenAndAlert = function(accountNameOrId) {
            if (!accountNameOrId) return false;
            let accName = accountNameOrId;
            let acc = null;
            if (typeof accountNameOrId === 'object') {
                acc = accountNameOrId;
                accName = acc.name;
            } else if (typeof accountNameOrId === 'number' || (!isNaN(Number(accountNameOrId)) && typeof accountNameOrId !== 'boolean')) {
                acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => a.id == accountNameOrId);
                if (acc) accName = acc.name;
            }
            if (!acc && typeof accountNameOrId === 'string') {
                const trimmed = accountNameOrId.trim();
                acc = (typeof accounts !== 'undefined' ? accounts : []).find(a => a.name && a.name.trim() === trimmed);
            }

            if (acc && (acc.inactive === true || acc.inactive === 'true' || acc.isFrozen === true)) {
                const msgText = '⚠️ الحساب "' + accName + '" مجمد حالياً!\nلا يمكن إجراء أي معاملات مالية أو فواتير (بيع / شراء / مرتجعات / سندات) على هذا الحساب حتى يتم إلغاء التجميد من قسم الحسابات.';
                if (typeof showCustomAlert === 'function') {
                    showCustomAlert({
                        type: 'error',
                        titleText: '❄️ الحساب مجمد',
                        msg: msgText,
                        confirmText: 'حسناً',
                        cancelText: '✏️ تعديل الحساب',
                        showCancel: true,
                        onCancel: () => {
                            if (typeof switchSection === 'function') {
                                switchSection('accounts');
                            }
                            if (typeof selectAccountRow === 'function' && acc.id) {
                                selectAccountRow(acc.id);
                            }
                            if (typeof editSelectedAccount === 'function') {
                                setTimeout(() => {
                                    editSelectedAccount();
                                }, 150);
                            }
                        }
                    });
                } else {
                    alert(msgText);
                }
                return true;
            }
            return false;
        };

        // ============================================================
        //  منظومة تنبيهات النظام وسجل الاستلام الموحد (Notifications & Receipt Log)
        // ============================================================

        // سجل الاستلام الموحد والمؤرشف مع بيانات التدقيق (المستخدم، المخزن، التوقيت)
        window.bayanReceiptLog = [];
        try {
            const rawLog = (typeof getStore === 'function') ? getStore('bayan_receipt_log') : null;
            window.bayanReceiptLog = rawLog ? JSON.parse(rawLog) : [];
        } catch(e) { window.bayanReceiptLog = []; }

        // تهيئة قوائم المعرفات المستلمة
        function syncAcknowledgedLookupSets() {
            try {
                const raw1 = (typeof getStore === 'function') ? getStore('acknowledged_low_stock') : null;
                window.acknowledgedLowStock = raw1 ? JSON.parse(raw1).map(String) : [];
            } catch(e) { window.acknowledgedLowStock = []; }
            try {
                const raw2 = (typeof getStore === 'function') ? getStore('acknowledged_expiry') : null;
                window.acknowledgedExpiry = raw2 ? JSON.parse(raw2).map(String) : [];
            } catch(e) { window.acknowledgedExpiry = []; }
            try {
                const raw3 = (typeof getStore === 'function') ? getStore('acknowledged_debt') : null;
                window.acknowledgedDebt = raw3 ? JSON.parse(raw3).map(String) : [];
            } catch(e) { window.acknowledgedDebt = []; }
            try {
                const raw4 = (typeof getStore === 'function') ? getStore('acknowledged_delayed') : null;
                window.acknowledgedDelayed = raw4 ? JSON.parse(raw4).map(String) : [];
            } catch(e) { window.acknowledgedDelayed = []; }
            try {
                const raw5 = (typeof getStore === 'function') ? getStore('acknowledged_transfers') : null;
                window.acknowledgedTransfers = raw5 ? JSON.parse(raw5).map(String) : [];
            } catch(e) { window.acknowledgedTransfers = []; }
            try {
                const raw6 = (typeof getStore === 'function') ? getStore('acknowledged_cloud') : null;
                window.acknowledgedCloud = raw6 ? JSON.parse(raw6).map(String) : [];
            } catch(e) { window.acknowledgedCloud = []; }
        }
        syncAcknowledgedLookupSets();

        // استرجاع وتوثيق أي تنبيهات سابقة تم تأكيدها قبل تفعيل السجل الموحد
        function backfillLegacyReceiptLog() {
            if (!Array.isArray(window.bayanReceiptLog)) window.bayanReceiptLog = [];
            const existingKeys = new Set(window.bayanReceiptLog.map(x => `${x.type}_${x.targetId}`));
            let changed = false;

            if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
                (window.acknowledgedLowStock || []).forEach(id => {
                    const key = `low-stock_${id}`;
                    if (!existingKeys.has(key)) {
                        const p = productsDB.find(prod => String(prod.id) === String(id));
                        if (p) {
                            window.bayanReceiptLog.push({
                                logId: 'REC-LEGACY-' + id,
                                type: 'low-stock',
                                typeLabel: 'نواقص بضاعة',
                                targetId: String(id),
                                name: p.name,
                                details: `الرصيد: ${p.stock} (الحد: ${p.minStock || 5})`,
                                user: 'المدير',
                                warehouse: 'المخزن الرئيسي',
                                date: 'سابق',
                                time: '-',
                                timestamp: Date.now()
                            });
                            existingKeys.add(key);
                            changed = true;
                        }
                    }
                });

                (window.acknowledgedExpiry || []).forEach(id => {
                    const key = `expiry_${id}`;
                    if (!existingKeys.has(key)) {
                        const p = productsDB.find(prod => String(prod.id) === String(id));
                        if (p) {
                            window.bayanReceiptLog.push({
                                logId: 'REC-LEGACY-EXP-' + id,
                                type: 'expiry',
                                typeLabel: 'صلاحية قريبة/منتهية',
                                targetId: String(id),
                                name: p.name,
                                details: `تاريخ الانتهاء: ${p.expiry || '-'}`,
                                user: 'المدير',
                                warehouse: 'المخزن الرئيسي',
                                date: 'سابق',
                                time: '-',
                                timestamp: Date.now()
                            });
                            existingKeys.add(key);
                            changed = true;
                        }
                    }
                });
            }

            if (typeof accounts !== 'undefined' && Array.isArray(accounts)) {
                (window.acknowledgedDebt || []).forEach(id => {
                    const key = `debt_${id}`;
                    if (!existingKeys.has(key)) {
                        const a = accounts.find(acc => String(acc.id) === String(id));
                        if (a) {
                            const bal = (parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0);
                            window.bayanReceiptLog.push({
                                logId: 'REC-LEGACY-DEBT-' + id,
                                type: 'debt',
                                typeLabel: 'مديونية عميل',
                                targetId: String(id),
                                name: a.name,
                                details: `المبلغ المستحق: ${bal.toFixed(2)} ج.م`,
                                user: 'المدير',
                                warehouse: 'المخزن الرئيسي',
                                date: 'سابق',
                                time: '-',
                                timestamp: Date.now()
                            });
                            existingKeys.add(key);
                            changed = true;
                        }
                    }
                });
            }

            if (changed && typeof setStore === 'function') {
                setStore('bayan_receipt_log', JSON.stringify(window.bayanReceiptLog));
            }
        }

        // الدالة الموحدة لحساب إحصائيات التنبيهات النشطة والمستلمة (المصدر الوحيد للحقيقة)
        window.getSystemNotificationsStats = function() {
            syncAcknowledgedLookupSets();
            backfillLegacyReceiptLog();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 1. النواقص النشطة
            const allLowStock = (typeof productsDB !== 'undefined' && Array.isArray(productsDB))
                ? productsDB.filter(p => (parseFloat(p.stock) || 0) <= (parseFloat(p.minStock) || 5))
                : [];
            const activeLowStock = allLowStock.filter(p => !window.acknowledgedLowStock.includes(String(p.id)));
            const archivedLowStock = allLowStock.filter(p => window.acknowledgedLowStock.includes(String(p.id)));

            // 2. تواريخ الصلاحية النشطة
            const allExpiring = (typeof productsDB !== 'undefined' && Array.isArray(productsDB))
                ? productsDB.filter(p => {
                    if (!p.expiry) return false;
                    const exp = new Date(p.expiry);
                    if (isNaN(exp.getTime())) return false;
                    exp.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
                    return diffDays <= 30;
                })
                : [];
            const activeExpiring = allExpiring.filter(p => !window.acknowledgedExpiry.includes(String(p.id)));
            const archivedExpiring = allExpiring.filter(p => window.acknowledgedExpiry.includes(String(p.id)));

            // 3. ديون العملاء النشطة (محمية بالصلاحيات)
            const canViewAccounts = (typeof currentUser !== 'undefined' && currentUser && (currentUser.role === 'admin' || (typeof hasPermission === 'function' && hasPermission('accounts_view'))));
            const allDebtAccounts = (canViewAccounts && typeof accounts !== 'undefined' && Array.isArray(accounts))
                ? accounts.filter(a => {
                    const debit = parseFloat(a.debit) || 0;
                    const credit = parseFloat(a.credit) || 0;
                    const balance = debit - credit;
                    const isRemindActive = (a.remind === true || a.remind === 'true');
                    return (a.type === 'client' || a.type === 'mixed') && balance > 0 && isRemindActive;
                })
                : [];
            const activeDebt = allDebtAccounts.filter(a => !window.acknowledgedDebt.includes(String(a.id)));
            const archivedDebt = allDebtAccounts.filter(a => window.acknowledgedDebt.includes(String(a.id)));

            // 4. الحسابات المتأخرة النشطة (محمية بالصلاحيات - فهرسة سريعة فائقة الأداء O(T))
            const lastTxTimeByPartner = {};
            if (canViewAccounts && typeof transactions !== 'undefined' && Array.isArray(transactions)) {
                for (let i = 0; i < transactions.length; i++) {
                    const t = transactions[i];
                    if (!t) continue;
                    const dStr = t.date || t.timestamp || t.dateISO;
                    if (!dStr) continue;
                    const dTime = new Date(dStr).getTime();
                    if (isNaN(dTime)) continue;

                    if (t.partnerId) {
                        if (!lastTxTimeByPartner[t.partnerId] || dTime > lastTxTimeByPartner[t.partnerId]) {
                            lastTxTimeByPartner[t.partnerId] = dTime;
                        }
                    }
                    if (t.partner) {
                        if (!lastTxTimeByPartner[t.partner] || dTime > lastTxTimeByPartner[t.partner]) {
                            lastTxTimeByPartner[t.partner] = dTime;
                        }
                    }
                    if (t.account) {
                        if (!lastTxTimeByPartner[t.account] || dTime > lastTxTimeByPartner[t.account]) {
                            lastTxTimeByPartner[t.account] = dTime;
                        }
                    }
                }
            }

            const todayTime = today.getTime();
            const allDelayed = (canViewAccounts && typeof accounts !== 'undefined' && Array.isArray(accounts))
                ? accounts.filter(a => {
                    const balance = (parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0);
                    if (!((a.type === 'client' || a.type === 'mixed') && balance > 0)) return false;
                    const isRemindActive = (a.remind === true || a.remind === 'true');
                    if (!isRemindActive) return false;
                    const lastTime = lastTxTimeByPartner[a.id] || lastTxTimeByPartner[a.name];
                    if (!lastTime) return true;
                    const diffDays = Math.ceil((todayTime - lastTime) / (1000 * 60 * 60 * 24));
                    return diffDays > 30;
                })
                : [];
            const activeDelayed = allDelayed.filter(a => !window.acknowledgedDelayed.includes(String(a.id)));
            const archivedDelayed = allDelayed.filter(a => window.acknowledgedDelayed.includes(String(a.id)));

            // 5. التحويلات الواردة المعلقة
            const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
            const isAdmin = !currentUser || currentUser.role === 'admin' || currentUser.name === 'المدير';
            const allPendingTransfers = (typeof transactions !== 'undefined' && Array.isArray(transactions))
                ? transactions.filter(t => t.type && t.type.includes('تحويل') && t.transferStatus === 'pending' && (isAdmin || t.warehouse === activeWH || t.toWarehouse === activeWH))
                : [];
            const pendingTransferInvoices = {};
            allPendingTransfers.forEach(t => {
                const invId = t.invoiceId || 'TR-UNKNOWN';
                if (!pendingTransferInvoices[invId]) {
                    pendingTransferInvoices[invId] = {
                        id: invId,
                        date: t.date,
                        sourceWarehouse: t.sourceWarehouse,
                        warehouse: t.warehouse,
                        user: t.user || '-',
                        notes: t.notes || '',
                        items: []
                    };
                }
                pendingTransferInvoices[invId].items.push(t);
            });
            const pendingTransfersList = Object.values(pendingTransferInvoices);
            const activeTransfers = pendingTransfersList.filter(tr => !window.acknowledgedTransfers.includes(String(tr.id)));

            // 6. الإشعارات السحابية النشطة غير المستلمة
            const cloudHistory = (window.cloudAnnouncementsHistory && Array.isArray(window.cloudAnnouncementsHistory))
                ? window.cloudAnnouncementsHistory
                : [];
            const activeCloud = cloudHistory.filter(c => c.active && !window.acknowledgedCloud.includes(String(c.id)));

            // الحسابات المجمعة
            const activeProductsTotal = activeLowStock.length + activeExpiring.length;
            const activeAccountsTotal = activeDebt.length + activeDelayed.length;
            const activeTransfersCount = activeTransfers.length;
            const activeCloudCount = activeCloud.length;

            const totalActiveCount = activeProductsTotal + activeAccountsTotal + activeTransfersCount + activeCloudCount;
            const totalReceiptCount = window.bayanReceiptLog.length;

            return {
                allLowStock, activeLowStock, archivedLowStock,
                allExpiring, activeExpiring, archivedExpiring,
                allDebtAccounts, activeDebt, archivedDebt,
                allDelayed, activeDelayed, archivedDelayed,
                pendingTransfersList, activeTransfers, activeTransfersCount,
                cloudHistory, activeCloud, activeCloudCount,
                activeProductsTotal, activeAccountsTotal,
                totalActiveCount, totalReceiptCount,
                activeWH, canViewAccounts
            };
        };

        function updateNotifications() {
            const stats = window.getSystemNotificationsStats ? window.getSystemNotificationsStats() : null;
            const total = stats ? stats.totalActiveCount : 0;
            const badge = document.getElementById('bellBadge') || document.getElementById('notificationsBadge');
            if (badge) {
                badge.innerText = total > 99 ? '99+' : total;
                badge.style.display = total > 0 ? 'flex' : 'none';
            }
            return stats;
        }
        window.updateNotifications = updateNotifications;

        // تسجيل استلام تنبيه موحد مع توثيق (المستخدم، المخزن، الوقت والتاريخ)
        window.acknowledgeNotification = function(type, id, meta = {}, returnTab = null, silent = false) {
            if (!id) return;
            const targetIdStr = String(id);
            syncAcknowledgedLookupSets();

            let typeLabel = 'تنبيه';
            if (type === 'low-stock') {
                typeLabel = 'نواقص بضاعة';
                if (!window.acknowledgedLowStock.includes(targetIdStr)) window.acknowledgedLowStock.push(targetIdStr);
                setStore('acknowledged_low_stock', JSON.stringify(window.acknowledgedLowStock));
            } else if (type === 'expiry') {
                typeLabel = 'صلاحية قريبة/منتهية';
                if (!window.acknowledgedExpiry.includes(targetIdStr)) window.acknowledgedExpiry.push(targetIdStr);
                setStore('acknowledged_expiry', JSON.stringify(window.acknowledgedExpiry));
            } else if (type === 'debt') {
                typeLabel = 'مديونية عميل';
                if (!window.acknowledgedDebt.includes(targetIdStr)) window.acknowledgedDebt.push(targetIdStr);
                setStore('acknowledged_debt', JSON.stringify(window.acknowledgedDebt));
            } else if (type === 'delayed') {
                typeLabel = 'متأخر عن السداد';
                if (!window.acknowledgedDelayed.includes(targetIdStr)) window.acknowledgedDelayed.push(targetIdStr);
                setStore('acknowledged_delayed', JSON.stringify(window.acknowledgedDelayed));
            } else if (type === 'transfer') {
                typeLabel = 'إذن تحويل وارد';
                if (!window.acknowledgedTransfers.includes(targetIdStr)) window.acknowledgedTransfers.push(targetIdStr);
                setStore('acknowledged_transfers', JSON.stringify(window.acknowledgedTransfers));
            } else if (type === 'cloud') {
                typeLabel = 'إشعار سحابي';
                if (!window.acknowledgedCloud.includes(targetIdStr)) window.acknowledgedCloud.push(targetIdStr);
                setStore('acknowledged_cloud', JSON.stringify(window.acknowledgedCloud));
            }

            // استخراج بيانات المستخدم والمخزن الحاليين للتوثيق
            const curUser = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : (getStore('bayan_user_name') || 'المدير');
            const curWarehouse = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : (getStore('bayan_user_warehouse') || 'المخزن الرئيسي')).trim();
            const now = new Date();

            // إضافة قيد رسمي في سجل الاستلام
            const logEntry = {
                logId: 'REC-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                type: type,
                typeLabel: meta.typeLabel || typeLabel,
                targetId: targetIdStr,
                name: meta.name || 'بيان غير محدد',
                details: meta.details || '-',
                user: curUser,
                warehouse: curWarehouse,
                date: now.toLocaleDateString('ar-EG'),
                time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                timestamp: now.getTime()
            };

            // إزالة أي قيد مكرر لنفس العنصر قبل الإضافة
            window.bayanReceiptLog = (window.bayanReceiptLog || []).filter(item => !(item.type === type && item.targetId === targetIdStr));
            window.bayanReceiptLog.unshift(logEntry);
            if (window.bayanReceiptLog.length > 300) window.bayanReceiptLog = window.bayanReceiptLog.slice(0, 300);
            setStore('bayan_receipt_log', JSON.stringify(window.bayanReceiptLog));

            if (!silent) {
                updateNotifications();
                if (typeof showNotificationsModal === 'function') {
                    showNotificationsModal(returnTab || (type === 'low-stock' || type === 'expiry' ? 'products' : (type === 'debt' || type === 'delayed' ? 'accounts' : (type === 'transfer' ? 'transfers' : 'cloud'))));
                }
                showToast(`✅ تم استلام [${logEntry.name}] وتوثيقه في سجل الاستلام بنجاح`);
            }
        };

        // استعادة التنبيه من سجل الاستلام إلى التنبيهات النشطة
        window.unacknowledgeNotification = function(type, id, logId = null) {
            if (!id) return;
            const targetIdStr = String(id);
            syncAcknowledgedLookupSets();

            if (type === 'low-stock') {
                window.acknowledgedLowStock = window.acknowledgedLowStock.filter(x => x !== targetIdStr);
                setStore('acknowledged_low_stock', JSON.stringify(window.acknowledgedLowStock));
            } else if (type === 'expiry') {
                window.acknowledgedExpiry = window.acknowledgedExpiry.filter(x => x !== targetIdStr);
                setStore('acknowledged_expiry', JSON.stringify(window.acknowledgedExpiry));
            } else if (type === 'debt') {
                window.acknowledgedDebt = window.acknowledgedDebt.filter(x => x !== targetIdStr);
                setStore('acknowledged_debt', JSON.stringify(window.acknowledgedDebt));
            } else if (type === 'delayed') {
                window.acknowledgedDelayed = window.acknowledgedDelayed.filter(x => x !== targetIdStr);
                setStore('acknowledged_delayed', JSON.stringify(window.acknowledgedDelayed));
            } else if (type === 'transfer') {
                // 🔒 أذونات التحويل المستلمة أو المرفوضة معتمدة محاسبياً ونهائية ولا يمكن استعادتها لعدم الإخلال بأرصدة المخازن
                if (typeof showToast === 'function') {
                    showToast("⚠️ أذونات التحويل المخزني معتمدة ونهائية ولا يمكن إلغاء استلامها من هنا لعدم الإخلال بأرصدة المخازن.", "warning");
                }
                return;
            } else if (type === 'cloud') {
                window.acknowledgedCloud = window.acknowledgedCloud.filter(x => x !== targetIdStr);
                setStore('acknowledged_cloud', JSON.stringify(window.acknowledgedCloud));
            }

            // حذف أو إزالة القيد من سجل الاستلام
            if (logId) {
                window.bayanReceiptLog = (window.bayanReceiptLog || []).filter(x => x.logId !== logId);
            } else {
                window.bayanReceiptLog = (window.bayanReceiptLog || []).filter(x => !(x.type === type && x.targetId === targetIdStr));
            }
            setStore('bayan_receipt_log', JSON.stringify(window.bayanReceiptLog));

            updateNotifications();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('archived');
            }
            showToast("🔄 تم استعادة التنبيه إلى القائمة النشطة بنجاح!");
        };

        // استلام وتأكيد كافة تنبيهات البضاعة والصلاحيات دفعة واحدة
        window.acknowledgeAllProductsNotifications = function() {
            const stats = window.getSystemNotificationsStats();
            if (!stats) return;
            const items = [...stats.activeLowStock.map(p => ({ type: 'low-stock', id: p.id, name: p.name, details: `الرصيد: ${p.stock} (الحد: ${p.minStock || 5})` })), ...stats.activeExpiring.map(p => ({ type: 'expiry', id: p.id, name: p.name, details: `تاريخ الانتهاء: ${p.expiry}` }))];
            if (items.length === 0) return showToast("ℹ️ لا توجد تنبيهات بضاعة بانتظار الاستلام.");
            items.forEach(it => {
                window.acknowledgeNotification(it.type, it.id, { name: it.name, details: it.details }, 'products', true);
            });
            updateNotifications();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('products');
            }
            showToast("✅ تم تأكيد استلام كافة تنبيهات البضاعة وتوثيقها في سجل الاستلام بنجاح!", "success");
        };

        // استلام وتأكيد كافة تنبيهات الحسابات دفعة واحدة
        window.acknowledgeAllAccountsNotifications = function() {
            const stats = window.getSystemNotificationsStats();
            if (!stats) return;
            const items = [...stats.activeDebt.map(a => ({ type: 'debt', id: a.id, name: a.name, details: `المبلغ المستحق: ${((parseFloat(a.debit) || 0) - (parseFloat(a.credit) || 0)).toFixed(2)} ج.م` })), ...stats.activeDelayed.map(a => ({ type: 'delayed', id: a.id, name: a.name, details: 'متأخر عن السداد' }))];
            if (items.length === 0) return showToast("ℹ️ لا توجد تنبيهات حسابات بانتظار الاستلام.");
            items.forEach(it => {
                window.acknowledgeNotification(it.type, it.id, { name: it.name, details: it.details }, 'accounts', true);
            });
            updateNotifications();
            if (typeof showNotificationsModal === 'function') {
                showNotificationsModal('accounts');
            }
            showToast("✅ تم تأكيد استلام جميع تنبيهات الحسابات وتوثيقها في سجل الاستلام بنجاح!", "success");
        };

        // استلام وتأكيد الكل عبر التبويب المحدد
        window.acknowledgeAllNotifications = function(activeTab = 'all') {
            if (activeTab === 'products') window.acknowledgeAllProductsNotifications();
            else if (activeTab === 'accounts') window.acknowledgeAllAccountsNotifications();
            else {
                window.acknowledgeAllProductsNotifications();
                window.acknowledgeAllAccountsNotifications();
            }
        };

        // مسح سجل الاستلام أو تصفيره (مع الحفاظ على سجلات التحويلات المخزنية المعتمدة)
        window.clearReceiptLog = function() {
            if (!window.bayanReceiptLog || window.bayanReceiptLog.length === 0) return;
            if (confirm("هل أنت متأكد من مسح بيانات سجل الاستلام المؤرشفة؟\n(تظل أذونات التحويل المخزني موثقة ومعتمدة للحفاظ على الأرصدة)")) {
                window.bayanReceiptLog = (window.bayanReceiptLog || []).filter(x => x.type === 'transfer');
                setStore('bayan_receipt_log', JSON.stringify(window.bayanReceiptLog));
                if (typeof showNotificationsModal === 'function') {
                    showNotificationsModal('archived');
                }
                showToast("🗑️ تم مسح سجل الاستلام بنجاح وبقيت أذونات التحويل موثقة.");
            }
        };

        // استعادة كافة التنبيهات من سجل الاستلام للنشط
        window.resetAcknowledgedNotifications = function() {
            if (confirm("هل أنت متأكد من استعادة كافة التنبيهات المستلمة (البضاعة والحسابات) إلى القوائم النشطة؟\n(ملاحظة: أذونات التحويل المخزني تظل معتمدة وموثقة نهائياً لحماية الأرصدة)")) {
                window.acknowledgedLowStock = [];
                window.acknowledgedExpiry = [];
                window.acknowledgedDebt = [];
                window.acknowledgedDelayed = [];
                window.acknowledgedCloud = [];
                // الحفاظ على قيود التحويلات المعتمدة نهائياً
                window.bayanReceiptLog = (window.bayanReceiptLog || []).filter(x => x.type === 'transfer');
                removeStore('acknowledged_low_stock');
                removeStore('acknowledged_expiry');
                removeStore('acknowledged_debt');
                removeStore('acknowledged_delayed');
                removeStore('acknowledged_cloud');
                setStore('bayan_receipt_log', JSON.stringify(window.bayanReceiptLog));
                updateNotifications();
                if (typeof showNotificationsModal === 'function') {
                    showNotificationsModal('archived');
                }
                showToast("🔄 تم استعادة تنبيهات البضاعة والحسابات للقوائم النشطة وبقيت أذونات التحويل معتمدة نهائياً.");
            }
        };

        function getTransactionDateTime(dateId, timeId) {
            const now = new Date();
            const fallback = {
                full: now.toLocaleString('ar-EG'),
                iso: now.toLocaleDateString('en-CA'),
                time: now.toTimeString().slice(0, 5)
            };

            if (!dateId) return fallback;

            const dEl = typeof dateId === 'string' ? document.getElementById(dateId) : dateId;
            const tEl = typeof timeId === 'string' ? document.getElementById(timeId) : timeId;

            const d = dEl && dEl.value ? dEl.value : null;
            const t = tEl && tEl.value ? tEl.value : null;

            if (!d) return fallback;

            const dateObj = new Date(d + (t ? 'T' + t : 'T00:00'));
            return {
                full: isNaN(dateObj.getTime()) ? fallback.full : dateObj.toLocaleString('ar-EG'),
                iso: d,
                time: t || fallback.time
            };
        }

        // ================= منطق المشتريات (Purchase Logic) =================
        let purchaseCart = [];
        let purchaseTotalVal = 0;

        window.isGenericCashPartner = function(partnerName) {
            if (!partnerName) return true;
            const p = String(partnerName).trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            return p === '' || p === '-' || p === '---' || p === 'نقدي' || p === 'كاش' || p === 'عميل نقدي' || p === 'عميل عام' || p === 'مورد نقدي' || p === 'مورد عام' || p === 'غير محدد' || p === 'عام';
        };

        window.isTransactionCredit = function(methodName, total = 0, paid = 0, deferred = 0) {
            const mStr = String(methodName || '').toLowerCase().trim();
            
            // 1. إذا كانت طريقة الدفع صراحة آجل أو ذمم أو حساب
            if (mStr.includes('آجل') || mStr.includes('أجل') || mStr.includes('ذمم') || mStr.includes('حساب') || mStr.includes('دين') || mStr.includes('credit')) {
                return true;
            }
            
            // 2. التحقق من وسائل الدفع المعرفة في النظام
            if (typeof getPaymentMethods === 'function') {
                const methods = getPaymentMethods();
                const found = methods.find(m => m.name && m.name.toLowerCase().trim() === mStr);
                if (found) {
                    if (found.type === 'credit') return true;
                    if (found.type === 'cash' || found.type === 'bank') return false;
                }
            }

            // 3. إذا كانت الطريقة نقدي أو كاش أو شبكة أو بنك -> ليست آجلة أبداً
            if (mStr.includes('نقدي') || mStr.includes('كاش') || mStr.includes('cash') || mStr.includes('تحويل') || mStr.includes('فيزا') || mStr.includes('شبكة') || mStr.includes('بنك') || mStr.includes('bank') || mStr.includes('مدى') || mStr.includes('stc') || mStr.includes('فودافون') || mStr.includes('انستا')) {
                return false;
            }
            
            // 4. في حالة وجود متبقي حقيقي وتم تسجيل مدفوع جزئي (معاملة مختلطة غير نقدية بالكامل)
            if (deferred > 0.001) return true;
            if (total > 0 && paid > 0 && (total - paid) > 0.001) return true;

            return false;
        };

        window.ensurePartnerAccountExists = async function(partnerName, partnerType /* 'عميل' | 'مورد' */, isCredit, onApproved) {
            const isCash = window.isGenericCashPartner(partnerName);
            
            // 1. إذا كانت المعاملة آجلة والاسم نقدي أو فارغ -> نمنع الحفظ نهائياً
            if (isCredit && isCash) {
                showCustomAlert({
                    type: 'error',
                    titleText: `⚠️ مطلوب تحديد ${partnerType}`,
                    msg: `لا يمكن حفظ فاتورة أو حركة "آجلة" لحساب "نقدي" أو بدون تحديد طرف التعامل.<br><br>المعاملات الآجلة والمديونيات تتطلب <b>إلزامياً</b> اختيار أو تسجيل <b>${partnerType}</b> مسجل في قسم الحسابات لمتابعة رصيده وديونه.`
                });
                return false;
            }
            
            // 2. إذا كانت المعاملة نقدية (كاش) -> نسمح فوراً بالحفظ سواء كان الحساب نقدي عام أو اسم عميل اختياري
            if (!isCredit) {
                return true;
            }
            
            // 3. إذا كانت المعاملة آجلة، نتحقق هل الاسم مسجل في الحسابات أم لا
            const cleanArabic = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            const partnerClean = cleanArabic(partnerName);
            
            const existingAcc = (typeof accounts !== 'undefined' ? accounts : []).find(a => cleanArabic(a.name) === partnerClean);
            
            if (existingAcc) {
                return true; // موجود بالفعل -> تستمر العملية الأصلية بدون أي كولباك متكرر
            }
            
            // 4. الاسم غير مسجل في الحسابات -> نطلب من المستخدم إضافة سريعة وتسجيله في الحسابات فوراً
            showCustomAlert({
                type: 'question',
                titleText: `➕ تسجيل ${partnerType} جديد`,
                msg: `الاسم "<b>${partnerName}</b>" غير مسجل في شجرة الحسابات.<br><br>المعاملات الآجلة تتطلب تسجيل الطرف لمتابعة حسابه.<br><br>هل تريد إضافته كـ <b>${partnerType} جديد</b> في قسم الحسابات وحفظ الفاتورة مباشرة؟`,
                showCancel: true,
                confirmText: `نعم، سجّل كـ ${partnerType} واحفظ`,
                cancelText: 'إلغاء وتعديل الاسم',
                onConfirm: async () => {
                    const accType = partnerType === 'مورد' ? 'supplier' : 'client';
                    const codePrefix = partnerType === 'مورد' ? 'SUP-' : 'CLI-';
                    const newAcc = {
                        id: Date.now().toString(),
                        name: partnerName.trim(),
                        type: accType,
                        code: codePrefix + Math.floor(1000 + Math.random() * 9000),
                        debit: 0,
                        credit: 0,
                        balance: 0,
                        createdAt: new Date().toISOString()
                    };
                    
                    if (typeof accounts !== 'undefined') {
                        accounts.push(newAcc);
                    }
                    if (typeof db !== 'undefined' && db.accounts) {
                        try { await db.accounts.put(newAcc); } catch(e) { console.warn("DB account put:", e); }
                    }
                    // ⚡ مزامنة الحساب الجديد جزئياً بدون إعادة كتابة جداول المحل بالكامل
                    if (window.BayanNetworkHub && typeof window.BayanNetworkHub.onDeltaSaved === 'function') {
                        window.BayanNetworkHub.onDeltaSaved({ modifiedAccounts: [newAcc] });
                    }
                    if (typeof updateDatalists === 'function') {
                        updateDatalists();
                    }
                    // تحديث جدول الحسابات فقط إذا كانت شاشة الحسابات مفتوحة حالياً
                    const accSection = document.getElementById('accounts-section');
                    if (accSection && !accSection.classList.contains('hidden') && typeof renderAccountsTable === 'function') {
                        renderAccountsTable();
                    }
                    if (typeof showToast === 'function') {
                        showToast(`✅ تم تسجيل ${partnerType} "${partnerName}" بنجاح في الحسابات`, 'success');
                    }
                    if (typeof onApproved === 'function') onApproved(newAcc);
                }
            });
            
            return false;
        };

        function calculateChange() {
            const tenderedInput = document.getElementById('tenderedAmount');
            const tendered = parseFloat(tenderedInput ? tenderedInput.value : 0) || 0;
            const method = typeof getSelectedPaymentMethod === 'function' ? getSelectedPaymentMethod('sales-section') : 'نقدي';

            const changeElem = document.getElementById('changeAmount');
            const grandDebtElem = document.getElementById('grandDebtDisplay');
            const prevBal = parseFloat(document.getElementById('prevBalanceDisplay')?.innerText) || 0;

            const isCredit = window.isTransactionCredit(method, currentTotal, tendered, currentTotal - tendered);

            if (isCredit) {
                // في حالة البيع الآجل: العميل يدفع جزءاً من الفاتورة أو لا يدفع
                const remainingOnInvoice = Math.max(0, currentTotal - tendered);
                if (changeElem) changeElem.innerText = '0.00 (آجل)';

                // المديونية الكلية المتراكمة = المديونية السابقة + المتبقي غير المدفوع من الفاتورة الحالية
                const grandTotalDebt = prevBal + remainingOnInvoice;
                if (grandDebtElem) grandDebtElem.innerText = grandTotalDebt.toFixed(2);
            } else {
                // في حالة البيع النقدي أو البنكي:
                const change = Math.max(0, tendered - currentTotal);
                if (changeElem) changeElem.innerText = change.toFixed(2);

                // في الكاش لا تضاف مديونية جديدة من هذه الفاتورة
                if (grandDebtElem) grandDebtElem.innerText = prevBal.toFixed(2);
            }
        }

        function createBtn(container, value) {
            const btn = document.createElement('button');
            btn.className = 'quick-btn';
            btn.innerText = value;
            btn.onclick = () => {
                document.getElementById('tenderedAmount').value = value;
                calculateChange();
            };
            container.appendChild(btn);
        }

        function selectMethod(el) {
            let method = '';
            const section = el.closest('.section-view');

            if (el.tagName === 'SELECT') {
                method = el.value;
            } else {
                el.parentElement.querySelectorAll('.method-btn').forEach(b => b.classList.remove('selected'));
                el.classList.add('selected');
                method = el.innerText.trim();
            }

            const isCredit = window.isTransactionCredit(method);

            if (section) {
                // قسم البيع
                if (section.id === 'sales-section') {
                    const paidBox = document.getElementById('paidBox');
                    const remainingBox = document.getElementById('remainingBox');
                    const btnContainer = document.getElementById('dynamicButtons');
                    const tenderedInput = document.getElementById('tenderedAmount');

                    if (isCredit || method.includes('شيك')) {
                        if (paidBox) paidBox.style.display = 'flex';
                        if (remainingBox) remainingBox.style.display = 'flex';
                        if (btnContainer) btnContainer.style.display = 'flex';

                        // تصفير المدفوع تلقائياً عند اختيار آجل لضمان حساب المتبقي صح
                        if (tenderedInput) tenderedInput.value = 0;

                        // --- ميزة التنبيه الذكي والانتقال الفوري لمربع العميل عند اختيار آجل ---
                        const custInput = document.getElementById('customerName');
                        if (custInput) {
                            setTimeout(() => {
                                custInput.focus();
                                custInput.select();
                                if (typeof debouncedHandleCustomerSearch === 'function') {
                                    debouncedHandleCustomerSearch(custInput.value);
                                }
                            }, 50);
                            custInput.style.transition = 'all 0.3s ease';
                            custInput.style.backgroundColor = '#fef2f2';
                            custInput.style.border = '2.5px solid #ef4444';
                            custInput.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.35)';

                            if (window.isGenericCashPartner(custInput.value)) {
                                if (typeof showToast === 'function') {
                                    showToast("⚠️ البيع الآجل يتطلب تحديد واختيار حساب العميل", "warning");
                                }
                            }

                            setTimeout(() => {
                                custInput.style.backgroundColor = '';
                                custInput.style.border = '';
                                custInput.style.boxShadow = '';
                            }, 3500);
                        }

                        if (typeof calculateTotals === 'function') calculateTotals();
                    } else {
                        if (paidBox) paidBox.style.display = 'none';
                        if (remainingBox) remainingBox.style.display = 'none';
                        if (btnContainer) btnContainer.style.display = 'none';

                        // عند التحويل لطريقة غير آجلة (كاش / بنك / شبكة)، المدفوع = الإجمالي فوراً
                        if (tenderedInput) {
                            const curTot = typeof currentTotal !== 'undefined' ? currentTotal : (parseFloat(document.getElementById('total')?.innerText) || 0);
                            tenderedInput.value = curTot.toFixed(2);
                        }
                        if (typeof calculateTotals === 'function') calculateTotals();
                    }
                }
                // قسم الشراء
                else if (section.id === 'purchase-section') {
                    const purchasePaidBox = document.getElementById('purchasePaidBox');
                    const purchaseRemainingBox = document.getElementById('purchaseRemainingBox');
                    const purchasePaidInput = document.getElementById('purchasePaid');

                    if (isCredit || method.includes('شيك')) {
                        if (purchasePaidBox) purchasePaidBox.style.display = 'flex';
                        if (purchaseRemainingBox) purchaseRemainingBox.style.display = 'flex';

                        // تصفير المدفوع للمورد تلقائياً عند اختيار آجل
                        if (purchasePaidInput) purchasePaidInput.value = 0;

                        // تنبيه وانتقال فوري لمربع المورد
                        const supInput = document.getElementById('supplierName');
                        if (supInput) {
                            setTimeout(() => {
                                supInput.focus();
                                supInput.select();
                                if (typeof debouncedHandleSupplierSearch === 'function') {
                                    debouncedHandleSupplierSearch(supInput.value);
                                }
                            }, 50);
                            supInput.style.transition = 'all 0.3s ease';
                            supInput.style.backgroundColor = '#fef2f2';
                            supInput.style.border = '2.5px solid #ef4444';
                            supInput.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.35)';

                            if (window.isGenericCashPartner(supInput.value) && typeof showToast === 'function') {
                                showToast("⚠️ الشراء الآجل يتطلب تحديد واختيار حساب المورد", "warning");
                            }

                            setTimeout(() => {
                                supInput.style.backgroundColor = '';
                                supInput.style.border = '';
                                supInput.style.boxShadow = '';
                            }, 3500);
                        }

                        if (typeof calculatePurchaseTotals === 'function') calculatePurchaseTotals();
                    } else {
                        // في حالة النقدي، نخفي المربعات ونجعل المدفوع = الإجمالي
                        if (purchasePaidBox) purchasePaidBox.style.display = 'none';
                        if (purchaseRemainingBox) purchaseRemainingBox.style.display = 'none';

                        if (purchasePaidInput) {
                            const totalVal = parseFloat(document.getElementById('purchaseTotal')?.innerText) || 0;
                            purchasePaidInput.value = totalVal;
                        }

                        if (typeof calculatePurchaseTotals === 'function') calculatePurchaseTotals();
                    }
                }
            }
        }

        function getSelectedPaymentMethod(sectionId) {
            const select = document.getElementById(sectionId + 'PaymentMethodSelect');
            if (select) return select.value;

            const btn = document.querySelector('#' + sectionId + ' .method-btn.selected');
            return btn ? btn.innerText.trim() : 'كاش (نقدي)';
        }
        window.getSelectedPaymentMethod = getSelectedPaymentMethod;

        /**
         * 💳 دالة مركزية ذكية وموحدة لقراءة وتنسيق طريقة الدفع ديناميكياً
         * تقرأ وسيلة الدفع المسجلة بالفاتورة كما هي بالضبط دون مسخها أو تحويلها قسرياً إلى كاش
         * وتستنتج الأيقونة واللون والنوع بناءً على إعدادات المستخدم والنظام.
         */
        window.formatPaymentMethodDisplay = function(txOrMethod, options = {}) {
            if (!txOrMethod) return '💵 نقدي (كاش)';

            let methodRaw = '';
            let paidVal = 0;
            let remainingVal = 0;
            let isDeferred = false;
            let finalTotal = 0;

            if (typeof txOrMethod === 'object' && txOrMethod !== null) {
                const tx = txOrMethod;
                methodRaw = String(tx.method || tx.paymentMethod || '').trim();
                paidVal = parseFloat(tx.paidAmount != null ? tx.paidAmount : (tx.paid != null ? tx.paid : 0)) || 0;
                finalTotal = parseFloat(tx.invoiceGrandTotal || tx.finalTotal || tx.grandTotal || tx.total || 0) || 0;
                remainingVal = parseFloat(tx.deferred != null ? tx.deferred : (tx.remaining != null ? tx.remaining : (finalTotal - paidVal)));
                if (isNaN(remainingVal) || remainingVal < 0) remainingVal = 0;

                isDeferred = (options.isDeferred !== undefined) 
                    ? options.isDeferred 
                    : (methodRaw.includes('آجل') || methodRaw.includes('أجل') || methodRaw.includes('ذمم') || methodRaw.includes('deferred') || methodRaw.includes('credit') || remainingVal > 0.001);
            } else {
                methodRaw = String(txOrMethod).trim();
                paidVal = parseFloat(options.paidVal || 0) || 0;
                remainingVal = parseFloat(options.remainingVal || 0) || 0;
                isDeferred = (options.isDeferred !== undefined) ? !!options.isDeferred : (methodRaw.includes('آجل') || methodRaw.includes('أجل') || methodRaw.includes('ذمم'));
            }

            if (options.paidVal !== undefined) paidVal = parseFloat(options.paidVal) || 0;
            if (options.remainingVal !== undefined) remainingVal = parseFloat(options.remainingVal) || 0;
            if (options.isDeferred !== undefined) isDeferred = !!options.isDeferred;

            // 1. التعامل مع الفاتورة الآجلة أو السداد الجزئي
            if (isDeferred) {
                if (paidVal > 0.001 && remainingVal > 0.001) {
                    const subMethodClean = methodRaw && !methodRaw.includes('آجل') && !methodRaw.includes('أجل') ? ` (${methodRaw})` : '';
                    return options.asBadge 
                        ? `<span class="stock-badge" style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-weight:800;" title="سداد جزئي">⏳ آجل${subMethodClean}</span>`
                        : `⏳ آجل (سداد جزئي${subMethodClean ? ': ' + methodRaw : ''})`;
                } else {
                    return options.asBadge
                        ? `<span class="stock-badge" style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-weight:800;" title="آجل ذمم">⏳ آجل (ذمم)</span>`
                        : `⏳ آجل (ذمم)`;
                }
            }

            // إذا لم يكن هناك اسم طريقة مسجل
            if (!methodRaw) {
                return options.asBadge
                    ? `<span class="stock-badge" style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-weight:800;">💵 نقدي (كاش)</span>`
                    : `💵 نقدي (كاش)`;
            }

            // 2. فحص ذكي للأيقونة واللون المناسب لاسم وسيلة الدفع المسجلة
            let icon = '💳';
            let badgeBg = '#f0f9ff';
            let badgeColor = '#0369a1';
            let badgeBorder = '#bae6fd';

            const lower = methodRaw.toLowerCase();

            if (lower.includes('فودافون') || lower.includes('اورنج') || lower.includes('أورانج') || lower.includes('اتصالات') || lower.includes('وي باي') || lower.includes('محفظة') || (lower.includes('كاش') && (lower.includes('فودافون') || lower.includes('اورنج') || lower.includes('اتصالات') || lower.includes('we'))) || lower.includes('wallet')) {
                icon = '📱';
                badgeBg = '#fdf2f8';
                badgeColor = '#9d174d';
                badgeBorder = '#fbcfe8';
            } else if (lower.includes('انستاباي') || lower.includes('إنستاباي') || lower.includes('insta')) {
                icon = '⚡';
                badgeBg = '#eff6ff';
                badgeColor = '#1d4ed8';
                badgeBorder = '#bfdbfe';
            } else if (lower.includes('فيزا') || lower.includes('ماستر') || lower.includes('visa') || lower.includes('master') || lower.includes('مدى') || lower.includes('شبكة') || lower.includes('كارت') || lower.includes('بطاقة') || lower.includes('card')) {
                icon = '💳';
                badgeBg = '#f0fdf4';
                badgeColor = '#15803d';
                badgeBorder = '#bbf7d0';
            } else if (lower.includes('بنك') || lower.includes('تحويل') || lower.includes('bank') || lower.includes('حساب') || lower.includes('iban')) {
                icon = '🏦';
                badgeBg = '#f8fafc';
                badgeColor = '#334155';
                badgeBorder = '#cbd5e1';
            } else if (lower.includes('شيك')) {
                icon = '📑';
                badgeBg = '#faf5ff';
                badgeColor = '#6b21a8';
                badgeBorder = '#e9d5ff';
            } else if (lower.includes('خصم من حساب') || lower.includes('رصيد')) {
                icon = '👤';
                badgeBg = '#fefce8';
                badgeColor = '#854d0e';
                badgeBorder = '#fef08a';
            } else if (lower.includes('نقدي') || lower.includes('كاش') || lower.includes('نقد') || lower.includes('cash')) {
                icon = '💵';
                badgeBg = '#ecfdf5';
                badgeColor = '#047857';
                badgeBorder = '#a7f3d0';
            } else {
                // وسيلة دفع مخصصة أضافها المستخدم (أمان، فوري، إلخ)
                let userDef = null;
                if (typeof getPaymentMethods === 'function') {
                    const allMethods = getPaymentMethods();
                    userDef = allMethods.find(m => m.name === methodRaw || m.id === methodRaw);
                }
                if (userDef) {
                    if (userDef.type === 'cash') {
                        icon = '💵';
                        badgeBg = '#ecfdf5';
                        badgeColor = '#047857';
                        badgeBorder = '#a7f3d0';
                    } else if (userDef.type === 'credit') {
                        icon = '⏳';
                        badgeBg = '#fffbeb';
                        badgeColor = '#b45309';
                        badgeBorder = '#fde68a';
                    } else {
                        icon = '💳';
                        badgeBg = '#f0f9ff';
                        badgeColor = '#0369a1';
                        badgeBorder = '#bae6fd';
                    }
                } else {
                    icon = '💳';
                }
            }

            // تنظيف البادئة إذا كان الاسم يحتوي بالفعل على أيقونة لتجنب التكرار
            let cleanName = methodRaw.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
            if (!cleanName) cleanName = methodRaw;

            const fullText = `${icon} ${cleanName}`;

            if (options.asBadge) {
                return `<span class="stock-badge" style="background:${badgeBg}; color:${badgeColor}; border:1px solid ${badgeBorder}; font-weight:800;" title="طريقة الدفع: ${cleanName}">${fullText}</span>`;
            }

            return fullText;
        };

        /**
         * 📱 دالة مركزية للتحقق مما إذا كانت طريقة الدفع بنكية أو إلكترونية أو محفظة (غير كاش بالدرج)
         */
        window.isNonCashPaymentMethod = function(m) {
            if (!m) return false;
            let str = String(m).toLowerCase().trim();
            str = str.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim() || str;
            return str.includes('بنك') || str.includes('تحويل') || str.includes('فيزا') || 
                   str.includes('شيك') || str.includes('شبكة') || str.includes('فودافون') || 
                   str.includes('فودافن') || str.includes('vodafone') || str.includes('voda') || 
                   str.includes('اورنج') || str.includes('أورانج') || str.includes('orange') || 
                   str.includes('اتصالات') || str.includes('etisalat') || str.includes('وي') || 
                   str.includes('we') || str.includes('انستاباي') || str.includes('إنستاباي') || 
                   str.includes('انستا') || str.includes('insta') || str.includes('محفظة') || 
                   str.includes('wallet') || str.includes('مدى') || str.includes('mada') || 
                   str.includes('master') || str.includes('بطاقة') || str.includes('card') ||
                   str === 'vodafone_cash';
        };

        /**
         * 📱 دالة مركزية للتحقق مما إذا كانت طريقة الدفع هي فودافون كاش
         */
        window.isVodafonePaymentMethod = function(m) {
            if (!m) return false;
            let str = String(m).toLowerCase().trim();
            str = str.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim() || str;
            return str.includes('فودافون') || str.includes('فودافن') || str.includes('vodafone') || str.includes('voda') || str === 'vodafone_cash';
        };

        // --- 3. الوظائف التشغيلية (حفظ، طباعة) ---

        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast-msg toast-${type}`;
            const icon = type === 'success' ? '✅' : (type === 'error' ? '🚫' : 'ℹ️');
            toast.innerHTML = `<span>${icon}</span> ${message}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 500);
            }, 3000);
        }

        // نافذة توجيه ذكية تظهر عند الضغط على أزرار التحكم بدون تحديد صنف
        window.showInventorySelectionGuide = function(actionType = 'تعديل') {
            if (document.getElementById('inv-selection-guide-modal')) return;

            const overlay = document.createElement('div');
            overlay.id = 'inv-selection-guide-modal';
            overlay.style.cssText = `
                position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75);
                z-index: 9999999; display: flex; align-items: center; justify-content: center;
                animation: updaterFadeIn 0.25s ease; direction: rtl; font-family: 'Cairo', 'Segoe UI', sans-serif;
            `;

            overlay.innerHTML = `
                <div style="background: #ffffff; border: 2.5px solid #7c3aed; border-radius: 24px; padding: 28px 32px; width: 480px; max-width: 92vw; box-shadow: 0 20px 50px rgba(124, 58, 237, 0.28); text-align: center; color: #0f172a; position: relative;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #ede9fe, #ddd6fe); border: 2px solid #7c3aed; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 16px; box-shadow: 0 6px 16px rgba(124, 58, 237, 0.2);">
                        💡
                    </div>
                    <h3 style="margin: 0 0 10px; font-size: 1.28rem; font-weight: 900; color: #1e1b4b;">
                        يرجى تحديد صنف من الجدول أولاً
                    </h3>
                    <p style="margin: 0 0 20px; font-size: 0.92rem; color: #475569; line-height: 1.8; font-weight: 700;">
                        لتتمكن من تنفيذ عملية <strong style="color: #7c3aed; background: #f5f3ff; padding: 2px 8px; border-radius: 6px; border: 1px solid #ddd6fe;">${actionType}</strong>، يجب أولاً اختيار الصنف المطلوب من جدول البضاعة.
                    </p>
                    
                    <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 14px 16px; margin-bottom: 22px; text-align: right; font-size: 0.88rem; color: #334155; font-weight: 800; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #10b981; font-size: 1.1rem;">✔️</span>
                            <span><strong>طريقة 1:</strong> اضغط كليك بالماوس على صف الصنف مباشرة في الجدول.</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #3b82f6; font-size: 1.1rem;">☑️</span>
                            <span><strong>طريقة 2:</strong> ضع علامة في المربع الصغير الموجود بجانب اسم الصنف.</span>
                        </div>
                    </div>

                    <button onclick="document.getElementById('inv-selection-guide-modal').remove();" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; border: none; border-radius: 12px; font-weight: 900; font-size: 0.96rem; cursor: pointer; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35); transition: 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        فهمت ذلك، حسناً ✅
                    </button>
                </div>
            `;

            document.body.appendChild(overlay);
        };

        // دالة التعديل من شريط الأدوات الذكي (مطورة لدعم التحديد المتعدد)
        function editSelectedInventoryItem() {
            if (typeof checkPermission === 'function' && !checkPermission('stock_edit')) return;
            
            // جمع المعرفات المحددة عبر كافة الطرق
            let targetIds = [];
            if (window.selectedInventoryIds && window.selectedInventoryIds.size > 0) {
                targetIds = Array.from(window.selectedInventoryIds);
            } else {
                const checkedBoxes = document.querySelectorAll('.inv-row-check:checked');
                checkedBoxes.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.getAttribute('data-id')) targetIds.push(parseInt(row.getAttribute('data-id')));
                });
            }

            if (targetIds.length === 0 && window.selectedInventoryId) {
                targetIds.push(window.selectedInventoryId);
            }

            if (targetIds.length === 0) {
                return showInventorySelectionGuide('تعديل بيانات الصنف');
            }

            if (targetIds.length === 1) {
                const p = productsDB.find(x => x.id === targetIds[0]);
                if (p) openNewItemModal(p);
            } else {
                // إذا كان أكثر من صنف، نفتح تعديل الأسعار المجمع
                openPriceAdjustmentModal();
            }
        }

        // دالة الحذف من شريط الأدوات الذكي (مطورة للحذف الجماعي وبأعلى طبقة ظهور)
        async function deleteSelectedInventoryItem() {
            if (typeof checkPermission === 'function' && !checkPermission('stock_delete')) return;
            
            let targetIds = [];
            if (window.selectedInventoryIds && window.selectedInventoryIds.size > 0) {
                targetIds = Array.from(window.selectedInventoryIds);
            } else {
                const checkedBoxes = document.querySelectorAll('.inv-row-check:checked');
                checkedBoxes.forEach(cb => {
                    const row = cb.closest('tr');
                    if (row && row.getAttribute('data-id')) targetIds.push(parseInt(row.getAttribute('data-id')));
                });
            }

            if (targetIds.length === 0 && window.selectedInventoryId) {
                targetIds.push(window.selectedInventoryId);
            }

            if (targetIds.length === 0) {
                return showInventorySelectionGuide('حذف الصنف');
            }

            const msg = targetIds.length === 1 ? "هل أنت متأكد من حذف هذا الصنف ونقله إلى سلة المحذوفات؟" : `هل أنت متأكد من حذف عدد (${targetIds.length}) أصناف مختارة ونقلها إلى سلة المحذوفات؟`;

            const proceedDelete = async () => {
                try {
                    const activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
                    const targetSet = new Set(targetIds.map(Number));
                    const itemsToDelete = productsDB.filter(p => targetSet.has(Number(p.id)));

                    // 1. نقل جماعي فوري دفعة واحدة إلى سلة المحذوفات فائق السرعة
                    if (typeof trashManager !== 'undefined' && trashManager.bulkMoveToTrash) {
                        await trashManager.bulkMoveToTrash(itemsToDelete, 'product', activeWH);
                    } else if (typeof trashManager !== 'undefined' && trashManager.moveToTrash) {
                        for (const item of itemsToDelete) {
                            await trashManager.moveToTrash(item, 'product', item.name, item.warehouse || activeWH);
                        }
                    }

                    // 2. تسجيل المعرفات المحذوفة لمنع عودتها كأصناف زومبي نهائياً
                    if (!window.deletedItemIds) window.deletedItemIds = {};
                    if (!window.deletedItemIds.products) window.deletedItemIds.products = [];
                    window.deletedItemIds.products.push(...targetIds);

                    // 3. حذف جماعي فوري من قاعدة بيانات SQLite
                    await db.products.bulkDelete(targetIds);

                    // 4. تحديث المصفوفة المحلية فوراً
                    productsDB = productsDB.filter(x => !targetSet.has(Number(x.id)));

                    if (targetIds.includes(selectedInventoryId)) selectedInventoryId = null;
                    if (window.selectedInventoryIds) {
                        window.selectedInventoryIds.clear();
                    }

                    // 5. حفظ وحيد فوري ومزامنة مركزية لكامل العملية دفعة واحدة
                    if (typeof saveData === 'function') await saveData();

                    renderInventoryTable();
                    if (typeof updateInventorySelectionUI === 'function') updateInventorySelectionUI();
                    showToast(`⚡ تم حذف ونقل (${targetIds.length}) صنف إلى سلة المحذوفات بنجاح فوراً!`, "success");
                } catch (err) {
                    console.error("Error in bulk delete:", err);
                    if (typeof showCustomAlert === 'function') {
                        showCustomAlert({ type: 'error', titleText: 'خطأ', msg: 'حدث خطأ أثناء الحذف' });
                    } else {
                        alert("❌ حدث خطأ أثناء الحذف");
                    }
                }
            };

            if (typeof showCustomAlert === 'function') {
                showCustomAlert({
                    type: 'error',
                    titleText: '🗑️ تأكيد حذف الصنف',
                    msg: msg,
                    confirmText: 'نعم، احذف الصنف',
                    cancelText: 'إلغاء وتراجع',
                    showCancel: true,
                    onConfirm: proceedDelete
                });
            } else if (confirm(msg)) {
                await proceedDelete();
            }
        }

        function toggleInventoryColumn(idx, show) {
            inventoryColumnVisibility[idx] = show;
            const jsonStr = JSON.stringify(inventoryColumnVisibility);
            setStore('pos_inv_cols', jsonStr);
            
            applyInventoryColumnVisibility();
        }

        function applyInventoryColumnVisibility() {
            const saved = getStore('pos_inv_cols');
            if (saved) {
                try {
                    inventoryColumnVisibility = JSON.parse(saved);
                } catch(e) {}
            }

            const allCols = ["0","1","quick","3","13","10","11","9","image","12","detailed","6","7","8","5","4","margin","2","internal"];
            allCols.forEach(idx => {
                const show = inventoryColumnVisibility[idx] !== false;
                const cells = document.querySelectorAll(`.col-inv-${idx}`);
                cells.forEach(c => {
                    c.style.display = show ? '' : 'none';
                });
                const check = document.getElementById(`inv_col_check_${idx}`);
                if (check) check.checked = show;
            });
        }

        async function saveInvEdits() {
            const id = parseInt(document.getElementById('invSelectedId').value);
            if (!id) return alert('⚠️ يرجى تحديد صنف من الجدول أولاً');

            const p = productsDB.find(x => x.id === id);
            if (!p) return alert('❌ الصنف غير موجود');

            const newCode = document.getElementById('invDisplayCode').value.trim();
            const newUnit = document.getElementById('invDisplayUnit').value;
            const newCost = parseFloat(document.getElementById('invDisplayCost').value) || 0;
            const newPrice = parseFloat(document.getElementById('invDisplayPrice').value) || 0;

            if (newPrice <= 0) return alert('⚠️ يرجى إدخال سعر بيع صحيح');

            p.code = newCode;
            p.unit = newUnit;
            p.cost = newCost;
            p.price = newPrice;

            await saveData();
            renderInventoryTable();
            alert(`✅ تم حفظ تعديلات الصنف: ${p.name}`);
        }

        function handleProductImage(event) {
            if (typeof window.handleProductImage === 'function' && window.handleProductImage !== handleProductImage) {
                return window.handleProductImage(event);
            }
            const file = event && event.target && event.target.files ? event.target.files[0] : null;
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('productImagePreview');
                const removeBtn = document.getElementById('removeProductImageBtn');
                window.currentProductImageData = e.target.result;
                window.productImageRemoved = false;
                if (typeof currentProductImageData !== 'undefined') currentProductImageData = e.target.result;
                if (preview) {
                    preview.dataset.image = e.target.result;
                    preview.dataset.removed = 'false';
                    preview.style.backgroundImage = `url(${e.target.result})`;
                    Array.from(preview.childNodes).forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE) node.textContent = '';
                    });
                }
                if (removeBtn) {
                    removeBtn.classList.remove('hidden');
                    removeBtn.style.display = 'flex';
                }
            };
            reader.readAsDataURL(file);
        }

        function removeProductImage(event) {
            if (event) event.stopPropagation();
            const preview = document.getElementById('productImagePreview');
            const removeBtn = document.getElementById('removeProductImageBtn');
            const fileInput = document.getElementById('newItemImage');
            if (preview) {
                preview.style.backgroundImage = 'none';
                preview.dataset.image = '';
                preview.dataset.removed = 'true';
                let hasText = false;
                Array.from(preview.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.textContent = '📷';
                        hasText = true;
                    }
                });
                if (!hasText) preview.insertAdjacentText('afterbegin', '📷');
            }
            window.currentProductImageData = null;
            window.productImageRemoved = true;
            if (typeof currentProductImageData !== 'undefined') currentProductImageData = null;
            if (removeBtn) {
                removeBtn.classList.add('hidden');
                removeBtn.style.display = 'none';
            }
            if (fileInput) fileInput.value = '';
        }

        function openNewItemModal(product = null) {
            if (typeof checkPermission === 'function' && !checkPermission('stock_add')) return;
            document.getElementById('newItemModal').classList.remove('hidden');
            const nameEl = document.getElementById('newItemName');
            const preview = document.getElementById('productImagePreview');
            const removeBtn = document.getElementById('removeProductImageBtn');

            // تصفير الحقول قبل البدء
            document.querySelectorAll('#newItemModal input:not([type=radio]):not([type=checkbox]):not([type=file])').forEach(el => {
                if(el.type === 'number') el.value = "0";
                else el.value = "";
            });
            document.getElementById('newItemNotes').value = "";
            document.getElementById('productUnitsTableBody').innerHTML = "";

            // تعبئة قائمة التصنيفات في الداتاليست
            if (typeof updateDatalists === 'function') updateDatalists();

            // إعادة تعيين الصورة
            if (preview) {
                preview.style.backgroundImage = 'none';
                preview.dataset.image = '';
                preview.dataset.removed = 'false';
                preview.innerText = '📷';
            }
            window.currentProductImageData = null;
            window.productImageRemoved = false;
            if (typeof currentProductImageData !== 'undefined') currentProductImageData = null;
            if (removeBtn) removeBtn.classList.add('hidden');

            // إعادة تعيين حالة القفل والحماية للأرصدة
            window.isVariantsStockLocked = true;
            window.isMainStockLocked = true;
            const vBtn = document.getElementById('btnToggleVariantsLock');
            const vIcon = document.getElementById('variantsLockIcon');
            const vText = document.getElementById('variantsLockText');
            if (vIcon) vIcon.innerText = '🔒';
            if (vText) vText.innerText = 'الكميات مقفلة (محمية)';
            if (vBtn) {
                vBtn.style.background = '#fffbeb';
                vBtn.style.borderColor = '#f59e0b';
                vBtn.style.color = '#b45309';
            }
            const mBtn = document.getElementById('toggleMainStockLockBtn');
            const mInp = document.getElementById('newItemStock');
            if (mBtn) {
                mBtn.innerHTML = '🔒 مقفل';
                mBtn.style.background = '#fffbeb';
                mBtn.style.color = '#b45309';
                mBtn.style.borderColor = '#f59e0b';
            }
            if (mInp) {
                mInp.setAttribute('readonly', 'true');
                mInp.style.background = '#f8fafc';
                mInp.style.cursor = 'not-allowed';
            }

            if (product && typeof product === 'object') {
                currentEditingProductId = product.id;
                fillProductModal(product);
            } else {
                currentEditingProductId = null;
                if (typeof product === 'string') nameEl.value = product;
                document.getElementById('newItemCategory').value = "عام";
                if (document.getElementById('newItemBrand')) document.getElementById('newItemBrand').value = "";
                if (document.getElementById('newItemSupplier')) document.getElementById('newItemSupplier').value = "";
                document.getElementById('isQuickItem').checked = false; // تصفير الاختيار للأصناف الجديدة
                if (mInp) mInp.dataset.origStock = "0";
                addProductUnitRow('قطعة');
                if (typeof renderProductWarehouseStocksTable === 'function') renderProductWarehouseStocksTable(null);
                window.hasSyncedVariantPrices = false;
                if (typeof window.updateVariantPriceSyncUI === 'function') window.updateVariantPriceSyncUI();
            }

            document.getElementById('newItemBarcode').focus();
            switchBayanTab('general', document.querySelector('.bayan-tab'));
            updateAllUnitSelects();
            if (typeof updateProductNavCounter === 'function') updateProductNavCounter();
            if (typeof window.updateVariantPriceSyncUI === 'function') window.updateVariantPriceSyncUI();
        }

        // --- فلترة محتويات السلة في المبيعات والمشتريات ---
        window.filterCartItems = function(query) {
            const rows = document.querySelectorAll('#cartTableBody tr');
            const q = (query || '').trim().toLowerCase();
            let firstMatch = null;

            rows.forEach(row => {
                const rowText = row.innerText.toLowerCase();
                if (rowText.includes(q)) {
                    row.style.display = "";
                    row.style.background = q !== "" ? "rgba(39, 174, 96, 0.15)" : "";
                    if (q !== "" && !firstMatch) firstMatch = row;
                } else {
                    row.style.display = "none";
                }
            });

            if (firstMatch && q !== "") {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };

        window.filterPurchaseCartItems = function(query) {
            const rows = document.querySelectorAll('#purchaseTableBody tr');
            const q = (query || '').trim().toLowerCase();
            let firstMatch = null;

            rows.forEach(row => {
                const rowText = row.innerText.toLowerCase();
                if (rowText.includes(q)) {
                    row.style.display = "";
                    row.style.background = q !== "" ? "rgba(52, 152, 219, 0.15)" : "";
                    if (q !== "" && !firstMatch) firstMatch = row;
                } else {
                    row.style.display = "none";
                }
            });

            if (firstMatch && q !== "") {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };

        window.showCustomPrompt = function(message, defaultValue = '', inputType = 'text') {
            return new Promise((resolve) => {
                const modal = document.getElementById('customPromptModal');
                const title = document.getElementById('customPromptTitle');
                const input = document.getElementById('customPromptInput');
                const confirmBtn = document.getElementById('customPromptConfirmBtn');
                const cancelBtn = document.getElementById('customPromptCancelBtn');
                
                if (!modal || !title || !input || !confirmBtn || !cancelBtn) {
                    resolve(prompt(message, defaultValue));
                    return;
                }
                
                title.innerText = message;
                input.value = defaultValue;
                input.type = inputType || 'text';
                modal.style.zIndex = '2147483647';
                modal.classList.remove('hidden');
                setTimeout(() => {
                    input.focus();
                    input.select();
                }, 50);
                
                function cleanup() {
                    input.type = 'text'; // إعادة الحقل إلى نص عادي دائماً
                    modal.classList.add('hidden');
                    confirmBtn.onclick = null;
                    cancelBtn.onclick = null;
                    input.onkeydown = null;
                }
                
                confirmBtn.onclick = () => {
                    const val = input.value;
                    cleanup();
                    resolve(val);
                };
                
                cancelBtn.onclick = () => {
                    cleanup();
                    resolve(null);
                };
                
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        confirmBtn.click();
                    } else if (e.key === 'Escape') {
                        cancelBtn.click();
                    }
                };
            });
        };

        // 🛡️ صمام الأمان المركزي: التحقق الإجباري من رمز PIN المدير قبل العمليات الحساسة
        window.verifyAdminPinAuthorization = async function(actionTitle, actionDesc) {
            const userList = (window.users && Array.isArray(window.users) && window.users.length > 0)
                ? window.users
                : ((typeof users !== 'undefined' && Array.isArray(users)) ? users : []);

            const admins = userList.filter(u => u && u.role === 'admin' && !u.isFrozen);
            // إذا لم يكن هناك أي مدير مسجل بعد، نسمح بالإجراء
            if (admins.length === 0) return true;

            const promptMsg = `${actionTitle || '🔒 تأكيد إذن المدير'}\n${actionDesc ? (actionDesc + '\n') : ''}يرجى إدخال رمز PIN الخاص بالمدير لتأكيد العملية:`;
            const enteredPin = await window.showCustomPrompt(promptMsg, '', 'password');

            if (enteredPin === null || enteredPin === undefined || String(enteredPin).trim() === '') {
                if (typeof showToast === 'function') showToast('🛡️ تم إلغاء العملية ولم يتم تنفيذ أي حذف.', 'info');
                return false;
            }
            const cleanEntered = String(enteredPin).trim();
            const isValidAdmin = admins.some(a => {
                if (!a || !a.pin) return false;
                if (window.BayanSecurity && typeof window.BayanSecurity.verifyPin === 'function') {
                    return window.BayanSecurity.verifyPin(cleanEntered, a.pin);
                }
                const plainPin = (window.BayanSecurity && typeof window.BayanSecurity.decryptPin === 'function')
                    ? window.BayanSecurity.decryptPin(a.pin)
                    : a.pin;
                return String(a.pin).trim() === cleanEntered || String(plainPin).trim() === cleanEntered;
            });

            if (!isValidAdmin) {
                if (typeof showToast === 'function') showToast('❌ رمز PIN المدير غير صحيح! تم رفض العملية.', 'error');
                else alert('❌ رمز PIN المدير غير صحيح! تم رفض العملية.');
                if (typeof logAuditAction === 'function') {
                    logAuditAction('محاولة غير مصرح بها', `فشل التحقق من رمز PIN المدير أثناء: ${actionTitle || 'عملية حساسة'}`);
                }
                return false;
            }

            return true;
        };

        let activeAlertTimeout = null;

        function showCustomAlert(options = {}) {
            if (activeAlertTimeout) {
                clearTimeout(activeAlertTimeout);
                activeAlertTimeout = null;
            }
            const modal = document.getElementById('alertModal');
            const icon = document.getElementById('alertIcon');
            const title = document.getElementById('alertTitle');
            const message = document.getElementById('alertMessage');
            const confirmBtn = document.getElementById('alertConfirmBtn');
            const cancelBtn = document.getElementById('alertCancelBtn');

            const {
                type = 'warning',
                titleText = 'تنبيه',
                msg = '',
                confirmText = 'حسناً',
                cancelText = 'تراجع',
                showCancel = false,
                timeout = (options.type === 'success' ? 5000 : null),
                onConfirm = () => { },
                onCancel = () => { }
            } = options;

            title.innerText = titleText;
            message.innerHTML = msg; // تم التغيير ليدعم الروابط
            confirmBtn.innerText = confirmText;
            cancelBtn.innerText = cancelText;

            // إعادة ضبط الستايلات الافتراضية
            confirmBtn.style.color = '#fff';
            cancelBtn.style.color = '#555';
            cancelBtn.style.background = '#edf0f2';

            const card = modal.querySelector('.alert-card');
            if (card) {
                card.style.width = options.cardWidth || options.width || '400px';
                card.style.maxWidth = options.maxWidth || '92%';
                card.style.padding = options.cardPadding || '35px 30px';
            }

            if (options.hideIcon) {
                icon.style.display = 'none';
            } else {
                icon.style.display = 'block';
                if (options.icon) icon.innerText = options.icon;
            }

            // ضبط الأيقونة والألوان بناءً على النوع
            if (type === 'error') {
                if (!options.icon) icon.innerText = '🚫';
                title.style.color = '#c0392b';
                confirmBtn.style.setProperty('background', '#c0392b', 'important');
                confirmBtn.style.setProperty('color', '#ffffff', 'important');
                if (showCancel) {
                    cancelBtn.style.setProperty('background', '#2563eb', 'important');
                    cancelBtn.style.setProperty('color', '#ffffff', 'important');
                }
            } else if (type === 'success') {
                if (!options.icon) icon.innerText = '✅';
                title.style.color = '#1e8449';
                confirmBtn.style.setProperty('background', '#1e8449', 'important');
                confirmBtn.style.setProperty('color', '#ffffff', 'important');
            } else if (type === 'info') {
                if (!options.icon) icon.innerText = '👤';
                title.style.color = '#2980b9';
                confirmBtn.style.setProperty('background', '#2980b9', 'important');
                confirmBtn.style.setProperty('color', '#ffffff', 'important');
            } else if (type === 'question') {
                if (!options.icon) icon.innerText = '❓';
                title.style.color = '#8e44ad'; // Purple
                confirmBtn.style.setProperty('background', '#27ae60', 'important'); // Green
                confirmBtn.style.setProperty('color', '#ffffff', 'important');

                cancelBtn.style.setProperty('background', '#2980b9', 'important'); // Blue
                cancelBtn.style.setProperty('color', '#ffffff', 'important');
            } else {
                if (!options.icon) icon.innerText = '⚠️';
                title.style.color = '#f39c12';
                confirmBtn.style.setProperty('background', '#1e8449', 'important');
                confirmBtn.style.setProperty('color', '#ffffff', 'important');
            }

            cancelBtn.classList.toggle('hidden', !showCancel);

            const resetModalCardStyle = () => {
                if (card) {
                    card.style.width = '400px';
                    card.style.maxWidth = '90%';
                    card.style.padding = '35px 30px';
                }
                if (icon) icon.style.display = 'block';
            };

            confirmBtn.onclick = async () => {
                if (activeAlertTimeout) {
                    clearTimeout(activeAlertTimeout);
                    activeAlertTimeout = null;
                }
                modal.classList.add('hidden');
                modal.style.display = 'none';
                resetModalCardStyle();
                try {
                    await onConfirm();
                } catch(err) {
                    console.error("Alert onConfirm error:", err);
                }
            };
            cancelBtn.onclick = async () => {
                if (activeAlertTimeout) {
                    clearTimeout(activeAlertTimeout);
                    activeAlertTimeout = null;
                }
                modal.classList.add('hidden');
                modal.style.display = 'none';
                resetModalCardStyle();
                try {
                    await onCancel();
                } catch(err) {
                    console.error("Alert onCancel error:", err);
                }
            };

            modal.style.setProperty('z-index', '2147483647', 'important');
            modal.style.display = 'flex';
            modal.classList.remove('hidden');

            if (timeout && typeof timeout === 'number') {
                activeAlertTimeout = setTimeout(() => {
                    confirmBtn.click();
                }, timeout);
            }
        }
        window.showCustomAlert = showCustomAlert;

        function closeCustomAlert() {
            if (activeAlertTimeout) {
                clearTimeout(activeAlertTimeout);
                activeAlertTimeout = null;
            }
            const modal = document.getElementById('alertModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
                const card = modal.querySelector('.alert-card');
                if (card) {
                    card.style.width = '400px';
                    card.style.maxWidth = '90%';
                    card.style.padding = '35px 30px';
                }
                const icon = document.getElementById('alertIcon');
                if (icon) icon.style.display = 'block';
            }
        }
        window.closeCustomAlert = closeCustomAlert;

        function contactDeveloper() {
            let modal = document.getElementById('bayanHelpModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.remove('hidden');
            } else {
                window.open('https://wa.me/201006825905', '_blank');
            }
        }
        window.contactDeveloper = contactDeveloper;

        async function openAnyDeskDirectly(specificCode) {
            const input = document.getElementById('bayanAnyDeskInput');
            const rawCode = (specificCode !== undefined && specificCode !== null) ? specificCode : (input ? input.value : '');
            const cleanCode = String(rawCode || '').replace(/[^a-zA-Z0-9@._-]/g, '').trim();

            if (typeof showToast === 'function') {
                showToast(cleanCode ? `🖥️ جاري فتح AnyDesk والاتصال بالكود: ${cleanCode}...` : '🖥️ جاري فتح تطبيق AnyDesk على جهازك...', 'info');
            }

            // 1. المحاولة عبر IPC في بيئة Electron (تشغيل مباشر وسريع بدون أي وسائط خارجية)
            try {
                if (window.require) {
                    const { ipcRenderer } = window.require('electron');
                    if (ipcRenderer && typeof ipcRenderer.invoke === 'function') {
                        const res = await ipcRenderer.invoke('launch-anydesk', cleanCode);
                        if (res && res.success) {
                            if (typeof showToast === 'function') {
                                showToast(cleanCode ? `✅ تم فتح AnyDesk وجاري بدء الجلسة (${cleanCode})` : '✅ تم فتح تطبيق AnyDesk بنجاح', 'success');
                            }
                            return;
                        }
                    }
                }
            } catch (ipcErr) {
                console.warn('IPC launch-anydesk error:', ipcErr);
            }

            // 2. المحاولة البديلة عبر بروتوكول anydesk:
            const protoUrl = cleanCode ? `anydesk:${cleanCode}` : 'anydesk:';
            if (typeof window.openExternalUrl === 'function') {
                window.openExternalUrl(protoUrl);
            } else {
                try {
                    window.location.href = protoUrl;
                } catch(e) {
                    window.open(protoUrl, '_self');
                }
            }
        }
        window.openAnyDeskDirectly = openAnyDeskDirectly;
        window.sendAnyDeskCodeToDev = openAnyDeskDirectly;

        function copyDevPhone() {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText('01006825905').then(() => {
                    if (typeof showToast === 'function') {
                        showToast('✅ تم نسخ رقم هاتف المطور (01006825905) بنجاح!', 'success');
                    } else {
                        alert('تم نسخ الرقم بنجاح');
                    }
                }).catch(() => {
                    prompt('رقم الدعم الفني:', '01006825905');
                });
            } else {
                prompt('رقم الدعم الفني:', '01006825905');
            }
        }
        window.copyDevPhone = copyDevPhone;

        // --- دوال إعدادات الخط والتبويبات ---
        function adjustFontSize(change) {
            currentFontSize += change;
            applyFontSize(currentFontSize);
        }

        function adjustFontSizeExplicit(value) {
            currentFontSize = parseInt(value);
            applyFontSize(currentFontSize);
        }

        function applyFontSize(size) {
            if (size < 10) size = 10;
            if (size > 24) size = 24;
            currentFontSize = size;

            document.documentElement.style.setProperty('--app-font-size', size + 'px');
            const display = document.getElementById('currentFontSizeDisplay');
            if (display) display.innerText = size + 'px';

            const slider = document.getElementById('globalScaleSlider');
            if (slider) slider.value = size;

            // حفظ الإعداد مباشرة
            const settings = JSON.parse(getStore('pos_settings') || '{}');
            settings.fontSize = size;
            setStore('pos_settings', JSON.stringify(settings));
        }

        function openSettingsTab(tabName, btn) {
            document.querySelectorAll('.settings-tab-content').forEach(el => el.classList.add('hidden'));
            const target = document.getElementById('set-tab-' + tabName);
            if (target) target.classList.remove('hidden');

            // Handle all setting tab button classes & set active highlight
            document.querySelectorAll('.settings-tab-btn, .settings-tab-btn-premium, .premium-tab-btn').forEach(b => b.classList.remove('active'));

            if (btn) {
                btn.classList.add('active');
            } else {
                const targetBtn = document.querySelector(`.premium-tab-btn[onclick*="'${tabName}'"]`) ||
                                  document.querySelector(`.settings-tab-btn[onclick*="'${tabName}'"]`) ||
                                  document.querySelector(`.settings-tab-btn-premium[onclick*="'${tabName}'"]`);
                if (targetBtn) targetBtn.classList.add('active');
            }

            if (tabName === 'updates' && typeof window.initAutoUpdatesPolicyUI === 'function') {
                window.initAutoUpdatesPolicyUI();
            }
        }

        // ================= استعلام الأصناف والمنتجات السريع =================
        let currentSectionInquiryProduct = null;
        let selectedSectionInquiryWarehouse = 'all'; // 'all' أو اسم المخزن المحدد
        let selectedSectionInquirySize = 'all';
        let selectedSectionInquiryColor = 'all';

        /**
         * تحديد المخزن لعرض أرصدته بالجدول التفصيلي أدناه
         */
        window.setSectionInquirySelectedWarehouse = function(whName) {
            if (selectedSectionInquiryWarehouse === whName) {
                selectedSectionInquiryWarehouse = 'all';
            } else {
                selectedSectionInquiryWarehouse = whName;
            }
            window.selectedSectionInquiryWarehouse = selectedSectionInquiryWarehouse;
            if (currentSectionInquiryProduct) {
                renderSectionInquiryWarehousesTable();
                renderSectionInquiryVariantsTable();
            }
        };

        /**
         * فلترة التشكيلات حسب المقاس واللون في قسم الاستعلام
         */
        window.setSectionInquiryVariantFilter = function(type, val) {
            if (type === 'reset') {
                selectedSectionInquirySize = 'all';
                selectedSectionInquiryColor = 'all';
            } else if (type === 'size') {
                selectedSectionInquirySize = val;
            } else if (type === 'color') {
                selectedSectionInquiryColor = val;
            }
            window.selectedSectionInquirySize = selectedSectionInquirySize;
            window.selectedSectionInquiryColor = selectedSectionInquiryColor;
            if (currentSectionInquiryProduct) {
                renderSectionInquiryWarehousesTable();
                renderSectionInquiryVariantsTable();
            }
        };



        window.clearInquirySearch = function() {
            const inp = document.getElementById('inquirySearchInput');
            if (inp) {
                inp.value = '';
                inp.focus();
            }
            const clearBtn = document.getElementById('inquiryClearBtn');
            if (clearBtn) clearBtn.style.display = 'none';
            handleInquirySearch('');
        };

        window.handleInquirySearchKeyDown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const inp = document.getElementById('inquirySearchInput');
                const query = (inp ? inp.value : '').trim();
                if (!query) return;

                const allProducts = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []);
                const cleanAr = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
                const rawQuery = query.toLowerCase();
                const q = cleanAr(query);

                let matchedVariant = null;

                // 1. فحص التطابق التام مع باركود أو كود أو كود ميزان
                let target = allProducts.find(p => {
                    if (p.barcode && (cleanAr(p.barcode) === q || String(p.barcode).trim().toLowerCase() === rawQuery)) return true;
                    if (p.code && (cleanAr(p.code) === q || String(p.code).trim().toLowerCase() === rawQuery)) return true;
                    if (p.scalePlu && (String(p.scalePlu).trim() === rawQuery || cleanAr(p.scalePlu) === q)) return true;
                    if (p.units && p.units.some(u => u.unitBarcode && (cleanAr(u.unitBarcode) === q || String(u.unitBarcode).trim().toLowerCase() === rawQuery))) return true;
                    if (p.variants && p.variants.length > 0) {
                        const vMatch = p.variants.find(v => v.barcode && (cleanAr(v.barcode) === q || String(v.barcode).trim().toLowerCase() === rawQuery));
                        if (vMatch) {
                            matchedVariant = vMatch;
                            return true;
                        }
                    }
                    return false;
                });

                // 2. إذا لم يكن هناك تطابق تام، نأخذ أول عنصر يظهر في القائمة المصفاة
                if (!target) {
                    const firstItem = document.querySelector('#inquiryProductList .inquiry-product-item');
                    if (firstItem && firstItem.id) {
                        const pid = Number(firstItem.id.replace('inquiry-item-', ''));
                        if (pid) target = allProducts.find(p => p.id === pid);
                    }
                }

                if (target) {
                    selectProductForInquiry(target.id, matchedVariant);
                    if (inp) inp.select(); // تحديد النص ليكون السكانر جاهز للمسحة التالية فوراً
                }
            }
        };

        function handleInquirySearch(query) {
            const rawQuery = (query || '').trim().toLowerCase();
            const cleanAr = (str) => (str || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/\s+/g, ' ');
            const q = cleanAr(query);
            const productListEl = document.getElementById('inquiryProductList');
            if (!productListEl) return;

            const clearBtn = document.getElementById('inquiryClearBtn');
            if (clearBtn) clearBtn.style.display = rawQuery ? 'inline-flex' : 'none';

            const allProducts = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []);

            if (!q) {
                renderInquiryProductList(allProducts);
                return;
            }

            const filtered = allProducts.filter(p => {
                const nameMatch = p.name && cleanAr(p.name).includes(q);
                const codeMatch = p.code && (cleanAr(p.code).includes(q) || String(p.code).toLowerCase().includes(rawQuery));
                const scalePluMatch = p.scalePlu && (String(p.scalePlu).trim() === rawQuery || cleanAr(p.scalePlu) === q);
                const sysCodeMatch = (p.sysCode && String(p.sysCode).toLowerCase().includes(rawQuery)) || (String(p.id) === rawQuery);
                const barcodeMatch = p.barcode && (cleanAr(p.barcode) === q || String(p.barcode).toLowerCase() === rawQuery);
                const barcodeInclude = p.barcode && (cleanAr(p.barcode).includes(q) || String(p.barcode).toLowerCase().includes(rawQuery));
                const unitBarcodeMatch = p.units && p.units.some(u => u.unitBarcode && (cleanAr(u.unitBarcode) === q || String(u.unitBarcode).toLowerCase() === rawQuery));
                const unitBarcodeInclude = p.units && p.units.some(u => u.unitBarcode && (cleanAr(u.unitBarcode).includes(q) || String(u.unitBarcode).toLowerCase() === rawQuery));
                const variantBarcodeMatch = p.variants && p.variants.some(v => v.barcode && (cleanAr(v.barcode) === q || String(v.barcode).trim().toLowerCase() === rawQuery));
                const variantBarcodeInclude = p.variants && p.variants.some(v => v.barcode && (cleanAr(v.barcode).includes(q) || String(v.barcode).trim().toLowerCase() === rawQuery));

                return nameMatch || codeMatch || scalePluMatch || sysCodeMatch || barcodeMatch || barcodeInclude || unitBarcodeMatch || unitBarcodeInclude || variantBarcodeMatch || variantBarcodeInclude;
            });

            renderInquiryProductList(filtered);

            // اختيار تلقائي للصنف إذا كان هناك تطابق تام للباركود (شامل باركود المقاسات والألوان)
            let matchedVariant = null;
            const exactMatch = filtered.find(p => {
                if (p.barcode && (cleanAr(p.barcode) === q || p.barcode.toLowerCase() === rawQuery)) return true;
                if (p.units && p.units.some(u => u.unitBarcode && (cleanAr(u.unitBarcode) === q || u.unitBarcode.toLowerCase() === rawQuery))) return true;
                if (p.variants && p.variants.length > 0) {
                    const vMatch = p.variants.find(v => v.barcode && (cleanAr(v.barcode) === q || String(v.barcode).trim().toLowerCase() === rawQuery));
                    if (vMatch) {
                        matchedVariant = vMatch;
                        return true;
                    }
                }
                return false;
            });

            if (exactMatch) {
                selectProductForInquiry(exactMatch.id, matchedVariant);
            }
        }
        window.handleInquirySearch = handleInquirySearch;
        window.selectProductForInquiry = selectProductForInquiry;

        function renderInquiryProductList(products) {
            const productListEl = document.getElementById('inquiryProductList');
            if (!productListEl) return;

            if (products.length === 0) {
                productListEl.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 0.9rem;">⚠️ لا توجد نتائج مطابقة</div>';
                return;
            }

            productListEl.innerHTML = products.map(p => `
                <div class="inquiry-product-item" id="inquiry-item-${p.id}" onclick="selectProductForInquiry(${p.id})">
                    <div style="display: flex; flex-direction: column; gap: 4px; text-align: right;">
                        <div class="name">${p.name}</div>
                        <div class="code">كود: ${p.code || '---'} | باركود: ${p.barcode || '---'}</div>
                    </div>
                    <span style="font-size: 0.95rem; font-weight: 900; color: #6d28d9; white-space: nowrap;">${parseFloat(p.price || 0).toFixed(2)} ج.م</span>
                </div>
            `).join('');
        }

        function selectProductForInquiry(productId, targetVariant = null) {
            const allProducts = (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) ? productsDB : (window.productsDB || []);
            const product = allProducts.find(p => p.id === productId || p.id == productId);
            if (!product) return;

            currentSectionInquiryProduct = product;
            window.currentSectionInquiryProduct = product;
            selectedSectionInquiryWarehouse = 'all';
            window.selectedSectionInquiryWarehouse = 'all';

            // إذا تم تمرير تشكيلة مستهدفة من مسح الباركود
            if (targetVariant) {
                selectedSectionInquirySize = (targetVariant.size && String(targetVariant.size).trim()) ? String(targetVariant.size).trim() : 'all';
                selectedSectionInquiryColor = (targetVariant.color && String(targetVariant.color).trim()) ? String(targetVariant.color).trim() : 'all';
            } else {
                selectedSectionInquirySize = 'all';
                selectedSectionInquiryColor = 'all';
            }

            // تمييز العنصر النشط في القائمة
            document.querySelectorAll('.inquiry-product-item').forEach(el => el.classList.remove('active'));
            const activeItem = document.getElementById(`inquiry-item-${productId}`);
            if (activeItem) activeItem.classList.add('active');

            // إخفاء واجهة البداية وعرض المحتوى
            document.getElementById('inquiryEmptyState').classList.add('hidden');
            document.getElementById('inquiryDetailsContent').classList.remove('hidden');

            // تعبئة البيانات الأساسية
            document.getElementById('inquiryProductName').textContent = product.name;
            if (document.getElementById('inquiryProductSysCode')) {
                document.getElementById('inquiryProductSysCode').textContent = product.sysCode || product.id || '---';
            }
            document.getElementById('inquiryProductCode').textContent = product.code || '---';
            const scalePluEl = document.getElementById('inquiryProductScalePlu');
            if (scalePluEl) {
                scalePluEl.textContent = product.scalePlu || 'غير مسجل';
            }
            const brandBadge = document.getElementById('inquiryProductBrandBadge');
            if (brandBadge) {
                if (product.brand && product.brand.trim()) {
                    brandBadge.style.display = 'inline-block';
                    brandBadge.textContent = '🏷️ ' + product.brand.trim();
                } else {
                    brandBadge.style.display = 'none';
                }
            }
            document.getElementById('inquiryProductShelf').textContent = product.shelf || 'غير محدد';
            document.getElementById('inquiryProductCategory').textContent = product.category || 'عام';

            // الأسعار
            document.getElementById('inquiryPriceRetail').textContent = parseFloat(product.price || 0).toFixed(2);

            const wholesaleCard = document.getElementById('inquiryWholesaleCard');
            const costCard = document.getElementById('inquiryCostCard');
            const posSettings = JSON.parse(getStore('pos_settings') || '{}');
            const allowInquiryCost = posSettings.showInquiryCostPrice !== undefined ? !!posSettings.showInquiryCostPrice : false;
            const canViewWholesaleAndCost = allowInquiryCost && (typeof checkPermission === 'function' ? checkPermission('docs_purchase_price') : true);

            if (wholesaleCard) {
                if (canViewWholesaleAndCost) {
                    wholesaleCard.style.display = 'flex';
                    document.getElementById('inquiryPriceWholesale').textContent = parseFloat(product.wholesale || 0).toFixed(2);
                } else {
                    wholesaleCard.style.display = 'none';
                }
            } else if (document.getElementById('inquiryPriceWholesale')) {
                document.getElementById('inquiryPriceWholesale').textContent = parseFloat(product.wholesale || 0).toFixed(2);
            }

            if (costCard) {
                if (canViewWholesaleAndCost) {
                    costCard.style.display = 'flex';
                    document.getElementById('inquiryPriceCost').textContent = parseFloat(product.cost || product.cost_price || 0).toFixed(2);
                } else {
                    costCard.style.display = 'none';
                }
            }

            // توليد الباركود
            const svgEl = document.getElementById('inquiryBarcodeSvg');
            const barcodeValEl = document.getElementById('inquiryBarcodeValue');
            if (product.barcode) {
                try {
                    svgEl.style.display = 'block';
                    JsBarcode(svgEl, product.barcode, {
                        format: "CODE128",
                        width: 1.5,
                        height: 40,
                        displayValue: false
                    });
                    barcodeValEl.textContent = product.barcode;
                } catch (e) {
                    console.error("Barcode generation error:", e);
                    svgEl.style.display = 'none';
                    barcodeValEl.textContent = product.barcode + " (فشل التوليد البصري)";
                }
            } else {
                svgEl.style.display = 'none';
                barcodeValEl.textContent = "لا يوجد باركود";
            }

            // جدول الوحدات
            const unitsTableBody = document.getElementById('inquiryUnitsTableBody');
            if (unitsTableBody) {
                if (product.units && product.units.length > 0) {
                    unitsTableBody.innerHTML = product.units.map(u => `
                        <tr>
                            <td style="padding: 10px; font-weight: bold;">${u.unitName}</td>
                            <td style="padding: 10px; text-align: center; font-weight: 800;">${u.factor || 1}</td>
                            <td style="padding: 10px; text-align: center; font-weight: 900; color: #1e3a8a;">${parseFloat(u.price || 0).toFixed(2)} ج.م</td>
                            <td style="padding: 10px; text-align: center; font-family: monospace; color: #475569;">${u.unitBarcode || '---'}</td>
                        </tr>
                    `).join('');
                } else {
                    unitsTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" style="text-align: center; color: #94a3b8; padding: 15px;">لا توجد وحدات إضافية لهذا الصنف</td>
                        </tr>
                    `;
                }
            }

            // بناء جدول المخازن التفاعلي وجدول التشكيلات
            renderSectionInquiryWarehousesTable();
            renderSectionInquiryVariantsTable();
        }

        /**
         * بناء جدول المخازن التفاعلي مع عمود التحديد والفرز التنازلي
         */
        function renderSectionInquiryWarehousesTable() {
            const p = currentSectionInquiryProduct;
            if (!p) return;

            const stockTableBody = document.getElementById('inquiryWarehouseStockTableBody');
            if (!stockTableBody) return;

            // استخراج قائمة المخازن الشاملة
            let whList = [];
            if (window.warehouses && Array.isArray(window.warehouses) && window.warehouses.length > 0) {
                whList = window.warehouses.map(w => w.name);
            } else if (typeof getStore === 'function' && getStore('pos_warehouses')) {
                try {
                    const storedWh = JSON.parse(getStore('pos_warehouses'));
                    if (Array.isArray(storedWh)) whList = storedWh.map(w => w.name);
                } catch(e) {}
            }
            if (whList.length === 0) {
                if (p.warehouseStocks) Object.keys(p.warehouseStocks).forEach(k => { if (!whList.includes(k)) whList.push(k); });
                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => {
                        if (v.warehouseStocks) Object.keys(v.warehouseStocks).forEach(k => { if (!whList.includes(k)) whList.push(k); });
                    });
                }
            }
            if (!whList.includes('المخزن الرئيسي')) whList.unshift('المخزن الرئيسي');

            // فحص التشكيلات مع فلتر المقاس واللون
            const variants = (p.variants && Array.isArray(p.variants) && p.variants.length > 0) ? p.variants : [];
            const hasVariants = variants.length > 0;
            let matchedVars = variants;
            if (hasVariants) {
                matchedVars = variants.filter(v => 
                    (selectedSectionInquirySize === 'all' || String(v.size || '').trim() === selectedSectionInquirySize) &&
                    (selectedSectionInquiryColor === 'all' || String(v.color || '').trim() === selectedSectionInquiryColor)
                );
            }

            // تجميع أرصدة كل مخزن
            let whRowsData = [];
            let grandTotalStock = 0;

            whList.forEach(whName => {
                let availQty = 0;
                if (hasVariants) {
                    matchedVars.forEach(v => {
                        let st = 0;
                        if (v.warehouseStocks && typeof v.warehouseStocks === 'object' && v.warehouseStocks[whName] !== undefined) {
                            st = parseFloat(v.warehouseStocks[whName]) || 0;
                        } else if (whName === 'المخزن الرئيسي') {
                            st = parseFloat(v.stock) || 0;
                        }
                        availQty += st;
                    });
                } else {
                    if (typeof getWarehouseStock === 'function') {
                        availQty = getWarehouseStock(p.name, whName);
                    } else if (p.warehouseStocks && p.warehouseStocks[whName] !== undefined) {
                        availQty = parseFloat(p.warehouseStocks[whName]) || 0;
                    } else if (whName === 'المخزن الرئيسي') {
                        availQty = parseFloat(p.stock) || 0;
                    }
                }

                grandTotalStock += availQty;
                whRowsData.push({
                    warehouse: whName,
                    qty: availQty
                });
            });

            // 🌟 الترتيب التنازلي: المخزن صاحب أعلى رصيد يظهر في البداية
            whRowsData.sort((a, b) => b.qty - a.qty);

            // تحديث شارة الإجمالي الكلي
            const totalBadge = document.getElementById('inquiryTotalStockBadge');
            if (totalBadge) {
                totalBadge.textContent = `الإجمالي: ${grandTotalStock.toFixed(2).replace(/\.00$/, '')} ${p.unit || 'قطعة'}`;
            }

            // تحديث زر الإجراءات (عرض كل المخازن)
            const actionsEl = document.getElementById('inquiryWarehouseActions');
            if (actionsEl) {
                if (selectedSectionInquiryWarehouse !== 'all') {
                    actionsEl.innerHTML = `
                        <button onclick="window.setSectionInquirySelectedWarehouse('all')"
                            style="background: #e0f2fe; color: #0369a1; border: 1.5px solid #bae6fd; padding: 4px 12px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: 0.2s;"
                            title="إلغاء التحديد والرجوع لعرض كل المخازن">
                            <span>↺</span> عرض كل المخازن
                        </button>
                    `;
                } else {
                    actionsEl.innerHTML = `
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">💡 حدد أي مخزن للتركيز على تشكيلته بالأسفل</span>
                    `;
                }
            }

            // رسم أسطر جدول المخازن مع عمود التحديد
            stockTableBody.innerHTML = whRowsData.map((row, idx) => {
                const isSelected = selectedSectionInquiryWarehouse === row.warehouse;
                const safeWh = String(row.warehouse || '').replace(/'/g, "\\'");
                const hasPositiveStock = row.qty > 0;
                const isLow = row.qty > 0 && row.qty <= (p.minStock || 5);
                
                let statusBadge = '';
                if (!hasPositiveStock) {
                    statusBadge = '<span style="background: #fee2e2; color: #ef4444; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 800;">نفذت الكمية</span>';
                } else if (isLow) {
                    statusBadge = '<span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 800;">مخزون منخفض</span>';
                } else {
                    statusBadge = '<span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 800;">متوفر</span>';
                }

                const isUserActiveWh = window.currentUser && window.currentUser.warehouseName === row.warehouse;

                return `
                    <tr onclick="window.setSectionInquirySelectedWarehouse('${safeWh}')"
                        title="انقر لتحديد (${row.warehouse}) وعرض تفاصيل تشكيلته بالأسفل"
                        style="border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: all 0.15s; ${isSelected ? 'background: #ecfdf5; outline: 2px solid #10b981;' : (idx % 2 === 1 ? 'background: #fafafa;' : 'background: #ffffff;')}"
                        onmouseover="if(!${isSelected}) this.style.background='#f0fdf4';"
                        onmouseout="if(!${isSelected}) this.style.background='${idx % 2 === 1 ? '#fafafa' : '#ffffff'}';">
                        <td style="padding: 8px 6px; text-align: center;" onclick="event.stopPropagation(); window.setSectionInquirySelectedWarehouse('${safeWh}');">
                            <input type="radio" name="sectionInquiryWarehouseRadio" value="${safeWh}" 
                                ${isSelected ? 'checked' : ''} 
                                style="cursor: pointer; width: 17px; height: 17px; accent-color: #059669; vertical-align: middle;">
                        </td>
                        <td style="padding: 10px 10px; font-weight: 800; color: #64748b; text-align: center;">${idx + 1}</td>
                        <td style="padding: 10px 14px; font-weight: 900; color: ${isSelected ? '#065f46' : '#1e293b'}; text-align: right;">
                            🏢 ${row.warehouse} 
                            ${isSelected ? '<span style="color: #047857; font-size: 0.76rem; font-weight: 900; background: #dcfce7; border: 1px solid #86efac; padding: 1px 7px; border-radius: 6px; margin-right: 6px;">✓ محدد</span>' : ''}
                            ${isUserActiveWh ? '<span style="color: #0284c7; font-size: 0.74rem; font-weight: 800; margin-right: 4px;">(مخزنك الحالي)</span>' : ''}
                        </td>
                        <td style="padding: 10px 12px; text-align: center; font-weight: 900; font-size: 1rem; color: #1e293b;">
                            <span style="background: ${hasPositiveStock ? '#ecfdf5' : '#f8fafc'}; color: ${hasPositiveStock ? '#047857' : '#94a3b8'}; border: 1.5px solid ${hasPositiveStock ? '#a7f3d0' : '#e2e8f0'}; padding: 3px 14px; border-radius: 8px; display: inline-block; min-width: 60px;">
                                ${row.qty.toFixed(2).replace(/\.00$/, '')} ${p.unit || 'قطعة'}
                            </span>
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">${statusBadge}</td>
                    </tr>
                `;
            }).join('');
        }

        /**
         * بناء جدول التشكيلات التفاعلي مع شريط الفلاتر وعمود المخزن المختار
         */
        function renderSectionInquiryVariantsTable() {
            const p = currentSectionInquiryProduct;
            if (!p) return;

            const variantsContainer = document.getElementById('inquiryVariantsContainer');
            const variantsTableHead = document.getElementById('inquiryVariantsTableHead');
            const variantsTableBody = document.getElementById('inquiryVariantsTableBody');
            const variantsCountBadge = document.getElementById('inquiryVariantsCountBadge');
            const selectedWhBadge = document.getElementById('inquirySelectedWhBadge');
            const filterBar = document.getElementById('inquiryVariantsFilterBar');

            if (!variantsContainer || !variantsTableBody) return;

            const variants = (p.variants && Array.isArray(p.variants) && p.variants.length > 0) ? p.variants : [];
            if (variants.length === 0) {
                variantsContainer.style.display = 'none';
                return;
            }

            variantsContainer.style.display = 'block';

            // استخراج المقاسات والألوان الفريدة
            const allSizes = [...new Set(variants.map(v => (v.size && String(v.size).trim()) || ''))].filter(Boolean);
            const allColors = [...new Set(variants.map(v => (v.color && String(v.color).trim()) || ''))].filter(Boolean);

            // تصفية التشكيلات حسب الفلتر المختار
            const matchedVars = variants.filter(v => 
                (selectedSectionInquirySize === 'all' || String(v.size || '').trim() === selectedSectionInquirySize) &&
                (selectedSectionInquiryColor === 'all' || String(v.color || '').trim() === selectedSectionInquiryColor)
            );

            // تحديث شارات التشكيلات
            if (variantsCountBadge) {
                variantsCountBadge.textContent = (matchedVars.length === variants.length)
                    ? `${variants.length} تشكيلة`
                    : `${matchedVars.length} من ${variants.length} تشكيلة`;
            }

            if (selectedWhBadge) {
                if (selectedSectionInquiryWarehouse !== 'all') {
                    selectedWhBadge.style.display = 'inline-block';
                    selectedWhBadge.innerHTML = `🏢 مخزن محدد: <b>${selectedSectionInquiryWarehouse}</b>`;
                } else {
                    selectedWhBadge.style.display = 'none';
                }
            }

            // رسم شريط فلاتر المقاس واللون
            if (filterBar) {
                if (allSizes.length > 0 || allColors.length > 0 || selectedSectionInquiryWarehouse !== 'all') {
                    const sizeOpts = allSizes.map(s => `<option value="${s}" ${selectedSectionInquirySize === s ? 'selected' : ''}>مقاس: ${s}</option>`).join('');
                    const colorOpts = allColors.map(c => `<option value="${c}" ${selectedSectionInquiryColor === c ? 'selected' : ''}>لون: ${c}</option>`).join('');
                    
                    filterBar.innerHTML = `
                        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 8px 14px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <span style="font-weight: 800; color: #1e293b; font-size: 0.85rem; display: flex; align-items: center; gap: 5px;">
                                <span>👗</span> فلترة التشكيلة:
                            </span>
                            
                            ${allSizes.length > 0 ? `
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <label style="font-weight: 800; font-size: 0.8rem; color: #047857;">المقاس:</label>
                                    <select onchange="window.setSectionInquiryVariantFilter('size', this.value)"
                                        style="padding: 5px 10px; border-radius: 8px; border: 1.5px solid #a7f3d0; background: #ecfdf5; color: #047857; font-weight: 900; font-size: 0.82rem; outline: none; cursor: pointer;">
                                        <option value="all" ${selectedSectionInquirySize === 'all' ? 'selected' : ''}>كل المقاسات (${allSizes.length})</option>
                                        ${sizeOpts}
                                    </select>
                                </div>
                            ` : ''}

                            ${allColors.length > 0 ? `
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <label style="font-weight: 800; font-size: 0.8rem; color: #1d4ed8;">اللون:</label>
                                    <select onchange="window.setSectionInquiryVariantFilter('color', this.value)"
                                        style="padding: 5px 10px; border-radius: 8px; border: 1.5px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; font-weight: 900; font-size: 0.82rem; outline: none; cursor: pointer;">
                                        <option value="all" ${selectedSectionInquiryColor === 'all' ? 'selected' : ''}>كل الألوان (${allColors.length})</option>
                                        ${colorOpts}
                                    </select>
                                </div>
                            ` : ''}

                            ${(selectedSectionInquirySize !== 'all' || selectedSectionInquiryColor !== 'all') ? `
                                <button onclick="window.setSectionInquiryVariantFilter('reset')"
                                    style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.78rem; cursor: pointer;">
                                    ✕ إظهار الكل
                                </button>
                            ` : ''}

                            ${selectedSectionInquiryWarehouse !== 'all' ? `
                                <div style="margin-right: auto; display: flex; align-items: center; gap: 6px;">
                                    <span style="background: #fef08a; color: #854d0e; border: 1px solid #fde047; padding: 3px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 900;">
                                        🏢 المخزن النشط: <b>${selectedSectionInquiryWarehouse}</b>
                                    </span>
                                    <button onclick="window.setSectionInquirySelectedWarehouse('all')" 
                                        style="background: #ffffff; color: #64748b; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; font-size: 0.76rem; font-weight: 800; cursor: pointer;"
                                        title="الرجوع لعرض إجمالي كل المخازن">
                                        عرض الكل ↺
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                } else {
                    filterBar.innerHTML = '';
                }
            }

            // فحص صلاحيات أسعار الجملة والتكلفة
            const posSettings = JSON.parse(getStore('pos_settings') || '{}');
            const allowInquiryCost = posSettings.showInquiryCostPrice !== undefined ? !!posSettings.showInquiryCostPrice : false;
            const canViewCost = allowInquiryCost && (typeof checkPermission === 'function' ? checkPermission('docs_purchase_price') : true);

            // استخراج قائمة المخازن والفروع
            let allWarehouses = (window.warehouses && window.warehouses.length > 0) ? window.warehouses.map(w => w.name) : [];
            if (allWarehouses.length === 0 && typeof getStore === 'function' && getStore('pos_warehouses')) {
                try {
                    const parsedWh = JSON.parse(getStore('pos_warehouses'));
                    if (Array.isArray(parsedWh)) allWarehouses = parsedWh.map(w => w.name);
                } catch(e) {}
            }
            if (!allWarehouses.includes('المخزن الرئيسي')) allWarehouses.unshift('المخزن الرئيسي');
            const mainStoreName = 'المخزن الرئيسي';
            const branches = allWarehouses.filter(w => w !== mainStoreName);
            const isSingleWh = selectedSectionInquiryWarehouse !== 'all';

            // ترويسة جدول التشكيلات الديناميكية
            if (variantsTableHead) {
                let thHtml = `
                    <tr>
                        <th style="width: 35px; padding: 8px 4px; text-align: center;">#</th>
                        <th style="padding: 8px; text-align: center;">المقاس (Size)</th>
                        <th style="padding: 8px; text-align: center;">اللون (Color)</th>
                `;
                if (isSingleWh) {
                    thHtml += `
                        <th style="padding: 8px 12px; text-align: center; background: #fef08a; color: #854d0e; font-weight: 900; border-right: 2px solid #fde047; border-left: 2px solid #fde047;">
                            رصيد (${selectedSectionInquiryWarehouse})
                        </th>
                        <th style="padding: 8px 8px; text-align: center; background: #e0f2fe; color: #0369a1;">إجمالي الفروع</th>
                    `;
                } else {
                    thHtml += `<th style="padding: 8px 6px; text-align: center; background: rgba(255,255,255,0.1); border-right: 1px solid rgba(255,255,255,0.2);">${mainStoreName}</th>`;
                    branches.forEach(b => {
                        thHtml += `<th style="padding: 8px 6px; text-align: center; background: rgba(255,255,255,0.05);">${b}</th>`;
                    });
                    if (branches.length > 0) {
                        thHtml += `<th style="padding: 8px 6px; text-align: center; background: #e0f2fe; color: #0369a1;">إجمالي الفروع</th>`;
                    }
                }
                thHtml += `
                        <th style="padding: 8px 8px; text-align: center; background: #166534; color: white;">الرصيد الكلي</th>
                        <th style="padding: 8px 8px; text-align: center;">سعر القطاعي</th>
                        ${canViewCost ? '<th style="padding: 8px 8px; text-align: center;">سعر الجملة</th>' : ''}
                        <th style="padding: 8px 8px; text-align: center;">الباركود الفريد</th>
                    </tr>
                `;
                variantsTableHead.innerHTML = thHtml;
            }

            // رسم أسطر التشكيلات
            if (matchedVars.length === 0) {
                variantsTableBody.innerHTML = `
                    <tr>
                        <td colspan="12" style="padding: 25px; text-align: center; color: #94a3b8; font-weight: 800; font-size: 0.95rem;">
                            ⚠️ لا توجد تشكيلات مطابقة للمقاس واللون المحددين
                        </td>
                    </tr>
                `;
            } else {
                variantsTableBody.innerHTML = matchedVars.map((v, idx) => {
                    const vRetail = parseFloat(v.price !== undefined ? v.price : p.price) || 0;
                    const vWs = parseFloat(v.wholesale !== undefined ? v.wholesale : (v.wholesalePrice !== undefined ? v.wholesalePrice : p.wholesale)) || 0;
                    
                    let mainStock = 0;
                    let branchesStockTotal = 0;
                    let totalStock = 0;
                    let selectedWhStock = 0;
                    let branchesCells = '';

                    if (v.warehouseStocks && typeof v.warehouseStocks === 'object') {
                        mainStock = parseFloat(v.warehouseStocks[mainStoreName]) || 0;
                        branches.forEach(b => {
                            const bStock = parseFloat(v.warehouseStocks[b]) || 0;
                            branchesStockTotal += bStock;
                            branchesCells += `<td style="padding: 8px; text-align: center; font-weight: 800; color: ${bStock > 0 ? '#0f766e' : '#94a3b8'}; background: #f8fafc;">${bStock > 0 ? bStock : '-'}</td>`;
                        });
                        totalStock = mainStock + branchesStockTotal;
                        
                        if (isSingleWh) {
                            if (v.warehouseStocks[selectedSectionInquiryWarehouse] !== undefined) {
                                selectedWhStock = parseFloat(v.warehouseStocks[selectedSectionInquiryWarehouse]) || 0;
                            } else if (selectedSectionInquiryWarehouse === mainStoreName) {
                                selectedWhStock = mainStock;
                            }
                        }
                    } else {
                        totalStock = parseFloat(v.stock !== undefined ? v.stock : 0);
                        mainStock = totalStock;
                        branches.forEach(b => {
                            branchesCells += `<td style="padding: 8px; text-align: center; font-weight: 800; color: #94a3b8; background: #f8fafc;">-</td>`;
                        });
                        if (isSingleWh) {
                            selectedWhStock = (selectedSectionInquiryWarehouse === mainStoreName) ? totalStock : 0;
                        }
                    }

                    const formatStockBadge = (qty, bgOk = '#dcfce7', colorOk = '#15803d') => {
                        if (qty <= 0) return `<span class="inquiry-stock-badge zero" style="background: #fee2e2; color: #ef4444; padding: 2px 8px; border-radius: 8px; font-weight: 900; font-size: 0.8rem;">0</span>`;
                        return `<span class="inquiry-stock-badge positive" style="background: ${bgOk}; color: ${colorOk}; padding: 2px 8px; border-radius: 8px; font-weight: 900; font-size: 0.85rem;">${qty}</span>`;
                    };

                    const safeBarcode = String(v.barcode || '').replace(/'/g, "\\'");
                    const barcodeCell = v.barcode 
                        ? `<span class="inquiry-barcode-badge" onclick="copyInquiryBarcode('${safeBarcode}', this)" title="انقر لنسخ الباركود" style="cursor: pointer; font-family: monospace; font-weight: bold; color: #2563eb; background: #eff6ff; padding: 2px 8px; border-radius: 6px; border: 1px dashed #93c5fd; display: inline-flex; align-items: center; gap: 4px; transition: 0.15s;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">📋 ${v.barcode}</span>`
                        : `<span style="color: #94a3b8;">---</span>`;

                    return `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; font-weight: 800; color: #64748b; text-align: center;">${idx + 1}</td>
                            <td style="padding: 8px; text-align: center;"><span class="inquiry-variant-size-badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 6px; font-weight: 900;">${v.size || 'قياسي'}</span></td>
                            <td style="padding: 8px; text-align: center;"><span class="inquiry-variant-color-badge" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px; font-weight: 900;">${v.color || 'موحد'}</span></td>
                            ${isSingleWh ? `
                                <td style="padding: 8px; text-align: center; background: #fefce8; border-right: 2px solid #fef08a; border-left: 2px solid #fde047;">${formatStockBadge(selectedWhStock, '#fef08a', '#854d0e')}</td>
                                <td style="padding: 8px; text-align: center; background: #f1f5f9;">${formatStockBadge(branchesStockTotal, '#e0f2fe', '#0369a1')}</td>
                            ` : `
                                <td style="padding: 8px; border-right: 1px solid #e2e8f0; background: #f1f5f9; text-align: center;">${formatStockBadge(mainStock)}</td>
                                ${branchesCells}
                                ${branches.length > 0 ? `<td style="padding: 8px; border-left: 1px solid #e2e8f0; background: #f1f5f9; text-align: center;">${formatStockBadge(branchesStockTotal, '#e0f2fe', '#0369a1')}</td>` : ''}
                            `}
                            <td style="padding: 8px; background: #ecfdf5; text-align: center;">${formatStockBadge(totalStock, '#dcfce7', '#15803d')}</td>
                            <td style="padding: 8px; font-weight: 900; color: #1e3a8a; text-align: center;">${vRetail.toFixed(2)} ج.م</td>
                            ${canViewCost ? `<td style="padding: 8px; font-weight: 800; color: #166534; text-align: center;">${vWs.toFixed(2)} ج.م</td>` : ''}
                            <td style="padding: 8px; text-align: center;">${barcodeCell}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // --- وظائف المشاركة والطباعة الفورية ---

        function buildInvoiceHTML(data, templateChoice) {
    const itemsHtml = data.items.map(item => {
        const unitName = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');
        return `
            <tr style="border-bottom:1px solid #ddd; font-style:normal !important;">
                <td style="padding:5px; text-align:right; font-style:normal !important; font-weight:bold;">${item.name}</td>
                <td style="padding:5px; text-align:center; font-style:normal !important; font-weight:bold;">${item.qty} ${unitName}</td>
                <td style="padding:5px; text-align:center; font-style:normal !important; font-weight:bold;">${(parseFloat(item.price) || 0).toFixed(2)}</td>
                <td style="padding:5px; text-align:left; font-style:normal !important; font-weight:bold;">${((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0)).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const compactItemsHtml = data.items.map(item => {
        const unitName = item.selectedUnit ? (typeof item.selectedUnit === 'object' ? item.selectedUnit.unitName : item.selectedUnit) : (item.unit || 'قطعة');
        return `
            <tr style="font-style:normal !important; border-bottom:1px solid #ccc;">
                <td style="text-align:right; font-style:normal !important; font-weight:900; color:#000; padding:2px 0;">${item.name}</td>
                <td style="text-align:center; font-style:normal !important; font-weight:900; color:#000; padding:2px 0;">${item.qty}</td>
                <td style="text-align:left; font-style:normal !important; font-weight:900; color:#000; padding:2px 0;">${((parseFloat(item.price) || 0) * (parseFloat(item.qty) || 0)).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    let layout = '';

    if (templateChoice === 'A4 Professional' || templateChoice === 'A4') {
        layout = `
            <div class="print-container" style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction:rtl; padding:40px; background:#fff; color:#333; font-style:normal !important;">
                <div style="display:flex; justify-content:space-between; border-bottom:2px solid #2c3e50; padding-bottom:20px; margin-bottom:30px;">
                    <div>
                        <h1 style="margin:0; color:#2c3e50; font-size:2rem; font-style:normal !important;">${data.shopName}</h1>
                        <p style="margin:5px 0 0 0; color:#7f8c8d; font-style:normal !important;">${data.shopAddress}</p>
                        <p style="margin:5px 0 0 0; color:#7f8c8d; font-style:normal !important;">${data.shopPhone}</p>
                    </div>
                    <div style="text-align:left;">
                        <h2 style="margin:0; color:#e74c3c; font-size:1.8rem; font-style:normal !important;">${data.title}</h2>
                        <p style="margin:5px 0 0 0; font-weight:bold; font-style:normal !important;">رقم المستند: #${data.id}</p>
                        <p style="margin:5px 0 0 0; font-style:normal !important;">التاريخ: ${data.date}</p>
                    </div>
                </div>

                <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:30px; display:flex; justify-content:space-between;">
                    <div>
                        <strong style="color:#2c3e50; font-style:normal !important;">${data.partnerLabel}:</strong> ${data.partnerName} <br>
                        ${data.partnerAddress ? `<span style="color:#7f8c8d; font-style:normal !important;">العنوان: ${data.partnerAddress}</span>` : ''}
                    </div>
                    <div style="text-align:left;">
                        <strong style="color:#2c3e50; font-style:normal !important;">الكاشير:</strong> ${data.cashier}<br>
                        <strong style="color:#2c3e50; font-style:normal !important;">طريقة الدفع:</strong> ${data.paymentMethod}
                    </div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
                    <thead>
                        <tr style="background:#2c3e50; color:white;">
                            <th style="padding:12px; text-align:right; border:1px solid #34495e; font-style:normal !important;">الصنف</th>
                            <th style="padding:12px; text-align:center; border:1px solid #34495e; font-style:normal !important;">الكمية</th>
                            <th style="padding:12px; text-align:center; border:1px solid #34495e; font-style:normal !important;">سعر الوحدة</th>
                            <th style="padding:12px; text-align:left; border:1px solid #34495e; font-style:normal !important;">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="display:flex; justify-content:flex-end;">
                    <div style="width:300px; background:#f9f9f9; padding:20px; border-radius:8px; border:1px solid #eee;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:1.2rem; font-weight:bold; color:#2c3e50;">
                            <span style="font-style:normal !important;">الإجمالي الكلي:</span>
                            <span style="font-style:normal !important;">${data.total.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:#27ae60;">
                            <span style="font-style:normal !important;">المدفوع:</span>
                            <span style="font-style:normal !important;">${data.paid.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; color:#c0392b; font-weight:bold;">
                            <span style="font-style:normal !important;">المتبقي:</span>
                            <span style="font-style:normal !important;">${data.credit.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-top:50px; text-align:center; border-top:1px solid #ddd; padding-top:20px; color:#7f8c8d; font-style:normal !important;">
                    <p style="font-style:normal !important;">${data.footerMsg}</p>
                </div>
            </div>
        `;
    } else if (templateChoice === 'A5 Modern' || templateChoice === 'A5') {
        layout = `
            <div class="print-container" style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction:rtl; padding:20px; background:#fff; color:#333; font-style:normal !important;">
                <div style="text-align:center; margin-bottom:20px;">
                    <h1 style="margin:0; color:#34495e; font-size:1.6rem; font-style:normal !important;">${data.shopName}</h1>
                    <h2 style="margin:5px 0 0 0; color:#e67e22; font-size:1.2rem; font-style:normal !important;">${data.title}</h2>
                </div>

                <table style="width:100%; font-size:0.9rem; margin-bottom:15px;">
                    <tr>
                        <td style="width:50%; font-style:normal !important;"><b>رقم:</b> #${data.id}</td>
                        <td style="width:50%; text-align:left; font-style:normal !important;"><b>التاريخ:</b> ${data.date}</td>
                    </tr>
                    <tr>
                        <td style="width:50%; font-style:normal !important;"><b>${data.partnerLabel}:</b> ${data.partnerName}</td>
                        <td style="width:50%; text-align:left; font-style:normal !important;"><b>الدفع:</b> ${data.paymentMethod}</td>
                    </tr>
                </table>

                <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:0.9rem;">
                    <thead>
                        <tr style="background:#ecf0f1; border-bottom:2px solid #bdc3c7;">
                            <th style="padding:8px; text-align:right; font-style:normal !important;">الصنف</th>
                            <th style="padding:8px; text-align:center; font-style:normal !important;">الكمية</th>
                            <th style="padding:8px; text-align:center; font-style:normal !important;">السعر</th>
                            <th style="padding:8px; text-align:left; font-style:normal !important;">إجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <table style="width:100%; font-size:1rem; border-top:2px solid #34495e; padding-top:10px;">
                    <tr>
                        <td style="font-weight:bold; font-style:normal !important;">الصافي المطلوب:</td>
                        <td style="text-align:left; font-weight:bold; font-size:1.2rem; font-style:normal !important;">${data.total.toFixed(2)} ج.م</td>
                    </tr>
                    ${data.credit > 0 ? `
                    <tr>
                        <td style="color:#27ae60; font-size:0.9rem; font-style:normal !important;">المدفوع: ${data.paid.toFixed(2)}</td>
                        <td style="text-align:left; color:#c0392b; font-size:0.9rem; font-style:normal !important;">المتبقي: ${data.credit.toFixed(2)}</td>
                    </tr>` : ''}
                </table>

                <div style="text-align:center; margin-top:30px; font-size:0.8rem; color:#7f8c8d; font-style:normal !important;">
                    ${data.footerMsg}
                </div>
            </div>
        `;
    } else if (templateChoice === '57mm Mobile' || templateChoice === '57mm') {
        layout = `
            <div class="print-container" style="width:57mm; font-family:Arial, sans-serif; direction:rtl; padding:2mm; margin:0 auto; color:#000; font-size:11px; font-style:normal !important; font-weight:bold;">
                <div style="text-align:center; margin-bottom:5px; border-bottom:1px dashed #000; padding-bottom:5px;">
                    <strong style="font-size:14px; font-style:normal !important;">${data.shopName}</strong><br>
                    <span style="font-style:normal !important;">${data.title}</span>
                </div>
                <div style="margin-bottom:5px; font-style:normal !important;">
                    #${data.id} | ${data.date}<br>
                    ${data.partnerLabel}: ${data.partnerName}<br>
                    الدفع: ${data.paymentMethod}
                </div>
                <table style="width:100%; border-collapse:collapse; margin-bottom:5px; border-top:1px dashed #000; border-bottom:1px dashed #000;">
                    <tr style="border-bottom:1px solid #000;">
                        <th style="text-align:right; font-style:normal !important;">الصنف</th>
                        <th style="text-align:center; font-style:normal !important;">ك</th>
                        <th style="text-align:left; font-style:normal !important;">ق</th>
                    </tr>
                    ${compactItemsHtml}
                </table>
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:13px; font-style:normal !important;">
                    <span style="font-style:normal !important;">المطلوب:</span>
                    <span style="font-style:normal !important;">${data.total.toFixed(2)}</span>
                </div>
                ${data.credit > 0 ? `
                <div style="display:flex; justify-content:space-between; font-size:11px; font-style:normal !important;">
                    <span style="font-style:normal !important;">مدفوع:</span><span style="font-style:normal !important;">${data.paid.toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px; font-style:normal !important;">
                    <span style="font-style:normal !important;">باقي:</span><span style="font-style:normal !important;">${data.credit.toFixed(2)}</span>
                </div>` : ''}
                <div style="text-align:center; margin-top:5px; border-top:1px dashed #000; padding-top:5px; font-size:10px; font-style:normal !important;">
                    ${data.footerMsg}
                </div>
            </div>
        `;
    } else if (templateChoice === '80mm Compact') {
         layout = `
            <div class="print-container" style="width:80mm; font-family:Arial, sans-serif; direction:rtl; padding:3mm; margin:0 auto; color:#000; font-size:13px; font-style:normal !important; font-weight:900;">
                <div style="text-align:center; margin-bottom:5px; border-bottom:2px solid #000; padding-bottom:5px;">
                    <strong style="font-size:22px; font-weight:900; color:#000; font-style:normal !important;">${data.shopName}</strong><br>
                    ${data.shopAddress ? `<span style="font-size:14px; font-weight:900; color:#000; font-style:normal !important;">${data.shopAddress}</span><br>` : ''}
                    ${data.shopPhone ? `<span style="font-size:14px; font-weight:900; color:#000; font-style:normal !important;">ت: ${data.shopPhone}</span><br>` : ''}
                    <span style="font-size:16px; font-weight:900; border:2px solid #000; padding:2px 10px; display:inline-block; margin-top:5px; font-style:normal !important;">${data.title}</span>
                </div>

                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:900; margin-bottom:5px; font-style:normal !important; color:#000;">
                    <div style="text-align:right;">
                        <span style="font-style:normal !important;">كاشير: ${data.cashier}</span><br>
                        <span style="font-style:normal !important;">التاريخ: ${data.date}</span>
                    </div>
                    <div style="text-align:left;">
                        <span style="font-size:15px; font-style:normal !important;">رقم: #${data.id}</span>
                    </div>
                </div>

                <div style="font-size:13px; font-weight:900; border-bottom:2px solid #000; padding-bottom:3px; margin-bottom:5px; font-style:normal !important; color:#000;">
                    <div style="font-style:normal !important;">${data.partnerLabel}: ${data.partnerName}</div>
                    <div style="font-style:normal !important;">الدفع: ${data.paymentMethod}</div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:5px; border-top:2px solid #000; border-bottom:2px solid #000; font-weight:900; color:#000;">
                    <thead>
                        <tr style="border-bottom:2px solid #000;">
                            <th style="text-align:right; padding:2px; font-size:16px; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000; font-style:normal !important;">الصنف</th>
                            <th style="text-align:center; padding:2px; font-size:16px; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000; font-style:normal !important;">الكمية</th>
                            <th style="text-align:left; padding:2px; font-size:16px; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000; font-style:normal !important;">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${compactItemsHtml}
                    </tbody>
                </table>

                <div style="margin-bottom:5px; font-weight:900; font-size:14px; font-style:normal !important; color:#000;">
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">مبلغ الفاتورة:</span>
                        <span style="font-style:normal !important;">${(data.invoiceAmount || data.total).toFixed(2)}</span>
                    </div>
                    ${(data.prevBalance && data.prevBalance > 0) ? `
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">الرصيد السابق للعميل:</span>
                        <span style="font-style:normal !important;">${data.prevBalance.toFixed(2)}</span>
                    </div>` : ''}
                    <div style="display:flex; justify-content:space-between; font-size:17px; border-top:2px dashed #000; border-bottom:2px dashed #000; margin:3px 0; padding:2px 0; font-style:normal !important;">
                        <span style="font-style:normal !important;">الإجمالي المستحق:</span>
                        <span style="font-style:normal !important;">${data.total.toFixed(2)} ج.م</span>
                    </div>
                    ${data.credit > 0 ? `
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">المدفوع:</span>
                        <span style="font-style:normal !important;">${data.paid.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">الرصيد النهائي:</span>
                        <span style="font-style:normal !important;">${data.credit.toFixed(2)}</span>
                    </div>` : ''}
                </div>

                <div style="text-align:center; margin-top:10px; font-size:15px; font-weight:900; color:#000; font-style:normal !important;">
                    ${data.footerMsg}
                </div>
            </div>
        `;
    } else {
        // Default: 80mm Standard
        layout = `
            <div class="print-container" style="width:80mm; font-family:'Arial', 'Segoe UI', sans-serif; direction:rtl; padding:5px; color:#000; box-sizing:border-box; line-height:1.5; font-weight:bold; font-style:normal !important;">
                <div style="text-align:center; border-bottom:3px solid #000; padding-bottom:5px; margin-bottom:10px; font-style:normal !important;">
                    <div style="font-size:24px; font-weight:bold; font-style:normal !important;">${data.shopName}</div>
                    <div style="font-size:18px; font-weight:bold; border:2px solid #000; display:inline-block; padding:3px 15px; margin-top:5px; font-style:normal !important;">${data.title}</div>
                </div>

                <div style="font-size:13px; font-weight:bold; margin-bottom:10px; border-bottom:2px solid #000; padding-bottom:5px; font-style:normal !important;">
                    <div style="display:flex; justify-content:space-between; font-style:normal !important;">
                        <span style="font-style:normal !important;">رقم: #${data.id}</span>
                        <span style="font-style:normal !important;">التاريخ: ${data.date}</span>
                    </div>
                    <div style="margin-top:3px; font-style:normal !important;">${data.partnerLabel}: ${data.partnerName} ${data.partnerAddress ? ' (' + data.partnerAddress + ')' : ''}</div>
                    <div style="display:flex; justify-content:space-between; margin-top:3px; font-style:normal !important;">
                        <span style="font-style:normal !important;">كاشير: ${data.cashier}</span>
                        <span style="font-style:normal !important;">الدفع: ${data.paymentMethod}</span>
                    </div>
                </div>

                <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:10px; border:2px solid #000; font-weight:bold; font-style:normal !important;">
                    <thead>
                        <tr style="border-bottom:2px solid #000; background:#fff; font-style:normal !important;">
                            <th style="text-align:right; padding:5px 2px; border-left:1px solid #000; font-size:15px; font-style:normal !important; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000;">الصنف</th>
                            <th style="padding:5px 2px; border-left:1px solid #000; font-size:15px; font-style:normal !important; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000;">الكمية</th>
                            <th style="padding:5px 2px; border-left:1px solid #000; font-size:15px; font-style:normal !important; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000;">السعر</th>
                            <th style="text-align:left; padding:5px 2px; font-size:15px; font-style:normal !important; font-weight:900; color:#000; -webkit-text-stroke:0.5px #000;">إجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="margin-bottom:10px; font-size:14px; font-style:normal !important;">
                    <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:900; border-top:2px solid #000; border-bottom:2px solid #000; padding:5px 0; margin-bottom:5px; font-style:normal !important;">
                        <span style="font-style:normal !important;">صافي المطلوب:</span>
                        <span style="font-style:normal !important;">${data.total.toFixed(2)}</span>
                    </div>
                    ${data.credit > 0 ? `
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px; font-style:normal !important;">
                        <span style="font-style:normal !important;">المدفوع:</span>
                        <span style="font-style:normal !important;">${data.paid.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px; font-style:normal !important;">
                        <span style="font-style:normal !important;">المتبقي:</span>
                        <span style="font-style:normal !important;">${data.credit.toFixed(2)}</span>
                    </div>` : ''}
                </div>

                <div style="text-align:center; border-top:2px dashed #000; padding-top:10px; font-size:12px; font-style:normal !important;">
                    ${data.footerMsg}
                </div>
            </div>
        `;
    }

    return layout;
}

// ============================================================
//  تعبئة ومزامنة القوائم المنسدلة للمخازن عبر شاشات النظام
// ============================================================
function populateWarehouseDropdowns() {
    let whList = [];

    // 1. من مصفوفة المخازن العامة
    if (window.warehouses && Array.isArray(window.warehouses) && window.warehouses.length > 0) {
        window.warehouses.forEach(w => {
            const name = (typeof w === 'object' && w) ? (w.name || w.warehouseName) : String(w);
            if (name && !whList.includes(name)) whList.push(name);
        });
    }

    // 2. من المخزن المحلي (pos_warehouses)
    if (typeof getStore === 'function' && getStore('pos_warehouses')) {
        try {
            const stored = JSON.parse(getStore('pos_warehouses'));
            if (Array.isArray(stored)) {
                stored.forEach(w => {
                    const name = (typeof w === 'object' && w) ? (w.name || w.warehouseName) : String(w);
                    if (name && !whList.includes(name)) whList.push(name);
                });
            }
        } catch (e) {}
    }

    // 3. من بيانات الأصناف والتشكيلات المخزنية
    if (typeof productsDB !== 'undefined' && Array.isArray(productsDB)) {
        productsDB.forEach(p => {
            if (!p) return;
            if (p.warehouseStocks && typeof p.warehouseStocks === 'object') {
                Object.keys(p.warehouseStocks).forEach(k => { if (k && !whList.includes(k)) whList.push(k); });
            }
            if (p.variants && Array.isArray(p.variants)) {
                p.variants.forEach(v => {
                    if (v && v.warehouseStocks && typeof v.warehouseStocks === 'object') {
                        Object.keys(v.warehouseStocks).forEach(k => { if (k && !whList.includes(k)) whList.push(k); });
                    }
                });
            }
        });
    }

    // 4. من سجل الحركات والفواتير السابقة
    if (typeof transactions !== 'undefined' && Array.isArray(transactions)) {
        transactions.forEach(t => {
            if (!t) return;
            if (t.warehouse && !whList.includes(t.warehouse)) whList.push(t.warehouse);
            if (t.sourceWarehouse && !whList.includes(t.sourceWarehouse)) whList.push(t.sourceWarehouse);
            if (t.toWarehouse && !whList.includes(t.toWarehouse)) whList.push(t.toWarehouse);
            if (t.destWarehouse && !whList.includes(t.destWarehouse)) whList.push(t.destWarehouse);
        });
    }

    // ضمان وجود المخزن الرئيسي كخيار افتراضي
    if (!whList.includes('المخزن الرئيسي')) {
        whList.unshift('المخزن الرئيسي');
    }

    // تعبئة القائمة في تقرير الحركة اليومية
    const dailySelect = document.getElementById('dailyReportWarehouseSelect');
    if (dailySelect) {
        const currentDailyVal = dailySelect.value || 'all';
        let dailyOpts = '<option value="all">🏢 كافة المخازن والفروع</option>';
        whList.forEach(wh => {
            dailyOpts += `<option value="${wh}">🏢 ${wh}</option>`;
        });
        dailySelect.innerHTML = dailyOpts;
        if (whList.includes(currentDailyVal) || currentDailyVal === 'all') {
            dailySelect.value = currentDailyVal;
        } else {
            dailySelect.value = 'all';
        }
    }

    // تعبئة القائمة في شاشة حركة الصنف
    const histSelect = document.getElementById('historyWarehouseFilter');
    if (histSelect) {
        const currentHistVal = histSelect.value || 'all';
        let histOpts = '<option value="all">🏢 كافة المخازن</option>';
        whList.forEach(wh => {
            histOpts += `<option value="${wh}">🏢 ${wh}</option>`;
        });
        histSelect.innerHTML = histOpts;
        if (whList.includes(currentHistVal) || currentHistVal === 'all') {
            histSelect.value = currentHistVal;
        } else {
            histSelect.value = 'all';
        }
    }
}
window.populateWarehouseDropdowns = populateWarehouseDropdowns;

// 🔒 فحص أمني مركزي: هل مبالغ تقرير الحركة اليومية محمية حالياً وتتطلب إذن المدير؟
function isDailyReportAmountsProtected() {
    const isHidden = document.body.classList.contains('daily-amounts-hidden');
    if (!isHidden) return false;

    const curUser = (typeof currentUser !== 'undefined') ? currentUser : null;
    const isAdmin = curUser ? (curUser.role === 'admin') : true;
    if (isAdmin) return false;

    const uTarget = (typeof users !== 'undefined' && Array.isArray(users))
        ? (users.find(u => u.pin === curUser.pin || u.name === curUser.name) || curUser)
        : curUser;

    if (uTarget && uTarget.permissions && uTarget.permissions.general && uTarget.permissions.general.lockDailyAmounts !== undefined) {
        return !!uTarget.permissions.general.lockDailyAmounts;
    }
    return true;
}
window.isDailyReportAmountsProtected = isDailyReportAmountsProtected;
