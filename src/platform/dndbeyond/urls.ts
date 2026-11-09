const CHARACTER_PAGE_PATH_PATTERN = /^\/characters\/(\d+)(?:\/.*)?$/;
const CHARACTER_COLLECTION_PATH_PATTERN = /^\/characters\/?$/;
const CAMPAIGN_PAGE_PATH_PATTERN = /^\/campaigns(?:\/.*)?$/;
// The character app serves the builder at /characters/<id>/builder/... and
// /characters/builder/... The sheet is every other character path, including
// a share link /characters/<id>/<share id>.
const CHARACTER_BUILDER_PATH_PATTERN =
  /^\/characters\/(?:builder(?:\/|$)|[0-9]+\/builder(?:\/|$))/;
const DND_BEYOND_ORIGIN = 'https://www.dndbeyond.com';

export function buildCharacterPageUrl(characterId: string): string {
  return `${DND_BEYOND_ORIGIN}/characters/${encodeURIComponent(characterId)}`;
}

export function isCharacterPageUrl(url: URL): boolean {
  return CHARACTER_PAGE_PATH_PATTERN.test(url.pathname);
}

export function isCharacterSheetPath(url: URL): boolean {
  return isCharacterPageUrl(url)
    && !CHARACTER_BUILDER_PATH_PATTERN.test(url.pathname);
}

export function isCharacterCollectionPageUrl(url: URL): boolean {
  return CHARACTER_COLLECTION_PATH_PATTERN.test(url.pathname);
}

export function isCampaignPageUrl(url: URL): boolean {
  return CAMPAIGN_PAGE_PATH_PATTERN.test(url.pathname);
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
