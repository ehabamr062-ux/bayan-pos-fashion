const dbService = require('../DatabaseService');

class ProductRepository {
    async getAll({ limit = 50, offset = 0, search = '' } = {}) {
        let sql = 'SELECT * FROM products';
        let params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR barcode LIKE ? OR category LIKE ?';
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam, searchParam];
        }

        sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const rows = await dbService.query(sql, params);
        return rows.map(row => ({
            ...row,
            cost: row.purchase_price,
            price: row.sale_price,
            wholesale: row.wholesale_price,
            stock: row.stock_qty,
            minStock: row.min_qty,
            isQuick: row.is_quick === 1
        }));
    }

    async count(search = '') {
        let sql = 'SELECT COUNT(*) as count FROM products';
        let params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR barcode LIKE ? OR category LIKE ?';
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam, searchParam];
        }

        const res = await dbService.queryOne(sql, params);
        return res ? res.count : 0;
    }

    async getById(id) {
        const row = await dbService.queryOne('SELECT * FROM products WHERE id = ?', [id]);
        return row ? {
            ...row,
            cost: row.purchase_price,
            price: row.sale_price,
            wholesale: row.wholesale_price,
            stock: row.stock_qty,
            minStock: row.min_qty,
            isQuick: row.is_quick === 1
        } : null;
    }

    async getByBarcode(barcode) {
        const row = await dbService.queryOne('SELECT * FROM products WHERE barcode = ?', [barcode]);
        return row ? {
            ...row,
            cost: row.purchase_price,
            price: row.sale_price,
            wholesale: row.wholesale_price,
            stock: row.stock_qty,
            minStock: row.min_qty,
            isQuick: row.is_quick === 1
        } : null;
    }

    async save(product) {
        const id = product.id;
        const barcode = product.barcode;
        const name = product.name;
        const category = product.category;
        const purchase_price = product.purchase_price !== undefined ? product.purchase_price : product.cost;
        const sale_price = product.sale_price !== undefined ? product.sale_price : product.price;
        const wholesale_price = product.wholesale_price !== undefined ? product.wholesale_price : product.wholesale;
        const stock_qty = product.stock_qty !== undefined ? product.stock_qty : product.stock;
        const min_qty = product.min_qty !== undefined ? product.min_qty : product.minStock;
        const unit = product.unit;
        const supplier_id = product.supplier_id;
        const notes = product.notes;
        const is_quick = product.isQuick ? 1 : 0;

        let exists = false;
        if (id) {
            const check = await dbService.queryOne('SELECT id FROM products WHERE id = ?', [id]);
            if (check) exists = true;
        }

        if (id && exists) {
            const sql = `
                UPDATE products SET 
                    barcode = ?, name = ?, category = ?, purchase_price = ?, 
                    sale_price = ?, wholesale_price = ?, stock_qty = ?, 
                    min_qty = ?, unit = ?, supplier_id = ?, notes = ?, is_quick = ?
                WHERE id = ?
            `;
            const params = [
                barcode, name, category, purchase_price, sale_price,
                wholesale_price, stock_qty, min_qty, unit, supplier_id, notes, is_quick, id
            ];
            await dbService.run(sql, params);
            return id;
        } else {
            const sql = `
                INSERT INTO products (
                    id, barcode, name, category, purchase_price, sale_price,
                    wholesale_price, stock_qty, min_qty, unit, supplier_id, notes, is_quick
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                id || null, barcode, name, category, purchase_price, sale_price,
                wholesale_price, stock_qty, min_qty, unit, supplier_id, notes, is_quick
            ];
            const info = await dbService.run(sql, params);
            return id || info.lastInsertRowid;
        }
    }

    async delete(id) {
        return dbService.run('DELETE FROM products WHERE id = ?', [id]);
    }

    async updateStock(productId, qty, type, reference = '', referenceId = null, userId = null) {
        const txn = dbService.transaction(async () => {
            const prod = await dbService.queryOne('SELECT stock_qty FROM products WHERE id = ?', [productId]);
            if (!prod) throw new Error(`Product not found: ${productId}`);

            let newQty = prod.stock_qty;
            if (type === 'IN') {
                newQty += qty;
            } else if (type === 'OUT') {
                newQty -= qty;
            } else if (type === 'ADJUST') {
                newQty = qty;
            }

            await dbService.run('UPDATE products SET stock_qty = ? WHERE id = ?', [newQty, productId]);

            await dbService.run(`
                INSERT INTO stock_movements (product_id, qty, type, reference, reference_id, date, user_id)
                VALUES (?, ?, ?, ?, ?, date('now', 'localtime'), ?)
            `, [productId, qty, type, reference, referenceId, userId]);
        });

        await txn();
        return true;
    }
}

module.exports = new ProductRepository();
