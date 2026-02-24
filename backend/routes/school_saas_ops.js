import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();
const BU_ID = 3;

// ============ RENEWAL PIPELINE ============

router.get('/renewals', auth, async (req, res, next) => {
    try {
        const [renewals] = await _query(`
      SELECT s.*, sch.school_name 
      FROM subscriptions s 
      JOIN saas_schools sch ON s.school_id = sch.id 
      WHERE s.status = 'active' 
      AND (s.next_billing_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY))
      ORDER BY s.next_billing_date ASC
    `);
        res.json({ success: true, data: renewals });
    } catch (error) {
        next(error);
    }
});

// ============ SaaS METRICS (MRR/ARR) ============

router.get('/metrics', auth, async (req, res, next) => {
    try {
        const [metrics] = await _query(`
      SELECT 
        COALESCE(SUM(
          CASE billing_cycle
            WHEN 'monthly' THEN amount
            WHEN 'quarterly' THEN amount / 3
            WHEN 'semi_annual' THEN amount / 6
            WHEN 'yearly' THEN amount / 12
            ELSE amount
          END
        ), 0) as total_mrr,
        COALESCE(SUM(
          CASE billing_cycle
            WHEN 'monthly' THEN amount * 12
            WHEN 'quarterly' THEN amount * 4
            WHEN 'semi_annual' THEN amount * 2
            WHEN 'yearly' THEN amount
            ELSE amount * 12
          END
        ), 0) as total_arr,
        COUNT(*) as total_active_subs
      FROM subscriptions 
      WHERE business_unit_id = ? AND status = 'active'
    `, [BU_ID]);

        const [churn] = await _query(`
      SELECT COUNT(*) as churned_this_month 
      FROM saas_schools 
      WHERE status = 'churned' 
      AND MONTH(churn_date) = MONTH(CURDATE()) AND YEAR(churn_date) = YEAR(CURDATE())
    `);

        res.json({
            success: true,
            data: {
                ...metrics[0],
                churn: churn[0].churned_this_month
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
