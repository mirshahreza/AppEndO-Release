import type { DesignerVersionRecord } from '../../shared/api/queries/component-designer';
import { SHELL_ROUTE_OUTLET_SLOT_ID } from '../../shared/lib/shellRouteOutlet';
import {
  COMPONENT_ALONE_SHELL_LAYOUT_KEY,
  DEFAULT_DRAFT_FOLDER,
} from '../../shared/lib/designerShellEntry';
import type { TemplateNodeSeed } from './types';
import { createStableStateFromTemplateSeeds } from './templateStateBuilder';

const SYSTEM_SHELL_LAYOUT_EPOCH = '2024-01-01T00:00:00.000Z';
const COMPONENT_ALONE_SHELL_RECORD_ID = 'system-shell-component-alone';

const COMPONENT_ALONE_LAYOUT_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    props: { className: 'flex h-full min-h-0 w-full flex-col overflow-hidden bg-white' },
    children: [
      {
        type: 'system-slot',
        props: { slotId: SHELL_ROUTE_OUTLET_SLOT_ID, className: 'min-h-0 flex-1' },
      },
    ],
  },
];

export function getComponentAloneShellLayoutRecord(): DesignerVersionRecord {
  const { state } = createStableStateFromTemplateSeeds(
    COMPONENT_ALONE_LAYOUT_TEMPLATE,
    COMPONENT_ALONE_SHELL_RECORD_ID,
    COMPONENT_ALONE_SHELL_LAYOUT_KEY,
  );

  return {
    id: COMPONENT_ALONE_SHELL_RECORD_ID,
    name: COMPONENT_ALONE_SHELL_LAYOUT_KEY,
    folder: DEFAULT_DRAFT_FOLDER,
    document: {
      ...state.document,
      name: COMPONENT_ALONE_SHELL_LAYOUT_KEY,
    },
    bindingDefinitions: state.bindingDefinitions,
    workspace: {
      viewport: state.viewport,
    },
    metadata: {
      createdAt: SYSTEM_SHELL_LAYOUT_EPOCH,
      updatedAt: SYSTEM_SHELL_LAYOUT_EPOCH,
      createdBy: 'system',
      updatedBy: 'system',
    },
  };
}
