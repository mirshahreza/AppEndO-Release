import React, { useEffect, useState } from 'react';
import { AppButton, UiInput } from '../../../shared/ui';
import { delegationRulesApi, type WorkItemDelegationRule } from '../api/delegationRulesApi';

/** HWF-2.4 — self-service Out-of-Office. Applies only to NEW Work Item assignments while the rule's window is active (per user decision 2026-08-30) — already-open items are not swept; use Forward (self) or Reassign (ADMIN) for those. */
export const OutOfOfficePanel: React.FC = () => {
  const [rules, setRules] = useState<WorkItemDelegationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delegateUserId, setDelegateUserId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const result = await delegationRulesApi.list();
      setRules(result.rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Out-of-Office rules.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!delegateUserId || !startAt || !endAt) return;
    setBusy(true);
    setError(null);
    try {
      await delegationRulesApi.create(Number(delegateUserId), new Date(startAt).toISOString(), new Date(endAt).toISOString());
      setDelegateUserId('');
      setStartAt('');
      setEndAt('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Out-of-Office rule.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    try {
      await delegationRulesApi.remove(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <p className="text-xs text-slate-500">
        While active, any NEW Work Item that would be assigned directly to you goes to the delegate instead. Items already open before the window starts are not moved automatically.
      </p>

      {error ? <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          Delegate user id
          <UiInput size="sm" aiAssist={false} type="number" value={delegateUserId} onChange={(e) => setDelegateUserId(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          From
          <UiInput size="sm" aiAssist={false} type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
          Until
          <UiInput size="sm" aiAssist={false} type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </label>
      </div>
      <AppButton size="sm" intent="primary" disabled={busy || !delegateUserId || !startAt || !endAt} onClick={() => void create()}>
        Add rule
      </AppButton>

      <div className="flex flex-col gap-1.5">
        {isLoading ? (
          <span className="text-xs text-slate-400">Loading…</span>
        ) : rules.length === 0 ? (
          <span className="text-xs text-slate-400">No Out-of-Office rules configured.</span>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1.5 text-xs">
              <span>Delegate to user #{rule.delegateUserId} — {rule.startAt.slice(0, 10)} → {rule.endAt.slice(0, 10)}</span>
              <button type="button" onClick={() => void remove(rule.id)} className="text-slate-400 hover:text-rose-600">Remove</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
