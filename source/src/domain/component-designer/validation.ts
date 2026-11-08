import {
  GLOBAL_INSPECTOR_FIELDS,
  HEROUI_PALETTE_PROP_FIELDS,
  HTML_EXTRA_ATTR_FIELDS,
  NODE_CONTENT_FIELDS,
  NODE_TAG_FIELDS,
  PALETTE_TAG_FIELDS,
  resolveDesignerPaletteItemId,
  DESIGNER_PALETTE_ITEM_ID_PROP,
} from './inspectorRegistry';
import { CORE_SLOT_CATALOG } from '../../shared/api/contracts/slots/catalog';
import type { InspectorFieldSchema } from './inspectorRegistry';
import { PALETTE_CONTENT_FIELDS, PALETTE_TAG_EXTENSION_FIELDS } from './inspectorPaletteFields';
import { canMoveNodeToParent, getPaletteItemForNode } from './catalog';
import { describeHtml5ContentModelViolation } from './html5ContentModel';
import { getNodePaletteItemId, LEGACY_REMOVED_PALETTE_IDS } from './runtimeShared';
import { isValidRepeaterAliasIdentifier } from './repeaterEngine';
import { collectAccessibilityDiagnostics } from './a11yDiagnostics';
import { collectTriggerWorkflowDiagnostics } from './bindingDiagnostics';
import type { DesignerDiagnostic, DesignerDocument, DesignerNode } from './types';

type PropRule = {
  type: PropValueType | PropValueType[];
  required?: boolean;
};

type PropValueType = 'string' | 'number' | 'boolean' | 'object';

const fieldTypeToPropRule = (field: InspectorFieldSchema): PropRule => {
  if (field.type === 'boolean') {
    return { type: 'boolean' };
  }
  if (field.type === 'number') {
    return { type: 'number' };
  }
  if (field.type === 'select') {
    // Select props are stored as strings in the inspector, but palette defaults may use numbers.
    return { type: ['string', 'number'] };
  }
  return { type: 'string', required: field.required };
};

// Computed lazily (not at module top-level) because GLOBAL_INSPECTOR_FIELDS reaches back through a
// pre-existing circular import chain (inspectorRegistry -> catalog -> html5ContentModel -> domProps ->
// layoutGridColumnWidths -> tailwindClasses -> inspectorRegistry). Deferring until first real call
// (well after all modules finish loading) avoids depending on module-evaluation order.
let globalPropRulesCache: Record<string, PropRule> | null = null;
const getGlobalPropRules = (): Record<string, PropRule> => {
  if (!globalPropRulesCache) {
    globalPropRulesCache = {
      ...Object.fromEntries(
        [...GLOBAL_INSPECTOR_FIELDS, ...HTML_EXTRA_ATTR_FIELDS].map((field) => [field.key, fieldTypeToPropRule(field)]),
      ),
      hidden: { type: 'boolean' },
    };
  }
  return globalPropRulesCache;
};

const buildNodePropRules = (node: DesignerNode): Record<string, PropRule> => {
  const rules: Record<string, PropRule> = { ...getGlobalPropRules() };

  for (const field of NODE_CONTENT_FIELDS[node.type] ?? []) {
    rules[field.key] = fieldTypeToPropRule(field);
  }

  for (const field of NODE_TAG_FIELDS[node.type] ?? []) {
    rules[field.key] = fieldTypeToPropRule(field);
  }

  const paletteItemId = resolveDesignerPaletteItemId(node);
  if (paletteItemId) {
    for (const field of PALETTE_TAG_FIELDS[paletteItemId] ?? []) {
      rules[field.key] = fieldTypeToPropRule(field);
    }

    for (const field of PALETTE_CONTENT_FIELDS[paletteItemId] ?? []) {
      rules[field.key] = fieldTypeToPropRule(field);
    }

    for (const field of PALETTE_TAG_EXTENSION_FIELDS[paletteItemId] ?? []) {
      rules[field.key] = fieldTypeToPropRule(field);
    }

    for (const field of HEROUI_PALETTE_PROP_FIELDS[paletteItemId] ?? []) {
      rules[field.key] = fieldTypeToPropRule(field);
    }
  }

  if (node.type === 'image' || node.type === 'iframe') {
    rules.width = { type: ['number', 'string'] };
    rules.height = { type: ['number', 'string'] };
  }

  return rules;
};

