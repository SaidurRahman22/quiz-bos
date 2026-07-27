import mysql from 'mysql2/promise';
import { dbConfig, DB_NAME } from './config.js';

// Pool used by the API. `setup.js` creates the database/tables first.
export const pool = mysql.createPool({
  ...dbConfig,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
