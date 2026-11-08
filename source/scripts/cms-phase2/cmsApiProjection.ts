import type { EdgeApiFieldEnrichment, EdgeApiOperation } from '../../src/shared/api/contracts/data-api';

const PARENT_PK = '"{{parent}}"."{{pk}}"';

const buildCmsCommentCountField = () => ({
  id: 'cms_content_comment_count',
  outputField: 'commentCount',
  kind: 'scalar_subquery' as const,
  expression: `(SELECT COUNT(*)::int FROM cms_contents AS child WHERE child.parent_content_id = ${PARENT_PK})`,
});

const buildCmsTagSummaryField = () => ({
  id: 'cms_content_tag_summary',
  outputField: 'tagSummary',
  kind: 'scalar_subquery' as const,
  expression: `(
    SELECT COALESCE(
      STRING_AGG(tag.title_en, ', ' ORDER BY tag.view_order, tag.title_en),
      ''
    )
    FROM cms_content_tags AS content_tag
    INNER JOIN base_info AS tag ON tag.id = content_tag.tag_code
    WHERE content_tag.content_id = ${PARENT_PK}
  )`,
});

const buildCmsRevisionCountField = () => ({
  id: 'cms_content_revision_count',
  outputField: 'revisionCount',
  kind: 'scalar_subquery' as const,
  expression: `(SELECT COUNT(*)::int FROM cms_content_revisions AS revision WHERE revision.content_id = ${PARENT_PK})`,
});

const buildCmsTagsRowKeyField = () => ({
  id: 'cms_tag_row_key',
  outputField: 'id',
  kind: 'scalar_subquery' as const,
  expression: `(CONCAT(CAST("{{parent}}"."content_id" AS TEXT), '|', "{{parent}}"."tag_code"))`,
});

const LANG = 'fixed:en' as const;

/** List/summary projection for CMS contents grid (Identity + Status & publish + audit). */
export const CMS_CONTENTS_SUMMARY_FIELDS = [
  'id',
  'title',
  'slug',
  'contentTypeCode',
  'languageCode',
  'statusCode',
  'publishedAt',
  'updatedAt',
  'parentContentId',
  'body',
  'authorDisplayName',
  'createdAt',
] as const;

export const CMS_CONTENTS_LIST_ENRICHMENTS: EdgeApiFieldEnrichment[] = [
  {
    id: 'cms_enrich_content_type',
    sourceField: 'contentTypeCode',
    kind: 'base_info_title',
    joinTableSource: 'base_info',
    langSource: LANG,
    attachedFields: [
      { sourceColumn: 'title', outputField: 'contentTypeCodeTitle' },
      { sourceColumn: 'ui_html', outputField: 'contentTypeCodeUiHtml' },
    ],
  },
  {
    id: 'cms_enrich_language',
    sourceField: 'languageCode',
    kind: 'base_info_title',
    joinTableSource: 'base_info',
    langSource: LANG,
    attachedFields: [
      { sourceColumn: 'title', outputField: 'languageCodeTitle' },
    ],
  },
  {
    id: 'cms_enrich_status',
    sourceField: 'statusCode',
    kind: 'base_info_title',
    joinTableSource: 'base_info',
    langSource: LANG,
    attachedFields: [
      { sourceColumn: 'title', outputField: 'statusCodeTitle' },
      { sourceColumn: 'ui_html', outputField: 'statusCodeUiHtml' },
      { sourceColumn: 'ui_color', outputField: 'statusCodeUiColor' },
    ],
  },
];

