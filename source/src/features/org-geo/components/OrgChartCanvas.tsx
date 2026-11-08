import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Columns2,
  Crosshair,
  Maximize2,
  Minus,
  Move,
  Plus,
  Rows2,
  Triangle,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { BaseInfoUiIcon } from '../../../shared/lib/baseInfoUiIcon';
import type { TreeDropPosition } from '../../../shared/types/tree';
import { AppButton, CanvasSearchBox, CanvasViewportControls, UiTooltip } from '../../../shared/ui';
import {
  CANVAS_LAYOUT_CONTROLS_ANCHOR_CLASS,
  CANVAS_PAN_VIEWPORT_CLASS,
  CANVAS_ZOOM_CONTROLS_ANCHOR_CLASS,
} from '../../../shared/ui/surfaceClasses';
import {
  readOrgChartViewportPrefs,
  writeOrgChartViewportPrefs,
} from '../lib/orgChartViewportPrefs';
import {
  layoutOrgChartPyramid,
  layoutOrgChartRadial,
  ORG_CHART_LAYOUT_LABELS,
  ORG_CHART_LAYOUT_MODES,
  readOrgChartLayoutMode,
  writeOrgChartLayoutMode,
  type OrgChartLayoutMode,
  type OrgChartPackedLayout,
} from '../lib/orgChartLayout';
import {
  collectFreeLayoutDepths,
  collectFreeLayoutEdges,
  measureFreeLayoutBounds,
  mergeFreePositionsWithTree,
  readOrgChartFreePositions,
  writeOrgChartFreePositions,
  type OrgChartFreePositions,
} from '../lib/orgChartFreePositions';
import {
  readOrgChartFocusedRootId,
  writeOrgChartFocusedRootId,
} from '../lib/orgChartFocusPrefs';
import {
  writeOrgChartCollapsedIds,
} from '../lib/orgChartCollapsePrefs';
import {
  collectOrgChartCollapsedBeyondDepth,
  findOrgChartNodeDepth,
  ORG_CHART_DEFAULT_OPEN_DEPTH,
  orgChartNodeHasChildren,
  pruneOrgChartCollapsed,
} from '../lib/orgChartTreeView';
import type { OrgChartTreeNode } from '../types';
import {
  orgChartLevelColorStyles,
  readOrgChartLevelTitle,
  resolveOrgChartLevelColorWithDefault,
  resolveOrgChartLevelIcon,
  type OrgChartRootConfig,
} from '../lib/orgChartRootConfig';
import {
  collectOrgChartAncestorIds,
  isOrgChartSiblingOverflowNodeId,
  limitOrgChartSiblingFanout,
  ORG_CHART_MAX_SIBLINGS_PER_PARENT,
  orgChartOverflowParentId,
} from '../lib/orgChartSiblingLimit';
import { OrgGeoPersonAvatar } from './OrgGeoPersonAvatar';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 1.75;
const ZOOM_STEP = 0.15;
const ZOOM_DEFAULT = 1;
const VIEWPORT_PADDING_PX = 24;
const FIT_MARGIN = 0.96;
const PERSIST_DEBOUNCE_MS = 120;
const FREE_POSITION_PERSIST_MS = 160;
const NODE_AVATAR_OVERLAP_PX = 3;
const NODE_AVATAR_MAX = 4;
/** Approximate OrgChartCard half-size for SVG edge attachment (min-w 10rem × ~body height). */
const CARD_HALF_WIDTH_PX = 80;
const CARD_HALF_HEIGHT_PX = 30;
/** Short branch stubs so lines meet node edges (was 20px). */
const BRANCH_STUB_CLASS = {
  vertical: 'h-1.5 w-px',
  horizontal: 'h-px w-1.5',
} as const;

/** Point on the rectangle border of a node, on the ray toward a target. */
const pointOnCardEdge = (
  fromX: number,
  fromY: number,
  towardX: number,
  towardY: number,
  halfW = CARD_HALF_WIDTH_PX,
  halfH = CARD_HALF_HEIGHT_PX,
): { x: number; y: number } => {
  const dx = towardX - fromX;
  const dy = towardY - fromY;
  if (dx === 0 && dy === 0) return { x: fromX, y: fromY };
  const scaleX = Math.abs(dx) < 1e-6 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx);
  const scaleY = Math.abs(dy) < 1e-6 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy);
  const t = Math.min(scaleX, scaleY);
  if (!Number.isFinite(t)) return { x: fromX, y: fromY };
  return { x: fromX + dx * t, y: fromY + dy * t };
};


export type OrgChartNodeMember = {
  userId: number;
  displayName: string;
  avatarSrc: string | null;
};

const INACTIVE_HATCH_CLASS =
  'bg-[repeating-linear-gradient(-45deg,#ffffff_0_5px,#e2e8f0_5px_10px)]';

const toDragId = (nodeId: string) => `org-chart-drag:${nodeId}`;
const toDropId = (nodeId: string) => `org-chart-drop:${nodeId}`;

const readNodeIdFromDnd = (
  id: string | number,
  data: Record<string, unknown> | undefined,
  prefix: 'org-chart-drag:' | 'org-chart-drop:',
): string | null => {
  const fromData = typeof data?.nodeId === 'string' ? data.nodeId.trim() : '';
  if (fromData) return fromData;
  const value = String(id);
  return value.startsWith(prefix) ? value.slice(prefix.length) : null;
};

/** Prefer pointer hit; fall back to closest center when over empty space between cards. */
const chartCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCenter(args);
};

