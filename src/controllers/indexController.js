import { pool1, pool2 } from '../config/db.js';

export const compareIndexes = async (req, res) => {
  const { table } = req.params;
  try {
    const [idx1] = await pool1.query(`SHOW INDEX FROM \`${table}\``).catch(() => [[]]);
    const [idx2] = await pool2.query(`SHOW INDEX FROM \`${table}\``).catch(() => [[]]);
    
    const groupIndexes = (indexes) => {
      const grouped = {};
      for (const idx of indexes) {
        if (!grouped[idx.Key_name]) {
          grouped[idx.Key_name] = { name: idx.Key_name, columns: [], unique: !idx.Non_unique };
        }
        grouped[idx.Key_name].columns.push(idx.Column_name);
      }
      return grouped;
    };
    
    const group1 = groupIndexes(idx1);
    const group2 = groupIndexes(idx2);
    
    const allIndexes = [...new Set([...Object.keys(group1), ...Object.keys(group2)])];
    
    const comparison = allIndexes.map(name => {
      const i1 = group1[name];
      const i2 = group2[name];
      
      if (!i1) return { name, status: 'db2-only', db1: null, db2: i2 };
      if (!i2) return { name, status: 'db1-only', db1: i1, db2: null };
      
      const match = JSON.stringify(i1.columns) === JSON.stringify(i2.columns) && i1.unique === i2.unique;
      return { name, status: match ? 'match' : 'different', db1: i1, db2: i2 };
    });
    
    res.json({
      table,
      indexes: comparison,
      summary: {
        total: comparison.length,
        matching: comparison.filter(i => i.status === 'match').length,
        different: comparison.filter(i => i.status === 'different').length,
        onlyInDb1: comparison.filter(i => i.status === 'db1-only').length,
        onlyInDb2: comparison.filter(i => i.status === 'db2-only').length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
