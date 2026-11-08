import React, { useMemo, useState } from 'react';
import { CheckCircle2, Play, XCircle } from 'lucide-react';
import { AppButton, UiInput, UiSelect } from '../../../shared/ui';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import { useTryEdgeApiDefinitionMutation } from '../../../shared/api/queries/data-api';
import { useRolesListQuery } from '../../../shared/api/queries/roles';
import { useUsersListQuery, type UserRecord } from '../../../shared/api/queries/users';
import type { RoleRecord } from '../../../shared/api/contracts/roles/types';
import { evaluateApiCallFixture, type ApiCallFixture } from '../../../shared/lib/apiCallFixtureMatch';
import { MonacoEditorPanel } from '../../server-functions/components/MonacoEditorPanel';

export type DataApiOperationTestPanelProps = {
  definitionId: string;
  method: string;
  path: string;
};

type ActorMode = 'anonymous' | 'role' | 'user';

const isAdminRoleName = (name: string): boolean => name.trim().toUpperCase() === 'ADMIN';

export const DataApiOperationTestPanel: React.FC<DataApiOperationTestPanelProps> = ({
  definitionId,
  method,
  path,
}) => {
  const rolesQuery = useRolesListQuery();
  const usersQuery = useUsersListQuery({});
  const tryMutation = useTryEdgeApiDefinitionMutation();

  const [actorMode, setActorMode] = useState<ActorMode>('anonymous');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [queryJson, setQueryJson] = useState('{}');
  const [bodyJson, setBodyJson] = useState('{}');
  const [expectedStatus, setExpectedStatus] = useState('');
  const [expectedBodyJson, setExpectedBodyJson] = useState('');
  const [output, setOutput] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roles = (rolesQuery.data as RoleRecord[] | undefined) ?? [];
  const users = (usersQuery.data as { items: UserRecord[] } | undefined)?.items ?? [];
  const selectedUser = users.find((user) => String(user.id) === selectedUserId) ?? null;

  const fixture: ApiCallFixture = useMemo(() => ({
    expectedStatus: expectedStatus.trim() ? Number(expectedStatus) : null,
    expectedBodyJson,
  }), [expectedStatus, expectedBodyJson]);

  const fixtureVerdict = useMemo(() => evaluateApiCallFixture(output, fixture), [output, fixture]);

  const actorSummary = actorMode === 'anonymous'
    ? 'Anonymous (no record policy actor)'
    : actorMode === 'role'
      ? (selectedRole ? `Role: ${selectedRole}` : 'Pick a role')
      : (selectedUser ? `${selectedUser.username} (${selectedUser.roles.join(', ') || 'no roles'})` : 'Pick a user');

  const handleRun = async () => {
    setError(null);
    setOutput(null);

    let parsedQuery: Record<string, unknown> = {};
    let parsedBody: unknown;
    try {
      parsedQuery = queryJson.trim() ? JSON.parse(queryJson) : {};
    } catch {
      setError('Query JSON is invalid.');
      return;
    }
    try {
      parsedBody = bodyJson.trim() ? JSON.parse(bodyJson) : undefined;
    } catch {
      setError('Body JSON is invalid.');
      return;
    }

    const testActorRoles = actorMode === 'role' && selectedRole
      ? [selectedRole]
      : actorMode === 'user' && selectedUser
        ? selectedUser.roles
        : undefined;
    const testActorUserId = actorMode === 'user' && selectedUser ? selectedUser.id : undefined;
    const testActorIsAdmin = actorMode === 'role'
      ? isAdminRoleName(selectedRole)
      : actorMode === 'user'
        ? Boolean(selectedUser?.roles.some(isAdminRoleName))
        : undefined;

    try {
      const { data, response } = await tryMutation.mutateAsync({
        definitionId,
        method,
        path,
        query: parsedQuery,
        body: parsedBody,
        testActorUserId,
        testActorRoles,
        testActorIsAdmin,
      });
      setOutput({ ...data, _httpStatus: response.status });
    } catch (runError) {
      const message = isApiError(runError)
        ? formatApiErrorMessage(runError)
        : (runError instanceof Error ? runError.message : 'Failed to run.');
      setError(message);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Test as
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <UiSelect
            value={actorMode}
            onChange={(event) => setActorMode(event.target.value as ActorMode)}
            size="sm"
            ariaLabel="Test actor mode"
            className="w-40"
          >
            <option value="anonymous">Anonymous</option>
            <option value="role">Role</option>
            <option value="user">User</option>
          </UiSelect>
          {actorMode === 'role' ? (
            <UiSelect
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
              size="sm"
              ariaLabel="Test role"
              className="max-w-xs"
            >
              <option value="">Pick a role…</option>
              {roles.map((role) => (
                <option key={role.name} value={role.name}>{role.name}</option>
              ))}
            </UiSelect>
          ) : null}
          {actorMode === 'user' ? (
            <UiSelect
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              size="sm"
              ariaLabel="Test user"
              className="max-w-xs"
            >
              <option value="">Pick a user…</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.username || user.email || `User #${user.id}`}</option>
              ))}
            </UiSelect>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{actorSummary}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white">
          <span className="block border-b border-slate-200 bg-slate-50/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Query params (JSON)
          </span>
          <div className="h-[110px]">
            <MonacoEditorPanel
              defaultLanguage="json"
              language="json"
              value={queryJson}
              onChange={(value) => setQueryJson(value ?? '')}
              options={{ fontSize: 11, minimap: { enabled: false }, lineNumbers: 'off', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: 'on' }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white">
          <span className="block border-b border-slate-200 bg-slate-50/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Body (JSON)
          </span>
          <div className="h-[110px]">
            <MonacoEditorPanel
              defaultLanguage="json"
              language="json"
              value={bodyJson}
              onChange={(value) => setBodyJson(value ?? '')}
              options={{ fontSize: 11, minimap: { enabled: false }, lineNumbers: 'off', scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: 'on' }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Expected result (fixture)
          {fixtureVerdict.state === 'pass' ? (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 normal-case">
              <CheckCircle2 className="h-3 w-3" /> PASS
            </span>
          ) : fixtureVerdict.state === 'fail' ? (
            <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-600 normal-case">
              <XCircle className="h-3 w-3" /> FAIL
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[120px_minmax(0,1fr)]">
          <div className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Expected status</span>
            <UiInput
              value={expectedStatus}
              onChange={(event) => setExpectedStatus(event.target.value.replace(/[^0-9]/g, ''))}
              size="sm"
              placeholder="e.g. 200"
              ariaLabel="Expected HTTP status"
            />
          </div>
          <div className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Expected body keys (partial match, JSON object)
            </span>
            <UiInput
              value={expectedBodyJson}
              onChange={(event) => setExpectedBodyJson(event.target.value)}
              size="sm"
              placeholder='e.g. {"count":0}'
              ariaLabel="Expected response body keys"
              className="font-mono"
            />
          </div>
        </div>
        {fixtureVerdict.state === 'fail' ? (
          <ul className="mt-2 list-disc space-y-1 ps-4 text-[11px] text-red-700">
            {fixtureVerdict.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <AppButton
          type="button"
          intent="primary"
          size="sm"
          disabled={tryMutation.isPending}
          onClick={() => { void handleRun(); }}
        >
          <Play className="h-3.5 w-3.5" />
          Run test
        </AppButton>
      </div>

      <div className="min-h-[140px] flex-1 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
        {tryMutation.isPending ? (
          <p className="text-[11px] text-slate-500">Running…</p>
        ) : error ? (
          <pre className="whitespace-pre-wrap break-words rounded border border-rose-200 bg-rose-50 p-2 font-mono text-[11px] text-rose-700">
            {error}
          </pre>
        ) : output ? (
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-slate-800">
            {JSON.stringify(output, null, 2)}
          </pre>
        ) : (
          <p className="text-[11px] text-slate-400">Run the operation to see its response here.</p>
        )}
      </div>
    </div>
  );
};
