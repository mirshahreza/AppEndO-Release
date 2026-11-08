export type HtmlEditorMode = 'visual' | 'source' | 'split' | 'preview';

export type HtmlEditorPreviewDevice = 'fluid' | 'desktop' | 'tablet' | 'mobile';

export const HTML_EDITOR_MODE_ORDER: HtmlEditorMode[] = [
  'visual',
  'source',
  'split',
  'preview',
];

export const HTML_EDITOR_PREVIEW_DEVICE_WIDTH: Record<
  Exclude<HtmlEditorPreviewDevice, 'fluid'>,
  number
> = {
  desktop: 1024,
  tablet: 768,
  mobile: 390,
};

export const HTML_EDITOR_DEFAULT_MODE: HtmlEditorMode = 'visual';
export const HTML_EDITOR_DEFAULT_PREVIEW_DEVICE: HtmlEditorPreviewDevice = 'fluid';
export const HTML_EDITOR_DEFAULT_HEIGHT = 360;
