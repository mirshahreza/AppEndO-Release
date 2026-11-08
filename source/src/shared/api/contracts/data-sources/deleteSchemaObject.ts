import { z } from 'zod';

export const deleteSchemaObjectInputSchema = z.object({
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

export type DeleteSchemaObjectInput = z.infer<typeof deleteSchemaObjectInputSchema>;
