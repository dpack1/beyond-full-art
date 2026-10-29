import dialogStyles from './copy-dialog.css?raw';
import {restoreFocus, trapTabKey} from '../fullscreen-viewer/focus';

const STYLE_ATTRIBUTE = 'data-bfa-copy-styles';

export type CopyChoice = 'copy' | 'skip';

export interface CopyDialog {
  prompt(onChoice: (choice: CopyChoice) => Promise<void>): Promise<void>;
}

export function mountCopyDialog(doc: Document): CopyDialog {
  const head = doc.head;
  if (head !== null && head.querySelector(`[${STYLE_ATTRIBUTE}]`) === null) {
    const style = doc.createElement('style');
    style.setAttribute(STYLE_ATTRIBUTE, 'true');
    style.textContent = dialogStyles;
    head.append(style);
  }
  const elements = createElements(doc);
  let choosing = false;
  let onChoice: ((choice: CopyChoice) => Promise<void>) | null = null;
  let open = false;
  let previousFocus: HTMLElement | null = null;
  let settle: (() => void) | null = null;

  const finish = () => {
    if (!open) {
      return;
    }
    open = false;
    choosing = false;
    onChoice = null;
    elements.overlay.hidden = true;
    elements.error.hidden = true;
    elements.error.textContent = '';
    restoreFocus(previousFocus);
    const done = settle;
    settle = null;
    done?.();
  };

  const choose = (choice: CopyChoice) => {
    const current = onChoice;
    if (!open || choosing || current === null) {
      return;
    }
    choosing = true;
    setBusy(elements, true);
    void current(choice)
        .then(() => {
          finish();
        })
        .catch((error: unknown) => {
          choosing = false;
          setBusy(elements, false);
          elements.error.textContent = error instanceof Error
            ? error.message
            : 'The journal could not be copied.';
          elements.error.hidden = false;
        });
  };

  elements.copyButton.addEventListener('click', () => {
    choose('copy');
  });
  elements.skipButton.addEventListener('click', () => {
    choose('skip');
  });
  elements.closeButton.addEventListener('click', () => {
    choose('skip');
  });
  elements.overlay.addEventListener('click', (event) => {
    if (event.target === elements.overlay) {
      choose('skip');
    }
  });
  elements.dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      choose('skip');
      return;
    }
    if (trapTabKey(event, elements.dialog)) {
      event.stopPropagation();
    }
  });

  return {
    prompt(nextChoice) {
      previousFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
      onChoice = nextChoice;
      choosing = false;
      open = true;
      elements.error.hidden = true;
      elements.error.textContent = '';
      setBusy(elements, false);
      elements.overlay.hidden = false;
      elements.dialog.focus();
      return new Promise((resolve) => {
        settle = resolve;
      });
    },
  };
}

function createElements(doc: Document) {
  const overlay = doc.createElement('div');
  overlay.className = 'bfa-copy-overlay';
  overlay.hidden = true;
  const dialog = doc.createElement('div');
  dialog.className = 'bfa-copy-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'bfa-copy-title');
  dialog.tabIndex = -1;
  const title = doc.createElement('h2');
  title.id = 'bfa-copy-title';
  title.className = 'bfa-copy-title';
  title.textContent = 'Copy stored journal?';
  const closeButton = doc.createElement('button');
  closeButton.className = 'bfa-copy-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '×';
  const note = doc.createElement('p');
  note.className = 'bfa-copy-note';
  note.textContent = 'The new character gets its own notes and photos. Deleting one does not remove the other.';
  const error = doc.createElement('p');
  error.className = 'bfa-copy-error';
  error.hidden = true;
  const actions = doc.createElement('div');
  actions.className = 'bfa-copy-actions';
  const skipButton = doc.createElement('button');
  skipButton.className = 'bfa-copy-button';
  skipButton.type = 'button';
  skipButton.textContent = 'Skip';
  const copyButton = doc.createElement('button');
  copyButton.className = 'bfa-copy-button bfa-copy-button--primary';
  copyButton.type = 'button';
  copyButton.textContent = 'Copy journal';
  actions.append(skipButton, copyButton);
  dialog.append(closeButton, title, note, error, actions);
  overlay.append(dialog);
  doc.body?.append(overlay);
  return {closeButton, copyButton, dialog, error, overlay, skipButton};
}

function setBusy(
    elements: ReturnType<typeof createElements>,
    busy: boolean,
): void {
  elements.copyButton.disabled = busy;
  elements.skipButton.disabled = busy;
  elements.closeButton.disabled = busy;
}
