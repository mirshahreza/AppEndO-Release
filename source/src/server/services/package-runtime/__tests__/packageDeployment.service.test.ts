import { describe, expect, it } from 'vitest';
import { buildVerticalAppManifest } from '../../../../core/packages/testkit/verticalAppPackageBuilder';
import {
  buildDeploymentPreview,
  canAutoApplyDeployment,
} from '../packageDeployment.service';

describe('packageDeployment.service', () => {
  const manifest = buildVerticalAppManifest({
    packageId: 'va-demo',
    name: 'VA Demo',
    version: '1.0.0',
    pathPrefix: '/va-demo',
    applyPolicy: 'propose',
  });

  it('builds deployment preview payload', () => {
    const preview = buildDeploymentPreview('va-demo', '1.0.0', manifest);
    expect(preview.schema).toBe('package-deployment-preview');
    expect(preview.packageId).toBe('va-demo');
    expect(preview.deployment.mount.pathPrefix).toBe('/va-demo');
  });

  it('requires PACKAGE_AUTO_DEPLOY in production for auto policy', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAutoDeploy = process.env.PACKAGE_AUTO_DEPLOY;

    process.env.NODE_ENV = 'production';
    delete process.env.PACKAGE_AUTO_DEPLOY;
    expect(canAutoApplyDeployment('auto')).toBe(false);
    expect(canAutoApplyDeployment('propose')).toBe(false);

    process.env.PACKAGE_AUTO_DEPLOY = 'true';
    expect(canAutoApplyDeployment('auto')).toBe(true);

    process.env.NODE_ENV = 'test';
    expect(canAutoApplyDeployment('auto')).toBe(true);

    process.env.NODE_ENV = previousNodeEnv;
    process.env.PACKAGE_AUTO_DEPLOY = previousAutoDeploy;
  });
});
