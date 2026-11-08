import { z } from 'zod';

export const deleteSchemaObjectPreviewQuerySchema = z.object({
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

export type DeleteSchemaObjectPreviewQuery = z.infer<typeof deleteSchemaObjectPreviewQuerySchema>;

export type SchemaObjectDeletePreviewField = {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
};

export type SchemaObjectDeleteRelationRef = {
  peerObjectName: string;
  as: string;
  kind: string;
  role: 'target' | 'through';
};

/** Logical Edge-model relation cleanup preview (TABLE/VIEW only). */
export type SchemaObjectDeleteRelationImpact = {
  edgeModelId: string | null;
  outboundLogicalCount: number;
  outboundAliases: string[];
  inboundRefs: SchemaObjectDeleteRelationRef[];
  willParkStudioMeta: boolean;
};

export type SchemaObjectDeletePreview = {
  rowCount: number | null;
  totalFieldCount: number;
  fields: SchemaObjectDeletePreviewField[];
  relationImpact?: SchemaObjectDeleteRelationImpact | null;
};
