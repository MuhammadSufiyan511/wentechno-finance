import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { logAudit } from '../middleware/auditTrail.js';
import { checkPeriodClose } from '../middleware/checkPeriodClose.js';
import { approvalRequired } from '../middleware/approvalRequired.js';
import { validate, transactionRules, invoiceRules, clientRules, projectRules } from '../middleware/validator.js';

const router = Router();
const BU_ID = 1; // Ecom business unit ID
const MODULE = 'ecom';

// GET /api/ecom/overview
router.get('/overview', auth, async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [totalRevenue] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [totalExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [projectStats] = await _query(`
      SELECT 
        COUNT(*) as total_projects,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'active' OR status = 'in_progress' THEN 1 ELSE 0 END) as active,
        COALESCE(SUM(total_amount), 0) as total_value,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(total_amount - paid_amount), 0) as total_pending
      FROM projects
    `);

    const [monthlyRevenue] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND MONTH(date) = ? AND YEAR(date) = ?',
      [BU_ID, currentMonth, currentYear]
    );

    const [invoiceStats] = await _query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END), 0) as pending_amount
      FROM invoices
    `);

    const [subscriptionRevenue] = await _query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM subscriptions WHERE business_unit_id = ? AND status = 'active'",
      [BU_ID]
    );

    const rev = parseFloat(totalRevenue[0].total);
    const exp = parseFloat(totalExpenses[0].total);

    res.json({
      success: true,
      data: {
        totalRevenue: rev,
        totalExpenses: exp,
        netProfit: rev - exp,
        profitMargin: rev > 0 ? (((rev - exp) / rev) * 100).toFixed(2) : 0,
        monthlyRevenue: parseFloat(monthlyRevenue[0].total),
        projectStats: projectStats[0],
        invoiceStats: invoiceStats[0],
        subscriptionRevenue: parseFloat(subscriptionRevenue[0].total)
      }
    });
  } catch (error) {
    next(error);
  }
});

// --- CLIENTS ---
router.get('/clients', auth, async (req, res, next) => {
  try {
    const [clients] = await _query('SELECT * FROM clients ORDER BY created_at DESC');
    res.json({ success: true, data: clients });
  } catch (error) {
    next(error);
  }
});

router.post('/clients', auth, validate(clientRules), async (req, res, next) => {
  try {
    const { name, email, phone, company, address } = req.body;
    const [result] = await _query(
      'INSERT INTO clients (name, email, phone, company, address) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, company, address]
    );

    const [client] = await _query('SELECT * FROM clients WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'clients',
      entityId: result.insertId,
      newValues: client[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: client[0] });
  } catch (error) {
    next(error);
  }
});

// --- PROJECTS ---
router.get('/projects', auth, async (req, res, next) => {
  try {
    const [projects] = await _query(`
      SELECT p.*, c.name as client_name, c.company as client_company
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      ORDER BY p.created_at DESC
    `);

    // Calculate profit per project
    const projectsWithProfit = projects.map(p => ({
      ...p,
      profit: parseFloat(p.paid_amount) - parseFloat(p.development_cost) - parseFloat(p.marketing_cost),
      commission_amount: parseFloat(p.paid_amount) * (parseFloat(p.commission_rate) / 100)
    }));

    res.json({ success: true, data: projectsWithProfit });
  } catch (error) {
    next(error);
  }
});

router.post('/projects', auth, validate(projectRules), checkPeriodClose, async (req, res, next) => {
  try {
    const { client_id, name, type, description, total_amount, paid_amount,
      development_cost, marketing_cost, status, start_date, end_date,
      assigned_to, commission_rate } = req.body;

    const [result] = await _query(
      `INSERT INTO projects (client_id, name, type, description, total_amount, paid_amount, 
       development_cost, marketing_cost, status, start_date, end_date, assigned_to, commission_rate) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client_id, name, type, description, total_amount, paid_amount || 0,
        development_cost || 0, marketing_cost || 0, status || 'inquiry',
        start_date, end_date, assigned_to, commission_rate || 0]
    );

    // Auto-create revenue entry
    if (paid_amount > 0) {
      await _query(
        'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
        [BU_ID, 'Project Revenue', paid_amount, `Payment for: ${name}`, start_date || new Date(), 'paid']
      );
    }

    const [project] = await _query('SELECT * FROM projects WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'projects',
      entityId: result.insertId,
      newValues: project[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: project[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/projects/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldProject] = await _query('SELECT * FROM projects WHERE id = ?', [id]);
    if (oldProject.length === 0) return res.status(404).json({ success: false, message: 'Project not found' });

    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);

    await _query(`UPDATE projects SET ${updates} WHERE id = ?`, [...values, id]);
    const [project] = await _query('SELECT * FROM projects WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'projects',
      entityId: id,
      oldValues: oldProject[0],
      newValues: project[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: project[0] });
  } catch (error) {
    next(error);
  }
});

