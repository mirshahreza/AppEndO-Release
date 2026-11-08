export type AgentTodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type AgentTodoItem = {
  id: string;
  title: string;
  status: AgentTodoStatus;
};

const todos: AgentTodoItem[] = [];

export const setAgentTodos = (items: AgentTodoItem[]): AgentTodoItem[] => {
  todos.splice(0, todos.length, ...items);
  return [...todos];
};

export const listAgentTodos = (): AgentTodoItem[] => [...todos];

export const clearAgentTodos = (): void => {
  todos.splice(0, todos.length);
};
