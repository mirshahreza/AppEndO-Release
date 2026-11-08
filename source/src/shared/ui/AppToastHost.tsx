import React, { useEffect, useState } from 'react';
import { AppToast } from './AppToast';
import {
  dismissAppFeedbackToast,
  subscribeAppFeedbackToast,
  type AppFeedbackToastMessage,
} from './appFeedbackToast';

/**
 * Global host for {@link showAppFeedbackToast} — top-center AppToast (Base Components / ui-core).
 * Mount once near the app root (see `App.tsx`).
 */
export const AppToastHost: React.FC = () => {
  const [toast, setToast] = useState<AppFeedbackToastMessage | null>(null);

  useEffect(() => subscribeAppFeedbackToast(setToast), []);

  if (!toast) {
    return null;
  }

  return (
    <AppToast
      type={toast.type}
      text={toast.text}
      onDismiss={dismissAppFeedbackToast}
    />
  );
};
