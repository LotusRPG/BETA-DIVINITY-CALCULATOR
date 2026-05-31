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

  /**
   * Replace Divinity lore placeholders with sample/actual values so the
   * preview looks like a real in-game item line.
   *
   * ctx keys:
   *   name  — entry name   (default: styled "&eName&r")
   *   value — sample value (default: styled "&a100&r")
   *   cond  — condition prefix (default: "")
   */
  resolve(format, ctx = {}) {
    if (!format) return format;
    let s = String(format);

    // Core stat placeholders
    const name  = ctx.name  !== undefined ? String(ctx.name)  : '&eName&r';
    const value = ctx.value !== undefined ? String(ctx.value) : '&a100&r';
    const cond  = ctx.cond  !== undefined ? String(ctx.cond)  : '';
    s = s.replace(/%name%/gi,      name);
    s = s.replace(/%value%/gi,     value);
    s = s.replace(/%condition%/gi, cond);

    // Item stats  %ITEM_STAT_CC_RESISTANCE%  → &6[cc resistance]
    s = s.replace(/%ITEM_STAT_([A-Z0-9_]+)%/g,
      (_, id) => `&6[${id.toLowerCase().replace(/_/g, ' ')}]&r`);

    // Damage / defense values  %DAMAGE_physical%  %DEFENSE_physical%
    s = s.replace(/%DAMAGE_([A-Za-z0-9_]+)%/g,
      (_, id) => `&c[dmg: ${id}]&r`);
    s = s.replace(/%DEFENSE_([A-Za-z0-9_]+)%/g,
      (_, id) => `&9[def: ${id}]&r`);

    // Damage / defense buff %  %DAMAGE_BUFF_physical%  %DEFENSE_BUFF_physical%
    s = s.replace(/%DAMAGE_BUFF_([A-Za-z0-9_]+)%/g,
      (_, id) => `&a[dmg%: ${id}]&r`);
    s = s.replace(/%DEFENSE_BUFF_([A-Za-z0-9_]+)%/g,
      (_, id) => `&7[def%: ${id}]&r`);

    // Penetration  %PENETRATION_physical_pen%
    s = s.replace(/%PENETRATION_([A-Za-z0-9_]+)%/g,
      (_, id) => `&e[pen: ${id}]&r`);

    // Item generator / socket / player placeholders
    s = s.replace(/%GENERATOR_([A-Za-z0-9_]+)%/g,
      (_, id) => `&b[gen: ${id.toLowerCase()}]&r`);
    s = s.replace(/%SOCKET_([A-Za-z0-9_]+)%/g,
      (_, id) => `&3[socket: ${id.toLowerCase()}]&r`);
    s = s.replace(/%USER_([A-Za-z0-9_]+)%/g,
      (_, id) => `&d[player: ${id.toLowerCase()}]&r`);

    // Any remaining %UNKNOWN% → dark-gray badge
    s = s.replace(/%([A-Za-z0-9_]+)%/g,
      (_, id) => `&8[${id}]&r`);

    return s;
  },

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
  return String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** Escape for embedding inside a JS single-quoted string in HTML attributes. */
