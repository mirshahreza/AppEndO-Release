import React, { useState } from 'react';
import {
  Eye,
  FunctionSquare,
  Plus,
  Table2,
  TableProperties,
  Workflow,
} from 'lucide-react';
import {
  AppSplitButton,
  SplitButtonMenuItem,
} from '../../../shared/ui';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import {
  DATA_STUDIO_EXPLORER_OBJECT_KIND_OPTIONS,
  DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS,
} from '../lib/explorerObjectKinds';
import { canCreateSchemaObjectKind } from '../lib/schemaObjectSqlTemplates';
import type { DataStudioExplorerObjectKind } from '../types';

const CREATE_OBJECT_KIND_ICONS: Record<DataStudioExplorerObjectKind, React.ReactNode> = {
  TABLE: <Table2 className="h-3.5 w-3.5 shrink-0" />,
  VIEW: <Eye className="h-3.5 w-3.5 shrink-0" />,
  STORED_PROCEDURE: <Workflow className="h-3.5 w-3.5 shrink-0" />,
  SCALAR_FUNCTION: <FunctionSquare className="h-3.5 w-3.5 shrink-0" />,
  TABLE_VALUED_FUNCTION: <TableProperties className="h-3.5 w-3.5 shrink-0" />,
};

type CreateObjectToolbarButtonProps = {
  disabled?: boolean;
  dataSourceType?: string | null;
  onPickKind: (objectKind: DataStudioExplorerObjectKind) => void;
};

export const CreateObjectToolbarButton: React.FC<CreateObjectToolbarButtonProps> = ({
  disabled = false,
  dataSourceType = null,
  onPickKind,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handlePickKind = (objectKind: DataStudioExplorerObjectKind) => {
    onPickKind(objectKind);
    setIsMenuOpen(false);
  };

  return (
    <span
      className="inline-flex"
      {...pageGuideLocalProps(
        PAGE_GUIDE_EN['pageGuide.page.create.title'],
        'Pick a table, view, procedure, or function to add on this connection.',
        16,
      )}
    >
    <AppSplitButton
      intent="secondary"
      size="sm"
      disabled={disabled}
      icon={<Plus className="h-3.5 w-3.5" />}
      label="Create object"
      isOpen={isMenuOpen}
      onOpenChange={setIsMenuOpen}
      triggerAriaLabel="Create schema object"
      menuAriaLabel="Create schema object types"
      menuClassName="min-w-[12.5rem]"
    >
      {DATA_STUDIO_EXPLORER_OBJECT_KIND_OPTIONS.map((option) => (
        <SplitButtonMenuItem
          key={option.value}
          icon={CREATE_OBJECT_KIND_ICONS[option.value]}
          disabled={Boolean(dataSourceType) && !canCreateSchemaObjectKind(dataSourceType, option.value)}
          onClick={() => handlePickKind(option.value)}
        >
          {DATA_STUDIO_EXPLORER_OBJECT_KIND_SINGULAR_LABELS[option.value]}
        </SplitButtonMenuItem>
      ))}
    </AppSplitButton>
    </span>
  );
};
