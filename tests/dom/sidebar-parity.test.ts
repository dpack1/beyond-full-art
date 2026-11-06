import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {afterEach, describe, expect, it} from 'vitest';

import {
  createJournalPanel,
  type PanelHandlers,
  type PanelModel,
} from '../../src/features/character-journal/character-journal-panel';
import {concealNativeSidebarControls} from '../../src/features/character-journal/character-journal-sidebar-place';
import {classTokenDrift} from '../../src/platform/dndbeyond/sidebar-parity';
import {
  SIDEBAR_ACTIVE_CLASS,
  SIDEBAR_CONTROLS_CLASS,
  SIDEBAR_VISIBILITY_CLASS,
  CHARACTER_SHEET_CLASS,
  CHARACTER_SHEET_INNER_CLASS,
} from '../../src/platform/dndbeyond/selectors';

interface SidebarNode {
  className: string;
  match: string;
  role: string;
  svgPath?: string;
}

const spec = JSON.parse(readFileSync(
    path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../docs/ddb-reference/sidebar.json',
    ),
    'utf8',
)) as {
  activeControls: string[];
  chromeControls: string[];
  nodes: SidebarNode[];
};

describe('sidebar parity', () => {
  afterEach(() => {
    concealNativeSidebarControls(document, document.body, false);
    document.body.innerHTML = '';
  });

  it('matches the recorded Information Sidebar class tree', () => {
    const view = createJournalPanel(document, handlers(), () => null, () => []);
    document.body.append(view.root);
    view.render(model());

    const misses: string[] = [];
    for (const node of spec.nodes) {
      const element = view.root.matches(node.match)
        ? view.root
        : view.root.querySelector(node.match);
      if (element === null) {
        misses.push(`${node.role} missing ${node.match}`);
        continue;
      }
      misses.push(...classTokenDrift(
          node.role,
          node.className,
          element.getAttribute('class') ?? '',
      )
          .map((drift) => `${drift.role} class missing ${drift.expected}`));
      if (node.svgPath !== undefined) {
        const pathValue = element.querySelector('path')?.getAttribute('d') ?? '';
        if (pathValue !== node.svgPath) {
          misses.push(`${node.role} svg path drifted`);
        }
      }
    }

    const hide = view.root.querySelector('[aria-label="Hide sidebar"]');
    if (!(hide instanceof HTMLButtonElement) || hide.getAttribute('aria-disabled') === 'true') {
      misses.push('hide control drifted');
    }

    for (const label of spec.chromeControls) {
      const button = view.root.querySelector(`[aria-label="${label}"]`);
      if (!(button instanceof HTMLButtonElement)) {
        misses.push(`missing ${label}`);
        continue;
      }
      if (
        button.getAttribute('aria-disabled') === 'true'
        || button.tabIndex === -1
        || button.getAttribute('aria-hidden') === 'true'
      ) {
        misses.push(`${label} is not operable`);
      }
      const active = spec.activeControls.includes(label);
      if (button.classList.contains(SIDEBAR_ACTIVE_CLASS) !== active) {
        misses.push(`${label} active state drifted`);
      }
    }

    expect(misses).toEqual([]);
    expect(view.root.querySelector('[aria-label="Prev"]')).not.toBeNull();
    expect(view.root.querySelector('[aria-label="Next"]')).not.toBeNull();
  });

  it('docks the note on the right and closes an open native sidebar', () => {
    const portal = document.createElement('div');
    portal.className = 'ct-sidebar__portal';
    const sidebar = document.createElement('div');
    sidebar.className = 'ct-sidebar';
    sidebar.getBoundingClientRect = () => rect(124, 340, 900);
    const hide = document.createElement('button');
    hide.type = 'button';
    hide.setAttribute('aria-label', 'Hide sidebar');
    let hidden = false;
    hide.addEventListener('click', () => {
      hidden = true;
    });
    sidebar.append(hide);
    portal.append(sidebar);
    document.body.append(portal);

    const view = createJournalPanel(document, handlers(), () => null, () => []);
    document.body.append(view.root);
    view.render(model());

    const dialog = view.root.querySelector('[role="dialog"]');
    const controls = view.root.querySelector('[data-bfa-journal-native-chrome="true"]');
    const pane = view.root.querySelector('.styles_pane__AOt0h');
    expect(dialog).toBeInstanceOf(HTMLElement);
    if (!(dialog instanceof HTMLElement) || !(controls instanceof HTMLElement) || !(pane instanceof HTMLElement)) {
      return;
    }
    expect(dialog.style.position).toBe('fixed');
    expect(dialog.style.right).toBe('0px');
    expect(dialog.style.width).toBe('min(400px, calc(100vw - 36px))');
    expect(dialog.style.zIndex).toBe('10001');
    expect(dialog.style.top).toBe('124px');
    expect(view.root.dataset.bfaJournalSlide).toBe('in');
    expect(view.root.dataset.bfaJournalAlign).toBe('right');
    expect(dialog.style.height.endsWith('px')).toBe(true);
    expect(Number.parseFloat(dialog.style.height)).toBeGreaterThanOrEqual(240);
    expect(dialog.contains(controls)).toBe(true);
    expect(controls.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hidden).toBe(true);
    expect(portal.nextElementSibling).toBe(view.root);
  });

  it('hides the sheet edge bar while the note is open', async () => {
    const portal = document.createElement('div');
    portal.className = 'ct-sidebar__portal';
    const sidebar = document.createElement('div');
    sidebar.className = 'ct-sidebar';
    const nativeControls = document.createElement('div');
    nativeControls.className = SIDEBAR_CONTROLS_CLASS;
    nativeControls.style.display = 'flex';
    sidebar.append(nativeControls);
    portal.append(sidebar);
    document.body.append(portal);

    let closes = 0;
    const view = createJournalPanel(document, {
      ...handlers(),
      onClose: () => {
        closes += 1;
      },
    }, () => null, () => []);
    document.body.append(view.root);
    view.render(model());

    const ours = view.root.querySelector(`.${SIDEBAR_CONTROLS_CLASS}`);
    expect(ours).toBeInstanceOf(HTMLElement);
    if (ours instanceof HTMLElement) {
      expect(ours.style.display).toBe('flex');
    }
    expect(nativeControls.style.display).toBe('none');
    expect(nativeControls.dataset.bfaJournalConcealed).toBe('true');
    view.root.querySelector('[aria-label="Set to overlay position"]')
        ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(closes).toBe(0);

    nativeControls.style.display = 'flex';
    await flushMutations();
    expect(nativeControls.style.display).toBe('none');

    const replacement = document.createElement('div');
    replacement.className = SIDEBAR_CONTROLS_CLASS;
    replacement.style.display = 'flex';
    nativeControls.replaceWith(replacement);
    await flushMutations();
    expect(replacement.style.display).toBe('none');
    expect(replacement.dataset.bfaJournalConcealed).toBe('true');

    concealNativeSidebarControls(document, view.root, false);
    expect(replacement.style.display).toBe('flex');
    expect(replacement.dataset.bfaJournalConcealed).toBeUndefined();
    replacement.style.display = 'block';
    await flushMutations();
    expect(replacement.style.display).toBe('block');
  });

  it('docks, locks, collapses, and shifts the sheet like the sidebar', () => {
    const sheet = document.createElement('div');
    sheet.className = CHARACTER_SHEET_CLASS;
    sheet.style.transform = 'scale(1)';
    sheet.getBoundingClientRect = () => rect(0, 1200, 800);
    document.body.append(sheet);
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1800});

    try {
      const view = createJournalPanel(document, handlers(), () => null, () => []);
      document.body.append(view.root);
      view.render(model());
      const dialog = view.root.querySelector('[role="dialog"]');
      const pane = view.root.querySelector('.styles_pane__AOt0h');
      expect(dialog).toBeInstanceOf(HTMLElement);
      expect(pane).toBeInstanceOf(HTMLElement);
      if (!(dialog instanceof HTMLElement) || !(pane instanceof HTMLElement)) {
        return;
      }

      expect(dialog.style.right).toBe('0px');
      expect(sheet.style.transform).toBe('scale(1)');

      clickLabel('Set to fixed position');
      expect(sheet.style.transform).toBe('translateX(-170px)');
      expect(dialog.style.right).toBe('55px');

      clickLabel('Align Left');
      expect(sheet.style.transform).toBe('translateX(170px)');
      expect(dialog.style.left).toBe('55px');
      expect(dialog.style.right).toBe('auto');

      clickLabel('Hide sidebar');
      expect(sheet.style.transform).toBe('scale(1)');
      expect(view.root.querySelector('[aria-label="Show sidebar"]')).toBeInstanceOf(HTMLButtonElement);
      expect(pane.style.display).toBe('none');
      expect(dialog.style.width).toBe('1.5625rem');
      expect(dialog.style.left).toBe('0px');
      expect(view.root.dataset.bfaJournalSlide).toBeUndefined();
      expect(view.root.hidden).toBe(false);

      clickLabel('Show sidebar');
      expect(view.root.querySelector('[aria-label="Hide sidebar"]')).toBeInstanceOf(HTMLButtonElement);
      expect(pane.style.display).toBe('flex');
      expect(sheet.style.transform).toBe('translateX(170px)');

      clickLabel('Unlocked');
      const visibility = view.root.querySelector(`.${SIDEBAR_VISIBILITY_CLASS}`);
      expect(visibility).toBeInstanceOf(HTMLElement);
      if (visibility instanceof HTMLElement) {
        expect(visibility.hidden).toBe(true);
      }
      clickLabel('Locked');
      if (visibility instanceof HTMLElement) {
        expect(visibility.hidden).toBe(false);
      }
    } finally {
      Object.defineProperty(window, 'innerWidth', {configurable: true, value: previousWidth});
    }
  });

  it('docks an open note against the sheet column', () => {
    const sheet = document.createElement('div');
    sheet.className = CHARACTER_SHEET_INNER_CLASS;
    sheet.getBoundingClientRect = () => rect(180, 1200, 900);
    document.body.append(sheet);
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 2400});

    try {
      const view = createJournalPanel(document, handlers(), () => null, () => []);
      document.body.append(view.root);
      view.render(model());
      const dialog = view.root.querySelector('[role="dialog"]');
      expect(dialog).toBeInstanceOf(HTMLElement);
      if (!(dialog instanceof HTMLElement)) {
        return;
      }

      expect(dialog.style.top).toBe('180px');
      expect(dialog.style.right).toBe('185px');
      expect(dialog.style.left).toBe('auto');
      expect(view.root.dataset.bfaJournalSlide).toBe('in');
      expect(view.root.dataset.bfaJournalAlign).toBe('right');
    } finally {
      Object.defineProperty(window, 'innerWidth', {configurable: true, value: previousWidth});
    }
  });

  it('nudges the sheet column and leaves the artwork in place', async () => {
    const artwork = document.createElement('div');
    artwork.className = CHARACTER_SHEET_CLASS;
    artwork.style.transform = 'none';
    const column = document.createElement('div');
    column.className = CHARACTER_SHEET_INNER_CLASS;
    column.style.transform = 'translateX(0px)';
    column.getBoundingClientRect = () => rect(0, 1200, 800);
    artwork.append(column);
    document.body.append(artwork);
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1800});

    try {
      const view = createJournalPanel(document, handlers(), () => null, () => []);
      document.body.append(view.root);
      view.render(model());

      clickLabel('Set to fixed position');
      expect(column.style.transform).toBe('translateX(-170px)');
      expect(artwork.style.transform).toBe('none');

      column.style.transform = 'translateX(0px)';
      await flushMutations();
      expect(column.style.transform).toBe('translateX(-170px)');
      expect(artwork.style.transform).toBe('none');

      clickLabel('Set to overlay position');
      expect(column.style.transform).toBe('translateX(0px)');
      expect(artwork.style.transform).toBe('none');
    } finally {
      Object.defineProperty(window, 'innerWidth', {configurable: true, value: previousWidth});
    }
  });
});

