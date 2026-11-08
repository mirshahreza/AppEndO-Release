import * as React from 'react';
import {
  DESIGNER_PALETTE,
  getDesignerPaletteCatalog,
  setDesignerPaletteCatalog,
} from '../../../domain/component-designer/catalog';
import { buildPublicToolboxFromCatalog } from '../../../domain/component-designer/toolboxFromCatalog';
import { buildSlotPaletteItems } from '../../../domain/component-designer/slotPalette';
import { buildPlatformNavigationPaletteItems } from '../../../domain/component-designer/navigationComponentPalette';
import { buildShellChromePaletteItems } from '../../../domain/component-designer/shellChromePalette';
import { buildPlatformChromePaletteItems } from '../../../domain/component-designer/platformChromePalette';
import { useAuth } from '../../../contexts/AuthContext';
import { useSlotsCatalogQuery } from '../../../shared/api/queries/slots';
import type { DesignerPaletteItem } from '../../../domain/component-designer/types';
import {
  type ComponentDesignerPaletteCatalog,
  type DesignerCatalogItem,
  useComponentDesignerPaletteCatalogQuery,
} from '../../../shared/api/queries/component-designer';
import {
  pushRecentlyUsedItemId,
  readDesignerToolboxPrefs,
  resolveDesignerToolboxPrefs,
  resolveRecentlyUsedPaletteItems,
  writeDesignerToolboxPrefs,
  type DesignerToolboxExpandableId,
} from '../lib/designerToolboxPrefs';
import {
  buildToolboxGroupedPalette,
  DESIGNER_TOOLBOX_GROUP_LABELS,
  type DesignerToolboxGroup,
} from '../utils/designerToolboxGroups';
import { filterAndRankToolboxPalette } from '../utils/designerToolboxSearch';

export type { DesignerToolboxGroup, DesignerToolboxExpandableId };
export {
  buildToolboxGroupedPalette,
  DESIGNER_TOOLBOX_GROUP_LABELS,
  resolveToolboxGroup,
  DESIGNER_TOOLBOX_GROUPS,
} from '../utils/designerToolboxGroups';
export {
  TOOLBOX_RECENTLY_USED_ID,
  TOOLBOX_RECENTLY_USED_LABEL,
  TOOLBOX_RECENTLY_USED_MAX,
  TOOLBOX_DEFAULT_EXPANDED_SECTIONS,
} from '../lib/designerToolboxPrefs';

const TOOLBOX_PALETTE_ITEM_WIDTH = 92;
const TOOLBOX_PALETTE_GRID_GAP = 6;
const TOOLBOX_DEFAULT_WIDTH = 480;
const TOOLBOX_DEFAULT_HEIGHT = 720;
const TOOLBOX_MIN_WIDTH = 320;
const TOOLBOX_MIN_HEIGHT = 360;
const TOOLBOX_MAX_WIDTH = 720;

export type ToolboxSize = { width: number; height: number };

export type UseDesignerPaletteParams = {
  middleLayoutRef: React.RefObject<HTMLDivElement | null>;
};

const clampToolboxSize = (
  size: ToolboxSize,
  position: { x: number; y: number },
  hostWidth: number,
  hostHeight: number,
): ToolboxSize => {
  const maxWidth = Math.max(TOOLBOX_MIN_WIDTH, Math.min(TOOLBOX_MAX_WIDTH, hostWidth - position.x));
  const maxHeight = Math.max(TOOLBOX_MIN_HEIGHT, hostHeight - position.y);
  return {
    width: Math.max(TOOLBOX_MIN_WIDTH, Math.min(maxWidth, size.width)),
    height: Math.max(TOOLBOX_MIN_HEIGHT, Math.min(maxHeight, size.height)),
  };
};

const clampToolboxPosition = (
  position: { x: number; y: number },
  size: ToolboxSize,
  hostWidth: number,
  hostHeight: number,
): { x: number; y: number } => {
  const maxX = Math.max(0, hostWidth - size.width);
  const maxY = Math.max(0, hostHeight - size.height);
  return {
    x: Math.max(0, Math.min(maxX, position.x)),
    y: Math.max(0, Math.min(maxY, position.y)),
  };
};

