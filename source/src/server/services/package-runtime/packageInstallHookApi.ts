import { insertBaseInfoNodeWithHid } from '../../domain/base-info/baseInfoHid';
import { findBaseInfoIdExists } from '../../domain/base-info/treeRepository';
import { prisma, toUserId } from '../../domain/users/prismaHelpers';
import {
  applyPackageNavigationPatch,
  type PackageNavigationPatchInput,
} from './packageNavigationPatch.service';

export type PackageInstallHookInsertBaseInfoNodeInput = {
  parentId?: string | null;
  childDigits?: number;
  title?: string | null;
  titleEn?: string | null;
  titleFa?: string | null;
  titleAr?: string | null;
  shortName?: string | null;
  viewOrder?: number | string | null;
  note?: string | null;
  noteEn?: string | null;
  noteFa?: string | null;
  noteAr?: string | null;
  metadata?: string | null;
  value?: number | null;
  isActive?: boolean | null;
  uiColor?: string | null;
  uiHtml?: string | null;
};

/** Scoped API surface handed into a package install hook's VM sandbox — deliberately narrow, no arbitrary DB/Prisma access. */
export type PackageInstallHookApi = {
  baseInfo: {
    insertNode: (input: PackageInstallHookInsertBaseInfoNodeInput) => Promise<{ id: string }>;
  };
  navigation: {
    addGroupWithItems: (
      input: PackageNavigationPatchInput,
    ) => Promise<{ groupCreated: boolean; itemsAdded: number }>;
  };
  log: (...args: unknown[]) => void;
};

export function createPackageInstallHookApi(
  packageId: string,
  onLog: (line: string) => void,
): PackageInstallHookApi {
  return {
    navigation: {
      addGroupWithItems: (input) => applyPackageNavigationPatch(packageId, input),
    },
    baseInfo: {
      async insertNode(input) {
        const canonicalTitle = (input.title ?? input.titleEn ?? input.titleFa ?? input.titleAr ?? '').trim() || null;
        const canonicalNote = (input.note ?? input.noteEn ?? input.noteFa ?? input.noteAr ?? '').trim() || null;
        const id = await insertBaseInfoNodeWithHid({
          parentId: input.parentId,
          childDigits: input.childDigits,
          title: canonicalTitle,
          shortName: input.shortName,
          viewOrder: input.viewOrder,
          note: canonicalNote,
          metadata: input.metadata,
          value: input.value,
          isActive: input.isActive,
          uiColor: input.uiColor,
          uiHtml: input.uiHtml,
          idExists: async (candidate) => Boolean(await findBaseInfoIdExists(candidate)),
          insert: async (row) => {
            await prisma().baseInfo.create({
              data: {
                id: row.id,
                parentId: row.parentId,
                title: row.title,
                shortName: row.shortName,
                viewOrder: row.viewOrder ?? undefined,
                note: row.note,
                metadata: row.metadata,
                value: row.value ?? undefined,
                isActive: row.isActive,
                uiColor: row.uiColor,
                uiHtml: row.uiHtml,
                createdBy: row.actorId !== null ? toUserId(row.actorId) : null,
                updatedBy: row.actorId !== null ? toUserId(row.actorId) : null,
              },
            });
          },
        });
        return { id };
      },
    },
    log: (...args: unknown[]) => {
      onLog(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    },
  };
}
