import type { DesignerDocument, DesignerNode } from './types';
import { parseDesignerAutocompleteItems } from './designerAutocompleteItems';
import {
  parseDesignerTabItems,
  readUiTabsAlignment,
  readUiTabsOverflow,
  readUiTabsPanelAttachment,
  readUiTabsPlacement,
  readUiTabsVariant,
  readUiTabsWidth,
} from './designerTabItems';
import {
  getNodePaletteItemId,
  readBoolean,
  readNumber,
  readString,
  resolveAccordionTitle,
  resolveButtonVariant,
  resolveChipColor,
  resolveChipVariant,
  resolveFieldSize,
  resolveInputType,
  resolveProgressValue,
  resolveSize,
  resolveSliderValue,
  resolveSliderRangeValue,
  isSliderRangeMode,
} from './runtimeShared';
import {
  DESIGNER_SEMANTIC_VALIDATION_EXCLUDE_KEYS,
  renderDesignerSemanticValidationJsxAttrs,
  resolveDesignerSemanticValidationPolicy,
} from './designerSemanticValidation';
import { resolveTsxComponentSpec, type TsxComponentSpec } from './tsxComponentRegistry';
import { resolveImageObjectFitStyle, resolveModalOverlayPartProps } from './runtimeNodeProps';
import {
  escapeJsxTextContent,
  indentJsxBlock,
  jsxAttributeStringValue,
  renderJsxTextContent,
  renderNodeJsxAttributes,
  renderJsxAttributesFromProps,
  buildNodeJsxAttributesWithBindings,
  type BuildNodeJsxAttributesOptions,
} from './tsxPropMapper';
import {
  adaptAutocompleteOnChangeAttr,
  renderCalculatorCustomJsx,
  renderRelationTagsListCustomJsx,
  renderRelatedContentsListCustomJsx,
  renderCmsContentAssetsCustomJsx,
  renderBaseInfoRecordCustomJsx,
  renderMaskInputCustomJsx,
  renderCodeEditorCustomJsx,
  renderColorEditorCustomJsx,
  renderHwyInstituteLogoUploadCustomJsx,
  renderDataGridCustomJsx,
  renderAppTableGridCustomJsx,
  renderCrudSetCustomJsx,
  renderRecordFormCustomJsx,
  renderDatePickerCustomJsx,
  renderDateRangeCustomJsx,
  renderEntityPickerCustomJsx,
  renderHtmlEditorCustomJsx,
  renderMarkdownEditorCustomJsx,
  renderSplitPaneContainerJsx,
  renderDockPaneContainerJsx,
  renderContentStatusPickerJsx,
} from './tsxPhase2Palette';
import { renderVizPaletteJsx } from './tsxVizPalette';
import { renderUniversalPaletteJsx } from './tsxUniversalPalette';
import { renderPlatformPaletteJsx } from './tsxPlatformPalette';
import {
  renderBreadcrumbsParityJsx,
  renderCheckboxGroupParityJsx,
  renderPaginationParityJsx,
  renderRadioGroupParityJsx,
  renderTagsInputParityJsx,
  renderTooltipTriggerParityJsx,
} from './tsxParityPalette';
import {
  isNodePropBound,
  renderBoundJsxTextExpression,
  renderDesignerItemsMapperExpression,
  resolveBoundAttributeForNodeProp,
  resolveNodeOptionItemsDataExpression,
  resolveNodePropertyBindingExpression,
  resolveSubmitButtonIsDisabledValue,
  tsxBindingRawExpr,
  type TsxBindingRenderContext,
} from './bindingCodegen';
import { visibilityStorePathForNode } from './bindingDynamicActionsEngine';
import { buildStorePathAccessExpression, readNodeVisibleCondition } from './visibilityConditionEngine';
import { collectGridDetailModalNodeIds } from './bindingGridDetailEngine';
import { DESIGNER_STORE_PATCH_VAR } from './bindingStoreCodegen';
import { renderTranslatableJsxTextContent } from './translatableTextContentCodegen';
import { renderTailwindUiBlockInnerJsx } from './tailwindUiBlocksExport';
import {
  renderLogicRepeaterJsx,
  shouldRenderAsLogicRepeater,
  wrapNodeJsxWithClientAndVisibility,
} from './tsxLogicRenderer';
import {
  DESIGNER_MODAL_SHELL_BODY_INNER_CLASS,
  DESIGNER_MODAL_SHELL_FOOTER_CLASS,
  partitionDesignerOverlayChildIds,
  resolveDesignerCreateEditModalSize,
  resolveDesignerModalHeaderTone,
  resolveDesignerModalShellBodyClassNames,
} from './designerModalChrome';

const renderAttrs = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  options: BuildNodeJsxAttributesOptions = {},
): string => (bindingContext
  ? buildNodeJsxAttributesWithBindings(node, bindingContext, options)
  : renderNodeJsxAttributes(node, options));

/** Shared by heroui.modal/alert-dialog/drawer — true when a showHide Dynamic Action, GridDetail
 * flow, or manual `visibleCondition` on `ui.visibility.<nodeId>` drives open state via the store
 * (not local useState). Store-driven overlays must not also emit `{isOpen ? … : null}` — that
 * double-wraps with `evaluateDesignerCondition` and produces invalid nested JSX in export. */
const modalOverlayUsesStoreOpen = (nodeId: string, bindingContext?: TsxBindingRenderContext): boolean => {
  if (!bindingContext) {
    return false;
  }
  if (bindingContext.showHideTargetNodeIds.has(nodeId)) {
    return true;
  }
  if (collectGridDetailModalNodeIds(bindingContext.document).has(nodeId)) {
    return true;
  }
  const node = bindingContext.document.nodes[nodeId];
  if (node) {
    const visibilityPath = visibilityStorePathForNode(nodeId);
    if (readNodeVisibleCondition(node).includes(visibilityPath)) {
      return true;
    }
  }
  return false;
};

const sanitizeModalOverlayIdentifier = (nodeId: string): string => nodeId.replace(/[^a-zA-Z0-9_]/g, '_');

/**
 * Bug found: when a Modal/Alert-Dialog/Drawer's open state was NOT driven by a showHide Dynamic
 * Action or GridDetail flow, the exported/published component emitted a bare, static `isOpen`
 * with no `onOpenChange` handler at all — the overlay could never be dismissed by the user
 * (backdrop click / Escape) in the real published app, a permanent full-page-blocking overlay.
 * Gives each such node its own local `useState<boolean>`, seeded from the static Inspector
 * "Open" checkbox, so dismissing genuinely closes it — the same "declare once in the component
 * preamble" pattern already used for heroui.tags-input (see tsxParityPalette.ts).
 */
const modalOverlayOpenStateVarNames = (nodeId: string): { openVar: string; setOpenVar: string } => {
  const suffix = sanitizeModalOverlayIdentifier(nodeId);
  return { openVar: `isOpen_${suffix}`, setOpenVar: `setIsOpen_${suffix}` };
};

const MODAL_DRAWER_OVERLAY_PALETTE_IDS = new Set(['heroui.modal', 'heroui.alert-dialog', 'heroui.drawer']);

export const collectModalDrawerNodesNeedingLocalOpenState = (
  document: DesignerDocument,
  bindingContext?: TsxBindingRenderContext,
): DesignerNode[] => Object.values(document.nodes).filter((node) => {
  const paletteId = getNodePaletteItemId(node);
  return Boolean(paletteId)
    && MODAL_DRAWER_OVERLAY_PALETTE_IDS.has(paletteId as string)
    && !modalOverlayUsesStoreOpen(node.id, bindingContext);
});

export const renderModalDrawerOpenStatePreambleLines = (
  document: DesignerDocument,
  bindingContext?: TsxBindingRenderContext,
): string[] => {
  const nodes = collectModalDrawerNodesNeedingLocalOpenState(document, bindingContext);
  if (nodes.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const node of nodes) {
    const { openVar, setOpenVar } = modalOverlayOpenStateVarNames(node.id);
    lines.push(`  const [${openVar}, ${setOpenVar}] = React.useState(${readBoolean(node.props.isOpen) ? 'true' : 'false'});`);
  }
  return lines;
};

/**
 * HeroUI Switch/Slider call onChange with a raw value (boolean | number), not a DOM Event.
 * Preview adapts via adaptValueChangeToDesignerEvent; export must emit the same adapter so
 * generated handlers that read event.target.value still receive the value.
 */
/**
 * Bug found: a static, non-empty default "Value" on `heroui.input-text`/`number-input`/
 * `textarea` was always emitted as a real, controlled `value=` attribute — with no `onChange`
 * wired anywhere, React resets the DOM value back to that unchanging prop every render, so the
 * exported/published field cannot be typed into at all. The live canvas/preview already avoids
 * this (`resolveRegionBoundInputProps` in runtimeRenderer.tsx falls back to `defaultValue` when
 * there's no change handler) — mirror the same decision in codegen: keep `value` (controlled)
 * only when a real onChange handler is wired for this node, else use `defaultValue`
 * (uncontrolled, so the field stays typable).
 */
const hasOnChangeHandler = (
  nodeId: string,
  bindingContext: TsxBindingRenderContext | undefined,
): boolean => Boolean(bindingContext?.handlerNames.has(`${nodeId}:onChange`));

const resolveStaticValueAttrKey = (
  nodeId: string,
  bindingContext: TsxBindingRenderContext | undefined,
): 'value' | 'defaultValue' =>
  (hasOnChangeHandler(nodeId, bindingContext) ? 'value' : 'defaultValue');

const readTrimmedNodeProp = (node: DesignerNode, prop: string): string => readString(node.props[prop]);

const cultureTJsxAttr = (translationKey: string) =>
  tsxBindingRawExpr(`culture.t(${JSON.stringify(translationKey)})`);

