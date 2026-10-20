import {restoreFocus, trapTabKey} from '../fullscreen-viewer/focus';

export interface JournalPhotoViewerOpenOptions {
  allowRemove?: boolean;
  fallbackFocus: HTMLElement | null;
  imageUrl: string;
  label: string;
  onRemove: () => Promise<void>;
  returnFocus: HTMLElement | null;
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

  const status = doc.createElement('p');
  status.className = 'bfa-journal-photo-viewer__status';
  status.setAttribute('aria-live', 'polite');

  controls.append(removeButton, closeButton);
  figure.append(image, caption);
  dialog.append(controls, figure, status);
  overlay.append(dialog);
  doc.body.append(overlay);

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

  async function removePhoto(): Promise<void> {
    if (onRemove === null) {
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
