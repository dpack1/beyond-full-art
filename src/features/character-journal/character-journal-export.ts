import {
  getImageBlocks,
  getTextFromJournalEntry,
  isCharacterJournalEntry,
  isJournalImageBlobKey,
  isJournalNote,
  type JournalImage,
} from './character-journal-types';
import type {StoredCharacterJournalRecords} from '../../platform/chrome/storage';

export const JOURNAL_EXPORT_FORMAT = 'beyond-full-art-journal-export';
export const JOURNAL_EXPORT_VERSION = 1 as const;

export interface JournalExportImage {
  blobKey: string;
  byteBase64: string | null;
  error: string | null;
  fileName: string;
  mimeType: string;
  zipPath?: string | null;
}

export interface JournalExport {
  characters: StoredCharacterJournalRecords[];
  exportedAt: string;
  format: typeof JOURNAL_EXPORT_FORMAT;
  images: JournalExportImage[];
  version: typeof JOURNAL_EXPORT_VERSION;
}

interface ExportImageReference {
  blobKey: string;
  fileName: string;
  mimeType: string;
}

export interface JournalMarkdownFile {
  path: string;
  text: string;
}

export interface JournalMarkdownArchive {
  backup: JournalExport;
  markdownFiles: JournalMarkdownFile[];
}

export function buildJournalMarkdownArchive(
    exported: JournalExport,
): JournalMarkdownArchive {
  const imagePaths = new Map<string, string>();
  for (const character of exported.characters) {
    const characterFolder = safePathPart(character.characterId, 'character');
    const usedPhotoNames = new Set<string>();
    for (const image of journalExportImageReferences([character])) {
      if (!imagePaths.has(image.blobKey)) {
        const photoName = uniqueFileName(
            safePathPart(image.fileName, 'Photo'),
            usedPhotoNames,
        );
        imagePaths.set(
            image.blobKey,
            `characters/${characterFolder}/photos/${photoName}`,
        );
      }
    }
  }

  const markdownFiles: JournalMarkdownFile[] = [];
  for (const character of exported.characters) {
    const characterFolder = safePathPart(character.characterId, 'character');
    const folder = `characters/${characterFolder}/notes`;
    const usedNoteNames = new Set<string>();
    archiveNotes(character.records).forEach((note) => {
      const imageById = new Map(note.images.map((image) => [
        image.id,
        imagePaths.get(image.blobKey),
      ]));
      const body = replaceImageEmbeds(note.body, imageById);
      const noteName = uniquePathPart(
          safePathPart(note.title, 'Untitled'),
          usedNoteNames,
      );
      markdownFiles.push({
        path: `${folder}/${noteName}.md`,
        text: `# ${note.title || 'Untitled entry'}\n\nType: ${note.type}\n\nUpdated: ${note.updatedAt}\n\n${body}\n`,
      });
    });
  }

  return {
    backup: {
      ...exported,
      images: exported.images.map((image) => ({
        ...image,
        byteBase64: null,
        zipPath: image.byteBase64 === null
          ? null
          : imagePaths.get(image.blobKey) ?? null,
      })),
    },
    markdownFiles,
  };
}

export function journalExportImageReferences(
    characters: readonly StoredCharacterJournalRecords[],
): ExportImageReference[] {
  const images = new Map<string, ExportImageReference>();
  for (const character of characters) {
    for (const record of character.records) {
      collectImageReferences(record, images, new WeakSet<object>());
    }
  }

  return [...images.values()].sort((left, right) =>
    left.blobKey.localeCompare(right.blobKey));
}

function collectImageReferences(
    value: unknown,
    images: Map<string, ExportImageReference>,
    seen: WeakSet<object>,
): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return;
  }
  seen.add(value);

  const blobKey = !Array.isArray(value)
    && 'blobKey' in value
    && typeof value.blobKey === 'string'
    && isJournalImageBlobKey(value.blobKey)
    ? value.blobKey
    : null;
  if (blobKey !== null) {
    images.set(blobKey, {
      blobKey,
      fileName: 'fileName' in value && typeof value.fileName === 'string'
        ? value.fileName
        : 'Journal photo',
      mimeType: 'mimeType' in value && typeof value.mimeType === 'string'
        ? value.mimeType
        : 'application/octet-stream',
    });
  }

  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectImageReferences(child, images, seen);
  }
}

