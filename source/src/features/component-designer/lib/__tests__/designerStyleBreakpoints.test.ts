import { describe, expect, it } from 'vitest';
import {
  collapseResponsiveClassNameForBreakpoint,
  styleBreakpointIdFromViewportPreset,
  styleBreakpointPrefix,
  DESIGNER_STYLE_BREAKPOINTS,
} from '../designerStyleBreakpoints';

describe('designerStyleBreakpoints', () => {
  it('maps Desktop/Tablet/Mobile to lg:/md:/base prefixes', () => {
    expect(DESIGNER_STYLE_BREAKPOINTS.map((entry) => [entry.id, entry.prefix])).toEqual([
      ['desktop', 'lg:'],
      ['tablet', 'md:'],
      ['mobile', ''],
    ]);
    expect(styleBreakpointPrefix('desktop')).toBe('lg:');
    expect(styleBreakpointPrefix('tablet')).toBe('md:');
    expect(styleBreakpointPrefix('mobile')).toBe('');
    expect(styleBreakpointIdFromViewportPreset('desktop')).toBe('desktop');
  });

  it('collapses responsive utilities for each simulated viewport', () => {
    const className = 'p-2 md:p-4 lg:p-8 rounded-sm md:rounded-md lg:rounded-lg text-sm hover:text-red-500';

    expect(collapseResponsiveClassNameForBreakpoint(className, 'mobile')).toBe(
      'hover:text-red-500 p-2 rounded-sm text-sm',
    );
    expect(collapseResponsiveClassNameForBreakpoint(className, 'tablet')).toBe(
      'hover:text-red-500 p-4 rounded-md text-sm',
    );
    expect(collapseResponsiveClassNameForBreakpoint(className, 'desktop')).toBe(
      'hover:text-red-500 p-8 rounded-lg text-sm',
    );
  });

  it('keeps only the winning prefix when base and overrides conflict', () => {
    expect(collapseResponsiveClassNameForBreakpoint('flex md:grid lg:hidden', 'desktop')).toBe('hidden');
    expect(collapseResponsiveClassNameForBreakpoint('flex md:grid lg:hidden', 'tablet')).toBe('grid');
    expect(collapseResponsiveClassNameForBreakpoint('flex md:grid lg:hidden', 'mobile')).toBe('flex');
  });
});
