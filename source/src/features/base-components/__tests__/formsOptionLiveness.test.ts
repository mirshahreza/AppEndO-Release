import { describe, expect, it } from 'vitest';
import {
  applyFormFieldsBooleanOption,
  resolveFormFieldsOptionLiveness,
  type FormFieldsBaseComponentsConfig,
} from '../form-fields/FormFieldsBaseComponentsWorkspace';
import {
  resolveRelationsConfigForKind,
  resolveRelationsOptionLiveness,
  type RelationsBaseComponentsConfig,
  type RelationsBaseComponentsKind,
} from '../relations/RelationsBaseComponentsWorkspace';
import {
  resolveMarkdownEditorOptionLiveness,
  type MarkdownEditorBaseComponentsConfig,
} from '../markdown-editor/MarkdownEditorBaseComponentsWorkspace';
import {
  resolveHtmlEditorOptionLiveness,
  type HtmlEditorBaseComponentsConfig,
} from '../html-editor/HtmlEditorBaseComponentsWorkspace';
import {
  applyDateTimeOption,
  resolveDateTimeOptionLiveness,
  type DateTimeBaseComponentsConfig,
} from '../date-time/DateTimeBaseComponentsWorkspace';
import {
  applyFileMediaInputOption,
  resolveFileMediaInputOptionLiveness,
  type FileMediaInputBaseComponentsConfig,
} from '../file-media-input/FileMediaInputBaseComponentsWorkspace';
import {
  applyWhereBuilderOption,
  resolveWhereBuilderOptionLiveness,
  type WhereBuilderBaseComponentsConfig,
} from '../where-builder/WhereBuilderBaseComponentsWorkspace';

const FORM_CONFIG: FormFieldsBaseComponentsConfig = {
  group: 'text',
  controlSize: 'sm',
  invalid: false,
  requiredInvalidOnMount: true,
  disabled: false,
  required: true,
  feedbackPlacement: 'overlay',
  autoDir: true,
  showHint: false,
  readOnly: false,
  prefix: '$',
  suffix: 'USD',
  optionCardFixture: 'policy',
  optionCardColumns: 2,
  optionCardDensity: 'default',
  optionCardShowIcon: true,
  optionCardShowMeta: true,
};

const RELATION_CONFIG: RelationsBaseComponentsConfig = {
  controlSize: 'sm',
  disabled: false,
  kind: 'belongsTo',
  widget: 'lookup',
  cardinality: 'single',
  limits: 'none',
  presentation: 'widget-default',
  inlineMutation: [],
  state: 'default',
};

const MARKDOWN_CONFIG: MarkdownEditorBaseComponentsConfig = {
  toolbar: 'standard',
  capabilities: ['links', 'images', 'tables', 'code'],
  fullscreen: false,
  allowFullscreen: true,
  direction: 'auto',
  state: 'default',
};

const HTML_CONFIG: HtmlEditorBaseComponentsConfig = {
  mode: 'visual',
  toolbar: 'standard',
  sourceDiagnostics: true,
  fullscreen: false,
  allowFullscreen: true,
  direction: 'auto',
  previewDevice: 'desktop',
  state: 'default',
};

const DATE_CONFIG: DateTimeBaseComponentsConfig = {
  pattern: 'date-picker',
  calendar: 'gregorian',
  locale: 'en-US',
  constraints: 'none',
  timezone: 'local',
  state: 'default',
  viewport: 'desktop',
};

const FILE_CONFIG: FileMediaInputBaseComponentsConfig = {
  preset: 'drop-zone',
  multiple: false,
  accept: 'images',
  limits: 'safe-defaults',
  preview: true,
  queueActions: 'retry,cancel,remove',
  transform: 'none',
  state: 'default',
  enableImageEditor: true,
  openEditorOnPick: false,
};

