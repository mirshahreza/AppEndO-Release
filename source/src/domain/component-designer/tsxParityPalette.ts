import type { TsxBindingRawExpression, TsxBindingRenderContext } from './bindingCodegen';
import {
  isNodePropBound,
  renderDesignerItemsMapperExpression,
  resolveNodeOptionItemsDataExpression,
  resolveNodePropertyBindingExpression,
  tsxBindingRawExpr,
} from './bindingCodegen';
import { parseDesignerAutocompleteItems } from './designerAutocompleteItems';
import { parseDesignerTagsValue } from './designerTagsValue';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { readBoolean, readNumber, readString, resolveSize } from './runtimeShared';
import { FORM_FIELD_LABEL_CLASS } from '../../shared/ui/FormSection';
import { APP_SURFACE_BOX_TONE_CLASS, type AppSurfaceBoxTone } from '../../shared/ui/surfaceClasses';
import {
  buildNodeJsxAttributesWithBindings,
  escapeJsxTextContent,
  indentJsxBlock,
  jsxAttributeStringValue,
  renderNodeJsxAttributes,
  type BuildNodeJsxAttributesOptions,
} from './tsxPropMapper';
import type { DesignerDocument, DesignerNode } from './types';

const APP_SURFACE_BOX_TONES = new Set<AppSurfaceBoxTone>([
  'slate', 'violet', 'cyan', 'indigo', 'emerald', 'amber', 'rose',
]);

const FORM_SECTION_ACCENT_BAR_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'bg-slate-400',
  violet: 'bg-violet-400',
  cyan: 'bg-cyan-500',
  indigo: 'bg-indigo-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
};

const resolveFormSectionTone = (value: unknown): AppSurfaceBoxTone => (
  typeof value === 'string' && APP_SURFACE_BOX_TONES.has(value as AppSurfaceBoxTone)
    ? value as AppSurfaceBoxTone
    : 'indigo'
);

const renderFormFieldLabelJsx = (label: string): string => (
  `  <span className="${FORM_FIELD_LABEL_CLASS}">${escapeJsxTextContent(label)}</span>\n`
);

/** Match `FormSection` chrome (Base Components → text-fields) without a FormSection import. */
const renderFormSectionWrapJsx = (
  label: string,
  tone: AppSurfaceBoxTone,
  divided: boolean,
  body: string,
): string => {
  // Compact header→body (`gap-[2px]`) — same as label-over-input; choice sections title one chip row.
  const dividedClass = divided ? ' pt-3' : '';
  const titleClass = APP_SURFACE_BOX_TONE_CLASS[tone].title;
  const accentBarClass = FORM_SECTION_ACCENT_BAR_CLASS[tone];
  return [
    `<section className="flex flex-col gap-[2px] space-y-0${dividedClass}">`,
    '  <div className="space-y-1">',
    '    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">',
    '      <div className="flex min-w-0 items-center gap-2 ps-[4px]">',
    '        <div className="flex min-w-0 items-center gap-0.5">',
    `          <span className="h-3.5 w-0.5 shrink-0 rounded-full ${accentBarClass}" aria-hidden />`,
    `          <h3 className="text-[11px] font-bold uppercase tracking-wider leading-none ${titleClass}">${escapeJsxTextContent(label)}</h3>`,
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>',
    indentJsxBlock(body, 2),
    '</section>',
  ].join('\n');
};

const renderAttrs = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  options: BuildNodeJsxAttributesOptions = {},
): string => (bindingContext
  ? buildNodeJsxAttributesWithBindings(node, bindingContext, options)
  : renderNodeJsxAttributes(node, options));

/**
 * HeroUI CheckboxGroup/RadioGroup call onChange with a raw value (string[] | string), not a DOM Event.
 * Preview adapts via adaptChoiceGroupValueToDesignerEvent; export must emit the same adapter so
 * generated handlers that read event.target.value still receive the value.
 * CheckboxGroup: string[] → joined with commas; RadioGroup: string.
 */
const adaptChoiceGroupOnChangeAttr = (
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
    ` onChange={(nextValue) => ${handlerName}({ target: { value: String(Array.isArray(nextValue) ? nextValue.join(',') : nextValue ?? '') } } as unknown as React.ChangeEvent<HTMLInputElement>)}`,
  );
};

