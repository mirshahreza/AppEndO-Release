import React from 'react';
import {
  withPortalBrandDefaults,
  type PortalBrand,
} from '../../../shared/api/contracts/platform/portalBrand';
import { FormField, FormSection, UiImageField, UiInput, UiTextarea } from '../../../shared/ui';

const CONTROL_CLASS = 'min-w-0 w-full !h-8 !min-h-8';

export function emptyPortalBrand(): PortalBrand {
  return withPortalBrandDefaults(null);
}

export function mergePortalBrand(
  current: PortalBrand | null | undefined,
  patch: Partial<PortalBrand>,
): PortalBrand {
  return {
    ...emptyPortalBrand(),
    ...current,
    ...patch,
  };
}

export function normalizePortalBrandForSave(
  brand: PortalBrand | null | undefined,
  isRedirect: boolean,
): PortalBrand | null {
  if (isRedirect) {
    return null;
  }

  const next = mergePortalBrand(brand, {
    logoUrl: brand?.logoUrl ?? null,
    title: brand?.title?.trim() || null,
    windowTitle: brand?.windowTitle?.trim() || null,
    aboutTitle: brand?.aboutTitle?.trim() || null,
    aboutBody: brand?.aboutBody?.trim() || null,
  });

  if (!next.logoUrl && !next.title && !next.windowTitle && !next.aboutTitle && !next.aboutBody) {
    return null;
  }

  return next;
}

type PortalBrandFieldsProps = {
  brand: PortalBrand | null | undefined;
  disabled: boolean;
  divided?: boolean;
  labels: {
    section: string;
    helper: string;
    logo: string;
    logoAria: string;
    logoEmpty: string;
    logoHint: string;
    title: string;
    titleAria: string;
    titlePlaceholder: string;
    titleHint: string;
    windowTitle: string;
    windowTitleAria: string;
    windowTitlePlaceholder: string;
    windowTitleHint: string;
    aboutTitle: string;
    aboutTitleAria: string;
    aboutTitlePlaceholder: string;
    aboutTitleHint: string;
    aboutBody: string;
    aboutBodyAria: string;
    aboutBodyPlaceholder: string;
    aboutBodyHint: string;
  };
  onBrandChange: (brand: PortalBrand) => void;
  onLogoFile: (file: File | null) => void;
};

export const PortalBrandFields: React.FC<PortalBrandFieldsProps> = ({
  brand,
  disabled,
  divided = true,
  labels,
  onBrandChange,
  onLogoFile,
}) => (
  <FormSection
    title={labels.section}
    hint={labels.helper}
    ink="complement"
    divided={divided}
    className={disabled ? 'opacity-60' : undefined}
  >
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <FormField label={labels.logo} hint={labels.logoHint} className="sm:w-[7.5rem] sm:shrink-0">
        <UiImageField
          size={80}
          previewSrc={brand?.logoUrl}
          ariaLabel={labels.logoAria}
          emptyHint={labels.logoEmpty}
          disabled={disabled}
          enableAiPanel={false}
          showFileName={false}
          onChange={(file) => {
            if (!file) {
              onLogoFile(null);
              onBrandChange(mergePortalBrand(brand, { logoUrl: null }));
              return;
            }
            onLogoFile(file);
          }}
        />
      </FormField>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <FormField label={labels.title} hint={labels.titleHint}>
          <UiInput
            size="sm"
            className={CONTROL_CLASS}
            value={brand?.title ?? ''}
            onChange={(event) => onBrandChange(mergePortalBrand(brand, { title: event.target.value }))}
            ariaLabel={labels.titleAria}
            placeholder={labels.titlePlaceholder}
            disabled={disabled}
            autoDir
          />
        </FormField>
        <FormField label={labels.windowTitle} hint={labels.windowTitleHint}>
          <UiInput
            size="sm"
            className={CONTROL_CLASS}
            value={brand?.windowTitle ?? ''}
            onChange={(event) => onBrandChange(mergePortalBrand(brand, { windowTitle: event.target.value }))}
            ariaLabel={labels.windowTitleAria}
            placeholder={labels.windowTitlePlaceholder}
            disabled={disabled}
            autoDir
          />
        </FormField>
        <FormField label={labels.aboutTitle} hint={labels.aboutTitleHint}>
          <UiInput
            size="sm"
            className={CONTROL_CLASS}
            value={brand?.aboutTitle ?? ''}
            onChange={(event) => onBrandChange(mergePortalBrand(brand, { aboutTitle: event.target.value }))}
            ariaLabel={labels.aboutTitleAria}
            placeholder={labels.aboutTitlePlaceholder}
            disabled={disabled}
            autoDir
          />
        </FormField>
      </div>
    </div>

    <FormField label={labels.aboutBody} hint={labels.aboutBodyHint}>
      <UiTextarea
        size="sm"
        rows={6}
        aiAssist={false}
        value={brand?.aboutBody ?? ''}
        onChange={(event) => onBrandChange(mergePortalBrand(brand, { aboutBody: event.target.value }))}
        ariaLabel={labels.aboutBodyAria}
        placeholder={labels.aboutBodyPlaceholder}
        disabled={disabled}
        autoDir
      />
    </FormField>
  </FormSection>
);
