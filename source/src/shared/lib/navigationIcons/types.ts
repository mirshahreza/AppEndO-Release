import type { ComponentType, SVGProps } from 'react';

export type NavigationIconPackId =
  | 'lucide'
  | 'tabler'
  | 'phosphor'
  | 'heroicons'
  | 'solar'
  | 'doodle'
  | 'marketeq';

export type NavigationIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type NavigationIconEntry = readonly [string, NavigationIconComponent];

export type NavigationIconPackMeta = {
  id: NavigationIconPackId;
  label: string;
};

export type NavigationIconPackModule = {
  entries: ReadonlyArray<NavigationIconEntry>;
  map: Record<string, NavigationIconComponent>;
  /** Name list for large packs; avoids building full entry tuples up front. */
  iconNames?: readonly string[];
};
