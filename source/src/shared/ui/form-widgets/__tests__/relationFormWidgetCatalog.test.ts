import { describe, expect, it } from 'vitest';
import {
  RELATION_FORM_WIDGET_OPTIONS,
  RELATION_FORM_WIDGET_VALUES,
} from '../../../api/contracts/data-api';
import { RELATION_FORM_WIDGET_COMPONENTS } from '../RelationFormWidgetDemos';

describe('RELATION_FORM_WIDGET_COMPONENTS catalog', () => {
  it('covers every RelationFormWidget enum value', () => {
    for (const value of RELATION_FORM_WIDGET_VALUES) {
      expect(RELATION_FORM_WIDGET_COMPONENTS[value]).toBeTypeOf('function');
    }
  });

  it('covers every operator-facing option entry', () => {
    for (const option of RELATION_FORM_WIDGET_OPTIONS) {
      expect(RELATION_FORM_WIDGET_COMPONENTS[option.value]).toBeTypeOf('function');
    }
  });
});
