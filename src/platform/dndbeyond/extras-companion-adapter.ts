import type {Cleanup} from '../../shared/types';
import {
  CHARACTER_HEADER_AVATAR_SELECTOR,
  CHARACTER_HEADER_PORTRAIT_SELECTOR,
  CHARACTER_SHEET_SELECTOR,
  EXTRAS_COMPANION_GROUP_SELECTOR,
  EXTRAS_COMPANION_IMAGE_SELECTOR,
  EXTRAS_COMPANION_NAME_SELECTOR,
  EXTRAS_COMPANION_ROW_SELECTOR,
  EXTRAS_COMPANION_TYPE_SELECTOR,
} from './selectors';

export interface ExtrasCompanionTarget {
  companionId: string;
  group: string;
  image: HTMLImageElement;
  imageUrl: string;
  name: string;
  row: HTMLElement;
  type: string | null;
}

export interface CharacterHeaderPortraitTarget {
  container: HTMLElement;
  portrait: HTMLImageElement;
}

export interface ExtrasCompanionTargets {
  companions: ExtrasCompanionTarget[];
  header: CharacterHeaderPortraitTarget | null;
}

interface CompanionDraft extends Omit<ExtrasCompanionTarget, 'companionId'> {
  baseId: string;
}

export function findExtrasCompanionTargets(
    root: ParentNode,
): ExtrasCompanionTarget[] {
  const drafts = Array.from(
      root.querySelectorAll<HTMLElement>(EXTRAS_COMPANION_ROW_SELECTOR),
  ).map(readCompanionDraft).filter((draft): draft is CompanionDraft => draft !== null);
  const counts = new Map<string, number>();
  for (const draft of drafts) {
    counts.set(draft.baseId, (counts.get(draft.baseId) ?? 0) + 1);
  }

  return drafts.map(({baseId, ...draft}) => ({
    ...draft,
    companionId: counts.get(baseId) === 1
      ? baseId
      : `${baseId}\u001f${normalizeIdentity(draft.imageUrl)}`,
  }));
}

export function findCharacterHeaderPortrait(
    root: ParentNode,
): CharacterHeaderPortraitTarget | null {
  const container = root.querySelector<HTMLElement>(CHARACTER_HEADER_AVATAR_SELECTOR);
  const portrait = root.querySelector<HTMLImageElement>(CHARACTER_HEADER_PORTRAIT_SELECTOR);
  if (container === null || portrait === null || !container.contains(portrait)) {
    return null;
  }
  return {container, portrait};
}

export function observeExtrasCompanionTargets(
    callback: (targets: ExtrasCompanionTargets) => void,
    doc: Document = document,
): Cleanup {
  let queued = false;
  const notify = () => {
    queued = false;
    callback({
      companions: findExtrasCompanionTargets(doc),
      header: findCharacterHeaderPortrait(doc),
    });
  };
  const queueNotify = () => {
    if (queued) {
      return;
    }
    queued = true;
    queueMicrotask(notify);
  };

  notify();
  const observationRoot = doc.querySelector(CHARACTER_SHEET_SELECTOR) ?? doc.body;
  const observer = new MutationObserver(queueNotify);
  observer.observe(observationRoot, {childList: true, subtree: true});

  return () => {
    observer.disconnect();
    queued = false;
  };
}

function readCompanionDraft(row: HTMLElement): CompanionDraft | null {
  const image = row.querySelector<HTMLImageElement>(EXTRAS_COMPANION_IMAGE_SELECTOR);
  const nameElement = row.querySelector<HTMLElement>(EXTRAS_COMPANION_NAME_SELECTOR);
  if (image === null || nameElement === null) {
    return null;
  }

  const imageUrl = preferredImageUrl(image);
  const name = directText(nameElement);
  if (imageUrl === null || name === '') {
    return null;
  }

  const typeText = row.querySelector<HTMLElement>(EXTRAS_COMPANION_TYPE_SELECTOR)
      ?.textContent?.trim() ?? '';
  const type = typeText === '' ? null : typeText;
  const group = findGroupName(row) ?? 'Extra';
  return {
    baseId: [group, name, type ?? ''].map(normalizeIdentity).join('\u001f'),
    group,
    image,
    imageUrl,
    name,
    row,
    type,
  };
}

function findGroupName(row: HTMLElement): string | null {
  let ancestor = row.parentElement;
  while (ancestor !== null) {
    const heading = ancestor.querySelector<HTMLElement>(EXTRAS_COMPANION_GROUP_SELECTOR);
    const text = heading?.textContent?.trim() ?? '';
    if (text !== '') {
      return text;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
}

function directText(element: HTMLElement): string {
  const direct = Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
      .trim();
  return direct === '' ? element.textContent?.replace(/\*+$/, '').trim() ?? '' : direct;
}

function preferredImageUrl(image: HTMLImageElement): string | null {
  const value = image.currentSrc.trim() || image.src.trim();
  if (value === '') {
    return null;
  }
  try {
    return new URL(value, image.ownerDocument.baseURI).href;
  } catch {
    return null;
  }
}

function normalizeIdentity(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
