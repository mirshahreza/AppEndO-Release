const SEGMENT_PATTERN = /[^a-z0-9._-]+/g;

export function sanitizeFunctionSegment(value: string): string {
  return String(value || 'unnamed')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(SEGMENT_PATTERN, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '') || 'unnamed';
}

export function buildFunctionBaseName(folder: string, name: string): string {
  return `${sanitizeFunctionSegment(folder)}.${sanitizeFunctionSegment(name)}`;
}

export function buildManagedFunctionId(folder: string, name: string): string {
  return buildFunctionBaseName(folder, name);
}

export function buildFunctionSourceFileName(folder: string, name: string, language: string): string {
  const extension = language === 'js' ? 'js' : 'ts';
  return `${buildFunctionBaseName(folder, name)}.${extension}`;
}

export function buildFunctionMetadataFileName(folder: string, name: string): string {
  return `${buildFunctionBaseName(folder, name)}.metadata.json`;
}

export function isFunctionMetadataFileName(fileName: string): boolean {
  return fileName.endsWith('.metadata.json');
}