const renderChoiceGroupControlJsx = (
  controlTag: 'Checkbox' | 'Radio',
  valueExpression: string,
  labelExpression: string,
): string => (
  `<${controlTag} value={${valueExpression}}><${controlTag}.Control><${controlTag}.Indicator /></${controlTag}.Control><${controlTag}.Content>{${labelExpression}}</${controlTag}.Content></${controlTag}>`
);

const renderChoiceGroupItemsJsx = (
  node: DesignerNode,
  paletteItemId: 'heroui.checkbox-group' | 'heroui.radio-group',
  renderedChildren: string[],
  bindingContext?: TsxBindingRenderContext,
): string => {
  if (renderedChildren.length > 0) {
    return indentJsxBlock(renderedChildren.join('\n'), 2);
  }

  const controlTag = paletteItemId === 'heroui.checkbox-group' ? 'Checkbox' : 'Radio';
  const itemsBinding = bindingContext
    ? resolveNodeOptionItemsDataExpression(node.id, bindingContext)
    : null;
  const mappedItemsExpression = itemsBinding && bindingContext
    ? `${renderDesignerItemsMapperExpression(itemsBinding, node.id, bindingContext)} ?? []`
    : null;

  if (mappedItemsExpression) {
    return `{${mappedItemsExpression}.map((item) => (
  ${renderChoiceGroupControlJsx(controlTag, 'item.id', 'item.textValue')}
))}`;
  }

  const items = parseDesignerAutocompleteItems(node.props.items);

  if (items.length === 0) {
    return `  <${controlTag} value="option-1"><${controlTag}.Control><${controlTag}.Indicator /></${controlTag}.Control><${controlTag}.Content>Option 1</${controlTag}.Content></${controlTag}>`;
  }

  return items
    .map((item) => (
      `  <${controlTag} value=${jsxAttributeStringValue(item.id)}><${controlTag}.Control><${controlTag}.Indicator /></${controlTag}.Control><${controlTag}.Content>${escapeJsxTextContent(item.textValue)}</${controlTag}.Content></${controlTag}>`
    ))
    .join('\n');
};

const resolveChoiceGroupSelectedValuesExpression = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  fallbackCsv: string,
  multiSelect: boolean,
): string | string[] | TsxBindingRawExpression | null => {
  const isSelectedExpr = bindingContext
    ? resolveNodePropertyBindingExpression(node.id, 'isSelected', bindingContext)
    : null;

  if (isSelectedExpr) {
    if (multiSelect) {
      return tsxBindingRawExpr(
        `(() => { const raw = ${isSelectedExpr}; if (Array.isArray(raw)) { return raw.map((entry) => String(entry)); } return String(raw ?? '').split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0); })()`,
      );
    }

    return tsxBindingRawExpr(
      `(() => { const raw = ${isSelectedExpr}; if (Array.isArray(raw)) { return String(raw[0] ?? ''); } return String(raw ?? ''); })()`,
    );
  }

  const selected = fallbackCsv
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (selected.length === 0) {
    return null;
  }

  return multiSelect ? selected : (selected[0] ?? '');
};

const resolveBreadcrumbLabel = (child: DesignerNode): string =>
  readString(child.props.text, readString(child.props.label)).trim();

export const renderBreadcrumbsParityJsx = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  nodes: Record<string, DesignerNode>,
): string => {
  // Bug found (parity audit item 67): after Size was removed from Inspector (breadcrumbsVariants
  // has zero size variants), codegen still unconditionally injected `size={resolveSize(...)}`
  // which always emitted the dead default `size="md"`. Exclude leftover `size` from older docs.
  const attrs = renderAttrs(node, bindingContext, {
    excludeKeys: new Set(['text', 'label', 'size', 'items']),
  });

  const itemsRaw = Array.isArray(node.props.items) ? node.props.items as Array<Record<string, unknown>> : [];

  let items: string;
  if (itemsRaw.length > 0) {
    items = itemsRaw
      .map((item) => {
        const label = typeof item.label === 'string' ? item.label : '';
        const isCurrent = item.isCurrent === true || item.isCurrent === 'true';
        const href = !isCurrent && typeof item.href === 'string' ? ` href="${escapeJsxTextContent(item.href)}"` : (!isCurrent ? ' href="#"' : '');
        return `<Breadcrumbs.Item${href}>${escapeJsxTextContent(label)}</Breadcrumbs.Item>`;
      })
      .join('\n');
  } else {
    const childNodes = node.children.map((childId) => nodes[childId]).filter(Boolean);
    const labels = childNodes
      .map((child) => resolveBreadcrumbLabel(child))
      .filter((label) => label.length > 0);

    if (labels.length > 0) {
      items = labels
        .map((label, index) => {
          const href = index < labels.length - 1 ? ' href="#"' : '';
          return `<Breadcrumbs.Item${href}>${escapeJsxTextContent(label)}</Breadcrumbs.Item>`;
        })
        .join('\n');
    } else {
      items = [
        '<Breadcrumbs.Item href="#">Home</Breadcrumbs.Item>',
        '<Breadcrumbs.Item href="#">Section</Breadcrumbs.Item>',
        '<Breadcrumbs.Item>Current</Breadcrumbs.Item>',
      ].join('\n');
    }
  }

  return `<Breadcrumbs${attrs}>\n${indentJsxBlock(items, 2)}\n</Breadcrumbs>`;
};

