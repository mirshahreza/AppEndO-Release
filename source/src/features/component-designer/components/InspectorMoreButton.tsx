import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type InspectorMoreButtonProps = {
  expanded: boolean;
  onToggle: () => void;
};

export const InspectorMoreButton: React.FC<InspectorMoreButtonProps> = ({ expanded, onToggle }) => (
  <button
    type="button"
    className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${expanded ? 'border-slate-300 bg-slate-100 text-slate-600' : 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600'}`}
    aria-label={expanded ? 'Hide additional properties' : 'Show additional properties'}
    aria-expanded={expanded}
    onClick={onToggle}
  >
    {expanded ? <ChevronUp className="h-3 w-3" strokeWidth={1.75} /> : <ChevronDown className="h-3 w-3" strokeWidth={1.75} />}
  </button>
);
