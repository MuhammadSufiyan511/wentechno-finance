import { query as _query } from '../config/db.js';

/**
 * Logs an action to the audit_logs table
 * @param {Object} params
 * @param {number} params.userId - ID of the user performing the action
 * @param {string} params.action - 'create', 'update', 'delete', 'login', etc.
 * @param {string} params.module - Name of the module (e.g., 'expenses', 'revenues')
 * @param {number} params.entityId - ID of the affected record
 * @param {Object} [params.oldValues] - JSON object of values before change
 * @param {Object} [params.newValues] - JSON object of values after change
 * @param {string} [params.ipAddress] - IP address of the requester
 * @param {string} [params.userAgent] - User agent string
 */
export const logAudit = async ({
    userId,
    action,
    module,
    entityId,
    oldValues,
    newValues,
    ipAddress,
    userAgent
}) => {
    try {
        await _query(
            `INSERT INTO audit_logs (user_id, action, module, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                action,
                module,
                entityId,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                ipAddress,
                userAgent
            ]
        );
    } catch (error) {
        console.error('Audit Log Error:', error);
        // We don't throw here to avoid failing the main request if logging fails
    }
};
