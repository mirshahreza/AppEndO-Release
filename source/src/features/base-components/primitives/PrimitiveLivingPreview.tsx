import React from 'react';
import {
  AppButton,
  UiAvatar,
  UiBadge,
  UiCalendar,
  UiCommandPalette,
  UiComparisonSlider,
  UiContextMenu,
  UiHoverCard,
  UiKbd,
  UiRangeCalendar,
  UiSnippet,
  MermaidDiagram,
  UiCodeScanner,
  UiDocumentViewer,
  UiMenubar,
  UiSignaturePad,
  UiSortableList,
  UiUserCard,
  UiVirtualizedList,
  UiDashboardCanvas,
} from '../../../shared/ui';
import { parseDashboardFilterBarConfig } from '../../../domain/component-designer/designerDashboardFilterBarConfig';
import { DesignerRuntimeFilterBar } from '../../../domain/component-designer/DesignerRuntimeFilterBar';
import {
  DesignerUniversalAspectRatio,
  DesignerUniversalCarousel,
  DesignerUniversalDescriptionList,
  DesignerUniversalOtpInput,
  DesignerUniversalOverlayContainer,
  DesignerUniversalRating,
  DesignerUniversalSegmentedControl,
  DesignerUniversalSplitMedia,
  DesignerUniversalStatTrend,
  DesignerUniversalStepper,
  DesignerUniversalStickyContainer,
} from '../../../domain/component-designer/DesignerRuntimeUniversalWidgets';
import { DesignerVizGantt, DesignerVizTimeline } from '../../../domain/component-designer/DesignerRuntimeTimelineWidgets';
import {
  DesignerVizCascader,
  DesignerVizTreeCombobox,
  DesignerVizTreeSelect,
  DesignerVizTreeView,
  type DesignerTreeSelectionMode,
} from '../../../domain/component-designer/DesignerRuntimeTreeWidgets';
import type { SectionId } from '../types';

type PrimitiveLivingPreviewProps = {
  sectionId: SectionId;
  label: string;
  publicProps: Record<string, unknown>;
};

const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asBool = (value: unknown) => value === true || value === 'true';

const isTailwindSizeUtility = (value: string): boolean =>
  /^(?:min-|max-)?[wh]-/.test(value) || value.startsWith('max-w-') || value.startsWith('min-h-');

export const layoutHostClass = (publicProps: Record<string, unknown>, base: string): string => {
  const width = asText(publicProps.width);
  const height = asText(publicProps.height);
  return [
    base,
    isTailwindSizeUtility(width) ? width : null,
    isTailwindSizeUtility(height) && height !== 'auto' ? height : null,
    height === 'h-full' ? 'min-h-0 flex-1 self-stretch' : null,
  ].filter(Boolean).join(' ');
};

const asMenuItems = (value: unknown): { id: string; label: string; hint?: string }[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((row, index) => {
    const record = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    return {
      id: String(record.id ?? `item-${index}`),
      label: String(record.label ?? record.id ?? `Item ${index + 1}`),
      hint: typeof record.hint === 'string' ? record.hint : undefined,
    };
  });
};

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

const SampleTiles: React.FC<{ className: string; count?: number }> = ({ className, count = 3 }) => (
  <div className={className}>
    {Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        className="flex h-12 items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600"
      >
        Slot {index + 1}
      </div>
    ))}
  </div>
);

const HtmlImagePreview: React.FC<{ publicProps: Record<string, unknown> }> = ({ publicProps }) => {
  const src = asText(publicProps.src, '/assets/designer-default-image.svg');
  const fallbackSrc = asText(publicProps.fallbackSrc);
  const objectFit = asText(publicProps.objectFit, 'cover');
  const [currentSrc, setCurrentSrc] = React.useState(src || fallbackSrc);
  React.useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);
  return (
    <img
      src={currentSrc || '/assets/designer-default-image.svg'}
      alt={asText(publicProps.alt, '')}
      className="h-auto max-w-md rounded-md"
      style={{ objectFit: objectFit as React.CSSProperties['objectFit'] }}
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
};

