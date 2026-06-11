import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// En Cloud Run, usa localhost (proxy), en local usa IP pública
const host = process.env.DB_HOST || 'localhost';

const pool = mysql.createPool({
  host: host,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'win_instalaciones',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;