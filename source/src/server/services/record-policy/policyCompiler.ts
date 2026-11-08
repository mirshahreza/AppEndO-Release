import { Op, type WhereOptions } from 'sequelize';
import type {
  RecordPolicyDocument,
  RecordPolicyPredicateNode,
  RecordPolicyTreeNode,
  RecordPolicyValueRef,
} from '../../../shared/api/contracts/record-policy';
import {
  recordPolicyMatchesAnyPrincipal,
  resolvePolicyTree,
} from '../../../shared/api/contracts/record-policy';
import { DENY_ALL_WHERE, mergeWhereAnd, mergeWhereOr } from './whereMerge';
import type { SessionScopeSnapshot } from './sessionScope.service';

const resolveValueRef = (
  value: RecordPolicyValueRef,
  session: SessionScopeSnapshot,
): unknown => {
  if ('literal' in value) {
    return value.literal;
  }
  const ref = value.ref;
  if (Object.prototype.hasOwnProperty.call(session.serverContext, ref)) {
    return session.serverContext[ref] ?? null;
  }
  return null;
};

const compileNode = (
  node: RecordPolicyPredicateNode,
  session: SessionScopeSnapshot,
): WhereOptions => {
  switch (node.op) {
    case 'and':
      return mergeWhereAnd(...node.args.map((child) => compileNode(child, session)));
    case 'or':
      return mergeWhereOr(...node.args.map((child) => compileNode(child, session)));
    case 'not':
      return { [Op.not]: compileNode(node.args[0], session) };
    case 'eq':
      return { [node.field]: { [Op.eq]: resolveValueRef(node.value, session) } };
    case 'neq':
      return { [node.field]: { [Op.ne]: resolveValueRef(node.value, session) } };
    case 'in':
    case 'inScopeSet':
    case 'inSubtree': {
      const raw = resolveValueRef(node.value, session);
      const list = Array.isArray(raw) ? raw : [raw];
      if (list.length === 0) {
        return DENY_ALL_WHERE;
      }
      return { [node.field]: { [Op.in]: list } };
    }
    case 'notIn': {
      const raw = resolveValueRef(node.value, session);
      const list = Array.isArray(raw) ? raw : [raw];
      return { [node.field]: { [Op.notIn]: list } };
    }
    case 'gt':
      return { [node.field]: { [Op.gt]: resolveValueRef(node.value, session) } };
    case 'gte':
      return { [node.field]: { [Op.gte]: resolveValueRef(node.value, session) } };
    case 'lt':
      return { [node.field]: { [Op.lt]: resolveValueRef(node.value, session) } };
    case 'lte':
      return { [node.field]: { [Op.lte]: resolveValueRef(node.value, session) } };
    case 'isNull':
      return { [node.field]: { [Op.is]: null } };
    case 'isNotNull':
      return { [node.field]: { [Op.not]: null } };
    case 'startswith': {
      const v = resolveValueRef(node.value, session);
      return { [node.field]: { [Op.like]: `${String(v ?? '')}%` } };
    }
    case 'contains': {
      const v = resolveValueRef(node.value, session);
      return { [node.field]: { [Op.like]: `%${String(v ?? '')}%` } };
    }
    default:
      return DENY_ALL_WHERE;
  }
};

const principalMatches = (
  policy: RecordPolicyDocument,
  session: SessionScopeSnapshot,
): boolean => {
  if (recordPolicyMatchesAnyPrincipal(policy.principals)) {
    return true;
  }
  const roleSet = new Set(session.roles.map((role) => role.toUpperCase()));
  if (policy.principals.roles.some((role) => roleSet.has(role.toUpperCase()))) {
    return true;
  }
  const userKey = String(session.userId);
  return policy.principals.users.some((user) => user === userKey || user.toLowerCase() === session.email?.toLowerCase());
};

export const selectApplicablePolicies = (
  policies: readonly RecordPolicyDocument[],
  session: SessionScopeSnapshot,
): RecordPolicyDocument[] => (
  policies.filter((policy) => policy.enabled && principalMatches(policy, session))
);

export type CompilePoliciesResult = {
  where: WhereOptions;
  applicable: RecordPolicyDocument[];
  denyAll: boolean;
};

type TreeCompileResult = {
  where: WhereOptions;
  denyAll: boolean;
  applicableIds: string[];
};

