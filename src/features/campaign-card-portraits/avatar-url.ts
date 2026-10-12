const DND_BEYOND_AVATAR_HOST = 'www.dndbeyond.com';
const DND_BEYOND_AVATAR_PATH_PREFIX = '/avatars/';
const DND_BEYOND_AVATAR_THUMBNAIL_PATH_PATTERN =
  /^\/avatars\/thumbnails\/([^/]+)\/([^/]+)\/\d+\/\d+\/(.+)$/;
const TARGET_HEIGHT = '600';
const TARGET_WIDTH = '600';
const TARGET_FIT = 'bounds';
const TARGET_QUALITY = '95';
const TARGET_AUTO = 'webp';

const BACKGROUND_IMAGE_URL_PATTERN = /^url\((['"]?)(.+)\1\)$/;

export function buildCampaignCardPortraitUpgradeUrl(
    backgroundImageUrl: string,
): string | null {
  let candidateUrl: URL;
  try {
    candidateUrl = new URL(backgroundImageUrl);
  } catch {
    return null;
  }

  if (!isDndBeyondAvatarUrl(candidateUrl)) {
    return null;
  }

  candidateUrl.pathname = normalizeAvatarPath(candidateUrl.pathname);
  candidateUrl.searchParams.set('width', TARGET_WIDTH);
  candidateUrl.searchParams.set('height', TARGET_HEIGHT);
  candidateUrl.searchParams.set('fit', TARGET_FIT);
  candidateUrl.searchParams.set('quality', TARGET_QUALITY);
  candidateUrl.searchParams.set('auto', TARGET_AUTO);
  return candidateUrl.toString();
}

export function extractBackgroundImageUrl(
    backgroundImageValue: string,
): string | null {
  const trimmedValue = backgroundImageValue.trim();
  if (trimmedValue === '' || trimmedValue === 'none') {
    return null;
  }

  const match = BACKGROUND_IMAGE_URL_PATTERN.exec(trimmedValue);
  if (match === null) {
    return null;
  }

  return match[2] ?? null;
}

export function formatBackgroundImageUrl(backgroundImageUrl: string): string {
  return `url("${backgroundImageUrl}")`;
}

function isDndBeyondAvatarUrl(candidateUrl: URL): boolean {
  return candidateUrl.hostname === DND_BEYOND_AVATAR_HOST &&
    candidateUrl.pathname.startsWith(DND_BEYOND_AVATAR_PATH_PREFIX);
}

function normalizeAvatarPath(pathname: string): string {
  const thumbnailMatch = DND_BEYOND_AVATAR_THUMBNAIL_PATH_PATTERN.exec(pathname);
  if (thumbnailMatch === null) {
    return pathname;
  }

  const [, firstPathId, secondPathId, fileName] = thumbnailMatch;
  return `/avatars/${firstPathId}/${secondPathId}/${fileName}`;
}
