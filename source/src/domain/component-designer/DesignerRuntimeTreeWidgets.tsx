import * as React from 'react';
import * as LucideIcons from 'lucide-react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DesignerNode } from './types';
import {
  buildTreeNodePath,
  findTreeNodeById,
  findTreeNodeChainById,
  parseDesignerTreeNodes,
  type DesignerTreeNode,
} from './visualizationDataModel';
import { MOCK_ORG_TREE_JSON } from './visualizationMockFixtures';
import { readBoolean, readString } from './runtimeShared';
import type { VizWidgetResolveOptions } from './designerVizRuntimeResolve';
import { buildVizWidgetResolveOptions, resolveBoundVizDataValue } from './designerVizRuntimeResolve';
import type { RuntimeRenderOptions } from './runtimeTypes';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { DEFAULT_TREE_EMPTY_MESSAGE, renderDesignerVizDataState } from './designerVizDataState';

export type DesignerTreeSelectionMode = 'none' | 'single' | 'checkbox';

const resolveLucideIcon = (name: string): React.ComponentType<{ className?: string }> => {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  return icons[name] ?? LucideIcons.Circle;
};

const parseCsvIds = (raw: string | undefined): string[] =>
  (raw ?? '').split(',').map((id) => id.trim()).filter((id) => id.length > 0);

const resolveTreeData = (raw: unknown, vizListBound?: boolean): DesignerTreeNode[] => {
  const parsed = parseDesignerTreeNodes(raw);
  if (parsed.length > 0) {
    return parsed;
  }
  if (vizListBound) {
    return [];
  }
  return parseDesignerTreeNodes(MOCK_ORG_TREE_JSON);
};

/**
 * Shown whenever a widget is connected to a live data source but the resolved list is empty
 * (bad field mapping, empty response, not loaded yet) — previously these widgets rendered
 * nothing at all in that case, which reads as "broken" rather than "connected, no rows yet."
 */
const TreeEmptyState: React.FC<{ message?: string }> = ({
  message = DEFAULT_TREE_EMPTY_MESSAGE,
}) => (
  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
    {message}
  </div>
);

const TreeNodeRow: React.FC<{
  node: DesignerTreeNode;
  depth: number;
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelect?: (id: string) => void;
  selectedId?: string;
  selectionMode?: DesignerTreeSelectionMode;
  showIcons?: boolean;
  checkedIds?: ReadonlySet<string>;
  onToggleChecked?: (id: string) => void;
}> = ({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId,
  selectionMode = 'single',
  showIcons,
  checkedIds,
  onToggleChecked,
}) => {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectionMode === 'single' && selectedId === node.id;
  const isChecked = Boolean(checkedIds?.has(node.id));
  const RowIcon = showIcons && node.icon ? resolveLucideIcon(node.icon) : null;

  return (
    <>
      <div
        className={`flex w-full items-center gap-1 rounded-md py-0.5 pe-2 text-sm ${isSelected ? 'bg-sky-50 text-sky-800' : 'text-slate-700'}`}
        style={{ paddingInlineStart: `${8 + depth * 16}px` }}
      >
        <button
          type="button"
          className="flex h-6 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-100 disabled:cursor-default"
          aria-label={hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : undefined}
          tabIndex={hasChildren ? 0 : -1}
          disabled={!hasChildren}
          onClick={() => onToggle(node.id)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          ) : null}
        </button>
        {selectionMode === 'checkbox' ? (
          <input
            type="checkbox"
            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-sky-600"
            checked={isChecked}
            onChange={() => onToggleChecked?.(node.id)}
            aria-label={`Select ${node.label}`}
          />
        ) : null}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded px-1 py-1 text-left hover:bg-slate-100"
          onClick={() => {
            if (hasChildren) onToggle(node.id);
            onSelect?.(node.id);
          }}
        >
          {RowIcon ? <RowIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : null}
          <span className="truncate">{node.label}</span>
        </button>
      </div>
      {hasChildren && isExpanded
        ? node.children!.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            selectedId={selectedId}
            selectionMode={selectionMode}
            showIcons={showIcons}
            checkedIds={checkedIds}
            onToggleChecked={onToggleChecked}
          />
        ))
        : null}
    </>
  );
};

