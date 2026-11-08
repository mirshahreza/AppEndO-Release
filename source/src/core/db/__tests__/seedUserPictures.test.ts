import { describe, expect, it } from 'vitest';

import { buildPlaceholderSeedPicture, loadSeedPicture } from '../seedUserPictures';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe('seedUserPictures', () => {
  it('builds a PNG placeholder when seed files are not on disk', () => {
    const picture = loadSeedPicture(`missing-seed-${Date.now()}.png`);

    expect(picture.mime).toBe('image/png');
    expect(picture.body.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(picture.bodyXs.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(picture.size).toBe(picture.body.length);
    expect(picture.body.length).toBeGreaterThan(32);
  });

  it('varies placeholder color by path so demo users are distinguishable', () => {
    const admin = buildPlaceholderSeedPicture('admin.png');
    const portrait = buildPlaceholderSeedPicture('portraits/male-01.jpg');
    expect(admin.body.equals(portrait.body)).toBe(false);
  });
});
