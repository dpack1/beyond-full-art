import {trapTabKey} from '../fullscreen-viewer/focus';
import {applyJournalFormat, type JournalFormatKind} from './character-journal-format';
import {renderJournalMarkdown} from './character-journal-markdown';
import {journalTypeLabel} from './character-journal-query';
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
  onCheckbox: (index: number, checked: boolean) => void;
  onClose: () => void;
  onConfirm: (accepted: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
  onImage: (file: File) => void;
  onInput: () => void;
  onMention: (entryId: string) => void;
  onPick: (entryId: string) => void;
  onReload: () => void;
  onRemoveImage: (imageId: string) => void;
  onType: (type: JournalEntryType) => void;
  onViewImage: (imageId: string, returnFocus: HTMLElement) => void;
  onWiki: (name: string, resolution: string, anchor: HTMLElement) => void;
  resolveWiki: (name: string) => 'many' | 'missing' | 'one';
}

export interface JournalPanelView {
  fileInput: HTMLInputElement;
  readDraft(): {body: string; title: string};
  render(model: PanelModel): void;
  root: HTMLElement;
  textarea: HTMLTextAreaElement | null;
  titleField: HTMLInputElement | null;
}

export function createJournalPanel(
    doc: Document,
    handlers: PanelHandlers,
    imageUrl: (imageId: string) => string | null,
    imagesFor: () => {id: string}[],
): JournalPanelView {
  const root = doc.createElement('div');
  root.className = 'bfa-journal-panel';
  root.dataset.bfaJournalPanel = 'true';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.tabIndex = -1;

  const chrome = doc.createElement('div');
  chrome.className = 'bfa-journal-pane-chrome';
  chrome.dataset.bfaJournalPaneControl = 'true';
  const backButton = button(doc, '‹', 'bfa-journal-pane-back');
  backButton.setAttribute('aria-label', 'Back');
  backButton.hidden = true;
  const closeButton = button(doc, '×', 'bfa-journal-close bfa-journal-pane-close');
  closeButton.setAttribute('aria-label', 'Close');
  chrome.append(backButton, closeButton);

  const sheet = doc.createElement('div');
  sheet.className = 'bfa-journal-panel-sheet';
  const header = doc.createElement('header');
  header.className = 'bfa-journal-panel-header';
  const actions = doc.createElement('div');
  actions.className = 'bfa-journal-panel-actions';
  const title = doc.createElement('h2');
  title.className = 'bfa-journal-panel-title';
  const editButton = button(doc, 'Edit', 'bfa-journal-button');
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
  actions.append(editButton, typeSelect, tag, needs, status);
  header.append(title, actions);

  const body = doc.createElement('div');
  body.className = 'bfa-journal-panel-body';
  const footer = doc.createElement('footer');
  footer.className = 'bfa-journal-panel-footer';
  const deleteButton = button(doc, 'Delete note', 'bfa-journal-button bfa-journal-button-danger');
  footer.append(deleteButton);
  sheet.append(header, body, footer);
  root.append(chrome, sheet);

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
      images: imagesFor(),
      onCheckbox: handlers.onCheckbox,
      resolveWiki: handlers.resolveWiki,
    });
    bindWikiLinks(read);
    return read;
  }

  closeButton.addEventListener('click', () => handlers.onClose());
  backButton.addEventListener('click', () => handlers.onBack());
  editButton.addEventListener('click', () => handlers.onEdit());
  deleteButton.addEventListener('click', () => handlers.onDelete());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file !== undefined) {
      handlers.onImage(file);
    }
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
    readDraft() {
      return {
        body: textarea?.value ?? '',
        title: titleField?.value ?? title.textContent ?? '',
      };
    },
    render(model) {
      root.hidden = false;
      root.setAttribute('aria-label', model.title || 'Journal note');
      backButton.hidden = !model.back;
      tag.hidden = true;
      typeSelect.dataset.bfaJournalType = model.type;
      const unsetOption = typeSelect.querySelector<HTMLOptionElement>('option[value="unset"]');
      if (unsetOption !== null) {
        unsetOption.disabled = model.type !== 'unset';
      }
      typeSelect.value = model.type;
      needs.hidden = !model.needsDetails;
      editButton.textContent = model.mode === 'edit' ? 'Done editing' : 'Edit';
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
        appendBanners(doc, body, model, handlers);
        if (model.mode === 'edit') {
          textarea = appendEditor(doc, body, model, handlers, fileInput);
        } else {
          textarea = null;
          body.append(readMarkdown(model));
        }
        appendImages(doc, body, model, handlers);
        appendMentions(doc, body, model, handlers);
        appendPicker(doc, body, model, handlers);
      } else {
        appendBanners(doc, body, model, handlers);
        if (renderedMode === 'read' && renderedBody !== model.body) {
          renderedBody = model.body;
          body.querySelector('.bfa-journal-read')?.replaceWith(readMarkdown(model));
        }
        syncImages(body, model);
        body.querySelector('.bfa-journal-picker')?.remove();
        appendPicker(doc, body, model, handlers);
        const currentImages = [...body.querySelectorAll<HTMLElement>('[data-image-id]')]
            .map((element) => element.dataset.imageId)
            .join(',');
        const nextImages = model.images.map((image) => image.id).join(',');
        if (currentImages !== nextImages) {
          body.querySelector('.bfa-journal-strip')?.remove();
          appendImages(doc, body, model, handlers);
        }
      }
      if (model.confirm !== null) {
        showConfirm(doc, body, model.confirm, handlers);
      } else {
        body.querySelector('.bfa-journal-confirm')?.remove();
      }
      if (!root.contains(doc.activeElement)) {
        closeButton.focus();
      }
    },
    root,
    get textarea() {
      return textarea;
    },
    get titleField() {
      return titleField;
    },
  };
}

