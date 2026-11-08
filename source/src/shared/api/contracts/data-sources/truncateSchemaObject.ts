import { z } from 'zod';

export const truncateSchemaObjectInputSchema = z.object({
  dataSourceId: z.string().min(1),
  objectName: z.string().min(1),
}).strict();

export type TruncateSchemaObjectInput = z.infer<typeof truncateSchemaObjectInputSchema>;
