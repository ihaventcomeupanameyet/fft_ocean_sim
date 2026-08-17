uniform sampler2D uDisplacementAtlas;
uniform sampler2D uDerivativeAtlas;
uniform vec4 uPatchLengths;
uniform float uOceanSize;
uniform vec4 uVerticalWeights;
uniform vec4 uChoppiness;
uniform float uNormalStrength;

varying float vOceanHeight;
varying float vOceanSlope;
varying vec3 vOceanWorldPosition;
varying vec3 vOceanWorldNormal;
varying vec2 vOceanUv;

vec2 atlasUv(vec2 uv, float layer) {
  vec2 quadrant = vec2(mod(layer, 2.0), floor(layer * 0.5));
  vec2 wrapped = fract(uv);
  return (quadrant + mix(vec2(0.00098), vec2(0.99902), wrapped)) * 0.5;
}

void sampleCascade(vec2 p, float patchLength, float layer, float heightWeight, float chop,
  inout float height, inout vec2 slope, inout vec2 displacement,
  out vec2 cascadeSlope) {
  vec2 oceanUv = p / patchLength + 0.5;
  vec2 packedUv = atlasUv(oceanUv, layer);
  vec4 packedDisplacement = texture2D(uDisplacementAtlas, packedUv);
  vec4 packedDerivatives = texture2D(uDerivativeAtlas, packedUv);
  float dxx = packedDerivatives.b;
  float dzz = packedDerivatives.a;
  float dxz = packedDisplacement.a;
  height += packedDisplacement.b * heightWeight;
  // Match the reference's displaced-surface slope correction. Raw height
  // slopes over-rotate normals at highly compressed crests.
  cascadeSlope = packedDerivatives.rg
    / (vec2(1.0) + abs(vec2(dxx, dzz) * chop)) * heightWeight;
  slope += cascadeSlope;

  // Choppy horizontal displacement becomes non-injective when its Jacobian
  // crosses zero. That folds triangles over themselves and shows detached,
  // differently lit sheets on a double-sided ocean. Smoothly reduce only the
  // geometric chop near foldover; the foam simulation still sees the original
  // compression and can mark the breaking crest.
  float horizontalJacobian = (1.0 + chop * dxx) * (1.0 + chop * dzz)
                           - chop * chop * dxz * dxz;
  float foldGuard = smoothstep(0.0, 0.42, horizontalJacobian);
  float safeChop = chop * foldGuard;
  displacement += packedDisplacement.rg * safeChop * heightWeight;
}

void main() {
  vec2 p = position.xy;
  float height = 0.0;
  vec2 slope = vec2(0.0);
  vec2 displacement = vec2(0.0);
  vec2 slope0, slope1, slope2, slope3;
  sampleCascade(p,uPatchLengths.x,0.0,uVerticalWeights.x,uChoppiness.x,height,slope,displacement,slope0);
  sampleCascade(p,uPatchLengths.y,1.0,uVerticalWeights.y,uChoppiness.y,height,slope,displacement,slope1);
  sampleCascade(p,uPatchLengths.z,2.0,uVerticalWeights.z,uChoppiness.z,height,slope,displacement,slope2);
  sampleCascade(p,uPatchLengths.w,3.0,uVerticalWeights.w,uChoppiness.w,height,slope,displacement,slope3);

  float inverseDistanceMask = clamp(pow(length(p / 500.0 * 3.0), 3.0), 0.0, 1.0);
  // Reuse the packed cross-derivative channel as a slow variation source. The
  // 400 m first cascade now varies only once over the complete ocean surface.
  float normalVariation = abs(texture2D(uDisplacementAtlas,
    atlasUv(p / 500.0 * 2.0 + 0.5, 0.0)).a);
  normalVariation = clamp(normalVariation * inverseDistanceMask * 4.0, 0.0, 1.0);
  slope = mix(slope, slope2 + slope3, normalVariation) * uNormalStrength;

  vec3 displaced = vec3(p + displacement, height);
  csm_Position = displaced;
  vec3 oceanNormal = normalize(vec3(-slope.x, -slope.y, 1.0));
  csm_Normal = oceanNormal;
  vOceanHeight = height;
  vOceanSlope = length(slope);
  vOceanWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
  vOceanWorldNormal = normalize(mat3(modelMatrix) * oceanNormal);
  vOceanUv = p / uOceanSize + 0.5;
}
