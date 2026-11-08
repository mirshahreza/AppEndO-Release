import type { AppendooCompanionFace } from './appendooCompanion.types';

export type CompanionFaceInput = {
  dragged: boolean;
  hovered: boolean;
  sleepy: boolean;
  surprised: boolean;
  near: boolean;
  override: AppendooCompanionFace | null;
};

export const resolveCompanionFace = (input: CompanionFaceInput): AppendooCompanionFace => {
  if (input.dragged) return 'grabbed';
  if (input.override) return input.override;
  if (input.sleepy) return 'sleepy';
  if (input.surprised) return 'surprised';
  if (input.hovered) return 'happy';
  if (input.near) return 'curious';
  return 'idle';
};
