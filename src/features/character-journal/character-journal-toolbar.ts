import {
  SHEET_FILTER_SVG_MARKUP,
  SHEET_MANAGE_BUTTON_CLASS,
  SHEET_MANAGE_BUTTON_CONTENT_CLASS,
  SHEET_MANAGE_BUTTON_SELECTOR,
  SHEET_SECTION_FILTER_BOX_CLASS,
  SHEET_SECTION_FILTER_BUTTON_CLASS,
  SHEET_SECTION_FILTER_BUTTON_SELECTOR,
  SHEET_SECTION_FILTER_CALLOUT_CLASS,
  SHEET_SECTION_FILTER_FIELD_CLASS,
  SHEET_SECTION_FILTER_ICON_CLASS,
  SHEET_SECTION_FILTER_ICON_GROUP_CLASS,
  SHEET_SECTION_FILTER_INPUT_CLASS,
  SHEET_SECTION_FILTER_PRIMARY_CLASS,
  SHEET_SECTION_FILTER_ROW_CLASS,
  SHEET_SECTION_FILTER_SELECTOR,
} from '../../platform/dndbeyond/selectors';

export interface SectionToolbarChrome {
  filterButton: HTMLElement;
  manageButton: HTMLButtonElement;
  row: HTMLElement;
  searchField: HTMLInputElement;
}

const JOURNAL_ROOT = '.bfa-character-journal-section, .bfa-journal-panel, [data-bfa-journal-native-chrome]';

export function createSectionToolbar(doc: Document): SectionToolbarChrome {
  const live = findLiveFilterRow(doc);
  return live === null ? buildSectionToolbar(doc) : prepareLiveToolbar(live, doc);
}

function buildSectionToolbar(doc: Document): SectionToolbarChrome {
  const row = element(doc, 'div', SHEET_SECTION_FILTER_ROW_CLASS);
  const box = element(doc, 'div', SHEET_SECTION_FILTER_BOX_CLASS);
  const primary = element(doc, 'div', SHEET_SECTION_FILTER_PRIMARY_CLASS);
  const iconGroup = element(doc, 'div', SHEET_SECTION_FILTER_ICON_GROUP_CLASS);
  iconGroup.append(element(doc, 'div', SHEET_SECTION_FILTER_ICON_CLASS));
  const field = element(doc, 'div', SHEET_SECTION_FILTER_FIELD_CLASS);
  const searchField = doc.createElement('input');
  searchField.className = SHEET_SECTION_FILTER_INPUT_CLASS;
  searchField.type = 'search';
  field.append(searchField);
  primary.append(iconGroup, field);
  box.append(primary);

  const filterButton = element(doc, 'div', SHEET_SECTION_FILTER_BUTTON_CLASS);
  filterButton.innerHTML = SHEET_FILTER_SVG_MARKUP;

  const manageButton = createManageButton(doc);
  const callout = element(doc, 'div', SHEET_SECTION_FILTER_CALLOUT_CLASS);
  callout.append(manageButton);
  row.append(box, filterButton, callout);
  return finishToolbar(row, searchField, filterButton, manageButton);
}

function prepareLiveToolbar(live: HTMLElement, doc: Document): SectionToolbarChrome {
  const row = live.cloneNode(true);
  if (!(row instanceof HTMLElement)) {
    return buildSectionToolbar(doc);
  }
  for (const node of row.querySelectorAll('[id]')) {
    node.removeAttribute('id');
  }
  const searchField = row.querySelector('input');
  const filterButton = row.querySelector(SHEET_SECTION_FILTER_BUTTON_SELECTOR);
  if (!(searchField instanceof HTMLInputElement) || !(filterButton instanceof HTMLElement)) {
    return buildSectionToolbar(doc);
  }
  searchField.value = '';
  for (const extra of filterButton.querySelectorAll('span')) {
    extra.remove();
  }
  let manageButton = row.querySelector('button');
  if (!(manageButton instanceof HTMLButtonElement)) {
    const sample = doc.querySelector(SHEET_MANAGE_BUTTON_SELECTOR);
    manageButton = sample instanceof HTMLButtonElement
      ? sample.cloneNode(true) as HTMLButtonElement
      : createManageButton(doc);
    const callout = element(doc, 'div', calloutClass(row));
    callout.append(manageButton);
    row.append(callout);
  }
  return finishToolbar(row, searchField, filterButton, manageButton);
}

function finishToolbar(
    row: HTMLElement,
    searchField: HTMLInputElement,
    filterButton: HTMLElement,
    manageButton: HTMLButtonElement,
): SectionToolbarChrome {
  row.classList.add('bfa-journal-toolbar-row');
  row.dataset.bfaJournalNativeChrome = 'true';
  searchField.classList.add('bfa-journal-search');
  searchField.type = 'search';
  searchField.placeholder = 'Search';
  searchField.setAttribute('aria-label', 'Search notes');
  searchField.setAttribute('data-bfa-journal-input-class', searchField.className);
  filterButton.classList.add('bfa-journal-filter-button');
  filterButton.setAttribute('role', 'button');
  filterButton.tabIndex = 0;
  filterButton.setAttribute('aria-label', 'Filter');
  filterButton.setAttribute('aria-haspopup', 'true');
  filterButton.setAttribute('aria-expanded', 'false');
  filterButton.setAttribute('aria-controls', 'bfa-journal-filter');
  manageButton.classList.add('bfa-journal-manage');
  manageButton.type = 'button';
  manageButton.setAttribute('data-bfa-journal-button-class', manageButton.className);
  const content = manageButton.querySelector('span');
  if (content === null) {
    manageButton.textContent = 'New Note';
  } else {
    content.textContent = 'New Note';
  }
  return {filterButton, manageButton, row, searchField};
}

function findLiveFilterRow(doc: Document): HTMLElement | null {
  const rows = [...doc.querySelectorAll<HTMLElement>(SHEET_SECTION_FILTER_SELECTOR)]
      .filter((row) => row.closest(JOURNAL_ROOT) === null);
  return rows.find((row) => row.className.includes('extras')) ?? rows[0] ?? null;
}

function createManageButton(doc: Document): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = SHEET_MANAGE_BUTTON_CLASS;
  const content = doc.createElement('span');
  content.className = SHEET_MANAGE_BUTTON_CONTENT_CLASS;
  content.textContent = 'New Note';
  button.append(content);
  return button;
}

function calloutClass(row: HTMLElement): string {
  const name = [...row.classList].find((item) => item.endsWith('__interactions'));
  if (name === undefined) {
    return SHEET_SECTION_FILTER_CALLOUT_CLASS;
  }
  return name.replace(/__interactions$/, '__callout');
}

function element(doc: Document, tag: string, className: string): HTMLElement {
  const node = doc.createElement(tag);
  node.className = className;
  return node;
}
