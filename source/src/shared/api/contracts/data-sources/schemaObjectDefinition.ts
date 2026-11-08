import { z } from 'zod';

export const schemaObjectDefinitionQuerySchema = z.object({
  dataSourceId: z.string().min(1),
  objectName: z.string().min(1),
  objectType: z.enum(['VIEW', 'PROCEDURE', 'FUNCTION']),
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

export type SchemaObjectDefinitionQuery = z.infer<typeof schemaObjectDefinitionQuerySchema>;

export const updateSchemaObjectDefinitionInputSchema = z.object({
  dataSourceId: z.string().min(1),
  objectType: z.enum(['VIEW', 'PROCEDURE', 'FUNCTION']),
  functionKind: z.enum(['SCALAR', 'TABLE_VALUED']).optional(),
  sql: z.string().min(1),
}).strict().superRefine((value, ctx) => {
  if (value.objectType === 'FUNCTION' && !value.functionKind) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'functionKind is required when objectType is FUNCTION.',
      path: ['functionKind'],
    });
  }
});

export type UpdateSchemaObjectDefinitionInput = z.infer<typeof updateSchemaObjectDefinitionInputSchema>;
