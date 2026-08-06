import type {CharacterPortraitCropRect} from '../character-art/art-types';

export interface CropDialogResult {
  cropFile: File;
  cropRect: CharacterPortraitCropRect;
  height: number;
  width: number;
}

export interface CropLayout {
  frameSize: number;
  naturalHeight: number;
  naturalWidth: number;
}

export interface CropPresentation {
  offsetX: number;
  offsetY: number;
  zoom: number;
}
