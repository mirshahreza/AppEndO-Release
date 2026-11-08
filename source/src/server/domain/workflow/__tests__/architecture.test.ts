import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_SRC_ROOT = path.resolve(__dirname, '../../../../');
const WORKFLOW_DOMAIN_DIR = path.resolve(__dirname, '..');

/** Prisma client accessor names for every Workflow model (matches prisma/schema.prisma model names, camelCased). */
const WORKFLOW_MODEL_ACCESSORS = [
  'workflowDefinition',
  'workflowRevision',
  'workflowInstance',
  'workflowNodeInstance',
  'workflowExecutionAttempt',
  'workflowWait',
  'workflowEventInbox',
  'workItem',
  'workItemTransition',
  'workItemEscalation',
  'workflowTrace',
  'workflowSimulationRun',
  'workflowValidationReport',
  'workflowDesignerView',
  'workflowBranchToken',
  'workflowJoinArrival',
];

function listTsFilesRecursively(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'generated') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFilesRecursively(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Workflow domain layering boundary (doc 11 section 28)', () => {
  it('no file outside src/server/domain/workflow touches a Workflow Prisma model accessor directly', () => {
    const offenders: string[] = [];
    const accessorPattern = new RegExp(`prisma\\(\\)\\.(${WORKFLOW_MODEL_ACCESSORS.join('|')})\\b`);
    for (const file of listTsFilesRecursively(REPO_SRC_ROOT)) {
      if (file.startsWith(WORKFLOW_DOMAIN_DIR)) continue;
      const content = fs.readFileSync(file, 'utf8');
      if (accessorPattern.test(content)) {
        offenders.push(path.relative(REPO_SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
