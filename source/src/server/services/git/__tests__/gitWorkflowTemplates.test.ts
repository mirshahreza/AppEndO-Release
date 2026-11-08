import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyGitWorkflowTemplate, listGitWorkflowTemplates } from '../gitWorkflowTemplates';

vi.mock('../../../../core/ai/tools/native/git/gitRunner', () => ({
  assertGitRepository: vi.fn(),
  validateGitPath: vi.fn(),
}));

import { assertGitRepository, validateGitPath } from '../../../../core/ai/tools/native/git/gitRunner';

const mockedAssertGitRepository = vi.mocked(assertGitRepository);
const mockedValidateGitPath = vi.mocked(validateGitPath);

const tempRoot = path.join(process.cwd(), '.tmp-git-workflow-templates-test');

describe('listGitWorkflowTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.mkdirSync(tempRoot, { recursive: true });
    mockedAssertGitRepository.mockReturnValue({ ok: true, repoRoot: tempRoot });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('returns starter templates with exists=false when target is missing', () => {
    const payload = listGitWorkflowTemplates();

    expect(payload.templates.length).toBeGreaterThan(0);
    expect(payload.templates[0]?.id).toBe('ci-node-test');
    expect(payload.templates[0]?.exists).toBe(false);
  });

  it('marks template exists when target file is present', () => {
    const target = path.join(tempRoot, '.github/workflows/appendo-ci.yml');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'name: old', 'utf8');

    const payload = listGitWorkflowTemplates();
    const template = payload.templates.find((entry) => entry.id === 'ci-node-test');

    expect(template?.exists).toBe(true);
  });
});

describe('applyGitWorkflowTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.mkdirSync(tempRoot, { recursive: true });
    mockedAssertGitRepository.mockReturnValue({ ok: true, repoRoot: tempRoot });
    mockedValidateGitPath.mockImplementation((inputPath: string) => ({
      ok: true,
      relativePath: inputPath,
    }));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('writes workflow YAML to default target path', () => {
    const result = applyGitWorkflowTemplate({ templateId: 'ci-node-test' });

    expect(result.success).toBe(true);
    expect(result.path).toBe('.github/workflows/appendo-ci.yml');
    expect(result.created).toBe(true);

    const absolutePath = path.join(tempRoot, result.path);
    const content = fs.readFileSync(absolutePath, 'utf8');
    expect(content).toContain('name: AppEndO CI');
    expect(content).toContain('npm run test:critical');
  });

  it('rejects overwrite when target exists and overwrite is false', () => {
    const target = path.join(tempRoot, '.github/workflows/appendo-ci.yml');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'name: old', 'utf8');

    expect(() => applyGitWorkflowTemplate({ templateId: 'ci-node-test' })).toThrow(
      'Workflow file already exists',
    );
  });

  it('replaces target when overwrite is true', () => {
    const target = path.join(tempRoot, '.github/workflows/appendo-ci.yml');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'name: old', 'utf8');

    const result = applyGitWorkflowTemplate({
      templateId: 'ci-node-test',
      overwrite: true,
    });

    expect(result.created).toBe(false);
    expect(result.message).toContain('Replaced');

    const content = fs.readFileSync(target, 'utf8');
    expect(content).toContain('name: AppEndO CI');
    expect(content).not.toContain('name: old');
  });
});
