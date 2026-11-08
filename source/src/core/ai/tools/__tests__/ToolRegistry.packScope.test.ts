import { describe, expect, it } from 'vitest';
import { getFeatureGraphTool } from '../native/getFeatureGraph';
import { getProjectStandardsTool } from '../native/getProjectStandards';
import { readFileTool } from '../native/readFile';
import { searchCodebaseTool } from '../native/searchCodebase';
import { createPhase1ToolRegistry } from '../ToolRegistry';
import { registerNativeTools } from '../native/registerNativeTools';
import {
  BUILTIN_CAPABILITY_PACK_REGISTRARS,
  registerBuiltinCapabilityPacks,
} from '../../../../server/services/ai/mcp/builtin';
import { AGENT_PACK_TOOL_GROUPS } from '../../../../server/services/ai/mcp/builtin/agentPackRuntime';
import type { AiCapabilityPackId } from '../../../../shared/api/contracts/ai/capabilityPacks';

const ALL_IMPLEMENTED_PACK_IDS = Object.keys(
  BUILTIN_CAPABILITY_PACK_REGISTRARS,
) as AiCapabilityPackId[];
const CORE_NAV_TOOLS = [
  readFileTool,
  searchCodebaseTool,
  getFeatureGraphTool,
  getProjectStandardsTool,
];

describe('TOK-14 tool schema slim', () => {
  it('core navigation tools use a single-line description within a reasonable budget', () => {
    // The original TOK-14 budget (72 chars) predates the GAP-15 tool-description-quality
    // pass (checklist: what it does / what it returns / when to use it / a short example —
    // see V4 corrective patch QW-3/D.1), which intentionally made these descriptions longer
    // and more useful to the model. 450 keeps a real ceiling against unbounded bloat while
    // not fighting an already-shipped, deliberate improvement.
    for (const tool of CORE_NAV_TOOLS) {
      expect(tool.description.length).toBeLessThanOrEqual(450);
      expect(tool.description).not.toContain('\n');
    }
  });

  it('listDefinitions(activePackIds) filters native tools to enabled packs', () => {
    const registry = createPhase1ToolRegistry('agent', AGENT_PACK_TOOL_GROUPS);
    registerNativeTools(registry);
    registerBuiltinCapabilityPacks(registry, ALL_IMPLEMENTED_PACK_IDS);

    const allCount = registry.listDefinitions().length;
    const standardsOnly = registry.listDefinitions({ activePackIds: ['appendo-standards'] });

    expect(standardsOnly.length).toBeLessThan(allCount);
    expect(standardsOnly.some((tool) => tool.name === 'get_project_standards')).toBe(true);
    expect(standardsOnly.some((tool) => tool.name === 'read_file')).toBe(false);
    expect(standardsOnly.some((tool) => tool.name === 'prune_tool_observations')).toBe(true);
  });
});
