// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ContextUnderstandingPanel } from '../ContextUnderstandingPanel';

describe('ContextUnderstandingPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a one-line understanding summary by default', () => {
    render(
      <ContextUnderstandingPanel
        snapshot={{
          requestClass: 'ENGINEERING_CHANGE',
          taskProfile: 'engineering_change',
          routingReason: 'Engineering change detected for server functions.',
          useEngineeringPipeline: true,
          applicationScopeKey: 'platform:studio:page:server-functions',
          applicationScopeKind: 'platform',
          contextPackId: 'ctx:1',
          contextPackTargetCount: 2,
          contextPackStandardsCount: 3,
        }}
      />,
    );

    expect(screen.getByTestId('context-understanding-panel')).toBeTruthy();
    expect(screen.getByText('Engineering change detected for server functions.')).toBeTruthy();
    expect(screen.queryByText('ctx:1')).toBeNull();
  });

  it('renders context pack enrichment explanations when details are expanded', () => {
    render(
      <ContextUnderstandingPanel
        snapshot={{
          requestClass: 'ENGINEERING_CHANGE',
          taskProfile: 'INTENT_COMPILE',
          routingReason: 'Context pack enriched from feature graph.',
          useEngineeringPipeline: true,
          applicationScopeKey: 'platform:studio:page:users',
          applicationScopeKind: 'platform',
          contextPackSelectionExplanations: [{
            reasonCode: 'GRAPH_DEPENDENCY',
            summary: 'ASG dependency page:Users linked to primary target.',
          }],
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('context-understanding-details-toggle'));
    expect(screen.getByTestId('context-pack-enrichment-explanations')).toBeTruthy();
    expect(screen.getByText(/GRAPH_DEPENDENCY/)).toBeTruthy();
  });
});
