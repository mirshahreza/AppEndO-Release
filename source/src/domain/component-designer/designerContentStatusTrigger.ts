import type { CSSProperties } from 'react';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';
import { coerceApiRecordValue, readNestedContextValue } from './bindingResourceModel';
import {
  findAncestorDataRegion,
  resolveAncestorRegionDataVar,
} from './bindingRegionEngine';
import { resolveLucideIconNameFromUiHtml } from '../../shared/lib/baseInfoUiIcon';
import { hexToRgba, normalizeHexColor, readRowUiColor } from '../../shared/lib/uiColorUtils';

export const CONTENT_STATUS_COLORED_BUTTON_BASE_CLASS =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors hover:opacity-90';

/** Multi-line status options (title + Base Info note) — softer fill/border than compact triggers. */
export const CONTENT_STATUS_OPTION_BUTTON_CLASS =
  'inline-flex h-auto min-h-[2.75rem] w-full shrink-0 items-center justify-start gap-3 rounded-md border px-3 py-2.5 text-left text-xs font-semibold leading-snug whitespace-normal transition-[background-color,border-color,box-shadow,font-weight] hover:font-bold hover:[background-color:var(--status-option-hover-bg)] hover:[border-color:var(--status-option-hover-border)] hover:shadow-sm';

const CONTENT_STATUS_OPTION_SOFT_BG_ALPHA = 0.055;
const CONTENT_STATUS_OPTION_SOFT_BORDER_ALPHA = 0.38;
const CONTENT_STATUS_OPTION_HOVER_BG_ALPHA = 0.14;
const CONTENT_STATUS_OPTION_HOVER_BORDER_ALPHA = 0.62;

const CONTENT_STATUS_TRIGGER_BASE_CLASS =
  'inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-semibold leading-none transition-colors hover:opacity-90 [&>svg]:shrink-0 [&>svg]:self-center';

const CONTENT_STATUS_TRIGGER_FALLBACK_CLASS =
  `${CONTENT_STATUS_TRIGGER_BASE_CLASS} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

/** Read-only status label (title + icon) — no button chrome. */
const CONTENT_STATUS_DISPLAY_BASE_CLASS =
  'inline-flex shrink-0 items-center justify-end gap-1 text-[11px] font-semibold leading-none [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 [&>svg]:self-center';

const CONTENT_STATUS_DISPLAY_FALLBACK_CLASS =
  `${CONTENT_STATUS_DISPLAY_BASE_CLASS} text-slate-700`;

const CONTENT_STATUS_OPTION_FALLBACK_CLASS =
  `${CONTENT_STATUS_OPTION_BUTTON_CLASS} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

export const buildContentStatusColoredAppearance = (
  color: string | null,
  baseClassName?: string,
  softFill = false,
): { className: string; style?: CSSProperties } => {
  const base = baseClassName ?? CONTENT_STATUS_COLORED_BUTTON_BASE_CLASS;
  if (!color) {
    if (baseClassName?.includes('w-full')) {
      return { className: CONTENT_STATUS_OPTION_FALLBACK_CLASS };
    }
    if (base === CONTENT_STATUS_DISPLAY_BASE_CLASS) {
      return { className: CONTENT_STATUS_DISPLAY_FALLBACK_CLASS };
    }
    return { className: CONTENT_STATUS_TRIGGER_FALLBACK_CLASS };
  }

  if (base === CONTENT_STATUS_DISPLAY_BASE_CLASS) {
    return {
      className: base,
      style: { color },
    };
  }

  if (softFill) {
    return {
      className: base,
      style: {
        borderColor: hexToRgba(color, CONTENT_STATUS_OPTION_SOFT_BORDER_ALPHA) ?? color,
        color,
        backgroundColor: hexToRgba(color, CONTENT_STATUS_OPTION_SOFT_BG_ALPHA) ?? undefined,
        ['--status-option-hover-bg' as string]:
          hexToRgba(color, CONTENT_STATUS_OPTION_HOVER_BG_ALPHA) ?? undefined,
        ['--status-option-hover-border' as string]:
          hexToRgba(color, CONTENT_STATUS_OPTION_HOVER_BORDER_ALPHA) ?? color,
      } as CSSProperties,
    };
  }

  return {
    className: base,
    style: {
      borderColor: color,
      color,
      backgroundColor: hexToRgba(color, 0.1) ?? undefined,
    },
  };
};

export const resolveContentStatusOptionAppearance = (
  colorRaw: unknown,
): { className: string; style?: CSSProperties } => (
  buildContentStatusColoredAppearance(
    normalizeHexColor(colorRaw),
    CONTENT_STATUS_OPTION_BUTTON_CLASS,
    true,
  )
);

export const resolveContentStatusTriggerAppearance = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
  fallbackLabel: string,
): { className: string; style?: CSSProperties } => {
  const isDisplay = node.props.contentStatusDisplay === true;
  const baseClassName = isDisplay
    ? CONTENT_STATUS_DISPLAY_BASE_CLASS
    : CONTENT_STATUS_TRIGGER_BASE_CLASS;
  const fallbackClassName = isDisplay
    ? CONTENT_STATUS_DISPLAY_FALLBACK_CLASS
    : CONTENT_STATUS_TRIGGER_FALLBACK_CLASS;

  const document = options.previewEvents?.document;
  const bindingContext = options.previewEvents?.bindingContext;
  if (!document || !bindingContext) {
    return { className: fallbackClassName };
  }

  const ancestor = findAncestorDataRegion(document, node.id);
  if (!ancestor) {
    return { className: fallbackClassName };
  }

  const dataVar = resolveAncestorRegionDataVar(document, ancestor);
  const record = coerceApiRecordValue(readNestedContextValue(bindingContext, dataVar));
  const color = record
    ? normalizeHexColor(record.statusCodeUiColor) ?? readRowUiColor(record)
    : null;

  return buildContentStatusColoredAppearance(color, baseClassName);
};

export const resolveContentStatusTriggerIconName = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): string | null => {
  const document = options.previewEvents?.document;
  const bindingContext = options.previewEvents?.bindingContext;
  if (!document || !bindingContext) {
    return null;
  }

  const ancestor = findAncestorDataRegion(document, node.id);
  if (!ancestor) {
    return null;
  }

  const dataVar = resolveAncestorRegionDataVar(document, ancestor);
  const record = coerceApiRecordValue(readNestedContextValue(bindingContext, dataVar));
  return record
    ? resolveLucideIconNameFromUiHtml(
      typeof record.statusCodeUiHtml === 'string' ? record.statusCodeUiHtml : null,
    )
    : null;
};
