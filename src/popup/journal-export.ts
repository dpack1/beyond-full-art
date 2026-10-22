import {
  buildJournalMarkdownArchive,
  JOURNAL_EXPORT_FORMAT,
  JOURNAL_EXPORT_VERSION,
  journalExportImageReferences,
  parseJournalExportJson,
  type JournalExport,
  type JournalExportImage,
} from '../features/character-journal/character-journal-export';
import {
  MAX_JOURNAL_IMAGE_BYTES,
  isSupportedJournalImageMimeType,
} from '../features/character-journal/character-journal-types';
import {
  getStoredJournalImage,
  putStoredJournalImage,
} from '../platform/chrome/journal-messages';
import {
  mergeImportedCharacterJournalRecords,
  readableImportedJournalRecords,
  type StoredCharacterJournalRecords,
} from '../platform/chrome/storage';
import {downloadBlobUrl} from '../shared/download';
import {createStoredZip, readStoredZip, type ZipEntry} from '../shared/zip';

export interface JournalImportResult {
  characters: number;
  missingPhotos: number;
  notes: number;
}

export async function downloadJournalExport(
    characters: readonly StoredCharacterJournalRecords[],
    doc: Document,
): Promise<{missingPhotos: number}> {
  if (characters.length === 0) {
    throw new Error('No journal entries to export.');
  }

  const images = await Promise.all(
      journalExportImageReferences(characters).map(loadExportImage),
  );
  const exportedAt = new Date().toISOString();
  const exported: JournalExport = {
    characters: [...characters],
    exportedAt,
    format: JOURNAL_EXPORT_FORMAT,
    images,
    version: JOURNAL_EXPORT_VERSION,
  };
  const archive = buildJournalMarkdownArchive(exported);
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    {
      data: encoder.encode(JSON.stringify(archive.backup, null, 2)),
      path: 'backup.json',
    },
    ...archive.markdownFiles.map((file) => ({
      data: encoder.encode(file.text),
      path: file.path,
    })),
  ];
  const archivedImages = new Map(
      archive.backup.images.map((image) => [image.blobKey, image]),
  );
  for (const image of images) {
    const zipPath = archivedImages.get(image.blobKey)?.zipPath;
    if (image.byteBase64 !== null && typeof zipPath === 'string') {
      entries.push({data: new Uint8Array(decodeBase64(image.byteBase64)), path: zipPath});
    }
  }
  const zip = createStoredZip(entries);
  const zipBuffer = new Uint8Array(zip).buffer as ArrayBuffer;
  const objectUrl = URL.createObjectURL(new Blob([zipBuffer], {type: 'application/zip'}));
  const suffix = characters.length === 1
    ? `-${characters[0]?.characterId ?? 'character'}`
    : '';
  downloadBlobUrl(
      objectUrl,
      `beyond-full-art-journals${suffix}-${exportedAt.slice(0, 10)}.zip`,
      doc,
  );
  doc.defaultView?.setTimeout(() => {
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl);
    }
  }, 0);
  return {missingPhotos: images.filter((image) => image.byteBase64 === null).length};
}