const WHERE_CONFIG: WhereBuilderBaseComponentsConfig = {
  fixture: 'nested',
  density: 'default',
  allowNestedGroups: true,
  showPreview: true,
  contextValues: true,
  allowManualNodes: true,
  showTreeLines: true,
  showGroupBoxes: true,
  allowReorder: true,
  state: 'default',
  viewport: 'desktop',
};

describe('form-fields option liveness', () => {
  it('maps every field group and control size to observable production rendering/props', () => {
    for (const group of ['text', 'choice', 'selection', 'structured', 'ai'] as const) {
      expect(resolveFormFieldsOptionLiveness({ ...FORM_CONFIG, group }).renderGroup)
        .toBe(group);
    }
    for (const controlSize of ['xs', 'sm', 'md', 'lg'] as const) {
      expect(resolveFormFieldsOptionLiveness({ ...FORM_CONFIG, controlSize }).inputProps.size)
        .toBe(controlSize);
    }
  });

  it('maps validation, disabled, feedback, and direction families to field props', () => {
    expect(resolveFormFieldsOptionLiveness({
      ...FORM_CONFIG,
      disabled: true,
      invalid: true,
      autoDir: false,
      feedbackPlacement: 'below',
    })).toMatchObject({
      inputProps: { isDisabled: true, isInvalid: true, autoDir: false },
      formFieldProps: { required: true, feedbackPlacement: 'below' },
    });

    const optional = applyFormFieldsBooleanOption(FORM_CONFIG, 'required', false);
    const resolved = resolveFormFieldsOptionLiveness(optional);
    expect(optional.requiredInvalidOnMount).toBe(false);
    expect(resolved.visibleOptions).not.toContain('requiredInvalidOnMount');
    expect(resolved.formFieldProps.required).toBe(false);
  });

  it('maps hint and read-only onto field and input props', () => {
    expect(resolveFormFieldsOptionLiveness({
      ...FORM_CONFIG,
      showHint: true,
      readOnly: true,
    })).toMatchObject({
      visibleOptions: expect.arrayContaining(['showHint', 'readOnly']),
      inputProps: { readOnly: true },
      formFieldProps: { hint: 'Use the organization display name.' },
    });
  });

  it.each([
    ['text', ['controlSize', 'feedbackPlacement', 'required', 'invalid', 'requiredInvalidOnMount', 'disabled', 'autoDir', 'showHint', 'readOnly', 'prefix', 'suffix']],
    ['choice', ['controlSize', 'disabled', 'optionCardFixture', 'optionCardColumns', 'optionCardDensity', 'optionCardShowIcon', 'optionCardShowMeta']],
    ['selection', ['controlSize', 'feedbackPlacement', 'required', 'invalid', 'requiredInvalidOnMount', 'disabled', 'showHint']],
    ['structured', ['controlSize', 'feedbackPlacement', 'required', 'invalid', 'requiredInvalidOnMount', 'disabled', 'showHint']],
    ['ai', ['controlSize', 'feedbackPlacement', 'required', 'invalid', 'requiredInvalidOnMount', 'disabled', 'autoDir', 'showHint']],
  ] as const)('shows only live state options for %s', (group, expectedOptions) => {
    const resolved = resolveFormFieldsOptionLiveness({ ...FORM_CONFIG, group });
    expect(resolved.visibleOptions).toEqual(expectedOptions);
  });
});

