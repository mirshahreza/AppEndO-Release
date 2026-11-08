import * as React from 'react';
import { CircleHelp } from 'lucide-react';
import type { DesignerInspectorHelpEntry } from '../lib/designerInspectorHelp';

export type InspectorFieldHelpLinkProps = {
  help: DesignerInspectorHelpEntry;
  className?: string;
};

export const InspectorFieldHelpLink: React.FC<InspectorFieldHelpLinkProps> = ({ help, className }) => (
  <a
    href={help.href}
    target="_blank"
    rel="noopener noreferrer"
    title={help.tooltip}
    aria-label={`Help: ${help.tooltip}`}
    className={[
      'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-primary-600',
      className,
    ].filter(Boolean).join(' ')}
    onClick={(event) => event.stopPropagation()}
    onMouseDown={(event) => event.stopPropagation()}
  >
    <CircleHelp className="h-3.5 w-3.5" aria-hidden />
  </a>
);
