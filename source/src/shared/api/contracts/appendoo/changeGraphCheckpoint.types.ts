import type { ChangeGraph } from './changeGraph.types';
import type {
  ChangeGraphSchedulerSummary,
  ScheduledNodeExecutionResult,
} from '../../../lib/appendoo/changeGraphScheduler';

export type ChangeGraphCheckpoint = {
  checkpointId: string;
  changeGraphId: string;
  changeSetId: string;
  nodes: ChangeGraph['nodes'];
  results: ScheduledNodeExecutionResult[];
  summary: ChangeGraphSchedulerSummary;
  savedAt: string;
};

export const CHANGE_GRAPH_CHECKPOINT_VERSION = '1.0.0';
