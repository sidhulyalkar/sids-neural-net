export function isArcadeGamePath(pathname: string | null | undefined) {
  if (!pathname) return false;

  const segments = pathname.split('/').filter(Boolean);
  return segments[0] === 'arcade' && segments.length >= 2;
}
