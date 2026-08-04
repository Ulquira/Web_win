import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.getConnection().then(conn => {
  console.log('Conectado a Azure MySQL con éxito');
  conn.release();
}).catch(err => {
  console.error('Error al conectar con la base de datos MySQL:', err);
});

export default pool;
