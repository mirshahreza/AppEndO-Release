/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { measureAppTableGridColumnAutoWidth } from '../appTableGridColumnAutoWidth';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('measureAppTableGridColumnAutoWidth', () => {
  it('returns null when the root or cells are missing', () => {
    expect(measureAppTableGridColumnAutoWidth(null, 'name')).toBeNull();
    expect(measureAppTableGridColumnAutoWidth(document.createElement('div'), 'name')).toBeNull();
  });

  it('measures header and body cells for a column id', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <table>
        <thead>
          <tr>
            <th data-column-id="code">
              <div class="flex"><span>Product code</span></div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-column-id="code"><div>SKU-1</div></td>
          </tr>
          <tr>
            <td data-column-id="code"><div>SKU-MUCH-LONGER-VALUE</div></td>
          </tr>
        </tbody>
      </table>
    `;
    document.body.appendChild(root);

    const width = measureAppTableGridColumnAutoWidth(root, 'code');
    expect(width).not.toBeNull();
    expect(width).toBeGreaterThanOrEqual(48);
  });
});
