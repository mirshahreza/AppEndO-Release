// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AgentCapabilityDropdown } from '../AgentCapabilityDropdown';
import { AGENT_CAPABILITY_UI_PACKS, DEFAULT_AGENT_CAPABILITY_SCOPE } from '../../../shared/api/contracts/ai/capabilityPacks';

describe('AgentCapabilityDropdown — M2g MQ-7 UI', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not open capability menu when disabled (Plan/Ask modes)', () => {
    render(
      <AgentCapabilityDropdown
        scope={DEFAULT_AGENT_CAPABILITY_SCOPE}
        onChange={vi.fn()}
        allowedPacks={AGENT_CAPABILITY_UI_PACKS}
        enabledMcpServers={[]}
        disabled
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /agent capabilities/i }));
    expect(screen.queryByRole('listbox', { name: /agent capabilities/i })).not.toBeInTheDocument();
  });

  it('opens capability menu in Agent mode (enabled)', () => {
    render(
      <AgentCapabilityDropdown
        scope={DEFAULT_AGENT_CAPABILITY_SCOPE}
        onChange={vi.fn()}
        allowedPacks={AGENT_CAPABILITY_UI_PACKS}
        enabledMcpServers={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /agent capabilities/i }));
    expect(screen.getByRole('listbox', { name: /agent capabilities/i })).toBeInTheDocument();
    expect(screen.getByText(/built-in packs/i)).toBeInTheDocument();
  });

  it('renders only allowed packs from MCP access grants (p-18)', () => {
    const allowedPacks = AGENT_CAPABILITY_UI_PACKS.filter((pack) => pack.id !== 'appendo-git');

    render(
      <AgentCapabilityDropdown
        scope={{ packIds: ['appendo-files'], mcpServerIds: [] }}
        onChange={vi.fn()}
        allowedPacks={allowedPacks}
        enabledMcpServers={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /agent capabilities/i }));
    expect(screen.queryByText('Git')).not.toBeInTheDocument();
    expect(screen.getByText('Files / Workspace')).toBeInTheDocument();
  });
});
