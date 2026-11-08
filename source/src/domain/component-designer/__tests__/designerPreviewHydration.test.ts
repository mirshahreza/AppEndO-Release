import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fetchDesignerHydrationData,
  fetchDesignerHydrationTarget,
  HYDRATION_REFETCH_IN_FLIGHT_KEY,
  hydrationResultsHaveRetryableListErrors,
  hydrationResultsMissingExpectedListData,
  isDesignerHydrationRefetchInFlight,
  pruneHydrationGridErrorsWhenRowsPresent,
  resolveHydrationTargetUrl,
  shouldSkipPreviewHydrationTarget,
} from '../designerPreviewHydration';
import { __resetHydrationCacheForTests } from '../designerPreviewHydrationCache';
import type { PreviewDataSourceHydrationTarget } from '../bindingDynamicActionsCodegen';

describe('designerPreviewHydration', () => {
  const gridTarget: PreviewDataSourceHydrationTarget = {
    dataSourceId: 'base-contact-messages-v',
    dataVar: 'gridData_grid',
    endpoint: '/api/base-contact-messages-v',
    responseMapping: { arrayPath: 'data' },
  };

  const detailTarget: PreviewDataSourceHydrationTarget = {
    dataSourceId: 'base-contact-messages-v',
    dataVar: 'regionData_form',
    endpoint: '/api/base-contact-messages-v/:id',
    urlParams: { id: 'selection.id' },
    responseMapping: { dataPath: 'data' },
  };

  it('skips detail hydration when selection id is missing', () => {
    expect(shouldSkipPreviewHydrationTarget(detailTarget, {})).toBe(true);
    expect(shouldSkipPreviewHydrationTarget(detailTarget, { selection: { id: '12' } })).toBe(false);
    expect(shouldSkipPreviewHydrationTarget(gridTarget, {})).toBe(false);
  });

  it('skips filtered grid hydration when a required filter binding is empty', () => {
    const revisionTarget: PreviewDataSourceHydrationTarget = {
      ...gridTarget,
      queryParams: { 'filter[contentId][eq]': 'selection.id' },
    };

    expect(shouldSkipPreviewHydrationTarget(revisionTarget, {})).toBe(true);
    expect(shouldSkipPreviewHydrationTarget(revisionTarget, { selection: { id: '42' } })).toBe(false);
  });

  it('does not skip list hydration when optional toolbar/column filters are empty', () => {
    const cmsListTarget: PreviewDataSourceHydrationTarget = {
      ...gridTarget,
      endpoint: '/api/cms/contents',
      queryParams: {
        'filter[statusCode][eq]': 'gridToolbar.filters.statusCode',
        'filter[title][like]': 'gridQuery.filters.title',
        search: 'gridToolbar.search',
      },
    };

    expect(shouldSkipPreviewHydrationTarget(cmsListTarget, {})).toBe(false);
    expect(shouldSkipPreviewHydrationTarget(cmsListTarget, {
      gridToolbar: { filters: { statusCode: '' }, search: '' },
      gridQuery: { filters: { title: '' } },
    })).toBe(false);
  });

  it('resolves content-editor comment list filters from routeParams.id', () => {
    const commentsTarget: PreviewDataSourceHydrationTarget = {
      ...gridTarget,
      endpoint: '/api/cms/contents',
      queryParams: {
        view: 'static:summary',
        'filter[parentContentId][eq]': 'routeParams.id',
        'filter[contentTypeCode][eq]': 'static:ct-comment',
      },
    };

    expect(resolveHydrationTargetUrl(commentsTarget, {
      routeParams: { id: '42' },
    })).toContain('filter%5BparentContentId%5D%5Beq%5D=42');
    expect(resolveHydrationTargetUrl(commentsTarget, {
      routeParams: { id: '42' },
    })).toContain('filter%5BcontentTypeCode%5D%5Beq%5D=ct-comment');
  });

  it('applies scoped content-type in filter on All, then defers to toolbar eq', () => {
    const contentsListTarget: PreviewDataSourceHydrationTarget = {
      ...gridTarget,
      endpoint: '/api/cms/contents',
      queryParams: {
        view: 'static:summary',
        'filter[contentTypeCode][in]': 'static:ct-article,ct-page',
        'filter[contentTypeCode][eq]': 'gridToolbar.filters.contentTypeCode',
      },
    };

    expect(resolveHydrationTargetUrl(contentsListTarget, {})).toContain(
      'filter%5BcontentTypeCode%5D%5Bin%5D=ct-article%2Cct-page',
    );
    expect(resolveHydrationTargetUrl(contentsListTarget, {})).not.toContain(
      'filter%5BcontentTypeCode%5D%5Beq%5D',
    );

    expect(resolveHydrationTargetUrl(contentsListTarget, {
      gridToolbar: { filters: { contentTypeCode: 'ct-article' } },
    })).toContain('filter%5BcontentTypeCode%5D%5Beq%5D=ct-article');
    expect(resolveHydrationTargetUrl(contentsListTarget, {
      gridToolbar: { filters: { contentTypeCode: 'ct-article' } },
    })).not.toContain('filter%5BcontentTypeCode%5D%5Bin%5D');
  });

  it('resolves chart filter query params for hydration URLs', () => {
    const chartTarget: PreviewDataSourceHydrationTarget = {
      dataSourceId: 'sales',
      dataVar: 'chartData_chart1',
      endpoint: '/api/sales',
      queryParams: { search: 'chartQuery_chart1.search', status: 'chartQuery_chart1.status' },
    };

    expect(resolveHydrationTargetUrl(chartTarget, {})).toBe('/api/sales');
    expect(resolveHydrationTargetUrl(chartTarget, {
      chartQuery_chart1: { search: 'coffee', status: 'active' },
    })).toBe('/api/sales?search=coffee&status=active');
  });

  it('resolves :id path params for hydration URLs', () => {
    expect(resolveHydrationTargetUrl(detailTarget, { selection: { id: 42 } }))
      .toBe('/api/base-contact-messages-v/42');
    expect(resolveHydrationTargetUrl(gridTarget, {})).toBe('/api/base-contact-messages-v');
  });

  describe('fetchDesignerHydrationData', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      __resetHydrationCacheForTests();
    });

    it('hydrates grid rows even when detail hydration is skipped', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/api/base-contact-messages-v/42')) {
          throw new Error('detail should not be requested on initial load');
        }

        return new Response(JSON.stringify({
          success: true,
          data: [{ id: 1, title: 'Hello contact' }],
        }), { status: 200 });
      });

      const results = await fetchDesignerHydrationData([detailTarget, gridTarget], {});

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/base-contact-messages-v');
      expect(results[gridTarget.dataVar]).toEqual([{ id: 1, title: 'Hello contact' }]);
      expect(results[detailTarget.dataVar]).toBeUndefined();
    });

    it('hydrates detail region records when API returns a single-item data array', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/api/base-contact-messages-v/42')) {
          return new Response(JSON.stringify({
            success: true,
            data: [{
              topic_label: 'Support',
              title: 'Login issue',
              note: 'Cannot sign in.',
            }],
            count: 1,
          }), { status: 200 });
        }

        throw new Error(`unexpected url ${url}`);
      });

      const results = await fetchDesignerHydrationData(
        [{
          ...detailTarget,
          responseMapping: { arrayPath: 'data' },
          resultShape: 'record',
        }],
        { selection: { id: 42 } },
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(results[detailTarget.dataVar]).toEqual({
        topic_label: 'Support',
        title: 'Login issue',
        note: 'Cannot sign in.',
      });
    });

    it('appends noCache=1 when bypassServerCache is set (toolbar refresh)', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: [{ id: 1, title: 'Fresh row' }] }), { status: 200 }),
      );

      await fetchDesignerHydrationTarget(gridTarget, {}, {
        bypassCache: true,
        bypassServerCache: true,
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('noCache=1');
    });

    it('deduplicates concurrent hydration requests for the same URL', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: [{ id: 1, title: 'Cached row' }] }), { status: 200 }),
      );

      await Promise.all([
        fetchDesignerHydrationTarget(gridTarget, {}),
        fetchDesignerHydrationTarget(gridTarget, {}),
        fetchDesignerHydrationTarget(gridTarget, {}),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('falls back to named mock fixtures when fetch throws an error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network Error'));

      const productTarget: PreviewDataSourceHydrationTarget = {
        dataSourceId: 'products-api',
        dataVar: 'productsList',
        endpoint: '/api/products',
        responseMapping: { arrayPath: '' },
      };

      const results = await fetchDesignerHydrationData([productTarget], {
        fixtureSet: 'sales-demo',
      });

      expect(results[productTarget.dataVar]).toBeDefined();
      expect(Array.isArray(results[productTarget.dataVar])).toBe(true);
      expect((results[productTarget.dataVar] as any[])[0].name).toBe('Premium Coffee Beans');
    });

    it('does not use mock fixtures on published shell pages when API fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network Error'));

      const productTarget: PreviewDataSourceHydrationTarget = {
        dataSourceId: 'products-api',
        dataVar: 'productsList',
        endpoint: '/api/products',
        responseMapping: { arrayPath: '' },
      };

      const results = await fetchDesignerHydrationData(
        [productTarget],
        { fixtureSet: 'sales-demo' },
        { allowFixtureFallback: false },
      );

      expect(results[productTarget.dataVar]).toBeUndefined();
      expect(results[`error_${productTarget.dataVar}`]).toBe(true);
    });

    it('respects different named fixture sets (empty-state, large-dataset)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network Error'));

      const productTarget: PreviewDataSourceHydrationTarget = {
        dataSourceId: 'products-api',
        dataVar: 'productsList',
        endpoint: '/api/products',
        responseMapping: { arrayPath: '' },
      };

      const resultsEmpty = await fetchDesignerHydrationData([productTarget], {
        fixtureSet: 'empty-state',
      });
      expect(resultsEmpty[productTarget.dataVar]).toEqual([]);

      const resultsLarge = await fetchDesignerHydrationData([productTarget], {
        fixtureSet: 'large-dataset',
      });
      expect(Array.isArray(resultsLarge[productTarget.dataVar])).toBe(true);
      expect((resultsLarge[productTarget.dataVar] as any[]).length).toBe(100);
    });
  });

  it('detects missing list rows after aborted hydration', () => {
    expect(hydrationResultsMissingExpectedListData({}, [gridTarget])).toBe(true);
    expect(hydrationResultsMissingExpectedListData(
      { error_gridData_grid: true },
      [gridTarget],
    )).toBe(false);
    expect(hydrationResultsMissingExpectedListData(
      { gridData_grid: [] },
      [gridTarget],
    )).toBe(false);
  });

  it('detects retryable shell list hydration errors', () => {
    expect(hydrationResultsHaveRetryableListErrors(
      { error_gridData_grid: true },
      [gridTarget],
    )).toBe(true);
    expect(hydrationResultsHaveRetryableListErrors(
      { error_gridData_grid: true, gridData_grid: [] },
      [gridTarget],
    )).toBe(false);
    expect(hydrationResultsHaveRetryableListErrors(
      { gridData_grid: [{ id: 1 }] },
      [gridTarget],
    )).toBe(false);
  });

  it('detects hydration refetch-in-flight flag on data context', () => {
    expect(isDesignerHydrationRefetchInFlight({})).toBe(false);
    expect(isDesignerHydrationRefetchInFlight({
      [HYDRATION_REFETCH_IN_FLIGHT_KEY]: true,
    })).toBe(true);
  });

  it('drops grid hydration error when stale rows remain', () => {
    const next: Record<string, unknown> = {
      gridData_grid: [{ id: 1 }],
      error_gridData_grid: true,
    };
    pruneHydrationGridErrorsWhenRowsPresent(next, [gridTarget]);
    expect(next.error_gridData_grid).toBeUndefined();
  });
});