const resolveFieldPlaceholderReserved = (
  node: DesignerNode,
  fallback: string,
): string | ReturnType<typeof tsxBindingRawExpr> => {
  const key = readTrimmedNodeProp(node, 'placeholderTranslationKey');
  if (key) {
    return cultureTJsxAttr(key);
  }
  return readString(node.props.placeholder, fallback);
};

const resolveFieldLabelReserved = (
  node: DesignerNode,
): string | ReturnType<typeof tsxBindingRawExpr> | undefined => {
  const key = readTrimmedNodeProp(node, 'labelTranslationKey');
  if (key) {
    return cultureTJsxAttr(key);
  }
  const literal = readString(node.props.label, readString(node.props.title, ''));
  return literal.length > 0 ? literal : undefined;
};

const resolveFieldAriaLabelReserved = (
  node: DesignerNode,
  labelFallback: string,
): string | ReturnType<typeof tsxBindingRawExpr> | undefined => {
  const key = readTrimmedNodeProp(node, 'placeholderTranslationKey')
    || readTrimmedNodeProp(node, 'labelTranslationKey');
  if (key) {
    return cultureTJsxAttr(key);
  }
  const aria = readString(node.props.ariaLabel, labelFallback);
  return aria.length > 0 ? aria : undefined;
};

const FORM_FIELD_CULTURE_EXCLUDE_KEYS = new Set([
  'labelTranslationKey',
  'placeholderTranslationKey',
  'textTranslationKey',
  'titleTranslationKey',
]);

const adaptValueChangeOnChangeAttr = (
  attrs: string,
  nodeId: string,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  if (!bindingContext) {
    return attrs;
  }

  const handlerName = bindingContext.handlerNames.get(`${nodeId}:onChange`);
  if (!handlerName) {
    return attrs;
  }

  const needle = ` onChange={${handlerName}}`;
  if (!attrs.includes(needle)) {
    return attrs;
  }

  return attrs.replace(
    needle,
    ` onChange={(nextValue) => ${handlerName}({ target: { value: String(Array.isArray(nextValue) ? nextValue[0] : nextValue) } } as unknown as React.ChangeEvent<HTMLInputElement>)}`,
  );
};

/**
 * HeroUI ListBox / Tabs call onSelectionChange with Selection|Key, not a DOM Event.
 */
const adaptSelectionChangeAttr = (
  attrs: string,
  nodeId: string,
  bindingContext: TsxBindingRenderContext | undefined,
  /** Tabs pass a single Key; ListBox passes Selection ('all' | Set<Key>). */
  mode: 'keys' | 'key',
): string => {
  if (!bindingContext) {
    return attrs;
  }

  const handlerName = bindingContext.handlerNames.get(`${nodeId}:onSelectionChange`);
  if (!handlerName) {
    return attrs;
  }

  const needle = ` onSelectionChange={${handlerName}}`;
  if (!attrs.includes(needle)) {
    return attrs;
  }

  const valueExpr = mode === 'key'
    ? 'String(nextKey ?? \'\')'
    : 'nextKeys === \'all\' ? \'all\' : Array.from(nextKeys).join(\',\')';

  return attrs.replace(
    needle,
    ` onSelectionChange={(next${mode === 'key' ? 'Key' : 'Keys'}) => ${handlerName}({ target: { value: ${valueExpr} } } as unknown as React.ChangeEvent<HTMLInputElement>)}`,
  );
};

/**
 * HeroUI Dropdown.Menu calls onAction(key), not a DOM Event.
 * Attribute must land on Dropdown.Menu (not Dropdown root / MenuTrigger).
 */
const stripBoundEventAttr = (
  attrs: string,
  nodeId: string,
  targetEvent: string,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  if (!bindingContext) {
    return attrs;
  }
  const handlerName = bindingContext.handlerNames.get(`${nodeId}:${targetEvent}`);
  if (!handlerName) {
    return attrs;
  }
  return attrs.replace(` ${targetEvent}={${handlerName}}`, '');
};

const resolveDropdownMenuOnActionAttr = (
  nodeId: string,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  if (!bindingContext) {
    return '';
  }

  const handlerName = bindingContext.handlerNames.get(`${nodeId}:onAction`);
  if (!handlerName) {
    return '';
  }

  return ` onAction={(key) => ${handlerName}({ target: { value: String(key ?? '') } } as unknown as React.ChangeEvent<HTMLInputElement>)}`;
};

const toJsxString = (value: unknown, fallback = ''): string =>
  jsxAttributeStringValue(typeof value === 'string' ? value : fallback);

const renderChildrenBlock = (children: string, indentSpaces: number, emptyFallback: string): string =>
  children.length > 0 ? indentJsxBlock(children, indentSpaces) : emptyFallback;

const renderHtmlContainerJsx = (
  spec: TsxComponentSpec,
  node: DesignerNode,
  children: string,
  bindingContext?: TsxBindingRenderContext,
  childrenArray?: string[],
): string => {
  if (spec.paletteItemId === 'layout.split-pane') {
    return renderSplitPaneContainerJsx(node, childrenArray ?? [], bindingContext);
  }
  if (spec.paletteItemId === 'layout.dock-pane') {
    return renderDockPaneContainerJsx(node, childrenArray ?? [], bindingContext);
  }

  const tag = spec.htmlTag ?? spec.reactTag;
  const paletteItemId = getNodePaletteItemId(node);
  const tailwindInner = paletteItemId?.startsWith('tailwind.')
    ? renderTailwindUiBlockInnerJsx(paletteItemId, node, bindingContext)
    : '';
  const mergedChildren = tailwindInner
    ? (children ? `${tailwindInner}\n${children}` : tailwindInner)
    : children;
  const attrs = renderAttrs(node, bindingContext, {
    childrenPropKeys: spec.childrenPropKeys,
    structuralPropKeys: spec.structuralPropKeys,
  });
  const emptyFallback = `  <${tag === 'form' ? 'div' : tag} />`;

  return `<${tag}${attrs}>\n${renderChildrenBlock(mergedChildren, 2, emptyFallback)}\n</${tag}>`;
};

const renderHtmlTextJsx = (
  spec: TsxComponentSpec,
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const tag = spec.htmlTag ?? spec.reactTag;

  const needsAutoRel = tag === 'a'
    && readString(node.props.target) === '_blank'
    && !readString(node.props.rel)
    && !(bindingContext && isNodePropBound(node.id, 'rel', bindingContext));

  const attrs = renderAttrs(node, bindingContext, {
    childrenPropKeys: spec.childrenPropKeys,
    structuralPropKeys: spec.structuralPropKeys,
    ...(needsAutoRel
      ? { excludeKeys: new Set(['rel']), reservedAttributes: { rel: 'noopener noreferrer' } }
      : {}),
  });
  const fallback = tag === 'a'
    ? 'Learn more'
    : tag.startsWith('h')
      ? 'Section title'
      : tag === 'li'
        ? 'List item'
        : 'Text';
  const text = renderTranslatableJsxTextContent(node, bindingContext, fallback);

  return `<${tag}${attrs}>${text}</${tag}>`;
};

const renderAutocompleteListBoxItems = (node: DesignerNode): string => {
  const items = parseDesignerAutocompleteItems(node.props.items);
  return items
    .map((item) => `<ListBox.Item id=${jsxAttributeStringValue(item.id)} textValue=${jsxAttributeStringValue(item.textValue)}>${escapeJsxTextContent(item.textValue)}</ListBox.Item>`)
    .join('');
};

const renderStaticDropdownMenuItems = (node: DesignerNode): string => {
  const items = parseDesignerAutocompleteItems(node.props.items);
  if (items.length === 0) {
    return '<Dropdown.Item id="option-1">Option 1</Dropdown.Item>';
  }

  return items
    .map((item) => `<Dropdown.Item id=${jsxAttributeStringValue(item.id)}>${escapeJsxTextContent(item.textValue)}</Dropdown.Item>`)
    .join('');
};

/**
 * Bug found (parity audit item 7): unlike heroui.select/autocomplete/listbox (which all correctly
 * resolve a bound/LOV `items` source via resolveNodeOptionItemsDataExpression), this only ever
 * called the static-only parseDesignerAutocompleteItems on the raw node prop — so a dynamically
 * bound `items` source (dynamic data-source list or LOV) worked live in the canvas/interactive
 * Preview (DesignerRuntimeDropdown.tsx's useDesignerOptionItems) but always exported only the
 * static placeholder options. Mirrors heroui.listbox's fix exactly (react-aria's Menu, like
 * ListBox, supports the `items` + render-prop collection pattern).
 */
const renderDropdownMenuItemsAttrAndBody = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
): { menuItemsAttr: string; menuBody: string } => {
  const itemsBinding = bindingContext
    ? resolveNodeOptionItemsDataExpression(node.id, bindingContext)
    : null;
  const mappedItemsExpression = itemsBinding && bindingContext
    ? `${renderDesignerItemsMapperExpression(itemsBinding, node.id, bindingContext)} ?? []`
    : null;

  if (mappedItemsExpression) {
    return {
      menuItemsAttr: ` items={${mappedItemsExpression}}`,
      menuBody: '{(item) => <Dropdown.Item id={item.id}>{item.textValue}</Dropdown.Item>}',
    };
  }

  return { menuItemsAttr: '', menuBody: renderStaticDropdownMenuItems(node) };
};

