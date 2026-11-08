import React, { useId } from 'react';
import type { AppendooBodyGeometry } from './appendooBodyShape';
import type { AppendooGelPalette } from './appendooColor';
import type { AppendooLookId } from './appendooLook';

export type AppendooCompanionLookPaintProps = {
  look: AppendooLookId;
  geometry: AppendooBodyGeometry;
  gel: AppendooGelPalette;
  showBlush?: boolean;
};

export const AppendooCompanionLookPaint: React.FC<AppendooCompanionLookPaintProps> = ({
  look,
  geometry,
  gel,
  showBlush = true,
}) => {
  const rawId = useId().replace(/:/g, '');
  const clipId = `appendoo-look-clip-${rawId}`;
  const grainId = `appendoo-look-grain-${rawId}`;
  const edgeId = `appendoo-look-edge-${rawId}`;
  const washId = `appendoo-look-wash-${rawId}`;
  const poolId = `appendoo-look-pool-${rawId}`;
  const graphiteId = `appendoo-look-graphite-${rawId}`;
  const smudgeId = `appendoo-look-smudge-${rawId}`;
  const skinId = `appendoo-look-skin-${rawId}`;

  if (look === 'candy' || look === 'contour') return null;

  const isGraphite = look === 'graphite';
  const isReal = look === 'realistic';
  const grainStrength = isReal ? 0.13 : isGraphite ? 0.42 : look === 'charcoal' ? 0.46 : look === 'sumi' ? 0.3 : look === 'pastel' ? 0.22 : look === 'wash' ? 0.16 : 0.07;
  const edgeDisplace = isGraphite ? 1.5 : look === 'sumi' ? 4.6 : look === 'wash' ? 3.1 : look === 'pastel' ? 1.8 : look === 'charcoal' ? 2.2 : 0;
  const edgeFreq = isGraphite ? 0.035 : look === 'sumi' ? 0.09 : look === 'charcoal' ? 0.07 : 0.045;
  const grainFreq = isReal ? '1.42 1.18' : isGraphite ? '0.92 0.16' : '0.85';
  const grainOctaves = isReal ? 4 : isGraphite ? 2 : 3;

  return (
    <g data-testid="appendoo-look-paint">
      <defs>
        <clipPath id={clipId}>
          <path d={geometry.bodyPath} />
        </clipPath>
        <filter id={grainId} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={grainFreq} numOctaves={grainOctaves} seed={isReal ? 11 : isGraphite ? 6 : 4} result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
          <feComponentTransfer in="gray" result="soft">
            <feFuncA type="linear" slope={grainStrength} />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="soft" mode="multiply" />
        </filter>
        {isGraphite || isReal ? (
          <>
            {isGraphite ? (
              <radialGradient id={graphiteId} cx="32%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#fbfaf7" stopOpacity="1" />
                <stop offset="38%" stopColor="#c8c4be" stopOpacity="0.55" />
                <stop offset="72%" stopColor="#4a4743" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#121110" stopOpacity="0.92" />
              </radialGradient>
            ) : (
              <radialGradient id={skinId} cx="34%" cy="28%" r="76%">
                <stop offset="0%" stopColor={gel.hi} stopOpacity="1" />
                <stop offset="28%" stopColor={gel.glow} stopOpacity="0.88" />
                <stop offset="58%" stopColor={gel.mid} stopOpacity="0.78" />
                <stop offset="100%" stopColor={gel.lo} stopOpacity="0.96" />
              </radialGradient>
            )}
            <filter id={smudgeId} x="-14%" y="-14%" width="128%" height="128%" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation={isReal ? '2.15' : '1.35'} />
            </filter>
          </>
        ) : null}
        {edgeDisplace > 0 ? (
          <filter id={edgeId} x="-18%" y="-18%" width="136%" height="136%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency={edgeFreq} numOctaves="2" seed="9" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale={edgeDisplace} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        ) : null}
        <radialGradient id={washId} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor={gel.hi} stopOpacity="0.9" />
          <stop offset="48%" stopColor={gel.mid} stopOpacity="0.55" />
          <stop offset="100%" stopColor={gel.lo} stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id={poolId} cx="58%" cy="86%" r="52%">
          <stop offset="0%" stopColor={look === 'sumi' ? '#1a1816' : gel.lo} stopOpacity={look === 'sumi' ? 0.82 : 0.5} />
          <stop offset="100%" stopColor={gel.lo} stopOpacity="0" />
        </radialGradient>
      </defs>

      <g filter={edgeDisplace > 0 ? `url(#${edgeId})` : undefined}>
        {look === 'wash' ? (
          <g clipPath={`url(#${clipId})`} filter={`url(#${grainId})`}>
            <path d={geometry.bodyPath} fill={gel.mid} fillOpacity="0.62" />
            <rect width="100" height="112" fill={`url(#${washId})`} />
            <ellipse cx="34" cy="38" rx="18" ry="14" fill={gel.hi} opacity="0.42" />
            <ellipse cx="68" cy="78" rx="22" ry="16" fill={gel.lo} opacity="0.34" />
            <ellipse cx="52" cy="58" rx="16" ry="12" fill={gel.glow} opacity="0.22" />
          </g>
        ) : null}

        {look === 'gouache' ? (
          <g clipPath={`url(#${clipId})`} filter={`url(#${grainId})`}>
            <path d={geometry.bodyPath} fill={gel.mid} />
            <ellipse cx="50" cy="88" rx="28" ry="16" fill={gel.lo} opacity="0.38" />
            <ellipse cx="36" cy="40" rx="14" ry="10" fill={gel.hi} opacity="0.22" />
          </g>
        ) : null}

        {look === 'sumi' ? (
          <g clipPath={`url(#${clipId})`} filter={`url(#${grainId})`}>
            <path d={geometry.bodyPath} fill="#d8d0c6" />
            <rect width="100" height="112" fill={`url(#${poolId})`} />
            <ellipse cx="48" cy="36" rx="22" ry="16" fill="#f3eee6" opacity="0.55" />
            <ellipse cx="62" cy="82" rx="24" ry="18" fill="#1c1916" opacity="0.72" />
          </g>
        ) : null}

        {look === 'charcoal' ? (
          <g clipPath={`url(#${clipId})`} filter={`url(#${grainId})`}>
            <path d={geometry.bodyPath} fill="#7a736c" />
            <ellipse cx="58" cy="70" rx="26" ry="22" fill="#4a453f" opacity="0.45" />
            <ellipse cx="34" cy="42" rx="16" ry="12" fill="#cfc8c0" opacity="0.28" />
          </g>
        ) : null}

        {look === 'graphite' ? (
          <g clipPath={`url(#${clipId})`} filter={`url(#${grainId})`}>
            <path d={geometry.bodyPath} fill="#eceae6" />
            <rect width="100" height="112" fill={`url(#${graphiteId})`} />
            <g filter={`url(#${smudgeId})`}>
              <ellipse cx="68" cy="82" rx="30" ry="24" fill="#141312" opacity="0.82" />
              <ellipse cx="58" cy="64" rx="20" ry="18" fill="#2e2c29" opacity="0.4" />
              <ellipse cx="34" cy="34" rx="22" ry="16" fill="#f7f5f1" opacity="0.7" />
            </g>
            <ellipse cx="28" cy="26" rx="8" ry="6" fill="#fff" opacity="0.62" />
          </g>
        ) : null}

        {look === 'realistic' ? (
          <g clipPath={`url(#${clipId})`} filter={`url(#${grainId})`}>
            <path d={geometry.bodyPath} fill={gel.mid} />
            <rect width="100" height="112" fill={`url(#${skinId})`} />
            <g filter={`url(#${smudgeId})`}>
              <ellipse cx="36" cy="34" rx="26" ry="20" fill={gel.hi} opacity="0.55" />
              <ellipse cx="48" cy="52" rx="22" ry="18" fill={gel.glow} opacity="0.38" />
              <ellipse cx="70" cy="78" rx="28" ry="22" fill={gel.lo} opacity="0.48" />
              <ellipse cx="52" cy="94" rx="24" ry="12" fill={gel.lo} opacity="0.34" />
              {showBlush ? (
                <>
              <ellipse cx="32" cy="64" rx="11" ry="8" fill={gel.blush} opacity="0.32" />
              <ellipse cx="68" cy="64" rx="11" ry="8" fill={gel.blush} opacity="0.28" />
                </>
              ) : null}
            </g>
            <ellipse cx="30" cy="26" rx="7" ry="5" fill="#fff" opacity="0.38" />
          </g>
        ) : null}

        {look === 'woodcut' ? (
          <g clipPath={`url(#${clipId})`}>
            <path d={geometry.bodyPath} fill={gel.lo} />
            <path d={geometry.innerTrimPath} fill={gel.mid} />
          </g>
        ) : null}

        {look === 'pastel' ? (
          <g clipPath={`url(#${clipId})`} filter={`url(#${grainId})`}>
            <path d={geometry.bodyPath} fill={gel.hi} />
            <ellipse cx="62" cy="72" rx="24" ry="18" fill={gel.mid} opacity="0.55" />
            <ellipse cx="32" cy="44" rx="16" ry="12" fill={gel.glow} opacity="0.4" />
          </g>
        ) : null}
      </g>
    </g>
  );
};
