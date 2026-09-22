// =========================================================================
// 🌐 Bayan POS - Local Network Hub & Tablet Pairing Manager
// =========================================================================

(function() {
    window.BayanNetworkHub = {
        _terminalRole: null,
        getTerminalRole: function() {
            if (this._terminalRole) return this._terminalRole;
            if (typeof getStore === 'function') {
                const r = getStore('bayan_terminal_role');
                if (r === 'client') return 'client';
                if (r === 'master') return 'master';
            }
            // إذا كان الجهاز مقترناً مسبقاً أو به رابط سيرفر محدد
            const isClientConfigured = (typeof getStore === 'function' && (getStore('bayan_client_is_paired') === 'true' || !!getStore('bayan_local_server_url')));
            return isClientConfigured ? 'client' : 'master';
        },
        get isMasterServer() {
            return this.getTerminalRole() === 'master';
        },
        set isMasterServer(val) {
            this._terminalRole = val ? 'master' : 'client';
            if (typeof setStore === 'function') setStore('bayan_terminal_role', this._terminalRole);
            this.updateHeaderButtonUI();
        },
        updateHeaderButtonUI: function() {
            try {
                const btn = document.querySelector('.server-hub-header-btn');
                if (!btn) return;
                const isMaster = this.isMasterServer;
                const labelSpan = btn.querySelector('.server-hub-btn-label');
                const dotSpan = btn.querySelector('.server-live-dot');
                if (!isMaster) {
                    btn.classList.add('is-client');
                    btn.title = 'كاشير فرعي (مقترن) - إعدادات السيرفر وروابط الاتصال حصرية للجهاز الرئيسي';
                    if (labelSpan) labelSpan.textContent = 'كاشير فرعي 🔒';
                    if (dotSpan) {
                        dotSpan.title = 'متصل ككاشير فرعي';
                    }
                } else {
                    btn.classList.remove('is-client');
                    btn.title = 'مركز السيرفر المحلي والربط الشبكي للأجهزة والتابلت';
                    if (labelSpan) labelSpan.textContent = 'السيرفر والتابلت';
                    if (dotSpan) {
                        dotSpan.title = 'السيرفر نشط';
                    }
                }
            } catch (e) {}
        },
        isServerOnline: true,
        serverUrl: 'http://127.0.0.1:4545',
        deviceId: null,
        deviceToken: null,
        terminalLetter: null,
        pairingOrder: null,
        deviceName: null,
        isPaired: false,
        lastSyncedTimestamp: null,
        hasPendingOfflineSync: false,
        isPulling: false,

        getTerminalLetter: function() {
            if (this.isMasterServer) return 'MASTER';
            if (this.terminalLetter) return this.terminalLetter;
            if (typeof getStore === 'function') {
                const stored = getStore('bayan_terminal_letter');
                if (stored) {
                    this.terminalLetter = stored;
                    return stored;
                }
            }
            return 'A';
        },

        getPairingOrder: function() {
            if (this.isMasterServer) return 0;
            if (this.pairingOrder != null) return this.pairingOrder;
            if (typeof getStore === 'function') {
                const stored = getStore('bayan_pairing_order');
                if (stored) {
                    this.pairingOrder = parseInt(stored, 10);
                    return this.pairingOrder;
                }
            }
            return 1;
        },

        getTerminalDisplayName: function() {
            if (this.isMasterServer) {
                return 'الجهاز الرئيسي 💻 (الماستر)';
            }
            const letter = this.getTerminalLetter();
            if (typeof getStore === 'function') {
                const storedName = getStore('bayan_device_name');
                if (storedName && !storedName.startsWith('تابلت') && !storedName.startsWith('جهاز فرعي')) {
                    return storedName;
                }
            }
            return `كاشير فرعي (${letter}) 📱`;
        },

        getTerminalInfo: function() {
            const isMaster = this.isMasterServer;
            const letter = this.getTerminalLetter();
            const order = this.getPairingOrder();
            const name = this.getTerminalDisplayName();
            const devId = this.deviceId || (isMaster ? 'DEV-HOST' : ((typeof getStore === 'function' ? getStore('bayan_client_device_id') : '') || 'DEV-CLIENT'));
            return {
                terminal: name,
                terminalLetter: letter,
                terminalOrder: order,
                terminalId: devId,
                isMaster: isMaster
            };
        },

        renamePairedDevice: async function(deviceId, currentName) {
            const newName = prompt('أدخل اسم القسم أو الكاشير لهذا الجهاز (مثلاً: قسم الملابس الرجالي):', currentName || '');
            if (newName === null) return;
            const cleanName = newName.trim();
            try {
                if (this.isMasterServer && typeof require !== 'undefined') {
                    const { ipcRenderer } = require('electron');
                    await ipcRenderer.invoke('update-paired-device-name', { deviceId, newName: cleanName });
                } else {
                    await this.fetchWithTimeout(`${this.serverUrl}/api/paired-device/update-name`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deviceId, newName: cleanName })
                    }, 1500);
                }
                if (typeof showToast === 'function') showToast('✅ تم تعديل مسمى الجهاز بنجاح!', 'success');
                this.openServerHubModal();
            } catch (err) {
                alert('خطأ في تعديل الاسم: ' + err.message);
            }
        },

        getServerUrl: function() {
            // 1. إذا كان الجهاز ماستر، فرابطه دائماً محلي
            if (this.isMasterServer && typeof require !== 'undefined') {
                return 'http://127.0.0.1:4545';
            }
            // 2. رابط مخصص محفوظ مسبقاً في إعدادات الكاشير الفرعي عبر IndexedDB
            const stored = (typeof getStore === 'function') ? getStore('bayan_local_server_url') : null;
            if (stored && stored.startsWith('http')) return stored.trim().replace(/\/+$/, '');

            // 3. إذا تم فتح التطبيق مباشرة من عنوان السيرفر المحلي (IP:Port)
            if (window.location.origin.includes(':4545') || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                return window.location.origin;
            }

            // 4. الرابط الافتراضي
            return 'http://127.0.0.1:4545';
        },

        setServerUrl: function(url) {
            if (!url) return;
            let clean = url.trim().replace(/\/+$/, '');
            if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
                clean = 'http://' + clean;
            }
            if (!clean.includes(':4545') && !clean.includes(':', 7) && !clean.includes('github.io')) {
                clean += ':4545';
            }
            if (typeof setStore === 'function') setStore('bayan_local_server_url', clean);
            this.serverUrl = clean;
            return clean;
        },

        setTerminalRole: async function(role, targetUrl = null) {
            const isClient = (role === 'client');
            this._terminalRole = isClient ? 'client' : 'master';
            if (typeof setStore === 'function') {
                setStore('bayan_terminal_role', this._terminalRole);
            }
            if (typeof require !== 'undefined') {
                try {
                    const { ipcRenderer } = require('electron');
                    await ipcRenderer.invoke('set-terminal-role', this._terminalRole);
                } catch(e) {}
            }
            this.updateHeaderButtonUI();

            if (isClient) {
                if (targetUrl) {
                    this.serverUrl = this.setServerUrl(targetUrl);
                } else {
                    this.serverUrl = this.getServerUrl();
                }
                const storedToken = (typeof getStore === 'function') ? getStore('bayan_client_device_token') : null;
                const isStoredPaired = (typeof getStore === 'function') ? getStore('bayan_client_is_paired') === 'true' : false;
                this.isPaired = isStoredPaired && !!storedToken;
                this.deviceToken = storedToken || null;

                if (typeof showToast === 'function') {
                    showToast('🔄 تم ضبط هذا الجهاز كـ كاشير فرعي (Client)', 'info');
                }
                this.openServerHubModal();
                if (!this.isPaired) {
                    await this.checkClientPairing();
                } else {
                    await this.pullMasterDb();
                    this.connectLiveStream();
                }
            } else {
                if (this._eventSource) {
                    try { this._eventSource.close(); } catch(e) {}
                    this._eventSource = null;
                }
                this.serverUrl = 'http://127.0.0.1:4545';
                this.isPaired = true;
                if (typeof setStore === 'function') {
                    setStore('bayan_local_server_url', 'http://127.0.0.1:4545');
                    setStore('bayan_client_is_paired', 'true');
                }
                if (typeof showToast === 'function') {
                    showToast('🖥️ تم ضبط هذا الجهاز كـ جهاز رئيسي (ماستر)', 'success');
                }
                this.setupMasterListeners();
                this.openServerHubModal();
            }
        },

        saveTargetServerUrl: async function(url) {
            if (!url || !url.trim()) {
                if (typeof showToast === 'function') showToast('⚠️ يرجى إدخال عنوان IP صحيح للجهاز الرئيسي', 'warning');
                return;
            }
            let clean = url.trim().replace(/\/+$/, '');
            if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
                clean = 'http://' + clean;
            }
            if (!clean.includes(':4545') && !clean.includes(':', 7)) {
                clean += ':4545';
            }
            this.serverUrl = this.setServerUrl(clean);
            this.isPaired = false;
            this.deviceToken = null;
            if (typeof setStore === 'function') {
                setStore('bayan_client_is_paired', 'false');
                setStore('bayan_client_device_token', '');
            }
            if (typeof showToast === 'function') {
                showToast('جاري الاتصال بالجهاز الرئيسي وفحص الإقران...', 'info');
            }
            this.openServerHubModal();
            await this.checkClientPairing();
            if (this.isPaired) {
                await this.pullMasterDb();
                this.connectLiveStream();
                this.openServerHubModal();
            }
        },

        _eventSource: null,

        // ⚡ الاتصال المباشر بقناة البث الحي اللحظي (Server-Sent Events)
        connectLiveStream: function() {
            if (this.isMasterServer || !this.isPaired || !this.serverUrl) return;
            if (this._eventSource) {
                try { this._eventSource.close(); } catch(e) {}
                this._eventSource = null;
            }
            const sseUrl = `${this.serverUrl}/api/sync/live-stream?token=${encodeURIComponent(this.deviceToken || '')}&deviceId=${encodeURIComponent(this.deviceId || '')}`;
            try {
                const es = new EventSource(sseUrl);
                this._eventSource = es;

                es.addEventListener('connected', async (e) => {
                    console.log('📡 [LiveStream] Connected to Master Server real-time stream!');
                    this.isServerOnline = true;
                    this.updateHeaderButtonUI();
                    if (this._hasDisconnectedOnce) {
                        this._hasDisconnectedOnce = false;
                        try {
                            console.log('🔄 [LiveStream] Reconnected after network interruption. Catching up with latest master data...');
                            await this.pullMasterDb();
                        } catch(err) {}
                    }
                });

                es.addEventListener('DELTA_UPDATE', async (e) => {
                    try {
                        const payload = JSON.parse(e.data);
                        console.log('⚡ [LiveStream] Real-time delta received from Master:', payload);
                        if (payload && payload.db) {
                            await this.applyLiveDelta(payload.db);
                        }
                    } catch(err) {
                        console.warn('[LiveStream] Delta processing error:', err);
                    }
                });

                es.addEventListener('TRANSFERS_UPDATED', (e) => {
                    try {
                        if (typeof window.refreshPendingTransfersUI === 'function') window.refreshPendingTransfersUI();
                    } catch(err) {}
                });

                es.onerror = () => {
                    this._hasDisconnectedOnce = true;
                    this.isServerOnline = false;
                    this.updateHeaderButtonUI();
                    console.warn('[LiveStream] Connection interrupted. EventSource auto-reconnecting...');
                };
            } catch(err) {
                console.warn('[LiveStream] EventSource setup error:', err);
            }
        },

        // ⚡ تطبيق التحديثات اللحظية المباشرة في الرام والواجهة في أقل من 20 مللي ثانية (0 Reload)
        applyLiveDelta: async function(db) {
            if (!db || typeof db !== 'object') return;

            let transactionsUpdated = false;
            let productsUpdated = false;
            let accountsUpdated = false;
            let warehousesUpdated = false;

            // 1. تطبيق الفواتير والعمليات
            if (Array.isArray(db.transactions) && db.transactions.length > 0) {
                if (!window.transactions) window.transactions = [];
                const mergedTx = this.mergeTransactions(db.transactions, window.transactions, window.trash || []);
                window.transactions = mergedTx;
                if (typeof transactions !== 'undefined') transactions = mergedTx;
                if (window.bayanDB && window.bayanDB.transactions) {
                    try { await window.bayanDB.transactions.bulkPut(db.transactions); } catch(e) {}
                }
                transactionsUpdated = true;
            }

            // 2. تطبيق الأصناف والمخزون
            if (Array.isArray(db.products) && db.products.length > 0) {
                if (!window.productsDB) window.productsDB = [];
                const mergedProds = this.mergeProducts(db.products, window.productsDB, window.trash || []);
                window.productsDB = mergedProds;
                if (typeof productsDB !== 'undefined') productsDB = mergedProds;
                if (window.bayanDB && window.bayanDB.products) {
                    try { await window.bayanDB.products.bulkPut(db.products); } catch(e) {}
                }
                productsUpdated = true;
            }

            // 3. تطبيق الحسابات
            if (Array.isArray(db.accounts) && db.accounts.length > 0) {
                if (!window.accounts) window.accounts = [];
                const mergedAccs = this.mergeAccounts(db.accounts, window.accounts, window.trash || []);
                window.accounts = mergedAccs;
                if (typeof accounts !== 'undefined') accounts = mergedAccs;
                if (window.bayanDB && window.bayanDB.accounts) {
                    try { await window.bayanDB.accounts.bulkPut(db.accounts); } catch(e) {}
                }
                accountsUpdated = true;
            }

            // 4. تطبيق المخازن
            if (Array.isArray(db.warehouses) && db.warehouses.length > 0) {
                window.warehouses = this.mergeWarehouses(window.warehouses || [], db.warehouses, window.trash || []);
                if (typeof warehouses !== 'undefined') warehouses = window.warehouses;
                if (window.bayanDB && window.bayanDB.warehouses) {
                    try { await window.bayanDB.warehouses.bulkPut(window.warehouses); } catch(e) {}
                }
                warehousesUpdated = true;
            }

            // 5. التحديث الفوري المباشر للواجهة النشطة في ثوانٍ معدودة دون إعادة تحميل
            window.accountBalancesCache = {};
            if (typeof invalidateStockCache === 'function') invalidateStockCache();
            if (typeof updateDatalists === 'function') updateDatalists();

            const activeSecEl = document.querySelector('.section-view:not(.hidden)');
            const currentSecId = activeSecEl ? activeSecEl.id : '';

            if (transactionsUpdated) {
                if (typeof renderInvoicesWarehouseChips === 'function') renderInvoicesWarehouseChips();
                if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
                if (typeof renderSalesHistoryTable === 'function') renderSalesHistoryTable();
                if (typeof renderDailyReportTable === 'function') renderDailyReportTable();
                if (typeof updateDashboardStats === 'function') updateDashboardStats();
            }

            if (productsUpdated) {
                if (typeof renderCart === 'function') renderCart();
                if (typeof renderProductsGrid === 'function') renderProductsGrid();
                if (currentSecId === 'inventory-section' && typeof renderInventoryTable === 'function') renderInventoryTable();
            }

            if (accountsUpdated) {
                if (currentSecId === 'accounts-section' && typeof renderAccountsTable === 'function') renderAccountsTable();
            }

            if (warehousesUpdated) {
                if (currentSecId === 'warehouses-section' && typeof renderWarehousesTable === 'function') renderWarehousesTable();
                if (typeof renderInvoicesWarehouseChips === 'function') renderInvoicesWarehouseChips();
            }

            if (typeof showToast === 'function' && (transactionsUpdated || productsUpdated)) {
                showToast('⚡ تم تحديث البيانات فورياً من الشبكة', 'info');
            }
        },

        fetchWithTimeout: async function(url, options = {}, timeoutMs = 8000) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const reqHeaders = {
                ...(options.headers || {}),
                'X-Device-Id': this.deviceId || '',
                'X-Device-Token': this.deviceToken || ''
            };
            try {
                const res = await fetch(url, { ...options, headers: reqHeaders, signal: controller.signal });
                clearTimeout(timer);
                this.isServerOnline = true;
                return res;
            } catch (err) {
                clearTimeout(timer);
                this.isServerOnline = false;
                throw err;
            }
        },

        // 📱 مستشعر استيقاظ شاشة التابلت والموبايل (Screen Wakeup & Reconnection)
        setupVisibilityWakeup: function() {
            if (typeof document === 'undefined') return;
            document.addEventListener('visibilitychange', async () => {
                if (document.visibilityState === 'visible') {
                    // الشاشة نورت وصحيت: إنعاش فوري لقناة البث الحي وسحب أي فواتير وتعديلات فوراً
                    if (!this.isMasterServer && this.isPaired && this.serverUrl) {
                        if (!this._eventSource || this._eventSource.readyState !== 1) {
                            console.log('📱 [NetworkHub] Screen woke up! Re-establishing live stream...');
                            this.connectLiveStream();
                        }
                        try {
                            const infoRes = await this.fetchWithTimeout(`${this.serverUrl}/api/server-info`, {}, 2500);
                            const info = await infoRes.json();
                            if (info && info.lastDbUpdate && info.lastDbUpdate !== this.lastSyncedTimestamp) {
                                console.log('🔄 [NetworkHub] New updates detected after wakeup! Pulling...');
                                await this.pullMasterDb();
                            }
                        } catch(e) {}
                    }
                }
            });
        },

        initDeviceId: function() {
            if (typeof getStore === 'function') {
                let id = getStore('bayan_client_device_id');
                if (!id) {
                    id = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
                    setStore('bayan_client_device_id', id);
                }
                this.deviceId = id;

                const storedToken = getStore('bayan_client_device_token');
                const isStoredPaired = getStore('bayan_client_is_paired') === 'true';
                if (storedToken && isStoredPaired) {
                    this.deviceToken = storedToken;
                    this.isPaired = true;
                }
                const storedLetter = getStore('bayan_terminal_letter');
                if (storedLetter) this.terminalLetter = storedLetter;
                const storedName = getStore('bayan_device_name');
                if (storedName) this.deviceName = storedName;
                const storedOrder = getStore('bayan_pairing_order');
                if (storedOrder) this.pairingOrder = parseInt(storedOrder, 10);
            } else {
                if (!this.deviceId) {
                    this.deviceId = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase();
                }
            }
        },

        init: async function() {
            try {
                if (this._initialized) return;
                this._initialized = true;
                this.serverUrl = this.getServerUrl();
                this.initDeviceId();

                if (this.isMasterServer) {
                    console.log('🖥️ [NetworkHub] Running as Master Server (Host / Laptop)');
                    this.setupMasterListeners();
                } else {
                    console.log('📱 [NetworkHub] Running as Client Terminal / Tablet -> Server URL:', this.serverUrl, '| Paired:', this.isPaired);
                    if (!this.isPaired) {
                        await this.checkClientPairing();
                    }
                    if (typeof getStore === 'function' && getStore('bayan_dirty_offline') === 'true') {
                        this.hasPendingOfflineSync = true;
                    }
                    if (this.isPaired) {
                        try {
                            await this.pullMasterDb();
                        } catch(e) {}
                        this.connectLiveStream();
                    }
                }

                // تحديث شكل ومسمى زر السيرفر في شريط العنوان
                this.updateHeaderButtonUI();

                // بدء المزامنة الدورية الذكية للبيانات والتحويلات ومستشعر الشاشة
                this.startAutoSyncPolling();
                this.startPendingTransfersPolling();
                this.setupSaveDataHook();
                this.setupVisibilityWakeup();
            } catch(err) {
                console.warn('[NetworkHub] init error caught:', err.message);
            }
        },

        startAutoSyncPolling: function() {
            // الماستر أو المتصفح المستقل غير المقترن لا يحتاج فحص دوري مطلقاً لتوفير الرامات والمعالج 100%
            if (this.isMasterServer || !this.isPaired) {
                return;
            }

            const pollingInterval = 12000; // فحص هادئ كل 12 ثانية بدلاً من إجهاد الشبكة كل 4 ثوانٍ

            setInterval(async () => {
                if (!this.serverUrl || !this.isPaired) return;
                // ⚡ توفير 100%: إذا كان البث اللحظي الحي (SSE) متصلاً ويعمل، نتخطى الاستطلاع تماماً (يعمل فقط كـ Fallback عند انقطاع SSE)
                if (this._eventSource && this._eventSource.readyState === 1) {
                    return;
                }
                try {
                    const infoRes = await this.fetchWithTimeout(`${this.serverUrl}/api/server-info`, {}, 1500);
                    const info = await infoRes.json();
                    
                    if (this.hasPendingOfflineSync) {
                        this.hasPendingOfflineSync = false;
                        await this.pushLocalDbToServer();
                        return;
                    }
                    
                    if (info && info.lastDbUpdate && info.lastDbUpdate !== this.lastSyncedTimestamp) {
                        await this.pullMasterDb();
                    }
                } catch (e) {
                    // السيرفر غير متاح حالياً
                }
            }, pollingInterval);
        },

        _lastDeltaTime: 0,
        setupSaveDataHook: function() {
            const originalSaveData = window.saveData;
            if (typeof originalSaveData === 'function') {
                window.saveData = async function(...args) {
                    const result = await originalSaveData.apply(this, args);
                    if (window.BayanNetworkHub) {
                        window.BayanNetworkHub.onDataSaved();
                    }
                    return result;
                };
            }
        },

        onDataSavedDebounceTimer: null,

        // 🛡️ معالج حفظ الإعدادات: محمي تماماً من إرسال كامل بيانات المحل أثناء البيع
        onDataSaved: function() {
            // 🛑 وضع الخمول الذكي: إذا كان الجهاز ماستر ومفيش أي أجهزة مقترنة، نتخطى إرسال كامل قاعدة البيانات لتوفير المعالج والرامات
            if (this.isMasterServer && !this._hasPairedDevices) {
                return;
            }
            // صمام أمان صارم: إذا كان هناك حفظ دلتا لفاتورة أو صنف تم مؤخراً (خلال آخر 15 ثانية)، نتجاهل البوش الكامل كلياً
            if (this._lastDeltaTime && (Date.now() - this._lastDeltaTime < 15000)) {
                return;
            }
            if (this.onDataSavedDebounceTimer) {
                clearTimeout(this.onDataSavedDebounceTimer);
            }
            // مهلة هادئة (8 ثوانٍ) لتجميع أي تعديلات إعدادات دون إجهاد السيرفر
            this.onDataSavedDebounceTimer = setTimeout(() => {
                if (this._lastDeltaTime && (Date.now() - this._lastDeltaTime < 15000)) {
                    return;
                }
                if (this.isMasterServer && !this._hasPairedDevices) {
                    return;
                }
                this.pushLocalDbToServer();
            }, 8000);
        },

        pendingDelta: {
            transactions: [],
            products: [],
            accounts: []
        },
        onDeltaDebounceTimer: null,

        // ⚡ المزامنة الجزئية الذكية بعد حفظ الفاتورة (ترسل فقط الفاتورة والأصناف المتأثرة بدلاً من الداتابيز بالكامل)
        onDeltaSaved: function({ newTransactions = [], modifiedProducts = [], modifiedAccounts = [] } = {}) {
            // تسجيل وقت حدوث الدلتا وإلغاء أي بوش كامل معلق فوراً
            this._lastDeltaTime = Date.now();
            if (this.onDataSavedDebounceTimer) {
                clearTimeout(this.onDataSavedDebounceTimer);
                this.onDataSavedDebounceTimer = null;
            }

            if (!this.pendingDelta) {
                this.pendingDelta = { transactions: [], products: [], accounts: [] };
            }
            if (Array.isArray(newTransactions) && newTransactions.length > 0) {
                this.pendingDelta.transactions.push(...newTransactions);
            }
            if (Array.isArray(modifiedProducts) && modifiedProducts.length > 0) {
                modifiedProducts.forEach(mp => {
                    if (!mp) return;
                    const idx = this.pendingDelta.products.findIndex(p => p && (p.id === mp.id || p.name === mp.name));
                    if (idx !== -1) {
                        this.pendingDelta.products[idx] = { ...this.pendingDelta.products[idx], ...mp };
                    } else {
                        this.pendingDelta.products.push(mp);
                    }
                });
            }
            if (Array.isArray(modifiedAccounts) && modifiedAccounts.length > 0) {
                modifiedAccounts.forEach(ma => {
                    if (!ma) return;
                    const idx = this.pendingDelta.accounts.findIndex(a => a && (a.id === ma.id || a.name === ma.name));
                    if (idx !== -1) {
                        this.pendingDelta.accounts[idx] = { ...this.pendingDelta.accounts[idx], ...ma };
                    } else {
                        this.pendingDelta.accounts.push(ma);
                    }
                });
            }

            if (this.onDeltaDebounceTimer) {
                clearTimeout(this.onDeltaDebounceTimer);
            }
            // إرسال خفيف جداً بعد 500 مللي ثانية دون أي ثقل
            this.onDeltaDebounceTimer = setTimeout(() => {
                this.pushDeltaDbToServer();
            }, 500);
        },

        pushDeltaDbToServer: async function() {
            try {
                if (!this.pendingDelta) return;
                const txs = this.pendingDelta.transactions || [];
                const prods = this.pendingDelta.products || [];
                const accs = this.pendingDelta.accounts || [];

                if (txs.length === 0 && prods.length === 0 && accs.length === 0) {
                    return;
                }

                // تجهيز الحمولة الجزئية الفائقة الخفة (حجمها أقل من 2 كيلوبايت)
                const deltaPayload = {
                    syncMode: 'delta',
                    isDelta: true,
                    transactions: txs,
                    products: prods,
                    accounts: accs,
                    isMasterServer: !!this.isMasterServer
                };

                // تصفير الطابور فوراً لمنع التكرار
                this.pendingDelta = { transactions: [], products: [], accounts: [] };

                let masterIpcSuccess = false;
                if (this.isMasterServer && typeof require !== 'undefined') {
                    try {
                        const { ipcRenderer } = require('electron');
                        await ipcRenderer.invoke('sync-master-db', deltaPayload);
                        masterIpcSuccess = true;
                    } catch(ipcErr) {}
                }

                if (!masterIpcSuccess && this.serverUrl) {
                    const res = await this.fetchWithTimeout(`${this.serverUrl}/api/sync/push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            db: deltaPayload, 
                            sourceDeviceId: this.isMasterServer ? 'DEV-HOST' : (this.deviceId || 'DEV-CLIENT'),
                            isMasterServer: !!this.isMasterServer
                        })
                    });
                    const data = await res.json();
                    if (data && data.lastUpdated) {
                        this.lastSyncedTimestamp = data.lastUpdated;
                        this.hasPendingOfflineSync = false;
                    }
                }
            } catch (e) {
                // إذا انقطع الاتصال، نؤشر للمزامنة الكاملة عند عودة الشبكة
                this.hasPendingOfflineSync = true;
                if (typeof setStore === 'function') setStore('bayan_dirty_offline', 'true');
            }
        },

        DEVICE_LOCAL_SETTINGS_KEYS: new Set([
            'bayan_terminal_role',
            'bayan_client_device_id',
            'bayan_client_device_token',
            'bayan_client_is_paired',
            'bayan_terminal_letter',
            'bayan_pairing_order',
            'bayan_device_name',
            'bayan_local_server_url',
            'bayan_is_master_terminal',
            'bayan_hwid',
            'hwid',
            'bayan_device_prefix',
            'bayan_user_name',
            'bayan_user_warehouse',
            'pos_session_user',
            'bayan_install_date',
            'bayan_paid_start_date',
            'bayan_sub_transfer_phone',
            'bayan_purged_trash_ids',
            'license_info',
            'bayan_license_info',
            'bayan_active_license',
            'bayan_master_license',
            'bayan_master_hwid',
            'bayan_machine_id',
            'bayan_max_seen_timestamp',
            'bayan_expiry_date'
        ]),

        pushLocalDbToServer: async function(force = false) {
            try {
                // 🛑 وضع الخمول الذكي: إذا كان الجهاز ماستر ومفيش أي أجهزة مقترنة حالياً، لا داعي نهائياً لحزم ونقل الداتابيز بالكامل
                if (!force && this.isMasterServer && !this._hasPairedDevices) return;

                // إذا لم تكن البيانات قد تم تحميلها بعد في الرام، نتجاهل الإرسال
                if (!window.productsDB || !Array.isArray(window.productsDB)) return;

                // تصفية الإعدادات لحجب أي مفاتيح محلية خاصة بالجهاز
                const cleanSettings = {};
                if (window.AppStore && typeof window.AppStore === 'object') {
                    Object.keys(window.AppStore).forEach(k => {
                        if (!this.DEVICE_LOCAL_SETTINGS_KEYS.has(k)) {
                            cleanSettings[k] = window.AppStore[k];
                        }
                    });
                }

                // إذا كان هذا هو السيرفر الرئيسي (Master)، نشارك باقة الترخيص وكود الجهاز الموحد مع الأجهزة الفرعية المقترنة
                if (this.isMasterServer && typeof getStore === 'function') {
                    const masterLic = getStore('license_info');
                    if (masterLic) cleanSettings['bayan_master_license'] = masterLic;
                    const masterHwid = getStore('bayan_hwid') || getStore('bayan_machine_id');
                    if (masterHwid) cleanSettings['bayan_master_hwid'] = masterHwid;
                }

                const dbPayload = {
                    products: window.productsDB || [],
                    accounts: window.accounts || [],
                    transactions: window.transactions || [],
                    users: (window.users || []).map(u => ({
                        ...u,
                        pin: (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
                            ? window.BayanSecurity.encryptPin(u.pin)
                            : u.pin
                    })),
                    warehouses: window.warehouses || [],
                    trash: (window.trashBin && Array.isArray(window.trashBin) && window.trashBin.length > 0) ? window.trashBin : (Array.isArray(window.trash) ? window.trash : []),
                    purgedTrashIds: window.purgedTrashIds || [],
                    treasuryAudit: window.treasuryAuditRecords || window.treasuryAudit || [],
                    settings: cleanSettings,
                    isMasterServer: !!this.isMasterServer
                };

                // إرسال عبر IPC إذا كان في بيئة Electron وكان هذا الجهاز ماستر
                let masterIpcSuccess = false;
                if (this.isMasterServer && typeof require !== 'undefined') {
                    try {
                        const { ipcRenderer } = require('electron');
                        await ipcRenderer.invoke('sync-master-db', dbPayload);
                        masterIpcSuccess = true;
                    } catch(ipcErr) {}
                }

                // إرسال عبر HTTP POST فقط إذا لم نكن الماستر في Electron أو إذا فشل IPC
                if (!masterIpcSuccess && Array.isArray(dbPayload.products) && this.serverUrl) {
                    const res = await this.fetchWithTimeout(`${this.serverUrl}/api/sync/push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            db: dbPayload, 
                            sourceDeviceId: this.isMasterServer ? 'DEV-HOST' : (this.deviceId || 'DEV-CLIENT'),
                            isMasterServer: !!this.isMasterServer
                        })
                    });
                    const data = await res.json();
                    if (data && data.lastUpdated) {
                        this.lastSyncedTimestamp = data.lastUpdated;
                        if (typeof removeStore === 'function') removeStore('bayan_dirty_offline');
                        this.hasPendingOfflineSync = false;
                    }
                    console.log(`✅ [NetworkHub] DB synced to local server successfully (${dbPayload.products.length} products).`);
                }
            } catch (e) {
                // في حالة العمل محلياً أوفلاين أو عدم تشغيل سيرفر الشبكة، نتجاهل التحذير لتفادي تكراره في الكونسول
                this.isServerOnline = false;
                this.hasPendingOfflineSync = true;
                if (typeof setStore === 'function') setStore('bayan_dirty_offline', 'true');
            }
        },

        getTerminalKey: function(t) {
            if (!t) return 'HOST';
            return String(t.terminalId || t.terminalLetter || t.terminal || 'HOST').trim();
        },

        getDetailedInvoiceType: function(typeStr) {
            const s = String(typeStr || '').toLowerCase();
            if (s.includes('مرتجع شراء') || s.includes('purchase_return')) return 'purchase_return';
            if (s.includes('مرتجع') || s.includes('sales_return') || s.includes('return')) return 'sales_return';
            if (s.includes('شراء') || s.includes('purchase')) return 'purchase';
            if (s.includes('بيع') || s.includes('sale')) return 'sale';
            if (s.includes('قبض') || s.includes('receipt')) return 'receipt';
            if (s.includes('صرف') || s.includes('payment') || s.includes('disbursement')) return 'disbursement';
            if (s.includes('تحويل') || s.includes('transfer')) return 'transfer';
            if (s.includes('تسوية') || s.includes('adjustment')) return 'adjustment';
            if (s.includes('رصيد اول') || s.includes('opening')) return 'opening';
            return s.trim() || 'other';
        },

        getTrashedTransactionKeys: function(trashList = []) {
            const keySet = new Set();
            const invIdSet = new Set();
            if (!Array.isArray(trashList)) return { keySet, invIdSet };

            trashList.forEach(t => {
                if (!t) return;
                const tp = String(t.type || '').toLowerCase();
                if (tp.includes('transaction') || tp.includes('invoice') || tp.includes('فاتورة') || tp.includes('حركة') || tp.includes('sale') || tp.includes('purchase')) {
                    const data = t.originalData || t;
                    const items = Array.isArray(data) ? data : (data.items ? data.items : [data]);
                    items.forEach(it => {
                        if (!it) return;
                        const term = this.getTerminalKey(it);
                        const dType = this.getDetailedInvoiceType(it.type);
                        if (it.id) {
                            keySet.add(`term_${term}_id_${it.id}`);
                            keySet.add(`id_${it.id}`);
                            keySet.add(String(it.id));
                        }
                        if (it.invoiceId != null && it.invoiceId !== '') {
                            invIdSet.add(`${term}__${dType}__${it.invoiceId}`);
                            if (!it.terminalId && !it.terminalLetter) {
                                invIdSet.add(`${dType}__${it.invoiceId}`);
                            }
                        }
                        const inv = it.invoiceId || '';
                        const prod = it.product || it.productName || '';
                        const s = it.size || it.selectedSize || '';
                        const c = it.color || it.selectedColor || '';
                        const d = it.dateISO || it.date || '';
                        const tm = it.timeISO || it.time || '';
                        const wh = it.warehouse || '';
                        const qty = it.qty || 0;
                        keySet.add(`tx_${term}_${dType}_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`);
                        keySet.add(`tx_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`);
                    });
                }
            });
            return { keySet, invIdSet };
        },

        getTrashedProductKeys: function(trashList = []) {
            const set = new Set();
            if (!Array.isArray(trashList)) return set;
            trashList.forEach(t => {
                if (!t) return;
                const tp = String(t.type || '').toLowerCase();
                if (tp.includes('product') || tp.includes('inventory') || tp.includes('صنف') || tp.includes('بضاعة')) {
                    const d = t.originalData || t;
                    const items = Array.isArray(d) ? d : [d];
                    items.forEach(it => {
                        if (!it) return;
                        if (it.id) set.add(String(it.id));
                        if (it.barcode) set.add(String(it.barcode).trim());
                    });
                }
            });
            return set;
        },

        getTrashedAccountKeys: function(trashList = []) {
            const set = new Set();
            if (!Array.isArray(trashList)) return set;
            trashList.forEach(t => {
                if (!t) return;
                const tType = String(t.type || '').toLowerCase();
                if (tType.includes('account') || tType.includes('عميل') || tType.includes('مورد') || tType.includes('حساب')) {
                    const d = t.originalData || t;
                    const items = Array.isArray(d) ? d : [d];
                    items.forEach(it => {
                        if (!it) return;
                        if (it.id) set.add(String(it.id));
                        if (it.name) set.add(String(it.name).trim());
                    });
                }
            });
            return set;
        },

        getTrashedWarehouseKeys: function(trashList = []) {
            const set = new Set();
            if (!Array.isArray(trashList)) return set;
            trashList.forEach(t => {
                if (!t) return;
                const tp = String(t.type || '').toLowerCase();
                if (tp.includes('warehouse') || tp.includes('مخزن')) {
                    const d = t.originalData || t;
                    const w = d.warehouse || d;
                    if (w.id) set.add(String(w.id));
                    if (w.name) set.add(String(w.name).trim());
                }
            });
            return set;
        },

        getTrashedUserKeys: function(trashList = []) {
            const set = new Set();
            if (!Array.isArray(trashList)) return set;
            trashList.forEach(t => {
                if (!t) return;
                const tp = String(t.type || '').toLowerCase();
                if (tp.includes('user') || tp.includes('مستخدم')) {
                    const d = t.originalData || t;
                    if (d.id) set.add(String(d.id));
                    if (d.name) set.add(String(d.name).trim());
                    if (d.pin) set.add(String(d.pin).trim());
                }
            });
            return set;
        },

        mergeTransactions: function(existingList = [], incomingList = [], trashList = []) {
            const { keySet: trashedKeys, invIdSet: trashedInvIds } = this.getTrashedTransactionKeys(trashList);

            const isTrashed = (t) => {
                if (!t) return true;
                const term = this.getTerminalKey(t);
                const dType = this.getDetailedInvoiceType(t.type);
                if (t.id && (trashedKeys.has(`term_${term}_id_${t.id}`) || trashedKeys.has(`id_${t.id}`) || trashedKeys.has(String(t.id)))) return true;
                if (t.invoiceId != null && t.invoiceId !== '') {
                    if (trashedInvIds.has(`${term}__${dType}__${t.invoiceId}`) || trashedInvIds.has(`${dType}__${t.invoiceId}`)) {
                        return true;
                    }
                }
                const inv = t.invoiceId || '';
                const prod = t.product || t.productName || '';
                const s = t.size || t.selectedSize || '';
                const c = t.color || t.selectedColor || '';
                const d = t.dateISO || t.date || '';
                const tm = t.timeISO || t.time || '';
                const wh = t.warehouse || '';
                const qty = t.qty || 0;
                const compKey = `tx_${term}_${dType}_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`;
                const legacyCompKey = `tx_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`;
                return trashedKeys.has(compKey) || trashedKeys.has(legacyCompKey);
            };

            const cleanExisting = (Array.isArray(existingList) ? existingList : []).filter(t => !isTrashed(t));
            const cleanIncoming = (Array.isArray(incomingList) ? incomingList : []).filter(t => !isTrashed(t));

            if (cleanExisting.length === 0) return cleanIncoming;
            if (cleanIncoming.length === 0) return cleanExisting;

            // 1. تحديد أرقام الفواتير الواردة مفصولة بالجهاز ونوع الفاتورة الدقيق
            const incomingInvoiceKeys = new Set();
            cleanIncoming.forEach(t => {
                if (t && t.invoiceId != null && t.invoiceId !== '') {
                    const term = this.getTerminalKey(t);
                    const dType = this.getDetailedInvoiceType(t.type);
                    incomingInvoiceKeys.add(`${term}__${dType}__${t.invoiceId}`);
                }
            });

            const map = new Map();
            const getKey = (t) => {
                if (!t) return '';
                const term = this.getTerminalKey(t);
                const dType = this.getDetailedInvoiceType(t.type);
                if (t.id && t.invoiceId != null && t.invoiceId !== '') {
                    return `term_${term}_type_${dType}_inv_${t.invoiceId}_id_${t.id}`;
                }
                if (t.id) {
                    return `term_${term}_type_${dType}_id_${t.id}`;
                }
                const inv = t.invoiceId || '';
                const prod = t.product || t.productName || '';
                const s = t.size || t.selectedSize || '';
                const c = t.color || t.selectedColor || '';
                const d = t.dateISO || t.date || '';
                const tm = t.timeISO || t.time || '';
                const wh = t.warehouse || '';
                const qty = t.qty || 0;
                return `tx_${term}_${dType}_${inv}_${prod}_${s}_${c}_${d}_${tm}_${wh}_${qty}`;
            };

            // 2. إضافة حركات القائمة السابقة مع استبعاد النسخ القديمة لنفس الفاتورة من نفس الجهاز ونفس النوع
            cleanExisting.forEach(t => {
                if (!t) return;
                if (t.invoiceId != null && t.invoiceId !== '') {
                    const term = this.getTerminalKey(t);
                    const dType = this.getDetailedInvoiceType(t.type);
                    if (incomingInvoiceKeys.has(`${term}__${dType}__${t.invoiceId}`)) {
                        return; // استبعاد النسخة القديمة لصالح الأحدث
                    }
                }
                const k = getKey(t);
                if (k) map.set(k, t);
            });

            // 3. إضافة كافة الحركات الواردة
            cleanIncoming.forEach(t => {
                const k = getKey(t);
                if (!k) return;
                if (!map.has(k)) {
                    map.set(k, t);
                } else {
                    const existing = map.get(k);
                    map.set(k, { ...existing, ...t });
                }
            });

            return Array.from(map.values()).filter(t => !isTrashed(t));
        },

        mergeProducts: function(existingList = [], incomingList = [], trashList = []) {
            const trashedKeys = this.getTrashedProductKeys(trashList);

            if (!Array.isArray(existingList) || existingList.length === 0) {
                return (Array.isArray(incomingList) ? incomingList : []).filter(p => p && !trashedKeys.has(String(p.id)) && !trashedKeys.has(String(p.barcode || '').trim()));
            }
            if (!Array.isArray(incomingList) || incomingList.length === 0) {
                return existingList.filter(p => p && !trashedKeys.has(String(p.id)) && !trashedKeys.has(String(p.barcode || '').trim()));
            }

            const map = new Map();
            const getKey = (p) => p.id || p.barcode || p.name;

            existingList.forEach(p => {
                const k = getKey(p);
                if (k && !trashedKeys.has(String(k))) map.set(String(k), p);
            });

            incomingList.forEach(p => {
                const k = getKey(p);
                if (!k || trashedKeys.has(String(k))) return;
                const sKey = String(k);
                if (!map.has(sKey)) {
                    map.set(sKey, p);
                } else {
                    const existing = map.get(sKey);
                    const mergedWhStocks = { ...(existing.warehouseStocks || {}) };
                    if (p.warehouseStocks && typeof p.warehouseStocks === 'object') {
                        Object.keys(p.warehouseStocks).forEach(wh => {
                            const incQty = parseFloat(p.warehouseStocks[wh]);
                            if (!isNaN(incQty)) mergedWhStocks[wh] = incQty;
                        });
                    }

                    let mergedVariants = p.variants || existing.variants;
                    if (Array.isArray(existing.variants) && Array.isArray(p.variants)) {
                        const varMap = new Map();
                        existing.variants.forEach(v => varMap.set(`${v.size}_${v.color}`, v));
                        p.variants.forEach(v => {
                            const vk = `${v.size}_${v.color}`;
                            if (!varMap.has(vk)) {
                                varMap.set(vk, v);
                            } else {
                                const ev = varMap.get(vk);
                                const vWhStocks = { ...(ev.warehouseStocks || {}) };
                                if (v.warehouseStocks && typeof v.warehouseStocks === 'object') {
                                    Object.keys(v.warehouseStocks).forEach(wh => {
                                        const iq = parseFloat(v.warehouseStocks[wh]);
                                        if (!isNaN(iq)) vWhStocks[wh] = iq;
                                    });
                                }
                                const vTotalStock = Object.keys(vWhStocks).length > 0
                                    ? Object.values(vWhStocks).reduce((sum, q) => sum + (parseFloat(q) || 0), 0)
                                    : (v.stock !== undefined ? v.stock : ev.stock);

                                varMap.set(vk, { 
                                    ...ev, 
                                    ...v, 
                                    warehouseStocks: vWhStocks,
                                    stock: vTotalStock,
                                    cost: v.cost !== undefined ? v.cost : ev.cost
                                });
                            }
                        });
                        mergedVariants = Array.from(varMap.values());
                    }

                    const totalStock = Object.keys(mergedWhStocks).length > 0
                        ? Object.values(mergedWhStocks).reduce((sum, q) => sum + (parseFloat(q) || 0), 0)
                        : (p.stock !== undefined ? p.stock : existing.stock);

                    if (this.isMasterServer) {
                        map.set(sKey, {
                            ...existing,
                            ...p,
                            stock: totalStock,
                            warehouseStocks: mergedWhStocks,
                            variants: mergedVariants
                        });
                    } else {
                        map.set(sKey, {
                            ...existing,
                            stock: totalStock,
                            warehouseStocks: mergedWhStocks,
                            variants: mergedVariants
                        });
                    }
                }
            });

            return Array.from(map.values()).filter(p => p && !trashedKeys.has(String(p.id)) && !trashedKeys.has(String(p.barcode || '').trim()));
        },

        mergeAccounts: function(existingList = [], incomingList = [], trashList = []) {
            const trashedKeys = this.getTrashedAccountKeys(trashList);

            if (!Array.isArray(existingList) || existingList.length === 0) {
                return (Array.isArray(incomingList) ? incomingList : []).filter(a => a && !trashedKeys.has(String(a.id)) && !trashedKeys.has(String(a.name || '').trim()));
            }
            if (!Array.isArray(incomingList) || incomingList.length === 0) {
                return existingList.filter(a => a && !trashedKeys.has(String(a.id)) && !trashedKeys.has(String(a.name || '').trim()));
            }

            const map = new Map();
            const getKey = (a) => a.id || a.code || a.name;

            existingList.forEach(a => {
                const k = getKey(a);
                if (k && !trashedKeys.has(String(k))) map.set(String(k), a);
            });

            incomingList.forEach(a => {
                const k = getKey(a);
                if (!k || trashedKeys.has(String(k))) return;
                const sKey = String(k);
                if (!map.has(sKey)) {
                    map.set(sKey, a);
                } else {
                    const existing = map.get(sKey);
                    map.set(sKey, { ...existing, ...a });
                }
            });

            return Array.from(map.values()).filter(a => a && !trashedKeys.has(String(a.id)) && !trashedKeys.has(String(a.name || '').trim()));
        },

        mergeTrash: function(existingList = [], incomingList = [], purgedTrashIds = []) {
            const purgedSet = new Set((Array.isArray(purgedTrashIds) ? purgedTrashIds : []).map(id => String(id)));

            const map = new Map();
            const getKey = (item) => item.id || `${item.type}_${item.label}_${item.deletedAt}`;

            (Array.isArray(existingList) ? existingList : []).forEach(it => {
                const k = getKey(it);
                if (k && !purgedSet.has(String(k)) && !purgedSet.has(String(it.id))) {
                    map.set(String(k), it);
                }
            });

            (Array.isArray(incomingList) ? incomingList : []).forEach(it => {
                const k = getKey(it);
                if (!k || purgedSet.has(String(k)) || purgedSet.has(String(it.id))) return;
                const sKey = String(k);
                if (!map.has(sKey)) {
                    map.set(sKey, it);
                }
            });

            return Array.from(map.values()).filter(it => it && !purgedSet.has(String(it.id)) && !purgedSet.has(String(getKey(it))));
        },

        mergeUsers: function(existingList = [], incomingList = [], trashList = []) {
            const trashedKeys = this.getTrashedUserKeys(trashList);
            const map = new Map();
            const getKey = (u) => u.id ? `id_${u.id}` : (u.name || u.pin);

            (Array.isArray(existingList) ? existingList : []).forEach(u => {
                if (!u) return;
                if (u.id !== 1 && (trashedKeys.has(String(u.id)) || trashedKeys.has(String(u.name || '').trim()))) return;
                const k = getKey(u);
                if (k) map.set(k, u);
            });

            (Array.isArray(incomingList) ? incomingList : []).forEach(u => {
                if (!u) return;
                if (u.id !== 1 && (trashedKeys.has(String(u.id)) || trashedKeys.has(String(u.name || '').trim()))) return;
                const k = getKey(u);
                if (!k) return;
                if (!map.has(k)) {
                    map.set(k, u);
                } else {
                    const existing = map.get(k);
                    map.set(k, { ...existing, ...u });
                }
            });

            const result = Array.from(map.values()).filter(u => u && (u.id === 1 || (!trashedKeys.has(String(u.id)) && !trashedKeys.has(String(u.name || '').trim()))));
            return result.length > 0 ? result : (existingList || []);
        },

        mergeWarehouses: function(existingList = [], incomingList = [], trashList = []) {
            const trashedKeys = this.getTrashedWarehouseKeys(trashList);
            const map = new Map();
            const getKey = (w) => w.name ? String(w.name).trim() : (w.id ? String(w.id) : '');

            (Array.isArray(existingList) ? existingList : []).forEach(w => {
                if (!w) return;
                const k = getKey(w);
                if (k && !trashedKeys.has(k) && !trashedKeys.has(String(w.id))) {
                    map.set(k, w);
                }
            });

            (Array.isArray(incomingList) ? incomingList : []).forEach(w => {
                if (!w) return;
                const k = getKey(w);
                if (!k || trashedKeys.has(k) || trashedKeys.has(String(w.id))) return;
                if (!map.has(k)) {
                    map.set(k, w);
                } else {
                    const existing = map.get(k);
                    map.set(k, { ...existing, ...w });
                }
            });

            const result = Array.from(map.values()).filter(w => w && !trashedKeys.has(String(w.name || '').trim()));
            if (result.length === 0) {
                result.push({ id: 1, name: 'المخزن الرئيسي', address: 'المقر الرئيسي' });
            }
            return result;
        },

        pullMasterDb: async function() {
            if (this.isPulling) return;
            this.isPulling = true;
            try {
                // ⏱️ مهلة وافية (15 ثانية) لضمان سحب كامل بضاعة ومخازن المحل للتابلت حتى مع ضعف الواي فاي
                const res = await this.fetchWithTimeout(`${this.serverUrl}/api/sync/pull`, {}, 15000);
                const data = await res.json();
                if (data.success && data.db) {
                    const db = data.db;
                    if (!Array.isArray(db.products) || db.products.length === 0) {
                        console.log('ℹ️ [NetworkHub] Server DB is currently empty. Waiting for Master sync...');
                        return;
                    }
                    this.lastSyncedTimestamp = db.lastUpdated || new Date().toISOString();

                    // 1. دمج سلة المحذوفات أولاً وتحديثها فورياً
                    const mergedTrash = this.mergeTrash(db.trash || [], window.trashBin || [], window.purgedTrashIds || []);
                    window.trash = window.trashBin = mergedTrash;
                    if (typeof trashBin !== 'undefined') trashBin = mergedTrash;
                    const trashedKeys = this.getTrashedProductKeys(mergedTrash);
                    const trashedAccountKeys = this.getTrashedAccountKeys(mergedTrash);
                    const { keySet: trashedTxKeys, invIdSet: trashedInvIds } = this.getTrashedTransactionKeys(mergedTrash);

                    // 2. دمج ذكي للعمليات والفواتير يحجب المحذوفات
                    const mergedTransactions = this.mergeTransactions(db.transactions || [], window.transactions || [], mergedTrash);
                    window.transactions = mergedTransactions;
                    if (typeof transactions !== 'undefined') transactions = mergedTransactions;

                    // 3. دمج الأصناف وتحديث المخزون
                    if (Array.isArray(db.products)) {
                        window.productsDB = this.mergeProducts(db.products, window.productsDB || [], mergedTrash);
                        if (typeof productsDB !== 'undefined') productsDB = window.productsDB;
                    }

                    // 4. دمج الحسابات
                    if (Array.isArray(db.accounts)) {
                        window.accounts = this.mergeAccounts(db.accounts, window.accounts || [], mergedTrash);
                        if (typeof accounts !== 'undefined') accounts = window.accounts;
                    }

                    if (Array.isArray(db.treasuryAudit)) {
                        window.treasuryAudit = window.treasuryAuditRecords = db.treasuryAudit;
                        if (typeof renderTreasuryAuditTable === 'function') renderTreasuryAuditTable();
                    }

                    if (Array.isArray(db.warehouses) && db.warehouses.length > 0) {
                        window.warehouses = this.mergeWarehouses(window.warehouses || [], db.warehouses, mergedTrash);
                        if (typeof warehouses !== 'undefined') warehouses = window.warehouses;
                        if (typeof setStore === 'function') setStore('pos_warehouses', JSON.stringify(window.warehouses));
                    }

                    // 5. دمج وتحديث الإعدادات مع حجب المفاتيح المحلية الخاصة بالجهاز
                    if (db.settings && typeof db.settings === 'object') {
                        const cleanIncoming = {};
                        Object.keys(db.settings).forEach(k => {
                            if (!this.DEVICE_LOCAL_SETTINGS_KEYS.has(k)) {
                                cleanIncoming[k] = db.settings[k];
                                if (typeof setStore === 'function') setStore(k, db.settings[k]);
                            }
                        });
                        window.AppStore = { ...window.AppStore, ...cleanIncoming };

                        // مشاركة باقة وترخيص الماستر وكود الجهاز الموحد مع الأجهزة الفرعية / المتصفحات المتصلة
                        if (!this.isMasterServer && db.settings) {
                            if (db.settings.bayan_master_hwid) {
                                if (typeof setStore === 'function') setStore('bayan_master_hwid', db.settings.bayan_master_hwid);
                                if (typeof window.updateUnifiedHwidDisplay === 'function') {
                                    window.updateUnifiedHwidDisplay(db.settings.bayan_master_hwid);
                                }
                            }
                            if (db.settings.bayan_master_license) {
                                try {
                                    let mLic = db.settings.bayan_master_license;
                                    if (typeof mLic === 'string') mLic = JSON.parse(mLic);
                                    if (mLic && mLic.plan && mLic.plan !== 'Blocked') {
                                        window.activeLicense = {
                                            plan: mLic.plan,
                                            expiry: mLic.expiry || '',
                                            isValid: true,
                                            activationDate: mLic.activationDate || new Date().toISOString()
                                        };
                                        if (typeof setStore === 'function') {
                                            setStore('bayan_master_license', JSON.stringify(mLic));
                                        }
                                        if (typeof LicenseService !== 'undefined' && typeof LicenseService.verifyLicense === 'function') {
                                            LicenseService.verifyLicense();
                                        }
                                        if (typeof hideBayanLicenseLockModal === 'function') {
                                            hideBayanLicenseLockModal();
                                        }
                                    }
                                } catch(e) {}
                            }
                        }
                    }

                    // 6. تطهير وتنظيف قاعدة بيانات Dexie المحلية وتحديثها بدقة
                    if (window.bayanDB) {
                        try {
                            if (window.bayanDB.products) {
                                const currentLocal = await window.bayanDB.products.toArray();
                                const serverIdSet = new Set((window.productsDB || []).map(p => p.id));
                                const obsoleteIds = currentLocal.filter(p => !serverIdSet.has(p.id) || trashedKeys.has(String(p.id))).map(p => p.id);
                                if (obsoleteIds.length > 0) {
                                    await window.bayanDB.products.bulkDelete(obsoleteIds);
                                }
                                if (window.productsDB && window.productsDB.length > 0) {
                                    await window.bayanDB.products.bulkPut(window.productsDB);
                                }
                            }
                            if (window.bayanDB.accounts) {
                                const currentLocalAccs = await window.bayanDB.accounts.toArray();
                                const serverAccIdSet = new Set((window.accounts || []).map(a => a.id));
                                const obsoleteAccIds = currentLocalAccs.filter(a => !serverAccIdSet.has(a.id) || trashedAccountKeys.has(String(a.id))).map(a => a.id);
                                if (obsoleteAccIds.length > 0) {
                                    await window.bayanDB.accounts.bulkDelete(obsoleteAccIds);
                                }
                                if (window.accounts && window.accounts.length > 0) {
                                    await window.bayanDB.accounts.bulkPut(window.accounts);
                                }
                            }
                            if (window.bayanDB.transactions) {
                                const currentLocalTxs = await window.bayanDB.transactions.toArray();
                                const activeTxIdSet = new Set((window.transactions || []).map(t => t.id));
                                const obsoleteTxIds = currentLocalTxs.filter(t => 
                                    !activeTxIdSet.has(t.id) || 
                                    trashedTxKeys.has(String(t.id)) || 
                                    trashedTxKeys.has(`id_${t.id}`) ||
                                    (t.invoiceId != null && (trashedInvIds.has(String(t.invoiceId)) || trashedInvIds.has(Number(t.invoiceId))))
                                ).map(t => t.id);
                                if (obsoleteTxIds.length > 0) {
                                    await window.bayanDB.transactions.bulkDelete(obsoleteTxIds);
                                }
                                if (mergedTransactions && mergedTransactions.length > 0) {
                                    await window.bayanDB.transactions.bulkPut(mergedTransactions);
                                }
                            }
                            if (window.bayanDB.trash) {
                                await window.bayanDB.trash.clear();
                                if (mergedTrash && mergedTrash.length > 0) {
                                    await window.bayanDB.trash.bulkPut(mergedTrash);
                                }
                            }
                            if (window.bayanDB.warehouses) {
                                await window.bayanDB.warehouses.clear();
                                if (window.warehouses && window.warehouses.length > 0) {
                                    await window.bayanDB.warehouses.bulkPut(window.warehouses);
                                }
                            }
                        } catch(dexErr) {}
                    }

                    // 7. تحديث المستخدمين وقائمة تسجيل الدخول
                    if (Array.isArray(db.users) && db.users.length > 0) {
                        const normalizedUsers = db.users.map(u => ({
                            ...u,
                            pin: (window.BayanSecurity && typeof window.BayanSecurity.decryptPin === 'function')
                                ? window.BayanSecurity.decryptPin(u.pin)
                                : u.pin
                        }));
                        window.users = this.mergeUsers(window.users || [], normalizedUsers, mergedTrash);
                        if (typeof users !== 'undefined') users = window.users;
                        if (window.bayanDB && window.bayanDB.users) {
                            try {
                                await window.bayanDB.users.clear();
                                const secureUsers = window.users.map(u => ({
                                    ...u,
                                    pin: (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
                                        ? window.BayanSecurity.encryptPin(u.pin)
                                        : u.pin
                                }));
                                await window.bayanDB.users.bulkPut(secureUsers);
                            } catch(e) {}
                        }
                        if (!window.currentUser && typeof initLogin === 'function') {
                            initLogin();
                        } else if (window.currentUser) {
                            const updatedSelf = window.users.find(u => u.pin === window.currentUser.pin || u.id === window.currentUser.id);
                            if (!updatedSelf || updatedSelf.isFrozen) {
                                if (typeof showToast === 'function') {
                                    showToast('⚠️ تم تجميد أو حذف حسابك من قبل مدير النظام! جاري تسجيل الخروج...', 'error');
                                }
                                setTimeout(() => {
                                    if (typeof logoutUser === 'function') logoutUser();
                                    else if (typeof initLogin === 'function') initLogin();
                                }, 800);
                            } else {
                                window.currentUser = { ...window.currentUser, ...updatedSelf };
                            }
                        }
                    }

                    // تحديث شاشة الدخول إذا لم يتم تسجيل الدخول بعد لتظهر أسماء المستخدمين والمخازن فوراً
                    if (!window.currentUser && typeof initLogin === 'function') {
                        initLogin();
                    }

                    // 8. تحديث ذكي وسريع للواجهة النشطة فقط لتوفير موارد المتصفح والرامات (0 Lag)
                    window.accountBalancesCache = {};
                    if (typeof invalidateStockCache === 'function') invalidateStockCache();
                    if (typeof updateDatalists === 'function') updateDatalists();
                    if (typeof renderCart === 'function') renderCart();
                    if (typeof renderProductsGrid === 'function') renderProductsGrid();

                    const activeSecEl = document.querySelector('.section-view:not(.hidden)');
                    const currentSecId = activeSecEl ? activeSecEl.id : '';

                    if (currentSecId === 'inventory-section' && typeof renderInventoryTable === 'function') renderInventoryTable();
                    if (currentSecId === 'accounts-section' && typeof renderAccountsTable === 'function') renderAccountsTable();
                    if (currentSecId === 'users-section' && typeof renderUsersTable === 'function') renderUsersTable();
                    if (currentSecId === 'dashboard-section' && typeof updateDashboardStats === 'function') updateDashboardStats();
                    if (currentSecId === 'daily-report-section' && typeof renderDailyReportTable === 'function') renderDailyReportTable();
                    if (currentSecId === 'sales-history-section' && typeof renderSalesHistoryTable === 'function') renderSalesHistoryTable();
                    if (currentSecId === 'invoices-section' && typeof renderInvoicesTable === 'function') renderInvoicesTable();
                    if (currentSecId === 'warehouses-section' && typeof renderWarehousesTable === 'function') renderWarehousesTable();
                    if (currentSecId === 'settings-section' && typeof updateSettingsWarehouseSelect === 'function') updateSettingsWarehouseSelect();

                    // تحديث جدول سلة المحذوفات
                    if (typeof renderTrashTable === 'function') renderTrashTable();
                    if (window.trashManager && typeof window.trashManager.renderTrashTable === 'function') {
                        window.trashManager.renderTrashTable();
                    }

                    if (typeof updateNotifications === 'function') updateNotifications();
                    if (typeof updateLogoDisplays === 'function') {
                        updateLogoDisplays((db.settings && db.settings.bayan_business_logo) ? db.settings.bayan_business_logo : null);
                    }
                    console.log(`✅ [NetworkHub] Pulled all master data successfully (${window.productsDB ? window.productsDB.length : 0} products)`);
                    if (this.hasPendingOfflineSync) {
                        this.hasPendingOfflineSync = false;
                        this.pushLocalDbToServer();
                    }
                }
            } catch (err) {
                console.warn('[NetworkHub] pullMasterDb failed:', err.message);
            } finally {
                this.isPulling = false;
            }
        },

        shownPairingRequestIds: new Set(),

        initDeviceId: function() {
            let id = (typeof getStore === 'function') ? getStore('bayan_client_device_id') : null;
            if (!id) {
                id = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
                if (typeof setStore === 'function') setStore('bayan_client_device_id', id);
            }
            this.deviceId = id;
            this.deviceToken = (typeof getStore === 'function' ? getStore('bayan_client_device_token') : null) || null;
            const isSavedPaired = (typeof getStore === 'function' ? getStore('bayan_client_is_paired') : null) === 'true';
            this.isPaired = isSavedPaired || !!this.deviceToken || this.isMasterServer;

            if (typeof getStore === 'function') {
                const storedLetter = getStore('bayan_terminal_letter');
                if (storedLetter) this.terminalLetter = storedLetter;
                const storedName = getStore('bayan_device_name');
                if (storedName) this.deviceName = storedName;
                const storedOrder = getStore('bayan_pairing_order');
                if (storedOrder) this.pairingOrder = parseInt(storedOrder, 10);
            }
        },

        setupMasterListeners: function() {
            if (this.isMasterServer && typeof require === 'undefined') {
                // فحص دوري لطلبات الإقران المعلقة فقط إذا كان المتصفح يعمل عبر السيرفر المحلي الفعلي
                const isHostedOnServer = window.location.origin.includes(':4545') || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/);
                if (isHostedOnServer) {
                    setInterval(async () => {
                        try {
                            const res = await this.fetchWithTimeout(`${this.serverUrl}/api/pair-requests/pending`, {}, 1500);
                            const data = await res.json();
                            if (data.success && Array.isArray(data.requests) && data.requests.length > 0) {
                                data.requests.forEach(req => {
                                    if (!this.shownPairingRequestIds.has(req.id) && !document.getElementById('masterPairingAlertModal')) {
                                        this.showMasterPairingAlert(req);
                                    }
                                });
                            }
                        } catch(e) {}
                    }, 8000);
                }
            }

            if (!this.isMasterServer || typeof require === 'undefined') return;
            try {
                const { ipcRenderer } = require('electron');
                
                // فحص أولي لعدد الأجهزة المقترنة لضبط وضع الخمول
                ipcRenderer.invoke('get-paired-devices').then(list => {
                    this._hasPairedDevices = Array.isArray(list) && list.length > 0;
                    if (this._hasPairedDevices) {
                        setTimeout(() => this.pushLocalDbToServer(), 12000);
                    }
                }).catch(() => { this._hasPairedDevices = false; });
                
                // تحديث البيانات عند وصول بوش من جهاز تابلت
                ipcRenderer.on('sync-data-pushed', async (event, { db, sourceDeviceId }) => {
                    // 1. صمام أمان لمنع الدوران المزدوج: إذا كان التحديث صادر من الماستر نفسه لا نعيد الحفظ والرسم
                    if (sourceDeviceId === 'DEV-HOST') return;

                    if (db) {
                        if (db.lastUpdated) {
                            this.lastSyncedTimestamp = db.lastUpdated;
                        }

                        const isDelta = (db.isDelta === true || db.syncMode === 'delta');

                        // ⚡ مسار الدلتا الخفيف السريع جداً (أقل من 10ms - حماية تامة للرامات وللهاردسك من قراءة وكتابة السنين السابقة)
                        if (isDelta) {
                            let txChanged = false;
                            let prodChanged = false;
                            let accChanged = false;

                            if (Array.isArray(db.transactions) && db.transactions.length > 0) {
                                window.transactions = this.mergeTransactions(window.transactions || [], db.transactions, window.trash || []);
                                if (typeof transactions !== 'undefined') transactions = window.transactions;
                                if (window.bayanDB && window.bayanDB.transactions) {
                                    try { await window.bayanDB.transactions.bulkPut(db.transactions); } catch(e) {}
                                }
                                txChanged = true;
                            }

                            if (Array.isArray(db.products) && db.products.length > 0) {
                                window.productsDB = this.mergeProducts(window.productsDB || [], db.products, window.trash || []);
                                if (typeof productsDB !== 'undefined') productsDB = window.productsDB;
                                if (window.bayanDB && window.bayanDB.products) {
                                    try { await window.bayanDB.products.bulkPut(db.products); } catch(e) {}
                                }
                                prodChanged = true;
                            }

                            if (Array.isArray(db.accounts) && db.accounts.length > 0) {
                                window.accounts = this.mergeAccounts(window.accounts || [], db.accounts, window.trash || []);
                                if (typeof accounts !== 'undefined') accounts = window.accounts;
                                if (window.bayanDB && window.bayanDB.accounts) {
                                    try { await window.bayanDB.accounts.bulkPut(db.accounts); } catch(e) {}
                                }
                                accChanged = true;
                            }

                            // تحديث فوري وسريع للواجهة النشطة فقط (0 Lag)
                            window.accountBalancesCache = {};
                            if (typeof invalidateStockCache === 'function') invalidateStockCache();
                            if (typeof updateDatalists === 'function') updateDatalists();
                            if (prodChanged) {
                                if (typeof renderCart === 'function') renderCart();
                                if (typeof renderProductsGrid === 'function') renderProductsGrid();
                            }

                            const activeSecEl = document.querySelector('.section-view:not(.hidden)');
                            const currentSecId = activeSecEl ? activeSecEl.id : '';
                            if (prodChanged && currentSecId === 'inventory-section' && typeof renderInventoryTable === 'function') renderInventoryTable();
                            if (accChanged && currentSecId === 'accounts-section' && typeof renderAccountsTable === 'function') renderAccountsTable();
                            if (txChanged) {
                                if (typeof renderInvoicesWarehouseChips === 'function') renderInvoicesWarehouseChips();
                                if (typeof renderInvoicesTable === 'function') renderInvoicesTable();
                                if (typeof renderSalesHistoryTable === 'function') renderSalesHistoryTable();
                                if (typeof renderDailyReportTable === 'function') renderDailyReportTable();
                                if (typeof updateDashboardStats === 'function') updateDashboardStats();
                            }

                            if (typeof showToast === 'function') {
                                showToast('⚡ تم تحديث حركة جديدة من التابلت لحظياً', 'info');
                            }
                            return; // إنهاء فوري بدون لمس toArray() أو الجداول الأخرى
                        }

                        const purgedTrashIds = Array.isArray(db.purgedTrashIds) ? db.purgedTrashIds : [];
                        const mergedTrash = this.mergeTrash(window.trashBin || [], db.trash || [], purgedTrashIds);
                        window.trash = window.trashBin = mergedTrash;
                        if (typeof trashBin !== 'undefined') trashBin = mergedTrash;
                        const trashedKeys = this.getTrashedProductKeys(mergedTrash);
                        const trashedAccountKeys = this.getTrashedAccountKeys(mergedTrash);
                        const { keySet: trashedTxKeys, invIdSet: trashedInvIds } = this.getTrashedTransactionKeys(mergedTrash);

                        if (Array.isArray(db.products)) {
                            // دمج الأصناف وتحديث الأرصدة والتشكيلات القادمة من التابلت بدقة
                            window.productsDB = this.mergeProducts(window.productsDB || [], db.products, mergedTrash);
                            if (typeof productsDB !== 'undefined') productsDB = window.productsDB;
                        }
                        if (Array.isArray(db.accounts)) {
                            window.accounts = this.mergeAccounts(window.accounts || [], db.accounts, mergedTrash);
                            if (typeof accounts !== 'undefined') accounts = window.accounts;
                        }
                        if (Array.isArray(db.transactions)) {
                            window.transactions = this.mergeTransactions(window.transactions || [], db.transactions, mergedTrash);
                            if (typeof transactions !== 'undefined') transactions = window.transactions;
                        }
                        if (Array.isArray(db.users) && db.users.length > 0) {
                            window.users = this.mergeUsers(window.users || [], db.users, mergedTrash);
                            if (typeof users !== 'undefined') users = window.users;
                        }
                        if (Array.isArray(db.treasuryAudit)) {
                            window.treasuryAudit = window.treasuryAuditRecords = db.treasuryAudit;
                            if (typeof renderTreasuryAuditTable === 'function') renderTreasuryAuditTable();
                        }
                        if (Array.isArray(db.warehouses) && db.warehouses.length > 0) {
                            window.warehouses = this.mergeWarehouses(window.warehouses || [], db.warehouses, mergedTrash);
                            if (typeof warehouses !== 'undefined') warehouses = window.warehouses;
                            if (typeof setStore === 'function') setStore('pos_warehouses', JSON.stringify(window.warehouses));
                        }
                        if (db.settings && typeof db.settings === 'object') {
                            const cleanIncoming = {};
                            Object.keys(db.settings).forEach(k => {
                                if (!this.DEVICE_LOCAL_SETTINGS_KEYS.has(k)) {
                                    cleanIncoming[k] = db.settings[k];
                                    if (typeof setStore === 'function') setStore(k, db.settings[k]);
                                }
                            });
                            window.AppStore = { ...window.AppStore, ...cleanIncoming };
                        }

                        // حفظ فوري في قاعدة بيانات الماستر IndexedDB وتنظيف المحذوفات
                        if (window.bayanDB) {
                            try {
                                if (window.productsDB && window.productsDB.length > 0) await window.bayanDB.products.bulkPut(window.productsDB);
                                if (window.accounts && window.accounts.length > 0) await window.bayanDB.accounts.bulkPut(window.accounts);
                                if (window.transactions && window.transactions.length > 0) {
                                    const currentLocalTxs = await window.bayanDB.transactions.toArray();
                                    const activeTxIdSet = new Set((window.transactions || []).map(t => t.id));
                                    const obsoleteTxIds = currentLocalTxs.filter(t => 
                                        !activeTxIdSet.has(t.id) || 
                                        trashedTxKeys.has(String(t.id)) || 
                                        trashedTxKeys.has(`id_${t.id}`) ||
                                        (t.invoiceId != null && (trashedInvIds.has(String(t.invoiceId)) || trashedInvIds.has(Number(t.invoiceId))))
                                    ).map(t => t.id);
                                    if (obsoleteTxIds.length > 0) {
                                        await window.bayanDB.transactions.bulkDelete(obsoleteTxIds);
                                    }
                                    await window.bayanDB.transactions.bulkPut(window.transactions);
                                }
                                if (window.users && window.users.length > 0) {
                                    await window.bayanDB.users.clear();
                                    const secureUsers = window.users.map(u => ({
                                        ...u,
                                        pin: (window.BayanSecurity && typeof window.BayanSecurity.encryptPin === 'function')
                                            ? window.BayanSecurity.encryptPin(u.pin)
                                            : u.pin
                                    }));
                                    await window.bayanDB.users.bulkPut(secureUsers);
                                }
                                if (db.treasuryAudit && db.treasuryAudit.length > 0) await window.bayanDB.treasuryAudit.bulkPut(db.treasuryAudit);
                                if (window.bayanDB.trash) {
                                    await window.bayanDB.trash.clear();
                                    if (mergedTrash && mergedTrash.length > 0) await window.bayanDB.trash.bulkPut(mergedTrash);
                                }
                                if (window.bayanDB.warehouses) {
                                    await window.bayanDB.warehouses.clear();
                                    if (window.warehouses && window.warehouses.length > 0) await window.bayanDB.warehouses.bulkPut(window.warehouses);
                                }
                            } catch(dexErr) {}
                        }

                        // تحديث شاشة الدخول إذا لم يتم تسجيل الدخول بعد
                        if (!window.currentUser && typeof initLogin === 'function') {
                            initLogin();
                        }

                        // تحديث جدول سلة المحذوفات
                        if (typeof renderTrashTable === 'function') renderTrashTable();
                        if (window.trashManager && typeof window.trashManager.renderTrashTable === 'function') {
                            window.trashManager.renderTrashTable();
                        }

                        // تحديث ذكي للواجهة على الماستر (Active Section Only) لمنع أي استهلاك للموارد
                        window.accountBalancesCache = {}; // تفريغ كاش الأرصدة
                        if (typeof invalidateStockCache === 'function') invalidateStockCache();
                        if (typeof updateDatalists === 'function') updateDatalists();
                        if (typeof renderCart === 'function') renderCart();
                        if (typeof renderProductsGrid === 'function') renderProductsGrid();

                        const activeSecEl = document.querySelector('.section-view:not(.hidden)');
                        const currentSecId = activeSecEl ? activeSecEl.id : '';

                        if (currentSecId === 'inventory-section' && typeof renderInventoryTable === 'function') renderInventoryTable();
                        if (currentSecId === 'accounts-section' && typeof renderAccountsTable === 'function') renderAccountsTable();
                        if (currentSecId === 'users-section' && typeof renderUsersTable === 'function') renderUsersTable();
                        if (currentSecId === 'dashboard-section' && typeof updateDashboardStats === 'function') updateDashboardStats();
                        if (currentSecId === 'daily-report-section' && typeof renderDailyReportTable === 'function') renderDailyReportTable();
                        if (currentSecId === 'sales-history-section' && typeof renderSalesHistoryTable === 'function') renderSalesHistoryTable();
                        if (currentSecId === 'invoices-section' && typeof renderInvoicesWarehouseChips === 'function') renderInvoicesWarehouseChips();
                        if (currentSecId === 'invoices-section' && typeof renderInvoicesTable === 'function') renderInvoicesTable();
                        if (currentSecId === 'warehouses-section' && typeof renderWarehousesTable === 'function') renderWarehousesTable();
                        if (currentSecId === 'settings-section' && typeof updateSettingsWarehouseSelect === 'function') updateSettingsWarehouseSelect();
                        if (currentSecId === 'warehouses-section' && typeof updateWarehousesSummaryBoard === 'function') updateWarehousesSummaryBoard();

                        if (typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
                        if (typeof applyBusinessTypeUI === 'function') applyBusinessTypeUI();
                        if (typeof updateAllCurrencyLabels === 'function') updateAllCurrencyLabels();
                        if (typeof renderTrashTable === 'function') renderTrashTable();
                        if (typeof loadSettings === 'function') loadSettings();
                        if (typeof window.checkIncomingTransfersAlert === 'function') window.checkIncomingTransfersAlert();
                        if (typeof updateNotifications === 'function') updateNotifications();
                        if (typeof loadCalcHistory === 'function') loadCalcHistory();
                        if (typeof renderCalcHistory === 'function') renderCalcHistory();
                        if (typeof updateLogoDisplays === 'function') {
                            updateLogoDisplays((db.settings && db.settings.bayan_business_logo) ? db.settings.bayan_business_logo : null);
                        }
                        if (typeof showToast === 'function') {
                            showToast('🔄 تم استلام وتحديث بيانات جديدة من الجهاز المتصل', 'info');
                        }
                    }
                });
                
                // استقبال طلب إقران جهاز تابلت جديد
                ipcRenderer.on('device-pairing-request', (event, reqData) => {
                    console.log('🔔 [NetworkHub] New device pairing request:', reqData);
                    // إظهار تنبيه الرمز دائماً للماستر لتمكينه من قراءة الرمز وإعطائه للمستخدم
                    this.showMasterPairingAlert(reqData);
                });

                // إشعار إتمام الإقران بنجاح
                ipcRenderer.on('device-paired-success', (event, deviceData) => {
                    this._hasPairedDevices = true;
                    this.pushLocalDbToServer(true);
                    if (typeof showToast === 'function') {
                        showToast(`✅ تم إقران واعتماد جهاز (${deviceData.deviceName}) بنجاح!`, 'success');
                    }
                });

                // إشعار تحويل مخزني جديد
                ipcRenderer.on('new-pending-transfer', (event, transferData) => {
                    if (typeof showToast === 'function') {
                        showToast(`🚚 إذن تحويل جديد #${transferData.id || ''} وارد لساحة الانتظار!`, 'info');
                    }
                    if (typeof window.refreshPendingTransfersUI === 'function') {
                        window.refreshPendingTransfersUI();
                    }
                });

                // إشعار تأكيد استلام تحويل من الفرع
                ipcRenderer.on('transfer-accepted', (event, transferData) => {
                    if (typeof showToast === 'function') {
                        showToast(`✅ قام (${transferData.receivedBy || 'الفرع'}) باستلام إذن التحويل #${transferData.id || ''}!`, 'success');
                    }
                    if (typeof window.refreshPendingTransfersUI === 'function') {
                        window.refreshPendingTransfersUI();
                    }
                });

                // إشعار رفض تحويل من الفرع
                ipcRenderer.on('transfer-rejected', (event, transferData) => {
                    if (typeof showToast === 'function') {
                        showToast(`❌ قام (${transferData.rejectedBy || 'الفرع'}) برفض إذن التحويل #${transferData.id || ''}!`, 'error');
                    }
                    if (typeof window.refreshPendingTransfersUI === 'function') {
                        window.refreshPendingTransfersUI();
                    }
                });
            } catch (e) {
                console.warn('[NetworkHub] ipcRenderer not available:', e.message);
            }
        },

        showMasterPairingAlert: function(reqData) {
            if (reqData && reqData.id) {
                this.shownPairingRequestIds.add(reqData.id);
            }
            const modalId = 'masterPairingAlertModal';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.className = 'confirm-modal-overlay';
                modal.style.zIndex = '999999999';
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div style="background:#ffffff; padding:30px; border-radius:20px; width:450px; max-width:92%; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.3); border:2px solid #10b981; direction:rtl; font-family:inherit;">
                    <div style="font-size:3rem; margin-bottom:10px;">📱✨</div>
                    <h3 style="margin:0 0 10px 0; color:#0f172a; font-size:1.3rem; font-weight:900;">طلب إقران جهاز تابلت جديد</h3>
                    <p style="color:#64748b; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">
                        يرغب الجهاز التالي في الاتصال ومشاركة بيانات المنظومة:
                    </p>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:15px; border-radius:12px; margin-bottom:20px; text-align:right;">
                        <div style="font-weight:bold; color:#1e293b; margin-bottom:5px;">📌 اسم الجهاز: <span style="color:#047857;">${reqData.deviceName || 'تابلت فرعي'}</span></div>
                        <div style="font-weight:bold; color:#1e293b; margin-bottom:5px;">🌐 عنوان الـ IP: <span style="color:#2563eb; font-family:monospace;">${reqData.ip || 'Local IP'}</span></div>
                        <div style="font-weight:bold; color:#1e293b;">🆔 معرّف الجهاز: <span style="font-family:monospace; color:#64748b; font-size:0.85rem;">${reqData.deviceId || ''}</span></div>
                    </div>

                    <div style="background:#ecfdf5; border:2px dashed #059669; padding:15px; border-radius:12px; margin-bottom:25px;">
                        <div style="color:#065f46; font-size:0.9rem; font-weight:bold; margin-bottom:5px;">🔑 رمز الإقران السريع (PIN Code):</div>
                        <div style="font-size:2.4rem; font-weight:900; letter-spacing:8px; color:#047857; font-family:monospace;">${reqData.pin || '----'}</div>
                        <div style="color:#047857; font-size:0.78rem; margin-top:5px;">أدخل هذا الرمز المعروض في شاشة التابلت لإتمام الربط بأمان (صالح لمدة 5 دقائق)</div>
                    </div>

                    <div style="display:flex; gap:10px;">
                        <button onclick="window.BayanNetworkHub.dismissPairingAlert('${reqData.id || ''}', '${reqData.deviceId || ''}', false)" style="flex:2; background:#047857; color:#ffffff; border:none; padding:12px 15px; border-radius:10px; font-weight:bold; font-size:0.95rem; cursor:pointer; transition:0.2s;">
                            تم إعطاء الرمز (إغلاق النافذة) ✓
                        </button>
                        <button onclick="window.BayanNetworkHub.dismissPairingAlert('${reqData.id || ''}', '${reqData.deviceId || ''}', true)" style="flex:1; background:#ef4444; color:#ffffff; border:none; padding:12px 15px; border-radius:10px; font-weight:bold; font-size:0.95rem; cursor:pointer; transition:0.2s;">
                            🚫 رفض الطلب
                        </button>
                    </div>
                </div>
            `;
        },

        dismissPairingAlert: function(id, deviceId, isReject = false) {
            const modal = document.getElementById('masterPairingAlertModal');
            if (modal) modal.remove();
            if (id) this.shownPairingRequestIds.add(id);

            // إشعار السيرفر (في حالة الرفض الصريح يتم إرسال action: 'reject' لإلغائه، وإلا يظل نشطاً لإدخاله في التابلت)
            fetch(`${this.serverUrl}/api/pair-requests/dismiss`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, deviceId, action: isReject ? 'reject' : 'hide' })
            }).catch(() => {});
        },

        checkClientPairing: async function() {
            if (this.isMasterServer || this.isPaired) return;

            try {
                const res = await this.fetchWithTimeout(`${this.serverUrl}/api/pair-request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: this.deviceId,
                        deviceToken: this.deviceToken,
                        deviceName: navigator.userAgent.includes('Mobile') ? 'تابلت / هاتف محمول' : 'جهاز فرعي'
                    })
                }, 1500);

                const data = await res.json();
                if (data.success && data.isPaired) {
                    this.isPaired = true;
                    this.deviceToken = data.token;
                    if (data.terminalLetter) this.terminalLetter = data.terminalLetter;
                    if (data.deviceName) this.deviceName = data.deviceName;
                    if (data.pairingOrder) this.pairingOrder = data.pairingOrder;
                    if (data.masterHwid) {
                        if (typeof setStore === 'function') setStore('bayan_master_hwid', data.masterHwid);
                        if (typeof window.updateUnifiedHwidDisplay === 'function') {
                            window.updateUnifiedHwidDisplay(data.masterHwid);
                        }
                    }
                    if (typeof setStore === 'function') {
                        setStore('bayan_client_device_token', data.token);
                        setStore('bayan_client_is_paired', 'true');
                        if (data.terminalLetter) setStore('bayan_terminal_letter', data.terminalLetter);
                        if (data.deviceName) setStore('bayan_device_name', data.deviceName);
                        if (data.pairingOrder) setStore('bayan_pairing_order', String(data.pairingOrder));
                    }
                    this.updateHeaderButtonUI();
                } else if (data.requiresPin) {
                    this.showClientPinInputModal();
                }
            } catch (err) {
                // طبيعي جداً في حالة العمل كجهاز مستقل أوفلاين دون تشغيل سيرفر فرعي
            }
        },

        showClientPinInputModal: function() {
            if (this.isPaired) return;
            const modalId = 'clientPinInputModal';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.className = 'confirm-modal-overlay';
                modal.style.zIndex = '999999999';
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div style="background:#ffffff; padding:35px 25px; border-radius:20px; width:420px; max-width:92%; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.35); border:2px solid #3b82f6; direction:rtl; font-family:inherit;">
                    <div style="font-size:3rem; margin-bottom:10px;">🔐</div>
                    <h3 style="margin:0 0 10px 0; color:#0f172a; font-size:1.35rem; font-weight:900;">إقران التابلت بالجهاز الرئيسي</h3>
                    <p style="color:#64748b; font-size:0.95rem; margin-bottom:15px; line-height:1.5;">
                        يرجى إدخال رمز الإقران (PIN) المكون من 4 أرقام المعروض على شاشة الكمبيوتر الرئيسي (يطلب لأول مرة فقط):
                    </p>

                    <input type="text" id="clientPinField" maxlength="4" placeholder="0 0 0 0" 
                        style="width:80%; height:55px; font-size:2.2rem; font-weight:900; text-align:center; letter-spacing:10px; border:2px solid #3b82f6; border-radius:12px; margin-bottom:10px; outline:none; background:#f8fafc; font-family:monospace;"
                        oninput="this.value = this.value.replace(/[^0-9]/g, ''); if(this.value.length===4) window.BayanNetworkHub.submitPinCode(this.value);"
                        onkeydown="if(event.key==='Enter') window.BayanNetworkHub.submitPinCode(this.value);">

                    <div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:10px; margin-bottom:15px; font-size:0.8rem; color:#0369a1; font-weight:700;">
                        💡 أدخل الرمز السري المكون من 4 أرقام الظاهر على شاشة السيرفر الرئيسي
                    </div>

                    <div id="pinErrorMsg" style="color:#ef4444; font-size:0.85rem; font-weight:bold; margin-bottom:15px; display:none;"></div>

                    <div style="display:flex; gap:10px; margin-top:5px;">
                        <button id="clientPinSubmitBtn" onclick="window.BayanNetworkHub.submitPinCode(document.getElementById('clientPinField').value)" style="flex:2; background:#2563eb; color:#ffffff; border:none; padding:12px 20px; border-radius:10px; font-weight:bold; font-size:1rem; cursor:pointer; transition:0.2s;">
                            تأكيد والاتصال بالمنظومة 🚀
                        </button>
                        <button onclick="document.getElementById('clientPinInputModal')?.remove()" style="flex:1; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:12px 15px; border-radius:10px; font-weight:bold; font-size:0.95rem; cursor:pointer; transition:0.2s;">
                            إلغاء
                        </button>
                    </div>
                </div>
            `;
            setTimeout(() => {
                const inp = document.getElementById('clientPinField');
                if (inp) inp.focus();
            }, 300);
        },

        _isSubmittingPin: false,

        submitPinCode: async function(pin) {
            if (this._isSubmittingPin) return;
            const cleanPin = String(pin || '').trim();
            if (!cleanPin || cleanPin.length < 4) {
                const err = document.getElementById('pinErrorMsg');
                if (err) { err.innerText = '⚠️ يرجى إدخال 4 أرقام صحيحة'; err.style.display = 'block'; }
                return;
            }

            const submitBtn = document.getElementById('clientPinSubmitBtn');
            const pinField = document.getElementById('clientPinField');
            const errDiv = document.getElementById('pinErrorMsg');
            if (errDiv) errDiv.style.display = 'none';

            this._isSubmittingPin = true;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'جاري التحقق والربط... ⏳';
                submitBtn.style.opacity = '0.7';
                submitBtn.style.cursor = 'not-allowed';
            }
            if (pinField) pinField.disabled = true;

            try {
                const res = await this.fetchWithTimeout(`${this.serverUrl}/api/pair-verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: this.deviceId,
                        pin: cleanPin,
                        deviceName: navigator.userAgent.includes('Mobile') ? 'تابلت الكاشير' : 'جهاز فرعي'
                    })
                }, 2000);

                const data = await res.json();
                if (data.success) {
                    this.isPaired = true;
                    this.deviceToken = data.token;
                    if (data.terminalLetter) this.terminalLetter = data.terminalLetter;
                    if (data.deviceName) this.deviceName = data.deviceName;
                    if (data.pairingOrder) this.pairingOrder = data.pairingOrder;
                    if (data.masterHwid) {
                        if (typeof setStore === 'function') setStore('bayan_master_hwid', data.masterHwid);
                        if (typeof window.updateUnifiedHwidDisplay === 'function') {
                            window.updateUnifiedHwidDisplay(data.masterHwid);
                        }
                    }
                    if (typeof setStore === 'function') {
                        setStore('bayan_client_device_token', data.token);
                        setStore('bayan_client_is_paired', 'true');
                        if (data.terminalLetter) setStore('bayan_terminal_letter', data.terminalLetter);
                        if (data.deviceName) setStore('bayan_device_name', data.deviceName);
                        if (data.pairingOrder) setStore('bayan_pairing_order', String(data.pairingOrder));
                    }
                    this.updateHeaderButtonUI();
                    
                    const modal = document.getElementById('clientPinInputModal');
                    if (modal) modal.remove();

                    if (typeof showToast === 'function') {
                        showToast('🎉 تم إقران واعتماد التابلت بنجاح دائم!', 'success');
                    }

                    // سحب البيانات فوراً وتحديث شاشات البرنامج وبدء البث اللحظي
                    await this.pullMasterDb();
                    this.connectLiveStream();
                } else {
                    if (errDiv) { errDiv.innerText = '❌ ' + (data.message || 'رمز الإقران غير صحيح'); errDiv.style.display = 'block'; }
                    if (pinField) {
                        pinField.disabled = false;
                        pinField.value = '';
                        pinField.focus();
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = 'تأكيد والاتصال بالمنظومة 🚀';
                        submitBtn.style.opacity = '1';
                        submitBtn.style.cursor = 'pointer';
                    }
                }
            } catch (err) {
                if (errDiv) { errDiv.innerText = '⚠️ تعذر الاتصال بالسيرفر الرئيسي، يرجى التأكد من تشغيل السيرفر والاتصال بالشبكة'; errDiv.style.display = 'block'; }
                if (pinField) {
                    pinField.disabled = false;
                    pinField.focus();
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'تأكيد والاتصال بالمنظومة 🚀';
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                }
            } finally {
                this._isSubmittingPin = false;
            }
        },

        startPendingTransfersPolling: function() {
            // جلب أذونات التحويل المعلقة بهدوء دون استهلاك موارد
            setInterval(async () => {
                if (this.isMasterServer && !this._hasPairedDevices) return;
                await this.fetchPendingTransfers();
            }, 30000);
            if (!this.isMasterServer || this._hasPairedDevices) {
                this.fetchPendingTransfers();
            }
        },

        fetchPendingTransfers: async function() {
            try {
                let activeWH = ((typeof currentUser !== 'undefined' && currentUser && currentUser.warehouseName) ? currentUser.warehouseName : 'المخزن الرئيسي').trim();
                
                let transfers = [];
                if (this.isMasterServer && typeof require !== 'undefined') {
                    const { ipcRenderer } = require('electron');
                    transfers = await ipcRenderer.invoke('get-in-transit-transfers') || [];
                } else {
                    const res = await this.fetchWithTimeout(`${this.serverUrl}/api/transfers/pending?warehouse=${encodeURIComponent(activeWH)}`);
                    const data = await res.json();
                    transfers = data.transfers || [];
                }

                const prevCacheStr = window._lastTransfersCacheStr || '';
                const newTransfersStr = JSON.stringify(transfers);
                if (prevCacheStr !== newTransfersStr) {
                    window._lastTransfersCacheStr = newTransfersStr;
                    window.inTransitTransfersCache = transfers;
                    if (typeof window.refreshPendingTransfersUI === 'function') {
                        window.refreshPendingTransfersUI();
                    }
                    if (typeof window.checkIncomingTransfersAlert === 'function') {
                        window.checkIncomingTransfersAlert();
                    }
                }
            } catch (e) {
                // Ignore polling errors
            }
        },

        // فحص حالة جدار الحماية الحالية للمنفذ 4545
        checkFirewallStatus: async function() {
            try {
                if (this.isMasterServer && typeof require !== 'undefined') {
                    const { ipcRenderer } = require('electron');
                    const res = await ipcRenderer.invoke('check-firewall-status');
                    return !!(res && res.isOpen);
                } else {
                    const res = await this.fetchWithTimeout(`${this.serverUrl}/api/check-firewall`, {}, 1500);
                    const data = await res.json();
                    return !!(data && data.isOpen);
                }
            } catch(e) {
                return false;
            }
        },

        // فتح نافذة معلومات السيرفر والـ QR Code وإعدادات ربط الأجهزة
        openServerHubModal: async function() {
            const fallbackHost = (window.location && window.location.hostname && window.location.hostname !== '0.0.0.0') ? window.location.hostname : 'localhost';
            let serverInfo = { ip: fallbackHost, port: 4545, isRunning: true, pairedCount: 0 };
            let pairedList = [];
            let isFwOpen = false;
            const currentRole = this.getTerminalRole();
            const isMaster = (currentRole === 'master');

            // نافذة موحدة للمركز الشبكي تتيح التبديل بين دور الماستر والعميل وضبط الاتصال
            if (isMaster && typeof require !== 'undefined') {
                try {
                    const { ipcRenderer } = require('electron');
                    const info = await ipcRenderer.invoke('get-local-server-info');
                    if (info && info.ip) serverInfo = info;
                    pairedList = await ipcRenderer.invoke('get-paired-devices') || [];
                    const fwRes = await ipcRenderer.invoke('check-firewall-status');
                    isFwOpen = !!(fwRes && fwRes.isOpen);
                } catch(e) {}
            } else if (isMaster) {
                try {
                    const res = await this.fetchWithTimeout(`${this.serverUrl}/api/server-info`, {}, 1500);
                    const info = await res.json();
                    if (info && info.ip) serverInfo = info;
                    const fwRes = await this.fetchWithTimeout(`${this.serverUrl}/api/check-firewall`, {}, 1500).then(r => r.json()).catch(() => ({ isOpen: false }));
                    isFwOpen = !!(fwRes && fwRes.isOpen);
                } catch(e) {}
            }

            const connectUrl = `http://${serverInfo.ip}:${serverInfo.port}`;

            const modalId = 'serverHubModal';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(15, 23, 42, 0.8) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 9999999999 !important;';
                document.body.appendChild(modal);
            } else {
                modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(15, 23, 42, 0.8) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 9999999999 !important;';
            }

            modal.innerHTML = `
                <div style="background:#ffffff; padding:26px; border-radius:24px; width:560px; max-width:94%; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.3); border:2px solid ${isMaster ? '#047857' : '#2563eb'}; direction:rtl; font-family:inherit; max-height:90vh; overflow-y:auto;" class="fast-scrollbar">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="margin:0; color:${isMaster ? '#064e3b' : '#1e3a8a'}; font-size:1.3rem; font-weight:900; display:flex; align-items:center; gap:8px;">
                            🌐 مركز الربط والمزامنة الشبكية للأجهزة
                        </h3>
                        <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:#94a3b8; font-weight:bold;">✕</button>
                    </div>

                    <!-- شريط اختيار دور الجهاز (Master / Client Switcher) -->
                    <div style="display:flex; background:#f1f5f9; padding:4px; border-radius:14px; margin-bottom:16px; gap:6px; border:1px solid #e2e8f0;">
                        <button type="button" onclick="window.BayanNetworkHub.setTerminalRole('master')" 
                            style="flex:1; padding:10px 12px; border-radius:10px; border:none; font-weight:900; font-size:0.9rem; cursor:pointer; transition:all 0.2s; ${isMaster ? 'background:#047857; color:#ffffff; box-shadow:0 3px 8px rgba(4,120,87,0.25);' : 'background:transparent; color:#64748b;'}">
                            🖥️ جهاز رئيسي (ماستر Server)
                        </button>
                        <button type="button" onclick="window.BayanNetworkHub.setTerminalRole('client')" 
                            style="flex:1; padding:10px 12px; border-radius:10px; border:none; font-weight:900; font-size:0.9rem; cursor:pointer; transition:all 0.2s; ${!isMaster ? 'background:#2563eb; color:#ffffff; box-shadow:0 3px 8px rgba(37,99,235,0.25);' : 'background:transparent; color:#64748b;'}">
                            💻 كاشير فرعي (Client Terminal)
                        </button>
                    </div>

                    ${isMaster ? `
                        <!-- محتوى الجهاز الرئيسي (Master) -->
                        <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; padding:16px; border-radius:16px; margin-bottom:15px; text-align:center;">
                            <div style="color:#065f46; font-size:0.88rem; font-weight:bold; margin-bottom:8px;">🔗 رابط اتصال التابلت والأجهزة الفرعية:</div>
                            <div style="display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
                                <div id="serverConnectUrlText" style="font-size:1.2rem; font-weight:900; color:#047857; font-family:monospace; background:#ffffff; padding:8px 16px; border-radius:10px; border:1.5px solid #6ee7b7; display:inline-block; user-select:all;">
                                    ${connectUrl}
                                </div>
                                <button type="button" onclick="navigator.clipboard.writeText('${connectUrl}').then(() => { if(typeof showToast==='function') showToast('📋 تم نسخ رابط السيرفر بنجاح!', 'success'); else alert('تم النسخ بنجاح 📋'); })"
                                    style="background:#047857; color:#ffffff; border:none; border-radius:10px; padding:10px 16px; font-size:0.88rem; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 8px rgba(4,120,87,0.3); transition:0.2s;"
                                    title="نسخ رابط السيرفر">
                                    📋 نسخ الرابط
                                </button>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 12px; flex-wrap: wrap;">
                                <div id="serverHubQrCode" style="background: #ffffff; padding: 10px; border-radius: 12px; border: 1.5px solid #cbd5e1; box-shadow: 0 4px 10px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; min-width: 110px; min-height: 110px;"></div>
                                <div style="text-align: right; max-width: 260px;">
                                    <div style="font-weight: 900; color: #065f46; font-size: 0.92rem; margin-bottom: 4px;">📷 مسح الكاميرا السريع (QR Code):</div>
                                    <div style="color: #475569; font-size: 0.8rem; font-weight: 700; line-height: 1.5;">
                                        امسح الرمز بكاميرا الموبايل/التابلت للفتح فوراً، أو انسخ الرابط واكتبه في خانة الكاشير الفرعي بالكمبيوتر الآخر.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 📱 بطاقة بيان فاشون موبايل والداش بورد -->
                        <div style="background:linear-gradient(135deg, #1e1b4b, #0f172a); border:1.5px solid #8b5cf6; padding:16px; border-radius:16px; margin-bottom:15px; color:#ffffff; box-shadow:0 4px 15px rgba(139,92,246,0.15);">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, #8b5cf6, #6366f1); display:flex; align-items:center; justify-content:center; font-size:1.4rem;">📱</div>
                                    <div style="text-align:right;">
                                        <div style="font-weight:900; font-size:1rem; color:#ffffff;">بيان فاشون موبايل (الداش بورد والدرج)</div>
                                        <div style="font-size:0.75rem; color:#cbd5e1; font-weight:700;">مراقبة الخزينة والكاش واليومية واستعلام الأصناف والبيع من الهاتف</div>
                                    </div>
                                </div>
                                <a href="${connectUrl}/mobile" target="_blank"
                                    style="background:linear-gradient(135deg, #8b5cf6, #7c3aed); color:#ffffff; text-decoration:none; padding:8px 16px; border-radius:10px; font-weight:900; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(139,92,246,0.35);">
                                    <span>🌐</span> فتح داش بورد الموبايل
                                </a>
                            </div>
                            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.06); padding:8px 14px; border-radius:10px; font-family:monospace; font-size:0.95rem; font-weight:800; color:#c4b5fd; word-break:break-all;">
                                <span>${connectUrl}/mobile</span>
                                <button type="button" onclick="navigator.clipboard.writeText('${connectUrl}/mobile').then(() => { if(typeof showToast==='function') showToast('📋 تم نسخ رابط الموبايل بنجاح!', 'success'); })"
                                    style="background:rgba(255,255,255,0.12); color:#ffffff; border:none; border-radius:6px; padding:4px 10px; font-size:0.75rem; font-weight:800; cursor:pointer;">
                                    نسخ
                                </button>
                            </div>
                        </div>

                        <!-- شارة حالة جدار الحماية (Windows Firewall Live Status) -->
                        <div id="firewallStatusBanner" style="margin-bottom: 15px; text-align: center;">
                            ${isFwOpen ? `
                                <div style="display:inline-flex; align-items:center; gap:8px; background:#ecfdf5; border:1.5px solid #10b981; color:#065f46; padding:8px 16px; border-radius:12px; font-size:0.84rem; font-weight:900; box-shadow: 0 2px 6px rgba(16,185,129,0.15);">
                                    <span>🛡️</span>
                                    <span>جدار حماية ويندوز: المنفذ 4545 مصرح ومفتوح بنجاح ✓ (الأجهزة يمكنها الاتصال)</span>
                                </div>
                            ` : `
                                <div style="background:#fffbeb; border:1.5px solid #f59e0b; padding:12px 16px; border-radius:14px; display:inline-flex; flex-direction:column; align-items:center; gap:8px; width:100%; box-sizing:border-box;">
                                    <div style="color:#b45309; font-weight:900; font-size:0.85rem;">⚠️ تنبيه: المنفذ 4545 قد يحتاج إذناً في جدار الحماية للسماح باتصال الأجهزة</div>
                                    <button type="button" onclick="window.BayanNetworkHub.fixFirewall()" style="background:linear-gradient(135deg, #f59e0b, #d97706); color:white; border:none; border-radius:10px; padding:8px 18px; font-size:0.84rem; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 8px rgba(245,158,11,0.25); transition:0.2s;">
                                        🛡️ السماح في جدار الحماية بنقرة واحدة (تشغيل كمسؤول)
                                    </button>
                                </div>
                            `}
                        </div>

                        <div style="text-align:right; margin-bottom:18px;">
                            <div style="font-weight:900; color:#1e293b; font-size:0.95rem; margin-bottom:8px; display:flex; justify-content:space-between;">
                                <span>📱 الأجهزة المعتمدة والمقترنة (${pairedList.length}):</span>
                            </div>
                            <div style="max-height:160px; overflow-y:auto; border:1px solid #f1f5f9; border-radius:12px; padding:5px;" class="fast-scrollbar">
                                ${pairedList.length === 0 ? '<div style="padding:15px; text-align:center; color:#94a3b8; font-size:0.88rem;">لا توجد أجهزة مقترنة حالياً</div>' : pairedList.map(d => {
                                    const letter = d.terminalLetter || 'A';
                                    const orderText = d.pairingOrder === 1 ? 'أول جهاز فرعي تم إقرانه ومزامنته' : (d.pairingOrder === 2 ? 'ثاني جهاز فرعي تم إقرانه ومزامنته' : (d.pairingOrder === 3 ? 'ثالث جهاز فرعي تم إقرانه ومزامنته' : `الجهاز الفرعي رقم ${d.pairingOrder || ''}`));
                                    const safeName = (d.deviceName || `كاشير فرعي (${letter}) 📱`).replace(/'/g, "\\'");
                                    return `
                                    <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; border-bottom:1px solid #f8fafc; background:#f8fafc; border-radius:10px; margin-bottom:6px; border:1px solid #e2e8f0;">
                                        <div style="text-align:right;">
                                            <div style="display:flex; align-items:center; gap:8px;">
                                                <span style="background:linear-gradient(135deg, #7c3aed, #6d28d9); color:white; font-weight:900; padding:2px 8px; border-radius:6px; font-size:0.82rem; font-family:monospace; box-shadow:0 2px 5px rgba(124,58,237,0.25);">${letter}</span>
                                                <span style="font-weight:900; color:#0f172a; font-size:0.88rem;">${d.deviceName || `كاشير فرعي (${letter}) 📱`}</span>
                                                <span style="font-size:0.72rem; color:#475569; background:#e2e8f0; padding:2px 6px; border-radius:4px; font-weight:700;">${orderText}</span>
                                            </div>
                                            <div style="color:#64748b; font-size:0.75rem; font-family:monospace; margin-top:3px;">IP: ${d.ip} | معرّف: ${d.deviceId}</div>
                                        </div>
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <button onclick="window.BayanNetworkHub.renamePairedDevice('${d.deviceId}', '${safeName}')" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:5px 9px; border-radius:6px; font-size:0.78rem; font-weight:bold; cursor:pointer;" title="تسمية وتخصيص اسم القسم">تسمية ✏️</button>
                                            <button onclick="window.BayanNetworkHub.removeDevice('${d.deviceId}')" style="background:#fee2e2; color:#dc2626; border:none; padding:5px 9px; border-radius:6px; font-size:0.78rem; font-weight:bold; cursor:pointer;">إلغاء ✕</button>
                                        </div>
                                    </div>
                                `; }).join('')}
                            </div>
                        </div>
                    ` : `
                        <!-- محتوى الكاشير الفرعي (Client) -->
                        <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:16px; padding:18px; margin-bottom:15px; text-align:right;">
                            <div style="font-size:0.88rem; font-weight:900; color:#1e293b; margin-bottom:6px;">
                                🔗 عنوان ورابط الجهاز الرئيسي (Master Server IP):
                            </div>
                            <div style="font-size:0.8rem; color:#64748b; margin-bottom:10px; line-height:1.4;">
                                أدخل الرابط المعروض على شاشة الكمبيوتر الرئيسي (مثال: http://192.168.1.15:4545):
                            </div>
                            <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                                <input id="targetMasterServerUrlInput" type="text" value="${this.serverUrl || 'http://192.168.1.15:4545'}" 
                                    placeholder="مثال: http://192.168.1.15:4545" dir="ltr"
                                    style="flex:1; padding:10px 14px; border:2px solid #3b82f6; border-radius:10px; font-family:monospace; font-size:1rem; font-weight:bold; outline:none; text-align:center; background:#ffffff; color:#1e3a8a;">
                                <button type="button" onclick="window.BayanNetworkHub.saveTargetServerUrl(document.getElementById('targetMasterServerUrlInput').value)"
                                    style="background:#2563eb; color:#ffffff; border:none; border-radius:10px; padding:10px 18px; font-size:0.9rem; font-weight:900; cursor:pointer; white-space:nowrap; box-shadow:0 3px 8px rgba(37,99,235,0.3); transition:0.2s;">
                                    💾 حفظ واتصال
                                </button>
                            </div>
                        </div>

                        <!-- حالة الإقران والاتصال المباشرة للكاشير الفرعي -->
                        <div style="margin-bottom:15px;">
                            ${this.isPaired ? `
                                <div style="background:#ecfdf5; border:1.5px solid #10b981; border-radius:14px; padding:14px; text-align:center;">
                                    <div style="color:#065f46; font-weight:900; font-size:0.95rem; margin-bottom:4px; display:flex; align-items:center; justify-content:center; gap:6px;">
                                        <span>✅</span>
                                        <span>الكاشير الفرعي متصل ومقترن بالسيرفر الرئيسي بنجاح!</span>
                                    </div>
                                    <div style="color:#047857; font-size:0.8rem; font-family:monospace; margin-bottom:10px;">
                                        المعرّف: ${this.deviceId} | رابط السيرفر: ${this.serverUrl}
                                    </div>
                                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                                        <button type="button" onclick="window.BayanNetworkHub.pullMasterDb().then(() => { if(typeof showToast==='function') showToast('✅ تم سحب وتحديث كافة البيانات من السيرفر بنجاح!', 'success'); })"
                                            style="background:#047857; color:#ffffff; border:none; border-radius:10px; padding:9px 18px; font-size:0.86rem; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(4,120,87,0.2);">
                                            🔄 سحب وتحديث البيانات الآن
                                        </button>
                                        <button type="button" onclick="window.BayanNetworkHub.checkClientPairing()"
                                            style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:10px; padding:9px 14px; font-size:0.84rem; font-weight:bold; cursor:pointer;">
                                            🔑 فحص رمز الإقران
                                        </button>
                                    </div>
                                </div>
                            ` : `
                                <div style="background:#fffbeb; border:1.5px solid #f59e0b; border-radius:14px; padding:14px; text-align:center;">
                                    <div style="color:#b45309; font-weight:900; font-size:0.92rem; margin-bottom:6px; display:flex; align-items:center; justify-content:center; gap:6px;">
                                        <span>⏳</span>
                                        <span>الكاشير الفرعي غير مقترن بالسيرفر حتى الآن</span>
                                    </div>
                                    <div style="color:#78350f; font-size:0.82rem; font-weight:600; line-height:1.5; margin-bottom:10px;">
                                        اضغط على زر طلب رمز الإقران ثم اكتب الـ 4 أرقام (PIN) المعروضة على شاشة السيرفر الرئيسي:
                                    </div>
                                    <button type="button" onclick="window.BayanNetworkHub.checkClientPairing()"
                                        style="background:linear-gradient(135deg, #f59e0b, #d97706); color:#ffffff; border:none; border-radius:10px; padding:10px 20px; font-size:0.9rem; font-weight:900; cursor:pointer; box-shadow:0 3px 8px rgba(245,158,11,0.3);">
                                        🔑 طلب وإدخال رمز الإقران (PIN) 🚀
                                    </button>
                                </div>
                            `}
                        </div>

                        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:10px 14px; font-size:0.8rem; color:#1e40af; font-weight:700; text-align:right; line-height:1.5; margin-bottom:16px;">
                            ⚡ أداء فائق وسرعة كاملة (0ms): يتم حفظ حركات البيع والفواتير محلياً فورياً ومزامنتها تلقائياً مع السيرفر الرئيسي عبر الشبكة.
                        </div>
                    `}

                    <button onclick="document.getElementById('${modalId}').remove()" style="background:${isMaster ? '#047857' : '#2563eb'}; color:#ffffff; border:none; padding:11px 30px; border-radius:10px; font-weight:bold; font-size:0.95rem; cursor:pointer; width:100%; transition:0.2s;">
                        إغلاق النافذة
                    </button>
                </div>
            `;

            setTimeout(() => {
                const qrBox = document.getElementById('serverHubQrCode');
                if (qrBox && typeof QRCode !== 'undefined') {
                    qrBox.innerHTML = '';
                    new QRCode(qrBox, {
                        text: connectUrl,
                        width: 110,
                        height: 110,
                        colorDark: '#064e3b',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.M
                    });
                }
            }, 60);
        },

        removeDevice: async function(deviceId) {
            if (this.isMasterServer && typeof require !== 'undefined') {
                const { ipcRenderer } = require('electron');
                const remaining = await ipcRenderer.invoke('remove-paired-device', deviceId);
                this._hasPairedDevices = Array.isArray(remaining) && remaining.length > 0;
                this.openServerHubModal();
                if (typeof showToast === 'function') showToast('تم إلغاء إقران الجهاز بنجاح', 'info');
            }
        },

        fixFirewall: async function() {
            try {
                if (typeof showToast === 'function') showToast('جاري إرسال أمر السماح لجدار حماية ويندوز كمسؤول...', 'info');

                if (this.isMasterServer && typeof require !== 'undefined') {
                    const { ipcRenderer } = require('electron');
                    await ipcRenderer.invoke('fix-firewall-rule');
                } else {
                    const res = await this.fetchWithTimeout(`${this.serverUrl}/api/fix-firewall`, { method: 'POST' }, 2000);
                    await res.json();
                }

                if (typeof showToast === 'function') {
                    showToast('⏳ وافق على رسالة ويندوز (نعم / Yes) إذا ظهرت لك على الشاشة للترقية كمسؤول', 'warning');
                }

                // فحص النتيجة بعد ثانيتين وتحديث اللوحة الحية فوراً
                setTimeout(async () => {
                    const isOpenNow = await this.checkFirewallStatus();
                    const banner = document.getElementById('firewallStatusBanner');
                    if (isOpenNow) {
                        if (typeof showToast === 'function') showToast('✅ تم فتح وتصريح المنفذ 4545 في جدار الحماية بنجاح!', 'success');
                        if (banner) {
                            banner.innerHTML = `
                                <div style="display:inline-flex; align-items:center; gap:8px; background:#ecfdf5; border:1.5px solid #10b981; color:#065f46; padding:8px 18px; border-radius:12px; font-size:0.86rem; font-weight:900; box-shadow: 0 2px 6px rgba(16,185,129,0.15);">
                                    <span>🛡️</span>
                                    <span>جدار حماية ويندوز: المنفذ 4545 مصرح ومفتوح بنجاح ✓ (التابلت يمكنه الاتصال)</span>
                                </div>
                            `;
                        }
                    } else {
                        if (typeof showToast === 'function') showToast('ℹ️ يرجى تشغيل البرنامج كمسؤول للسماح بفتح المنفذ في جدار الحماية.', 'info');
                    }
                }, 2200);
            } catch(err) {
                alert('خطأ في إرسال الأمر: ' + err.message);
            }
        }
    };

    // تهيئة حالة زر السيرفر في شريط العنوان فور تحميل الصفحة
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => { if (window.BayanNetworkHub) window.BayanNetworkHub.updateHeaderButtonUI(); }, 100);
            });
        } else {
            setTimeout(() => { if (window.BayanNetworkHub) window.BayanNetworkHub.updateHeaderButtonUI(); }, 100);
        }
    }
})();
