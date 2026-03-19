import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Database configurations from .env
const db1Config = {
  host: process.env.DB1_HOST || 'localhost',
  port: parseInt(process.env.DB1_PORT || '3306'),
  user: process.env.DB1_USER || 'root',
  password: process.env.DB1_PASSWORD || '',
  database: process.env.DB1_DATABASE || 'database1',
  alias: process.env.DB1_ALIAS || null
};

const db2Config = {
  host: process.env.DB2_HOST || 'localhost',
  port: parseInt(process.env.DB2_PORT || '3306'),
  user: process.env.DB2_USER || 'root',
  password: process.env.DB2_PASSWORD || '',
  database: process.env.DB2_DATABASE || 'database2',
  alias: process.env.DB2_ALIAS || null
};

// Magic API DB config (for extracting table names from API endpoints)
const magicApiDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'cbs_report'
};

// Connection pools
let pool1 = null;
let pool2 = null;
let magicApiPool = null;

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

// Initialize pools
function initPools() {
  pool1 = createPool(db1Config);
  pool2 = createPool(db2Config);
  magicApiPool = createPool(magicApiDbConfig);
}

// API Routes

// Get connection info
app.get('/api/connections', (req, res) => {
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
});

// Test connections
app.get('/api/test-connection', async (req, res) => {
  try {
    initPools();
    await pool1.query('SELECT 1');
    await pool2.query('SELECT 1');
    res.json({ success: true, message: 'Both databases connected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all tables from both databases
app.get('/api/tables', async (req, res) => {
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
});

// Get schema status overview for all tables
app.get('/api/schemas-overview', async (req, res) => {
  try {
    const [rows1] = await pool1.query('SHOW TABLES');
    const [rows2] = await pool2.query('SHOW TABLES');
    
    const tables1 = rows1.map(row => Object.values(row)[0]);
    const tables2 = rows2.map(row => Object.values(row)[0]);
    
    const set1 = new Set(tables1);
    const set2 = new Set(tables2);
    const allTables = [...new Set([...tables1, ...tables2])].sort();
    
    const results = [];
    
    for (const table of allTables) {
      const inDb1 = set1.has(table);
      const inDb2 = set2.has(table);
      
      if (!inDb1 || !inDb2) {
        // Table missing from one server
        results.push({
          table,
          status: 'missing',
          inDb1,
          inDb2
        });
        continue;
      }
      
      // Table exists in both - check schema
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
          // Check for structural differences
          if (c1.Type !== c2.Type || c1.Null !== c2.Null || c1.Key !== c2.Key || 
              String(c1.Default) !== String(c2.Default) || c1.Extra !== c2.Extra) {
            hasDifferentStructure = true;
          }
        }
      }
      
      let status = 'match';
      if (hasMissingColumn) status = 'missing-column';
      else if (hasDifferentStructure) status = 'different';
      
      results.push({
        table,
        status,
        inDb1: true,
        inDb2: true
      });
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
});

// Compare schema for a specific table
app.get('/api/schema/:table', async (req, res) => {
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
      
      if (!c1) {
        return { column: col, status: 'db2-only', db1: null, db2: c2 };
      }
      if (!c2) {
        return { column: col, status: 'db1-only', db1: c1, db2: null };
      }
      
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
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compare row counts for all tables
app.get('/api/row-counts', async (req, res) => {
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
});

// Get primary keys for a table
async function getPrimaryKeys(pool, table) {
  const [cols] = await pool.query(`DESCRIBE \`${table}\``);
  return cols.filter(c => c.Key === 'PRI').map(c => c.Field);
}

// Compare primary keys for a table
app.get('/api/pk-compare/:table', async (req, res) => {
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
});

// Full row comparison for a table
app.get('/api/row-compare/:table', async (req, res) => {
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
});

// Table-style row comparison (new endpoint)
app.get('/api/row-table/:table', async (req, res) => {
  const { table } = req.params;
  const limit = parseInt(req.query.limit) || 100;
  const base = req.query.base || 'db1'; // which db is the base
  
  try {
    // Get schema from both
    const [cols1] = await pool1.query(`DESCRIBE \`${table}\``).catch(() => [[]]);
    const [cols2] = await pool2.query(`DESCRIBE \`${table}\``).catch(() => [[]]);
    
    const colNames1 = new Set(cols1.map(c => c.Field));
    const colNames2 = new Set(cols2.map(c => c.Field));
    const allColumns = [...new Set([...colNames1, ...colNames2])];
    
    // Column status
    const columns = allColumns.map(col => ({
      name: col,
      inDb1: colNames1.has(col),
      inDb2: colNames2.has(col),
      status: colNames1.has(col) && colNames2.has(col) ? 'both' : 
              colNames1.has(col) ? 'db1-only' : 'db2-only'
    }));
    
    // Get primary keys
    const pks = await getPrimaryKeys(base === 'db1' ? pool1 : pool2, table);
    const orderBy = pks.length > 0 ? `ORDER BY ${pks.map(pk => `\`${pk}\``).join(', ')}` : '';
    
    // Get rows from both
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
    
    // Build comparison result for each base row
    const result = [];
    
    for (const baseRow of baseRows) {
      const key = makeKey(baseRow);
      const compareRow = compareMap.get(key);
      
      if (!compareRow) {
        // Row only in base
        result.push({
          key,
          status: 'missing',
          baseRow,
          compareRow: null,
          diffColumns: []
        });
      } else {
        // Row exists in both - check differences
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
    
    // Find rows only in compare DB (not in base)
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
});

function normalizeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (val instanceof Date) return val.toISOString();
  if (Buffer.isBuffer(val)) return val.toString('hex');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// Compare indexes for a table
app.get('/api/indexes/:table', async (req, res) => {
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
});

// Extract table names from SQL content
function extractTableNames(sqlContent) {
  const tables = new Set();
  if (!sqlContent) return tables;
  
  // Remove SQL comments
  let content = sqlContent.replace(/--.*$/gm, '');
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  content = content.replace(/^\s*(purpose|description|note|comment)\s*:.*$/gim, '');
  content = content.replace(/\s+/g, ' ');
  
  const patterns = [
    /\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bLEFT\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bRIGHT\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bINNER\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bOUTER\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bCROSS\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
  ];
  
  const skipWords = ['select', 'where', 'set', 'values', 'dual', 'null', 'the', 'sre', 'a', 'an', 'this', 'that'];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let tableName = match[1];
      if (tableName.endsWith(')')) continue;
      if (skipWords.includes(tableName.toLowerCase())) continue;
      if (!tableName.includes('.') && tableName.length < 3) continue;
      tables.add(tableName);
    }
  }
  
  return tables;
}

// Get API tables and check existence in selected DB
app.get('/api/api-tables', async (req, res) => {
  const { connection } = req.query; // 'db1' or 'db2'
  const pool = connection === 'db2' ? pool2 : pool1;
  
  try {
    // Get all table names from Magic API endpoints
    const [rows] = await magicApiPool.query(`
      SELECT
        A1.file_path,
        SUBSTRING_INDEX(A1.file_content, '================================', -1) AS file_content
      FROM cbs_report.magic_api_file_sg A1
      WHERE A1.file_path LIKE '/magic-api/api/mou/%'
    `);
    
    // Extract all unique tables
    const allTables = new Set();
    for (const row of rows) {
      const tables = extractTableNames(row.file_content);
      tables.forEach(t => allTables.add(t));
    }
    
    // Get list of all tables in the selected DB connection (across all schemas)
    const [dbTables] = await pool.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    
    // Create a set of existing tables in format "schema.table"
    const existingTables = new Set();
    for (const t of dbTables) {
      existingTables.add(`${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
      existingTables.add(t.TABLE_NAME); // Also add without schema for matching
    }
    
    // Check each API table for existence
    const results = [];
    for (const table of [...allTables].sort()) {
      let exists = false;
      
      if (table.includes('.')) {
        // Has schema prefix - check exact match
        exists = existingTables.has(table);
      } else {
        // No schema prefix - check if table name exists in any schema
        exists = existingTables.has(table);
      }
      
      results.push({
        table,
        exists
      });
    }
    
    // Group by database prefix
    const byDatabase = {};
    for (const r of results) {
      let db = '(no prefix)';
      let tableName = r.table;
      if (r.table.includes('.')) {
        [db, tableName] = r.table.split('.');
      }
      if (!byDatabase[db]) byDatabase[db] = [];
      byDatabase[db].push({ table: tableName, fullName: r.table, exists: r.exists });
    }
    
    res.json({
      connection: connection === 'db2' ? 'db2' : 'db1',
      connectionAlias: connection === 'db2' ? db2Config.alias : db1Config.alias,
      total: results.length,
      existing: results.filter(r => r.exists).length,
      missing: results.filter(r => !r.exists).length,
      tables: results,
      byDatabase
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get endpoints that use a specific table
app.get('/api/api-tables/endpoints/:table', async (req, res) => {
  const { table } = req.params;
  
  try {
    const [rows] = await magicApiPool.query(`
      SELECT
        A1.file_path,
        SUBSTRING_INDEX(A1.file_content, '================================', -1) AS file_content
      FROM cbs_report.magic_api_file_sg A1
      WHERE A1.file_path LIKE '/magic-api/api/mou/%'
    `);
    
    // Find endpoints that use this table
    const endpoints = [];
    for (const row of rows) {
      const tables = extractTableNames(row.file_content);
      if (tables.has(table)) {
        endpoints.push({
          filePath: row.file_path,
          fileContent: row.file_content
        });
      }
    }
    
    res.json({
      table,
      endpointCount: endpoints.length,
      endpoints
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all endpoints with their table status (which endpoints use non-existent tables)
app.get('/api/api-endpoints', async (req, res) => {
  const { connection } = req.query; // 'db1' or 'db2'
  const pool = connection === 'db2' ? pool2 : pool1;
  
  try {
    // Get all Magic API endpoints
    const [rows] = await magicApiPool.query(`
      SELECT
        A1.file_path,
        SUBSTRING_INDEX(A1.file_content, '================================', -1) AS file_content
      FROM cbs_report.magic_api_file_sg A1
      WHERE A1.file_path LIKE '/magic-api/api/mou/%'
    `);
    
    // Get list of all tables in the selected DB connection
    const [dbTables] = await pool.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    
    // Create a set of existing tables
    const existingTables = new Set();
    for (const t of dbTables) {
      existingTables.add(`${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
      existingTables.add(t.TABLE_NAME);
    }
    
    // Check each endpoint
    const endpoints = [];
    for (const row of rows) {
      const tables = extractTableNames(row.file_content);
      const tablesArray = [...tables];
      
      // Check which tables exist and which don't
      const existingTablesInEndpoint = [];
      const missingTablesInEndpoint = [];
      
      for (const table of tablesArray) {
        const exists = table.includes('.') 
          ? existingTables.has(table) 
          : existingTables.has(table);
        
        if (exists) {
          existingTablesInEndpoint.push(table);
        } else {
          missingTablesInEndpoint.push(table);
        }
      }
      
      endpoints.push({
        filePath: row.file_path,
        fileName: row.file_path.split('/').pop(),
        fileContent: row.file_content,
        totalTables: tablesArray.length,
        existingTables: existingTablesInEndpoint,
        missingTables: missingTablesInEndpoint,
        status: missingTablesInEndpoint.length === 0 ? 'ok' : 'has-missing'
      });
    }
    
    // Sort: endpoints with missing tables first
    endpoints.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'has-missing' ? -1 : 1;
      return a.fileName.localeCompare(b.fileName);
    });
    
    res.json({
      connection: connection === 'db2' ? 'db2' : 'db1',
      connectionAlias: connection === 'db2' ? db2Config.alias : db1Config.alias,
      total: endpoints.length,
      ok: endpoints.filter(e => e.status === 'ok').length,
      hasMissing: endpoints.filter(e => e.status === 'has-missing').length,
      endpoints
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Flow Table Generator Endpoints ───────────────────────────────────────────

// List all tables from a single DB (db1 or db2)
app.get('/api/flow/tables', async (req, res) => {
  const { db } = req.query;
  const pool = db === 'db2' ? pool2 : pool1;
  try {
    const [rows] = await pool.query('SHOW TABLES');
    const tables = rows.map(row => Object.values(row)[0]).sort();
    res.json({ db: db || 'db1', tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get column info + primary keys for a single table from a single DB
app.get('/api/flow/columns', async (req, res) => {
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
});

// ──────────────────────────────────────────────────────────────────────────────

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

initPools();
app.listen(PORT, () => {
  console.log(`\n🔍 DB Differentiator running at http://localhost:${PORT}\n`);
});
