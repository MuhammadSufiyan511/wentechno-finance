import { query as _query } from './config/db.js';

const BU_ID = 2;
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

async function debug() {
    try {
        const [monthlyGross] = await _query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND MONTH(date) = ? AND YEAR(date) = ? AND amount > 0 AND category != 'Sales Returns'",
            [BU_ID, currentMonth, currentYear]
        );

        const [monthlyReturns] = await _query(
            "SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM revenues WHERE business_unit_id = ? AND MONTH(date) = ? AND YEAR(date) = ? AND (amount < 0 OR category = 'Sales Returns')",
            [BU_ID, currentMonth, currentYear]
        );

        const [yearlyGross] = await _query(
            "SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND YEAR(date) = ? AND amount > 0 AND category != 'Sales Returns'",
            [BU_ID, currentYear]
        );

        const [yearlyReturns] = await _query(
            "SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM revenues WHERE business_unit_id = ? AND YEAR(date) = ? AND (amount < 0 OR category = 'Sales Returns')",
            [BU_ID, currentYear]
        );

        const [yearlyExpenses] = await _query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
            [BU_ID, currentYear]
        );

        const netProfit = yearlyGross[0].total - yearlyReturns[0].total - yearlyExpenses[0].total;
        const profitMargin = yearlyGross[0].total > 0 ? ((netProfit / yearlyGross[0].total) * 100).toFixed(1) : 0;

        console.log('--- FIXED CALCULATIONS ---');
        console.log('Monthly Gross Revenue:', monthlyGross[0].total);
        console.log('Monthly Returns:', monthlyReturns[0].total);
        console.log('Yearly Gross Revenue:', yearlyGross[0].total);
        console.log('Yearly Returns:', yearlyReturns[0].total);
        console.log('Yearly Expenses:', yearlyExpenses[0].total);
        console.log('Net Profit:', netProfit);
        console.log('Profit Margin:', profitMargin);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

debug();
