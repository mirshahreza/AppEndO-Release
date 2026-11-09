/** Operator-facing reference codes for living catalog specimens (copy into prompts / specs). */

export const BC_SPECIMEN_PREFIX = 'bc';
export const STUDIO_BC_SPECIMEN_PREFIX = BC_SPECIMEN_PREFIX;

export const HI_SPECIMEN_PREFIX = 'hi';
export const HWY_IC_SPECIMEN_PREFIX = HI_SPECIMEN_PREFIX;

const HI_SECTION_SLUG: Record<string, string> = {
  'member-directory-face': 'mdf',
  'member-avatar-code': 'mac',
  'member-grid-face-cell': 'mgf',
  'member-admin-face-cell': 'maf',
  'electoral-division-path-links': 'edp',
  'electoral-division-grid-cell': 'edg',
  'geo-responsibility-member-face': 'grf',
  'geo-responsibility-mismatch-badge': 'grm',
  'targhin-member-face': 'tmf',
  'targhin-dossier-face-link': 'tdl',
  'targhin-requester-request-cell': 'trc',
  'targhin-nego-affordance': 'tna',
  'targhin-decision-badge': 'tdb',
  'list-filter-identity-row': 'lfi',
  'list-legacy-filter-bar-toggle': 'lft',
};

const HI_VARIANT_SLUG: Record<string, string> = {
  registered: 'reg',
  tracking: 'trk',
  rejection: 'rej',
  candidate: 'cand',
  allocated: 'alc',
  clickable: 'clk',
  admin: 'adm',
  fullPath: 'fpath',
  pathColumn: 'pcol',
  province: 'prov',
  official: 'off',
  nominee: 'nom',
  badge: 'bdg',
  withPath: 'wp',
  executor: 'ex',
  linked: 'lnk',
  column: 'col',
  thread: 'thr',
  approved: 'ok',
  row: 'row',
  toggle: 'tgl',
};

const BC_SECTION_SLUG: Record<string, string> = {
  'text-fields': 'tf',
  'choice-fields': 'cf',
  'selection-fields': 'sf',
  'structured-fields': 'st',
  'ai-fields': 'ai',
  'crud-set': 'crud',
  'edit-view': 'ev',
  'where-builder': 'wb',
  'floating-panel': 'fp',
  'toolbox-panel': 'tb',
  'sidebar-menu': 'sb',
  'ai-chat-panel': 'chat',
  'canvas-toolbar': 'ct',
  'shell-foundation': 'sh',
  'shell-navigation': 'nav',
  'loading-error-empty': 'lee',
  'markdown-editor': 'md',
  'html-editor': 'html',
  'phone-number': 'tel',
  'date-time': 'dt',
  'file-media-input': 'file',
  'component-layout': 'lay',
  'client-component': 'cc',
  'media-players': 'mp',
  'gradient-picker': 'gp',
  'variable-color-picker': 'vcp',
  'border-shadow-picker': 'bsp',
  'color-picker': 'cp',
  'orbit-border': 'ob',
  'orbit-bg': 'obg',
  'transfer-list': 'xl',
  'appendoo-companion': 'ac',
};

const BC_FORM_GROUP_SLUG: Record<string, string> = {
  text: 't',
  choice: 'c',
  selection: 's',
  structured: 'st',
  ai: 'ai',
};

function hiSectionSlug(sectionId: string): string {
  const key = sectionId.trim();
  return HI_SECTION_SLUG[key] ?? key;
}

function hiVariantSlug(variantId: string): string {
  const key = variantId.trim();
  return HI_VARIANT_SLUG[key] ?? key;
}

function bcSectionSlug(sectionId: string): string {
  const key = sectionId.trim();
  return BC_SECTION_SLUG[key] ?? key;
}

function bcSpecimenSlug(specimenId: string): string {
  const key = specimenId.trim();
  return BC_FORM_GROUP_SLUG[key] ?? key;
}

export function formatStudioBcSpecimenCode(sectionId: string, specimenId?: string): string {
  const base = `${BC_SPECIMEN_PREFIX}.${bcSectionSlug(sectionId)}`;
  if (!specimenId?.trim()) {
    return base;
  }
  return `${base}.${bcSpecimenSlug(specimenId)}`;
}

export function formatHwyIcSectionCode(sectionId: string): string {
  return `${HI_SPECIMEN_PREFIX}.${hiSectionSlug(sectionId)}`;
}

export function formatHwyIcSpecimenCode(sectionId: string, variantId: string): string {
  return `${formatHwyIcSectionCode(sectionId)}.${hiVariantSlug(variantId)}`;
}
