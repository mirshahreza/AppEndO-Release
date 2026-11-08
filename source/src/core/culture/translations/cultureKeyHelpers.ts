export function settingsSectionLabelKey(sectionId: string): string {
  return `settings.sections.${sectionId}`;
}

export function settingsSectionDescriptionKey(sectionId: string): string {
  return `settings.sections.${sectionId}.description`;
}

export function settingsScopeTitleKey(scope: 'platform' | 'node' | 'data-model'): string {
  return `settings.scope.${scope}.title`;
}

export function settingsScopeBadgeKey(scope: 'platform' | 'node' | 'data-model'): string {
  return `settings.scope.${scope}.badge`;
}

export function settingsScopeHintKey(scope: 'platform' | 'node' | 'data-model'): string {
  return `settings.scope.${scope}.hint`;
}

export function columnCommonKey(suffix: string): string {
  return `columns.common.${suffix}`;
}

export function authPublicKey(suffix: string): string {
  return `auth.public.${suffix}`;
}

export function columnsRolesKey(suffix: string): string {
  return `columns.roles.${suffix}`;
}

export function columnsPortalsKey(suffix: string): string {
  return `columns.portals.${suffix}`;
}

export function columnsPackagesKey(suffix: string): string {
  return `columns.packages.${suffix}`;
}

export function columnsMcpServersKey(suffix: string): string {
  return `columns.mcpServers.${suffix}`;
}

export function profileKey(suffix: string): string {
  return `profile.${suffix}`;
}

export function installKey(suffix: string): string {
  return `install.${suffix}`;
}

export function operationsKey(suffix: string): string {
  return `operations.${suffix}`;
}

export function errorsKey(suffix: string): string {
  return `errors.${suffix}`;
}

export function designerKey(suffix: string): string {
  return `designer.${suffix}`;
}
