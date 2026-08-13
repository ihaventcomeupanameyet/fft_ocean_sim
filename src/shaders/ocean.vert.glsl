uniform sampler2D uHeightSlopeX0;
uniform sampler2D uSlopeZDisplacementX0;
uniform sampler2D uDisplacementZ0;
uniform sampler2D uHeightSlopeX1;
uniform sampler2D uSlopeZDisplacementX1;
uniform sampler2D uDisplacementZ1;
uniform sampler2D uHeightSlopeX2;
uniform sampler2D uSlopeZDisplacementX2;
uniform sampler2D uDisplacementZ2;
uniform sampler2D uHeightSlopeX3;
uniform sampler2D uSlopeZDisplacementX3;
uniform sampler2D uDisplacementZ3;
uniform vec4 uPatchLengths;
uniform vec4 uVerticalWeights;
uniform vec4 uChoppiness;

varying float vOceanHeight;
varying float vOceanSlope;
varying vec3 vOceanWorldPosition;

void sampleCascade(sampler2D hs, sampler2D sd, sampler2D dz, vec2 p,
  float patchLength, float heightWeight, float chop,
  inout float height, inout vec2 slope, inout vec2 displacement) {
  vec2 oceanUv = p / patchLength + 0.5;
  vec4 heightSlopeX = texture2D(hs, oceanUv);
  vec4 slopeZDisplacementX = texture2D(sd, oceanUv);
  vec4 displacementZ = texture2D(dz, oceanUv);
  height += heightSlopeX.r * heightWeight;
  slope += vec2(heightSlopeX.b, slopeZDisplacementX.r) * heightWeight;
  displacement += vec2(slopeZDisplacementX.b, displacementZ.r) * chop;
}

void main() {
  vec2 p = position.xy;
  float height = 0.0;
  vec2 slope = vec2(0.0);
  vec2 displacement = vec2(0.0);
  sampleCascade(uHeightSlopeX0,uSlopeZDisplacementX0,uDisplacementZ0,p,uPatchLengths.x,uVerticalWeights.x,uChoppiness.x,height,slope,displacement);
  sampleCascade(uHeightSlopeX1,uSlopeZDisplacementX1,uDisplacementZ1,p,uPatchLengths.y,uVerticalWeights.y,uChoppiness.y,height,slope,displacement);
  sampleCascade(uHeightSlopeX2,uSlopeZDisplacementX2,uDisplacementZ2,p,uPatchLengths.z,uVerticalWeights.z,uChoppiness.z,height,slope,displacement);
  sampleCascade(uHeightSlopeX3,uSlopeZDisplacementX3,uDisplacementZ3,p,uPatchLengths.w,uVerticalWeights.w,uChoppiness.w,height,slope,displacement);

  vec3 displaced = vec3(p + displacement, height);
  csm_Position = displaced;
  csm_Normal = normalize(vec3(-slope.x, -slope.y, 1.0));
  vOceanHeight = height;
  vOceanSlope = length(slope);
  vOceanWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
}
