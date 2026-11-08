import React from 'react';
import { FieldHintTooltip } from '../../../shared/ui/FieldHintTooltip';
import { pageGuideProps } from '../../../shared/ui/shell/pageGuide/pageGuide.attrs';
import { UiTooltip } from '../../../shared/ui/UiTooltip';
import type { DesignerInspectorHelpEntry } from '../lib/designerInspectorHelp';
import { InspectorFieldHelpLink } from './InspectorFieldHelpLink';
import {
  INSPECTOR_TEXT_XS,
} from './inspectorDesignTokens';

/** Fixed inspector label column — truncate overflow; full text via tooltip. */
export const DESIGNER_FIELD_LABEL_WIDTH_PX = 100;
export const DESIGNER_FIELD_LABEL_WIDTH_CLASS = 'w-[100px]';
export const DESIGNER_FIELD_LABEL_CLASS =
  `${DESIGNER_FIELD_LABEL_WIDTH_CLASS} shrink-0 ps-[4px] ${INSPECTOR_TEXT_XS} font-semibold text-slate-700`;

/**
 * Phase 7: `layout="inline"` is live (not dead) — consumed by
 * `InspectorVisualStylePanel` via `CONTAINER_LAYOUT_FIELD`. Keep both modes.
 * Phase-4 primitives (`InspectorMicroLabel` / `InspectorFieldGroup`) live only in
 * `inspectorFieldPrimitives.tsx` (no barrel re-export from this file).
 */
type DesignerFieldRowProps = {
  label: string;
  children: React.ReactNode;
  align?: 'center' | 'start';
  /** Default `inline`: 100px label + control row. Use `stack` for tall/dialog fields. */
  layout?: 'inline' | 'stack';
  className?: string;
  labelClassName?: string;
  contentClassName?: string;
  help?: DesignerInspectorHelpEntry | null;
  /** Operator guidance via FieldHintTooltip (info icon) — not under-field paragraphs. */
  hint?: string;
  /** Extra chrome after the label text (e.g. custom info popover) — never place beside the control. */
  labelExtra?: React.ReactNode;
};

const TruncatedFieldLabelText: React.FC<{ text: string }> = ({ text }) => {
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  const measure = React.useCallback(() => {
    const el = textRef.current;
    if (!el) {
      return;
    }
    setIsTruncated(el.scrollWidth > el.clientWidth + 0.5);
  }, []);

  React.useLayoutEffect(() => {
    measure();
  }, [text, measure]);

  React.useEffect(() => {
    const el = textRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const textNode = (
    <span ref={textRef} className="block min-w-0 truncate">
      {text}
    </span>
  );

  if (!isTruncated) {
    return <span className="min-w-0 flex-1">{textNode}</span>;
  }

  return (
    <UiTooltip
      content={text}
      placement="top"
      delay={200}
      className="min-w-0 flex-1 overflow-hidden text-start"
    >
      {textNode}
    </UiTooltip>
  );
};

/** 100px inspector label with truncate + tooltip when overflow. */
export const InspectorFieldLabel: React.FC<{
  text: string;
  className?: string;
  help?: DesignerInspectorHelpEntry | null;
  hint?: string;
  labelExtra?: React.ReactNode;
  screenReaderOnly?: boolean;
}> = ({
  text,
  className,
  help = null,
  hint,
  labelExtra,
  screenReaderOnly = false,
}) => {
  if (screenReaderOnly) {
    return <label className="sr-only">{text}</label>;
  }

  return (
    <label className={['flex items-center gap-0.5', DESIGNER_FIELD_LABEL_CLASS, className].filter(Boolean).join(' ')}>
      <TruncatedFieldLabelText text={text} />
      {hint ? <FieldHintTooltip hint={hint} label={text} /> : null}
      {help ? <InspectorFieldHelpLink help={help} /> : null}
      {labelExtra ? <span className="inline-flex shrink-0 items-center">{labelExtra}</span> : null}
    </label>
  );
};

export const DesignerFieldRow: React.FC<DesignerFieldRowProps> = ({
  label,
  children,
  align = 'center',
  layout = 'inline',
  className,
  labelClassName,
  contentClassName,
  help = null,
  hint,
  labelExtra,
}) => {
  const isStacked = layout === 'stack';
  const isScreenReaderOnly = Boolean(labelClassName?.includes('sr-only'));
  const guideHint = hint?.trim() || help?.tooltip?.trim() || '';

  const rootClassName = [
    'designer-field-row',
    isStacked ? 'flex flex-col gap-[2px]' : 'flex gap-2',
    !isStacked && (align === 'start' ? 'items-start' : 'items-center'),
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const resolvedLabelClassName = [
    isScreenReaderOnly
      ? 'sr-only'
      : isStacked
        ? `w-full ps-[4px] ${INSPECTOR_TEXT_XS} font-semibold text-slate-700`
        : `flex ${DESIGNER_FIELD_LABEL_CLASS} items-center gap-0.5`,
    !isScreenReaderOnly ? labelClassName : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  const resolvedContentClassName = ['min-w-0', isStacked ? 'w-full' : 'flex-1', contentClassName]
    .filter(Boolean)
    .join(' ');

  const labelAddons = (
    <>
      {hint ? <FieldHintTooltip hint={hint} label={label} /> : null}
      {help ? <InspectorFieldHelpLink help={help} /> : null}
      {labelExtra ? <span className="inline-flex shrink-0 items-center">{labelExtra}</span> : null}
    </>
  );

  return (
    <div
      className={rootClassName}
      {...(guideHint
        ? pageGuideProps({ title: label, hint: guideHint, priority: 50, surface: true })
        : {})}
    >
      <label className={resolvedLabelClassName}>
        {isScreenReaderOnly || isStacked ? (
          <span className="inline-flex items-center gap-1">
            <span>{label}</span>
            {labelAddons}
          </span>
        ) : (
          <>
            <TruncatedFieldLabelText text={label} />
            {labelAddons}
          </>
        )}
      </label>
      <div className={resolvedContentClassName}>{children}</div>
    </div>
  );
};
