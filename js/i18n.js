/**
 * i18n.js — Lightweight gettext-style translations.
 *
 * Usage in any other file:
 *   `<div>${T('Damage Types')}</div>`
 *
 * Default language is EN (T returns the input unchanged).
 * If LANG === 'ru' and TRANSLATIONS.ru has a key matching the input string,
 * the Russian translation is returned. Otherwise the original (EN) is shown.
 *
 * Adding a new string:
 *   1. Use T('...') in source code.
 *   2. Add the same string as a key in TRANSLATIONS.ru with the Russian value.
 *
 * Changing language:
 *   APP.setLang('ru')   — persists to localStorage and re-renders nav + active section.
 */

'use strict';

const LANG_STORAGE_KEY = 'divinity_builder_lang';
const SUPPORTED_LANGS  = ['en', 'ru'];

let LANG = (function () {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return SUPPORTED_LANGS.includes(saved) ? saved : 'en';
  } catch (_) {
    return 'en';
  }
})();

/**
 * Translation dictionary. EN is the source-of-truth (no entries needed).
 * RU entries map the EN string verbatim → Russian translation.
 *
 * Tips:
 *   - Keep technical identifiers untranslated (e.g. 'DIVINITY_physical', 'FACTOR').
 *   - For strings containing HTML, translate only the prose, keep tags intact.
 *   - For composed strings (e.g. `'Load ' + file`), wrap only the prose part.
 */
