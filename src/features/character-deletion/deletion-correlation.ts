import {isCharacterDeletionSuccessStatus} from './deletion-request';

export const DELETION_REQUEST_TTL_MS = 120_000;
export const DELETION_OBSERVATION_WINDOW_MS = 15_000;

export interface DeletionCleanupSignal {
  characterId: string;
  requestId: string;
  tabId: number;
}

export interface DeletionRequestRecord {
  ambiguous: boolean;
  characterId: string | null;
  completedAt: number | null;
  requestId: string;
  startedAt: number;
  status: 'pending' | 'succeeded';
  tabId: number;
}

export interface PageDeletionObservation {
  at: number;
  characterId: string;
  tabId: number;
}

export interface DeletionTrackerState {
  confirmations: PageDeletionObservation[];
  observations: PageDeletionObservation[];
  requests: DeletionRequestRecord[];
  resolved: Array<{at: number; requestId: string}>;
  successes: Array<{at: number; tabId: number}>;
}

export interface DeletionTrackerResult {
  signal: DeletionCleanupSignal | null;
  state: DeletionTrackerState;
}

export function createDeletionTrackerState(): DeletionTrackerState {
  return {confirmations: [], observations: [], requests: [], resolved: [], successes: []};
}

export function noteDeletionRequest(
    state: DeletionTrackerState,
    input: {
      at: number;
      characterId: string | null;
      requestId: string;
      tabId: number;
    },
): DeletionTrackerResult {
  const current = expireDeletionTracker(state, input.at);
  if (isResolved(current, input.requestId)) {
    return {signal: null, state: current};
  }
  const existing = current.requests.find((record) => record.requestId === input.requestId);
  if (existing === undefined) {
    return {
      signal: null,
      state: {
        ...current,
        requests: [...current.requests, {
          ambiguous: false,
          characterId: input.characterId,
          completedAt: null,
          requestId: input.requestId,
          startedAt: input.at,
          status: 'pending',
          tabId: input.tabId,
        }],
      },
    };
  }
  const ambiguous = existing.ambiguous
    || (
      existing.characterId !== null
      && input.characterId !== null
      && existing.characterId !== input.characterId
    );
  const characterId = ambiguous
    ? null
    : existing.characterId ?? input.characterId;
  return {
    signal: null,
    state: replaceRequest(current, {
      ...existing,
      ambiguous,
      characterId,
      tabId: existing.tabId < 0 && input.tabId >= 0 ? input.tabId : existing.tabId,
    }),
  };
}

export function noteDeletionCompleted(
    state: DeletionTrackerState,
    input: {at: number; requestId: string; statusCode: number; tabId: number},
): DeletionTrackerResult {
  const current = expireDeletionTracker(state, input.at);
  if (isResolved(current, input.requestId)) {
    return {signal: null, state: current};
  }
  const existing = current.requests.find((record) => record.requestId === input.requestId);
  if (existing !== undefined && input.at - existing.startedAt > DELETION_REQUEST_TTL_MS) {
    return {signal: null, state: forgetRequest(current, input.requestId, input.at)};
  }
  if (!isCharacterDeletionSuccessStatus(input.statusCode)) {
    return {
      signal: null,
      state: existing === undefined
        ? current
        : forgetRequest(current, input.requestId, input.at),
    };
  }
  const record: DeletionRequestRecord = existing === undefined
    ? {
      ambiguous: false,
      characterId: null,
      completedAt: input.at,
      requestId: input.requestId,
      startedAt: input.at,
      status: 'succeeded',
      tabId: input.tabId,
    }
    : {
      ...existing,
      completedAt: input.at,
      status: 'succeeded',
      tabId: existing.tabId < 0 && input.tabId >= 0 ? input.tabId : existing.tabId,
    };
  if (record.ambiguous) {
    return {signal: null, state: forgetRequest(current, input.requestId, input.at)};
  }
  const withRecord = replaceRequest(
      existing === undefined
        ? current
        : current,
      record,
  );
  const nextState = existing === undefined
    ? {...current, requests: [...current.requests, record]}
    : withRecord;
  if (record.characterId !== null) {
    return resolveRequest(nextState, record, record.characterId, input.at);
  }
  const observedId = singleObservedId(nextState, record, input.at);
  if (observedId === null) {
    return {signal: null, state: nextState};
  }
  return resolveRequest(nextState, record, observedId, input.at);
}

