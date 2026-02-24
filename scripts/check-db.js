import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'company_finance'
});

async function check() {
    try {
        const [rows] = await pool.query("SHOW TABLES LIKE 'quotes'");
        console.log('Quotes table exists:', rows.length > 0);

        const [auditRows] = await pool.query("SHOW TABLES LIKE 'audit_logs'");
        console.log('Audit Logs table exists:', auditRows.length > 0);

        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err.message);
        process.exit(1);
    }
}

check();
