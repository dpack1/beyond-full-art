import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {afterEach, describe, expect, it} from 'vitest';

import {classTokenDrift} from '../../src/platform/dndbeyond/sidebar-parity';
import {
  createJournalPanel,
  type PanelHandlers,
  type PanelModel,
} from '../../src/features/character-journal/character-journal-panel';

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
)) as {nodes: SidebarNode[]; omittedControls: string[]};

describe('sidebar parity', () => {
  afterEach(() => {
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

    for (const label of spec.omittedControls) {
      if (view.root.querySelector(`[aria-label="${label}"]`) !== null) {
        misses.push(`rendered ${label}`);
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
    expect(dialog.style.height.endsWith('px')).toBe(true);
    expect(Number.parseFloat(dialog.style.height)).toBeGreaterThanOrEqual(240);
    expect(dialog.contains(controls)).toBe(true);
    expect(controls.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hidden).toBe(true);
    expect(portal.nextElementSibling).toBe(view.root);
  });
});

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
