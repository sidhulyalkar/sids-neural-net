/**
 * Camera permission failures are not consistently surfaced as DOMException
 * instances across browsers, realms, and test environments. Match the stable
 * Web API error name without depending on a particular global constructor.
 */
export function isCameraPermissionDenied(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('name' in error)) return false;
  const name = (error as { name?: unknown }).name;
  return name === 'NotAllowedError' || name === 'SecurityError';
}
