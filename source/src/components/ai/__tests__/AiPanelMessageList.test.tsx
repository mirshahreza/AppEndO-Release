// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiPanelMessageList } from '../AiPanelMessageList';
import { CHAT_MESSAGE_VIRTUALIZE_THRESHOLD } from '../../../shared/lib/gridVirtualizationConstants';

const mockGetVirtualItems = vi.fn<() => Array<{ key: number; index: number; start: number; end: number }>>(() => []);

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => mockGetVirtualItems(),
    getTotalSize: () => CHAT_MESSAGE_VIRTUALIZE_THRESHOLD * 80,
    measureElement: vi.fn(),
  }),
}));

describe('AiPanelMessageList', () => {
  it('renders every message below the virtualization threshold', () => {
    const count = CHAT_MESSAGE_VIRTUALIZE_THRESHOLD - 1;
    render(
      <AiPanelMessageList
        messageCount={count}
        renderMessage={(index) => <div data-testid={`msg-${index}`}>{index}</div>}
      />,
    );

    expect(screen.getByTestId('msg-0')).toBeTruthy();
    expect(screen.getByTestId(`msg-${count - 1}`)).toBeTruthy();
    expect(screen.queryByTestId(`msg-${count}`)).toBeNull();
  });

  it('uses virtualization at the threshold', () => {
    mockGetVirtualItems.mockReturnValue([{ key: 0, index: 0, start: 0, end: 80 }]);

    const { container } = render(
      <AiPanelMessageList
        messageCount={CHAT_MESSAGE_VIRTUALIZE_THRESHOLD}
        renderMessage={(index) => <div>{index}</div>}
      />,
    );

    expect(container.querySelector('[data-index="0"]')).toBeTruthy();
  });
});
