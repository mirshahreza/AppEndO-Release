import React, { useEffect, useRef } from 'react';

import { mountLoadingEcgCanvas } from '../shared/lib/loadingEcgCanvasMount';

export const LoadingEcgTrace: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    return mountLoadingEcgCanvas(canvas);
  }, []);

  return <canvas ref={canvasRef} className="app-loading-ecg-live" aria-hidden />;
};
