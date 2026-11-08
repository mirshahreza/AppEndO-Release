import React, { useId, useMemo } from 'react';
import { cn } from '../../../../lib/utils';
import type { AppendooCompanionFace } from './appendooCompanion.types';
import {
  appendooShapeShowsBody,
  mergeAppendooBodyRig,
  resolveAppendooBodyGeometry,
  resolveAppendooLeanPose,
  type AppendooBodyGeometry,
  type AppendooBodyRig,
} from './appendooBodyShape';
import { AppendooCompanionAccessories } from './AppendooCompanionAccessories';
import {
  mergeAppendooAccessories,
  resolveAppendooAccessoryPaint,
  type AppendooAccessoryFlags,
  type AppendooAccessoryMood,
  type AppendooAccessoryPaint,
} from './appendooAccessories';
import { useAppendooAccessories } from './useAppendooAccessories';
import {
  applyAppendooPointerLookToMood,
  type AppendooPointerLook,
} from './appendooPointerLook';
import {
  APPENDOO_DEFAULT_COLOR_MODE,
  appendooGelCssVars,
  resolveAppendooGelPalette,
  type AppendooColorMode,
  type AppendooGelPalette,
} from './appendooColor';
import { applyAppendooEmotionRim, type AppendooEmotionRim } from './appendooEmotionRim';
import { useAppendooEmotionRim } from './useAppendooEmotionRim';
import {
  appendooBrowPath,
  appendooClosedEyePath,
  appendooMouthPath,
  appendooNoseWrinklePath,
  resolveAppendooEyeCenter,
  resolveAppendooEyeOpen,
} from './appendooFaceGeometry';
import {
  COMPANION_FACE_TO_EMOTION,
  resolveAppendooFaceRig,
  type AppendooEmotionId,
  type AppendooFaceRig,
} from './appendooFaceRig';
import {
  APPENDOO_DEFAULT_LOOK,
  APPENDOO_LOOK_META,
  appendooLookShowsAccessories,
  appendooLookShowsGel,
  appendooLookUsesInkFace,
  type AppendooLookId,
} from './appendooLook';
import {
  mergeAppendooFaceParts,
  type AppendooFacePartFlags,
} from './appendooFaceParts';
import { AppendooCompanionLookPaint } from './AppendooCompanionLookPaint';
import {
  APPENDOO_SCHEMATIC_INK,
  APPENDOO_SCHEMATIC_LINE,
  APPENDOO_SCHEMATIC_SHADOW,
} from './appendooSchematic';
import './appendooCompanion.css';

export type AppendooCompanionFaceProps = {
  face?: AppendooCompanionFace;
  emotion?: AppendooEmotionId;
  blinking?: boolean;
  override?: Partial<AppendooFaceRig>;
  body?: Partial<AppendooBodyRig>;
  emotionMood?: AppendooEmotionRim;
  colorMode?: AppendooColorMode;
  gel?: AppendooGelPalette;
  accessories?: Partial<AppendooAccessoryFlags>;
  accessoryPaint?: AppendooAccessoryPaint;
  accessoryMood?: AppendooAccessoryMood;
  pointerLook?: AppendooPointerLook;
  followCssLook?: boolean;
  geometryOverride?: AppendooBodyGeometry;
  extrasOpacity?: number;
  morphTarget?: string;
  look?: AppendooLookId;
  parts?: Partial<AppendooFacePartFlags>;
  className?: string;
};

const Eye: React.FC<{ rig: AppendooFaceRig; side: 'left' | 'right'; ink?: boolean; glint?: boolean }> = ({
  rig,
  side,
  ink = false,
  glint = false,
}) => {
  const open = resolveAppendooEyeOpen(rig, side);
  const { x, y } = resolveAppendooEyeCenter(rig, side);
  if (open < 0.2) {
    return (
      <path
        d={appendooClosedEyePath(rig, side)}
        fill="none"
        strokeWidth={ink ? 2.85 : 2.25}
      />
    );
  }
  const rx = rig.eyeSize * (ink ? 0.88 : 0.82);
  const ry = rig.eyeSize * (0.72 + open * 0.42);
  if (ink) {
    return <ellipse cx={x} cy={y} rx={rx} ry={ry} />;
  }
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} />
      <ellipse
        cx={x - rx * 0.32}
        cy={y - ry * 0.38}
        rx={rx * (glint ? 0.28 : 0.32)}
        ry={ry * (glint ? 0.3 : 0.34)}
        fill="#fff"
        stroke="none"
      />
      {glint ? (
        <ellipse
          cx={x + rx * 0.22}
          cy={y + ry * 0.18}
          rx={rx * 0.12}
          ry={ry * 0.14}
          fill="#fff"
          stroke="none"
          opacity="0.72"
        />
      ) : null}
    </g>
  );
};

