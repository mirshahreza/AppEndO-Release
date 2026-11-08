import type { CanonicalExpression, PathRoot, ReferenceDescriptor } from '../types';

/** Compiles a picked `ReferenceDescriptor` (doc 08 section 7 `@` picker) into the exact canonical
 * `CanonicalExpression` PATH shape the server's AST expects — the same roots `descriptorToken` in
 * `ReferencePickerInput.tsx` already names, kept in sync deliberately (one source of truth for the
 * type↔shape mapping, not two). */
export function descriptorToExpression(descriptor: ReferenceDescriptor, segments: Array<string | number> = []): CanonicalExpression {
  let root: PathRoot;
  switch (descriptor.type) {
    case 'WORKFLOW_VARIABLE':
      root = { type: 'WORKFLOW_VARIABLE', variableKey: descriptor.variableKey as string };
      break;
    case 'NODE_OUTPUT':
      root = { type: 'NODE_OUTPUT', nodeKey: descriptor.nodeKey as string };
      break;
    case 'CURRENT_NODE_INPUT':
      root = { type: 'CURRENT_NODE_INPUT' };
      break;
    case 'CURRENT_EVENT':
      root = { type: 'CURRENT_EVENT' };
      break;
    case 'CURRENT_WORK_ITEM':
      root = { type: 'CURRENT_WORK_ITEM', projection: descriptor.projection as string };
      break;
    case 'CURRENT_ITEM':
      root = { type: 'CURRENT_ITEM' };
      break;
    case 'CURRENT_ITEM_INDEX':
      root = { type: 'CURRENT_ITEM_INDEX' };
      break;
    case 'WORKFLOW_INPUT':
    default:
      root = { type: 'WORKFLOW_INPUT' };
      break;
  }
  return { op: 'PATH', path: { root, segments } };
}

/** Best-effort literal parse for the plain-text side of an expression field: valid JSON (number/boolean/null/quoted-string) parses as that value; anything else is kept as a raw string literal. */
export function parseLiteralInput(raw: string): CanonicalExpression {
  const trimmed = raw.trim();
  if (trimmed === '') return { op: 'LITERAL', value: '' };
  try {
    return { op: 'LITERAL', value: JSON.parse(trimmed) };
  } catch {
    return { op: 'LITERAL', value: raw };
  }
}

/** Readable one-line summary for an existing expression, used to seed a field's text box when opening an already-authored node. */
export function describeExpression(expr: CanonicalExpression | undefined): { mode: 'LITERAL' | 'REFERENCE' | 'OTHER'; text: string } {
  if (!expr) return { mode: 'LITERAL', text: '' };
  if (expr.op === 'LITERAL') {
    const value = (expr as { value: unknown }).value;
    return { mode: 'LITERAL', text: typeof value === 'string' ? value : JSON.stringify(value) };
  }
  if (expr.op === 'PATH') {
    const path = (expr as { path: { root: PathRoot; segments: Array<string | number> } }).path;
    const root = path.root;
    let base: string;
    switch (root.type) {
      case 'WORKFLOW_VARIABLE':
        base = `@VAR:${root.variableKey}`;
        break;
      case 'NODE_OUTPUT':
        base = `@NODE:${root.nodeKey}`;
        break;
      case 'CURRENT_NODE_INPUT':
        base = '@CURRENT_NODE_INPUT';
        break;
      case 'CURRENT_EVENT':
        base = '@EVENT';
        break;
      case 'CURRENT_WORK_ITEM':
        base = `@WORK_ITEM:${root.projection}`;
        break;
      case 'CURRENT_ITEM':
        base = '@ITEM';
        break;
      case 'CURRENT_ITEM_INDEX':
        base = '@ITEM_INDEX';
        break;
      default:
        base = '@WORKFLOW_INPUT';
    }
    const suffix = path.segments.length > 0 ? `.${path.segments.join('.')}` : '';
    return { mode: 'REFERENCE', text: `${base}${suffix}` };
  }
  return { mode: 'OTHER', text: JSON.stringify(expr) };
}
