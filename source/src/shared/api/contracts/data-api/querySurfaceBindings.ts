import { z } from 'zod';

export const QUERY_SURFACE_BINDING_WORKSPACE_DIR = 'query-surface-bindings';

const grantModeSchema = z.enum(['public', 'roles', 'users']);

const surfaceGrantSchema = z.object({
  mode: grantModeSchema,
  roleIds: z.array(z.string().min(1)).optional(),
  userIds: z.array(z.string().min(1)).optional(),
}).strict();

export const querySurfaceBindingDocumentSchema = z.object({
  edgeModelId: z.string().min(1),
  columnWhereGrants: z.record(z.string(), surfaceGrantSchema).default({}),
  presetGrants: z.record(z.string(), surfaceGrantSchema).default({}),
  updatedAt: z.string().optional(),
}).strict();

export type QuerySurfaceBindingDocument = z.infer<typeof querySurfaceBindingDocumentSchema>;
export type QuerySurfaceGrant = z.infer<typeof surfaceGrantSchema>;

export type NormalizeQuerySurfaceBindingResult =
  | { ok: true; binding: QuerySurfaceBindingDocument }
  | { ok: false; message: string };

export const normalizeQuerySurfaceBindingDocument = (
  input: unknown,
): NormalizeQuerySurfaceBindingResult => {
  const parsed = querySurfaceBindingDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message };
  }
  return { ok: true, binding: parsed.data };
};
