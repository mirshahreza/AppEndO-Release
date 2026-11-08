/** @vitest-environment jsdom */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BaseInfoFormFields } from '../BaseInfoFormFields';
import { EMPTY_BASE_INFO_EDIT_FORM } from '../../api/contracts/base-info/editForm';

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-mock">monaco</div>,
}));

describe('BaseInfoFormFields smoke', () => {
  it('renders edit form with uiHtml editor', () => {
    const { container } = render(
      <BaseInfoFormFields
        form={{
          ...EMPTY_BASE_INFO_EDIT_FORM,
          title: 'Individual',
          uiHtml: '<i data-lucide="User"></i>',
        }}
        onFormChange={() => {}}
        isCreateMode={false}
        parentDisplayValue="100.2"
      />,
    );
    expect(container.querySelector('[aria-label="UI Html"]')).toBeTruthy();
  });
});
