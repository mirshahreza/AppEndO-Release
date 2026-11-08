import type { AgentStreamEvent, ChangeSet } from '../../../shared/api/contracts/ai/agentTypes';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export function readSourceFromFunctionPatch(changeSet: ChangeSet): string {
  if (changeSet.kind !== 'function_source_patch') {
    return '';
  }
  const patch = isRecord(changeSet.patch) ? changeSet.patch : {};
  return typeof patch.source === 'string' ? patch.source.trim() : '';
}

export function readSourceFromDraftServerFunctionArgs(args: Record<string, unknown>): string {
  return typeof args.source === 'string' ? args.source.trim() : '';
}

export type ServerFunctionAgentApplyCollector = {
  ingest: (event: AgentStreamEvent) => void;
  source: () => string;
};

/** Latest drafted handler source from a proposal, or from draft_server_function tool args. */
export function createServerFunctionAgentApplyCollector(): ServerFunctionAgentApplyCollector {
  let proposalSource = '';
  let draftToolSource = '';

  return {
    ingest(event) {
      if (event.type === 'proposal') {
        const sources = event.changeSets.map(readSourceFromFunctionPatch).filter(Boolean);
        if (sources.length > 0) {
          proposalSource = sources[sources.length - 1] ?? '';
        }
        return;
      }
      if (event.type === 'tool_start' && event.name === 'draft_server_function') {
        const source = readSourceFromDraftServerFunctionArgs(event.args);
        if (source) {
          draftToolSource = source;
        }
      }
    },
    source: () => proposalSource || draftToolSource,
  };
};
