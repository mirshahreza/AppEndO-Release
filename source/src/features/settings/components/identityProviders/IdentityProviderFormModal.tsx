import React from 'react';
import { Plug, Save, X } from 'lucide-react';
import type { IdentityProviderConfig } from '../../../../shared/api/contracts/auth/identityProviders';
import { cn } from '../../../../lib/utils';
import { AppButton, CreateEditModalShell, FeatureToggleField } from '../../../../shared/ui';
import { UiInput } from '../../../../shared/ui/HeroFieldControls';
import {
  SETTINGS_CONTROL_CLASS,
  SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS,
  SETTINGS_FORM_GROUP_BODY_STACK_CLASS,
  SettingsDisabledFieldset,
  SettingsField,
  SettingsFormGroup,
} from '../form/SettingsFormPrimitives';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  form: IdentityProviderConfig;
  formError: string;
  isSaving: boolean;
  isTesting?: boolean;
  onClose: () => void;
  onChange: (next: IdentityProviderConfig) => void;
  onSave: () => void;
  onTest?: () => void;
};

export const IdentityProviderFormModal: React.FC<Props> = ({
  open,
  mode,
  form,
  formError,
  isSaving,
  isTesting = false,
  onClose,
  onChange,
  onSave,
  onTest,
}) => {
  if (!open) return null;

  const fieldsDisabled = !form.enabled;
  const showIssuerUrl = form.kind === 'microsoft-oauth' || form.kind === 'oidc-generic';
  const issuerHint = form.kind === 'microsoft-oauth'
    ? 'Example: https://login.microsoftonline.com/common/v2.0 (or organizations / your-tenant-id)'
    : 'Issuer URL from your IdP (e.g. https://your-org.okta.com/oauth2/default or Keycloak realm URL)';
  const redirectHint = form.id.trim()
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://your-host'}/api/auth/oauth/${form.id.trim()}/callback`
    : 'Set provider credentials, then register this callback URL in the OAuth app.';

  const update = <K extends keyof IdentityProviderConfig>(key: K, value: IdentityProviderConfig[K]) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <CreateEditModalShell
      size="2xl"
      title={`Configure ${form.label || 'Identity Provider'}`}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <div className="flex items-center justify-between gap-2">
          {mode === 'edit' && onTest ? (
            <AppButton intent="utility" onClick={onTest} disabled={isSaving || isTesting || fieldsDisabled}>
              <Plug className="h-3.5 w-3.5" />
              {isTesting ? 'Testing…' : 'Test connection'}
            </AppButton>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </AppButton>
            <AppButton intent="primary" onClick={onSave} disabled={isSaving}>
              <Save className="h-3.5 w-3.5" />
              Save
            </AppButton>
          </div>
        </div>
      )}
    >
      <div className={SETTINGS_FORM_GROUP_BODY_STACK_CLASS}>
        {formError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</div>
        ) : null}

        <div className="-mx-[15px] -mt-[15px] flex flex-col">
          <section className="border-b border-slate-200 bg-slate-50/80 px-[15px] py-3">
            <FeatureToggleField
              id="identity-provider-enabled"
              checked={form.enabled}
              onChange={(checked) => update('enabled', checked)}
              title="Enabled"
              description="When enabled, this provider appears on the login page and accepts OAuth sign-in. When disabled, saved credentials are kept but the provider is hidden and sign-in is blocked."
            />
          </section>

          <section className={cn('border-b border-slate-200 bg-slate-50/80 px-[15px] py-3', fieldsDisabled && 'opacity-60')}>
            <FeatureToggleField
              id="identity-provider-auto-provision"
              checked={form.autoProvision}
              disabled={fieldsDisabled}
              onChange={(checked) => update('autoProvision', checked)}
              title="Auto-provision new users"
              description="When on, a first-time sign-in with this provider creates a platform user (using Default Role ID below) and links the external identity. When off, only users who already have a linked account can sign in; new external identities are rejected with a no-account error."
            />
          </section>
        </div>

        <SettingsFormGroup
          title="OAuth credentials"
          sectionId="identity-providers"
          divided
          titleInfo="Client credentials and callback URL registered with the identity provider."
        >
          <SettingsDisabledFieldset disabled={fieldsDisabled}>
            <div className={SETTINGS_FORM_TWO_COL_GRID_GAP_CLASS}>
              <SettingsField label="Label">
                <UiInput size="sm" className={SETTINGS_CONTROL_CLASS} value={form.label} onChange={(event) => update('label', event.target.value)} />
              </SettingsField>
              <SettingsField
                label="Default Role ID"
                labelInfo="Role assigned when auto-provisioning new users from this provider."
              >
                <UiInput
                  size="sm"
                  className={SETTINGS_CONTROL_CLASS}
                  value={form.defaultRoleId ?? ''}
                  onChange={(event) => update('defaultRoleId', event.target.value)}
                />
              </SettingsField>
              <SettingsField label="Client ID">
                <UiInput size="sm" className={SETTINGS_CONTROL_CLASS} value={form.clientId ?? ''} onChange={(event) => update('clientId', event.target.value)} />
              </SettingsField>
              <SettingsField
                label="Client Secret"
                labelInfo={mode === 'edit' ? 'Leave blank to keep the stored secret.' : undefined}
              >
                <UiInput
                  size="sm"
                  className={SETTINGS_CONTROL_CLASS}
                  type="password"
                  value={form.clientSecret ?? ''}
                  placeholder={mode === 'edit' ? 'Leave blank to keep existing secret' : ''}
                  onChange={(event) => update('clientSecret', event.target.value)}
                />
              </SettingsField>
            </div>

            <SettingsField label="Redirect URI" hint={redirectHint} labelBand={false}>
              <UiInput
                size="sm"
                className={SETTINGS_CONTROL_CLASS}
                value={form.redirectUri ?? ''}
                onChange={(event) => update('redirectUri', event.target.value)}
              />
            </SettingsField>

            {showIssuerUrl ? (
              <SettingsField label="Issuer URL" hint={issuerHint} labelBand={false}>
                <UiInput
                  size="sm"
                  className={SETTINGS_CONTROL_CLASS}
                  value={form.issuerUrl ?? ''}
                  onChange={(event) => update('issuerUrl', event.target.value)}
                />
              </SettingsField>
            ) : null}
          </SettingsDisabledFieldset>
        </SettingsFormGroup>
      </div>
    </CreateEditModalShell>
  );
};