/**
 * HeroUI v3 Pagination has no root onPageChange — handlers are `onPress` on Previous/Next/Link.
 * Export moves the designer `onPageChange` binding onto those presses (handler signature is
 * `(nextPage: number)` from bindingCodegen).
 */
export const adaptPaginationOnPageChangeAttr = (
  attrs: string,
  nodeId: string,
  page: number,
  total: number,
  bindingContext: TsxBindingRenderContext | undefined,
): { attrs: string; previousProps: string; nextProps: string } => {
  if (!bindingContext) {
    return { attrs, previousProps: '', nextProps: '' };
  }

  const handlerName = bindingContext.handlerNames.get(`${nodeId}:onPageChange`);
  if (!handlerName) {
    return { attrs, previousProps: '', nextProps: '' };
  }

  const needle = ` onPageChange={${handlerName}}`;
  const stripped = attrs.includes(needle) ? attrs.replace(needle, '') : attrs;
  const safeTotal = Math.max(1, total);

  return {
    attrs: stripped,
    previousProps: ` onPress={() => ${handlerName}(Math.max(1, ${page} - 1))} isDisabled={${page} <= 1}`,
    nextProps: ` onPress={() => ${handlerName}(Math.min(${safeTotal}, ${page} + 1))} isDisabled={${page} >= ${safeTotal}}`,
  };
};

export const renderPaginationParityJsx = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  renderedChildren: string[],
): string => {
  const page = readNumber(node.props.page, 1);
  const total = Math.max(1, readNumber(node.props.total, 10));
  const rawAttrs = renderAttrs(node, bindingContext, {
    excludeKeys: new Set(['page', 'total']),
    reservedAttributes: {
      size: resolveSize(node.props.size),
    },
  });
  const childBody = renderedChildren.length > 0
    ? `\n${indentJsxBlock(renderedChildren.join('\n'), 2)}\n`
    : '';

  // Bug found (parity audit item P3.16): binding `page`/`total` had zero effect in export —
  // this function always used the STATIC `readNumber(node.props.page/total, ...)` literal
  // baked in at codegen time, never checking for a real Property Binding (the separate
  // `onPageChange` mechanism is unaffected and was always correct). Only take this path when
  // one of the two is actually bound, so the common static case stays byte-identical.
  const pageBoundExpr = bindingContext ? resolveNodePropertyBindingExpression(node.id, 'page', bindingContext) : null;
  const totalBoundExpr = bindingContext ? resolveNodePropertyBindingExpression(node.id, 'total', bindingContext) : null;

  if (pageBoundExpr || totalBoundExpr) {
    const pageExpr = `(Number(${pageBoundExpr ?? String(page)}) || ${page})`;
    const totalExpr = `Math.max(1, Number(${totalBoundExpr ?? String(total)}) || ${total})`;
    const handlerName = bindingContext?.handlerNames.get(`${node.id}:onPageChange`);
    const attrs = handlerName ? rawAttrs.replace(` onPageChange={${handlerName}}`, '') : rawAttrs;
    const previousProps = handlerName
      ? ` onPress={() => ${handlerName}(Math.max(1, ${pageExpr} - 1))} isDisabled={${pageExpr} <= 1}`
      : '';
    const nextProps = handlerName
      ? ` onPress={() => ${handlerName}(Math.min(${totalExpr}, ${pageExpr} + 1))} isDisabled={${pageExpr} >= ${totalExpr}}`
      : '';

    return `<Pagination${attrs}><Pagination.Summary>Page {${pageExpr}} · {${totalExpr}} total</Pagination.Summary><Pagination.Content><Pagination.Item><Pagination.Previous${previousProps} /></Pagination.Item><Pagination.Item><Pagination.Link isActive>{${pageExpr}}</Pagination.Link></Pagination.Item><Pagination.Item><Pagination.Next${nextProps} /></Pagination.Item></Pagination.Content>${childBody}</Pagination>`;
  }

  const { attrs, previousProps, nextProps } = adaptPaginationOnPageChangeAttr(
    rawAttrs,
    node.id,
    page,
    total,
    bindingContext,
  );

  return `<Pagination${attrs}><Pagination.Summary>Page ${page} · ${total} total</Pagination.Summary><Pagination.Content><Pagination.Item><Pagination.Previous${previousProps} /></Pagination.Item><Pagination.Item><Pagination.Link isActive>${page}</Pagination.Link></Pagination.Item><Pagination.Item><Pagination.Next${nextProps} /></Pagination.Item></Pagination.Content>${childBody}</Pagination>`;
};

