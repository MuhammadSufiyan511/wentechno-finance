import { Router } from 'express';
import { query } from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

// GET /api/dashboard/overview
router.get('/overview', auth, async (req, res) => {
  try {
    const parseISODate = (value) => {
      if (!value || typeof value !== 'string') return null;
      const date = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    };
    const toISODate = (date) => date.toISOString().slice(0, 10);
    const startOfDayUTC = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const startOfMonthUTC = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const endOfMonthUTC = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    const startOfYearUTC = (date) => new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const endOfYearUTC = (date) => new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
    const addDaysUTC = (date, days) => new Date(date.getTime() + (days * 86400000));

    const today = startOfDayUTC(new Date());
    let rangeStartDate = parseISODate(req.query.start) || startOfYearUTC(today);
    let rangeEndDate = parseISODate(req.query.end) || today;
    if (rangeStartDate > rangeEndDate) {
      const temp = rangeStartDate;
      rangeStartDate = rangeEndDate;
      rangeEndDate = temp;
    }
    rangeStartDate = startOfDayUTC(rangeStartDate);
    rangeEndDate = startOfDayUTC(rangeEndDate);
    const searchText = String(req.query.q || '').trim();

    const rangeStart = toISODate(rangeStartDate);
    const rangeEnd = toISODate(rangeEndDate);
    const pointDate = rangeEnd;
    const monthStart = toISODate(startOfMonthUTC(rangeEndDate));
    const monthEnd = toISODate(endOfMonthUTC(rangeEndDate));
    const yearStart = toISODate(startOfYearUTC(rangeEndDate));
    const yearEnd = toISODate(endOfYearUTC(rangeEndDate));

    // Total Revenue - Daily
    const [dailyRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE date = ?',
      [pointDate]
    );

    // Total Revenue - Month (for the month of selected end date)
    const [monthlyRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE date BETWEEN ? AND ?',
      [monthStart, monthEnd]
    );

    // Total Revenue - Selected Range
    const [periodRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE date BETWEEN ? AND ?',
      [rangeStart, rangeEnd]
    );

    // Total Expenses - Daily
    const [dailyExpense] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date = ?',
      [pointDate]
    );

    // Total Expenses - Month (for the month of selected end date)
    const [monthlyExpense] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date BETWEEN ? AND ?',
      [monthStart, monthEnd]
    );

    // Total Expenses - Selected Range
    const [periodExpense] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date BETWEEN ? AND ?',
      [rangeStart, rangeEnd]
    );

    const periodRev = parseFloat(periodRevenue[0].total);
    const periodExp = parseFloat(periodExpense[0].total);
    const netProfit = periodRev - periodExp;
    const profitMargin = periodRev > 0 ? ((netProfit / periodRev) * 100).toFixed(2) : 0;

    const unitSearchFilter = searchText ? ' AND (bu.name LIKE ? OR bu.code LIKE ?)' : '';
    const unitSearchParams = searchText ? [`%${searchText}%`, `%${searchText}%`] : [];

    // Revenue by business unit
    const [revenueByUnit] = await query(`
      SELECT bu.name, bu.code, bu.color, COALESCE(SUM(r.amount), 0) as total
      FROM business_units bu
      LEFT JOIN revenues r ON bu.id = r.business_unit_id AND r.date BETWEEN ? AND ?
      WHERE bu.is_active = TRUE
      ${unitSearchFilter}
      GROUP BY bu.id, bu.name, bu.code, bu.color
      ORDER BY total DESC
    `, [rangeStart, rangeEnd, ...unitSearchParams]);

    // Expense breakdown
    const [expenseBreakdown] = await query(`
      SELECT bu.name, bu.color, COALESCE(SUM(e.amount), 0) as total
      FROM business_units bu
      LEFT JOIN expenses e ON bu.id = e.business_unit_id AND e.date BETWEEN ? AND ?
      WHERE bu.is_active = TRUE
      ${unitSearchFilter}
      GROUP BY bu.id, bu.name, bu.color
      ORDER BY total DESC
    `, [rangeStart, rangeEnd, ...unitSearchParams]);

    // Monthly trends (across selected date range)
    const [rawRevenueByMonth] = await query(`
      SELECT DATE_FORMAT(date, '%Y-%m') as ym, COALESCE(SUM(amount), 0) as total
      FROM revenues
      WHERE date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(date, '%Y-%m')
    `, [rangeStart, rangeEnd]);
    const [rawExpenseByMonth] = await query(`
      SELECT DATE_FORMAT(date, '%Y-%m') as ym, COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(date, '%Y-%m')
    `, [rangeStart, rangeEnd]);
    const revenueByMonthMap = new Map(rawRevenueByMonth.map(row => [row.ym, parseFloat(row.total || 0)]));
    const expenseByMonthMap = new Map(rawExpenseByMonth.map(row => [row.ym, parseFloat(row.total || 0)]));

    const monthlyTrends = [];
    const monthCursor = new Date(Date.UTC(rangeStartDate.getUTCFullYear(), rangeStartDate.getUTCMonth(), 1));
    const monthEndCursor = new Date(Date.UTC(rangeEndDate.getUTCFullYear(), rangeEndDate.getUTCMonth(), 1));
    while (monthCursor <= monthEndCursor) {
      const monthKey = `${monthCursor.getUTCFullYear()}-${String(monthCursor.getUTCMonth() + 1).padStart(2, '0')}`;
      const monthName = monthCursor.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const monthYear = monthCursor.getUTCFullYear();
      const revenue = revenueByMonthMap.get(monthKey) || 0;
      const expenses = expenseByMonthMap.get(monthKey) || 0;
      monthlyTrends.push({
        month_num: monthCursor.getUTCMonth() + 1,
        month_name: monthName,
        year: monthYear,
        revenue,
        expenses,
        profit: revenue - expenses
      });
      monthCursor.setUTCMonth(monthCursor.getUTCMonth() + 1);
    }

    // Cash flow (income vs outgoing)
    const [pendingReceivables] = await query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE payment_status IN ('pending', 'partial') AND date BETWEEN ? AND ?",
      [rangeStart, rangeEnd]
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
        FROM revenues WHERE date BETWEEN ? AND ?
        GROUP BY business_unit_id
      ) rev ON bu.id = rev.business_unit_id
      LEFT JOIN (
        SELECT business_unit_id, SUM(amount) as total
        FROM expenses WHERE date BETWEEN ? AND ?
        GROUP BY business_unit_id
      ) exp ON bu.id = exp.business_unit_id
      WHERE bu.is_active = TRUE
      ${unitSearchFilter}
      ORDER BY profit DESC
    `, [rangeStart, rangeEnd, rangeStart, rangeEnd, ...unitSearchParams]);

    // Growth rate compared to previous same-length period
    const rangeDaySpan = Math.max(1, Math.floor((rangeEndDate.getTime() - rangeStartDate.getTime()) / 86400000) + 1);
    const previousPeriodEndDate = addDaysUTC(rangeStartDate, -1);
    const previousPeriodStartDate = addDaysUTC(previousPeriodEndDate, -(rangeDaySpan - 1));
    const previousPeriodStart = toISODate(previousPeriodStartDate);
    const previousPeriodEnd = toISODate(previousPeriodEndDate);
    const [previousPeriodRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE date BETWEEN ? AND ?',
      [previousPeriodStart, previousPeriodEnd]
    );

    const previousRev = parseFloat(previousPeriodRevenue[0].total);
    const hasCurrentActivity =
      periodRev > 0 ||
      periodExp > 0 ||
      parseFloat(monthlyRevenue[0].total) > 0 ||
      parseFloat(monthlyExpense[0].total) > 0 ||
      parseFloat(dailyRevenue[0].total) > 0 ||
      parseFloat(dailyExpense[0].total) > 0;

    const growthRate = previousRev > 0
      ? (((periodRev - previousRev) / previousRev) * 100).toFixed(2)
      : (hasCurrentActivity ? 100 : 0);

    // Recent transactions
    const transactionSearchFilter = searchText
      ? ' AND (src.category LIKE ? OR src.description LIKE ? OR src.business_unit LIKE ?)'
      : '';
    const transactionSearchParams = searchText
      ? [`%${searchText}%`, `%${searchText}%`, `%${searchText}%`]
      : [];
    const [recentTransactions] = await query(`
      SELECT * FROM (
      (SELECT 'income' as type, r.category, r.amount, r.date, bu.name as business_unit, r.description
       FROM revenues r JOIN business_units bu ON r.business_unit_id = bu.id
       WHERE r.date BETWEEN ? AND ?
       ORDER BY r.date DESC LIMIT 50)
      UNION ALL
      (SELECT 'expense' as type, e.category, e.amount, e.date, bu.name as business_unit, e.description
       FROM expenses e JOIN business_units bu ON e.business_unit_id = bu.id
       WHERE e.date BETWEEN ? AND ?
       ORDER BY e.date DESC LIMIT 50)
      ) src
      WHERE 1=1
      ${transactionSearchFilter}
      ORDER BY src.date DESC LIMIT 10
    `, [rangeStart, rangeEnd, rangeStart, rangeEnd, ...transactionSearchParams]);

    res.json({
      success: true,
      data: {
        filters: {
          start: rangeStart,
          end: rangeEnd,
          month_start: monthStart,
          month_end: monthEnd,
          year_start: yearStart,
          year_end: yearEnd,
          previous_start: previousPeriodStart,
          previous_end: previousPeriodEnd
        },
        summary: {
          revenue: {
            daily: parseFloat(dailyRevenue[0].total),
            monthly: parseFloat(monthlyRevenue[0].total),
            yearly: periodRev
          },
          expenses: {
            daily: parseFloat(dailyExpense[0].total),
            monthly: parseFloat(monthlyExpense[0].total),
            yearly: periodExp
          },
          netProfit,
          profitMargin: parseFloat(profitMargin),
          cashFlow: periodRev - periodExp - parseFloat(pendingReceivables[0].total),
          pendingReceivables: parseFloat(pendingReceivables[0].total),
          growthRate: parseFloat(growthRate),
          hasActivity: hasCurrentActivity
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
