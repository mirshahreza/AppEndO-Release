import React, { useCallback, useMemo, useState } from 'react';
import { Blocks } from 'lucide-react';
import {
  ToolboxPanelEmptyState,
  ToolboxPanelItem,
  ToolboxPanelScrollBody,
  ToolboxPanelSection,
  ToolboxPanelShell,
} from '../../../shared/ui';
import { kindColor } from './GraphCanvas';
import { NODE_KINDS, NODE_KIND_LABELS, NODE_KIND_DESCRIPTIONS, buildDefaultNode, generateNodeKey, type NodeKind } from './nodeTemplates';
import {
  groupActionsForPalette,
  friendlyActionLabel,
  paletteActionDescription,
  type ActionCatalogEntry,
  type ActionCatalogGroup,
} from './actionCatalogUtils';
import { resolveWorkflowPaletteIcon } from './workflowNodeIcons';
import { WORKFLOW_NODE_DRAG_MIME, encodeWorkflowNodeDragPayload } from './workflowDragPayload';
import type { WorkflowNode } from '../types';

type WorkflowPaletteSectionId = 'structure' | ActionCatalogGroup['category'];

function filterStructureKinds(query: string): NodeKind[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...NODE_KINDS];
  }

  return NODE_KINDS.filter((kind) => {
    const label = NODE_KIND_LABELS[kind].toLowerCase();
    const description = NODE_KIND_DESCRIPTIONS[kind].toLowerCase();
    const kindToken = kind.toLowerCase().replace(/_/g, ' ');
    return label.includes(normalizedQuery)
      || description.includes(normalizedQuery)
      || kindToken.includes(normalizedQuery);
  });
}

/**
 * Floating, draggable node + Action palette — the n8n-style toolbox window. Drag items onto
 * `GraphCanvas`'s pane (handled there via `onDrop`/`screenToFlowPosition`); clicking still works
 * as an accessible fallback, adding the node at the current viewport center.
 */
