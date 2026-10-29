import type {CleanupPreference} from '../../platform/chrome/cleanup-preference';

export type CleanupOutcome = 'delete-failed' | 'deleted' | 'kept' | 'missing' | 'prompted';

export async function applyVerifiedCharacterDeletion(input: {
  artExists: (characterId: string) => Promise<boolean>;
  characterId: string;
  deleteArt: (characterId: string) => Promise<void>;
  preference: CleanupPreference;
  prompt: (characterId: string) => Promise<void>;
  tabId: number;
}): Promise<CleanupOutcome> {
  let exists = false;
  try {
    exists = await input.artExists(input.characterId);
  } catch {
    return 'missing';
  }
  if (!exists) {
    return 'missing';
  }
  if (input.preference === 'keep') {
    return 'kept';
  }
  if (input.preference === 'delete') {
    try {
      await input.deleteArt(input.characterId);
      return 'deleted';
    } catch {
      return 'delete-failed';
    }
  }
  if (input.tabId < 0) {
    return 'kept';
  }
  try {
    await input.prompt(input.characterId);
    return 'prompted';
  } catch {
    return 'kept';
  }
}

export async function applyCleanupChoice(input: {
  decision: 'delete' | 'keep';
  deleteArt: () => Promise<void>;
  remember: boolean;
  setPreference: (preference: CleanupPreference) => Promise<void>;
}): Promise<void> {
  if (input.decision === 'keep') {
    if (input.remember) {
      await input.setPreference('keep');
    }
    return;
  }
  await input.deleteArt();
  if (input.remember) {
    await input.setPreference('delete');
  }
}
