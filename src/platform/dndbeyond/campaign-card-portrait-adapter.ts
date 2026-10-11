import {
  CAMPAIGN_CHARACTER_CARD_LINK_SELECTOR,
  CAMPAIGN_CHARACTER_CARD_PORTRAIT_SELECTOR,
  CAMPAIGN_CHARACTER_CARD_SELECTOR,
} from './selectors';
import {parseCharacterIdFromCharacterPageUrl} from './urls';
import {isHtmlAnchorElement, isHtmlElement} from '../../shared/dom';
import type {Cleanup} from '../../shared/types';

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
  }

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
    return parseCharacterIdFromCharacterPageUrl(new URL(href, baseUri));
  } catch {
    return null;
  }
}
