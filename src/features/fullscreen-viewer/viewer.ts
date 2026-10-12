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

export interface ViewerAction {
  busyText: string;
  onClick: () => Promise<ViewerActionResult>;
  text: string;
  tone?: 'danger' | 'default';
}

export interface ViewerImageSource {
  actions?: ViewerAction[];
  altText: string;
  imageUrl: string;
  releaseImageUrl?: () => void;
}

export interface FullscreenViewer {
  close(): void;
  destroy(): void;
  isOpen(): boolean;
  open(source: ViewerImageSource, trigger: HTMLElement): void;
}

interface ViewerElements {
  actions: HTMLDivElement;
  closeButton: HTMLButtonElement;
  dialog: HTMLDivElement;
  image: HTMLImageElement;
  overlay: HTMLDivElement;
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
    actionInFlightIndex: null as number | null,
    previousActiveElement: null as HTMLElement | null,
    previousBodyOverflow: '',
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
    state.actionInFlightIndex = null;
    renderStatus('');
    renderActions([]);
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
    state.actionInFlightIndex = null;
    elements.image.alt = source.altText;
    elements.image.src = source.imageUrl;
    renderActions(source.actions ?? []);
    renderStatus('');
  };

  const handleActionClick = async (index: number) => {
    const action = state.currentSource?.actions?.[index];
    if (action === undefined || state.actionInFlightIndex !== null) {
      return;
    }

    state.actionInFlightIndex = index;
    renderActions(state.currentSource?.actions ?? []);

    let nextSourceApplied = false;
    try {
      const result = await action.onClick();
      if (result.nextSource !== undefined) {
        applySource(result.nextSource);
        nextSourceApplied = true;
      } else {
        state.actionInFlightIndex = null;
        renderActions(state.currentSource?.actions ?? []);
      }

      if (result.status !== undefined) {
        renderStatus(result.status.message, result.status.tone);
      }
    } finally {
      if (!nextSourceApplied && state.actionInFlightIndex !== null) {
        state.actionInFlightIndex = null;
        renderActions(state.currentSource?.actions ?? []);
      }
    }
  };

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

  function renderActions(
      actions: ViewerAction[],
  ): void {
    elements.actions.replaceChildren();

    if (actions.length === 0) {
      elements.actions.hidden = true;
      return;
    }

    elements.actions.hidden = false;
    actions.forEach((action, index) => {
      const button = doc.createElement('button');
      button.className = [
        'bfa-viewer-secondary-action',
        action.tone === 'danger'
          ? 'bfa-viewer-secondary-action--danger'
          : '',
      ].filter(Boolean).join(' ');
      button.disabled = state.actionInFlightIndex !== null;
      button.textContent = state.actionInFlightIndex === index
        ? action.busyText
        : action.text;
      button.type = 'button';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        void handleActionClick(index);
      });
      elements.actions.append(button);
    });
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

  const actions = doc.createElement('div');
  actions.className = 'bfa-viewer-actions';
  actions.hidden = true;

  const controls = doc.createElement('div');
  controls.className = 'bfa-viewer-controls';
  controls.append(actions, closeButton);

  const status = doc.createElement('p');
  status.className = 'bfa-viewer-status bfa-viewer-status--info';
  status.hidden = true;

  const image = doc.createElement('img');
  image.className = 'bfa-viewer-image';

  dialog.append(controls, status, image);
  overlay.append(dialog);
  doc.body.append(overlay);

  return {
    actions,
    closeButton,
    dialog,
    image,
    overlay,
    status,
  };
}
