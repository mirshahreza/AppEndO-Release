import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../runtime/RuntimeFileStore';
import type { AgentRuntimeEvent } from './runtimeEvents';

/**
 * V5 Phase P01 — durable, append-only event log for one agent run (`taskId`+`attemptId`).
 *
 * `AgentOrchestrator` emits the subset of `AgentRuntimeEventType` that's reachable today:
 * `TaskCreated`, `ModelInvocationStarted/Completed`, `ActionProposed`, `ActionAllowed`,
 * `ActionRejected`, `ToolExecutionStarted/Completed/Failed`, `ClarificationRequested`,
 * `ProgressRecorded`, `StallDetected`, `TaskCompleted/Failed/Blocked`. This is not a parallel
 * event bus — every emission happens at an existing real decision point in `AgentOrchestrator.run()`
 * (see inline comments there), and `reduceOperationalState` (`operationalState.ts`) consumes this
 * exact stream to build canonical `OperationalState`.
 */

const EVENTS_ROOT = 'workspace/appendoo/agent-runtime-events';
const EVENTS_TMP_DIR = `${EVENTS_ROOT}/.tmp`;

const resolveEventsRoot = (): string => path.join(process.cwd(), EVENTS_ROOT);

const sanitizeId = (id: string): string => id.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);

export const eventLogFilePath = (taskId: string, attemptId: string): string => (
  path.join(resolveEventsRoot(), `${sanitizeId(taskId)}__${sanitizeId(attemptId)}.json`)
);

/** In-process + durable event log for a single run. One instance per `AgentOrchestrator.run()` call. */
export class AgentEventStore {
  private readonly events: AgentRuntimeEvent[] = [];

  constructor(private readonly taskId: string, private readonly attemptId: string, initialEvents: readonly AgentRuntimeEvent[] = []) {
    this.events.push(...initialEvents);
  }

  /**
   * V5 Phase P09 § V5-13 — persists synchronously on every call, not only at the end of a run.
   * A prior version persisted once at the end, which meant a process crash mid-run lost the
   * *entire* event log for that attempt — making "crash after patch apply, before completion
   * event, resume, reconcile" structurally impossible to detect (there was nothing on disk to
   * reconcile from). Per-event write cost is accepted deliberately: durability is the point.
   */
  append(event: AgentRuntimeEvent): void {
    this.events.push(event);
    this.persist();
  }

  list(): readonly AgentRuntimeEvent[] {
    return this.events;
  }

  /** Writes the full event log to disk. Also callable directly (e.g. after reconciling a resumed log). */
  persist(): void {
    const filePath = eventLogFilePath(this.taskId, this.attemptId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    atomicWriteText(filePath, JSON.stringify(this.events, null, 2), path.join(process.cwd(), EVENTS_TMP_DIR));
  }
}

export const loadEventLog = (taskId: string, attemptId: string): AgentRuntimeEvent[] | undefined => {
  const filePath = eventLogFilePath(taskId, attemptId);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as AgentRuntimeEvent[];
  } catch {
    return undefined;
  }
};
