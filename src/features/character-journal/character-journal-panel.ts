import {SIDEBAR_TEXTAREA_CLASS} from '../../platform/dndbeyond/selectors';
import {trapTabKey} from '../fullscreen-viewer/focus';
import {applyJournalFormat, type JournalFormatKind} from './character-journal-format';
import {
  checkIcon,
  FORMAT_ICONS,
  journalIcon,
  pencilIcon,
} from './character-journal-icons';
import {renderJournalMarkdown} from './character-journal-markdown';
import {journalTypeLabel} from './character-journal-query';
import {createJournalSidebar} from './character-journal-sidebar';
import {placeJournalSidebar} from './character-journal-sidebar-place';
import type {JournalEntryType} from './character-journal-types';

export interface PanelImageModel {
  fileName: string;
  id: string;
  url: string | null;
}

export interface PanelMentionModel {
  id: string;
  label: string;
  title: string;
}

export interface PanelConfirmModel {
  danger: string;
  kind: 'delete' | 'discard' | 'replace';
  question: string;
  safe: string;
}

export interface PanelPickerChoice {
  id: string;
  label: string;
}

export interface PanelModel {
  back: boolean;
  picker: readonly PanelPickerChoice[] | null;
  body: string;
  confirm: PanelConfirmModel | null;
  entryId: string;
  error: string | null;
  imageError: string | null;
  images: readonly PanelImageModel[];
  mentions: readonly PanelMentionModel[];
  mismatch: boolean;
  mode: 'edit' | 'read';
  next: boolean;
  needsDetails: boolean;
  pickerTitle: string | null;
  stale: boolean;
  status: 'error' | 'saved' | 'saving' | null;
  title: string;
  type: JournalEntryType;
  typeLabel: string;
}

