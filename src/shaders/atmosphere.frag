uniform vec3 atmosphereColor;
uniform float atmosphereDensity;
uniform vec3 sunDirection;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDir = normalize(vViewDir);
  vec3 sunDir = normalize(sunDirection);

  // --- Fresnel-like rim factor ---
  // Dot product of view direction and surface normal
  // At the limb (perpendicular viewing): dot approaches 0 -> strong scattering
  // At the center (head-on viewing): dot approaches 1 -> minimal scattering
  float viewDot = dot(-viewDir, normal);
  float rimFactor = 1.0 - clamp(viewDot, 0.0, 1.0);

  // Sharpen the rim to create a thin atmospheric halo, not a fuzzy ball
  // Power of 3 gives a nice thin bright edge
  float atmosphereRim = pow(rimFactor, 2.5) * atmosphereDensity;

  // --- Rayleigh scattering ---
  // Rayleigh scattering intensity ~ lambda^(-4)
  // Blue (440nm) scatters ~5.5x more than red (700nm)
  // We encode this by using the atmosphere color (which should be blue-ish)
  // and modulating intensity by the scattering geometry

  // Scattering angle: angle between view direction and sun direction
  float cosTheta = dot(-viewDir, sunDir);

  // Rayleigh phase function: (3/16pi)(1 + cos^2(theta))
  float rayleighPhase = 0.0596831 * (1.0 + cosTheta * cosTheta);

  // --- Mie scattering ---
  // Forward scattering lobe (white-ish, strongest when looking toward sun)
  // Henyey-Greenstein phase function approximation
  float g = 0.76; // asymmetry factor (strong forward scattering)
  float g2 = g * g;
  float miePhase = 1.5 * ((1.0 - g2) / (2.0 + g2))
                   * (1.0 + cosTheta * cosTheta)
                   / pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);

  // Mie contribution is subtle white forward-scattering
  vec3 mieColor = vec3(1.0, 0.95, 0.9); // slightly warm white
  float mieStrength = 0.04; // subtle

  // --- Sun-side illumination ---
  // Atmosphere is brighter on the sun-facing side
  float sunIllumination = dot(normal, sunDir);
  // Soft transition: allow some scattering even on the dark side (terminator glow)
  float sunFactor = smoothstep(-0.3, 0.5, sunIllumination);

  // Combine Rayleigh and Mie
  vec3 rayleighContribution = atmosphereColor * rayleighPhase * 2.5;
  vec3 mieContribution = mieColor * miePhase * mieStrength;

  vec3 scatterColor = rayleighContribution + mieContribution;

  // Final color: rim glow modulated by sun illumination and scattering
  float intensity = atmosphereRim * sunFactor;

  // Add a base rim glow that's always visible (even on dark side, but very faint)
  // This simulates light scattering around from the bright side
  float baseGlow = atmosphereRim * 0.08;

  vec3 finalColor = scatterColor * intensity + atmosphereColor * baseGlow;

  // Alpha: atmosphere is transparent at center, opaque at limb
  float alpha = clamp(intensity + baseGlow, 0.0, 1.0);

  // Boost the thin bright line at the very edge
  float edgeBoost = pow(rimFactor, 5.0) * sunFactor * 0.6;
  finalColor += atmosphereColor * edgeBoost;
  alpha = clamp(alpha + edgeBoost, 0.0, 0.95);

  gl_FragColor = vec4(finalColor, alpha);
}
