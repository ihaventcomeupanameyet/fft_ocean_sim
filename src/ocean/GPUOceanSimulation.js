import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import { createGaussian } from './fft.js'

const GRAVITY = 9.81

function alphaBetaSpectrum(a, b, omega, peakOmega) {
  return a * GRAVITY * GRAVITY / Math.pow(omega, 5)
    * Math.exp(-b * Math.pow(peakOmega / omega, 4))
}

function jonswapSpectrum(omega, windSpeed, fetchKm, peakEnhancement) {
  const fetchMeters = fetchKm * 1000
  const alpha = 0.076 * Math.pow(windSpeed*windSpeed / (fetchMeters*GRAVITY), 0.22)
  const peakOmega = 22 * Math.pow(GRAVITY*GRAVITY / (windSpeed*fetchMeters), 1/3)
  const sigma = omega <= peakOmega ? 0.07 : 0.09
  const distance = omega - peakOmega
  const peakShape = Math.exp(-(distance*distance) / (2*sigma*sigma*peakOmega*peakOmega))
  return {
    density: alphaBetaSpectrum(alpha, 1.25, omega, peakOmega)
      * Math.pow(peakEnhancement, peakShape),
    peakOmega,
  }
}

function spreadPower(omega, peakOmega) {
  return omega > peakOmega
    ? 9.77 * Math.pow(Math.abs(omega/peakOmega), -2.5)
    : 6.97 * Math.pow(Math.abs(omega/peakOmega), 5)
}

function spreadNormalization(s) {
  const s2 = s*s
  const s3 = s2*s
  const s4 = s3*s
  return s < 5
    ? -0.000564*s4 + 0.00776*s3 - 0.044*s2 + 0.192*s + 0.163
    : -4.8e-8*s4 + 1.07e-5*s3 - 9.53e-4*s2 + 0.059*s + 0.393
}

function directionSpectrum(relativeAngle, omega, peakOmega, spreadBlend, swell) {
  const s = spreadPower(omega, peakOmega)
    + 16*Math.tanh(Math.min(omega/peakOmega, 20))*swell*swell
  const broad = 2/Math.PI * Math.cos(relativeAngle) ** 2
  const focused = spreadNormalization(s)
    * Math.pow(Math.abs(Math.cos(0.5*relativeAngle)), 2*s)
  return broad*(1-spreadBlend) + focused*spreadBlend
}

const evolutionShader = /* glsl */ `
uniform sampler2D uH0;
uniform float uTime;
uniform float uPatchLength;
vec2 complexMul(vec2 a, vec2 b) { return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 mirrorCell = mod(resolution - cell, resolution);
  vec2 h0 = texture2D(uH0, (cell + 0.5) / resolution).rg;
  vec2 h0MinusConjugate = texture2D(uH0, (mirrorCell + 0.5) / resolution).rg;
  h0MinusConjugate.y *= -1.0;
  vec2 centered = mix(cell, cell - resolution, step(resolution * 0.5, cell));
  vec2 kVec = 6.28318530718 * centered / uPatchLength;
  float k = length(kVec);
  if (k < 0.000001) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float omega = sqrt(9.81 * k);
  float phase = omega * uTime;
  vec2 h = complexMul(h0, vec2(cos(phase), sin(phase)))
         + complexMul(h0MinusConjugate, vec2(cos(phase), -sin(phase)));
  gl_FragColor = vec4(h, 0.0, 1.0);
}
`

const deriveShader = /* glsl */ `
uniform sampler2D uSpectrum;
uniform float uPatchLength;
uniform int uMode;
float bitReverse(float value) {
  float reversed = 0.0;
  float source = value;
  for (int i = 0; i < FFT_LOG_SIZE; i++) {
    reversed = reversed * 2.0 + mod(source, 2.0);
    source = floor(source * 0.5);
  }
  return reversed;
}
vec2 mulI(float q, vec2 z) { return vec2(-q*z.y, q*z.x); }
vec2 mulMinusI(float q, vec2 z) { return vec2(q*z.y, -q*z.x); }
void main() {
  vec2 outputCell = floor(gl_FragCoord.xy);
  vec2 sourceCell = vec2(bitReverse(outputCell.x), bitReverse(outputCell.y));
  vec2 h = texture2D(uSpectrum, (sourceCell + 0.5) / resolution).rg;
  vec2 centered = mix(sourceCell, sourceCell - resolution, step(resolution * 0.5, sourceCell));
  vec2 kVec = 6.28318530718 * centered / uPatchLength;
  float k = length(kVec);
  if (uMode == 0) {
    gl_FragColor = vec4(h, mulI(kVec.x, h));
  } else if (uMode == 1) {
    vec2 dx = k > 0.0 ? mulMinusI(kVec.x/k, h) : vec2(0.0);
    gl_FragColor = vec4(mulI(kVec.y, h), dx);
  } else {
    vec2 dz = k > 0.0 ? mulMinusI(kVec.y/k, h) : vec2(0.0);
    gl_FragColor = vec4(dz, vec2(0.0));
  }
}
`

