import { Check, Circle, Loader2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export type AgentTodoListItem = {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
};

type AgentTodoListWidgetProps = {
  todos: AgentTodoListItem[];
  className?: string;
};

const statusIcon = (status: AgentTodoListItem['status']) => {
  switch (status) {
    case 'completed':
      return <Check className="h-3 w-3 text-emerald-600" />;
    case 'in_progress':
      return <Loader2 className="h-3 w-3 animate-spin text-cyan-600" />;
    case 'cancelled':
      return <X className="h-3 w-3 text-slate-400" />;
    default:
      return <Circle className="h-3 w-3 text-slate-300" />;
  }
};

/** F.1 — live todo widget separate from tool-step log. */
export const AgentTodoListWidget = ({ todos, className }: AgentTodoListWidgetProps) => {
  if (!todos.length) return null;

  return (
    <div
      className={cn('mb-1.5 rounded border border-slate-200 bg-white/80 px-2.5 py-2', className)}
      data-testid="agent-todo-list"
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tasks</p>
      <ul className="space-y-1">
        {todos.map((todo) => (
          <li key={todo.id} className="flex items-start gap-1.5 text-[10px] leading-relaxed">
            <span className="mt-0.5 shrink-0">{statusIcon(todo.status)}</span>
            <span
              className={cn(
                'min-w-0 text-slate-700',
                todo.status === 'completed' && 'text-slate-400 line-through',
                todo.status === 'cancelled' && 'text-slate-400 line-through',
              )}
            >
              {todo.title}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
