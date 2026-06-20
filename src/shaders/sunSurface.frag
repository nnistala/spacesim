precision highp float;

uniform float time;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vViewDot;

/* ----------------------------------------------------------------
   3D Simplex Noise — Stefan Gustavson's optimized GLSL implementation
   (from https://github.com/ashima/webgl-noise)
   ---------------------------------------------------------------- */

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  // Permutations
  i = mod289(i);
  vec4 p = permute(
    permute(
      permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  float n_ = 0.142857142857; // 1.0 / 7.0
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  // Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

/* ----------------------------------------------------------------
   Fractal Brownian Motion — 6 octaves for fine convection detail
   ---------------------------------------------------------------- */

float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float lacunarity = 2.17;
  float gain = 0.49;

  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return value;
}

/* ----------------------------------------------------------------
   Turbulence — absolute-valued FBM for harder cell boundaries
   ---------------------------------------------------------------- */

float turbulence(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float lacunarity = 2.13;
  float gain = 0.50;

  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * abs(snoise(p * frequency));
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return value;
}

/* ----------------------------------------------------------------
   Color ramp — blackbody-inspired mapping
   ---------------------------------------------------------------- */

vec3 sunColorRamp(float t) {
  // t in [0, 1]: 0 = darkest (sunspot), 1 = hottest (faculae)
  // Colors: deep red-brown -> dark orange -> bright orange -> yellow -> near-white
  vec3 c0 = vec3(0.545, 0.145, 0.0);   // #8B2500 deep red-brown (sunspot)
  vec3 c1 = vec3(0.80, 0.267, 0.0);    // #CC4400 dark orange
  vec3 c2 = vec3(1.0, 0.40, 0.0);      // #FF6600 bright orange
  vec3 c3 = vec3(1.0, 0.80, 0.0);      // #FFCC00 yellow
  vec3 c4 = vec3(1.0, 1.0, 0.933);     // #FFFFEE near-white (faculae)

  if (t < 0.15) return mix(c0, c1, t / 0.15);
  if (t < 0.40) return mix(c1, c2, (t - 0.15) / 0.25);
  if (t < 0.70) return mix(c2, c3, (t - 0.40) / 0.30);
  if (t < 0.90) return mix(c3, c4, (t - 0.70) / 0.20);
  return c4;
}

/* ----------------------------------------------------------------
   Main
   ---------------------------------------------------------------- */

void main() {
  // Use the 3D position on the sphere for seamless noise (no UV seams)
  vec3 pos = normalize(vPosition);

  // --- Time scales ---
  float slowTime = time * 0.008;   // Large convection drift
  float medTime  = time * 0.025;   // Medium features
  float fastTime = time * 0.06;    // Granulation boiling

  // ==========================================
  // 1. LARGE-SCALE CONVECTION CELLS (supergranulation)
  // ==========================================
  vec3 convP = pos * 2.0 + vec3(slowTime * 0.3, slowTime * 0.2, slowTime * 0.15);
  float convection = fbm(convP, 4);
  // Sharpen cell boundaries using a Voronoi-like trick
  float convSharp = 1.0 - smoothstep(0.0, 0.12, abs(convection));

  // ==========================================
  // 2. GRANULATION (small bright cells with dark lanes)
  // ==========================================
  vec3 granP = pos * 18.0 + vec3(fastTime * 0.7, fastTime * 0.5, fastTime * 0.3);
  float granNoise = snoise(granP);
  // Additional octave for finer detail
  float granDetail = snoise(granP * 2.3 + vec3(fastTime * 0.4));
  // Combine and create bright cells with dark boundaries
  float granulation = granNoise * 0.7 + granDetail * 0.3;
  // Remap: positive = bright cell center, negative = dark intergranular lane
  float granCells = smoothstep(-0.3, 0.5, granulation);

  // ==========================================
  // 3. SUNSPOT FEATURES (large dark regions)
  // ==========================================
  // Very slow, large-scale noise for sunspot placement
  vec3 spotP = pos * 1.5 + vec3(slowTime * 0.1, -slowTime * 0.07, slowTime * 0.05);
  float spotNoise = snoise(spotP);
  // Add secondary frequency for spot shape variation
  float spotShape = snoise(spotP * 2.5 + vec3(slowTime * 0.05));
  float spotField = spotNoise * 0.65 + spotShape * 0.35;
  // Only the lowest values become sunspots (sparse distribution)
  float sunspot = smoothstep(-0.55, -0.85, spotField);
  // Penumbra (outer lighter ring of sunspot)
  float penumbra = smoothstep(-0.35, -0.55, spotField) * (1.0 - sunspot);

  // ==========================================
  // 4. MEDIUM-SCALE TURBULENCE (plage, network)
  // ==========================================
  vec3 turbP = pos * 5.0 + vec3(medTime * 0.4, medTime * 0.3, -medTime * 0.2);
  float medTurb = turbulence(turbP, 5);

  // ==========================================
  // 5. FACULAE (bright spots near sunspot regions)
  // ==========================================
  float faculae = smoothstep(0.35, 0.65, medTurb) * penumbra * 0.5;
  // Also some independent bright points
  float brightPoints = smoothstep(0.65, 0.85, fbm(pos * 10.0 + vec3(medTime * 0.5), 4));
  faculae += brightPoints * 0.2;

  // ==========================================
  // COMPOSE SURFACE BRIGHTNESS
  // ==========================================
  // Base brightness: medium-high (the photosphere)
  float brightness = 0.55;

  // Add large-scale convection variation
  brightness += convection * 0.12;

  // Add medium turbulence
  brightness += (medTurb - 0.3) * 0.15;

  // Add granulation (bright cells, dark lanes)
  brightness += (granCells - 0.5) * 0.18;

  // Darken sunspot regions strongly
  brightness -= sunspot * 0.55;

  // Slight darkening in penumbra
  brightness -= penumbra * 0.2;

  // Brighten faculae
  brightness += faculae * 0.25;

  // Emphasize cell boundaries (dark lanes in supergranulation)
  brightness -= convSharp * 0.05;

  // Clamp to valid range
  brightness = clamp(brightness, 0.0, 1.0);

  // ==========================================
  // COLOR MAPPING
  // ==========================================
  vec3 surfaceColor = sunColorRamp(brightness);

  // ==========================================
  // LIMB DARKENING
  // ==========================================
  // Real solar limb darkening follows approximately:
  //   I(mu) / I(1) = 1 - u*(1 - mu) - v*(1 - mu)^2
  // where mu = cos(angle from center), u ~ 0.56, v ~ 0.20
  float mu = clamp(vViewDot, 0.0, 1.0);
  float limbU = 0.56;
  float limbV = 0.20;
  float limbDarkening = 1.0 - limbU * (1.0 - mu) - limbV * (1.0 - mu) * (1.0 - mu);
  limbDarkening = clamp(limbDarkening, 0.0, 1.0);

  // Limb reddening: at the limb the color shifts toward red
  float limbReddening = 1.0 - mu;
  vec3 limbRedShift = vec3(1.0, 1.0 - limbReddening * 0.25, 1.0 - limbReddening * 0.45);

  surfaceColor *= limbDarkening * limbRedShift;

  // ==========================================
  // HDR EMISSION BOOST
  // ==========================================
  // The sun is an emissive body; push values above 1.0 for bloom
  surfaceColor *= 1.8;

  gl_FragColor = vec4(surfaceColor, 1.0);
}
