// Star field fragment shader — circular points with soft glow falloff.
// Each star is rendered as a gl_Point, so we use gl_PointCoord for the shape.

precision highp float;

varying vec3 vColor;
varying float vAlpha;

void main() {
  // Compute distance from center of the point sprite (0..1 range).
  vec2 coord = gl_PointCoord - vec2(0.5);
  float distSq = dot(coord, coord);

  // Discard pixels outside the unit circle
  if (distSq > 0.25) discard;

  float dist = sqrt(distSq) * 2.0; // 0 at center, 1 at edge

  // Soft circular falloff: bright core + gentle glow
  float core = 1.0 - smoothstep(0.0, 0.35, dist);
  float glow = (1.0 - smoothstep(0.0, 1.0, dist)) * 0.4;
  float brightness = core + glow;

  vec3 color = vColor * brightness;
  float alpha = brightness * vAlpha;

  gl_FragColor = vec4(color, alpha);
}
