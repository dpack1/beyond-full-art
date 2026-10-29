import {describe, expect, it} from 'vitest';

import {
  applyCleanupChoice,
  applyVerifiedCharacterDeletion,
} from '../../src/features/character-deletion/cleanup-decision';
import {
  describeCleanupPreference,
  normalizeCleanupPreference,
} from '../../src/platform/chrome/cleanup-preference';

describe('character deletion cleanup decisions', () => {
  it('defaults an unknown preference to ask', () => {
    expect(normalizeCleanupPreference(undefined)).toBe('ask');
    expect(normalizeCleanupPreference('drop')).toBe('ask');
    expect(describeCleanupPreference('keep')).toContain('kept');
  });

  it('does nothing when the character has no stored full art', async () => {
    const deleted: string[] = [];
    const outcome = await applyVerifiedCharacterDeletion({
      artExists: async () => false,
      characterId: '900000001',
      deleteArt: async (characterId) => {
        deleted.push(characterId);
      },
      preference: 'delete',
      prompt: async () => undefined,
      tabId: 1,
    });
    expect(outcome).toBe('missing');
    expect(deleted).toEqual([]);
  });

  it('deletes, keeps, or asks according to the preference', async () => {
    const deleted: string[] = [];
    const prompted: string[] = [];
    const base = {
      artExists: async () => true,
      characterId: '900000001',
      deleteArt: async (characterId: string) => {
        deleted.push(characterId);
      },
      prompt: async (characterId: string) => {
        prompted.push(characterId);
      },
      tabId: 4,
    };
    expect(await applyVerifiedCharacterDeletion({...base, preference: 'keep'})).toBe('kept');
    expect(await applyVerifiedCharacterDeletion({...base, preference: 'delete'})).toBe('deleted');
    expect(await applyVerifiedCharacterDeletion({...base, preference: 'ask'})).toBe('prompted');
    expect(await applyVerifiedCharacterDeletion({
      ...base,
      preference: 'ask',
      tabId: -1,
    })).toBe('kept');
    expect(deleted).toEqual(['900000001']);
    expect(prompted).toEqual(['900000001']);
  });

  it('reports a storage failure without treating the art as deleted', async () => {
    const outcome = await applyVerifiedCharacterDeletion({
      artExists: async () => true,
      characterId: '900000001',
      deleteArt: async () => {
        throw new Error('disk full');
      },
      preference: 'delete',
      prompt: async () => undefined,
      tabId: 1,
    });
    expect(outcome).toBe('delete-failed');
  });

  it('remembers a choice only after a successful delete or an explicit keep', async () => {
    const saved: string[] = [];
    let deleted = 0;
    await applyCleanupChoice({
      decision: 'keep',
      deleteArt: async () => {
        deleted += 1;
      },
      remember: false,
      setPreference: async (preference) => {
        saved.push(preference);
      },
    });
    await applyCleanupChoice({
      decision: 'keep',
      deleteArt: async () => {
        deleted += 1;
      },
      remember: true,
      setPreference: async (preference) => {
        saved.push(preference);
      },
    });
    await expect(applyCleanupChoice({
      decision: 'delete',
      deleteArt: async () => {
        throw new Error('still there');
      },
      remember: true,
      setPreference: async (preference) => {
        saved.push(preference);
      },
    })).rejects.toThrow('still there');
    await applyCleanupChoice({
      decision: 'delete',
      deleteArt: async () => {
        deleted += 1;
      },
      remember: true,
      setPreference: async (preference) => {
        saved.push(preference);
      },
    });
    expect(deleted).toBe(1);
    expect(saved).toEqual(['keep', 'delete']);
  });
});
