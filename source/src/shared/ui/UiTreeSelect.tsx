import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Loader2, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';
import { SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS } from './AppSplitButton';
import { CreateEditModalShell } from './CreateEditModalShell';
import {
  DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  FieldFeedbackShell,
  type FieldFeedbackPlacement,
} from './fieldFeedback';
import {
  HEROUI_FIELD_BOX_CLASS,
  HEROUI_FIELD_FOCUS_CLIP_CLASS,
  HEROUI_FIELD_RADIUS_CLASS,
  HEROUI_FIELD_SURFACE_CLASS,
} from './heroFieldChrome';
import {
  HERO_UI_FIELD_TEXT_ALIGN_CLASS,
  type HeroUiFieldSize,
  resolveHeroUiFieldSizeTokens,
} from './heroFieldSize';
import {
  DIALOG_NESTED_BACKDROP_Z_CLASS,
  resolveHeroUiFieldBorderClass,
} from './surfaceClasses';

export type UiTreeSelectNode = {
  id: string;
  label: string;
  children?: UiTreeSelectNode[];
  /** When true and children are not loaded yet, expand calls `onLoadChildren`. */
  hasChildren?: boolean;
};

export type UiTreeSelectProps = {
  value?: string;
  onChange?: (value: string) => void;
  items?: UiTreeSelectNode[];
  /**
   * Lazy-load children for a branch. Returned nodes are merged under that id.
   * Use when `hasChildren` is true but `children` is empty/undefined.
   */
  onLoadChildren?: (nodeId: string) => Promise<UiTreeSelectNode[]>;
  placeholder?: string;
  className?: string;
  size?: HeroUiFieldSize;
  isDisabled?: boolean;
  disabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  feedbackPlacement?: FieldFeedbackPlacement;
  ariaLabel: string;
  isLoading?: boolean;
  emptyContent?: string;
  /** Title for the large tree browser dialog. Defaults to `ariaLabel`. */
  browserTitle?: string;
  /** When false, hides the ⋯ control that opens the large browser. Default true. */
  showBrowserMenu?: boolean;
  /**
   * Closed-field label when `value` is not yet present in `items`
   * (e.g. edit forms hydrating a nested selection).
   */
  valueLabel?: string;
  /** Ancestor ids to expand when hydrating a nested selection. */
  defaultExpandedIds?: readonly string[];
};

/** Prefer a tall tree panel; clamp to available viewport space (see positioning). */
const TREE_SELECT_PANEL_MAX_HEIGHT = 360;
const TREE_SELECT_PANEL_MIN_COMFORT = 160;
const TREE_SELECT_PANEL_GAP = 4;
const TREE_BROWSER_BODY_CLASS = 'h-[min(70vh,560px)] overflow-auto rounded-lg border border-slate-200 bg-white p-1';

const findNodeById = (nodes: UiTreeSelectNode[], id: string): UiTreeSelectNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const buildNodePath = (nodes: UiTreeSelectNode[], id: string): string[] => {
  const walk = (list: UiTreeSelectNode[], trail: string[]): string[] | null => {
    for (const node of list) {
      const next = [...trail, node.label];
      if (node.id === id) return next;
      if (node.children?.length) {
        const found = walk(node.children, next);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(nodes, []) ?? [];
};

const mergeChildren = (
  nodes: UiTreeSelectNode[],
  parentId: string,
  children: UiTreeSelectNode[],
): UiTreeSelectNode[] => nodes.map((node) => {
  if (node.id === parentId) {
    return { ...node, children, hasChildren: children.length > 0 || node.hasChildren };
  }
  if (!node.children?.length) return node;
  return { ...node, children: mergeChildren(node.children, parentId, children) };
});

const nodeCanExpand = (node: UiTreeSelectNode): boolean =>
  Boolean(node.children && node.children.length > 0) || Boolean(node.hasChildren);

type TreeRowProps = {
  node: UiTreeSelectNode;
  depth: number;
  selectedId: string;
  expanded: ReadonlySet<string>;
  loadingIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
};

const TreeRow: React.FC<TreeRowProps> = ({
  node,
  depth,
  selectedId,
  expanded,
  loadingIds,
  onToggle,
  onSelect,
}) => {
  const expandable = nodeCanExpand(node);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const isLoading = loadingIds.has(node.id);
  const childNodes = node.children ?? [];

  return (
    <>
      <div
        className={cn(
          'flex w-full items-center gap-1 rounded-md py-0.5 pe-2 text-xs',
          isSelected ? 'bg-sky-50 text-sky-800' : 'text-slate-700 hover:bg-slate-50',
        )}
        style={{ paddingInlineStart: `${8 + depth * 14}px` }}
      >
        <button
          type="button"
          className="flex h-6 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-100 disabled:cursor-default"
          aria-label={expandable ? (isExpanded ? 'Collapse' : 'Expand') : undefined}
          tabIndex={expandable ? 0 : -1}
          disabled={!expandable || isLoading}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle(node.id);
          }}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          ) : expandable ? (
            isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          ) : (
            <span className="inline-block w-3.5" />
          )}
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 truncate py-0.5 text-start font-medium"
          onClick={() => onSelect(node.id)}
        >
          {node.label}
        </button>
      </div>
      {isExpanded
        ? childNodes.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            expanded={expanded}
            loadingIds={loadingIds}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))
        : null}
    </>
  );
};

