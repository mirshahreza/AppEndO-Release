/**
 * Build and publish a Component Designer UI for an existing managed server function.
 *
 * Usage:
 *   npx tsx scripts/build-server-function-ui.ts math.sum-two-numbers
 */
import { buildDesignerComponentPath, buildDesignerHandoffUrl } from '../src/features/component-designer/lib/designerDraftPath';
import { buildDesignerDraftRecordForServerFunction } from '../src/shared/lib/appendoo/serverFunctionUiDesignerRecord';
import {
  upsertDraftIndexSummary,
  writeDraftFile,
} from '../src/server/domain/component-designer/draftIo';
import { publishDesignerComponent } from '../src/server/services/component-designer/publishCoordinator.service';

const functionId = process.argv[2]?.trim() || 'math.sum-two-numbers';

const main = () => {
  const record = buildDesignerDraftRecordForServerFunction(
    functionId,
    'appendoo-build-server-function-ui',
  );

  writeDraftFile(record);
  upsertDraftIndexSummary({
    id: record.id,
    name: record.name,
    folder: record.folder,
    createdAt: record.metadata.createdAt,
    updatedAt: record.metadata.updatedAt,
    createdBy: record.metadata.createdBy,
    updatedBy: record.metadata.updatedBy,
  });

  const publishState = publishDesignerComponent(record.id, 'appendoo-build-server-function-ui');
  const componentPath = buildDesignerComponentPath(record.folder, record.name);

  console.log(JSON.stringify({
    ok: true,
    functionId,
    draftId: record.id,
    name: record.name,
    folder: record.folder,
    componentPath,
    lifecycle: publishState.lifecycle,
    publishedVersion: publishState.publishedVersion,
    designerUrl: buildDesignerHandoffUrl('/studio', {
      layoutId: record.id,
      name: record.name,
      componentPath,
    }),
  }, null, 2));
};

main();
