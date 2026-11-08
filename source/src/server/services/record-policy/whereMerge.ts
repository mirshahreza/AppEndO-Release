import { Op, type WhereOptions } from 'sequelize';

/** Unsatisfiable predicate for fail-closed scoped models (no matching allow). */
export const DENY_ALL_WHERE: WhereOptions = {
  [Op.and]: [
    { id: { [Op.eq]: '__rpe_deny__' } },
    { id: { [Op.ne]: '__rpe_deny__' } },
  ],
};

const isWherePresent = (part: WhereOptions | null | undefined): part is WhereOptions => {
  if (!part || typeof part !== 'object') {
    return false;
  }
  // Sequelize Op keys are symbols — Object.keys alone misses `{ [Op.and]: [...] }`.
  return Object.keys(part).length > 0 || Object.getOwnPropertySymbols(part).length > 0;
};

/**
 * Combine where fragments with AND. Skips empty plain objects.
 * Prefer this over shallow key spread for security merges (D5).
 */
export const mergeWhereAnd = (
  ...parts: Array<WhereOptions | null | undefined>
): WhereOptions => {
  const clauses = parts.filter(isWherePresent);
  if (clauses.length === 0) {
    return {};
  }
  if (clauses.length === 1) {
    return clauses[0];
  }
  return { [Op.and]: clauses };
};

export const mergeWhereOr = (
  ...parts: Array<WhereOptions | null | undefined>
): WhereOptions => {
  const clauses = parts.filter(isWherePresent);
  if (clauses.length === 0) {
    return DENY_ALL_WHERE;
  }
  if (clauses.length === 1) {
    return clauses[0];
  }
  return { [Op.or]: clauses };
};
