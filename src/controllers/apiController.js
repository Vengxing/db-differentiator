import { db1Config, db2Config, pool1, pool2, magicApiPool } from '../config/db.js';
import { extractTableNames } from '../utils/helpers.js';

export const getApiTables = async (req, res) => {
  try {
    const [rows] = await magicApiPool.query(`
      SELECT
        A1.file_path,
        SUBSTRING_INDEX(A1.file_content, '================================', -1) AS file_content
      FROM cbs_report.magic_api_file_sg A1
      WHERE A1.file_path LIKE '/magic-api/api/mou/%'
    `);
    
    // Count occurrences of each table in the API files
    const tableCounts = {};
    for (const row of rows) {
      const tablesInFile = extractTableNames(row.file_content); // Returns Set of tables
      for (const t of tablesInFile) {
        // Handle both "schema.table" and "table" formats
        const tableName = t.includes('.') ? t.split('.')[1] : t;
        tableCounts[tableName] = (tableCounts[tableName] || 0) + 1;
        // Optionally track the full name if it has schema
        if (t.includes('.')) {
            tableCounts[t] = (tableCounts[t] || 0) + 1;
        }
      }
    }
    
    const [db1Tables] = await pool1.query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`, [db1Config.database]);
    const db1Res = db1Tables.map(t => {
      const name = t.TABLE_NAME;
      const apiCount = tableCounts[name] || 0;
      return { name, inApi: apiCount > 0, apiCount };
    });
    
    const [db2Tables] = await pool2.query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`, [db2Config.database]);
    const db2Res = db2Tables.map(t => {
      const name = t.TABLE_NAME;
      const apiCount = tableCounts[name] || 0;
      return { name, inApi: apiCount > 0, apiCount };
    });
    
    // Sort so tables in API show up first, then alphabetically
    const sortFn = (a, b) => {
        if (a.inApi && !b.inApi) return -1;
        if (!a.inApi && b.inApi) return 1;
        if (a.apiCount !== b.apiCount) return b.apiCount - a.apiCount;
        return a.name.localeCompare(b.name);
    };
    
    res.json({
      db1: db1Res.sort(sortFn),
      db2: db2Res.sort(sortFn)
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getApiEndpointsByTable = async (req, res) => {
  const { table } = req.params;
  
  try {
    const [rows] = await magicApiPool.query(`
      SELECT
        A1.file_path,
        SUBSTRING_INDEX(A1.file_content, '================================', -1) AS file_content
      FROM cbs_report.magic_api_file_sg A1
      WHERE A1.file_path LIKE '/magic-api/api/mou/%'
    `);
    
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
};

export const getApiEndpoints = async (req, res) => {
  const { connection } = req.query; // 'db1' or 'db2'
  const pool = connection === 'db2' ? pool2 : pool1;
  
  try {
    const [rows] = await magicApiPool.query(`
      SELECT
        A1.file_path,
        SUBSTRING_INDEX(A1.file_content, '================================', -1) AS file_content
      FROM cbs_report.magic_api_file_sg A1
      WHERE A1.file_path LIKE '/magic-api/api/mou/%'
    `);
    
    const [dbTables] = await pool.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    
    const existingTables = new Set();
    for (const t of dbTables) {
      existingTables.add(`${t.TABLE_SCHEMA}.${t.TABLE_NAME}`);
      existingTables.add(t.TABLE_NAME);
    }
    
    const endpoints = [];
    for (const row of rows) {
      const tables = extractTableNames(row.file_content);
      const tablesArray = [...tables];
      
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
};