function escJs(v) {
  return String(v ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'")
    .replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/&(?!(?:amp|quot|lt|gt|#\d+);)/g, '&amp;')
    .replace(/\r?\n/g, '\\n');
}

/** Stable DOM id for live-update badges. Uses base36-hashed id to avoid collisions. */
function safeId(sid, entryId, field) {
  const s = String(entryId);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const sanitized = s.replace(/[^a-z0-9]/gi, '_').slice(0, 32);
  return `chk-${sid}-${sanitized}-${(h >>> 0).toString(36)}-${field}`;
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

function editText(sid, path, val, cls = '') {
  return `<input class="edit-input ${cls}" type="text" value="${esc(val)}"
    oninput="APP.updateField('${sid}','${escJs(path)}',this.value)">`;
}

function editNum(sid, path, val, cls = '') {
  return `<input class="edit-input edit-input--num ${cls}" type="number" value="${esc(val)}"
    oninput="APP.updateField('${sid}','${escJs(path)}',+this.value)">`;
}

/** Renameable key input — renames the top-level entry on blur/Enter. */
function editId(sid, id) {
  return `<input class="edit-input edit-id" value="${esc(id)}" title="${T('Edit to rename')}"
    onblur="if(this.value.trim()&&this.value.trim()!=='${escJs(id)}')APP.renameEntry('${sid}','${escJs(id)}',this.value.trim())"
    onkeydown="if(event.key==='Enter')this.blur()">`;
}

/**
 * Checkbox that patches its badge span in-place (no re-render).
 * @param {string} type  'enabled' | 'percent-pen'
 */
function liveCheck(sid, path, val, badgeId, type) {
  return `<input class="edit-check" type="checkbox" ${val ? 'checked' : ''}
    onchange="APP.updateCheckbox('${sid}','${escJs(path)}',this.checked,'${badgeId}','${type}')">`;
}

/** Badge span with stable id so liveCheck can update it. */
function liveBadge(val, badgeId, type) {
  if (type === 'enabled') {
    return `<span class="badge ${val ? 'badge-green' : 'badge-red'}" id="${badgeId}">${val ? T('enabled') : T('disabled')}</span>`;
  }
  if (type === 'percent-pen') {
    return `<span class="badge ${val ? 'badge-blue' : 'badge-yellow'}" id="${badgeId}">${val ? T('% percent') : T('flat')}</span>`;
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
    onblur="APP.updateJsonField('${sid}','${escJs(path)}',this.value)">${esc(json)}</textarea>`;
}

/**
 * Simple line-by-line textarea for string arrays (one value per line).
 * onblur → APP.updateLineArray splits by newline and writes array back.
 */
function lineArrayField(sid, path, value) {
  const arr  = Array.isArray(value) ? value : [];
  const text = arr.join('\n');
  const rows = Math.max(2, arr.length + 1);
  return `<textarea class="obj-textarea" rows="${rows}" placeholder="${T('one value per line')}"
    onblur="APP.updateLineArray('${sid}','${escJs(path)}',this.value)">${esc(text)}</textarea>`;
}

/**
 * Same as lineArrayField but updates a live lore preview div (by id) on every keystroke.
 */
function lineArrayFieldWithPreview(sid, path, value, previewId) {
  const arr  = Array.isArray(value) ? value : [];
  const text = arr.join('\n');
  const rows = Math.max(2, arr.length + 1);
  return `<textarea class="obj-textarea" rows="${rows}" placeholder="${T('one value per line')}"
    oninput="(function(t){const el=document.getElementById('${previewId}');if(!el)return;el.innerHTML=t.split('\\n').filter(Boolean).map(function(l){return'<div>'+mc.toHtml(mc.resolve(l,{}))+'</div>';}).join('');})(this.value)"
    onblur="APP.updateLineArray('${sid}','${escJs(path)}',this.value)">${esc(text)}</textarea>`;
}

/**
 * KV textarea for single-file sections (e.g. damage/defense types).
 * Stores values as numbers (parseFloat, fallback 0).
 * Format: KEY value per line.
 */
function lineKvFieldNum(sid, path, value, placeholder = 'KEY value') {
  const obj  = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  const text = Object.entries(obj).map(([k, v]) => `${k} ${v}`).join('\n');
  const rows = Math.max(2, Object.keys(obj).length + 1);
  return `<textarea class="obj-textarea" rows="${rows}" placeholder="${T(placeholder)} (${T('one per line')})"
    onblur="APP.updateLineKvNum('${sid}','${escJs(path)}',this.value)">${esc(text)}</textarea>`;
}

/**
 * KV textarea for multiFile sections where values are strings (not numbers).
 * Used for biome/entity/faction modifiers that have numeric values.
 */
function igLineKvFieldNum(sid, fname, path, value, placeholder = 'KEY value') {
  const obj  = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  const text = Object.entries(obj).map(([k, v]) => `${k} ${v}`).join('\n');
  const rows = Math.max(2, Object.keys(obj).length + 1);
  return `<textarea class="obj-textarea" rows="${rows}" placeholder="${T(placeholder)} (${T('one per line')})"
    onblur="APP.igUpdateLineKvNum('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">${esc(text)}</textarea>`;
}

// ---------------------------------------------------------------------------
// Action buttons
// ---------------------------------------------------------------------------

function addEntryBtn(sid, template, label) {
  // JSON goes in data-template (HTML-encoded) to avoid breaking the onclick attribute with double quotes
  const tpl = esc(JSON.stringify(template));
  return `<button class="btn-add-entry" data-template="${tpl}"
    onclick="APP.addEntry('${sid}','_new_${sid}',JSON.parse(this.dataset.template))">+ ${T(label)}</button>`;
}

function collapseAllBtn() {
  return `<button class="btn-add-entry" onclick="APP.collapseAll()">▶ ${T('Collapse all')}</button>
    <button class="btn-add-entry" onclick="APP.expandAll()">▼ ${T('Expand all')}</button>`;
}

/**
 * Template <select> with persistent last-selection per section.
 * options: array of {value, label} — first entry is implicitly {value:'', label:'Empty'}.
 */
function igTplSelect(sid, options) {
  const last  = window.IG_LAST_TEMPLATE?.[sid] ?? '';
  const tpls  = window.ITEM_TEMPLATES?.[sid] ?? {};
  // Built-in options that still exist
  const builtIn = options.filter(o => !o.value || tpls[o.value] !== undefined);
  // User-saved custom templates (keys not in the built-in list)
  const builtInKeys = new Set(options.map(o => o.value).filter(Boolean));
  const custom = Object.keys(tpls).filter(k => !builtInKeys.has(k))
    .map(k => ({ value: k, label: `⭐ ${k}` }));
  // Existing loaded files as copy-from templates
  const loadedFiles = Object.keys(STATE.loaded?.[sid]?.files ?? {})
    .map(fname => ({ value: `__file__:${fname}`, label: `📋 ${fname}` }));
  const allOpts = [{ value: '', label: T('Empty') }, ...builtIn, ...custom, ...loadedFiles];
  const opts = allOpts
    .map(o => `<option value="${esc(o.value)}"${o.value === last ? ' selected' : ''}>${esc(o.label)}</option>`)
    .join('');
  return `<select id="ig-tpl-${sid}" class="edit-input ig-tpl-select"
    onchange="APP.igSetLastTemplate('${sid}',this.value)">${opts}</select>` +
    `<button class="btn-icon btn-del" title="${T('Delete selected template')}"
      onclick="APP.igDeleteTemplate('${sid}',document.getElementById('ig-tpl-${sid}').value)">🗑</button>`;
}

// ---------------------------------------------------------------------------
// Templates for "New blank" in multiFile sections
// ---------------------------------------------------------------------------

const ITEM_TEMPLATES = {

  itemgen: {

    // Full template matching the plugin's complete item generator structure
    common: {
      name: '%BASE_NAME% %prefix_tier% %prefix_material% %prefix_type% %item_type% %suffix_material% %suffix_type% %suffix_tier%',
      lore: [
        '%%BASE_LORE%%',
        '&7Tier: %TIER_NAME%', '&7Level: &f%ITEM_LEVEL%', '',
        '%ITEM_AMMO%', '%ITEM_HAND%', '%ENCHANTS%', '',
        '%USER_CLASS%', '%USER_BANNED_CLASS%', '%USER_LEVEL%', '',
        '%ITEM_SET%',
        '', '%GENERATOR_SKILLS%',
        '%GENERATOR_DEFENSE%', '%GENERATOR_DAMAGE%',
        '%GENERATOR_DAMAGE_BUFFS%', '%GENERATOR_DEFENSE_BUFFS%', '%GENERATOR_PENETRATION%', '%GENERATOR_CUSTOM_STATS%',
        '%GENERATOR_STATS%', '%GENERATOR_FABLED_ATTR%',
        '%GENERATOR_SOCKETS_GEM%', '%GENERATOR_SOCKETS_ESSENCE%', '%GENERATOR_SOCKETS_RUNE%',
      ],
      color: '-1,-1,-1', unbreakable: false, 'item-flags': ['*'], tier: 'common',
      level: { min: 1, max: 50 },
      generator: {
        'prefix-chance': 100.0, 'suffix-chance': 100.0,
        materials: {
          reverse: false,
          'black-list': ['DIAMOND*', 'IRON*', 'CHAINMAIL*'],
          'model-data': {
            default: [1, 2, 3],
            special: { diamond_sword: [10, 11], golden_sword: [12, 13], axe: [30, 40], armor: [20, 22] },
          },
        },
        bonuses: {
          'material-modifiers': { 'diamond*': { 'damage-types': { physical: 1.15 } } },
          material: {
            iron_sword:  { 'damage-types': { physical: 1.15 } },
            iron_helmet: { 'defense-types': { physical: 1.25 } },
            axe:         { 'item-stats': { CRITICAL_DAMAGE: 1.5 } },
          },
        },
        'user-requirements-by-level': {
          level:         { '1': '1:10', '11': '11:20', '21': '0 + %ITEM_LEVEL%' },
          class:         { '1': 'Warrior,Cleric' },
          'banned-class':{ '1': 'Gunner,Archer' },
        },
        enchantments: {
          minimum: 1, maximum: 2, 'safe-only': false, 'safe-levels': true,
          list: { sharpness: '1:2', knockback: '1:2', efficiency: '1:2', silk_touch: '0:1', smite: '1:2' },
        },
        'ammo-types': { ARROW: 100.0 },
        'hand-types': { ONE: 70.0, TWO: 30.0, OFF: 0.0 },
        'damage-types': {
          minimum: 1, maximum: 2,
          'lore-format': [
            '%DAMAGE_PHYSICAL%', '%DAMAGE_MAGICAL%', '%DAMAGE_POISON%', '%DAMAGE_FIRE%',
            '%DAMAGE_WATER%', '%DAMAGE_WIND%', '',
            '%DAMAGE_SLASHING%', '%DAMAGE_PIERCING%', '%DAMAGE_BLUDGEONING%',
            '%DAMAGE_ICE%', '%DAMAGE_BLEED%', '%DAMAGE_CURSE%', '%DAMAGE_NECROTIC%',
            '%DAMAGE_EARTH%', '%DAMAGE_DUMMY%',
          ],
          list: {
            physical:    { chance: 100.0, 'scale-by-level': 1.025, min: 2.6, max: 5.8, 'flat-range': false, round: false },
            magical:     { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            slashing:    { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            piercing:    { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            bludgeoning: { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            fire:        { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            ice:         { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            poison:      { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            wind:        { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            water:       { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            bleed:       { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            curse:       { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            necrotic:    { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            earth:       { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
            dummy:       { chance: 0.0,   'scale-by-level': 1.0,   min: 0,   max: 0,   'flat-range': false, round: false },
          },
        },
        'defense-types': {
          minimum: 1, maximum: 2,
          'lore-format': [
            '%DEFENSE_PHYSICAL%', '%DEFENSE_MAGICAL%', '%DEFENSE_POISON%', '%DEFENSE_FIRE%',
            '%DEFENSE_WATER%', '%DEFENSE_WIND%', '',
            '%DEFENSE_SLASHING%', '%DEFENSE_PIERCING%', '%DEFENSE_BLUDGEONING%',
            '%DEFENSE_ICE%', '%DEFENSE_BLEED%', '%DEFENSE_CURSE%', '%DEFENSE_NECROTIC%',
            '%DEFENSE_WEAPON%', '%DEFENSE_ELEMENTAL%', '%DEFENSE_EARTH%',
          ],
          list: {
            physical:    { chance: 100.0, 'scale-by-level': 1.025, min: 3.25, max: 8.75, 'flat-range': false, round: false },
            magical:     { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            slashing:    { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            piercing:    { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            bludgeoning: { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            fire:        { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            ice:         { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            poison:      { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            wind:        { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            water:       { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            bleed:       { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            curse:       { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            necrotic:    { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            weapon:      { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            elemental:   { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
            earth:       { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,    'flat-range': false, round: false },
          },
        },
        'item-stats': {
          minimum: 1, maximum: 4,
          'lore-format': [
            '%ITEM_STAT_AOE_DAMAGE%', '%ITEM_STAT_CRITICAL_RATE%', '%ITEM_STAT_CRITICAL_DAMAGE%',
            '%ITEM_STAT_SKILL_CRITICAL_RATE%', '%ITEM_STAT_SKILL_CRITICAL_DAMAGE%',
            '%ITEM_STAT_ACCURACY_RATE%', '%ITEM_STAT_DODGE_RATE%', '%ITEM_STAT_BLOCK_RATE%',
            '%ITEM_STAT_BLOCK_DAMAGE%', '%ITEM_STAT_LOOT_RATE%', '%ITEM_STAT_MOVEMENT_SPEED%',
            '%ITEM_STAT_BASE_ATTACK_SPEED%', '%ITEM_STAT_ATTACK_SPEED%', '%ITEM_STAT_MAX_HEALTH%',
            '%ITEM_STAT_MAX_MANA%', '%ITEM_STAT_MANA_REGEN%', '%ITEM_STAT_HEALTH_REGEN%',
            '%ITEM_STAT_PENETRATION%', '%ITEM_STAT_VAMPIRISM%', '%ITEM_STAT_BURN_RATE%',
            '%ITEM_STAT_PVP_DEFENSE%', '%ITEM_STAT_THORNMAIL%',
            '%ITEM_STAT_BLEED_RATE%', '%ITEM_STAT_SALE_PRICE%',
            '%ITEM_STAT_DISARM_RATE%', '%ITEM_STAT_PVE_DAMAGE%', '%ITEM_STAT_PVP_DAMAGE%',
            '%ITEM_STAT_PVE_DEFENSE%', '%ITEM_STAT_ARMOR_TOUGHNESS%', '',
            '%ITEM_STAT_DURABILITY%', '',
            '%ITEM_STAT_SCALE%', '%ITEM_STAT_KNOCKBACK_RESISTANCE%',
            '%ITEM_STAT_HEALING_CAST%', '%ITEM_STAT_ARMOR%', '%ITEM_STAT_CC_RESISTANCE%',
            '%ITEM_STAT_HEALING_RECEIVED%', '%ITEM_STAT_CC_DURATION%',
          ],
          list: {
            critical_rate:        { chance: 20.0,  'scale-by-level': 1.025, min: 3.0,  max: 6.25,  'flat-range': false, round: false },
            critical_damage:      { chance: 20.0,  'scale-by-level': 1.025, min: 1.1,  max: 1.25,  'flat-range': false, round: false },
            skill_critical_rate:  { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            skill_critical_damage:{ chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            dodge_rate:           { chance: 10.0,  'scale-by-level': 1.025, min: 2.5,  max: 4.0,   'flat-range': false, round: false },
            accuracy_rate:        { chance: 10.0,  'scale-by-level': 1.025, min: 4.5,  max: 7.5,   'flat-range': false, round: false },
            block_rate:           { chance: 10.0,  'scale-by-level': 1.025, min: 1.5,  max: 7.0,   'flat-range': false, round: false },
            block_damage:         { chance: 10.0,  'scale-by-level': 1.025, min: 3.0,  max: 10.0,  'flat-range': false, round: false },
            vampirism:            { chance: 5.0,   'scale-by-level': 1.025, min: 1.5,  max: 4.5,   'flat-range': false, round: false },
            burn_rate:            { chance: 8.0,   'scale-by-level': 1.025, min: 4.5,  max: 12.5,  'flat-range': false, round: false },
            durability:           { chance: 100.0, 'scale-by-level': 1.025, min: 150,  max: 700,   'flat-range': false, round: false },
            penetration:          { chance: 6.0,   'scale-by-level': 1.025, min: 4.5,  max: 10.0,  'flat-range': false, round: false },
            loot_rate:            { chance: 7.5,   'scale-by-level': 1.025, min: 2.0,  max: 10.0,  'flat-range': false, round: false },
            movement_speed:       { chance: 3.5,   'scale-by-level': 1.025, min: 7.5,  max: 15.0,  'flat-range': false, round: false },
            attack_speed:         { chance: 4.75,  'scale-by-level': 1.025, min: 5.0,  max: 10.0,  'flat-range': false, round: false },
            max_health:           { chance: -1,    'scale-by-level': 1.025, min: 5.0,  max: 10.0,  'flat-range': false, round: false },
            max_mana:             { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            aoe_damage:           { chance: 5.0,   'scale-by-level': 1.025, min: 5.0,  max: 10.0,  'flat-range': false, round: false },
            range:                { chance: 20.0,  'scale-by-level': 1.025, min: 5.0,  max: 25.0,  'flat-range': false },
            armor_toughness:      { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            scale:                { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            disarm_rate:          { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            bleed_rate:           { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            sale_price:           { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            pve_damage:           { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            knockback_resistance: { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            pvp_defense:          { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            pvp_damage:           { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            base_attack_speed:    { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            thornmail:            { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            healing_cast:         { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            mana_regen:           { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            armor:                { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            health_regen:         { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            pve_defense:          { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            cc_resistance:        { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            healing_received:     { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
            cc_duration:          { chance: 0.0,   'scale-by-level': 1.0,   min: 0,    max: 0,     'flat-range': false, round: false },
          },
          'list-damage-buffs': {
            'lore-format': [
              '%DAMAGE_BUFF_PHYSICAL%', '%DAMAGE_BUFF_MAGICAL%', '%DAMAGE_BUFF_SLASHING%',
              '%DAMAGE_BUFF_PIERCING%', '%DAMAGE_BUFF_BLUDGEONING%', '%DAMAGE_BUFF_FIRE%',
              '%DAMAGE_BUFF_ICE%', '%DAMAGE_BUFF_POISON%', '%DAMAGE_BUFF_WIND%',
              '%DAMAGE_BUFF_WATER%', '%DAMAGE_BUFF_BLEED%', '%DAMAGE_BUFF_CURSE%',
              '%DAMAGE_BUFF_NECROTIC%', '%DAMAGE_BUFF_EARTH%', '%DAMAGE_BUFF_DUMMY%',
            ],
            physical:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            magical:     { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            slashing:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            piercing:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            bludgeoning: { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            fire:        { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            ice:         { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            poison:      { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            wind:        { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            water:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            bleed:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            curse:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            necrotic:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            earth:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            dummy:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
          },
          'list-defense-buffs': {
            'lore-format': [
              '%DEFENSE_BUFF_PHYSICAL%', '%DEFENSE_BUFF_MAGICAL%', '%DEFENSE_BUFF_SLASHING%',
              '%DEFENSE_BUFF_PIERCING%', '%DEFENSE_BUFF_BLUDGEONING%', '%DEFENSE_BUFF_FIRE%',
              '%DEFENSE_BUFF_ICE%', '%DEFENSE_BUFF_POISON%', '%DEFENSE_BUFF_WIND%',
              '%DEFENSE_BUFF_WATER%', '%DEFENSE_BUFF_BLEED%', '%DEFENSE_BUFF_CURSE%',
              '%DEFENSE_BUFF_NECROTIC%', '%DEFENSE_BUFF_WEAPON%', '%DEFENSE_BUFF_ELEMENTAL%',
              '%DEFENSE_BUFF_EARTH%',
            ],
            physical:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            magical:     { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            slashing:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            piercing:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            bludgeoning: { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            fire:        { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            ice:         { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            poison:      { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            wind:        { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            water:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            bleed:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            curse:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            necrotic:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            weapon:      { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            elemental:   { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            earth:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
          },
          'list-penetration': {
            'lore-format': [
              '%PENETRATION_PHYSICAL_PEN%', '%PENETRATION_MAGICAL_PEN%', '%PENETRATION_FIRE_PEN%',
              '%PENETRATION_POISON_PEN%', '%PENETRATION_WATER_PEN%', '%PENETRATION_WIND_PEN%',
              '%PENETRATION_SLASHING_PEN%', '%PENETRATION_PIERCING_PEN%', '%PENETRATION_BLUDGEONING_PEN%',
              '%PENETRATION_ICE_PEN%', '%PENETRATION_BLEED_PEN%', '%PENETRATION_CURSE_PEN%',
              '%PENETRATION_NECROTIC_PEN%', '%PENETRATION_EARTH_PEN%', '%PENETRATION_DUMMY_PEN%',
            ],
            physical_pen:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            magical_pen:     { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            fire_pen:        { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            poison_pen:      { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            water_pen:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            wind_pen:        { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            slashing_pen:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            piercing_pen:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            bludgeoning_pen: { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            ice_pen:         { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            bleed_pen:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            curse_pen:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            necrotic_pen:    { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            earth_pen:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
            dummy_pen:       { chance: 0.0, 'scale-by-level': 1.0, min: 0.0, max: 0.0, 'flat-range': false, round: false },
          },
          'list-custom-stats': {
            'lore-format': [
              '%CUSTOM_STAT_SKILL_EFFECTIVNESS%', '%CUSTOM_STAT_SUMMON_POWER%', '%CUSTOM_STAT_SUMMON_HP%', '%CUSTOM_STAT_SUMMON_DURATION%',
              '%CUSTOM_STAT_PROJECTILE_COUNT%', '%CUSTOM_STAT_PROJECTILE_SPEED%',
              '%CUSTOM_STAT_BLEED_STACKS%', '%CUSTOM_STAT_BLEED_DURATION%', '%CUSTOM_STAT_BLEED_DAMAGEBUFF%',
              '%CUSTOM_STAT_STUN_STACKS%', '%CUSTOM_STAT_STUN_DURATION%',
            ],
            skill_effectivness: { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            summon_power:       { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            summon_hp:          { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            summon_duration:    { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            projectile_count:   { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            projectile_speed:   { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            bleed_stacks:       { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            bleed_duration:     { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            bleed_damagebuff:   { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            stun_stacks:        { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
            stun_duration:      { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false, round: false },
          },
        },
        'fabled-attributes': {
          minimum: 1, maximum: 4,
          'lore-format': [
            '%FABLED_ATTRIBUTE_VITALITY%', '%FABLED_ATTRIBUTE_SPIRIT%', '%FABLED_ATTRIBUTE_INTELLIGENCE%',
            '%FABLED_ATTRIBUTE_DEXTERITY%', '%FABLED_ATTRIBUTE_STRENGTH%', '%FABLED_ATTRIBUTE_STAMINA%',
          ],
          list: {
            vitality:     { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false },
            dexterity:    { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false },
            intelligence: { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false },
            spirit:       { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false },
            stamina:      { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false },
            strength:     { chance: 0.0, 'scale-by-level': 1.0, min: 0, max: 0, 'flat-range': false },
          },
        },
        sockets: {
          GEM: {
            minimum: 0, maximum: 2,
            'lore-format': ['&8&m               &f  「 GEMS 」  &8&m               ', '%SOCKET_GEM_COMMON%', '%SOCKET_GEM_RARE%'],
            list: { common: { chance: 35.0 }, rare: { chance: 15.0 } },
          },
          ESSENCE: {
            minimum: 0, maximum: 2,
            'lore-format': ['&8&m               &f  「 ESSENCES 」  &8&m               ', '%SOCKET_ESSENCE_DEFAULT%'],
            list: { default: { chance: 35.0 } },
          },
          RUNE: {
            minimum: 0, maximum: 2,
            'lore-format': ['&8&m               &f  「 RUNES 」  &8&m               ', '%SOCKET_RUNE_DEFAULT%'],
            list: { default: { chance: 35.0 } },
          },
        },
        skills: {
          minimum: 10, maximum: 10,
          list: {
            'ability-1': { chance: 0.0, 'min-level': 1, 'max-level': 1, 'lore-format': ['&bSample Ability: &7[&f%level%&7]'] },
            Assasin:     { chance: 100.0, 'min-level': 1, 'max-level': 1, 'lore-format': ['&bAssasin &7Lvl. &f%level%'] },
          },
        },
        'shield-patterns': {
          random: true,
          'base-colors': ['LIGHT_GRAY', 'GRAY'],
          'pattern-colors': ['LIGHT_GRAY', 'GRAY'],
          patterns: ['BASE', 'BORDER'],
        },
      },
    },

    weapon: {
      name: '%BASE_NAME% %prefix_tier% %item_type%',
       lore: [
        '%%BASE_LORE%%',
        '&7Tier: %TIER_NAME%', '&7Level: &f%ITEM_LEVEL%', '',
        '%ITEM_AMMO%', '%ITEM_HAND%', '%ENCHANTS%', '',
        '%USER_CLASS%', '%USER_BANNED_CLASS%', '%USER_LEVEL%', '',
        '%ITEM_SET%',
        '', '%GENERATOR_SKILLS%',
        '%GENERATOR_DEFENSE%', '%GENERATOR_DAMAGE%',
        '%GENERATOR_DAMAGE_BUFFS%', '%GENERATOR_DEFENSE_BUFFS%', '%GENERATOR_PENETRATION%', '%GENERATOR_CUSTOM_STATS%',
        '%GENERATOR_STATS%', '%GENERATOR_FABLED_ATTR%',
        '%GENERATOR_SOCKETS_GEM%', '%GENERATOR_SOCKETS_ESSENCE%', '%GENERATOR_SOCKETS_RUNE%',
      ],
      tier: 'common', unbreakable: false, 'item-flags': ['*'], color: '-1,-1,-1',
      level: { min: 1, max: 50 },
      generator: {
        'prefix-chance': 80.0, 'suffix-chance': 0.0,
        materials: { reverse: false, 'black-list': [] },
        enchantments: { minimum: 1, maximum: 2, 'safe-only': false, list: {} },
        'damage-types': {
          minimum: 1, maximum: 1,
          'lore-format': ['%DAMAGE_PHYSICAL%'],
          list: { physical: { chance: 100, 'scale-by-level': 1.025, min: 3, max: 8, 'flat-range': false } },
        },
        'item-stats': {
          minimum: 1, maximum: 3,
          'lore-format': ['%ITEM_STAT_CRITICAL_RATE%', '%ITEM_STAT_CRITICAL_DAMAGE%'],
          list: {},
        },
        sockets: {
          GEM:     { minimum: 0, maximum: 2, 'lore-format': ['%SOCKET_GEM_COMMON%'], list: { common: { chance: 35 } } },
          ESSENCE: { minimum: 0, maximum: 1, 'lore-format': ['%SOCKET_ESSENCE_DEFAULT%'], list: { default: { chance: 25 } } },
          RUNE:    { minimum: 0, maximum: 1, 'lore-format': ['%SOCKET_RUNE_DEFAULT%'], list: { default: { chance: 20 } } },
        },
      },
    },

    armor: {
      name: '%BASE_NAME% %prefix_tier% %item_type%',
       lore: [
        '%%BASE_LORE%%',
        '&7Tier: %TIER_NAME%', '&7Level: &f%ITEM_LEVEL%', '',
        '%ITEM_AMMO%', '%ITEM_HAND%', '%ENCHANTS%', '',
        '%USER_CLASS%', '%USER_BANNED_CLASS%', '%USER_LEVEL%', '',
        '%ITEM_SET%',
        '', '%GENERATOR_SKILLS%',
        '%GENERATOR_DEFENSE%', '%GENERATOR_DAMAGE%',
        '%GENERATOR_DAMAGE_BUFFS%', '%GENERATOR_DEFENSE_BUFFS%', '%GENERATOR_PENETRATION%', '%GENERATOR_CUSTOM_STATS%',
        '%GENERATOR_STATS%', '%GENERATOR_FABLED_ATTR%',
        '%GENERATOR_SOCKETS_GEM%', '%GENERATOR_SOCKETS_ESSENCE%', '%GENERATOR_SOCKETS_RUNE%',
      ],
      tier: 'common', unbreakable: false, 'item-flags': ['*'], color: '-1,-1,-1',
      level: { min: 1, max: 50 },
      generator: {
        'prefix-chance': 80.0, 'suffix-chance': 0.0,
        materials: { reverse: false, 'black-list': [] },
        enchantments: { minimum: 1, maximum: 2, 'safe-only': false, list: {} },
        'defense-types': {
          minimum: 1, maximum: 1,
          'lore-format': ['%DEFENSE_PHYSICAL%'],
          list: { physical: { chance: 100, 'scale-by-level': 1.025, min: 3, max: 8, 'flat-range': false } },
        },
        'item-stats': {
          minimum: 1, maximum: 3,
          'lore-format': ['%ITEM_STAT_MAX_HEALTH%', '%ITEM_STAT_DODGE_RATE%'],
          list: {},
        },
        sockets: {
          GEM:     { minimum: 0, maximum: 2, 'lore-format': ['%SOCKET_GEM_COMMON%'], list: { common: { chance: 35 } } },
          ESSENCE: { minimum: 0, maximum: 1, 'lore-format': ['%SOCKET_ESSENCE_DEFAULT%'], list: { default: { chance: 25 } } },
          RUNE:    { minimum: 0, maximum: 1, 'lore-format': ['%SOCKET_RUNE_DEFAULT%'], list: { default: { chance: 20 } } },
        },
      },
    },

  },

  sets: {

    wildcat: {
      name: '&eWild Cat Set',
      prefix: '&a&fBroken ',
      suffix: 'of Wild Cat',
      color: { active: '&a', inactive: '&8' },
      elements: {
        helmet:     { materials: ['GOLDEN_HELMET'],     name: '%prefix%Helmet %suffix%'     },
        chestplate: { materials: ['GOLDEN_CHESTPLATE'], name: '%prefix%Chestplate %suffix%' },
        leggings:   { materials: ['GOLDEN_LEGGINGS'],   name: '%prefix%Leggings %suffix%'   },
        boots:      { materials: ['GOLDEN_BOOTS'],      name: '%prefix%Boots %suffix%'      },
      },
      bonuses: { 'by-elements-amount': {
        '2': {
          lore: ['%c%&lSet Bonuses (2/4):', '%c%▸ +25% PvE Damage', '%c%▸ +10 Max. Health', '%c%▸ Speed I'],
          'item-stats': { MAX_HEALTH: 10.0, PVE_DAMAGE: 25 },
          'damage-types': {}, 'defense-types': {},
          'potion-effects': { SPEED: 1 },
        },
      } },
    },

  },

  gems: {

    'gold-nugget-agility': {
      material: 'GOLD_NUGGET',
      name: 'Nugget of Agility',
      'socket-display': '&aAgility Nugget %ITEM_LEVEL_ROMAN% &7(&fDodge +%ITEM_STAT_DODGE_RATE%%&7)',
      lore: ['&7Dodge Rate: &f+%ITEM_STAT_DODGE_RATE%%'],
      tier: 'rare', enchanted: false, 'item-flags': ['*'],
      level: { min: 1, max: 3 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '40:80', '2': '35:70', '3': '30:60' },
      'bonuses-by-level': {
        '1': { 'item-stats': { DODGE_RATE: 2.0 },  'damage-types': {}, 'defense-types': {} },
        '2': { 'item-stats': { DODGE_RATE: 2.5 },  'damage-types': {}, 'defense-types': {} },
        '3': { 'item-stats': { DODGE_RATE: 3.0 },  'damage-types': {}, 'defense-types': {} },
      },
      'target-requirements': { level: { '1': '1:10', '2': '10:20', '3': '30' }, type: ['ARMOR'], socket: 'common', module: ['*'] },
    },

    'iron-nugget-defense': {
      material: 'IRON_NUGGET',
      name: 'Nugget of Defense',
      'socket-display': '&aDefense Nugget %ITEM_LEVEL_ROMAN% &7(&fPhys. Def. +%DEFENSE_PHYSICAL%%&7)',
      lore: ['&7Physical Defense: &f+%DEFENSE_PHYSICAL%%'],
      tier: 'rare', enchanted: false, 'item-flags': ['*'],
      level: { min: 1, max: 3 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '40:80', '2': '35:70', '3': '30:60' },
      'bonuses-by-level': {
        '1': { 'item-stats': {}, 'damage-types': {}, 'defense-types': { physical: '1.5%'  } },
        '2': { 'item-stats': {}, 'damage-types': {}, 'defense-types': { physical: '1.75%' } },
        '3': { 'item-stats': {}, 'damage-types': {}, 'defense-types': { physical: '2.0%'  } },
      },
      'target-requirements': { level: { '1': '1:10', '2': '10:20', '3': '30' }, type: ['ARMOR'], socket: 'common', module: ['*'] },
    },

    'emerald-health': {
      material: 'EMERALD',
      name: 'Emerald of Health',
      'socket-display': '&aHealth Emerald %ITEM_LEVEL_ROMAN% &7(&fHP +%ITEM_STAT_MAX_HEALTH%&7)',
      lore: ['&7Max. Health: &f+%ITEM_STAT_MAX_HEALTH%'],
      enchanted: false, tier: 'rare', 'item-flags': ['*'],
      level: { min: 1, max: 3 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '40:80', '2': '35:70', '3': '30:60' },
      'bonuses-by-level': {
        '1': { 'item-stats': { MAX_HEALTH: 0.5 }, 'damage-types': {}, 'defense-types': {} },
        '2': { 'item-stats': { MAX_HEALTH: 1.0 }, 'damage-types': {}, 'defense-types': {} },
        '3': { 'item-stats': { MAX_HEALTH: 1.5 }, 'damage-types': {}, 'defense-types': {} },
      },
      'target-requirements': { level: { '1': '1:10', '2': '10:20', '3': '30' }, type: ['ARMOR'], socket: 'rare', module: ['*'] },
    },

    'diamond-damage': {
      material: 'DIAMOND',
      name: 'Diamond of Damage',
      'socket-display': '&6Damage Diamond %ITEM_LEVEL_ROMAN% &7(&fAll Dmg. +%DAMAGE_PHYSICAL%%&7)',
      lore: ['&7All Damage: &f+%DAMAGE_PHYSICAL%%'],
      enchanted: false, 'item-flags': ['*'], tier: 'eternal',
      level: { min: 1, max: 1 },
      'uses-by-level': { '1': 3 },
      'success-rate-by-level': { '1': '40:80', '2': '35:70', '3': '30:60' },
      'bonuses-by-level': {
        '1': { 'item-stats': {}, 'damage-types': { physical: '3.5%', magical: '3.5%', fire: '3.5%', poison: '3.5%', wind: '3.5%', water: '3.5%' }, 'defense-types': {}, skills: { 'ability-1': { level: 1, 'lore-format': ['&bSample Ability: &7[&f%level%&7]'] } } },
        '2': { 'item-stats': {}, 'damage-types': { physical: '5%',   magical: '5%',   fire: '5%',   poison: '5%',   wind: '5%',   water: '5%'   }, 'defense-types': {} },
        '3': { 'item-stats': {}, 'damage-types': { physical: '7.5%', magical: '7.5%', fire: '7.5%', poison: '7.5%', wind: '7.5%', water: '7.5%' }, 'defense-types': {} },
      },
      'target-requirements': { level: { '1': '10' }, type: ['WEAPON'], socket: 'common', module: ['*'] },
    },

  },

  essences: {

    'light-trail': {
      material: 'GLOWSTONE_DUST',
      name: 'Essence of Trail',
      lore: ['&7Creates a &fLight Trail %ITEM_LEVEL_ROMAN% &7behind you.'],
      'socket-display': '&eLight Trail %ITEM_LEVEL_ROMAN%',
      enchanted: true, 'item-flags': ['*'], tier: 'common',
      level: { min: 1, max: 1 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '75', '2': '30 * %ITEM_LEVEL%', '3': '30:50' },
      effect: { type: 'FOOT', name: 'DUST:225,225,125', speed: 0.2, amount: 15, 'offset-x': 0.25, 'offset-y': 0.1, 'offset-z': 0.25 },
      'target-requirements': { type: ['ARMOR'], level: { '1': 10 }, module: ['*'], socket: 'default' },
    },

    'magic-helix': {
      material: 'REDSTONE',
      name: 'Essence of Magic',
      lore: ['&7Creates a &fMagic Helix %ITEM_LEVEL_ROMAN% &7around you.'],
      'socket-display': '&cMagic Helix %ITEM_LEVEL_ROMAN%',
      enchanted: true, 'item-flags': ['*'], tier: 'rare',
      level: { min: 1, max: 2 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '75', '2': '30 * %ITEM_LEVEL%', '3': '30:50' },
      effect: { type: 'HELIX', name: 'WITCH', speed: 0, amount: 1, 'offset-x': 0, 'offset-y': 0, 'offset-z': 0 },
      'target-requirements': { type: ['ARMOR'], level: { '1': 10 }, module: ['*'], socket: 'default' },
    },

  },

  runes: {

    jump: {
      material: 'PRISMARINE_SHARD', name: 'Rune of Jump',
      lore: ['&7Grants &fJump %ITEM_LEVEL_ROMAN% &7effect'],
      'socket-display': '&bRune: Jump %ITEM_LEVEL_ROMAN%',
      'item-flags': ['*'], tier: 'common',
      level: { min: 1, max: 3 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '75', '2': '30 * %ITEM_LEVEL%', '3': '30:50' },
      effect: 'JUMP_BOOST',
      'target-requirements': { type: ['ARMOR'], level: { '1': '10', '2': '20', '3': '30' }, module: ['*'], socket: 'default' },
    },

    absorb: {
      material: 'PRISMARINE_SHARD', name: 'Rune of Absorption',
      lore: ['&7Grants &fAbsorption %ITEM_LEVEL_ROMAN% &7effect'],
      'socket-display': '&bRune: Absorption %ITEM_LEVEL_ROMAN%',
      'item-flags': ['*'], tier: 'superior',
      level: { min: 1, max: 2 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '75', '2': '30 * %ITEM_LEVEL%', '3': '30:50' },
      effect: 'ABSORPTION',
      'target-requirements': { type: ['ARMOR'], level: { '1': '10', '2': '20', '3': '30' }, module: ['*'], socket: 'default' },
    },

    strength: {
      material: 'PRISMARINE_SHARD', name: 'Rune of Strength',
      lore: ['&7Grants &fStrength %ITEM_LEVEL_ROMAN% &7effect'],
      'socket-display': '&bRune: Strength %ITEM_LEVEL_ROMAN%',
      'item-flags': ['*'], tier: 'rare',
      level: { min: 1, max: 3 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '75', '2': '30 * %ITEM_LEVEL%', '3': '30:50' },
      effect: 'STRENGTH',
      'target-requirements': { type: ['WEAPON'], level: { '1': '10', '2': '20', '3': '30' }, module: ['*'], socket: 'default' },
    },

    speed: {
      material: 'PRISMARINE_SHARD', name: 'Rune of Speed',
      lore: ['&7Grants &fSpeed %ITEM_LEVEL_ROMAN% &7effect'],
      'socket-display': '&bRune: Speed %ITEM_LEVEL_ROMAN%',
      'item-flags': ['*'], tier: 'rare',
      level: { min: 1, max: 3 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '75', '2': '30 * %ITEM_LEVEL%', '3': '30:50' },
      effect: 'SPEED',
      'target-requirements': { type: ['boots'], level: { '1': '10', '2': '20', '3': '30' }, module: ['*'], socket: 'default' },
    },

    resist: {
      material: 'PRISMARINE_SHARD', name: 'Rune of Resistance',
      lore: ['&7Grants &fResistance %ITEM_LEVEL_ROMAN% &7effect'],
      'socket-display': '&bRune: Resistance %ITEM_LEVEL_ROMAN%',
      'item-flags': ['*'], tier: 'fabled',
      level: { min: 1, max: 1 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '75', '2': '30 * %ITEM_LEVEL%', '3': '30:50' },
      effect: 'RESISTANCE',
      'target-requirements': { type: ['chestplate'], level: { '1': '10', '2': '20', '3': '30' }, module: ['*'], socket: 'default' },
    },

    luck: {
      material: 'PRISMARINE_SHARD', name: 'Rune of Luck',
      lore: ['&7Grants &fLuck %ITEM_LEVEL_ROMAN% &7effect'],
      'socket-display': '&bRune: Luck %ITEM_LEVEL_ROMAN%',
      'item-flags': ['*'], tier: 'common',
      level: { min: 1, max: 1 },
      'uses-by-level': { '1': 1 },
      'success-rate-by-level': { '1': '75', '2': '30 * %ITEM_LEVEL%', '3': '30:50' },
      effect: 'LUCK',
      'target-requirements': { type: ['WEAPON'], level: { '1': '10', '2': '20', '3': '30' }, module: ['*'], socket: 'default' },
    },

  },

  arrows: {

    pierce: {
      material: 'ARROW', name: 'Piercing Arrow',
      lore: ['&f⚔ &7Arrow Damage: &c-10%', '&f⚔ &7Enemy Defense: &a-50%', '', '&7This arrow will &fignore 50%&7 of enemy', '&7defense, but doing &f10% less &7damage.'],
      tier: 'common', level: { min: 1, max: 1 },
      'bonuses-by-level': {
        '1': { 'additional-stats': {}, 'additional-damage': { physical: '-10.0%' }, 'defense-ignoring': { physical: '50.0%' } },
      },
      'on-fly-actions': {
        default: {
          'target-selectors': { self: ['[SELF]'] },
          conditions: { list: [], 'actions-on-fail': 'null' },
          'action-executors': ['[PARTICLE_SIMPLE] ~name: REDSTONE:255,255,255; ~amount: 1; ~offset:0,0,0; ~speed: 0; ~target: self;'],
        },
      },
      'on-hit-actions': {
        default: {
          'target-selectors': { sight: ['[FROM_SIGHT] ~distance: 3; ~party-member: false; ~attackable: true; ~allow-self: false;'] },
          conditions: { list: [], 'actions-on-fail': 'null' },
          'action-executors': ['[PARTICLE_SIMPLE] ~name: ITEM_CRACK:IRON_SWORD; ~offset:0.2,0.2,0.2; ~speed: 0.2; ~amount: 50; ~target: sight;'],
        },
      },
      'target-requirements': {},
    },

    flame: {
      material: 'ARROW', name: 'Flame Arrow',
      lore: ['&f⚔ &7Fire Damage: &a+10%', '&f⚔ &7Fire Defense: &c-3%', '', '&7This arrow will &fignite&7 the enemy', '&7for &f5 seconds&7 on hit.'],
      tier: 'common', level: { min: 1, max: 1 },
      'bonuses-by-level': {
        '1': { 'additional-stats': { BURN_RATE: 100.0 }, 'additional-damage': { fire: '10.0%' }, 'defense-ignoring': { fire: '3.0%' } },
      },
      'on-fly-actions': {
        default: {
          'target-selectors': { self: ['[SELF]'] },
          conditions: { list: [], 'actions-on-fail': 'null' },
          'action-executors': ['[PARTICLE_SIMPLE] ~name: FLAME; ~amount: 1; ~offset:0,0,0; ~speed: 0; ~target: self;'],
        },
      },
      'on-hit-actions': {
        default: {
          'target-selectors': { sight: ['[FROM_SIGHT] ~distance: 3; ~party-member: false; ~attackable: true; ~allow-self: false;'] },
          conditions: { list: [], 'actions-on-fail': 'null' },
          'action-executors': ['[PARTICLE_SIMPLE] ~name: LAVA; ~offset:0.3,0.3,0.3; ~speed: 0.2; ~amount: 20; ~target: sight;'],
        },
      },
      'target-requirements': {},
    },

    'snowball-explosive': {
      material: 'SNOWBALL', name: 'Explosive Snowball',
      lore: ['&f⚔ &7Dodge Rate: &c-10%', '&f⚔ &7Burn Rate: &a+15%', '', '&7This arrow will &fexplode &7on', '&7hit and damage all enemies in a', '&7range of &f5 blocks&7.'],
      tier: 'common', level: { min: 1, max: 1 },
      'bonuses-by-level': {
        '1': { 'additional-stats': { BURN_RATE: 15.0, DODGE_RATE: -10.0 }, 'additional-damage': { physical: '10%' }, 'defense-ignoring': {} },
      },
      'on-fly-actions': {
        default: {
          'target-selectors': { self: ['[SELF]'] },
          conditions: { list: [], 'actions-on-fail': 'null' },
          'action-executors': ['[PARTICLE_SIMPLE] ~name: SMOKE_NORMAL; ~amount: 1; ~offset:0,0,0; ~speed: 0; ~target: self;'],
        },
      },
      'on-hit-actions': {
        default: {
          'target-selectors': {
            near: ['[RADIUS] ~distance: 5; ~party-member: false; ~attackable: true; ~allow-self: false;'],
            all:  ['[RADIUS] ~distance: 5; ~allow-self: true;'],
            self: ['[SELF]'],
          },
          conditions: { list: [], 'actions-on-fail': 'null' },
          'action-executors': [
            '[PARTICLE_SIMPLE] ~name: EXPLOSION_LARGE; ~offset:2,2,2; ~speed: 0.1; ~amount: 50; ~target: self;',
            '[SOUND] ~name: ENTITY_GENERIC_EXPLODE; ~target: all;',
            '[DAMAGE] ~amount: -50%; ~target: near;',
          ],
        },
      },
      'target-requirements': {},
    },

    'arrow-explosive': {
      material: 'ARROW', name: 'Explosive Arrow',
      lore: ['&f⚔ &7Dodge Rate: &c-10%', '&f⚔ &7Burn Rate: &a+15%', '', '&7This arrow will &fexplode &7on', '&7hit and damage all enemies in a', '&7range of &f5 blocks&7.'],
      tier: 'common', level: { min: 1, max: 1 },
      'bonuses-by-level': {
        '1': { 'additional-stats': { BURN_RATE: 15.0, DODGE_RATE: -10.0 }, 'additional-damage': { physical: '10%' }, 'defense-ignoring': {} },
      },
      'on-fly-actions': {
        default: {
          'target-selectors': { self: ['[SELF]'] },
          conditions: { list: [], 'actions-on-fail': 'null' },
          'action-executors': ['[PARTICLE_SIMPLE] ~name: SMOKE_NORMAL; ~amount: 1; ~offset:0,0,0; ~speed: 0; ~target: self;'],
        },
      },
      'on-hit-actions': {
        default: {
          'target-selectors': {
            near: ['[RADIUS] ~distance: 5; ~party-member: false; ~attackable: true; ~allow-self: false;'],
            all:  ['[RADIUS] ~distance: 5; ~allow-self: true;'],
            self: ['[SELF]'],
          },
          conditions: { list: [], 'actions-on-fail': 'null' },
          'action-executors': [
            '[PARTICLE_SIMPLE] ~name: EXPLOSION_LARGE; ~offset:2,2,2; ~speed: 0.1; ~amount: 50; ~target: self;',
            '[SOUND] ~name: ENTITY_GENERIC_EXPLODE; ~target: all;',
            '[DAMAGE] ~amount: -50%; ~target: near;',
          ],
        },
      },
      'target-requirements': {},
    },

  },

  consumables: {

    'small-loot-potion': {
      material: 'POTION',
      name: '&eSmall Loot Potion %ITEM_LEVEL_ROMAN%',
      lore: ['%ITEM_CHARGES%', '&7Cooldown: &f1 minute&7.', '', '%USER_LEVEL%', '%USER_CLASS%', '', '&7Increases a chance to find the item', '&7by &f10%&7 for &f10 minutes&7.'],
      tier: 'common',
      'skull-hash': 'eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvNjZkM2E3ZTA3ZjVkYWRkNDdiYWRiMTM4MmE1YjE2Mjc4MThlZTE2YTE5YTdjMGJmMjc2OGFlNjI2MjczN2I2In19fQ==',
      color: '220,220,30',
      'item-flags': ['*'], enchanted: false,
      level: { min: 1, max: 3 },
      effects: { health: 0, hunger: 0, saturation: 0 },
      'user-requirements-by-level': { level: { '1': 10 }, class: { '1': 'Warrior,Berserker' } },
      'uses-by-level': { '1': 1, '2': 2, '3': 3 },
      usage: {
        RIGHT: {
          cooldown: 1,
          actions: {
            default: {
              'target-selectors': { self: ['[SELF]'] },
              conditions: { list: [], 'actions-on-fail': 'null' },
              'action-executors': [
                '[COMMAND_CONSOLE] ~message: qrpg buff %executor% stat LOOT_RATE 10 600; ~target: self;',
                '[PARTICLE_SIMPLE] ~name: VILLAGER_HAPPY; ~offset: 0.3,0.3,0.3; ~speed: 0.3; ~amount: 50; ~target: self;',
                '[SOUND] ~name: BLOCK_NOTE_BLOCK_BELL; ~target: self;',
              ],
            },
          },
        },
      },
      'target-requirements': {},
    },

    'small-health-potion': {
      material: 'POTION',
      name: '&a&fSmall Health Potion',
      lore: ['%ITEM_CHARGES%', '&7Cooldown: &f10 seconds&7.', '', '%USER_LEVEL%', '%USER_CLASS%', '', '&7Restores &f5 HP&7.'],
      tier: 'common',
      'skull-hash': 'eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvNjZkM2E3ZTA3ZjVkYWRkNDdiYWRiMTM4MmE1YjE2Mjc4MThlZTE2YTE5YTdjMGJmMjc2OGFlNjI2MjczN2I2In19fQ==',
      color: '220,30,30',
      'item-flags': ['*'], enchanted: false,
      level: { min: 1, max: 1 },
      effects: { health: 5, hunger: 5, saturation: 0 },
      'user-requirements-by-level': { level: { '1': 3 }, class: { '1': 'Warrior,Mage' } },
      'uses-by-level': { '1': 3 },
      usage: {
        RIGHT: {
          cooldown: 10,
          actions: {
            default: {
              'target-selectors': { self: ['[SELF] ~entity-health: <100%;'] },
              conditions: { list: [], 'actions-on-fail': 'null' },
              'action-executors': [],
            },
          },
        },
      },
      'target-requirements': {},
    },

    burger: {
      material: 'PLAYER_HEAD',
      name: '&6Burger on a Plate',
      lore: ['&7Definitely a hearty burger.', '%ITEM_CHARGES%', '', '%USER_LEVEL%', '%USER_CLASS%', '', '&f• &7Health: &6+5❤&7.', '&f• &7Saturation: &6+3☕&7.', '&f• &7Absorption I: &6%var_potiondurationtext%&7.'],
      tier: 'common',
      'skull-hash': 'eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvNjZkM2E3ZTA3ZjVkYWRkNDdiYWRiMTM4MmE1YjE2Mjc4MThlZTE2YTE5YTdjMGJmMjc2OGFlNjI2MjczN2I2In19fQ==',
      color: '240,240,20',
      level: { min: 1, max: 3 },
      effects: { health: 5, hunger: 5, saturation: 3 },
      'user-requirements-by-level': { level: { '1': 10 }, class: { '1': 'Warrior,Berserker' } },
      'uses-by-level': { '1': 1, '2': 2, '3': 3 },
      'variables-by-level': {
        '1': { potionDuration: 300, potionDurationText: '15 sec' },
        '2': { potionDuration: 600, potionDurationText: '30 sec' },
        '3': { potionDuration: 900, potionDurationText: '45 sec' },
      },
      usage: {
        RIGHT: {
          cooldown: 10,
          actions: {
            default: {
              'target-selectors': { self: ['[SELF]'] },
              conditions: { list: [], 'actions-on-fail': 'null' },
              'action-executors': [
                '[POTION] ~name: ABSORPTION; ~amount: 1; ~duration: %var_potionduration%; ~target: self;',
                '[PARTICLE_SIMPLE] ~name: ITEM_CRACK:BREAD; ~offset: 0.1,0.1,0.1; ~speed: 0.1; ~amount: 40; ~target: self;',
                '[SOUND] ~name: ENTITY_GENERIC_EAT; ~target: self;',
              ],
            },
          },
        },
      },
      'target-requirements': {},
    },

  },

  customItems: {

    basic: {
      name:         '&fNew Item',
      lore:         [],
      material:     'IRON_INGOT',
      color:        '-1,-1,-1',
      unbreakable:  false,
      'item-flags': [],
      enchantments: {},
      'model-data': -1,
      durability:   -1,
      enchanted:    false,
      'skull-hash': '',
      'armor-trim': '',
      attributes:   {},
    },

  },

};
window.ITEM_TEMPLATES = ITEM_TEMPLATES;

// ---------------------------------------------------------------------------

function removeEntryBtn(sid, key) {
  return `<button class="btn-icon btn-del" title="${T('Remove entry')}"
    onclick="if(confirm('${T('Remove')} \\'${escJs(key)}\\'?'))APP.removeEntry('${sid}','${escJs(key)}')">🗑</button>`;
}

// ---------------------------------------------------------------------------
// Shared card helpers
// ---------------------------------------------------------------------------

function cardRow(label, content) {
  return `<div class="info-row"><span class="info-label">${label}</span><div style="flex:1">${content}</div></div>`;
}

function cardRowFormat(sid, id, format, name = '') {
  const pid     = `fmtprev-${sid}-${String(id).replace(/[^a-z0-9]/gi, '_')}`;
  const ctx     = { name, value: '100' };
  const ctxAttr = esc(JSON.stringify(ctx));
  return cardRow(T('Lore format'),
    `${editText(sid, `${id}.format`, format, 'edit-input--format')}
     <span class="mc-preview mc-preview--live" id="${pid}" data-ctx="${ctxAttr}">${mc.toHtml(mc.resolve(format, ctx))}</span>`);
}

/**
 * Name text input that also live-updates the associated format preview span.
 * The preview span must have id="fmtprev-${sid}-${safeEntryId}".
 */
function editTextName(sid, path, val, entryId) {
  const pid = `fmtprev-${sid}-${String(entryId).replace(/[^a-z0-9]/gi, '_')}`;
  return `<input class="edit-input" type="text" value="${esc(val)}"
    oninput="APP.updateField('${sid}','${escJs(path)}',this.value);updateFormatPreview(this,'${pid}')">`;
}

// ---------------------------------------------------------------------------
// Formula helpers (evalFormula used by app.js recalcFormulaPreview)
// ---------------------------------------------------------------------------

function evalFormula(formula, vars) {
  try {
    if (typeof formula !== 'string') return null;
    // Build a sandbox of variables: damage, defense, toughness, protectionFactor,
    // and any defense_<id> keys provided.
    const scope = Object.create(null);
    scope.damage           = Number.isFinite(+vars.damage)    ? +vars.damage    : 0;
    scope.defense          = Number.isFinite(+vars.defense)   ? +vars.defense   : 0;
    scope.toughness        = Number.isFinite(+vars.toughness) ? +vars.toughness : 0;
    scope.protectionFactor = Number.isFinite(+vars.protectionFactor) ? +vars.protectionFactor : 1;
    Object.entries(vars).forEach(([k, v]) => {
      if (k.startsWith('defense_') && Number.isFinite(+v)) scope[k] = +v;
    });
    // Reject any identifier we don't recognise — prevents access to globals.
    const identifiers = formula.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [];
    for (const id of identifiers) {
      if (!(id in scope)) return null;
    }
    const names  = Object.keys(scope);
    const values = names.map(n => scope[n]);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...names, `"use strict"; return (${formula});`);
    const result = fn(...values);
    return typeof result === 'number' && isFinite(result) ? Math.max(0, result) : null;
  } catch (_) { return null; }
}

/**
 * Calculate damage output using the correct formula for the active mode.
 *
 * FACTOR — Minecraft armor formula (DamageManager.java lines 339-356):
 *   factorResult = max(def/5,  def - 4*dmg/(toughness+8))
 *   finalDmg     = max(0, dmg * (1 - factorResult * protectionFactor * 0.05))
 *   Uses ONLY the single highest-priority attached defense; pf from defense.yml.
 *
 * CUSTOM — user formula evaluated via evalFormula(); all matching defenses summed first.
 *   Default: damage*(25/(25+defense))
 *   Variables: damage, defense (sum), toughness, defense_<id> (individual values).
 *
 * LEGACY — flat subtraction: max(0, damage - defense).
 *
 * @param {string} mode
 * @param {string} customExpr
 * @param {{damage:number, defense:number, toughness?:number, protectionFactor?:number}} vars
 * @returns {number|null}
 */
function evalForMode(mode, customExpr, vars) {
  if (mode === 'LEGACY') {
    // damage * (1 - defense * protectionFactor * 0.01)  — highest-prio defense only, % reduction
    const pf = vars.protectionFactor ?? 1.0;
    return Math.max(0, vars.damage * (1 - vars.defense * pf * 0.01));
  }
  if (mode === 'FACTOR') {
    const dmg = vars.damage || 0;
    const def = vars.defense || 0;
    const toughness = vars.toughness || 0;
    const pf = vars.protectionFactor ?? 1.0;
    if (def <= 0) return dmg;
    const factorResult = Math.max(def / 5, def - 4 * dmg / (toughness + 8));
    return Math.max(0, dmg * (1 - factorResult * pf * 0.05));
  }
  // CUSTOM: user-defined expression
  return evalFormula(customExpr, vars);
}

/**
 * Evaluate a Fabled Attribute stat formula string.
 * Variables: a = attribute level, v = current stat value (0 in build context).
 * Returns 0 on syntax error.
 */
function evalFaFormula(formula, a) {
  try {
    if (typeof formula !== 'string') return 0;
    // eslint-disable-next-line no-new-func
    const r = Number(new Function('a', 'v', `"use strict"; return (${formula})`)(a, 0));
    return Number.isFinite(r) ? r : 0;
  } catch (_) {
    return 0;
  }
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
  const legacy  = combat['legacy-combat'] === true;
  // Vanilla engine.yml has only legacy-combat (no defense-formula key) — derive.
  let mode;
  if (isVanilla() && combat['defense-formula'] == null) {
    mode = legacy ? 'LEGACY' : 'FACTOR';
  } else {
    mode = String(combat['defense-formula'] || 'FACTOR').toUpperCase();
  }
  const customF = combat['custom-defense-formula'] || 'damage*(25/(25+defense))';
  const modeDef = SCHEMA.formulaModes[mode] || SCHEMA.formulaModes['FACTOR'];
  const ovPenAmp    = combat['overflow-pen-amplifies']    === true;
  const ovPenForm   = combat['overflow-pen-formula']      || 'damage*(overflow/100)';
  const ovNegAmp    = combat['overflow-negdef-amplifies'] === true;
  const ovNegForm   = combat['overflow-negdef-formula']   || 'damage*(overflow/100)';
  const basePath    = data.combat ? 'combat.' : '';

  const vanillaCustomWarn = isVanilla() && mode === 'CUSTOM'
    ? `<div class="alert alert-warn">⚠️ ${T('CUSTOM formula is set but disabled in Vanilla mode. Switch to FACTOR or LEGACY, or change build mode to Modded.')}</div>`
    : '';

  const modeButtons = Object.entries(SCHEMA.formulaModes)
    .filter(([m]) => !isVanilla() || m !== 'CUSTOM')
    .map(([m, def]) => {
      const active = m === mode
        ? `style="border-color:${def.color};color:${def.color};background:${def.color}18"` : '';
      return `<span class="mode-btn mode-btn--click" ${active}
        onclick="APP.setFormulaMode('${sid}','${m}')" title="${T(def.description)}">${m}${m === mode ? ' ✓' : ''}</span>`;
    }).join('');

  const fPath = data.combat ? 'combat.custom-defense-formula' : 'custom-defense-formula';

  return `
    <div class="info-banner" style="border-color:${modeDef.color}">
      <div class="info-banner__title" style="color:${modeDef.color}">${T('Active mode')}: ${mode}</div>
      <div class="info-banner__desc">${T(modeDef.description)}</div>
    </div>
    ${vanillaCustomWarn}
    ${legacy ? `<div class="alert alert-warn">⚠️ <b>legacy-combat: true</b> ${T('is enabled.')}</div>` : ''}
    ${(modeDef.flatPenWarn && !isVanilla()) ? `<div class="alert alert-warn">⚠️ ${T('Flat penetration does not work in this mode. Requires CUSTOM.')}</div>` : ''}

    <h3>${T('Formula mode')}</h3>
    <div class="mode-btns">${modeButtons}</div>
    <p class="muted small" style="margin-top:6px">${T('Click a mode to switch.')}</p>

    ${isVanilla() ? '' : `
    <h3 style="margin-top:20px">${T('Custom defense formula')}</h3>
    <input class="edit-input edit-input--formula" type="text" value="${esc(customF)}"
           oninput="APP.updateFormulaExpr('${sid}','${fPath}',this.value)">
    <p class="muted small" style="margin-top:4px">
      ${T('Variables')}: <code>damage</code>, <code>defense</code>, <code>defense_&lt;id&gt;</code>, <code>toughness</code>
    </p>

    <h3 style="margin-top:20px">${T('Flat penetration overflow')} <span class="muted small" style="font-weight:400">${T('(CUSTOM only)')}</span></h3>
    <div class="info-row">
      <span class="info-label">${T('Amplify damage on overflow')}</span>
      <div style="flex:1">
        <input class="edit-check" type="checkbox" ${ovPenAmp ? 'checked' : ''}
          onchange="APP.updateField('${sid}','${basePath}overflow-pen-amplifies',this.checked)">
        <span class="muted small">${T('flatPen > total defense → bonus damage')}</span>
      </div>
    </div>
    <input class="edit-input edit-input--formula" type="text" value="${esc(ovPenForm)}"
      oninput="APP.updateField('${sid}','${basePath}overflow-pen-formula',this.value)">
    <p class="muted small" style="margin-top:4px">
      ${T('Variables')}: <code>damage</code>, <code>overflow</code> (flatPen − defense), <code>defense</code>
    </p>

    <h3 style="margin-top:20px">${T('Negative-defense overflow')} <span class="muted small" style="font-weight:400">${T('(CUSTOM only)')}</span></h3>
    <div class="info-row">
      <span class="info-label">${T('Amplify damage on overflow')}</span>
      <div style="flex:1">
        <input class="edit-check" type="checkbox" ${ovNegAmp ? 'checked' : ''}
          onchange="APP.updateField('${sid}','${basePath}overflow-negdef-amplifies',this.checked)">
        <span class="muted small">${T('total def < 0 → bonus damage')}</span>
      </div>
    </div>
    <input class="edit-input edit-input--formula" type="text" value="${esc(ovNegForm)}"
      oninput="APP.updateField('${sid}','${basePath}overflow-negdef-formula',this.value)">
    <p class="muted small" style="margin-top:4px">
      ${T('Variables')}: <code>damage</code>, <code>overflow</code> (|negDef|), <code>defense</code> (orig. negative)
    </p>`}

    <h3 style="margin-top:20px">${T('Formula preview')}</h3>
    <p class="muted small" style="margin-bottom:8px">
      ${T('Last row is editable — enter any damage + defense values.')}
    </p>
    <table class="tbl">
      <thead><tr><th>${T('Damage in')}</th><th>${T('Defense')}</th><th>${T('Damage out')}</th><th>${T('Reduction %')}</th></tr></thead>
      <tbody id="formula-preview-body">${buildFormulaPreviewRows(mode, customF)}</tbody>
    </table>`;
}

// ---------------------------------------------------------------------------
// General Stats (general_stats.yml)
// ---------------------------------------------------------------------------

const GENERAL_STAT_CATEGORIES = [
  { name: 'Combat',     icon: '⚔️',  ids: ['ATTACK_SPEED','BASE_ATTACK_SPEED','CRITICAL_RATE','CRITICAL_DAMAGE','SKILL_CRITICAL_RATE','SKILL_CRITICAL_DAMAGE','ACCURACY_RATE','DODGE_RATE','BLOCK_RATE','BLOCK_DAMAGE','AOE_DAMAGE','PVP_DAMAGE','PVE_DAMAGE','BURN_RATE','LOOT_RATE','DISARM_RATE','PENETRATION'] },
  { name: 'Defense',    icon: '🛡️',  ids: ['ARMOR','ARMOR_TOUGHNESS','KNOCKBACK_RESISTANCE','EXPLOSION_KNOCKBACK_RESISTANCE','PVP_DEFENSE','PVE_DEFENSE','THORNMAIL','CC_RESISTANCE','CC_DURATION'] },
  { name: 'Health',     icon: '❤️',  ids: ['MAX_HEALTH','HEALTH_REGEN','MAX_ABSORPTION','HEALING_CAST','HEALING_RECEIVED','VAMPIRISM','FALL_DAMAGE_MULTIPLIER','SAFE_FALL_DISTANCE'] },
  { name: 'Movement',   icon: '💨',  ids: ['MOVEMENT_SPEED','FLYING_SPEED','JUMP_STRENGTH','GRAVITY','STEP_HEIGHT','WATER_MOVEMENT_EFFICIENCY','MOVEMENT_EFFICIENCY','SNEAKING_SPEED','SCALE'] },
  { name: 'Magic',      icon: '🔮',  ids: ['MAX_MANA','MANA_REGEN'] },
  { name: 'Status',     icon: '🩸',  ids: ['BLEED_RATE'] },
  { name: 'Utility',    icon: '⛏️',  ids: ['DURABILITY','SALE_PRICE','MINING_EFFICIENCY','BLOCK_BREAK_SPEED','BLOCK_INTERACTION_RANGE','ENTITY_INTERACTION_RANGE','OXYGEN_BONUS','SUBMERGED_MINING_SPEED'] },
];
const GENERAL_STAT_OTHER   = { name: 'Other',   icon: '🔧' };
const GENERAL_STAT_UNKNOWN = { name: 'Unknown', icon: '⚠️' };

// Mirror of divinity TypedStat.Type enum (divinity/stats/items/attributes/api/TypedStat.java).
// Used to flag stats in user's general_stats.yml that the plugin will not recognize.
// Last sync: 2026-05-31 (54 entries — 11 //PLACEHOLDERS moved to custom_stats.yml)
const KNOWN_PLUGIN_STATS = new Set([
  'ARMOR','ARMOR_TOUGHNESS','ATTACK_SPEED','BASE_ATTACK_SPEED','KNOCKBACK_RESISTANCE','MAX_HEALTH','MOVEMENT_SPEED',
  'AOE_DAMAGE','PVP_DAMAGE','PVE_DAMAGE','DODGE_RATE','ACCURACY_RATE','BLOCK_RATE','BLOCK_DAMAGE','LOOT_RATE','BURN_RATE',
  'PVP_DEFENSE','PVE_DEFENSE','CRITICAL_RATE','CRITICAL_DAMAGE','SKILL_CRITICAL_RATE','SKILL_CRITICAL_DAMAGE',
  'DURABILITY','PENETRATION','VAMPIRISM','BLEED_RATE','DISARM_RATE','SALE_PRICE','THORNMAIL','HEALTH_REGEN',
  'MANA_REGEN','MAX_MANA','CC_RESISTANCE','CC_DURATION','HEALING_CAST','HEALING_RECEIVED',
  'SCALE',
  'WATER_MOVEMENT_EFFICIENCY','MOVEMENT_EFFICIENCY','SNEAKING_SPEED',
  'BLOCK_BREAK_SPEED','BLOCK_INTERACTION_RANGE','ENTITY_INTERACTION_RANGE','EXPLOSION_KNOCKBACK_RESISTANCE',
  'FALL_DAMAGE_MULTIPLIER','FLYING_SPEED','GRAVITY','JUMP_STRENGTH','MAX_ABSORPTION','MINING_EFFICIENCY',
  'OXYGEN_BONUS','SAFE_FALL_DISTANCE','STEP_HEIGHT','SUBMERGED_MINING_SPEED',
]);

function _categoryForStat(id) {
  const up = String(id).toUpperCase();
  for (const c of GENERAL_STAT_CATEGORIES) if (c.ids.includes(up)) return c;
  // Plugin knows it but builder did not categorize it → Other (likely new plugin stat awaiting builder UI update).
  // Plugin does not know it → Unknown (likely typo or removed stat).
  return KNOWN_PLUGIN_STATS.has(up) ? GENERAL_STAT_OTHER : GENERAL_STAT_UNKNOWN;
}

function renderGeneralStats(data, sid) {
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');

  // Group by category, sort alphabetically inside each
  const grouped = new Map();
  for (const e of entries) {
    const cat = _categoryForStat(e[0]);
    if (!grouped.has(cat.name)) grouped.set(cat.name, { cat, items: [] });
    grouped.get(cat.name).items.push(e);
  }
  for (const g of grouped.values()) g.items.sort((a, b) => a[0].localeCompare(b[0]));

  // Render in category order, "Other" then "Unknown" last
  const orderedCats = [...GENERAL_STAT_CATEGORIES, GENERAL_STAT_OTHER, GENERAL_STAT_UNKNOWN]
    .filter(c => grouped.has(c.name));

  const rowHtml = ([id, stat]) => {
    const enabled = stat.enabled !== false;
    const enId    = safeId(sid, id, 'en');
    const isNew   = (SYNCED_NEW[sid] || new Set()).has(id);
    const cat     = _categoryForStat(id);
    return `
      <tr class="data-row${enabled ? '' : ' row-disabled'}${isNew ? ' entry-new' : ''}" data-cat="${esc(cat.name)}">
        <td>${editId(sid, id)} ${isNew ? '<span class="badge badge-blue">new</span>' : ''}</td>
        <td>${editTextName(sid, `${id}.name`, stat.name ?? id, id)}</td>
        <td>
          ${editText(sid, `${id}.format`, stat.format ?? '', 'edit-input--format')}
          <span class="mc-preview mc-preview--live" data-ctx="${esc(JSON.stringify({ name: stat.name ?? id, value: '100' }))}">
            ${mc.toHtml(mc.resolve(stat.format ?? '', { name: stat.name ?? id, value: '100' }))}
          </span>
        </td>
        <td>${editNum(sid, `${id}.capacity`, stat.capacity ?? -1)}</td>
        <td>
          ${liveCheck(sid, `${id}.enabled`, enabled, enId, 'enabled')}
          ${liveBadge(enabled, enId, 'enabled')}
        </td>
        <td>${removeEntryBtn(sid, id)}</td>
      </tr>`;
  };

  const groupsHtml = orderedCats.map(c => {
    const g = grouped.get(c.name);
    const header = `<tr class="cat-header" data-cat-header="${esc(c.name)}">
      <td colspan="6"><strong>${c.icon} ${esc(T(c.name))}</strong> <span class="muted small">(${g.items.length})</span></td>
    </tr>`;
    return header + g.items.map(rowHtml).join('');
  }).join('');

  const totalCount = entries.length;
  return `
    <div class="entry-actions"><span class="muted small">${T('General stats are a fixed set (TypedStat enum) — you can configure existing entries but not add new ones. To create a new data-driven stat, use Custom Stats.')}</span></div>
    <input class="search-input" type="text" placeholder="🔍 ${T('Search stats by ID, name, category…')}"
           oninput="APP.filterGeneralStats('tbl-general',this.value)">
    <p class="muted small" style="margin:4px 0 8px">${totalCount} ${T('stats total. Grouped by category, alphabetical within.')}</p>
    <table class="tbl" id="tbl-general">
      <thead><tr><th>ID</th><th>${T('Name')}</th><th>${T('Lore format')}</th><th>${T('Capacity')}</th><th>${T('Enabled')}</th><th></th></tr></thead>
      <tbody>${groupsHtml}</tbody>
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
    name: 'New Type', format: '&2▸ %name%: &f%value%', priority: 1,
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
        <details class="card-details" data-key="${esc(sid)}-card-${esc(id)}" open>
          <summary class="item-card__header">
            <span class="item-card__icon">🗡️</span>
            ${editId(sid, id)}
            ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
            ${removeEntryBtn(sid, id)}
          </summary>
          <div class="item-card__body">
            ${cardRow(T('Name'),     editTextName(sid, `${id}.name`, dt.name ?? id, id))}
            ${cardRow(T('Priority'), editNum(sid,  `${id}.priority`, dt.priority ?? 1, 'edit-input--inline'))}
            ${cardRowFormat(sid, id, dt.format ?? '', dt.name ?? id)}
            ${cardRow(T('Attached causes'),      lineArrayField(sid, `${id}.attached-damage-causes`,      dt['attached-damage-causes']      ?? []))}
            ${cardRow(T('Biome modifiers'),   lineKvFieldNum(sid, `${id}.biome-damage-modifiers`,      dt['biome-damage-modifiers']      ?? {}, 'BIOME multiplier'))}
            <p class="muted small" style="margin-top:-6px;margin-bottom:4px">${T('e.g.')} <code>PLAINS 1.0</code> — ${T('Bukkit Biome name.')}</p>
            ${cardRow(T('On-hit actions'),    jsonTextarea(sid, `${id}.on-hit-actions`, dt['on-hit-actions'] ?? {}))}
            ${cardRow(T('Entity modifiers'),  lineKvFieldNum(sid, `${id}.entity-type-modifier`,        dt['entity-type-modifier']        ?? {}, 'ENTITY_TYPE multiplier'))}
            <p class="muted small" style="margin-top:-6px;margin-bottom:4px">${T('e.g.')} <code>PIG 1.0</code> — ${T('Bukkit EntityType name.')}</p>
            ${cardRow(T('Faction modifiers'), lineKvFieldNum(sid, `${id}.mythic-mob-faction-modifier`, dt['mythic-mob-faction-modifier'] ?? {}, 'faction multiplier'))}
            <p class="muted small" style="margin-top:-6px;margin-bottom:4px">${T('e.g.')} <code>undead 1.5</code> — ${T('MythicMobs faction name.')}</p>
          </div>
        </details>
      </div>`;
  }).join('');

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add damage type')} ${collapseAllBtn()}</div>
    <div class="cards-grid">${cards || `<div class="empty-state">${T('No damage types found.')}</div>`}</div>`;
}

// ---------------------------------------------------------------------------
// Defense Types (defense.yml)
// ---------------------------------------------------------------------------

function renderDefense(data, sid) {
  const entries = Object.entries(data)
    .filter(([, v]) => v && typeof v === 'object')
    .sort(([, a], [, b]) => (b.priority || 0) - (a.priority || 0));

  const TPL = {
    name: 'New Defense', format: '&2▸ %name%: &f%value%', priority: 1,
    'block-damage-types': [], 'protection-factor': 1.0,
  };

  const cards = entries.map(([id, dt]) => {
    const isNew = (SYNCED_NEW[sid] || new Set()).has(id);
    return `
      <div class="item-card${isNew ? ' entry-new' : ''}">
        <details class="card-details" data-key="${esc(sid)}-card-${esc(id)}" open>
          <summary class="item-card__header">
            <span class="item-card__icon">🛡️</span>
            ${editId(sid, id)}
            ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
            ${removeEntryBtn(sid, id)}
          </summary>
          <div class="item-card__body">
            ${cardRow(T('Name'),              editTextName(sid, `${id}.name`, dt.name ?? id, id))}
            ${cardRow(T('Priority'),          editNum(sid,  `${id}.priority`, dt.priority ?? 1, 'edit-input--inline'))}
            ${cardRow(T('Protection factor'), editNum(sid,  `${id}.protection-factor`, dt['protection-factor'] ?? 1.0, 'edit-input--inline'))}
            ${cardRowFormat(sid, id, dt.format ?? '', dt.name ?? id)}
            ${cardRow(T('Blocks damage types'), lineArrayField(sid, `${id}.block-damage-types`, dt['block-damage-types'] ?? []))}
          </div>
        </details>
      </div>`;
  }).join('');

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add defense type')} ${collapseAllBtn()}</div>
    <div class="cards-grid">${cards || `<div class="empty-state">${T('No defense types found.')}</div>`}</div>`;
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
        <details class="card-details" data-key="${esc(sid)}-card-${esc(id)}" open>
          <summary class="item-card__header">
            <span class="item-card__icon">🎯</span>
            ${editId(sid, id)}
            ${liveBadge(isPct, pctId, 'percent-pen')}
            ${liveBadge(enabled, enId, 'enabled')}
            ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
            ${removeEntryBtn(sid, id)}
          </summary>
          <div class="item-card__body">
            ${cardRow(T('Name'),     editTextName(sid, `${id}.name`, pt.name ?? id, id))}
            ${cardRow(T('Capacity'), editNum(sid,  `${id}.capacity`, pt.capacity ?? 100, 'edit-input--inline'))}
            ${cardRowFormat(sid, id, pt.format ?? '', pt.name ?? id)}
            ${cardRow(T('% Pen'),
              `${liveCheck(sid, `${id}.percent-pen`, isPct, pctId, 'percent-pen')}
               <span class="muted small">${T('Checked = percent, unchecked = flat')}</span>`)}
            ${cardRow(T('Enabled'), liveCheck(sid, `${id}.enabled`, enabled, enId, 'enabled'))}
            ${cardRow(T('Hooks (damage types)'), lineArrayField(sid, `${id}.hooks`, pt.hooks ?? []))}
          </div>
        </details>
      </div>`;
  }).join('');

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add penetration stat')} ${collapseAllBtn()}</div>
    <div class="alert alert-info">
      ℹ️ ${T('<b>Flat</b> pen (unchecked) only works in CUSTOM formula mode. <b>%</b> pen (checked) works in all modes.')}
    </div>
    <div class="cards-grid">${cards || `<div class="empty-state">${T('No penetration stats.')}</div>`}</div>`;
}

// ---------------------------------------------------------------------------
// Damage / Defense Buffs — shared, card layout
// ---------------------------------------------------------------------------

function renderCustomStats(data, sid) {
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');

  const TPL = {
    name: 'New Custom Stat',
    format: '&a▸ %name%: &f%value% %condition%',
    capacity: -1,
    percent: false,
    'can-negate': true,
    enabled: true,
  };

  const cards = entries.map(([id, st]) => {
    const enabled = st.enabled !== false;
    const enId    = safeId(sid, id, 'en');
    const pcId    = safeId(sid, id, 'pc');
    const cnId    = safeId(sid, id, 'cn');
    const isNew   = (SYNCED_NEW[sid] || new Set()).has(id);
    return `
      <div class="item-card${isNew ? ' entry-new' : ''}${enabled ? '' : ' card-disabled'}">
        <details class="card-details" data-key="${esc(sid)}-card-${esc(id)}" open>
          <summary class="item-card__header">
            <span class="item-card__icon">🧩</span>
            ${editId(sid, id)}
            ${liveBadge(enabled, enId, 'enabled')}
            ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
            ${removeEntryBtn(sid, id)}
          </summary>
          <div class="item-card__body">
            ${cardRow(T('Name'),       editTextName(sid, `${id}.name`, st.name ?? id, id))}
            ${cardRow(T('Capacity (-1 = uncapped)'), editNum(sid, `${id}.capacity`, st.capacity ?? -1, 'edit-input--inline'))}
            ${cardRowFormat(sid, id, st.format ?? '', st.name ?? id)}
            ${cardRow(T('Percent (%)'),  liveCheck(sid, `${id}.percent`,    st.percent === true,        pcId, 'percent'))}
            ${cardRow(T('Can negate'),   liveCheck(sid, `${id}.can-negate`, st['can-negate'] !== false, cnId, 'can-negate'))}
            ${cardRow(T('Enabled'),      liveCheck(sid, `${id}.enabled`,    enabled,                    enId, 'enabled'))}
            <div class="info-row" style="font-size:11px;color:#8fb8ea">
              <span class="info-label">${T('Placeholder')}</span>
              <code>%Divinity_customstat_${esc(id)}%</code>
            </div>
            <div class="info-row" style="font-size:11px;color:#8fb8ea">
              <span class="info-label">${T('Fabled scale key')}</span>
              <code>custom_${esc(id)}</code>
            </div>
          </div>
        </details>
      </div>`;
  }).join('');

  const empty = `<div class="empty-state">${T('No entries. Add one — placeholder works immediately after server reload.')}</div>`;

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add custom stat')} ${collapseAllBtn()}</div>
    <div class="cards-grid">${cards || empty}</div>`;
}

function renderBuffs(data, sid) {
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');
  const isDmg   = sid === 'dmgbuff';

  const TPL = {
    name: 'New Buff', format: isDmg ? '&a+%value%%' : '&7+%value%%',
    capacity: 200, hook: [], enabled: true,
  };

  const cards = entries.map(([id, bt]) => {
    const enabled = bt.enabled !== false;
    const enId    = safeId(sid, id, 'en');
    const isNew   = (SYNCED_NEW[sid] || new Set()).has(id);
    return `
      <div class="item-card${isNew ? ' entry-new' : ''}${enabled ? '' : ' card-disabled'}">
        <details class="card-details" data-key="${esc(sid)}-card-${esc(id)}" open>
          <summary class="item-card__header">
            <span class="item-card__icon">${isDmg ? '🔥' : '🛡'}</span>
            ${editId(sid, id)}
            ${liveBadge(enabled, enId, 'enabled')}
            ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
            ${removeEntryBtn(sid, id)}
          </summary>
          <div class="item-card__body">
            ${cardRow(T('Name'),     editTextName(sid, `${id}.name`, bt.name ?? id, id))}
            ${cardRow(T('Capacity'), editNum(sid,  `${id}.capacity`, bt.capacity ?? 200, 'edit-input--inline'))}
            ${cardRowFormat(sid, id, bt.format ?? '', bt.name ?? id)}
            ${cardRow(T('Enabled'), liveCheck(sid, `${id}.enabled`, enabled, enId, 'enabled'))}
            ${cardRow(T('Hooks (damage types)'), lineArrayField(sid, `${id}.hook`, bt.hook ?? []))}
          </div>
        </details>
      </div>`;
  }).join('');

  const empty = `<div class="empty-state">${T('No entries. Auto-generated by server on startup, or add manually.')}</div>`;

  return `
    <div class="entry-actions">${addEntryBtn(sid, TPL, isDmg ? 'Add damage buff' : 'Add defense buff')} ${collapseAllBtn()}</div>
    <div class="cards-grid">${cards || empty}</div>`;
}

// ===========================================================================
// ITEM GENERATOR — multi-file, fully structured renderer
// ===========================================================================

// ---- ig* helpers (mirror of edit* but operate on multiFile STATE) ----

function igField(sid, fname, path, val, cls = '') {
  return `<input class="edit-input ${cls}" type="text" value="${esc(val)}"
    oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">`;
}

function igNum(sid, fname, path, val) {
  return `<input class="edit-input edit-input--num" type="number" value="${esc(val)}"
    oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path)}',+this.value)">`;
}

/**
 * R,G,B text field with a synced color-picker swatch.
 * Stores the value as "R,G,B" string. "-1,-1,-1" disables the picker.
 */
function igSelectField(sid, fname, path, val, options) {
  const opts = options.map(o => `<option value="${esc(o)}"${o === String(val) ? ' selected' : ''}>${esc(o)}</option>`).join('');
  return `<select class="edit-input" onchange="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">${opts}</select>`;
}

function igColorField(sid, fname, path, val) {
  const raw = String(val ?? '-1,-1,-1');
  const parts = raw.split(',').map(Number);
  const valid = parts.length === 3 && parts.every(n => n >= 0 && n <= 255);
  const hex   = valid
    ? '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('')
    : '#000000';
  const uid = `cpick-${(sid + fname + path).replace(/[^a-z0-9]/gi,'_').slice(0,40)}`;
  return `<div style="display:flex;gap:6px;align-items:center">
    <input id="${uid}-txt" class="edit-input edit-input--inline" type="text" value="${esc(raw)}" style="width:110px"
      oninput="(function(t){var p=t.split(',').map(Number);var ok=p.length===3&&p.every(function(n){return n>=0&&n<=255;});var pk=document.getElementById('${uid}-pk');if(ok)pk.value='#'+p.map(function(n){return n.toString(16).padStart(2,'0');}).join('');APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path)}',t);})(this.value)">
    <input id="${uid}-pk" type="color" value="${esc(hex)}" title="${T('Pick color')}"
      style="width:28px;height:22px;padding:1px 2px;border:1px solid #555;border-radius:3px;background:#1a1a1a;cursor:pointer;${valid?'':'opacity:0.4'}"
      oninput="(function(h){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);var s=r+','+g+','+b;var txt=document.getElementById('${uid}-txt');txt.value=s;APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path)}',s);})(this.value)">
  </div>`;
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

/**
 * Line-by-line textarea for string arrays — item-gen version (writes back via igUpdateLineArray).
 */
function igLineArray(sid, fname, path, value) {
  const arr  = Array.isArray(value) ? value : [];
  const text = arr.join('\n');
  const rows = Math.max(2, arr.length + 1);
  return `<textarea class="obj-textarea" rows="${rows}" placeholder="${T('one value per line')}"
    onblur="APP.igUpdateLineArray('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">${esc(text)}</textarea>`;
}

/**
 * Line-by-line key-value textarea for item-gen objects.
 * Format: "key value" one per line (e.g. "efficiency 1:2").
 */
function igLineKvField(sid, fname, path, value, placeholder = 'key value') {
  const obj  = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  const text = Object.entries(obj).map(([k, v]) => `${k} ${v}`).join('\n');
  const rows = Math.max(2, Object.keys(obj).length + 1);
  return `<textarea class="obj-textarea" rows="${rows}" placeholder="${T(placeholder)} (${T('one per line')})"
    onblur="APP.igUpdateLineKv('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">${esc(text)}</textarea>`;
}

/**
 * Skills list editor — min/max count + per-skill entries.
 */
function igSkillsList(sid, fname, basePath, skillsData) {
  if (!skillsData || typeof skillsData !== 'object') skillsData = {};
  const listPath = `${basePath}.list`;
  const list     = skillsData.list ?? {};

  // Collect available skill names from STATE.loaded.skills (multiFile)
  const loadedSkills = STATE.loaded?.skills;
  const skillNames = [];
  if (loadedSkills?._multiFile) {
    Object.values(loadedSkills.files || {}).forEach(fileData => {
      Object.values(fileData || {}).forEach(entry => {
        if (entry?.name && !skillNames.includes(entry.name)) skillNames.push(entry.name);
      });
    });
  }
  skillNames.sort();

  function skillNameInput(key) {
    if (skillNames.length > 0) {
      // Dropdown with free-text fallback: use <datalist>
      const listId = `skill-opts-${sid}-${escJs(fname)}-${escJs(key)}`.replace(/[^a-z0-9]/gi, '_');
      return `
        <input class="edit-input" style="flex:1;min-width:120px" value="${esc(key)}" title="Skill name (choose from list or type custom)"
          list="${listId}"
          onblur="if(this.value.trim()&&this.value.trim()!=='${escJs(key)}')APP.igRenameSkill('${sid}','${escJs(fname)}','${escJs(listPath)}','${escJs(key)}',this.value.trim())"
          onkeydown="if(event.key==='Enter')this.blur()">
        <datalist id="${listId}">${skillNames.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
    }
    return `<input class="edit-input" style="flex:1;min-width:120px" value="${esc(key)}" title="Skill name"
      onblur="if(this.value.trim()&&this.value.trim()!=='${escJs(key)}')APP.igRenameSkill('${sid}','${escJs(fname)}','${escJs(listPath)}','${escJs(key)}',this.value.trim())"
      onkeydown="if(event.key==='Enter')this.blur()">`;
  }

  const skillEntries = Object.entries(list).map(([key, sk]) => {
    if (!sk || typeof sk !== 'object') return '';
    const loreLines = sk['lore-format'] ?? [];
    return `
      <div style="border:1px solid #333;border-radius:4px;margin-bottom:6px;padding:8px 10px;background:#1a1a1a">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
          ${skillNameInput(key)}
          <span class="muted" style="font-size:11px">${T('chance%')}</span>
          <input class="edit-input edit-input--num" style="width:60px" type="number" min="0" max="100"
            value="${esc(sk.chance ?? 0)}" title="${T('Chance 0–100')}"
            oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(listPath+'.'+key+'.chance')}',+this.value)">
          <span class="muted" style="font-size:11px">${T('lvl')}</span>
          <input class="edit-input edit-input--num" style="width:50px" type="number" min="1"
            value="${esc(sk['min-level'] ?? 1)}" title="${T('Min level')}"
            oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(listPath+'.'+key+'.min-level')}',+this.value)">
          <span class="muted">–</span>
          <input class="edit-input edit-input--num" style="width:50px" type="number" min="1"
            value="${esc(sk['max-level'] ?? 1)}" title="${T('Max level')}"
            oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(listPath+'.'+key+'.max-level')}',+this.value)">
          <button style="padding:2px 6px;background:#3a1e1e;border:1px solid #8a3a3a;border-radius:3px;color:#ea8f8f;cursor:pointer;font-size:11px;margin-left:auto"
            onclick="if(confirm('${T('Remove skill')} \\'${escJs(key)}\\'?'))APP.igRemoveSkill('${sid}','${escJs(fname)}','${escJs(listPath)}','${escJs(key)}')">🗑</button>
        </div>
        ${igCollapsible(`📝 ${T('Lore')} <span class="badge" style="font-size:10px">${loreLines.length}</span>`,
          igLoreFormat(sid, fname, `${listPath}.${key}.lore-format`, loreLines), false, `${fname}:skill-lore-${key}`)}
      </div>`;
  }).join('');

  const skillHint = skillNames.length
    ? `<p class="muted small" style="margin-top:4px">${T('Loaded skills')}: ${skillNames.map(n => `<code>${esc(n)}</code>`).join(', ')}</p>`
    : `<p class="muted small" style="margin-top:4px">${T('Load skills files in <b>Combat Config → Skills</b> to enable dropdown.')}</p>`;

  return `
    <div class="info-row">
      <span class="info-label">${T('Min / Max skills')}</span>
      <div style="display:flex;gap:6px;align-items:center">
        ${igNum(sid, fname, `${basePath}.minimum`, skillsData.minimum ?? 0)}
        <span class="muted">–</span>
        ${igNum(sid, fname, `${basePath}.maximum`, skillsData.maximum ?? 0)}
      </div>
    </div>
    ${skillHint}
    <div style="margin-top:8px">${skillEntries || `<p class="muted small">${T('No skills defined yet.')}</p>`}</div>
    <button class="btn-add-entry" style="margin-top:4px"
      onclick="APP.igAddSkill('${sid}','${escJs(fname)}','${escJs(basePath)}')">+ ${T('Add skill')}</button>`;
}

/**
 * Render ammo-types or hand-types picker.
 * If the matching section is loaded, shows weight inputs per type.
 * Otherwise falls back to igLineKvField.
 */
function igTypePicker(sid, fname, path, currentVal, loadedSection, fallbackPlaceholder) {
  const loaded = STATE.loaded?.[loadedSection];
  const current = (currentVal && typeof currentVal === 'object' && !Array.isArray(currentVal)) ? currentVal : {};

  if (!loaded || typeof loaded !== 'object' || loaded._multiFile) {
    // Fallback: free-form kv textarea
    return igLineKvField(sid, fname, path, current, fallbackPlaceholder);
  }

  const typeKeys = Object.keys(loaded).filter(k => !k.startsWith('_'));
  if (typeKeys.length === 0) {
    return igLineKvField(sid, fname, path, current, fallbackPlaceholder);
  }

  // Render a weight input per type
  const rows = typeKeys.map(typeKey => {
    const weight = current[typeKey] ?? 0;
    const label  = loaded[typeKey]?.name ? `${esc(typeKey)} <span class="muted small">(${esc(loaded[typeKey].name)})</span>` : esc(typeKey);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="min-width:110px;font-size:12px">${label}</span>
      <input class="edit-input edit-input--num" style="width:70px" type="number" min="0" step="0.1"
        value="${esc(weight)}" title="${T('Weight % for')} ${esc(typeKey)}"
        oninput="APP.igUpdateTypeWeight('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(typeKey)}',+this.value)">
      <span class="muted small">%</span>
    </div>`;
  }).join('');

  return `<div style="margin-top:4px">${rows}</div>`;
}

/* ═══════════════════════════════════════════════════════
   BONUSES — per-material-modifier / per-material / per-class
   ═══════════════════════════════════════════════════════ */

/**
 * Renders a key→number multiplier map (damage-types / defense-types / fabled-attributes)
 * inside a single bonus entry. Dropdown from loaded section when available.
 */
function igBonusTypeMap(sid, fname, path, current, loadedSection, label, icon) {
  const cur = (current && typeof current === 'object') ? current : {};
  const loaded = STATE.loaded?.[loadedSection];
  const available = loaded ? Object.keys(loaded).filter(k => !k.startsWith('_')) : [];

  const rows = Object.entries(cur).map(([id, val]) => `
    <div style="display:flex;gap:5px;align-items:center;margin-bottom:2px">
      <span style="min-width:110px;font-size:11px;color:#ccc">${esc(id)}</span>
      <input class="edit-input edit-input--num" style="width:65px;font-size:11px" type="number" step="0.01"
        value="${esc(val)}"
        oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path+'.'+id)}',+this.value)">
      <button style="padding:1px 4px;background:#3a1e1e;border:1px solid #8a3a3a;border-radius:3px;color:#ea8f8f;cursor:pointer;font-size:10px;line-height:1.2"
        onclick="APP.igBonusRemoveKey('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(id)}')">✕</button>
    </div>`).join('');

  const toAdd = available.filter(k => !Object.prototype.hasOwnProperty.call(cur, k));
  const addEl = available.length
    ? `<select class="edit-input" style="font-size:10px;padding:1px 4px;margin-top:3px"
        onchange="if(this.value){APP.igBonusAddKey('${sid}','${escJs(fname)}','${escJs(path)}',this.value,1);this.value=''}">
        <option value="">+ ${T('Add')} ${esc(T(label))}…</option>
        ${toAdd.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}
      </select>`
    : `<input class="edit-input" style="font-size:11px;width:130px;margin-top:3px" placeholder="+ ${T('id, press Enter')}"
        onkeydown="if(event.key==='Enter'&&this.value.trim()){APP.igBonusAddKey('${sid}','${escJs(fname)}','${escJs(path)}',this.value.trim(),1);this.value=''}">`;

  return `<div style="margin-bottom:8px">
    <div style="font-size:11px;font-weight:600;color:#bbb;margin-bottom:4px">${icon} ${T(label)}</div>
    <div style="padding-left:6px">
      ${rows || `<p class="muted small" style="margin:0 0 2px">${T('None set.')}</p>`}
      ${addEl}
    </div>
  </div>`;
}

/**
 * Renders item-stats inside a bonus entry, split into the same 4 categories
 * as the main STATS editor: General Stats, Damage Buffs %, Defense Buffs %, Penetration.
 * Each category reads keys from the corresponding loaded section for its add-dropdown.
 */
function igBonusItemStats(sid, fname, path, current) {
  const cur = (current && typeof current === 'object') ? current : {};

  const cats = [
    { label: 'General Stats',   sec: 'general',     color: '#6db', icon: '📊' },
    { label: 'Damage Buffs %',  sec: 'dmgbuff',    color: '#e74', icon: '🔥' },
    { label: 'Defense Buffs %', sec: 'defbuff',    color: '#48f', icon: '🛡' },
    { label: 'Penetration',     sec: 'penetration', color: '#fa4', icon: '🎯' },
  ];

  const assignedKeys = new Set();

  const catHtml = cats.map(cat => {
    const loaded   = STATE.loaded?.[cat.sec];
    const secKeys  = loaded ? Object.keys(loaded).filter(k => !k.startsWith('_')) : [];
    secKeys.forEach(k => assignedKeys.add(k));

    const curEntries = Object.entries(cur).filter(([k]) => secKeys.includes(k));

    const rows = curEntries.map(([statId, val]) => `
      <div style="display:flex;gap:5px;align-items:center;margin-bottom:2px">
        <span style="min-width:130px;font-size:11px;color:#ccc">${esc(statId)}</span>
        <input class="edit-input edit-input--num" style="width:65px;font-size:11px" type="number" step="0.01"
          value="${esc(val)}"
          oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path+'.'+statId)}',+this.value)">
        <button style="padding:1px 4px;background:#3a1e1e;border:1px solid #8a3a3a;border-radius:3px;color:#ea8f8f;cursor:pointer;font-size:10px;line-height:1.2"
          onclick="APP.igBonusRemoveKey('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(statId)}')">✕</button>
      </div>`).join('');

    const toAdd = secKeys.filter(k => !Object.prototype.hasOwnProperty.call(cur, k));
    const addEl = secKeys.length
      ? `<select class="edit-input" style="font-size:10px;padding:1px 4px;margin-top:2px"
          onchange="if(this.value){APP.igBonusAddKey('${sid}','${escJs(fname)}','${escJs(path)}',this.value,1);this.value=''}">
          <option value="">+ ${T('Add')} ${esc(T(cat.label))}…</option>
          ${toAdd.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}
        </select>`
      : `<p class="muted small" style="margin-top:2px">${T('Load')} <b>${cat.sec}</b> ${T('section to add.')}</p>`;

    const badge = curEntries.length ? ` <span style="background:#2a2a2a;border-radius:9px;padding:0 5px;font-size:10px;color:#aaa">${curEntries.length}</span>` : '';
    return igCollapsible(
      `<span style="color:${cat.color}">${cat.icon} ${T(cat.label)}</span>${badge}`,
      `<div style="padding-left:6px">
        ${rows || `<p class="muted small" style="margin:0 0 1px">${T('None.')}</p>`}
        ${addEl}
      </div>`,
      curEntries.length > 0,
      `${fname}:${path}:${cat.sec}`
    );
  }).join('');

  // Stats not matched to any loaded section → show in "Other"
  const unknownEntries = Object.entries(cur).filter(([k]) => !assignedKeys.has(k));
  const unknownHtml = unknownEntries.length
    ? igCollapsible(
        `❓ ${T('Other')} <span style="background:#2a2a2a;border-radius:9px;padding:0 5px;font-size:10px;color:#aaa">${unknownEntries.length}</span>`,
        `<div style="padding-left:6px">
          ${unknownEntries.map(([statId, val]) => `
            <div style="display:flex;gap:5px;align-items:center;margin-bottom:2px">
              <span style="min-width:130px;font-size:11px;color:#aaa">${esc(statId)}</span>
              <input class="edit-input edit-input--num" style="width:65px;font-size:11px" type="number" step="0.01"
                value="${esc(val)}"
                oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path+'.'+statId)}',+this.value)">
              <button style="padding:1px 4px;background:#3a1e1e;border:1px solid #8a3a3a;border-radius:3px;color:#ea8f8f;cursor:pointer;font-size:10px;line-height:1.2"
                onclick="APP.igBonusRemoveKey('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(statId)}')">✕</button>
            </div>`).join('')}
        </div>`,
        true,
        `${fname}:${path}:other`
      )
    : '';

  return `<div style="margin-bottom:8px">
    <div style="font-size:11px;font-weight:600;color:#bbb;margin-bottom:4px">📊 ${T('Item Stats')}</div>
    <div style="padding:4px 0 0 8px;border-left:2px solid #2a3a2a">
      ${catHtml}${unknownHtml}
    </div>
  </div>`;
}

