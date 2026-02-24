import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';
import { checkPeriodClose } from '../middleware/checkPeriodClose.js';
import { approvalRequired } from '../middleware/approvalRequired.js';
import { validate, transactionRules, schoolRules } from '../middleware/validator.js';
import { monthToNumber } from '../utils/dateUtils.js';

const router = Router();
const BU_ID = 3;

let ready = false;
const ensure = async () => {
  if (ready) return;
  await _query(`CREATE TABLE IF NOT EXISTS saas_plan_catalog (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    price_monthly DECIMAL(15,2) DEFAULT 0,
    price_yearly DECIMAL(15,2) DEFAULT 0,
    student_limit INT DEFAULT 0,
    features_json TEXT,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await _query(`CREATE TABLE IF NOT EXISTS saas_invoices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    school_id INT NOT NULL,
    subscription_id INT NULL,
    invoice_number VARCHAR(60) NOT NULL UNIQUE,
    amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    due_date DATE NOT NULL,
    issued_date DATE NOT NULL,
    status ENUM('draft','sent','partial','paid','overdue','cancelled') DEFAULT 'sent',
    promise_to_pay_date DATE NULL,
    last_reminder_date DATE NULL,
    next_reminder_date DATE NULL,
    notes TEXT,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES saas_schools(id) ON DELETE CASCADE
  )`);
  await _query(`CREATE TABLE IF NOT EXISTS saas_dunning_actions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    school_id INT NOT NULL,
    action_type ENUM('email','whatsapp','call','promise_to_pay','escalation') NOT NULL,
    action_date DATE NOT NULL,
    notes TEXT,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES saas_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (school_id) REFERENCES saas_schools(id) ON DELETE CASCADE
  )`);
  await _query(`CREATE TABLE IF NOT EXISTS saas_school_activity (
    id INT PRIMARY KEY AUTO_INCREMENT,
    school_id INT NOT NULL,
    activity_date DATE NOT NULL,
    active_users INT DEFAULT 0,
    feature_usage_score DECIMAL(6,2) DEFAULT 0,
    api_calls INT DEFAULT 0,
    tickets_opened INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES saas_schools(id) ON DELETE CASCADE
  )`);
  try { await _query('ALTER TABLE subscriptions ADD COLUMN school_id INT NULL'); } catch {}
  try { await _query("ALTER TABLE subscriptions ADD COLUMN source_panel VARCHAR(30) DEFAULT 'school_saas'"); } catch {}
  try { await _query('ALTER TABLE subscriptions ADD COLUMN mrr DECIMAL(15,2) DEFAULT 0'); } catch {}
  try { await _query('ALTER TABLE subscriptions ADD COLUMN arr DECIMAL(15,2) DEFAULT 0'); } catch {}
  try { await _query('ALTER TABLE subscriptions ADD COLUMN auto_renew BOOLEAN DEFAULT TRUE'); } catch {}
  try { await _query('ALTER TABLE subscriptions ADD COLUMN renewal_date DATE NULL'); } catch {}
  ready = true;
};

const getRange = (query) => {
  if (query.from || query.to) return { from: query.from || null, to: query.to || null };
  const d = new Date();
  const month = monthToNumber(query.month) || (d.getMonth() + 1);
  const year = Number(query.year || d.getFullYear());
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
};

const cycleMonths = (cycle) => (cycle === 'quarterly' ? 3 : cycle === 'semi_annual' ? 6 : cycle === 'yearly' ? 12 : 1);

router.get('/overview', auth, async (req, res, next) => {
  try {
    await ensure();
    const range = getRange(req.query);
    const [schools] = await _query(`SELECT COUNT(*) total, SUM(status='active') active, SUM(status='trial') trial, SUM(status='churned') churned, COALESCE(SUM(students_count),0) students FROM saas_schools`);
    const [subs] = await _query(`SELECT COALESCE(SUM(CASE billing_cycle WHEN 'monthly' THEN amount WHEN 'quarterly' THEN amount/3 WHEN 'semi_annual' THEN amount/6 WHEN 'yearly' THEN amount/12 ELSE amount END),0) mrr FROM subscriptions WHERE business_unit_id=? AND status='active'`, [BU_ID]);
    const [fin] = await _query(`SELECT
      (SELECT COALESCE(SUM(amount),0) FROM revenues WHERE business_unit_id=? AND date>=? AND date<=?) revenue,
      (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE business_unit_id=? AND date>=? AND date<=?) expenses,
      (SELECT COALESCE(SUM(total_amount-paid_amount),0) FROM saas_invoices WHERE status IN ('sent','partial','overdue')) receivables`, [BU_ID, range.from, range.to, BU_ID, range.from, range.to]);
    const [planDistribution] = await _query(`SELECT plan name, COUNT(*) count, COALESCE(SUM(monthly_fee),0) total FROM saas_schools WHERE status IN ('active','trial') GROUP BY plan ORDER BY count DESC`);
    const [revenueTrend] = await _query(`SELECT DATE_FORMAT(date,'%Y-%m') period, COALESCE(SUM(amount),0) total FROM revenues WHERE business_unit_id=? AND date>=DATE_SUB(CURDATE(), INTERVAL 6 MONTH) GROUP BY DATE_FORMAT(date,'%Y-%m') ORDER BY period`, [BU_ID]);
    const total = Number(schools[0].total || 0);
    const churned = Number(schools[0].churned || 0);
    const revenue = Number(fin[0].revenue || 0);
    const expenses = Number(fin[0].expenses || 0);
    const mrr = Number(subs[0].mrr || 0);
    res.json({ success: true, data: {
      range,
      totalSchools: total,
      activeSchools: Number(schools[0].active || 0),
      trialSchools: Number(schools[0].trial || 0),
      churnedSchools: churned,
      totalStudents: Number(schools[0].students || 0),
      mrr,
      arr: mrr * 12,
      revenue,
      expenses,
      profit: revenue - expenses,
      receivables: Number(fin[0].receivables || 0),
      churnRate: total > 0 ? Number(((churned / total) * 100).toFixed(2)) : 0,
      planDistribution,
      revenueTrend
    }});
  } catch (e) { next(e); }
});

router.get('/schools', auth, async (req, res, next) => {
  try { await ensure(); const [rows] = await _query('SELECT * FROM saas_schools ORDER BY created_at DESC'); res.json({ success: true, data: rows }); } catch (e) { next(e); }
});
router.post('/schools', auth, validate(schoolRules), checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const { school_name, contact_person, email, phone, address, plan, monthly_fee, students_count, join_date, status } = req.body;
    const [r] = await _query(`INSERT INTO saas_schools (school_name,contact_person,email,phone,address,plan,monthly_fee,students_count,status,join_date) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [school_name, contact_person || null, email || null, phone || null, address || null, plan || 'basic', monthly_fee, students_count || 0, status || 'active', join_date]);
    const [rows] = await _query('SELECT * FROM saas_schools WHERE id=?', [r.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});
