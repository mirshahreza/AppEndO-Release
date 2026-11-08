import * as React from 'react';
import {
  Breadcrumbs,
  Button,
  Checkbox,
  CheckboxGroup,
  Link,
  Pagination,
  Radio,
  RadioGroup,
  Tag,
  TagGroup,
  Tooltip,
} from '@heroui/react';
import { parseDesignerTagsValue } from './designerTagsValue';
import { resolveCanvasInputValue, resolveCanvasMockEventProps, resolveCanvasTextContent } from './bindingCanvasResolver';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { resolveLanguageSelectedKey } from './DesignerRuntimeSelect';
import { resolveRegionFormFieldNameProps, resolveRuntimeComponentProps } from './runtimeNodeProps';
import { useDesignerOptionItems } from './useDesignerOptionItems';
import { triggerPreviewFieldValidation } from './previewFieldValidation';
import type { RuntimeRenderMode, RuntimeRenderOptions } from './runtimeTypes';
import type { DesignerNode } from './types';
import { FormSection, FORM_FIELD_LABEL_CLASS } from '../../shared/ui/FormSection';
import type { AppSurfaceBoxTone } from '../../shared/ui/surfaceClasses';
import {
  mergeClassNames,
  readBoolean,
  readNumber,
  readString,
  resolveRuntimeNodeClassName,
  resolveSize,
  wrapDesignerChildSlot,
} from './runtimeShared';

const APP_SURFACE_BOX_TONES = new Set<AppSurfaceBoxTone>([
  'slate', 'violet', 'cyan', 'indigo', 'emerald', 'amber', 'rose',
]);

const resolveFormSectionTone = (value: unknown): AppSurfaceBoxTone => (
  typeof value === 'string' && APP_SURFACE_BOX_TONES.has(value as AppSurfaceBoxTone)
    ? value as AppSurfaceBoxTone
    : 'indigo'
);

type ParityPaletteProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
  interactionClass?: string;
  children?: React.ReactNode;
  childNodes?: DesignerNode[];
};

const HBreadcrumbs = Breadcrumbs as unknown as React.FC<Record<string, unknown>> & {
  Item: React.FC<Record<string, unknown>>;
};
const HCheckboxGroup = CheckboxGroup as unknown as React.FC<Record<string, unknown>>;
const HCheckbox = Checkbox as unknown as React.FC<Record<string, unknown>> & {
  Control: React.FC<Record<string, unknown>>;
  Indicator: React.FC<Record<string, unknown>>;
  Content: React.FC<Record<string, unknown>>;
};
const HRadioGroup = RadioGroup as unknown as React.FC<Record<string, unknown>>;
const HRadio = Radio as unknown as React.FC<Record<string, unknown>> & {
  Control: React.FC<Record<string, unknown>>;
  Indicator: React.FC<Record<string, unknown>>;
  Content: React.FC<Record<string, unknown>>;
};
const HPagination = Pagination as unknown as React.FC<Record<string, unknown>> & {
  Summary: React.FC<Record<string, unknown>>;
  Content: React.FC<Record<string, unknown>>;
  Item: React.FC<Record<string, unknown>>;
  Link: React.FC<Record<string, unknown>>;
  Previous: React.FC<Record<string, unknown>>;
  Next: React.FC<Record<string, unknown>>;
};
const HTagGroup = TagGroup as unknown as React.FC<Record<string, unknown>> & {
  List: React.FC<Record<string, unknown>>;
};
const HTag = Tag as unknown as React.FC<Record<string, unknown>>;
const HTooltip = Tooltip as unknown as {
  Root: React.FC<Record<string, unknown>>;
  Trigger: React.FC<Record<string, unknown>>;
  Content: React.FC<Record<string, unknown>>;
};
const HLink = Link as unknown as React.FC<Record<string, unknown>>;

/**
 * Bug found (3 call sites in this file): `resolveCanvasTextContent` only ever accepted 2
 * arguments (node, fallback) — a 3rd `bridge`/`options.previewBindings` argument was passed at
 * every call site (clearly intended to make the resolved text binding-aware in interactive
 * preview, matching the `previewBindings?.resolveTextProp` pattern used elsewhere) but was
 * silently dropped by JS at runtime, a real TS2554 arg-count error the project's own `tsc`
 * invocation doesn't currently surface (see `_tmp_lov_test.mts` note). A Property Binding on a
 * Breadcrumbs root fallback / Checkbox-Group-or-Radio-Group option label / Tooltip Trigger label
 * had zero effect in interactive preview.
 */
