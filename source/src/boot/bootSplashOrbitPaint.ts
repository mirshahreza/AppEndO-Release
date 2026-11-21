import {
  ROUTE_LOADING_ORBIT_BORDER_RADIUS_REM,
  ROUTE_LOADING_ORBIT_BORDER_WIDTH,
  ROUTE_LOADING_ORBIT_COLOR_STEPS,
  ROUTE_LOADING_ORBIT_DURATION_SECONDS,
  ROUTE_LOADING_ORBIT_GLOW_BLUR,
  ROUTE_LOADING_ORBIT_GLOW_OPACITY,
  ROUTE_LOADING_ORBIT_REVERSE_COLORS,
  ROUTE_LOADING_ORBIT_TAIL_LENGTH,
} from '../components/routeLoadingOrbitContract';
import {
  buildOrbitCometSteps,
  ORBIT_BORDER_PRESETS,
  resolveOrbitPaletteStops,
} from '../shared/ui/OrbitBorderFrame';

const roundedRectPath = (width: number, height: number, radius: number, inset: number): string => {
  const x = inset;
  const y = inset;
  const w = Math.max(0, width - inset * 2);
  const h = Math.max(0, height - inset * 2);
  if (w < 1 || h < 1) return '';
  const r = Math.min(Math.max(0, radius - inset * 0.15), w / 2, h / 2);
  if (r <= 0.5) {
    return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  }
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
};

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyHostStyleVars(host: HTMLElement): void {
  const palette = ORBIT_BORDER_PRESETS.accent;
  const tail = ROUTE_LOADING_ORBIT_TAIL_LENGTH;
  host.style.setProperty('--orbit-border-width', `${ROUTE_LOADING_ORBIT_BORDER_WIDTH}px`);
  host.style.setProperty('--orbit-border-radius', `${ROUTE_LOADING_ORBIT_BORDER_RADIUS_REM}rem`);
  host.style.setProperty('--orbit-border-host-bg', 'transparent');
  host.style.setProperty('--orbit-border-duration', `${ROUTE_LOADING_ORBIT_DURATION_SECONDS}s`);
  host.style.setProperty('--orbit-border-glow-blur', `${ROUTE_LOADING_ORBIT_GLOW_BLUR}px`);
  host.style.setProperty('--orbit-border-glow-opacity', String(ROUTE_LOADING_ORBIT_GLOW_OPACITY));
  host.style.setProperty('--orbit-dash-tail', String(tail));
  host.style.setProperty('--orbit-gap-tail', String(Math.max(0, 100 - tail)));
  host.style.setProperty('--orbit-color-glow', palette.glow);
  host.style.setProperty('--orbit-color-track', palette.track);
  host.dataset.orbitPreset = 'accent';
  host.dataset.orbitDirection = 'forward';
  host.dataset.orbitReverseColors = ROUTE_LOADING_ORBIT_REVERSE_COLORS ? 'true' : 'false';
  host.dataset.orbitMotion = readReducedMotion() ? 'reduced' : 'normal';
}

function paintBootSplashOrbitHost(host: HTMLElement): void {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (width < 2 || height < 2) {
    return;
  }

  const svg = host.querySelector<SVGSVGElement>('.orbit-border-svg');
  if (!svg) {
    return;
  }

  applyHostStyleVars(host);

  const radius =
    Number.parseFloat(getComputedStyle(host).borderTopLeftRadius) ||
    ROUTE_LOADING_ORBIT_BORDER_RADIUS_REM * 16;
  const inset = ROUTE_LOADING_ORBIT_BORDER_WIDTH * 0.5 + 1;
  const d = roundedRectPath(width, height, radius, inset);
  if (!d) {
    return;
  }

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.replaceChildren();

  const palette = ORBIT_BORDER_PRESETS.accent;
  const stops = resolveOrbitPaletteStops(palette.stops, ROUTE_LOADING_ORBIT_REVERSE_COLORS);
  const tailGap = Math.max(0, 100 - ROUTE_LOADING_ORBIT_TAIL_LENGTH);
  const steps = buildOrbitCometSteps(
    ROUTE_LOADING_ORBIT_COLOR_STEPS,
    ROUTE_LOADING_ORBIT_TAIL_LENGTH,
    ROUTE_LOADING_ORBIT_BORDER_WIDTH,
    stops,
  );

  const track = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  track.setAttribute('d', d);
  track.setAttribute('pathLength', '100');
  track.setAttribute('fill', 'none');
  track.classList.add('orbit-border-layer-track');

  const cometGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  cometGroup.classList.add('orbit-border-comets');

  const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  glow.setAttribute('d', d);
  glow.setAttribute('pathLength', '100');
  glow.setAttribute('fill', 'none');
  glow.classList.add('orbit-border-comet', 'orbit-border-layer-glow');
  glow.style.setProperty('--orbit-comet-phase-start', String(-tailGap));
  glow.style.setProperty('--orbit-comet-phase-end', String(-tailGap - 100));
  cometGroup.appendChild(glow);

  steps.forEach((step, index) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('pathLength', '100');
    path.setAttribute('fill', 'none');
    path.classList.add('orbit-border-comet');
    path.style.stroke = step.color;
    path.style.strokeWidth = `${step.width}px`;
    path.style.strokeDasharray = `${step.dash} ${step.gap}`;
    path.style.opacity = String(step.opacity);
    path.style.setProperty('--orbit-comet-phase-start', String(step.dashOffsetPhase));
    path.style.setProperty('--orbit-comet-phase-end', String(step.dashOffsetPhase - 100));
    path.dataset.cometStep = String(index);
    cometGroup.appendChild(path);
  });

  svg.append(track, cometGroup);
  host.setAttribute('data-boot-orbit-painted', '1');
}

let bootOrbitObserver: ResizeObserver | undefined;

/** Paint and keep the boot-splash orbit in sync (first paint + logo swaps). */
export function attachBootSplashOrbit(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const splash = document.getElementById('app-boot-splash');
  const host = splash?.querySelector<HTMLElement>('.app-boot-orbit-static');
  if (!host) {
    return;
  }

  const paint = () => paintBootSplashOrbitHost(host);

  paint();

  if (bootOrbitObserver) {
    return;
  }

  if (typeof ResizeObserver !== 'undefined') {
    bootOrbitObserver = new ResizeObserver(() => paint());
    bootOrbitObserver.observe(host);
  }

  if (typeof window !== 'undefined') {
    const win = window as Window & {
      __appendoBootSplashOrbitRepaint?: () => void;
    };
    win.__appendoBootSplashOrbitRepaint = () => paint();

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => {
      applyHostStyleVars(host);
      paint();
    };
    media.addEventListener('change', onMotionChange);
  }
}