function clickLabel(label: string): void {
  document.querySelector(`[aria-label="${label}"]`)
      ?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
}

function flushMutations(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function rect(top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 1100,
    right: 1100 + width,
    top,
    width,
    x: 1100,
    y: top,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

function model(): PanelModel {
  return {
    back: true,
    body: 'A gate.',
    confirm: null,
    entryId: 'gate',
    error: null,
    imageError: null,
    images: [],
    mentions: [],
    mismatch: false,
    mode: 'read',
    needsDetails: false,
    next: false,
    picker: null,
    pickerTitle: null,
    stale: false,
    status: null,
    title: 'Gate',
    type: 'place',
    typeLabel: 'Place',
  };
}

function handlers(): PanelHandlers {
  return {
    onBack: () => undefined,
    onCheckbox: () => undefined,
    onClose: () => undefined,
    onConfirm: () => undefined,
    onDelete: () => undefined,
    onEdit: () => undefined,
    onImages: () => undefined,
    onInput: () => undefined,
    onLibraryPick: () => undefined,
    onKeepBoth: () => undefined,
    onMention: () => undefined,
    onNext: () => undefined,
    onPick: () => undefined,
    onReload: () => undefined,
    onStaleSave: () => undefined,
    onRemoveImage: () => undefined,
    onType: () => undefined,
    onViewImage: () => undefined,
    onWiki: () => undefined,
    resolveWiki: () => 'missing',
  };
}
