const DND_BEYOND_ORIGIN = 'https://www.dndbeyond.com';

/**
 * Privileged background operations accept messages only from this extension's
 * own pages or its content scripts on the D&D Beyond surfaces in the manifest.
 */
export function isTrustedMessageSender(
    sender: chrome.runtime.MessageSender,
    extensionId: string = chrome.runtime.id,
): boolean {
  if (extensionId === '' || sender.id !== extensionId) {
    return false;
  }

  const senderUrl = sender.url ?? sender.tab?.url;
  if (senderUrl === undefined) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(senderUrl);
  } catch {
    return false;
  }

  if (url.protocol === 'chrome-extension:' && url.host === extensionId) {
    return true;
  }
  if (url.origin !== DND_BEYOND_ORIGIN) {
    return false;
  }

  return url.pathname === '/characters'
    || url.pathname.startsWith('/characters/')
    || url.pathname.startsWith('/campaigns/');
}