const butterflyShader = /* glsl */ `
uniform sampler2D uInput;
uniform int uStage;
uniform bool uHorizontal;
vec2 complexMul(vec2 a, vec2 b) { return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  float coordinate = uHorizontal ? cell.x : cell.y;
  float span = exp2(float(uStage + 1));
  float halfSpan = span * 0.5;
  float offset = mod(coordinate, span);
  float j = mod(offset, halfSpan);
  float block = floor(coordinate / span) * span;
  float evenIndex = block + j;
  float oddIndex = evenIndex + halfSpan;
  vec2 evenCell = uHorizontal ? vec2(evenIndex, cell.y) : vec2(cell.x, evenIndex);
  vec2 oddCell = uHorizontal ? vec2(oddIndex, cell.y) : vec2(cell.x, oddIndex);
  vec4 evenValue = texture2D(uInput, (evenCell + 0.5) / resolution);
  vec4 oddValue = texture2D(uInput, (oddCell + 0.5) / resolution);
  float angle = 6.28318530718 * j / span;
  vec2 twiddle = vec2(cos(angle), sin(angle));
  vec4 rotated = vec4(complexMul(oddValue.rg, twiddle), complexMul(oddValue.ba, twiddle));
  gl_FragColor = offset < halfSpan ? evenValue + rotated : evenValue - rotated;
}
`

export class GPUOceanSimulation {
  constructor(renderer, { size = 64, patchLength = 128, windSpeed = 18, seed = 1701 } = {}) {
    this.size = size
    this.patchLength = patchLength
    this.logSize = Math.log2(size)
    this.gpuCompute = new GPUComputationRenderer(size, size, renderer)
    this.gpuCompute.setDataType(THREE.FloatType)
    this.h0Texture = this.createInitialSpectrum(windSpeed, seed)
    const initialSpectrum = this.gpuCompute.createTexture()
    this.spectrumVariable = this.gpuCompute.addVariable('textureSpectrum', evolutionShader, initialSpectrum)
    Object.assign(this.spectrumVariable.material.uniforms, {
      uH0: { value: this.h0Texture },
      uTime: { value: 0 },
      uPatchLength: { value: patchLength },
    })
    const error = this.gpuCompute.init()
    if (error) throw new Error(`FFT ocean GPU initialization failed: ${error}`)

    this.deriveMaterial = this.gpuCompute.createShaderMaterial(deriveShader, {
      uSpectrum: { value: null }, uPatchLength: { value: patchLength }, uMode: { value: 0 },
    })
    this.deriveMaterial.defines.FFT_LOG_SIZE = this.logSize
    this.butterflyMaterial = this.gpuCompute.createShaderMaterial(butterflyShader, {
      uInput: { value: null }, uStage: { value: 0 }, uHorizontal: { value: true },
    })
    // Butterfly inputs must remain nearest-filtered. Completed spatial fields
    // are copied into separate linear targets for smooth mesh displacement and
    // normals without corrupting the FFT computation itself.
    this.packs = Array.from({ length: 3 }, () => [this.makeTarget(), this.makeTarget()])
    this.finalTargets = Array.from({ length: 3 }, () => this.makeTarget(THREE.LinearFilter))
    this.outputTextures = this.finalTargets.map((target) => target.texture)
  }

  makeTarget(filter = THREE.NearestFilter) {
    return this.gpuCompute.createRenderTarget(this.size, this.size, THREE.RepeatWrapping,
      THREE.RepeatWrapping, filter, filter)
  }

