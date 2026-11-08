import { prisma } from '../users/prismaHelpers';

export { prisma };

/**
 * The shared Prisma interactive-transaction client type. Declared here (the module every workflow
 * repository/engine file already imports `prisma`/`toId`/etc. from) rather than in `engine/`, so
 * both domain-layer repositories (`monotonicAllocation.ts`, `workflowTraceRepository.ts` — Slice 10's
 * tx-aware trace primitives) and engine-layer transaction functions (`continuationApply.ts` and
 * friends, which re-export it as `Tx` for backward-compatible imports) can reference one definition
 * without an engine → domain-layer import inversion.
 */
export type PrismaTransactionClient = Parameters<Parameters<ReturnType<typeof prisma>['$transaction']>[0]>[0];

export const toId = (id: number | bigint): bigint => BigInt(id);

export const fromId = (id: bigint | number): number => Number(id);

export const toIsoString = (value: Date | null | undefined): string | null =>
  value instanceof Date ? value.toISOString() : value ? String(value) : null;

export const toNullableId = (id: bigint | number | null | undefined): number | null =>
  id !== null && id !== undefined ? fromId(id) : null;
