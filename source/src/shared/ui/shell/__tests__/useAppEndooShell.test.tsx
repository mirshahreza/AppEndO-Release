// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppEndooShell } from '../useAppEndooShell';

const mockNavigate = vi.fn();
const mockUseAiSettingsQuery = vi.fn();
const mockUseOptionalPlatformMount = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../../app/platform/PlatformMountContext', () => ({
  useOptionalPlatformMount: () => mockUseOptionalPlatformMount(),
}));

vi.mock('../../../api/queries/aiModels', () => ({
  useAiSettingsQuery: () => mockUseAiSettingsQuery(),
}));

describe('useAppEndooShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOptionalPlatformMount.mockReturnValue({
      id: 'studio',
      pathPrefix: '',
    });
    mockUseAiSettingsQuery.mockReturnValue({
      data: undefined,
      isFetched: false,
    });
  });

  it('does not close a restored open panel while AI settings are still loading', () => {
    const onOpenChange = vi.fn();

    renderHook(() => useAppEndooShell(true, onOpenChange));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes a restored open panel only after settings resolve with AI disabled', async () => {
    const onOpenChange = vi.fn();

    const { rerender } = renderHook(
      ({ isOpen }) => useAppEndooShell(isOpen, onOpenChange),
      { initialProps: { isOpen: true } },
    );

    expect(onOpenChange).not.toHaveBeenCalled();

    mockUseAiSettingsQuery.mockReturnValue({
      data: { enabled: false, providers: [], models: [] },
      isFetched: true,
    });
    rerender({ isOpen: true });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('does not throw when PlatformMountProvider is missing', () => {
    mockUseOptionalPlatformMount.mockReturnValue(null);
    const onOpenChange = vi.fn();

    expect(() => renderHook(() => useAppEndooShell(false, onOpenChange))).not.toThrow();
  });
});
