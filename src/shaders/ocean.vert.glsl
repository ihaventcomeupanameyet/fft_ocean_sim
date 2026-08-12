uniform sampler2D uHeightSlopeX;
uniform sampler2D uSlopeZDisplacementX;
uniform sampler2D uDisplacementZ;
uniform float uVerticalScale;
uniform float uChoppiness;
uniform float uPatchRepeats;

varying float vOceanHeight;
varying float vOceanSlope;

void main() {
  vec2 oceanUv = uv * uPatchRepeats;
  vec4 heightSlopeX = texture2D(uHeightSlopeX, oceanUv);
  vec4 slopeZDisplacementX = texture2D(uSlopeZDisplacementX, oceanUv);
  vec4 displacementZ = texture2D(uDisplacementZ, oceanUv);
  float height = heightSlopeX.r * uVerticalScale;
  vec2 slope = vec2(heightSlopeX.b, slopeZDisplacementX.r) * uVerticalScale;
  vec2 displacement = vec2(slopeZDisplacementX.b, displacementZ.r) * uChoppiness;

  vec3 displaced = position;
  displaced.xy += displacement;
  displaced.z = height;
  csm_Position = displaced;
  csm_Normal = normalize(vec3(-slope.x, -slope.y, 1.0));

  vOceanHeight = height;
  vOceanSlope = length(slope);
}
