import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { UiInput, UiSelect } from '../../../shared/ui';
import { ExpressionField } from './ExpressionField';
import { parseLiteralInput } from './expressionUtils';
import { allowedSelectorTypesForSource, generateEdgeKey, EDGE_SELECTOR_LABELS, type EdgeSelectorType } from './edgeSelectorRules';
import type { CanonicalExpression, WorkflowNode } from '../types';

const POPOVER_WIDTH = 268;

type EdgeSelector = { type: string; [k: string]: unknown };

/**
 * Small anchored popover that opens right where a drag-to-connect gesture landed (see
 * `GraphCanvas.tsx`'s `onConnect`/`onConnectNodes`). Offers only the selector types the source
 * node's kind can legally carry (`edgeSelectorRules.ts`) instead of offering every selector type
 * unconditionally. Drag-to-connect is the only authoring path for new edges.
 */
export const EdgeSelectorPopover: React.FC<{
  anchor: { x: number; y: number };
  fromNode: WorkflowNode;
  toNodeKey: string;
  definitionId: number;
  existingEdgeKeys: readonly string[];
  mode?: 'create' | 'reconnect';
  edgeKey?: string;
  initialSelector?: EdgeSelector;
  onSubmit: (edge: { key: string; fromNodeKey: string; toNodeKey: string; selector: EdgeSelector }) => void;
  onClose: () => void;
}> = ({ anchor, fromNode, toNodeKey, definitionId, existingEdgeKeys, mode = 'create', edgeKey, initialSelector, onSubmit, onClose }) => {
  const allowed = allowedSelectorTypesForSource(fromNode);
  const initialType = (initialSelector?.type as EdgeSelectorType | undefined);
  const [selectorType, setSelectorType] = useState<EdgeSelectorType>(
    initialType && allowed.includes(initialType) ? initialType : allowed[0],
  );
  const [condition, setCondition] = useState<CanonicalExpression>(
    (initialSelector?.condition as CanonicalExpression | undefined) ?? { op: 'LITERAL', value: true },
  );
  const [caseValueText, setCaseValueText] = useState(
    initialSelector?.value != null ? String(initialSelector.value) : '',
  );
  const allowedOutcomes = (fromNode.allowedOutcomes as string[] | undefined) ?? [];
  const [outcomeKey, setOutcomeKey] = useState(
    (initialSelector?.outcomeKey as string | undefined) ?? allowedOutcomes[0] ?? '',
  );
  const timeoutOutcomeKey = (fromNode.timeout as { outcomeKey?: string } | undefined)?.outcomeKey ?? '';
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSubmit = () => {
    const selector: EdgeSelector = { type: selectorType };
    if (selectorType === 'DECISION') selector.condition = condition;
    if (selectorType === 'SWITCH_CASE') selector.value = (parseLiteralInput(caseValueText) as { value: unknown }).value;
    if (selectorType === 'WORK_ITEM_OUTCOME') {
      if (!outcomeKey) return;
      selector.outcomeKey = outcomeKey;
    }
    if (selectorType === 'WAIT_TIMEOUT') selector.outcomeKey = timeoutOutcomeKey;
    const key = mode === 'reconnect' && edgeKey ? edgeKey : generateEdgeKey(fromNode.key, toNodeKey, existingEdgeKeys);
    onSubmit({ key, fromNodeKey: fromNode.key, toNodeKey, selector });
    onClose();
  };

  const estimatedHeight = 160 + (selectorType === 'DECISION' ? 90 : selectorType === 'SWITCH_CASE' || selectorType === 'WORK_ITEM_OUTCOME' ? 60 : 0);
  const left = Math.min(Math.max(8, anchor.x - POPOVER_WIDTH / 2), window.innerWidth - POPOVER_WIDTH - 8);
  const top = Math.min(Math.max(8, anchor.y - estimatedHeight / 2), window.innerHeight - estimatedHeight - 8);

  return createPortal(
    <div
      ref={containerRef}
      style={{ left, top, width: POPOVER_WIDTH }}
      className="fixed z-[95] flex flex-col gap-2 rounded-lg border-[1.5px] border-primary-300 bg-white p-3 text-sm shadow-xl"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700">
          {fromNode.key} → {toNodeKey}
        </span>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {allowed.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {allowed.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectorType(type)}
              className={`rounded px-2 py-1 text-[11px] font-semibold ${selectorType === type ? 'bg-primary-600 text-white' : 'border border-border-subtle text-slate-600 hover:bg-slate-50'}`}
            >
              {EDGE_SELECTOR_LABELS[type]}
            </button>
          ))}
        </div>
      ) : (
        <span className="text-[11px] text-slate-500">{EDGE_SELECTOR_LABELS[selectorType]}</span>
      )}

      {selectorType === 'DECISION' ? (
        <ExpressionField
          label="Condition (evaluates to true/false)"
          definitionId={definitionId}
          value={condition}
          onChange={setCondition}
          context={{ consumerNodeKey: fromNode.key, isWaitEventContext: false, isWorkItemOutputContext: false, isOutputAssignmentContext: false, isForEachItemContext: false }}
        />
      ) : null}

      {selectorType === 'SWITCH_CASE' ? (
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          Case value (exact match)
          <UiInput
            autoFocus
            size="sm"
            aiAssist={false}
            className="text-xs font-normal"
            value={caseValueText}
            onChange={(e) => setCaseValueText(e.target.value)}
            placeholder='e.g. "HIGH" or 42'
          />
        </label>
      ) : null}

      {selectorType === 'WORK_ITEM_OUTCOME' ? (
        allowedOutcomes.length > 0 ? (
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
            Outcome
            <UiSelect size="sm" className="text-xs font-normal" value={outcomeKey} onChange={(e) => setOutcomeKey(e.target.value)}>
              {allowedOutcomes.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </UiSelect>
          </label>
        ) : (
          <p className="text-[11px] text-amber-600">This WORK_ITEM node has no allowedOutcomes declared yet — add one in its properties first.</p>
        )
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="rounded border border-border-subtle px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={selectorType === 'WORK_ITEM_OUTCOME' && !outcomeKey}
          className="rounded bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {mode === 'reconnect' ? 'Update connection' : 'Connect'}
        </button>
      </div>
    </div>,
    document.body,
  );
};
