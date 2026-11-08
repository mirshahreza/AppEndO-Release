import * as React from 'react';
import { Component as ComponentIcon } from 'lucide-react';
import {
  canInsertPaletteItemWithAutoWrap,
  getDesignerPaletteCatalog,
} from '../../../../domain/component-designer/catalog';
import { buildPublicToolboxFromCatalog } from '../../../../domain/component-designer/toolboxFromCatalog';
import type { DesignerDocument, DesignerPaletteItem } from '../../../../domain/component-designer/types';
import {
  LIVE_DESIGNER_TOOLBOX_BODY_CLASS,
  LIVE_DESIGNER_TOOLBOX_SECTION_CLASS,
  ToolboxPanelEmptyState,
  ToolboxPanelItem,
  ToolboxPanelScrollBody,
  ToolboxPanelSection,
  ToolboxPanelShell,
  type FloatingPanelShellHandle,
} from '../../../../shared/ui';
import {
  buildToolboxGroupedPalette,
  DESIGNER_TOOLBOX_GROUP_LABELS,
} from '../../utils/designerToolboxGroups';
import { filterAndRankToolboxPalette } from '../../utils/designerToolboxSearch';
import { resolvePaletteIconComponent } from '../../utils/paletteIcons';
import {
  beginLiveDesignerExternalDrag,
  endLiveDesignerExternalDrag,
  LIVE_DESIGNER_PALETTE_DRAG_MIME,
  setLiveDesignerDragImage,
} from './liveDesignerDragSession';
import {
  LIVE_DESIGNER_TOOLBOX_MINIMIZE_ABOVE_SELECTOR,
  LIVE_DESIGNER_TOOLBOX_MINIMIZE_BESIDE_SELECTOR,
  LIVE_DESIGNER_TOOLBOX_MINIMIZE_GAP,
  LIVE_DESIGNER_TOOLBOX_RESTORE_BEFORE_SELECTOR,
  LIVE_DESIGNER_TOOLBOX_RESTORE_BELOW_SELECTOR,
  LIVE_DESIGNER_TOOLBOX_RESTORE_GAP,
} from './liveDesignerToolboxAnchor';

export type LiveDesignerToolboxPanelProps = {
  document: DesignerDocument;
  insertParentId: string;
  onInsertItem: (itemId: string) => void;
};

