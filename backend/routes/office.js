import { Router } from 'express';
import { query as _query } from '../config/db.js';
import PDFDocument from 'pdfkit';
import auth from '../middleware/auth.js';
import { logAudit } from '../middleware/auditTrail.js';
import { checkPeriodClose } from '../middleware/checkPeriodClose.js';
import { approvalRequired } from '../middleware/approvalRequired.js';
import { validate, transactionRules, salaryRules } from '../middleware/validator.js';
import { monthToNumber } from '../utils/dateUtils.js';

const router = Router();
const BU_ID = 6;
const MODULE = 'office_expenses';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let officeTablesReady = false;
const ensureOfficeTables = async () => {
  if (officeTablesReady) return;
  await _query(`
    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id INT PRIMARY KEY AUTO_INCREMENT,
      business_unit_id INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      sub_category VARCHAR(100),
      expense_type ENUM('fixed','variable','one-time') DEFAULT 'fixed',
      amount DECIMAL(15,2) NOT NULL,
      description TEXT,
      vendor VARCHAR(100),
      payment_method ENUM('cash','bank_transfer','card','online','cheque') DEFAULT 'cash',
      day_of_month INT NOT NULL DEFAULT 1,
      start_date DATE NOT NULL,
      end_date DATE NULL,
      is_active BOOLEAN DEFAULT TRUE,
      last_generated_month INT NULL,
      last_generated_year INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await _query(`
    CREATE TABLE IF NOT EXISTS office_expense_attachments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      expense_id INT NOT NULL,
      file_name VARCHAR(255),
      file_url TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    )
  `);
  officeTablesReady = true;
};

const insertExpenseCompat = async (paramsWithApproval, paramsWithoutApproval) => {
  try {
    return await _query(
      `INSERT INTO expenses (
        business_unit_id, category, sub_category, expense_type, amount,
        description, vendor, receipt_number, payment_method, date, approval_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      paramsWithApproval
    );
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR' && String(error?.sqlMessage || '').includes('approval_status')) {
      return await _query(
        `INSERT INTO expenses (
          business_unit_id, category, sub_category, expense_type, amount,
          description, vendor, receipt_number, payment_method, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        paramsWithoutApproval
      );
    }
    throw error;
  }
};

const withExpenseFilters = ({ query, params, req }) => {
  const {
    year, month, category, expense_type, approval_status, vendor,
    search, min_amount, max_amount, from_date, to_date
  } = req.query;

  if (year) { query += ' AND YEAR(date) = ?'; params.push(Number(year)); }
  const monthNum = monthToNumber(month);
  if (monthNum) { query += ' AND MONTH(date) = ?'; params.push(monthNum); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (expense_type) { query += ' AND expense_type = ?'; params.push(expense_type); }
  if (approval_status) { query += ' AND approval_status = ?'; params.push(approval_status); }
  if (vendor) { query += ' AND vendor = ?'; params.push(vendor); }
  if (from_date) { query += ' AND date >= ?'; params.push(from_date); }
  if (to_date) { query += ' AND date <= ?'; params.push(to_date); }
  if (min_amount) { query += ' AND amount >= ?'; params.push(Number(min_amount)); }
  if (max_amount) { query += ' AND amount <= ?'; params.push(Number(max_amount)); }
  if (search) {
    query += ' AND (category LIKE ? OR description LIKE ? OR vendor LIKE ? OR receipt_number LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  return { query, params };
};

const runRecurringGeneration = async (userId, ip, userAgent) => {
  await ensureOfficeTables();
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const day = today.getDate();

  const [rules] = await _query(
    `SELECT * FROM recurring_expenses
     WHERE business_unit_id = ? AND is_active = 1
       AND start_date <= CURDATE()
       AND (end_date IS NULL OR end_date >= CURDATE())
       AND day_of_month <= ?`,
    [BU_ID, day]
  );

  let generated = 0;
  for (const rule of rules) {
    if (rule.last_generated_month === month && rule.last_generated_year === year) continue;

    const [existing] = await _query(
      `SELECT id FROM expenses
       WHERE business_unit_id = ? AND category = ? AND COALESCE(sub_category, '') = COALESCE(?, '')
         AND COALESCE(vendor, '') = COALESCE(?, '')
         AND YEAR(date) = ? AND MONTH(date) = ?
         AND description LIKE ?`,
      [BU_ID, rule.category, rule.sub_category, rule.vendor, year, month, `%[RecurringRule#${rule.id}]%`]
    );
    if (existing.length) {
      await _query(
        'UPDATE recurring_expenses SET last_generated_month = ?, last_generated_year = ? WHERE id = ?',
        [month, year, rule.id]
      );
      continue;
    }

    const description = `${rule.description || rule.category} [RecurringRule#${rule.id}]`;
    await insertExpenseCompat(
      [
        BU_ID, rule.category, rule.sub_category, rule.expense_type, rule.amount,
        description, rule.vendor, null, rule.payment_method, today.toISOString().slice(0, 10), 'na'
      ],
      [
        BU_ID, rule.category, rule.sub_category, rule.expense_type, rule.amount,
        description, rule.vendor, null, rule.payment_method, today.toISOString().slice(0, 10)
      ]
    );

    await _query(
      'UPDATE recurring_expenses SET last_generated_month = ?, last_generated_year = ? WHERE id = ?',
      [month, year, rule.id]
    );
    generated += 1;
  }

  if (generated > 0) {
    await logAudit({
      userId,
      action: 'create',
      module: `${MODULE}_recurring_run`,
      newValues: { generated },
      ipAddress: ip,
      userAgent
    });
  }

  return generated;
};

