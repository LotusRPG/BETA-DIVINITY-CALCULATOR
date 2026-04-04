/**
 * app.js — Divinity Config Builder application core.
 *
 * Public API (APP.*):
 *   navigate(sectionId)
 *   filterTable(tableId, query)
 *
 *   downloadAllJson()                         — export all loaded sections as one JSON file
 *   importJson(file)                          — restore all sections from a JSON snapshot
 *   pickDirectory()                           — open directory picker for auto-save (Chrome/Edge)
 *   setAutoSaveInterval(minutes)              — 0 = disabled
 *   setAutoSaveFormat(format)                 — 'yaml' | 'json'
 *   autoSaveNow()                             — trigger immediate save
 *
 *   updateField(sid, path, value)           — edit any scalar
 *   updateFormulaExpr(sid, path, value)     — edit formula + recalc preview
 *   setFormulaMode(sid, mode)               — switch FACTOR/CUSTOM/LEGACY
 *   setPreviewDmg(v) / setPreviewDef(v)     — update custom preview row
 *   recalcFormulaPreview()                  — refresh preview cells in-place
 *
 *   updateJsonField(sid, path, jsonText)    — parse JSON, write array/object back to STATE
 *
 *   addEntry(sid, key, template)            — add top-level entry, re-renders
 *   removeEntry(sid, key)                   — delete top-level entry
 *   renameEntry(sid, oldKey, newKey)        — rename top-level key
 *
 *   download(sectionId)                     — serialize STATE → YAML download
 *   onDragOver / onDragLeave / onDrop / onFileInput
 */

'use strict';

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

/** Parsed YAML per section. */
const STATE = { loaded: {}, errors: {} };

/**
 * Keys added during the last sync operation (per section).
 * Used by renderers to show a "new" badge on freshly synced entries.
 * @type {Record<string, Set<string>>}
 */
const SYNCED_NEW = {};

/**
 * Custom formula-preview row values (persisted across formula re-renders).
 */
const FORMULA_PREVIEW = { dmgIn: 100, defIn: 50 };

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
    return o[k];
  }, obj);
  target[last] = value;
}

/** Count top-level object entries (for nav badges). */
function countEntries(data) {
  if (!data || typeof data !== 'object') return 0;
  if (data._multiFile) return Object.keys(data.files || {}).length;
  return Object.values(data).filter(v => v && typeof v === 'object').length;
}

/** Load one YAML file into a multiFile section's files map. */
async function loadMultiFile(sid, file) {
  if (!STATE.loaded[sid] || !STATE.loaded[sid]._multiFile) {
    STATE.loaded[sid] = { _multiFile: true, files: {} };
  }
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => {
      try {
        STATE.loaded[sid].files[file.name] = YAML.parse(e.target.result);
        delete STATE.errors[sid];
      } catch (err) {
        STATE.errors[sid] = err.message;
      }
      resolve();
    };
    r.onerror = () => { STATE.errors[sid] = 'Could not read file.'; resolve(); };
    r.readAsText(file, 'UTF-8');
  });
}

