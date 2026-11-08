import React, { useLayoutEffect, useState } from 'react';

const resolveGhostField = (wrapper: HTMLElement | null): HTMLTextAreaElement | HTMLInputElement | null => {
  if (!wrapper) return null;
  const textarea = wrapper.querySelector('textarea');
  if (textarea instanceof HTMLTextAreaElement) return textarea;
  const input = wrapper.querySelector('input:not([type="hidden"])');
  if (input instanceof HTMLInputElement) return input;
  return null;
};

type GhostMirrorStyle = {
  top: number;
  left: number;
  width: number;
  height: number;
  padding: string;
  font: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  direction: string;
  whiteSpace: 'pre' | 'pre-wrap';
};

type AiAutocompleteGhostLayerProps = {
  wrapper: HTMLElement | null;
  value: string;
  completion: string;
};

/**
 * Mirror layer for inline ghost completion aligned to the native textarea box.
 */
export const AiAutocompleteGhostLayer: React.FC<AiAutocompleteGhostLayerProps> = ({
  wrapper,
  value,
  completion,
}) => {
  const [mirrorStyle, setMirrorStyle] = useState<GhostMirrorStyle | null>(null);

  useLayoutEffect(() => {
    const field = resolveGhostField(wrapper);
    if (!field || !wrapper || !completion) {
      setMirrorStyle(null);
      return;
    }

    const sync = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const computed = window.getComputedStyle(field);
      setMirrorStyle({
        top: fieldRect.top - wrapperRect.top,
        left: fieldRect.left - wrapperRect.left,
        width: field.clientWidth,
        height: field.clientHeight,
        padding: computed.padding,
        font: computed.font,
        lineHeight: computed.lineHeight,
        letterSpacing: computed.letterSpacing,
        textAlign: computed.textAlign,
        direction: computed.direction,
        whiteSpace: field instanceof HTMLInputElement ? 'pre' : 'pre-wrap',
      });
    };

    sync();

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(sync)
      : null;
    observer?.observe(field);
    observer?.observe(wrapper);
    window.addEventListener('resize', sync);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [completion, value, wrapper]);

  if (!completion || !mirrorStyle) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-0 overflow-hidden break-words text-slate-700"
      style={{
        top: mirrorStyle.top,
        left: mirrorStyle.left,
        width: mirrorStyle.width,
        height: mirrorStyle.height,
        padding: mirrorStyle.padding,
        font: mirrorStyle.font,
        lineHeight: mirrorStyle.lineHeight,
        letterSpacing: mirrorStyle.letterSpacing,
        textAlign: mirrorStyle.textAlign as React.CSSProperties['textAlign'],
        direction: mirrorStyle.direction as React.CSSProperties['direction'],
        whiteSpace: mirrorStyle.whiteSpace,
      }}
    >
      <span className="invisible">{value}</span>
      <span className="text-slate-400">{completion}</span>
    </div>
  );
};
