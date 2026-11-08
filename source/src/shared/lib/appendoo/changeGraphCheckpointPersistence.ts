import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import type { ChangeGraphCheckpoint } from '../../api/contracts/appendoo/changeGraphCheckpoint.types';
import { parseChangeGraphCheckpoint } from './changeGraphCheckpointValidation';

const CHECKPOINT_TMP_DIR = 'workspace/appendoo/checkpoints/.tmp';
const DEFAULT_CHECKPOINT_ROOT = 'workspace/appendoo/checkpoints';

export function isDurableGraphCheckpointEnabled(): boolean {
  return process.env.APPENDOO_DURABLE_GRAPH_CHECKPOINTS === '1';
}

const resolveCheckpointRoot = (): string => {
  const configured = process.env.APPENDOO_CHECKPOINT_ROOT?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }
  return path.join(process.cwd(), DEFAULT_CHECKPOINT_ROOT);
};

const sanitizeCheckpointFileName = (changeGraphId: string): string => (
  changeGraphId.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120)
);

export const checkpointFilePath = (changeGraphId: string): string => (
  path.join(resolveCheckpointRoot(), `${sanitizeCheckpointFileName(changeGraphId)}.json`)
);

export const persistCheckpointToDisk = (checkpoint: ChangeGraphCheckpoint): void => {
  if (!isDurableGraphCheckpointEnabled()) {
    return;
  }

  const filePath = checkpointFilePath(checkpoint.changeGraphId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  atomicWriteText(filePath, JSON.stringify(checkpoint, null, 2), CHECKPOINT_TMP_DIR);
};

export const loadCheckpointFromDisk = (changeGraphId: string): ChangeGraphCheckpoint | undefined => {
  if (!isDurableGraphCheckpointEnabled()) {
    return undefined;
  }

  const filePath = checkpointFilePath(changeGraphId);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    return parseChangeGraphCheckpoint(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return undefined;
  }
};

export const clearCheckpointFromDisk = (changeGraphId: string): void => {
  const filePath = checkpointFilePath(changeGraphId);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
};
