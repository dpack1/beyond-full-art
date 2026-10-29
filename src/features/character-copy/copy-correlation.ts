export const COPY_OBSERVATION_WINDOW_MS = 15_000;

export interface CopyClick {
  at: number;
  sourceId: string;
  tabId: number;
}

export interface CopyObserved {
  at: number;
  destinationId: string;
  sourceFromPath: boolean;
  sourceId: string | null;
  tabId: number;
}

export interface CopySignal {
  destinationId: string;
  sourceId: string;
  tabId: number;
}

export interface CopyTrackerState {
  clicks: CopyClick[];
  observed: CopyObserved[];
}

export function createCopyTrackerState(): CopyTrackerState {
  return {clicks: [], observed: []};
}

export function noteCopyClicked(
    state: CopyTrackerState,
    click: CopyClick,
    now: number,
): {signal: CopySignal | null; state: CopyTrackerState} {
  const next = expireCopyTracker({
    clicks: [...state.clicks.filter((item) =>
      item.tabId !== click.tabId || item.sourceId !== click.sourceId), click],
    observed: state.observed,
  }, now);
  return pairCopy(next, now);
}

export function noteCopyObserved(
    state: CopyTrackerState,
    observed: CopyObserved,
    now: number,
): {signal: CopySignal | null; state: CopyTrackerState} {
  const next = expireCopyTracker({
    clicks: state.clicks,
    observed: [...state.observed, observed],
  }, now);
  return pairCopy(next, now);
}

function pairCopy(
    state: CopyTrackerState,
    now: number,
): {signal: CopySignal | null; state: CopyTrackerState} {
  for (const observed of state.observed) {
    if (now - observed.at > COPY_OBSERVATION_WINDOW_MS) {
      continue;
    }
    // The source can be identified by either a named copy URL or the request
    // body. The live collection copy endpoint sends {characterId} in its body,
    // so it is as authoritative as an id embedded in the path. Keep the click
    // correlation only as a fallback for requests that expose no source id.
    if (observed.sourceId !== null) {
      if (observed.sourceId === observed.destinationId) {
        continue;
      }
      return {
        signal: {
          destinationId: observed.destinationId,
          sourceId: observed.sourceId,
          tabId: observed.tabId,
        },
        state: {
          clicks: state.clicks,
          observed: state.observed.filter((item) => item !== observed),
        },
      };
    }
    const clicks = state.clicks.filter((click) =>
      click.tabId === observed.tabId && now - click.at <= COPY_OBSERVATION_WINDOW_MS);
    const sourceIds = [...new Set(clicks.map((click) => click.sourceId))];
    if (sourceIds.length !== 1) {
      continue;
    }
    const sourceId = sourceIds[0];
    if (sourceId === undefined || sourceId === observed.destinationId) {
      continue;
    }
    if (observed.sourceId !== null && observed.sourceId !== sourceId) {
      continue;
    }
    return {
      signal: {destinationId: observed.destinationId, sourceId, tabId: observed.tabId},
      state: {
        clicks: state.clicks.filter((click) => click.tabId !== observed.tabId),
        observed: state.observed.filter((item) => item !== observed),
      },
    };
  }
  return {signal: null, state};
}

function expireCopyTracker(state: CopyTrackerState, now: number): CopyTrackerState {
  return {
    clicks: state.clicks.filter((click) => now - click.at <= COPY_OBSERVATION_WINDOW_MS),
    observed: state.observed.filter((item) => now - item.at <= COPY_OBSERVATION_WINDOW_MS),
  };
}
