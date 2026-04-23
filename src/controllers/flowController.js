import { pool1, pool2 } from '../config/db.js';

export const getFlowTables = async (req, res) => {
  const { db } = req.query;
  const pool = db === 'db2' ? pool2 : pool1;
  try {
    const [rows] = await pool.query('SHOW TABLES');
    const tables = rows.map(row => Object.values(row)[0]).sort();
    res.json({ db: db || 'db1', tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFlowColumns = async (req, res) => {
  const { db, table } = req.query;
  if (!table) return res.status(400).json({ error: 'table is required' });
  const pool = db === 'db2' ? pool2 : pool1;
  try {
    const [cols] = await pool.query(`DESCRIBE \`${table}\``);
    const columns = cols.map(c => ({
      field: c.Field,
      type: c.Type,
      nullable: c.Null === 'YES',
      key: c.Key,
      default: c.Default,
      extra: c.Extra,
      isPrimary: c.Key === 'PRI'
    }));
    const primaryKeys = columns.filter(c => c.isPrimary).map(c => c.field);
    res.json({ db: db || 'db1', table, columns, primaryKeys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
