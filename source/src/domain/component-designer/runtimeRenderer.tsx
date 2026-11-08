import * as React from 'react';
import * as LucideIcons from 'lucide-react';
import {
  Accordion,
  Avatar,
  Button,
  Card,
  Chip,
  Drawer,
  Link,
  Modal,
  ProgressBar,
  Skeleton,
  Slider,
  Spinner,
  Switch,
  Toolbar,
} from '@heroui/react';
import { UiInput, UiSelect, UiTextarea } from '../../components/ui/HeroFieldControls';
import { SemanticAssistTextarea } from '../../shared/ui/ai-field-assist/SemanticAssistTextarea';
import {
  DESIGNER_SEMANTIC_VALIDATION_EXCLUDE_KEYS,
  resolveDesignerSemanticReasonsLanguage,
  resolveDesignerSemanticUserGuidance,
  resolveDesignerSemanticValidationPolicy,
} from './designerSemanticValidation';
import { WorkspaceBackIcon } from '../../shared/ui/WorkspaceBackIcon';
import { executePickFileCreateBehavior, parsePickFileCreateBehaviorFromProps } from './designerGridPickFileCreate';
import {
  resolveContentStatusOptionAppearance,
  resolveContentStatusTriggerAppearance,
  resolveContentStatusTriggerIconName,
} from './designerContentStatusTrigger';
import { renderHeroUiGenericLeafNode, renderHeroUiGenericStructuralNode } from './runtimeHeroUiGeneric';

import { renderVizPaletteNode } from './designerVizRuntime';
import { renderUniversalPaletteNode } from './designerUniversalRuntime';
import { renderPlatformChromePaletteNode } from './designerPlatformChromeRuntime';
import {
  resolveCanvasImageAlt,
  resolveCanvasImageSrc,
  resolveCanvasInputPlaceholder,
  resolveCanvasInputValue,
  resolveCanvasMockEventProps,
  resolveCanvasTextContent,
} from './bindingCanvasResolver';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { DesignerRuntimeTabs } from './DesignerRuntimeTabs';
import { parseDesignerTabItems } from './designerTabItems';
import { resolveDesignerCulturePropText } from './designerGridCultureKeys';
import type { UiTabItem } from '../../shared/ui/UiTabs';
import { DesignerRuntimeAutocomplete } from './DesignerRuntimeAutocomplete';
import { DesignerRuntimeSelect } from './DesignerRuntimeSelect';
import { DesignerRuntimeDropdown } from './DesignerRuntimeDropdown';
import { DesignerRuntimeListbox } from './DesignerRuntimeListbox';
import {
  DesignerRuntimeBreadcrumbs,
  DesignerRuntimeCheckboxGroup,
  DesignerRuntimePagination,
  DesignerRuntimeRadioGroup,
  DesignerRuntimeTagsInput,
  DesignerRuntimeTooltipTrigger,
} from './DesignerRuntimeParityPalette';
import { DesignerRuntimeRelationTagsList } from './DesignerRuntimeRelationTagsList';
import { DesignerRuntimeRelatedContentsList } from './DesignerRuntimeRelatedContentsList';
import { DesignerRuntimeCmsContentAssets } from './DesignerRuntimeCmsContentAssets';
import { DesignerRuntimeBaseInfoRecordForm } from './DesignerRuntimeBaseInfoRecordForm';
import {
  renderCalculatorLeafNode,
  renderCodeEditorLeafNode,
  renderColorEditorLeafNode,
  renderDataGridStructuralNode,
  renderAppTableGridStructuralNode,
  renderCrudSetStructuralNode,
  renderRecordFormStructuralNode,
  renderDatePickerLeafNode,
  renderDateRangeLeafNode,
  renderEntityPickerLeafNode,
  renderHtmlEditorLeafNode,
  renderMarkdownEditorLeafNode,
  renderMaskInputLeafNode,
} from './runtimePhase2Palette';
import { hasGridDetailModalStoreEntry, readGridDetailModalOpenFromStore } from './bindingGridDetailEngine';
import { visibilityStorePathForNode } from './bindingDynamicActionsEngine';
import { isRegionDetailReadOnlyForm } from './bindingRegionEngine';
import { nodeHasRegionColumnBinding, resolveRegionFormFieldNameProps, resolveModalOverlayPartProps, resolveRuntimeComponentProps, resolveInputUxProps, resolveInputValidationProps, resolveSelectMenuProps } from './runtimeNodeProps';
import { validateDesignerFieldNode } from './previewFieldValidation';
import { HwyInstituteLogoUploadField } from '../hwy/HwyInstituteLogoUploadField';
import type { DesignerNode } from './types';
import {
  DESIGNER_MODAL_BODY_CLASS,
  DESIGNER_MODAL_CLOSE_BUTTON_CLASS,
  DESIGNER_MODAL_SHELL_BODY_INNER_CLASS,
  DESIGNER_MODAL_SHELL_FOOTER_CLASS,
  isDesignerDialogActionFooterNode,
  liftDesignerDialogFooterElement,
  mergeDesignerModalDialogClassName,
  resolveDesignerCreateEditModalSize,
  resolveDesignerModalHeaderClassName,
  resolveDesignerModalHeaderTone,
  resolveDesignerModalShellBodyClassNames,
  resolveDesignerModalTitleClassName,
} from './designerModalChrome';
import { ConfirmDialogShell, CreateEditModalShell, DirectionalText } from '../../shared/ui';
import {
  getNodePaletteItemId,
  HEROUI_REAL_LEAF_IDS,
  HEROUI_STRUCTURAL_IDS,
  isHeroUiRealLeafNode,
  mergeClassNames,
  PER_CHILD_STRUCTURAL_IDS,
  readBoolean,
  readNumber,
  readString,
  resolveRuntimePaletteItemId,
  resolveAccordionTitle,
  resolveButtonVariant,
  resolveChipColor,
  resolveChipVariant,
  resolveFieldSize,
  resolveInputType,
  resolveModalSize,
  resolveProgressValue,
  resolveRuntimeNodeClassName,
  readNodeClassName,
  resolveSize,
  resolveSliderValue,
  resolveSliderRangeValue,
  isSliderRangeMode,
  wrapDesignerChildSlot,
  type HeroSize,
} from './runtimeShared';

export type { RuntimeRenderMode, RuntimeRenderOptions } from './runtimeTypes';
export {
  getNodePaletteItemId,
  HEROUI_REAL_LEAF_IDS,
  HEROUI_RENDERED_IDS,
  HEROUI_STRUCTURAL_IDS,
  isDesignerFormPaletteLeafNode,
  isDesignerRenderableLeafNode,
  isHeroUiRealLeafNode,
  isHeroUiRenderedNode,
  isHeroUiStructuralNode,
  PER_CHILD_STRUCTURAL_IDS,
} from './runtimeShared';

import type { RuntimeRenderMode, RuntimeRenderOptions, DesignerPreviewBindingBridge } from './runtimeTypes';

const previewTextContent = (node: DesignerNode, fallback: string, bridge?: DesignerPreviewBindingBridge): string =>
  bridge?.resolveTextContent(node, fallback) ?? resolveCanvasTextContent(node, fallback);

const resolveLucideIcon = (name: string | unknown): React.ComponentType<{ className?: string; size?: number }> | null => {
  if (typeof name !== 'string' || !name) return null;
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; size?: number }>>;
  return icons[name] ?? null;
};

const renderIconElement = (iconName: unknown): React.ReactNode => {
  const Icon = resolveLucideIcon(iconName);
  return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
};

const previewImageSrc = (node: DesignerNode, fallback: string, bridge?: DesignerPreviewBindingBridge): string =>
  bridge?.resolveImageSrc(node, fallback) ?? resolveCanvasImageSrc(node, fallback);

const previewImageAlt = (node: DesignerNode, fallback: string, bridge?: DesignerPreviewBindingBridge): string =>
  bridge?.resolveImageAlt(node, fallback) ?? resolveCanvasImageAlt(node, fallback);

