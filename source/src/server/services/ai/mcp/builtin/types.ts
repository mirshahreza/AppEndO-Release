import type { ToolRegistry } from '../../../../../core/ai/tools/ToolRegistry';

/** Registers native tools for one in-process built-in capability pack. */
export type BuiltinCapabilityPackRegistrar = (
  registry: Pick<ToolRegistry, 'register'>,
) => void;
