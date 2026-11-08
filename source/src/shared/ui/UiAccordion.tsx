import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Accordion } from '@heroui/react';
import { cn } from '../../lib/utils';
import { SHADOW_RAISED, APP_SURFACE_BOX_TONE_CLASS, type AppSurfaceBoxTone } from './surfaceClasses';

const HeroAccordion = Accordion as unknown as React.FC<Record<string, unknown>> & {
  Item: React.FC<Record<string, unknown>>;
  Heading: React.FC<Record<string, unknown>>;
  Trigger: React.FC<Record<string, unknown>>;
  Indicator: React.FC<Record<string, unknown>>;
  Panel: React.FC<Record<string, unknown>>;
};

export type UiAccordionExpansion = 'single' | 'multiple' | 'persistent-one';
export type UiAccordionLayout = 'auto' | 'fill';
export type UiAccordionChrome = 'none' | 'border' | 'shadow' | 'border-shadow';
export type UiAccordionItemGap = 'none' | 'sm' | 'md' | 'lg';
export type UiAccordionOpenHeaderTone = 'none' | AppSurfaceBoxTone;

export const UI_ACCORDION_OPEN_HEADER_TONES: readonly UiAccordionOpenHeaderTone[] = [
  'none', 'slate', 'indigo', 'cyan', 'violet', 'emerald', 'amber', 'rose',
];

export const UI_ACCORDION_CHROME_CLASS: Record<UiAccordionChrome, string> = {
  none: 'overflow-hidden bg-transparent',
  border: 'overflow-hidden rounded-lg border border-slate-200 bg-white',
  shadow: cn('overflow-hidden rounded-lg bg-white', SHADOW_RAISED),
  'border-shadow': cn('overflow-hidden rounded-lg border border-slate-200 bg-white', SHADOW_RAISED),
};

export const UI_ACCORDION_ITEM_GAP_CLASS: Record<UiAccordionItemGap, string> = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
};

export function resolveUiAccordionOpenHeaderClass(
  tone: UiAccordionOpenHeaderTone,
  expanded: boolean,
): string | undefined {
  if (!expanded || tone === 'none') return undefined;
  return APP_SURFACE_BOX_TONE_CLASS[tone].header;
}

export type UiAccordionItem = {
  id: string;
  heading: React.ReactNode;
  panel: React.ReactNode;
  headingClassName?: string;
  triggerClassName?: string;
  panelClassName?: string;
  itemClassName?: string;
  disabled?: boolean;
};

export type UiAccordionProps = {
  items: UiAccordionItem[];
  expandedKeys: ReadonlySet<string>;
  onExpandedChange: (keys: Set<string>) => void;
  className?: string;
  variant?: 'light' | 'shadow' | 'splitted';
  /** Item surface: border, raised shadow, both, or none. Default `none`. */
  chrome?: UiAccordionChrome;
  /** Space between sibling items. Default `none`. */
  itemGap?: UiAccordionItemGap;
  /** Header tint on the expanded item only. Default `none`. */
  openHeaderTone?: UiAccordionOpenHeaderTone;
  /** Coordinated expansion. Default `multiple` matches the HeroUI compound API. */
  expansion?: UiAccordionExpansion;
  /**
   * `fill` stretches the open item to the host height and scrolls inside the
   * panel. Use with a height-bounded parent (`h-full min-h-0`).
   */
  layout?: UiAccordionLayout;
  /** When `expansion="single"`, whether the open item may collapse to none. */
  collapsible?: boolean;
};

export function resolveUiAccordionExpandedKeys(
  nextKeys: ReadonlySet<string>,
  currentKeys: ReadonlySet<string>,
  expansion: UiAccordionExpansion,
  collapsible: boolean,
  fallbackId?: string,
): Set<string> {
  if (expansion === 'multiple') {
    return new Set(nextKeys);
  }

  const last = Array.from(nextKeys).at(-1);
  if (expansion === 'persistent-one') {
    return new Set([last ?? Array.from(currentKeys)[0] ?? fallbackId].filter((id): id is string => Boolean(id)));
  }

  if (!last && !collapsible) {
    const current = Array.from(currentKeys)[0] ?? fallbackId;
    return new Set(current ? [current] : []);
  }

  return new Set(last ? [last] : []);
}

