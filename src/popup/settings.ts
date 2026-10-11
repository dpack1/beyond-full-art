import settingsStyles from './settings.css?raw';
import {
  getCampaignCardPortraitUpgradeEnabled,
  setCampaignCardPortraitUpgradeEnabled,
} from '../platform/chrome/storage';

const SETTINGS_STYLE_ATTRIBUTE_NAME = 'data-bfa-popup-styles';
const HIDDEN_STATUS_CLASS_NAME = 'bfa-popup__status--hidden';
const ERROR_STATUS_CLASS_NAME = 'bfa-popup__status--error';

void initializePopup(document);

async function initializePopup(doc: Document): Promise<void> {
  ensureStyles(doc);

  const checkbox = doc.querySelector<HTMLInputElement>(
      '#campaign-card-portrait-upgrade',
  );
  const status = doc.querySelector<HTMLParagraphElement>(
      '#campaign-card-portrait-upgrade-status',
  );
  if (checkbox === null || status === null) {
    return;
  }

  checkbox.checked = await getCampaignCardPortraitUpgradeEnabled();
  checkbox.addEventListener('change', () => {
    void handleCheckboxChange(checkbox, status);
  });
}

async function handleCheckboxChange(
    checkbox: HTMLInputElement,
    status: HTMLParagraphElement,
): Promise<void> {
  checkbox.disabled = true;
  try {
    await setCampaignCardPortraitUpgradeEnabled(checkbox.checked);
    renderStatus(
        status,
        checkbox.checked
          ? 'Campaign portrait enhancement enabled.'
          : 'Campaign portrait enhancement disabled.',
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
  status.classList.remove(HIDDEN_STATUS_CLASS_NAME);
  status.classList.toggle(ERROR_STATUS_CLASS_NAME, isError);
}
