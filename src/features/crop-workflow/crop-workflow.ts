import type {CharacterArtService} from '../character-art/art-service';
import type {
  CharacterId,
  SaveCharacterPortraitCropInput,
} from '../character-art/art-types';
import {openCropDialog} from './crop-dialog';
import {submitFileToPortraitUploadInput} from '../../platform/dndbeyond/portrait-upload-handoff';
import {ok, err, type Result} from '../../shared/result';

export interface CropWorkflowStatus {
  message: string;
  tone: 'info' | 'success';
}

export interface CharacterPortraitCropWorkflow {
  openForCharacter(
      characterId: CharacterId,
      uploadInput: HTMLInputElement,
  ): Promise<Result<CropWorkflowStatus | null, string>>;
}

export function createCharacterPortraitCropWorkflow(
    service: CharacterArtService,
    doc: Document = document,
): CharacterPortraitCropWorkflow {
  return {
    async openForCharacter(characterId, uploadInput) {
      const sourceResult = await service.loadCropSource(characterId);
      if (!sourceResult.ok) {
        return err(sourceResult.error);
      }

      const dialogResult = await openCropDialog({
        existingCropRect: sourceResult.value.portraitCropMetadata?.cropRect ?? null,
        sourceBlob: new Blob([sourceResult.value.imageData.byteBuffer], {
          type: sourceResult.value.imageData.mimeType,
        }),
        sourceFileName: sourceResult.value.metadata.fileName,
      }, doc);
      if (dialogResult === null) {
        return ok(null);
      }

      const saveInput: SaveCharacterPortraitCropInput = {
        byteBuffer: await dialogResult.cropFile.arrayBuffer(),
        byteSize: dialogResult.cropFile.size,
        characterId,
        cropRect: dialogResult.cropRect,
        fileName: dialogResult.cropFile.name,
        height: dialogResult.height,
        mimeType: dialogResult.cropFile.type as SaveCharacterPortraitCropInput['mimeType'],
        sourceArtBlobKey: sourceResult.value.metadata.blobKey,
        width: dialogResult.width,
      };
      const saveResult = await service.savePortraitCrop(saveInput);
      if (!saveResult.ok) {
        return err(saveResult.error);
      }

      try {
        submitFileToPortraitUploadInput(uploadInput, dialogResult.cropFile, doc);
        return ok({
          message: 'Portrait crop saved locally and submitted to D&D Beyond.',
          tone: 'success',
        });
      } catch {
        return ok({
          message: 'Portrait crop saved locally, but D&D Beyond did not accept it automatically.',
          tone: 'info',
        });
      }
    },
  };
}
