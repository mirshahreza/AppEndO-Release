import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Database, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DataSourceRecord } from '../../shared/api/contracts/data-sources/types';
import { AppButton } from '../../shared/ui';
import {
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  SplitButtonMenuItem,
  useFixedDropDownMenuStyle,
  useSplitButtonMenu,
} from '../../shared/ui/AppSplitButton';
import { overlayMotionDocumentDir, overlayMotionPanelProps } from '../../shared/ui/overlay-motion/overlayMotion';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
} from '../../shared/ui/surfaceClasses';
import { formatSqlConsoleConnectionTitle } from './sqlConsoleTabTypes';

export type SqlConsoleNewTabMenuProps = {
  dataSources: DataSourceRecord[];
  onPick: (dataSourceId: string) => void;
};

export const SqlConsoleNewTabMenu: React.FC<SqlConsoleNewTabMenuProps> = ({
  dataSources,
  onPick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const portalContainRefs = useMemo(() => [panelRef], []);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen, portalContainRefs);
  const menuStyle = useFixedDropDownMenuStyle(isOpen, menuRef, {
    align: 'end',
    minWidth: 220,
  });
  const menuMotion = overlayMotionPanelProps({
    kind: 'popover',
    origin: 'top-end',
    dir: overlayMotionDocumentDir(),
  });

  const menuPanel = isOpen ? (
    <div
      ref={panelRef}
      className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, menuMotion.className, 'min-w-[14rem] py-1')}
      data-overlay-kind={menuMotion['data-overlay-kind']}
      data-overlay-origin={menuMotion['data-overlay-origin']}
      data-overlay-dir={menuMotion['data-overlay-dir']}
      style={menuStyle}
      role="menu"
      aria-label="Choose connection"
    >
      {dataSources.length === 0 ? (
        <SplitButtonMenuItem disabled onClick={() => undefined}>
          No data sources configured
        </SplitButtonMenuItem>
      ) : (
        dataSources.map((source) => (
          <SplitButtonMenuItem
            key={source.id}
            icon={<Database className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
            onClick={() => {
              onPick(source.id);
              setIsOpen(false);
            }}
          >
            <span className="whitespace-nowrap">{formatSqlConsoleConnectionTitle(source)}</span>
          </SplitButtonMenuItem>
        ))
      )}
    </div>
  ) : null;

  return (
    <div ref={menuRef} className="relative mx-1 shrink-0">
      <AppButton
        aria-label="New query"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS)}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" />
      </AppButton>
      {menuPanel && typeof document !== 'undefined'
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
};