const resolveCanvasTextContentWithBridge = (
  node: DesignerNode,
  fallback: string,
  bridge?: RuntimeRenderOptions['previewBindings'],
): string => (
  bridge?.resolveTextProp
    ? bridge.resolveTextProp(node, 'text', fallback)
    : resolveCanvasTextContent(node, fallback)
);

type BreadcrumbItemData = { label: string; href?: string; isCurrent?: boolean };

const resolveBreadcrumbItems = (
  node: DesignerNode,
  childNodes: DesignerNode[] | undefined,
  bridge?: RuntimeRenderOptions['previewBindings'],
): BreadcrumbItemData[] => {
  const itemsRaw = Array.isArray(node.props.items) ? node.props.items as Array<Record<string, unknown>> : [];
  if (itemsRaw.length > 0) {
    return itemsRaw.map((item) => ({
      label: typeof item.label === 'string' ? item.label : '',
      href: typeof item.href === 'string' ? item.href : undefined,
      isCurrent: item.isCurrent === true || item.isCurrent === 'true',
    }));
  }

  const labels = (childNodes ?? [])
    .map((child) => resolveCanvasTextContentWithBridge(child, readString(child.props.text, readString(child.props.label)), bridge))
    .map((label) => label.trim())
    .filter((label) => label.length > 0);

  if (labels.length > 0) {
    return labels.map((label, index) => ({
      label,
      href: index < labels.length - 1 ? '#' : undefined,
      isCurrent: index === labels.length - 1,
    }));
  }

  const fallback = resolveCanvasTextContentWithBridge(node, 'Home', bridge);
  return [
    { label: fallback, href: '#' },
    { label: 'Section', href: '#' },
    { label: 'Current', isCurrent: true },
  ];
};

const HButton = Button as unknown as React.FC<Record<string, unknown>>;

