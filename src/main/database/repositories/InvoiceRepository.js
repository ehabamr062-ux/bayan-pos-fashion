const dbService = require('../DatabaseService');
const productRepo = require('./ProductRepository');
const customerRepo = require('./CustomerRepository');

class InvoiceRepository {
    // --- Sale Invoices ---
    async createSaleInvoice(invoice, items) {
        const txn = dbService.transaction(async () => {
            const invoiceSql = `
                INSERT INTO invoices (
                    invoice_no, customer_id, date, total, discount, tax, final_total, paid, remaining, payment_type, user_id, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const invoiceParams = [
                invoice.invoice_no, invoice.customer_id, invoice.date, invoice.total, invoice.discount, invoice.tax,
                invoice.final_total, invoice.paid, invoice.remaining, invoice.payment_type, invoice.user_id, invoice.notes
            ];
            const invoiceInfo = await dbService.run(invoiceSql, invoiceParams);
            const invoiceId = invoiceInfo.lastInsertRowid;

            const itemSql = `
                INSERT INTO invoice_items (invoice_id, product_id, qty, price, discount, total)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            for (const item of items) {
                await dbService.run(itemSql, [
                    invoiceId, item.product_id, item.qty, item.price, item.discount || 0, item.total
                ]);

                await productRepo.updateStock(item.product_id, item.qty, 'OUT', 'sale', invoiceId, invoice.user_id);
            }

            if (invoice.payment_type === 'credit' && invoice.customer_id && invoice.remaining > 0) {
                await customerRepo.updateCustomerBalance(invoice.customer_id, invoice.remaining);
            }

            if (invoice.paid > 0) {
                await dbService.run(`
                    INSERT INTO treasury (type, amount, date, source, reference_id, notes, user_id)
                    VALUES ('deposit', ?, ?, 'sale_invoice', ?, ?, ?)
                `, [invoice.paid, invoice.date, invoiceId, `دفعة من فاتورة بيع رقم ${invoice.invoice_no}`, invoice.user_id]);
            }

            await dbService.run(`
                INSERT INTO daily_movements (action_type, description, amount, date, user_id)
                VALUES ('sale', ?, ?, ?, ?)
            `, [`فاتورة بيع رقم ${invoice.invoice_no}`, invoice.final_total, invoice.date, invoice.user_id]);

            return invoiceId;
        });

        return txn();
    }

    async getSaleInvoice(id) {
        return dbService.queryOne('SELECT * FROM invoices WHERE id = ?', [id]);
    }

    async getSaleInvoiceItems(invoiceId) {
        return dbService.query(`
            SELECT ii.*, p.name as product_name, p.barcode as product_barcode 
            FROM invoice_items ii 
            JOIN products p ON ii.product_id = p.id 
            WHERE ii.invoice_id = ?
        `, [invoiceId]);
    }

    async querySaleInvoices({ limit = 50, offset = 0, search = '', dateFrom = '', dateTo = '' } = {}) {
        let sql = `
            SELECT i.*, c.name as customer_name 
            FROM invoices i 
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ' AND (i.invoice_no LIKE ? OR c.name LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam);
        }

        if (dateFrom) {
            sql += ' AND i.date >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            sql += ' AND i.date <= ?';
            params.push(dateTo);
        }

        sql += ' ORDER BY i.id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return dbService.query(sql, params);
    }

    async countSaleInvoices({ search = '', dateFrom = '', dateTo = '' } = {}) {
        let sql = `
            SELECT COUNT(*) as count 
            FROM invoices i 
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ' AND (i.invoice_no LIKE ? OR c.name LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam);
        }

        if (dateFrom) {
            sql += ' AND i.date >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            sql += ' AND i.date <= ?';
            params.push(dateTo);
        }

        const res = await dbService.queryOne(sql, params);
        return res ? res.count : 0;
    }

    // --- Purchase Invoices ---
    async createPurchaseInvoice(invoice, items) {
        const txn = dbService.transaction(async () => {
            const invoiceSql = `
                INSERT INTO purchase_invoices (
                    invoice_no, supplier_id, date, total, discount, tax, final_total, paid, remaining, payment_type, user_id, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const invoiceParams = [
                invoice.invoice_no, invoice.supplier_id, invoice.date, invoice.total, invoice.discount, invoice.tax,
                invoice.final_total, invoice.paid, invoice.remaining, invoice.payment_type, invoice.user_id, invoice.notes
            ];
            const invoiceInfo = await dbService.run(invoiceSql, invoiceParams);
            const invoiceId = invoiceInfo.lastInsertRowid;

            const itemSql = `
                INSERT INTO purchase_invoice_items (purchase_invoice_id, product_id, qty, price, total)
                VALUES (?, ?, ?, ?, ?)
            `;
            for (const item of items) {
                await dbService.run(itemSql, [
                    invoiceId, item.product_id, item.qty, item.price, item.total
                ]);

                await productRepo.updateStock(item.product_id, item.qty, 'IN', 'purchase', invoiceId, invoice.user_id);
            }

            if (invoice.payment_type === 'credit' && invoice.supplier_id && invoice.remaining > 0) {
                await customerRepo.updateSupplierBalance(invoice.supplier_id, invoice.remaining);
            }

            if (invoice.paid > 0) {
                await dbService.run(`
                    INSERT INTO treasury (type, amount, date, source, reference_id, notes, user_id)
                    VALUES ('withdraw', ?, ?, 'purchase_invoice', ?, ?, ?)
                `, [invoice.paid, invoice.date, invoiceId, `سداد فاتورة شراء رقم ${invoice.invoice_no}`, invoice.user_id]);
            }

            await dbService.run(`
                INSERT INTO daily_movements (action_type, description, amount, date, user_id)
                VALUES ('purchase', ?, ?, ?, ?)
            `, [`فاتورة شراء رقم ${invoice.invoice_no}`, invoice.final_total, invoice.date, invoice.user_id]);

            return invoiceId;
        });

        return txn();
    }

    async getPurchaseInvoice(id) {
        return dbService.queryOne('SELECT * FROM purchase_invoices WHERE id = ?', [id]);
    }

    async getPurchaseInvoiceItems(invoiceId) {
        return dbService.query(`
            SELECT pii.*, p.name as product_name, p.barcode as product_barcode 
            FROM purchase_invoice_items pii 
            JOIN products p ON pii.product_id = p.id 
            WHERE pii.purchase_invoice_id = ?
        `, [invoiceId]);
    }

    async queryPurchaseInvoices({ limit = 50, offset = 0, search = '', dateFrom = '', dateTo = '' } = {}) {
        let sql = `
            SELECT pi.*, s.name as supplier_name 
            FROM purchase_invoices pi 
            LEFT JOIN suppliers s ON pi.supplier_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ' AND (pi.invoice_no LIKE ? OR s.name LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam);
        }

        if (dateFrom) {
            sql += ' AND pi.date >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            sql += ' AND pi.date <= ?';
            params.push(dateTo);
        }

        sql += ' ORDER BY pi.id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return dbService.query(sql, params);
    }
}

module.exports = new InvoiceRepository();
