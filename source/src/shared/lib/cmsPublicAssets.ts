/** Public URL for a CMS content asset that belongs to a published row. */
export const cmsPublicAssetPath = (assetId: string): string => (
  `/api/cms-site/public/assets/${encodeURIComponent(assetId)}`
);
