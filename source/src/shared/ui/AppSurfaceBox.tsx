import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  APP_SURFACE_BOX_BODY_CLASS,
  APP_SURFACE_BOX_HEADER_CLASS,
  APP_SURFACE_BOX_SHELL_CLASS,
  APP_SURFACE_BOX_STRIP_CLASS,
  APP_SURFACE_BOX_TITLE_CLASS,
  APP_SURFACE_BOX_TONE_CLASS,
  resolveAppSurfaceBoxTone,
  type AppSurfaceBoxTone,
} from './surfaceClasses';

export type AppSurfaceBoxLayout = 'panel' | 'strip';

export type AppSurfaceBoxProps = {
  tone?: AppSurfaceBoxTone;
  layout?: AppSurfaceBoxLayout;
  title?: React.ReactNode;
  /** Optional trailing content in the header row (path preview, counts, actions). */
  headerExtra?: React.ReactNode;
  /** When true, box grows to fill remaining flex space and body scrolls. */
  fill?: boolean;
  /**
   * When true, the header toggles body visibility.
   * Default false — existing consumers keep always-open panel behavior.
   */
  collapsible?: boolean;
  /** Controlled open state (when provided with `onOpenChange`). */
  open?: boolean;
  /** Uncontrolled initial open state when `open` is omitted. Default false. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};

export const AppSurfaceBox: React.FC<AppSurfaceBoxProps> = ({
  tone = 'slate',
  layout = 'panel',
  title,
  headerExtra,
  fill = false,
  collapsible = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  headerClassName,
  bodyClassName,
  children,
}) => {
  const resolvedTone = resolveAppSurfaceBoxTone(tone);
  const tokens = APP_SURFACE_BOX_TONE_CLASS[resolvedTone];
  const hasTitle = title !== null && title !== undefined && title !== '';
  const showHeader = layout === 'panel' && (hasTitle || headerExtra || collapsible);

  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isOpen = collapsible ? (isControlled ? Boolean(openProp) : uncontrolledOpen) : true;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const toggleOpen = React.useCallback(() => {
    if (!collapsible) return;
    setOpen(!isOpen);
  }, [collapsible, isOpen, setOpen]);

  if (layout === 'strip') {
    return (
      <div className={cn(APP_SURFACE_BOX_STRIP_CLASS, tokens.strip, className)} data-layout="strip" data-tone={resolvedTone}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        APP_SURFACE_BOX_SHELL_CLASS,
        tokens.shell,
        fill ? 'flex min-h-0 flex-1 flex-col' : 'shrink-0',
        className,
      )}
      data-collapsed={collapsible ? (isOpen ? 'false' : 'true') : undefined}
      data-layout="panel"
      data-tone={resolvedTone}
      data-fill={fill}
    >
      {showHeader ? (
        <div
          className={cn(
            APP_SURFACE_BOX_HEADER_CLASS,
            tokens.header,
            collapsible ? 'cursor-pointer select-none' : null,
            headerClassName,
          )}
          role={collapsible ? 'button' : undefined}
          tabIndex={collapsible ? 0 : undefined}
          aria-expanded={collapsible ? isOpen : undefined}
          onClick={collapsible ? toggleOpen : undefined}
          onKeyDown={
            collapsible
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleOpen();
                  }
                }
              : undefined
          }
        >
          {hasTitle ? (
            <span className={cn(APP_SURFACE_BOX_TITLE_CLASS, tokens.title, 'inline-flex min-w-0 items-center gap-1')}>
              {title}
            </span>
          ) : null}
          {headerExtra ? (
            <div
              className="min-w-0 w-full flex-1 sm:w-auto"
              onClick={collapsible ? (event) => event.stopPropagation() : undefined}
              onKeyDown={collapsible ? (event) => event.stopPropagation() : undefined}
            >
              {headerExtra}
            </div>
          ) : null}
          {collapsible ? (
            <ChevronDown
              className={cn(
                'ms-auto h-3.5 w-3.5 shrink-0 opacity-70 transition-transform',
                tokens.title,
                isOpen ? 'rotate-0' : '-rotate-90',
              )}
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}
      {isOpen ? (
        <div
          className={cn(
            APP_SURFACE_BOX_BODY_CLASS,
            fill ? 'min-h-0 flex-1 overflow-y-auto' : null,
            bodyClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};
