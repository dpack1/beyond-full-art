import type {Cleanup} from '../../shared/types';

export interface SheetThemeColors {
  background: string;
  border: string;
  mode: 'dark' | 'light';
  muted: string;
  selected: string;
  surface: string;
  text: string;
}

interface RgbColor {
  a: number;
  b: number;
  g: number;
  r: number;
}

const THEME_ATTRIBUTE_NAMES = ['class', 'style', 'data-theme', 'data-appearance'];

export function readSheetTheme(anchor: HTMLElement): SheetThemeColors {
  const sampledBackground = firstOpaqueBackground(anchor)
    ?? {a: 1, b: 255, g: 255, r: 255};
  const mode = explicitTheme(anchor)
    ?? (isDark(sampledBackground) ? 'dark' : 'light');
  const background = (mode === 'dark') === isDark(sampledBackground)
    ? sampledBackground
    : (mode === 'dark'
      ? {a: 1, b: 26, g: 27, r: 28}
      : {a: 1, b: 255, g: 255, r: 255});
  const sampledText = sampledForeground(anchor);
  const text = sampledText !== null && contrasts(sampledText, background)
    ? sampledText
    : (mode === 'dark'
      ? {a: 1, b: 230, g: 239, r: 243}
      : {a: 1, b: 39, g: 37, r: 36});
  const muted = mix(text, background, 0.35);
  const surface = mode === 'dark'
    ? mix(background, {a: 1, b: 255, g: 255, r: 255}, 0.08)
    : mix(background, {a: 1, b: 255, g: 255, r: 255}, 0.72);
  const border = mix(text, background, mode === 'dark' ? 0.62 : 0.72);
  const selected = mode === 'dark'
    ? mix(background, {a: 1, b: 255, g: 255, r: 255}, 0.1)
    : mix(background, {a: 1, b: 241, g: 244, r: 247}, 0.55);

  return {
    background: formatColor(background),
    border: formatColor(border),
    mode,
    muted: formatColor(muted),
    selected: formatColor(selected),
    surface: formatColor(surface),
    text: formatColor(text),
  };
}

export function applySheetTheme(section: HTMLElement, anchor: HTMLElement): void {
  const theme = readSheetTheme(anchor);
  section.dataset.bfaTheme = theme.mode;
  section.style.setProperty('--bfa-journal-background', theme.background);
  section.style.setProperty('--bfa-journal-text', theme.text);
  section.style.setProperty('--bfa-journal-muted', theme.muted);
  section.style.setProperty('--bfa-journal-surface', theme.surface);
  section.style.setProperty('--bfa-journal-border', theme.border);
  section.style.setProperty('--bfa-journal-selected', theme.selected);
  section.style.setProperty('--bfa-journal-line', theme.border);
}

export function observeSheetTheme(
    anchor: HTMLElement,
    onChange: () => void,
): Cleanup {
  const observer = new MutationObserver(onChange);
  const sheet = anchor.closest<HTMLElement>('.ct-character-sheet') ?? anchor;
  observer.observe(sheet, {
    attributeFilter: THEME_ATTRIBUTE_NAMES,
    attributes: true,
  });
  const {body, documentElement} = sheet.ownerDocument;
  for (const element of [documentElement, body]) {
    if (element !== null && element !== sheet) {
      observer.observe(element, {
        attributeFilter: THEME_ATTRIBUTE_NAMES,
        attributes: true,
      });
    }
  }

  return () => {
    observer.disconnect();
  };
}

function explicitTheme(anchor: HTMLElement): 'dark' | 'light' | null {
  let current: HTMLElement | null = anchor;
  while (current !== null) {
    const appearance = current.getAttribute('data-theme')
      ?? current.getAttribute('data-appearance');
    if (appearance === 'dark' || appearance === 'light') {
      return appearance;
    }

    for (const className of current.classList) {
      if (/(?:^|[-_])dark-mode$/i.test(className)) {
        return 'dark';
      }
    }

    current = current.parentElement;
  }

  return null;
}

function firstOpaqueBackground(anchor: HTMLElement): RgbColor | null {
  let current: HTMLElement | null = anchor;
  let depth = 0;
  while (current !== null && depth < 8) {
    const parsed = parseColor(readStyle(current).backgroundColor);
    if (parsed !== null && parsed.a > 0.2) {
      return parsed;
    }

    current = current.parentElement;
    depth += 1;
  }

  return null;
}

function sampledForeground(anchor: HTMLElement): RgbColor | null {
  const sample = anchor.querySelector<HTMLElement>(
      'h1, h2, h3, p, .ddbc-tab-list__nav-item, .ct-character-sheet-tab',
  ) ?? anchor;
  return parseColor(readStyle(sample).color);
}

function contrasts(text: RgbColor, background: RgbColor): boolean {
  return Math.abs(relativeLuminance(text) - relativeLuminance(background)) > 0.25;
}

function isDark(color: RgbColor): boolean {
  return relativeLuminance(color) < 0.4;
}

function relativeLuminance(color: RgbColor): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928
      ? scaled / 12.92
      : ((scaled + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * channel(color.r))
    + (0.7152 * channel(color.g))
    + (0.0722 * channel(color.b));
}

function mix(from: RgbColor, to: RgbColor, amount: number): RgbColor {
  const blend = (start: number, end: number) =>
    Math.round(start + ((end - start) * amount));

  return {
    a: 1,
    b: blend(from.b, to.b),
    g: blend(from.g, to.g),
    r: blend(from.r, to.r),
  };
}

function formatColor(color: RgbColor): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function parseColor(value: string): RgbColor | null {
  const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/
      .exec(value);
  if (match === null) {
    return null;
  }

  return {
    a: match[4] === undefined ? 1 : Number(match[4]),
    b: Number(match[3]),
    g: Number(match[2]),
    r: Number(match[1]),
  };
}

function readStyle(element: HTMLElement): CSSStyleDeclaration {
  return element.ownerDocument.defaultView?.getComputedStyle(element)
    ?? element.style;
}
