import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool for Magic API DB
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 5
});

/**
 * Extract table names from SQL content
 * Looks for tables after FROM and JOIN keywords
 * Excludes subqueries like "FROM (" or "JOIN (" or tables ending with ")"
 */
function extractTableNames(sqlContent) {
  const tables = new Set();
  
  if (!sqlContent) return tables;
  
  // Remove SQL single-line comments (-- ...)
  let content = sqlContent.replace(/--.*$/gm, '');
  
  // Remove SQL multi-line comments (/* ... */)
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove description/purpose comments (lines starting with purpose:, description:, etc.)
  content = content.replace(/^\s*(purpose|description|note|comment)\s*:.*$/gim, '');
  
  // Normalize whitespace
  content = content.replace(/\s+/g, ' ');
  
  // Regex patterns for FROM and JOIN followed by table names
  // Table name pattern: optional_db.table_name or just table_name
  // Excludes opening parenthesis (subqueries) and captures table names
  const patterns = [
    /\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bLEFT\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bRIGHT\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bINNER\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bOUTER\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
    /\bCROSS\s+JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?!\s*\()/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let tableName = match[1];
      
      // Skip if table name ends with ) - it's likely from a subquery result
      if (tableName.endsWith(')')) continue;
      
      // Skip common SQL keywords and false positives
      const skipWords = ['select', 'where', 'set', 'values', 'dual', 'null', 'the', 'sre', 'a', 'an', 'this', 'that'];
      if (skipWords.includes(tableName.toLowerCase())) continue;
      
      // Skip if it doesn't look like a table name (too short without a prefix)
      if (!tableName.includes('.') && tableName.length < 3) continue;
      
      tables.add(tableName);
    }
  }
  
  return tables;
}

async function main() {
  console.log('🔍 Extracting table names from Magic API endpoints...\n');
  
  try {
    // Test connection
    const connection = await pool.getConnection();
    console.log(`✅ Connected to ${process.env.DB_DATABASE}@${process.env.DB_HOST}\n`);
    connection.release();
    
    // Run the query
    const [rows] = await pool.query(`
      SELECT
        A1.file_path,
        SUBSTRING_INDEX(A1.file_content, '================================', -1) AS file_content
      FROM
        cbs_report.magic_api_file_sg A1
      WHERE A1.file_path LIKE '/magic-api/api/mou/%'
    `);
    
    console.log(`📄 Found ${rows.length} API endpoint files\n`);
    console.log('='.repeat(80));
    
    // Store all unique tables across all files
    const allTables = new Set();
    const tablesByFile = [];
    
    for (const row of rows) {
      const tables = extractTableNames(row.file_content);
      
      if (tables.size > 0) {
        tablesByFile.push({
          filePath: row.file_path,
          tables: [...tables].sort()
        });
        
        // Add to global set
        tables.forEach(t => allTables.add(t));
      }
    }
    
    // Print tables by file
    for (const file of tablesByFile) {
      console.log(`\n📁 ${file.filePath}`);
      console.log(`   Tables (${file.tables.length}):`);
      for (const table of file.tables) {
        console.log(`     - ${table}`);
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 SUMMARY`);
    console.log(`   Total files processed: ${rows.length}`);
    console.log(`   Files with tables: ${tablesByFile.length}`);
    console.log(`   Unique tables found: ${allTables.size}`);
    
    // Print all unique tables sorted
    console.log(`\n📋 ALL UNIQUE TABLES (${allTables.size}):`);
    const sortedTables = [...allTables].sort();
    for (const table of sortedTables) {
      console.log(`   - ${table}`);
    }
    
    // Group tables by database prefix
    const byDatabase = {};
    for (const table of sortedTables) {
      if (table.includes('.')) {
        const [db, tbl] = table.split('.');
        if (!byDatabase[db]) byDatabase[db] = [];
        byDatabase[db].push(tbl);
      } else {
        if (!byDatabase['(no prefix)']) byDatabase['(no prefix)'] = [];
        byDatabase['(no prefix)'].push(table);
      }
    }
    
    console.log(`\n📂 TABLES BY DATABASE:`);
    for (const [db, tables] of Object.entries(byDatabase).sort()) {
      console.log(`\n   ${db} (${tables.length} tables):`);
      for (const table of tables.sort()) {
        console.log(`     - ${table}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
