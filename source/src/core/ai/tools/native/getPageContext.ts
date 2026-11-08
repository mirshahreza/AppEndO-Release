import { buildAiSystemContext } from '../../../../shared/api/contracts/ai/pageContext';
import type { NativeToolDefinition } from '../ToolRegistry';

export const GET_PAGE_CONTEXT_TOOL_NAME = 'get_page_context';

export const getPageContextTool: NativeToolDefinition = {
  name: GET_PAGE_CONTEXT_TOOL_NAME,
  description: 'Returns the current admin route context for this agent run (path, pageKey, designer selection, open server function, etc.). Use at the start of a turn when the user refers to "this page" or open studio context. Returns pageContext object and a narrative summary. Example: get_page_context({}).',
  group: 'read',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (_args, context) => {
    const pageContext = context.pageContext;
    if (!pageContext?.path?.trim()) {
      return {
        ok: false,
        summary: 'No page context was provided for this agent run.',
        error: 'missing_page_context',
      };
    }

    const narrative = buildAiSystemContext(pageContext, 'Current route context:');

    return {
      ok: true,
      summary: `Loaded page context for ${pageContext.pageLabel} (${pageContext.path}).`,
      data: {
        pageContext,
        narrative,
      },
    };
  },
};
