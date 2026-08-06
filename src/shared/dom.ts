export function isHtmlElement(value: Element | null): value is HTMLElement {
  return value instanceof HTMLElement;
}

export function isHtmlInputElement(
    value: EventTarget | Element | null,
): value is HTMLInputElement {
  return value instanceof HTMLInputElement;
}

export function isHtmlImageElement(
    value: Element | null,
): value is HTMLImageElement {
  return value instanceof HTMLImageElement;
}

export function isKeyboardActivationKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ';
}
