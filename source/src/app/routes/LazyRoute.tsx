import React, { Suspense, type ReactNode } from 'react';
import { AppRouteLoading } from '../../components/AppRouteLoading';

/** Lazy page chunks inside an already-mounted shell — keep chrome; load in the content host. */
export const LazyRoute: React.FC<{ children: ReactNode }> = ({ children }) => (
  <Suspense fallback={<AppRouteLoading variant="embedded" />}>{children}</Suspense>
);
