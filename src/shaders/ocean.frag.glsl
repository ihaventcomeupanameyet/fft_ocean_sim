varying float vOceanHeight;
varying float vOceanSlope;
varying vec3 vOceanWorldPosition;

uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFoamColor;

void main() {
  float crest = smoothstep(0.15, 1.15, vOceanHeight)
    * smoothstep(0.12, 0.75, vOceanSlope);
  float foam = smoothstep(0.48, 1.05, vOceanHeight)
    * smoothstep(0.28, 0.82, vOceanSlope);
  float distanceToCamera = distance(cameraPosition, vOceanWorldPosition);
  float haze = smoothstep(90.0, 310.0, distanceToCamera);
  vec3 bodyColor = mix(uDeepColor, uShallowColor, crest * 0.42);
  bodyColor = mix(bodyColor, uFoamColor, foam * 0.72);
  bodyColor = mix(bodyColor, vec3(0.20, 0.38, 0.46), haze * 0.34);
  csm_DiffuseColor = vec4(bodyColor, 1.0);
  csm_Roughness = mix(0.075 + haze * 0.16, 0.52, foam);
}
