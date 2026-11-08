export const APPENDOO_FACE_PART_IDS = [
  'brows',
  'eyes',
  'mouth',
  'blush',
  'nose',
  'spark',
  'zzz',
] as const;

export type AppendooFacePartId = (typeof APPENDOO_FACE_PART_IDS)[number];

export type AppendooFacePartFlags = Record<AppendooFacePartId, boolean>;

export const APPENDOO_DEFAULT_FACE_PARTS: AppendooFacePartFlags = {
  brows: true,
  eyes: true,
  mouth: true,
  blush: true,
  nose: true,
  spark: true,
  zzz: true,
};

export const APPENDOO_FACE_PART_META: Record<AppendooFacePartId, { id: AppendooFacePartId; label: string; note: string }> = {
  brows: { id: 'brows', label: 'Brows', note: 'Both brows. Off hides them without changing the FACS sliders.' },
  eyes: { id: 'eyes', label: 'Eyes', note: 'Both eyes, including catchlights.' },
  mouth: { id: 'mouth', label: 'Mouth', note: 'Lip line and open jaw.' },
  blush: { id: 'blush', label: 'Blush', note: 'Cheek color. Intensity still comes from the blush slider.' },
  nose: { id: 'nose', label: 'Nose wrinkle', note: 'The disgust wrinkle between the eyes.' },
  spark: { id: 'spark', label: 'Spark', note: 'Thinking spark, when the cue is on.' },
  zzz: { id: 'zzz', label: 'Sleep marks', note: 'zzz marks, when the cue is on.' },
};

export const isAppendooFacePartId = (value: string): value is AppendooFacePartId => (
  (APPENDOO_FACE_PART_IDS as readonly string[]).includes(value)
);

export const mergeAppendooFaceParts = (
  flags?: Partial<AppendooFacePartFlags>,
): AppendooFacePartFlags => ({
  ...APPENDOO_DEFAULT_FACE_PARTS,
  ...flags,
});
