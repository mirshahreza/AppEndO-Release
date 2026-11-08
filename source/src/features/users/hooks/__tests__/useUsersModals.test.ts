/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  PERSON_TYPE_COMPANY,
  PERSON_TYPE_INDIVIDUAL,
} from '../../../../shared/profile/personType';
import { useUsersModals } from '../useUsersModals';

describe('useUsersModals', () => {
  it('openCreateIndividualModal sets individual person type on the create form', () => {
    const { result } = renderHook(() => useUsersModals());

    act(() => {
      result.current.openCreateIndividualModal();
    });

    expect(result.current.showCreateModal).toBe(true);
    expect(result.current.form.personTypeCode).toBe(PERSON_TYPE_INDIVIDUAL);
    expect(result.current.createPersonTypeCode).toBe(PERSON_TYPE_INDIVIDUAL);
  });

  it('openCreateCompanyModal sets company person type on the create form', () => {
    const { result } = renderHook(() => useUsersModals());

    act(() => {
      result.current.openCreateCompanyModal();
    });

    expect(result.current.showCreateModal).toBe(true);
    expect(result.current.form.personTypeCode).toBe(PERSON_TYPE_COMPANY);
    expect(result.current.createPersonTypeCode).toBe(PERSON_TYPE_COMPANY);
  });

  it('switching create type while the modal stays open updates person type', () => {
    const { result } = renderHook(() => useUsersModals());

    act(() => {
      result.current.openCreateIndividualModal();
    });
    act(() => {
      result.current.openCreateCompanyModal();
    });

    expect(result.current.form.personTypeCode).toBe(PERSON_TYPE_COMPANY);
    expect(result.current.createPersonTypeCode).toBe(PERSON_TYPE_COMPANY);
  });

  it('closeCreateModal clears create person type', () => {
    const { result } = renderHook(() => useUsersModals());

    act(() => {
      result.current.openCreateIndividualModal();
    });
    act(() => {
      result.current.closeCreateModal();
    });

    expect(result.current.showCreateModal).toBe(false);
    expect(result.current.createPersonTypeCode).toBeNull();
  });
});
