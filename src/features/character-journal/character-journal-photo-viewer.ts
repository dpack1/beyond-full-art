import {restoreFocus, trapTabKey} from '../fullscreen-viewer/focus';

export interface JournalPhotoViewerNote {
  id: string;
  title: string;
}

export interface JournalPhotoViewerOpenOptions {
  allowRemove?: boolean;
  confirmText?: string;
  fallbackFocus: HTMLElement | null;
  imageUrl: string;
  label: string;
  notes?: readonly JournalPhotoViewerNote[];
  onOpenNote?: (noteId: string) => void;
  onRemove: () => Promise<void>;
  removeLabel?: string;
  returnFocus: HTMLElement | null;
  unusedText?: string;
}

export interface JournalPhotoViewer {
  close(): void;
  destroy(): void;
  isOpen(): boolean;
  open(options: JournalPhotoViewerOpenOptions): void;
}

export function createJournalPhotoViewer(doc: Document): JournalPhotoViewer {
  const overlay = doc.createElement('div');
  overlay.className = 'bfa-journal-photo-viewer';
  overlay.hidden = true;

  const dialog = doc.createElement('div');
  dialog.className = 'bfa-journal-photo-viewer__dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.tabIndex = -1;

  const controls = doc.createElement('div');
  controls.className = 'bfa-journal-photo-viewer__controls';

  const removeButton = doc.createElement('button');
  removeButton.className = 'bfa-journal-photo-viewer__button bfa-journal-photo-viewer__button--danger';
  removeButton.textContent = 'Remove photo';
  removeButton.type = 'button';

  const closeButton = doc.createElement('button');
  closeButton.className = 'bfa-journal-photo-viewer__button';
  closeButton.textContent = 'Close photo';
  closeButton.type = 'button';

  const figure = doc.createElement('figure');
  figure.className = 'bfa-journal-photo-viewer__figure';

  const image = doc.createElement('img');
  image.className = 'bfa-journal-photo-viewer__image';
  image.alt = '';

  const caption = doc.createElement('figcaption');
  caption.className = 'bfa-journal-photo-viewer__caption';

  const usage = doc.createElement('div');
  usage.className = 'bfa-journal-photo-viewer__usage';

  const status = doc.createElement('p');
  status.className = 'bfa-journal-photo-viewer__status';
  status.setAttribute('aria-live', 'polite');

  controls.append(removeButton, closeButton);
  figure.append(image, caption, usage);
  dialog.append(controls, figure, status);
  overlay.append(dialog);
  doc.body.append(overlay);

  let confirmed = false;
  let confirmText = '';
  let fallbackFocus: HTMLElement | null = null;
  let onRemove: (() => Promise<void>) | null = null;
  let returnFocus: HTMLElement | null = null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (overlay.hidden) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    trapTabKey(event, dialog);
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  closeButton.addEventListener('click', () => {
    close();
  });
  removeButton.addEventListener('click', () => {
    void removePhoto();
  });
  doc.addEventListener('keydown', onKeyDown);

  return {
    close,
    destroy() {
      close();
      doc.removeEventListener('keydown', onKeyDown);
      overlay.remove();
    },
    isOpen() {
      return !overlay.hidden;
    },
    open(options) {
      confirmed = false;
      confirmText = options.confirmText ?? '';
      fallbackFocus = options.fallbackFocus;
      onRemove = options.onRemove;
      returnFocus = options.returnFocus;
      image.src = options.imageUrl;
      image.alt = options.label;
      caption.textContent = options.label;
      dialog.setAttribute('aria-label', options.label);
      status.textContent = '';
      removeButton.disabled = false;
      removeButton.hidden = options.allowRemove === false;
      removeButton.textContent = options.removeLabel ?? 'Remove photo';
      renderUsage(options);
      overlay.hidden = false;
      closeButton.focus();
    },
  };

  function close(): void {
    if (overlay.hidden) {
      return;
    }

    overlay.hidden = true;
    image.removeAttribute('src');
    onRemove = null;
    const focusTarget = returnFocus?.isConnected === true
      ? returnFocus
      : fallbackFocus;
    fallbackFocus = null;
    returnFocus = null;
    restoreFocus(focusTarget);
  }

  function renderUsage(options: JournalPhotoViewerOpenOptions): void {
    usage.replaceChildren();
    const notes = options.notes ?? [];
    if (options.onOpenNote === undefined && options.unusedText === undefined) {
      usage.hidden = true;
      return;
    }
    usage.hidden = false;
    if (notes.length === 0) {
      const empty = doc.createElement('p');
      empty.textContent = options.unusedText ?? 'Not in a note yet.';
      usage.append(empty);
      return;
    }
    const label = doc.createElement('p');
    label.textContent = 'Used in';
    const list = doc.createElement('div');
    list.className = 'bfa-journal-photo-viewer__notes';
    for (const note of notes) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'bfa-journal-button';
      button.textContent = note.title;
      button.addEventListener('click', () => {
        options.onOpenNote?.(note.id);
      });
      list.append(button);
    }
    usage.append(label, list);
  }

  async function removePhoto(): Promise<void> {
    if (onRemove === null) {
      return;
    }
    if (confirmText !== '' && !confirmed) {
      confirmed = true;
      status.textContent = confirmText;
      return;
    }

    removeButton.disabled = true;
    status.textContent = 'Removing photo...';
    try {
      await onRemove();
      close();
    } catch (error) {
      status.textContent = error instanceof Error
        ? error.message
        : 'Photo could not be removed.';
      removeButton.disabled = false;
    }
  }
}