const parseBudgetPeriod = (monthValue, yearValue, fallbackDate = new Date()) => {
  const month = monthToNumber(monthValue) || (fallbackDate.getMonth() + 1);
  const year = Number(yearValue || fallbackDate.getFullYear());
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) return null;
  return { month, year };
};

const isBudgetPeriodClosed = async (month, year) => {
  const [closed] = await _query(
    'SELECT id FROM period_closes WHERE year = ? AND month = ? AND status = "closed" LIMIT 1',
    [year, month]
  );
  return closed.length > 0;
};

const resolveReportRange = (query) => {
  const { from, to } = query;
  if (from || to) {
    return { from: from || null, to: to || null };
  }

  const period = parseBudgetPeriod(query.month, query.year);
  if (!period) return null;
  const { month, year } = period;
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
  };
};

// GET /api/office/overview
router.get('/overview', auth, async (req, res, next) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const previousMonthDate = new Date(currentYear, currentMonth - 2, 1);
    const previousMonth = previousMonthDate.getMonth() + 1;
    const previousMonthYear = previousMonthDate.getFullYear();

    const [monthlyExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND MONTH(date) = ? AND YEAR(date) = ?',
      [BU_ID, currentMonth, currentYear]
    );
    const [yearlyExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );
    const [previousMonthlyExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND MONTH(date) = ? AND YEAR(date) = ?',
      [BU_ID, previousMonth, previousMonthYear]
    );
    const [fixedCosts] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND expense_type = "fixed" AND MONTH(date) = ? AND YEAR(date) = ?',
      [BU_ID, currentMonth, currentYear]
    );
    const [employeeCountRows] = await _query(
      'SELECT COUNT(DISTINCT employee_name) as total FROM salaries WHERE business_unit_id = ? AND year = ?',
      [BU_ID, currentYear]
    );
    const [approvalStats] = await _query(
      `SELECT
        SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN approval_status IN ('approved', 'pending', 'rejected') THEN 1 ELSE 0 END) as actionable_count
       FROM expenses
       WHERE business_unit_id = ? AND YEAR(date) = ?`,
      [BU_ID, currentYear]
    );
    const [pendingApprovals] = await _query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses WHERE business_unit_id = ? AND approval_status = 'pending'`,
      [BU_ID]
    );
    const [approvedExpenses] = await _query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses WHERE business_unit_id = ? AND approval_status IN ('approved', 'na')`,
      [BU_ID]
    );
    const [byCategory] = await _query(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE business_unit_id = ?
         AND date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY category ORDER BY total DESC`,
      [BU_ID]
    );
    const [topVendors] = await _query(
      `SELECT COALESCE(vendor, 'Unassigned') as vendor, COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE business_unit_id = ?
         AND date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY vendor
       ORDER BY total DESC
       LIMIT 5`,
      [BU_ID]
    );
    const [monthlyTrend] = await _query(
      `SELECT DATE_FORMAT(date, '%Y-%m') as period, COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE business_unit_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(date, '%Y-%m')
       ORDER BY period`,
      [BU_ID]
    );
    const [salaryExpenses] = await _query(
      `SELECT COALESCE(SUM(base_salary + bonus - deductions), 0) as total
       FROM salaries
       WHERE business_unit_id = ? AND year = ?`,
      [BU_ID, currentYear]
    );
    const [budgetVariance] = await _query(
      `SELECT
        b.category,
        b.planned_amount,
        COALESCE(SUM(e.amount), 0) as actual_amount,
        (b.planned_amount - COALESCE(SUM(e.amount), 0)) as variance
      FROM budgets b
      LEFT JOIN expenses e
        ON e.business_unit_id = b.business_unit_id
        AND e.category = b.category
        AND MONTH(e.date) = b.month
        AND YEAR(e.date) = b.year
      WHERE b.business_unit_id = ? AND b.month = ? AND b.year = ?
      GROUP BY b.id, b.category, b.planned_amount
      ORDER BY b.category`,
      [BU_ID, currentMonth, currentYear]
    );

    const monthly = Number(monthlyExpenses[0].total || 0);
    const previousMonthly = Number(previousMonthlyExpenses[0].total || 0);
    const pending = Number(pendingApprovals[0].total || 0);
    const approved = Number(approvedExpenses[0].total || 0);
    const burnRate = monthly;
    const burnTrendPercent = previousMonthly > 0
      ? Number((((monthly - previousMonthly) / previousMonthly) * 100).toFixed(2))
      : (monthly > 0 ? 100 : 0);
    const complianceRate = Number(approvalStats[0]?.actionable_count || 0) > 0
      ? Number((((Number(approvalStats[0]?.approved_count || 0)) / Number(approvalStats[0]?.actionable_count || 0)) * 100).toFixed(2))
      : 100;
    const utilization = budgetVariance.reduce((acc, row) => {
      acc.planned += Number(row.planned_amount || 0);
      acc.actual += Number(row.actual_amount || 0);
      return acc;
    }, { planned: 0, actual: 0 });
    const burnTrend = monthlyTrend.map(row => ({
      month: row.period,
      total: Number(row.total || 0)
    }));

    res.json({
      success: true,
      data: {
        totalMonthly: monthly,
        fixedCosts: Number(fixedCosts[0].total || 0),
        totalSalaries: Number(salaryExpenses[0].total || 0),
        employeeCount: Number(employeeCountRows[0].total || 0),
        approvalRate: complianceRate,
        burnTrend,
        burnTrendPercent,
        categoryBreakdown: byCategory,
        monthlyExpenses: monthly,
        yearlyExpenses: Number(yearlyExpenses[0].total || 0),
        pendingApprovalsAmount: pending,
        pendingApprovalsCount: Number(pendingApprovals[0].count || 0),
        approvedExpensesAmount: approved,
        salaryExpenses: Number(salaryExpenses[0].total || 0),
        burnRate,
        budgetPlanned: utilization.planned,
        budgetActual: utilization.actual,
        budgetVariance: utilization.planned - utilization.actual,
        byCategory,
        topVendors,
        monthlyTrend,
        budgetVarianceByCategory: budgetVariance
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET expenses list
router.get('/expenses', auth, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM expenses WHERE business_unit_id = ?';
    let params = [BU_ID];
    ({ query, params } = withExpenseFilters({ query, params, req }));
    query += ' ORDER BY date DESC, id DESC';
    const [expenses] = await _query(query, params);
    res.json({ success: true, data: expenses });
  } catch (error) {
    next(error);
  }
});

router.post('/expenses', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, sub_category, expense_type, amount, description, vendor, receipt_number, payment_method, date } = req.body;
    const parsedAmount = Number(amount);
    const approvalStatus = 'pending';
    if (!(parsedAmount > 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be positive' });
    }
    if (parsedAmount >= 50000 && !receipt_number) {
      return res.status(400).json({ success: false, message: 'Receipt number is required for high-value expenses (>= 50,000)' });
    }

    const [result] = await insertExpenseCompat(
      [
        BU_ID, category, sub_category, expense_type || 'fixed', parsedAmount, description,
        vendor, receipt_number, payment_method || 'cash', date, approvalStatus
      ],
      [
        BU_ID, category, sub_category, expense_type || 'fixed', parsedAmount, description,
        vendor, receipt_number, payment_method || 'cash', date
      ]
    );

    await _query(
      'INSERT INTO approvals (entity_type, entity_id, requested_by, status, comments) VALUES (?, ?, ?, ?, ?)',
      ['expense', result.insertId, req.user.id, 'pending', req.approvalReason || 'Office expense requires approval']
    );

    const [exp] = await _query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: MODULE,
      entityId: result.insertId,
      newValues: exp[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(201).json({ success: true, data: exp[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/expenses/:id', auth, checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldExp] = await _query('SELECT * FROM expenses WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);
    if (oldExp.length === 0) return res.status(404).json({ success: false, message: 'Expense not found' });

    const fields = { ...req.body };
    if (req.approvalStatus) fields.approval_status = req.approvalStatus;

    if (fields.amount !== undefined) {
      const parsedAmount = Number(fields.amount);
      if (!(parsedAmount > 0)) return res.status(400).json({ success: false, message: 'Amount must be positive' });
      fields.amount = parsedAmount;
      const nextReceipt = fields.receipt_number ?? oldExp[0].receipt_number;
      if (parsedAmount >= 50000 && !nextReceipt) {
        return res.status(400).json({ success: false, message: 'Receipt number is required for high-value expenses (>= 50,000)' });
      }
    }

    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    if (!updates) return res.status(400).json({ success: false, message: 'No fields provided for update' });

    await _query(`UPDATE expenses SET ${updates} WHERE id = ? AND business_unit_id = ?`, [...values, id, BU_ID]);

    if (req.requiresApproval) {
      const [existing] = await _query(
        'SELECT id FROM approvals WHERE entity_type = "expense" AND entity_id = ? AND status = "pending"',
        [id]
      );
      if (existing.length === 0) {
        await _query(
          'INSERT INTO approvals (entity_type, entity_id, requested_by, status, comments) VALUES (?, ?, ?, ?, ?)',
          ['expense', id, req.user.id, 'pending', req.approvalReason]
        );
      }
    }

    const [newExp] = await _query('SELECT * FROM expenses WHERE id = ?', [id]);
    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: MODULE,
      entityId: id,
      oldValues: oldExp[0],
      newValues: newExp[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: newExp[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/expenses/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldExp] = await _query('SELECT * FROM expenses WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);
    if (oldExp.length === 0) return res.status(404).json({ success: false, message: 'Expense not found' });

    await ensureOfficeTables();
    await _query('DELETE FROM office_expense_attachments WHERE expense_id = ?', [id]);
    await _query('DELETE FROM approvals WHERE entity_type = "expense" AND entity_id = ?', [id]);
    await _query('DELETE FROM expenses WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      module: MODULE,
      entityId: id,
      oldValues: oldExp[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    next(error);
  }
});

router.get('/expenses/:id/attachments', auth, async (req, res, next) => {
  try {
    await ensureOfficeTables();
    const { id } = req.params;
    const [rows] = await _query(
      'SELECT * FROM office_expense_attachments WHERE expense_id = ? ORDER BY created_at DESC',
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/expenses/:id/attachments', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensureOfficeTables();
    const { id } = req.params;
    const { file_name, file_url, notes } = req.body;
    if (!file_url) return res.status(400).json({ success: false, message: 'file_url is required' });

    const [exp] = await _query('SELECT id FROM expenses WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);
    if (!exp.length) return res.status(404).json({ success: false, message: 'Expense not found' });

    await _query(
      'INSERT INTO office_expense_attachments (expense_id, file_name, file_url, notes) VALUES (?, ?, ?, ?)',
      [id, file_name || null, file_url, notes || null]
    );
    res.status(201).json({ success: true, message: 'Attachment added' });
  } catch (error) {
    next(error);
  }
});

// --- APPROVALS FOR OFFICE ---
router.get('/approvals', auth, async (req, res, next) => {
  try {
    const [rows] = await _query(`
      SELECT a.*, a.status AS approval_status, e.category, e.amount, e.description, e.date, e.vendor, u.full_name as requester_name
      FROM approvals a
      JOIN expenses e ON a.entity_type = 'expense' AND a.entity_id = e.id
      LEFT JOIN users u ON a.requested_by = u.id
      WHERE e.business_unit_id = ? AND a.status = 'pending'
      ORDER BY a.created_at DESC
    `, [BU_ID]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/approvals/bulk-action', auth, async (req, res, next) => {
  try {
    if (req.user.role !== 'CEO') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { approval_ids, ids, action, comments } = req.body;
    const approvalIds = Array.isArray(approval_ids) ? approval_ids : ids;
    if (!Array.isArray(approvalIds) || approvalIds.length === 0) {
      return res.status(400).json({ success: false, message: 'approval_ids is required' });
    }
    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be approved or rejected' });
    }

    const placeholders = approvalIds.map(() => '?').join(', ');
    await _query(
      `UPDATE approvals
       SET status = ?, comments = ?, action_by = ?
       WHERE id IN (${placeholders}) AND entity_type = 'expense'`,
      [action, comments || null, req.user.id, ...approvalIds]
    );

    const [expenseIds] = await _query(
      `SELECT entity_id FROM approvals WHERE id IN (${placeholders}) AND entity_type = 'expense'`,
      approvalIds
    );
    if (expenseIds.length) {
      const entityIds = expenseIds.map(r => r.entity_id);
      const expPh = entityIds.map(() => '?').join(', ');
      await _query(
        `UPDATE expenses SET approval_status = ? WHERE id IN (${expPh}) AND business_unit_id = ?`,
        [action, ...entityIds, BU_ID]
      );
    }

    res.json({ success: true, message: `Bulk ${action} completed` });
  } catch (error) {
    next(error);
  }
});

// --- BUDGETS ---
router.get('/budgets', auth, async (req, res, next) => {
  try {
    const period = parseBudgetPeriod(req.query.month, req.query.year);
    if (!period) {
      return res.status(400).json({ success: false, message: 'Invalid month or year filter' });
    }
    const { month, year } = period;

    const [rows] = await _query(
      'SELECT * FROM budgets WHERE business_unit_id = ? AND month = ? AND year = ? ORDER BY category',
      [BU_ID, month, year]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/budgets/variance', auth, async (req, res, next) => {
  try {
    const period = parseBudgetPeriod(req.query.month, req.query.year);
    if (!period) {
      return res.status(400).json({ success: false, message: 'Invalid month or year filter' });
    }
    const { month, year } = period;

    const [rows] = await _query(`
      SELECT
        b.id, b.category, b.planned_amount, b.month, b.year, b.notes,
        COALESCE(SUM(e.amount), 0) as actual_amount,
        (b.planned_amount - COALESCE(SUM(e.amount), 0)) as variance,
        CASE
          WHEN b.planned_amount = 0 THEN 0
          ELSE ROUND((COALESCE(SUM(e.amount), 0) / b.planned_amount) * 100, 2)
        END as utilization_percent
      FROM budgets b
      LEFT JOIN expenses e
        ON e.business_unit_id = b.business_unit_id
        AND e.category = b.category
        AND MONTH(e.date) = b.month
        AND YEAR(e.date) = b.year
      WHERE b.business_unit_id = ? AND b.month = ? AND b.year = ?
      GROUP BY b.id, b.category, b.planned_amount, b.month, b.year, b.notes
      ORDER BY b.category
    `, [BU_ID, month, year]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/budgets/period-status', auth, async (req, res, next) => {
  try {
    const period = parseBudgetPeriod(req.query.month, req.query.year);
    if (!period) {
      return res.status(400).json({ success: false, message: 'Invalid month or year filter' });
    }
    const { month, year } = period;
    const closed = await isBudgetPeriodClosed(month, year);
    res.json({ success: true, data: { month, year, month_name: MONTH_NAMES[month - 1], closed } });
  } catch (error) {
    next(error);
  }
});

router.get('/budgets/history', auth, async (req, res, next) => {
  try {
    const period = parseBudgetPeriod(req.query.month, req.query.year);
    if (!period) {
      return res.status(400).json({ success: false, message: 'Invalid month or year filter' });
    }
    const monthsBack = Math.min(Math.max(Number(req.query.months) || 6, 3), 24);
    const { month, year } = period;

    const [rows] = await _query(
      `
      SELECT
        b.category,
        b.month,
        b.year,
        b.planned_amount,
        COALESCE(SUM(e.amount), 0) as actual_amount
      FROM budgets b
      LEFT JOIN expenses e
        ON e.business_unit_id = b.business_unit_id
        AND e.category = b.category
        AND MONTH(e.date) = b.month
        AND YEAR(e.date) = b.year
      WHERE b.business_unit_id = ?
        AND STR_TO_DATE(CONCAT(b.year, '-', LPAD(b.month, 2, '0'), '-01'), '%Y-%m-%d') <= STR_TO_DATE(CONCAT(?, '-', LPAD(?, 2, '0'), '-01'), '%Y-%m-%d')
        AND STR_TO_DATE(CONCAT(b.year, '-', LPAD(b.month, 2, '0'), '-01'), '%Y-%m-%d') >= DATE_SUB(STR_TO_DATE(CONCAT(?, '-', LPAD(?, 2, '0'), '-01'), '%Y-%m-%d'), INTERVAL ? MONTH)
      GROUP BY b.category, b.month, b.year, b.planned_amount
      ORDER BY b.year, b.month, b.category
      `,
      [BU_ID, year, month, year, month, monthsBack - 1]
    );

    const enriched = rows.map(row => ({
      ...row,
      period_key: `${row.year}-${String(row.month).padStart(2, '0')}`,
      period_label: `${MONTH_NAMES[row.month - 1]} ${row.year}`
    }));

    res.json({ success: true, data: { months: monthsBack, rows: enriched } });
  } catch (error) {
    next(error);
  }
});

router.get('/budgets/export', auth, async (req, res, next) => {
  try {
    const period = parseBudgetPeriod(req.query.month, req.query.year);
    if (!period) {
      return res.status(400).json({ success: false, message: 'Invalid month or year filter' });
    }
    const { month, year } = period;

    const [rows] = await _query(
      `
      SELECT
        b.category,
        b.planned_amount,
        COALESCE(SUM(e.amount), 0) as actual_amount,
        (b.planned_amount - COALESCE(SUM(e.amount), 0)) as variance,
        CASE
          WHEN b.planned_amount = 0 THEN 0
          ELSE ROUND((COALESCE(SUM(e.amount), 0) / b.planned_amount) * 100, 2)
        END as utilization_percent,
        b.notes
      FROM budgets b
      LEFT JOIN expenses e
        ON e.business_unit_id = b.business_unit_id
        AND e.category = b.category
        AND MONTH(e.date) = b.month
        AND YEAR(e.date) = b.year
      WHERE b.business_unit_id = ? AND b.month = ? AND b.year = ?
      GROUP BY b.id, b.category, b.planned_amount, b.notes
      ORDER BY b.category
      `,
      [BU_ID, month, year]
    );

    const headers = ['category', 'planned_amount', 'actual_amount', 'variance', 'utilization_percent', 'notes'];
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const v = r[h] ?? '';
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      }).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="office-budgets-${year}-${String(month).padStart(2, '0')}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.post('/budgets/roll-forward', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const period = parseBudgetPeriod(req.body.month, req.body.year);
    if (!period) {
      return res.status(400).json({ success: false, message: 'Valid month and year are required' });
    }
    const { month, year } = period;
    const overwrite = req.body.overwrite === true;

    const targetClosed = await isBudgetPeriodClosed(month, year);
    if (targetClosed) {
      return res.status(403).json({ success: false, message: `Financial period ${month}/${year} is closed. Modifications are not allowed.` });
    }

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const [sourceRows] = await _query(
      'SELECT category, planned_amount, notes FROM budgets WHERE business_unit_id = ? AND month = ? AND year = ?',
      [BU_ID, prevMonth, prevYear]
    );

    if (!sourceRows.length) {
      return res.status(404).json({
        success: false,
        message: `No budgets found in ${MONTH_NAMES[prevMonth - 1]} ${prevYear} to roll forward`
      });
    }

    let copied = 0;
    let updated = 0;
    for (const row of sourceRows) {
      if (overwrite) {
        await _query(
          `INSERT INTO budgets (business_unit_id, category, planned_amount, month, year, notes)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE planned_amount = VALUES(planned_amount), notes = VALUES(notes), updated_at = CURRENT_TIMESTAMP`,
          [BU_ID, row.category, Number(row.planned_amount), month, year, row.notes || null]
        );
        copied += 1;
        continue;
      }

      const [existing] = await _query(
        'SELECT id FROM budgets WHERE business_unit_id = ? AND category = ? AND month = ? AND year = ?',
        [BU_ID, row.category, month, year]
      );
      if (existing.length) {
        updated += 1;
        continue;
      }
      await _query(
        `INSERT INTO budgets (business_unit_id, category, planned_amount, month, year, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [BU_ID, row.category, Number(row.planned_amount), month, year, row.notes || null]
      );
      copied += 1;
    }

    res.status(201).json({
      success: true,
      message: `Rolled forward ${copied} budget(s) from ${MONTH_NAMES[prevMonth - 1]} ${prevYear}`,
      data: { copied, skipped_existing: overwrite ? 0 : updated, source: { month: prevMonth, year: prevYear }, target: { month, year } }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/budgets', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { category, planned_amount, month, year, notes } = req.body;
    const period = parseBudgetPeriod(month, year);
    if (!category || !(Number(planned_amount) >= 0) || !period) {
      return res.status(400).json({ success: false, message: 'category, planned_amount, month, year are required' });
    }
    const periodClosed = await isBudgetPeriodClosed(period.month, period.year);
    if (periodClosed) {
      return res.status(403).json({ success: false, message: `Financial period ${period.month}/${period.year} is closed. Modifications are not allowed.` });
    }

    await _query(
      `INSERT INTO budgets (business_unit_id, category, planned_amount, month, year, notes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE planned_amount = VALUES(planned_amount), notes = VALUES(notes), updated_at = CURRENT_TIMESTAMP`,
      [BU_ID, category, Number(planned_amount), period.month, period.year, notes || null]
    );
    res.status(201).json({ success: true, message: 'Budget saved' });
  } catch (error) {
    next(error);
  }
});

