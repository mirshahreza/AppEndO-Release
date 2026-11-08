import { useCallback, useMemo, useState } from 'react';
import { sanitizeDesignerHtml } from '../../../domain/component-designer/sanitizeDesignerHtml';
import { formatHtmlSource } from '../../lib/formatHtmlSource';
import { computeHtmlEditorStats } from '../../lib/htmlEditorStats';
import {
  HTML_EDITOR_DEFAULT_MODE,
  HTML_EDITOR_DEFAULT_PREVIEW_DEVICE,
  type HtmlEditorMode,
  type HtmlEditorPreviewDevice,
} from './types';

export type UseHtmlEditorStateOptions = {
  value?: string;
  defaultValue?: string;
  mode?: HtmlEditorMode;
  defaultMode?: HtmlEditorMode;
  previewDevice?: HtmlEditorPreviewDevice;
  defaultPreviewDevice?: HtmlEditorPreviewDevice;
  onChange?: (html: string) => void;
  onModeChange?: (mode: HtmlEditorMode) => void;
  onPreviewDeviceChange?: (device: HtmlEditorPreviewDevice) => void;
  /** Admin-trusted HTML: no sanitize pass for visual/preview surfaces. */
  trustedHtml?: boolean;
};

export type UseHtmlEditorStateResult = {
  /** Raw editor document (may contain incomplete tags while typing in Source). */
  html: string;
  /** Safe HTML for Visual TipTap + Preview surfaces. */
  safeHtml: string;
  mode: HtmlEditorMode;
  previewDevice: HtmlEditorPreviewDevice;
  formatting: boolean;
  stats: ReturnType<typeof computeHtmlEditorStats>;
  setHtml: (next: string) => void;
  setMode: (mode: HtmlEditorMode) => void;
  setPreviewDevice: (device: HtmlEditorPreviewDevice) => void;
  formatHtml: () => Promise<void>;
  copyHtml: () => Promise<boolean>;
};

export const useHtmlEditorState = ({
  value,
  defaultValue = '',
  mode: controlledMode,
  defaultMode = HTML_EDITOR_DEFAULT_MODE,
  previewDevice: controlledPreviewDevice,
  defaultPreviewDevice = HTML_EDITOR_DEFAULT_PREVIEW_DEVICE,
  onChange,
  onModeChange,
  onPreviewDeviceChange,
  trustedHtml = false,
}: UseHtmlEditorStateOptions): UseHtmlEditorStateResult => {
  const isHtmlControlled = value !== undefined;
  const [uncontrolledHtml, setUncontrolledHtml] = useState(
    () => (typeof defaultValue === 'string' ? defaultValue : ''),
  );
  const [uncontrolledMode, setUncontrolledMode] = useState<HtmlEditorMode>(defaultMode);
  const [uncontrolledPreviewDevice, setUncontrolledPreviewDevice] = useState<HtmlEditorPreviewDevice>(
    defaultPreviewDevice,
  );
  const [formatting, setFormatting] = useState(false);

  const html = isHtmlControlled
    ? (typeof value === 'string' ? value : '')
    : uncontrolledHtml;
  const safeHtml = useMemo(
    () => (trustedHtml ? html : sanitizeDesignerHtml(html)),
    [html, trustedHtml],
  );
  const mode = controlledMode ?? uncontrolledMode;
  const previewDevice = controlledPreviewDevice ?? uncontrolledPreviewDevice;

  const setHtml = useCallback((next: string) => {
    const nextHtml = typeof next === 'string' ? next : '';
    if (!isHtmlControlled) {
      setUncontrolledHtml(nextHtml);
    }
    onChange?.(nextHtml);
  }, [isHtmlControlled, onChange]);

  const setMode = useCallback((next: HtmlEditorMode) => {
    if (controlledMode === undefined) {
      setUncontrolledMode(next);
    }
    onModeChange?.(next);
  }, [controlledMode, onModeChange]);

  const setPreviewDevice = useCallback((next: HtmlEditorPreviewDevice) => {
    if (controlledPreviewDevice === undefined) {
      setUncontrolledPreviewDevice(next);
    }
    onPreviewDeviceChange?.(next);
  }, [controlledPreviewDevice, onPreviewDeviceChange]);

  const formatHtml = useCallback(async () => {
    setFormatting(true);
    try {
      const formatted = await formatHtmlSource(html);
      setHtml(formatted);
    } finally {
      setFormatting(false);
    }
  }, [html, setHtml]);

  const copyHtml = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(html);
      return true;
    } catch {
      return false;
    }
  }, [html]);

  const stats = useMemo(() => computeHtmlEditorStats(html), [html]);

  return {
    html,
    safeHtml,
    mode,
    previewDevice,
    formatting,
    stats,
    setHtml,
    setMode,
    setPreviewDevice,
    formatHtml,
    copyHtml,
  };
};
