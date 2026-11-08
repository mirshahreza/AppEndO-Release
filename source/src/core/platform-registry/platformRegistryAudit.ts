import type {
  PlatformMount,
  PlatformPageModule,
  PlatformRouteBinding,
  PlatformShell,
  PlatformShellRule,
} from '../../shared/api/contracts/platform/types';

type AuditedEntity = {
  createdBy?: number | null;
  updatedBy?: number | null;
  createdByUsername?: string | null;
  updatedByUsername?: string | null;
};

export type PlatformRegistryActor = {
  userId: number | null;
  username: string | null;
};

export function enrichPlatformMountAudit(mount: PlatformMount): PlatformMount {
  return mount;
}

export function enrichPlatformShellAudit(shell: PlatformShell): PlatformShell {
  return shell;
}

export function enrichPlatformPageModuleAudit(pageModule: PlatformPageModule): PlatformPageModule {
  return pageModule;
}

export function enrichPlatformShellRuleAudit(rule: PlatformShellRule): PlatformShellRule {
  return rule;
}

export function enrichPlatformRouteBindingAudit(binding: PlatformRouteBinding): PlatformRouteBinding {
  return binding;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function buildAuditFields(actor: PlatformRegistryActor, existing?: AuditedEntity) {
  const now = nowIso();
  if (!existing) {
    return {
      createdAt: now,
      createdBy: actor.userId,
      createdByUsername: actor.username,
      updatedAt: now,
      updatedBy: actor.userId,
      updatedByUsername: actor.username,
    };
  }

  return {
    createdAt: existing.createdAt,
    createdBy: existing.createdBy ?? null,
    createdByUsername: existing.createdByUsername ?? null,
    updatedAt: now,
    updatedBy: actor.userId,
    updatedByUsername: actor.username,
  };
}
