// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { WorkflowDesignerProjection } from '../../types';

const { getPublishDiff, validateDraft, publish, getInstanceMigrationImpact, migrateInstances } = vi.hoisted(() => ({
  getPublishDiff: vi.fn(),
  validateDraft: vi.fn(),
  publish: vi.fn(),
  getInstanceMigrationImpact: vi.fn(),
  migrateInstances: vi.fn(),
}));

vi.mock('../../api/workflowsApi', () => ({
  workflowsApi: { getPublishDiff, validateDraft, publish, getInstanceMigrationImpact, migrateInstances },
  WorkflowsApiError: class WorkflowsApiError extends Error {
    code = 'ERR';
  },
}));

import { WorkflowPublishDialog } from '../ValidationPublishPanel';

const baseProjection: WorkflowDesignerProjection = {
  definition: { id: 1, scopeKey: 'default', key: 'wf', lifecycleStatus: 'ACTIVE', creationMode: 'NEW', createdFromDefinitionId: null, createdFromRevisionId: null, stateVersion: 0, createdAt: null, createdBy: null, updatedAt: null, updatedBy: null },
  publicationStatus: { isPublished: true, lastPublishedAt: null, lastPublishedBy: null, lastUnpublishedAt: null, lastUnpublishedBy: null },
  draftVersion: 2,
  model: { schemaVersion: '1', key: 'wf', name: 'wf', inputSchema: { type: 'INLINE', schema: {} }, outputSchema: { type: 'INLINE', schema: {} }, variables: [], start: { type: 'MANUAL_API', targetNodeKey: 'end-1' }, nodes: [], edges: [], policies: {} as never },
  designerView: null,
  latestValidation: null,
  currentPublishedRevision: { id: 10, revisionNumber: 1, publicationStatus: 'PUBLISHED', bindingStatus: 'NOT_REQUIRED', semanticFingerprint: 'x' },
  actionCatalog: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkflowPublishDialog — post-publish instance migration offer (p-99/WFT-8)', () => {
  it('offers migration when in-flight instances exist on the previous revision, and reports the migrated count', async () => {
    getPublishDiff.mockResolvedValue({ diff: { identical: false, nodes: [], edges: [], bindingImpactNodeKeys: [] } });
    validateDraft.mockResolvedValue({ report: { status: 'PASSED', issuesJson: '[]' } });
    publish.mockResolvedValue({ revision: { id: 11, revisionNumber: 2 }, bindingActivation: null });
    getInstanceMigrationImpact.mockResolvedValue({
      impact: {
        fromRevisionId: 10, toRevisionId: 11, totalConsidered: 2, migratableCount: 1, blockedCount: 1,
        items: [{ instanceId: 501, safe: true }, { instanceId: 502, safe: false, reason: { code: 'NODE_CHANGED', nodeKey: 'a2' } }],
      },
    });
    migrateInstances.mockResolvedValue({ impact: { fromRevisionId: 10, toRevisionId: 11, totalConsidered: 2, migratableCount: 1, blockedCount: 1, items: [], migratedCount: 1 } });

    const onPublished = vi.fn();
    render(<WorkflowPublishDialog open definitionId={1} projection={baseProjection} onClose={() => {}} onPublished={onPublished} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /publish/i })).not.toBeDisabled(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(screen.getByText(/2 in-flight instances were still running/)).toBeInTheDocument());
    expect(screen.getByText(/1 can be safely migrated/)).toBeInTheDocument();
    expect(screen.getByText(/1 instance left untouched/)).toBeInTheDocument();
    expect(onPublished).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /migrate 1 now/i }));
    await waitFor(() => expect(screen.getByText('1 instance migrated to the new revision.')).toBeInTheDocument());
    expect(migrateInstances).toHaveBeenCalledWith(10, 11);

    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('publishes straight through with no offer when the previous revision has no in-flight instances', async () => {
    getPublishDiff.mockResolvedValue({ diff: { identical: false, nodes: [], edges: [], bindingImpactNodeKeys: [] } });
    validateDraft.mockResolvedValue({ report: { status: 'PASSED', issuesJson: '[]' } });
    publish.mockResolvedValue({ revision: { id: 11, revisionNumber: 2 }, bindingActivation: null });
    getInstanceMigrationImpact.mockResolvedValue({ impact: { fromRevisionId: 10, toRevisionId: 11, totalConsidered: 0, migratableCount: 0, blockedCount: 0, items: [] } });

    const onPublished = vi.fn();
    render(<WorkflowPublishDialog open definitionId={1} projection={baseProjection} onClose={() => {}} onPublished={onPublished} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /publish/i })).not.toBeDisabled(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/in-flight instances/)).not.toBeInTheDocument();
  });
});
