import {describe, expect, it} from 'vitest';

import {createStoredZip, readStoredZip} from '../../src/shared/zip';

describe('stored ZIP archive', () => {
  it('round-trips UTF-8 file names and bytes', () => {
    const encoder = new TextEncoder();
    const zip = createStoredZip([
      {data: encoder.encode('# Matilda'), path: 'characters/Matilda/notes/Story.md'},
      {data: new Uint8Array([1, 2, 3]), path: 'characters/Matilda/photos/map.png'},
    ]);

    const files = readStoredZip(new Uint8Array(zip).buffer as ArrayBuffer);

    expect(new TextDecoder().decode(files.get(
        'characters/Matilda/notes/Story.md',
    ))).toBe('# Matilda');
    expect(files.get('characters/Matilda/photos/map.png'))
        .toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects unsafe paths', () => {
    expect(() => createStoredZip([
      {data: new Uint8Array(), path: '../backup.json'},
    ])).toThrow('unsafe file path');
  });
});
