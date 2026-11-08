/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  applyPayloadFieldTransform,
  buildPayloadFromFormData,
  buildRegionSubmitPayload,
  collectRegionFormDataFromContainer,
  resolveBindingUrl,
  resolveRegionDmlMethod,
  resolveRegionDataForDml,
  resolveRegionSubmitFormData,
  enrichRegionSubmitFormData,
  mergeAuxiliaryRegionSubmitPayload,
} from '../bindingMutationRuntime';
import { resolveRegionDmlUrl } from '../bindingRegionEngine';

describe('bindingMutationRuntime', () => {
  it('resolves URL template params from nested binding context paths', () => {
    const url = resolveBindingUrl(
      '/api/items/{id}/details',
      { form: { itemId: '42' } },
      { id: 'form.itemId' },
    );
    expect(url).toBe('/api/items/42/details');
  });

  it('appends leftover paramPaths as query string (parity with Preview hydration URLs)', () => {
    const url = resolveBindingUrl(
      '/api/items',
      { toolbar: { search: 'abc' }, form: { itemId: '42' } },
      { id: 'form.itemId', search: 'toolbar.search' },
    );
    // `{id}` is not in the template → both keys become query params
    expect(url).toBe('/api/items?id=42&search=abc');
  });

  it('applies scoped filter[in] on All and defers to filter[eq] when set', () => {
    const paramPaths = {
      'filter[contentTypeCode][in]': 'static:ct-article,ct-page',
      'filter[contentTypeCode][eq]': 'gridToolbar.filters.contentTypeCode',
      view: 'static:summary',
    };

    const allUrl = resolveBindingUrl('/api/cms/contents', {}, paramPaths);
    expect(allUrl).toContain('filter%5BcontentTypeCode%5D%5Bin%5D=ct-article%2Cct-page');
    expect(allUrl).toContain('view=summary');
    expect(allUrl).not.toContain('filter%5BcontentTypeCode%5D%5Beq%5D');

    const filteredUrl = resolveBindingUrl(
      '/api/cms/contents',
      { gridToolbar: { filters: { contentTypeCode: 'ct-article' } } },
      paramPaths,
    );
    expect(filteredUrl).toContain('filter%5BcontentTypeCode%5D%5Beq%5D=ct-article');
    expect(filteredUrl).not.toContain('filter%5BcontentTypeCode%5D%5Bin%5D');
  });

  // Bug found (API wizards follow-up): buildDefaultRestOperations (bindingResourceModel.ts)
  // produces REST-convention detail/update/delete endpoints with `:id`-style path params (e.g.
  // `/api/orders/:id`), but resolveBindingUrl only substituted `{id}`-style placeholders. Every
  // published Auto Form / Auto CRUD Edit or Detail region load therefore requested the literal,
  // unresolved `/api/orders/:id?id=123` instead of `/api/orders/123`.
  it('resolves colon-style REST path params (:id), not just {id}', () => {
    const url = resolveBindingUrl(
      '/api/orders/:id',
      { selection: { id: '123' } },
      { id: 'selection.id' },
    );
    expect(url).toBe('/api/orders/123');
  });

  it('does not treat an unrelated colon-prefixed segment as a param when no matching paramPaths key covers it', () => {
    const url = resolveBindingUrl(
      '/api/orders/:id/notes',
      { selection: { id: '123' } },
      { id: 'selection.id' },
    );
    expect(url).toBe('/api/orders/123/notes');
  });

  it('supports explicit static query values beside store-backed params', () => {
    const url = resolveBindingUrl(
      '/api/contents',
      { routeParams: { id: '42' } },
      {
        view: 'static:summary',
        'filter[contentId]': 'routeParams.id',
      },
    );
    expect(url).toBe('/api/contents?view=summary&filter%5BcontentId%5D=42');
  });

  it('maps form fields using payload mapping', () => {
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('role', 'ADMIN');

    const payload = buildPayloadFromFormData(formData, {
      email: 'email',
      role: 'role',
    });

    expect(payload).toEqual({
      email: 'user@example.com',
      role: 'ADMIN',
    });
  });

  it('coerces comma-separated roles into string arrays', () => {
    expect(applyPayloadFieldTransform('DEVELOPER, ADMIN', 'commaSeparatedArray')).toEqual(['DEVELOPER', 'ADMIN']);

    const formData = new FormData();
    formData.set('roles', 'DEVELOPER,ADMIN');
    const payload = buildPayloadFromFormData(
      formData,
      { roles: 'roles' },
      { roles: 'commaSeparatedArray' },
    );
    expect(payload).toEqual({ roles: ['DEVELOPER', 'ADMIN'] });
  });

  it('maps an empty optional lookup to null', () => {
    expect(applyPayloadFieldTransform('', 'nullableString')).toBeNull();
    expect(applyPayloadFieldTransform('policy-id', 'nullableString')).toBe('policy-id');
  });

  it('maps optional boolean override values', () => {
    expect(applyPayloadFieldTransform('', 'nullableBoolean')).toBeNull();
    expect(applyPayloadFieldTransform('true', 'nullableBoolean')).toBe(true);
    expect(applyPayloadFieldTransform('false', 'nullableBoolean')).toBe(false);
  });

  it('builds region submit payload from source column field mappings', () => {
    const formData = new FormData();
    formData.set('input-node-1', 'Jane');
    formData.set('input-node-2', 'jane@example.com');

    const payload = buildRegionSubmitPayload(formData, [
      { nodeId: 'input-node-1', column: 'FIRST_NAME', formFieldName: 'input-node-1' },
      { nodeId: 'input-node-2', column: 'EMAIL', formFieldName: 'input-node-2' },
    ]);

    expect(payload).toEqual({
      FIRST_NAME: 'Jane',
      EMAIL: 'jane@example.com',
    });
  });

  it('maps invalid number field values to null instead of sending raw strings', () => {
    expect(applyPayloadFieldTransform('.', 'number')).toBeNull();
    expect(applyPayloadFieldTransform('  ', 'number')).toBeNull();
    expect(applyPayloadFieldTransform('12', 'number')).toBe(12);
  });

  it('coerces region submit payload values using field transforms', () => {
    const formData = new FormData();
    formData.set('qty-node', '42');
    formData.set('active-node', 'true');

    const payload = buildRegionSubmitPayload(formData, [
      { nodeId: 'qty-node', column: 'QTY', formFieldName: 'qty-node', payloadTransform: 'number' },
      { nodeId: 'active-node', column: 'ACTIVE', formFieldName: 'active-node', payloadTransform: 'boolean' },
    ]);

    expect(payload).toEqual({
      QTY: 42,
      ACTIVE: true,
    });
  });

  it('skips region field mappings that are absent from the submitted form', () => {
    const formData = new FormData();
    formData.set('plain-body-node', 'Updated body text');

    const payload = buildRegionSubmitPayload(formData, [
      { nodeId: 'plain-body-node', column: 'body', formFieldName: 'plain-body-node' },
      { nodeId: 'markdown-body-node', column: 'body', formFieldName: 'markdown-body-node' },
      { nodeId: 'html-body-node', column: 'body', formFieldName: 'html-body-node' },
    ]);

    expect(payload).toEqual({ body: 'Updated body text' });
  });

  it('omits server-managed audit columns from region submit payload', () => {
    const formData = new FormData();
    formData.set('title-node', 'Hello');
    formData.set('audit-node', '999');

    const payload = buildRegionSubmitPayload(formData, [
      { nodeId: 'title-node', column: 'title', formFieldName: 'title-node' },
      { nodeId: 'audit-node', column: 'created_by', formFieldName: 'audit-node' },
    ]);

    expect(payload).toEqual({ title: 'Hello' });
  });

  it('includes logoContentClear auxiliary field in region submit payload', () => {
    const formData = new FormData();
    formData.set('logoContentClear', '1');
    formData.set('title-node', 'Hello');

    const payload = buildRegionSubmitPayload(formData, [
      { nodeId: 'title-node', column: 'titleAr', formFieldName: 'title-node' },
    ]);
    expect(payload.titleAr).toBe('Hello');

    expect(mergeAuxiliaryRegionSubmitPayload(formData, payload).logoContentClear).toBe(true);
  });

  it('enriches logoContentClear auxiliary hidden fields into region submit FormData', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);

    const clearInput = document.createElement('input');
    clearInput.type = 'hidden';
    clearInput.name = 'logoContentClear';
    clearInput.value = '1';
    form.appendChild(clearInput);

    const enriched = enrichRegionSubmitFormData(new FormData(form), [], form);
    expect(enriched.get('logoContentClear')).toBe('1');

    document.body.removeChild(form);
  });

  it('enriches form submit from document when fields sit outside the form element (modal footer form=)', () => {
    const form = document.createElement('form');
    form.id = 'edit-form';
    document.body.appendChild(form);

    const titleInput = document.createElement('input');
    titleInput.name = 'title-node';
    titleInput.value = 'Institute A';
    document.body.appendChild(titleInput);

    const mappings = [
      { nodeId: 'title-node', column: 'titleAr', formFieldName: 'title-node' },
    ] as const;

    const formData = resolveRegionSubmitFormData(form, [...mappings]);
    expect(formData.get('title-node')).toBe('Institute A');

    document.body.removeChild(form);
    document.body.removeChild(titleInput);
  });

  it('collects region form data from a layout container without a form tag', () => {
    const container = document.createElement('div');
    const input = document.createElement('input');
    input.name = 'input-node-1';
    input.value = 'Jane';
    container.appendChild(input);

    const formData = collectRegionFormDataFromContainer(container, ['input-node-1']);
    expect(formData.get('input-node-1')).toBe('Jane');
  });

  it('appends primary key to region DML URL for PUT requests', () => {
    expect(resolveRegionDmlUrl('/api/users', { ID: 42 }, 'ID')).toBe('/api/users/42');
    expect(resolveRegionDmlUrl('/api/users/', { ID: 'abc' }, 'ID')).toBe('/api/users/abc');
    expect(resolveRegionDmlUrl('/api/users', {}, 'ID')).toBe('/api/users');
  });

  it('chooses POST vs PUT based on primary key presence in region data', () => {
    expect(resolveRegionDmlMethod({ ID: 42 }, 'ID')).toBe('PUT');
    expect(resolveRegionDmlMethod({ ID: '' }, 'ID')).toBe('POST');
    expect(resolveRegionDmlMethod({}, 'ID')).toBe('POST');
    expect(resolveRegionDmlMethod({ ID: 1 }, undefined)).toBe('POST');
  });

  it('falls back to selection store id when region data is missing primary key', () => {
    expect(resolveRegionDataForDml({ title: 'News' }, 'id', { selection: { id: '102.001.001' } })).toEqual({
      title: 'News',
      id: '102.001.001',
    });
    expect(resolveRegionDataForDml({ id: '102.001.001', title: 'News' }, 'id', { selection: { id: 'other' } })).toEqual({
      id: '102.001.001',
      title: 'News',
    });
  });
});
