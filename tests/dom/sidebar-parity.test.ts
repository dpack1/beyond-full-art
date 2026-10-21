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
});

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
    onImage: () => undefined,
    onInput: () => undefined,
    onMention: () => undefined,
    onNext: () => undefined,
    onPick: () => undefined,
    onReload: () => undefined,
    onRemoveImage: () => undefined,
    onType: () => undefined,
    onViewImage: () => undefined,
    onWiki: () => undefined,
    resolveWiki: () => 'missing',
  };
}
