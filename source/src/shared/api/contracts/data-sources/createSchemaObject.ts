import { z } from 'zod';

export const createSchemaObjectInputSchema = z.object({
  dataSourceId: z.string().min(1),
  objectName: z.string().min(1).optional(),
  objectType: z.enum(['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION']),
  functionKind: z.enum(['SCALAR', 'TABLE_VALUED']).optional(),
  sql: z.string().min(1).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.objectType === 'FUNCTION' && !value.functionKind) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'functionKind is required when objectType is FUNCTION.',
      path: ['functionKind'],
    });
  }

  if (!value.sql?.trim() && !value.objectName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'objectName or sql is required.',
      path: ['objectName'],
    });
  }
});

export type CreateSchemaObjectInput = z.infer<typeof createSchemaObjectInputSchema>;