export interface PanelHandlers {
  onBack: () => void;
  onNext: () => void;
  onCheckbox: (index: number, checked: boolean) => void;
  onClose: () => void;
  onConfirm: (accepted: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
  onImages: (files: readonly File[], position: {end: number; start: number}) => void;
  onInput: () => void;
  onLibraryPick: (position: {end: number; start: number}) => void;
  onKeepBoth: () => void;
  onMention: (entryId: string) => void;
  onPick: (entryId: string) => void;
  onReload: () => void;
  onStaleSave: () => void;
  onRemoveImage: (imageId: string) => void;
  onType: (type: JournalEntryType) => void;
  onViewImage: (imageId: string, returnFocus: HTMLElement) => void;
  onWiki: (name: string, resolution: string, anchor: HTMLElement) => void;
  resolveWiki: (name: string) => 'many' | 'missing' | 'one';
}

export interface JournalPanelView {
  fileInput: HTMLInputElement;
  place(): void;
  readDraft(): {body: string; title: string};
  replaceEditor(body: string, selection: {end: number; start: number}): void;
  render(model: PanelModel): void;
  root: HTMLElement;
  setDark(on: boolean): void;
  textarea: HTMLTextAreaElement | null;
  titleField: HTMLInputElement | null;
}

export function createJournalPanel(
    doc: Document,
    handlers: PanelHandlers,
    imageUrl: (imageId: string) => string | null,
    imagesFor: () => readonly {altText?: string; fileName?: string; id: string}[],
): JournalPanelView {
  const shell = createJournalSidebar(doc);
  const {
    body,
    callout: actions,
    closeButton,
    footer,
    nav,
    nextButton,
    prevButton,
    root,
    scroller,
    setDark,
    title,
  } = shell;
  const editButton = iconButton(doc, 'Edit', pencilIcon(doc));
  const tag = doc.createElement('span');
  tag.className = 'bfa-journal-tag';
  const typeSelect = doc.createElement('select');
  typeSelect.className = 'bfa-journal-type';
  typeSelect.setAttribute('aria-label', 'Type');
  for (const type of PANEL_TYPES) {
    const option = doc.createElement('option');
    option.value = type;
    option.textContent = journalTypeLabel(type);
    typeSelect.append(option);
  }
  const unsetOption = doc.createElement('option');
  unsetOption.value = 'unset';
  unsetOption.textContent = journalTypeLabel('unset');
  typeSelect.append(unsetOption);
  typeSelect.addEventListener('change', () => {
    const value = typeSelect.value;
    if (isPanelType(value)) {
      handlers.onType(value);
      return;
    }

    const current = typeSelect.dataset.bfaJournalType;
    if (current !== undefined) {
      typeSelect.value = current;
    }
  });
  const needs = doc.createElement('span');
  needs.className = 'bfa-journal-tag bfa-journal-tag-needs';
  needs.textContent = 'Needs details';
  needs.hidden = true;
  const status = doc.createElement('p');
  status.className = 'bfa-journal-status';
  const stickyTools = doc.createElement('div');
  stickyTools.className = 'bfa-journal-sticky-tools';
  stickyTools.append(status, typeSelect, editButton);
  actions.append(tag, needs);
  const deleteButton = button(doc, 'Delete note', 'bfa-journal-button bfa-journal-button-danger');
  footer.append(deleteButton);

  const fileInput = doc.createElement('input');
  fileInput.className = 'bfa-journal-file-input';
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp';
  fileInput.tabIndex = -1;
  fileInput.hidden = true;
  root.append(fileInput);

  let textarea: HTMLTextAreaElement | null = null;
  let titleField: HTMLInputElement | null = null;
  let renderedId = '';
  let renderedBody = '';
  let renderedMode: PanelModel['mode'] | '' = '';

  function bindWikiLinks(scope: ParentNode): void {
    for (const link of scope.querySelectorAll<HTMLButtonElement>('.bfa-journal-wikilink')) {
      link.addEventListener('click', () => {
        handlers.onWiki(
            link.dataset.bfaWikiName ?? '',
            link.dataset.bfaWikiResolution ?? 'missing',
            link,
        );
      });
    }
  }

  function readMarkdown(model: PanelModel): HTMLElement {
    const read = renderJournalMarkdown(model.body, {
      document: doc,
      imageUrl,
      images: imagesFor().map((image) => ({
        altText: image.altText || image.fileName || '',
        id: image.id,
      })),
      onCheckbox: handlers.onCheckbox,
      onViewImage: handlers.onViewImage,
      resolveWiki: handlers.resolveWiki,
    });
    bindWikiLinks(read);
    return read;
  }

  closeButton.addEventListener('click', () => handlers.onClose());
  prevButton.addEventListener('click', () => handlers.onBack());
  nextButton.addEventListener('click', () => handlers.onNext());
  editButton.addEventListener('click', () => handlers.onEdit());
  deleteButton.addEventListener('click', () => handlers.onDelete());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    const start = Number(fileInput.dataset.bfaInsertStart);
    const end = Number(fileInput.dataset.bfaInsertEnd);
    delete fileInput.dataset.bfaInsertStart;
    delete fileInput.dataset.bfaInsertEnd;
    fileInput.value = '';
    if (file === undefined) {
      return;
    }

    const length = textarea?.value.length ?? 0;
    const position = Number.isFinite(start) && Number.isFinite(end)
      ? {end, start}
      : {end: length, start: length};
    handlers.onImages([file], position);
  });
  root.addEventListener('keydown', (event) => {
    if (root.hidden) {
      return;
    }

    const confirm = root.querySelector<HTMLElement>('.bfa-journal-confirm');
    if (confirm !== null && !confirm.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handlers.onConfirm(false);
        return;
      }

      if (trapTabKey(event, confirm)) {
        event.stopPropagation();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      handlers.onClose();
      return;
    }

    if (trapTabKey(event, root)) {
      event.stopPropagation();
    }
  });

  return {
    fileInput,
    place() {
      placeJournalSidebar(root, shell.dialog, doc);
    },
    readDraft() {
      return {
        body: textarea?.value ?? '',
        title: titleField?.value ?? title.textContent ?? '',
      };
    },
    replaceEditor(body: string, selection: {end: number; start: number}) {
      if (textarea === null) {
        return;
      }

      const panelScrollTop = scroller.scrollTop;
      const editorScrollTop = textarea.scrollTop;
      textarea.value = body;
      const host = textarea.parentElement;
      if (host !== null) {
        host.dataset.value = body;
      }
      textarea.focus({preventScroll: true});
      textarea.setSelectionRange(selection.start, selection.end);
      textarea.scrollTop = editorScrollTop;
      scroller.scrollTop = panelScrollTop;
      queueMicrotask(() => {
        textarea?.focus({preventScroll: true});
        if (textarea !== null) {
          textarea.scrollTop = editorScrollTop;
        }
        scroller.scrollTop = panelScrollTop;
      });
    },
    render(model) {
      const previousMode = renderedMode;
      const modeScrollProgress = renderedId === model.entryId && previousMode !== model.mode
        ? scrollProgress(previousMode === 'edit' ? textarea : scroller)
        : null;
      root.hidden = false;
      root.dataset.bfaJournalMode = model.mode;
      shell.dialog.setAttribute('aria-label', model.title || 'Journal note');
      nav.hidden = !model.back && !model.next;
      prevButton.disabled = !model.back;
      nextButton.disabled = !model.next;
      tag.hidden = true;
      typeSelect.dataset.bfaJournalType = model.type;
      const unsetOption = typeSelect.querySelector<HTMLOptionElement>('option[value="unset"]');
      if (unsetOption !== null) {
        unsetOption.disabled = model.type !== 'unset';
      }
      typeSelect.value = model.type;
      needs.hidden = !model.needsDetails;
      const editing = model.mode === 'edit';
      editButton.setAttribute('aria-label', editing ? 'Done editing' : 'Edit');
      editButton.title = editing ? 'Done editing' : 'Edit';
      editButton.setAttribute('aria-pressed', editing ? 'true' : 'false');
      if (editButton.dataset.mode !== model.mode) {
        editButton.dataset.mode = model.mode;
        editButton.replaceChildren(editing ? checkIcon(doc) : pencilIcon(doc));
      }
      editButton.hidden = model.mismatch;
      status.textContent = statusLabel(model.status);
      status.dataset.tone = model.status ?? '';
      if (renderedId !== model.entryId || renderedMode !== model.mode) {
        renderedId = model.entryId;
        renderedBody = model.body;
        renderedMode = model.mode;
        title.replaceChildren();
        if (model.mode === 'edit') {
          titleField = doc.createElement('input');
          titleField.className = 'bfa-journal-title-field';
          titleField.style.width = '100%';
          titleField.value = model.title === 'Untitled entry' ? '' : model.title;
          titleField.setAttribute('aria-label', 'Title');
          titleField.addEventListener('input', () => handlers.onInput());
          title.append(titleField);
        } else {
          titleField = null;
          title.textContent = model.title;
        }
        body.replaceChildren();
        stickyTools.replaceChildren(status, typeSelect, editButton);
        body.append(stickyTools);
        appendBanners(doc, body, model, handlers);
        if (model.mode === 'edit') {
          textarea = appendEditor(
              doc,
              body,
              stickyTools,
              status,
              model,
              handlers,
              fileInput,
          );
        } else {
          textarea = null;
          body.append(readMarkdown(model));
        }
        appendMentions(doc, body, model, handlers);
        appendPicker(doc, body, model, handlers);
        if (modeScrollProgress !== null) {
          queueMicrotask(() => {
            if (renderedId !== model.entryId || renderedMode !== model.mode) {
              return;
            }

            if (model.mode === 'edit') {
              scroller.scrollTop = 0;
              restoreScrollProgress(textarea, modeScrollProgress);
            } else {
              restoreScrollProgress(scroller, modeScrollProgress);
            }
          });
        }
      } else {
        appendBanners(doc, body, model, handlers);
        if (renderedMode === 'read' && renderedBody !== model.body) {
          renderedBody = model.body;
          body.querySelector('.bfa-journal-read')?.replaceWith(readMarkdown(model));
        }
        syncImages(body, model);
        body.querySelector('.bfa-journal-picker')?.remove();
        appendPicker(doc, body, model, handlers);
      }
      body.querySelector('.bfa-journal-confirm')?.remove();
      footer.querySelector('.bfa-journal-confirm')?.remove();
      if (model.confirm?.kind === 'delete') {
        deleteButton.remove();
        showConfirm(doc, footer, model.confirm, handlers);
      } else {
        if (!footer.contains(deleteButton)) {
          footer.append(deleteButton);
        }
        if (model.confirm !== null) {
          showConfirm(doc, body, model.confirm, handlers);
        }
      }
      if (!root.contains(doc.activeElement)) {
        closeButton.focus();
      }
      placeJournalSidebar(root, shell.dialog, doc);
    },
    root,
    setDark,
    get textarea() {
      return textarea;
    },
    get titleField() {
      return titleField;
    },
  };
}

