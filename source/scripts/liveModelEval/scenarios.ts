import type { AgentMode, AgentPlanActMode } from '../../src/shared/api/contracts/ai/agentTypes';

export type LiveEvalScenario = {
  id: string;
  label: string;
  mode: AgentMode;
  prompt: string;
  /** What we expect the FIRST tool call to be (loose check — name only), when meaningful. */
  expectedFirstToolNames?: string[];
  /**
   * p-102-followup — tool names that must appear SOMEWHERE in the run (not just first), in any
   * order. Unlike `expectedFirstToolNames` this catches "investigated but never actually acted"
   * regressions in a multi-tool-call turn, where the first call is a legitimate read/search but a
   * later required draft/write call never happens.
   */
  expectedToolNamesAnywhere?: string[];
  /** Whether a successful run of this scenario should end in a proposal (draft → changeSet). */
  expectsProposal: boolean;
  /** Marks the deliberate-failure/recovery scenario (p-98 section 8). */
  isFailureRecoveryProbe?: boolean;
  /**
   * p-102-followup — reproduces an embedded designer-panel run (Component Designer / Server
   * Functions inline AI chat), which wraps the operator's prompt with a canvas/editor snapshot
   * and forces `agentPlanActMode: 'implement'`. Omit for a plain top-level AppEndoo chat turn.
   */
  pageContext?: Record<string, unknown>;
  agentPlanActMode?: AgentPlanActMode;
  /**
   * p-102-followup — scripted conversation history before the scored `prompt` turn. Lets a
   * scenario reproduce a real multi-turn incident (investigate → correction → investigate →
   * ambiguous follow-up) instead of only ever testing a fresh first turn.
   */
  priorTurns?: { role: 'user' | 'assistant'; content: string }[];
};

/**
 * p-98 section 8 — persisted, re-runnable scenario suite (not a one-shot script). Five
 * representative tasks + one deliberate failure/recovery probe. Real API calls, real cost —
 * run on-demand via `npm run eval:live-model`, never in CI or test:critical.
 */