// --- INVOICES ---
router.get('/invoices', auth, async (req, res, next) => {
  try {
    const [invoices] = await _query(`
      SELECT i.*, p.name as project_name, c.name as client_name, c.company
      FROM invoices i
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC
    `);
    res.json({ success: true, data: invoices });
  } catch (error) {
    next(error);
  }
});

router.post('/invoices', auth, validate(invoiceRules), checkPeriodClose, [
  body('invoice_number').notEmpty(),
  body('amount').isNumeric()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { project_id, client_id, invoice_number, amount, tax_amount,
      total_amount, status, due_date, notes } = req.body;

    const [result] = await _query(
      `INSERT INTO invoices (project_id, client_id, invoice_number, amount, tax_amount, 
       total_amount, status, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, client_id, invoice_number, amount, tax_amount || 0,
        total_amount || amount, status || 'draft', due_date, notes]
    );

    const [invoice] = await _query('SELECT * FROM invoices WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'invoices',
      entityId: result.insertId,
      newValues: invoice[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: invoice[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/invoices/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldInvoice] = await _query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (oldInvoice.length === 0) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);

    await _query(`UPDATE invoices SET ${updates} WHERE id = ?`, [...values, id]);
    const [invoice] = await _query('SELECT * FROM invoices WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'invoices',
      entityId: id,
      oldValues: oldInvoice[0],
      newValues: invoice[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: invoice[0] });
  } catch (error) {
    next(error);
  }
});

// --- REVENUE & EXPENSES ---
router.get('/revenue', auth, async (req, res, next) => {
  try {
    const { year, month } = req.query;
    let query = 'SELECT * FROM revenues WHERE business_unit_id = ?';
    const params = [BU_ID];

    if (year) { query += ' AND YEAR(date) = ?'; params.push(year); }
    if (month) { query += ' AND MONTH(date) = ?'; params.push(month); }
    query += ' ORDER BY date DESC';

    const [revenues] = await _query(query, params);
    res.json({ success: true, data: revenues });
  } catch (error) {
    next(error);
  }
});

router.post('/revenue', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, sub_category, amount, description, reference_number,
      payment_method, payment_status, date } = req.body;

    const [result] = await _query(
      `INSERT INTO revenues (business_unit_id, category, sub_category, amount, description, 
       reference_number, payment_method, payment_status, date, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [BU_ID, category, sub_category, amount, description, reference_number,
        payment_method || 'cash', payment_status || 'paid', date, req.approvalStatus]
    );

    if (req.requiresApproval) {
      await _query(
        'INSERT INTO approvals (entity_type, entity_id, requested_by, status, comments) VALUES (?, ?, ?, ?, ?)',
        ['revenue', result.insertId, req.user.id, 'pending', req.approvalReason]
      );
    }

    const [revenue] = await _query('SELECT * FROM revenues WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'revenues',
      entityId: result.insertId,
      newValues: revenue[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: revenue[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/expenses', auth, async (req, res, next) => {
  try {
    const { year, month } = req.query;
    let query = 'SELECT * FROM expenses WHERE business_unit_id = ?';
    const params = [BU_ID];
    if (year) { query += ' AND YEAR(date) = ?'; params.push(year); }
    if (month) { query += ' AND MONTH(date) = ?'; params.push(month); }
    query += ' ORDER BY date DESC';

    const [expenses] = await _query(query, params);
    res.json({ success: true, data: expenses });
  } catch (error) {
    next(error);
  }
});

router.post('/expenses', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, sub_category, expense_type, amount, description, vendor, date } = req.body;
    const [result] = await _query(
      `INSERT INTO expenses (business_unit_id, category, sub_category, expense_type, amount, 
       description, vendor, date, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [BU_ID, category, sub_category, expense_type || 'variable', amount, description, vendor, date, req.approvalStatus]
    );

    if (req.requiresApproval) {
      await _query(
        'INSERT INTO approvals (entity_type, entity_id, requested_by, status, comments) VALUES (?, ?, ?, ?, ?)',
        ['expense', result.insertId, req.user.id, 'pending', req.approvalReason]
      );
    }

    const [expense] = await _query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'expenses',
      entityId: result.insertId,
      newValues: expense[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: expense[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
