import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Detailed } from '@react-three/drei'
import * as THREE from 'three'
import CustomShaderMaterial from 'three-custom-shader-material'
import { folder, useControls } from 'leva'
import { GPUOceanSimulation } from '../ocean/GPUOceanSimulation.js'
import { FOAM_RESOLUTION, GPUFoamSimulation } from '../ocean/GPUFoamSimulation.js'
import { GPUOceanAtlas } from '../ocean/GPUOceanAtlas.js'
import {
  MAJOR_WAVE_DIRECTION, OCEAN_SIZE, SUN_POLAR_ANGLE_DEGREES,
} from '../ocean/oceanConfig.js'
import vertexShader from '../shaders/ocean.vert.glsl?raw'
import fragmentShader from '../shaders/ocean.frag.glsl?raw'

const PLANE_SIZE = OCEAN_SIZE

const CASCADES = [
  { size: 512, patchLength: 400, displayLength: 400,
    minWavelength: 25, maxWavelength: 400, seed: 28, spectra: [
    { scale: 0.75, windSpeed: 20, windDirection: 130, fetchMeters: 100000,
      spreadBlend: 1, swell: 0.9, peakEnhancement: 5, shortWavesFade: 0.8 },
    { scale: 0.24, windSpeed: 15, windDirection: 112, fetchMeters: 50000,
      spreadBlend: 1, swell: 0.9, peakEnhancement: 4, shortWavesFade: 0.8 },
  ] },
  { size: 512, patchLength: 100, displayLength: 100,
    minWavelength: 8, maxWavelength: 100, seed: 29, spectra: [
    { scale: 0.28, windSpeed: 15, windDirection: 125, fetchMeters: 30000,
      spreadBlend: 0.98, swell: 0.9, peakEnhancement: 5, shortWavesFade: 0.4 },
    { scale: 0.10, windSpeed: 12, windDirection: 92, fetchMeters: 12000,
      spreadBlend: 0.98, swell: 0.85, peakEnhancement: 4, shortWavesFade: 0.4 },
  ] },
  { size: 512, patchLength: 25, displayLength: 25,
    minWavelength: 2, maxWavelength: 25, seed: 30, spectra: [
    { scale: 0.10, windSpeed: 9, windDirection: 130, fetchMeters: 4000,
      spreadBlend: 0.95, swell: 0.8, peakEnhancement: 3, shortWavesFade: 0.4 },
    { scale: 0.04, windSpeed: 7, windDirection: 78, fetchMeters: 1500,
      spreadBlend: 0.95, swell: 0.75, peakEnhancement: 2, shortWavesFade: 0.4 },
  ] },
  { size: 512, patchLength: 6.25, displayLength: 6.25,
    minWavelength: 0.25, maxWavelength: 6.25, seed: 31, spectra: [
    { scale: 0.025, windSpeed: 5, windDirection: 125, fetchMeters: 400,
      spreadBlend: 0.8, swell: 0.6, peakEnhancement: 1, shortWavesFade: 0.2 },
    { scale: 0.012, windSpeed: 4, windDirection: 70, fetchMeters: 150,
      spreadBlend: 0.6, swell: 0.4, peakEnhancement: 1, shortWavesFade: 0.2 },
  ] },
]

