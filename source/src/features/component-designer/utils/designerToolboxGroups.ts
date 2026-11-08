import {
  buildCatalogToolboxGroups,
  resolveCatalogToolboxGroup,
  type CatalogToolboxGroupId,
} from '../../../domain/component-designer/toolboxFromCatalog';
import type { DesignerPaletteItem } from '../../../domain/component-designer/types';
import { listCatalogSectionGroups } from '../../../domain/base-components/catalogAccess';

/** Toolbox groups = Base Components groups. Labels come from the catalog. */
export type DesignerToolboxGroup = CatalogToolboxGroupId;

export const DESIGNER_TOOLBOX_GROUPS: readonly DesignerToolboxGroup[] =
  listCatalogSectionGroups().map((group) => group.id);

export const DESIGNER_TOOLBOX_GROUP_LABELS: Record<DesignerToolboxGroup, string> =
  Object.fromEntries(
    listCatalogSectionGroups().map((group) => [group.id, group.label]),
  ) as Record<DesignerToolboxGroup, string>;

export const resolveToolboxGroup = (
  item: Pick<DesignerPaletteItem, 'id' | 'category'>,
): DesignerToolboxGroup => resolveCatalogToolboxGroup(item);

export const buildToolboxGroupedPalette = (
  items: readonly DesignerPaletteItem[],
): Array<{ category: DesignerToolboxGroup; label: string; items: DesignerPaletteItem[] }> =>
  buildCatalogToolboxGroups(items);
