import type { JsonValue } from '../../awm/types';

/**
 * p-99/WFT-10 — a small, safe, logic-less template mini-language for `text.template`, replacing the
 * old flat `{{key}}`-only substitution. "Safe" is a hard constraint here, not a preference: doc 05
 * section 3 forbids arbitrary JS execution inside a workflow definition, so this is a deliberately
 * closed grammar (dot-path lookups, `#each` iteration, `#if`/`#unless` truthiness) — not a general
 * expression language, and never `eval`/`new Function`. Modeled on Mustache's "logic-less" template
 * philosophy for exactly that reason: it is the well-known safe subset, not a novel invention.
 *
 * Deliberately simpler than real Mustache in one respect: entering an `#each` item REPLACES the
 * lookup context rather than falling back to the parent scope on a miss. This avoids the ambiguity
 * of "is `{{name}}` inside a loop the item's name or an outer variable of the same name" — a template
 * author who needs an outer value inside a loop must pass it in as a field of the item instead. This
 * is a deliberate V1 scope boundary, not an oversight.
 */

type JsonRecord = Record<string, JsonValue>;

const isPlainObject = (value: unknown): value is JsonRecord => value !== null && typeof value === 'object' && !Array.isArray(value);

const isTruthy = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return Boolean(value);
};

/** Resolves a dot-path (`a.b.0.c`) against one context value — no parent-scope fallback (see module doc). `.`/`this` return the whole context. Numeric segments index arrays. Returns `undefined` on any miss (never throws — a template must never fail a workflow node over a missing field). */
function resolvePath(context: unknown, path: string): unknown {
  if (path === '.' || path === 'this') return context;
  let current: unknown = context;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) && index >= 0 ? current[index] : undefined;
    } else if (isPlainObject(current)) {
      current = Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : undefined;
    } else {
      return undefined;
    }
  }
  return current;
}

const stringifyValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

// ---------------------------------------------------------------------------
// Tokenize
// ---------------------------------------------------------------------------

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'var'; path: string; raw: string }
  | { kind: 'each-open'; path: string }
  | { kind: 'each-close' }
  | { kind: 'if-open'; path: string }
  | { kind: 'if-else' }
  | { kind: 'if-close' }
  | { kind: 'unless-open'; path: string }
  | { kind: 'unless-close' };

/** Bounded, non-nested-quantifier scan for `{{...}}` tags — cannot catastrophically backtrack (doc 04 section 4's regex-safety bar), so this does not need `safeRegex.ts`'s RE2 primitive itself. */
const TAG_PATTERN = /\{\{\s*([^{}]*?)\s*\}\}/g;

function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  for (const match of template.matchAll(TAG_PATTERN)) {
    const [whole, rawInner] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) tokens.push({ kind: 'text', value: template.slice(lastIndex, index) });
    lastIndex = index + whole.length;

    const inner = rawInner.trim();
    if (inner.startsWith('#each ')) tokens.push({ kind: 'each-open', path: inner.slice('#each '.length).trim() });
    else if (inner === '/each') tokens.push({ kind: 'each-close' });
    else if (inner.startsWith('#if ')) tokens.push({ kind: 'if-open', path: inner.slice('#if '.length).trim() });
    else if (inner === 'else') tokens.push({ kind: 'if-else' });
    else if (inner === '/if') tokens.push({ kind: 'if-close' });
    else if (inner.startsWith('#unless ')) tokens.push({ kind: 'unless-open', path: inner.slice('#unless '.length).trim() });
    else if (inner === '/unless') tokens.push({ kind: 'unless-close' });
    else if (inner === '@index') tokens.push({ kind: 'var', path: '@index', raw: whole });
    else tokens.push({ kind: 'var', path: inner, raw: whole });
  }
  if (lastIndex < template.length) tokens.push({ kind: 'text', value: template.slice(lastIndex) });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parse into a small AST
// ---------------------------------------------------------------------------

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'var'; path: string; raw: string }
  | { kind: 'each'; path: string; body: Node[] }
  | { kind: 'if'; path: string; negate: boolean; thenBody: Node[]; elseBody: Node[] };

export class TemplateSyntaxError extends Error {}

