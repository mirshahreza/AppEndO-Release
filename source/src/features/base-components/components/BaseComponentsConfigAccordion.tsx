import React from 'react';
import { Pin, PinOff, SlidersHorizontal } from 'lucide-react';
import {
  AppButton,
  AppSearchBox,
  FormFieldLayoutProvider,
  FormSection,
  FORM_SECTION_DESC_CLASS,
  FloatingPanelShell,
  ToolboxPanelEmptyState,
  ToolboxPanelSection,
} from '../../../shared/ui';
import {
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_CANCEL_CLASS,
  TOOLBOX_PANEL_DEFAULT_BOUNDS,
  TOOLBOX_PANEL_HEADER_CLASS,
  TOOLBOX_PANEL_SEARCH_HOST_CLASS,
  TOOLBOX_PANEL_TITLE_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import {
  BASE_COMPONENTS_CONFIG_ACCORDION_BODY_CLASS,
  BASE_COMPONENTS_CONFIG_SEARCH_INPUT_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { BaseComponentsPageScrollArea } from './BaseComponentsPageScrollArea';
import { unwrapBaseComponentsConfigSectionSource } from './baseComponentsConfigSectionSource';
import { filterBaseComponentsConfigNodes } from './filterBaseComponentsConfigNodes';
import { useBaseComponentsPropertiesDock } from './BaseComponentsPropertiesDockContext';

type FormSectionLikeProps = {
  title?: string;
  description?: string;
  titleExtra?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
};

type CollectedSection = {
  id: string;
  title: string;
  description?: string;
  titleExtra?: React.ReactNode;
  headerExtra?: React.ReactNode;
  panel: React.ReactNode;
};

const slugSectionId = (title: string, index: number, used: Set<string>) => {
  const base = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `section-${index}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
};

export function collectBaseComponentsConfigSections(children: React.ReactNode): CollectedSection[] {
  const items: CollectedSection[] = [];
  const usedIds = new Set<string>();

  const visit = (node: React.ReactNode) => {
    React.Children.forEach(node, (child, index) => {
      if (child == null || child === false || child === true) return;
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        return;
      }

      const nested = unwrapBaseComponentsConfigSectionSource(child.type, child.props);
      if (nested != null) {
        visit(nested);
        return;
      }

      const props = child.props as FormSectionLikeProps;
      if (child.type === FormSection || typeof props.title === 'string') {
        const title = props.title?.trim() || `Section ${items.length + 1}`;
        items.push({
          id: slugSectionId(title, index, usedIds),
          title,
          description: props.description,
          titleExtra: props.titleExtra,
          headerExtra: props.headerExtra,
          panel: props.children,
        });
      }
    });
  };

  visit(children);
  return items;
}

const PinToggleButton: React.FC<{
  docked: boolean;
  onToggle: () => void;
}> = ({ docked, onToggle }) => (
  <AppButton
    size="icon-sm"
    className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_CANCEL_CLASS, 'h-7 w-7 shrink-0')}
    aria-label={docked ? 'Undock properties' : 'Dock properties'}
    title={docked ? 'Undock' : 'Dock'}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={onToggle}
  >
    {docked
      ? <PinOff className="h-3.5 w-3.5" aria-hidden />
      : <Pin className="h-3.5 w-3.5" aria-hidden />}
  </AppButton>
);

const ConfigSearchBox: React.FC<{
  value: string;
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, onChange, className }) => (
  <AppSearchBox
    value={value}
    onChange={onChange}
    placeholder="properties…"
    ariaLabel="Search properties"
    className={cn(BASE_COMPONENTS_CONFIG_SEARCH_INPUT_CLASS, className)}
  />
);

const ConfigAccordionSections: React.FC<{
  sections: CollectedSection[];
  expandedId: string;
  onExpand: (id: string) => void;
  searchQuery: string;
}> = ({ sections, expandedId, onExpand, searchQuery }) => {
  if (sections.length === 0) {
    return (
      <ToolboxPanelEmptyState>
        No properties match “{searchQuery.trim()}”.
      </ToolboxPanelEmptyState>
    );
  }

  return (
    <>
      {sections.map((section) => {
        const expanded = expandedId === section.id;

        return (
          <ToolboxPanelSection
            key={section.id}
            id={section.id}
            label={section.title}
            expanded={expanded}
            onToggle={(id) => {
              if (id !== expandedId) onExpand(id);
            }}
            className={expanded ? 'min-h-0 flex-1' : 'shrink-0'}
            bodyClassName="flex flex-col overflow-hidden"
          >
            <BaseComponentsPageScrollArea
              className="flex-1"
              aria-label={`${section.title} options`}
            >
              <div className={BASE_COMPONENTS_CONFIG_ACCORDION_BODY_CLASS}>
                {section.description ? (
                  <p className={FORM_SECTION_DESC_CLASS}>{section.description}</p>
                ) : null}
                {section.titleExtra || section.headerExtra ? (
                  <div className="flex items-center gap-1">
                    {section.titleExtra}
                    {section.headerExtra}
                  </div>
                ) : null}
                {section.panel}
              </div>
            </BaseComponentsPageScrollArea>
          </ToolboxPanelSection>
        );
      })}
    </>
  );
};

/**
 * Configurator groups as the Toolbox accordion: fill-height, one section
 * always open. Header/border/chevron follow the active accent theme
 * (`--app-accent-wash` lifted + `--app-accent-700` darkened) so the rail
 * stays distinct from nav muted and the white preview body.
 *
 * Search filters section titles and field labels. The rail is docked by
 * default; unpinning opens the same options in a floating window.
 */
export const BaseComponentsConfigAccordion: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const sections = collectBaseComponentsConfigSections(children);
  const [expandedId, setExpandedId] = React.useState(() => sections[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = React.useState('');
  const { docked, setDocked } = useBaseComponentsPropertiesDock();

  const needle = searchQuery.trim().toLowerCase();
  const visibleSections = React.useMemo(() => {
    if (!needle) return sections;
    return sections.flatMap((section) => {
      const titleHaystack = `${section.title} ${section.description ?? ''}`.toLowerCase();
      if (titleHaystack.includes(needle)) return [section];
      const panel = filterBaseComponentsConfigNodes(section.panel, needle);
      if (panel == null) return [];
      return [{ ...section, panel }];
    });
  }, [needle, sections]);

  const visibleIds = visibleSections.map((section) => section.id).join('|');

  React.useEffect(() => {
    const ids = visibleIds.split('|').filter(Boolean);
    if (ids.length === 0) return;
    if (!ids.includes(expandedId)) {
      setExpandedId(ids[0]);
    }
  }, [expandedId, visibleIds]);

  const toggleDocked = React.useCallback(() => {
    setDocked(!docked);
  }, [docked, setDocked]);

  const accordionBody = sections.length === 0 ? (
    <FormFieldLayoutProvider layout="side">{children}</FormFieldLayoutProvider>
  ) : (
    <FormFieldLayoutProvider layout="side">
      <div className={cn('flex h-full min-h-0 flex-1 flex-col overflow-hidden', !docked && className)}>
        <ConfigAccordionSections
          sections={visibleSections}
          expandedId={expandedId}
          onExpand={setExpandedId}
          searchQuery={searchQuery}
        />
      </div>
    </FormFieldLayoutProvider>
  );

  if (!docked) {
    return (
      <>
        <span data-bc-config-mode="floating" hidden />
        <FloatingPanelShell
          open
          onClose={() => setDocked(true)}
          title="Properties"
          titleIcon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />}
          headerActions={<PinToggleButton docked={false} onToggle={toggleDocked} />}
          headerBand={(
            <div className={TOOLBOX_PANEL_SEARCH_HOST_CLASS}>
              <ConfigSearchBox value={searchQuery} onChange={setSearchQuery} />
            </div>
          )}
          bounds={TOOLBOX_PANEL_DEFAULT_BOUNDS}
          defaultWidth={320}
          defaultHeight={560}
          initialPosition="top-right"
          dragFromHeaderOnly
          headerClassName={TOOLBOX_PANEL_HEADER_CLASS}
          titleClassName={TOOLBOX_PANEL_TITLE_CLASS}
          zIndexClassName="z-[90]"
        >
          {accordionBody}
        </FloatingPanelShell>
      </>
    );
  }

  return (
    <div
      data-bc-config-mode="docked"
      className={cn('flex h-full min-h-0 flex-1 flex-col overflow-hidden', className)}
    >
      <div className="flex shrink-0 items-center border-b border-slate-100 bg-slate-50/70 pe-1">
        <div className="min-w-0 flex-1">
          <ConfigSearchBox value={searchQuery} onChange={setSearchQuery} />
        </div>
        <PinToggleButton docked onToggle={toggleDocked} />
      </div>
      {accordionBody}
    </div>
  );
};