const renderHtmlImageJsx = (
  spec: TsxComponentSpec,
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const tag = spec.htmlTag ?? spec.reactTag;
  const objectFitStyle = resolveImageObjectFitStyle(node);
  const fallbackSrc = readString(node.props.fallbackSrc);
  const existingStyle = typeof node.props.style === 'object' && node.props.style !== null && !Array.isArray(node.props.style)
    ? node.props.style as Record<string, unknown>
    : {};
  const mergedStyle = objectFitStyle ? { ...existingStyle, ...objectFitStyle } : existingStyle;
  const hasMergedStyle = Object.keys(mergedStyle).length > 0;

  // When `src`/`alt` carry a Store or data-path binding, the bound expression is appended
  // separately below (via buildNodeJsxAttributesWithBindings' storeReadBindings/propertyBindings
  // loops) — omit the static reservedAttributes fallback so codegen doesn't emit the attribute
  // twice (TS17001: JSX elements cannot have multiple attributes with the same name).
  const isSrcBound = Boolean(bindingContext && isNodePropBound(node.id, 'src', bindingContext));
  const isAltBound = Boolean(bindingContext && isNodePropBound(node.id, 'alt', bindingContext));

  const attrs = renderAttrs(node, bindingContext, {
    childrenPropKeys: spec.childrenPropKeys,
    structuralPropKeys: spec.structuralPropKeys,
    excludeKeys: new Set(['alt', 'src', 'objectFit', 'fallbackSrc', 'onError', ...(hasMergedStyle ? ['style'] : [])]),
    reservedAttributes: {
      ...(isSrcBound ? {} : { src: readString(node.props.src, '/assets/designer-default-image.svg') }),
      ...(isAltBound ? {} : { alt: typeof node.props.alt === 'string' ? node.props.alt : '' }),
      ...(hasMergedStyle ? { style: mergedStyle } : {}),
      ...(fallbackSrc
        ? {
          onError: tsxBindingRawExpr(
            `(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ${JSON.stringify(fallbackSrc)}; }`,
          ),
        }
        : {}),
    },
  });

  return `<${tag}${attrs} />`;
};

const renderHtmlIframeJsx = (
  spec: TsxComponentSpec,
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const tag = spec.htmlTag ?? 'iframe';

  // Any of these 5 fields can carry a Store/data-path binding, in which case the bound
  // expression is appended separately below — omit the static reservedAttributes fallback for
  // a bound field so codegen doesn't emit it twice (TS17001: JSX elements cannot have multiple
  // attributes with the same name).
  const isBound = (prop: string): boolean => Boolean(bindingContext && isNodePropBound(node.id, prop, bindingContext));
  const isSrcBound = isBound('src');
  const isTitleBound = isBound('title');
  const isWidthBound = isBound('width');
  const isHeightBound = isBound('height');
  const isAllowFullScreenBound = isBound('allowFullScreen');
  const isSandboxBound = isBound('sandbox');
  const isLoadingBound = isBound('loading');

  const sandboxValue = readString(node.props.sandbox, 'allow-scripts allow-same-origin');
  const loadingValue = readString(node.props.loading, 'lazy');

  const attrs = renderAttrs(node, bindingContext, {
    childrenPropKeys: spec.childrenPropKeys,
    structuralPropKeys: spec.structuralPropKeys,
    excludeKeys: new Set(['src', 'width', 'height', 'title', 'allowFullScreen', 'sandbox', 'loading']),
    reservedAttributes: {
      ...(isSrcBound ? {} : { src: readString(node.props.src, 'about:blank') }),
      ...(isTitleBound ? {} : { title: readString(node.props.title, 'Embedded content') }),
      ...(!isWidthBound && readString(node.props.width) ? { width: readString(node.props.width) } : {}),
      ...(!isHeightBound && readString(node.props.height) ? { height: readString(node.props.height) } : {}),
      ...(!isAllowFullScreenBound && readBoolean(node.props.allowFullScreen) ? { allowFullScreen: true } : {}),
      ...(!isSandboxBound && sandboxValue ? { sandbox: sandboxValue } : {}),
      ...(!isLoadingBound && (loadingValue === 'lazy' || loadingValue === 'eager') ? { loading: loadingValue } : {}),
    },
  });

  return `<${tag}${attrs} />`;
};

const renderHtmlFileUploadJsx = (
  spec: TsxComponentSpec,
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const attrs = renderAttrs(node, bindingContext, {
    childrenPropKeys: spec.childrenPropKeys,
    structuralPropKeys: spec.structuralPropKeys,
  });
  return `<DesignerRuntimeFileUpload${attrs} />`;
};

const renderGenericLibraryJsx = (
  spec: TsxComponentSpec,
  node: DesignerNode,
  children: string,
  bindingContext?: TsxBindingRenderContext,
): string => {
  let attrs = renderAttrs(node, bindingContext, {
    childrenPropKeys: spec.childrenPropKeys,
    structuralPropKeys: spec.structuralPropKeys,
  });

  // Bug found (cluster D — heroui-data-display, via heroui.typography-lead, the only
  // palette item that actually reaches this function today): spec.textProp ('text') is a
  // bindable Inspector field, but this always emitted the static node.props value as a
  // literal, ignoring any Property Binding — AND buildNodeJsxAttributesWithBindings'
  // bound-properties loop (inside renderAttrs above) unconditionally appended a stray
  // `text={...}` ATTRIBUTE onto the element regardless, which real DOM tags like <p> don't
  // accept. Fixed: resolve the binding expression, strip the leaked attribute, and use the
  // expression as the element's JSX text content instead.
  const textBindingExpr = spec.textProp && bindingContext
    ? resolveNodePropertyBindingExpression(node.id, spec.textProp, bindingContext)
    : null;
  if (textBindingExpr && spec.textProp && bindingContext) {
    const leakedAttr = resolveBoundAttributeForNodeProp(node.id, spec.textProp, bindingContext);
    if (leakedAttr) {
      attrs = attrs.replace(leakedAttr, '');
    }
  }

  const textProp = spec.textProp ? node.props[spec.textProp] : undefined;
  const textContent = typeof textProp === 'string' && textProp.length > 0
    ? renderJsxTextContent(textProp)
    : '';

  if (children.length > 0) {
    return `<${spec.reactTag}${attrs}>\n${indentJsxBlock(children, 2)}\n</${spec.reactTag}>`;
  }

  if (textBindingExpr) {
    return `<${spec.reactTag}${attrs}>${renderBoundJsxTextExpression(textBindingExpr, typeof textProp === 'string' ? textProp : '')}</${spec.reactTag}>`;
  }

  if (textContent.length > 0) {
    return `<${spec.reactTag}${attrs}>${textContent}</${spec.reactTag}>`;
  }

  return `<${spec.reactTag}${attrs} />`;
};

