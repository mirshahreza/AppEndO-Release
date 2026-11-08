import { afterEach, describe, expect, it } from 'vitest';
import {
  resetFloatingPanelStackForTests,
  subscribeFloatingPanelStack,
} from '../floatingPanelStack';

afterEach(() => {
  resetFloatingPanelStackForTests();
});

describe('floatingPanelStack', () => {
  it('assigns later subscribers a higher z-index', () => {
    const first: number[] = [];
    const second: number[] = [];
    subscribeFloatingPanelStack((zIndex) => first.push(zIndex));
    subscribeFloatingPanelStack((zIndex) => second.push(zIndex));

    expect(first.at(-1)).toBe(100);
    expect(second.at(-1)).toBe(101);
  });

  it('raises a window above the others in the same layer', () => {
    const first: number[] = [];
    const second: number[] = [];
    const firstHandle = subscribeFloatingPanelStack((zIndex) => first.push(zIndex));
    subscribeFloatingPanelStack((zIndex) => second.push(zIndex));

    firstHandle.raise();

    expect(first.at(-1)).toBe(101);
    expect(second.at(-1)).toBe(100);
  });

  it('does not republish when the window is already frontmost', () => {
    const zIndexes: number[] = [];
    const handle = subscribeFloatingPanelStack((zIndex) => zIndexes.push(zIndex));
    subscribeFloatingPanelStack(() => undefined);

    handle.raise();
    const afterFirstRaise = zIndexes.length;
    handle.raise();

    expect(zIndexes).toHaveLength(afterFirstRaise);
  });

  it('keeps a higher layer above raised lower-layer windows', () => {
    const lower: number[] = [];
    const higher: number[] = [];
    const lowerHandle = subscribeFloatingPanelStack((zIndex) => lower.push(zIndex), 0);
    subscribeFloatingPanelStack((zIndex) => higher.push(zIndex), 1);

    lowerHandle.raise();

    expect(lower.at(-1)).toBe(100);
    expect(higher.at(-1)).toBe(101);
  });
});
