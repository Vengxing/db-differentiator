// Load tables comparison
let currentTableFilter = 'all';

async function loadTables(filter = 'all') {
  currentTableFilter = filter;
  const content = document.getElementById('tab-content');
  content.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div></div>';
  
  try {
    const res = await fetch('/api/tables');
    tablesData = await res.json();
    
    const filterBtnClass = (f) => f === filter 
      ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 transform scale-105' 
      : 'hover:scale-105 cursor-pointer';
    
    let html = `
      <div class="mb-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">📋 Table Comparison</h2>
          <button onclick="loadTables(currentTableFilter)" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1">
            <span>🔄</span> Refresh
          </button>
        </div>
        <p class="text-gray-400 text-sm mb-3">Click a card to filter the table list:</p>
        <div class="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div onclick="loadTables('all')" class="bg-gray-700 rounded-lg p-4 text-center transition-all cursor-pointer ${filterBtnClass('all')}">
            <div class="text-2xl font-bold text-white">${tablesData.tables.length}</div>
            <div class="text-sm text-gray-400">All Tables</div>
          </div>
          <div onclick="loadTables('db1')" class="bg-gray-700 rounded-lg p-4 text-center transition-all cursor-pointer ${filterBtnClass('db1')}">
            <div class="text-2xl font-bold text-db1">${tablesData.db1Tables}</div>
            <div class="text-sm text-gray-400">In ${db1Name}</div>
          </div>
          <div onclick="loadTables('db2')" class="bg-gray-700 rounded-lg p-4 text-center transition-all cursor-pointer ${filterBtnClass('db2')}">
            <div class="text-2xl font-bold text-db2">${tablesData.db2Tables}</div>
            <div class="text-sm text-gray-400">In ${db2Name}</div>
          </div>
          <div onclick="loadTables('both')" class="bg-gray-700 rounded-lg p-4 text-center transition-all cursor-pointer ${filterBtnClass('both')}">
            <div class="text-2xl font-bold text-green-400">${tablesData.common}</div>
            <div class="text-sm text-gray-400">In Both</div>
          </div>
          <div onclick="loadTables('db1-only')" class="bg-gray-700 rounded-lg p-4 text-center transition-all cursor-pointer ${filterBtnClass('db1-only')}">
            <div class="text-2xl font-bold ${tablesData.onlyInDb1 > 0 ? 'text-red-400' : 'text-green-400'}">${tablesData.onlyInDb1}</div>
            <div class="text-sm text-gray-400">Only in ${db1Name}</div>
          </div>
          <div onclick="loadTables('db2-only')" class="bg-gray-700 rounded-lg p-4 text-center transition-all cursor-pointer ${filterBtnClass('db2-only')}">
            <div class="text-2xl font-bold ${tablesData.onlyInDb2 > 0 ? 'text-red-400' : 'text-green-400'}">${tablesData.onlyInDb2}</div>
            <div class="text-sm text-gray-400">Only in ${db2Name}</div>
          </div>
        </div>
      </div>
      
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700">
              <th class="text-left py-3 px-4">Table Name</th>
              <th class="text-center py-3 px-4 text-db1">${db1Name}</th>
              <th class="text-center py-3 px-4 text-db2">${db2Name}</th>
              <th class="text-center py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Apply filter
    let filteredTables = tablesData.tables;
    if (filter === 'db1') {
      filteredTables = tablesData.tables.filter(t => t.inDb1);
    } else if (filter === 'db2') {
      filteredTables = tablesData.tables.filter(t => t.inDb2);
    } else if (filter === 'both') {
      filteredTables = tablesData.tables.filter(t => t.status === 'both');
    } else if (filter === 'db1-only') {
      filteredTables = tablesData.tables.filter(t => t.status === 'db1-only');
    } else if (filter === 'db2-only') {
      filteredTables = tablesData.tables.filter(t => t.status === 'db2-only');
    }
    
    if (filteredTables.length === 0) {
      html += `<tr><td colspan="4" class="py-8 text-center text-gray-400">No tables match this filter</td></tr>`;
    }
    
    for (const table of filteredTables) {
      const statusClass = table.status === 'both' ? 'text-green-400' : 'text-red-400';
      const statusIcon = table.status === 'both' ? '✓ Match' : 
                        table.status === 'db1-only' ? `✗ Missing in ${db2Name}` : `✗ Missing in ${db1Name}`;
      
      html += `
        <tr class="border-b border-gray-700/50 hover:bg-gray-700/30">
          <td class="py-3 px-4 font-medium">${table.name}</td>
          <td class="text-center py-3 px-4">${table.inDb1 ? '<span class="text-green-400">✓</span>' : '<span class="text-red-400">✗</span>'}</td>
          <td class="text-center py-3 px-4">${table.inDb2 ? '<span class="text-green-400">✓</span>' : '<span class="text-red-400">✗</span>'}</td>
          <td class="text-center py-3 px-4 ${statusClass}">${statusIcon}</td>
        </tr>
      `;
    }
    
    html += '</tbody></table></div>';
    content.innerHTML = html;
    
  } catch (e) {
    content.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
  }
}
