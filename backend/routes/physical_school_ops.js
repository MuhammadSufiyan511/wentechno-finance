import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

// ============ FEE CHALLANS ============

router.get('/challans', auth, async (req, res, next) => {
    try {
        const [challans] = await _query(`
      SELECT f.*, s.name as student_name, s.class, s.section 
      FROM fee_challans f 
      JOIN school_students s ON f.student_id = s.id 
      ORDER BY f.due_date DESC
    `);
        res.json({ success: true, data: challans });
    } catch (error) {
        next(error);
    }
});

router.post('/challans/generate', auth, async (req, res, next) => {
    try {
        const { student_id, month, year } = req.body;
        const [student] = await _query('SELECT monthly_fee FROM school_students WHERE id = ?', [student_id]);

        const challan_number = `CHL-${student_id}-${month}-${year}-${Date.now()}`;
        const due_date = new Date(year, month, 10); // Example: 10th of the month

        await _query(
            'INSERT INTO fee_challans (student_id, challan_number, due_date, total_amount, status) VALUES (?, ?, ?, ?, "unpaid")',
            [student_id, challan_number, due_date, student[0].monthly_fee]
        );

        res.status(201).json({ success: true, message: 'Challan generated' });
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
      WHERE f.status = 'unpaid' AND f.due_date < CURDATE()
      GROUP BY s.id, s.name
    `);
        res.json({ success: true, data: defaulters });
    } catch (error) {
        next(error);
    }
});

export default router;
