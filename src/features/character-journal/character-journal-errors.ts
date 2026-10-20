export function journalSaveErrorMessage(error: unknown): string {
  if (isQuotaError(error)) {
    return 'Storage is full. Your note is still in the editor.';
  }

  const message = errorMessage(error);
  if (message.includes('still here') || message.includes('Try again')) {
    return message;
  }

  return 'Entry could not be saved. Your text is still here.';
}

export function journalActionErrorMessage(
    error: unknown,
    fallback: string,
): string {
  if (isQuotaError(error)) {
    return 'Storage is full. Your note is still in the editor.';
  }

  const message = errorMessage(error);
  return message === '' ? fallback : message;
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
