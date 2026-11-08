/**
 * EKG waveform model adapted from BiomedWaveforms (Erkin Ötleş, 2023).
 * https://github.com/eotles/BiomedWaveforms
 */

export type EkgWaveformOptions = {
  /** Samples per cardiac cycle (250 ≈ 1s trace at 250 Hz). */
  frequency: number;
  pWaveDuration: number;
  pWaveMagnitude: number;
  qDuration: number;
  qMagnitude: number;
  rDuration: number;
  rMagnitude: number;
  sDuration: number;
  sMagnitude: number;
  tWaveDuration: number;
  tWaveMagnitude: number;
  prInterval: number;
  prSegmentElevation: number;
  qtInterval: number;
  stSegmentElevation: number;
};

export const DEFAULT_EKG_WAVEFORM_OPTIONS: EkgWaveformOptions = {
  frequency: 250,
  pWaveDuration: 80,
  pWaveMagnitude: 0.25,
  qDuration: 30,
  qMagnitude: -0.1,
  rDuration: 35,
  rMagnitude: 1.2,
  sDuration: 30,
  sMagnitude: -0.2,
  tWaveDuration: 160,
  tWaveMagnitude: 0.3,
  prInterval: 120,
  prSegmentElevation: 0,
  qtInterval: 360,
  stSegmentElevation: 0,
};

function randUnit(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]! / 0x1_0000_0000;
  }
  return Math.random();
}

