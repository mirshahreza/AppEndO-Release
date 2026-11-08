const VERSION_SUFFIX_RE = /@v(\d+)$/;

export type ParsedDesignerLoaderRef = {
  componentPath: string;
  publishedVersion?: number;
};

export function parsePinnedDesignerLoaderRef(loaderRef: string): ParsedDesignerLoaderRef {
  const trimmed = loaderRef.trim();
  const match = VERSION_SUFFIX_RE.exec(trimmed);
  if (!match) {
    return { componentPath: trimmed };
  }

  return {
    componentPath: trimmed.slice(0, -match[0].length),
    publishedVersion: Number(match[1]),
  };
}

export function buildPinnedDesignerLoaderRef(componentPath: string, version: number): string {
  return `${componentPath.trim()}@v${version}`;
}

export function stripPinnedDesignerLoaderRef(loaderRef: string): string {
  return parsePinnedDesignerLoaderRef(loaderRef).componentPath;
}
