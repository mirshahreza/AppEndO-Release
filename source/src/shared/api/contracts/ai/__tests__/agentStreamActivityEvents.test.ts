import { describe, expect, it } from 'vitest';
import { normalizeAgentStreamEvent } from '../agentValidators';

describe('agent stream activity events', () => {
  it('normalizes activity_note scaffold_seed', () => {
    expect(normalizeAgentStreamEvent({
      type: 'activity_note',
      noteKind: 'scaffold_seed',
      title: 'Starting idea from server seed',
      detail: 'playbook',
    })).toEqual({
      type: 'activity_note',
      noteKind: 'scaffold_seed',
      title: 'Starting idea from server seed',
      detail: 'playbook',
    });
  });

  it('normalizes agent_repair', () => {
    const event = normalizeAgentStreamEvent({
      type: 'agent_repair',
      activityTitle: 'Repairing draft (1 issue)',
      intention: 'Fix validation issues',
      violations: [{ id: 'v1', severity: 'error', message: 'Use UiCheckbox', ruleId: 'ui.checkbox' }],
    });
    expect(event.type).toBe('agent_repair');
    if (event.type === 'agent_repair') {
      expect(event.violations[0]?.message).toBe('Use UiCheckbox');
    }
  });

  it('normalizes todo_update', () => {
    const event = normalizeAgentStreamEvent({
      type: 'todo_update',
      todos: [{ id: '1', title: 'Draft', status: 'in_progress' }],
    });
    expect(event).toEqual({
      type: 'todo_update',
      todos: [{ id: '1', title: 'Draft', status: 'in_progress' }],
    });
  });
});
