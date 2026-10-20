import {Lexer, type Token, type Tokens} from 'marked';

import {wikiLinkNames} from './character-journal-links';

const WIKI_PLACEHOLDER = /\uE000WIKI(\d+)\uE001/g;
const TASK_LINE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](.*)$/;
const JOURNAL_IMAGE = /^bfa-journal-image:([A-Za-z0-9-]+)$/;

export interface JournalMarkdownImage {
  id: string;
}

export interface RenderJournalMarkdownOptions {
  document: Document;
  imageUrl: (imageId: string) => string | null;
  images: readonly JournalMarkdownImage[];
  onCheckbox?: (index: number, checked: boolean) => void;
  resolveWiki: (name: string) => 'many' | 'missing' | 'one';
}

export function renderJournalMarkdown(
    body: string,
    options: RenderJournalMarkdownOptions,
): HTMLElement {
  const root = options.document.createElement('div');
  root.className = 'bfa-journal-read';
  const prepared = prepareJournalMarkdown(body);
  const tokens = lexJournal(prepared.source);
  const taskIndex = {value: 0};
  for (const token of tokens) {
    appendToken(root, token, options, prepared.names, taskIndex);
  }

  return root;
}

export function journalPlainText(body: string): string {
  const prepared = prepareJournalMarkdown(body);
  const tokens = lexJournal(prepared.source);
  const parts: string[] = [];
  collectText(tokens, parts, prepared.names);
  return stripPlainMarkers(parts.join(' ').replace(/\s+/g, ' ').trim());
}

function lexJournal(source: string): Token[] {
  const instance = new Lexer({gfm: true});
  // HTML in a note is text. marked marks the tokenizer private; the
  // assignment is the supported way to turn those rules off.
  const tokenizer = (instance as unknown as {
    tokenizer: {
      html: () => undefined;
      tag: () => undefined;
    };
  }).tokenizer;
  tokenizer.html = () => undefined;
  tokenizer.tag = () => undefined;
  return instance.lex(source);
}

function stripPlainMarkers(value: string): string {
  return value
      .replace(/\[\[([^\]\n]{1,200})\]\]/g, '$1')
      .replace(/(^|[^A-Za-z0-9-])#([A-Za-z0-9-]{1,40})(?![A-Za-z0-9-])/g, '$1$2');
}

export function previewJournalText(body: string, limit = 90): string {
  const plain = journalPlainText(body);
  const clusters = graphemeClusters(plain);
  if (clusters.length <= limit) {
    return plain;
  }

  return `${clusters.slice(0, limit - 1).join('')}…`;
}

export function patchTaskCheckbox(
    body: string,
    taskIndex: number,
    checked: boolean,
): string | null {
  const lines = body.split('\n');
  let seen = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const match = TASK_LINE.exec(line);
    if (match === null) {
      continue;
    }

    if (seen === taskIndex) {
      const mark = checked ? 'x' : ' ';
      lines[index] = `${match[1]}[${mark}]${match[3] ?? ''}`;
      return lines.join('\n');
    }

    seen += 1;
  }

  return null;
}

export function journalImageReference(fileName: string, imageId: string): string {
  const safeName = fileName.replace(/[\[\]]/g, '').trim() || 'Photo';
  return `![${safeName}](bfa-journal-image:${imageId})`;
}

export function removeJournalImageLine(body: string, imageId: string): string {
  const escaped = imageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
      `\\n?!\\[[^\\]]*\\]\\(bfa-journal-image:${escaped}\\)\\n?`,
      'g',
  );
  return body.replace(pattern, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function prepareJournalMarkdown(body: string): {names: string[]; source: string} {
  const names: string[] = [];
  const shielded = shieldCode(body);
  const withWiki = shielded.text.replace(
      /\[\[([^\]\n]{1,200})\]\]/g,
      (_token, raw: string) => {
        const name = raw.trim();
        if (name === '' || name.length > 200) {
          return _token;
        }

        const index = names.length;
        names.push(name);
        return `\uE000WIKI${index}\uE001`;
      },
  );
  return {
    names,
    source: restoreShields(withWiki, shielded.slots),
  };
}