router.put('/schools/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const { id } = req.params;
    const allowedFields = new Set([
      'school_id',
      'plan_name',
      'amount',
      'billing_cycle',
      'start_date',
      'end_date',
      'next_billing_date',
      'status',
      'auto_renew',
      'renewal_date'
    ]);
    const fields = Object.fromEntries(
      Object.entries(req.body || {}).filter(([k]) => allowedFields.has(k))
    );
    if (!Object.keys(fields).length) return res.status(400).json({ success: false, message: 'No fields provided for update' });
    const updates = Object.keys(fields).map(k => `${k}=?`).join(', ');
    await _query(`UPDATE saas_schools SET ${updates} WHERE id=?`, [...Object.values(fields), id]);
    const [rows] = await _query('SELECT * FROM saas_schools WHERE id=?', [id]);
    res.json({ success: true, data: rows[0] || null });
  } catch (e) { next(e); }
});
router.patch('/schools/:id/lifecycle', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const { id } = req.params;
    const { status, churn_reason } = req.body;
    const allowed = ['trial', 'active', 'inactive', 'churned'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(', ')}` });
    await _query(`UPDATE saas_schools SET status=?, churn_date=CASE WHEN ?='churned' THEN CURDATE() ELSE churn_date END, churn_reason=CASE WHEN ?='churned' THEN ? ELSE churn_reason END WHERE id=?`, [status, status, status, churn_reason || null, id]);
    if (['churned', 'inactive'].includes(status)) await _query(`UPDATE subscriptions SET status=? WHERE school_id=? AND business_unit_id=? AND status='active'`, [status === 'churned' ? 'cancelled' : 'paused', id, BU_ID]);
    const [rows] = await _query('SELECT * FROM saas_schools WHERE id=?', [id]);
    res.json({ success: true, data: rows[0] || null });
  } catch (e) { next(e); }
});
router.delete('/schools/:id', auth, checkPeriodClose, async (req, res, next) => {
  try { await ensure(); await _query('DELETE FROM saas_schools WHERE id=?', [req.params.id]); res.json({ success: true, message: 'School deleted successfully' }); } catch (e) { next(e); }
});

// Plans
router.get('/plans', auth, async (req, res, next) => {
  try { await ensure(); const [rows] = await _query('SELECT * FROM saas_plan_catalog ORDER BY price_monthly ASC, name'); res.json({ success: true, data: rows }); } catch (e) { next(e); }
});
router.post('/plans', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const { name, price_monthly, price_yearly, student_limit, features_json, status } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });
    const [r] = await _query(`INSERT INTO saas_plan_catalog (name,price_monthly,price_yearly,student_limit,features_json,status) VALUES (?,?,?,?,?,?)`,
      [name, Number(price_monthly || 0), Number(price_yearly || 0), Number(student_limit || 0), features_json || null, status || 'active']);
    const [rows] = await _query('SELECT * FROM saas_plan_catalog WHERE id=?', [r.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});
router.put('/plans/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const allowedFields = new Set([
      'school_id',
      'plan_name',
      'amount',
      'billing_cycle',
      'start_date',
      'end_date',
      'next_billing_date',
      'status',
      'auto_renew',
      'renewal_date'
    ]);
    const fields = Object.fromEntries(
      Object.entries(req.body || {}).filter(([k]) => allowedFields.has(k))
    );
    if (!Object.keys(fields).length) return res.status(400).json({ success: false, message: 'No fields provided for update' });
    const updates = Object.keys(fields).map(k => `${k}=?`).join(', ');
    await _query(`UPDATE saas_plan_catalog SET ${updates} WHERE id=?`, [...Object.values(fields), req.params.id]);
    const [rows] = await _query('SELECT * FROM saas_plan_catalog WHERE id=?', [req.params.id]);
    res.json({ success: true, data: rows[0] || null });
  } catch (e) { next(e); }
});
router.delete('/plans/:id', auth, checkPeriodClose, async (req, res, next) => {
  try { await ensure(); await _query('DELETE FROM saas_plan_catalog WHERE id=?', [req.params.id]); res.json({ success: true, message: 'Plan deleted' }); } catch (e) { next(e); }
});

// Subscriptions
router.get('/subscriptions', auth, async (req, res, next) => {
  try {
    await ensure();
    const [rows] = await _query(`SELECT sub.*, s.school_name FROM subscriptions sub LEFT JOIN saas_schools s ON s.id=sub.school_id WHERE sub.business_unit_id=? ORDER BY sub.next_billing_date ASC, sub.id DESC`, [BU_ID]);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});
router.post('/subscriptions', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const { school_id, plan_name, amount, billing_cycle, start_date, end_date, next_billing_date, auto_renew, status } = req.body;
    if (!school_id || !plan_name || !(Number(amount) > 0) || !start_date) return res.status(400).json({ success: false, message: 'school_id, plan_name, positive amount and start_date are required' });
    const amt = Number(amount);
    const cycle = billing_cycle || 'monthly';
    const mrr = cycle === 'monthly' ? amt : cycle === 'quarterly' ? amt / 3 : cycle === 'semi_annual' ? amt / 6 : amt / 12;
    const [r] = await _query(`INSERT INTO subscriptions (business_unit_id,school_id,plan_name,amount,billing_cycle,start_date,end_date,next_billing_date,status,mrr,arr,auto_renew)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [BU_ID, school_id, plan_name, amt, cycle, start_date, end_date || null, next_billing_date || start_date, status || 'active', mrr, mrr * 12, auto_renew === false ? 0 : 1]);
    await _query('UPDATE saas_schools SET plan=?, monthly_fee=?, status=? WHERE id=?', [plan_name, mrr, status === 'active' ? 'active' : 'trial', school_id]);
    const [rows] = await _query('SELECT * FROM subscriptions WHERE id=?', [r.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});
