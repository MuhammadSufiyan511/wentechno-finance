import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { logAudit } from '../middleware/auditTrail.js';
import { checkPeriodClose } from '../middleware/checkPeriodClose.js';
import { approvalRequired } from '../middleware/approvalRequired.js';
import { validate, transactionRules, schoolRules } from '../middleware/validator.js';

const router = Router();
const BU_ID = 3; // School SaaS business unit ID
const MODULE = 'school_saas';

// GET /api/school-saas/overview
router.get('/overview', auth, async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear();

    const [schoolStats] = await _query(`
      SELECT 
        COUNT(*) as total_schools,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_schools,
        SUM(CASE WHEN status = 'churned' THEN 1 ELSE 0 END) as churned_schools,
        SUM(CASE WHEN status = 'trial' THEN 1 ELSE 0 END) as trial_schools,
        COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_fee ELSE 0 END), 0) as mrr,
        COALESCE(SUM(students_count), 0) as total_students
      FROM saas_schools
    `);

    const [planRevenue] = await _query(`
      SELECT plan, COUNT(*) as count, COALESCE(SUM(monthly_fee), 0) as revenue
      FROM saas_schools WHERE status = 'active'
      GROUP BY plan ORDER BY revenue DESC
    `);

    const [yearlyRevenue] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [yearlyExpenses] = await _query(
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
    next(error);
  }
});

// --- SCHOOLS ---
router.get('/schools', auth, async (req, res, next) => {
  try {
    const [schools] = await _query('SELECT * FROM saas_schools ORDER BY created_at DESC');
    res.json({ success: true, data: schools });
  } catch (error) {
    next(error);
  }
});

router.post('/schools', auth, validate(schoolRules), checkPeriodClose, async (req, res, next) => {
  try {
    const { school_name, contact_person, email, phone, address, plan, monthly_fee, students_count, join_date } = req.body;
    const [result] = await _query(
      `INSERT INTO saas_schools (school_name, contact_person, email, phone, address, plan, monthly_fee, students_count, status, join_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [school_name, contact_person, email, phone, address, plan || 'basic', monthly_fee, students_count || 0, join_date]
    );
    const [school] = await _query('SELECT * FROM saas_schools WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'saas_schools',
      entityId: result.insertId,
      newValues: school[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: school[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/schools/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldSchool] = await _query('SELECT * FROM saas_schools WHERE id = ?', [id]);
    if (oldSchool.length === 0) return res.status(404).json({ success: false, message: 'School not found' });

    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);

    await _query(`UPDATE saas_schools SET ${updates} WHERE id = ?`, [...values, id]);
    const [school] = await _query('SELECT * FROM saas_schools WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'saas_schools',
      entityId: id,
      oldValues: oldSchool[0],
      newValues: school[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: school[0] });
  } catch (error) {
    next(error);
  }
});

// Revenue & Expenses
router.post('/revenue', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, amount, description, date, payment_status } = req.body;
    const [result] = await _query(
      'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [BU_ID, category, amount, description, date, payment_status || 'paid', req.approvalStatus]
    );

    if (req.requiresApproval) {
      await _query(
        'INSERT INTO approvals (entity_type, entity_id, requested_by, status, comments) VALUES (?, ?, ?, ?, ?)',
        ['revenue', result.insertId, req.user.id, 'pending', req.approvalReason]
      );
    }

    const [rev] = await _query('SELECT * FROM revenues WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'revenues',
      entityId: result.insertId,
      newValues: rev[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: rev[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/expenses', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, expense_type, amount, description, vendor, date } = req.body;
    const [result] = await _query(
      'INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, vendor, date, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [BU_ID, category, expense_type || 'fixed', amount, description, vendor, date, req.approvalStatus]
    );

    if (req.requiresApproval) {
      await _query(
        'INSERT INTO approvals (entity_type, entity_id, requested_by, status, comments) VALUES (?, ?, ?, ?, ?)',
        ['expense', result.insertId, req.user.id, 'pending', req.approvalReason]
      );
    }

    const [exp] = await _query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'expenses',
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

export default router;

