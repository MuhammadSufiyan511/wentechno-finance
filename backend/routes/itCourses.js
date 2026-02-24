import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { logAudit } from '../middleware/auditTrail.js';
import { checkPeriodClose } from '../middleware/checkPeriodClose.js';
import { approvalRequired } from '../middleware/approvalRequired.js';
import { validate, transactionRules, courseRules, trainerRules } from '../middleware/validator.js';
import { monthToNumber } from '../utils/dateUtils.js';

const router = Router();
const BU_ID = 5;

let itTablesReady = false;
const ensureITTables = async () => {
  if (itTablesReady) return;
  await _query(`
    CREATE TABLE IF NOT EXISTS enrollment_payments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      enrollment_id INT NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method ENUM('cash','bank_transfer','cheque','card','online') DEFAULT 'cash',
      notes TEXT,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  await _query(`
    CREATE TABLE IF NOT EXISTS enrollment_followups (
      id INT PRIMARY KEY AUTO_INCREMENT,
      enrollment_id INT NOT NULL,
      followup_date DATE NOT NULL,
      channel ENUM('call','whatsapp','email','in_person') DEFAULT 'call',
      status ENUM('pending','done','escalated') DEFAULT 'pending',
      notes TEXT,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  try {
    await _query('ALTER TABLE enrollments ADD COLUMN last_contacted_at DATETIME NULL AFTER enrollment_date');
  } catch {
    // Ignore if already exists.
  }
  try {
    await _query('ALTER TABLE enrollments ADD COLUMN next_reminder_date DATE NULL AFTER last_contacted_at');
  } catch {
    // Ignore if already exists.
  }
  try {
    await _query('ALTER TABLE enrollments ADD COLUMN promise_to_pay_date DATE NULL AFTER next_reminder_date');
  } catch {
    // Ignore if already exists.
  }
  try {
    await _query("ALTER TABLE enrollment_followups ADD COLUMN action_type ENUM('call','whatsapp','send_reminder','promise_to_pay','note') DEFAULT 'note' AFTER status");
  } catch {
    // Ignore if already exists.
  }
  try {
    await _query(
      "ALTER TABLE enrollments MODIFY COLUMN status ENUM('active','completed','dropped','refunded','deferred') DEFAULT 'active'"
    );
  } catch {
    // Ignore if already updated.
  }
  itTablesReady = true;
};

const isPeriodClosed = async (dateValue) => {
  if (!dateValue) return false;
  const dt = new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return false;
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;
  const [closed] = await _query(
    'SELECT id FROM period_closes WHERE year = ? AND month = ? AND status = "closed" LIMIT 1',
    [year, month]
  );
  return closed.length > 0;
};

const getRange = (query, fallbackMonth = null, fallbackYear = null) => {
  if (query.from || query.to) return { from: query.from || null, to: query.to || null };
  const now = new Date();
  const month = monthToNumber(query.month) || fallbackMonth || (now.getMonth() + 1);
  const year = Number(query.year || fallbackYear || now.getFullYear());
  if (!Number.isInteger(month) || !Number.isInteger(year)) return null;
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
};

const getEnrollmentWithJoins = async (id) => {
  const [rows] = await _query(
    `
    SELECT
      e.*,
      b.batch_name,
      b.max_students,
      b.current_students,
      c.name as course_name,
      c.fee as course_fee
    FROM enrollments e
    JOIN batches b ON e.batch_id = b.id
    JOIN courses c ON b.course_id = c.id
    WHERE e.id = ?
    `,
    [id]
  );
  return rows[0] || null;
};

// GET /api/it-courses/overview
router.get('/overview', auth, async (req, res, next) => {
  try {
    await ensureITTables();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const range = getRange(req.query, currentMonth, currentYear);
    const from = range.from;
    const to = range.to;

    const [courseStats] = await _query(`
      SELECT COUNT(*) as total_courses,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_courses
      FROM courses
    `);

    const [batchStats] = await _query(`
      SELECT
        COUNT(*) as total_batches,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_batches,
        COALESCE(SUM(current_students), 0) as total_enrolled,
        COALESCE(SUM(max_students), 0) as total_capacity
      FROM batches
    `);

    const [enrollmentStats] = await _query(`
      SELECT
        COUNT(*) as total_enrollments,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_students,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'dropped' THEN 1 ELSE 0 END) as dropped,
        SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded,
        SUM(CASE WHEN status = 'deferred' THEN 1 ELSE 0 END) as deferred,
        COALESCE(SUM(total_fee), 0) as total_fee_expected,
        COALESCE(SUM(fee_paid), 0) as total_fee_collected,
        COALESCE(SUM(refund_amount), 0) as total_refunds,
        SUM(CASE WHEN fee_pending > 0 AND status IN ('active', 'deferred') THEN 1 ELSE 0 END) as defaulters_count
      FROM enrollments
    `);

    const [monthlyEnrollments] = await _query(
      'SELECT COUNT(*) as total FROM enrollments WHERE enrollment_date >= ? AND enrollment_date <= ?',
      [from, to]
    );

    const [periodRevenue] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND date >= ? AND date <= ?',
      [BU_ID, from, to]
    );
    const [periodExpenses] = await _query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND date >= ? AND date <= ?',
      [BU_ID, from, to]
    );

    const [trainerStats] = await _query(`
      SELECT
        t.id, t.name, t.specialization, t.payment_type, t.salary, t.per_batch_fee,
        COUNT(b.id) as batches_count,
        COALESCE(SUM(b.current_students), 0) as total_students
      FROM trainers t
      LEFT JOIN batches b ON t.id = b.trainer_id AND b.status IN ('active', 'upcoming')
      WHERE t.status = 'active'
      GROUP BY t.id, t.name, t.specialization, t.payment_type, t.salary, t.per_batch_fee
      ORDER BY batches_count DESC
    `);

    const [monthlyTrend] = await _query(`
      SELECT DATE_FORMAT(r.date, '%Y-%m') as period, COALESCE(SUM(r.amount), 0) as total
      FROM revenues r
      WHERE r.business_unit_id = ? AND r.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(r.date, '%Y-%m')
      ORDER BY period
    `, [BU_ID]);

    const [courseRevenue] = await _query(`
      SELECT c.name, COUNT(e.id) as students, COALESCE(SUM(e.fee_paid), 0) as revenue
      FROM courses c
      LEFT JOIN batches b ON c.id = b.course_id
      LEFT JOIN enrollments e ON b.id = e.batch_id AND e.status != 'refunded'
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `);

    const revenue = Number(periodRevenue[0].total || 0);
    const expenses = Number(periodExpenses[0].total || 0);
    const expected = Number(enrollmentStats[0].total_fee_expected || 0);
    const collected = Number(enrollmentStats[0].total_fee_collected || 0);
    const collectionRate = expected > 0 ? Number(((collected / expected) * 100).toFixed(2)) : 0;
    const occupancyRate = Number(batchStats[0].total_capacity || 0) > 0
      ? Number(((Number(batchStats[0].total_enrolled || 0) / Number(batchStats[0].total_capacity || 0)) * 100).toFixed(2))
      : 0;

    res.json({
      success: true,
      data: {
        totalCourses: Number(courseStats[0].total_courses || 0),
        activeCourses: Number(courseStats[0].active_courses || 0),
        totalBatches: Number(batchStats[0].total_batches || 0),
        activeBatches: Number(batchStats[0].active_batches || 0),
        activeStudents: Number(enrollmentStats[0].active_students || 0),
        totalEnrollments: Number(enrollmentStats[0].total_enrollments || 0),
        monthlyEnrollments: Number(monthlyEnrollments[0].total || 0),
        totalFeeCollected: collected,
        totalFeePending: expected - collected,
        totalRefunds: Number(enrollmentStats[0].total_refunds || 0),
        monthlyRevenue: revenue,
        monthlyExpenses: expenses,
        monthlyProfit: revenue - expenses,
        yearlyRevenue: revenue,
        yearlyExpenses: expenses,
        netProfit: revenue - expenses,
        collectionRate,
        occupancyRate,
        defaultersCount: Number(enrollmentStats[0].defaulters_count || 0),
        deferredCount: Number(enrollmentStats[0].deferred || 0),
        courseRevenue,
        trainerStats,
        revenueTrend: monthlyTrend
      }
    });
  } catch (error) {
    next(error);
  }
});

