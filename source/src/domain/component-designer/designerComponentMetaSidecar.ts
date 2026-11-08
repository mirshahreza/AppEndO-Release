export const DESIGNER_COMPONENT_META_SUFFIX = '.meta.json';

export const isDesignerComponentMetaFileName = (fileName: string): boolean =>
  fileName.endsWith(DESIGNER_COMPONENT_META_SUFFIX);

export const isDesignerComponentTsxFileName = (fileName: string): boolean =>
  fileName.endsWith('.tsx');

export const resolveDesignerComponentMetaPath = (tsxFilePath: string): string => {
  if (tsxFilePath.endsWith('.tsx')) {
    return `${tsxFilePath.slice(0, -4)}${DESIGNER_COMPONENT_META_SUFFIX}`;
  }

  return `${tsxFilePath}${DESIGNER_COMPONENT_META_SUFFIX}`;
};

export const resolveDesignerComponentTsxPath = (metaFilePath: string): string | null => {
  if (!metaFilePath.endsWith(DESIGNER_COMPONENT_META_SUFFIX)) {
    return null;
  }

  return `${metaFilePath.slice(0, -DESIGNER_COMPONENT_META_SUFFIX.length)}.tsx`;
};

export const draftIdFromDesignerMetaContent = (content: string, draftId: string): boolean =>
  content.includes(`"id":"${draftId}"`) || content.includes(`"id": "${draftId}"`);