/**
 * Renders a single named entry inside one of the 3 bonus categories.
 * hasExtras = true for material-modifiers and material (adds fabled-attributes).
 * Class entries only support damage-types, defense-types, item-stats.
 */
function igBonusEntry(sid, fname, bonusCat, key, data, hasExtras) {
  data = (data && typeof data === 'object') ? data : {};
  const bp = `generator.bonuses.${bonusCat}.${key}`;
  return `<div style="border:1px solid #2a2a3a;border-radius:4px;margin-bottom:8px;padding:8px 10px;background:#18181e">
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
      <input class="edit-input edit-id" style="flex:1;min-width:100px;font-weight:600" value="${esc(key)}"
        title="${T(hasExtras ? 'Material name or wildcard (e.g. diamond*, iron_sword)' : 'Class name')}"
        onblur="if(this.value.trim()&&this.value.trim()!=='${escJs(key)}')APP.igBonusRenameEntry('${sid}','${escJs(fname)}','${escJs(bonusCat)}','${escJs(key)}',this.value.trim())"
        onkeydown="if(event.key==='Enter')this.blur()">
      <button style="padding:2px 7px;background:#3a1e1e;border:1px solid #8a3a3a;border-radius:3px;color:#ea8f8f;cursor:pointer;font-size:11px"
        onclick="APP.igBonusConfirmRemoveEntry('${sid}','${escJs(fname)}','${escJs(bonusCat)}','${escJs(key)}')">🗑 ${T('Remove')}</button>
    </div>
    ${igBonusTypeMap(sid, fname, `${bp}.damage-types`,  data['damage-types']  ?? {}, 'damage',         'Damage Types',      '⚔️')}
    ${igBonusTypeMap(sid, fname, `${bp}.defense-types`, data['defense-types'] ?? {}, 'defense',        'Defense Types',     '🛡️')}
    ${igBonusItemStats(sid, fname, `${bp}.item-stats`,  data['item-stats']    ?? {})}
    ${hasExtras ? igBonusTypeMap(sid, fname, `${bp}.fabled-attributes`, data['fabled-attributes'] ?? {}, 'fabledAttributes', 'Fabled Attributes', '⭐') : ''}
  </div>`;
}

/**
 * Renders one of the 3 bonus sub-categories with its entries and an Add button.
 */
function igBonusCategory(sid, fname, bonusCat, entries, hasExtras) {
  const meta = {
    'material-modifiers': { icon: '🔮', title: 'Material Modifiers', hint: 'Wildcard or prefix material names — e.g. <code>diamond*</code>, <code>gold</code>.' },
    'material':           { icon: '🧱', title: 'Material Bonuses',   hint: 'Exact material / item IDs — e.g. <code>iron_sword</code>, <code>iron_helmet</code>.' },
    'class':              { icon: '🧙', title: 'Class Bonuses',       hint: 'Fabled class names — e.g. <code>Warrior</code>, <code>Cleric</code>. Supports: damage-types, defense-types, item-stats.' },
    'rarity':             { icon: '✨', title: 'Rarity Bonuses',      hint: 'Tier/rarity names — e.g. <code>common</code>, <code>rare</code>, <code>legendary</code>. Supports: damage-types, defense-types, item-stats.' },
  }[bonusCat] ?? { icon: '📦', title: bonusCat, hint: '' };

  const entryHtml = Object.entries(entries).map(([k, v]) =>
    igBonusEntry(sid, fname, bonusCat, k, v, hasExtras)
  ).join('');

  return `<div style="margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
      <span style="font-size:12px;font-weight:700;color:#ccc">${meta.icon} ${T(meta.title)}</span>
      <button class="btn-add-entry" style="font-size:11px;padding:2px 8px"
        onclick="APP.igBonusAddEntry('${sid}','${escJs(fname)}','${escJs(bonusCat)}')">+ ${T('Add entry')}</button>
    </div>
    <p class="muted small" style="margin:0 0 7px">${T(meta.hint)}</p>
    ${entryHtml || `<p class="muted small">${T('No entries defined.')}</p>`}
  </div>`;
}

/**
 * Render item-flags as toggle buttons.
 * Active flags shown in green, inactive in gray.
 * Special '*' (ALL) is always shown first.
 */
const ITEM_FLAGS_ALL = ['*', 'HIDE_ENCHANTS', 'HIDE_ATTRIBUTES', 'HIDE_UNBREAKABLE',
  'HIDE_DESTROYS', 'HIDE_PLACED_ON', 'HIDE_POTION_EFFECTS', 'HIDE_DYE'];

function igItemFlags(sid, fname, flags) {
  const active = new Set(Array.isArray(flags) ? flags : []);
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">${
    ITEM_FLAGS_ALL.map(flag => {
      const on = active.has(flag);
      return `<button
        title="${flag === '*' ? T('All flags (hide everything)') : flag}"
        style="padding:2px 8px;font-size:11px;cursor:pointer;border-radius:3px;border:1px solid ${on ? '#4a8a4a' : '#555'};background:${on ? '#1e3a1e' : '#2a2a2a'};color:${on ? '#8fea8f' : '#aaa'};white-space:nowrap"
        onclick="APP.igToggleFlag('${sid}','${escJs(fname)}','${escJs(flag)}')">${flag === '*' ? T('ALL (*)') : flag.replace('HIDE_', '')}</button>`;
    }).join('')
  }</div>`;
}

/** Render MC-colored preview of a lore/lore-format line array. */
function lorePreview(lines, ctx = {}) {
  if (!Array.isArray(lines) || !lines.length) return `<p class="muted small" style="margin-top:4px">${T('No lines.')}</p>`;
  return `<div class="lore-preview">${
    lines.map(l => l === ''
      ? '<div class="lore-line lore-blank"></div>'
      : `<div class="lore-line">${mc.toHtml(mc.resolve(String(l), ctx))}</div>`
    ).join('')
  }</div>`;
}

// ---------------------------------------------------------------------------
// Global JS helpers (called from inline oninput/onclick attributes)
// ---------------------------------------------------------------------------

/**
 * Live-update a lore preview div as the user types in a textarea.
 * pid = id of the target <div class="lore-preview"> element.
 */
window.updateLorePreview = function(textarea, pid) {
  const el = document.getElementById(pid);
  if (!el) return;
  const ls = textarea.value.split('\n');
  el.innerHTML = ls.map(function(l) {
    return l === ''
      ? '<div class="lore-line lore-blank"></div>'
      : '<div class="lore-line">' + mc.toHtml(mc.resolve(String(l), {})) + '</div>';
  }).join('');
};

window.updateSetLorePreview = function(textarea, pid) {
  const el = document.getElementById(pid);
  if (!el) return;
  const color = textarea.dataset.setcolor || '';
  const ls = textarea.value.split('\n');
  el.innerHTML = ls.map(function(l) {
    const resolved = l.replace(/%c%/g, color);
    return l === ''
      ? '<div class="lore-line lore-blank"></div>'
      : '<div class="lore-line">' + mc.toHtml(mc.resolve(resolved, {})) + '</div>';
  }).join('');
};

function igSetLoreFormat(sid, fname, path, lines, colorActive) {
  const arr  = Array.isArray(lines) ? lines : [];
  const pid  = `lprev-${(sid + fname + path).replace(/[^a-z0-9]/gi, '_').slice(0, 60)}`;
  const rows = Math.max(2, arr.length + 1);
  const text = arr.join('\n');
  const previewHtml = arr.map(function(l) {
    const resolved = l.replace(/%c%/g, colorActive);
    return l === ''
      ? '<div class="lore-line lore-blank"></div>'
      : '<div class="lore-line">' + mc.toHtml(mc.resolve(resolved, {})) + '</div>';
  }).join('');
  return `<textarea class="obj-textarea" rows="${rows}" placeholder="${T('one value per line — use %c% for active/inactive color')}"
    data-setcolor="${esc(colorActive)}"
    oninput="updateSetLorePreview(this,'${pid}')"
    onblur="APP.igUpdateLineArray('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">${esc(text)}</textarea>
  <p class="muted small" style="margin-top:2px"><code>%c%</code> → ${T('active color when tier equipped, inactive color otherwise. Preview shows active color.')}</p>
  <div id="${pid}" class="lore-preview">${previewHtml}</div>`;
}

const POTION_TYPES = [
  'SPEED','SLOWNESS','HASTE','MINING_FATIGUE','STRENGTH','INSTANT_HEALTH','INSTANT_DAMAGE',
  'JUMP_BOOST','NAUSEA','REGENERATION','RESISTANCE','FIRE_RESISTANCE','WATER_BREATHING',
  'INVISIBILITY','BLINDNESS','NIGHT_VISION','HUNGER','WEAKNESS','POISON','WITHER',
  'HEALTH_BOOST','ABSORPTION','SATURATION','GLOWING','LEVITATION','LUCK','UNLUCK',
  'SLOW_FALLING','CONDUIT_POWER','DOLPHINS_GRACE','BAD_OMEN','HERO_OF_THE_VILLAGE','DARKNESS',
];

function igPotionEffects(sid, fname, path, value) {
  const obj = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  const fid = `pe-${(sid + fname + path).replace(/[^a-z0-9]/gi, '_').slice(0, 40)}`;

  const rows = Object.entries(obj).map(([effect, amp]) => `
    <div style="display:flex;gap:5px;align-items:center;margin-bottom:3px">
      <span style="min-width:160px;font-size:11px;color:#ccc;font-family:monospace">${esc(effect)}</span>
      <span class="muted small">${T('amp')}</span>
      <input class="edit-input edit-input--num" style="width:55px;font-size:11px" type="number" min="1"
        value="${esc(amp)}" title="${T('Amplifier (1=Potion I, 2=Potion II…)')}"
        oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path + '.' + effect)}',+this.value)">
      <button style="padding:1px 4px;background:#3a1e1e;border:1px solid #8a3a3a;border-radius:3px;color:#ea8f8f;cursor:pointer;font-size:10px"
        onclick="APP.igBonusRemoveKey('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(effect)}')">✕</button>
    </div>`).join('');

  const inUse = new Set(Object.keys(obj));
  const available = POTION_TYPES.filter(p => !inUse.has(p));
  const addRow = `
    <div style="display:flex;gap:5px;align-items:center;margin-top:4px;flex-wrap:wrap">
      <select class="edit-input" id="${fid}-sel" style="flex:1;min-width:160px;font-size:10px;padding:1px 4px">
        <option value="">${T('Select effect…')}</option>
        ${available.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
      </select>
      <span class="muted small">${T('amp')}</span>
      <input class="edit-input edit-input--num" id="${fid}-amp" style="width:55px;font-size:11px" type="number" min="1" value="1">
      <button class="btn-add-entry" style="font-size:11px;padding:2px 6px"
        onclick="(function(){const s=document.getElementById('${fid}-sel');const a=document.getElementById('${fid}-amp');if(s.value){APP.igBonusAddKey('${sid}','${escJs(fname)}','${escJs(path)}',s.value,+a.value||1);s.value='';a.value='1'}})()">+ ${T('Add')}</button>
    </div>
    <p class="muted small" style="margin-top:2px">${T('Amplifier: 1=Potion I, 2=Potion II. NIGHT_VISION duration auto-extended by server.')}</p>`;

  return `<div>
    ${Object.keys(obj).length ? rows : `<p class="muted small">${T('None set.')}</p>`}
    ${addRow}
  </div>`;
}

/**
 * Live-update a mc-preview span when the associated "name" field changes.
 * The preview span must have id=previewId and data-ctx with { name, value }.
 * The format input must be the previousElementSibling of the preview span.
 */
window.updateFormatPreview = function(nameInput, previewId) {
  const p = document.getElementById(previewId);
  if (!p) return;
  try {
    const ctx = JSON.parse(p.dataset.ctx || '{}');
    ctx.name = nameInput.value;
    p.dataset.ctx = JSON.stringify(ctx);
    const fi = p.previousElementSibling;
    if (fi) p.innerHTML = mc.toHtml(mc.resolve(fi.value || '', ctx));
  } catch (_) {}
};

/**
 * Switch visible tab inside a tab group.
 * tabGroupId — shared prefix for tab content div IDs.
 * tabKey     — key of the tab to show.
 */
window.showIgTab = function(tabGroupId, tabKey) {
  if (!window.IG_ACTIVE_TABS) window.IG_ACTIVE_TABS = {};
  window.IG_ACTIVE_TABS[tabGroupId] = tabKey;
  document.querySelectorAll('[data-tabgroup="' + tabGroupId + '"]').forEach(function(el) {
    el.style.display = 'none';
  });
  document.querySelectorAll('[data-tabbtn="' + tabGroupId + '"]').forEach(function(btn) {
    const active = btn.dataset.tabkey === tabKey;
    btn.style.borderColor  = active ? '#4a8a4a' : '#444';
    btn.style.background   = active ? '#1e3a1e' : '#1a1a1a';
    btn.style.color        = active ? '#8fea8f' : '#999';
    btn.style.borderBottomColor = active ? '#1e3a1e' : '#444';
  });
  const target = document.getElementById(tabGroupId + '-' + tabKey);
  if (target) target.style.display = '';
};

/** lore-format textarea (line-by-line) + live MC preview. */
function igLoreFormat(sid, fname, path, lines) {
  const arr  = Array.isArray(lines) ? lines : [];
  const pid  = `lprev-${(sid + fname + path).replace(/[^a-z0-9]/gi, '_').slice(0, 60)}`;
  const rows = Math.max(2, arr.length + 1);
  const text = arr.join('\n');
  const previewHtml = arr.map(function(l) {
    return l === ''
      ? '<div class="lore-line lore-blank"></div>'
      : '<div class="lore-line">' + mc.toHtml(mc.resolve(String(l), {})) + '</div>';
  }).join('');
  return `<textarea class="obj-textarea" rows="${rows}" placeholder="${T('one value per line')}"
    oninput="updateLorePreview(this,'${pid}')"
    onblur="APP.igUpdateLineArray('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">${esc(text)}</textarea>
  <div id="${pid}" class="lore-preview">${previewHtml}</div>`;
}

/**
 * Sync button — syncs BOTH lore-format AND stat pool from loaded stats.
 * loreFormatPath : dot-path to the lore-format array
 * poolPath       : dot-path to the pool object (where stat entries live)
 * source         : "section:<sid>" | "local:<path>"
 * prefix         : placeholder prefix, e.g. "DAMAGE_"
 */
function igSyncBtn(sid, fname, loreFormatPath, poolPath, source, prefix) {
  return `<button title="${T('Sync lore-format AND add missing pool entries from')} ${source}"
    style="margin-left:6px;padding:2px 8px;font-size:11px;cursor:pointer;background:#1e3a1e;border:1px solid #4a8a4a;border-radius:3px;color:#8fea8f;white-space:nowrap;vertical-align:middle"
    onclick="APP.igSync('${sid}','${escJs(fname)}','${escJs(loreFormatPath)}','${escJs(poolPath)}','${source}','${prefix}')">↺ ${T('Sync')}</button>`;
}

function igCollapsible(title, content, open = false, keyOverride = null) {
  // Strip HTML tags to get a stable key unaffected by dynamic badge counts
  const key = keyOverride !== null ? keyOverride : title.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return `<details class="ig-section"${open ? ' open' : ''} data-key="${esc(key)}">
    <summary class="ig-section__title">${title}</summary>
    <div class="ig-section__body">${content}</div>
  </details>`;
}

/** Compact table of stat pool entries (chance/scale/min/max/flat/round). */
function buildStatPool(sid, fname, basePath, listData) {
  if (!listData || typeof listData !== 'object') return `<p class="muted small">${T('No entries.')}</p>`;
  const entries = Object.entries(listData).filter(([k, v]) => k !== 'lore-format' && v && typeof v === 'object');
  if (!entries.length) return `<p class="muted small">${T('No entries.')}</p>`;

  const rows = entries.map(([id, e]) => {
    const p      = `${basePath}.${id}`;
    const active = (e.chance ?? 0) > 0;
    const rowId  = `spr-${(sid + fname + basePath + id).replace(/[^a-z0-9]/gi, '_')}`;
    return `<tr id="${rowId}" class="${active ? '' : 'row-disabled'}">
      <td><code>${esc(id)}</code></td>
      <td><input class="edit-input edit-input--num" type="number" step="1" value="${esc(e.chance ?? 0)}"
        oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(p + '.chance')}',+this.value);(function(v){var r=document.getElementById('${rowId}');if(r)r.classList.toggle('row-disabled',+v<=0)})(this.value)">
      </td>
      <td>${igNum(sid, fname, `${p}.scale-by-level`, e['scale-by-level'] ?? 1.0)}</td>
      <td>${igNum(sid, fname, `${p}.min`, e.min ?? 0)}</td>
      <td>${igNum(sid, fname, `${p}.max`, e.max ?? 0)}</td>
      <td style="text-align:center">${igCheck(sid, fname, `${p}.flat-range`, !!e['flat-range'])}</td>
      <td style="text-align:center">${igCheck(sid, fname, `${p}.round`, !!e.round)}</td>
    </tr>`;
  }).join('');

  return `<table class="tbl tbl-compact">
    <thead><tr>
      <th>${T('Stat ID')}</th><th>${T('Chance %')}</th><th>${T('Scale/lvl')}</th><th>${T('Min')}</th><th>${T('Max')}</th><th>${T('Flat')}</th><th>${T('Round')}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** Collapsible section for damage-types / defense-types / fabled-attributes. */
