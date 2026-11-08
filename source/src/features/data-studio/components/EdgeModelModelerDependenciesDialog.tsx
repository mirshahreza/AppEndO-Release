import React from 'react';
import type { SchemaObjectDependencyItem } from '../../../shared/api/contracts/data-sources/schemaObjectDependencies';
import { CreateEditModalShell, DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS } from '../../../shared/ui';
import type { DataStudioExplorerObjectKind } from '../types';
import { SchemaObjectDependenciesSection } from './SchemaObjectDependenciesSection';

export type EdgeModelModelerDependenciesDialogProps = {
  open: boolean;
  onClose: () => void;
  dataSourceId: string;
  objectName: string;
  objectKind: DataStudioExplorerObjectKind;
  onOpenObject: (item: SchemaObjectDependencyItem) => void;
  resolveObjectHref: (item: SchemaObjectDependencyItem) => string;
};

export const EdgeModelModelerDependenciesDialog: React.FC<EdgeModelModelerDependenciesDialogProps> = ({
  open,
  onClose,
  dataSourceId,
  objectName,
  objectKind,
  onOpenObject,
  resolveObjectHref,
}) => {
  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="maximized"
      title={(
        <span className="inline-flex min-w-0 items-center gap-2">
          <span>Dependencies</span>
          <span className={DIALOG_PRIMARY_HEADER_SEPARATOR_CLASS} aria-hidden />
          <span className="truncate font-mono font-semibold text-indigo-600">{objectName}</span>
        </span>
      )}
      onClose={onClose}
      onBackdropClick={onClose}
      shellClassName="flex min-h-0 flex-col overflow-hidden"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0 !p-0"
    >
      <SchemaObjectDependenciesSection
        chrome="none"
        layout="columns"
        dataSourceId={dataSourceId}
        objectName={objectName}
        objectKind={objectKind}
        resolveObjectHref={resolveObjectHref}
        onOpenObject={(item) => {
          onClose();
          onOpenObject(item);
        }}
      />
    </CreateEditModalShell>
  );
};
