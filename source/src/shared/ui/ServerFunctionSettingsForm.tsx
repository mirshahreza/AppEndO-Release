import React from 'react';
import { useCultureT } from '../../core/culture/CultureContext';
import { getActiveSourceLanguage } from '../api/contracts/server-functions/templates';
import type {
  ServerFunctionItem,
  ServerFunctionMetadataJson,
} from '../api/contracts/server-functions/types';
import { changeReasonFolderOwnerKeyForFunction } from '../api/queries/changeReasonFolder';
import {
  readPortalSegmentFromMetadata,
  upsertPortalTagInMetadata,
} from '../lib/serverFunctionPortalTags';
import {
  ChangeReasonPolicyFields,
  changeReasonPolicyFromMeta,
  serializeFunctionChangeReasonPolicy,
} from './ChangeReasonPolicyFields';
import { FunctionCacheConfig } from './FunctionCacheConfig';
import { FormSection } from './FormSection';
import { UiCheckboxChoice } from './FormChoiceFields';
import { UiInput, UiSelect } from './HeroFieldControls';
import {
  functionChangeReasonFallback,
  hasAssignedReasonFolder,
  namedApiAllowsChangeReasonSettings,
} from '../api/contracts/record-events';

export type ServerFunctionSettingsFieldsTarget = Pick<
  ServerFunctionItem,
  | 'method'
  | 'language'
  | 'runtimeVersion'
  | 'memoryLimit'
  | 'timeoutMs'
  | 'useGlobalConfig'
  | 'enableLogs'
  | 'cacheEnabled'
  | 'cacheTtlMs'
  | 'cacheByParam'
  | 'cacheByUser'
  | 'metadataJson'
  | 'isBuiltIn'
> & {
  id?: string;
  path?: string;
};

export type ServerFunctionSettingsFormProps = {
  targetFn: ServerFunctionSettingsFieldsTarget;
  updateTarget: (updates: Partial<ServerFunctionSettingsFieldsTarget>) => void;
  globalDefaultVMMode: 'v18.x' | 'v20.x';
  globalDefaultRAM: number;
  globalDefaultTimeout: number;
  isBuiltInTarget: boolean;
  isPackageTarget: boolean;
  packageSourceLabel?: string | null;
  canToggleBuiltIn: boolean;
  isBuiltInChecked: boolean;
};

const SECTION_HEADING_CLASS =
  'text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-100 pb-2';