router.put('/subscriptions/:id', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const { id } = req.params;
    const [oldRows] = await _query('SELECT * FROM subscriptions WHERE id=?', [id]);
    if (!oldRows.length) return res.status(404).json({ success: false, message: 'Subscription not found' });
    const allowedFields = new Set([
      'school_id',
      'plan_name',
      'amount',
      'billing_cycle',
      'start_date',
      'end_date',
      'next_billing_date',
      'status',
      'auto_renew',
      'renewal_date'
    ]);
    const fields = Object.fromEntries(
      Object.entries(req.body || {}).filter(([k]) => allowedFields.has(k))
    );
    if (fields.amount !== undefined || fields.billing_cycle !== undefined) {
      const amt = Number(fields.amount ?? oldRows[0].amount);
      const cycle = fields.billing_cycle ?? oldRows[0].billing_cycle;
      const mrr = cycle === 'monthly' ? amt : cycle === 'quarterly' ? amt / 3 : cycle === 'semi_annual' ? amt / 6 : amt / 12;
      fields.mrr = mrr; fields.arr = mrr * 12;
    }
    if (!Object.keys(fields).length) return res.status(400).json({ success: false, message: 'No fields provided for update' });
    const updates = Object.keys(fields).map(k => `${k}=?`).join(', ');
    await _query(`UPDATE subscriptions SET ${updates} WHERE id=?`, [...Object.values(fields), id]);
    const [rows] = await _query('SELECT * FROM subscriptions WHERE id=?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});
router.post('/subscriptions/:id/renew', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const [rows] = await _query('SELECT * FROM subscriptions WHERE id=? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Subscription not found' });
    const sub = rows[0];
    const baseDate = sub.next_billing_date ? new Date(sub.next_billing_date) : new Date();
    baseDate.setMonth(baseDate.getMonth() + cycleMonths(sub.billing_cycle));
    const nextBilling = baseDate.toISOString().slice(0, 10);
    await _query('UPDATE subscriptions SET status=\"active\", renewal_date=CURDATE(), next_billing_date=? WHERE id=?', [nextBilling, req.params.id]);
    res.json({ success: true, message: 'Subscription renewed', data: { next_billing_date: nextBilling } });
  } catch (e) { next(e); }
});
router.post('/subscriptions/:id/cancel', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const [rows] = await _query('SELECT * FROM subscriptions WHERE id=? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Subscription not found' });
    await _query('UPDATE subscriptions SET status=\"cancelled\", auto_renew=0 WHERE id=?', [req.params.id]);
    if (rows[0].school_id) await _query('UPDATE saas_schools SET status=\"churned\", churn_date=CURDATE(), churn_reason=? WHERE id=?', [req.body.reason || 'subscription_cancelled', rows[0].school_id]);
    res.json({ success: true, message: 'Subscription cancelled' });
  } catch (e) { next(e); }
});

