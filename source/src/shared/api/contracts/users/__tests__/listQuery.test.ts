import { describe, expect, it } from 'vitest';
import { appendUsersListParams, parseUsersListQuery, USERS_MAX_PAGE_SIZE } from '../listQuery';

describe('parseUsersListQuery', () => {
  it('caps pageSize at USERS_MAX_PAGE_SIZE', () => {
    const query = parseUsersListQuery({ pageSize: 99999 });
    expect(query.pageSize).toBe(USERS_MAX_PAGE_SIZE);
  });

  it('defaults pageSize when missing', () => {
    const query = parseUsersListQuery({});
    expect(query.pageSize).toBe(50);
  });

  it('parses role match logic', () => {
    expect(parseUsersListQuery({ roleMatch: 'and' }).roleMatch).toBe('and');
    expect(parseUsersListQuery({ role_match: 'nor' }).roleMatch).toBe('or');
    expect(parseUsersListQuery({}).roleMatch).toBe('or');
  });

  it('always includes roleMatch in query params', () => {
    const params = new URLSearchParams();
    appendUsersListParams(params, { roleNames: 'ADMIN', roleMatch: 'or' });
    expect(params.get('roleMatch')).toBe('or');
    expect(params.get('roleNames')).toBe('ADMIN');
  });

  it('includes non-default roleMatch in query params', () => {
    const params = new URLSearchParams();
    appendUsersListParams(params, { roleNames: 'ADMIN,USER', roleMatch: 'and' });
    expect(params.get('roleMatch')).toBe('and');
  });

  it('parses person type filter', () => {
    const query = parseUsersListQuery({ personTypeCode: '100.2.1' });
    expect(query.personTypeCode).toBe('100.2.1');
  });

  it('includes person type filter in query params', () => {
    const params = new URLSearchParams();
    appendUsersListParams(params, { personTypeCode: '100.2.1' });
    expect(params.get('personTypeCode')).toBe('100.2.1');
  });
});
