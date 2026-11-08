import { describe, expect, it } from 'vitest';
import {
  buildCmsContentsEditorDraft,
  buildCmsContentsListDraft,
  buildCmsSettingsDraft,
  buildCmsVocabularyPage,
  cmsBodyFormatVisibleCondition,
} from '../../../../scripts/cms-phase3/cmsDesignerScaffold';
import { eventBindingKeyForEvent } from '../bindingEngine';
import { collectRegionFormFieldMappings, REGION_DATA_SOURCE_BINDING_KEY } from '../bindingRegionEngine';
import { DESIGNER_MODAL_FORM_BODY_CONTENT_CLASS } from '../designerModalChrome';
import { evaluateDesignerCondition } from '../visibilityConditionEngine';
import type { DesignerBindingDefinition, DesignerDocument, DesignerNode } from '../types';
import {
  buildCmsTestBaseInfoCategoryIds,
  buildCmsTestFilterOptions,
  CMS_TEST_IDS,
} from './fixtures/cmsSaveRestoreFixtures';
import { CMS_BASE_INFO_LOV_IDS } from '../../../../scripts/cms-phase3/cmsBaseInfoLovs';
import { findModalNodeId, findNodeByProp } from './fixtures/cmsSaveRestoreTestHarness';

const filterOptions = buildCmsTestFilterOptions();
const baseInfoCategoryIds = buildCmsTestBaseInfoCategoryIds();

const bundles = {
  settings: buildCmsSettingsDraft({
    commentPolicies: filterOptions.commentPolicies,
    commentBodyFormats: filterOptions.bodyFormats,
    baseInfoCategoryIds,
  }),
  contentsList: buildCmsContentsListDraft({
    filterOptions,
    statusIds: {
      archived: CMS_TEST_IDS.status.archived,
      draft: CMS_TEST_IDS.status.draft,
    },
    baseInfoCategoryIds,
  }),
  contentsEditor: buildCmsContentsEditorDraft({
    bodyFormatIds: CMS_TEST_IDS.bodyFormat,
    statusIds: {
      published: CMS_TEST_IDS.status.published,
      archived: CMS_TEST_IDS.status.archived,
      draft: CMS_TEST_IDS.status.draft,
    },
    commentStatusIds: {
      approved: CMS_TEST_IDS.status.approved,
      rejected: CMS_TEST_IDS.status.rejected,
      spam: CMS_TEST_IDS.status.spam,
      pending: CMS_TEST_IDS.status.pending,
    },
    commentTypeCode: CMS_TEST_IDS.contentType.comment,
    filterOptions,
    contentOptions: filterOptions.contents,
    baseInfoCategoryIds,
  }),
  vocabContentTags: buildCmsVocabularyPage({
    pageName: 'cms-vocab-content-tags',
    title: 'Content Tags',
    categoryId: CMS_TEST_IDS.vocabCategory.contentTags,
    settingsSectionId: 'content-tags',
  }),
};

const findNodes = (
  document: DesignerDocument,
  predicate: (node: DesignerNode, nodeId: string) => boolean,
): string[] => Object.entries(document.nodes)
  .filter(([, node]) => node)
  .filter(([nodeId, node]) => predicate(node, nodeId))
  .map(([nodeId]) => nodeId);

const collectRegionSubmitLabels = (document: DesignerDocument): string[] => {
  const labels: string[] = [];
  for (const node of Object.values(document.nodes)) {
    const hasSubmit = Object.values(node.binding).some((definition) => definition?.regionSubmit === true);
    if (hasSubmit && typeof node.props.text === 'string') {
      labels.push(node.props.text);
    }
  }
  return labels.sort();
};

const collectBindingDefinitions = (document: DesignerDocument): DesignerBindingDefinition[] => (
  Object.values(document.nodes).flatMap((node) => Object.values(node.binding).filter(Boolean) as DesignerBindingDefinition[])
);

const collectModalRegionId = (
  document: DesignerDocument,
  modalTitle: string,
): string | null => {
  const modalId = findModalNodeId(document, modalTitle);
  if (!modalId) {
    return null;
  }
  const modal = document.nodes[modalId]!;
  return modal.children.find(
    (childId) => document.nodes[childId]?.props._designerPaletteItemId === 'html.form',
  ) ?? null;
};

