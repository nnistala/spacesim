uniform float time;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vViewDot;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;

  // Compute view-direction dot product for limb darkening
  vec3 viewDir = normalize(cameraPosition - worldPos.xyz);
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDot = dot(viewDir, worldNormal);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
