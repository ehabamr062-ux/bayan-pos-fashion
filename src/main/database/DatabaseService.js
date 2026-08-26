const path = require('path');
const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();

class DatabaseService {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        try {
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'store.db');
            
            console.log(`🔌 Connecting to SQLite database at: ${dbPath}`);
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('❌ Failed to open SQLite database:', err);
                } else {
                    console.log('✅ SQLite database opened successfully.');
                    this.setupDatabase();
                }
            });
        } catch (error) {
            console.error('❌ Failed to initialize SQLite database:', error);
            throw error;
        }
    }

    setupDatabase() {
        this.db.serialize(() => {
            this.db.run('PRAGMA journal_mode = WAL');
            this.db.run('PRAGMA synchronous = NORMAL');
            this.db.run('PRAGMA foreign_keys = ON');

            this.createTables();
            this.createIndexes();
        });
    }

    createTables() {
        // 1. جدول المستخدمين
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                pin TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                permissions TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        `);

        // 2. جدول الإعدادات
        this.db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);

        // 3. جدول الأصناف (المنتجات)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode TEXT UNIQUE,
                name TEXT NOT NULL,
                category TEXT,
                purchase_price REAL DEFAULT 0,
                sale_price REAL DEFAULT 0,
                wholesale_price REAL DEFAULT 0,
                stock_qty REAL DEFAULT 0,
                min_qty REAL DEFAULT 0,
                unit TEXT,
                supplier_id INTEGER,
                notes TEXT,
                is_quick INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        `);

        // التأكد من وجود عمود المفضلة (is_quick) للأجهزة التي تملك قاعدة بيانات قديمة
        this.db.run(`ALTER TABLE products ADD COLUMN is_quick INTEGER DEFAULT 0`, () => {});

        // 4. جدول العملاء
        this.db.run(`
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                phone TEXT,
                email TEXT,
                address TEXT,
                balance REAL DEFAULT 0,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        `);

        // 5. جدول الموردين
        this.db.run(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                phone TEXT,
                email TEXT,
                address TEXT,
                balance REAL DEFAULT 0,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        `);

        // 6. جدول فواتير البيع (Invoices)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_no TEXT UNIQUE NOT NULL,
                customer_id INTEGER,
                date TEXT NOT NULL,
                total REAL DEFAULT 0,
                discount REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                final_total REAL DEFAULT 0,
                paid REAL DEFAULT 0,
                remaining REAL DEFAULT 0,
                payment_type TEXT,
                user_id INTEGER,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(customer_id) REFERENCES customers(id)
            )
        `);

        // 7. تفاصيل فواتير البيع (Invoice Items)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS invoice_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                qty REAL NOT NULL,
                price REAL NOT NULL,
                discount REAL DEFAULT 0,
                total REAL NOT NULL,
                FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
                FOREIGN KEY(product_id) REFERENCES products(id)
            )
        `);

        // 8. فواتير الشراء (Purchase Invoices)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS purchase_invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_no TEXT UNIQUE NOT NULL,
                supplier_id INTEGER,
                date TEXT NOT NULL,
                total REAL DEFAULT 0,
                discount REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                final_total REAL DEFAULT 0,
                paid REAL DEFAULT 0,
                remaining REAL DEFAULT 0,
                payment_type TEXT,
                user_id INTEGER,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
            )
        `);

        // 9. تفاصيل فواتير الشراء
        this.db.run(`
            CREATE TABLE IF NOT EXISTS purchase_invoice_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_invoice_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                qty REAL NOT NULL,
                price REAL NOT NULL,
                total REAL NOT NULL,
                FOREIGN KEY(purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
                FOREIGN KEY(product_id) REFERENCES products(id)
            )
        `);

        // 10. جدول الخزينة (Treasury transactions)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS treasury (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                amount REAL NOT NULL,
                date TEXT NOT NULL,
                source TEXT,
                reference_id INTEGER,
                notes TEXT,
                user_id INTEGER,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        `);

        // 11. جدول المصروفات (Expenses)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                date TEXT NOT NULL,
                notes TEXT,
                user_id INTEGER,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        `);

        // 12. حركات المخزون (Stock Movements)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS stock_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                qty REAL NOT NULL,
                type TEXT NOT NULL,
                reference TEXT,
                reference_id INTEGER,
                date TEXT NOT NULL,
                user_id INTEGER,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(product_id) REFERENCES products(id)
            )
        `);

        // 13. المرتجعات (Returns)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS returns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER,
                product_id INTEGER,
                qty REAL NOT NULL,
                price REAL NOT NULL,
                total REAL NOT NULL,
                date TEXT NOT NULL,
                type TEXT,
                user_id INTEGER,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        `);

        // 14. الحركة اليومية (Daily Movements)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS daily_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_type TEXT NOT NULL,
                description TEXT,
                amount REAL DEFAULT 0,
                date TEXT NOT NULL,
                user_id INTEGER,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        `);

        // 15. سلة المحذوفات (Trash Bin)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS trash (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                label TEXT,
                originalData TEXT,
                deletedAt TEXT DEFAULT (datetime('now', 'localtime')),
                deletedBy TEXT
            )
        `);

        // 16. سجل التدقيق (Audit Logs)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT DEFAULT (datetime('now', 'localtime')),
                action TEXT NOT NULL,
                details TEXT,
                user_id INTEGER
            )
        `);

        // 17. الخلفيات المخصصة (Wallpapers)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS wallpapers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                data TEXT
            )
        `);
    }

    createIndexes() {
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_no ON invoices(invoice_no)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_cust ON invoices(customer_id)`);
        
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`);
        
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_no ON purchase_invoices(invoice_no)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(date)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supp ON purchase_invoices(supplier_id)`);
        
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_treasury_date ON treasury(date)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_daily_movements_date ON daily_movements(date)`);
    }

    // Async query helpers using Promises
    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    queryOne(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
            });
        });
    }

    transaction(fn) {
        return async () => {
            try {
                await this.run('BEGIN TRANSACTION');
                const result = await fn();
                await this.run('COMMIT');
                return result;
            } catch (error) {
                await this.run('ROLLBACK');
                throw error;
            }
        };
    }
}

module.exports = new DatabaseService();
