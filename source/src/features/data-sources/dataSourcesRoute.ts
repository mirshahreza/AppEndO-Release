import { STUDIO_MOUNT_ID, toPortalRoutePattern } from '../../shared/api/contracts/platform/mountConstants';
import type { DataSourceRecord } from '../../shared/api/contracts/data-sources/types';

export const DATA_SOURCES_LIST_SEGMENT = 'data-sources';
export const DATA_SOURCES_QUESTIONS_SEGMENT = 'questions';

const decodeSegment = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

function segmentsAfterList(rawSuffix: string | undefined): string[] {
  const segments = rawSuffix?.split('/').filter(Boolean) ?? [];
  if (segments.length === 0) {
    return [];
  }

  const listIndex = segments.lastIndexOf(DATA_SOURCES_LIST_SEGMENT);
  return listIndex >= 0 ? segments.slice(listIndex + 1) : segments;
}

export function parseDataSourcesQuestionsId(rawSuffix: string | undefined): string | null {
  const afterList = segmentsAfterList(rawSuffix);
  if (afterList[0] !== DATA_SOURCES_QUESTIONS_SEGMENT) {
    return null;
  }

  const id = afterList[1]?.trim();
  return id ? decodeSegment(id) : null;
}

export function parseDataSourcesQuestionsIdFromPathname(pathname: string): string | null {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const listIndex = segments.lastIndexOf(DATA_SOURCES_LIST_SEGMENT);
  if (listIndex < 0) {
    return null;
  }

  return parseDataSourcesQuestionsId(segments.slice(listIndex + 1).join('/'));
}

export function isUnknownDataSourcesNestedPath(rawSuffix: string | undefined): boolean {
  const afterList = segmentsAfterList(rawSuffix);
  if (afterList.length === 0) {
    return false;
  }

  return parseDataSourcesQuestionsId(afterList.join('/')) === null;
}

export function findDataSourceByQuestionsId(
  items: DataSourceRecord[],
  questionsId: string,
): DataSourceRecord | undefined {
  const decoded = decodeSegment(questionsId).trim();
  if (!decoded) {
    return undefined;
  }

  return items.find((item) => item.id === decoded);
}

export function buildDataSourcesListRelativePath(mountId: string = STUDIO_MOUNT_ID): string {
  if (mountId === STUDIO_MOUNT_ID) {
    return DATA_SOURCES_LIST_SEGMENT;
  }

  return toPortalRoutePattern(DATA_SOURCES_LIST_SEGMENT);
}

export function buildDataSourcesQuestionsRelativePath(
  dataSource: Pick<DataSourceRecord, 'id'>,
  mountId: string = STUDIO_MOUNT_ID,
): string {
  const questionsPath = `${DATA_SOURCES_LIST_SEGMENT}/${DATA_SOURCES_QUESTIONS_SEGMENT}/${encodeURIComponent(dataSource.id)}`;
  if (mountId === STUDIO_MOUNT_ID) {
    return questionsPath;
  }

  return toPortalRoutePattern(questionsPath);
}
