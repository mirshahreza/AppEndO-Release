/** User-facing guidance + LLM rubric stored on Base Info rows (control-plane). */

export type BaseInfoSemanticContent = {
  userGuidance: string;
  semanticRubric: string;
};

const LEGACY_DELIMITER = ':::';

const readMetadataObject = (metadata: string | null | undefined): Record<string, unknown> => {
  const trimmed = String(metadata ?? '').trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

export const parseBaseInfoSemanticContent = (
  note: string | null | undefined,
  metadata: string | null | undefined,
): BaseInfoSemanticContent => {
  const meta = readMetadataObject(metadata);
  const metaGuidance = typeof meta.userGuidance === 'string' ? meta.userGuidance.trim() : '';
  const metaRubric = typeof meta.semanticRubric === 'string' ? meta.semanticRubric.trim() : '';

  if (metaGuidance || metaRubric) {
    return {
      userGuidance: metaGuidance,
      semanticRubric: metaRubric || readLegacyRubricFromNote(note),
    };
  }

  const rawNote = String(note ?? '').trim();
  if (!rawNote) {
    return { userGuidance: '', semanticRubric: '' };
  }

  const segments = rawNote.split(LEGACY_DELIMITER);
  const userGuidance = (segments[0] ?? '').trim();
  const semanticRubric = segments.slice(1).join(LEGACY_DELIMITER).trim();
  return { userGuidance, semanticRubric };
};

const readLegacyRubricFromNote = (note: string | null | undefined): string => {
  const rawNote = String(note ?? '').trim();
  if (!rawNote.includes(LEGACY_DELIMITER)) {
    return '';
  }
  return rawNote.split(LEGACY_DELIMITER).slice(1).join(LEGACY_DELIMITER).trim();
};

export const mergeBaseInfoSemanticContent = (
  existingMetadata: string | null | undefined,
  content: BaseInfoSemanticContent,
): { note: string; metadata: string } => {
  const meta = readMetadataObject(existingMetadata);
  const userGuidance = content.userGuidance.trim();
  const semanticRubric = content.semanticRubric.trim();

  const nextMeta: Record<string, unknown> = {
    ...meta,
    userGuidance: userGuidance || undefined,
    semanticRubric: semanticRubric || undefined,
  };

  if (!nextMeta.userGuidance) {
    delete nextMeta.userGuidance;
  }
  if (!nextMeta.semanticRubric) {
    delete nextMeta.semanticRubric;
  }

  const metadata = Object.keys(nextMeta).length > 0 ? JSON.stringify(nextMeta) : '';
  const note = userGuidance;
  return { note, metadata };
};
