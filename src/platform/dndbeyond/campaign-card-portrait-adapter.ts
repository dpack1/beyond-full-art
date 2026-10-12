import {
  CAMPAIGN_CHARACTER_CARD_LINK_SELECTOR,
  CAMPAIGN_CHARACTER_CARD_PORTRAIT_SELECTOR,
  CAMPAIGN_CHARACTER_CARD_SELECTOR,
  CHARACTER_LIST_CARD_LINK_SELECTOR,
  CHARACTER_LIST_CARD_PORTRAIT_SELECTOR,
} from './selectors';
import {parseCharacterIdFromCharacterPageUrl} from './urls';
import {isHtmlAnchorElement, isHtmlElement} from '../../shared/dom';
import type {Cleanup} from '../../shared/types';

const CHARACTER_ID_IN_PATH_PATTERN = /(?:^|\/)characters\/(\d+)(?:\/|$)/;

export interface CampaignCardPortraitTarget {
  card: HTMLElement;
  characterId: string;
  detailsLink: HTMLAnchorElement;
  portrait: HTMLElement;
}

export function findCampaignCardPortraitTargets(
    root: ParentNode,
): CampaignCardPortraitTarget[] {
  const targets: CampaignCardPortraitTarget[] = [];
  const seenPortraits = new Set<HTMLElement>();
  const cards = root.querySelectorAll(CAMPAIGN_CHARACTER_CARD_SELECTOR);

  for (const card of cards) {
    if (!isHtmlElement(card)) {
      continue;
    }

    const detailsLink = card.querySelector(CAMPAIGN_CHARACTER_CARD_LINK_SELECTOR);
    if (!isHtmlAnchorElement(detailsLink)) {
      continue;
    }

    const portrait = card.querySelector(CAMPAIGN_CHARACTER_CARD_PORTRAIT_SELECTOR);
    if (!isHtmlElement(portrait)) {
      continue;
    }

    const characterId = parseCharacterIdFromLink(detailsLink, root);
    if (characterId === null) {
      continue;
    }

    targets.push({
      card,
      characterId,
      detailsLink,
      portrait,
    });
    seenPortraits.add(portrait);
  }

  targets.push(...findCharacterListCardPortraitTargets(root, seenPortraits));
  return targets;
}

export function observeCampaignCardPortraitTargets(
    callback: (target: CampaignCardPortraitTarget) => void,
    doc: Document = document,
): Cleanup {
  const notify = () => {
    for (const target of findCampaignCardPortraitTargets(doc)) {
      callback(target);
    }
  };

  notify();

  const observer = createMutationObserver(doc, notify);
  observer.observe(doc.body, {childList: true, subtree: true});

  return () => {
    observer.disconnect();
  };
}

function createMutationObserver(
    doc: Document,
    callback: MutationCallback,
): MutationObserver {
  const ViewMutationObserver = doc.defaultView?.MutationObserver;
  if (ViewMutationObserver === undefined) {
    return new MutationObserver(callback);
  }

  return new ViewMutationObserver(callback);
}

function parseCharacterIdFromLink(
    detailsLink: HTMLAnchorElement,
    root: ParentNode,
): string | null {
  const baseUri = root instanceof Document ? root.location.href : detailsLink.baseURI;
  const href = detailsLink.getAttribute('href');
  if (href === null) {
    return null;
  }

  try {
    const url = new URL(href, baseUri);
    return parseCharacterIdFromCharacterPageUrl(url) ??
      parseCharacterIdFromAnyCharacterUrl(url);
  } catch {
    return null;
  }
}

function parseCharacterIdFromAnyCharacterUrl(url: URL): string | null {
  const match = CHARACTER_ID_IN_PATH_PATTERN.exec(url.pathname);
  return match?.[1] ?? null;
}

function findCharacterListCardPortraitTargets(
    root: ParentNode,
    seenPortraits: Set<HTMLElement>,
): CampaignCardPortraitTarget[] {
  const targets: CampaignCardPortraitTarget[] = [];
  const links = root.querySelectorAll(CHARACTER_LIST_CARD_LINK_SELECTOR);

  for (const link of links) {
    if (!isHtmlAnchorElement(link)) {
      continue;
    }

    const characterId = parseCharacterIdFromLink(link, root);
    if (characterId === null) {
      continue;
    }

    const target = findCharacterListTargetForLink(link, characterId);
    if (target === null || seenPortraits.has(target.portrait)) {
      continue;
    }

    targets.push(target);
    seenPortraits.add(target.portrait);
  }

  return targets;
}

function findCharacterListTargetForLink(
    detailsLink: HTMLAnchorElement,
    characterId: string,
): CampaignCardPortraitTarget | null {
  let candidate: HTMLElement | null = detailsLink.parentElement;

  while (candidate !== null && candidate !== detailsLink.ownerDocument.body) {
    const portrait = findCharacterListPortrait(candidate);
    if (portrait !== null) {
      return {
        card: candidate,
        characterId,
        detailsLink,
        portrait,
      };
    }

    candidate = candidate.parentElement;
  }

  return null;
}

function findCharacterListPortrait(root: ParentNode): HTMLElement | null {
  const candidates = root.querySelectorAll(CHARACTER_LIST_CARD_PORTRAIT_SELECTOR);
  for (const candidate of candidates) {
    if (!isHtmlElement(candidate)) {
      continue;
    }

    if (candidate.style.backgroundImage.trim() === '') {
      continue;
    }

    return candidate;
  }

  return null;
}
