import type { LucideIcon } from 'lucide-react';
import { Boxes, Cpu, HardDrive, Layers, Network, Server } from 'lucide-react';
import type { ControlPlaneProviderId } from '../../shared/api/contracts/install/controlPlaneProviders';
import type { CacheDriver } from '../../shared/api/contracts/cache/types';
import type { NodeCapability } from '../../shared/nodeCapabilities';
import {
  NODE_CAPABILITY_ORDER,
} from '../../shared/nodeCapabilities';
import type { AppSurfaceBoxTone } from '../../shared/ui/surfaceClasses';

export type InstallWizardStepId =
  | 'welcome'
  | 'database'
  | 'cache'
  | 'email'
  | 'admin'
  | 'capabilities'
  | 'summary';

export type InstallTopologyMode = 'single-node' | 'role-based';

export const SINGLE_NODE_TOPOLOGY_NAME = 'all-in-one';

export const INSTALL_TOPOLOGY_MODE_VISUAL: Record<InstallTopologyMode, { tone: AppSurfaceBoxTone; icon: LucideIcon }> = {
  'single-node': { tone: 'emerald', icon: Layers },
  'role-based': { tone: 'indigo', icon: Network },
};

export const suggestNodeNameFromCapabilities = (capabilities: readonly NodeCapability[]): string => (
  NODE_CAPABILITY_ORDER.filter((capability) => capabilities.includes(capability)).join('-')
);

export const inferTopologyMode = (
  _capabilities: readonly NodeCapability[],
  nodeName: string,
): InstallTopologyMode => {
  if (nodeName.trim() === SINGLE_NODE_TOPOLOGY_NAME) {
    return 'single-node';
  }
  return 'role-based';
};

export const INSTALL_DATABASE_PROVIDER_VISUAL: Record<
  ControlPlaneProviderId,
  { tone: AppSurfaceBoxTone; iconClassName: string }
> = {
  postgresql: { tone: 'cyan', iconClassName: 'text-[#336791]' },
  mysql: { tone: 'amber', iconClassName: 'text-[#4479A1]' },
  sqlserver: { tone: 'indigo', iconClassName: 'text-[#CC2927]' },
  sqlite: { tone: 'slate', iconClassName: 'text-[#003B57]' },
};

export const INSTALL_CACHE_MODE_VISUAL: Record<CacheDriver, { tone: AppSurfaceBoxTone; icon: LucideIcon }> = {
  memory: { tone: 'indigo', icon: HardDrive },
  redis: { tone: 'amber', icon: Server },
};

export const INSTALL_CAPABILITY_VISUAL: Record<NodeCapability, { tone: AppSurfaceBoxTone; icon: LucideIcon }> = {
  service: { tone: 'cyan', icon: Server },
  platform: { tone: 'indigo', icon: Boxes },
  worker: { tone: 'emerald', icon: Cpu },
};

export const DEFAULT_INSTALL_CAPABILITIES: NodeCapability[] = ['service', 'platform', 'worker'];
