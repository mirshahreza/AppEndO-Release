import { Circle, Layers, LayoutTemplate, Table2, Wand2 } from 'lucide-react';
import type { CatalogKind } from '../../../../domain/component-designer/layout-presets/catalogSystemTags';
import { CATALOG_TAG_CUSTOM } from '../../../../domain/component-designer/layout-presets/catalogSystemTags';

export type CatalogCreateKind = 'crud-set' | 'templates' | 'empty';

export type CreateComponentIdentity = {
  name: string;
  catalogKind: CatalogKind;
};

/** Operator drafts default to Custom; Shell / Template are explicit choices. */
export const defaultCatalogKindForCreate = (): CatalogKind => CATALOG_TAG_CUSTOM;

export const CATALOG_CREATE_KINDS: Array<{
  value: CatalogCreateKind;
  title: string;
  description: string;
  icon: typeof Layers;
}> = [
  {
    value: 'crud-set',
    title: 'CRUD Set',
    description: 'List plus create, edit, and delete — you define how they work.',
    icon: Layers,
  },
  {
    value: 'templates',
    title: 'Based on Templates',
    description: 'Copy a starter layout\'s parts into a new component.',
    icon: LayoutTemplate,
  },
];

/** Parked — not catalog Create options. Keep for a later re-enable. */
export const PARKED_API_CREATE_KINDS = [
  {
    value: 'empty' as const,
    title: 'Empty',
    description: 'Blank canvas with nothing in it.',
    icon: Circle,
  },
  {
    value: 'form' as const,
    title: 'API Connected Form',
    description: 'Generate a wired form from an API endpoint.',
    icon: Wand2,
  },
  {
    value: 'grid' as const,
    title: 'API Connected Grid',
    description: 'Generate a wired table from a list API.',
    icon: Table2,
  },
];