function parseNodes(tokens: Token[], cursor: { i: number }, closingKinds: ReadonlySet<Token['kind']>): Node[] {
  const nodes: Node[] = [];
  while (cursor.i < tokens.length) {
    const token = tokens[cursor.i];
    if (closingKinds.has(token.kind)) return nodes;

    if (token.kind === 'text') {
      nodes.push({ kind: 'text', value: token.value });
      cursor.i += 1;
      continue;
    }
    if (token.kind === 'var') {
      nodes.push({ kind: 'var', path: token.path, raw: token.raw });
      cursor.i += 1;
      continue;
    }
    if (token.kind === 'each-open') {
      const path = token.path;
      cursor.i += 1;
      const body = parseNodes(tokens, cursor, new Set(['each-close']));
      if (tokens[cursor.i]?.kind !== 'each-close') throw new TemplateSyntaxError(`{{#each ${path}}} is missing its {{/each}}.`);
      cursor.i += 1;
      nodes.push({ kind: 'each', path, body });
      continue;
    }
    if (token.kind === 'if-open' || token.kind === 'unless-open') {
      const negate = token.kind === 'unless-open';
      const path = token.path;
      const closeKind = negate ? 'unless-close' : 'if-close';
      cursor.i += 1;
      const thenBody = parseNodes(tokens, cursor, new Set(negate ? [closeKind] : [closeKind, 'if-else']));
      let elseBody: Node[] = [];
      if (!negate && tokens[cursor.i]?.kind === 'if-else') {
        cursor.i += 1;
        elseBody = parseNodes(tokens, cursor, new Set([closeKind]));
      }
      if (tokens[cursor.i]?.kind !== closeKind) {
        throw new TemplateSyntaxError(`{{#${negate ? 'unless' : 'if'} ${path}}} is missing its {{/${negate ? 'unless' : 'if'}}}.`);
      }
      cursor.i += 1;
      nodes.push({ kind: 'if', path, negate, thenBody, elseBody });
      continue;
    }
    // A stray close tag with no matching open — surface it rather than silently dropping content.
    throw new TemplateSyntaxError(`Unexpected {{/${token.kind.replace('-close', '')}}} with no matching opening tag.`);
  }
  return nodes;
}

function parseTemplate(template: string): Node[] {
  const tokens = tokenize(template);
  const cursor = { i: 0 };
  const nodes = parseNodes(tokens, cursor, new Set());
  if (cursor.i < tokens.length) {
    throw new TemplateSyntaxError('Unexpected closing tag with no matching opening tag.');
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderNodes(nodes: Node[], context: unknown, index: number | null): string {
  let out = '';
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        out += node.value;
        break;
      case 'var': {
        if (node.path === '@index') {
          out += index === null ? node.raw : String(index);
          break;
        }
        const value = resolvePath(context, node.path);
        out += value === undefined ? node.raw : stringifyValue(value);
        break;
      }
      case 'each': {
        const items = resolvePath(context, node.path);
        if (Array.isArray(items)) {
          items.forEach((item, itemIndex) => {
            out += renderNodes(node.body, item, itemIndex);
          });
        }
        // A missing/non-array `items` renders zero iterations (never throws) — matches the
        // executor-level "never fail a node over a missing field" posture used for `{{var}}` misses.
        break;
      }
      case 'if': {
        const truthy = isTruthy(resolvePath(context, node.path));
        const take = node.negate ? !truthy : truthy;
        out += renderNodes(take ? node.thenBody : node.elseBody, context, index);
        break;
      }
      /* istanbul ignore next -- exhaustiveness guard */
      default: {
        const exhaustive: never = node;
        throw new Error(`Unknown template node: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
  return out;
}

/**
 * Renders `template` against `variables`. Never throws for a missing field or a non-array `#each`
 * target — only a genuine syntax error (unbalanced `#each`/`#if`/`#unless`) throws
 * `TemplateSyntaxError`, since that is an authoring mistake the caller should surface as a node
 * failure, not silently swallow.
 */
export function renderTemplate(template: string, variables: JsonValue): string {
  const nodes = parseTemplate(template);
  return renderNodes(nodes, variables, null);
}