function rand(min: number, max: number): number {
  return min + randUnit() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function maybeZero(magnitude: number, skipChance: number): number {
  return randUnit() < skipChance ? rand(0, magnitude * 0.22) : magnitude;
}

/** Independent wide draws per beat — no shared "wild mode" bucket. */
export function randomEkgWaveformOptions(): EkgWaveformOptions {
  const pMag = rand(0, 0.68);
  const tMag = rand(0, 0.82);
  return {
    ...DEFAULT_EKG_WAVEFORM_OPTIONS,
    frequency: randInt(120, 395),
    pWaveDuration: randInt(32, 118),
    pWaveMagnitude: maybeZero(pMag, 0.28),
    qDuration: randInt(8, 78),
    qMagnitude: rand(-0.42, 0.24),
    rDuration: randInt(10, 82),
    rMagnitude: rand(0.28, 3.55),
    sDuration: randInt(8, 78),
    sMagnitude: rand(-0.92, 0.26),
    tWaveDuration: randInt(52, 295),
    tWaveMagnitude: maybeZero(tMag, 0.24),
    prInterval: randInt(62, 205),
    qtInterval: randInt(200, 510),
    prSegmentElevation: rand(-0.12, 0.12),
    stSegmentElevation: rand(-0.16, 0.16),
  };
}

/** Extra flat samples after T wave before the next beat (monitor idle gap). */
export function randomEkgPostBeatGap(): number {
  if (randUnit() < 0.14) {
    return randInt(175, 360);
  }
  return randInt(3, 220);
}

/** Occasional pause before the next beat starts drawing. */
export function randomEkgPreBeatGap(): number {
  return randUnit() < 0.2 ? randInt(6, 85) : 0;
}

export type EkgBeatRuntime = {
  baseline: number;
  gain: number;
  noise: number;
};

export function randomEkgBeatRuntime(): EkgBeatRuntime {
  return {
    baseline: 150,
    gain: rand(0.42, 2.25),
    noise: rand(0.022, 0.11),
  };
}

export class EkgWaveform {
  frequency: number;
  pWaveDuration: number;
  pWaveMagnitude: number;
  qDuration: number;
  qMagnitude: number;
  rDuration: number;
  rMagnitude: number;
  sDuration: number;
  sMagnitude: number;
  tWaveDuration: number;
  tWaveMagnitude: number;
  prInterval: number;
  prSegmentElevation: number;
  qtInterval: number;
  stSegmentElevation: number;

  baseline = 150;

  gain = 1;

  noise = 0.02;

  /** Per-beat micro jitter on QRS/T segments (set fresh each beat). */
  ripple = 0.04;

  constructor(options: Partial<EkgWaveformOptions> = {}) {
    const settings = { ...DEFAULT_EKG_WAVEFORM_OPTIONS, ...options };
    this.frequency = settings.frequency;
    this.pWaveDuration = settings.pWaveDuration;
    this.pWaveMagnitude = settings.pWaveMagnitude;
    this.qDuration = settings.qDuration;
    this.qMagnitude = settings.qMagnitude;
    this.rDuration = settings.rDuration;
    this.rMagnitude = settings.rMagnitude;
    this.sDuration = settings.sDuration;
    this.sMagnitude = settings.sMagnitude;
    this.tWaveDuration = settings.tWaveDuration;
    this.tWaveMagnitude = settings.tWaveMagnitude;
    this.prInterval = settings.prInterval;
    this.prSegmentElevation = settings.prSegmentElevation;
    this.qtInterval = settings.qtInterval;
    this.stSegmentElevation = settings.stSegmentElevation;
  }

  applyOptions(options: Partial<EkgWaveformOptions>): void {
    const nextFrequency = options.frequency ?? this.frequency;
    Object.assign(this, { ...DEFAULT_EKG_WAVEFORM_OPTIONS, ...options, frequency: nextFrequency });
  }

  applyRuntime(runtime: EkgBeatRuntime): void {
    this.baseline = runtime.baseline;
    this.gain = runtime.gain;
    this.noise = runtime.noise;
    this.ripple = rand(0.05, 0.28);
  }

  private normalizePosition(positionInCycle: number): number {
    return (positionInCycle / this.frequency) * 1000;
  }

  /** Sample index within the current cardiac cycle. */
  generateDataPoint(sampleInCycle: number): number {
    const baseline = this.baseline;
    const positionInCycle = sampleInCycle % this.frequency;
    const normalizedPosition = this.normalizePosition(positionInCycle);

    const pWaveEnd = this.pWaveDuration;
    const prSegmentStart = pWaveEnd;
    const prSegmentEnd = this.prInterval;

    const qrsStart = this.prInterval;
    const qExtremaTime = qrsStart + this.qDuration / 2;
    const rExtremaTime = qrsStart + this.qDuration + this.rDuration / 2;
    const sExtremaTime = qrsStart + this.qDuration + this.rDuration + this.sDuration / 2;
    const qrsEnd = qrsStart + this.qDuration + this.rDuration + this.sDuration;

    const qSlope = (this.qMagnitude - this.prSegmentElevation) / (this.qDuration / 2);
    const qrSlope = (this.rMagnitude - this.qMagnitude) / (this.qDuration / 2 + this.rDuration / 2);
    const rsSlope = (this.sMagnitude - this.rMagnitude) / (this.rDuration / 2 + this.sDuration / 2);
    const sSlope = (this.stSegmentElevation - this.sMagnitude) / (this.sDuration / 2);

    const tWaveStart = qrsEnd + (this.qtInterval - this.tWaveDuration);
    const tWaveEnd = tWaveStart + this.tWaveDuration;

    const stSegmentStart = qrsEnd;
    const stSegmentEnd = tWaveStart;

    let value = baseline;

    if (normalizedPosition >= 0 && normalizedPosition < pWaveEnd) {
      const positionInP = normalizedPosition;
      value = baseline
        + Math.sin((positionInP / this.pWaveDuration) * Math.PI) * this.pWaveMagnitude
        + this.prSegmentElevation;
    } else if (normalizedPosition >= prSegmentStart && normalizedPosition < prSegmentEnd) {
      value = baseline + this.prSegmentElevation;
    } else if (normalizedPosition >= qrsStart && normalizedPosition < qrsEnd) {
      if (normalizedPosition < qExtremaTime) {
        const positionInQ = normalizedPosition - qrsStart;
        value = baseline + this.prSegmentElevation + qSlope * positionInQ;
      } else if (normalizedPosition < rExtremaTime) {
        const positionInQr = normalizedPosition - qExtremaTime;
        value = baseline + this.qMagnitude + qrSlope * positionInQr;
      } else if (normalizedPosition < sExtremaTime) {
        const positionInRs = normalizedPosition - rExtremaTime;
        value = baseline + this.rMagnitude + rsSlope * positionInRs;
      } else {
        const positionInS = normalizedPosition - sExtremaTime;
        value = baseline + this.sMagnitude + sSlope * positionInS;
      }
    } else if (normalizedPosition >= stSegmentStart && normalizedPosition < stSegmentEnd) {
      value = baseline + this.stSegmentElevation;
    } else if (normalizedPosition >= tWaveStart && normalizedPosition < tWaveEnd) {
      const positionInT = normalizedPosition - tWaveStart;
      value = baseline
        + Math.sin((positionInT / this.tWaveDuration) * Math.PI) * this.tWaveMagnitude
        + this.stSegmentElevation;
    } else {
      value = baseline + (randUnit() - 0.5) * this.noise * 1.35;
    }

    const shaped = baseline + (value - baseline) * this.gain;
    const inComplex = normalizedPosition >= qrsStart && normalizedPosition < tWaveEnd;
    const jitterScale = inComplex ? 0.85 : 1.55;
    const jitter = (randUnit() - 0.5) * this.noise * jitterScale;
    const ripple = (randUnit() - 0.5) * this.ripple * (inComplex ? 1.15 : 0.65);
    const spikeKick = inComplex && randUnit() < 0.07 ? (randUnit() - 0.5) * this.ripple * 2.4 : 0;
    return shaped + jitter + ripple + spikeKick;
  }
}