// Invoices / Dunning
router.get('/invoices', auth, async (req, res, next) => {
  try {
    await ensure();
    const [rows] = await _query(`SELECT i.*, s.school_name, (i.total_amount-i.paid_amount) due_amount FROM saas_invoices i JOIN saas_schools s ON s.id=i.school_id ORDER BY i.issued_date DESC, i.id DESC`);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});
router.post('/invoices/generate', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const { school_id, subscription_id, amount, tax_amount, discount_amount, due_date, notes } = req.body;
    if (!school_id || !(Number(amount) > 0) || !due_date) return res.status(400).json({ success: false, message: 'school_id, positive amount and due_date are required' });
    const amt = Number(amount), tax = Number(tax_amount || 0), discount = Number(discount_amount || 0);
    const total = Math.max(amt + tax - discount, 0);
    const invoiceNumber = `SAAS-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
    const [r] = await _query(`INSERT INTO saas_invoices (school_id,subscription_id,invoice_number,amount,tax_amount,discount_amount,total_amount,due_date,issued_date,status,notes,created_by)
      VALUES (?,?,?,?,?,?,?,?,CURDATE(),'sent',?,?)`, [school_id, subscription_id || null, invoiceNumber, amt, tax, discount, total, due_date, notes || null, req.user.id]);
    const [rows] = await _query('SELECT * FROM saas_invoices WHERE id=?', [r.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});
router.patch('/invoices/:id/status', auth, checkPeriodClose, async (req, res, next) => {
  try {
    await ensure();
    const { id } = req.params;
    const { status, paid_amount, payment_date } = req.body;
    const [rows] = await _query('SELECT * FROM saas_invoices WHERE id=? LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const inv = rows[0];
    const addPaid = Number(paid_amount || 0);
    const newPaid = Math.min(Number(inv.paid_amount || 0) + Math.max(addPaid, 0), Number(inv.total_amount || 0));
    const due = Number(inv.total_amount || 0) - newPaid;
    const nextStatus = status || (due <= 0 ? 'paid' : newPaid > 0 ? 'partial' : inv.status);
    await _query('UPDATE saas_invoices SET paid_amount=?, status=? WHERE id=?', [newPaid, nextStatus, id]);
    if (addPaid > 0) await _query('INSERT INTO revenues (business_unit_id,category,amount,description,date,payment_status) VALUES (?,?,?,?,?,?)', [BU_ID, 'Subscription Fee', addPaid, `Invoice payment: ${inv.invoice_number}`, payment_date || new Date().toISOString().slice(0, 10), due <= 0 ? 'paid' : 'partial']);
    const [updated] = await _query('SELECT *, (total_amount-paid_amount) due_amount FROM saas_invoices WHERE id=?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (e) { next(e); }
});
router.get('/receivables', auth, async (req, res, next) => {
  try {
    await ensure();
    const [rows] = await _query(`SELECT i.*, s.school_name, (i.total_amount-i.paid_amount) due_amount, DATEDIFF(CURDATE(), i.due_date) overdue_days,
      CASE WHEN DATEDIFF(CURDATE(), i.due_date)<=30 THEN '0-30' WHEN DATEDIFF(CURDATE(), i.due_date)<=60 THEN '31-60' ELSE '60+' END aging_bucket,
      (LEAST((i.total_amount-i.paid_amount)/1000,70)+CASE WHEN DATEDIFF(CURDATE(), i.due_date)<=30 THEN 10 WHEN DATEDIFF(CURDATE(), i.due_date)<=60 THEN 20 ELSE 30 END) priority_score
      FROM saas_invoices i JOIN saas_schools s ON s.id=i.school_id
      WHERE (i.total_amount-i.paid_amount)>0 AND i.status IN ('sent','partial','overdue')
      ORDER BY priority_score DESC, due_amount DESC`);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});
router.post('/invoices/:id/reminder', auth, async (req, res, next) => {
  try {
    await ensure();
    const [rows] = await _query('SELECT id,school_id FROM saas_invoices WHERE id=? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Invoice not found' });
    await _query(`INSERT INTO saas_dunning_actions (invoice_id,school_id,action_type,action_date,notes,created_by) VALUES (?,?,?,CURDATE(),?,?)`,
      [req.params.id, rows[0].school_id, req.body.channel || 'email', req.body.notes || 'Reminder sent', req.user.id]);
    await _query('UPDATE saas_invoices SET last_reminder_date=CURDATE(), next_reminder_date=? WHERE id=?', [req.body.next_reminder_date || null, req.params.id]);
    res.json({ success: true, message: 'Reminder logged' });
  } catch (e) { next(e); }
});
router.post('/invoices/:id/promise', auth, async (req, res, next) => {
  try {
    await ensure();
    if (!req.body.promise_to_pay_date) return res.status(400).json({ success: false, message: 'promise_to_pay_date is required' });
    const [rows] = await _query('SELECT id,school_id FROM saas_invoices WHERE id=? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Invoice not found' });
    await _query('UPDATE saas_invoices SET promise_to_pay_date=? WHERE id=?', [req.body.promise_to_pay_date, req.params.id]);
    await _query(`INSERT INTO saas_dunning_actions (invoice_id,school_id,action_type,action_date,notes,created_by) VALUES (?,?, 'promise_to_pay', CURDATE(), ?, ?)`,
      [req.params.id, rows[0].school_id, req.body.notes || 'Promise to pay captured', req.user.id]);
    res.json({ success: true, message: 'Promise-to-pay logged' });
  } catch (e) { next(e); }
});
router.get('/invoices/:id/dunning', auth, async (req, res, next) => {
  try { await ensure(); const [rows] = await _query('SELECT * FROM saas_dunning_actions WHERE invoice_id=? ORDER BY action_date DESC, id DESC', [req.params.id]); res.json({ success: true, data: rows }); } catch (e) { next(e); }
});

// Health / Reports
router.get('/health-scores', auth, async (req, res, next) => {
  try {
    await ensure();
    const [rows] = await _query(`SELECT s.id,s.school_name,s.plan,s.status,s.students_count,
      COALESCE(a.active_users,0) active_users, COALESCE(a.feature_usage_score,0) feature_usage_score,
      COALESCE(i.overdue_invoices,0) overdue_invoices, COALESCE(i.overdue_amount,0) overdue_amount,
      ROUND(GREATEST(0, LEAST(100,
        (CASE WHEN s.status='active' THEN 35 WHEN s.status='trial' THEN 20 ELSE 10 END)
        + LEAST(COALESCE(a.feature_usage_score,0)*0.35,25)
        + (CASE WHEN s.students_count>0 THEN LEAST((COALESCE(a.active_users,0)/s.students_count)*20,20) ELSE 10 END)
        + GREATEST(0,20-COALESCE(i.overdue_invoices,0)*8)
        - LEAST(COALESCE(i.overdue_amount,0)/5000,20)
      )),2) health_score
      FROM saas_schools s
      LEFT JOIN (SELECT school_id, AVG(active_users) active_users, AVG(feature_usage_score) feature_usage_score FROM saas_school_activity WHERE activity_date>=DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY school_id) a ON a.school_id=s.id
      LEFT JOIN (SELECT school_id, SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END) overdue_invoices, SUM(CASE WHEN status='overdue' THEN (total_amount-paid_amount) ELSE 0 END) overdue_amount FROM saas_invoices GROUP BY school_id) i ON i.school_id=s.id
      ORDER BY health_score ASC, overdue_amount DESC`);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});
router.post('/activity', auth, async (req, res, next) => {
  try {
    await ensure();
    const { school_id, activity_date, active_users, api_calls, tickets_opened, feature_usage_score } = req.body;
    if (!school_id || !activity_date) return res.status(400).json({ success: false, message: 'school_id and activity_date are required' });
    await _query(`INSERT INTO saas_school_activity (school_id,activity_date,active_users,api_calls,tickets_opened,feature_usage_score) VALUES (?,?,?,?,?,?)`,
      [school_id, activity_date, Number(active_users || 0), Number(api_calls || 0), Number(tickets_opened || 0), Number(feature_usage_score || 0)]);
    res.status(201).json({ success: true, message: 'Activity recorded' });
  } catch (e) { next(e); }
});
router.get('/reports/summary', auth, async (req, res, next) => {
  try {
    await ensure();
    const range = getRange(req.query);
    const [fin] = await _query(`SELECT
      (SELECT COALESCE(SUM(amount),0) FROM revenues WHERE business_unit_id=? AND date>=? AND date<=?) revenue,
      (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE business_unit_id=? AND date>=? AND date<=?) expenses,
      (SELECT COALESCE(SUM(total_amount-paid_amount),0) FROM saas_invoices WHERE status IN ('sent','partial','overdue')) receivables`, [BU_ID, range.from, range.to, BU_ID, range.from, range.to]);
    const [planBreakdown] = await _query(`SELECT plan name, COUNT(*) schools, COALESCE(SUM(monthly_fee),0) mrr FROM saas_schools WHERE status IN ('active','trial') GROUP BY plan ORDER BY mrr DESC`);
    const [statusBreakdown] = await _query(`SELECT status, COUNT(*) count FROM saas_schools GROUP BY status`);
    const [receivableRows] = await _query(`SELECT i.invoice_number, s.school_name, (i.total_amount-i.paid_amount) due_amount, i.due_date, i.status FROM saas_invoices i JOIN saas_schools s ON s.id=i.school_id WHERE (i.total_amount-i.paid_amount)>0 ORDER BY due_amount DESC LIMIT 25`);
    const revenue = Number(fin[0].revenue || 0), expenses = Number(fin[0].expenses || 0);
    res.json({ success: true, data: { range, revenue, expenses, profit: revenue - expenses, receivables: Number(fin[0].receivables || 0), planBreakdown, statusBreakdown, receivableRows } });
  } catch (e) { next(e); }
});
router.get('/reports/export', auth, async (req, res, next) => {
  try {
    await ensure();
    const range = getRange(req.query);
    const [rows] = await _query(`SELECT i.invoice_number,s.school_name,s.plan,i.issued_date,i.due_date,i.total_amount,i.paid_amount,(i.total_amount-i.paid_amount) due_amount,i.status FROM saas_invoices i JOIN saas_schools s ON s.id=i.school_id WHERE i.issued_date>=? AND i.issued_date<=? ORDER BY i.issued_date DESC, i.id DESC`, [range.from, range.to]);
    const headers = ['invoice_number','school_name','plan','issued_date','due_date','total_amount','paid_amount','due_amount','status'];
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `\"${String((r[h] ?? '')).replace(/\"/g, '\"\"')}\"`).join(','))].join('\\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=\"school-saas-report.csv\"');
    res.send(csv);
  } catch (e) { next(e); }
});

