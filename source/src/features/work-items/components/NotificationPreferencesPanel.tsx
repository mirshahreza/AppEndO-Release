import React, { useEffect, useState } from 'react';
import { UiCheckbox, UiSelect } from '../../../shared/ui';
import { notificationPreferencesApi, type UserNotificationPreference } from '../api/notificationPreferencesApi';

const EVENT_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'workflow.escalation', label: 'Work Item escalation alerts' },
  { value: 'workflow.comment', label: 'Mentioned in a comment' },
];

const DEFAULT_ROW = { channel: 'IN_APP' as const, digest: false };

/**
 * HWF-4.2 — self-service notification channel preference, one row per event type the workflow
 * engine can notify a user about (`workflow.escalation`, `workflow.comment`) — the two that are
 * directly relevant to a Work Item user, same reasoning `OutOfOfficePanel.tsx` (HWF-2.4) used to
 * scope its own self-service surface to the Inbox rather than a separate settings page. Leaving an
 * event type at "In-app (default)" with digest off means no preference row is written at all — the
 * untouched default, per the same opt-in-only pattern every other HWF-2.x/4.x decision used.
 */
export const NotificationPreferencesPanel: React.FC = () => {
  const [preferences, setPreferences] = useState<UserNotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyEventType, setBusyEventType] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const result = await notificationPreferencesApi.list();
      setPreferences(result.preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notification preferences.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const rowFor = (eventType: string) => preferences.find((p) => p.eventType === eventType) ?? DEFAULT_ROW;

  const setChannel = async (eventType: string, channel: 'IN_APP' | 'EMAIL') => {
    setBusyEventType(eventType);
    setError(null);
    try {
      if (channel === 'IN_APP') {
        await notificationPreferencesApi.remove(eventType);
      } else {
        await notificationPreferencesApi.upsert(eventType, channel, rowFor(eventType).digest);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification preference.');
    } finally {
      setBusyEventType(null);
    }
  };

  const setDigest = async (eventType: string, digest: boolean) => {
    setBusyEventType(eventType);
    setError(null);
    try {
      await notificationPreferencesApi.upsert(eventType, 'EMAIL', digest);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification preference.');
    } finally {
      setBusyEventType(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <p className="text-xs text-slate-500">
        Choose how you want to hear about each kind of Work Item notification. Leaving one on &quot;In-app&quot; changes nothing — that&apos;s the existing default.
      </p>

      {error ? <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700">{error}</div> : null}

      {isLoading ? (
        <span className="text-xs text-slate-400">Loading…</span>
      ) : (
        <div className="flex flex-col gap-2">
          {EVENT_TYPES.map(({ value, label }) => {
            const row = rowFor(value);
            const busy = busyEventType === value;
            return (
              <div key={value} className="flex flex-col gap-1.5 rounded border border-slate-200 p-2">
                <span className="text-xs font-semibold text-slate-700">{label}</span>
                <div className="flex items-center gap-3">
                  <UiSelect size="sm" className="w-40 text-xs" disabled={busy} value={row.channel} onChange={(e) => void setChannel(value, e.target.value as 'IN_APP' | 'EMAIL')}>
                    <option value="IN_APP">In-app (default)</option>
                    <option value="EMAIL">Email</option>
                  </UiSelect>
                  {row.channel === 'EMAIL' ? (
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <UiCheckbox size="sm" disabled={busy} checked={row.digest} onChange={(e) => void setDigest(value, e.target.checked)} />
                      Daily digest (one email/day) instead of immediate
                    </label>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
