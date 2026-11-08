import React from 'react';
import type { AppSurfaceBoxTone } from '../../shared/ui/surfaceClasses';
import { APP_SURFACE_BOX_TONE_CLASS } from '../../shared/ui/surfaceClasses';
import { cn } from '../../lib/utils';

type DevReferencePreviewFrameProps = {
  className?: string;
  children: React.ReactNode;
};

/**
 * Preview pane for split Developer Reference topic panels.
 * Grows with content on stacked (mobile) layouts; fills the grid cell on `lg+`
 * and scrolls internally so tall previews are never clipped.
 */
export const DevReferencePreviewFrame: React.FC<DevReferencePreviewFrameProps> = ({
  className,
  children,
}) => (
  <div className={cn('flex min-h-0 min-w-0 flex-col lg:h-full', className)}>
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-white">
      {children}
    </div>
  </div>
);

type DevReferenceJsonPreviewProps = {
  json: string;
  tone?: AppSurfaceBoxTone;
  className?: string;
};

const highlightJsonLine = (line: string): React.ReactNode => {
  const keyMatch = line.match(/^(\s*)("(?:\\.|[^"\\])*")(\s*:\s*)(.*)$/);
  if (!keyMatch) {
    return line;
  }

  const [, indent, key, separator, value] = keyMatch;
  const trimmedValue = value.trim();

  let valueClass = 'text-slate-700';
  if (trimmedValue === 'true' || trimmedValue === 'false') {
    valueClass = 'text-amber-700';
  } else if (trimmedValue.startsWith('"')) {
    valueClass = 'text-emerald-700';
  } else if (/^-?\d/.test(trimmedValue)) {
    valueClass = 'text-cyan-700';
  }

  return (
    <>
      {indent}
      <span className="text-indigo-700">{key}</span>
      {separator}
      <span className={valueClass}>{value}</span>
    </>
  );
};

export const DevReferenceJsonPreview: React.FC<DevReferenceJsonPreviewProps> = ({
  json,
  tone = 'slate',
  className,
}) => (
  <pre
    className={cn(
      'overflow-auto rounded-lg border bg-slate-950/[0.03] p-3 font-mono text-[11px] leading-relaxed',
      APP_SURFACE_BOX_TONE_CLASS[tone].shell,
      className,
    )}
  >
    {json.split('\n').map((line, index) => (
      <div key={index}>{highlightJsonLine(line)}</div>
    ))}
  </pre>
);