export function parseJournalExportJson(value: string): JournalExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('This file does not contain a valid journal backup.');
  }

  if (!isRecord(parsed)
    || parsed.format !== JOURNAL_EXPORT_FORMAT
    || parsed.version !== JOURNAL_EXPORT_VERSION
    || typeof parsed.exportedAt !== 'string'
    || !Array.isArray(parsed.characters)
    || !parsed.characters.every(isExportCharacter)
    || !Array.isArray(parsed.images)
    || !parsed.images.every(isExportImage)) {
    throw new Error('This journal backup format is not supported.');
  }

  return parsed as unknown as JournalExport;
}

function archiveNotes(records: readonly unknown[]): Array<{
  body: string;
  id: string;
  images: Array<Pick<JournalImage, 'blobKey' | 'id'>>;
  title: string;
  type: string;
  updatedAt: string;
}> {
  return records.flatMap<{
    body: string;
    id: string;
    images: Array<Pick<JournalImage, 'blobKey' | 'id'>>;
    title: string;
    type: string;
    updatedAt: string;
  }>((record) => {
    if (isJournalNote(record)) {
      return [{
        body: record.body,
        id: record.id,
        images: record.images,
        title: record.title,
        type: record.type,
        updatedAt: record.updatedAt,
      }];
    }
    if (isCharacterJournalEntry(record)) {
      return [{
        body: getTextFromJournalEntry(record),
        id: record.id,
        images: getImageBlocks(record),
        title: record.title,
        type: 'Legacy note',
        updatedAt: record.updatedAt,
      }];
    }
    return [];
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function replaceImageEmbeds(
    body: string,
    imageById: ReadonlyMap<string, string | undefined>,
): string {
  const current = body.replace(
      /!\[\[img:([A-Za-z0-9-]+)((?:\|[^\]\n|]+)*)\]\]/g,
      (original, id: string, options: string) => {
        const path = imageById.get(id);
        if (path === undefined) {
          return original;
        }
        const caption = options.split('|').filter(Boolean)
            .filter((part) => !/^\d{1,4}$/.test(part)).join('|');
        return `![${caption}](../photos/${path.split('/').at(-1)})`;
      },
  );
  const converted = current.replace(
      /!\[([^\]]*)\]\(bfa-journal-image:([A-Za-z0-9-]+)(?:\s+"[^"]*")?\)/g,
      (original, caption: string, id: string) => {
        const path = imageById.get(id);
        return path === undefined
          ? original
          : `![${caption}](../photos/${path.split('/').at(-1)})`;
      },
  );
  const missing = [...new Set(imageById.values())]
      .filter((path): path is string => path !== undefined)
      .map((path) => `../photos/${path.split('/').at(-1)}`)
      .filter((path) => !converted.includes(`](${path})`));
  if (missing.length === 0) {
    return converted;
  }
  const links = missing.map((path) => `![](${path})`).join('\n\n');
  return converted.trim() === '' ? links : `${converted.trimEnd()}\n\n${links}`;
}

function safePathPart(value: string, fallback: string): string {
  const cleaned = value.trim()
      .replace(/[^A-Za-z0-9._ -]+/g, '-')
      .replace(/\.{2,}/g, '.')
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-. ]+|[-. ]+$/g, '')
      .slice(0, 80);
  return cleaned === '' ? fallback : cleaned;
}

function uniquePathPart(value: string, used: Set<string>): string {
  let candidate = value;
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) {
    candidate = `${value}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate.toLocaleLowerCase());
  return candidate;
}

function uniqueFileName(value: string, used: Set<string>): string {
  const extensionIndex = value.lastIndexOf('.');
  const stem = extensionIndex > 0 ? value.slice(0, extensionIndex) : value;
  const extension = extensionIndex > 0 ? value.slice(extensionIndex) : '';
  let candidate = value;
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) {
    candidate = `${stem}-${suffix}${extension}`;
    suffix += 1;
  }
  used.add(candidate.toLocaleLowerCase());
  return candidate;
}

function isExportCharacter(value: unknown): boolean {
  return isRecord(value)
    && typeof value.characterId === 'string'
    && value.characterId !== ''
    && Array.isArray(value.records);
}

function isExportImage(value: unknown): boolean {
  return isRecord(value)
    && typeof value.blobKey === 'string'
    && isJournalImageBlobKey(value.blobKey)
    && typeof value.fileName === 'string'
    && typeof value.mimeType === 'string'
    && (value.byteBase64 === null || typeof value.byteBase64 === 'string')
    && (value.error === null || typeof value.error === 'string')
    && (!('zipPath' in value)
      || value.zipPath === null
      || typeof value.zipPath === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
