import {
  DDB_SELECTORS,
  type DdbSelectorEntry,
} from './selectors';

export interface SelectorHealthFailure {
  readonly detail: string;
  readonly entry: DdbSelectorEntry;
}

export type LiveSheetTheme = 'dark' | 'light' | 'unspecified';

const SELECTOR_MAP_PATH = 'src/platform/dndbeyond/selectors.ts';

export function parseLiveSheetTheme(value: string | undefined): LiveSheetTheme {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'dark' || normalized === 'light') {
    return normalized;
  }
  return 'unspecified';
}

export function selectorsForLiveCharacterSheet(
    theme: LiveSheetTheme,
): readonly DdbSelectorEntry[] {
  return DDB_SELECTORS.filter((entry) => {
    if (entry.darkThemeOnly) {
      return theme === 'dark';
    }
    return entry.liveSheet;
  });
}

export function darkThemeSelectors(): readonly DdbSelectorEntry[] {
  return DDB_SELECTORS.filter((entry) => entry.darkThemeOnly);
}

export function formatSelectorHealthFailure(
    failure: SelectorHealthFailure,
): string {
  return [
    `Selector "${failure.entry.id}" failed.`,
    `Selector: ${failure.entry.selector}`,
    `Breaks: ${failure.entry.features.join(', ')}`,
    `Targeted: ${failure.entry.targets}`,
    `Look for: ${failure.entry.lookFor}`,
    `Fix: update that one entry in ${SELECTOR_MAP_PATH}. A renamed class is usually the whole fix.`,
    failure.detail,
  ].join('\n');
}

export function findSelectorHealthFailures(
    root: ParentNode,
    entries: readonly DdbSelectorEntry[],
    checked: string,
): SelectorHealthFailure[] {
  const failures: SelectorHealthFailure[] = [];
  for (const entry of entries) {
    const match = matchEntry(root, entry);
    if (match.ok) {
      continue;
    }
    failures.push({
      detail: `Checked ${checked}. ${match.detail}`,
      entry,
    });
  }
  return failures;
}

export function findSelectorsThatShouldBeAbsent(
    root: ParentNode,
    entries: readonly DdbSelectorEntry[],
    checked: string,
): SelectorHealthFailure[] {
  const failures: SelectorHealthFailure[] = [];
  for (const entry of entries) {
    const match = matchEntry(root, entry);
    if (!match.ok) {
      continue;
    }
    failures.push({
      detail: `Checked ${checked}. The selector matched, and it should be absent for this check.`,
      entry,
    });
  }
  return failures;
}

function matchEntry(
    root: ParentNode,
    entry: DdbSelectorEntry,
): {ok: true} | {ok: false; detail: string} {
  let nodes: Element[];
  try {
    nodes = [...root.querySelectorAll(entry.selector)];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return {
      detail: `The selector string is not valid CSS (${message}).`,
      ok: false,
    };
  }

  const expectedTexts = textsToFind(entry);
  if (expectedTexts === null) {
    if (nodes.length > 0) {
      return {ok: true};
    }
    return {detail: 'No element matched.', ok: false};
  }

  const missing = expectedTexts.filter((expected) =>
    !nodes.some((node) => normalizeText(node.textContent ?? '') === expected),
  );
  if (missing.length === 0) {
    return {ok: true};
  }
  const quoted = missing.map((text) => `"${text}"`).join(', ');
  return {
    detail: `No matching element had the text ${quoted}.`,
    ok: false,
  };
}

function textsToFind(entry: DdbSelectorEntry): readonly string[] | null {
  if (entry.matchTexts !== undefined) {
    return entry.matchTexts.map((text) => normalizeText(text));
  }
  if (entry.matchText !== undefined) {
    return [normalizeText(entry.matchText)];
  }
  return null;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