describe('relations option liveness', () => {
  it.each([
    ['belongsTo', 'lookup', ['select', 'typeahead', 'dropdownButton', 'lookup', 'radio', 'buttonGroup', 'hidden']],
    ['hasOne', 'nestedCard', ['nestedCard', 'nestedForm', 'hidden']],
    ['hasMany', 'relatedGrid', ['relatedGrid', 'cardList', 'repeater', 'hidden']],
    ['belongsToMany', 'checkboxList', ['checkboxList', 'tagsList', 'tags', 'dualList', 'hidden']],
  ] as const)('normalizes %s to its production widget panel', (kind, expectedWidget, expectedWidgets) => {
    const normalized = resolveRelationsConfigForKind(RELATION_CONFIG, kind as RelationsBaseComponentsKind);
    const resolved = resolveRelationsOptionLiveness(normalized);
    expect(normalized.widget).toBe(expectedWidget);
    expect(resolved.compatibleWidgets).toEqual(expectedWidgets);
    expect(resolved.galleryProps).toMatchObject({ kind, widgets: [expectedWidget] });
  });

  it('maps size and both disabled sources to gallery props', () => {
    expect(resolveRelationsOptionLiveness({
      ...RELATION_CONFIG,
      controlSize: 'lg',
      state: 'disabled',
    }).galleryProps).toMatchObject({ size: 'lg', disabled: true });
    expect(resolveRelationsOptionLiveness({
      ...RELATION_CONFIG,
      disabled: true,
    }).galleryProps.disabled).toBe(true);
  });
});

describe('markdown-editor option liveness', () => {
  it.each([
    ['minimal', false, false, false],
    ['standard', true, false, false],
    ['full', true, true, true],
  ] as const)('maps %s toolbar to production dialog controls', (toolbar, shown, image, table) => {
    const props = resolveMarkdownEditorOptionLiveness({
      ...MARKDOWN_CONFIG,
      toolbar,
    }, '# Title').dialogProps.toolbarProps;
    expect(props.showToolbar).toBe(shown);
    expect(props.enableImage).toBe(image);
    expect(props.enableTable).toBe(table);
  });

  it('maps direction and every content/read-only state to preview and dialog props', () => {
    for (const direction of ['auto', 'ltr', 'rtl'] as const) {
      const resolved = resolveMarkdownEditorOptionLiveness({
        ...MARKDOWN_CONFIG,
        direction,
      }, 'Body');
      expect(resolved.previewProps.dir).toBe(direction);
      expect(resolved.dialogProps.dir).toBe(direction);
    }
    expect(resolveMarkdownEditorOptionLiveness({
      ...MARKDOWN_CONFIG,
      state: 'empty',
    }, 'Body').content).toBe('');
    expect(resolveMarkdownEditorOptionLiveness({
      ...MARKDOWN_CONFIG,
      state: 'long',
    }, 'Body').content).toBe('Body\n\nBody\n\nBody');
    expect(resolveMarkdownEditorOptionLiveness({
      ...MARKDOWN_CONFIG,
      state: 'read-only',
    }, 'Body').dialogProps.readOnly).toBe(true);
  });
});

describe('html-editor option liveness', () => {
  it.each([
    ['visual', ['mode', 'toolbar', 'sourceDiagnostics', 'fullscreen', 'state']],
    ['source', ['mode', 'sourceDiagnostics', 'fullscreen', 'state']],
    ['split', ['mode', 'direction', 'previewDevice', 'sourceDiagnostics', 'fullscreen', 'state']],
    ['preview', ['mode', 'direction', 'previewDevice', 'sourceDiagnostics', 'fullscreen', 'state']],
  ] as const)('shows only live controls for %s mode', (mode, visibleOptions) => {
    const resolved = resolveHtmlEditorOptionLiveness({ ...HTML_CONFIG, mode }, '<p>Body</p>');
    expect(resolved.visibleOptions).toEqual(visibleOptions);
    expect(resolved.editorProps.mode).toBe(mode);
  });

  it('maps toolbar, direction, device, and state families to HtmlEditor props', () => {
    const full = resolveHtmlEditorOptionLiveness({
      ...HTML_CONFIG,
      mode: 'split',
      toolbar: 'full',
      direction: 'rtl',
      previewDevice: 'mobile',
    }, '<p>Body</p>').editorProps;
    expect(full).toMatchObject({
      mode: 'split',
      dir: 'rtl',
      previewDevice: 'mobile',
      showToolbar: true,
      enableImage: true,
      enableTable: true,
    });

    expect(resolveHtmlEditorOptionLiveness({
      ...HTML_CONFIG,
      state: 'empty',
    }, '<p>Body</p>').value).toBe('');
    expect(resolveHtmlEditorOptionLiveness({
      ...HTML_CONFIG,
      state: 'long',
    }, '<p>x</p>').editorProps).toMatchObject({ value: '<p>x</p><p>x</p><p>x</p>', readOnly: true });
    expect(resolveHtmlEditorOptionLiveness({
      ...HTML_CONFIG,
      state: 'media',
    }, '<p>x</p>').editorProps.value).toContain('<figure>');
    expect(resolveHtmlEditorOptionLiveness({
      ...HTML_CONFIG,
      state: 'read-only',
    }, '<p>x</p>').editorProps.readOnly).toBe(true);
  });
});

