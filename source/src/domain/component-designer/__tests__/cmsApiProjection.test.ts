import { describe, expect, it } from 'vitest';
import {
  CMS_ASSETS_BINARY_PREVIEW,
  CMS_CONTENTS_SUMMARY_FIELDS,
  patchCmsAssetsOperation,
  patchCmsContentsOperation,
  patchCmsTagsOperation,
} from '../../../../scripts/cms-phase2/cmsApiProjection';
import type { EdgeApiOperation } from '../../../shared/api/contracts/data-api';

const USERS_MODEL_ID = 'base-users-model';

const baseListOperation = (overrides: Partial<EdgeApiOperation> = {}): EdgeApiOperation => ({
  kind: 'list',
  method: 'GET',
  path: '/api/cms/contents',
  fields: {
    read: ['id', 'title', 'slug', 'body', 'summary', 'seoTitle'],
    write: ['title', 'summary', 'body', 'slug', 'seoTitle'],
    required: ['title'],
  },
  query: {
    maxPageSize: 100,
    defaultPageSize: 50,
    views: {},
  },
  ...overrides,
});

const baseGetOneOperation = (overrides: Partial<EdgeApiOperation> = {}): EdgeApiOperation => ({
  kind: 'getOne',
  method: 'GET',
  path: '/api/cms/contents/:id',
  fields: {
    read: ['id', 'title', 'slug', 'body', 'summary', 'seoTitle'],
    write: ['title', 'summary', 'body', 'slug', 'seoTitle'],
    required: ['title'],
  },
  ...overrides,
});

describe('cmsApiProjection save/restore contracts', () => {
  it('projects list summary fields without stripping writable body fields', () => {
    const projected = patchCmsContentsOperation(baseListOperation(), USERS_MODEL_ID);
    expect(projected.kind).toBe('list');
    expect(projected.query?.views?.summary).toEqual([...CMS_CONTENTS_SUMMARY_FIELDS]);
    expect(projected.fields?.write).toEqual(expect.arrayContaining(['title', 'summary', 'body']));
  });

  it('adds revision and tag computed fields on detail reads', () => {
    const projected = patchCmsContentsOperation(baseGetOneOperation(), USERS_MODEL_ID);
    expect(projected.kind).toBe('getOne');
    const outputFields = (projected.computedFields ?? []).map((field) => field.outputField);
    expect(outputFields).toEqual(expect.arrayContaining(['commentCount', 'tagSummary', 'revisionCount']));
  });

  it('enriches detail audit actor ids with database usernames', () => {
    const projected = patchCmsContentsOperation(baseGetOneOperation(), USERS_MODEL_ID);
    const usernameFields = (projected.enrichments ?? [])
      .filter((enrichment) => enrichment.kind === 'join_lookup')
      .flatMap((enrichment) => enrichment.attachedFields.map((field) => field.outputField));

    expect(usernameFields).toEqual(expect.arrayContaining([
      'statusCodeUpdatedByUsername',
      'createdByUsername',
      'updatedByUsername',
    ]));
  });

  it('strips binary asset payloads from list responses', () => {
    const projected = patchCmsAssetsOperation({
      kind: 'list',
      method: 'GET',
      path: '/api/cms/assets',
      fields: { read: ['id', 'file', 'fileXs', 'fileMime'] },
    });
    expect(projected.binaryPreview).toEqual(CMS_ASSETS_BINARY_PREVIEW);
    expect(projected.fields?.read).not.toEqual(expect.arrayContaining(['file', 'fileXs']));
  });

  it('keeps binary fields writable but excludes them from asset update responses', () => {
    const projected = patchCmsAssetsOperation({
      kind: 'update',
      method: 'PUT',
      path: '/api/cms/assets/:id',
      fields: {
        read: ['id', 'file', 'fileXs', 'fileMime'],
        write: ['file', 'fileXs', 'sortOrder'],
      },
    });
    expect(projected.fields?.read).not.toEqual(expect.arrayContaining(['file', 'fileXs']));
    expect(projected.fields?.write).toEqual(expect.arrayContaining(['file', 'fileXs', 'sortOrder']));
  });

  it('keeps tag junction writes limited to contentId and tagCode', () => {
    const projected = patchCmsTagsOperation({
      kind: 'create',
      method: 'POST',
      path: '/api/cms/tags',
      fields: { read: [], write: [], required: [] },
    });
    expect(projected.fields?.write).toEqual(['contentId', 'tagCode']);
    expect(projected.fields?.required).toEqual(['contentId', 'tagCode']);
  });

  it('exposes composite row keys for tag delete URLs', () => {
    const projected = patchCmsTagsOperation({
      kind: 'list',
      method: 'GET',
      path: '/api/cms/tags',
      fields: { read: ['contentId', 'tagCode'] },
    });
    const rowKey = (projected.computedFields ?? []).find((field) => field.outputField === 'id');
    expect(rowKey?.expression).toContain('CONCAT');
    expect(projected.fields?.read).toEqual(expect.arrayContaining(['tagCodeTitle', 'id']));
  });

  it('stores postgres computed SQL so runtime can compile per live dialect', () => {
    const projected = patchCmsContentsOperation(baseListOperation(), USERS_MODEL_ID);
    const commentCount = (projected.computedFields ?? []).find((field) => field.outputField === 'commentCount');
    const tagSummary = (projected.computedFields ?? []).find((field) => field.outputField === 'tagSummary');
    expect(commentCount?.expression).toContain('"{{parent}}"."{{pk}}"');
    expect(commentCount?.expression).toContain('::int');
    expect(tagSummary?.expression).toContain('STRING_AGG(tag.title_en, \', \' ORDER BY');
    expect(tagSummary?.expression).not.toContain('WITHIN GROUP');
  });
});
