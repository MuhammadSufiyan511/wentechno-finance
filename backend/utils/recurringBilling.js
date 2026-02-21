import { query as _query } from '../config/db.js';

/**
 * Recurring Billing Engine
 * Scans active subscriptions and generates revenue/invoices if the billing date is due.
 */
export const runRecurringBilling = async () => {
    console.log('🔄 Running Recurring Billing Engine');
    const results = { generated: 0, errors: 0 };

    try {
        // 1. Get subscriptions due for billing
        const [dueSubs] = await _query(`
      SELECT * FROM subscriptions 
      WHERE status = 'active' 
      AND (next_billing_date <= CURDATE() OR next_billing_date IS NULL)
    `);

        for (const sub of dueSubs) {
            try {
                // Generate Revenue record
                await _query(`
          INSERT INTO revenues (business_unit_id, category, amount, description, date, payment_status)
          VALUES (?, ?, ?, ?, CURDATE(), 'pending')
        `, [
                    sub.business_unit_id,
                    'Subscription',
                    sub.amount,
                    `Recurring billing for sub #${sub.id} (${sub.plan_name})`
                ]);

                // Calculate next billing date based on cycle
                let interval = '1 MONTH';
                if (sub.billing_cycle === 'quarterly') interval = '3 MONTH';
                if (sub.billing_cycle === 'semi_annual') interval = '6 MONTH';
                if (sub.billing_cycle === 'yearly') interval = '12 MONTH';

                await _query(`
          UPDATE subscriptions 
          SET next_billing_date = DATE_ADD(IFNULL(next_billing_date, start_date), INTERVAL ${interval})
          WHERE id = ?
        `, [sub.id]);

                results.generated++;
            } catch (err) {
                console.error(`Failed to process sub #${sub.id}:`, err);
                results.errors++;
            }
        }

        return results;
    } catch (error) {
        console.error('Recurring billing job failed:', error);
        throw error;
    }
};