const isSingleValueType = (value: unknown, expected: PropValueType): boolean => {
  if (expected === 'string') {
    return typeof value === 'string';
  }
  if (expected === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }
  if (expected === 'object') {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  return typeof value === 'boolean';
};

const isValueType = (value: unknown, expected: PropRule['type']): boolean => {
  if (Array.isArray(expected)) {
    return expected.some((typeName) => isSingleValueType(value, typeName));
  }

  return isSingleValueType(value, expected);
};

const KNOWN_SLOT_IDS = new Set(CORE_SLOT_CATALOG.map((entry) => entry.id));

const pushReusableDiagnostics = (diagnostics: DesignerDiagnostic[], node: DesignerNode) => {
  if (node.type !== 'reusable-slot') {
    return;
  }

  const refId = node.componentRef?.refId ?? node.props.componentId;
  if (typeof refId !== 'string' || refId.trim().length === 0) {
    diagnostics.push({
      id: `required-prop:${node.id}:componentId`,
      code: 'required-prop',
      level: 'error',
      nodeId: node.id,
      field: 'componentId',
      message: "Required reference 'componentId' is missing for reusable-slot.",
    });
    return;
  }

  // CD-I03: reusable-version-stale — warn when a pinned version may be outdated.
  // A pinned version that looks stale (non-empty but potentially mismatched) raises
  // a warning so the designer can review and update or clear the pin.
  const pinnedVersion = node.componentRef?.version?.trim();
  if (pinnedVersion && pinnedVersion !== 'latest') {
    diagnostics.push({
      id: `reusable-version-stale:${node.id}`,
      code: 'reusable-version-stale',
      level: 'warning',
      nodeId: node.id,
      field: 'version',
      message: `Reusable component '${refId.trim()}' is pinned to version '${pinnedVersion}'. Verify this version is current or clear the pin to use the latest published version.`,
    });
  }
};


const pushSlotDiagnostics = (diagnostics: DesignerDiagnostic[], node: DesignerNode) => {
  if (node.type !== 'system-slot') {
    return;
  }

  const slotId = node.props.slotId;
  if (typeof slotId !== 'string' || slotId.trim().length === 0) {
    diagnostics.push({
      id: `required-prop:${node.id}:slotId`,
      code: 'required-prop',
      level: 'error',
      nodeId: node.id,
      field: 'slotId',
      message: "Required prop 'slotId' is missing for system-slot.",
    });
    return;
  }

  if (!KNOWN_SLOT_IDS.has(slotId.trim())) {
    diagnostics.push({
      id: `slot-unknown:${node.id}:${slotId}`,
      code: 'slot-unknown',
      level: 'error',
      nodeId: node.id,
      field: 'slotId',
      message: `Slot '${slotId}' is not registered in the platform catalog.`,
    });
  }
};

const pushLegacyPaletteDiagnostics = (diagnostics: DesignerDiagnostic[], node: DesignerNode) => {
  const paletteItemId = getNodePaletteItemId(node);
  if (!paletteItemId || !LEGACY_REMOVED_PALETTE_IDS.has(paletteItemId)) {
    return;
  }

  if (paletteItemId === 'heroui.toast') {
    diagnostics.push({
      id: `legacy-palette-item:${node.id}:heroui.toast`,
      code: 'legacy-palette-item',
      level: 'warning',
      nodeId: node.id,
      message:
        "The Toast canvas widget was removed. This node is ignored at runtime. Use Interactions → Show Toast instead, then delete this node.",
    });
  }

  if (paletteItemId === 'content.contact-form-block') {
    diagnostics.push({
      id: `legacy-palette-item:${node.id}:content.contact-form-block`,
      code: 'legacy-palette-item',
      level: 'warning',
      nodeId: node.id,
      message:
        "Contact Form Block was removed from the toolbox. Prefer the Contact Form layout preset (real html.form + inputs). This legacy mock still renders so saved drafts keep working.",
    });
  }
};

const pushPropDiagnostics = (diagnostics: DesignerDiagnostic[], node: DesignerNode) => {
  pushSlotDiagnostics(diagnostics, node);
  pushReusableDiagnostics(diagnostics, node);
  pushLegacyPaletteDiagnostics(diagnostics, node);
  const rules = buildNodePropRules(node);

  for (const [field, rule] of Object.entries(rules)) {
    const value = node.props[field];

    if (rule.required && (value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0))) {
      diagnostics.push({
        id: `required-prop:${node.id}:${field}`,
        code: 'required-prop',
        level: 'error',
        nodeId: node.id,
        field,
        message: `Required prop '${field}' is missing for ${node.type}.`,
      });
      continue;
    }

    if (value !== undefined && value !== null && !isValueType(value, rule.type)) {
      diagnostics.push({
        id: `prop-type:${node.id}:${field}`,
        code: 'prop-type',
        level: 'error',
        nodeId: node.id,
        field,
        message: `Prop '${field}' on ${node.type} must be ${rule.type}.`,
      });
    }
  }
};

