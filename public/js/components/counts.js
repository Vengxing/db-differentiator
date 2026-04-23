// Row counts filter state
let rowCountsData = null;
let currentCountFilter = 'all';

// Load row counts
async function loadCounts(filter = 'all') {
  currentCountFilter = filter;
  const content = document.getElementById('tab-content');
  
  if (!rowCountsData) {
    content.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="text-gray-400 mt-2">Counting rows in all tables...</p></div>';
    try {
      const res = await fetch('/api/row-counts');
      rowCountsData = await res.json();
    } catch (e) {
      content.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
      return;
    }
  }
  
  const data = rowCountsData;
  const filterBtnClass = (f) => f === filter 
    ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 transform scale-105' 
    : 'hover:scale-105 cursor-pointer';
  
  let html = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">🔢 Row Count Comparison</h2>
      <button onclick="rowCountsData = null; loadCounts(currentCountFilter)" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1">
        <span>🔄</span> Refresh
      </button>
    </div>
    <p class="text-gray-400 text-sm mb-3">Click a card to filter:</p>
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div onclick="loadCounts('all')" class="bg-gray-700 rounded-lg p-4 text-center transition-all cursor-pointer ${filterBtnClass('all')}">
        <div class="text-2xl font-bold">${data.summary.total}</div>
        <div class="text-sm text-gray-400">All Tables</div>
      </div>
      <div onclick="loadCounts('matching')" class="bg-green-900/30 rounded-lg p-4 text-center transition-all cursor-pointer ${filterBtnClass('matching')}">
        <div class="text-2xl font-bold text-green-400">${data.summary.matching}</div>
        <div class="text-sm text-gray-400">Matching Counts</div>
      </div>
      <div onclick="loadCounts('different')" class="bg-red-900/30 rounded-lg p-4 text-center transition-all cursor-pointer ${filterBtnClass('different')}">
        <div class="text-2xl font-bold text-red-400">${data.summary.different}</div>
        <div class="text-sm text-gray-400">Different Counts</div>
      </div>
    </div>
    
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-700">
            <th class="text-left py-3 px-4">Table</th>
            <th class="text-right py-3 px-4 text-db1">${db1Name} Count</th>
            <th class="text-right py-3 px-4 text-db2">${db2Name} Count</th>
            <th class="text-right py-3 px-4">Difference</th>
            <th class="text-center py-3 px-4">Status</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Apply filter
  let filteredData = [...data.tables];
  if (filter === 'matching') {
    filteredData = filteredData.filter(r => r.match);
  } else if (filter === 'different') {
    filteredData = filteredData.filter(r => !r.match);
  }
  
  // Sort by difference (most different first)
  filteredData.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  
  if (filteredData.length === 0) {
    html += `<tr><td colspan="5" class="py-8 text-center text-gray-400">No tables match this filter</td></tr>`;
  }
  
  for (const row of filteredData) {
    const diffClass = row.difference > 0 ? 'text-db1' : row.difference < 0 ? 'text-db2' : 'text-gray-400';
    const diffText = row.difference > 0 ? `+${row.difference.toLocaleString()}` : row.difference.toLocaleString();
    
    html += `
      <tr class="border-b border-gray-700/50 hover:bg-gray-700/30">
        <td class="py-3 px-4 font-medium">${row.table}</td>
        <td class="text-right py-3 px-4">${row.db1Count.toLocaleString()}</td>
        <td class="text-right py-3 px-4">${row.db2Count.toLocaleString()}</td>
        <td class="text-right py-3 px-4 ${diffClass}">${diffText}</td>
        <td class="text-center py-3 px-4">${row.match ? '<span class="text-green-400">✓</span>' : '<span class="text-red-400">✗</span>'}</td>
      </tr>
    `;
  }
  
  html += '</tbody></table></div>';
  content.innerHTML = html;
}
