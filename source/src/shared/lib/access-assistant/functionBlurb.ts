const DEFAULT_MAX_LENGTH = 160;

export function truncateAccessAssistantBlurb(text: string, maxLength = DEFAULT_MAX_LENGTH): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function resolveFunctionBlurbFromMetadata(
  metadataJson: string | null | undefined,
  fallbackName: string,
): string {
  if (!metadataJson?.trim()) {
    return truncateAccessAssistantBlurb(fallbackName);
  }

  try {
    const parsed = JSON.parse(metadataJson) as {
      openapi?: { description?: string; summary?: string };
    };
    const openapi = parsed.openapi;
    const description = openapi?.description?.trim();
    if (description) {
      return truncateAccessAssistantBlurb(description);
    }
    const summary = openapi?.summary?.trim();
    if (summary) {
      return truncateAccessAssistantBlurb(summary);
    }
  } catch {
    // ignore invalid metadata
  }

  return truncateAccessAssistantBlurb(fallbackName);
}