const renderCustomLibraryJsx = (
  spec: TsxComponentSpec,
  node: DesignerNode,
  nodes: Record<string, DesignerNode>,
  depth: number,
  renderChild: (nodeId: string, nodes: Record<string, DesignerNode>, depth: number, bindingContext?: TsxBindingRenderContext) => string,
  bindingContext?: TsxBindingRenderContext,
): string | null => {
  const paletteItemId = spec.paletteItemId;
  if (!paletteItemId) {
    return null;
  }

  const baseAttrOptions = {
    childrenPropKeys: spec.childrenPropKeys,
    structuralPropKeys: spec.structuralPropKeys,
  };
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const childrenArray = node.children
    .map((childId) => renderChild(childId, nodes, depth + 1, bindingContext))
    .filter((item) => item.length > 0);
  const renderedChildren = childrenArray.join('\n');

  switch (paletteItemId) {
    case 'heroui.button-solid':
    case 'heroui.button-outline': {
      const label = readString(node.props.text, paletteItemId === 'heroui.button-outline' ? 'Secondary' : 'Action');
      const submitDisabled = bindingContext ? resolveSubmitButtonIsDisabledValue(node, bindingContext) : undefined;
      const href = readString(node.props.href);
      const target = readString(node.props.target);
      const rel = readString(node.props.rel);
      if (readBoolean(node.props.workspaceBack)) {
        const ariaLabel = readString(node.props['aria-label'], label || 'Back');
        const title = readString(node.props.title, ariaLabel);
        const backAttrs = renderAttrs(node, bindingContext, {
          ...baseAttrOptions,
          excludeKeys: new Set([
            'text', 'variant', 'size', 'isDisabled', 'disabled', 'isLoading', 'color',
            'href', 'target', 'rel', 'startIcon', 'endIcon', 'icon', 'isIconOnly',
            'workspaceBack', 'aria-label', 'title', 'className',
          ]),
          childrenPropKeys: new Set(['text']),
          reservedAttributes: {
            ariaLabel,
            title,
          },
        });
        return `<WorkspaceBackIcon${backAttrs} />`;
      }
      const attrs = renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        // Bug found (parity audit item 19): `color` removed — @heroui/react's real Button has no
        // such prop or style variant (see inspectorPaletteFields.ts's HEROUI_BUTTON_FIELDS, where
        // the Inspector field was removed for the same reason), so this always emitted a fully
        // inert `color="..."` attribute the real component doesn't read.
        // `icon` is a designer shorthand (CMS / records overlays) mapped to startContent — never leak
        // it as a raw DOM/HeroUI prop.
        excludeKeys: new Set([
          'text', 'variant', 'size', 'isDisabled', 'disabled', 'isLoading', 'color',
          'href', 'target', 'rel', 'startIcon', 'endIcon', 'icon', 'isIconOnly',
          'workspaceBack', 'pickFileCreate', 'pickFileCreateConfig', 'pickFileCreateDataSourceRef',
        ]),
        childrenPropKeys: new Set(['text']),
        reservedAttributes: {
          variant: resolveButtonVariant(node, paletteItemId),
          size: resolveSize(node.props.size),
          ...(href ? { href } : {}),
          ...(href && target ? { target } : {}),
          ...(href && rel ? { rel } : {}),
          ...(submitDisabled
            ? { isDisabled: submitDisabled }
            : isDisabled
              ? { isDisabled: true }
              : {}),
          ...(readBoolean(node.props.isLoading) ? { isPending: true } : {}),
          ...(readBoolean(node.props.isIconOnly) ? { isIconOnly: true } : {}),
        },
      });
      const startIconName = readString(node.props.startIcon) || readString(node.props.icon);
      const endIconName = readString(node.props.endIcon);
      // HeroUI v3 Button has no startContent/endContent — icons must be children (Base Components
      // labeled-button rule: leading Lucide h-3.5 w-3.5). Builders already set gap-1.5 on className.
      const btnIsIconOnly = readBoolean(node.props.isIconOnly);
      const contentWithIcons = btnIsIconOnly
        ? (startIconName ? `<${startIconName} className="h-3.5 w-3.5" />` : label)
        : `${startIconName ? `<${startIconName} className="h-3.5 w-3.5" />` : ''}${startIconName ? ' ' : ''}${label}${endIconName ? ` <${endIconName} className="h-3.5 w-3.5" />` : ''}`;
      return `<Button${attrs}>${contentWithIcons}</Button>`;
    }
    case 'heroui.link': {
      const attrs = renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        // Bug found (parity audit item 20): `size`/`color` were never excluded here — the real
        // Link component has no such variants at all (see inspectorPaletteFields.ts's removal of
        // both Inspector fields for the same reason), so any pre-existing value on older saved
        // documents would leak as a fully inert attribute onto the real `<Link>`.
        excludeKeys: new Set(['href', 'text', 'size', 'color']),
        reservedAttributes: {
          href: readString(node.props.href, '#'),
        },
      });
      return `<Link${attrs}>${readString(node.props.text, 'Read more')}</Link>`;
    }
    case 'heroui.chip': {
      const color = resolveChipColor(node.props.color);
      const variant = resolveChipVariant(node.props.variant);
      const chipStartIcon = readString(node.props.startIcon);
      const chipEndIcon = readString(node.props.endIcon);
      const attrs = renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set(['text', 'color', 'variant', 'size', 'startIcon', 'endIcon']),
        reservedAttributes: {
          ...(color ? { color } : {}),
          ...(variant ? { variant } : {}),
          size: resolveSize(node.props.size),
        },
      });
      const chipStartAttr = chipStartIcon ? ` startContent={<${chipStartIcon} className="h-3.5 w-3.5" />}` : '';
      const chipEndAttr = chipEndIcon ? ` endContent={<${chipEndIcon} className="h-3.5 w-3.5" />}` : '';
      return `<Chip${attrs}${chipStartAttr}${chipEndAttr}>${readString(node.props.text, 'Chip')}</Chip>`;
    }
    case 'heroui.spinner':
      return `<Spinner${renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set(['size']),
        reservedAttributes: {
          size: resolveSize(node.props.size),
        },
      })} />`;
    case 'heroui.skeleton':
      // Bug found (parity audit item 22): `isLoaded` removed — @heroui/react's real Skeleton has
      // no such prop at all (SkeletonRootProps only has `animationType`), so it was always fully
      // inert. Wired the real `animationType` variant instead (previously not exposed anywhere).
      return `<Skeleton${renderAttrs(node, bindingContext, {
        excludeKeys: new Set(['className', 'isLoaded', 'animationType']),
        reservedAttributes: {
          className: readString(node.props.className, 'h-4 w-full'),
          animationType: readString(node.props.animationType, 'shimmer'),
        },
      })} />`;
    case 'heroui.avatar': {
      // Bug found: bound `src`/`alt`/`text` were excluded from the static attrs pass (correctly,
      // to avoid a duplicate JSX attribute) but the manual Avatar.Image/Avatar.Fallback
      // construction below only ever read the STATIC prop value — so a bound photo/fallback-text
      // leaked as a meaningless attribute on the `<Avatar>` wrapper instead of reaching
      // `Avatar.Image`/`Avatar.Fallback`, and never rendered in the published app.
      //
      // Bug found (parity audit item 21): `fallbackSrc` ("Fallback Source") removed entirely —
      // @heroui/react's real `Avatar.Image` (AvatarImageProps) doesn't declare any such prop at
      // all, so it was always a fully inert attribute in both the live preview and export; the
      // real fallback UI is `Avatar.Fallback` (driven by the separate, working `text` field).
      const isSrcBound = Boolean(bindingContext && isNodePropBound(node.id, 'src', bindingContext));
      const isAltBound = Boolean(bindingContext && isNodePropBound(node.id, 'alt', bindingContext));
      const isTextBound = Boolean(bindingContext && isNodePropBound(node.id, 'text', bindingContext));

      const srcExpr = isSrcBound ? resolveNodePropertyBindingExpression(node.id, 'src', bindingContext!) : null;
      const altExpr = isAltBound ? resolveNodePropertyBindingExpression(node.id, 'alt', bindingContext!) : null;
      const textExpr = isTextBound ? resolveNodePropertyBindingExpression(node.id, 'text', bindingContext!) : null;

      const imageSrc = readString(node.props.src);
      const fallback = readString(node.props.text, 'AB');
      let attrs = renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set(['text', 'src', 'alt', 'size', 'fallbackSrc']),
        reservedAttributes: {
          size: resolveSize(node.props.size),
        },
      });

      // `excludeKeys` above only suppresses the STATIC attrs pass — buildNodeJsxAttributesWithBindings
      // unconditionally appends every bound property for this node regardless of excludeKeys, so a
      // bound src/alt/text still lands on the wrapper here and must be stripped before being
      // relocated onto Avatar.Image/Avatar.Fallback below.
      // Bug found (parity audit item 65): `fallbackSrc` was missing from this strip list — a bound
      // leftover from documents authored before the field was removed leaked as a dead
      // `fallbackSrc={…}` on `<Avatar>` (real Avatar.Image has no such prop; fallback is
      // Avatar.Fallback via `text`). Strip it the same way as the relocated props.
      for (const boundProp of ['src', 'alt', 'text', 'fallbackSrc']) {
        attrs = attrs.replace(new RegExp(` ${boundProp}=\\{[^}]*\\}`), '');
      }

      const srcAttr = srcExpr ? ` src={${srcExpr}}` : (imageSrc ? ` src=${toJsxString(imageSrc)}` : '');
      const altAttr = altExpr ? ` alt={${altExpr}}` : ` alt=${toJsxString(node.props.alt, 'Avatar')}`;
      const fallbackChildren = textExpr ? `{${textExpr}}` : fallback;

      if (srcExpr || imageSrc) {
        return `<Avatar${attrs}><Avatar.Image${srcAttr}${altAttr} /><Avatar.Fallback>${fallbackChildren}</Avatar.Fallback></Avatar>`;
      }
      return `<Avatar${attrs}><Avatar.Fallback>${fallbackChildren}</Avatar.Fallback></Avatar>`;
    }
    case 'heroui.switch': {
      // Bug found: a static "Selected" default with no onChange wired was always emitted as a
      // real, controlled `isSelected` attribute — with nothing to change it, the exported switch
      // can never be toggled in the published app (mirrors the identical value/defaultValue
      // freeze fixed above for input-text/number-input/textarea). react-aria's toggle components
      // support `defaultSelected` for exactly this uncontrolled case.
      // Label sits beside Control via Switch.Content (same compound pattern as UiSwitch) —
      // HeroUI Switch has no `label` prop; emitting it as an attribute hid the title in Studio.
      const isSelectedBound = Boolean(bindingContext && isNodePropBound(node.id, 'isSelected', bindingContext));
      const staticSelected = readBoolean(node.props.isSelected);
      const selectedAttrKey = hasOnChangeHandler(node.id, bindingContext) ? 'isSelected' : 'defaultSelected';
      const switchLabel = readString(node.props.label);
      const switchAria = readString(node.props.ariaLabel, switchLabel || 'switch');
      const labelJsx = switchLabel
        ? `<span className="text-xs font-semibold text-slate-700">${escapeJsxTextContent(switchLabel)}</span>`
        : '';
      return `<Switch${adaptValueChangeOnChangeAttr(renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set(['ariaLabel', 'isSelected', 'size', 'label']),
        reservedAttributes: {
          ariaLabel: switchAria,
          size: resolveSize(node.props.size),
          ...(!isSelectedBound && staticSelected ? { [selectedAttrKey]: true } : {}),
        },
      }), node.id, bindingContext)}><Switch.Content className="flex items-center gap-2"><Switch.Control><Switch.Thumb /></Switch.Control>${labelJsx}</Switch.Content></Switch>`;
    }
    case 'heroui.progress': {
      // Bug found: when the "Value" field is bound to a data source, the static
      // reservedAttributes `value` below and the bound expression appended by
      // buildNodeJsxAttributesWithBindings both target the `value` attribute — omit the
      // static fallback when bound so codegen never emits `value` twice (see the
      // resolveBoundAttributeForNodeProp fix in bindingCodegen.ts for the matching
      // defaultValue→value attribute-name bug this pairs with).
      const isValueBound = Boolean(bindingContext && isNodePropBound(node.id, 'value', bindingContext));
      return `<ProgressBar${renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set(['value', 'progressValue', 'ariaLabel', 'size']),
        reservedAttributes: {
          ariaLabel: readString(node.props.ariaLabel, 'progress'),
          ...(isValueBound ? {} : { value: resolveProgressValue(node) }),
          size: resolveSize(node.props.size),
        },
      })}><ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track></ProgressBar>`;
    }
    case 'heroui.slider': {
      const rangeMode = isSliderRangeMode(node);
      const defaultVal = rangeMode ? resolveSliderRangeValue(node) : resolveSliderValue(node);
      const showTooltip = readBoolean(node.props.showTooltip);
      const sliderAttrs = adaptValueChangeOnChangeAttr(renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set(['value', 'defaultValue', 'ariaLabel', 'size', 'sliderMode', 'minValue', 'maxValue', 'showTooltip']),
        reservedAttributes: {
          ariaLabel: readString(node.props.ariaLabel, 'slider'),
          defaultValue: defaultVal,
          ...(showTooltip ? { showTooltip: true } : {}),
        },
      }), node.id, bindingContext);
      const thumbs = rangeMode
        ? '<Slider.Thumb /><Slider.Thumb />'
        : '<Slider.Thumb />';
      return `<Slider${sliderAttrs}><Slider.Track><Slider.Fill />${thumbs}</Slider.Track></Slider>`;
    }
    case 'heroui.input-text': {
      const staticValue = typeof node.props.value === 'string' ? node.props.value.trim() : '';
      const staticValueAttrKey = resolveStaticValueAttrKey(node.id, bindingContext);
      const fieldLabel = resolveFieldLabelReserved(node);
      const ariaLabel = resolveFieldAriaLabelReserved(node, typeof fieldLabel === 'string' ? fieldLabel : '');
      return `<UiInput${renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        // Designer-only / remapped keys must not leak onto UiInput (parity with Preview wrappers).
        excludeKeys: new Set([
          'inputType',
          'type',
          'placeholder',
          'value',
          'size',
          'label',
          'title',
          'ariaLabel',
          'aiAssist',
          'validationRule',
          'validationErrorMessage',
          ...FORM_FIELD_CULTURE_EXCLUDE_KEYS,
        ]),
        reservedAttributes: {
          type: resolveInputType(node),
          placeholder: resolveFieldPlaceholderReserved(node, 'Text input'),
          ...(fieldLabel ? { label: fieldLabel } : {}),
          ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
          ...(staticValue.length > 0 ? { [staticValueAttrKey]: staticValue } : {}),
          size: resolveFieldSize(node.props.size),
          ...(isDisabled ? { isDisabled: true } : {}),
        },
      })} />`;
    }
    case 'heroui.number-input': {
      const staticValue = typeof node.props.value === 'string' ? node.props.value.trim() : '';
      const staticValueAttrKey = resolveStaticValueAttrKey(node.id, bindingContext);
      const fieldLabel = resolveFieldLabelReserved(node);
      const ariaLabel = resolveFieldAriaLabelReserved(node, typeof fieldLabel === 'string' ? fieldLabel : '');
      return `<UiInput${renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set([
          'placeholder',
          'value',
          'size',
          'inputType',
          'type',
          'label',
          'title',
          'ariaLabel',
          'aiAssist',
          'validationRule',
          'validationErrorMessage',
          'min',
          'max',
          'step',
          ...FORM_FIELD_CULTURE_EXCLUDE_KEYS,
        ]),
        reservedAttributes: {
          type: 'number',
          placeholder: resolveFieldPlaceholderReserved(node, '0'),
          ...(fieldLabel ? { label: fieldLabel } : {}),
          ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
          ...(staticValue.length > 0 ? { [staticValueAttrKey]: staticValue } : {}),
          ...(readString(node.props.min) ? { min: readString(node.props.min) } : {}),
          ...(readString(node.props.max) ? { max: readString(node.props.max) } : {}),
          ...(readString(node.props.step) ? { step: readString(node.props.step) } : {}),
          size: resolveFieldSize(node.props.size),
          ...(isDisabled ? { isDisabled: true } : {}),
        },
      })} />`;
    }
    case 'heroui.textarea': {
      const staticValue = typeof node.props.value === 'string' ? node.props.value.trim() : '';
      const staticValueAttrKey = resolveStaticValueAttrKey(node.id, bindingContext);
      const fieldLabel = resolveFieldLabelReserved(node);
      const ariaLabel = resolveFieldAriaLabelReserved(node, typeof fieldLabel === 'string' ? fieldLabel : '');
      const semanticPolicy = resolveDesignerSemanticValidationPolicy(node);
      const textareaTag = semanticPolicy ? 'SemanticAssistTextarea' : 'UiTextarea';
      const semanticAttrs = renderDesignerSemanticValidationJsxAttrs(node);
      return `<${textareaTag}${renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set([
          'placeholder',
          'value',
          'minRows',
          'maxRows',
          'size',
          'label',
          'title',
          'ariaLabel',
          'aiAssist',
          'validationRule',
          'validationErrorMessage',
          ...DESIGNER_SEMANTIC_VALIDATION_EXCLUDE_KEYS,
          ...FORM_FIELD_CULTURE_EXCLUDE_KEYS,
        ]),
        reservedAttributes: {
          placeholder: resolveFieldPlaceholderReserved(node, 'Text area'),
          ...(fieldLabel ? { label: fieldLabel } : {}),
          ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
          ...(staticValue.length > 0 ? { [staticValueAttrKey]: staticValue } : {}),
          rows: readNumber(node.props.minRows, 3),
          ...(readNumber(node.props.maxRows, 0) > 0 ? { maxRows: readNumber(node.props.maxRows, 0) } : {}),
          size: resolveFieldSize(node.props.size),
          ...(isDisabled ? { isDisabled: true } : {}),
        },
      })}${semanticAttrs} />`;
    }
    case 'heroui.select': {
      const itemsBinding = bindingContext
        ? resolveNodeOptionItemsDataExpression(node.id, bindingContext)
        : null;
      const selectedKeys = readString(node.props.selectedKeys);
      const defaultSelectedKey = selectedKeys.split(',')[0]?.trim();
      const selectedKeyByLanguage = readString(node.props.selectedKeyByLanguage);
      const languageSelectedKeyExpression = !defaultSelectedKey && selectedKeyByLanguage
        ? `(() => { try { const map = JSON.parse(${JSON.stringify(selectedKeyByLanguage)}); const language = typeof document === 'undefined' ? '' : document.documentElement.lang.toLowerCase(); return map[language] ?? map[language.split('-')[0]] ?? undefined; } catch { return undefined; } })()`
        : null;
      const label = readString(node.props.label);
      const labelExpr = bindingContext
        ? resolveNodePropertyBindingExpression(node.id, 'label', bindingContext)
        : null;
      const selectAttrs = renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set([
          'placeholder',
          'selectedKeys',
          'size',
          'items',
          'label',
          'selectedKeyByLanguage',
          'allowCustomValue',
          // Bug found (parity audit item 47, re-verified): `closeOnSelect`/`shouldCloseOnSelect`
          // used to fall through to the generic attrs pass (renamed via
          // JSX_ATTRIBUTE_NAME_OVERRIDES) — moot, since the real `@heroui/react` Select never
          // reads this prop (verified against the installed react-aria-components type defs:
          // only Menu/DatePicker support it). Excluded so a legacy document value never leaks as
          // a dead attribute; the Inspector field itself was removed.
          'closeOnSelect',
          'shouldCloseOnSelect',
        ]),
        reservedAttributes: {
          placeholder: readString(node.props.placeholder, 'Select…'),
          ...(labelExpr
            ? { label: tsxBindingRawExpr(`${labelExpr} ?? ${JSON.stringify(label)}`) }
            : label
              ? { label }
              : {}),
          ...(defaultSelectedKey
            ? { defaultSelectedKey }
            : languageSelectedKeyExpression
              ? { defaultSelectedKey: tsxBindingRawExpr(languageSelectedKeyExpression) }
              : {}),
          size: resolveFieldSize(node.props.size),
          ...(isDisabled ? { isDisabled: true } : {}),
        },
      });
      const listBoxItems = itemsBinding && bindingContext
        ? `{${renderDesignerItemsMapperExpression(itemsBinding, node.id, bindingContext)}.map((item) => (<option key={item.id} value={item.id}>{item.textValue}</option>))}`
        : parseDesignerAutocompleteItems(node.props.items)
          .map((item) => (
            `<option value=${jsxAttributeStringValue(item.id)}>${escapeJsxTextContent(item.textValue)}</option>`
          ))
          .join('');
      return `<UiSelect${selectAttrs}>${listBoxItems}</UiSelect>`;
    }
    case 'heroui.autocomplete': {
      // Bug found (parity audit items 31/49): Export used raw HeroUI `<Autocomplete>` (no visible
      // label span). Preview uses `UiAutocomplete` which renders the label. Switch Export to the
      // same wrapper. Placeholder default is honest "Select…" (Autocomplete is Select-based).
      const itemsBinding = bindingContext
        ? resolveNodeOptionItemsDataExpression(node.id, bindingContext)
        : null;
      const mappedItemsExpression = itemsBinding && bindingContext
        ? `${renderDesignerItemsMapperExpression(itemsBinding, node.id, bindingContext)} ?? []`
        : null;
      const label = readString(node.props.label, 'Autocomplete');
      const labelExpr = bindingContext
        ? resolveNodePropertyBindingExpression(node.id, 'label', bindingContext)
        : null;
      const autocompleteAttrs = renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set([
          'placeholder',
          'label',
          'items',
          'size',
          'allowCustomValue',
          // Bug found (parity audit item 47, re-verified): same as heroui.select above —
          // `shouldCloseOnSelect` isn't a real Autocomplete/Select prop.
          'closeOnSelect',
          'shouldCloseOnSelect',
        ]),
        reservedAttributes: {
          placeholder: readString(node.props.placeholder, 'Select…'),
          ...(labelExpr
            ? { label: tsxBindingRawExpr(`${labelExpr} ?? ${JSON.stringify(label)}`) }
            : { label }),
          size: resolveFieldSize(node.props.size),
          ...(isDisabled ? { isDisabled: true } : {}),
          items: tsxBindingRawExpr(
            mappedItemsExpression
              ?? JSON.stringify(parseDesignerAutocompleteItems(node.props.items)),
          ),
        },
      });
      return `<UiAutocomplete${autocompleteAttrs} />`;
    }
    case 'heroui.listbox': {
      // Bug found: @heroui/react's ListBox (react-aria ListBox) defaults selectionMode to
      // 'none' — with no selectionMode set, clicking an option never fires onSelectionChange
      // at all, and `selectedKeys` has no effect. The Designer's canvas preview
      // (DesignerRuntimeListbox) simulates single-selection with its own local state, so this
      // was invisible there; the export path never carried the same contract. Additionally,
      // node.props.selectedKeys is a comma-separated string (Inspector: "Selected Keys",
      // placeholder "key1,key2"), but react-aria's selectedKeys/defaultSelectedKeys prop type
      // is `'all' | Iterable<Key>` — a raw JS string IS iterable (over characters), so passing
      // it directly silently selects nothing (or garbage single-char "keys"), never the
      // intended option. Fixed: always set selectionMode="single" (matches the single-select
      // model DesignerRuntimeListbox/Inspector actually expose) and convert the CSV into a
      // real array literal via defaultSelectedKeys so react-aria receives a valid Iterable<Key>.
      //
      // Bug found (parity audit item 69): when Selected Keys is Property-bound, Export only
      // ever read the static CSV via readString — the bound expression was either ignored or
      // leaked as a raw `selectedKeys={expr}` string (still not an Iterable). Resolve the
      // binding into defaultSelectedKeys as a split/trim array expression, and suppress the
      // generic selectedKeys attribute emission (see resolveBoundAttributeForNodeProp).
      const selectedKeysExpr = bindingContext
        ? resolveNodePropertyBindingExpression(node.id, 'selectedKeys', bindingContext)
        : null;
      const selectedKeysList = readString(node.props.selectedKeys)
        .split(',')
        .map((key) => key.trim())
        .filter((key) => key.length > 0);
      // Bug found: unlike heroui.select/autocomplete (which both correctly resolve a bound/LOV
      // `items` source via resolveNodeOptionItemsDataExpression), this case only ever called
      // renderAutocompleteListBoxItems(node) — a STATIC-only parser with no bindingContext
      // parameter — so a dynamically bound `items` source worked live in the canvas but always
      // exported only the static placeholder options.
      const itemsBinding = bindingContext
        ? resolveNodeOptionItemsDataExpression(node.id, bindingContext)
        : null;
      const mappedItemsExpression = itemsBinding && bindingContext
        ? `${renderDesignerItemsMapperExpression(itemsBinding, node.id, bindingContext)} ?? []`
        : null;
      const listBoxAttrs = adaptSelectionChangeAttr(
        renderAttrs(node, bindingContext, {
          ...baseAttrOptions,
          // Bug found (parity audit item 25): 'size' excluded — @heroui/react's real ListBox has
          // no size variant at all (see inspectorPaletteFields.ts's HEROUI_LISTBOX_FIELDS, where
          // the Inspector field was removed for the same reason); this only guards a leftover
          // value from an older saved document from leaking onto the real `<ListBox>`.
          excludeKeys: new Set(['items', 'selectedKeys', 'size']),
          reservedAttributes: {
            ariaLabel: readString(node.props.ariaLabel, 'Options'),
            selectionMode: 'single',
            ...(isDisabled ? { isDisabled: true } : {}),
            ...(selectedKeysExpr
              ? {
                defaultSelectedKeys: tsxBindingRawExpr(
                  `String(${selectedKeysExpr} ?? '').split(',').map((key) => key.trim()).filter((key) => key.length > 0)`,
                ),
              }
              : selectedKeysList.length > 0
                ? { defaultSelectedKeys: tsxBindingRawExpr(JSON.stringify(selectedKeysList)) }
                : {}),
          },
        }),
        node.id,
        bindingContext,
        'keys',
      );

      if (mappedItemsExpression) {
        return `<ListBox${listBoxAttrs} items={${mappedItemsExpression}}>{(item) => <ListBox.Item id={item.id} textValue={item.textValue}>{item.textValue}</ListBox.Item>}</ListBox>`;
      }

      const items = renderAutocompleteListBoxItems(node);
      const body = items.length > 0
        ? items
        : '<ListBox.Item id="option-1" textValue="Option 1">Option 1</ListBox.Item>';
      return `<ListBox${listBoxAttrs}>${body}</ListBox>`;
    }
    case 'heroui.typography-lead': {
      // NOTE: this case is unreachable — 'heroui.typography-lead' is not in
      // LIBRARY_CUSTOM_PALETTE_IDS (tsxComponentRegistry.ts), so resolveTsxComponentSpec
      // always returns kind: 'library-generic' for it, and renderDesignerNodeJsx dispatches
      // to renderGenericLibraryJsx instead of renderCustomLibraryJsx (this function) — this
      // switch case never executes. The real bound-text fix for heroui.typography-lead lives
      // in renderGenericLibraryJsx below. Left in place unmodified (pre-existing dead code,
      // out of scope to remove) rather than risk misreading which path is live.
      const attrs = renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set(['text']),
        childrenPropKeys: new Set(['text']),
      });
      return `<p${attrs}>${renderJsxTextContent(readString(node.props.text, 'Lead text for sections and summaries.'))}</p>`;
    }
    case 'heroui.dropdown': {
      const label = readString(node.props.label, 'Actions');
      // Bug found (parity audit item 24): `label` is rendered as JSX CHILDREN of
      // `Dropdown.Trigger` (a static read, no binding awareness), not a real JSX attribute — but
      // the generic bound-attribute loop still appended a duplicate, dead `label={expr}` onto
      // the `<Dropdown>` root whenever `label` was bound, and the trigger's visible text never
      // reflected the bound value at all. Mirrors the same `title`/`description` binding pattern
      // already correct for card/modal/accordion (renderBoundJsxTextExpression).
      const labelBindingExpr = bindingContext
        ? resolveNodePropertyBindingExpression(node.id, 'label', bindingContext)
        : null;
      const labelContent = labelBindingExpr ? renderBoundJsxTextExpression(labelBindingExpr, label) : escapeJsxTextContent(label);
      // Bug found: `isDisabled` was placed on the root <Dropdown> (react-aria-components'
      // MenuTrigger, which has no isDisabled prop and never forwards it) — a published Dropdown
      // configured "Disabled" in the Inspector stayed fully clickable/openable. The real button
      // lives on Dropdown.Trigger (a react-aria Button, which DOES accept isDisabled) — matches
      // the canvas/preview renderer (DesignerRuntimeDropdown.tsx), which already sets `disabled`
      // on the real trigger button.
      // Bug found (parity audit item P3.15): 'size' was never excluded here, so it leaked onto
      // the real <Dropdown> root as `size="lg"` — @heroui/react's Dropdown family has no size
      // variant at all (see inspectorPaletteFields.ts's HEROUI_DROPDOWN_FIELDS, where the
      // Inspector's "Size" field was removed for the same reason), so this was always a fully
      // inert attribute the real component never read.
      const dropdownAttrs = stripBoundEventAttr(
        renderAttrs(node, bindingContext, {
          ...baseAttrOptions,
          excludeKeys: new Set(['items', 'label', 'text', 'isDisabled', 'size', 'startIcon', 'endIcon']),
        }),
        node.id,
        'onAction',
        bindingContext,
      );
      const triggerDisabledAttr = isDisabled ? ' isDisabled' : '';
      const ddStartIcon = readString(node.props.startIcon);
      const ddEndIcon = readString(node.props.endIcon);
      const triggerContent = [
        ddStartIcon ? `<${ddStartIcon} className="h-3.5 w-3.5" />` : '',
        labelContent,
        ddEndIcon ? `<${ddEndIcon} className="h-3.5 w-3.5" />` : '',
      ].filter(Boolean).join('');
      const menuActionAttr = resolveDropdownMenuOnActionAttr(node.id, bindingContext);
      const { menuItemsAttr, menuBody } = renderDropdownMenuItemsAttrAndBody(node, bindingContext);
      return `<Dropdown${dropdownAttrs}><Dropdown.Trigger${triggerDisabledAttr}>${triggerContent}</Dropdown.Trigger><Dropdown.Popover><Dropdown.Menu aria-label=${jsxAttributeStringValue(readString(node.props.ariaLabel, label))}${menuActionAttr}${menuItemsAttr}>${menuBody}</Dropdown.Menu></Dropdown.Popover></Dropdown>`;
    }
    case 'heroui.field-container': {
      let attrs = renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set(['title', 'label']),
      });
      // Bug found (parity audit item 45): label binding was never emitted — legend was always
      // the static prop. Mirror avatar `text` / dropdown `label` children-binding pattern.
      const isLabelBound = Boolean(bindingContext && isNodePropBound(node.id, 'label', bindingContext));
      const labelExpr = isLabelBound
        ? resolveNodePropertyBindingExpression(node.id, 'label', bindingContext!)
        : null;
      // excludeKeys only suppresses the static pass — bound `label={expr}` is still appended by
      // buildNodeJsxAttributesWithBindings and must be stripped before relocating into <legend>.
      if (labelExpr) {
        attrs = attrs.replace(new RegExp(' label=\\{[^}]*\\}'), '');
      }
      const legend = readString(node.props.label, readString(node.props.title));
      const legendBlock = labelExpr
        ? `<legend className="ps-[4px] text-xs font-semibold uppercase tracking-wide text-slate-600">${renderBoundJsxTextExpression(labelExpr, legend)}</legend>`
        : legend.length > 0
          ? `<legend className="ps-[4px] text-xs font-semibold uppercase tracking-wide text-slate-600">${escapeJsxTextContent(legend)}</legend>`
          : '';
      return `<fieldset${attrs}>${legendBlock}<div className="flex flex-col gap-[2px]">\n${renderChildrenBlock(renderedChildren, 2, '  <div />')}\n</div></fieldset>`;
    }
    case 'heroui.toast':
      // Legacy: widget removed — emit children only so old documents still export safely.
      return childrenArray.length > 0
        ? `<>{/* deprecated heroui.toast — use Show Toast action */}\n${renderChildrenBlock(childrenArray, 2, '')}\n</>`
        : '{null /* deprecated heroui.toast — use Show Toast action */}';
    case 'heroui.breadcrumbs':
      return renderBreadcrumbsParityJsx(node, bindingContext, nodes);
    case 'heroui.pagination':
      return renderPaginationParityJsx(node, bindingContext, childrenArray);
    case 'heroui.checkbox-group':
      return renderCheckboxGroupParityJsx(node, bindingContext, childrenArray);
    case 'heroui.radio-group':
      return renderRadioGroupParityJsx(node, bindingContext, childrenArray);
    case 'heroui.tags-input':
      return renderTagsInputParityJsx(node, bindingContext, childrenArray);
    case 'heroui.tooltip-trigger':
      return renderTooltipTriggerParityJsx(node, bindingContext);
    case 'heroui.toolbar': {
      const toolbarAttrs = renderAttrs(node, bindingContext, baseAttrOptions);
      return `<Toolbar${toolbarAttrs}>\n${renderChildrenBlock(renderedChildren, 2, '  <div />')}\n</Toolbar>`;
    }
    case 'heroui.table':
    case 'heroui.data-grid':
      return renderDataGridCustomJsx(node, bindingContext);
    case 'heroui.app-table-grid':
      return renderAppTableGridCustomJsx(node, bindingContext);
    case 'heroui.crud-set':
      return renderCrudSetCustomJsx(node, bindingContext);
    case 'heroui.record-form':
      return renderRecordFormCustomJsx(node);
    case 'heroui.entity-picker':
      return renderEntityPickerCustomJsx(node, bindingContext);
    case 'heroui.date-picker':
      return renderDatePickerCustomJsx(node, bindingContext);
    case 'form.date-range':
      return renderDateRangeCustomJsx(node, bindingContext);
    case 'form.code-editor':
      return renderCodeEditorCustomJsx(node, bindingContext);
    case 'form.html-editor':
      return renderHtmlEditorCustomJsx(node, bindingContext);
    case 'form.markdown-editor':
      return renderMarkdownEditorCustomJsx(node, bindingContext);
    case 'form.mask-input':
      return renderMaskInputCustomJsx(node, bindingContext);
    case 'form.calculator':
      return renderCalculatorCustomJsx(node, bindingContext);
    case 'form.relation-tags-list':
      return renderRelationTagsListCustomJsx(node, bindingContext);
    case 'form.related-contents-list':
      return renderRelatedContentsListCustomJsx(node, bindingContext);
    case 'form.base-info-record':
      return renderBaseInfoRecordCustomJsx(node, bindingContext);
    case 'form.cms-content-assets':
      return renderCmsContentAssetsCustomJsx(node, bindingContext);
    case 'heroui.color-control':
      return renderColorEditorCustomJsx(node, bindingContext);
    case 'hwy.institute-logo-upload':
      return renderHwyInstituteLogoUploadCustomJsx(node, bindingContext);
    default:
      break;
  }

  if (paletteItemId) {
    const universalJsx = renderUniversalPaletteJsx(paletteItemId, node, bindingContext, childrenArray);
    if (universalJsx) {
      return universalJsx;
    }

    const vizJsx = renderVizPaletteJsx(paletteItemId, node, bindingContext, renderedChildren);
    if (vizJsx) {
      return vizJsx;
    }

    const platformJsx = renderPlatformPaletteJsx(paletteItemId, node, bindingContext);
    if (platformJsx) {
      return platformJsx;
    }
  }

  const attrs = renderAttrs(node, bindingContext, baseAttrOptions);
  const children = renderedChildren;

  switch (paletteItemId) {
    case 'heroui.card': {
      // Bug found: title/description are bindable Inspector fields, but export previously
      // always baked in the static node.props value as a literal — a Property Binding
      // configured for either field had zero effect on the exported/published component.
      const title = readString(node.props.title);
      const description = readString(node.props.description);
      const titleBindingExpr = bindingContext
        ? resolveNodePropertyBindingExpression(node.id, 'title', bindingContext)
        : null;
      const descriptionBindingExpr = bindingContext
        ? resolveNodePropertyBindingExpression(node.id, 'description', bindingContext)
        : null;
      const titleContent = titleBindingExpr ? renderBoundJsxTextExpression(titleBindingExpr, title) : title;
      const descriptionContent = descriptionBindingExpr
        ? renderBoundJsxTextExpression(descriptionBindingExpr, description)
        : description;
      const hasTitle = Boolean(titleBindingExpr) || Boolean(title);
      const hasDescription = Boolean(descriptionBindingExpr) || Boolean(description);
      const header =
        hasTitle || hasDescription
          ? `<Card.Header>${hasTitle ? `<Card.Title>${titleContent}</Card.Title>` : ''}${hasDescription ? `<Card.Description>${descriptionContent}</Card.Description>` : ''}</Card.Header>`
          : '';
      return `<Card${attrs}>${header}<Card.Content>\n${renderChildrenBlock(children, 2, '  <div />')}\n</Card.Content></Card>`;
    }
    case 'heroui.accordion-item': {
      // Bug found: same class as heroui.card above — 'title' is bindable but export always
      // emitted the static resolveAccordionTitle() literal, ignoring any Property Binding.
      const titleBindingExpr = bindingContext
        ? resolveNodePropertyBindingExpression(node.id, 'title', bindingContext)
        : null;
      const title = titleBindingExpr
        ? renderBoundJsxTextExpression(titleBindingExpr, resolveAccordionTitle(node))
        : resolveAccordionTitle(node);
      return `<Accordion defaultExpandedKeys={['item-0']}${attrs}><Accordion.Item id="item-0"><Accordion.Heading><Accordion.Trigger>${title}<Accordion.Indicator /></Accordion.Trigger></Accordion.Heading><Accordion.Panel>\n${renderChildrenBlock(children, 2, '  <div />')}\n</Accordion.Panel></Accordion.Item></Accordion>`;
    }
    case 'heroui.modal':
    case 'heroui.alert-dialog': {
      // Visibility host only — RelatedContentsList renders RelatedContentPickerDialog.
      if (paletteItemId === 'heroui.modal' && readBoolean(node.props.relatedContentPickerHost)) {
        return '';
      }
      // Published path must match interactive preview: CreateEditModalShell / ConfirmDialogShell
      // (admin backdrop, fixed footer slot). Raw HeroUI Modal left CMS dialogs with scroll=inside
      // and footer-in-body chrome that Base Components never uses.
      const title = readString(node.props.title, paletteItemId === 'heroui.alert-dialog' ? 'Alert' : 'Modal');
      const titleBindingExpr = bindingContext
        ? resolveNodePropertyBindingExpression(node.id, 'title', bindingContext)
        : null;
      const titleContent = titleBindingExpr ? renderBoundJsxTextExpression(titleBindingExpr, title) : title;
      const headerTone = resolveDesignerModalHeaderTone(paletteItemId, node.props.tone);
      const shellSize = resolveDesignerCreateEditModalSize(
        node.props.size,
        paletteItemId === 'heroui.alert-dialog' ? 'sm' : 'lg',
      );
      const usesStoreOpen = modalOverlayUsesStoreOpen(node.id, bindingContext);
      const visibilityPath = visibilityStorePathForNode(node.id);
      const { openVar, setOpenVar } = modalOverlayOpenStateVarNames(node.id);
      const closeAction = usesStoreOpen
        ? `${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(visibilityPath)}, false)`
        : `${setOpenVar}(false)`;
      const backdropClickAttr = node.props.isDismissable === false
        ? ''
        : ` onBackdropClick={() => { ${closeAction}; }}`;
      const closeOnEscapeAttr = node.props.isKeyboardDismissDisabled === true
        ? ' closeOnEscape={false}'
        : '';

      const { bodyIds, footerId } = partitionDesignerOverlayChildIds(node.children, nodes);
      const bodyChildren = bodyIds
        .map((childId) => renderChild(childId, nodes, depth + 1, bindingContext))
        .filter((item) => item.length > 0)
        .join('\n');
      const footerChild = footerId
        ? renderChild(footerId, nodes, depth + 1, bindingContext)
        : '';
      const footerJsx = footerChild
        ? ` footer={\n${indentJsxBlock(footerChild, 4)}\n  }`
        : '';
      // Fill-height body chain is only for CreateEditModalShell (maximized grids). Confirms stay short.
      const shellBodyClasses = paletteItemId === 'heroui.modal'
        ? resolveDesignerModalShellBodyClassNames({
          size: shellSize,
          hasActionFooter: Boolean(footerChild),
        })
        : {
          bodyOuterClassName: undefined as string | undefined,
          bodyClassName: DESIGNER_MODAL_SHELL_BODY_INNER_CLASS,
        };
      const bodyOuterClassAttr = shellBodyClasses.bodyOuterClassName
        ? ` bodyOuterClassName=${JSON.stringify(shellBodyClasses.bodyOuterClassName)}`
        : '';
      const bodyBlock = bodyChildren.length > 0
        ? `\n${indentJsxBlock(bodyChildren, 4)}\n  `
        : '';

      const dangerIconAttr = paletteItemId === 'heroui.alert-dialog' && headerTone === 'danger'
        ? ' icon={<Trash2 className="h-4 w-4" />}'
        : '';

      const shellTag = paletteItemId === 'heroui.alert-dialog' ? 'ConfirmDialogShell' : 'CreateEditModalShell';
      const confirmExtras = paletteItemId === 'heroui.alert-dialog'
        ? ` tone=${JSON.stringify(headerTone)} hideCancel hideConfirm${dangerIconAttr}`
        : ' gradient={false}';

      const shellJsx = `<${shellTag} title={${titleBindingExpr ? `${titleBindingExpr} ?? ${JSON.stringify(title)}` : JSON.stringify(title)}} size=${JSON.stringify(shellSize)} onClose={() => { ${closeAction}; }}${backdropClickAttr}${closeOnEscapeAttr}${confirmExtras}${bodyOuterClassAttr} bodyClassName=${JSON.stringify(shellBodyClasses.bodyClassName)} footerClassName=${JSON.stringify(DESIGNER_MODAL_SHELL_FOOTER_CLASS)}${footerJsx}>${bodyBlock}</${shellTag}>`;

      if (usesStoreOpen) {
        return shellJsx;
      }
      return `{${openVar} ? (\n${indentJsxBlock(shellJsx, 2)}\n) : null}`;
    }
    case 'heroui.drawer': {
      // Bug found: same class as heroui.card/modal above — 'title' is bindable but export always
      // baked in the static node.props value as a literal, ignoring any Property Binding.
      const title = readString(node.props.title, 'Drawer');
      const titleBindingExpr = bindingContext
        ? resolveNodePropertyBindingExpression(node.id, 'title', bindingContext)
        : null;
      const titleContent = titleBindingExpr ? renderBoundJsxTextExpression(titleBindingExpr, title) : title;
      // Mirror the live preview (runtimeRenderer.tsx): Drawer must wrap Content in Backdrop, or there is no
      // dismissable overlay and the drawer can never be closed by clicking outside / Escape once opened.
      // backdrop/isDismissable/isKeyboardDismissDisabled belong on Drawer.Backdrop (as `variant`); className/
      // style/aria/etc. belong on Drawer.Content — previously they were all dumped onto the <Drawer> root
      // (DialogTrigger), which renders no DOM of its own, so className/style edits had zero effect in export.
      const overlayParts = resolveModalOverlayPartProps(node);
      const backdropExtraAttrs = renderJsxAttributesFromProps(overlayParts.backdrop);
      const contentAttrs = renderAttrs(node, bindingContext, {
        ...baseAttrOptions,
        excludeKeys: new Set([
          'title', 'isOpen',
          'backdrop', 'scrollBehavior', 'placement', 'isKeyboardDismissDisabled', 'isDismissable',
        ]),
      });
      // Bug found: `placement` (which edge the drawer slides from) was excluded from the generic
      // attrs pass but never re-emitted anywhere — Drawer had no real size/placement field before
      // this fix (see the "Size" field replacement in inspectorPaletteFields.ts), so this was
      // dead/orphaned exclusion. Now applied directly on Drawer.Content, which is where
      // @heroui/react's DrawerContentProps actually declares it.
      const drawerPlacement = readString(node.props.placement);
      const placementAttr = drawerPlacement ? ` placement="${drawerPlacement}"` : '';
      // Mirror modal preview: showHide / grid-detail drive isOpen via ui.visibility.<nodeId>.
      const usesStoreOpen = modalOverlayUsesStoreOpen(node.id, bindingContext);
      const { openVar, setOpenVar } = modalOverlayOpenStateVarNames(node.id);
      const isOpenAttr = usesStoreOpen
        // Same hyphenated-node-id + wrong-root-identifier bugs as Modal's isOpenAttr above.
        ? ` isOpen={${buildStorePathAccessExpression('designerStore', visibilityStorePathForNode(node.id))} === true}`
        // Bug found: same as Modal above — previously a bare static isOpen (or nothing at all)
        // with no onOpenChange handler, so the published drawer could never be dismissed.
        : ` isOpen={${openVar}}`;
      const onOpenChangeAttr = usesStoreOpen
        ? ` onOpenChange={(isOpen) => { if (!isOpen) { ${DESIGNER_STORE_PATCH_VAR}(${JSON.stringify(visibilityStorePathForNode(node.id))}, false); } }}`
        : ` onOpenChange={${setOpenVar}}`;
      return `<Drawer><Drawer.Backdrop${isOpenAttr}${onOpenChangeAttr}${backdropExtraAttrs}><Drawer.Content${contentAttrs}${placementAttr}><Drawer.Dialog><Drawer.Header><Drawer.Heading>${titleContent}</Drawer.Heading></Drawer.Header><Drawer.Body>\n${renderChildrenBlock(children, 2, '  <div />')}\n</Drawer.Body></Drawer.Dialog></Drawer.Content></Drawer.Backdrop></Drawer>`;
    }
    case 'heroui.tabs': {
      const tabRecords = parseDesignerTabItems(node.props.items);
      const defaultKey = readString(node.props.defaultSelectedKey, tabRecords[0]?.key ?? 'tab-0');
      const placement = readUiTabsPlacement(node.props.placement);
      const alignment = readUiTabsAlignment(node.props.alignment);
      const width = readUiTabsWidth(node.props.width);
      const variant = readUiTabsVariant(node.props.variant);
      const panelAttachment = readUiTabsPanelAttachment(node.props.panelAttachment);
      const overflow = readUiTabsOverflow(node.props.overflow);
      const ariaLabel = readString(node.props.ariaLabel, 'Tabs');
      const itemEntries = tabRecords.map((item, index) => {
        const childJsx = node.children[index]
          ? renderChild(node.children[index]!, nodes, depth + 1, bindingContext)
          : '';
        const content = childJsx.trim().length > 0 ? childJsx : '<div />';
        return `{ id: ${JSON.stringify(item.key)}, label: ${JSON.stringify(item.label)}, content: (\n${indentJsxBlock(content, 6)}\n    ) }`;
      }).join(',\n    ');
      const tabsAttrs = adaptSelectionChangeAttr(
        renderAttrs(node, bindingContext, {
          ...baseAttrOptions,
          excludeKeys: new Set([
            'items',
            'placement',
            'alignment',
            'width',
            'variant',
            'visualMode',
            'panelAttachment',
            'overflow',
            'activationMode',
            'panelLifecycle',
            'defaultSelectedKey',
            'selectedKey',
            'ariaLabel',
          ]),
        }),
        node.id,
        bindingContext,
        'key',
      );
      return `<UiTabs ariaLabel=${JSON.stringify(ariaLabel)} placement="${placement}" alignment="${alignment}" width="${width}" variant="${variant}" panelAttachment="${panelAttachment}" overflow="${overflow}" defaultSelectedKey="${defaultKey}"${tabsAttrs} items={[\n    ${itemEntries}\n  ]} />`;
    }
    default:
      return null;
  }
};

