import { Router } from 'express';
import { query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = Router();
const BU_ID = 5;

// GET /api/it-courses/overview
router.get('/overview', auth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const [courseStats] = await query(`
      SELECT COUNT(*) as total_courses,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_courses
      FROM courses
    `);

    const [batchStats] = await query(`
      SELECT COUNT(*) as total_batches,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_batches,
             SUM(current_students) as total_enrolled
      FROM batches
    `);

    const [enrollmentStats] = await query(`
      SELECT 
        COUNT(*) as total_enrollments,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_students,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'dropped' THEN 1 ELSE 0 END) as dropped,
        SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded,
        COALESCE(SUM(total_fee), 0) as total_fee_expected,
        COALESCE(SUM(fee_paid), 0) as total_fee_collected,
        COALESCE(SUM(refund_amount), 0) as total_refunds
      FROM enrollments
    `);

    const [courseRevenue] = await query(`
      SELECT c.name, c.fee, COUNT(e.id) as students, COALESCE(SUM(e.fee_paid), 0) as revenue
      FROM courses c
      LEFT JOIN batches b ON c.id = b.course_id
      LEFT JOIN enrollments e ON b.id = e.batch_id AND e.status != 'refunded'
      GROUP BY c.id, c.name, c.fee
      ORDER BY revenue DESC
    `);

    const [yearlyRevenue] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM revenues WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [yearlyExpenses] = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_unit_id = ? AND YEAR(date) = ?',
      [BU_ID, currentYear]
    );

    const [trainerStats] = await query(`
      SELECT t.name, t.specialization, COUNT(b.id) as batches_count, 
             COALESCE(SUM(b.current_students), 0) as total_students
      FROM trainers t
      LEFT JOIN batches b ON t.id = b.trainer_id AND b.status = 'active'
      WHERE t.status = 'active'
      GROUP BY t.id, t.name, t.specialization
    `);

    const rev = parseFloat(yearlyRevenue[0].total);
    const exp = parseFloat(yearlyExpenses[0].total);

    res.json({
      success: true,
      data: {
        totalCourses: courseStats[0].total_courses,
        activeCourses: courseStats[0].active_courses,
        totalBatches: batchStats[0].total_batches,
        activeBatches: batchStats[0].active_batches,
        activeStudents: enrollmentStats[0].active_students,
        totalEnrollments: enrollmentStats[0].total_enrollments,
        totalFeeCollected: parseFloat(enrollmentStats[0].total_fee_collected),
        totalFeePending: parseFloat(enrollmentStats[0].total_fee_expected) - parseFloat(enrollmentStats[0].total_fee_collected),
        totalRefunds: parseFloat(enrollmentStats[0].total_refunds),
        yearlyRevenue: rev,
        yearlyExpenses: exp,
        netProfit: rev - exp,
        courseRevenue,
        trainerStats
      }
    });
  } catch (error) {
    console.error('IT Courses overview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- COURSES ---
router.get('/courses', auth, async (req, res) => {
  try {
    const [courses] = await query('SELECT * FROM courses ORDER BY name');
    res.json({ success: true, data: courses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/courses', auth, async (req, res) => {
  try {
    const { name, code, duration, duration_hours, fee, category, certificate_cost, description } = req.body;
    const [result] = await query(
      'INSERT INTO courses (name, code, duration, duration_hours, fee, category, certificate_cost, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, code, duration, duration_hours, fee, category, certificate_cost || 0, description]
    );
    const [course] = await query('SELECT * FROM courses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: course[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- BATCHES ---
router.get('/batches', auth, async (req, res) => {
  try {
    const [batches] = await query(`
      SELECT b.*, c.name as course_name, c.fee as course_fee, t.name as trainer_name
      FROM batches b
      JOIN courses c ON b.course_id = c.id
      LEFT JOIN trainers t ON b.trainer_id = t.id
      ORDER BY b.start_date DESC
    `);
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/batches', auth, async (req, res) => {
  try {
    const { course_id, trainer_id, batch_name, batch_code, start_date, end_date, timing, max_students } = req.body;
    const [result] = await query(
      'INSERT INTO batches (course_id, trainer_id, batch_name, batch_code, start_date, end_date, timing, max_students) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [course_id, trainer_id, batch_name, batch_code, start_date, end_date, timing, max_students || 30]
    );
    const [batch] = await query('SELECT * FROM batches WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: batch[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- ENROLLMENTS ---
router.get('/enrollments', auth, async (req, res) => {
  try {
    const [enrollments] = await query(`
      SELECT e.*, b.batch_name, c.name as course_name
      FROM enrollments e
      JOIN batches b ON e.batch_id = b.id
      JOIN courses c ON b.course_id = c.id
      ORDER BY e.enrollment_date DESC
    `);
    res.json({ success: true, data: enrollments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/enrollments', auth, async (req, res) => {
  try {
    const { batch_id, student_name, phone, email, total_fee, fee_paid, discount, enrollment_date } = req.body;

    const [result] = await query(
      `INSERT INTO enrollments (batch_id, student_name, phone, email, total_fee, fee_paid, discount, status, enrollment_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [batch_id, student_name, phone, email, total_fee, fee_paid || 0, discount || 0, enrollment_date]
    );

    // Update batch student count
    await query('UPDATE batches SET current_students = current_students + 1 WHERE id = ?', [batch_id]);

    // Record revenue
    if (fee_paid > 0) {
      await query(
        'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
        [BU_ID, 'Course Fee', fee_paid, `Enrollment: ${student_name}`, enrollment_date,
         fee_paid >= total_fee ? 'paid' : 'partial']
      );
    }

    const [enrollment] = await query('SELECT * FROM enrollments WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: enrollment[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- TRAINERS ---
router.get('/trainers', auth, async (req, res) => {
  try {
    const [trainers] = await query('SELECT * FROM trainers ORDER BY name');
    res.json({ success: true, data: trainers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/trainers', auth, async (req, res) => {
  try {
    const { name, email, phone, specialization, salary, per_batch_fee, payment_type } = req.body;
    const [result] = await query(
      'INSERT INTO trainers (name, email, phone, specialization, salary, per_batch_fee, payment_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, specialization, salary, per_batch_fee, payment_type || 'salary']
    );
    const [trainer] = await query('SELECT * FROM trainers WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: trainer[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Expenses
router.post('/expenses', auth, async (req, res) => {
  try {
    const { category, expense_type, amount, description, vendor, date } = req.body;
    const [result] = await query(
      'INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, vendor, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [BU_ID, category, expense_type || 'variable', amount, description, vendor, date]
    );
    const [exp] = await query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: exp[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
