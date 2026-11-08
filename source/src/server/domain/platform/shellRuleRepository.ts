import {
  deleteShellRuleFile,
  listShellRuleFiles,
  nextShellRuleId,
  readShellRuleFile,
  touchPlatformRegistryIndex,
  withPlatformRegistryLock,
  writeShellRuleFile,
} from '../../../core/platform-registry/PlatformRegistryFileStore';
import {
  buildAuditFields,
  enrichPlatformShellRuleAudit,
  type PlatformRegistryActor,
} from '../../../core/platform-registry/platformRegistryAudit';

function sortShellRules(rules: ReturnType<typeof listShellRuleFiles>) {
  return [...rules].sort((left, right) => {
    const mountCompare = left.mountId.localeCompare(right.mountId);
    if (mountCompare !== 0) return mountCompare;
    const pathCompare = left.pathPrefix.localeCompare(right.pathPrefix);
    if (pathCompare !== 0) return pathCompare;
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.id - right.id;
  });
}

export async function listPlatformShellRuleRows() {
  const rules = sortShellRules(listShellRuleFiles());
  return rules.map((rule) => enrichPlatformShellRuleAudit(rule));
}

export async function findPlatformShellRuleById(id: number) {
  const rule = readShellRuleFile(id);
  return rule ? enrichPlatformShellRuleAudit(rule) : undefined;
}

export async function insertPlatformShellRule(
  input: {
    mountId: string;
    pathPrefix: string;
    shellKey: string;
    priority: number;
    enabled: boolean;
    source?: string | null;
  },
  actor: PlatformRegistryActor,
) {
  withPlatformRegistryLock(() => {
    const id = nextShellRuleId();
    writeShellRuleFile({
      id,
      mountId: input.mountId,
      pathPrefix: input.pathPrefix,
      shellKey: input.shellKey,
      priority: input.priority,
      enabled: input.enabled,
      ownerPackageId: null,
      ownerPluginVersion: null,
      source: input.source ?? null,
      ...buildAuditFields(actor),
    });
    touchPlatformRegistryIndex();
  });
}

export async function updatePlatformShellRule(
  id: number,
  input: {
    pathPrefix: string;
    shellKey: string;
    priority: number;
    enabled: boolean;
    source?: string | null;
  },
  actor: PlatformRegistryActor,
) {
  withPlatformRegistryLock(() => {
    const current = readShellRuleFile(id);
    if (!current) {
      throw new Error(`Shell rule "${id}" not found.`);
    }

    writeShellRuleFile({
      ...current,
      pathPrefix: input.pathPrefix,
      shellKey: input.shellKey,
      priority: input.priority,
      enabled: input.enabled,
      source: input.source ?? current.source ?? null,
      ...buildAuditFields(actor, current),
    });
    touchPlatformRegistryIndex();
  });
}

export async function deletePlatformShellRule(id: number) {
  withPlatformRegistryLock(() => {
    deleteShellRuleFile(id);
    touchPlatformRegistryIndex();
  });
}

export async function findLatestPlatformShellRuleId(
  mountId: string,
  pathPrefix: string,
  shellKey: string,
) {
  const match = sortShellRules(listShellRuleFiles())
    .filter((item) => item.mountId === mountId && item.pathPrefix === pathPrefix && item.shellKey === shellKey)
    .at(-1);
  return match ? { id: match.id } : undefined;
}