describe('date-time option liveness', () => {
  it.each([
    ['date-picker', 'single', 1, 'day', false],
    ['date-range', 'range', 2, 'day', false],
    ['date-time', 'single', 1, 'minute', true],
  ] as const)('maps %s pattern to picker composition', (pattern, selectionMode, pickerCount, granularity, timezoneVisible) => {
    const resolved = resolveDateTimeOptionLiveness({ ...DATE_CONFIG, pattern });
    expect(resolved).toMatchObject({ selectionMode, pickerCount });
    expect(resolved.pickerProps.granularity).toBe(granularity);
    expect(resolved.visibleOptions.includes('timezone')).toBe(timezoneVisible);
  });

  it.each([
    ['gregorian', 'en-US', 'gregorian', '2026-08-10'],
    ['persian', 'fa-IR', 'jalali', '1405-05-19'],
    ['islamic', 'ar-IQ', 'hijri', '1448-02-26'],
  ] as const)('normalizes %s calendar, locale, values, and production calendar prop', (calendar, locale, calendarSystem, start) => {
    const applied = applyDateTimeOption(DATE_CONFIG, '2026-08-10', '2026-08-14', 'calendar', calendar);
    expect(applied).toMatchObject({ config: { calendar, locale }, start });
    expect(resolveDateTimeOptionLiveness(applied.config).pickerProps.calendarSystem).toBe(calendarSystem);
  });

  it('maps locale, constraints, timezone, states, and viewport to production props/rendering', () => {
    const resolved = resolveDateTimeOptionLiveness({
      ...DATE_CONFIG,
      pattern: 'date-time',
      locale: 'en-GB',
      constraints: 'release-window',
      timezone: 'Asia/Tehran',
      state: 'invalid',
      viewport: 'phone',
    });
    expect(resolved.pickerProps).toMatchObject({
      locale: 'en-GB',
      minValue: '2026-08-01',
      maxValue: '2026-08-31',
      timeZone: 'Asia/Tehran',
      isInvalid: true,
    });
    expect(resolved.viewportClass).toBe('max-w-sm');
    expect(resolveDateTimeOptionLiveness({
      ...DATE_CONFIG,
      state: 'disabled',
    }).pickerProps.isDisabled).toBe(true);
  });
});

