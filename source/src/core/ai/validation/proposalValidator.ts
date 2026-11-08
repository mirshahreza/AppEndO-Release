import { createHash } from 'crypto';
import type { AgentMode, ChangeSet, ProposalViolation } from '../../../shared/api/contracts/ai/agentTypes';
import type { AiAgentSettings } from '../../../shared/api/contracts/ai/types';
import type { AiPageContext } from '../../../shared/api/contracts/ai/pageContext';
import { isAllowlistedPath, isPlanModeDocumentPath } from '../tools/pathAllowlist';
import { validateChangeSetsAgainstStandards } from './standardsProposalValidator';
import {
  normalizeSandboxSource,
  sandboxSourceUsesUnsupportedModulePattern,
} from '../../../shared/server-functions/sandboxSourceNormalize';

const SECRET_PATTERNS: RegExp[] = [
  /(?:api[_-]?key|secret|token|password|authorization)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{8,}/i,
  /sk-[A-Za-z0-9]{16,}/,
  /Bearer\s+[A-Za-z0-9._\-+/=]{20,}/i,
];

export type ProposalValidationOptions = {
  mode?: AgentMode;
  agentSettings?: AiAgentSettings;
  userIntentPaths?: string[];
  pageContext?: AiPageContext;
};

export type ProposalValidationResult = {
  ok: boolean;
  violations: ProposalViolation[];
};

const countChangedLines = (before: string | undefined, after: string): number => {
  if (!before) return after.split(/\r?\n/).length;
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const max = Math.max(beforeLines.length, afterLines.length);
  let changed = 0;
  for (let index = 0; index < max; index += 1) {
    if ((beforeLines[index] ?? '') !== (afterLines[index] ?? '')) {
      changed += 1;
    }
  }
  return changed;
};

const extractSearchableText = (changeSet: ChangeSet): string => {
  switch (changeSet.kind) {
    case 'file_patch':
      return changeSet.content;
    case 'component_layout_patch':
      return JSON.stringify(changeSet.patch ?? {});
    case 'function_source_patch':
      return JSON.stringify(changeSet.patch ?? {});
    case 'settings_block_patch':
      return JSON.stringify(changeSet.patch ?? {});
    case 'git_operation':
      return JSON.stringify({
        operation: changeSet.operation,
        message: changeSet.message,
        target: changeSet.target,
        branchName: changeSet.branchName,
      });
    default:
      return '';
  }
};

const extractPath = (changeSet: ChangeSet): string | undefined => {
  if (changeSet.kind === 'file_patch') return changeSet.path;
  if (changeSet.kind === 'component_layout_patch') return `component-designer:${changeSet.layoutId}`;
  if (changeSet.kind === 'function_source_patch') return `edge-function:${changeSet.functionId}`;
  if (changeSet.kind === 'settings_block_patch') return `settings:${changeSet.blockKey}`;
  if (changeSet.kind === 'git_operation') return `git:${changeSet.operation}`;
  return undefined;
};

