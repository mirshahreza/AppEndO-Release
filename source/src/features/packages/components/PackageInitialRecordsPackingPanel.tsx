import React from 'react';
import { UiCheckboxChoice, UiRadioGroup } from '../../../shared/ui';
import type { InitialRecordsCaptureTarget } from '../lib/packageBuilderInitialRecords';

type PackageInitialRecordsPackingPanelProps = {
  includeInitialRecords: boolean;
  onIncludeInitialRecordsChange: (value: boolean) => void;
  captureTarget: InitialRecordsCaptureTarget;
  onCaptureTargetChange: (value: InitialRecordsCaptureTarget) => void;
  idPrefix?: string;
};

export const PackageInitialRecordsPackingPanel: React.FC<PackageInitialRecordsPackingPanelProps> = ({
  includeInitialRecords,
  onIncludeInitialRecordsChange,
  captureTarget,
  onCaptureTargetChange,
  idPrefix = 'package',
}) => (
  <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-3 py-2">
    <UiCheckboxChoice
      id={`${idPrefix}-include-initial-records`}
      checked={includeInitialRecords}
      onChange={onIncludeInitialRecordsChange}
    >
      Include initial records in this package
    </UiCheckboxChoice>
    <p className="text-[11px] text-slate-500">
      Required foundation SQL always installs. Initial content rows stay optional for the installer.
    </p>
    {includeInitialRecords ? (
      <UiRadioGroup
        ariaLabel="Seed capture destination"
        orientation="horizontal"
        value={captureTarget}
        onChange={(value) => onCaptureTargetChange(value === 'optional' ? 'optional' : 'required')}
        options={[
          { value: 'required', label: 'Required foundation' },
          { value: 'optional', label: 'Optional initial records' },
        ]}
      />
    ) : null}
  </div>
);
