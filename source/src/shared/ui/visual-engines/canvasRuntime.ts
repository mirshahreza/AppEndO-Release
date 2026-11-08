import { seededCoordinates } from './fallbacks';
import type { EngineMount, EngineMountOptions } from './types';

function boundedSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  requestedDpr: number,
  maxPixels: number,
) {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const pixelRatio = Math.min(requestedDpr, Math.sqrt(maxPixels / (safeWidth * safeHeight)));
  canvas.width = Math.max(1, Math.floor(safeWidth * pixelRatio));
  canvas.height = Math.max(1, Math.floor(safeHeight * pixelRatio));
  canvas.style.width = `${safeWidth}px`;
  canvas.style.height = `${safeHeight}px`;
  return pixelRatio;
}

export function mountVisualEngine({
  canvas,
  config,
  capability,
  paused: initiallyPaused,
}: EngineMountOptions): EngineMount | null {
  if (config.engineId !== 'canvas-particle-system' && config.engineId !== 'canvas-vector-field') return null;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;
  let paused = initiallyPaused;
  let disposed = false;
  let frame = 0;
  let width = 1;
  let height = 1;
  let dpr = 1;
  let startedAt = performance.now();

  const draw = (now = startedAt) => {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = config.background;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = config.color;
    context.fillStyle = config.color;
    if (config.engineId === 'canvas-particle-system') {
      const points = seededCoordinates(config.seed, config.particleCount);
      const drift = ((now - startedAt) / 1000) * config.speed;
      const placed = points.map((point, index) => ({
        x: ((point.x / 100) * width + Math.sin(drift + index) * 6 + width) % width,
        y: ((point.y / 100) * height + Math.cos(drift * 0.7 + index) * 6 + height) % height,
        size: point.size,
      }));
      context.globalAlpha = 0.18;
      for (let index = 1; index <= config.linkCount && index < placed.length; index += 1) {
        context.beginPath();
        context.moveTo(placed[index - 1].x, placed[index - 1].y);
        context.lineTo(placed[index].x, placed[index].y);
        context.stroke();
      }
      context.globalAlpha = 0.8;
      for (const point of placed) {
        context.beginPath();
        context.arc(point.x, point.y, point.size * config.radius, 0, Math.PI * 2);
        context.fill();
      }
    } else {
      context.globalAlpha = 0.68;
      const cellX = width / config.columns;
      const cellY = height / config.rows;
      for (let row = 0; row < config.rows; row += 1) {
        for (let column = 0; column < config.columns; column += 1) {
          const x = (column + 0.5) * cellX;
          const y = (row + 0.5) * cellY;
          let angle = Math.sin(column * 0.41 + row * 0.27 + config.seed + (now - startedAt) / 4000);
          for (const force of config.forces) {
            const dx = x / width - force.x;
            const dy = y / height - force.y;
            const distance = Math.max(0.001, Math.hypot(dx, dy));
            if (distance < force.radius) angle += Math.atan2(dy, dx) * force.strength * (1 - distance / force.radius);
          }
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + Math.cos(angle) * config.lineLength, y + Math.sin(angle) * config.lineLength);
          context.stroke();
        }
      }
    }
  };

  const loop = (now: number) => {
    if (disposed || paused) return;
    draw(now);
    frame = requestAnimationFrame(loop);
  };
  const restart = () => {
    cancelAnimationFrame(frame);
    if (!paused && !disposed) frame = requestAnimationFrame(loop);
  };

  return {
    setPaused(next) {
      paused = next;
      if (paused) cancelAnimationFrame(frame);
      else restart();
    },
    resize(nextWidth, nextHeight, requestedDpr) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      dpr = boundedSize(canvas, width, height, Math.min(requestedDpr, capability.dpr), capability.maxBackingPixels);
      draw();
      restart();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}
