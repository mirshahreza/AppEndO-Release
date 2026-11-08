import { BASE_ROLES, RETIRED_ROLE_NAMES } from './constants';

export const isBaseRole = (name: string): boolean => (
  (BASE_ROLES as readonly string[]).includes(
    String(name).toUpperCase() as (typeof BASE_ROLES)[number],
  )
);

export const isRetiredRoleName = (name: string): boolean => (
  (RETIRED_ROLE_NAMES as readonly string[]).includes(name.toUpperCase() as typeof RETIRED_ROLE_NAMES[number])
);

export const filterActiveRoleNames = (names: ReadonlyArray<string>): string[] => (
  Array.from(new Set(
    names
      .map((name) => String(name).toUpperCase())
      .filter((name) => name && !isRetiredRoleName(name)),
  ))
);

export const sortRoleNamesForDisplay = (roles: ReadonlyArray<string>): string[] => {
  const unique = Array.from(new Set(
    roles.map((role) => String(role).toUpperCase()).filter(Boolean),
  ));
  const adminRoles = unique.filter((role) => role === 'ADMIN');
  const otherRoles = unique
    .filter((role) => role !== 'ADMIN')
    .sort((left, right) => left.localeCompare(right));
  return [...adminRoles, ...otherRoles];
};

/** Role picker options: active catalog roles plus any roles already assigned to the user. */
export const mergeRolePickerOptions = (
  catalogRoles: ReadonlyArray<string>,
  assignedRoles: ReadonlyArray<string>,
): string[] => sortRoleNamesForDisplay([
  ...filterActiveRoleNames(catalogRoles),
  ...assignedRoles
    .map((role) => String(role).toUpperCase())
    .filter(Boolean),
]);

export const isAdminRoleName = (name: string): boolean => name.toUpperCase() === 'ADMIN';