const previewInputPlaceholder = (node: DesignerNode, fallback: string, bridge?: DesignerPreviewBindingBridge): string =>
  bridge?.resolveInputPlaceholder(node, fallback) ?? resolveCanvasInputPlaceholder(node, fallback);

const resolveRuntimeFieldLabel = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
  fallback = '',
): string => {
  const literal = readString(node.props.label, readString(node.props.title, fallback));
  const key = readString(node.props.labelTranslationKey);
  if (key && options.translate) {
    return resolveDesignerCulturePropText(
      node,
      'labelTranslationKey',
      'label',
      literal,
      options.translate,
    );
  }
  const bound = options.previewBindings?.resolveTextProp?.(node, 'label', literal);
  return bound && bound.trim().length > 0 ? bound : literal;
};

const resolveRuntimeFieldPlaceholder = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
  fallback: string,
): string => {
  const literal = readString(node.props.placeholder, fallback);
  const key = readString(node.props.placeholderTranslationKey);
  if (key && options.translate) {
    return resolveDesignerCulturePropText(
      node,
      'placeholderTranslationKey',
      'placeholder',
      literal,
      options.translate,
    );
  }
  return previewInputPlaceholder(node, literal, options.previewBindings);
};

const resolveRuntimeButtonText = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
  fallback: string,
): string => {
  const literal = readString(node.props.text, fallback);
  const key = readString(node.props.textTranslationKey);
  if (key && options.translate) {
    return resolveDesignerCulturePropText(
      node,
      'textTranslationKey',
      'text',
      literal,
      options.translate,
    );
  }
  return previewTextContent(node, literal, options.previewBindings);
};

const previewInputValue = (node: DesignerNode, bridge?: DesignerPreviewBindingBridge): string | undefined =>
  bridge?.resolveInputValue(node) ?? resolveCanvasInputValue(node);

/**
 * Bug found: Modal/Alert-Dialog/Drawer computed `isOpen` as
 * `readBoolean(node.props.isOpen) || readGridDetailModalOpenFromStore(...)` — an OR between the
 * static Inspector "Open" checkbox and the live visibility store. Once the static checkbox was
 * true, the store side could never win: dismissing (backdrop click / Escape) patches the store
 * to `false`, but the static prop is unchanged, so the very next render re-evaluates the OR back
 * to `true` and the overlay instantly reopens/never visually closes — the checkbox effectively
 * made the overlay permanently un-dismissable in interactive preview. The static prop should only
 * seed the *initial* open state (useful to preview "starts open" without needing a trigger
 * action); once the store has ever been explicitly written to for this node (open OR closed),
 * the store alone is the source of truth.
 */
const resolveOverlayIsOpen = (
  node: DesignerNode,
  designerStore: Record<string, unknown> | undefined,
): boolean => (
  hasGridDetailModalStoreEntry(designerStore, node.id)
    ? readGridDetailModalOpenFromStore(designerStore, node.id)
    : readBoolean(node.props.isOpen)
);

/**
 * Bug found: heroui.progress's "Value" field is bindable (generic 'number' Inspector field),
 * but the live/interactive canvas preview called resolveProgressValue(node) directly —
 * reading only the static node.props.value, never consulting the preview binding bridge —
 * so a Property Binding configured for Progress's value was 100% invisible in the preview too
 * (matching the same dead-binding bug fixed in codegen for the exported ProgressBar). Only
 * consult the bridge in interactive/'runtime' mode; design-mode canvas keeps showing the
 * static/default value exactly as before.
 */
const resolvePreviewProgressValue = (node: DesignerNode, options: RuntimeRenderOptions): number => {
  if (options.mode === 'runtime' && options.previewBindings) {
    const bound = options.previewBindings.resolveInputValue(node);
    if (bound !== undefined && bound !== '') {
      const numeric = Number(bound);
      if (Number.isFinite(numeric)) {
        return Math.min(100, Math.max(0, numeric));
      }
    }
  }
  return resolveProgressValue(node);
};

const HButton = Button as unknown as React.FC<Record<string, unknown>>;
const HLink = Link as unknown as React.FC<Record<string, unknown>>;
const HChip = Chip as unknown as React.FC<Record<string, unknown>>;
const HSpinner = Spinner as unknown as React.FC<Record<string, unknown>>;
const HSkeleton = Skeleton as unknown as React.FC<Record<string, unknown>>;
const HAvatar = Avatar as unknown as React.FC<Record<string, unknown>> & {
  Fallback: React.FC<Record<string, unknown>>;
  Image: React.FC<Record<string, unknown>>;
};
const HSwitch = Switch as unknown as React.FC<Record<string, unknown>> & {
  Content: React.FC<Record<string, unknown>>;
  Control: React.FC<Record<string, unknown>>;
  Thumb: React.FC<Record<string, unknown>>;
};
const HProgressBar = ProgressBar as unknown as React.FC<Record<string, unknown>> & {
  Track: React.FC<Record<string, unknown>>;
  Fill: React.FC<Record<string, unknown>>;
};
const HSlider = Slider as unknown as React.FC<Record<string, unknown>> & {
  Track: React.FC<Record<string, unknown>>;
  Fill: React.FC<Record<string, unknown>>;
  Thumb: React.FC<Record<string, unknown>>;
};
const HCard = Card as unknown as React.FC<Record<string, unknown>> & {
  Header: React.FC<Record<string, unknown>>;
  Title: React.FC<Record<string, unknown>>;
  Description: React.FC<Record<string, unknown>>;
  Content: React.FC<Record<string, unknown>>;
  Footer: React.FC<Record<string, unknown>>;
};
const HAccordion = Accordion as unknown as React.FC<Record<string, unknown>> & {
  Item: React.FC<Record<string, unknown>>;
  Heading: React.FC<Record<string, unknown>>;
  Trigger: React.FC<Record<string, unknown>>;
  Indicator: React.FC<Record<string, unknown>>;
  Panel: React.FC<Record<string, unknown>>;
};
const HModal = Modal as unknown as React.FC<Record<string, unknown>> & {
  Backdrop: React.FC<Record<string, unknown>>;
  Container: React.FC<Record<string, unknown>>;
  Dialog: React.FC<Record<string, unknown>>;
  Header: React.FC<Record<string, unknown>>;
  Heading: React.FC<Record<string, unknown>>;
  Body: React.FC<Record<string, unknown>>;
};
const HDrawer = Drawer as unknown as React.FC<Record<string, unknown>> & {
  Content: React.FC<Record<string, unknown>>;
  Dialog: React.FC<Record<string, unknown>>;
  Header: React.FC<Record<string, unknown>>;
  Heading: React.FC<Record<string, unknown>>;
  Body: React.FC<Record<string, unknown>>;
};
const HToolbar = Toolbar as unknown as React.FC<Record<string, unknown>>;

export type RuntimeStructuralRenderOptions = RuntimeRenderOptions & {
  className?: string;
  children?: React.ReactNode;
  childElements?: React.ReactNode[];
  childNodes?: DesignerNode[];
};

const designInteractionClass = (mode: RuntimeRenderMode): string | undefined =>
  mode === 'design' ? 'pointer-events-none' : undefined;

/**
 * Peel CRUD Cancel/Save footer into CreateEditModalShell / ConfirmDialogShell `footer`
 * so DialogFooter edge-aligns (no white gutter under the action band).
 */
const normalizeOverlayChildElements = (
  childElements: React.ReactNode[] | undefined,
  children: React.ReactNode,
): React.ReactNode[] => {
  if (childElements && childElements.length > 0) {
    return childElements;
  }
  if (Array.isArray(children)) {
    return children;
  }
  if (children == null || children === false) {
    return [];
  }
  return [children];
};

