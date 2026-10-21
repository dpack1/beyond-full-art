import type {JournalNote} from './character-journal-types';
import {normalizeJournalEntryTitle} from './character-journal-types';

export interface QuickNotePlan {
  note: JournalNote;
}

export function localSessionDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function sessionTitleForDate(now: Date): string {
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
  }).format(now);
  return `Session · ${formatted}`;
}

export function quickNoteLine(now: Date, text: string): string {
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `- ${hour}:${minute} ${text.trim()}`;
}

export function planQuickNote(
    notes: readonly JournalNote[],
    text: string,
    now: Date,
    createId: () => string,
    characterId: string,
): JournalNote {
  const sessionDate = localSessionDate(now);
  const line = quickNoteLine(now, text);
  const timestamp = now.toISOString();
  const candidates = notes
      .filter((note) => note.type === 'session' && note.sessionDate === sessionDate)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const target = candidates[0];
  if (target !== undefined) {
    const body = target.body.trim() === '' ? line : `${target.body.replace(/\s+$/, '')}\n${line}`;
    return {
      ...target,
      body,
      updatedAt: timestamp,
    };
  }

  return {
    body: line,
    characterId,
    createdAt: timestamp,
    featuredImageId: null,
    id: createId(),
    images: [],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate,
    title: normalizeJournalEntryTitle(sessionTitleForDate(now)),
    type: 'session',
    updatedAt: timestamp,
  };
}