function appendToken(
    parent: HTMLElement,
    token: Token,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
    taskIndex: {value: number},
): void {
  const doc = options.document;
  switch (token.type) {
    case 'space':
      return;
    case 'paragraph':
      appendChildren(parent, doc.createElement('p'), token.tokens, options, names, taskIndex);
      return;
    case 'heading': {
      const heading = token as Tokens.Heading;
      const level = Math.min(Math.max(heading.depth, 1), 3);
      const element = doc.createElement(`h${level}`);
      appendInline(element, heading.tokens, options, names);
      parent.append(element);
      return;
    }
    case 'blockquote':
      appendChildren(
          parent,
          doc.createElement('blockquote'),
          (token as Tokens.Blockquote).tokens,
          options,
          names,
          taskIndex,
      );
      return;
    case 'list':
      appendList(parent, token as Tokens.List, options, names, taskIndex);
      return;
    case 'code': {
      const pre = doc.createElement('pre');
      const code = doc.createElement('code');
      code.textContent = (token as Tokens.Code).text;
      pre.append(code);
      parent.append(pre);
      return;
    }
    case 'html':
      parent.append(doc.createTextNode((token as Tokens.HTML).raw));
      return;
    case 'image':
    case 'link':
    case 'strong':
    case 'em':
    case 'codespan':
    case 'br':
    case 'del':
      appendInlineToken(parent, token, options, names);
      return;
    case 'text':
      appendTextToken(parent, token as Tokens.Text, options, names);
      return;
    default:
      appendUnknown(parent, token, options, names, taskIndex);
  }
}

function appendList(
    parent: HTMLElement,
    token: Tokens.List,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
    taskIndex: {value: number},
): void {
  const list = options.document.createElement(token.ordered ? 'ol' : 'ul');
  const start = Number(token.start);
  if (list instanceof HTMLOListElement && Number.isFinite(start) && start !== 1) {
    list.start = start;
  }

  for (const item of token.items) {
    const li = options.document.createElement('li');
    if (item.task) {
      const box = options.document.createElement('input');
      const index = taskIndex.value;
      taskIndex.value += 1;
      box.type = 'checkbox';
      box.checked = item.checked === true;
      box.className = 'bfa-journal-task';
      box.addEventListener('change', () => {
        options.onCheckbox?.(index, box.checked);
      });
      li.append(box, options.document.createTextNode(' '));
    }

    appendInline(li, item.tokens, options, names);
    list.append(li);
  }

  parent.append(list);
}

function appendChildren(
    parent: HTMLElement,
    element: HTMLElement,
    tokens: Token[] | undefined,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
    taskIndex: {value: number},
): void {
  for (const token of tokens ?? []) {
    appendToken(element, token, options, names, taskIndex);
  }

  parent.append(element);
}

function appendInline(
    parent: HTMLElement,
    tokens: Token[] | undefined,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
): void {
  for (const token of tokens ?? []) {
    appendInlineToken(parent, token, options, names);
  }
}

function appendInlineToken(
    parent: HTMLElement,
    token: Token,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
): void {
  const doc = options.document;
  switch (token.type) {
    case 'text':
    case 'escape':
      appendPlaceholderText(parent, token.text ?? '', options, names);
      return;
    case 'strong':
      appendChildrenInline(parent, doc.createElement('strong'), (token as Tokens.Strong).tokens, options, names);
      return;
    case 'em':
      appendChildrenInline(parent, doc.createElement('em'), (token as Tokens.Em).tokens, options, names);
      return;
    case 'codespan': {
      const code = doc.createElement('code');
      code.textContent = (token as Tokens.Codespan).text;
      parent.append(code);
      return;
    }
    case 'br':
      parent.append(doc.createElement('br'));
      return;
    case 'link':
      appendLink(parent, token as Tokens.Link, options, names);
      return;
    case 'image':
      appendImage(parent, token as Tokens.Image, options);
      return;
    case 'html':
      parent.append(doc.createTextNode((token as Tokens.HTML).raw));
      return;
    case 'del':
      appendInline(parent, (token as Tokens.Del).tokens, options, names);
      return;
    default:
      if ('tokens' in token && Array.isArray(token.tokens)) {
        appendInline(parent, token.tokens, options, names);
        return;
      }

      if ('text' in token && typeof token.text === 'string') {
        parent.append(doc.createTextNode(token.text));
      }
  }
}

function appendTextToken(
    parent: HTMLElement,
    token: Tokens.Text,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
): void {
  if (token.tokens !== undefined && token.tokens.length > 0) {
    appendInline(parent, token.tokens, options, names);
    return;
  }

  appendPlaceholderText(parent, token.text, options, names);
}

function appendChildrenInline(
    parent: HTMLElement,
    element: HTMLElement,
    tokens: Token[] | undefined,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
): void {
  appendInline(element, tokens, options, names);
  parent.append(element);
}