router.delete('/budgets/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await _query('SELECT month, year FROM budgets WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Budget not found' });
    const periodClosed = await isBudgetPeriodClosed(existing[0].month, existing[0].year);
    if (periodClosed) {
      return res.status(403).json({
        success: false,
        message: `Financial period ${existing[0].month}/${existing[0].year} is closed. Modifications are not allowed.`
      });
    }
    await _query('DELETE FROM budgets WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);
    res.json({ success: true, message: 'Budget deleted' });
  } catch (error) {
    next(error);
  }
});

// --- RECURRING EXPENSES ---
router.get('/recurring-expenses', auth, async (req, res, next) => {
  try {
    await ensureOfficeTables();
    const [rows] = await _query(
      'SELECT * FROM recurring_expenses WHERE business_unit_id = ? ORDER BY category, day_of_month',
      [BU_ID]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/recurring-expenses', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensureOfficeTables();
    const {
      category, sub_category, expense_type, amount, description, vendor, payment_method,
      day_of_month, start_date, end_date, is_active
    } = req.body;
    if (!category || !(Number(amount) > 0) || !start_date) {
      return res.status(400).json({ success: false, message: 'category, amount, start_date are required' });
    }

    await _query(
      `INSERT INTO recurring_expenses (
        business_unit_id, category, sub_category, expense_type, amount, description, vendor,
        payment_method, day_of_month, start_date, end_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        BU_ID, category, sub_category || null, expense_type || 'fixed', Number(amount), description || null,
        vendor || null, payment_method || 'cash', Number(day_of_month || 1), start_date, end_date || null,
        is_active === false ? 0 : 1
      ]
    );
    res.status(201).json({ success: true, message: 'Recurring expense created' });
  } catch (error) {
    next(error);
  }
});

router.put('/recurring-expenses/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensureOfficeTables();
    const { id } = req.params;
    const fields = { ...req.body };
    if (fields.amount !== undefined) {
      const parsed = Number(fields.amount);
      if (!(parsed > 0)) return res.status(400).json({ success: false, message: 'Amount must be positive' });
      fields.amount = parsed;
    }
    if (!Object.keys(fields).length) return res.status(400).json({ success: false, message: 'No fields provided for update' });
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    await _query(`UPDATE recurring_expenses SET ${updates} WHERE id = ? AND business_unit_id = ?`, [...values, id, BU_ID]);
    res.json({ success: true, message: 'Recurring expense updated' });
  } catch (error) {
    next(error);
  }
});

router.delete('/recurring-expenses/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensureOfficeTables();
    const { id } = req.params;
    await _query('DELETE FROM recurring_expenses WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);
    res.json({ success: true, message: 'Recurring expense deleted' });
  } catch (error) {
    next(error);
  }
});

router.post('/recurring-expenses/run', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const generated = await runRecurringGeneration(req.user.id, req.ip, req.get('user-agent'));
    res.json({ success: true, generated, message: `Generated ${generated} recurring expense(s)` });
  } catch (error) {
    next(error);
  }
});

// --- REPORTS ---
router.get('/reports/summary', auth, async (req, res, next) => {
  try {
    const range = resolveReportRange(req.query);
    if (!range) {
      return res.status(400).json({ success: false, message: 'Invalid report filters' });
    }

    const reportPeriod = parseBudgetPeriod(req.query.month, req.query.year);
    const rangeFrom = range.from;
    const rangeTo = range.to;

    let query = 'SELECT * FROM expenses WHERE business_unit_id = ?';
    const params = [BU_ID];
    if (rangeFrom) { query += ' AND date >= ?'; params.push(rangeFrom); }
    if (rangeTo) { query += ' AND date <= ?'; params.push(rangeTo); }

    const [rows] = await _query(query, params);
    const total = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const byCategoryMap = new Map();
    const byVendorMap = new Map();
    const monthlyTrendMap = new Map();
    const approvals = { pending: 0, approved: 0, rejected: 0, na: 0 };
    let approvedCount = 0;
    let actionableCount = 0;

    for (const row of rows) {
      byCategoryMap.set(row.category, (byCategoryMap.get(row.category) || 0) + Number(row.amount || 0));
      byVendorMap.set(row.vendor || 'Unassigned', (byVendorMap.get(row.vendor || 'Unassigned') || 0) + Number(row.amount || 0));
      const period = new Date(row.date).toISOString().slice(0, 7);
      monthlyTrendMap.set(period, (monthlyTrendMap.get(period) || 0) + Number(row.amount || 0));
      const key = row.approval_status || 'na';
      approvals[key] = (approvals[key] || 0) + 1;
      if (key !== 'na') actionableCount += 1;
      if (key === 'approved') approvedCount += 1;
    }

    const byCategory = Array.from(byCategoryMap.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    const byVendor = Array.from(byVendorMap.entries()).map(([vendor, amount]) => ({ vendor, amount })).sort((a, b) => b.amount - a.amount);
    const monthlyTrend = Array.from(monthlyTrendMap.entries())
      .map(([period, totalAmount]) => ({ period, total: totalAmount }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const topExpenses = [...rows]
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
      .slice(0, 10);

    const [approvalSla] = await _query(
      `
      SELECT COALESCE(ROUND(AVG(TIMESTAMPDIFF(HOUR, a.created_at, a.updated_at)), 2), 0) as avg_hours
      FROM approvals a
      JOIN expenses e ON a.entity_type = 'expense' AND a.entity_id = e.id
      WHERE e.business_unit_id = ? AND a.status IN ('approved', 'rejected')
      `,
      [BU_ID]
    );

    let budgetPlanned = 0;
    let budgetActual = 0;
    let budgetUtilization = 0;
    let overBudgetCategories = 0;
    if (reportPeriod) {
      const [budgetRows] = await _query(
        `
        SELECT
          b.planned_amount,
          COALESCE(SUM(e.amount), 0) as actual_amount
        FROM budgets b
        LEFT JOIN expenses e
          ON e.business_unit_id = b.business_unit_id
          AND e.category = b.category
          AND MONTH(e.date) = b.month
          AND YEAR(e.date) = b.year
        WHERE b.business_unit_id = ? AND b.month = ? AND b.year = ?
        GROUP BY b.id, b.planned_amount
        `,
        [BU_ID, reportPeriod.month, reportPeriod.year]
      );
      for (const row of budgetRows) {
        budgetPlanned += Number(row.planned_amount || 0);
        budgetActual += Number(row.actual_amount || 0);
        if (Number(row.actual_amount || 0) > Number(row.planned_amount || 0)) overBudgetCategories += 1;
      }
      budgetUtilization = budgetPlanned > 0 ? Number(((budgetActual / budgetPlanned) * 100).toFixed(2)) : 0;
    }

    res.json({
      success: true,
      data: {
        range: { from: rangeFrom, to: rangeTo },
        monthlyTotal: total,
        categoriesCount: byCategory.length,
        complianceRate: actionableCount > 0 ? Number(((approvedCount / actionableCount) * 100).toFixed(2)) : 100,
        totalExpenses: total,
        totalRecords: rows.length,
        topExpenses,
        byCategory,
        byVendor,
        approvals,
        monthlyTrend,
        approvalSlaHours: Number(approvalSla[0]?.avg_hours || 0),
        budgetPlanned,
        budgetActual,
        budgetVariance: budgetPlanned - budgetActual,
        budgetUtilization,
        overBudgetCategories
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/export', auth, async (req, res, next) => {
  try {
    const range = resolveReportRange(req.query);
    if (!range) {
      return res.status(400).json({ success: false, message: 'Invalid report filters' });
    }

    let query = 'SELECT * FROM expenses WHERE business_unit_id = ?';
    const params = [BU_ID];
    if (range.from) { query += ' AND date >= ?'; params.push(range.from); }
    if (range.to) { query += ' AND date <= ?'; params.push(range.to); }
    query += ' ORDER BY date DESC, id DESC';
    const [rows] = await _query(query, params);

    const headers = ['id', 'date', 'category', 'sub_category', 'expense_type', 'amount', 'vendor', 'receipt_number', 'payment_method', 'approval_status', 'description'];
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const v = r[h] ?? '';
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      }).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="office-expenses.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.get('/reports/export/pdf', auth, async (req, res, next) => {
  try {
    const range = resolveReportRange(req.query);
    if (!range) {
      return res.status(400).json({ success: false, message: 'Invalid report filters' });
    }

    let sql = 'SELECT * FROM expenses WHERE business_unit_id = ?';
    const params = [BU_ID];
    if (range.from) { sql += ' AND date >= ?'; params.push(range.from); }
    if (range.to) { sql += ' AND date <= ?'; params.push(range.to); }
    sql += ' ORDER BY date DESC, id DESC';

    const [rows] = await _query(sql, params);
    const total = rows.reduce((acc, row) => acc + Number(row.amount || 0), 0);

    const byCategoryMap = new Map();
    const byVendorMap = new Map();
    const approvals = { pending: 0, approved: 0, rejected: 0, na: 0 };
    for (const row of rows) {
      byCategoryMap.set(row.category, (byCategoryMap.get(row.category) || 0) + Number(row.amount || 0));
      byVendorMap.set(row.vendor || 'Unassigned', (byVendorMap.get(row.vendor || 'Unassigned') || 0) + Number(row.amount || 0));
      const key = row.approval_status || 'na';
      approvals[key] = (approvals[key] || 0) + 1;
    }

    const byCategory = Array.from(byCategoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const byVendor = Array.from(byVendorMap.entries())
      .map(([vendor, amount]) => ({ vendor, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="office-report.pdf"');
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('Office Expense Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Period: ${range.from || '-'} to ${range.to || '-'}`, { align: 'center' });
    doc.moveDown(1.2);

    doc.fontSize(13).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Expenses: Rs ${total.toLocaleString()}`);
    doc.text(`Total Records: ${rows.length}`);
    doc.text(`Approvals - Pending: ${approvals.pending || 0}, Approved: ${approvals.approved || 0}, Rejected: ${approvals.rejected || 0}`);
    doc.moveDown(1);

    doc.fontSize(13).font('Helvetica-Bold').text('Top Categories');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    byCategory.slice(0, 10).forEach((item, idx) => {
      doc.text(`${idx + 1}. ${item.category}: Rs ${Number(item.amount || 0).toLocaleString()}`);
    });
    doc.moveDown(0.8);

    doc.fontSize(13).font('Helvetica-Bold').text('Top Vendors');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    if (!byVendor.length) {
      doc.text('No vendor data available');
    } else {
      byVendor.forEach((item, idx) => {
        doc.text(`${idx + 1}. ${item.vendor}: Rs ${Number(item.amount || 0).toLocaleString()}`);
      });
    }

    doc.moveDown(1);
    doc.fontSize(9).fillColor('#666').text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });
    doc.end();
  } catch (error) {
    next(error);
  }
});

router.post('/seed-sample', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const today = new Date();
    const rows = [
      ['Rent', 'Office', 'fixed', 120000, 'Office monthly rent'],
      ['Electricity', 'Utilities', 'variable', 28000, 'Electricity bill'],
      ['Internet', 'Utilities', 'fixed', 8500, 'Internet and communication'],
      ['Supplies', 'Stationery', 'variable', 6200, 'Office supplies']
    ];

    for (const [category, subCategory, type, amount, desc] of rows) {
      await insertExpenseCompat(
        [BU_ID, category, subCategory, type, amount, desc, null, null, 'cash', today.toISOString().slice(0, 10), 'na'],
        [BU_ID, category, subCategory, type, amount, desc, null, null, 'cash', today.toISOString().slice(0, 10)]
      );
    }
    res.status(201).json({ success: true, message: 'Sample office expenses added' });
  } catch (error) {
    next(error);
  }
});

router.post('/reset', auth, async (req, res, next) => {
  try {
    await ensureOfficeTables();
    const [expenseIds] = await _query('SELECT id FROM expenses WHERE business_unit_id = ?', [BU_ID]);
    const ids = expenseIds.map(r => r.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(', ');
      await _query(`DELETE FROM office_expense_attachments WHERE expense_id IN (${placeholders})`, ids);
      await _query(`DELETE FROM approvals WHERE entity_type = 'expense' AND entity_id IN (${placeholders})`, ids);
    }
    await _query('DELETE FROM recurring_expenses WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM budgets WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM expenses WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM salaries WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM transactions WHERE business_unit_id = ?', [BU_ID]);
    res.json({ success: true, message: 'Office panel data reset successfully' });
  } catch (error) {
    next(error);
  }
});

// --- SALARIES ---
router.get('/salaries', auth, async (req, res) => {
  try {
    const { month, year, business_unit_id } = req.query;
    let query = 'SELECT s.*, bu.name as business_unit_name, (s.base_salary + s.bonus - s.deductions) as net_salary FROM salaries s JOIN business_units bu ON s.business_unit_id = bu.id';
    const params = [];
    const conditions = [];
    if (month) { conditions.push('s.month = ?'); params.push(month); }
    if (year) { conditions.push('s.year = ?'); params.push(year); }
    if (business_unit_id) { conditions.push('s.business_unit_id = ?'); params.push(business_unit_id); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY s.business_unit_id, s.employee_name';

    const [salaries] = await _query(query, params);
    res.json({ success: true, data: salaries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/salaries', auth, validate(salaryRules), checkPeriodClose, async (req, res) => {
  try {
    const { business_unit_id, employee_name, designation, department, base_salary, bonus, deductions, month, year, payment_method } = req.body;
    const buId = business_unit_id || BU_ID;
    const [result] = await _query(
      `INSERT INTO salaries (business_unit_id, employee_name, designation, department, base_salary, bonus, deductions, month, year, status, paid_date, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', CURDATE(), ?)`,
      [buId, employee_name, designation, department, base_salary, bonus || 0, deductions || 0, month, year, payment_method || 'bank_transfer']
    );

    const netSalary = Number(base_salary) + Number(bonus || 0) - Number(deductions || 0);
    await insertExpenseCompat(
      [buId, 'Salaries', department || null, 'fixed', netSalary, `Salary: ${employee_name} - ${month} ${year}`, null, null, payment_method || 'bank_transfer', new Date().toISOString().slice(0, 10), 'na'],
      [buId, 'Salaries', department || null, 'fixed', netSalary, `Salary: ${employee_name} - ${month} ${year}`, null, null, payment_method || 'bank_transfer', new Date().toISOString().slice(0, 10)]
    );

    const [salary] = await _query('SELECT * FROM salaries WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: salary[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
