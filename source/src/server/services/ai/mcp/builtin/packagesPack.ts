import type { ToolRegistry } from '../../../../../core/ai/tools/ToolRegistry';
import { createPackagesTools } from './packagesTools';

export function registerPackagesPackTools(registry: ToolRegistry): void {
  createPackagesTools().forEach((tool) => registry.register(tool));
}
