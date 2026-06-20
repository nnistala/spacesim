import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Texture URL configuration
// Swap these with local paths once real high-res textures are downloaded.
// ---------------------------------------------------------------------------
export const TEXTURE_URLS = {
  earthDay:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg/2560px-Solarsystemscope_texture_8k_earth_daymap.jpg',
  earthNight:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Solarsystemscope_texture_8k_earth_nightmap.jpg/1280px-Solarsystemscope_texture_8k_earth_nightmap.jpg',
  moon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Solarsystemscope_texture_8k_moon.jpg/2560px-Solarsystemscope_texture_8k_moon.jpg',
} as const;

// ---------------------------------------------------------------------------
// PROGRESSIVE TEXTURE TIERS
// Procedural (instant, offline) -> 2K real photographic (fast, CORS-safe) ->
// 8K NASA-derived (loads on approach). The highest successfully-loaded tier
// upgrades the live texture in place; failures keep the procedural floor.
// ---------------------------------------------------------------------------
export interface TextureTier {
  url: string;
  /** Higher = better. The highest successfully-loaded tier wins. */
  priority: number;
}

export const TEXTURE_TIERS: Record<string, TextureTier[]> = {
  earthDay: [
    { url: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', priority: 1 },
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg/4096px-Solarsystemscope_texture_8k_earth_daymap.jpg',
      priority: 2,
    },
  ],
  earthNight: [
    { url: 'https://threejs.org/examples/textures/planets/earth_lights_2048.png', priority: 1 },
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Solarsystemscope_texture_8k_earth_nightmap.jpg/4096px-Solarsystemscope_texture_8k_earth_nightmap.jpg',
      priority: 2,
    },
  ],
  earthSpecular: [
    { url: 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg', priority: 1 },
  ],
  earthClouds: [
    { url: 'https://threejs.org/examples/textures/planets/earth_clouds_2048.png', priority: 1 },
  ],
  moon: [
    { url: 'https://threejs.org/examples/textures/planets/moon_1024.jpg', priority: 1 },
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Solarsystemscope_texture_8k_moon.jpg/4096px-Solarsystemscope_texture_8k_moon.jpg',
      priority: 2,
    },
  ],
};

export interface ProgressiveTextureOptions {
  colorSpace?: THREE.ColorSpace;
  /** An immediately-displayable image (e.g. a procedural fallback). */
  initialImage?: TexImageSource;
  wrapS?: THREE.Wrapping;
  wrapT?: THREE.Wrapping;
}

/**
 * Returns a texture immediately and progressively upgrades it as higher-priority
 * tiers finish loading. Failed tiers are ignored, so the procedural/initial
 * image always remains as a floor.
 */
export function loadProgressiveTexture(
  tiers: TextureTier[],
  options: ProgressiveTextureOptions = {},
): THREE.Texture {
  const {
    colorSpace = THREE.SRGBColorSpace,
    initialImage,
    wrapS = THREE.RepeatWrapping,
    wrapT = THREE.ClampToEdgeWrapping,
  } = options;

  const tex = new THREE.Texture();
  tex.colorSpace = colorSpace;
  tex.wrapS = wrapS;
  tex.wrapT = wrapT;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;

  if (initialImage) {
    tex.image = initialImage as unknown as HTMLImageElement;
    tex.needsUpdate = true;
  }

  let bestPriority = -Infinity;

  for (const tier of tiers) {
    loader.load(
      tier.url,
      (loaded) => {
        if (tier.priority <= bestPriority) return;
        bestPriority = tier.priority;
        tex.image = loaded.image;
        tex.colorSpace = colorSpace;
        tex.needsUpdate = true;
      },
      undefined,
      () => {
        // Ignore — keep whatever tier (or the procedural floor) we already have.
      },
    );
  }

  return tex;
}

