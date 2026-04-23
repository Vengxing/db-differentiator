let currentOpenTable = null;
let currentTableEndpointsData = null;

// Toggle table endpoints section
async function toggleTableEndpoints(tableName, dbGroup) {
  const sectionId = `detail-section-${tableName.replace(/\./g, '-')}`;
  const sectionDiv = document.getElementById(sectionId);
  const btnId = `btn-${tableName.replace(/\./g, '-')}`;
  
  // If clicking the same table, toggle it off
  if (currentOpenTable === tableName) {
    sectionDiv.classList.add('hidden');
    sectionDiv.innerHTML = '';
    currentOpenTable = null;
    currentTableEndpointsData = null;
    // Remove highlight from button
    document.getElementById(btnId)?.classList.remove('ring-2', 'ring-white');
    return;
  }
  
  // Remove highlight from previous button
  if (currentOpenTable) {
    const prevBtnId = `btn-${currentOpenTable.replace(/\./g, '-')}`;
    document.getElementById(prevBtnId)?.classList.remove('ring-2', 'ring-white');
    // Hide all detail sections
    document.querySelectorAll('[id^="detail-section-"]').forEach(el => {
      el.classList.add('hidden');
      el.innerHTML = '';
    });
  }
  
  // Highlight current button
  document.getElementById(btnId)?.classList.add('ring-2', 'ring-white');
  
  // Show loading in section
  sectionDiv.classList.remove('hidden');
  sectionDiv.innerHTML = '<div class="flex items-center gap-2 p-3"><div class="loader"></div><span class="text-gray-400 text-sm">Loading endpoints...</span></div>';
  currentOpenTable = tableName;
  
  try {
    const res = await fetch(`/api/api-tables/endpoints/${encodeURIComponent(tableName)}`);
    const data = await res.json();
    
    // Store data for later use
    currentTableEndpointsData = data.endpoints;
    
    let html = `
      <div class="fade-in bg-gray-900 rounded-lg p-4 border border-gray-700">
        <div class="flex justify-between items-center mb-3">
          <h4 class="font-semibold text-white">
            <span class="text-blue-400">${tableName}</span>
            <span class="text-gray-500 text-sm font-normal ml-2">used in ${data.endpointCount} endpoint${data.endpointCount !== 1 ? 's' : ''}</span>
          </h4>
          <span onclick="toggleTableEndpoints('${tableName}', '${dbGroup}')" class="text-gray-500 hover:text-white cursor-pointer px-2 py-1 hover:bg-gray-700 rounded">✕</span>
        </div>
    `;
    
    if (data.endpoints.length === 0) {
      html += `<p class="text-gray-500 text-sm">No endpoints found.</p>`;
    } else {
      html += `<div class="space-y-2">`;
      for (let i = 0; i < data.endpoints.length; i++) {
        const ep = data.endpoints[i];
        const fileName = ep.filePath.split('/').pop();
        const contentId = `content-${tableName.replace(/\./g, '-')}-${i}`;
        html += `
          <div>
            <div onclick="toggleEndpointContentByIndex('${contentId}', '${tableName}', ${i})" 
                 class="flex items-center gap-2 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 border border-gray-700">
              <span class="text-yellow-400">📄</span>
              <span class="text-gray-300 text-sm">${fileName}</span>
              <span class="text-gray-600 text-xs ml-auto">click to expand</span>
            </div>
            <div id="${contentId}" class="hidden"></div>
          </div>
        `;
      }
      html += `</div>`;
    }
    
    html += `</div>`;
    sectionDiv.innerHTML = html;
    
  } catch (e) {
    sectionDiv.innerHTML = `<div class="text-red-400 p-3">Error: ${e.message}</div>`;
  }
}

