let flowState = {
  db: null,
  table: null,
  columns: [],
  primaryKeys: [],
  flowTableName: ''
};

async function loadFlowTable() {
  const content = document.getElementById('tab-content');
  content.innerHTML = `
    <div class="fade-in">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold">🌊 Flow Table Generator</h2>
      </div>

      <!-- Step 1: Select DB -->
      <div class="mb-6">
        <p class="text-gray-400 text-sm mb-3">Step 1 — Select a database:</p>
        <div class="flex gap-3">
          <button onclick="flowSelectDb('db1')" id="flow-btn-db1"
            class="px-5 py-2 rounded-lg border-2 border-db1 text-db1 font-semibold hover:bg-db1 hover:text-gray-900 transition-colors">
            📊 ${db1Name}
          </button>
          <button onclick="flowSelectDb('db2')" id="flow-btn-db2"
            class="px-5 py-2 rounded-lg border-2 border-db2 text-db2 font-semibold hover:bg-db2 hover:text-gray-900 transition-colors">
            📊 ${db2Name}
          </button>
        </div>
      </div>

      <!-- Step 2: Table list (populated after DB selection) -->
      <div id="flow-table-list" class="mb-6"></div>

      <!-- Step 3: Column config panel (shown after table selection) -->
      <div id="flow-config-panel" class="mb-6"></div>

      <!-- Step 4: Generated SQL output -->
      <div id="flow-sql-output"></div>
    </div>
  `;
}

async function flowSelectDb(db) {
  flowState.db = db;
  flowState.table = null;
  flowState.columns = [];

  // Highlight selected DB button
  ['db1', 'db2'].forEach(d => {
    const btn = document.getElementById(`flow-btn-${d}`);
    if (!btn) return;
    if (d === db) {
      btn.classList.add('bg-opacity-20');
      const color = d === 'db1' ? 'bg-cyan-700' : 'bg-purple-700';
      btn.classList.add(color, 'text-white');
    } else {
      btn.classList.remove('bg-cyan-700', 'bg-purple-700', 'text-white');
    }
  });

  const listDiv = document.getElementById('flow-table-list');
  const configPanel = document.getElementById('flow-config-panel');
  const sqlOutput = document.getElementById('flow-sql-output');
  listDiv.innerHTML = '<div class="loader inline-block mr-2"></div><span class="text-gray-400">Loading tables...</span>';
  configPanel.innerHTML = '';
  sqlOutput.innerHTML = '';

  try {
    const res = await fetch(`/api/flow/tables?db=${db}`);
    const data = await res.json();

    const colorClass = db === 'db1' ? 'text-db1' : 'text-db2';
    const dbLabel = db === 'db1' ? db1Name : db2Name;

    let html = `
      <p class="text-gray-400 text-sm mb-3">Step 2 — Select a table from <span class="${colorClass} font-semibold">${dbLabel}</span> (${data.tables.length} tables):</p>
      <div class="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
    `;

    for (const t of data.tables) {
      html += `<button onclick="flowSelectTable('${t.replace(/'/g, "\\'")}')"
        class="flow-table-btn px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
        id="flow-tbl-${CSS.escape(t)}">${t}</button>`;
    }
    html += '</div>';
    listDiv.innerHTML = html;
  } catch (e) {
    listDiv.innerHTML = `<div class="text-red-400">Error loading tables: ${e.message}</div>`;
  }
}

