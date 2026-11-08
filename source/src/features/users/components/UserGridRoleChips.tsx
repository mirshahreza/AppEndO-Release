import React from 'react';
import { cn } from '../../../lib/utils';
import { NativeButton } from '../../../shared/ui/NativeButton';
import { UiTooltip } from '../../../shared/ui/UiTooltip';
import { abbreviateRoleLabel, getRoleChipClass, sortRolesForDisplay } from '../utils';

const ROLE_CHIP_CLASS =
  'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white px-1 text-[9px] font-bold uppercase leading-none';

type UserGridRoleChipsProps = {
  roles: ReadonlyArray<string>;
  disabled?: boolean;
  onClick?: () => void;
};

export const UserGridRoleChips: React.FC<UserGridRoleChipsProps> = ({
  roles,
  disabled = false,
  onClick,
}) => {
  const sortedRoles = sortRolesForDisplay(roles);

  if (sortedRoles.length === 0) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <div className="flex items-center">
      {sortedRoles.map((role, index) => (
        <UiTooltip
          key={role}
          className={cn('inline-flex', index > 0 && '-ms-2')}
          style={{ zIndex: index + 1 }}
          contentClassName="z-[9999] px-2 py-1 text-xs"
          content={role}
        >
          <NativeButton
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              ROLE_CHIP_CLASS,
              getRoleChipClass(role),
              disabled ? 'cursor-default' : 'hover:opacity-85',
            )}
            aria-label={role}
          >
            {abbreviateRoleLabel(role)}
          </NativeButton>
        </UiTooltip>
      ))}
    </div>
  );
};
