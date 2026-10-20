import type {JournalNote} from './character-journal-types';

export interface WikiAutocomplete {
  dismiss(): void;
  isOpen(): boolean;
  watch(
    field: HTMLInputElement | HTMLTextAreaElement,
    onCreate: (name: string) => void,
  ): void;
}

export function createWikiAutocomplete(
    doc: Document,
    getNotes: () => readonly JournalNote[],
): WikiAutocomplete {
  const listbox = doc.createElement('div');
  listbox.className = 'bfa-journal-autocomplete';
  listbox.hidden = true;
  listbox.setAttribute('role', 'listbox');
  listbox.tabIndex = -1;
  let activeIndex = 0;
  let field: HTMLInputElement | HTMLTextAreaElement | null = null;
  let onCreate: ((name: string) => void) | null = null;

  const onInput = () => {
    render();
  };
  const onKeyDown = (event: Event) => {
    if (!(event instanceof KeyboardEvent) || listbox.hidden) {
      return;
    }

    const options = [...listbox.querySelectorAll<HTMLButtonElement>('button')];
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + delta + options.length) % Math.max(options.length, 1);
      paintActive(options, activeIndex);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      options[activeIndex]?.click();
    }
  };

  return {
    dismiss,
    isOpen() {
      return !listbox.hidden;
    },
    watch(nextField, create) {
      unwatch();
      field = nextField;
      onCreate = create;
      field.addEventListener('input', onInput);
      field.addEventListener('keydown', onKeyDown);
      field.parentElement?.append(listbox);
    },
  };

  function unwatch(): void {
    field?.removeEventListener('input', onInput);
    field?.removeEventListener('keydown', onKeyDown);
    dismiss();
  }

  function dismiss(): void {
    listbox.hidden = true;
    listbox.replaceChildren();
  }

  function render(): void {
    if (field === null) {
      return;
    }

    const partial = wikiPartial(field.value, field.selectionStart ?? field.value.length);
    if (partial === null) {
      dismiss();
      return;
    }

    const needle = partial.trim().toLocaleLowerCase();
    const matches = getNotes()
        .filter((note) => needle === '' || note.title.toLocaleLowerCase().includes(needle))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 8);
    listbox.replaceChildren();
    for (const note of matches) {
      listbox.append(optionButton(note.title, note.type, () => {
        insertWiki(field, note.title);
        dismiss();
        field?.dispatchEvent(new Event('input'));
      }));
    }

    const createName = partial.trim();
    if (createName !== '') {
      const create = optionButton(`Create “${createName}”`, '', () => {
        insertWiki(field, createName);
        dismiss();
        onCreate?.(createName);
      });
      create.classList.add('bfa-journal-autocomplete-create');
      listbox.append(create);
    }

    activeIndex = 0;
    paintActive([...listbox.querySelectorAll('button')], activeIndex);
    listbox.hidden = listbox.childElementCount === 0;
  }

  function optionButton(
      label: string,
      type: string,
      onChoose: () => void,
  ): HTMLButtonElement {
    const button = field?.ownerDocument.createElement('button')
      ?? document.createElement('button');
    button.type = 'button';
    button.className = 'bfa-journal-autocomplete-option';
    button.setAttribute('role', 'option');
    if (type !== '') {
      const tag = button.ownerDocument.createElement('span');
      tag.className = 'bfa-journal-autocomplete-type';
      tag.textContent = type;
      button.append(tag, button.ownerDocument.createTextNode(` ${label}`));
    } else {
      button.textContent = label;
    }

    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    button.addEventListener('click', onChoose);
    return button;
  }
}

function paintActive(
    options: readonly HTMLButtonElement[],
    activeIndex: number,
): void {
  options.forEach((option, index) => {
    const active = index === activeIndex;
    option.classList.toggle('is-active', active);
    if (active) {
      option.setAttribute('aria-selected', 'true');
    } else {
      option.removeAttribute('aria-selected');
    }
  });
}

function wikiPartial(value: string, caret: number): string | null {
  const before = value.slice(0, caret);
  const open = before.lastIndexOf('[[');
  if (open === -1) {
    return null;
  }

  const partial = before.slice(open + 2);
  if (partial.includes(']') || partial.includes('\n')) {
    return null;
  }

  return partial;
}

function insertWiki(
    field: HTMLInputElement | HTMLTextAreaElement | null,
    title: string,
): void {
  if (field === null) {
    return;
  }

  const caret = field.selectionStart ?? field.value.length;
  const before = field.value.slice(0, caret);
  const open = before.lastIndexOf('[[');
  if (open === -1) {
    return;
  }

  field.value = `${field.value.slice(0, open)}[[${title}]]${field.value.slice(caret)}`;
  const position = open + title.length + 4;
  field.setSelectionRange(position, position);
  field.focus();
}