const BlushMarks: React.FC<{ rig: AppendooFaceRig }> = ({ rig }) => (
  <g data-testid="appendoo-blush">
    <ellipse
      cx={50 - rig.eyeGap * 0.8}
      cy={rig.eyeY + 10.5}
      rx="9"
      ry="6.5"
      fill="var(--appendoo-blush)"
      opacity={rig.blush}
    />
    <ellipse
      cx={50 + rig.eyeGap * 0.84}
      cy={rig.eyeY + 8.8}
      rx="8.5"
      ry="6"
      fill="var(--appendoo-blush)"
      opacity={rig.blush}
    />
  </g>
);

export const AppendooCompanionFace: React.FC<AppendooCompanionFaceProps> = ({
  face,
  emotion,
  blinking = false,
  override,
  body,
  emotionMood,
  colorMode = APPENDOO_DEFAULT_COLOR_MODE,
  gel,
  accessories,
  accessoryPaint,
  accessoryMood,
  pointerLook,
  followCssLook = true,
  geometryOverride,
  extrasOpacity = 1,
  morphTarget,
  look = APPENDOO_DEFAULT_LOOK,
  parts,
  className,
}) => {
  const rawId = useId().replace(/:/g, '');
  const glassId = `appendoo-glass-${rawId}`;
  const innerId = `appendoo-inner-${rawId}`;
  const shineId = `appendoo-shine-${rawId}`;
  const causticId = `appendoo-caustic-${rawId}`;
  const frostId = `appendoo-frost-${rawId}`;
  const clipId = `appendoo-clip-${rawId}`;
  const haloId = `appendoo-halo-${rawId}`;
  const mergeId = `appendoo-merge-${rawId}`;
  const mistId = `appendoo-mist-${rawId}`;
  const castId = `appendoo-cast-${rawId}`;
  const resolvedEmotion = emotion ?? (face ? COMPANION_FACE_TO_EMOTION[face] : 'neutral');
  const hookedMood = useAppendooEmotionRim(resolvedEmotion);
  const rimMood = emotionMood ?? hookedMood;
  const hookedAccessories = useAppendooAccessories(resolvedEmotion);
  const accessoryFlags = mergeAppendooAccessories(accessories);
  const accessoryPoses = accessoryMood ?? hookedAccessories;
  const liveAccessories = pointerLook
    ? applyAppendooPointerLookToMood(accessoryPoses, pointerLook)
    : accessoryPoses;
  const bodyRig = useMemo(
    () => applyAppendooEmotionRim(mergeAppendooBodyRig(body), rimMood),
    [body, rimMood],
  );
  const resolvedGeometry = useMemo(() => resolveAppendooBodyGeometry(bodyRig), [bodyRig]);
  const geometry = geometryOverride ?? resolvedGeometry;
  const showsBody = appendooShapeShowsBody(bodyRig.shape) || geometryOverride != null;
  const rig = useMemo(
    () => resolveAppendooFaceRig({
      emotion: resolvedEmotion,
      blinking,
      layout: geometry.face,
      override,
    }),
    [blinking, geometry.face, override, resolvedEmotion],
  );
  const resolvedGel = gel ?? resolveAppendooGelPalette({ mode: colorMode, shape: bodyRig.shape });
  const resolvedAccessoryPaint = accessoryPaint ?? resolveAppendooAccessoryPaint();
  const showsGel = appendooLookShowsGel(look);
  const showsAccessories = appendooLookShowsAccessories(look);
  const inkFace = appendooLookUsesInkFace(look);
  const faceParts = mergeAppendooFaceParts(parts);
  const lookMeta = APPENDOO_LOOK_META[look];
  const lookStyle = {
    ...appendooGelCssVars(resolvedGel),
    ...(pointerLook
      ? {
        '--appendoo-look-x': String(pointerLook.lookX),
        '--appendoo-look-y': String(pointerLook.lookY),
      }
      : followCssLook
        ? {}
        : {
          '--appendoo-look-x': String(rig.lookX),
          '--appendoo-look-y': String(rig.lookY),
        }),
    '--appendoo-trim-motion': String(bodyRig.trimMotion),
    '--appendoo-rim-mood-x': String(rimMood.rimShiftX * 2.4),
    '--appendoo-rim-mood-y': String(rimMood.rimShiftY * 2.4),
    '--appendoo-rim-mood-rot': String(rimMood.rimAsym * 2.6),
    ...(inkFace
      ? {
        '--appendoo-ink': APPENDOO_SCHEMATIC_INK,
        '--appendoo-spark': APPENDOO_SCHEMATIC_INK,
        '--appendoo-schematic': APPENDOO_SCHEMATIC_LINE,
      }
      : {}),
  } as React.CSSProperties;
  const trimLive = showsGel && bodyRig.trimMotion > 0.05;
  const castShadow = inkFace ? APPENDOO_SCHEMATIC_SHADOW : resolvedGel.shadow;
  const castNear = inkFace ? 0.3 : 0.22;
  const castFar = inkFace ? 0.16 : 0.1;
  const browWidth = inkFace
    ? rig.browWeight * (look === 'woodcut' ? 1.55 : look === 'charcoal' ? 1.45 : look === 'graphite' ? 1.22 : 1.35)
    : look === 'realistic' ? rig.browWeight * 1.08 : rig.browWeight;
  const mouthWidth = inkFace
    ? (look === 'woodcut' ? 2.7 : 2.45) + rig.mouthOpen * 0.55
    : (look === 'realistic' ? 1.85 : 1.7) + rig.mouthOpen * 0.4;
  const leanPose = resolveAppendooLeanPose(bodyRig.lean);
  const leanTransform = leanPose.rotate !== 0
    ? `rotate(${leanPose.rotate.toFixed(2)} 50 96)`
    : undefined;

  return (
    <svg
      className={cn(
        'appendoo-companion-stage',
        look === 'contour' && 'is-schematic',
        inkFace && 'is-ink-face',
        className,
      )}
      viewBox="0 0 100 112"
      aria-hidden="true"
      focusable="false"
      data-emotion={resolvedEmotion}
      data-shape={bodyRig.shape}
      data-color-mode={colorMode}
      data-accessory-paint={resolvedAccessoryPaint.id}
      data-follow-pointer={pointerLook ? 'on' : 'off'}
      data-morph-target={morphTarget ?? 'none'}
      data-look={look}
      data-look-family={lookMeta.family}
      data-wonk={String(bodyRig.wonk)}
      data-wonk-scatter={bodyRig.wonkScatter ? 'on' : 'off'}
      data-wonk-seed={String(bodyRig.wonkSeed)}
      data-lean={bodyRig.lean}
      data-testid="appendoo-companion-stage"
      style={lookStyle}
    >
      <defs>
        {showsGel && showsBody ? (
          <>
        <linearGradient id={glassId} x1="32%" y1="6%" x2="78%" y2="94%" data-testid="appendoo-glass">
          <stop offset="0%" stopColor={resolvedGel.hi} />
          <stop offset="46%" stopColor={resolvedGel.mid} />
          <stop offset="100%" stopColor={resolvedGel.lo} />
        </linearGradient>
        <radialGradient id={innerId} cx="42%" cy="38%" r="58%">
          <stop offset="0%" stopColor={resolvedGel.glow} stopOpacity="0.55" />
          <stop offset="62%" stopColor={resolvedGel.mid} stopOpacity="0.12" />
          <stop offset="100%" stopColor={resolvedGel.lo} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={shineId} cx="30%" cy="24%" r="38%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="42%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={causticId} cx="72%" cy="70%" r="34%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={frostId} x="-12%" y="-12%" width="124%" height="124%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={haloId} x="-28%" y="-28%" width="156%" height="156%">
          <feGaussianBlur stdDeviation={1.7 + bodyRig.rimWeight * 0.5} />
        </filter>
        <filter id={mergeId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.75" />
        </filter>
        <filter id={mistId} x="-24%" y="-24%" width="148%" height="148%">
          <feGaussianBlur stdDeviation="0.95" />
        </filter>
        <clipPath id={clipId}>
          <path d={geometry.bodyPath} />
          {geometry.extras.filter((extra) => extra.kind === 'glass').map((extra) => (
            <path key={extra.id} d={extra.d} />
          ))}
        </clipPath>
          </>
        ) : null}
        <filter
          id={castId}
          x="-32%"
          y="-8%"
          width="164%"
          height="152%"
          colorInterpolationFilters="sRGB"
        >
          <feOffset in="SourceAlpha" dx="0" dy="1.5" result="offA" />
          <feGaussianBlur in="offA" stdDeviation="1.05" result="blurA" />
          <feFlood floodColor={castShadow} floodOpacity={castNear} result="colA" />
          <feComposite in="colA" in2="blurA" operator="in" result="castA" />
          <feOffset in="SourceAlpha" dx="0" dy="3.6" result="offB" />
          <feGaussianBlur in="offB" stdDeviation="2.4" result="blurB" />
          <feFlood floodColor={castShadow} floodOpacity={castFar} result="colB" />
          <feComposite in="colB" in2="blurB" operator="in" result="castB" />
          <feMerge>
            <feMergeNode in="castB" />
            <feMergeNode in="castA" />
          </feMerge>
        </filter>
      </defs>

      <g className="appendoo-companion-breathe">
      <g transform={leanTransform} data-testid="appendoo-lean">
        {showsBody ? (
        <g
          className="appendoo-companion-cast"
          filter={`url(#${castId})`}
          data-testid="appendoo-cast"
        >
          <path d={geometry.bodyPath} fill="#1a120e" />
          {!showsGel ? null : geometry.extras.filter((extra) => extra.kind === 'glass').map((extra) => (
            <path key={`cast-${extra.id}`} d={extra.d} fill="#1a120e" opacity={extrasOpacity} />
          ))}
        </g>
        ) : null}
        {!showsBody ? (
          showsGel && faceParts.blush ? <BlushMarks rig={rig} /> : null
        ) : look === 'contour' ? (
          <path
            className="appendoo-companion-schematic-stroke"
            data-testid="appendoo-schematic"
            d={geometry.schematicPath}
            fill={APPENDOO_SCHEMATIC_LINE}
            fillRule="evenodd"
          />
        ) : look !== 'candy' ? (
          <AppendooCompanionLookPaint look={look} geometry={geometry} gel={resolvedGel} showBlush={faceParts.blush} />
        ) : (
          <>
        <g
          className={cn('appendoo-companion-rim-mood', 'appendoo-companion-rim-spin', trimLive && 'is-live')}
          filter={`url(#${haloId})`}
          opacity={0.28 + bodyRig.rimWeight * 0.06}
          data-testid="appendoo-rim"
        >
          <path d={geometry.rimPath} fill="var(--appendoo-glass-rim)" />
          {geometry.extras.filter((extra) => extra.kind === 'glass').map((extra) => (
            <path key={`halo-${extra.id}`} d={extra.d} fill="var(--appendoo-glass-rim)" opacity={extrasOpacity} />
          ))}
        </g>
        <g filter={`url(#${mergeId})`}>
          <path className="appendoo-companion-glass" d={geometry.bodyPath} fill={`url(#${glassId})`} fillOpacity="0.92" />
          {geometry.extras.filter((extra) => extra.kind === 'glass').map((extra) => (
            <path
              key={`glass-${extra.id}`}
              className={cn('appendoo-companion-glass', extra.className, trimLive && 'is-live')}
              data-testid={extra.id}
              d={extra.d}
              fill={`url(#${glassId})`}
              fillOpacity={0.92 * extrasOpacity}
            />
          ))}
          <g clipPath={`url(#${clipId})`}>
            <rect width="100" height="112" fill={`url(#${innerId})`} />
            <ellipse
              className={cn('appendoo-companion-trim-shine', trimLive && 'is-live')}
              cx={geometry.shine.cx}
              cy={geometry.shine.cy}
              rx={geometry.shine.rx}
              ry={geometry.shine.ry}
              fill={`url(#${shineId})`}
              filter={`url(#${frostId})`}
            />
            <ellipse
              className={cn('appendoo-companion-trim-caustic', trimLive && 'is-live')}
              cx={geometry.caustic.cx}
              cy={geometry.caustic.cy}
              rx={geometry.caustic.rx}
              ry={geometry.caustic.ry}
              fill={`url(#${causticId})`}
              filter={`url(#${frostId})`}
            />
            {faceParts.blush ? <BlushMarks rig={rig} /> : null}
          </g>
        </g>
        <g opacity={extrasOpacity}>
        {geometry.extras.filter((extra) => extra.kind !== 'glass').map((extra) => {
          const originStyle = extra.originX != null && extra.originY != null
            ? { transformOrigin: `${extra.originX}px ${extra.originY}px` } as React.CSSProperties
            : undefined;
          if (extra.kind === 'leaf' || extra.kind === 'accent') {
            return (
              <path
                key={extra.id}
                className={cn(extra.className, trimLive && 'is-live')}
                data-testid={extra.id}
                d={extra.d}
                stroke="none"
                filter={`url(#${mistId})`}
                style={originStyle}
              />
            );
          }
          return (
            <path
              key={extra.id}
              className={cn(extra.className, trimLive && 'is-live')}
              data-testid={extra.id}
              d={extra.d}
              fill="none"
              stroke="var(--appendoo-ink)"
              strokeWidth={extra.kind === 'groove' ? 2.4 : 2.1}
              strokeLinecap="round"
              opacity={extra.kind === 'groove' ? 0.18 : 0.38}
              filter={`url(#${mistId})`}
            />
          );
        })}
        </g>
          </>
        )}

        {!showsAccessories ? null : (
          <AppendooCompanionAccessories
            slot="crown"
            flags={accessoryFlags}
            mood={liveAccessories}
            rig={rig}
            paint={resolvedAccessoryPaint}
          />
        )}

        <g
          className={cn('appendoo-companion-ink', inkFace && 'is-schematic')}
          stroke="var(--appendoo-ink)"
          fill="var(--appendoo-ink)"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {faceParts.brows ? (
            <>
          <path
            data-testid="appendoo-brow-left"
            d={appendooBrowPath(rig, 'left')}
            fill="none"
            strokeWidth={browWidth}
          />
          <path
            data-testid="appendoo-brow-right"
            d={appendooBrowPath(rig, 'right')}
            fill="none"
            strokeWidth={browWidth}
          />
            </>
          ) : null}
          {faceParts.nose && rig.noseWrinkle > 0.12 ? (
            <path
              data-testid="appendoo-nose-wrinkle"
              d={appendooNoseWrinklePath(rig)}
              fill="none"
              strokeWidth={inkFace ? 1.55 : 1.15}
              opacity={inkFace ? 0.72 + rig.noseWrinkle * 0.28 : 0.28 + rig.noseWrinkle * 0.5}
            />
          ) : null}
          {faceParts.eyes ? (
          <g className="appendoo-companion-look" data-testid="appendoo-eyes">
            <Eye rig={rig} side="left" ink={inkFace} glint={look === 'realistic'} />
            <Eye rig={rig} side="right" ink={inkFace} glint={look === 'realistic'} />
          </g>
          ) : null}
          {faceParts.mouth ? (
            <>
          <path
            data-testid="appendoo-mouth"
            d={appendooMouthPath(rig)}
            fill="none"
            strokeWidth={mouthWidth}
          />
          {rig.mouthOpen > 0.12 ? (
            <ellipse
              cx={50 + rig.mouthAsym * 1.4}
              cy={rig.mouthY + 1.4 + rig.mouthOpen * 1.8}
              rx={Math.max(1.1, rig.mouthWidth * 0.22)}
              ry={1.1 + rig.mouthOpen * 2.4}
              stroke="none"
            />
          ) : null}
            </>
          ) : null}
        </g>

        {!showsAccessories ? null : (
          <AppendooCompanionAccessories
            slot="lenses"
            flags={accessoryFlags}
            mood={liveAccessories}
            rig={rig}
            paint={resolvedAccessoryPaint}
          />
        )}

        <g transform="translate(78 18)">
          <g className="appendoo-companion-spark" opacity={faceParts.spark && rig.spark ? 1 : 0}>
            <path d="M0-5.4.9-1.1 5.4 0 .9 1.1 0 5.4-1-1.1-5.4 0-1-1.1Z" fill="var(--appendoo-spark)" />
          </g>
        </g>
        <text
          className="appendoo-companion-zzz"
          opacity={faceParts.zzz && rig.zzz ? 1 : 0}
          x="70"
          y="22"
          fill="var(--appendoo-ink)"
          fontSize="8"
          fontWeight="700"
          fontFamily="ui-rounded, 'Trebuchet MS', sans-serif"
        >
          zzz
        </text>
      </g>
      </g>
      <desc>{`${lookMeta.label} ${bodyRig.shape} ${resolvedEmotion}`}</desc>
    </svg>
  );
};