export async function importJournalExportFile(
    file: File,
    doc: Document,
    targetCharacterId?: string,
): Promise<JournalImportResult> {
  const imported = await readImportFile(file, doc);
  const exported = imported.exported;
  const characters = targetCharacterId === undefined
    ? exported.characters
    : exported.characters.filter((character) =>
      character.characterId === targetCharacterId);
  if (characters.length === 0) {
    throw new Error(targetCharacterId === undefined
      ? 'This backup does not contain any character journals.'
      : `This backup does not contain character ${targetCharacterId}.`);
  }

  let noteCount = 0;
  let importedCharacters = 0;
  let missingPhotos = 0;
  const imagePayloads = new Map(exported.images.map((image) => [image.blobKey, image]));
  for (const character of characters) {
    const records = readableImportedJournalRecords(character.records)
        .filter((record) => record.characterId === character.characterId);
    if (records.length === 0) {
      continue;
    }

    const references = journalExportImageReferences([{
      characterId: character.characterId,
      records,
    }]);
    for (const reference of references) {
      const payload = imagePayloads.get(reference.blobKey);
      const archivedBytes = imported.imageBytes.get(reference.blobKey);
      if (payload === undefined
        || (payload.byteBase64 === null && archivedBytes === undefined)) {
        missingPhotos += 1;
        continue;
      }
      if (await getStoredJournalImage(reference.blobKey) !== null) {
        continue;
      }

      const bytes = archivedBytes ?? decodeBase64(payload.byteBase64 ?? '');
      if (
        bytes.byteLength === 0
        || bytes.byteLength > MAX_JOURNAL_IMAGE_BYTES
        || !isSupportedJournalImageMimeType(payload.mimeType)
      ) {
        missingPhotos += 1;
        continue;
      }
      await putStoredJournalImage({
        blobKey: reference.blobKey,
        byteBuffer: bytes,
        mimeType: payload.mimeType,
      });
    }

    await mergeImportedCharacterJournalRecords(character.characterId, records);
    noteCount += records.length;
    importedCharacters += 1;
  }

  if (noteCount === 0) {
    throw new Error('This backup contains no supported journal notes.');
  }

  return {characters: importedCharacters, missingPhotos, notes: noteCount};
}

async function readImportFile(file: File, doc: Document): Promise<{
  exported: JournalExport;
  imageBytes: Map<string, ArrayBuffer>;
}> {
  const buffer = await readFileBuffer(file);
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = readStoredZip(buffer);
    const backup = files.get('backup.json');
    if (backup === undefined) {
      throw new Error('This ZIP does not contain a Beyond Full Art journal backup.');
    }
    const exported = parseJournalExportJson(new TextDecoder().decode(backup));
    const imageBytes = new Map<string, ArrayBuffer>();
    for (const image of exported.images) {
      if (typeof image.zipPath !== 'string') {
        continue;
      }
      const stored = files.get(image.zipPath);
      if (stored !== undefined) {
        imageBytes.set(image.blobKey, stored.buffer.slice(
            stored.byteOffset,
            stored.byteOffset + stored.byteLength,
        ) as ArrayBuffer);
      }
    }
    return {exported, imageBytes};
  }

  return {
    exported: parseExportHtml(new TextDecoder().decode(bytes), doc),
    imageBytes: new Map(),
  };
}

async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('The journal backup could not be read.'));
      }
    });
    reader.addEventListener('error', () => reject(
        reader.error ?? new Error('The journal backup could not be read.'),
    ));
    reader.readAsArrayBuffer(file);
  });
}

function parseExportHtml(html: string, doc: Document): JournalExport {
  const Parser = doc.defaultView?.DOMParser;
  if (Parser === undefined) {
    throw new Error('Journal import is unavailable in this browser.');
  }
  const parsed = new Parser().parseFromString(html, 'text/html');
  const payload = parsed.querySelector<HTMLScriptElement>(
      '#bfa-journal-backup[type="application/json"]',
  )?.textContent;
  if (payload === undefined || payload === null || payload.trim() === '') {
    throw new Error('This file is not a Beyond Full Art journal backup.');
  }
  return parseJournalExportJson(payload);
}

async function loadExportImage(reference: {
  blobKey: string;
  fileName: string;
  mimeType: string;
}): Promise<JournalExportImage> {
  try {
    const stored = await getStoredJournalImage(reference.blobKey);
    if (stored === null) {
      return {...reference, byteBase64: null, error: 'Stored photo was not found.'};
    }
    return {
      ...reference,
      byteBase64: encodeBase64(stored.byteBuffer),
      error: null,
      mimeType: stored.mimeType,
    };
  } catch (error) {
    return {...reference, byteBase64: null, error: errorMessage(error)};
  }
}

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): ArrayBuffer {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    return new ArrayBuffer(0);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() !== ''
    ? error.message
    : 'The journal operation failed.';
}

