import {
  Compass,
  Database,
  GitBranch,
  Layout,
  Layers,
  Plug,
  Undo2,
} from 'lucide-react';
import type { StepWizardStepDef } from '../../../shared/ui/StepWizardShell';

/** Capability steps shared by package detail and repack flows (matches Package Builder order). */
export const PACKAGE_CAPABILITY_WIZARD_STEPS: readonly StepWizardStepDef[] = [
  {
    title: 'Portal',
    icon: Compass,
    tone: 'emerald',
    description: 'Portals published by this package, including navigation and layout dependencies.',
  },
  {
    title: 'Server Functions',
    icon: Plug,
    tone: 'cyan',
    description: 'Managed server functions shipped inside the package artifact.',
  },
  {
    title: 'Client Components',
    icon: Layout,
    tone: 'violet',
    description: 'Custom designer components included as mountable client capabilities.',
  },
  {
    title: 'Edge Data',
    icon: Layers,
    tone: 'slate',
    description: 'Data Studio models and APIs required by the packed pages.',
  },
  {
    title: 'Workflows',
    icon: GitBranch,
    tone: 'indigo',
    description: 'Workflow definitions packed as draft authoring bundles. Install never auto-publishes.',
  },
  {
    title: 'Install Scripts',
    icon: Database,
    tone: 'amber',
    description: 'SQL that runs when the package is installed.',
  },
  {
    title: 'Uninstall Scripts',
    icon: Undo2,
    tone: 'rose',
    description: 'SQL that runs when the package is removed.',
  },
] as const;

export const PACKAGE_CAPABILITY_STEP = {
  portal: 0,
  serverFunctions: 1,
  clientComponents: 2,
  edgeData: 3,
  workflows: 4,
  installScripts: 5,
  uninstallScripts: 6,
} as const;

export const PACKAGE_CAPABILITY_WIZARD_STEP_COUNT = PACKAGE_CAPABILITY_WIZARD_STEPS.length;