const treeSelectionMode = (value: unknown): DesignerTreeSelectionMode => {
  if (value === 'none' || value === 'checkbox' || value === 'single') return value;
  return 'single';
};

export const PrimitiveLivingPreview: React.FC<PrimitiveLivingPreviewProps> = (props) => (
  <div className="contents" data-bc-applied-props={JSON.stringify(props.publicProps)}>
    <PrimitiveLivingPreviewInner {...props} />
  </div>
);

const PrimitiveLivingPreviewInner: React.FC<PrimitiveLivingPreviewProps> = ({
  sectionId,
  label,
  publicProps,
}) => {
  const text = asText(publicProps.text, 'Sample text');
  const title = asText(publicProps.title, label);

  if (sectionId === 'heading') {
    const level = String(publicProps.level ?? 'h2');
    const Tag = (HEADING_TAGS.includes(level as (typeof HEADING_TAGS)[number]) ? level : 'h2') as
      (typeof HEADING_TAGS)[number];
    return <Tag className="text-2xl font-semibold tracking-tight text-slate-900">{text || 'Section title'}</Tag>;
  }

  if (sectionId === 'plain-text' || sectionId === 'html-list-item') {
    return <p className="text-sm text-slate-800">{text}</p>;
  }

  if (sectionId === 'typography-lead') {
    return <p className="text-base leading-7 text-slate-700">{text}</p>;
  }

  if (sectionId === 'html-image') {
    return <HtmlImagePreview publicProps={publicProps} />;
  }

  if (sectionId === 'html-iframe') {
    const height = asText(publicProps.height, '360');
    const width = asText(publicProps.width, '100%');
    const fillHeight = height === 'h-full';
    return (
      <iframe
        src={asText(publicProps.src, 'https://www.openstreetmap.org/export/embed.html')}
        title={asText(publicProps.title, 'Embedded content')}
        width={width.endsWith('%') ? width : undefined}
        height={fillHeight ? undefined : height}
        loading={publicProps.loading === 'eager' ? 'eager' : 'lazy'}
        allowFullScreen={asBool(publicProps.allowFullScreen)}
        className={layoutHostClass(publicProps, 'w-full max-w-3xl rounded-md border border-slate-200 bg-slate-50')}
      />
    );
  }

  if (sectionId === 'html-link' || sectionId === 'link-button') {
    return (
      <a
        href={asText(publicProps.href, '#')}
        target={asText(publicProps.target, '_self')}
        className={sectionId === 'link-button'
          ? 'inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white'
          : 'text-primary underline underline-offset-2'}
      >
        {text || 'Learn more'}
      </a>
    );
  }

  if (sectionId === 'html-list') {
    const items = Array.isArray(publicProps.items)
      ? publicProps.items as Array<{ text?: string }>
      : [];
    const ListTag = asBool(publicProps.ordered) ? 'ol' : 'ul';
    return (
      <ListTag className={asBool(publicProps.ordered) ? 'list-decimal ps-5 text-sm' : 'list-disc ps-5 text-sm'}>
        {items.map((item, index) => (
          <li key={`${item.text ?? 'item'}-${index}`}>{item.text || `Item ${index + 1}`}</li>
        ))}
      </ListTag>
    );
  }

  if (sectionId === 'carousel') {
    return <DesignerUniversalCarousel title={title} slides={publicProps.slides} className="w-full max-w-xl" />;
  }

  if (sectionId === 'description-list') {
    return <DesignerUniversalDescriptionList title={title} data={publicProps.data} className="w-full max-w-xl" />;
  }

  if (sectionId === 'stat-trend') {
    return (
      <DesignerUniversalStatTrend
        label={asText(publicProps.label, 'Revenue')}
        value={asText(publicProps.value, '$48.2k')}
        trend={asText(publicProps.trend, '+12%')}
        trendDirection={asText(publicProps.trendDirection, 'up')}
        className="max-w-xs"
      />
    );
  }

  if (sectionId === 'split-media') {
    return (
      <DesignerUniversalSplitMedia
        title={title}
        mediaSide={asText(publicProps.mediaSide, 'right')}
        mediaType={asText(publicProps.mediaType, 'image')}
        mediaSrc={asText(publicProps.mediaSrc)}
        className="w-full max-w-3xl"
      />
    );
  }

  if (sectionId === 'timeline') {
    return <DesignerVizTimeline title={title} data={publicProps.data} className="w-full max-w-xl" />;
  }

  if (sectionId === 'gantt') {
    return (
      <DesignerVizGantt
        title={title}
        data={publicProps.data}
        viewMode={publicProps.viewMode === 'day' || publicProps.viewMode === 'month' ? publicProps.viewMode : 'week'}
        dependencies={publicProps.dependencies}
        milestones={publicProps.milestones}
        allowTaskDrag={asBool(publicProps.allowTaskDrag)}
        className={layoutHostClass(publicProps, 'w-full')}
      />
    );
  }

  if (sectionId === 'tree-view') {
    return (
      <DesignerVizTreeView
        data={publicProps.data}
        selectionMode={treeSelectionMode(publicProps.selectionMode)}
        showIcons={asBool(publicProps.showIcons)}
        selectedKey={asText(publicProps.selectedKey) || undefined}
        emptyContent={asText(publicProps.emptyContent) || undefined}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-3"
      />
    );
  }

  if (sectionId === 'tree-select') {
    return (
      <DesignerVizTreeSelect
        label={asText(publicProps.label, 'Department')}
        placeholder={asText(publicProps.placeholder, 'Select department…')}
        data={publicProps.data}
        multiple={asBool(publicProps.multiple)}
        selectedKey={asText(publicProps.selectedKey) || undefined}
        className="w-full max-w-md"
      />
    );
  }

  if (sectionId === 'cascader') {
    return (
      <DesignerVizCascader
        label={asText(publicProps.label, 'Region')}
        placeholder={asText(publicProps.placeholder, 'Select region…')}
        data={publicProps.data}
        selectedKey={asText(publicProps.selectedKey) || undefined}
        className="w-full max-w-md"
      />
    );
  }

  if (sectionId === 'tree-combobox') {
    return (
      <DesignerVizTreeCombobox
        label={asText(publicProps.label, 'Search tree')}
        placeholder={asText(publicProps.placeholder, 'Type…')}
        data={publicProps.data}
        selectedKey={asText(publicProps.selectedKey) || undefined}
        className="w-full max-w-md"
      />
    );
  }

  if (sectionId === 'stepper') {
    return (
      <DesignerUniversalStepper
        steps={asText(publicProps.steps, 'Account,Profile,Review')}
        activeStep={asNumber(publicProps.activeStep, 1)}
        className="w-full"
      />
    );
  }

  if (sectionId === 'segmented-control') {
    return (
      <DesignerUniversalSegmentedControl
        options={asText(publicProps.options, 'Day,Week,Month')}
        selected={asText(publicProps.selected, 'Week')}
      />
    );
  }

  if (sectionId === 'rating') {
    return (
      <DesignerUniversalRating
        label={asText(publicProps.label, 'Rating')}
        defaultValue={asNumber(publicProps.value, 4)}
        max={asNumber(publicProps.max, 5)}
      />
    );
  }

  if (sectionId === 'otp-input') {
    return (
      <DesignerUniversalOtpInput
        label={asText(publicProps.label, 'Verification code')}
        length={asNumber(publicProps.length, 6)}
        defaultValue={asText(publicProps.value)}
      />
    );
  }

  if (sectionId === 'notification-badge') {
    const color = asText(publicProps.color, 'danger');
    const placement = asText(publicProps.placement, 'top-end');
    return (
      <UiBadge
        content={asText(publicProps.content, '3')}
        color={color === 'accent' || color === 'success' || color === 'warning' || color === 'danger' ? color : 'default'}
        placement={
          placement === 'top-start' || placement === 'bottom-end' || placement === 'bottom-start'
            ? placement
            : 'top-end'
        }
        dot={asBool(publicProps.dot)}
      >
        <UiAvatar size="md" color="accent" fallback="AM" alt="" />
      </UiBadge>
    );
  }

  if (sectionId === 'calendar-grid') {
    return (
      <UiCalendar
        defaultValue={asText(publicProps.value, '2026-09-03')}
        isDisabled={asBool(publicProps.isDisabled)}
      />
    );
  }

  if (sectionId === 'range-calendar-grid') {
    return (
      <UiRangeCalendar
        defaultValue={{
          start: asText(publicProps.start, '2026-09-03'),
          end: asText(publicProps.end, '2026-09-10'),
        }}
        isDisabled={asBool(publicProps.isDisabled)}
      />
    );
  }

  if (sectionId === 'kbd') {
    const keys = asText(publicProps.keys, 'Ctrl,K')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    return <UiKbd keys={keys.length > 0 ? keys : ['Ctrl', 'K']} />;
  }

  if (sectionId === 'user-card') {
    const size = asText(publicProps.size, 'md');
    return (
      <UiUserCard
        name={asText(publicProps.name, 'Ada Lovelace')}
        description={asText(publicProps.description, 'Product designer')}
        fallback={asText(publicProps.fallback, 'AL')}
        size={size === 'sm' || size === 'lg' ? size : 'md'}
      />
    );
  }

  if (sectionId === 'snippet') {
    return (
      <UiSnippet
        code={asText(publicProps.code, 'npm run test:critical')}
        language={asText(publicProps.language, 'bash')}
        showCopy={publicProps.showCopy !== false}
      />
    );
  }

  if (sectionId === 'hover-card') {
    const placement = asText(publicProps.placement, 'bottom-start');
    return (
      <UiHoverCard
        title={asText(publicProps.title, 'Ada Lovelace')}
        description={asText(publicProps.description, 'Product designer on the platform team.')}
        placement={
          placement === 'bottom-end' || placement === 'top-start' || placement === 'top-end'
            ? placement
            : 'bottom-start'
        }
        trigger={(
          <AppButton type="button" intent="secondary" size="sm">
            {asText(publicProps.triggerLabel, 'View profile')}
          </AppButton>
        )}
      />
    );
  }

  if (sectionId === 'context-menu') {
    const items = asMenuItems(publicProps.items);
    return (
      <UiContextMenu
        items={items.length > 0 ? items : [
          { id: 'open', label: 'Open' },
          { id: 'rename', label: 'Rename' },
          { id: 'delete', label: 'Delete' },
        ]}
      >
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
          {asText(publicProps.triggerLabel, 'Right-click this card')}
        </div>
      </UiContextMenu>
    );
  }

  if (sectionId === 'command-palette') {
    const items = asMenuItems(publicProps.items);
    return (
      <UiCommandPalette
        placeholder={asText(publicProps.placeholder, 'Search commands…')}
        triggerLabel={asText(publicProps.triggerLabel, 'Open commands')}
        items={items.length > 0 ? items : [
          { id: 'base-components', label: 'Go to Base Components', hint: 'Studio' },
          { id: 'client-components', label: 'Open Client Components', hint: 'Designer' },
        ]}
      />
    );
  }

  if (sectionId === 'sortable-list') {
    const items = asMenuItems(publicProps.items);
    return (
      <UiSortableList
        items={items.length > 0 ? items : [
          { id: 'inbox', label: 'Inbox' },
          { id: 'progress', label: 'In progress' },
          { id: 'review', label: 'Review' },
          { id: 'done', label: 'Done' },
        ]}
        disabled={asBool(publicProps.disabled)}
      />
    );
  }

  if (sectionId === 'comparison-slider') {
    return (
      <UiComparisonSlider
        beforeLabel={asText(publicProps.beforeLabel, 'Before')}
        afterLabel={asText(publicProps.afterLabel, 'After')}
        position={asNumber(publicProps.position, 50)}
      />
    );
  }

  if (sectionId === 'mermaid-diagram') {
    return (
      <MermaidDiagram
        className="w-full max-w-xl rounded-lg border border-slate-200 bg-white"
        chart={asText(publicProps.chart, 'flowchart LR\n  Intake --> Review\n  Review --> Publish')}
        loadingLabel={asText(publicProps.loadingLabel, 'Rendering…')}
        ariaLabel="Mermaid diagram"
      />
    );
  }

  if (sectionId === 'virtualized-list') {
    return (
      <UiVirtualizedList
        itemCount={asNumber(publicProps.itemCount, 80)}
        labelPrefix={asText(publicProps.labelPrefix, 'Row')}
        height={asNumber(publicProps.height, 240)}
      />
    );
  }

  if (sectionId === 'signature-pad') {
    return (
      <UiSignaturePad
        penColor={asText(publicProps.penColor, '#0f172a')}
        height={asNumber(publicProps.height, 160)}
        disabled={asBool(publicProps.disabled)}
      />
    );
  }

  if (sectionId === 'menubar') {
    const menus = Array.isArray(publicProps.menus)
      ? publicProps.menus as { id?: string; label?: string; items?: string }[]
      : [];
    return (
      <UiMenubar
        menus={menus.length > 0 ? menus.map((menu, index) => ({
          id: String(menu.id ?? `menu-${index}`),
          label: String(menu.label ?? menu.id ?? `Menu ${index + 1}`),
          items: menu.items,
        })) : [
          { id: 'file', label: 'File', items: 'New, Open, Save' },
          { id: 'edit', label: 'Edit', items: 'Undo, Redo' },
        ]}
      />
    );
  }

  if (sectionId === 'code-scanner') {
    const facing = asText(publicProps.facingMode, 'environment');
    return (
      <UiCodeScanner facingMode={facing === 'user' ? 'user' : 'environment'} />
    );
  }

  if (sectionId === 'document-viewer') {
    const kind = asText(publicProps.kind, 'pdf');
    return (
      <UiDocumentViewer
        title={asText(publicProps.title, 'Release notes')}
        kind={kind === 'office' ? 'office' : 'pdf'}
        src={asText(publicProps.src)}
        height={asNumber(publicProps.height, 320)}
      />
    );
  }

  if (sectionId === 'pagination') {
    const page = asNumber(publicProps.page, 1);
    const total = Math.max(1, asNumber(publicProps.total, 10));
    const size = asText(publicProps.size, 'md');
    const sizeClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';
    return (
      <div className={`inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 ${sizeClass}`}>
        <span className="text-slate-600">Page {page} · {total} total</span>
        <AppButton intent="utility" size={size === 'lg' ? 'md' : 'sm'} disabled={page <= 1}>Prev</AppButton>
        <AppButton intent="utility" size={size === 'lg' ? 'md' : 'sm'} disabled={page >= total}>Next</AppButton>
      </div>
    );
  }

  if (sectionId === 'filter-bar') {
    const config = parseDashboardFilterBarConfig(publicProps.filterBarConfig);
    return (
      <DesignerRuntimeFilterBar
        config={config}
        designerStore={{}}
        onStorePathChange={() => undefined}
        mode="design"
      />
    );
  }

  if (sectionId === 'dashboard-canvas') {
    const personalizable = publicProps.personalizable !== false;
    return (
      <UiDashboardCanvas
        layout={[
          { i: 'kpi', x: 0, y: 0, w: 4, h: 3 },
          { i: 'chart', x: 4, y: 0, w: 8, h: 3 },
        ]}
        isDraggable={personalizable}
        isResizable={personalizable}
      >
        <div key="kpi" className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">KPI</div>
        <div key="chart" className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">Chart</div>
      </UiDashboardCanvas>
    );
  }

  if (sectionId === 'aspect-ratio') {
    return <DesignerUniversalAspectRatio ratio={asText(publicProps.ratio, '16/9')} className="w-full max-w-md overflow-hidden rounded-lg bg-slate-100" />;
  }

  if (sectionId === 'sticky') {
    return (
      <DesignerUniversalStickyContainer offset={asNumber(publicProps.offset, 0)} className="w-full rounded-md border border-slate-200 bg-white p-3">
        Sticky host
      </DesignerUniversalStickyContainer>
    );
  }

  if (sectionId === 'overlay') {
    return (
      <DesignerUniversalOverlayContainer overlayLabel={asText(publicProps.overlayLabel, 'Overlay')} className="relative min-h-[120px] w-full max-w-md rounded-lg bg-slate-100">
        <div className="p-6 text-sm text-slate-600">Base surface</div>
      </DesignerUniversalOverlayContainer>
    );
  }

  if (sectionId === 'field-container') {
    return (
      <fieldset className="rounded-md border border-slate-200 px-3 py-2">
        <legend className="px-1 text-sm font-medium text-slate-700">{asText(publicProps.label, 'Group')}</legend>
        <p className="text-sm text-slate-500">Grouped fields go here.</p>
      </fieldset>
    );
  }

  if (sectionId === 'code-editor') {
    return (
      <div className="max-w-xl overflow-hidden rounded-md border border-slate-200 bg-slate-950">
        <p className="border-b border-slate-800 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {asText(publicProps.language, 'typescript')}
        </p>
        <pre className="overflow-auto p-3 text-[12px] text-slate-100">
          {asText(publicProps.value, 'const ready = true;')}
        </pre>
      </div>
    );
  }

  if (sectionId === 'drawer') {
    const placement = asText(publicProps.placement, 'end') === 'start' ? 'start' : 'end';
    return (
      <div className="relative min-h-56 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        <aside
          className={`absolute inset-y-0 flex w-56 flex-col border-slate-200 bg-white p-3 shadow-sm ${
            placement === 'start' ? 'start-0 border-e' : 'end-0 border-s'
          }`}
        >
          <p className="text-sm font-semibold text-slate-800">{title || 'Drawer'}</p>
          <p className="mt-2 text-xs text-slate-500">Docked {placement} overlay.</p>
        </aside>
      </div>
    );
  }

  if (sectionId === 'sticky-bar') {
    const edge = asText(publicProps.edge, 'top') === 'bottom' ? 'bottom' : 'top';
    return (
      <div className="relative h-48 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        <div className={`sticky ${edge === 'top' ? 'top-0' : 'bottom-0'} z-10 border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 ${
          edge === 'top' ? 'border-b' : 'border-t'
        }`}>
          Sticky {edge} bar
        </div>
        <div className="h-64 p-3 text-xs text-slate-500">Scroll host so the bar can stick.</div>
      </div>
    );
  }

  if (sectionId === 'html-section') {
    return (
      <section
        aria-label={asText(publicProps.ariaLabel) || undefined}
        className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600"
      >
        Section
      </section>
    );
  }

  if (sectionId === 'html-table-wrap') {
    const overflow = asText(publicProps.overflow, 'auto') === 'scroll' ? 'scroll' : 'auto';
    return (
      <div className={`max-h-32 max-w-md rounded-md border border-slate-200 ${
        overflow === 'scroll' ? 'overflow-scroll' : 'overflow-auto'
      }`}>
        <table className="w-full text-left text-xs">
          <thead><tr><th className="px-2 py-1">Name</th><th className="px-2 py-1">Value</th></tr></thead>
          <tbody>
            {Array.from({ length: 8 }, (_, index) => (
              <tr key={index}><td className="px-2 py-1">Row {index + 1}</td><td className="px-2 py-1">{index}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (sectionId === 'html-form') {
    return (
      <form
        method={asText(publicProps.method, 'post') === 'get' ? 'get' : 'post'}
        className="max-w-md space-y-2 rounded-md border border-slate-200 bg-white p-3"
      >
        <p className="text-sm font-medium text-slate-800">Form ({asText(publicProps.method, 'post')})</p>
        <p className="text-xs text-slate-500">Native form host.</p>
      </form>
    );
  }

  if (sectionId === 'html-article') {
    return (
      <article className="max-w-xl space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">Article body.</p>
      </article>
    );
  }

  if (sectionId === 'html-figure') {
    return (
      <figure className="max-w-sm">
        <div className="h-32 rounded-md bg-slate-100" />
        {asText(publicProps.caption) ? <figcaption className="mt-2 text-xs text-slate-500">{asText(publicProps.caption)}</figcaption> : null}
      </figure>
    );
  }

  if (sectionId === 'separator') {
    return publicProps.orientation === 'vertical'
      ? <div className="h-16 w-px bg-slate-200" />
      : <hr className="w-full border-slate-200" />;
  }

  if (sectionId === 'spacer') {
    return <div className={`${asText(publicProps.size, 'h-4')} w-full bg-slate-100`} />;
  }

  if (sectionId === 'flex-row') {
    return <SampleTiles className={layoutHostClass(publicProps, `flex ${asText(publicProps.gap, 'gap-3')}`)} />;
  }

  if (sectionId === 'flex-column') {
    return <SampleTiles className={layoutHostClass(publicProps, `flex flex-col ${asText(publicProps.gap, 'gap-3')}`)} />;
  }

  if (sectionId === 'grid-2') {
    return <SampleTiles className={layoutHostClass(publicProps, `grid grid-cols-2 ${asText(publicProps.gap, 'gap-3')}`)} count={4} />;
  }

  if (sectionId === 'grid-3') {
    return <SampleTiles className={layoutHostClass(publicProps, `grid grid-cols-3 ${asText(publicProps.gap, 'gap-3')}`)} count={6} />;
  }

  if (sectionId === 'columns') {
    const count = asNumber(publicProps.columnCount, 2);
    return <SampleTiles className={layoutHostClass(publicProps, 'grid gap-3')} count={count} />;
  }

  if (sectionId === 'stack-compact' || sectionId === 'stack-relaxed') {
    return (
      <SampleTiles
        className={layoutHostClass(
          publicProps,
          `flex flex-col ${asText(publicProps.gap, sectionId === 'stack-compact' ? 'gap-1' : 'gap-4')}`,
        )}
      />
    );
  }

  if (sectionId === 'center') {
    return (
      <div className={layoutHostClass(
        publicProps,
        `flex ${asText(publicProps.minHeight, 'min-h-24')} items-center justify-center rounded-md border border-dashed border-slate-300`,
      )}>
        Centered
      </div>
    );
  }

  if (sectionId === 'wrapper' || sectionId === 'html-container') {
    return (
      <div className={layoutHostClass(
        publicProps,
        'rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600',
      )}>
        {sectionId === 'html-container' ? `${asText(publicProps.tag, 'div')} container` : 'Wrapper'}
      </div>
    );
  }

  if (sectionId === 'split-pane') {
    const vertical = publicProps.orientation === 'vertical';
    return (
      <div className={layoutHostClass(
        publicProps,
        `flex min-h-40 overflow-hidden rounded-md border border-slate-200 ${vertical ? 'flex-col' : ''}`,
      )}>
        <div className="flex-1 bg-slate-50 p-3 text-xs text-slate-500">Pane A</div>
        <div className={vertical ? 'h-1 bg-slate-200' : 'w-1 bg-slate-200'} />
        <div className="flex-1 bg-white p-3 text-xs text-slate-500">Pane B</div>
      </div>
    );
  }

  if (sectionId === 'repeater' || sectionId === 'visibility-container') {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
        <p className="font-medium text-slate-800">{label}</p>
        <p className="mt-1">
          {sectionId === 'repeater'
            ? `Repeats over ${asText(publicProps.dataPath, 'products')} as ${asText(publicProps.itemAlias, 'item')}[${asText(publicProps.indexAlias, 'index')}].`
            : `Visible when ${asText(publicProps.visibleCondition, 'condition')}.`}
        </p>
      </div>
    );
  }

  const entries = Object.entries(publicProps);
  return (
    <div data-bc-preview-fallback="dump" className="max-w-md space-y-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      {entries.length > 0 ? (
        <dl className="space-y-1 text-sm text-slate-600">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="shrink-0 font-medium text-slate-700">{key}</dt>
              <dd className="min-w-0 truncate">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-slate-500">No public props.</p>
      )}
    </div>
  );
};