function buildStatGroup(sid, fname, basePath, groupData, title, syncSource, syncPrefix) {
  if (!groupData || typeof groupData !== 'object') return '';
  const list   = groupData.list ?? {};
  const active = Object.entries(list).filter(([k, v]) => k !== 'lore-format' && (v?.chance ?? 0) > 0).length;

  const loreLines = groupData['lore-format'] ?? [];
  const syncBtn   = syncSource ? igSyncBtn(sid, fname, `${basePath}.lore-format`, `${basePath}.list`, syncSource, syncPrefix) : '';

  const content = `
    <div class="info-row">
      <span class="info-label">${T('Min / Max')}</span>
      <div style="display:flex;gap:6px;align-items:center">
        ${igNum(sid, fname, `${basePath}.minimum`, groupData.minimum ?? 0)}
        <span class="muted">–</span>
        ${igNum(sid, fname, `${basePath}.maximum`, groupData.maximum ?? 0)}
      </div>
    </div>
    ${igCollapsible(`📝 ${T('Lore format')} <span class="badge" style="font-size:10px">${loreLines.length}</span>${syncBtn}`,
        igLoreFormat(sid, fname, `${basePath}.lore-format`, loreLines), false, `${fname}:${basePath}:lore`)}
    <p class="ig-subhead">${T('Stat pool')} — ${active} ${T('active')}</p>
    ${buildStatPool(sid, fname, `${basePath}.list`, list)}`;

  return igCollapsible(
    `${T(title)} <span class="badge badge-blue" style="font-size:10px">${active} ${T('active')}</span>`,
    content, false, `${fname}:${basePath}`
  );
}

/** Collapsible for item-stats (has 4 tabs). */
function buildItemStatsGroup(sid, fname, basePath, groupData) {
  if (!groupData || typeof groupData !== 'object') return '';
  const list   = groupData.list                ?? {};
  const dmgBuf = groupData['list-damage-buffs']  ?? {};
  const defBuf = groupData['list-defense-buffs'] ?? {};
  const pen    = groupData['list-penetration']   ?? {};
  const cust   = groupData['list-custom-stats']  ?? {};
  const active = Object.entries(list).filter(([, v]) => (v?.chance ?? 0) > 0).length;

  const tgId      = `istats-${sid}-${fname.replace(/[^a-z0-9]/gi, '_')}-${basePath.replace(/[^a-z0-9]/gi, '_')}`;
  let activeTab   = (window.IG_ACTIVE_TABS && window.IG_ACTIVE_TABS[tgId]) ?? 'general';
  if (isVanilla() && activeTab !== 'general') activeTab = 'general';

  const tabBtn = (key, label) => {
    const on = key === activeTab;
    return `<button data-tabbtn="${tgId}" data-tabkey="${key}"
      style="padding:4px 10px;border:1px solid ${on ? '#4a8a4a' : '#444'};border-radius:4px 4px 0 0;
             background:${on ? '#1e3a1e' : '#1a1a1a'};color:${on ? '#8fea8f' : '#999'};
             cursor:pointer;font-size:11px;border-bottom-color:${on ? '#1e3a1e' : '#444'}"
      onclick="showIgTab('${tgId}','${key}')">${label}</button>`;
  };

  const tabPanel = (key, innerHtml) =>
    `<div id="${tgId}-${key}" data-tabgroup="${tgId}"
      style="display:${key === activeTab ? '' : 'none'};padding:8px 0 0">
      ${innerHtml}
    </div>`;

  // For the general tab, lore-format lives at basePath.lore-format (NOT basePath.list.lore-format).
  // For the sub-list tabs (dmgbuffs/defbuffs/pen), lore-format is embedded inside the sub-list
  // object itself (e.g., basePath.list-damage-buffs.lore-format).
  const tabContent = (loreFormatPath, loreLines, poolPath, poolData, syncSource, syncPrefix, tabKey) => {
    const syncBtn = igSyncBtn(sid, fname, loreFormatPath, poolPath, syncSource, syncPrefix);
    return `${igCollapsible(`📝 ${T('Lore format')} <span class="badge" style="font-size:10px">${loreLines.length}</span>${syncBtn}`,
        igLoreFormat(sid, fname, loreFormatPath, loreLines), false,
        `${fname}:${basePath}:lore-${tabKey}`)}${buildStatPool(sid, fname, poolPath, poolData)}`;
  };

  const content = `
    <div class="info-row">
      <span class="info-label">${T('Min / Max')}</span>
      <div style="display:flex;gap:6px;align-items:center">
        ${igNum(sid, fname, `${basePath}.minimum`, groupData.minimum ?? 0)}
        <span class="muted">–</span>
        ${igNum(sid, fname, `${basePath}.maximum`, groupData.maximum ?? 0)}
      </div>
    </div>
    <div style="display:flex;gap:2px;margin:10px 0 0;flex-wrap:wrap">
      ${tabBtn('general',  `📊 ${T(isVanilla() ? 'Stats' : 'General stats')}`)}
      ${isVanilla() ? '' : tabBtn('dmgbuffs', `🔥 ${T('Damage buffs %')}`)}
      ${isVanilla() ? '' : tabBtn('defbuffs', `🛡 ${T('Defense buffs %')}`)}
      ${isVanilla() ? '' : tabBtn('pen',      `🎯 ${T('Penetration')}`)}
      ${isVanilla() ? '' : tabBtn('customstats', `🧩 ${T('Custom stats')}`)}
    </div>
    <div style="border:1px solid #333;border-radius:0 4px 4px 4px;padding:8px">
      ${tabPanel('general',
          tabContent(`${basePath}.lore-format`,              groupData['lore-format'] ?? [],
                     `${basePath}.list`,                     list,   'section:general',     'ITEM_STAT_',    'general'))}
      ${isVanilla() ? '' : tabPanel('dmgbuffs',
          tabContent(`${basePath}.list-damage-buffs.lore-format`, dmgBuf['lore-format'] ?? [],
                     `${basePath}.list-damage-buffs`,        dmgBuf, 'section:dmgbuff',     'DAMAGE_BUFF_',  'dmgbuffs'))}
      ${isVanilla() ? '' : tabPanel('defbuffs',
          tabContent(`${basePath}.list-defense-buffs.lore-format`, defBuf['lore-format'] ?? [],
                     `${basePath}.list-defense-buffs`,       defBuf, 'section:defbuff',     'DEFENSE_BUFF_', 'defbuffs'))}
      ${isVanilla() ? '' : tabPanel('pen',
          tabContent(`${basePath}.list-penetration.lore-format`,   pen['lore-format'] ?? [],
                     `${basePath}.list-penetration`,         pen,    'section:penetration',  'PENETRATION_',  'pen'))}
      ${isVanilla() ? '' : tabPanel('customstats',
          tabContent(`${basePath}.list-custom-stats.lore-format`,  cust['lore-format'] ?? [],
                     `${basePath}.list-custom-stats`,        cust,   'section:customstats',  'CUSTOM_STAT_',  'customstats'))}
    </div>`;

  return igCollapsible(
    `📊 ${T('Item Stats')} <span class="badge badge-blue" style="font-size:10px">${active} ${T('general active')}</span>`,
    content, false, `${fname}:${basePath}`
  );
}

/** Collapsible sockets section (GEM / ESSENCE / RUNE). */
/**
 * Simplified pool table for sockets — only chance matters,
 * no scale-by-level / min / max / flat / round.
 */
