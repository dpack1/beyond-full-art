import {describe, expect, it} from 'vitest';

import {
  createDeletionTrackerState,
  DELETION_REQUEST_TTL_MS,
  noteDeletionCompleted,
  noteDeletionConfirmed,
  noteDeletionFailed,
  noteDeletionRequest,
  noteFetchSucceeded,
  notePageDeletion,
} from '../../src/features/character-deletion/deletion-correlation';

const NOW = 1_700_000_000_000;

describe('character deletion correlation', () => {
  it('signals once when a 204 completion has one character id', () => {
    const started = noteDeletionRequest(createDeletionTrackerState(), {
      at: NOW,
      characterId: '900000001',
      requestId: 'a',
      tabId: 3,
    });
    const completed = noteDeletionCompleted(started.state, {
      at: NOW + 20,
      requestId: 'a',
      statusCode: 204,
      tabId: 3,
    });
    const duplicate = noteDeletionCompleted(completed.state, {
      at: NOW + 30,
      requestId: 'a',
      statusCode: 204,
      tabId: 3,
    });

    expect(completed.signal).toEqual({
      characterId: '900000001',
      requestId: 'a',
      tabId: 3,
    });
    expect(duplicate.signal).toBeNull();
  });

  it('treats the observed 200 response as success and ignores other statuses', () => {
    const started = noteDeletionRequest(createDeletionTrackerState(), {
      at: NOW,
      characterId: '900000003',
      requestId: 'ok',
      tabId: 8,
    });
    const completed = noteDeletionCompleted(started.state, {
      at: NOW + 20,
      requestId: 'ok',
      statusCode: 200,
      tabId: 8,
    });
    const other = noteDeletionCompleted(noteDeletionRequest(createDeletionTrackerState(), {
      at: NOW,
      characterId: '900000003',
      requestId: 'created',
      tabId: 8,
    }).state, {
      at: NOW + 20,
      requestId: 'created',
      statusCode: 201,
      tabId: 8,
    });

    expect(completed.signal?.characterId).toBe('900000003');
    expect(other.signal).toBeNull();
  });

  it('keeps art when the deletion fails or the body is ambiguous', () => {
    const started = noteDeletionRequest(createDeletionTrackerState(), {
      at: NOW,
      characterId: '900000001',
      requestId: 'failed',
      tabId: 3,
    });
    const failed = noteDeletionCompleted(started.state, {
      at: NOW + 10,
      requestId: 'failed',
      statusCode: 500,
      tabId: 3,
    });
    const errored = noteDeletionFailed(noteDeletionRequest(createDeletionTrackerState(), {
      at: NOW,
      characterId: '900000001',
      requestId: 'network',
      tabId: 3,
    }).state, {at: NOW + 10, requestId: 'network'});
    const conflicting = noteDeletionRequest(noteDeletionRequest(createDeletionTrackerState(), {
      at: NOW,
      characterId: '900000001',
      requestId: 'body',
      tabId: 4,
    }).state, {
      at: NOW + 5,
      characterId: '169418374',
      requestId: 'body',
      tabId: 4,
    });
    const conflictCompleted = noteDeletionCompleted(conflicting.state, {
      at: NOW + 15,
      requestId: 'body',
      statusCode: 204,
      tabId: 4,
    });

    expect(failed.signal).toBeNull();
    expect(errored.signal).toBeNull();
    expect(conflictCompleted.signal).toBeNull();
  });

  it('uses one page observation only when the request body had no id', () => {
    const started = noteDeletionRequest(createDeletionTrackerState(), {
      at: NOW,
      characterId: null,
      requestId: 'a',
      tabId: 7,
    });
    const observed = notePageDeletion(started.state, {
      at: NOW + 5,
      characterId: '169418374',
      statusCode: 204,
      tabId: 7,
    });
    const completed = noteDeletionCompleted(observed.state, {
      at: NOW + 12,
      requestId: 'a',
      statusCode: 204,
      tabId: 7,
    });

    expect(observed.signal).toBeNull();
    expect(completed.signal?.characterId).toBe('169418374');
  });

  it('does not cross character ids between tabs or anonymous requests', () => {
    let state = createDeletionTrackerState();
    state = noteDeletionRequest(state, {
      at: NOW,
      characterId: null,
      requestId: 'one',
      tabId: 1,
    }).state;
    state = noteDeletionRequest(state, {
      at: NOW,
      characterId: null,
      requestId: 'two',
      tabId: 1,
    }).state;
    state = noteDeletionCompleted(state, {
      at: NOW + 10,
      requestId: 'one',
      statusCode: 204,
      tabId: 1,
    }).state;
    state = noteDeletionCompleted(state, {
      at: NOW + 11,
      requestId: 'two',
      statusCode: 204,
      tabId: 1,
    }).state;
    const ambiguous = notePageDeletion(state, {
      at: NOW + 12,
      characterId: '900000001',
      statusCode: 204,
      tabId: 1,
    });
    const otherTab = notePageDeletion(noteDeletionCompleted(noteDeletionRequest(
        createDeletionTrackerState(),
        {at: NOW, characterId: null, requestId: 'tab', tabId: 2},
    ).state, {
      at: NOW + 10,
      requestId: 'tab',
      statusCode: 204,
      tabId: 2,
    }).state, {
      at: NOW + 12,
      characterId: '169418374',
      statusCode: 204,
      tabId: 9,
    });

    expect(ambiguous.signal).toBeNull();
    expect(otherTab.signal).toBeNull();
  });

  it('drops a request that completes after it expires', () => {
    const started = noteDeletionRequest(createDeletionTrackerState(), {
      at: NOW,
      characterId: '900000001',
      requestId: 'old',
      tabId: 1,
    });
    const completed = noteDeletionCompleted(started.state, {
      at: NOW + DELETION_REQUEST_TTL_MS + 1,
      requestId: 'old',
      statusCode: 204,
      tabId: 1,
    });
    expect(completed.signal).toBeNull();
  });

  it('accepts a page observation that arrives after the 204', () => {
    const completed = noteDeletionCompleted(noteDeletionRequest(createDeletionTrackerState(), {
      at: NOW,
      characterId: null,
      requestId: 'late',
      tabId: 5,
    }).state, {
      at: NOW + 10,
      requestId: 'late',
      statusCode: 204,
      tabId: 5,
    });
    const observed = notePageDeletion(completed.state, {
      at: NOW + 40,
      characterId: '900000001',
      statusCode: 204,
      tabId: 5,
    });
    expect(observed.signal).toEqual({
      characterId: '900000001',
      requestId: 'late',
      tabId: 5,
    });
  });

  it('pairs one named character with a delete that has no tab id', () => {
    const completed = noteDeletionCompleted(notePageDeletion(createDeletionTrackerState(), {
      at: NOW,
      characterId: '900000003',
      statusCode: 200,
      tabId: 4,
    }).state, {
      at: NOW + 20,
      requestId: 'blank',
      statusCode: 200,
      tabId: -1,
    });
    expect(completed.signal).toEqual({
      characterId: '900000003',
      requestId: 'blank',
      tabId: 4,
    });
  });

  it('shows the prompt after the delete click and the finished response, in either order', () => {
    const clickedFirst = noteFetchSucceeded(noteDeletionConfirmed(
        createDeletionTrackerState(),
        {at: NOW, characterId: '900000003', tabId: 4},
    ).state, {at: NOW + 30, statusCode: 200, tabId: 4});
    const responseFirst = noteDeletionConfirmed(noteFetchSucceeded(
        createDeletionTrackerState(),
        {at: NOW, statusCode: 200, tabId: 4},
    ).state, {at: NOW + 30, characterId: '900000003', tabId: 4});
    const responseOnly = noteFetchSucceeded(createDeletionTrackerState(), {
      at: NOW,
      statusCode: 200,
      tabId: 4,
    });

    expect(clickedFirst.signal?.characterId).toBe('900000003');
    expect(clickedFirst.signal?.tabId).toBe(4);
    expect(responseFirst.signal?.characterId).toBe('900000003');
    expect(responseOnly.signal).toBeNull();
  });
});
