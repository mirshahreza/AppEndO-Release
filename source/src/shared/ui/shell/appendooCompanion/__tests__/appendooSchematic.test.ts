import { describe, expect, it } from 'vitest';
import { APPENDOO_DEFAULT_BODY, sampleAppendooSilhouetteLayers } from '../appendooBodyShape';
import { appendooSchematicHalfWidthAt, pathFromAppendooSchematicStroke } from '../appendooSchematic';

describe('appendooSchematic', () => {
  it('builds a closed even-odd contour that is not the filled gel body', () => {
    const body = sampleAppendooSilhouetteLayers(APPENDOO_DEFAULT_BODY).body;
    const stroke = pathFromAppendooSchematicStroke(body);
    expect(stroke.startsWith('M ')).toBe(true);
    expect(stroke).toContain(' Z M ');
    expect(stroke.endsWith(' Z')).toBe(true);
    expect(stroke).not.toBe('');
  });

  it('puts heat and weight on the belly, not the crown', () => {
    const top = appendooSchematicHalfWidthAt({ x: 50, y: 18 }, { x: 1, y: 0 }, 0, 56, 18, 96);
    const belly = appendooSchematicHalfWidthAt({ x: 50, y: 94 }, { x: -1, y: 0 }, 28, 56, 18, 96);
    expect(belly).toBeGreaterThan(top * 1.35);
  });
});
