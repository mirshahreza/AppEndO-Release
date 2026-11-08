import React, { useMemo } from 'react';
import type { DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import {
  HEROUI_FIELD_RADIUS_CLASS,
  resolveHeroUiFieldSelectTriggerClass,
  resolveHeroUiFieldSelectValueClass,
} from '../../../shared/ui/heroFieldChrome';
import type { HeroUiFieldSize } from '../../../shared/ui/heroFieldSize';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { UiSelectMenu, type UiSelectMenuOption } from '../../../shared/ui/UiSelectMenu';
import { DataSourceTypeIcon } from './DataSourceTypeIcon';

function formatConnectionLabel(source: DataSourceRecord): string {
  return `${source.name}${source.isDefault ? ' (default)' : ''}`;
}

type ConnectionOptionContentProps = {
  source: DataSourceRecord;
};

const ConnectionOptionContent: React.FC<ConnectionOptionContentProps> = ({ source }) => (
  <span className="flex min-w-0 items-center gap-2">
    <DataSourceTypeIcon type={source.type} className="h-3.5 w-3.5 shrink-0" />
    <span className="truncate">{formatConnectionLabel(source)}</span>
  </span>
);

export type DataSourceConnectionSelectProps = {
  dataSources: DataSourceRecord[];
  value: string;
  onChange: (dataSourceId: string) => void;
  disabled?: boolean;
  className?: string;
  size?: HeroUiFieldSize;
  ariaLabel?: string;
};

export const DataSourceConnectionSelect: React.FC<DataSourceConnectionSelectProps> = ({
  dataSources,
  value,
  onChange,
  disabled = false,
  className,
  size = 'sm',
  ariaLabel = 'Data source connection',
}) => {
  const valueClassName = resolveHeroUiFieldSelectValueClass(size);
  const triggerClassName = resolveHeroUiFieldSelectTriggerClass({
    size,
    className,
  });

  const selectedKey = value.trim() === '' ? undefined : value.trim();

  const options: UiSelectMenuOption[] = useMemo(
    () => dataSources.map((source) => ({
      id: source.id,
      textValue: formatConnectionLabel(source),
      content: <ConnectionOptionContent source={source} />,
    })),
    [dataSources],
  );

  return (
    <div
      className="w-full min-w-0"
      {...pageGuideLocalProps(
        PAGE_GUIDE_EN['pageGuide.page.connection.title'],
        PAGE_GUIDE_EN['pageGuide.page.connection.hint'],
        16,
      )}
    >
    <UiSelectMenu
      ariaLabel={ariaLabel}
      selectedKey={selectedKey}
      isDisabled={disabled}
      size={size}
      className="w-full"
      triggerClassName={triggerClassName}
      popoverClassName={HEROUI_FIELD_RADIUS_CLASS}
      listBoxClassName={HEROUI_FIELD_RADIUS_CLASS}
      onSelectionChange={onChange}
      options={options}
      placeholder="Select connection"
      renderValue={(selected) => (
        <span className={valueClassName}>
          {selected ? selected.content : 'Select connection'}
        </span>
      )}
    />
    </div>
  );
};