export const ServerFunctionSettingsForm: React.FC<ServerFunctionSettingsFormProps> = ({
  targetFn,
  updateTarget,
  globalDefaultVMMode,
  globalDefaultRAM,
  globalDefaultTimeout,
  isBuiltInTarget,
  isPackageTarget,
  packageSourceLabel,
  canToggleBuiltIn,
  isBuiltInChecked,
}) => {
  const t = useCultureT();
  const folderOwnerKey = targetFn.id
    ? changeReasonFolderOwnerKeyForFunction(targetFn.id)
    : 'function:draft';
  const folderTitle = `${targetFn.method} ${targetFn.path ?? ''}`.trim();
  const showChangeReason = namedApiAllowsChangeReasonSettings(
    targetFn.method,
    targetFn.path ?? '',
  );
  const storedPolicy = changeReasonPolicyFromMeta(targetFn.metadataJson?.changeReason);
  const fallbackFolder = functionChangeReasonFallback(targetFn.method, targetFn.path ?? '')?.reasonVocabNodeId;
  const changeReasonValue = {
    ...storedPolicy,
    reasonVocabNodeId: hasAssignedReasonFolder(storedPolicy.reasonVocabNodeId)
      ? storedPolicy.reasonVocabNodeId
      : (fallbackFolder ?? ''),
  };

  return (
    <>
      <div>
        <h3 className={SECTION_HEADING_CLASS}>{t('serverFunctions.functionType')}</h3>
        {isPackageTarget ? (
          <p className="text-xs font-semibold text-slate-700">
            {t('serverFunctions.packageApiFrom').replace('{label}', packageSourceLabel ?? '')}
          </p>
        ) : (
          <UiCheckboxChoice
            id="is-built-in"
            checked={isBuiltInChecked}
            onChange={(checked) => { if (canToggleBuiltIn) updateTarget({ isBuiltIn: checked }); }}
            disabled={!canToggleBuiltIn}
          >
            {t('serverFunctions.builtinRoute')}
          </UiCheckboxChoice>
        )}
      </div>

      <div>
        <h3 className={SECTION_HEADING_CLASS}>{t('serverFunctions.vmConfig.title')}</h3>
        {isBuiltInTarget ? (
          <p className="mb-3 text-[11px] text-slate-500">
            {t('serverFunctions.builtinVmHint')}
          </p>
        ) : null}
        <div className="space-y-4">
          <UiCheckboxChoice
            id="inherit-global"
            checked={targetFn.useGlobalConfig}
            onChange={(checked) => updateTarget({ useGlobalConfig: checked })}
          >
            {t('serverFunctions.inheritGlobalDefaults')}
          </UiCheckboxChoice>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="space-y-[2px]">
              <label className="text-[10px] text-slate-500 font-mono">{t('serverFunctions.sourceLanguage')}</label>
              <UiSelect
                value={getActiveSourceLanguage(targetFn.language)}
                onChange={(e) => updateTarget({ language: e.target.value === 'js' ? 'js' : 'ts' })}
                className="w-full text-[11px] h-8 px-2 border border-slate-200 rounded-lg cursor-pointer bg-white font-semibold text-slate-800 outline-none"
              >
                <option value="ts">{t('serverFunctions.sourceTypeScript')}</option>
                <option value="js">{t('serverFunctions.sourceJavaScript')}</option>
              </UiSelect>
            </div>

            <div className="space-y-[2px]">
              <label className="text-[10px] text-slate-500 font-mono">{t('serverFunctions.vmMode')}</label>
              <UiSelect
                value={targetFn.useGlobalConfig ? globalDefaultVMMode : targetFn.runtimeVersion}
                onChange={(e) => updateTarget({ runtimeVersion: e.target.value === 'v18.x' ? 'v18.x' : 'v20.x' })}
                disabled={targetFn.useGlobalConfig}
                className="w-full text-[11px] h-8 px-2 border border-slate-200 rounded-lg cursor-pointer bg-white font-semibold text-slate-800 outline-none disabled:opacity-30 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="v20.x">{t('settings.forms.serverFunctions.vmMode.v20')}</option>
                <option value="v18.x">{t('settings.forms.serverFunctions.vmMode.v18')}</option>
              </UiSelect>
            </div>

            <div className="space-y-[2px]">
              <label className="text-[10px] text-slate-500 font-mono">{t('serverFunctions.ramAlloc')}</label>
              <UiSelect
                value={targetFn.useGlobalConfig ? globalDefaultRAM : targetFn.memoryLimit}
                onChange={(e) => updateTarget({ memoryLimit: Number(e.target.value) })}
                disabled={targetFn.useGlobalConfig}
                className="w-full text-[11px] h-8 px-2 border border-slate-200 rounded-lg cursor-pointer bg-white font-semibold text-slate-800 outline-none disabled:opacity-30 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value={64}>{t('settings.forms.serverFunctions.ram.64')}</option>
                <option value={128}>{t('settings.forms.serverFunctions.ram.128')}</option>
                <option value={256}>{t('settings.forms.serverFunctions.ram.256')}</option>
              </UiSelect>
            </div>

            <div className="space-y-[2px]">
              <label className="text-[10px] text-slate-500 font-mono">{t('serverFunctions.timeout')}</label>
              <UiSelect
                value={targetFn.useGlobalConfig ? globalDefaultTimeout : targetFn.timeoutMs}
                onChange={(e) => updateTarget({ timeoutMs: Number(e.target.value) })}
                disabled={targetFn.useGlobalConfig}
                className="w-full text-[11px] h-8 px-2 border border-slate-200 rounded-lg cursor-pointer bg-white font-semibold text-slate-800 outline-none disabled:opacity-30 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value={1000}>{t('settings.forms.serverFunctions.timeout.1000')}</option>
                <option value={1500}>{t('settings.forms.serverFunctions.timeout.1500')}</option>
                <option value={3000}>{t('settings.forms.serverFunctions.timeout.3000')}</option>
                <option value={5000}>{t('settings.forms.serverFunctions.timeout.5000')}</option>
              </UiSelect>
            </div>
          </div>
        </div>
      </div>

      <h3 className={SECTION_HEADING_CLASS}>{t('serverFunctions.observability')}</h3>
      <UiCheckboxChoice
        id="enableLogs"
        checked={targetFn.enableLogs}
        onChange={(checked) => updateTarget({ enableLogs: checked })}
        className="mb-6"
      >
        {t('serverFunctions.enableLogs')}
      </UiCheckboxChoice>

      <FunctionCacheConfig
        targetFn={targetFn}
        updateTarget={(updates) => {
          const { method: _method, ...rest } = updates;
          updateTarget(rest);
        }}
      />

      <div>
        <h3 className={SECTION_HEADING_CLASS}>{t('serverFunctions.portalExportTag')}</h3>
        <p className="mb-2 text-[11px] text-slate-500">
          {t('serverFunctions.portalExportHint')}
        </p>
        <UiInput
          size="sm"
          autoDir={false}
          value={readPortalSegmentFromMetadata(targetFn.metadataJson as ServerFunctionMetadataJson | null)}
          onChange={(event) => {
            const metadataJson = upsertPortalTagInMetadata(
              targetFn.metadataJson as ServerFunctionMetadataJson | null,
              event.target.value,
            );
            updateTarget({ metadataJson });
          }}
          placeholder="ops"
          ariaLabel={t('serverFunctions.portalSegmentAria')}
          className="max-w-xs"
        />
      </div>

      {showChangeReason ? (
      <FormSection
        title="Change reason"
        ink="contrast"
        divided
        hint="Ask for a reason on update, patch, and delete. Not on GET, list, or create. Ask without Track stores nothing."
      >
        <div className="grid w-full min-w-0 grid-cols-2 gap-3">
          <ChangeReasonPolicyFields
            value={changeReasonValue}
            folderOwnerKey={folderOwnerKey}
            folderTitle={folderTitle}
            disabled={isPackageTarget}
            onChange={(patch) => {
              const next = {
                ...changeReasonValue,
                ...patch,
              };
              updateTarget({
                metadataJson: {
                  ...(targetFn.metadataJson ?? {}),
                  changeReason: serializeFunctionChangeReasonPolicy(next),
                },
              });
            }}
          />
        </div>
      </FormSection>
      ) : null}
    </>
  );
};
