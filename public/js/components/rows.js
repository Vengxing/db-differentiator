// Load row content comparison
let currentRowTable = null;
let currentRowBase = 'db1';
let currentRowData = null;

async function loadRows() {
  const content = document.getElementById('tab-content');
  
  if (!tablesData) {
    await loadTables();
  }
  
  const commonTables = tablesData.tables.filter(t => t.status === 'both');
  
  let html = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">📝 Full Row Content Comparison</h2>
      <button onclick="tablesData = null; loadRows()" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1">
        <span>🔄</span> Refresh
      </button>
    </div>
    <p class="text-gray-400 mb-2">Select options and a table to compare:</p>
    
    <div class="flex flex-wrap gap-4 mb-4 items-center">
      <div>
        <label class="text-gray-400 text-sm block mb-1">Row Limit:</label>
        <select id="row-limit" class="bg-gray-700 rounded px-3 py-2 text-sm">
          <option value="50">50 rows</option>
          <option value="100" selected>100 rows</option>
          <option value="200">200 rows</option>
          <option value="500">500 rows</option>
          <option value="1000">1,000 rows</option>
        </select>
      </div>
      <div>
        <label class="text-gray-400 text-sm block mb-1">Base (left side):</label>
        <select id="row-base" class="bg-gray-700 rounded px-3 py-2 text-sm" onchange="if(currentRowTable) loadRowsForTable(currentRowTable)">
          <option value="db1" class="text-db1">${db1Name}</option>
          <option value="db2" class="text-db2">${db2Name}</option>
        </select>
      </div>
    </div>
    
    <div class="flex flex-wrap gap-2 mb-6">
  `;
  
  for (const table of commonTables) {
    html += `<button onclick="loadRowsForTable('${table.name}')" class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm">${table.name}</button>`;
  }
  
  html += `</div><div id="rows-result"></div>`;
  content.innerHTML = html;
}

