export type DesignerRichTextToolbarFeature =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'inlineCode'
  | 'subscript'
  | 'superscript'
  | 'textColor'
  | 'highlight'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'horizontalRule'
  | 'textAlign'
  | 'textDirection'
  | 'indent'
  | 'link'
  | 'image'
  | 'table'
  | 'clearFormatting'
  | 'undoRedo';

export type DesignerRichTextToolbarConfig = {
  showToolbar: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  inlineCode: boolean;
  subscript: boolean;
  superscript: boolean;
  textColor: boolean;
  highlight: boolean;
  heading: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  horizontalRule: boolean;
  textAlign: boolean;
  textDirection: boolean;
  indent: boolean;
  link: boolean;
  image: boolean;
  table: boolean;
  clearFormatting: boolean;
  undoRedo: boolean;
};

export const DESIGNER_RICH_TEXT_COLOR_PRESETS = [
  '#0f172a',
  '#334155',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
  '#9333ea',
] as const;

export const DESIGNER_RICH_TEXT_DEFAULT_TOOLBAR: DesignerRichTextToolbarConfig = {
  showToolbar: true,
  bold: true,
  italic: true,
  underline: true,
  strike: true,
  inlineCode: true,
  subscript: true,
  superscript: true,
  textColor: true,
  highlight: true,
  heading: true,
  bulletList: true,
  orderedList: true,
  taskList: true,
  blockquote: true,
  codeBlock: false,
  horizontalRule: true,
  textAlign: true,
  textDirection: false,
  indent: true,
  link: true,
  image: true,
  table: true,
  clearFormatting: true,
  undoRedo: true,
};

export const DESIGNER_RICH_TEXT_DEFAULT_HEIGHT = 160;
export const DESIGNER_RICH_TEXT_DEFAULT_FONT_SIZE = 14;
export const DESIGNER_RICH_TEXT_DEFAULT_PLACEHOLDER = 'Start writing…';

export const DESIGNER_RICH_TEXT_TOOLBAR_PROP_KEYS = [
  'showToolbar',
  'enableBold',
  'enableItalic',
  'enableUnderline',
  'enableStrike',
  'enableInlineCode',
  'enableSubscript',
  'enableSuperscript',
  'enableTextColor',
  'enableHighlight',
  'enableHeading',
  'enableBulletList',
  'enableOrderedList',
  'enableTaskList',
  'enableBlockquote',
  'enableCodeBlock',
  'enableHorizontalRule',
  'enableTextAlign',
  'enableTextDirection',
  'enableIndent',
  'enableLink',
  'enableImage',
  'enableTable',
  'enableClearFormatting',
  'enableUndoRedo',
] as const;

export type DesignerRichTextToolbarPropKey = typeof DESIGNER_RICH_TEXT_TOOLBAR_PROP_KEYS[number];

export type DesignerRichTextToolbarProps = {
  showToolbar?: boolean;
  enableBold?: boolean;
  enableItalic?: boolean;
  enableUnderline?: boolean;
  enableStrike?: boolean;
  enableInlineCode?: boolean;
  enableSubscript?: boolean;
  enableSuperscript?: boolean;
  enableTextColor?: boolean;
  enableHighlight?: boolean;
  enableHeading?: boolean;
  enableBulletList?: boolean;
  enableOrderedList?: boolean;
  enableTaskList?: boolean;
  enableBlockquote?: boolean;
  enableCodeBlock?: boolean;
  enableHorizontalRule?: boolean;
  enableTextAlign?: boolean;
  enableTextDirection?: boolean;
  enableIndent?: boolean;
  enableLink?: boolean;
  enableImage?: boolean;
  enableTable?: boolean;
  enableClearFormatting?: boolean;
  enableUndoRedo?: boolean;
};

