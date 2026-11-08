import { imageToJpegBase64, loadImageFile } from './fileFieldUtils';

export const PROFILE_IMAGE_ACCEPT = 'image/*';

export const PROFILE_IMAGE_OUTPUT = {
  full: { maxDimension: 1280, quality: 0.82 },
  thumb: { maxDimension: 220, quality: 0.72 },
} as const;

export type ProfileImageFieldValue = {
  hasImage?: boolean;
  mime?: string | null;
  previewBase64?: string | null;
  profileImageBody?: string | null;
  profileImageBodyXs?: string | null;
  profileImageMime?: string | null;
};

export const encodeProfileImageFieldFromFile = async (file: File): Promise<ProfileImageFieldValue> => {
  const image = await loadImageFile(file);
  return {
    profileImageBody: imageToJpegBase64(image, PROFILE_IMAGE_OUTPUT.full.maxDimension, PROFILE_IMAGE_OUTPUT.full.quality),
    profileImageBodyXs: imageToJpegBase64(image, PROFILE_IMAGE_OUTPUT.thumb.maxDimension, PROFILE_IMAGE_OUTPUT.thumb.quality),
    profileImageMime: 'image/jpeg',
  };
};
