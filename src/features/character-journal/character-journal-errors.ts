export function journalSaveErrorMessage(error: unknown): string {
  if (isQuotaError(error)) {
    return quotaMessage();
  }

  const message = errorMessage(error);
  if (
    message.includes('still here')
    || message.includes('still on screen')
    || message.includes('Try again')
    || message.includes('folder')
    || message.includes('allow access')
  ) {
    return message;
  }

  return 'This note could not be saved. Your text is still here.';
}

export function journalActionErrorMessage(
    error: unknown,
    fallback: string,
): string {
  if (isQuotaError(error)) {
    return quotaMessage();
  }

  const message = errorMessage(error);
  return message === '' ? fallback : message;
}

function quotaMessage(): string {
  const quota = readQuotaBytes();
  if (quota === null) {
    return 'Storage is full. This note is still on screen.';
  }

  return `Storage is full (${quota} bytes). This note is still on screen.`;
}

function readQuotaBytes(): number | null {
  const chromeGlobal = (globalThis as {
    chrome?: {storage?: {local?: {QUOTA_BYTES?: number}}};
  }).chrome;
  const quota = chromeGlobal?.storage?.local?.QUOTA_BYTES;
  return typeof quota === 'number' ? quota : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.trim() : '';
}

function isQuotaError(error: unknown): boolean {
  if (
    typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'QuotaExceededError'
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : '';
  return /quota/i.test(message);
}
