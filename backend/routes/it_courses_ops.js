import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

// ============ ATTENDANCE ============

router.get('/batches/:batchId/attendance', auth, async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const [attendance] = await _query('SELECT * FROM course_attendance WHERE batch_id = ? ORDER BY date DESC', [batchId]);
        res.json({ success: true, data: attendance });
    } catch (error) {
        next(error);
    }
});

router.post('/attendance', auth, async (req, res, next) => {
    try {
        const { batch_id, date, students } = req.body; // students: [{name, status, notes}]

        const values = students.map(s => [batch_id, s.name, date, s.status, s.notes || '']);
        await _query(
            'INSERT INTO course_attendance (batch_id, student_name, date, status, notes) VALUES ?',
            [values]
        );

        res.status(201).json({ success: true, message: 'Attendance recorded' });
    } catch (error) {
        next(error);
    }
});

// ============ INSTRUCTOR PAYOUTS ============

router.get('/payouts', auth, async (req, res, next) => {
    try {
        const [payouts] = await _query(`
      SELECT p.*, t.name as trainer_name, b.batch_name 
      FROM instructor_payouts p 
      JOIN trainers t ON p.trainer_id = t.id 
      LEFT JOIN batches b ON p.batch_id = b.id 
      ORDER BY p.payout_date DESC
    `);
        res.json({ success: true, data: payouts });
    } catch (error) {
        next(error);
    }
});

router.post('/payouts', auth, async (req, res, next) => {
    try {
        const { trainer_id, batch_id, amount, payout_date, notes } = req.body;

        await _query(
            'INSERT INTO instructor_payouts (trainer_id, batch_id, amount, payout_date, status, notes) VALUES (?, ?, ?, ?, "pending", ?)',
            [trainer_id, batch_id, amount, payout_date, notes]
        );

        res.status(201).json({ success: true, message: 'Payout requested' });
    } catch (error) {
        next(error);
    }
});

export default router;
