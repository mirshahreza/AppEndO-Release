import { describe, expect, it } from 'vitest';
import {
  hasAnyDesignerRichTextToolbarFeature,
  resolveDesignerRichTextToolbarConfig,
  resolveDesignerRichTextToolbarProps,
} from '../../../shared/lib/designerRichTextConfig';

describe('designerRichTextConfig', () => {
  it('enables the expanded default toolbar feature set', () => {
    const config = resolveDesignerRichTextToolbarConfig({});

    expect(config.showToolbar).toBe(true);
    expect(config.bold).toBe(true);
    expect(config.inlineCode).toBe(true);
    expect(config.taskList).toBe(true);
    expect(config.image).toBe(true);
    expect(config.table).toBe(true);
    expect(config.clearFormatting).toBe(true);
    expect(config.codeBlock).toBe(false);
    expect(hasAnyDesignerRichTextToolbarFeature(config)).toBe(true);
  });

  it('respects explicit toolbar toggles from inspector props', () => {
    const config = resolveDesignerRichTextToolbarConfig({
      showToolbar: false,
      enableBold: false,
      enableTable: false,
      enableCodeBlock: true,
    });

    expect(config.showToolbar).toBe(false);
    expect(config.bold).toBe(false);
    expect(config.table).toBe(false);
    expect(config.codeBlock).toBe(true);
    expect(hasAnyDesignerRichTextToolbarFeature(config)).toBe(false);
  });

  it('maps toolbar props for runtime and codegen', () => {
    const props = resolveDesignerRichTextToolbarProps({
      enableImage: false,
      enableTaskList: true,
    });

    expect(props.enableImage).toBe(false);
    expect(props.enableTaskList).toBe(true);
    expect(props.enableBold).toBe(true);
  });
});
