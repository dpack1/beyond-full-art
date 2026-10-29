import {isDeletionCharacterId} from '../character-deletion/deletion-request';

export const COPY_MESSAGE_SOURCE = 'beyond-full-art-copy';
export const CHARACTER_COPY_PAGE_SOURCE = 'bfa-character-copy-observed';

export interface CopyPromptMessage {
  destinationId: string;
  source: typeof COPY_MESSAGE_SOURCE;
  sourceId: string;
  type: 'copy:prompt';
}

export function createCopyPrompt(sourceId: string, destinationId: string): CopyPromptMessage {
  return {
    destinationId,
    source: COPY_MESSAGE_SOURCE,
    sourceId,
    type: 'copy:prompt',
  };
}

export function asCopyClicked(value: unknown): {characterId: string} | null {
  return asCharacterMessage(value, 'copy:clicked');
}

export function asCopyObserved(value: unknown): {
  destinationId: string;
  sourceFromPath: boolean;
  sourceId: string | null;
} | null {
  if (!isCopyRecord(value, 'copy:observed')) {
    return null;
  }
  const destinationId = value.destinationId;
  if (typeof destinationId !== 'string' || !isDeletionCharacterId(destinationId)) {
    return null;
  }
  const sourceId = value.sourceId;
  return {
    destinationId,
    sourceFromPath: value.sourceFromPath === true,
    sourceId: typeof sourceId === 'string' && isDeletionCharacterId(sourceId) ? sourceId : null,
  };
}

export function asCopyDecision(value: unknown): {
  decision: 'copy' | 'skip';
  destinationId: string;
  sourceId: string;
} | null {
  if (!isCopyRecord(value, 'copy:decision')) {
    return null;
  }
  if (value.decision !== 'copy' && value.decision !== 'skip') {
    return null;
  }
  if (typeof value.sourceId !== 'string' || !isDeletionCharacterId(value.sourceId)) {
    return null;
  }
  if (typeof value.destinationId !== 'string' || !isDeletionCharacterId(value.destinationId)) {
    return null;
  }
  return {
    decision: value.decision,
    destinationId: value.destinationId,
    sourceId: value.sourceId,
  };
}

export function asCopyClaim(value: unknown): true | null {
  return isCopyRecord(value, 'copy:claim') ? true : null;
}

export function asCopyPrompt(value: unknown): CopyPromptMessage | null {
  if (!isCopyRecord(value, 'copy:prompt')) {
    return null;
  }
  if (typeof value.sourceId !== 'string' || !isDeletionCharacterId(value.sourceId)) {
    return null;
  }
  if (typeof value.destinationId !== 'string' || !isDeletionCharacterId(value.destinationId)) {
    return null;
  }
  return createCopyPrompt(value.sourceId, value.destinationId);
}

function asCharacterMessage(value: unknown, type: string): {characterId: string} | null {
  if (!isCopyRecord(value, type)) {
    return null;
  }
  if (typeof value.characterId !== 'string' || !isDeletionCharacterId(value.characterId)) {
    return null;
  }
  return {characterId: value.characterId};
}

function isCopyRecord(value: unknown, type: string): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && (value as {source?: unknown}).source === COPY_MESSAGE_SOURCE
    && (value as {type?: unknown}).type === type;
}
