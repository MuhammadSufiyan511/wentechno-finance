import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { body } from 'express-validator';
import { logAudit } from '../middleware/auditTrail.js';
import { checkPeriodClose } from '../middleware/checkPeriodClose.js';
import { approvalRequired } from '../middleware/approvalRequired.js';
import { validate, transactionRules } from '../middleware/validator.js';
import { monthToNumber } from '../utils/dateUtils.js';

const router = Router();
const BU_ID = 2; // UrbanFit business unit ID
const MODULE = 'urbanfit';

const insertRevenueCompat = async (paramsWithApproval, paramsWithoutApproval) => {
  try {
    return await _query(
      'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      paramsWithApproval
    );
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR' && String(error?.sqlMessage || '').includes('approval_status')) {
      return await _query(
        'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
        paramsWithoutApproval
      );
    }
    throw error;
  }
};

const insertExpenseCompat = async (paramsWithApproval, paramsWithoutApproval) => {
  try {
    return await _query(
      'INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, vendor, date, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      paramsWithApproval
    );
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR' && String(error?.sqlMessage || '').includes('approval_status')) {
      return await _query(
        'INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, vendor, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        paramsWithoutApproval
      );
    }
    throw error;
  }
};

const syncOrderRevenue = async (oldOrder, newOrder) => {
  const oldDescription = `${oldOrder.order_number} - ${oldOrder.customer_name}`;
  const newDescription = `${newOrder.order_number} - ${newOrder.customer_name}`;
  const advancePaid = Number(newOrder.advance_paid || 0);
  const totalAmount = Number(newOrder.total_amount || 0);
  const paymentStatus = advancePaid >= totalAmount ? 'paid' : 'partial';

  // No advance means no revenue should exist for this order.
  if (advancePaid <= 0) {
    await _query(
      'DELETE FROM revenues WHERE business_unit_id = ? AND description IN (?, ?)',
      [BU_ID, oldDescription, newDescription]
    );
    return;
  }

  const [existing] = await _query(
    'SELECT id FROM revenues WHERE business_unit_id = ? AND description IN (?, ?) ORDER BY id DESC LIMIT 1',
    [BU_ID, oldDescription, newDescription]
  );

  if (existing.length > 0) {
    await _query(
      'UPDATE revenues SET category = ?, amount = ?, description = ?, date = ?, payment_status = ? WHERE id = ?',
      [newOrder.order_type, advancePaid, newDescription, newOrder.order_date, paymentStatus, existing[0].id]
    );
    return;
  }

  await insertRevenueCompat(
    [BU_ID, newOrder.order_type, advancePaid, newDescription, newOrder.order_date, paymentStatus, 'na'],
    [BU_ID, newOrder.order_type, advancePaid, newDescription, newOrder.order_date, paymentStatus]
  );
};

