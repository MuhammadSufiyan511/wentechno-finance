import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = Router();
const BU_ID = 4;

// GET /api/physical-school/overview
router.get('/overview', auth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const monthNames = ['','January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

    const [studentStats] = await _query(`
      SELECT 
        COUNT(*) as total_students,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_students,
        COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_fee ELSE 0 END), 0) as expected_monthly
      FROM school_students
    `);

    const [feeStats] = await _query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_expected,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(amount - paid_amount), 0) as total_pending,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as defaulters_count
      FROM fee_collections
      WHERE month = ? AND year = ?
    `, [monthNames[currentMonth], currentYear]);

    const [yearlyRevenue] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [yearlyExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [expenseBreakdown] = await _query(`
      SELECT category, COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?
      GROUP BY category ORDER BY total DESC
    `, [BU_ID, currentYear]);

    const rev = parseFloat(yearlyRevenue[0].total);
    const exp = parseFloat(yearlyExpenses[0].total);
    const activeStudents = studentStats[0].active_students || 1;

    res.json({
      success: true,
      data: {
        totalStudents: studentStats[0].total_students,
        activeStudents,
        expectedMonthly: parseFloat(studentStats[0].expected_monthly),
        feeCollected: parseFloat(feeStats[0].total_collected),
        feePending: parseFloat(feeStats[0].total_pending),
        defaultersCount: feeStats[0].defaulters_count || 0,
        yearlyRevenue: rev,
        yearlyExpenses: exp,
        netProfit: rev - exp,
        expensePerStudent: (exp / activeStudents).toFixed(2),
        expenseBreakdown
      }
    });
  } catch (error) {
    console.error('Physical school overview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- STUDENTS ---
router.get('/students', auth, async (req, res) => {
  try {
    const [students] = await _query('SELECT * FROM school_students ORDER BY class, section, name');
    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/students', auth, [
  body('name').notEmpty(),
  body('class').notEmpty(),
  body('monthly_fee').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { student_id_number, name, class: cls, section, parent_name, phone, email, 
            address, monthly_fee, admission_fee, admission_date } = req.body;

    const [result] = await _query(
      `INSERT INTO school_students (student_id_number, name, class, section, parent_name, phone, email, 
       address, monthly_fee, admission_fee, status, admission_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [student_id_number, name, cls, section, parent_name, phone, email, 
       address, monthly_fee, admission_fee || 0, admission_date]
    );

    // Record admission fee as revenue
    if (admission_fee > 0) {
      await _query(
        'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
        [BU_ID, 'Admission Fee', admission_fee, `Admission: ${name}`, admission_date, 'paid']
      );
    }

    const [student] = await _query('SELECT * FROM school_students WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: student[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- FEE COLLECTIONS ---
router.get('/fees', auth, async (req, res) => {
  try {
    const { month, year, status } = req.query;
    let query = `SELECT fc.*, ss.name as student_name, ss.class, ss.section, ss.parent_name, ss.phone
                 FROM fee_collections fc
                 JOIN school_students ss ON fc.student_id = ss.id`;
    const params = [];
    const conditions = [];

    if (month) { conditions.push('fc.month = ?'); params.push(month); }
    if (year) { conditions.push('fc.year = ?'); params.push(year); }
    if (status) { conditions.push('fc.status = ?'); params.push(status); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY fc.created_at DESC';

    const [fees] = await _query(query, params);
    res.json({ success: true, data: fees });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/fees', auth, async (req, res) => {
  try {
    const { student_id, amount, fee_type, month, year, paid_amount, payment_method } = req.body;
    
    const status = paid_amount >= amount ? 'paid' : paid_amount > 0 ? 'partial' : 'pending';
    const paidDate = paid_amount > 0 ? new Date().toISOString().split('T')[0] : null;

    const [result] = await _query(
      `INSERT INTO fee_collections (student_id, amount, fee_type, month, year, status, paid_amount, payment_method, paid_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, amount, fee_type || 'monthly', month, year, status, paid_amount || 0, payment_method || 'cash', paidDate]
    );

    // Record as revenue
    if (paid_amount > 0) {
      await _query(
        'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
        [BU_ID, 'Fee Collection', paid_amount, `Fee: ${month} ${year}`, paidDate, status]
      );
    }

    const [fee] = await _query('SELECT * FROM fee_collections WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: fee[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET Defaulters
router.get('/defaulters', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const [defaulters] = await _query(`
      SELECT fc.*, ss.name as student_name, ss.class, ss.section, ss.parent_name, ss.phone
      FROM fee_collections fc
      JOIN school_students ss ON fc.student_id = ss.id
      WHERE fc.status IN ('pending', 'partial') 
      ${month ? 'AND fc.month = ?' : ''} 
      ${year ? 'AND fc.year = ?' : ''}
      ORDER BY ss.class, ss.name
    `, [month, year].filter(Boolean));

    res.json({ success: true, data: defaulters });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Expenses
router.post('/expenses', auth, async (req, res) => {
  try {
    const { category, expense_type, amount, description, vendor, date } = req.body;
    const [result] = await _query(
      'INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, vendor, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [BU_ID, category, expense_type || 'fixed', amount, description, vendor, date]
    );
    const [exp] = await _query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: exp[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