function appendEditor(
    doc: Document,
    body: HTMLElement,
    model: PanelModel,
    handlers: PanelHandlers,
    fileInput: HTMLInputElement,
): HTMLTextAreaElement {
  const toolbar = doc.createElement('div');
  toolbar.className = 'bfa-journal-toolbar';
  const formats: readonly [string, JournalFormatKind | 'image'][] = [
    ['Bold', 'bold'],
    ['Italic', 'italic'],
    ['Heading', 'heading'],
    ['List', 'list'],
    ['Checkbox', 'checkbox'],
    ['Link', 'link'],
    ['Image', 'image'],
  ];
  const textarea = doc.createElement('textarea');
  textarea.className = 'bfa-journal-editor';
  textarea.style.width = '100%';
  textarea.value = model.body;
  textarea.setAttribute('aria-label', 'Note');
  textarea.addEventListener('input', () => handlers.onInput());
  for (const [label, kind] of formats) {
    const control = button(doc, label, 'bfa-journal-button bfa-journal-toolbar-button');
    control.addEventListener('click', () => {
      if (kind === 'image') {
        fileInput.click();
        return;
      }

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
  body.append(toolbar, imageError, textarea);
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
    const banner = bannerElement(doc, 'This note was updated in another window. Your draft is still here.');
    const reload = button(doc, 'Reload saved note', 'bfa-journal-button');
    reload.addEventListener('click', () => handlers.onReload());
    banner.append(reload);
    body.prepend(banner);
    return;
  }

  if (model.error !== null) {
    body.prepend(bannerElement(doc, model.error));
  }
}

function appendImages(
    doc: Document,
    body: HTMLElement,
    model: PanelModel,
    handlers: PanelHandlers,
): void {
  if (model.images.length === 0) {
    return;
  }

  const strip = doc.createElement('div');
  strip.className = 'bfa-journal-strip';
  for (const image of model.images) {
    const tile = doc.createElement('figure');
    tile.className = 'bfa-journal-strip-tile';
    tile.dataset.imageId = image.id;
    if (image.url !== null) {
      const picture = doc.createElement(model.mode === 'read' ? 'button' : 'div');
      if (picture instanceof HTMLButtonElement) {
        picture.type = 'button';
        picture.className = 'bfa-journal-strip-open';
        picture.setAttribute('aria-label', `View photo ${image.fileName}`);
        picture.addEventListener('click', () => {
          handlers.onViewImage(image.id, picture);
        });
      }
      const img = doc.createElement('img');
      img.alt = image.fileName;
      img.src = image.url;
      picture.append(img);
      tile.append(picture);
    }
    const caption = doc.createElement('figcaption');
    caption.textContent = image.fileName;
    tile.append(caption);
    if (model.mode === 'edit') {
      const remove = button(doc, 'Remove', 'bfa-journal-button bfa-journal-button-danger bfa-journal-remove');
      remove.addEventListener('click', () => handlers.onRemoveImage(image.id));
      tile.append(remove);
    }
    strip.append(tile);
  }
  body.append(strip);
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
    body: HTMLElement,
    confirm: PanelConfirmModel,
    handlers: PanelHandlers,
): void {
  body.querySelector('.bfa-journal-confirm')?.remove();
  const dialog = doc.createElement('div');
  dialog.className = 'bfa-journal-confirm';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-label', confirm.question);
  const question = doc.createElement('p');
  question.textContent = confirm.question;
  const safe = button(doc, confirm.safe, 'bfa-journal-button');
  const danger = button(doc, confirm.danger, 'bfa-journal-button bfa-journal-button-danger');
  safe.addEventListener('click', () => handlers.onConfirm(false));
  danger.addEventListener('click', () => handlers.onConfirm(true));
  dialog.append(question, safe, danger);
  body.prepend(dialog);
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

function button(doc: Document, label: string, className: string): HTMLButtonElement {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}
