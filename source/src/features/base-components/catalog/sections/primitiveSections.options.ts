import { DEFAULT_DASHBOARD_FILTER_BAR_CONFIG } from '../../../../domain/component-designer/designerDashboardFilterBarConfig';
import { MOCK_DESCRIPTION_LIST_JSON, MOCK_TESTIMONIALS_JSON } from '../../../../domain/component-designer/universalMockFixtures';
import { MOCK_ORG_TREE_JSON, MOCK_PROJECT_TIMELINE_JSON } from '../../../../domain/component-designer/visualizationMockFixtures';
import type {
  BaseComponentOptionAxis,
  BaseComponentOptionControl,
  BaseComponentOptionDisposition,
  BaseComponentOptionMeta,
} from '../baseComponentOptionTypes';

type OptionExtras = Pick<
  BaseComponentOptionMeta,
  | 'enabledWhen'
  | 'visibleWhen'
  | 'conflicts'
  | 'requires'
  | 'accessibilityImpact'
  | 'recordFields'
  | 'recordItemLabel'
  | 'recordHasId'
>;

type OptionInput = readonly [
  id: string,
  axis: BaseComponentOptionAxis,
  disposition: BaseComponentOptionDisposition,
  control: BaseComponentOptionControl,
  defaultValue: unknown,
  values?: readonly unknown[],
  propPath?: string,
  extras?: Partial<OptionExtras>,
];

export type PrimitiveSectionDefinition = {
  id: string;
  label: string;
  group: 'data' | 'actions' | 'form-fields' | 'editors' | 'navigation' | 'layout' | 'query' | 'identity' | 'pickers' | 'overlays';
  purpose: string;
  options: readonly OptionInput[];
};

const LAYOUT = ['heroui-components', 'fluent-components', 'material-components'] as const;
const bool = [false, true] as const;
const sizes = ['sm', 'md', 'lg'] as const;
const headingLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
const gaps = ['gap-1', 'gap-2', 'gap-3', 'gap-4'] as const;
const layoutHeights = ['auto', 'h-64', 'h-full'] as const;
const layoutWidths = ['w-auto', 'w-full', 'max-w-3xl'] as const;

const layoutBoxOptions = (
  prefix: string,
  defaults: { width?: string; height?: string } = {},
): OptionInput[] => [
  [`${prefix}.width`, 'layout', 'public-prop', 'select', defaults.width ?? 'w-full', layoutWidths, 'width'],
  [`${prefix}.height`, 'layout', 'public-prop', 'select', defaults.height ?? 'auto', layoutHeights, 'height'],
];
const emptyViz = 'No data — check the connected field mapping.';

const records = (json: string): readonly Record<string, unknown>[] =>
  JSON.parse(json) as Record<string, unknown>[];

const TESTIMONIALS = records(MOCK_TESTIMONIALS_JSON);
const DESCRIPTION_ROWS = records(MOCK_DESCRIPTION_LIST_JSON);
const TIMELINE_EVENTS = records(MOCK_PROJECT_TIMELINE_JSON);
const GANTT_DEPENDENCIES = [{ fromTaskId: 'evt-1', toTaskId: 'evt-2' }];
const GANTT_MILESTONES = [{ taskId: 'evt-4', label: 'Launch' }];
const FILTER_BAR_DEFAULT = JSON.stringify(DEFAULT_DASHBOARD_FILTER_BAR_CONFIG);

const slideFields = {
  recordItemLabel: 'slide',
  recordFields: [
    { key: 'name', label: 'Name' },
    { key: 'quote', label: 'Quote', control: 'textarea' as const },
  ],
};

const termFields = {
  recordItemLabel: 'row',
  recordHasId: false,
  recordFields: [
    { key: 'term', label: 'Term' },
    { key: 'detail', label: 'Detail' },
  ],
};

const menuItemFields = {
  recordItemLabel: 'item',
  recordFields: [
    { key: 'id', label: 'Id' },
    { key: 'label', label: 'Label' },
  ],
};

const commandItemFields = {
  recordItemLabel: 'command',
  recordFields: [
    { key: 'id', label: 'Id' },
    { key: 'label', label: 'Label' },
    { key: 'hint', label: 'Hint' },
  ],
};

const menubarFields = {
  recordItemLabel: 'menu',
  recordFields: [
    { key: 'id', label: 'Id' },
    { key: 'label', label: 'Label' },
    { key: 'items', label: 'Items' },
  ],
};