export const DesignerVizTreeView: React.FC<{
  data?: unknown;
  className?: string;
  style?: React.CSSProperties;
  vizListBound?: boolean;
  vizListLoading?: boolean;
  vizListError?: boolean;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
  toolbar?: React.ReactNode;
  /** 'single' highlights one node without checking it — the "selected, no checkbox" case. */
  selectionMode?: DesignerTreeSelectionMode;
  showIcons?: boolean;
  /** Bindable — seeds/loads the highlighted node from an API (selectionMode 'single'). */
  selectedKey?: string;
  /** Bindable, comma-separated ids — seeds/loads checked nodes from an API (selectionMode 'checkbox'). */
  checkedKeys?: string;
  onSelectionChange?: (event: Event) => void;
  onCheckedChange?: (event: Event) => void;
}> = ({
  data,
  className,
  style,
  vizListBound,
  vizListLoading,
  vizListError,
  isLoading,
  emptyContent = DEFAULT_TREE_EMPTY_MESSAGE,
  errorContent,
  toolbar,
  selectionMode = 'single',
  showIcons,
  selectedKey,
  checkedKeys,
  onSelectionChange,
  onCheckedChange,
}) => {
  const nodes = resolveTreeData(data, vizListBound);
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(() => new Set(nodes.map((n) => n.id)));
  const [selectedId, setSelectedId] = React.useState<string | undefined>(selectedKey);
  const [checkedIds, setCheckedIds] = React.useState<ReadonlySet<string>>(() => new Set(parseCsvIds(checkedKeys)));

  // Mirrors DesignerRuntimeListbox's staticSelectedKeys effect: a bound selectedKey/checkedKeys
  // prop (e.g. loaded from an API after mount) must be able to update the local selection state.
  React.useEffect(() => {
    if (selectedKey !== undefined) {
      setSelectedId(selectedKey);
    }
  }, [selectedKey]);

  React.useEffect(() => {
    if (checkedKeys !== undefined) {
      setCheckedIds(new Set(parseCsvIds(checkedKeys)));
    }
  }, [checkedKeys]);

  const onToggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const onSelect = selectionMode === 'single' ? (id: string) => {
    setSelectedId(id);
    onSelectionChange?.({ target: { value: id } } as unknown as Event);
  } : undefined;

  const onToggleChecked = selectionMode === 'checkbox' ? (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      onCheckedChange?.({ target: { value: Array.from(next).join(',') } } as unknown as Event);
      return next;
    });
  } : undefined;

  return (
    <div className={className} style={style} data-designer-component="viz.tree-view">
      {toolbar}
      {renderDesignerVizDataState({
        isLoading: vizListLoading || isLoading,
        loadingMessage: 'Loading tree data…',
        hasError: vizListError,
        errorContent,
        isEmpty: nodes.length === 0 && vizListBound,
        emptyContent,
        loadingClassName: 'flex h-20 items-center justify-center text-xs text-slate-500',
        children: (
          <div className="flex flex-col gap-0.5">
          {nodes.map((node) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
              selectionMode={selectionMode}
              showIcons={showIcons}
              checkedIds={checkedIds}
              onToggleChecked={onToggleChecked}
            />
          ))}
          </div>
        ),
      })}
    </div>
  );
};

const TreeSelectPanel: React.FC<{
  nodes: DesignerTreeNode[];
  onSelect?: (id: string) => void;
  selectionMode?: DesignerTreeSelectionMode;
  checkedIds?: ReadonlySet<string>;
  onToggleChecked?: (id: string) => void;
}> = ({ nodes, onSelect, selectionMode = 'single', checkedIds, onToggleChecked }) => {
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(() => new Set(nodes.map((n) => n.id)));
  return (
    <>
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={(id) => setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
          onSelect={onSelect}
          selectionMode={selectionMode}
          checkedIds={checkedIds}
          onToggleChecked={onToggleChecked}
        />
      ))}
    </>
  );
};

