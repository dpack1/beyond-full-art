import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

function svgUri(body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const images = {
  voss: svgUri(`
    <rect width="160" height="160" fill="#3a2a24"/>
    <path d="M20 150 L40 70 Q80 28 120 70 L140 150 Z" fill="#1c242b"/>
    <circle cx="80" cy="68" r="22" fill="#e6c2a2"/>
    <path d="M48 62 Q80 18 112 62 Q96 48 80 50 Q64 48 48 62 Z" fill="#2a211c"/>
    <rect x="58" y="92" width="44" height="8" fill="#c5312d"/>
  `),
  gate: svgUri(`
    <rect width="160" height="160" fill="#1b242b"/>
    <rect x="0" y="110" width="160" height="50" fill="#3d4a3a"/>
    <path d="M28 120 V48 h104 v72" fill="none" stroke="#c5b59a" stroke-width="10"/>
    <path d="M38 48 Q80 8 122 48" fill="none" stroke="#c5b59a" stroke-width="10"/>
    <rect x="70" y="78" width="20" height="42" fill="#0e1418"/>
    <circle cx="118" cy="28" r="8" fill="#f0d48a"/>
  `),
  map: svgUri(`
    <rect width="160" height="160" fill="#faf6ea"/>
    <path d="M16 120 C50 90 70 140 110 80 S150 40 150 30" fill="none" stroke="#0c5f8c" stroke-width="4"/>
    <path d="M20 40 H140 M30 70 H120 M24 100 H130" stroke="#6e5414" stroke-width="2" opacity="0.45"/>
    <circle cx="108" cy="78" r="6" fill="#c5312d"/>
  `),
};

const allRows = [
  {
    type: 'Session',
    title: 'Session · October 20, 2026',
    preview: '20:17 Bought a map from Voss.',
    mention: 1,
  },
  {
    type: 'NPC',
    title: 'Voss',
    preview: 'Sells maps at the Old Gate. Owes me nothing.',
    mention: 3,
    thumb: 'voss',
  },
  {
    type: 'Unsorted',
    title: 'Old Gate',
    preview: '',
    mention: 1,
    needs: true,
  },
  {
    type: 'Item',
    title: "Voss's map",
    preview: 'A folded map of the coast road.',
    mention: 2,
    thumb: 'map',
  },
  {
    type: 'Quest',
    title: 'The coast road',
    preview: 'Reach the lighthouse before the tide.',
    mention: 1,
  },
  {
    type: 'Backstory',
    title: 'Where I came from',
    preview: 'I left the harbor with one name and a debt.',
  },
  {
    type: 'Unsorted',
    title: 'Loose page',
    preview: 'A note from before I sorted anything.',
  },
  {
    type: 'Place',
    title: 'North wall',
    preview: 'The gate is the only way through after dark.',
    mention: 1,
  },
];

const counts = [
  ['All', 8],
  ['Sessions', 1],
  ['NPCs', 1],
  ['Places', 1],
  ['Items', 1],
  ['Quests', 1],
  ['Backstory', 1],
];

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function header() {
  return `
    <header class="sheet-header">
      <div class="portrait" role="img" aria-label="Portrait of Mira Thorn"></div>
      <div class="identity">
        <h1>Mira Thorn</h1>
        <p>Human · Ranger 5</p>
      </div>
      <button class="button manage" type="button">Manage</button>
    </header>`;
}

function tabs() {
  const labels = ['Actions', 'Spells', 'Inventory', 'Features &amp; Traits', 'Background', 'Notes', 'Extras', 'Journal'];
  const buttons = labels.map((label) => {
    const selected = label === 'Journal';
    return `<button class="tab" type="button" role="tab" aria-selected="${selected ? 'true' : 'false'}">${label}</button>`;
  }).join('');
  return `<div class="tablist" role="tablist">${buttons}</div>`;
}

function chips(selected, countOverride, hideCounts = false) {
  const buttons = counts.map(([label, count]) => {
    const shown = hideCounts ? '' : ` ${countOverride?.[label] ?? count}`;
    const checked = label === selected;
    return `<button class="chip" type="button" role="radio" aria-checked="${checked ? 'true' : 'false'}">${label}${shown}</button>`;
  }).join('');
  return `<div class="chips" role="radiogroup" aria-label="Categories">${buttons}</div>`;
}

function row(entry) {
  const tags = [`<span class="tag">${escapeHtml(entry.type)}</span>`];
  if (entry.needs) {
    tags.push('<span class="tag tag-needs">Needs details</span>');
  }
  const preview = entry.preview
    ? `<span class="row-preview">${escapeHtml(entry.preview)}</span>`
    : '';
  const mention = entry.mention
    ? `<span class="row-mention">Mentioned in ${entry.mention}</span>`
    : '';
  const thumb = entry.thumb
    ? `<img class="thumb" alt="" src="${images[entry.thumb]}">`
    : '<span class="thumb-slot"></span>';
  const name = [
    entry.type,
    entry.title,
    entry.needs ? 'needs details' : '',
  ].filter(Boolean).join(', ');
  return `
    <button class="row" type="button" aria-label="${escapeHtml(name)}">
      <span class="row-main">
        <span class="row-titleline">${tags.join('')}<span class="row-title">${escapeHtml(entry.title)}</span></span>
        ${preview}
        ${mention}
      </span>
      ${thumb}
    </button>`;
}

function rows(list) {
  if (list.length === 0) {
    return '';
  }
  return `<div class="rows">${list.map(row).join('')}</div>`;
}

function quickNote({ value = '', focused = false, listbox = '' } = {}) {
  const focus = focused ? ' is-focused' : '';
  return `
    <form class="quick-note" action="#">
      <input class="field${focus}" type="text" aria-label="Note for today's session" placeholder="Note for today's session" value="${escapeHtml(value)}">
      <button class="button button-primary" type="button">File note</button>
      ${listbox}
    </form>`;
}

function searchRow({ value = '', menu = '' } = {}) {
  return `
    <div class="search-row">
      <input class="search-input" type="search" aria-label="Search notes" placeholder="Search notes" value="${escapeHtml(value)}">
      <button class="button" type="button" aria-haspopup="menu" aria-expanded="${menu ? 'true' : 'false'}">New note</button>
      ${menu}
    </div>`;
}

function typeMenu() {
  const types = ['Session', 'NPC', 'Place', 'Item', 'Quest', 'Backstory'];
  return `
    <div class="menu" role="menu" aria-label="New note">
      <div class="menu-label">New note</div>
      ${types.map((type) => `<button type="button" role="menuitem">${type}</button>`).join('')}
    </div>`;
}

function linkListbox(items, createLabel) {
  const options = items.map((item, index) => `
    <button type="button" role="option" aria-selected="${index === 0 ? 'true' : 'false'}">
      <span class="option-type">${escapeHtml(item.type)}</span>${escapeHtml(item.title)}
    </button>`).join('');
  return `
    <div class="listbox" role="listbox" aria-label="Notes">
      ${options}
      <button class="create" type="button" role="option">Create “${escapeHtml(createLabel)}”</button>
    </div>`;
}

function journal({
  note = {},
  search = {},
  selected = 'All',
  countOverride,
  list = allRows,
  notice = '',
  status = '',
  empty = '',
  hideCounts = false,
}) {
  return `
    <section class="journal" aria-label="Journal">
      ${quickNote(note)}
      ${status}
      ${searchRow(search)}
      ${chips(selected, countOverride, hideCounts)}
      ${notice}
      ${empty}
      ${rows(list)}
    </section>`;
}

function closeButton() {
  return `<button class="icon-button close" type="button" aria-label="Close"><span aria-hidden="true">×</span></button>`;
}

function panelShell({
  title,
  editLabel = 'Edit',
  back = false,
  tags = '',
  status = '',
  statusClass = '',
  body,
}) {
  const backButton = back
    ? '<button class="button back" type="button">Back</button>'
    : '';
  const statusHtml = status
    ? `<span class="save-status ${statusClass}">${status}</span>`
    : '';
  return `
    <div class="scrim"></div>
    <section class="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
      <header class="panel-header${back ? ' has-back' : ''}">
        ${closeButton()}
        ${backButton}
        <h2 class="panel-title" id="panel-title">${escapeHtml(title)}</h2>
        <button class="button edit" type="button">${editLabel}</button>
        <div class="panel-meta">${tags}${statusHtml}</div>
      </header>
      <div class="panel-body">
        ${body}
      </div>
    </section>`;
}

function readProse() {
  return `
    <div class="prose">
      <h2>What happened</h2>
      <p>We reached the <button class="wikilink is-unresolved" type="button">Old Gate</button> after dark. <button class="wikilink" type="button">Voss</button> sold us a map.</p>
      <h2>Promises</h2>
      <ul>
        <li class="task"><input type="checkbox" aria-label="Pay Voss when the map proves true"> <span>Pay Voss when the map proves true</span></li>
      </ul>
      <h2>Loot</h2>
      <figure class="figure">
        <img alt="gate.png" src="${images.gate}">
        <figcaption>gate.png</figcaption>
      </figure>
    </div>
    <div class="strip" aria-label="Images">
      <div class="tile">
        <button class="tile-open" type="button" aria-label="View gate.png" style="appearance:none;background:transparent;border:0;padding:0;cursor:pointer">
          <img alt="" src="${images.gate}">
        </button>
        <span class="tile-name">gate.png</span>
      </div>
    </div>
    <section class="mentioned">
      <h3>Mentioned in</h3>
      <button class="mention" type="button"><span class="tag">Item</span><span class="mention-title">Voss's map</span></button>
    </section>`;
}

function editBody({ saving = true, error = '', listbox = '', imageError = false, value }) {
  const text = value ?? `## Who they are to me\n\n## Where\n\n## What they want\n\n## We owe / they owe\n\n## My suspicions\n`;
  const status = error
    ? `<p class="banner is-error" role="alert">${error}</p>`
    : '';
  const image = imageError
    ? `<p class="banner is-error" role="alert">That image is over 3 MB. The note was not changed.</p>`
    : '';
  const strip = imageError
    ? `<div class="strip" aria-label="Images">
        <div class="tile">
          <img alt="" src="${images.gate}">
          <span class="tile-name">gate.png</span>
          <button class="tile-remove" type="button">Remove</button>
        </div>
      </div>`
    : '';
  return `
    ${status}
    ${image}
    <div class="toolbar" role="toolbar" aria-label="Formatting">
      <button class="button" type="button">Bold</button>
      <button class="button" type="button">Italic</button>
      <button class="button" type="button">Heading</button>
      <button class="button" type="button">List</button>
      <button class="button" type="button">Checkbox</button>
      <button class="button" type="button">Link</button>
      <button class="button" type="button">Image</button>
    </div>
    <div class="editor">
      <textarea class="textarea" aria-label="Note text">${escapeHtml(text)}</textarea>
      ${listbox}
    </div>
    ${strip}
    <div class="panel-footer">
      <button class="button button-danger" type="button">Delete note</button>
    </div>`;
}

function confirmBox({ text, keep, danger, focused = true }) {
  return `
    <div class="confirm" role="alertdialog" aria-label="${escapeHtml(text)}">
      <p>${escapeHtml(text)}</p>
      <div class="confirm-actions">
        <button class="button${focused ? ' is-focused' : ''}" type="button">${keep}</button>
        <button class="button button-danger" type="button">${danger}</button>
      </div>
    </div>`;
}

function screenFrame(inner, { panel = '' } = {}) {
  return `${header()}${tabs()}${inner}${panel}`;
}

const screens = [];

function add(id, caption, width, theme, inner, panel = '') {
  screens.push({ id: `${id}-${theme}`, caption: `${caption} · ${theme}`, width, theme, inner, panel });
}

const themes = ['light', 'dark'];

for (const theme of themes) {
  add('list-populated', 'Journal list, notes filed', 'desktop', theme, journal({
    notice: '<p class="notice">Earlier notes are uncategorized.</p>',
  }));

  add('list-empty', 'Journal list, no notes', 'desktop', theme, journal({
    list: [],
    empty: '<p class="empty">No notes</p>',
    countOverride: { All: 0, Sessions: 0, NPCs: 0, Places: 0, Items: 0, Quests: 0, Backstory: 0 },
  }));

  add('list-search', 'Search matches titles', 'desktop', theme, journal({
    search: { value: 'voss' },
    list: allRows.filter((entry) => entry.title.toLowerCase().includes('voss') || entry.preview.toLowerCase().includes('voss')),
  }));

  add('list-no-matches', 'Search with no matches', 'desktop', theme, journal({
    search: { value: 'lighthouse keeper' },
    list: [],
    empty: '<p class="empty">No matches</p>',
  }));

  add('list-filter', 'NPCs category', 'desktop', theme, journal({
    selected: 'NPCs',
    list: allRows.filter((entry) => entry.type === 'NPC'),
  }));

  add('list-empty-category', 'Empty category', 'desktop', theme, journal({
    selected: 'Quests',
    list: [],
    empty: '<p class="empty">No quests</p>',
    countOverride: { Quests: 0, All: 7 },
  }));

  add('list-new-note', 'New note type menu', 'desktop', theme, journal({
    search: { menu: typeMenu() },
  }));

  add('list-autocomplete', 'Quick note autocomplete', 'desktop', theme, journal({
    note: {
      value: 'Told [[Mara',
      listbox: linkListbox([], 'Mara'),
    },
  }));

  add('list-file-error', 'Quick note failed to file', 'desktop', theme, journal({
    note: { value: 'The lighthouse light went out.' },
    status: '<p class="status-line is-error" role="alert">That note could not be filed. It is still in the field.</p>',
  }));

  add('list-focus', 'Focus ring on the quick note', 'desktop', theme, journal({
    note: { focused: true },
  }));

  add('list-loading', 'Notes loading', 'desktop', theme, journal({
    list: [],
    empty: '<p class="status-line">Loading notes</p>',
    hideCounts: true,
  }));

  add('list-migration-error', 'Migration left notes unchanged', 'desktop', theme, journal({
    list: [],
    notice: '<p class="banner is-error" role="alert">Your existing notes were left unchanged.</p>',
    hideCounts: true,
  }));

  const listUnderPanel = journal({
    notice: '<p class="notice">Earlier notes are uncategorized.</p>',
  });

  add('panel-read', 'Read panel', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Session · October 20, 2026',
    tags: '<span class="tag">Session</span>',
    status: 'Saved',
    statusClass: 'is-saved',
    body: readProse(),
  }));

  add('panel-placeholder', 'Placeholder needs details', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Old Gate',
    back: true,
    tags: '<span class="tag">Unsorted</span><span class="tag tag-needs">Needs details</span>',
    status: 'Saved',
    statusClass: 'is-saved',
    body: `
      <section class="mentioned">
        <h3>Mentioned in</h3>
        <button class="mention" type="button"><span class="tag">Session</span><span class="mention-title">Session · October 20, 2026</span></button>
      </section>`,
  }));

  add('panel-edit', 'Edit panel, saving', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Voss',
    editLabel: 'Done editing',
    tags: '<span class="tag">NPC</span>',
    status: 'Saving…',
    statusClass: 'is-saving',
    body: editBody({}),
  }));

  add('panel-error', 'Storage full, draft kept', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Voss',
    editLabel: 'Done editing',
    tags: '<span class="tag">NPC</span>',
    status: 'Not saved',
    statusClass: 'is-error',
    body: editBody({ error: 'Storage is full. This note is still on screen.' }),
  }));

  add('panel-stale', 'Note changed in another window', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Session · October 20, 2026',
    editLabel: 'Done editing',
    tags: '<span class="tag">Session</span>',
    status: 'Not saved',
    statusClass: 'is-error',
    body: `
      <div class="banner" role="alert">
        <p>This note was updated in another window. Your draft is still here.</p>
        <div class="banner-actions"><button class="button" type="button">Reload saved note</button></div>
      </div>
      ${confirmBox({
        text: 'Replace this draft with the saved note?',
        keep: 'Keep draft',
        danger: 'Replace draft',
      })}
      ${editBody({})}`,
  }));

  add('panel-discard', 'Discard confirm', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Voss',
    editLabel: 'Done editing',
    tags: '<span class="tag">NPC</span>',
    status: 'Not saved',
    statusClass: 'is-error',
    body: `${confirmBox({
      text: 'This note is not saved yet.',
      keep: 'Keep editing',
      danger: 'Discard',
    })}${editBody({})}`,
  }));

  add('panel-delete', 'Delete confirm', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Voss',
    tags: '<span class="tag">NPC</span>',
    status: 'Saved',
    statusClass: 'is-saved',
    body: `${confirmBox({
      text: 'Delete this note?',
      keep: 'Keep note',
      danger: 'Delete note',
    })}${readProse()}`,
  }));

  add('panel-autocomplete', 'Editor wikilink autocomplete', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Session · October 20, 2026',
    editLabel: 'Done editing',
    tags: '<span class="tag">Session</span>',
    status: 'Saved',
    statusClass: 'is-saved',
    body: editBody({
      value: 'We reached the gate. [[Vo',
      listbox: linkListbox([
        { type: 'NPC', title: 'Voss' },
        { type: 'Item', title: "Voss's map" },
      ], 'Vo'),
    }),
  }));

  add('panel-duplicate', 'Two notes share a name', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Session · October 18, 2026',
    tags: '<span class="tag">Session</span>',
    status: 'Saved',
    statusClass: 'is-saved',
    body: `
      <div class="prose">
        <p>I asked <button class="wikilink" type="button">Marcus</button> which road was safe.</p>
        <div class="picker">
          <p>Two notes are named Marcus</p>
          <button type="button"><span class="tag">NPC</span><span class="mention-title">Marcus</span><span class="picker-date">Oct 12, 2026</span></button>
          <button type="button"><span class="tag">NPC</span><span class="mention-title">Marcus</span><span class="picker-date">Sep 3, 2026</span></button>
        </div>
      </div>`,
  }));

  add('panel-character', 'Open note belongs to another character', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Voss',
    editLabel: 'Done editing',
    tags: '<span class="tag">NPC</span>',
    status: 'Not saved',
    statusClass: 'is-error',
    body: `
      <div class="banner is-error" role="alert">
        <p>This note belongs to another character. It will not be saved on this sheet.</p>
        <div class="banner-actions"><button class="button" type="button">Discard</button></div>
      </div>
      ${editBody({ value: '## Who they are to me\n\nSells maps. Still owes me a name for the north road.\n' })}`,
  }));

  add('panel-image', 'Image kept, oversized file rejected', 'desktop', theme, listUnderPanel, panelShell({
    title: 'Session · October 20, 2026',
    editLabel: 'Done editing',
    tags: '<span class="tag">Session</span>',
    status: 'Saved',
    statusClass: 'is-saved',
    body: editBody({
      imageError: true,
      value: '## Loot\n\nThe folded map.\n\n![gate.png](bfa-journal-image:img-gate)\n',
    }),
  }));

  add('phone-list', 'Phone journal list', 'phone', theme, journal({
    notice: '<p class="notice">Earlier notes are uncategorized.</p>',
  }));

  add('phone-empty', 'Phone, no notes', 'phone', theme, journal({
    list: [],
    empty: '<p class="empty">No notes</p>',
    countOverride: { All: 0, Sessions: 0, NPCs: 0, Places: 0, Items: 0, Quests: 0, Backstory: 0 },
  }));

  add('phone-panel-read', 'Phone read panel', 'phone', theme, journal({}), panelShell({
    title: 'Session · October 20, 2026',
    tags: '<span class="tag">Session</span>',
    status: 'Saved',
    statusClass: 'is-saved',
    body: readProse(),
  }));

  add('phone-panel-edit', 'Phone edit panel', 'phone', theme, journal({}), panelShell({
    title: 'Voss',
    editLabel: 'Done editing',
    tags: '<span class="tag">NPC</span>',
    status: 'Saving…',
    statusClass: 'is-saving',
    body: editBody({}),
  }));

  add('phone-panel-discard', 'Phone discard confirm', 'phone', theme, journal({}), panelShell({
    title: 'Voss',
    editLabel: 'Done editing',
    tags: '<span class="tag">NPC</span>',
    status: 'Not saved',
    statusClass: 'is-error',
    body: confirmBox({
      text: 'This note is not saved yet.',
      keep: 'Keep editing',
      danger: 'Discard',
    }),
  }));
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Character Journal v2 mockups</title>
  <link rel="stylesheet" href="mockup.css">
</head>
<body>
  <header class="gallery-intro">
    <h1>Character Journal v2</h1>
    <p>Static mockups of the player journal on a D&amp;D Beyond character sheet. Each frame sets the sheet theme itself. Nothing here follows the operating system appearance.</p>
  </header>
  ${screens.map((screen) => `
  <section class="shot-block">
    <p class="shot-caption">${escapeHtml(screen.caption)}</p>
    <div class="viewport" data-width="${screen.width}" data-shot="${screen.id}" data-theme="${screen.theme}">
      <div class="sheet" data-theme="${screen.theme}">
        ${screenFrame(screen.inner, { panel: screen.panel })}
      </div>
    </div>
  </section>`).join('\n')}
</body>
</html>
`;

writeFileSync(join(root, 'index.html'), html);
console.log(`Wrote ${screens.length} screens`);
