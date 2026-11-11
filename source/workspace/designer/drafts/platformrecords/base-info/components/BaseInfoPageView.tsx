import React from 'react';
import type { BaseInfoPageModel } from '../hooks/useBaseInfoPage';
import { BaseInfoDeleteModal } from './BaseInfoDeleteModal';
import { BaseInfoFooter } from './BaseInfoFooter';
import { BaseInfoFormModal } from './BaseInfoFormModal';
import { BaseInfoTableGrid } from './BaseInfoTableGrid';
import { BaseInfoToolbar } from './BaseInfoToolbar';

type BaseInfoPageViewProps = {
  page: BaseInfoPageModel;
};

export const BaseInfoPageView: React.FC<BaseInfoPageViewProps> = ({ page }) => (
  <div className="w-full h-full flex flex-col bg-white font-sans">
    <BaseInfoToolbar page={page} />
    <BaseInfoTableGrid page={page} />
    <BaseInfoFooter page={page} />
    <BaseInfoFormModal page={page} />
    <BaseInfoDeleteModal page={page} />
  </div>
);
