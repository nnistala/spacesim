// Star field vertex shader — custom point rendering with size attenuation
// and per-star color/twinkle parameters.

attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;    // random phase for twinkle
attribute float aFrequency; // twinkle frequency

uniform float uTime;
uniform float uPixelRatio;
uniform float uSizeScale;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = aColor;

  // Twinkle: sinusoidal brightness modulation
  float twinkle = 0.85 + 0.15 * sin(uTime * aFrequency + aPhase);
  vAlpha = twinkle;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // Size attenuation: farther stars are smaller but with a minimum size
  // so distant stars remain visible as single-pixel points.
  float dist = -mvPosition.z;
  float attenuation = clamp(300.0 / dist, 0.3, 1.0);
  float pointSize = aSize * uSizeScale * uPixelRatio * attenuation;

  // Minimum visible size
  pointSize = max(pointSize, 0.5 * uPixelRatio);

  gl_PointSize = pointSize;
  gl_Position = projectionMatrix * mvPosition;
}
