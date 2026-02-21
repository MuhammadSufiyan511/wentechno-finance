import { query as _query } from '../config/db.js';

export const approvalRequired = async (req, res, next) => {
    // Only check for write operations
    if (!['POST', 'PUT'].includes(req.method)) {
        return next();
    }

    const { amount, category } = req.body;
    const HIGH_VALUE_THRESHOLD = 10000;
    const SENSITIVE_CATEGORIES = ['Refund', 'Correction', 'Adjustment', 'Equity Withdrawal'];

    let requiresApproval = false;
    let reason = '';

    if (parseFloat(amount) >= HIGH_VALUE_THRESHOLD) {
        requiresApproval = true;
        reason = `High value transaction: Rs. ${parseFloat(amount).toLocaleString()}`;
    } else if (SENSITIVE_CATEGORIES.includes(category)) {
        requiresApproval = true;
        reason = `Sensitive category: ${category}`;
    }

    if (requiresApproval) {
        req.requiresApproval = true;
        req.approvalReason = reason;
        req.approvalStatus = 'pending';
    } else {
        req.requiresApproval = false;
        req.approvalStatus = 'na';
    }

    next();
};