// Bug found: a static "Selected" default with no onChange wired was always emitted as a real,
// controlled `value` attribute on CheckboxGroup/RadioGroup — with nothing to change it, the
// exported checkboxes/radios can never be clicked in the published app (mirrors the identical
// value/defaultValue freeze fixed for input-text/number-input/textarea/switch). Both components
// support `defaultValue` for exactly this uncontrolled case.
const hasChoiceGroupOnChangeHandler = (
  nodeId: string,
  bindingContext: TsxBindingRenderContext | undefined,
): boolean => Boolean(bindingContext?.handlerNames.has(`${nodeId}:onChange`));

export const renderCheckboxGroupParityJsx = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  renderedChildren: string[],
): string => {
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const label = readString(node.props.label);
  const ariaLabel = readString(node.props.ariaLabel, label || 'Checkbox group');
  const selectedAttrKey = hasChoiceGroupOnChangeHandler(node.id, bindingContext) ? 'value' : 'defaultValue';
  const selectedValue = resolveChoiceGroupSelectedValuesExpression(
    node,
    bindingContext,
    readString(node.props.isSelected),
    true,
  );
  const attrs = adaptChoiceGroupOnChangeAttr(
    renderAttrs(node, bindingContext, {
      // Bug found (parity audit item 53): size/color are not real CheckboxGroup props — exclude
      // leftovers from older documents and never inject a dead size reservedAttribute.
      excludeKeys: new Set([
        'items', 'isSelected', 'optionsSource', 'size', 'color', 'label', 'ariaLabel',
        'sectionTone', 'sectionDivided',
      ]),
      reservedAttributes: {
        ...(selectedValue ? { [selectedAttrKey]: selectedValue } : {}),
        'aria-label': ariaLabel,
        ...(isDisabled ? { isDisabled: true } : {}),
      },
    }),
    node.id,
    bindingContext,
  );
  const body = renderChoiceGroupItemsJsx(node, 'heroui.checkbox-group', renderedChildren, bindingContext);
  const groupJsx = `<CheckboxGroup${attrs}>\n${body}\n</CheckboxGroup>`;
  if (!label) {
    return groupJsx;
  }
  return renderFormSectionWrapJsx(
    label,
    resolveFormSectionTone(node.props.sectionTone),
    readBoolean(node.props.sectionDivided),
    groupJsx,
  );
};

export const renderRadioGroupParityJsx = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  renderedChildren: string[],
): string => {
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const label = readString(node.props.label);
  const ariaLabel = readString(node.props.ariaLabel, label || 'Radio group');
  const selectedAttrKey = hasChoiceGroupOnChangeHandler(node.id, bindingContext) ? 'value' : 'defaultValue';
  const selectedValue = resolveChoiceGroupSelectedValuesExpression(
    node,
    bindingContext,
    readString(node.props.isSelected, 'option-1'),
    false,
  ) ?? 'option-1';
  const shellClassName = typeof node.props.className === 'string' ? node.props.className : '';
  const orientation = readString(node.props.orientation)
    || (shellClassName.includes('designer-choice-button-group') ? 'horizontal' : '');
  const attrs = adaptChoiceGroupOnChangeAttr(
    renderAttrs(node, bindingContext, {
      excludeKeys: new Set([
        'items', 'isSelected', 'optionsSource', 'size', 'color', 'label', 'ariaLabel',
        'sectionTone', 'sectionDivided', 'orientation',
      ]),
      reservedAttributes: {
        [selectedAttrKey]: selectedValue,
        'aria-label': ariaLabel,
        ...(isDisabled ? { isDisabled: true } : {}),
        ...(orientation ? { orientation } : {}),
      },
    }),
    node.id,
    bindingContext,
  );
  const body = renderChoiceGroupItemsJsx(node, 'heroui.radio-group', renderedChildren, bindingContext);
  const groupJsx = `<RadioGroup${attrs}>\n${body}\n</RadioGroup>`;
  if (!label) {
    return groupJsx;
  }
  return renderFormSectionWrapJsx(
    label,
    resolveFormSectionTone(node.props.sectionTone),
    readBoolean(node.props.sectionDivided),
    groupJsx,
  );
};

