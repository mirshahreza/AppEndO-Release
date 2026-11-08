import React from 'react';
import { MY_WORKBOOKS_PAGE_KEY } from './hooks/useWorkbooksShellHeader';
import { MY_WORKBOOKS_LIST_SEGMENT } from './workbookRoute';
import { WorkbooksWorkspace } from './components/WorkbooksWorkspace';

export const MyWorkbooksPage: React.FC = () => (
  <WorkbooksWorkspace
    listSegment={MY_WORKBOOKS_LIST_SEGMENT}
    pageKey={MY_WORKBOOKS_PAGE_KEY}
    allowSharing
  />
);
