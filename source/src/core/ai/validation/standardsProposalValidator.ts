import type { ChangeSet, ProposalViolation } from '../../../shared/api/contracts/ai/agentTypes';

type StandardsRuleCheck = {
  id: string;
  test: (content: string, changeSet: ChangeSet) => string | null;
};

const RULE_CHECKS: StandardsRuleCheck[] = [
  {
    id: 'ui.grid.boolean-icons',
    test: (content) => (
      /\bYes\b|\bNo\b/.test(content) && /grid|column|boolean/i.test(content)
        ? 'Grid boolean columns must use Check/X icons — not Yes/No text.'
        : null
    ),
  },
  {
    id: 'ui.form.label-over-input.spacing',
    test: (content) => (
      /gap-1|mb-1\.5|mt-1/.test(content) && /label|form field/i.test(content)
        ? 'Label-to-control spacing must use gap-[2px], mt-[2px], or mb-[2px] — not gap-1/mb-1.5/mt-1.'
        : null
    ),
  },
  {
    id: 'ui.form.create-edit.container',
    test: (content) => (
      /create|edit|modal/i.test(content) && /bg-surface-workspace|bg-gray-50(?!\/80)/.test(content)
        ? 'Create/Edit forms should use bg-white main container with p-[15px].'
        : null
    ),
  },
  {
    id: 'ui.button.labeled-semantics',
    test: (content) => (
      /bg-indigo-600|bg-rose-600|bg-emerald-600/.test(content)
      && !/AppButton|buttonSemantics/i.test(content)
      && /<button/i.test(content)
        ? 'Labeled buttons should use AppButton or shared buttonSemantics classes.'
        : null
    ),
  },
  {
    id: 'ui.toolbar.height',
    test: (content) => (
      /toolbar/i.test(content) && /h-14|h-8/.test(content) === false && /py-[2-9]/.test(content)
        ? 'Page toolbars should use h-14 container with h-8 controls.'
        : null
    ),
  },
  {
    id: 'ui.grid.audit-column-width',
    test: (content) => (
      /created|updated/i.test(content) && /audit|_by|_at/.test(content) && !/150px|APP_TABLE_GRID_AUDIT_COLUMN_WIDTH/.test(content)
        ? 'Created/Updated audit columns should use fixed 150px width (APP_TABLE_GRID_AUDIT_COLUMN_WIDTH).'
        : null
    ),
  },
  {
    id: 'ui.checkbox.use-uicheckbox',
    test: (content) => (
      /<input[^>]+type=["']checkbox["']/i.test(content)
        ? 'Boolean toggles must use UiCheckbox — never native HTML checkboxes.'
        : null
    ),
  },
  {
    id: 'ui.destructive.confirmation',
    test: (content) => (
      /window\.confirm\s*\(/.test(content)
        ? 'Destructive actions must use in-app confirmation modals — not window.confirm.'
        : null
    ),
  },
  {
    id: 'ui.toast.position',
    test: (content) => (
      /toast|AppToast/i.test(content) && /bottom-\d|fixed bottom/.test(content)
        ? 'Feedback toasts must appear top-center (fixed top-4 left-1/2 -translate-x-1/2).'
        : null
    ),
  },
  {
    id: 'ui.grid.date-format',
    test: (content) => (
      /toLocaleDateString|toLocaleString/.test(content) && /grid|column|date/i.test(content)
        ? 'Grid date columns must use YYYY-MM-DD — not locale-dependent formatting.'
        : null
    ),
  },
];

const extractContent = (changeSet: ChangeSet): string => {
  switch (changeSet.kind) {
    case 'file_patch':
      return changeSet.content;
    case 'component_layout_patch':
      return JSON.stringify(changeSet.patch ?? {});
    case 'function_source_patch':
      return JSON.stringify(changeSet.patch ?? {});
    case 'settings_block_patch':
      return JSON.stringify(changeSet.patch ?? {});
    default:
      return '';
  }
};

export const validateChangeSetsAgainstStandards = (changeSets: ChangeSet[]): ProposalViolation[] => {
  const violations: ProposalViolation[] = [];

  changeSets.forEach((changeSet) => {
    const content = extractContent(changeSet);
    if (!content.trim()) return;

    RULE_CHECKS.forEach((rule) => {
      const message = rule.test(content, changeSet);
      if (message) {
        violations.push({
          id: `${rule.id}-${changeSet.id}`,
          severity: 'error',
          ruleId: rule.id,
          message,
          changeSetId: changeSet.id,
        });
      }
    });
  });

  return violations;
};
