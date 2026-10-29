import {isCharacterDeletionSuccessStatus, isDeletionCharacterId} from './deletion-request';

export const CLEANUP_MESSAGE_SOURCE = 'beyond-full-art';
export const CHARACTER_DELETION_PAGE_SOURCE = 'bfa-character-deletion-observed';

export interface CleanupObservedMessage {
  characterId: string;
  source: typeof CLEANUP_MESSAGE_SOURCE;
  status: 200 | 204;
  type: 'cleanup:observed';
}

export interface CleanupClaimMessage {
  source: typeof CLEANUP_MESSAGE_SOURCE;
  type: 'cleanup:claim';
}

export interface CleanupPreviewMessage {
  characterId: string;
  source: typeof CLEANUP_MESSAGE_SOURCE;
  type: 'cleanup:preview';
}

export interface CleanupConfirmedMessage {
  characterId: string;
  source: typeof CLEANUP_MESSAGE_SOURCE;
  type: 'cleanup:confirmed';
}

export interface CleanupSucceededMessage {
  source: typeof CLEANUP_MESSAGE_SOURCE;
  status: 200 | 204;
  type: 'cleanup:succeeded';
}

export interface CleanupDecisionMessage {
  characterId: string;
  decision: 'delete' | 'keep';
  remember: boolean;
  source: typeof CLEANUP_MESSAGE_SOURCE;
  type: 'cleanup:decision';
}

export interface CleanupPromptMessage {
  characterId: string;
  hasArt: boolean;
  hasJournalData: boolean;
  source: typeof CLEANUP_MESSAGE_SOURCE;
  type: 'cleanup:prompt';
}

export interface CleanupFailedMessage {
  characterId: string;
  message: string;
  source: typeof CLEANUP_MESSAGE_SOURCE;
  type: 'cleanup:failed';
}

export function asCleanupObserved(value: unknown): CleanupObservedMessage | null {
  if (
    !isEnvelope(value)
    || value.type !== 'cleanup:observed'
    || !isCharacterDeletionSuccessStatus(value.status)
  ) {
    return null;
  }
  if (typeof value.characterId !== 'string' || !isDeletionCharacterId(value.characterId)) {
    return null;
  }
  return {
    characterId: value.characterId,
    source: CLEANUP_MESSAGE_SOURCE,
    status: value.status,
    type: 'cleanup:observed',
  };
}

export function asCleanupClaim(value: unknown): CleanupClaimMessage | null {
  if (!isEnvelope(value) || value.type !== 'cleanup:claim') {
    return null;
  }
  return {source: CLEANUP_MESSAGE_SOURCE, type: 'cleanup:claim'};
}

export function asCleanupConfirmed(value: unknown): CleanupConfirmedMessage | null {
  if (!isEnvelope(value) || value.type !== 'cleanup:confirmed') {
    return null;
  }
  if (typeof value.characterId !== 'string' || !isDeletionCharacterId(value.characterId)) {
    return null;
  }
  return {
    characterId: value.characterId,
    source: CLEANUP_MESSAGE_SOURCE,
    type: 'cleanup:confirmed',
  };
}

export function asCleanupSucceeded(value: unknown): CleanupSucceededMessage | null {
  if (
    !isEnvelope(value)
    || value.type !== 'cleanup:succeeded'
    || !isCharacterDeletionSuccessStatus(value.status)
  ) {
    return null;
  }
  return {
    source: CLEANUP_MESSAGE_SOURCE,
    status: value.status,
    type: 'cleanup:succeeded',
  };
}

export function asCleanupPreview(value: unknown): CleanupPreviewMessage | null {
  if (!isEnvelope(value) || value.type !== 'cleanup:preview') {
    return null;
  }
  if (typeof value.characterId !== 'string' || !isDeletionCharacterId(value.characterId)) {
    return null;
  }
  return {
    characterId: value.characterId,
    source: CLEANUP_MESSAGE_SOURCE,
    type: 'cleanup:preview',
  };
}

export function asCleanupDecision(value: unknown): CleanupDecisionMessage | null {
  if (!isEnvelope(value) || value.type !== 'cleanup:decision') {
    return null;
  }
  if (
    typeof value.characterId !== 'string'
    || !isDeletionCharacterId(value.characterId)
    || (value.decision !== 'delete' && value.decision !== 'keep')
    || typeof value.remember !== 'boolean'
  ) {
    return null;
  }
  return {
    characterId: value.characterId,
    decision: value.decision,
    remember: value.remember,
    source: CLEANUP_MESSAGE_SOURCE,
    type: 'cleanup:decision',
  };
}

export function asCleanupPrompt(value: unknown): CleanupPromptMessage | null {
  if (!isEnvelope(value) || value.type !== 'cleanup:prompt') {
    return null;
  }
  if (
    typeof value.characterId !== 'string'
    || !isDeletionCharacterId(value.characterId)
    || typeof value.hasArt !== 'boolean'
    || typeof value.hasJournalData !== 'boolean'
  ) {
    return null;
  }
  return {
    characterId: value.characterId,
    hasArt: value.hasArt,
    hasJournalData: value.hasJournalData,
    source: CLEANUP_MESSAGE_SOURCE,
    type: 'cleanup:prompt',
  };
}

export function asCleanupFailed(value: unknown): CleanupFailedMessage | null {
  if (!isEnvelope(value) || value.type !== 'cleanup:failed') {
    return null;
  }
  if (
    typeof value.characterId !== 'string'
    || !isDeletionCharacterId(value.characterId)
    || typeof value.message !== 'string'
    || value.message.trim() === ''
  ) {
    return null;
  }
  return {
    characterId: value.characterId,
    message: value.message,
    source: CLEANUP_MESSAGE_SOURCE,
    type: 'cleanup:failed',
  };
}

export function createCleanupPrompt(
    characterId: string,
    hasJournalData: boolean,
    hasArt: boolean,
): CleanupPromptMessage {
  return {
    characterId,
    hasArt,
    hasJournalData,
    source: CLEANUP_MESSAGE_SOURCE,
    type: 'cleanup:prompt',
  };
}

export function createCleanupFailed(
    characterId: string,
    message: string,
): CleanupFailedMessage {
  return {characterId, message, source: CLEANUP_MESSAGE_SOURCE, type: 'cleanup:failed'};
}

function isEnvelope(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && (value as Record<string, unknown>).source === CLEANUP_MESSAGE_SOURCE;
}