const partitionDesignerOverlayBodyAndFooter = (
  childNodes: DesignerNode[],
  childElements: React.ReactNode[],
): { body: React.ReactNode; footer: React.ReactNode | undefined } => {
  if (childNodes.length === 0 || childElements.length === 0) {
    return { body: childElements, footer: undefined };
  }

  const lastIndex = childNodes.length - 1;
  const lastNode = childNodes[lastIndex];
  if (!isDesignerDialogActionFooterNode(lastNode) || lastIndex >= childElements.length) {
    return { body: childElements, footer: undefined };
  }

  const footerActions = liftDesignerDialogFooterElement(childElements[lastIndex]);

  return {
    body: childElements.slice(0, lastIndex),
    footer: footerActions,
  };
};

const sharedDisabled = (node: DesignerNode): boolean =>
  readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);

const resolveNodeAiAssistEnabled = (node: DesignerNode): boolean => {
  const value = node.props.aiAssist;
  if (value === 'false' || value === false) {
    return false;
  }
  return true;
};

const sharedInputValue = (node: DesignerNode): string | undefined => {
  const value = node.props.value;
  return typeof value === 'string' ? value : undefined;
};

const resolveRuntimeInputValue = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): string => {
  if (options.mode === 'runtime' && options.previewBindings) {
    return previewInputValue(node, options.previewBindings) ?? '';
  }

  return sharedInputValue(node) ?? '';
};

const resolveRegionBoundInputProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
  hasChangeHandler: boolean,
): { value?: string; defaultValue?: string; readOnly?: boolean } => {
  const displayValue = resolveRuntimeInputValue(node, options);

  if (options.mode !== 'runtime') {
    // Canvas/non-interactive preview: a fixed, non-typable value is intentional here — editing
    // happens through the Properties panel, not by typing into the rendered control.
    return { value: displayValue };
  }

  if (!nodeHasRegionColumnBinding(node)) {
    if (hasChangeHandler) {
      // A real onChange is wired (e.g. a configured onChange event binding) — keep this a normal
      // controlled component so externally-driven updates to the bound value keep displaying.
      return { value: displayValue };
    }
    // No data-grid/region binding AND no onChange anywhere — returning `value` (controlled) with
    // nothing to update it silently freezes the field: React renders it read-only in practice.
    // `defaultValue` keeps it uncontrolled/editable, so a plain unbound input on a real published
    // page is actually typable, matching the already-correct "bound but not read-only" case below.
    return { defaultValue: displayValue };
  }

  const document = options.previewEvents?.document;
  const isReadOnlyDetail = document ? isRegionDetailReadOnlyForm(document, node.id) : false;

  if (isReadOnlyDetail) {
    return { value: displayValue, readOnly: true };
  }

  return { defaultValue: displayValue };
};

const resolveRegionBoundFieldKey = (node: DesignerNode, options: RuntimeRenderOptions): string => {
  if (!nodeHasRegionColumnBinding(node) || !options.designerStore) {
    return node.id;
  }

  const selection = options.designerStore.selection;
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    return node.id;
  }

  const recordId = (selection as Record<string, unknown>).id;
  if (recordId === undefined || recordId === null || String(recordId).trim().length === 0) {
    return node.id;
  }

  return `${node.id}:${String(recordId)}`;
};

const INPUT_VALIDATION_EXCLUDE_KEYS = new Set(['type', 'inputType', 'isInvalid', 'errorMessage', 'pattern', 'maxLength', 'minLength']);
const INPUT_UX_EXCLUDE_KEYS = new Set(['description', 'startContent', 'endContent', 'isClearable', 'autoFocus', 'inputMode']);
const MENU_ASYNC_EXCLUDE_KEYS = new Set(['isLoading', 'closeOnSelect', 'shouldCloseOnSelect', 'allowCustomValue']);

const resolveCanvasEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, (event: Event) => void> =>
  options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

/** Adapt HeroUI value callbacks (`onChange(next)`) to designer Event-shaped handlers. */
const adaptValueChangeToDesignerEvent = (
  onChange: ((event: Event) => void) | undefined,
  nextValue: unknown,
): void => {
  if (!onChange) {
    return;
  }
  const normalized = Array.isArray(nextValue) ? nextValue[0] : nextValue;
  onChange({ target: { value: String(normalized ?? '') } } as unknown as Event);
};

/**
 * HeroUI Tabs Root (RAC TabListProps) exposes `onSelectionChange(key: Key)`.
 * Keep defaultSelectedKey (uncontrolled) — same decision as Slider in T1-1.
 */
const adaptSelectionChangeToDesignerEvent = (
  onSelectionChange: ((event: Event) => void) | undefined,
  nextKey: unknown,
): void => {
  if (!onSelectionChange) {
    return;
  }
  onSelectionChange({ target: { value: String(nextKey ?? '') } } as unknown as Event);
};

type SwitchSliderLeafProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
  passthrough: Record<string, unknown>;
  interactionClass?: string;
  isDisabled: boolean;
  style?: React.CSSProperties;
};

/**
 * Local state (same pattern as DesignerRuntimeSelect) keeps the hidden form field
 * in sync while HeroUI Switch remains controlled via isSelected.
 * Event wiring uses resolveCanvasEventProps → resolveCanvasPreviewEventProps.
 */
const coerceSwitchSelected = (value: unknown): boolean => (
  value === true
  || value === 1
  || value === '1'
  || value === 'true'
);

const DesignerRuntimeSwitchLeaf: React.FC<SwitchSliderLeafProps> = ({
  node,
  options,
  passthrough,
  interactionClass,
  isDisabled,
}) => {
  const formFieldName = resolveRegionFormFieldNameProps(node).name
    ?? (typeof node.props.name === 'string' ? node.props.name : undefined);
  const label = resolveRuntimeFieldLabel(node, options);
  const staticSelected = coerceSwitchSelected(
    node.props.isSelected ?? node.props.defaultSelected,
  );
  const initialSelected = options.mode === 'runtime' && options.previewBindings?.resolveSwitchIsSelected
    ? options.previewBindings.resolveSwitchIsSelected(node, staticSelected)
    : staticSelected;
  const [selected, setSelected] = React.useState(initialSelected);
  React.useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  const eventProps = resolveCanvasEventProps(node, options);

  return (
    <>
      {formFieldName ? (
        <input
          type="hidden"
          name={formFieldName}
          value={selected ? 'true' : 'false'}
          readOnly
        />
      ) : null}
      <HSwitch
        {...passthrough}
        aria-label={readString(node.props.ariaLabel, label || 'switch')}
        isSelected={selected}
        isDisabled={isDisabled}
        size={resolveSize(node.props.size)}
        className={resolveRuntimeNodeClassName(node, interactionClass)}
        onChange={(nextSelected: boolean) => {
          setSelected(nextSelected);
          adaptValueChangeToDesignerEvent(eventProps.onChange, nextSelected);
        }}
      >
        <HSwitch.Content className="flex items-center gap-2">
          <HSwitch.Control>
            <HSwitch.Thumb />
          </HSwitch.Control>
          {label ? (
            <span className="text-xs font-semibold text-slate-700">{label}</span>
          ) : null}
        </HSwitch.Content>
      </HSwitch>
    </>
  );
};

/**
 * Slider stays uncontrolled (`defaultValue`) so we do not introduce a Document-level
 * controlled regression; local state only tracks the hidden form field + event adapters.
 */
