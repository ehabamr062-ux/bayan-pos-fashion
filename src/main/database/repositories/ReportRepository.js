const dbService = require('../DatabaseService');

class ReportRepository {
    getDashboardStats(dateFrom, dateTo) {
        const stats = {
            totalSales: 0,
            totalPurchases: 0,
            totalExpenses: 0,
            netProfit: 0,
            treasuryBalance: 0
        };

        // 1. Sales
        const salesRes = dbService.queryOne(`
            SELECT SUM(final_total) as total FROM invoices 
            WHERE date >= ? AND date <= ?
        `, [dateFrom, dateTo]);
        stats.totalSales = salesRes ? (salesRes.total || 0) : 0;

        // 2. Purchases
        const purchasesRes = dbService.queryOne(`
            SELECT SUM(final_total) as total FROM purchase_invoices 
            WHERE date >= ? AND date <= ?
        `, [dateFrom, dateTo]);
        stats.totalPurchases = purchasesRes ? (purchasesRes.total || 0) : 0;

        // 3. Expenses
        const expensesRes = dbService.queryOne(`
            SELECT SUM(amount) as total FROM expenses 
            WHERE date >= ? AND date <= ?
        `, [dateFrom, dateTo]);
        stats.totalExpenses = expensesRes ? (expensesRes.total || 0) : 0;

        // 4. Net Profit calculation: sales total revenue - purchase cost of goods sold - expenses
        // COGS estimation based on sold invoice items
        const cogsRes = dbService.queryOne(`
            SELECT SUM(ii.qty * p.purchase_price) as cost 
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            JOIN products p ON ii.product_id = p.id
            WHERE i.date >= ? AND i.date <= ?
        `, [dateFrom, dateTo]);
        const costOfGoodsSold = cogsRes ? (cogsRes.cost || 0) : 0;
        stats.netProfit = stats.totalSales - costOfGoodsSold - stats.totalExpenses;

        // 5. Treasury Balance
        const treasuryRes = dbService.queryOne(`
            SELECT 
                SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) -
                SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END) as balance
            FROM treasury
        `);
        stats.treasuryBalance = treasuryRes ? (treasuryRes.balance || 0) : 0;

        return stats;
    }

    getDailyMovements(dateFrom, dateTo) {
        return dbService.query(`
            SELECT * FROM daily_movements 
            WHERE date >= ? AND date <= ?
            ORDER BY id DESC
        `, [dateFrom, dateTo]);
    }

    getTreasuryLog(dateFrom, dateTo) {
        return dbService.query(`
            SELECT * FROM treasury 
            WHERE date >= ? AND date <= ?
            ORDER BY id DESC
        `, [dateFrom, dateTo]);
    }

    getSalesAnalytics(dateFrom, dateTo) {
        return dbService.query(`
            SELECT 
                p.name as product_name, 
                SUM(ii.qty) as total_qty, 
                SUM(ii.total) as total_revenue
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            JOIN products p ON ii.product_id = p.id
            WHERE i.date >= ? AND i.date <= ?
            GROUP BY ii.product_id
            ORDER BY total_qty DESC
        `, [dateFrom, dateTo]);
    }
}

module.exports = new ReportRepository();
