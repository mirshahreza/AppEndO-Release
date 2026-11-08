import { parseHomeWidgetsField } from '../../../shared/api/contracts/home-widgets';
import type {
  CreatePlatformMountPayload,
  CreatePlatformPageModulePayload,
  CreatePlatformRouteBindingPayload,
  CreatePlatformShellPayload,
  CreatePlatformShellRulePayload,
  UpdatePlatformMountPayload,
  UpdatePlatformPageModulePayload,
  UpdatePlatformRouteBindingPayload,
  UpdatePlatformShellPayload,
  UpdatePlatformShellRulePayload,
} from '../../../shared/api/contracts/platform/types';
import {
  deletePlatformMount,
  deletePlatformPageModule,
  deletePlatformRouteBinding,
  deletePlatformShell,
  deletePlatformShellRule,
  findLatestPlatformRouteBindingId,
  findLatestPlatformShellRuleId,
  findPlatformMountById,
  findPlatformPageModuleByKey,
  findPlatformRouteBindingById,
  findPlatformShellByKey,
  findPlatformShellRuleById,
  insertPlatformMount,
  insertPlatformPageModule,
  insertPlatformRouteBinding,
  insertPlatformShell,
  insertPlatformShellRule,
  listPlatformMountRows,
  listPlatformPageModuleRows,
  listPlatformRouteBindingRows,
  listPlatformShellRuleRows,
  listPlatformShellRows,
  updatePlatformMount,
  updatePlatformPageModule,
  updatePlatformRouteBinding,
  updatePlatformShell,
  updatePlatformShellRule,
} from '../../domain/platform';
import type { PlatformRegistryActor } from '../../../core/platform-registry/platformRegistryAudit';
import { STUDIO_MOUNT_ID } from '../../../shared/api/contracts/platform/mountConstants';
import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import { invalidatePlatformRuntimeConfig } from './platformRuntimeConfig.service';
import {
  ensureExperienceRouteBindings,
  propagateStudioRouteBinding,
  removePropagatedStudioRouteBinding,
} from './experienceRoutePropagation.service';

const defaultDesignerRoutePropagation = (mountId: string) => (
  mountId.trim() === STUDIO_MOUNT_ID ? 'none' : 'auto'
);

const toRegistryActor = (actor: ActorContext): PlatformRegistryActor => ({
  userId: actor.userId ?? null,
  username: actor.email ?? null,
});

const normalizePathPrefix = (value: string) => {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('/')) {
    throw new HttpError(400, 'pathPrefix must start with /.');
  }
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    throw new HttpError(400, 'pathPrefix must not end with /.');
  }
  return trimmed;
};

const normalizeRoutePattern = (value: string) => String(value || '').trim().replace(/^\/+/, '');

const jsonOrNull = (value: unknown) => (value == null ? null : JSON.stringify(value));

async function invalidateAfterMutation() {
  invalidatePlatformRuntimeConfig();
}

export class PlatformCrudService {
  async listMounts() {
    return { body: { success: true as const, items: await listPlatformMountRows() } };
  }

  async getMount(id: string) {
    const item = await findPlatformMountById(id);
    if (!item) throw new HttpError(404, 'Mount not found.');
    return { body: { success: true as const, item } };
  }

  async createMount(actor: ActorContext, input: CreatePlatformMountPayload) {
    if (!input.id?.trim()) throw new HttpError(400, 'id is required.');
    if (!input.name?.trim()) throw new HttpError(400, 'name is required.');
    if (!input.defaultRoute?.trim()) throw new HttpError(400, 'defaultRoute is required.');

    const pathPrefix = normalizePathPrefix(input.pathPrefix);
    const registryActor = toRegistryActor(actor);

    await insertPlatformMount(
      {
        id: input.id.trim(),
        pathPrefix,
        name: input.name.trim(),
        enabled: input.enabled ?? true,
        defaultRoute: input.defaultRoute.trim(),
        themeScope: input.themeScope ?? null,
        designerRoutePropagation: input.designerRoutePropagation ?? defaultDesignerRoutePropagation(input.id.trim()),
        authJson: JSON.stringify(input.authProfile ?? {}),
        experienceConfigJson: jsonOrNull(input.experienceConfig),
        source: input.source ?? 'manual',
      },
      registryActor,
    );

    await invalidateAfterMutation();
    return { statusCode: 201, body: { success: true as const, id: input.id.trim() } };
  }

