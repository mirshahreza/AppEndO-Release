export function resolveStudioLogsHref(pathname: string, requestId: string): string {
  const cultureStudio = pathname.match(/^(\/[^/]+\/studio)(?:\/|$)/);
  const bareStudio = pathname.match(/^(\/studio)(?:\/|$)/);
  const prefix = cultureStudio?.[1] ?? bareStudio?.[1] ?? '/studio';
  return `${prefix}/logs?requestId=${encodeURIComponent(requestId)}`;
}