export const validateDesignerDocument = (document: DesignerDocument): DesignerDiagnostic[] => {
  const diagnostics: DesignerDiagnostic[] = [];

  if (Object.keys(document.nodes).length > 500) {
    diagnostics.push({
      id: 'document-large',
      code: 'document-large',
      level: 'warning',
      message: 'Document is very large (>500 nodes). Consider splitting it into smaller reusable components to maintain design performance.',
      nodeId: document.rootNodeId,
    });
  }

  const root = document.nodes[document.rootNodeId];

  if (!root || root.type !== 'root' || root.parentId !== null) {
    diagnostics.push({
      id: 'root-missing',
      code: 'root-missing',
      level: 'error',
      message: 'Document root is missing or invalid.',
      nodeId: document.rootNodeId,
    });
    return diagnostics;
  }

  const visited = new Set<string>();
  const stack = [root.id];
  while (stack.length > 0) {
    const currentId = stack.pop() as string;
    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    const current = document.nodes[currentId];
    if (!current) {
      continue;
    }

    for (const childId of current.children) {
      stack.push(childId);
    }
  }

  for (const node of Object.values(document.nodes)) {
    if (node.id === root.id) {
      continue;
    }

    const parent = node.parentId ? document.nodes[node.parentId] : null;
    if (!parent) {
      diagnostics.push({
        id: `orphan-node:${node.id}`,
        code: 'orphan-node',
        level: 'error',
        nodeId: node.id,
        message: `Node '${node.id}' is orphaned and has no valid parent.`,
      });
      pushPropDiagnostics(diagnostics, node);
      continue;
    }

    if (!canMoveNodeToParent(node, parent)) {
      const html5Message = describeHtml5ContentModelViolation(
        node,
        parent,
        getPaletteItemForNode(node),
        getPaletteItemForNode(parent),
      );
      diagnostics.push({
        id: `invalid-parent-child:${node.id}:${parent.id}`,
        code: html5Message ? 'html5-content-model' : 'invalid-parent-child',
        level: 'error',
        nodeId: node.id,
        message: html5Message ?? `Node type '${node.type}' cannot be placed under parent type '${parent.type}'.`,
      });
    }

    if (!visited.has(node.id)) {
      diagnostics.push({
        id: `orphan-node-unreachable:${node.id}`,
        code: 'orphan-node',
        level: 'error',
        nodeId: node.id,
        message: `Node '${node.id}' is not reachable from root.`,
      });
    }

    pushPropDiagnostics(diagnostics, node);
    pushRepeaterDiagnostics(diagnostics, node, document);
  }

  // Phase 50 / gap #19 — parallel a11y category (does not change error/warning semantics).
  diagnostics.push(...collectAccessibilityDiagnostics(document));

  for (const issue of collectTriggerWorkflowDiagnostics(document)) {
    diagnostics.push({
      id: issue.id,
      code: 'binding-invalid',
      level: issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info',
      message: issue.message,
      nodeId: issue.nodeId,
      field: 'trueActions',
    });
  }

  return diagnostics;
};

const pushRepeaterDiagnostics = (
  diagnostics: DesignerDiagnostic[],
  node: DesignerNode,
  document: DesignerDocument,
) => {
  if (node.props[DESIGNER_PALETTE_ITEM_ID_PROP] !== 'logic.repeater') {
    return;
  }

  const rawItemAlias = typeof node.props.itemAlias === 'string' ? node.props.itemAlias.trim() : 'item';
  const rawIndexAlias = typeof node.props.indexAlias === 'string' ? node.props.indexAlias.trim() : 'index';
  const currentAlias = rawItemAlias || 'item';

  // Bug found (parity audit item 40): warn in Inspector when alias is not a valid JS identifier
  // (Export silently falls back via sanitizeRepeaterAlias — surface the issue to the author).
  if (rawItemAlias && !isValidRepeaterAliasIdentifier(rawItemAlias)) {
    diagnostics.push({
      id: `invalid-repeater-alias:${node.id}:itemAlias`,
      code: 'invalid-repeater-alias',
      level: 'warning',
      nodeId: node.id,
      field: 'itemAlias',
      message: `Invalid repeater item alias '${rawItemAlias}'. Use a JavaScript identifier (letters/digits/_/$, not a reserved word). Falling back to 'item' in Export.`,
    });
  }

  if (rawIndexAlias && !isValidRepeaterAliasIdentifier(rawIndexAlias)) {
    diagnostics.push({
      id: `invalid-repeater-alias:${node.id}:indexAlias`,
      code: 'invalid-repeater-alias',
      level: 'warning',
      nodeId: node.id,
      field: 'indexAlias',
      message: `Invalid repeater index alias '${rawIndexAlias}'. Use a JavaScript identifier (letters/digits/_/$, not a reserved word). Falling back to 'index' in Export.`,
    });
  }

  // Traverse ancestors to check for duplicate aliases
  let parentId = node.parentId;
  while (parentId) {
    const parentNode = document.nodes[parentId];
    if (!parentNode) {
      break;
    }

    if (parentNode.props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'logic.repeater') {
      const parentAlias = (typeof parentNode.props.itemAlias === 'string' ? parentNode.props.itemAlias.trim() : 'item') || 'item';
      if (parentAlias === currentAlias) {
        diagnostics.push({
          id: `ambiguous-repeater-alias:${node.id}:${parentAlias}`,
          code: 'ambiguous-repeater-alias',
          level: 'warning',
          nodeId: node.id,
          field: 'itemAlias',
          message: `Ambiguous nested repeater alias '${currentAlias}'. Ancestor repeater '${parentNode.id}' uses the same alias. Rename the alias to avoid scoping issues.`,
        });
        break;
      }
    }

    parentId = parentNode.parentId;
  }
};