/**
 * Strips a generically-emitted ` onChange={handlerName}` attribute from an attrs string when a
 * designer Interaction is bound to onChange for this node — used when the target component
 * (TagGroup) can't itself carry a meaningful onChange (HeroUI's TagGroup has no such prop) and
 * the bound handler is instead invoked manually from the add/remove tag callbacks.
 * Mirrors tsxNodeRenderer.ts's local `stripBoundEventAttr` (kept as a separate small copy here
 * rather than exported/shared, since tsxNodeRenderer.ts imports from this file and exporting it
 * the other way would create a cycle).
 */
const stripBoundHandlerAttr = (
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

const sanitizeTagsInputIdentifier = (nodeId: string): string => nodeId.replace(/[^a-zA-Z0-9_]/g, '_');

/**
 * T1-7 close-out — deterministic per-node local-state variable/function names for
 * heroui.tags-input's exported add/remove interaction. Shared between
 * `renderTagsInputStatePreambleLines` (declares the state + handlers once, in the component
 * preamble) and `renderTagsInputParityJsx` (references the same names when rendering the
 * node's JSX subtree) so both stay in sync without threading extra parameters through the
 * whole tsxNodeRenderer.ts call chain.
 */
export const tagsInputStateVarNames = (nodeId: string): {
  tagsVar: string;
  setTagsVar: string;
  draftVar: string;
  setDraftVar: string;
  addFn: string;
  removeFn: string;
} => {
  const suffix = sanitizeTagsInputIdentifier(nodeId);
  return {
    tagsVar: `tagsInputTags_${suffix}`,
    setTagsVar: `setTagsInputTags_${suffix}`,
    draftVar: `tagsInputDraft_${suffix}`,
    setDraftVar: `setTagsInputDraft_${suffix}`,
    addFn: `addTagsInputTag_${suffix}`,
    removeFn: `removeTagsInputTag_${suffix}`,
  };
};

export const collectTagsInputNodes = (document: DesignerDocument): DesignerNode[] =>
  Object.values(document.nodes).filter(
    (node) => node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'heroui.tags-input',
  );

/**
 * T1-7 close-out — heroui.tags-input add/remove interaction in exported TSX.
 *
 * Previously the codegen pipeline had no pattern for giving one leaf widget its own local
 * interactive state: the whole exported component is one flat function body assembled by
 * string concatenation, and Select/Switch/Slider dodge the problem by being uncontrolled
 * single-value adapters (no local array state needed). Tags-input's add/remove-from-an-array
 * UX doesn't fit that mold, so it was left as static read-only chips with no input field.
 *
 * This declares one `useState<string[]>` (+ a draft-input `useState<string>` and add/remove
 * callbacks) per heroui.tags-input node in the document, scoped by node id via
 * `tagsInputStateVarNames` so multiple instances never collide. Lines are appended to the
 * existing binding-hook preamble in codegen.ts (`generateDesignerTsx`), the same mechanism
 * already used for API-fetch hooks — emitted only when the document actually contains a
 * tags-input node. When the node has a designer Interaction bound to onChange, the bound
 * handler is invoked on every add/remove with the same `{ target: { value: <csv> } }`
 * event shape DesignerRuntimeTagsInput's `commitTags` uses in preview, so onChange-driven
 * Dynamic Actions / bindings behave identically in the exported app.
 */
export const renderTagsInputStatePreambleLines = (
  document: DesignerDocument,
  bindingContext: TsxBindingRenderContext | undefined,
): string[] => {
  const nodes = collectTagsInputNodes(document);
  if (nodes.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const node of nodes) {
    const { tagsVar, setTagsVar, draftVar, setDraftVar, addFn, removeFn } = tagsInputStateVarNames(node.id);
    const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
    const disabledLiteral = isDisabled ? 'true' : 'false';
    const handlerName = bindingContext?.handlerNames.get(`${node.id}:onChange`);
    const notifyLine = handlerName
      ? `    ${handlerName}({ target: { value: next.join(',') } } as unknown as React.ChangeEvent<HTMLInputElement>);`
      : null;

    // Bug found (parity audit item 52): initial tags state only read the static `node.props.value`
    // literal — a Property Binding on `value` was ignored in Export (Preview resolves it).
    const valueExpr = bindingContext && isNodePropBound(node.id, 'value', bindingContext)
      ? resolveNodePropertyBindingExpression(node.id, 'value', bindingContext)
      : null;
    if (valueExpr) {
      lines.push(`  const [${tagsVar}, ${setTagsVar}] = React.useState<string[]>(() => {`);
      lines.push(`    const raw = ${valueExpr};`);
      lines.push(`    if (Array.isArray(raw)) {`);
      lines.push(`      return raw.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);`);
      lines.push('    }');
      lines.push(`    if (typeof raw !== 'string' || !raw.trim()) { return []; }`);
      lines.push(`    const trimmed = raw.trim();`);
      lines.push(`    if (trimmed.startsWith('[')) {`);
      lines.push('      try {');
      lines.push('        const parsed = JSON.parse(trimmed);');
      lines.push('        if (Array.isArray(parsed)) {');
      lines.push(`          return parsed.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);`);
      lines.push('        }');
      lines.push('      } catch {');
      lines.push('        // Fall through to CSV parsing.');
      lines.push('      }');
      lines.push('    }');
      lines.push(`    return trimmed.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);`);
      lines.push('  });');
    } else {
      const initialTags = parseDesignerTagsValue(readString(node.props.value));
      lines.push(`  const [${tagsVar}, ${setTagsVar}] = React.useState<string[]>(${JSON.stringify(initialTags)});`);
    }
    lines.push(`  const [${draftVar}, ${setDraftVar}] = React.useState('');`);
    lines.push(`  const ${addFn} = (raw: string) => {`);
    lines.push(`    if (${disabledLiteral}) { return; }`);
    lines.push('    const trimmed = raw.trim();');
    lines.push(`    if (!trimmed || ${tagsVar}.includes(trimmed)) { return; }`);
    lines.push(`    const next = [...${tagsVar}, trimmed];`);
    lines.push(`    ${setTagsVar}(next);`);
    lines.push(`    ${setDraftVar}('');`);
    if (notifyLine) {
      lines.push(notifyLine);
    }
    lines.push('  };');
    lines.push(`  const ${removeFn} = (tag: string) => {`);
    lines.push(`    if (${disabledLiteral}) { return; }`);
    lines.push(`    const next = ${tagsVar}.filter((existing) => existing !== tag);`);
    lines.push(`    ${setTagsVar}(next);`);
    if (notifyLine) {
      lines.push(notifyLine);
    }
    lines.push('  };');
  }

  return lines;
};

export const renderTagsInputParityJsx = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  renderedChildren: string[],
): string => {
  const { tagsVar, draftVar, setDraftVar, addFn, removeFn } = tagsInputStateVarNames(node.id);
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const disabledLiteral = isDisabled ? 'true' : 'false';
  const label = readString(node.props.label);
  const placeholder = readString(node.props.placeholder, 'Add tags…');
  const ariaLabel = readString(node.props.ariaLabel, label || 'Tags');

  const attrs = stripBoundHandlerAttr(
    renderAttrs(node, bindingContext, {
      excludeKeys: new Set(['value', 'placeholder', 'label']),
      reservedAttributes: {
        ariaLabel,
        ...(isDisabled ? { isDisabled: true } : {}),
      },
    }),
    node.id,
    'onChange',
    bindingContext,
  );

  const labelBlock = label.length > 0
    ? renderFormFieldLabelJsx(label)
    : '';

  const childBody = renderedChildren.length > 0
    ? `\n${indentJsxBlock(renderedChildren.join('\n'), 3)}`
    : '';

  return [
    '<div className="flex w-full flex-col gap-[2px]">',
    labelBlock.length > 0 ? labelBlock : null,
    '  <div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1">',
    `    <TagGroup${attrs}>`,
    '      <TagGroup.List>',
    `        {${tagsVar}.map((tag) => (`,
    '          <Tag key={tag}>',
    '            {tag}',
    `            <button type="button" aria-label={\`Remove \${tag}\`} className="ms-1 text-slate-400 hover:text-slate-700" disabled={${disabledLiteral}} onClick={(event) => { event.stopPropagation(); ${removeFn}(tag); }}>×</button>`,
    '          </Tag>',
    '        ))}',
    `      </TagGroup.List>${childBody}`,
    '    </TagGroup>',
    `    <input type="text" value={${draftVar}} disabled={${disabledLiteral}} placeholder={${tagsVar}.length === 0 ? ${JSON.stringify(placeholder)} : ''} aria-label="Add tag" className="min-w-[80px] flex-1 border-none bg-transparent text-sm outline-none disabled:cursor-not-allowed" onChange={(event) => ${setDraftVar}(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); ${addFn}(${draftVar}); } else if (event.key === 'Backspace' && ${draftVar}.length === 0 && ${tagsVar}.length > 0) { ${removeFn}(${tagsVar}[${tagsVar}.length - 1]); } }} onBlur={() => ${addFn}(${draftVar})} />`,
    '  </div>',
    '</div>',
  ].filter((line): line is string => line !== null).join('\n');
};