// ---------------------------------------------------------------------------
// Shared loader instance (uses Three.js cache automatically)
// ---------------------------------------------------------------------------
const loader = new THREE.TextureLoader();
loader.crossOrigin = 'anonymous';

// ---------------------------------------------------------------------------
// tryLoadTexture
// Attempts to load a URL. Returns the loaded texture on success, or a 1x1
// solid-color fallback texture on failure.
// ---------------------------------------------------------------------------
export function tryLoadTexture(
  url: string,
  fallbackColor: string = '#808080',
): THREE.Texture {
  const fallback = makeSolidTexture(fallbackColor);

  // We return the fallback immediately; the real texture is set up as a
  // promise-based swap so the caller always gets a valid Texture reference.
  const tex = fallback.clone();
  tex.colorSpace = THREE.SRGBColorSpace;

  loader.load(
    url,
    (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = 16;
      loaded.minFilter = THREE.LinearMipmapLinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      loaded.generateMipmaps = true;
      // Copy loaded image data into our returned texture so references stay valid
      tex.image = loaded.image;
      tex.needsUpdate = true;
    },
    undefined,
    () => {
      // Silently keep fallback — no console noise in production
    },
  );

  return tex;
}

// ---------------------------------------------------------------------------
// Solid-color 1x1 helper
// ---------------------------------------------------------------------------
function makeSolidTexture(color: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Seeded pseudo-random number generator (deterministic textures)
// ---------------------------------------------------------------------------
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------------------
// Simplex-style value noise (2D, fast approximation)
// ---------------------------------------------------------------------------
function valueNoise2D(
  x: number,
  y: number,
  _rand: () => number,
  _seed: number,
): number {
  // Use a hash approach for deterministic grid noise
  // (_rand kept in signature for API compatibility with fbm caller)
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smoothstep interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  // Hash corners
  const hash = (px: number, py: number) => {
    let h = (px * 374761393 + py * 668265263 + _seed) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  };

  const n00 = hash(ix, iy);
  const n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1);
  const n11 = hash(ix + 1, iy + 1);

  // Bilinear interpolation with smoothstep
  const nx0 = n00 + sx * (n10 - n00);
  const nx1 = n01 + sx * (n11 - n01);
  return nx0 + sy * (nx1 - nx0);
}

