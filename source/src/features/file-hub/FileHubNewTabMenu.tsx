import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Folder, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FileHubConnectionPublic } from '../../shared/api/contracts/file-hub/types';
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
import { formatFileHubSessionTitle } from './fileHubTabTypes';

export type FileHubNewTabMenuProps = {
  connections: FileHubConnectionPublic[];
  onPick: (connection: FileHubConnectionPublic) => void;
};

export const FileHubNewTabMenu: React.FC<FileHubNewTabMenuProps> = ({
  connections,
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
      aria-label="Choose Sftp connection"
    >
      {connections.length === 0 ? (
        <SplitButtonMenuItem disabled onClick={() => undefined}>
          No saved connections
        </SplitButtonMenuItem>
      ) : (
        connections.map((connection) => (
          <SplitButtonMenuItem
            key={connection.id}
            icon={<Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
            onClick={() => {
              onPick(connection);
              setIsOpen(false);
            }}
          >
            <span className="whitespace-nowrap">{formatFileHubSessionTitle(connection)}</span>
          </SplitButtonMenuItem>
        ))
      )}
    </div>
  ) : null;

  return (
    <div ref={menuRef} className="relative mx-1 shrink-0">
      <AppButton
        aria-label="New Sftp session"
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
