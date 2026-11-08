import * as React from 'react';
import type { DesignerAction, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import { UiTextarea } from '../../../shared/ui';
import { DesignerFieldRow } from './DesignerFieldRow';
import { preventInspectorDetailsToggle } from './inspectorDetailsGuard';
import {
  INSPECTOR_TEXT_2XS,
} from './inspectorDesignTokens';

type InspectorStaticListItemsFieldProps = {
  node: DesignerNode;
  document: DesignerDocument;
  dispatch: React.Dispatch<DesignerAction>;
};

const readListItemTexts = (node: DesignerNode, document: DesignerDocument): string =>
  node.children
    .map((childId) => document.nodes[childId])
    .filter((child): child is DesignerNode => Boolean(child) && child.type === 'list-item')
    .map((child) => (typeof child.props.text === 'string' ? child.props.text : 'List item'))
    .join('\n');

const normalizeListLines = (rawValue: string): string[] =>
  rawValue
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

export const InspectorStaticListItemsField: React.FC<InspectorStaticListItemsFieldProps> = ({
  node,
  document,
  dispatch,
}) => {
  const [draft, setDraft] = React.useState(() => readListItemTexts(node, document));

  React.useEffect(() => {
    setDraft(readListItemTexts(node, document));
  }, [document, node.children, node.id]);

  const applyDraft = React.useCallback((rawValue: string) => {
    const lines = normalizeListLines(rawValue);
    const currentLines = normalizeListLines(readListItemTexts(node, document));
    const isSame = lines.length === currentLines.length
      && lines.every((line, index) => line === currentLines[index]);

    if (isSame) {
      return;
    }

    dispatch({
      type: 'sync-list-item-texts',
      listNodeId: node.id,
      texts: lines,
    });
  }, [dispatch, document, node]);

  return (
    <DesignerFieldRow label="List Items" align="start">
      <div className="w-full" {...preventInspectorDetailsToggle}>
        <UiTextarea
          size="sm"
          rows={5}
          placeholder={'One item per line\nFirst item\nSecond item'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => applyDraft(draft)}
        />
        <p className={`mt-[2px] ps-[4px] ${INSPECTOR_TEXT_2XS} text-slate-500`}>
          Static list lines sync to child List Item nodes on blur.
        </p>
      </div>
    </DesignerFieldRow>
  );
};
