// ---------------------------------------------------------------------------
// Asset path helper for GitHub Pages base URL compatibility
// ---------------------------------------------------------------------------
// Vite's `base` config only rewrites import-resolved assets (JS, CSS, etc.).
// Paths passed as runtime strings (e.g. to Three.js loaders or useTexture)
// must be manually prefixed with the base URL so they resolve correctly when
// the site is deployed under a sub-path like /spacesim/.
// ---------------------------------------------------------------------------

/**
 * Prepend Vite's configured base path to a public asset URL.
 *
 * In development `import.meta.env.BASE_URL` is `'/'`, so nothing changes.
 * In a production build with `base: '/spacesim/'` it becomes `'/spacesim/'`.
 *
 * Usage:
 *   assetPath('/textures/earth_day_8k.jpg')
 *   → dev:  '/textures/earth_day_8k.jpg'
 *   → prod: '/spacesim/textures/earth_day_8k.jpg'
 */
export function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL; // always ends with '/'
  // Strip leading slash from the path to avoid double-slashes
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${clean}`;
}