// Toggle endpoint content display by index (uses stored data)
function toggleEndpointContentByIndex(contentId, tableName, index) {
  const contentDiv = document.getElementById(contentId);
  
  if (!contentDiv.classList.contains('hidden')) {
    contentDiv.classList.add('hidden');
    contentDiv.innerHTML = '';
    return;
  }
  
  if (!currentTableEndpointsData || !currentTableEndpointsData[index]) {
    contentDiv.innerHTML = '<div class="text-red-400 text-sm p-2">Data not found</div>';
    contentDiv.classList.remove('hidden');
    return;
  }
  
  const fileContent = currentTableEndpointsData[index].fileContent;
  
  // Escape HTML and highlight the table name
  let content = escapeHtml(fileContent);
  
  const tableNameEscaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${tableNameEscaped})`, 'gi');
  content = content.replace(regex, '<mark class="bg-yellow-500 text-black px-1 rounded">$1</mark>');
  
  contentDiv.innerHTML = `
    <pre class="bg-gray-950 p-3 rounded-lg overflow-x-auto text-xs text-gray-300 max-h-64 overflow-y-auto border border-gray-700 mt-2"><code>${content}</code></pre>
  `;
  contentDiv.classList.remove('hidden');
}

// API Endpoints tab - shows endpoints and which ones use non-existent tables
let apiEndpointsData = null;
let currentEndpointConnection = 'db1';
let currentEndpointFilter = 'all';

async function loadApiEndpoints(connection = currentEndpointConnection, filter = currentEndpointFilter) {
  currentEndpointConnection = connection;
  currentEndpointFilter = filter;
  const content = document.getElementById('tab-content');
  
  // Only show loading if we don't have data yet
  if (!apiEndpointsData || apiEndpointsData.connection !== connection) {
    content.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="text-gray-400 mt-2">Checking endpoints...</p></div>';
    
    try {
      const res = await fetch(`/api/api-endpoints?connection=${connection}`);
      apiEndpointsData = await res.json();
    } catch (e) {
      content.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
      return;
    }
  }
  
  const data = apiEndpointsData;
  const selectedName = connection === 'db1' ? db1Name : db2Name;
  
  // Filter endpoints
  let filteredEndpoints = data.endpoints;
  if (filter === 'ok') filteredEndpoints = data.endpoints.filter(e => e.status === 'ok');
  else if (filter === 'has-missing') filteredEndpoints = data.endpoints.filter(e => e.status === 'has-missing');
  
  let html = `
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold">📡 API Endpoints</h2>
      <button onclick="apiEndpointsData = null; loadApiEndpoints(currentEndpointConnection, currentEndpointFilter)" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1">
        <span>🔄</span> Refresh
      </button>
    </div>
    <p class="text-gray-400 mb-4">Check which endpoints use non-existent tables</p>
    
    <!-- Connection Selector -->
    <div class="mb-6">
      <label class="text-sm text-gray-400 mr-2">Check against:</label>
      <select onchange="apiEndpointsData=null; loadApiEndpoints(this.value)" class="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
        <option value="db1" ${connection === 'db1' ? 'selected' : ''}>${db1Name}</option>
        <option value="db2" ${connection === 'db2' ? 'selected' : ''}>${db2Name}</option>
      </select>
    </div>
    
    <!-- Legend -->
    <div class="flex flex-wrap gap-4 mb-4 text-sm">
      <div class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-green-600"></span> All tables exist</div>
      <div class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-red-600"></span> Has missing table(s)</div>
    </div>
    
    <!-- Summary Cards (Clickable Filters) -->
    <div class="grid grid-cols-3 gap-3 mb-6">
      <div onclick="loadApiEndpoints('${connection}', 'all')" class="cursor-pointer bg-gray-700 rounded p-3 text-center transition hover:bg-gray-600 ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}">
        <div class="text-xl font-bold text-white">${data.total}</div>
        <div class="text-xs text-gray-400">All Endpoints</div>
      </div>
      <div onclick="loadApiEndpoints('${connection}', 'ok')" class="cursor-pointer bg-green-900/40 rounded p-3 text-center transition hover:bg-green-900/60 ${filter === 'ok' ? 'ring-2 ring-green-500' : ''}">
        <div class="text-xl font-bold text-green-400">${data.ok}</div>
        <div class="text-xs text-gray-400">✓ All Tables Exist</div>
      </div>
      <div onclick="loadApiEndpoints('${connection}', 'has-missing')" class="cursor-pointer bg-red-900/40 rounded p-3 text-center transition hover:bg-red-900/60 ${filter === 'has-missing' ? 'ring-2 ring-red-500' : ''}">
        <div class="text-xl font-bold text-red-400">${data.hasMissing}</div>
        <div class="text-xs text-gray-400">✗ Has Missing Tables</div>
      </div>
    </div>
    
    <p class="text-gray-400 mb-4">Click an endpoint to expand/collapse details:</p>
    <div class="space-y-2">
  `;
  
  for (let i = 0; i < filteredEndpoints.length; i++) {
    const ep = filteredEndpoints[i];
    const statusClass = ep.status === 'ok' 
      ? 'border-l-4 border-green-500 bg-green-900/20 hover:bg-green-900/30' 
      : 'border-l-4 border-red-500 bg-red-900/20 hover:bg-red-900/30';
    const statusIcon = ep.status === 'ok' ? '✅' : '❌';
    const missingBadge = ep.missingTables.length > 0 
      ? `<span class="text-xs bg-red-700 text-white px-2 py-0.5 rounded">${ep.missingTables.length} missing</span>` 
      : '';
    const detailId = `ep-detail-${i}`;
    
    html += `
      <div>
        <div onclick="toggleEndpointDetails('${detailId}', ${i})" 
             class="p-3 rounded cursor-pointer transition ${statusClass}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span>${statusIcon}</span>
              <span class="font-medium text-gray-200">${ep.fileName}</span>
              ${missingBadge}
            </div>
            <span class="text-gray-500 text-xs">${ep.totalTables} tables</span>
          </div>
        </div>
        <div id="${detailId}" class="hidden"></div>
      </div>
    `;
  }
  
  if (filteredEndpoints.length === 0) {
    html += `<div class="text-gray-500 italic py-4">No endpoints match this filter</div>`;
  }
  
  html += `</div>`;
  content.innerHTML = html;
  
  // Store data for details view
  window.apiEndpointsDataStore = data.endpoints;
  window.filteredEndpointsStore = filteredEndpoints;
}

// Toggle endpoint details inline
let currentOpenEndpoint = null;

function toggleEndpointDetails(detailId, index) {
  const detailsDiv = document.getElementById(detailId);
  
  // If clicking same endpoint, collapse it
  if (currentOpenEndpoint === detailId) {
    detailsDiv.classList.add('hidden');
    detailsDiv.innerHTML = '';
    currentOpenEndpoint = null;
    return;
  }
  
  // Close previous open endpoint
  if (currentOpenEndpoint) {
    const prevDiv = document.getElementById(currentOpenEndpoint);
    if (prevDiv) {
      prevDiv.classList.add('hidden');
      prevDiv.innerHTML = '';
    }
  }
  
  currentOpenEndpoint = detailId;
  const endpoint = window.filteredEndpointsStore[index];
  
  if (!endpoint) {
    detailsDiv.innerHTML = '<div class="text-red-400 p-2">Endpoint not found</div>';
    detailsDiv.classList.remove('hidden');
    return;
  }
  
  const selectedName = currentEndpointConnection === 'db1' ? db1Name : db2Name;
  
  let html = `
    <div class="fade-in bg-gray-900 rounded-lg p-4 border border-gray-700 mt-2 mb-2">
      <div class="flex justify-between items-start mb-3">
        <div>
          <p class="text-gray-500 text-xs">${endpoint.filePath}</p>
        </div>
        <span onclick="toggleEndpointDetails('${detailId}', ${index})" class="text-gray-500 hover:text-white cursor-pointer text-sm">✕ Close</span>
      </div>
      
      <!-- Tables Summary -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h4 class="text-sm font-semibold text-green-400 mb-2">✓ Existing (${endpoint.existingTables.length})</h4>
          <div class="flex flex-wrap gap-1">
            ${endpoint.existingTables.length > 0 
              ? endpoint.existingTables.map(t => `<span class="text-xs bg-green-700 text-white px-2 py-1 rounded">${t}</span>`).join('') 
              : '<span class="text-gray-500 text-sm">None</span>'}
          </div>
        </div>
        <div>
          <h4 class="text-sm font-semibold text-red-400 mb-2">✗ Missing (${endpoint.missingTables.length})</h4>
          <div class="flex flex-wrap gap-1">
            ${endpoint.missingTables.length > 0 
              ? endpoint.missingTables.map(t => `<span class="text-xs bg-red-700 text-white px-2 py-1 rounded">${t}</span>`).join('') 
              : '<span class="text-gray-500 text-sm">None</span>'}
          </div>
        </div>
      </div>
      
      <!-- File Content -->
      <h4 class="text-sm font-semibold text-gray-400 mb-2">File Content:</h4>
  `;
  
  // Escape HTML
  let content = escapeHtml(endpoint.fileContent);
  
  // Highlight missing tables in red
  for (const table of endpoint.missingTables) {
    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    content = content.replace(regex, '<mark class="bg-red-500 text-white px-1 rounded">$1</mark>');
  }
  
  // Highlight existing tables in green
  for (const table of endpoint.existingTables) {
    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    content = content.replace(regex, '<mark class="bg-green-600 text-white px-1 rounded">$1</mark>');
  }
  
  html += `
      <pre class="bg-gray-950 p-4 rounded-lg overflow-x-auto text-sm text-gray-300 max-h-64 overflow-y-auto border border-gray-700"><code>${content}</code></pre>
    </div>
  `;
  
  detailsDiv.innerHTML = html;
  detailsDiv.classList.remove('hidden');
}

// Ensure the global loadTables and loadApiTables exist 
async function loadApiTables() {
  const content = document.getElementById('tab-content');
  
  if (!tablesData) {
    await loadTables();
  }
  
  content.innerHTML = '<div class="text-center py-8"><div class="loader mx-auto"></div><p class="text-gray-400 mt-2">Analyzing API files...</p></div>';
  
  try {
    const res = await fetch('/api/api-tables');
    const data = await res.json();
    
    let html = `
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">📂 DB Tables Usage in API</h2>
        <button onclick="loadApiTables()" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1">
          <span>🔄</span> Refresh
        </button>
      </div>
      <p class="text-gray-400 mb-6">This shows which tables from your databases are actually used in the API files.</p>
    `;
    
    // Create DB1 section
    const db1TablesInApi = data.db1.filter(t => t.inApi);
    const db1TablesNotInApi = data.db1.filter(t => !t.inApi);
    
    html += `
      <div class="mb-8 p-4 bg-gray-800 rounded-lg border-l-4 border-db1">
        <h3 class="text-lg font-bold text-db1 mb-3">${db1Name}</h3>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="bg-gray-900 rounded p-3">
            <div class="text-sm text-gray-400">Total Tables</div>
            <div class="text-xl font-bold">${data.db1.length}</div>
          </div>
          <div class="bg-gray-900 rounded p-3">
            <div class="text-sm text-gray-400">Used in API</div>
            <div class="text-xl font-bold text-green-400">${db1TablesInApi.length}</div>
          </div>
        </div>
        
        <h4 class="text-sm font-semibold text-gray-400 mb-2 mt-4">Used in API (${db1TablesInApi.length}):</h4>
        <div class="flex flex-wrap gap-2 mb-4">
          ${db1TablesInApi.map(t => `
            <div class="w-full">
              <button onclick="toggleTableEndpoints('${t.name}', 'db1')" id="btn-${t.name.replace(/\./g, '-')}" class="w-full text-left px-3 py-2 rounded bg-green-900/40 hover:bg-green-900/60 text-sm border border-green-800/50 flex justify-between items-center transition-colors">
                <span>${t.name}</span>
                <span class="text-xs bg-green-800 px-2 py-0.5 rounded text-green-100">${t.apiCount} endpoint${t.apiCount !== 1 ? 's' : ''}</span>
              </button>
              <div id="detail-section-${t.name.replace(/\./g, '-')}" class="hidden mt-2 mb-4"></div>
            </div>
          `).join('') || '<span class="text-gray-500 text-sm">None</span>'}
        </div>
        
        <h4 class="text-sm font-semibold text-gray-400 mb-2 mt-4">NOT Used in API (${db1TablesNotInApi.length}):</h4>
        <div class="flex flex-wrap gap-2">
          ${db1TablesNotInApi.map(t => `<span class="px-2 py-1 rounded bg-gray-700 text-gray-400 text-xs">${t.name}</span>`).join('') || '<span class="text-gray-500 text-sm">None</span>'}
        </div>
      </div>
    `;
    
    // Create DB2 section
    const db2TablesInApi = data.db2.filter(t => t.inApi);
    const db2TablesNotInApi = data.db2.filter(t => !t.inApi);
    
    html += `
      <div class="p-4 bg-gray-800 rounded-lg border-l-4 border-db2">
        <h3 class="text-lg font-bold text-db2 mb-3">${db2Name}</h3>
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="bg-gray-900 rounded p-3">
            <div class="text-sm text-gray-400">Total Tables</div>
            <div class="text-xl font-bold">${data.db2.length}</div>
          </div>
          <div class="bg-gray-900 rounded p-3">
            <div class="text-sm text-gray-400">Used in API</div>
            <div class="text-xl font-bold text-green-400">${db2TablesInApi.length}</div>
          </div>
        </div>
        
        <h4 class="text-sm font-semibold text-gray-400 mb-2 mt-4">Used in API (${db2TablesInApi.length}):</h4>
        <div class="flex flex-wrap gap-2 mb-4">
          ${db2TablesInApi.map(t => `
            <div class="w-full">
              <button onclick="toggleTableEndpoints('${t.name}', 'db2')" id="btn-${t.name.replace(/\./g, '-')}" class="w-full text-left px-3 py-2 rounded bg-green-900/40 hover:bg-green-900/60 text-sm border border-green-800/50 flex justify-between items-center transition-colors">
                <span>${t.name}</span>
                <span class="text-xs bg-green-800 px-2 py-0.5 rounded text-green-100">${t.apiCount} endpoint${t.apiCount !== 1 ? 's' : ''}</span>
              </button>
              <div id="detail-section-${t.name.replace(/\./g, '-')}" class="hidden mt-2 mb-4"></div>
            </div>
          `).join('') || '<span class="text-gray-500 text-sm">None</span>'}
        </div>
        
        <h4 class="text-sm font-semibold text-gray-400 mb-2 mt-4">NOT Used in API (${db2TablesNotInApi.length}):</h4>
        <div class="flex flex-wrap gap-2">
          ${db2TablesNotInApi.map(t => `<span class="px-2 py-1 rounded bg-gray-700 text-gray-400 text-xs">${t.name}</span>`).join('') || '<span class="text-gray-500 text-sm">None</span>'}
        </div>
      </div>
    `;
    
    content.innerHTML = html;
    
  } catch (e) {
    content.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
  }
}
