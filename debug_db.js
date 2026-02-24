import { query as _query } from './backend/config/db.js';

const BU_ID = 2;
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

async function debug() {
    try {
        const [revs] = await _query('SELECT * FROM revenues WHERE business_unit_id = ?', [BU_ID]);
        console.log('REVENUES for BU 2:', revs);

        const [exps] = await _query('SELECT * FROM expenses WHERE business_unit_id = ?', [BU_ID]);
        console.log('EXPENSES for BU 2:', exps);

        const [monthlyRev] = await _query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND MONTH(date) = ? AND YEAR(date) = ?',
            [BU_ID, currentMonth, currentYear]
        );
        console.log('Monthly Revenue Calculation:', monthlyRev[0].total);

        const [yearlyRev] = await _query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND YEAR(date) = ?',
            [BU_ID, currentYear]
        );
        console.log('Yearly Revenue Calculation:', yearlyRev[0].total);

        const [yearlyExp] = await _query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
            [BU_ID, currentYear]
        );
        console.log('Yearly Expenses Calculation:', yearlyExp[0].total);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

debug();
