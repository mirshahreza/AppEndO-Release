import React from 'react';
import { ListPageShell } from '../../../shared/ui';
import type { DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import { DataEnrichmentQuestionsPanel } from './DataEnrichmentQuestionsPanel';

type DataSourcesQuestionsPageViewProps = {
  dataSource: DataSourceRecord;
  onBack: () => void;
};

export const DataSourcesQuestionsPageView: React.FC<DataSourcesQuestionsPageViewProps> = ({
  dataSource,
  onBack,
}) => (
  <ListPageShell>
    <DataEnrichmentQuestionsPanel dataSource={dataSource} active onBack={onBack} />
  </ListPageShell>
);
