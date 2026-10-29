import dialogStyles from './cleanup-dialog.css?raw';
import {restoreFocus, trapTabKey} from '../fullscreen-viewer/focus';

const STYLE_ATTRIBUTE = 'data-bfa-cleanup-styles';

export interface CleanupChoice {
  decision: 'delete' | 'keep';
  remember: boolean;
}

export interface CleanupPromptDetails {
  hasArt: boolean;
  hasJournalData: boolean;
}

export interface CleanupPromptCopy {
  deleteLabel: string;
  keepLabel: string;
  note: string | null;
  title: string;
}

export function cleanupPromptCopy(details: CleanupPromptDetails): CleanupPromptCopy {
  if (!details.hasArt && details.hasJournalData) {
    return {
      deleteLabel: 'Delete journal',
      keepLabel: 'Keep journal',
      note: 'Export the journal first to keep the notes and photos.',
      title: 'Delete stored journal?',
    };
  }
  return {
    deleteLabel: 'Delete art',
    keepLabel: 'Keep art',
    note: details.hasJournalData
      ? 'This also deletes the journal and photos. Export them first to keep them.'
      : null,
    title: 'Delete stored full art?',
  };
}

export type CleanupExport = () => Promise<string | void>;

export interface CleanupDialog {
  showFailure(message: string): void;
  prompt(
    onChoice: (choice: CleanupChoice) => Promise<void>,
    details?: boolean | CleanupPromptDetails,
    onExport?: CleanupExport,
  ): Promise<void>;
}

export function mountCleanupDialog(doc: Document): CleanupDialog {
  ensureStyles(doc);
  const elements = createElements(doc);
  const state = {
    choosing: false,
    onChoice: null as ((choice: CleanupChoice) => Promise<void>) | null,
    onExport: null as CleanupExport | null,
    open: false,
    previousFocus: null as HTMLElement | null,
    settle: null as (() => void) | null,
  };

  const finish = () => {
    if (!state.open) {
      return;
    }
    state.open = false;
    state.choosing = false;
    state.onChoice = null;
    state.onExport = null;
    elements.overlay.hidden = true;
    elements.error.hidden = true;
    elements.error.textContent = '';
    elements.status.hidden = true;
    elements.status.textContent = '';
    elements.remember.checked = false;
    elements.note.hidden = true;
    elements.exportButton.hidden = true;
    setChoiceVisible(elements, true);
    restoreFocus(state.previousFocus);
    const settle = state.settle;
    state.settle = null;
    settle?.();
  };

  const choose = (choice: CleanupChoice) => {
    const onChoice = state.onChoice;
    if (!state.open || state.choosing || onChoice === null) {
      return;
    }
    state.choosing = true;
    setBusy(elements, true);
    void onChoice(choice)
        .then(() => {
          finish();
        })
        .catch((error: unknown) => {
          state.choosing = false;
          setBusy(elements, false);
          showError(elements, error instanceof Error
            ? error.message
            : 'Stored full art could not be deleted.');
        });
  };

  const dismiss = () => {
    if (state.onChoice === null) {
      finish();
      return;
    }
    choose({decision: 'keep', remember: false});
  };

  const exportJournal = () => {
    const onExport = state.onExport;
    if (!state.open || state.choosing || onExport === null) {
      return;
    }
    state.choosing = true;
    setBusy(elements, true);
    elements.error.hidden = true;
    elements.status.hidden = true;
    void onExport()
        .then((message) => {
          state.choosing = false;
          setBusy(elements, false);
          showStatus(elements, message ?? 'Journal export downloaded.');
        })
        .catch((error: unknown) => {
          state.choosing = false;
          setBusy(elements, false);
          showError(elements, error instanceof Error
            ? error.message
            : 'The journal could not be exported.');
        });
  };

  elements.exportButton.addEventListener('click', exportJournal);
  elements.deleteButton.addEventListener('click', () => {
    choose({decision: 'delete', remember: elements.remember.checked});
  });
  elements.keepButton.addEventListener('click', () => {
    choose({decision: 'keep', remember: elements.remember.checked});
  });
  elements.closeButton.addEventListener('click', dismiss);
  elements.overlay.addEventListener('click', (event) => {
    if (event.target === elements.overlay) {
      dismiss();
    }
  });
  elements.dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    if (trapTabKey(event, elements.dialog)) {
      event.stopPropagation();
    }
  });

  return {
    prompt(onChoice, details = false, onExport) {
      const resolved = promptDetails(details);
      const copy = cleanupPromptCopy(resolved);
      state.previousFocus = doc.activeElement instanceof HTMLElement
        ? doc.activeElement
        : null;
      state.onChoice = onChoice;
      state.onExport = onExport ?? null;
      state.choosing = false;
      state.open = true;
      elements.title.textContent = copy.title;
      elements.keepButton.textContent = copy.keepLabel;
      elements.deleteButton.textContent = copy.deleteLabel;
      elements.exportButton.hidden = !resolved.hasJournalData || onExport === undefined;
      elements.remember.checked = false;
      elements.note.hidden = copy.note === null;
      elements.note.textContent = copy.note ?? '';
      elements.status.hidden = true;
      elements.status.textContent = '';
      elements.error.hidden = true;
      elements.error.textContent = '';
      setChoiceVisible(elements, true);
      setBusy(elements, false);
      elements.overlay.hidden = false;
      elements.dialog.focus();
      return new Promise((resolve) => {
        state.settle = resolve;
      });
    },
    showFailure(message) {
      state.previousFocus = doc.activeElement instanceof HTMLElement
        ? doc.activeElement
        : null;
      state.onChoice = null;
      state.choosing = false;
      state.open = true;
      elements.note.hidden = true;
      elements.status.hidden = true;
      elements.exportButton.hidden = true;
      state.onExport = null;
      setChoiceVisible(elements, false);
      showError(elements, message);
      setBusy(elements, false);
      elements.overlay.hidden = false;
      elements.closeButton.focus();
    },
  };
}

