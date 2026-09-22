/**
 * ============================================================
 * 👗 BAYAN POS FASHION - MOBILE & LIVE DASHBOARD LOGIC
 * High-Performance, Standalone Client Engine (<20KB Zero Lag)
 * ============================================================
 */

(function (window, document) {
    'use strict';

    // ============================================================
    // ⚙️ STATE & CONFIGURATION
    // ============================================================
    const CONFIG = {
        DEFAULT_PORT: 4545,
        STORAGE_PREFIX: 'bayan_mob_',
        DEVICE_ID: localStorage.getItem('bayan_mob_device_id') || ('MOB-' + Math.random().toString(36).substring(2, 9).toUpperCase()),
        DEVICE_NAME: localStorage.getItem('bayan_mob_device_name') || 'بيان فاشون موبايل 📱'
    };

    // Save persistent device ID
    localStorage.setItem('bayan_mob_device_id', CONFIG.DEVICE_ID);

    const State = {
        serverUrl: localStorage.getItem(CONFIG.STORAGE_PREFIX + 'server_url') || '',
        token: localStorage.getItem(CONFIG.STORAGE_PREFIX + 'token') || '',
        terminalLetter: localStorage.getItem(CONFIG.STORAGE_PREFIX + 'terminal_letter') || 'M',
        isConnected: false,
        sseSource: null,
        activeTab: 'dashboard',

        // Database
        products: [],
        transactions: [],
        vouchers: [],
        settings: {},

        // Cart
        cart: [],
        selectedPayMethod: 'cash', // 'cash', 'vodafone', 'card'

        // Filters
        searchQuery: '',
        selectedCategory: 'all'
    };

    // ============================================================
    // 🌐 URL & SERVER AUTODETECTION
    // ============================================================
    function getInferredServerUrl() {
        if (State.serverUrl) return State.serverUrl;
        const host = window.location.hostname || 'localhost';
        const port = window.location.port || CONFIG.DEFAULT_PORT;
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        // If served directly from server_hub
        if (window.location.port == CONFIG.DEFAULT_PORT) {
            return `${protocol}//${host}:${CONFIG.DEFAULT_PORT}`;
        }
        return `${protocol}//${host}:${CONFIG.DEFAULT_PORT}`;
    }

    State.serverUrl = getInferredServerUrl();

    // ============================================================
    // 🔔 TOAST NOTIFICATIONS
    // ============================================================
    function showToast(message, type = 'success') {
        let container = document.getElementById('mobile-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'mobile-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `mobile-toast ${type}`;
        const icons = { success: '✅', error: '⚠️', warning: '⚡' };
        toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'all 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    // ============================================================
    // 📡 SERVER CONNECTION & PAIRING
    // ============================================================
    async function apiFetch(endpoint, options = {}) {
        const url = `${State.serverUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'X-Device-Id': CONFIG.DEVICE_ID,
            'X-Device-Token': State.token || '',
            ...(options.headers || {})
        };

        const res = await fetch(url, { ...options, headers });
        if (res.status === 401) {
            // Needs pairing
            handleNeedsPairing();
            throw new Error('401_UNAUTHORIZED');
        }
        if (!res.ok) {
            throw new Error(`HTTP_${res.status}`);
        }
        return await res.json();
    }

    function updateConnectionStatus(connected, message = '') {
        State.isConnected = connected;
        const pill = document.getElementById('connectionStatusPill');
        const text = document.getElementById('connectionStatusText');
        if (pill) {
            if (connected) {
                pill.className = 'status-pill';
                text.textContent = 'متصل بالرئيسي 🟢';
            } else {
                pill.className = 'status-pill offline';
                text.textContent = message || 'غير متصل 🔴';
            }
        }
    }

    async function checkServerInfo() {
        try {
            const data = await apiFetch('/api/server-info');
            if (data && data.status === 'online') {
                updateConnectionStatus(true);
                return true;
            }
        } catch (e) {
            if (e.message !== '401_UNAUTHORIZED') {
                updateConnectionStatus(false, 'غير متصل');
            }
        }
        return false;
    }

    // Pair request flow
    async function initiatePairing() {
        try {
            const res = await fetch(`${State.serverUrl}/api/pair-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: CONFIG.DEVICE_ID,
                    deviceName: CONFIG.DEVICE_NAME
                })
            });
            const data = await res.json();
            if (data.requiresPin) {
                openPinModal();
            }
        } catch (e) {
            showToast('تعذر الوصول إلى سيرفر البرنامج الرئيسي', 'error');
        }
    }

    async function submitPinVerification(pin) {
        try {
            const res = await fetch(`${State.serverUrl}/api/pair-verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: CONFIG.DEVICE_ID,
                    deviceName: CONFIG.DEVICE_NAME,
                    pin: pin.trim()
                })
            });
            const data = await res.json();
            if (data.success && data.token) {
                State.token = data.token;
                State.terminalLetter = data.terminalLetter || 'M';
                localStorage.setItem(CONFIG.STORAGE_PREFIX + 'token', data.token);
                localStorage.setItem(CONFIG.STORAGE_PREFIX + 'terminal_letter', State.terminalLetter);
                closePinModal();
                showToast('تم إقران الموبايل بنجاح! 🚀', 'success');
                updateConnectionStatus(true);
                await pullMasterData();
                setupLiveStream();
            } else {
                showToast(data.message || 'رمز الـ PIN غير صحيح', 'error');
            }
        } catch (e) {
            showToast('خطأ في الاتصال أثناء التحقق', 'error');
        }
    }

    function handleNeedsPairing() {
        updateConnectionStatus(false, 'يلزم الإقران');
        initiatePairing();
    }

    // ============================================================
    // ⚡ REAL-TIME LIVE STREAM (SSE)
    // ============================================================
    function setupLiveStream() {
        if (!State.token) return;
        if (State.sseSource) {
            try { State.sseSource.close(); } catch (e) { }
        }

        const streamUrl = `${State.serverUrl}/api/live-stream?token=${encodeURIComponent(State.token)}&deviceId=${encodeURIComponent(CONFIG.DEVICE_ID)}`;
        const es = new EventSource(streamUrl);
        State.sseSource = es;

        es.addEventListener('open', () => {
            updateConnectionStatus(true);
        });

        es.addEventListener('error', () => {
            updateConnectionStatus(false, 'انقطع البث');
        });

        es.addEventListener('live-delta-sync', (e) => {
            try {
                const data = JSON.parse(e.data);
                applyLiveDelta(data);
            } catch (err) {
                console.error('Error applying live delta:', err);
            }
        });

        es.addEventListener('master-db-updated', () => {
            pullMasterData();
        });
    }

    function applyLiveDelta(delta) {
        if (!delta || !delta.db) return;
        const { transactions, products, vouchers } = delta.db;

        // 1. Update transactions
        if (Array.isArray(transactions) && transactions.length > 0) {
            transactions.forEach(newTx => {
                const idx = State.transactions.findIndex(t => String(t.invoiceId) === String(newTx.invoiceId));
                if (idx !== -1) {
                    State.transactions[idx] = newTx;
                } else {
                    State.transactions.unshift(newTx);
                }
            });
        }

        // 2. Update products
        if (Array.isArray(products) && products.length > 0) {
            products.forEach(newP => {
                const idx = State.products.findIndex(p => String(p.id) === String(newP.id) || (newP.barcode && p.barcode === newP.barcode));
                if (idx !== -1) {
                    State.products[idx] = { ...State.products[idx], ...newP };
                } else {
                    State.products.push(newP);
                }
            });
        }

        // 3. Update vouchers
        if (Array.isArray(vouchers) && vouchers.length > 0) {
            vouchers.forEach(newV => {
                const idx = State.vouchers.findIndex(v => String(v.id) === String(newV.id));
                if (idx !== -1) State.vouchers[idx] = newV;
                else State.vouchers.unshift(newV);
            });
        }

        // Re-render active view
        renderCurrentView();
    }

    // ============================================================
    // 📥 DATA SYNC PULL
    // ============================================================
    async function pullMasterData() {
        try {
            const data = await apiFetch('/api/sync/pull');
            if (data && data.db) {
                State.products = Array.isArray(data.db.products) ? data.db.products : [];
                State.transactions = Array.isArray(data.db.transactions) ? data.db.transactions : [];
                State.vouchers = Array.isArray(data.db.vouchers) ? data.db.vouchers : [];
                State.settings = data.db.settings || {};

                // Update UI
                renderCurrentView();
                updateCategoriesList();
            }
        } catch (e) {
            console.warn('Pull data failed:', e.message);
        }
    }

    // ============================================================
    // 📊 DASHBOARD & CASH DRAWER CALCULATIONS ("يشوف الكيس")
    // ============================================================
    // ============================================================
    // 📊 DASHBOARD & CASH DRAWER CALCULATIONS ("يشوف الكيس")
    // ============================================================
    function parseDateToISO(dateStr) {
        if (!dateStr) return '';
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.slice(0, 10);
        }
        // Normalize Arabic digits
        const normalized = String(dateStr).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        // Check for DD/MM/YYYY or D/M/YYYY
        const match = normalized.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            return `${year}-${month}-${day}`;
        }
        // Check for YYYY/MM/DD
        const isoMatch = normalized.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
        }
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return '';
    }

    function getTxDateISO(t) {
        if (!t) return '';
        if (t.dateISO) return parseDateToISO(t.dateISO);
        return parseDateToISO(t.date || t.createdAt || t.timestamp);
    }

    function getTodayISO() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function isNonCash(m) {
        if (!m) return false;
        const str = String(m).toLowerCase().trim();
        return str.includes('بنك') || str.includes('تحويل') || str.includes('فيزا') || 
               str.includes('شيك') || str.includes('شبكة') || str.includes('فودافون') || 
               str.includes('فودافن') || str.includes('vodafone') || str.includes('voda') || 
               str.includes('اورنج') || str.includes('orange') || str.includes('اتصالات') || 
               str.includes('etisalat') || str.includes('وي') || str.includes('we') || 
               str.includes('انستا') || str.includes('insta') || str.includes('محفظة') || 
               str.includes('wallet') || str.includes('card');
    }

    function calculateTodayDrawerStats() {
        let netDrawerCashAllTime = 0;
        let totalSales = 0;
        let cashSales = 0;
        let vodafoneSales = 0;
        let cardSales = 0;
        let totalReturns = 0;
        let cashReturns = 0;
        let expenses = 0;
        let invoiceCount = 0;
        let itemsCount = 0;
        const todayISO = getTodayISO();

        State.transactions.forEach(t => {
            const amt = parseFloat(t.paidAmount !== undefined ? t.paidAmount : (t.paid !== undefined ? t.paid : (t.invoiceGrandTotal || t.total || 0))) || 0;
            const isHead = (t.isInvoiceHead || t.isInvoiceHead === undefined);
            const rawMethod = String(t.method || t.paymentMethod || '');
            const nonCash = isNonCash(rawMethod);
            const type = String(t.type || '');
            const tDateISO = getTxDateISO(t);
            const isTodayTx = (tDateISO === todayISO);

            // Cumulative cash in physical drawer (all-time)
            if (!nonCash) {
                if (type.includes('بيع') && !type.includes('مرتجع')) {
                    if (isHead) netDrawerCashAllTime += amt;
                } else if (type.includes('قبض')) {
                    netDrawerCashAllTime += amt;
                } else if (type.includes('مرتجع شراء')) {
                    if (isHead) netDrawerCashAllTime += amt;
                } else if (type.includes('مرتجع بيع')) {
                    if (isHead) netDrawerCashAllTime -= amt;
                } else if (type.includes('صرف')) {
                    netDrawerCashAllTime -= amt;
                } else if (type.includes('شراء')) {
                    if (isHead) netDrawerCashAllTime -= amt;
                }
            }

            // Today's Stats
            if (isTodayTx) {
                if (type.includes('بيع') && !type.includes('مرتجع')) {
                    if (isHead) {
                        const invTot = parseFloat(t.invoiceGrandTotal || t.total || amt);
                        totalSales += invTot;
                        invoiceCount++;
                        const mLower = rawMethod.toLowerCase();
                        if (mLower.includes('voda') || mLower.includes('فودافون')) {
                            vodafoneSales += invTot;
                        } else if (mLower.includes('فيزا') || mLower.includes('card') || mLower.includes('انستا')) {
                            cardSales += invTot;
                        } else {
                            cashSales += invTot;
                        }
                    }
                    itemsCount += (parseFloat(t.qty || 1) || 1);
                } else if (type.includes('مرتجع بيع')) {
                    if (isHead) {
                        totalReturns += amt;
                        if (!nonCash) cashReturns += amt;
                    }
                } else if (type.includes('صرف') || type.includes('مصروف')) {
                    expenses += amt;
                }
            }
        });

        // Expenses from vouchers today if available
        if (Array.isArray(State.vouchers)) {
            State.vouchers.forEach(v => {
                const vDateISO = parseDateToISO(v.date || v.createdAt);
                const vAmt = parseFloat(v.amount || 0) || 0;
                if (vDateISO === todayISO) {
                    if (v.type === 'disburse' || v.type === 'expense' || v.voucherType === 'disburse') {
                        expenses += vAmt;
                    }
                }
            });
        }

        const todayTxs = State.transactions.filter(t => getTxDateISO(t) === todayISO);

        // Fallback for drawer cash if all-time is 0
        const displayedDrawerCash = netDrawerCashAllTime !== 0 ? netDrawerCashAllTime : Math.max(0, cashSales - cashReturns - expenses);

        return {
            netDrawerCash: displayedDrawerCash,
            netDrawerCashAllTime,
            totalSales,
            cashSales,
            vodafoneSales,
            cardSales,
            totalReturns,
            expenses,
            invoiceCount,
            itemsCount,
            todayTxs
        };
    }

    function renderDashboard() {
        const stats = calculateTodayDrawerStats();

        // Main Drawer Hero
        const elDrawerAmount = document.getElementById('drawerAmount');
        const elTodaySales = document.getElementById('todayTotalSales');
        const elInvoicesCount = document.getElementById('todayInvoicesCount');
        const elTodayDate = document.getElementById('drawerDateChip');

        if (elDrawerAmount) elDrawerAmount.textContent = stats.netDrawerCash.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (elTodaySales) elTodaySales.textContent = stats.totalSales.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
        if (elInvoicesCount) elInvoicesCount.textContent = stats.invoiceCount + ' فاتورة (' + stats.itemsCount + ' قطعة)';
        if (elTodayDate) {
            const now = new Date();
            elTodayDate.textContent = now.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
        }

        // Stats Grid
        const elCash = document.getElementById('statCashAmount');
        const elVoda = document.getElementById('statVodafoneAmount');
        const elCard = document.getElementById('statCardAmount');
        const elExpense = document.getElementById('statExpenseAmount');

        if (elCash) elCash.textContent = stats.cashSales.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
        if (elVoda) elVoda.textContent = stats.vodafoneSales.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
        if (elCard) elCard.textContent = stats.cardSales.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
        if (elExpense) elExpense.textContent = stats.expenses.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';

        // Recent Invoices List
        const listEl = document.getElementById('recentActivityList');
        if (!listEl) return;

        if (stats.todayTxs.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 25px 15px; color: var(--text-dim);">
                    <div style="font-size: 2rem; margin-bottom: 6px;">🧾</div>
                    <p style="font-size: 0.85rem; font-weight: 700;">لا توجد فواتير مسجلة اليوم حتى الآن</p>
                </div>
            `;
            return;
        }

        const sorted = [...stats.todayTxs].sort((a, b) => {
            const idA = parseInt(a.id || 0, 10);
            const idB = parseInt(b.id || 0, 10);
            return idB - idA;
        }).slice(0, 20);

        listEl.innerHTML = sorted.map(tx => {
            const typeStr = String(tx.type || '');
            const isRet = typeStr.includes('مرتجع');
            const isDisburse = typeStr.includes('صرف');
            const isReceipt = typeStr.includes('قبض');
            const isSale = typeStr.includes('بيع') && !isRet;

            let icon = '🧾';
            let badgeClass = '';
            if (isRet) { icon = '↩️'; badgeClass = 'return'; }
            else if (isDisburse) { icon = '📤'; badgeClass = 'disburse'; }
            else if (isReceipt) { icon = '📥'; badgeClass = 'receipt'; }
            else if (isSale) { icon = '🛍️'; badgeClass = 'sale'; }

            const timeStr = tx.timeISO || (tx.date ? String(tx.date).split('،')[1] || tx.date : '--:--');
            const rawMethod = tx.method || tx.paymentMethod || 'كاش (نقدي)';
            const payMethodText = getPayMethodLabel(rawMethod);
            const total = parseFloat(tx.invoiceGrandTotal || tx.total || tx.paidAmount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const itemsSummary = tx.product || (Array.isArray(tx.items) ? tx.items.map(i => i.name).slice(0, 2).join('، ') : typeStr);

            return `
                <div class="activity-card ${badgeClass}" onclick="window.BayanMobile.openInvoiceDetails('${tx.invoiceId || tx.id}')">
                    <div class="activity-meta">
                        <div class="activity-badge ${badgeClass}">
                            ${icon}
                        </div>
                        <div class="activity-details">
                            <h4>#${tx.invoiceId || tx.id || '---'} <span style="font-size:0.75rem; color:var(--text-dim);">(${typeStr})</span></h4>
                            <p>${itemsSummary} • ${timeStr}</p>
                        </div>
                    </div>
                    <div class="activity-right">
                        <div class="activity-price" style="color: ${isRet || isDisburse ? '#f43f5e' : 'var(--emerald)'};">${isRet || isDisburse ? '-' : '+'}${total} ج.م</div>
                        <span class="activity-pay-tag">${payMethodText}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function getPayMethodLabel(m) {
        if (!m) return '💵 كاش نقدي';
        const s = String(m).toLowerCase().trim();
        if (s.includes('voda') || s.includes('فودافون')) return '📱 فودافون كاش';
        if (s.includes('card') || s.includes('فيزا') || s.includes('شبكة')) return '💳 بطاقة بنكية';
        if (s.includes('انستا') || s.includes('insta')) return '⚡ انستا باي';
        if (s.includes('أجل')) return '⏳ أجل';
        return '💵 كاش نقدي';
    }

    // ============================================================
    // 🔍 PRODUCT LOOKUP & STOCK ("يجيب صنف")
    // ============================================================
    function updateCategoriesList() {
        const container = document.getElementById('categoriesScroll');
        if (!container) return;

        const cats = new Set(['all']);
        State.products.forEach(p => {
            if (p.category) cats.add(p.category.trim());
        });

        container.innerHTML = Array.from(cats).map(cat => {
            const label = cat === 'all' ? '✨ الكل' : cat;
            const isActive = State.selectedCategory === cat ? 'active' : '';
            return `<div class="cat-chip ${isActive}" onclick="window.BayanMobile.setCategory('${cat}')">${label}</div>`;
        }).join('');
    }

    function renderProducts() {
        const listEl = document.getElementById('productsList');
        if (!listEl) return;

        const q = State.searchQuery.trim().toLowerCase();
        const cat = State.selectedCategory;

        let filtered = State.products.filter(p => {
            // Category filter
            if (cat !== 'all' && (p.category || '').trim() !== cat) return false;
            // Search query filter
            if (!q) return true;
            const name = (p.name || '').toLowerCase();
            const code = (p.code || '').toLowerCase();
            const barcode = (p.barcode || '').toLowerCase();
            return name.includes(q) || code.includes(q) || barcode.includes(q);
        });

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-dim);">
                    <div style="font-size: 3rem; margin-bottom: 8px;">🔍</div>
                    <p style="font-size: 0.95rem; font-weight: 800;">لم يتم العثور على أي صنف مطابق للبحث</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = filtered.slice(0, 30).map(p => {
            const price = parseFloat(p.price || p.salePrice || 0).toLocaleString('ar-EG');
            const totalStock = parseFloat(p.quantity || p.stock || 0);
            const stockStatus = totalStock <= 0 ? 'out-of-stock' : (totalStock <= 3 ? 'low-stock' : 'in-stock');
            const stockText = totalStock <= 0 ? 'نفد من المخزن ❌' : (totalStock <= 3 ? `متبقي ${totalStock} فقط ⚠️` : `متوفر (${totalStock} قطعة) ✅`);

            // Variants Matrix (Sizes & Colors)
            const variantsHtml = renderProductVariantsMatrix(p);

            return `
                <div class="product-card" id="prod-${p.id}">
                    <div class="product-head">
                        <div class="product-title">${p.name || 'صنف بدون اسم'}</div>
                        <div class="product-price-badge">${price} ج.م</div>
                    </div>
                    <div class="product-barcode-row">
                        <span>🏷️ ${p.code || p.barcode || 'بدون كود'}</span>
                        ${p.category ? `<span>• 📁 ${p.category}</span>` : ''}
                    </div>

                    ${variantsHtml}

                    <div class="product-foot">
                        <div class="stock-status ${stockStatus}">
                            <span>${stockText}</span>
                        </div>
                        <button class="btn-add-cart-quick" onclick="window.BayanMobile.openAddToCartModal('${p.id}')">
                            <span>🛒</span> بيع سريع
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderProductVariantsMatrix(product) {
        // Look for variants in products
        let variants = product.variants || [];
        if (!Array.isArray(variants) || variants.length === 0) {
            if (product.sizes || product.colors) {
                // simple fallback
                const s = Array.isArray(product.sizes) ? product.sizes.join(', ') : (product.sizes || '');
                const c = Array.isArray(product.colors) ? product.colors.join(', ') : (product.colors || '');
                if (!s && !c) return '';
                return `
                    <div class="variants-matrix">
                        <div class="variant-row">
                            <span class="variant-color">🎨 ${c || 'عام'}</span>
                            <div class="variant-sizes-chips">
                                <span class="size-pill">${s || 'حر'}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            return '';
        }

        // Group variants by color
        const colorMap = {};
        variants.forEach(v => {
            const color = v.color || 'عام';
            if (!colorMap[color]) colorMap[color] = [];
            colorMap[color].push(v);
        });

        const rows = Object.keys(colorMap).map(color => {
            const list = colorMap[color];
            const sizeChips = list.map(v => {
                const qty = parseInt(v.quantity || v.qty || 0, 10);
                const pillClass = qty <= 0 ? 'out' : (qty <= 2 ? 'low' : '');
                return `<span class="size-pill ${pillClass}">${v.size || 'M'} (${qty})</span>`;
            }).join('');

            return `
                <div class="variant-row">
                    <span class="variant-color">🎨 ${color}</span>
                    <div class="variant-sizes-chips">${sizeChips}</div>
                </div>
            `;
        }).join('');

        return `<div class="variants-matrix">${rows}</div>`;
    }

    // ============================================================
    // 🛒 QUICK MOBILE POS ("ممكن يبيع ولا حاجة")
    // ============================================================
    function addToCart(product, size = '', color = '', qty = 1) {
        const cartKey = `${product.id}_${size}_${color}`;
        const existing = State.cart.find(item => item.key === cartKey);

        if (existing) {
            existing.qty += qty;
        } else {
            State.cart.push({
                key: cartKey,
                productId: product.id,
                name: product.name,
                code: product.code || product.barcode || '',
                price: parseFloat(product.price || product.salePrice || 0),
                size: size || 'عادي',
                color: color || 'عادي',
                qty: qty
            });
        }

        updateCartCount();
        showToast(`تم إضافة ${product.name} إلى السلة 🛒`, 'success');
        if (State.activeTab === 'pos') {
            renderCartView();
        }
    }

    function updateCartCount() {
        const badge = document.getElementById('navCartBadge');
        const count = State.cart.reduce((sum, item) => sum + item.qty, 0);
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    function modifyCartQty(key, delta) {
        const item = State.cart.find(i => i.key === key);
        if (!item) return;
        item.qty += delta;
        if (item.qty <= 0) {
            State.cart = State.cart.filter(i => i.key !== key);
        }
        updateCartCount();
        renderCartView();
    }

    function renderCartView() {
        const itemsContainer = document.getElementById('cartItemsContainer');
        const subtotalEl = document.getElementById('cartSubtotalAmount');
        const totalEl = document.getElementById('cartFinalTotalAmount');
        const btnCheckout = document.getElementById('btnSubmitInvoice');

        if (!itemsContainer) return;

        if (State.cart.length === 0) {
            itemsContainer.innerHTML = `
                <div class="cart-empty-placeholder">
                    <div class="empty-icon">🛍️</div>
                    <p>سلة المبيعات فارغة</p>
                    <span style="font-size: 0.75rem; color: var(--text-dim);">اختر أصنافاً من قسم البحث لإصدار فاتورة سريعة</span>
                </div>
            `;
            if (subtotalEl) subtotalEl.textContent = '0.00 ج.م';
            if (totalEl) totalEl.textContent = '0.00 ج.م';
            if (btnCheckout) btnCheckout.disabled = true;
            return;
        }

        let total = 0;
        itemsContainer.innerHTML = State.cart.map(item => {
            const lineTotal = item.price * item.qty;
            total += lineTotal;
            return `
                <div class="cart-item-card">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-meta">المقاس: ${item.size} • اللون: ${item.color}</div>
                    </div>
                    <div class="cart-item-qty-stepper">
                        <button class="btn-stepper" onclick="window.BayanMobile.modifyCartQty('${item.key}', -1)">-</button>
                        <span class="cart-item-qty">${item.qty}</span>
                        <button class="btn-stepper" onclick="window.BayanMobile.modifyCartQty('${item.key}', 1)">+</button>
                    </div>
                    <div class="cart-item-total">${lineTotal.toLocaleString('ar-EG')} ج.م</div>
                </div>
            `;
        }).join('');

        if (subtotalEl) subtotalEl.textContent = total.toLocaleString('ar-EG') + ' ج.م';
        if (totalEl) totalEl.textContent = total.toLocaleString('ar-EG') + ' ج.م';
        if (btnCheckout) btnCheckout.disabled = false;
    }

    // Submit Mobile Invoice
    async function submitMobileInvoice() {
        if (State.cart.length === 0) return;

        const btn = document.getElementById('btnSubmitInvoice');
        if (btn) btn.disabled = true;

        try {
            const timestamp = Date.now();
            const invoiceId = `MOB-${State.terminalLetter}-${timestamp.toString().slice(-6)}`;
            const total = State.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

            const newTx = {
                id: invoiceId,
                invoiceId: invoiceId,
                type: 'sale',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                paymentMethod: State.selectedPayMethod,
                items: State.cart.map(i => ({
                    productId: i.productId,
                    name: i.name,
                    quantity: i.qty,
                    price: i.price,
                    size: i.size,
                    color: i.color,
                    total: i.price * i.qty
                })),
                total: total,
                finalTotal: total,
                discount: 0,
                paid: total,
                remaining: 0,
                terminalLetter: State.terminalLetter,
                devicePrefix: `MOB-${State.terminalLetter}`,
                isDelta: true
            };

            // Update local in-memory products stock
            const updatedProductsList = [];
            State.cart.forEach(item => {
                const prod = State.products.find(p => p.id === item.productId);
                if (prod) {
                    prod.quantity = Math.max(0, (parseFloat(prod.quantity) || 0) - item.qty);
                    // update variant quantity if exists
                    if (Array.isArray(prod.variants)) {
                        const v = prod.variants.find(varItem => varItem.size === item.size && varItem.color === item.color);
                        if (v) v.quantity = Math.max(0, (parseFloat(v.quantity) || 0) - item.qty);
                    }
                    updatedProductsList.push(prod);
                }
            });

            // Push delta to master
            const deltaPayload = {
                db: {
                    transactions: [newTx],
                    products: updatedProductsList
                },
                sourceDeviceId: CONFIG.DEVICE_ID,
                isDelta: true
            };

            await apiFetch('/api/sync/push', {
                method: 'POST',
                body: JSON.stringify(deltaPayload)
            });

            // Insert into local transactions list
            State.transactions.unshift(newTx);
            State.cart = [];
            updateCartCount();
            renderCartView();

            showToast(`✅ تم حفظ الفاتورة #${invoiceId} بنجاح!`, 'success');
            openInvoiceSuccessModal(newTx);

        } catch (e) {
            showToast('تعذر حفظ الفاتورة على السيرفر الرئيسي', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // ============================================================
    // 🪟 MODALS MANAGEMENT
    // ============================================================
    function openPinModal() {
        const modal = document.getElementById('pinModalOverlay');
        if (modal) modal.classList.add('active');
        const input = document.getElementById('pinInput');
        if (input) { input.value = ''; input.focus(); }
    }

    function closePinModal() {
        const modal = document.getElementById('pinModalOverlay');
        if (modal) modal.classList.remove('active');
    }

    function openAddToCartModal(productId) {
        const product = State.products.find(p => p.id === productId);
        if (!product) return;

        const modal = document.getElementById('addToCartModalOverlay');
        const title = document.getElementById('addModalTitle');
        const price = document.getElementById('addModalPrice');
        const sizesBox = document.getElementById('addModalSizesBox');
        const colorsBox = document.getElementById('addModalColorsBox');

        if (title) title.textContent = product.name;
        if (price) price.textContent = (product.price || 0) + ' ج.م';

        // Populate sizes and colors
        let sizes = [];
        let colors = [];

        if (Array.isArray(product.variants) && product.variants.length > 0) {
            product.variants.forEach(v => {
                if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
                if (v.color && !colors.includes(v.color)) colors.push(v.color);
            });
        }

        if (sizes.length === 0) sizes = ['عادي'];
        if (colors.length === 0) colors = ['عادي'];

        window._pendingAddProduct = product;
        window._pendingAddSize = sizes[0];
        window._pendingAddColor = colors[0];

        if (sizesBox) {
            sizesBox.innerHTML = sizes.map((s, idx) => `
                <div class="cat-chip ${idx === 0 ? 'active' : ''}" onclick="window.BayanMobile.selectVariantSize(this, '${s}')">${s}</div>
            `).join('');
        }

        if (colorsBox) {
            colorsBox.innerHTML = colors.map((c, idx) => `
                <div class="cat-chip ${idx === 0 ? 'active' : ''}" onclick="window.BayanMobile.selectVariantColor(this, '${c}')">${c}</div>
            `).join('');
        }

        if (modal) modal.classList.add('active');
    }

    function closeAddToCartModal() {
        const modal = document.getElementById('addToCartModalOverlay');
        if (modal) modal.classList.remove('active');
    }

    function confirmAddToCart() {
        if (!window._pendingAddProduct) return;
        addToCart(window._pendingAddProduct, window._pendingAddSize, window._pendingAddColor, 1);
        closeAddToCartModal();
    }

    function openInvoiceDetails(invoiceId) {
        const matchingTxs = State.transactions.filter(t => String(t.invoiceId) === String(invoiceId) || String(t.id) === String(invoiceId));
        if (matchingTxs.length === 0) return;
        const tx = matchingTxs[0];

        const modal = document.getElementById('invoiceDetailsModalOverlay');
        const content = document.getElementById('invoiceDetailsContent');

        if (content) {
            const rawDate = tx.dateISO ? `${tx.dateISO} ${tx.timeISO || ''}` : (tx.date || '---');
            const total = parseFloat(tx.invoiceGrandTotal || tx.total || tx.paidAmount || 0);
            const method = tx.method || tx.paymentMethod || 'كاش (نقدي)';

            let itemsHtml = '';
            if (Array.isArray(tx.items) && tx.items.length > 0) {
                itemsHtml = tx.items.map(i => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 8px;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.85rem; color: #fff;">${i.name || i.product}</div>
                            <div style="font-size: 0.72rem; color: var(--text-dim);">الكمية: ${i.quantity || i.qty || 1} • المقاس: ${i.size || 'حر'} • اللون: ${i.color || 'عام'}</div>
                        </div>
                        <div style="font-weight: 900; color: var(--emerald); font-family: monospace;">${(parseFloat(i.total) || (parseFloat(i.price || 0) * (parseFloat(i.quantity || i.qty || 1)))).toLocaleString('ar-EG')} ج.م</div>
                    </div>
                `).join('');
            } else {
                itemsHtml = matchingTxs.map(t => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 8px;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.85rem; color: #fff;">${t.product || 'صنف'}</div>
                            <div style="font-size: 0.72rem; color: var(--text-dim);">الكمية: ${t.qty || 1} ${t.unit ? '(' + t.unit + ')' : ''} ${t.size ? '• المقاس: ' + t.size : ''} ${t.color ? '• اللون: ' + t.color : ''}</div>
                        </div>
                        <div style="font-weight: 900; color: var(--emerald); font-family: monospace;">${parseFloat(t.total || 0).toLocaleString('ar-EG')} ج.م</div>
                    </div>
                `).join('');
            }

            content.innerHTML = `
                <div style="background: rgba(255,255,255,0.04); padding: 14px; border-radius: 14px; margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="color: var(--text-dim); font-size: 0.8rem;">رقم الفاتورة:</span>
                        <strong style="color: #ffffff; font-family: monospace;">#${tx.invoiceId || tx.id}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="color: var(--text-dim); font-size: 0.8rem;">النوع:</span>
                        <span style="color: var(--primary); font-size: 0.82rem; font-weight: 800;">${tx.type || 'حركة'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="color: var(--text-dim); font-size: 0.8rem;">التاريخ والوقت:</span>
                        <span style="color: var(--text-main); font-size: 0.8rem;">${rawDate}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-dim); font-size: 0.8rem;">طريقة الدفع:</span>
                        <span style="color: var(--gold); font-size: 0.85rem; font-weight: 800;">${getPayMethodLabel(method)}</span>
                    </div>
                </div>

                <h4 style="font-size: 0.9rem; margin-bottom: 8px; color: var(--text-main);">📋 تفاصيل البنود:</h4>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
                    ${itemsHtml}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 10px;">
                    <span style="font-weight: 800; color: #fff; font-size: 1.1rem;">الإجمالي:</span>
                    <span style="font-weight: 900; color: var(--gold); font-size: 1.35rem; font-family: monospace;">${total.toLocaleString('ar-EG')} ج.م</span>
                </div>
            `;
        }

        if (modal) modal.classList.add('active');
    }

    function closeInvoiceDetailsModal() {
        const modal = document.getElementById('invoiceDetailsModalOverlay');
        if (modal) modal.classList.remove('active');
    }

    function openInvoiceSuccessModal(tx) {
        const modal = document.getElementById('invoiceSuccessModalOverlay');
        const numEl = document.getElementById('successModalInvoiceNum');
        const totalEl = document.getElementById('successModalTotal');

        if (numEl) numEl.textContent = '#' + tx.invoiceId;
        if (totalEl) totalEl.textContent = parseFloat(tx.finalTotal).toLocaleString('ar-EG') + ' ج.م';

        // WhatsApp share button link
        const btnWa = document.getElementById('btnShareWhatsApp');
        if (btnWa) {
            const itemsText = tx.items.map(i => `• ${i.name} (مقاس: ${i.size}, لون: ${i.color}) - عدد: ${i.quantity}`).join('%0A');
            const msg = `🧾 فاتورة مشتريات من ${State.settings?.shop_name || 'بَيَان فاشون'}%0Aرقم الفاتورة: #${tx.invoiceId}%0Aالتاريخ: ${new Date().toLocaleDateString('ar-EG')}%0A%0A${itemsText}%0A%0A💰 الإجمالي: ${tx.finalTotal} ج.م%0Aشكراً لزيارتكم! ✨`;
            btnWa.onclick = () => window.open(`https://wa.me/?text=${msg}`, '_blank');
        }

        if (modal) modal.classList.add('active');
    }

    function closeInvoiceSuccessModal() {
        const modal = document.getElementById('invoiceSuccessModalOverlay');
        if (modal) modal.classList.remove('active');
    }

    // ============================================================
    // 📸 CAMERA SCANNER
    // ============================================================
    function triggerCameraScan() {
        const fileInput = document.getElementById('cameraFileInput');
        if (fileInput) {
            fileInput.click();
        }
    }

    // Handle Camera Image
    async function handleCameraFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        showToast('جاري قراءة الباركود من الصورة...', 'warning');

        // Check if BarcodeDetector is natively supported
        if ('BarcodeDetector' in window) {
            try {
                const detector = new window.BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a'] });
                const bitmap = await createImageBitmap(file);
                const barcodes = await detector.detect(bitmap);
                if (barcodes && barcodes.length > 0) {
                    const rawVal = barcodes[0].rawValue;
                    showToast(`تم مسح الباركود: ${rawVal} 🏷️`, 'success');
                    onBarcodeFound(rawVal);
                    return;
                }
            } catch (err) {
                console.warn('BarcodeDetector error:', err);
            }
        }

        showToast('تعذر رصد الباركود تلقائياً من الصورة، يرجى كتابته بالبحث', 'warning');
    }

    function onBarcodeFound(barcode) {
        const searchInput = document.getElementById('productSearchInput');
        if (searchInput) {
            searchInput.value = barcode;
            State.searchQuery = barcode;
            renderProducts();
        }
        // Switch to products tab
        switchTab('products');
    }

    // ============================================================
    // 🧭 NAVIGATION & TAB SWITCHING
    // ============================================================
    function switchTab(tabId) {
        State.activeTab = tabId;

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabId);
        });

        // Update views
        document.querySelectorAll('.tab-view').forEach(view => {
            view.classList.toggle('active', view.id === `view-${tabId}`);
        });

        renderCurrentView();
    }

    function renderCurrentView() {
        if (State.activeTab === 'dashboard') {
            renderDashboard();
        } else if (State.activeTab === 'products') {
            renderProducts();
        } else if (State.activeTab === 'pos') {
            renderCartView();
        }
    }

    // ============================================================
    // 🚀 INITIALIZATION
    // ============================================================
    async function init() {
        // Setup Search Input Listener
        const searchInput = document.getElementById('productSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                State.searchQuery = e.target.value;
                renderProducts();
            });
        }

        // Setup Payment Method Switcher
        document.querySelectorAll('.pay-btn-radio').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pay-btn-radio').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                State.selectedPayMethod = btn.dataset.method;
            });
        });

        // Connect & Pull Initial Data
        const isOnline = await checkServerInfo();
        if (isOnline) {
            await pullMasterData();
            setupLiveStream();
        } else if (!State.token) {
            initiatePairing();
        }

        renderCurrentView();
    }

    // Public API
    window.BayanMobile = {
        switchTab,
        setCategory: (cat) => { State.selectedCategory = cat; updateCategoriesList(); renderProducts(); },
        openAddToCartModal,
        closeAddToCartModal,
        selectVariantSize: (el, size) => {
            el.parentElement.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            window._pendingAddSize = size;
        },
        selectVariantColor: (el, color) => {
            el.parentElement.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            window._pendingAddColor = color;
        },
        confirmAddToCart,
        modifyCartQty,
        submitMobileInvoice,
        openInvoiceDetails,
        closeInvoiceDetailsModal,
        closeInvoiceSuccessModal,
        triggerCameraScan,
        handleCameraFile,
        submitPinVerification,
        closePinModal,
        reconnect: async () => {
            showToast('جاري إعادة فحص الاتصال بالسيرفر...', 'warning');
            const ok = await checkServerInfo();
            if (ok) {
                await pullMasterData();
                setupLiveStream();
                showToast('تم الاتصال بالسيرفر بنجاح ✅', 'success');
            } else {
                showToast('تعذر الاتصال بالسيرفر الرئيسي ❌', 'error');
            }
        },
        updateServerUrl: (newUrl) => {
            State.serverUrl = (newUrl || '').trim();
            localStorage.setItem(CONFIG.STORAGE_PREFIX + 'server_url', State.serverUrl);
            window.BayanMobile.reconnect();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window, document);
