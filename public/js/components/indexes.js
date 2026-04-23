// Load indexes
async function loadIndexes() {
  const content = document.getElementById('tab-content');
  
  if (!tablesData) {
    await loadTables();
  }
  
  const commonTables = tablesData.tables.filter(t => t.status === 'both');
  
  let html = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">📊 Index Comparison</h2>
      <button onclick="tablesData = null; loadIndexes()" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1">
        <span>🔄</span> Refresh
      </button>
    </div>
    <p class="text-gray-400 mb-4">Select a table to compare indexes:</p>
    <div class="flex flex-wrap gap-2 mb-6">
  `;
  
  for (const table of commonTables) {
    html += `<button onclick="loadIndexesForTable('${table.name}')" class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm">${table.name}</button>`;
  }
  
  html += `</div><div id="indexes-result"></div>`;
  content.innerHTML = html;
}

// Load indexes for specific table
async function loadIndexesForTable(table) {
  const result = document.getElementById('indexes-result');
  result.innerHTML = '<div class="loader"></div>';
  
  try {
    const res = await fetch(`/api/indexes/${encodeURIComponent(table)}`);
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
        
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700">
              <th class="text-left py-2 px-3">Index Name</th>
              <th class="text-left py-2 px-3">Status</th>
              <th class="text-left py-2 px-3 text-db1">${db1Name} Columns</th>
              <th class="text-left py-2 px-3 text-db2">${db2Name} Columns</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    for (const idx of data.indexes) {
      const statusClass = idx.status === 'match' ? 'text-green-400' : 
                         idx.status === 'different' ? 'text-yellow-400' : 'text-red-400';
      
      html += `
        <tr class="border-b border-gray-700/50">
          <td class="py-2 px-3 font-medium">${idx.name}</td>
          <td class="py-2 px-3 ${statusClass}">${idx.status}</td>
          <td class="py-2 px-3">${idx.db1?.columns?.join(', ') || '-'}</td>
          <td class="py-2 px-3">${idx.db2?.columns?.join(', ') || '-'}</td>
        </tr>
      `;
    }
    
    html += '</tbody></table></div>';
    result.innerHTML = html;
    
  } catch (e) {
    result.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
  }
}