function createElements(doc: Document) {
  const overlay = doc.createElement('div');
  overlay.className = 'bfa-cleanup-overlay';
  overlay.hidden = true;
  const dialog = doc.createElement('div');
  dialog.className = 'bfa-cleanup-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'bfa-cleanup-title');
  dialog.tabIndex = -1;
  const title = doc.createElement('h2');
  title.id = 'bfa-cleanup-title';
  title.className = 'bfa-cleanup-title';
  title.textContent = 'Delete stored full art?';
  const closeButton = doc.createElement('button');
  closeButton.className = 'bfa-cleanup-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '×';
  const note = doc.createElement('p');
  note.className = 'bfa-cleanup-note';
  note.hidden = true;
  note.textContent = 'This also deletes the journal and photos. Export them first to keep them.';
  const status = doc.createElement('p');
  status.className = 'bfa-cleanup-status';
  status.hidden = true;
  const error = doc.createElement('p');
  error.className = 'bfa-cleanup-error';
  error.hidden = true;
  const rememberLabel = doc.createElement('label');
  rememberLabel.className = 'bfa-cleanup-remember';
  const remember = doc.createElement('input');
  remember.type = 'checkbox';
  rememberLabel.append(remember, doc.createTextNode('Remember my decision'));
  const actions = doc.createElement('div');
  actions.className = 'bfa-cleanup-actions';
  const exportButton = doc.createElement('button');
  exportButton.className = 'bfa-cleanup-button bfa-cleanup-button--export';
  exportButton.type = 'button';
  exportButton.textContent = 'Export';
  exportButton.hidden = true;
  const keepButton = doc.createElement('button');
  keepButton.className = 'bfa-cleanup-button';
  keepButton.type = 'button';
  keepButton.textContent = 'Keep art';
  const deleteButton = doc.createElement('button');
  deleteButton.className = 'bfa-cleanup-button bfa-cleanup-button--danger';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete art';
  actions.append(exportButton, keepButton, deleteButton);
  dialog.append(closeButton, title, note, status, error, rememberLabel, actions);
  overlay.append(dialog);
  doc.body?.append(overlay);
  return {
    actions,
    closeButton,
    deleteButton,
    dialog,
    error,
    exportButton,
    keepButton,
    note,
    overlay,
    remember,
    rememberLabel,
    status,
    title,
  };
}

function promptDetails(details: boolean | CleanupPromptDetails): CleanupPromptDetails {
  if (typeof details === 'boolean') {
    return {hasArt: true, hasJournalData: details};
  }
  return details;
}

function setChoiceVisible(
    elements: ReturnType<typeof createElements>,
    visible: boolean,
): void {
  elements.actions.hidden = !visible;
  elements.rememberLabel.hidden = !visible;
}

function setBusy(elements: ReturnType<typeof createElements>, busy: boolean): void {
  elements.exportButton.disabled = busy;
  elements.deleteButton.disabled = busy;
  elements.keepButton.disabled = busy;
  elements.closeButton.disabled = busy;
}

function showStatus(elements: ReturnType<typeof createElements>, message: string): void {
  elements.error.hidden = true;
  elements.status.textContent = message;
  elements.status.hidden = false;
}

function showError(elements: ReturnType<typeof createElements>, message: string): void {
  elements.status.hidden = true;
  elements.error.textContent = message;
  elements.error.hidden = false;
}

function ensureStyles(doc: Document): void {
  const head = doc.head;
  if (head === null || head.querySelector(`[${STYLE_ATTRIBUTE}]`) !== null) {
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute(STYLE_ATTRIBUTE, 'true');
  style.textContent = dialogStyles;
  head.append(style);
}
