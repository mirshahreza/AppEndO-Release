import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { lookupEmbeddedEnglish } from '../../core/culture/embeddedTranslationBundles';
import { installKey } from '../../core/culture/translations/cultureKeyHelpers';
import type { StepWizardStepDef } from '../../shared/ui/StepWizardShell';
import {
  Activity,
  Database,
  HardDrive,
  Mail,
  Server,
  Shield,
  Sparkles,
} from 'lucide-react';
import type { CacheDriver } from '../../shared/api/contracts/cache/types';
import type { NodeCapability } from '../../shared/nodeCapabilities';
import {
  NODE_CAPABILITY_ORDER,
  SINGLETON_NODE_CAPABILITIES,
} from '../../shared/nodeCapabilities';
import type { InstallProgressStep } from './InstallProgressDialog';
import type {
  InstallTopologyMode,
  InstallWizardStepId,
} from './installWizardSteps';

export function installText(suffix: string, t?: TranslationFn): string {
  const key = installKey(suffix);
  return t ? t(key) : lookupEmbeddedEnglish(key);
}

const INSTALL_WIZARD_STEP_ICONS: Record<InstallWizardStepId, StepWizardStepDef['icon']> = {
  welcome: Sparkles,
  database: Database,
  cache: HardDrive,
  email: Mail,
  admin: Shield,
  capabilities: Server,
  summary: Activity,
};

const INSTALL_WIZARD_STEP_TONES: Record<InstallWizardStepId, StepWizardStepDef['tone']> = {
  welcome: 'indigo',
  database: 'cyan',
  cache: 'amber',
  email: 'rose',
  admin: 'violet',
  capabilities: 'emerald',
  summary: 'emerald',
};

export function getInstallWizardStepMeta(
  stepId: InstallWizardStepId,
  t: TranslationFn,
): StepWizardStepDef {
  return {
    title: t(installKey(`steps.${stepId}.title`)),
    description: t(installKey(`steps.${stepId}.description`)),
    icon: INSTALL_WIZARD_STEP_ICONS[stepId],
    tone: INSTALL_WIZARD_STEP_TONES[stepId],
  };
}

export function getInstallTopologyModeOptions(t: TranslationFn): Array<{
  id: InstallTopologyMode;
  title: string;
  description: string;
}> {
  return [
    {
      id: 'single-node',
      title: t(installKey('topology.singleNode.title')),
      description: t(installKey('topology.singleNode.description')),
    },
    {
      id: 'role-based',
      title: t(installKey('topology.roleBased.title')),
      description: t(installKey('topology.roleBased.description')),
    },
  ];
}

const CACHE_DRIVER_LINE_KEYS: Record<CacheDriver, readonly string[]> = {
  memory: ['cache.memory.line1', 'cache.memory.line2', 'cache.memory.line3'],
  redis: ['cache.redis.line1', 'cache.redis.line2', 'cache.redis.line3', 'cache.redis.line4'],
};

export function getInstallCacheModeOptions(t: TranslationFn): Array<{
  id: CacheDriver;
  title: string;
  descriptionLines: readonly string[];
}> {
  return (['memory', 'redis'] as const).map((id) => ({
    id,
    title: t(installKey(`cache.${id}.title`)),
    descriptionLines: CACHE_DRIVER_LINE_KEYS[id].map((suffix) => t(installKey(suffix))),
  }));
}

const CAPABILITY_LINE_KEYS: Record<NodeCapability, readonly string[]> = {
  service: ['capabilities.service.line1', 'capabilities.service.line2', 'capabilities.service.line3'],
  platform: [
    'capabilities.platform.line1',
    'capabilities.platform.line2',
    'capabilities.platform.line3',
    'capabilities.platform.line4',
  ],
  worker: ['capabilities.worker.line1', 'capabilities.worker.line2', 'capabilities.worker.line3'],
};

export function getInstallCapabilityOptions(t: TranslationFn): Array<{
  id: NodeCapability;
  title: string;
  descriptionLines: readonly string[];
  singleton: boolean;
}> {
  return NODE_CAPABILITY_ORDER.map((id) => ({
    id,
    title: t(installKey(`capabilities.${id}.title`)),
    descriptionLines: CAPABILITY_LINE_KEYS[id].map((suffix) => t(installKey(suffix))),
    singleton: SINGLETON_NODE_CAPABILITIES.includes(id),
  }));
}

export const INSTALL_EXECUTION_STEP_IDS = [
  'capabilities',
  'database',
  'schema',
  'cache',
  'email',
  'admin',
  'complete',
] as const;

export type InstallExecutionStepId = (typeof INSTALL_EXECUTION_STEP_IDS)[number];

export function getInstallExecutionStepDefs(t: TranslationFn): Array<Pick<InstallProgressStep, 'id' | 'label'>> {
  return INSTALL_EXECUTION_STEP_IDS.map((id) => ({
    id,
    label: t(installKey(`progress.step.${id}`)),
  }));
}

export function getInstallAdminExistingAccountMessage(t: TranslationFn): string {
  return t(installKey('admin.existingAccount'));
}
