import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { checkPeriodClose } from '../middleware/checkPeriodClose.js';

const router = Router();

const monthNameFromNumber = (month) =>
  new Date(2000, Number(month) - 1, 1).toLocaleString('en-US', { month: 'long' });

const monthToNumber = (monthValue) => {
  if (monthValue === null || monthValue === undefined) return null;
  const raw = String(monthValue).trim();
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) return numeric;

  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const lower = raw.toLowerCase();
  const fullIndex = months.indexOf(lower);
  if (fullIndex >= 0) return fullIndex + 1;
  const shortIndex = months.findIndex(m => m.slice(0, 3) === lower.slice(0, 3));
  return shortIndex >= 0 ? shortIndex + 1 : null;
};

const challanPeriod = (challan) => {
  const match = /^CHL-\d+-(\d{1,2})-(\d{4})-/.exec(String(challan.challan_number || ''));
  if (match) return { month: Number(match[1]), year: Number(match[2]) };
  if (challan.due_date) {
    const d = new Date(challan.due_date);
    if (!Number.isNaN(d.getTime())) return { month: d.getMonth() + 1, year: d.getFullYear() };
  }
  return { month: null, year: null };
};

const upsertMonthlyFeeFromChallan = async ({ challan, paidAmount = null, forceStatus = null, paymentMethod = 'cash', paidDate = null }) => {
  const period = challanPeriod(challan);
  if (!period.month || !period.year) return null;

  const amount = Number(challan.total_amount || 0);
  const requestedPaid = paidAmount === null ? null : Number(paidAmount);
  const paidAmt = requestedPaid === null ? null : Math.max(0, Math.min(requestedPaid, amount));
  const feeMonth = monthNameFromNumber(period.month);

  const [existingRows] = await _query(
    `SELECT * FROM fee_collections
     WHERE student_id = ? AND fee_type = 'monthly' AND year = ?
       AND (
         LOWER(TRIM(month)) = LOWER(?)
         OR LOWER(TRIM(month)) = LOWER(?)
         OR CAST(TRIM(month) AS UNSIGNED) = ?
       )
     ORDER BY id DESC LIMIT 1`,
    [challan.student_id, period.year, feeMonth, feeMonth.slice(0, 3), period.month]
  );

  const existing = existingRows[0];
  const resolvedPaid = paidAmt === null ? Number(existing?.paid_amount || 0) : paidAmt;
  const autoStatus = resolvedPaid >= amount ? 'paid' : resolvedPaid > 0 ? 'partial' : 'pending';
  const feeStatus = forceStatus || autoStatus;
  const resolvedPaidDate = resolvedPaid > 0 ? (paidDate || new Date().toISOString().slice(0, 10)) : null;

  if (existing) {
    await _query(
      `UPDATE fee_collections
       SET amount = ?, status = ?, paid_amount = ?, payment_method = ?, paid_date = ?
       WHERE id = ?`,
      [amount, feeStatus, resolvedPaid, paymentMethod, resolvedPaidDate, existing.id]
    );
    const [updated] = await _query('SELECT * FROM fee_collections WHERE id = ?', [existing.id]);
    return updated[0];
  }

  const [result] = await _query(
    `INSERT INTO fee_collections (student_id, amount, fee_type, month, year, status, paid_amount, payment_method, paid_date)
     VALUES (?, ?, 'monthly', ?, ?, ?, ?, ?, ?)`,
    [challan.student_id, amount, feeMonth, period.year, feeStatus, resolvedPaid, paymentMethod, resolvedPaidDate]
  );
  const [created] = await _query('SELECT * FROM fee_collections WHERE id = ?', [result.insertId]);
  return created[0];
};

// ============ FEE CHALLANS ============

router.get('/challans', auth, async (req, res, next) => {
  try {
    const { month, year, status } = req.query;
    let query = `
      SELECT f.*, s.name as student_name, s.class, s.section, s.parent_name, s.phone
      FROM fee_challans f
      JOIN school_students s ON f.student_id = s.id
      WHERE 1 = 1
    `;
    const params = [];

    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }

    if (month || year) {
      query += ' AND f.challan_number LIKE ?';
      const m = month ? String(month) : '%';
      const y = year ? String(year) : '%';
      params.push(`CHL-%-${m}-${y}-%`);
    }

    query += ' ORDER BY f.due_date DESC, f.id DESC';
    const [challans] = await _query(query, params);
    res.json({ success: true, data: challans });
  } catch (error) {
    next(error);
  }
});

