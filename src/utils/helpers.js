export function normalizeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (val instanceof Date) return val.toISOString();
  if (Buffer.isBuffer(val)) return val.toString('hex');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export async function getPrimaryKeys(pool, table) {
  const [cols] = await pool.query(`DESCRIBE \`${table}\``);
  return cols.filter(c => c.Key === 'PRI').map(c => c.Field);
}

export function extractTableNames(sqlContent) {
  const tables = new Set();
  if (!sqlContent) return tables;
  
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