export function Ocean() {
  const loggedHeightStats = useRef(false)
  const simulationTime = useRef(0)
  const { gl } = useThree()
  const controls = useControls({
    Simulation: folder({
      waterDepth: { value: 10, min: 5, max: 1000, step: 5, label: 'Water depth (m)' },
      timeScale: { value: 1.5, min: 0, max: 3, step: 0.05, label: 'Motion speed' },
    }),
    'Cascade energy': folder({
      swellEnergy: { value: 1, min: 0, max: 1.5, step: 0.01 },
      windSeaEnergy: { value: 1, min: 0, max: 1.5, step: 0.01 },
      shortEnergy: { value: 1, min: 0, max: 1.5, step: 0.01 },
      detailEnergy: { value: 1, min: 0, max: 1.5, step: 0.01 },
    }),
    'Surface shape': folder({
      swellHeight: { value: 1.15, min: 0, max: 2.5, step: 0.05 },
      windSeaHeight: { value: 1.0, min: 0, max: 2.5, step: 0.05 },
      shortHeight: { value: 0.75, min: 0, max: 2, step: 0.05 },
      detailHeight: { value: 0.5, min: 0, max: 1, step: 0.05 },
      swellChoppiness: { value: 1.15, min: 0, max: 2, step: 0.05 },
      windSeaChoppiness: { value: 0.95, min: 0, max: 2, step: 0.05 },
      shortChoppiness: { value: 0.7, min: 0, max: 2, step: 0.05 },
      detailChoppiness: { value: 0.35, min: 0, max: 1, step: 0.05 },
    }),
    Appearance: folder({
      roughness: { value: 0.08, min: 0.02, max: 0.5, step: 0.01 },
      environmentIntensity: { value: 1.35, min: 0, max: 3, step: 0.05 },
    }),
  })
  const spectrumScales = [
    controls.swellEnergy, controls.windSeaEnergy, controls.shortEnergy, controls.detailEnergy,
  ]
  const simulations = useMemo(() => CASCADES.map((settings, index) => (
    new GPUOceanSimulation(gl, {
      ...settings,
      waterDepth: controls.waterDepth,
      spectrumScale: spectrumScales[index],
    })
  )), [gl, controls.waterDepth, ...spectrumScales])
  const foamSimulation = useMemo(() => new GPUFoamSimulation(
    gl, simulations, CASCADES.map((cascade) => cascade.displayLength),
  ), [gl, simulations])
  const atlases = useMemo(() => new GPUOceanAtlas(gl, simulations), [gl, simulations])
  const uniforms = useMemo(() => ({
    uDisplacementAtlas: { value: atlases.targets[0].texture },
    uDerivativeAtlas: { value: atlases.targets[1].texture },
    uPatchLengths: { value: new THREE.Vector4(...CASCADES.map((c) => c.displayLength)) },
    uOceanSize: { value: PLANE_SIZE },
    uVerticalWeights: { value: new THREE.Vector4() },
    uChoppiness: { value: new THREE.Vector4() },
    uNormalStrength: { value: 0.34 },
    uDeepColor: { value: new THREE.Color('#021c29') },
    uShallowColor: { value: new THREE.Color('#16798b') },
    uFoamColor: { value: new THREE.Color('#d9edf0') },
    uAbsorption: { value: new THREE.Color(0.34, 0.115, 0.055) },
    uWaterScatterColor: { value: new THREE.Color('#087985') },
    uFoamTexture: { value: foamSimulation.texture },
    uFoamTexelSize: { value: new THREE.Vector2(1 / FOAM_RESOLUTION, 1 / FOAM_RESOLUTION) },
    uSunDirection: { value: (() => {
      const wave = new THREE.Vector2(...MAJOR_WAVE_DIRECTION).normalize()
      const phi = THREE.MathUtils.degToRad(SUN_POLAR_ANGLE_DEGREES)
      return new THREE.Vector3(
        wave.x * Math.sin(phi), Math.cos(phi), wave.y * Math.sin(phi),
      ).normalize()
    })() },
  }), [atlases, foamSimulation, simulations])

  useEffect(() => () => foamSimulation.dispose(), [foamSimulation])
  useEffect(() => () => atlases.dispose(), [atlases])
  useEffect(() => () => simulations.forEach((simulation) => simulation.dispose()), [simulations])

  useFrame(({ clock }, deltaTime) => {
    simulationTime.current += deltaTime*controls.timeScale
    simulations.forEach((simulation) => simulation.update(simulationTime.current))
    atlases.update(gl, simulations)
    const choppiness = uniforms.uChoppiness.value
    choppiness.set(
      controls.swellChoppiness, controls.windSeaChoppiness,
      controls.shortChoppiness, controls.detailChoppiness,
    )
    foamSimulation.update(deltaTime * controls.timeScale, simulations, choppiness)
    if (!loggedHeightStats.current && clock.getElapsedTime() > 1) {
      loggedHeightStats.current = true
      console.info('FFT ocean cascade height diagnostics', simulations.map(
        (simulation, index) => ({ index, ...simulation.readHeightStats(gl, 1.0) }),
      ))
    }
    uniforms.uVerticalWeights.value.set(
      controls.swellHeight, controls.windSeaHeight, controls.shortHeight, controls.detailHeight,
    )
    uniforms.uFoamTexture.value = foamSimulation.texture
    uniforms.uDisplacementAtlas.value = atlases.targets[0].texture
    uniforms.uDerivativeAtlas.value = atlases.targets[1].texture
  })

  const material = (key) => (
    <CustomShaderMaterial
      key={key}
      baseMaterial={THREE.MeshPhysicalMaterial}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      color="#0c7485"
      roughness={controls.roughness}
      metalness={0}
      ior={1.333}
      transmission={0}
      envMapIntensity={controls.environmentIntensity}
      side={THREE.FrontSide}
    />
  )

  return (
    <Detailed distances={[0, 180, 420]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, 512, 512]} />
        {material('near')}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, 256, 256]} />
        {material('middle')}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, 128, 128]} />
        {material('far')}
      </mesh>
    </Detailed>
  )
}
