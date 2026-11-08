import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../../../core/runtime/runtimePaths';

const DESIGNER_STORAGE_DIR = runtimeDirs.designer;

export const designerStoragePaths = {
  root: DESIGNER_STORAGE_DIR,
  drafts: runtimeDirs.designerDrafts,
  index: path.join(DESIGNER_STORAGE_DIR, 'index.json'),
  snapshots: runtimeDirs.designerSnapshots,
  previewLogs: runtimeDirs.designerPreviewLogs,
  exports: runtimeDirs.designerExports,
} as const;

export const ensureDesignerStoragePaths = (): void => {
  Object.values(designerStoragePaths).forEach((targetPath) => {
    const dirPath = path.extname(targetPath) ? path.dirname(targetPath) : targetPath;
    fs.mkdirSync(dirPath, { recursive: true });
  });
};

const PREVIEW_LOG_RETENTION_COUNT = 40;

const enforcePreviewLogRetention = (retentionCount = PREVIEW_LOG_RETENTION_COUNT): void => {
  ensureDesignerStoragePaths();
  const files = fs
    .readdirSync(designerStoragePaths.previewLogs)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const filePath = path.join(designerStoragePaths.previewLogs, name);
      const stat = fs.statSync(filePath);
      return {
        filePath,
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  const stale = files.slice(Math.max(0, retentionCount));
  stale.forEach((item) => {
    try {
      fs.unlinkSync(item.filePath);
    } catch {
      return;
    }
  });
};

export const writeDesignerPreviewLog = (payload: unknown): string => {
  ensureDesignerStoragePaths();
  const timestamp = new Date().toISOString();
  const fileName = `preview-${timestamp.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filePath = path.join(designerStoragePaths.previewLogs, fileName);

  atomicWriteText(filePath, JSON.stringify({
    schema: 'component-designer-preview-log',
    schemaVersion: '1.0.0',
    createdAt: timestamp,
    payload,
  }, null, 2), runtimeDirs.workspaceTemp);

  enforcePreviewLogRetention();

  return filePath;
};