export const renderTooltipTriggerParityJsx = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
): string => {
  const label = readString(node.props.text, 'Hover target');
  const href = readString(node.props.href);
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);

  // Bug found: `tooltipText` was never read at all — the exported/published tooltip always
  // showed the trigger's own label instead of the configured message, and (since `tooltipText`
  // wasn't excluded from the static attrs pass either) a static value leaked as a bogus
  // attribute on `<Tooltip.Root>`. Falls back to the trigger label for documents saved before
  // `tooltipText` existed as its own field, matching the live canvas/preview's fallback.
  const isTooltipTextBound = Boolean(bindingContext && isNodePropBound(node.id, 'tooltipText', bindingContext));
  const tooltipTextExpr = isTooltipTextBound
    ? resolveNodePropertyBindingExpression(node.id, 'tooltipText', bindingContext!)
    : null;
  const tooltipMessage = readString(node.props.tooltipText, label);

  let attrs = renderAttrs(node, bindingContext, {
    // Bug found (parity audit item 23): `ariaLabel` removed from Inspector (never reached any
    // real DOM element — `Tooltip.Root`/`TooltipTrigger` is a logical react-aria wrapper) but
    // still excluded here so a leftover value on an older saved document can't leak onto
    // `<Tooltip.Root>`, which doesn't declare any such prop.
    excludeKeys: new Set(['text', 'tooltipText', 'href', 'target', 'rel', 'ariaLabel']),
    reservedAttributes: {
      ...(isDisabled ? { isDisabled: true } : {}),
    },
  });
  attrs = attrs.replace(/ tooltipText=\{[^}]*\}/, '');

  // Bug found (parity audit item 8): the live canvas/interactive Preview renders a real,
  // interactive <HButton variant="ghost" size="sm"> for the no-href trigger case
  // (DesignerRuntimeParityPalette.tsx:621-629), but Export hardcoded the exact same static
  // placeholder markup the design canvas uses for its own dashed-border preview chip — a
  // non-clickable, non-keyboard-focusable <span> — so a published tooltip trigger with no href
  // was inert in the actual app.
  const trigger = href
    ? `<Link href=${jsxAttributeStringValue(href)}${readString(node.props.target) ? ` target=${jsxAttributeStringValue(readString(node.props.target))}` : ''}${readString(node.props.rel) ? ` rel=${jsxAttributeStringValue(readString(node.props.rel))}` : ''}>${escapeJsxTextContent(label)}</Link>`
    : `<Button variant="ghost" size="sm"${isDisabled ? ' isDisabled' : ''}>${escapeJsxTextContent(label)}</Button>`;
  const tooltipContent = tooltipTextExpr ? `{${tooltipTextExpr}}` : escapeJsxTextContent(tooltipMessage);

  return `<Tooltip.Root${attrs}><Tooltip.Trigger>${trigger}</Tooltip.Trigger><Tooltip.Content showArrow offset={8}>${tooltipContent}</Tooltip.Content></Tooltip.Root>`;
};
