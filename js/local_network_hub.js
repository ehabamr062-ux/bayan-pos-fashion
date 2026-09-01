// =========================================================================
// 🌐 Bayan POS - Local Network Hub & Tablet Pairing Manager
// =========================================================================

(function() {
    window.BayanNetworkHub = {
        isMasterServer: (typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && !!process.versions.electron) || 
                        (window.location.protocol === 'file:') || 
                        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ||
                        (localStorage.getItem('bayan_is_master_terminal') === 'true'),
        isServerOnline: true,
        serverUrl: 'http://127.0.0.1:4545',
        deviceId: null,
        deviceToken: null,
        isPaired: false,
        lastSyncedTimestamp: null,

        getServerUrl: function() {
            // 1. رابط مخصص محفوظ مسبقاً في إعدادات التابلت
            const stored = localStorage.getItem('bayan_local_server_url');
            if (stored && stored.startsWith('http')) return stored.trim().replace(/\/+$/, '');

            // 2. إذا تم فتح التطبيق مباشرة من عنوان السيرفر المحلي (IP:Port)
            if (window.location.origin.includes(':4545') || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                return window.location.origin;
            }

            // 3. الرابط الافتراضي
            return 'http://127.0.0.1:4545';
        },

        setServerUrl: function(url) {
            if (!url) return;
            let clean = url.trim().replace(/\/+$/, '');
            if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
                clean = 'http://' + clean;
            }
            if (!clean.includes(':4545') && !clean.includes(':') && !clean.includes('github.io')) {
                clean += ':4545';
            }
            localStorage.setItem('bayan_local_server_url', clean);
            this.serverUrl = clean;
            return clean;
        },

        fetchWithTimeout: async function(url, options = {}, timeoutMs = 3500) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timer);
                this.isServerOnline = true;
                return res;
            } catch (err) {
                clearTimeout(timer);
                this.isServerOnline = false;
                throw err;
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
                    this.pushLocalDbToServer();
                } else {
                    console.log('📱 [NetworkHub] Running as Client Terminal / Tablet -> Server URL:', this.serverUrl, '| Paired:', this.isPaired);
                    if (!this.isPaired) {
                        await this.checkClientPairing();
                    }
                    await this.pullMasterDb();
                }

                // بدء المزامنة الدورية الذكية للبيانات والتحويلات
                this.startAutoSyncPolling();
                this.startPendingTransfersPolling();
                this.setupSaveDataHook();
            } catch(err) {
                console.warn('[NetworkHub] init error caught:', err.message);
            }
        },

        startAutoSyncPolling: function() {
            // فحص دوري كل 3 ثوانٍ لوجود أي تحديثات جديدة من أي جهاز بالشبكة (ماستر أو فرعي)
            setInterval(async () => {
                try {
                    const infoRes = await this.fetchWithTimeout(`${this.serverUrl}/api/server-info`, {}, 2200);
                    const info = await infoRes.json();
                    if (info && info.lastDbUpdate && info.lastDbUpdate !== this.lastSyncedTimestamp) {
                        await this.pullMasterDb();
                    }
                } catch (e) {
                    // السيرفر غير متاح حالياً
                }
            }, 3000);
        },

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

        onDataSaved: function() {
            this.pushLocalDbToServer();
        },

        syncMasterDbFromLocal: function() {
            return this.pushLocalDbToServer();
        },

        pushDataToServer: function() {
            return this.pushLocalDbToServer();
        },

        pushLocalDbToServer: async function() {
            try {
                // إذا لم تكن البيانات قد تم تحميلها بعد في الرام، نتجاهل الإرسال
                if (!window.productsDB || !Array.isArray(window.productsDB)) return;

                const dbPayload = {
                    products: window.productsDB || [],
                    accounts: window.accounts || [],
                    transactions: window.transactions || [],
                    users: window.users || [],
                    warehouses: window.warehouses || [],
                    trash: window.trash || window.trashBin || [],
                    treasuryAudit: window.treasuryAudit || [],
                    settings: window.AppStore || {}
                };

                // إرسال عبر IPC إذا كان في بيئة Electron
                if (typeof require !== 'undefined') {
                    try {
                        const { ipcRenderer } = require('electron');
                        await ipcRenderer.invoke('sync-master-db', dbPayload);
                    } catch(ipcErr) {}
                }

                // إرسال عبر HTTP POST دائماً إلى سيرفر الشبكة المحلي
                if (Array.isArray(dbPayload.products)) {
                    const res = await this.fetchWithTimeout(`${this.serverUrl}/api/sync/push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ db: dbPayload, sourceDeviceId: this.deviceId || 'DEV-HOST' })
                    });
                    const data = await res.json();
                    if (data && data.lastUpdated) {
                        this.lastSyncedTimestamp = data.lastUpdated;
                    }
                    console.log(`✅ [NetworkHub] DB synced to local server successfully (${dbPayload.products.length} products).`);
                }
            } catch (e) {
                console.warn('[NetworkHub] pushLocalDbToServer error:', e.message);
            }
        },

        pullMasterDb: async function() {
            try {
                const res = await this.fetchWithTimeout(`${this.serverUrl}/api/sync/pull`);
                const data = await res.json();
                if (data.success && data.db) {
                    const db = data.db;
                    // إذا كانت قاعدة بيانات السيرفر فارغة تماماً، لا نمسح الداتابيز المحلية للتابلت
                    if (!Array.isArray(db.products) || db.products.length === 0) {
                        console.log('ℹ️ [NetworkHub] Server DB is currently empty. Waiting for Master sync...');
                        return;
                    }
                    this.lastSyncedTimestamp = db.lastUpdated || new Date().toISOString();
                    if (Array.isArray(db.products)) window.productsDB = db.products;
                    if (Array.isArray(db.accounts)) window.accounts = db.accounts;
                    if (Array.isArray(db.transactions)) window.transactions = db.transactions;
                    if (Array.isArray(db.trash)) window.trash = window.trashBin = db.trash;
                    if (Array.isArray(db.treasuryAudit)) window.treasuryAudit = db.treasuryAudit;
                    if (Array.isArray(db.warehouses) && db.warehouses.length > 0) window.warehouses = db.warehouses;
                    if (db.settings && typeof db.settings === 'object') {
                        window.AppStore = { ...window.AppStore, ...db.settings };
                    }

                    // تحديث المستخدمين وتجديد شاشة تسجيل الدخول تلقائياً
                    if (Array.isArray(db.users) && db.users.length > 0) {
                        window.users = db.users;
                        if (!window.currentUser && typeof initLogin === 'function') {
                            initLogin();
                        }
                    }

                    // حفظ في Dexie المحلي للتابلت لضمان السرعة والعمل حتى بدون نت
                    if (window.bayanDB) {
                        try {
                            if (db.products && db.products.length > 0) await window.bayanDB.products.bulkPut(db.products);
                            if (db.accounts && db.accounts.length > 0) await window.bayanDB.accounts.bulkPut(db.accounts);
                            if (db.transactions && db.transactions.length > 0) await window.bayanDB.transactions.bulkPut(db.transactions);
                            if (db.users && db.users.length > 0) await window.bayanDB.users.bulkPut(db.users);
                            if (db.treasuryAudit && db.treasuryAudit.length > 0) await window.bayanDB.treasuryAudit.bulkPut(db.treasuryAudit);
                        } catch(dexErr) {}
                    }

                    // تحديث كافة الشاشات والقوائم والتقارير النشطة لحظياً
                    if (typeof updateDatalists === 'function') updateDatalists();
                    if (typeof renderProductsGrid === 'function') renderProductsGrid();
                    if (typeof renderInventoryTable === 'function') renderInventoryTable();
                    if (typeof renderCart === 'function') renderCart();
                    if (typeof renderAccountsTable === 'function') renderAccountsTable();
                    if (typeof renderUsersTable === 'function') renderUsersTable();
                    if (typeof updateDashboardStats === 'function') updateDashboardStats();
                    if (typeof renderDailyReportTable === 'function') renderDailyReportTable();
                    if (typeof renderSalesHistoryTable === 'function') renderSalesHistoryTable();
                    if (typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
                    if (typeof applyBusinessTypeUI === 'function') applyBusinessTypeUI();
                    if (typeof window.checkIncomingTransfersAlert === 'function') window.checkIncomingTransfersAlert();
                    if (db.settings && db.settings.bayan_business_logo && typeof updateLogoDisplays === 'function') {
                        updateLogoDisplays(db.settings.bayan_business_logo);
                    }
                    console.log(`✅ [NetworkHub] Pulled all master data successfully (${window.productsDB ? window.productsDB.length : 0} products)`);
                }
            } catch (err) {
                console.warn('[NetworkHub] pullMasterDb failed:', err.message);
            }
        },

        shownPairingRequestIds: new Set(),

        initDeviceId: function() {
            let id = localStorage.getItem('bayan_client_device_id');
            if (!id) {
                id = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
                localStorage.setItem('bayan_client_device_id', id);
            }
            this.deviceId = id;
            this.deviceToken = localStorage.getItem('bayan_client_device_token') || null;
            const isSavedPaired = localStorage.getItem('bayan_client_is_paired') === 'true';
            this.isPaired = isSavedPaired || !!this.deviceToken || this.isMasterServer;
        },

        setupMasterListeners: function() {
            if (this.isMasterServer && typeof require === 'undefined') {
                // فحص دوري لطلبات الإقران المعلقة من شاشة المتصفح على اللاب توب بدون تكرار
                setInterval(async () => {
                    try {
                        const res = await fetch(`${this.serverUrl}/api/pair-requests/pending`);
                        const data = await res.json();
                        if (data.success && Array.isArray(data.requests) && data.requests.length > 0) {
                            data.requests.forEach(req => {
                                if (!this.shownPairingRequestIds.has(req.id) && !document.getElementById('masterPairingAlertModal')) {
                                    this.showMasterPairingAlert(req);
                                }
                            });
                        }
                    } catch(e) {}
                }, 4000);
            }

            if (typeof require === 'undefined') return;
            try {
                const { ipcRenderer } = require('electron');
                
                // تحديث البيانات عند وصول بوش من جهاز تابلت
                ipcRenderer.on('sync-data-pushed', async (event, { db, sourceDeviceId }) => {
                    if (db) {
                        if (Array.isArray(db.products) && db.products.length > 0) window.productsDB = db.products;
                        if (Array.isArray(db.accounts) && db.accounts.length > 0) window.accounts = db.accounts;
                        if (Array.isArray(db.transactions)) window.transactions = db.transactions;
                        if (Array.isArray(db.users) && db.users.length > 0) window.users = db.users;
                        if (Array.isArray(db.trash)) window.trash = window.trashBin = db.trash;
                        if (Array.isArray(db.treasuryAudit)) window.treasuryAudit = db.treasuryAudit;
                        if (Array.isArray(db.warehouses) && db.warehouses.length > 0) window.warehouses = db.warehouses;
                        if (db.settings && typeof db.settings === 'object') {
                            window.AppStore = { ...window.AppStore, ...db.settings };
                        }

                        // حفظ فوري في قاعدة بيانات الماستر IndexedDB
                        if (window.bayanDB) {
                            try {
                                if (db.products && db.products.length > 0) await window.bayanDB.products.bulkPut(db.products);
                                if (db.accounts && db.accounts.length > 0) await window.bayanDB.accounts.bulkPut(db.accounts);
                                if (db.transactions && db.transactions.length > 0) await window.bayanDB.transactions.bulkPut(db.transactions);
                                if (db.users && db.users.length > 0) await window.bayanDB.users.bulkPut(db.users);
                                if (db.treasuryAudit && db.treasuryAudit.length > 0) await window.bayanDB.treasuryAudit.bulkPut(db.treasuryAudit);
                            } catch(dexErr) {}
                        }

                        // تحديث كافة الشاشات والقوائم على الماستر لحظياً
                        if (typeof updateDatalists === 'function') updateDatalists();
                        if (typeof renderProductsGrid === 'function') renderProductsGrid();
                        if (typeof renderInventoryTable === 'function') renderInventoryTable();
                        if (typeof renderCart === 'function') renderCart();
                        if (typeof renderAccountsTable === 'function') renderAccountsTable();
                        if (typeof renderUsersTable === 'function') renderUsersTable();
                        if (typeof updateDashboardStats === 'function') updateDashboardStats();
                        if (typeof renderDailyReportTable === 'function') renderDailyReportTable();
                        if (typeof renderSalesHistoryTable === 'function') renderSalesHistoryTable();
                        if (typeof populatePaymentMethodSelects === 'function') populatePaymentMethodSelects();
                        if (typeof applyBusinessTypeUI === 'function') applyBusinessTypeUI();
                        if (typeof window.checkIncomingTransfersAlert === 'function') window.checkIncomingTransfersAlert();
                        if (db.settings && db.settings.bayan_business_logo && typeof updateLogoDisplays === 'function') {
                            updateLogoDisplays(db.settings.bayan_business_logo);
                        }
                    }
                });
                
                // استقبال طلب إقران جهاز تابلت جديد
                ipcRenderer.on('device-pairing-request', (event, reqData) => {
                    console.log('🔔 [NetworkHub] New device pairing request:', reqData);
                    if (!this.shownPairingRequestIds.has(reqData.id) && !document.getElementById('masterPairingAlertModal')) {
                        this.showMasterPairingAlert(reqData);
                    }
                });

                // إشعار إتمام الإقران بنجاح
                ipcRenderer.on('device-paired-success', (event, deviceData) => {
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
                        <div style="font-size:2.4rem; font-weight:900; letter-spacing:8px; color:#047857; font-family:monospace;">${reqData.pin || '1111'}</div>
                        <div style="color:#047857; font-size:0.78rem; margin-top:5px;">أدخل هذا الرمز في شاشة التابلت لتأكيد التوصيل (أو الرمز 1111)</div>
                    </div>

                    <button onclick="window.BayanNetworkHub.dismissPairingAlert('${reqData.id || ''}', '${reqData.deviceId || ''}')" style="background:#047857; color:#ffffff; border:none; padding:12px 30px; border-radius:10px; font-weight:bold; font-size:1rem; cursor:pointer; width:100%; transition:0.2s;">
                        تم إعطاء الرمز للمستخدم ✓
                    </button>
                </div>
            `;
        },

        dismissPairingAlert: function(id, deviceId) {
            const modal = document.getElementById('masterPairingAlertModal');
            if (modal) modal.remove();
            if (id) this.shownPairingRequestIds.add(id);

            // إشعار السيرفر بإخفاء الطلب وحذفه من قائمة الانتظار
            fetch(`${this.serverUrl}/api/pair-requests/dismiss`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, deviceId })
            }).catch(() => {});
        },

        checkClientPairing: async function() {
            if (this.isMasterServer || this.isPaired) return;

            try {
                const res = await fetch(`${this.serverUrl}/api/pair-request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: this.deviceId,
                        deviceToken: this.deviceToken,
                        deviceName: navigator.userAgent.includes('Mobile') ? 'تابلت / هاتف محمول' : 'جهاز فرعي'
                    })
                });

                const data = await res.json();
                if (data.success && data.isPaired) {
                    this.isPaired = true;
                    this.deviceToken = data.token;
                    localStorage.setItem('bayan_client_device_token', data.token);
                    localStorage.setItem('bayan_client_is_paired', 'true');
                } else if (data.requiresPin) {
                    this.showClientPinInputModal();
                }
            } catch (err) {
                console.warn('[NetworkHub] Could not connect to Master Server:', err.message);
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
                        oninput="this.value = this.value.replace(/[^0-9]/g, ''); if(this.value.length===4) window.BayanNetworkHub.submitPinCode(this.value);">

                    <div style="background:#f0f9ff; border:1px solid #bae6fd; padding:8px 12px; border-radius:10px; margin-bottom:15px; font-size:0.8rem; color:#0369a1; font-weight:700;">
                        💡 يمكنك إدخال الرمز المباشر: <strong style="font-family:monospace; font-size:1rem; color:#0284c7;">1111</strong> للاتصال الفوري
                    </div>

                    <div id="pinErrorMsg" style="color:#ef4444; font-size:0.85rem; font-weight:bold; margin-bottom:15px; display:none;"></div>

                    <button onclick="window.BayanNetworkHub.submitPinCode(document.getElementById('clientPinField').value)" style="background:#2563eb; color:#ffffff; border:none; padding:12px 30px; border-radius:10px; font-weight:bold; font-size:1rem; cursor:pointer; width:100%; transition:0.2s;">
                        تأكيد والاتصال بالمنظومة 🚀
                    </button>
                </div>
            `;
            setTimeout(() => {
                const inp = document.getElementById('clientPinField');
                if (inp) inp.focus();
            }, 300);
        },

        submitPinCode: async function(pin) {
            if (!pin || pin.length < 4) {
                const err = document.getElementById('pinErrorMsg');
                if (err) { err.innerText = '⚠️ يرجى إدخال 4 أرقام صحيحة'; err.style.display = 'block'; }
                return;
            }

            try {
                const res = await fetch(`${this.serverUrl}/api/pair-verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: this.deviceId,
                        pin: pin.trim(),
                        deviceName: navigator.userAgent.includes('Mobile') ? 'تابلت الكاشير' : 'جهاز فرعي'
                    })
                });

                const data = await res.json();
                if (data.success) {
                    this.isPaired = true;
                    this.deviceToken = data.token;
                    localStorage.setItem('bayan_client_device_token', data.token);
                    localStorage.setItem('bayan_client_is_paired', 'true');
                    
                    const modal = document.getElementById('clientPinInputModal');
                    if (modal) modal.remove();

                    if (typeof showToast === 'function') {
                        showToast('🎉 تم إقران واعتماد التابلت بنجاح دائم!', 'success');
                    }

                    // سحب البيانات فوراً وتحديث شاشات البرنامج بدون إعادة تحميل
                    await this.pullMasterDb();
                } else {
                    const err = document.getElementById('pinErrorMsg');
                    if (err) { err.innerText = '❌ ' + (data.message || 'رمز الإقران غير صحيح'); err.style.display = 'block'; }
                }
            } catch (err) {
                const errDiv = document.getElementById('pinErrorMsg');
                if (errDiv) { errDiv.innerText = '⚠️ تعذر الاتصال بالسيرفر الرئيسي'; errDiv.style.display = 'block'; }
            }
        },

        startPendingTransfersPolling: function() {
            // جلب أذونات التحويل المعلقة كل 10 ثوانٍ
            setInterval(async () => {
                await this.fetchPendingTransfers();
            }, 10000);
            this.fetchPendingTransfers();
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

                window.inTransitTransfersCache = transfers;
                if (typeof window.refreshPendingTransfersUI === 'function') {
                    window.refreshPendingTransfersUI();
                }
            } catch (e) {
                // Ignore polling errors
            }
        },

        // فتح نافذة معلومات السيرفر والـ QR Code للجهاز الرئيسي
        openServerHubModal: async function() {
            let serverInfo = { ip: '10.42.83.164', port: 4545, isRunning: true, pairedCount: 0 };
            let pairedList = [];

            if (this.isMasterServer && typeof require !== 'undefined') {
                try {
                    const { ipcRenderer } = require('electron');
                    const info = await ipcRenderer.invoke('get-local-server-info');
                    if (info && info.ip) serverInfo = info;
                    pairedList = await ipcRenderer.invoke('get-paired-devices') || [];
                } catch(e) {}
            } else {
                try {
                    const res = await fetch(`${this.serverUrl}/api/server-info`);
                    const info = await res.json();
                    if (info && info.ip) serverInfo = info;
                } catch(e) {}
            }

            const connectUrl = `http://${serverInfo.ip}:${serverInfo.port}`;

            const modalId = 'serverHubModal';
            let modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(15, 23, 42, 0.75) !important; backdrop-filter: blur(8px) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 9999999999 !important;';
                document.body.appendChild(modal);
            } else {
                modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(15, 23, 42, 0.75) !important; backdrop-filter: blur(8px) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 9999999999 !important;';
            }

            modal.innerHTML = `
                <div style="background:#ffffff; padding:30px; border-radius:24px; width:540px; max-width:92%; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,0.3); border:2px solid #047857; direction:rtl; font-family:inherit;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="margin:0; color:#064e3b; font-size:1.35rem; font-weight:900; display:flex; align-items:center; gap:8px;">
                            🌐 مركز السيرفر والربط الشبكي للأجهزة
                        </h3>
                        <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; font-size:1.4rem; cursor:pointer; color:#94a3b8; font-weight:bold;">✕</button>
                    </div>

                    <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; padding:18px; border-radius:16px; margin-bottom:20px; text-align:center;">
                        <div style="color:#065f46; font-size:0.9rem; font-weight:bold; margin-bottom:8px;">🔗 رابط اتصال التابلت والأجهزة الفرعية:</div>
                        <div style="display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
                            <div id="serverConnectUrlText" style="font-size:1.25rem; font-weight:900; color:#047857; font-family:monospace; background:#ffffff; padding:8px 18px; border-radius:10px; border:1.5px solid #6ee7b7; display:inline-block; user-select:all;">
                                ${connectUrl}
                            </div>
                            <button type="button" onclick="navigator.clipboard.writeText('${connectUrl}').then(() => { if(typeof showToast==='function') showToast('📋 تم نسخ رابط السيرفر بنجاح!', 'success'); else alert('تم النسخ بنجاح 📋'); })"
                                style="background:#047857; color:#ffffff; border:none; border-radius:10px; padding:10px 18px; font-size:0.9rem; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 8px rgba(4,120,87,0.3); transition:0.2s;"
                                title="نسخ رابط السيرفر">
                                📋 نسخ الرابط
                            </button>
                        </div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 12px; flex-wrap: wrap;">
                            <div id="serverHubQrCode" style="background: #ffffff; padding: 10px; border-radius: 12px; border: 1.5px solid #cbd5e1; box-shadow: 0 4px 10px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; min-width: 120px; min-height: 120px;"></div>
                            <div style="text-align: right; max-width: 260px;">
                                <div style="font-weight: 900; color: #065f46; font-size: 0.95rem; margin-bottom: 4px;">📷 مسح الكاميرا السريع (QR Code):</div>
                                <div style="color: #475569; font-size: 0.8rem; font-weight: 700; line-height: 1.5;">
                                    وجه كاميرا التليفون أو التابلت إلى الرمز لفتح البرنامج فوراً بدون الحاجة لكتابة الأرقام يدوياً.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="margin-bottom:18px; text-align:center;">
                        <button type="button" onclick="window.BayanNetworkHub.fixFirewall()" style="background:#f8fafc; color:#0f172a; border:1.5px solid #94a3b8; border-radius:10px; padding:8px 18px; font-size:0.84rem; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:0.2s;">
                            🛡️ إذا لم يفتح الرابط على التابلت (اضغط هنا للسماح في جدار الحماية بنقرة واحدة)
                        </button>
                    </div>

                    <div style="text-align:right; margin-bottom:20px;">
                        <div style="font-weight:900; color:#1e293b; font-size:1rem; margin-bottom:10px; display:flex; justify-content:space-between;">
                            <span>📱 الأجهزة المعتمدة والمقترنة (${pairedList.length}):</span>
                        </div>
                        <div style="max-height:160px; overflow-y:auto; border:1px solid #f1f5f9; border-radius:12px; padding:5px;" class="fast-scrollbar">
                            ${pairedList.length === 0 ? '<div style="padding:15px; text-align:center; color:#94a3b8; font-size:0.9rem;">لا توجد أجهزة تابلت مقترنة حالياً</div>' : pairedList.map(d => `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid #f8fafc; background:#f8fafc; border-radius:8px; margin-bottom:4px;">
                                    <div>
                                        <div style="font-weight:bold; color:#0f172a; font-size:0.9rem;">📱 ${d.deviceName || 'تابلت'}</div>
                                        <div style="color:#64748b; font-size:0.75rem; font-family:monospace;">IP: ${d.ip} | معرّف: ${d.deviceId}</div>
                                    </div>
                                    <button onclick="window.BayanNetworkHub.removeDevice('${d.deviceId}')" style="background:#fee2e2; color:#dc2626; border:none; padding:4px 10px; border-radius:6px; font-size:0.8rem; font-weight:bold; cursor:pointer;">إلغاء الإقران ✕</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <button onclick="document.getElementById('${modalId}').remove()" style="background:#047857; color:#ffffff; border:none; padding:12px 30px; border-radius:10px; font-weight:bold; font-size:1rem; cursor:pointer; width:100%;">
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
                await ipcRenderer.invoke('remove-paired-device', deviceId);
                this.openServerHubModal();
                if (typeof showToast === 'function') showToast('تم إلغاء إقران الجهاز بنجاح', 'info');
            }
        },

        fixFirewall: async function() {
            try {
                if (typeof showToast === 'function') showToast('جاري فتح منفذ السيرفر في جدار حماية ويندوز...', 'info');

                if (this.isMasterServer && typeof require !== 'undefined') {
                    const { ipcRenderer } = require('electron');
                    await ipcRenderer.invoke('fix-firewall-rule');
                } else {
                    const res = await fetch(`${this.serverUrl}/api/fix-firewall`, { method: 'POST' });
                    const data = await res.json();
                }

                if (typeof showToast === 'function') showToast('✅ تم إرسال أمر السماح لجدار الحماية! وافق على رسالة ويندوز وجرب الآن على التابلت.', 'success');
            } catch(err) {
                alert('خطأ في إرسال الأمر: ' + err.message);
            }
        }
    };
})();
