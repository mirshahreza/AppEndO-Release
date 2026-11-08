export type GitWorkflowTemplateDefinition = {
  id: string;
  name: string;
  description: string;
  fileName: string;
  defaultTargetPath: string;
};

export const GIT_WORKFLOW_TEMPLATES: GitWorkflowTemplateDefinition[] = [
  {
    id: 'ci-node-test',
    name: 'Node.js CI',
    description: 'Run lint and test:critical on push and pull requests.',
    fileName: 'ci-node-test.yml',
    defaultTargetPath: '.github/workflows/appendo-ci.yml',
  },
];

export const getGitWorkflowTemplateById = (templateId: string): GitWorkflowTemplateDefinition | null => (
  GIT_WORKFLOW_TEMPLATES.find((template) => template.id === templateId) ?? null
);