const DesignerRuntimeSliderLeaf: React.FC<SwitchSliderLeafProps> = ({
  node,
  options,
  passthrough,
  interactionClass,
  isDisabled,
  style,
}) => {
  const formFieldName = resolveRegionFormFieldNameProps(node).name
    ?? (typeof node.props.name === 'string' ? node.props.name : undefined);
  const rangeMode = isSliderRangeMode(node);
  const initialValue = rangeMode ? resolveSliderRangeValue(node) : resolveSliderValue(node);
  const [formValue, setFormValue] = React.useState(
    rangeMode ? (initialValue as [number, number]).join(',') : String(initialValue),
  );
  React.useEffect(() => {
    if (rangeMode) {
      setFormValue(resolveSliderRangeValue(node).join(','));
    } else {
      setFormValue(String(resolveSliderValue(node)));
    }
  }, [node.props.value, node.props.defaultValue, node.props.minValue, node.props.maxValue, node.props.sliderMode]);

  const eventProps = resolveCanvasEventProps(node, options);
  const showTooltip = readBoolean(node.props.showTooltip);

  return (
    <>
      {formFieldName ? (
        <input type="hidden" name={formFieldName} value={formValue} readOnly />
      ) : null}
      <HSlider
        {...passthrough}
        aria-label={readString(node.props.ariaLabel, 'slider')}
        defaultValue={initialValue}
        isDisabled={isDisabled}
        className={resolveRuntimeNodeClassName(node, interactionClass)}
        style={style}
        {...(showTooltip ? { showTooltip: true } : {})}
        onChange={(nextValue: number | number[]) => {
          if (Array.isArray(nextValue)) {
            setFormValue(nextValue.join(','));
          } else {
            setFormValue(String(nextValue ?? ''));
          }
          adaptValueChangeToDesignerEvent(eventProps.onChange, nextValue);
        }}
      >
        <HSlider.Track>
          <HSlider.Fill />
          <HSlider.Thumb />
          {rangeMode ? <HSlider.Thumb /> : null}
        </HSlider.Track>
      </HSlider>
    </>
  );
};

const sharedFieldEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Pick<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onBlur' | 'onMouseEnter' | 'onKeyDown' | 'onKeyUp'> => {
  const eventProps = resolveCanvasEventProps(node, options);
  const baseOnChange = eventProps.onChange as React.ChangeEventHandler<HTMLInputElement> | undefined;
  const baseOnBlur = eventProps.onBlur as React.FocusEventHandler<HTMLInputElement> | undefined;

  return {
    onChange: baseOnChange
      ? (event) => {
        options.onPreviewFieldValidation?.(node.id, null);
        baseOnChange(event);
      }
      : undefined,
    onBlur: baseOnBlur || options.onPreviewFieldValidation
      ? (event) => {
        baseOnBlur?.(event as unknown as Event);
        if (options.onPreviewFieldValidation) {
          const message = validateDesignerFieldNode(node.props, event.target.value);
          options.onPreviewFieldValidation(node.id, message);
        }
      }
      : undefined,
    onMouseEnter: eventProps.onMouseEnter as React.MouseEventHandler<HTMLInputElement> | undefined,
    onKeyDown: eventProps.onKeyDown as React.KeyboardEventHandler<HTMLInputElement> | undefined,
    onKeyUp: eventProps.onKeyUp as React.KeyboardEventHandler<HTMLInputElement> | undefined,
  };
};

const libraryPassthrough = (node: DesignerNode, excludeKeys?: ReadonlySet<string>) =>
  resolveRuntimeComponentProps(node, { libraryComponent: true, excludeKeys });

const regionFormFieldProps = (node: DesignerNode) => resolveRegionFormFieldNameProps(node);

/**
 * Renders the real HeroUI component for a leaf designer node.
 */
