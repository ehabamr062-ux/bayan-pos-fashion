/**
 * Bayan POS - Unified Database Abstraction Adapter (BayanDBAdapter)
 * =========================================================================
 * طبقة وسيطة موحدة وشاملة لإدارة وتجريد قاعدة البيانات.
 * تضمن التوافق 100% مع واجهة Dexie السابقة،
 * وتوجه كافة العمليات مباشرة إلى محرك SQLite فائق السرعة والدائم على القرص الصلب.
 * =========================================================================
 */

(function (window) {
    'use strict';

    const DB_MODE_SQLITE = 'sqlite';

    // 📋 خريطة الأعمدة الحقيقية المعرفة في قاعدة بيانات SQLite للاستفادة القصوى من الفهارس
    const TABLE_COLUMNS = {
        products: new Set(['id', 'name', 'barcode', 'category', 'unit', 'cost', 'price', 'wholesale', 'stock']),
        transactions: new Set(['id', 'invoiceId', 'dateISO', 'time', 'type', 'partner', 'total', 'paidAmount', 'remaining', 'method', 'cashier', 'warehouse']),
        accounts: new Set(['id', 'name', 'code', 'type', 'mobile', 'balance', 'address']),
        warehouses: new Set(['id', 'name', 'address']),
        users: new Set(['id', 'name', 'pin', 'role']),
        trash: new Set(['id', 'type', 'deletedAt']),
        wallpapers: new Set(['id', 'name']),
        settings: new Set(['id', 'value']),
        auditLogs: new Set(['id', 'timestamp', 'action']),
        treasuryAudit: new Set(['id', 'date', 'category']),
        syncQueue: new Set(['id', 'timestamp', 'action', 'type', 'status'])
    };

    class SQLiteCollection {
        constructor(tableWrapper, field = null) {
            this.tableWrapper = tableWrapper;
            this.tableName = tableWrapper ? (tableWrapper.tableName || tableWrapper.name || null) : null;
            this.field = field;
            this.sqlClauses = [];
            this.customFilters = [];
            this.allFilters = [];
            this.sortField = null;
            this.isReverse = false;
            this.limitCount = null;
            this._emptyResult = false;
        }

        equals(val) {
            const f = this.field;
            this.allFilters.push(item => item && (item[f] == val || String(item[f]) === String(val)));
            if (f) {
                this.sqlClauses.push({ type: 'equals', field: f, val });
            }
            return this;
        }

        anyOf(arr) {
            const f = this.field;
            const set = new Set((arr || []).map(String));
            this.allFilters.push(item => item && set.has(String(item[f])));
            if (!Array.isArray(arr) || arr.length === 0) {
                this._emptyResult = true;
            } else if (f) {
                this.sqlClauses.push({ type: 'anyOf', field: f, vals: arr });
            }
            return this;
        }

        between(lower, upper, includeLower = true, includeUpper = true) {
            const f = this.field;
            this.allFilters.push(item => {
                if (!item || item[f] === undefined) return false;
                const v = item[f];
                const lowCheck = includeLower ? v >= lower : v > lower;
                const highCheck = includeUpper ? v <= upper : v < upper;
                return lowCheck && highCheck;
            });
            if (f) {
                this.sqlClauses.push({ type: 'between', field: f, lower, upper, includeLower, includeUpper });
            }
            return this;
        }

        aboveOrEqual(lower) {
            const f = this.field;
            this.allFilters.push(item => item && item[f] !== undefined && item[f] >= lower);
            if (f) {
                this.sqlClauses.push({ type: 'aboveOrEqual', field: f, val: lower });
            }
            return this;
        }

        belowOrEqual(upper) {
            const f = this.field;
            this.allFilters.push(item => item && item[f] !== undefined && item[f] <= upper);
            if (f) {
                this.sqlClauses.push({ type: 'belowOrEqual', field: f, val: upper });
            }
            return this;
        }

        above(lower) {
            const f = this.field;
            this.allFilters.push(item => item && item[f] !== undefined && item[f] > lower);
            if (f) {
                this.sqlClauses.push({ type: 'above', field: f, val: lower });
            }
            return this;
        }

        below(upper) {
            const f = this.field;
            this.allFilters.push(item => item && item[f] !== undefined && item[f] < upper);
            if (f) {
                this.sqlClauses.push({ type: 'below', field: f, val: upper });
            }
            return this;
        }

        startsWith(prefix) {
            const f = this.field;
            this.allFilters.push(item => item && String(item[f] || '').startsWith(prefix));
            if (f) {
                this.sqlClauses.push({ type: 'startsWith', field: f, prefix });
            }
            return this;
        }

        filter(fn) {
            if (typeof fn === 'function') {
                this.customFilters.push(fn);
                this.allFilters.push(fn);
            }
            return this;
        }

        reverse() {
            this.isReverse = !this.isReverse;
            return this;
        }

        limit(n) {
            this.limitCount = n;
            return this;
        }

        clone() {
            const col = new SQLiteCollection(this.tableWrapper, this.field);
            col.tableName = this.tableName;
            col.allFilters = [...this.allFilters];
            col.customFilters = [...this.customFilters];
            col.sqlClauses = [...this.sqlClauses];
            col.sortField = this.sortField;
            col.isReverse = this.isReverse;
            col.limitCount = this.limitCount;
            col._emptyResult = this._emptyResult;
            return col;
        }

        /**
         * 🔍 استخراج التعبير المناسب للعمود في SQL مع تفعيل الفهارس (Indexes) أو json_extract
         */
        _resolveColumnSql(field, tableName) {
            if (!field || typeof field !== 'string') return null;
            const cleanField = field.trim();
            const cols = TABLE_COLUMNS[tableName];
            if (cols && cols.has(cleanField)) {
                return `"${cleanField}"`;
            }
            // إذا كان الحقل داخل كائن raw_json، نستخدم دالة SQLite json_extract المدمجة
            if (/^[a-zA-Z0-9_]+$/.test(cleanField) && tableName !== 'settings') {
                return `json_extract(raw_json, '$.${cleanField}')`;
            }
            return null;
        }

        /**
         * 🛠️ بناء جملة WHERE وشروط التصفية ومعاملات Bind
         */
        _buildWhereSQL(tableName) {
            const whereClauses = [];
            const params = [];

            for (const clause of this.sqlClauses) {
                const colSql = this._resolveColumnSql(clause.field, tableName);
                if (!colSql) return null; // لا يمكن ترجمته لـ SQL، اللجوء للاحتياطي

                if (clause.type === 'equals') {
                    if (clause.field === 'invoiceId' && tableName === 'transactions') {
                        // invoiceId مخزن كنص، نضمن مطابقة الرقم والنص مع الاستفادة من idx_tx_invoiceId
                        whereClauses.push(`(${colSql} = ? OR ${colSql} = ?)`);
                        params.push(clause.val, String(clause.val));
                    } else {
                        whereClauses.push(`${colSql} = ?`);
                        params.push(clause.val);
                    }
                } else if (clause.type === 'anyOf') {
                    if (clause.vals.length === 0) {
                        return { sql: '1=0', params: [] };
                    }
                    if (clause.field === 'invoiceId' && tableName === 'transactions') {
                        const strVals = clause.vals.map(String);
                        const combined = Array.from(new Set([...clause.vals, ...strVals]));
                        const placeholders = combined.map(() => '?').join(', ');
                        whereClauses.push(`${colSql} IN (${placeholders})`);
                        params.push(...combined);
                    } else {
                        const placeholders = clause.vals.map(() => '?').join(', ');
                        whereClauses.push(`${colSql} IN (${placeholders})`);
                        params.push(...clause.vals);
                    }
                } else if (clause.type === 'aboveOrEqual') {
                    whereClauses.push(`${colSql} >= ?`);
                    params.push(clause.val);
                } else if (clause.type === 'belowOrEqual') {
                    whereClauses.push(`${colSql} <= ?`);
                    params.push(clause.val);
                } else if (clause.type === 'above') {
                    whereClauses.push(`${colSql} > ?`);
                    params.push(clause.val);
                } else if (clause.type === 'below') {
                    whereClauses.push(`${colSql} < ?`);
                    params.push(clause.val);
                } else if (clause.type === 'between') {
                    const op1 = clause.includeLower ? '>=' : '>';
                    const op2 = clause.includeUpper ? '<=' : '<';
                    whereClauses.push(`(${colSql} ${op1} ? AND ${colSql} ${op2} ?)`);
                    params.push(clause.lower, clause.upper);
                } else if (clause.type === 'startsWith') {
                    whereClauses.push(`${colSql} LIKE ?`);
                    params.push(String(clause.prefix || '') + '%');
                } else {
                    return null;
                }
            }

            return {
                sql: whereClauses.length > 0 ? whereClauses.join(' AND ') : '',
                params
            };
        }

        /**
         * ⚡ تنفيذ استعلام SQL المباشر داخل محرك SQLite
         */
        _executeSQL(db, tableName) {
            const whereInfo = this._buildWhereSQL(tableName);
            if (!whereInfo) return null;

            let selectCol = 'raw_json';
            if (tableName === 'settings') {
                selectCol = 'id, value';
            }

            let sql = `SELECT ${selectCol} FROM ${tableName}`;
            if (whereInfo.sql) {
                sql += ` WHERE ` + whereInfo.sql;
            }

            // ترتيب النتائج
            let sortedInSQL = false;
            if (this.sortField) {
                const sortColSql = this._resolveColumnSql(this.sortField, tableName);
                if (sortColSql) {
                    sql += ` ORDER BY ${sortColSql} ${this.isReverse ? 'DESC' : 'ASC'}`;
                    sortedInSQL = true;
                }
            } else if (this.isReverse) {
                sql += ` ORDER BY id DESC`;
                sortedInSQL = true;
            }

            // تطبيق الحد في SQL فقط إذا لم تكن هناك فلاتر مخصصة في JS
            let limitedInSQL = false;
            if (this.limitCount !== null && this.customFilters.length === 0) {
                const lim = parseInt(this.limitCount, 10);
                if (!isNaN(lim) && lim >= 0) {
                    sql += ` LIMIT ${lim}`;
                    limitedInSQL = true;
                }
            }

            const stmt = db.prepare(sql);
            if (whereInfo.params.length > 0) {
                stmt.bind(whereInfo.params);
            }

            const items = [];
            while (stmt.step()) {
                if (tableName === 'settings') {
                    const row = stmt.get();
                    items.push({ id: String(row[0]), value: row[1] });
                } else {
                    const raw = stmt.get()[0];
                    if (raw) {
                        try {
                            items.push(JSON.parse(raw));
                        } catch(e) {}
                    }
                }
            }
            stmt.free();

            return { items, sortedInSQL, limitedInSQL };
        }

        async toArray() {
            if (this._emptyResult) return [];

            if (window.BayanDBAdapter && typeof window.BayanDBAdapter._ensureReady === 'function') {
                await window.BayanDBAdapter._ensureReady();
            }

            const tableName = this.tableName || (this.tableWrapper ? (this.tableWrapper.tableName || this.tableWrapper.name) : null);

            // ⚡ 1. محاولة الفلترة المباشرة داخل SQLite عبر SQL والفهارس (Fast Indexed Query)
            if (window.BayanSQLite && window.BayanSQLite.db && tableName) {
                try {
                    const res = this._executeSQL(window.BayanSQLite.db, tableName);
                    if (res && Array.isArray(res.items)) {
                        let items = res.items;

                        // تطبيق أي فلاتر JS مخصصة إن وجدت فقط على النتائج المحدودة المرجعة
                        for (const fn of this.customFilters) {
                            items = items.filter(fn);
                        }

                        // ترتيب متبقي إذا لم يغطّه الـ SQL
                        if (this.sortField && !res.sortedInSQL) {
                            items.sort((a, b) => (a[this.sortField] > b[this.sortField] ? 1 : -1));
                            if (this.isReverse) items.reverse();
                        } else if (this.isReverse && !res.sortedInSQL) {
                            items.reverse();
                        }

                        // حد متبقي إذا لم يغطّه الـ SQL بسبب وجود فلاتر JS مخصصة
                        if (this.limitCount !== null && !res.limitedInSQL) {
                            items = items.slice(0, this.limitCount);
                        }

                        return items;
                    }
                } catch (sqlErr) {
                    console.warn(`[DB Adapter] SQL query notice on ${tableName}:`, sqlErr.message);
                }
            }

            // 🛡️ 2. صمام أمان واحتياطي: الفلترة داخل JavaScript في حال عدم توفر SQLite
            let items = await this.tableWrapper.toArray();
            for (const fn of this.allFilters) {
                items = items.filter(fn);
            }
            if (this.sortField) {
                items.sort((a, b) => (a[this.sortField] > b[this.sortField] ? 1 : -1));
            }
            if (this.isReverse) {
                items.reverse();
            }
            if (this.limitCount !== null) {
                items = items.slice(0, this.limitCount);
            }
            return items;
        }

        async first() {
            if (this._emptyResult) return null;
            const originalLimit = this.limitCount;
            if (this.customFilters.length === 0 && this.limitCount === null) {
                this.limitCount = 1;
            }
            const items = await this.toArray();
            this.limitCount = originalLimit;
            return items.length > 0 ? items[0] : null;
        }

        async delete() {
            const items = await this.toArray();
            const ids = items.map(i => i.id).filter(id => id !== undefined && id !== null);
            return await this.tableWrapper.bulkDelete(ids);
        }

        async count() {
            if (this._emptyResult) return 0;

            if (window.BayanDBAdapter && typeof window.BayanDBAdapter._ensureReady === 'function') {
                await window.BayanDBAdapter._ensureReady();
            }

            const tableName = this.tableName || (this.tableWrapper ? (this.tableWrapper.tableName || this.tableWrapper.name) : null);

            // ⚡ حساب فوري مباشر عبر SQL COUNT دون فك وتحميل كائنات JSON في الذاكرة
            if (this.customFilters.length === 0 && window.BayanSQLite && window.BayanSQLite.db && tableName) {
                try {
                    const whereInfo = this._buildWhereSQL(tableName);
                    if (whereInfo) {
                        let sql = `SELECT count(*) FROM ${tableName}`;
                        if (whereInfo.sql) {
                            sql += ` WHERE ` + whereInfo.sql;
                        }
                        const stmt = window.BayanSQLite.db.prepare(sql);
                        if (whereInfo.params.length > 0) {
                            stmt.bind(whereInfo.params);
                        }
                        let cnt = 0;
                        if (stmt.step()) {
                            cnt = stmt.get()[0] || 0;
                        }
                        stmt.free();
                        return cnt;
                    }
                } catch (e) {}
            }

            const items = await this.toArray();
            return items.length;
        }

        async sum(field) {
            if (this._emptyResult || !field) return 0;

            if (window.BayanDBAdapter && typeof window.BayanDBAdapter._ensureReady === 'function') {
                await window.BayanDBAdapter._ensureReady();
            }

            const tableName = this.tableName || (this.tableWrapper ? (this.tableWrapper.tableName || this.tableWrapper.name) : null);

            // ⚡ حساب فوري مباشر عبر SQL SUM دون فك وتحميل كائنات JSON في الذاكرة
            if (this.customFilters.length === 0 && window.BayanSQLite && window.BayanSQLite.db && tableName) {
                try {
                    const whereInfo = this._buildWhereSQL(tableName);
                    const colSql = this._resolveColumnSql(field, tableName);
                    if (whereInfo && colSql) {
                        let sql = `SELECT COALESCE(SUM(CAST(${colSql} AS REAL)), 0) FROM ${tableName}`;
                        if (whereInfo.sql) {
                            sql += ` WHERE ` + whereInfo.sql;
                        }
                        const stmt = window.BayanSQLite.db.prepare(sql);
                        if (whereInfo.params.length > 0) {
                            stmt.bind(whereInfo.params);
                        }
                        let total = 0;
                        if (stmt.step()) {
                            total = parseFloat(stmt.get()[0]) || 0;
                        }
                        stmt.free();
                        return total;
                    }
                } catch (e) {}
            }

            const items = await this.toArray();
            return items.reduce((acc, it) => acc + (parseFloat(it && it[field]) || 0), 0);
        }

        async each(callback) {
            const items = await this.toArray();
            for (const item of items) {
                callback(item);
            }
        }

        async modify(changes) {
            const items = await this.toArray();
            for (const item of items) {
                if (typeof changes === 'function') {
                    changes(item);
                } else if (typeof changes === 'object' && changes !== null) {
                    Object.assign(item, changes);
                }
                await this.tableWrapper.put(item);
            }
        }
    }

    class BayanDBAdapter {
        constructor() {
            this.mode = DB_MODE_SQLITE;
            this.isInitialized = false;
            this.activeDriver = null;
            this._tableNames = [
                'products',
                'transactions',
                'accounts',
                'settings',
                'trash',
                'users',
                'auditLogs',
                'backups',
                'wallpapers',
                'treasuryAudit',
                'syncQueue',
                'warehouses'
            ];

            // ربط الجداول كخصائص مباشرة على الكائن لمحاكاة window.db
            for (const name of this._tableNames) {
                this[name] = this.table(name);
            }
        }

        /**
         * التحقق والتأكد من جاهزية المحرك قبل تنفيذ أي استعلام
         */
        async _ensureReady() {
            if (this.isInitialized && this.activeDriver) return;
            if (window.BayanSQLite) {
                await window.BayanSQLite.ensureReady();
                this.mode = DB_MODE_SQLITE;
                this.activeDriver = window.BayanSQLite;
            }
            this.isInitialized = true;
        }

        /**
         * تهيئة المحول وضبط المرجع مع محرك SQLite
         */
        async init() {
            await this._ensureReady();
            window.db = this;
            window.bayanDB = this;
            console.log(`✅ [DB Adapter] Initialized successfully in [${this.mode.toUpperCase()}] mode.`);
            return this;
        }

        async open() {
            await this.init();
            return this;
        }

        close() {
            if (window.BayanSQLite) {
                window.BayanSQLite.persistNow();
            }
        }

        on(event, handler) {
            // توافق صامت مع أحداث Dexie (blocked, versionchange)
            return this;
        }

        version(v) {
            return {
                stores: () => this
            };
        }

        /**
         * تنفيذ عملية ذرية Transaction متوافقة 100% مع واجهة Dexie
         */
        async transaction(mode, ...args) {
            const callback = args[args.length - 1];
            if (typeof callback !== 'function') return;

            await this._ensureReady();

            if (window.BayanSQLite && window.BayanSQLite.db) {
                return window.BayanSQLite.runInTransaction(async () => {
                    const res = await callback();
                    window.BayanSQLite.persistNow();
                    return res;
                });
            }

            return await callback();
        }

        getDriverType() {
            return this.mode;
        }

        /**
         * واجهة إدارة الجدول الواحد المتوافقة مع Dexie و SQLite
         */
        table(tableName) {
            const self = this;

            return {
                tableName: tableName,
                name: tableName,
                async toArray() {
                    await self._ensureReady();
                    if (window.BayanSQLite && window.BayanSQLite.db) {
                        return window.BayanSQLite.getAll(tableName);
                    }
                    if (self.activeDriver && self.activeDriver[tableName] && typeof self.activeDriver[tableName].toArray === 'function') {
                        return await self.activeDriver[tableName].toArray();
                    }
                    return [];
                },

                async get(id) {
                    await self._ensureReady();
                    if (window.BayanSQLite && window.BayanSQLite.db) {
                        return window.BayanSQLite.getById(tableName, id);
                    }
                    if (self.activeDriver && self.activeDriver[tableName] && typeof self.activeDriver[tableName].get === 'function') {
                        return await self.activeDriver[tableName].get(id);
                    }
                    return null;
                },

                async first() {
                    const all = await this.toArray();
                    return all.length > 0 ? all[0] : null;
                },

                async put(item) {
                    await self._ensureReady();
                    if (window.BayanSQLite && window.BayanSQLite.db) {
                        return window.BayanSQLite.put(tableName, item);
                    }
                    if (self.activeDriver && self.activeDriver[tableName] && typeof self.activeDriver[tableName].put === 'function') {
                        return await self.activeDriver[tableName].put(item);
                    }
                    return null;
                },

                async add(item) {
                    return this.put(item);
                },

                async bulkPut(items, options) {
                    if (!Array.isArray(items) || items.length === 0) return [];
                    await self._ensureReady();
                    if (window.BayanSQLite && window.BayanSQLite.db) {
                        return window.BayanSQLite.bulkPut(tableName, items);
                    }
                    if (self.activeDriver && self.activeDriver[tableName] && typeof self.activeDriver[tableName].bulkPut === 'function') {
                        return await self.activeDriver[tableName].bulkPut(items, options);
                    }
                    return [];
                },

                async delete(id) {
                    await self._ensureReady();
                    if (window.BayanSQLite && window.BayanSQLite.db) {
                        return window.BayanSQLite.delete(tableName, id);
                    }
                    if (self.activeDriver && self.activeDriver[tableName] && typeof self.activeDriver[tableName].delete === 'function') {
                        return await self.activeDriver[tableName].delete(id);
                    }
                    return null;
                },

                async bulkDelete(ids) {
                    if (!Array.isArray(ids) || ids.length === 0) return;
                    await self._ensureReady();
                    if (window.BayanSQLite && window.BayanSQLite.db) {
                        return window.BayanSQLite.bulkDelete(tableName, ids);
                    }
                    if (self.activeDriver && self.activeDriver[tableName] && typeof self.activeDriver[tableName].bulkDelete === 'function') {
                        return await self.activeDriver[tableName].bulkDelete(ids);
                    }
                },

                async count() {
                    await self._ensureReady();
                    if (window.BayanSQLite && window.BayanSQLite.db) {
                        return window.BayanSQLite.count(tableName);
                    }
                    if (self.activeDriver && self.activeDriver[tableName] && typeof self.activeDriver[tableName].count === 'function') {
                        return await self.activeDriver[tableName].count();
                    }
                    return 0;
                },

                async clear() {
                    await self._ensureReady();
                    if (window.BayanSQLite && window.BayanSQLite.db) {
                        return window.BayanSQLite.clear(tableName);
                    }
                    if (self.activeDriver && self.activeDriver[tableName] && typeof self.activeDriver[tableName].clear === 'function') {
                        return await self.activeDriver[tableName].clear();
                    }
                },

                where(field) {
                    return new SQLiteCollection(this, field);
                },

                orderBy(field) {
                    const col = new SQLiteCollection(this);
                    col.sortField = field;
                    return col;
                },

                toCollection() {
                    return new SQLiteCollection(this);
                },

                filter(fn) {
                    return new SQLiteCollection(this).filter(fn);
                },

                async each(callback) {
                    const items = await this.toArray();
                    for (const item of items) {
                        callback(item);
                    }
                },

                async modify(changes) {
                    const items = await this.toArray();
                    for (const item of items) {
                        if (typeof changes === 'function') {
                            changes(item);
                        } else if (typeof changes === 'object' && changes !== null) {
                            Object.assign(item, changes);
                        }
                        await this.put(item);
                    }
                }
            };
        }

        async exportFullDatabaseJSON() {
            await this._ensureReady();
            const exportData = {
                version: '3.2.0',
                engine: 'SQLite',
                exportedAt: new Date().toISOString(),
                tables: {}
            };

            for (const table of this._tableNames) {
                try {
                    exportData.tables[table] = await this.table(table).toArray();
                } catch (e) {
                    exportData.tables[table] = [];
                }
            }

            return exportData;
        }

        async importFullDatabaseJSON(data) {
            if (!data || !data.tables) throw new Error("Invalid export payload");
            await this._ensureReady();

            for (const table of this._tableNames) {
                if (Array.isArray(data.tables[table])) {
                    const tbl = this.table(table);
                    await tbl.clear();
                    if (data.tables[table].length > 0) {
                        await tbl.bulkPut(data.tables[table]);
                    }
                }
            }
            return true;
        }
    }

    // تصدير الكائن على مستوى الـ Window وتثبيته فوراً كـ db الرسمي
    window.BayanDBAdapter = new BayanDBAdapter();
    window.db = window.BayanDBAdapter;
    window.bayanDB = window.BayanDBAdapter;

    // تشغيل تلقائي للتهيئة
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => window.BayanDBAdapter.init());
        } else {
            window.BayanDBAdapter.init();
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
