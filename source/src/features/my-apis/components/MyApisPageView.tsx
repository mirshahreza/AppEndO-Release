import React from 'react';
import { ListPageShell } from '../../../shared/ui';
import type { MyApisPageModel } from '../hooks/useMyApisPage';
import { MyApiTestModal } from './MyApiTestModal';
import { MyApisTableGrid } from './MyApisTableGrid';
import { MyApisToolbar } from './MyApisToolbar';

type MyApisPageViewProps = {
  page: MyApisPageModel;
};

export const MyApisPageView: React.FC<MyApisPageViewProps> = ({ page }) => (
  <ListPageShell onGridScroll={page.handleGridScroll}>
    <MyApisToolbar page={page} />
    <MyApisTableGrid page={page} />
    {page.testRoute ? (
      <MyApiTestModal route={page.testRoute} onClose={page.closeTestModal} />
    ) : null}
  </ListPageShell>
);