async function flowSelectTable(tableName) {
  flowState.table = tableName;

  // Highlight selected table button
  document.querySelectorAll('.flow-table-btn').forEach(b => {
    b.classList.remove('bg-blue-700', 'text-white');
    b.classList.add('bg-gray-700');
  });
  const selBtn = document.getElementById(`flow-tbl-${CSS.escape(tableName)}`);
  if (selBtn) {
    selBtn.classList.remove('bg-gray-700');
    selBtn.classList.add('bg-blue-700', 'text-white');
  }

  const configPanel = document.getElementById('flow-config-panel');
  const sqlOutput = document.getElementById('flow-sql-output');
  configPanel.innerHTML = '<div class="loader inline-block mr-2"></div><span class="text-gray-400">Loading columns...</span>';
  sqlOutput.innerHTML = '';

  try {
    const res = await fetch(`/api/flow/columns?db=${flowState.db}&table=${encodeURIComponent(tableName)}`);
    const data = await res.json();
    flowState.columns = data.columns;
    flowState.primaryKeys = data.primaryKeys;
    flowState.flowTableName = tableName + '_flow';
    renderFlowConfigPanel();
  } catch (e) {
    configPanel.innerHTML = `<div class="text-red-400">Error loading columns: ${e.message}</div>`;
  }
}

function renderFlowConfigPanel() {
  const configPanel = document.getElementById('flow-config-panel');
  const { table, columns, primaryKeys, flowTableName } = flowState;

  const pkBadges = primaryKeys.length > 0
    ? primaryKeys.map(pk => `<span class="inline-block bg-yellow-800 text-yellow-200 text-xs px-2 py-0.5 rounded mr-1">${pk}</span>`).join('')
    : '<span class="text-gray-500 text-xs">none detected</span>';

  let colRows = '';
  for (const col of columns) {
    const pkMark = col.isPrimary
      ? '<span class="text-yellow-400 ml-1" title="Primary Key">🔑</span>'
      : '';
    colRows += `
      <label class="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-gray-700/50 cursor-pointer">
        <input type="checkbox" class="flow-col-checkbox w-4 h-4 accent-blue-500"
          data-field="${escapeHtml(col.field)}" checked>
        <span class="font-mono text-sm text-gray-200">${escapeHtml(col.field)}${pkMark}</span>
        <span class="text-xs text-gray-500">${escapeHtml(col.type)}${col.nullable ? '' : ' NOT NULL'}</span>
      </label>
    `;
  }

  configPanel.innerHTML = `
    <div class="border border-gray-700 rounded-lg p-5 bg-gray-900/50">
      <h3 class="text-lg font-semibold mb-4">Step 3 — Configure Flow Table for
        <span class="text-blue-400">${escapeHtml(table)}</span>
      </h3>

      <div class="mb-5">
        <label class="text-gray-400 text-sm block mb-1">Flow table name:</label>
        <input id="flow-table-name-input" type="text" value="${escapeHtml(flowTableName)}"
          class="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm w-full max-w-sm focus:border-blue-500 outline-none"
          oninput="flowState.flowTableName = this.value">
      </div>

      <div class="mb-2 flex items-center justify-between">
        <div class="text-gray-400 text-sm">
          Columns to include (detected PKs: ${pkBadges}):
        </div>
        <div class="flex gap-2 text-sm">
          <button onclick="flowToggleAllCols(true)" class="text-blue-400 hover:underline">Check all</button>
          <span class="text-gray-600">|</span>
          <button onclick="flowToggleAllCols(false)" class="text-blue-400 hover:underline">Uncheck all</button>
        </div>
      </div>

      <div class="bg-gray-800 rounded-lg p-3 max-h-72 overflow-y-auto mb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4">
        ${colRows}
      </div>

      <div class="mt-4 p-3 bg-gray-800 rounded text-sm text-gray-400 border border-gray-700">
        <span class="text-gray-300 font-semibold">4 extra columns will be added automatically:</span>
        <div class="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div class="bg-gray-900 rounded p-2"><code class="text-green-400">flow_uid</code><br><span>INT PK AUTO_INCREMENT</span></div>
          <div class="bg-gray-900 rounded p-2"><code class="text-green-400">flow_create_time</code><br><span>DATETIME DEFAULT CURRENT_TIMESTAMP</span></div>
          <div class="bg-gray-900 rounded p-2"><code class="text-green-400">flow_update_time</code><br><span>DATETIME ON UPDATE CURRENT_TIMESTAMP</span></div>
          <div class="bg-gray-900 rounded p-2"><code class="text-green-400">flow_action_type</code><br><span>VARCHAR(10)</span></div>
        </div>
      </div>

      <button onclick="flowGenerateSQL()"
        class="mt-5 px-6 py-2 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors">
        ⚡ Generate SQL
      </button>
    </div>
  `;
}

