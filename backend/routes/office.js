import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();
const BU_ID = 6;

// GET /api/office/overview
router.get('/overview', auth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [monthlyExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND MONTH(date) = ? AND YEAR(date) = ?',
      [BU_ID, currentMonth, currentYear]
    );

    const [yearlyExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [byCategory] = await _query(`
      SELECT category, expense_type, COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?
      GROUP BY category, expense_type ORDER BY total DESC
    `, [BU_ID, currentYear]);

    const [byType] = await _query(`
      SELECT expense_type, COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?
      GROUP BY expense_type
    `, [BU_ID, currentYear]);

    const [monthlyTrend] = await _query(`
      SELECT MONTH(date) as month, COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?
      GROUP BY MONTH(date) ORDER BY month
    `, [BU_ID, currentYear]);

    const [salaryExpenses] = await _query(`
      SELECT COALESCE(SUM(base_salary + bonus - deductions), 0) as total
      FROM salaries WHERE business_unit_id = ? AND year = ?
    `, [BU_ID, currentYear]);

    res.json({
      success: true,
      data: {
        monthlyExpenses: parseFloat(monthlyExpenses[0].total),
        yearlyExpenses: parseFloat(yearlyExpenses[0].total),
        salaryExpenses: parseFloat(salaryExpenses[0].total),
        byCategory,
        byType,
        monthlyTrend
      }
    });
  } catch (error) {
    console.error('Office overview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET expenses list
router.get('/expenses', auth, async (req, res) => {
  try {
    const { year, month, category, expense_type } = req.query;
    let query = 'SELECT * FROM expenses WHERE business_unit_id = ?';
    const params = [BU_ID];

    if (year) { query += ' AND YEAR(date) = ?'; params.push(year); }
    if (month) { query += ' AND MONTH(date) = ?'; params.push(month); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    if (expense_type) { query += ' AND expense_type = ?'; params.push(expense_type); }
    query += ' ORDER BY date DESC';

    const [expenses] = await _query(query, params);
    res.json({ success: true, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/expenses', auth, async (req, res) => {
  try {
    const { category, sub_category, expense_type, amount, description, vendor, receipt_number, payment_method, date } = req.body;
    const [result] = await _query(
      `INSERT INTO expenses (business_unit_id, category, sub_category, expense_type, amount, description, vendor, receipt_number, payment_method, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [BU_ID, category, sub_category, expense_type || 'fixed', amount, description, vendor, receipt_number, payment_method || 'cash', date]
    );
    const [exp] = await _query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: exp[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/expenses/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    await _query(`UPDATE expenses SET ${updates} WHERE id = ?`, [...values, id]);
    const [exp] = await _query('SELECT * FROM expenses WHERE id = ?', [id]);
    res.json({ success: true, data: exp[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/expenses/:id', auth, async (req, res) => {
  try {
    await _query('DELETE FROM expenses WHERE id = ? AND business_unit_id = ?', [req.params.id, BU_ID]);
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- SALARIES (global) ---
router.get('/salaries', auth, async (req, res) => {
  try {
    const { month, year, business_unit_id } = req.query;
    let query = 'SELECT s.*, bu.name as business_unit_name FROM salaries s JOIN business_units bu ON s.business_unit_id = bu.id';
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

router.post('/salaries', auth, async (req, res) => {
  try {
    const { business_unit_id, employee_name, designation, department, base_salary, 
            bonus, deductions, month, year, payment_method } = req.body;
    const [result] = await _query(
      `INSERT INTO salaries (business_unit_id, employee_name, designation, department, base_salary, 
       bonus, deductions, month, year, status, paid_date, payment_method) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', CURDATE(), ?)`,
      [business_unit_id, employee_name, designation, department, base_salary,
       bonus || 0, deductions || 0, month, year, payment_method || 'bank_transfer']
    );

    // Also record as expense
    const netSalary = parseFloat(base_salary) + parseFloat(bonus || 0) - parseFloat(deductions || 0);
    await _query(
      'INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, date) VALUES (?, ?, ?, ?, ?, ?)',
      [business_unit_id, 'Salaries', 'fixed', netSalary, `Salary: ${employee_name} - ${month} ${year}`, new Date()]
    );

    const [salary] = await _query('SELECT * FROM salaries WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: salary[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