  async updateMount(actor: ActorContext, id: string, input: UpdatePlatformMountPayload) {
    const current = await findPlatformMountById(id);
    if (!current) throw new HttpError(404, 'Mount not found.');

    const pathPrefix = input.pathPrefix != null
      ? normalizePathPrefix(input.pathPrefix)
      : current.pathPrefix;

    await updatePlatformMount(
      id,
      {
        pathPrefix,
        name: input.name?.trim() || current.name,
        enabled: input.enabled ?? current.enabled,
        defaultRoute: input.defaultRoute?.trim() || current.defaultRoute,
        themeScope: input.themeScope !== undefined ? input.themeScope : current.themeScope,
        designerRoutePropagation: input.designerRoutePropagation ?? current.designerRoutePropagation,
        authJson: JSON.stringify(input.authProfile ?? current.authProfile ?? {}),
        experienceConfigJson: input.experienceConfig !== undefined
          ? jsonOrNull(input.experienceConfig)
          : jsonOrNull(current.experienceConfig),
        source: input.source ?? current.source,
      },
      toRegistryActor(actor),
    );

    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }

  async deleteMount(id: string) {
    const current = await findPlatformMountById(id);
    if (!current) throw new HttpError(404, 'Mount not found.');

    await deletePlatformMount(id);
    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }

  async listShells() {
    return { body: { success: true as const, items: await listPlatformShellRows() } };
  }

  async getShell(shellKey: string) {
    const item = await findPlatformShellByKey(shellKey);
    if (!item) throw new HttpError(404, 'Shell not found.');
    return { body: { success: true as const, item } };
  }

  async createShell(actor: ActorContext, input: CreatePlatformShellPayload) {
    if (!input.shellKey?.trim()) throw new HttpError(400, 'shellKey is required.');
    if (!input.name?.trim()) throw new HttpError(400, 'name is required.');
    if (!input.entry?.trim()) throw new HttpError(400, 'entry is required.');
    if (!input.surface?.trim()) throw new HttpError(400, 'surface is required.');

    await insertPlatformShell(
      {
        shellKey: input.shellKey.trim(),
        name: input.name.trim(),
        entry: input.entry.trim(),
        surface: input.surface.trim(),
        enabled: input.enabled ?? true,
        navigationRef: input.navigationRef ?? null,
        source: input.source ?? 'manual',
      },
      toRegistryActor(actor),
    );

    await invalidateAfterMutation();
    return { statusCode: 201, body: { success: true as const, shellKey: input.shellKey.trim() } };
  }

  async updateShell(actor: ActorContext, shellKey: string, input: UpdatePlatformShellPayload) {
    const current = await findPlatformShellByKey(shellKey);
    if (!current) throw new HttpError(404, 'Shell not found.');

    await updatePlatformShell(
      shellKey,
      {
        name: input.name?.trim() || current.name,
        entry: input.entry?.trim() || current.entry,
        surface: input.surface?.trim() || current.surface,
        enabled: input.enabled ?? current.enabled,
        navigationRef: input.navigationRef ?? current.navigationRef ?? null,
        source: input.source ?? current.source,
      },
      toRegistryActor(actor),
    );

    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }

  async deleteShell(shellKey: string) {
    const current = await findPlatformShellByKey(shellKey);
    if (!current) throw new HttpError(404, 'Shell not found.');

    await deletePlatformShell(shellKey);
    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }

  async listPageModules() {
    return { body: { success: true as const, items: await listPlatformPageModuleRows() } };
  }

  async getPageModule(pageKey: string) {
    const item = await findPlatformPageModuleByKey(pageKey);
    if (!item) throw new HttpError(404, 'Page module not found.');
    return { body: { success: true as const, item } };
  }

