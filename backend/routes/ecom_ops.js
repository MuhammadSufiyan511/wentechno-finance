import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { logAudit } from '../middleware/auditTrail.js';
import { validate, transactionRules } from '../middleware/validator.js';

const router = Router();
const BU_ID = 1;
const MISSING_TABLE_ERROR = 'ER_NO_SUCH_TABLE';

// ============ QUOTES ============

router.get('/quotes', auth, async (req, res, next) => {
    try {
        const [quotes] = await _query(`
      SELECT q.*, c.name as client_name 
      FROM quotes q 
      LEFT JOIN clients c ON q.client_id = c.id 
      ORDER BY q.created_at DESC
    `);
        res.json({ success: true, data: quotes });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.json({ success: true, data: [] });
        }
        next(error);
    }
});

router.post('/quotes', auth, async (req, res, next) => {
    try {
        const { client_id, subject, total_amount, valid_until, notes } = req.body;
        const quote_number = `QT-${Date.now()}`;

        const [result] = await _query(
            'INSERT INTO quotes (client_id, quote_number, subject, total_amount, valid_until, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [client_id, quote_number, subject, total_amount, valid_until, notes]
        );

        res.status(201).json({ success: true, data: { id: result.insertId, quote_number } });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.status(503).json({
                success: false,
                message: 'Quotes module is not initialized in the database yet.'
            });
        }
        next(error);
    }
});

router.patch('/quotes/:id/status', auth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await _query('UPDATE quotes SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: 'Quote status updated' });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.status(503).json({
                success: false,
                message: 'Quotes module is not initialized in the database yet.'
            });
        }
        next(error);
    }
});

// ============ MILESTONES ============

router.get('/projects/:projectId/milestones', auth, async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const [milestones] = await _query('SELECT * FROM project_milestones WHERE project_id = ?', [projectId]);
        res.json({ success: true, data: milestones });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.json({ success: true, data: [] });
        }
        next(error);
    }
});

router.post('/projects/:projectId/milestones', auth, async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const { name, description, amount, due_date } = req.body;

        const [result] = await _query(
            'INSERT INTO project_milestones (project_id, name, description, amount, due_date) VALUES (?, ?, ?, ?, ?)',
            [projectId, name, description, amount, due_date]
        );

        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.status(503).json({
                success: false,
                message: 'Milestones module is not initialized in the database yet.'
            });
        }
        next(error);
    }
});

router.post('/milestones/:id/invoice', auth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const [milestone] = await _query('SELECT * FROM project_milestones WHERE id = ?', [id]);
        if (milestone.length === 0) return res.status(404).json({ success: false, message: 'Milestone not found' });

        const m = milestone[0];
        const [project] = await _query('SELECT client_id FROM projects WHERE id = ?', [m.project_id]);

        const invoice_number = `INV-M-${id}-${Date.now()}`;
        await _query(
            'INSERT INTO invoices (project_id, client_id, invoice_number, amount, total_amount, status, due_date, notes) VALUES (?, ?, ?, ?, ?, "pending", CURDATE(), ?)',
            [m.project_id, project[0].client_id, invoice_number, m.amount, m.amount, `Invoice for milestone: ${m.name}`]
        );

        await _query('UPDATE project_milestones SET status = "invoiced" WHERE id = ?', [id]);

        res.json({ success: true, message: 'Invoiced created for milestone' });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.status(503).json({
                success: false,
                message: 'Milestones module is not initialized in the database yet.'
            });
        }
        next(error);
    }
});

export default router;