const findModalFormBodyInModal = (
  document: DesignerDocument,
  modalTitle: string,
) => {
  const modalId = findModalNodeId(document, modalTitle);
  if (!modalId) {
    return null;
  }
  const modal = document.nodes[modalId]!;
  const formId = modal.children.find(
    (childId) => document.nodes[childId]?.props._designerPaletteItemId === 'html.form',
  );
  const bodyId = formId ? document.nodes[formId]?.children[0] : undefined;
  return bodyId ? document.nodes[bodyId] ?? null : null;
};

const findBaseInfoRecordFormInModal = (
  document: DesignerDocument,
  modalTitle: string,
) => {
  const modalId = findModalNodeId(document, modalTitle);
  if (!modalId) {
    return null;
  }
  const modal = document.nodes[modalId]!;
  const formId = modal.children.find(
    (childId) => document.nodes[childId]?.props._designerPaletteItemId === 'html.form',
  );
  const bodyId = formId ? document.nodes[formId]?.children[0] : undefined;
  if (!bodyId) {
    return null;
  }
  const body = document.nodes[bodyId];
  if (!body) {
    return null;
  }
  return body.children
    .map((childId) => document.nodes[childId])
    .find((node) => node?.props._designerPaletteItemId === 'form.base-info-record') ?? null;
};

