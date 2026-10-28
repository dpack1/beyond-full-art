import {
  INVENTORY_TAB_BUTTON_CLASS,
  INVENTORY_TAB_LIST_CLASS,
  INVENTORY_TAB_MENU_CLASS,
} from '../../platform/dndbeyond/selectors';

export interface JournalPhotoTile {
  fileName: string;
  id: string;
  url: string | null;
}

export interface JournalPhotoSwitch {
  adoptLiveNav(): void;
  root: HTMLElement;
  setSelected(view: 'notes' | 'photos'): void;
}

export function createJournalPhotoSwitch(
    doc: Document,
    onSelect: (view: 'notes' | 'photos') => void,
): JournalPhotoSwitch {
  const root = element(doc, 'div', INVENTORY_TAB_LIST_CLASS);
  root.classList.add('bfa-journal-photo-switch');
  // The equipment class stretches the inventory section. This row is only the menu.
  root.style.height = 'auto';
  root.style.setProperty('--tab-count', '2');
  const menu = element(doc, 'menu', INVENTORY_TAB_MENU_CLASS);
  const notes = tab(doc, 'Notes', 'notes');
  const photos = tab(doc, 'Photos', 'photos');
  let selected: 'notes' | 'photos' = 'notes';
  notes.addEventListener('click', () => onSelect('notes'));
  photos.addEventListener('click', () => onSelect('photos'));
  menu.append(item(doc, notes), item(doc, photos));
  root.append(menu);
  setSelected('notes');
  adoptLiveNav();
  return {adoptLiveNav, root, setSelected};

  function adoptLiveNav(): void {
    if (root.dataset.bfaPhotoSwitch === 'live') {
      return;
    }
    const sample = findInventoryTab(doc);
    const liveMenu = sample?.closest('menu') ?? null;
    const liveList = liveMenu?.parentElement ?? null;
    if (sample === null || liveMenu === null || liveList === null) {
      return;
    }
    root.className = `${liveList.className} bfa-journal-photo-switch`;
    root.style.height = 'auto';
    menu.className = liveMenu.className;
    root.dataset.bfaPhotoSwitch = 'live';
    applySample(notes, sample);
    applySample(photos, sample);
    setSelected(selected);
  }

  function setSelected(view: 'notes' | 'photos'): void {
    selected = view;
    mark(notes, view === 'notes');
    mark(photos, view === 'photos');
    root.style.setProperty('--tab-active-position', view === 'notes' ? '0' : '1');
  }
}

export interface JournalPhotoGrid {
  root: HTMLElement;
  setPhotos(
    photos: readonly JournalPhotoTile[],
    onOpen: (id: string, returnFocus: HTMLElement) => void,
  ): void;
}

export function createJournalPhotoGrid(doc: Document): JournalPhotoGrid {
  const root = doc.createElement('div');
  root.className = 'bfa-journal-photo-grid';
  root.hidden = true;
  root.setAttribute('aria-label', 'Photos');
  return {
    root,
    setPhotos(photos, onOpen) {
      root.replaceChildren();
      for (const photo of photos) {
        root.append(tile(doc, photo, onOpen));
      }
    },
  };
}

export interface JournalPhotoPicker {
  close(): void;
  destroy(): void;
  isOpen(): boolean;
  open(options: {
    onPick: (id: string) => void;
    photos: readonly JournalPhotoTile[];
    returnFocus: HTMLElement | null;
  }): void;
}

export function createJournalPhotoPicker(doc: Document): JournalPhotoPicker {
  const overlay = doc.createElement('div');
  overlay.className = 'bfa-journal-photo-picker';
  overlay.hidden = true;
  const dialog = doc.createElement('div');
  dialog.className = 'bfa-journal-photo-picker__dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Photos');
  dialog.tabIndex = -1;
  const back = doc.createElement('button');
  back.type = 'button';
  back.className = 'bfa-journal-button';
  back.textContent = 'Back';
  const search = doc.createElement('input');
  search.type = 'search';
  search.className = 'bfa-journal-photo-picker__search';
  search.placeholder = 'Search';
  search.setAttribute('aria-label', 'Search photos');
  const grid = createJournalPhotoGrid(doc);
  grid.root.hidden = false;
  const empty = doc.createElement('p');
  empty.className = 'bfa-journal-message bfa-journal-message--muted';
  dialog.append(back, search, empty, grid.root);
  overlay.append(dialog);
  doc.body.append(overlay);

  let onPick: ((id: string) => void) | null = null;
  let photos: readonly JournalPhotoTile[] = [];
  let returnFocus: HTMLElement | null = null;

  back.addEventListener('click', close);
  search.addEventListener('input', render);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });

  return {
    close,
    isOpen() {
      return !overlay.hidden;
    },
    destroy() {
      close();
      overlay.remove();
    },
    open(options) {
      onPick = options.onPick;
      photos = options.photos;
      returnFocus = options.returnFocus;
      search.value = '';
      overlay.hidden = false;
      render();
      back.focus();
    },
  };

  function render(): void {
    const needle = search.value.trim().toLowerCase();
    const visible = photos.filter((photo) =>
      needle === '' || photo.fileName.toLowerCase().includes(needle),
    );
    empty.hidden = visible.length > 0;
    empty.textContent = photos.length === 0
      ? 'No photos yet.'
      : 'No photos match that search.';
    grid.setPhotos(visible, (id) => {
      const pick = onPick;
      close();
      pick?.(id);
    });
  }

  function close(): void {
    if (overlay.hidden) {
      return;
    }
    overlay.hidden = true;
    onPick = null;
    const focusTarget = returnFocus;
    returnFocus = null;
    focusTarget?.focus();
  }
}

function findInventoryTab(doc: Document): HTMLButtonElement | null {
  const buttons = doc.querySelectorAll('button');
  for (const button of buttons) {
    if (button.closest('.bfa-character-journal-section, .bfa-journal-photo-switch') !== null) {
      continue;
    }
    const label = button.textContent?.replace(/\s+/g, ' ').trim();
    if (label === 'My Inventory') {
      return button;
    }
  }
  return null;
}

function applySample(button: HTMLButtonElement, sample: Element): void {
  button.className = sample.className;
}

function item(doc: Document, button: HTMLButtonElement): HTMLLIElement {
  const entry = doc.createElement('li');
  entry.append(button);
  return entry;
}

function tab(
    doc: Document,
    label: string,
    view: 'notes' | 'photos',
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = INVENTORY_TAB_BUTTON_CLASS;
  button.textContent = label;
  button.setAttribute('role', 'radio');
  return button;
}

function mark(button: HTMLButtonElement, selected: boolean): void {
  button.setAttribute('aria-checked', selected ? 'true' : 'false');
}

function tile(
    doc: Document,
    photo: JournalPhotoTile,
    onOpen: (id: string, returnFocus: HTMLElement) => void,
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'bfa-journal-photo-tile';
  button.setAttribute('aria-label', photo.fileName);
  if (photo.url !== null) {
    const image = doc.createElement('img');
    image.alt = '';
    image.src = photo.url;
    button.append(image);
  } else {
    button.textContent = photo.fileName;
  }
  button.addEventListener('click', () => onOpen(photo.id, button));
  return button;
}

function element(doc: Document, tag: string, className: string): HTMLElement {
  const node = doc.createElement(tag);
  node.className = className;
  return node;
}
