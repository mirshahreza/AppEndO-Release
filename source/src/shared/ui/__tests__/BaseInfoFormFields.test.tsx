// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EMPTY_BASE_INFO_EDIT_FORM } from '../../api/contracts/base-info/editForm';
import { BaseInfoFormFields } from '../BaseInfoFormFields';

describe('BaseInfoFormFields', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders grouped sections with a status side rail', () => {
    render(
      <BaseInfoFormFields
        form={EMPTY_BASE_INFO_EDIT_FORM}
        onFormChange={() => undefined}
        isCreateMode
        parentDisplayValue="Root"
      />,
    );

    expect(screen.getByTestId('record-form')).toHaveAttribute('data-docked', 'true');
    expect(screen.getByTestId('record-form-side')).toHaveTextContent('Status & display');
    expect(screen.getByLabelText('Active')).toBeInTheDocument();
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.queryByText('Record')).not.toBeInTheDocument();
    expect(screen.queryByText('Translations')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Child digits')).toBeInTheDocument();
    expect(screen.queryByText('Title path')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Title (Iran)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('View order')).toBeInTheDocument();
  });

  it('hides child digits when editing', () => {
    render(
      <BaseInfoFormFields
        form={EMPTY_BASE_INFO_EDIT_FORM}
        onFormChange={() => undefined}
        isCreateMode={false}
        parentDisplayValue="Acme"
      />,
    );

    expect(screen.queryByLabelText('Child digits')).not.toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.queryByText('Title path')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Title (canonical)')).toBeInTheDocument();
  });
});