describe('file-media-input option liveness', () => {
  it.each(['button', 'drop-zone', 'image', 'avatar', 'queue'] as const)(
    'maps %s preset to the production primitive and relevant controls',
    (preset) => {
      const config = applyFileMediaInputOption(FILE_CONFIG, 'preset', preset);
      const resolved = resolveFileMediaInputOptionLiveness(config);
      expect(resolved.primitiveProps.preset).toBe(preset);
      expect(resolved.visibleOptions.includes('queueActions')).toBe(preset === 'queue');
      if (preset === 'image' || preset === 'avatar') {
        expect(config).toMatchObject({ multiple: false, accept: 'images', preview: true });
        expect(resolved.visibleOptions).not.toContain('accept');
        expect(resolved.visibleOptions).not.toContain('preview');
      }
    },
  );

  it('normalizes multiple/limit dependencies and maps all limit presets', () => {
    const single = applyFileMediaInputOption({ ...FILE_CONFIG, multiple: true }, 'limits', 'single-small');
    expect(single.multiple).toBe(false);
    expect(resolveFileMediaInputOptionLiveness(single).primitiveProps).toMatchObject({
      maxCount: 1,
      maxSizeMb: 2,
    });
    const restored = applyFileMediaInputOption(single, 'multiple', 'true');
    expect(restored).toMatchObject({ multiple: true, limits: 'safe-defaults' });
    expect(resolveFileMediaInputOptionLiveness({
      ...FILE_CONFIG,
      limits: 'media-large',
    }).primitiveProps).toMatchObject({ maxCount: 10, maxSizeMb: 100 });
  });

  it.each([
    ['any', undefined],
    ['images', 'image/*'],
    ['documents', '.pdf,.doc,.docx,.txt'],
    ['audio-video', 'audio/*,video/*'],
  ] as const)('maps %s acceptance and preview visibility to primitive props', (accept, expected) => {
    const config = applyFileMediaInputOption(FILE_CONFIG, 'accept', accept);
    const resolved = resolveFileMediaInputOptionLiveness(config);
    expect(resolved.primitiveProps.accept).toBe(expected);
    if (accept === 'documents' || accept === 'audio-video') {
      expect(config.preview).toBe(false);
      expect(resolved.visibleOptions).not.toContain('preview');
    }
  });

  it('maps preview, queue actions, and every visual state', () => {
    expect(resolveFileMediaInputOptionLiveness({
      ...FILE_CONFIG,
      preview: false,
    }).primitiveProps.showPreview).toBe(false);
    expect(resolveFileMediaInputOptionLiveness({
      ...FILE_CONFIG,
      preset: 'queue',
      queueActions: 'cancel,remove',
    }).primitiveProps.queueActions).toEqual(['cancel', 'remove']);
    for (const state of ['default', 'dragging', 'rejected', 'uploading', 'success', 'error'] as const) {
      expect(resolveFileMediaInputOptionLiveness({
        ...FILE_CONFIG,
        state,
      }).primitiveProps.state).toBe(state);
    }
  });
});

describe('where-builder option liveness', () => {
  it.each([
    ['simple', 2, 0],
    ['nested', 5, 1],
    ['empty', 0, 0],
  ] as const)('maps %s fixture to tree shape', (fixture, childCount, nestedGroupCount) => {
    const config = applyWhereBuilderOption(WHERE_CONFIG, 'fixture', fixture);
    const resolved = resolveWhereBuilderOptionLiveness(config);
    expect(resolved.childCount).toBe(childCount);
    expect(resolved.nestedGroupCount).toBe(nestedGroupCount);
  });

  it('maps density, nested groups, preview, context values, states, and viewport to production props', () => {
    expect(resolveWhereBuilderOptionLiveness({
      ...WHERE_CONFIG,
      density: 'compact',
      allowNestedGroups: false,
      showPreview: false,
      contextValues: false,
      allowManualNodes: false,
      showTreeLines: false,
      showGroupBoxes: false,
      allowReorder: false,
      state: 'disabled',
      viewport: 'phone',
    })).toMatchObject({
      visibleOptions: ['fixture', 'density', 'allowNestedGroups', 'showPreview', 'contextValues', 'allowManualNodes', 'showTreeLines', 'showGroupBoxes', 'allowReorder', 'state', 'viewport'],
      viewportClass: 'max-w-sm',
      builderProps: {
        density: 'compact',
        allowNestedGroups: false,
        showPreview: false,
        isDisabled: true,
        contextItems: undefined,
        allowManualNodes: false,
        showTreeLines: false,
        showGroupBoxes: false,
        allowReorder: false,
      },
    });

    const withContext = resolveWhereBuilderOptionLiveness(WHERE_CONFIG);
    expect(withContext.builderProps.contextItems).toEqual([
      { id: 'user.id', label: 'user.id', valueShape: 'scalar' },
      { id: 'user.email', label: 'user.email', valueShape: 'scalar' },
      { id: 'sys.roles', label: 'sys.roles', valueShape: 'collection' },
      { id: 'scope.org', label: 'scope.org', valueShape: 'collection' },
      { id: 'scope.geo', label: 'scope.geo', valueShape: 'collection' },
    ]);

    const empty = applyWhereBuilderOption(WHERE_CONFIG, 'state', 'empty');
    expect(empty.fixture).toBe('empty');
    expect(resolveWhereBuilderOptionLiveness(empty).childCount).toBe(0);

    const invalid = resolveWhereBuilderOptionLiveness({ ...WHERE_CONFIG, state: 'invalid' });
    expect(invalid.builderProps.invalidConditionId).toBe('where-firstName');
  });
});

