import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'company_finance'
});

async function run() {
    const auditLogsSql = `
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        action ENUM('create', 'update', 'delete', 'login', 'logout', 'other') NOT NULL,
        module VARCHAR(50) NOT NULL,
        entity_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `;

    try {
        console.log('Creating audit_logs table...');
        await pool.query(auditLogsSql);
        console.log('audit_logs table verified/created!');

        // Also try the indices
        try {
            await pool.query("CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)");
            await pool.query("CREATE INDEX idx_audit_logs_module_entity ON audit_logs(module, entity_id)");
            console.log('Indices created!');
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') console.log('Indices already exist.');
            else console.error('Index error:', e.message);
        }

        process.exit(0);
    } catch (err) {
        console.error('Failed to create audit_logs:', err.message);
        process.exit(1);
    }
}

run();