  async createPageModule(actor: ActorContext, input: CreatePlatformPageModulePayload) {
    if (!input.pageKey?.trim()) throw new HttpError(400, 'pageKey is required.');
    if (!input.title?.trim()) throw new HttpError(400, 'title is required.');
    if (!input.loaderRef?.trim()) throw new HttpError(400, 'loaderRef is required.');

    let homeWidgets: ReturnType<typeof parseHomeWidgetsField>;
    try {
      homeWidgets = parseHomeWidgetsField(input.homeWidgets);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid homeWidgets.');
    }

    await insertPlatformPageModule(
      {
        pageKey: input.pageKey.trim(),
        title: input.title.trim(),
        loaderKind: input.loaderKind,
        loaderRef: input.loaderRef.trim(),
        defaultRolesJson: jsonOrNull(input.defaultRoles),
        enabled: input.enabled ?? true,
        homeWidgets,
        source: input.source ?? 'manual',
      },
      toRegistryActor(actor),
    );

    await invalidateAfterMutation();
    return { statusCode: 201, body: { success: true as const, pageKey: input.pageKey.trim() } };
  }

  async updatePageModule(
    actor: ActorContext,
    pageKey: string,
    input: UpdatePlatformPageModulePayload,
  ) {
    const current = await findPlatformPageModuleByKey(pageKey);
    if (!current) throw new HttpError(404, 'Page module not found.');

    let homeWidgets: ReturnType<typeof parseHomeWidgetsField>;
    try {
      homeWidgets = input.homeWidgets !== undefined
        ? parseHomeWidgetsField(input.homeWidgets)
        : undefined;
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid homeWidgets.');
    }

    await updatePlatformPageModule(
      pageKey,
      {
        title: input.title?.trim() || current.title,
        loaderKind: input.loaderKind ?? current.loaderKind,
        loaderRef: input.loaderRef?.trim() || current.loaderRef,
        defaultRolesJson: input.defaultRoles !== undefined
          ? jsonOrNull(input.defaultRoles)
          : jsonOrNull(current.defaultRoles),
        enabled: input.enabled ?? current.enabled,
        homeWidgets,
        source: input.source ?? current.source,
      },
      toRegistryActor(actor),
    );

    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }

  async deletePageModule(pageKey: string) {
    const current = await findPlatformPageModuleByKey(pageKey);
    if (!current) throw new HttpError(404, 'Page module not found.');

    await deletePlatformPageModule(pageKey);
    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }

  async listShellRules() {
    return { body: { success: true as const, items: await listPlatformShellRuleRows() } };
  }

  async getShellRule(id: number) {
    const item = await findPlatformShellRuleById(id);
    if (!item) throw new HttpError(404, 'Shell rule not found.');
    return { body: { success: true as const, item } };
  }

  async createShellRule(actor: ActorContext, input: CreatePlatformShellRulePayload) {
    if (!input.mountId?.trim()) throw new HttpError(400, 'mountId is required.');
    if (!input.pathPrefix?.trim()) throw new HttpError(400, 'pathPrefix is required.');
    if (!input.shellKey?.trim()) throw new HttpError(400, 'shellKey is required.');

    const mount = await findPlatformMountById(input.mountId.trim());
    if (!mount) throw new HttpError(400, 'mountId does not reference an existing mount.');

    const shell = await findPlatformShellByKey(input.shellKey.trim());
    if (!shell) throw new HttpError(400, 'shellKey does not reference an existing shell.');

    await insertPlatformShellRule(
      {
        mountId: input.mountId.trim(),
        pathPrefix: normalizePathPrefix(input.pathPrefix),
        shellKey: input.shellKey.trim(),
        priority: input.priority ?? 0,
        enabled: input.enabled ?? true,
        source: input.source ?? 'manual',
      },
      toRegistryActor(actor),
    );

    const created = await findLatestPlatformShellRuleId(
      input.mountId.trim(),
      normalizePathPrefix(input.pathPrefix),
      input.shellKey.trim(),
    );

    await invalidateAfterMutation();
    return { statusCode: 201, body: { success: true as const, id: Number(created?.id || 0) } };
  }

  async updateShellRule(
    actor: ActorContext,
    id: number,
    input: UpdatePlatformShellRulePayload,
  ) {
    const current = await findPlatformShellRuleById(id);
    if (!current) throw new HttpError(404, 'Shell rule not found.');

    const shellKey = input.shellKey?.trim() || current.shellKey;
    const shell = await findPlatformShellByKey(shellKey);
    if (!shell) throw new HttpError(400, 'shellKey does not reference an existing shell.');

    await updatePlatformShellRule(
      id,
      {
        pathPrefix: input.pathPrefix != null
          ? normalizePathPrefix(input.pathPrefix)
          : current.pathPrefix,
        shellKey,
        priority: input.priority ?? current.priority,
        enabled: input.enabled ?? current.enabled,
        source: input.source ?? current.source,
      },
      toRegistryActor(actor),
    );

    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }

  async deleteShellRule(id: number) {
    const current = await findPlatformShellRuleById(id);
    if (!current) throw new HttpError(404, 'Shell rule not found.');

    await deletePlatformShellRule(id);
    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }

  async listRouteBindings() {
    return { body: { success: true as const, items: await listPlatformRouteBindingRows() } };
  }

  async getRouteBinding(id: number) {
    const item = await findPlatformRouteBindingById(id);
    if (!item) throw new HttpError(404, 'Route binding not found.');
    return { body: { success: true as const, item } };
  }

  async createRouteBinding(actor: ActorContext, input: CreatePlatformRouteBindingPayload) {
    if (!input.mountId?.trim()) throw new HttpError(400, 'mountId is required.');
    if (!input.pageKey?.trim()) throw new HttpError(400, 'pageKey is required.');

    const mount = await findPlatformMountById(input.mountId.trim());
    if (!mount) throw new HttpError(400, 'mountId does not reference an existing mount.');

    const pageModule = await findPlatformPageModuleByKey(input.pageKey.trim());
    if (!pageModule) throw new HttpError(400, 'pageKey does not reference an existing page module.');

    const routePattern = normalizeRoutePattern(input.routePattern);

    await insertPlatformRouteBinding(
      {
        mountId: input.mountId.trim(),
        routePattern,
        pageKey: input.pageKey.trim(),
        enabled: input.enabled ?? true,
        authJson: jsonOrNull(input.auth),
        navJson: jsonOrNull(input.nav),
        source: input.source ?? 'manual',
      },
      toRegistryActor(actor),
    );

    const created = await findLatestPlatformRouteBindingId(input.mountId.trim(), routePattern);
    const createdBinding = created?.id
      ? await findPlatformRouteBindingById(created.id)
      : undefined;

    if (createdBinding && input.mountId.trim() === STUDIO_MOUNT_ID) {
      await propagateStudioRouteBinding(createdBinding, toRegistryActor(actor));
    }

    await invalidateAfterMutation();
    return { statusCode: 201, body: { success: true as const, id: Number(created?.id || 0) } };
  }

  async updateRouteBinding(
    actor: ActorContext,
    id: number,
    input: UpdatePlatformRouteBindingPayload,
  ) {
    const current = await findPlatformRouteBindingById(id);
    if (!current) throw new HttpError(404, 'Route binding not found.');

    const pageKey = input.pageKey?.trim() || current.pageKey;
    const pageModule = await findPlatformPageModuleByKey(pageKey);
    if (!pageModule) throw new HttpError(400, 'pageKey does not reference an existing page module.');

    await updatePlatformRouteBinding(
      id,
      {
        routePattern: input.routePattern != null
          ? normalizeRoutePattern(input.routePattern)
          : current.routePattern,
        pageKey,
        enabled: input.enabled ?? current.enabled,
        authJson: input.auth !== undefined ? jsonOrNull(input.auth) : jsonOrNull(current.auth),
        navJson: input.nav !== undefined ? jsonOrNull(input.nav) : jsonOrNull(current.nav),
        source: input.source ?? current.source,
      },
      toRegistryActor(actor),
    );

    if (current.mountId === STUDIO_MOUNT_ID) {
      const updated = await findPlatformRouteBindingById(id);
      if (updated) {
        await propagateStudioRouteBinding(updated, toRegistryActor(actor));
      }
    }

    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }

  async deleteRouteBinding(id: number) {
    const current = await findPlatformRouteBindingById(id);
    if (!current) throw new HttpError(404, 'Route binding not found.');

    if (current.mountId === STUDIO_MOUNT_ID) {
      await removePropagatedStudioRouteBinding(current);
    }

    await deletePlatformRouteBinding(id);
    await invalidateAfterMutation();
    return { body: { success: true as const } };
  }
}