export const renderDesignerNodeJsx = (
  nodeId: string,
  nodes: Record<string, DesignerNode>,
  depth: number,
  bindingContext?: TsxBindingRenderContext,
  wrapAsJsxExpression = true,
): string => {
  const node = nodes[nodeId];
  if (!node || node.layout.visible === false) {
    return '';
  }

  if (shouldRenderAsLogicRepeater(node)) {
    return renderLogicRepeaterJsx(node, nodes, depth, renderDesignerNodeJsx, bindingContext);
  }

  const contentStatusPickerJsx = renderContentStatusPickerJsx(node, bindingContext);
  if (contentStatusPickerJsx) {
    return wrapNodeJsxWithClientAndVisibility(node, contentStatusPickerJsx, depth, bindingContext, wrapAsJsxExpression);
  }

  const spec = resolveTsxComponentSpec(node);
  const childrenArray = node.children
    .map((childId) => renderDesignerNodeJsx(childId, nodes, depth + 1, bindingContext, wrapAsJsxExpression))
    .filter((item) => item.length > 0);
  const children = childrenArray.join('\n');

  let innerJsx = '';

  if (spec.kind === 'library-custom') {
    const custom = renderCustomLibraryJsx(spec, node, nodes, depth, renderDesignerNodeJsx, bindingContext);
    if (custom) {
      innerJsx = custom;
    }
  }

  if (!innerJsx && spec.kind === 'library-generic') {
    innerJsx = renderGenericLibraryJsx(spec, node, children, bindingContext);
  }

  if (!innerJsx) {
    switch (spec.kind) {
      case 'html-text':
      case 'html-heading':
      case 'html-list-item':
      case 'html-link':
        innerJsx = renderHtmlTextJsx(spec, node, bindingContext);
        break;
      case 'html-image':
        innerJsx = renderHtmlImageJsx(spec, node, bindingContext);
        break;
      case 'html-iframe':
        innerJsx = renderHtmlIframeJsx(spec, node, bindingContext);
        break;
      case 'html-file-upload':
        innerJsx = renderHtmlFileUploadJsx(spec, node, bindingContext);
        break;
      case 'html-list':
      case 'html-container':
      default:
        innerJsx = renderHtmlContainerJsx(spec, node, children, bindingContext, childrenArray);
        break;
    }
  }

  return wrapNodeJsxWithClientAndVisibility(node, innerJsx, depth, bindingContext, wrapAsJsxExpression);
};

export const renderDesignerDocumentBodyJsx = (
  document: DesignerDocument,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const root = document.nodes[document.rootNodeId];
  if (!root) {
    return '';
  }

  return root.children
    .map((childId) => renderDesignerNodeJsx(childId, document.nodes, 0, bindingContext))
    .filter((item) => item.length > 0)
    .join('\n');
};

export const renderDesignerDocumentTsxBody = (
  document: DesignerDocument,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const body = renderDesignerDocumentBodyJsx(document, bindingContext);
  return body.length > 0 ? indentJsxBlock(body, 6) : '      <div />';
};