function scrollProgress(element: HTMLElement | null): number {
  if (element === null) {
    return 0;
  }

  const maximum = element.scrollHeight - element.clientHeight;
  if (maximum <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, element.scrollTop / maximum));
}

function restoreScrollProgress(element: HTMLElement | null, progress: number): void {
  if (element === null) {
    return;
  }

  const maximum = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTop = maximum * progress;
}

function appendEditor(
    doc: Document,
    body: HTMLElement,
    stickyTools: HTMLElement,
    status: HTMLElement,
    model: PanelModel,
    handlers: PanelHandlers,
    fileInput: HTMLInputElement,
): HTMLTextAreaElement {
  const toolbar = doc.createElement('div');
  toolbar.className = 'bfa-journal-format-bar';
  toolbar.setAttribute('aria-label', 'Formatting');
  const formats: readonly [string, JournalFormatKind | 'image'][] = [
    ['Bold', 'bold'],
    ['Italic', 'italic'],
    ['Heading', 'heading'],
    ['List', 'list'],
    ['Checkbox', 'checkbox'],
    ['Link', 'link'],
    ['Image', 'image'],
  ];
  const field = doc.createElement('div');
  field.className = `${SIDEBAR_TEXTAREA_CLASS} bfa-journal-editor-field`;
  field.dataset.value = model.body;
  const textarea = doc.createElement('textarea');
  textarea.className = 'bfa-journal-editor';
  textarea.rows = 1;
  textarea.style.width = '100%';
  textarea.value = model.body;
  textarea.setAttribute('aria-label', 'Note');
  textarea.addEventListener('input', () => {
    field.dataset.value = textarea.value;
    handlers.onInput();
  });
  textarea.addEventListener('paste', (event) => {
    const files = imageFiles(event.clipboardData?.files);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    handlers.onImages(files, caret(textarea));
  });
  textarea.addEventListener('dragover', (event) => {
    const types = event.dataTransfer?.types;
    if (types !== undefined && [...types].includes('Files')) {
      event.preventDefault();
    }
  });
  textarea.addEventListener('drop', (event) => {
    const files = imageFiles(event.dataTransfer?.files);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    const index = textareaDropIndex(textarea, event.clientX, event.clientY);
    handlers.onImages(files, {end: index, start: index});
  });
  field.append(textarea);
  let pendingInsert: {end: number; start: number} | null = null;
  const imageMenu = doc.createElement('div');
  imageMenu.className = 'bfa-journal-image-menu';
  imageMenu.hidden = true;
  imageMenu.setAttribute('role', 'menu');
  const uploadPhoto = doc.createElement('button');
  uploadPhoto.type = 'button';
  uploadPhoto.className = 'bfa-journal-button';
  uploadPhoto.textContent = 'Upload photo';
  uploadPhoto.setAttribute('role', 'menuitem');
  const fromPhotos = doc.createElement('button');
  fromPhotos.type = 'button';
  fromPhotos.className = 'bfa-journal-button';
  fromPhotos.textContent = 'From photos';
  fromPhotos.setAttribute('role', 'menuitem');
  imageMenu.append(uploadPhoto, fromPhotos);
  toolbar.append(imageMenu);
  uploadPhoto.addEventListener('click', () => {
    imageMenu.hidden = true;
    fileInput.click();
  });
  fromPhotos.addEventListener('click', () => {
    imageMenu.hidden = true;
    const start = Number(fileInput.dataset.bfaInsertStart);
    const end = Number(fileInput.dataset.bfaInsertEnd);
    const length = textarea?.value.length ?? 0;
    const position = Number.isFinite(start) && Number.isFinite(end)
      ? {end, start}
      : {end: length, start: length};
    handlers.onLibraryPick(position);
  });
  for (const [label, kind] of formats) {
    const control = iconButton(doc, label, journalIcon(doc, FORMAT_ICONS[kind]));
    control.addEventListener('mousedown', () => {
      if (kind === 'image') {
        pendingInsert = caret(textarea);
      }
    });
    control.addEventListener('click', () => {
      if (kind === 'image') {
        const position = pendingInsert ?? caret(textarea);
        pendingInsert = null;
        fileInput.dataset.bfaInsertStart = String(position.start);
        fileInput.dataset.bfaInsertEnd = String(position.end);
        imageMenu.hidden = !imageMenu.hidden;
        return;
      }
      imageMenu.hidden = true;

      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      const next = applyJournalFormat(textarea.value, start, end, kind);
      textarea.value = next.value;
      textarea.focus();
      textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
      handlers.onInput();
    });
    toolbar.append(control);
  }
  const imageError = doc.createElement('p');
  imageError.className = 'bfa-journal-alert bfa-journal-image-error';
  imageError.setAttribute('role', 'alert');
  imageError.hidden = model.imageError === null;
  imageError.textContent = model.imageError ?? '';
  stickyTools.insertBefore(toolbar, status);
  body.append(imageError, field);
  return textarea;
}

