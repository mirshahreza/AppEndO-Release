import React from 'react';
import { OrgGeoWorkspace } from './components/OrgGeoWorkspace';
import { GEOGRAPHIC_DIVISIONS_WORKSPACE_CONFIG } from './lib/orgGeoWorkspaceConfig';

export const GeographicDivisionsPage: React.FC = () => (
  <OrgGeoWorkspace config={GEOGRAPHIC_DIVISIONS_WORKSPACE_CONFIG} />
);
