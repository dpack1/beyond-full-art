import {describe, expect, it} from 'vitest';

import {applyJournalFormat} from '../../src/features/character-journal/character-journal-format';
import {
  journalTagNames,
  mentionCounts,
  resolveWikiTitle,
  rewriteUniqueTitle,
  wikiLinkNames,
} from '../../src/features/character-journal/character-journal-links';
import {
  journalMigrationConfirmed,
  mapJournalV1Entry,
  planJournalMigration,
} from '../../src/features/character-journal/character-journal-migrate';
import {
  journalPlainText,
  patchTaskCheckbox,
  previewJournalText,
  renderJournalMarkdown,
} from '../../src/features/character-journal/character-journal-markdown';
import {
  journalEmptyLabel,
  visibleJournalNotes,
} from '../../src/features/character-journal/character-journal-query';
import {planQuickNote} from '../../src/features/character-journal/character-journal-quick-note';
import {
  mergeJournalRecord,
} from '../../src/features/character-journal/character-journal-records';
import {starterJournalBody} from '../../src/features/character-journal/character-journal-templates';
import {
  isJournalNote,
  type CharacterJournalEntry,
  type JournalNote,
} from '../../src/features/character-journal/character-journal-types';

describe('journal version 2 model', () => {
  it('accepts a full note and rejects a bad blob key, character id, and type', () => {
    const full = note({
      featuredImageId: 'photo-1',
      images: [{
        altText: 'door.png',
        blobKey: 'bfa.journal.image.photo-1',
        byteSize: 12,
        fileName: 'door.png',
        height: 8,
        id: 'photo-1',
        mimeType: 'image/png',
        width: 8,
      }],
    });
    expect(isJournalNote(full)).toBe(true);
    expect(isJournalNote({
      ...full,
      images: [{...full.images[0], blobKey: 'character-art-blob'}],
    })).toBe(false);
    expect(isJournalNote({...note(), characterId: 169418374})).toBe(false);
    expect(isJournalNote({...note(), type: 'monster'})).toBe(false);
  });

  it('maps a text-plus-photo entry once and confirms blob keys', () => {
    const source = v1Entry();
    const broken = {id: 'broken', title: 'Missing blocks'};
    const plan = planJournalMigration([source, broken, note()]);
    expect(plan.hasVersion1).toBe(true);
    expect(plan.nextRecords[1]).toEqual(broken);
    expect(plan.nextRecords[2]).toMatchObject({schemaVersion: 2, id: 'note-1'});

    const mapped = mapJournalV1Entry(source);
    expect(mapped).toMatchObject({
      body: 'The door was warm.\n\n![door.png](bfa-journal-image:photo-1)',
      featuredImageId: 'photo-1',
      needsDetails: false,
      type: 'unset',
    });
    expect(mapped.images[0]?.blobKey).toBe('bfa.journal.image.photo-1');
    expect(journalMigrationConfirmed(plan.readable, plan.nextRecords)).toBe(true);
    expect(journalMigrationConfirmed(plan.readable, [broken])).toBe(false);
    expect(planJournalMigration(plan.nextRecords).hasVersion1).toBe(false);
  });

  it('parses tags and links without treating headings, code, or a bracketed name as structure', () => {
    const body = [
      '# Heading #not-a-tag',
      'Meet #quest and [[Voss]].',
      'Use `#hidden` in code.',
      '```',
      '#secret [[Hidden]]',
      '```',
      '[[Na]me]] stays text.',
    ].join('\n');

    expect(journalTagNames(body)).toEqual(['quest']);
    expect(wikiLinkNames(body)).toEqual(['Voss']);
    expect(journalPlainText(body)).not.toContain('#quest');
    expect(journalPlainText(body)).toContain('quest');
    expect(journalPlainText(body)).toContain('Voss');
  });

  it('resolves unique, missing, and duplicate titles and rewrites only a unique token', () => {
    const voss = note({id: 'voss', title: 'Voss'});
    const other = note({id: 'other', title: 'Other', body: 'Asked [[Voss]] twice. [[Voss]]'});
    const twinA = note({id: 'a', title: 'Marcus'});
    const twinB = note({id: 'b', title: 'Marcus', body: '[[Marcus]]'});
    expect(resolveWikiTitle('voss', [voss, other]).kind).toBe('one');
    expect(resolveWikiTitle('Missing', [voss]).kind).toBe('missing');
    expect(resolveWikiTitle('Marcus', [twinA, twinB]).kind).toBe('many');
    expect(mentionCounts([voss, other]).get('voss')).toBe(1);

    const rewritten = rewriteUniqueTitle(
        [voss, other],
        'Voss',
        'Voss the Smith',
        'voss',
    );
    expect(rewritten[1]?.body).toBe('Asked [[Voss the Smith]] twice. [[Voss the Smith]]');
    expect(rewriteUniqueTitle([twinA, twinB], 'Marcus', 'Marcus Vale', 'a')[1]?.body)
        .toBe('[[Marcus]]');
  });

  it('keeps an accented search match and cuts preview on grapheme clusters', () => {
    const cafe = note({
      id: 'cafe',
      title: 'Café',
      body: `${'a'.repeat(86)}🎲 and more ${'b'.repeat(40)}`,
    });
    expect(visibleJournalNotes([cafe], 'all', 'café').map((entry) => entry.id))
        .toEqual(['cafe']);
    expect(journalEmptyLabel('quest', '')).toBe('No quests');
    expect(journalEmptyLabel('all', 'nope')).toBe('No matches');

    const preview = previewJournalText(`${'a'.repeat(86)}🎲`);
    expect(preview.endsWith('🎲')).toBe(true);
    expect(preview).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    const cut = previewJournalText(`${'a'.repeat(86)}🎲${'b'.repeat(20)}`);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it('renders the sanitizer corpus as text nodes and safe elements', () => {
    const root = renderJournalMarkdown([
      '<img src=x onerror="alert(1)">',
      '<svg><script>alert(1)</script></svg>',
      '[click](javascript:alert(1))',
      '![remote](https://example.com/a.png)',
      '![blob](blob:https://dndbeyond.com/uuid)',
      '![door](bfa-journal-image:photo-1)',
      'See [[Voss]] and [site](https://example.com).',
    ].join('\n\n'), {
      document,
      imageUrl: (id) => id === 'photo-1' ? 'blob:local' : null,
      images: [{id: 'photo-1'}],
      resolveWiki: () => 'one',
    });

    expect(root.querySelector('img[onerror]')).toBeNull();
    expect(root.querySelector('script, svg, iframe')).toBeNull();
    expect(root.querySelector('[onerror]')).toBeNull();
    expect(root.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(root.textContent).toContain('Image not loaded');
    expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:local');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('https://example.com/');
    expect(root.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(root.querySelector('.bfa-journal-wikilink')?.textContent).toBe('Voss');
    expect(root.querySelector('.bfa-journal-wikilink')?.tagName).toBe('BUTTON');
  });

  it('renders a nested list and its nested task', () => {
    const root = renderJournalMarkdown(
        '- outer\n  - inner\n    - [ ] nested task\n',
        {
          document,
          imageUrl: () => null,
          images: [],
          resolveWiki: () => 'missing',
        },
    );

    expect(root.querySelectorAll('ul')).toHaveLength(3);
    expect(root.textContent).toContain('outer');
    expect(root.textContent).toContain('inner');
    expect(root.textContent).toContain('nested task');
    expect(root.querySelectorAll('input.bfa-journal-task')).toHaveLength(1);
    expect(root.querySelector('input.bfa-journal-task')?.parentElement?.textContent)
        .toContain('nested task');
  });

  it('patches one checkbox and leaves the surrounding markdown', () => {
    const body = '## Loot\n\n- [ ] Rope\n- [x] Map\n\nDone.';
    expect(patchTaskCheckbox(body, 0, true)).toBe('## Loot\n\n- [x] Rope\n- [x] Map\n\nDone.');
    expect(patchTaskCheckbox(body, 3, true)).toBeNull();
    expect(starterJournalBody('npc')).toContain('## Who they are to me');
    expect(applyJournalFormat('Hello', 0, 5, 'bold').value).toBe('**Hello**');
  });

  it('files a quick note onto the newest session for today', () => {
    const now = new Date(2026, 9, 20, 20, 17, 0);
    const older = note({
      id: 'older',
      sessionDate: '2026-10-20',
      type: 'session',
      updatedAt: '2026-10-20T12:00:00.000Z',
    });
    const newer = note({
      id: 'newer',
      body: 'Already here.',
      sessionDate: '2026-10-20',
      type: 'session',
      updatedAt: '2026-10-20T18:00:00.000Z',
    });
    const filed = planQuickNote(
        [older, newer],
        'Bought a map from [[Voss]]',
        now,
        () => 'new',
        '169418374',
    );
    expect(filed.id).toBe('newer');
    expect(filed.body).toBe('Already here.\n- 20:17 Bought a map from [[Voss]]');

    const created = planQuickNote([], 'First line', now, () => 'created', '169418374');
    expect(created.type).toBe('session');
    expect(created.sessionDate).toBe('2026-10-20');
    expect(created.title.startsWith('Session · ')).toBe(true);
    expect(created.body).toBe('- 20:17 First line');
  });

  it('refuses a stale write and keeps a different entry', () => {
    const older = note({updatedAt: '2026-10-12T00:00:00.000Z'});
    const newer = note({updatedAt: '2026-10-13T00:00:00.000Z', body: 'Newer'});
    const other = note({id: 'other'});
    const merged = mergeJournalRecord([other, newer], older);
    expect(merged[1]).toMatchObject({body: 'Newer'});
    expect(mergeJournalRecord([other], older).map((record) =>
      typeof record === 'object' && record !== null && 'id' in record
        ? record.id
        : '',
    )).toEqual(['other', 'note-1']);
  });
});

function note(overrides: Partial<JournalNote> = {}): JournalNote {
  return {
    body: 'A note about the café.',
    characterId: '169418374',
    createdAt: '2026-10-12T00:00:00.000Z',
    featuredImageId: null,
    id: 'note-1',
    images: [],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate: null,
    title: 'Old Gate',
    type: 'place',
    updatedAt: '2026-10-12T00:00:00.000Z',
    ...overrides,
  };
}

function v1Entry(): CharacterJournalEntry {
  return {
    blocks: [
      {id: 'text-1', text: 'The door was warm.', type: 'text'},
      {
        blobKey: 'bfa.journal.image.photo-1',
        byteSize: 12,
        fileName: 'door.png',
        height: 8,
        id: 'photo-1',
        mimeType: 'image/png',
        type: 'image',
        width: 8,
      },
    ],
    characterId: '169418374',
    createdAt: '2026-10-12T00:00:00.000Z',
    id: 'entry-1',
    schemaVersion: 1,
    title: 'Door',
    updatedAt: '2026-10-12T00:00:00.000Z',
  };
}
