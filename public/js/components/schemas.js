// Schema overview data cache
let schemasOverviewData = null;
let currentSchemaFilter = 'all';
let currentSchemaSort = 'alpha'; // 'alpha' | 'modified'
let currentSchemaView = 'merged'; // 'merged' | 'split'
let schemaExcludeKeywords = '_bk, _copy, 260, _bu, _backup, not_used';

// Called from input field oninput — updates state and re-renders without refetching
window.applySchemaExclude = async function (value) {
  schemaExcludeKeywords = value;
  // Save cursor position before the full re-render wipes the input
  const input = document.getElementById('schema-exclude-input');
  const cursorPos = input ? input.selectionStart : null;
  await loadSchemas(currentSchemaFilter);
  // Restore focus and cursor to the recreated input
  const newInput = document.getElementById('schema-exclude-input');
  if (newInput) {
    newInput.focus();
    if (cursorPos !== null) newInput.setSelectionRange(cursorPos, cursorPos);
  }
};

async function loadSchemas(filter = 'all') {
  currentSchemaFilter = filter;
  const content = document.getElementById('tab-content');

  // Load schema overview if not cached
  if (!schemasOverviewData) {
    content.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="text-gray-400 mt-2">Analyzing schemas for all tables...</p></div>';
    try {
      const res = await fetch('/api/schemas-overview');
      schemasOverviewData = await res.json();
    } catch (e) {
      content.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
      return;
    }
  }

  const data = schemasOverviewData;

  // Filter tables based on selection
  let filteredTables = data.tables;
  if (filter === 'match') filteredTables = data.tables.filter(t => t.status === 'match');
  else if (filter === 'different') filteredTables = data.tables.filter(t => t.status === 'different');
  else if (filter === 'missing-column') filteredTables = data.tables.filter(t => t.status === 'missing-column');
  else if (filter === 'missing') filteredTables = data.tables.filter(t => t.status === 'missing');

  // Apply keyword exclusion filter
  const excludeKeywords = schemaExcludeKeywords
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0);
  const excludedCount = excludeKeywords.length > 0
    ? filteredTables.filter(t => excludeKeywords.some(k => t.table.toLowerCase().includes(k))).length
    : 0;
  if (excludeKeywords.length > 0) {
    filteredTables = filteredTables.filter(t => !excludeKeywords.some(k => t.table.toLowerCase().includes(k)));
  }

  // Sort tables
  filteredTables = [...filteredTables]; // avoid mutating cached data
  if (currentSchemaSort === 'modified') {
    filteredTables.sort((a, b) => {
      const ta = a.createTime ? new Date(a.createTime).getTime() : 0;
      const tb = b.createTime ? new Date(b.createTime).getTime() : 0;
      return tb - ta; // newest first
    });
  } else {
    filteredTables.sort((a, b) => a.table.localeCompare(b.table));
  }

  let html = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">🔧 Schema Comparison</h2>
      <button onclick="schemasOverviewData = null; loadSchemas(currentSchemaFilter)" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1">
        <span>🔄</span> Refresh
      </button>
    </div>
    
    <!-- Legend -->
    <div class="flex flex-wrap gap-4 mb-4 text-sm">
      <div class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-green-600"></span> All columns match</div>
      <div class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-yellow-600"></span> Structure differences</div>
      <div class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-red-600"></span> Missing column(s)</div>
      <div class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-gray-900 border border-gray-600"></span> Table missing</div>
    </div>
    
    <!-- Summary Cards (Clickable Filters) -->
    <div class="grid grid-cols-5 gap-3 mb-4">
      <div onclick="loadSchemas('all')" class="cursor-pointer bg-gray-700 rounded p-3 text-center transition hover:bg-gray-600 ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}">
        <div class="text-xl font-bold text-white">${data.summary.total}</div>
        <div class="text-xs text-gray-400">All Tables</div>
      </div>
      <div onclick="loadSchemas('match')" class="cursor-pointer bg-green-900/40 rounded p-3 text-center transition hover:bg-green-900/60 ${filter === 'match' ? 'ring-2 ring-green-500' : ''}">
        <div class="text-xl font-bold text-green-400">${data.summary.matching}</div>
        <div class="text-xs text-gray-400">✓ Matching</div>
      </div>
      <div onclick="loadSchemas('different')" class="cursor-pointer bg-yellow-900/40 rounded p-3 text-center transition hover:bg-yellow-900/60 ${filter === 'different' ? 'ring-2 ring-yellow-500' : ''}">
        <div class="text-xl font-bold text-yellow-400">${data.summary.different}</div>
        <div class="text-xs text-gray-400">⚠ Different</div>
      </div>
      <div onclick="loadSchemas('missing-column')" class="cursor-pointer bg-red-900/40 rounded p-3 text-center transition hover:bg-red-900/60 ${filter === 'missing-column' ? 'ring-2 ring-red-500' : ''}">
        <div class="text-xl font-bold text-red-400">${data.summary.missingColumn}</div>
        <div class="text-xs text-gray-400">✗ Missing Column</div>
      </div>
      <div onclick="loadSchemas('missing')" class="cursor-pointer bg-gray-900/80 rounded p-3 text-center transition hover:bg-gray-900 border border-gray-700 ${filter === 'missing' ? 'ring-2 ring-gray-400' : ''}">
        <div class="text-xl font-bold text-gray-400">${data.summary.missingTable}</div>
        <div class="text-xs text-gray-400">Table Missing</div>
      </div>
    </div>

    <!-- Sort + View toggles -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500">Sort by:</span>
        <button onclick="currentSchemaSort = 'alpha'; loadSchemas(currentSchemaFilter)"
          class="px-3 py-1 rounded text-xs font-medium transition ${currentSchemaSort === 'alpha' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}">
          🔤 Alphabetical
        </button>
        <button onclick="currentSchemaSort = 'modified'; loadSchemas(currentSchemaFilter)"
          class="px-3 py-1 rounded text-xs font-medium transition ${currentSchemaSort === 'modified' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}">
          🕒 Last Modified
        </button>
      </div>
      <div class="w-px h-4 bg-gray-600"></div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500">View:</span>
        <button onclick="currentSchemaView = 'merged'; loadSchemas(currentSchemaFilter)"
          class="px-3 py-1 rounded text-xs font-medium transition ${currentSchemaView === 'merged' ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}">
          🔀 Merged
        </button>
        <button onclick="currentSchemaView = 'split'; loadSchemas(currentSchemaFilter)"
          class="px-3 py-1 rounded text-xs font-medium transition ${currentSchemaView === 'split' ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}">
          📊 Split by DB
        </button>
      </div>
    </div>

    <!-- Exclude keywords -->
    <div class="flex items-center gap-3 mb-4 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
      <span class="text-xs text-gray-400 whitespace-nowrap">🚫 Exclude tables containing:</span>
      <input
        id="schema-exclude-input"
        type="text"
        value="${schemaExcludeKeywords.replace(/"/g, '&quot;')}"
        placeholder="e.g. _bk, backup, copy"
        oninput="window.applySchemaExclude(this.value)"
        class="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
      />
      ${excludedCount > 0
      ? `<span class="text-xs bg-orange-900/60 border border-orange-700/50 text-orange-300 px-2 py-0.5 rounded whitespace-nowrap">${excludedCount} hidden</span>`
      : `<span class="text-xs text-gray-600">none hidden</span>`
    }
      <button onclick="schemaExcludeKeywords = ''; document.getElementById('schema-exclude-input').value = ''; loadSchemas(currentSchemaFilter)"
        class="text-xs text-gray-500 hover:text-gray-300 transition whitespace-nowrap">
        Clear
      </button>
    </div>
    
    <p class="text-gray-400 mb-4">Click a table to view detailed schema comparison:</p>
  `;

  // Helper to render a table button
  const renderTableBtn = (table, ctKey = 'createTime') => {
    let btnClass = '';
    let title = '';
    switch (table.status) {
      case 'match':
        btnClass = 'bg-green-700 hover:bg-green-600 text-white';
        title = 'All columns match';
        break;
      case 'different':
        btnClass = 'bg-yellow-700 hover:bg-yellow-600 text-white';
        title = 'Structure differences (type, nullable, etc.)';
        break;
      case 'missing-column':
        btnClass = 'bg-red-700 hover:bg-red-600 text-white';
        title = 'Has missing column(s)';
        break;
      case 'missing':
        btnClass = 'bg-gray-900 hover:bg-gray-800 text-gray-400 border border-gray-600';
        title = table.inDb1 ? `Missing in ${db2Name}` : `Missing in ${db1Name}`;
        break;
    }
    const ct = table[ctKey];
    const modifiedLabel = ct ? `Last modified: ${new Date(ct).toLocaleString()}` : 'No timestamp available';
    return `<button onclick="loadSchemaForTable('${table.table}')" class="schema-btn px-3 py-1 rounded text-sm ${btnClass}" title="${title}&#10;${modifiedLabel}">${table.table}</button>`;
  };

  // Sort helper: sort a list by chosen mode, using a specific createTime key
  const sortList = (list, ctKey = 'createTime') => {
    const copy = [...list];
    if (currentSchemaSort === 'modified') {
      copy.sort((a, b) => {
        const ta = a[ctKey] ? new Date(a[ctKey]).getTime() : 0;
        const tb = b[ctKey] ? new Date(b[ctKey]).getTime() : 0;
        return tb - ta;
      });
    } else {
      copy.sort((a, b) => a.table.localeCompare(b.table));
    }
    return copy;
  };

  if (currentSchemaView === 'split') {
    // ── SPLIT BY DB VIEW ─────────────────────────────────────────────────────
    // DB1 column: all filtered tables that exist in DB1
    const db1Tables = sortList(
      filteredTables.filter(t => t.inDb1),
      'createTime1'
    );
    // DB2 column: all filtered tables that exist in DB2
    const db2Tables = sortList(
      filteredTables.filter(t => t.inDb2),
      'createTime2'
    );

    if (db1Tables.length === 0 && db2Tables.length === 0) {
      html += `<div class="text-gray-500 italic">No tables match this filter</div>`;
    } else {
      html += `<div class="grid grid-cols-2 gap-6">`;

      // DB1 column
      html += `
        <div>
          <h3 class="text-sm font-semibold text-db1 mb-3 flex items-center gap-2">
            📊 ${db1Name}
            <span class="text-gray-500 font-normal">(${db1Tables.length} tables)</span>
          </h3>
          <div class="flex flex-wrap gap-2">
            ${db1Tables.length > 0 ? db1Tables.map(t => renderTableBtn(t, 'createTime1')).join('') : '<span class="text-gray-500 italic text-xs">None</span>'}
          </div>
        </div>
      `;

      // DB2 column
      html += `
        <div>
          <h3 class="text-sm font-semibold text-db2 mb-3 flex items-center gap-2">
            📊 ${db2Name}
            <span class="text-gray-500 font-normal">(${db2Tables.length} tables)</span>
          </h3>
          <div class="flex flex-wrap gap-2">
            ${db2Tables.length > 0 ? db2Tables.map(t => renderTableBtn(t, 'createTime2')).join('') : '<span class="text-gray-500 italic text-xs">None</span>'}
          </div>
        </div>
      `;

      html += `</div>`;
    }

  } else {
    // ── MERGED VIEW (default) ───────────────────────────────────────────────
    const tablesInBoth = sortList(filteredTables.filter(t => t.status !== 'missing'));
    const tablesOnlyInDb1 = sortList(filteredTables.filter(t => t.status === 'missing' && t.inDb1));
    const tablesOnlyInDb2 = sortList(filteredTables.filter(t => t.status === 'missing' && t.inDb2));

    if (tablesInBoth.length > 0) {
      html += `
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
            <span class="text-db1">${db1Name}</span> <span class="text-gray-600">&</span> <span class="text-db2">${db2Name}</span>
            <span class="text-gray-600">(${tablesInBoth.length})</span>
          </h3>
          <div class="flex flex-wrap gap-2">
            ${tablesInBoth.map(t => renderTableBtn(t)).join('')}
          </div>
        </div>
      `;
    }

    if (tablesOnlyInDb1.length > 0) {
      html += `
        <div class="mb-6">
          <h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
            <span class="text-db1">📊 Only in ${db1Name}</span>
            <span class="text-gray-600">(${tablesOnlyInDb1.length} - missing from ${db2Name})</span>
          </h3>
          <div class="flex flex-wrap gap-2">
            ${tablesOnlyInDb1.map(t => renderTableBtn(t)).join('')}
          </div>
        </div>
      `;
    }

    if (tablesOnlyInDb2.length > 0) {
      html += `
        <div class="mb-6">
          <h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
            <span class="text-db2">📊 Only in ${db2Name}</span>
            <span class="text-gray-600">(${tablesOnlyInDb2.length} - missing from ${db1Name})</span>
          </h3>
          <div class="flex flex-wrap gap-2">
            ${tablesOnlyInDb2.map(t => renderTableBtn(t)).join('')}
          </div>
        </div>
      `;
    }

    if (filteredTables.length === 0) {
      html += `<div class="text-gray-500 italic">No tables match this filter</div>`;
    }
  }

  html += `<div id="schema-result"></div>`;
  content.innerHTML = html;
}

// Load schema for specific table
async function loadSchemaForTable(table) {
  const result = document.getElementById('schema-result');
  result.innerHTML = '<div class="loader"></div>';

  // Check if table is missing from one DB
  if (schemasOverviewData) {
    const tableInfo = schemasOverviewData.tables.find(t => t.table === table);
    if (tableInfo && tableInfo.status === 'missing') {
      const missingFrom = tableInfo.inDb1 ? db2Name : db1Name;
      const existsIn = tableInfo.inDb1 ? db1Name : db2Name;
      result.innerHTML = `
        <div class="fade-in bg-gray-900 border border-gray-600 rounded-lg p-6 text-center">
          <div class="text-4xl mb-4">⚫</div>
          <h3 class="text-xl font-semibold mb-2">Table: <span class="text-blue-400">${table}</span></h3>
          <p class="text-gray-400">This table is <span class="text-red-400 font-semibold">missing</span> from <span class="font-semibold">${missingFrom}</span></p>
          <p class="text-gray-500 text-sm mt-2">It only exists in ${existsIn}</p>
        </div>
      `;
      return;
    }
  }

  try {
    const res = await fetch(`/api/schema/${encodeURIComponent(table)}`);
    const data = await res.json();

    let html = `
      <div class="fade-in">
        <h3 class="text-lg font-semibold mb-3">Table: <span class="text-blue-400">${table}</span></h3>
        <div class="grid grid-cols-4 gap-3 mb-4">
          <div class="bg-green-900/30 rounded p-3 text-center">
            <div class="text-xl font-bold text-green-400">${data.summary.matching}</div>
            <div class="text-xs text-gray-400">Matching</div>
          </div>
          <div class="bg-yellow-900/30 rounded p-3 text-center">
            <div class="text-xl font-bold text-yellow-400">${data.summary.different}</div>
            <div class="text-xs text-gray-400">Different</div>
          </div>
          <div class="bg-red-900/30 rounded p-3 text-center">
            <div class="text-xl font-bold text-red-400">${data.summary.onlyInDb1}</div>
            <div class="text-xs text-gray-400">Only in ${db1Name}</div>
          </div>
          <div class="bg-red-900/30 rounded p-3 text-center">
            <div class="text-xl font-bold text-red-400">${data.summary.onlyInDb2}</div>
            <div class="text-xs text-gray-400">Only in ${db2Name}</div>
          </div>
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-700">
                <th class="text-left py-2 px-3">Column</th>
                <th class="text-left py-2 px-3">Status</th>
                <th class="text-left py-2 px-3 text-db1">${db1Name} Type</th>
                <th class="text-left py-2 px-3 text-db2">${db2Name} Type</th>
                <th class="text-left py-2 px-3">Differences</th>
              </tr>
            </thead>
            <tbody>
    `;

    for (const col of data.columns) {
      const statusClass = col.status === 'match' ? 'text-green-400' :
        col.status === 'different' ? 'text-yellow-400' : 'text-red-400';
      const statusText = col.status === 'match' ? '✓ Match' :
        col.status === 'different' ? '⚠ Different' :
          col.status === 'db1-only' ? `✗ ${db1Name} only` : `✗ ${db2Name} only`;

      const diffs = col.differences ? col.differences.map(d =>
        `<span class="inline-block bg-gray-700 rounded px-2 py-0.5 mr-1 mb-1">${d.prop}: <span class="text-db1">${d.db1 || 'NULL'}</span> → <span class="text-db2">${d.db2 || 'NULL'}</span></span>`
      ).join('') : '-';

      html += `
        <tr class="border-b border-gray-700/50">
          <td class="py-2 px-3 font-medium">${col.column}</td>
          <td class="py-2 px-3 ${statusClass}">${statusText}</td>
          <td class="py-2 px-3 text-gray-300">${col.db1?.Type || '-'}</td>
          <td class="py-2 px-3 text-gray-300">${col.db2?.Type || '-'}</td>
          <td class="py-2 px-3">${diffs}</td>
        </tr>
      `;
    }

    html += '</tbody></table></div>';

    // --- ADD SQL Query Generation for Missing Columns ---
    const missingInDb2 = data.columns.filter(c => c.status === 'db1-only'); // DB2 is missing these
    const missingInDb1 = data.columns.filter(c => c.status === 'db2-only'); // DB1 is missing these

    if (missingInDb2.length > 0 || missingInDb1.length > 0) {
      // Helper: is a default value a MySQL expression that must not be quoted?
      const isMysqlExpr = (v) => {
        if (v === null || v === undefined) return false;
        const s = String(v).trim().toUpperCase();
        return ['CURRENT_TIMESTAMP','NOW()','CURRENT_DATE','CURRENT_TIME',
                'CURRENT_TIMESTAMP()','LOCALTIME','LOCALTIMESTAMP','UUID()'].includes(s)
               || /^-?\d+(\.\d+)?$/.test(s);
      };

      // Build a column definition string (type + nullability + default + extra)
      const buildColDef = (col, colDef) => {
        let def = `\`${col}\` ${colDef.Type}`;
        if (colDef.Null === 'NO') def += ' NOT NULL';
        if (colDef.Default === null || colDef.Default === undefined) {
          if (colDef.Null !== 'NO') def += ' DEFAULT NULL';
        } else if (isMysqlExpr(colDef.Default)) {
          def += ` DEFAULT ${colDef.Default}`;
        } else {
          def += ` DEFAULT '${colDef.Default}'`;
        }
        if (colDef.Extra) def += ` ${colDef.Extra}`;
        return def;
      };

      // Build ALL add clauses for a batch of missing columns while maintaining
      // a VIRTUAL running set of "existing in target" columns. Each column added
      // to the batch immediately becomes a valid anchor for the next one,
      // producing a correct chain: col1 AFTER x, col2 AFTER col1, col3 AFTER col2 ...
      const buildAddClauses = (missingCols, sourceDbKey, targetExcludeStatus) => {
        const sourceOrder = sourceDbKey === 'db1' ? data.db1Order : data.db2Order;

        // Start with all columns that currently exist in the target DB
        const existingInTarget = new Set(
          data.columns
            .filter(c => c.status !== targetExcludeStatus)
            .map(c => c.column)
        );

        // Sort the missing columns exactly how they appear in the source DB
        const sortedMissing = [...missingCols].sort(
          (a, b) => sourceOrder.indexOf(a.column) - sourceOrder.indexOf(b.column)
        );

        return sortedMissing.map(c => {
          const colDef = c[sourceDbKey];
          const def = buildColDef(c.column, colDef);

          // Walk backward in the SOURCE order from this column to find nearest anchor
          // that is currently in the virtual existing set (either originally or newly added)
          const colIndex = sourceOrder.indexOf(c.column);
          let afterCol = null;
          for (let i = colIndex - 1; i >= 0; i--) {
            if (existingInTarget.has(sourceOrder[i])) {
              afterCol = sourceOrder[i];
              break;
            }
          }
          const position = afterCol ? `AFTER \`${afterCol}\`` : 'FIRST';

          // Register this column as now "existing" so the next missing column
          // in the batch can anchor to it instead of falling back to the same anchor
          existingInTarget.add(c.column);

          return `ADD COLUMN ${def} ${position}`;
        });
      };


      html += `<div class="mt-6 border-t border-gray-700 pt-4">
        <h4 class="text-lg font-semibold mb-3">🛠 Generated ALTER TABLE Queries</h4>
        <div class="grid md:grid-cols-2 gap-4">
      `;

      // Target DB2 (Target)
      if (missingInDb2.length > 0 || missingInDb1.length > 0) {
        html += `<div class="bg-gray-900 rounded-lg border border-db2 p-4">
           <h5 class="text-db2 font-medium mb-2 border-b border-gray-700 pb-2">Apply to ${db2Name} (Target)</h5>
         `;

        if (missingInDb2.length > 0) {
          // For DB2: target lacks 'db1-only' cols, so anchor search skips 'db1-only'
          const addCols = buildAddClauses(missingInDb2, 'db1', 'db1-only').join(',\n  ');
          const addQuery = `ALTER TABLE \`${table}\`\n  ${addCols};`;
          html += `
             <div class="mb-3">
               <div class="flex justify-between items-center mb-1">
                 <span class="text-xs text-green-400 font-semibold">↳ Add missing columns (with position)</span>
                 <button onclick="window.copyQuery(this, this.parentElement.nextElementSibling.innerText)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition-colors">Copy</button>
               </div>
               <pre class="bg-black p-2 rounded text-xs text-gray-300 overflow-x-auto border border-gray-800">${addQuery}</pre>
             </div>
           `;
        }

        if (missingInDb1.length > 0) {
          const dropCols = missingInDb1.map(c => `DROP COLUMN \`${c.column}\``).join(',\n  ');
          const dropQuery = `ALTER TABLE \`${table}\`\n  ${dropCols};`;
          html += `
             <div>
               <div class="flex justify-between items-center mb-1">
                 <span class="text-xs text-red-400 font-semibold">↳ Remove extra columns</span>
                 <button onclick="window.copyQuery(this, this.parentElement.nextElementSibling.innerText)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition-colors">Copy</button>
               </div>
               <pre class="bg-black p-2 rounded text-xs text-gray-300 overflow-x-auto border border-gray-800">${dropQuery}</pre>
             </div>
           `;
        }
        html += `</div>`;
      }

      // Target DB1 (Source)
      if (missingInDb1.length > 0 || missingInDb2.length > 0) {
        html += `<div class="bg-gray-900 rounded-lg border border-db1 p-4">
           <h5 class="text-db1 font-medium mb-2 border-b border-gray-700 pb-2">Apply to ${db1Name} (Source)</h5>
         `;

        if (missingInDb1.length > 0) {
          const addCols = buildAddClauses(missingInDb1, 'db2', 'db2-only').join(',\n  ');
          const addQuery = `ALTER TABLE \`${table}\`\n  ${addCols};`;
          html += `
             <div class="mb-3">
               <div class="flex justify-between items-center mb-1">
                 <span class="text-xs text-green-400 font-semibold">↳ Add missing columns (with position)</span>
                 <button onclick="window.copyQuery(this, this.parentElement.nextElementSibling.innerText)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition-colors">Copy</button>
               </div>
               <pre class="bg-black p-2 rounded text-xs text-gray-300 overflow-x-auto border border-gray-800">${addQuery}</pre>
             </div>
           `;
        }

        if (missingInDb2.length > 0) {
          const dropCols = missingInDb2.map(c => `DROP COLUMN \`${c.column}\``).join(',\n  ');
          const dropQuery = `ALTER TABLE \`${table}\`\n  ${dropCols};`;
          html += `
             <div>
               <div class="flex justify-between items-center mb-1">
                 <span class="text-xs text-red-400 font-semibold">↳ Remove extra columns</span>
                 <button onclick="window.copyQuery(this, this.parentElement.nextElementSibling.innerText)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition-colors">Copy</button>
               </div>
               <pre class="bg-black p-2 rounded text-xs text-gray-300 overflow-x-auto border border-gray-800">${dropQuery}</pre>
             </div>
           `;
        }
        html += `</div>`;
      }

      html += `</div></div>`; // close grid and outer div
    }


    // --- ADD SQL Query Generation for Different Columns (MODIFY COLUMN) ---
    const differentCols = data.columns.filter(c => c.status === 'different');

    if (differentCols.length > 0) {
      // Helper: check if a difference prop is modifiable via MODIFY COLUMN (not Key)
      const isModifiableDiff = (diffs) => diffs.some(d => d.prop !== 'Key');
      const isKeyOnlyDiff = (diffs) => diffs.length > 0 && diffs.every(d => d.prop === 'Key');

      // Separate columns: those with modifiable diffs vs key-only diffs
      const modifiableCols = differentCols.filter(c => isModifiableDiff(c.differences));
      const keyOnlyCols = differentCols.filter(c => isKeyOnlyDiff(c.differences));

      // MySQL expression/function defaults must NOT be wrapped in quotes
      const isMysqlExpression = (val) => {
        if (val === null || val === undefined) return false;
        const s = String(val).trim().toUpperCase();
        // Known MySQL functions and keywords used as defaults
        const expressions = [
          'CURRENT_TIMESTAMP', 'NOW()', 'CURRENT_DATE', 'CURRENT_TIME',
          'CURRENT_TIMESTAMP()', 'LOCALTIME', 'LOCALTIMESTAMP', 'UUID()'
        ];
        if (expressions.includes(s)) return true;
        // Pure numeric values also don't need quotes
        if (/^-?\d+(\.\d+)?$/.test(s)) return true;
        return false;
      };

      // Helper to build a MODIFY COLUMN clause from a column definition
      const buildModifyClause = (col, colDef) => {
        let clause = `MODIFY COLUMN \`${col}\` ${colDef.Type}`;
        if (colDef.Null === 'NO') clause += ' NOT NULL';
        if (colDef.Default === null || colDef.Default === undefined) {
          // Only emit DEFAULT NULL if the column is nullable (not NOT NULL)
          if (colDef.Null !== 'NO') clause += ' DEFAULT NULL';
        } else if (isMysqlExpression(colDef.Default)) {
          // MySQL functions/keywords must not be quoted
          clause += ` DEFAULT ${colDef.Default}`;
        } else {
          clause += ` DEFAULT '${colDef.Default}'`;
        }
        if (colDef.Extra) clause += ` ${colDef.Extra}`;
        return clause;
      };


      html += `<div class="mt-6 border-t border-gray-700 pt-4">
        <h4 class="text-lg font-semibold mb-1">🔧 ALTER TABLE — Fix Different Columns</h4>
        <p class="text-xs text-gray-500 mb-3">Columns exist in both DBs but have different structure. Choose which DB to update:</p>
      `;

      if (modifiableCols.length > 0) {
        // Query to make DB2 match DB1 (use db1 definition)
        const modifyForDb2 = modifiableCols.map(c => buildModifyClause(c.column, c.db1)).join(',\n  ');
        const alterQueryForDb2 = `ALTER TABLE \`${table}\`\n  ${modifyForDb2};`;

        // Query to make DB1 match DB2 (use db2 definition)
        const modifyForDb1 = modifiableCols.map(c => buildModifyClause(c.column, c.db2)).join(',\n  ');
        const alterQueryForDb1 = `ALTER TABLE \`${table}\`\n  ${modifyForDb1};`;

        html += `
          <div class="grid md:grid-cols-2 gap-4 mb-4">
            <div class="bg-gray-900 rounded-lg border border-db2 p-4">
              <h5 class="text-db2 font-medium mb-2 border-b border-gray-700 pb-2">Apply to ${db2Name} — make it match ${db1Name}</h5>
              <div class="flex justify-between items-center mb-1">
                <span class="text-xs text-yellow-400 font-semibold">↳ Modify ${modifiableCols.length} column(s)</span>
                <button onclick="window.copyQuery(this, this.parentElement.nextElementSibling.innerText)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition-colors">Copy</button>
              </div>
              <pre class="bg-black p-2 rounded text-xs text-gray-300 overflow-x-auto border border-gray-800">${alterQueryForDb2}</pre>
            </div>

            <div class="bg-gray-900 rounded-lg border border-db1 p-4">
              <h5 class="text-db1 font-medium mb-2 border-b border-gray-700 pb-2">Apply to ${db1Name} — make it match ${db2Name}</h5>
              <div class="flex justify-between items-center mb-1">
                <span class="text-xs text-yellow-400 font-semibold">↳ Modify ${modifiableCols.length} column(s)</span>
                <button onclick="window.copyQuery(this, this.parentElement.nextElementSibling.innerText)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition-colors">Copy</button>
              </div>
              <pre class="bg-black p-2 rounded text-xs text-gray-300 overflow-x-auto border border-gray-800">${alterQueryForDb1}</pre>
            </div>
          </div>
        `;
      }

      // Generate ADD/DROP INDEX queries for key-only differences
      if (keyOnlyCols.length > 0) {
        // Build the index statements needed to make a target DB's column match a source key
        const buildIndexStatements = (col, currentKey, targetKey) => {
          const stmts = [];
          // Drop existing key first if needed
          if (currentKey === 'PRI') {
            stmts.push(`ALTER TABLE \`${table}\` DROP PRIMARY KEY;`);
          } else if (currentKey === 'UNI' || currentKey === 'MUL') {
            stmts.push(`-- Find exact index name: SHOW INDEX FROM \`${table}\` WHERE Column_name = '${col}';\nALTER TABLE \`${table}\` DROP INDEX \`idx_${col}\`;`);
          }
          // Add new key
          if (targetKey === 'PRI') {
            stmts.push(`ALTER TABLE \`${table}\` ADD PRIMARY KEY (\`${col}\`);`);
          } else if (targetKey === 'UNI') {
            stmts.push(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`idx_${col}\` (\`${col}\`);`);
          } else if (targetKey === 'MUL') {
            stmts.push(`ALTER TABLE \`${table}\` ADD INDEX \`idx_${col}\` (\`${col}\`);`);
          }
          return stmts.join('\n');
        };

        // For each direction, build combined statements for all key-diff columns
        const indexQueryForDb2 = keyOnlyCols.map(c => buildIndexStatements(c.column, c.db2.Key, c.db1.Key)).join('\n\n');
        const indexQueryForDb1 = keyOnlyCols.map(c => buildIndexStatements(c.column, c.db1.Key, c.db2.Key)).join('\n\n');

        html += `
          <div class="mt-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-orange-400 font-semibold text-sm">🗂 Index Differences — ADD / DROP INDEX</span>
              <span class="text-xs text-gray-500">(${keyOnlyCols.length} column(s) differ only in key/index type)</span>
            </div>
            <div class="grid md:grid-cols-2 gap-4">
              <div class="bg-gray-900 rounded-lg border border-db2 p-4">
                <h5 class="text-db2 font-medium mb-2 border-b border-gray-700 pb-2">Apply to ${db2Name} — make it match ${db1Name}</h5>
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs text-orange-400 font-semibold">↳ Fix ${keyOnlyCols.length} index(es)</span>
                  <button onclick="window.copyQuery(this, this.parentElement.nextElementSibling.innerText)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition-colors">Copy</button>
                </div>
                <pre class="bg-black p-2 rounded text-xs text-gray-300 overflow-x-auto border border-gray-800">${indexQueryForDb2}</pre>
              </div>
              <div class="bg-gray-900 rounded-lg border border-db1 p-4">
                <h5 class="text-db1 font-medium mb-2 border-b border-gray-700 pb-2">Apply to ${db1Name} — make it match ${db2Name}</h5>
                <div class="flex justify-between items-center mb-1">
                  <span class="text-xs text-orange-400 font-semibold">↳ Fix ${keyOnlyCols.length} index(es)</span>
                  <button onclick="window.copyQuery(this, this.parentElement.nextElementSibling.innerText)" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition-colors">Copy</button>
                </div>
                <pre class="bg-black p-2 rounded text-xs text-gray-300 overflow-x-auto border border-gray-800">${indexQueryForDb1}</pre>
              </div>
            </div>
          </div>
        `;
      }

      html += `</div>`; // close outer div
    }

    html += '</div>'; // close main fade-in div
    result.innerHTML = html;

  } catch (e) {
    result.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
  }
}
