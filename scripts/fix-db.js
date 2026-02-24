import mysql from 'mysql2/promise';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'company_finance',
    multipleStatements: true
});

async function fix() {
    try {
        console.log('Connecting to database...');
        const conn = await pool.getConnection();
        console.log('Connected!');

        const schemaPath = path.join(process.cwd(), 'backend', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Applying schema statements...');
        // Split by semicolon, handling simple cases
        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (let statement of statements) {
            if (statement.toLowerCase().startsWith('use ')) continue;
            try {
                await conn.query(statement);
            } catch (err) {
                if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                    // Skip these errors
                    continue;
                } else {
                    console.error(`Error in statement: ${statement.substring(0, 50)}...`);
                    console.error('Message:', err.message);
                }
            }
        }

        console.log('Database verification/fix completed!');
        conn.release();
        process.exit(0);
    } catch (err) {
        console.error('Error fixing database:', err.message);
        process.exit(1);
    }
}

fix();
