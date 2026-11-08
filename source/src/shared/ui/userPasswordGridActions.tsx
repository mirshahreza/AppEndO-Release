import React from 'react';
import { RotateCcwKey, UserLock } from 'lucide-react';

/**
 * Canonical Lucide icons for Users grid password actions.
 * Cross-pack rationale: Tabler `IconPassword` / Phosphor `Password` for manual credential set;
 * Lucide `UserLock` is the closest product-grid match. Tabler `IconRotate` + key / Lucide
 * `RotateCcwKey` for admin credential reset — not generic `RotateCcw` (retry/refresh).
 */
export const ChangePasswordActionIconComponent = UserLock;
export const ResetPasswordActionIconComponent = RotateCcwKey;

export type UserPasswordActionIconProps = {
  className?: string;
};

export const ChangePasswordActionIcon: React.FC<UserPasswordActionIconProps> = ({
  className = 'h-3.5 w-3.5',
}) => <UserLock className={className} aria-hidden="true" />;

export const ResetPasswordActionIcon: React.FC<UserPasswordActionIconProps> = ({
  className = 'h-3.5 w-3.5',
}) => <RotateCcwKey className={className} aria-hidden="true" />;
