import React from 'react';
import { ADMIN_SHELL_HEADER_TITLE_ROW_CLASS } from '../../shared/ui/surfaceClasses';
import {
  resolveShellHeaderCompactTitle,
  type ShellHeaderTitleProps,
} from './ShellHeaderTitle';

export type ShellHeaderCompactTitleRowProps = Pick<
  ShellHeaderTitleProps,
  'groupLabel' | 'pageLabel' | 'titleTrail' | 'fallbackLabel'
>;

/** Second header band: centered title when the first row is too narrow. */
export const ShellHeaderCompactTitleRow: React.FC<ShellHeaderCompactTitleRowProps> = (props) => {
  const title = resolveShellHeaderCompactTitle(props);
  return (
    <div className={ADMIN_SHELL_HEADER_TITLE_ROW_CLASS} data-testid="admin-shell-header-title-row">
      <h1
        className="w-full truncate text-center text-[15px] font-bold leading-tight tracking-tight text-slate-800"
        title={title}
      >
        {title}
      </h1>
    </div>
  );
};
