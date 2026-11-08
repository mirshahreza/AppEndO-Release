/** Stable artifact identity for V3 intelligence contracts (Phase 04). */
export type ArtifactType =
  | 'application'
  | 'package'
  | 'page'
  | 'component'
  | 'server_function'
  | 'route'
  | 'entity'
  | 'layout'
  | 'service';

export type ArtifactRef = {
  applicationScopeRef: string;
  packageId?: string;
  artifactType: ArtifactType;
  artifactId: string;
  canonicalName: string;
  sourceUri?: string;
};

export const buildArtifactRef = (input: Omit<ArtifactRef, 'artifactId'> & { artifactId?: string }): ArtifactRef => ({
  applicationScopeRef: input.applicationScopeRef,
  packageId: input.packageId,
  artifactType: input.artifactType,
  artifactId: input.artifactId ?? `${input.artifactType}:${input.canonicalName}`,
  canonicalName: input.canonicalName,
  sourceUri: input.sourceUri,
});

export const artifactRefKey = (ref: ArtifactRef): string => (
  `${ref.applicationScopeRef}|${ref.artifactType}|${ref.artifactId}`
);
