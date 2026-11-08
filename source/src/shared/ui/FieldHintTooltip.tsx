import React, { useEffect, useId, useRef, useState } from 'react';
import { Tooltip } from '@heroui/react';
import { Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { pageGuideProps } from './shell/pageGuide/pageGuide.attrs';
import { FormAccessorySlot } from './formTabOrder';
import {
  FORM_THEME_INK_HINT_CLASS,
  FORM_THEME_INK_HINT_OPEN_CLASS,
  type FormThemeInk,
} from './formThemeInk';

export type FieldHintTooltipProps = {
  /** Operator-facing hint body shown in the HeroUI tooltip. */
  hint: string;
  /** Used for accessible “About {label}” naming. */
  label: string;
  contentClassName?: string;
  className?: string;
  /** Theme-channel tint for the info trigger (inherits from FormSection `ink`). */
  ink?: FormThemeInk;
};

/**
 * Canonical field / label hint — HeroUI Tooltip + compact info trigger.
 * Do not use native `title`, under-field slate helper paragraphs, or ad-hoc hint chrome.
 */
export const FieldHintTooltip: React.FC<FieldHintTooltipProps> = ({
  hint,
  label,
  contentClassName,
  className,
  ink,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hintId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  return (
    <FormAccessorySlot className={cn('inline-flex', className)}>
      <div
        ref={rootRef}
        {...pageGuideProps({ title: label, hint, priority: 55 })}
      >
        <Tooltip.Root isOpen={isOpen} onOpenChange={setIsOpen} delay={0} closeDelay={0}>
          <Tooltip.Trigger>
            <button
              type="button"
              tabIndex={-1}
              className={cn(
                'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                'transition-colors',
                ink
                  ? FORM_THEME_INK_HINT_CLASS[ink]
                  : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600',
                isOpen && (ink ? FORM_THEME_INK_HINT_OPEN_CLASS[ink] : 'bg-indigo-50 text-indigo-600'),
              )}
              aria-label={`About ${label}`}
              aria-expanded={isOpen}
              aria-controls={hintId}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsOpen((open) => !open);
              }}
            >
              <Info className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content
            id={hintId}
            showArrow
            offset={8}
            placement="top"
            className={cn(
              'z-[9999] max-w-[18rem] border border-slate-700/70 bg-slate-900 px-3 py-2.5',
              'text-[11px] font-medium leading-relaxed text-slate-100 shadow-xl shadow-slate-900/25',
              contentClassName,
            )}
          >
            {hint}
          </Tooltip.Content>
        </Tooltip.Root>
      </div>
    </FormAccessorySlot>
  );
};
