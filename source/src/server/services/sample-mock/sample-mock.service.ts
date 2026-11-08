import type { Request } from 'express';
import {
  approveSampleMockRecord,
  createSampleMockRecord,
  createSampleMockRecordsBulk,
  deleteSampleMockRecord,
  getSampleMockRecordById,
  listSampleMockLookups,
  listSampleMockRecords,
  lockSampleMockRecord,
  patchSampleMockRecord,
  resolveSampleMockActorId,
} from '../../domain/sample-mock/sampleMockRepository';
import { parseSampleMockIncludes } from '../../../shared/api/contracts/sample-mock/records';
import { SAMPLE_MOCK_CHANGE_REASON } from '../../../shared/api/contracts/record-events';
import { resolveFunctionChangeReason } from '../../domain/record-events/functionChangeReason';

const actorUsername = (req: Request): string => {
  const email = req.auth?.email?.trim();
  if (email?.includes('@')) {
    return email.split('@')[0] || 'admin';
  }
  return email || 'admin';
};

export class SampleMockService {
  async actorId(req: Request): Promise<bigint> {
    return resolveSampleMockActorId(actorUsername(req));
  }

  list(includeRaw: unknown) {
    return listSampleMockRecords(parseSampleMockIncludes(includeRaw));
  }

  lookups() {
    return listSampleMockLookups();
  }

  getById(id: string, includeRaw: unknown) {
    return getSampleMockRecordById(id, parseSampleMockIncludes(includeRaw));
  }

  async create(req: Request, body: Record<string, unknown>) {
    return createSampleMockRecord({
      code: body.code,
      title: body.title,
      subtitle: body.subtitle,
      website: body.website,
      status: body.status,
      owner: body.owner,
      parentTitle: body.parentTitle,
      parentId: body.parentId,
      city: body.city,
      detailNote: body.detailNote,
      tags: body.tags,
      comments: body.comments,
      latitude: body.latitude,
      longitude: body.longitude,
      active: body.active,
      actorId: await this.actorId(req),
    });
  }

  async createBulk(req: Request, body: Record<string, unknown>) {
    return createSampleMockRecordsBulk({
      title: typeof body.title === 'string' ? body.title : undefined,
      actorId: await this.actorId(req),
    });
  }

  async patch(req: Request, id: string, body: Record<string, unknown>) {
    const policy = await resolveFunctionChangeReason(
      'PATCH',
      '/api/sample-mock/records/:id',
      SAMPLE_MOCK_CHANGE_REASON,
    );
    return patchSampleMockRecord({
      id,
      title: body.title,
      subtitle: body.subtitle,
      website: body.website,
      status: body.status,
      owner: body.owner,
      parentTitle: body.parentTitle,
      parentId: body.parentId,
      city: body.city,
      detailNote: body.detailNote,
      tags: body.tags,
      comments: body.comments,
      latitude: body.latitude,
      longitude: body.longitude,
      active: body.active,
      actorId: await this.actorId(req),
      changeReasonPolicy: policy,
    });
  }

  async approve(req: Request, id: string, body: Record<string, unknown>) {
    const policy = await resolveFunctionChangeReason(
      'PATCH',
      '/api/sample-mock/records/:id/approve',
      SAMPLE_MOCK_CHANGE_REASON,
    );
    return approveSampleMockRecord({
      id,
      status: body.status,
      actorId: await this.actorId(req),
      changeReasonPolicy: policy,
    });
  }

  async lock(req: Request, id: string, body: Record<string, unknown>) {
    const policy = await resolveFunctionChangeReason(
      'PATCH',
      '/api/sample-mock/records/:id/lock',
      SAMPLE_MOCK_CHANGE_REASON,
    );
    return lockSampleMockRecord({
      id,
      locked: body.locked,
      actorId: await this.actorId(req),
      changeReasonPolicy: policy,
    });
  }

  async delete(_req: Request, id: string) {
    const policy = await resolveFunctionChangeReason(
      'DELETE',
      '/api/sample-mock/records/:id',
      SAMPLE_MOCK_CHANGE_REASON,
    );
    return deleteSampleMockRecord(id, policy);
  }
}