export const resolveDesignerRichTextToolbarConfig = (
  props: Record<string, unknown>,
): DesignerRichTextToolbarConfig => ({
  showToolbar: props.showToolbar !== false,
  bold: props.enableBold !== false,
  italic: props.enableItalic !== false,
  underline: props.enableUnderline !== false,
  strike: props.enableStrike !== false,
  inlineCode: props.enableInlineCode !== false,
  subscript: props.enableSubscript !== false,
  superscript: props.enableSuperscript !== false,
  textColor: props.enableTextColor !== false,
  highlight: props.enableHighlight !== false,
  heading: props.enableHeading !== false,
  bulletList: props.enableBulletList !== false,
  orderedList: props.enableOrderedList !== false,
  taskList: props.enableTaskList !== false,
  blockquote: props.enableBlockquote !== false,
  codeBlock: props.enableCodeBlock === true,
  horizontalRule: props.enableHorizontalRule !== false,
  textAlign: props.enableTextAlign !== false,
  textDirection: props.enableTextDirection === true,
  indent: props.enableIndent !== false,
  link: props.enableLink !== false,
  image: props.enableImage !== false,
  table: props.enableTable !== false,
  clearFormatting: props.enableClearFormatting !== false,
  undoRedo: props.enableUndoRedo !== false,
});

export const resolveDesignerRichTextToolbarProps = (
  props: Record<string, unknown>,
): Required<DesignerRichTextToolbarProps> => ({
  showToolbar: props.showToolbar !== false,
  enableBold: props.enableBold !== false,
  enableItalic: props.enableItalic !== false,
  enableUnderline: props.enableUnderline !== false,
  enableStrike: props.enableStrike !== false,
  enableInlineCode: props.enableInlineCode !== false,
  enableSubscript: props.enableSubscript !== false,
  enableSuperscript: props.enableSuperscript !== false,
  enableTextColor: props.enableTextColor !== false,
  enableHighlight: props.enableHighlight !== false,
  enableHeading: props.enableHeading !== false,
  enableBulletList: props.enableBulletList !== false,
  enableOrderedList: props.enableOrderedList !== false,
  enableTaskList: props.enableTaskList !== false,
  enableBlockquote: props.enableBlockquote !== false,
  enableCodeBlock: props.enableCodeBlock === true,
  enableHorizontalRule: props.enableHorizontalRule !== false,
  enableTextAlign: props.enableTextAlign !== false,
  enableTextDirection: props.enableTextDirection === true,
  enableIndent: props.enableIndent !== false,
  enableLink: props.enableLink !== false,
  enableImage: props.enableImage !== false,
  enableTable: props.enableTable !== false,
  enableClearFormatting: props.enableClearFormatting !== false,
  enableUndoRedo: props.enableUndoRedo !== false,
});

export const isDesignerRichTextToolbarFeatureEnabled = (
  config: DesignerRichTextToolbarConfig,
  feature: DesignerRichTextToolbarFeature,
): boolean => config[feature];

export const hasAnyDesignerRichTextToolbarFeature = (
  config: DesignerRichTextToolbarConfig,
): boolean => config.showToolbar && Object.entries(config).some(([key, value]) => key !== 'showToolbar' && value === true);

export const renderDesignerRichTextToolbarJsxProps = (
  props: Record<string, unknown>,
): string => {
  const resolved = resolveDesignerRichTextToolbarProps(props);
  return [
    `showToolbar={${resolved.showToolbar}}`,
    `enableBold={${resolved.enableBold}}`,
    `enableItalic={${resolved.enableItalic}}`,
    `enableUnderline={${resolved.enableUnderline}}`,
    `enableStrike={${resolved.enableStrike}}`,
    `enableInlineCode={${resolved.enableInlineCode}}`,
    `enableSubscript={${resolved.enableSubscript}}`,
    `enableSuperscript={${resolved.enableSuperscript}}`,
    `enableTextColor={${resolved.enableTextColor}}`,
    `enableHighlight={${resolved.enableHighlight}}`,
    `enableHeading={${resolved.enableHeading}}`,
    `enableBulletList={${resolved.enableBulletList}}`,
    `enableOrderedList={${resolved.enableOrderedList}}`,
    `enableTaskList={${resolved.enableTaskList}}`,
    `enableBlockquote={${resolved.enableBlockquote}}`,
    `enableCodeBlock={${resolved.enableCodeBlock}}`,
    `enableHorizontalRule={${resolved.enableHorizontalRule}}`,
    `enableTextAlign={${resolved.enableTextAlign}}`,
    `enableTextDirection={${resolved.enableTextDirection}}`,
    `enableIndent={${resolved.enableIndent}}`,
    `enableLink={${resolved.enableLink}}`,
    `enableImage={${resolved.enableImage}}`,
    `enableTable={${resolved.enableTable}}`,
    `enableClearFormatting={${resolved.enableClearFormatting}}`,
    `enableUndoRedo={${resolved.enableUndoRedo}}`,
  ].join(' ');
};
