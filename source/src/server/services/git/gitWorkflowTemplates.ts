import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertGitRepository, validateGitPath } from '../../../core/ai/tools/native/git/gitRunner';
import { HttpError } from '../../errors/HttpError';
import type {
  GitWorkflowFilePayload,
  GitWorkflowTemplateApplyRequest,
  GitWorkflowTemplateApplyResult,
  GitWorkflowTemplateSummary,
  GitWorkflowTemplatesPayload,
  GitMutationResult,
} from '../../../shared/api/contracts/git/types';
import {
  getGitWorkflowTemplateById,
  GIT_WORKFLOW_TEMPLATES,
} from './workflowTemplates/index';

const resolveWorkflowTemplatesDir = (): string => {
  const bundledDir = path.join(process.cwd(), 'src/server/services/git/workflowTemplates');
  if (fs.existsSync(path.join(bundledDir, 'ci-node-test.yml'))) {
    return bundledDir;
  }

  try {
    const moduleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'workflowTemplates');
    if (fs.existsSync(path.join(moduleDir, 'ci-node-test.yml'))) {
      return moduleDir;
    }
  } catch {
    // import.meta unavailable in bundled CJS output
  }

  return bundledDir;
};

const templatesDir = resolveWorkflowTemplatesDir();

const resolveDefaultWorkflowPath = (explicitPath?: string): string => {
  if (explicitPath?.trim()) {
    return explicitPath.trim();
  }

  const template = GIT_WORKFLOW_TEMPLATES[0];
  return template?.defaultTargetPath ?? '.github/workflows/ci.yml';
};

const resolveTargetPath = (templateId: string, explicitPath?: string): string => {
  const template = getGitWorkflowTemplateById(templateId);
  if (!template) {
    throw new HttpError(400, `Unknown workflow template: ${templateId}`);
  }

  if (explicitPath?.trim()) {
    return explicitPath.trim();
  }

  return template.defaultTargetPath;
};

const readTemplateContent = (templateId: string): string => {
  const template = getGitWorkflowTemplateById(templateId);
  if (!template) {
    throw new HttpError(400, `Unknown workflow template: ${templateId}`);
  }

  const absoluteTemplatePath = path.join(templatesDir, template.fileName);
  if (!fs.existsSync(absoluteTemplatePath)) {
    throw new HttpError(500, `Workflow template file is missing: ${template.fileName}`);
  }

  return fs.readFileSync(absoluteTemplatePath, 'utf8');
};

const targetExistsInRepo = (repoRoot: string, relativePath: string): boolean => (
  fs.existsSync(path.join(repoRoot, relativePath))
);

export const listGitWorkflowTemplates = (): GitWorkflowTemplatesPayload => {
  const repoCheck = assertGitRepository();
  const repoRoot = repoCheck.ok ? repoCheck.repoRoot : null;

  const templates: GitWorkflowTemplateSummary[] = GIT_WORKFLOW_TEMPLATES.map((template) => {
    const exists = repoRoot
      ? targetExistsInRepo(repoRoot, template.defaultTargetPath)
      : false;

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      defaultTargetPath: template.defaultTargetPath,
      exists,
    };
  });

  return { templates };
};

export const applyGitWorkflowTemplate = (
  input: GitWorkflowTemplateApplyRequest,
): GitWorkflowTemplateApplyResult => {
  const templateId = input.templateId?.trim();
  if (!templateId) {
    throw new HttpError(400, 'templateId is required.');
  }

  const repoCheck = assertGitRepository();
  if (repoCheck.ok === false) {
    throw new HttpError(400, repoCheck.error);
  }

  const relativePath = resolveTargetPath(templateId, input.targetPath);
  const pathResult = validateGitPath(relativePath);
  if (pathResult.ok === false) {
    throw new HttpError(400, pathResult.error);
  }

  const absolutePath = path.join(repoCheck.repoRoot, pathResult.relativePath);
  const created = !fs.existsSync(absolutePath);

  if (!created && input.overwrite !== true) {
    throw new HttpError(
      409,
      `Workflow file already exists at ${pathResult.relativePath}. Set overwrite to true to replace it.`,
    );
  }

  const content = readTemplateContent(templateId);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');

  return {
    success: true,
    message: created
      ? `Applied workflow template to ${pathResult.relativePath}.`
      : `Replaced ${pathResult.relativePath} with workflow template.`,
    path: pathResult.relativePath,
    templateId,
    created,
  };
};

export const readGitWorkflowFile = (explicitPath?: string): GitWorkflowFilePayload => {
  const repoCheck = assertGitRepository();
  if (repoCheck.ok === false) {
    throw new HttpError(400, repoCheck.error);
  }

  const relativePath = resolveDefaultWorkflowPath(explicitPath);
  const pathResult = validateGitPath(relativePath);
  if (pathResult.ok === false) {
    throw new HttpError(400, pathResult.error);
  }

  const absolutePath = path.join(repoCheck.repoRoot, pathResult.relativePath);
  if (fs.existsSync(absolutePath)) {
    return {
      path: pathResult.relativePath,
      content: fs.readFileSync(absolutePath, 'utf8'),
      exists: true,
    };
  }

  const defaultTemplate = GIT_WORKFLOW_TEMPLATES[0];
  const content = defaultTemplate
    ? readTemplateContent(defaultTemplate.id)
    : '';

  return {
    path: pathResult.relativePath,
    content,
    exists: false,
  };
};

export const saveGitWorkflowFile = (relativePath: string, content: string): GitMutationResult => {
  const repoCheck = assertGitRepository();
  if (repoCheck.ok === false) {
    throw new HttpError(400, repoCheck.error);
  }

  const trimmedPath = relativePath.trim();
  if (!trimmedPath) {
    throw new HttpError(400, 'path is required.');
  }

  const pathResult = validateGitPath(trimmedPath);
  if (pathResult.ok === false) {
    throw new HttpError(400, pathResult.error);
  }

  const absolutePath = path.join(repoCheck.repoRoot, pathResult.relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');

  return {
    success: true,
    message: `Saved workflow file to ${pathResult.relativePath}.`,
  };
};
