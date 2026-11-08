/**
 * Operator page edit locks — agents must not edit a page's code until the current
 * operator prompt explicitly names that page (pageKey, route, or unambiguous label).
 * Canonical prose: docs/standards/agents-hub.md · machine index id agent.page-edit-lock.
 */

export type OperatorPageEditLockPolicy = 'all-locked';

/** Every registered Studio / package page is locked until the prompt explicitly targets it. */
export const OPERATOR_PAGE_EDIT_LOCK_POLICY: OperatorPageEditLockPolicy = 'all-locked';

/**
 * Page keys that stay editable without being named in every prompt (keep empty unless the
 * operator permanently exempts a surface).
 */
export const OPERATOR_PAGE_EDIT_LOCK_EXCEPTION_PAGE_KEYS: string[] = [];

/** Repo-relative paths agents may always touch for lock metadata (not product pages). */
export const OPERATOR_PAGE_EDIT_LOCK_META_PATH_PREFIXES = [
  'docs/standards/agents-hub.md',
  'docs/ai/page-edit-locks.json',
  'src/config/operatorPageEditLocks.ts',
  'src/shared/lib/operatorPageEditLock.ts',
  'src/shared/lib/operatorPageEditLockCodegen.ts',
  '.cursor/rules/operator-page-edit-lock.mdc',
] as const;