/** Coerce value to match the existing type at path. */
function coerce(existing, value) {
  if (typeof existing === 'boolean') return Boolean(value);
  if (typeof existing === 'number')  { const n = Number(value); return isNaN(n) ? existing : n; }
  return value;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderSection(sectionId) {
  const content = document.getElementById('content');
  if (sectionId === 'load')     { content.innerHTML = buildLoadSection();     refreshAutoSaveStatus(); return; }
  if (sectionId === 'settings') { content.innerHTML = buildSettingsSection(); refreshAutoSaveStatus(); return; }

  const def = SCHEMA.sections[sectionId];
  if (!def) {
    content.innerHTML = `<div class="alert alert-error">Unknown section: ${sectionId}</div>`;
    return;
  }

  let html = `
    <div class="section-header">
      <div class="section-title">${def.icon} ${def.label}</div>
      ${def.description ? `<div class="section-desc">${def.description}</div>` : ''}
    </div>`;

  if (STATE.loaded[sectionId] && def.file) {
    const fname = def.file.split('/').pop();
    html += `
      <div class="section-toolbar">
        <span class="toolbar-hint">✏️ Edit fields directly. Changes are in memory until downloaded.</span>
        <button class="btn-download" onclick="APP.download('${sectionId}')">
          ⬇ Download <code>${fname}</code>
        </button>
      </div>`;
  }

  if (!STATE.loaded[sectionId]) {
    const err = STATE.errors[sectionId];
    html += err
      ? `<div class="alert alert-error">❌ Load error: ${err}
           <div style="margin-top:10px">
             <button class="btn-setting" onclick="APP.createEmpty('${sectionId}')">✨ Start with empty file anyway</button>
           </div>
         </div>`
      : `<div class="empty-state">
           <div style="font-size:36px;margin-bottom:12px">📂</div>
           <div>Load <code>${def.file}</code> in <b>Load Files</b> first.</div>
           <div style="margin-top:14px;color:var(--muted);font-size:13px">— or —</div>
           <button class="btn-setting" style="margin-top:10px"
                   onclick="APP.createEmpty('${sectionId}')">✨ Start with empty file</button>
         </div>`;
    content.innerHTML = html;
    return;
  }

  const rendererFn = RENDERERS[def.renderer];
  if (typeof rendererFn !== 'function') {
    html += `<div class="alert alert-error">Missing renderer: ${def.renderer}</div>`;
    content.innerHTML = html;
    return;
  }

  try {
    html += rendererFn(STATE.loaded[sectionId], sectionId);
  } catch (e) {
    html += `<div class="alert alert-error">❌ Render error: ${e.message}
      <pre style="margin-top:8px;font-size:11px">${e.stack}</pre></div>`;
  }

  content.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Load section
// ---------------------------------------------------------------------------

function buildLoadSection() {
  const defs = Object.values(SCHEMA.sections).filter(s => s.id !== 'load' && s.file);

  const zones = defs.map(def => {
    const isMulti = !!def.multiFile;
    const loadedRaw = STATE.loaded[def.id];
    const fileCount = isMulti && loadedRaw?._multiFile ? Object.keys(loadedRaw.files).length : 0;
    const isLoaded  = isMulti ? fileCount > 0 : !!loadedRaw;
    const hasError  = !!STATE.errors[def.id];
    let statusText = '', statusClass = '';
    if (isLoaded && isMulti)    { statusText = `✅ ${fileCount} file(s)`; statusClass = 'loaded'; }
    else if (isLoaded)          { statusText = '✅ Loaded'; statusClass = 'loaded'; }
    else if (hasError)          { statusText = '❌ Error';  statusClass = 'error';  }

    const loadedFiles = isMulti && loadedRaw?._multiFile ? Object.keys(loadedRaw.files) : [];
    const fileChips   = loadedFiles.length
      ? `<div class="zone-loaded-files">${loadedFiles.map(f => `<span class="zone-file-chip">${f}</span>`).join('')}</div>`
      : '';
    const hintText = isMulti ? `${def.file} (folder — drop files)` : def.file;

    return `
      <div class="file-drop-zone-wrap">
        <label class="file-drop-zone" id="zone-${def.id}"
               ondragover="APP.onDragOver(event,'${def.id}')"
               ondragleave="APP.onDragLeave(event,'${def.id}')"
               ondrop="APP.onDrop(event,'${def.id}')">
          <input type="file" accept=".yml,.yaml"${isMulti ? ' multiple' : ''}
                 onchange="APP.onFileInput(event,'${def.id}')">
          <div class="file-drop-zone__label">
            <span style="font-size:22px">${def.icon}</span>
            <div>
              <div class="file-drop-zone__name">${def.label}</div>
              <div class="file-drop-zone__hint">${hintText}</div>
            </div>
            <span class="file-drop-zone__status ${statusClass}">${statusText}</span>
          </div>
        </label>
        ${fileChips}
        ${!isLoaded ? `<button class="btn-create-empty" title="Start editing without a file"
          onclick="APP.createEmpty('${def.id}');APP.navigate('${def.id}')">✨ Start empty</button>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="section-header">
      <div class="section-title">📂 Load Files</div>
      <div class="section-desc">
        Click a tile or drag-and-drop a YAML file onto it.
        All parsing is local — nothing is sent over the network.
      </div>
    </div>
    <div id="section-load">${zones}</div>`;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

let _activeSection = 'load';

function buildNav() {
  const nav = document.getElementById('nav');
  let html = `<div class="nav-logo">⚔️ Divinity Builder<span>config visualizer & editor</span></div>`;

  SCHEMA.groups.forEach(group => {
    html += `<div class="nav-group">${group.label}</div>`;
    group.sections.forEach(sid => {
      const def = SCHEMA.sections[sid];
      if (!def) return;
      const badge = def.badge !== false
        ? `<span class="nav-badge" id="badge-${sid}"></span>` : '';
      html += `
        <div class="nav-item" id="nav-${sid}" onclick="APP.navigate('${sid}')">
          <span class="nav-icon">${def.icon}</span>
          <span>${def.label}</span>
          ${badge}
        </div>`;
    });
  });

  nav.innerHTML = html;
  updateActiveNav(_activeSection);
}

function updateActiveNav(sid) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${sid}`)?.classList.add('active');
}

function updateBadge(sid) {
  const el = document.getElementById(`badge-${sid}`);
  if (!el) return;
  const count = countEntries(STATE.loaded[sid]);
  el.textContent = count > 0 ? count : '';
}

// ---------------------------------------------------------------------------
// File loading
// ---------------------------------------------------------------------------

function parseAndStore(sid, text) {
  try {
    STATE.loaded[sid] = YAML.parse(text);
    delete STATE.errors[sid];
  } catch (e) {
    delete STATE.loaded[sid];
    STATE.errors[sid] = e.message;
  }
}

function readFile(file, sid) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload  = e => { parseAndStore(sid, e.target.result); resolve(); };
    r.onerror = ()  => { STATE.errors[sid] = 'Could not read file.'; delete STATE.loaded[sid]; resolve(); };
    r.readAsText(file, 'UTF-8');
  });
}

