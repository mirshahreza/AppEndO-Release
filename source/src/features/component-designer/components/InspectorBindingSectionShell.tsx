import * as React from 'react';
import { Plus } from 'lucide-react';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { resolveInspectorSectionHelp } from '../lib/designerInspectorHelp';
import { InspectorFieldHelpLink } from './InspectorFieldHelpLink';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
  INSPECTOR_TONE_TO_SURFACE_TONE,
} from './inspectorDesignTokens';

export type InspectorBindingSectionShellProps = {
  title: string;
  count: number;
  description?: string;
  addLabel?: string;
  onAdd: () => void;
  defaultOpen?: boolean;
  helpSectionId?: string;
  children: React.ReactNode;
};

export const InspectorBindingSectionShell: React.FC<InspectorBindingSectionShellProps> = ({
  title,
  count,
  description,
  addLabel = 'Add',
  onAdd,
  defaultOpen = true,
  helpSectionId,
  children,
}) => {
  const sectionHelp = helpSectionId ? resolveInspectorSectionHelp(helpSectionId) : null;

  return (
    <AppSurfaceBox
      layout="panel"
      tone={INSPECTOR_TONE_TO_SURFACE_TONE.neutral}
      collapsible
      defaultOpen={defaultOpen}
      title={(
        <span className="inline-flex min-w-0 items-center gap-1">
          <span className="truncate">{title}</span>
          <span className="inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-slate-200/90 px-1.5 text-[9px] font-bold tabular-nums normal-case tracking-normal text-slate-600">
            {count}
          </span>
          {sectionHelp ? <InspectorFieldHelpLink help={sectionHelp} /> : null}
        </span>
      )}
      headerExtra={(
        <div className="flex justify-end">
          <AppButton
            type="button"
            intent="secondary"
            size="sm"
            className={`h-5 shrink-0 px-1.5 ${INSPECTOR_TEXT_2XS}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAdd();
            }}
          >
            <Plus className="mr-0.5 h-3 w-3" strokeWidth={2} />
            {addLabel}
          </AppButton>
        </div>
      )}
    >
      {description ? (
        <p className={`mb-2 ps-[4px] ${INSPECTOR_TEXT_XS} leading-relaxed text-slate-500`}>{description}</p>
      ) : null}
      {children}
    </AppSurfaceBox>
  );
};

export const InspectorBindingEmptyState: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center">
    <p className={`${INSPECTOR_TEXT_SM} font-medium text-slate-600`}>{title}</p>
    <p className={`mt-1 ${INSPECTOR_TEXT_XS} leading-relaxed text-slate-500`}>{description}</p>
  </div>
);
