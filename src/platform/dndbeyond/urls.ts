const CHARACTER_SHEET_PATH_PATTERN = /^\/characters\/(\d+)\/?$/;

export function isCharacterSheetUrl(url: URL): boolean {
  return CHARACTER_SHEET_PATH_PATTERN.test(url.pathname);
}

export function parseCharacterIdFromCharacterSheetUrl(
    url: URL,
): string | null {
  const match = CHARACTER_SHEET_PATH_PATTERN.exec(url.pathname);
  if (match === null) {
    return null;
  }

  return match[1] ?? null;
}
