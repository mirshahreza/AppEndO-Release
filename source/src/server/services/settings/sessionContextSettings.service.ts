import {
  attributeSessionSourceId,
  buildRecordScopeSourceEntries,
  buildShellIdentitySourceEntries,
  buildSystemCapabilitySourceEntries,
  channelsFromVisibility,
  parseAttributeSessionSourceId,
  parseProfileSessionSourceId,
  parseUserAccountSessionSourceId,
  profileSessionSourceId,
  SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELD_SET,
  SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET,
  SESSION_CONTEXT_SYSTEM_SOURCE_IDS,
  USER_ACCOUNT_CONTEXT_FIELDS,
  userAccountSessionSourceId,
  visibilityFromChannels,
  type SessionContextBlob,
  type SessionContextSettingsResponse,
  type SessionContextSettingsSaveEntry,
  type SessionContextSourceEntry,
  type SessionContextSourceGroup,
  type UpdateSessionContextSettingsPayload,
} from '../../../shared/api/contracts/settings/sessionContext';
import {
  listSettingsAttributeRows,
  updateSettingsAttributeVisibility,
  type SettingsAttributeRow,
} from '../../domain/attributes/settingsAttributesRepository';
import {
  listProfileFieldSettingRows,
  upsertProfileFieldSetting,
} from '../../domain/profile/profileFieldSettingsRepository';
import {
  getSessionContextBlob,
  upsertSessionContextBlob,
} from '../../domain/settings/sessionContextSettingsRepository';
import { HttpError } from '../../errors/HttpError';
import type { ActorContext } from '../../types/requestContext';
import { actorId } from '../users/shared';
import {
  getProfileFieldLabel,
  loadConfigurableProfileFields,
} from '../attributes/profileFields';
import { DEFAULT_ATTRIBUTE_USER_EDIT_POLICY } from '../../../shared/api/contracts/attributes/editPolicy';
import { invalidateAllSessionContexts } from '../attributes/sessionContextCache';

const toAttributeEntry = (row: SettingsAttributeRow): SessionContextSourceEntry => {
  const channels = channelsFromVisibility(row.visibility);
  const locked = row.is_builtin;
  return {
    id: attributeSessionSourceId(row.scope, row.key),
    kind: row.scope === 'USER' ? 'user_attribute' : 'role_attribute',
    label: row.label?.trim() || row.key,
    description: locked
      ? 'Built-in attribute. Context channels are fixed by the platform.'
      : `Attribute key: ${row.key}`,
    contextKey: `${row.scope === 'USER' ? 'user' : 'role'}.${row.key}`,
    server: channels.server,
    client: channels.client,
    locked,
    lockedReason: locked ? 'Built-in attribute' : undefined,
  };
};

const buildGroups = async (
  blob: SessionContextBlob,
): Promise<SessionContextSourceGroup[]> => {
  const [userAttributes, roleAttributes, profileDefinitions, profileRows] = await Promise.all([
    listSettingsAttributeRows('USER'),
    listSettingsAttributeRows('ROLE'),
    loadConfigurableProfileFields(),
    listProfileFieldSettingRows(),
  ]);
  const profileRowByField = new Map(profileRows.map((row) => [row.profile_field, row]));

  const userAccountEntries: SessionContextSourceEntry[] = USER_ACCOUNT_CONTEXT_FIELDS
    .filter((field) => !SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELD_SET.has(field.field))
    .map((field) => {
      const stored = blob.userAccount[field.field];
      return {
        id: userAccountSessionSourceId(field.field),
        kind: 'user_account' as const,
        label: field.label,
        description: `Users table field \`${field.field}\`.`,
        contextKey: field.contextKey,
        server: stored?.server === true,
        client: stored?.client === true,
        locked: false,
      };
    });

  const profileEntries: SessionContextSourceEntry[] = profileDefinitions
    .filter((definition) => !SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET.has(definition.profileField))
    .map((definition) => {
      const row = profileRowByField.get(definition.profileField);
      const channels = channelsFromVisibility(row?.visibility ?? 'NONE');
      const effective = row?.is_active ? channels : { server: false, client: false };
      return {
        id: profileSessionSourceId(definition.profileField),
        kind: 'profile_field' as const,
        label: definition.label || getProfileFieldLabel(definition.profileField),
        description: `Profile field \`${definition.profileField}\`.`,
        contextKey: `user.${row?.context_key ?? definition.profileField}`,
        server: effective.server,
        client: effective.client,
        locked: false,
      };
    });

  return [
    {
      id: 'shell_identity',
      title: 'Shell identity (system)',
      description:
        'Always included for header chrome: username, email, first name, last name, and profile image stay locked with both channels checked.',
      entries: buildShellIdentitySourceEntries(),
    },
    {
      id: 'system',
      title: 'System (built-in)',
      description: 'Always included. Administrators cannot change these channels.',
      entries: buildSystemCapabilitySourceEntries(),
    },
    {
      id: 'record_scope',
      title: 'Record scope (system)',
      description:
        'Built-in org / geo membership node ids. Always on server context for Record Policy predicates.',
      entries: buildRecordScopeSourceEntries(),
    },
    {
      id: 'user_account',
      title: 'User account fields',
      description: 'Optional Users-table columns beyond locked shell identity (for example mobile).',
      entries: userAccountEntries,
    },
    {
      id: 'profile_field',
      title: 'Profile fields',
      description: 'Optional profile fields beyond locked shell identity (first name, last name, and profile image are not listed here).',
      entries: profileEntries,
    },
    {
      id: 'user_attribute',
      title: 'User attributes',
      description: 'Custom and built-in user attribute definitions.',
      entries: userAttributes.map(toAttributeEntry),
    },
    {
      id: 'role_attribute',
      title: 'Role attributes',
      description: 'Custom attribute definitions attached to roles.',
      entries: roleAttributes.map(toAttributeEntry),
    },
  ];
};

