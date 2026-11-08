import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { UI_ACCORDION_CHROME_CLASS, resolveUiAccordionOpenHeaderClass, type UiAccordionChrome, type UiAccordionOpenHeaderTone } from './UiAccordion';

type UiDisclosureSharedProps = {
  trigger: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
  isDisabled?: boolean;
  variant?: 'bordered' | 'separated';
  /** Item surface: border, raised shadow, both, or none. Overrides `variant` chrome when set. */
  chrome?: UiAccordionChrome;
  /** Header tint while expanded. Default `none`. */
  openHeaderTone?: UiAccordionOpenHeaderTone;
  density?: 'compact' | 'default';
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
};

type UiDisclosureControlledProps = {
  isExpanded: boolean;
  defaultExpanded?: never;
  onExpandedChange?: (expanded: boolean) => void;
};

type UiDisclosureUncontrolledProps = {
  isExpanded?: never;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export type UiDisclosureProps = UiDisclosureSharedProps
  & (UiDisclosureControlledProps | UiDisclosureUncontrolledProps);

/**
 * A single disclosure trigger and region. Use `UiAccordion` when sibling
 * expansion must be coordinated.
 */
export const UiDisclosure: React.FC<UiDisclosureProps> = ({
  trigger,
  summary,
  children,
  isExpanded,
  defaultExpanded = false,
  onExpandedChange,
  isDisabled = false,
  variant = 'bordered',
  chrome,
  openHeaderTone = 'none',
  density = 'default',
  className,
  triggerClassName,
  panelClassName,
}) => {
  const panelId = React.useId();
  const [uncontrolledExpanded, setUncontrolledExpanded] = React.useState(defaultExpanded);
  const controlled = isExpanded !== undefined;
  const expanded = controlled ? isExpanded : uncontrolledExpanded;

  const toggle = () => {
    if (isDisabled) return;
    const next = !expanded;
    if (!controlled) setUncontrolledExpanded(next);
    onExpandedChange?.(next);
  };

  return (
    <div
      className={cn(
        chrome
          ? UI_ACCORDION_CHROME_CLASS[chrome]
          : cn(
              'overflow-hidden rounded-lg border bg-white',
              variant === 'bordered' ? 'border-slate-300' : 'border-slate-200 shadow-sm',
            ),
        isDisabled && 'opacity-60',
        className,
      )}
      data-variant={variant}
      data-chrome={chrome}
      data-open-header-tone={openHeaderTone}
      data-density={density}
    >
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-3 text-start text-slate-800 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 [@media(pointer:coarse)]:min-h-11',
          density === 'compact' ? 'px-3 py-2' : 'px-4 py-3',
          resolveUiAccordionOpenHeaderClass(openHeaderTone, expanded),
          triggerClassName,
        )}
        aria-expanded={expanded}
        aria-controls={panelId}
        disabled={isDisabled}
        onClick={toggle}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{trigger}</span>
          {summary ? <span className="mt-0.5 block text-xs text-slate-500">{summary}</span> : null}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        role="region"
        hidden={!expanded}
        className={cn(
          'border-t border-slate-200 text-sm text-slate-700',
          density === 'compact' ? 'px-3 py-2' : 'px-4 py-3',
          panelClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
};