const TRANSLATIONS = {
  ru: {
    // ─── Nav groups ────────────────────────────────────────────────
    'Files':          'Файлы',
    'Combat Config':  'Боевая конфигурация',
    'Stats':          'Статы',
    'Modules':        'Модули',
    'Build Preview':  'Превью сборки',
    'Tools':          'Инструменты',

    // ─── Section labels ────────────────────────────────────────────
    'Load Files':         'Загрузка файлов',
    'Damage Formula':     'Формула урона',
    'General Stats':      'Общие статы',
    'Damage Types':       'Типы урона',
    'Defense Types':      'Типы защиты',
    'Penetration':        'Пробитие',
    'Damage Buffs':       'Бафы урона',
    'Defense Buffs':      'Бафы защиты',
    'Item Generator':     'Генератор предметов',
    'Sets':               'Сеты',
    'Gems':               'Самоцветы',
    'Essences':           'Эссенции',
    'Runes':              'Руны',
    'Arrows':             'Стрелы',
    'Consumables':        'Расходники',
    'Custom Items':       'Кастомные предметы',
    'Build':              'Сборка',
    'Fabled Attributes':  'Атрибуты Fabled',
    'Skills':             'Навыки',
    'Classes':            'Классы',
    'Ammo Types':         'Типы боеприпасов',
    'Hand Types':         'Слоты оружия',
    'Settings & Export':  'Настройки и экспорт',

    // ─── Section descriptions ──────────────────────────────────────
    'Defense formula mode (FACTOR / CUSTOM / LEGACY) and the custom math expression.':
      'Режим формулы защиты (FACTOR / CUSTOM / LEGACY) и пользовательское математическое выражение.',
    'All TypedStats — HP, crit, speed, global penetration, etc.':
      'Все TypedStats — HP, крит, скорость, глобальное пробитие и т.д.',
    'Damage types: physical, fire, magical, etc. — with priorities and biome modifiers.':
      'Типы урона: физический, огонь, магический и т.д. — с приоритетами и модификаторами биомов.',
    'Defense types and which damage types they block.':
      'Типы защиты и то, какие типы урона они блокируют.',
    'Penetration stats (flat and %) per damage type. Flat pen only works in CUSTOM mode.':
      'Статы пробития (плоское и %) на каждый тип урона. Плоское пробитие работает только в режиме CUSTOM.',
    'Percentage damage buffs per damage type.':
      'Процентные бафы урона на каждый тип урона.',
    'Percentage defense buffs per defense type.':
      'Процентные бафы защиты на каждый тип защиты.',
    'Item generation rules — one YAML file per item type. Drop multiple files at once.':
      'Правила генерации предметов — один YAML на тип. Можно перетащить несколько файлов сразу.',
    'Armor/weapon sets — one YAML file per set. Drop multiple files at once.':
      'Сеты брони/оружия — один YAML на сет. Можно перетащить несколько файлов сразу.',
    'Gem items — one YAML file per gem type. Drop multiple files at once.':
      'Самоцветы — один YAML на тип. Можно перетащить несколько файлов сразу.',
    'Essence socket items — cosmetic particle effects. One YAML file per essence type.':
      'Предметы-эссенции для сокетов — косметические эффекты частиц. Один YAML на тип.',
    'Rune socket items — permanent potion effects when socketed. One YAML file per rune type.':
      'Предметы-руны для сокетов — постоянные эффекты зелий при вставке. Один YAML на тип.',
    'Custom arrow/projectile items — one YAML file per arrow type. Drop multiple files at once.':
      'Кастомные стрелы/снаряды — один YAML на тип. Можно перетащить несколько файлов сразу.',
    'Consumable items (food, potions) — one YAML file per item. Drop multiple files at once.':
      'Расходные предметы (еда, зелья) — один YAML на предмет. Можно перетащить несколько сразу.',
    'Custom static items (no Divinity stats) — name, lore, material, enchantments, attributes, etc. One YAML file per item.':
      'Кастомные статичные предметы (без статов Divinity) — имя, лор, материал, чары, атрибуты и т.д. Один YAML на предмет.',
    'Simulate a character build — equip items from loaded generators and see expected stats, active sets and combat estimate.':
      'Симулируйте сборку персонажа — наденьте предметы из загруженных генераторов и посмотрите ожидаемые статы, активные сеты и боевой расчёт.',
    'Fabled/SkillAPI attribute definitions — name, max points, stat formulas. Read-only reference used by item gen.':
      'Определения атрибутов Fabled/SkillAPI — имя, макс. очков, формулы статов. Справочник только для чтения, используется генератором предметов.',
    'Fabled/SkillAPI skill definitions — one .yml per skill. Read-only; item gen reads available skill names from here.':
      'Определения навыков Fabled/SkillAPI — один .yml на навык. Только для чтения; генератор предметов берёт отсюда доступные имена навыков.',
    'Fabled/SkillAPI class definitions — one .yml per class. Read-only; item gen uses class names in Requirements.':
      'Определения классов Fabled/SkillAPI — один .yml на класс. Только для чтения; генератор предметов использует имена классов в требованиях.',
    'Ammo type definitions (ammo.yml). Read-only reference — keys map to item gen ammo-types weights.':
      'Определения типов боеприпасов (ammo.yml). Справочник только для чтения — ключи соответствуют весам ammo-types в генераторе предметов.',
    'Hand type definitions (hand.yml). Read-only reference — ONE / TWO / OFF map to item gen hand-types weights.':
      'Определения слотов оружия (hand.yml). Справочник только для чтения — ONE / TWO / OFF соответствуют весам hand-types в генераторе предметов.',
    'Auto-save, export all sections as JSON, import a JSON snapshot.':
      'Авто-сохранение, экспорт всех секций как JSON, импорт снимка JSON.',

    // ─── Formula modes ─────────────────────────────────────────────
    'Vanilla-like formula. Uses only the highest-priority defense value. Does not support flat penetration.':
      'Формула в стиле ванили. Использует только значение защиты с наивысшим приоритетом. Не поддерживает плоское пробитие.',
    'Custom math expression with full access to variables: damage, defense, defense_&lt;id&gt;, toughness. Supports flat penetration.':
      'Пользовательское математическое выражение с полным доступом к переменным: damage, defense, defense_&lt;id&gt;, toughness. Поддерживает плоское пробитие.',
    'Legacy mode — defense 1:1, no advanced calculations. Kept for backwards compatibility.':
      'Устаревший режим — защита 1:1, без сложных расчётов. Сохранён для обратной совместимости.',

    // ─── Top-level UI ──────────────────────────────────────────────
    '⚔️ Divinity Builder': '⚔️ Divinity Builder',
    'config visualizer & editor': 'визуализатор и редактор конфига',
    'Language': 'Язык',
    'Click a tile or drag-and-drop a YAML file onto it. All parsing is local — nothing is sent over the network.':
      'Кликните на плитку или перетащите YAML-файл. Обработка происходит локально — ничего не отправляется в сеть.',

    // ─── Common labels (high frequency) ────────────────────────────
    'Name':           'Имя',
    'Priority':       'Приоритет',
    'Capacity':       'Вместимость',
    'Enabled':        'Включено',
    'enabled':        'включено',
    'disabled':       'отключено',
    'flat':           'плоский',
    '% percent':      '% процент',
    'Lore':           'Лор',
    'Lore format':    'Формат лора',
    'Tier':           'Тир',
    'Material':       'Материал',
    'Materials':      'Материалы',
    'Format':         'Формат',
    'Type':           'Тип',
    'Particle':       'Частица',
    'Amount':         'Количество',
    'Speed':          'Скорость',
    'Offset X':       'Смещение X',
    'Offset Y':       'Смещение Y',
    'Offset Z':       'Смещение Z',
    'Effect type':    'Тип эффекта',
    'Min':            'Мин',
    'Max':            'Макс',
    'Flat':           'Плоское',
    'Round':          'Округлять',
    'Stat ID':        'ID стата',
    'Chance %':       'Шанс %',
    'Scale/lvl':      'Множ./ур.',
    'Min / Max':      'Мин / Макс',
    'Min / Max skills':  'Мин / Макс навыков',
    'Min / Max slots':   'Мин / Макс сокетов',
    'Level':          'Уровень',
    'Level min / max':'Уровень мин / макс',
    'Level requirements': 'Требования к уровню',
    'Level map':      'Карта уровней',
    'lvl':            'ур.',
    'Lv':             'Ур.',
    'lv':             'ур.',
    'max lvl':        'макс. ур.',
    'pc':             'шт.',
    'amp':            'усил.',
    'chance%':        'шанс%',
    'on':             'вкл',
    'off':            'выкл',
    'none':           'нет',
    'no gem':         'нет самоцвета',
    'no essence':     'нет эссенции',
    'no rune':        'нет руны',
    'or':             'или',
    'e.g.':           'напр.',

    // ─── Actions / buttons ─────────────────────────────────────────
    'Add':            'Добавить',
    'Remove':         'Удалить',
    'Remove entry':   'Удалить запись',
    'Remove tier':    'Удалить тир',
    'Remove level':   'Удалить уровень',
    'Remove group':   'Удалить группу',
    'Remove element': 'Удалить элемент',
    'Remove from editor': 'Удалить из редактора',
    'Remove empty folder': 'Удалить пустую папку',
    'Remove skill':   'Удалить навык',
    'Remove skill file': 'Удалить файл навыка',
    'Remove class file': 'Удалить файл класса',
    'Remove attribute':  'Удалить атрибут',
    'Remove bonus entry':'Удалить бонус',
    'Collapse all':   'Свернуть всё',
    'Expand all':     'Раскрыть всё',
    'Collapse':       'Свернуть',
    'Expand':         'Раскрыть',
    'Download':       'Скачать',
    'Download all':   'Скачать всё',
    'Download all (ZIP)': 'Скачать всё (ZIP)',
    'Download all as JSON': 'Скачать всё как JSON',
    'Download this folder (subfolder or ZIP)': 'Скачать эту папку (подпапка или ZIP)',
    'Download all as folder tree (Chrome/Edge) or ZIP': 'Скачать всё как дерево папок (Chrome/Edge) или ZIP',
    'Save as template': 'Сохранить как шаблон',
    'Save now':       'Сохранить сейчас',
    'Sync':           'Синхр.',
    'Sync All':       'Синхр. всё',
    'Sync from':      'Синхр. из',
    'Sync lore-format AND add missing pool entries from':
                      'Синхр. формат лора И добавить недостающие записи из',
    'Sync lore-format and pool from loaded': 'Синхр. формат лора и пул из загруженных',
    'files (reads target-requirements.socket values)':
                      'файлов (читает target-requirements.socket)',
    'Sync ALL pools (damage, defense, item-stats, buffs, pen, fabled attrs, sockets) from loaded sections':
                      'Синхр. ВСЕ пулы (урон, защита, статы, бафы, проб., атрибуты, сокеты) из загруженных секций',

    // ─── "Add" verbs ───────────────────────────────────────────────
    'Add stat':       'Добавить стат',
    'Add damage type':   'Добавить тип урона',
    'Add defense type':  'Добавить тип защиты',
    'Add penetration stat': 'Добавить стат пробития',
    'Add damage buff':   'Добавить баф урона',
    'Add defense buff':  'Добавить баф защиты',
    'Add skill':      'Добавить навык',
    'Add element':    'Добавить элемент',
    'Add tier':       'Добавить тир',
    'Add level':      'Добавить уровень',
    'Add group':      'Добавить группу',
    'Add entry':      'Добавить запись',
    'Add set':        'Добавить сет',
    'Add ammo type':  'Добавить тип боеприпасов',
    'Add hand type':  'Добавить слот оружия',
    'Add attribute':  'Добавить атрибут',
    'Add gem file':   'Добавить файл самоцвета',
    'Add essence file': 'Добавить файл эссенции',
    'Add rune file':  'Добавить файл руны',
    'Add arrow file': 'Добавить файл стрелы',
    'Add consumable file': 'Добавить файл расходника',
    'Add set file':   'Добавить файл сета',
    'Add item file':  'Добавить файл предмета',
    'Add item type file':  'Добавить файл типа предмета',

    // ─── "New" verbs ───────────────────────────────────────────────
    'New':            'Новый',
    'New set':        'Новый сет',
    'New gem':        'Новый самоцвет',
    'New essence':    'Новая эссенция',
    'New rune':       'Новая руна',
    'New arrow':      'Новая стрела',
    'New consumable': 'Новый расходник',
    'New item':       'Новый предмет',
    'New folder':     'Новая папка',
    'New folder name:': 'Имя новой папки:',

    // ─── Load / load folder ────────────────────────────────────────
    'Load':           'Загрузить',
    'Loaded':         'Загружено',
    'Load folder':    'Загрузить папку',
    'Load skill files': 'Загрузить файлы навыков',
    'Load class files': 'Загрузить файлы классов',
    'Load error':     'Ошибка загрузки',
    'Loaded skills':  'Загруженные навыки',
    'Loaded classes': 'Загруженные классы',
    'Load skills files in <b>Combat Config → Skills</b> to enable dropdown.':
      'Загрузите файлы навыков в <b>Боевая конфигурация → Навыки</b>, чтобы включить выпадающий список.',
    'Load class files in <b>Combat Config → Classes</b> to see class names.':
      'Загрузите файлы классов в <b>Боевая конфигурация → Классы</b>, чтобы увидеть имена классов.',

    // ─── Empty states / status ─────────────────────────────────────
    'No data.':       'Нет данных.',
    'No entries.':    'Нет записей.',
    'No entries. Use ↺ Sync to populate.': 'Нет записей. Используйте ↺ Синхр., чтобы заполнить.',
    'No entries. Auto-generated by server on startup, or add manually.':
      'Нет записей. Авто-генерация сервером при старте или добавьте вручную.',
    'No entries defined.': 'Нет определённых записей.',
    'No skills defined yet.': 'Навыки ещё не определены.',
    'No skills defined.':    'Навыки не определены.',
    'No special materials yet.': 'Пока нет особых материалов.',
    'No levels defined.': 'Уровни не определены.',
    'No action groups yet.': 'Группы действий ещё не добавлены.',
    'No damage types found.': 'Типы урона не найдены.',
    'No defense types found.': 'Типы защиты не найдены.',
    'No penetration stats.': 'Нет статов пробития.',
    'No sets found.':  'Сеты не найдены.',
    'No attributes yet.': 'Пока нет атрибутов.',
    'No skill files loaded yet.': 'Файлы навыков ещё не загружены.',
    'No class files loaded yet.': 'Файлы классов ещё не загружены.',
    'No ammo types yet.': 'Пока нет типов боеприпасов.',
    'No hand types yet.': 'Пока нет слотов оружия.',
    'No active sets detected.': 'Активные сеты не обнаружены.',
    'No lines.':      'Нет строк.',
    'None set.':      'Не задано.',
    'None.':          'Нет.',
    'Other':          'Другое',
    'Error':          'Ошибка',
    'file(s)':        'файл(ов)',
    '(no folder)':    '(без папки)',
    'Drop files here':'Перетащите файлы сюда',
    'Drop skill YAML files above.': 'Перетащите YAML-файлы навыков сюда.',
    'Drop class YAML files above.': 'Перетащите YAML-файлы классов сюда.',
    'Drop skill .yml files here. Each file = one skill (read-only).':
      'Перетащите .yml файлы навыков. Один файл = один навык (только для чтения).',
    'Drop class .yml files. Each file = one class (read-only).':
      'Перетащите .yml файлы классов. Один файл = один класс (только для чтения).',
    'Drop item-generator YAML files above, or use <b>Load Files</b>.':
      'Перетащите YAML-файлы генератора предметов или используйте <b>Загрузка файлов</b>.',
    'Each .yml file = one item type (e.g. sword.yml, helmet.yml).':
      'Один .yml файл = один тип предмета (напр. sword.yml, helmet.yml).',
    'Drop set YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New set</b>.':
      'Перетащите YAML-файлы сетов, используйте <b>Загрузка файлов</b> или введите имя и нажмите <b>+ Новый сет</b>.',
    'Drop gem YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New gem</b>.':
      'Перетащите YAML-файлы самоцветов, используйте <b>Загрузка файлов</b> или введите имя и нажмите <b>+ Новый самоцвет</b>.',
    'Drop essence YAML files above or click <b>+ New essence</b>.':
      'Перетащите YAML-файлы эссенций или нажмите <b>+ Новая эссенция</b>.',
    'Drop rune YAML files above or click <b>+ New rune</b>.':
      'Перетащите YAML-файлы рун или нажмите <b>+ Новая руна</b>.',
    'Drop arrow YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New arrow</b>.':
      'Перетащите YAML-файлы стрел, используйте <b>Загрузка файлов</b> или введите имя и нажмите <b>+ Новая стрела</b>.',
    'Drop consumable YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New consumable</b>.':
      'Перетащите YAML-файлы расходников, используйте <b>Загрузка файлов</b> или введите имя и нажмите <b>+ Новый расходник</b>.',
    'Drop custom item YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New item</b>.':
      'Перетащите YAML-файлы кастомных предметов, используйте <b>Загрузка файлов</b> или введите имя и нажмите <b>+ Новый предмет</b>.',
    'Custom items are static — no Divinity stats. Use <b>Item Generator</b> for stat-bearing items.':
      'Кастомные предметы статичны — без статов Divinity. Используйте <b>Генератор предметов</b> для предметов со статами.',
    'No gem files loaded yet.': 'Файлы самоцветов ещё не загружены.',
    'No essence files loaded yet.': 'Файлы эссенций ещё не загружены.',
    'No rune files loaded yet.':    'Файлы рун ещё не загружены.',
    'No arrow files loaded yet.':   'Файлы стрел ещё не загружены.',
    'No consumable files loaded yet.': 'Файлы расходников ещё не загружены.',
    'No custom item files loaded yet.': 'Файлы кастомных предметов ещё не загружены.',

    // ─── Section / form descriptions ───────────────────────────────
    'Each file = one set. Items are identified by <b>vanilla material</b> + display <b>name contains</b> element name (case-insensitive, stripped of color codes).':
      'Один файл = один сет. Предметы определяются по <b>ванильному материалу</b> + <b>имя содержит</b> название элемента (без учёта регистра и цвет-кодов).',
    'Each file = one gem type. <code>socket-display</code> = text shown on item lore when socketed.':
      'Один файл = один тип самоцвета. <code>socket-display</code> = текст в лоре предмета при вставке.',
    'Each file = one essence type. Socketed into ESSENCE socket slots.':
      'Один файл = один тип эссенции. Вставляется в сокеты ESSENCE.',
    'Each file = one rune type. Effect amplifier = item level − 1 (level 1 → amplifier 0 = effect I).':
      'Один файл = один тип руны. Усилитель эффекта = уровень − 1 (уровень 1 → усилитель 0 = эффект I).',
    "Each file = one arrow type. <code>on-hit-actions</code> / <code>on-fly-actions</code> use Divinity's action DSL.":
      'Один файл = один тип стрелы. <code>on-hit-actions</code> / <code>on-fly-actions</code> используют DSL действий Divinity.',
    'Each file = one consumable type. <code>variables-by-level</code> values are accessible as <code>%varName%</code> in lore.':
      'Один файл = один тип расходника. Значения <code>variables-by-level</code> доступны как <code>%varName%</code> в лоре.',
    'Each file = one custom item type. Custom items do not have Divinity RPG stats — use <b>Item Generator</b> for items with damage/defense. Give with:':
      'Один файл = один кастомный предмет. Кастомные предметы не имеют RPG-статов Divinity — используйте <b>Генератор предметов</b> для предметов с уроном/защитой. Выдача:',

    // ─── Formula section ───────────────────────────────────────────
    'Active mode':    'Активный режим',
    'is enabled.':    'включено.',
    'Flat penetration does not work in this mode. Requires CUSTOM.':
      'Плоское пробитие не работает в этом режиме. Требуется CUSTOM.',
    'Formula mode':   'Режим формулы',
    'Click a mode to switch.': 'Кликните на режим, чтобы переключить.',
    'Custom defense formula': 'Пользовательская формула защиты',
    'Variables':      'Переменные',
    'Formula preview':'Превью формулы',
    'Last row is editable — enter any damage + defense values.':
      'Последняя строка редактируется — введите любые значения урона и защиты.',
    'Damage in':      'Урон вход',
    'Defense':        'Защита',
    'Damage out':     'Урон выход',
    'Reduction %':    'Снижение %',

    // ─── General Stats ─────────────────────────────────────────────
    'Search stats by ID, name, category…': 'Поиск статов по ID, имени, категории…',
    'stats total. Grouped by category, alphabetical within.':
      'статов всего. Сгруппированы по категории, по алфавиту внутри.',
    'Combat':         'Бой',
    'Health':         'Здоровье',
    'Movement':       'Движение',
    'Magic':          'Магия',
    'Projectile':     'Снаряды',
    'Status':         'Статусы',
    'Utility':        'Утилита',
    'Unknown':        'Неизвестно',

    // ─── Damage / Defense / Pen cards ──────────────────────────────
    'Attached causes':   'Прикреплённые причины',
    'Biome modifiers':   'Модификаторы биомов',
    'On-hit actions':    'Действия при попадании',
    'Entity modifiers':  'Модификаторы существ',
    'Faction modifiers': 'Модификаторы фракций',
    'Protection factor': 'Фактор защиты',
    'Blocks damage types': 'Блокирует типы урона',
    '% Pen':             '% Проб.',
    'Checked = percent, unchecked = flat': 'Отмечено = процент, снято = плоское',
    'Hooks (damage types)': 'Хуки (типы урона)',
    '<b>Flat</b> pen (unchecked) only works in CUSTOM formula mode. <b>%</b> pen (checked) works in all modes.':
      '<b>Плоское</b> пробитие (не отм.) работает только в режиме CUSTOM. <b>%</b> пробитие (отм.) работает во всех режимах.',
    'Bukkit Biome name.':       'Имя Bukkit Biome.',
    'Bukkit EntityType name.':  'Имя Bukkit EntityType.',
    'MythicMobs faction name.': 'Имя фракции MythicMobs.',

    // ─── Item Generator ────────────────────────────────────────────
    'Basic Info':     'Базовая информация',
    'Generator':      'Генератор',
    'Bonuses':        'Бонусы',
    'Bonuses by level': 'Бонусы по уровню',
    'Bonus tiers':    'Уровни бонусов',
    'Requirements':   'Требования',
    'Enchantments':   'Чары',
    'Enchantment list':  'Список чар',
    'Enchant list':   'Список чар',
    'Ammo & Hand Types': 'Боеприпасы и слоты',
    'Skills':         'Навыки',
    'Shield Patterns':'Узоры щитов',
    'Armor Trimmings (1.20+)': 'Окантовка брони (1.20+)',
    'Damage Buffs %':    'Бафы урона %',
    'Defense Buffs %':   'Бафы защиты %',
    'Damage Types':      'Типы урона',
    'Defense Types':     'Типы защиты',
    'General stats':     'Общие статы',
    'general active':    'общих активно',
    'Stat pool':         'Пул статов',
    'active':            'активно',
    'Item Stats':        'Статы предметов',
    'Material Modifiers':'Модификаторы материалов',
    'Material Bonuses':  'Бонусы материалов',
    'Class Bonuses':     'Бонусы классов',
    'Rarity Bonuses':    'Бонусы редкости',
    'Wildcard or prefix material names — e.g. <code>diamond*</code>, <code>gold</code>.':
      'Шаблон или префикс имён материалов — напр. <code>diamond*</code>, <code>gold</code>.',
    'Exact material / item IDs — e.g. <code>iron_sword</code>, <code>iron_helmet</code>.':
      'Точные ID материалов/предметов — напр. <code>iron_sword</code>, <code>iron_helmet</code>.',
    'Fabled class names — e.g. <code>Warrior</code>, <code>Cleric</code>. Supports: damage-types, defense-types, item-stats.':
      'Имена классов Fabled — напр. <code>Warrior</code>, <code>Cleric</code>. Поддерживает: damage-types, defense-types, item-stats.',
    'Tier/rarity names — e.g. <code>common</code>, <code>rare</code>, <code>legendary</code>. Supports: damage-types, defense-types, item-stats.':
      'Имена тиров/редкости — напр. <code>common</code>, <code>rare</code>, <code>legendary</code>. Поддерживает: damage-types, defense-types, item-stats.',
    'Material name or wildcard (e.g. diamond*, iron_sword)':
      'Имя материала или шаблон (напр. diamond*, iron_sword)',
    'Class name':     'Имя класса',
    'Name template':  'Шаблон имени',
    'Prefix chance %':'Шанс префикса %',
    'Suffix chance %':'Шанс суффикса %',
    'Reverse blacklist': 'Инверт. чёрный список',
    'Black-list (one item per line)': 'Чёрный список (один предмет на строку)',
    'Color (R,G,B)':  'Цвет (R,G,B)',
    'Unbreakable':    'Несокрушимый',
    'Enchanted':      'Зачарованный',
    'Glint (enchanted look)': 'Свечение (зачар. вид)',
    'Durability %':   'Прочность %',
    'Durability':     'Прочность',
    'Custom Model Data': 'Custom Model Data',
    'Skull hash':     'Хэш черепа',
    'Skull Hash':     'Хэш черепа',
    'Skull texture hash (PLAYER_HEAD material).': 'Хэш текстуры черепа (материал PLAYER_HEAD).',
    'Skull texture hash (for PLAYER_HEAD material).': 'Хэш текстуры черепа (для материала PLAYER_HEAD).',
    'Item flags':     'Флаги предмета',
    'Item Flags':     'Флаги предмета',
    'All flags (hide everything)': 'Все флаги (скрыть всё)',
    'ALL (*)':        'ВСЁ (*)',
    'Safe only':      'Только безопасные',
    'Safe levels':    'Безопасные уровни',
    'Ammo types':     'Типы боеприпасов',
    'Hand types':     'Слоты оружия',
    'Load <b>ammo.yml</b> in Stats → Ammo Types for type picker. Fallback: one <code>TYPE weight%</code> per line.':
      'Загрузите <b>ammo.yml</b> в Статы → Типы боеприпасов. Запасной режим: один <code>TYPE weight%</code> на строку.',
    'Load <b>hand.yml</b> in Stats → Hand Types for type picker. Fallback: one <code>TYPE weight%</code> per line.':
      'Загрузите <b>hand.yml</b> в Статы → Слоты оружия. Запасной режим: один <code>TYPE weight%</code> на строку.',
    'Allowed classes':'Разрешённые классы',
    'Banned classes': 'Запрещённые классы',
    'at level 1 the stat can roll 1–10.': 'на уровне 1 стат может выпасть 1–10.',
    'One enchantment per line — e.g.': 'Одна чара на строку — напр.',
    'One trim per line — e.g.': 'Одна окантовка на строку — напр.',
    'Requires MC 1.20+.': 'Требует MC 1.20+.',
    'Random':         'Случайно',
    'Base colors':    'Базовые цвета',
    'Pattern colors': 'Цвета узоров',
    'Patterns':       'Узоры',
    'Weight % for':   'Вес % для',
    'id, press Enter':'id, нажмите Enter',
    'section to add.':'секцию, чтобы добавить.',

    // ─── Item Generator (header + folders) ─────────────────────────
    'Drag to move to another folder': 'Перетащить в другую папку',
    'Active damage types':   'Активные типы урона',
    'Active defense types':  'Активные типы защиты',
    'Active item stats':     'Активные статы предмета',
    'Max GEM sockets':       'Макс. сокетов GEM',
    'Max ESSENCE sockets':   'Макс. сокетов ESSENCE',
    'Max RUNE sockets':      'Макс. сокетов RUNE',
    'Folder':                'Папка',
    'folder (optional)':     'папка (опц.)',

    // ─── Templates ─────────────────────────────────────────────────
    'Empty':          'Пусто',
    'Delete selected template': 'Удалить выбранный шаблон',
    'Full template':  'Полный шаблон',
    'Weapon':         'Оружие',
    'Armor':          'Броня',
    'Wild Cat (4-piece armor)': 'Wild Cat (4-секционная броня)',
    'Agility Nugget': 'Самородок ловкости',
    'Defense Nugget': 'Самородок защиты',
    'Health Emerald': 'Изумруд здоровья',
    'Damage Diamond': 'Алмаз урона',
    'Light Trail':    'Световой след',
    'Magic Helix':    'Магическая спираль',
    'Jump Rune':      'Руна прыжка',
    'Absorption Rune':'Руна поглощения',
    'Strength Rune':  'Руна силы',
    'Speed Rune':     'Руна скорости',
    'Resistance Rune':'Руна сопротивления',
    'Luck Rune':      'Руна удачи',
    'Piercing Arrow': 'Пробивающая стрела',
    'Flame Arrow':    'Огненная стрела',
    'Explosive Snowball':'Взрывной снежок',
    'Explosive Arrow':'Взрывная стрела',
    'Loot Potion':    'Зелье лута',
    'Health Potion':  'Зелье здоровья',
    'Burger':         'Бургер',
    'Basic Item':     'Базовый предмет',

    // ─── Sets ──────────────────────────────────────────────────────
    'Set name':       'Имя сета',
    'Prefix':         'Префикс',
    'Suffix':         'Суффикс',
    'Color active':   'Цвет активный',
    'Color inactive': 'Цвет неактивный',
    'Element names support <code>%prefix%</code> and <code>%suffix%</code> — preview shown per element below.':
      'Имена элементов поддерживают <code>%prefix%</code> и <code>%suffix%</code> — превью показано для каждого элемента ниже.',
    'Elements':       'Элементы',
    'Elements (JSON)':'Элементы (JSON)',
    'Bonuses (JSON)': 'Бонусы (JSON)',
    'tiers':          'тиров',
    'piece':          'часть',
    'pieces':         'частей',
    'unreachable':    'недостижимо',
    'Tier':           'Тир',
    'elements — will never activate.': 'элементов — никогда не активируется.',
    'Pieces':         'Частей',
    'one value per line — use %c% for active/inactive color':
      'одно значение на строку — используйте %c% для активного/неактивного цвета',
    'active color when tier equipped, inactive color otherwise. Preview shows active color.':
      'активный цвет когда тир надет, иначе неактивный. Превью показывает активный цвет.',

    // ─── Gems / Sockets ────────────────────────────────────────────
    'Socket display': 'Отображение в сокете',
    'Socket category':'Категория сокета',
    'Socket cat.':    'Кат. сокета',
    'Required tier':  'Требуемый тир',
    'Modules (one per line)': 'Модули (один на строку)',
    'Modules':        'Модули',
    'Module IDs or <code>*</code> for all.': 'ID модулей или <code>*</code> для всех.',
    'Module IDs or <code>*</code> for all. Leave empty for no restriction.':
      'ID модулей или <code>*</code> для всех. Пусто = без ограничений.',
    'One module key per line, e.g.': 'Один ключ модуля на строку, напр.',
    'Use <code>*</code> for any.':    'Используйте <code>*</code> для любого.',
    'gem level : uses count.':    'уровень самоцвета : кол-во использований.',
    'gem level : success % range.':'уровень самоцвета : диапазон % успеха.',
    'gem level : allowed item level range.':
      'уровень самоцвета : диапазон допустимого уровня предмета.',
    'level : success % range.':    'уровень : диапазон % успеха.',
    'Uses & success rates': 'Использования и шансы успеха',
    'Uses by level':  'Использования по уровню',
    'Success rate by level': 'Шанс успеха по уровню',
    'Advanced':       'Расширенно',
    'Leather/potion tint.': 'Тон кожи/зелья.',
    'default.':       'по умолчанию.',
    '-1 = disabled':  '-1 = отключено',
    'Target requirements': 'Требования к цели',
    'Item types':     'Типы предметов',
    'WEAPON / ARMOR / * (any).': 'WEAPON / ARMOR / * (любой).',
    'Sockets':        'Сокеты',
    'Socket pool (socket category → chance)': 'Пул сокетов (категория → шанс)',
    'First line is the section title shown to the player (e.g.':
      'Первая строка — заголовок секции для игрока (напр.',
    'Loaded':         'Загружено',
    'items':          'предметы',
    'No':             'Нет',
    'files loaded yet — go to':  'файлов ещё не загружено — перейдите в',
    'module.':        'модуль.',

    // ─── Particle / Essences ───────────────────────────────────────
    'Particle Effect':'Эффект частиц',
    'Base Item':      'Базовый предмет',
    'Potion Effect':  'Эффект зелья',
    'Effects':        'Эффекты',
    'Health restored':    'Восстановление здоровья',
    'Hunger restored':    'Восстановление голода',
    'Saturation restored':'Восстановление сытости',
    'Amplifier (1=Potion I, 2=Potion II…)': 'Усилитель (1=Зелье I, 2=Зелье II…)',
    'Amplifier: 1=Potion I, 2=Potion II. NIGHT_VISION duration auto-extended by server.':
      'Усилитель: 1=Зелье I, 2=Зелье II. Длительность NIGHT_VISION авто-продлевается сервером.',
    'Amplifier = item level − 1.': 'Усилитель = уровень предмета − 1.',
    'Select effect…': 'Выберите эффект…',
    'Potion Effects': 'Эффекты зелий',
    'Bukkit particle name (1.20.5+ naming, e.g. <code>WITCH</code>, <code>BLOCK</code>, <code>HAPPY_VILLAGER</code>) or <code>DUST:R,G,B</code>. Legacy names like <code>SPELL_WITCH</code>/<code>VILLAGER_HAPPY</code>/<code>REDSTONE</code> still work via Codex fallback.':
      'Имя частицы Bukkit (1.20.5+, напр. <code>WITCH</code>, <code>BLOCK</code>, <code>HAPPY_VILLAGER</code>) или <code>DUST:R,G,B</code>. Старые имена типа <code>SPELL_WITCH</code>/<code>VILLAGER_HAPPY</code>/<code>REDSTONE</code> работают через Codex fallback.',

    // ─── Skills / Classes / Ammo / Hand ────────────────────────────
    'Skill name':     'Имя навыка',
    'Skill level':    'Уровень навыка',
    'Chance 0–100':   'Шанс 0–100',
    'Min level':      'Мин. уровень',
    'Max level':      'Макс. уровень',
    'skill name':     'имя навыка',
    'Lore (one line per entry):': 'Лор (одна строка на запись):',
    'Drop set YAML files above, use <b>Load Files</b>, or type a filename and click <b>+ New set</b>.':
      'Перетащите YAML-файлы сетов, используйте <b>Загрузка файлов</b> или введите имя и нажмите <b>+ Новый сет</b>.',
    'These class names appear in item gen → Requirements → Allowed/Banned classes.':
      'Эти имена классов появляются в Генераторе предметов → Требования → Разрешённые/Запрещённые классы.',
    'Rename key':     'Переименовать ключ',
    'NEW_AMMO_KEY (e.g. SNOWBALL)': 'NEW_AMMO_KEY (напр. SNOWBALL)',
    'NEW_HAND_KEY (e.g. ONE / TWO / OFF)': 'NEW_HAND_KEY (напр. ONE / TWO / OFF)',
    'Keys used in item gen ammo-types weights.':
      'Ключи используются в весах ammo-types Генератора предметов.',
    'Keys used in item gen hand-types weights (ONE / TWO / OFF).':
      'Ключи используются в весах hand-types Генератора предметов (ONE / TWO / OFF).',

    // ─── Attributes / Stats / FA ───────────────────────────────────
    'Attribute key':  'Ключ атрибута',
    'Display name':   'Отображаемое имя',
    'display':        'имя',
    'max':            'макс',
    'AttributeKey (e.g. Strength)': 'AttributeKey (напр. Strength)',
    'Lore (icon-lore)':  'Лор (icon-lore)',
    'Stats':             'Статы',
    '(a = attr level, v = current stat)': '(a = уровень атрибута, v = текущий стат)',
    'stat-id formula (one per line)': 'stat-id формула (одна на строку)',
    'attribute level': 'уровень атрибута',
    'current stat value': 'текущее значение стата',

    // ─── Editor / actions / consumables ────────────────────────────
    'Edit to rename': 'Изменить для переименования',
    'Pick color':     'Выбрать цвет',
    'one value per line': 'одно значение на строку',
    'one per line':   'одна на строку',
    'one CMD number per line': 'один CMD номер на строку',
    'MODEL DATA':     'MODEL DATA',
    'DEFAULT':        'DEFAULT',
    'SPECIAL':        'SPECIAL',
    'Action executors':  'Исполнители действий',
    'Target selectors':  'Селекторы целей',
    'Conditions':        'Условия',
    'On conditions fail':'При провале условий',
    'group name':        'имя группы',
    'Cooldown (seconds)':'Перезарядка (сек.)',
    'Actions':           'Действия',
    'Effects':           'Эффекты',
    'On-hit actions':    'Действия при попадании',
    'On-fly actions':    'Действия в полёте',
    'Usage (click actions)': 'Использование (клики)',
    'RIGHT click':       'ПКМ',
    'LEFT click':        'ЛКМ',
    'Variables by level':'Переменные по уровню',
    'User requirements by level': 'Требования к игроку по уровню',
    'Class requirements':'Требования к классу',
    'Separate multiple classes with a comma. Leave empty to allow all classes.':
      'Разделяйте классы запятой. Пусто = все классы разрешены.',
    'Classes blocked from using this item at that level.':
      'Классы, которым запрещено использовать предмет на данном уровне.',
    'Reference as <code>%var_varName%</code> in lore/actions.':
      'Используйте как <code>%var_varName%</code> в лоре/действиях.',

    // ─── Arrows / Armor Trim ───────────────────────────────────────
    'Armor Trim':     'Окантовка брони',
    'Operations':     'Операции',
    'Slots':          'Слоты',
    'Attributes':     'Атрибуты',

    // ─── Build Preview ─────────────────────────────────────────────
    'Builder':        'Конструктор',
    'Combat Test':    'Боевой тест',
    'Weapon':         'Оружие',
    'Off-hand':       'Доп. рука',
    'Helmet':         'Шлем',
    'Chestplate':     'Нагрудник',
    'Leggings':       'Поножи',
    'Boots':          'Ботинки',
    'Item level range':       'Диапазон уровней предмета',
    'No item generator files loaded — go to <b>Load Files</b> first.':
      'Файлы генератора предметов не загружены — сперва перейдите в <b>Загрузка файлов</b>.',

    // ─── Settings & Export ─────────────────────────────────────────
    'Export':         'Экспорт',
    'Import snapshot':'Импорт снимка',
    'Auto-save':      'Авто-сохранение',
    'Save interval (minutes)': 'Интервал (минуты)',
    'Save directory': 'Папка сохранения',
    'Select directory…': 'Выбрать папку…',
    'Change (current:': 'Изменить (текущая:',
    'No directory selected.': 'Папка не выбрана.',
    'Files will be saved to:':'Файлы будут сохранены в:',
    'File System Access API is not supported in this browser. YAML auto-save will trigger individual downloads instead. Use Chrome or Edge for directory-based saving.':
      'File System Access API не поддерживается. YAML авто-сохранение будет скачивать файлы по одному. Используйте Chrome или Edge для сохранения в папку.',
    'Stop auto-save': 'Остановить авто-сохранение',
    'Auto-save disabled (interval = 0).': 'Авто-сохранение выключено (интервал = 0).',
    'No directory selected — will download a JSON snapshot instead.':
      'Папка не выбрана — будет скачан JSON-снимок.',
    'Last saved':     'Сохранено',
    'Auto-saving every': 'Авто-сохранение каждые',
    'min':            'мин.',
    'YAML (individual files)': 'YAML (отдельные файлы)',
    'JSON snapshot':  'JSON снимок',
    '0 = disabled':   '0 = выключено',
    'Download all currently-loaded sections as a single JSON snapshot. You can re-import it later to restore the full editor state in one click.':
      'Скачать все загруженные секции одним JSON-снимком. Можно потом импортировать для восстановления состояния редактора одним кликом.',
    'No files loaded yet. Load YAML files in <b>Load Files</b> first.':
      'Файлы ещё не загружены. Сперва загрузите YAML в <b>Загрузка файлов</b>.',
    'Includes all':   'Включает все',
    'loaded section(s).': 'загруженных секций.',
    'Load a previously exported JSON snapshot. Restores all sections at once.':
      'Загрузить ранее экспортированный JSON-снимок. Восстанавливает все секции сразу.',
    'Load JSON snapshot': 'Загрузить JSON снимок',

    // ─── Misc top-level UI ─────────────────────────────────────────
    'Edit fields directly. Changes are in memory until downloaded.':
      'Редактируйте поля напрямую. Изменения в памяти, пока не скачаны.',
    'Search…':        'Поиск…',
    'Unknown section':'Неизвестная секция',
    'Missing renderer':'Отсутствует рендерер',
    'Render error':   'Ошибка рендера',
    'Load error':     'Ошибка загрузки',
    'Start with empty file': 'Начать с пустого файла',
    'Start with empty file anyway': 'Всё равно начать с пустого файла',
    'in <b>Load Files</b> first.': 'в <b>Загрузке файлов</b>.',
    'Start empty':    'Пустой старт',
    'Start editing without a file': 'Редактировать без файла',
    '(folder — drop files)': '(папка — перетащите файлы)',

    // ─── Alerts / prompts ──────────────────────────────────────────
    'Save failed: ': 'Ошибка сохранения: ',
    'Load failed: ': 'Ошибка загрузки: ',
    'Key':            'Ключ',
    'Entry':          'Запись',
    'already exists.':'уже существует.',
    'already exists. Overwrite?': 'уже существует. Перезаписать?',
    'No entries found. Load the relevant stats section first (Damage, Defense, Penetration, etc.).':
      'Записи не найдены. Сперва загрузите соответствующую секцию (Урон, Защита, Пробитие и т.д.).',
    'Select a template to delete first.': 'Сперва выберите шаблон для удаления.',
    'To remove a file template, delete the file itself.': 'Чтобы удалить файловый шаблон, удалите сам файл.',
    'Delete template':'Удалить шаблон',
    'Template name (used in the template dropdown):': 'Имя шаблона (для выпадающего списка):',
    'Template':       'Шаблон',
    'Invalid snapshot: missing "sections" key.': 'Неверный снимок: отсутствует ключ "sections".',
    'Imported':       'Импортировано',
    'section(s) from snapshot (v': 'секций из снимка (v',
    'exported':       'экспортировано',
    'unknown':        'неизвестно',
    'Failed to parse JSON: ': 'Ошибка разбора JSON: ',
    'File System Access API is not supported in this browser.\nUse Chrome or Edge.':
      'File System Access API не поддерживается.\nИспользуйте Chrome или Edge.',
    'Could not open directory: ': 'Не удалось открыть папку: ',
    'Save already in progress — please wait.': 'Сохранение уже идёт — подождите.',
    'Nothing to save — no YAML files are loaded yet.': 'Нечего сохранять — YAML-файлы не загружены.',

    // ─── Build mode (vanilla / modded) ─────────────────────────────
    'Build mode':       'Режим сборки',
    'Vanilla':          'Ваниль',
    'Modded (Lotus)':   'Моддед (Lotus)',
    'Vanilla = base Divinity. Modded (Lotus) = full feature set with buffs/penetration/custom formula.':
      'Ваниль = базовый Divinity. Моддед (Lotus) = полный набор функций с бафами/пробитием/своей формулой.',
    'CUSTOM formula is set but disabled in Vanilla mode. Switch to FACTOR or LEGACY, or change build mode to Modded.':
      'Формула CUSTOM установлена, но отключена в режиме Ваниль. Переключите на FACTOR или LEGACY, либо смените режим сборки на Моддед.',
    'Stats':            'Статы',

    // ─── Engine.yml — overflow ─────────────────────────────────────
    'Flat penetration overflow':  'Переполнение плоского пробития',
    'Negative-defense overflow':  'Переполнение отрицательной защиты',
    '(CUSTOM only)':              '(только CUSTOM)',
    'Amplify damage on overflow': 'Усиливать урон при переполнении',
    'flatPen > total defense → bonus damage': 'flatPen > общая защита → бонусный урон',
    'total def < 0 → bonus damage':           'общая защита < 0 → бонусный урон',
  },
};

/**
 * Translate a string. Returns the input unchanged for LANG === 'en'
 * or if no translation is found.
 *
 * @param {string} text — English source string.
 * @returns {string} Translated string, or `text` itself as fallback.
 */
function T(text) {
  if (LANG === 'en' || !text) return text;
  const dict = TRANSLATIONS[LANG];
  if (!dict) return text;
  return dict[text] ?? text;
}

/**
 * Build the language switcher HTML (rendered inside the nav).
 */
function buildLangSwitcher() {
  const opts = SUPPORTED_LANGS.map(code =>
    `<button class="lang-btn${code === LANG ? ' active' : ''}"
             onclick="APP.setLang('${code}')">${code.toUpperCase()}</button>`
  ).join('');
  return `<div class="lang-switch" title="${T('Language')}">${opts}</div>`;
}