const eventFields = {
  recordItemLabel: 'event',
  recordFields: [
    { key: 'id', label: 'Id' },
    { key: 'title', label: 'Title' },
    { key: 'start', label: 'Start', placeholder: '2026-01-15' },
    { key: 'end', label: 'End', placeholder: '2026-01-15' },
    { key: 'description', label: 'Description', control: 'textarea' as const },
  ],
};

const opt = (
  id: string,
  label: string,
  group: PrimitiveSectionDefinition['group'],
  purpose: string,
  options: readonly OptionInput[],
): PrimitiveSectionDefinition => ({ id, label, group, purpose, options });

export const PRIMITIVE_SECTION_DEFINITIONS: readonly PrimitiveSectionDefinition[] = [
  opt('drawer', 'Drawer', 'navigation', 'Edge-docked overlay for secondary tasks.', [
    ['drawer.title', 'content', 'public-prop', 'text', 'Drawer', undefined, 'title'],
    ['drawer.placement', 'layout', 'public-prop', 'segmented', 'end', ['start', 'end'], 'placement'],
  ]),
  opt('otp-input', 'OTP', 'form-fields', 'One-time code entry.', [
    ['otpInput.label', 'content', 'public-prop', 'text', 'Verification code', undefined, 'label'],
    ['otpInput.value', 'content', 'public-prop', 'text', '', undefined, 'value'],
    ['otpInput.length', 'behavior', 'public-prop', 'select', 6, [4, 6, 8], 'length'],
  ]),
  opt('code-editor', 'Code editor', 'editors', 'Monospace editor for code or JSON.', [
    ['codeEditor.language', 'behavior', 'public-prop', 'select', 'typescript', ['typescript', 'javascript', 'json'], 'language'],
    ['codeEditor.value', 'content', 'public-prop', 'text', 'const ready = true;', undefined, 'value'],
  ]),
  opt('plain-text', 'Text', 'data', 'Inline text node.', [
    ['plainText.text', 'content', 'public-prop', 'text', 'Sample text', undefined, 'text'],
  ]),
  opt('heading', 'Heading', 'data', 'Section title.', [
    ['heading.text', 'content', 'public-prop', 'text', 'Section title', undefined, 'text'],
    ['heading.level', 'content', 'public-prop', 'select', 'h2', headingLevels, 'level'],
  ]),
  opt('flex-row', 'Flex row', 'layout', 'Horizontal flex stack.', [
    ['flexRow.gap', 'layout', 'public-prop', 'select', 'gap-3', gaps, 'gap'],
    ...layoutBoxOptions('flexRow'),
  ]),
  opt('flex-column', 'Flex column', 'layout', 'Vertical flex stack.', [
    ['flexColumn.gap', 'layout', 'public-prop', 'select', 'gap-3', gaps, 'gap'],
    ...layoutBoxOptions('flexColumn'),
  ]),
  opt('grid-2', 'Two columns', 'layout', 'Two-column grid.', [
    ['grid2.gap', 'layout', 'public-prop', 'select', 'gap-3', ['gap-2', 'gap-3', 'gap-4'], 'gap'],
    ...layoutBoxOptions('grid2'),
  ]),
  opt('grid-3', 'Three columns', 'layout', 'Three-column grid.', [
    ['grid3.gap', 'layout', 'public-prop', 'select', 'gap-3', ['gap-2', 'gap-3', 'gap-4'], 'gap'],
    ...layoutBoxOptions('grid3'),
  ]),
  opt('columns', 'Columns', 'layout', 'Variable column slots.', [
    ['columns.count', 'layout', 'public-prop', 'select', 2, [2, 3, 4], 'columnCount'],
    ...layoutBoxOptions('columns'),
  ]),
  opt('stack-compact', 'Compact stack', 'layout', 'Tight vertical stack.', [
    ['stackCompact.gap', 'layout', 'public-prop', 'select', 'gap-1', ['gap-1', 'gap-2'], 'gap'],
    ...layoutBoxOptions('stackCompact'),
  ]),
  opt('stack-relaxed', 'Relaxed stack', 'layout', 'Roomy vertical stack.', [
    ['stackRelaxed.gap', 'layout', 'public-prop', 'select', 'gap-4', ['gap-3', 'gap-4', 'gap-6'], 'gap'],
    ...layoutBoxOptions('stackRelaxed'),
  ]),
  opt('center', 'Center', 'layout', 'Centered child host.', [
    ['center.minHeight', 'layout', 'public-prop', 'select', 'min-h-24', ['min-h-16', 'min-h-24', 'min-h-40'], 'minHeight'],
    ...layoutBoxOptions('center'),
  ]),
  opt('wrapper', 'Wrapper', 'layout', 'Neutral width wrapper.', [
    ['wrapper.width', 'layout', 'public-prop', 'select', 'w-full', [...layoutWidths, 'max-w-5xl'], 'width'],
    ['wrapper.height', 'layout', 'public-prop', 'select', 'auto', layoutHeights, 'height'],
  ]),
  opt('sticky-bar', 'Sticky bar', 'layout', 'Bar that sticks to an edge.', [
    ['stickyBar.edge', 'layout', 'public-prop', 'segmented', 'top', ['top', 'bottom'], 'edge'],
  ]),
  opt('split-pane', 'Split pane', 'layout', 'Two panes with a drag splitter.', [
    ['splitPane.orientation', 'layout', 'public-prop', 'segmented', 'horizontal', ['horizontal', 'vertical'], 'orientation'],
    ...layoutBoxOptions('splitPane', { height: 'h-64' }),
  ]),
  opt('separator', 'Separator', 'layout', 'Divider line.', [
    ['separator.orientation', 'layout', 'public-prop', 'segmented', 'horizontal', ['horizontal', 'vertical'], 'orientation'],
  ]),
  opt('spacer', 'Spacer', 'layout', 'Flexible empty space.', [
    ['spacer.size', 'layout', 'public-prop', 'select', 'h-4', ['h-2', 'h-4', 'h-8'], 'size'],
  ]),
  opt('aspect-ratio', 'Aspect ratio', 'layout', 'Fixed-ratio frame.', [
    ['aspectRatio.ratio', 'layout', 'public-prop', 'select', '16/9', ['1/1', '4/3', '16/9'], 'ratio'],
  ]),
  opt('sticky', 'Sticky', 'layout', 'Sticky positioned host.', [
    ['sticky.offset', 'layout', 'public-prop', 'number-step', 0, [0, 8, 16, 24], 'offset'],
  ]),
  opt('overlay', 'Overlay', 'layout', 'Absolutely positioned overlay.', [
    ['layoutOverlay.label', 'content', 'public-prop', 'text', 'Overlay', undefined, 'overlayLabel'],
  ]),
  opt('html-container', 'Container', 'layout', 'Generic HTML container.', [
    ['htmlContainer.tag', 'content', 'public-prop', 'select', 'div', ['div', 'main', 'aside'], 'tag'],
    ...layoutBoxOptions('htmlContainer'),
  ]),
  opt('html-section', 'Section', 'layout', 'HTML section.', [
    ['htmlSection.ariaLabel', 'accessibility', 'public-prop', 'text', '', undefined, 'ariaLabel'],
  ]),
  opt('html-article', 'Article', 'layout', 'HTML article.', [
    ['htmlArticle.title', 'content', 'public-prop', 'text', 'Article', undefined, 'title'],
  ]),
  opt('html-figure', 'Figure', 'layout', 'HTML figure.', [
    ['htmlFigure.caption', 'content', 'public-prop', 'text', '', undefined, 'caption'],
  ]),
  opt('html-table-wrap', 'Table wrap', 'layout', 'Scroll host for a table.', [
    ['htmlTableWrap.overflow', 'layout', 'public-prop', 'segmented', 'auto', ['auto', 'scroll'], 'overflow'],
  ]),
  opt('html-form', 'Form', 'layout', 'Native form host.', [
    ['htmlForm.method', 'behavior', 'public-prop', 'segmented', 'post', ['get', 'post'], 'method'],
  ]),
  opt('html-list', 'List', 'layout', 'HTML list.', [
    ['htmlList.ordered', 'content', 'public-prop', 'checkbox', false, bool, 'ordered'],
    ['htmlList.items', 'content', 'public-prop', 'repeater', [{ text: 'First item' }, { text: 'Second item' }], undefined, 'items', {
      recordItemLabel: 'item',
      recordHasId: false,
      recordFields: [{ key: 'text', label: 'Text' }],
    }],
  ]),
  opt('html-list-item', 'List item', 'layout', 'HTML list item.', [
    ['htmlListItem.text', 'content', 'public-prop', 'text', 'Item', undefined, 'text'],
  ]),
  opt('html-link', 'Link', 'navigation', 'Inline hyperlink.', [
    ['htmlLink.text', 'content', 'public-prop', 'text', 'Learn more', undefined, 'text'],
    ['htmlLink.href', 'content', 'public-prop', 'text', '#', undefined, 'href'],
    ['htmlLink.target', 'behavior', 'public-prop', 'select', '_self', ['_self', '_blank'], 'target'],
  ]),
  opt('html-image', 'Image', 'data', 'Embedded image.', [
    ['htmlImage.src', 'content', 'public-prop', 'text', '/assets/designer-default-image.svg', undefined, 'src'],
    ['htmlImage.alt', 'accessibility', 'public-prop', 'text', '', undefined, 'alt'],
    ['htmlImage.objectFit', 'layout', 'public-prop', 'select', 'cover', ['contain', 'cover', 'fill', 'none', 'scale-down'], 'objectFit'],
    ['htmlImage.fallbackSrc', 'content', 'public-prop', 'text', '', undefined, 'fallbackSrc'],
  ]),
  opt('html-iframe', 'Embed', 'data', 'Embedded frame.', [
    ['htmlIframe.src', 'content', 'public-prop', 'text', 'https://www.openstreetmap.org/export/embed.html', undefined, 'src'],
    ['htmlIframe.title', 'accessibility', 'public-prop', 'text', 'Embedded content', undefined, 'title'],
    ['htmlIframe.width', 'layout', 'public-prop', 'select', '100%', ['50%', '75%', '100%'], 'width'],
    ['htmlIframe.height', 'layout', 'public-prop', 'select', '360', ['240', '360', '480', 'h-full'], 'height'],
    ['htmlIframe.allowFullScreen', 'behavior', 'public-prop', 'checkbox', true, bool, 'allowFullScreen'],
    ['htmlIframe.loading', 'behavior', 'public-prop', 'select', 'lazy', ['lazy', 'eager'], 'loading'],
  ]),
  opt('repeater', 'Repeater', 'query', 'Repeats children over a dataset.', [
    ['repeater.dataPath', 'data', 'public-prop', 'text', 'products', undefined, 'dataPath'],
    ['repeater.itemAlias', 'behavior', 'public-prop', 'text', 'item', undefined, 'itemAlias'],
    ['repeater.indexAlias', 'behavior', 'public-prop', 'text', 'index', undefined, 'indexAlias'],
  ]),
  opt('visibility-container', 'Visibility', 'query', 'Shows children when a condition holds.', [
    ['visibilityContainer.when', 'behavior', 'public-prop', 'text', 'store.ui.showPanel === true', undefined, 'visibleCondition'],
  ]),
  opt('pagination', 'Pagination', 'navigation', 'Page number control.', [
    ['pagination.size', 'layout', 'public-prop', 'segmented', 'md', sizes, 'size'],
    ['pagination.page', 'behavior', 'public-prop', 'number-step', 1, [1, 2, 3, 4, 5], 'page'],
    ['pagination.total', 'behavior', 'public-prop', 'number-step', 10, [5, 10, 20, 50], 'total'],
  ]),
  opt('typography-lead', 'Lead text', 'data', 'Introductory paragraph.', [
    ['typographyLead.text', 'content', 'public-prop', 'text', 'Lead text for sections and summaries.', undefined, 'text'],
  ]),
  opt('field-container', 'Field container', 'form-fields', 'Fieldset for grouped fields.', [
    ['fieldContainer.label', 'content', 'public-prop', 'text', 'Group', undefined, 'label'],
  ]),
  opt('link-button', 'Link button', 'navigation', 'Button-styled link.', [
    ['linkButton.text', 'content', 'public-prop', 'text', 'Learn more', undefined, 'text'],
    ['linkButton.href', 'content', 'public-prop', 'text', '#', undefined, 'href'],
    ['linkButton.target', 'behavior', 'public-prop', 'select', '_self', ['_self', '_blank'], 'target'],
  ]),
  opt('filter-bar', 'Filter bar', 'query', 'Dashboard filter cluster.', [
    ['filterBar.config', 'data', 'public-prop', 'text', FILTER_BAR_DEFAULT, undefined, 'filterBarConfig'],
  ]),
  opt('dashboard-canvas', 'Dashboard canvas', 'data', 'Personalizable dashboard grid.', [
    ['dashboardCanvas.personalizable', 'behavior', 'public-prop', 'checkbox', true, bool, 'personalizable'],
  ]),
  opt('tree-view', 'Tree view', 'data', 'Hierarchical tree.', [
    ['treeView.data', 'data', 'public-prop', 'text', MOCK_ORG_TREE_JSON, undefined, 'data'],
    ['treeView.selectionMode', 'behavior', 'public-prop', 'select', 'single', ['none', 'single', 'checkbox'], 'selectionMode'],
    ['treeView.showIcons', 'appearance', 'public-prop', 'checkbox', false, bool, 'showIcons'],
    ['treeView.selectedKey', 'data', 'public-prop', 'text', '', undefined, 'selectedKey'],
    ['treeView.emptyContent', 'content', 'public-prop', 'text', emptyViz, undefined, 'emptyContent'],
  ]),
  opt('tree-select', 'Tree select', 'form-fields', 'Select from a tree.', [
    ['treeSelect.label', 'content', 'public-prop', 'text', 'Department', undefined, 'label'],
    ['treeSelect.placeholder', 'content', 'public-prop', 'text', 'Select department…', undefined, 'placeholder'],
    ['treeSelect.data', 'data', 'public-prop', 'text', MOCK_ORG_TREE_JSON, undefined, 'data'],
    ['treeSelect.multiple', 'behavior', 'public-prop', 'checkbox', false, bool, 'multiple'],
    ['treeSelect.selectedKey', 'data', 'public-prop', 'text', '', undefined, 'selectedKey'],
  ]),
  opt('cascader', 'Cascader', 'form-fields', 'Nested cascading picker.', [
    ['cascader.label', 'content', 'public-prop', 'text', 'Region', undefined, 'label'],
    ['cascader.placeholder', 'content', 'public-prop', 'text', 'Select region…', undefined, 'placeholder'],
    ['cascader.data', 'data', 'public-prop', 'text', MOCK_ORG_TREE_JSON, undefined, 'data'],
    ['cascader.selectedKey', 'data', 'public-prop', 'text', '', undefined, 'selectedKey'],
  ]),
  opt('tree-combobox', 'Tree combobox', 'form-fields', 'Typeable tree picker.', [
    ['treeCombobox.label', 'content', 'public-prop', 'text', 'Search tree', undefined, 'label'],
    ['treeCombobox.placeholder', 'content', 'public-prop', 'text', 'Type…', undefined, 'placeholder'],
    ['treeCombobox.data', 'data', 'public-prop', 'text', MOCK_ORG_TREE_JSON, undefined, 'data'],
    ['treeCombobox.selectedKey', 'data', 'public-prop', 'text', '', undefined, 'selectedKey'],
  ]),
  opt('timeline', 'Timeline', 'data', 'Chronological events.', [
    ['timeline.title', 'content', 'public-prop', 'text', 'Project Timeline', undefined, 'title'],
    ['timeline.events', 'data', 'public-prop', 'repeater', TIMELINE_EVENTS, undefined, 'data', eventFields],
  ]),
  opt('gantt', 'Gantt', 'data', 'Schedule bars.', [
    ['gantt.title', 'content', 'public-prop', 'text', 'Schedule', undefined, 'title'],
    ['gantt.tasks', 'data', 'public-prop', 'repeater', TIMELINE_EVENTS, undefined, 'data', eventFields],
    ['gantt.viewMode', 'layout', 'public-prop', 'select', 'week', ['day', 'week', 'month'], 'viewMode'],
    ['gantt.dependencies', 'data', 'public-prop', 'repeater', GANTT_DEPENDENCIES, undefined, 'dependencies', {
      recordItemLabel: 'dependency',
      recordHasId: false,
      recordFields: [
        { key: 'fromTaskId', label: 'From task', placeholder: 'evt-1' },
        { key: 'toTaskId', label: 'To task', placeholder: 'evt-2' },
      ],
    }],
    ['gantt.milestones', 'data', 'public-prop', 'repeater', GANTT_MILESTONES, undefined, 'milestones', {
      recordItemLabel: 'milestone',
      recordHasId: false,
      recordFields: [
        { key: 'taskId', label: 'Task id', placeholder: 'evt-4' },
        { key: 'label', label: 'Label' },
      ],
    }],
    ['gantt.allowTaskDrag', 'behavior', 'public-prop', 'checkbox', true, bool, 'allowTaskDrag'],
    ['gantt.height', 'layout', 'public-prop', 'select', 'auto', layoutHeights, 'height'],
  ]),
  opt('stepper', 'Stepper', 'navigation', 'Step indicator.', [
    ['stepper.steps', 'content', 'public-prop', 'text', 'Account,Profile,Review', undefined, 'steps'],
    ['stepper.activeStep', 'behavior', 'public-prop', 'number-step', 1, [0, 1, 2], 'activeStep'],
  ]),
  opt('carousel', 'Carousel', 'data', 'Sliding media set.', [
    ['carousel.title', 'content', 'public-prop', 'text', 'Gallery', undefined, 'title'],
    ['carousel.slides', 'data', 'public-prop', 'repeater', TESTIMONIALS, undefined, 'slides', slideFields],
  ]),
  opt('segmented-control', 'Segmented', 'actions', 'Exclusive segment control.', [
    ['segmentedControl.options', 'content', 'public-prop', 'text', 'Day,Week,Month', undefined, 'options'],
    ['segmentedControl.selected', 'behavior', 'public-prop', 'text', 'Week', undefined, 'selected'],
  ]),
  opt('description-list', 'Description list', 'data', 'Term/detail pairs.', [
    ['descriptionList.title', 'content', 'public-prop', 'text', 'Details', undefined, 'title'],
    ['descriptionList.rows', 'data', 'public-prop', 'repeater', DESCRIPTION_ROWS, undefined, 'data', termFields],
  ]),
  opt('stat-trend', 'Stat trend', 'data', 'KPI with sparkline.', [
    ['statTrend.label', 'content', 'public-prop', 'text', 'Revenue', undefined, 'label'],
    ['statTrend.value', 'content', 'public-prop', 'text', '$48.2k', undefined, 'value'],
    ['statTrend.trend', 'content', 'public-prop', 'text', '+12%', undefined, 'trend'],
    ['statTrend.trendDirection', 'appearance', 'public-prop', 'select', 'up', ['up', 'down'], 'trendDirection'],
  ]),
  opt('split-media', 'Split media', 'data', 'Media beside copy.', [
    ['splitMedia.title', 'content', 'public-prop', 'text', 'Split section', undefined, 'title'],
    ['splitMedia.side', 'layout', 'public-prop', 'segmented', 'right', ['left', 'right'], 'mediaSide'],
    ['splitMedia.mediaType', 'content', 'public-prop', 'segmented', 'image', ['image', 'video', 'audio', 'lottie'], 'mediaType'],
    ['splitMedia.mediaSrc', 'content', 'public-prop', 'text', '', undefined, 'mediaSrc'],
  ]),
  opt('rating', 'Rating', 'form-fields', 'Star rating input.', [
    ['rating.label', 'content', 'public-prop', 'text', 'Rating', undefined, 'label'],
    ['rating.value', 'content', 'public-prop', 'number-step', 4, [0, 1, 2, 3, 4, 5], 'value'],
    ['rating.max', 'behavior', 'public-prop', 'select', 5, [3, 5, 10], 'max'],
  ]),
  opt('notification-badge', 'Notification badge', 'identity', 'Count or dot overlay on an avatar or icon.', [
    ['notificationBadge.content', 'content', 'public-prop', 'text', '3', undefined, 'content'],
    ['notificationBadge.color', 'appearance', 'public-prop', 'select', 'danger', ['default', 'accent', 'success', 'warning', 'danger'], 'color'],
    ['notificationBadge.placement', 'layout', 'public-prop', 'select', 'top-end', ['top-end', 'top-start', 'bottom-end', 'bottom-start'], 'placement'],
    ['notificationBadge.dot', 'appearance', 'public-prop', 'checkbox', false, bool, 'dot'],
  ]),
  opt('calendar-grid', 'Calendar', 'pickers', 'Standalone month grid for picking a date.', [
    ['calendarGrid.value', 'content', 'public-prop', 'text', '2026-09-03', undefined, 'value'],
    ['calendarGrid.disabled', 'state', 'public-prop', 'checkbox', false, bool, 'isDisabled'],
  ]),
  opt('range-calendar-grid', 'Range calendar', 'pickers', 'Standalone month grid for picking a date range.', [
    ['rangeCalendarGrid.start', 'content', 'public-prop', 'text', '2026-09-03', undefined, 'start'],
    ['rangeCalendarGrid.end', 'content', 'public-prop', 'text', '2026-09-10', undefined, 'end'],
    ['rangeCalendarGrid.disabled', 'state', 'public-prop', 'checkbox', false, bool, 'isDisabled'],
  ]),
  opt('kbd', 'Keyboard', 'data', 'Keyboard shortcut chrome.', [
    ['kbd.keys', 'content', 'public-prop', 'text', 'Ctrl,K', undefined, 'keys'],
  ]),
  opt('user-card', 'User card', 'identity', 'Avatar, name, and short description as one identity block.', [
    ['userCard.name', 'content', 'public-prop', 'text', 'Ada Lovelace', undefined, 'name'],
    ['userCard.description', 'content', 'public-prop', 'text', 'Product designer', undefined, 'description'],
    ['userCard.fallback', 'content', 'public-prop', 'text', 'AL', undefined, 'fallback'],
    ['userCard.size', 'layout', 'public-prop', 'select', 'md', sizes, 'size'],
  ]),
  opt('hwy-member-face', 'Hawiety member face', 'identity', 'Member-directory list avatar with blue username or red tracking code under the photo.', [
    ['hwyMemberFace.username', 'content', 'public-prop', 'text', '710093', undefined, 'username'],
    ['hwyMemberFace.trackingCode', 'content', 'public-prop', 'text', '1190786', undefined, 'trackingCode'],
    ['hwyMemberFace.displayName', 'content', 'public-prop', 'text', 'Sample member', undefined, 'displayName'],
  ]),
  opt('snippet', 'Snippet', 'data', 'Read-only code chrome with an optional copy control.', [
    ['snippet.code', 'content', 'public-prop', 'text', 'npm run test:critical', undefined, 'code'],
    ['snippet.language', 'content', 'public-prop', 'text', 'bash', undefined, 'language'],
    ['snippet.showCopy', 'behavior', 'public-prop', 'checkbox', true, bool, 'showCopy'],
  ]),
  opt('hover-card', 'Hover card', 'overlays', 'Rich hover preview with title and description.', [
    ['hoverCard.triggerLabel', 'content', 'public-prop', 'text', 'View profile', undefined, 'triggerLabel'],
    ['hoverCard.title', 'content', 'public-prop', 'text', 'Ada Lovelace', undefined, 'title'],
    ['hoverCard.description', 'content', 'public-prop', 'text', 'Product designer on the platform team.', undefined, 'description'],
    ['hoverCard.placement', 'layout', 'public-prop', 'select', 'bottom-start', ['bottom-start', 'bottom-end', 'top-start', 'top-end'], 'placement'],
  ]),
  opt('context-menu', 'Context menu', 'overlays', 'Right-click action menu anchored at the pointer.', [
    ['contextMenu.triggerLabel', 'content', 'public-prop', 'text', 'Right-click this card', undefined, 'triggerLabel'],
    ['contextMenu.items', 'data', 'public-prop', 'repeater', [
      { id: 'open', label: 'Open' },
      { id: 'rename', label: 'Rename' },
      { id: 'delete', label: 'Delete' },
    ], undefined, 'items', menuItemFields],
  ]),
  opt('command-palette', 'Command palette', 'overlays', 'Quick command search overlay from a trigger or Ctrl+K.', [
    ['commandPalette.placeholder', 'content', 'public-prop', 'text', 'Search commands…', undefined, 'placeholder'],
    ['commandPalette.triggerLabel', 'content', 'public-prop', 'text', 'Open commands', undefined, 'triggerLabel'],
    ['commandPalette.items', 'data', 'public-prop', 'repeater', [
      { id: 'base-components', label: 'Go to Base Components', hint: 'Studio' },
      { id: 'client-components', label: 'Open Client Components', hint: 'Designer' },
      { id: 'run-tests', label: 'Run critical tests', hint: 'npm' },
    ], undefined, 'items', commandItemFields],
  ]),
  opt('sortable-list', 'Sortable list', 'data', 'Reorderable list with drag handles.', [
    ['sortableList.items', 'data', 'public-prop', 'repeater', [
      { id: 'inbox', label: 'Inbox' },
      { id: 'progress', label: 'In progress' },
      { id: 'review', label: 'Review' },
      { id: 'done', label: 'Done' },
    ], undefined, 'items', menuItemFields],
    ['sortableList.disabled', 'state', 'public-prop', 'checkbox', false, bool, 'disabled'],
  ]),
  opt('comparison-slider', 'Comparison slider', 'data', 'Before and after comparison with a clip divider.', [
    ['comparisonSlider.beforeLabel', 'content', 'public-prop', 'text', 'Before', undefined, 'beforeLabel'],
    ['comparisonSlider.afterLabel', 'content', 'public-prop', 'text', 'After', undefined, 'afterLabel'],
    ['comparisonSlider.position', 'behavior', 'public-prop', 'number-step', 50, [0, 25, 50, 75, 100], 'position'],
  ]),
  opt('mermaid-diagram', 'Mermaid diagram', 'data', 'In-page Mermaid renderer for flowcharts and entity charts.', [
    ['mermaidDiagram.chart', 'content', 'public-prop', 'text', 'flowchart LR\n  Intake --> Review\n  Review --> Publish', undefined, 'chart'],
    ['mermaidDiagram.loadingLabel', 'content', 'public-prop', 'text', 'Rendering…', undefined, 'loadingLabel'],
  ]),
  opt('virtualized-list', 'Virtualized list', 'data', 'Long non-table list that only mounts visible rows.', [
    ['virtualizedList.itemCount', 'data', 'public-prop', 'number-step', 80, [20, 40, 80, 200], 'itemCount'],
    ['virtualizedList.labelPrefix', 'content', 'public-prop', 'text', 'Row', undefined, 'labelPrefix'],
    ['virtualizedList.height', 'layout', 'public-prop', 'select', 240, [160, 240, 320], 'height'],
  ]),
  opt('signature-pad', 'Signature pad', 'form-fields', 'Canvas signature capture for approval forms.', [
    ['signaturePad.penColor', 'appearance', 'public-prop', 'color', '#0f172a', undefined, 'penColor'],
    ['signaturePad.height', 'layout', 'public-prop', 'select', 160, [120, 160, 200], 'height'],
    ['signaturePad.disabled', 'state', 'public-prop', 'checkbox', false, bool, 'disabled'],
  ]),
  opt('menubar', 'Menubar', 'navigation', 'Compact desktop File, Edit, and View menu bar.', [
    ['menubar.menus', 'data', 'public-prop', 'repeater', [
      { id: 'file', label: 'File', items: 'New, Open, Save' },
      { id: 'edit', label: 'Edit', items: 'Undo, Redo' },
      { id: 'view', label: 'View', items: 'Inspector' },
    ], undefined, 'menus', menubarFields],
  ]),
  opt('code-scanner', 'Code scanner', 'pickers', 'Camera barcode and QR reader after an explicit start.', [
    ['codeScanner.facingMode', 'behavior', 'public-prop', 'select', 'environment', ['environment', 'user'], 'facingMode'],
  ]),
  opt('document-viewer', 'Document viewer', 'data', 'In-app PDF preview, with Office files opening in a new tab.', [
    ['documentViewer.title', 'content', 'public-prop', 'text', 'Release notes', undefined, 'title'],
    ['documentViewer.kind', 'behavior', 'public-prop', 'select', 'pdf', ['pdf', 'office'], 'kind'],
    ['documentViewer.src', 'content', 'public-prop', 'text', '', undefined, 'src'],
    ['documentViewer.height', 'layout', 'public-prop', 'select', 320, [240, 320, 400], 'height'],
  ]),
];

export const PRIMITIVE_SECTION_EVIDENCE = LAYOUT;

export const PRIMITIVE_SECTION_IDS = PRIMITIVE_SECTION_DEFINITIONS.map((section) => section.id);

export const buildPrimitiveOption = (
  componentId: string,
  evidenceRefs: readonly string[],
  input: OptionInput,
): BaseComponentOptionMeta => {
  const [id, axis, disposition, control, defaultValue, values, propPath, extras] = input;
  return {
    id,
    componentId,
    label: id.split('.').slice(1).join(' ') || id,
    axis,
    disposition,
    control,
    defaultValue,
    ...(values ? { values } : {}),
    ...(propPath ? { propPath } : {}),
    responsiveOwner: 'none',
    evidenceRefs,
    ...extras,
  };
};
