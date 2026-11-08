import type { ServerFunctionItem } from './types';

export function isPackageServerFunction(
  fn: Pick<ServerFunctionItem, 'id' | 'folder'>,
): boolean {
  return fn.id.startsWith('pkg-api-') || fn.folder.startsWith('packages/');
}
