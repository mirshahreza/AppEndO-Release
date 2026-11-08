import {
  PACKAGE_DB_BLOB_INDEX_ENTRY,
  buildPackageDbBlobIndex,
  mergeCapturedPackageBlobs,
  serializePackageDbBlobIndex,
  type CapturedPackageBlob,
} from '../../../core/packages/packageDbBlobPayload';
import {
  PACKAGE_HID_REWRITE_ENTRY,
  buildPackageHidRewriteIndex,
  serializePackageHidRewriteIndex,
  type PackageHidRewriteRow,
} from '../../../core/packages/packageSeedHidRewrite';
import type { PackageArtifactFile } from '../../../shared/packages/packageArtifactHash';

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export function capturedBlobsToArtifactFiles(blobs: readonly CapturedPackageBlob[]): PackageArtifactFile[] {
  const merged = mergeCapturedPackageBlobs(blobs);
  if (merged.length === 0) return [];

  const encoder = new TextEncoder();
  const files: PackageArtifactFile[] = [{
    entryName: PACKAGE_DB_BLOB_INDEX_ENTRY,
    data: encoder.encode(serializePackageDbBlobIndex(buildPackageDbBlobIndex(merged))),
  }];

  for (const blob of merged) {
    files.push({
      entryName: blob.entry,
      data: base64ToUint8Array(blob.contentBase64),
    });
  }
  return files;
}

export function capturedBlobsToRepackFiles(blobs: readonly CapturedPackageBlob[]): Array<{
  entryPath: string;
  content: string;
  contentBase64?: string;
}> {
  const files = capturedBlobsToArtifactFiles(blobs);
  return files.map((file) => {
    if (file.entryName === PACKAGE_DB_BLOB_INDEX_ENTRY) {
      return { entryPath: file.entryName, content: new TextDecoder().decode(file.data) };
    }
    let binary = '';
    for (const byte of file.data) binary += String.fromCharCode(byte);
    return { entryPath: file.entryName, content: '', contentBase64: btoa(binary) };
  });
}

export function capturedHidRowsToArtifactFiles(rows: readonly PackageHidRewriteRow[]): PackageArtifactFile[] {
  const index = buildPackageHidRewriteIndex(rows);
  if (!index) return [];
  return [{
    entryName: PACKAGE_HID_REWRITE_ENTRY,
    data: new TextEncoder().encode(serializePackageHidRewriteIndex(index)),
  }];
}

export function capturedHidRowsToRepackFiles(rows: readonly PackageHidRewriteRow[]): Array<{
  entryPath: string;
  content: string;
}> {
  return capturedHidRowsToArtifactFiles(rows).map((file) => ({
    entryPath: file.entryName,
    content: new TextDecoder().decode(file.data),
  }));
}