describe('ai-chat-panel option liveness', () => {
  it('maps composer slots, agency, and states onto production chat panel props', async () => {
    const { resolveAiChatPanelOptionLiveness } = await import('../ai-chat-panel/AiChatPanelBaseComponentsWorkspace');
    const base = {
      agencyMode: 'ask' as const,
      agencyModes: 'all' as const,
      agencyPickerVariant: 'buttons' as const,
      showHeader: true,
      showWelcomeWarning: false,
      showCommands: true,
      showModelPicker: true,
      showSendButton: true,
      showSendingIndicator: true,
      promptAutoGrow: false,
      showPromptToolbarStart: false,
      showComposer: true,
    };
    expect(resolveAiChatPanelOptionLiveness({ ...base, state: 'default' })).toMatchObject({
      visibleOptions: expect.arrayContaining([
        'state', 'agencyMode', 'agencyModes', 'agencyPickerVariant', 'showHeader', 'showModelPicker', 'promptRows', 'showComposer',
      ]),
      panelProps: {
        aiEnabled: true,
        models: [{ id: 'demo-chat', name: 'Demo chat' }],
        showModelPicker: true,
        agencyMode: 'ask',
        agencyModes: ['ask', 'read-only', 'agentic'],
        agencyPickerVariant: 'buttons',
      },
    });
    expect(resolveAiChatPanelOptionLiveness({ ...base, state: 'disabled' }).panelProps.aiEnabled).toBe(false);
    expect(resolveAiChatPanelOptionLiveness({ ...base, state: 'no-models' }).panelProps.models).toEqual([]);
    expect(resolveAiChatPanelOptionLiveness({ ...base, state: 'sending' }).panelProps.sending).toBe(true);
    expect(resolveAiChatPanelOptionLiveness({
      ...base,
      promptAutoGrow: true,
      state: 'empty',
    })).toMatchObject({
      visibleOptions: expect.not.arrayContaining(['promptRows']),
      panelProps: {
        promptAutoGrow: true,
        promptRows: 1,
      },
    });
    expect(resolveAiChatPanelOptionLiveness({
      ...base,
      agencyModes: 'off',
    }).visibleOptions).toEqual(expect.not.arrayContaining(['agencyPickerVariant']));
    expect(resolveAiChatPanelOptionLiveness({
      ...base,
      agencyModes: 'ask-agentic',
      agencyMode: 'agentic',
    }).panelProps.agencyModes).toEqual(['ask', 'agentic']);
    expect(resolveAiChatPanelOptionLiveness({
      ...base,
      agencyModes: 'off',
    }).panelProps.agencyModes).toBeUndefined();
  });
});

describe('transfer-list option liveness', () => {
  it('maps compact, tone, and empty states to production list props', async () => {
    const { resolveTransferListOptionLiveness } = await import('../transfer-list/TransferListBaseComponentsWorkspace');
    expect(resolveTransferListOptionLiveness({
      compact: true,
      tone: 'indigo',
      state: 'empty-left',
    })).toMatchObject({
      visibleOptions: ['compact', 'tone', 'state'],
      listProps: { compact: true, tone: 'indigo', leftEmpty: true, rightEmpty: false },
    });
  });
});
