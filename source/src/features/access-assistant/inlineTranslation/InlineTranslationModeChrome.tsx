import React from 'react';
import { Check, GripVertical, Languages } from 'lucide-react';
import { AppButton } from '../../../shared/ui';
import { HeaderHintTooltip } from '../../../shared/ui/SideHintTooltip';
import { cn } from '../../../lib/utils';
import { useDraggableFloatingChip } from './useDraggableFloatingChip';
import { INLINE_TRANSLATION_MODE_CHROME_Z_CLASS } from './inlineTranslationDomMarkers';

export type InlineTranslationModeChromeProps = {
  onFinish: () => void;
};

export const InlineTranslationModeChrome: React.FC<InlineTranslationModeChromeProps> = ({
  onFinish,
}) => {
  const {
    chipRef,
    chipStyle,
    onDragHandlePointerDown,
    onDragHandlePointerMove,
    onDragHandlePointerUp,
  } = useDraggableFloatingChip(true);

  return (
    <div
      ref={chipRef}
      style={chipStyle}
      className={cn(
        'pointer-events-auto fixed flex max-w-[min(100vw-2rem,22rem)] items-center gap-1.5',
        INLINE_TRANSLATION_MODE_CHROME_Z_CLASS,
        'rounded-full border border-emerald-200/90 bg-white/95 py-1 pe-1.5 ps-1 shadow-md backdrop-blur-sm',
      )}
      role="status"
      aria-live="polite"
      data-inline-translation-ignore
    >
      <button
        type="button"
        className="flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
        aria-label="Drag translation mode bar"
        onPointerDown={onDragHandlePointerDown}
        onPointerMove={onDragHandlePointerMove}
        onPointerUp={onDragHandlePointerUp}
        onPointerCancel={onDragHandlePointerUp}
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden />
      </button>
      <HeaderHintTooltip
        title="Inline translation mode"
        hint="Click the language icons on labels to edit copy. Other page actions stay paused until you tap Done."
        tone="emerald"
      >
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <Languages className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          <span className="truncate text-[11px] font-semibold text-slate-700">
            Editing labels
          </span>
        </span>
      </HeaderHintTooltip>
      <AppButton
        intent="primary"
        size="sm"
        className="h-7 shrink-0 rounded-full px-2.5 text-[11px]"
        onClick={onFinish}
      >
        <Check className="h-3 w-3" aria-hidden />
        Done
      </AppButton>
    </div>
  );
};
