import {describe, expect, it} from 'vitest';

import {
  createJournalPanel,
  type PanelHandlers,
  type PanelModel,
} from '../../src/features/character-journal/character-journal-panel';

describe('journal image cursor', () => {
  it('asks for an image at the textarea cursor, including paste and drop', () => {
    const seen: {end: number; name: string; start: number}[] = [];
    const view = createJournalPanel(document, handlers(seen), () => null, () => []);
    document.body.append(view.root);
    view.render(editModel('Hello world'));
    const textarea = view.textarea;
    const imageButton = view.root.querySelector<HTMLButtonElement>('[aria-label="Image"]');
    if (textarea === null || imageButton === null) {
      throw new Error('Missing editor');
    }

    textarea.setSelectionRange(6, 6);
    imageButton.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    imageButton.click();
    const file = new File(['abc'], 'door.png', {type: 'image/png'});
    Object.defineProperty(view.fileInput, 'files', {
      configurable: true,
      value: fileList(file),
    });
    view.fileInput.dispatchEvent(new Event('change', {bubbles: true}));
    expect(seen).toEqual([{end: 6, name: 'door.png', start: 6}]);

    textarea.setSelectionRange(1, 1);
    const paste = new Event('paste', {bubbles: true, cancelable: true});
    Object.defineProperty(paste, 'clipboardData', {
      value: {files: fileList(new File(['abc'], 'paste.png', {type: 'image/png'}))},
    });
    textarea.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(seen[1]).toEqual({end: 1, name: 'paste.png', start: 1});

    textarea.setSelectionRange(4, 4);
    const drop = new Event('drop', {bubbles: true, cancelable: true});
    Object.defineProperty(drop, 'clientX', {value: 0});
    Object.defineProperty(drop, 'clientY', {value: 0});
    Object.defineProperty(drop, 'dataTransfer', {
      value: {
        files: fileList(new File(['abc'], 'drop.png', {type: 'image/png'})),
        types: ['Files'],
      },
    });
    textarea.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(seen[2]).toEqual({end: 4, name: 'drop.png', start: 4});
    view.root.remove();
  });
});

function fileList(file: File): FileList {
  return {
    0: file,
    length: 1,
    item: (index: number) => index === 0 ? file : null,
    *[Symbol.iterator]() {
      yield file;
    },
  } as unknown as FileList;
}

function editModel(body: string): PanelModel {
  return {
    back: false,
    body,
    confirm: null,
    entryId: 'note-1',
    error: null,
    imageError: null,
    images: [],
    mentions: [],
    mismatch: false,
    mode: 'edit',
    needsDetails: false,
    next: false,
    picker: null,
    pickerTitle: null,
    stale: false,
    status: null,
    title: 'Camp',
    type: 'session',
    typeLabel: 'Session',
  };
}

function handlers(
    seen: {end: number; name: string; start: number}[],
): PanelHandlers {
  return {
    onBack: () => undefined,
    onCheckbox: () => undefined,
    onClose: () => undefined,
    onConfirm: () => undefined,
    onDelete: () => undefined,
    onEdit: () => undefined,
    onImages: (files, position) => {
      const file = files[0];
      if (file !== undefined) {
        seen.push({end: position.end, name: file.name, start: position.start});
      }
    },
    onInput: () => undefined,
    onLibraryPick: () => undefined,
    onKeepBoth: () => undefined,
    onMention: () => undefined,
    onNext: () => undefined,
    onPick: () => undefined,
    onReload: () => undefined,
    onStaleSave: () => undefined,
    onRemoveImage: () => undefined,
    onType: () => undefined,
    onViewImage: () => undefined,
    onWiki: () => undefined,
    resolveWiki: () => 'missing',
  };
}
