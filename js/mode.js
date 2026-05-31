/**
 * mode.js — Vanilla vs Modded (Lotus) build mode.
 *
 * MODE controls which sections/fields are visible and which YAML
 * structure is used when reading/writing. Persisted to localStorage.
 *
 *   vanilla — base Divinity (no buffs/penetration, no CUSTOM formula,
 *             single item-stats list, file `stats.yml` for general stats)
 *   modded  — Lotus fork (full feature set)
 *
 * Default = vanilla.
 *
 * In schema.js, sections may declare:
 *   modes: ['modded']           // shown only in this mode
 *   fileVanilla / fileModded    // mode-specific file path override
 *   labelVanilla / labelModded  // mode-specific label override
 */

'use strict';

const MODE_STORAGE_KEY = 'divinity_builder_mode';
const SUPPORTED_MODES  = ['vanilla', 'modded'];

let MODE = (function () {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    return SUPPORTED_MODES.includes(saved) ? saved : 'vanilla';
  } catch (_) {
    return 'vanilla';
  }
})();

/** Return true if section is visible in current MODE. */
function sectionVisibleInMode(def) {
  if (!def || !Array.isArray(def.modes)) return true;
  return def.modes.includes(MODE);
}

/** Mode-aware file path. */
function getSectionFile(def) {
  if (!def) return null;
  if (MODE === 'vanilla' && def.fileVanilla) return def.fileVanilla;
  if (MODE === 'modded'  && def.fileModded)  return def.fileModded;
  return def.file ?? null;
}

/** Mode-aware label. */
function getSectionLabel(def) {
  if (!def) return '';
  if (MODE === 'vanilla' && def.labelVanilla) return def.labelVanilla;
  if (MODE === 'modded'  && def.labelModded)  return def.labelModded;
  return def.label ?? '';
}

/** True if vanilla mode (sugar). */
function isVanilla() { return MODE === 'vanilla'; }

/**
 * Recursively strip modded-only fields from item-generator data.
 * Removes item-stats.list-damage-buffs, list-defense-buffs, list-penetration, list-custom-stats.
 * Used at YAML serialization time when MODE=vanilla.
 */
function stripModdedFieldsForYaml(sid, data) {
  if (MODE !== 'vanilla' || !data || typeof data !== 'object') return data;

  // Item-generator file: scrub item-stats sub-lists
  if (sid === 'itemgen') {
    if (data._multiFile && data.files) {
      const cleaned = { ...data, files: {} };
      for (const [fname, fdata] of Object.entries(data.files)) {
        cleaned.files[fname] = _stripItemGenFile(fdata);
      }
      return cleaned;
    }
    return _stripItemGenFile(data);
  }
  return data;
}

function _stripItemGenFile(d) {
  if (MODE !== 'vanilla' || !d || typeof d !== 'object') return d;
  const out = JSON.parse(JSON.stringify(d));
  const stats = out?.generator?.['item-stats'];
  if (stats && typeof stats === 'object') {
    delete stats['list-damage-buffs'];
    delete stats['list-defense-buffs'];
    delete stats['list-penetration'];
    delete stats['list-custom-stats'];
  }
  return out;
}

/**
 * Strip vanilla-incompatible fields from engine.yml (formula section).
 * Vanilla engine.yml has only `legacy-combat` — remove `defense-formula`
 * and `custom-defense-formula` from YAML output.
 */
function _stripFormulaFile(d) {
  if (MODE !== 'vanilla' || !d || typeof d !== 'object') return d;
  const out = JSON.parse(JSON.stringify(d));
  const combat = out.combat || out;
  if (combat && typeof combat === 'object') {
    // Modded-only combat fields not present in vanilla engine.yml
    delete combat['defense-formula'];
    delete combat['custom-defense-formula'];
    delete combat['overflow-pen-amplifies'];
    delete combat['overflow-pen-formula'];
    delete combat['overflow-negdef-amplifies'];
    delete combat['overflow-negdef-formula'];
  }
  // attributes.hide-flags is modded-only
  if (out.attributes && typeof out.attributes === 'object') {
    delete out.attributes['hide-flags'];
  }
  // lore.stats.style.enchantments.roman-system is modded-only
  const ench = out?.lore?.stats?.style?.enchantments;
  if (ench && typeof ench === 'object') {
    delete ench['roman-system'];
  }
  return out;
}