/** Thin wrapper over HeroUI's `Accordion`, with fill-height and persistent-one layouts. */
export const UiAccordion: React.FC<UiAccordionProps> = ({
  items,
  expandedKeys,
  onExpandedChange,
  className,
  variant = 'light',
  chrome = 'none',
  itemGap = 'none',
  openHeaderTone = 'none',
  expansion = 'multiple',
  layout = 'auto',
  collapsible = true,
}) => {
  const emitExpandedChange = React.useCallback((keys: Iterable<unknown>) => {
    onExpandedChange(resolveUiAccordionExpandedKeys(
      new Set(Array.from(keys, String)),
      expandedKeys,
      expansion,
      collapsible,
      items[0]?.id,
    ));
  }, [collapsible, expandedKeys, expansion, items, onExpandedChange]);

  if (layout === 'fill') {
    return (
      <div
        className={cn('flex h-full min-h-0 flex-col overflow-hidden', UI_ACCORDION_ITEM_GAP_CLASS[itemGap], className)}
        data-layout="fill"
        data-expansion={expansion}
        data-chrome={chrome}
        data-item-gap={itemGap}
        data-open-header-tone={openHeaderTone}
      >
        {items.map((item) => {
          const expanded = expandedKeys.has(item.id);
          return (
            <div
              key={item.id}
              className={cn(
                'flex min-h-0 flex-col overflow-hidden',
                UI_ACCORDION_CHROME_CLASS[chrome],
                expanded ? 'flex-1' : 'shrink-0',
                item.itemClassName,
              )}
              data-expanded={expanded ? 'true' : 'false'}
            >
              <h3 className={item.headingClassName}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500',
                    item.triggerClassName,
                    resolveUiAccordionOpenHeaderClass(openHeaderTone, expanded),
                  )}
                  aria-expanded={expanded}
                  aria-controls={`ui-accordion-panel-${item.id}`}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    const next = new Set(expandedKeys);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    emitExpandedChange(next);
                  }}
                >
                  <span className="min-w-0 flex-1">{item.heading}</span>
                  <ChevronDown
                    className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform', expanded && 'rotate-180')}
                    aria-hidden
                  />
                </button>
              </h3>
              {expanded ? (
                <div
                  id={`ui-accordion-panel-${item.id}`}
                  role="region"
                  className={cn('min-h-0 flex-1 overflow-y-auto', item.panelClassName)}
                >
                  {item.panel}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <HeroAccordion
      variant={variant}
      selectionMode={expansion === 'multiple' ? 'multiple' : 'single'}
      expandedKeys={expandedKeys}
      onExpandedChange={emitExpandedChange}
      hideSeparator={chrome !== 'none'}
      className={cn('flex flex-col', UI_ACCORDION_ITEM_GAP_CLASS[itemGap], className)}
      data-chrome={chrome}
      data-item-gap={itemGap}
      data-open-header-tone={openHeaderTone}
    >
      {items.map((item) => {
        const expanded = expandedKeys.has(item.id);
        return (
        <HeroAccordion.Item key={item.id} id={item.id} isDisabled={item.disabled} className={cn('border-none px-0 shadow-none', UI_ACCORDION_CHROME_CLASS[chrome], item.itemClassName)}>
          <HeroAccordion.Heading className={item.headingClassName}>
            <HeroAccordion.Trigger className={cn(item.triggerClassName, resolveUiAccordionOpenHeaderClass(openHeaderTone, expanded))}>
              {item.heading}
              <HeroAccordion.Indicator />
            </HeroAccordion.Trigger>
          </HeroAccordion.Heading>
          <HeroAccordion.Panel>
            <div className={item.panelClassName}>{item.panel}</div>
          </HeroAccordion.Panel>
        </HeroAccordion.Item>
        );
      })}
    </HeroAccordion>
  );
};
