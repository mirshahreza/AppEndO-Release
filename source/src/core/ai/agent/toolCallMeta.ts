/** Reserved tool arg — stripped before execute; shown as activity intention (F.2). */
export const TOOL_CALL_INTENTION_KEY = '_intention';

export const extractToolCallIntention = (args: Record<string, unknown> | undefined): string | undefined => {
  if (!args) return undefined;
  const raw = args[TOOL_CALL_INTENTION_KEY] ?? args.intention;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
};

export const stripToolCallMetaArgs = (args: Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!args || typeof args !== 'object') return {};
  const { [TOOL_CALL_INTENTION_KEY]: _ignored, intention: _ignoredIntention, ...rest } = args;
  return rest;
};
