/**
 * Bayan POS - SQLite Database Engine (BayanSQLite)
 * =========================================================================
 * محرك قاعدة بيانات SQLite الاحترافي لأنظمة نقاط البيع والمحاسبة.
 * - ملف قاعدة بيانات حقيقي ودائم على القرص الصلب: (.bayan_pos/bayan_pos.db)
 * - استعلامات SQL سريعة وفهارس Indexes على (الباركود، الفواتير، التواريخ، الحسابات).
 * - يدعم الاستيراد والترحيل التلقائي بضغطة زر من IndexedDB إلى SQLite دون فقدان أي فاتورة.
 * - يعمل بدون الحاجة لأي مترجمات C++ أو ملحقات إضافية (WebAssembly SQLite Core).
 * =========================================================================
 */

(function (window) {
    'use strict';

    class BayanSQLiteManager {
        constructor() {
            this.db = null;
            this.SQL = null;
            this.isInitialized = false;
            this._initPromise = null;
            this._inTransaction = false;
            this._lastAutoId = Date.now();
            this.dbPath = '';
            this._saveTimer = null;
            this._isWriting = false;
            this._hasPendingWrite = false;
            this._writePromise = null;
            const req = (typeof window !== 'undefined' && window.require) 
                ? window.require 
                : (typeof require !== 'undefined' ? require : null);
            this.req = req;
            this.isElectron = !!req;
            this.fs = null;
            this.path = null;
            this.os = null;

            if (this.isElectron) {
                try {
                    this.fs = req('fs');
                    this.path = req('path');
                    this.os = req('os');
                    const dir = this.path.join(this.os.homedir(), '.bayan_pos');
                    if (!this.fs.existsSync(dir)) {
                        this.fs.mkdirSync(dir, { recursive: true });
                    }
                    this.dbPath = this.path.join(dir, 'bayan_pos.db');

                    // تأمين حفظ أي بيانات معلقة عند طلب إغلاق البرنامج من Electron
                    const electron = req('electron');
                    if (electron && electron.ipcRenderer) {
                        electron.ipcRenderer.on('trigger-backup-before-quit', async () => {
                            await this.flush();
                        });
                    }
                } catch (e) {
                    console.warn('[SQLite] Node module require notice:', e.message);
                }
            }

            // صمام أمان إضافي عند إغلاق أو إعادة تحميل الصفحة
            if (typeof window !== 'undefined') {
                window.addEventListener('beforeunload', () => {
                    this.flushSync();
                });
            }
        }

        /**
         * 🛡️ تنظيف وتأمين مصفوفة المعاملات لـ SQLite ومنع تمرير undefined نهائياً
         */
        _safeBind(params) {
            if (!Array.isArray(params)) return [];
            return params.map(val => {
                if (val === undefined || val === null) return null;
                if (typeof val === 'number') {
                    return isNaN(val) ? 0 : val;
                }
                if (typeof val === 'string' || typeof val === 'boolean' || val instanceof Uint8Array) {
                    return val;
                }
                try {
                    const str = JSON.stringify(val);
                    return str !== undefined ? str : '{}';
                } catch (e) {
                    return String(val);
                }
            });
        }

        /**
         * 📂 كشف المسار الحقيقي لمجلد البرنامج بدقة متناهية
         */
        _getAppDirectory() {
            let appDir = '';
            // 1. استخراج المسار من رابط الصفحة المحلية في Electron
            if (typeof window !== 'undefined' && window.location) {
                try {
                    let loc = window.location.pathname || '';
                    if (!loc && window.location.href) {
                        loc = window.location.href.split('?')[0].split('#')[0];
                    }
                    loc = decodeURIComponent(loc).replace(/^file:\/\/\/?/, '');
                    if (loc.charAt(0) === '/' && loc.charAt(2) === ':') {
                        loc = loc.slice(1);
                    }
                    if (this.path) {
                        appDir = this.path.dirname(loc);
                    } else {
                        appDir = loc.substring(0, loc.lastIndexOf('/'));
                    }
                } catch (e) {}
            }
            // 2. من تطبيق إلكترون الأساسي
            if (!appDir && this.req) {
                try {
                    const electron = this.req('electron');
                    const app = electron.app || (electron.remote && electron.remote.app);
                    if (app && typeof app.getAppPath === 'function') {
                        appDir = app.getAppPath();
                    }
                } catch (e) {}
            }
            // 3. مسار Node.js الأساسي
            if (!appDir && typeof __dirname !== 'undefined' && __dirname) {
                appDir = __dirname;
            }
            if (!appDir && typeof process !== 'undefined' && process.cwd) {
                appDir = process.cwd();
            }
            return appDir || '';
        }

        _ensureNode() {
            if (this.fs && this.path) return true;
            let req = null;
            try {
                if (typeof window !== 'undefined' && typeof window.require === 'function') req = window.require;
                else if (typeof require === 'function') req = require;
                else if (typeof globalThis !== 'undefined' && typeof globalThis.require === 'function') req = globalThis.require;
                else if (typeof process !== 'undefined' && process.mainModule && typeof process.mainModule.require === 'function') req = process.mainModule.require;
            } catch (e) {}

            this.req = req;
            this.isElectron = !!req;
            if (req) {
                try { this.fs = req('fs'); } catch (e) {}
                try { this.path = req('path'); } catch (e) {}
                try { this.os = req('os'); } catch (e) {}
            }
            if (this.path && this.os && !this.dbPath) {
                try {
                    const dir = this.path.join(this.os.homedir(), '.bayan_pos');
                    if (this.fs && !this.fs.existsSync(dir)) {
                        this.fs.mkdirSync(dir, { recursive: true });
                    }
                    this.dbPath = this.path.join(dir, 'bayan_pos.db');
                } catch (e) {}
            }
            return !!(this.fs && this.path);
        }

        _loadWasmViaXHR(url) {
            return new Promise((resolve, reject) => {
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', url, true);
                    xhr.responseType = 'arraybuffer';
                    xhr.onload = function () {
                        if (xhr.status === 200 || (xhr.status === 0 && xhr.response && xhr.response.byteLength > 0)) {
                            resolve(new Uint8Array(xhr.response));
                        } else {
                            reject(new Error(`XHR failed: status ${xhr.status}`));
                        }
                    };
                    xhr.onerror = function (err) {
                        reject(new Error(`XHR network error: ${err}`));
                    };
                    xhr.send(null);
                } catch (e) {
                    reject(e);
                }
            });
        }

        async ensureReady() {
            if (this.isInitialized && this.db) return this;
            if (this._initPromise) return this._initPromise;
            return this.init();
        }

        getNextAutoId() {
            const now = Date.now();
            this._lastAutoId = now > this._lastAutoId ? now : this._lastAutoId + 1;
            return this._lastAutoId;
        }

        runInTransaction(fn) {
            if (!this.db) return fn();
            if (this._inTransaction) {
                return fn();
            }
            this._inTransaction = true;
            try {
                this.db.run("BEGIN TRANSACTION;");
                const res = fn();
                this.db.run("COMMIT;");
                return res;
            } catch (err) {
                try { this.db.run("ROLLBACK;"); } catch (r) {}
                throw err;
            } finally {
                this._inTransaction = false;
            }
        }

        /**
         * 🚀 تهيئة محرك الـ SQLite وفتح أو إنشاء ملف قاعدة البيانات على القرص الصلب
         */
        async init() {
            if (this.isInitialized && this.db) return this;
            if (this._initPromise) return this._initPromise;

            this._initPromise = (async () => {
                console.log("🔄 جاري تهيئة محرك SQLite فائق السرعة...");
                this._ensureNode();

                try {
                    // تحميل مكتبة sql.js عبر WebAssembly
                    if (typeof initSqlJs !== 'function') {
                        if (this.req) {
                            try {
                                const sqlMod = this.req('./lib/sql-wasm.js');
                                if (typeof sqlMod === 'function') window.initSqlJs = sqlMod;
                                else if (sqlMod && typeof sqlMod.default === 'function') window.initSqlJs = sqlMod.default;
                            } catch(reqErr) {}
                        }
                        if (typeof initSqlJs !== 'function') {
                            await this._loadScript('lib/sql-wasm.js');
                        }
                    }
                    const config = {};
                    const appDir = this._getAppDirectory();

                    // 🥇 أولوية 1: حزمة الـ WASM المدمجة مباشرة بالذاكرة (Zero Fetch / 100% Offline / فوري في 1ms)
                    if (typeof window !== 'undefined' && window.SQL_WASM_BASE64) {
                        try {
                            const binStr = window.atob(window.SQL_WASM_BASE64);
                            const len = binStr.length;
                            const bytes = new Uint8Array(len);
                            for (let i = 0; i < len; i++) {
                                bytes[i] = binStr.charCodeAt(i);
                            }
                            config.wasmBinary = bytes;
                            // 🧹 تحرير فوري لذاكرة الرام (حوالي 700KB) بعد فك ترميز الحزمة
                            try { delete window.SQL_WASM_BASE64; } catch (e) { window.SQL_WASM_BASE64 = null; }
                            console.log('📦 [SQLite] Loaded wasm binary instantly from embedded memory bundle (Zero Fetch / 100% Offline):', bytes.length, 'bytes');
                        } catch (b64Err) {
                            console.warn('[SQLite] Failed to decode SQL_WASM_BASE64:', b64Err.message);
                        }
                    }

                    // 🥈 أولوية 2: قراءة الملف مباشرة من الهارد ديسك عبر Node fs
                    if (!config.wasmBinary && this.fs && this.path) {
                        try {
                            const candidates = [];
                            if (appDir) {
                                candidates.push(this.path.join(appDir, 'lib', 'sql-wasm.wasm'));
                                candidates.push(this.path.join(appDir, 'sql-wasm.wasm'));
                            }
                            if (typeof __dirname !== 'undefined' && __dirname) {
                                candidates.push(this.path.join(__dirname, 'lib', 'sql-wasm.wasm'));
                            }
                            if (typeof process !== 'undefined' && process.cwd) {
                                candidates.push(this.path.join(process.cwd(), 'lib', 'sql-wasm.wasm'));
                                candidates.push(this.path.resolve('lib', 'sql-wasm.wasm'));
                            }

                            for (const cp of candidates) {
                                if (this.fs.existsSync(cp)) {
                                    const buf = this.fs.readFileSync(cp);
                                    config.wasmBinary = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
                                    console.log('📦 [SQLite] Loaded wasm binary directly from disk into memory:', cp, `(${buf.length} bytes)`);
                                    break;
                                }
                            }
                        } catch (e) {
                            console.warn('[SQLite] wasmBinary load error:', e.message);
                        }
                    }

                    // 🥉 أولوية 3: صمام أمان عبر XMLHttpRequest غير متزامن (Async XHR)
                    if (!config.wasmBinary && typeof XMLHttpRequest !== 'undefined') {
                        try {
                            let baseHref = '';
                            if (typeof window !== 'undefined' && window.location && window.location.href) {
                                baseHref = window.location.href.split('?')[0].split('#')[0].replace(/\/[^/]*$/, '/');
                            }
                            const xhrUrl = baseHref ? `${baseHref}lib/sql-wasm.wasm` : 'lib/sql-wasm.wasm';
                            config.wasmBinary = await this._loadWasmViaXHR(xhrUrl);
                            console.log('📦 [SQLite] Loaded wasm binary via asynchronous XHR:', config.wasmBinary.byteLength, 'bytes');
                        } catch (xhrErr) {
                            console.warn('[SQLite] Async XHR wasm fallback notice:', xhrErr.message);
                        }
                    }

                    // ضبط locateFile دائماً ليعود بمسار file:/// مطلق
                    config.locateFile = file => {
                        if (typeof window !== 'undefined' && window.location && window.location.href) {
                            const baseHref = window.location.href.split('?')[0].split('#')[0].replace(/\/[^/]*$/, '/');
                            return `${baseHref}lib/${file}`;
                        }
                        return `lib/${file}`;
                    };

                    this.SQL = await initSqlJs(config);

                    // قراءة ملف الداتابيز من القرص إذا كان موجوداً
                    let fileBuffer = null;
                    if (this.fs && this.dbPath && this.fs.existsSync(this.dbPath)) {
                        try {
                            fileBuffer = this.fs.readFileSync(this.dbPath);
                            console.log(`📦 تم العثور على قاعدة بيانات SQLite موجودة على القرص: (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
                        } catch (readErr) {
                            console.warn('[SQLite] Error reading existing db file:', readErr.message);
                        }
                        // تنظيف أي ملف مؤقت متبقي من جلسة سابقة غير مكتملة
                        try {
                            const tmpPath = this.dbPath + '.tmp';
                            if (this.fs.existsSync(tmpPath)) {
                                this.fs.unlinkSync(tmpPath);
                            }
                        } catch (e) {}
                    }

                    // إذا لم نجدها على القرص (أو في وضع المتصفح)، نسترجعها من مخزن المتصفح
                    if (!fileBuffer || fileBuffer.length === 0) {
                        try {
                            fileBuffer = await this._loadFromBrowserStorage();
                            if (fileBuffer && fileBuffer.length > 0) {
                                console.log(`📦 تم استرجاع قاعدة بيانات SQLite من مخزن المتصفح: (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
                            }
                        } catch (bErr) {
                            console.warn('[SQLite] Browser storage load notice:', bErr.message);
                        }
                    }

                    if (fileBuffer && fileBuffer.length > 0) {
                        this.db = new this.SQL.Database(fileBuffer);
                        // إذا كان حجم قاعدة البيانات متضخماً (أكبر من 8MB)، نقوم بضغطها واسترجاع المساحة الفارغة تلقائياً في الخلفية دون تعطيل التشغيل
                        if (fileBuffer.length > 8 * 1024 * 1024) {
                            setTimeout(() => {
                                try {
                                    if (this.db) {
                                        this.db.run('VACUUM;');
                                        this.schedulePersist(200);
                                        console.log("🧹 [SQLite] تم ضغط وتنظيف قاعدة البيانات واستعادة المساحة الفارغة بنجاح (VACUUM).");
                                    }
                                } catch(vErr) {}
                            }, 1000);
                        }
                    } else {
                        this.db = new this.SQL.Database();
                        console.log("✨ تم إنشاء قاعدة بيانات SQLite جديدة ونظيفة.");
                        this._createSchema();
                        this._autoSeedFromMasterSync();
                        this.schedulePersist(200);
                    }

                    // إنشاء الجداول والفهارس فوراً
                    this._createSchema();

                    // 🚚 صمام الأمان: إذا كانت قاعدة بيانات SQLite فارغة، يتم ترحيل بيانات العميل من IndexedDB تلقائياً
                    try {
                        const pCountRes = this.db.exec("SELECT COUNT(*) FROM products;");
                        const pCount = (pCountRes && pCountRes[0] && pCountRes[0].values && pCountRes[0].values[0]) ? pCountRes[0].values[0][0] : 0;
                        if (pCount === 0) {
                            await this._autoMigrateIfEmpty();
                        }
                    } catch(cntErr) {}

                    this.isInitialized = true;
                    console.log("✅ [SQLite] Database initialized and active successfully at:", this.dbPath || 'Browser Local Storage');

                    // إعلام الـ Adapter بتوفر الـ SQLite
                    if (window.BayanDBAdapter) {
                        window.BayanDBAdapter.mode = 'sqlite';
                        window.BayanDBAdapter.activeDriver = this;
                    }

                    return this;
                } catch (err) {
                    this._initPromise = null;
                    console.error("❌ [SQLite] فشل تهيئة قاعدة بيانات SQLite:", err);
                    throw err;
                }
            })();

            return this._initPromise;
        }

        /**
         * 🛠️ إنشاء الجداول والفهارس الصلبة (Schema & Fast Indexes)
         */
        _createSchema() {
            if (!this.db) return;

            // 1. جدول الأصناف والمنتجات
            this.db.run(`
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    barcode TEXT,
                    category TEXT,
                    unit TEXT,
                    cost REAL DEFAULT 0,
                    price REAL DEFAULT 0,
                    wholesale REAL DEFAULT 0,
                    stock REAL DEFAULT 0,
                    raw_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_prod_barcode ON products(barcode);
                CREATE INDEX IF NOT EXISTS idx_prod_name ON products(name);
                CREATE INDEX IF NOT EXISTS idx_prod_category ON products(category);
            `);

            // 2. جدول الفواتير والحركات اليومية
            this.db.run(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY,
                    invoiceId TEXT,
                    dateISO TEXT,
                    time TEXT,
                    type TEXT,
                    partner TEXT,
                    total REAL DEFAULT 0,
                    paidAmount REAL DEFAULT 0,
                    remaining REAL DEFAULT 0,
                    method TEXT,
                    cashier TEXT,
                    warehouse TEXT,
                    raw_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(dateISO);
                CREATE INDEX IF NOT EXISTS idx_tx_partner ON transactions(partner);
                CREATE INDEX IF NOT EXISTS idx_tx_invoiceId ON transactions(invoiceId);
                CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
            `);

            // 3. جدول الحسابات (العملاء والموردين)
            this.db.run(`
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    code TEXT,
                    type TEXT,
                    mobile TEXT,
                    balance REAL DEFAULT 0,
                    address TEXT,
                    raw_json TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_acc_name ON accounts(name);
                CREATE INDEX IF NOT EXISTS idx_acc_code ON accounts(code);
            `);

            // 4. جدول الإعدادات العامة
            this.db.run(`
                CREATE TABLE IF NOT EXISTS settings (
                    id TEXT PRIMARY KEY,
                    value TEXT
                );
            `);

            // 5. جدول المخازن
            this.db.run(`
                CREATE TABLE IF NOT EXISTS warehouses (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    address TEXT,
                    raw_json TEXT
                );
            `);

            // 6. جداول المستخدمين وسلة المحذوفات وسجل التدقيق
            this.db.run(`
                CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, pin TEXT, role TEXT, raw_json TEXT);
                CREATE TABLE IF NOT EXISTS trash (id INTEGER PRIMARY KEY, type TEXT, deletedAt TEXT, raw_json TEXT);
                CREATE TABLE IF NOT EXISTS auditLogs (id INTEGER PRIMARY KEY, timestamp TEXT, action TEXT, raw_json TEXT);
                CREATE TABLE IF NOT EXISTS treasuryAudit (id INTEGER PRIMARY KEY, date TEXT, category TEXT, raw_json TEXT);
                CREATE TABLE IF NOT EXISTS wallpapers (id INTEGER PRIMARY KEY, name TEXT, raw_json TEXT);
                CREATE TABLE IF NOT EXISTS backups (id INTEGER PRIMARY KEY, timestamp TEXT, raw_json TEXT);
                CREATE TABLE IF NOT EXISTS syncQueue (id INTEGER PRIMARY KEY, timestamp TEXT, action TEXT, type TEXT, status TEXT, raw_json TEXT);
            `);
        }

        /**
         * ⚡ استرجاع كافة السجلات من جدول محدد
         */
        getAll(tableName) {
            if (!this.db) return [];
            try {
                if (tableName === 'settings') {
                    const res = this.db.exec("SELECT id, value FROM settings;");
                    if (res.length > 0 && res[0].values) {
                        return res[0].values.map(row => {
                            return { id: String(row[0]), value: row[1] };
                        });
                    }
                    return [];
                }

                const res = this.db.exec(`SELECT raw_json FROM ${tableName};`);
                if (res.length > 0 && res[0].values) {
                    return res[0].values.map(row => {
                        if (row[0]) {
                            try { return JSON.parse(row[0]); } catch(e) {}
                        }
                        return null;
                    }).filter(Boolean);
                }
            } catch (e) {
                console.warn(`[SQLite] getAll error on ${tableName}:`, e.message);
            }
            return [];
        }

        /**
         * ⚡ جلب عنصر واحد بواسطة المعرف
         */
        getById(tableName, id) {
            if (!this.db) return null;
            try {
                if (tableName === 'settings') {
                    const stmt = this.db.prepare(`SELECT value FROM settings WHERE id = ? LIMIT 1;`);
                    stmt.bind([String(id)]);
                    if (stmt.step()) {
                        const val = stmt.get()[0];
                        stmt.free();
                        return { id: String(id), value: val };
                    }
                    stmt.free();
                    return null;
                }
                const stmt = this.db.prepare(`SELECT raw_json FROM ${tableName} WHERE id = ? LIMIT 1;`);
                stmt.bind([id]);
                if (stmt.step()) {
                    const raw = stmt.get()[0];
                    stmt.free();
                    return JSON.parse(raw);
                }
                stmt.free();
            } catch (e) {
                console.warn(`[SQLite] getById error on ${tableName}:`, e.message);
            }
            return null;
        }

        /**
         * ⚡ حفظ أو تحديث سجل واحد
         */
        put(tableName, item) {
            if (!this.db || !item) return null;
            try {
                if (!item.id && tableName !== 'settings') {
                    item.id = this.getNextAutoId();
                }
                const rawJson = JSON.stringify(item);

                if (tableName === 'products') {
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO products (id, name, barcode, category, unit, cost, price, wholesale, stock, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`);
                    stmt.run(this._safeBind([item.id, item.name || '', item.barcode || '', item.category || '', item.unit || '', parseFloat(item.cost) || 0, parseFloat(item.price) || 0, parseFloat(item.wholesale) || 0, parseFloat(item.stock) || 0, rawJson]));
                    stmt.free();
                } else if (tableName === 'transactions') {
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO transactions (id, invoiceId, dateISO, time, type, partner, total, paidAmount, remaining, method, cashier, warehouse, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`);
                    stmt.run(this._safeBind([item.id, String(item.invoiceId || ''), item.dateISO || '', item.time || '', item.type || '', item.partner || '', parseFloat(item.invoiceGrandTotal) || parseFloat(item.total) || 0, parseFloat(item.paidAmount) || 0, parseFloat(item.remaining) || 0, item.method || '', item.cashier || item.user || '', item.warehouse || '', rawJson]));
                    stmt.free();
                } else if (tableName === 'accounts') {
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO accounts (id, name, code, type, mobile, balance, address, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`);
                    stmt.run(this._safeBind([item.id, item.name || '', item.code || '', item.type || '', item.mobile || '', parseFloat(item.balance) || 0, item.address || '', rawJson]));
                    stmt.free();
                } else if (tableName === 'settings') {
                    const key = item.id || item.key || 'main';
                    let val = '';
                    if (item.value !== undefined) {
                        val = typeof item.value === 'object' && item.value !== null ? JSON.stringify(item.value) : String(item.value);
                    } else {
                        val = rawJson;
                    }
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO settings (id, value) VALUES (?, ?);`);
                    stmt.run(this._safeBind([String(key), val]));
                    stmt.free();
                } else if (tableName === 'warehouses') {
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO warehouses (id, name, address, raw_json) VALUES (?, ?, ?, ?);`);
                    stmt.run(this._safeBind([item.id, item.name || '', item.address || '', rawJson]));
                    stmt.free();
                } else if (tableName === 'users') {
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO users (id, name, pin, role, raw_json) VALUES (?, ?, ?, ?, ?);`);
                    stmt.run(this._safeBind([item.id, item.name || '', item.pin || '', item.role || '', rawJson]));
                    stmt.free();
                } else {
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO ${tableName} (id, raw_json) VALUES (?, ?);`);
                    stmt.run(this._safeBind([item.id, rawJson]));
                    stmt.free();
                }
                this.schedulePersist();
                return item.id;
            } catch (e) {
                console.error(`[SQLite] put error on ${tableName}:`, e.message);
                throw e;
            }
        }

        /**
         * ⚡ إضافة سجل جديد
         */
        add(tableName, item) {
            return this.put(tableName, item);
        }

        /**
         * ⚡ حفظ مجموعة سجلات دفعة واحدة (Bulk Put داخل Transaction ذرية)
         */
        bulkPut(tableName, items) {
            if (!this.db || !Array.isArray(items) || items.length === 0) return [];
            try {
                return this.runInTransaction(() => {
                    for (const item of items) {
                        this.put(tableName, item);
                    }
                    this.schedulePersist();
                    return items.map(i => i.id);
                });
            } catch (e) {
                console.error(`[SQLite] bulkPut error on ${tableName}:`, e.message);
                throw e;
            }
        }

        /**
         * ⚡ حذف سجل بواسطة المعرف
         */
        delete(tableName, id) {
            if (!this.db || id === undefined) return false;
            try {
                const stmt = this.db.prepare(`DELETE FROM ${tableName} WHERE id = ?;`);
                stmt.run([id != null ? id : null]);
                stmt.free();
                this.schedulePersist();
                return true;
            } catch (e) {
                console.warn(`[SQLite] delete error on ${tableName}:`, e.message);
                return false;
            }
        }

        /**
         * ⚡ حذف مجموعة سجلات دفعة واحدة
         */
        bulkDelete(tableName, ids) {
            if (!this.db || !Array.isArray(ids) || ids.length === 0) return false;
            try {
                return this.runInTransaction(() => {
                    const stmt = this.db.prepare(`DELETE FROM ${tableName} WHERE id = ?;`);
                    for (const id of ids) {
                        if (id !== undefined) {
                            stmt.run([id != null ? id : null]);
                        }
                    }
                    stmt.free();
                    this.schedulePersist();
                    return true;
                });
            } catch (e) {
                console.warn(`[SQLite] bulkDelete error on ${tableName}:`, e.message);
                return false;
            }
        }

        /**
         * ⚡ حساب عدد السجلات في جدول
         */
        count(tableName) {
            if (!this.db) return 0;
            try {
                const res = this.db.exec(`SELECT count(*) FROM ${tableName};`);
                if (res.length > 0 && res[0].values) {
                    return res[0].values[0][0] || 0;
                }
            } catch (e) {
                console.warn(`[SQLite] count error on ${tableName}:`, e.message);
            }
            return 0;
        }

        /**
         * ⚡ مسح كافة السجلات من جدول
         */
        clear(tableName) {
            if (!this.db) return false;
            try {
                this.db.run(`DELETE FROM ${tableName};`);
                this.schedulePersist();
                return true;
            } catch (e) {
                console.warn(`[SQLite] clear error on ${tableName}:`, e.message);
                return false;
            }
        }

        /**
         * 🚚 ترحيل وتجهيز البيانات الأولية تلقائياً من ملف master_sync_db.json إذا كان موجوداً
         */
        _autoSeedFromMasterSync() {
            if (!this.fs || !this.path || !this.os) return;
            try {
                const masterFile = this.path.join(this.os.homedir(), '.bayan_pos', 'master_sync_db.json');
                if (this.fs.existsSync(masterFile)) {
                    const raw = this.fs.readFileSync(masterFile, 'utf8');
                    const data = JSON.parse(raw);
                    console.log("🚚 [SQLite Auto-Seed] جاري ترحيل وتجهيز البيانات الأولية من ملف السيرفر المحلي تلقائياً...");
                    this.db.run("BEGIN TRANSACTION;");

                    if (Array.isArray(data.products)) {
                        const stmt = this.db.prepare(`INSERT OR REPLACE INTO products (id, name, barcode, category, unit, cost, price, wholesale, stock, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`);
                        data.products.forEach(p => {
                            if (!p) return;
                            stmt.run(this._safeBind([p.id || null, p.name || 'صنف', p.barcode || '', p.category || 'عام', p.unit || 'قطعة', parseFloat(p.cost) || 0, parseFloat(p.price) || 0, parseFloat(p.wholesale) || 0, parseFloat(p.stock) || 0, JSON.stringify(p)]));
                        });
                        stmt.free();
                    }

                    if (Array.isArray(data.accounts)) {
                        const stmt = this.db.prepare(`INSERT OR REPLACE INTO accounts (id, name, code, type, mobile, balance, address, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`);
                        data.accounts.forEach(a => {
                            if (!a) return;
                            stmt.run(this._safeBind([a.id || null, a.name || 'حساب', a.code || '', a.type || 'client', a.mobile || '', parseFloat(a.balance) || 0, a.address || '', JSON.stringify(a)]));
                        });
                        stmt.free();
                    }

                    if (Array.isArray(data.transactions)) {
                        const stmt = this.db.prepare(`INSERT OR REPLACE INTO transactions (id, invoiceId, dateISO, time, type, partner, total, paidAmount, remaining, method, cashier, warehouse, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`);
                        data.transactions.forEach(t => {
                            if (!t) return;
                            stmt.run(this._safeBind([t.id || null, String(t.invoiceId || ''), t.dateISO || '', t.time || '', t.type || '', t.partner || '', parseFloat(t.invoiceGrandTotal) || parseFloat(t.total) || 0, parseFloat(t.paidAmount) || 0, parseFloat(t.remaining) || 0, t.method || '', t.cashier || '', t.warehouse || '', JSON.stringify(t)]));
                        });
                        stmt.free();
                    }

                    if (Array.isArray(data.warehouses)) {
                        const stmt = this.db.prepare(`INSERT OR REPLACE INTO warehouses (id, name, address, raw_json) VALUES (?, ?, ?, ?);`);
                        data.warehouses.forEach(w => {
                            if (!w) return;
                            stmt.run(this._safeBind([w.id || null, w.name || '', w.address || '', JSON.stringify(w)]));
                        });
                        stmt.free();
                    }

                    this.db.run("COMMIT;");
                    this.persistNow();
                    console.log("✅ [SQLite Auto-Seed] تم تجهيز وترحيل ملف SQLite بنجاح تام من بيانات السيرفر.");
                }
            } catch(e) {
                try { this.db.run("ROLLBACK;"); } catch(r) {}
                console.warn("[SQLite Auto-Seed] Notice:", e.message);
            }
        }

        /**
         * 💾 حفظ التغييرات على القرص الصلب (Auto Debounced Persistence)
         */
        schedulePersist() {
            if (this._saveTimer) clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(() => {
                this.persistNow();
            }, 300);
        }

        /**
         * 💾 حفظ ثنائي في مخزن المتصفح (في حال التشغيل بدون بيئة Node/Electron)
         */
        _persistToBrowserStorage(data) {
            if (typeof indexedDB === 'undefined' || !data) return;
            try {
                const req = indexedDB.open('bayan_sqlite_storage', 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('sqlite_blob')) {
                        db.createObjectStore('sqlite_blob');
                    }
                };
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('sqlite_blob', 'readwrite');
                    tx.objectStore('sqlite_blob').put(data, 'main_db');
                };
            } catch (e) {
                console.warn('[SQLite] Browser storage persist notice:', e.message);
            }
        }

        /**
         * 📦 استرجاع الثنائي من مخزن المتصفح
         */
        _loadFromBrowserStorage() {
            return new Promise((resolve) => {
                if (typeof indexedDB === 'undefined') return resolve(null);
                try {
                    const req = indexedDB.open('bayan_sqlite_storage', 1);
                    req.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('sqlite_blob')) {
                            db.createObjectStore('sqlite_blob');
                        }
                    };
                    req.onsuccess = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('sqlite_blob')) {
                            return resolve(null);
                        }
                        const tx = db.transaction('sqlite_blob', 'readonly');
                        const getReq = tx.objectStore('sqlite_blob').get('main_db');
                        getReq.onsuccess = () => {
                            if (getReq.result && getReq.result instanceof Uint8Array) {
                                resolve(getReq.result);
                            } else if (getReq.result && getReq.result.buffer) {
                                resolve(new Uint8Array(getReq.result.buffer));
                            } else {
                                resolve(null);
                            }
                        };
                        getReq.onerror = () => resolve(null);
                    };
                    req.onerror = () => resolve(null);
                } catch (e) {
                    resolve(null);
                }
            });
        }

        /**
         * ⚡ كتابة غير متزامنة للقرص دون حظر خيط الواجهة (Non-blocking Async File Write)
         */
        _writeFileAsync(filePath, buffer) {
            if (this.fs && this.fs.promises && typeof this.fs.promises.writeFile === 'function') {
                return this.fs.promises.writeFile(filePath, buffer);
            }
            return new Promise((resolve, reject) => {
                this.fs.writeFile(filePath, buffer, (err) => err ? reject(err) : resolve());
            });
        }

        /**
         * 🛡️ استبدال ذري وآمن للملف عبر ملف مؤقت (Atomic Replacement with Lock/Retry Protection)
         */
        async _replaceFileAtomicAsync(tmpPath, targetPath) {
            const maxRetries = 5;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    if (this.fs && this.fs.promises && typeof this.fs.promises.rename === 'function') {
                        await this.fs.promises.rename(tmpPath, targetPath);
                    } else {
                        await new Promise((resolve, reject) => {
                            this.fs.rename(tmpPath, targetPath, (err) => err ? reject(err) : resolve());
                        });
                    }
                    return;
                } catch (err) {
                    // في بيئة Windows، قد تحجز برامج مكافحة الفيروسات أو الفهرسة الملف لبضعة أجزاء من الثانية
                    if ((err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') && attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 25 * attempt));
                        continue;
                    }
                    // كصمام أمان أخير في حال استمرار رفض Windows التسمية: نسخ المحتوى ثم حذف المؤقت
                    try {
                        if (this.fs && this.fs.promises && typeof this.fs.promises.copyFile === 'function') {
                            await this.fs.promises.copyFile(tmpPath, targetPath);
                            await this.fs.promises.unlink(tmpPath).catch(() => {});
                        } else {
                            await new Promise((resolve, reject) => {
                                this.fs.copyFile(tmpPath, targetPath, (cErr) => {
                                    if (cErr) return reject(cErr);
                                    this.fs.unlink(tmpPath, () => {});
                                    resolve();
                                });
                            });
                        }
                        return;
                    } catch (copyErr) {
                        console.error("❌ [SQLite] فشل الاستبدال الذري للملف:", copyErr.message);
                        throw err;
                    }
                }
            }
        }

        /**
         * 💾 كتابة ذكية غير متزامنة مع قائمة انتظار وحماية ضد التعارض (Queued Non-blocking Persistence)
         * تمنع تجميد واجهة البرنامج نهائياً وتضمن تسلسل الحفظ وعدم الكتابة فوق بعضها
         */
        async persistNow() {
            if (!this.db) return;

            // إلغاء مؤقت التأخير المعلق لتفادي الازدواجية
            if (this._saveTimer) {
                clearTimeout(this._saveTimer);
                this._saveTimer = null;
            }

            // إذا كانت هناك عملية كتابة جارية حالياً على القرص، نؤشر بوجود تغييرات جديدة معلقة
            // ونعيد نفس الوعد الجاري لمنع أي تداخل بين عمليتين
            if (this._isWriting) {
                this._hasPendingWrite = true;
                return this._writePromise;
            }

            this._isWriting = true;
            this._hasPendingWrite = false;

            this._writePromise = (async () => {
                try {
                    // تصدير البايتات من الذاكرة الحية (WASM RAM)
                    const data = this.db.export();

                    if (this.fs && this.dbPath) {
                        const buffer = Buffer.from(data);
                        const tmpPath = this.dbPath + '.tmp';

                        // 1. كتابة غير متزامنة للقرص في ملف مؤقت لمنع تجميد واجهة المستخدم
                        await this._writeFileAsync(tmpPath, buffer);

                        // 2. استبدال الملف الأصلي بالملف المؤقت بشكل ذري (Atomic Replace)
                        await this._replaceFileAtomicAsync(tmpPath, this.dbPath);
                    } else {
                        this._persistToBrowserStorage(data);
                    }
                } catch (err) {
                    console.error("❌ [SQLite] فشل كتابة قاعدة البيانات:", err.message);
                } finally {
                    this._isWriting = false;

                    // إذا طرأت تغييرات جديدة أثناء الكتابة، ننفذ جولة حفظ تالية بأحدث حالة للذاكرة
                    if (this._hasPendingWrite) {
                        this._hasPendingWrite = false;
                        this.persistNow();
                    }
                }
            })();

            return this._writePromise;
        }

        /**
         * 🛡️ تفريغ وحفظ كافة العمليات المعلقة وضمان اكتمالها فوراً
         */
        async flush() {
            if (this._saveTimer) {
                clearTimeout(this._saveTimer);
                this._saveTimer = null;
            }
            if (this._isWriting && this._writePromise) {
                await this._writePromise;
            }
            if (this._hasPendingWrite) {
                await this.persistNow();
            }
        }

        /**
         * 🚨 حفظ اضطراري متزامن في حالات الإغلاق المفاجئ غير المعالجة
         */
        flushSync() {
            if (this._saveTimer) {
                clearTimeout(this._saveTimer);
                this._saveTimer = null;
            }
            if (!this.db || !this.fs || !this.dbPath) return;
            try {
                const data = this.db.export();
                const buffer = Buffer.from(data);
                const tmpPath = this.dbPath + '.tmp';
                this.fs.writeFileSync(tmpPath, buffer);
                try {
                    if (this.fs.existsSync(this.dbPath)) {
                        this.fs.unlinkSync(this.dbPath);
                    }
                    this.fs.renameSync(tmpPath, this.dbPath);
                } catch (renErr) {
                    this.fs.writeFileSync(this.dbPath, buffer);
                }
            } catch (e) {
                console.error("❌ [SQLite] Emergency sync flush error:", e.message);
            }
        }

        /**
         * 🚚 فحص صامت وترحيل تلقائي للبيانات القديمة من IndexedDB إلى SQLite عند الترقية لأول مرة
         */
        async _autoMigrateIfEmpty() {
            try {
                if (typeof Dexie === 'undefined') {
                    try { await this._loadScript('lib/dexie.js'); } catch(e) {}
                }
                if (typeof Dexie !== 'undefined') {
                    const testDb = new Dexie("BayanDatabase");
                    testDb.version(101).stores({
                        products: "++id, name, barcode, category",
                        transactions: "++id, dateISO, type, partner, invoiceId",
                        accounts: "++id, name, type, code",
                        settings: "id",
                        warehouses: "++id, name",
                        users: "++id, name, pin"
                    });
                    await testDb.open().catch(() => {});
                    if (testDb.products) {
                        const oldProdsCount = await testDb.products.count().catch(() => 0);
                        if (oldProdsCount > 0) {
                            console.log(`🚚 [SQLite Auto-Migrate] تم اكتشاف ${oldProdsCount} صنف قديم في IndexedDB، جاري الترحيل الصامت لـ SQLite...`);
                            await this.migrateFromIndexedDB();
                            console.log("✅ [SQLite Auto-Migrate] تم الترحيل التلقائي بنجاح تام دون تدخل المستخدم!");
                        }
                    }
                    try { testDb.close(); } catch(e) {}
                }
            } catch (err) {
                console.warn("[SQLite Auto-Migrate] Auto migrate notice:", err.message);
            }
        }

        /**
         * 🚚 الترحيل التلقائي الكامل من IndexedDB (Dexie) إلى ملف SQLite
         */
        async migrateFromIndexedDB() {
            if (!this.db) await this.init();

            console.log("🚀 جاري بدء ترحيل البيانات من IndexedDB إلى ملف SQLite...");
            if (typeof Dexie === 'undefined') {
                try {
                    await this._loadScript('lib/dexie.js');
                } catch(e) {}
            }
            let sourceDb = null;
            if (typeof Dexie !== 'undefined') {
                try {
                    const dexieInst = new Dexie("BayanDatabase");
                    dexieInst.version(101).stores({
                        products: "++id, name, barcode, category",
                        transactions: "++id, dateISO, type, partner, invoiceId",
                        accounts: "++id, name, type, code",
                        settings: "id",
                        trash: "++id, type, deletedAt",
                        users: "++id, name, pin",
                        auditLogs: "++id, timestamp, action",
                        backups: "++id, timestamp",
                        wallpapers: "name",
                        treasuryAudit: "++id, date, category",
                        syncQueue: "++id, timestamp, action, type, status",
                        warehouses: "++id, name"
                    });
                    await dexieInst.open().catch(() => {});
                    sourceDb = dexieInst;
                } catch(e) {}
            }
            if (!sourceDb && (window.bayanDB !== this && window.db !== this)) {
                sourceDb = window.bayanDB || window.db;
            }
            if (!sourceDb) {
                throw new Error("قاعدة بيانات IndexedDB غير متوفرة للترحيل.");
            }

            const stats = {
                products: 0,
                transactions: 0,
                accounts: 0,
                settings: 0,
                warehouses: 0,
                users: 0
            };

            // استخدام معاملة ذرية (Transaction) لضمان كتابة آلاف السجلات في أقل من ثانية واحدة!
            try { this.db.run("COMMIT;"); } catch(e) {}
            this.db.run("BEGIN TRANSACTION;");

            try {
                // 1. ترحيل الأصناف
                if (sourceDb.products) {
                    const prods = await sourceDb.products.toArray();
                    const stmt = this.db.prepare(`
                        INSERT OR REPLACE INTO products (id, name, barcode, category, unit, cost, price, wholesale, stock, raw_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    `);
                    prods.forEach(p => {
                        if (!p) return;
                        stmt.run(this._safeBind([
                            p.id != null ? p.id : null,
                            p.name != null ? String(p.name) : 'بدون اسم',
                            p.barcode != null ? String(p.barcode) : '',
                            p.category != null ? String(p.category) : 'عام',
                            p.unit != null ? String(p.unit) : 'قطعة',
                            parseFloat(p.cost) || 0,
                            parseFloat(p.price) || 0,
                            parseFloat(p.wholesale) || 0,
                            parseFloat(p.stock) || 0,
                            JSON.stringify(p) || '{}'
                        ]));
                        stats.products++;
                    });
                    stmt.free();
                }

                // 2. ترحيل الحسابات (العملاء والموردين)
                if (sourceDb.accounts) {
                    const accs = await sourceDb.accounts.toArray();
                    const stmt = this.db.prepare(`
                        INSERT OR REPLACE INTO accounts (id, name, code, type, mobile, balance, address, raw_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    `);
                    accs.forEach(a => {
                        if (!a) return;
                        stmt.run(this._safeBind([
                            a.id != null ? a.id : null,
                            a.name != null ? String(a.name) : 'حساب',
                            a.code != null ? String(a.code) : '',
                            a.type != null ? String(a.type) : 'client',
                            a.mobile != null ? String(a.mobile) : '',
                            parseFloat(a.balance) || 0,
                            a.address != null ? String(a.address) : '',
                            JSON.stringify(a) || '{}'
                        ]));
                        stats.accounts++;
                    });
                    stmt.free();
                }

                // 3. ترحيل الفواتير والعمليات
                if (sourceDb.transactions) {
                    const txs = await sourceDb.transactions.toArray();
                    const stmt = this.db.prepare(`
                        INSERT OR REPLACE INTO transactions (id, invoiceId, dateISO, time, type, partner, total, paidAmount, remaining, method, cashier, warehouse, raw_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    `);
                    txs.forEach(t => {
                        if (!t) return;
                        stmt.run(this._safeBind([
                            t.id != null ? t.id : null,
                            t.invoiceId != null ? String(t.invoiceId) : '',
                            t.dateISO != null ? String(t.dateISO) : '',
                            t.time != null ? String(t.time) : '',
                            t.type != null ? String(t.type) : '',
                            t.partner != null ? String(t.partner) : '',
                            parseFloat(t.invoiceGrandTotal) || parseFloat(t.total) || 0,
                            parseFloat(t.paidAmount) || 0,
                            parseFloat(t.remaining) || 0,
                            t.method != null ? String(t.method) : '',
                            t.cashier != null ? String(t.cashier) : (t.user != null ? String(t.user) : ''),
                            t.warehouse != null ? String(t.warehouse) : '',
                            JSON.stringify(t) || '{}'
                        ]));
                        stats.transactions++;
                    });
                    stmt.free();
                }

                // 4. ترحيل المخازن
                if (sourceDb.warehouses) {
                    const whs = await sourceDb.warehouses.toArray();
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO warehouses (id, name, address, raw_json) VALUES (?, ?, ?, ?);`);
                    whs.forEach(w => {
                        if (!w) return;
                        stmt.run(this._safeBind([
                            w.id != null ? w.id : null,
                            w.name != null ? String(w.name) : '',
                            w.address != null ? String(w.address) : '',
                            JSON.stringify(w) || '{}'
                        ]));
                        stats.warehouses++;
                    });
                    stmt.free();
                }

                // 5. ترحيل الإعدادات
                if (sourceDb.settings) {
                    const sets = await sourceDb.settings.toArray();
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO settings (id, value) VALUES (?, ?);`);
                    sets.forEach(s => {
                        if (!s) return;
                        const key = s.id || s.key || 'main';
                        let val = '';
                        if (s.value !== undefined) {
                            val = typeof s.value === 'string' ? s.value : (JSON.stringify(s.value) || '{}');
                        } else {
                            val = JSON.stringify(s) || '{}';
                        }
                        stmt.run(this._safeBind([String(key), val]));
                        stats.settings++;
                    });
                    stmt.free();
                }

                // 6. ترحيل المستخدمين
                if (sourceDb.users) {
                    const usrs = await sourceDb.users.toArray();
                    const stmt = this.db.prepare(`INSERT OR REPLACE INTO users (id, name, pin, role, raw_json) VALUES (?, ?, ?, ?, ?);`);
                    usrs.forEach(u => {
                        if (!u) return;
                        stmt.run(this._safeBind([
                            u.id != null ? u.id : null,
                            u.name != null ? String(u.name) : '',
                            u.pin != null ? String(u.pin) : '',
                            u.role != null ? String(u.role) : 'cashier',
                            JSON.stringify(u) || '{}'
                        ]));
                        stats.users++;
                    });
                    stmt.free();
                }

                this.db.run("COMMIT;");
                await this.persistNow();

                console.log("🎉 [SQLite] اكتمل الترحيل بنجاح تام إلى ملف SQLite:", stats);
                return { success: true, stats };
            } catch (err) {
                try { this.db.run("ROLLBACK;"); } catch(r) {}
                console.error("❌ [SQLite] خطأ أثناء الترحيل، تم التراجع:", err);
                throw err;
            }
        }

        /**
         * دالة مساعدة لتحميل السكريبتات برمجياً
         */
        _loadScript(src) {
            return new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = () => resolve();
                s.onerror = (e) => reject(new Error(`Failed to load ${src}`));
                document.head.appendChild(s);
            });
        }
    }

    // دالة واجهة المستخدم لبدء الترحيل بضغطة زر مع تنبيه تأكيد وإحصائيات كاملة
    window.promptMigrateToSQLite = async function() {
        if (!window.BayanSQLite) return;
        
        const confirmMsg = `
            <div style="text-align: right; line-height: 1.8;">
                <p style="font-weight: bold; font-size: 1.1rem; color: #1e293b;">هل ترغب في ترحيل ونقل كافة البيانات إلى ملف قاعدة بيانات SQLite؟</p>
                <ul style="margin: 10px 0; padding-right: 20px; color: #475569; font-size: 0.9rem;">
                    <li>سيتم إنشاء وحفظ ملف دائم على القرص الصلب: <code>.bayan_pos/bayan_pos.db</code>.</li>
                    <li>يتم نقل كافة المنتجات والمقاسات والفواتير والحسابات بأمان تام ودون فقدان أي سجل.</li>
                    <li>البيانات السابقة تظل محفوظة في المتصفح كصمام أمان إضافي.</li>
                </ul>
            </div>
        `;
        
        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'info',
                titleText: '⚡ ترحيل البيانات إلى SQLite',
                msg: confirmMsg,
                confirmText: 'بدء الترحيل الفوري 🚀',
                cancelText: 'إلغاء',
                showCancel: true,
                onConfirm: async () => {
                    try {
                        if (typeof showToast === 'function') showToast("⏳ جاري الترحيل وكتابة البيانات في ملف SQLite...", "info");
                        const result = await window.BayanSQLite.migrateFromIndexedDB();
                        if (result && result.success) {
                            showCustomAlert({
                                type: 'success',
                                titleText: '🎉 اكتمل الترحيل بنجاح تام!',
                                msg: `
                                    <div style="text-align: right; color: #1e293b; line-height: 1.8;">
                                        <p style="font-weight: bold; color: #16a34a; font-size: 1.05rem;">تم إنشاء ملف SQLite وتخزين البيانات بنجاح:</p>
                                        <p>📦 <b>المنتجات:</b> ${result.stats.products}</p>
                                        <p>🧾 <b>الفواتير والعمليات:</b> ${result.stats.transactions}</p>
                                        <p>👥 <b>الحسابات (عملاء وموردين):</b> ${result.stats.accounts}</p>
                                        <p>🏢 <b>المخازن:</b> ${result.stats.warehouses}</p>
                                        <hr style="margin: 10px 0; border: none; border-top: 1px solid #e2e8f0;">
                                        <p style="font-size: 0.85rem; color: #64748b;">مسار الملف: <code>${window.BayanSQLite.dbPath}</code></p>
                                    </div>
                                `
                            });
                        }
                    } catch (err) {
                        if (typeof showToast === 'function') showToast(`❌ فشل الترحيل: ${err.message}`, "error");
                    }
                }
            });
        } else {
            if (confirm("هل ترغب في ترحيل كافة البيانات إلى SQLite؟")) {
                const res = await window.BayanSQLite.migrateFromIndexedDB();
                alert(`تم الترحيل بنجاح! الأصناف: ${res.stats.products}، الفواتير: ${res.stats.transactions}`);
            }
        }
    };

    // 🔍 دالة الحصول على المسار الفعلي لقاعدة بيانات SQLite على القرص الصلب
    // 🔍 دالة الحصول على مسار مجلد قاعدة بيانات SQLite
    window.getSqliteFolderPath = function() {
        let req = (typeof window !== 'undefined' && window.require) ? window.require : (typeof require !== 'undefined' ? require : null);
        if (req) {
            try {
                const os = req('os');
                const path = req('path');
                if (os && path) {
                    return path.join(os.homedir(), '.bayan_pos');
                }
            } catch (e) {}
        }
        if (typeof process !== 'undefined' && process.env && process.env.USERPROFILE) {
            return process.env.USERPROFILE + '\\.bayan_pos';
        }
        return '%USERPROFILE%\\.bayan_pos';
    };

    // 🔍 دالة الحصول على المسار الفعلي لملف قاعدة البيانات
    window.getSqliteDbPath = function() {
        const folder = window.getSqliteFolderPath();
        let req = (typeof window !== 'undefined' && window.require) ? window.require : (typeof require !== 'undefined' ? require : null);
        if (req) {
            try {
                const path = req('path');
                if (path) return path.join(folder, 'bayan_pos.db');
            } catch (e) {}
        }
        return folder + '\\bayan_pos.db';
    };

    // 📋 دالة نسخ مسار المجلد (للفتح السلس في Run بدون تحذيرات ويندوز)
    window.copySqlitePath = async function(btnElement) {
        const folderPath = window.getSqliteFolderPath();
        let copied = false;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(folderPath);
                copied = true;
            }
        } catch (e) {}

        if (!copied) {
            try {
                const tempInput = document.createElement('textarea');
                tempInput.value = folderPath;
                tempInput.style.position = 'fixed';
                tempInput.style.opacity = '0';
                tempInput.style.left = '-9999px';
                document.body.appendChild(tempInput);
                tempInput.select();
                copied = document.execCommand('copy');
                document.body.removeChild(tempInput);
            } catch (e) {}
        }

        if (copied) {
            if (typeof showToast === 'function') {
                showToast("📋 تم نسخ مسار المجلد بنجاح (جاهز للصق في Win + R)!", "success");
            }
            if (btnElement) {
                const originalHtml = btnElement.innerHTML;
                btnElement.innerHTML = '<span style="font-size: 1.15rem;">✅</span> تم النسخ!';
                btnElement.style.borderColor = '#10b981';
                btnElement.style.color = '#059669';
                btnElement.style.background = '#ecfdf5';
                setTimeout(() => {
                    btnElement.innerHTML = originalHtml;
                    btnElement.style.borderColor = '';
                    btnElement.style.color = '';
                    btnElement.style.background = '';
                }, 2500);
            }
        } else {
            window.showSqlitePathModal();
        }
        return copied;
    };

    // 📋 دالة نسخ قيمة أي حقل محدد
    window.copyInputValue = async function(inputId, btn) {
        const input = document.getElementById(inputId);
        const textToCopy = input ? input.value : window.getSqliteFolderPath();

        let copied = false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
                copied = true;
            }
        } catch (e) {}

        if (!copied && input) {
            try {
                input.select();
                input.setSelectionRange(0, 99999);
                copied = document.execCommand('copy');
            } catch (e) {}
        }

        if (copied) {
            if (typeof showToast === 'function') {
                showToast("📋 تم النسخ إلى الحافظة بنجاح!", "success");
            }
            if (btn) {
                const icon = btn.querySelector('.copy-icon') || btn;
                const text = btn.querySelector('.copy-txt');
                const originalBg = btn.style.background;

                btn.style.background = '#10b981';
                if (icon && icon.classList.contains('copy-icon')) icon.innerText = '✅';
                if (text) text.innerText = 'تم!';

                setTimeout(() => {
                    btn.style.background = originalBg;
                    if (icon && icon.classList.contains('copy-icon')) icon.innerText = '📋';
                    if (text) text.innerText = 'نسخ';
                }, 2200);
            }
        }
    };

    // 🪟 نافذة عرض ونسخ مسار قاعدة بيانات SQLite مع الشرح والتسهيل
    window.showSqlitePathModal = function() {
        const folderPath = window.getSqliteFolderPath();
        const filePath = window.getSqliteDbPath();

        if (typeof showCustomAlert === 'function') {
            showCustomAlert({
                type: 'info',
                titleText: '📁 مسار قاعدة بيانات SQLite في ويندوز',
                confirmText: 'إغلاق',
                cardWidth: '560px',
                msg: `
                    <div style="text-align: right; direction: rtl; font-family: inherit; line-height: 1.7;">
                        <!-- بطاقة تعريفية -->
                        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1.5px solid #bae6fd; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="font-size: 1.25rem;">⚡</span>
                                <span style="font-weight: 900; color: #0369a1; font-size: 0.95rem;">قاعدة بيانات SQLite المحلية (bayan_pos.db)</span>
                            </div>
                            <p style="margin: 0; font-size: 0.86rem; color: #334155; font-weight: 700; line-height: 1.5;">
                                جميع الفواتير والمبيعات محفوظة بأمان ومحلياً على جهازك داخل هذا المجلد:
                            </p>
                        </div>

                        <!-- 1. مسار المجلد (للفتح السريع بدون تحذير ويندوز) -->
                        <div style="margin-bottom: 14px;">
                            <label style="display: block; font-weight: 800; color: #0f172a; font-size: 0.88rem; margin-bottom: 6px;">
                                📁 مسار المجلد (لفتحه مباشرة عبر Win + R بدون تحذيرات):
                            </label>
                            <div style="display: flex; align-items: stretch; gap: 8px; direction: ltr;">
                                <input type="text" id="sqliteFolderInput" readonly value="${folderPath}" 
                                    style="flex: 1; background: #f8fafc; border: 2px solid #0284c7; border-radius: 10px; padding: 9px 12px; font-family: Consolas, monospace; font-size: 0.92rem; font-weight: 800; color: #0f172a; outline: none;"
                                    onclick="this.select();" />
                                <button type="button" onclick="window.copyInputValue('sqliteFolderInput', this)"
                                    style="background: #0284c7; color: #ffffff; border: none; border-radius: 10px; padding: 0 16px; font-weight: 900; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; white-space: nowrap; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);">
                                    <span class="copy-icon">📋</span> <span class="copy-txt">نسخ المجلد</span>
                                </button>
                            </div>
                        </div>

                        <!-- 2. مسار الملف الكامل -->
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-weight: 700; color: #64748b; font-size: 0.82rem; margin-bottom: 6px;">
                                📄 مسار ملف قاعدة البيانات الكامل (bayan_pos.db):
                            </label>
                            <div style="display: flex; align-items: stretch; gap: 8px; direction: ltr;">
                                <input type="text" id="sqliteFileInput" readonly value="${filePath}" 
                                    style="flex: 1; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 8px 12px; font-family: Consolas, monospace; font-size: 0.86rem; font-weight: 700; color: #475569; outline: none;"
                                    onclick="this.select();" />
                                <button type="button" onclick="window.copyInputValue('sqliteFileInput', this)"
                                    style="background: #e2e8f0; color: #334155; border: none; border-radius: 10px; padding: 0 14px; font-weight: 800; font-size: 0.84rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; white-space: nowrap;">
                                    <span class="copy-icon">📋</span> <span class="copy-txt">نسخ الملف</span>
                                </button>
                            </div>
                        </div>

                        <!-- زر فتح المجلد المباشر -->
                        <div style="margin-bottom: 14px;">
                            <button type="button" onclick="window.openSqliteFolder();"
                                style="width: 100%; background: #0369a1; color: #ffffff; border: none; border-radius: 10px; padding: 11px; font-weight: 900; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 3px 10px rgba(3, 105, 161, 0.25); transition: all 0.2s;">
                                <span>📂</span> فتح مجلد الداتابيز في الويندوز مباشرة الآن
                            </button>
                        </div>

                        <!-- إرشاد وتطمين هام -->
                        <div style="background: #f8fafc; border-radius: 10px; padding: 12px 14px; border: 1px solid #e2e8f0; display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 1.3rem; line-height: 1.2;">💡</span>
                            <div style="font-size: 0.82rem; color: #475569; font-weight: 700; line-height: 1.6;">
                                <strong>تنبيه ويندوز:</strong> عند فتح نافذة <kbd style="background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 6px; font-family: monospace; font-weight: 900; color: #1e293b;">Win + R</kbd>، الصق <strong>مسار المجلد</strong> فقط ليفتح لك الفولدر مباشرة دون أن تظهر لك رسالة ويندوز الروتينية لملفات النظام (.db).
                            </div>
                        </div>
                    </div>
                `
            });
        } else {
            alert(`مسار مجلد قاعدة البيانات:\n${folderPath}`);
        }
    };

    // 📂 دالة فتح مسار مجلد وملف قاعدة بيانات SQLite مباشرة على ويندوز
    window.openSqliteFolder = async function() {
        console.log("📂 جاري فتح مسار ملف قاعدة بيانات SQLite على ويندوز...");
        let req = (typeof window !== 'undefined' && window.require) ? window.require : (typeof require !== 'undefined' ? require : null);

        let opened = false;
        if (req) {
            try {
                const os = req('os');
                const path = req('path');
                const fs = req('fs');
                const sqliteDir = path.join(os.homedir(), '.bayan_pos');
                const dbPath = path.join(sqliteDir, 'bayan_pos.db');

                // تأكد من إنشاء المجلد إن لم يكن موجوداً
                if (!fs.existsSync(sqliteDir)) {
                    fs.mkdirSync(sqliteDir, { recursive: true });
                }

                // محاولة 1: عبر electron.shell مباشرة (تحديد الملف داخل مجلد الويندوز)
                try {
                    const electron = req('electron');
                    if (electron && electron.shell) {
                        if (fs.existsSync(dbPath)) {
                            electron.shell.showItemInFolder(dbPath);
                            opened = true;
                        } else {
                            await electron.shell.openPath(sqliteDir);
                            opened = true;
                        }
                    }
                } catch (shErr) {}

                // محاولة 2: عبر ipcRenderer للعملية الرئيسية
                if (!opened) {
                    try {
                        const electron = req('electron');
                        if (electron && electron.ipcRenderer) {
                            opened = await electron.ipcRenderer.invoke('open-sqlite-folder');
                        }
                    } catch (ipcErr) {}
                }

                // محاولة 3: تشغيل explorer.exe مباشرة عبر child_process
                if (!opened) {
                    try {
                        const cp = req('child_process');
                        if (cp) {
                            if (fs.existsSync(dbPath)) {
                                cp.exec(`explorer.exe /select,"${dbPath}"`);
                            } else {
                                cp.exec(`explorer.exe "${sqliteDir}"`);
                            }
                            opened = true;
                        }
                    } catch (cpErr) {}
                }
            } catch (err) {
                console.warn("Folder open notice:", err);
            }
        }

        if (opened) {
            if (typeof showToast === 'function') {
                showToast("📂 تم فتح مسار ملف الداتابيز بنجاح", "success");
            }
            return true;
        }

        // في حال تعذر الفتح المباشر أو كان التطبيق مفتوحاً بمتصفح: إظهار النافذة الراقية مع زر النسخ
        window.showSqlitePathModal();
        return false;
    };

    // تصدير الكائن على مستوى الـ window
    window.BayanSQLite = new BayanSQLiteManager();

    // تشغيل تلقائي هادئ
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => window.BayanSQLite.init());
        } else {
            window.BayanSQLite.init();
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
