import React from 'react';
import { Check } from 'lucide-react';
import type { AccessAssistantSurfaceContext } from '../../../shared/api/contracts/access-assistant/types';
import {
  ACCESS_ASSISTANT_PICKER_LIST_CLASS,
  ACCESS_ASSISTANT_SECTION_TITLE_CLASS,
  ACCESS_ASSISTANT_SURFACE_GRID_CLASS,
  resolveAccessAssistantHttpMethodBadgeClass,
  resolveAccessAssistantPickerRowClass,
} from '../lib/accessAssistantWizardChrome';

export type AccessAssistantAccessStepProps = {
  surfaces: readonly AccessAssistantSurfaceContext[];
  allowedMap: Record<string, boolean>;
  onToggleAllowed: (functionId: string, allowed: boolean) => void;
  disabled?: boolean;
};

const resolveFunctionTitle = (name: string, blurb: string) => {
  const trimmedBlurb = blurb.trim();
  if (trimmedBlurb && trimmedBlurb !== name.trim()) {
    return trimmedBlurb;
  }
  return name;
};

const resolveFunctionSubtitle = (name: string, blurb: string) => {
  const trimmedBlurb = blurb.trim();
  if (trimmedBlurb && trimmedBlurb !== name.trim()) {
    return name;
  }
  return null;
};

export const AccessAssistantAccessStep: React.FC<AccessAssistantAccessStepProps> = ({
  surfaces,
  allowedMap,
  onToggleAllowed,
  disabled = false,
}) => (
  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-1">
    <div className={ACCESS_ASSISTANT_SURFACE_GRID_CLASS}>
      {surfaces.map((surface) => (
        <section key={surface.surfaceId} className="flex min-w-0 flex-col gap-2">
          <h3 className={ACCESS_ASSISTANT_SECTION_TITLE_CLASS}>{surface.title}</h3>
          <ul className={ACCESS_ASSISTANT_PICKER_LIST_CLASS} aria-label={surface.title}>
            {surface.functions.map((fn) => {
              const allowed = Boolean(allowedMap[fn.id]);
              const rowDisabled = disabled || !fn.editable;
              const title = resolveFunctionTitle(fn.name, fn.blurb);
              const subtitle = resolveFunctionSubtitle(fn.name, fn.blurb);
              return (
                <li key={fn.id}>
                  <button
                    type="button"
                    disabled={rowDisabled}
                    aria-pressed={allowed}
                    aria-label={`${title} — ${allowed ? 'allowed' : 'not allowed'}`}
                    onClick={() => {
                      if (rowDisabled) {
                        return;
                      }
                      onToggleAllowed(fn.id, !allowed);
                    }}
                    className={resolveAccessAssistantPickerRowClass(allowed, rowDisabled)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800">{title}</span>
                      {subtitle ? (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{subtitle}</span>
                      ) : null}
                      <span className="mt-1.5 flex min-w-0 items-center gap-2">
                        <span className={resolveAccessAssistantHttpMethodBadgeClass(fn.method)}>
                          {fn.method.toUpperCase()}
                        </span>
                        <span className="min-w-0 truncate font-mono text-[10px] text-slate-400">
                          {fn.path}
                        </span>
                      </span>
                    </span>
                    {allowed ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                    ) : (
                      <span className="mt-0.5 w-4 shrink-0" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  </div>
);