export function noteDeletionFailed(
    state: DeletionTrackerState,
    input: {at: number; requestId: string},
): DeletionTrackerResult {
  const current = expireDeletionTracker(state, input.at);
  if (isResolved(current, input.requestId)
    || !current.requests.some((record) => record.requestId === input.requestId)) {
    return {signal: null, state: current};
  }
  return {signal: null, state: forgetRequest(current, input.requestId, input.at)};
}

export function notePageDeletion(
    state: DeletionTrackerState,
    input: {at: number; characterId: string; statusCode: number; tabId: number},
): DeletionTrackerResult {
  const current = expireDeletionTracker(state, input.at);
  if (!isCharacterDeletionSuccessStatus(input.statusCode)) {
    return {signal: null, state: current};
  }
  const observations = current.observations.some((observation) =>
    observation.tabId === input.tabId && observation.characterId === input.characterId)
    ? current.observations
    : [...current.observations, {
      at: input.at,
      characterId: input.characterId,
      tabId: input.tabId,
    }];
  const next = {...current, observations};
  const waiting = next.requests.filter((record) =>
    record.status === 'succeeded'
    && !record.ambiguous
    && sameDeletionTab(record.tabId, input.tabId)
    && record.completedAt !== null
    && Math.abs(input.at - record.completedAt) <= DELETION_OBSERVATION_WINDOW_MS
    && (record.characterId === null || record.characterId === input.characterId));
  const exact = waiting.filter((record) => record.characterId === input.characterId);
  if (exact.length === 1 && exact[0] !== undefined) {
    return resolveRequest(next, exact[0], input.characterId, input.at);
  }
  const anonymous = waiting.filter((record) => record.characterId === null);
  if (exact.length === 0 && anonymous.length === 1 && anonymous[0] !== undefined) {
    return resolveRequest(next, anonymous[0], input.characterId, input.at);
  }
  return {signal: null, state: next};
}

export function noteDeletionConfirmed(
    state: DeletionTrackerState,
    input: {at: number; characterId: string; tabId: number},
): DeletionTrackerResult {
  const current = expireDeletionTracker(state, input.at);
  const confirmations = current.confirmations.some((confirmation) =>
    confirmation.tabId === input.tabId && confirmation.characterId === input.characterId)
    ? current.confirmations
    : [...current.confirmations, input];
  return pairConfirmedSuccess({...current, confirmations}, input.tabId, input.at);
}

export function noteFetchSucceeded(
    state: DeletionTrackerState,
    input: {at: number; statusCode: number; tabId: number},
): DeletionTrackerResult {
  const current = expireDeletionTracker(state, input.at);
  if (!isCharacterDeletionSuccessStatus(input.statusCode)) {
    return {signal: null, state: current};
  }
  return pairConfirmedSuccess({
    ...current,
    successes: [...current.successes, {at: input.at, tabId: input.tabId}],
  }, input.tabId, input.at);
}

export function expireDeletionTracker(
    state: DeletionTrackerState,
    at: number,
): DeletionTrackerState {
  const confirmations = state.confirmations ?? [];
  const successes = state.successes ?? [];
  return {
    confirmations: confirmations.filter((confirmation) =>
      at - confirmation.at <= DELETION_OBSERVATION_WINDOW_MS),
    observations: state.observations.filter((observation) =>
      at - observation.at <= DELETION_OBSERVATION_WINDOW_MS),
    requests: state.requests.filter((record) => at - record.startedAt <= DELETION_REQUEST_TTL_MS),
    resolved: state.resolved.filter((record) => at - record.at <= DELETION_REQUEST_TTL_MS),
    successes: successes.filter((success) =>
      at - success.at <= DELETION_OBSERVATION_WINDOW_MS),
  };
}

