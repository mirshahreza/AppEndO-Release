import fs from 'fs';
import path from 'path';

const CMS_PACKAGE_SEED_REL = 'src/server/domain/cms-package-seed';

/** Resolve CMS package seed folder for tsx dev, tests, and bundled `dist/server.cjs` (cwd + src tree). */
export const resolveCmsPackageSeedDir = (): string => {
  const fromCwd = path.join(process.cwd(), CMS_PACKAGE_SEED_REL);
  if (fs.existsSync(path.join(fromCwd, 'assets'))) {
    return fromCwd;
  }

  const fromImportMeta = import.meta.dirname;
  if (typeof fromImportMeta === 'string' && fs.existsSync(path.join(fromImportMeta, 'assets'))) {
    return fromImportMeta;
  }

  return fromCwd;
};

export const cmsPackageSeedAssetsDir = (): string => path.join(resolveCmsPackageSeedDir(), 'assets');
