import React from 'react';
import { Toast } from '@heroui/react';

const HeroToast = Toast as any;

/**
 * Legacy HeroUI toast portal — kept for any remaining `toast()` call sites.
 * Default placement is top-center to match AppToast / ui-core feedback standards.
 * Prefer {@link AppToastHost} + {@link showAppFeedbackToast} for new feedback.
 */
export const UiToastProvider: React.FC = () => (
  <HeroToast.Provider placement="top" />
);
