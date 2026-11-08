import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'vitest';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import type { AiCapabilityPackId } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import {
  AGENT_PACK_TOOL_GROUPS,
  createAgentPackRegistry,
  listRegistryToolNames,
  registerPacks,
  type AgentPackRegistry,
} from '../agentPackRuntime';

export {
  AGENT_PACK_TOOL_GROUPS,
  createAgentPackRegistry,
  listRegistryToolNames,
  registerPacks,
  type AgentPackRegistry,
};

export const expectPackToolsRegistered = (registry: AgentPackRegistry, packId: AiCapabilityPackId) => {
  const names = listRegistryToolNames(registry);
  getAiCapabilityPack(packId).toolNames.forEach((toolName) => {
    expect(names).toContain(toolName);
  });
};

export type PackTestWorkspace = {
  root: string;
  originalCwd: string;
  dispose: () => void;
};

export type PackTestWorkspaceOptions = {
  withGit?: boolean;
  withSecretFile?: boolean;
  sampleFilePath?: string;
};

export const createPackTestWorkspace = (options: PackTestWorkspaceOptions = {}): PackTestWorkspace => {
  const {
    withGit = false,
    withSecretFile = true,
    sampleFilePath = 'src/shared/ui/AppTableGrid.tsx',
  } = options;
  const originalCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-pack-harness-'));
  process.chdir(root);

  fs.mkdirSync(path.dirname(path.join(root, sampleFilePath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, sampleFilePath),
    'export const AppTableGrid = () => null;\n',
  );

  if (withSecretFile) {
    fs.writeFileSync(path.join(root, '.env'), 'SECRET=1\n');
  }

  if (withGit) {
    const runGit = (args: string[]) => {
      execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    };
    runGit(['init']);
    runGit(['config', 'user.email', 'test@appendo.local']);
    runGit(['config', 'user.name', 'AppEndO Test']);
    runGit(['add', sampleFilePath]);
    runGit(['commit', '-m', 'Initial commit']);
  }

  return {
    root,
    originalCwd,
    dispose: () => {
      process.chdir(originalCwd);
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
};
