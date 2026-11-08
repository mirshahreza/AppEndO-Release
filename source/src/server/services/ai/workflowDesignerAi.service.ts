import type { ChatMessage } from '../../../core/ai/IAiProvider';
import { aiManager } from '../../../core/ai/AiManager';
import { HttpError } from '../../errors/HttpError';
import { resolveFieldAssistChatModelId } from './fieldAssistModelResolver';
import { workflowDraftOperationListSchema } from '../../domain/workflow/awm/draftOperations';
import type { z } from 'zod';

type ValidatedWorkflowDraftOperation = z.infer<typeof workflowDraftOperationListSchema>[number];

/**
 * p-99/WFT-12 — a scoped, independent slice of natural-language workflow authoring, built without
 * waiting for the full AppEndoo-agent-reliability rework (p-98). Rather than reuse that (currently
 * unreliable) general-purpose agent loop, this stays on the same simple, non-agentic
 * `aiManager.processChat` pattern already proven for File Hub/SQL Console/SSH Hub, and asks the model
 * to emit a tightly-closed operation vocabulary — the exact same `WorkflowDraftOperation` union
 * (`awm/draftOperations.ts`) the Designer's own manual node/edge editing already produces and the
 * server already validates on Save. Safety comes from three independent layers, not from the model
 * being trustworthy: (1) `workflowDraftOperationListSchema.safeParse` here rejects any malformed
 * proposal before it ever reaches the client — an invalid proposal silently becomes a text-only
 * reply; (2) the client only ever *stages* accepted operations into the same local-preview +
 * pending-operations queue every manual edit uses (`queueOps` in `WorkflowEditorWorkspace.tsx`) —
 * nothing is written to the draft in the database until the operator's own explicit Save; (3) Save
 * still runs the exact same server-side structural/expression validation as any hand-built edit
 * before Publish. The model never writes anything directly, and a bad proposal is exactly as
 * reversible as a bad manual edit (discard local changes, or just don't click Save).
 */

const MAX_SNAPSHOT_CHARS = 8_000;
const MAX_HISTORY_ITEMS = 20;
const MAX_PROMPT_CHARS = 4_000;
const MAX_OPERATIONS = 20;

const WORKFLOW_DESIGNER_ASSIST_SYSTEM = `You are a workflow design assistant inside AppEndO's Workflow Designer.
The operator is editing a workflow definition. You can see a snapshot of its current nodes, edges, and whether the workflow is read-only (published).

Reply with a single JSON object only, no markdown fences around it:
{"text":"short explanation for the operator","operations":[]}

Rules:
- Put your explanation in "text" — reference real node keys and Action keys from the snapshot, not generic advice.
- "operations" is an array of WorkflowDraftOperation objects to propose (may be empty). Each one is rendered to the operator as a reviewable change they must explicitly approve before anything is touched — you never apply anything yourself.
- If the workflow is read-only, or the request is just a question, or the request is too complex/ambiguous to express safely in these operations, return an empty "operations" array and explain in text instead (e.g. suggest the manual steps, or ask a clarifying question).
- Every operation needs "operationSchemaVersion":"1" plus its "type" and payload. Supported types:
  - {"operationSchemaVersion":"1","type":"ADD_NODE","node":{...}}
  - {"operationSchemaVersion":"1","type":"MODIFY_NODE","nodeKey":"<existing key>","replacement":{...}}
  - {"operationSchemaVersion":"1","type":"REMOVE_NODE","nodeKey":"<existing key>"}
  - {"operationSchemaVersion":"1","type":"ADD_EDGE","edge":{...}}
  - {"operationSchemaVersion":"1","type":"REMOVE_EDGE","edgeKey":"<existing key>"}
- A node is {"kind":"<KIND>","key":"<new unique key>", ...kind-specific fields}. An edge is {"key":"<new unique key>","fromNodeKey":"...","toNodeKey":"...","selector":{"type":"..."}}.
- The most common edge selector is {"type":"UNCONDITIONAL"} — the plain "next step" link out of ACTION/DELAY/WAIT_EVENT/SUBFLOW/PARALLEL_SPLIT/PARALLEL_JOIN/FOR_EACH/LOOP nodes. A DECISION node's branches use {"type":"DECISION","condition":{...}} (or {"type":"DECISION_DEFAULT"}); a SWITCH node's branches use {"type":"SWITCH_CASE","value":...} (or {"type":"SWITCH_DEFAULT"}).
- Node shape examples (fill in real values, keep the same field names):
  ACTION: {"kind":"ACTION","key":"send-email-1","actionRef":{"type":"EXACT_PROVIDER","action":{"actionKey":"text.template","actionVersion":"1"},"providerId":"core","providerVersion":"1"},"config":{"type":"OBJECT","fields":{}},"input":{"type":"OBJECT","fields":{}}}
  END: {"kind":"END","key":"end-1","output":{"type":"OBJECT","fields":{}}}
  FAIL: {"kind":"FAIL","key":"fail-1","errorCode":{"op":"LITERAL","value":"WORKFLOW_FAILED"},"safeMessage":{"op":"LITERAL","value":"The workflow could not complete."}}
  DELAY: {"kind":"DELAY","key":"delay-1","delay":{"type":"DURATION_MS","value":{"op":"LITERAL","value":60000}}}
  DECISION: {"kind":"DECISION","key":"decision-1","mode":"EXACT_ONE"}
- Only propose ADD_NODE/ADD_EDGE for node kinds you are confident about the shape of; when unsure, describe the change in text instead of guessing a malformed operation.
- Never invent a real Action key you have not seen in the snapshot's action catalog; "text.template" is always safe as a placeholder the operator can swap.
- Keep "operations" small and focused on exactly what was asked — do not restructure unrelated parts of the workflow.`;

