export const SHELL_DESIGNER_ERROR_CODES = [
  'SHELL_VALIDATION_FAILED',
  'SHELL_METADATA_INVALID',
  'SHELL_NOT_FOUND',
  'SHELL_FORBIDDEN',
  'SHELL_KEY_RESERVED',
  'SHELL_KEY_CONFLICT',
  'SHELL_STALE_VERSION',
  'SHELL_PORTAL_STALE',
  'SHELL_LOCKED',
  'SHELL_FOREIGN_ARTIFACT',
  'SHELL_REFERENCE_BLOCKED',
  'SHELL_CAPABILITY_MISSING',
  'SHELL_ASSET_INVALID',
  'SHELL_NAVIGATION_INVALID',
  'SHELL_ACCESSIBILITY_FAILED',
  'SHELL_PERFORMANCE_BUDGET_EXCEEDED',
  'SHELL_PUBLISH_FAILED',
  'SHELL_RECOVERY_REQUIRED',
  'SHELL_PACKAGE_CONFLICT',
  'SHELL_SCHEMA_UNSUPPORTED',
] as const;

export type ShellDesignerErrorCode = (typeof SHELL_DESIGNER_ERROR_CODES)[number];

export class ShellDesignerContractError extends Error {
  readonly name = 'ShellDesignerContractError';

  constructor(
    readonly code: ShellDesignerErrorCode,
    message: string,
    readonly fieldPath?: string,
  ) {
    super(message);
  }
}
