/** Edge/user schema object names — lowercase snake_case domain naming (see docs/standards/data-model.md). */
export const SCHEMA_OBJECT_NAME_RE = /^[a-z][a-z0-9_]{1,127}$/;

export const SCHEMA_OBJECT_NAME_MAX_LENGTH = 128;

const SCHEMA_OBJECT_NAME_INPUT_CHAR_RE = /^[a-z0-9_]$/;

export const SCHEMA_OBJECT_NAME_HELPER_TEXT =
  'Lowercase letters, numbers, and underscores; start with a letter (e.g. customer_orders).';

export type SchemaObjectNameFieldState = {
  invalid: boolean;
  message: string | null;
};

export function validateSchemaObjectName(
  value: string,
  options?: {
    required?: boolean;
    fieldLabel?: string;
    rejectBasePrefix?: boolean;
  },
): string | null {
  const trimmed = value.trim();
  const label = options?.fieldLabel ?? 'Object name';
  const rejectBasePrefix = options?.rejectBasePrefix !== false;

  if (!trimmed) {
    return options?.required === false ? null : `${label} is required.`;
  }

  if (trimmed !== trimmed.toLowerCase()) {
    return `${label} must use lowercase letters only.`;
  }

  if (!/^[a-z]/.test(trimmed)) {
    return `${label} must start with a lowercase letter.`;
  }

  if (!SCHEMA_OBJECT_NAME_RE.test(trimmed)) {
    return `${label} must use lowercase letters, numbers, and underscores only.`;
  }

  if (rejectBasePrefix && trimmed.startsWith('base_')) {
    return `${label} must not use the base_ prefix on edge data sources.`;
  }

  return null;
}

/** Strip disallowed characters while typing; first character must be a lowercase letter. */
export function sanitizeSchemaObjectNameInput(value: string): string {
  const lowered = value.toLowerCase();
  let result = '';

  for (const char of lowered) {
    if (!SCHEMA_OBJECT_NAME_INPUT_CHAR_RE.test(char)) {
      continue;
    }

    if (result.length === 0 && !/^[a-z]$/.test(char)) {
      continue;
    }

    if (result.length >= SCHEMA_OBJECT_NAME_MAX_LENGTH) {
      break;
    }

    result += char;
  }

  return result;
}

export function getSchemaObjectNameFieldState(
  value: string,
  options?: {
    fieldLabel?: string;
    rejectBasePrefix?: boolean;
  },
): SchemaObjectNameFieldState {
  const trimmed = value.trim();

  if (!trimmed) {
    return { invalid: true, message: null };
  }

  const message = validateSchemaObjectName(value, {
    ...options,
    required: true,
  });

  return {
    invalid: Boolean(message),
    message,
  };
}

export const schemaObjectNameFieldProps = (state?: SchemaObjectNameFieldState) => ({
  invalid: Boolean(state?.invalid),
  error: state?.message ?? null,
});

export function assertSchemaObjectName(
  value: string,
  options?: {
    fieldLabel?: string;
    /** Defaults to true — set false when the name may reference an existing platform `base_*` table. */
    rejectBasePrefix?: boolean;
  },
): string {
  const message = validateSchemaObjectName(value, { required: true, ...options });
  if (message) {
    throw new Error(message);
  }
  return value.trim();
}
