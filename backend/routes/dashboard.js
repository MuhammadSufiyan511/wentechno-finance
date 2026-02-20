import { Router } from 'express';
import { query } from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

// GET /api/dashboard/overview
router.get('/overview', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Total Revenue - Daily
    const [dailyRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE date = ?',
      [today]
    );

    // Total Revenue - Monthly
    const [monthlyRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE MONTH(date) = ? AND YEAR(date) = ?',
      [currentMonth, currentYear]
    );

    // Total Revenue - Yearly
    const [yearlyRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE YEAR(date) = ?',
      [currentYear]
    );

    // Total Expenses - Daily
    const [dailyExpense] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date = ?',
      [today]
    );

    // Total Expenses - Monthly
    const [monthlyExpense] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE MONTH(date) = ? AND YEAR(date) = ?',
      [currentMonth, currentYear]
    );

    // Total Expenses - Yearly
    const [yearlyExpense] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE YEAR(date) = ?',
      [currentYear]
    );

    const yearlyRev = parseFloat(yearlyRevenue[0].total);
    const yearlyExp = parseFloat(yearlyExpense[0].total);
    const netProfit = yearlyRev - yearlyExp;
    const profitMargin = yearlyRev > 0 ? ((netProfit / yearlyRev) * 100).toFixed(2) : 0;

    // Revenue by business unit
    const [revenueByUnit] = await query(`
      SELECT bu.name, bu.code, bu.color, COALESCE(SUM(r.amount), 0) as total
      FROM business_units bu
      LEFT JOIN revenues r ON bu.id = r.business_unit_id AND YEAR(r.date) = ?
      WHERE bu.is_active = TRUE
      GROUP BY bu.id, bu.name, bu.code, bu.color
      ORDER BY total DESC
    `, [currentYear]);

    // Expense breakdown
    const [expenseBreakdown] = await query(`
      SELECT bu.name, bu.color, COALESCE(SUM(e.amount), 0) as total
      FROM business_units bu
      LEFT JOIN expenses e ON bu.id = e.business_unit_id AND YEAR(e.date) = ?
      WHERE bu.is_active = TRUE
      GROUP BY bu.id, bu.name, bu.color
      ORDER BY total DESC
    `, [currentYear]);

    // Monthly trends (last 12 months)
    const [monthlyTrends] = await query(`
      SELECT 
        months.month_num,
        months.month_name,
        months.year,
        COALESCE(rev.total, 0) as revenue,
        COALESCE(exp.total, 0) as expenses,
        COALESCE(rev.total, 0) - COALESCE(exp.total, 0) as profit
      FROM (
        SELECT 1 as month_num, 'Jan' as month_name, ? as year
        UNION SELECT 2, 'Feb', ? UNION SELECT 3, 'Mar', ?
        UNION SELECT 4, 'Apr', ? UNION SELECT 5, 'May', ?
        UNION SELECT 6, 'Jun', ? UNION SELECT 7, 'Jul', ?
        UNION SELECT 8, 'Aug', ? UNION SELECT 9, 'Sep', ?
        UNION SELECT 10, 'Oct', ? UNION SELECT 11, 'Nov', ?
        UNION SELECT 12, 'Dec', ?
      ) months
      LEFT JOIN (
        SELECT MONTH(date) as m, COALESCE(SUM(amount), 0) as total
        FROM revenues WHERE YEAR(date) = ?
        GROUP BY MONTH(date)
      ) rev ON months.month_num = rev.m
      LEFT JOIN (
        SELECT MONTH(date) as m, COALESCE(SUM(amount), 0) as total
        FROM expenses WHERE YEAR(date) = ?
        GROUP BY MONTH(date)
      ) exp ON months.month_num = exp.m
      ORDER BY months.month_num
    `, [currentYear, currentYear, currentYear, currentYear, currentYear, 
        currentYear, currentYear, currentYear, currentYear, currentYear, 
        currentYear, currentYear, currentYear, currentYear]);

    // Cash flow (income vs outgoing)
    const [pendingReceivables] = await query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE payment_status IN ('pending', 'partial') AND YEAR(date) = ?",
      [currentYear]
    );

    // Profit/Loss per business unit
    const [profitByUnit] = await query(`
      SELECT 
        bu.name,
        bu.code,
        bu.color,
        COALESCE(rev.total, 0) as revenue,
        COALESCE(exp.total, 0) as expenses,
        COALESCE(rev.total, 0) - COALESCE(exp.total, 0) as profit
      FROM business_units bu
      LEFT JOIN (
        SELECT business_unit_id, SUM(amount) as total
        FROM revenues WHERE YEAR(date) = ?
        GROUP BY business_unit_id
      ) rev ON bu.id = rev.business_unit_id
      LEFT JOIN (
        SELECT business_unit_id, SUM(amount) as total
        FROM expenses WHERE YEAR(date) = ?
        GROUP BY business_unit_id
      ) exp ON bu.id = exp.business_unit_id
      WHERE bu.is_active = TRUE
      ORDER BY profit DESC
    `, [currentYear, currentYear]);

    // Growth rate
    const [lastYearRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE YEAR(date) = ?',
      [currentYear - 1]
    );
    
    const lastYearRev = parseFloat(lastYearRevenue[0].total);
    const growthRate = lastYearRev > 0 
      ? (((yearlyRev - lastYearRev) / lastYearRev) * 100).toFixed(2) 
      : 100;

    // Recent transactions
    const [recentTransactions] = await query(`
      (SELECT 'income' as type, r.category, r.amount, r.date, bu.name as business_unit, r.description
       FROM revenues r JOIN business_units bu ON r.business_unit_id = bu.id
       ORDER BY r.date DESC LIMIT 5)
      UNION ALL
      (SELECT 'expense' as type, e.category, e.amount, e.date, bu.name as business_unit, e.description
       FROM expenses e JOIN business_units bu ON e.business_unit_id = bu.id
       ORDER BY e.date DESC LIMIT 5)
      ORDER BY date DESC LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        summary: {
          revenue: {
            daily: parseFloat(dailyRevenue[0].total),
            monthly: parseFloat(monthlyRevenue[0].total),
            yearly: yearlyRev
          },
          expenses: {
            daily: parseFloat(dailyExpense[0].total),
            monthly: parseFloat(monthlyExpense[0].total),
            yearly: yearlyExp
          },
          netProfit,
          profitMargin: parseFloat(profitMargin),
          cashFlow: yearlyRev - yearlyExp - parseFloat(pendingReceivables[0].total),
          pendingReceivables: parseFloat(pendingReceivables[0].total),
          growthRate: parseFloat(growthRate)
        },
        revenueByUnit,
        expenseBreakdown,
        monthlyTrends,
        profitByUnit,
        recentTransactions
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/dashboard/business-units
router.get('/business-units', auth, async (req, res) => {
  try {
    const [units] = await query('SELECT * FROM business_units WHERE is_active = TRUE ORDER BY id');
    res.json({ success: true, data: units });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
