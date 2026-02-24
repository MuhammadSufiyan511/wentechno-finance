import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import exceljs from 'exceljs';
import PDFDocument from 'pdfkit';
import { monthToNumber } from '../utils/dateUtils.js';

const router = Router();
const { Workbook } = exceljs;

// GET /api/reports/monthly
router.get('/monthly', auth, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    let m = monthToNumber(month);
    if (!m) m = new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();

    const [revenue] = await _query(`
      SELECT bu.name, bu.code, COALESCE(SUM(r.amount), 0) as total
      FROM business_units bu
      LEFT JOIN revenues r ON bu.id = r.business_unit_id AND MONTH(r.date) = ? AND YEAR(r.date) = ?
      GROUP BY bu.id, bu.name, bu.code ORDER BY bu.id
    `, [m, y]);

    const [expenses] = await _query(`
      SELECT bu.name, bu.code, COALESCE(SUM(e.amount), 0) as total
      FROM business_units bu
      LEFT JOIN expenses e ON bu.id = e.business_unit_id AND MONTH(e.date) = ? AND YEAR(e.date) = ?
      GROUP BY bu.id, bu.name, bu.code ORDER BY bu.id
    `, [m, y]);

    const [totals] = await _query(`
      SELECT 
        COALESCE((SELECT SUM(amount) FROM revenues WHERE MONTH(date) = ? AND YEAR(date) = ?), 0) as total_revenue,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE MONTH(date) = ? AND YEAR(date) = ?), 0) as total_expenses
    `, [m, y, m, y]);

    const totalRev = parseFloat(totals[0].total_revenue);
    const totalExp = parseFloat(totals[0].total_expenses);

    res.json({
      success: true,
      data: {
        month: m,
        year: y,
        revenue,
        expenses,
        summary: {
          totalRevenue: totalRev,
          totalExpenses: totalExp,
          netProfit: totalRev - totalExp,
          profitMargin: totalRev > 0 ? (((totalRev - totalExp) / totalRev) * 100).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/yearly
router.get('/yearly', auth, async (req, res, next) => {
  try {
    const y = req.query.year || new Date().getFullYear();

    const [monthlyBreakdown] = await _query(`
      SELECT 
        m.month_num,
        m.month_name,
        COALESCE(rev.total, 0) as revenue,
        COALESCE(exp.total, 0) as expenses,
        COALESCE(rev.total, 0) - COALESCE(exp.total, 0) as profit
      FROM (
        SELECT 1 as month_num, 'Jan' as month_name UNION SELECT 2, 'Feb' 
        UNION SELECT 3, 'Mar' UNION SELECT 4, 'Apr' UNION SELECT 5, 'May' 
        UNION SELECT 6, 'Jun' UNION SELECT 7, 'Jul' UNION SELECT 8, 'Aug' 
        UNION SELECT 9, 'Sep' UNION SELECT 10, 'Oct' UNION SELECT 11, 'Nov' 
        UNION SELECT 12, 'Dec'
      ) m
      LEFT JOIN (SELECT MONTH(date) as mo, SUM(amount) as total FROM revenues WHERE YEAR(date) = ? GROUP BY MONTH(date)) rev ON m.month_num = rev.mo
      LEFT JOIN (SELECT MONTH(date) as mo, SUM(amount) as total FROM expenses WHERE YEAR(date) = ? GROUP BY MONTH(date)) exp ON m.month_num = exp.mo
      ORDER BY m.month_num
    `, [y, y]);

    const [unitBreakdown] = await _query(`
      SELECT 
        bu.name, bu.code,
        COALESCE(rev.total, 0) as revenue,
        COALESCE(exp.total, 0) as expenses,
        COALESCE(rev.total, 0) - COALESCE(exp.total, 0) as profit
      FROM business_units bu
      LEFT JOIN (SELECT business_unit_id, SUM(amount) as total FROM revenues WHERE YEAR(date) = ? GROUP BY business_unit_id) rev ON bu.id = rev.business_unit_id
      LEFT JOIN (SELECT business_unit_id, SUM(amount) as total FROM expenses WHERE YEAR(date) = ? GROUP BY business_unit_id) exp ON bu.id = exp.business_unit_id
      WHERE bu.is_active = TRUE ORDER BY profit DESC
    `, [y, y]);

    const totalRev = monthlyBreakdown.reduce((s, m) => s + parseFloat(m.revenue), 0);
    const totalExp = monthlyBreakdown.reduce((s, m) => s + parseFloat(m.expenses), 0);

    res.json({
      success: true,
      data: {
        year: y,
        monthlyBreakdown,
        unitBreakdown,
        summary: {
          totalRevenue: totalRev,
          totalExpenses: totalExp,
          netProfit: totalRev - totalExp,
          profitMargin: totalRev > 0 ? (((totalRev - totalExp) / totalRev) * 100).toFixed(2) : 0,
          avgMonthlyRevenue: (totalRev / 12).toFixed(2),
          avgMonthlyExpense: (totalExp / 12).toFixed(2)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/export/excel
router.get('/export/excel', auth, async (req, res, next) => {
  try {
    const { type, year, month } = req.query;
    const y = year || new Date().getFullYear();

    const workbook = new Workbook();
    workbook.creator = 'Financial Tracker';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Business Unit', key: 'name', width: 30 },
      { header: 'Revenue', key: 'revenue', width: 20 },
      { header: 'Expenses', key: 'expenses', width: 20 },
      { header: 'Profit', key: 'profit', width: 20 },
      { header: 'Margin %', key: 'margin', width: 15 }
    ];

    const [unitData] = await _query(`
      SELECT bu.name,
        COALESCE(rev.total, 0) as revenue,
        COALESCE(exp.total, 0) as expenses,
        COALESCE(rev.total, 0) - COALESCE(exp.total, 0) as profit
      FROM business_units bu
      LEFT JOIN (SELECT business_unit_id, SUM(amount) as total FROM revenues WHERE YEAR(date) = ? GROUP BY business_unit_id) rev ON bu.id = rev.business_unit_id
      LEFT JOIN (SELECT business_unit_id, SUM(amount) as total FROM expenses WHERE YEAR(date) = ? GROUP BY business_unit_id) exp ON bu.id = exp.business_unit_id
      WHERE bu.is_active = TRUE
    `, [y, y]);

    unitData.forEach(row => {
      const rev = parseFloat(row.revenue);
      const profit = parseFloat(row.profit);
      summarySheet.addRow({
        name: row.name,
        revenue: rev,
        expenses: parseFloat(row.expenses),
        profit: profit,
        margin: rev > 0 ? ((profit / rev) * 100).toFixed(2) + '%' : '0%'
      });
    });

    // Style header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } };
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

    // Revenue details sheet
    const revenueSheet = workbook.addWorksheet('Revenue Details');
    revenueSheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Business Unit', key: 'business_unit', width: 25 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Description', key: 'description', width: 35 }
    ];

    let revenueQuery = `SELECT r.date, bu.name as business_unit, r.category, r.amount, r.payment_status as status, r.description
                        FROM revenues r JOIN business_units bu ON r.business_unit_id = bu.id WHERE YEAR(r.date) = ?`;
    const params = [y];
    const mNum = monthToNumber(month);
    if (mNum) { revenueQuery += ' AND MONTH(r.date) = ?'; params.push(mNum); }
    revenueQuery += ' ORDER BY r.date DESC';

    const [revenues] = await _query(revenueQuery, params);
    revenues.forEach(r => revenueSheet.addRow(r));
    revenueSheet.getRow(1).font = { bold: true };

    // Expense details sheet
    const expenseSheet = workbook.addWorksheet('Expense Details');
    expenseSheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Business Unit', key: 'business_unit', width: 25 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Type', key: 'expense_type', width: 12 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Description', key: 'description', width: 35 }
    ];

    let expenseQuery = `SELECT e.date, bu.name as business_unit, e.category, e.expense_type, e.amount, e.description
                        FROM expenses e JOIN business_units bu ON e.business_unit_id = bu.id WHERE YEAR(e.date) = ?`;
    const eParams = [y];
    const emNum = monthToNumber(month);
    if (emNum) { expenseQuery += ' AND MONTH(e.date) = ?'; eParams.push(emNum); }
    expenseQuery += ' ORDER BY e.date DESC';

    const [expenses] = await _query(expenseQuery, eParams);
    expenses.forEach(e => expenseSheet.addRow(e));
    expenseSheet.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=financial-report-${y}${month ? '-' + month : ''}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/export/pdf
router.get('/export/pdf', auth, async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const y = year || new Date().getFullYear();

    const [unitData] = await _query(`
      SELECT bu.name,
        COALESCE(rev.total, 0) as revenue,
        COALESCE(exp.total, 0) as expenses,
        COALESCE(rev.total, 0) - COALESCE(exp.total, 0) as profit
      FROM business_units bu
      LEFT JOIN (SELECT business_unit_id, SUM(amount) as total FROM revenues WHERE YEAR(date) = ? GROUP BY business_unit_id) rev ON bu.id = rev.business_unit_id
      LEFT JOIN (SELECT business_unit_id, SUM(amount) as total FROM expenses WHERE YEAR(date) = ? GROUP BY business_unit_id) exp ON bu.id = exp.business_unit_id
      WHERE bu.is_active = TRUE
    `, [y, y]);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=financial-report-${y}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Financial Report', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(`Year: ${y}${month ? ' | Month: ' + month : ''}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    const totalRev = unitData.reduce((s, r) => s + parseFloat(r.revenue), 0);
    const totalExp = unitData.reduce((s, r) => s + parseFloat(r.expenses), 0);
    const netProfit = totalRev - totalExp;

    doc.fontSize(16).font('Helvetica-Bold').text('Financial Summary');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Revenue: Rs. ${totalRev.toLocaleString()}`);
    doc.text(`Total Expenses: Rs. ${totalExp.toLocaleString()}`);
    doc.text(`Net Profit: Rs. ${netProfit.toLocaleString()}`);
    doc.text(`Profit Margin: ${totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(2) : 0}%`);
    doc.moveDown(2);

    // Business Unit Breakdown
    doc.fontSize(16).font('Helvetica-Bold').text('Business Unit Performance');
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const col1 = 50, col2 = 220, col3 = 320, col4 = 420;

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Business Unit', col1, tableTop);
    doc.text('Revenue', col2, tableTop);
    doc.text('Expenses', col3, tableTop);
    doc.text('Profit', col4, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(520, tableTop + 15).stroke();

    let rowY = tableTop + 25;
    doc.font('Helvetica').fontSize(10);

    unitData.forEach(unit => {
      if (rowY > 700) {
        doc.addPage();
        rowY = 50;
      }
      doc.text(unit.name, col1, rowY, { width: 160 });
      doc.text(`Rs. ${parseFloat(unit.revenue).toLocaleString()}`, col2, rowY);
      doc.text(`Rs. ${parseFloat(unit.expenses).toLocaleString()}`, col3, rowY);
      doc.text(`Rs. ${parseFloat(unit.profit).toLocaleString()}`, col4, rowY);
      rowY += 20;
    });

    // Footer
    doc.moveDown(3);
    doc.fontSize(9).font('Helvetica').fillColor('#888');
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.text('Company Financial Tracker System', { align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
});

export default router;
