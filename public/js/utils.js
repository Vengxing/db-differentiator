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

// Format cell value for display
function formatCellValue(val) {
  if (val === null || val === undefined) return '<span class="text-gray-500">NULL</span>';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'object') return JSON.stringify(val).substring(0, 30);
  const str = String(val);
  if (str.length > 40) return escapeHtml(str.substring(0, 40)) + '...';
  return escapeHtml(str);
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Truncate string
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}