function afterLoad(sid) {
  updateBadge(sid);
  if (_activeSection === 'load') {
    renderSection('load');
  } else if (_activeSection === sid) {
    renderSection(sid);
  } else {
    // Silently refresh zone status indicator
    const statusEl = document.querySelector(`#zone-${sid} .file-drop-zone__status`);
    if (statusEl) {
      statusEl.textContent = STATE.loaded[sid] ? '✅ Loaded' : '❌ Error';
      statusEl.className   = `file-drop-zone__status ${STATE.loaded[sid] ? 'loaded' : 'error'}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const APP = {

  // ---- Navigation ----

  navigate(sid) {
    _activeSection = sid;
    updateActiveNav(sid);
    renderSection(sid);
    document.getElementById('content').scrollTop = 0;
  },

  // ---- Table search ----

  filterTable(tableId, query) {
    const tbl = document.getElementById(tableId);
    if (!tbl) return;
    const q = query.trim().toLowerCase();
    tbl.querySelectorAll('tbody tr').forEach(row => {
      row.style.display = (!q || row.textContent.toLowerCase().includes(q)) ? '' : 'none';
    });
  },

  // ---- Scalar field editing ----

  /**
   * Checkbox that updates STATE and immediately patches the adjacent badge span
   * without re-rendering the whole section.
   *
   * @param {string}  sid
   * @param {string}  path      Dot-path to the boolean field
   * @param {boolean} checked
   * @param {string}  badgeId   DOM id of the <span> badge to patch
   * @param {string}  type      'enabled' | 'percent-pen'
   */
  updateCheckbox(sid, path, checked, badgeId, type) {
    // Write value to STATE
    const data = STATE.loaded[sid];
    if (data) setPath(data, path, checked);

    // Patch badge in-place — no re-render needed
    const el = document.getElementById(badgeId);
    if (!el) return;

    if (type === 'enabled') {
      el.className   = `badge ${checked ? 'badge-green' : 'badge-red'}`;
      el.textContent = checked ? 'enabled' : 'disabled';
    } else if (type === 'percent-pen') {
      el.className   = `badge ${checked ? 'badge-blue' : 'badge-yellow'}`;
      el.textContent = checked ? '% percent' : 'flat';
    }
  },

  updateField(sid, path, value) {
    const data = STATE.loaded[sid];
    if (!data) return;
    const existing = getPath(data, path);
    setPath(data, path, coerce(existing, value));

    // Live-update mc-preview span for format fields
    if (path.endsWith('.format') || path.endsWith('-formula')) {
      document.querySelectorAll('.mc-preview--live').forEach(el => {
        const inp = el.previousElementSibling;
        if (inp?.classList.contains('edit-input--format') && inp.value === String(value)) {
          el.innerHTML = mc.toHtml(String(value));
        }
      });
    }
  },

  // ---- Formula ----

  /**
   * Update formula text in STATE and recalculate preview in-place.
   */
  updateFormulaExpr(sid, path, value) {
    this.updateField(sid, path, value);
    this.recalcFormulaPreview();
  },

  /**
   * Switch formula mode (FACTOR / CUSTOM / LEGACY) and re-render formula section.
   */
  setFormulaMode(sid, mode) {
    const data = STATE.loaded[sid];
    if (!data) return;
    const combat = data.combat || data;
    combat['defense-formula'] = mode;
    combat['legacy-combat']   = mode === 'LEGACY';
    renderSection(sid);
  },

  setPreviewDmg(v) {
    FORMULA_PREVIEW.dmgIn = v;
    this.recalcFormulaPreview();
  },

  setPreviewDef(v) {
    FORMULA_PREVIEW.defIn = v;
    this.recalcFormulaPreview();
  },

  /**
   * Recalculate all formula preview cells without touching the inputs.
   */
  recalcFormulaPreview() {
    const data    = STATE.loaded['formula'];
    if (!data) return;
    const combat  = data.combat || data;
    const mode    = String(combat['defense-formula'] || 'FACTOR').toUpperCase();
    const formula = combat['custom-defense-formula'] || 'damage*(25/(25+defense))';

    // Fixed rows (damage=100, defense varies per case)
    SCHEMA.formulaPreviewCases.forEach((c, i) => {
      const result = evalForMode(mode, formula, c);
      const outEl  = document.getElementById(`preview-out-${i}`);
      const redEl  = document.getElementById(`preview-red-${i}`);
      if (!outEl) return;
      const dmgOut    = result !== null ? result.toFixed(2) : '?';
      const reduction = result !== null ? ((1 - result / c.damage) * 100).toFixed(1) + '%' : '?';
      outEl.textContent = dmgOut;
      outEl.style.color = result !== null && result < c.damage / 2 ? 'var(--green)' : 'var(--red)';
      if (redEl) redEl.textContent = reduction;
    });

    // Custom editable row — reads current input values
    const dmgIn = FORMULA_PREVIEW.dmgIn;
    const defIn = FORMULA_PREVIEW.defIn;
    const res   = evalForMode(mode, formula, { damage: dmgIn, defense: defIn, toughness: 0 });
    const outEl = document.getElementById('custom-dmg-out');
    const redEl = document.getElementById('custom-reduction');
    if (!outEl) return;
    outEl.textContent = res !== null ? res.toFixed(2) : '?';
    outEl.style.color = res !== null && res < dmgIn / 2 ? 'var(--green)' : 'var(--red)';
    if (redEl) redEl.textContent = res !== null ? ((1 - res / dmgIn) * 100).toFixed(1) + '%' : '?';
  },

  // ---- List editors ----

  addListItem(sid, path, value) {
    if (!value || !value.trim()) return;
    const data = STATE.loaded[sid];
    if (!data) return;
    let arr = getPath(data, path);
    if (!Array.isArray(arr)) { arr = []; setPath(data, path, arr); }
    arr.push(value.trim());
    renderSection(_activeSection);
  },

  addListItemFromInput(sid, path, inputId) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    this.addListItem(sid, path, inp.value);
    inp.value = '';
  },

  removeListItem(sid, path, idx) {
    const data = STATE.loaded[sid];
    if (!data) return;
    const arr = getPath(data, path);
    if (!Array.isArray(arr)) return;
    arr.splice(idx, 1);
    renderSection(_activeSection);
  },

  updateListItem(sid, path, idx, value) {
    const data = STATE.loaded[sid];
    if (!data) return;
    const arr = getPath(data, path);
    if (!Array.isArray(arr)) return;
    arr[idx] = value;
    // No re-render needed — input already shows updated value
  },

  // ---- Key-value editors ----

  addKvPairFromInputs(sid, path, keyInputId, valInputId, numVal) {
    const kEl = document.getElementById(keyInputId);
    const vEl = document.getElementById(valInputId);
    if (!kEl || !vEl || !kEl.value.trim()) return;
    const data = STATE.loaded[sid];
    if (!data) return;
    let obj = getPath(data, path);
    if (!obj || typeof obj !== 'object') { obj = {}; setPath(data, path, obj); }
    obj[kEl.value.trim()] = numVal ? (parseFloat(vEl.value) || 0) : vEl.value;
    kEl.value = '';
    vEl.value = '';
    renderSection(_activeSection);
  },

  removeKvPair(sid, path, key) {
    const data = STATE.loaded[sid];
    if (!data) return;
    const obj = getPath(data, path);
    if (obj && typeof obj === 'object') { delete obj[key]; renderSection(_activeSection); }
  },

  renameKvKey(sid, path, oldKey, newKey) {
    if (!newKey.trim() || newKey === oldKey) return;
    const data = STATE.loaded[sid];
    if (!data) return;
    const obj = getPath(data, path);
    if (!obj || typeof obj !== 'object') return;
    obj[newKey.trim()] = obj[oldKey];
    delete obj[oldKey];
    renderSection(_activeSection);
  },

  updateKvVal(sid, path, key, value) {
    const data = STATE.loaded[sid];
    if (!data) return;
    const obj = getPath(data, path);
    if (obj && typeof obj === 'object') obj[key] = value;
  },

  // ---- JSON textarea editor ----

  updateJsonField(sid, path, jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      setPath(STATE.loaded[sid], path, parsed);
    } catch (_) { /* invalid JSON — ignore, user is still editing */ }
  },

  // ---- Entry management (top-level keys) ----

  /**
   * Add a new top-level entry. Re-renders.
   * For damage types: also auto-creates matching pen + dmgbuff entries.
   * For defense types: also auto-creates matching defbuff entry.
   */
  addEntry(sid, key, template) {
    const data = STATE.loaded[sid];
    if (!data) return;

    // Ensure unique key
    let uniqueKey = key;
    let i = 2;
    while (Object.prototype.hasOwnProperty.call(data, uniqueKey)) {
      uniqueKey = `${key}_${i++}`;
    }
    data[uniqueKey] = JSON.parse(JSON.stringify(template)); // deep clone

    updateBadge(sid);
    renderSection(_activeSection === sid ? sid : _activeSection);
  },

  /**
   * Initialize a section with a sensible empty default — no file needed.
   */
  createEmpty(sid) {
    const def = SCHEMA.sections[sid];
    if (def?.multiFile) {
      STATE.loaded[sid] = { _multiFile: true, files: {} };
      delete STATE.errors[sid];
      updateBadge(sid);
      renderSection(sid);
      return;
    }
    const DEFAULTS = {
      formula:     { 'defense-formula': 'FACTOR', 'custom-defense-formula': 'damage*(25/(25+defense))', 'legacy-combat': false },
      general:     {},
      damage:      {},
      defense:     {},
      penetration: {},
      dmgbuff:     {},
      defbuff:     {},
    };
    if (!DEFAULTS[sid]) return;
    STATE.loaded[sid] = JSON.parse(JSON.stringify(DEFAULTS[sid]));
    delete STATE.errors[sid];
    updateBadge(sid);
    renderSection(sid);
  },

  removeEntry(sid, key) {
    const data = STATE.loaded[sid];
    if (!data) return;
    delete data[key];
    updateBadge(sid);
    renderSection(_activeSection);
  },

  /**
   * Rename a top-level key. Re-renders so all edit-path attributes are updated.
   */
  renameEntry(sid, oldKey, newKey) {
    if (!newKey || newKey === oldKey) return;
    const data = STATE.loaded[sid];
    if (!data) return;
    if (Object.prototype.hasOwnProperty.call(data, newKey)) {
      alert(`Key "${newKey}" already exists.`);
      renderSection(_activeSection); // reset input
      return;
    }
    // Rebuild object to preserve insertion order at same position
    const rebuilt = {};
    for (const [k, v] of Object.entries(data)) {
      rebuilt[k === oldKey ? newKey : k] = v;
    }
    Object.keys(data).forEach(k => delete data[k]);
    Object.assign(data, rebuilt);
    renderSection(_activeSection);
  },

  // ---- Download ----

  download(sid) {
    const data = STATE.loaded[sid];
    const def  = SCHEMA.sections[sid];
    if (!data || !def?.file) return;
    if (def.multiFile && data._multiFile) {
      Object.keys(data.files || {}).forEach(fname => this.igDownload(sid, fname));
      return;
    }
    const blob = new Blob([YAML.stringify(data)], { type: 'text/yaml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: def.file.split('/').pop() });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // ---- Drag-and-drop / file input ----

  onDragOver(event, sid) {
    event.preventDefault();
    document.getElementById(`zone-${sid}`)?.classList.add('drag-over');
  },

  onDragLeave(event, sid) {
    document.getElementById(`zone-${sid}`)?.classList.remove('drag-over');
  },

  async onDrop(event, sid) {
    event.preventDefault();
    document.getElementById(`zone-${sid}`)?.classList.remove('drag-over');
    const def = SCHEMA.sections[sid];
    if (def?.multiFile) {
      const files = Array.from(event.dataTransfer.files).filter(f => /\.ya?ml$/i.test(f.name));
      for (const f of files) await loadMultiFile(sid, f);
      updateBadge(sid);
      afterLoad(sid);
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) { await readFile(file, sid); afterLoad(sid); }
  },

  async onFileInput(event, sid) {
    const def = SCHEMA.sections[sid];
    if (def?.multiFile) {
      const files = Array.from(event.target.files);
      for (const f of files) await loadMultiFile(sid, f);
      updateBadge(sid);
      afterLoad(sid);
      return;
    }
    const file = event.target.files[0];
    if (file) { await readFile(file, sid); afterLoad(sid); }
  },

  // ---- Multi-file (ig*) methods ----

  igUpdateField(sid, fname, path, value) {
    const files = STATE.loaded[sid]?.files;
    if (!files?.[fname]) return;
    const existing = getPath(files[fname], path);
    setPath(files[fname], path, coerce(existing, value));
  },

  igUpdateJson(sid, fname, path, jsonText) {
    const files = STATE.loaded[sid]?.files;
    if (!files?.[fname]) return;
    try { setPath(files[fname], path, JSON.parse(jsonText)); } catch (_) {}
  },

  igSetFamily(sid, fname, family) {
    const d = STATE.loaded[sid];
    if (!d?._multiFile) return;
    if (!d._families) d._families = {};
    if (family) {
      d._families[fname] = family;
    } else {
      delete d._families[fname];
    }
    // Debounce re-render so typing doesn't reset focus
    clearTimeout(this._igFamilyTimer);
    this._igFamilyTimer = setTimeout(() => {
      updateBadge(sid);
      renderSection(_activeSection);
    }, 600);
  },

  igDownload(sid, fname) {
    const d = STATE.loaded[sid];
    if (!d?.files?.[fname]) return;
    const family = d._families?.[fname] ?? '';
    // Browsers don't support subdirs in download attr, so prefix filename for clarity
    const downloadName = family ? `${family}__${fname}` : fname;
    const blob = new Blob([YAML.stringify(d.files[fname])], { type: 'text/yaml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: downloadName });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  igRemoveFile(sid, fname) {
    const d = STATE.loaded[sid];
    if (!d?._multiFile) return;
    delete d.files[fname];
    if (d._families) delete d._families[fname];
    updateBadge(sid);
    renderSection(_activeSection);
  },

  async onIgAddInput(event, sid) {
    const files = Array.from(event.target.files);
    for (const f of files) await loadMultiFile(sid, f);
    updateBadge(sid);
    renderSection(_activeSection);
  },
};

// ---------------------------------------------------------------------------
// Auto-save state
// ---------------------------------------------------------------------------

/**
 * Auto-save configuration (runtime). Interval and format are persisted
 * to localStorage; dirHandle cannot be serialized so it must be re-selected
 * each session.
 */
const AUTOSAVE = {
  interval:   0,        // minutes; 0 = disabled
  timer:      null,     // setInterval handle
  dirHandle:  null,     // FileSystemDirectoryHandle (File System Access API)
  dirName:    '',       // display name of selected directory
  lastSaved:  null,     // Date of last successful save
  format:     'yaml',   // 'yaml' | 'json'
};

const LS_KEY = 'divinity-builder-autosave';

/** Load persisted settings from localStorage. */
function loadSavedSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    AUTOSAVE.interval = Number(s.interval) || 0;
    AUTOSAVE.format   = s.format === 'json' ? 'json' : 'yaml';
  } catch (_) { /* ignore */ }
}

/** Write current settings to localStorage. */
function persistSettings() {
  localStorage.setItem(LS_KEY, JSON.stringify({
    interval: AUTOSAVE.interval,
    format:   AUTOSAVE.format,
  }));
}

/** (Re)start the auto-save timer based on AUTOSAVE.interval. */
function applyAutoSaveTimer() {
  if (AUTOSAVE.timer) { clearInterval(AUTOSAVE.timer); AUTOSAVE.timer = null; }
  if (AUTOSAVE.interval > 0) {
    AUTOSAVE.timer = setInterval(() => APP.autoSaveNow(), AUTOSAVE.interval * 60 * 1000);
  }
}

/** Update the status line in the settings section (if visible). */
function refreshAutoSaveStatus() {
  const el = document.getElementById('autosave-status');
  if (!el) return;

  if (AUTOSAVE.interval === 0) {
    el.innerHTML = '<span class="as-off">⏸ Auto-save disabled (interval = 0).</span>';
    return;
  }

  const dirInfo = AUTOSAVE.dirHandle
    ? `📁 <b>${AUTOSAVE.dirName}</b>`
    : '⚠️ No directory selected — will download a JSON snapshot instead.';
  const lastInfo = AUTOSAVE.lastSaved
    ? ` &nbsp;·&nbsp; Last saved: <b>${AUTOSAVE.lastSaved.toLocaleTimeString()}</b>`
    : '';

  el.innerHTML = `<span class="as-on">⏱ Auto-saving every <b>${AUTOSAVE.interval} min</b>. ${dirInfo}${lastInfo}</span>`;
}

// ---------------------------------------------------------------------------
// Settings section HTML builder
// ---------------------------------------------------------------------------

function buildSettingsSection() {
  const def = SCHEMA.sections['settings'];
  const fsApiAvailable = typeof window.showDirectoryPicker === 'function';

  const sectionList = Object.values(SCHEMA.sections)
    .filter(s => s.file && STATE.loaded[s.id])
    .map(s => `<li><code>${s.file.split('/').pop()}</code> — ${s.label}</li>`)
    .join('');

  const loadedCount = Object.keys(STATE.loaded).length;

  return `
    <div class="section-header">
      <div class="section-title">${def.icon} ${def.label}</div>
      <div class="section-desc">${def.description}</div>
    </div>

    <!-- ── Export ─────────────────────────────────────────── -->
    <div class="settings-card">
      <h3>Export</h3>
      <p class="muted small" style="margin-bottom:12px">
        Download all currently-loaded sections as a single JSON snapshot.
        You can re-import it later to restore the full editor state in one click.
      </p>

      ${loadedCount === 0
        ? '<div class="alert alert-warn">⚠️ No files loaded yet. Load YAML files in <b>Load Files</b> first.</div>'
        : `<ul class="loaded-list">${sectionList}</ul>`}

      <div class="settings-row" style="margin-top:12px">
        <button class="btn-setting btn-export" onclick="APP.downloadAllJson()"
                ${loadedCount === 0 ? 'disabled' : ''}>
          ⬇ Download all as JSON
        </button>
        <span class="muted small">Includes all ${loadedCount} loaded section(s).</span>
      </div>
    </div>

    <!-- ── Import ─────────────────────────────────────────── -->
    <div class="settings-card">
      <h3>Import snapshot</h3>
      <p class="muted small" style="margin-bottom:12px">
        Load a previously exported JSON snapshot. Restores all sections at once.
      </p>
      <div class="settings-row">
        <label class="btn-setting btn-import">
          📂 Load JSON snapshot
          <input type="file" accept=".json" style="display:none"
                 onchange="APP.importJsonFromInput(event)">
        </label>
      </div>
    </div>

    <!-- ── Auto-save ──────────────────────────────────────── -->
    <div class="settings-card">
      <h3>Auto-save</h3>

      <div class="settings-row">
        <label class="settings-label">Save interval (minutes)</label>
        <input class="edit-input edit-input--num" type="number" min="0" step="1"
               value="${AUTOSAVE.interval}" style="width:80px"
               oninput="APP.setAutoSaveInterval(+this.value)">
        <span class="muted small">0 = disabled</span>
      </div>

      <div class="settings-row">
        <label class="settings-label">Format</label>
        <label class="radio-label">
          <input type="radio" name="as-format" value="yaml"
                 ${AUTOSAVE.format === 'yaml' ? 'checked' : ''}
                 onchange="APP.setAutoSaveFormat('yaml')">
          YAML (individual files)
        </label>
        <label class="radio-label">
          <input type="radio" name="as-format" value="json"
                 ${AUTOSAVE.format === 'json' ? 'checked' : ''}
                 onchange="APP.setAutoSaveFormat('json')">
          JSON snapshot
        </label>
      </div>

      ${AUTOSAVE.format === 'yaml' ? `
      <div class="settings-row">
        <label class="settings-label">Save directory</label>
        ${fsApiAvailable ? `
          <button class="btn-setting" onclick="APP.pickDirectory()">
            📁 ${AUTOSAVE.dirHandle ? `Change (current: <b>${AUTOSAVE.dirName}</b>)` : 'Select directory…'}
          </button>
          ${!AUTOSAVE.dirHandle
            ? '<span class="muted small">No directory selected.</span>'
            : `<span class="muted small">Files will be saved to: <b>${AUTOSAVE.dirName}</b></span>`}
        ` : `
          <span class="alert alert-warn" style="display:inline-block">
            ⚠️ File System Access API is not supported in this browser.
            YAML auto-save will trigger individual downloads instead.
            Use Chrome or Edge for directory-based saving.
          </span>
        `}
      </div>` : ''}

      <div class="settings-row">
        <div id="autosave-status" class="autosave-status"></div>
      </div>

      <div class="settings-row" style="gap:8px">
        <button class="btn-setting btn-save-now" onclick="APP.autoSaveNow()"
                ${loadedCount === 0 ? 'disabled' : ''}>
          💾 Save now
        </button>
        ${AUTOSAVE.interval > 0
          ? '<button class="btn-setting btn-stop" onclick="APP.setAutoSaveInterval(0);APP.navigate(\'settings\')">⏹ Stop auto-save</button>'
          : ''}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

Object.assign(APP, {

  /**
   * Download all loaded sections as a single JSON snapshot.
   * Format: { version, exported, sections: { [sectionId]: parsedData } }
   */
  downloadAllJson() {
    const snapshot = {
      version:  1,
      exported: new Date().toISOString(),
      sections: {},
    };
    Object.entries(STATE.loaded).forEach(([sid, data]) => {
      snapshot.sections[sid] = data;
    });

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `divinity-builder-${ts}.json`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /** Called by the file input on the import card. */
  importJsonFromInput(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const snapshot = JSON.parse(e.target.result);
        if (!snapshot.sections || typeof snapshot.sections !== 'object') {
          alert('Invalid snapshot: missing "sections" key.');
          return;
        }
        let count = 0;
        Object.entries(snapshot.sections).forEach(([sid, data]) => {
          if (SCHEMA.sections[sid]) {
            STATE.loaded[sid] = data;
            delete STATE.errors[sid];
            updateBadge(sid);
            count++;
          }
        });
        alert(`✅ Imported ${count} section(s) from snapshot (v${snapshot.version || '?'}, exported ${snapshot.exported || 'unknown'}).`);
        renderSection(_activeSection);
      } catch (err) {
        alert('❌ Failed to parse JSON: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  },

  // ---------------------------------------------------------------------------
  // Directory picker & auto-save
  // ---------------------------------------------------------------------------

  /** Open the File System Access API directory picker. */
  async pickDirectory() {
    if (typeof window.showDirectoryPicker !== 'function') {
      alert('File System Access API is not supported in this browser.\nUse Chrome or Edge.');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      AUTOSAVE.dirHandle = handle;
      AUTOSAVE.dirName   = handle.name;
      renderSection('settings'); // re-render to show new dir name
    } catch (err) {
      if (err.name !== 'AbortError') alert('Could not open directory: ' + err.message);
    }
  },

  /** Set auto-save interval in minutes. 0 disables. */
  setAutoSaveInterval(minutes) {
    AUTOSAVE.interval = Math.max(0, Math.floor(minutes));
    persistSettings();
    applyAutoSaveTimer();
    refreshAutoSaveStatus();
  },

  /** Set auto-save format: 'yaml' | 'json'. */
  setAutoSaveFormat(format) {
    AUTOSAVE.format = format === 'json' ? 'json' : 'yaml';
    persistSettings();
    renderSection('settings'); // re-render to show/hide directory picker
  },

  /**
   * Perform an immediate save:
   *  - If format='yaml' and dirHandle available → write individual YAML files to dir
   *  - If format='yaml' and no dirHandle       → trigger individual downloads
   *  - If format='json'                         → download JSON snapshot
   */
  async autoSaveNow() {
    const loadedSections = Object.entries(STATE.loaded)
      .filter(([sid]) => SCHEMA.sections[sid]?.file);

    if (loadedSections.length === 0) {
      alert('Nothing to save — no YAML files are loaded yet.');
      return;
    }

    if (AUTOSAVE.format === 'json') {
      this.downloadAllJson();
      AUTOSAVE.lastSaved = new Date();
      refreshAutoSaveStatus();
      return;
    }

    // YAML mode
    if (AUTOSAVE.dirHandle) {
      // Write YAML files directly to the chosen directory
      let saved = 0, failed = 0;
      for (const [sid, data] of loadedSections) {
        const def = SCHEMA.sections[sid];
        // Multi-file: save each sub-file
        if (def.multiFile && data._multiFile) {
          const families = data._families || {};
          for (const [fname, fdata] of Object.entries(data.files || {})) {
            try {
              const family = families[fname] ?? '';
              let targetDir = AUTOSAVE.dirHandle;
              if (family) {
                // Create subfolder if it doesn't exist
                targetDir = await AUTOSAVE.dirHandle.getDirectoryHandle(family, { create: true });
              }
              const fh = await targetDir.getFileHandle(fname, { create: true });
              const wr = await fh.createWritable();
              await wr.write(YAML.stringify(fdata));
              await wr.close();
              saved++;
            } catch (err) { console.error(`Failed to save ${fname}:`, err); failed++; }
          }
          continue;
        }
        const fname = def.file.split('/').pop();
        try {
          const fileHandle = await AUTOSAVE.dirHandle.getFileHandle(fname, { create: true });
          const writable   = await fileHandle.createWritable();
          await writable.write(YAML.stringify(data));
          await writable.close();
          saved++;
        } catch (err) {
          console.error(`Failed to save ${fname}:`, err);
          failed++;
        }
      }
      AUTOSAVE.lastSaved = new Date();
      refreshAutoSaveStatus();
      if (failed > 0) alert(`⚠️ Saved ${saved} file(s), but ${failed} failed. Check console.`);
    } else {
      // No dir — trigger individual downloads
      for (const [sid, data] of loadedSections) {
        const def = SCHEMA.sections[sid];
        if (def.multiFile && data._multiFile) {
          Object.keys(data.files || {}).forEach(fname => this.igDownload(sid, fname));
          continue;
        }
        const blob = new Blob([YAML.stringify(data)], { type: 'text/yaml;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), {
          href: url, download: def.file.split('/').pop(),
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      AUTOSAVE.lastSaved = new Date();
      refreshAutoSaveStatus();
    }
  },
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings();
  applyAutoSaveTimer();
  buildNav();
  renderSection('load');
});
