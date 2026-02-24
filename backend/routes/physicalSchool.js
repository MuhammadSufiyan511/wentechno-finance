import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { logAudit } from '../middleware/auditTrail.js';
import { checkPeriodClose } from '../middleware/checkPeriodClose.js';
import { approvalRequired } from '../middleware/approvalRequired.js';
import { validate, transactionRules, studentRules } from '../middleware/validator.js';
import { monthToNumber } from '../utils/dateUtils.js';

const router = Router();
const BU_ID = 4; // Physical School business unit ID

const inferChallanPeriod = (challan) => {
  const match = /^CHL-\d+-(\d{1,2})-(\d{4})-/.exec(String(challan.challan_number || ''));
  if (match) return { month: Number(match[1]), year: Number(match[2]) };
  if (challan.due_date) {
    const d = new Date(challan.due_date);
    if (!Number.isNaN(d.getTime())) return { month: d.getMonth() + 1, year: d.getFullYear() };
  }
  return { month: null, year: null };
};

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

const syncFeeRevenue = async (fee) => {
  const paidAmount = Number(fee.paid_amount || 0);
  const paymentDate = fee.paid_date || new Date().toISOString().split('T')[0];
  const paymentStatus = paidAmount >= Number(fee.amount || 0) ? 'paid' : 'partial';
  const description = `FeeCollection#${fee.id} - Student#${fee.student_id} - ${fee.month} ${fee.year}`;

  if (paidAmount <= 0) {
    await _query(
      'DELETE FROM revenues WHERE business_unit_id = ? AND description LIKE ?',
      [BU_ID, `FeeCollection#${fee.id}%`]
    );
    return;
  }

  const [existing] = await _query(
    'SELECT id FROM revenues WHERE business_unit_id = ? AND description LIKE ? ORDER BY id DESC LIMIT 1',
    [BU_ID, `FeeCollection#${fee.id}%`]
  );

  if (existing.length > 0) {
    await _query(
      'UPDATE revenues SET category = ?, amount = ?, description = ?, date = ?, payment_status = ? WHERE id = ?',
      ['Fee Collection', paidAmount, description, paymentDate, paymentStatus, existing[0].id]
    );
    return;
  }

  await insertRevenueCompat(
    [BU_ID, 'Fee Collection', paidAmount, description, paymentDate, paymentStatus, 'na'],
    [BU_ID, 'Fee Collection', paidAmount, description, paymentDate, paymentStatus]
  );
};

const syncFeeChallan = async (fee) => {
  if (!fee || fee.fee_type !== 'monthly') return;

  const feeMonth = monthToNumber(fee.month);
  const feeYear = Number(fee.year || 0);
  if (!feeMonth || !feeYear) return;

  const [challans] = await _query(
    'SELECT id, challan_number, due_date, status FROM fee_challans WHERE student_id = ? ORDER BY id DESC',
    [fee.student_id]
  );
  if (!challans.length) return;

  const matched = challans.filter(challan => {
    const period = inferChallanPeriod(challan);
    return period.month === feeMonth && period.year === feeYear;
  });
  if (!matched.length) return;

  const today = new Date().toISOString().slice(0, 10);
  const paidAmt = Number(fee.paid_amount || 0);
  const amount = Number(fee.amount || 0);
  const baseStatus = paidAmt >= amount ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid';

  for (const challan of matched) {
    const dueSql = challan.due_date ? new Date(challan.due_date).toISOString().slice(0, 10) : null;
    const status = baseStatus === 'unpaid' && dueSql && dueSql < today ? 'overdue' : baseStatus;
    await _query('UPDATE fee_challans SET status = ? WHERE id = ?', [status, challan.id]);
  }
};