function pairConfirmedSuccess(
    state: DeletionTrackerState,
    tabId: number,
    at: number,
): DeletionTrackerResult {
  const ids = new Set(state.confirmations
      .filter((confirmation) =>
        confirmation.tabId === tabId && at - confirmation.at <= DELETION_OBSERVATION_WINDOW_MS)
      .map((confirmation) => confirmation.characterId));
  const succeeded = state.successes.some((success) =>
    success.tabId === tabId && at - success.at <= DELETION_OBSERVATION_WINDOW_MS);
  if (ids.size !== 1 || !succeeded) {
    return {signal: null, state};
  }
  const characterId = [...ids][0];
  if (characterId === undefined) {
    return {signal: null, state};
  }
  return {
    signal: {
      characterId,
      requestId: `confirmed-${tabId}-${characterId}`,
      tabId,
    },
    state: {
      ...state,
      confirmations: state.confirmations.filter((confirmation) =>
        confirmation.tabId !== tabId || confirmation.characterId !== characterId),
      successes: state.successes.filter((success) => success.tabId !== tabId),
    },
  };
}

function resolveRequest(
    state: DeletionTrackerState,
    record: DeletionRequestRecord,
    characterId: string,
    at: number,
): DeletionTrackerResult {
  const forgotten = forgetRequest(state, record.requestId, at);
  return {
    signal: {
      characterId,
      requestId: record.requestId,
      tabId: signalTab(state, record, characterId),
    },
    state: {
      ...forgotten,
      observations: forgotten.observations.filter((observation) =>
        observation.tabId !== record.tabId || observation.characterId !== characterId),
    },
  };
}

function forgetRequest(
    state: DeletionTrackerState,
    requestId: string,
    at: number,
): DeletionTrackerState {
  return {
    ...state,
    requests: state.requests.filter((record) => record.requestId !== requestId),
    resolved: state.resolved.some((record) => record.requestId === requestId)
      ? state.resolved
      : [...state.resolved, {at, requestId}],
  };
}

function replaceRequest(
    state: DeletionTrackerState,
    record: DeletionRequestRecord,
): DeletionTrackerState {
  return {
    ...state,
    requests: state.requests.map((candidate) =>
      candidate.requestId === record.requestId ? record : candidate),
  };
}

function singleObservedId(
    state: DeletionTrackerState,
    record: DeletionRequestRecord,
    at: number,
): string | null {
  const ids = new Set(state.observations
      .filter((observation) =>
        sameDeletionTab(record.tabId, observation.tabId)
        && Math.abs(at - observation.at) <= DELETION_OBSERVATION_WINDOW_MS)
      .map((observation) => observation.characterId));
  if (ids.size !== 1) {
    return null;
  }
  return [...ids][0] ?? null;
}

function signalTab(
    state: DeletionTrackerState,
    record: DeletionRequestRecord,
    characterId: string,
): number {
  if (record.tabId >= 0) {
    return record.tabId;
  }
  const tabs = new Set(state.observations
      .filter((observation) =>
        observation.characterId === characterId && observation.tabId >= 0)
      .map((observation) => observation.tabId));
  if (tabs.size === 1) {
    return [...tabs][0] ?? record.tabId;
  }
  return record.tabId;
}

function sameDeletionTab(requestTab: number, observedTab: number): boolean {
  return requestTab < 0 || requestTab === observedTab;
}

function isResolved(state: DeletionTrackerState, requestId: string): boolean {
  return state.resolved.some((record) => record.requestId === requestId);
}
