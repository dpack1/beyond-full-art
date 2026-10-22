export interface ZipEntry {
  data: Uint8Array;
  path: string;
}

const UTF8_FLAG = 0x0800;
const STORED_METHOD = 0;
const MAX_ZIP_ENTRIES = 10_000;
const MAX_ZIP_BYTES = 256 * 1024 * 1024;

export function createStoredZip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(safeZipPath(entry.path));
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const localView = new DataView(local.buffer);
    writeCommonHeader(localView, 0x04034b50, crc, entry.data.length);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, UTF8_FLAG, true);
    centralView.setUint16(10, STORED_METHOD, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return concatenate([...localParts, ...centralParts, end]);
}

export function readStoredZip(buffer: ArrayBuffer): Map<string, Uint8Array> {
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new Error('This journal backup ZIP is too large.');
  }
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const endOffset = findEndRecord(view);
  const count = view.getUint16(endOffset + 10, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (count > MAX_ZIP_ENTRIES) {
    throw new Error('This journal backup ZIP contains too many files.');
  }

  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    assertRange(view, cursor, 46);
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('This journal backup ZIP is invalid.');
    }
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    if (method !== STORED_METHOD) {
      throw new Error('This journal backup uses unsupported ZIP compression.');
    }
    assertRange(view, cursor + 46, nameLength);
    const path = safeZipPath(decoder.decode(
        bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    ));

    assertRange(view, localOffset, 30);
    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error('This journal backup ZIP is invalid.');
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    assertRange(view, dataOffset, size);
    const data = bytes.slice(dataOffset, dataOffset + size);
    if (crc32(data) !== view.getUint32(cursor + 16, true)) {
      throw new Error(`Journal backup file ${path} is damaged.`);
    }
    files.set(path, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function writeCommonHeader(
    view: DataView,
    signature: number,
    crc: number,
    size: number,
): void {
  view.setUint32(0, signature, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, UTF8_FLAG, true);
  view.setUint16(8, STORED_METHOD, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
}

function findEndRecord(view: DataView): number {
  for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error('This file is not a valid journal backup ZIP.');
}

function safeZipPath(path: string): string {
  if (path === '' || path.startsWith('/') || path.includes('\\')) {
    throw new Error('Journal backup contains an unsafe file path.');
  }
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new Error('Journal backup contains an unsafe file path.');
  }
  return path;
}

function assertRange(view: DataView, offset: number, length: number): void {
  if (offset < 0 || length < 0 || offset + length > view.byteLength) {
    throw new Error('This journal backup ZIP is truncated.');
  }
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
