import type {CharacterArtService} from '../character-art/art-service';
import type {
  CharacterId,
  CharacterPortraitCropRect,
  SaveCharacterArtInput,
  SaveCharacterPortraitCropInput,
} from '../character-art/art-types';
import type {CropDialogResult} from './crop-types';
import {openCropDialog} from './crop-dialog';
import {submitFileToPortraitUploadInput} from '../../platform/dndbeyond/portrait-upload-handoff';
import {ok, err, type Result} from '../../shared/result';

export interface CropWorkflowSourceOverride {
  existingCropRect: CharacterPortraitCropRect | null;
  selectedFile: File;
}

export interface CropWorkflowStatus {
  cropResult: CropDialogResult;
  message: string;
  savedLocally: boolean;
  tone: 'info' | 'success';
}

export interface CharacterPortraitCropWorkflow {
  openForCharacter(
      characterId: CharacterId,
      uploadInput: HTMLInputElement,
      sourceOverride: CropWorkflowSourceOverride | null,
  ): Promise<Result<CropWorkflowStatus | null, string>>;
}

export function createCharacterPortraitCropWorkflow(
    service: CharacterArtService,
    doc: Document = document,
): CharacterPortraitCropWorkflow {
  return {
    async openForCharacter(characterId, uploadInput, sourceOverride) {
      const storedSourceResult = sourceOverride === null
        ? await service.loadCropSource(characterId)
        : null;
      if (storedSourceResult !== null && !storedSourceResult.ok) {
        return err(storedSourceResult.error);
      }

      let dialogResult: CropDialogResult | null;
      if (storedSourceResult !== null) {
        dialogResult = await openStoredArtCropDialog(storedSourceResult.value, doc);
      } else {
        dialogResult = await openPendingFileCropDialog(sourceOverride!, doc);
      }
      if (dialogResult === null) {
        return ok(null);
      }

      if (storedSourceResult !== null) {
        const saveInput: SaveCharacterPortraitCropInput = {
          byteBuffer: await readBlobAsArrayBuffer(dialogResult.cropFile, doc),
          byteSize: dialogResult.cropFile.size,
          characterId,
          cropRect: dialogResult.cropRect,
          fileName: dialogResult.cropFile.name,
          height: dialogResult.height,
          mimeType: dialogResult.cropFile.type as SaveCharacterPortraitCropInput['mimeType'],
          sourceArtBlobKey: storedSourceResult.value.metadata.blobKey,
          width: dialogResult.width,
        };
        const saveResult = await service.savePortraitCrop(saveInput);
        if (!saveResult.ok) {
          return err(saveResult.error);
        }
      }

      try {
        submitFileToPortraitUploadInput(uploadInput, dialogResult.cropFile, doc);
        return ok({
          cropResult: dialogResult,
          message: storedSourceResult === null
            ? 'Portrait crop is ready in D&D Beyond. Click Change Portrait to finish.'
            : 'Portrait crop saved locally and submitted to D&D Beyond.',
          savedLocally: sourceOverride === null,
          tone: 'success',
        });
      } catch {
        return ok({
          cropResult: dialogResult,
          message: sourceOverride === null
            ? 'Portrait crop saved locally, but D&D Beyond did not accept it automatically.'
            : 'Portrait crop is ready, but D&D Beyond did not accept it automatically.',
          savedLocally: sourceOverride === null,
          tone: 'info',
        });
      }
    },
  };
}

async function openStoredArtCropDialog(
    sourceImage: {
      imageData: {
        byteBuffer: ArrayBuffer;
        mimeType: SaveCharacterArtInput['mimeType'];
      };
      metadata: {
        fileName: string;
      };
      portraitCropMetadata: {
        cropRect: CharacterPortraitCropRect;
      } | null;
    },
    doc: Document,
): Promise<CropDialogResult | null> {
  return openCropDialog({
    existingCropRect: sourceImage.portraitCropMetadata?.cropRect ?? null,
    sourceBlob: new Blob([sourceImage.imageData.byteBuffer], {
      type: sourceImage.imageData.mimeType,
    }),
    sourceFileName: sourceImage.metadata.fileName,
  }, doc);
}

async function openPendingFileCropDialog(
    sourceOverride: CropWorkflowSourceOverride,
    doc: Document,
): Promise<CropDialogResult | null> {
  return openCropDialog({
    existingCropRect: sourceOverride.existingCropRect,
    sourceBlob: sourceOverride.selectedFile,
    sourceFileName: sourceOverride.selectedFile.name,
  }, doc);
}

async function readBlobAsArrayBuffer(
    blob: Blob,
    doc: Document,
): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  const FileReaderConstructor = doc.defaultView?.FileReader ?? globalThis.FileReader;
  if (typeof FileReaderConstructor !== 'function') {
    throw new Error('Blob reading support is unavailable.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReaderConstructor();
    reader.onerror = () => {
      reject(new Error('The crop file could not be read.'));
    };
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error('The crop file could not be read.'));
    };
    reader.readAsArrayBuffer(blob);
  });
}
