import {describe, expect, it} from 'vitest';

import {
  characterIdFromDeletionJson,
  characterIdFromFormFields,
  characterIdFromWebRequestBody,
  isCharacterDeletionRequest,
  isWatchedCharacterDeletion,
} from '../../src/features/character-deletion/deletion-request';

describe('character deletion request decoding', () => {
  it('reads the observed character-service payload as a string id', () => {
    expect(characterIdFromDeletionJson('{"characterId":900000001}')).toBe('900000001');
    expect(characterIdFromDeletionJson('{"characterId":"169418374"}')).toBe('169418374');
  });

  it('rejects a missing, duplicated, or imprecise character id', () => {
    expect(characterIdFromDeletionJson('{"characterId":0}')).toBeNull();
    expect(characterIdFromDeletionJson('{"id":900000001}')).toBeNull();
    expect(characterIdFromDeletionJson(
        '{"characterId":900000001,"characterId":169418374}',
    )).toBeNull();
    expect(characterIdFromDeletionJson('{"characterId":9007199254740993}')).toBeNull();
    expect(characterIdFromDeletionJson('not json')).toBeNull();
  });

  it('reads one form field and one raw body', () => {
    expect(characterIdFromFormFields(['169418374'])).toBe('169418374');
    expect(characterIdFromFormFields(['169418374', '900000001'])).toBeNull();
    const bytes = new TextEncoder().encode('{"characterId":900000001}');
    expect(characterIdFromWebRequestBody({
      raw: [{bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)}],
    })).toBe('900000001');
    expect(characterIdFromWebRequestBody({error: 'Unknown error'})).toBeNull();
  });

  it('matches only the character-service DELETE', () => {
    expect(isCharacterDeletionRequest(
        'DELETE',
        'https://character-service.dndbeyond.com/character/v5/character',
    )).toBe(true);
    expect(isCharacterDeletionRequest(
        'POST',
        'https://character-service.dndbeyond.com/character/v5/character',
    )).toBe(false);
    expect(isCharacterDeletionRequest(
        'DELETE',
        'https://character-service.dndbeyond.com/character/v5/character/extra',
    )).toBe(false);
  });

  it('accepts a delete whose initiator was omitted', () => {
    const url = 'https://character-service.dndbeyond.com/character/v5/character';
    expect(isWatchedCharacterDeletion({
      initiator: 'https://www.dndbeyond.com',
      method: 'DELETE',
      url,
    })).toBe(true);
    expect(isWatchedCharacterDeletion({method: 'DELETE', url})).toBe(true);
    expect(isWatchedCharacterDeletion({
      documentUrl: 'https://www.dndbeyond.com/characters',
      method: 'DELETE',
      url,
    })).toBe(true);
    expect(isWatchedCharacterDeletion({
      initiator: 'https://example.com',
      method: 'DELETE',
      url,
    })).toBe(false);
  });
});
