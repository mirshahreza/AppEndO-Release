import type { AppendooFaceRig } from './appendooFaceRig';

const FACE_CX = 50;

export type AppendooBrowGeometry = {
  innerX: number;
  innerY: number;
  outerX: number;
  outerY: number;
  midX: number;
  midY: number;
};

export const resolveAppendooBrowGeometry = (
  rig: AppendooFaceRig,
  side: 'left' | 'right',
): AppendooBrowGeometry => {
  const dir = side === 'left' ? -1 : 1;
  const knit = rig.browKnit * 3.4;
  const asymLift = (side === 'right' ? 1 : -1) * rig.browAsym;
  const innerX = FACE_CX + dir * (rig.browGap / 2 - knit);
  const outerX = innerX + dir * rig.browLength;
  const innerY = rig.eyeY - rig.browY - (rig.browInnerY + asymLift) * 6.4;
  const outerY = rig.eyeY - rig.browY - (rig.browOuterY + asymLift * 0.72) * 6.4;
  const midX = (innerX + outerX) / 2;
  const midY = Math.min(innerY, outerY) - 1.6 - Math.max(rig.browInnerY, rig.browOuterY) * 1.1;
  return { innerX, innerY, outerX, outerY, midX, midY };
};

export const appendooBrowPath = (rig: AppendooFaceRig, side: 'left' | 'right'): string => {
  const brow = resolveAppendooBrowGeometry(rig, side);
  return `M ${brow.outerX.toFixed(2)} ${brow.outerY.toFixed(2)} Q ${brow.midX.toFixed(2)} ${brow.midY.toFixed(2)} ${brow.innerX.toFixed(2)} ${brow.innerY.toFixed(2)}`;
};

export const resolveAppendooEyeCenter = (
  rig: AppendooFaceRig,
  side: 'left' | 'right',
): { x: number; y: number } => {
  const dir = side === 'left' ? -1 : 1;
  return {
    x: FACE_CX + dir * (rig.eyeGap / 2),
    y: rig.eyeY,
  };
};

export const resolveAppendooEyeOpen = (
  rig: AppendooFaceRig,
  side: 'left' | 'right',
): number => {
  const wink = side === 'left' ? rig.winkLeft : rig.winkRight;
  const squint = 1 - rig.cheekRaise * 0.55;
  return Math.max(0, rig.eyeOpen * (1 - wink) * squint);
};

export const appendooClosedEyePath = (
  rig: AppendooFaceRig,
  side: 'left' | 'right',
): string => {
  const { x, y } = resolveAppendooEyeCenter(rig, side);
  const span = rig.eyeSize * 1.7;
  const lift = rig.cheekRaise > 0.35 || rig.mouthCurve > 0.45 ? -3.6 : 2.8;
  return `M ${(x - span).toFixed(2)} ${y.toFixed(2)} Q ${x.toFixed(2)} ${(y + lift).toFixed(2)} ${(x + span).toFixed(2)} ${y.toFixed(2)}`;
};

export const appendooNoseWrinklePath = (rig: AppendooFaceRig): string => {
  const y = rig.eyeY - 5.4;
  const span = 2.2 + rig.noseWrinkle * 1.6;
  const dip = 1.4 + rig.noseWrinkle * 1.1;
  return `M ${(FACE_CX - span).toFixed(2)} ${y.toFixed(2)} Q ${FACE_CX.toFixed(2)} ${(y - dip).toFixed(2)} ${(FACE_CX + span).toFixed(2)} ${y.toFixed(2)}`;
};

export const appendooMouthPath = (rig: AppendooFaceRig): string => {
  const half = rig.mouthWidth / 2;
  const leftX = FACE_CX - half;
  const rightX = FACE_CX + half;
  const leftY = rig.mouthY + (rig.mouthAsym < 0 ? rig.mouthAsym * 3.2 : 0);
  const rightY = rig.mouthY - (rig.mouthAsym > 0 ? rig.mouthAsym * 3.2 : 0);
  const bow = rig.mouthCurve * 4.6;
  const midY = (leftY + rightY) / 2 + bow;
  return `M ${leftX.toFixed(2)} ${leftY.toFixed(2)} Q ${FACE_CX.toFixed(2)} ${midY.toFixed(2)} ${rightX.toFixed(2)} ${rightY.toFixed(2)}`;
};
