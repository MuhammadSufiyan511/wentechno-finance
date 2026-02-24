import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();
const BU_ID = 5;

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
        const { status } = req.query;
        let where = '';
        const params = [];
        if (status) {
            where = 'WHERE p.status = ?';
            params.push(status);
        }
        const [payouts] = await _query(`
      SELECT p.*, t.name as trainer_name, b.batch_name 
      FROM instructor_payouts p 
      JOIN trainers t ON p.trainer_id = t.id 
      LEFT JOIN batches b ON p.batch_id = b.id 
      ${where}
      ORDER BY p.payout_date DESC
    `, params);
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

router.patch('/payouts/:id/status', auth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        if (!['pending', 'approved', 'rejected', 'paid'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid payout status' });
        }
        if (status === 'approved' || status === 'rejected') {
            if (req.user.role !== 'CEO') {
                return res.status(403).json({ success: false, message: 'Only CEO can approve/reject payouts' });
            }
        }

        const [rows] = await _query('SELECT * FROM instructor_payouts WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Payout not found' });
        const payout = rows[0];

        await _query('UPDATE instructor_payouts SET status = ?, notes = ? WHERE id = ?', [status, notes || payout.notes || null, id]);

        if (status === 'paid' && payout.status !== 'paid') {
            await _query(
                `INSERT INTO expenses (business_unit_id, category, expense_type, amount, description, vendor, date, approval_status)
                 VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 'na')`,
                [BU_ID, 'Trainer Payout', 'fixed', payout.amount, `Instructor payout #${id}`, null]
            );
        }

        const [updated] = await _query('SELECT * FROM instructor_payouts WHERE id = ?', [id]);
        res.json({ success: true, data: updated[0], message: `Payout ${status}` });
    } catch (error) {
        next(error);
    }
});

export default router;
