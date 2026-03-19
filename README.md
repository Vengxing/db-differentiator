# 🔍 Database Differentiator

A powerful CLI tool to compare two MySQL/MariaDB databases and identify differences in tables, schemas, and row data.

**Supported Databases:**
- MySQL 5.6+
- MariaDB 10.6+

## Features

- **📋 Table Comparison** - Find missing tables between databases
- **🔧 Schema Comparison** - Compare column structures (types, nullability, keys, defaults)
- **🔢 Row Count Comparison** - Quick check of row counts per table
- **🔑 Primary Key Comparison** - Find missing/extra rows by primary key
- **📝 Full Row Comparison** - Deep comparison of actual row content
- **📊 Index Comparison** - Compare indexes between tables
- **🎯 Selective Comparison** - Compare specific tables with custom options

## Installation

```bash
cd "DB Differentiator"
npm install
```

## Configuration

Edit the `.env` file with your database connections:

```env
# Database 1 (Source)
DB1_HOST=localhost
DB1_PORT=3306
DB1_USER=root
DB1_PASSWORD=your_password
DB1_DATABASE=database1

# Database 2 (Target)
DB2_HOST=localhost
DB2_PORT=3306
DB2_USER=root
DB2_PASSWORD=your_password
DB2_DATABASE=database2
```

## Usage

```bash
npm start
```

This opens an interactive menu where you can:

1. **Compare All Tables** - Check which tables exist in one DB but not the other
2. **Compare Table Schemas** - Find column differences (names, types, constraints)
3. **Compare Row Counts** - Quick count comparison
4. **Compare Primary Keys** - Find rows that exist in one DB but not the other
5. **Compare Full Row Content** - Deep content comparison (can be slow for large tables)
6. **Compare Indexes** - Find index differences
7. **Full Comparison** - Run all checks at once
8. **Compare Specific Tables** - Select specific tables and what to compare

## Output Legend

| Symbol | Meaning |
|--------|---------|
| ✓ (green) | Match / OK |
| ✗ (red) | Missing / Different |
| ⚠ (yellow) | Warning / Difference found |
| DB1 (cyan) | Source database |
| DB2 (magenta) | Target database |

## Comparison Modes

### Row Count Only (Fast)
Just compares the number of rows in each table. Good for a quick sanity check.

### Primary Key Comparison (Medium)
Compares which primary key values exist in each table. Finds:
- Rows only in DB1
- Rows only in DB2
- Rows in both (by PK, not content)

### Full Row Comparison (Thorough)
Compares actual row content field by field. Finds:
- Rows only in DB1
- Rows only in DB2  
- Rows with different values

**Note:** This can be slow for large tables. Use the row limit option for performance.

## Example Output

```
╔══════════════════════════════════════════════════════════════╗
║          🔍 DATABASE DIFFERENTIATOR                          ║
║          MySQL 5.6 / MariaDB 10.6 Comparison Tool            ║
╚══════════════════════════════════════════════════════════════╝

📊 Database Connections:

┌──────────┬─────────────────┬─────────────────┐
│          │ DB1 (Source)    │ DB2 (Target)    │
├──────────┼─────────────────┼─────────────────┤
│ Host     │ localhost       │ 192.168.1.100   │
│ Port     │ 3306            │ 3306            │
│ Database │ production      │ staging         │
│ User     │ root            │ root            │
└──────────┴─────────────────┴─────────────────┘

📋 TABLE COMPARISON
────────────────────────────────────────────────────────────────

Summary:
  • Tables in both: 15
  • Only in production: 2
  • Only in staging: 0

  ✗ Missing in staging:
    - audit_logs
    - user_sessions

  ✓ users: Schema matches (8 columns)
  ✓ orders: Schema matches (12 columns)
  
🔢 ROW COUNT COMPARISON
────────────────────────────────────────────────────────────────

┌────────────────┬──────────┬──────────┬──────────┬────────┐
│ Table          │ DB1      │ DB2      │ Diff     │ Status │
├────────────────┼──────────┼──────────┼──────────┼────────┤
│ users          │ 1,234    │ 1,234    │ 0        │ ✓      │
│ orders         │ 5,678    │ 5,432    │ +246     │ ✗      │
└────────────────┴──────────┴──────────┴──────────┴────────┘
```

## Tips

1. **Start with row counts** - Quick way to identify tables with differences
2. **Use PK comparison** - Faster than full row comparison, identifies missing rows
3. **Limit rows for large tables** - Use the row limit option for tables with millions of rows
4. **Compare specific tables** - When you know which tables to focus on

## License

MIT
