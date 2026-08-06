import viewerStyles from './viewer.css?raw';
import {restoreFocus, trapTabKey} from './focus';
import {VIEWER_STYLE_ATTRIBUTE_NAME} from '../../platform/dndbeyond/selectors';

type ViewerStatusTone = 'error' | 'info' | 'success';

export interface ViewerActionResult {
  nextSource?: ViewerImageSource;
  status?: {
    message: string;
    tone: ViewerStatusTone;
  };
}

export interface ViewerSecondaryAction {
  busyText: string;
  onClick: () => Promise<ViewerActionResult>;
  text: string;
}

export interface ViewerImageSource {
  altText: string;
  imageUrl: string;
  releaseImageUrl?: () => void;
  secondaryAction?: ViewerSecondaryAction;
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
  secondaryActionButton: HTMLButtonElement;
  status: HTMLParagraphElement;
}

export function createFullscreenViewer(
    doc: Document = document,
): FullscreenViewer {
  ensureViewerStyles(doc);

  const elements = createViewerElements(doc);
  const state = {
    currentSource: null as ViewerImageSource | null,
    currentImageCleanup: null as (() => void) | null,
    isOpen: false,
    previousActiveElement: null as HTMLElement | null,
    previousBodyOverflow: '',
    secondaryActionDefaultText: '',
    secondaryActionInFlight: false,
  };

  const close = () => {
    releaseCurrentImage();
    if (!state.isOpen) {
      return;
    }

    state.isOpen = false;
    elements.overlay.hidden = true;
    elements.image.removeAttribute('src');
    doc.body.style.overflow = state.previousBodyOverflow;
    state.currentSource = null;
    state.secondaryActionDefaultText = '';
    state.secondaryActionInFlight = false;
    renderStatus('');
    renderSecondaryAction(null);
    restoreFocus(state.previousActiveElement);
  };

  const open = (source: ViewerImageSource, trigger: HTMLElement) => {
    if (state.isOpen) {
      close();
    }

    state.previousActiveElement = trigger;
    state.previousBodyOverflow = doc.body.style.overflow;
    applySource(source);
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

  const releaseCurrentImage = () => {
    state.currentImageCleanup?.();
    state.currentImageCleanup = null;
  };

  const applySource = (source: ViewerImageSource) => {
    releaseCurrentImage();
    state.currentSource = source;
    state.currentImageCleanup = source.releaseImageUrl ?? null;
    state.secondaryActionDefaultText = source.secondaryAction?.text ?? '';
    state.secondaryActionInFlight = false;
    elements.image.alt = source.altText;
    elements.image.src = source.imageUrl;
    renderSecondaryAction(source.secondaryAction ?? null);
    renderStatus('');
  };

  const handleSecondaryActionClick = async () => {
    const secondaryAction = state.currentSource?.secondaryAction;
    if (secondaryAction === undefined || state.secondaryActionInFlight) {
      return;
    }

    state.secondaryActionInFlight = true;
    elements.secondaryActionButton.disabled = true;
    elements.secondaryActionButton.textContent = secondaryAction.busyText;

    try {
      const result = await secondaryAction.onClick();
      if (result.nextSource !== undefined) {
        applySource(result.nextSource);
      } else {
        renderSecondaryAction(state.currentSource?.secondaryAction ?? null);
      }

      if (result.status !== undefined) {
        renderStatus(result.status.message, result.status.tone);
      }
    } finally {
      if (state.secondaryActionInFlight) {
        state.secondaryActionInFlight = false;
        renderSecondaryAction(state.currentSource?.secondaryAction ?? null);
      }
    }
  };

  elements.secondaryActionButton.addEventListener('click', (event) => {
    event.stopPropagation();
    void handleSecondaryActionClick();
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

  function renderSecondaryAction(
      secondaryAction: ViewerSecondaryAction | null,
  ): void {
    if (secondaryAction === null) {
      elements.secondaryActionButton.hidden = true;
      elements.secondaryActionButton.disabled = false;
      elements.secondaryActionButton.textContent = '';
      return;
    }

    elements.secondaryActionButton.hidden = false;
    elements.secondaryActionButton.disabled = state.secondaryActionInFlight;
    elements.secondaryActionButton.textContent = state.secondaryActionInFlight
      ? secondaryAction.busyText
      : secondaryAction.text;
  }

  function renderStatus(message: string, tone: ViewerStatusTone = 'info'): void {
    elements.status.className = `bfa-viewer-status bfa-viewer-status--${tone}`;
    elements.status.hidden = message === '';
    elements.status.textContent = message;
  }
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

  const secondaryActionButton = doc.createElement('button');
  secondaryActionButton.className = 'bfa-viewer-secondary-action';
  secondaryActionButton.hidden = true;
  secondaryActionButton.type = 'button';

  const controls = doc.createElement('div');
  controls.className = 'bfa-viewer-controls';
  controls.append(secondaryActionButton, closeButton);

  const status = doc.createElement('p');
  status.className = 'bfa-viewer-status bfa-viewer-status--info';
  status.hidden = true;

  const image = doc.createElement('img');
  image.className = 'bfa-viewer-image';

  dialog.append(controls, status, image);
  overlay.append(dialog);
  doc.body.append(overlay);

  return {
    closeButton,
    dialog,
    image,
    overlay,
    secondaryActionButton,
    status,
  };
}