// GET /api/urbanfit/overview
router.get('/overview', auth, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    let currentMonth = monthToNumber(month);
    if (!currentMonth) currentMonth = new Date().getMonth() + 1;

    // Revenue for UrbanFit overview is derived from order advances so edits reflect in real time.
    const [monthlyGross] = await _query(
      "SELECT COALESCE(SUM(advance_paid), 0) as total FROM urbanfit_orders WHERE status != 'cancelled' AND MONTH(order_date) = ? AND YEAR(order_date) = ?",
      [currentMonth, currentYear]
    );

    const [monthlyReturns] = await _query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM urbanfit_returns WHERE MONTH(date) = ? AND YEAR(date) = ?",
      [currentMonth, currentYear]
    );

    const [yearlyGross] = await _query(
      "SELECT COALESCE(SUM(advance_paid), 0) as total FROM urbanfit_orders WHERE status != 'cancelled' AND YEAR(order_date) = ?",
      [currentYear]
    );

    const [yearlyReturns] = await _query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM urbanfit_returns WHERE YEAR(date) = ?",
      [currentYear]
    );

    const [yearlyExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [monthlyOrderCosts] = await _query(
      "SELECT COALESCE(SUM(COALESCE(fabric_cost, 0) + COALESCE(stitching_cost, 0)), 0) as total FROM urbanfit_orders WHERE status != 'cancelled' AND MONTH(order_date) = ? AND YEAR(order_date) = ?",
      [currentMonth, currentYear]
    );

    const [yearlyOrderCosts] = await _query(
      "SELECT COALESCE(SUM(COALESCE(fabric_cost, 0) + COALESCE(stitching_cost, 0)), 0) as total FROM urbanfit_orders WHERE status != 'cancelled' AND YEAR(order_date) = ?",
      [currentYear]
    );

    const netProfit = yearlyGross[0].total - yearlyReturns[0].total - yearlyExpenses[0].total - yearlyOrderCosts[0].total;
    const profitMargin = yearlyGross[0].total > 0 ? ((netProfit / yearlyGross[0].total) * 100).toFixed(1) : 0;

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

    const [salesTrend] = await _query(`
      SELECT 
        date,
        total_sales as sales
      FROM urbanfit_daily_sales
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      ORDER BY date ASC
    `);

    const [orderStatusDist] = await _query(`
      SELECT status as name, COUNT(*) as value 
      FROM urbanfit_orders 
      GROUP BY status
    `);

    const [orderTypeDist] = await _query(`
      SELECT order_type as name, COUNT(*) as value 
      FROM urbanfit_orders 
      GROUP BY order_type
    `);


    res.json({
      success: true,
      data: {
        monthlyRevenue: parseFloat(monthlyGross[0].total),
        monthlyReturns: parseFloat(monthlyReturns[0].total),
        monthlyOrderCosts: parseFloat(monthlyOrderCosts[0].total),
        yearlyRevenue: parseFloat(yearlyGross[0].total),
        yearlyReturns: parseFloat(yearlyReturns[0].total),
        yearlyOrderCosts: parseFloat(yearlyOrderCosts[0].total),
        yearlyExpenses: parseFloat(yearlyExpenses[0].total),
        netProfit,
        profitMargin,
        orderStats: orderStats[0],
        todaySales: todaySales[0] || { total_sales: 0, cash_sales: 0, card_sales: 0, items_sold: 0 },
        trends: {
          sales: salesTrend,
          orderStatus: orderStatusDist,
          orderType: orderTypeDist
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Reset panel data for testing
router.post('/reset', auth, async (req, res, next) => {
  try {
    await _query('DELETE FROM urbanfit_returns');
    await _query('DELETE FROM urbanfit_orders');
    await _query('DELETE FROM urbanfit_daily_sales');
    await _query('DELETE FROM revenues WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM expenses WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM transactions WHERE business_unit_id = ?', [BU_ID]);

    res.json({ success: true, message: 'UrbanFit panel data reset successfully' });
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

router.post('/orders', auth, validate([
  body('customer_name').trim().notEmpty().withMessage('Customer name is required'),
  body('order_type').isIn(['stitching', 'alteration', 'ready_made', 'fabric_sale']).withMessage('Invalid order type'),
  body('total_amount').isFloat({ min: 0.01 }).withMessage('Total amount must be positive'),
  body('advance_paid').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Advance paid cannot be negative'),
  body('fabric_cost').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Fabric cost cannot be negative'),
  body('stitching_cost').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Stitching cost cannot be negative'),
  body('order_date').isISO8601({ strict: true, strictSeparator: true }).withMessage('Invalid order date format'),
  body('delivery_date').optional({ values: 'falsy' }).isISO8601({ strict: true, strictSeparator: true }).withMessage('Invalid delivery date format')
]), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { customer_name, customer_phone, order_type, items_description, measurements,
      total_amount, advance_paid, fabric_cost, stitching_cost, order_date, delivery_date, status } = req.body;

    // Generate order number
    const [lastOrder] = await _query('SELECT order_number FROM urbanfit_orders ORDER BY id DESC LIMIT 1');
    const lastNum = lastOrder.length > 0 ? parseInt(lastOrder[0].order_number.split('-')[2]) || 0 : 0;
    const orderNumber = `UF-2025-${String(lastNum + 1).padStart(3, '0')}`;

    const [result] = await _query(
      `INSERT INTO urbanfit_orders (order_number, customer_name, customer_phone, order_type, 
       items_description, measurements, total_amount, advance_paid, fabric_cost, stitching_cost, 
       status, order_date, delivery_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, customer_name, customer_phone, order_type, items_description, measurements,
        total_amount, advance_paid || 0, fabric_cost || 0, stitching_cost || 0, status || 'pending', order_date, delivery_date]
    );

    // Record revenue if advance paid
    if (advance_paid > 0) {
      await insertRevenueCompat(
        [BU_ID, order_type, advance_paid, `${orderNumber} - ${customer_name}`, order_date,
          advance_paid >= total_amount ? 'paid' : 'partial', req.approvalStatus],
        [BU_ID, order_type, advance_paid, `${orderNumber} - ${customer_name}`, order_date,
          advance_paid >= total_amount ? 'paid' : 'partial']
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
    await syncOrderRevenue(oldOrder[0], order[0]);

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

router.delete('/orders/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [order] = await _query('SELECT * FROM urbanfit_orders WHERE id = ?', [id]);
    if (order.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    await _query('DELETE FROM urbanfit_orders WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      module: 'urbanfit_orders',
      entityId: id,
      oldValues: order[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Order deleted successfully' });
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

router.put('/daily-sales/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldSale] = await _query('SELECT * FROM urbanfit_daily_sales WHERE id = ?', [id]);
    if (oldSale.length === 0) return res.status(404).json({ success: false, message: 'Daily sale entry not found' });

    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    if (!updates) return res.status(400).json({ success: false, message: 'No fields provided for update' });

    await _query(`UPDATE urbanfit_daily_sales SET ${updates} WHERE id = ?`, [...values, id]);
    const [sale] = await _query('SELECT * FROM urbanfit_daily_sales WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'urbanfit_daily_sales',
      entityId: id,
      oldValues: oldSale[0],
      newValues: sale[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: sale[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/daily-sales/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [sale] = await _query('SELECT * FROM urbanfit_daily_sales WHERE id = ?', [id]);
    if (sale.length === 0) return res.status(404).json({ success: false, message: 'Daily sale entry not found' });

    await _query('DELETE FROM urbanfit_daily_sales WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      module: 'urbanfit_daily_sales',
      entityId: id,
      oldValues: sale[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Daily sales entry deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Revenue & Expenses for this panel
router.post('/revenue', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, amount, description, date, payment_status } = req.body;
    const [result] = await insertRevenueCompat(
      [BU_ID, category, amount, description, date, payment_status || 'paid', req.approvalStatus],
      [BU_ID, category, amount, description, date, payment_status || 'paid']
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
    const [result] = await insertExpenseCompat(
      [BU_ID, category, expense_type || 'variable', amount, description, vendor, date, req.approvalStatus],
      [BU_ID, category, expense_type || 'variable', amount, description, vendor, date]
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
