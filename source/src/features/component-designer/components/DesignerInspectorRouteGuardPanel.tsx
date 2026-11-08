import * as React from 'react';
import type { DesignerAction, DesignerDocument } from '../../../domain/component-designer/types';
import {
  isDesignerSimulatedRoleAllowed,
  resolveDesignerDocumentPageAccess,
} from '../../../domain/component-designer/designerPageAccess';
import { formatAccessControlLabel } from '../../../shared/api/contracts/server-functions/accessControl';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import { useRolesListQuery } from '../../../shared/api/queries/roles';
import {
  ACCESS_CONTROL_ACTION_ARIA_LABEL,
  AccessControlActionIcon,
  AccessControlModal,
  AppButton,
  UiSelect,
} from '../../../shared/ui';
import { GRID_ACTION_ACCESS_CLASS } from '../../../shared/ui/surfaceClasses';
import { DesignerFieldRow } from './DesignerFieldRow';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

export type DesignerInspectorRouteGuardPanelProps = {
  document: DesignerDocument;
  dispatch: React.Dispatch<DesignerAction>;
};

/**
 * CD-E04 / CD-J01 — Page-level access via standard AccessControlModal.
 */
export const DesignerInspectorRouteGuardPanel: React.FC<DesignerInspectorRouteGuardPanelProps> = ({
  document,
  dispatch,
}) => {
  const [accessModalOpen, setAccessModalOpen] = React.useState(false);
  const [draftAccess, setDraftAccess] = React.useState<FunctionAccessControl>(() => (
    resolveDesignerDocumentPageAccess(document)
  ));

  React.useEffect(() => {
    if (!accessModalOpen) {
      setDraftAccess(resolveDesignerDocumentPageAccess(document));
    }
  }, [accessModalOpen, document]);

  const pageAccess = resolveDesignerDocumentPageAccess(document);
  const accessLabel = formatAccessControlLabel(pageAccess);

  return (
    <div className="space-y-2">
      <DesignerFieldRow label="Access">
        <div className="flex items-center gap-1.5">
          <div className={`min-w-0 flex-1 truncate rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white px-2 py-1.5 ${INSPECTOR_TEXT_SM} text-slate-700`}>
            {accessLabel}
          </div>
          <AppButton
            size="icon-sm"
            intent="utility"
            className={GRID_ACTION_ACCESS_CLASS}
            aria-label={ACCESS_CONTROL_ACTION_ARIA_LABEL}
            title={ACCESS_CONTROL_ACTION_ARIA_LABEL}
            onClick={() => setAccessModalOpen(true)}
          >
            <AccessControlActionIcon />
          </AppButton>
        </div>
      </DesignerFieldRow>

      <AccessControlModal
        open={accessModalOpen}
        titlePath={document.name || 'Page'}
        accessControl={draftAccess}
        onChange={setDraftAccess}
        onClose={() => setAccessModalOpen(false)}
        onSave={() => {
          dispatch({ type: 'set-document-page-access', pageAccess: draftAccess });
          setAccessModalOpen(false);
        }}
      />
    </div>
  );
};

/**
 * CD-J02 — compact toolbar control for preview role simulation.
 */
export type DesignerPreviewRoleToolbarControlProps = {
  simulatedRole: string;
  onChangeSimulatedRole: (role: string) => void;
};

export const DesignerPreviewRoleToolbarControl: React.FC<DesignerPreviewRoleToolbarControlProps> = ({
  simulatedRole,
  onChangeSimulatedRole,
}) => {
  const rolesQuery = useRolesListQuery();
  const allRoles = rolesQuery.data ?? [];

  if (allRoles.length === 0) {
    return null;
  }

  return (
    <UiSelect
      size="sm"
      className={`h-8 min-w-[132px] max-w-[180px] ${INSPECTOR_TEXT_SM}`}
      aria-label="View preview as role"
      title="View as role"
      value={simulatedRole}
      onChange={(event) => onChangeSimulatedRole(event.target.value)}
    >
      <option value="">View as…</option>
      {allRoles.map((role) => (
        <option key={role.id} value={role.name}>
          {role.name}
        </option>
      ))}
    </UiSelect>
  );
};

/** Returns true when preview should simulate a 403 for the selected role. */
export function isDesignerRolePreviewBlocked(
  document: Pick<DesignerDocument, 'pageAccess' | 'allowedRoles'> | string[] | undefined,
  simulatedRole: string,
): boolean {
  const role = simulatedRole.trim();
  if (role.length === 0) {
    return false;
  }

  const accessDocument: Pick<DesignerDocument, 'pageAccess' | 'allowedRoles'> = Array.isArray(document)
    ? { allowedRoles: document }
    : (document ?? {});

  return !isDesignerSimulatedRoleAllowed(accessDocument, role);
}

export type DesignerPreviewRoleSimulatorProps = {
  document: Pick<DesignerDocument, 'pageAccess' | 'allowedRoles'>;
  /** @deprecated — pass document instead */
  allowedRoles?: string[];
  simulatedRole: string;
  onChangeSimulatedRole: (role: string) => void;
};

/**
 * CD-J02 — Preview role simulation select.
 */
export const DesignerPreviewRoleSimulator: React.FC<DesignerPreviewRoleSimulatorProps> = ({
  document,
  allowedRoles,
  simulatedRole,
  onChangeSimulatedRole,
}) => {
  const rolesQuery = useRolesListQuery();
  const allRoles = rolesQuery.data ?? [];
  const accessDocument = document ?? { allowedRoles: allowedRoles ?? [] };

  if (allRoles.length === 0) return null;

  const isBlocked = isDesignerRolePreviewBlocked(accessDocument, simulatedRole);

  return (
    <DesignerFieldRow label="Simulate as">
      <div className="flex flex-col gap-1">
        <UiSelect
          size="sm"
          aria-label="Simulate preview role"
          value={simulatedRole}
          onChange={(event) => onChangeSimulatedRole(event.target.value)}
        >
          <option value="">— no role simulation —</option>
          {allRoles.map((role) => (
            <option key={role.id} value={role.name}>
              {role.name}
            </option>
          ))}
        </UiSelect>
        {isBlocked && (
          <p className={`rounded-sm bg-rose-50 px-1.5 py-1 ${INSPECTOR_TEXT_2XS} font-medium text-rose-700 ring-1 ring-rose-200`}>
            Role <strong>{simulatedRole}</strong> cannot access this page — preview would show 403.
          </p>
        )}
        {simulatedRole !== '' && !isBlocked && (
          <p className={`rounded-sm bg-emerald-50 px-1.5 py-1 ${INSPECTOR_TEXT_2XS} font-medium text-emerald-700 ring-1 ring-emerald-200`}>
            Role <strong>{simulatedRole}</strong> has access.
          </p>
        )}
      </div>
    </DesignerFieldRow>
  );
};
