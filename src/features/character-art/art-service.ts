import {
  MAX_CHARACTER_ART_FILE_BYTES,
  type CharacterArtMetadata,
  type CharacterId,
  type CharacterPortraitCropMetadata,
  type SaveCharacterArtInput,
  type SaveCharacterPortraitCropInput,
  type StoredCharacterArtData,
  type SupportedCharacterArtMimeType,
  type ViewerImageResolution,
  isSupportedCharacterArtMimeType,
} from './art-types';
import {
  deleteStoredCharacterArt,
  getStoredCharacterArtImageData,
  getStoredCharacterArtMetadata,
  getStoredCharacterPortraitCropImageData,
  getStoredCharacterPortraitCropMetadata,
  saveStoredCharacterArt,
  saveStoredCharacterPortraitCrop,
} from '../../platform/chrome/messages';
import {err, ok, type Result} from '../../shared/result';

interface FallbackViewerImageSource {
  altText: string;
  imageUrl: string;
}

interface ValidatedArtFile {
  file: File;
  mimeType: SupportedCharacterArtMimeType;
}

export interface CropSourceImage {
  imageData: StoredCharacterArtData;
  metadata: CharacterArtMetadata;
  portraitCropMetadata: CharacterPortraitCropMetadata | null;
}

export interface CharacterArtService {
  deleteArt(characterId: CharacterId): Promise<Result<void, string>>;
  getCropMetadata(
      characterId: CharacterId,
  ): Promise<Result<CharacterPortraitCropMetadata | null, string>>;
  getMetadata(characterId: CharacterId): Promise<Result<CharacterArtMetadata | null, string>>;
  getPortraitCropImageData(
      characterId: CharacterId,
  ): Promise<Result<StoredCharacterArtData | null, string>>;
  loadCropSource(characterId: CharacterId): Promise<Result<CropSourceImage, string>>;
  resolveViewerImage(
      characterId: CharacterId,
      fallbackSource: FallbackViewerImageSource,
  ): Promise<ViewerImageResolution>;
  saveArt(
      characterId: CharacterId,
      file: File,
  ): Promise<Result<CharacterArtMetadata, string>>;
  savePortraitCrop(
      input: SaveCharacterPortraitCropInput,
  ): Promise<Result<CharacterPortraitCropMetadata, string>>;
}

export function createCharacterArtService(
    doc: Document = document,
): CharacterArtService {
  return {
    async deleteArt(characterId) {
      try {
        await deleteStoredCharacterArt(characterId);
        return ok(undefined);
      } catch (error) {
        return err(asUserFacingError(
            error,
            'Stored full art could not be deleted.',
        ));
      }
    },
    async getMetadata(characterId) {
      try {
        const metadata = await getStoredCharacterArtMetadata(characterId);
        return ok(metadata);
      } catch (error) {
        return err(asUserFacingError(
            error,
            'Stored full art status could not be loaded.',
        ));
      }
    },
    async getCropMetadata(characterId) {
      try {
        return ok(await getStoredCharacterPortraitCropMetadata(characterId));
      } catch (error) {
        return err(asUserFacingError(
            error,
            'Stored portrait crop status could not be loaded.',
        ));
      }
    },
    async getPortraitCropImageData(characterId) {
      try {
        return ok(await getStoredCharacterPortraitCropImageData(characterId));
      } catch (error) {
        return err(asUserFacingError(
            error,
            'Stored portrait crop could not be loaded.',
        ));
      }
    },
    async loadCropSource(characterId) {
      try {
        const [metadata, imageData, portraitCropMetadata] = await Promise.all([
          getStoredCharacterArtMetadata(characterId),
          getStoredCharacterArtImageData(characterId),
          getStoredCharacterPortraitCropMetadata(characterId),
        ]);
        if (metadata === null || imageData === null) {
          return err('Stored full art is required before creating a portrait crop.');
        }

        return ok({
          imageData,
          metadata,
          portraitCropMetadata:
            portraitCropMetadata?.sourceArtBlobKey === metadata.blobKey
              ? portraitCropMetadata
              : null,
        });
      } catch (error) {
        return err(asUserFacingError(
            error,
            'Stored full art could not be loaded for cropping.',
        ));
      }
    },
    async resolveViewerImage(characterId, fallbackSource) {
      try {
        const imageData = await getStoredCharacterArtImageData(characterId);
        if (imageData === null) {
          return {
            ...fallbackSource,
            usingStoredArt: false,
            warningMessage: null,
          };
        }

        const blob = new Blob([imageData.byteBuffer], {
          type: imageData.mimeType,
        });
        const objectUrl = createObjectUrl(blob);

        return {
          altText: fallbackSource.altText,
          imageUrl: objectUrl,
          releaseImageUrl: () => {
            revokeObjectUrl(objectUrl);
          },
          storedArtFileName: imageData.fileName,
          usingStoredArt: true,
          warningMessage: null,
        };
      } catch (error) {
        return {
          ...fallbackSource,
          usingStoredArt: false,
          warningMessage: asUserFacingError(
              error,
              'Stored full art could not be loaded. Showing the D&D Beyond portrait instead.',
          ),
        };
      }
    },
    async saveArt(characterId, file) {
      const validationResult = validateSelectedFile(file);
      if (!validationResult.ok) {
        return validationResult;
      }

      try {
        const [byteBuffer, dimensions] = await Promise.all([
          validationResult.value.file.arrayBuffer(),
          measureImageDimensions(validationResult.value.file, doc),
        ]);

        const saveInput: SaveCharacterArtInput = {
          byteBuffer,
          byteSize: validationResult.value.file.size,
          characterId,
          fileName: validationResult.value.file.name,
          height: dimensions.height,
          mimeType: validationResult.value.mimeType,
          width: dimensions.width,
        };
        const metadata = await saveStoredCharacterArt(saveInput);

        return ok(metadata);
      } catch (error) {
        return err(asUserFacingError(
            error,
            'Stored full art could not be saved locally.',
        ));
      }
    },
    async savePortraitCrop(input) {
      try {
        return ok(await saveStoredCharacterPortraitCrop(input));
      } catch (error) {
        return err(asUserFacingError(
            error,
            'Portrait crop could not be saved locally.',
        ));
      }
    },
  };
}

