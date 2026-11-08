import type { AiPageContext } from '../../../../shared/api/contracts/ai/pageContext';
import type { ToolExecutionContext } from '../types';

export const testToolExecutionContext: ToolExecutionContext = {
  mode: 'agent',
  allowedGroups: [],
};

export const testAiPageContext = (
  overrides: Partial<AiPageContext> & Pick<AiPageContext, 'path'>,
): AiPageContext => ({
  pageLabel: 'Test page',
  ...overrides,
});
