import { describe, expect, it } from 'vitest';
import {
  archiveAgentThinkingIntoSteps,
  preserveActivityStepsOnConnectionFailure,
} from '../preserveActivityOnConnectionFailure';

describe('archiveAgentThinkingIntoSteps', () => {
  it('archives previous thinking into the timeline', () => {
    const steps = archiveAgentThinkingIntoSteps(
      undefined,
      'Understanding target and server function contract…',
    );
    expect(steps).toEqual([
      expect.objectContaining({
        name: 'status',
        status: 'done',
        activityTitle: 'Understanding target and server function contract…',
      }),
    ]);
  });

  it('does not duplicate the same status title', () => {
    const first = archiveAgentThinkingIntoSteps(undefined, 'Planning…');
    const second = archiveAgentThinkingIntoSteps(first, 'Planning…');
    expect(second).toHaveLength(1);
  });
});

describe('preserveActivityStepsOnConnectionFailure', () => {
  it('keeps completed steps and marks running steps as error', () => {
    const preserved = preserveActivityStepsOnConnectionFailure(
      [
        {
          id: '1',
          name: 'read_file',
          args: { path: 'a.ts' },
          status: 'done',
          activityTitle: 'Reading a.ts',
        },
        {
          id: '2',
          name: 'search',
          args: { query: 'x' },
          status: 'running',
          activityTitle: 'Searching',
        },
      ],
      undefined,
    );

    expect(preserved).toEqual([
      expect.objectContaining({ id: '1', status: 'done' }),
      expect.objectContaining({ id: '2', status: 'error', activityTitle: 'Searching' }),
    ]);
  });

  it('captures last thinking status when no steps exist yet', () => {
    const preserved = preserveActivityStepsOnConnectionFailure(undefined, 'Starting agent…');
    expect(preserved).toEqual([
      expect.objectContaining({
        status: 'error',
        activityTitle: 'Starting agent…',
        name: 'status',
      }),
    ]);
  });

  it('returns undefined when there was nothing to preserve', () => {
    expect(preserveActivityStepsOnConnectionFailure(undefined, undefined)).toBeUndefined();
    expect(preserveActivityStepsOnConnectionFailure([], '   ')).toBeUndefined();
  });
});
