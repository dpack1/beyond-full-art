import {
  CHARACTER_SHEET_DARK_MODE_CLASS,
  CHARACTER_SHEET_SELECTOR,
  NATIVE_BUTTON_CLASS_PATTERN,
  PRIMARY_BOX_SELECTOR,
  SHEET_TAB_NAV_ITEM_ACTIVE_SELECTOR,
  SHEET_TAB_NAV_ITEM_SELECTOR,
} from '../../platform/dndbeyond/selectors';
import {
  JOURNAL_FALLBACK_TOKENS,
  colorsContrast,
  readSheetTheme,
} from './character-journal-theme';

export interface SheetControlPaint {
  buttonClass: string;
  fontFamily: string;
  inputClass: string;
  mode: 'dark' | 'light';
}

const TOKEN_NAMES = [
  ['--bfa-journal-accent', 'accent'],
  ['--bfa-journal-accent-edge', 'accentEdge'],
  ['--bfa-journal-background', 'background'],
  ['--bfa-journal-border', 'border'],
  ['--bfa-journal-danger', 'danger'],
  ['--bfa-journal-focus', 'focus'],
  ['--bfa-journal-line', 'line'],
  ['--bfa-journal-link', 'link'],
  ['--bfa-journal-muted', 'muted'],
  ['--bfa-journal-needs', 'needs'],
  ['--bfa-journal-needs-bg', 'needsBackground'],
  ['--bfa-journal-selected', 'selected'],
  ['--bfa-journal-success', 'success'],
  ['--bfa-journal-sunken', 'sunken'],
  ['--bfa-journal-surface', 'surface'],
  ['--bfa-journal-text', 'text'],
] as const;

export function paintJournalSurface(
    root: HTMLElement,
    anchor: HTMLElement,
): SheetControlPaint {
  const theme = readSheetTheme(anchor);
  const fallback = JOURNAL_FALLBACK_TOKENS[theme.mode];
  const sheet = anchor.closest<HTMLElement>(CHARACTER_SHEET_SELECTOR) ?? anchor;
  const style = readStyle(sheet);
  const background = opaque(style.backgroundColor) ?? fallback.background;
  const textSample = firstContrasting(
      [
        readStyle(sheet).color,
        sampledColor(sheet, `${SHEET_TAB_NAV_ITEM_SELECTOR}, h1, h2, p`),
      ],
      background,
      fallback.text,
  );
  const active = activeTab(sheet);
  const activeStyle = active === null ? null : readStyle(active);
  const themeColor = sampleThemeColor(sheet) ?? fallback.accent;
  const field = fieldSample(sheet);
  const fieldStyle = field === null ? null : readStyle(field);
  const sampledSurface = fieldStyle === null ? null : opaque(fieldStyle.backgroundColor);
  const surface = sampledSurface !== null && surfaceMatchesTheme(sampledSurface, theme.mode)
    ? sampledSurface
    : fallback.surface;

  root.dataset.bfaTheme = theme.mode;
  root.classList.toggle(CHARACTER_SHEET_DARK_MODE_CLASS, theme.mode === 'dark');
  root.style.colorScheme = theme.mode;
  const tokens: Record<(typeof TOKEN_NAMES)[number][1], string> = {
    ...fallback,
    accent: themeColor,
    accentEdge: themeColor,
    background,
    border: themeColor,
    selected: themeColor,
    surface,
    text: textSample,
  };
  for (const [cssName, key] of TOKEN_NAMES) {
    root.style.setProperty(cssName, tokens[key]);
  }

  root.style.setProperty(
      '--bfa-journal-font',
      style.fontFamily || 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
  );
  if (activeStyle !== null) {
    root.style.setProperty('--bfa-journal-label-font', activeStyle.fontFamily);
  }
  root.style.setProperty('--bfa-journal-panel-width', '340px');
  root.style.setProperty(
      '--bfa-journal-field-radius',
      fieldStyle !== null && fieldStyle.borderRadius !== ''
        ? fieldStyle.borderRadius
        : '4px',
  );

  return {
    buttonClass: neutralButtonClass(sheet),
    fontFamily: style.fontFamily,
    inputClass: copiedClassName(field),
    mode: theme.mode,
  };
}

export function applyCopiedControlClasses(
    root: HTMLElement,
    paint: SheetControlPaint,
): void {
  replaceMarkedClass(root, 'input, textarea', 'data-bfa-journal-input-class', paint.inputClass);
  replaceMarkedClass(root, 'button', 'data-bfa-journal-button-class', paint.buttonClass);
}

function replaceMarkedClass(
    root: HTMLElement,
    selector: string,
    attribute: string,
    className: string,
): void {
  const next = className.split(/\s+/).filter((name) => name !== '' && !/hidden/i.test(name));
  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    const previous = element.getAttribute(attribute)?.split(/\s+/) ?? [];
    for (const name of previous) {
      if (!next.includes(name)) {
        element.classList.remove(name);
      }
    }

    for (const name of next) {
      element.classList.add(name);
    }

    if (next.length === 0) {
      element.removeAttribute(attribute);
    } else {
      element.setAttribute(attribute, next.join(' '));
    }
  }
}

