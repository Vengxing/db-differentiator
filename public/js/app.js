let currentTab = 'tables';
let db1Name = 'DB1';
let db2Name = 'DB2';
let tablesData = null; // Global tables data

// Helper to escape HTML to prevent XSS in displayed data
window.escapeHtml = function(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Helper to format cell value
window.formatCellValue = function(val) {
  if (val === null) return '<em class="text-gray-500">NULL</em>';
  if (val === '') return '<em class="text-gray-500">Empty String</em>';
  if (typeof val === 'object') return escapeHtml(JSON.stringify(val));
  return escapeHtml(String(val));
};

// Helper to copy text to clipboard
window.copyQuery = function(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.innerText;
    btn.innerText = 'Copied!';
    btn.classList.add('bg-green-700');
    btn.classList.remove('bg-gray-700');
    setTimeout(() => {
      btn.innerText = originalText;
      btn.classList.remove('bg-green-700');
      btn.classList.add('bg-gray-700');
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
};

// Initialize
async function init() {
  await loadConnectionInfo();
  await testConnection();
  await loadTables();
}

// Load connection info
async function loadConnectionInfo() {
  try {
    const res = await fetch('/api/connections');
    const data = await res.json();
    
    db1Name = data.db1.displayName;
    db2Name = data.db2.displayName;
    
    // Update header titles with aliases
    document.getElementById('db1-title').innerHTML = `📊 ${db1Name} <span class="text-gray-500 text-sm">(Source)</span>`;
    document.getElementById('db2-title').innerHTML = `📊 ${db2Name} <span class="text-gray-500 text-sm">(Target)</span>`;
    
    document.getElementById('db1-info').innerHTML = `
      <div><span class="text-gray-500">Host:</span> ${data.db1.host}</div>
      <div><span class="text-gray-500">Port:</span> ${data.db1.port}</div>
      <div><span class="text-gray-500">Database:</span> <strong>${data.db1.database}</strong></div>
      <div><span class="text-gray-500">User:</span> ${data.db1.user}</div>
    `;
    document.getElementById('db2-info').innerHTML = `
      <div><span class="text-gray-500">Host:</span> ${data.db2.host}</div>
      <div><span class="text-gray-500">Port:</span> ${data.db2.port}</div>
      <div><span class="text-gray-500">Database:</span> <strong>${data.db2.database}</strong></div>
      <div><span class="text-gray-500">User:</span> ${data.db2.user}</div>
    `;
  } catch (e) {
    console.error(e);
  }
}

// Test connection
async function testConnection() {
  const statusDiv = document.getElementById('connection-status');
  statusDiv.innerHTML = '<div class="loader"></div> <span class="text-gray-400 ml-2">Testing connections...</span>';
  
  try {
    const res = await fetch('/api/test-connection');
    const data = await res.json();
    
    if (data.success) {
      statusDiv.innerHTML = '<span class="text-green-400 font-medium">✓ Connected to both databases</span>';
    } else {
      statusDiv.innerHTML = `<span class="text-red-400 font-medium">✗ ${data.message}</span>`;
    }
  } catch (e) {
    statusDiv.innerHTML = `<span class="text-red-400 font-medium">✗ Connection failed: ${e.message}</span>`;
  }
}

// Show tab
window.showTab = function(tab) {
  currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white');
    btn.classList.add('bg-gray-700', 'text-gray-300');
  });
  document.getElementById(`tab-${tab}`).classList.remove('bg-gray-700', 'text-gray-300');
  document.getElementById(`tab-${tab}`).classList.add('bg-blue-600', 'text-white');
  
  // Load content
  switch(tab) {
    case 'tables': loadTables(); break;
    case 'schemas': loadSchemas(); break;
    case 'counts': loadCounts(); break;
    case 'pks': loadPKs(); break;
    case 'rows': loadRows(); break;
    case 'indexes': loadIndexes(); break;
    case 'api-tables': loadApiTables(); break;
    case 'api-endpoints': loadApiEndpoints(); break;
    case 'flow-table': loadFlowTable(); break;
  }
}
