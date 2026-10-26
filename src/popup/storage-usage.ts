import {
  readExtensionStorageUsage,
  type ExtensionStorageUsage,
} from '../platform/chrome/storage-usage';

const WARNING_RATIO = 0.8;

export interface StorageUsageLine {
  detail: string;
  meterMax: number | null;
  meterValue: number | null;
  warning: boolean;
}

export interface StorageUsageDescription {
  images: StorageUsageLine;
  notes: StorageUsageLine;
  summary: string;
}

export function describeStorageUsage(
    reading: ExtensionStorageUsage,
): StorageUsageDescription {
  const notes = describeLine(reading.localBytes, reading.localQuotaBytes);
  const images = describeLine(reading.indexedDbBytes, reading.indexedDbQuotaBytes);
  if (reading.indexedDbBytes !== null) {
    images.detail = `about ${images.detail}`;
  }
  return {
    images,
    notes,
    summary: [
      reading.localBytes === null ? 'Notes and settings could not be measured.' : '',
      reading.indexedDbBytes === null ? 'Image storage could not be measured.' : '',
    ].filter((line) => line !== '').join(' '),
  };
}

export async function installStorageUsage(doc: Document): Promise<void> {
  const summary = doc.querySelector<HTMLParagraphElement>('#storage-usage-summary');
  const notes = doc.querySelector<HTMLElement>('#storage-usage-local');
  const notesMeter = doc.querySelector<HTMLProgressElement>(
      '#storage-usage-local-meter',
  );
  const images = doc.querySelector<HTMLElement>('#storage-usage-images');
  const imagesMeter = doc.querySelector<HTMLProgressElement>(
      '#storage-usage-images-meter',
  );
  if (summary === null || notes === null || notesMeter === null
    || images === null || imagesMeter === null) {
    return;
  }

  try {
    renderStorageUsage(
        describeStorageUsage(await readExtensionStorageUsage()),
        {images, imagesMeter, notes, notesMeter, summary},
    );
  } catch {
    summary.textContent = 'Storage usage could not be measured.';
  }
}

function describeLine(
    bytes: number | null,
    quotaBytes: number | null,
): StorageUsageLine {
  if (bytes === null) {
    return {
      detail: 'Unavailable',
      meterMax: null,
      meterValue: null,
      warning: false,
    };
  }

  const meterMax = quotaBytes !== null && quotaBytes > 0 ? quotaBytes : null;
  return {
    detail: meterMax === null
      ? formatByteSize(bytes)
      : `${formatByteSize(bytes)} of ${formatByteSize(meterMax)}`,
    meterMax,
    meterValue: meterMax === null ? null : Math.min(bytes, meterMax),
    warning: meterMax !== null && bytes / meterMax >= WARNING_RATIO,
  };
}

function renderStorageUsage(
    description: StorageUsageDescription,
    elements: {
      images: HTMLElement;
      imagesMeter: HTMLProgressElement;
      notes: HTMLElement;
      notesMeter: HTMLProgressElement;
      summary: HTMLParagraphElement;
    },
): void {
  elements.summary.hidden = description.summary === '';
  elements.summary.textContent = description.summary;
  renderLine(elements.notes, elements.notesMeter, description.notes);
  renderLine(elements.images, elements.imagesMeter, description.images);
}

function renderLine(
    detail: HTMLElement,
    meter: HTMLProgressElement,
    line: StorageUsageLine,
): void {
  detail.textContent = line.detail;
  meter.hidden = line.meterMax === null || line.meterValue === null;
  meter.classList.toggle('bfa-popup__storage-meter--warning', line.warning);
  if (line.meterMax === null || line.meterValue === null) {
    return;
  }

  meter.max = line.meterMax;
  meter.value = line.meterValue;
  meter.setAttribute('aria-valuetext', line.detail);
}

function formatByteSize(byteSize: number): string {
  if (!Number.isFinite(byteSize) || byteSize < 0) {
    return '0 B';
  }
  if (byteSize < 1024) {
    return `${Math.round(byteSize)} B`;
  }

  const kibibytes = byteSize / 1024;
  if (kibibytes < 1024) {
    return `${kibibytes.toFixed(1)} KB`;
  }

  const mebibytes = kibibytes / 1024;
  if (mebibytes < 1024) {
    return `${mebibytes.toFixed(1)} MB`;
  }

  return `${(mebibytes / 1024).toFixed(1)} GB`;
}
