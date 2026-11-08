import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Braces,
  CalendarClock,
  Code2,
  FileText,
  FolderOpen,
  GitBranch,
  History,
  LayoutGrid,
  LineChart,
  MessagesSquare,
  Monitor,
  Puzzle,
  Shield,
  Sparkles,
  Terminal,
  TriangleAlert,
  Users,
} from 'lucide-react';

const HOME_WIDGET_ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  Braces,
  CalendarClock,
  Code2,
  FileText,
  FolderOpen,
  GitBranch,
  History,
  LayoutGrid,
  LineChart,
  MessagesSquare,
  Monitor,
  Puzzle,
  Shield,
  Sparkles,
  Terminal,
  TriangleAlert,
  Users,
};

export function resolveHomeWidgetLucideIcon(name: string): LucideIcon {
  return HOME_WIDGET_ICON_MAP[name] ?? LayoutGrid;
}
