// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BUTTON_INTENT_CLASS } from '../../../shared/ui/buttonSemantics';
import type { ServerFunctionItem } from '../types';
import { TestConsolePanel, type TestConsolePanelProps } from '../components/TestConsolePanel';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value?: string }) => (
    <textarea data-testid="mock-monaco" readOnly value={value || ''} />
  ),
}));

const activeFn: ServerFunctionItem = {
  id: 'custom.probe',
  name: 'probe',
  folder: 'custom',
  method: 'POST',
  path: '/api/custom/probe',
  code: 'export default async function handler() { return { ok: true }; }',
  testPayload: '{}',
  memoryLimit: 128,
  timeoutMs: 5000,
  runtimeVersion: 'v20.x',
  useGlobalConfig: true,
  enableLogs: true,
  accessControl: {
    allowRoles: [],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  },
};

const splitHandle = { title: 'resize' };

const renderConsole = (overrides: Partial<TestConsolePanelProps> = {}) => {
  const handleRun = vi.fn();
  render(
    <TestConsolePanel
      isLargeScreen
      payloadWidth={360}
      payloadHeight={220}
      column3Ref={{ current: null }}
      activeFn={activeFn}
      testPayloadValue="{}"
      onTestPayloadChange={vi.fn()}
      isRunning={false}
      output={null}
      logs={[]}
      handleRun={handleRun}
      payloadHeightSplitHandleProps={splitHandle}
      {...overrides}
    />,
  );
  return { handleRun };
};

describe('TestConsolePanel Execute', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders Execute as an enabled primary button when the function has source', () => {
    const { handleRun } = renderConsole();
    const execute = screen.getByRole('button', { name: 'Execute' });
    expect(execute).toBeEnabled();
    expect(execute.className).toContain(BUTTON_INTENT_CLASS.primary);
    expect(execute.className).toContain('normal-case');
    expect(execute.className).not.toMatch(/\buppercase\b/);
    expect(screen.queryByText('Advanced Run Options')).not.toBeInTheDocument();
    expect(screen.queryByText('Expected Result (Fixture)')).not.toBeInTheDocument();
    expect(screen.queryByText('Derived Request Guide')).not.toBeInTheDocument();
    fireEvent.click(execute);
    expect(handleRun).toHaveBeenCalledTimes(1);
  });

  it('disables Execute only when source is empty', () => {
    renderConsole({ activeFn: { ...activeFn, code: '   ' } });
    expect(screen.getByRole('button', { name: 'Execute' })).toBeDisabled();
  });

  it('does not render the VM sandbox trace panel', () => {
    renderConsole({
      output: { success: false, error: 'Missing SerpAPI key', _httpStatus: 400 },
      logs: [
        { id: '1', time: '11:10:08', type: 'warn', msg: 'Execution failed: Missing SerpAPI key' },
        { id: '2', time: '11:10:07', type: 'info', msg: 'Compiling probe.ts and preparing VM thread allocation (VM: v20.x, RAM: 128MB, Timeout: 5000ms)...' },
      ],
    });

    expect(screen.queryByText(/VM Sandbox Thread Engine Trace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Data API Executor Trace/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /FLUSH/i })).not.toBeInTheDocument();
    expect(screen.getByText('Active Live Output')).toBeInTheDocument();
    expect(screen.getByText(/Status 400 — Missing SerpAPI key/)).toBeInTheDocument();
    expect(screen.queryByText('Execution failed: Missing SerpAPI key')).not.toBeInTheDocument();
    expect(screen.getByText(/Compiling probe\.ts/)).toBeInTheDocument();
  });
});
