import type { QuerySurfacesDocument, QueryPresetDefinition } from '../../../shared/api/contracts/data-api';
import type { WhereGroupNode, WhereNode } from '../../../shared/ui/where-builder/whereBuilderModel';
import {
  resolveCmsEditorialStatusIds,
  type CmsEditorialStatusIds,
} from '../cms/cmsEditorialStatusIds';

const CMS_STATUS_SHORT_NAMES = new Set(['published', 'draft', 'in_review']);

const isWhereGroup = (node: unknown): node is WhereGroupNode => (
  Boolean(node && typeof node === 'object' && (node as WhereGroupNode).kind === 'group')
);

const isWhereCondition = (node: unknown): node is WhereGroupNode['children'][number] & {
  kind: 'condition';
  field: string;
  value: string;
} => (
  Boolean(node && typeof node === 'object' && (node as { kind?: string }).kind === 'condition')
);

const mapStatusField = (field: string): string => (
  field === 'status_code' ? 'statusCode' : field
);

const resolveStatusLiteral = (
  value: string,
  statusIds: CmsEditorialStatusIds,
): string | null => {
  const trimmed = value.trim();
  if (!CMS_STATUS_SHORT_NAMES.has(trimmed)) {
    return null;
  }
  if (trimmed === 'published') {
    return statusIds.published;
  }
  if (trimmed === 'draft') {
    return statusIds.draft;
  }
  if (trimmed === 'in_review') {
    return statusIds.inReview;
  }
  return null;
};

const rewriteWhereNode = (
  node: WhereNode,
  statusIds: CmsEditorialStatusIds,
): WhereNode => {
  if (isWhereGroup(node)) {
    return {
      ...node,
      children: node.children.map((child) => rewriteWhereNode(child, statusIds)),
    };
  }
  if (!isWhereCondition(node)) {
    return node;
  }
  const field = mapStatusField(node.field);
  const resolvedValue = resolveStatusLiteral(node.value, statusIds);
  if (field === node.field && !resolvedValue) {
    return node;
  }
  return {
    ...node,
    field,
    value: resolvedValue ?? node.value,
  };
};

const rewritePreset = (
  preset: QueryPresetDefinition,
  statusIds: CmsEditorialStatusIds,
): QueryPresetDefinition => ({
  ...preset,
  where: rewriteWhereNode(preset.where, statusIds) as WhereGroupNode,
});

/**
 * CMS status presets store editorial short names (`published`, `draft`, …).
 * Resolve them to Base Info ids before compiling preset WHERE for list queries.
 */
export const resolveCmsContentsQuerySurfacesDocument = async (
  document: QuerySurfacesDocument | null,
): Promise<QuerySurfacesDocument | null> => {
  if (!document) {
    return null;
  }
  const statusIds = await resolveCmsEditorialStatusIds();
  if (!statusIds) {
    return document;
  }
  return {
    ...document,
    presets: document.presets.map((preset) => rewritePreset(preset, statusIds)),
  };
};
