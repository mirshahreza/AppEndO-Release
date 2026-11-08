import type { EuaAssistSurface } from '../../api/contracts/ai/euaFieldAssist';
import type { DesignerRichTextToolbarProps } from '../../lib/designerRichTextConfig';
import type { HtmlEditorMode, HtmlEditorPreviewDevice } from './types';

export type HtmlEditorProps = DesignerRichTextToolbarProps & {
  value?: string;
  defaultValue?: string;
  onChange?: (html: string) => void;
  mode?: HtmlEditorMode;
  defaultMode?: HtmlEditorMode;
  onModeChange?: (mode: HtmlEditorMode) => void;
  previewDevice?: HtmlEditorPreviewDevice;
  defaultPreviewDevice?: HtmlEditorPreviewDevice;
  onPreviewDeviceChange?: (device: HtmlEditorPreviewDevice) => void;
  placeholder?: string;
  editorHeight?: number | string;
  fontSize?: number;
  readOnly?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  className?: string;
  showModeBar?: boolean;
  /** Visual / source toggle on the rich-text toolbar row (use with `showModeBar={false}`). */
  toolbarVisualSourceSwitch?: boolean;
  showStats?: boolean;
  dir?: 'ltr' | 'rtl' | 'auto';
  aiAssist?: boolean;
  aiAssistSurface?: EuaAssistSurface;
  fieldLabel?: string;
  /** Trusted admin HTML: preview Lucide snippets and raw markup; skip designer sanitization. */
  trustedHtml?: boolean;
  /** Monaco HTML source only — no TipTap visual toolbar or mode switching. */
  sourceOnly?: boolean;
};
