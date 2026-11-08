import React from 'react';
import { Slot } from '../../components/core/Slot';
import { PageLoadProfilePageKeyBridge } from '../../features/access-assistant/components/PageLoadProfilePageKeyBridge';
import { StudioToolsMenu } from '../../features/access-assistant/components/StudioToolsMenu';
import { useStudioToolsGate } from '../../features/access-assistant/hooks/useStudioToolsGate';
import { cn } from '../../lib/utils';
import { useHeaderActionSlotActive } from './useHeaderActionSlotActive';

const SHELL_HEADER_CONTEXT_ACTIONS_CLASS =
  'ms-5 flex h-8 shrink-0 self-center items-center gap-4 border-s border-border-divider ps-5';

const SHELL_HEADER_CONTEXT_DIVIDER_CLASS =
  'h-4 w-px shrink-0 self-center rounded-full bg-border-divider';

export type ShellHeaderPageActionsProps = {
  pageKey?: string | null;
  pageTitle: string;
};

export const ShellHeaderPageActions: React.FC<ShellHeaderPageActionsProps> = ({
  pageKey,
  pageTitle,
}) => {
  const studioToolsGate = useStudioToolsGate();
  const slotActive = useHeaderActionSlotActive();

  const showRegion = studioToolsGate || slotActive;

  if (!showRegion) {
    return (
      <div
        id="header-action-slot"
        className={cn(
          SHELL_HEADER_CONTEXT_ACTIONS_CLASS,
          'hidden data-[active=true]:lg:flex',
        )}
      >
        <Slot name="core.header.actions" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        SHELL_HEADER_CONTEXT_ACTIONS_CLASS,
        'hidden lg:flex',
      )}
    >
      {studioToolsGate ? <PageLoadProfilePageKeyBridge pageKey={pageKey ?? null} /> : null}
      <div
        id="header-action-slot"
        className={cn(
          'flex items-center gap-2',
          !slotActive && 'hidden',
        )}
      >
        <Slot name="core.header.actions" />
      </div>
      {studioToolsGate ? (
        <>
          {slotActive ? (
            <div className={SHELL_HEADER_CONTEXT_DIVIDER_CLASS} aria-hidden="true" />
          ) : null}
          <StudioToolsMenu
            pageKey={pageKey}
            pageTitle={pageTitle}
            variant="header"
          />
        </>
      ) : null}
    </div>
  );
};