export const DesignerVizTreeSelect: React.FC<{
  label?: string;
  placeholder?: string;
  data?: unknown;
  className?: string;
  style?: React.CSSProperties;
  vizListBound?: boolean;
  vizListLoading?: boolean;
  vizListError?: boolean;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
  /** Renders checkboxes in the popup and accumulates a CSV of picked ids instead of one. */
  multiple?: boolean;
  /** Bindable — seeds/loads the picked node from an API (single mode). */
  selectedKey?: string;
  /** Bindable, comma-separated ids — seeds/loads the picked nodes from an API (multiple mode). */
  selectedKeys?: string;
  onSelectionChange?: (event: Event) => void;
}> = ({
  label = 'Tree Select',
  placeholder = 'Select a node…',
  data,
  className,
  style,
  vizListBound,
  vizListLoading,
  vizListError,
  isLoading,
  emptyContent = DEFAULT_TREE_EMPTY_MESSAGE,
  errorContent,
  multiple,
  selectedKey,
  selectedKeys,
  onSelectionChange,
}) => {
  const nodes = resolveTreeData(data, vizListBound);
  const [open, setOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState(selectedKey ?? '');
  const [checkedIds, setCheckedIds] = React.useState<ReadonlySet<string>>(() => new Set(parseCsvIds(selectedKeys)));

  React.useEffect(() => {
    if (selectedKey !== undefined) {
      setSelectedId(selectedKey);
    }
  }, [selectedKey]);

  React.useEffect(() => {
    if (selectedKeys !== undefined) {
      setCheckedIds(new Set(parseCsvIds(selectedKeys)));
    }
  }, [selectedKeys]);

  const path = selectedId ? buildTreeNodePath(nodes, selectedId).join(' / ') : '';
  const triggerLabel = multiple
    ? (checkedIds.size > 0 ? `${checkedIds.size} selected` : placeholder)
    : (path || placeholder);
  const isEmpty = vizListBound && nodes.length === 0;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectionChange?.({ target: { value: id } } as unknown as Event);
    // Bug found: TreeNodeRow's label click always toggles expand *and* selects a branch node in
    // one action (correct for Tree View, where nothing closes) — but this popup previously closed
    // unconditionally on any pick, so clicking a branch instantly committed it and closed the
    // popover before the user could ever reach a leaf underneath it. A branch is still a valid,
    // directly-pickable value (e.g. "Department: Engineering"), so keep recording the selection,
    // but only auto-close once a leaf (or a branch with no children left to drill into) is picked.
    const node = findTreeNodeById(nodes, id);
    if (!node?.children || node.children.length === 0) {
      setOpen(false);
    }
  };

  const handleToggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      onSelectionChange?.({ target: { value: Array.from(next).join(',') } } as unknown as Event);
      return next;
    });
  };

  return (
    <div className={className} style={style} data-designer-component="viz.tree-select">
      <label className="ps-[4px] text-xs font-medium text-slate-700">{label}</label>
      <div className="relative mt-[2px]">
        {renderDesignerVizDataState({
          isLoading: vizListLoading || isLoading,
          loadingMessage: 'Loading options…',
          hasError: vizListError,
          errorContent,
          isEmpty,
          emptyContent,
          loadingClassName: 'flex h-8 w-full items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-500',
          children: (
          <>
            <button type="button" className="flex h-8 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800" onClick={() => setOpen((p) => !p)}>
              <span className="truncate">{triggerLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
            </button>
            {open ? (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                <TreeSelectPanel
                  nodes={nodes}
                  selectionMode={multiple ? 'checkbox' : 'single'}
                  onSelect={multiple ? undefined : handleSelect}
                  checkedIds={multiple ? checkedIds : undefined}
                  onToggleChecked={multiple ? handleToggleChecked : undefined}
                />
              </div>
            ) : null}
          </>
          ),
        })}
      </div>
    </div>
  );
};

