import type { DesignerBindingDefinitions, LovDefinition } from '../../src/domain/component-designer/types';
import type { DesignerState } from '../../src/domain/component-designer/types';
import type { CmsResolvedIds } from './cmsIds';

export const CMS_BASE_INFO_LOV_IDS = {
  statuses: 'cmsStatuses',
  contentTypes: 'cmsContentTypes',
  languages: 'cmsLanguages',
  bodyFormats: 'cmsBodyFormats',
  commentPolicies: 'cmsCommentPolicies',
} as const;

export type CmsBaseInfoCategoryIds = Pick<
  CmsResolvedIds['categoryIds'],
  'Statuses' | 'Content Types' | 'Languages' | 'Body Formats' | 'Comment Policies'
>;

export const CMS_SELECT_LOV_BY_COLUMN: Record<string, string> = {
  statusCode: CMS_BASE_INFO_LOV_IDS.statuses,
  contentTypeCode: CMS_BASE_INFO_LOV_IDS.contentTypes,
  languageCode: CMS_BASE_INFO_LOV_IDS.languages,
  bodyFormatCode: CMS_BASE_INFO_LOV_IDS.bodyFormats,
  commentsPolicyCode: CMS_BASE_INFO_LOV_IDS.commentPolicies,
  commentsBodyFormatCode: CMS_BASE_INFO_LOV_IDS.bodyFormats,
};

export const buildCmsBaseInfoCategoryEndpoint = (
  categoryId: string,
  lang = 'en',
): string => (
  `/api/base-info/options?root=${encodeURIComponent(categoryId)}&lang=${encodeURIComponent(lang)}`
);

export const buildCmsBaseInfoLovs = (
  categoryIds: CmsBaseInfoCategoryIds,
): Record<string, LovDefinition> => ({
  [CMS_BASE_INFO_LOV_IDS.statuses]: {
    id: CMS_BASE_INFO_LOV_IDS.statuses,
    name: 'Statuses',
    endpoint: buildCmsBaseInfoCategoryEndpoint(categoryIds.Statuses),
    displayValue: 'label',
    returnValue: 'id',
  },
  [CMS_BASE_INFO_LOV_IDS.contentTypes]: {
    id: CMS_BASE_INFO_LOV_IDS.contentTypes,
    name: 'Content Types',
    endpoint: buildCmsBaseInfoCategoryEndpoint(categoryIds['Content Types']),
    displayValue: 'label',
    returnValue: 'id',
  },
  [CMS_BASE_INFO_LOV_IDS.languages]: {
    id: CMS_BASE_INFO_LOV_IDS.languages,
    name: 'Languages',
    endpoint: buildCmsBaseInfoCategoryEndpoint(categoryIds.Languages),
    displayValue: 'label',
    returnValue: 'id',
  },
  [CMS_BASE_INFO_LOV_IDS.bodyFormats]: {
    id: CMS_BASE_INFO_LOV_IDS.bodyFormats,
    name: 'Body Formats',
    endpoint: buildCmsBaseInfoCategoryEndpoint(categoryIds['Body Formats']),
    displayValue: 'label',
    returnValue: 'id',
  },
  [CMS_BASE_INFO_LOV_IDS.commentPolicies]: {
    id: CMS_BASE_INFO_LOV_IDS.commentPolicies,
    name: 'Comment Policies',
    endpoint: buildCmsBaseInfoCategoryEndpoint(categoryIds['Comment Policies']),
    displayValue: 'label',
    returnValue: 'id',
  },
});

export const mergeCmsBaseInfoLovs = (
  bindingDefinitions: DesignerBindingDefinitions,
  categoryIds: CmsBaseInfoCategoryIds,
): DesignerBindingDefinitions => ({
  ...bindingDefinitions,
  lovs: {
    ...bindingDefinitions.lovs,
    ...buildCmsBaseInfoLovs(categoryIds),
  },
});

export const mergeCmsBaseInfoLovsIntoState = (
  state: DesignerState,
  categoryIds: CmsBaseInfoCategoryIds,
): DesignerState => ({
  ...state,
  bindingDefinitions: mergeCmsBaseInfoLovs(state.bindingDefinitions, categoryIds),
});
