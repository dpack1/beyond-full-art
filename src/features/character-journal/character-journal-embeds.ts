import type {JournalImage} from './character-journal-types';

export const JOURNAL_IMAGE_ORPHAN_GRACE_MS = 30_000;

const EMBED_ID = '[A-Za-z0-9-]+';

export interface JournalImagePlacement {
  selectionEnd: number;
  selectionStart: number;
  value: string;
}

export interface ReconciledJournalImages {
  images: JournalImage[];
  removed: JournalImage[];
}

export function journalImageEmbed(imageId: string, caption?: string): string {
  const safe = (caption ?? '').replace(/[\[\]|\r\n]/g, '').trim();
  return safe === '' ? `![[img:${imageId}]]` : `![[img:${imageId}|${safe}]]`;
}

export function insertJournalImageEmbed(
    body: string,
    start: number,
    end: number,
    imageId: string,
    caption?: string,
): JournalImagePlacement {
  const embed = journalImageEmbed(imageId, caption);
  const safeStart = clamp(start, 0, body.length);
  const safeEnd = clamp(end, safeStart, body.length);
  const value = `${body.slice(0, safeStart)}${embed}${body.slice(safeEnd)}`;
  const cursor = safeStart + embed.length;
  return {
    selectionEnd: cursor,
    selectionStart: cursor,
    value,
  };
}

export function journalImageIdsInBody(body: string): Set<string> {
  const ids = new Set<string>();
  for (const match of body.matchAll(embedPattern())) {
    const id = match[1];
    if (id !== undefined) {
      ids.add(id);
    }
  }

  for (const match of body.matchAll(legacyPattern())) {
    const id = match[1];
    if (id !== undefined) {
      ids.add(id);
    }
  }

  return ids;
}

export function embedMissingJournalImages(
    body: string,
    images: readonly {id: string; orphanedAt?: string | null}[],
): string {
  const referenced = journalImageIdsInBody(body);
  const missing = images.filter((image) =>
    !referenced.has(image.id) && !isOrphaned(image.orphanedAt),
  );
  if (missing.length === 0) {
    return body;
  }

  const lines = missing.map((image) => journalImageEmbed(image.id)).join('\n');
  return body.trim() === '' ? lines : `${body.replace(/\s+$/, '')}\n\n${lines}`;
}

export function expandJournalImageEmbeds(source: string): string {
  return source.replace(embedPattern(), (_match, id: string, pipes: string | undefined) => {
    const details = embedDetails(pipes ?? '');
    const alt = details.alt.replace(/[\[\]"\\]/g, '');
    const title = details.width === null ? '' : ` "${details.width}"`;
    return `![${alt}](bfa-journal-image:${id}${title})`;
  });
}

export function journalImageWidth(title: string | null | undefined): number | null {
  if (title === null || title === undefined) {
    return null;
  }

  return embedWidth(title.trim());
}

export function reconcileJournalImageRecords(
    images: readonly JournalImage[],
    body: string,
    now: Date,
    graceMs = JOURNAL_IMAGE_ORPHAN_GRACE_MS,
): ReconciledJournalImages {
  const referenced = journalImageIdsInBody(body);
  const kept: JournalImage[] = [];
  const removed: JournalImage[] = [];
  const instant = now.getTime();
  for (const image of images) {
    if (referenced.has(image.id)) {
      kept.push(clearOrphan(image));
      continue;
    }

    const marked = image.orphanedAt;
    if (!isOrphaned(marked)) {
      kept.push({...image, orphanedAt: now.toISOString()});
      continue;
    }

    const then = Date.parse(marked);
    if (!Number.isFinite(then) || instant - then < graceMs) {
      kept.push(image);
      continue;
    }

    removed.push(image);
  }

  return {images: kept, removed};
}

function embedPattern(): RegExp {
  return new RegExp(`!\\[\\[img:(${EMBED_ID})((?:\\|[^\\]\\n|]+)*)\\]\\]`, 'g');
}

function legacyPattern(): RegExp {
  return new RegExp(
      `!\\[[^\\]]*\\]\\(bfa-journal-image:(${EMBED_ID})(?:\\s+"[^"]*")?\\)`,
      'g',
  );
}

function embedDetails(pipes: string): {alt: string; width: number | null} {
  const parts = pipes.split('|').filter((part) => part !== '');
  let width: number | null = null;
  const caption: string[] = [];
  for (const part of parts) {
    const parsed = embedWidth(part);
    if (parsed !== null) {
      width = parsed;
      continue;
    }

    caption.push(part);
  }

  return {alt: caption.join('|'), width};
}

function embedWidth(part: string): number | null {
  if (!/^\d{1,4}$/.test(part)) {
    return null;
  }

  const value = Number(part);
  if (!Number.isInteger(value) || value < 1 || value > 4096) {
    return null;
  }

  return value;
}

function isOrphaned(value: string | null | undefined): value is string {
  return typeof value === 'string' && value !== '';
}

function clearOrphan(image: JournalImage): JournalImage {
  if (!isOrphaned(image.orphanedAt)) {
    return image;
  }

  const next = {...image};
  delete next.orphanedAt;
  return next;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
