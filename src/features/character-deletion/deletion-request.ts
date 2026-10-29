// Observed 2026-08-06 from the characters page. See docs/NETWORK_DELETE_RESEARCH.md.
// Chrome documents requestBody.raw for PUT and POST, so a missing DELETE body
// stays a supported case and must not delete art by itself.
export const CHARACTER_DELETION_URL =
  'https://character-service.dndbeyond.com/character/v5/character';
export const CHARACTER_DELETION_URL_PATTERN =
  'https://character-service.dndbeyond.com/character/v5/character*';
export const CHARACTER_DELETION_INITIATOR = 'https://www.dndbeyond.com';

// The 2026-08-06 headers screenshot shows 200 OK with a JSON content type.
// 204 remains accepted in case the service answers with no content.
export function isCharacterDeletionSuccessStatus(status: unknown): status is 200 | 204 {
  return status === 200 || status === 204;
}

const CHARACTER_ID_PATTERN = /^[1-9]\d{0,15}$/;

export interface DeletionRequestBody {
  error?: string;
  formData?: {[key: string]: Array<string | ArrayBuffer>};
  raw?: Array<{bytes?: ArrayBuffer}>;
}

export function isWatchedCharacterDeletion(input: {
  documentUrl?: string;
  initiator?: string;
  method: string;
  url: string;
}): boolean {
  if (!isCharacterDeletionRequest(input.method, input.url)) {
    return false;
  }
  const initiator = input.initiator ?? '';
  if (initiator === CHARACTER_DELETION_INITIATOR) {
    return true;
  }
  // Brave often omits initiator unless the extension has host permission for
  // www.dndbeyond.com. The URL filter is already this one delete endpoint.
  if (initiator !== '' && initiator !== 'null') {
    return false;
  }
  const documentUrl = input.documentUrl ?? '';
  if (documentUrl === '') {
    return true;
  }
  try {
    return new URL(documentUrl).origin === CHARACTER_DELETION_INITIATOR;
  } catch {
    return false;
  }
}

export function isCharacterDeletionRequest(method: string, url: string): boolean {
  if (method.toUpperCase() !== 'DELETE') {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.origin === 'https://character-service.dndbeyond.com'
      && parsed.pathname === '/character/v5/character';
  } catch {
    return false;
  }
}

export function isDeletionCharacterId(value: string): boolean {
  return CHARACTER_ID_PATTERN.test(value);
}

export function characterIdFromDeletionJson(text: string): string | null {
  const digits = singleCharacterIdMatch(text);
  if (digits === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const value = (parsed as Record<string, unknown>).characterId;
  if (typeof value === 'string') {
    return value === digits ? digits : null;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && String(value) === digits) {
    return digits;
  }
  return null;
}

export function characterIdFromFormFields(values: readonly string[]): string | null {
  if (values.length !== 1) {
    return null;
  }
  const value = values[0];
  return value !== undefined && isDeletionCharacterId(value) ? value : null;
}

export function characterIdFromWebRequestBody(
    body: DeletionRequestBody | null | undefined,
): string | null {
  if (body == null || typeof body.error === 'string') {
    return null;
  }
  if (Array.isArray(body.raw) && body.raw.length > 0) {
    const parts: Uint8Array[] = [];
    for (const part of body.raw) {
      if (!isArrayBuffer(part.bytes)) {
        return null;
      }
      parts.push(new Uint8Array(part.bytes));
    }
    return characterIdFromDeletionJson(new TextDecoder().decode(concatBytes(parts)));
  }
  const formValue = body.formData?.characterId;
  if (!Array.isArray(formValue)) {
    return null;
  }
  const fields = formValue.filter((value): value is string => typeof value === 'string');
  if (fields.length !== formValue.length) {
    return null;
  }
  return characterIdFromFormFields(fields);
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

function singleCharacterIdMatch(text: string): string | null {
  const matches = [...text.matchAll(
      /"characterId"\s*:\s*(?:"([1-9]\d{0,15})"|([1-9]\d{0,15}))/g,
  )];
  if (matches.length !== 1) {
    return null;
  }
  return matches[0]?.[1] ?? matches[0]?.[2] ?? null;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }
  return combined;
}
