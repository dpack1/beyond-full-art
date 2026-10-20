import type {JournalEntryType} from './character-journal-types';

const STARTER_HEADINGS: Record<Exclude<JournalEntryType, 'unset'>, readonly string[]> = {
  backstory: ['What I remember'],
  item: ['Where we found it', 'Who carries it', 'What we know'],
  npc: [
    'Who they are to me',
    'Where',
    'What they want',
    'We owe / they owe',
    'My suspicions',
  ],
  place: ['Why it matters', 'Who is there'],
  quest: ['Goal', 'Given by', 'Reward', 'Next step'],
  session: [
    'What happened',
    'Who we met',
    'Promises',
    'Loot',
    'Open questions',
    'Best moment',
  ],
};

export function starterJournalBody(type: JournalEntryType): string {
  if (type === 'unset') {
    return '';
  }

  return STARTER_HEADINGS[type]
      .map((heading) => `## ${heading}\n`)
      .join('\n');
}
