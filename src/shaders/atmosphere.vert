uniform float atmosphereScale;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  // Inflate vertices outward along normals to create atmosphere shell
  vec3 inflated = position + normal * (atmosphereScale - 1.0);

  vec4 worldPos = modelMatrix * vec4(inflated, 1.0);
  vWorldPosition = worldPos.xyz;

  // Transform normal to world space
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  // View direction from camera to fragment (world space)
  vViewDir = normalize(worldPos.xyz - cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
