import { describe, expect, it } from 'vitest';
import { updateTodoListTool } from '../updateTodoList';
import { clearAgentTodos, listAgentTodos } from '../agentTodoStore';
import { testToolExecutionContext } from '../../../agent/__tests__/testAgentFixtures';

describe('updateTodoListTool', () => {
  it('stores todos in run-scoped store', async () => {
    clearAgentTodos();
    const result = await updateTodoListTool.execute({
      todos: JSON.stringify([
        { id: '1', title: 'Retrieve function', status: 'completed' },
        { id: '2', title: 'Draft UI', status: 'in_progress' },
      ]),
    }, testToolExecutionContext);

    expect(result.ok).toBe(true);
    expect(listAgentTodos()).toHaveLength(2);
    clearAgentTodos();
  });

  it('rejects invalid JSON', async () => {
    const result = await updateTodoListTool.execute({ todos: 'not-json' }, testToolExecutionContext);
    expect(result.ok).toBe(false);
  });
});
