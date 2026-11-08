/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Settings } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiTabs } from '../UiTabs';

vi.mock('@heroui/react', async () => {
  const ReactModule = await import('react');
  const Context = ReactModule.createContext<any>(null);
  const Root: any = ({ children, selectedKey, onSelectionChange, keyboardActivation, orientation, variant, ...rest }: any) => (
    <Context.Provider value={{ selectedKey, onSelectionChange }}>
      <div
        data-testid="hero-tabs"
        data-keyboard-activation={keyboardActivation}
        data-orientation={orientation}
        data-variant={variant}
        {...rest}
      >
        {children}
      </div>
    </Context.Provider>
  );
  Root.ListContainer = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  Root.List = ReactModule.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
    <div ref={ref} role="tablist" {...props}>{children}</div>
  ));
  Root.Tab = ReactModule.forwardRef<HTMLButtonElement, any>(
    ({ children, id, isDisabled, className, ...props }, ref) => {
      const context = ReactModule.useContext(Context);
      return (
        <button
          ref={ref}
          role="tab"
          type="button"
          aria-selected={context.selectedKey === id}
          disabled={isDisabled}
          className={className}
          onClick={() => context.onSelectionChange(id)}
          {...props}
        >
          {children}
        </button>
      );
    },
  );
  Root.Indicator = (props: any) => <span data-testid="tab-indicator" {...props} />;
  Root.Panel = ({ children, id, ...props }: any) => {
    const context = ReactModule.useContext(Context);
    return (
      <div role="tabpanel" hidden={context.selectedKey !== id} {...props}>
        {children}
      </div>
    );
  };
  return { Tabs: Root };
});

const items = [
  { id: 'overview', label: 'Overview', content: <div>Overview panel</div> },
  { id: 'activity', label: 'Activity', content: <div>Activity panel</div> },
  { id: 'settings', label: 'Settings', content: <div>Settings panel</div> },
];