  createInitialSpectrum(windSpeed, seed) {
    const texture = this.gpuCompute.createTexture()
    const data = texture.image.data
    const gaussian = createGaussian(seed)
    const wind = new THREE.Vector2(0.94, 0.342).normalize()
    const windAngle = Math.atan2(wind.y, wind.x)
    const fetchKm = 100
    const peakEnhancement = 6.0
    const spreadBlend = 0.85
    const swell = 0.2
    const deltaK = Math.PI * 2 / this.patchLength
    const spectralBinArea = deltaK * deltaK
    const half = this.size / 2
    for (let z = 0; z < this.size; z += 1) for (let x = 0; x < this.size; x += 1) {
      const nx = x < half ? x : x - this.size
      const nz = z < half ? z : z - this.size
      const kx = Math.PI * 2 * nx / this.patchLength
      const kz = Math.PI * 2 * nz / this.patchLength
      const k2 = kx*kx + kz*kz
      const offset = (z*this.size + x)*4
      if (k2 === 0) continue
      const k = Math.sqrt(k2)
      const shortWaveDampingLength = 0.35
      const omega = Math.sqrt(GRAVITY*k)
      const { density: frequencyDensity, peakOmega } = jonswapSpectrum(
        omega, windSpeed, fetchKm, peakEnhancement,
      )
      const frequencyDerivative = GRAVITY/(2*omega)
      const relativeAngle = Math.atan2(kz, kx) - windAngle
      const directional = directionSpectrum(
        relativeAngle, omega, peakOmega, spreadBlend, swell,
      )
      const spectrumDensity = 2*frequencyDensity*Math.abs(frequencyDerivative)/k
        * directional
        * Math.exp(-k2*shortWaveDampingLength*shortWaveDampingLength)
      const varianceInBin = spectrumDensity * spectralBinArea
      const scale = Math.sqrt(Math.max(varianceInBin, 0)*0.5)
      data[offset] = gaussian()*scale
      data[offset + 1] = gaussian()*scale
    }
    texture.needsUpdate = true
    return texture
  }

  update(time) {
    this.spectrumVariable.material.uniforms.uTime.value = time
    this.gpuCompute.compute()
    const spectrum = this.gpuCompute.getCurrentRenderTarget(this.spectrumVariable).texture
    for (let mode = 0; mode < 3; mode += 1) {
      const targets = this.packs[mode]
      this.deriveMaterial.uniforms.uSpectrum.value = spectrum
      this.deriveMaterial.uniforms.uMode.value = mode
      this.gpuCompute.doRenderTarget(this.deriveMaterial, targets[0])
      let read = 0
      for (let axis = 0; axis < 2; axis += 1) {
        this.butterflyMaterial.uniforms.uHorizontal.value = axis === 0
        for (let stage = 0; stage < this.logSize; stage += 1) {
          const write = 1-read
          this.butterflyMaterial.uniforms.uInput.value = targets[read].texture
          this.butterflyMaterial.uniforms.uStage.value = stage
          this.gpuCompute.doRenderTarget(this.butterflyMaterial, targets[write])
          read = write
        }
      }
      this.gpuCompute.renderTexture(targets[read].texture, this.finalTargets[mode])
      this.outputTextures[mode] = this.finalTargets[mode].texture
    }
  }

  readHeightStats(renderer, verticalScale = 1) {
    const pixels = new Float32Array(this.size * this.size * 4)
    renderer.readRenderTargetPixels(
      this.finalTargets[0],
      0,
      0,
      this.size,
      this.size,
      pixels,
    )
    let min = Infinity
    let max = -Infinity
    let sum = 0
    for (let i = 0; i < this.size * this.size; i += 1) {
      const height = pixels[i * 4] * verticalScale
      min = Math.min(min, height)
      max = Math.max(max, height)
      sum += height
    }
    return { minHeight: min, maxHeight: max, meanHeight: sum / (this.size * this.size) }
  }

  dispose() {
    this.h0Texture.dispose()
    this.deriveMaterial.dispose()
    this.butterflyMaterial.dispose()
    for (const targets of this.packs) for (const target of targets) target.dispose()
    for (const target of this.finalTargets) target.dispose()
    this.gpuCompute.dispose()
  }
}