export const buildCmsContentsDetailEnrichments = (
  usersModelId: string,
): EdgeApiFieldEnrichment[] => [
    ...CMS_CONTENTS_LIST_ENRICHMENTS,
    {
      id: 'cms_enrich_body_format',
      sourceField: 'bodyFormatCode',
      kind: 'base_info_title',
      joinTableSource: 'base_info',
      langSource: LANG,
      attachedFields: [
        { sourceColumn: 'title', outputField: 'bodyFormatCodeTitle' },
      ],
    },
    {
      id: 'cms_enrich_status_updated_by',
      sourceField: 'statusCodeUpdatedBy',
      kind: 'join_lookup',
      joinTableSource: 'edge_model',
      targetModelId: usersModelId,
      targetMatchColumn: 'id',
      attachedFields: [
        { sourceColumn: 'username', outputField: 'statusCodeUpdatedByUsername' },
      ],
    },
    {
      id: 'cms_enrich_created_by',
      sourceField: 'createdBy',
      kind: 'join_lookup',
      joinTableSource: 'edge_model',
      targetModelId: usersModelId,
      targetMatchColumn: 'id',
      attachedFields: [
        { sourceColumn: 'username', outputField: 'createdByUsername' },
      ],
    },
    {
      id: 'cms_enrich_updated_by',
      sourceField: 'updatedBy',
      kind: 'join_lookup',
      joinTableSource: 'edge_model',
      targetModelId: usersModelId,
      targetMatchColumn: 'id',
      attachedFields: [
        { sourceColumn: 'username', outputField: 'updatedByUsername' },
      ],
    },
  ];

export const CMS_CONTENT_RELATIONS_SUMMARY_FIELDS = [
  'id',
  'contentIdA',
  'contentIdB',
  'note',
] as const;

export const buildCmsRelationsListEnrichments = (contentsModelId: string): EdgeApiFieldEnrichment[] => [
  {
    id: 'cms_enrich_relation_content_a',
    sourceField: 'contentIdA',
    kind: 'join_lookup',
    joinTableSource: 'edge_model',
    targetModelId: contentsModelId,
    targetMatchColumn: 'id',
    attachedFields: [
      { sourceColumn: 'title', outputField: 'contentIdATitle' },
      { sourceColumn: 'slug', outputField: 'contentIdASlug' },
    ],
  },
  {
    id: 'cms_enrich_relation_content_b',
    sourceField: 'contentIdB',
    kind: 'join_lookup',
    joinTableSource: 'edge_model',
    targetModelId: contentsModelId,
    targetMatchColumn: 'id',
    attachedFields: [
      { sourceColumn: 'title', outputField: 'contentIdBTitle' },
      { sourceColumn: 'slug', outputField: 'contentIdBSlug' },
    ],
  },
];

export const CMS_ASSETS_SUMMARY_FIELDS = [
  'id',
  'contentId',
  'fileSize',
  'fileName',
  'fileMime',
  'sortOrder',
  'sha256',
  'createdAt',
  'updatedAt',
] as const;

export const patchCmsListOperation = (
  operation: EdgeApiOperation,
  input: {
    summaryFields: readonly string[];
    enrichments: EdgeApiFieldEnrichment[];
  },
): EdgeApiOperation => {
  if (operation.kind !== 'list' || operation.method !== 'GET') {
    return operation;
  }

  return {
    ...operation,
    fields: {
      ...operation.fields,
      read: [...input.summaryFields],
    },
    query: {
      allowFilter: operation.query?.allowFilter ?? true,
      allowSort: operation.query?.allowSort ?? true,
      maxPageSize: operation.query?.maxPageSize ?? 100,
      defaultPageSize: operation.query?.defaultPageSize ?? 50,
      allowLangParam: operation.query?.allowLangParam,
      includes: operation.query?.includes,
      views: {
        ...(operation.query?.views ?? {}),
        summary: [...input.summaryFields],
        detail: operation.fields?.read,
      },
    },
    enrichments: input.enrichments,
  };
};

/** Apply CMS list/detail projection while keeping editable content fields writable. */
export const patchCmsContentsOperation = (
  operation: EdgeApiOperation,
  usersModelId: string,
): EdgeApiOperation => {
  const projected = patchCmsListOperation(operation, {
    summaryFields: CMS_CONTENTS_SUMMARY_FIELDS,
    enrichments: CMS_CONTENTS_LIST_ENRICHMENTS,
  });
  const commentCount = buildCmsCommentCountField();
  const tagSummary = buildCmsTagSummaryField();
  const revisionCount = buildCmsRevisionCountField();
  if (projected.kind === 'getOne' && projected.method === 'GET') {
    return {
      ...projected,
      enrichments: buildCmsContentsDetailEnrichments(usersModelId),
      computedFields: [
        ...(projected.computedFields ?? []).filter((field) => !['commentCount', 'tagSummary', 'revisionCount'].includes(field.outputField)),
        commentCount,
        tagSummary,
        revisionCount,
      ],
    };
  }
  if (projected.kind === 'list' && projected.method === 'GET') {
    return {
      ...projected,
      computedFields: [
        ...(projected.computedFields ?? []).filter((field) => !['commentCount', 'tagSummary'].includes(field.outputField)),
        commentCount,
        tagSummary,
      ],
    };
  }
  return projected;
};