function appendBanners(
    doc: Document,
    body: HTMLElement,
    model: PanelModel,
    handlers: PanelHandlers,
): void {
  body.querySelector('.bfa-journal-banner')?.remove();
  if (model.mismatch) {
    const banner = bannerElement(doc, 'This note belongs to another character. It will not be saved on this sheet.');
    const discard = button(doc, 'Discard', 'bfa-journal-button');
    discard.addEventListener('click', () => handlers.onClose());
    banner.append(discard);
    body.prepend(banner);
    return;
  }

  if (model.stale) {
    const banner = bannerElement(
        doc,
        model.error ?? 'This note has a newer saved copy. Your draft is still here.',
    );
    const save = button(doc, 'Save', 'bfa-journal-button');
    save.addEventListener('click', () => handlers.onStaleSave());
    const reload = button(doc, 'Discard draft', 'bfa-journal-button');
    reload.addEventListener('click', () => handlers.onReload());
    const keepBoth = button(doc, 'Keep both', 'bfa-journal-button');
    keepBoth.addEventListener('click', () => handlers.onKeepBoth());
    banner.append(save, reload, keepBoth);
    body.prepend(banner);
    return;
  }

  if (model.error !== null) {
    body.prepend(bannerElement(doc, model.error));
  }
}

function caret(textarea: HTMLTextAreaElement): {end: number; start: number} {
  const start = textarea.selectionStart ?? textarea.value.length;
  return {
    end: textarea.selectionEnd ?? start,
    start,
  };
}

