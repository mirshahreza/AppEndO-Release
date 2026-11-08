/**
 * V5 Phase P09 § V5-14 (Capability Firewall) — `docs/appendoo/decision-log.md` D-008, Option C.
 *
 * `runGit` (`native/git/gitRunner.ts`) spawns a real OS subprocess via `execFileAsync` and, before
 * this phase, passed no explicit `env`, meaning it inherited the *entire* server process
 * environment — including `DATABASE_URL`, AI provider API keys, session secrets, and anything
 * else in `.env`. Git does not need any of that to function. This is the concrete, bounded
 * hardening D-008 commits to for `mutation: 'EXTERNAL'`/shell-invoking tools: an explicit
 * allowlist of the env vars a subprocess actually needs, dropping everything else — not physical
 * process/container isolation (that remains out of scope; see D-008).
 *
 * Deliberately NOT applied to `runTests.ts`: that tool genuinely needs the application's broader
 * environment (DB connection, etc.) to run tests meaningfully, and it does not mutate anything
 * outside the workspace — a different risk profile than a shell-executing tool with no legitimate
 * need for application secrets.
 */

/** Env var name prefixes/exact names a subprocess like `git` legitimately needs to function. */
const ALLOWED_ENV_KEYS = new Set([
  'PATH', 'Path', // Windows env var names are case-insensitive but Node preserves casing
  'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
  'TEMP', 'TMP', 'TMPDIR',
  'SystemRoot', 'SYSTEMROOT', 'windir',
  'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA',
  'LANG', 'LC_ALL',
  'NODE_ENV',
]);

const ALLOWED_ENV_PREFIXES = ['GIT_'];

const isAllowedEnvKey = (key: string): boolean => (
  ALLOWED_ENV_KEYS.has(key)
  || ALLOWED_ENV_PREFIXES.some((prefix) => key.toUpperCase().startsWith(prefix))
);

/**
 * Builds a restricted environment for a shell-invoking subprocess: only vars the process needs to
 * run at all, never ambient application secrets. Pure function of `process.env` at call time —
 * always recomputed, never cached, so it reflects the current process env exactly.
 */
export const resolveJailedSubprocessEnv = (): NodeJS.ProcessEnv => {
  const jailed: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && isAllowedEnvKey(key)) {
      jailed[key] = value;
    }
  }
  return jailed;
};
