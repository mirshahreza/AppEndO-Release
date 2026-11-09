import type { TranslationFn } from './TranslationRuntime';
import { PAGE_GUIDE_EN } from './translations/pageGuideEn';

export function navLabelKey(pageKey: string): string {
  return `nav.${pageKey}`;
}

/** Culture `nav.{pageKey}` when present; otherwise `null` (keep manifest nav label in shell merge). */
export function tryResolveNavLabel(
  t: TranslationFn | undefined,
  pageKey: string,
): string | null {
  if (!t) {
    return null;
  }

  const key = navLabelKey(pageKey);
  const translated = t(key, { missing: 'silent' });
  const text = translated != null ? String(translated).trim() : '';
  return text !== '' && text !== key ? text : null;
}

/** Culture `nav.{pageKey}`, or `fallback` when the key is missing (t returns the key). */
export function resolveNavLabel(
  t: TranslationFn | undefined,
  pageKey: string,
  fallback: string,
): string {
  const cultureLabel = tryResolveNavLabel(t, pageKey);
  if (cultureLabel) {
    return cultureLabel;
  }
  return fallback;
}

/** Culture lookup with English fallback when the key is missing (t would echo the key). */
export function resolveCultureLabel(
  t: TranslationFn | undefined,
  key: string,
  fallback: string,
): string {
  if (!t) {
    return fallback;
  }
  const translated = t(key, { missing: 'silent' });
  const text = translated != null ? String(translated).trim() : '';
  return text !== '' && text !== key ? text : fallback;
}

export function navDescriptionKey(pageKey: string): string {
  return `nav.${pageKey}.description`;
}

export function navGroupKey(groupHeading: string): string {
  return `nav.group.${groupHeading.toLowerCase()}`;
}

export const CULTURE_ACTION_INTENT_KEYS: Record<string, string> = {
  primary: 'actions.save',
  create: 'actions.create',
  cancel: 'actions.cancel',
  destructive: 'actions.delete',
  confirm: 'actions.confirm',
  secondary: 'actions.upload',
  utility: 'actions.refresh',
};

export const CULTURE_SHELL_FALLBACK_LABELS: Record<string, string> = {
  'shell.portalDashboard': 'Portal Dashboard',
  'shell.welcome': 'Welcome to AppEnd Administrative panel.',
  'shell.toggleAi': 'Toggle AI Copilot',
  'shell.openAppendo': 'Open AppEndO',
  'shell.closeAppendo': 'Close AppEndO',
  'shell.switchApplication': 'Switch portal',
  'shell.openAccount': 'Open Account Menu',
  'shell.profileChromeMenu': 'Display and layout',
  'shell.accentColor': 'Accent color',
  'shell.enterFullscreen': 'Enter Fullscreen',
  'shell.exitFullscreen': 'Exit Fullscreen',
  'shell.expandPageWidth': 'Expand page width',
  'shell.restorePageWidth': 'Restore page width',
  'pageGuide.chrome.pageWidth.hint': 'Temporarily use the full viewport width while keeping the app chrome. Your choice lasts for this browser tab.',
  'shell.pageLoadFailed': 'This page failed to load',
  ...PAGE_GUIDE_EN,
};

export const CULTURE_ACTION_FALLBACK_LABELS: Record<string, string> = {
  'actions.save': 'Save',
  'actions.cancel': 'Cancel',
  'actions.create': 'Create',
  'actions.edit': 'Edit',
  'actions.delete': 'Delete',
  'actions.confirm': 'Confirm',
  'actions.close': 'Close',
  'actions.refresh': 'Refresh',
  'actions.filter': 'Filter',
  'actions.apply': 'Apply',
  'actions.clearFilter': 'Clear filter',
  'actions.upload': 'Upload',
  'actions.saveChanges': 'Save Changes',
  'actions.saving': 'Saving...',
  'actions.saved': 'Saved!',
  'actions.applyValues': 'Apply Values',
  'actions.applying': 'Applying...',
  'actions.applied': 'Applied!',
  'actions.lock': 'Lock',
  'actions.unlock': 'Unlock',
  'feedback.saved': 'Saved successfully',
  'feedback.error': 'Something went wrong',
  'feedback.userCreated': 'User created successfully.',
  'feedback.profileUpdated': 'Profile updated successfully.',
  'feedback.rolesUpdated': 'Roles updated successfully.',
  'feedback.attributesUpdated': 'Attributes updated successfully.',
  'feedback.passwordChanged': 'Password changed successfully.',
  'feedback.userDeleted': 'User deleted successfully.',
  'feedback.userLocked': 'User locked.',
  'feedback.userUnlocked': 'User unlocked.',
  'feedback.networkError': 'Network error.',
  'toolbar.addUser': 'Add User',
  'toolbar.addIndividualUser': 'Add Individual',
  'toolbar.addCompanyUser': 'Add Company',
  'toolbar.searchUsers': 'email, username, profile, role, id',
  'users.deleteTitle': 'Delete User',
  'users.deleteQuestion': 'Are you sure you want to delete this user?',
  'users.deleteWarning': 'This action cannot be undone.',
  'users.lockTitle': 'Lock User',
  'users.unlockTitle': 'Unlock User',
  'users.lockQuestion': 'Are you sure you want to lock this user?',
  'users.unlockQuestion': 'Are you sure you want to unlock this user?',
  'users.lockWarning': 'The user will not be able to sign in until unlocked.',
  'users.unlockWarning': 'The user will be able to sign in again.',
  'users.lockProcessing': 'Locking…',
  'users.unlockProcessing': 'Unlocking…',
  'settings.directSaveNote': 'Changes are saved directly to the database.',
  'grid.showingEmpty': 'Showing 0-0 of 0',
  'grid.showingRange': 'Showing {start}-{end} of {total}',
  'grid.infiniteRange': 'Showing {visible} of {total}',
  'grid.pageSizeLabel': '{size} / page',
  'grid.paging': 'Paging',
  'grid.infinite': 'Infinite',
  'grid.first': 'First',
  'grid.prev': 'Prev',
  'grid.next': 'Next',
  'grid.last': 'Last',
  'grid.itemsPerPage': 'Items per page',
  'grid.orderBy': 'Order by',
  'grid.sortAscending': 'Sort ascending',
  'grid.sortDescending': 'Sort descending',
  'grid.sortAscShort': 'Ascending',
  'grid.sortDescShort': 'Descending',
  'grid.listMode': 'List mode',
  'grid.moreOptions': 'More options',
  'grid.rowCount': '{count} rows',
};
