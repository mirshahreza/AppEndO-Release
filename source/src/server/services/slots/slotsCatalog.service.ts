import fs from 'fs';
import path from 'path';
import { packageDirs } from '../../../core/packages/PackageFileStore';

export type RegisteredSlotComponent = {
  slotId: string;
  packageId: string;
  componentKey: string;
  order: number;
};

export const listRegisteredSlotComponents = async (): Promise<RegisteredSlotComponent[]> => {
  const items: RegisteredSlotComponent[] = [];

  if (!fs.existsSync(packageDirs.manifests)) {
    return items;
  }

  const pluginFolders = fs.readdirSync(packageDirs.manifests);
  for (const folder of pluginFolders) {
    const folderPath = path.join(packageDirs.manifests, folder);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath).filter((name) => name.endsWith('.manifest.json'));
    for (const fileName of files) {
      const manifestPath = path.join(folderPath, fileName);
      try {
        const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestRaw) as {
          id?: string;
          capabilities?: {
            ui_components?: Array<{
              slotId?: string;
              componentKey?: string;
              order?: number;
            }>;
          };
        };
        const packageId = String(manifest.id || folder).trim();
        const uiItems = Array.isArray(manifest?.capabilities?.ui_components)
          ? manifest.capabilities.ui_components
          : [];

        for (const ui of uiItems) {
          const slotId = typeof ui?.slotId === 'string' ? ui.slotId.trim() : '';
          const componentKey = typeof ui?.componentKey === 'string' ? ui.componentKey.trim() : '';
          if (!slotId || !componentKey) continue;
          items.push({
            slotId,
            packageId,
            componentKey,
            order: Number.isFinite(Number(ui.order)) ? Number(ui.order) : 0,
          });
        }
      } catch {
        // Ignore malformed manifest entries from old artifacts.
      }
    }
  }

  return items.sort((left, right) => (
    left.slotId.localeCompare(right.slotId)
    || left.order - right.order
    || left.packageId.localeCompare(right.packageId)
  ));
};