export const WorkflowPalette: React.FC<{
  open: boolean;
  onClose: () => void;
  existingKeys: readonly string[];
  actionCatalog: ActionCatalogEntry[];
  onAddNode: (node: WorkflowNode) => void;
}> = ({ open, onClose, existingKeys, actionCatalog, onAddNode }) => {
  const [query, setQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<WorkflowPaletteSectionId | null>('structure');

  const isSearching = query.trim().length > 0;

  const addStructureNode = (kind: NodeKind) => {
    const key = generateNodeKey(kind, existingKeys);
    onAddNode(buildDefaultNode(kind, key));
  };

  const addActionNode = (actionKey: string) => {
    const key = generateNodeKey('ACTION', existingKeys);
    const node = buildDefaultNode('ACTION', key);
    if (node.kind === 'ACTION' && node.actionRef && typeof node.actionRef === 'object') {
      const actionRef = node.actionRef as { action?: { actionKey?: string; actionVersion?: string } };
      onAddNode({ ...node, actionRef: { ...node.actionRef, action: { ...actionRef.action, actionKey } } });
      return;
    }
    onAddNode(node);
  };

  const structureKinds = useMemo(() => filterStructureKinds(query), [query]);
  const actionGroups = useMemo(() => groupActionsForPalette(actionCatalog, query), [actionCatalog, query]);
  const accordionActionGroups = useMemo(() => groupActionsForPalette(actionCatalog, ''), [actionCatalog]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSection((current) => (
      current === sectionId ? current : sectionId as WorkflowPaletteSectionId
    ));
  }, []);

  const flatActionHits = useMemo(
    () => actionGroups.flatMap((group) => group.actions),
    [actionGroups],
  );

  const hasSearchResults = structureKinds.length > 0 || flatActionHits.length > 0;

  const searchResultItems = useMemo(() => {
    const items: Array<
      | { key: string; kind: NodeKind; actionKey?: undefined }
      | { key: string; kind: 'ACTION'; actionKey: string }
    > = [];

    for (const kind of structureKinds) {
      items.push({ key: `structure:${kind}`, kind });
    }
    for (const action of flatActionHits) {
      items.push({ key: `action:${action.key}`, kind: 'ACTION', actionKey: action.key });
    }

    return items;
  }, [structureKinds, flatActionHits]);

  const renderStructureItems = (kinds: readonly NodeKind[]) => (
    <div className="flex flex-col">
      {kinds.map((kind) => {
        const payload = { nodeKind: kind };
        return (
          <ToolboxPanelItem
            key={kind}
            label={NODE_KIND_LABELS[kind]}
            description={NODE_KIND_DESCRIPTIONS[kind]}
            showDescriptionInline={false}
            accentColor={kindColor(kind)}
            icon={resolveWorkflowPaletteIcon(payload, 'h-3.5 w-3.5')}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME, encodeWorkflowNodeDragPayload(payload));
              event.dataTransfer.effectAllowed = 'copy';
            }}
            onActivate={() => addStructureNode(kind)}
          />
        );
      })}
    </div>
  );

  const renderActionItems = (actions: readonly ActionCatalogEntry[]) => (
    <div className="flex flex-col">
      {actions.map((action) => {
        const payload = { nodeKind: 'ACTION' as const, actionKey: action.key };
        return (
          <ToolboxPanelItem
            key={action.key}
            label={friendlyActionLabel(action.key)}
            description={paletteActionDescription(action.key)}
            showDescriptionInline={false}
            accentColor={kindColor('ACTION')}
            icon={resolveWorkflowPaletteIcon(payload, 'h-3.5 w-3.5')}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME, encodeWorkflowNodeDragPayload(payload));
              event.dataTransfer.effectAllowed = 'copy';
            }}
            onActivate={() => addActionNode(action.key)}
          />
        );
      })}
    </div>
  );

  return (
    <ToolboxPanelShell
      open={open}
      onClose={onClose}
      title="Toolbox"
      titleIcon={<Blocks className="h-3.5 w-3.5 text-violet-600" />}
      searchValue={query}
      onSearchChange={setQuery}
    >
      {isSearching ? (
        !hasSearchResults ? (
          <ToolboxPanelEmptyState>
            No toolbox items match “{query.trim()}”.
          </ToolboxPanelEmptyState>
        ) : (
          <ToolboxPanelScrollBody>
            <div className="flex flex-col">
              {searchResultItems.map((item) => {
                if (item.kind === 'ACTION' && item.actionKey) {
                  const payload = { nodeKind: 'ACTION' as const, actionKey: item.actionKey };
                  return (
                    <ToolboxPanelItem
                      key={item.key}
                      label={friendlyActionLabel(item.actionKey)}
                      description={paletteActionDescription(item.actionKey)}
                      showDescriptionInline={false}
                      accentColor={kindColor('ACTION')}
                      icon={resolveWorkflowPaletteIcon(payload, 'h-3.5 w-3.5')}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME, encodeWorkflowNodeDragPayload(payload));
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      onActivate={() => addActionNode(item.actionKey)}
                    />
                  );
                }

                const payload = { nodeKind: item.kind };
                return (
                  <ToolboxPanelItem
                    key={item.key}
                    label={NODE_KIND_LABELS[item.kind]}
                    description={NODE_KIND_DESCRIPTIONS[item.kind]}
                    showDescriptionInline={false}
                    accentColor={kindColor(item.kind)}
                    icon={resolveWorkflowPaletteIcon(payload, 'h-3.5 w-3.5')}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME, encodeWorkflowNodeDragPayload(payload));
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onActivate={() => addStructureNode(item.kind)}
                  />
                );
              })}
            </div>
          </ToolboxPanelScrollBody>
        )
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ToolboxPanelSection
            id="structure"
            label="Structure"
            expanded={expandedSection === 'structure'}
            onToggle={toggleSection}
          >
            {renderStructureItems(NODE_KINDS)}
          </ToolboxPanelSection>

          {accordionActionGroups.length === 0 ? (
            <ToolboxPanelEmptyState>
              No actions are available in the catalog.
            </ToolboxPanelEmptyState>
          ) : (
            accordionActionGroups.map((group) => (
              <ToolboxPanelSection
                key={group.category}
                id={group.category}
                label={group.label}
                expanded={expandedSection === group.category}
                onToggle={toggleSection}
              >
                {renderActionItems(group.actions)}
              </ToolboxPanelSection>
            ))
          )}
        </div>
      )}
    </ToolboxPanelShell>
  );
};
