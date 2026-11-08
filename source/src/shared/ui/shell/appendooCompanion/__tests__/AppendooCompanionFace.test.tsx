// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppendooCompanionFace } from '../AppendooCompanionFace';

describe('AppendooCompanionFace', () => {
  it('always draws both brows on the idle face', () => {
    render(<AppendooCompanionFace emotion="neutral" />);
    expect(screen.getByTestId('appendoo-brow-left')).toBeTruthy();
    expect(screen.getByTestId('appendoo-brow-right')).toBeTruthy();
    expect(screen.getByTestId('appendoo-mouth')).toBeTruthy();
    expect(screen.getByTestId('appendoo-cast')).toBeTruthy();
    expect(screen.getByTestId('appendoo-blush')).toBeTruthy();
  });

  it('hides brows, blush, and mouth when those face parts are off', () => {
    const { container } = render(
      <AppendooCompanionFace
        emotion="joy"
        parts={{ brows: false, blush: false, mouth: false }}
      />,
    );
    expect(container.querySelector('[data-testid="appendoo-brow-left"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-blush"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-mouth"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-eyes"]')).toBeTruthy();
  });

  it('hides the disgust nose wrinkle when the nose part is off', () => {
    const { container, rerender } = render(<AppendooCompanionFace emotion="disgust" />);
    expect(container.querySelector('[data-testid="appendoo-nose-wrinkle"]')).toBeTruthy();
    rerender(<AppendooCompanionFace emotion="disgust" parts={{ nose: false }} />);
    expect(container.querySelector('[data-testid="appendoo-nose-wrinkle"]')).toBeNull();
  });

  it('draws a nose wrinkle for disgust', () => {
    render(<AppendooCompanionFace emotion="disgust" />);
    expect(screen.getByTestId('appendoo-nose-wrinkle')).toBeTruthy();
  });

  it('switches the silhouette data-shape for barbapapa', () => {
    const { container, rerender } = render(<AppendooCompanionFace emotion="neutral" body={{ shape: 'peach' }} />);
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-shape')).toBe('peach');
    rerender(<AppendooCompanionFace emotion="neutral" body={{ shape: 'barbapapa' }} />);
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-shape')).toBe('barbapapa');
    expect(container.querySelector('[data-testid="appendoo-rim"]')).toBeTruthy();
  });

  it('draws the peach leaf and the remaining silhouette extras', () => {
    const { container, rerender } = render(<AppendooCompanionFace emotion="neutral" body={{ shape: 'peach' }} />);
    expect(container.querySelector('[data-testid="peach-leaf"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="peach-stem"]')).toBeTruthy();
    rerender(<AppendooCompanionFace emotion="neutral" body={{ shape: 'bacteria' }} />);
    expect(container.querySelector('[data-testid="bacteria-antenna-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="bacteria-leaf"]')).toBeNull();
    rerender(<AppendooCompanionFace emotion="neutral" body={{ shape: 'sponge' }} />);
    expect(container.querySelector('[data-testid="sponge-pore-a"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sponge-pants"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sponge-tie"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sponge-leaf"]')).toBeNull();
    expect(container.querySelector('[data-testid="sponge-body"]')).toBeNull();
    rerender(<AppendooCompanionFace emotion="neutral" body={{ shape: 'crab' }} />);
    expect(container.querySelector('[data-testid="crab-claw-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="crab-leaf"]')).toBeNull();
    rerender(<AppendooCompanionFace emotion="neutral" body={{ shape: 'barbapapa' }} />);
    expect(container.querySelector('[data-testid="barbapapa-arm-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="barbapapa-leaf"]')).toBeNull();
    expect(container.querySelector('[data-testid="barbapapa-head"]')).toBeNull();
    expect(container.querySelector('[data-testid="barbapapa-neck"]')).toBeNull();
  });

  it('omits the body for none and keeps the face plus accessories', () => {
    const { container, rerender } = render(
      <AppendooCompanionFace
        emotion="neutral"
        body={{ shape: 'none' }}
        accessories={{ hat: true, glasses: true }}
      />,
    );
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-shape')).toBe('none');
    expect(container.querySelector('[data-testid="appendoo-brow-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-mouth"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-hat"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-glasses"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-rim"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-glass"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-schematic"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-look-paint"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-cast"]')).toBeNull();
    expect(container.querySelector('[data-testid="peach-leaf"]')).toBeNull();
    rerender(<AppendooCompanionFace emotion="neutral" body={{ shape: 'none' }} look="contour" />);
    expect(container.querySelector('[data-testid="appendoo-schematic"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-hat"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-brow-left"]')).toBeTruthy();
  });

  it('paints peach flesh by default and a palette gel when asked', () => {
    const { container, rerender } = render(<AppendooCompanionFace emotion="neutral" body={{ shape: 'peach' }} />);
    const peachStops = Array.from(
      container.querySelector('[data-testid="appendoo-glass"]')?.querySelectorAll('stop') ?? [],
    ).map((stop) => stop.getAttribute('stop-color'));
    expect(peachStops).toEqual(['#fff8f3', '#ffdcc9', '#f0b396']);
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-color-mode')).toBe('character');

    rerender(<AppendooCompanionFace emotion="neutral" body={{ shape: 'peach' }} colorMode="theme" gel={{
      hi: '#e8f4fc',
      mid: '#7eb6e8',
      lo: '#0078d4',
      glow: '#9cc9f0',
      rim: '#c5ddf2',
      blush: '#e8a0b0',
      ink: '#2a221c',
      spark: '#ffd38a',
      leaf: '#6faf62',
      stem: '#6a4b32',
      shadow: 'rgb(0 60 120)',
    }} />);
    const themeStops = Array.from(
      container.querySelector('[data-testid="appendoo-glass"]')?.querySelectorAll('stop') ?? [],
    ).map((stop) => stop.getAttribute('stop-color'));
    expect(themeStops[2]).toBe('#0078d4');
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-color-mode')).toBe('theme');
  });

  it('keeps accessories off until asked, then draws hat and glasses in a dedicated paint', () => {
    const { container, rerender } = render(<AppendooCompanionFace emotion="neutral" />);
    expect(container.querySelector('[data-testid="appendoo-hat"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-glasses"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-accessory-paint')).toBe('cherry');
    rerender(<AppendooCompanionFace emotion="surprise" accessories={{ hat: true, glasses: true }} accessoryPaint={{
      id: 'cobalt',
      label: 'Cobalt',
      note: 'Clear blue frames and knit.',
      hi: '#d6e6ff',
      mid: '#3d7ee8',
      lo: '#2458b8',
      ink: '#1c3358',
      lens: 'rgb(214 232 255 / 0.34)',
    }} />);
    expect(container.querySelector('[data-testid="appendoo-hat"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-glasses"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-accessory-paint')).toBe('cobalt');
    expect(container.querySelector('[data-testid="appendoo-hat"] path')?.getAttribute('fill')).toBe('#3d7ee8');
  });

  it('marks pointer follow when a look overlay is passed', () => {
    const { container, rerender } = render(<AppendooCompanionFace emotion="neutral" />);
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-follow-pointer')).toBe('off');
    rerender(<AppendooCompanionFace emotion="neutral" pointerLook={{ lookX: 0.8, lookY: -0.4 }} />);
    const stage = container.querySelector('[data-testid="appendoo-companion-stage"]') as HTMLElement;
    expect(stage.getAttribute('data-follow-pointer')).toBe('on');
    expect(stage.style.getPropertyValue('--appendoo-look-x')).toBe('0.8');
  });

  it('drops gel, trims, and accessories in contour look and keeps a dark face plus cast', () => {
    const { container } = render(
      <AppendooCompanionFace
        emotion="neutral"
        look="contour"
        accessories={{ hat: true, glasses: true }}
      />,
    );
    const stage = container.querySelector('[data-testid="appendoo-companion-stage"]');
    expect(stage?.getAttribute('data-look')).toBe('contour');
    expect(container.querySelector('[data-testid="appendoo-schematic"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-cast"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-brow-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-mouth"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-rim"]')).toBeNull();
    expect(container.querySelector('[data-testid="peach-leaf"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-hat"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-glass"]')).toBeNull();
    expect(container.querySelector('.appendoo-companion-ink')?.classList.contains('is-schematic')).toBe(true);
    expect(Number(container.querySelector('[data-testid="appendoo-mouth"]')?.getAttribute('stroke-width'))).toBeGreaterThan(2);
  });

  it('paints graphite as grayscale volume without gel shine', () => {
    const { container } = render(<AppendooCompanionFace emotion="neutral" look="graphite" accessories={{ hat: true }} />);
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-look')).toBe('graphite');
    expect(container.querySelector('[data-testid="appendoo-look-paint"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-glass"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-hat"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-brow-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-cast"]')).toBeTruthy();
  });

  it('paints realistic as colored photographic volume with catchlights, not ink or gel', () => {
    const { container } = render(<AppendooCompanionFace emotion="neutral" look="realistic" accessories={{ hat: true }} />);
    const stage = container.querySelector('[data-testid="appendoo-companion-stage"]');
    expect(stage?.getAttribute('data-look')).toBe('realistic');
    expect(stage?.classList.contains('is-ink-face')).toBe(false);
    expect(container.querySelector('[data-testid="appendoo-look-paint"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-glass"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-hat"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-brow-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-cast"]')).toBeTruthy();
    expect(container.querySelectorAll('ellipse[fill="#fff"]').length).toBeGreaterThan(2);
  });

  it('keeps wonk from tilting and leans only from the lean option', () => {
    const { container, rerender } = render(<AppendooCompanionFace emotion="neutral" body={{ wonk: 10 }} />);
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-wonk')).toBe('10');
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-lean')).toBe('none');
    expect(container.querySelector('[data-testid="appendoo-lean"]')?.getAttribute('transform')).toBeNull();
    rerender(<AppendooCompanionFace emotion="neutral" body={{ wonk: 10, lean: 'right' }} />);
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-lean')).toBe('right');
    expect(container.querySelector('[data-testid="appendoo-lean"]')?.getAttribute('transform')).toContain('rotate(14.00 50 96)');
    rerender(<AppendooCompanionFace emotion="neutral" body={{ wonk: 10, lean: 'left' }} />);
    expect(container.querySelector('[data-testid="appendoo-lean"]')?.getAttribute('transform')).toContain('rotate(-14.00 50 96)');
    rerender(<AppendooCompanionFace emotion="neutral" body={{ wonk: 10, lean: 'both', wonkScatter: true, wonkSeed: 4 }} />);
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-lean')).toBe('both');
    expect(container.querySelector('[data-testid="appendoo-lean"]')?.getAttribute('transform')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-wonk-scatter')).toBe('on');
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-wonk-seed')).toBe('4');
  });

  it('paints watercolor without gel shine and keeps the face ink', () => {
    const { container } = render(<AppendooCompanionFace emotion="joy" look="wash" />);
    expect(container.querySelector('[data-testid="appendoo-companion-stage"]')?.getAttribute('data-look')).toBe('wash');
    expect(container.querySelector('[data-testid="appendoo-look-paint"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-glass"]')).toBeNull();
    expect(container.querySelector('[data-testid="appendoo-brow-left"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="appendoo-cast"]')).toBeTruthy();
  });
});
