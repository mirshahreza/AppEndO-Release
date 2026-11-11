const ROOT_FUNCTION_BY_METHOD: Record<string, string> = {
  GET: 'list',
  POST: 'create',
  PUT: 'update',
  PATCH: 'patch',
  DELETE: 'delete',
};

const ID_ONLY_FUNCTION_BY_METHOD: Record<string, string> = {
  GET: 'get',
  POST: 'post',
  PUT: 'update',
  PATCH: 'patch',
  DELETE: 'delete',
};

const resolveHttpMethodFromMessage = (rawMessage: string) => (
  rawMessage.split(/\s+/)[0]?.toUpperCase() || 'GET'
);

const resolveRootFunctionName = (httpMethod: string) => (
  ROOT_FUNCTION_BY_METHOD[httpMethod] ?? httpMethod.toLowerCase()
);

const resolveIdOnlyFunctionName = (httpMethod: string) => (
  ID_ONLY_FUNCTION_BY_METHOD[httpMethod] ?? httpMethod.toLowerCase()
);

export const parseLogParts = (context: string, message: string) => {
  const looksLikeDynamicPathSegment = (segment: string) => {
    if (!segment) return false;
    if (/^\d+$/.test(segment)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) return true;
    if (segment.includes(':') || segment.toLowerCase().includes('%3a')) return true;
    return false;
  };

  const rawMessage = String(message || '').trim();
  if (rawMessage) {
    const httpMethod = resolveHttpMethodFromMessage(rawMessage);
    const [, rawPath = ''] = rawMessage.split(/\s+/, 2);
    const [pathWithHash, queryString = ''] = rawPath.split('?');
    const normalizedPath = pathWithHash.split('#')[0].replace(/^\/+/, '');
    const params = new URLSearchParams(queryString);
    let key = params.get('key') || params.get('cacheKey') || params.get('id') || '-';
    if (normalizedPath) {
      const segments = normalizedPath.split('/').filter(Boolean);
      if (segments[0]?.toLowerCase() !== 'api') {
        return { folder: '-', functionName: '-', key: '-' };
      }

      const routeSegments = segments.slice(1);
      let functionSegments = routeSegments.slice(1);

      if (routeSegments.length === 1) {
        return {
          folder: routeSegments[0],
          functionName: resolveRootFunctionName(httpMethod),
          key,
        };
      }

      if (
        key === '-'
        && functionSegments.length >= 1
        && looksLikeDynamicPathSegment(functionSegments[functionSegments.length - 1])
      ) {
        key = functionSegments[functionSegments.length - 1];
        functionSegments = functionSegments.slice(0, -1);
      }

      while (
        key === '-'
        && functionSegments.length >= 1
        && looksLikeDynamicPathSegment(functionSegments[0])
      ) {
        key = functionSegments[0];
        functionSegments = functionSegments.slice(1);
      }

      return {
        folder: routeSegments[0] || '-',
        functionName: functionSegments.length > 0
          ? functionSegments.join('/')
          : resolveIdOnlyFunctionName(httpMethod),
        key,
      };
    }

    return { folder: '-', functionName: '-', key: '-' };
  }

  return { folder: '-', functionName: '-', key: '-' };
};
