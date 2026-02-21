import { Router } from 'express';
import { query as _query } from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();
const BU_ID = 6; // General Office

// ============ VENDORS ============

router.get('/vendors', auth, async (req, res, next) => {
    try {
        const [vendors] = await _query('SELECT * FROM vendors ORDER BY name ASC');
        res.json({ success: true, data: vendors });
    } catch (error) {
        next(error);
    }
});

router.post('/vendors', auth, async (req, res, next) => {
    try {
        const { name, contact_person, email, phone, address, category } = req.body;
        await _query(
            'INSERT INTO vendors (name, contact_person, email, phone, address, category) VALUES (?, ?, ?, ?, ?, ?)',
            [name, contact_person, email, phone, address, category]
        );
        res.status(201).json({ success: true, message: 'Vendor added' });
    } catch (error) {
        next(error);
    }
});

// ============ PROCUREMENT (PO) ============

router.get('/purchase-orders', auth, async (req, res, next) => {
    try {
        const [pos] = await _query(`
      SELECT po.*, v.name as vendor_name 
      FROM purchase_orders po 
      JOIN vendors v ON po.vendor_id = v.id 
      ORDER BY po.order_date DESC
    `);
        res.json({ success: true, data: pos });
    } catch (error) {
        next(error);
    }
});

router.post('/purchase-orders', auth, async (req, res, next) => {
    try {
        const { vendor_id, business_unit_id, total_amount, order_date, notes } = req.body;
        const po_number = `PO-${Date.now()}`;

        await _query(
            'INSERT INTO purchase_orders (vendor_id, business_unit_id, po_number, total_amount, status, order_date, notes) VALUES (?, ?, ?, ?, "draft", ?, ?)',
            [vendor_id, business_unit_id || BU_ID, po_number, total_amount, order_date, notes]
        );

        res.status(201).json({ success: true, data: { po_number } });
    } catch (error) {
        next(error);
    }
});

export default router;
