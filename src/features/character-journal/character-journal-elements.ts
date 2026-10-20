import journalStyles from './character-journal.css?raw';
import {CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME} from '../../platform/dndbeyond/selectors';

export function ensureJournalStyles(doc: Document): void {
  if (
    doc.head.querySelector(`[${CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME}]`) !==
    null
  ) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = journalStyles;
  doc.head.append(styleElement);
}

export function removeJournalStyles(doc: Document): void {
  doc.head.querySelector(`[${CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME}]`)?.remove();
}
