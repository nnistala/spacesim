uniform float time;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}
