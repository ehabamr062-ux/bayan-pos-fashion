const dbService = require('../DatabaseService');

class CustomerRepository {
    // --- Customers ---
    async getAllCustomers({ limit = 50, offset = 0, search = '' } = {}) {
        let sql = 'SELECT * FROM customers';
        let params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR phone LIKE ?';
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam];
        }

        sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return await dbService.query(sql, params);
    }

    async countCustomers(search = '') {
        let sql = 'SELECT COUNT(*) as count FROM customers';
        let params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR phone LIKE ?';
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam];
        }

        const res = await dbService.queryOne(sql, params);
        return res ? res.count : 0;
    }

    async getCustomerById(id) {
        return await dbService.queryOne('SELECT * FROM customers WHERE id = ?', [id]);
    }

    async saveCustomer(customer) {
        const { id, name, phone, email, address, balance, notes } = customer;
        
        let exists = false;
        if (id) {
            const check = await dbService.queryOne('SELECT id FROM customers WHERE id = ?', [id]);
            if (check) exists = true;
        }

        if (id && exists) {
            const sql = `
                UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, balance = ?, notes = ?
                WHERE id = ?
            `;
            await dbService.run(sql, [name, phone, email, address, balance, notes, id]);
            return id;
        } else {
            const sql = `
                INSERT INTO customers (id, name, phone, email, address, balance, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const info = await dbService.run(sql, [id || null, name, phone, email, address, balance || 0, notes]);
            return id || info.lastInsertRowid;
        }
    }

    async deleteCustomer(id) {
        return await dbService.run('DELETE FROM customers WHERE id = ?', [id]);
    }

    async updateCustomerBalance(id, amount) {
        return await dbService.run('UPDATE customers SET balance = balance + ? WHERE id = ?', [amount, id]);
    }

    // --- Suppliers ---
    async getAllSuppliers({ limit = 50, offset = 0, search = '' } = {}) {
        let sql = 'SELECT * FROM suppliers';
        let params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR phone LIKE ?';
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam];
        }

        sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return await dbService.query(sql, params);
    }

    async countSuppliers(search = '') {
        let sql = 'SELECT COUNT(*) as count FROM suppliers';
        let params = [];

        if (search) {
            sql += ' WHERE name LIKE ? OR phone LIKE ?';
            const searchParam = `%${search}%`;
            params = [searchParam, searchParam];
        }

        const res = await dbService.queryOne(sql, params);
        return res ? res.count : 0;
    }

    async getSupplierById(id) {
        return await dbService.queryOne('SELECT * FROM suppliers WHERE id = ?', [id]);
    }

    async saveSupplier(supplier) {
        const { id, name, phone, email, address, balance, notes } = supplier;
        
        let exists = false;
        if (id) {
            const check = await dbService.queryOne('SELECT id FROM suppliers WHERE id = ?', [id]);
            if (check) exists = true;
        }

        if (id && exists) {
            const sql = `
                UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, balance = ?, notes = ?
                WHERE id = ?
            `;
            await dbService.run(sql, [name, phone, email, address, balance, notes, id]);
            return id;
        } else {
            const sql = `
                INSERT INTO suppliers (id, name, phone, email, address, balance, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const info = await dbService.run(sql, [id || null, name, phone, email, address, balance || 0, notes]);
            return id || info.lastInsertRowid;
        }
    }

    async deleteSupplier(id) {
        return await dbService.run('DELETE FROM suppliers WHERE id = ?', [id]);
    }

    async updateSupplierBalance(id, amount) {
        return await dbService.run('UPDATE suppliers SET balance = balance + ? WHERE id = ?', [amount, id]);
    }
}

module.exports = new CustomerRepository();
