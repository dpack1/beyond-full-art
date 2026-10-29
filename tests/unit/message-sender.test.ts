import {describe, expect, it} from 'vitest';

import {isTrustedMessageSender} from '../../src/background/message-sender';

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

describe('trusted background message senders', () => {
  it.each([
    `chrome-extension://${EXTENSION_ID}/popup/settings.html`,
    `chrome-extension://${EXTENSION_ID}/folder/setup.html`,
    'https://www.dndbeyond.com/characters',
    'https://www.dndbeyond.com/characters/172153137',
    'https://www.dndbeyond.com/campaigns/1234',
  ])('allows the extension and supported D&D Beyond surfaces: %s', (url) => {
    expect(isTrustedMessageSender({id: EXTENSION_ID, url}, EXTENSION_ID)).toBe(true);
  });

  it.each([
    'https://evil.example/characters/172153137',
    'https://www.dndbeyond.com/account',
    `chrome-extension://differentextensionid/popup/settings.html`,
  ])('rejects an untrusted URL: %s', (url) => {
    expect(isTrustedMessageSender({id: EXTENSION_ID, url}, EXTENSION_ID)).toBe(false);
  });

  it('rejects another extension even on an allowed page URL', () => {
    expect(isTrustedMessageSender({
      id: 'differentextensionid',
      url: 'https://www.dndbeyond.com/characters/172153137',
    }, EXTENSION_ID)).toBe(false);
  });

  it('rejects a sender with no URL context', () => {
    expect(isTrustedMessageSender({id: EXTENSION_ID}, EXTENSION_ID)).toBe(false);
  });

  it('uses the tab URL when sender.url is unavailable', () => {
    expect(isTrustedMessageSender({
      id: EXTENSION_ID,
      tab: {url: 'https://www.dndbeyond.com/characters/172153137'} as chrome.tabs.Tab,
    }, EXTENSION_ID)).toBe(true);
  });
});
