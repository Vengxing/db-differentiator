import { pool1, pool2 } from '../config/db.js';

export const getTables = async (req, res) => {
  try {
    const [rows1] = await pool1.query('SHOW TABLES');
    const [rows2] = await pool2.query('SHOW TABLES');
    
    const tables1 = rows1.map(row => Object.values(row)[0]);
    const tables2 = rows2.map(row => Object.values(row)[0]);
    
    const set1 = new Set(tables1);
    const set2 = new Set(tables2);
    
    const comparison = [];
    const allTables = [...new Set([...tables1, ...tables2])].sort();
    
    for (const table of allTables) {
      comparison.push({
        name: table,
        inDb1: set1.has(table),
        inDb2: set2.has(table),
        status: set1.has(table) && set2.has(table) ? 'both' : 
                set1.has(table) ? 'db1-only' : 'db2-only'
      });
    }
    
    res.json({
      db1Tables: tables1.length,
      db2Tables: tables2.length,
      common: comparison.filter(t => t.status === 'both').length,
      onlyInDb1: comparison.filter(t => t.status === 'db1-only').length,
      onlyInDb2: comparison.filter(t => t.status === 'db2-only').length,
      tables: comparison
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