function buildSocketPool(sid, fname, basePath, listData) {
  if (!listData || typeof listData !== 'object') return `<p class="muted small">${T('No entries. Use ↺ Sync to populate.')}</p>`;
  const entries = Object.entries(listData).filter(([, v]) => v && typeof v === 'object');
  if (!entries.length) return `<p class="muted small">${T('No entries. Use ↺ Sync to populate.')}</p>`;

  const rows = entries.map(([id, e]) => {
    const p      = `${basePath}.${id}`;
    const active = (e.chance ?? 0) > 0;
    const rowId  = `spr-${(sid + fname + basePath + id).replace(/[^a-z0-9]/gi, '_')}`;
    return `<tr id="${rowId}" class="${active ? '' : 'row-disabled'}">
      <td><code>${esc(id)}</code></td>
      <td><input class="edit-input edit-input--num" type="number" step="1" value="${esc(e.chance ?? 0)}"
        oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(p + '.chance')}',+this.value);(function(v){var r=document.getElementById('${rowId}');if(r)r.classList.toggle('row-disabled',+v<=0)})(this.value)">
      </td>
    </tr>`;
  }).join('');

  return `<table class="tbl tbl-compact">
    <thead><tr><th>${T('Socket category')}</th><th>${T('Chance %')}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildSocketsSection(sid, fname, socketsData) {
  if (!socketsData || typeof socketsData !== 'object' || !Object.keys(socketsData).length) return '';

  // Maps socket type key → module sid → icon
  const TYPE_MODULE = { GEM: ['gems','💎'], ESSENCE: ['essences','✨'], RUNE: ['runes','🔷'] };

  const inner = Object.entries(socketsData).map(([type, td]) => {
    if (!td || typeof td !== 'object') return '';
    const bp = `generator.sockets.${type}`;

    // Show loaded socket items for this type as a reference list
    const [modSid, modIcon] = TYPE_MODULE[type] ?? [null, '📦'];
    const loadedItems = modSid ? Object.keys(STATE.loaded?.[modSid]?.files || {}) : [];
    const loadedHint = loadedItems.length
      ? `<p class="muted small" style="margin-top:6px">${modIcon} ${T('Loaded')} ${type} ${T('items')}: ${loadedItems.map(f => `<code>${esc(f)}</code>`).join(', ')}</p>`
      : modSid
        ? `<p class="muted small" style="margin-top:6px;color:#f80">${T('No')} ${type} ${T('files loaded yet — go to')} <b>${type[0]+type.slice(1).toLowerCase()}s</b> ${T('module.')}</p>`
        : '';

    const socketSyncBtn = modSid
      ? `<button title="${T('Sync lore-format and pool from loaded')} ${modSid} ${T('files (reads target-requirements.socket values)')}"
          style="margin-left:6px;padding:2px 8px;font-size:11px;cursor:pointer;background:#1e3a1e;border:1px solid #4a8a4a;border-radius:3px;color:#8fea8f;white-space:nowrap;vertical-align:middle"
          onclick="APP.igSyncSocket('${sid}','${escJs(fname)}','${type}','${modSid}')">↺ ${T('Sync from')} ${modSid}</button>`
      : '';

    // Migrate legacy `title` field: prepend to lore-format if not already there, then delete it
    if (td.title) {
      const lf = Array.isArray(td['lore-format']) ? [...td['lore-format']] : [];
      if (lf[0] !== td.title) lf.unshift(td.title);
      td['lore-format'] = lf;
      delete td.title;
    }

    return igCollapsible(`${modIcon} ${type}`, `
      <div class="info-row">
        <span class="info-label">${T('Min / Max slots')}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${igNum(sid, fname, `${bp}.minimum`, td.minimum ?? 0)}
          <span class="muted">–</span>
          ${igNum(sid, fname, `${bp}.maximum`, td.maximum ?? 0)}
        </div>
      </div>
      ${igCollapsible(`📝 ${T('Lore format')} <span class="badge" style="font-size:10px">${(td['lore-format'] ?? []).length}</span>`,
        `${igLoreFormat(sid, fname, `${bp}.lore-format`, td['lore-format'] ?? [])}
        <p class="muted small" style="margin-top:2px">${T('First line is the section title shown to the player (e.g.')} <code>&amp;8&amp;m     &amp;f「 GEMS 」&amp;m     </code>).</p>`,
        false, `${fname}:socket-${type}-lore`)}
      <p class="ig-subhead">${T('Socket pool (socket category → chance)')} ${socketSyncBtn}</p>
      ${buildSocketPool(sid, fname, `${bp}.list`, td.list ?? {})}
      ${loadedHint}`, false, `${fname}:socket-${type}`);
  }).join('');

  return igCollapsible(`🔮 ${T('Sockets')}`, inner, false, `${fname}:sockets`);
}

/**
 * Quality-of-life editor for generator.materials.model-data.
 * DEFAULT: one CMD number per line.
 * SPECIAL: per-material entries, each with a name and number list.
 */
function igMaterialModelData(sid, fname, basePath, current) {
  const md       = (current && typeof current === 'object') ? current : {};
  const defArr   = Array.isArray(md.default) ? md.default : [];
  const special  = (md.special && typeof md.special === 'object') ? md.special : {};
  const sfx      = `${sid}-${fname.replace(/[^a-z0-9]/gi,'_')}`;

  const specialHtml = Object.entries(special).map(([mat, nums]) => {
    const arr  = Array.isArray(nums) ? nums : [];
    const path = `${basePath}.special.${mat}`;
    return `<div style="border:1px solid #2a2a3a;border-radius:3px;margin-bottom:5px;padding:5px 8px;background:#1a1a1e">
      <div style="display:flex;gap:5px;align-items:center;margin-bottom:3px">
        <input class="edit-input edit-id" style="flex:1;font-size:11px" value="${esc(mat)}"
          placeholder="material_name"
          onblur="if(this.value.trim()&&this.value.trim()!=='${escJs(mat)}')APP.igMdRenameSpecial('${sid}','${escJs(fname)}','${escJs(basePath)}','${escJs(mat)}',this.value.trim())"
          onkeydown="if(event.key==='Enter')this.blur()">
        <button style="padding:1px 5px;background:#3a1e1e;border:1px solid #8a3a3a;border-radius:3px;color:#ea8f8f;cursor:pointer;font-size:10px"
          onclick="if(confirm('${T('Remove')} \\'${escJs(mat)}\\'?'))APP.igMdRemoveSpecial('${sid}','${escJs(fname)}','${escJs(basePath)}','${escJs(mat)}')">🗑</button>
      </div>
      <textarea class="obj-textarea" rows="${Math.max(2, arr.length + 1)}" placeholder="${T('one CMD number per line')}"
        onblur="APP.igUpdateNumArray('${sid}','${escJs(fname)}','${escJs(path)}',this.value)">${esc(arr.join('\n'))}</textarea>
    </div>`;
  }).join('');

  const newMatId = `md-new-${sfx}`;
  return `
    <div style="font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;margin-bottom:8px">${T('MODEL DATA')}</div>
    <div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:3px">${T('DEFAULT')}</div>
      <textarea class="obj-textarea" rows="${Math.max(2, defArr.length + 1)}" placeholder="${T('one CMD number per line')}"
        onblur="APP.igUpdateNumArray('${sid}','${escJs(fname)}','${escJs(basePath+'.default')}',this.value)">${esc(defArr.join('\n'))}</textarea>
    </div>
    <div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="font-size:11px;font-weight:600;color:#888">${T('SPECIAL')}</span>
        <input id="${newMatId}" class="edit-input" style="font-size:11px;width:140px" placeholder="material_name">
        <button class="btn-add-entry" style="font-size:10px;padding:2px 7px"
          onclick="(function(){const el=document.getElementById('${newMatId}');APP.igMdAddSpecial('${sid}','${escJs(fname)}','${escJs(basePath)}',el.value);el.value=''})()">+ ${T('Add')}</button>
      </div>
      ${specialHtml || `<p class="muted small">${T('No special materials yet.')}</p>`}
    </div>`;
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

  // Socket counts from generator.sockets
  const sockets   = gen.sockets || {};
  const gemMax    = sockets.GEM?.maximum     ?? 0;
  const essMax    = sockets.ESSENCE?.maximum ?? 0;
  const runeMax   = sockets.RUNE?.maximum    ?? 0;

  const familyVal  = family ?? '';
  const collapsed  = !!(STATE.loaded[sid]?._collapsed?.[fname]);

  const header = `
    <div class="item-card__header">
      <span class="ig-drag-handle" title="${T('Drag to move to another folder')}">⠿</span>
      <button class="ig-collapse-btn" title="${collapsed ? T('Expand') : T('Collapse')}"
        onclick="APP.igToggleCollapse('${sid}','${escJs(fname)}')">
        ${collapsed ? '▶' : '▼'}
      </button>
      <span class="item-card__icon">⚗️</span>
      <span style="font-weight:600;color:#fff">${esc(fname)}</span>
      <span class="badge badge-yellow">${esc(tier)}</span>
      <span class="badge">${T('lv')} ${minLvl}–${maxLvl}</span>
      ${dmgActive  ? `<span class="badge badge-red"   title="${T('Active damage types')}">${dmgActive}⚔</span>` : ''}
      ${defActive  ? `<span class="badge badge-blue"  title="${T('Active defense types')}">${defActive}🛡</span>` : ''}
      ${statActive ? `<span class="badge badge-green" title="${T('Active item stats')}">${statActive}📊</span>` : ''}
      ${gemMax  > 0 ? `<span class="badge" title="${T('Max GEM sockets')}">💎×${gemMax}</span>`  : ''}
      ${essMax  > 0 ? `<span class="badge" title="${T('Max ESSENCE sockets')}">✨×${essMax}</span>` : ''}
      ${runeMax > 0 ? `<span class="badge" title="${T('Max RUNE sockets')}">🔷×${runeMax}</span>` : ''}
      <span class="ig-family-wrap" title="${T('Folder')}">
        <span class="muted small">📁</span>
        <input class="edit-input edit-id ig-family-input" value="${esc(familyVal)}"
          placeholder="${T('folder (optional)')}"
          oninput="APP.igSetFamily('${sid}','${escJs(fname)}',this.value.trim())">
      </span>
      <button title="${T('Sync ALL pools (damage, defense, item-stats, buffs, pen, fabled attrs, sockets) from loaded sections')}"
        style="padding:2px 8px;font-size:11px;cursor:pointer;background:#1e2e3e;border:1px solid #4a7aaa;border-radius:3px;color:#8fb8ea;white-space:nowrap;vertical-align:middle"
        onclick="APP.igSyncAll('${sid}','${escJs(fname)}')">↺ ${T('Sync All')}</button>
      <button class="btn-download" title="${T('Download')} ${esc(fname)}"
        onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
      <button class="btn-add-entry" title="${T('Save current item as a reusable template')}"
        onclick="APP.igSaveAsTemplate('${sid}','${escJs(fname)}')">💾 ${T('Save as template')}</button>
      <button class="btn-icon btn-del" title="${T('Remove from editor')}"
        onclick="if(confirm('${T('Remove')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
    </div>`;

  if (collapsed) {
    return `
  <div class="item-card ig-card ig-card--collapsed" draggable="true"
    ondragstart="APP.igDragStart('${sid}','${escJs(fname)}',event)">
    ${header}
  </div>`;
  }

  const mats    = gen.materials    ?? {};
  const bonuses = gen.bonuses      ?? {};
  const enchants = gen.enchantments ?? {};
  const shields  = gen['shield-patterns'] ?? {};

  return `
  <div class="item-card ig-card" draggable="true"
    ondragstart="APP.igDragStart('${sid}','${escJs(fname)}',event)">
    ${header}
    <div class="ig-card__body">

      ${igCollapsible(`👁 ${T('Lore')}`, igLoreFormat(sid, fname, 'lore', lore), true, `${fname}:lore`)}

      ${igCollapsible(`📋 ${T('Basic Info')}`, `
        ${cardRow(T('Name template'),   igField(sid, fname, 'name', data.name ?? '', 'edit-input--format'))}
        ${cardRow(T('Tier'),            igField(sid, fname, 'tier', tier, 'edit-input--inline'))}
        ${cardRow(T('Level min / max'),
          `<div style="display:flex;gap:6px;align-items:center">
            ${igNum(sid, fname, 'level.min', minLvl)}
            <span class="muted">–</span>
            ${igNum(sid, fname, 'level.max', maxLvl)}
          </div>`)}
        ${cardRow(T('Color (R,G,B)'), igColorField(sid, fname, 'color', String(data.color ?? '-1,-1,-1')))}
        ${cardRow(T('Unbreakable'), igCheck(sid, fname, 'unbreakable', data.unbreakable === true))}
        ${cardRow(T('Enchanted'),   igCheck(sid, fname, 'enchanted',   data.enchanted  === true))}
        ${cardRow(T('Durability %'), igNum(sid, fname, 'durability',  data.durability  ?? 100))}
        ${cardRow(T('Custom Model Data'), igNum(sid, fname, 'model-data',  data['model-data'] ?? 0))}
        ${cardRow(T('Skull hash'),   igField(sid, fname, 'skull-hash', data['skull-hash'] ?? ''))}
        ${cardRow(T('Item flags'),   igItemFlags(sid, fname, data['item-flags'] ?? []))}
      `, true, `${fname}:basic`)}

      ${igCollapsible(`⚙️ ${T('Generator')}`, `
        ${cardRow(T('Prefix chance %'), igNum(sid, fname, 'generator.prefix-chance', gen['prefix-chance'] ?? 100))}
        ${cardRow(T('Suffix chance %'), igNum(sid, fname, 'generator.suffix-chance', gen['suffix-chance'] ?? 100))}
      `, false, `${fname}:gen`)}

      ${igCollapsible(`🧱 ${T('Materials')}`, `
        ${cardRow(T('Reverse blacklist'), igCheck(sid, fname, 'generator.materials.reverse', mats.reverse === true))}
        ${cardRow(T('Black-list (one item per line)'), igLineArray(sid, fname, 'generator.materials.black-list', mats['black-list'] ?? []))}
        ${igMaterialModelData(sid, fname, 'generator.materials.model-data', mats['model-data'] ?? {})}
      `, false, `${fname}:mats`)}

      ${igCollapsible(`🎁 ${T('Bonuses')}`, `
        ${igBonusCategory(sid, fname, 'material-modifiers', bonuses['material-modifiers'] ?? {}, true)}
        ${igBonusCategory(sid, fname, 'material',           bonuses.material              ?? {}, true)}
        ${igBonusCategory(sid, fname, 'class',              bonuses.class                 ?? {}, false)}
        ${igBonusCategory(sid, fname, 'rarity',             bonuses.rarity                ?? {}, false)}
      `, false, `${fname}:bonuses`)}

      ${igCollapsible(`📋 ${T('Requirements')}`, (() => {
        const reqByLvl = gen['user-requirements-by-level'] ?? {};
        // Class hint from loaded classes section
        const loadedClasses = STATE.loaded?.classes;
        const classNames = [];
        if (loadedClasses?._multiFile) {
          Object.values(loadedClasses.files || {}).forEach(fd => {
            Object.values(fd || {}).forEach(entry => {
              if (entry?.name && !classNames.includes(entry.name)) classNames.push(entry.name);
            });
          });
        }
        const classHint = classNames.length
          ? `<p class="muted small" style="margin-top:3px">${T('Loaded classes')}: ${classNames.map(n => `<code>${esc(n)}</code>`).join(', ')}</p>`
          : `<p class="muted small" style="margin-top:3px">${T('Load class files in <b>Combat Config → Classes</b> to see class names.')}</p>`;
        return `
          ${cardRow(T('Level requirements'),
            `${igLineKvField(sid, fname, 'generator.user-requirements-by-level.level', reqByLvl.level ?? {}, 'level min:max')}
             <p class="muted small" style="margin-top:3px">${T('e.g.')} <code>1 1:10</code> — ${T('at level 1 the stat can roll 1–10.')}</p>`)}
          ${cardRow(T('Allowed classes'),
            `${igLineKvField(sid, fname, 'generator.user-requirements-by-level.class', reqByLvl.class ?? {}, 'level ClassName1,ClassName2')}
             ${classHint}`)}
          ${cardRow(T('Banned classes'),
            `${igLineKvField(sid, fname, 'generator.user-requirements-by-level.banned-class', reqByLvl['banned-class'] ?? {}, 'level ClassName1,ClassName2')}
             ${classHint}`)}`;
      })(), false, `${fname}:reqs`)}

      ${igCollapsible(`✨ ${T('Enchantments')}`, `
        ${cardRow(T('Min / Max'),
          `<div style="display:flex;gap:6px;align-items:center">
            ${igNum(sid, fname, 'generator.enchantments.minimum', enchants.minimum ?? 0)}
            <span class="muted">–</span>
            ${igNum(sid, fname, 'generator.enchantments.maximum', enchants.maximum ?? 0)}
          </div>`)}
        ${cardRow(T('Safe only'),   igCheck(sid, fname, 'generator.enchantments.safe-only',   enchants['safe-only']   === true))}
        ${cardRow(T('Safe levels'), igCheck(sid, fname, 'generator.enchantments.safe-levels', enchants['safe-levels'] !== false))}
        ${cardRow(T('Enchant list'),
          `${igLineKvField(sid, fname, 'generator.enchantments.list', enchants.list ?? {}, 'enchantment_id min:max')}
           <p class="muted small" style="margin-top:3px">${T('One enchantment per line — e.g.')} <code>sharpness 1:3</code>, <code>efficiency 2:4</code>.</p>`)}
      `, false, `${fname}:enchants`)}

      ${igCollapsible(`🏹 ${T('Ammo & Hand Types')}`, `
        ${cardRow(T('Ammo types'),
          `${igTypePicker(sid, fname, 'generator.ammo-types', gen['ammo-types'] ?? {}, 'ammo', 'AMMO_TYPE weight%')}
           ${STATE.loaded?.ammo ? '' : `<p class="muted small" style="margin-top:3px">${T('Load <b>ammo.yml</b> in Stats → Ammo Types for type picker. Fallback: one <code>TYPE weight%</code> per line.')}</p>`}`)}
        ${cardRow(T('Hand types'),
          `${igTypePicker(sid, fname, 'generator.hand-types', gen['hand-types'] ?? {}, 'hand', 'ONE/TWO/OFF weight%')}
           ${STATE.loaded?.hand ? '' : `<p class="muted small" style="margin-top:3px">${T('Load <b>hand.yml</b> in Stats → Hand Types for type picker. Fallback: one <code>TYPE weight%</code> per line.')}</p>`}`)}
      `, false, `${fname}:ammo`)}

      ${buildStatGroup(sid, fname, 'generator.damage-types',      dmgTypes,   '🗡️ Damage Types',      'section:damage',                        'DAMAGE_')}
      ${buildStatGroup(sid, fname, 'generator.defense-types',     defTypes,   '🛡️ Defense Types',     'section:defense',                       'DEFENSE_')}
      ${buildItemStatsGroup(sid, fname, 'generator.item-stats',   itemStats)}
      ${buildStatGroup(sid, fname, 'generator.fabled-attributes', fabledAttr, '⭐ Fabled Attributes',
        STATE.loaded?.fabledAttributes ? 'section:fabledAttributes' : 'local:generator.fabled-attributes.list',
        'FABLED_ATTRIBUTE_')}
      ${buildSocketsSection(sid, fname, gen.sockets)}

      ${igCollapsible(`🎯 ${T('Skills')}`, igSkillsList(sid, fname, 'generator.skills', gen.skills ?? {}), false, `${fname}:skills`)}

      ${igCollapsible(`🛡 ${T('Shield Patterns')}`, `
        ${cardRow(T('Random'),         igCheck(sid, fname, 'generator.shield-patterns.random',          shields.random !== false))}
        ${cardRow(T('Base colors'),    igLineArray(sid, fname, 'generator.shield-patterns.base-colors',   shields['base-colors']   ?? []))}
        ${cardRow(T('Pattern colors'), igLineArray(sid, fname, 'generator.shield-patterns.pattern-colors',shields['pattern-colors'] ?? []))}
        ${cardRow(T('Patterns'),       igLineArray(sid, fname, 'generator.shield-patterns.patterns',      shields.patterns         ?? []))}
      `, false, `${fname}:shields`)}

      ${igCollapsible(`🪨 ${T('Armor Trimmings (1.20+)')}`,
        `${igLineKvField(sid, fname, 'generator.armor-trimmings', gen['armor-trimmings'] ?? {}, 'trim-pattern-id weight')}
         <p class="muted small" style="margin-top:4px">${T('One trim per line — e.g.')} <code>sentry 1.0</code>. ${T('Requires MC 1.20+.')}</p>`,
        false, `${fname}:trim`)}


    </div>
  </div>`;
}

function renderItemGenerator(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('ig-file-add-${sid}').click()">+ ${T('Add item type file')}
    <input id="ig-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  if (data._multiFile) {
    const entries     = Object.entries(data.files || {});
    const families    = data._families    || {};
    const emptyGroups = data._emptyGroups || [];

    // Build file groups map
    const groups = {};
    entries.forEach(([fn, fd]) => {
      const fam = families[fn] ?? '';
      if (!groups[fam]) groups[fam] = [];
      groups[fam].push([fn, fd]);
    });

    // All named folders: from files + manually created empty ones
    const namedFolders = [...new Set([
      ...Object.values(families).filter(Boolean),
      ...emptyGroups,
    ])].sort();

    const toolbar = `
      <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
        ${addBtn}
        <span class="ig-new-wrap">
          ${igTplSelect(sid, [
            { value: 'common', label: T('Full template') },
            { value: 'weapon', label: T('Weapon')        },
            { value: 'armor',  label: T('Armor')         },
          ])}
          <input id="ig-newfname-${sid}" class="edit-input ig-new-input" type="text" placeholder="${T('new-item.yml')}"
            onkeydown="if(event.key==='Enter'){APP.igAddNewFile('${sid}',this.value,document.getElementById('ig-tpl-${sid}').value);this.value=''}">
          <button class="btn-add-entry" onclick="APP.igAddNewFile('${sid}',document.getElementById('ig-newfname-${sid}').value,document.getElementById('ig-tpl-${sid}').value);document.getElementById('ig-newfname-${sid}').value=''">+ ${T('New')}</button>
        </span>
        <button class="btn-add-entry" onclick="APP.igAddGroup('${sid}')">📁 ${T('New folder')}</button>
        <button class="btn-add-entry" onclick="APP.igCollapseAll('${sid}')">▶ ${T('Collapse all')}</button>
        <button class="btn-add-entry" onclick="APP.igExpandAll('${sid}')">▼ ${T('Expand all')}</button>
        <button class="btn-download" onclick="APP.igDownloadAll('${sid}')" title="${T('Download all as folder tree (Chrome/Edge) or ZIP')}">⬇ ${T('Download all')}</button>
      </div>`;

    if (!entries.length && !emptyGroups.length) return `
      ${toolbar}
      <div class="empty-state">
        <div style="font-size:36px;margin-bottom:12px">📂</div>
        <p>${T('Drop item-generator YAML files above, or use <b>Load Files</b>.')}</p>
        <p class="muted small" style="margin-top:6px">${T('Each .yml file = one item type (e.g. sword.yml, helmet.yml).')}</p>
      </div>`;

    function groupZone(fam, groupId, labelHtml, items) {
      const isEmpty = items.length === 0;
      return `
        <div class="ig-folder-group" id="${groupId}"
          ondragover="if(APP._igDragging)event.preventDefault(),this.classList.add('drag-over')"
          ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('drag-over')"
          ondrop="APP.igDrop('${sid}','${escJs(fam)}',event)">
          <div class="ig-folder-header${fam ? '' : ' ig-folder-root'}">
            ${labelHtml}
            ${!isEmpty ? `<button class="btn-download ig-grp-dl" title="${T('Download this folder (subfolder or ZIP)')}"
              onclick="APP.igDownloadGroup('${sid}','${escJs(fam)}')">⬇</button>` : ''}
            ${isEmpty ? `<button class="btn-icon btn-del" title="${T('Remove empty folder')}"
              onclick="APP.igRemoveGroup('${sid}','${escJs(fam)}')">🗑</button>` : ''}
          </div>
          ${isEmpty ? `<div class="ig-drop-hint">${T('Drop files here')}</div>` : ''}
          ${items.map(([fn, fd]) => renderItemGenFile(sid, fn, fd, fam)).join('')}
        </div>`;
    }

    const namedHtml = namedFolders.map(fam =>
      groupZone(fam, `ig-grp-${sid}-${fam}`,
        `📁 <b>${esc(fam)}</b> <span class="muted small">${(groups[fam]||[]).length} ${T('file(s)')}</span>`,
        groups[fam] || [])
    ).join('');

    const rootItems = groups[''] || [];
    const rootHtml  = namedFolders.length > 0 || rootItems.length > 0
      ? groupZone('', `ig-grp-${sid}-root`,
          `📄 <span class="muted small">${T('(no folder)')}</span> <span class="muted small">${rootItems.length} ${T('file(s)')}</span>`,
          rootItems)
      : '';

    return toolbar + namedHtml + rootHtml;
  }

  // Fallback: single file loaded before multi-file support
  return `<div class="entry-actions">${addBtn}</div>
    ${renderItemGenFile(sid, 'item_generator.yml', data, '')}`;
}

// ---------------------------------------------------------------------------
// Sets (item_stats/sets/ folder — one .yml per set)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Gem / socket-item helpers
// ---------------------------------------------------------------------------

/**
 * Skills list for gems/essences/runes.
 * Structure: { skillName: { level: 1, 'lore-format': [...] } }
 * (No chance, no min/max level — just level + lore.)
 */
function igGemSkillsList(sid, fname, path, skills) {
  const loaded = STATE.loaded?.skills;
  const skillNames = [];
  if (loaded?._multiFile) {
    Object.values(loaded.files || {}).forEach(fd => {
      Object.values(fd || {}).forEach(entry => {
        if (entry?.name && !skillNames.includes(entry.name)) skillNames.push(entry.name);
      });
    });
  }
  skillNames.sort();

  const obj = (skills && typeof skills === 'object') ? skills : {};
  const fid = `${sid}-${fname.replace(/[^a-z0-9]/gi,'_')}-${path.replace(/[^a-z0-9]/gi,'_')}`;
  const listId = `gsk-opts-${fid}`.slice(0, 60);

  const entries = Object.entries(obj).map(([key, sk]) => {
    if (!sk || typeof sk !== 'object') return '';
    const loreLines = sk['lore-format'] ?? [];
    return `
      <div style="border:1px solid #333;border-radius:4px;margin-bottom:6px;padding:8px 10px;background:#1a1a1a">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
          <input class="edit-input" style="flex:1;min-width:120px" value="${esc(key)}"
            list="${listId}" title="${T('Skill name')}"
            onblur="if(this.value.trim()&&this.value.trim()!=='${escJs(key)}')APP.igRenameSkill('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(key)}',this.value.trim())"
            onkeydown="if(event.key==='Enter')this.blur()">
          <span class="muted" style="font-size:11px">${T('lvl')}</span>
          <input class="edit-input edit-input--num" style="width:55px" type="number" min="1"
            value="${esc(sk.level ?? 1)}" title="${T('Skill level')}"
            oninput="APP.igUpdateField('${sid}','${escJs(fname)}','${escJs(path+'.'+key+'.level')}',+this.value)">
          <button style="padding:2px 6px;background:#3a1e1e;border:1px solid #8a3a3a;border-radius:3px;color:#ea8f8f;cursor:pointer;font-size:11px;margin-left:auto"
            onclick="if(confirm('${T('Remove skill')} \\'${escJs(key)}\\'?'))APP.igRemoveFromPath('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(key)}')">🗑</button>
        </div>
        <div style="font-size:11px;color:#888;margin-bottom:3px">${T('Lore (one line per entry):')}</div>
        ${igLoreFormat(sid, fname, `${path}.${key}.lore-format`, loreLines)}
      </div>`;
  }).join('');

  const addInput = `
    <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
      <input id="gsk-add-${fid}" class="edit-input" style="flex:1" placeholder="${T('skill name')}" list="${listId}">
      <button class="btn-add-entry" style="white-space:nowrap"
        onclick="(function(){const el=document.getElementById('gsk-add-${fid}');const k=el.value.trim();if(k){APP.igAddToPath('${sid}','${escJs(fname)}','${escJs(path)}',k,{level:1,'lore-format':[]});el.value=''}})()">+ ${T('Add skill')}</button>
    </div>
    <datalist id="${listId}">${skillNames.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;

  return `
    <div style="margin-bottom:8px">
      <div style="font-size:11px;font-weight:600;color:#bbb;margin-bottom:4px">🎯 ${T('Skills')}</div>
      ${Object.keys(obj).length ? entries : `<p class="muted small">${T('No skills defined.')}</p>`}
      ${addInput}
    </div>`;
}

/**
 * Toggle-button group for target-requirements.type array.
 * Available types: WEAPON, ARMOR, *.
 */
const TARGET_ITEM_TYPES = ['WEAPON', 'ARMOR', '*'];
function igTypeButtons(sid, fname, path, currentArr) {
  const active = new Set(Array.isArray(currentArr) ? currentArr : []);
  return `<div style="display:flex;flex-wrap:wrap;gap:4px">
    ${TARGET_ITEM_TYPES.map(t => {
      const on = active.has(t);
      return `<button
        style="padding:2px 8px;font-size:11px;cursor:pointer;border-radius:3px;border:1px solid ${on?'#4a8a4a':'#555'};background:${on?'#1e3a1e':'#2a2a2a'};color:${on?'#8fea8f':'#aaa'}"
        onclick="APP.igToggleArrayValue('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(t)}')">${esc(t)}</button>`;
    }).join('')}
  </div>`;
}

// ---- Sets: render one set file card ----
function renderSetCard(sid, fname, setData) {
  const fid         = fname.replace(/[^a-z0-9]/gi, '_');
  const setName     = setData.name             ?? '';
  const prefix      = setData.prefix           ?? '';
  const suffix      = setData.suffix           ?? '';
  const colorActive = setData.color?.active    ?? '&a';
  const colorInact  = setData.color?.inactive  ?? '&8';
  const elements    = setData.elements         ?? {};
  const bonusMap    = setData.bonuses?.['by-elements-amount'] ?? {};
  const elemCount   = Object.keys(elements).length;

  const elemRows = Object.entries(elements).map(([elemId, elem]) => {
    const rawName     = elem.name ?? '';
    const resolvedName = rawName.replace(/%prefix%/g, prefix).replace(/%suffix%/g, suffix);
    return `
    <div style="border:1px solid #2a2a3a;border-radius:4px;margin-bottom:6px;padding:8px 10px;background:#18181e">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
        <b style="min-width:90px;font-size:12px;color:#ccc">${esc(elemId)}</b>
        <button class="btn-icon btn-del" title="${T('Remove element')}"
          onclick="APP.igRemoveFromPath('${sid}','${escJs(fname)}','elements','${escJs(elemId)}')">🗑</button>
      </div>
      ${cardRow(T('Name'), igField(sid, fname, `elements.${elemId}.name`, rawName, 'edit-input--format'))}
      <div class="lore-preview" style="margin-bottom:4px">${mc.toHtml(resolvedName)}</div>
      ${cardRow(T('Materials'), igLineArray(sid, fname, `elements.${elemId}.materials`, elem.materials ?? []))}
    </div>`;
  }).join('');

  const elemSection = igCollapsible(
    `🧩 ${T('Elements')} (${elemCount})`,
    elemRows + `
    <div class="ig-add-row">
      <input id="set-elem-${fid}" class="edit-input" type="text" placeholder="helmet" style="width:120px">
      <button class="btn-add-entry"
        onclick="APP.igAddSetElement('${sid}','${escJs(fname)}','set-elem-${fid}')">+ ${T('Add element')}</button>
    </div>`, true, `${fname}:elements`);

  const bonusSections = Object.entries(bonusMap)
    .sort(([a], [b]) => +a - +b)
    .map(([cnt, bonus]) => {
      const bp   = `bonuses.by-elements-amount.${cnt}`;
      const lore = bonus.lore ?? [];
      const overflowWarn = +cnt > elemCount && elemCount > 0
        ? `<p class="muted small" style="color:#e74;margin-top:2px">⚠️ ${T('Tier')} ${cnt} > ${elemCount} ${T('elements — will never activate.')}</p>`
        : '';
      const tierTitle = +cnt > elemCount && elemCount > 0
        ? `🎁 ${cnt} ${+cnt !== 1 ? T('pieces') : T('piece')} <span style="color:#e74;font-size:10px">⚠️ ${T('unreachable')}</span>`
        : `🎁 ${cnt} ${+cnt !== 1 ? T('pieces') : T('piece')}`;

      return igCollapsible(
        tierTitle,
        `${overflowWarn}
         ${igCollapsible(`📜 ${T('Lore')}`, igSetLoreFormat(sid, fname, `${bp}.lore`, lore, colorActive), lore.length > 0, `${fname}:tier-${cnt}:lore`)}
         ${igBonusItemStats(sid, fname, `${bp}.item-stats`, bonus['item-stats'] ?? {})}
         ${igBonusTypeMap(sid, fname, `${bp}.damage-types`,  bonus['damage-types']  ?? {}, 'damage',  'Damage Types',  '⚔️')}
         ${igBonusTypeMap(sid, fname, `${bp}.defense-types`, bonus['defense-types'] ?? {}, 'defense', 'Defense Types', '🛡️')}
         <div style="margin-bottom:8px">
           <div style="font-size:11px;font-weight:600;color:#bbb;margin-bottom:4px">🔥 ${T('Damage Buffs %')}</div>
           ${igLineKvField(sid, fname, `${bp}.damage-buffs`, bonus['damage-buffs'] ?? {}, 'type value%')}
           <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>physical 5%</code></p>
         </div>
         <div style="margin-bottom:8px">
           <div style="font-size:11px;font-weight:600;color:#bbb;margin-bottom:4px">🛡 ${T('Defense Buffs %')}</div>
           ${igLineKvField(sid, fname, `${bp}.defense-buffs`, bonus['defense-buffs'] ?? {}, 'type value%')}
           <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>physical 3%</code></p>
         </div>
         ${igBonusTypeMap(sid, fname, `${bp}.penetrations`, bonus['penetrations'] ?? {}, 'penetration', 'Penetrations', '🎯')}
         ${igCollapsible(`🧪 ${T('Potion Effects')}`, igPotionEffects(sid, fname, `${bp}.potion-effects`, bonus['potion-effects'] ?? {}), Object.keys(bonus['potion-effects'] ?? {}).length > 0, `${fname}:tier-${cnt}:potions`)}
         <button class="btn-icon btn-del" style="margin-top:6px"
           onclick="APP.igRemoveFromPath('${sid}','${escJs(fname)}','bonuses.by-elements-amount','${escJs(String(cnt))}')">🗑 ${T('Remove tier')}</button>`,
        true, `${fname}:tier-${cnt}`);
    }).join('');

  const bonusSection = igCollapsible(
    `🎁 ${T('Bonus tiers')} (${Object.keys(bonusMap).length})`,
    bonusSections + `
    <div class="ig-add-row" style="margin-top:8px">
      <span class="muted small">${T('Pieces')}:</span>
      <input id="set-bonus-${fid}" class="edit-input edit-input--num" type="number" min="1" value="2" style="width:70px">
      <button class="btn-add-entry"
        onclick="APP.igAddBonusTier('${sid}','${escJs(fname)}','set-bonus-${fid}')">+ ${T('Add tier')}</button>
    </div>`, true, `${fname}:bonus-tiers`);

  return `
    <div class="item-card">
      <details class="card-details" open>
        <summary class="item-card__header">
          <span class="item-card__icon">👑</span>
          <span style="flex:1;font-weight:600;color:#fff">${esc(fname)}</span>
          <span class="item-card__meta">${elemCount} ${T('elements')} · ${Object.keys(bonusMap).length} ${T('tiers')}</span>
          <button class="btn-download" onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
          <button class="btn-add-entry" title="${T('Save as template')}"
            onclick="event.stopPropagation();APP.igSaveAsTemplate('${sid}','${escJs(fname)}')">💾</button>
          <button class="btn-icon btn-del"
            onclick="if(confirm('${T('Remove')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
        </summary>
        <div class="item-card__body">
          ${cardRow(T('Set name'),       igField(sid, fname, 'name',           setName,    'edit-input--format'))}
          <div class="lore-preview" style="margin-bottom:8px">${mc.toHtml(setName)}</div>
          ${cardRow(T('Prefix'),         igField(sid, fname, 'prefix',         prefix))}
          ${cardRow(T('Suffix'),         igField(sid, fname, 'suffix',         suffix))}
          <p class="muted small" style="margin:-4px 0 6px">${T('Element names support <code>%prefix%</code> and <code>%suffix%</code> — preview shown per element below.')}</p>
          ${cardRow(T('Color active'),   igField(sid, fname, 'color.active',   colorActive,'edit-input--format'))}
          <div class="lore-preview" style="margin-bottom:4px">${mc.toHtml(colorActive + 'Active (equipped)')}</div>
          ${cardRow(T('Color inactive'), igField(sid, fname, 'color.inactive', colorInact, 'edit-input--format'))}
          <div class="lore-preview" style="margin-bottom:8px">${mc.toHtml(colorInact + 'Inactive (not equipped)')}</div>
          ${elemSection}
          ${bonusSection}
        </div>
      </details>
    </div>`;
}

function renderSets(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('sets-file-add-${sid}').click()">+ ${T('Add set file')}
    <input id="sets-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  const setsToolbar = `
    <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
      ${addBtn}
      <span class="ig-new-wrap">
        ${igTplSelect(sid, [
          { value: 'wildcat', label: T('Wild Cat (4-piece armor)') },
        ])}
        <input id="ig-newfname-${sid}" class="edit-input ig-new-input" type="text" placeholder="my-set.yml"
          onkeydown="if(event.key==='Enter'){APP.igAddNewFile('${sid}',this.value,document.getElementById('ig-tpl-${sid}').value);this.value=''}">
        <button class="btn-add-entry"
          onclick="APP.igAddNewFile('${sid}',document.getElementById('ig-newfname-${sid}').value,document.getElementById('ig-tpl-${sid}').value);document.getElementById('ig-newfname-${sid}').value=''">+ ${T('New set')}</button>
      </span>
      ${collapseAllBtn()}
    </div>`;

  if (data._multiFile) {
    const entries = Object.entries(data.files || {});
    if (!entries.length) return `
      ${setsToolbar}
      <div class="empty-state">
        <div style="font-size:36px;margin-bottom:12px">👑</div>
        <p>${T('Drop set YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New set</b>.')}</p>
      </div>`;

    const cards = entries.map(([fname, setData]) => renderSetCard(sid, fname, setData)).join('');
    return `
      ${setsToolbar}
      <p class="muted small" style="margin-bottom:14px">${T('Each file = one set. Items are identified by <b>vanilla material</b> + display <b>name contains</b> element name (case-insensitive, stripped of color codes).')}</p>
      <div class="cards-grid">${cards}</div>`;
  }

  // Legacy single-file fallback
  const TPL = { name: 'New Set', prefix: '', suffix: '', color: { active: '&a', inactive: '&8' }, elements: {}, bonuses: { 'by-elements-amount': {} } };
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');
  const cards = entries.map(([id, set]) => {
    const isNew = (SYNCED_NEW[sid] || new Set()).has(id);
    return `
      <div class="item-card${isNew ? ' entry-new' : ''}">
        <details class="card-details" open>
          <summary class="item-card__header">
            <span class="item-card__icon">👑</span>
            ${editId(sid, id)}
            ${isNew ? '<span class="badge badge-blue">new</span>' : ''}
            ${removeEntryBtn(sid, id)}
          </summary>
          <div class="item-card__body">
            ${cardRow(T('Set name'), editText(sid, `${id}.name`, set.name ?? id, 'edit-input--format'))}
            ${cardRow(T('Elements (JSON)'), jsonTextarea(sid, `${id}.elements`, set.elements ?? {}))}
            ${cardRow(T('Bonuses (JSON)'),  jsonTextarea(sid, `${id}.bonuses`,  set.bonuses  ?? {}))}
          </div>
        </details>
      </div>`;
  }).join('');

  return `
    ${setsToolbar}
    <div class="entry-actions">${addEntryBtn(sid, TPL, 'Add set')}</div>
    <div class="cards-grid">${cards || `<div class="empty-state">${T('No sets found.')}</div>`}</div>`;
}

// ---------------------------------------------------------------------------
// Gems (modules/gems/items/ folder — one .yml per gem type)
// ---------------------------------------------------------------------------

function renderGemCard(sid, fname, gemData) {
  const fid        = fname.replace(/[^a-z0-9]/gi, '_');
  const material   = gemData.material            ?? 'DIAMOND';
  const name       = gemData.name               ?? '';
  const sockDisp   = gemData['socket-display']  ?? '';
  const loreLines  = gemData.lore               ?? [];
  const enchanted  = gemData.enchanted          ?? false;
  const flags      = gemData['item-flags']      ?? [];
  const tier       = gemData.tier               ?? 'common';
  const lvlMin     = gemData.level?.min         ?? 1;
  const lvlMax     = gemData.level?.max         ?? 1;
  const usesByLvl  = gemData['uses-by-level']         ?? {};
  const succByLvl  = gemData['success-rate-by-level'] ?? {};
  const bonusByLvl = gemData['bonuses-by-level']      ?? {};
  const skills     = gemData.skills                   ?? {};
  const tr         = gemData['target-requirements']   ?? {};

  const bonusLevels = Object.entries(bonusByLvl)
    .sort(([a], [b]) => +a - +b)
    .map(([lvl, bonus]) => {
      const bp = `bonuses-by-level.${lvl}`;
      return igCollapsible(
        `✨ ${T('Level')} ${lvl}`,
        `${igBonusItemStats(sid, fname, `${bp}.item-stats`, bonus['item-stats'] ?? {})}
         ${igBonusTypeMap(sid, fname, `${bp}.damage-types`,  bonus['damage-types']  ?? {}, 'damage',  'Damage Types',  '⚔️')}
         ${igBonusTypeMap(sid, fname, `${bp}.defense-types`, bonus['defense-types'] ?? {}, 'defense', 'Defense Types', '🛡️')}
         <div style="margin-bottom:8px">
           <div style="font-size:11px;font-weight:600;color:#bbb;margin-bottom:4px">🔥 ${T('Damage Buffs %')}</div>
           ${igLineKvField(sid, fname, `${bp}.damage-buffs`, bonus['damage-buffs'] ?? {}, 'type value%')}
           <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>physical 5%</code></p>
         </div>
         <div style="margin-bottom:8px">
           <div style="font-size:11px;font-weight:600;color:#bbb;margin-bottom:4px">🛡 ${T('Defense Buffs %')}</div>
           ${igLineKvField(sid, fname, `${bp}.defense-buffs`, bonus['defense-buffs'] ?? {}, 'type value%')}
           <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>physical 3%</code></p>
         </div>
         ${igBonusTypeMap(sid, fname, `${bp}.penetrations`, bonus['penetrations'] ?? {}, 'penetration', 'Penetrations', '🎯')}
         ${igGemSkillsList(sid, fname, `${bp}.skills`, bonus.skills ?? {})}
         <button class="btn-icon btn-del" style="margin-top:6px"
           onclick="APP.igRemoveFromPath('${sid}','${escJs(fname)}','bonuses-by-level','${escJs(String(lvl))}')">🗑 ${T('Remove level')}</button>`,
        true, `${fname}:gem-lvl-${lvl}`);
    }).join('');

  const bonusSection = igCollapsible(
    `✨ ${T('Bonuses by level')} (${Object.keys(bonusByLvl).length})`,
    bonusLevels + `
    <div class="ig-add-row" style="margin-top:8px">
      <span class="muted small">${T('Level')}:</span>
      <input id="gem-lvl-${fid}" class="edit-input edit-input--num" type="number" min="1" value="${lvlMax + 1}" style="width:70px">
      <button class="btn-add-entry"
        onclick="APP.igAddGemLevel('${sid}','${escJs(fname)}','gem-lvl-${fid}')">+ ${T('Add level')}</button>
    </div>`, true, `${fname}:gem-bonuses`);

  const targetSection = igCollapsible(`🎯 ${T('Target requirements')}`, `
    ${cardRow(T('Item types'), `
      ${igTypeButtons(sid, fname, 'target-requirements.type', tr.type ?? [])}
      <p class="muted small" style="margin-top:3px">${T('WEAPON / ARMOR / * (any).')}</p>`)}
    ${cardRow(T('Socket category'), igField(sid, fname, 'target-requirements.socket', tr.socket ?? 'common'))}
    ${cardRow(T('Required tier'),   igField(sid, fname, 'target-requirements.tier',   tr.tier   ?? ''))}
    ${cardRow(T('Modules (one per line)'),
      `${igLineArray(sid, fname, 'target-requirements.module', Array.isArray(tr.module) ? tr.module : (tr.module ? [tr.module] : []))}
       <p class="muted small" style="margin-top:2px">${T('Module IDs or <code>*</code> for all.')}</p>`)}
    ${cardRow(T('Level requirements'),
      `${igLineKvField(sid, fname, 'target-requirements.level', tr.level ?? {}, 'level min:max')}
       <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>1 1:10</code> — ${T('gem level : allowed item level range.')}</p>`)}
  `, false, `${fname}:target-req`);

  return `
    <div class="item-card">
      <details class="card-details" open>
        <summary class="item-card__header">
          <span class="item-card__icon">💎</span>
          <span style="flex:1;font-weight:600;color:#fff">${esc(fname)}</span>
          <span class="item-card__meta">${esc(material)} · ${esc(tier)} · ${T('lvl')} ${lvlMin}–${lvlMax}</span>
          <button class="btn-download" onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
          <button class="btn-add-entry" title="${T('Save as template')}"
            onclick="event.stopPropagation();APP.igSaveAsTemplate('${sid}','${escJs(fname)}')">💾</button>
          <button class="btn-icon btn-del"
            onclick="if(confirm('${T('Remove')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
        </summary>
        <div class="item-card__body">
          ${cardRow(T('Material'),       igField(sid, fname, 'material',       material))}
          ${cardRow(T('Name'),           igField(sid, fname, 'name',           name,     'edit-input--format'))}
          <div class="lore-preview" style="margin-bottom:4px">${mc.toHtml(name)}</div>
          ${cardRow(T('Socket display'), igField(sid, fname, 'socket-display', sockDisp, 'edit-input--format'))}
          <div class="lore-preview" style="margin-bottom:4px">${mc.toHtml(sockDisp)}</div>
          ${cardRow(T('Lore'), igLoreFormat(sid, fname, 'lore', loreLines))}
          ${cardRow(T('Tier'),       igField(sid, fname, 'tier',      tier))}
          ${cardRow(T('Enchanted'),  igCheck(sid, fname, 'enchanted', enchanted))}
          ${cardRow(T('Item flags'), igItemFlags(sid, fname, flags))}
          ${cardRow(T('Level min / max'),
            `<div style="display:flex;gap:6px;align-items:center">
              ${igNum(sid, fname, 'level.min', lvlMin)}
              <span class="muted">–</span>
              ${igNum(sid, fname, 'level.max', lvlMax)}
            </div>`)}

          ${igCollapsible(`📊 ${T('Uses & success rates')}`, `
            ${cardRow(T('Uses by level'),
              `${igLineKvField(sid, fname, 'uses-by-level', usesByLvl, 'level count')}
               <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>1 3</code> — ${T('gem level : uses count.')}</p>`)}
            ${cardRow(T('Success rate by level'),
              `${igLineKvField(sid, fname, 'success-rate-by-level', succByLvl, 'level min:max')}
               <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>1 40:80</code> — ${T('gem level : success % range.')}</p>`)}
          `, false, `${fname}:uses`)}

          ${igCollapsible(`🔧 ${T('Advanced')}`, `
            ${cardRow(T('Color (R,G,B)'),
              `${igColorField(sid, fname, 'color', String(gemData.color ?? '-1,-1,-1'))}
               <p class="muted small" style="margin-top:2px">${T('Leather/potion tint.')} <code>-1,-1,-1</code> = ${T('default.')}</p>`)}
            ${cardRow(T('Custom Model Data'),
              `${igNum(sid, fname, 'model-data', gemData['model-data'] ?? -1)}
               <span class="muted small" style="margin-left:6px">${T('-1 = disabled')}</span>`)}
            ${cardRow(T('Skull Hash'), igField(sid, fname, 'skull-hash', gemData['skull-hash'] ?? ''))}
            <p class="muted small" style="margin-top:-4px;margin-bottom:6px">${T('Skull texture hash (PLAYER_HEAD material).')}</p>
            ${cardRow(T('Unbreakable'), igCheck(sid, fname, 'unbreakable', !!gemData.unbreakable))}
            ${cardRow(T('Enchantments'),
              `${igLineKvFieldNum(sid, fname, 'enchantments', gemData.enchantments ?? {}, 'enchantment_id level')}
               <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>sharpness 4</code></p>`)}
            ${cardRow(T('Attributes'),
              `${igLineKvField(sid, fname, 'attributes', gemData.attributes ?? {}, 'ATTRIBUTE_NAME value:operation:slot')}
               <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>ATTACK_DAMAGE 2:ADD_NUMBER:HAND</code></p>`)}
          `, !!(gemData['skull-hash'] || gemData.unbreakable || (gemData['model-data'] ?? -1) >= 0 || Object.keys(gemData.enchantments ?? {}).length || Object.keys(gemData.attributes ?? {}).length), `${fname}:advanced`)}

          ${bonusSection}
          ${targetSection}
        </div>
      </details>
    </div>`;
}

function renderGems(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('gems-file-add-${sid}').click()">+ ${T('Add gem file')}
    <input id="gems-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  const gemsToolbar = `
    <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
      ${addBtn}
      <span class="ig-new-wrap">
        ${igTplSelect(sid, [
          { value: 'gold-nugget-agility', label: T('Agility Nugget')  },
          { value: 'iron-nugget-defense', label: T('Defense Nugget')  },
          { value: 'emerald-health',      label: T('Health Emerald')  },
          { value: 'diamond-damage',      label: T('Damage Diamond')  },
        ])}
        <input id="ig-newfname-${sid}" class="edit-input ig-new-input" type="text" placeholder="my-gem.yml"
          onkeydown="if(event.key==='Enter'){APP.igAddNewFile('${sid}',this.value,document.getElementById('ig-tpl-${sid}').value);this.value=''}">
        <button class="btn-add-entry"
          onclick="APP.igAddNewFile('${sid}',document.getElementById('ig-newfname-${sid}').value,document.getElementById('ig-tpl-${sid}').value);document.getElementById('ig-newfname-${sid}').value=''">+ ${T('New gem')}</button>
      </span>
      ${collapseAllBtn()}
    </div>`;

  if (data._multiFile) {
    const entries = Object.entries(data.files || {});
    if (!entries.length) return `
      ${gemsToolbar}
      <div class="empty-state">
        <div style="font-size:36px;margin-bottom:12px">💎</div>
        <p>${T('Drop gem YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New gem</b>.')}</p>
      </div>`;

    const cards = entries.map(([fname, gemData]) => renderGemCard(sid, fname, gemData)).join('');
    return `
      ${gemsToolbar}
      <p class="muted small" style="margin-bottom:14px">${T('Each file = one gem type. <code>socket-display</code> = text shown on item lore when socketed.')}</p>
      <div class="cards-grid">${cards}</div>`;
  }

  return `${gemsToolbar}<div class="alert alert-warn">⚠️ ${T('No gem files loaded yet.')}</div>`;
}

// ---------------------------------------------------------------------------
// Shared socket-item base rows (essence + rune share most fields)
// ---------------------------------------------------------------------------

function socketItemBaseRows(sid, fname, data) {
  const loreLines = data.lore ?? [];
  const flags     = data['item-flags'] ?? [];
  const usesByLvl = data['uses-by-level']         ?? {};
  const succByLvl = data['success-rate-by-level'] ?? {};
  return `
    ${cardRow(T('Material'),       igField(sid, fname, 'material',       data.material         ?? 'PRISMARINE_SHARD'))}
    ${cardRow(T('Name'),           igField(sid, fname, 'name',           data.name             ?? '', 'edit-input--format'))}
    <div class="lore-preview" style="margin-bottom:4px">${mc.toHtml(data.name ?? '')}</div>
    ${cardRow(T('Socket display'), igField(sid, fname, 'socket-display', data['socket-display'] ?? '', 'edit-input--format'))}
    <div class="lore-preview" style="margin-bottom:4px">${mc.toHtml(data['socket-display'] ?? '')}</div>
    ${cardRow(T('Lore'), igLoreFormat(sid, fname, 'lore', loreLines))}
    ${cardRow(T('Tier'),      igField(sid, fname, 'tier',      data.tier      ?? 'common'))}
    ${cardRow(T('Enchanted'), igCheck(sid, fname, 'enchanted', !!data.enchanted))}
    ${cardRow(T('Item flags'), igItemFlags(sid, fname, flags))}
    ${cardRow(T('Level min / max'),
      `<div style="display:flex;gap:6px;align-items:center">
        ${igNum(sid, fname, 'level.min', data.level?.min ?? 1)}
        <span class="muted">–</span>
        ${igNum(sid, fname, 'level.max', data.level?.max ?? 1)}
      </div>`)}
    ${cardRow(T('Uses by level'),
      `${igLineKvField(sid, fname, 'uses-by-level', usesByLvl, 'level count')}
       <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>1 3</code> — ${T('gem level : uses count.')}</p>`)}
    ${cardRow(T('Success rate by level'),
      `${igLineKvField(sid, fname, 'success-rate-by-level', succByLvl, 'level min:max')}
       <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>1 40:80</code> — ${T('level : success % range.')}</p>`)}
    ${igCollapsible(`🔧 ${T('Advanced')}`, `
      ${cardRow(T('Color (R,G,B)'),
        `${igColorField(sid, fname, 'color', String(data.color ?? '-1,-1,-1'))}
         <p class="muted small" style="margin-top:2px">${T('Leather/potion tint.')} <code>-1,-1,-1</code> = ${T('default.')}</p>`)}
      ${cardRow(T('Custom Model Data'),
        `${igNum(sid, fname, 'model-data', data['model-data'] ?? -1)}
         <span class="muted small" style="margin-left:6px">${T('-1 = disabled')}</span>`)}
      ${cardRow(T('Skull Hash'), igField(sid, fname, 'skull-hash', data['skull-hash'] ?? ''))}
      <p class="muted small" style="margin-top:-4px;margin-bottom:6px">${T('Skull texture hash (PLAYER_HEAD material).')}</p>
      ${cardRow(T('Unbreakable'), igCheck(sid, fname, 'unbreakable', !!data.unbreakable))}
      ${cardRow(T('Enchantments'),
        `${igLineKvFieldNum(sid, fname, 'enchantments', data.enchantments ?? {}, 'enchantment_id level')}
         <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>sharpness 4</code></p>`)}
      ${cardRow(T('Attributes'),
        `${igLineKvField(sid, fname, 'attributes', data.attributes ?? {}, 'ATTRIBUTE_NAME value:operation:slot')}
         <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>ATTACK_DAMAGE 2:ADD_NUMBER:HAND</code></p>`)}
    `, !!(data['skull-hash'] || data.unbreakable || (data['model-data'] ?? -1) >= 0 || Object.keys(data.enchantments ?? {}).length || Object.keys(data.attributes ?? {}).length), `${fname}:advanced`)}`;
}

function socketItemTargetRows(sid, fname, data) {
  const tr = data['target-requirements'] ?? {};
  const modArr = Array.isArray(tr.module) ? tr.module : (tr.module ? [String(tr.module)] : []);
  return igCollapsible(`🎯 ${T('Target requirements')}`, `
    ${cardRow(T('Item types'), `
      ${igTypeButtons(sid, fname, 'target-requirements.type', tr.type ?? [])}
      <p class="muted small" style="margin-top:3px">${T('WEAPON / ARMOR / * (any).')}</p>`)}
    ${cardRow(T('Socket category'), igField(sid, fname, 'target-requirements.socket', tr.socket ?? 'default'))}
    ${cardRow(T('Required tier'),   igField(sid, fname, 'target-requirements.tier',   tr.tier   ?? ''))}
    ${cardRow(T('Modules (one per line)'),
      `${igLineArray(sid, fname, 'target-requirements.module', modArr)}
       <p class="muted small" style="margin-top:2px">${T('Module IDs or <code>*</code> for all. Leave empty for no restriction.')}</p>`)}
    ${cardRow(T('Level requirements'),
      `${igLineKvField(sid, fname, 'target-requirements.level', tr.level ?? {}, 'level min:max')}
       <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>1 1:10</code> — ${T('gem level : allowed item level range.')}</p>`)}
  `, false, `${fname}:target-req`);
}

// ---------------------------------------------------------------------------
// Essences (modules/essences/items/)
// ---------------------------------------------------------------------------

function renderEssenceCard(sid, fname, data) {
  const lvlMin = data.level?.min ?? 1;
  const lvlMax = data.level?.max ?? 1;
  const effect = data.effect ?? {};

  return `
    <div class="item-card">
      <details class="card-details" open>
        <summary class="item-card__header">
          <span class="item-card__icon">✨</span>
          <span style="flex:1;font-weight:600;color:#fff">${esc(fname)}</span>
          <span class="item-card__meta">${esc(data.material ?? '?')} · ${esc(data.tier ?? 'common')} · ${T('lvl')} ${lvlMin}–${lvlMax}</span>
          <button class="btn-download" onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
          <button class="btn-add-entry" title="${T('Save as template')}"
            onclick="event.stopPropagation();APP.igSaveAsTemplate('${sid}','${escJs(fname)}')">💾</button>
          <button class="btn-icon btn-del"
            onclick="if(confirm('${T('Remove')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
        </summary>
        <div class="item-card__body">
          ${igCollapsible(`📋 ${T('Base Item')}`, socketItemBaseRows(sid, fname, data), true, `${fname}:base`)}
          ${igCollapsible(`🎇 ${T('Particle Effect')}`, `
            ${cardRow(T('Type'),     igSelectField(sid, fname, 'effect.type', String(effect.type ?? 'FOOT'), ['FOOT','HELIX','AURA']))}
            ${cardRow(T('Particle'), `
              <input class="edit-input" type="text" list="particle-list" value="${esc(String(effect.name ?? ''))}"
                oninput="APP.igUpdateField('${sid}','${escJs(fname)}','effect.name',this.value)">
              <datalist id="particle-list">
                <option value="FLAME"><option value="SOUL_FIRE_FLAME"><option value="SOUL"><option value="LAVA">
                <option value="SMOKE"><option value="LARGE_SMOKE"><option value="CAMPFIRE_COSY_SMOKE">
                <option value="CLOUD"><option value="POOF"><option value="EXPLOSION"><option value="EXPLOSION_EMITTER">
                <option value="CRIT"><option value="ENCHANTED_HIT"><option value="SWEEP_ATTACK">
                <option value="WITCH"><option value="HEART"><option value="ANGRY_VILLAGER"><option value="HAPPY_VILLAGER">
                <option value="END_ROD"><option value="FIREWORK"><option value="ENCHANT"><option value="PORTAL">
                <option value="SHRIEK"><option value="SCULK_CHARGE"><option value="SCULK_SOUL">
                <option value="ELECTRIC_SPARK"><option value="WAX_ON"><option value="WAX_OFF"><option value="SCRAPE">
                <option value="SPORE_BLOSSOM_AIR"><option value="FALLING_NECTAR"><option value="GLOW">
                <option value="GUST"><option value="SMALL_GUST"><option value="WHITE_SMOKE">
                <option value="TRIAL_SPAWNER_DETECTED_PLAYER"><option value="VAULT_CONNECTION">
                <option value="SPLASH"><option value="DRIPPING_WATER"><option value="FALLING_WATER"><option value="BUBBLE">
                <option value="DUST"><option value="DUST_COLOR_TRANSITION"><option value="FALLING_DUST">
                <option value="DUST:255,100,0"><option value="DUST:0,200,255"><option value="DUST:255,255,0">
              </datalist>
              <p class="muted small" style="margin-top:2px">${T('Bukkit particle name (1.20.5+ naming, e.g. <code>WITCH</code>, <code>BLOCK</code>, <code>HAPPY_VILLAGER</code>) or <code>DUST:R,G,B</code>. Legacy names like <code>SPELL_WITCH</code>/<code>VILLAGER_HAPPY</code>/<code>REDSTONE</code> still work via Codex fallback.')}</p>`)}
            ${cardRow(T('Amount'),   igNum(sid,   fname, 'effect.amount',   effect.amount       ?? 15))}
            ${cardRow(T('Speed'),    igNum(sid,   fname, 'effect.speed',    effect.speed        ?? 0.1))}
            ${cardRow(T('Offset X'), igNum(sid,   fname, 'effect.offset-x', effect['offset-x'] ?? 0))}
            ${cardRow(T('Offset Y'), igNum(sid,   fname, 'effect.offset-y', effect['offset-y'] ?? 0))}
            ${cardRow(T('Offset Z'), igNum(sid,   fname, 'effect.offset-z', effect['offset-z'] ?? 0))}
          `, true, `${fname}:particle`)}
          ${socketItemTargetRows(sid, fname, data)}
        </div>
      </details>
    </div>`;
}

function renderEssences(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('ess-file-add-${sid}').click()">+ ${T('Add essence file')}
    <input id="ess-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  const toolbar = `
    <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
      ${addBtn}
      <span class="ig-new-wrap">
        ${igTplSelect(sid, [
          { value: 'light-trail',  label: T('Light Trail')  },
          { value: 'magic-helix',  label: T('Magic Helix')  },
        ])}
        <input id="ig-newfname-${sid}" class="edit-input ig-new-input" type="text" placeholder="my-essence.yml"
          onkeydown="if(event.key==='Enter'){APP.igAddNewFile('${sid}',this.value,document.getElementById('ig-tpl-${sid}').value);this.value=''}">
        <button class="btn-add-entry"
          onclick="APP.igAddNewFile('${sid}',document.getElementById('ig-newfname-${sid}').value,document.getElementById('ig-tpl-${sid}').value);document.getElementById('ig-newfname-${sid}').value=''">+ ${T('New essence')}</button>
      </span>
      ${collapseAllBtn()}
    </div>`;

  if (data._multiFile) {
    const entries = Object.entries(data.files || {});
    if (!entries.length) return `${toolbar}
      <div class="empty-state"><div style="font-size:36px;margin-bottom:12px">✨</div>
        <p>${T('Drop essence YAML files above or click <b>+ New essence</b>.')}</p></div>`;
    return `${toolbar}
      <p class="muted small" style="margin-bottom:14px">${T('Each file = one essence type. Socketed into ESSENCE socket slots.')}</p>
      <div class="cards-grid">${entries.map(([f,d]) => renderEssenceCard(sid, f, d)).join('')}</div>`;
  }
  return `${toolbar}<div class="alert alert-warn">⚠️ ${T('No essence files loaded yet.')}</div>`;
}

// ---------------------------------------------------------------------------
// Runes (modules/runes/items/)
// ---------------------------------------------------------------------------

function renderRuneCard(sid, fname, data) {
  const lvlMin = data.level?.min ?? 1;
  const lvlMax = data.level?.max ?? 1;

  return `
    <div class="item-card">
      <details class="card-details" open>
        <summary class="item-card__header">
          <span class="item-card__icon">🔷</span>
          <span style="flex:1;font-weight:600;color:#fff">${esc(fname)}</span>
          <span class="item-card__meta">${esc(data.material ?? '?')} · ${esc(data.tier ?? 'common')} · ${T('lvl')} ${lvlMin}–${lvlMax}</span>
          <button class="btn-download" onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
          <button class="btn-add-entry" title="${T('Save as template')}"
            onclick="event.stopPropagation();APP.igSaveAsTemplate('${sid}','${escJs(fname)}')">💾</button>
          <button class="btn-icon btn-del"
            onclick="if(confirm('${T('Remove')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
        </summary>
        <div class="item-card__body">
          ${igCollapsible(`📋 ${T('Base Item')}`, socketItemBaseRows(sid, fname, data), true, `${fname}:base`)}
          ${igCollapsible(`⚗️ ${T('Potion Effect')}`, `
            ${cardRow(T('Effect type'), igSelectField(sid, fname, 'effect', String(data.effect ?? 'SPEED'), [
              'SPEED','SLOWNESS','HASTE','MINING_FATIGUE','STRENGTH','INSTANT_HEALTH','INSTANT_DAMAGE',
              'JUMP_BOOST','NAUSEA','REGENERATION','RESISTANCE','FIRE_RESISTANCE','WATER_BREATHING',
              'INVISIBILITY','BLINDNESS','NIGHT_VISION','HUNGER','WEAKNESS','POISON','WITHER',
              'HEALTH_BOOST','ABSORPTION','SATURATION','GLOWING','LEVITATION','LUCK','UNLUCK',
              'SLOW_FALLING','CONDUIT_POWER','DOLPHINS_GRACE','BAD_OMEN','HERO_OF_THE_VILLAGE','DARKNESS',
            ]))}
            <p class="muted small" style="margin-top:4px">${T('Amplifier = item level − 1.')}</p>
          `, true, `${fname}:potion`)}
          ${socketItemTargetRows(sid, fname, data)}
        </div>
      </details>
    </div>`;
}

function renderRunes(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('rune-file-add-${sid}').click()">+ ${T('Add rune file')}
    <input id="rune-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  const toolbar = `
    <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
      ${addBtn}
      <span class="ig-new-wrap">
        ${igTplSelect(sid, [
          { value: 'jump',     label: T('Jump Rune')       },
          { value: 'absorb',   label: T('Absorption Rune') },
          { value: 'strength', label: T('Strength Rune')   },
          { value: 'speed',    label: T('Speed Rune')      },
          { value: 'resist',   label: T('Resistance Rune') },
          { value: 'luck',     label: T('Luck Rune')       },
        ])}
        <input id="ig-newfname-${sid}" class="edit-input ig-new-input" type="text" placeholder="my-rune.yml"
          onkeydown="if(event.key==='Enter'){APP.igAddNewFile('${sid}',this.value,document.getElementById('ig-tpl-${sid}').value);this.value=''}">
        <button class="btn-add-entry"
          onclick="APP.igAddNewFile('${sid}',document.getElementById('ig-newfname-${sid}').value,document.getElementById('ig-tpl-${sid}').value);document.getElementById('ig-newfname-${sid}').value=''">+ ${T('New rune')}</button>
      </span>
      ${collapseAllBtn()}
    </div>`;

  if (data._multiFile) {
    const entries = Object.entries(data.files || {});
    if (!entries.length) return `${toolbar}
      <div class="empty-state"><div style="font-size:36px;margin-bottom:12px">🔷</div>
        <p>${T('Drop rune YAML files above or click <b>+ New rune</b>.')}</p></div>`;
    return `${toolbar}
      <p class="muted small" style="margin-bottom:14px">${T('Each file = one rune type. Effect amplifier = item level − 1 (level 1 → amplifier 0 = effect I).')}</p>
      <div class="cards-grid">${entries.map(([f,d]) => renderRuneCard(sid, f, d)).join('')}</div>`;
  }
  return `${toolbar}<div class="alert alert-warn">⚠️ ${T('No rune files loaded yet.')}</div>`;
}

/**
 * Editor for named action groups.
 * Structure: { groupName: { conditions: {list:[], 'actions-on-fail':'null'}, 'action-executors':[], 'target-selectors':[] } }
 */
function igActionGroups(sid, fname, path, data) {
  const groups = (data && typeof data === 'object') ? data : {};
  const fid    = `${sid}-${fname.replace(/[^a-z0-9]/gi, '_')}-${path.replace(/[^a-z0-9]/gi, '_')}`;

  const groupsHtml = Object.entries(groups).map(([name, grp]) => {
    if (!grp || typeof grp !== 'object') return '';
    const bp        = `${path}.${name}`;
    const execLines = Array.isArray(grp['action-executors'])       ? grp['action-executors']        : [];
    const selLines  = Array.isArray(grp['target-selectors'])       ? grp['target-selectors']        : [];
    const condLines = Array.isArray(grp?.conditions?.list)         ? grp.conditions.list            : [];
    const condFail  = String(grp?.conditions?.['actions-on-fail']  ?? 'null');
    return igCollapsible(`📦 ${esc(name)}`, `
      ${cardRow(T('Action executors'), igLineArray(sid, fname, `${bp}.action-executors`, execLines))}
      <p class="muted small" style="margin-top:-4px;margin-bottom:6px">${T('One per line — e.g.')} <code>[PARTICLE_SIMPLE] ~name: FLAME; ~target: self;</code></p>
      ${cardRow(T('Target selectors'), igLineArray(sid, fname, `${bp}.target-selectors`, selLines))}
      <p class="muted small" style="margin-top:-4px;margin-bottom:6px">${T('One per line — e.g.')} <code>[SELF] ~name: self;</code> ${T('or')} <code>[RADIUS] ~distance: 5; ~name: near;</code></p>
      ${cardRow(T('Conditions'), igLineArray(sid, fname, `${bp}.conditions.list`, condLines))}
      ${cardRow(T('On conditions fail'), igField(sid, fname, `${bp}.conditions.actions-on-fail`, condFail))}
      <button class="btn-icon btn-del" style="margin-top:6px"
        onclick="APP.igRemoveFromPath('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(name)}')">🗑 ${T('Remove group')}</button>
    `, true, `${fname}:${path}:${name}`);
  }).join('');

  return `
    ${groupsHtml || `<p class="muted small" style="margin-bottom:4px">${T('No action groups yet.')}</p>`}
    <div class="ig-add-row" style="margin-top:6px">
      <input id="ag-n-${fid}" class="edit-input" style="width:130px" placeholder="${T('group name')}" value="default">
      <button class="btn-add-entry"
        onclick="APP.igAddToPath('${sid}','${escJs(fname)}','${escJs(path)}',document.getElementById('ag-n-${fid}').value,{'conditions':{'list':[],'actions-on-fail':'null'},'action-executors':[],'target-selectors':[]})">+ ${T('Add group')}</button>
    </div>`;
}

/**
 * Editor for a single usage click slot (RIGHT or LEFT).
 */
function igUsageSlot(sid, fname, path, data) {
  const cooldown = data?.cooldown ?? 0;
  const actions  = (data?.actions && typeof data.actions === 'object') ? data.actions : {};
  return `
    ${cardRow(T('Cooldown (seconds)'), igNum(sid, fname, `${path}.cooldown`, cooldown))}
    <div style="font-size:11px;font-weight:700;color:#bbb;margin:8px 0 3px">🎬 ${T('Actions')}</div>
    ${igActionGroups(sid, fname, `${path}.actions`, actions)}`;
}

/**
 * Per-level variables editor (level → {varName: value}).
 * Referenced as %var_varName% in lore/actions.
 */
function igVariablesByLevel(sid, fname, path, data) {
  const levels  = (data && typeof data === 'object') ? data : {};
  const fid     = `${sid}-${fname.replace(/[^a-z0-9]/gi, '_')}-vbl`;
  const maxLvl  = Object.keys(levels).reduce((m, k) => Math.max(m, +k || 0), 0);

  const levelsHtml = Object.entries(levels)
    .sort(([a], [b]) => +a - +b)
    .map(([lvl, vars]) => igCollapsible(`${T('Level')} ${lvl}`, `
      ${igLineKvField(sid, fname, `${path}.${lvl}`, vars ?? {}, 'varName value')}
      <p class="muted small" style="margin-top:3px">${T('Reference as <code>%var_varName%</code> in lore/actions.')}</p>
      <button class="btn-icon btn-del" style="margin-top:4px"
        onclick="APP.igRemoveFromPath('${sid}','${escJs(fname)}','${escJs(path)}','${escJs(lvl)}')">🗑 ${T('Remove level')}</button>
    `, true, `${fname}:${path}:lvl-${lvl}`)).join('');

  return `
    ${levelsHtml || `<p class="muted small">${T('No levels defined.')}</p>`}
    <div class="ig-add-row" style="margin-top:6px">
      <span class="muted small">${T('Level')}:</span>
      <input id="vbl-${fid}" class="edit-input edit-input--num" type="number" min="1" value="${maxLvl + 1}" style="width:60px">
      <button class="btn-add-entry"
        onclick="APP.igAddToPath('${sid}','${escJs(fname)}','${escJs(path)}',document.getElementById('vbl-${fid}').value,{})">+ ${T('Add level')}</button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Arrows (modules/arrows/items/ folder — one .yml per arrow type)
// ---------------------------------------------------------------------------

/** Arrow base fields — only what appears in arrow YAMLs. */
function arrowItemBaseRows(sid, fname, data) {
  const loreLines = Array.isArray(data.lore) ? data.lore : [];
  const flags     = data['item-flags'] ?? [];
  const hasAdv    = !!(data['skull-hash'] || data.unbreakable || (data['model-data'] ?? -1) >= 0
                    || Object.keys(data.enchantments ?? {}).length || Object.keys(data.attributes ?? {}).length
                    || data['armor-trim']);
  return `
    ${cardRow(T('Material'),      igField(sid, fname, 'material',   data.material        ?? 'ARROW'))}
    ${cardRow(T('Name'),          igField(sid, fname, 'name',       data.name            ?? '', 'edit-input--format'))}
    <div class="lore-preview" style="margin-bottom:4px">${mc.toHtml(data.name ?? '')}</div>
    ${cardRow(T('Lore'), igLoreFormat(sid, fname, 'lore', loreLines))}
    ${cardRow(T('Tier'),          igField(sid, fname, 'tier',       data.tier            ?? 'common'))}
    ${cardRow(T('Enchanted'),     igCheck(sid, fname, 'enchanted',  !!data.enchanted))}
    ${cardRow(T('Item flags'),    igItemFlags(sid, fname, flags))}
    ${cardRow(T('Color (R,G,B)'), igColorField(sid, fname, 'color', String(data.color ?? '-1,-1,-1')))}
    ${cardRow(T('Level min / max'),
      `<div style="display:flex;gap:6px;align-items:center">
        ${igNum(sid, fname, 'level.min', data.level?.min ?? 1)}
        <span class="muted">–</span>
        ${igNum(sid, fname, 'level.max', data.level?.max ?? 1)}
      </div>`)}
    ${igCollapsible(`🔧 ${T('Advanced')}`, `
      ${cardRow(T('Custom Model Data'),
        `${igNum(sid, fname, 'model-data', data['model-data'] ?? -1)}
         <span class="muted small" style="margin-left:6px">${T('-1 = disabled')}</span>`)}
      ${cardRow(T('Skull Hash'), igField(sid, fname, 'skull-hash', data['skull-hash'] ?? ''))}
      <p class="muted small" style="margin-top:-4px;margin-bottom:6px">${T('Skull texture hash (PLAYER_HEAD material).')}</p>
      ${cardRow(T('Armor Trim'), `
        ${igField(sid, fname, 'armor-trim', data['armor-trim'] ?? '')}
        <p class="muted small" style="margin-top:2px">${T('Format')}: <code>material:pattern</code></p>`)}
      ${cardRow(T('Unbreakable'), igCheck(sid, fname, 'unbreakable', !!data.unbreakable))}
      ${cardRow(T('Enchantments'),
        `${igLineKvFieldNum(sid, fname, 'enchantments', data.enchantments ?? {}, 'enchantment_id level')}
         <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>sharpness 4</code></p>`)}
      ${cardRow(T('Attributes'),
        `${igLineKvField(sid, fname, 'attributes', data.attributes ?? {}, 'ATTRIBUTE_NAME value:operation:slot')}
         <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>ATTACK_DAMAGE 2:ADD_NUMBER:HAND</code></p>`)}
    `, hasAdv, `${fname}:advanced`)}`;
}

/** Consumable base fields — only what appears in consumable YAMLs. */
function consumableItemBaseRows(sid, fname, data) {
  const loreLines = Array.isArray(data.lore) ? data.lore : [];
  const flags     = data['item-flags'] ?? [];
  const hasAdv    = !!(data.unbreakable || (data['model-data'] ?? -1) >= 0
                    || Object.keys(data.enchantments ?? {}).length || Object.keys(data.attributes ?? {}).length
                    || data['armor-trim']);
  return `
    ${cardRow(T('Material'),      igField(sid, fname, 'material',    data.material        ?? 'POTION'))}
    ${cardRow(T('Name'),          igField(sid, fname, 'name',        data.name            ?? '', 'edit-input--format'))}
    <div class="lore-preview" style="margin-bottom:4px">${mc.toHtml(data.name ?? '')}</div>
    ${cardRow(T('Lore'), igLoreFormat(sid, fname, 'lore', loreLines))}
    ${cardRow(T('Tier'),          igField(sid, fname, 'tier',        data.tier            ?? 'common'))}
    ${cardRow(T('Skull hash'),    igField(sid, fname, 'skull-hash',  data['skull-hash']   ?? ''))}
    ${cardRow(T('Color (R,G,B)'), igColorField(sid, fname, 'color', String(data.color ?? '-1,-1,-1')))}
    ${cardRow(T('Item flags'),    igItemFlags(sid, fname, flags))}
    ${cardRow(T('Enchanted'),     igCheck(sid, fname, 'enchanted',   !!data.enchanted))}
    ${cardRow(T('Level min / max'),
      `<div style="display:flex;gap:6px;align-items:center">
        ${igNum(sid, fname, 'level.min', data.level?.min ?? 1)}
        <span class="muted">–</span>
        ${igNum(sid, fname, 'level.max', data.level?.max ?? 1)}
      </div>`)}
    ${igCollapsible(`🔧 ${T('Advanced')}`, `
      ${cardRow(T('Custom Model Data'),
        `${igNum(sid, fname, 'model-data', data['model-data'] ?? -1)}
         <span class="muted small" style="margin-left:6px">${T('-1 = disabled')}</span>`)}
      ${cardRow(T('Armor Trim'), `
        ${igField(sid, fname, 'armor-trim', data['armor-trim'] ?? '')}
        <p class="muted small" style="margin-top:2px">${T('Format')}: <code>material:pattern</code></p>`)}
      ${cardRow(T('Unbreakable'), igCheck(sid, fname, 'unbreakable', !!data.unbreakable))}
      ${cardRow(T('Enchantments'),
        `${igLineKvFieldNum(sid, fname, 'enchantments', data.enchantments ?? {}, 'enchantment_id level')}
         <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>sharpness 4</code></p>`)}
      ${cardRow(T('Attributes'),
        `${igLineKvField(sid, fname, 'attributes', data.attributes ?? {}, 'ATTRIBUTE_NAME value:operation:slot')}
         <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>ATTACK_DAMAGE 2:ADD_NUMBER:HAND</code></p>`)}
    `, hasAdv, `${fname}:advanced`)}`;
}

function renderArrowCard(sid, fname, data) {
  const lvlMin     = data.level?.min ?? 1;
  const lvlMax     = data.level?.max ?? 1;
  const bonusByLvl = data['bonuses-by-level'] ?? {};

  const bonusLevels = Object.entries(bonusByLvl)
    .sort(([a], [b]) => +a - +b)
    .map(([lvl, bonus]) => igCollapsible(
      `✨ ${T('Level')} ${lvl}`,
      `${igBonusTypeMap(sid, fname, `bonuses-by-level.${lvl}.additional-stats`,  bonus['additional-stats']  ?? {}, 'general', 'Additional Stats',  '📊')}
       ${igLineKvField(sid, fname,  `bonuses-by-level.${lvl}.additional-damage`, bonus['additional-damage'] ?? {}, 'damage_type value%  (e.g. physical 10%)')}
       ${igLineKvField(sid, fname,  `bonuses-by-level.${lvl}.defense-ignoring`,  bonus['defense-ignoring']  ?? {}, 'damage_type value%  (e.g. physical 50%)')}
       <button class="btn-icon btn-del" style="margin-top:6px"
         onclick="APP.igRemoveFromPath('${sid}','${escJs(fname)}','bonuses-by-level','${escJs(String(lvl))}')">🗑 ${T('Remove level')}</button>`,
      true, `${fname}:arrow-lvl-${lvl}`)).join('');

  const fid = fname.replace(/[^a-z0-9]/gi, '_');

  return `
    <div class="item-card">
      <details class="card-details" open>
        <summary class="item-card__header">
          <span class="item-card__icon">🏹</span>
          <span style="flex:1;font-weight:600;color:#fff">${esc(fname)}</span>
          <span class="item-card__meta">${esc(data.material ?? 'ARROW')} · ${esc(data.tier ?? 'common')} · ${T('lvl')} ${lvlMin}–${lvlMax}</span>
          <button class="btn-download" onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
          <button class="btn-add-entry" title="${T('Save as template')}"
            onclick="event.stopPropagation();APP.igSaveAsTemplate('${sid}','${escJs(fname)}')">💾</button>
          <button class="btn-icon btn-del"
            onclick="if(confirm('${T('Remove')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
        </summary>
        <div class="item-card__body">
          ${igCollapsible(`📋 ${T('Base Item')}`, arrowItemBaseRows(sid, fname, data), true, `${fname}:base`)}

          ${igCollapsible(`✨ ${T('Bonuses by level')} (${Object.keys(bonusByLvl).length})`,
            bonusLevels + `
            <div class="ig-add-row" style="margin-top:8px">
              <span class="muted small">${T('Level')}:</span>
              <input id="arrow-lvl-${fid}" class="edit-input edit-input--num" type="number" min="1" value="${lvlMax + 1}" style="width:70px">
              <button class="btn-add-entry"
                onclick="APP.igAddToPath('${sid}','${escJs(fname)}','bonuses-by-level',document.getElementById('arrow-lvl-${fid}').value,{'additional-stats':{},'additional-damage':{},'defense-ignoring':{}})">+ ${T('Add level')}</button>
            </div>`, true, `${fname}:arrow-bonuses`)}

          ${igCollapsible(`💥 ${T('On-hit actions')}`, igActionGroups(sid, fname, 'on-hit-actions', data['on-hit-actions'] ?? {}), false, `${fname}:on-hit`)}
          ${igCollapsible(`🌀 ${T('On-fly actions')}`, igActionGroups(sid, fname, 'on-fly-actions', data['on-fly-actions'] ?? {}), false, `${fname}:on-fly`)}

          ${igCollapsible(`🎯 ${T('Target requirements')}`, (() => {
            const tr = data['target-requirements'] ?? {};
            const modArr = Array.isArray(tr.module) ? tr.module : (tr.module ? [String(tr.module)] : []);
            return `
              ${cardRow(T('Item types'), `
                ${igTypeButtons(sid, fname, 'target-requirements.type', tr.type ?? [])}
                <p class="muted small" style="margin-top:3px">${T('WEAPON / ARMOR / * (any).')}</p>`)}
              ${cardRow(T('Socket cat.'),   igField(sid, fname, 'target-requirements.socket', tr.socket ?? ''))}
              ${cardRow(T('Required tier'), igField(sid, fname, 'target-requirements.tier',   tr.tier   ?? ''))}
              ${cardRow(T('Modules'), igLineArray(sid, fname, 'target-requirements.module', modArr))}
              <p class="muted small" style="margin-top:-6px;margin-bottom:4px">${T('One module key per line, e.g.')} <code>bow</code>. ${T('Use <code>*</code> for any.')}</p>
              ${cardRow(T('Level map'), igLineKvField(sid, fname, 'target-requirements.level', tr.level ?? {}, 'min: max  (e.g. 1: 10)'))}`;
          })(), false, `${fname}:target-req`)}
        </div>
      </details>
    </div>`;
}

function renderArrows(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('arrows-file-add-${sid}').click()">+ ${T('Add arrow file')}
    <input id="arrows-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  const toolbar = `
    <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
      ${addBtn}
      <span class="ig-new-wrap">
        ${igTplSelect(sid, [
          { value: 'pierce',             label: T('Piercing Arrow')     },
          { value: 'flame',              label: T('Flame Arrow')        },
          { value: 'snowball-explosive', label: T('Explosive Snowball')  },
          { value: 'arrow-explosive',    label: T('Explosive Arrow')    },
        ])}
        <input id="ig-newfname-${sid}" class="edit-input ig-new-input" type="text" placeholder="my-arrow.yml"
          onkeydown="if(event.key==='Enter'){APP.igAddNewFile('${sid}',this.value,document.getElementById('ig-tpl-${sid}').value);this.value=''}">
        <button class="btn-add-entry"
          onclick="APP.igAddNewFile('${sid}',document.getElementById('ig-newfname-${sid}').value,document.getElementById('ig-tpl-${sid}').value);document.getElementById('ig-newfname-${sid}').value=''">+ ${T('New arrow')}</button>
      </span>
      ${collapseAllBtn()}
    </div>`;

  if (data._multiFile) {
    const entries = Object.entries(data.files || {});
    if (!entries.length) return `
      ${toolbar}
      <div class="empty-state">
        <div style="font-size:36px;margin-bottom:12px">🏹</div>
        <p>${T('Drop arrow YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New arrow</b>.')}</p>
      </div>`;

    const cards = entries.map(([fname, d]) => renderArrowCard(sid, fname, d)).join('');
    return `
      ${toolbar}
      <p class="muted small" style="margin-bottom:14px">${T("Each file = one arrow type. <code>on-hit-actions</code> / <code>on-fly-actions</code> use Divinity's action DSL.")}</p>
      <div class="cards-grid">${cards}</div>`;
  }

  return `${toolbar}<div class="alert alert-warn">⚠️ ${T('No arrow files loaded yet.')}</div>`;
}

// ---------------------------------------------------------------------------
// Consumables (modules/consumables/items/ folder — one .yml per item)
// ---------------------------------------------------------------------------

function renderConsumableCard(sid, fname, data) {
  const lvlMin     = data.level?.min ?? 1;
  const lvlMax     = data.level?.max ?? 1;
  const fid        = fname.replace(/[^a-z0-9]/gi, '_');
  const usesByLvl  = data['uses-by-level']      ?? {};
  const varsByLvl  = data['variables-by-level'] ?? {};
  const effects    = data.effects               ?? {};
  const usage      = data.usage                 ?? {};
  const userReqs   = data['user-requirements-by-level'] ?? {};

  return `
    <div class="item-card">
      <details class="card-details" open>
        <summary class="item-card__header">
          <span class="item-card__icon">🧪</span>
          <span style="flex:1;font-weight:600;color:#fff">${esc(fname)}</span>
          <span class="item-card__meta">${esc(data.material ?? '?')} · ${esc(data.tier ?? 'common')} · ${T('lvl')} ${lvlMin}–${lvlMax}</span>
          <button class="btn-download" onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
          <button class="btn-add-entry" title="${T('Save as template')}"
            onclick="event.stopPropagation();APP.igSaveAsTemplate('${sid}','${escJs(fname)}')">💾</button>
          <button class="btn-icon btn-del"
            onclick="if(confirm('${T('Remove')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
        </summary>
        <div class="item-card__body">
          ${igCollapsible(`📋 ${T('Base Item')}`, consumableItemBaseRows(sid, fname, data), true, `${fname}:base`)}

          ${igCollapsible(`❤️ ${T('Effects')}`, `
            ${cardRow(T('Health restored'),     igNum(sid, fname, 'effects.health',     effects.health     ?? 0))}
            ${cardRow(T('Hunger restored'),     igNum(sid, fname, 'effects.hunger',     effects.hunger     ?? 0))}
            ${cardRow(T('Saturation restored'), igNum(sid, fname, 'effects.saturation', effects.saturation ?? 0))}
          `, true, `${fname}:effects`)}

          ${igCollapsible(`📊 ${T('Uses by level')}`, `
            ${cardRow(T('Uses by level'), igLineKvField(sid, fname, 'uses-by-level', usesByLvl, 'level uses  (e.g. 1 3)'))}
          `, false, `${fname}:uses`)}
          ${igCollapsible(`🔢 ${T('Variables by level')}`, igVariablesByLevel(sid, fname, 'variables-by-level', varsByLvl), false, `${fname}:vars`)}

          ${igCollapsible(`👤 ${T('User requirements by level')}`, `
            ${cardRow(T('Level requirements'), igLineKvField(sid, fname, 'user-requirements-by-level.level', userReqs.level ?? {}, 'item_level player_level  (e.g. 1 10)'))}
            ${cardRow(T('Class requirements'), igLineKvField(sid, fname, 'user-requirements-by-level.class', userReqs.class ?? {}, 'item_level ClassName  (e.g. 1 Warrior,Mage)'))}
            <p class="muted small" style="margin-top:3px">${T('Separate multiple classes with a comma. Leave empty to allow all classes.')}</p>
            ${cardRow(T('Banned classes'), igLineKvField(sid, fname, 'user-requirements-by-level.banned-class', userReqs['banned-class'] ?? {}, 'item_level ClassName  (e.g. 1 Necromancer)'))}
            <p class="muted small" style="margin-top:3px">${T('Classes blocked from using this item at that level.')}</p>
          `, false, `${fname}:user-reqs`)}

          ${igCollapsible(`🖱️ ${T('Usage (click actions)')}`, `
            ${igCollapsible(`👉 ${T('RIGHT click')}`, igUsageSlot(sid, fname, 'usage.RIGHT', usage.RIGHT ?? {}), true,  `${fname}:usage-right`)}
            ${igCollapsible(`👈 ${T('LEFT click')}`,  igUsageSlot(sid, fname, 'usage.LEFT',  usage.LEFT  ?? {}), false, `${fname}:usage-left`)}
          `, false, `${fname}:usage`)}

          ${igCollapsible(`🎯 ${T('Target requirements')}`, (() => {
            const tr = data['target-requirements'] ?? {};
            const modArr = Array.isArray(tr.module) ? tr.module : (tr.module ? [String(tr.module)] : []);
            return `
              ${cardRow(T('Item types'), `
                ${igTypeButtons(sid, fname, 'target-requirements.type', tr.type ?? [])}
                <p class="muted small" style="margin-top:3px">${T('WEAPON / ARMOR / * (any).')}</p>`)}
              ${cardRow(T('Required tier'), igField(sid, fname, 'target-requirements.tier', tr.tier ?? ''))}
              ${cardRow(T('Modules'), igLineArray(sid, fname, 'target-requirements.module', modArr))}
              <p class="muted small" style="margin-top:-6px;margin-bottom:4px">${T('One module key per line, e.g.')} <code>sword</code>. ${T('Use <code>*</code> for any.')}</p>
              ${cardRow(T('Level map'), igLineKvField(sid, fname, 'target-requirements.level', tr.level ?? {}, 'min: max  (e.g. 1: 10)'))}`;
          })(), false, `${fname}:target-req`)}
        </div>
      </details>
    </div>`;
}

function renderConsumables(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('cons-file-add-${sid}').click()">+ ${T('Add consumable file')}
    <input id="cons-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  const toolbar = `
    <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
      ${addBtn}
      <span class="ig-new-wrap">
        ${igTplSelect(sid, [
          { value: 'small-loot-potion',   label: T('Loot Potion')   },
          { value: 'small-health-potion', label: T('Health Potion')  },
          { value: 'burger',              label: T('Burger')         },
        ])}
        <input id="ig-newfname-${sid}" class="edit-input ig-new-input" type="text" placeholder="my-item.yml"
          onkeydown="if(event.key==='Enter'){APP.igAddNewFile('${sid}',this.value,document.getElementById('ig-tpl-${sid}').value);this.value=''}">
        <button class="btn-add-entry"
          onclick="APP.igAddNewFile('${sid}',document.getElementById('ig-newfname-${sid}').value,document.getElementById('ig-tpl-${sid}').value);document.getElementById('ig-newfname-${sid}').value=''">+ ${T('New consumable')}</button>
      </span>
      ${collapseAllBtn()}
    </div>`;

  if (data._multiFile) {
    const entries = Object.entries(data.files || {});
    if (!entries.length) return `
      ${toolbar}
      <div class="empty-state">
        <div style="font-size:36px;margin-bottom:12px">🧪</div>
        <p>${T('Drop consumable YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New consumable</b>.')}</p>
      </div>`;

    const cards = entries.map(([fname, d]) => renderConsumableCard(sid, fname, d)).join('');
    return `
      ${toolbar}
      <p class="muted small" style="margin-bottom:14px">${T('Each file = one consumable type. <code>variables-by-level</code> values are accessible as <code>%varName%</code> in lore.')}</p>
      <div class="cards-grid">${cards}</div>`;
  }

  return `${toolbar}<div class="alert alert-warn">⚠️ ${T('No consumable files loaded yet.')}</div>`;
}

// ---------------------------------------------------------------------------
// Custom Items (modules/custom_items/items/)
// ---------------------------------------------------------------------------

function renderCustomItemCard(sid, fname, d) {
  const name        = d.name              ?? 'New Item';
  const material    = d.material          ?? 'IRON_INGOT';
  const loreLines   = d.lore              ?? [];
  const color       = d.color             ?? '-1,-1,-1';
  const unbreakable = d.unbreakable       ?? false;
  const flags       = d['item-flags']     ?? [];
  const enchants    = d.enchantments      ?? {};
  const modelData   = d['model-data']     ?? -1;
  const durability  = d.durability        ?? -1;
  const enchanted   = d.enchanted         ?? false;
  const skullHash   = d['skull-hash']     ?? '';
  const armorTrim   = d['armor-trim']     ?? '';
  const attributes  = d.attributes        ?? {};

  // Item preview: name + lore in Minecraft style
  const nameHtml = mc.toHtml(name);
  const loreHtml = loreLines.map(l => `<div class="lore-line">${mc.toHtml(l)}</div>`).join('');
  const itemPreview = (name || loreLines.length)
    ? `<div class="lore-preview" style="margin:4px 0 10px">${nameHtml}${loreHtml ? `<div style="margin-top:3px">${loreHtml}</div>` : ''}</div>`
    : '';

  // Enchantments: KEY level (one per line), parsed as int
  const enchSection = igCollapsible(`✨ ${T('Enchantments')}`, `
    ${cardRow(T('Enchantments'),
      `${igLineKvFieldNum(sid, fname, 'enchantments', enchants, 'enchantment_id level')}
       <p class="muted small" style="margin-top:2px">${T('e.g.')} <code>sharpness 4</code> · <code>unbreaking 3</code></p>`)}
  `, Object.keys(enchants).length > 0, `${fname}:enchants`);

  // Vanilla attributes: ATTRIBUTE_NAME value:operation:slot (one per line)
  const attrSection = igCollapsible(`⚔️ ${T('Attributes')}`, `
    ${cardRow(T('Attributes'),
      `${igLineKvField(sid, fname, 'attributes', attributes, 'ATTRIBUTE_NAME value:operation:slot')}
       <p class="muted small" style="margin-top:2px">
         ${T('e.g.')} <code>ATTACK_DAMAGE 2:ADD_NUMBER:HAND</code><br>
         ${T('Operations')}: <code>ADD_NUMBER</code> · <code>ADD_SCALAR</code> · <code>MULTIPLY_SCALAR_1</code><br>
         ${T('Slots')}: <code>HAND</code> · <code>OFF_HAND</code> · <code>HEAD</code> · <code>CHEST</code> · <code>LEGS</code> · <code>FEET</code><br>
         ${T('Attributes')}: <code>ARMOR</code> · <code>ARMOR_TOUGHNESS</code> · <code>ATTACK_DAMAGE</code> · <code>ATTACK_SPEED</code> · <code>MOVEMENT_SPEED</code> · <code>MAX_HEALTH</code> · <code>KNOCKBACK_RESISTANCE</code>
       </p>`)}
  `, Object.keys(attributes).length > 0, `${fname}:attributes`);

  // Advanced: model-data, durability, skull-hash, armor-trim
  const advancedSection = igCollapsible(`🔧 ${T('Advanced')}`, `
    ${cardRow(T('Custom Model Data'),
      `${igNum(sid, fname, 'model-data', modelData)}
       <span class="muted small" style="margin-left:6px">${T('-1 = disabled')}</span>`)}
    ${cardRow(T('Durability'),
      `${igNum(sid, fname, 'durability', durability)}
       <span class="muted small" style="margin-left:6px">${T('-1 = disabled')}</span>`)}
    ${cardRow(T('Skull Hash'), igField(sid, fname, 'skull-hash', skullHash))}
    <p class="muted small" style="margin-top:2px;margin-bottom:6px">${T('Skull texture hash (for PLAYER_HEAD material).')}</p>
    ${cardRow(T('Armor Trim'), igField(sid, fname, 'armor-trim', armorTrim))}
    <p class="muted small" style="margin-top:2px">${T('Format')}: <code>material:pattern</code> ${T('e.g.')} <code>gold:bolt</code></p>
  `, !!(skullHash || armorTrim || modelData >= 0 || durability >= 0), `${fname}:advanced`);

  return `
    <div class="item-card">
      <details class="card-details" open>
        <summary class="item-card__header">
          <span class="item-card__icon">🎁</span>
          <span style="flex:1;font-weight:600;color:#fff">${esc(fname)}</span>
          <span class="item-card__meta">${esc(material)} · ${mc.strip(name) || '?'}</span>
          <button class="btn-download" onclick="APP.igDownload('${sid}','${escJs(fname)}')">⬇</button>
          <button class="btn-add-entry" title="${T('Save as template')}"
            onclick="event.stopPropagation();APP.igSaveAsTemplate('${sid}','${escJs(fname)}')">💾</button>
          <button class="btn-icon btn-del"
            onclick="if(confirm('${T('Remove')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
        </summary>
        <div class="item-card__body">

          ${cardRow(T('Material'), igField(sid, fname, 'material', material))}
          ${cardRow(T('Name'),     igField(sid, fname, 'name',     name, 'edit-input--format'))}
          ${itemPreview}

          ${cardRow(T('Lore'), igLoreFormat(sid, fname, 'lore', loreLines))}

          ${cardRow(T('Color (R,G,B)'),
            `${igColorField(sid, fname, 'color', color)}
             <p class="muted small" style="margin-top:2px">${T('Leather armor / potion color.')} <code>-1,-1,-1</code> = ${T('default.')}</p>`)}

          ${cardRow(T('Unbreakable'), igCheck(sid, fname, 'unbreakable', unbreakable))}
          ${cardRow(T('Glint (enchanted look)'), igCheck(sid, fname, 'enchanted', enchanted))}
          ${cardRow(T('Item Flags'), igItemFlags(sid, fname, flags))}

          ${enchSection}
          ${attrSection}
          ${advancedSection}

        </div>
      </details>
    </div>`;
}

function renderCustomItems(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('ci-file-add-${sid}').click()">+ ${T('Add item file')}
    <input id="ci-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  const toolbar = `
    <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
      ${addBtn}
      <span class="ig-new-wrap">
        ${igTplSelect(sid, [
          { value: 'basic', label: T('Basic Item') },
        ])}
        <input id="ig-newfname-${sid}" class="edit-input ig-new-input" type="text" placeholder="my-item.yml"
          onkeydown="if(event.key==='Enter'){APP.igAddNewFile('${sid}',this.value,document.getElementById('ig-tpl-${sid}').value);this.value=''}">
        <button class="btn-add-entry"
          onclick="APP.igAddNewFile('${sid}',document.getElementById('ig-newfname-${sid}').value,document.getElementById('ig-tpl-${sid}').value);document.getElementById('ig-newfname-${sid}').value=''">+ ${T('New item')}</button>
      </span>
      ${collapseAllBtn()}
    </div>`;

  if (data._multiFile) {
    const entries = Object.entries(data.files || {});
    if (!entries.length) return `
      ${toolbar}
      <div class="empty-state">
        <div style="font-size:36px;margin-bottom:12px">🎁</div>
        <p>${T('Drop custom item YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New item</b>.')}</p>
        <p class="muted small">${T('Custom items are static — no Divinity stats. Use <b>Item Generator</b> for stat-bearing items.')}</p>
      </div>`;

    const cards = entries.map(([fname, d]) => renderCustomItemCard(sid, fname, d)).join('');
    return `
      ${toolbar}
      <p class="muted small" style="margin-bottom:14px">
        ${T('Each file = one custom item type. Custom items do not have Divinity RPG stats — use <b>Item Generator</b> for items with damage/defense. Give with:')}
        <code>/customitems give &lt;player&gt; &lt;id&gt; [amount]</code>
      </p>
      <div class="cards-grid">${cards}</div>`;
  }

  return `${toolbar}<div class="alert alert-warn">⚠️ ${T('No custom item files loaded yet.')}</div>`;
}

// ---------------------------------------------------------------------------
// Build Preview
// ---------------------------------------------------------------------------

const BUILD_SLOTS = [
  { key: 'weapon',  icon: '⚔️',  label: 'Weapon'    },
  { key: 'offhand', icon: '🗡',  label: 'Off-hand'  },
  { key: 'helmet',  icon: '⛑️',  label: 'Helmet'    },
  { key: 'chest',   icon: '🥋',  label: 'Chestplate' },
  { key: 'legs',    icon: '👖',  label: 'Leggings'  },
  { key: 'boots',   icon: '👟',  label: 'Boots'     },
];

function _buildScale(base, scaleFactor, level) {
  let s = scaleFactor ?? 1.0;
  if (!Number.isFinite(s) || s === 0) s = 1;
  const vScale = (s * 100 - 100) * ((level || 1) - 1) / 100 + 1;
  return base * Math.max(vScale, 0.001);
}

function calcBuild() {
  const totalDmg         = {};
  const totalDmgMin      = {};   // sum of per-item min values
  const totalDmgMax      = {};   // sum of per-item max values
  const totalDef         = {};
  const totalDefMin      = {};
  const totalDefMax      = {};
  const totalStats       = {};
  const totalFabledAttrs = {};   // raw avg attribute points from items
  const totalSkills      = {};
  const activeSets       = [];

  for (const slotDef of BUILD_SLOTS) {
    const slot = BUILD_STATE.slots[slotDef.key];
    if (!slot?.fname) continue;
    const itemData = STATE.loaded?.itemgen?.files?.[slot.fname];
    if (!itemData) continue;
    const gen   = itemData.generator || {};
    const level = slot.level || 1;

    // Damage types
    for (const [type, info] of Object.entries(gen['damage-types']?.list || {})) {
      if (typeof info !== 'object' || (info.chance ?? 100) <= 0) continue;
      const mn  = _buildScale(info.min ?? 0, info['scale-by-level'], level);
      const mx  = _buildScale(info.max ?? 0, info['scale-by-level'], level);
      const avg = (mn + mx) / 2;
      totalDmg[type]    = (totalDmg[type]    || 0) + avg;
      totalDmgMin[type] = (totalDmgMin[type] || 0) + mn;
      totalDmgMax[type] = (totalDmgMax[type] || 0) + mx;
    }

    // Defense types
    for (const [type, info] of Object.entries(gen['defense-types']?.list || {})) {
      if (typeof info !== 'object' || (info.chance ?? 100) <= 0) continue;
      const mn  = _buildScale(info.min ?? 0, info['scale-by-level'], level);
      const mx  = _buildScale(info.max ?? 0, info['scale-by-level'], level);
      const avg = (mn + mx) / 2;
      totalDef[type]    = (totalDef[type]    || 0) + avg;
      totalDefMin[type] = (totalDefMin[type] || 0) + mn;
      totalDefMax[type] = (totalDefMax[type] || 0) + mx;
    }

    // Item stats
    for (const [stat, info] of Object.entries(gen['item-stats']?.list || {})) {
      if (typeof info !== 'object' || (info.chance ?? 100) <= 0) continue;
      const avg = ((info.min ?? 0) + (info.max ?? 0)) / 2;
      totalStats[stat] = (totalStats[stat] || 0) + avg;
    }

    // Fabled attributes — accumulate scaled avg points per attribute
    for (const [attr, info] of Object.entries(gen['fabled-attributes']?.list || {})) {
      if (typeof info !== 'object' || (info.chance ?? 100) <= 0) continue;
      const avg = _buildScale(((info.min ?? 0) + (info.max ?? 0)) / 2, info['scale-by-level'], level);
      totalFabledAttrs[attr] = (totalFabledAttrs[attr] || 0) + avg;
    }

    // Skills
    for (const [skill, info] of Object.entries(gen.skills?.list || {})) {
      if (typeof info !== 'object' || (info.chance ?? 100) <= 0) continue;
      totalSkills[skill] = Math.max(totalSkills[skill] || 0, info.level ?? 1);
    }

    // Gem bonuses
    for (let i = 0; i < 3; i++) {
      const gemFname = slot.gems[i];
      if (!gemFname) continue;
      const gemData = STATE.loaded?.gems?.files?.[gemFname];
      if (!gemData) continue;
      const bonuses = gemData['bonuses-by-level']?.[String(slot.gemLevels[i] || 1)] || {};
      for (const [t, v] of Object.entries(bonuses['damage-types']  || {})) totalDmg[t]   = (totalDmg[t]   || 0) + (parseFloat(String(v)) || 0);
      for (const [t, v] of Object.entries(bonuses['defense-types'] || {})) totalDef[t]   = (totalDef[t]   || 0) + (parseFloat(String(v)) || 0);
      for (const [s, v] of Object.entries(bonuses['item-stats']    || {})) totalStats[s] = (totalStats[s] || 0) + (parseFloat(String(v)) || 0);
    }
  }

  // Evaluate Fabled Attribute stat formulas — keep separate from item totalStats
  const faStatContributions = {};   // statId → total from all FA formulas
  const faAttrBreakdown     = {};   // attr_key → { pts, stats, dispName, noDefMsg }
  const faAttrDefs = STATE.loaded?.fabledAttributes;
  const faDefsLoaded = faAttrDefs != null && typeof faAttrDefs === 'object';

  // Case-insensitive lookup: item generator may use 'stamina', FA section may store 'Stamina'
  function _faLookup(key) {
    if (!faDefsLoaded) return undefined;
    if (faAttrDefs[key] !== undefined) return faAttrDefs[key];
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(faAttrDefs)) {
      if (k.toLowerCase() === lower) return v;
    }
    return undefined;
  }

  // Apply FA overrides — manual pts override per attr (from BUILD_STATE.faOverrides)
  for (const [attr, overridePts] of Object.entries(BUILD_STATE.faOverrides ?? {})) {
    if (typeof overridePts === 'number' && isFinite(overridePts)) {
      totalFabledAttrs[attr] = overridePts;  // fully replaces item-derived value
    }
  }

  // Always populate breakdown for every accumulated attr (even if fabledAttributes not loaded)
  for (const [attr, pts] of Object.entries(totalFabledAttrs)) {
    const attrStats = {};
    const attrDef   = _faLookup(attr);
    let   noDefMsg  = '';   // diagnostic string shown in FA card when stats are empty

    if (!faDefsLoaded) {
      noDefMsg = 'Load ⭐ Fabled Attributes section for stat contributions';
    } else if (!attrDef) {
      noDefMsg = `"${attr}" not found in Fabled Attributes section`;
    } else {
      const rawStats = attrDef.stats;
      const statsObj = rawStats && typeof rawStats === 'object' && !Array.isArray(rawStats) ? rawStats : {};
      const statEntries = Object.entries(statsObj);
      if (statEntries.length === 0) {
        noDefMsg = 'no stats defined for this attribute';
      } else {
        for (const [statId, formula] of statEntries) {
          const val = evalFaFormula(String(formula ?? 'a'), pts);
          if (isFinite(val) && val !== 0) {
            faStatContributions[statId] = (faStatContributions[statId] || 0) + val;
            attrStats[statId] = (attrStats[statId] || 0) + val;
          }
        }
        if (Object.keys(attrStats).length === 0) {
          noDefMsg = 'all formulas returned 0 at this level';
        }
      }
    }

    faAttrBreakdown[attr] = { pts, stats: attrStats, dispName: attrDef?.display ?? '', noDefMsg };
  }

  // Set detection
  for (const [, setData] of Object.entries(STATE.loaded?.sets?.files || {})) {
    if (!setData || typeof setData !== 'object') continue;
    let matchCount = 0;
    const elemCount = Object.keys(setData.elements || {}).length;
    for (const [, elemData] of Object.entries(setData.elements || {})) {
      const prefix   = mc.strip(setData.prefix || '');
      const suffix   = mc.strip(setData.suffix || '');
      const elemName = mc.strip(elemData.name || '')
        .replace('%prefix%', prefix).replace('%suffix%', suffix).trim().toLowerCase();
      if (!elemName) continue;
      for (const slotDef of BUILD_SLOTS) {
        const slot = BUILD_STATE.slots[slotDef.key];
        if (!slot?.fname) continue;
        const iData = STATE.loaded?.itemgen?.files?.[slot.fname];
        if (!iData) continue;
        if (mc.strip(iData.name || '').toLowerCase().includes(elemName)) { matchCount++; break; }
      }
    }

    const byAmount = setData.bonuses?.['by-elements-amount'] || {};
    for (const [cnt, bonusData] of Object.entries(byAmount).sort(([a],[b]) => +a - +b)) {
      if (matchCount >= +cnt) {
        activeSets.push({ name: setData.name || '?', count: +cnt, total: elemCount, bonuses: bonusData });
        // Apply set bonus to totals
        for (const [t, v] of Object.entries(bonusData['damage-types']  || {})) totalDmg[t]   = (totalDmg[t]   || 0) + (parseFloat(String(v)) || 0);
        for (const [t, v] of Object.entries(bonusData['defense-types'] || {})) totalDef[t]   = (totalDef[t]   || 0) + (parseFloat(String(v)) || 0);
        for (const [s, v] of Object.entries(bonusData['item-stats']    || {})) totalStats[s] = (totalStats[s] || 0) + (parseFloat(String(v)) || 0);
      }
    }
  }

  return { totalDmg, totalDmgMin, totalDmgMax, totalDef, totalDefMin, totalDefMax, totalStats, totalFabledAttrs, faStatContributions, faAttrBreakdown, totalSkills, activeSets };
}

function renderBuildPreview(_data, _sid) {
  const igFiles   = Object.keys(STATE.loaded?.itemgen?.files    || {});
  const gemFiles  = Object.keys(STATE.loaded?.gems?.files       || {});
  const essFiles  = Object.keys(STATE.loaded?.essences?.files   || {});
  const runeFiles = Object.keys(STATE.loaded?.runes?.files      || {});

  const activeTab = BUILD_STATE.buildTab ?? 'builder';

  const { totalDmg, totalDmgMin, totalDmgMax, totalDef, totalDefMin, totalDefMax, totalStats, totalFabledAttrs, faStatContributions, faAttrBreakdown, totalSkills, activeSets } = calcBuild();

  // Merged-stat helper: case-insensitive sum across item stats + FA stat contributions.
  function getMS(id) {
    const lo = id.toLowerCase();
    let v = 0;
    for (const [k, val] of Object.entries(totalStats))         { if (typeof val === 'number' && k.toLowerCase() === lo) v += val; }
    for (const [k, val] of Object.entries(faStatContributions)){ if (typeof val === 'number' && k.toLowerCase() === lo) v += val; }
    return v;
  }

  // ---- Equipment slots ----
  const slotsHtml = BUILD_SLOTS.map(slotDef => {
    const slot     = BUILD_STATE.slots[slotDef.key];
    const itemData = slot.fname ? STATE.loaded?.itemgen?.files?.[slot.fname] : null;
    const namePreview = itemData
      ? `<span class="build-name-preview">${mc.toHtml(itemData.name ?? '')}</span>` : '';

    // Socket counts — read from item if loaded, else show all slots as available
    const gen     = itemData?.generator || {};
    const sockets = gen.sockets || {};
    const gemMax  = itemData ? (sockets.GEM?.maximum     ?? 0) : 3;
    const essMax  = itemData ? (sockets.ESSENCE?.maximum ?? 0) : 1;
    const runeMax = itemData ? (sockets.RUNE?.maximum    ?? 0) : 1;

    const itemSelect = `
      <select class="edit-input build-slot-select"
        onchange="APP.buildSetSlot('${slotDef.key}',this.value)">
        <option value="">— ${T('none')} —</option>
        ${igFiles.map(f => {
          const d = STATE.loaded?.itemgen?.files?.[f];
          const label = d?.name ? `${esc(f)} (${esc(mc.strip(d.name))})` : esc(f);
          return `<option value="${esc(f)}"${slot.fname===f?' selected':''}>${label}</option>`;
        }).join('')}
      </select>`;

    const lvlInput = `<input class="edit-input edit-input--num" type="number" min="1" max="200"
      value="${slot.level}" style="width:52px"
      oninput="APP.buildSetLevel('${slotDef.key}',this.value)">`;

    // GEM rows (up to gemMax)
    const gemsHtml = Array.from({ length: gemMax }, (_, i) => {
      const gf    = slot.gems[i] || '';
      const gData = gf ? STATE.loaded?.gems?.files?.[gf] : null;
      const gMax  = gData?.level?.max ?? 10;
      return `<div class="build-gem-row">
        <span class="build-socket-icon">💎${i+1}</span>
        <select class="edit-input build-gem-select"
          onchange="APP.buildSetGem('${slotDef.key}',${i},this.value)">
          <option value="">— ${T('no gem')} —</option>
          ${gemFiles.map(f => `<option value="${esc(f)}"${gf===f?' selected':''}>${esc(f)}</option>`).join('')}
        </select>
        ${gf ? `<input class="edit-input edit-input--num" type="number" min="1" max="${gMax}"
          value="${slot.gemLevels[i]||1}" style="width:42px;font-size:11px"
          oninput="APP.buildSetGemLevel('${slotDef.key}',${i},this.value)">` : ''}
      </div>`;
    }).join('');

    // ESSENCE row
    const essHtml = essMax > 0 ? (() => {
      const ef    = slot.essence || '';
      const eData = ef ? STATE.loaded?.essences?.files?.[ef] : null;
      const eMax  = eData?.level?.max ?? 3;
      return `<div class="build-gem-row">
        <span class="build-socket-icon">✨</span>
        <select class="edit-input build-gem-select"
          onchange="APP.buildSetEssence('${slotDef.key}',this.value)">
          <option value="">— ${T('no essence')} —</option>
          ${essFiles.map(f => `<option value="${esc(f)}"${ef===f?' selected':''}>${esc(f)}</option>`).join('')}
        </select>
        ${ef ? `<input class="edit-input edit-input--num" type="number" min="1" max="${eMax}"
          value="${slot.essenceLevel||1}" style="width:42px;font-size:11px"
          oninput="APP.buildSetEssenceLevel('${slotDef.key}',this.value)">` : ''}
      </div>`;
    })() : '';

    // RUNE row
    const runeHtml = runeMax > 0 ? (() => {
      const rf    = slot.rune || '';
      const rData = rf ? STATE.loaded?.runes?.files?.[rf] : null;
      const rMax  = rData?.level?.max ?? 3;
      return `<div class="build-gem-row">
        <span class="build-socket-icon">🔷</span>
        <select class="edit-input build-gem-select"
          onchange="APP.buildSetRune('${slotDef.key}',this.value)">
          <option value="">— ${T('no rune')} —</option>
          ${runeFiles.map(f => `<option value="${esc(f)}"${rf===f?' selected':''}>${esc(f)}</option>`).join('')}
        </select>
        ${rf ? `<input class="edit-input edit-input--num" type="number" min="1" max="${rMax}"
          value="${slot.runeLevel||1}" style="width:42px;font-size:11px"
          oninput="APP.buildSetRuneLevel('${slotDef.key}',this.value)">` : ''}
      </div>`;
    })() : '';

    const lvlMin = itemData?.level?.min;
    const lvlMax = itemData?.level?.max;
    const lvlWarn = (lvlMin != null && slot.level < lvlMin) || (lvlMax != null && slot.level > lvlMax)
      ? `<div style="font-size:10px;color:#fa8;padding:2px 4px">⚠️ ${T('Item level range')}: ${lvlMin ?? '?'}–${lvlMax ?? '?'}</div>`
      : '';

    return `
      <div class="build-slot-card">
        <div class="build-slot-row">
          <span class="build-slot-label">${slotDef.icon} ${T(slotDef.label)}</span>
          ${itemSelect}
          <span class="muted small">${T('Lv')}</span>${lvlInput}
          ${namePreview}
        </div>
        ${lvlWarn}
        ${gemsHtml}${essHtml}${runeHtml}
      </div>`;
  }).join('');

  // ---- Summary helpers ----
  function statTable(entries, color) {
    if (!entries.length) return `<tr><td colspan="2" class="muted small" style="padding:4px">—</td></tr>`;
    return entries.map(([k, v]) =>
      `<tr><td style="padding:2px 4px">${esc(k)}</td>
           <td style="padding:2px 4px;text-align:right;color:${color}">${typeof v === 'number' ? v.toFixed(2) : esc(String(v))}</td></tr>`
    ).join('');
  }

  // Format a number neatly (trim trailing zeros after decimal)
  function fmtN(v) {
    if (!isFinite(v)) return '?';
    const s = v.toFixed(3);
    return s.replace(/\.?0+$/, '') || '0';
  }

  const dmgEntries   = Object.entries(totalDmg);
  const defEntries   = Object.entries(totalDef);
  const skillEntries = Object.entries(totalSkills);

  // Damage/defense with min-max range
  function rangeTable(avgObj, minObj, maxObj, color) {
    const entries = Object.entries(avgObj);
    if (!entries.length) return `<tr><td colspan="2" class="muted small" style="padding:4px">—</td></tr>`;
    return entries.map(([k, avg]) => {
      const mn = minObj[k] ?? avg;
      const mx = maxObj[k] ?? avg;
      const hasRange = Math.abs(mx - mn) > 0.001;
      return `<tr>
        <td style="padding:2px 4px">${esc(k)}</td>
        <td style="padding:2px 4px;text-align:right;color:${color}">
          ${fmtN(avg)}
          ${hasRange ? `<span class="muted" style="font-size:10px;margin-left:3px">(${fmtN(mn)}–${fmtN(mx)})</span>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  // ---- Merged Item Stats + FA contributions ----
  // HP/Mana-related stats go to their own summary cards, not the stat table
  const HP_STAT_IDS   = new Set(['max_health', 'MAX_HEALTH', 'health', 'absorption']);
  const MANA_STAT_IDS = new Set(['mana', 'max_mana', 'mana_regen', 'mana-regen', 'MANA', 'MAX_MANA', 'MANA_REGEN']);
  const EXCLUDED_IDS  = new Set([...HP_STAT_IDS, ...MANA_STAT_IDS]);
  const allStatIds = new Set(
    [...Object.keys(totalStats), ...Object.keys(faStatContributions)]
      .filter(id => !EXCLUDED_IDS.has(id))
  );
  const mergedStatRows = [...allStatIds].sort().map(id => {
    const itemVal = totalStats[id]           || 0;
    const faVal   = faStatContributions[id]  || 0;
    const total   = itemVal + faVal;
    if (total === 0) return '';
    const hasBoth = itemVal !== 0 && faVal !== 0;
    const faOnly  = itemVal === 0 && faVal  !== 0;
    const color   = (hasBoth || faOnly) ? '#e8c87a' : '#af8';
    const suffix  = hasBoth
      ? ` <span class="muted" style="font-size:10px">(${fmtN(itemVal)} item)</span>`
      : faOnly
      ? ` <span class="muted" style="font-size:10px">(FA)</span>`
      : '';
    return `<tr>
      <td style="padding:2px 4px">${esc(id)}</td>
      <td style="padding:2px 4px;text-align:right;color:${color}">${fmtN(total)}${suffix}</td>
    </tr>`;
  }).filter(Boolean).join('') || `<tr><td colspan="2" class="muted small" style="padding:4px">—</td></tr>`;

  // ---- Fabled Attributes breakdown — per attr: stat contributions ----
  const faBreakdownRows = Object.entries(faAttrBreakdown).map(([attr, { pts, stats, dispName, noDefMsg }]) => {
    const label    = dispName && dispName !== attr
      ? `<b>[${esc(attr)}]</b> <span class="muted small">${esc(dispName)}</span>`
      : `<b>[${esc(attr)}]</b>`;
    const statLines = Object.entries(stats).map(([statId, val]) => {
      const sign = val >= 0 ? '+' : '';
      return `<tr>
        <td style="padding:1px 16px;color:#bbb;font-size:11px">${esc(statId)}</td>
        <td style="padding:1px 4px;text-align:right;color:#da8;font-size:11px">${sign}${fmtN(val)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="2" style="padding:1px 16px;font-size:10px;color:#888;font-style:italic">${esc(noDefMsg)}</td></tr>`;
    return `
      <tr style="border-top:1px solid #2a2a2a">
        <td colspan="2" style="padding:5px 4px 1px">${label}
          <span class="muted small" style="margin-left:6px">${fmtN(pts)} pts avg</span>
        </td>
      </tr>
      ${statLines}`;
  }).join('') || `<tr><td colspan="2" class="muted small" style="padding:4px">No Fabled Attributes on equipped items.</td></tr>`;

  // ---- HP summary — reads both Fabled and Divinity stat systems ----
  const BASE_HP = BUILD_STATE.baseHp ?? 20;

  // Fabled native stats
  const faHealth     = faStatContributions['health']     || 0;  // Fabled: health
  const faAbsorption = faStatContributions['absorption'] || 0;  // Fabled 1.21+: absorption

  // Divinity MAX_HEALTH — from item stats AND from FA formula contributions
  const itemMaxHp = totalStats['max_health']          || totalStats['MAX_HEALTH']          || 0;
  const faMaxHp   = faStatContributions['max_health'] || faStatContributions['MAX_HEALTH'] || 0;

  const totalHP = BASE_HP + faHealth + faAbsorption + faMaxHp + itemMaxHp;

  function hpRow(label, system, val, color) {
    return val ? `<tr>
      <td style="padding:2px 6px;color:#aaa">${label} <code style="font-size:10px;color:#666">${system}</code></td>
      <td style="padding:2px 6px;text-align:right;color:${color}">${val > 0 ? '+' : ''}${fmtN(val)}</td>
    </tr>` : '';
  }

  const hpRows = [
    `<tr><td style="padding:2px 6px;color:#aaa">⬜ Base</td><td style="padding:2px 6px;text-align:right;color:#f88">${BASE_HP}</td></tr>`,
    hpRow('⭐ Fabled',  'health',     faHealth,     '#da8'),
    hpRow('⭐ Fabled',  'absorption', faAbsorption, '#da8'),
    hpRow('⭐ FA stat', 'MAX_HEALTH', faMaxHp,      '#da8'),
    hpRow('📦 Divinity','max_health', itemMaxHp,    '#af8'),
    `<tr style="border-top:1px solid #444">
      <td style="padding:4px 6px;font-weight:700">❤ Total HP</td>
      <td style="padding:4px 6px;text-align:right;font-weight:700;font-size:15px;color:#f44">${totalHP.toFixed(1)}</td>
    </tr>`,
  ].filter(Boolean).join('');

  // ---- Mana summary ----
  const BASE_MANA      = BUILD_STATE.baseMana      ?? 0;
  const BASE_MANA_REGEN= BUILD_STATE.baseManaRegen ?? 0;

  const itemMana     = totalStats['mana']      || totalStats['max_mana']  || totalStats['MANA']      || 0;
  const itemManaRegen= totalStats['mana_regen']|| totalStats['mana-regen']|| totalStats['MANA_REGEN']|| 0;
  const faMana      = faStatContributions['mana']       || faStatContributions['max_mana']   || 0;
  const faManaRegen = faStatContributions['mana-regen'] || faStatContributions['mana_regen'] || 0;

  const totalMana      = BASE_MANA      + itemMana      + faMana;
  const totalManaRegen = BASE_MANA_REGEN+ itemManaRegen + faManaRegen;

  function manaRow(label, system, val, color) {
    return val ? `<tr>
      <td style="padding:2px 6px;color:#aaa">${label} <code style="font-size:10px;color:#666">${system}</code></td>
      <td style="padding:2px 6px;text-align:right;color:${color}">${val > 0 ? '+' : ''}${fmtN(val)}</td>
    </tr>` : '';
  }

  const manaRows = [
    `<tr><td style="padding:2px 6px;color:#aaa">⬜ Base</td><td style="padding:2px 6px;text-align:right;color:#88f">${BASE_MANA}</td></tr>`,
    manaRow('⭐ FA',      'mana',      faMana,      '#da8'),
    manaRow('📦 Divinity','mana',      itemMana,    '#8af'),
    `<tr style="border-top:1px solid #444">
      <td style="padding:4px 6px;font-weight:700">🔮 Total Mana</td>
      <td style="padding:4px 6px;text-align:right;font-weight:700;font-size:15px;color:#88f">${totalMana.toFixed(1)}</td>
    </tr>`,
  ].filter(Boolean).join('');

  const manaRegenRows = [
    `<tr><td style="padding:2px 6px;color:#aaa">⬜ Base /s</td><td style="padding:2px 6px;text-align:right;color:#aaf">${BASE_MANA_REGEN}</td></tr>`,
    manaRow('⭐ FA',       'mana-regen', faManaRegen,   '#da8'),
    manaRow('📦 Divinity', 'mana_regen', itemManaRegen, '#8af'),
    `<tr style="border-top:1px solid #444">
      <td style="padding:4px 6px;font-weight:700">⚡ Total Regen/s</td>
      <td style="padding:4px 6px;text-align:right;font-weight:700;font-size:15px;color:#aaf">${totalManaRegen.toFixed(2)}</td>
    </tr>`,
  ].filter(Boolean).join('');

  // ---- Formula / mode — used by both tabs ----
  const formulaData   = STATE.loaded?.formula;
  const formulaCombat = (formulaData?.combat || formulaData) ?? {};
  const mode          = String(formulaCombat['defense-formula'] ?? 'FACTOR').toUpperCase();
  const customExpr    = formulaCombat['custom-defense-formula'] ?? '';

  const defTypeCfg = STATE.loaded?.defense ?? {};
  const defbuffCfg = STATE.loaded?.defbuff ?? {};

  // PvE/PvP defense mod — multiplicative on raw defense (incl. FA contributions)
  const pveDefMod = 1 + Math.max(getMS('pve_defense'), getMS('pvp_defense')) / 100;

  // Armor toughness (FACTOR formula denominator)
  const toughness = getMS('armor_toughness');

  // ---- Active sets ----
  const setsHtml = activeSets.length
    ? activeSets.map(s => {
        const lore = (s.bonuses.lore || []).map(l => `<div class="muted small">${mc.toHtml(l)}</div>`).join('');
        return `<div class="build-set-entry">
          <span style="font-weight:600">${mc.toHtml(s.name)}</span>
          <span class="badge" style="margin-left:6px">${s.count}/${s.total}${T('pc')}</span>
          ${lore}
        </div>`;
      }).join('')
    : `<div class="muted small">${T('No active sets detected.')}</div>`;

  const noIgWarn = !igFiles.length
    ? `<div class="alert alert-warn" style="margin-bottom:16px">⚠️ ${T('No item generator files loaded — go to <b>Load Files</b> first.')}</div>`
    : '';

  // Read caps from general_stats.yml — shared by both tabs
  const gsData = STATE.loaded?.general ?? {};
  function gsCap(key) {
    const entry = gsData[key.toUpperCase()] ?? gsData[key];
    if (!entry) return null;
    const c = parseFloat(entry.capacity ?? -1);
    return (isNaN(c) || c < 0) ? null : c;
  }

  const capCritRate  = gsCap('CRITICAL_RATE')   ?? 100;
  const capCritDmg   = gsCap('CRITICAL_DAMAGE');
  const capPveDmg    = gsCap('PVE_DAMAGE');
  const capPvpDmg    = gsCap('PVP_DAMAGE');
  const capDodge     = gsCap('DODGE_RATE')      ?? 45;
  const capBlock     = gsCap('BLOCK_RATE')      ?? 100;
  const capBlockDmg  = gsCap('BLOCK_DAMAGE');
  const capVamp      = gsCap('VAMPIRISM')       ?? 35;
  const capGlobalPen = gsCap('PENETRATION')     ?? 60;
  const capAccuracy  = gsCap('ACCURACY_RATE')   ?? 30;

  // ---- Tab buttons ----
  const tabButtons = `
    <div style="display:flex;gap:4px;margin-bottom:14px;border-bottom:2px solid #2a2a2a;padding-bottom:0">
      <button onclick="APP.buildSetTab('builder')"
        style="padding:6px 18px;border:none;border-radius:6px 6px 0 0;cursor:pointer;font-size:13px;font-weight:600;
               background:${activeTab==='builder'?'#1e3a2f':'#1a1a1a'};
               color:${activeTab==='builder'?'#7fca9a':'#666'};
               border-bottom:${activeTab==='builder'?'2px solid #7fca9a':'2px solid transparent'};
               margin-bottom:-2px">🔧 ${T('Builder')}</button>
      <button onclick="APP.buildSetTab('combat')"
        style="padding:6px 18px;border:none;border-radius:6px 6px 0 0;cursor:pointer;font-size:13px;font-weight:600;
               background:${activeTab==='combat'?'#3a1e1e':'#1a1a1a'};
               color:${activeTab==='combat'?'#f88':'#666'};
               border-bottom:${activeTab==='combat'?'2px solid #f88':'2px solid transparent'};
               margin-bottom:-2px">⚔️ ${T('Combat Test')}</button>
    </div>`;

  // =========================================================================
  // COMBAT TEST TAB
  // =========================================================================
  if (activeTab === 'combat') {
    const defCfgLoaded = Object.keys(defTypeCfg).length > 0;
    const dmgEntryPos  = dmgEntries.filter(([, v]) => v > 0);
    const defEntryPos2 = defEntries.filter(([, v]) => v > 0);
    const enemyDefs    = BUILD_STATE.combatEnemyDefs ?? {};
    const combatAtkDmg = BUILD_STATE.combatAtkDmg ?? 100;
    const enemyGlobalPen = Math.min(BUILD_STATE.combatEnemyPen ?? 0, 100);

    // --- Combat stats from merged build (caps from general_stats.yml) ---
    const critRate    = Math.min(getMS('critical_rate'),   capCritRate);
    const critDmg     = Math.max(1, capCritDmg != null ? Math.min(getMS('critical_damage'), capCritDmg) : getMS('critical_damage'));
    const pveDmgPct   = capPveDmg    != null ? Math.min(getMS('pve_damage'),    capPveDmg)    : getMS('pve_damage');
    const pvpDmgPct   = capPvpDmg    != null ? Math.min(getMS('pvp_damage'),    capPvpDmg)    : getMS('pvp_damage');
    const dodgeRate   = Math.min(getMS('dodge_rate'),   capDodge);
    const blockRate   = Math.min(getMS('block_rate'),   capBlock);
    const blockDmgPct = capBlockDmg  != null ? Math.min(getMS('block_damage'),  capBlockDmg)  : getMS('block_damage');
    const vampPct     = Math.min(getMS('vampirism'),    capVamp);
    const globalPenPct= Math.min(getMS('penetration'),  capGlobalPen);
    const accuracyPct = Math.min(getMS('accuracy_rate'),capAccuracy);

    // Penetration entries from loaded section
    const penCfg = STATE.loaded?.penetration ?? {};
    const penEntries = Object.entries(penCfg)
      .filter(([, cfg]) => cfg && cfg.enabled !== false)
      .map(([id, cfg]) => ({
        id,
        hooks:      Array.isArray(cfg.hooks) ? cfg.hooks : [],
        percentPen: cfg['percent-pen'] === true,
        statVal:    getMS('penetration_' + id),
      }))
      .filter(e => e.statVal > 0);

    // Enemy type + damage modifier
    const enemyType  = BUILD_STATE.combatEnemyType ?? 'mob';
    const enemyIsMob = enemyType === 'mob';
    const dmgModAtk  = 1 + (enemyIsMob ? pveDmgPct : pvpDmgPct) / 100;

    // Expected critical multiplier: (1 - cr%) * 1x + cr% * critDmg
    const critMod = critRate > 0 && critDmg > 1
      ? 1 + (critRate / 100) * (critDmg - 1)
      : 1;

    // Apply player's penetration to an enemy defense value
    function applyPlayerPen(def, dmgId, fm) {
      let d = def;
      if (globalPenPct > 0) d *= (1 - globalPenPct / 100);
      for (const e of penEntries) {
        if (e.percentPen && e.hooks.includes(dmgId)) d *= (1 - Math.min(e.statVal, 100) / 100);
      }
      if (fm === 'CUSTOM') {
        let flat = 0;
        for (const e of penEntries) { if (!e.percentPen && e.hooks.includes(dmgId)) flat += e.statVal; }
        if (flat > 0) d = Math.max(0, d - flat);
      }
      return d;
    }

    // Effective dodge after accuracy negation; block expected damage multiplier
    const effDodge      = Math.max(0, dodgeRate - accuracyPct);
    const dodgeMult     = 1 - effDodge / 100;
    const blockMult     = 1 - (blockRate / 100) * (blockDmgPct / 100);
    const showLifesteal = vampPct > 0;
    const showExpected  = effDodge > 0 || blockRate > 0;

    // Helper
    function blockingDefTypes(dmgId) {
      return Object.entries(defTypeCfg)
        .filter(([, cfg]) => Array.isArray(cfg['block-damage-types']) && cfg['block-damage-types'].includes(dmgId))
        .sort(([, a], [, b]) => (+(b.priority ?? 0)) - (+(a.priority ?? 0)));
    }

    // --- PvE/PvP toggle ---
    const enemyToggle = `
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:10px">
        <span class="muted small" style="font-weight:600">Enemy type:</span>
        ${['mob','player'].map(t => `<button onclick="APP.combatSetEnemyType('${t}')"
          style="padding:3px 12px;font-size:12px;cursor:pointer;border-radius:4px;
                 border:1px solid ${enemyType===t?'#4a8a4a':'#444'};
                 background:${enemyType===t?'#1e3a1e':'#1a1a1a'};
                 color:${enemyType===t?'#8fea8f':'#888'}">${t==='mob'?'🐛 Mob (PvE)':'⚔️ Player (PvP)'}</button>`).join('')}
        ${Math.abs(dmgModAtk - 1) > 0.001 ? `<span class="muted small">Dmg mod: ×${fmtN(dmgModAtk)}</span>` : ''}
        ${critRate > 0 ? `<span class="muted small">Crit: ${fmtN(critRate)}% @ ${fmtN(critDmg)}× → avg ×${fmtN(critMod)}</span>` : ''}
      </div>`;

    // --- Attacker modifier badges ---
    const penBadges = penEntries.map(e =>
      `<span class="badge" style="background:#1a1a3a;font-size:10px" title="hooks: ${esc(e.hooks.join(','))}">pen:${esc(e.id)} ${fmtN(e.statVal)}${e.percentPen?'%':' flat'}</span>`
    ).join('');
    const modBadges = [
      globalPenPct > 0 ? `<span class="badge" style="background:#2a1a2a;font-size:10px">Global pen: ${fmtN(globalPenPct)}%</span>` : '',
      vampPct > 0      ? `<span class="badge" style="background:#2a1a1a;font-size:10px">Vampirism: ${fmtN(vampPct)}%</span>` : '',
      penBadges,
    ].filter(Boolean).join('');

    // --- Enemy defense inputs ---
    const relevantDefTypeIds = new Set();
    for (const [dmgId] of dmgEntryPos) {
      for (const [defId] of blockingDefTypes(dmgId)) relevantDefTypeIds.add(defId);
    }
    const enemyInputsHtml = relevantDefTypeIds.size ? `
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 10px;
                  background:#111;border-radius:6px;margin-bottom:10px;font-size:12px">
        <span style="color:#888;font-weight:600">Enemy defense:</span>
        ${[...relevantDefTypeIds].map(defId => `
          <label style="display:flex;align-items:center;gap:4px;color:#8af">
            ${esc(defId)}:
            <input class="edit-input edit-input--num" type="number" min="0" step="1"
              value="${enemyDefs[defId] ?? 0}" style="width:72px;padding:2px 4px;font-size:11px"
              onchange="APP.combatSetEnemyDef('${escJs(defId)}',this.value)">
          </label>`).join('')}
      </div>` : '';

    // --- Build attacker rows ---
    let atkRows = '';
    let totalRawDmg = 0, totalEffDmg = 0, totalDmgOut = 0;
    const unresistedIds = [];

    for (const [dmgId, rawAvgDmg] of dmgEntryPos) {
      const blockingAll = blockingDefTypes(dmgId);
      if (!defCfgLoaded || !blockingAll.length) { unresistedIds.push(dmgId); continue; }

      // Apply full attack pipeline
      const dmgBuffPct = getMS('damagebuff_' + dmgId);
      let effDmg = rawAvgDmg * dmgModAtk * critMod;
      if (dmgBuffPct !== 0) effDmg *= (1 + dmgBuffPct / 100);

      let dmgOut, detailHtml;
      const penApplied = globalPenPct > 0 || penEntries.some(e => e.hooks.includes(dmgId));

      if (mode === 'FACTOR') {
        const [defId, defCfg] = blockingAll[0];
        const rawEnemyDef = enemyDefs[defId] ?? 0;
        const penEnemyDef = applyPlayerPen(rawEnemyDef, dmgId, 'FACTOR');
        const protFactor  = +(defCfg['protection-factor'] ?? 1.0);
        dmgOut = evalForMode('FACTOR', '', { damage: effDmg, defense: penEnemyDef, toughness, protectionFactor: protFactor });
        detailHtml = `<span style="color:#8af">${esc(defId)}</span>
          <span class="muted" style="font-size:10px;margin-left:3px">
            def<span style="color:#adf">${fmtN(rawEnemyDef)}</span>
            ${penApplied ? `→<span style="color:#fa4">${fmtN(penEnemyDef)}</span>` : ''}
            · PF<span style="color:#666">${protFactor.toFixed(2)}</span>
          </span>`;
      } else if (mode === 'CUSTOM') {
        let combinedDef = 0;
        const parts = [];
        for (const [defId] of blockingAll) {
          const val = enemyDefs[defId] ?? 0;
          combinedDef += val;
          parts.push(`<span style="color:#8af">${esc(defId)}</span>:<span style="color:#adf">${fmtN(val)}</span>`);
        }
        const rawCombined = combinedDef;
        combinedDef = applyPlayerPen(combinedDef, dmgId, 'CUSTOM');
        dmgOut = evalForMode('CUSTOM', customExpr, { damage: effDmg, defense: combinedDef, toughness }) ?? 0;
        detailHtml = parts.join('<span class="muted">+</span>')
          + `<span class="muted" style="font-size:10px;margin-left:3px">
              =${fmtN(rawCombined)}${penApplied ? `→<span style="color:#fa4">${fmtN(combinedDef)}</span>` : ''}
             </span>`;
      } else {
        // LEGACY — highest-priority defense only, damage*(1-def*PF*0.01)
        const [defId, defCfg] = blockingAll[0];
        const rawEnemyDef = enemyDefs[defId] ?? 0;
        const penEnemyDef = applyPlayerPen(rawEnemyDef, dmgId, 'LEGACY');
        const protFactor  = +(defCfg['protection-factor'] ?? 1.0);
        dmgOut = evalForMode('LEGACY', '', { damage: effDmg, defense: penEnemyDef, protectionFactor: protFactor });
        detailHtml = `<span style="color:#8af">${esc(defId)}</span>
          <span class="muted" style="font-size:10px;margin-left:3px">
            def<span style="color:#adf">${fmtN(rawEnemyDef)}</span>
            ${penApplied ? `→<span style="color:#fa4">${fmtN(penEnemyDef)}</span>` : ''}
            · PF<span style="color:#666">${protFactor.toFixed(2)}</span>
          </span>`;
      }

      const pctRed = effDmg > 0 ? (1 - dmgOut / effDmg) * 100 : 0;
      const clr    = pctRed >= 50 ? '#af8' : pctRed >= 25 ? '#fa8' : '#f88';
      const mods   = [];
      if (Math.abs(dmgModAtk - 1) > 0.001)  mods.push(`${enemyIsMob?'PvE':'PvP'}×${fmtN(dmgModAtk)}`);
      if (Math.abs(critMod - 1) > 0.001)    mods.push(`crit×${fmtN(critMod)}`);
      if (Math.abs(dmgBuffPct) > 0.001)      mods.push(`buff${dmgBuffPct>=0?'+':''}${fmtN(dmgBuffPct)}%`);
      const modStr  = mods.length ? `<span class="muted" style="font-size:10px"> (${mods.join(' ')})</span>` : '';
      const lifeCol = showLifesteal ? `<td style="padding:3px 8px;text-align:right;color:#f84">${fmtN(dmgOut * vampPct / 100)}</td>` : '';

      totalRawDmg += rawAvgDmg;
      totalEffDmg += effDmg;
      totalDmgOut += dmgOut;

      atkRows += `<tr>
        <td style="padding:3px 8px;font-weight:600;color:#f8c">${esc(dmgId)}</td>
        <td style="padding:3px 8px;text-align:right;color:#f88">${fmtN(rawAvgDmg)}</td>
        <td style="padding:3px 8px;text-align:right;color:#fca">${fmtN(effDmg)}${modStr}</td>
        <td style="padding:3px 8px;font-size:11px">${detailHtml}</td>
        <td style="padding:3px 8px;text-align:right;color:#f88">${dmgOut.toFixed(2)}</td>
        <td style="padding:3px 8px;text-align:right;color:${clr};font-weight:700">${pctRed.toFixed(1)}%</td>
        ${lifeCol}
      </tr>`;
    }

    if (atkRows) {
      const totalPct = totalEffDmg > 0 ? (1 - totalDmgOut / totalEffDmg) * 100 : 0;
      const totalClr = totalPct >= 50 ? '#af8' : totalPct >= 25 ? '#fa8' : '#f88';
      const lifeTot  = showLifesteal ? `<td style="padding:4px 8px;text-align:right;font-weight:700;color:#f84">${fmtN(totalDmgOut * vampPct / 100)}</td>` : '';
      atkRows += `<tr style="border-top:2px solid #333;background:#1a1a1a;font-weight:700">
        <td colspan="2" style="padding:4px 8px;color:#aaa">Total</td>
        <td style="padding:4px 8px;text-align:right;color:#fca">${fmtN(totalEffDmg)}</td>
        <td style="padding:4px 8px"></td>
        <td style="padding:4px 8px;text-align:right;color:#f88">${totalDmgOut.toFixed(2)}</td>
        <td style="padding:4px 8px;text-align:right;color:${totalClr}">${totalPct.toFixed(1)}%</td>
        ${lifeTot}
      </tr>`;
    }

    const unresistedWarn = unresistedIds.length
      ? `<div style="margin-top:8px;padding:6px 10px;background:#2a1a0a;border-radius:5px;font-size:11px;color:#fa8">
           ⚠️ Passes unresisted (no defense blocks): <b>${unresistedIds.map(esc).join(', ')}</b>
         </div>` : '';

    const atkLifeHead = showLifesteal ? `<th style="text-align:right;padding:2px 8px">Lifesteal</th>` : '';
    const atkNote = mode === 'FACTOR'
      ? `<span class="muted small">FACTOR: highest-priority defense · player pen applied (% and global) · PF from defense config</span>`
      : mode === 'LEGACY'
      ? `<span class="muted small">LEGACY: highest-priority defense only · player pen applied · damage×(1−def×PF×0.01)</span>`
      : `<span class="muted small">CUSTOM: all blocking defenses summed · player pen (% + flat) applied · formula: <code>${esc(customExpr || 'damage*(25/(25+defense))')}</code></span>`;

    const attackSectionHtml = `
      <div style="font-size:13px;font-weight:700;color:#f88;margin-bottom:6px">⚔️ Your Damage vs Enemy</div>
      ${atkNote}
      ${modBadges ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${modBadges}</div>` : ''}
      ${!defCfgLoaded ? `<p class="muted small" style="color:#fa8;margin-top:6px">⚠️ Load Defense Types section to enable combat calculations.</p>` : `
      ${enemyToggle}
      ${enemyInputsHtml}
      ${atkRows ? `<table style="font-size:12px;width:100%;border-collapse:collapse">
        <thead><tr style="color:#555;font-size:10px;border-bottom:1px solid #333;background:#111">
          <th style="text-align:left;padding:2px 8px">Dmg Type</th>
          <th style="text-align:right;padding:2px 8px">Raw Avg</th>
          <th style="text-align:right;padding:2px 8px">Eff. Avg</th>
          <th style="text-align:left;padding:2px 8px">${mode==='FACTOR'?'Enemy Defense':'Enemy Defenses (summed)'}</th>
          <th style="text-align:right;padding:2px 8px">Dmg Out</th>
          <th style="text-align:right;padding:2px 8px">% Red.</th>
          ${atkLifeHead}
        </tr></thead>
        <tbody>${atkRows}</tbody>
      </table>` : `<p class="muted small">No damage types on equipped items.</p>`}
      ${unresistedWarn}`}`;

    // =========================================================================
    // SECTION 2 — DEFENDER SIMULATION
    // =========================================================================

    const dodgeBlockNote = (showExpected || effDodge > 0 || blockRate > 0) ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;font-size:11px">
        ${effDodge > 0 ? `<span class="badge" style="background:#1e2a3a">Dodge: ${fmtN(effDodge)}%${accuracyPct > 0 ? ` (base ${fmtN(dodgeRate)}% − acc ${fmtN(accuracyPct)}%)` : ''}</span>` : ''}
        ${blockRate > 0 ? `<span class="badge" style="background:#1a2a1e">Block: ${fmtN(blockRate)}% @ −${fmtN(blockDmgPct)}% dmg</span>` : ''}
        ${showExpected ? `<span class="badge" style="background:#2a2a1e">Expected mult: ×${fmtN(dodgeMult * blockMult)}</span>` : ''}
      </div>` : '';

    const atkDmgInput = `
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px;font-size:12px">
        <span style="color:#888;font-weight:600">Attacker DMG:</span>
        <input class="edit-input edit-input--num" type="number" min="0" step="1"
          value="${combatAtkDmg}" style="width:80px;padding:2px 6px"
          onchange="APP.combatSetAtkDmg(this.value)">
        <span style="color:#888;font-weight:600;margin-left:8px">Enemy pen %:</span>
        <input class="edit-input edit-input--num" type="number" min="0" max="100" step="1"
          value="${enemyGlobalPen}" style="width:60px;padding:2px 6px"
          onchange="APP.combatSetEnemyPen(this.value)">
        <span class="muted small">reduces your effective defense.</span>
      </div>`;

    const allBlockedDmgTypes = new Set();
    for (const [, cfg] of Object.entries(defTypeCfg)) {
      for (const dt of (cfg['block-damage-types'] ?? [])) allBlockedDmgTypes.add(dt);
    }

    let defRows = '';

    if (mode === 'CUSTOM') {
      for (const dmgType of [...allBlockedDmgTypes].sort()) {
        let combinedDef = 0;
        const parts = [];
        for (const [defId, rawVal] of defEntryPos2) {
          const cfg = defTypeCfg[defId] ?? {};
          if ((cfg['block-damage-types'] ?? []).includes(dmgType)) {
            combinedDef += rawVal * pveDefMod;
            parts.push(`<span style="color:#8af">${esc(defId)}</span><span class="muted">(${fmtN(rawVal)})</span>`);
          }
        }
        if (!parts.length) continue;
        if (enemyGlobalPen > 0) combinedDef *= (1 - enemyGlobalPen / 100);
        const defBuffPct = getMS('defensebuff_' + dmgType);
        if (defBuffPct !== 0) combinedDef *= (1 + defBuffPct / 100);

        const dmgOut      = evalForMode('CUSTOM', customExpr, { damage: combatAtkDmg, defense: combinedDef, toughness }) ?? 0;
        const pctRed      = combatAtkDmg > 0 ? (1 - dmgOut / combatAtkDmg) * 100 : 0;
        const expectedDmg = dmgOut * dodgeMult * blockMult;
        const clr         = pctRed >= 50 ? '#af8' : pctRed >= 25 ? '#fa8' : '#f88';
        const expCol      = showExpected ? `<td style="padding:2px 8px;text-align:right;color:#fa8">${expectedDmg.toFixed(2)}</td>` : '';

        defRows += `<tr>
          <td style="padding:2px 8px;color:#f8c;font-weight:600">${esc(dmgType)}</td>
          <td style="padding:2px 8px;font-size:11px">${parts.join('<span class="muted">+</span>')}</td>
          <td style="padding:2px 8px;text-align:right;color:#adf">${fmtN(combinedDef)}</td>
          <td style="padding:2px 8px;text-align:right;color:#f88">${dmgOut.toFixed(2)}</td>
          <td style="padding:2px 8px;text-align:right;color:${clr};font-weight:700">${pctRed.toFixed(1)}%</td>
          ${expCol}
        </tr>`;
      }
    } else if (mode === 'LEGACY') {
      // LEGACY — highest-priority defense only, damage*(1-def*PF*0.01), keyed on defId for buff
      for (const dmgType of [...allBlockedDmgTypes].sort()) {
        const candidates = blockingDefTypes(dmgType);
        let chosen = null;
        for (const [defId, defCfgEntry] of candidates) {
          const found = defEntryPos2.find(([d]) => d === defId);
          if (found) { chosen = { defId, defCfgEntry, rawVal: found[1] }; break; }
        }
        if (!chosen) continue;

        const { defId, defCfgEntry, rawVal } = chosen;
        const protFactor = +(defCfgEntry['protection-factor'] ?? 1.0);
        const defBuffPct = getMS('defensebuff_' + defId);
        let effDef = rawVal * pveDefMod * (1 + defBuffPct / 100);
        if (enemyGlobalPen > 0) effDef *= (1 - enemyGlobalPen / 100);

        const dmgOut      = evalForMode('LEGACY', '', { damage: combatAtkDmg, defense: effDef, protectionFactor: protFactor });
        const pctRed      = combatAtkDmg > 0 ? (1 - dmgOut / combatAtkDmg) * 100 : 0;
        const expectedDmg = dmgOut * dodgeMult * blockMult;
        const clr         = pctRed >= 50 ? '#af8' : pctRed >= 25 ? '#fa8' : '#f88';
        const pfClr       = protFactor < 1 ? '#fa8' : '#666';
        const expCol      = showExpected ? `<td style="padding:2px 8px;text-align:right;color:#fa8">${expectedDmg.toFixed(2)}</td>` : '';

        defRows += `<tr>
          <td style="padding:2px 8px;color:#f8c;font-weight:600">${esc(dmgType)}</td>
          <td style="padding:2px 8px;color:#8af">${esc(defId)}</td>
          <td style="padding:2px 8px;text-align:right;color:#8af">${fmtN(rawVal)}</td>
          <td style="padding:2px 8px;text-align:right;color:#adf">${fmtN(effDef)}</td>
          <td style="padding:2px 8px;text-align:right;color:${pfClr}">${protFactor.toFixed(2)}</td>
          <td style="padding:2px 8px;text-align:right;color:#f88">${dmgOut.toFixed(2)}</td>
          <td style="padding:2px 8px;text-align:right;color:${clr};font-weight:700">${pctRed.toFixed(1)}%</td>
          ${expCol}
        </tr>`;
      }
    } else {
      for (const dmgType of [...allBlockedDmgTypes].sort()) {
        const candidates = blockingDefTypes(dmgType);
        let chosen = null;
        for (const [defId, defCfgEntry] of candidates) {
          const found = defEntryPos2.find(([d]) => d === defId);
          if (found) { chosen = { defId, defCfgEntry, rawVal: found[1] }; break; }
        }
        if (!chosen) continue;

        const { defId, defCfgEntry, rawVal } = chosen;
        const protFactor  = +(defCfgEntry['protection-factor'] ?? 1.0);
        const defBuffPct  = getMS('defensebuff_' + defId);  // FACTOR: keyed on defense type ID
        let effDef = rawVal * pveDefMod * (1 + defBuffPct / 100);
        // Apply enemy penetration
        if (enemyGlobalPen > 0) effDef *= (1 - enemyGlobalPen / 100);

        const dmgOut      = evalForMode('FACTOR', '', { damage: combatAtkDmg, defense: effDef, toughness, protectionFactor: protFactor });
        const pctRed      = combatAtkDmg > 0 ? (1 - dmgOut / combatAtkDmg) * 100 : 0;
        const expectedDmg = dmgOut * dodgeMult * blockMult;
        const clr         = pctRed >= 50 ? '#af8' : pctRed >= 25 ? '#fa8' : '#f88';
        const pfClr       = protFactor < 1 ? '#fa8' : '#666';
        const expCol      = showExpected ? `<td style="padding:2px 8px;text-align:right;color:#fa8">${expectedDmg.toFixed(2)}</td>` : '';

        defRows += `<tr>
          <td style="padding:2px 8px;color:#f8c;font-weight:600">${esc(dmgType)}</td>
          <td style="padding:2px 8px;color:#8af">${esc(defId)}</td>
          <td style="padding:2px 8px;text-align:right;color:#8af">${fmtN(rawVal)}</td>
          <td style="padding:2px 8px;text-align:right;color:#adf">${fmtN(effDef)}</td>
          <td style="padding:2px 8px;text-align:right;color:${pfClr}">${protFactor.toFixed(2)}</td>
          <td style="padding:2px 8px;text-align:right;color:#f88">${dmgOut.toFixed(2)}</td>
          <td style="padding:2px 8px;text-align:right;color:${clr};font-weight:700">${pctRed.toFixed(1)}%</td>
          ${expCol}
        </tr>`;
      }
    }

    const defExpHead  = showExpected ? `<th style="text-align:right;padding:2px 8px">Expected (dodge+blk)</th>` : '';
    const defNote = mode === 'CUSTOM'
      ? `<span class="muted small">CUSTOM: all blocking defenses summed · pveDefMod · enemy pen · defBuff on dmg-type-ID · formula</span>`
      : mode === 'LEGACY'
      ? `<span class="muted small">LEGACY: highest-priority defense · pveDefMod · enemy pen · defBuff on def-type-ID · damage×(1−def×PF×0.01)</span>`
      : `<span class="muted small">FACTOR: highest-priority defense · pveDefMod · enemy pen · defBuff on def-type-ID · Minecraft armor formula</span>`;

    const defUseFactor = mode === 'FACTOR' || mode === 'LEGACY';
    const defHeader = !defUseFactor ? `
      <th style="text-align:left;padding:2px 8px">Incoming Dmg</th>
      <th style="text-align:left;padding:2px 8px">Your Defenses</th>
      <th style="text-align:right;padding:2px 8px">Eff. Def</th>
      <th style="text-align:right;padding:2px 8px">Dmg Out</th>
      <th style="text-align:right;padding:2px 8px">% Red.</th>
      ${defExpHead}` : `
      <th style="text-align:left;padding:2px 8px">Incoming Dmg</th>
      <th style="text-align:left;padding:2px 8px">Highest-Prio Def</th>
      <th style="text-align:right;padding:2px 8px">Raw Def</th>
      <th style="text-align:right;padding:2px 8px">Eff. Def</th>
      <th style="text-align:right;padding:2px 8px">P.F</th>
      <th style="text-align:right;padding:2px 8px">Dmg Out</th>
      <th style="text-align:right;padding:2px 8px">% Red.</th>
      ${defExpHead}`;
    const defColspan = (!defUseFactor ? 5 : 7) + (showExpected ? 1 : 0);

    const defSectionHtml = defEntryPos2.length ? `
      <div style="font-size:13px;font-weight:700;color:#8af;margin:18px 0 4px">🛡️ Your Defense vs Attacker</div>
      ${defNote}
      ${dodgeBlockNote}
      ${atkDmgInput}
      <table style="font-size:12px;width:100%;border-collapse:collapse">
        <thead><tr style="color:#555;font-size:10px;border-bottom:1px solid #333;background:#111">
          ${defHeader}
        </tr></thead>
        <tbody>${defRows || `<tr><td colspan="${defColspan}" class="muted small" style="padding:6px 8px">No defense in build blocks any configured damage type.</td></tr>`}</tbody>
      </table>` : '';

    const combatModeInfo = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <span class="badge badge-blue" style="font-size:13px">Formula: ${esc(mode)}</span>
        ${mode === 'CUSTOM' && customExpr ? `<code style="font-size:11px;color:#8af;background:#111;padding:2px 6px;border-radius:3px">${esc(customExpr)}</code>` : ''}
        ${pveDefMod > 1 ? `<span class="badge" style="background:#1a3a2a">PvE/PvP Def ×${pveDefMod.toFixed(3)}</span>` : ''}
        ${toughness > 0 ? `<span class="badge" style="background:#2a2a1a">Toughness: ${fmtN(toughness)}</span>` : ''}
        <span class="muted small">Averages only — actual damage rolls vary.</span>
      </div>`;

    return `
      ${noIgWarn}
      ${tabButtons}
      <div style="max-width:960px">
        ${combatModeInfo}
        ${attackSectionHtml}
        ${defSectionHtml}
      </div>`;
  }

  // =========================================================================
  // BUILDER TAB (default)
  // =========================================================================

  const bCritRate    = Math.min(getMS('critical_rate'),   capCritRate);
  const bCritDmg     = Math.max(1, capCritDmg   != null ? Math.min(getMS('critical_damage'), capCritDmg)   : getMS('critical_damage'));
  const bPveDmg      = capPveDmg    != null ? Math.min(getMS('pve_damage'),    capPveDmg)    : getMS('pve_damage');
  const bPvpDmg      = capPvpDmg    != null ? Math.min(getMS('pvp_damage'),    capPvpDmg)    : getMS('pvp_damage');
  const bDodge       = Math.min(getMS('dodge_rate'),    capDodge);
  const bBlock       = Math.min(getMS('block_rate'),    capBlock);
  const bBlockDmg    = capBlockDmg  != null ? Math.min(getMS('block_damage'),  capBlockDmg)  : getMS('block_damage');
  const bVamp        = Math.min(getMS('vampirism'),     capVamp);
  const bGlobalPen   = Math.min(getMS('penetration'),   capGlobalPen);
  const bAccuracy    = Math.min(getMS('accuracy_rate'), capAccuracy);

  function csRow(label, value, unit, cap) {
    const capBadge = cap != null
      ? `<span class="muted" style="font-size:10px;margin-left:4px">/ ${cap}${unit} cap</span>`
      : '';
    const color = cap != null && value >= cap * 0.9 ? '#fa8' : '#ccc';
    return `<tr>
      <td style="padding:2px 6px;color:#999">${label}</td>
      <td style="padding:2px 6px;text-align:right;color:${color};font-weight:600">${fmtN(value)}${unit}${capBadge}</td>
    </tr>`;
  }

  const critMod = bCritRate > 0 && bCritDmg > 1
    ? 1 + (bCritRate / 100) * (bCritDmg - 1) : 1;
  const effDodgeB  = Math.max(0, bDodge - bAccuracy);
  const expectedMult = (1 - effDodgeB / 100) * (1 - (bBlock / 100) * (bBlockDmg / 100));

  const gsWarn = !STATE.loaded?.general
    ? `<tr><td colspan="2" style="padding:2px 6px;font-size:10px;color:#fa8">⚠️ Load General Stats for caps</td></tr>`
    : '';

  const combatStatRows = [
    gsWarn,
    csRow('Critical Rate',   bCritRate,  '%', capCritRate),
    csRow('Critical Damage', bCritDmg,   '×', capCritDmg),
    `<tr><td colspan="2" style="padding:2px 6px;font-size:10px;color:#666">
      Avg crit mult: <b style="color:#fa8">×${fmtN(critMod)}</b>
      <span class="muted">(${fmtN(bCritRate)}% chance × ×${fmtN(bCritDmg)})</span>
    </td></tr>`,
    `<tr><td colspan="2" style="padding:3px 6px 0;font-size:10px;color:#777;border-top:1px solid #2a2a2a">Outgoing</td></tr>`,
    csRow('PvE Damage',      bPveDmg,    '%', capPveDmg),
    csRow('PvP Damage',      bPvpDmg,    '%', capPvpDmg),
    csRow('Global Pen',      bGlobalPen, '%', capGlobalPen),
    // Per-type penetration from penetration.yml
    ...(() => {
      const penCfgB = STATE.loaded?.penetration ?? {};
      const rows = [];
      for (const [id, cfg] of Object.entries(penCfgB)) {
        if (!cfg || cfg.enabled === false) continue;
        const val = getMS('penetration_' + id);
        if (!val) continue;
        const isPct = cfg['percent-pen'] === true;
        const hooks = Array.isArray(cfg.hooks) ? cfg.hooks.join(', ') : '?';
        rows.push(`<tr>
          <td style="padding:2px 6px;color:#999;font-size:11px">
            ${esc(id)} <span class="muted" style="font-size:10px">${isPct ? '%pen' : 'flat'} → ${esc(hooks)}</span>
          </td>
          <td style="padding:2px 6px;text-align:right;color:#ccc;font-weight:600;font-size:11px">${fmtN(val)}${isPct ? '%' : ''}</td>
        </tr>`);
      }
      if (!rows.length && !STATE.loaded?.penetration) {
        rows.push(`<tr><td colspan="2" style="padding:2px 6px;font-size:10px;color:#555">Load penetration.yml for per-type pen</td></tr>`);
      }
      return rows;
    })(),
    `<tr><td colspan="2" style="padding:3px 6px 0;font-size:10px;color:#777;border-top:1px solid #2a2a2a">Survivability</td></tr>`,
    csRow('Dodge Rate',      bDodge,     '%', capDodge),
    csRow('Accuracy',        bAccuracy,  '%', capAccuracy),
    bAccuracy > 0 ? `<tr><td colspan="2" style="padding:2px 6px;font-size:10px;color:#666">
      Eff. dodge vs this acc: <b style="color:#af8">${fmtN(effDodgeB)}%</b>
    </td></tr>` : '',
    csRow('Block Rate',      bBlock,     '%', capBlock),
    csRow('Block Damage',    bBlockDmg,  '%', capBlockDmg),
    `<tr><td colspan="2" style="padding:2px 6px;font-size:10px;color:#666">
      Expected dmg mult (dodge+blk): <b style="color:#af8">×${fmtN(expectedMult)}</b>
    </td></tr>`,
    csRow('Vampirism',       bVamp,      '%', capVamp),
  ].filter(Boolean).join('');

  return `
    ${noIgWarn}
    ${tabButtons}

    <div class="build-layout">

      <!-- LEFT: slots -->
      <div class="build-left">
        <div class="build-section-title">🎒 Equipment</div>
        ${(() => {
          const saves = (() => { try { return JSON.parse(localStorage.getItem('div_build_saves') || '{}'); } catch(_) { return {}; } })();
          const saveNames = Object.keys(saves);
          const curName = BUILD_STATE.buildName || '';
          return `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">
            <input id="build-name-inp" class="edit-input" style="width:140px;font-size:12px" placeholder="Build name…"
              value="${esc(curName)}"
              onkeydown="if(event.key==='Enter'){APP.buildSetName(this.value);}">
            <button class="btn-add-entry" style="font-size:11px;padding:3px 8px"
              onclick="(function(){const n=document.getElementById('build-name-inp').value.trim();if(n){APP.buildSetName(n);APP.buildSaveLocal(n);}else alert('Enter a build name first.');})()">💾 Save</button>
            ${saveNames.length ? `<select class="edit-input" style="font-size:11px;width:160px"
              onchange="if(this.value==='__load__'+this.options[this.selectedIndex].dataset.n)APP.buildLoadLocal(this.options[this.selectedIndex].dataset.n);this.value=''">
              <option value="">📂 Load saved…</option>
              ${saveNames.map(n => `<option value="__load__${esc(n)}" data-n="${esc(n)}">${esc(n)}</option>`).join('')}
            </select>
            <select class="edit-input" style="font-size:11px;width:140px"
              onchange="if(this.value&&confirm('Delete save \\''+this.value+'\\' ?'))APP.buildDeleteLocal(this.value);this.value=''">
              <option value="">🗑 Delete save…</option>
              ${saveNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
            </select>` : ''}
            <button class="btn-icon btn-del" style="font-size:11px;padding:3px 8px"
              title="Clear all slots"
              onclick="if(confirm('Clear entire build?'))APP.buildClearAll()">🗑 Clear</button>
          </div>`;
        })()}
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <span class="muted small">Player level:</span>
          <input class="edit-input edit-input--num" type="number" min="1" max="200"
            value="${BUILD_STATE.playerLevel}" style="width:60px"
            onchange="APP.buildSetPlayerLevel(this.value)">
          <button class="btn-add-entry" style="font-size:11px;padding:2px 8px"
            title="Set this level on all equipment slots"
            onclick="APP.buildSetAllLevels(document.querySelector('[onchange*=buildSetPlayerLevel]').value)">→ all slots</button>
          <span class="muted small" style="margin-left:6px">❤ Base HP:</span>
          <input class="edit-input edit-input--num" type="number" min="0" step="0.5"
            value="${BUILD_STATE.baseHp}" style="width:60px"
            placeholder="20"
            onchange="APP.buildSetBaseHp(this.value)">
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <span class="muted small">🔮 Base Mana:</span>
          <input class="edit-input edit-input--num" type="number" min="0" step="1"
            value="${BUILD_STATE.baseMana}" style="width:60px"
            placeholder="0"
            onchange="APP.buildSetBaseMana(this.value)">
          <span class="muted small" style="margin-left:6px">⚡ Mana Regen/s:</span>
          <input class="edit-input edit-input--num" type="number" min="0" step="0.01"
            value="${BUILD_STATE.baseManaRegen}" style="width:60px"
            placeholder="0"
            onchange="APP.buildSetBaseManaRegen(this.value)">
          <span class="muted small">(item level controls stat scaling)</span>
        </div>
        ${gemFiles.length ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap;font-size:12px">
          <span class="muted small">💎 Fill all gem slots:</span>
          <select id="build-fill-gem-sel" class="edit-input" style="font-size:11px;width:160px">
            <option value="">— pick gem —</option>
            ${gemFiles.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}
          </select>
          <input id="build-fill-gem-lv" class="edit-input edit-input--num" type="number" min="1" value="1" style="width:42px;font-size:11px" placeholder="lv">
          <button class="btn-add-entry" style="font-size:11px;padding:2px 8px"
            onclick="(function(){const g=document.getElementById('build-fill-gem-sel').value;const l=document.getElementById('build-fill-gem-lv').value;if(g)APP.buildFillAllGems(g,l);})()">Apply</button>
        </div>` : ''}
        ${slotsHtml}
      </div>

      <!-- RIGHT: summary -->
      <div class="build-right">
        <div class="build-section-title">📊 Build Summary</div>

        <!-- HP Summary -->
        <div class="build-card" style="margin-bottom:6px">
          <div class="build-card__title" style="color:#f66">❤ Health Summary</div>
          <table style="width:100%;font-size:12px"><tbody>${hpRows}</tbody></table>
        </div>

        <!-- Mana Summary -->
        <div class="build-card" style="margin-bottom:10px">
          <div class="build-card__title" style="color:#88f">🔮 Mana Summary</div>
          <table style="width:100%;font-size:12px"><tbody>${manaRows}</tbody></table>
          <div style="font-size:11px;color:#777;margin:4px 0 2px;padding:0 4px">Regen / second:</div>
          <table style="width:100%;font-size:12px"><tbody>${manaRegenRows}</tbody></table>
        </div>

        <div class="build-stats-grid">
          <div class="build-card">
            <div class="build-card__title" style="color:#f88">⚔️ Damage Types <span class="muted small" style="font-weight:400">avg (min–max)</span></div>
            <table style="width:100%;font-size:12px"><tbody>${rangeTable(totalDmg,totalDmgMin,totalDmgMax,'#f88')}</tbody></table>
          </div>
          <div class="build-card">
            <div class="build-card__title" style="color:#8af">🛡️ Defense Types <span class="muted small" style="font-weight:400">avg (min–max)</span></div>
            <table style="width:100%;font-size:12px"><tbody>${rangeTable(totalDef,totalDefMin,totalDefMax,'#8af')}</tbody></table>
          </div>

          <!-- Fabled Attributes — per-attr stat breakdown + manual override -->
          <div class="build-card">
            <div class="build-card__title" style="color:#e8c040">⭐ Fabled Attributes
              <span class="muted small" style="font-weight:400;margin-left:6px">override = manual pts</span>
            </div>
            <table style="width:100%;font-size:12px"><tbody>${faBreakdownRows}</tbody></table>
            ${Object.keys(totalFabledAttrs).length ? `
            <div style="margin-top:6px;border-top:1px solid #2a2a2a;padding-top:6px;font-size:11px;color:#777">Manual overrides:</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
              ${Object.keys(totalFabledAttrs).map(attr => {
                const ov = BUILD_STATE.faOverrides?.[attr];
                const fromItems = (totalFabledAttrs[attr] || 0);
                return `<label style="display:flex;align-items:center;gap:3px;font-size:11px;color:#aaa">
                  <span style="color:#da8">[${esc(attr)}]</span>
                  <input class="edit-input edit-input--num" type="number" min="0" step="1"
                    style="width:52px;font-size:11px;${ov != null ? 'border-color:#da8' : ''}"
                    placeholder="${fmtN(fromItems)}"
                    value="${ov != null ? ov : ''}"
                    oninput="APP.buildSetFaOverride('${escJs(attr)}',this.value)"
                    title="Leave blank to use item value (${fmtN(fromItems)} pts)">
                </label>`;
              }).join('')}
            </div>` : ''}
          </div>

          <!-- Item Stats merged with FA contributions -->
          <div class="build-card">
            <div class="build-card__title" style="color:#af8">📈 Item Stats
              <span class="muted small" style="font-weight:400;margin-left:6px">gold = includes FA</span>
            </div>
            <table style="width:100%;font-size:12px"><tbody>${mergedStatRows}</tbody></table>
          </div>

          <!-- Combat Stats summary -->
          <div class="build-card">
            <div class="build-card__title" style="color:#f8a">⚔️ Combat Stats</div>
            <table style="width:100%;font-size:12px"><tbody>${combatStatRows}</tbody></table>
          </div>

          <div class="build-card">
            <div class="build-card__title" style="color:#fa8">✨ Skills</div>
            <table style="width:100%;font-size:12px"><tbody>${statTable(skillEntries.map(([k,v])=>[k,`Lv ${v}`]),'#fa8')}</tbody></table>
          </div>
        </div>

        <div class="build-card" style="margin-top:8px">
          <div class="build-card__title" style="color:#ffd">👑 Active Sets</div>
          ${setsHtml}
        </div>
      </div>

    </div>`;
}

// ---------------------------------------------------------------------------
// Fabled Attributes (attributes.yml) — read-only display
// ---------------------------------------------------------------------------

function renderFabledAttributes(data, sid) {
  if (!data || typeof data !== 'object') return '<div class="empty-state">No data.</div>';

  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');

  const cards = entries.map(([key, attr]) => {
    const loreArr       = Array.isArray(attr.lore) ? attr.lore : [];
    const lorePreviewId = `fa-lp-${sid}-${key.replace(/[^a-z0-9]/gi,'_')}`;
    const stats         = (attr.stats && typeof attr.stats === 'object' && !Array.isArray(attr.stats)) ? attr.stats : {};

    return `
      <div class="item-card" style="min-width:340px;max-width:520px">
        <details class="card-details" data-key="${esc(sid)}-fa-${esc(key)}" open>
          <summary class="item-card__header">
            <span class="item-card__icon">⭐</span>
            <input class="edit-input edit-id" value="${esc(key)}" title="${T('Attribute key')}"
              onblur="if(this.value.trim()&&this.value.trim()!=='${escJs(key)}')APP.renameEntry('${sid}','${escJs(key)}',this.value.trim())"
              onkeydown="if(event.key==='Enter')this.blur()">
            <span class="muted small" style="font-size:11px">${T('display')}:</span>
            <input class="edit-input" style="width:90px;font-size:11px" value="${esc(attr.display ?? key)}"
              placeholder="${T('Display name')}"
              onblur="APP.updateField('${sid}','${escJs(key+'.display')}',this.value)">
            <span class="muted small" style="font-size:11px">${T('max')}:</span>
            <input class="edit-input edit-input--num" style="width:55px;font-size:11px" type="number"
              value="${esc(attr.max ?? 100)}"
              oninput="APP.updateField('${sid}','${escJs(key+'.max')}',+this.value)">
            <button class="btn-icon btn-del" style="margin-left:auto"
              onclick="if(confirm('${T('Remove attribute')} \\'${escJs(key)}\\'?'))APP.removeEntry('${sid}','${escJs(key)}')">🗑</button>
          </summary>
          <div class="item-card__body">
            ${cardRow(T('Lore (icon-lore)'), lineArrayFieldWithPreview(sid, `${key}.lore`, loreArr, lorePreviewId))}
            <div id="${lorePreviewId}" class="lore-preview" style="margin-bottom:8px">
              ${loreArr.filter(Boolean).map(l => `<div>${mc.toHtml(l)}</div>`).join('')}
            </div>

            <div style="margin-top:10px">
              <div style="font-size:12px;font-weight:700;color:#bbb;margin-bottom:4px">📐 ${T('Stats')}
                <span class="muted small" style="font-weight:normal;font-size:10px">${T('(a = attr level, v = current stat)')}</span>
              </div>
              <textarea class="obj-textarea" rows="${Math.max(2, Object.keys(stats).length + 1)}"
                placeholder="${T('stat-id formula (one per line)')}"
                onblur="APP.faUpdateStats('${sid}','${escJs(key)}',this.value)"
              >${esc(Object.entries(stats).map(([k, v]) => `${k} ${v}`).join('\n'))}</textarea>
              <p class="muted small" style="margin-top:3px">${T('Format')}: <code>stat-id formula</code> &nbsp;|&nbsp; ${T('Variables')}: <code>a</code> = ${T('attribute level')}, <code>v</code> = ${T('current stat value')}</p>
            </div>
          </div>
        </details>
      </div>`;
  }).join('');

  const addRow = `
    <div style="display:flex;gap:6px;margin-top:12px;align-items:center;flex-wrap:wrap">
      <input id="fa-new-key-${sid}" class="edit-input" placeholder="${T('AttributeKey (e.g. Strength)')}" style="width:220px">
      <button class="btn-add-entry"
        onclick="(function(){const k=document.getElementById('fa-new-key-${sid}').value.trim();if(k){APP.addEntry('${sid}',k,{display:k,max:100,lore:[],stats:{}});document.getElementById('fa-new-key-${sid}').value=''}})()">+ ${T('Add attribute')}</button>
    </div>`;

  return `
    <div class="entry-actions">${collapseAllBtn()}</div>
    <div class="cards-grid">${cards || `<div class="empty-state">${T('No attributes yet.')}</div>`}</div>
    ${addRow}`;
}

// ---------------------------------------------------------------------------
// Skills (skills/*.yml) — read-only multiFile display
// ---------------------------------------------------------------------------

function renderSkills(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('skills-file-add-${sid}').click()">📂 ${T('Load skill files')}
    <input id="skills-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  const toolbar = `
    <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
      ${addBtn}
      <span class="muted small" style="align-self:center">${T('Drop skill .yml files here. Each file = one skill (read-only).')}</span>
    </div>`;

  if (!data._multiFile) return `${toolbar}<div class="empty-state">${T('Drop skill YAML files above.')}</div>`;

  const entries = Object.entries(data.files || {});
  if (!entries.length) return `${toolbar}<div class="empty-state">${T('No skill files loaded yet.')}</div>`;

  const cards = entries.map(([fname, fileData]) => {
    if (!fileData || typeof fileData !== 'object') return '';
    // Each skill file has one top-level key = the skill entry key
    const skillEntry = Object.values(fileData).find(v => v && typeof v === 'object');
    if (!skillEntry) return '';
    const name     = skillEntry.name ?? fname.replace(/\.ya?ml$/i, '');
    const maxLevel = skillEntry['max-level'] ?? '?';
    const loreHtml = (skillEntry['icon-lore'] ?? []).map(l =>
      `<div class="lore-line">${mc.toHtml(String(l))}</div>`).join('');

    return `
      <div class="item-card" style="min-width:180px;max-width:260px">
        <div class="item-card__header" style="cursor:default">
          <span class="item-card__icon">⚔</span>
          <span>${esc(name)}</span>
          <span class="badge">${T('max lvl')}: ${esc(maxLevel)}</span>
          <span class="muted small" style="margin-left:auto;font-size:10px">${esc(fname)}</span>
          <button class="btn-icon btn-del" title="${T('Remove')} ${esc(fname)}"
            onclick="if(confirm('${T('Remove skill file')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">🗑</button>
        </div>
        ${loreHtml ? `<div class="item-card__body"><div class="lore-preview">${loreHtml}</div></div>` : ''}
      </div>`;
  }).join('');

  return `
    ${toolbar}
    <div class="cards-grid" style="margin-top:10px">${cards}</div>`;
}

// ---------------------------------------------------------------------------
// Ammo types (ammo.yml) — read-only display
// ---------------------------------------------------------------------------

function renderAmmo(data, sid) {
  if (!data || typeof data !== 'object') return `<div class="empty-state">${T('No data.')}</div>`;
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');

  const cards = entries.map(([key, ammo]) => `
    <div class="item-card" style="min-width:260px;max-width:380px">
      <div class="item-card__header" style="cursor:default">
        <input class="edit-input edit-id" value="${esc(key)}" title="${T('Rename key')}"
          onblur="if(this.value.trim()&&this.value.trim()!=='${escJs(key)}')APP.renameEntry('${sid}','${escJs(key)}',this.value.trim())"
          onkeydown="if(event.key==='Enter')this.blur()">
        <span class="badge ${ammo.enabled !== false ? 'badge-green' : 'badge-red'}" style="flex-shrink:0">${ammo.enabled !== false ? T('on') : T('off')}</span>
        <button class="btn-icon btn-del" onclick="if(confirm('${T('Remove')} ${escJs(key)}?'))APP.removeEntry('${sid}','${escJs(key)}')">🗑</button>
      </div>
      <div class="item-card__body">
        ${cardRow(T('Name'),    editText(sid, `${key}.name`,    ammo.name    ?? ''))}
        ${cardRow(T('Format'),  editText(sid, `${key}.format`,  ammo.format  ?? ''))}
        ${cardRow(T('Enabled'), `<input class="edit-check" type="checkbox" ${ammo.enabled !== false ? 'checked' : ''}
          onchange="APP.updateField('${sid}','${escJs(key)}.enabled',this.checked)">`)}
      </div>
    </div>`).join('');

  const addRow = `
    <div style="display:flex;gap:6px;margin-top:10px;align-items:center;flex-wrap:wrap">
      <input id="ammo-new-key" class="edit-input" placeholder="${T('NEW_AMMO_KEY (e.g. SNOWBALL)')}" style="width:220px">
      <button class="btn-add-entry"
        onclick="APP.addRawEntry('${sid}',document.getElementById('ammo-new-key').value,{name:'',format:'',enabled:true});document.getElementById('ammo-new-key').value=''">+ ${T('Add ammo type')}</button>
    </div>`;

  return `
    <p class="muted small" style="margin-bottom:10px">${T('Load')} <code>ammo.yml</code>. ${T('Keys used in item gen ammo-types weights.')}</p>
    <div class="cards-grid">${cards || `<p class="muted small">${T('No ammo types yet.')}</p>`}</div>
    ${addRow}`;
}

// ---------------------------------------------------------------------------
// Hand types (hand.yml) — editable
// ---------------------------------------------------------------------------

function renderHand(data, sid) {
  if (!data || typeof data !== 'object') return `<div class="empty-state">${T('No data.')}</div>`;
  const entries = Object.entries(data).filter(([, v]) => v && typeof v === 'object');

  const cards = entries.map(([key, hand]) => `
    <div class="item-card" style="min-width:260px;max-width:380px">
      <div class="item-card__header" style="cursor:default">
        <input class="edit-input edit-id" value="${esc(key)}" title="${T('Rename key')}"
          onblur="if(this.value.trim()&&this.value.trim()!=='${escJs(key)}')APP.renameEntry('${sid}','${escJs(key)}',this.value.trim())"
          onkeydown="if(event.key==='Enter')this.blur()">
        <span class="badge ${hand.enabled !== false ? 'badge-green' : 'badge-red'}" style="flex-shrink:0">${hand.enabled !== false ? T('on') : T('off')}</span>
        <button class="btn-icon btn-del" onclick="if(confirm('${T('Remove')} ${escJs(key)}?'))APP.removeEntry('${sid}','${escJs(key)}')">🗑</button>
      </div>
      <div class="item-card__body">
        ${cardRow(T('Name'),    editText(sid, `${key}.name`,    hand.name    ?? ''))}
        ${cardRow(T('Format'),  editText(sid, `${key}.format`,  hand.format  ?? ''))}
        ${cardRow(T('Enabled'), `<input class="edit-check" type="checkbox" ${hand.enabled !== false ? 'checked' : ''}
          onchange="APP.updateField('${sid}','${escJs(key)}.enabled',this.checked)">`)}
      </div>
    </div>`).join('');

  const addRow = `
    <div style="display:flex;gap:6px;margin-top:10px;align-items:center;flex-wrap:wrap">
      <input id="hand-new-key" class="edit-input" placeholder="${T('NEW_HAND_KEY (e.g. ONE / TWO / OFF)')}" style="width:220px">
      <button class="btn-add-entry"
        onclick="APP.addRawEntry('${sid}',document.getElementById('hand-new-key').value,{name:'',format:'',enabled:true});document.getElementById('hand-new-key').value=''">+ ${T('Add hand type')}</button>
    </div>`;

  return `
    <p class="muted small" style="margin-bottom:10px">${T('Load')} <code>hand.yml</code>. ${T('Keys used in item gen hand-types weights (ONE / TWO / OFF).')}</p>
    <div class="cards-grid">${cards || `<p class="muted small">${T('No hand types yet.')}</p>`}</div>
    ${addRow}`;
}

// ---------------------------------------------------------------------------
// Classes (classes/*.yml) — read-only multiFile display
// ---------------------------------------------------------------------------

function renderClasses(data, sid) {
  if (!data) return `<div class="empty-state">${T('No data.')}</div>`;

  const addBtn = `<button class="btn-add-entry"
    onclick="document.getElementById('classes-file-add-${sid}').click()">📂 ${T('Load class files')}
    <input id="classes-file-add-${sid}" type="file" accept=".yml,.yaml" multiple style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>
  <button class="btn-add-entry" onclick="this.querySelector('input').click()">📂 ${T('Load folder')}
    <input type="file" webkitdirectory style="display:none"
      onchange="APP.onIgAddInput(event,'${sid}')">
  </button>`;

  const toolbar = `
    <div class="entry-actions" style="flex-wrap:wrap;gap:6px">
      ${addBtn}
      <span class="muted small" style="align-self:center">${T('Drop class .yml files. Each file = one class (read-only).')}</span>
    </div>`;

  if (!data._multiFile) return `${toolbar}<div class="empty-state">${T('Drop class YAML files above.')}</div>`;

  const entries = Object.entries(data.files || {});
  if (!entries.length) return `${toolbar}<div class="empty-state">${T('No class files loaded yet.')}</div>`;

  // Data is pre-slimmed to { ClassName: { name } }
  const chips = entries.map(([fname, fileData]) => {
    const entry = Object.values(fileData || {}).find(v => v && typeof v === 'object');
    const name  = entry?.name ?? fname.replace(/\.ya?ml$/i, '');
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:#1e2a3a;border:1px solid #3a5a8a;border-radius:20px;color:#8fb8ea;font-size:13px;margin:3px">
      ${esc(name)}
      <button title="${T('Remove')} ${esc(fname)}" style="background:none;border:none;color:#ea8f8f;cursor:pointer;font-size:12px;line-height:1;padding:0"
        onclick="if(confirm('${T('Remove class file')} \\'${escJs(fname)}\\'?'))APP.igRemoveFile('${sid}','${escJs(fname)}')">✕</button>
    </span>`;
  }).join('');

  return `
    ${toolbar}
    <div style="margin-top:12px;line-height:1.8">${chips}</div>
    <p class="muted small" style="margin-top:10px">${T('These class names appear in item gen → Requirements → Allowed/Banned classes.')}</p>`;
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
  renderCustomStats,
  renderItemGenerator,
  renderSets,
  renderGems,
  renderEssences,
  renderRunes,
  renderArrows,
  renderConsumables,
  renderCustomItems,
  renderBuildPreview,
  renderFabledAttributes,
  renderSkills,
  renderAmmo,
  renderHand,
  renderClasses,
};