function flowToggleAllCols(checked) {
  document.querySelectorAll('.flow-col-checkbox').forEach(cb => cb.checked = checked);
}

function flowGetSelectedColumns() {
  return [...document.querySelectorAll('.flow-col-checkbox')]
    .filter(cb => cb.checked)
    .map(cb => cb.dataset.field);
}

function flowGenerateSQL() {
  const { table, columns, primaryKeys, db } = flowState;
  const flowTableName = document.getElementById('flow-table-name-input').value.trim() || table + '_flow';
  const selectedFields = flowGetSelectedColumns();

  if (selectedFields.length === 0) {
    alert('Please select at least one column.');
    return;
  }

  const selectedCols = columns.filter(c => selectedFields.includes(c.field));

  // ── 1. BUILD CREATE TABLE ──────────────────────────────────────────────
  const colDefs = selectedCols.map(col => {
    let def = `  \`${col.field}\` ${col.type}`;
    if (!col.nullable) def += ' NOT NULL';
    if (col.default !== null && col.default !== undefined) {
      const defVal = col.default;
      if (defVal === 'CURRENT_TIMESTAMP' || defVal === 'current_timestamp()') {
        def += ` DEFAULT CURRENT_TIMESTAMP`;
      } else {
        def += ` DEFAULT '${defVal}'`;
      }
    }
    if (col.extra && col.extra !== 'auto_increment') def += ` ${col.extra.toUpperCase()}`;
    return def;
  });

  const createTableSQL =
`CREATE TABLE \`${flowTableName}\` (
  \`flow_uid\` INT NOT NULL AUTO_INCREMENT,
${colDefs.join(',\n')},
  \`flow_create_time\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`flow_update_time\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  \`flow_action_type\` VARCHAR(10) NOT NULL,
  PRIMARY KEY (\`flow_uid\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

  // ── 2. BUILD TRIGGERS ──────────────────────────────────────────────────
  const colList = selectedFields.map(f => `\`${f}\``).join(', ');
  const newValList = selectedFields.map(f => `NEW.\`${f}\``).join(', ');
  const oldValList = selectedFields.map(f => `OLD.\`${f}\``).join(', ');

  // INSERT trigger
  const insertTriggerSQL =
`CREATE TRIGGER \`${table}_after_insert\`
AFTER INSERT ON \`${table}\`
FOR EACH ROW
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;

  INSERT INTO \`${flowTableName}\` (
    ${colList},
    \`flow_action_type\`
  )
  VALUES (
    ${newValList},
    'INSERT'
  );
END`;

  // DELETE trigger
  const deleteTriggerSQL =
