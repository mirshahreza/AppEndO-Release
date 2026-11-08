import type {
  BaseComponentOptionCondition,
  BaseComponentOptionMeta,
  BaseComponentOptionResolution,
  BaseComponentOptionValueState,
} from './baseComponentOptionTypes';

const sameValue = (left: unknown, right: unknown): boolean =>
  Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right);

export const evaluateBaseComponentOptionCondition = (
  condition: BaseComponentOptionCondition,
  values: Readonly<BaseComponentOptionValueState>,
): boolean => {
  if ('equals' in condition) {
    return sameValue(values[condition.optionId], condition.equals);
  }
  if ('in' in condition) {
    return condition.in.some((value) => sameValue(values[condition.optionId], value));
  }
  if ('all' in condition) {
    return condition.all.every((child) =>
      evaluateBaseComponentOptionCondition(child, values),
    );
  }
  return condition.any.some((child) =>
    evaluateBaseComponentOptionCondition(child, values),
  );
};

const isEngaged = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
};

const includesValue = (values: readonly unknown[], candidate: unknown): boolean =>
  values.some((value) => sameValue(value, candidate));

/**
 * Resolves a component option state to a deterministic, catalog-valid state.
 * Disabled choices and invalid closed values reset to metadata defaults.
 * Unsatisfiable requires/conflicts are reported rather than silently invented.
 */
export const resolveBaseComponentConfig = (
  options: readonly BaseComponentOptionMeta[],
  requestedValues: Readonly<BaseComponentOptionValueState> = {},
): BaseComponentOptionResolution => {
  const values: BaseComponentOptionValueState = {};
  const adjustments: BaseComponentOptionResolution['adjustments'][number][] = [];
  const violations: BaseComponentOptionResolution['violations'][number][] = [];
  const optionIds = new Set(options.map(({ id }) => id));

  for (const requestedId of Object.keys(requestedValues)) {
    if (!optionIds.has(requestedId)) {
      violations.push({
        optionId: requestedId,
        message: 'Unknown option value was ignored.',
      });
    }
  }

  for (const option of options) {
    const requested = Object.prototype.hasOwnProperty.call(requestedValues, option.id)
      ? requestedValues[option.id]
      : option.defaultValue;
    if (option.values && !includesValue(option.values, requested)) {
      values[option.id] = option.defaultValue;
      adjustments.push({
        optionId: option.id,
        from: requested,
        to: option.defaultValue,
        reason: 'Value is outside the option’s closed values.',
      });
    } else if (option.control === 'checkbox' && typeof requested !== 'boolean') {
      values[option.id] = option.defaultValue;
      adjustments.push({
        optionId: option.id,
        from: requested,
        to: option.defaultValue,
        reason: 'Checkbox values must be boolean.',
      });
    } else {
      values[option.id] = requested;
    }
  }

  // Conditions can cascade, so resolve to a fixed point in declaration order.
  for (let pass = 0; pass < options.length + 1; pass += 1) {
    let changed = false;
    for (const option of options) {
      const enabled =
        !option.enabledWhen ||
        evaluateBaseComponentOptionCondition(option.enabledWhen, values);
      if (!enabled && !sameValue(values[option.id], option.defaultValue)) {
        const from = values[option.id];
        values[option.id] = option.defaultValue;
        adjustments.push({
          optionId: option.id,
          from,
          to: option.defaultValue,
          reason: 'Option is disabled by its metadata condition.',
        });
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const option of options) {
    if (!isEngaged(values[option.id])) continue;

    for (const requiredId of option.requires ?? []) {
      if (!isEngaged(values[requiredId])) {
        violations.push({
          optionId: option.id,
          relatedOptionId: requiredId,
          message: `Option requires "${requiredId}" to have a value.`,
        });
      }
    }
    for (const conflictId of option.conflicts ?? []) {
      if (isEngaged(values[conflictId])) {
        violations.push({
          optionId: option.id,
          relatedOptionId: conflictId,
          message: `Option conflicts with "${conflictId}".`,
        });
      }
    }
  }

  const optionState = Object.fromEntries(
    options.map((option) => [
      option.id,
      {
        visible:
          !option.visibleWhen ||
          evaluateBaseComponentOptionCondition(option.visibleWhen, values),
        enabled:
          !option.enabledWhen ||
          evaluateBaseComponentOptionCondition(option.enabledWhen, values),
      },
    ]),
  );

  return { values, optionState, adjustments, violations };
};
