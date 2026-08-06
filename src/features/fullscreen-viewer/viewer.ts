import viewerStyles from './viewer.css?raw';
import {restoreFocus, trapTabKey} from './focus';
import {VIEWER_STYLE_ATTRIBUTE_NAME} from '../../platform/dndbeyond/selectors';

export interface ViewerImageSource {
  altText: string;
  imageUrl: string;
}

export interface FullscreenViewer {
  close(): void;
  destroy(): void;
  isOpen(): boolean;
  open(source: ViewerImageSource, trigger: HTMLElement): void;
}

interface ViewerElements {
  closeButton: HTMLButtonElement;
  dialog: HTMLDivElement;
  image: HTMLImageElement;
  overlay: HTMLDivElement;
}

export function createFullscreenViewer(
    doc: Document = document,
): FullscreenViewer {
  ensureViewerStyles(doc);

  const elements = createViewerElements(doc);
  const state = {
    isOpen: false,
    previousActiveElement: null as HTMLElement | null,
    previousBodyOverflow: '',
  };

  const close = () => {
    if (!state.isOpen) {
      return;
    }

    state.isOpen = false;
    elements.overlay.hidden = true;
    elements.image.removeAttribute('src');
    doc.body.style.overflow = state.previousBodyOverflow;
    restoreFocus(state.previousActiveElement);
  };

  const open = (source: ViewerImageSource, trigger: HTMLElement) => {
    state.previousActiveElement = trigger;
    state.previousBodyOverflow = doc.body.style.overflow;
    elements.image.alt = source.altText;
    elements.image.src = source.imageUrl;
    elements.overlay.hidden = false;
    state.isOpen = true;
    doc.body.style.overflow = 'hidden';
    elements.closeButton.focus();
  };

  elements.closeButton.addEventListener('click', close);
  elements.closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  elements.dialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  elements.dialog.addEventListener('mousedown', (event) => {
    event.stopPropagation();
  });
  elements.overlay.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target === elements.overlay) {
      close();
    }
  });
  elements.overlay.addEventListener('mousedown', (event) => {
    event.stopPropagation();
  });
  elements.overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    event.stopPropagation();
    trapTabKey(event, elements.dialog);
  });

  return {
    close,
    destroy() {
      close();
      elements.overlay.remove();
      removeViewerStyles(doc);
    },
    isOpen() {
      return state.isOpen;
    },
    open,
  };
}

function ensureViewerStyles(doc: Document): void {
  if (doc.head.querySelector(`[${VIEWER_STYLE_ATTRIBUTE_NAME}]`) !== null) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(VIEWER_STYLE_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = viewerStyles;
  doc.head.append(styleElement);
}

function removeViewerStyles(doc: Document): void {
  doc.head.querySelector(`[${VIEWER_STYLE_ATTRIBUTE_NAME}]`)?.remove();
}

function createViewerElements(doc: Document): ViewerElements {
  const overlay = doc.createElement('div');
  overlay.className = 'bfa-viewer-overlay';
  overlay.hidden = true;

  const dialog = doc.createElement('div');
  dialog.className = 'bfa-viewer-dialog';
  dialog.setAttribute('aria-label', 'Fullscreen character portrait');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('role', 'dialog');
  dialog.tabIndex = -1;

  const closeButton = doc.createElement('button');
  closeButton.className = 'bfa-viewer-close';
  closeButton.textContent = 'Close';
  closeButton.type = 'button';

  const image = doc.createElement('img');
  image.className = 'bfa-viewer-image';

  dialog.append(closeButton, image);
  overlay.append(dialog);
  doc.body.append(overlay);

  return {
    closeButton,
    dialog,
    image,
    overlay,
  };
}
