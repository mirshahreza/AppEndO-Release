import { getPageContextTool } from '../../../../../core/ai/tools/native/getPageContext';
import { summarizeContextTool } from '../../../../../core/ai/tools/native/summarizeContext';
import { askClarifyingQuestionTool } from '../../../../../core/ai/tools/native/askClarifyingQuestion';
import { updateTodoListTool } from '../../../../../core/ai/tools/native/updateTodoList';
import { proposeHypothesisTool } from '../../../../../core/ai/tools/native/proposeHypothesis';
import type { BuiltinCapabilityPackRegistrar } from './types';

/** appendo-context — get_page_context · summarize_context · ask_clarifying_question (C.1) · update_todo_list (F.1) · propose_hypothesis (V5 P02). */
export const registerContextPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  registry.register(getPageContextTool);
  registry.register(summarizeContextTool);
  registry.register(askClarifyingQuestionTool);
  registry.register(updateTodoListTool);
  registry.register(proposeHypothesisTool);
};
