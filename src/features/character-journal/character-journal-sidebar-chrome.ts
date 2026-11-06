import {
  DEFAULT_SIDEBAR_CHROME,
  effectiveSidebarChrome,
  toggleSidebarLock,
  toggleSidebarVisibility,
  type SidebarChrome,
} from '../../platform/dndbeyond/sidebar-chrome';
import {
  SIDEBAR_ACTIVE_CLASS,
  SIDEBAR_CLOSED_CLASS,
  SIDEBAR_CLUSTER_HIDDEN_CLASS,
  SIDEBAR_COLLAPSED_CLASS,
  SIDEBAR_CONTROLS_LEFT_CLASS,
  SIDEBAR_LEFT_CLASS,
  SIDEBAR_RIGHT_CLASS,
  SIDEBAR_VISIBLE_CLASS,
} from '../../platform/dndbeyond/selectors';

export interface SidebarChromeParts {
  alignLeft: HTMLButtonElement;
  alignRight: HTMLButtonElement;
  controls: HTMLElement;
  dialog: HTMLElement;
  doc: Document;
  fixed: HTMLButtonElement;
  hide: HTMLButtonElement;
  hideIcon: () => SVGElement;
  hideTip: HTMLElement;
  lock: HTMLButtonElement;
  mask: HTMLElement;
  overlay: HTMLButtonElement;
  overlayGroup: HTMLElement;
  pane: HTMLElement;
  placementGroup: HTMLElement;
  showIcon: () => SVGElement;
  unlock: HTMLButtonElement;
  unlockTip: HTMLElement;
  visibility: HTMLElement;
}

export interface SidebarChromeController {
  chrome(): SidebarChrome;
  collapse(): void;
  expand(): void;
  fitViewport(viewportWidth: number): void;
  setOnChromeChange(listener: () => void): void;
}

export function bindSidebarChrome(parts: SidebarChromeParts): SidebarChromeController {
  let chrome: SidebarChrome = {...DEFAULT_SIDEBAR_CHROME};
  let onChange: (() => void) | null = null;

  const commit = (next: SidebarChrome) => {
    chrome = effectiveSidebarChrome(next, viewportWidth());
    paintSidebarChrome(parts, chrome);
    onChange?.();
  };

  parts.hide.addEventListener('click', () => commit(toggleSidebarVisibility(chrome)));
  parts.lock.addEventListener('click', () => commit(toggleSidebarLock(chrome)));
  parts.unlock.addEventListener('click', () => commit(toggleSidebarLock(chrome)));
  parts.overlay.addEventListener('click', () => commit({...chrome, placement: 'overlay'}));
  parts.fixed.addEventListener('click', () => commit({...chrome, placement: 'fixed'}));
  parts.alignLeft.addEventListener('click', () => commit({...chrome, alignment: 'left'}));
  parts.alignRight.addEventListener('click', () => commit({...chrome, alignment: 'right'}));
  paintSidebarChrome(parts, chrome);

  return {
    chrome: () => chrome,
    collapse() {
      if (chrome.visible && !chrome.locked) {
        commit({...chrome, visible: false});
      }
    },
    expand() {
      if (!chrome.visible) {
        commit({...chrome, visible: true});
      }
    },
    fitViewport(viewportWidth: number) {
      const next = effectiveSidebarChrome(chrome, viewportWidth);
      if (next.placement === chrome.placement) {
        return;
      }
      chrome = next;
      paintSidebarChrome(parts, chrome);
    },
    setOnChromeChange(listener: () => void) {
      onChange = listener;
    },
  };

  function viewportWidth(): number {
    return parts.doc.defaultView?.innerWidth ?? 0;
  }
}

export function paintSidebarChrome(parts: SidebarChromeParts, chrome: SidebarChrome): void {
  parts.dialog.classList.toggle(SIDEBAR_RIGHT_CLASS, chrome.alignment === 'right');
  parts.dialog.classList.toggle(SIDEBAR_LEFT_CLASS, chrome.alignment === 'left');
  parts.dialog.classList.toggle(SIDEBAR_VISIBLE_CLASS, chrome.visible);
  parts.dialog.classList.toggle(SIDEBAR_COLLAPSED_CLASS, !chrome.visible);
  parts.mask.classList.toggle(SIDEBAR_VISIBLE_CLASS, chrome.visible);
  parts.controls.classList.toggle(SIDEBAR_CONTROLS_LEFT_CLASS, chrome.alignment === 'left');
  parts.placementGroup.classList.toggle(SIDEBAR_CONTROLS_LEFT_CLASS, chrome.alignment === 'left');

  const collapsed = !chrome.visible;
  parts.lock.hidden = !chrome.locked;
  parts.visibility.hidden = chrome.locked;
  parts.unlock.hidden = collapsed;
  parts.overlayGroup.hidden = chrome.locked || collapsed;
  parts.placementGroup.hidden = chrome.locked || collapsed;
  parts.overlayGroup.classList.toggle(SIDEBAR_CLUSTER_HIDDEN_CLASS, collapsed);
  parts.placementGroup.classList.toggle(SIDEBAR_CLUSTER_HIDDEN_CLASS, collapsed);
  parts.unlockTip.classList.toggle(SIDEBAR_CLUSTER_HIDDEN_CLASS, collapsed);
  parts.hideTip.classList.toggle(SIDEBAR_CLOSED_CLASS, !chrome.visible);

  parts.hide.setAttribute('aria-label', chrome.visible ? 'Hide sidebar' : 'Show sidebar');
  parts.hide.replaceChildren(chrome.visible ? parts.hideIcon() : parts.showIcon());
  parts.pane.style.display = chrome.visible ? 'flex' : 'none';

  markActive(parts.overlay, chrome.placement === 'overlay');
  markActive(parts.fixed, chrome.placement === 'fixed');
  markActive(parts.alignLeft, chrome.alignment === 'left');
  markActive(parts.alignRight, chrome.alignment === 'right');
}

function markActive(button: HTMLButtonElement, active: boolean): void {
  button.classList.toggle(SIDEBAR_ACTIVE_CLASS, active);
}