export const LiveDesignerToolboxPanel = React.forwardRef<FloatingPanelShellHandle, LiveDesignerToolboxPanelProps>(({
  document,
  insertParentId,
  onInsertItem,
}, ref) => {
  const [search, setSearch] = React.useState('');
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(() => new Set());
  const parentNode = document.nodes[insertParentId] ?? document.nodes[document.rootNodeId];

  const catalog = React.useMemo(
    () => buildPublicToolboxFromCatalog(getDesignerPaletteCatalog()),
    [],
  );

  const clickInsertableIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (!parentNode) {
      return ids;
    }
    for (const item of catalog) {
      if (canInsertPaletteItemWithAutoWrap(item, parentNode)) {
        ids.add(item.id);
      }
    }
    return ids;
  }, [catalog, parentNode]);

  const filtered = React.useMemo(
    () => filterAndRankToolboxPalette(catalog, search),
    [catalog, search],
  );

  const grouped = React.useMemo(
    () => buildToolboxGroupedPalette(filtered),
    [filtered],
  );

  React.useEffect(() => {
    if (grouped.length === 0) {
      return;
    }
    setExpandedSections((current) => {
      if (current.size > 0) {
        return current;
      }
      return new Set([grouped[0]!.category]);
    });
  }, [grouped]);

  const isSearching = search.trim().length > 0;

  const toggleSection = React.useCallback((sectionId: string) => {
    setExpandedSections((current) => (
      current.has(sectionId) ? current : new Set([sectionId])
    ));
  }, []);

  const suppressClickAfterDragRef = React.useRef(false);

  const handleItemDragStart = React.useCallback((
    event: React.DragEvent<HTMLButtonElement>,
    item: DesignerPaletteItem,
  ) => {
    suppressClickAfterDragRef.current = true;
    event.stopPropagation();
    beginLiveDesignerExternalDrag({ kind: 'palette', itemId: item.id, label: item.label });
    event.dataTransfer.setData(LIVE_DESIGNER_PALETTE_DRAG_MIME, item.id);
    event.dataTransfer.setData('text/plain', item.id);
    event.dataTransfer.effectAllowed = 'copy';
    setLiveDesignerDragImage(event.dataTransfer, item.label);
  }, []);

  const handleItemDragEnd = React.useCallback(() => {
    endLiveDesignerExternalDrag();
    window.setTimeout(() => {
      suppressClickAfterDragRef.current = false;
    }, 0);
  }, []);

  const handleItemActivate = React.useCallback((itemId: string) => {
    if (suppressClickAfterDragRef.current) {
      suppressClickAfterDragRef.current = false;
      return;
    }
    onInsertItem(itemId);
  }, [onInsertItem]);

  const renderItem = (item: DesignerPaletteItem) => {
    const Icon = resolvePaletteIconComponent(item.icon);
    const canClickInsert = clickInsertableIds.has(item.id);
    return (
      <ToolboxPanelItem
        key={item.id}
        label={item.label}
        description={item.description}
        icon={<Icon className="h-3.5 w-3.5" data-palette-icon={item.icon} />}
        draggable
        activateOn="dblclick"
        onDragStart={(event) => handleItemDragStart(event, item)}
        onDragEnd={handleItemDragEnd}
        onActivate={() => handleItemActivate(item.id)}
        className={canClickInsert ? undefined : 'opacity-70'}
      />
    );
  };

  return (
    <ToolboxPanelShell
      ref={ref}
      open
      onClose={() => undefined}
      showCloseButton={false}
      enableMinimize
      dragFromHeaderOnly
      title="Toolbox"
      titleIcon={<ComponentIcon className="h-3.5 w-3.5 text-violet-600" />}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="toolbox…"
      searchAriaLabel="Search toolbox"
      colorSource="tone"
      tone="violet"
      className={LIVE_DESIGNER_TOOLBOX_BODY_CLASS}
      initialPosition="bottom-right"
      minimizedAnchor="bottom-left"
      minimizedGap={LIVE_DESIGNER_TOOLBOX_MINIMIZE_GAP}
      minimizedBesideSelector={LIVE_DESIGNER_TOOLBOX_MINIMIZE_BESIDE_SELECTOR}
      minimizedAboveSelector={LIVE_DESIGNER_TOOLBOX_MINIMIZE_ABOVE_SELECTOR}
      restoredAnchor="top-right"
      restoredGap={LIVE_DESIGNER_TOOLBOX_RESTORE_GAP}
      restoredBeforeSelector={LIVE_DESIGNER_TOOLBOX_RESTORE_BEFORE_SELECTOR}
      restoredBelowSelector={LIVE_DESIGNER_TOOLBOX_RESTORE_BELOW_SELECTOR}
      restoredAboveSelector={LIVE_DESIGNER_TOOLBOX_MINIMIZE_ABOVE_SELECTOR}
      defaultHeight={710}
    >
      {isSearching ? (
        filtered.length === 0 ? (
          <ToolboxPanelEmptyState>
            No toolbox items match “{search.trim()}”.
          </ToolboxPanelEmptyState>
        ) : (
          <ToolboxPanelScrollBody>
            <div className="flex flex-col">{filtered.map(renderItem)}</div>
          </ToolboxPanelScrollBody>
        )
      ) : grouped.length === 0 ? (
        <ToolboxPanelEmptyState>
          No components are available.
        </ToolboxPanelEmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {grouped.map((group) => (
            <ToolboxPanelSection
              key={group.category}
              id={group.category}
              label={DESIGNER_TOOLBOX_GROUP_LABELS[group.category] ?? group.label}
              expanded={expandedSections.has(group.category)}
              onToggle={toggleSection}
              className={LIVE_DESIGNER_TOOLBOX_SECTION_CLASS}
            >
              <div className="flex flex-col">
                {group.items.map(renderItem)}
              </div>
            </ToolboxPanelSection>
          ))}
        </div>
      )}
    </ToolboxPanelShell>
  );
});

LiveDesignerToolboxPanel.displayName = 'LiveDesignerToolboxPanel';
