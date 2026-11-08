/**
 * @vitest-environment jsdom
 */
import { vi } from 'vitest';

vi.mock('../../../shared/ui/ai-field-assist/useEuaCapability', () => ({
  useEuaStatusSnapshot: () => ({
    aiEnabled: false,
    capabilities: {
      'eua.singleLineAssist': false,
      'eua.contextSuggest': false,
      'eua.diffUndo': false,
      'eua.multiLineAssist': false,
      'eua.imageAssist': false,
    },
  }),
  useEuaFieldAssistReady: () => false,
  useEuaDefaultModelId: () => undefined,
  useIsEuaCapabilityEnabled: () => false,
  useEuaAssistAvailable: () => false,
}));

import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { __resetHydrationCacheForTests } from '../designerPreviewHydrationCache';
import { REGION_DATA_SOURCE_BINDING_KEY } from '../bindingRegionEngine';
import { eventBindingKeyForEvent } from '../bindingEngine';
import {
  buildCmsContentsEditorDraft,
  buildCmsContentsListDraft,
  buildCmsSettingsDraft,
  buildCmsVocabularyPage,
} from '../../../../scripts/cms-phase3/cmsDesignerScaffold';
import {
  buildCmsTestBaseInfoCategoryIds,
  buildCmsTestFilterOptions,
  buildCmsTestSettingsRecord,
  CMS_TEST_IDS,
  createCmsFetchMock,
} from './fixtures/cmsSaveRestoreFixtures';
import {
  buildCmsPreviewHarness,
  findModalNodeId,
  findNodeByProp,
} from './fixtures/cmsSaveRestoreTestHarness';

const filterOptions = buildCmsTestFilterOptions();
const baseInfoCategoryIds = buildCmsTestBaseInfoCategoryIds();

const settingsBundle = buildCmsSettingsDraft({
  commentPolicies: filterOptions.commentPolicies,
  commentBodyFormats: filterOptions.bodyFormats,
  baseInfoCategoryIds,
});

const editorBundle = buildCmsContentsEditorDraft({
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
});

const contentsListBundle = buildCmsContentsListDraft({
  filterOptions,
  statusIds: {
    archived: CMS_TEST_IDS.status.archived,
    draft: CMS_TEST_IDS.status.draft,
  },
  baseInfoCategoryIds,
});

const vocabBundle = buildCmsVocabularyPage({
  pageName: 'cms-vocab-content-tags',
  title: 'Content Tags',
  categoryId: CMS_TEST_IDS.vocabCategory.contentTags,
  settingsSectionId: 'content-tags',
});

const CmsPreviewHarness: React.FC<{
  bundle: typeof settingsBundle;
  options?: {
    routeParams?: Record<string, string>;
    openModalTitle?: string;
    content?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
}> = ({ bundle, options = {} }) => {
  const harness = React.useMemo(() => buildCmsPreviewHarness(bundle, options), [bundle, options]);
  const [designerStore, setDesignerStore] = React.useState(harness.designerStore);

  React.useEffect(() => {
    setDesignerStore(harness.designerStore);
  }, [harness.designerStore]);

  return (
    <CultureProvider cultureId="us">
      <>
        {renderDesignerDocumentPreview(bundle.document, {
          bindingDefinitions: bundle.bindingDefinitions,
          interactive: true,
          designerStore,
          hydrationData: harness.hydrationData,
          onStoreChange: (next) => {
            setDesignerStore((current) => (
              typeof next === 'function' ? next(current) : next
            ));
          },
        })}
      </>
    </CultureProvider>
  );
};

const renderCmsPreview = (
  bundle: typeof settingsBundle,
  options: {
    routeParams?: Record<string, string>;
    openModalTitle?: string;
    content?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  } = {},
) => render(<CmsPreviewHarness bundle={bundle} options={options} />);

const waitForMutation = async (
  mutations: Array<{ method: string; url: string; body: unknown }>,
  matcher: (mutation: { method: string; url: string; body: unknown }) => boolean,
) => {
  await waitFor(() => {
    expect(mutations.some(matcher)).toBe(true);
  }, { timeout: 5000 });
};

const pickSelectOption = async (label: string | RegExp, optionLabel: string, scope: HTMLElement = document.body) => {
  const trigger = within(scope).getByRole('button', { name: label });
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole('option', { name: optionLabel }));
};