router.post('/revenue', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, amount, description, date, payment_status } = req.body;
    const [r] = await _query('INSERT INTO revenues (business_unit_id,category,amount,description,date,payment_status,approval_status) VALUES (?,?,?,?,?,?,?)', [BU_ID, category, amount, description, date, payment_status || 'paid', req.approvalStatus || 'na']);
    const [rows] = await _query('SELECT * FROM revenues WHERE id=?', [r.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});
router.post('/expenses', auth, validate(transactionRules), checkPeriodClose, approvalRequired, async (req, res, next) => {
  try {
    const { category, expense_type, amount, description, vendor, date } = req.body;
    const [r] = await _query('INSERT INTO expenses (business_unit_id,category,expense_type,amount,description,vendor,date,approval_status) VALUES (?,?,?,?,?,?,?,?)', [BU_ID, category, expense_type || 'fixed', amount, description, vendor || null, date, req.approvalStatus || 'na']);
    const [rows] = await _query('SELECT * FROM expenses WHERE id=?', [r.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
});
router.post('/reset', auth, async (req, res, next) => {
  try {
    await ensure();
    await _query('DELETE FROM saas_dunning_actions');
    await _query('DELETE FROM saas_school_activity');
    await _query('DELETE FROM saas_invoices');
    await _query('DELETE FROM subscriptions WHERE business_unit_id=? OR school_id IS NOT NULL', [BU_ID]);
    await _query('DELETE FROM saas_plan_catalog');
    await _query('DELETE FROM saas_schools');
    await _query('DELETE FROM revenues WHERE business_unit_id=?', [BU_ID]);
    await _query('DELETE FROM expenses WHERE business_unit_id=?', [BU_ID]);
    await _query('DELETE FROM transactions WHERE business_unit_id=?', [BU_ID]);
    res.json({ success: true, message: 'School SaaS panel data reset successfully' });
  } catch (e) { next(e); }
});

export default router;