function appendPlaceholderText(
    parent: HTMLElement,
    text: string,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
): void {
  const doc = options.document;
  let cursor = 0;
  for (const match of text.matchAll(WIKI_PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parent.append(doc.createTextNode(text.slice(cursor, index)));
    }

    const name = names[Number(match[1])] ?? '';
    parent.append(createWikiButton(doc, name, options.resolveWiki(name)));
    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    parent.append(doc.createTextNode(text.slice(cursor)));
  }
}

function createWikiButton(
    doc: Document,
    name: string,
    resolution: 'many' | 'missing' | 'one',
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'bfa-journal-wikilink';
  button.dataset.bfaWikiName = name;
  button.dataset.bfaWikiResolution = resolution;
  button.textContent = name;
  if (resolution === 'missing') {
    button.classList.add('bfa-journal-wikilink--needs');
    button.setAttribute('aria-label', `${name}, needs details`);
  } else {
    button.setAttribute('aria-label', name);
  }

  return button;
}

function appendLink(
    parent: HTMLElement,
    token: Tokens.Link,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
): void {
  const href = safeHttpUrl(token.href);
  if (href === null) {
    appendInline(parent, token.tokens, options, names);
    return;
  }

  const anchor = options.document.createElement('a');
  anchor.href = href;
  anchor.rel = 'noopener noreferrer';
  anchor.target = '_blank';
  appendInline(anchor, token.tokens, options, names);
  parent.append(anchor);
}

function appendImage(
    parent: HTMLElement,
    token: Tokens.Image,
    options: RenderJournalMarkdownOptions,
): void {
  const doc = options.document;
  const match = JOURNAL_IMAGE.exec(token.href.trim());
  const imageId = match?.[1];
  const known = imageId !== undefined
    && options.images.some((image) => image.id === imageId);
  const url = known && imageId !== undefined ? options.imageUrl(imageId) : null;
  if (!known || url === null || imageId === undefined) {
    parent.append(doc.createTextNode('Image not loaded'));
    return;
  }

  const image = doc.createElement('img');
  image.src = url;
  image.alt = token.text;
  image.className = 'bfa-journal-inline-image';
  parent.append(image);
}

function appendUnknown(
    parent: HTMLElement,
    token: Token,
    options: RenderJournalMarkdownOptions,
    names: readonly string[],
    taskIndex: {value: number},
): void {
  if ('tokens' in token && Array.isArray(token.tokens)) {
    for (const child of token.tokens) {
      appendToken(parent, child, options, names, taskIndex);
    }
    return;
  }

  if ('text' in token && typeof token.text === 'string') {
    parent.append(options.document.createTextNode(token.text));
  }
}

function collectText(
    tokens: readonly Token[],
    parts: string[],
    names: readonly string[],
): void {
  for (const token of tokens) {
    if (token.type === 'code' || token.type === 'codespan') {
      parts.push('text' in token && typeof token.text === 'string' ? token.text : '');
      continue;
    }

    if (token.type === 'image') {
      parts.push((token as Tokens.Image).text);
      continue;
    }

    if ('tokens' in token && Array.isArray(token.tokens) && token.tokens.length > 0) {
      collectText(token.tokens, parts, names);
      continue;
    }

    if ('text' in token && typeof token.text === 'string') {
      parts.push(token.text.replace(WIKI_PLACEHOLDER, (_match, index: string) => {
        return names[Number(index)] ?? '';
      }));
    }
  }
}

function safeHttpUrl(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed === '' || trimmed.startsWith('//')) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function graphemeClusters(value: string): string[] {
  const segmenter = Intl.Segmenter;
  if (segmenter !== undefined) {
    return Array.from(
        new segmenter(undefined, {granularity: 'grapheme'}).segment(value),
        (part) => part.segment,
    );
  }

  return Array.from(value);
}

function shieldCode(body: string): {slots: string[]; text: string} {
  const slots: string[] = [];
  const text = body
      .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, (block) => storeSlot(slots, block))
      .replace(/`[^`\n]*`/g, (block) => storeSlot(slots, block));
  return {slots, text};
}

function storeSlot(slots: string[], block: string): string {
  const index = slots.length;
  slots.push(block);
  return `\uE000CODE${index}\uE001`;
}

function restoreShields(text: string, slots: readonly string[]): string {
  return text.replace(/\uE000CODE(\d+)\uE001/g, (_token, index: string) => {
    return slots[Number(index)] ?? '';
  });
}

export function journalBodyMentions(body: string): string[] {
  return wikiLinkNames(body);
}
