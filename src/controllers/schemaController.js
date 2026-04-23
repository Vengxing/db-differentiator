import { pool1, pool2, db1Config, db2Config } from '../config/db.js';

export const getSchemasOverview = async (req, res) => {
  try {
    const [rows1] = await pool1.query('SHOW TABLES');
    const [rows2] = await pool2.query('SHOW TABLES');
    
    const tables1 = rows1.map(row => Object.values(row)[0]);
    const tables2 = rows2.map(row => Object.values(row)[0]);
    
    const set1 = new Set(tables1);
    const set2 = new Set(tables2);
    const allTables = [...new Set([...tables1, ...tables2])].sort();

    // Fetch CREATE_TIME (actually last-modified time) from information_schema for both DBs
    const [ctRows1] = await pool1.query(
      `SELECT TABLE_NAME, CREATE_TIME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [db1Config.database]
    ).catch(() => [[]]);;
    const [ctRows2] = await pool2.query(
      `SELECT TABLE_NAME, CREATE_TIME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [db2Config.database]
    ).catch(() => [[]]);;

    const ctMap1 = new Map(ctRows1.map(r => [r.TABLE_NAME, r.CREATE_TIME]));
    const ctMap2 = new Map(ctRows2.map(r => [r.TABLE_NAME, r.CREATE_TIME]));
    
    const results = [];
    
    for (const table of allTables) {
      const inDb1 = set1.has(table);
      const inDb2 = set2.has(table);

      const createTime1 = ctMap1.get(table) || null;
      const createTime2 = ctMap2.get(table) || null;
      // createTime = most recent of both (used for merged-view sorting)
      const createTime = (createTime1 && createTime2)
        ? (new Date(createTime1) >= new Date(createTime2) ? createTime1 : createTime2)
        : (createTime1 || createTime2);
      
      if (!inDb1 || !inDb2) {
        results.push({ table, status: 'missing', inDb1, inDb2, createTime, createTime1, createTime2 });
        continue;
      }
      
      const [cols1] = await pool1.query(`DESCRIBE \`${table}\``).catch(() => [[]]);
      const [cols2] = await pool2.query(`DESCRIBE \`${table}\``).catch(() => [[]]);
      
      const map1 = new Map(cols1.map(c => [c.Field, c]));
      const map2 = new Map(cols2.map(c => [c.Field, c]));
      const allColumns = [...new Set([...map1.keys(), ...map2.keys()])];
      
      let hasMissingColumn = false;
      let hasDifferentStructure = false;
      
      for (const col of allColumns) {
        const c1 = map1.get(col);
        const c2 = map2.get(col);
        
        if (!c1 || !c2) {
          hasMissingColumn = true;
        } else {
          if (c1.Type !== c2.Type || c1.Null !== c2.Null || c1.Key !== c2.Key || 
              String(c1.Default) !== String(c2.Default) || c1.Extra !== c2.Extra) {
            hasDifferentStructure = true;
          }
        }
      }
      
      let status = 'match';
      if (hasMissingColumn) status = 'missing-column';
      else if (hasDifferentStructure) status = 'different';
      
      results.push({ table, status, inDb1: true, inDb2: true, createTime, createTime1, createTime2 });
    }
    
    res.json({
      tables: results,
      summary: {
        total: results.length,
        matching: results.filter(r => r.status === 'match').length,
        different: results.filter(r => r.status === 'different').length,
        missingColumn: results.filter(r => r.status === 'missing-column').length,
        missingTable: results.filter(r => r.status === 'missing').length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSchemaForTable = async (req, res) => {
  const { table } = req.params;
  try {
    const [cols1] = await pool1.query(`DESCRIBE \`${table}\``).catch(() => [[]]);
    const [cols2] = await pool2.query(`DESCRIBE \`${table}\``).catch(() => [[]]);
    
    const map1 = new Map(cols1.map(c => [c.Field, c]));
    const map2 = new Map(cols2.map(c => [c.Field, c]));
    const allColumns = [...new Set([...map1.keys(), ...map2.keys()])];
    
    const comparison = allColumns.map(col => {
      const c1 = map1.get(col);
      const c2 = map2.get(col);
      
      if (!c1) return { column: col, status: 'db2-only', db1: null, db2: c2 };
      if (!c2) return { column: col, status: 'db1-only', db1: c1, db2: null };
      
      const differences = [];
      if (c1.Type !== c2.Type) differences.push({ prop: 'Type', db1: c1.Type, db2: c2.Type });
      if (c1.Null !== c2.Null) differences.push({ prop: 'Nullable', db1: c1.Null, db2: c2.Null });
      if (c1.Key !== c2.Key) differences.push({ prop: 'Key', db1: c1.Key, db2: c2.Key });
      if (String(c1.Default) !== String(c2.Default)) differences.push({ prop: 'Default', db1: c1.Default, db2: c2.Default });
      if (c1.Extra !== c2.Extra) differences.push({ prop: 'Extra', db1: c1.Extra, db2: c2.Extra });
      
      return {
        column: col,
        status: differences.length > 0 ? 'different' : 'match',
        db1: c1,
        db2: c2,
        differences
      };
    });
    
    res.json({
      table,
      columns: comparison,
      summary: {
        total: comparison.length,
        matching: comparison.filter(c => c.status === 'match').length,
        different: comparison.filter(c => c.status === 'different').length,
        onlyInDb1: comparison.filter(c => c.status === 'db1-only').length,
        onlyInDb2: comparison.filter(c => c.status === 'db2-only').length
      },
      db1Order: cols1.map(c => c.Field),
      db2Order: cols2.map(c => c.Field)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
