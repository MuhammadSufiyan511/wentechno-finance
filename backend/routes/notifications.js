import express from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';

const router = express.Router();
const MISSING_TABLE_ERROR = 'ER_NO_SUCH_TABLE';

// GET /api/v1/notifications - Fetch unread/recent notifications
router.get('/', auth, async (req, res, next) => {
    try {
        const [notifications] = await _query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [req.user.id]
        );
        res.json({ success: true, data: notifications });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.json({ success: true, data: [] });
        }
        next(error);
    }
});

// PUT /api/v1/notifications/:id/read - Mark as read
router.put('/:id/read', auth, async (req, res, next) => {
    try {
        await _query(
            'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.json({ success: true, message: 'Notifications not initialized yet' });
        }
        next(error);
    }
});

// PUT /api/v1/notifications/read-all - Mark all as read
router.put('/read-all', auth, async (req, res, next) => {
    try {
        await _query(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
            [req.user.id]
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        if (error?.code === MISSING_TABLE_ERROR) {
            return res.json({ success: true, message: 'Notifications not initialized yet' });
        }
        next(error);
    }
});

export default router;
