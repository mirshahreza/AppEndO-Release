import { searchCodebaseTool } from '../../../../../core/ai/tools/native/searchCodebase';
import { getFeatureGraphTool } from '../../../../../core/ai/tools/native/getFeatureGraph';
import type { BuiltinCapabilityPackRegistrar } from './types';

/** appendo-codebase — search_codebase + get_feature_graph navigation lookup. */
export const registerCodebasePackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  registry.register(searchCodebaseTool);
  registry.register(getFeatureGraphTool);
};
