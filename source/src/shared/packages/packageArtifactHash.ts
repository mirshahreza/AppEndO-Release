export type PackageArtifactFile = {
  entryName: string;
  data: Uint8Array;
};

const normalizeEntryName = (entryName: string): string => entryName.replace(/\\/g, '/');

const uint8ArrayToBase64 = (data: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < data.length; index += 1) {
    binary += String.fromCharCode(data[index]);
  }
  return btoa(binary);
};

export const encodePackageArtifactFile = (entryName: string, data: Uint8Array): string => (
  `${normalizeEntryName(entryName)}\0${uint8ArrayToBase64(data)}`
);

export const buildPackageArtifactHashPayload = (files: PackageArtifactFile[]): string => (
  files
    .filter((file) => normalizeEntryName(file.entryName) !== 'package.json')
    .sort((left, right) => left.entryName.localeCompare(right.entryName))
    .map((file) => encodePackageArtifactFile(file.entryName, file.data))
    .join('\n')
);

export const computePackageArtifactHashAsync = async (files: PackageArtifactFile[]): Promise<string> => {
  const payload = buildPackageArtifactHashPayload(files);
  const encoded = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
