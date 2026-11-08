import { describe, expect, it } from 'vitest';
import {
  formatColumnDisplayNameFormula,
  humanizeColumnFieldName,
  isColumnDisplayNameFormula,
  normalizeColumnDisplayLabelForStorage,
  resolveColumnDisplayName,
} from '../resolveColumnDisplayName';

describe('resolveColumnDisplayName', () => {
  it('formats the fixed translate formula', () => {
    expect(formatColumnDisplayNameFormula('order_date')).toBe('translate(order_date)');
  });

  it('treats empty and formula as untouched', () => {
    expect(isColumnDisplayNameFormula('', 'order_date')).toBe(true);
    expect(isColumnDisplayNameFormula('translate(order_date)', 'order_date')).toBe(true);
    expect(isColumnDisplayNameFormula('Order Date', 'order_date')).toBe(false);
  });

  it('humanizes underscores with title case', () => {
    expect(humanizeColumnFieldName('order_date')).toBe('Order Date');
    expect(humanizeColumnFieldName('first_name')).toBe('First Name');
    expect(humanizeColumnFieldName('customerId')).toBe('Customer Id');
  });

  it('uses culture translation when present', () => {
    const translate = (key: string) => (key === 'order_date' ? 'تاریخ سفارش' : key);
    expect(resolveColumnDisplayName('order_date', translate)).toBe('تاریخ سفارش');
  });

  it('falls back to humanize when translation missing', () => {
    const translate = (key: string) => key;
    expect(resolveColumnDisplayName('order_date', translate)).toBe('Order Date');
  });

  it('uses custom override when user changed the value', () => {
    const translate = (key: string) => key;
    expect(resolveColumnDisplayName('order_date', translate, 'Ship By')).toBe('Ship By');
  });

  it('stores empty for the default formula', () => {
    expect(normalizeColumnDisplayLabelForStorage('order_date', 'translate(order_date)')).toBe('');
    expect(normalizeColumnDisplayLabelForStorage('order_date', 'Ship By')).toBe('Ship By');
  });
});
