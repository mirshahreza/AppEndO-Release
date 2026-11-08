import React, { useState } from 'react';
import type { DataSourcesPageModel } from '../hooks/useDataSourcesPage';
import type { DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import { DataSourceDeleteModal } from './DataSourceDeleteModal';
import { DataSourceFormModal } from './DataSourceFormModal';
import { DataEnrichmentModal } from './DataEnrichmentModal';
import { GenerateDocumentationModal } from './GenerateDocumentationModal';
import { DataSourceCardGrid } from './DataSourceCardGrid';
import { DataSourcesFeedbackToasts } from './DataSourcesFeedbackToasts';
import { DataSourcesQuestionsPageView } from './DataSourcesQuestionsPageView';
import { DataSourcesToolbar } from './DataSourcesToolbar';

type DataSourcesPageViewProps = {
  page: DataSourcesPageModel;
};

export const DataSourcesPageView: React.FC<DataSourcesPageViewProps> = ({ page }) => {
  const [enrichTarget, setEnrichTarget] = useState<DataSourceRecord | null>(null);
  const [docsTarget, setDocsTarget] = useState<DataSourceRecord | null>(null);

  if (page.questionsIdFromUrl) {
    if (!page.questionsDataSource) {
      return (
        <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">
          Loading questions…
        </div>
      );
    }

    return (
      <DataSourcesQuestionsPageView
        dataSource={page.questionsDataSource}
        onBack={page.closeQuestions}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-white" id="data-sources-container">
      <DataSourcesToolbar page={page} />
      <DataSourceCardGrid
        isLoading={page.loading}
        isError={page.isError}
        error={page.listLoadError}
        onRetry={() => void page.refreshList()}
        isRetrying={page.isRetryingList}
        items={page.items}
        testingId={page.testingId}
        onTest={(id) => { void page.testConnectivity(id); }}
        onEdit={page.openEditDialog}
        onDelete={page.openDeleteConfirm}
        onEnrich={(item) => setEnrichTarget(item)}
        onGenerateDocs={(item) => setDocsTarget(item)}
        resolveQuestionsHref={page.resolveQuestionsHref}
        onOpenQuestions={page.openQuestions}
        onScroll={page.handleGridScroll}
      />
      <DataSourceFormModal page={page} />
      <DataEnrichmentModal
        dataSource={enrichTarget}
        onClose={() => setEnrichTarget(null)}
        onOpenQuestions={() => {
          if (!enrichTarget) {
            return;
          }
          const target = enrichTarget;
          setEnrichTarget(null);
          page.openQuestions(target);
        }}
      />
      <GenerateDocumentationModal
        dataSource={docsTarget}
        onClose={() => setDocsTarget(null)}
      />
      {page.deleteTarget && (
        <DataSourceDeleteModal
          target={page.deleteTarget}
          onCancel={page.cancelDelete}
          onConfirm={() => void page.confirmDelete()}
        />
      )}
      <DataSourcesFeedbackToasts
        error={page.error}
        successMessage={page.successMessage}
        onDismissError={page.dismissError}
        onDismissSuccess={page.dismissSuccess}
      />
    </div>
  );
};
