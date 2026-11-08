import { z } from 'zod';

export const FK_REFERENTIAL_ACTIONS = [
  'NO ACTION',
  'RESTRICT',
  'CASCADE',
  'SET NULL',
  'SET DEFAULT',
] as const;

export type FkReferentialAction = (typeof FK_REFERENTIAL_ACTIONS)[number];

export const addForeignKeyConstraintInputSchema = z.object({
  dataSourceId: z.string().min(1),
  tableName: z.string().min(1),
  columnName: z.string().min(1),
  referencedTable: z.string().min(1),
  referencedColumn: z.string().min(1),
  constraintName: z.string().min(1).optional(),
  onDelete: z.enum(FK_REFERENTIAL_ACTIONS).optional(),
  onUpdate: z.enum(FK_REFERENTIAL_ACTIONS).optional(),
}).strict();

export const dropForeignKeyConstraintInputSchema = z.object({
  dataSourceId: z.string().min(1),
  tableName: z.string().min(1),
  constraintName: z.string().min(1),
}).strict();

export type AddForeignKeyConstraintInput = z.infer<typeof addForeignKeyConstraintInputSchema>;
export type DropForeignKeyConstraintInput = z.infer<typeof dropForeignKeyConstraintInputSchema>;
