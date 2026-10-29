import {CHARACTER_DELETION_PAGE_SOURCE} from '../features/character-deletion/cleanup-messages';
import {
  characterIdFromDeletionJson,
  characterIdFromFormFields,
  isCharacterDeletionRequest,
  isCharacterDeletionSuccessStatus,
} from '../features/character-deletion/deletion-request';

// Chrome files an extension error when the top frame of an uncaught rejection
// is this content script. D&D Beyond's own failed fetches, such as the mega
// menu, were showing up there. The network call runs in a function created by
// a page script, so the top frame stays the page. Only a finished
// character-service DELETE is read. The request itself is unchanged.
const FETCH_BRIDGE = 'bfa.character-deletion.native-fetch';
const FETCH_BRIDGE_SOURCE = `(() => {
  const token = Symbol.for(${JSON.stringify(FETCH_BRIDGE)});
  if (typeof window[token] === 'function' || typeof window.fetch !== 'function') {
    return;
  }
  const native = window.fetch.bind(window);
  function bfaNativeFetch(input, init) {
    return native(input, init);
  }
  window[token] = bfaNativeFetch;
})();`;

const nativeFetch = globalThis.fetch.bind(globalThis);
const nativeOpen = XMLHttpRequest.prototype.open;
const nativeSend = XMLHttpRequest.prototype.send;
const requestContext = new WeakMap<XMLHttpRequest, {method: string; url: string}>();

installPageFetchBridge();

globalThis.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const identified = identifyFetch(input, init);
  const responsePromise = callPageFetch(input, init);
  void responsePromise.then((response) => {
    if (!isCharacterDeletionSuccessStatus(response.status)) {
      return;
    }
    void identified.then((identified) => {
      if (identified.matched) {
        reportDeletion(identified.characterId, response.status);
      }
    }).catch(() => undefined);
  }, () => undefined).catch(() => undefined);
  return responsePromise;
} as typeof fetch;

function installPageFetchBridge(): void {
  const host = window as unknown as Record<symbol, unknown>;
  const token = Symbol.for(FETCH_BRIDGE);
  if (typeof host[token] === 'function') {
    return;
  }
  const parent = document.documentElement ?? document.head;
  if (parent !== null) {
    try {
      const script = document.createElement('script');
      script.textContent = FETCH_BRIDGE_SOURCE;
      parent.append(script);
      script.remove();
    } catch {
      // A page policy can refuse the inline script. The fallback below still
      // calls the original fetch, from this file.
    }
  }
  if (typeof host[token] !== 'function') {
    host[token] = nativeFetch;
  }
}

function callPageFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const bridge = (window as unknown as Record<symbol, unknown>)[Symbol.for(FETCH_BRIDGE)];
  if (typeof bridge === 'function') {
    return (bridge as typeof fetch).call(window, input, init);
  }
  return nativeFetch(input, init);
}

XMLHttpRequest.prototype.open = function(this: XMLHttpRequest): void {
  requestContext.set(this, {
    method: String(arguments[0]),
    url: String(arguments[1]),
  });
  nativeOpen.apply(this, arguments as unknown as Parameters<XMLHttpRequest['open']>);
} as XMLHttpRequest['open'];

XMLHttpRequest.prototype.send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
  const context = requestContext.get(this);
  const target = context === undefined ? null : absoluteUrl(context.url);
  if (context !== undefined && target !== null && isCharacterDeletionRequest(context.method, target)) {
    const identified = identifyBody(body);
    this.addEventListener('load', () => {
      if (!isCharacterDeletionSuccessStatus(this.status)) {
        return;
      }
      void identified.then((characterId) => {
        reportDeletion(characterId, this.status);
      }).catch(() => undefined);
    });
  }
  return nativeSend.call(this, body);
};

function identifyFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<{characterId: string | null; matched: boolean}> {
  const unmatched = {characterId: null, matched: false};
  try {
    const method = init?.method
      ?? (input instanceof Request ? input.method : 'GET');
    const url = absoluteUrl(input instanceof Request ? input.url : String(input));
    if (url === null || !isCharacterDeletionRequest(method, url)) {
      return Promise.resolve(unmatched);
    }
    if (init?.body != null) {
      return identifyBody(init.body).then((characterId) => ({characterId, matched: true}));
    }
    if (input instanceof Request) {
      return input.clone().text()
          .then((text) => ({characterId: characterIdFromDeletionJson(text), matched: true}))
          .catch(() => ({characterId: null, matched: true}));
    }
  } catch {
    return Promise.resolve(unmatched);
  }
  return Promise.resolve({characterId: null, matched: true});
}

function identifyBody(body: unknown): Promise<string | null> {
  try {
    if (typeof body === 'string') {
      return Promise.resolve(characterIdFromDeletionJson(body));
    }
    if (body instanceof URLSearchParams) {
      return Promise.resolve(characterIdFromFormFields(body.getAll('characterId')));
    }
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return Promise.resolve(characterIdFromFormFields(
          body.getAll('characterId').filter((value): value is string => typeof value === 'string'),
      ));
    }
    if (body instanceof ArrayBuffer) {
      return Promise.resolve(characterIdFromDeletionJson(new TextDecoder().decode(body)));
    }
    if (ArrayBuffer.isView(body)) {
      return Promise.resolve(characterIdFromDeletionJson(new TextDecoder().decode(body)));
    }
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return body.text()
          .then((text) => characterIdFromDeletionJson(text))
          .catch(() => null);
    }
  } catch {
    return Promise.resolve(null);
  }
  return Promise.resolve(null);
}

function absoluteUrl(value: string): string | null {
  try {
    return new URL(value, window.location.href).href;
  } catch {
    return null;
  }
}

function reportDeletion(characterId: string | null, status: number): void {
  window.postMessage({
    characterId,
    source: CHARACTER_DELETION_PAGE_SOURCE,
    status,
  }, window.location.origin);
}
