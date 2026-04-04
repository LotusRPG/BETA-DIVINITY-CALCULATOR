/**
 * renderers.js — Section render functions.
 *
 * Each function receives (data, sectionId) and returns an HTML string.
 * Interactive elements call APP.* defined in app.js.
 *
 * All list / object fields are rendered as open JSON textareas —
 * user types raw JSON, onblur writes back to STATE.
 */

'use strict';

// ---------------------------------------------------------------------------
// Minecraft color helpers
// ---------------------------------------------------------------------------

const mc = {
  colorMap: {
    '0':'mc0','1':'mc1','2':'mc2','3':'mc3','4':'mc4','5':'mc5',
    '6':'mc6','7':'mc7','8':'mc8','9':'mc9','a':'mca','b':'mcb',
    'c':'mcc','d':'mcd','e':'mce','f':'mcf',
    'l':'mcl','o':'mco','m':'mcm','n':'mcn','r':'mcr',
  },
  strip(s) { return s ? String(s).replace(/[&§][0-9a-fklmnoqr]/gi, '') : ''; },
  toHtml(s) {
    if (!s) return '';
    s = String(s);
    let html = '', openTags = 0, i = 0;
    while (i < s.length) {
      if ((s[i] === '&' || s[i] === '§') && i + 1 < s.length) {
        const code = s[i + 1].toLowerCase();
        if (this.colorMap[code] !== undefined) {
          if (code === 'r' || openTags > 0) { html += '</span>'.repeat(openTags); openTags = 0; }
          if (code !== 'r') { html += `<span class="${this.colorMap[code]}">`;  openTags++; }
          i += 2; continue;
        }
      }
      const c = s[i];
      html += c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c;
      i++;
    }
    return `<span class="mcf">${html}</span>`;
  },
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** Stable DOM id for live-update badges. */
function safeId(sid, entryId, field) {
  return `chk-${sid}-${String(entryId).replace(/[^a-z0-9]/gi, '_')}-${field}`;
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

function editText(sid, path, val, cls = '') {
  return `<input class="edit-input ${cls}" type="text" value="${esc(val)}"
    oninput="APP.updateField('${sid}','${esc(path)}',this.value)">`;
}

function editNum(sid, path, val, cls = '') {
  return `<input class="edit-input edit-input--num ${cls}" type="number" value="${esc(val)}"
    oninput="APP.updateField('${sid}','${esc(path)}',+this.value)">`;
}

/** Renameable key input — renames the top-level entry on blur/Enter. */
function editId(sid, id) {
  return `<input class="edit-input edit-id" value="${esc(id)}" title="Edit to rename"
    onblur="if(this.value.trim()&&this.value.trim()!=='${esc(id)}')APP.renameEntry('${sid}','${esc(id)}',this.value.trim())"
    onkeydown="if(event.key==='Enter')this.blur()">`;
}

/**
 * Checkbox that patches its badge span in-place (no re-render).
 * @param {string} type  'enabled' | 'percent-pen'
 */
function liveCheck(sid, path, val, badgeId, type) {
  return `<input class="edit-check" type="checkbox" ${val ? 'checked' : ''}
    onchange="APP.updateCheckbox('${sid}','${esc(path)}',this.checked,'${badgeId}','${type}')">`;
}

/** Badge span with stable id so liveCheck can update it. */
function liveBadge(val, badgeId, type) {
  if (type === 'enabled') {
    return `<span class="badge ${val ? 'badge-green' : 'badge-red'}" id="${badgeId}">${val ? 'enabled' : 'disabled'}</span>`;
  }
  if (type === 'percent-pen') {
    return `<span class="badge ${val ? 'badge-blue' : 'badge-yellow'}" id="${badgeId}">${val ? '% percent' : 'flat'}</span>`;
  }
  return '';
}

/**
 * Open JSON textarea for any value (array or object).
 * User types raw JSON; onblur → APP.updateJsonField writes back to STATE.
 */
function jsonTextarea(sid, path, value) {
  const isArr = Array.isArray(value);
  const json  = JSON.stringify(value ?? (isArr ? [] : {}), null, 2);
  const rows  = isArr
    ? Math.max(3, (value?.length ?? 0) + 2)
    : Math.max(3, Object.keys(value ?? {}).length + 2);
  return `<textarea class="obj-textarea" rows="${rows}"
    onblur="APP.updateJsonField('${sid}','${esc(path)}',this.value)">${esc(json)}</textarea>`;
}

// ---------------------------------------------------------------------------
// Action buttons
// ---------------------------------------------------------------------------

function addEntryBtn(sid, template, label) {
  return `<button class="btn-add-entry"
    onclick="APP.addEntry('${sid}','_new_${sid}',${JSON.stringify(template).replace(/'/g,"\\'")})">+ ${label}</button>`;
}

function removeEntryBtn(sid, key) {
  return `<button class="btn-icon btn-del" title="Remove entry"
    onclick="if(confirm('Remove \\'${esc(key)}\\'?'))APP.removeEntry('${sid}','${esc(key)}')">🗑</button>`;
}

// ---------------------------------------------------------------------------
// Shared card helpers
// ---------------------------------------------------------------------------

function cardRow(label, content) {
  return `<div class="info-row"><span class="info-label">${label}</span><div style="flex:1">${content}</div></div>`;
}

function cardRowFormat(sid, id, format) {
  return cardRow('Lore format',
    `${editText(sid, `${id}.format`, format, 'edit-input--format')}
     <span class="mc-preview mc-preview--live">${mc.toHtml(format)}</span>`);
}

// ---------------------------------------------------------------------------
// Formula helpers (evalFormula used by app.js recalcFormulaPreview)
// ---------------------------------------------------------------------------

function evalFormula(formula, vars) {
  try {
    let expr = formula
      .replace(/damage/g,    vars.damage)
      .replace(/defense/g,   vars.defense)
      .replace(/toughness/g, vars.toughness || 0);
    if (/[a-zA-Z_$]/.test(expr)) return null;
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + expr + ')')();
    return typeof result === 'number' && isFinite(result) ? Math.max(0, result) : null;
  } catch (_) { return null; }
}

/**
 * Calculate damage output using the correct formula for the active mode.
 * @param {string} mode        'FACTOR' | 'CUSTOM' | 'LEGACY'
 * @param {string} customExpr  Custom formula expression (only used for CUSTOM mode)
 * @param {{damage:number, defense:number, toughness?:number}} vars
 * @returns {number|null}
 */
function evalForMode(mode, customExpr, vars) {
  if (mode === 'LEGACY') {
    // Legacy: simple 1:1 subtraction, minimum 0
    return Math.max(0, vars.damage - vars.defense);
  }
  if (mode === 'FACTOR') {
    // Divinity default factor formula (Minecraft-like diminishing returns)
    return evalFormula('damage*(25/(25+defense))', vars);
  }
  // CUSTOM: user-defined expression
  return evalFormula(customExpr, vars);
}

function buildFormulaPreviewRows(mode, customF) {
  let rows = '';

  // Fixed rows — Damage in is always 100, defense varies per case.
  SCHEMA.formulaPreviewCases.forEach((c, i) => {
    const result    = evalForMode(mode, customF, c);
    const dmgOut    = result !== null ? result.toFixed(2) : '?';
    const reduction = result !== null ? ((1 - result / c.damage) * 100).toFixed(1) + '%' : '?';
    const clr       = result !== null && result < c.damage / 2 ? 'var(--green)' : 'var(--red)';
    rows += `
      <tr>
        <td class="num">100</td>
        <td class="num">${c.defense}</td>
        <td class="num" style="color:${clr}" id="preview-out-${i}">${dmgOut}</td>
        <td class="num" id="preview-red-${i}">${reduction}</td>
      </tr>`;
  });

  // Custom editable row — user sets any damage + defense, output is live-calculated.
  const { dmgIn, defIn } = FORMULA_PREVIEW;
  const res = evalForMode(mode, customF, { damage: dmgIn, defense: defIn, toughness: 0 });
  const out = res !== null ? res.toFixed(2) : '?';
  const red = res !== null ? ((1 - res / dmgIn) * 100).toFixed(1) + '%' : '?';
  const clr = res !== null && res < dmgIn / 2 ? 'var(--green)' : 'var(--red)';
  rows += `
    <tr class="custom-preview-row" title="Custom test — edit damage and defense">
      <td class="num">
        <input id="custom-dmg-in" class="edit-input edit-input--inline" type="number"
               value="${dmgIn}" oninput="APP.setPreviewDmg(+this.value)" style="width:64px">
      </td>
      <td class="num">
        <input id="custom-def-in" class="edit-input edit-input--inline" type="number"
               value="${defIn}" oninput="APP.setPreviewDef(+this.value)" style="width:64px">
      </td>
      <td class="num" style="color:${clr}" id="custom-dmg-out">${out}</td>
      <td class="num" id="custom-reduction">${red}</td>
    </tr>`;
  return rows;
}

// ===========================================================================
// SECTION RENDERERS
// ===========================================================================

// ---------------------------------------------------------------------------
// Formula (engine.yml)
// ---------------------------------------------------------------------------

function renderFormula(data, sid) {
  const combat  = data.combat || data;
  const mode    = String(combat['defense-formula'] || 'FACTOR').toUpperCase();
  const customF = combat['custom-defense-formula'] || 'damage*(25/(25+defense))';
  const legacy  = combat['legacy-combat'] === true;
  const modeDef = SCHEMA.formulaModes[mode] || SCHEMA.formulaModes['FACTOR'];

  const modeButtons = Object.entries(SCHEMA.formulaModes).map(([m, def]) => {
    const active = m === mode
      ? `style="border-color:${def.color};color:${def.color};background:${def.color}18"` : '';
    return `<span class="mode-btn mode-btn--click" ${active}
      onclick="APP.setFormulaMode('${sid}','${m}')" title="${def.description}">${m}${m === mode ? ' ✓' : ''}</span>`;
  }).join('');

  const fPath = data.combat ? 'combat.custom-defense-formula' : 'custom-defense-formula';

  return `
    <div class="info-banner" style="border-color:${modeDef.color}">
      <div class="info-banner__title" style="color:${modeDef.color}">Active mode: ${mode}</div>
      <div class="info-banner__desc">${modeDef.description}</div>
    </div>
    ${legacy ? '<div class="alert alert-warn">⚠️ <b>legacy-combat: true</b> is enabled.</div>' : ''}
    ${modeDef.flatPenWarn ? '<div class="alert alert-warn">⚠️ Flat penetration does not work in this mode. Requires CUSTOM.</div>' : ''}

    <h3>Formula mode</h3>
    <div class="mode-btns">${modeButtons}</div>
    <p class="muted small" style="margin-top:6px">Click a mode to switch.</p>

    <h3 style="margin-top:20px">Custom defense formula</h3>
    <input class="edit-input edit-input--formula" type="text" value="${esc(customF)}"
           oninput="APP.updateFormulaExpr('${sid}','${fPath}',this.value)">
    <p class="muted small" style="margin-top:4px">
      Variables: <code>damage</code>, <code>defense</code>, <code>defense_&lt;id&gt;</code>, <code>toughness</code>
    </p>

    <h3 style="margin-top:20px">Formula preview</h3>
    <p class="muted small" style="margin-bottom:8px">
      Last row is editable — enter any damage + defense values.
    </p>
    <table class="tbl">
      <thead><tr><th>Damage in</th><th>Defense</th><th>Damage out</th><th>Reduction %</th></tr></thead>
      <tbody id="formula-preview-body">${buildFormulaPreviewRows(mode, customF)}</tbody>
    </table>`;
}

// ---------------------------------------------------------------------------
// General Stats (general_stats.yml)
// ---------------------------------------------------------------------------

function renderGeneralStats(data, sid) {
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');
  const TPL = { name: 'New Stat', format: '&7%value%', capacity: 200, enabled: true };

  const rows = entries.map(([id, stat]) => {
    const enabled = stat.enabled !== false;
    const enId    = safeId(sid, id, 'en');
    const isNew   = (SYNCED_NEW[sid] || new Set()).has(id);
    return `
      <tr class="data-row${enabled ? '' : ' row-disabled'}${isNew ? ' entry-new' : ''}">
        <td>${editId(sid, id)} ${isNew ? '<span class="badge badge-blue">new</span>' : ''}</td>
        <td>${editText(sid, `${id}.name`, stat.name ?? id)}</td>
        <td>
          ${editText(sid, `${id}.format`, stat.format ?? '', 'edit-input--format')}
          <span class="mc-preview mc-preview--live">${mc.toHtml(stat.format ?? '')}</span>
        </td>
        <td>${editNum(sid, `${id}.capacity`, stat.capacity ?? -1)}</td>
        <td>
          ${liveCheck(sid, `${id}.enabled`, enabled, enId, 'enabled')}
          ${liveBadge(enabled, enId, 'enabled')}
        </td>
        <td>${removeEntryBtn(sid, id)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add stat')}</div>
    <input class="search-input" type="text" placeholder="🔍 Search stats…"
           oninput="APP.filterTable('tbl-general',this.value)">
    <table class="tbl" id="tbl-general">
      <thead><tr><th>ID</th><th>Name</th><th>Lore format</th><th>Capacity</th><th>Enabled</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ---------------------------------------------------------------------------
// Damage Types (damage.yml)
// ---------------------------------------------------------------------------

function renderDamage(data, sid) {
  const entries = Object.entries(data)
    .filter(([, v]) => v && typeof v === 'object')
    .sort(([, a], [, b]) => (b.priority || 0) - (a.priority || 0));

  const TPL = {
    name: 'New Type', format: '&f%value%', priority: 1,
    'attached-damage-causes': [],
    'biome-damage-modifiers': {},
    'on-hit-actions': {},
    'entity-type-modifier': {},
    'mythic-mob-faction-modifier': {},
  };

  const cards = entries.map(([id, dt]) => {
    const isNew = (SYNCED_NEW[sid] || new Set()).has(id);
    return `
      <div class="item-card${isNew ? ' entry-new' : ''}">
        <div class="item-card__header">
          <span class="item-card__icon">🗡️</span>
          ${editId(sid, id)}
          ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
          ${removeEntryBtn(sid, id)}
        </div>
        <div class="item-card__body">
          ${cardRow('Name',     editText(sid, `${id}.name`, dt.name ?? id))}
          ${cardRow('Priority', editNum(sid,  `${id}.priority`, dt.priority ?? 1, 'edit-input--inline'))}
          ${cardRowFormat(sid, id, dt.format ?? '')}
          ${cardRow('Attached causes',      jsonTextarea(sid, `${id}.attached-damage-causes`,      dt['attached-damage-causes']      ?? []))}
          ${cardRow('Biome modifiers',      jsonTextarea(sid, `${id}.biome-damage-modifiers`,      dt['biome-damage-modifiers']      ?? {}))}
          ${cardRow('On-hit actions',       jsonTextarea(sid, `${id}.on-hit-actions`,              dt['on-hit-actions']              ?? {}))}
          ${cardRow('Entity modifiers',     jsonTextarea(sid, `${id}.entity-type-modifier`,        dt['entity-type-modifier']        ?? {}))}
          ${cardRow('Faction modifiers',    jsonTextarea(sid, `${id}.mythic-mob-faction-modifier`, dt['mythic-mob-faction-modifier'] ?? {}))}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add damage type')}</div>
    <div class="cards-grid">${cards || '<div class="empty-state">No damage types found.</div>'}</div>`;
}

// ---------------------------------------------------------------------------
// Defense Types (defense.yml)
// ---------------------------------------------------------------------------

function renderDefense(data, sid) {
  const entries = Object.entries(data)
    .filter(([, v]) => v && typeof v === 'object')
    .sort(([, a], [, b]) => (b.priority || 0) - (a.priority || 0));

  const TPL = {
    name: 'New Defense', format: '&7%value% 🛡', priority: 1,
    'block-damage-types': [], 'protection-factor': 1.0,
  };

  const cards = entries.map(([id, dt]) => {
    const isNew = (SYNCED_NEW[sid] || new Set()).has(id);
    return `
      <div class="item-card${isNew ? ' entry-new' : ''}">
        <div class="item-card__header">
          <span class="item-card__icon">🛡️</span>
          ${editId(sid, id)}
          ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
          ${removeEntryBtn(sid, id)}
        </div>
        <div class="item-card__body">
          ${cardRow('Name',              editText(sid, `${id}.name`, dt.name ?? id))}
          ${cardRow('Priority',          editNum(sid,  `${id}.priority`, dt.priority ?? 1, 'edit-input--inline'))}
          ${cardRow('Protection factor', editNum(sid,  `${id}.protection-factor`, dt['protection-factor'] ?? 1.0, 'edit-input--inline'))}
          ${cardRowFormat(sid, id, dt.format ?? '')}
          ${cardRow('Blocks damage types', jsonTextarea(sid, `${id}.block-damage-types`, dt['block-damage-types'] ?? []))}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add defense type')}</div>
    <div class="cards-grid">${cards || '<div class="empty-state">No defense types found.</div>'}</div>`;
}

// ---------------------------------------------------------------------------
// Penetration (penetration.yml)
// ---------------------------------------------------------------------------

function renderPenetration(data, sid) {
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');

  const TPL = {
    name: 'New Penetration', format: '&f%value%',
    'percent-pen': false, capacity: 100, hooks: [], enabled: true,
  };

  const cards = entries.map(([id, pt]) => {
    const enabled = pt.enabled !== false;
    const isPct   = pt['percent-pen'] === true;
    const enId    = safeId(sid, id, 'en');
    const pctId   = safeId(sid, id, 'pct');
    const isNew   = (SYNCED_NEW[sid] || new Set()).has(id);
    return `
      <div class="item-card${isNew ? ' entry-new' : ''}${enabled ? '' : ' card-disabled'}">
        <div class="item-card__header">
          <span class="item-card__icon">🎯</span>
          ${editId(sid, id)}
          ${liveBadge(isPct, pctId, 'percent-pen')}
          ${liveBadge(enabled, enId, 'enabled')}
          ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
          ${removeEntryBtn(sid, id)}
        </div>
        <div class="item-card__body">
          ${cardRow('Name',     editText(sid, `${id}.name`, pt.name ?? id))}
          ${cardRow('Capacity', editNum(sid,  `${id}.capacity`, pt.capacity ?? 100, 'edit-input--inline'))}
          ${cardRowFormat(sid, id, pt.format ?? '')}
          ${cardRow('% Pen',
            `${liveCheck(sid, `${id}.percent-pen`, isPct, pctId, 'percent-pen')}
             <span class="muted small">Checked = percent, unchecked = flat</span>`)}
          ${cardRow('Enabled', liveCheck(sid, `${id}.enabled`, enabled, enId, 'enabled'))}
          ${cardRow('Hooks (damage types)', jsonTextarea(sid, `${id}.hooks`, pt.hooks ?? []))}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add penetration stat')}</div>
    <div class="alert alert-info">
      ℹ️ <b>Flat</b> pen (unchecked) only works in CUSTOM formula mode.
      <b>%</b> pen (checked) works in all modes.
    </div>
    <div class="cards-grid">${cards || '<div class="empty-state">No penetration stats.</div>'}</div>`;
}

// ---------------------------------------------------------------------------
// Damage / Defense Buffs — shared, card layout
// ---------------------------------------------------------------------------

function renderBuffs(data, sid) {
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');
  const isDmg   = sid === 'dmgbuff';

  const TPL = {
    name: 'New Buff', format: isDmg ? '&a+%value%%' : '&7+%value%%',
    capacity: 200, hooks: [], enabled: true,
  };

  const cards = entries.map(([id, bt]) => {
    const enabled = bt.enabled !== false;
    const enId    = safeId(sid, id, 'en');
    const isNew   = (SYNCED_NEW[sid] || new Set()).has(id);
    return `
      <div class="item-card${isNew ? ' entry-new' : ''}${enabled ? '' : ' card-disabled'}">
        <div class="item-card__header">
          <span class="item-card__icon">${isDmg ? '🔥' : '🛡'}</span>
          ${editId(sid, id)}
          ${liveBadge(enabled, enId, 'enabled')}
          ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
          ${removeEntryBtn(sid, id)}
        </div>
        <div class="item-card__body">
          ${cardRow('Name',     editText(sid, `${id}.name`, bt.name ?? id))}
          ${cardRow('Capacity', editNum(sid,  `${id}.capacity`, bt.capacity ?? 200, 'edit-input--inline'))}
          ${cardRowFormat(sid, id, bt.format ?? '')}
          ${cardRow('Enabled', liveCheck(sid, `${id}.enabled`, enabled, enId, 'enabled'))}
          ${cardRow('Hooks', jsonTextarea(sid, `${id}.hooks`, bt.hooks ?? []))}
        </div>
      </div>`;
  }).join('');

  const empty = '<div class="empty-state">No entries. Auto-generated by server on startup, or add manually.</div>';

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, `Add ${isDmg ? 'damage' : 'defense'} buff`)}</div>
    <div class="cards-grid">${cards || empty}</div>`;
}

// ===========================================================================
// ITEM GENERATOR — multi-file, fully structured renderer
// ===========================================================================

// ---- ig* helpers (mirror of edit* but operate on multiFile STATE) ----

function escJs(v) {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function igField(sid, fname, path, val, cls = '') {
  return `<input class="edit-input ${cls}" type="text" value="${esc(val)}"
    oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">`;
}

function igNum(sid, fname, path, val) {
  return `<input class="edit-input edit-input--num" type="number" value="${esc(val)}"
    oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path)}',+this.value)">`;
}

function igJson(sid, fname, path, value) {
  const isArr = Array.isArray(value);
  const json  = JSON.stringify(value ?? (isArr ? [] : {}), null, 2);
  const rows  = isArr
    ? Math.max(3, (value?.length ?? 0) + 2)
    : Math.max(3, Object.keys(value ?? {}).length + 2);
  return `<textarea class="obj-textarea" rows="${rows}"
    onblur="APP.igUpdateJson('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">${esc(json)}</textarea>`;
}

function igCheck(sid, fname, path, val) {
  return `<input class="edit-check" type="checkbox" ${val ? 'checked' : ''}
    onchange="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path)}',this.checked)">`;
}

/** Render MC-colored preview of a lore/lore-format line array. */
function lorePreview(lines) {
  if (!Array.isArray(lines) || !lines.length) return '<p class="muted small" style="margin-top:4px">No lines.</p>';
  return `<div class="lore-preview">${
    lines.map(l => l === ''
      ? '<div class="lore-line lore-blank"></div>'
      : `<div class="lore-line">${mc.toHtml(String(l))}</div>`
    ).join('')
  }</div>`;
}

/** lore-format textarea + MC preview. */
function igLoreFormat(sid, fname, path, lines) {
  return `
    ${igJson(sid, fname, path, lines ?? [])}
    ${lorePreview(lines ?? [])}`;
}

function igCollapsible(title, content, open = false) {
  return `<details class="ig-section"${open ? ' open' : ''}>
    <summary class="ig-section__title">${title}</summary>
    <div class="ig-section__body">${content}</div>
  </details>`;
}

/** Compact table of stat pool entries (chance/scale/min/max/flat/round). */
function buildStatPool(sid, fname, basePath, listData) {
  if (!listData || typeof listData !== 'object') return '<p class="muted small">No entries.</p>';
  const entries = Object.entries(listData).filter(([k, v]) => k !== 'lore-format' && v && typeof v === 'object');
  if (!entries.length) return '<p class="muted small">No entries.</p>';

  const rows = entries.map(([id, e]) => {
    const p      = `${basePath}.${id}`;
    const active = (e.chance ?? 0) > 0;
    return `<tr class="${active ? '' : 'row-disabled'}">
      <td><code>${esc(id)}</code></td>
      <td>${igNum(sid, fname, `${p}.chance`, e.chance ?? 0)}</td>
      <td>${igNum(sid, fname, `${p}.scale-by-level`, e['scale-by-level'] ?? 1.0)}</td>
      <td>${igNum(sid, fname, `${p}.min`, e.min ?? 0)}</td>
      <td>${igNum(sid, fname, `${p}.max`, e.max ?? 0)}</td>
      <td style="text-align:center">${igCheck(sid, fname, `${p}.flat-range`, !!e['flat-range'])}</td>
      <td style="text-align:center">${igCheck(sid, fname, `${p}.round`,      !!e.round)}</td>
    </tr>`;
  }).join('');

  return `<table class="tbl tbl-compact">
    <thead><tr>
      <th>Stat ID</th><th>Chance %</th><th>Scale/lvl</th><th>Min</th><th>Max</th><th>Flat</th><th>Round</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** Collapsible section for damage-types / defense-types / fabled-attributes. */
function buildStatGroup(sid, fname, basePath, groupData, title) {
  if (!groupData || typeof groupData !== 'object') return '';
  const list   = groupData.list ?? {};
  const active = Object.entries(list).filter(([k, v]) => k !== 'lore-format' && (v?.chance ?? 0) > 0).length;

  const content = `
    <div class="info-row">
      <span class="info-label">Min / Max</span>
      <div style="display:flex;gap:6px;align-items:center">
        ${igNum(sid, fname, `${basePath}.minimum`, groupData.minimum ?? 0)}
        <span class="muted">–</span>
        ${igNum(sid, fname, `${basePath}.maximum`, groupData.maximum ?? 0)}
      </div>
    </div>
    ${cardRow('Lore format', igLoreFormat(sid, fname, `${basePath}.lore-format`, groupData['lore-format'] ?? []))}
    <p class="ig-subhead">Stat pool — ${active} active</p>
    ${buildStatPool(sid, fname, `${basePath}.list`, list)}`;

  return igCollapsible(
    `${title} <span class="badge badge-blue" style="font-size:10px">${active} active</span>`,
    content
  );
}

/** Collapsible for item-stats (has 4 sub-lists). */
function buildItemStatsGroup(sid, fname, basePath, groupData) {
  if (!groupData || typeof groupData !== 'object') return '';
  const list   = groupData.list                ?? {};
  const dmgBuf = groupData['list-damage-buffs']  ?? {};
  const defBuf = groupData['list-defense-buffs'] ?? {};
  const pen    = groupData['list-penetration']   ?? {};
  const active = Object.entries(list).filter(([, v]) => (v?.chance ?? 0) > 0).length;

  const subList = (label, subBasePath, subData) => {
    const entries = Object.entries(subData).filter(([k]) => k !== 'lore-format');
    if (!entries.length) return '';
    return `
      <p class="ig-subhead">${label}</p>
      ${cardRow('Lore format', igLoreFormat(sid, fname, `${subBasePath}.lore-format`, subData['lore-format'] ?? []))}
      ${buildStatPool(sid, fname, subBasePath, subData)}`;
  };

  const content = `
    <div class="info-row">
      <span class="info-label">Min / Max</span>
      <div style="display:flex;gap:6px;align-items:center">
        ${igNum(sid, fname, `${basePath}.minimum`, groupData.minimum ?? 0)}
        <span class="muted">–</span>
        ${igNum(sid, fname, `${basePath}.maximum`, groupData.maximum ?? 0)}
      </div>
    </div>
    ${cardRow('Lore format', igLoreFormat(sid, fname, `${basePath}.lore-format`, groupData['lore-format'] ?? []))}
    <p class="ig-subhead">General stats — ${active} active</p>
    ${buildStatPool(sid, fname, `${basePath}.list`, list)}
    ${subList('Damage buffs %',  `${basePath}.list-damage-buffs`,  dmgBuf)}
    ${subList('Defense buffs %', `${basePath}.list-defense-buffs`, defBuf)}
    ${subList('Penetration',     `${basePath}.list-penetration`,   pen)}`;

  return igCollapsible(
    `📊 Item Stats <span class="badge badge-blue" style="font-size:10px">${active} general active</span>`,
    content
  );
}

/** Collapsible sockets section (GEM / ESSENCE / RUNE). */
function buildSocketsSection(sid, fname, socketsData) {
  if (!socketsData || typeof socketsData !== 'object' || !Object.keys(socketsData).length) return '';

  const inner = Object.entries(socketsData).map(([type, td]) => {
    if (!td || typeof td !== 'object') return '';
    const bp = `generator.sockets.${type}`;
    return igCollapsible(type, `
      <div class="info-row">
        <span class="info-label">Min / Max</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${igNum(sid, fname, `${bp}.minimum`, td.minimum ?? 0)}
          <span class="muted">–</span>
          ${igNum(sid, fname, `${bp}.maximum`, td.maximum ?? 0)}
        </div>
      </div>
      ${cardRow('Lore format', igLoreFormat(sid, fname, `${bp}.lore-format`, td['lore-format'] ?? []))}
      <p class="ig-subhead">Socket pool</p>
      ${buildStatPool(sid, fname, `${bp}.list`, td.list ?? {})}`);
  }).join('');

  return igCollapsible('🔮 Sockets', inner);
}

/** Render one item-generator YAML file as a structured card. */
function renderItemGenFile(sid, fname, data, family) {
  if (!data || typeof data !== 'object') return '';
  const gen    = data.generator || {};
  const lvl    = data.level     || {};
  const tier   = String(data.tier ?? '?');
  const minLvl = lvl.min ?? 1;
  const maxLvl = lvl.max ?? 50;
  const lore   = data.lore ?? [];

  const dmgTypes  = gen['damage-types']      || {};
  const defTypes  = gen['defense-types']     || {};
  const itemStats = gen['item-stats']        || {};
  const fabledAttr= gen['fabled-attributes'] || {};

  const dmgActive  = Object.entries(dmgTypes.list  || {}).filter(([k, v]) => k !== 'lore-format' && (v?.chance ?? 0) > 0).length;
  const defActive  = Object.entries(defTypes.list  || {}).filter(([k, v]) => k !== 'lore-format' && (v?.chance ?? 0) > 0).length;
  const statActive = Object.entries(itemStats.list || {}).filter(([k, v]) => k !== 'lore-format' && (v?.chance ?? 0) > 0).length;

  const familyVal = family ?? '';

  return `
  <div class="item-card ig-card">
    <div class="item-card__header">
      <span class="item-card__icon">⚗️</span>
      <span style="font-weight:600;color:#fff">${esc(fname)}</span>
      <span class="badge badge-yellow">${esc(tier)}</span>
      <span class="badge">lv ${minLvl}–${maxLvl}</span>
      ${dmgActive  ? `<span class="badge badge-red"   title="Active damage types">${dmgActive}⚔</span>` : ''}
      ${defActive  ? `<span class="badge badge-blue"  title="Active defense types">${defActive}🛡</span>` : ''}
      ${statActive ? `<span class="badge badge-green" title="Active item stats">${statActive}📊</span>` : ''}
      <span class="ig-family-wrap" title="Folder — sets the subfolder this file downloads into">
        <span class="muted small">📁</span>
        <input class="edit-input edit-id ig-family-input" value="${esc(familyVal)}"
          placeholder="folder (optional)"
          oninput="APP.igSetFamily('${sid}','${escJs(fname)}',this.value.trim())">
      </span>
      <button class="btn-download" title="Download ${esc(fname)} into folder"
        onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
      <button class="btn-icon btn-del" title="Remove from editor"
        onclick="if(confirm('Remove \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
    </div>
    <div class="ig-card__body">

      ${igCollapsible('📋 Basic Info', `
        ${cardRow('Name template',
          igField(sid, fname, 'name', data.name ?? '', 'edit-input--format'))}
        ${cardRow('Tier',
          igField(sid, fname, 'tier', tier, 'edit-input--inline'))}
        ${cardRow('Level min / max',
          `<div style="display:flex;gap:6px;align-items:center">
            ${igNum(sid, fname, 'level.min', minLvl)}
            <span class="muted">–</span>
            ${igNum(sid, fname, 'level.max', maxLvl)}
          </div>`)}
        ${cardRow('Color (R,G,B or -1,-1,-1)',
          igField(sid, fname, 'color', String(data.color ?? '-1,-1,-1'), 'edit-input--inline'))}
        ${cardRow('Unbreakable',    igCheck(sid, fname, 'unbreakable', data.unbreakable !== false))}
        ${cardRow('Item flags',     igJson(sid, fname, 'item-flags',     data['item-flags']     ?? []))}
        ${cardRow('Target requirements', igJson(sid, fname, 'target-requirements', data['target-requirements'] ?? {}))}
      `, true)}

      ${igCollapsible('⚙️ Generator — General', `
        ${cardRow('Prefix chance %', igNum(sid, fname, 'generator.prefix-chance', gen['prefix-chance'] ?? 100))}
        ${cardRow('Suffix chance %', igNum(sid, fname, 'generator.suffix-chance', gen['suffix-chance'] ?? 100))}
        ${cardRow('Level requirements',
          igJson(sid, fname, 'generator.user-requirements-by-level', gen['user-requirements-by-level'] ?? {}))}
      `)}

      ${igCollapsible('🧱 Materials', igJson(sid, fname, 'generator.materials', gen.materials ?? {}))}
      ${igCollapsible('⭐ Bonuses',   igJson(sid, fname, 'generator.bonuses',   gen.bonuses   ?? {}))}

      ${igCollapsible('✨ Enchantments', `
        ${cardRow('Min / Max',
          `<div style="display:flex;gap:6px;align-items:center">
            ${igNum(sid, fname, 'generator.enchantments.minimum', gen.enchantments?.minimum ?? 0)}
            <span class="muted">–</span>
            ${igNum(sid, fname, 'generator.enchantments.maximum', gen.enchantments?.maximum ?? 0)}
          </div>`)}
        ${cardRow('Safe only',   igCheck(sid, fname, 'generator.enchantments.safe-only',   !!gen.enchantments?.['safe-only']))}
        ${cardRow('Safe levels', igCheck(sid, fname, 'generator.enchantments.safe-levels', !!gen.enchantments?.['safe-levels']))}
        ${cardRow('Enchant list (id: "minLevel:maxLevel")',
          igJson(sid, fname, 'generator.enchantments.list', gen.enchantments?.list ?? {}))}
      `)}

      ${igCollapsible('🏹 Ammo & Hand Types', `
        ${cardRow('Ammo types (type → weight %)', igJson(sid, fname, 'generator.ammo-types', gen['ammo-types'] ?? {}))}
        ${cardRow('Hand types (ONE/TWO → weight %)', igJson(sid, fname, 'generator.hand-types', gen['hand-types'] ?? {}))}
      `)}

      ${buildStatGroup(sid, fname, 'generator.damage-types',     dmgTypes,  '🗡️ Damage Types')}
      ${buildStatGroup(sid, fname, 'generator.defense-types',    defTypes,  '🛡️ Defense Types')}
      ${buildItemStatsGroup(sid, fname, 'generator.item-stats',  itemStats)}
      ${buildStatGroup(sid, fname, 'generator.fabled-attributes', fabledAttr, '⭐ Fabled Attributes')}
      ${buildSocketsSection(sid, fname, gen.sockets)}

      ${igCollapsible('🎯 Skills',
        igJson(sid, fname, 'generator.skills', gen.skills ?? {}))}
      ${igCollapsible('🛡 Shield Patterns',
        igJson(sid, fname, 'generator.shield-patterns', gen['shield-patterns'] ?? {}))}

      ${igCollapsible(
        `📜 Lore <span class="muted small" style="font-weight:normal">(${lore.length} lines)</span>`,
        `${igJson(sid, fname, 'lore', lore)}
         ${lorePreview(lore)}`
      )}

    </div>
  </div>`;
}

function renderItemGenerator(data, sid) {
  if (!data) return '<div class="empty-state">No data.</div>';

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('ig-file-add-${sid}').click()">+ Add item type file
    <input id="ig-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  if (data._multiFile) {
    const entries  = Object.entries(data.files || {});
    const families = data._families || {};

    if (!entries.length) return `
      <div class="entry-actions">${addBtn}</div>
      <div class="empty-state">
        <div style="font-size:36px;margin-bottom:12px">📂</div>
        <p>Drop item-generator YAML files above, or use <b>Load Files</b>.</p>
        <p class="muted small" style="margin-top:6px">Each .yml file = one item type (e.g. sword.yml, helmet.yml).</p>
      </div>`;

    // Group files by family (empty string = no folder)
    const groups = {};
    entries.forEach(([fn, fd]) => {
      const fam = families[fn] ?? '';
      if (!groups[fam]) groups[fam] = [];
      groups[fam].push([fn, fd]);
    });

    const groupHtml = Object.entries(groups).map(([fam, items]) => {
      const header = fam
        ? `<div class="ig-folder-header">📁 ${esc(fam)} <span class="muted small">(${items.length} file${items.length !== 1 ? 's' : ''})</span></div>`
        : (Object.keys(groups).length > 1
          ? `<div class="ig-folder-header ig-folder-root">📄 (no folder) <span class="muted small">(${items.length} file${items.length !== 1 ? 's' : ''})</span></div>`
          : '');
      return header + items.map(([fn, fd]) => renderItemGenFile(sid, fn, fd, fam)).join('');
    }).join('');

    return `<div class="entry-actions">${addBtn}</div>${groupHtml}`;
  }

  // Fallback: single file loaded before multi-file support
  return `<div class="entry-actions">${addBtn}</div>
    ${renderItemGenFile(sid, 'item_generator.yml', data, '')}`;
}

// ---------------------------------------------------------------------------
// Sets (item_stats/sets/ folder — one .yml per set)
// ---------------------------------------------------------------------------

function renderSets(data, sid) {
  if (!data) return '<div class="empty-state">No data.</div>';

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('sets-file-add').click()">+ Add set file
    <input id="sets-file-add" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  if (data._multiFile) {
    const entries = Object.entries(data.files || {});
    if (!entries.length) return `
      <div class="entry-actions">${addBtn}</div>
      <div class="empty-state">
        <div style="font-size:36px;margin-bottom:12px">👑</div>
        <p>Drop set YAML files above, or use <b>Load Files</b>.</p>
      </div>`;

    const cards = entries.map(([fname, setData]) => {
      const pieceCount = Array.isArray(setData.pieces) ? setData.pieces.length : 0;
      const tierCount  = setData.bonuses ? Object.keys(setData.bonuses).length : 0;
      return `
        <div class="item-card">
          <div class="item-card__header">
            <span class="item-card__icon">👑</span>
            <span style="flex:1;font-weight:600;color:#fff">${esc(fname)}</span>
            <span class="item-card__meta">${pieceCount} pieces · ${tierCount} tiers</span>
            <button class="btn-download" onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
            <button class="btn-icon btn-del"
              onclick="if(confirm('Remove \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
          </div>
          <div class="item-card__body">
            ${cardRow('Name', igField(sid, fname, 'name', setData.name ?? fname.replace(/\.ya?ml$/i,'')))}
            ${cardRow('Pieces (item IDs)', igJson(sid, fname, 'pieces', setData.pieces ?? []))}
            ${cardRow('Bonuses per tier count', igJson(sid, fname, 'bonuses', setData.bonuses ?? {}))}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="entry-actions">${addBtn}</div>
      <p class="muted small" style="margin-bottom:14px">
        Each file = one set. <b>Pieces</b>: array of item IDs.
        <b>Bonuses</b>: <code>{"2":{"HP":50},"4":{"HP":100}}</code>
      </p>
      <div class="cards-grid">${cards}</div>`;
  }

  // Legacy single-file (sets.yml with map of sets)
  const TPL = { name: 'New Set', pieces: [], bonuses: { 2: {}, 4: {} } };
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');
  const cards = entries.map(([id, set]) => {
    const isNew = (SYNCED_NEW[sid] || new Set()).has(id);
    const pieceCount = Array.isArray(set.pieces) ? set.pieces.length : 0;
    const tierCount  = set.bonuses ? Object.keys(set.bonuses).length : 0;
    return `
      <div class="item-card${isNew ? ' entry-new' : ''}">
        <div class="item-card__header">
          <span class="item-card__icon">👑</span>
          ${editId(sid, id)}
          <span class="item-card__meta">${pieceCount} pieces · ${tierCount} tiers</span>
          ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
          ${removeEntryBtn(sid, id)}
        </div>
        <div class="item-card__body">
          ${cardRow('Name', editText(sid, `${id}.name`, set.name ?? id))}
          ${cardRow('Pieces (item IDs)', jsonTextarea(sid, `${id}.pieces`, set.pieces ?? []))}
          ${cardRow('Bonuses per tier count', jsonTextarea(sid, `${id}.bonuses`, set.bonuses ?? {}))}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add set')}</div>
    <p class="muted small" style="margin-bottom:14px">
      <b>Pieces</b>: JSON array of item IDs that belong to this set.
      <b>Bonuses</b>: JSON object where each key is the number of equipped pieces
      and the value is a stat bonus map, e.g. <code>{"2":{"HP":50},"4":{"HP":100}}</code>.
    </p>
    <div class="cards-grid">${cards || '<div class="empty-state">No sets found.</div>'}</div>`;
}

// ---------------------------------------------------------------------------
// Renderer registry
// ---------------------------------------------------------------------------

const RENDERERS = {
  renderFormula,
  renderGeneralStats,
  renderDamage,
  renderDefense,
  renderPenetration,
  renderBuffs,
  renderItemGenerator,
  renderSets,
};