// GET /api/physical-school/overview
router.get('/overview', auth, async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentMonthFull = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const currentMonthShort = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();

    const [studentStats] = await _query(`
      SELECT 
        COUNT(*) as total_students,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_students,
        COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_fee ELSE 0 END), 0) as expected_monthly
      FROM school_students
    `);

    const [monthlyProgress] = await _query(`
      SELECT
        COALESCE(SUM(
          CASE
            WHEN fc.id IS NULL THEN ss.monthly_fee
            WHEN fc.status IN ('pending', 'partial') THEN GREATEST(fc.amount - COALESCE(fc.paid_amount, 0), 0)
            ELSE 0
          END
        ), 0) as monthly_pending,
        SUM(
          CASE
            WHEN fc.id IS NULL THEN 1
            WHEN fc.status IN ('pending', 'partial') THEN 1
            ELSE 0
          END
        ) as monthly_defaulters
      FROM school_students ss
      LEFT JOIN (
        SELECT fc.*
        FROM fee_collections fc
        JOIN (
          SELECT student_id, MAX(id) as latest_id
          FROM fee_collections
        WHERE fee_type = 'monthly'
          AND year = ?
          AND (
            LOWER(TRIM(month)) = ?
            OR LOWER(TRIM(month)) = ?
            OR CAST(TRIM(month) AS UNSIGNED) = ?
          )
          GROUP BY student_id
        ) latest ON latest.latest_id = fc.id
      ) fc ON ss.id = fc.student_id
      WHERE ss.status = 'active'
    `, [currentYear, currentMonthFull, currentMonthShort, currentMonth]);

    const [periodFeeStats] = await _query(`
      SELECT 
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(CASE WHEN fee_type <> 'monthly' THEN GREATEST(amount - paid_amount, 0) ELSE 0 END), 0) as non_monthly_pending,
        COUNT(DISTINCT CASE WHEN fee_type <> 'monthly' AND status IN ('pending', 'partial') THEN student_id END) as non_monthly_defaulters
      FROM fee_collections
      WHERE year = ? 
      AND (
        LOWER(TRIM(month)) = ?
        OR LOWER(TRIM(month)) = ?
        OR CAST(TRIM(month) AS UNSIGNED) = ?
      )
    `, [currentYear, currentMonthFull, currentMonthShort, currentMonth]);

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

    const rev = parseFloat(yearlyRevenue[0].total) || 0;
    const exp = parseFloat(yearlyExpenses[0].total) || 0;
    const expectedMonthly = parseFloat(studentStats[0].expected_monthly) || 0;
    const collected = parseFloat(periodFeeStats[0].total_collected) || 0;
    const monthlyPending = parseFloat(monthlyProgress[0].monthly_pending) || 0;
    const nonMonthlyPending = parseFloat(periodFeeStats[0].non_monthly_pending) || 0;
    const pending = monthlyPending + nonMonthlyPending;
    const activeStudents = Number(studentStats[0].active_students) || 0;
    const collectionPercentage = expectedMonthly > 0 ? ((collected / expectedMonthly) * 100).toFixed(1) : 0;
    const defaultersCount =
      (Number(monthlyProgress[0].monthly_defaulters) || 0) +
      (Number(periodFeeStats[0].non_monthly_defaulters) || 0);

    res.json({
      success: true,
      data: {
        totalStudents: Number(studentStats[0].total_students) || 0,
        activeStudents,
        expectedMonthly,
        feeCollected: collected,
        feePending: pending,
        defaultersCount,
        yearlyRevenue: rev,
        yearlyExpenses: exp,
        netProfit: rev - exp,
        expensePerStudent: activeStudents > 0 ? Number((exp / activeStudents).toFixed(2)) : 0,
        expenseBreakdown,
        collectionPercentage: Number(collectionPercentage)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reset', auth, async (req, res, next) => {
  try {
    await _query('DELETE FROM fee_collections');
    await _query('DELETE FROM school_students');
    await _query('DELETE FROM fee_challans');
    await _query('DELETE FROM revenues WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM expenses WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM transactions WHERE business_unit_id = ?', [BU_ID]);
    res.json({ success: true, message: 'Physical School panel data reset successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/defaulters/mark', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { student_id, month, year, amount } = req.body;
    if (!student_id) return res.status(400).json({ success: false, message: 'student_id is required' });

    const now = new Date();
    const monthValue = month || now.toLocaleString('en-US', { month: 'long' });
    const yearValue = Number(year || now.getFullYear());
    const monthNum = Number(monthValue) || now.getMonth() + 1;
    const monthLong = (Number(monthValue)
      ? new Date(yearValue, monthNum - 1, 1).toLocaleString('en-US', { month: 'long' })
      : String(monthValue)
    ).toLowerCase();
    const monthShort = (Number(monthValue)
      ? new Date(yearValue, monthNum - 1, 1).toLocaleString('en-US', { month: 'short' })
      : String(monthValue).slice(0, 3)
    ).toLowerCase();

    const [student] = await _query(
      'SELECT id, name, monthly_fee FROM school_students WHERE id = ?',
      [student_id]
    );
    if (student.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });

    const targetAmount = Number(amount ?? student[0].monthly_fee ?? 0);
    if (!(targetAmount > 0)) return res.status(400).json({ success: false, message: 'Amount must be positive' });

    const [existing] = await _query(
      `SELECT * FROM fee_collections
       WHERE student_id = ? AND fee_type = 'monthly' AND year = ?
       AND (
         LOWER(TRIM(month)) = ?
         OR LOWER(TRIM(month)) = ?
         OR CAST(TRIM(month) AS UNSIGNED) = ?
       )
       ORDER BY id DESC LIMIT 1`,
      [student_id, yearValue, monthLong, monthShort, monthNum]
    );

    let feeId;
    if (existing.length > 0) {
      feeId = existing[0].id;
      const paidAmt = Number(existing[0].paid_amount || 0);
      const status = paidAmt >= targetAmount ? 'paid' : paidAmt > 0 ? 'partial' : 'pending';
      await _query(
        'UPDATE fee_collections SET amount = ?, status = ? WHERE id = ?',
        [targetAmount, status, feeId]
      );
    } else {
      const [result] = await _query(
        `INSERT INTO fee_collections (student_id, amount, fee_type, month, year, status, paid_amount, payment_method, paid_date)
         VALUES (?, ?, 'monthly', ?, ?, 'pending', 0, 'cash', NULL)`,
        [student_id, targetAmount, monthValue, yearValue]
      );
      feeId = result.insertId;
    }

    const [fee] = await _query('SELECT * FROM fee_collections WHERE id = ?', [feeId]);
    await syncFeeRevenue(fee[0]);
    res.status(201).json({ success: true, data: fee[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/defaulters/:id/clear', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [fee] = await _query('SELECT * FROM fee_collections WHERE id = ?', [id]);
    if (fee.length === 0) return res.status(404).json({ success: false, message: 'Defaulter record not found' });

    const paidDate = new Date().toISOString().slice(0, 10);
    await _query(
      'UPDATE fee_collections SET status = ?, paid_amount = ?, paid_date = ? WHERE id = ?',
      ['paid', fee[0].amount, paidDate, id]
    );
    await syncFeeRevenue({ ...fee[0], paid_amount: fee[0].amount, paid_date: paidDate, status: 'paid' });

    res.json({ success: true, message: 'Defaulter moved back successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/defaulters/:id/escalate', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const daysOverdue = Math.max(1, Number(req.body?.days_overdue || 30));

    const [feeRows] = await _query(
      `SELECT fc.*, ss.name as student_name
       FROM fee_collections fc
       JOIN school_students ss ON ss.id = fc.student_id
       WHERE fc.id = ?`,
      [id]
    );
    if (feeRows.length === 0) return res.status(404).json({ success: false, message: 'Defaulter record not found' });

    const fee = feeRows[0];
    const dueAmount = Math.max(0, Number(fee.amount || 0) - Number(fee.paid_amount || 0));
    if (dueAmount <= 0) return res.status(400).json({ success: false, message: 'No pending due to escalate' });

    const challanPrefix = `DEF-${fee.id}-`;
    const [existing] = await _query(
      'SELECT * FROM fee_challans WHERE challan_number LIKE ? ORDER BY id DESC LIMIT 1',
      [`${challanPrefix}%`]
    );

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - daysOverdue);
    const dueDateSql = dueDate.toISOString().slice(0, 10);

    if (existing.length > 0) {
      await _query(
        'UPDATE fee_challans SET total_amount = ?, due_date = ?, status = ? WHERE id = ?',
        [dueAmount, dueDateSql, 'overdue', existing[0].id]
      );
    } else {
      const challanNumber = `${challanPrefix}${Date.now()}`;
      await _query(
        'INSERT INTO fee_challans (student_id, challan_number, due_date, total_amount, status) VALUES (?, ?, ?, ?, ?)',
        [fee.student_id, challanNumber, dueDateSql, dueAmount, 'overdue']
      );
    }

    res.json({ success: true, message: `Defaulter escalated (${daysOverdue} days overdue)` });
  } catch (error) {
    next(error);
  }
});

// --- STUDENTS ---
router.get('/students', auth, async (req, res, next) => {
  try {
    const [students] = await _query('SELECT * FROM school_students ORDER BY class, section, name');
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
});

router.post('/students', auth, validate(studentRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { student_id_number, name, class: cls, section, parent_name, phone, email,
      address, monthly_fee, admission_fee, admission_date } = req.body;

    const [result] = await _query(
      `INSERT INTO school_students (student_id_number, name, class, section, parent_name, phone, email, 
       address, monthly_fee, admission_fee, status, admission_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [student_id_number, name, cls, section, parent_name, phone, email,
        address, monthly_fee, admission_fee || 0, admission_date]
    );

    if (Number(admission_fee || 0) > 0) {
      await insertRevenueCompat(
        [BU_ID, 'Admission Fee', admission_fee, `Admission: ${name}`, admission_date, 'paid', req.approvalStatus],
        [BU_ID, 'Admission Fee', admission_fee, `Admission: ${name}`, admission_date, 'paid']
      );
    }

    const [student] = await _query('SELECT * FROM school_students WHERE id = ?', [result.insertId]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'students',
      entityId: result.insertId,
      newValues: student[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: student[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/students/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldStudent] = await _query('SELECT * FROM school_students WHERE id = ?', [id]);
    if (oldStudent.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });

    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    if (!updates) return res.status(400).json({ success: false, message: 'No fields provided for update' });

    await _query(`UPDATE school_students SET ${updates} WHERE id = ?`, [...values, id]);
    const [student] = await _query('SELECT * FROM school_students WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'students',
      entityId: id,
      oldValues: oldStudent[0],
      newValues: student[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: student[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/students/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [student] = await _query('SELECT * FROM school_students WHERE id = ?', [id]);
    if (student.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });

    await _query('DELETE FROM school_students WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      module: 'students',
      entityId: id,
      oldValues: student[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// --- FEE COLLECTIONS ---
router.get('/fees', auth, async (req, res, next) => {
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
    next(error);
  }
});

router.post('/fees', auth, checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { student_id, amount, fee_type, month, year, paid_amount, payment_method, paid_date } = req.body;

    const paidAmt = Number(paid_amount || 0);
    const totalAmt = Number(amount || 0);
    const status = paidAmt >= totalAmt ? 'paid' : paidAmt > 0 ? 'partial' : 'pending';
    const paidDate = paidAmt > 0 ? (paid_date || new Date().toISOString().split('T')[0]) : null;

    const [result] = await _query(
      `INSERT INTO fee_collections (student_id, amount, fee_type, month, year, status, paid_amount, payment_method, paid_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, amount, fee_type || 'monthly', month, year, status, paidAmt, payment_method || 'cash', paidDate]
    );

    const [fee] = await _query('SELECT * FROM fee_collections WHERE id = ?', [result.insertId]);
    await syncFeeRevenue(fee[0]);
    await syncFeeChallan(fee[0]);

    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'fees',
      entityId: result.insertId,
      newValues: fee[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, data: fee[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/fees/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldFee] = await _query('SELECT * FROM fee_collections WHERE id = ?', [id]);
    if (oldFee.length === 0) return res.status(404).json({ success: false, message: 'Fee record not found' });

    const fields = { ...req.body };
    const nextAmount = Number(fields.amount ?? oldFee[0].amount);
    const nextPaid = Number(fields.paid_amount ?? oldFee[0].paid_amount);
    const nextStatus = nextPaid >= nextAmount ? 'paid' : nextPaid > 0 ? 'partial' : 'pending';
    const nextPaidDate = nextPaid > 0
      ? (fields.paid_date ?? oldFee[0].paid_date ?? new Date().toISOString().split('T')[0])
      : null;

    fields.status = nextStatus;
    fields.paid_date = nextPaidDate;
    fields.paid_amount = nextPaid;

    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    if (!updates) return res.status(400).json({ success: false, message: 'No fields provided for update' });

    await _query(`UPDATE fee_collections SET ${updates} WHERE id = ?`, [...values, id]);
    const [fee] = await _query('SELECT * FROM fee_collections WHERE id = ?', [id]);
    await syncFeeRevenue(fee[0]);
    await syncFeeChallan(fee[0]);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'fees',
      entityId: id,
      oldValues: oldFee[0],
      newValues: fee[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: fee[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/fees/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [fee] = await _query('SELECT * FROM fee_collections WHERE id = ?', [id]);
    if (fee.length === 0) return res.status(404).json({ success: false, message: 'Fee record not found' });

    await _query('DELETE FROM fee_collections WHERE id = ?', [id]);
    await _query(
      'DELETE FROM revenues WHERE business_unit_id = ? AND description LIKE ?',
      [BU_ID, `FeeCollection#${id}%`]
    );
    await syncFeeChallan({ ...fee[0], paid_amount: 0, status: 'pending' });

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      module: 'fees',
      entityId: id,
      oldValues: fee[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Fee record deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET Defaulters
router.get('/defaulters', auth, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const monthValue = month || now.toLocaleString('en-US', { month: 'long' });
    const yearValue = Number(year || now.getFullYear());
    const monthNum = Number(monthValue) || now.getMonth() + 1;
    const monthLong = (Number(monthValue)
      ? new Date(yearValue, monthNum - 1, 1).toLocaleString('en-US', { month: 'long' })
      : String(monthValue)
    ).toLowerCase();
    const monthShort = (Number(monthValue)
      ? new Date(yearValue, monthNum - 1, 1).toLocaleString('en-US', { month: 'short' })
      : String(monthValue).slice(0, 3)
    ).toLowerCase();

    const [defaulters] = await _query(`
      SELECT
        agg.id as id,
        ss.id as student_id,
        ss.name as student_name,
        ss.class,
        ss.section,
        ss.parent_name,
        ss.phone,
        COALESCE(agg.amount, ss.monthly_fee) as amount,
        COALESCE(agg.paid_amount, 0) as paid_amount,
        CASE
          WHEN agg.id IS NULL THEN 'pending'
          ELSE agg.status
        END as status,
        ? as month,
        ? as year,
        'monthly' as fee_type,
        COALESCE(agg.payment_method, 'cash') as payment_method,
        agg.paid_date
      FROM school_students ss
      LEFT JOIN (
        SELECT
          fc.*
        FROM fee_collections fc
        JOIN (
          SELECT student_id, MAX(id) as latest_id
          FROM fee_collections
          WHERE fee_type = 'monthly' AND year = ?
            AND (
              LOWER(TRIM(month)) = ?
              OR LOWER(TRIM(month)) = ?
              OR CAST(TRIM(month) AS UNSIGNED) = ?
            )
          GROUP BY student_id
        ) latest ON latest.latest_id = fc.id
      ) agg ON agg.student_id = ss.id
      WHERE ss.status = 'active' AND (agg.id IS NULL OR agg.status IN ('pending', 'partial'))

      UNION ALL

      SELECT
        fc.id,
        fc.student_id,
        ss.name as student_name,
        ss.class,
        ss.section,
        ss.parent_name,
        ss.phone,
        fc.amount,
        COALESCE(fc.paid_amount, 0) as paid_amount,
        fc.status,
        fc.month,
        fc.year,
        fc.fee_type,
        fc.payment_method,
        fc.paid_date
      FROM fee_collections fc
      JOIN school_students ss ON fc.student_id = ss.id
      WHERE fc.fee_type <> 'monthly'
        AND fc.status IN ('pending', 'partial')
        AND fc.year = ?
        AND (
          LOWER(TRIM(fc.month)) = ?
          OR LOWER(TRIM(fc.month)) = ?
          OR CAST(TRIM(fc.month) AS UNSIGNED) = ?
        )

      ORDER BY class, student_name
    `, [monthValue, yearValue, yearValue, monthLong, monthShort, monthNum, yearValue, monthLong, monthShort, monthNum]);

    res.json({ success: true, data: defaulters });
  } catch (error) {
    next(error);
  }
});

// Expenses
router.get('/expenses', auth, async (req, res, next) => {
  try {
    let query = 'SELECT * FROM expenses WHERE business_unit_id = ?';
    const params = [BU_ID];
    if (req.query.month) { query += ' AND MONTH(date) = ?'; params.push(req.query.month); }
    if (req.query.year) { query += ' AND YEAR(date) = ?'; params.push(req.query.year); }
    query += ' ORDER BY date DESC';
    const [expenses] = await _query(query, params);
    res.json({ success: true, data: expenses });
  } catch (error) {
    next(error);
  }
});

router.post('/expenses', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, expense_type, amount, description, vendor, date } = req.body;
    const [result] = await insertExpenseCompat(
      [BU_ID, category, expense_type || 'fixed', amount, description, vendor, date, req.approvalStatus],
      [BU_ID, category, expense_type || 'fixed', amount, description, vendor, date]
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

router.put('/expenses/:id', auth, checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldExp] = await _query('SELECT * FROM expenses WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);
    if (oldExp.length === 0) return res.status(404).json({ success: false, message: 'Expense not found' });

    const fields = req.body;
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    if (!updates) return res.status(400).json({ success: false, message: 'No fields provided for update' });

    await _query(`UPDATE expenses SET ${updates} WHERE id = ? AND business_unit_id = ?`, [...values, id, BU_ID]);
    const [newExp] = await _query('SELECT * FROM expenses WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'expenses',
      entityId: id,
      oldValues: oldExp[0],
      newValues: newExp[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: newExp[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/expenses/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldExp] = await _query('SELECT * FROM expenses WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);
    if (oldExp.length === 0) return res.status(404).json({ success: false, message: 'Expense not found' });

    await _query('DELETE FROM expenses WHERE id = ? AND business_unit_id = ?', [id, BU_ID]);

    await logAudit({
      userId: req.user.id,
      action: 'delete',
      module: 'expenses',
      entityId: id,
      oldValues: oldExp[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
