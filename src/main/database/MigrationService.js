const dbService = require('./DatabaseService');
const productRepo = require('./repositories/ProductRepository');
const customerRepo = require('./repositories/CustomerRepository');
const invoiceRepo = require('./repositories/InvoiceRepository');

class MigrationService {
    async isMigrationNeeded() {
        try {
            const row = await dbService.queryOne("SELECT value FROM settings WHERE key = 'migration_completed'");
            return !row || row.value !== 'true';
        } catch (e) {
            return true;
        }
    }

    async performMigration(data) {
        const txn = dbService.transaction(async () => {
            console.log('⚡ Starting SQLite database migration...');

            // 1. Migrate Users
            if (Array.isArray(data.users)) {
                console.log(`Migrating ${data.users.length} users...`);
                for (const u of data.users) {
                    await dbService.run(
                        "INSERT OR IGNORE INTO users (id, name, pin, role, permissions) VALUES (?, ?, ?, ?, ?)",
                        [u.id, u.name, u.pin, u.role || 'user', JSON.stringify(u.permissions || {})]
                    );
                }
            }

            // 2. Migrate Products
            if (Array.isArray(data.products)) {
                console.log(`Migrating ${data.products.length} products...`);
                for (const p of data.products) {
                    await dbService.run(
                        `INSERT OR IGNORE INTO products (
                            id, barcode, name, category, purchase_price, sale_price, wholesale_price, stock_qty, min_qty, unit, notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [p.id, p.barcode, p.name, p.category, p.purchase_price || 0, p.sale_price || 0, p.wholesale_price || 0, p.stock_qty || 0, p.min_qty || 0, p.unit, p.notes]
                    );
                }
            }

            // 3. Migrate Accounts (Customers & Suppliers)
            if (Array.isArray(data.accounts)) {
                console.log(`Migrating ${data.accounts.length} accounts...`);
                for (const acc of data.accounts) {
                    if (acc.type === 'customer' || acc.type === 'عميل') {
                        await dbService.run(
                            "INSERT OR IGNORE INTO customers (id, name, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            [acc.id, acc.name, acc.phone, acc.email, acc.address, acc.balance || 0, acc.notes]
                        );
                    } else {
                        await dbService.run(
                            "INSERT OR IGNORE INTO suppliers (id, name, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            [acc.id, acc.name, acc.phone, acc.email, acc.address, acc.balance || 0, acc.notes]
                        );
                    }
                }
            }

            // 4. Migrate Invoices & Invoice Items / Purchase Invoices
            if (Array.isArray(data.transactions)) {
                console.log(`Migrating ${data.transactions.length} transactions...`);
                
                // Group invoice items by invoiceId
                const invoiceMap = new Map();
                for (const t of data.transactions) {
                    if (!t.invoiceId) continue;
                    if (!invoiceMap.has(t.invoiceId)) {
                        invoiceMap.set(t.invoiceId, {
                            invoice_no: t.invoiceId,
                            date: t.dateISO || new Date().toISOString().split('T')[0],
                            customer_name: t.partner || 'عميل نقدي',
                            supplier_name: t.partner,
                            type: t.type, // 'sale', 'purchase', etc.
                            payment_type: t.paymentType || 'cash',
                            total: 0,
                            paid: t.paid || 0,
                            remaining: t.remaining || 0,
                            notes: t.notes || '',
                            items: []
                        });
                    }
                    const inv = invoiceMap.get(t.invoiceId);
                    inv.items.push(t);
                    inv.total += (t.price * t.qty);
                }

                // Insert into tables
                for (const [invId, inv] of invoiceMap.entries()) {
                    if (inv.type === 'sale' || inv.type === 'مبيعات' || inv.type === 'بيع 📤') {
                        // Find customer id
                        let custId = null;
                        const cust = await dbService.queryOne("SELECT id FROM customers WHERE name = ?", [inv.customer_name]);
                        if (cust) custId = cust.id;

                        const info = await dbService.run(
                            `INSERT OR IGNORE INTO invoices (
                                invoice_no, customer_id, date, total, discount, tax, final_total, paid, remaining, payment_type, notes
                            ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
                            [inv.invoice_no, custId, inv.date, inv.total, inv.total, inv.paid, inv.remaining, inv.payment_type, inv.notes]
                        );
                        
                        const newInvoiceId = info.lastInsertRowid || invId;

                        for (const item of inv.items) {
                            let prodId = null;
                            const prod = await dbService.queryOne("SELECT id FROM products WHERE name = ? OR barcode = ?", [item.product, item.barcode]);
                            if (prod) prodId = prod.id;
                            if (prodId) {
                                await dbService.run(
                                    "INSERT OR IGNORE INTO invoice_items (invoice_id, product_id, qty, price, discount, total) VALUES (?, ?, ?, ?, 0, ?)",
                                    [newInvoiceId, prodId, item.qty, item.price, item.price * item.qty]
                                );
                            }
                        }
                    } else if (inv.type === 'purchase' || inv.type === 'مشتريات' || inv.type === 'شراء 📥') {
                        // Find supplier id
                        let suppId = null;
                        const supp = await dbService.queryOne("SELECT id FROM suppliers WHERE name = ?", [inv.supplier_name]);
                        if (supp) suppId = supp.id;

                        const info = await dbService.run(
                            `INSERT OR IGNORE INTO purchase_invoices (
                                invoice_no, supplier_id, date, total, discount, tax, final_total, paid, remaining, payment_type, notes
                            ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
                            [inv.invoice_no, suppId, inv.date, inv.total, inv.total, inv.paid, inv.remaining, inv.payment_type, inv.notes]
                        );

                        const newInvoiceId = info.lastInsertRowid || invId;

                        for (const item of inv.items) {
                            let prodId = null;
                            const prod = await dbService.queryOne("SELECT id FROM products WHERE name = ? OR barcode = ?", [item.product, item.barcode]);
                            if (prod) prodId = prod.id;
                            if (prodId) {
                                await dbService.run(
                                    "INSERT OR IGNORE INTO purchase_invoice_items (purchase_invoice_id, product_id, qty, price, total) VALUES (?, ?, ?, ?, ?)",
                                    [newInvoiceId, prodId, item.qty, item.price, item.price * item.qty]
                                );
                            }
                        }
                    }
                }
            }

            // 5. Migrate Settings
            if (data.settings) {
                for (const [key, val] of Object.entries(data.settings)) {
                    await dbService.run(
                        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                        [key, typeof val === 'object' ? JSON.stringify(val) : String(val)]
                    );
                }
            }

            // Mark migration completed
            await dbService.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('migration_completed', 'true')");
            console.log('🎉 Migration completed successfully!');
        });

        try {
            await txn();
            return { success: true };
        } catch (error) {
            console.error('❌ Migration failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new MigrationService();
