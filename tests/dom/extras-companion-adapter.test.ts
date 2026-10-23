import {afterEach, describe, expect, it} from 'vitest';

import {
  findCharacterHeaderPortrait,
  findExtrasCompanionTargets,
} from '../../src/platform/dndbeyond/extras-companion-adapter';
import {EXTRAS_COMPANION_FIXTURE} from '../fixtures/extras-companion';

describe('Extras companion adapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts a companion without including the customization asterisk', () => {
    document.body.innerHTML = EXTRAS_COMPANION_FIXTURE;

    expect(findExtrasCompanionTargets(document)).toEqual([
      expect.objectContaining({
        companionId: 'familiar\u001fpetali\u001ftiny fey',
        group: 'Familiar',
        imageUrl: expect.stringContaining('639281168224223961.png'),
        name: 'Petali',
        type: 'Tiny Fey',
      }),
    ]);
  });

  it('finds only the portrait inside the character identity header', () => {
    document.body.innerHTML = EXTRAS_COMPANION_FIXTURE;
    document.body.insertAdjacentHTML(
        'beforeend',
        '<aside><img class="ddbc-character-avatar__portrait" alt="Character portrait" src="sidebar.png"></aside>',
    );

    const target = findCharacterHeaderPortrait(document);

    expect(target?.container.classList.contains('ddbc-character-tidbits__avatar'))
        .toBe(true);
    expect(target?.portrait.src).toContain('1581111423-169418374.jpeg');
  });

  it('omits Extras rows without a usable image', () => {
    document.body.innerHTML = EXTRAS_COMPANION_FIXTURE;
    document.querySelector('.ct-extra-row__img')?.remove();

    expect(findExtrasCompanionTargets(document)).toEqual([]);
  });
});
