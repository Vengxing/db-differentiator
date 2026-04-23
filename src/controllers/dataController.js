import { pool1, pool2 } from '../config/db.js';
import { getPrimaryKeys, normalizeValue } from '../utils/helpers.js';

export const getRowCounts = async (req, res) => {
  try {
    const [rows1] = await pool1.query('SHOW TABLES');
    const [rows2] = await pool2.query('SHOW TABLES');
    
    const tables1 = rows1.map(row => Object.values(row)[0]);
    const tables2 = rows2.map(row => Object.values(row)[0]);
    const commonTables = tables1.filter(t => tables2.includes(t));
    
    const results = [];
    
    for (const table of commonTables) {
      const [[count1]] = await pool1.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      const [[count2]] = await pool2.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      
      results.push({
        table,
        db1Count: count1.count,
        db2Count: count2.count,
        difference: count1.count - count2.count,
        match: count1.count === count2.count
      });
    }
    
    res.json({
      tables: results,
      summary: {
        total: results.length,
        matching: results.filter(r => r.match).length,
        different: results.filter(r => !r.match).length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const comparePrimaryKeys = async (req, res) => {
  const { table } = req.params;
  
  try {
    const pks1 = await getPrimaryKeys(pool1, table);
    const pks2 = await getPrimaryKeys(pool2, table);
    
    if (pks1.length === 0 && pks2.length === 0) {
      return res.json({ table, hasPrimaryKey: false, message: 'No primary key defined' });
    }
    
    if (JSON.stringify(pks1.sort()) !== JSON.stringify(pks2.sort())) {
      return res.json({ 
        table, 
        hasPrimaryKey: true, 
        pkMismatch: true,
        db1Pks: pks1,
        db2Pks: pks2
      });
    }
    
    const pkCols = pks1.map(pk => `\`${pk}\``).join(', ');
    const [rows1] = await pool1.query(`SELECT ${pkCols} FROM \`${table}\` ORDER BY ${pkCols}`);
    const [rows2] = await pool2.query(`SELECT ${pkCols} FROM \`${table}\` ORDER BY ${pkCols}`);
    
    const makeKey = (row) => pks1.map(pk => JSON.stringify(row[pk])).join('|');
    
    const set1 = new Set(rows1.map(makeKey));
    const set2 = new Set(rows2.map(makeKey));
    
    const onlyInDb1 = rows1.filter(row => !set2.has(makeKey(row)));
    const onlyInDb2 = rows2.filter(row => !set1.has(makeKey(row)));
    
    res.json({
      table,
      hasPrimaryKey: true,
      primaryKeys: pks1,
      db1Total: rows1.length,
      db2Total: rows2.length,
      onlyInDb1: onlyInDb1.slice(0, 100),
      onlyInDb2: onlyInDb2.slice(0, 100),
      onlyInDb1Count: onlyInDb1.length,
      onlyInDb2Count: onlyInDb2.length,
      commonCount: rows1.length - onlyInDb1.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const compareRows = async (req, res) => {
  const { table } = req.params;
  const limit = parseInt(req.query.limit) || 1000;
  
  try {
    const pks = await getPrimaryKeys(pool1, table);
    const orderBy = pks.length > 0 ? `ORDER BY ${pks.map(pk => `\`${pk}\``).join(', ')}` : '';
    
    const [rows1] = await pool1.query(`SELECT * FROM \`${table}\` ${orderBy} LIMIT ?`, [limit]);
    const [rows2] = await pool2.query(`SELECT * FROM \`${table}\` ${orderBy} LIMIT ?`, [limit]);
    
    const makeKey = (row) => {
      if (pks.length > 0) {
        return pks.map(pk => JSON.stringify(row[pk])).join('|');
      }
      return JSON.stringify(row);
    };
    
    const map1 = new Map(rows1.map(row => [makeKey(row), row]));
    const map2 = new Map(rows2.map(row => [makeKey(row), row]));
    
    const onlyInDb1 = [];
    const onlyInDb2 = [];
    const different = [];
    let matching = 0;
    
    for (const [key, row1] of map1) {
      if (!map2.has(key)) {
        onlyInDb1.push(row1);
      } else {
        const row2 = map2.get(key);
        const diffs = [];
        
        for (const col of Object.keys(row1)) {
          const v1 = normalizeValue(row1[col]);
          const v2 = normalizeValue(row2[col]);
          if (v1 !== v2) {
            diffs.push({ column: col, db1: row1[col], db2: row2[col] });
          }
        }
        
        if (diffs.length > 0) {
          different.push({ key: pks.length > 0 ? Object.fromEntries(pks.map(pk => [pk, row1[pk]])) : key, differences: diffs });
        } else {
          matching++;
        }
      }
    }
    
    for (const [key, row2] of map2) {
      if (!map1.has(key)) {
        onlyInDb2.push(row2);
      }
    }
    
    res.json({
      table,
      primaryKeys: pks,
      limit,
      db1Rows: rows1.length,
      db2Rows: rows2.length,
      matching,
      onlyInDb1: onlyInDb1.slice(0, 50),
      onlyInDb2: onlyInDb2.slice(0, 50),
      different: different.slice(0, 50),
      onlyInDb1Count: onlyInDb1.length,
      onlyInDb2Count: onlyInDb2.length,
      differentCount: different.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const compareRowTable = async (req, res) => {
  const { table } = req.params;
  const limit = parseInt(req.query.limit) || 100;
  const base = req.query.base || 'db1'; 
  
  try {
    const [cols1] = await pool1.query(`DESCRIBE \`${table}\``).catch(() => [[]]);
    const [cols2] = await pool2.query(`DESCRIBE \`${table}\``).catch(() => [[]]);
    
    const colNames1 = new Set(cols1.map(c => c.Field));
    const colNames2 = new Set(cols2.map(c => c.Field));
    const allColumns = [...new Set([...colNames1, ...colNames2])];
    
    const columns = allColumns.map(col => ({
      name: col,
      inDb1: colNames1.has(col),
      inDb2: colNames2.has(col),
      status: colNames1.has(col) && colNames2.has(col) ? 'both' : 
              colNames1.has(col) ? 'db1-only' : 'db2-only'
    }));
    
    const pks = await getPrimaryKeys(base === 'db1' ? pool1 : pool2, table);
    const orderBy = pks.length > 0 ? `ORDER BY ${pks.map(pk => `\`${pk}\``).join(', ')}` : '';
    
    const [rows1] = await pool1.query(`SELECT * FROM \`${table}\` ${orderBy} LIMIT ?`, [limit]);
    const [rows2] = await pool2.query(`SELECT * FROM \`${table}\` ${orderBy} LIMIT ?`, [limit]);
    
    const baseRows = base === 'db1' ? rows1 : rows2;
    const compareRows = base === 'db1' ? rows2 : rows1;
    
    const makeKey = (row) => {
      if (pks.length > 0) {
        return pks.map(pk => JSON.stringify(row[pk])).join('|');
      }
      return JSON.stringify(row);
    };
    
    const compareMap = new Map(compareRows.map(row => [makeKey(row), row]));
    const baseKeys = new Set(baseRows.map(makeKey));
    
    const result = [];
    
    for (const baseRow of baseRows) {
      const key = makeKey(baseRow);
      const compareRow = compareMap.get(key);
      
      if (!compareRow) {
        result.push({
          key,
          status: 'missing',
          baseRow,
          compareRow: null,
          diffColumns: []
        });
      } else {
        const diffColumns = [];
        for (const col of allColumns) {
          if (colNames1.has(col) && colNames2.has(col)) {
            const v1 = normalizeValue(baseRow[col]);
            const v2 = normalizeValue(compareRow[col]);
            if (v1 !== v2) {
              diffColumns.push(col);
            }
          }
        }
        
        result.push({
          key,
          status: diffColumns.length > 0 ? 'different' : 'match',
          baseRow,
          compareRow,
          diffColumns
        });
      }
    }
    
    const extraRows = [];
    for (const compareRow of compareRows) {
      const key = makeKey(compareRow);
      if (!baseKeys.has(key)) {
        extraRows.push({
          key,
          status: 'extra',
          baseRow: null,
          compareRow,
          diffColumns: []
        });
      }
    }
    
    res.json({
      table,
      base,
      primaryKeys: pks,
      columns,
      rows: result,
      extraRows,
      summary: {
        baseTotal: baseRows.length,
        compareTotal: compareRows.length,
        matching: result.filter(r => r.status === 'match').length,
        different: result.filter(r => r.status === 'different').length,
        missingInCompare: result.filter(r => r.status === 'missing').length,
        extraInCompare: extraRows.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