// Fractal Brownian Motion
function fbm(
  x: number,
  y: number,
  octaves: number,
  rand: () => number,
  seed: number,
): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise2D(x * frequency, y * frequency, rand, seed + i * 1000);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ---------------------------------------------------------------------------
// generateEarthTexture
// Creates a recognisable blue-ocean / green-brown-continent procedural map.
// ---------------------------------------------------------------------------
export function generateEarthTexture(width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const rand = seededRandom(42);

  // Color palette
  const deepOcean = [15, 30, 80];
  const shallowOcean = [30, 80, 140];
  const coastShallow = [40, 110, 160];
  const sand = [194, 178, 128];
  const grassland = [60, 120, 50];
  const forest = [30, 80, 30];
  const mountain = [130, 110, 90];
  const snow = [230, 235, 240];
  const desert = [180, 155, 100];

  for (let y = 0; y < height; y++) {
    // Latitude in radians (-pi/2 to pi/2)
    const lat = ((y / height) - 0.5) * Math.PI;
    const absLat = Math.abs(lat);

    for (let x = 0; x < width; x++) {
      // Longitude in radians (0 to 2*pi)
      const lon = (x / width) * Math.PI * 2;

      // Convert to sphere coordinates for seamless noise sampling
      const nx = Math.cos(lat) * Math.cos(lon);
      const ny = Math.sin(lat);
      const nz = Math.cos(lat) * Math.sin(lon);

      // Multi-octave continent noise
      const continentScale = 2.0;
      const continentNoise = fbm(
        nx * continentScale + 10,
        nz * continentScale + 10,
        6,
        rand,
        42,
      );

      // Additional detail noise
      const detailNoise = fbm(nx * 8 + 5, nz * 8 + 5, 4, rand, 137);
      const mountainNoise = fbm(nx * 12 + 20, nz * 12 + 20, 5, rand, 271);

      // Elevation: combine continent shape with detail
      // Add latitude-dependent bias (more land in northern hemisphere, roughly)
      const latBias = ny * 0.05;
      let elevation = continentNoise + latBias + detailNoise * 0.15;

      // Sea level threshold
      const seaLevel = 0.48;

      let r: number, g: number, b: number;

      if (elevation < seaLevel) {
        // Ocean
        const depth = (seaLevel - elevation) / seaLevel;
        if (depth > 0.3) {
          r = deepOcean[0];
          g = deepOcean[1];
          b = deepOcean[2];
        } else if (depth > 0.1) {
          const t = (depth - 0.1) / 0.2;
          r = shallowOcean[0] + t * (deepOcean[0] - shallowOcean[0]);
          g = shallowOcean[1] + t * (deepOcean[1] - shallowOcean[1]);
          b = shallowOcean[2] + t * (deepOcean[2] - shallowOcean[2]);
        } else {
          const t = depth / 0.1;
          r = coastShallow[0] + t * (shallowOcean[0] - coastShallow[0]);
          g = coastShallow[1] + t * (shallowOcean[1] - coastShallow[1]);
          b = coastShallow[2] + t * (shallowOcean[2] - coastShallow[2]);
        }
      } else {
        // Land
        const landElevation = (elevation - seaLevel) / (1.0 - seaLevel);
        const moistureNoise = fbm(nx * 4 + 50, nz * 4 + 50, 4, rand, 999);

        // Determine biome based on latitude, elevation, and moisture
        if (absLat > 1.2) {
          // Polar ice/snow
          r = snow[0];
          g = snow[1];
          b = snow[2];
        } else if (landElevation > 0.6) {
          // Mountain peaks with snow
          const snowLine = 0.7 - absLat * 0.2;
          if (landElevation > snowLine) {
            const t = Math.min((landElevation - snowLine) / 0.15, 1.0);
            r = mountain[0] + t * (snow[0] - mountain[0]);
            g = mountain[1] + t * (snow[1] - mountain[1]);
            b = mountain[2] + t * (snow[2] - mountain[2]);
          } else {
            r = mountain[0];
            g = mountain[1];
            b = mountain[2];
          }
          // Add mountainNoise variation
          const mv = mountainNoise * 20 - 10;
          r = Math.max(0, Math.min(255, r + mv));
          g = Math.max(0, Math.min(255, g + mv));
          b = Math.max(0, Math.min(255, b + mv));
        } else if (absLat < 0.45 && moistureNoise < 0.4) {
          // Desert (tropical/subtropical low moisture)
          r = desert[0] + detailNoise * 30 - 15;
          g = desert[1] + detailNoise * 25 - 12;
          b = desert[2] + detailNoise * 20 - 10;
        } else if (moistureNoise > 0.55) {
          // Forest (high moisture)
          const t = landElevation * 2;
          r = forest[0] + t * 15 + detailNoise * 20 - 10;
          g = forest[1] + t * 10 + detailNoise * 25 - 12;
          b = forest[2] + t * 8 + detailNoise * 10 - 5;
        } else {
          // Grassland / temperate
          const t = landElevation;
          r = grassland[0] + t * 40 + detailNoise * 25 - 12;
          g = grassland[1] - t * 20 + detailNoise * 20 - 10;
          b = grassland[2] + t * 20 + detailNoise * 15 - 7;
        }

        // Coastal sand strip
        if (landElevation < 0.03) {
          const coastT = landElevation / 0.03;
          r = sand[0] + coastT * (r - sand[0]);
          g = sand[1] + coastT * (g - sand[1]);
          b = sand[2] + coastT * (b - sand[2]);
        }
      }

      const idx = (y * width + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  return tex;
}

// ---------------------------------------------------------------------------
// generateEarthNightTexture
// Warm amber city-light dots on a near-black background.
// ---------------------------------------------------------------------------
export function generateEarthNightTexture(width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const rand = seededRandom(42);

  // First generate the same continent mask so lights appear on land
  for (let y = 0; y < height; y++) {
    const lat = ((y / height) - 0.5) * Math.PI;
    const absLat = Math.abs(lat);

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * Math.PI * 2;
      const nx = Math.cos(lat) * Math.cos(lon);
      const ny = Math.sin(lat);
      const nz = Math.cos(lat) * Math.sin(lon);

      const continentNoise = fbm(nx * 2 + 10, nz * 2 + 10, 6, rand, 42);
      const detailNoise = fbm(nx * 8 + 5, nz * 8 + 5, 4, rand, 137);
      const latBias = ny * 0.05;
      const elevation = continentNoise + latBias + detailNoise * 0.15;
      const seaLevel = 0.48;

      const idx = (y * width + x) * 4;

      if (elevation >= seaLevel) {
        // Land: potentially has city lights
        const landElev = (elevation - seaLevel) / (1.0 - seaLevel);

        // Population density heuristic: more lights at mid-latitudes, lower elevations
        // and in "wet" areas (Europe, East Asia, East US analogues)
        const popNoise = fbm(nx * 6 + 77, nz * 6 + 77, 5, rand, 555);
        const coastProximity = Math.max(0, 1.0 - landElev * 5);
        const latFactor = absLat < 0.3 ? 0.4 : absLat < 0.85 ? 1.0 : 0.2;

        let lightIntensity = popNoise * coastProximity * latFactor;

        // High mountains and polar: no lights
        if (landElev > 0.5 || absLat > 1.1) lightIntensity = 0;

        // Apply threshold to create discrete light clusters
        const clusterNoise = fbm(nx * 20 + 33, nz * 20 + 33, 3, rand, 888);
        lightIntensity *= clusterNoise;

        if (lightIntensity > 0.25) {
          // City lights: warm amber/orange
          const brightness = Math.pow((lightIntensity - 0.25) / 0.75, 0.8);
          const fineDetail = fbm(nx * 50, nz * 50, 2, rand, 1234);
          const finalBright = brightness * fineDetail;

          // Amber/orange tones
          data[idx] = Math.min(255, Math.round(255 * finalBright * 0.9));     // R
          data[idx + 1] = Math.min(255, Math.round(200 * finalBright * 0.7)); // G
          data[idx + 2] = Math.min(255, Math.round(100 * finalBright * 0.3)); // B
          data[idx + 3] = 255;
        } else {
          // Dark land
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        }
      } else {
        // Ocean: no lights (could add fishing fleets, but keep it simple)
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  return tex;
}

// ---------------------------------------------------------------------------
// generateEarthSpecularTexture
// White = water (specular), black = land (matte).
// ---------------------------------------------------------------------------
export function generateEarthSpecularTexture(width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const rand = seededRandom(42);

  for (let y = 0; y < height; y++) {
    const lat = ((y / height) - 0.5) * Math.PI;

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * Math.PI * 2;
      const nx = Math.cos(lat) * Math.cos(lon);
      const ny = Math.sin(lat);
      const nz = Math.cos(lat) * Math.sin(lon);

      const continentNoise = fbm(nx * 2 + 10, nz * 2 + 10, 6, rand, 42);
      const detailNoise = fbm(nx * 8 + 5, nz * 8 + 5, 4, rand, 137);
      const latBias = ny * 0.05;
      const elevation = continentNoise + latBias + detailNoise * 0.15;

      const isWater = elevation < 0.48 ? 255 : 0;

      const idx = (y * width + x) * 4;
      data[idx] = isWater;
      data[idx + 1] = isWater;
      data[idx + 2] = isWater;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// ---------------------------------------------------------------------------
// generateMoonTexture
// Gray surface with darker maria patches.
// ---------------------------------------------------------------------------
export function generateMoonTexture(width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const rand = seededRandom(73);

  for (let y = 0; y < height; y++) {
    const lat = ((y / height) - 0.5) * Math.PI;

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * Math.PI * 2;
      const nx = Math.cos(lat) * Math.cos(lon);
      const nz = Math.cos(lat) * Math.sin(lon);

      // Base highland brightness
      const baseNoise = fbm(nx * 3 + 5, nz * 3 + 5, 5, rand, 73);
      let brightness = 0.55 + baseNoise * 0.25;

      // Maria (dark basaltic plains) - large smooth dark patches
      // Concentrated on the near side (lon ~ 0 to pi, roughly)
      const mariaNoise = fbm(nx * 1.5 + 2, nz * 1.5 + 2, 3, rand, 200);
      if (mariaNoise > 0.55) {
        const mariaDepth = (mariaNoise - 0.55) / 0.45;
        brightness -= mariaDepth * 0.2;
      }

      // Fine detail: craters and roughness
      const craterNoise = fbm(nx * 20, nz * 20, 4, rand, 500);
      brightness += (craterNoise - 0.5) * 0.08;

      // Very fine grain
      const grainNoise = fbm(nx * 60, nz * 60, 2, rand, 800);
      brightness += (grainNoise - 0.5) * 0.03;

      // Clamp
      brightness = Math.max(0.15, Math.min(0.85, brightness));

      // Moon is gray — slight warm tint
      const r = brightness * 255 * 1.02;
      const g = brightness * 255;
      const b = brightness * 255 * 0.97;

      const idx = (y * width + x) * 4;
      data[idx] = Math.min(255, Math.round(r));
      data[idx + 1] = Math.min(255, Math.round(g));
      data[idx + 2] = Math.min(255, Math.round(b));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  return tex;
}

// ---------------------------------------------------------------------------
// generateCloudTexture
// White semi-transparent swirls on transparent background.
// ---------------------------------------------------------------------------
export function generateCloudTexture(width = 1024, height = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const rand = seededRandom(314);

  for (let y = 0; y < height; y++) {
    const lat = ((y / height) - 0.5) * Math.PI;
    const absLat = Math.abs(lat);

    for (let x = 0; x < width; x++) {
      const lon = (x / width) * Math.PI * 2;
      const nx = Math.cos(lat) * Math.cos(lon);
      const nz = Math.cos(lat) * Math.sin(lon);

      // Multi-scale cloud formations
      const largeClouds = fbm(nx * 3 + 1, nz * 3 + 1, 5, rand, 314);
      const medClouds = fbm(nx * 7 + 20, nz * 7 + 20, 4, rand, 628);
      const smallClouds = fbm(nx * 15 + 40, nz * 15 + 40, 3, rand, 942);

      // Cloud coverage varies by latitude
      // More clouds at mid-latitudes (storm tracks) and equator (ITCZ)
      const latCoverage = absLat < 0.2 ? 0.7 :     // ITCZ
                          absLat < 0.5 ? 0.4 :     // Subtropical dry
                          absLat < 0.9 ? 0.8 :     // Storm tracks
                          0.5;                       // Polar

      let cloudDensity = largeClouds * 0.5 + medClouds * 0.3 + smallClouds * 0.2;
      cloudDensity *= latCoverage;

      // Threshold to create clear/cloudy separation
      const threshold = 0.38;
      let alpha = 0;
      if (cloudDensity > threshold) {
        alpha = Math.min(1.0, (cloudDensity - threshold) / 0.3);
        // Soft edges
        alpha = alpha * alpha * (3 - 2 * alpha); // smoothstep
        alpha *= 0.85; // never fully opaque
      }

      const idx = (y * width + x) * 4;
      // Clouds are white
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 252; // very slight warm tint
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  tex.premultiplyAlpha = true;
  return tex;
}
