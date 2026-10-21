import type {JournalNote} from './character-journal-types';

const CODE_FENCE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const INLINE_CODE = /`[^`\n]*`/g;
const WIKI_LINK = /(?<!!)\[\[([^\]\n]{1,200})\]\]/g;
const TAG = /(^|[^A-Za-z0-9-])#([A-Za-z0-9-]{1,40})(?![A-Za-z0-9-])/g;

export type WikiResolution =
  | {kind: 'many'; notes: JournalNote[]}
  | {kind: 'missing'}
  | {kind: 'one'; note: JournalNote};

export function journalTitleKey(title: string): string {
  return title.trim().toLocaleLowerCase();
}

export function wikiLinkNames(body: string): string[] {
  const names: string[] = [];
  for (const match of bodyWithoutCode(body).matchAll(WIKI_LINK)) {
    const name = match[1]?.trim() ?? '';
    if (name !== '' && name.length <= 200 && !name.includes(']')) {
      names.push(name);
    }
  }

  return names;
}

export function journalTagNames(body: string): string[] {
  const tags = new Set<string>();
  for (const segment of proseSegments(body)) {
    for (const match of segment.matchAll(TAG)) {
      const tag = match[2];
      if (tag !== undefined) {
        tags.add(tag.toLocaleLowerCase());
      }
    }
  }

  return [...tags];
}

export function resolveWikiTitle(
    name: string,
    notes: readonly JournalNote[],
): WikiResolution {
  const key = journalTitleKey(name);
  const matches = notes.filter((note) => journalTitleKey(note.title) === key);
  const first = matches[0];
  if (matches.length === 0 || first === undefined) {
    return {kind: 'missing'};
  }

  if (matches.length === 1) {
    return {kind: 'one', note: first};
  }

  return {kind: 'many', notes: matches};
}

export function mentionCounts(
    notes: readonly JournalNote[],
): Map<string, number> {
  const counts = new Map(notes.map((note) => [note.id, 0]));
  for (const note of notes) {
    const seen = new Set<string>();
    for (const name of wikiLinkNames(note.body)) {
      const resolution = resolveWikiTitle(name, notes);
      if (resolution.kind !== 'one' || resolution.note.id === note.id) {
        continue;
      }

      if (seen.has(resolution.note.id)) {
        continue;
      }

      seen.add(resolution.note.id);
      counts.set(
          resolution.note.id,
          (counts.get(resolution.note.id) ?? 0) + 1,
      );
    }
  }

  return counts;
}

export function rewriteUniqueTitle(
    notes: readonly JournalNote[],
    oldTitle: string,
    newTitle: string,
    renamedId: string,
): JournalNote[] {
  const owners = notes.filter((note) => note.title === oldTitle);
  if (owners.length !== 1) {
    return [...notes];
  }

  return notes.map((note) => {
    if (note.id === renamedId) {
      return note;
    }

    const body = rewriteTitleTokens(note.body, oldTitle, newTitle);
    return body === note.body ? note : {...note, body};
  });
}

export function rewriteTitleTokens(
    body: string,
    oldTitle: string,
    newTitle: string,
): string {
  const shielded = shieldCode(body);
  const next = shielded.text.replace(WIKI_LINK, (token, raw: string) => {
    return raw.trim() === oldTitle ? `[[${newTitle}]]` : token;
  });
  return restoreShields(next, shielded.slots);
}

function proseSegments(body: string): string[] {
  return bodyWithoutCode(body)
      .split(/^#{1,6}[^\n]*$/gm)
      .map((segment) => segment);
}

function bodyWithoutCode(body: string): string {
  return body.replace(CODE_FENCE, ' ').replace(INLINE_CODE, ' ');
}

function shieldCode(body: string): {slots: string[]; text: string} {
  const slots: string[] = [];
  const text = body
      .replace(CODE_FENCE, (block) => storeSlot(slots, block))
      .replace(INLINE_CODE, (block) => storeSlot(slots, block));
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
