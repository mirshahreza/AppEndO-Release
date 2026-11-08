import React from 'react';
import type { AppSurfaceBoxTone } from '../../../shared/ui/surfaceClasses';
import { APP_SURFACE_BOX_TONE_CLASS } from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import type { SectionId } from '../types';
import { BaseComponentsPageScrollArea } from './BaseComponentsPageScrollArea';
import { BaseComponentsPreviewViewportHost } from './BaseComponentsPreviewViewport';

/** Options/preview workspace is flush — the options rail owns its own chrome. */
export const BASE_COMPONENTS_WORKSPACE_INSET_CLASS = 'p-0';

type BaseComponentsPreviewFrameProps = {
  sectionId: SectionId;
  className?: string;
  children: React.ReactNode;
  /** Fill the pane without inner scroll — overlays stay centered in the body. */
  fill?: boolean;
};

/**
 * Preview pane for split baseComponents workspaces.
 * Grows with content on stacked (mobile) layouts; fills the grid cell on `lg+`
 * and scrolls internally so tall previews stay independent of the options column.
 */
export const BaseComponentsPreviewFrame: React.FC<BaseComponentsPreviewFrameProps> = ({
  sectionId,
  className,
  children,
  fill = false,
}) => (
  <div
    className={cn(
      'relative flex min-h-0 min-w-0 flex-col lg:col-start-1 lg:row-start-1 lg:h-full',
      fill && 'overflow-hidden',
      className,
    )}
    data-bc-preview-root={sectionId}
  >
    {fill ? (
      <div className="relative flex min-h-[28rem] flex-1 flex-col overflow-hidden bg-white lg:min-h-0">
        <BaseComponentsPreviewViewportHost>{children}</BaseComponentsPreviewViewportHost>
      </div>
    ) : (
      <BaseComponentsPageScrollArea
        className="flex-1 bg-white"
        viewportClassName="flex h-full min-h-0 flex-col"
        aria-label="Section preview"
      >
        <BaseComponentsPreviewViewportHost>{children}</BaseComponentsPreviewViewportHost>
      </BaseComponentsPageScrollArea>
    )}
  </div>
);

type BaseComponentsConfigJsonPreviewProps = {
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

export const BaseComponentsConfigJsonPreview: React.FC<BaseComponentsConfigJsonPreviewProps> = ({
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
