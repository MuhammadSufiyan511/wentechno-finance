import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { logAudit } from '../middleware/auditTrail.js';

const router = Router();
const BU_ID = 2;
const MISSING_TABLE_ERROR = 'ER_NO_SUCH_TABLE';

// ============ PRODUCTION BOARD ============

router.patch('/orders/:id/status', auth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // e.g., 'cutting', 'stitching', 'finishing'

        const [oldOrder] = await _query('SELECT status FROM urbanfit_orders WHERE id = ?', [id]);
        await _query('UPDATE urbanfit_orders SET status = ? WHERE id = ?', [status, id]);

        // Audit log
        await logAudit({
            userId: req.user.id,
            action: 'update',
            module: 'urbanfit_orders',
            entityId: id,
            newValues: { status },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ success: true, message: `Order status moved to ${status}` });
    } catch (error) {
        next(error);
    }
});

// ============ RETURNS ============

router.get('/returns', auth, async (req, res, next) => {
    try {
        const [returns] = await _query(`
      SELECT r.*, o.order_number, o.customer_name 
      FROM urbanfit_returns r 
      JOIN urbanfit_orders o ON r.order_id = o.id 
      ORDER BY r.date DESC
    `);
        res.json({ success: true, data: returns });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.json({ success: true, data: [] });
        }
        next(error);
    }
});

router.post('/returns', auth, async (req, res, next) => {
    try {
        const { order_id, reason, amount, date } = req.body;

        const [result] = await _query(
            'INSERT INTO urbanfit_returns (order_id, reason, amount, date) VALUES (?, ?, ?, ?)',
            [order_id, reason, amount, date]
        );

        // Record as negative revenue or expense? Plan suggested 'returns' table.
        // Usually, a return reduces revenue.
        await _query(
            'INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
            [BU_ID, 'Sales Returns', -amount, `Return for order ID: ${order_id}`, date, 'paid']
        );

        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.status(503).json({
                success: false,
                message: 'Returns module is not initialized in the database yet.'
            });
        }
        next(error);
    }
});

router.put('/returns/:id', auth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const [oldReturn] = await _query('SELECT * FROM urbanfit_returns WHERE id = ?', [id]);
        if (oldReturn.length === 0) return res.status(404).json({ success: false, message: 'Return not found' });

        const fields = req.body;
        const updates = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        const values = Object.values(fields);
        if (!updates) return res.status(400).json({ success: false, message: 'No fields provided for update' });

        await _query(`UPDATE urbanfit_returns SET ${updates} WHERE id = ?`, [...values, id]);
        const [ret] = await _query('SELECT * FROM urbanfit_returns WHERE id = ?', [id]);
        res.json({ success: true, data: ret[0] });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.status(503).json({
                success: false,
                message: 'Returns module is not initialized in the database yet.'
            });
        }
        next(error);
    }
});

router.delete('/returns/:id', auth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const [ret] = await _query('SELECT * FROM urbanfit_returns WHERE id = ?', [id]);
        if (ret.length === 0) return res.status(404).json({ success: false, message: 'Return not found' });
        await _query('DELETE FROM urbanfit_returns WHERE id = ?', [id]);
        res.json({ success: true, message: 'Return deleted successfully' });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.status(503).json({
                success: false,
                message: 'Returns module is not initialized in the database yet.'
            });
        }
        next(error);
    }
});

export default router;
