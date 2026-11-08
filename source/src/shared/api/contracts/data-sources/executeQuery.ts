import { z } from 'zod';

export const executeDataSourceQueryInputSchema = z.object({
  dataSourceId: z.string().min(1),
  sql: z.string().min(1),
  allowWrite: z.boolean().optional(),
}).strict();

export type ExecuteDataSourceQueryInput = z.infer<typeof executeDataSourceQueryInputSchema>;

export type ExecuteDataSourceQueryResult = {
  data: unknown[];
  count: number;
  truncated: boolean;
  source: {
    id: string;
    name: string;
    type: string;
  };
};