type OrgChartCardProps = {
  node: OrgChartTreeNode;
  selected: boolean;
  depth: number;
  rootId: string;
  isMoving: boolean;
  activeDragId: string | null;
  isSearchHit: boolean;
  isSearchCurrent: boolean;
  accent: 'sky' | 'emerald';
  members: OrgChartNodeMember[];
  /** Level default icon when the node has no icon and no member avatars. */
  levelFallbackIcon?: string;
  /** Explicit level title from chart settings — omit when unset. */
  levelTitle?: string;
  /** Level accent color (hex) for icon well chrome. */
  levelColor?: string;
  /** Original-tree children (before collapse prune). */
  hasChildren?: boolean;
  collapsed?: boolean;
  /** Show Focus when node is not the chart root. */
  showFocusAction?: boolean;
  /** True when this node is the current focus root (button toggles exit). */
  isFocusTarget?: boolean;
  onSelect: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onAddChild?: (nodeId: string) => void;
  onToggleCollapse?: (id: string) => void;
  onFocusHere?: (id: string) => void;
  /** `reparent` = tree DnD; `free` = custom position drag (no hierarchy change). */
  interactionMode?: 'reparent' | 'free';
  onFreePointerDown?: (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => void;
};

const ACCENT = {
  sky: {
    focus: 'focus-visible:outline-sky-500',
    selected: 'border-sky-500 ring-2 ring-sky-200',
    rootBorder: 'border-sky-300',
    rootIcon: 'bg-sky-50 text-sky-700',
    overlay: 'border-sky-400',
  },
  emerald: {
    focus: 'focus-visible:outline-emerald-500',
    selected: 'border-emerald-500 ring-2 ring-emerald-200',
    rootBorder: 'border-emerald-300',
    rootIcon: 'bg-emerald-50 text-emerald-700',
    overlay: 'border-emerald-400',
  },
} as const;

/** Synthetic parent for multi-root diagram layout (card not rendered). */
export const ORG_CHART_FOREST_OMIT_NODE_ID = '__appendo_chart_forest_omit__';

const flattenChartNodes = (
  node: OrgChartTreeNode,
): Array<{ id: string; label: string }> => {
  const rows: Array<{ id: string; label: string }> = [{ id: node.id, label: node.label }];
  for (const child of node.children ?? []) {
    rows.push(...flattenChartNodes(child));
  }
  return rows;
};

const OrgChartCard: React.FC<OrgChartCardProps> = ({
  node,
  selected,
  depth,
  rootId,
  isMoving,
  activeDragId,
  isSearchHit,
  isSearchCurrent,
  accent,
  members,
  levelFallbackIcon,
  levelTitle,
  levelColor,
  hasChildren = false,
  collapsed = false,
  showFocusAction = false,
  isFocusTarget = false,
  onSelect,
  onOpenDetails,
  onAddChild,
  onToggleCollapse,
  onFocusHere,
  interactionMode = 'reparent',
  onFreePointerDown,
}) => {
  const isActive = node.isActive !== false;
  const isRoot = node.id === rootId;
  const isOverflowSibling = isOrgChartSiblingOverflowNodeId(node.id);
  const isFree = interactionMode === 'free';
  const canReparentDrag = !isFree && !isRoot && !isMoving && !isOverflowSibling;
  const canFreeDrag = isFree && !isMoving;
  const canDrag = canReparentDrag || canFreeDrag;
  const isDragSource = activeDragId === node.id;
  const tones = ACCENT[accent];
  const hasIcon = Boolean(String(node.icon || '').trim());
  const leadMember = !hasIcon && members.length > 0 ? members[0] : null;
  const stackMembers = leadMember ? members.slice(1) : members;
  const visibleMembers = stackMembers.slice(0, NODE_AVATAR_MAX);
  const extraMemberCount = Math.max(0, stackMembers.length - visibleMembers.length);
  const accentDefaultIcon = accent === 'emerald' ? 'MapPin' : 'Network';
  const resolvedIcon = String(
    node.icon
    || levelFallbackIcon
    || accentDefaultIcon,
  ).trim() || accentDefaultIcon;
  const levelColorStyle = orgChartLevelColorStyles(levelColor);
  const iconWellStyle = levelColorStyle
    ? {
        backgroundColor: levelColorStyle.color,
        color: '#ffffff',
      }
    : undefined;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: toDragId(node.id),
    disabled: !canReparentDrag,
    data: { nodeId: node.id },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: toDropId(node.id),
    disabled: isFree || isMoving || isDragSource,
    data: { nodeId: node.id },
  });

  const setNodeRef = (element: HTMLDivElement | null) => {
    setDragRef(element);
    setDropRef(element);
  };

  const useDefaultBorder = !levelColorStyle
    || isSearchCurrent
    || selected
    || isSearchHit
    || (isOver && !isDragging);

  const titleOnTop = visibleMembers.length > 0;
  const edgeBadgeClass =
    'pointer-events-none w-fit max-w-full truncate rounded-full border px-2.5 py-0.5 text-center text-[10px] font-semibold leading-none shadow-sm';
  const levelBadgeClass = cn(
    edgeBadgeClass,
    levelColorStyle
      ? 'border-transparent text-white'
      : 'border-slate-200 bg-white text-slate-500',
  );
  const titleBadgeClass = cn(
    edgeBadgeClass,
    'border-slate-200 bg-white text-slate-700',
  );
  const hoverActionClass = cn(
    'absolute z-[3] inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition',
    'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
    'hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800',
    'focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
    tones.focus,
  );

  const collapseButton = hasChildren && onToggleCollapse ? (
    <button
      type="button"
      aria-label={collapsed ? `Expand ${node.label}` : `Collapse ${node.label}`}
      title={collapsed ? 'Expand' : 'Collapse'}
      disabled={isMoving}
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition',
        'hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        tones.focus,
        isMoving && 'cursor-not-allowed opacity-50',
      )}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggleCollapse(node.id);
      }}
    >
      {collapsed ? (
        <Plus className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      ) : (
        <Minus className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      )}
    </button>
  ) : null;

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      data-org-chart-node="true"
      data-node-id={node.id}
      onClick={() => onSelect(node.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(node.id);
        }
      }}
      {...(canReparentDrag ? attributes : {})}
      {...(canReparentDrag ? listeners : {})}
      onPointerDown={(event) => {
        // Keep chart pan from starting when interacting with a node.
        event.stopPropagation();
        if (canFreeDrag) {
          onFreePointerDown?.(node.id, event);
          return;
        }
        if (canReparentDrag) {
          listeners?.onPointerDown?.(event);
        }
      }}
      className={cn(
        'group relative z-[1] flex min-w-[10rem] max-w-[14rem] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start shadow-sm transition',
        titleOnTop ? 'pt-3.5' : null,
        levelTitle || collapseButton ? 'pb-3.5' : null,
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        !isDragSource && 'hover:-translate-y-0.5 hover:shadow-md',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        tones.focus,
        isActive
          ? (levelColorStyle ? undefined : 'bg-white')
          : INACTIVE_HATCH_CLASS,
        isSearchCurrent
          ? 'border-amber-500 ring-2 ring-amber-300'
          : selected
            ? tones.selected
            : isSearchHit
              ? 'border-amber-300 ring-1 ring-amber-200'
              : useDefaultBorder
                ? (depth === 0 ? tones.rootBorder : 'border-slate-200')
                : undefined,
        !isActive && 'opacity-90',
        isDragging && 'opacity-30',
        isOver && !isDragging && 'border-amber-500 ring-2 ring-amber-300',
        isOverflowSibling && 'border-dashed border-slate-300 bg-slate-50/90 text-slate-600',
      )}
      style={
        isActive && levelColorStyle
          ? {
              backgroundColor: levelColorStyle.backgroundColor,
              ...(useDefaultBorder
                ? {}
                : { borderColor: levelColorStyle.borderColor }),
            }
          : undefined
      }
    >
      {titleOnTop ? (
        <span
          className={cn(
            'absolute inset-x-1 top-0 z-[2] mx-auto -translate-y-1/2',
            titleBadgeClass,
          )}
          title={node.label}
        >
          {node.label}
        </span>
      ) : null}

      {levelTitle ? (
        <div className="absolute inset-x-1 bottom-0 z-[3] flex translate-y-1/2 items-center justify-center gap-1">
          {collapseButton}
          <span
            className={cn(levelBadgeClass, 'min-w-0')}
            style={
              levelColorStyle
                ? { backgroundColor: levelColorStyle.color }
                : undefined
            }
            title={levelTitle}
          >
            {levelTitle}
          </span>
        </div>
      ) : collapseButton ? (
        <div className="absolute left-1/2 bottom-0 z-[3] -translate-x-1/2 translate-y-1/2">
          {collapseButton}
        </div>
      ) : null}

      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg',
          (leadMember || !iconWellStyle) && (
            leadMember
              ? 'bg-slate-100'
              : !isActive
                ? 'bg-slate-100/80 text-slate-400'
                : depth === 0
                  ? tones.rootIcon
                  : 'bg-slate-50 text-slate-600'
          ),
        )}
        style={!leadMember ? iconWellStyle : undefined}
      >
        {leadMember ? (
          <OrgGeoPersonAvatar
            size="md"
            src={leadMember.avatarSrc}
            label={leadMember.displayName}
            className="h-10 w-10 rounded-lg border-0"
          />
        ) : (
          <BaseInfoUiIcon
            uiHtml={`<i data-lucide="${resolvedIcon}"></i>`}
            className="!h-6 !w-6 text-inherit"
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        {!titleOnTop ? (
          <span className={cn(
            'block truncate text-sm font-semibold leading-snug',
            isActive ? 'text-slate-800' : 'text-slate-500',
          )}>
            {node.label}
          </span>
        ) : null}
        {visibleMembers.length > 0 ? (
          <span
            className="flex items-center"
            style={{ marginTop: titleOnTop ? 0 : -NODE_AVATAR_OVERLAP_PX }}
            title={members.map((member) => member.displayName).join(', ')}
          >
            {visibleMembers.map((member, index) => (
              <OrgGeoPersonAvatar
                key={member.userId}
                size="sm"
                src={member.avatarSrc}
                label={member.displayName}
                className={cn(
                  'h-8 w-8 rounded-full border-0 bg-slate-100 shadow-sm ring-2 ring-white/90',
                  index > 0 && '-ms-1.5',
                )}
              />
            ))}
            {extraMemberCount > 0 ? (
              <span className="inline-flex h-8 min-w-8 -ms-1.5 items-center justify-center rounded-full border-0 bg-slate-200 px-1 text-[10px] font-bold text-slate-600 shadow-sm ring-2 ring-white/90">
                +{extraMemberCount}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>

      {hasChildren && showFocusAction && onFocusHere ? (
        <div
          className={cn(
            hoverActionClass,
            isFocusTarget && 'opacity-100 pointer-events-auto ring-1 ring-sky-300',
            'start-0 top-0 -translate-x-1/2 -translate-y-1/2',
          )}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <UiTooltip
            placement="top"
            delay={80}
            offset={10}
            showArrow
            disabled={isMoving}
            aria-label={isFocusTarget ? `Exit focus: ${node.label}` : `Focus here: ${node.label}`}
            className="inline-flex h-full w-full items-center justify-center rounded-full outline-none"
            contentClassName="z-[9999] max-w-[14rem] border border-slate-700/80 bg-slate-800 px-3 py-2 text-slate-100 shadow-lg"
            content={(
              <span className="flex items-start gap-2">
                <span className={cn(
                  'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  isFocusTarget ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300',
                )}>
                  {isFocusTarget ? (
                    <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  ) : (
                    <Crosshair className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight text-white">
                    {isFocusTarget ? 'Exit focus' : 'Focus here'}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-300">
                    {isFocusTarget
                      ? 'Show the full chart again'
                      : 'Zoom the chart to this branch only'}
                  </span>
                </span>
              </span>
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!isMoving) onFocusHere(node.id);
            }}
          >
            {isFocusTarget ? (
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            ) : (
              <Crosshair className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            )}
          </UiTooltip>
        </div>
      ) : null}
    </div>
  );
};

type OrgChartBranchProps = {
  node: OrgChartTreeNode;
  selectedId?: string;
  depth?: number;
  rootId: string;
  hiddenDiagramNodeIds?: ReadonlySet<string>;
  isMoving: boolean;
  activeDragId: string | null;
  searchHitIds: Set<string>;
  searchCurrentId: string | null;
  accent: 'sky' | 'emerald';
  layout: Exclude<OrgChartLayoutMode, 'pyramid' | 'radial' | 'free'>;
  membersByNodeId: Record<string, OrgChartNodeMember[]>;
  chartConfig?: OrgChartRootConfig | null;
  defaultFallbackIcon?: string;
  defaultLevelColor?: (depth: number) => string | undefined;
  collapsedIds: ReadonlySet<string>;
  focusedRootId?: string | null;
  onSelect: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onAddChild?: (nodeId: string) => void;
  onToggleCollapse?: (id: string) => void;
  onFocusHere?: (id: string) => void;
};

const OrgChartBranch: React.FC<OrgChartBranchProps> = ({
  node,
  selectedId,
  depth = 0,
  rootId,
  hiddenDiagramNodeIds,
  isMoving,
  activeDragId,
  searchHitIds,
  searchCurrentId,
  accent,
  layout,
  membersByNodeId,
  chartConfig,
  defaultFallbackIcon,
  defaultLevelColor,
  collapsedIds,
  focusedRootId = null,
  onSelect,
  onOpenDetails,
  onAddChild,
  onToggleCollapse,
  onFocusHere,
}) => {
  const rawChildren = node.children ?? [];
  const hasChildren = orgChartNodeHasChildren(node);
  const viewRootId = focusedRootId
    || (hiddenDiagramNodeIds?.has(ORG_CHART_FOREST_OMIT_NODE_ID)
      ? ORG_CHART_FOREST_OMIT_NODE_ID
      : rootId);
  const collapsed = collapsedIds.has(node.id) && node.id !== viewRootId;
  const children = collapsed ? [] : rawChildren;
  const isHorizontal = layout === 'horizontal';
  const levelFallbackIcon = resolveOrgChartLevelIcon(depth, chartConfig, defaultFallbackIcon);
  const levelTitle = node.typeLabel || readOrgChartLevelTitle(depth, chartConfig);
  const levelColor = resolveOrgChartLevelColorWithDefault(
    depth,
    chartConfig,
    node.color,
    defaultLevelColor,
  );

  if (hiddenDiagramNodeIds?.has(node.id)) {
    if (children.length === 0) return null;
    return (
      <div
        className={cn(
          'flex items-start',
          isHorizontal ? 'flex-col gap-4' : 'flex-row gap-6',
        )}
      >
        {children.map((child) => (
          <OrgChartBranch
            key={child.id}
            node={child}
            selectedId={selectedId}
            depth={depth}
            rootId={rootId}
            hiddenDiagramNodeIds={hiddenDiagramNodeIds}
            isMoving={isMoving}
            activeDragId={activeDragId}
            searchHitIds={searchHitIds}
            searchCurrentId={searchCurrentId}
            accent={accent}
            layout={layout}
            membersByNodeId={membersByNodeId}
            chartConfig={chartConfig}
            defaultFallbackIcon={defaultFallbackIcon}
            defaultLevelColor={defaultLevelColor}
            collapsedIds={collapsedIds}
            focusedRootId={focusedRootId}
            onSelect={onSelect}
            onOpenDetails={onOpenDetails}
            onAddChild={onAddChild}
            onToggleCollapse={onToggleCollapse}
            onFocusHere={onFocusHere}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center', isHorizontal ? 'flex-row' : 'flex-col')}>
      <OrgChartCard
        node={node}
        selected={selectedId === node.id}
        depth={depth}
        rootId={rootId}
        isMoving={isMoving}
        activeDragId={activeDragId}
        isSearchHit={searchHitIds.has(node.id)}
        isSearchCurrent={searchCurrentId === node.id}
        accent={accent}
        members={membersByNodeId[node.id] || []}
        levelFallbackIcon={levelFallbackIcon}
        levelTitle={levelTitle || undefined}
        levelColor={levelColor}
        hasChildren={hasChildren}
        collapsed={collapsed}
        showFocusAction={node.id !== rootId && !isOrgChartSiblingOverflowNodeId(node.id)}
        isFocusTarget={node.id === focusedRootId}
        onSelect={onSelect}
        onOpenDetails={onOpenDetails}
        onAddChild={onAddChild}
        onToggleCollapse={onToggleCollapse}
        onFocusHere={onFocusHere}
      />

      {children.length > 0 ? (
        <>
          <div
            className={cn('bg-slate-300', isHorizontal ? BRANCH_STUB_CLASS.horizontal : BRANCH_STUB_CLASS.vertical)}
            aria-hidden="true"
          />
          <div
            className={cn(
              'relative',
              isHorizontal ? 'flex flex-col items-start gap-2 py-0 ps-0' : 'flex items-start gap-3 px-1 pt-0',
            )}
          >
            {children.length > 1 ? (
              <div
                className={cn(
                  'pointer-events-none absolute bg-slate-300',
                  isHorizontal
                    ? 'start-0 top-1.5 bottom-1.5 w-px'
                    : 'start-1.5 end-1.5 top-0 h-px',
                )}
                aria-hidden="true"
              />
            ) : null}
            {children.map((child) => (
              <div
                key={child.id}
                className={cn(
                  'relative flex',
                  isHorizontal ? 'flex-row items-center' : 'flex-col items-center',
                )}
              >
                <div
                  className={cn('bg-slate-300', isHorizontal ? BRANCH_STUB_CLASS.horizontal : BRANCH_STUB_CLASS.vertical)}
                  aria-hidden="true"
                />
                <OrgChartBranch
                  node={child}
                  selectedId={selectedId}
                  depth={depth + 1}
                  rootId={rootId}
                  hiddenDiagramNodeIds={hiddenDiagramNodeIds}
                  isMoving={isMoving}
                  activeDragId={activeDragId}
                  searchHitIds={searchHitIds}
                  searchCurrentId={searchCurrentId}
                  accent={accent}
                  layout={layout}
                  membersByNodeId={membersByNodeId}
                  chartConfig={chartConfig}
                  defaultFallbackIcon={defaultFallbackIcon}
                  defaultLevelColor={defaultLevelColor}
                  collapsedIds={collapsedIds}
                  focusedRootId={focusedRootId}
                  onSelect={onSelect}
                  onOpenDetails={onOpenDetails}
                  onAddChild={onAddChild}
                  onToggleCollapse={onToggleCollapse}
                  onFocusHere={onFocusHere}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

type OrgChartPackedProps = {
  root: OrgChartTreeNode;
  selectedId?: string;
  rootId: string;
  hiddenDiagramNodeIds?: ReadonlySet<string>;
  isMoving: boolean;
  activeDragId: string | null;
  searchHitIds: Set<string>;
  searchCurrentId: string | null;
  accent: 'sky' | 'emerald';
  membersByNodeId: Record<string, OrgChartNodeMember[]>;
  chartConfig?: OrgChartRootConfig | null;
  defaultFallbackIcon?: string;
  defaultLevelColor?: (depth: number) => string | undefined;
  /** Absolute depth of the packed root in the full chart (focus offset). */
  depthOffset?: number;
  collapsedIds: ReadonlySet<string>;
  focusedRootId?: string | null;
  packLayout: (root: OrgChartTreeNode) => OrgChartPackedLayout;
  /** Lookup on the unpruned tree (for hasChildren). */
  findFullNode: (id: string) => OrgChartTreeNode | null;
  onSelect: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onAddChild?: (nodeId: string) => void;
  onToggleCollapse?: (id: string) => void;
  onFocusHere?: (id: string) => void;
  findNode: (id: string) => OrgChartTreeNode | null;
};

const OrgChartPackedView: React.FC<OrgChartPackedProps> = ({
  root,
  selectedId,
  rootId,
  hiddenDiagramNodeIds,
  isMoving,
  activeDragId,
  searchHitIds,
  searchCurrentId,
  accent,
  membersByNodeId,
  chartConfig,
  defaultFallbackIcon,
  defaultLevelColor,
  depthOffset = 0,
  collapsedIds,
  focusedRootId = null,
  packLayout,
  findFullNode,
  onSelect,
  onOpenDetails,
  onAddChild,
  onToggleCollapse,
  onFocusHere,
  findNode,
}) => {
  const packed = useMemo(() => packLayout(root), [packLayout, root]);
  const byId = useMemo(() => {
    const map = new Map(packed.nodes.map((node) => [node.id, node]));
    return map;
  }, [packed.nodes]);

  return (
    <div
      className="relative"
      style={{ width: packed.width, height: packed.height }}
    >
      <svg
        className="pointer-events-none absolute inset-0"
        width={packed.width}
        height={packed.height}
        aria-hidden
      >
        {packed.nodes.map((node) => {
          if (!node.parentId) return null;
          if (hiddenDiagramNodeIds?.has(node.parentId)) return null;
          const parent = byId.get(node.parentId);
          if (!parent) return null;
          const start = pointOnCardEdge(parent.x, parent.y, node.x, node.y);
          const end = pointOnCardEdge(node.x, node.y, parent.x, parent.y);
          return (
            <line
              key={`${node.parentId}->${node.id}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
      {packed.nodes.map((layoutNode) => {
        if (hiddenDiagramNodeIds?.has(layoutNode.id)) return null;
        const treeNode = findNode(layoutNode.id);
        if (!treeNode) return null;
        const absoluteDepth = layoutNode.depth + depthOffset;
        const fullNode = findFullNode(layoutNode.id);
        const hasChildren = orgChartNodeHasChildren(fullNode);
        return (
          <div
            key={layoutNode.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: layoutNode.x, top: layoutNode.y }}
          >
            <OrgChartCard
              node={treeNode}
              selected={selectedId === treeNode.id}
              depth={absoluteDepth}
              rootId={rootId}
              isMoving={isMoving}
              activeDragId={activeDragId}
              isSearchHit={searchHitIds.has(treeNode.id)}
              isSearchCurrent={searchCurrentId === treeNode.id}
              accent={accent}
              members={membersByNodeId[treeNode.id] || []}
              levelFallbackIcon={resolveOrgChartLevelIcon(
                absoluteDepth,
                chartConfig,
                defaultFallbackIcon,
              )}
              levelTitle={treeNode.typeLabel || readOrgChartLevelTitle(absoluteDepth, chartConfig) || undefined}
              levelColor={resolveOrgChartLevelColorWithDefault(
                absoluteDepth,
                chartConfig,
                treeNode.color,
                defaultLevelColor,
              )}
              hasChildren={hasChildren}
              collapsed={collapsedIds.has(treeNode.id)}
              showFocusAction={treeNode.id !== rootId}
              isFocusTarget={treeNode.id === focusedRootId}
              onSelect={onSelect}
              onOpenDetails={onOpenDetails}
              onAddChild={onAddChild}
              onToggleCollapse={onToggleCollapse}
              onFocusHere={onFocusHere}
            />
          </div>
        );
      })}
    </div>
  );
};

type OrgChartFreeProps = {
  root: OrgChartTreeNode;
  rootId: string;
  hiddenDiagramNodeIds?: ReadonlySet<string>;
  selectedId?: string;
  isMoving: boolean;
  searchHitIds: Set<string>;
  searchCurrentId: string | null;
  accent: 'sky' | 'emerald';
  membersByNodeId: Record<string, OrgChartNodeMember[]>;
  chartConfig?: OrgChartRootConfig | null;
  defaultFallbackIcon?: string;
  defaultLevelColor?: (depth: number) => string | undefined;
  zoom: number;
  /** Absolute depth of the free-layout root in the full chart (focus offset). */
  depthOffset?: number;
  collapsedIds: ReadonlySet<string>;
  focusedRootId?: string | null;
  findFullNode: (id: string) => OrgChartTreeNode | null;
  onSelect: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onAddChild?: (nodeId: string) => void;
  onToggleCollapse?: (id: string) => void;
  onFocusHere?: (id: string) => void;
  findNode: (id: string) => OrgChartTreeNode | null;
  onFreeDraggingChange?: (dragging: boolean) => void;
};

const OrgChartFreeView: React.FC<OrgChartFreeProps> = ({
  root,
  rootId,
  hiddenDiagramNodeIds,
  selectedId,
  isMoving,
  searchHitIds,
  searchCurrentId,
  accent,
  membersByNodeId,
  chartConfig,
  defaultFallbackIcon,
  defaultLevelColor,
  zoom,
  depthOffset = 0,
  collapsedIds,
  focusedRootId = null,
  findFullNode,
  onSelect,
  onOpenDetails,
  onAddChild,
  onToggleCollapse,
  onFocusHere,
  findNode,
  onFreeDraggingChange,
}) => {
  const [positions, setPositions] = useState<OrgChartFreePositions>(() => (
    mergeFreePositionsWithTree(root, readOrgChartFreePositions(rootId))
  ));
  const [activeFreeId, setActiveFreeId] = useState<string | null>(null);
  const positionsRef = useRef(positions);
  const rootIdRef = useRef(rootId);
  const persistTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);

  positionsRef.current = positions;
  rootIdRef.current = rootId;

  const nodeSignature = useMemo(() => (
    flattenChartNodes(root).map((row) => row.id).join('|')
  ), [root]);

  useEffect(() => {
    const merged = mergeFreePositionsWithTree(root, readOrgChartFreePositions(rootId));
    setPositions(merged);
    writeOrgChartFreePositions(rootId, merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed when tree membership changes
  }, [rootId, nodeSignature]);

  useEffect(() => () => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const persistSoon = (next: OrgChartFreePositions) => {
      if (typeof window === 'undefined') return;
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        persistTimerRef.current = null;
        writeOrgChartFreePositions(rootIdRef.current, next);
      }, FREE_POSITION_PERSIST_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const scale = zoom > 0 ? zoom : 1;
      const nextX = drag.originX + (event.clientX - drag.startClientX) / scale;
      const nextY = drag.originY + (event.clientY - drag.startClientY) / scale;
      setPositions((current) => {
        const next = {
          ...current,
          [drag.nodeId]: { x: nextX, y: nextY },
        };
        positionsRef.current = next;
        persistSoon(next);
        return next;
      });
    };

    const endDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setActiveFreeId(null);
      onFreeDraggingChange?.(false);
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      writeOrgChartFreePositions(rootIdRef.current, positionsRef.current);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [zoom, onFreeDraggingChange]);

  const handleFreePointerDown = (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (isMoving || event.button !== 0) return;
    const point = positions[nodeId];
    if (!point) return;
    event.preventDefault();
    dragRef.current = {
      nodeId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: point.x,
      originY: point.y,
    };
    setActiveFreeId(nodeId);
    onFreeDraggingChange?.(true);
  };

  const bounds = useMemo(() => measureFreeLayoutBounds(positions), [positions]);
  const depths = useMemo(() => collectFreeLayoutDepths(root), [root]);
  const edges = useMemo(() => collectFreeLayoutEdges(root), [root]);
  const nodeIds = useMemo(() => Object.keys(positions), [positions]);

  return (
    <div
      className="relative"
      style={{ width: bounds.width, height: bounds.height }}
    >
      <svg
        className="pointer-events-none absolute inset-0"
        width={bounds.width}
        height={bounds.height}
        aria-hidden
      >
        {edges.map((edge) => {
          if (hiddenDiagramNodeIds?.has(edge.parentId) || hiddenDiagramNodeIds?.has(edge.childId)) {
            return null;
          }
          const parent = positions[edge.parentId];
          const child = positions[edge.childId];
          if (!parent || !child) return null;
          const parentX = parent.x - bounds.originX;
          const parentY = parent.y - bounds.originY;
          const childX = child.x - bounds.originX;
          const childY = child.y - bounds.originY;
          const start = pointOnCardEdge(parentX, parentY, childX, childY);
          const end = pointOnCardEdge(childX, childY, parentX, parentY);
          return (
            <line
              key={`${edge.parentId}->${edge.childId}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
      {nodeIds.map((nodeId) => {
        if (hiddenDiagramNodeIds?.has(nodeId)) return null;
        const point = positions[nodeId];
        const treeNode = findNode(nodeId);
        if (!point || !treeNode) return null;
        const absoluteDepth = (depths[nodeId] ?? 0) + depthOffset;
        const fullNode = findFullNode(nodeId);
        const hasChildren = orgChartNodeHasChildren(fullNode);
        return (
          <div
            key={nodeId}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: point.x - bounds.originX,
              top: point.y - bounds.originY,
              zIndex: activeFreeId === nodeId ? 5 : 1,
            }}
          >
            <OrgChartCard
              node={treeNode}
              selected={selectedId === treeNode.id}
              depth={absoluteDepth}
              rootId={rootId}
              isMoving={isMoving}
              activeDragId={activeFreeId}
              isSearchHit={searchHitIds.has(treeNode.id)}
              isSearchCurrent={searchCurrentId === treeNode.id}
              accent={accent}
              members={membersByNodeId[treeNode.id] || []}
              levelFallbackIcon={resolveOrgChartLevelIcon(
                absoluteDepth,
                chartConfig,
                defaultFallbackIcon,
              )}
              levelTitle={treeNode.typeLabel || readOrgChartLevelTitle(absoluteDepth, chartConfig) || undefined}
              levelColor={resolveOrgChartLevelColorWithDefault(
                absoluteDepth,
                chartConfig,
                treeNode.color,
                defaultLevelColor,
              )}
              hasChildren={hasChildren}
              collapsed={collapsedIds.has(treeNode.id)}
              showFocusAction={treeNode.id !== rootId}
              isFocusTarget={treeNode.id === focusedRootId}
              onSelect={onSelect}
              onOpenDetails={onOpenDetails}
              onAddChild={onAddChild}
              onToggleCollapse={onToggleCollapse}
              onFocusHere={onFocusHere}
              interactionMode="free"
              onFreePointerDown={handleFreePointerDown}
            />
          </div>
        );
      })}
    </div>
  );
};

export type OrgChartTreeViewActions = {
  expandAll: () => void;
  collapseAll: () => void;
};

type OrgChartCanvasProps = {
  roots: OrgChartTreeNode[];
  /** Omit the platform tree root card; show direct children as parallel diagram roots. */
  hideChartRootInDiagram?: boolean;
  rootLabel: string;
  rootId: string;
  rootIcon?: string | null;
  /** Optional root `ui_color` — overrides level-0 color when set. */
  rootColor?: string | null;
  rootIsActive?: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  isLoading: boolean;
  isMoving?: boolean;
  accent?: 'sky' | 'emerald';
  membersByNodeId?: Record<string, OrgChartNodeMember[]>;
  chartConfig?: OrgChartRootConfig | null;
  defaultFallbackIcon?: string;
  defaultLevelColor?: (depth: number) => string | undefined;
  canDropNode?: (sourceId: string, targetId: string, position: TreeDropPosition) => boolean;
  onMoveNode?: (sourceId: string, targetId: string, position: TreeDropPosition) => void;
  onAddChild?: (nodeId: string) => void;
  /** Load remaining descendants, then the canvas opens every branch. */
  onRequestExpandAll?: () => Promise<void> | void;
  /** Lazy-load children when a collapsed node is expanded. */
  onEnsureChildrenLoaded?: (nodeId: string) => void;
  /** Expand this node after a create/delete so the operator sees the change. */
  revealNodeId?: string | null;
  onRevealHandled?: () => void;
  /** Floating chart actions over the canvas. */
  toolbar?: React.ReactNode | ((actions: OrgChartTreeViewActions) => React.ReactNode);
  /** How many chart levels stay expanded by default (0 = view root). */
  defaultOpenDepth?: number;
};

const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));

const measureNaturalContentSize = (content: HTMLElement): { width: number; height: number } => {
  const previousZoom = content.style.zoom;
  // CSS `zoom` can leave offsetWidth either scaled or unscaled by browser —
  // always measure at zoom=1 so fit is stable across repeated clicks.
  content.style.zoom = '1';
  const width = content.offsetWidth;
  const height = content.offsetHeight;
  content.style.zoom = previousZoom;
  return { width, height };
};

const measureFitZoom = (
  viewport: HTMLElement,
  content: HTMLElement,
): number | null => {
  const { width: naturalWidth, height: naturalHeight } = measureNaturalContentSize(content);
  if (naturalWidth <= 0 || naturalHeight <= 0) return null;

  const availableWidth = Math.max(0, viewport.clientWidth - VIEWPORT_PADDING_PX * 2);
  const availableHeight = Math.max(0, viewport.clientHeight - VIEWPORT_PADDING_PX * 2);
  if (availableWidth <= 0 || availableHeight <= 0) return null;

  return clampZoom(
    Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight) * FIT_MARGIN,
  );
};

const panViewportToCenter = (viewport: HTMLElement, target: HTMLElement) => {
  const viewportRect = viewport.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  viewport.scrollLeft += (targetRect.left + targetRect.width / 2) - (viewportRect.left + viewportRect.width / 2);
  viewport.scrollTop += (targetRect.top + targetRect.height / 2) - (viewportRect.top + viewportRect.height / 2);
};

const findNodeLabel = (node: OrgChartTreeNode, id: string): string | null => {
  if (node.id === id) return node.label;
  for (const child of node.children ?? []) {
    const found = findNodeLabel(child, id);
    if (found) return found;
  }
  return null;
};

const findNodeById = (node: OrgChartTreeNode, id: string): OrgChartTreeNode | null => {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
};

const LAYOUT_ICONS: Record<OrgChartLayoutMode, React.ReactNode> = {
  vertical: <Rows2 className="h-3.5 w-3.5" />,
  horizontal: <Columns2 className="h-3.5 w-3.5" />,
  pyramid: <Triangle className="h-3.5 w-3.5" />,
  radial: <Circle className="h-3.5 w-3.5" />,
  free: <Move className="h-3.5 w-3.5" />,
};

export const OrgChartCanvas: React.FC<OrgChartCanvasProps> = ({
  roots,
  hideChartRootInDiagram = false,
  rootLabel,
  rootId,
  rootIcon,
  rootColor,
  rootIsActive = true,
  selectedId,
  onSelect,
  onOpenDetails,
  isLoading,
  isMoving = false,
  accent = 'sky',
  membersByNodeId = {},
  chartConfig = null,
  defaultFallbackIcon,
  defaultLevelColor,
  canDropNode,
  onMoveNode,
  onAddChild,
  onRequestExpandAll,
  onEnsureChildrenLoaded,
  revealNodeId,
  onRevealHandled,
  toolbar,
  defaultOpenDepth = ORG_CHART_DEFAULT_OPEN_DEPTH,
}) => {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [layout, setLayout] = useState<OrgChartLayoutMode>(() => readOrgChartLayoutMode(rootId));
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [focusedRootId, setFocusedRootId] = useState<string | null>(() => (
    readOrgChartFocusedRootId(rootId)
  ));
  const [expandedSiblingParentIds, setExpandedSiblingParentIds] = useState<Set<string>>(() => new Set());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const hydratedRef = useRef(false);
  const hydratedRootRef = useRef<string | null>(null);
  const skipFitOnLayoutRef = useRef(true);
  const persistTimerRef = useRef<number | null>(null);
  const isNodeDraggingRef = useRef(false);
  const expandAllModeRef = useRef(false);
  const expandAllInFlightRef = useRef(false);
  const userExpandedIdsRef = useRef<Set<string>>(new Set());

  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  zoomRef.current = zoom;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const chartRoot: OrgChartTreeNode = {
    id: rootId,
    label: rootLabel,
    isActive: rootIsActive,
    ...(rootIcon ? { icon: rootIcon } : {}),
    ...(rootColor?.trim() ? { color: rootColor.trim() } : {}),
    children: roots,
  };

  const focusNode = focusedRootId ? findNodeById(chartRoot, focusedRootId) : null;
  const viewRoot = focusNode ?? chartRoot;
  const viewDepth = focusNode && focusedRootId
    ? (findOrgChartNodeDepth(chartRoot, focusedRootId) ?? 0)
    : 0;
  const displayRoot = useMemo(
    () => pruneOrgChartCollapsed(viewRoot, collapsedIds),
    // viewRoot identity changes each render; depend on stable inputs + focus/collapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collapsedIds, focusedRootId, rootId, rootLabel, roots, rootIcon, rootColor, rootIsActive],
  );

  const forestOmitActive = hideChartRootInDiagram && !focusedRootId;

  const performanceLimitedRoot = useMemo(() => {
    const pinned = collectOrgChartAncestorIds(chartRoot, selectedId);
    return limitOrgChartSiblingFanout(displayRoot, {
      maxSiblings: ORG_CHART_MAX_SIBLINGS_PER_PARENT,
      expandedParentIds: expandedSiblingParentIds,
      pinnedNodeIds: pinned,
    });
  }, [
    chartRoot,
    displayRoot,
    expandedSiblingParentIds,
    selectedId,
  ]);

  const diagramRoot = useMemo((): OrgChartTreeNode => {
    const base = performanceLimitedRoot;
    if (!forestOmitActive) return base;
    const topChildren = base.id === rootId
      ? (base.children ?? [])
      : (base.children ?? []);
    return {
      id: ORG_CHART_FOREST_OMIT_NODE_ID,
      label: '',
      isActive: true,
      children: topChildren.length > 0 ? topChildren : (base.id === rootId ? [] : [base]),
    };
  }, [forestOmitActive, performanceLimitedRoot, rootId]);

  const handleChartSelect = (id: string) => {
    if (isOrgChartSiblingOverflowNodeId(id)) {
      const parentId = orgChartOverflowParentId(id);
      if (parentId) {
        setExpandedSiblingParentIds((current) => {
          const next = new Set(current);
          next.add(parentId);
          return next;
        });
      }
      return;
    }
    onSelect(id);
  };

  const hiddenDiagramNodeIds = useMemo((): ReadonlySet<string> => {
    if (!forestOmitActive) return new Set();
    return new Set([ORG_CHART_FOREST_OMIT_NODE_ID, rootId]);
  }, [forestOmitActive, rootId]);

  const canZoomOut = zoom > ZOOM_MIN;
  const canZoomIn = zoom < ZOOM_MAX;
  const activeLabel = activeDragId ? findNodeLabel(chartRoot, activeDragId) : null;

  const searchMatches = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return [] as string[];
    return flattenChartNodes(chartRoot)
      .filter((row) => {
        if (hiddenDiagramNodeIds.has(row.id)) return false;
        if (row.label.toLowerCase().includes(needle)) return true;
        const members = membersByNodeId[row.id] || [];
        return members.some((member) => member.displayName.toLowerCase().includes(needle));
      })
      .map((row) => row.id);
    // chartRoot is rebuilt each render — depend on the stable inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenDiagramNodeIds, searchQuery, rootId, rootLabel, roots, rootIcon, rootColor, rootIsActive, membersByNodeId]);

  const searchHitIds = useMemo(() => new Set(searchMatches), [searchMatches]);
  const safeMatchIndex = searchMatches.length === 0
    ? 0
    : Math.min(matchIndex, searchMatches.length - 1);
  const searchCurrentId = searchMatches.length > 0 ? searchMatches[safeMatchIndex] ?? null : null;

  useEffect(() => {
    skipFitOnLayoutRef.current = true;
    expandAllModeRef.current = false;
    expandAllInFlightRef.current = false;
    userExpandedIdsRef.current = new Set();
    setLayout(readOrgChartLayoutMode(rootId));
    setFocusedRootId(readOrgChartFocusedRootId(rootId));
    setExpandedSiblingParentIds(new Set());
    setCollapsedIds(new Set());
  }, [rootId]);

  useEffect(() => {
    writeOrgChartLayoutMode(rootId, layout);
  }, [rootId, layout]);

  useEffect(() => {
    writeOrgChartFocusedRootId(rootId, focusedRootId);
  }, [rootId, focusedRootId]);

  useEffect(() => {
    writeOrgChartCollapsedIds(rootId, collapsedIds);
  }, [rootId, collapsedIds]);

  useEffect(() => {
    if (isLoading && !expandAllInFlightRef.current) {
      expandAllModeRef.current = false;
      userExpandedIdsRef.current = new Set();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;
    setCollapsedIds((current) => {
      let changed = false;
      const next = new Set(current);
      const walk = (node: OrgChartTreeNode, depth: number) => {
        const kids = node.children ?? [];
        if (orgChartNodeHasChildren(node) && depth >= defaultOpenDepth) {
          const shouldCollapse = !expandAllModeRef.current
            && !userExpandedIdsRef.current.has(node.id);
          if (shouldCollapse && !next.has(node.id)) {
            next.add(node.id);
            changed = true;
          }
        }
        for (const child of kids) walk(child, depth + 1);
      };
      walk(chartRoot, 0);
      return changed ? next : current;
    });
    // chartRoot is rebuilt each render — depend on the stable inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpenDepth, isLoading, rootId, roots, rootLabel, rootIcon, rootColor, rootIsActive]);

  useEffect(() => {
    if (!revealNodeId) return;
    userExpandedIdsRef.current.add(revealNodeId);
    setCollapsedIds((current) => {
      if (!current.has(revealNodeId)) return current;
      const next = new Set(current);
      next.delete(revealNodeId);
      return next;
    });
    onEnsureChildrenLoaded?.(revealNodeId);
    onRevealHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealNodeId]);

  useEffect(() => {
    setMatchIndex(0);
  }, [searchQuery, rootId]);

  // Drop stale focus when the focused node is gone from the tree.
  useEffect(() => {
    if (!focusedRootId) return;
    if (!findNodeById(chartRoot, focusedRootId)) {
      setFocusedRootId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedRootId, rootId, roots]);

  // Exit focus when the current search match lies outside the focused subtree.
  useEffect(() => {
    if (!searchCurrentId || !focusedRootId) return;
    const subtree = findNodeById(chartRoot, focusedRootId);
    if (!subtree || !findNodeById(subtree, searchCurrentId)) {
      setFocusedRootId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCurrentId, focusedRootId, rootId, roots]);

  // Expand collapsed ancestors so the current search match is visible.
  useEffect(() => {
    if (!searchCurrentId) return;
    setCollapsedIds((current) => {
      if (current.size === 0) return current;
      const path: string[] = [];
      const walk = (node: OrgChartTreeNode, trail: string[]): boolean => {
        const nextTrail = [...trail, node.id];
        if (node.id === searchCurrentId) {
          path.push(...trail);
          return true;
        }
        for (const child of node.children ?? []) {
          if (walk(child, nextTrail)) return true;
        }
        return false;
      };
      walk(chartRoot, []);
      if (path.length === 0) return current;
      let changed = false;
      const next = new Set(current);
      for (const id of path) {
        if (next.has(id)) {
          next.delete(id);
          userExpandedIdsRef.current.add(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCurrentId, rootId, roots]);

  const changeLayout = (next: OrgChartLayoutMode) => {
    if (next === layout) return;
    skipFitOnLayoutRef.current = false;
    setLayout(next);
  };

  const handleFocusHere = (id: string) => {
    if (!id || id === rootId) return;
    setFocusedRootId((current) => (current === id ? null : id));
  };

  const handleToggleCollapse = (id: string) => {
    const viewRootId = focusedRootId
      || (forestOmitActive ? ORG_CHART_FOREST_OMIT_NODE_ID : rootId);
    if (id === viewRootId) return;
    const isCollapsed = collapsedIds.has(id);
    if (isCollapsed) {
      userExpandedIdsRef.current.add(id);
      setCollapsedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      onEnsureChildrenLoaded?.(id);
      return;
    }
    if (expandAllModeRef.current) {
      expandAllModeRef.current = false;
      const defaults = collectOrgChartCollapsedBeyondDepth(
        chartRoot,
        defaultOpenDepth,
      );
      userExpandedIdsRef.current = new Set(defaults.filter((nodeId) => nodeId !== id));
    } else {
      userExpandedIdsRef.current.delete(id);
    }
    setCollapsedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  const handleCollapseAll = () => {
    expandAllModeRef.current = false;
    userExpandedIdsRef.current = new Set();
    setCollapsedIds(new Set(
      collectOrgChartCollapsedBeyondDepth(chartRoot, defaultOpenDepth),
    ));
  };

  const handleExpandAll = () => {
    expandAllModeRef.current = true;
    expandAllInFlightRef.current = true;
    userExpandedIdsRef.current = new Set();
    void Promise.resolve(onRequestExpandAll?.()).finally(() => {
      expandAllInFlightRef.current = false;
      setCollapsedIds(new Set());
    });
  };

  const toolbarNode = typeof toolbar === 'function'
    ? toolbar({ expandAll: handleExpandAll, collapseAll: handleCollapseAll })
    : toolbar;

  useEffect(() => {
    if (!searchCurrentId) return;
    onSelect(searchCurrentId);
    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const target = viewport.querySelector<HTMLElement>(
        `[data-node-id="${CSS.escape(searchCurrentId)}"]`,
      );
      if (!target) return;
      panViewportToCenter(viewport, target);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [searchCurrentId, focusedRootId, onSelect]);

  const goToMatch = (direction: -1 | 1) => {
    if (searchMatches.length === 0) return;
    setMatchIndex((current) => {
      const next = (current + direction + searchMatches.length) % searchMatches.length;
      return next;
    });
  };

  useEffect(() => {
    if (!activeDragId) {
      setDragPointer(null);
      return;
    }
    const onPointerMove = (event: PointerEvent) => {
      setDragPointer({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [activeDragId]);

  const persistViewport = (nextZoom = zoomRef.current) => {
    const viewport = viewportRef.current;
    if (!viewport || !hydratedRef.current) return;
    writeOrgChartViewportPrefs(rootId, {
      zoom: clampZoom(nextZoom),
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    });
  };

  const schedulePersist = (nextZoom = zoomRef.current) => {
    if (typeof window === 'undefined') return;
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      persistViewport(nextZoom);
    }, PERSIST_DEBOUNCE_MS);
  };

  const fitChart = () => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const nextZoom = measureFitZoom(viewport, content);
    if (nextZoom == null) return;

    setZoom(nextZoom);
    viewport.scrollTo({ top: 0, left: 0 });
    hydratedRef.current = true;
    hydratedRootRef.current = rootId;
    writeOrgChartViewportPrefs(rootId, {
      zoom: nextZoom,
      scrollLeft: 0,
      scrollTop: 0,
    });
  };

  useEffect(() => {
    if (isLoading) return;
    if (skipFitOnLayoutRef.current) {
      skipFitOnLayoutRef.current = false;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      fitChart();
    });
    return () => window.cancelAnimationFrame(frame);
    // Refit when the user switches orientation so densest useful zoom is applied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, isLoading]);

  useEffect(() => {
    hydratedRef.current = false;
    hydratedRootRef.current = null;
    skipFitOnLayoutRef.current = true;
    setZoom(ZOOM_DEFAULT);
  }, [rootId]);

  useEffect(() => {
    if (isLoading) return;
    if (hydratedRef.current && hydratedRootRef.current === rootId) return;

    let cancelled = false;

    const hydrate = (): boolean => {
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content || cancelled) return false;
      if (content.offsetWidth < 8 || content.offsetHeight < 8) return false;

      const saved = readOrgChartViewportPrefs(rootId, clampZoom);
      if (saved) {
        setZoom(saved.zoom);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (cancelled || !viewportRef.current) return;
            viewportRef.current.scrollTo({
              left: saved.scrollLeft,
              top: saved.scrollTop,
            });
            hydratedRef.current = true;
            hydratedRootRef.current = rootId;
          });
        });
        return true;
      }

      const nextZoom = measureFitZoom(viewport, content);
      if (nextZoom == null) return false;
      setZoom(nextZoom);
      viewport.scrollTo({ top: 0, left: 0 });
      writeOrgChartViewportPrefs(rootId, {
        zoom: nextZoom,
        scrollLeft: 0,
        scrollTop: 0,
      });
      hydratedRef.current = true;
      hydratedRootRef.current = rootId;
      return true;
    };

    window.requestAnimationFrame(() => {
      if (cancelled) return;
      if (hydrate()) return;
      window.requestAnimationFrame(() => {
        if (!cancelled) {
          hydrate();
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, rootId, roots, rootLabel]);

  useEffect(() => {
    if (!hydratedRef.current || hydratedRootRef.current !== rootId) return;
    schedulePersist(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist only when zoom changes after hydrate
  }, [zoom, rootId]);

  useEffect(() => () => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (isLoading || isNodeDraggingRef.current) return;
      event.preventDefault();

      const direction = event.deltaY > 0 ? -1 : event.deltaY < 0 ? 1 : 0;
      if (direction === 0) return;

      const oldZoom = zoomRef.current;
      const nextZoom = clampZoom(oldZoom + direction * ZOOM_STEP);
      if (nextZoom === oldZoom) return;

      const rect = viewport.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const contentX = (viewport.scrollLeft + offsetX) / oldZoom;
      const contentY = (viewport.scrollTop + offsetY) / oldZoom;

      setZoom(nextZoom);
      window.requestAnimationFrame(() => {
        viewport.scrollLeft = contentX * nextZoom - offsetX;
        viewport.scrollTop = contentY * nextZoom - offsetY;
        schedulePersist(nextZoom);
      });
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attach once; reads refs
  }, [isLoading]);

  const endPan = (pointerId: number) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== pointerId) return;
    panRef.current = null;
    setIsPanning(false);
    schedulePersist();
  };

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isLoading || isNodeDraggingRef.current) return;
    const isPrimary = event.button === 0;
    const isMiddle = event.button === 1;
    if (!isPrimary && !isMiddle) return;

    const target = event.target as HTMLElement | null;
    if (isPrimary && target?.closest('[data-org-chart-node="true"]')) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    if (isMiddle) {
      event.preventDefault();
    }

    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const viewport = viewportRef.current;
    if (!pan || !viewport || pan.pointerId !== event.pointerId) return;

    viewport.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
    viewport.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const sourceId = readNodeIdFromDnd(
      event.active.id,
      event.active.data.current as Record<string, unknown> | undefined,
      'org-chart-drag:',
    );
    if (!sourceId) return;
    isNodeDraggingRef.current = true;
    setActiveDragId(sourceId);
    const activator = event.activatorEvent;
    if (activator && 'clientX' in activator && 'clientY' in activator) {
      setDragPointer({
        x: Number(activator.clientX),
        y: Number(activator.clientY),
      });
    }
    if (panRef.current) {
      panRef.current = null;
      setIsPanning(false);
    }
  };

  const handleDragCancel = () => {
    isNodeDraggingRef.current = false;
    setActiveDragId(null);
    setDragPointer(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    isNodeDraggingRef.current = false;
    setActiveDragId(null);
    setDragPointer(null);

    const sourceId = readNodeIdFromDnd(
      event.active.id,
      event.active.data.current as Record<string, unknown> | undefined,
      'org-chart-drag:',
    );
    const targetId = event.over
      ? readNodeIdFromDnd(
        event.over.id,
        event.over.data.current as Record<string, unknown> | undefined,
        'org-chart-drop:',
      )
      : null;
    if (!sourceId || !targetId || sourceId === targetId) return;

    const position: TreeDropPosition = 'inside';
    if (canDropNode && !canDropNode(sourceId, targetId, position)) return;
    onMoveNode?.(sourceId, targetId, position);
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden select-none">
      <CanvasSearchBox
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search nodes or people…"
        ariaLabel="Search chart nodes or people"
        disabled={isLoading}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            goToMatch(event.shiftKey ? -1 : 1);
          }
        }}
        trailing={(
          <>
            {searchQuery.trim() ? (
              <span className="shrink-0 px-1 text-[10px] font-semibold tabular-nums text-slate-500">
                {searchMatches.length === 0
                  ? '0/0'
                  : `${safeMatchIndex + 1}/${searchMatches.length}`}
              </span>
            ) : null}
            <AppButton
              type="button"
              intent="utility"
              size="icon-sm"
              disabled={isLoading || searchMatches.length === 0}
              aria-label="Previous match"
              title="Previous match"
              onClick={() => goToMatch(-1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </AppButton>
            <AppButton
              type="button"
              intent="utility"
              size="icon-sm"
              disabled={isLoading || searchMatches.length === 0}
              aria-label="Next match"
              title="Next match"
              onClick={() => goToMatch(1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </AppButton>
          </>
        )}
      />

      <div
        className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {toolbarNode}
      </div>

      <div
        className={CANVAS_ZOOM_CONTROLS_ANCHOR_CLASS}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <CanvasViewportControls
          disabled={isLoading}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
          onZoomOut={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
          onFitView={fitChart}
        />
      </div>

      <div
        className={CANVAS_LAYOUT_CONTROLS_ANCHOR_CLASS}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
          {ORG_CHART_LAYOUT_MODES.map((mode) => {
            const active = layout === mode;
            return (
              <AppButton
                key={mode}
                type="button"
                intent={active ? 'secondary' : 'utility'}
                size="icon-sm"
                className={cn(active && 'ring-1 ring-slate-300')}
                disabled={isLoading}
                aria-label={ORG_CHART_LAYOUT_LABELS[mode]}
                aria-pressed={active}
                title={ORG_CHART_LAYOUT_LABELS[mode]}
                onClick={() => changeLayout(mode)}
              >
                {LAYOUT_ICONS[mode]}
              </AppButton>
            );
          })}
        </div>
      </div>

      <div
        ref={viewportRef}
        className={cn(
          'min-h-0 flex-1 select-none bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)] [background-size:16px_16px] p-6',
          CANVAS_PAN_VIEWPORT_CLASS,
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onScroll={() => {
          if (!hydratedRef.current) return;
          schedulePersist();
        }}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={(event) => endPan(event.pointerId)}
        onPointerCancel={(event) => endPan(event.pointerId)}
        onLostPointerCapture={(event) => endPan(event.pointerId)}
      >
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-400">Drawing chart…</div>
        ) : layout === 'free' ? (
          <div
            ref={contentRef}
            className="mx-auto w-fit"
            style={{ zoom }}
          >
            <OrgChartFreeView
              root={diagramRoot}
              rootId={rootId}
              hiddenDiagramNodeIds={hiddenDiagramNodeIds}
              selectedId={selectedId}
              isMoving={isMoving}
              searchHitIds={searchHitIds}
              searchCurrentId={searchCurrentId}
              accent={accent}
              membersByNodeId={membersByNodeId}
              chartConfig={chartConfig}
              defaultFallbackIcon={defaultFallbackIcon}
              defaultLevelColor={defaultLevelColor}
              zoom={zoom}
              depthOffset={viewDepth}
              collapsedIds={collapsedIds}
              focusedRootId={focusedRootId}
              findFullNode={(id) => findNodeById(chartRoot, id)}
              onSelect={handleChartSelect}
              onOpenDetails={onOpenDetails}
              onAddChild={onAddChild}
              onToggleCollapse={handleToggleCollapse}
              onFocusHere={handleFocusHere}
              findNode={(id) => findNodeById(diagramRoot, id)}
              onFreeDraggingChange={(dragging) => {
                isNodeDraggingRef.current = dragging;
              }}
            />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={chartCollisionDetection}
            measuring={{
              droppable: { strategy: MeasuringStrategy.Always },
            }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div
              ref={contentRef}
              className="mx-auto w-fit"
              style={{ zoom }}
            >
              {layout === 'radial' || layout === 'pyramid' ? (
                <OrgChartPackedView
                  root={diagramRoot}
                  selectedId={selectedId}
                  rootId={rootId}
                  hiddenDiagramNodeIds={hiddenDiagramNodeIds}
                  isMoving={isMoving}
                  activeDragId={activeDragId}
                  searchHitIds={searchHitIds}
                  searchCurrentId={searchCurrentId}
                  accent={accent}
                  membersByNodeId={membersByNodeId}
                  chartConfig={chartConfig}
                  defaultFallbackIcon={defaultFallbackIcon}
                  defaultLevelColor={defaultLevelColor}
                  depthOffset={viewDepth}
                  collapsedIds={collapsedIds}
                  focusedRootId={focusedRootId}
                  packLayout={layout === 'pyramid' ? layoutOrgChartPyramid : layoutOrgChartRadial}
                  findFullNode={(id) => findNodeById(chartRoot, id)}
                  onSelect={handleChartSelect}
                  onOpenDetails={onOpenDetails}
                  onAddChild={onAddChild}
                  onToggleCollapse={handleToggleCollapse}
                  onFocusHere={handleFocusHere}
                  findNode={(id) => findNodeById(diagramRoot, id)}
                />
              ) : (
                <OrgChartBranch
                  node={diagramRoot}
                  selectedId={selectedId}
                  depth={forestOmitActive ? 0 : viewDepth}
                  rootId={rootId}
                  hiddenDiagramNodeIds={hiddenDiagramNodeIds}
                  isMoving={isMoving}
                  activeDragId={activeDragId}
                  searchHitIds={searchHitIds}
                  searchCurrentId={searchCurrentId}
                  accent={accent}
                  layout={layout}
                  membersByNodeId={membersByNodeId}
                  chartConfig={chartConfig}
                  defaultFallbackIcon={defaultFallbackIcon}
                  defaultLevelColor={defaultLevelColor}
                  collapsedIds={collapsedIds}
                  focusedRootId={focusedRootId}
                  onSelect={handleChartSelect}
                  onOpenDetails={onOpenDetails}
                  onAddChild={onAddChild}
                  onToggleCollapse={handleToggleCollapse}
                  onFocusHere={handleFocusHere}
                />
              )}
            </div>
          </DndContext>
        )}
      </div>

      {activeLabel && dragPointer ? (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none fixed z-[80] origin-center rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-lg',
            ACCENT[accent].overlay,
          )}
          style={{
            left: dragPointer.x,
            top: dragPointer.y,
            transform: `translate(-50%, -50%) scale(${zoom})`,
          }}
        >
          {activeLabel}
        </div>
      ) : null}
    </div>
  );
};
