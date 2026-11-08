import { draftComponentLayoutTool } from '../../../../../core/ai/tools/native/draftComponentLayout';
import { draftApplicationScaffoldTool } from '../../../../../core/ai/tools/native/draftApplicationScaffold';
import { designerInsertPaletteItemTool } from '../../../../../core/ai/tools/native/designerInsertPaletteItem';
import { designerSetPropTool } from '../../../../../core/ai/tools/native/designerSetProp';
import { draftServerFunctionTool } from '../../../../../core/ai/tools/native/draftServerFunction';
import { draftDashboardWidgetTool } from '../../../../../core/ai/tools/native/draftDashboardWidget';
import type { BuiltinCapabilityPackRegistrar } from './types';

/** appendo-designer — layout drafts + designer MCP mutations (G14 · VC-5.1). */
export const registerDesignerPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  registry.register(draftComponentLayoutTool);
  registry.register(draftApplicationScaffoldTool);
  registry.register(draftServerFunctionTool);
  registry.register(designerInsertPaletteItemTool);
  registry.register(designerSetPropTool);
  registry.register(draftDashboardWidgetTool);
};