export const validateProposal = (
  changeSets: ChangeSet[],
  options: ProposalValidationOptions = {},
): ProposalValidationResult => {
  const violations: ProposalViolation[] = [];
  const maxFiles = options.agentSettings?.vibeMaxFilesPerProposal ?? 8;
  const maxLines = options.agentSettings?.vibeMaxLinesPerProposal ?? 400;
  const userIntentPaths = new Set(options.userIntentPaths ?? []);

  if (changeSets.length === 0) {
    violations.push({
      id: 'empty-proposal',
      severity: 'error',
      message: 'Proposal contains no change sets.',
    });
    return { ok: false, violations };
  }

  if (changeSets.length > maxFiles) {
    violations.push({
      id: 'surface-max-files',
      severity: 'error',
      message: `Proposal touches ${changeSets.length} files/components; limit is ${maxFiles}.`,
    });
  }

  let totalLines = 0;

  changeSets.forEach((changeSet) => {
    const path = extractPath(changeSet);

    if (options.mode === 'plan') {
      if (changeSet.kind !== 'file_patch') {
        violations.push({
          id: `plan-scope-${changeSet.id}`,
          severity: 'error',
          message: `Plan mode only allows markdown file patches under plans/core/ or plans/packages/ (got ${changeSet.kind}).`,
          changeSetId: changeSet.id,
        });
        return;
      }

      if (!isPlanModeDocumentPath(changeSet.path)) {
        violations.push({
          id: `plan-path-${changeSet.id}`,
          severity: 'error',
          message: `Plan mode path "${changeSet.path}" must be a .md file under plans/core/ or plans/packages/.`,
          changeSetId: changeSet.id,
        });
      }
    }

    if (changeSet.kind === 'file_patch') {
      if (!isAllowlistedPath(changeSet.path)) {
        violations.push({
          id: `path-${changeSet.id}`,
          severity: 'error',
          message: `Path "${changeSet.path}" is outside the agent allowlist.`,
          changeSetId: changeSet.id,
        });
      }

      const lineCount = changeSet.content.split(/\r?\n/).length;
      totalLines += lineCount;

      if (changeSet.beforeHash && changeSet.content) {
        const beforeLineEstimate = Math.max(1, Math.floor(lineCount * 0.2));
        const changedEstimate = countChangedLines(undefined, changeSet.content);
        if (changedEstimate / Math.max(lineCount, 1) > 0.8 && lineCount > 20) {
          violations.push({
            id: `rewrite-${changeSet.id}`,
            severity: 'warning',
            message: `Large rewrite detected for ${changeSet.path} (>80% lines changed). Confirm explicitly if intended.`,
            changeSetId: changeSet.id,
          });
        }
        void beforeLineEstimate;
      }
    } else if (changeSet.kind === 'component_layout_patch') {
      totalLines += Math.max(1, Math.ceil(JSON.stringify(changeSet.patch ?? {}).length / 80));
    } else if (changeSet.kind === 'function_source_patch') {
      totalLines += Math.max(1, Math.ceil(JSON.stringify(changeSet.patch ?? {}).length / 80));
      const patch = changeSet.patch && typeof changeSet.patch === 'object' && !Array.isArray(changeSet.patch)
        ? changeSet.patch as Record<string, unknown>
        : {};
      const source = typeof patch.source === 'string' ? patch.source : '';
      const normalizedSource = normalizeSandboxSource(source);
      if (sandboxSourceUsesUnsupportedModulePattern(normalizedSource)) {
        violations.push({
          id: `function-sandbox-pattern-${changeSet.id}`,
          severity: 'error',
          message: 'Server function source must use the AppEndO sandbox pattern (global req/res + async function handler) — not export default or module.exports.',
          changeSetId: changeSet.id,
          ruleId: 'server-functions.sandbox-source',
        });
      }
      const openFunctionId = options.pageContext?.functionId?.trim();
      const patchOperation = typeof patch.operation === 'string' ? patch.operation.trim() : undefined;
      const baseFunctionId = typeof patch.baseFunctionId === 'string' ? patch.baseFunctionId.trim() : undefined;
      const claimsOpenFunctionUpdate = patchOperation === 'update' || baseFunctionId === openFunctionId;
      if (
        openFunctionId
        && changeSet.functionId !== openFunctionId
        && claimsOpenFunctionUpdate
      ) {
        violations.push({
          id: `function-identity-mismatch-${changeSet.id}`,
          severity: 'error',
          message: `Open function is "${openFunctionId}" but proposal targets "${changeSet.functionId}". Use operation "update" with functionId "${openFunctionId}".`,
          changeSetId: changeSet.id,
          ruleId: 'ai.vibe.server-function-identity',
        });
      }
    } else if (changeSet.kind === 'git_operation') {
      totalLines += 1;
      if (changeSet.operation === 'checkout' && changeSet.target) {
        const target = changeSet.target.toLowerCase();
        if (target === 'main' || target === 'master') {
          violations.push({
            id: `git-protected-${changeSet.id}`,
            severity: 'warning',
            message: `Checkout to protected branch "${changeSet.target}" — confirm explicitly if intended.`,
            changeSetId: changeSet.id,
          });
        }
      }
      if (changeSet.operation === 'branch' && changeSet.branchName) {
        const branch = changeSet.branchName.toLowerCase();
        if (branch === 'main' || branch === 'master') {
          violations.push({
            id: `git-protected-branch-${changeSet.id}`,
            severity: 'warning',
            message: `Creating branch named "${changeSet.branchName}" may be unintended — confirm explicitly.`,
            changeSetId: changeSet.id,
          });
        }
      }
      if (changeSet.operation === 'commit' && !changeSet.message?.trim()) {
        violations.push({
          id: `git-commit-message-${changeSet.id}`,
          severity: 'error',
          message: 'Git commit requires a non-empty message.',
          changeSetId: changeSet.id,
        });
      }
    } else {
      totalLines += Math.max(1, Math.ceil(extractSearchableText(changeSet).length / 80));
    }

    const searchable = extractSearchableText(changeSet);
    SECRET_PATTERNS.forEach((pattern, index) => {
      if (pattern.test(searchable)) {
        violations.push({
          id: `secret-${changeSet.id}-${index}`,
          severity: 'error',
          message: `Possible secret/credential pattern detected in "${changeSet.title}".`,
          changeSetId: changeSet.id,
        });
      }
    });

    if (path && userIntentPaths.size > 0 && changeSet.kind === 'file_patch') {
      const matchesIntent = [...userIntentPaths].some((intentPath) => (
        changeSet.path.includes(intentPath) || intentPath.includes(changeSet.path)
      ));
      if (!matchesIntent) {
        violations.push({
          id: `unrelated-${changeSet.id}`,
          severity: 'warning',
          message: `File "${changeSet.path}" was not mentioned in the plan surface estimate.`,
          changeSetId: changeSet.id,
        });
      }
    }
  });

  if (totalLines > maxLines) {
    violations.push({
      id: 'surface-max-lines',
      severity: 'error',
      message: `Estimated changed lines (${totalLines}) exceed limit of ${maxLines}.`,
    });
  }

  if (options.mode !== 'plan') {
    violations.push(...validateChangeSetsAgainstStandards(changeSets));
  }

  const hasErrors = violations.some((violation) => violation.severity === 'error');
  return { ok: !hasErrors, violations };
};

export const hashChangeSetContent = (changeSet: ChangeSet): string => (
  createHash('sha256').update(JSON.stringify(changeSet)).digest('hex').slice(0, 16)
);