router.post('/challans/generate', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { student_id, month, year, due_date, amount } = req.body;
    if (!student_id || !month || !year) {
      return res.status(400).json({ success: false, message: 'student_id, month and year are required' });
    }

    const monthNum = monthToNumber(month);
    const yearNum = Number(year);
    if (!monthNum || !yearNum) {
      return res.status(400).json({ success: false, message: 'Invalid month/year' });
    }

    const [studentRows] = await _query(
      'SELECT id, monthly_fee FROM school_students WHERE id = ?',
      [student_id]
    );
    if (!studentRows.length) return res.status(404).json({ success: false, message: 'Student not found' });

    const [existing] = await _query(
      'SELECT id FROM fee_challans WHERE challan_number LIKE ? ORDER BY id DESC LIMIT 1',
      [`CHL-${student_id}-${monthNum}-${yearNum}-%`]
    );
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Challan already generated for this student and month' });
    }

    const challanAmount = Number(amount || studentRows[0].monthly_fee || 0);
    if (!(challanAmount > 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be positive' });
    }

    const dueDate =
      due_date ||
      new Date(yearNum, monthNum - 1, 10).toISOString().slice(0, 10);

    const challanNumber = `CHL-${student_id}-${monthNum}-${yearNum}-${Date.now()}`;
    const [result] = await _query(
      'INSERT INTO fee_challans (student_id, challan_number, due_date, total_amount, status) VALUES (?, ?, ?, ?, ?)',
      [student_id, challanNumber, dueDate, challanAmount, 'unpaid']
    );

    const [rows] = await _query(
      `SELECT f.*, s.name as student_name, s.class, s.section, s.parent_name, s.phone
       FROM fee_challans f
       JOIN school_students s ON f.student_id = s.id
       WHERE f.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, data: rows[0], message: 'Challan generated' });
  } catch (error) {
    next(error);
  }
});

router.put('/challans/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = {};
    if (req.body.due_date) fields.due_date = req.body.due_date;
    if (req.body.total_amount !== undefined) fields.total_amount = Number(req.body.total_amount);

    if (!Object.keys(fields).length) {
      return res.status(400).json({ success: false, message: 'No fields provided for update' });
    }

    if (fields.total_amount !== undefined && !(fields.total_amount > 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be positive' });
    }

    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = Object.values(fields);
    await _query(`UPDATE fee_challans SET ${updates} WHERE id = ?`, [...values, id]);

    const [challanRows] = await _query('SELECT * FROM fee_challans WHERE id = ?', [id]);
    if (!challanRows.length) return res.status(404).json({ success: false, message: 'Challan not found' });
    await upsertMonthlyFeeFromChallan({ challan: challanRows[0] });

    const [rows] = await _query(
      `SELECT f.*, s.name as student_name, s.class, s.section, s.parent_name, s.phone
       FROM fee_challans f
       JOIN school_students s ON f.student_id = s.id
       WHERE f.id = ?`,
      [id]
    );

    res.json({ success: true, data: rows[0], message: 'Challan updated' });
  } catch (error) {
    next(error);
  }
});

router.patch('/challans/:id/status', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, paid_amount, payment_method, paid_date } = req.body;
    const allowed = ['unpaid', 'partial', 'paid', 'overdue'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const [challanRows] = await _query('SELECT * FROM fee_challans WHERE id = ?', [id]);
    if (!challanRows.length) return res.status(404).json({ success: false, message: 'Challan not found' });
    const challan = challanRows[0];
    const total = Number(challan.total_amount || 0);

    let paidAmount = null;
    if (status === 'paid') paidAmount = total;
    if (status === 'unpaid' || status === 'overdue') paidAmount = 0;
    if (status === 'partial') {
      const partialAmount = Number(paid_amount);
      if (!(partialAmount > 0) || partialAmount >= total) {
        return res.status(400).json({ success: false, message: 'For partial status, paid_amount must be > 0 and < total amount' });
      }
      paidAmount = partialAmount;
    }

    await _query('UPDATE fee_challans SET status = ? WHERE id = ?', [status, id]);
    await upsertMonthlyFeeFromChallan({
      challan,
      paidAmount,
      paymentMethod: payment_method || 'cash',
      paidDate: paid_date || null,
      forceStatus: status === 'overdue' ? 'pending' : null
    });

    const [rows] = await _query(
      `SELECT f.*, s.name as student_name, s.class, s.section, s.parent_name, s.phone
       FROM fee_challans f
       JOIN school_students s ON f.student_id = s.id
       WHERE f.id = ?`,
      [id]
    );

    res.json({ success: true, data: rows[0], message: `Challan marked as ${status}` });
  } catch (error) {
    next(error);
  }
});

router.post('/challans/:id/reminder', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [challan] = await _query('SELECT id FROM fee_challans WHERE id = ?', [id]);
    if (!challan.length) return res.status(404).json({ success: false, message: 'Challan not found' });
    res.json({ success: true, message: 'Reminder marked as sent' });
  } catch (error) {
    next(error);
  }
});

router.delete('/challans/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [challanRows] = await _query('SELECT * FROM fee_challans WHERE id = ?', [id]);
    if (!challanRows.length) return res.status(404).json({ success: false, message: 'Challan not found' });
    const challan = challanRows[0];
    const period = challanPeriod(challan);
    const monthName = period.month ? monthNameFromNumber(period.month) : null;

    await _query('DELETE FROM fee_challans WHERE id = ?', [id]);

    if (period.month && period.year) {
      await _query(
        `DELETE FROM fee_collections
         WHERE student_id = ? AND fee_type = 'monthly' AND year = ?
           AND (
             LOWER(TRIM(month)) = LOWER(?)
             OR LOWER(TRIM(month)) = LOWER(?)
             OR CAST(TRIM(month) AS UNSIGNED) = ?
           )
         ORDER BY id DESC
         LIMIT 1`,
        [challan.student_id, period.year, monthName, monthName.slice(0, 3), period.month]
      );
    }

    res.json({ success: true, message: 'Challan deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ============ DEFAULTERS & ESCALATION ============

router.get('/defaulters/escalations', auth, async (req, res, next) => {
  try {
    const [defaulters] = await _query(`
      SELECT 
        s.id, s.name, s.parent_name, s.phone,
        COUNT(f.id) as pending_challans,
        SUM(f.total_amount) as total_due,
        CASE 
          WHEN COUNT(f.id) >= 3 THEN 'level_3_legal'
          WHEN COUNT(f.id) = 2 THEN 'level_2_warning'
          ELSE 'level_1_reminder'
        END as escalation_level
      FROM school_students s
      JOIN fee_challans f ON s.id = f.student_id
      WHERE f.status IN ('unpaid', 'overdue', 'partial') AND f.due_date < CURDATE()
      GROUP BY s.id, s.name, s.parent_name, s.phone
    `);
    res.json({ success: true, data: defaulters });
  } catch (error) {
    next(error);
  }
});

export default router;