export const LIVE_EVAL_SCENARIOS: LiveEvalScenario[] = [
  {
    id: 'simple-server-function',
    label: 'Simple server function',
    mode: 'agent',
    prompt: 'Create a server function named "add-two-numbers" in folder "eval-scratch" that takes two numbers a and b in the request body and returns their sum.',
    expectedFirstToolNames: ['get_project_standards', 'search_codebase', 'get_feature_graph'],
    expectsProposal: true,
  },
  {
    id: 'find-a-bug',
    label: 'Find a bug (read-only investigation)',
    mode: 'ask',
    prompt: 'Look at src/core/ai/validation/proposalValidator.ts and tell me: is there any case where a file_patch changeSet could bypass the userIntentPaths scope check? Explain briefly, do not propose a fix.',
    expectsProposal: false,
  },
  {
    id: 'edit-component',
    label: 'Draft a Designer component',
    mode: 'agent',
    prompt: 'Draft a new Component Designer layout named "Eval Scratch KPI" in folder "eval-scratch" using the kpi-metrics-grid built-in preset.',
    expectedFirstToolNames: ['get_project_standards', 'draft_component_layout'],
    expectsProposal: true,
  },
  {
    id: 'read-only-question',
    label: 'Read-only platform question',
    mode: 'ask',
    prompt: 'What is the difference between draft_component_layout and draft_application_scaffold? Answer from the tool descriptions, keep it to 2-3 sentences.',
    expectsProposal: false,
  },
  {
    id: 'multi-step-fullstack',
    label: 'Multi-step full-stack task (WF-4)',
    mode: 'agent',
    prompt: 'Build a small feature: a server function "eval-scratch/list-fruits" that returns a fixed JSON array of 3 fruit names, and a single-screen Designer layout "Eval Scratch Fruits" in folder "eval-scratch" that could display that list.',
    expectedFirstToolNames: ['get_project_standards', 'search_codebase'],
    expectsProposal: true,
  },
  {
    // p-102-followup — faithful multi-turn reproduction of a real incident: the operator asked
    // (vaguely, no path given) for a UI for an existing API named "test"; the agent found it via
    // search but ended the turn without drafting; the operator corrected a path detail the agent
    // got wrong; the agent re-confirmed but again didn't draft; only on a 4th operator turn
    // ("just build it") did drafting finally happen. The panel's boilerplate "no layout was
    // written" message (unconditionally appended whenever no draft is detected) made this read
    // like a repeated formal refusal rather than "the model just didn't act this turn."
    //
    // Verified 2026-09-01 (3 real gpt-5.4 before/after comparison pairs, incl. this exact scripted
    // history with vs. without the ClientComponentAiPanel.tsx "act in the same turn" instruction
    // line): the model called draft_component_layout on the final turn in ALL 6 runs, WITH and
    // WITHOUT the fix — the stall could not be reproduced on demand, so this is kept as an ongoing
    // regression probe (a real historical incident worth guarding), not as proof the fix caused a
    // measured improvement. See p-00-todo-index.md log for the full comparison writeup.
    id: 'designer-panel-stall-then-nudge',
    label: 'Designer panel: recover from a stalled multi-turn conversation',
    mode: 'agent',
    priorTurns: [
      {
        role: 'user',
        content: [
          'Current layout snapshot (includes the unsaved Live Designer canvas):',
          '```json',
          '(empty)',
          '```',
          '',
          'To change the canvas, you MUST call draft_component_layout with name, layoutId from this snapshot, and the full updated document (and bindingDefinitions when bindings change). designer_set_prop / designer_insert_palette_item also work against this layoutId. This panel writes the drafted document onto the canvas. Do not claim the canvas changed unless you drafted a document. Nothing is saved until the operator clicks Save.',
          'If you first need to look something up (an API route, its schema, existing code), do that — then immediately continue in this same turn and call draft_component_layout. Do not end the turn after only investigating and describing what you found; a turn that reports findings but never calls draft_component_layout leaves the canvas unchanged and reads to the operator as a stall, not progress.',
          '',
          'Operator request:',
          'I need an interface for an API named "test" — it should be a low-code interface for it.',
        ].join('\n'),
      },
      {
        role: 'assistant',
        content: 'The problem is your own layout is empty. In workspace/designer/drafts/general/test-show.json there is only a root node with children: [] — nothing is written onto the canvas so nothing shows in the preview.\n\nI found the full API path: GET method for function general.test, registered in OpenAPI at /api/test and confirmed by the file workspace/server-functions/custom/general.test.metadata.json.\n\nNo layout was written onto the canvas. The agent did not draft a component. Ask again, or switch to Ask for a proposed patch you can Apply.',
      },
      {
        role: 'user',
        content: [
          'Current layout snapshot (includes the unsaved Live Designer canvas):',
          '```json',
          '(empty)',
          '```',
          '',
          'To change the canvas, you MUST call draft_component_layout with name, layoutId from this snapshot, and the full updated document (and bindingDefinitions when bindings change). designer_set_prop / designer_insert_palette_item also work against this layoutId. This panel writes the drafted document onto the canvas. Do not claim the canvas changed unless you drafted a document. Nothing is saved until the operator clicks Save.',
          'If you first need to look something up (an API route, its schema, existing code), do that — then immediately continue in this same turn and call draft_component_layout. Do not end the turn after only investigating and describing what you found; a turn that reports findings but never calls draft_component_layout leaves the canvas unchanged and reads to the operator as a stall, not progress.',
          '',
          'Operator request:',
          'You made a mistake in the path: AppEnd OS - GET /api/test //',
        ].join('\n'),
      },
      {
        role: 'assistant',
        content: 'GET /api/test is the correct path. My mistake was writing api.test instead of general.test as the function id in one place — the registered route in OpenAPI for this function is /api/test and its final id is general.test; that part is fine. Still, I see nothing because the test-show layout is still empty and has only a root node with no children.\n\nNo layout was written onto the canvas. The agent did not draft a component. Ask again, or switch to Ask for a proposed patch you can Apply.',
      },
    ],
    prompt: [
      'Current layout snapshot (includes the unsaved Live Designer canvas):',
      '```json',
      '(empty)',
      '```',
      '',
      'To change the canvas, you MUST call draft_component_layout with name, layoutId from this snapshot, and the full updated document (and bindingDefinitions when bindings change). designer_set_prop / designer_insert_palette_item also work against this layoutId. This panel writes the drafted document onto the canvas. Do not claim the canvas changed unless you drafted a document. Nothing is saved until the operator clicks Save.',
      'If you first need to look something up (an API route, its schema, existing code), do that — then immediately continue in this same turn and call draft_component_layout. Do not end the turn after only investigating and describing what you found; a turn that reports findings but never calls draft_component_layout leaves the canvas unchanged and reads to the operator as a stall, not progress.',
      '',
      'Operator request:',
      'This path has an output.',
    ].join('\n'),
    pageContext: {
      path: '/studio/dev/client-components/eval-scratch-probe',
      pageLabel: 'Client Components',
      pageKey: 'client-components',
      layoutId: 'eval-scratch-designer-panel-probe',
    },
    agentPlanActMode: 'implement',
    expectedToolNamesAnywhere: ['draft_component_layout'],
    expectsProposal: true,
  },
  {
    id: 'failure-recovery-invalid-preset',
    label: 'Deliberate failure → recovery (invalid template id)',
    mode: 'agent',
    prompt: 'Draft a new Component Designer layout named "Eval Scratch Recovery Probe" in folder "eval-scratch" using the built-in layout preset id "definitely-not-a-real-preset-id". If that fails, pick the closest real built-in preset instead and use that.',
    expectsProposal: true,
    isFailureRecoveryProbe: true,
  },
];