type AssistHistoryItem = { role: 'user' | 'assistant'; content: string };

const normalizeHistory = (value: unknown): AssistHistoryItem[] => {
  if (!Array.isArray(value)) return [];
  const items: AssistHistoryItem[] = [];
  for (const entry of value.slice(-MAX_HISTORY_ITEMS)) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as { role?: unknown; content?: unknown };
    if ((record.role !== 'user' && record.role !== 'assistant') || typeof record.content !== 'string') continue;
    const content = record.content.trim();
    if (!content) continue;
    items.push({ role: record.role, content });
  }
  return items;
};

const clipSnapshot = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\0/g, '');
  if (trimmed.length <= MAX_SNAPSHOT_CHARS) return trimmed;
  return trimmed.slice(trimmed.length - MAX_SNAPSHOT_CHARS);
};

const extractJsonObject = (raw: string): string | null => {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return candidate.slice(start, end + 1);
};

/**
 * Parses the model's `{"text":..., "operations":[...]}` envelope and validates every proposed
 * operation against the exact same closed `WorkflowDraftOperation` zod schema the server enforces
 * for a real, manually-built edit. A malformed envelope, or any operation that fails validation,
 * degrades to a text-only reply — the model's output is never trusted enough to reach the client
 * unvalidated.
 */
const parseWorkflowAssistResponse = (raw: string): { text: string; operations: ValidatedWorkflowDraftOperation[] } => {
  const trimmed = raw.trim();
  if (!trimmed) return { text: '', operations: [] };

  const jsonText = extractJsonObject(trimmed);
  if (!jsonText) return { text: trimmed, operations: [] };

  try {
    const parsed = JSON.parse(jsonText) as { text?: unknown; operations?: unknown };
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    const candidateOperations = Array.isArray(parsed.operations) ? parsed.operations.slice(0, MAX_OPERATIONS) : [];
    const result = workflowDraftOperationListSchema.safeParse(candidateOperations);
    const operations = result.success ? result.data : [];
    return { text: text || trimmed, operations };
  } catch {
    return { text: trimmed, operations: [] };
  }
};

export class WorkflowDesignerAiService {
  async assist(params: {
    prompt: unknown;
    workflowSnapshot?: unknown;
    modelId?: unknown;
    history?: unknown;
  }) {
    const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
    if (!prompt) {
      throw new HttpError(400, 'prompt is required.');
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      throw new HttpError(400, `prompt exceeds ${MAX_PROMPT_CHARS} characters.`);
    }

    const settings = aiManager.getSettings();
    if (!settings?.enabled) {
      throw new HttpError(503, 'AI is disabled in platform settings.');
    }

    const requestedModelId = typeof params.modelId === 'string' ? params.modelId.trim() : '';
    const modelId = resolveFieldAssistChatModelId(settings, requestedModelId || undefined);
    if (!modelId) {
      throw new HttpError(400, 'No chat-capable AI model is configured.');
    }

    const snapshot = clipSnapshot(params.workflowSnapshot);
    const history = normalizeHistory(params.history);
    const userContent = [
      'Current workflow snapshot (nodes and edges):',
      '```json',
      snapshot || '(empty)',
      '```',
      '',
      'Operator request:',
      prompt,
    ].join('\n');

    const messages: ChatMessage[] = [
      ...history.map((item) => ({ role: item.role, content: item.content })),
      { role: 'user', content: userContent },
    ];

    const raw = await aiManager.processChat(messages, modelId, WORKFLOW_DESIGNER_ASSIST_SYSTEM);
    const parsed = parseWorkflowAssistResponse(raw);

    return { body: { text: parsed.text, operations: parsed.operations, modelId } };
  }
}