const resolveSelectedOptionValues = (
  node: DesignerNode,
  fallback: string,
  previewBindings?: RuntimeRenderOptions['previewBindings'],
): string[] => {
  const boundValues = previewBindings?.resolveChoiceGroupSelectedValues?.(node);
  if (boundValues && boundValues.length > 0) {
    return boundValues;
  }

  const raw = node.props.isSelected;
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry)).filter((entry) => entry.length > 0);
  }
  if (raw === true) {
    return [fallback];
  }
  if (raw === false) {
    return [];
  }

  return readString(raw, fallback)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const renderParityShell = (
  paletteItemId: string,
  mode: RuntimeRenderMode,
  shell: React.ReactNode,
  children: React.ReactNode | undefined,
  options: RuntimeRenderOptions,
  shellClassName?: string,
): React.ReactNode => {
  if (mode === 'design') {
    return (
      <div
        className={mergeClassNames('flex w-full min-w-0 flex-col gap-2', shellClassName)}
        style={options.style}
        data-designer-component={paletteItemId}
      >
        <div className="pointer-events-none min-w-0">{shell}</div>
        {children ? (
          <div className="pointer-events-auto relative min-h-[28px] w-full min-w-0">
            {children}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={mergeClassNames('min-w-0', shellClassName)}
      style={options.style}
      data-designer-component={paletteItemId}
    >
      {shell}
      {children ? wrapDesignerChildSlot(children, mode) : null}
    </div>
  );
};

const renderChoiceControl = (
  paletteItemId: 'heroui.checkbox-group' | 'heroui.radio-group',
  itemValue: string,
  label: string,
  isDisabled: boolean,
): React.ReactNode => {
  if (paletteItemId === 'heroui.checkbox-group') {
    return (
      <HCheckbox key={itemValue} value={itemValue} isDisabled={isDisabled}>
        <HCheckbox.Control>
          <HCheckbox.Indicator />
        </HCheckbox.Control>
        <HCheckbox.Content className="text-xs text-slate-700">{label}</HCheckbox.Content>
      </HCheckbox>
    );
  }

  return (
    <HRadio key={itemValue} value={itemValue} isDisabled={isDisabled}>
      <HRadio.Control>
        <HRadio.Indicator />
      </HRadio.Control>
      <HRadio.Content className="text-xs text-slate-700">{label}</HRadio.Content>
    </HRadio>
  );
};

/** HeroUI ChoiceGroup onChange passes raw value (string[] | string), not a DOM Event. */
const adaptChoiceGroupValueToDesignerEvent = (
  onChange: ((event: Event) => void) | undefined,
  nextValue: string | string[] | null,
): void => {
  if (!onChange) {
    return;
  }
  const serialized = Array.isArray(nextValue)
    ? nextValue.join(',')
    : String(nextValue ?? '');
  onChange({ target: { value: serialized } } as unknown as Event);
};

const resolveChoiceGroupEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, (event: Event) => void> =>
  options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

export const DesignerRuntimeBreadcrumbs: React.FC<ParityPaletteProps> = ({
  node,
  options,
  interactionClass,
  childNodes,
  children,
}) => {
  const crumbs = resolveBreadcrumbItems(node, childNodes, options.previewBindings);
  // Bug found (parity audit item 67): Size field removed — exclude leftover `size` so it never
  // spreads onto real Breadcrumbs (no size variant exists).
  const passthrough = resolveRuntimeComponentProps(node, {
    libraryComponent: true,
    excludeKeys: new Set(['size', 'items']),
  });
  const shellClassName = resolveRuntimeNodeClassName(node, interactionClass);

  return renderParityShell(
    'heroui.breadcrumbs',
    options.mode,
    (
      <HBreadcrumbs
        {...passthrough}
        className={shellClassName}
      >
        {crumbs.map((crumb, index) => (
          <HBreadcrumbs.Item
            key={`${node.id}-crumb-${index}`}
            href={crumb.isCurrent ? undefined : (crumb.href ?? '#')}
            isCurrent={crumb.isCurrent}
          >
            {crumb.label}
          </HBreadcrumbs.Item>
        ))}
      </HBreadcrumbs>
    ),
    children,
    options,
    shellClassName,
  );
};

/**
 * HeroUI v3 Pagination Root has no page / onChange API — Previous/Next/Link are RAC Buttons
 * that fire `onPress`. Designer Interactions still use the existing `onPageChange` binding
 * target (same as data-grid); preview adapts onPress → Event-shaped onPageChange handlers.
 */
const adaptPageChangeToDesignerEvent = (
  onPageChange: ((event: Event) => void) | undefined,
  nextPage: number,
): void => {
  if (!onPageChange) {
    return;
  }
  onPageChange({ target: { value: String(nextPage) } } as unknown as Event);
};

const resolvePaginationEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, (event: Event) => void> =>
  options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

export const DesignerRuntimePagination: React.FC<ParityPaletteProps> = ({
  node,
  options,
  interactionClass,
  children,
}) => {
  // Bug found (parity audit item P3.16): binding `page`/`total` had zero effect in the live
  // preview — these were always read directly off the static `node.props`, never consulting
  // a Property Binding the way other bindable props already do. The separate `onPageChange`
  // mechanism is unaffected and was always correct.
  const staticInitialPage = readNumber(node.props.page, 1);
  const staticTotal = Math.max(1, readNumber(node.props.total, 10));
  const initialPage = options.previewBindings?.resolveNumberProp?.(node, 'page', staticInitialPage) ?? staticInitialPage;
  const total = Math.max(1, options.previewBindings?.resolveNumberProp?.(node, 'total', staticTotal) ?? staticTotal);
  const [page, setPage] = React.useState(initialPage);
  React.useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  const passthrough = resolveRuntimeComponentProps(node, {
    libraryComponent: true,
    excludeKeys: new Set(['page', 'total']),
  });
  const shellClassName = resolveRuntimeNodeClassName(node, interactionClass);
  const eventProps = resolvePaginationEventProps(node, options);

  const commitPage = (nextPage: number): void => {
    const normalized = Math.max(1, Math.min(nextPage, total));
    setPage(normalized);
    adaptPageChangeToDesignerEvent(eventProps.onPageChange, normalized);
  };

  return renderParityShell(
    'heroui.pagination',
    options.mode,
    (
      <HPagination
        {...passthrough}
        size={resolveSize(node.props.size)}
        className={shellClassName}
      >
        <HPagination.Summary>
          Page {page} · {total} total
        </HPagination.Summary>
        <HPagination.Content>
          <HPagination.Item>
            <HPagination.Previous
              isDisabled={page <= 1}
              onPress={() => commitPage(page - 1)}
            />
          </HPagination.Item>
          <HPagination.Item>
            <HPagination.Link isActive>{page}</HPagination.Link>
          </HPagination.Item>
          <HPagination.Item>
            <HPagination.Next
              isDisabled={page >= total}
              onPress={() => commitPage(page + 1)}
            />
          </HPagination.Item>
        </HPagination.Content>
      </HPagination>
    ),
    children,
    options,
    shellClassName,
  );
};

const DesignerRuntimeChoiceGroup: React.FC<ParityPaletteProps & {
  paletteItemId: 'heroui.checkbox-group' | 'heroui.radio-group';
}> = ({
  node,
  options,
  interactionClass,
  paletteItemId,
  children,
  childNodes,
}) => {
  const { items, isLoading } = useDesignerOptionItems(node, options);
  const passthrough = resolveRuntimeComponentProps(node, {
    libraryComponent: true,
    // Bug found (parity audit item 53): leftover size/color on older docs must not leak onto
    // CheckboxGroup/RadioGroup (neither prop exists on the real components).
    // `label` / `ariaLabel` / section chrome props are designer FormSection wiring, not HeroUI props.
    excludeKeys: new Set([
      'items', 'size', 'color', 'label', 'ariaLabel', 'sectionTone', 'sectionDivided',
    ]),
  });
  const shellClassName = resolveRuntimeNodeClassName(node, interactionClass);
  const label = readString(node.props.label);
  const ariaLabel = readString(
    node.props.ariaLabel,
    label || (paletteItemId === 'heroui.checkbox-group' ? 'Checkbox group' : 'Radio group'),
  );
  const sectionTone = resolveFormSectionTone(node.props.sectionTone);
  const sectionDivided = readBoolean(node.props.sectionDivided);
  // Keep `hidden` on the outer shell so auto-default fields (empty label + className hidden)
  // stay out of the layout; choice-row flex utilities stay on the group itself so a visible
  // FormSection title stacks above the chips instead of sitting beside them.
  const isVisuallyHidden = shellClassName.split(/\s+/).includes('hidden');
  const outerShellClassName = isVisuallyHidden ? 'hidden' : 'w-full min-w-0';
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const fallbackValue = resolveLanguageSelectedKey(node) || items[0]?.value || 'option-1';
  const previewSelected = options.previewBindings?.resolveChoiceGroupSelectedValues?.(node);
  const externalSelectedKey = Array.isArray(previewSelected) && previewSelected.length > 0
    ? previewSelected.join(',')
    : readString(node.props.isSelected, fallbackValue);
  const initialSelectedValues = resolveSelectedOptionValues(node, fallbackValue, options.previewBindings);
  const [selectedValues, setSelectedValues] = React.useState(initialSelectedValues);
  React.useEffect(() => {
    setSelectedValues(resolveSelectedOptionValues(node, fallbackValue, options.previewBindings));
  }, [externalSelectedKey, fallbackValue, node.id]);

  const formFieldName = resolveRegionFormFieldNameProps(node).name
    ?? (typeof node.props.name === 'string' ? node.props.name : undefined);
  const formValue = paletteItemId === 'heroui.checkbox-group'
    ? selectedValues.join(',')
    : (selectedValues[0] ?? '');
  const eventProps = resolveChoiceGroupEventProps(node, options);
  const GroupComponent = paletteItemId === 'heroui.checkbox-group' ? HCheckboxGroup : HRadioGroup;

  const optionNodes = items.length > 0
    ? items.map((item) => renderChoiceControl(
      paletteItemId,
      item.value,
      item.label,
      isDisabled,
    ))
    : (childNodes ?? []).map((child, index) => renderChoiceControl(
      paletteItemId,
      `child-${index}`,
      resolveCanvasTextContentWithBridge(child, readString(child.props.text, `Option ${index + 1}`), options.previewBindings),
      isDisabled,
    ));

  if (isLoading) {
    return (
      <div className={`${outerShellClassName} ${shellClassName} text-xs text-slate-500`} aria-busy="true">
        Loading options…
      </div>
    );
  }

  const groupValue = paletteItemId === 'heroui.checkbox-group'
    ? selectedValues
    : (selectedValues[0] ?? fallbackValue);

  // Chip-button rows use flex-row chrome but HeroUI defaults to vertical orientation,
  // which adds margin-top on every radio (including the first) under FormSection titles.
  const orientation = readString(node.props.orientation)
    || (shellClassName.includes('designer-choice-button-group') ? 'horizontal' : undefined);

  const groupControl = (
    <GroupComponent
      {...passthrough}
      value={groupValue}
      className={shellClassName}
      isDisabled={isDisabled}
      aria-label={ariaLabel}
      {...(orientation ? { orientation } : {})}
      onChange={(nextValue: string | string[]) => {
        const nextSelected = Array.isArray(nextValue)
          ? nextValue.map(String)
          : (nextValue == null || nextValue === '' ? [] : [String(nextValue)]);
        setSelectedValues(nextSelected);
        adaptChoiceGroupValueToDesignerEvent(eventProps.onChange, nextValue);
      }}
    >
      {optionNodes}
    </GroupComponent>
  );

  // Labeled choice groups follow Base Components → Choice: flat `FormSection`
  // (accent bar + uppercase title). Compact header→body gap matches label-over-input
  // (`gap-[2px]`) — these sections title a single chip row, not a multi-field body stack.
  const labeledBody = label ? (
    <FormSection
      title={label}
      tone={sectionTone}
      divided={sectionDivided}
      className="flex flex-col gap-[2px] space-y-0"
    >
      {formFieldName ? (
        <input type="hidden" name={formFieldName} value={formValue} readOnly />
      ) : null}
      {groupControl}
    </FormSection>
  ) : (
    <>
      {formFieldName ? (
        <input type="hidden" name={formFieldName} value={formValue} readOnly />
      ) : null}
      {groupControl}
    </>
  );

  return renderParityShell(
    paletteItemId,
    options.mode,
    labeledBody,
    children,
    options,
    outerShellClassName,
  );
};

export const DesignerRuntimeCheckboxGroup: React.FC<ParityPaletteProps> = (props) => (
  <DesignerRuntimeChoiceGroup {...props} paletteItemId="heroui.checkbox-group" />
);

export const DesignerRuntimeRadioGroup: React.FC<ParityPaletteProps> = (props) => (
  <DesignerRuntimeChoiceGroup {...props} paletteItemId="heroui.radio-group" />
);

export const DesignerRuntimeTagsInput: React.FC<ParityPaletteProps> = ({
  node,
  options,
  interactionClass,
  children,
}) => {
  const boundValue = options.previewBindings?.resolveInputValue?.(node) ?? resolveCanvasInputValue(node);
  const initialTags = parseDesignerTagsValue(boundValue ?? readString(node.props.value));
  const placeholder = readString(node.props.placeholder, 'Add tags…');
  const passthrough = resolveRuntimeComponentProps(node, {
    libraryComponent: true,
    excludeKeys: new Set(['value', 'placeholder', 'label']),
  });
  const shellClassName = resolveRuntimeNodeClassName(node, interactionClass);
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const name = resolveRegionFormFieldNameProps(node).name
    ?? (typeof node.props.name === 'string' ? node.props.name : undefined);

  const [tags, setTags] = React.useState(initialTags);
  const [draft, setDraft] = React.useState('');
  React.useEffect(() => {
    setTags(initialTags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundValue, readString(node.props.value)]);

  // `mode` alone is not a reliable interactivity signal here: renderDesignerDocumentPreview
  // always passes mode: 'runtime' (see designerRuntimePreview.tsx), even for the read-only
  // preview shown before a caller opts into `interactive: true`. previewEvents is the actual
  // gate — same compound check used by every other live widget (Select, file-upload, etc.).
  const isInteractive = options.mode === 'runtime' && Boolean(options.previewEvents);
  const eventProps = isInteractive
    ? resolveCanvasPreviewEventProps(node, options.previewEvents!)
    : resolveCanvasMockEventProps(node);

  const commitTags = (nextTags: string[]) => {
    setTags(nextTags);
    const nextValue = nextTags.join(',');
    if (eventProps.onChange) {
      eventProps.onChange({ target: { value: nextValue } } as unknown as Event);
    }
    triggerPreviewFieldValidation(node.id, node.props, nextValue, options.onPreviewFieldValidation, options.designerStore);
  };

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || isDisabled || tags.includes(trimmed)) {
      return;
    }
    commitTags([...tags, trimmed]);
    setDraft('');
  };

  const removeTag = (tag: string) => {
    if (isDisabled) {
      return;
    }
    commitTags(tags.filter((existing) => existing !== tag));
  };

  const displayTags = tags.length > 0 ? tags : (isInteractive ? [] : ['sample']);

  return renderParityShell(
    'heroui.tags-input',
    options.mode,
    (
      <div className="flex w-full flex-col gap-[2px]">
        {readString(node.props.label) ? (
          <span className={FORM_FIELD_LABEL_CLASS}>{readString(node.props.label)}</span>
        ) : null}
        {name ? <input type="hidden" name={name} value={tags.join(',')} readOnly /> : null}
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1">
          <HTagGroup
            {...passthrough}
            isDisabled={isDisabled}
            aria-label={readString(node.props.ariaLabel, readString(node.props.label, 'Tags'))}
          >
            <HTagGroup.List>
              {displayTags.map((tag) => (
                <HTag key={`${node.id}-${tag}`}>
                  {tag}
                  {isInteractive ? (
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      className="ms-1 text-slate-400 hover:text-slate-700"
                      disabled={isDisabled}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeTag(tag);
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </HTag>
              ))}
            </HTagGroup.List>
          </HTagGroup>
          {isInteractive ? (
            <input
              type="text"
              value={draft}
              disabled={isDisabled}
              placeholder={tags.length === 0 ? placeholder : ''}
              aria-label={readString(node.props.ariaLabel, readString(node.props.label, 'Add tag'))}
              className="min-w-[80px] flex-1 border-none bg-transparent text-sm outline-none disabled:cursor-not-allowed"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag(draft);
                } else if (event.key === 'Backspace' && draft.length === 0 && tags.length > 0) {
                  removeTag(tags[tags.length - 1]!);
                }
              }}
              onBlur={() => addTag(draft)}
            />
          ) : null}
        </div>
        {tags.length === 0 && !isInteractive ? (
          <span className="ps-[4px] text-[11px] text-slate-400">{placeholder}</span>
        ) : null}
      </div>
    ),
    children,
    options,
    shellClassName,
  );
};

export const DesignerRuntimeTooltipTrigger: React.FC<ParityPaletteProps> = ({
  node,
  options,
  interactionClass,
}) => {
  const label = resolveCanvasTextContentWithBridge(node, readString(node.props.text, 'Hover target'), options.previewBindings);
  // Falls back to the trigger label for documents saved before `tooltipText` existed as its own
  // field (previously the tooltip bubble always just repeated the trigger's own label).
  const tooltipMessage = readString(node.props.tooltipText, label);
  const href = readString(node.props.href);
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const passthrough = resolveRuntimeComponentProps(node, {
    libraryComponent: true,
    excludeKeys: new Set(['text', 'tooltipText', 'href', 'target', 'rel']),
  });
  const shellClassName = resolveRuntimeNodeClassName(node, interactionClass);
  const eventProps = options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : {};

  if (options.mode === 'design') {
    return (
      <div
        className={mergeClassNames('inline-flex flex-col items-start gap-1', shellClassName)}
        style={options.style}
        data-designer-component="heroui.tooltip-trigger"
      >
        <span className="inline-flex rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-700">
          {label}
        </span>
        <span className="rounded-md border border-slate-200 bg-slate-900 px-2 py-1 text-[10px] text-white shadow-sm">
          {tooltipMessage}
        </span>
      </div>
    );
  }

  const trigger = href
    ? (
      <HLink
        href={href}
        target={readString(node.props.target) || undefined}
        rel={readString(node.props.rel) || undefined}
        className={shellClassName}
        isDisabled={isDisabled}
        onMouseEnter={eventProps.onMouseEnter as React.MouseEventHandler<HTMLAnchorElement> | undefined}
      >
        {label}
      </HLink>
    )
    : (
      <HButton
        variant="ghost"
        size="sm"
        className={shellClassName}
        isDisabled={isDisabled}
        onMouseEnter={eventProps.onMouseEnter as React.MouseEventHandler<HTMLButtonElement> | undefined}
      >
        {label}
      </HButton>
    );

  return (
    <div data-designer-component="heroui.tooltip-trigger">
      <HTooltip.Root
        {...passthrough}
        isDisabled={isDisabled}
      >
        <HTooltip.Trigger>{trigger}</HTooltip.Trigger>
        <HTooltip.Content showArrow offset={8}>
          {tooltipMessage}
        </HTooltip.Content>
      </HTooltip.Root>
    </div>
  );
};
