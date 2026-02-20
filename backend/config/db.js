import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

pool
  .getConnection()
  .then((conn) => {
    console.log('MySQL Database connected successfully');
    conn.release();
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
  });

export const query = (sql, params) => pool.query(sql, params);
export default pool;
