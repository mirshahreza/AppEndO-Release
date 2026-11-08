import { draftFilePatchTool } from '../../../../../core/ai/tools/native/draftFilePatch';
import { globFilesTool } from '../../../../../core/ai/tools/native/globFiles';
import { listDirTool } from '../../../../../core/ai/tools/native/listDir';
import { readFileTool } from '../../../../../core/ai/tools/native/readFile';
import type { BuiltinCapabilityPackRegistrar } from './types';

/** appendo-files — read · list · glob · draft write (confirm gate on apply). */
export const registerFilesPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  registry.register(readFileTool);
  registry.register(listDirTool);
  registry.register(globFilesTool);
  registry.register(draftFilePatchTool);
};
