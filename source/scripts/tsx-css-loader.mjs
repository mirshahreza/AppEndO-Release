export async function load(url, context, nextLoad) {
  const path = url.split('?')[0] ?? '';
  if (path.endsWith('.css')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default "";',
    };
  }
  return nextLoad(url, context);
}
