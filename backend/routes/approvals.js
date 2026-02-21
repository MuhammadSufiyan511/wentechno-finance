import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { logAudit } from '../middleware/auditTrail.js';
import { createNotification } from '../utils/notificationHelper.js';
import { validate, approvalActionRules } from '../middleware/validator.js';

const router = Router();

// GET /api/v1/approvals/pending
router.get('/pending', auth, async (req, res, next) => {
    try {
        // Only CEO can see pending approvals
        if (req.user.role !== 'CEO') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const [pending] = await _query(`
      SELECT a.*, u.full_name as requester_name
      FROM approvals a
      LEFT JOIN users u ON a.requested_by = u.id
      WHERE a.status = 'pending'
      ORDER BY a.created_at ASC
    `);

        // Fetch details for each pending item (optional, can be done on frontend)
        // For now, just return the list
        res.json({ success: true, data: pending });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/approvals/:id/action
router.post('/:id/action', auth, validate(approvalActionRules), async (req, res, next) => {
    try {
        if (req.user.role !== 'CEO') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { id } = req.params;
        const { action, comments } = req.body; // action: 'approve' or 'reject'

        const [approval] = await _query('SELECT * FROM approvals WHERE id = ?', [id]);
        if (approval.length === 0) {
            return res.status(404).json({ success: false, message: 'Approval request not found' });
        }

        const { entity_type, entity_id } = approval[0];
        const table = entity_type === 'revenue' ? 'revenues' : entity_type === 'expense' ? 'expenses' : 'invoices';

        // Start transaction
        await _query('START TRANSACTION');

        try {
            // Update approval record
            await _query(
                'UPDATE approvals SET status = ?, action_by = ?, comments = ? WHERE id = ?',
                [action, req.user.id, comments, id]
            );

            // Update entity status
            await _query(
                `UPDATE ${table} SET approval_status = ? WHERE id = ?`,
                [action, entity_id]
            );

            await _query('COMMIT');

            await logAudit({
                userId: req.user.id,
                action: 'update',
                module: 'approvals',
                entityId: id,
                newValues: { status: action, comments },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            // Send Notification to Requester
            if (approval[0].requested_by) {
                await createNotification(approval[0].requested_by, {
                    type: action === 'approved' ? 'success' : 'error',
                    title: `Request ${action === 'approved' ? 'Approved' : 'Rejected'}`,
                    message: `Your ${entity_type} request (#${entity_id}) was ${action} by CEO.`,
                    link: '/approvals'
                });
            }

            res.json({ success: true, message: `Request ${action} successfully` });
        } catch (error) {
            await _query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        next(error);
    }
});

export default router;
