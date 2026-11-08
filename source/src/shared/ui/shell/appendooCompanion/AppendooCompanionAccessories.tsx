import React from 'react';
import { cn } from '../../../../lib/utils';
import {
  accessoryPoseCssVars,
  resolveAppendooAccessoryPaint,
  type AppendooAccessoryFlags,
  type AppendooAccessoryMood,
  type AppendooAccessoryPaint,
} from './appendooAccessories';
import type { AppendooFaceRig } from './appendooFaceRig';

type AppendooCompanionAccessoriesProps = {
  flags: AppendooAccessoryFlags;
  mood: AppendooAccessoryMood;
  rig: AppendooFaceRig;
  paint?: AppendooAccessoryPaint;
  slot: 'crown' | 'lenses';
};

const AccessoryGroup: React.FC<{
  testId: string;
  className: string;
  originX: number;
  originY: number;
  pose: AppendooAccessoryMood[keyof AppendooAccessoryMood];
  children: React.ReactNode;
}> = ({ testId, className, originX, originY, pose, children }) => (
  <g
    className={cn('appendoo-accessory', className)}
    data-testid={testId}
    style={{
      ...accessoryPoseCssVars(pose),
      transformOrigin: `${originX}px ${originY}px`,
    } as React.CSSProperties}
  >
    {children}
  </g>
);

export const AppendooCompanionAccessories: React.FC<AppendooCompanionAccessoriesProps> = ({
  flags,
  mood,
  rig,
  paint,
  slot,
}) => {
  const colors = paint ?? resolveAppendooAccessoryPaint();
  const leftEyeX = 50 - rig.eyeGap / 2;
  const rightEyeX = 50 + rig.eyeGap / 2;
  const lensR = rig.eyeSize * 1.78;
  if (slot === 'lenses') {
    if (!flags.glasses) return null;
    return (
      <AccessoryGroup
        testId="appendoo-glasses"
        className="appendoo-accessory-glasses"
        originX={50}
        originY={rig.eyeY}
        pose={mood.glasses}
      >
        <path
          d={`M ${leftEyeX - lensR * 0.98} ${rig.eyeY - 1.2} C ${leftEyeX - lensR * 1.55} ${rig.eyeY - 4} ${leftEyeX - lensR * 1.7} ${rig.eyeY + 2} ${leftEyeX - lensR * 1.35} ${rig.eyeY + 3.4}`}
          fill="none"
          stroke={colors.lo}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d={`M ${rightEyeX + lensR * 0.98} ${rig.eyeY - 1.2} C ${rightEyeX + lensR * 1.55} ${rig.eyeY - 4} ${rightEyeX + lensR * 1.7} ${rig.eyeY + 2} ${rightEyeX + lensR * 1.35} ${rig.eyeY + 3.4}`}
          fill="none"
          stroke={colors.lo}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle
          cx={leftEyeX}
          cy={rig.eyeY}
          r={lensR}
          fill={colors.lens}
          stroke={colors.lo}
          strokeWidth="2.35"
        />
        <circle
          cx={rightEyeX}
          cy={rig.eyeY}
          r={lensR}
          fill={colors.lens}
          stroke={colors.lo}
          strokeWidth="2.35"
        />
        <path
          d={`M ${leftEyeX + lensR * 0.92} ${rig.eyeY - 0.2} C ${50} ${rig.eyeY - 2.4} ${50} ${rig.eyeY - 2.4} ${rightEyeX - lensR * 0.92} ${rig.eyeY - 0.2}`}
          fill="none"
          stroke={colors.lo}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <ellipse
          cx={leftEyeX - lensR * 0.28}
          cy={rig.eyeY - lensR * 0.34}
          rx={lensR * 0.28}
          ry={lensR * 0.16}
          fill="#fff"
          opacity="0.62"
        />
        <circle cx={leftEyeX + lensR * 0.34} cy={rig.eyeY + lensR * 0.22} r={1.05} fill={colors.mid} opacity="0.55" />
        <circle cx={rightEyeX + lensR * 0.34} cy={rig.eyeY + lensR * 0.22} r={1.05} fill={colors.mid} opacity="0.55" />
      </AccessoryGroup>
    );
  }
  return (
    <>
      {flags.headphones ? (
        <AccessoryGroup
          testId="appendoo-headphones"
          className="appendoo-accessory-headphones"
          originX={50}
          originY={40}
          pose={mood.headphones}
        >
          <path
            d="M 27 54 Q 26 16 50 11 Q 74 16 73 54"
            fill="none"
            stroke={colors.lo}
            strokeWidth="5.6"
            strokeLinecap="round"
          />
          <path
            d="M 27 54 Q 26 16 50 11 Q 74 16 73 54"
            fill="none"
            stroke={colors.mid}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M 32 28 Q 50 18 68 28"
            fill="none"
            stroke={colors.hi}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.55"
          />
          <rect x="18.5" y="46" width="13.5" height="20" rx="6.4" fill={colors.lo} />
          <rect x="68" y="46" width="13.5" height="20" rx="6.4" fill={colors.lo} />
          <rect x="20.4" y="49" width="9.6" height="14.2" rx="4.8" fill={colors.mid} />
          <rect x="70" y="49" width="9.6" height="14.2" rx="4.8" fill={colors.mid} />
          <ellipse cx="25.2" cy="56.2" rx="3.4" ry="5.2" fill={colors.hi} />
          <ellipse cx="74.8" cy="56.2" rx="3.4" ry="5.2" fill={colors.hi} />
          <circle cx="25.2" cy="47.4" r="1.35" fill={colors.ink} opacity="0.45" />
          <circle cx="74.8" cy="47.4" r="1.35" fill={colors.ink} opacity="0.45" />
        </AccessoryGroup>
      ) : null}

      {flags.hat ? (
        <AccessoryGroup
          testId="appendoo-hat"
          className="appendoo-accessory-hat"
          originX={50}
          originY={26}
          pose={mood.hat}
        >
          <path
            d="M 31.2 28.6 C 31.6 12.4 40.4 6.2 50 6.2 C 59.6 6.2 68.4 12.4 68.8 28.6 Z"
            fill={colors.mid}
          />
          <path
            d="M 38 18 C 42 12.6 48 11.2 53.4 13.4"
            fill="none"
            stroke={colors.hi}
            strokeWidth="1.7"
            strokeLinecap="round"
            opacity="0.55"
          />
          <ellipse cx="50" cy="29.4" rx="20.6" ry="5.4" fill={colors.lo} />
          <ellipse cx="50" cy="27.8" rx="18.8" ry="3.4" fill={colors.mid} />
          <path
            d="M 34 28.4 H 66"
            fill="none"
            stroke={colors.ink}
            strokeWidth="0.7"
            opacity="0.22"
          />
          <path
            d="M 50 11.2 V 8.4"
            fill="none"
            stroke={colors.lo}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="50" cy="6.4" r="4.6" fill={colors.hi} />
          <circle cx="50" cy="6.4" r="3.2" fill={colors.mid} />
          <circle cx="48.6" cy="5.2" r="1.15" fill="#fff" opacity="0.55" />
        </AccessoryGroup>
      ) : null}
    </>
  );
};
