import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import { OCEAN_SIZE } from './oceanConfig.js'

export const FOAM_RESOLUTION = 512

const foamShader = /* glsl */ `
uniform sampler2D uDerivatives0;
uniform sampler2D uDerivatives1;
uniform sampler2D uDerivatives2;
uniform sampler2D uDerivatives3;
uniform sampler2D uDisplacement0;
uniform sampler2D uDisplacement1;
uniform sampler2D uDisplacement2;
uniform sampler2D uDisplacement3;
uniform vec4 uDisplayLengths;
uniform vec4 uChoppiness;
uniform float uDeltaTime;
uniform float uDecayRate;
uniform float uInjectionRate;
uniform float uFoamBias;
uniform float uFoamPower;

float foamSource(sampler2D displacement, sampler2D derivatives, vec2 uv, float sharpness) {
  vec4 packedDisplacement = texture2D(displacement, uv);
  vec4 d = texture2D(derivatives, uv);
  float jacobian = (1.0 + sharpness * d.b) * (1.0 + sharpness * d.a)
                 - sharpness * sharpness * packedDisplacement.a * packedDisplacement.a;
  jacobian = pow(clamp(jacobian, 0.0, 1.0), uFoamPower);
  return max(0.0, -(jacobian - uFoamBias));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 p = (uv - 0.5) * ${OCEAN_SIZE.toFixed(1)};
  vec4 source = vec4(
    foamSource(uDisplacement0, uDerivatives0, p/uDisplayLengths.x + 0.5, uChoppiness.x),
    foamSource(uDisplacement1, uDerivatives1, p/uDisplayLengths.y + 0.5, uChoppiness.y),
    foamSource(uDisplacement2, uDerivatives2, p/uDisplayLengths.z + 0.5, uChoppiness.z),
    foamSource(uDisplacement3, uDerivatives3, p/uDisplayLengths.w + 0.5, uChoppiness.w));
  // Unity applies decay once per rendered frame. Convert that behavior to a
  // frame-rate-independent 60 Hz equivalent.
  vec4 previous = texture2D(textureFoam, uv);
  vec4 retained = previous * exp(-uDecayRate * uDeltaTime * 60.0);
  gl_FragColor = clamp(retained + source * uInjectionRate * uDeltaTime * 60.0, 0.0, 1.0);
}
`

export class GPUFoamSimulation {
  constructor(renderer, simulations, displayLengths) {
    this.gpuCompute = new GPUComputationRenderer(FOAM_RESOLUTION, FOAM_RESOLUTION, renderer)
    this.gpuCompute.setDataType(THREE.FloatType)
    const initial = this.gpuCompute.createTexture()
    initial.image.data.fill(0)
    this.variable = this.gpuCompute.addVariable('textureFoam', foamShader, initial)
    this.gpuCompute.setVariableDependencies(this.variable, [this.variable])

    const uniforms = this.variable.material.uniforms
    Object.assign(uniforms, {
      uDisplayLengths: { value: new THREE.Vector4(...displayLengths) },
      uChoppiness: { value: new THREE.Vector4() },
      uDeltaTime: { value: 0 },
      uDecayRate: { value: 0.085 },
      uInjectionRate: { value: 0.12 },
      // At 512² the derivative peaks are lower than the reference's 1024²
      // fields, so use a higher Jacobian cutoff to retain visible breakers.
      uFoamBias: { value: 0.48 },
      uFoamPower: { value: 1.5 },
    })
    simulations.forEach((simulation, index) => {
      uniforms[`uDerivatives${index}`] = { value: simulation.outputTextures[1] }
      uniforms[`uDisplacement${index}`] = { value: simulation.outputTextures[0] }
    })
    const error = this.gpuCompute.init()
    if (error) throw new Error(`FFT foam GPU initialization failed: ${error}`)
    this.variable.wrapS = THREE.RepeatWrapping
    this.variable.wrapT = THREE.RepeatWrapping
    for (const target of [
      this.gpuCompute.getCurrentRenderTarget(this.variable),
      this.gpuCompute.getAlternateRenderTarget(this.variable),
    ]) {
      target.texture.minFilter = THREE.LinearFilter
      target.texture.magFilter = THREE.LinearFilter
      target.texture.wrapS = THREE.RepeatWrapping
      target.texture.wrapT = THREE.RepeatWrapping
      target.texture.needsUpdate = true
    }
  }

  update(deltaTime, simulations, choppiness) {
    const uniforms = this.variable.material.uniforms
    uniforms.uDeltaTime.value = Math.min(deltaTime, 0.1)
    uniforms.uChoppiness.value.copy(choppiness)
    simulations.forEach((simulation, index) => {
      uniforms[`uDerivatives${index}`].value = simulation.outputTextures[1]
      uniforms[`uDisplacement${index}`].value = simulation.outputTextures[0]
    })
    this.gpuCompute.compute()
  }

  get texture() {
    return this.gpuCompute.getCurrentRenderTarget(this.variable).texture
  }

  dispose() {
    this.gpuCompute.dispose()
  }
}
