import React, { useEffect, useState } from 'react';
import { AppToast } from '../ui/AppToast';
import { API_ERROR_EVENT, type ApiErrorEventDetail } from './client';

export const GlobalApiErrorToast: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const detail = (event as CustomEvent<ApiErrorEventDetail>).detail;
      if (!detail?.message) {
        return;
      }
      setMessage(detail.message);
    };

    window.addEventListener(API_ERROR_EVENT, handleApiError);
    return () => window.removeEventListener(API_ERROR_EVENT, handleApiError);
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) {
    return null;
  }

  return <AppToast type="error" text={message} />;
};
