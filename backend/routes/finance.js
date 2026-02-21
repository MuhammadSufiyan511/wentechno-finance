import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { logAudit } from '../middleware/auditTrail.js';
import { validate } from '../middleware/validator.js';
import { body } from 'express-validator';
import { runRecurringBilling } from '../utils/recurringBilling.js';

const router = Router();

// ============ BANK ACCOUNTS ============

router.get('/bank-accounts', auth, async (req, res, next) => {
    try {
        const [accounts] = await _query('SELECT * FROM bank_accounts WHERE is_active = TRUE');
        res.json({ success: true, data: accounts });
    } catch (error) {
        next(error);
    }
});

router.post('/bank-accounts', auth, [
    body('name').notEmpty(),
    body('business_unit_id').isInt(),
    body('type').isIn(['bank', 'cash', 'mobile_wallet'])
], async (req, res, next) => {
    try {
        const { business_unit_id, name, account_number, bank_name, type, currency, balance } = req.body;
        const [result] = await _query(
            'INSERT INTO bank_accounts (business_unit_id, name, account_number, bank_name, type, currency, balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [business_unit_id, name, account_number, bank_name, type, currency || 'PKR', balance || 0]
        );
        res.json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        next(error);
    }
});

// ============ BUDGETING ============

router.get('/budgets', auth, async (req, res, next) => {
    try {
        const { bu_id, year, month } = req.query;
        let sql = 'SELECT * FROM budgets WHERE 1=1';
        const params = [];

        if (bu_id) { sql += ' AND business_unit_id = ?'; params.push(bu_id); }
        if (year) { sql += ' AND year = ?'; params.push(year); }
        if (month) { sql += ' AND month = ?'; params.push(month); }

        const [budgets] = await _query(sql, params);
        res.json({ success: true, data: budgets });
    } catch (error) {
        next(error);
    }
});

router.post('/budgets', auth, async (req, res, next) => {
    try {
        const { business_unit_id, category, planned_amount, month, year, notes } = req.body;
        const [result] = await _query(
            'INSERT INTO budgets (business_unit_id, category, planned_amount, month, year, notes) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE planned_amount = VALUES(planned_amount), notes = VALUES(notes)',
            [business_unit_id, category, planned_amount, month, year, notes]
        );
        res.json({ success: true, data: { id: result.insertId || null, message: 'Budget saved' } });
    } catch (error) {
        next(error);
    }
});

// ============ CASHFLOW FORECAST (HEURISTIC) ============

router.get('/cashflow/forecast', auth, async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 30;

        // 1. Current liquidity
        const [[{ total_balance }]] = await _query('SELECT SUM(balance) as total_balance FROM bank_accounts WHERE is_active = TRUE');

        // 2. Expected Revenue (AR)
        const [[{ pending_revenue }]] = await _query(
            'SELECT SUM(total_amount - paid_amount) as pending_revenue FROM projects WHERE status = "active" AND (total_amount - paid_amount) > 0'
        );

        // 3. Expected Expenses (AP) - Placeholder logic
        const [[{ pending_expenses }]] = await _query(
            'SELECT SUM(amount) as pending_expenses FROM expenses WHERE approval_status = "pending"'
        );

        // 4. Recurring (Subscriptions)
        const [[{ subscription_revenue }]] = await _query(
            'SELECT SUM(amount) as subscription_revenue FROM subscriptions WHERE status = "active"'
        );

        const net_position = parseFloat(total_balance || 0) + parseFloat(pending_revenue || 0) + (parseFloat(subscription_revenue || 0) * (days / 30)) - parseFloat(pending_expenses || 0);

        res.json({
            success: true,
            data: {
                current_liquidity: total_balance || 0,
                accounts_receivable: pending_revenue || 0,
                accounts_payable: pending_expenses || 0,
                recurring_monthly: subscription_revenue || 0,
                projected_position: net_position,
                period_days: days
            }
        });
    } catch (error) {
        next(error);
    }
});

// ============ TAX MODULE ============

router.get('/taxes', auth, async (req, res, next) => {
    try {
        const [taxes] = await _query('SELECT * FROM tax_configs WHERE is_active = TRUE');
        res.json({ success: true, data: taxes });
    } catch (error) {
        next(error);
    }
});

router.post('/taxes', auth, async (req, res, next) => {
    try {
        const { business_unit_id, name, rate, type } = req.body;
        const [result] = await _query(
            'INSERT INTO tax_configs (business_unit_id, name, rate, type) VALUES (?, ?, ?, ?)',
            [business_unit_id, name, rate, type]
        );
        res.json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        next(error);
    }
});

