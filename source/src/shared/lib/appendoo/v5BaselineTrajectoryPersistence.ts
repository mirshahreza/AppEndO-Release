import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../../core/runtime/RuntimeFileStore';
import type { TrajectoryFixture } from '../../api/contracts/appendoo/v5BaselineTrajectory.types';

const TRAJECTORY_TMP_DIR = 'workspace/appendoo/v5-baseline-trajectories/.tmp';
const TRAJECTORY_ROOT = 'workspace/appendoo/v5-baseline-trajectories';

const resolveTrajectoryRoot = (): string => path.join(process.cwd(), TRAJECTORY_ROOT);

export const trajectoryFixtureFilePath = (scenarioId: string): string => (
  path.join(resolveTrajectoryRoot(), `${scenarioId}.json`)
);

export const persistTrajectoryFixture = (fixture: TrajectoryFixture): void => {
  const filePath = trajectoryFixtureFilePath(fixture.scenarioId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  atomicWriteText(filePath, JSON.stringify(fixture, null, 2), TRAJECTORY_TMP_DIR);
};

export const loadTrajectoryFixture = (scenarioId: string): TrajectoryFixture | undefined => {
  const filePath = trajectoryFixtureFilePath(scenarioId);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TrajectoryFixture;
  } catch {
    return undefined;
  }
};

export const listPersistedTrajectoryFixtureFiles = (): string[] => {
  const root = resolveTrajectoryRoot();
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root).filter((name) => name.endsWith('.json'));
};
