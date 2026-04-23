// Load PK comparison
async function loadPKs() {
  const content = document.getElementById('tab-content');
  
  if (!tablesData) {
    await loadTables();
  }
  
  const commonTables = tablesData.tables.filter(t => t.status === 'both');
  
  let html = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">🔑 Primary Key Comparison</h2>
      <button onclick="tablesData = null; loadPKs()" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1">
        <span>🔄</span> Refresh
      </button>
    </div>
    <p class="text-gray-400 mb-4">Select a table to compare primary key values:</p>
    <div class="flex flex-wrap gap-2 mb-6">
  `;
  
  for (const table of commonTables) {
    html += `<button onclick="loadPKForTable('${table.name}')" class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm">${table.name}</button>`;
  }
  
  html += `</div><div id="pk-result"></div>`;
  content.innerHTML = html;
}

// Load PK for specific table
async function loadPKForTable(table) {
  const result = document.getElementById('pk-result');
  result.innerHTML = '<div class="loader"></div> <span class="text-gray-400">Comparing primary keys...</span>';
  
  try {
    const res = await fetch(`/api/pk-compare/${encodeURIComponent(table)}`);
    const data = await res.json();
    
    if (!data.hasPrimaryKey) {
      result.innerHTML = `<div class="text-yellow-400 fade-in">⚠ Table ${table} has no primary key defined</div>`;
      return;
    }
    
    if (data.pkMismatch) {
      result.innerHTML = `
        <div class="text-red-400 fade-in">
          ✗ Primary key structure differs!<br>
          ${db1Name}: ${data.db1Pks.join(', ')}<br>
          ${db2Name}: ${data.db2Pks.join(', ')}
        </div>
      `;
      return;
    }
    
    let html = `
      <div class="fade-in">
        <h3 class="text-lg font-semibold mb-3">Table: <span class="text-blue-400">${table}</span></h3>
        <p class="text-gray-400 mb-3">Primary Key: <code class="bg-gray-700 px-2 py-1 rounded">${data.primaryKeys.join(', ')}</code></p>
        
        <div class="grid grid-cols-4 gap-3 mb-4">
          <div class="bg-gray-700 rounded p-3 text-center">
            <div class="text-xl font-bold text-db1">${data.db1Total.toLocaleString()}</div>
            <div class="text-xs text-gray-400">${db1Name} Rows</div>
          </div>
          <div class="bg-gray-700 rounded p-3 text-center">
            <div class="text-xl font-bold text-db2">${data.db2Total.toLocaleString()}</div>
            <div class="text-xs text-gray-400">${db2Name} Rows</div>
          </div>
          <div class="bg-green-900/30 rounded p-3 text-center">
            <div class="text-xl font-bold text-green-400">${data.commonCount.toLocaleString()}</div>
            <div class="text-xs text-gray-400">In Both</div>
          </div>
          <div class="bg-red-900/30 rounded p-3 text-center">
            <div class="text-xl font-bold text-red-400">${(data.onlyInDb1Count + data.onlyInDb2Count).toLocaleString()}</div>
            <div class="text-xs text-gray-400">Missing</div>
          </div>
        </div>
    `;
    
    if (data.onlyInDb1Count > 0) {
      html += `
        <div class="mb-4">
          <h4 class="text-red-400 font-medium mb-2">✗ ${data.onlyInDb1Count} rows only in ${db1Name}:</h4>
          <div class="bg-gray-900 rounded p-3 max-h-40 overflow-auto">
            <code class="text-xs">${JSON.stringify(data.onlyInDb1.slice(0, 20), null, 2)}</code>
            ${data.onlyInDb1Count > 20 ? `<div class="text-gray-500 mt-2">... and ${data.onlyInDb1Count - 20} more</div>` : ''}
          </div>
        </div>
      `;
    }
    
    if (data.onlyInDb2Count > 0) {
      html += `
        <div class="mb-4">
          <h4 class="text-red-400 font-medium mb-2">✗ ${data.onlyInDb2Count} rows only in ${db2Name}:</h4>
          <div class="bg-gray-900 rounded p-3 max-h-40 overflow-auto">
            <code class="text-xs">${JSON.stringify(data.onlyInDb2.slice(0, 20), null, 2)}</code>
            ${data.onlyInDb2Count > 20 ? `<div class="text-gray-500 mt-2">... and ${data.onlyInDb2Count - 20} more</div>` : ''}
          </div>
        </div>
      `;
    }
    
    if (data.onlyInDb1Count === 0 && data.onlyInDb2Count === 0) {
      html += `<div class="text-green-400 font-medium">✓ All primary keys match!</div>`;
    }
    
    html += '</div>';
    result.innerHTML = html;
    
  } catch (e) {
    result.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
  }
}