export const renderHeroUiRealNode = (node: DesignerNode, options: RuntimeRenderOptions): React.ReactNode | null => {
  const paletteItemId = resolveRuntimePaletteItemId(node);
  if (paletteItemId === null) {
    return null;
  }

  if (paletteItemId === 'hwy.institute-logo-upload') {
    const fieldEventProps = sharedFieldEventProps(node, options);
    const displayValue = resolveRuntimeInputValue(node, options);
    const selection = options.designerStore?.selection;
    const instituteId = selection && typeof selection === 'object' && !Array.isArray(selection)
      ? (selection as Record<string, unknown>).id
      : null;
    const ariaLabel = resolveRuntimeFieldLabel(node, options) || 'Institute logo';
    const formFieldName = regionFormFieldProps(node).name;
    return (
      <div className={mergeClassNames('flex w-full flex-col items-center pb-1', readString(node.props.className))}>
        <HwyInstituteLogoUploadField
          key={resolveRegionBoundFieldKey(node, options)}
          instituteId={instituteId as number | string | null}
          value={displayValue || null}
          formFieldName={formFieldName}
          disabled={sharedDisabled(node)}
          ariaLabel={ariaLabel}
          onValueChange={({ base64 }) => {
            adaptValueChangeToDesignerEvent(
              fieldEventProps.onChange as ((event: Event) => void) | undefined,
              base64 ?? '',
            );
          }}
        />
      </div>
    );
  }

  if (paletteItemId === 'form.date-range') {
    return renderDateRangeLeafNode(node, options);
  }

  if (paletteItemId === 'heroui.date-picker') {
    return renderDatePickerLeafNode(node, options);
  }

  if (paletteItemId === 'form.code-editor') {
    return renderCodeEditorLeafNode(node, options);
  }

  if (paletteItemId === 'form.html-editor') {
    return renderHtmlEditorLeafNode(node, options);
  }

  if (paletteItemId === 'form.markdown-editor') {
    return renderMarkdownEditorLeafNode(node, options);
  }

  if (paletteItemId === 'form.mask-input') {
    return renderMaskInputLeafNode(node, options);
  }

  if (paletteItemId === 'form.calculator') {
    return renderCalculatorLeafNode(node, options);
  }

  if (paletteItemId === 'form.relation-tags-list') {
    return (
      <DesignerRuntimeRelationTagsList
        node={node}
        options={options}
      />
    );
  }

  if (paletteItemId === 'form.related-contents-list') {
    return (
      <DesignerRuntimeRelatedContentsList
        node={node}
        options={options}
      />
    );
  }

  if (paletteItemId === 'form.base-info-record') {
    return (
      <DesignerRuntimeBaseInfoRecordForm
        node={node}
        options={options}
      />
    );
  }

  if (paletteItemId === 'form.cms-content-assets') {
    return (
      <DesignerRuntimeCmsContentAssets
        node={node}
        options={options}
      />
    );
  }

  if (paletteItemId === 'heroui.color-control') {
    return renderColorEditorLeafNode(node, options);
  }

  if (paletteItemId === 'heroui.entity-picker') {
    return renderEntityPickerLeafNode(node, options);
  }

  const vizNode = renderVizPaletteNode(node, options);
  if (vizNode !== null) {
    return vizNode;
  }

  const universalNode = renderUniversalPaletteNode(node, options);
  if (universalNode !== null) {
    return universalNode;
  }

  const platformChromeNode = renderPlatformChromePaletteNode(node, options);
  if (platformChromeNode !== null) {
    return platformChromeNode;
  }

  if (!HEROUI_REAL_LEAF_IDS.has(paletteItemId)) {
    return renderHeroUiGenericLeafNode(node, paletteItemId, options);
  }

  const { mode, style } = options;
  const interactionClass = designInteractionClass(mode);
  const isDisabled = sharedDisabled(node);
  const passthrough = libraryPassthrough(node);

  switch (paletteItemId) {
    case 'heroui.button-solid':
    case 'heroui.button-outline': {
      const label = resolveRuntimeButtonText(
        node,
        options,
        readString(node.props.text, paletteItemId === 'heroui.button-outline' ? 'Secondary' : 'Action'),
      );
      const usesDirectionalText = readBoolean(node.props.directionalText);
      const buttonEvents = resolveCanvasEventProps(node, options);
      const href = readString(node.props.href);
      // Data Studio modeler back control — render the shared WorkspaceBackIcon (ArrowLeft
      // h-6, hit target h-8), not a HeroUI Button with a tiny leading icon.
      if (readBoolean(node.props.workspaceBack)) {
        const ariaLabel = readString(node.props['aria-label'], label || 'Back');
        const title = readString(node.props.title, ariaLabel);
        // Do not merge palette Button className — WorkspaceBackIcon owns its chrome.
        return (
          <WorkspaceBackIcon
            ariaLabel={ariaLabel}
            title={title}
            className={interactionClass || undefined}
            onClick={(buttonEvents.onClick as React.MouseEventHandler<HTMLButtonElement> | undefined)
              ?? (() => undefined)}
          />
        );
      }
      const pickFileCreateBehavior = parsePickFileCreateBehaviorFromProps(node.props);
      const isContentStatusTrigger = readBoolean(node.props.contentStatusTrigger)
        || readBoolean(node.props.contentStatusDisplay);
      const contentStatusOptionColor = node.props.contentStatusOptionColor;
      const contentStatusAppearance = isContentStatusTrigger
        ? resolveContentStatusTriggerAppearance(node, options, 'Status')
        : contentStatusOptionColor != null && String(contentStatusOptionColor).trim() !== ''
          ? resolveContentStatusOptionAppearance(contentStatusOptionColor)
          : null;
      const contentStatusIconName = isContentStatusTrigger
        ? resolveContentStatusTriggerIconName(node, options)
        : null;
      const pickFileCreateClick: React.MouseEventHandler<HTMLButtonElement> | undefined = pickFileCreateBehavior
        ? (event) => {
          event.preventDefault();
          void executePickFileCreateBehavior(pickFileCreateBehavior, {
            bindingDefinitions: options.bindingDefinitions
              ?? options.previewEvents?.bindingDefinitions,
            designerStore: options.designerStore ?? options.previewEvents?.designerStore,
            onRefresh: pickFileCreateBehavior.refreshList === false
              || !pickFileCreateBehavior.dataSourceRef
              || !options.previewEvents?.refreshDataSource
              ? undefined
              : () => options.previewEvents!.refreshDataSource!(pickFileCreateBehavior.dataSourceRef!),
          });
        }
        : undefined;
      // Bug found (parity audit item 94): Color field removed from Inspector, but leftover static
      // `color` on older documents still spread via libraryPassthrough. Exclude it (bound leaks
      // are suppressed in resolveBoundAttributeForNodeProp for Export parity).
      const buttonPassthrough = libraryPassthrough(node, new Set([
        'color', 'text', 'startIcon', 'endIcon', 'icon', 'isIconOnly', 'workspaceBack',
        'pickFileCreate', 'pickFileCreateConfig', 'pickFileCreateDataSourceRef',
        'contentStatusTrigger', 'contentStatusDisplay', 'contentStatusOptionColor', 'directionalText',
      ]));
      const startIconEl = renderIconElement(
        contentStatusIconName ?? node.props.startIcon ?? node.props.icon,
      );
      const endIconEl = renderIconElement(node.props.endIcon);
      const btnIsIconOnly = readBoolean(node.props.isIconOnly);
      return (
        <HButton
          {...buttonPassthrough}
          variant={resolveButtonVariant(node, paletteItemId)}
          size={resolveSize(node.props.size)}
          isDisabled={isDisabled}
          isPending={readBoolean(node.props.isLoading)}
          isIconOnly={btnIsIconOnly}
          className={resolveRuntimeNodeClassName(
            node,
            interactionClass,
            contentStatusAppearance?.className,
          )}
          style={{
            ...style,
            ...contentStatusAppearance?.style,
          }}
          {...(href
            ? {
              href,
              ...(readString(node.props.target) ? { target: readString(node.props.target) } : {}),
              ...(readString(node.props.rel) ? { rel: readString(node.props.rel) } : {}),
            }
            : {})}
          onClick={(event) => {
            if (pickFileCreateClick) {
              pickFileCreateClick(event);
              return;
            }
            const onClick = buttonEvents.onClick as React.MouseEventHandler<HTMLButtonElement> | undefined;
            if (onClick) {
              if (href) {
                event.preventDefault();
              }
              onClick(event);
            }
          }}
          onMouseEnter={buttonEvents.onMouseEnter as React.MouseEventHandler<HTMLButtonElement> | undefined}
        >
          {btnIsIconOnly
            ? (startIconEl ?? label)
            : (
              <>
                {startIconEl}
                {usesDirectionalText ? (
                  <DirectionalText
                    as="span"
                    text={label}
                    className="leading-none whitespace-pre-wrap"
                  />
                ) : (
                  <span className="leading-none">{label}</span>
                )}
                {endIconEl}
              </>
            )}
        </HButton>
      );
    }

    case 'heroui.link': {
      const linkEvents = resolveCanvasEventProps(node, options);
      return (
        <HLink
          {...passthrough}
          href={readString(node.props.href, '#')}
          className={resolveRuntimeNodeClassName(node, interactionClass)}
          style={style}
          onClick={linkEvents.onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}
          onMouseEnter={linkEvents.onMouseEnter as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        >
          {previewTextContent(node, readString(node.props.text, 'Read more'), options.previewBindings)}
        </HLink>
      );
    }

    case 'heroui.typography-lead':
      // Bug found (parity audit item 66): Color Inspector field removed — exclude leftover
      // `color` from older documents so it never spreads onto the raw `<p>`.
      return (
        <p
          {...libraryPassthrough(node, new Set(['color', 'text']))}
          className={resolveRuntimeNodeClassName(node, interactionClass)}
          style={style}
        >
          {previewTextContent(node, readString(node.props.text, 'Lead text for sections and summaries.'), options.previewBindings)}
        </p>
      );

    case 'heroui.chip': {
      const chipEvents = resolveCanvasEventProps(node, options);
      const chipStartIcon = renderIconElement(node.props.startIcon);
      const chipEndIcon = renderIconElement(node.props.endIcon);
      return (
        <HChip
          {...libraryPassthrough(node, new Set(['startIcon', 'endIcon']))}
          color={resolveChipColor(node.props.color)}
          variant={resolveChipVariant(node.props.variant)}
          size={resolveSize(node.props.size)}
          className={resolveRuntimeNodeClassName(node, interactionClass)}
          style={style}
          {...(chipStartIcon ? { startContent: chipStartIcon } : {})}
          {...(chipEndIcon ? { endContent: chipEndIcon } : {})}
          onMouseEnter={chipEvents.onMouseEnter as React.MouseEventHandler<HTMLDivElement> | undefined}
        >
          {previewTextContent(node, readString(node.props.text, 'Chip'), options.previewBindings)}
        </HChip>
      );
    }

    case 'heroui.spinner':
      return <HSpinner {...passthrough} size={resolveSize(node.props.size) as HeroSize} className={resolveRuntimeNodeClassName(node, interactionClass)} style={style} />;

    case 'heroui.skeleton':
      // Bug found (parity audit item 22): `isLoaded` removed — @heroui/react's real Skeleton has
      // no such prop at all (SkeletonRootProps only has `animationType`), so it was always fully
      // inert. Wired the real `animationType` variant instead (previously not exposed anywhere).
      return (
        <HSkeleton
          {...libraryPassthrough(node, new Set(['className', 'animationType']))}
          className={mergeClassNames(readNodeClassName(node) || 'h-4 w-full', interactionClass)}
          style={style}
          animationType={readString(node.props.animationType, 'shimmer') as 'none' | 'pulse' | 'shimmer'}
        />
      );

    case 'heroui.avatar': {
      // Bug found (parity audit item 21): `fallbackSrc` ("Fallback Source") removed —
      // @heroui/react's real `Avatar.Image` doesn't declare any such prop at all, so it was
      // always fully inert here; the real fallback UI is `Avatar.Fallback` below (driven by the
      // separate, working `text` field).
      const avatarEvents = resolveCanvasEventProps(node, options);
      const imageSrc = previewImageSrc(node, readString(node.props.src), options.previewBindings);
      return (
        <HAvatar
          {...passthrough}
          size={resolveSize(node.props.size)}
          className={resolveRuntimeNodeClassName(node, interactionClass)}
          style={style}
          onMouseEnter={avatarEvents.onMouseEnter as React.MouseEventHandler<HTMLDivElement> | undefined}
        >
          {imageSrc ? (
            <HAvatar.Image
              src={imageSrc}
              alt={previewImageAlt(node, readString(node.props.alt, 'Avatar'), options.previewBindings)}
            />
          ) : null}
          <HAvatar.Fallback>
            {previewTextContent(node, readString(node.props.text, 'AB'), options.previewBindings)}
          </HAvatar.Fallback>
        </HAvatar>
      );
    }

    case 'heroui.switch':
      return (
        <DesignerRuntimeSwitchLeaf
          key={resolveRegionBoundFieldKey(node, options)}
          node={node}
          options={options}
          // Exclude value/defaultValue — regionColumn mis-bound to `value` must not fight
          // controlled `isSelected` (same freeze pattern as Slider, parity item 56).
          // `label` is rendered beside Control (UiSwitch pattern), not as a DOM attr.
          passthrough={libraryPassthrough(node, new Set(['size', 'isSelected', 'value', 'defaultValue', 'label']))}
          interactionClass={interactionClass}
          isDisabled={isDisabled}
        />
      );

    case 'heroui.progress':
      return (
        <HProgressBar
          {...passthrough}
          aria-label={readString(node.props.ariaLabel, 'progress')}
          value={resolvePreviewProgressValue(node, options)}
          size={resolveSize(node.props.size)}
          className={resolveRuntimeNodeClassName(node, interactionClass)}
          style={style}
        >
          <HProgressBar.Track>
            <HProgressBar.Fill />
          </HProgressBar.Track>
        </HProgressBar>
      );

    case 'heroui.slider':
      return (
        <DesignerRuntimeSliderLeaf
          node={node}
          options={options}
          // Bug found (parity audit item 56): spreading `value` from libraryPassthrough alongside
          // `defaultValue` makes react-stately treat the slider as controlled and locks the thumb.
          // Item 55: `size` is not a real Slider variant — strip leftovers from older docs.
          passthrough={libraryPassthrough(node, new Set(['value', 'defaultValue', 'size', 'sliderMode', 'minValue', 'maxValue', 'showTooltip']))}
          interactionClass={interactionClass}
          isDisabled={isDisabled}
          style={style}
        />
      );

    case 'heroui.input-text': {
      const fieldEventProps = sharedFieldEventProps(node, options);
      const boundInputProps = resolveRegionBoundInputProps(node, options, Boolean(fieldEventProps.onChange));
      const fieldLabel = resolveRuntimeFieldLabel(node, options);
      return (
        <UiInput
          key={resolveRegionBoundFieldKey(node, options)}
          {...libraryPassthrough(node, new Set([...INPUT_VALIDATION_EXCLUDE_KEYS, ...INPUT_UX_EXCLUDE_KEYS, 'label', 'title']))}
          {...resolveInputValidationProps(node, options.previewFieldErrors)}
          {...resolveInputUxProps(node)}
          {...regionFormFieldProps(node)}
          type={resolveInputType(node)}
          placeholder={resolveRuntimeFieldPlaceholder(node, options, readString(node.props.placeholder, 'Text input'))}
          {...boundInputProps}
          isDisabled={isDisabled}
          isRequired={readBoolean(node.props.isRequired) || readBoolean(node.props.required)}
          size={resolveFieldSize(node.props.size)}
          className={resolveRuntimeNodeClassName(node, interactionClass)}
          label={fieldLabel || undefined}
          fieldLabel={fieldLabel || undefined}
          aiAssist={resolveNodeAiAssistEnabled(node)}
          aiAssistSurface={options.mode === 'runtime' ? 'published' : 'admin'}
          {...fieldEventProps}
        />
      );
    }

    case 'heroui.number-input': {
      const numberFieldEventProps = sharedFieldEventProps(node, options);
      const boundNumberProps = resolveRegionBoundInputProps(node, options, Boolean(numberFieldEventProps.onChange));
      const numberFieldLabel = resolveRuntimeFieldLabel(node, options);
      return (
        <UiInput
          key={resolveRegionBoundFieldKey(node, options)}
          {...libraryPassthrough(node, new Set([...INPUT_VALIDATION_EXCLUDE_KEYS, ...INPUT_UX_EXCLUDE_KEYS, 'type', 'label', 'title']))}
          {...resolveInputValidationProps(node, options.previewFieldErrors)}
          {...resolveInputUxProps(node)}
          {...regionFormFieldProps(node)}
          type="number"
          placeholder={resolveRuntimeFieldPlaceholder(node, options, readString(node.props.placeholder, '0'))}
          {...boundNumberProps}
          min={readString(node.props.min) || undefined}
          max={readString(node.props.max) || undefined}
          step={readString(node.props.step) || undefined}
          isDisabled={isDisabled}
          isRequired={readBoolean(node.props.isRequired) || readBoolean(node.props.required)}
          size={resolveFieldSize(node.props.size)}
          className={resolveRuntimeNodeClassName(node, interactionClass)}
          label={numberFieldLabel || undefined}
          {...numberFieldEventProps}
        />
      );
    }

    case 'heroui.textarea': {
      const textareaEventProps = sharedFieldEventProps(node, options);
      const boundTextareaProps = resolveRegionBoundInputProps(node, options, Boolean(textareaEventProps.onChange));
      const fieldLabel = resolveRuntimeFieldLabel(node, options);
      const semanticPolicy = resolveDesignerSemanticValidationPolicy(node);
      const textareaPassthroughExclude = new Set([
        ...INPUT_VALIDATION_EXCLUDE_KEYS,
        ...INPUT_UX_EXCLUDE_KEYS,
        'label',
        'title',
        ...DESIGNER_SEMANTIC_VALIDATION_EXCLUDE_KEYS,
      ]);
      const sharedTextareaProps = {
        key: resolveRegionBoundFieldKey(node, options),
        ...libraryPassthrough(node, textareaPassthroughExclude),
        ...resolveInputValidationProps(node, options.previewFieldErrors),
        ...resolveInputUxProps(node),
        ...regionFormFieldProps(node),
        placeholder: resolveRuntimeFieldPlaceholder(node, options, readString(node.props.placeholder, 'Text area')),
        ...boundTextareaProps,
        isDisabled: isDisabled,
        isRequired: readBoolean(node.props.isRequired) || readBoolean(node.props.required),
        rows: readNumber(node.props.minRows, 3),
        maxRows: readNumber(node.props.maxRows, 0) > 0 ? readNumber(node.props.maxRows, 0) : undefined,
        size: resolveFieldSize(node.props.size),
        className: resolveRuntimeNodeClassName(node, interactionClass),
        label: fieldLabel || undefined,
        fieldLabel: fieldLabel || undefined,
        aiAssist: resolveNodeAiAssistEnabled(node),
        aiAssistSurface: options.mode === 'runtime' ? 'published' as const : 'admin' as const,
        ...textareaEventProps,
      };

      if (semanticPolicy) {
        const guidance = resolveDesignerSemanticUserGuidance(node);
        return (
          <SemanticAssistTextarea
            {...sharedTextareaProps}
            semanticValidation={semanticPolicy}
            userGuidance={guidance || undefined}
            reasonsLanguage={resolveDesignerSemanticReasonsLanguage(node)}
          />
        );
      }

      return (
        <UiTextarea
          {...sharedTextareaProps}
        />
      );
    }

    case 'heroui.select': {
      return (
        <DesignerRuntimeSelect
          node={node}
          options={options}
          interactionClass={interactionClass}
        />
      );
    }

    case 'heroui.autocomplete':
      return (
        <DesignerRuntimeAutocomplete
          node={node}
          options={options}
          interactionClass={interactionClass}
        />
      );

    case 'heroui.listbox':
      return (
        <DesignerRuntimeListbox
          node={node}
          options={options}
          interactionClass={interactionClass}
        />
      );

    case 'heroui.dropdown':
      return (
        <DesignerRuntimeDropdown
          node={node}
          options={options}
          interactionClass={interactionClass}
        />
      );

    case 'heroui.tooltip-trigger':
      return (
        <DesignerRuntimeTooltipTrigger
          node={node}
          options={options}
          interactionClass={interactionClass}
        />
      );

    default:
      return renderHeroUiGenericLeafNode(node, paletteItemId, options);
  }
};

/**
 * Renders structural HeroUI containers with designer children placed in the real slot.
 */
export const renderHeroUiStructuralNode = (
  node: DesignerNode,
  options: RuntimeStructuralRenderOptions,
): React.ReactNode | null => {
  const paletteItemId = getNodePaletteItemId(node);
  if (paletteItemId === null || !HEROUI_STRUCTURAL_IDS.has(paletteItemId)) {
    return null;
  }

  const { mode, style, className, children, childElements = [], childNodes = [] } = options;
  const interactionClass = designInteractionClass(mode);
  const shellClassName = mergeClassNames(className, interactionClass);

  switch (paletteItemId) {
    case 'heroui.card': {
      // Bug found: title/description are bindable Inspector fields, but this previously read
      // static node.props directly with no binding awareness — a Property Binding configured
      // for either field had zero effect in the live/interactive preview.
      const title = options.previewBindings?.resolveTextProp
        ? options.previewBindings.resolveTextProp(node, 'title', '')
        : readString(node.props.title);
      const description = options.previewBindings?.resolveTextProp
        ? options.previewBindings.resolveTextProp(node, 'description', '')
        : readString(node.props.description);
      return (
        <HCard {...libraryPassthrough(node)} className={shellClassName} style={style}>
          {title || description ? (
            <HCard.Header>
              {title ? <HCard.Title>{title}</HCard.Title> : null}
              {description ? <HCard.Description>{description}</HCard.Description> : null}
            </HCard.Header>
          ) : null}
          <HCard.Content>{wrapDesignerChildSlot(children, mode)}</HCard.Content>
        </HCard>
      );
    }

    case 'heroui.tabs': {
      const tabRecords = parseDesignerTabItems(node.props.items);
      const tabsEventProps = resolveCanvasEventProps(node, options);
      const tabItems: UiTabItem[] = tabRecords.map((item, index) => ({
        id: item.key,
        label: item.label,
        content: wrapDesignerChildSlot(childElements[index] ?? null, mode),
      }));
      return (
        <div className={interactionClass} style={style}>
          <div className={mode === 'design' ? 'pointer-events-auto min-w-0 w-full' : 'min-w-0 w-full'}>
            <DesignerRuntimeTabs
              node={node}
              items={tabItems}
              className={className}
              mode={mode}
              onSelectionChange={(nextKey) => {
                adaptSelectionChangeToDesignerEvent(tabsEventProps.onSelectionChange, nextKey);
              }}
            />
          </div>
        </div>
      );
    }

    case 'heroui.accordion-item': {
      // Bug found: 'title' is a bindable Inspector field, but resolveAccordionTitle only ever
      // reads static node.props — a Property Binding configured for it had zero effect in the
      // live/interactive preview.
      const title = options.previewBindings?.resolveTextProp
        ? options.previewBindings.resolveTextProp(node, 'title', resolveAccordionTitle(node))
        : resolveAccordionTitle(node);
      return (
        <HAccordion defaultExpandedKeys={mode === 'design' ? ['item-0'] : undefined} className={shellClassName} style={style}>
          <HAccordion.Item id="item-0">
            <HAccordion.Heading>
              <HAccordion.Trigger>
                {title}
                <HAccordion.Indicator />
              </HAccordion.Trigger>
            </HAccordion.Heading>
            <HAccordion.Panel>{wrapDesignerChildSlot(children, mode)}</HAccordion.Panel>
          </HAccordion.Item>
        </HAccordion>
      );
    }

    case 'heroui.modal':
    case 'heroui.alert-dialog': {
      // Bug found: 'title' is a bindable Inspector field (matching heroui.card/accordion-item),
      // but this read static node.props directly with no binding awareness — a Property Binding
      // configured for Modal/Alert-Dialog's title had zero effect in the live/interactive preview.
      const modalTitleFallback = paletteItemId === 'heroui.alert-dialog' ? 'Alert' : 'Modal';
      const titleLiteral = readString(node.props.title, modalTitleFallback);
      const titleKey = readString(node.props.titleTranslationKey);
      const title = titleKey && options.translate
        ? resolveDesignerCulturePropText(
          node,
          'titleTranslationKey',
          'title',
          titleLiteral,
          options.translate,
        )
        : (options.previewBindings?.resolveTextProp
          ? options.previewBindings.resolveTextProp(node, 'title', titleLiteral)
          : titleLiteral);
      const modalIsOpen = resolveOverlayIsOpen(node, options.designerStore);
      const visibilityPath = visibilityStorePathForNode(node.id);
      const headerTone = resolveDesignerModalHeaderTone(paletteItemId, node.props.tone);
      const headerClassName = resolveDesignerModalHeaderClassName(headerTone);
      const headingClassName = resolveDesignerModalTitleClassName(headerTone);
      const dialogClassName = mergeDesignerModalDialogClassName(className, node.props.size);
      const createEditSize = resolveDesignerCreateEditModalSize(
        node.props.size,
        paletteItemId === 'heroui.alert-dialog' ? 'sm' : 'lg',
      );
      const CloseIcon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>).X;
      // Exported code sets role="alertdialog" on Modal.Dialog for heroui.alert-dialog; mirror it here
      // so the live canvas/preview announces the same ARIA role as the published component.
      const dialogRoleProps = paletteItemId === 'heroui.alert-dialog' ? { role: 'alertdialog' as const } : {};
      const closeOverlay = () => {
        options.previewEvents?.patchStore(visibilityPath, false);
      };
      const header = (
        <HModal.Header className={headerClassName}>
          <HModal.Heading className={headingClassName}>{title}</HModal.Heading>
          <button
            type="button"
            className={DESIGNER_MODAL_CLOSE_BUTTON_CLASS}
            aria-label="Close"
            title="Close"
            onClick={closeOverlay}
          >
            {CloseIcon ? <CloseIcon className="h-4 w-4" /> : '×'}
          </button>
        </HModal.Header>
      );
      if (mode === 'design') {
        return (
          <div className={mergeClassNames(dialogClassName, interactionClass)} style={style}>
            <HModal.Dialog {...dialogRoleProps}>
              {header}
              <HModal.Body className={DESIGNER_MODAL_BODY_CLASS}>{wrapDesignerChildSlot(children, mode)}</HModal.Body>
            </HModal.Dialog>
          </div>
        );
      }

      // Published / interactive preview: use Base Components Create/Edit + Confirm shells so
      // CMS and other Client Components match /studio/base-components/create-edit exactly
      // (admin backdrop, header, body, footer chrome). Action footer is lifted into shell
      // `footer` (DialogFooter) — never nested under body overflow (white gutter bug).
      const overlayChildElements = normalizeOverlayChildElements(childElements, children);
      if (paletteItemId === 'heroui.modal') {
        // CMS related-contents create: visibility store only — RelatedContentsList owns the picker shell.
        if (readBoolean(node.props.relatedContentPickerHost)) {
          return null;
        }
        if (!modalIsOpen) {
          return null;
        }
        const { body, footer } = partitionDesignerOverlayBodyAndFooter(childNodes, overlayChildElements);
        const shellBodyClasses = resolveDesignerModalShellBodyClassNames({
          size: createEditSize,
          hasActionFooter: footer != null,
        });
        return (
          <CreateEditModalShell
            title={title}
            size={createEditSize}
            onClose={closeOverlay}
            onBackdropClick={node.props.isDismissable === false ? undefined : closeOverlay}
            closeOnEscape={node.props.isKeyboardDismissDisabled !== true}
            gradient={false}
            bodyOuterClassName={shellBodyClasses.bodyOuterClassName}
            bodyClassName={shellBodyClasses.bodyClassName}
            footerClassName={DESIGNER_MODAL_SHELL_FOOTER_CLASS}
            footer={footer}
          >
            {wrapDesignerChildSlot(body, mode)}
          </CreateEditModalShell>
        );
      }

      if (!modalIsOpen) {
        return null;
      }
      const { body, footer } = partitionDesignerOverlayBodyAndFooter(childNodes, overlayChildElements);
      const DangerIcon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>).Trash2;
      return (
        <ConfirmDialogShell
          title={title}
          size={createEditSize}
          tone={headerTone}
          icon={headerTone === 'danger' && DangerIcon ? <DangerIcon className="h-4 w-4" /> : undefined}
          onClose={closeOverlay}
          onBackdropClick={node.props.isDismissable === false ? undefined : closeOverlay}
          closeOnEscape={node.props.isKeyboardDismissDisabled !== true}
          hideCancel
          hideConfirm
          bodyClassName={DESIGNER_MODAL_SHELL_BODY_INNER_CLASS}
          footerClassName={DESIGNER_MODAL_SHELL_FOOTER_CLASS}
          footer={footer}
        >
          {wrapDesignerChildSlot(body, mode)}
        </ConfirmDialogShell>
      );
    }

    case 'heroui.drawer': {
      // Bug found: same as modal/alert-dialog above — 'title' is bindable but was read as a
      // static prop only, with no binding awareness in the live/interactive preview.
      const title = options.previewBindings?.resolveTextProp
        ? options.previewBindings.resolveTextProp(node, 'title', 'Drawer')
        : readString(node.props.title, 'Drawer');
      // Align with modal/alert-dialog: showHide / grid-detail share ui.visibility.<nodeId>.
      const drawerIsOpen = resolveOverlayIsOpen(node, options.designerStore);
      const visibilityPath = visibilityStorePathForNode(node.id);
      if (mode === 'design') {
        return (
          <div className={shellClassName} style={style}>
            <HDrawer.Dialog>
              <HDrawer.Header>
                <HDrawer.Heading>{title}</HDrawer.Heading>
              </HDrawer.Header>
              <HDrawer.Body>{wrapDesignerChildSlot(children, mode)}</HDrawer.Body>
            </HDrawer.Dialog>
          </div>
        );
      }

      // Drawer must wrap Content in Backdrop (matching Modal/AlertDialog) — without it,
      // there is no dismissable overlay, so clicking outside/Escape can never close the
      // drawer once opened; only an explicit "hide" DynamicAction could ever close it.
      const drawerOverlayParts = resolveModalOverlayPartProps(node);
      return (
        <HDrawer>
          <HDrawer.Backdrop
            isOpen={drawerIsOpen}
            isDismissable={node.props.isDismissable !== false}
            onOpenChange={(isOpen: boolean) => {
              if (!isOpen) {
                options.previewEvents?.patchStore(visibilityPath, false);
              }
            }}
            {...drawerOverlayParts.backdrop}
          >
            <HDrawer.Content className={className} style={style} placement={readString(node.props.placement) || undefined}>
              <HDrawer.Dialog>
                <HDrawer.Header>
                  <HDrawer.Heading>{title}</HDrawer.Heading>
                </HDrawer.Header>
                <HDrawer.Body>{wrapDesignerChildSlot(children, mode)}</HDrawer.Body>
              </HDrawer.Dialog>
            </HDrawer.Content>
          </HDrawer.Backdrop>
        </HDrawer>
      );
    }

    case 'heroui.table':
    case 'heroui.data-grid':
      return renderDataGridStructuralNode(node, {
        mode,
        style,
        className,
        children,
        gridRows: options.gridRows,
        gridListTotalCount: options.gridListTotalCount,
        gridListBound: options.gridListBound,
        gridListLoading: options.gridListLoading,
        gridListError: options.gridListError,
        onGridRowAction: options.onGridRowAction,
        onGridCellClick: options.onGridCellClick,
        onGridRefresh: options.onGridRefresh,
        designerStore: options.designerStore,
        previewEvents: options.previewEvents,
        bindingDefinitions: options.bindingDefinitions,
        designerDocument: options.designerDocument,
      });

    case 'heroui.app-table-grid':
      return renderAppTableGridStructuralNode(node, {
        mode,
        style,
        className,
        children,
        gridRows: options.gridRows,
        gridListTotalCount: options.gridListTotalCount,
        gridListBound: options.gridListBound,
        gridListLoading: options.gridListLoading,
        gridListError: options.gridListError,
        onGridRowAction: options.onGridRowAction,
        onGridCellClick: options.onGridCellClick,
        onGridRefresh: options.onGridRefresh,
        designerStore: options.designerStore,
        previewEvents: options.previewEvents,
        bindingDefinitions: options.bindingDefinitions,
        designerDocument: options.designerDocument,
      });

    case 'heroui.crud-set':
      return renderCrudSetStructuralNode(node, {
        mode,
        style,
        className,
        gridRows: options.gridRows,
        gridListTotalCount: options.gridListTotalCount,
        gridListBound: options.gridListBound,
        gridListLoading: options.gridListLoading,
        gridListError: options.gridListError,
        onGridRefresh: options.onGridRefresh,
        previewEvents: options.previewEvents,
        bindingDefinitions: options.bindingDefinitions,
        designerDocument: options.designerDocument,
      });

    case 'heroui.record-form':
      return renderRecordFormStructuralNode(node, {
        mode,
        style,
        className,
      });

    case 'heroui.field-container': {
      // Bug found (parity audit item 45): label was read as a static string only — bindable in
      // Inspector but never resolved via previewBindings (unlike avatar `text`). Use resolveTextProp
      // so Store/property bindings update the legend in Canvas/Preview.
      const staticLegend = readString(node.props.label, readString(node.props.title));
      const legend = options.previewBindings?.resolveTextProp?.(node, 'label', staticLegend)
        ?? staticLegend;
      return (
        <fieldset className={shellClassName} style={style}>
          {legend ? <legend className="ps-[4px] text-xs font-semibold uppercase tracking-wide text-slate-600">{legend}</legend> : null}
          <div className="flex flex-col gap-[2px]">
            {wrapDesignerChildSlot(children, mode)}
          </div>
        </fieldset>
      );
    }

    case 'heroui.toast':
      // Legacy palette widget removed (T1-5). Keep load-safe render: ignore toast shell, keep children.
      return (
        <div
          className={shellClassName}
          style={style}
          data-designer-legacy-palette="heroui.toast"
          data-testid="legacy-heroui-toast"
          title="Toast widget removed — use Interactions → Show Toast"
        >
          {mode === 'design' ? (
            <div className="mb-1 rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              Deprecated: Toast is no longer a canvas widget. Use the Show Toast action instead.
            </div>
          ) : null}
          {wrapDesignerChildSlot(children, mode)}
        </div>
      );

    case 'heroui.breadcrumbs':
      return (
        <DesignerRuntimeBreadcrumbs
          node={node}
          options={{ mode, style, className: shellClassName, children, childNodes }}
          interactionClass={interactionClass}
          children={children}
          childNodes={childNodes}
        />
      );

    case 'heroui.pagination':
      return (
        <DesignerRuntimePagination
          node={node}
          options={{
            ...options,
            style,
            className: shellClassName,
            children,
            childNodes,
          }}
          interactionClass={interactionClass}
          children={children}
        />
      );

    case 'heroui.checkbox-group':
      return (
        <DesignerRuntimeCheckboxGroup
          node={node}
          options={{
            ...options,
            style,
            className: shellClassName,
            children,
            childNodes,
          }}
          interactionClass={interactionClass}
          children={children}
          childNodes={childNodes}
        />
      );

    case 'heroui.radio-group':
      return (
        <DesignerRuntimeRadioGroup
          node={node}
          options={{
            ...options,
            style,
            className: shellClassName,
            children,
            childNodes,
          }}
          interactionClass={interactionClass}
          children={children}
          childNodes={childNodes}
        />
      );

    case 'heroui.tags-input':
      return (
        <DesignerRuntimeTagsInput
          node={node}
          options={{
            ...options,
            style,
            className: shellClassName,
            children,
            childNodes,
          }}
          interactionClass={interactionClass}
          children={children}
        />
      );

    case 'heroui.toolbar':
      return (
        <HToolbar
          {...libraryPassthrough(node, new Set(['text']))}
          className={shellClassName}
          style={style}
        >
          {wrapDesignerChildSlot(children, mode)}
        </HToolbar>
      );

    default:
      if (paletteItemId) {
        return renderHeroUiGenericStructuralNode(node, paletteItemId, {
          mode,
          style,
          className: shellClassName,
          children,
        });
      }
      return null;
  }
};

export { renderDesignerDocumentPreview } from './designerRuntimePreview';
