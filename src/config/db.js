import 'dotenv/config';
import mysql from 'mysql2/promise';

export const db1Config = {
  host: process.env.DB1_HOST || 'localhost',
  port: parseInt(process.env.DB1_PORT || '3306'),
  user: process.env.DB1_USER || 'root',
  password: process.env.DB1_PASSWORD || '',
  database: process.env.DB1_DATABASE || 'database1',
  alias: process.env.DB1_ALIAS || null
};

export const db2Config = {
  host: process.env.DB2_HOST || 'localhost',
  port: parseInt(process.env.DB2_PORT || '3306'),
  user: process.env.DB2_USER || 'root',
  password: process.env.DB2_PASSWORD || '',
  database: process.env.DB2_DATABASE || 'database2',
  alias: process.env.DB2_ALIAS || null
};

export const magicApiDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'cbs_report'
};

// We pre-declare them but won't initialize until initPools()
export let pool1 = null;
export let pool2 = null;
export let magicApiPool = null;

function createPool(config) {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

export function initPools() {
  pool1 = createPool(db1Config);
  pool2 = createPool(db2Config);
  magicApiPool = createPool(magicApiDbConfig);
}