type TreeListProps = {
  nodes: UiTreeSelectNode[];
  selectedId: string;
  expanded: ReadonlySet<string>;
  loadingIds: ReadonlySet<string>;
  showEmpty: boolean;
  emptyContent: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
};

const TreeList: React.FC<TreeListProps> = ({
  nodes,
  selectedId,
  expanded,
  loadingIds,
  showEmpty,
  emptyContent,
  onToggle,
  onSelect,
}) => {
  if (showEmpty) {
    return <p className="px-2 py-2 text-xs text-slate-500">{emptyContent}</p>;
  }

  return (
    <>
      {nodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          expanded={expanded}
          loadingIds={loadingIds}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </>
  );
};

/**
 * Form field: pick one node from a hierarchical tree (popover + expand/collapse).
 * Branch or leaf may be selected; chevron expands without selecting.
 * Panel is body-portaled so overflow-hidden shells (modals) cannot clip it.
 * ⋯ sits in the same field chrome and opens the tree in a larger nested dialog.
 */
export const UiTreeSelect: React.FC<UiTreeSelectProps> = ({
  value = '',
  onChange,
  items = [],
  onLoadChildren,
  placeholder = 'Select a node…',
  className,
  size = 'sm',
  isDisabled,
  disabled,
  isInvalid,
  errorMessage,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  ariaLabel,
  isLoading = false,
  emptyContent = 'No nodes available.',
  browserTitle,
  showBrowserMenu = true,
  valueLabel,
  defaultExpandedIds,
}) => {
  const controlDisabled = Boolean(isDisabled ?? disabled);
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | undefined>();
  const [treeItems, setTreeItems] = useState<UiTreeSelectNode[]>(items);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(defaultExpandedIds ?? []));
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(() => new Set());
  const resolvedBrowserTitle = browserTitle?.trim() || ariaLabel;
  const defaultExpandedKey = (defaultExpandedIds ?? []).join('\0');

  useEffect(() => {
    setTreeItems(items);
  }, [items]);

  useEffect(() => {
    if (!defaultExpandedKey) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of defaultExpandedKey.split('\0')) {
        if (id) next.add(id);
      }
      return next;
    });
  }, [defaultExpandedKey]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(undefined);
      return undefined;
    }

    const updatePosition = () => {
      const anchor = rootRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const availableBelow = window.innerHeight - rect.bottom - TREE_SELECT_PANEL_GAP - 8;
      const availableAbove = rect.top - TREE_SELECT_PANEL_GAP - 8;
      const fitsBelow = availableBelow >= TREE_SELECT_PANEL_MIN_COMFORT;
      const side = fitsBelow || availableBelow >= availableAbove ? 'below' : 'above';
      const maxHeight = Math.max(
        96,
        Math.min(
          TREE_SELECT_PANEL_MAX_HEIGHT,
          side === 'below' ? availableBelow : availableAbove,
        ),
      );
      const next: React.CSSProperties = {
        left: rect.left,
        width: rect.width,
        maxHeight,
        overflowY: 'auto',
      };
      if (side === 'below') {
        next.top = rect.bottom + TREE_SELECT_PANEL_GAP;
      } else {
        next.bottom = window.innerHeight - rect.top + TREE_SELECT_PANEL_GAP;
      }
      setPanelStyle(next);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectedPath = useMemo(
    () => (value ? buildNodePath(treeItems, value) : []),
    [treeItems, value],
  );
  const trimmedValueLabel = valueLabel?.trim() || '';
  const triggerLabel = selectedPath.length > 0
    ? selectedPath.join(' / ')
    : (trimmedValueLabel || (value ? value : placeholder));
  const showEmpty = !isLoading && treeItems.length === 0;

  const handleSelect = useCallback((id: string) => {
    onChange?.(id);
    setOpen(false);
    setBrowserOpen(false);
  }, [onChange]);

  const handleToggle = useCallback(async (id: string) => {
    const node = findNodeById(treeItems, id);
    if (!node) return;

    const willExpand = !expanded.has(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    const needsLoad = willExpand
      && Boolean(node.hasChildren)
      && (!node.children || node.children.length === 0)
      && onLoadChildren;

    if (!needsLoad) return;

    setLoadingIds((prev) => new Set(prev).add(id));
    try {
      const children = await onLoadChildren(id);
      setTreeItems((prev) => mergeChildren(prev, id, children));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [expanded, onLoadChildren, treeItems]);

  const openBrowser = useCallback(() => {
    setOpen(false);
    setBrowserOpen(true);
  }, []);

  const closeBrowser = useCallback(() => {
    setBrowserOpen(false);
  }, []);

  const panel = open ? (
    <div
      ref={panelRef}
      role="listbox"
      aria-label={ariaLabel}
      className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'p-1')}
      style={panelStyle}
    >
      <TreeList
        nodes={treeItems}
        selectedId={value}
        expanded={expanded}
        loadingIds={loadingIds}
        showEmpty={showEmpty}
        emptyContent={emptyContent}
        onToggle={handleToggle}
        onSelect={handleSelect}
      />
    </div>
  ) : null;

  const triggerDisabled = controlDisabled || isLoading;
  const browserActionLabel = `Open ${ariaLabel} in larger window`;

  return (
    <FieldFeedbackShell
      className={className}
      errorMessage={errorMessage}
      isInvalid={isInvalid}
      placement={feedbackPlacement}
    >
      <div ref={rootRef} className="relative w-full">
        <div
          role="group"
          aria-label={ariaLabel}
          className={cn(
            'flex w-full items-stretch overflow-hidden !bg-white',
            HEROUI_FIELD_RADIUS_CLASS,
            sizeTokens.controlHeightClass,
            sizeTokens.controlMaxHeightClass,
            resolveHeroUiFieldBorderClass(isInvalid),
            triggerDisabled && 'opacity-60',
          )}
        >
          <button
            type="button"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={triggerDisabled}
            onClick={() => {
              if (triggerDisabled) return;
              setOpen((prev) => !prev);
            }}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-between gap-2 border-0',
              HEROUI_FIELD_BOX_CLASS,
              HEROUI_FIELD_SURFACE_CLASS,
              HEROUI_FIELD_FOCUS_CLIP_CLASS,
              HERO_UI_FIELD_TEXT_ALIGN_CLASS,
              sizeTokens.textClass,
              triggerDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
              selectedPath.length === 0 && !trimmedValueLabel && !value ? 'text-slate-400' : 'text-slate-800',
            )}
          >
            <span className="min-w-0 flex-1 truncate">{isLoading ? 'Loading…' : triggerLabel}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-500', open && 'rotate-180')} />
          </button>

          {showBrowserMenu ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={browserActionLabel}
              title={browserActionLabel}
              disabled={triggerDisabled}
              onClick={() => {
                if (triggerDisabled) return;
                openBrowser();
              }}
              className={cn(
                'inline-flex w-8 shrink-0 items-center justify-center border-0 border-s border-slate-300 bg-white text-slate-500',
                HEROUI_FIELD_FOCUS_CLIP_CLASS,
                triggerDisabled
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer hover:bg-slate-50 hover:text-slate-700',
              )}
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        {panel && typeof document !== 'undefined'
          ? createPortal(panel, document.body)
          : null}
      </div>

      {browserOpen ? (
        <CreateEditModalShell
          size="3xl"
          backdropClassName={DIALOG_NESTED_BACKDROP_Z_CLASS}
          title={resolvedBrowserTitle}
          onClose={closeBrowser}
          onBackdropClick={closeBrowser}
          footer={(
            <AppButton intent="cancel" size="sm" onClick={closeBrowser}>
              Cancel
            </AppButton>
          )}
        >
          <div
            role="listbox"
            aria-label={resolvedBrowserTitle}
            className={TREE_BROWSER_BODY_CLASS}
          >
            <TreeList
              nodes={treeItems}
              selectedId={value}
              expanded={expanded}
              loadingIds={loadingIds}
              showEmpty={showEmpty}
              emptyContent={emptyContent}
              onToggle={handleToggle}
              onSelect={handleSelect}
            />
          </div>
        </CreateEditModalShell>
      ) : null}
    </FieldFeedbackShell>
  );
};
