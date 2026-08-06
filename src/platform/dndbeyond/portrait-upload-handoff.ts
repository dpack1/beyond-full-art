const suppressedInputs = new WeakSet<HTMLInputElement>();

export function isExtensionDrivenPortraitUpload(
    input: HTMLInputElement,
): boolean {
  return suppressedInputs.has(input);
}

export function submitFileToPortraitUploadInput(
    input: HTMLInputElement,
    file: File,
    doc: Document = document,
): void {
  const view = doc.defaultView;
  const fileList = createFileList(file, view);

  suppressedInputs.add(input);

  try {
    setInputFiles(input, fileList);
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
  } finally {
    queueMicrotask(() => {
      suppressedInputs.delete(input);
    });
  }
}

function createFileList(file: File, view: Window | null): FileList {
  const DataTransferConstructor = (
    view as (Window & {DataTransfer?: typeof DataTransfer}) | null
  )?.DataTransfer;
  if (DataTransferConstructor !== undefined) {
    const dataTransfer = new DataTransferConstructor();
    dataTransfer.items.add(file);
    return dataTransfer.files;
  }

  return {
    0: file,
    item(index: number) {
      return index === 0 ? file : null;
    },
    length: 1,
  } as unknown as FileList;
}

function setInputFiles(input: HTMLInputElement, fileList: FileList): void {
  try {
    input.files = fileList;
  } catch {
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: fileList,
    });
  }
}
