export type PackageDescriptionBlock = {
  version: string | null;
  text: string;
};

const VERSION_SECTION_SPLIT_RE = /\n\n(?=v\d+\.\d+\.\d+(?:\n|$))/;
const VERSION_SECTION_RE = /^v(\d+\.\d+\.\d+)\n\n?([\s\S]*)$/;

export function parsePackageDescriptionBlocks(description: string): PackageDescriptionBlock[] {
  const normalized = description.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  return normalized.split(VERSION_SECTION_SPLIT_RE).map((segment) => {
    const trimmed = segment.trim();
    const versionMatch = VERSION_SECTION_RE.exec(trimmed);
    if (versionMatch) {
      return {
        version: versionMatch[1],
        text: versionMatch[2].trim(),
      };
    }
    return { version: null, text: trimmed };
  });
}
