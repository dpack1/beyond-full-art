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

function tokens(className: string): string[] {
  return className.split(/\s+/).filter((token) => token !== '');
}
