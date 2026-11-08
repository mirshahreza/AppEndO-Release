import React from 'react';
import { Orbit } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const WORKFLOW_DOSSIER_VIEW_TITLE = '360° workflow view';

export const WORKFLOW_DOSSIER_ICON_CLASS = 'h-3.5 w-3.5';

export const WorkflowDossierIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Orbit className={cn(WORKFLOW_DOSSIER_ICON_CLASS, className)} strokeWidth={2} aria-hidden />
);
