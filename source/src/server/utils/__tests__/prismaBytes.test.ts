import { describe, expect, it } from 'vitest';

import type { Prisma } from '../../../generated/prisma/client';
import {
  applyProfileImageBytesToCreateInput,
  applyProfileImageBytesToUpdateInput,
  toPrismaBytes,
} from '../prismaBytes';

describe('toPrismaBytes', () => {
  it('returns Uint8Array for Buffer input', () => {
    const buffer = Buffer.from('hello');
    const bytes = toPrismaBytes(buffer);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(bytes!)).toEqual(buffer);
  });

  it('passes through null and undefined', () => {
    expect(toPrismaBytes(null)).toBeNull();
    expect(toPrismaBytes(undefined)).toBeUndefined();
  });
});

describe('applyProfileImageBytesToCreateInput', () => {
  it('omits image columns when no binary payload is provided', () => {
    const data: Prisma.BaseUserProfileCreateInput = { userId: 1n };
    applyProfileImageBytesToCreateInput(data, { profileImageSize: null }, null, null);

    expect(data.profileImageBody).toBeUndefined();
    expect(data.profileImageBodyXs).toBeUndefined();
    expect(data.profileImageSize).toBeUndefined();
  });

  it('writes Uint8Array payloads for full and thumbnail images', () => {
    const data: Prisma.BaseUserProfileCreateInput = { userId: 1n };
    const full = Buffer.from('full-image');
    const thumb = Buffer.from('thumb');

    applyProfileImageBytesToCreateInput(data, { profileImageSize: 11 }, full, thumb);

    expect(data.profileImageBody).toBeInstanceOf(Uint8Array);
    expect(data.profileImageBodyXs).toBeInstanceOf(Uint8Array);
    expect(data.profileImageSize).toBe(11);
  });
});

describe('applyProfileImageBytesToUpdateInput', () => {
  it('uses Prisma bytes set operations for SQL Server-safe updates', () => {
    const data: Prisma.BaseUserProfileUpdateInput = {};
    const full = Buffer.from('full-image');

    applyProfileImageBytesToUpdateInput(
      data,
      {
        hasProfileImageBodyInput: true,
        hasProfileImageBodyXsInput: true,
        profileImageSize: full.length,
      },
      full,
      null,
    );

    expect(data.profileImageBody).toEqual({ set: expect.any(Uint8Array) });
    expect(data.profileImageBodyXs).toEqual({ set: null });
    expect(data.profileImageSize).toBe(full.length);
  });
});
