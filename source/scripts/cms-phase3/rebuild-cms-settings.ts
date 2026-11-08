/**
 * Rebuild + republish CMS Settings General page (left-rail tones) from existing snapshot ids.
 */
import { saveDesignerDraft } from '../../src/server/services/component-designer/draftCoordinator.service';
import { publishDesignerComponent } from '../../src/server/services/component-designer/publishCoordinator.service';
import { pinDesignerPublishedLoaderRef } from '../../src/server/services/platform/designerRoutePropagation.service';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { ensureControlPlaneInitialized, resetControlPlaneInitState } from '../../src/server/db/controlPlaneInit';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildCmsSettingsDraft } from './cmsDesignerScaffold';
import { resolveCmsIds } from './cmsIds';

const ACTOR = 'cms-phase3';
const DRAFT_ID = 'draft-cms-settings';
const SNAPSHOT = join(process.cwd(), 'workspace', 'designer', 'snapshots', 'cms', DRAFT_ID, 'latest.json');

type Option = { value: string; label: string };

const readSelectOptions = (document: { nodes: Record<string, { props?: Record<string, unknown> }> }, field: string): Option[] => {
  for (const node of Object.values(document.nodes)) {
    const binding = (node as { binding?: Record<string, { column?: string }> }).binding?.['prop:selectedKeys'];
    if (binding?.column !== field) {
      continue;
    }
    const raw = node.props?.items;
    if (typeof raw !== 'string') {
      continue;
    }
    try {
      const items = JSON.parse(raw) as Array<{ id?: string; textValue?: string }>;
      return items
        .filter((item) => typeof item.id === 'string' && typeof item.textValue === 'string')
        .map((item) => ({ value: item.id!, label: item.textValue! }));
    } catch {
      return [];
    }
  }
  return [];
};

const main = async () => {
  if (!existsSync(SNAPSHOT)) {
    throw new Error(`Missing snapshot ${SNAPSHOT}`);
  }
  const existing = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as {
    document: { nodes: Record<string, { props?: Record<string, unknown> }> };
  };

  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const ids = await resolveCmsIds();
  const commentPolicies = readSelectOptions(existing.document, 'commentsPolicyCode');
  const commentBodyFormats = readSelectOptions(existing.document, 'commentsBodyFormatCode');
  const bundle = buildCmsSettingsDraft({
    commentPolicies: commentPolicies.length > 0 ? commentPolicies : [{ value: 'auto', label: 'Automatic' }],
    commentBodyFormats: commentBodyFormats.length > 0 ? commentBodyFormats : [{ value: 'plain', label: 'Plain' }],
    baseInfoCategoryIds: ids.categoryIds,
  });

  const saved = saveDesignerDraft({
    id: DRAFT_ID,
    name: bundle.name,
    folder: bundle.folder,
    document: { ...bundle.document, id: DRAFT_ID, name: bundle.name },
    bindingDefinitions: bundle.bindingDefinitions as unknown as Record<
      string,
      import('../../src/domain/component-designer/types').DesignerBindingDefinition
    >,
    actor: ACTOR,
  });
  const published = publishDesignerComponent(saved.id, ACTOR);
  const loaderRef = published.loaderRef
    ?? `${saved.folder}/${saved.name}@v${published.publishedVersion}`;
  const pinOnce = () => pinDesignerPublishedLoaderRef({
    componentPath: `${saved.folder}/${saved.name}`,
    loaderRef,
    title: 'CMS Settings',
    actor: { userId: null, username: ACTOR },
  });
  await pinOnce().catch(() => pinOnce());
  console.log(`  rebuilt+published ${DRAFT_ID} → ${loaderRef}`);
};

main()
  .catch((error: unknown) => {
    console.error('[rebuild-cms-settings]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
