precision highp float;

uniform float time;
uniform vec3 sunCenter;
uniform float sunRadius;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;

/* ----------------------------------------------------------------
   3D Simplex Noise (same implementation as surface shader)
   ---------------------------------------------------------------- */

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(
    permute(
      permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
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

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  // Direction from sun center to this fragment in world space
  vec3 dir = vWorldPosition - sunCenter;
  float dist = length(dir);
  vec3 dirNorm = dir / dist;

  // Normalized distance: 0 at sun surface, 1 at corona edge
  float innerRadius = sunRadius;
  float outerRadius = sunRadius * 3.0;
  float t = (dist - innerRadius) / (outerRadius - innerRadius);
  t = clamp(t, 0.0, 1.0);

  // ==========================================
  // RADIAL FALLOFF (exponential decay)
  // ==========================================
  // Real corona brightness falls off approximately as r^-2 to r^-6
  float radialFalloff = exp(-3.5 * t) * (1.0 - t);
  radialFalloff = max(radialFalloff, 0.0);

  // ==========================================
  // STREAMER PATTERN (angular rays)
  // ==========================================
  // Compute spherical angles from direction
  float theta = atan(dirNorm.z, dirNorm.x); // azimuthal
  float phi = asin(clamp(dirNorm.y, -1.0, 1.0)); // polar

  float slowDrift = time * 0.003;

  // Primary streamers: large-scale asymmetric rays
  float streamer1 = snoise(vec3(theta * 2.0 + slowDrift, phi * 1.5, time * 0.002));
  float streamer2 = snoise(vec3(theta * 4.0 - slowDrift * 0.7, phi * 3.0, time * 0.004 + 5.0));
  float streamer3 = snoise(vec3(theta * 8.0 + slowDrift * 0.3, phi * 5.0, time * 0.006 + 10.0));

  // Combine streamers with decreasing amplitude for finer detail
  float streamers = streamer1 * 0.5 + streamer2 * 0.3 + streamer3 * 0.2;

  // Make streamers more pronounced farther from the surface
  float streamerMask = smoothstep(0.0, 0.3, t);
  streamers *= streamerMask;

  // Remap to positive range with bias toward bright streamers
  streamers = streamers * 0.5 + 0.5;
  streamers = pow(streamers, 1.5); // Sharpen contrast

  // ==========================================
  // HELMET STREAMERS (equatorial belt features)
  // ==========================================
  // More prominent near the equator, like real coronal streamers
  float equatorial = 1.0 - abs(dirNorm.y);
  equatorial = pow(equatorial, 2.0);
  float helmetStreamer = equatorial * 0.3 * smoothstep(0.1, 0.5, t);

  // ==========================================
  // FINE STRUCTURE
  // ==========================================
  vec3 fineP = dirNorm * 6.0 + vec3(time * 0.01);
  float fineNoise = fbm(fineP, 4) * 0.15;

  // ==========================================
  // COMPOSE CORONA BRIGHTNESS
  // ==========================================
  float coronaBrightness = radialFalloff * (0.6 + streamers * 0.5 + helmetStreamer + fineNoise);

  // Additional inner glow (very bright near surface)
  float innerGlow = exp(-8.0 * t) * 0.7;
  coronaBrightness += innerGlow;

  // ==========================================
  // COLOR
  // ==========================================
  // White core -> warm yellow -> pale at edges
  vec3 coreColor = vec3(1.0, 1.0, 0.95);    // Near-white
  vec3 midColor  = vec3(1.0, 0.88, 0.65);    // Warm yellow
  vec3 outerColor = vec3(0.95, 0.85, 0.70);  // Pale gold

  vec3 color = mix(coreColor, midColor, smoothstep(0.0, 0.4, t));
  color = mix(color, outerColor, smoothstep(0.3, 0.9, t));

  // Slightly tint streamers
  color = mix(color, vec3(1.0, 0.92, 0.78), streamers * 0.2);

  // HDR push for inner regions
  color *= 1.0 + innerGlow * 2.0;

  // ==========================================
  // ALPHA
  // ==========================================
  float alpha = coronaBrightness;
  alpha *= smoothstep(1.0, 0.95, t); // Fade at extreme outer edge
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(color * coronaBrightness, alpha);
}
