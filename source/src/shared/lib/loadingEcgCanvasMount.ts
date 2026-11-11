import {
  EkgWaveform,
  randomEkgBeatRuntime,
  randomEkgPostBeatGap,
  randomEkgPreBeatGap,
  randomEkgWaveformOptions,
} from './biomedEkgWaveform';

/** Fixed vertical scale — baseline stays centered; only deflections move. */
const DISPLAY_BASELINE = 150;
const Y_HALF_SPAN = 1.62;
/** Legacy bar cap (4.25rem @ 16px); taller bar adds headroom, not bigger deflection. */
const ECG_BAR_REF_HEIGHT_CSS_PX = 68;
/** Scales trace deflection only (bar/canvas CSS size unchanged). Legacy 0.46; tuned down for overflow:hidden. */
const TRACE_AMP_FRACTION = 0.38;

function readTraceStroke(root: Element): string {
  const style = getComputedStyle(root);
  return style.getPropertyValue('--app-accent-600').trim()
    || style.getPropertyValue('--app-accent-700').trim()
    || style.getPropertyValue('--app-route-loading-accent').trim()
    || style.getPropertyValue('--app-accent-500').trim()
    || '#008f7a';
}

function resizeCanvas(canvas: HTMLCanvasElement): { width: number; height: number; cssHeight: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, cssHeight: rect.height };
}

function valueToPixel(value: number, height: number, cssHeight: number): number {
  const delta = value - DISPLAY_BASELINE;
  const dpr = cssHeight > 0 ? height / cssHeight : 1;
  const refHeightDevice = ECG_BAR_REF_HEIGHT_CSS_PX * dpr;
  return height * 0.5 - (delta / Y_HALF_SPAN) * (refHeightDevice * TRACE_AMP_FRACTION);
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  samples: number[],
  stroke: string,
  width: number,
  height: number,
  cssHeight: number,
): void {
  ctx.clearRect(0, 0, width, height);

  const len = samples.length;
  if (len < 2) {
    return;
  }

  ctx.beginPath();
  for (let x = 0; x < len; x += 1) {
    const y = valueToPixel(samples[x]!, height, cssHeight);
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.lineWidth = 1.15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.shadowBlur = 0;
  ctx.stroke();
}

function beginNewBeat(waveform: EkgWaveform): {
  preGapSamples: number;
  beatSamples: number;
  postGapSamples: number;
  sweepScale: number;
} {
  waveform.applyOptions(randomEkgWaveformOptions());
  waveform.applyRuntime(randomEkgBeatRuntime());
  return {
    preGapSamples: randomEkgPreBeatGap(),
    beatSamples: waveform.frequency,
    postGapSamples: randomEkgPostBeatGap(),
    sweepScale: 0.72 + Math.random() * 0.58,
  };
}

export function mountLoadingEcgCanvas(
  canvas: HTMLCanvasElement,
  options?: { reducedMotion?: boolean },
): () => void {
  const root = canvas.closest('#app-boot-splash') ?? canvas.closest('.app-route-loading') ?? document.documentElement;
  const waveform = new EkgWaveform(randomEkgWaveformOptions());
  waveform.applyRuntime(randomEkgBeatRuntime());
  let beatPlan = beginNewBeat(waveform);
  let samples: number[] = [];
  let raf = 0;
  let stopped = false;
  let lastFrame = 0;
  let sampleAccumulator = 0;
  let cycleCursor = 0;
  let phase: 'pre' | 'beat' | 'post' = beatPlan.preGapSamples > 0 ? 'pre' : 'beat';

  const sweepPxPerSec = 88;
  const sourceSampleRate = 250;

  const reducedMotion = options?.reducedMotion
    ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const flatJitter = (): number => DISPLAY_BASELINE + (Math.random() - 0.5) * waveform.noise * 2.4;

  const nextSourceSample = (): number => {
    if (phase === 'pre') {
      cycleCursor += 1;
      if (cycleCursor >= beatPlan.preGapSamples) {
        phase = 'beat';
        cycleCursor = 0;
      }
      return flatJitter();
    }
    if (phase === 'beat') {
      if (cycleCursor >= beatPlan.beatSamples) {
        phase = 'post';
        cycleCursor = 0;
        return flatJitter();
      }
      const value = waveform.generateDataPoint(cycleCursor);
      cycleCursor += 1;
      return value;
    }
    cycleCursor += 1;
    if (cycleCursor >= beatPlan.postGapSamples) {
      beatPlan = beginNewBeat(waveform);
      cycleCursor = 0;
      if (beatPlan.preGapSamples > 0) {
        phase = 'pre';
        return flatJitter();
      }
      phase = 'beat';
      const first = waveform.generateDataPoint(0);
      cycleCursor = 1;
      return first;
    }
    return flatJitter();
  };

  const tick = (now: number) => {
    if (stopped) {
      return;
    }
    const { width, height, cssHeight } = resizeCanvas(canvas);
    if (samples.length !== width) {
      samples = Array.from({ length: width }, () => DISPLAY_BASELINE);
      lastFrame = now;
      sampleAccumulator = 0;
    }

    const dt = lastFrame > 0 ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;

    const motionScale = reducedMotion ? 0.3 : 1;
    sampleAccumulator += dt * sweepPxPerSec * beatPlan.sweepScale * motionScale;

    while (sampleAccumulator >= 1) {
      sampleAccumulator -= 1;
      const steps = Math.max(1, Math.round(sourceSampleRate / sweepPxPerSec));
      let v = DISPLAY_BASELINE;
      for (let s = 0; s < steps; s += 1) {
        v = nextSourceSample();
      }
      samples.shift();
      samples.push(v);
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawTrace(ctx, samples, readTraceStroke(root), width, height, cssHeight);
    }
    raf = window.requestAnimationFrame(tick);
  };

  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        resizeCanvas(canvas);
      })
    : null;
  ro?.observe(canvas);

  raf = window.requestAnimationFrame(tick);

  return () => {
    stopped = true;
    window.cancelAnimationFrame(raf);
    ro?.disconnect();
  };
}
