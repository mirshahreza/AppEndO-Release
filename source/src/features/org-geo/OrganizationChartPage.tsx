import React from 'react';
import { OrgGeoWorkspace } from './components/OrgGeoWorkspace';
import { ORGANIZATION_CHART_WORKSPACE_CONFIG } from './lib/orgGeoWorkspaceConfig';

export const OrganizationChartPage: React.FC = () => (
  <OrgGeoWorkspace config={ORGANIZATION_CHART_WORKSPACE_CONFIG} />
);
