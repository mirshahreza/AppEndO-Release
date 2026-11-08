/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  UiWorkspaceTabs,
  type UiWorkspaceTabItem,
} from '../UiWorkspaceTabs';

vi.mock('@heroui/react', async () => {
  const ReactModule = await import('react');
  const Context = ReactModule.createContext<any>(null);
  const Root: any = ReactModule.forwardRef<HTMLDivElement, any>(
    ({ children, selectedKey, onSelectionChange, keyboardActivation, orientation, variant, ...props }, ref) => (
      <Context.Provider value={{ selectedKey, onSelectionChange }}>
        <div
          ref={ref}
          data-keyboard-activation={keyboardActivation}
          data-orientation={orientation}
          data-variant={variant}
          {...props}
        >
          {children}
        </div>
      </Context.Provider>
    ),
  );
  Root.ListContainer = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  Root.List = ReactModule.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
    <div ref={ref} role="tablist" {...props}>{children}</div>
  ));
  Root.Tab = ReactModule.forwardRef<HTMLDivElement, any>(
    ({ children, id, ...props }, ref) => {
      const context = ReactModule.useContext(Context);
      return (
        <div
          ref={ref}
          role="tab"
          tabIndex={context.selectedKey === id ? 0 : -1}
          aria-selected={context.selectedKey === id}
          onClick={() => context.onSelectionChange(id)}
          {...props}
        >
          {children}
        </div>
      );
    },
  );
  Root.Indicator = (props: any) => <span data-testid="tab-indicator" {...props} />;
  Root.Panel = ({ children, id, ...props }: any) => {
    const context = ReactModule.useContext(Context);
    return <div role="tabpanel" hidden={context.selectedKey !== id} {...props}>{children}</div>;
  };
  return { Tabs: Root };
});

const initialItems: UiWorkspaceTabItem[] = [
  { id: 'one', label: 'One', closeable: true, content: <div>One editor</div> },
  { id: 'two', label: 'Two', closeable: true, dirty: true, content: <div>Two editor</div> },
  { id: 'three', label: 'Three', pinned: true, closeable: true, content: <div>Three editor</div> },
];

function ControlledWorkspace({
  onClose = vi.fn(),
  requestDirty = vi.fn(async () => 'discard' as const),
}: {
  onClose?: (key: string) => void;
  requestDirty?: (key: string) => Promise<'save' | 'discard' | 'cancel'>;
}) {
  const [items, setItems] = React.useState(initialItems);
  const [selectedKey, setSelectedKey] = React.useState('two');
  return (
    <UiWorkspaceTabs
      ariaLabel="Open editors"
      items={items}
      selectedKey={selectedKey}
      onSelectionChange={setSelectedKey}
      onRequestCloseDirty={requestDirty}
      onClose={(key) => {
        onClose(key);
        setItems((current) => current.filter((item) => item.id !== key));
      }}
    />
  );
}

describe('UiWorkspaceTabs', () => {
  afterEach(cleanup);

  it('keeps all editor panels mounted and names the tab strip', () => {
    render(
      <UiWorkspaceTabs
        ariaLabel="Open editors"
        items={initialItems}
        selectedKey="one"
        onSelectionChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Open editors' })).toBeTruthy();
    expect(screen.getByRole('tablist').closest('[data-panel-attachment]')).toHaveAttribute(
      'data-panel-attachment',
      'integrated',
    );
    expect(screen.getByRole('tablist').closest('[data-panel-attachment]')).toHaveClass('gap-0');
    expect(screen.getByText('One editor')).toBeTruthy();
    expect(screen.getByText('Two editor')).toBeTruthy();
    expect(screen.getByLabelText('Pinned')).toBeTruthy();
    expect(screen.getByLabelText('Unsaved changes')).toBeTruthy();
    expect(screen.getByRole('tablist').parentElement).toHaveClass(
      '[&>.tabs__list-container__scroller]:w-full',
      '[&>.tabs__list-container__scroller]:[scrollbar-width:none]',
      '[&>.tabs__list-container__scroller::-webkit-scrollbar]:hidden',
      '!rounded-none',
      '!bg-transparent',
    );
    expect(screen.getByRole('tablist')).toHaveClass('!p-0');
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('!w-auto', 'flex-none', '!rounded-none');
    }
    expect(document.querySelector('.tabs__indicator, [data-testid="tab-indicator"]')).toHaveClass('hidden');
    expect(screen.getByRole('tablist').closest('[data-workspace-tabs]')).toBeTruthy();
    expect(screen.getByRole('tabpanel')).toHaveClass('!m-0', '!p-0');
  });

  it('exposes a hover hint on the tab', () => {
    render(
      <UiWorkspaceTabs
        ariaLabel="Open editors"
        items={[{
          ...initialItems[0],
          hint: 'Orders today\ndefault-db (SQL Server)',
        }]}
        selectedKey="one"
        onSelectionChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
      'title',
      'Orders today\ndefault-db (SQL Server)',
    );
  });

  it('closes with Delete only while focus is in the strip and focuses the next tab', async () => {
    const onClose = vi.fn();
    render(<ControlledWorkspace onClose={onClose} />);

    const two = screen.getByRole('tab', { name: 'Two' });
    two.focus();
    fireEvent.keyDown(two, { key: 'Delete' });

    await waitFor(() => expect(onClose).toHaveBeenCalledWith('two'));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus());

    fireEvent.keyDown(screen.getByText('Three editor'), { key: 'Delete' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('honors cancellation from the dirty-close contract', async () => {
    const onClose = vi.fn();
    const requestDirty = vi.fn(async () => 'cancel' as const);
    render(<ControlledWorkspace onClose={onClose} requestDirty={requestDirty} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close Two' }));

    await waitFor(() => expect(requestDirty).toHaveBeenCalledWith('two'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers add, move, pin, and all-tabs actions outside the tablist', () => {
    const onAdd = vi.fn();
    const onReorder = vi.fn();
    const onPinChange = vi.fn();
    const onSelectionChange = vi.fn();
    render(
      <UiWorkspaceTabs
        ariaLabel="Open editors"
        items={initialItems}
        selectedKey="two"
        onSelectionChange={onSelectionChange}
        onClose={vi.fn()}
        onAdd={onAdd}
        onReorder={onReorder}
        onPinChange={onPinChange}
        showAddButton
        allowReorder
        allowPin
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move selected tab previous' }));
    expect(onReorder).toHaveBeenCalledWith(['two', 'one', 'three']);
    fireEvent.click(screen.getByRole('button', { name: 'Pin Two' }));
    expect(onPinChange).toHaveBeenCalledWith('two', true);
    fireEvent.click(screen.getByRole('button', { name: 'Add tab' }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Three' }));
    expect(onSelectionChange).toHaveBeenCalledWith('three');
    expect(screen.getByRole('tablist').closest('[data-allow-add]')).toHaveAttribute(
      'data-allow-add',
      'true',
    );
  });

  it('supports a separated editor strip and panel relationship', () => {
    render(
      <UiWorkspaceTabs
        ariaLabel="Open editors"
        items={initialItems}
        selectedKey="one"
        onSelectionChange={vi.fn()}
        onClose={vi.fn()}
        panelAttachment="separated"
      />,
    );

    const root = screen.getByRole('tablist').closest('[data-panel-attachment]');
    expect(root).toHaveAttribute('data-panel-attachment', 'separated');
    expect(root).toHaveClass('gap-2');
  });
});
