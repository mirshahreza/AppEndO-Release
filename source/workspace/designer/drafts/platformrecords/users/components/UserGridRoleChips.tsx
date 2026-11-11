import React from 'react';
import { cn } from '@/src/lib/utils';
import { ActionTooltip } from '@/src/shared/ui/ActionTooltip';
import { NativeButton } from '@/src/shared/ui/NativeButton';
import {
  formatUserGridExtraRoleLabel,
  formatUserGridRoleLabel,
  getUserGridRoleChipClass,
  partitionUserGridRoles,
} from '../utils';

type UserGridRoleChipsProps = {
  roles: string[];
  disabled: boolean;
  onOpenEditRoles: () => void;
};

export const UserGridRoleChips = ({
  roles,
  disabled,
  onOpenEditRoles,
}: UserGridRoleChipsProps) => {
  const { baseRoles, extraRoles } = partitionUserGridRoles(roles);

  return (
    <div className="flex flex-col gap-1">
      {baseRoles.length > 0 ? (
        <div className="flex items-center">
          {baseRoles.map((role, index) => (
            <ActionTooltip key={role} content={role}>
              <NativeButton
                type="button"
                onClick={onOpenEditRoles}
                disabled={disabled}
                className={cn(
                  'relative inline-flex h-5 w-5 items-center justify-center rounded-full p-0 text-[9px] font-bold leading-none ring-2 ring-white disabled:cursor-default',
                  index > 0 && '-ms-1',
                  getUserGridRoleChipClass(role),
                  disabled ? '' : 'hover:opacity-85',
                )}
                style={{ zIndex: index + 1 }}
                aria-label={role}
              >
                {formatUserGridRoleLabel(role)}
              </NativeButton>
            </ActionTooltip>
          ))}
        </div>
      ) : null}

      {extraRoles.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {extraRoles.map((role) => {
            const label = formatUserGridExtraRoleLabel(role);
            const chip = (
              <NativeButton
                type="button"
                onClick={onOpenEditRoles}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center justify-center rounded-full font-bold disabled:cursor-default',
                  label ? 'px-2 py-0.5 text-[10px]' : 'h-5 min-w-5 px-1',
                  getUserGridRoleChipClass(role),
                  disabled ? '' : 'hover:opacity-85',
                )}
                aria-label={role}
              >
                {label}
              </NativeButton>
            );

            return label ? (
              <React.Fragment key={role}>{chip}</React.Fragment>
            ) : (
              <ActionTooltip key={role} content={role}>
                {chip}
              </ActionTooltip>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
