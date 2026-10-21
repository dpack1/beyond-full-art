export interface SidebarDrift {
  actual: string;
  expected: string;
  property: string;
  role: string;
}

export function classTokenDrift(
    role: string,
    expected: string,
    actual: string,
): SidebarDrift[] {
  const actualTokens = new Set(tokens(actual));
  return tokens(expected)
      .filter((token) => !actualTokens.has(token))
      .map((token) => ({
        actual,
        expected: token,
        property: 'class',
        role,
      }));
}

export function extraClassDrift(
    role: string,
    expected: string,
    actual: string,
    optional: readonly string[] = [],
): SidebarDrift[] {
  const expectedTokens = new Set(tokens(expected));
  const optionalTokens = new Set(optional);
  return tokens(actual)
      .filter((token) =>
        !token.startsWith('bfa-')
        && !expectedTokens.has(token)
        && !optionalTokens.has(token))
      .map((token) => ({
        actual: token,
        expected,
        property: 'class',
        role,
      }));
}

export function styleDrift(
    role: string,
    expected: Readonly<Record<string, string>>,
    actual: Readonly<Record<string, string>>,
): SidebarDrift[] {
  return Object.entries(expected)
      .filter(([key, value]) => (actual[key] ?? '') !== value)
      .map(([key, value]) => ({
        actual: actual[key] ?? '',
        expected: value,
        property: key,
        role,
      }));
}

export function formatSidebarDrift(drift: SidebarDrift): string {
  return `${drift.role} ${drift.property}: expected ${drift.expected}; actual ${drift.actual}`;
}

export interface SidebarBox {
  height: string;
  left: 'auto';
  position: 'fixed';
  right: '0px';
  top: string;
  width: '340px';
  zIndex: '10001';
}

export function journalSidebarBox(input: {topPx: number; viewportHeight: number}): SidebarBox {
  const top = Math.max(0, Math.round(input.topPx));
  const height = Math.max(240, Math.round(input.viewportHeight - top));
  return {
    height: `${height}px`,
    left: 'auto',
    position: 'fixed',
    right: '0px',
    top: `${top}px`,
    width: '340px',
    zIndex: '10001',
  };
}

export interface SidebarRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export function controlsSitOnPanel(input: {
  controls: SidebarRect;
  paneTop: number;
  panel: SidebarRect;
}): SidebarDrift[] {
  const drift: SidebarDrift[] = [];
  if (input.controls.top < input.panel.top - 2 || input.controls.bottom > input.panel.bottom + 2) {
    drift.push({
      actual: `${Math.round(input.controls.top)}`,
      expected: `${Math.round(input.panel.top)}`,
      property: 'controls-top',
      role: 'controls',
    });
  }
  if (input.controls.left < input.panel.left - 2 || input.controls.right > input.panel.right + 2) {
    drift.push({
      actual: `${Math.round(input.controls.left)}..${Math.round(input.controls.right)}`,
      expected: `${Math.round(input.panel.left)}..${Math.round(input.panel.right)}`,
      property: 'controls-x',
      role: 'controls',
    });
  }
  if (input.controls.bottom > input.paneTop + 12) {
    drift.push({
      actual: `${Math.round(input.controls.bottom)}`,
      expected: `${Math.round(input.paneTop)}`,
      property: 'controls-above-pane',
      role: 'controls',
    });
  }
  if (input.controls.bottom - input.controls.top > 64) {
    drift.push({
      actual: `${Math.round(input.controls.bottom - input.controls.top)}`,
      expected: '64',
      property: 'controls-height',
      role: 'controls',
    });
  }
  if (input.paneTop - input.panel.top > 120) {
    drift.push({
      actual: `${Math.round(input.paneTop)}`,
      expected: `${Math.round(input.panel.top + 120)}`,
      property: 'pane-top',
      role: 'controls',
    });
  }
  return drift;
}

function tokens(className: string): string[] {
  return className.split(/\s+/).filter((token) => token !== '');
}
