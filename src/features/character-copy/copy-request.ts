import {isDeletionCharacterId} from '../character-deletion/deletion-request';

const COPY_ID_KEYS = new Set(['id', 'characterId', 'newCharacterId', 'copiedCharacterId']);

export interface CharacterCopyTarget {
  matched: boolean;
  requiresSource: boolean;
  sourceFromPath: boolean;
  sourceId: string | null;
}

export function isCharacterCopySuccessStatus(status: unknown): status is 200 | 201 {
  return status === 200 || status === 201;
}

// The collection copy endpoint and request body were captured live on
// 2026-10-29. The named and bare-character forms remain defensive fallbacks.
// A request with no source id still needs exactly one Copy click in the tab.
export function characterCopyTarget(method: string, url: string): CharacterCopyTarget {
  const unmatched = {matched: false, requiresSource: false, sourceFromPath: false, sourceId: null};
  if (method.toUpperCase() !== 'POST') {
    return unmatched;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return unmatched;
  }
  if (parsed.origin !== 'https://character-service.dndbeyond.com') {
    return unmatched;
  }
  const pathname = parsed.pathname.length > 1 && parsed.pathname.endsWith('/')
    ? parsed.pathname.slice(0, -1)
    : parsed.pathname;
  const named = /^\/character\/v5\/character\/([1-9]\d{0,15})\/copy$/.exec(pathname);
  if (named?.[1] !== undefined) {
    return {matched: true, requiresSource: false, sourceFromPath: true, sourceId: named[1]};
  }
  if (pathname === '/character/v5/character/copy') {
    return {matched: true, requiresSource: false, sourceFromPath: false, sourceId: null};
  }
  if (pathname === '/character/v5/character') {
    return {matched: true, requiresSource: true, sourceFromPath: false, sourceId: null};
  }
  return unmatched;
}

export function characterIdFromCopyResponse(text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const found = new Set<string>();
  collectCopyIds(parsed, found, 0);
  if (found.size !== 1) {
    return null;
  }
  return [...found][0] ?? null;
}

function collectCopyIds(value: unknown, found: Set<string>, depth: number): void {
  if (
    depth > 2
    || found.size > 1
    || typeof value !== 'object'
    || value === null
    || Array.isArray(value)
  ) {
    return;
  }
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (!COPY_ID_KEYS.has(key)) {
      continue;
    }
    const id = copyIdText(child);
    if (id !== null) {
      found.add(id);
    }
  }
  if (found.size > 1) {
    return;
  }
  if ('data' in record) {
    collectCopyIds(record.data, found, depth + 1);
  }
  if ('character' in record) {
    collectCopyIds(record.character, found, depth + 1);
  }
}

function copyIdText(value: unknown): string | null {
  if (typeof value === 'string' && isDeletionCharacterId(value)) {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    const text = String(value);
    return isDeletionCharacterId(text) ? text : null;
  }
  return null;
}