`CREATE TRIGGER \`${table}_after_delete\`
AFTER DELETE ON \`${table}\`
FOR EACH ROW
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;

  INSERT INTO \`${flowTableName}\` (
    ${colList},
    \`flow_action_type\`
  )
  VALUES (
    ${oldValList},
    'DELETE'
  );
END`;

  // UPDATE trigger — detect PK change dynamically
  const dataUnchangedCondition = selectedFields
    .map(f => `OLD.\`${f}\` <=> NEW.\`${f}\``)
    .join(' AND ');

  let updateTriggerSQL;
  if (primaryKeys.length > 0) {
    // Build PK change condition: OLD.pk1 != NEW.pk1 OR OLD.pk2 != NEW.pk2 ...
    const pkChangedCondition = primaryKeys
      .map(pk => `OLD.\`${pk}\` != NEW.\`${pk}\``)
      .join(' OR ');

    updateTriggerSQL =
`CREATE TRIGGER \`${table}_after_update\`
AFTER UPDATE ON \`${table}\`
FOR EACH ROW
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;

  IF ${dataUnchangedCondition} THEN
    -- No tracked columns changed, do nothing
    BEGIN END;
  ELSEIF ${pkChangedCondition} THEN
    -- PK changed: treat as DELETE of old + INSERT of new
    INSERT INTO \`${flowTableName}\` (
      ${colList},
      \`flow_action_type\`
    )
    VALUES (
      ${oldValList},
      'DELETE'
    );

    INSERT INTO \`${flowTableName}\` (
      ${colList},
      \`flow_action_type\`
    )
    VALUES (
      ${newValList},
      'INSERT'
    );

  ELSE
    -- Normal update, PK unchanged
    INSERT INTO \`${flowTableName}\` (
      ${colList},
      \`flow_action_type\`
    )
    VALUES (
      ${newValList},
      'UPDATE'
    );
  END IF;
END`;
  } else {
    // No PK detected — simple update without PK-change detection
    updateTriggerSQL =
`CREATE TRIGGER \`${table}_after_update\`
AFTER UPDATE ON \`${table}\`
FOR EACH ROW
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;

  -- Note: No primary key detected on this table; PK-change detection skipped
  IF ${dataUnchangedCondition} THEN
    -- No tracked columns changed, do nothing
    BEGIN END;
  ELSE
    INSERT INTO \`${flowTableName}\` (
      ${colList},
      \`flow_action_type\`
    )
    VALUES (
      ${newValList},
      'UPDATE'
    );
  END IF;
END`;
  }

  // ── 3. RENDER OUTPUT ───────────────────────────────────────────────────
  const blocks = [
    { label: '① CREATE TABLE', emoji: '🏗️', sql: createTableSQL, id: 'flow-sql-create' },
    { label: '② INSERT Trigger', emoji: '✅', sql: insertTriggerSQL, id: 'flow-sql-insert' },
    { label: '③ DELETE Trigger', emoji: '🗑️', sql: deleteTriggerSQL, id: 'flow-sql-delete' },
    { label: '④ UPDATE Trigger', emoji: '✏️', sql: updateTriggerSQL, id: 'flow-sql-update' }
  ];

  const dbLabel = db === 'db2' ? db2Name : db1Name;
  const pkInfo = primaryKeys.length > 0
    ? `Detected PKs: <span class="text-yellow-400">${primaryKeys.map(p => `\`${p}\``).join(', ')}</span>`
    : '<span class="text-gray-500">No primary key detected</span>';

  let html = `
    <div class="fade-in border-t border-gray-700 pt-6 mt-6">
      <div class="flex justify-between items-center mb-1">
        <h3 class="text-lg font-semibold">Generated SQL for
          <span class="text-blue-400">${escapeHtml(table)}</span>
          → <span class="text-green-400">${escapeHtml(flowTableName)}</span>
        </h3>
        <span class="text-xs text-gray-500">DB: ${dbLabel} · ${pkInfo}</span>
      </div>
      <p class="text-yellow-400 text-sm mb-5">⚠ These queries are for review only — nothing has been executed.</p>
  `;

  for (const block of blocks) {
    const escaped = escapeHtml(block.sql);
    html += `
      <div class="mb-6">
        <div class="flex justify-between items-center mb-2">
          <h4 class="font-semibold text-gray-200">${block.emoji} ${block.label}</h4>
          <button onclick="window.copyQuery(this, document.getElementById('${block.id}').innerText)"
            class="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-gray-300 transition-colors">
            📋 Copy
          </button>
        </div>
        <pre id="${block.id}" class="bg-black p-4 rounded-lg text-xs text-gray-300 overflow-x-auto border border-gray-700 whitespace-pre">${escaped}</pre>
      </div>
    `;
  }

  html += `</div>`;
  document.getElementById('flow-sql-output').innerHTML = html;

  // Scroll to the output
  document.getElementById('flow-sql-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
