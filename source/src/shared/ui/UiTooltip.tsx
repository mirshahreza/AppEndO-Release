import React from 'react';
import { Tooltip } from '@heroui/react';

const HeroTooltip = Tooltip as any;

export type UiTooltipPlacement =
  | 'top' | 'bottom' | 'left' | 'right'
  | 'top start' | 'top end' | 'bottom start' | 'bottom end'
  | 'left top' | 'left bottom' | 'right top' | 'right bottom';

export type UiTooltipProps = {
  /** Tooltip body content. */
  content: React.ReactNode;
  /** Trigger element — rendered inside the focusable `Tooltip.Trigger`. */
  children: React.ReactNode;
  contentClassName?: string;
  placement?: UiTooltipPlacement;
  showArrow?: boolean;
  offset?: number;
  delay?: number;
  closeDelay?: number;
  shouldFlip?: boolean;
  id?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Trigger wrapper's own class/style/handlers — HeroUI's `Tooltip.Trigger` is itself a focusable element. */
  className?: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent) => void;
  disabled?: boolean;
  'aria-label'?: string;
};

/**
 * Thin wrapper over HeroUI's `Tooltip.Root/Trigger/Content` compound API.
 * Reference for the standard call-shape: `default delay=120 closeDelay=0`, `showArrow`, `offset=8`.
 */
export const UiTooltip: React.FC<UiTooltipProps> = ({
  content,
  children,
  contentClassName,
  placement,
  showArrow = true,
  offset = 8,
  delay = 120,
  closeDelay = 0,
  shouldFlip = true,
  id,
  isOpen,
  onOpenChange,
  className,
  style,
  onClick,
  disabled,
  'aria-label': ariaLabel,
}) => (
  <HeroTooltip.Root delay={delay} closeDelay={closeDelay} isOpen={isOpen} onOpenChange={onOpenChange}>
    <HeroTooltip.Trigger
      className={className}
      style={style}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </HeroTooltip.Trigger>
    <HeroTooltip.Content
      id={id}
      showArrow={showArrow}
      offset={offset}
      placement={placement}
      shouldFlip={shouldFlip}
      className={contentClassName}
    >
      {content}
    </HeroTooltip.Content>
  </HeroTooltip.Root>
);