export const DesignerVizCascader: React.FC<{
  label?: string;
  placeholder?: string;
  data?: unknown;
  className?: string;
  style?: React.CSSProperties;
  vizListBound?: boolean;
  vizListLoading?: boolean;
  vizListError?: boolean;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
  /** Bindable — seeds/loads the picked leaf node from an API. */
  selectedKey?: string;
  onSelectionChange?: (event: Event) => void;
}> = ({
  label = 'Cascader',
  placeholder = 'Select…',
  data,
  className,
  style,
  vizListBound,
  vizListLoading,
  vizListError,
  isLoading,
  emptyContent = DEFAULT_TREE_EMPTY_MESSAGE,
  errorContent,
  selectedKey,
  onSelectionChange,
}) => {
  const nodes = resolveTreeData(data, vizListBound);
  const nodesKey = nodes.map((n) => `${n.id}:${n.label}`).join(',');
  const seedFromKey = (key: string | undefined): { levels: DesignerTreeNode[][]; selection: DesignerTreeNode[] } => {
    if (!key) {
      return { levels: [nodes], selection: [] };
    }
    const chain = findTreeNodeChainById(nodes, key);
    if (chain.length === 0) {
      return { levels: [nodes], selection: [] };
    }
    const levels: DesignerTreeNode[][] = [nodes];
    for (let i = 0; i < chain.length - 1; i += 1) {
      levels.push(chain[i].children ?? []);
    }
    return { levels, selection: chain };
  };
  const [levels, setLevels] = React.useState<DesignerTreeNode[][]>(() => seedFromKey(selectedKey).levels);
  const [selection, setSelection] = React.useState<DesignerTreeNode[]>(() => seedFromKey(selectedKey).selection);
  const [syncedKey, setSyncedKey] = React.useState(`${nodesKey}|${selectedKey ?? ''}`);
  const currentKey = `${nodesKey}|${selectedKey ?? ''}`;
  if (syncedKey !== currentKey) {
    setSyncedKey(currentKey);
    const seeded = seedFromKey(selectedKey);
    setLevels(seeded.levels);
    setSelection(seeded.selection);
  }
  const display = selection.length > 0 ? selection.map((n) => n.label).join(' / ') : placeholder;
  const isEmpty = vizListBound && nodes.length === 0;

  const selectAtLevel = (level: number, node: DesignerTreeNode) => {
    const nextSelection = [...selection.slice(0, level), node];
    setSelection(nextSelection);
    if (node.children && node.children.length > 0) {
      setLevels([...levels.slice(0, level + 1), node.children]);
    } else {
      setLevels(levels.slice(0, level + 1));
      onSelectionChange?.({ target: { value: node.id } } as unknown as Event);
    }
  };

  return (
    <div className={className} style={style} data-designer-component="viz.cascader">
      <label className="ps-[4px] text-xs font-medium text-slate-700">{label}</label>
      {renderDesignerVizDataState({
        isLoading: vizListLoading || isLoading,
        loadingMessage: 'Loading options…',
        hasError: vizListError,
        errorContent,
        isEmpty,
        emptyContent,
        loadingClassName: 'mt-[2px] rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-500',
        children: (
          <div className="mt-[2px] rounded-md border border-slate-300 bg-white p-2">
          <div className="mb-2 truncate text-sm text-slate-800">{display}</div>
          <div className="flex gap-2 overflow-x-auto">
            {levels.map((levelNodes, levelIndex) => (
              <div key={levelIndex} className="min-w-[100px] shrink-0 rounded border border-slate-200">
                {levelNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={`block w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${selection[levelIndex]?.id === node.id ? 'bg-sky-50 text-sky-800' : 'text-slate-700'}`}
                    onClick={() => selectAtLevel(levelIndex, node)}
                  >
                    {node.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
          </div>
        ),
      })}
    </div>
  );
};

export const DesignerVizTreeCombobox: React.FC<{
  label?: string;
  placeholder?: string;
  data?: unknown;
  className?: string;
  style?: React.CSSProperties;
  vizListBound?: boolean;
  vizListLoading?: boolean;
  vizListError?: boolean;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
  /** Bindable — seeds/loads the picked node from an API. */
  selectedKey?: string;
  onSelectionChange?: (event: Event) => void;
}> = ({
  label = 'Tree Combobox',
  placeholder = 'Select…',
  data,
  className,
  style,
  vizListBound,
  vizListLoading,
  vizListError,
  isLoading,
  emptyContent = DEFAULT_TREE_EMPTY_MESSAGE,
  errorContent,
  selectedKey,
  onSelectionChange,
}) => {
  const nodes = resolveTreeData(data, vizListBound);
  const flat = React.useMemo(() => {
    const items: Array<{ id: string; path: string }> = [];
    const walk = (list: DesignerTreeNode[], ancestors: string[]) => {
      for (const next of list) {
        const path = [...ancestors, next.label].join(' / ');
        items.push({ id: next.id, path });
        if (next.children) walk(next.children, [...ancestors, next.label]);
      }
    };
    walk(nodes, []);
    return items;
  }, [nodes]);

  const [selectedId, setSelectedId] = React.useState(selectedKey ?? '');
  const [query, setQuery] = React.useState(() => flat.find((item) => item.id === selectedKey)?.path ?? '');

  React.useEffect(() => {
    if (selectedKey === undefined) {
      return;
    }
    setSelectedId(selectedKey);
    const match = flat.find((item) => item.id === selectedKey);
    if (match) {
      setQuery(match.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, flat.length]);

  const filtered = flat.filter((item) => query.length === 0 || item.path.toLowerCase().includes(query.toLowerCase()));
  const isEmpty = vizListBound && flat.length === 0;

  const handlePick = (item: { id: string; path: string }) => {
    setSelectedId(item.id);
    setQuery(item.path);
    onSelectionChange?.({ target: { value: item.id } } as unknown as Event);
  };

  return (
    <div className={className} style={style} data-designer-component="viz.tree-combobox">
      <label className="ps-[4px] text-xs font-medium text-slate-700">{label}</label>
      {renderDesignerVizDataState({
        isLoading: vizListLoading || isLoading,
        loadingMessage: 'Loading options…',
        hasError: vizListError,
        errorContent,
        isEmpty,
        emptyContent,
        loadingClassName: 'mt-[2px] flex h-8 w-full items-center rounded-md border border-slate-300 px-2.5 text-xs text-slate-500',
        children: (
          <>
          <input
            type="text"
            className="mt-[2px] h-8 w-full rounded-md border border-slate-300 px-2.5 text-xs"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedId) {
                setSelectedId('');
              }
            }}
          />
          {query.length > 0 ? (
            <ul className="mt-1 max-h-36 overflow-auto rounded-md border border-slate-200 bg-white shadow-sm">
              {filtered.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${selectedId === item.id ? 'bg-sky-50 text-sky-800' : 'text-slate-700'}`}
                    onClick={() => handlePick(item)}
                  >
                    {item.path}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          </>
        ),
      })}
    </div>
  );
};

export const resolveTreeWidgetPropsFromNode = (
  node: DesignerNode,
  options: VizWidgetResolveOptions = {},
) => ({
  label: readString(node.props.label, 'Field'),
  placeholder: readString(node.props.placeholder, 'Select…'),
  data: resolveBoundVizDataValue(node, MOCK_ORG_TREE_JSON, options),
  className: readString(node.props.className, 'w-full'),
  vizListBound: options.vizListBound,
  vizListLoading: options.vizListLoading,
  vizListError: options.vizListError,
  isLoading: node.props.isLoading === true,
  emptyContent: readString(node.props.emptyContent, DEFAULT_TREE_EMPTY_MESSAGE),
  errorContent: readString(node.props.errorContent),
  toolbar: options.toolbar,
});

const TREE_SELECTION_MODES: readonly DesignerTreeSelectionMode[] = ['none', 'single', 'checkbox'];

export const resolveTreeViewSelectionPropsFromNode = (node: DesignerNode) => ({
  selectionMode: TREE_SELECTION_MODES.includes(node.props.selectionMode as DesignerTreeSelectionMode)
    ? (node.props.selectionMode as DesignerTreeSelectionMode)
    : 'single',
  showIcons: readBoolean(node.props.showIcons),
  selectedKey: readString(node.props.selectedKey) || undefined,
  checkedKeys: readString(node.props.checkedKeys) || undefined,
});

export const resolveTreeSelectExtraPropsFromNode = (node: DesignerNode) => ({
  multiple: readBoolean(node.props.multiple),
  selectedKey: readString(node.props.selectedKey) || undefined,
  selectedKeys: readString(node.props.selectedKeys) || undefined,
});

export const resolveTreePickerSelectedKeyFromNode = (node: DesignerNode): string | undefined =>
  readString(node.props.selectedKey) || undefined;

type BoundTreeWidgetProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
  style?: React.CSSProperties;
};

const resolveTreeWidgetEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, (event: Event) => void> =>
  options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

/** Preview wrapper — adds selectionMode/checkbox state and event-binding wiring on top of the presentational `DesignerVizTreeView`. */
export const DesignerRuntimeVizTreeView: React.FC<BoundTreeWidgetProps> = ({ node, options, style }) => {
  const base = resolveTreeWidgetPropsFromNode(node, buildVizWidgetResolveOptions(node, options));
  const selectionProps = resolveTreeViewSelectionPropsFromNode(node);
  const eventProps = resolveTreeWidgetEventProps(node, options);
  return (
    <DesignerVizTreeView
      {...base}
      {...selectionProps}
      style={style}
      onSelectionChange={eventProps.onSelectionChange}
      onCheckedChange={eventProps.onCheckedChange}
    />
  );
};

/** Preview wrappers — hierarchical `data` (static or Viz-API-bound) is the only data source; real selection output wired via onSelectionChange. */
export const DesignerRuntimeVizTreeSelect: React.FC<BoundTreeWidgetProps> = ({ node, options, style }) => {
  const base = resolveTreeWidgetPropsFromNode(node, buildVizWidgetResolveOptions(node, options));
  const extra = resolveTreeSelectExtraPropsFromNode(node);
  const eventProps = resolveTreeWidgetEventProps(node, options);
  return <DesignerVizTreeSelect {...base} {...extra} style={style} onSelectionChange={eventProps.onSelectionChange} />;
};

export const DesignerRuntimeVizCascader: React.FC<BoundTreeWidgetProps> = ({ node, options, style }) => {
  const base = resolveTreeWidgetPropsFromNode(node, buildVizWidgetResolveOptions(node, options));
  const selectedKey = resolveTreePickerSelectedKeyFromNode(node);
  const eventProps = resolveTreeWidgetEventProps(node, options);
  return <DesignerVizCascader {...base} selectedKey={selectedKey} style={style} onSelectionChange={eventProps.onSelectionChange} />;
};

export const DesignerRuntimeVizTreeCombobox: React.FC<BoundTreeWidgetProps> = ({ node, options, style }) => {
  const base = resolveTreeWidgetPropsFromNode(node, buildVizWidgetResolveOptions(node, options));
  const selectedKey = resolveTreePickerSelectedKeyFromNode(node);
  const eventProps = resolveTreeWidgetEventProps(node, options);
  return <DesignerVizTreeCombobox {...base} selectedKey={selectedKey} style={style} onSelectionChange={eventProps.onSelectionChange} />;
};
