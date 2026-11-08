import type { ReactNode } from 'react';

type ConfigSectionSource = {
  unwrapConfigSections?: true;
  (props: never): ReactNode;
};

function resolveComponentFunction(type: unknown): ConfigSectionSource | null {
  if (typeof type === 'function') {
    return type as ConfigSectionSource;
  }
  if (type && typeof type === 'object') {
    const nested = type as { render?: unknown; type?: unknown };
    if (typeof nested.render === 'function') {
      return nested.render as ConfigSectionSource;
    }
    if (nested.type) {
      return resolveComponentFunction(nested.type);
    }
  }
  return null;
}

/** Mark a field-group component so the options accordion lists its inner FormSections. */
export function markBaseComponentsConfigSectionSource<T>(component: T): T {
  (component as ConfigSectionSource).unwrapConfigSections = true;
  return component;
}

export function unwrapBaseComponentsConfigSectionSource(
  type: unknown,
  props: unknown,
): ReactNode | null {
  const component = resolveComponentFunction(type);
  if (!component?.unwrapConfigSections) {
    return null;
  }
  return component(props as never);
}
