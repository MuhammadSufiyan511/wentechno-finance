import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = Router();
const BU_ID = 2;

// GET /api/urbanfit/overview
router.get('/overview', auth, async (req, res) => {
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
    console.error('UrbanFit overview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- ORDERS ---
router.get('/orders', auth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM urbanfit_orders';
    const params = [];
    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY order_date DESC';

    const [orders] = await _query(query, params);
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/orders', auth, [
  body('customer_name').notEmpty(),
  body('order_type').notEmpty(),
  body('total_amount').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { customer_name, customer_phone, order_type, items_description, measurements,
            total_amount, advance_paid, fabric_cost, stitching_cost, order_date, delivery_date } = req.body;

    // Generate order number
    const [lastOrder] = await _query('SELECT order_number FROM urbanfit_orders ORDER BY id DESC LIMIT 1');
    const lastNum = lastOrder.length > 0 ? parseInt(lastOrder[0].order_number.split('-')[2]) : 0;
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
        'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
        [BU_ID, order_type, advance_paid, `${orderNumber} - ${customer_name}`, order_date, 
         advance_paid >= total_amount ? 'paid' : 'partial']
      );
    }

    const [order] = await _query('SELECT * FROM urbanfit_orders WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: order[0] });
  } catch (error) {
    console.error('Order create error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/orders/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    
    await _query(`UPDATE urbanfit_orders SET ${updates} WHERE id = ?`, [...values, id]);
    const [order] = await _query('SELECT * FROM urbanfit_orders WHERE id = ?', [id]);
    res.json({ success: true, data: order[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- DAILY SALES ---
router.get('/daily-sales', auth, async (req, res) => {
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/daily-sales', auth, async (req, res) => {
  try {
    const { date, total_sales, cash_sales, card_sales, online_sales, items_sold, notes } = req.body;

    const [result] = await _query(
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

    res.status(201).json({ success: true, message: 'Daily sales recorded' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Revenue & Expenses for this panel
router.post('/revenue', auth, async (req, res) => {
  try {
    const { category, amount, description, date, payment_status } = req.body;
    const [result] = await _query(
      'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
      [BU_ID, category, amount, description, date, payment_status || 'paid']
    );
    const [rev] = await _query('SELECT * FROM revenues WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rev[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/expenses', auth, async (req, res) => {
  try {
    const { category, expense_type, amount, description, vendor, date } = req.body;
    const [result] = await _query(
      'INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, vendor, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [BU_ID, category, expense_type || 'variable', amount, description, vendor, date]
    );
    const [exp] = await _query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: exp[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
