import { TRANSLATION_BASE_EN } from './baseEn';
import { TRANSLATION_EXTENSIONS_EN } from './extensionsEn';
import { AUTH_PUBLIC_EN } from './authPublicEn';
import { PROFILE_EN } from './profileEn';
import { INSTALL_EN } from './installEn';
import { OPERATIONS_EN } from './operationsEn';
import { COMPONENT_DESIGNER_EN } from './componentDesignerEn';
import { COMPONENT_DESIGNER_PRESETS_EN } from './componentDesignerPresetsEn';
import { FEEDBACK_EN } from './feedbackEn';
import { SSH_HUB_EN } from './sshHubEn';
import { RDP_HUB_EN } from './rdpHubEn';
import { FILE_HUB_EN } from './fileHubEn';

export const BUILTIN_TRANSLATION_MASTER_EN: Record<string, string> = {
  ...TRANSLATION_BASE_EN,
  ...TRANSLATION_EXTENSIONS_EN,
  ...AUTH_PUBLIC_EN,
  ...PROFILE_EN,
  ...INSTALL_EN,
  ...OPERATIONS_EN,
  ...COMPONENT_DESIGNER_EN,
  ...COMPONENT_DESIGNER_PRESETS_EN,
  ...FEEDBACK_EN,
  ...SSH_HUB_EN,
  ...RDP_HUB_EN,
  ...FILE_HUB_EN,
};

export function listMasterTranslationKeys(): string[] {
  return Object.keys(BUILTIN_TRANSLATION_MASTER_EN).sort((left, right) => left.localeCompare(right));
}
