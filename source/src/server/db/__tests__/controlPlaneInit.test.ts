import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  isPrismaControlPlaneReady: vi.fn(),
  initPrismaControlPlane: vi.fn(),
  closePrismaControlPlane: vi.fn(),
}));

const seedMock = vi.hoisted(() => vi.fn());

vi.mock('../prismaControlPlane', () => ({
  isPrismaControlPlaneReady: prismaMocks.isPrismaControlPlaneReady,
  initPrismaControlPlane: prismaMocks.initPrismaControlPlane,
  closePrismaControlPlane: prismaMocks.closePrismaControlPlane,
}));

vi.mock('../controlPlaneDatabase', () => ({
  readControlPlaneDatabaseSettings: vi.fn(() => ({
    provider: 'postgresql',
    url: 'postgresql://postgres:postgres@localhost:5432/AppEnd',
    engine: 'prisma',
  })),
}));

vi.mock('../controlPlaneSchemaPush', () => ({
  pushControlPlaneSchema: vi.fn(() => () => undefined),
  reconcilePrismaClientAfterSchemaOperation: vi.fn(),
}));

const runtimePatchesMock = vi.hoisted(() => vi.fn());

vi.mock('../controlPlaneRuntimePatches', () => ({
  ensureControlPlaneRuntimePatches: runtimePatchesMock,
}));

vi.mock('../controlPlaneSeed', () => ({
  seedControlPlaneReferenceData: seedMock,
}));

import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../controlPlaneInit';
import { readControlPlaneDatabaseSettings } from '../controlPlaneDatabase';
import { pushControlPlaneSchema } from '../controlPlaneSchemaPush';
describe('controlPlaneInit', () => {
  beforeEach(() => {
    resetControlPlaneInitState();
    runtimePatchesMock.mockReset();
    runtimePatchesMock.mockResolvedValue(undefined);
    prismaMocks.isPrismaControlPlaneReady.mockReset();
    prismaMocks.initPrismaControlPlane.mockReset();
    prismaMocks.closePrismaControlPlane.mockReset();
    prismaMocks.closePrismaControlPlane.mockResolvedValue(undefined);
    seedMock.mockReset();
    seedMock.mockResolvedValue(undefined);
    prismaMocks.initPrismaControlPlane.mockResolvedValue({
      client: {},
      provider: 'postgresql',
    });
  });

  it('initializes Prisma before control plane init when the client is not ready', async () => {
    prismaMocks.isPrismaControlPlaneReady
      .mockReturnValueOnce(false)
      .mockReturnValue(true);

    await ensureControlPlaneInitialized('/tmp/settings.json', { pushSchema: false });

    expect(prismaMocks.initPrismaControlPlane).toHaveBeenCalledWith('/tmp/settings.json');
    expect(seedMock).toHaveBeenCalledTimes(1);
  });

  it('drops a stale init promise after Prisma was torn down', async () => {
    prismaMocks.isPrismaControlPlaneReady.mockReturnValue(true);

    await ensureControlPlaneInitialized('/tmp/settings.json', { pushSchema: false });
    expect(seedMock).toHaveBeenCalledTimes(1);

    resetControlPlaneInitState();
    prismaMocks.isPrismaControlPlaneReady
      .mockReturnValueOnce(false)
      .mockReturnValue(true);

    await ensureControlPlaneInitialized('/tmp/settings.json', { pushSchema: false });

    expect(prismaMocks.initPrismaControlPlane).toHaveBeenCalledTimes(1);
    expect(seedMock).toHaveBeenCalledTimes(2);
  });

  it('applies runtime patches before seeding', async () => {
    prismaMocks.isPrismaControlPlaneReady.mockReturnValue(true);

    await ensureControlPlaneInitialized('/tmp/settings.json', { pushSchema: false });

    expect(runtimePatchesMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'postgresql' }),
      { force: false },
    );
  });

  it('closes Prisma before sqlite schema push and reopens afterwards', async () => {
    vi.mocked(readControlPlaneDatabaseSettings).mockReturnValueOnce({
      provider: 'sqlite',
      url: 'file:C:/tmp/appendo-control.db',
      engine: 'prisma',
    });
    prismaMocks.isPrismaControlPlaneReady.mockReturnValue(true);

    await ensureControlPlaneInitialized('/tmp/settings.json', { pushSchema: true });

    expect(prismaMocks.closePrismaControlPlane).toHaveBeenCalledTimes(1);
    expect(pushControlPlaneSchema).toHaveBeenCalledWith({
      provider: 'sqlite',
      url: 'file:C:/tmp/appendo-control.db',
      engine: 'prisma',
    });
    expect(prismaMocks.initPrismaControlPlane).toHaveBeenCalledWith('/tmp/settings.json');
  });
});
