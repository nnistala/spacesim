uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform sampler2D specularMap;
uniform vec3 sunDirection;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDir;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 sunDir = normalize(sunDirection);
  vec3 viewDir = normalize(vViewDir);

  // --- Solar illumination ---
  float NdotL = dot(normal, sunDir);

  // Smooth day/night transition over ~10 degrees of solar angle
  // sin(10 deg) ~ 0.174, so transition range is about [-0.1, 0.1]
  float dayFactor = smoothstep(-0.1, 0.15, NdotL);

  // --- Texture sampling ---
  vec4 dayColor = texture2D(dayMap, vUv);
  vec4 nightColor = texture2D(nightMap, vUv);
  vec4 specData = texture2D(specularMap, vUv);

  // --- City lights on the dark side ---
  // Night texture shows warm city lights (amber/orange tint)
  // Modulate night brightness: only show lights where the texture has them
  vec3 cityLights = nightColor.rgb;
  // Warm up the city lights slightly (push toward amber)
  cityLights *= vec3(1.0, 0.85, 0.6);
  // Reduce overall brightness of city lights (they should be subtle dots, not floodlights)
  cityLights *= 0.7;

  // --- Day side lighting ---
  // Lambertian diffuse with slight enhancement
  float diffuse = max(NdotL, 0.0);
  vec3 litDay = dayColor.rgb * diffuse;

  // --- Specular highlights on oceans ---
  // Half-vector specular (Blinn-Phong)
  vec3 halfVec = normalize(sunDir + viewDir);
  float NdotH = max(dot(normal, halfVec), 0.0);
  float specIntensity = pow(NdotH, 64.0); // tight specular highlight

  // Only apply specular where specularMap indicates water (> 0.5)
  float waterMask = step(0.5, specData.r);
  vec3 specular = vec3(1.0, 0.98, 0.95) * specIntensity * waterMask * 0.5;

  // Specular only on the lit side
  specular *= smoothstep(0.0, 0.2, NdotL);

  // --- Limb darkening ---
  // Simulates atmospheric absorption at grazing angles
  float limbDarkening = pow(max(dot(normal, viewDir), 0.0), 0.3);
  limbDarkening = mix(0.6, 1.0, limbDarkening);

  // --- Combine day and night ---
  // Day side: lit texture + specular
  // Night side: city lights (only where nightMap is bright)
  // The transition is smooth via dayFactor
  vec3 finalColor = mix(cityLights * (1.0 - dayFactor), litDay + specular, dayFactor);

  // Apply limb darkening to the day side only
  finalColor *= mix(1.0, limbDarkening, dayFactor);

  // Slight ambient to prevent pure black (very minimal, space is dark)
  finalColor += dayColor.rgb * 0.005;

  gl_FragColor = vec4(finalColor, 1.0);
}
