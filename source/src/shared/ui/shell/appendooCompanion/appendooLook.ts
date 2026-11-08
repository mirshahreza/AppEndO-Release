export const APPENDOO_LOOK_IDS = [
  'candy',
  'contour',
  'wash',
  'gouache',
  'sumi',
  'charcoal',
  'graphite',
  'realistic',
  'woodcut',
  'pastel',
] as const;

export type AppendooLookId = (typeof APPENDOO_LOOK_IDS)[number];

export type AppendooLookFamily = 'gel' | 'contour' | 'paint';

export type AppendooLookMeta = {
  id: AppendooLookId;
  label: string;
  note: string;
  family: AppendooLookFamily;
};

export const APPENDOO_DEFAULT_LOOK: AppendooLookId = 'candy';

export const APPENDOO_LOOK_META: Record<AppendooLookId, AppendooLookMeta> = {
  candy: {
    id: 'candy',
    label: 'Candy gel',
    note: 'Soft candy volume, shine, and living trims.',
    family: 'gel',
  },
  contour: {
    id: 'contour',
    label: 'Contour',
    note: 'Pale ink outline, dark face, cast shadow kept.',
    family: 'contour',
  },
  wash: {
    id: 'wash',
    label: 'Watercolor',
    note: 'Wet pigment blooms on paper, with a bleeding edge.',
    family: 'paint',
  },
  gouache: {
    id: 'gouache',
    label: 'Gouache',
    note: 'Flat matte paint, opaque and quiet.',
    family: 'paint',
  },
  sumi: {
    id: 'sumi',
    label: 'Sumi',
    note: 'Dry brush, pooled ink, and a pale wash at the crown.',
    family: 'paint',
  },
  charcoal: {
    id: 'charcoal',
    label: 'Charcoal',
    note: 'Dusty stick drawing with a smudged edge.',
    family: 'paint',
  },
  graphite: {
    id: 'graphite',
    label: 'Graphite',
    note: 'Velvety graphite: paper tooth, hard light, and blended grayscale volume.',
    family: 'paint',
  },
  realistic: {
    id: 'realistic',
    label: 'Realistic',
    note: 'Photographic volume: subsurface color, soft key light, and skin grain.',
    family: 'paint',
  },
  woodcut: {
    id: 'woodcut',
    label: 'Woodcut',
    note: 'Carved graphic blocks, hard cuts, no shine.',
    family: 'paint',
  },
  pastel: {
    id: 'pastel',
    label: 'Pastel',
    note: 'Chalky color, broken edge, and a powder grain.',
    family: 'paint',
  },
};

export const isAppendooLookId = (value: string): value is AppendooLookId => (
  (APPENDOO_LOOK_IDS as readonly string[]).includes(value)
);

export const appendooLookShowsGel = (look: AppendooLookId): boolean => (
  APPENDOO_LOOK_META[look].family === 'gel'
);

export const appendooLookShowsAccessories = (look: AppendooLookId): boolean => (
  APPENDOO_LOOK_META[look].family === 'gel'
);

export const appendooLookShowsPaint = (look: AppendooLookId): boolean => (
  look !== 'contour'
);

export const appendooLookShowsColor = (look: AppendooLookId): boolean => (
  appendooLookShowsPaint(look) && look !== 'graphite'
);

export const appendooLookUsesInkFace = (look: AppendooLookId): boolean => (
  APPENDOO_LOOK_META[look].family !== 'gel' && look !== 'realistic'
);
