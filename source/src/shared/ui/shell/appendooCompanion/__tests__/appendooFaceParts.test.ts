import { describe, expect, it } from 'vitest';
import {
  APPENDOO_DEFAULT_FACE_PARTS,
  APPENDOO_FACE_PART_IDS,
  APPENDOO_FACE_PART_META,
  isAppendooFacePartId,
  mergeAppendooFaceParts,
} from '../appendooFaceParts';

describe('appendooFaceParts', () => {
  it('keeps every part on by default and merges partial flags', () => {
    expect(APPENDOO_FACE_PART_IDS.map((id) => APPENDOO_FACE_PART_META[id].label)).toEqual([
      'Brows',
      'Eyes',
      'Mouth',
      'Blush',
      'Nose wrinkle',
      'Spark',
      'Sleep marks',
    ]);
    expect(APPENDOO_DEFAULT_FACE_PARTS.blush).toBe(true);
    expect(mergeAppendooFaceParts({ blush: false, brows: false })).toMatchObject({
      brows: false,
      eyes: true,
      mouth: true,
      blush: false,
      nose: true,
      spark: true,
      zzz: true,
    });
    expect(isAppendooFacePartId('blush')).toBe(true);
    expect(isAppendooFacePartId('hat')).toBe(false);
  });
});
