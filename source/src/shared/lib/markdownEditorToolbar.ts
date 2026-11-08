export type MarkdownEditorToolbarPreset = 'minimal' | 'standard' | 'full';

/** Living sample: Base Components → Markdown editor toolbar presets. */
export const markdownToolbarProps = (toolbar: MarkdownEditorToolbarPreset) => ({
  showToolbar: toolbar !== 'minimal',
  enableHeading: toolbar !== 'minimal',
  enableLink: toolbar !== 'minimal',
  enableCodeBlock: toolbar !== 'minimal',
  enableImage: toolbar === 'full',
  enableTable: toolbar === 'full',
  enableTextDirection: toolbar !== 'minimal',
});