export type UseDesignerPaletteResult = {
  paletteItems: DesignerPaletteItem[];
  paletteLoadError: string | null;
  filteredPalette: DesignerPaletteItem[];
  groupedPalette: Array<{ category: DesignerToolboxGroup; label: string; items: DesignerPaletteItem[] }>;
  recentlyUsedPaletteItems: DesignerPaletteItem[];
  expandedPaletteCategories: ReadonlySet<DesignerToolboxExpandableId>;
  togglePaletteCategory: (category: DesignerToolboxExpandableId) => void;
  recordRecentlyUsedPaletteItem: (itemId: string) => void;
  isToolboxOpen: boolean;
  setIsToolboxOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toolboxPosition: { x: number; y: number };
  toolboxSize: ToolboxSize;
  toolboxSearchQuery: string;
  setToolboxSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  toolboxMenuRef: React.RefObject<HTMLDivElement | null>;
  toolboxPanelRef: React.RefObject<HTMLDivElement | null>;
  handleOpenToolbox: () => void;
  handleToolboxHeaderPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxHeaderPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxHeaderPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxResizePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxResizePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleToolboxResizePointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
};

export const useDesignerPalette = ({
  middleLayoutRef,
}: UseDesignerPaletteParams): UseDesignerPaletteResult => {
  const { currentUser } = useAuth();
  const toolboxUserKey = currentUser?.id != null ? String(currentUser.id) : 'anonymous';

  const [paletteItems, setPaletteItems] = React.useState<DesignerPaletteItem[]>(() => getDesignerPaletteCatalog());
  const [paletteLoadError, setPaletteLoadError] = React.useState<string | null>(null);
  const [expandedPaletteCategories, setExpandedPaletteCategories] = React.useState<ReadonlySet<DesignerToolboxExpandableId>>(
    () => new Set(resolveDesignerToolboxPrefs(toolboxUserKey).expandedSections),
  );
  const [recentlyUsedItemIds, setRecentlyUsedItemIds] = React.useState<string[]>(
    () => resolveDesignerToolboxPrefs(toolboxUserKey).recentlyUsedItemIds,
  );
  const [isToolboxOpen, setIsToolboxOpen] = React.useState(false);
  const [toolboxSearchQuery, setToolboxSearchQuery] = React.useState('');
  const [toolboxPosition, setToolboxPosition] = React.useState({ x: 0, y: 28 });
  const [toolboxSize, setToolboxSize] = React.useState<ToolboxSize>({
    width: TOOLBOX_DEFAULT_WIDTH,
    height: TOOLBOX_DEFAULT_HEIGHT,
  });

  const expandedPaletteCategoriesRef = React.useRef(expandedPaletteCategories);
  const recentlyUsedItemIdsRef = React.useRef(recentlyUsedItemIds);
  expandedPaletteCategoriesRef.current = expandedPaletteCategories;
  recentlyUsedItemIdsRef.current = recentlyUsedItemIds;

  React.useEffect(() => {
    let prefs = resolveDesignerToolboxPrefs(toolboxUserKey);
    // First login for this user: promote any anonymous local prefs so a mid-boot
    // auth hydrate does not wipe Recently Used / expand state written under 'anonymous'.
    if (toolboxUserKey !== 'anonymous' && !readDesignerToolboxPrefs(toolboxUserKey)) {
      const anonymousPrefs = readDesignerToolboxPrefs('anonymous');
      if (anonymousPrefs) {
        writeDesignerToolboxPrefs(toolboxUserKey, anonymousPrefs);
        prefs = anonymousPrefs;
      }
    }
    setExpandedPaletteCategories(new Set(prefs.expandedSections));
    setRecentlyUsedItemIds(prefs.recentlyUsedItemIds);
  }, [toolboxUserKey]);

  const persistToolboxPrefs = React.useCallback((
    nextExpanded: ReadonlySet<DesignerToolboxExpandableId>,
    nextRecentIds: readonly string[],
  ) => {
    writeDesignerToolboxPrefs(toolboxUserKey, {
      expandedSections: Array.from(nextExpanded),
      recentlyUsedItemIds: [...nextRecentIds],
    });
  }, [toolboxUserKey]);

  const toolboxMenuRef = React.useRef<HTMLDivElement | null>(null);
  const toolboxPanelRef = React.useRef<HTMLDivElement | null>(null);
  const toolboxDragRafRef = React.useRef<number | null>(null);
  const toolboxResizeRafRef = React.useRef<number | null>(null);
  const pendingToolboxPositionRef = React.useRef<{ x: number; y: number } | null>(null);
  const pendingToolboxSizeRef = React.useRef<ToolboxSize | null>(null);
  const toolboxPositionRef = React.useRef(toolboxPosition);
  const toolboxSizeRef = React.useRef(toolboxSize);
  toolboxPositionRef.current = toolboxPosition;
  toolboxSizeRef.current = toolboxSize;
  const toolboxDragStateRef = React.useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    hostLeft: number;
    hostTop: number;
    maxX: number;
    maxY: number;
  } | null>(null);
  const toolboxResizeStateRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    positionX: number;
    positionY: number;
    hostWidth: number;
    hostHeight: number;
  } | null>(null);

  const paletteCatalogQuery = useComponentDesignerPaletteCatalogQuery();
  const slotsCatalogQuery = useSlotsCatalogQuery();

  React.useEffect(() => {
    const mergePaletteItems = (
      systemItems: DesignerCatalogItem[],
      reusableItems: DesignerCatalogItem[],
      slotItems: DesignerPaletteItem[],
      navigationItems: DesignerPaletteItem[],
      shellChromeItems: DesignerPaletteItem[],
      platformChromeItems: DesignerPaletteItem[] = [],
    ): DesignerPaletteItem[] => {
      const localItems = DESIGNER_PALETTE.filter((item) => item.sourceType === 'local');
      const incomingItems = [
        ...systemItems,
        ...reusableItems,
        ...slotItems,
        ...navigationItems,
        ...shellChromeItems,
        ...platformChromeItems,
      ];
      const deduped = new Map<string, DesignerPaletteItem>();
      for (const item of [...localItems, ...incomingItems]) {
        deduped.set(item.id, item);
      }
      return Array.from(deduped.values());
    };

    const slotItems = slotsCatalogQuery.data?.slots
      ? buildSlotPaletteItems(slotsCatalogQuery.data.slots)
      : [];
    const navigationItems = buildPlatformNavigationPaletteItems();
    const shellChromeItems = buildShellChromePaletteItems();
    const platformChromeItems = buildPlatformChromePaletteItems();

    if (paletteCatalogQuery.isSuccess && paletteCatalogQuery.data) {
      const catalogData = paletteCatalogQuery.data as ComponentDesignerPaletteCatalog;
      const mergedPalette = mergePaletteItems(
        catalogData.systemItems,
        catalogData.reusableItems,
        slotItems,
        navigationItems,
        shellChromeItems,
        platformChromeItems,
      );
      setDesignerPaletteCatalog(mergedPalette);
      setPaletteItems(getDesignerPaletteCatalog());
      setPaletteLoadError(null);
      return;
    }

    if (paletteCatalogQuery.isError) {
      const fallbackPalette = mergePaletteItems(
        [],
        [],
        slotItems,
        navigationItems,
        shellChromeItems,
        platformChromeItems,
      );
      setDesignerPaletteCatalog(fallbackPalette);
      setPaletteItems(getDesignerPaletteCatalog());
      setPaletteLoadError(
        (paletteCatalogQuery.error as Error).message || 'Failed to load dynamic catalog.',
      );
      return;
    }

    if (
      slotItems.length > 0
      || navigationItems.length > 0
      || shellChromeItems.length > 0
      || platformChromeItems.length > 0
    ) {
      const slotOnlyPalette = mergePaletteItems(
        [],
        [],
        slotItems,
        navigationItems,
        shellChromeItems,
        platformChromeItems,
      );
      setDesignerPaletteCatalog(slotOnlyPalette);
      setPaletteItems(getDesignerPaletteCatalog());
    }
  }, [
    paletteCatalogQuery.data,
    paletteCatalogQuery.error,
    paletteCatalogQuery.isError,
    paletteCatalogQuery.isSuccess,
    slotsCatalogQuery.data,
  ]);

  const filteredPalette = React.useMemo(() => {
    // Legacy items (e.g. 'heroui.table', retired in favor of 'heroui.data-grid') stay in the
    // catalog so existing drafts keep working, but must never be offered as a new drag source.
    const draggableItems = buildPublicToolboxFromCatalog(paletteItems);
    // Phase 11: category (group label) + fuzzy subsequence + label>id/sourceRef/category ranking.
    return filterAndRankToolboxPalette(draggableItems, toolboxSearchQuery);
  }, [paletteItems, toolboxSearchQuery]);

  const groupedPalette = React.useMemo(
    () => buildToolboxGroupedPalette(filteredPalette),
    [filteredPalette],
  );

  const recentlyUsedPaletteItems = React.useMemo(() => {
    const catalogById = new Map(paletteItems.filter((item) => !item.legacy).map((item) => [item.id, item]));
    return resolveRecentlyUsedPaletteItems(recentlyUsedItemIds, catalogById);
  }, [paletteItems, recentlyUsedItemIds]);

  const togglePaletteCategory = React.useCallback((category: DesignerToolboxExpandableId) => {
    setExpandedPaletteCategories((previous) => {
      const next = new Set<DesignerToolboxExpandableId>(previous);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      persistToolboxPrefs(next, recentlyUsedItemIdsRef.current);
      return next;
    });
  }, [persistToolboxPrefs]);

  const recordRecentlyUsedPaletteItem = React.useCallback((itemId: string) => {
    setRecentlyUsedItemIds((previous) => {
      const next = pushRecentlyUsedItemId(previous, itemId);
      if (next.length === previous.length && next.every((id, index) => id === previous[index])) {
        return previous;
      }
      persistToolboxPrefs(expandedPaletteCategoriesRef.current, next);
      return next;
    });
  }, [persistToolboxPrefs]);

  const handleToolboxHeaderPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    pendingToolboxPositionRef.current = null;
    if (toolboxDragRafRef.current !== null) {
      window.cancelAnimationFrame(toolboxDragRafRef.current);
      toolboxDragRafRef.current = null;
    }

    const host = middleLayoutRef.current;
    const panel = toolboxPanelRef.current;
    if (!host || !panel) {
      return;
    }

    const hostRect = host.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    const maxX = Math.max(0, hostRect.width - panel.offsetWidth);
    const maxY = Math.max(0, hostRect.height - panel.offsetHeight);
    toolboxDragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      hostLeft: hostRect.left,
      hostTop: hostRect.top,
      maxX,
      maxY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [middleLayoutRef]);

  const handleToolboxHeaderPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = toolboxDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const rawX = event.clientX - dragState.hostLeft - dragState.offsetX;
    const rawY = event.clientY - dragState.hostTop - dragState.offsetY;
    const nextPosition = {
      x: Math.max(0, Math.min(dragState.maxX, rawX)),
      y: Math.max(0, Math.min(dragState.maxY, rawY)),
    };

    pendingToolboxPositionRef.current = nextPosition;
    if (toolboxDragRafRef.current === null) {
      toolboxDragRafRef.current = window.requestAnimationFrame(() => {
        toolboxDragRafRef.current = null;
        const pendingPosition = pendingToolboxPositionRef.current;
        if (!pendingPosition) {
          return;
        }
        setToolboxPosition((current) => {
          if (current.x === pendingPosition.x && current.y === pendingPosition.y) {
            return current;
          }
          return pendingPosition;
        });
      });
    }
  }, []);

  const handleToolboxHeaderPointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = toolboxDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    toolboxDragStateRef.current = null;
    pendingToolboxPositionRef.current = null;
    if (toolboxDragRafRef.current !== null) {
      window.cancelAnimationFrame(toolboxDragRafRef.current);
      toolboxDragRafRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const scheduleToolboxSizeUpdate = React.useCallback((nextSize: ToolboxSize) => {
    pendingToolboxSizeRef.current = nextSize;
    if (toolboxResizeRafRef.current === null) {
      toolboxResizeRafRef.current = window.requestAnimationFrame(() => {
        toolboxResizeRafRef.current = null;
        const pendingSize = pendingToolboxSizeRef.current;
        if (!pendingSize) {
          return;
        }
        setToolboxSize((current) => {
          if (current.width === pendingSize.width && current.height === pendingSize.height) {
            return current;
          }
          return pendingSize;
        });
      });
    }
  }, []);

  const handleToolboxResizePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const host = middleLayoutRef.current;
    if (!host) {
      return;
    }

    toolboxResizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: toolboxSizeRef.current.width,
      startHeight: toolboxSizeRef.current.height,
      positionX: toolboxPositionRef.current.x,
      positionY: toolboxPositionRef.current.y,
      hostWidth: host.clientWidth,
      hostHeight: host.clientHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [middleLayoutRef]);

  const handleToolboxResizePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const resizeState = toolboxResizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - resizeState.startX;
    const deltaY = event.clientY - resizeState.startY;
    const nextSize = clampToolboxSize(
      {
        width: resizeState.startWidth + deltaX,
        height: resizeState.startHeight + deltaY,
      },
      { x: resizeState.positionX, y: resizeState.positionY },
      resizeState.hostWidth,
      resizeState.hostHeight,
    );
    scheduleToolboxSizeUpdate(nextSize);
  }, [scheduleToolboxSizeUpdate]);

  const handleToolboxResizePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const resizeState = toolboxResizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    toolboxResizeStateRef.current = null;
    pendingToolboxSizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  React.useEffect(() => () => {
    if (toolboxDragRafRef.current !== null) {
      window.cancelAnimationFrame(toolboxDragRafRef.current);
      toolboxDragRafRef.current = null;
    }
    if (toolboxResizeRafRef.current !== null) {
      window.cancelAnimationFrame(toolboxResizeRafRef.current);
      toolboxResizeRafRef.current = null;
    }
    pendingToolboxPositionRef.current = null;
    pendingToolboxSizeRef.current = null;
    toolboxDragStateRef.current = null;
    toolboxResizeStateRef.current = null;
  }, []);

  const handleOpenToolbox = React.useCallback(() => {
    setIsToolboxOpen((previous) => {
      if (!previous) {
        const host = middleLayoutRef.current;
        if (host) {
          const hostWidth = host.clientWidth;
          const hostHeight = host.clientHeight;
          const currentPosition = toolboxPositionRef.current;
          const currentSize = toolboxSizeRef.current;
          const nextSize = clampToolboxSize(currentSize, currentPosition, hostWidth, hostHeight);
          const nextPosition = clampToolboxPosition(currentPosition, nextSize, hostWidth, hostHeight);
          setToolboxSize(nextSize);
          setToolboxPosition(nextPosition);
        }
      }
      return !previous;
    });
  }, [middleLayoutRef]);

  return {
    paletteItems,
    paletteLoadError,
    filteredPalette,
    groupedPalette,
    recentlyUsedPaletteItems,
    expandedPaletteCategories,
    togglePaletteCategory,
    recordRecentlyUsedPaletteItem,
    isToolboxOpen,
    setIsToolboxOpen,
    toolboxSearchQuery,
    setToolboxSearchQuery,
    toolboxPosition,
    toolboxSize,
    toolboxMenuRef,
    toolboxPanelRef,
    handleOpenToolbox,
    handleToolboxHeaderPointerDown,
    handleToolboxHeaderPointerMove,
    handleToolboxHeaderPointerUp,
    handleToolboxResizePointerDown,
    handleToolboxResizePointerMove,
    handleToolboxResizePointerUp,
  };
};
