import React from 'react';
import {
  Bell,
  Braces,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  FolderOpen,
  GitBranch,
  GitFork,
  GitMerge,
  Globe,
  Hash,
  Layers,
  ListTodo,
  Mail,
  Plug,
  Repeat,
  RotateCw,
  Route,
  Search,
  Server,
  Sparkles,
  Text,
  Timer,
  XOctagon,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { WorkflowNode } from '../types';
import { actionCategoryOf, type ActionCategory } from './actionCatalogUtils';
import type { NodeKind } from './nodeTemplates';

const NODE_KIND_ICON: Record<NodeKind, LucideIcon> = {
  ACTION: Zap,
  FOR_EACH: Repeat,
  LOOP: RotateCw,
  DECISION: GitBranch,
  SWITCH: Route,
  END: CheckCircle2,
  FAIL: XOctagon,
  DELAY: Timer,
  WAIT_EVENT: Bell,
  WORK_ITEM: ListTodo,
  PARALLEL_SPLIT: GitFork,
  PARALLEL_JOIN: GitMerge,
  SUBFLOW: Layers,
};

const ACTION_CATEGORY_ICON: Record<ActionCategory | 'other', LucideIcon> = {
  data: Database,
  text: Text,
  date: Calendar,
  communication: Mail,
  integration: Plug,
  web: Globe,
  ai: Sparkles,
  crypto: Hash,
  document: FileText,
  file: FolderOpen,
  other: Zap,
};

const ACTION_KEY_ICON_OVERRIDES: ReadonlyArray<{ pattern: RegExp; icon: LucideIcon }> = [
  { pattern: /screenshot/i, icon: Camera },
  { pattern: /internal-api|server-function/i, icon: Server },
  { pattern: /email|mail|smtp/i, icon: Mail },
  { pattern: /http|webhook|rest|fetch|url/i, icon: Globe },
  { pattern: /template|render/i, icon: FileText },
  { pattern: /json|parse|serialize/i, icon: Braces },
  { pattern: /regex|match|search|find/i, icon: Search },
  { pattern: /delay|sleep|wait|duration/i, icon: Clock },
  { pattern: /prompt|llm|chat|completion|embedding/i, icon: Sparkles },
];

function renderIcon(Icon: LucideIcon, className: string): React.ReactNode {
  return <Icon className={className} aria-hidden />;
}

export function getNodeKindIcon(kind: NodeKind, className = 'h-4 w-4'): React.ReactNode {
  return renderIcon(NODE_KIND_ICON[kind], className);
}

export function getActionIcon(actionKey: string, className = 'h-4 w-4'): React.ReactNode {
  for (const override of ACTION_KEY_ICON_OVERRIDES) {
    if (override.pattern.test(actionKey)) {
      return renderIcon(override.icon, className);
    }
  }

  return renderIcon(ACTION_CATEGORY_ICON[actionCategoryOf(actionKey)], className);
}

export function resolveWorkflowNodeIcon(node: WorkflowNode, className = 'h-4 w-4'): React.ReactNode {
  if (node.kind === 'ACTION' && node.actionRef && typeof node.actionRef === 'object') {
    const actionRef = node.actionRef as { action?: { actionKey?: string } };
    const actionKey = actionRef.action?.actionKey;
    if (actionKey) {
      return getActionIcon(actionKey, className);
    }
  }

  return getNodeKindIcon(node.kind, className);
}

export function resolveWorkflowPaletteIcon(
  payload: { nodeKind: NodeKind; actionKey?: string },
  className = 'h-4 w-4',
): React.ReactNode {
  if (payload.nodeKind === 'ACTION' && payload.actionKey) {
    return getActionIcon(payload.actionKey, className);
  }

  return getNodeKindIcon(payload.nodeKind, className);
}
