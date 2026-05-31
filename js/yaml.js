/**
 * yaml.js — minimal YAML parser for Divinity config files.
 *
 * Supports:
 *  - key: value (strings, numbers, booleans, null)
 *  - nested objects (indentation-based)
 *  - lists (- item)
 *  - single/double quoted strings
 *  - inline comments (#)
 *
 * Does NOT support anchors, aliases, multi-line strings, or flow style.
 * All Divinity config files fall within these constraints.
 */

'use strict';

const YAML = (() => {

  /**
   * Parse a scalar value string into its JS equivalent.
   * @param {string} raw
   * @returns {string|number|boolean|null}
   */
  function parseScalar(raw) {
    const v = raw.trim();
    if (v === 'true')           return true;
    if (v === 'false')          return false;
    if (v === 'null' || v === '~') return null;
    if (v === '[]') return [];
    if (v === '{}') return {};
    if (v.length >= 2 && (
        (v.startsWith("'") && v.endsWith("'")) ||
        (v.startsWith('"') && v.endsWith('"')))) {
      return v.slice(1, -1);
    }
    // Strict numeric check — avoid Number('0x10'), Number('1e2'), Number(' ').
    if (/^-?\d+(?:\.\d+)?$/.test(v)) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return v;
  }

  /**
   * Strip an inline comment from a YAML line.
   * Handles # inside quoted strings correctly.
   * @param {string} line
   * @returns {string}
   */
  function stripComment(line) {
    let inSingle = false, inDouble = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === "'" && !inDouble) inSingle = !inSingle;
      else if (c === '"' && !inSingle) inDouble = !inDouble;
      else if (c === '#' && !inSingle && !inDouble) {
        return line.slice(0, i);
      }
    }
    return line;
  }

  /**
   * Main parse function.
   * @param {string} text   Raw YAML text.
   * @returns {Object}      Parsed object.
   */
  function parse(text) {
    const lines = text.split('\n');
    const root  = {};

    /**
     * Stack entry:
     *   indent  {number}  indentation level of the key that opened this scope
     *   obj     {Object|Array}  the current container
     *   listKey {string|null}   if parent is an object with a pending list key
     */
    const ROOT_SENTINEL = -1;
    const LIST_FRAME    = -2; // sentinel for list-content frames (always pop with parent key)
    const stack = [{ indent: ROOT_SENTINEL, obj: root, listKey: null }];

    const top  = () => stack[stack.length - 1];

    /** Return the nearest object on the stack (skip list wrappers). */
    const currentObj = () => {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (!Array.isArray(stack[i].obj)) return stack[i].obj;
      }
      return root;
    };

    /** Return the nearest array on the stack, or null. */
    const currentArr = () => {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (Array.isArray(stack[i].obj)) return stack[i].obj;
      }
      return null;
    };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const stripped = stripComment(raw).trimEnd();
      if (stripped.trim() === '') continue;

      const indent  = stripped.search(/\S/);
      const content = stripped.trim();

      // Pop stack entries whose indent >= current indent.
      // LIST_FRAME entries pop together with their parent key.
      while (stack.length > 1) {
        const t = top();
        if (t.indent === LIST_FRAME) {
          // A list-item line at the same indent level as the parent key still
          // belongs to this list (Minecraft/plugin YAML omits the extra indent).
          // Only pop the frame when we move to a shallower level, OR when the
          // current line is NOT a list item (e.g. a sibling key that closes the list).
          const isListItem = content === '-' || content.startsWith('- ');
          if (t.parentIndent > indent ||
              (t.parentIndent >= indent && !isListItem)) {
            stack.pop(); continue;
          }
          break;
        }
        if (t.indent >= indent) { stack.pop(); continue; }
        break;
      }

      // ---- List item  (starts with "- " or is bare "-")  ----
      if (content === '-' || content.startsWith('- ')) {
        const itemVal = content === '-' ? '' : content.slice(2).trim();
        // Find the nearest array to push into
        let arr = currentArr();

        if (!arr) {
          // Shouldn't happen with well-formed YAML, but be safe
          continue;
        }

        // Detect inline mapping by finding an unquoted top-level ":"
        // Only treat as mapping when the key-part looks like a plain YAML key
        // (starts with letter/digit/underscore/dash, no Minecraft color codes,
        //  no placeholder %, no quotes at the start). This prevents lore entries
        // like "&7Tier: Legendary" from being misread as {&7Tier: Legendary}.
        let mapColon = -1;
        {
          let inS = false, inD = false;
          for (let p = 0; p < itemVal.length; p++) {
            const c = itemVal[p];
            if (c === "'" && !inD) inS = !inS;
            else if (c === '"' && !inS) inD = !inD;
            else if (c === ':' && !inS && !inD) {
              if (p === itemVal.length - 1 || /\s/.test(itemVal[p + 1])) { mapColon = p; break; }
            }
          }
          // Validate the candidate key: must look like a real YAML key.
          // A key with & (MC color), % (placeholder), or other non-key chars is
          // actually a scalar string that happens to contain a colon.
          if (mapColon !== -1) {
            const candidateKey = itemVal.slice(0, mapColon).trim();
            const isQuoted = candidateKey.length >= 2 &&
              ((candidateKey.startsWith("'") && candidateKey.endsWith("'")) ||
               (candidateKey.startsWith('"') && candidateKey.endsWith('"')));
            if (!isQuoted && !/^[A-Za-z0-9_-][A-Za-z0-9_\- ]*$/.test(candidateKey)) {
              mapColon = -1; // treat whole thing as a scalar string
            }
          }
        }
        if (mapColon !== -1) {
          // Inline mapping inside list  e.g. "- key: value" — push object
          const obj = {};
          arr.push(obj);
          let k = itemVal.slice(0, mapColon).trim();
          if (k.length >= 2 && (
              (k.startsWith("'") && k.endsWith("'")) ||
              (k.startsWith('"') && k.endsWith('"')))) {
            k = k.slice(1, -1);
          }
          const v = itemVal.slice(mapColon + 1).trim();
          if (v === '') {
            // Look ahead — could be nested object or list
            let nextContent = '';
            for (let j = i + 1; j < lines.length; j++) {
              const nl = lines[j].trim();
              if (nl && !nl.startsWith('#')) { nextContent = nl; break; }
            }
            if (nextContent.startsWith('- ') || nextContent === '-') {
              obj[k] = [];
              // Frame for the list-item object so subsequent indented keys
              // land in obj. The object's "indent" matches the "- " column.
              stack.push({ indent, obj, listKey: null });
              stack.push({ indent, obj, listKey: k });
              stack.push({ indent: LIST_FRAME, obj: obj[k], listKey: null, parentIndent: indent });
            } else {
              obj[k] = {};
              stack.push({ indent, obj, listKey: null });
              stack.push({ indent, obj: obj[k], listKey: null });
            }
          } else {
            obj[k] = parseScalar(v);
            // Frame so deeper-indent sibling keys go into the same item
            stack.push({ indent, obj, listKey: null });
          }
        } else if (itemVal === '') {
          // Bare "-" — next line(s) define the item; assume object container
          const obj = {};
          arr.push(obj);
          stack.push({ indent, obj, listKey: null });
        } else {
          arr.push(parseScalar(itemVal));
        }
        continue;
      }

      // ---- Key: value  ----
      if (content.includes(':')) {
        // Find the colon that separates key from value, respecting quotes.
        let colonIdx = -1;
        let inSingle = false, inDouble = false;
        for (let p = 0; p < content.length; p++) {
          const c = content[p];
          if (c === "'" && !inDouble) inSingle = !inSingle;
          else if (c === '"' && !inSingle) inDouble = !inDouble;
          else if (c === ':' && !inSingle && !inDouble) {
            // Must be followed by whitespace, end-of-line, or be the only colon.
            if (p === content.length - 1 || /\s/.test(content[p + 1])) {
              colonIdx = p; break;
            }
          }
        }
        if (colonIdx === -1) continue;
        let key = content.slice(0, colonIdx).trim();
        // Strip surrounding quotes around keys (handles 'on', "true", 'a:b', etc.)
        if (key.length >= 2 && (
            (key.startsWith("'") && key.endsWith("'")) ||
            (key.startsWith('"') && key.endsWith('"')))) {
          key = key.slice(1, -1);
        }
        const val = content.slice(colonIdx + 1).trim();

        // Determine parent object
        const parent = currentObj();

        if (val === '') {
          // Look ahead to decide: nested object or list?
          let nextContent = '';
          for (let j = i + 1; j < lines.length; j++) {
            const nl = lines[j].trim();
            if (nl && !nl.startsWith('#')) { nextContent = nl; break; }
          }

          if (nextContent.startsWith('- ')) {
            // This key maps to a list
            parent[key] = [];
            // Push a list frame so list items know where to go.
            // Use LIST_FRAME sentinel so the array frame is bound to its parent
            // key and pops together with it (avoids leaking when the parent key
            // is at indent 0).
            stack.push({ indent, obj: parent, listKey: key });
            stack.push({ indent: LIST_FRAME, obj: parent[key], listKey: null, parentIndent: indent });
          } else {
            // Nested object
            parent[key] = {};
            stack.push({ indent, obj: parent[key], listKey: null });
          }
        } else {
          parent[key] = parseScalar(val);
        }
        continue;
      }
    }

    return root;
  }

  // ---------------------------------------------------------------------------
  // Stringify (serialize JS object → YAML text)
  // ---------------------------------------------------------------------------

  /**
   * Quote a string value for YAML output if necessary.
   * @param {string} s
   * @returns {string}
   */
  function quoteString(s) {
    // Must quote if: empty, starts with YAML special char, reserved word,
    // contains ': ', has leading/trailing whitespace, or contains newline.
    const needsQuote =
      s === '' ||
      /^[&*!|>'"%@`{}\[\]?,#-]/.test(s) ||
      s.trim() !== s ||
      s.includes('\n') || s.includes('\r') || s.includes(': ') ||
      s.endsWith(':') ||
      /^-?\d+(?:\.\d+)?$/.test(s) ||  // numeric-looking string
      /^(true|false|null|yes|no|on|off|~)$/i.test(s);
    if (needsQuote) {
      return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
                     .replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    }
    return s;
  }

  /**
   * Quote a key name for YAML output if necessary.
   * Stricter than value quoting — keys with colons, special chars, or
   * reserved words must always be quoted.
   * @param {string} k
   * @returns {string}
   */
  function quoteKey(k) {
    const s = String(k);
    const needsQuote =
      s === '' ||
      /[:#&*!|>'"%@`{}\[\]?,]/.test(s) ||
      /\s/.test(s) ||
      s.startsWith('-') ||
      /^(true|false|null|yes|no|on|off|~)$/i.test(s) ||
      /^-?\d+(?:\.\d+)?$/.test(s);
    if (needsQuote) {
      return "'" + s.replace(/'/g, "''") + "'";
    }
    return s;
  }

  /**
   * Serialize a JS value to a YAML string.
   * @param {*}      value
   * @param {number} [indent=0]   Current indentation level.
   * @returns {string}
   */
  /**
   * Render a single list-item line.
   * For object items: first key sits on the "- " line, subsequent keys are
   * indented by (indent+1) so they align under the first key.
   */
  function stringifyListItem(item, indent) {
    const pad = '  '.repeat(indent);
    if (item === null || item === undefined ||
        typeof item === 'boolean' || typeof item === 'number' ||
        typeof item === 'string') {
      return `${pad}- ${stringifyScalar(item)}`;
    }
    if (Array.isArray(item)) {
      if (item.length === 0) return `${pad}- []`;
      // Nested list: render items at indent+1, prefix first line with "- "
      const inner = item.map(x => stringifyListItem(x, indent + 1)).join('\n');
      return `${pad}-\n${inner}`;
    }
    // Object: emit first key on the "- " line; rest at (indent+1)
    const entries = Object.entries(item);
    if (entries.length === 0) return `${pad}- {}`;
    const childPad = '  '.repeat(indent + 1);
    const lines = entries.map(([k, v], i) => {
      const prefix = (i === 0) ? `${pad}- ` : childPad;
      return prefix + stringifyKeyValue(k, v, indent + 1);
    });
    return lines.join('\n');
  }

  /** Render scalar (non-container) value inline. */
  function stringifyScalar(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number')  return Number.isFinite(value) ? String(value) : 'null';
    if (typeof value === 'string')  return quoteString(value);
    return String(value);
  }

  /**
   * Render "key: value" (or "key:\n  ...") starting at the current line.
   * The caller is responsible for the leading indent (passed via prefix).
   */
  function stringifyKeyValue(k, v, indent) {
    const key = quoteKey(k);
    if (Array.isArray(v)) {
      if (v.length === 0) return `${key}: []`;
      const items = v.map(item => stringifyListItem(item, indent + 1)).join('\n');
      return `${key}:\n${items}`;
    }
    if (v && typeof v === 'object') {
      const entries = Object.entries(v);
      if (entries.length === 0) return `${key}: {}`;
      const childPad = '  '.repeat(indent + 1);
      const lines = entries.map(([ck, cv]) => childPad + stringifyKeyValue(ck, cv, indent + 1));
      return `${key}:\n${lines.join('\n')}`;
    }
    return `${key}: ${stringifyScalar(v)}`;
  }

  function stringifyValue(value, indent) {
    const pad = '  '.repeat(indent);

    if (value === null || value === undefined ||
        typeof value === 'boolean' || typeof value === 'number' ||
        typeof value === 'string') {
      return stringifyScalar(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      return value.map(item => stringifyListItem(item, indent)).join('\n');
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) return '{}';
      return entries.map(([k, v]) => pad + stringifyKeyValue(k, v, indent)).join('\n');
    }

    return String(value);
  }

  /**
   * Serialize a root object to a YAML string.
   * @param {Object} obj
   * @returns {string}
   */
  function stringify(obj) {
    return stringifyValue(obj, 0) + '\n';
  }

  return { parse, stringify };
})();
