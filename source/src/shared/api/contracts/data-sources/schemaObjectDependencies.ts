import { z } from 'zod';

export const schemaObjectDependenciesQuerySchema = z.object({
  dataSourceId: z.string().min(1),
  objectName: z.string().min(1),
  objectType: z.enum(['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION']),
  functionKind: z.enum(['SCALAR', 'TABLE_VALUED']).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.objectType === 'FUNCTION' && !value.functionKind) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'functionKind is required when objectType is FUNCTION.',
      path: ['functionKind'],
    });
  }
});

export type SchemaObjectDependenciesQuery = z.infer<typeof schemaObjectDependenciesQuerySchema>;

export type SchemaObjectDependencyKind =
  | 'TABLE'
  | 'VIEW'
  | 'STORED_PROCEDURE'
  | 'SCALAR_FUNCTION'
  | 'TABLE_VALUED_FUNCTION'
  | 'UNKNOWN';

export type SchemaObjectDependencyItem = {
  objectName: string;
  objectKind: SchemaObjectDependencyKind;
  details?: string | null;
};

export type SchemaObjectDependencies = {
  dependencies: SchemaObjectDependencyItem[];
  dependents: SchemaObjectDependencyItem[];
};