export async function listSessionContextSettings(): Promise<{ body: SessionContextSettingsResponse }> {
  const blob = await getSessionContextBlob();
  const groups = await buildGroups(blob);
  return { body: { success: true, groups } };
}

const parseSavePayload = (payload: unknown): UpdateSessionContextSettingsPayload['entries'] => {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { entries?: unknown }).entries)) {
    throw new HttpError(400, 'entries array is required.');
  }

  const entries: SessionContextSettingsSaveEntry[] = [];
  const seen = new Set<string>();

  for (const raw of (payload as { entries: unknown[] }).entries) {
    if (!raw || typeof raw !== 'object') {
      throw new HttpError(400, 'Each entry must be an object.');
    }
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? '').trim();
    if (!id) {
      throw new HttpError(400, 'Each entry requires an id.');
    }
    if (seen.has(id)) {
      throw new HttpError(400, `Duplicate entry id "${id}".`);
    }
    seen.add(id);
    entries.push({
      id,
      server: item.server === true,
      client: item.client === true,
    });
  }

  return entries;
};

export async function saveSessionContextSettings(actor: ActorContext, payload: unknown) {
  const entries = parseSavePayload(payload);
  const currentActorId = actorId(actor);
  const blob = await getSessionContextBlob();
  const nextUserAccount: SessionContextBlob['userAccount'] = { ...blob.userAccount };

  const [userAttributes, roleAttributes, profileDefinitions, profileRows] = await Promise.all([
    listSettingsAttributeRows('USER'),
    listSettingsAttributeRows('ROLE'),
    loadConfigurableProfileFields(),
    listProfileFieldSettingRows(),
  ]);
  const attributeBySourceId = new Map<string, SettingsAttributeRow>();
  for (const row of [...userAttributes, ...roleAttributes]) {
    attributeBySourceId.set(attributeSessionSourceId(row.scope, row.key), row);
  }
  const profileByField = new Map(profileRows.map((row) => [row.profile_field, row]));
  const allowedProfileFields = new Set(profileDefinitions.map((field) => field.profileField));
  const allowedUserAccountFields = new Set(USER_ACCOUNT_CONTEXT_FIELDS.map((field) => field.field));

  for (const entry of entries) {
    if (
      entry.id === SESSION_CONTEXT_SYSTEM_SOURCE_IDS.roles
      || entry.id === SESSION_CONTEXT_SYSTEM_SOURCE_IDS.functionAccess
      || entry.id.startsWith('system:')
    ) {
      continue;
    }

    const userField = parseUserAccountSessionSourceId(entry.id);
    if (userField) {
      if (SESSION_CONTEXT_SYSTEM_ACCOUNT_FIELD_SET.has(userField)) {
        continue;
      }
      if (!allowedUserAccountFields.has(userField as typeof USER_ACCOUNT_CONTEXT_FIELDS[number]['field'])) {
        throw new HttpError(400, `Unknown user account field "${userField}".`);
      }
      nextUserAccount[userField] = { server: entry.server, client: entry.client };
      continue;
    }

    const profileField = parseProfileSessionSourceId(entry.id);
    if (profileField) {
      if (SESSION_CONTEXT_SYSTEM_PROFILE_FIELD_SET.has(profileField)) {
        continue;
      }
      if (!allowedProfileFields.has(profileField)) {
        throw new HttpError(400, `Unknown profile field "${profileField}".`);
      }
      const definition = profileDefinitions.find((item) => item.profileField === profileField);
      const existing = profileByField.get(profileField) ?? null;
      const visibility = visibilityFromChannels(entry.server, entry.client);
      const either = entry.server || entry.client;
      await upsertProfileFieldSetting({
        profileField,
        contextKey: existing?.context_key ?? profileField,
        labelEn: existing?.label_en ?? definition?.label ?? getProfileFieldLabel(profileField),
        isActive: either ? true : (existing?.is_active ?? false),
        userEditPolicy: existing?.user_edit_policy ?? DEFAULT_ATTRIBUTE_USER_EDIT_POLICY,
        visibility,
        viewOrder: existing?.view_order ?? definition?.viewOrder ?? 0,
      }, currentActorId);
      continue;
    }

    const attributeRef = parseAttributeSessionSourceId(entry.id);
    if (attributeRef) {
      const row = attributeBySourceId.get(entry.id);
      if (!row) {
        throw new HttpError(400, `Unknown attribute "${entry.id}".`);
      }
      if (row.is_builtin) {
        continue;
      }
      const visibility = visibilityFromChannels(entry.server, entry.client);
      if (row.visibility === visibility) {
        continue;
      }
      await updateSettingsAttributeVisibility(row.id, visibility, currentActorId);
      continue;
    }

    throw new HttpError(400, `Unsupported session context source "${entry.id}".`);
  }

  await upsertSessionContextBlob({ version: 1, userAccount: nextUserAccount }, currentActorId);
  await invalidateAllSessionContexts();

  const groups = await buildGroups({ version: 1, userAccount: nextUserAccount });
  return {
    body: {
      success: true as const,
      groups,
    },
  };
}

export type { SessionContextBlob };
