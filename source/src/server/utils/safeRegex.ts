import { RE2 } from 're2-wasm';

/**
 * Canonical bounded/ReDoS-safe regex primitive for AppEndO. Backed by RE2 (Google's
 * linear-time regex engine, compiled to WASM here so it needs no native build toolchain),
 * which cannot exhibit catastrophic backtracking regardless of pattern shape — unlike the
 * native `RegExp` engine. Any feature across the platform needing "match untrusted user
 * input against a user-authored pattern" MUST go through this module rather than `new
 * RegExp(...)`, per the "MUST reuse canonical AppEndO primitives" rule (see
 * src/server/domain/workflow/actions/corePack/textActions.ts's module doc for the Action
 * that first needed this).
 */

const MAX_PATTERN_LENGTH = 500;
const MAX_SUBJECT_LENGTH = 100_000;

export type SafeRegexMatch = {
  match: string;
  index: number;
  groups: (string | null)[];
  namedGroups: Record<string, string>;
};

export type SafeRegexResult =
  | { ok: true; matched: boolean; matches: SafeRegexMatch[] }
  | { ok: false; errorCode: 'PATTERN_TOO_LONG' | 'SUBJECT_TOO_LONG' | 'INVALID_PATTERN'; message: string };

/**
 * Matches `subject` against `pattern`/`flags` (JS-style flags; `u` is always implied since
 * RE2-WASM requires unicode mode). `global` controls whether every non-overlapping match is
 * collected or only the first.
 */
export function safeRegexMatch(pattern: string, subject: string, options: { flags?: string; global?: boolean } = {}): SafeRegexResult {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { ok: false, errorCode: 'PATTERN_TOO_LONG', message: `Pattern exceeds ${MAX_PATTERN_LENGTH} character limit.` };
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return { ok: false, errorCode: 'SUBJECT_TOO_LONG', message: `Subject exceeds ${MAX_SUBJECT_LENGTH} character limit.` };
  }

  const requestedFlags = (options.flags ?? '').replace(/[gu]/g, '');
  const wantsGlobal = options.global === true || (options.flags ?? '').includes('g');
  const re2Flags = `${requestedFlags}u${wantsGlobal ? 'g' : ''}`;

  let re2: RE2;
  try {
    re2 = new RE2(pattern, re2Flags);
  } catch (error) {
    return { ok: false, errorCode: 'INVALID_PATTERN', message: error instanceof Error ? error.message : 'Invalid regular expression.' };
  }

  const matches: SafeRegexMatch[] = [];
  if (!wantsGlobal) {
    const m = re2.exec(subject);
    if (m) matches.push(toSafeMatch(m));
    return { ok: true, matched: matches.length > 0, matches };
  }

  let m: ReturnType<RE2['exec']>;
  let guard = 0;
  const guardLimit = MAX_SUBJECT_LENGTH + 1;
  while ((m = re2.exec(subject)) !== null) {
    matches.push(toSafeMatch(m));
    if (m[0].length === 0) re2.lastIndex += 1;
    if (++guard > guardLimit) break;
  }
  return { ok: true, matched: matches.length > 0, matches };
}

function toSafeMatch(m: RegExpExecArray): SafeRegexMatch {
  const namedGroups: Record<string, string> = {};
  for (const [key, value] of Object.entries(m.groups ?? {})) {
    if (value !== undefined) namedGroups[key] = value;
  }
  return {
    match: m[0],
    index: m.index,
    groups: Array.from(m)
      .slice(1)
      .map((g) => g ?? null),
    namedGroups,
  };
}
