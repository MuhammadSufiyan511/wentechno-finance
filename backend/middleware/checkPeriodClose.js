import { query as _query } from '../config/db.js';

export const checkPeriodClose = async (req, res, next) => {
    try {
        // Only check write operations
        if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
            let dateToCheck;

            // Extract date from different possible locations
            if (req.body && req.body.date) {
                dateToCheck = new Date(req.body.date);
            } else if (req.method === 'PUT' || req.method === 'DELETE') {
                // For updates/deletes, we might need to fetch the original record's date
                // For now, assume the current date if not specified, 
                // but ideally we should check the record being modified.
                // Simplified approach for now: check if the month of the action is closed.
                dateToCheck = new Date();
            }

            if (dateToCheck && !isNaN(dateToCheck)) {
                const year = dateToCheck.getFullYear();
                const month = dateToCheck.getMonth() + 1;

                const [closed] = await _query(
                    'SELECT status FROM period_closes WHERE year = ? AND month = ? AND status = "closed"',
                    [year, month]
                );

                if (closed && closed.length > 0) {
                    return res.status(403).json({
                        success: false,
                        message: `Financial period ${month}/${year} is closed. Modifications are not allowed.`,
                        requestId: req.id
                    });
                }
            }
        }
        next();
    } catch (error) {
        console.error('Period Close Check Error:', error);
        next(); // Proceed if check fails to avoid blocking the system
    }
};
