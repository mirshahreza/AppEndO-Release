import React from 'react';
import { FormSection } from '../../../shared/ui';
import type { PackageDependencyWarning } from '../lib/collectPackageDependencyWarnings';

type PackageBuilderDependencyWarningsProps = {
  warnings: PackageDependencyWarning[];
};

export const PackageBuilderDependencyWarnings: React.FC<PackageBuilderDependencyWarningsProps> = ({
  warnings,
}) => {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <FormSection title="Unresolved" ink="contrast" className="shrink-0">
      <ul className="space-y-1 ps-[4px]">
        {warnings.map((warning) => (
          <li key={`${warning.code}:${warning.message}`} className="text-xs font-medium text-rose-700">
            {warning.message}
          </li>
        ))}
      </ul>
    </FormSection>
  );
};
