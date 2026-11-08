import React from 'react';
import { Tooltip } from '@heroui/react';
import { Bot } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideChromeProps } from './pageGuide/pageGuideChrome';
import { useAppEndOAttentionCue, type AppEndOAttentionVariant } from './useAppEndOAttentionCue';

export type ShellAppEndOButtonProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  openAriaLabel: string;
  closeAriaLabel: string;
  className?: string;
  iconClassName?: string;
};

const ATTENTION_CLASS: Record<AppEndOAttentionVariant, string> = {
  shimmer: 'appendo-attention-shimmer',
  lift: 'appendo-attention-lift',
  hue: 'appendo-attention-hue',
};

export const APPENDO_PRODUCT_NAME = 'AppEndO';

export const ShellAppEndOButton: React.FC<ShellAppEndOButtonProps> = ({
  isOpen,
  onOpenChange,
  openAriaLabel,
  closeAriaLabel,
  className,
  iconClassName,
}) => {
  const attentionCue = useAppEndOAttentionCue(isOpen);

  return (
    <Tooltip.Root delay={120} closeDelay={0}>
      <Tooltip.Trigger
        className={cn(
          'inline-flex shrink-0',
          attentionCue?.variant === 'lift' && 'appendo-attention-perspective',
        )}
      >
        <button
          type="button"
          onClick={() => onOpenChange(!isOpen)}
          aria-label={isOpen ? closeAriaLabel : openAriaLabel}
          {...pageGuideChromeProps((key) => PAGE_GUIDE_EN[key] ?? key, 'assistant', 14)}
          style={
            attentionCue
              ? ({
                  '--appendo-tilt-x': attentionCue.tiltX,
                  '--appendo-tilt-y': attentionCue.tiltY,
                } as React.CSSProperties)
              : undefined
          }
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-lg transition-colors shrink-0 cursor-pointer',
            isOpen
              ? 'text-primary-700 bg-primary-subtle/50 shadow-cyan-ring-sm'
              : 'text-slate-400 hover:text-primary-700 hover:bg-primary-subtle/45',
            attentionCue ? ATTENTION_CLASS[attentionCue.variant] : null,
            className,
          )}
        >
          <Bot className={cn('w-5 h-5 appendo-bot-icon', iconClassName)} aria-hidden />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content showArrow offset={8} className="z-[9999] px-3 py-1.5">
        <span className="appendo-tooltip-brand">{APPENDO_PRODUCT_NAME}</span>
      </Tooltip.Content>
    </Tooltip.Root>
  );
};
