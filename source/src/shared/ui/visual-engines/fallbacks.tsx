import React from 'react';
import type { CSSProperties } from 'react';
import type { CreativeFallbackReason, VisualEngineConfig } from './types';

function random(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

export function seededCoordinates(seed: number, count: number): readonly { x: number; y: number; size: number }[] {
  const next = random(seed);
  return Array.from({ length: count }, () => ({
    x: Number((next() * 100).toFixed(3)),
    y: Number((next() * 100).toFixed(3)),
    size: Number((0.4 + next() * 1.6).toFixed(3)),
  }));
}

const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

function Poster({
  src,
  alt,
  callouts,
}: {
  src: string;
  alt: string;
  callouts: readonly { id: string; label: string; body?: string; x: number; y: number }[];
}) {
  return (
    <>
      <img src={src} alt={alt} loading="lazy" decoding="async" style={{ ...fill, objectFit: 'cover' }} />
      {callouts.length > 0 && (
        <ul data-creative-semantic-callouts="">
          {callouts.map((callout) => (
            <li key={callout.id} style={{ position: 'absolute', left: `${callout.x}%`, top: `${callout.y}%` }}>
              <strong>{callout.label}</strong>
              {callout.body && <span>{callout.body}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function VisualEngineFallback({
  config,
  reason,
}: {
  config: VisualEngineConfig;
  reason?: CreativeFallbackReason;
}) {
  let content: React.ReactNode;
  switch (config.engineId) {
    case 'canvas-particle-system': {
      const points = seededCoordinates(config.seed, config.particleCount);
      content = (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={fill}>
          {points.slice(1, config.linkCount + 1).map((point, index) => (
            <line key={`l-${index}`} x1={points[index].x} y1={points[index].y} x2={point.x} y2={point.y} stroke={config.color} strokeWidth=".08" opacity=".2" />
          ))}
          {points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={point.size * config.radius * 0.12} fill={config.color} />
          ))}
        </svg>
      );
      break;
    }
    case 'canvas-vector-field': {
      const points = seededCoordinates(config.seed, config.columns * config.rows);
      content = (
        <svg viewBox={`0 0 ${config.columns} ${config.rows}`} preserveAspectRatio="none" aria-hidden="true" style={fill}>
          {points.map((point, index) => {
            const x = index % config.columns;
            const y = Math.floor(index / config.columns);
            const angle = ((point.x + point.y) / 200) * Math.PI * 2;
            return <line key={index} x1={x} y1={y} x2={x + Math.cos(angle) * 0.7} y2={y + Math.sin(angle) * 0.7} stroke={config.color} strokeWidth=".08" />;
          })}
        </svg>
      );
      break;
    }
    case 'three-product-stage':
      content = <Poster src={config.posterAsset} alt="Product preview" callouts={config.callouts} />;
      break;
    case 'three-model-orbit':
      content = <Poster src={config.posterAsset} alt="Canonical model view" callouts={config.annotations} />;
      break;
    case 'three-spatial-gallery':
      content = (
        <ul data-creative-gallery-fallback="">
          {config.images.map((image) => <li key={image.id}><img src={image.assetRef} alt={image.alt} loading="lazy" decoding="async" /></li>)}
        </ul>
      );
      break;
    case 'three-data-constellation':
      content = (
        <ul data-creative-constellation-fallback="">
          {config.nodes.map((node) => <li key={node.id}><span>{node.label}</span><strong>{node.value}</strong></li>)}
        </ul>
      );
      break;
    case 'shader-image-reveal':
      content = <img src={config.imageAsset} alt={config.alt} loading="lazy" decoding="async" style={{ ...fill, objectFit: 'cover' }} />;
      break;
    case 'shader-ambient-field':
      content = <div aria-hidden="true" style={{ ...fill, background: `linear-gradient(135deg,${config.uniforms.colorA},${config.uniforms.colorB})` }} />;
  }
  return (
    <div data-visual-engine-fallback={config.engineId} data-fallback-reason={reason} style={{ position: 'relative', minHeight: 'inherit' }}>
      {content}
    </div>
  );
}