// Load rows for specific table in table format
async function loadRowsForTable(table) {
  currentRowTable = table;
  const result = document.getElementById('rows-result');
  const limit = document.getElementById('row-limit').value;
  const base = document.getElementById('row-base').value;
  currentRowBase = base;
  
  result.innerHTML = '<div class="loader"></div> <span class="text-gray-400">Comparing rows (this may take a while)...</span>';
  
  try {
    const res = await fetch(`/api/row-table/${encodeURIComponent(table)}?limit=${limit}&base=${base}`);
    const data = await res.json();
    currentRowData = data;
    
    const baseName = base === 'db1' ? db1Name : db2Name;
    const compareName = base === 'db1' ? db2Name : db1Name;
    
    let html = `
      <div class="fade-in">
        <h3 class="text-lg font-semibold mb-3">Table: <span class="text-blue-400">${table}</span></h3>
        <p class="text-gray-400 mb-3">Base: <span class="text-db1 font-medium">${baseName}</span> | Comparing against: <span class="text-db2 font-medium">${compareName}</span></p>
        
        <div class="grid grid-cols-5 gap-3 mb-4">
          <div class="bg-gray-700 rounded p-3 text-center">
            <div class="text-xl font-bold text-db1">${data.summary.baseTotal.toLocaleString()}</div>
            <div class="text-xs text-gray-400">${baseName} Rows</div>
          </div>
          <div class="bg-gray-700 rounded p-3 text-center">
            <div class="text-xl font-bold text-db2">${data.summary.compareTotal.toLocaleString()}</div>
            <div class="text-xs text-gray-400">${compareName} Rows</div>
          </div>
          <div class="bg-green-900/30 rounded p-3 text-center">
            <div class="text-xl font-bold text-green-400">${data.summary.matching}</div>
            <div class="text-xs text-gray-400">Matching</div>
          </div>
          <div class="bg-yellow-900/30 rounded p-3 text-center">
            <div class="text-xl font-bold text-yellow-400">${data.summary.different}</div>
            <div class="text-xs text-gray-400">Different</div>
          </div>
          <div class="bg-red-900/30 rounded p-3 text-center">
            <div class="text-xl font-bold text-red-400">${data.summary.missingInCompare + data.summary.extraInCompare}</div>
            <div class="text-xs text-gray-400">Missing/Extra</div>
          </div>
        </div>
        
        <div class="mb-2 text-sm">
          <span class="inline-block w-4 h-4 bg-green-900/50 rounded mr-1 align-middle"></span> Row matches
          <span class="inline-block w-4 h-4 bg-yellow-900/50 rounded mr-1 ml-3 align-middle"></span> Row differs (click to expand)
          <span class="inline-block w-4 h-4 bg-red-900/50 rounded mr-1 ml-3 align-middle"></span> Row missing in ${compareName}
          <span class="inline-block w-4 h-4 bg-purple-900/50 rounded mr-1 ml-3 align-middle"></span> Extra in ${compareName}
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead class="sticky top-0 bg-gray-800">
              <tr class="border-b border-gray-600">
                <th class="text-left py-2 px-2 text-gray-400">#</th>
    `;
    
    // Column headers
    for (const col of data.columns) {
      const colClass = col.status === 'both' ? 'text-gray-200' : 
                       col.status === 'db1-only' ? 'text-red-400 bg-red-900/20' : 
                       'text-red-400 bg-red-900/20';
      const tooltip = col.status !== 'both' ? ` title="Only in ${col.status === 'db1-only' ? db1Name : db2Name}"` : '';
      html += `<th class="text-left py-2 px-2 ${colClass} whitespace-nowrap"${tooltip}>${col.name}${col.status !== 'both' ? ' ⚠' : ''}</th>`;
    }
    
    html += `</tr></thead><tbody>`;
    
    // Data rows from base
    let rowNum = 0;
    for (const row of data.rows) {
      rowNum++;
      const rowId = `row-${rowNum}`;
      let rowClass = '';
      let clickable = '';
      
      if (row.status === 'match') {
        rowClass = 'bg-green-900/20 hover:bg-green-900/30';
      } else if (row.status === 'different') {
        rowClass = 'bg-yellow-900/20 hover:bg-yellow-900/30 cursor-pointer';
        clickable = ` onclick="toggleRowExpand('${rowId}')"`;
      } else if (row.status === 'missing') {
        rowClass = 'bg-red-900/20 hover:bg-red-900/30';
      }
      
      html += `<tr class="${rowClass} border-b border-gray-700/50"${clickable} id="${rowId}">`;
      html += `<td class="py-1 px-2 text-gray-500">${rowNum}</td>`;
      
      for (const col of data.columns) {
        const val = row.baseRow ? row.baseRow[col.name] : null;
        const isDiff = row.diffColumns.includes(col.name);
        const cellClass = isDiff ? 'bg-yellow-500/30 text-yellow-200' : '';
        const displayVal = formatCellValue(val);
        html += `<td class="py-1 px-2 ${cellClass} max-w-xs truncate" title="${escapeHtml(String(val ?? 'NULL'))}">${displayVal}</td>`;
      }
      
      html += `</tr>`;
      
      // Expandable row for differences
      if (row.status === 'different' && row.compareRow) {
        html += `<tr id="${rowId}-expand" class="hidden bg-gray-900 border-b border-gray-600">`;
        html += `<td class="py-1 px-2 text-db2">↳</td>`;
        
        for (const col of data.columns) {
          const val = row.compareRow[col.name];
          const isDiff = row.diffColumns.includes(col.name);
          const cellClass = isDiff ? 'bg-purple-500/30 text-purple-200' : 'text-gray-500';
          const displayVal = formatCellValue(val);
          html += `<td class="py-1 px-2 ${cellClass} max-w-xs truncate" title="${escapeHtml(String(val ?? 'NULL'))}">${displayVal}</td>`;
        }
        
        html += `</tr>`;
      }
    }
    
    // Extra rows (only in compare DB)
    for (const row of data.extraRows) {
      rowNum++;
      html += `<tr class="bg-purple-900/20 hover:bg-purple-900/30 border-b border-gray-700/50">`;
      html += `<td class="py-1 px-2 text-gray-500">${rowNum} <span class="text-purple-400 text-xs">(extra)</span></td>`;
      
      for (const col of data.columns) {
        const val = row.compareRow ? row.compareRow[col.name] : null;
        const displayVal = formatCellValue(val);
        html += `<td class="py-1 px-2 text-purple-300 max-w-xs truncate" title="${escapeHtml(String(val ?? 'NULL'))}">${displayVal}</td>`;
      }
      
      html += `</tr>`;
    }
    
    html += `</tbody></table></div>`;
    
    if (data.summary.matching === data.summary.baseTotal && data.summary.extraInCompare === 0) {
      html += `<div class="text-green-400 font-medium text-lg mt-4">✓ All rows match perfectly!</div>`;
    }
    
    html += '</div>';
    result.innerHTML = html;
    
  } catch (e) {
    result.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
  }
}

// Toggle expand row
function toggleRowExpand(rowId) {
  const expandRow = document.getElementById(rowId + '-expand');
  if (expandRow) {
    expandRow.classList.toggle('hidden');
  }
}
