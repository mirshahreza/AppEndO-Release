import React from 'react';
import { cn } from '../../lib/utils';
import { UiCheckboxChoice } from './FormChoiceFields';
import { UiInput } from './HeroFieldControls';

export type FunctionCacheConfigTarget = {
  method: string;
  cacheEnabled?: boolean | null;
  cacheTtlMs?: number | null;
  cacheByParam?: boolean | null;
  cacheByUser?: boolean | null;
};

export type FunctionCacheConfigProps = {
  targetFn: FunctionCacheConfigTarget;
  updateTarget: (updates: Partial<FunctionCacheConfigTarget>) => void;
  disabled?: boolean;
};

export const FunctionCacheConfig: React.FC<FunctionCacheConfigProps> = ({
  targetFn,
  updateTarget,
  disabled = false,
}) => (
  <div className={cn(disabled && 'opacity-60 pointer-events-none')}>
    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 border-b border-slate-100 pb-2">
      Response Caching
    </h3>
    <div className={cn('mb-2', targetFn.method !== 'GET' && 'opacity-50')}>
      <UiCheckboxChoice
        id="cacheEnabled"
        disabled={disabled || targetFn.method !== 'GET'}
        checked={targetFn.method === 'GET' && (targetFn.cacheEnabled || false)}
        onChange={(checked) => updateTarget({
          cacheEnabled: checked,
          ...(checked ? {} : { cacheByParam: false, cacheByUser: false }),
        })}
      >
        Enable Edge Caching for this GET method
      </UiCheckboxChoice>
    </div>
    <div
      className={`flex items-center gap-6 mb-6 ${(!targetFn.cacheEnabled || targetFn.method !== 'GET') ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex items-center">
          <UiInput
            type="number"
            disabled={!targetFn.cacheEnabled || targetFn.method !== 'GET'}
            className="border border-slate-200 rounded px-2 py-1.5 text-xs w-28 outline-none focus:border-slate-400 font-mono disabled:cursor-not-allowed text-slate-800 pr-14"
            value={targetFn.cacheEnabled && targetFn.method === 'GET' ? (targetFn.cacheTtlMs ? targetFn.cacheTtlMs / 1000 : 180) : ''}
            onChange={(e) => updateTarget({ cacheTtlMs: Number(e.target.value) * 1000 })}
            ariaLabel="TTL"
            placeholder="180"
          />
          <span className="absolute right-2 text-[10px] font-bold text-slate-400 uppercase pointer-events-none select-none">
            seconds
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <UiCheckboxChoice
          id="cacheByParam"
          disabled={!targetFn.cacheEnabled || targetFn.method !== 'GET'}
          checked={targetFn.method === 'GET' && !!targetFn.cacheByParam}
          onChange={(checked) => {
            const updates: Partial<FunctionCacheConfigTarget> = { cacheByParam: checked };
            if (!targetFn.cacheTtlMs) updates.cacheTtlMs = 180000;
            updateTarget(updates);
          }}
        >
          By Param
        </UiCheckboxChoice>
        <UiCheckboxChoice
          id="cacheByUser"
          disabled={!targetFn.cacheEnabled || targetFn.method !== 'GET'}
          checked={targetFn.method === 'GET' && !!targetFn.cacheByUser}
          onChange={(checked) => {
            const updates: Partial<FunctionCacheConfigTarget> = { cacheByUser: checked };
            if (!targetFn.cacheTtlMs) updates.cacheTtlMs = 180000;
            updateTarget(updates);
          }}
        >
          By User
        </UiCheckboxChoice>
      </div>
    </div>
  </div>
);