const compileTreeNode = (
  node: RecordPolicyTreeNode,
  byId: Map<string, RecordPolicyDocument>,
  session: SessionScopeSnapshot,
): TreeCompileResult => {
  if (node.kind === 'policy') {
    const policy = byId.get(node.policyId);
    if (!policy || !policy.enabled || !principalMatches(policy, session)) {
      return { where: DENY_ALL_WHERE, denyAll: true, applicableIds: [] };
    }
    return {
      where: compileNode(policy.predicate, session),
      denyAll: false,
      applicableIds: [policy.id],
    };
  }

  const parts = node.children.map((child) => compileTreeNode(child, byId, session));
  if (node.op === 'and') {
    if (parts.length === 0) {
      return { where: {}, denyAll: false, applicableIds: [] };
    }
    if (parts.some((part) => part.denyAll)) {
      return {
        where: DENY_ALL_WHERE,
        denyAll: true,
        applicableIds: parts.flatMap((part) => part.applicableIds),
      };
    }
    return {
      where: mergeWhereAnd(...parts.map((part) => part.where)),
      denyAll: false,
      applicableIds: parts.flatMap((part) => part.applicableIds),
    };
  }

  const alive = parts.filter((part) => !part.denyAll);
  if (alive.length === 0) {
    return { where: DENY_ALL_WHERE, denyAll: true, applicableIds: [] };
  }
  return {
    where: mergeWhereOr(...alive.map((part) => part.where)),
    denyAll: false,
    applicableIds: alive.flatMap((part) => part.applicableIds),
  };
};

/**
 * Compile the model's policy tree into a WHERE.
 * Scope is the same for every Data API kind. Empty tree with no policies ⇒ no filter
 * (caller treats On+empty like Off). Tree leaves that do not match the principal are false.
 */
export const compileSinglePolicyToWhere = (
  policy: RecordPolicyDocument | undefined,
  session: SessionScopeSnapshot,
): CompilePoliciesResult => {
  if (!policy) {
    return { where: {}, applicable: [], denyAll: false };
  }
  if (!principalMatches(policy, session)) {
    return { where: DENY_ALL_WHERE, applicable: [], denyAll: true };
  }
  return {
    where: compileNode(policy.predicate, session),
    applicable: [policy],
    denyAll: false,
  };
};

/**
 * Compile the model's policy tree into a WHERE.
 * Scope is the same for every Data API kind. Empty tree with no policies ⇒ no filter
 * (caller treats On+empty like Off). Tree leaves that do not match the principal are false.
 */
export const compilePoliciesToWhere = (
  policies: readonly RecordPolicyDocument[],
  session: SessionScopeSnapshot,
  tree?: RecordPolicyTreeNode,
): CompilePoliciesResult => {
  const enabled = policies.filter((policy) => policy.enabled);
  const resolved = resolvePolicyTree(tree, enabled.map((policy) => policy.id));
  const byId = new Map(enabled.map((policy) => [policy.id, policy]));
  const compiled = compileTreeNode(resolved, byId, session);
  const applicable = compiled.applicableIds
    .map((id) => byId.get(id))
    .filter((policy): policy is RecordPolicyDocument => Boolean(policy));
  return {
    where: compiled.where,
    applicable,
    denyAll: compiled.denyAll,
  };
};

/** Evaluate whether a plain record satisfies compiled where for create checks / assert. */
export const recordMatchesSimpleWhere = (
  record: Record<string, unknown>,
  where: WhereOptions,
): boolean => {
  // Lightweight structural check for common Op shapes produced by this compiler.
  // Full Sequelize semantics are enforced at query time; this guards create/assert paths.
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') {
      return true;
    }
    const obj = node as Record<string | symbol, unknown>;
    if (Op.and in obj) {
      const parts = obj[Op.and];
      return Array.isArray(parts) && parts.every(visit);
    }
    if (Op.or in obj) {
      const parts = obj[Op.or];
      return Array.isArray(parts) && parts.some(visit);
    }
    if (Op.not in obj) {
      return !visit(obj[Op.not]);
    }
    for (const [field, condition] of Object.entries(obj)) {
      if (typeof field !== 'string') {
        continue;
      }
      const value = record[field];
      if (!condition || typeof condition !== 'object') {
        if (value !== condition) {
          return false;
        }
        continue;
      }
      const cond = condition as Record<string | symbol, unknown>;
      if (Op.eq in cond && value !== cond[Op.eq]) {
        return false;
      }
      if (Op.ne in cond && value === cond[Op.ne]) {
        return false;
      }
      if (Op.in in cond) {
        const list = cond[Op.in];
        if (!Array.isArray(list) || !list.includes(value as never)) {
          return false;
        }
      }
      if (Op.notIn in cond) {
        const list = cond[Op.notIn];
        if (Array.isArray(list) && list.includes(value as never)) {
          return false;
        }
      }
      if (Op.is in cond && cond[Op.is] === null && value != null) {
        return false;
      }
    }
    return true;
  };
  return visit(where);
};
