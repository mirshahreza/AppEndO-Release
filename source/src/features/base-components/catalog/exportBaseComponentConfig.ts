import type {
  BaseComponentOptionMeta,
  BaseComponentOptionValueState,
  BaseComponentsConfigExport,
} from './baseComponentOptionTypes';

const setAtDotPath = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void => {
  const segments = path.split('.');
  let cursor = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    const current = cursor[segment];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  });
};

const localOptionPath = (option: BaseComponentOptionMeta): string => {
  const prefix = `${option.componentId}.`;
  return option.id.startsWith(prefix) ? option.id.slice(prefix.length) : option.id;
};

/**
 * Produces the frozen BC-1A export shape. Catalog-only preview state is
 * intentionally omitted and can never leak into a production component config.
 */
export const exportBaseComponentConfig = (
  options: readonly BaseComponentOptionMeta[],
  values: Readonly<BaseComponentOptionValueState>,
): BaseComponentsConfigExport => {
  const result: BaseComponentsConfigExport = {
    public: {},
    composition: {},
    demo: {
      fixtures: {},
      scenarios: {},
    },
  };

  for (const option of options) {
    const value = Object.prototype.hasOwnProperty.call(values, option.id)
      ? values[option.id]
      : option.defaultValue;
    switch (option.disposition) {
      case 'public-prop':
        setAtDotPath(result.public, option.propPath!, value);
        break;
      case 'composition-prop':
        setAtDotPath(result.composition, option.propPath!, value);
        break;
      case 'fixture':
        setAtDotPath(result.demo.fixtures, localOptionPath(option), value);
        break;
      case 'scenario':
        setAtDotPath(result.demo.scenarios, localOptionPath(option), value);
        break;
      case 'catalog-only':
        break;
    }
  }

  return result;
};
