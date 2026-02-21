import { query as _query } from '../config/db.js';

/**
 * Creates a system notification for a specific user.
 * @param {number} userId - The ID of the user to notify.
 * @param {Object} options - Notification details.
 * @param {string} options.type - 'info', 'success', 'warning', 'error'
 * @param {string} options.title - Short title.
 * @param {string} options.message - Detailed message.
 * @param {string} [options.link] - Optional link for the frontend to navigate to.
 */
export const createNotification = async (userId, { type = 'info', title, message, link = null }) => {
    try {
        await _query(
            'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
            [userId, type, title, message, link]
        );
        return true;
    } catch (error) {
        console.error('Failed to create notification:', error);
        return false;
    }
};
