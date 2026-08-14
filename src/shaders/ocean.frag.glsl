varying float vOceanHeight;
varying float vOceanSlope;
varying vec3 vOceanWorldPosition;
varying vec3 vOceanWorldNormal;
varying vec2 vOceanUv;

uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFoamColor;
uniform vec3 uSunDirection;
uniform vec3 uAbsorption;
uniform vec3 uWaterScatterColor;
uniform sampler2D uFoamTexture;
uniform vec2 uFoamTexelSize;

vec4 sampleSmoothFoam(vec2 uv) {
  // Wide, rotationally balanced Gaussian reconstruction. Half-texel offsets
  // make the GPU's bilinear filter blend four cells per lookup instead of
  // exposing the square footprint of an individual foam texel.
  vec2 t = uFoamTexelSize;
  vec2 h = t * 1.5;
  vec4 foam = texture2D(uFoamTexture, uv) * 0.227027;
  foam += texture2D(uFoamTexture, uv + vec2( h.x, 0.0)) * 0.158108;
  foam += texture2D(uFoamTexture, uv - vec2( h.x, 0.0)) * 0.158108;
  foam += texture2D(uFoamTexture, uv + vec2(0.0,  h.y)) * 0.158108;
  foam += texture2D(uFoamTexture, uv - vec2(0.0,  h.y)) * 0.158108;
  foam += texture2D(uFoamTexture, uv + h) * 0.035135;
  foam += texture2D(uFoamTexture, uv - h) * 0.035135;
  foam += texture2D(uFoamTexture, uv + vec2(h.x, -h.y)) * 0.035135;
  foam += texture2D(uFoamTexture, uv + vec2(-h.x, h.y)) * 0.035135;
  return foam;
}

void main() {
  vec3 oceanWorldNormal = normalize(vOceanWorldNormal);
  vec3 viewDirection = normalize(cameraPosition - vOceanWorldPosition);
  float nDotV = max(dot(oceanWorldNormal, viewDirection), 0.08);

  float crest = smoothstep(0.10, 1.0, vOceanHeight)
    * smoothstep(0.10, 0.70, vOceanSlope);
  vec4 cascadeFoam = sampleSmoothFoam(vOceanUv);
  float foamSignal = dot(cascadeFoam, vec4(0.8, 0.8, 0.6, 0.4));
  float foam = smoothstep(0.015, 0.19, foamSignal);
  foam = foam * foam * (3.0 - 2.0 * foam);
  foam *= smoothstep(0.035, 0.32, vOceanSlope);

  float distanceToCamera = distance(cameraPosition, vOceanWorldPosition);
  float haze = smoothstep(90.0, 310.0, distanceToCamera);

  // Beer-Lambert attenuation through an approximate view-dependent water path.
  float opticalPath = mix(2.0, 7.0, 1.0 - nDotV);
  vec3 transmittance = exp(-uAbsorption * opticalPath);
  vec3 bodyColor = uDeepColor * transmittance
    + uWaterScatterColor * (1.0 - transmittance);
  bodyColor = mix(bodyColor, uShallowColor, crest * 0.26);

  // Forward/crest scattering is strongest when the camera looks toward the
  // light through the raised, back-facing side of a wave.
  float towardCamera = pow(max(dot(uSunDirection, -viewDirection), 0.0), 4.0);
  float backFacing = pow(clamp(0.5 - 0.5 * dot(uSunDirection, oceanWorldNormal), 0.0, 1.0), 3.0);
  float peakHeight = smoothstep(0.0, 1.8, max(vOceanHeight, 0.0));
  float crestScatter = peakHeight * towardCamera * backFacing;
  bodyColor += vec3(0.10, 0.48, 0.52) * crestScatter * 1.8;

  bodyColor = mix(bodyColor, uFoamColor, foam * 0.88);
  bodyColor = mix(bodyColor, vec3(0.20, 0.38, 0.46), haze * 0.34);
  csm_DiffuseColor = vec4(bodyColor, 1.0);
  csm_Roughness = mix(0.075 + haze * 0.16, 0.58, foam);
}
