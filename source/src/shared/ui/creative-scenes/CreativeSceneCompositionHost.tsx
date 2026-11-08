import React from 'react';
import { CreativeMotionProvider } from '../motion-runtime';
import { CreativeSceneRenderer } from './renderers';
import type { CreativeSceneHostProps } from './types';
import { validateCreativeSceneHost } from './validation';

export function CreativeSceneCompositionHost({
  scenes,
  experienceMode,
  capabilities = {},
  className,
  children,
}: CreativeSceneHostProps) {
  const validation = validateCreativeSceneHost(scenes, experienceMode);
  const acceptedScenes = validation.valid ? scenes : [];
  const viewport = capabilities.viewport ?? 'desktop';

  return (
    <CreativeMotionProvider
      experienceMode={experienceMode}
      viewport={viewport}
      paused={capabilities.visible === false}
    >
      <div
        className={className}
        data-creative-scene-composition-host=""
        data-scene-count={acceptedScenes.length}
        data-invalid-scene-count={validation.valid ? undefined : scenes.length}
      >
        {acceptedScenes.map((config) => (
          <CreativeSceneRenderer
            key={config.instanceId}
            config={config}
            capabilities={capabilities}
          />
        ))}
        {children}
        {!validation.valid ? (
          <p role="status" className="sr-only">
            Creative scene configuration could not be rendered.
          </p>
        ) : null}
      </div>
    </CreativeMotionProvider>
  );
}

export const CreativeScenesHost = CreativeSceneCompositionHost;