const pickComboboxValue = (scope: HTMLElement, name: string | RegExp, value: string) => {
  const nativeSelect = within(scope).queryByRole('combobox', { name });
  if (nativeSelect instanceof HTMLSelectElement) {
    fireEvent.change(nativeSelect, { target: { value } });
    return;
  }

  const trigger = within(scope).getAllByRole('button').find((item) => {
    const ariaLabel = item.getAttribute('aria-label') ?? '';
    return typeof name === 'string' ? ariaLabel === name : name.test(ariaLabel);
  });
  if (!trigger) {
    throw new Error(`Select trigger "${String(name)}" was not rendered.`);
  }
  const hiddenSelect = trigger.closest('[data-slot="select"]')?.querySelector('select');
  if (hiddenSelect instanceof HTMLSelectElement) {
    fireEvent.change(hiddenSelect, { target: { value } });
    return;
  }
  fireEvent.click(trigger);
  const option = screen.getAllByRole('option').find((item) => (
    item.getAttribute('data-key') === value
    || item.getAttribute('data-value') === value
    || item.id === value
  ));
  if (!option) {
    throw new Error(`Select option "${value}" was not rendered.`);
  }
  fireEvent.click(option);
};

describe('CMS save/restore forms (Designer preview)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetHydrationCacheForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads settings, edits comment defaults, and PUTs the singleton record', async () => {
    const { handler, mutations } = createCmsFetchMock({
      settings: {
        commentsEnabled: false,
        commentsPolicyCode: CMS_TEST_IDS.commentPolicy.moderated,
        commentsBodyFormatCode: CMS_TEST_IDS.bodyFormat.markdown,
      },
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(settingsBundle, {
      settings: {
        commentsEnabled: false,
        commentsPolicyCode: CMS_TEST_IDS.commentPolicy.moderated,
        commentsBodyFormatCode: CMS_TEST_IDS.bodyFormat.markdown,
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /open comments by default/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('switch', { name: /open comments by default/i }));
    await pickSelectOption(/publishing policy/i, 'Open');
    await pickSelectOption(/body format/i, 'Plain');
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitForMutation(mutations, (mutation) => (
      mutation.method === 'PUT' && mutation.url.includes('/api/cms/settings/1')
    ));

    expect(mutations.find((mutation) => mutation.method === 'PUT')?.body).toMatchObject({
      commentsEnabled: true,
      commentsPolicyCode: CMS_TEST_IDS.commentPolicy.open,
      commentsBodyFormatCode: CMS_TEST_IDS.bodyFormat.plain,
    });
  });

  it('loads the content editor, edits main fields, and PUTs title/summary', async () => {
    const { handler, mutations } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
    });

    const titleInput = await screen.findByRole('textbox', { name: /^title$/i });
    expect((titleInput as HTMLInputElement).value).toBe('Original title');

    fireEvent.change(titleInput, { target: { value: 'Updated title' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^summary$/i }), {
      target: { value: 'Updated summary' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitForMutation(mutations, (mutation) => (
      mutation.method === 'PUT'
      && mutation.url.includes(`/api/cms/contents/${CMS_TEST_IDS.content.sample}`)
    ));

    expect(mutations.find((mutation) => mutation.method === 'PUT')?.body).toMatchObject({
      title: 'Updated title',
      summary: 'Updated summary',
    });
  });

  it('persists plain body when markdown/html editors are hidden', async () => {
    const { handler, mutations } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
    });

    fireEvent.change(await screen.findByRole('textbox', { name: /body \(plain\)/i }), {
      target: { value: 'Updated body text' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitForMutation(mutations, (mutation) => mutation.method === 'PUT');
    expect((mutations.find((mutation) => mutation.method === 'PUT')?.body as { body?: string }).body)
      .toBe('Updated body text');
  });

  it('still shows summary and body when bodyFormatCode ids are stale', async () => {
    const { handler } = createCmsFetchMock({
      content: {
        bodyFormatCode: 'stale-body-format-id',
        bodyFormatCodeTitle: 'Stale Format',
      },
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
      content: {
        bodyFormatCode: 'stale-body-format-id',
        bodyFormatCodeTitle: 'Stale Format',
      },
    });

    expect(await screen.findByRole('textbox', { name: /^summary$/i })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /body \(plain\)/i })).toBeTruthy();
    expect(screen.queryByLabelText(/body \(html\)/i)).toBeNull();
    expect(screen.queryByLabelText(/body \(markdown\)/i)).toBeNull();
  });

  it('selects html editors by bodyFormatCodeTitle when the baked id does not match', async () => {
    const originalHtml = '<p>Original HTML body</p>';
    const { handler } = createCmsFetchMock({
      content: {
        body: originalHtml,
        bodyFormatCode: 'stale-html-id',
        bodyFormatCodeTitle: 'HTML',
      },
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    const { container } = renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
      content: {
        body: originalHtml,
        bodyFormatCode: 'stale-html-id',
        bodyFormatCodeTitle: 'HTML',
      },
    });

    await waitFor(() => {
      expect(container.querySelector('[data-designer-rich-text-editor="true"]')).toBeTruthy();
    });
    expect(screen.queryByRole('textbox', { name: /body \(plain\)/i })).toBeNull();
  });

  it('submits the main content form when the HTML editor is active', async () => {
    const originalHtml = '<p>Original HTML body</p>';
    const { handler, mutations } = createCmsFetchMock({
      content: {
        body: originalHtml,
        bodyFormatCode: CMS_TEST_IDS.bodyFormat.html,
        bodyFormatCodeTitle: 'HTML',
      },
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    const { container } = renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
      content: {
        body: originalHtml,
        bodyFormatCode: CMS_TEST_IDS.bodyFormat.html,
        bodyFormatCodeTitle: 'HTML',
      },
    });

    await waitFor(() => {
      expect(container.querySelector('[data-designer-rich-text-editor="true"]')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitForMutation(mutations, (mutation) => mutation.method === 'PUT');
    expect(mutations.find((mutation) => mutation.method === 'PUT')?.body).toMatchObject({
      body: expect.stringContaining('Original HTML body'),
      summary: expect.stringContaining('Original summary'),
    });
  });

  it('shows the Base Components markdown editor with a toolbar when the format is markdown', async () => {
    const { handler } = createCmsFetchMock({
      content: {
        body: '## Hello markdown',
        summary: 'A short **summary**',
        bodyFormatCode: CMS_TEST_IDS.bodyFormat.markdown,
        bodyFormatCodeTitle: 'Markdown',
      },
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    const { container } = renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
      content: {
        body: '## Hello markdown',
        summary: 'A short **summary**',
        bodyFormatCode: CMS_TEST_IDS.bodyFormat.markdown,
        bodyFormatCodeTitle: 'Markdown',
      },
    });

    await waitFor(() => {
      expect(container.querySelectorAll('[data-designer-markdown-editor="true"]').length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('textbox', { name: /body \(plain\)/i })).toBeNull();
    expect(container.querySelector('[data-designer-rich-text-editor="true"]')).toBeTruthy();
  });

  it('saves identity overlay fields through the editor modal form', async () => {
    const { handler, mutations } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
    });

    fireEvent.click(await screen.findByRole('button', { name: /edit identity/i }));
    const dialog = await screen.findByRole('dialog', { name: /edit content identity/i });
    pickComboboxValue(dialog, 'Content Type', CMS_TEST_IDS.contentType.page);
    pickComboboxValue(dialog, 'Language', CMS_TEST_IDS.language.fa);
    fireEvent.click(within(dialog).getByRole('button', { name: /save identity/i }));

    await waitForMutation(mutations, (mutation) => (
      mutation.method === 'PUT'
      && (mutation.body as { contentTypeCode?: string }).contentTypeCode === CMS_TEST_IDS.contentType.page
    ));
  });

  it('saves SEO overlay fields through the editor modal form', async () => {
    const { handler, mutations } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
    });

    fireEvent.click(await screen.findByRole('button', { name: /edit seo details/i }));
    const dialog = await screen.findByRole('dialog', { name: /edit seo details/i });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^slug$/i }), {
      target: { value: 'updated-slug' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /seo title/i }), {
      target: { value: 'Updated SEO title' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /seo description/i }), {
      target: { value: 'Updated SEO description' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /save seo/i }));

    await waitForMutation(mutations, (mutation) => (
      mutation.method === 'PUT'
      && (mutation.body as { slug?: string }).slug === 'updated-slug'
    ));
  });

  it('saves operator note overlay fields', async () => {
    const { handler, mutations } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
    });

    fireEvent.click(await screen.findByRole('button', { name: /no operator note yet/i }));
    const dialog = await screen.findByRole('dialog', { name: /edit operator note/i });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /operator note/i }), {
      target: { value: 'Internal operator note' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /save note/i }));

    await waitForMutation(mutations, (mutation) => (
      mutation.method === 'PUT'
      && (mutation.body as { operatorNote?: string }).operatorNote === 'Internal operator note'
    ));
  });

  it('saves comment preference overlay fields', async () => {
    const { handler, mutations } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(editorBundle, {
      routeParams: { id: CMS_TEST_IDS.content.sample },
    });

    fireEvent.click(await screen.findByRole('button', { name: /comments policy/i }));
    const dialog = await screen.findByRole('dialog', { name: /content preferences/i });
    pickComboboxValue(dialog, /^comments$/i, 'true');
    pickComboboxValue(dialog, /publishing policy/i, CMS_TEST_IDS.commentPolicy.moderated);
    pickComboboxValue(dialog, /comment body format/i, CMS_TEST_IDS.bodyFormat.markdown);
    fireEvent.click(within(dialog).getByRole('button', { name: /save preferences/i }));

    await waitForMutation(mutations, (mutation) => (
      mutation.method === 'PUT'
      && (mutation.body as { commentsPolicyCode?: string }).commentsPolicyCode === CMS_TEST_IDS.commentPolicy.moderated
    ));
  });

  it('creates content through the list create modal form', async () => {
    const { handler, mutations } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(contentsListBundle, {
      openModalTitle: 'Create content',
    });

    const dialog = await screen.findByRole('dialog', { name: /create content/i });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /^title$/i }), {
      target: { value: 'New article' },
    });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Article' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: 'English' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Plain' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Draft' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /create content/i }));

    await waitForMutation(mutations, (mutation) => (
      mutation.method === 'POST' && mutation.url.includes('/api/cms/contents')
    ));

    expect(mutations.find((mutation) => mutation.method === 'POST')?.body).toMatchObject({
      title: 'New article',
      contentTypeCode: CMS_TEST_IDS.contentType.article,
      languageCode: CMS_TEST_IDS.language.en,
      bodyFormatCode: CMS_TEST_IDS.bodyFormat.plain,
      statusCode: CMS_TEST_IDS.status.draft,
    });
  });

  it('creates vocabulary rows through the Base Info modal form', async () => {
    const { handler, mutations } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);

    renderCmsPreview(vocabBundle, {
      openModalTitle: 'Create Content Tag',
    });

    const dialog = await screen.findByRole('dialog', { name: /create content tag/i });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /title \(default\)/i }), {
      target: { value: 'Breaking news' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /create content tag/i }));

    await waitForMutation(mutations, (mutation) => (
      mutation.method === 'POST' && mutation.url.includes('/api/base-info')
    ));

    expect(mutations.find((mutation) => mutation.method === 'POST')?.body).toMatchObject({
      title: 'Breaking news',
      parentId: CMS_TEST_IDS.vocabCategory.contentTags,
      isActive: true,
      childDigits: '3',
    });
  });

  it('round-trips settings save payload through a reload hydration', async () => {
    let currentSettings = buildCmsTestSettingsRecord();
    const commentsEnabledSwitchId = findNodeByProp(
      settingsBundle.document,
      'label',
      'Open comments by default',
    );
    expect(commentsEnabledSwitchId).toBeTruthy();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (method === 'GET' && url.includes('/api/cms/settings/1')) {
        return new Response(JSON.stringify({ success: true, data: [currentSettings], count: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'PUT' && url.includes('/api/cms/settings/1')) {
        currentSettings = {
          ...currentSettings,
          ...(init?.body ? JSON.parse(String(init.body)) : {}),
        };
        return new Response(JSON.stringify({ success: true, data: [currentSettings] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { rerender } = render(
      <CmsPreviewHarness bundle={settingsBundle} options={{ settings: currentSettings }} />,
    );
    const toggle = await screen.findByRole('switch', { name: /open comments by default/i });

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(currentSettings.commentsEnabled).toBe(false);
    });

    __resetHydrationCacheForTests();
    rerender(<CmsPreviewHarness key="reload" bundle={settingsBundle} options={{ settings: currentSettings }} />);

    await waitFor(() => {
      const hidden = document.querySelector(`input[name="${commentsEnabledSwitchId}"]`) as HTMLInputElement | null;
      expect(hidden?.value).toBe('false');
    });
  });
});

describe('CMS designer scaffold save/restore contracts (forms)', () => {
  it('binds the main editor form submit to region submit', () => {
    const formId = findNodeByProp(editorBundle.document, 'id', 'cms-content-editor-form');
    expect(formId).not.toBeNull();
    const formNode = editorBundle.document.nodes[formId!]!;
    const submitBinding = formNode.binding[eventBindingKeyForEvent('onSubmit')];
    expect(submitBinding?.regionSubmit).toBe(true);
    expect(formNode.binding[REGION_DATA_SOURCE_BINDING_KEY]?.dataSourceRef).toBe('cmsContents');
  });

  it('registers vocabulary create modal with Base Info POST wiring', () => {
    expect(findModalNodeId(vocabBundle.document, 'Create Content Tag')).toBeTruthy();
  });
});
