import { isPublicAppPath } from '../../../../app/platform/publicAppPaths';

export const shouldRenderAppendooCompanion = (input: {
  isAuthenticated: boolean;
  pathname: string;
  aiEnabled: boolean;
}): boolean => (
  input.isAuthenticated && !isPublicAppPath(input.pathname) && input.aiEnabled
);