describe('UiTabs', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('provides a named tablist and item state content', () => {
    render(
      <UiTabs
        ariaLabel="Account sections"
        visualMode="icon-only"
        items={[
          {
            id: 'settings',
            icon: Settings,
            accessibleLabel: 'Settings',
            badge: 3,
            status: 'warning',
            content: 'Settings panel',
          },
          {
            id: 'disabled',
            icon: Settings,
            accessibleLabel: 'Disabled',
            disabled: true,
            content: 'Disabled panel',
          },
        ]}
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Account sections' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Settings/ })).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText('warning status')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Disabled' })).toBeDisabled();
  });

  it('keeps visited lazy panels and unmounts inactive panels on request', () => {
    const { rerender } = render(
      <UiTabs ariaLabel="Sections" items={items} panelLifecycle="lazy-keep" />,
    );

    expect(screen.getByText('Overview panel')).toBeTruthy();
    expect(screen.queryByText('Activity panel')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByText('Overview panel')).toBeTruthy();
    expect(screen.getByText('Activity panel')).toBeTruthy();

    rerender(<UiTabs ariaLabel="Sections" items={items} panelLifecycle="unmount" />);
    expect(screen.queryByText('Overview panel')).toBeNull();
    expect(screen.getByText('Activity panel')).toBeTruthy();
  });

  it('constrains activation and equal width to valid combinations', () => {
    const { rerender } = render(
      <UiTabs
        ariaLabel="Sections"
        items={items}
        activationMode="automatic"
        panelLifecycle="lazy-keep"
        width="equal"
      />,
    );

    expect(screen.getByTestId('hero-tabs')).toHaveAttribute('data-keyboard-activation', 'manual');
    expect(screen.getByTestId('hero-tabs')).toHaveAttribute('data-variant', 'secondary');
    expect(screen.getByRole('tablist')).toHaveAttribute('data-width', 'equal');
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('flex-1', 'basis-0', '!w-auto');
    }

    rerender(
      <UiTabs
        ariaLabel="Sections"
        items={[...items, ...items.map((item) => ({ ...item, id: `${item.id}-copy` }))]}
        activationMode="automatic"
        panelLifecycle="eager"
        width="equal"
      />,
    );
    expect(screen.getByTestId('hero-tabs')).toHaveAttribute('data-keyboard-activation', 'automatic');
    expect(screen.getByRole('tablist')).toHaveAttribute('data-width', 'fit');
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('flex-none', '!w-auto');
      expect(tab).not.toHaveClass('flex-1');
    }
  });

  it('keeps fit-width tabs compact instead of inheriting HeroUI full width', () => {
    render(
      <UiTabs
        ariaLabel="Sections"
        items={items}
        width="fit"
        variant="contained"
      />,
    );

    expect(screen.getByTestId('hero-tabs')).toHaveAttribute('data-variant', 'primary');
    expect(screen.getByRole('tablist')).toHaveAttribute('data-width', 'fit');
    expect(screen.getByRole('tablist').parentElement).toHaveClass(
      '!rounded-t-md',
      '!rounded-b-none',
    );
    expect(screen.getByRole('tablist')).toHaveClass('pb-0');
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('!w-auto', 'flex-none', '!rounded-md');
      expect(tab).toHaveClass('data-[selected]:!rounded-b-none');
      expect(tab).not.toHaveClass('w-full');
    }
    expect(screen.getByRole('tabpanel')).toHaveClass('!m-0');
    for (const indicator of screen.getAllByTestId('tab-indicator')) {
      expect(indicator).toHaveClass('hidden');
    }
  });

  it('gives the tab list a full-width scroller so alignment can move compact tabs', () => {
    const { rerender } = render(
      <UiTabs ariaLabel="Sections" items={items} width="fit" alignment="center" />,
    );

    const tabList = screen.getByRole('tablist');
    expect(tabList.parentElement).toHaveClass(
      '[&>.tabs__list-container__scroller]:w-full',
      '[&>.tabs__list-container__scroller]:[scrollbar-width:none]',
      '[&>.tabs__list-container__scroller::-webkit-scrollbar]:hidden',
    );
    expect(tabList).toHaveClass('justify-center');

    rerender(<UiTabs ariaLabel="Sections" items={items} width="fit" alignment="end" />);
    expect(screen.getByRole('tablist')).toHaveClass('justify-end');
  });

  it('maps every visual option to observable component state', () => {
    const { rerender } = render(
      <UiTabs
        ariaLabel="Sections"
        items={items}
        visualMode="icon-label"
        variant="contained"
        placement="end"
        alignment="end"
        width="equal"
        activationMode="automatic"
        panelLifecycle="eager"
        overflow="menu"
        panelAttachment="separated"
      />,
    );

    const root = screen.getByTestId('hero-tabs');
    expect(root).toHaveAttribute('data-visual-mode', 'icon-label');
    expect(root).toHaveAttribute('data-ui-variant', 'contained');
    expect(root).toHaveAttribute('data-variant', 'primary');
    expect(root).toHaveAttribute('data-placement', 'end');
    expect(root).toHaveAttribute('data-alignment', 'end');
    expect(root).toHaveAttribute('data-width', 'equal');
    expect(root).toHaveAttribute('data-activation', 'automatic');
    expect(root).toHaveAttribute('data-panel-lifecycle', 'eager');
    expect(root).toHaveAttribute('data-overflow', 'menu');
    expect(root).toHaveAttribute('data-panel-attachment', 'separated');
    expect(root).toHaveClass('gap-2');
    expect(root).toHaveClass('!flex-row-reverse');
    expect(screen.getByLabelText('Show all tabs')).toBeTruthy();

    rerender(
      <UiTabs
        ariaLabel="Sections"
        items={items}
        placement="start"
        alignment="center"
        width="fit"
      />,
    );
    expect(screen.getByTestId('hero-tabs')).toHaveAttribute('data-placement', 'start');
    expect(screen.getByRole('tablist')).toHaveClass('min-h-full', 'justify-center');
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('!w-auto', 'self-start');
    }
  });

  it('reveals the selected tab when controlled selection changes', () => {
    const { rerender } = render(
      <UiTabs ariaLabel="Sections" items={items} selectedKey="overview" />,
    );
    const scrollIntoView = HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    scrollIntoView.mockClear();

    rerender(<UiTabs ariaLabel="Sections" items={items} selectedKey="settings" />);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });
});
