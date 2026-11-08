import { describe, expect, it } from 'vitest';
import {
  gradeDesignerRegistryBinding,
  gradeEdgeDbBoundary,
  gradeExperienceRouting,
  gradePackageManifestPolicy,
  gradeProjectStandards,
  gradeRbacEnforcement,
  gradeServerFunctionOpenApi,
  gradeSharedApiQueries,
  gradeWorkspaceDrift,
} from '../verificationGraders';
import { DEFAULT_VERIFICATION_GRADERS } from '../../../api/contracts/appendoo/verificationEngine.types';

const grader = (graderId: string) => {
  const found = DEFAULT_VERIFICATION_GRADERS.find((item) => item.graderId === graderId);
  if (!found) {
    throw new Error(`Missing grader ${graderId}`);
  }
  return found;
};

describe('verificationGraders', () => {
  it('passes workspace drift for isolated workspace paths', () => {
    const result = gradeWorkspaceDrift(
      grader('workspace-drift'),
      ['appendoo/ws/cs-1/workspace/server-functions/custom/export.ts'],
      'cs-1',
    );
    expect(result.grade).toBe('PASS');
  });

  it('fails workspace drift for active-root paths', () => {
    const result = gradeWorkspaceDrift(
      grader('workspace-drift'),
      ['src/server/routes/users.routes.ts'],
      'cs-1',
    );
    expect(result.grade).toBe('FAIL');
  });

  it('passes project standards hygiene for workspace paths', () => {
    const result = gradeProjectStandards(
      grader('project-standards'),
      ['appendoo/ws/cs-1/workspace/server-functions/custom/export.ts'],
    );
    expect(result.grade).toBe('PASS');
  });

  it('validates server function artifact extensions', () => {
    const pass = gradeServerFunctionOpenApi(
      grader('server-function-openapi'),
      ['appendoo/ws/cs-1/workspace/server-functions/custom/export.ts'],
    );
    expect(pass.grade).toBe('PASS');

    const fail = gradeServerFunctionOpenApi(
      grader('server-function-openapi'),
      ['appendoo/ws/cs-1/workspace/server-functions/custom/export.txt'],
    );
    expect(fail.grade).toBe('FAIL');
  });

  it('validates designer draft.json binding', () => {
    const pass = gradeDesignerRegistryBinding(
      grader('designer-registry-binding'),
      [
        'appendoo/ws/cs-1/workspace/designer/drafts/home/draft.json',
        'appendoo/ws/cs-1/workspace/designer/drafts/home/page.tsx',
      ],
    );
    expect(pass.grade).toBe('PASS');

    const fail = gradeDesignerRegistryBinding(
      grader('designer-registry-binding'),
      ['appendoo/ws/cs-1/workspace/designer/drafts/home/page.tsx'],
    );
    expect(fail.grade).toBe('FAIL');
  });

  it('validates package manifest policy', () => {
    const pass = gradePackageManifestPolicy(
      grader('package-manifest-policy'),
      ['appendoo/ws/cs-1/runtime/packages/manifest.json'],
    );
    expect(pass.grade).toBe('PASS');
  });

  it('validates edge db migration boundary', () => {
    const pass = gradeEdgeDbBoundary(
      grader('edge-db-boundary'),
      ['appendoo/ws/cs-1/runtime/migrations/add-users.sql'],
    );
    expect(pass.grade).toBe('PASS');

    const fail = gradeEdgeDbBoundary(
      grader('edge-db-boundary'),
      ['appendoo/ws/cs-1/runtime/migrations/control-plane/base_tables.sql'],
    );
    expect(fail.grade).toBe('FAIL');
  });

  it('validates route and permission registry artifacts', () => {
    expect(gradeExperienceRouting(
      grader('experience-routing'),
      ['appendoo/ws/cs-1/workspace/platform-registry/routes/home.json'],
    ).grade).toBe('PASS');

    expect(gradeRbacEnforcement(
      grader('rbac-enforcement'),
      ['appendoo/ws/cs-1/workspace/platform-registry/permissions/read-users.json'],
    ).grade).toBe('PASS');
  });

  it('validates data-source schema json artifacts', () => {
    expect(gradeSharedApiQueries(
      grader('shared-api-queries'),
      ['appendoo/ws/cs-1/runtime/data-sources/schema/users.json'],
    ).grade).toBe('PASS');
  });
});
