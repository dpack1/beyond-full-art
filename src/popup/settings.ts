import settingsStyles from './settings.css?raw';
import {
  CHARACTER_JOURNAL_ENABLED_KEY,
  getCampaignCardPortraitUpgradeEnabled,
  getCharacterJournalEnabled,
  setCampaignCardPortraitUpgradeEnabled,
  setCharacterJournalEnabled,
} from '../platform/chrome/storage';
import {installBackupFolder} from './backup-folder';
import {installStorageUsage} from './storage-usage';
import {installStoredContent} from './stored-content';
import {
  COMPANION_PORTRAIT_ENABLED_KEY,
  getCompanionPortraitEnabled,
  setCompanionPortraitEnabled,
} from '../platform/chrome/companion-portrait-storage';
import {
  CLEANUP_PREFERENCE_KEY,
  describeCleanupPreference,
  getCleanupPreference,
  setCleanupPreference,
} from '../platform/chrome/cleanup-preference';
import {
  getJournalListPreferences,
  setJournalListPreferences,
  type JournalListPreferences,
} from '../platform/chrome/journal-list-preferences';

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
    await installJournalListPreferences(doc, journalStatus);
  }

  const companionCheckbox = doc.querySelector<HTMLInputElement>(
      '#companion-portrait-enabled',
  );
  const companionStatus = doc.querySelector<HTMLParagraphElement>(
      '#companion-portrait-status',
  );
  if (companionCheckbox !== null && companionStatus !== null) {
    companionCheckbox.checked = await getCompanionPortraitEnabled();
    companionCheckbox.addEventListener('change', () => {
      void handleCheckboxChange({
        checkbox: companionCheckbox,
        disabledMessage: 'Companion portrait disabled.',
        enabledMessage: 'Companion portrait enabled.',
        setValue: setCompanionPortraitEnabled,
        status: companionStatus,
      });
    });
    installPreferenceSync({
      checkbox: companionCheckbox,
      disabledMessage: 'Companion portrait disabled.',
      enabledMessage: 'Companion portrait enabled.',
      key: COMPANION_PORTRAIT_ENABLED_KEY,
      status: companionStatus,
    });
  }

  await installCleanupPreference(doc);
  await Promise.all([
    installBackupFolder(doc),
    installStorageUsage(doc),
    installStoredContent(doc),
  ]);
}

async function installCleanupPreference(doc: Document): Promise<void> {
  const summary = doc.querySelector<HTMLParagraphElement>('#cleanup-preference-summary');
  const reset = doc.querySelector<HTMLButtonElement>('#cleanup-preference-reset');
  const status = doc.querySelector<HTMLParagraphElement>('#cleanup-preference-status');
  if (summary === null || reset === null || status === null) {
    return;
  }
  const render = async () => {
    const preference = await getCleanupPreference();
    summary.textContent = describeCleanupPreference(preference);
    reset.hidden = preference === 'ask';
  };
  await render();
  reset.addEventListener('click', () => {
    void setCleanupPreference('ask')
        .then(async () => {
          await render();
          renderStatus(status, 'Asking each time.', false);
        })
        .catch((error: unknown) => {
          renderStatus(status, asErrorMessage(error), true);
        });
  });
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged !== undefined) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !Object.hasOwn(changes, CLEANUP_PREFERENCE_KEY)) {
        return;
      }
      void render();
    });
  }
}

async function installJournalListPreferences(
    doc: Document,
    status: HTMLParagraphElement,
): Promise<void> {
  const controls: Record<keyof JournalListPreferences, HTMLInputElement | null> = {
    showPreview: doc.querySelector<HTMLInputElement>('#character-journal-show-preview'),
    showThumbnail: doc.querySelector<HTMLInputElement>('#character-journal-show-thumbnail'),
    showUpdatedDate: doc.querySelector<HTMLInputElement>(
        '#character-journal-show-updated-date',
    ),
  };
  if (Object.values(controls).some((control) => control === null)) {
    return;
  }

  let preferences = await getJournalListPreferences();
  for (const key of preferenceKeys()) {
    const control = controls[key];
    if (control === null) {
      continue;
    }
    control.checked = preferences[key];
    control.addEventListener('change', () => {
      const previous = preferences;
      const next = {...preferences, [key]: control.checked};
      preferences = next;
      control.disabled = true;
      void setJournalListPreferences(next).then(() => {
        renderStatus(status, 'Journal list details updated.', false);
      }).catch((error: unknown) => {
        preferences = previous;
        control.checked = previous[key];
        renderStatus(status, asErrorMessage(error), true);
      }).finally(() => {
        control.disabled = false;
      });
    });
  }
}

function preferenceKeys(): Array<keyof JournalListPreferences> {
  return ['showPreview', 'showThumbnail', 'showUpdatedDate'];
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
  installPreferenceSync({
    checkbox,
    disabledMessage: 'Character Journal tab disabled.',
    enabledMessage: 'Character Journal tab enabled.',
    key: CHARACTER_JOURNAL_ENABLED_KEY,
    status,
  });
}

function installPreferenceSync(options: {
  checkbox: HTMLInputElement;
  disabledMessage: string;
  enabledMessage: string;
  key: string;
  status: HTMLParagraphElement;
}): void {
  if (typeof chrome === 'undefined' || chrome.storage?.onChanged === undefined) {
    return;
  }

  const {checkbox, disabledMessage, enabledMessage, key, status} = options;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName !== 'local'
      || !Object.hasOwn(changes, key)
    ) {
      return;
    }

    const nextValue = changes[key]?.newValue;
    if (typeof nextValue !== 'boolean' || checkbox.checked === nextValue) {
      return;
    }

    checkbox.checked = nextValue;
    renderStatus(
        status,
        nextValue ? enabledMessage : disabledMessage,
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