describe('CMS designer scaffold save/restore contracts', () => {
  it('registers expected CMS data sources on every surface', () => {
    expect(Object.keys(bundles.settings.bindingDefinitions.dataSources)).toEqual(['cmsSettings']);
    expect(Object.keys(bundles.contentsList.bindingDefinitions.dataSources).sort()).toEqual(
      ['cmsContents', 'cmsContentsCreate', 'cmsRevisions'].sort(),
    );
    expect(Object.keys(bundles.contentsEditor.bindingDefinitions.dataSources).sort()).toEqual(
      ['cmsContentComments', 'cmsContentAssets', 'cmsContentRelations', 'cmsContentTags', 'cmsContents'].sort(),
    );
    expect(Object.keys(bundles.vocabContentTags.bindingDefinitions.dataSources)).toEqual(['vocabItems']);
  });

  it('sets deterministic defaults for the create-content identity fields', () => {
    const controlByColumn = (column: string) => Object.values(bundles.contentsList.document.nodes).find(
      (node) => Object.values(node.binding).some(
        (definition) => definition?.sourceType === 'regionColumn' && definition.column === column,
      ),
    );

    expect(controlByColumn('title')?.props._designerPaletteItemId).toBe('heroui.input-text');
    expect(controlByColumn('contentTypeCode')?.props._designerPaletteItemId).toBe('heroui.radio-group');
    expect(controlByColumn('contentTypeCode')?.props.label).toBe('Content type');
    expect(controlByColumn('contentTypeCode')?.props.className).toContain('designer-choice-button-group');
    expect(controlByColumn('contentTypeCode')?.props.sectionTone).toBe('indigo');
    expect(controlByColumn('contentTypeCode')?.props.sectionDivided).toBe(true);
    expect(controlByColumn('contentTypeCode')?.props.isSelected).toBe(CMS_TEST_IDS.contentType.article);
    expect(controlByColumn('languageCode')?.props.label).toBe('Language');
    expect(controlByColumn('languageCode')?.props.sectionTone).toBe('violet');
    expect(controlByColumn('bodyFormatCode')?.props.label).toBe('Content Format');
    expect(controlByColumn('bodyFormatCode')?.props.sectionTone).toBe('cyan');
    expect(controlByColumn('bodyFormatCode')?.props.isSelected).toBe(CMS_TEST_IDS.bodyFormat.html);
    expect(controlByColumn('statusCode')?.props.className).toContain('hidden');
    expect(controlByColumn('statusCode')?.props.label).toBe('');
    expect(controlByColumn('statusCode')?.props.isSelected).toBe(CMS_TEST_IDS.status.draft);
    expect(JSON.parse(String(controlByColumn('languageCode')?.props.selectedKeyByLanguage))).toMatchObject({
      en: CMS_TEST_IDS.language.en,
    });
  });

  it('pins settings singleton detail hydration to /api/cms/settings/1', () => {
    const settingsDs = bundles.settings.bindingDefinitions.dataSources.cmsSettings;
    expect(settingsDs?.operations?.detail?.endpoint).toBe('/api/cms/settings/1');
    expect(settingsDs?.operations?.update?.endpoint).toBe('/api/cms/settings/:id');
    expect(findNodeByProp(bundles.settings.document, 'text', 'Save settings')).not.toBeNull();
  });

  it('wires the content editor main form submit surface', () => {
    const formId = findNodeByProp(bundles.contentsEditor.document, 'id', 'cms-content-editor-form');
    expect(formId).not.toBeNull();

    const formNode = bundles.contentsEditor.document.nodes[formId!]!;
    const submitBinding = formNode.binding[eventBindingKeyForEvent('onSubmit')];
    expect(submitBinding?.regionSubmit).toBe(true);
    expect(formNode.binding[REGION_DATA_SOURCE_BINDING_KEY]?.dataSourceRef).toBe('cmsContents');

    const saveButtonId = findNodeByProp(bundles.contentsEditor.document, 'text', 'Save');
    const saveButton = bundles.contentsEditor.document.nodes[saveButtonId!]!;
    expect(saveButton?.props.form).toBe('cms-content-editor-form');
    expect(saveButton?.props.type).toBe('submit');
  });

  it('uses the full HTML toolbar in the content editor', () => {
    const htmlEditorId = findNodeByProp(bundles.contentsEditor.document, 'label', 'Body (html)');
    expect(htmlEditorId).not.toBeNull();

    const htmlEditor = bundles.contentsEditor.document.nodes[htmlEditorId!]!;
    expect(htmlEditor.props._designerPaletteItemId).toBe('form.html-editor');
    expect(htmlEditor.props.enableCodeBlock).toBe(true);
    expect(htmlEditor.props.enableTextDirection).toBe(true);
  });

  it('uses the Base Components markdown editor with its standard toolbar', () => {
    const markdownEditorId = findNodeByProp(bundles.contentsEditor.document, 'label', 'Body (markdown)');
    expect(markdownEditorId).not.toBeNull();

    const markdownEditor = bundles.contentsEditor.document.nodes[markdownEditorId!]!;
    expect(markdownEditor.props._designerPaletteItemId).toBe('form.markdown-editor');
    expect(markdownEditor.props).toMatchObject({
      showToolbar: true,
      enableHeading: true,
      enableLink: true,
      enableCodeBlock: true,
      enableTextDirection: true,
      enableImage: false,
      enableTable: false,
    });
  });

  it('matches summary editors to rich body formats at double height', () => {
    const controlsForColumn = (column: string) => Object.values(bundles.contentsEditor.document.nodes)
      .filter((node) => Object.values(node.binding).some(
        (definition) => definition?.sourceType === 'regionColumn' && definition.column === column,
      ));

    const summaries = controlsForColumn('summary');
    const summaryMarkdown = summaries.find(
      (node) => node.props._designerPaletteItemId === 'form.markdown-editor',
    );
    const summaryHtml = summaries.find(
      (node) => node.props._designerPaletteItemId === 'form.html-editor',
    );
    const bodyMarkdown = findNodeByProp(bundles.contentsEditor.document, 'label', 'Body (markdown)');
    const bodyHtml = findNodeByProp(bundles.contentsEditor.document, 'label', 'Body (html)');

    expect(summaries.some((node) => node.props._designerPaletteItemId === 'heroui.textarea')).toBe(true);
    expect(summaryMarkdown?.props).toMatchObject({
      editorHeight: 220,
      showToolbar: true,
      enableHeading: true,
      enableLink: true,
      enableCodeBlock: true,
      enableTextDirection: true,
      enableImage: false,
      enableTable: false,
    });
    expect(summaryMarkdown?.layout.visibleCondition).toContain(CMS_TEST_IDS.bodyFormat.markdown);
    expect(summaryMarkdown?.layout.visibleCondition).toContain("data.bodyFormatCodeTitle === 'Markdown'");
    expect(summaryHtml?.props).toMatchObject({
      editorHeight: 220,
      enableCodeBlock: true,
      enableTextDirection: true,
    });
    expect(summaryHtml?.layout.visibleCondition).toContain(CMS_TEST_IDS.bodyFormat.html);
    expect(summaryHtml?.layout.visibleCondition).toContain("data.bodyFormatCodeTitle === 'HTML'");
    const summaryPlain = summaries.find(
      (node) => node.props._designerPaletteItemId === 'heroui.textarea',
    );
    expect(summaryPlain?.layout.visibleCondition).toContain(`!== '${CMS_TEST_IDS.bodyFormat.markdown}'`);
    expect(summaryPlain?.layout.visibleCondition).toContain(`!== '${CMS_TEST_IDS.bodyFormat.html}'`);
    expect(bundles.contentsEditor.document.nodes[bodyMarkdown!]!.props.editorHeight).toBe(220);
    expect(bundles.contentsEditor.document.nodes[bodyHtml!]!.props.editorHeight).toBe(220);
  });

  it('keeps a summary/body editor visible when baked body-format ids are stale', () => {
    const ids = CMS_TEST_IDS.bodyFormat;
    const htmlByTitle = { bodyFormatCode: '102.003.003', bodyFormatCodeTitle: 'HTML' };
    expect(evaluateDesignerCondition({}, htmlByTitle, {}, cmsBodyFormatVisibleCondition('html', ids))).toBe(true);
    expect(evaluateDesignerCondition({}, htmlByTitle, {}, cmsBodyFormatVisibleCondition('plain', ids))).toBe(false);

    const unknownFormat = { bodyFormatCode: 'stale-body-format-id' };
    expect(evaluateDesignerCondition({}, unknownFormat, {}, cmsBodyFormatVisibleCondition('plain', ids))).toBe(true);
    expect(evaluateDesignerCondition({}, unknownFormat, {}, cmsBodyFormatVisibleCondition('html', ids))).toBe(false);
    expect(evaluateDesignerCondition({}, unknownFormat, {}, cmsBodyFormatVisibleCondition('markdown', ids))).toBe(false);
  });

  it('shows the latest status, update date, and actor in Last State', () => {
    const document = bundles.contentsEditor.document;
    const headingId = findNodeByProp(document, 'text', 'Last State');
    expect(headingId).not.toBeNull();
    expect(findNodeByProp(bundles.contentsEditor.document, 'text', 'Publication')).toBeNull();

    const headerId = document.nodes[headingId!]!.parentId!;
    const sectionId = document.nodes[headerId]!.parentId!;
    const descendantIds: string[] = [];
    const visit = (nodeId: string) => {
      for (const childId of document.nodes[nodeId]?.children ?? []) {
        descendantIds.push(childId);
        visit(childId);
      }
    };
    visit(sectionId);

    const sectionNodes = descendantIds.map((nodeId) => document.nodes[nodeId]!);
    const labels = sectionNodes.map((node) => node.props.text).filter(Boolean);
    const columns = sectionNodes.flatMap((node) => Object.values(node.binding))
      .filter((definition) => definition?.sourceType === 'regionColumn')
      .map((definition) => definition!.column);

    expect(labels).toEqual(expect.arrayContaining(['Status', 'Updated at', 'Updated by', 'Change']));
    expect(labels).not.toContain('Published at');
    expect(columns).toEqual(expect.arrayContaining([
      'statusCodeTitle',
      'statusCodeUpdatedAt',
      'statusCodeUpdatedByUsername',
    ]));
    expect(columns).not.toEqual(expect.arrayContaining(['publishedAt']));

    const changeStatusIds = findNodes(
      document,
      (node) => node.props['aria-label'] === 'Change status',
    );
    expect(changeStatusIds).toHaveLength(1);
    expect(document.nodes[headerId]!.children).toContain(changeStatusIds[0]);
    expect(document.nodes[changeStatusIds[0]!]!.binding[eventBindingKeyForEvent('onClick')]?.trueActions)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'showHide', showHideEffect: 'show' }),
      ]));

    const statusDisplayIds = findNodes(
      document,
      (node) => node.props.contentStatusDisplay === true,
    );
    expect(statusDisplayIds).toHaveLength(1);
    expect(descendantIds).toContain(statusDisplayIds[0]);
    expect(document.nodes[statusDisplayIds[0]!]!.props).toMatchObject({
      contentStatusTrigger: true,
      icon: 'CircleDot',
    });
    expect(document.nodes[statusDisplayIds[0]!]!.binding[eventBindingKeyForEvent('onClick')])
      .toBeUndefined();
  });

  it('shows database usernames in the Audit trail actor fields', () => {
    const document = bundles.contentsEditor.document;
    const headingId = findNodeByProp(document, 'text', 'Audit trail');
    expect(headingId).not.toBeNull();

    const headerId = document.nodes[headingId!]!.parentId!;
    const sectionId = document.nodes[headerId]!.parentId!;
    const columns: string[] = [];
    const visit = (nodeId: string) => {
      for (const childId of document.nodes[nodeId]?.children ?? []) {
        for (const definition of Object.values(document.nodes[childId]?.binding ?? {})) {
          if (definition?.sourceType === 'regionColumn' && definition.column) {
            columns.push(definition.column);
          }
        }
        visit(childId);
      }
    };
    visit(sectionId);

    expect(columns).toEqual(expect.arrayContaining(['createdByUsername', 'updatedByUsername']));
    expect(columns).not.toEqual(expect.arrayContaining(['createdBy', 'updatedBy']));
  });

  it('hosts related-content create as a maximized picker (search header + Select list)', () => {
    const relatedList = Object.values(bundles.contentsEditor.document.nodes).find(
      (node) => node.props._designerPaletteItemId === 'form.related-contents-list',
    );
    expect(relatedList?.props.relatedContentsCreateModalNodeId).toEqual(expect.any(String));
    expect(relatedList?.props.relatedContentsOptionsDataSourceRef).toBe('cmsContents');
    expect(relatedList?.props.relatedContentsExcludeContentTypeCode).toBe(CMS_TEST_IDS.contentType.comment);
    expect(typeof relatedList?.props.relatedContentsContentOptions).toBe('string');

    const createModalId = String(relatedList?.props.relatedContentsCreateModalNodeId ?? '');
    const createModal = bundles.contentsEditor.document.nodes[createModalId];
    expect(createModal?.props).toMatchObject({
      size: 'maximized',
      relatedContentPickerHost: true,
      title: 'Create relation',
    });

    const hasContentIdBAutocomplete = Object.values(bundles.contentsEditor.document.nodes).some(
      (node) => node.props._designerPaletteItemId === 'heroui.autocomplete'
        && Object.values(node.binding).some(
          (definition) => definition?.sourceType === 'regionColumn' && definition.column === 'contentIdB',
        ),
    );
    expect(hasContentIdBAutocomplete).toBe(false);
  });

  it('puts the asset upload action in the content editor header', () => {
    const uploadButtonId = findNodeByProp(bundles.contentsEditor.document, 'text', 'Upload');
    expect(uploadButtonId).not.toBeNull();
    const uploadButton = bundles.contentsEditor.document.nodes[uploadButtonId!]!;
    expect(uploadButton.props.pickFileCreate).toBe(true);
    expect(JSON.parse(String(uploadButton.props.pickFileCreateConfig))).toMatchObject({
      dataSourceRef: 'cmsContentAssets',
      contentIdStorePath: 'routeParams.id',
      multiple: true,
      refreshList: true,
    });
    expect(String(uploadButton.props.className)).toContain('h-8');
  });

  it('shows truncated title and record id in the content editor header', () => {
    const titleNode = Object.values(bundles.contentsEditor.document.nodes).find(
      (node) => node.props._designerPaletteItemId === 'html.text'
        && Object.values(node.binding).some(
          (definition) => definition?.sourceType === 'regionColumn' && definition.column === 'title',
        )
        && String(node.props.className).includes('truncate'),
    );
    expect(titleNode).toBeTruthy();
    expect(String(titleNode?.props.className)).toContain('font-semibold');

    const idNode = Object.values(bundles.contentsEditor.document.nodes).find(
      (node) => node.props._designerPaletteItemId === 'html.text'
        && Object.values(node.binding).some(
          (definition) => definition?.sourceType === 'regionColumn' && definition.column === 'id',
        )
        && String(node.props.className).includes('font-mono'),
    );
    expect(idNode).toBeTruthy();

    const backButtonId = Object.values(bundles.contentsEditor.document.nodes).find(
      (node) => node.props.workspaceBack === true,
    )?.id;
    expect(backButtonId).toBeTruthy();
    const identityBarId = bundles.contentsEditor.document.nodes[backButtonId!]!.parentId;
    expect(identityBarId).toBeTruthy();
    const identityBar = bundles.contentsEditor.document.nodes[identityBarId!]!;
    const titleParent = titleNode?.parentId;
    expect(titleParent).toBeTruthy();
    expect(identityBar.children).toContain(backButtonId);
    expect(identityBar.children).toContain(titleParent);
    // Identity cluster sits between back and header actions (SEO has ml-auto).
    const backIndex = identityBar.children.indexOf(backButtonId!);
    const clusterIndex = identityBar.children.indexOf(titleParent!);
    expect(clusterIndex).toBe(backIndex + 1);
  });

  it('declares every planned editor overlay save action', () => {
    const submitLabels = collectRegionSubmitLabels(bundles.contentsEditor.document);
    expect(submitLabels).toEqual(expect.arrayContaining([
      'Save identity',
      'Save SEO',
      'Save note',
      'Save preferences',
    ]));
  });

  it('uses the operator note textarea as the full unlabeled dialog body', () => {
    const operatorNote = Object.values(bundles.contentsEditor.document.nodes).find(
      (node) => node.props._designerPaletteItemId === 'heroui.textarea'
        && Object.values(node.binding).some(
          (definition) => definition?.sourceType === 'regionColumn' && definition.column === 'operatorNote',
        ),
    );

    expect(operatorNote?.props).toMatchObject({
      label: '',
      placeholder: 'Operator note',
      minRows: 7,
      className: 'min-h-40 w-full',
    });
    const operatorNotePreview = Object.values(bundles.contentsEditor.document.nodes).find(
      (node) => node.props._designerPaletteItemId === 'heroui.button-outline'
        && Object.values(node.binding).some(
          (definition) => definition?.sourceType === 'regionColumn' && definition.column === 'operatorNote',
        ),
    );
    expect(operatorNotePreview?.props.directionalText).toBe(true);
    const operatorNoteModalId = findModalNodeId(
      bundles.contentsEditor.document,
      'Edit operator note',
    );
    expect(bundles.contentsEditor.document.nodes[operatorNoteModalId!]?.props.size).toBe('xl');
  });

  it('keeps body format locked outside create flows', () => {
    const editorBindings = collectBindingDefinitions(bundles.contentsEditor.document);
    const bodyFormatBindings = editorBindings.filter((definition) => definition.column === 'bodyFormatCode');
    expect(bodyFormatBindings).toHaveLength(0);

    const createBindings = collectBindingDefinitions(bundles.contentsList.document)
      .filter((definition) => definition.column === 'bodyFormatCode');
    expect(createBindings.length).toBeGreaterThan(0);
  });

  it('exposes revision history read surface on the contents list', () => {
    const revisionsDs = bundles.contentsList.bindingDefinitions.dataSources.cmsRevisions;
    expect(revisionsDs?.endpoint).toBe('/api/cms/revisions');
    expect(revisionsDs?.operations?.list?.endpoint).toBe('/api/cms/revisions');
    const revisionModalId = findNodeByProp(bundles.contentsList.document, 'title', 'Revision history');
    expect(revisionModalId).not.toBeNull();
    expect(bundles.contentsList.document.nodes[revisionModalId!]!.props.size).toBe('maximized');

    const hostId = bundles.contentsList.document.nodes[revisionModalId!]!.children[0];
    const host = bundles.contentsList.document.nodes[hostId!]!;
    expect(host.props.className).toBe(
      'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white',
    );
    const revisionGrid = bundles.contentsList.document.nodes[host.children[0]!]!;
    expect(revisionGrid.props).toMatchObject({
      className: 'flex h-full min-h-0 w-full flex-1 flex-col',
      showPagingFooter: true,
    });
    expect(revisionGrid.props.edgeAlignPagingFooter).not.toBe(true);
  });

  it('exposes footer sort controls on the contents list grid', () => {
    const grid = Object.values(bundles.contentsList.document.nodes).find((node) => {
      if (node.props._designerPaletteItemId !== 'heroui.app-table-grid') {
        return false;
      }
      const toolbarConfig = JSON.parse(String(node.props.toolbarConfig ?? '{}')) as {
        fieldFilters?: Array<{ id?: string }>;
      };
      return toolbarConfig.fieldFilters?.some((filter) => filter.id === 'statusCode');
    });
    expect(grid).toBeTruthy();
    expect(grid!.props.showSortControls).toBe(true);
    expect(grid!.props.showPagingFooter).not.toBe(false);
    const sortOptions = JSON.parse(String(grid!.props.sortOptions ?? '[]')) as Array<{ value: string }>;
    expect(sortOptions.map((option) => option.value)).toEqual(
      expect.arrayContaining(['title', 'statusCode', 'updatedAt']),
    );
    expect(sortOptions.map((option) => option.value)).not.toContain('publishedAt');

    const columns = JSON.parse(String(grid!.props.columns ?? '[]')) as Array<{
      key?: string;
      kind?: string;
      label?: string;
      width?: string;
      headerClassName?: string;
      cellClassName?: string;
      layoutPinned?: string;
      cellFields?: { dateField?: string; secondaryDateField?: string };
    }>;
    expect(columns.map((column) => column.key)).not.toContain('publishedAt');
    const statusColumn = columns.find((column) => column.key === 'statusCode');
    expect(statusColumn?.cellFields?.dateField).toBe('statusCodeUpdatedAt');
    expect(statusColumn).toMatchObject({
      width: '120px',
    });
    expect(columns.find((column) => column.key === 'contentTypeCode')).toMatchObject({
      width: '120px',
    });
    expect(columns.find((column) => column.key === 'languageCode')).toMatchObject({
      width: '120px',
    });
    const timestampsColumn = columns.find((column) => column.key === 'updatedAt');
    expect(timestampsColumn).toMatchObject({
      label: 'Timeline',
      width: '120px',
      cellKind: 'audit',
      cellFields: {
        dateField: 'createdAt',
        secondaryDateField: 'updatedAt',
      },
    });
    const actionGroup = columns.find((column) => column.kind === 'action-group');
    expect(actionGroup).toMatchObject({ width: '75px' });
    expect(actionGroup?.layoutPinned).toBeUndefined();
  });

  it('exposes a content type toolbar filter on the contents list including Comment', () => {
    const grid = Object.values(bundles.contentsList.document.nodes).find((node) => {
      if (node.props._designerPaletteItemId !== 'heroui.app-table-grid') {
        return false;
      }
      const toolbarConfig = JSON.parse(String(node.props.toolbarConfig ?? '{}'));
      return toolbarConfig.fieldFilters?.some((filter: { id?: string }) => filter.id === 'contentTypeCode');
    });
    expect(grid).toBeTruthy();
    const toolbarConfig = JSON.parse(String(grid!.props.toolbarConfig));
    expect(toolbarConfig.fieldFilters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'contentTypeCode',
        label: 'Content type',
        multiple: true,
        apiParam: 'filter[contentTypeCode][in]',
        options: expect.arrayContaining([
          { value: CMS_TEST_IDS.contentType.article, label: 'Article' },
          { value: CMS_TEST_IDS.contentType.page, label: 'Page' },
          { value: CMS_TEST_IDS.contentType.comment, label: 'Comment' },
        ]),
      }),
      expect.objectContaining({
        id: 'statusCode',
        multiple: true,
        apiParam: 'filter[statusCode][in]',
      }),
      expect.objectContaining({
        id: 'languageCode',
        multiple: true,
        apiParam: 'filter[languageCode][in]',
      }),
    ]));

    const listBinding = grid!.binding.gridListResource as { queryParams?: Record<string, string> };
    expect(listBinding.queryParams?.['filter[contentTypeCode][in]']).toBe('gridToolbar.filters.contentTypeCode');
    expect(listBinding.queryParams?.['filter[contentTypeCode][eq]']).toBeUndefined();
    expect(grid!.props.defaultSortDirection).toBe('desc');
  });

  it('maps vocabulary CRUD to Base Info endpoints', () => {
    const vocabDs = bundles.vocabContentTags.bindingDefinitions.dataSources.vocabItems;
    expect(vocabDs?.operations?.create?.endpoint).toBe('/api/base-info');
    expect(vocabDs?.operations?.update?.endpoint).toBe('/api/base-info/:id');
    expect(vocabDs?.operations?.list?.endpoint).toContain('/api/base-info/children');
    expect(findModalNodeId(bundles.vocabContentTags.document, 'Create Content Tag')).toBeTruthy();
  });

  it('uses shared Base Info record form on vocabulary create/edit modals', () => {
    const createBody = findModalFormBodyInModal(bundles.vocabContentTags.document, 'Create Content Tag');
    const editBody = findModalFormBodyInModal(bundles.vocabContentTags.document, 'Edit Content Tag');
    expect(createBody?.props.className).toBe(DESIGNER_MODAL_FORM_BODY_CONTENT_CLASS);
    expect(editBody?.props.className).toBe(DESIGNER_MODAL_FORM_BODY_CONTENT_CLASS);

    const createForm = findBaseInfoRecordFormInModal(bundles.vocabContentTags.document, 'Create Content Tag');
    const editForm = findBaseInfoRecordFormInModal(bundles.vocabContentTags.document, 'Edit Content Tag');
    expect(createForm?.props.baseInfoRecordFixedParentId).toBe(CMS_TEST_IDS.vocabCategory.contentTags);
    expect(editForm?.props.baseInfoRecordFixedParentId).toBe(CMS_TEST_IDS.vocabCategory.contentTags);
    expect(createForm?.props.baseInfoRecordParentLabel).toBe('Content Tags');
    expect(editForm?.props.baseInfoRecordParentLabel).toBe('Content Tags');
    expect(createForm?.props.baseInfoRecordDataSourceRef).toBe('vocabItems');

    const createRegionId = collectModalRegionId(bundles.vocabContentTags.document, 'Create Content Tag');
    expect(createRegionId).not.toBeNull();
    const fieldMappings = collectRegionFormFieldMappings(
      bundles.vocabContentTags.document,
      createRegionId!,
      bundles.vocabContentTags.bindingDefinitions,
    );
    expect(fieldMappings.map((mapping) => mapping.column)).toEqual(
      expect.arrayContaining(['title', 'isActive', 'uiHtml', 'parentId', 'childDigits']),
    );
  });

  it('registers comment moderation mutations on the content editor comments dialog', () => {
    const commentsDs = bundles.contentsEditor.bindingDefinitions.dataSources.cmsContentComments;
    expect(commentsDs?.endpoint).toBe('/api/cms/contents');
    expect(commentsDs?.operations?.update?.endpoint).toBe('/api/cms/contents/:id');
    expect(commentsDs?.operations?.delete?.endpoint).toBe('/api/cms/contents/:id');
  });

  it('keeps the content comments dialog flush and free of redundant copy', () => {
    const commentsModalId = findModalNodeId(bundles.contentsEditor.document, 'Comments');
    expect(commentsModalId).not.toBeNull();
    expect(bundles.contentsEditor.document.nodes[commentsModalId!]!.props.size).toBe('maximized');

    const hostId = bundles.contentsEditor.document.nodes[commentsModalId!]!.children[0];
    const host = bundles.contentsEditor.document.nodes[hostId!]!;
    expect(host.props.className).toBe(
      'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white',
    );
    expect(host.children).toHaveLength(1);
    const commentsGrid = bundles.contentsEditor.document.nodes[host.children[0]!]!;
    expect(commentsGrid.props).toMatchObject({
      className: 'flex h-full min-h-0 w-full flex-1 flex-col',
      showPagingFooter: true,
    });
    const listBinding = Object.values(commentsGrid.binding).find(
      (definition) => definition?.queryParams?.['filter[parentContentId][eq]'],
    );
    expect(listBinding?.queryParams?.['filter[parentContentId][eq]']).toBe('routeParams.id');
    expect(listBinding?.queryParams?.['filter[contentTypeCode][eq]']).toBe(`static:${CMS_TEST_IDS.contentType.comment}`);
    expect(JSON.parse(String(commentsGrid.props.toolbarConfig))).toMatchObject({
      refresh: { enabled: true },
    });
    expect(findNodeByProp(
      bundles.contentsEditor.document,
      'text',
      'Submitted comments for this content. Moderate them here or open the full Comments page for filters.',
    )).toBeNull();
  });

  it('loads change-status picker options from base-info LOV at runtime', () => {
    const pickerNodeId = findNodeByProp(bundles.contentsEditor.document, 'contentStatusPicker', true);
    expect(pickerNodeId).not.toBeNull();
    const picker = bundles.contentsEditor.document.nodes[pickerNodeId!]!;
    expect(picker.props.contentStatusPickerLovRef).toBe(CMS_BASE_INFO_LOV_IDS.statuses);
    expect(bundles.contentsEditor.bindingDefinitions.lovs[CMS_BASE_INFO_LOV_IDS.statuses]?.endpoint)
      .toContain(baseInfoCategoryIds.Statuses);
  });
});
