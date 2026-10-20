import journalStyles from './character-journal.css?raw';
import {normalizeJournalEntryTitle} from './character-journal-types';
import {CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME} from '../../platform/dndbeyond/selectors';

export interface JournalSectionElements {
  addPhotoButton: HTMLButtonElement;
  allFilterButton: HTMLButtonElement;
  bodyInput: HTMLTextAreaElement;
  confirmAcceptButton: HTMLButtonElement;
  confirmCancelButton: HTMLButtonElement;
  confirmRegion: HTMLDivElement;
  confirmText: HTMLParagraphElement;
  closeButton: HTMLButtonElement;
  deleteButton: HTMLButtonElement;
  entryList: HTMLDivElement;
  imageStrip: HTMLDivElement;
  newButton: HTMLButtonElement;
  newestSortButton: HTMLButtonElement;
  oldestSortButton: HTMLButtonElement;
  photoInput: HTMLInputElement;
  photosFilterButton: HTMLButtonElement;
  root: HTMLElement;
  saveButton: HTMLButtonElement;
  searchInput: HTMLInputElement;
  status: HTMLParagraphElement;
  titleInput: HTMLInputElement;
}

export function createJournalElements(doc: Document): JournalSectionElements {
  const root = doc.createElement('section');
  root.className = 'bfa-character-journal-section';
  root.hidden = true;
  root.id = 'bfa-character-journal-section';
  root.setAttribute('aria-label', 'Character journal');

  const header = doc.createElement('header');
  header.className = 'bfa-character-journal-header';
  const headerRow = doc.createElement('div');
  headerRow.className = 'bfa-character-journal-header-row';
  const heading = doc.createElement('h2');
  heading.className = 'bfa-character-journal-heading';
  heading.textContent = 'Journal';
  const closeButton = createButton(
      doc,
      'Close',
      'bfa-character-journal-button bfa-character-journal-close',
  );
  closeButton.setAttribute('aria-label', 'Close journal');
  headerRow.append(heading, closeButton);
  header.append(headerRow);

  const toolbar = doc.createElement('div');
  toolbar.className = 'bfa-character-journal-toolbar';
  const searchInput = doc.createElement('input');
  searchInput.className = 'bfa-character-journal-search';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search notes';
  searchInput.setAttribute('aria-label', 'Search notes');

  const filters = doc.createElement('div');
  filters.className = 'bfa-character-journal-filters';
  const allFilterButton = createButton(doc, 'All notes', 'bfa-character-journal-chip');
  const photosFilterButton = createButton(doc, 'With photos', 'bfa-character-journal-chip');
  allFilterButton.setAttribute('aria-pressed', 'true');
  photosFilterButton.setAttribute('aria-pressed', 'false');
  filters.append(allFilterButton, photosFilterButton);

  const sort = doc.createElement('div');
  sort.className = 'bfa-character-journal-sort';
  const newestSortButton = createButton(doc, 'Newest', 'bfa-character-journal-chip');
  const oldestSortButton = createButton(doc, 'Oldest', 'bfa-character-journal-chip');
  newestSortButton.setAttribute('aria-label', 'Sort notes by newest');
  oldestSortButton.setAttribute('aria-label', 'Sort notes by oldest');
  sort.append(newestSortButton, oldestSortButton);

  const newButton = createButton(
      doc,
      'New entry',
      'bfa-character-journal-button',
  );
  toolbar.append(searchInput, filters, sort, newButton);

  const body = doc.createElement('div');
  body.className = 'bfa-character-journal-body';
  const entryList = doc.createElement('div');
  entryList.className = 'bfa-character-journal-list';
  entryList.setAttribute('aria-label', 'Journal notes');
  const editor = doc.createElement('div');
  editor.className = 'bfa-character-journal-editor';

  const titleInput = doc.createElement('input');
  titleInput.className = 'bfa-character-journal-title-input';
  titleInput.placeholder = normalizeJournalEntryTitle('');
  titleInput.type = 'text';
  titleInput.setAttribute('aria-label', 'Journal entry title');

  const bodyInput = doc.createElement('textarea');
  bodyInput.className = 'bfa-character-journal-body-input';
  bodyInput.placeholder = 'What happened this session?';
  bodyInput.setAttribute('aria-label', 'Journal entry body');

  const imagesPanel = doc.createElement('section');
  imagesPanel.className = 'bfa-character-journal-images';
  imagesPanel.setAttribute('aria-label', 'Note photos');
  const imagesHeader = doc.createElement('div');
  imagesHeader.className = 'bfa-character-journal-images-header';
  const imagesTitle = doc.createElement('h3');
  imagesTitle.className = 'bfa-character-journal-images-title';
  imagesTitle.textContent = 'Photos';
  const addPhotoButton = createButton(
      doc,
      'Add photo',
      'bfa-character-journal-button',
  );
  const photoInput = doc.createElement('input');
  photoInput.className = 'bfa-character-journal-photo-input';
  photoInput.accept = 'image/png,image/jpeg,image/webp';
  photoInput.setAttribute('aria-label', 'Add a journal photo');
  photoInput.type = 'file';
  imagesHeader.append(imagesTitle, addPhotoButton, photoInput);
  const imageStrip = doc.createElement('div');
  imageStrip.className = 'bfa-character-journal-image-strip';
  imagesPanel.append(imagesHeader, imageStrip);

  const status = doc.createElement('p');
  status.className = 'bfa-character-journal-status';
  status.setAttribute('aria-live', 'polite');

  const confirmRegion = doc.createElement('div');
  confirmRegion.className = 'bfa-character-journal-confirm';
  confirmRegion.hidden = true;
  const confirmText = doc.createElement('p');
  confirmText.className = 'bfa-character-journal-confirm-text';
  const confirmActions = doc.createElement('div');
  confirmActions.className = 'bfa-character-journal-confirm-actions';
  const confirmCancelButton = createButton(
      doc,
      'Keep editing',
      'bfa-character-journal-button',
  );
  const confirmAcceptButton = createButton(
      doc,
      'Discard',
      'bfa-character-journal-button bfa-character-journal-button--danger',
  );
  confirmActions.append(confirmCancelButton, confirmAcceptButton);
  confirmRegion.append(confirmText, confirmActions);

  const actions = doc.createElement('div');
  actions.className = 'bfa-character-journal-actions';
  const deleteButton = createButton(
      doc,
      'Delete',
      'bfa-character-journal-button bfa-character-journal-button--danger',
  );
  const saveButton = createButton(
      doc,
      'Save',
      'bfa-character-journal-button bfa-character-journal-button--primary',
  );
  actions.append(deleteButton, saveButton);

  editor.append(
      titleInput,
      bodyInput,
      imagesPanel,
      status,
      confirmRegion,
      actions,
  );
  body.append(entryList, editor);
  root.append(header, toolbar, body);

  return {
    addPhotoButton,
    allFilterButton,
    bodyInput,
    confirmAcceptButton,
    confirmCancelButton,
    confirmRegion,
    confirmText,
    closeButton,
    deleteButton,
    entryList,
    imageStrip,
    newButton,
    newestSortButton,
    oldestSortButton,
    photoInput,
    photosFilterButton,
    root,
    saveButton,
    searchInput,
    status,
    titleInput,
  };
}

export function ensureJournalStyles(doc: Document): void {
  if (
    doc.head.querySelector(`[${CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME}]`) !==
    null
  ) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = journalStyles;
  doc.head.append(styleElement);
}

export function removeJournalStyles(doc: Document): void {
  doc.head.querySelector(`[${CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME}]`)?.remove();
}

function createButton(
    doc: Document,
    label: string,
    className: string,
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.className = className;
  button.textContent = label;
  button.type = 'button';
  return button;
}
