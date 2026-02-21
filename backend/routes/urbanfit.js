import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { logAudit } from '../middleware/auditTrail.js';
import { checkPeriodClose } from '../middleware/checkPeriodClose.js';
import { approvalRequired } from '../middleware/approvalRequired.js';
import { validate, transactionRules } from '../middleware/validator.js';

const router = Router();
const BU_ID = 2; // UrbanFit business unit ID
const MODULE = 'urbanfit';

// GET /api/urbanfit/overview
router.get('/overview', auth, async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [monthlyRevenue] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND MONTH(date) = ? AND YEAR(date) = ?',
      [BU_ID, currentMonth, currentYear]
    );

    const [yearlyRevenue] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [yearlyExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [orderStats] = await _query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' OR status = 'cutting' OR status = 'stitching' OR status = 'finishing' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        COALESCE(SUM(total_amount), 0) as total_value,
        COALESCE(SUM(advance_paid), 0) as collected,
        COALESCE(SUM(total_amount - advance_paid), 0) as pending_amount
      FROM urbanfit_orders
    `);

    const [todaySales] = await _query(
      'SELECT * FROM urbanfit_daily_sales WHERE date = CURDATE()'
    );

    const rev = parseFloat(yearlyRevenue[0].total);
    const exp = parseFloat(yearlyExpenses[0].total);

    res.json({
      success: true,
      data: {
        monthlyRevenue: parseFloat(monthlyRevenue[0].total),
        yearlyRevenue: rev,
        yearlyExpenses: exp,
        netProfit: rev - exp,
        profitMargin: rev > 0 ? (((rev - exp) / rev) * 100).toFixed(2) : 0,
        orderStats: orderStats[0],
        todaySales: todaySales[0] || { total_sales: 0, cash_sales: 0, card_sales: 0, items_sold: 0 }
      }
    });
  } catch (error) {
    next(error);
  }
});

// --- ORDERS ---
router.get('/orders', auth, async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM urbanfit_orders';
    const params = [];
    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY order_date DESC';

    const [orders] = await _query(query, params);
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

router.post('/orders', auth, validate(transactionRules), checkPeriodClose, approvalRequired, [
  body('customer_name').notEmpty(),
  body('order_type').notEmpty(),
  body('total_amount').isNumeric()
], async (req, res, next) => {
  try {
    const { customer_name, customer_phone, order_type, items_description, measurements,
      total_amount, advance_paid, fabric_cost, stitching_cost, order_date, delivery_date } = req.body;

    // Generate order number
    const [lastOrder] = await _query('SELECT order_number FROM urbanfit_orders ORDER BY id DESC LIMIT 1');
    const lastNum = lastOrder.length > 0 ? parseInt(lastOrder[0].order_number.split('-')[2]) || 0 : 0;
    const orderNumber = `UF-2025-${String(lastNum + 1).padStart(3, '0')}`;

    const [result] = await _query(
      `INSERT INTO urbanfit_orders (order_number, customer_name, customer_phone, order_type, 
       items_description, measurements, total_amount, advance_paid, fabric_cost, stitching_cost, 
       status, order_date, delivery_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [orderNumber, customer_name, customer_phone, order_type, items_description, measurements,
        total_amount, advance_paid || 0, fabric_cost || 0, stitching_cost || 0, order_date, delivery_date]
    );

    // Record revenue if advance paid
    if (advance_paid > 0) {
      await _query(
        'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [BU_ID, order_type, advance_paid, `${orderNumber} - ${customer_name}`, order_date,
          advance_paid >= total_amount ? 'paid' : 'partial', req.approvalStatus]
      );

      if (req.requiresApproval) {
        // Find the revenue ID just inserted. Note: this is a bit tricky with multiple inserts.
        // For now, focus on the order itself requiring approval if needed.
      }
    }

    const [order] = await _query('SELECT * FROM urbanfit_orders WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'urbanfit_orders',
      entityId: result.insertId,
      newValues: order[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: order[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/orders/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldOrder] = await _query('SELECT * FROM urbanfit_orders WHERE id = ?', [id]);
    if (oldOrder.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);

    await _query(`UPDATE urbanfit_orders SET ${updates} WHERE id = ?`, [...values, id]);
    const [order] = await _query('SELECT * FROM urbanfit_orders WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'urbanfit_orders',
      entityId: id,
      oldValues: oldOrder[0],
      newValues: order[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: order[0] });
  } catch (error) {
    next(error);
  }
});

// --- DAILY SALES ---
router.get('/daily-sales', auth, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    let query = 'SELECT * FROM urbanfit_daily_sales';
    const params = [];
    const conditions = [];

    if (month) { conditions.push('MONTH(date) = ?'); params.push(month); }
    if (year) { conditions.push('YEAR(date) = ?'); params.push(year); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY date DESC';

    const [sales] = await _query(query, params);
    res.json({ success: true, data: sales });
  } catch (error) {
    next(error);
  }
});

router.post('/daily-sales', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { date, total_sales, cash_sales, card_sales, online_sales, items_sold, notes } = req.body;

    await _query(
      `INSERT INTO urbanfit_daily_sales (date, total_sales, cash_sales, card_sales, online_sales, items_sold, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE total_sales = ?, cash_sales = ?, card_sales = ?, online_sales = ?, items_sold = ?, notes = ?`,
      [date, total_sales, cash_sales, card_sales, online_sales, items_sold, notes,
        total_sales, cash_sales, card_sales, online_sales, items_sold, notes]
    );

    // Auto-create revenue entry
    await _query(
      `INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) 
       VALUES (?, 'Daily Sales', ?, 'POS daily sales', ?, 'paid')
       ON DUPLICATE KEY UPDATE amount = ?`,
      [BU_ID, total_sales, date, total_sales]
    );

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'urbanfit_daily_sales',
      entityId: null,
      newValues: req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, message: 'Daily sales recorded' });
  } catch (error) {
    next(error);
  }
});

// Revenue & Expenses for this panel
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
      [BU_ID, category, expense_type || 'variable', amount, description, vendor, date, req.approvalStatus]
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