function fieldSelector(): string {
  const roots = CHARACTER_SHEET_SELECTOR.split(',').map((part) => part.trim());
  const sheetFields = roots.flatMap((root) => [`${root} input`, `${root} textarea`]);
  return [
    ...sheetFields,
    `${PRIMARY_BOX_SELECTOR} input`,
    `${PRIMARY_BOX_SELECTOR} textarea`,
  ].join(', ');
}

function fieldSample(sheet: HTMLElement): HTMLElement | null {
  const fields = sheet.ownerDocument.querySelectorAll<HTMLElement>(fieldSelector());
  for (const field of fields) {
    if (field.closest('.bfa-character-journal-section, .bfa-journal-panel') !== null) {
      continue;
    }

    return field;
  }

  return null;
}

function copiedClassName(field: HTMLElement | null): string {
  if (field === null) {
    return '';
  }

  return [...field.classList].filter((name) => !/hidden/i.test(name)).join(' ');
}

function surfaceMatchesTheme(color: string, mode: 'dark' | 'light'): boolean {
  const luminance = colorLuminance(color);
  if (luminance === null) {
    return false;
  }

  // A white browser input on Underdark is not the sheet's field. Matilda's
  // dark fields stay dark, and her light fields stay light.
  return mode === 'dark' ? luminance < 0.45 : luminance > 0.45;
}

function colorLuminance(color: string): number | null {
  const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color)
    ?? /^#([\da-f]{6})$/i.exec(color);
  if (match === null) {
    return null;
  }

  const channels = match[1]?.length === 6
    ? [
      Number.parseInt(match[1].slice(0, 2), 16),
      Number.parseInt(match[1].slice(2, 4), 16),
      Number.parseInt(match[1].slice(4, 6), 16),
    ]
    : [Number(match[1]), Number(match[2]), Number(match[3])];
  const [red, green, blue] = channels;
  if (red === undefined || green === undefined || blue === undefined) {
    return null;
  }

  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * channel(red)) + (0.7152 * channel(green)) + (0.0722 * channel(blue));
}

function neutralButtonClass(sheet: HTMLElement): string {
  const buttons = sheet.querySelectorAll<HTMLButtonElement>('button');
  for (const button of buttons) {
    if (/heal|damage|tabButton|navigation/i.test(button.className)) {
      continue;
    }

    if (NATIVE_BUTTON_CLASS_PATTERN.test(button.className)) {
      return button.className;
    }
  }

  return '';
}

function activeTab(sheet: HTMLElement): HTMLElement | null {
  return sheet.querySelector<HTMLElement>(
      `[aria-selected="true"], ${SHEET_TAB_NAV_ITEM_ACTIVE_SELECTOR}`,
  );
}

function sampleThemeColor(sheet: HTMLElement): string | null {
  const candidates: HTMLElement[] = [];
  const active = activeTab(sheet);
  if (active !== null) {
    candidates.push(active);
  }
  candidates.push(...sheet.querySelectorAll<HTMLElement>(PRIMARY_BOX_SELECTOR));
  for (const element of candidates) {
    if (element.closest('.bfa-character-journal-section, .bfa-journal-panel') !== null) {
      continue;
    }
    const color = accentFromStyle(readStyle(element));
    if (color !== null) {
      return color;
    }
  }
  return null;
}

function accentFromStyle(style: CSSStyleDeclaration): string | null {
  const underline = underlineColor(style);
  if (underline !== null && isChromatic(underline)) {
    return underline;
  }
  const shadow = firstColor(style.boxShadow);
  if (shadow !== null && isChromatic(shadow)) {
    return shadow;
  }
  const edges: Array<[string, string]> = [
    [style.borderTopWidth, style.borderTopColor],
    [style.borderRightWidth, style.borderRightColor],
    [style.borderBottomWidth, style.borderBottomColor],
    [style.borderLeftWidth, style.borderLeftColor],
  ];
  for (const [width, color] of edges) {
    const size = Number.parseFloat(width);
    if (Number.isFinite(size) && size >= 1 && isChromatic(color)) {
      return opaque(color);
    }
  }
  return null;
}

function firstColor(value: string): string | null {
  return /rgba?\([^)]+\)/.exec(value)?.[0] ?? null;
}

function isChromatic(color: string): boolean {
  const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  if (match === null) {
    return false;
  }
  const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  return max - min > 28 && max > 70;
}

function underlineColor(style: CSSStyleDeclaration): string | null {
  const width = Number.parseFloat(style.borderBottomWidth);
  if (!Number.isFinite(width) || width < 2 || style.borderBottomStyle === 'none') {
    return null;
  }

  return opaque(style.borderBottomColor);
}

function sampledColor(sheet: HTMLElement, selector: string): string {
  const sample = sheet.querySelector<HTMLElement>(selector);
  return sample === null ? '' : readStyle(sample).color;
}

function firstContrasting(
    candidates: readonly string[],
    background: string,
    fallback: string,
): string {
  for (const candidate of candidates) {
    if (candidate !== '' && colorsContrast(candidate, background)) {
      return candidate;
    }
  }

  return fallback;
}

function opaque(color: string): string | null {
  if (color === '' || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
    return null;
  }

  return color;
}

function readStyle(element: HTMLElement): CSSStyleDeclaration {
  return element.ownerDocument.defaultView?.getComputedStyle(element)
    ?? element.style;
}
