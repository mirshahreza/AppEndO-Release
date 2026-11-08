import type { TemplateNodeSeed } from '../types';
import { getBuiltInPresetId } from './builtInComponents';
import { getTemplateForPreset } from './newLayoutPresets';

export const resolveBuiltInTemplateSeeds = (componentId: string): TemplateNodeSeed[] | null => {
  const presetId = getBuiltInPresetId(componentId);
  if (!presetId) {
    return null;
  }

  const template = getTemplateForPreset(presetId);
  return template.length > 0 ? template : null;
};
