/**
 * schema.js — Builder schema definition.
 *
 * Defines every section the builder knows about:
 *   - which file to load
 *   - what to render
 *   - display metadata
 *
 * Adding a new section:
 *   1. Add an entry to SECTIONS below.
 *   2. Add a matching render function in renderers.js.
 *   3. That's it — app.js picks it up automatically.
 */

'use strict';

/**
 * @typedef {Object} Section
 * @property {string}   id          Unique identifier (used as DOM id and nav key).
 * @property {string}   label       Display name in navigation.
 * @property {string}   icon        Emoji icon shown in nav and page title.
 * @property {string}   file        Expected filename (shown to user when prompting upload).
 * @property {string}   renderer    Name of the render function in RENDERERS (renderers.js).
 * @property {string}   [group]     Navigation group heading.
 * @property {boolean}  [badge]     Show a count badge in nav (default: true).
 */

const SCHEMA = {

  /**
   * Navigation groups — defines order and labels.
   * Each group lists section IDs that belong to it.
   */
  groups: [
    {
      label: 'Files',
      sections: ['load'],
    },
    {
      label: 'Combat Config',
      sections: ['formula'],
    },
    {
      label: 'Stats',
      sections: ['damage', 'defense', 'general', 'penetration', 'dmgbuff', 'defbuff'],
    },
    {
      label: 'Modules',
      sections: ['itemgen', 'sets'],
    },
    {
      label: 'Tools',
      sections: ['settings'],
    },
  ],

  /**
   * Section definitions.
   * 'load' is a special built-in section (no renderer needed).
   */
  sections: {

    load: {
      id:       'load',
      label:    'Load Files',
      icon:     '📂',
      badge:    false,
      file:     null,      // no file — special section
      renderer: null,      // handled by app.js directly
    },

    formula: {
      id:       'formula',
      label:    'Damage Formula',
      icon:     '⚙️',
      badge:    false,
      file:     'engine.yml',
      renderer: 'renderFormula',
      description: 'Defense formula mode (FACTOR / CUSTOM / LEGACY) and the custom math expression.',
    },

    general: {
      id:       'general',
      label:    'General Stats',
      icon:     '📊',
      badge:    true,
      file:     'item_stats/stats/general_stats.yml',
      renderer: 'renderGeneralStats',
      description: 'All TypedStats — HP, crit, speed, global penetration, etc.',
    },

    damage: {
      id:       'damage',
      label:    'Damage Types',
      icon:     '🗡️',
      badge:    true,
      file:     'item_stats/damage.yml',
      renderer: 'renderDamage',
      description: 'Damage types: physical, fire, magical, etc. — with priorities and biome modifiers.',
    },

    defense: {
      id:       'defense',
      label:    'Defense Types',
      icon:     '🛡️',
      badge:    true,
      file:     'item_stats/defense.yml',
      renderer: 'renderDefense',
      description: 'Defense types and which damage types they block.',
    },

    penetration: {
      id:       'penetration',
      label:    'Penetration',
      icon:     '🎯',
      badge:    true,
      file:     'item_stats/stats/penetration.yml',
      renderer: 'renderPenetration',
      description: 'Penetration stats (flat and %) per damage type. Flat pen only works in CUSTOM mode.',
    },

    dmgbuff: {
      id:       'dmgbuff',
      label:    'Damage Buffs',
      icon:     '🔥',
      badge:    true,
      file:     'item_stats/stats/damage_buffs_percent.yml',
      renderer: 'renderBuffs',
      description: 'Percentage damage buffs per damage type.',
    },

    defbuff: {
      id:       'defbuff',
      label:    'Defense Buffs',
      icon:     '🛡',
      badge:    true,
      file:     'item_stats/stats/defense_buffs_percent.yml',
      renderer: 'renderBuffs',
      description: 'Percentage defense buffs per defense type.',
    },

    itemgen: {
      id:          'itemgen',
      label:       'Item Generator',
      icon:        '⚗️',
      badge:       true,
      file:        'item_stats/item_generator/',   // folder — one .yml per item type
      multiFile:   true,
      renderer:    'renderItemGenerator',
      description: 'Item generation rules — one YAML file per item type. Drop multiple files at once.',
    },

    sets: {
      id:          'sets',
      label:       'Sets',
      icon:        '👑',
      badge:       true,
      file:        'item_stats/sets/',              // folder — one .yml per set
      multiFile:   true,
      renderer:    'renderSets',
      description: 'Set bonuses — one YAML file per set. Drop multiple files at once.',
    },

    settings: {
      id:       'settings',
      label:    'Settings & Export',
      icon:     '⚙',
      badge:    false,
      file:     null,      // special section — no YAML file
      renderer: null,      // handled directly by app.js
      description: 'Auto-save, export all sections as JSON, import a JSON snapshot.',
    },

  },

  /**
   * Formula preview test cases.
   * Used in the formula section to show damage output at different defense values.
   */
  formulaPreviewCases: [
    { damage: 100, defense: 0,   toughness: 0, label: 'def=0'   },
    { damage: 100, defense: 25,  toughness: 0, label: 'def=25'  },
    { damage: 100, defense: 50,  toughness: 0, label: 'def=50'  },
    { damage: 100, defense: 100, toughness: 0, label: 'def=100' },
    { damage: 100, defense: 200, toughness: 0, label: 'def=200' },
    { damage: 100, defense: 500, toughness: 0, label: 'def=500' },
  ],

  /**
   * Defense formula modes — descriptions shown in UI.
   */
  formulaModes: {
    FACTOR: {
      color:       '#2196f3',
      description: 'Vanilla-like formula. Uses only the highest-priority defense value. Does not support flat penetration.',
      flatPenWarn: false,
    },
    CUSTOM: {
      color:       '#4caf50',
      description: 'Custom math expression with full access to variables: damage, defense, defense_&lt;id&gt;, toughness. Supports flat penetration.',
      flatPenWarn: false,
    },
    LEGACY: {
      color:       '#ffc107',
      description: 'Legacy mode — defense 1:1, no advanced calculations. Kept for backwards compatibility.',
      flatPenWarn: true,
    },
  },

};
