import { db1Config, db2Config, initPools, pool1, pool2 } from '../config/db.js';

export const getConnections = (req, res) => {
  res.json({
    db1: {
      host: db1Config.host,
      port: db1Config.port,
      database: db1Config.database,
      user: db1Config.user,
      alias: db1Config.alias,
      displayName: db1Config.alias || db1Config.database
    },
    db2: {
      host: db2Config.host,
      port: db2Config.port,
      database: db2Config.database,
      user: db2Config.user,
      alias: db2Config.alias,
      displayName: db2Config.alias || db2Config.database
    }
  });
};

export const testConnection = async (req, res) => {
  try {
    initPools();
    await pool1.query('SELECT 1');
    await pool2.query('SELECT 1');
    res.json({ success: true, message: 'Both databases connected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
