/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { SqlConsoleSampleList } from '../SqlConsoleSampleList';

afterEach(cleanup);

describe('SqlConsoleSampleList', () => {
  it('renders sample titles and loads SQL on click', () => {
    const onPick = vi.fn();
    render(
      <SqlConsoleSampleList
        samples={[
          { id: 'list-tables', title: 'List tables', hint: 'Tables in this database', sql: 'SELECT 1;' },
          { id: 'platform-users', title: 'Platform users', hint: 'Directory without secrets', sql: 'SELECT 2;' },
        ]}
        onPick={onPick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load sample: List tables' }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith('SELECT 1;');
  });

  it('renders nothing when there are no samples', () => {
    const { container } = render(<SqlConsoleSampleList samples={[]} onPick={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
