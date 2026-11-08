/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppSurfaceBox } from '../AppSurfaceBox';

describe('AppSurfaceBox option liveness', () => {
  afterEach(cleanup);

  it('maps shell options and collapse interaction to observable output', () => {
    const { container, rerender } = render(
      <AppSurfaceBox title="Package" tone="cyan" fill collapsible defaultOpen>
        Package content
      </AppSurfaceBox>,
    );
    const shell = container.firstElementChild;
    expect(shell).toHaveAttribute('data-layout', 'panel');
    expect(shell).toHaveAttribute('data-tone', 'cyan');
    expect(shell).toHaveAttribute('data-fill', 'true');
    expect(screen.getByText('Package content')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Package/ }));
    expect(shell).toHaveAttribute('data-collapsed', 'true');
    expect(screen.queryByText('Package content')).not.toBeInTheDocument();

    rerender(<AppSurfaceBox layout="strip" tone="amber">Strip content</AppSurfaceBox>);
    expect(container.firstElementChild).toHaveAttribute('data-layout', 'strip');
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'amber');
  });
});
