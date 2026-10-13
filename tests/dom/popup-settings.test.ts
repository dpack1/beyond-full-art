import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const storageMocks = vi.hoisted(() => ({
  getCampaignCardPortraitUpgradeEnabled: vi.fn(),
  getCharacterJournalEnabled: vi.fn(),
  setCampaignCardPortraitUpgradeEnabled: vi.fn(),
  setCharacterJournalEnabled: vi.fn(),
}));

const messageMocks = vi.hoisted(() => ({
  deleteStoredCharacterArt: vi.fn(),
  getStoredCharacterArtImageData: vi.fn(),
  listStoredCharacterArtMetadata: vi.fn(),
}));

vi.mock('../../src/platform/chrome/storage', () => storageMocks);
vi.mock('../../src/platform/chrome/messages', () => messageMocks);

import {initializePopup} from '../../src/popup/settings';

describe('popup settings', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = createPopupFixture();
    storageMocks.getCampaignCardPortraitUpgradeEnabled.mockResolvedValue(true);
    storageMocks.getCharacterJournalEnabled.mockResolvedValue(true);
    storageMocks.setCampaignCardPortraitUpgradeEnabled.mockResolvedValue(undefined);
    storageMocks.setCharacterJournalEnabled.mockResolvedValue(undefined);
    messageMocks.deleteStoredCharacterArt.mockResolvedValue(undefined);
    messageMocks.getStoredCharacterArtImageData.mockResolvedValue(null);
    messageMocks.listStoredCharacterArtMetadata.mockResolvedValue([]);
    URL.createObjectURL = vi.fn(() => 'blob:popup-download');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    vi.restoreAllMocks();
  });

  it('renders an empty stored-art inventory', async () => {
    await initializePopup(document);

    expect(document.querySelector('#stored-art-summary')?.textContent)
        .toBe('No stored full art.');
    expect(document.querySelector('#stored-art-empty')?.hasAttribute('hidden'))
        .toBe(false);
    expect(document.querySelectorAll('.bfa-popup__stored-art-item')).toHaveLength(0);
  });

  it('renders stored-art inventory totals and item actions', async () => {
    messageMocks.listStoredCharacterArtMetadata.mockResolvedValue([
      createMetadata({
        byteSize: 2 * 1024 * 1024,
        characterId: '169418374',
        fileName: 'Zurelda.png',
      }),
      createMetadata({
        byteSize: 512 * 1024,
        characterId: '169418375',
        fileName: 'Matilda.webp',
      }),
    ]);

    await initializePopup(document);

    expect(document.querySelector('#stored-art-summary')?.textContent)
        .toBe('2 stored artworks / 2.5 MB');
    expect(
        [...document.querySelectorAll('.bfa-popup__stored-art-title')]
            .map((element) => element.textContent),
    ).toEqual(['Zurelda.png', 'Matilda.webp']);
    expect(
        [...document.querySelectorAll('.bfa-popup__button')]
            .map((element) => element.textContent),
    ).toEqual(['Open', 'Download', 'Delete', 'Open', 'Download', 'Delete']);
    expect(
        document.querySelector<HTMLAnchorElement>('.bfa-popup__button')?.href,
    ).toBe('https://www.dndbeyond.com/characters/169418374');
    expect(
        document.querySelector<HTMLAnchorElement>('.bfa-popup__button')?.target,
    ).toBe('_blank');
  });

  it('downloads a stored-art inventory item', async () => {
    messageMocks.listStoredCharacterArtMetadata.mockResolvedValue([
      createMetadata({
        characterId: '169418374',
        fileName: 'Zurelda.png',
      }),
    ]);
    messageMocks.getStoredCharacterArtImageData.mockResolvedValue({
      byteBuffer: new Uint8Array([1, 2, 3]).buffer,
      fileName: 'Zurelda: full?.png',
      mimeType: 'image/png',
    });
    let clickedDownload = '';
    let clickedHref = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        function click(this: HTMLAnchorElement) {
          clickedDownload = this.download;
          clickedHref = this.href;
        },
    );

    await initializePopup(document);
    document.querySelector<HTMLButtonElement>('button.bfa-popup__button')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(messageMocks.getStoredCharacterArtImageData)
        .toHaveBeenCalledWith('169418374');
    expect(clickedDownload).toBe('Zurelda- full-.png');
    expect(clickedHref).toBe('blob:popup-download');
    expect(document.querySelector('#stored-art-status')?.textContent)
        .toBe('Stored full art download started.');
  });

  it('deletes a stored-art inventory item after confirmation', async () => {
    messageMocks.listStoredCharacterArtMetadata
        .mockResolvedValueOnce([
          createMetadata({
            characterId: '169418374',
            fileName: 'Zurelda.png',
          }),
        ])
        .mockResolvedValueOnce([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await initializePopup(document);
    const deleteButton = [...document.querySelectorAll<HTMLButtonElement>(
        '.bfa-popup__button',
    )].find((button) => button.textContent === 'Delete');

    deleteButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(messageMocks.deleteStoredCharacterArt).toHaveBeenCalledWith('169418374');
    expect(document.querySelector('#stored-art-summary')?.textContent)
        .toBe('No stored full art.');
    expect(document.querySelector('#stored-art-status')?.textContent)
        .toBe('Stored full art deleted.');
  });

  it('toggles the character journal setting', async () => {
    storageMocks.getCharacterJournalEnabled.mockResolvedValue(false);

    await initializePopup(document);
    const checkbox = document.querySelector<HTMLInputElement>(
        '#character-journal-enabled',
    );
    expect(checkbox?.checked).toBe(false);

    checkbox?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(storageMocks.setCharacterJournalEnabled).toHaveBeenCalledWith(true);
    expect(document.querySelector('#character-journal-status')?.textContent)
        .toBe('Character Journal tab enabled.');
  });
});

function createMetadata(overrides: {
  byteSize?: number;
  characterId: string;
  fileName: string;
}) {
  return {
    blobKey: `blob-${overrides.characterId}`,
    byteSize: overrides.byteSize ?? 2048,
    characterId: overrides.characterId,
    createdAt: '2026-08-06T00:00:00.000Z',
    fileName: overrides.fileName,
    height: 1024,
    mimeType: 'image/png',
    schemaVersion: 1,
    updatedAt: '2026-08-07T00:00:00.000Z',
    width: 1024,
  };
}

function createPopupFixture(): string {
  return `
    <main class="bfa-popup__main">
      <section class="bfa-popup__section">
        <label for="campaign-card-portrait-upgrade">
          <input id="campaign-card-portrait-upgrade" type="checkbox">
        </label>
        <p
          id="campaign-card-portrait-upgrade-status"
          class="bfa-popup__status bfa-popup__status--hidden"></p>
      </section>
      <section class="bfa-popup__section">
        <label for="character-journal-enabled">
          <input id="character-journal-enabled" type="checkbox">
        </label>
        <p
          id="character-journal-status"
          class="bfa-popup__status bfa-popup__status--hidden"></p>
      </section>
      <section class="bfa-popup__section">
        <p id="stored-art-summary"></p>
        <p id="stored-art-empty" hidden></p>
        <ul id="stored-art-list"></ul>
        <p id="stored-art-status" class="bfa-popup__status bfa-popup__status--hidden"></p>
      </section>
    </main>
  `;
}