function asUserFacingError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    if (isExtensionResponseError(error.message)) {
      return 'The extension background service did not respond. Reload the extension and try again.';
    }

    return error.message;
  }

  return fallbackMessage;
}

function isExtensionResponseError(message: string): boolean {
  return (
    message.includes('The message port closed before a response was received.')
    || message.includes('Could not establish connection. Receiving end does not exist.')
  );
}

async function measureImageDimensions(
    file: File,
    doc: Document,
): Promise<{height: number; width: number}> {
  const objectUrl = createObjectUrl(file);

  try {
    const image = doc.createElement('img');

    await new Promise<void>((resolve, reject) => {
      image.onerror = () => {
        reject(new Error('The selected file could not be read as an image.'));
      };
      image.onload = () => {
        resolve();
      };
      image.src = objectUrl;
    });

    return {
      height: image.naturalHeight,
      width: image.naturalWidth,
    };
  } finally {
    revokeObjectUrl(objectUrl);
  }
}

function validateSelectedFile(
    file: File,
): Result<ValidatedArtFile, string> {
  if (!isSupportedCharacterArtMimeType(file.type)) {
    return err('Select a PNG, JPEG, or WebP image.');
  }

  if (file.size <= 0) {
    return err('The selected file is empty.');
  }

  if (file.size > MAX_CHARACTER_ART_FILE_BYTES) {
    return err('Select an image smaller than 3 MB.');
  }

  return ok({
    file,
    mimeType: file.type,
  });
}

export function createPortraitCropFileName(fileName: string): string {
  const periodIndex = fileName.lastIndexOf('.');
  const baseName = periodIndex <= 0
    ? fileName
    : fileName.slice(0, periodIndex);
  return `${baseName}-portrait-crop.png`;
}

function createObjectUrl(blob: Blob): string {
  const urlGlobal = getObjectUrlGlobal();
  return urlGlobal.createObjectURL(blob);
}

function revokeObjectUrl(objectUrl: string): void {
  const urlGlobal = getObjectUrlGlobal();
  urlGlobal.revokeObjectURL(objectUrl);
}

function getObjectUrlGlobal(): {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(objectUrl: string): void;
} {
  const urlConstructor = globalThis.URL as typeof URL & {
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (objectUrl: string) => void;
  };
  if (
    typeof urlConstructor.createObjectURL !== 'function'
    || typeof urlConstructor.revokeObjectURL !== 'function'
  ) {
    throw new Error('Object URL support is unavailable.');
  }

  return {
    createObjectURL: urlConstructor.createObjectURL.bind(urlConstructor),
    revokeObjectURL: urlConstructor.revokeObjectURL.bind(urlConstructor),
  };
}