export const patchCmsRelationsOperation = (
  operation: EdgeApiOperation,
  contentsModelId: string,
): EdgeApiOperation => {
  if (operation.kind !== 'list' || operation.method !== 'GET') {
    return operation;
  }

  return {
    ...operation,
    fields: {
      ...operation.fields,
      read: [...CMS_CONTENT_RELATIONS_SUMMARY_FIELDS],
    },
    enrichments: buildCmsRelationsListEnrichments(contentsModelId),
  };
};

export const CMS_ASSETS_BINARY_PREVIEW = {
  mimeField: 'fileMime',
  xsField: 'fileXs',
  outputField: 'filePreviewUrl',
  stripFields: ['file', 'fileXs'],
} as const;

/** Keep BYTEA payloads out of asset collection responses; derive thumbnails server-side. */
export const patchCmsAssetsOperation = (operation: EdgeApiOperation): EdgeApiOperation => {
  if (operation.kind === 'create' || operation.kind === 'update' || operation.kind === 'patch') {
    return {
      ...operation,
      fields: {
        ...operation.fields,
        read: [...CMS_ASSETS_SUMMARY_FIELDS],
      },
    };
  }
  if (operation.kind === 'list' && operation.method === 'GET') {
    return {
      ...operation,
      fields: {
        ...operation.fields,
        read: [...CMS_ASSETS_SUMMARY_FIELDS],
      },
      binaryPreview: CMS_ASSETS_BINARY_PREVIEW,
    };
  }
  return operation;
};

/**
 * Junction table `cms_content_tags` is all-PK — default Data API write lists are empty.
 * Also expose a list title + composite `id` (`contentId|tagCode`) for Designer delete URLs.
 */
export const CMS_TAGS_SUMMARY_FIELDS = ['contentId', 'tagCode', 'tagCodeTitle', 'id'] as const;

export const CMS_TAGS_LIST_ENRICHMENTS: EdgeApiFieldEnrichment[] = [
  {
    id: 'cms_enrich_tag_code',
    sourceField: 'tagCode',
    kind: 'base_info_title',
    joinTableSource: 'base_info',
    langSource: LANG,
    attachedFields: [
      { sourceColumn: 'title', outputField: 'tagCodeTitle' },
    ],
  },
];

export const patchCmsTagsOperation = (
  operation: EdgeApiOperation,
): EdgeApiOperation => {
  const rowKeyField = buildCmsTagsRowKeyField();
  if (operation.kind === 'create' || operation.kind === 'update' || operation.kind === 'patch') {
    return {
      ...operation,
      fields: {
        ...operation.fields,
        read: ['contentId', 'tagCode'],
        write: ['contentId', 'tagCode'],
        required: ['contentId', 'tagCode'],
      },
    };
  }

  if (operation.kind === 'list' && operation.method === 'GET') {
    return {
      ...operation,
      fields: {
        ...operation.fields,
        read: [...CMS_TAGS_SUMMARY_FIELDS],
      },
      enrichments: CMS_TAGS_LIST_ENRICHMENTS,
      computedFields: [
        ...(operation.computedFields ?? []).filter((field) => field.id !== rowKeyField.id),
        rowKeyField,
      ],
    };
  }

  if (operation.kind === 'getOne' && operation.method === 'GET') {
    return {
      ...operation,
      fields: {
        ...operation.fields,
        read: [...CMS_TAGS_SUMMARY_FIELDS],
      },
      enrichments: CMS_TAGS_LIST_ENRICHMENTS,
      computedFields: [
        ...(operation.computedFields ?? []).filter((field) => field.id !== rowKeyField.id),
        rowKeyField,
      ],
    };
  }

  return operation;
};