// --- COURSES ---
router.get('/courses', auth, async (req, res, next) => {
  try {
    const [courses] = await _query('SELECT * FROM courses ORDER BY name');
    res.json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
});

router.post('/courses', auth, validate(courseRules), checkPeriodClose, async (req, res, next) => {
  try {
    const { name, code, duration, duration_hours, fee, category, certificate_cost, description, status } = req.body;
    const [result] = await _query(
      `INSERT INTO courses (name, code, duration, duration_hours, fee, category, certificate_cost, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, code || null, duration || null, duration_hours || null, fee, category || null, certificate_cost || 0, description || null, status || 'active']
    );
    const [course] = await _query('SELECT * FROM courses WHERE id = ?', [result.insertId]);
    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'courses',
      entityId: result.insertId,
      newValues: course[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(201).json({ success: true, data: course[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/courses/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldRows] = await _query('SELECT * FROM courses WHERE id = ?', [id]);
    if (!oldRows.length) return res.status(404).json({ success: false, message: 'Course not found' });

    const fields = { ...req.body };
    if (!Object.keys(fields).length) return res.status(400).json({ success: false, message: 'No fields provided for update' });
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    await _query(`UPDATE courses SET ${updates} WHERE id = ?`, [...Object.values(fields), id]);
    const [newRows] = await _query('SELECT * FROM courses WHERE id = ?', [id]);

    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'courses',
      entityId: id,
      oldValues: oldRows[0],
      newValues: newRows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ success: true, data: newRows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/courses/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    await _query('DELETE FROM courses WHERE id = ?', [id]);
    res.json({ success: true, message: 'Course deleted' });
  } catch (error) {
    next(error);
  }
});

// --- BATCHES ---
router.get('/batches', auth, async (req, res, next) => {
  try {
    const [batches] = await _query(`
      SELECT
        b.*,
        c.name as course_name,
        c.fee as course_fee,
        t.name as trainer_name,
        CASE WHEN b.max_students > 0 THEN ROUND((b.current_students / b.max_students) * 100, 2) ELSE 0 END as occupancy_percent
      FROM batches b
      JOIN courses c ON b.course_id = c.id
      LEFT JOIN trainers t ON b.trainer_id = t.id
      ORDER BY b.start_date DESC, b.id DESC
    `);
    res.json({ success: true, data: batches });
  } catch (error) {
    next(error);
  }
});

router.get('/batches/profitability', auth, async (req, res, next) => {
  try {
    const [rows] = await _query(`
      SELECT
        b.id, b.batch_name, b.status, c.name as course_name, t.name as trainer_name,
        COALESCE(SUM(e.fee_paid), 0) as revenue,
        COALESCE(
          CASE
            WHEN t.payment_type = 'per_batch' THEN t.per_batch_fee
            WHEN t.payment_type = 'salary' THEN t.salary
            ELSE 0
          END, 0
        ) as trainer_cost,
        COALESCE(SUM(e.fee_paid), 0) - COALESCE(
          CASE
            WHEN t.payment_type = 'per_batch' THEN t.per_batch_fee
            WHEN t.payment_type = 'salary' THEN t.salary
            ELSE 0
          END, 0
        ) as profit
      FROM batches b
      JOIN courses c ON b.course_id = c.id
      LEFT JOIN trainers t ON b.trainer_id = t.id
      LEFT JOIN enrollments e ON b.id = e.batch_id AND e.status != 'refunded'
      GROUP BY b.id, b.batch_name, b.status, c.name, t.name, t.payment_type, t.per_batch_fee, t.salary
      ORDER BY profit DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/batches', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { course_id, trainer_id, batch_name, batch_code, start_date, end_date, timing, max_students, status } = req.body;
    if (await isPeriodClosed(start_date)) {
      return res.status(403).json({ success: false, message: 'Selected start date is in a closed financial period.' });
    }
    const [result] = await _query(
      `INSERT INTO batches (course_id, trainer_id, batch_name, batch_code, start_date, end_date, timing, max_students, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [course_id, trainer_id || null, batch_name, batch_code || null, start_date, end_date || null, timing || null, max_students || 30, status || 'upcoming']
    );
    const [batch] = await _query('SELECT * FROM batches WHERE id = ?', [result.insertId]);
    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'batches',
      entityId: result.insertId,
      newValues: batch[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(201).json({ success: true, data: batch[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/batches/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldRows] = await _query('SELECT * FROM batches WHERE id = ?', [id]);
    if (!oldRows.length) return res.status(404).json({ success: false, message: 'Batch not found' });
    const fields = { ...req.body };
    if (fields.start_date && await isPeriodClosed(fields.start_date)) {
      return res.status(403).json({ success: false, message: 'Selected start date is in a closed financial period.' });
    }
    if (!Object.keys(fields).length) return res.status(400).json({ success: false, message: 'No fields provided for update' });
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    await _query(`UPDATE batches SET ${updates} WHERE id = ?`, [...Object.values(fields), id]);
    const [newRows] = await _query('SELECT * FROM batches WHERE id = ?', [id]);
    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'batches',
      entityId: id,
      oldValues: oldRows[0],
      newValues: newRows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ success: true, data: newRows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/batches/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    await _query('DELETE FROM batches WHERE id = ?', [id]);
    res.json({ success: true, message: 'Batch deleted' });
  } catch (error) {
    next(error);
  }
});

// --- ENROLLMENTS ---
router.get('/enrollments', auth, async (req, res, next) => {
  try {
    const { status, batch_id, search, defaulters, date_from, date_to } = req.query;
    let sql = `
      SELECT
        e.*,
        b.batch_name,
        c.name as course_name,
        (e.total_fee - e.fee_paid) as fee_pending_calc
      FROM enrollments e
      JOIN batches b ON e.batch_id = b.id
      JOIN courses c ON b.course_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { sql += ' AND e.status = ?'; params.push(status); }
    if (batch_id) { sql += ' AND e.batch_id = ?'; params.push(batch_id); }
    if (defaulters === '1') { sql += ' AND (e.total_fee - e.fee_paid) > 0 AND e.status NOT IN ("refunded", "dropped")'; }
    if (date_from) { sql += ' AND e.enrollment_date >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND e.enrollment_date <= ?'; params.push(date_to); }
    if (search) {
      sql += ' AND (e.student_name LIKE ? OR COALESCE(e.phone, "") LIKE ? OR COALESCE(e.email, "") LIKE ? OR b.batch_name LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    sql += ' ORDER BY e.enrollment_date DESC, e.id DESC';
    const [enrollments] = await _query(sql, params);
    res.json({ success: true, data: enrollments });
  } catch (error) {
    next(error);
  }
});

router.post('/enrollments', auth, checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    await ensureITTables();
    const { batch_id, student_name, phone, email, total_fee, fee_paid, discount, enrollment_date, status } = req.body;
    if (!batch_id || !student_name || total_fee === undefined || total_fee === null || !enrollment_date) {
      return res.status(400).json({ success: false, message: 'batch_id, student_name, total_fee and enrollment_date are required' });
    }
    const enrollmentDateObj = new Date(enrollment_date);
    if (Number.isNaN(enrollmentDateObj.getTime())) {
      return res.status(400).json({ success: false, message: 'enrollment_date must be a valid date' });
    }
    const grossFee = Number(total_fee);
    if (!Number.isFinite(grossFee) || grossFee <= 0) {
      return res.status(400).json({ success: false, message: 'total_fee must be a positive number' });
    }
    const allowedCreateStatuses = ['active', 'deferred'];
    const enrollmentStatus = allowedCreateStatuses.includes(status) ? status : 'active';
    if (await isPeriodClosed(enrollment_date)) {
      return res.status(403).json({ success: false, message: 'Selected enrollment date is in a closed financial period.' });
    }

    const [batchRows] = await _query('SELECT id, max_students, current_students FROM batches WHERE id = ?', [batch_id]);
    if (!batchRows.length) return res.status(404).json({ success: false, message: 'Batch not found' });
    if (Number(batchRows[0].current_students || 0) >= Number(batchRows[0].max_students || 0)) {
      return res.status(400).json({ success: false, message: 'Batch is full. Increase capacity or select another batch.' });
    }

    if (phone || email) {
      const [duplicates] = await _query(
        `
        SELECT id FROM enrollments
        WHERE batch_id = ?
          AND status IN ('active', 'deferred')
          AND (
            (? IS NOT NULL AND ? != '' AND phone = ?)
            OR (? IS NOT NULL AND ? != '' AND email = ?)
          )
        LIMIT 1
        `,
        [batch_id, phone || null, phone || null, phone || null, email || null, email || null, email || null]
      );
      if (duplicates.length) {
        return res.status(409).json({ success: false, message: 'Duplicate active enrollment detected for this contact in selected batch.' });
      }
    }

    const parsedDiscount = Number(discount || 0);
    const netFee = Math.max(grossFee - parsedDiscount, 0);
    const initialPaid = Math.max(Number(fee_paid || 0), 0);
    if (initialPaid > netFee) {
      return res.status(400).json({ success: false, message: 'Initial payment cannot exceed payable fee after discount.' });
    }

    const [result] = await _query(
      `INSERT INTO enrollments (batch_id, student_name, phone, email, total_fee, fee_paid, discount, status, enrollment_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batch_id, student_name, phone || null, email || null, netFee, initialPaid, parsedDiscount, enrollmentStatus, enrollment_date]
    );

    await _query('UPDATE batches SET current_students = current_students + 1 WHERE id = ?', [batch_id]);

    if (initialPaid > 0) {
      await _query(
        `INSERT INTO enrollment_payments (enrollment_id, amount, payment_date, payment_method, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [result.insertId, initialPaid, enrollment_date, req.body.payment_method || 'cash', 'Initial enrollment payment', req.user.id]
      );
      await _query(
        'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
        [BU_ID, 'Course Fee', initialPaid, `Enrollment: ${student_name}`, enrollment_date, initialPaid >= netFee ? 'paid' : 'partial']
      );
    }

    const enrollment = await getEnrollmentWithJoins(result.insertId);
    await logAudit({
      userId: req.user.id,
      action: 'create',
      module: 'enrollments',
      entityId: result.insertId,
      newValues: enrollment,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
});

router.put('/enrollments/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [oldRows] = await _query('SELECT * FROM enrollments WHERE id = ?', [id]);
    if (!oldRows.length) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    if (req.body.enrollment_date && await isPeriodClosed(req.body.enrollment_date)) {
      return res.status(403).json({ success: false, message: 'Selected enrollment date is in a closed financial period.' });
    }
    const fields = { ...req.body };
    if (fields.total_fee !== undefined || fields.fee_paid !== undefined || fields.discount !== undefined) {
      const totalFee = Number(fields.total_fee ?? oldRows[0].total_fee);
      const paid = Number(fields.fee_paid ?? oldRows[0].fee_paid);
      if (paid > totalFee) return res.status(400).json({ success: false, message: 'Paid amount cannot exceed total fee.' });
      fields.total_fee = totalFee;
      fields.fee_paid = paid;
    }
    if (!Object.keys(fields).length) return res.status(400).json({ success: false, message: 'No fields provided for update' });
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    await _query(`UPDATE enrollments SET ${updates} WHERE id = ?`, [...Object.values(fields), id]);
    const enrollment = await getEnrollmentWithJoins(id);
    await logAudit({
      userId: req.user.id,
      action: 'update',
      module: 'enrollments',
      entityId: id,
      oldValues: oldRows[0],
      newValues: enrollment,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
});

router.patch('/enrollments/:id/status', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['active', 'completed', 'dropped', 'refunded', 'deferred'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
    }
    const [oldRows] = await _query('SELECT * FROM enrollments WHERE id = ?', [id]);
    if (!oldRows.length) return res.status(404).json({ success: false, message: 'Enrollment not found' });

    await _query(
      'UPDATE enrollments SET status = ?, completion_date = CASE WHEN ? = "completed" THEN CURDATE() ELSE completion_date END WHERE id = ?',
      [status, status, id]
    );
    if (oldRows[0].status === 'active' && ['dropped', 'completed', 'refunded'].includes(status)) {
      await _query('UPDATE batches SET current_students = GREATEST(current_students - 1, 0) WHERE id = ?', [oldRows[0].batch_id]);
    }
    if (oldRows[0].status !== 'active' && status === 'active') {
      await _query('UPDATE batches SET current_students = current_students + 1 WHERE id = ?', [oldRows[0].batch_id]);
    }

    const enrollment = await getEnrollmentWithJoins(id);
    res.json({ success: true, data: enrollment, message: `Enrollment marked as ${status}` });
  } catch (error) {
    next(error);
  }
});

router.get('/enrollments/:id/payments', auth, async (req, res, next) => {
  try {
    await ensureITTables();
    const { id } = req.params;
    const [rows] = await _query('SELECT * FROM enrollment_payments WHERE enrollment_id = ? ORDER BY payment_date DESC, id DESC', [id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/enrollments/:id/payments', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensureITTables();
    const { id } = req.params;
    const { amount, payment_date, payment_method, notes } = req.body;
    const parsedAmount = Number(amount);
    if (!(parsedAmount > 0)) return res.status(400).json({ success: false, message: 'Amount must be positive' });
    if (await isPeriodClosed(payment_date)) {
      return res.status(403).json({ success: false, message: 'Selected payment date is in a closed financial period.' });
    }

    const [rows] = await _query('SELECT * FROM enrollments WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    const enrollment = rows[0];
    const pending = Number(enrollment.total_fee || 0) - Number(enrollment.fee_paid || 0);
    if (parsedAmount > pending) {
      return res.status(400).json({ success: false, message: `Payment exceeds pending fee (${pending.toLocaleString()})` });
    }

    await _query(
      `INSERT INTO enrollment_payments (enrollment_id, amount, payment_date, payment_method, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, parsedAmount, payment_date, payment_method || 'cash', notes || null, req.user.id]
    );
    await _query('UPDATE enrollments SET fee_paid = fee_paid + ? WHERE id = ?', [parsedAmount, id]);

    const updated = await getEnrollmentWithJoins(id);
    await _query(
      'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
      [BU_ID, 'Course Fee', parsedAmount, `Fee collection: ${updated.student_name}`, payment_date, updated.fee_pending_calc > 0 ? 'partial' : 'paid']
    );

    res.status(201).json({ success: true, data: updated, message: 'Payment recorded successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/defaulters', auth, async (req, res, next) => {
  try {
    await ensureITTables();
    const { search, age_bucket, reminder_status } = req.query;
    let sql = `
      SELECT
        e.*,
        b.batch_name,
        c.name as course_name,
        (e.total_fee - e.fee_paid) as pending_amount,
        DATEDIFF(CURDATE(), e.enrollment_date) as days_since_enrollment,
        CASE
          WHEN DATEDIFF(CURDATE(), e.enrollment_date) <= 30 THEN '0-30'
          WHEN DATEDIFF(CURDATE(), e.enrollment_date) <= 60 THEN '31-60'
          ELSE '60+'
        END as age_bucket,
        (
          LEAST((e.total_fee - e.fee_paid) / 1000, 70)
          + CASE
              WHEN DATEDIFF(CURDATE(), e.enrollment_date) <= 30 THEN 10
              WHEN DATEDIFF(CURDATE(), e.enrollment_date) <= 60 THEN 20
              ELSE 30
            END
        ) as priority_score,
        e.last_contacted_at,
        e.next_reminder_date,
        e.promise_to_pay_date,
        CASE
          WHEN e.next_reminder_date IS NULL THEN 'none'
          WHEN e.next_reminder_date < CURDATE() THEN 'overdue'
          WHEN e.next_reminder_date = CURDATE() THEN 'due_today'
          ELSE 'scheduled'
        END as reminder_status
      FROM enrollments e
      JOIN batches b ON e.batch_id = b.id
      JOIN courses c ON b.course_id = c.id
      WHERE (e.total_fee - e.fee_paid) > 0
        AND e.status NOT IN ('refunded', 'dropped')
    `;
    const params = [];
    if (search) {
      const like = `%${search}%`;
      sql += ' AND (e.student_name LIKE ? OR COALESCE(e.phone, "") LIKE ? OR COALESCE(e.email, "") LIKE ? OR b.batch_name LIKE ?)';
      params.push(like, like, like, like);
    }
    if (age_bucket) {
      if (age_bucket === '0-30') sql += ' AND DATEDIFF(CURDATE(), e.enrollment_date) <= 30';
      if (age_bucket === '31-60') sql += ' AND DATEDIFF(CURDATE(), e.enrollment_date) BETWEEN 31 AND 60';
      if (age_bucket === '60+') sql += ' AND DATEDIFF(CURDATE(), e.enrollment_date) > 60';
    }
    if (reminder_status) {
      if (reminder_status === 'none') sql += ' AND e.next_reminder_date IS NULL';
      if (reminder_status === 'scheduled') sql += ' AND e.next_reminder_date > CURDATE()';
      if (reminder_status === 'due_today') sql += ' AND e.next_reminder_date = CURDATE()';
      if (reminder_status === 'overdue') sql += ' AND e.next_reminder_date < CURDATE()';
    }
    sql += ' ORDER BY priority_score DESC, pending_amount DESC, days_since_enrollment DESC';
    const [rows] = await _query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/defaulters/:id/action', auth, async (req, res, next) => {
  try {
    await ensureITTables();
    const { id } = req.params;
    const { action, notes, followup_date, promise_to_pay_date } = req.body;
    const allowed = ['call', 'whatsapp', 'send_reminder', 'promise_to_pay'];
    if (!allowed.includes(action)) {
      return res.status(400).json({ success: false, message: `action must be one of: ${allowed.join(', ')}` });
    }
    const [enrollmentRows] = await _query(
      'SELECT id, student_name, total_fee, fee_paid, status FROM enrollments WHERE id = ? LIMIT 1',
      [id]
    );
    if (!enrollmentRows.length) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    const enrollment = enrollmentRows[0];
    if (!['active', 'deferred'].includes(enrollment.status) || Number(enrollment.total_fee || 0) <= Number(enrollment.fee_paid || 0)) {
      return res.status(400).json({ success: false, message: 'Enrollment is not currently a defaulter' });
    }
    if (action === 'promise_to_pay' && !promise_to_pay_date) {
      return res.status(400).json({ success: false, message: 'promise_to_pay_date is required for promise_to_pay action' });
    }

    const effectiveFollowupDate = followup_date || new Date().toISOString().slice(0, 10);
    let channel = 'call';
    if (action === 'whatsapp') channel = 'whatsapp';
    if (action === 'send_reminder') channel = 'email';
    if (action === 'promise_to_pay') channel = 'in_person';

    await _query(
      `INSERT INTO enrollment_followups (enrollment_id, followup_date, channel, status, action_type, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, effectiveFollowupDate, channel, 'done', action, notes || null, req.user.id]
    );

    const updateParts = ['last_contacted_at = NOW()'];
    const updateParams = [];
    if (action === 'send_reminder') {
      const nextReminderDate = new Date();
      nextReminderDate.setDate(nextReminderDate.getDate() + 3);
      updateParts.push('next_reminder_date = ?');
      updateParams.push(nextReminderDate.toISOString().slice(0, 10));
    }
    if (action === 'promise_to_pay') {
      updateParts.push('promise_to_pay_date = ?');
      updateParams.push(promise_to_pay_date);
    }
    await _query(
      `UPDATE enrollments SET ${updateParts.join(', ')} WHERE id = ?`,
      [...updateParams, id]
    );

    const [updatedRows] = await _query(
      `SELECT id, student_name, last_contacted_at, next_reminder_date, promise_to_pay_date FROM enrollments WHERE id = ?`,
      [id]
    );
    res.status(201).json({ success: true, data: updatedRows[0], message: `Defaulter action '${action}' logged` });
  } catch (error) {
    next(error);
  }
});

router.patch('/defaulters/:id/reminder', auth, async (req, res, next) => {
  try {
    await ensureITTables();
    const { id } = req.params;
    const { next_reminder_date } = req.body;
    if (!next_reminder_date) return res.status(400).json({ success: false, message: 'next_reminder_date is required' });
    const dateObj = new Date(next_reminder_date);
    if (Number.isNaN(dateObj.getTime())) {
      return res.status(400).json({ success: false, message: 'next_reminder_date must be a valid date' });
    }
    const [rows] = await _query('SELECT id FROM enrollments WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    await _query(
      'UPDATE enrollments SET next_reminder_date = ?, last_contacted_at = NOW() WHERE id = ?',
      [next_reminder_date, id]
    );
    await _query(
      `INSERT INTO enrollment_followups (enrollment_id, followup_date, channel, status, action_type, notes, created_by)
       VALUES (?, ?, 'email', 'pending', 'send_reminder', ?, ?)`,
      [id, next_reminder_date, 'Reminder scheduled', req.user.id]
    );
    res.json({ success: true, message: 'Reminder scheduled successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/enrollments/:id/followups', auth, async (req, res, next) => {
  try {
    await ensureITTables();
    const { id } = req.params;
    const [rows] = await _query(
      `SELECT f.*, u.full_name as created_by_name
       FROM enrollment_followups f
       LEFT JOIN users u ON f.created_by = u.id
       WHERE f.enrollment_id = ?
       ORDER BY f.followup_date DESC, f.id DESC`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/enrollments/:id/followups', auth, async (req, res, next) => {
  try {
    await ensureITTables();
    const { id } = req.params;
    const { followup_date, channel, status, notes, action_type } = req.body;
    if (!followup_date) return res.status(400).json({ success: false, message: 'followup_date is required' });
    await _query(
      `INSERT INTO enrollment_followups (enrollment_id, followup_date, channel, status, action_type, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, followup_date, channel || 'call', status || 'pending', action_type || 'note', notes || null, req.user.id]
    );
    await _query('UPDATE enrollments SET last_contacted_at = NOW() WHERE id = ?', [id]);
    res.status(201).json({ success: true, message: 'Follow-up logged' });
  } catch (error) {
    next(error);
  }
});

// --- TRAINERS ---
router.get('/trainers', auth, async (req, res, next) => {
  try {
    const [trainers] = await _query('SELECT * FROM trainers ORDER BY name');
    res.json({ success: true, data: trainers });
  } catch (error) {
    next(error);
  }
});

router.post('/trainers', auth, validate(trainerRules), checkPeriodClose, async (req, res, next) => {
  try {
    const { name, email, phone, specialization, salary, per_batch_fee, payment_type, status } = req.body;
    const [result] = await _query(
      `INSERT INTO trainers (name, email, phone, specialization, salary, per_batch_fee, payment_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email || null, phone || null, specialization || null, salary || 0, per_batch_fee || 0, payment_type || 'salary', status || 'active']
    );
    const [trainer] = await _query('SELECT * FROM trainers WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: trainer[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/trainers/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = { ...req.body };
    if (!Object.keys(fields).length) return res.status(400).json({ success: false, message: 'No fields provided for update' });
    const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    await _query(`UPDATE trainers SET ${updates} WHERE id = ?`, [...Object.values(fields), id]);
    const [trainer] = await _query('SELECT * FROM trainers WHERE id = ?', [id]);
    res.json({ success: true, data: trainer[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/trainers/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    const { id } = req.params;
    await _query('DELETE FROM trainers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Trainer deleted' });
  } catch (error) {
    next(error);
  }
});

router.get('/attendance/summary', auth, async (req, res, next) => {
  try {
    const { batch_id } = req.query;
    let sql = `
      SELECT
        a.batch_id,
        b.batch_name,
        a.student_name,
        COUNT(*) as total_sessions,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as attendance_percent
      FROM course_attendance a
      JOIN batches b ON a.batch_id = b.id
      WHERE 1=1
    `;
    const params = [];
    if (batch_id) { sql += ' AND a.batch_id = ?'; params.push(batch_id); }
    sql += ' GROUP BY a.batch_id, b.batch_name, a.student_name ORDER BY attendance_percent ASC';
    const [rows] = await _query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/summary', auth, async (req, res, next) => {
  try {
    await ensureITTables();
    const range = getRange(req.query);
    if (!range) return res.status(400).json({ success: false, message: 'Invalid filters' });
    const { from, to } = range;

    const [financial] = await _query(
      `
      SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM revenues WHERE business_unit_id = ? AND date >= ? AND date <= ?) as revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE business_unit_id = ? AND date >= ? AND date <= ?) as expenses,
        (SELECT COALESCE(SUM(total_fee - fee_paid), 0) FROM enrollments WHERE (total_fee - fee_paid) > 0 AND status NOT IN ('refunded', 'dropped')) as receivables
      `,
      [BU_ID, from, to, BU_ID, from, to]
    );

    const [statusRows] = await _query(`SELECT status, COUNT(*) as count FROM enrollments GROUP BY status`);
    const [defaulterRows] = await _query(`
      SELECT e.id, e.student_name, b.batch_name, (e.total_fee - e.fee_paid) as pending_amount
      FROM enrollments e
      JOIN batches b ON e.batch_id = b.id
      WHERE (e.total_fee - e.fee_paid) > 0 AND e.status NOT IN ('refunded', 'dropped')
      ORDER BY pending_amount DESC
      LIMIT 20
    `);
    const [profitability] = await _query(`
      SELECT
        b.id, b.batch_name, c.name as course_name,
        COALESCE(SUM(ep.amount), 0) as revenue,
        COALESCE(MAX(
          CASE
            WHEN t.payment_type = 'per_batch' THEN t.per_batch_fee
            WHEN t.payment_type = 'salary' THEN t.salary
            ELSE 0
          END
        ), 0) as trainer_cost
      FROM batches b
      JOIN courses c ON b.course_id = c.id
      LEFT JOIN trainers t ON b.trainer_id = t.id
      LEFT JOIN enrollments e ON e.batch_id = b.id AND e.status != 'refunded'
      LEFT JOIN enrollment_payments ep
        ON ep.enrollment_id = e.id
        AND ep.payment_date >= ?
        AND ep.payment_date <= ?
      GROUP BY b.id, b.batch_name, c.name
      ORDER BY revenue DESC
    `, [from, to]);

    const statusMap = statusRows.reduce((acc, row) => {
      acc[row.status] = Number(row.count || 0);
      return acc;
    }, {});
    const revenue = Number(financial[0].revenue || 0);
    const expenses = Number(financial[0].expenses || 0);
    res.json({
      success: true,
      data: {
        range,
        revenue,
        expenses,
        profit: revenue - expenses,
        receivables: Number(financial[0].receivables || 0),
        statusBreakdown: statusMap,
        defaulters: defaulterRows,
        batchProfitability: profitability.map(row => ({ ...row, profit: Number(row.revenue || 0) - Number(row.trainer_cost || 0) }))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/export', auth, async (req, res, next) => {
  try {
    const range = getRange(req.query);
    if (!range) return res.status(400).json({ success: false, message: 'Invalid filters' });
    const [rows] = await _query(
      `
      SELECT
        e.id, e.enrollment_date, e.student_name, e.phone, e.email,
        b.batch_name, c.name as course_name,
        e.total_fee, e.fee_paid, (e.total_fee - e.fee_paid) as fee_pending,
        e.status
      FROM enrollments e
      JOIN batches b ON e.batch_id = b.id
      JOIN courses c ON b.course_id = c.id
      WHERE e.enrollment_date >= ? AND e.enrollment_date <= ?
      ORDER BY e.enrollment_date DESC, e.id DESC
      `,
      [range.from, range.to]
    );

    const headers = ['id', 'enrollment_date', 'student_name', 'phone', 'email', 'batch_name', 'course_name', 'total_fee', 'fee_paid', 'fee_pending', 'status'];
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String((r[h] ?? '')).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="it-courses-report.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.post('/expenses', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, expense_type, amount, description, vendor, date } = req.body;
    const [result] = await _query(
      'INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, vendor, date, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [BU_ID, category, expense_type || 'variable', amount, description, vendor, date, req.approvalStatus || 'na']
    );
    if (req.requiresApproval) {
      await _query(
        'INSERT INTO approvals (entity_type, entity_id, requested_by, status, comments) VALUES (?, ?, ?, ?, ?)',
        ['expense', result.insertId, req.user.id, 'pending', req.approvalReason]
      );
    }
    const [exp] = await _query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: exp[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/reset', auth, async (req, res, next) => {
  try {
    await ensureITTables();
    const [expenseIds] = await _query('SELECT id FROM expenses WHERE business_unit_id = ?', [BU_ID]);
    const ids = expenseIds.map(r => r.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(', ');
      await _query(`DELETE FROM approvals WHERE entity_type = 'expense' AND entity_id IN (${placeholders})`, ids);
    }

    await _query('DELETE FROM enrollment_followups');
    await _query('DELETE FROM enrollment_payments');
    await _query('DELETE FROM course_attendance');
    await _query('DELETE FROM enrollments');
    await _query('DELETE FROM batches');
    await _query('DELETE FROM courses');
    await _query('DELETE FROM trainers');
    await _query('DELETE FROM expenses WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM revenues WHERE business_unit_id = ?', [BU_ID]);
    await _query('DELETE FROM transactions WHERE business_unit_id = ?', [BU_ID]);

    res.json({ success: true, message: 'IT Courses panel data reset successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