// ============ SCENARIO PLANNING ============

router.get('/scenarios', auth, async (req, res, next) => {
    try {
        const [scenarios] = await _query('SELECT s.*, u.full_name as creator FROM scenarios s LEFT JOIN users u ON s.created_by = u.id');
        res.json({ success: true, data: scenarios });
    } catch (error) {
        next(error);
    }
});

router.post('/scenarios', auth, async (req, res, next) => {
    try {
        const { name, description, items } = req.body;
        const [result] = await _query('INSERT INTO scenarios (name, description, created_by) VALUES (?, ?, ?)', [name, description, req.user.id]);
        const scenarioId = result.insertId;

        if (items && items.length > 0) {
            const values = items.map(i => [scenarioId, i.type, i.category, i.amount, i.projected_date]);
            await _query('INSERT INTO scenario_items (scenario_id, type, category, amount, projected_date) VALUES ?', [values]);
        }

        res.json({ success: true, data: { id: scenarioId } });
    } catch (error) {
        next(error);
    }
});

// ============ RECONCILIATION ============

router.post('/reconciliation', auth, async (req, res, next) => {
    try {
        const { bank_account_id, statement_date, statement_balance, transactions } = req.body;

        // 1. Get current system balance
        const [[{ balance: system_balance }]] = await _query('SELECT balance FROM bank_accounts WHERE id = ?', [bank_account_id]);

        // 2. Logic to verify transactions (simplified)
        const [result] = await _query(
            'INSERT INTO reconciliations (bank_account_id, statement_date, statement_balance, system_balance, status, reconciled_by, reconciled_at) VALUES (?, ?, ?, ?, "completed", ?, NOW())',
            [bank_account_id, statement_date, statement_balance, system_balance, req.user.id]
        );

        res.json({ success: true, data: { id: result.insertId, message: 'Reconciliation completed' } });
    } catch (error) {
        next(error);
    }
});

// ============ AR/AP AGING ============

router.get('/aging', auth, async (req, res, next) => {
    try {
        const { type } = req.query; // 'ar' or 'ap'
        let data = [];

        if (type === 'ar') {
            [data] = await _query(`
        SELECT 
          client_id, 
          c.name as client_name,
          SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN total_amount - IFNULL(paid_amount, 0) ELSE 0 END) as 'current',
          SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN total_amount - IFNULL(paid_amount, 0) ELSE 0 END) as '31_60',
          SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90 THEN total_amount - IFNULL(paid_amount, 0) ELSE 0 END) as '61_90',
          SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 90 THEN total_amount - IFNULL(paid_amount, 0) ELSE 0 END) as '90_plus'
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        WHERE i.status != 'paid'
        GROUP BY client_id, c.name
      `);
        } else {
            [data] = await _query(`
        SELECT 
          vendor,
          SUM(CASE WHEN DATEDIFF(CURDATE(), date) <= 30 THEN amount ELSE 0 END) as 'current',
          SUM(CASE WHEN DATEDIFF(CURDATE(), date) BETWEEN 31 AND 60 THEN amount ELSE 0 END) as '31_60',
          SUM(CASE WHEN DATEDIFF(CURDATE(), date) BETWEEN 61 AND 90 THEN amount ELSE 0 END) as '61_90',
          SUM(CASE WHEN DATEDIFF(CURDATE(), date) > 90 THEN amount ELSE 0 END) as '90_plus'
        FROM expenses
        WHERE approval_status = 'approved' AND payment_method = 'cheque' -- Simple proxy for payable
        GROUP BY vendor
      `);
        }

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// ============ PROFITABILITY ANALYSIS ============

router.get('/profitability', auth, async (req, res, next) => {
    try {
        const { bu_id } = req.query;

        // Profit by Category for a specific BU or all
        const [data] = await _query(`
      SELECT 
        category,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net_profit
      FROM transactions
      WHERE 1=1 ${bu_id ? 'AND business_unit_id = ?' : ''}
      GROUP BY category
      ORDER BY net_profit DESC
    `, bu_id ? [bu_id] : []);

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// ============ RECURRING BILLING ============

router.post('/recurring/run', auth, async (req, res, next) => {
    try {
        const results = await runRecurringBilling();
        res.json({ success: true, data: results });
    } catch (error) {
        next(error);
    }
});

export default router;
