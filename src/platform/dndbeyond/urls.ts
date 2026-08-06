const CHARACTER_PAGE_PATH_PATTERN = /^\/characters\/(\d+)(?:\/.*)?$/;

export function isCharacterPageUrl(url: URL): boolean {
  return CHARACTER_PAGE_PATH_PATTERN.test(url.pathname);
}

export function parseCharacterIdFromCharacterPageUrl(
    url: URL,
): string | null {
  const match = CHARACTER_PAGE_PATH_PATTERN.exec(url.pathname);
  if (match === null) {
    return null;
  }

  return match[1] ?? null;
}