function imageFiles(list: FileList | undefined): File[] {
  if (list === undefined) {
    return [];
  }

  return [...list].filter((file) =>
    file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp',
  );
}

function textareaDropIndex(textarea: HTMLTextAreaElement, x: number, y: number): number {
  const doc = textarea.ownerDocument as Document & {
    caretPositionFromPoint?: (clientX: number, clientY: number) => {
      offset: number;
      offsetNode: Node;
    } | null;
    caretRangeFromPoint?: (clientX: number, clientY: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(x, y);
  if (position?.offsetNode === textarea) {
    return clampIndex(position.offset, textarea.value.length);
  }

  const range = doc.caretRangeFromPoint?.(x, y);
  if (range?.startContainer === textarea || range?.startContainer.parentNode === textarea) {
    return clampIndex(range.startOffset, textarea.value.length);
  }

  return textarea.selectionStart ?? textarea.value.length;
}

function clampIndex(value: number, length: number): number {
  if (!Number.isFinite(value)) {
    return length;
  }

  return Math.min(Math.max(value, 0), length);
}

function syncImages(body: HTMLElement, model: PanelModel): void {
  const error = body.querySelector<HTMLElement>('.bfa-journal-image-error');
  if (error !== null) {
    error.hidden = model.imageError === null;
    error.textContent = model.imageError ?? '';
  }
}

function appendPicker(
    doc: Document,
    body: HTMLElement,
    model: PanelModel,
    handlers: PanelHandlers,
): void {
  if (model.picker === null || model.picker.length === 0) {
    return;
  }

  const picker = doc.createElement('div');
  picker.className = 'bfa-journal-picker';
  const label = doc.createElement('p');
  label.textContent = model.pickerTitle ?? 'Two notes share this name';
  picker.append(label);
  for (const choice of model.picker) {
    const item = button(doc, choice.label, 'bfa-journal-mention-button');
    item.addEventListener('click', () => handlers.onPick(choice.id));
    picker.append(item);
  }
  body.append(picker);
}

function appendMentions(
    doc: Document,
    body: HTMLElement,
    model: PanelModel,
    handlers: PanelHandlers,
): void {
  if (model.mentions.length === 0) {
    return;
  }

  const block = doc.createElement('section');
  block.className = 'bfa-journal-backlinks';
  const label = doc.createElement('h3');
  label.textContent = 'Mentioned in';
  block.append(label);
  for (const mention of model.mentions) {
    const item = button(doc, mention.label, 'bfa-journal-mention-button');
    item.addEventListener('click', () => handlers.onMention(mention.id));
    block.append(item);
  }
  body.append(block);
}

function showConfirm(
    doc: Document,
    host: HTMLElement,
    confirm: PanelConfirmModel,
    handlers: PanelHandlers,
): void {
  host.querySelector('.bfa-journal-confirm')?.remove();
  const dialog = doc.createElement('div');
  dialog.className = 'bfa-journal-confirm';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-label', confirm.question);
  const question = doc.createElement('p');
  question.textContent = confirm.question;
  const safe = button(doc, confirm.safe, 'bfa-journal-button');
  const danger = button(doc, confirm.danger, 'bfa-journal-button bfa-journal-button-danger');
  const actions = doc.createElement('div');
  actions.className = 'bfa-journal-confirm-actions';
  safe.addEventListener('click', () => handlers.onConfirm(false));
  danger.addEventListener('click', () => handlers.onConfirm(true));
  actions.append(safe, danger);
  dialog.append(question, actions);
  host.prepend(dialog);
  if (typeof dialog.scrollIntoView === 'function') {
    dialog.scrollIntoView({block: 'nearest'});
  }
  safe.focus();
}

function bannerElement(doc: Document, text: string): HTMLElement {
  const banner = doc.createElement('div');
  banner.className = 'bfa-journal-banner';
  banner.setAttribute('role', 'alert');
  const copy = doc.createElement('p');
  copy.textContent = text;
  banner.append(copy);
  return banner;
}

function statusLabel(status: PanelModel['status']): string {
  if (status === 'saving') {
    return 'Saving…';
  }

  if (status === 'saved') {
    return 'Saved';
  }

  if (status === 'error') {
    return 'Not saved';
  }

  return '';
}

const PANEL_TYPES = ['session', 'npc', 'place', 'item', 'quest', 'backstory'] as const;

function isPanelType(value: string): value is JournalEntryType {
  return (PANEL_TYPES as readonly string[]).includes(value);
}

function iconButton(doc: Document, label: string, icon: SVGElement): HTMLButtonElement {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = 'bfa-journal-icon-button';
  element.setAttribute('aria-label', label);
  element.title = label;
  element.append(icon);
  return element;
}

function button(doc: Document, label: string, className: string): HTMLButtonElement {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}
