import {beforeAll, describe, expect, it} from 'vitest';

import {CHARACTER_DELETION_PAGE_SOURCE} from '../../src/features/character-deletion/cleanup-messages';
import {CHARACTER_COPY_PAGE_SOURCE} from '../../src/features/character-copy/copy-messages';

const DELETE_URL = 'https://character-service.dndbeyond.com/character/v5/character';

let currentFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = () =>
  Promise.resolve(new Response(null, {status: 200}));

beforeAll(async () => {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    currentFetch(input, init)) as typeof fetch;
  await import('../../src/content/character-deletion-main');
});

describe('character deletion network observer', () => {
  it('reports a successful character-service DELETE', async () => {
    currentFetch = () => Promise.resolve(new Response(null, {status: 200}));
    const reported = new Promise((resolve) => {
      window.addEventListener('message', function onReport(event: MessageEvent) {
        if (event.data?.source === CHARACTER_DELETION_PAGE_SOURCE) {
          window.removeEventListener('message', onReport);
          resolve(event.data);
        }
      });
    });

    await fetch(DELETE_URL, {
      body: JSON.stringify({characterId: 900000002}),
      method: 'DELETE',
    });

    await expect(reported).resolves.toEqual({
      characterId: '900000002',
      source: CHARACTER_DELETION_PAGE_SOURCE,
      status: 200,
    });
  });

  it('lets an unrelated failed fetch reject without reporting a deletion', async () => {
    const messages: unknown[] = [];
    const leaks: unknown[] = [];
    const onMessage = (event: MessageEvent) => {
      messages.push(event.data);
    };
    const onLeak = (event: PromiseRejectionEvent) => {
      leaks.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('unhandledrejection', onLeak);
    currentFetch = () => Promise.reject(new TypeError('Failed to fetch'));

    await expect(fetch('https://menu.test/assets/index.js')).rejects.toThrow('Failed to fetch');
    void fetch('https://menu.test/assets/index.js');
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.removeEventListener('message', onMessage);
    window.removeEventListener('unhandledrejection', onLeak);

    expect(messages).toEqual([]);
    expect(leaks).toEqual([]);
  });
});

describe('character copy network observer', () => {
  it('reports the source id from the live copy request body', async () => {
    currentFetch = () => Promise.resolve(new Response(JSON.stringify({
      data: null,
      id: 172948676,
      message: 'Copy character is complete.',
      pagination: null,
      success: true,
    }), {status: 200}));
    const reported = new Promise((resolve) => {
      window.addEventListener('message', function onReport(event: MessageEvent) {
        if (event.data?.source === CHARACTER_COPY_PAGE_SOURCE) {
          window.removeEventListener('message', onReport);
          resolve(event.data);
        }
      });
    });

    await fetch('https://character-service.dndbeyond.com/character/v5/character/copy', {
      body: JSON.stringify({characterId: 900000002}),
      method: 'POST',
    });

    await expect(reported).resolves.toEqual({
      destinationId: '172948676',
      source: CHARACTER_COPY_PAGE_SOURCE,
      sourceFromPath: false,
      sourceId: '900000002',
      status: 200,
    });
  });
});
