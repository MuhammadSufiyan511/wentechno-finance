import { Router } from 'express';
import { query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = Router();
const BU_ID = 3;

// GET /api/school-saas/overview
router.get('/overview', auth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const [schoolStats] = await query(`
      SELECT 
        COUNT(*) as total_schools,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_schools,
        SUM(CASE WHEN status = 'churned' THEN 1 ELSE 0 END) as churned_schools,
        SUM(CASE WHEN status = 'trial' THEN 1 ELSE 0 END) as trial_schools,
        COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_fee ELSE 0 END), 0) as mrr,
        COALESCE(SUM(students_count), 0) as total_students
      FROM saas_schools
    `);

    const [planRevenue] = await query(`
      SELECT plan, COUNT(*) as count, COALESCE(SUM(monthly_fee), 0) as revenue
      FROM saas_schools WHERE status = 'active'
      GROUP BY plan ORDER BY revenue DESC
    `);

    const [yearlyRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [yearlyExpenses] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const mrr = parseFloat(schoolStats[0].mrr);
    const rev = parseFloat(yearlyRevenue[0].total);
    const exp = parseFloat(yearlyExpenses[0].total);

    res.json({
      success: true,
      data: {
        mrr,
        arr: mrr * 12,
        activeSchools: schoolStats[0].active_schools,
        totalSchools: schoolStats[0].total_schools,
        churnedSchools: schoolStats[0].churned_schools,
        trialSchools: schoolStats[0].trial_schools,
        totalStudents: schoolStats[0].total_students,
        yearlyRevenue: rev,
        yearlyExpenses: exp,
        netProfit: rev - exp,
        profitMargin: rev > 0 ? (((rev - exp) / rev) * 100).toFixed(2) : 0,
        planRevenue,
        churnRate: schoolStats[0].total_schools > 0 
          ? ((schoolStats[0].churned_schools / schoolStats[0].total_schools) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('School SaaS overview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- SCHOOLS ---
router.get('/schools', auth, async (req, res) => {
  try {
    const [schools] = await query('SELECT * FROM saas_schools ORDER BY created_at DESC');
    res.json({ success: true, data: schools });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/schools', auth, [
  body('school_name').notEmpty(),
  body('monthly_fee').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { school_name, contact_person, email, phone, address, plan, monthly_fee, students_count, join_date } = req.body;
    const [result] = await query(
      `INSERT INTO saas_schools (school_name, contact_person, email, phone, address, plan, monthly_fee, students_count, status, join_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [school_name, contact_person, email, phone, address, plan || 'basic', monthly_fee, students_count || 0, join_date]
    );
    const [school] = await query('SELECT * FROM saas_schools WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: school[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/schools/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    await query(`UPDATE saas_schools SET ${updates} WHERE id = ?`, [...values, id]);
    const [school] = await query('SELECT * FROM saas_schools WHERE id = ?', [id]);
    res.json({ success: true, data: school[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Revenue & Expenses
router.post('/revenue', auth, async (req, res) => {
  try {
    const { category, amount, description, date, payment_status } = req.body;
    const [result] = await query(
      'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
      [BU_ID, category, amount, description, date, payment_status || 'paid']
    );
    const [rev] = await query('SELECT * FROM revenues WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rev[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/expenses', auth, async (req, res) => {
  try {
    const { category, expense_type, amount, description, vendor, date } = req.body;
    const [result] = await query(
      'INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, vendor, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [BU_ID, category, expense_type || 'fixed', amount, description, vendor, date]
    );
    const [exp] = await query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: exp[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
