import settingsStyles from './settings.css?raw';
import {
  CHARACTER_JOURNAL_ENABLED_KEY,
  getCampaignCardPortraitUpgradeEnabled,
  getCharacterJournalEnabled,
  setCampaignCardPortraitUpgradeEnabled,
  setCharacterJournalEnabled,
} from '../platform/chrome/storage';
import {installStoredContent} from './stored-content';

const SETTINGS_STYLE_ATTRIBUTE_NAME = 'data-bfa-popup-styles';
const HIDDEN_STATUS_CLASS_NAME = 'bfa-popup__status--hidden';
const ERROR_STATUS_CLASS_NAME = 'bfa-popup__status--error';
const SUCCESS_STATUS_CLASS_NAME = 'bfa-popup__status--success';

void initializePopup(document);

export async function initializePopup(doc: Document): Promise<void> {
  ensureStyles(doc);

  const checkbox = doc.querySelector<HTMLInputElement>(
      '#campaign-card-portrait-upgrade',
  );
  const status = doc.querySelector<HTMLParagraphElement>(
      '#campaign-card-portrait-upgrade-status',
  );
  if (checkbox !== null && status !== null) {
    checkbox.checked = await getCampaignCardPortraitUpgradeEnabled();
    checkbox.addEventListener('change', () => {
      void handleCheckboxChange({
        checkbox,
        disabledMessage: 'Character card portrait enhancement disabled.',
        enabledMessage: 'Character card portrait enhancement enabled.',
        setValue: setCampaignCardPortraitUpgradeEnabled,
        status,
      });
    });
  }

  const journalCheckbox = doc.querySelector<HTMLInputElement>(
      '#character-journal-enabled',
  );
  const journalStatus = doc.querySelector<HTMLParagraphElement>(
      '#character-journal-status',
  );
  if (journalCheckbox !== null && journalStatus !== null) {
    journalCheckbox.checked = await getCharacterJournalEnabled();
    journalCheckbox.addEventListener('change', () => {
      void handleCheckboxChange({
        checkbox: journalCheckbox,
        disabledMessage: 'Character Journal tab disabled.',
        enabledMessage: 'Character Journal tab enabled.',
        setValue: setCharacterJournalEnabled,
        status: journalStatus,
      });
    });
    installJournalPreferenceSync(journalCheckbox, journalStatus);
  }

  await installStoredContent(doc);
}
async function handleCheckboxChange(options: {
  checkbox: HTMLInputElement;
  disabledMessage: string;
  enabledMessage: string;
  setValue: (enabled: boolean) => Promise<void>;
  status: HTMLParagraphElement;
}): Promise<void> {
  const {
    checkbox,
    disabledMessage,
    enabledMessage,
    setValue,
    status,
  } = options;

  checkbox.disabled = true;
  try {
    await setValue(checkbox.checked);
    renderStatus(
        status,
        checkbox.checked ? enabledMessage : disabledMessage,
        false,
    );
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    renderStatus(
        status,
        asErrorMessage(error),
        true,
    );
  } finally {
    checkbox.disabled = false;
  }
}

function installJournalPreferenceSync(
    checkbox: HTMLInputElement,
    status: HTMLParagraphElement,
): void {
  if (typeof chrome === 'undefined' || chrome.storage?.onChanged === undefined) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName !== 'local'
      || !Object.hasOwn(changes, CHARACTER_JOURNAL_ENABLED_KEY)
    ) {
      return;
    }

    const nextValue = changes[CHARACTER_JOURNAL_ENABLED_KEY]?.newValue;
    if (typeof nextValue !== 'boolean' || checkbox.checked === nextValue) {
      return;
    }

    checkbox.checked = nextValue;
    renderStatus(
        status,
        nextValue
          ? 'Character Journal tab enabled.'
          : 'Character Journal tab disabled.',
        false,
    );
  });
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Setting could not be updated.';
}

function ensureStyles(doc: Document): void {
  if (doc.head.querySelector(`[${SETTINGS_STYLE_ATTRIBUTE_NAME}]`) !== null) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(SETTINGS_STYLE_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = settingsStyles;
  doc.head.append(styleElement);
}

function renderStatus(
    status: HTMLParagraphElement,
    message: string,
    isError: boolean,
): void {
  status.textContent = message;
  status.classList.toggle(HIDDEN_STATUS_CLASS_NAME, message === '');
  status.classList.toggle(ERROR_STATUS_CLASS_NAME, isError);
  status.classList.toggle(SUCCESS_STATUS_CLASS_NAME, !isError && message !== '');
}
