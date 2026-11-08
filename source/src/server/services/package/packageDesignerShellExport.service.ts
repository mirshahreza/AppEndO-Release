import { SHELL_DRAFT_FOLDER } from '../../../shared/lib/designerShellEntry';
import { isSystemManagedShellLayoutDraft } from '../../../shared/lib/designerShellEntry';
import { getDesignerDraft, listDesignerDrafts } from '../../domain/component-designer/draftIo';

export type PackageBuilderShellCatalogItem = {
  shellKey: string;
  title: string;
  entry: string;
  draftJson: string;
};

const buildShellZipEntry = (shellKey: string): string =>
  `designer/${SHELL_DRAFT_FOLDER}/${shellKey.trim()}.json`;

/** Shell drafts owned by the retired Shell Designer authoring surface. */
const isShellDesignerOwned = (value: unknown): boolean =>
  Boolean(value && typeof value === 'object' && (value as { owner?: unknown }).owner === 'shell-designer');

export function listPackageBuilderShellCatalog(): PackageBuilderShellCatalogItem[] {
  const items: PackageBuilderShellCatalogItem[] = [];

  for (const summary of listDesignerDrafts()) {
    if (isSystemManagedShellLayoutDraft(summary)) {
      continue;
    }

    const draft = getDesignerDraft(summary.id);
    if (!draft) {
      continue;
    }

    const shellMeta = (draft.document as { metadata?: { shellDesigner?: unknown } } | undefined)
      ?.metadata
      ?.shellDesigner;
    if (!isShellDesignerOwned(shellMeta)) {
      continue;
    }

    const shellKey = summary.name.trim();
    if (!shellKey) {
      continue;
    }

    const payload = {
      schema: draft.schema,
      id: draft.id,
      name: draft.name,
      folder: draft.folder,
      document: draft.document,
      bindingDefinitions: draft.bindingDefinitions,
      workspace: draft.workspace,
      metadata: draft.metadata,
    };

    const recipe = (shellMeta as { recipe?: { identity?: { displayName?: string } } }).recipe;
    const displayName = recipe?.identity?.displayName?.trim();

    items.push({
      shellKey,
      title: displayName || shellKey,
      entry: buildShellZipEntry(shellKey),
      draftJson: `${JSON.stringify(payload, null, 2)}\n`,
    });
  }

  return items.sort((left, right) => left.title.localeCompare(right.title));
}

export function resolvePackageBuilderShellsByKeys(
  shellKeys: readonly string[],
): { shells: PackageBuilderShellCatalogItem[]; missing: string[] } {
  const catalog = listPackageBuilderShellCatalog();
  const byKey = new Map(catalog.map((item) => [item.shellKey, item]));
  const shells: PackageBuilderShellCatalogItem[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const raw of shellKeys) {
    const shellKey = raw.trim();
    if (!shellKey || seen.has(shellKey)) {
      continue;
    }
    seen.add(shellKey);
    const match = byKey.get(shellKey);
    if (!match) {
      missing.push(shellKey);
      continue;
    }
    shells.push(match);
  }

  return { shells, missing };
}
