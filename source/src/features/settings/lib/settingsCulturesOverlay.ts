import { resolvePriorityOverlayToken } from '../../../shared/routing/resolvePriorityOverlayToken';

export const SETTINGS_CULTURES_OVERLAY_DIALOG_FORM = 'dialog/culture-form';
export const SETTINGS_CULTURES_OVERLAY_DIALOG_TRANSLATIONS = 'dialog/translations';

export function resolveSettingsCulturesOverlayToken(input: {
  formOpen: boolean;
  translationsOpen: boolean;
}): string | null {
  return resolvePriorityOverlayToken([
    { token: SETTINGS_CULTURES_OVERLAY_DIALOG_TRANSLATIONS, isOpen: input.translationsOpen, priority: 300 },
    { token: SETTINGS_CULTURES_OVERLAY_DIALOG_FORM, isOpen: input.formOpen, priority: 200 },
  ]);
}
