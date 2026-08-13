import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import CustomShaderMaterial from 'three-custom-shader-material'
import { folder, useControls } from 'leva'
import { GPUOceanSimulation } from '../ocean/GPUOceanSimulation.js'
import vertexShader from '../shaders/ocean.vert.glsl?raw'
import fragmentShader from '../shaders/ocean.frag.glsl?raw'

const PLANE_SIZE = 640
const SEGMENTS = 512

const CASCADES = [
  // A narrow, long-period swell underneath the locally generated wind sea.
  { size: 256, patchLength: 1200, fetchKm: 450, peakEnhancement: 10,
    spreadBlend: 0.98, swell: 1.1, minWavelength: 140, maxWavelength: 600,
    spectrumScale: 0.28, seed: 1701 },
  { size: 256, patchLength: 640, fetchKm: 100, peakEnhancement: 6,
    spreadBlend: 0.9, swell: 0.35, minWavelength: 35, maxWavelength: 180,
    spectrumScale: 0.72, seed: 2903 },
  { size: 128, patchLength: 160, fetchKm: 12, peakEnhancement: 4,
    spreadBlend: 0.84, swell: 0.2, minWavelength: 8, maxWavelength: 45,
    spectrumScale: 0.28, seed: 3911 },
  // Mostly slope and highlight detail; its vertical contribution is restrained.
  { size: 128, patchLength: 48, fetchKm: 1.8, peakEnhancement: 2.5,
    spreadBlend: 0.72, swell: 0.05, minWavelength: 2.5, maxWavelength: 12,
    spectrumScale: 0.10, seed: 4933 },
]

export function Ocean() {
  const materialRef = useRef()
  const loggedHeightStats = useRef(false)
  const simulationTime = useRef(0)
  const { gl } = useThree()
  const controls = useControls({
    Simulation: folder({
      windSpeed: { value: 20, min: 5, max: 45, step: 0.5, label: 'Wind speed (m/s)' },
      timeScale: { value: 1.25, min: 0, max: 2.5, step: 0.01 },
    }),
    'Cascade energy': folder({
      swellEnergy: { value: 0.28, min: 0, max: 1.5, step: 0.01 },
      windSeaEnergy: { value: 0.72, min: 0, max: 1.5, step: 0.01 },
      shortEnergy: { value: 0.28, min: 0, max: 1, step: 0.01 },
      detailEnergy: { value: 0.10, min: 0, max: 0.5, step: 0.01 },
    }),
    'Surface shape': folder({
      swellHeight: { value: 1.0, min: 0, max: 2.5, step: 0.05 },
      windSeaHeight: { value: 1.0, min: 0, max: 2.5, step: 0.05 },
      shortHeight: { value: 0.8, min: 0, max: 2, step: 0.05 },
      detailHeight: { value: 0.3, min: 0, max: 1, step: 0.05 },
      swellChoppiness: { value: 0.90, min: 0, max: 2, step: 0.05 },
      windSeaChoppiness: { value: 1.25, min: 0, max: 2, step: 0.05 },
      shortChoppiness: { value: 0.90, min: 0, max: 2, step: 0.05 },
      detailChoppiness: { value: 0.25, min: 0, max: 1, step: 0.05 },
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
      windSpeed: controls.windSpeed,
      spectrumScale: spectrumScales[index],
    })
  )), [gl, controls.windSpeed, ...spectrumScales])
  const uniforms = useMemo(() => ({
    ...Object.fromEntries(simulations.flatMap((simulation, index) => [
      [`uHeightSlopeX${index}`, { value: simulation.outputTextures[0] }],
      [`uSlopeZDisplacementX${index}`, { value: simulation.outputTextures[1] }],
      [`uDisplacementZ${index}`, { value: simulation.outputTextures[2] }],
    ])),
    uPatchLengths: { value: new THREE.Vector4(...CASCADES.map((c) => c.patchLength)) },
    uVerticalWeights: { value: new THREE.Vector4() },
    uChoppiness: { value: new THREE.Vector4() },
    uDeepColor: { value: new THREE.Color('#021c29') },
    uShallowColor: { value: new THREE.Color('#16798b') },
    uFoamColor: { value: new THREE.Color('#d9edf0') },
  }), [simulations])

  useEffect(() => () => simulations.forEach((simulation) => simulation.dispose()), [simulations])

  useFrame(({ clock }, deltaTime) => {
    simulationTime.current += deltaTime*controls.timeScale
    simulations.forEach((simulation) => simulation.update(simulationTime.current))
    if (!loggedHeightStats.current && clock.getElapsedTime() > 1) {
      loggedHeightStats.current = true
      console.info('FFT ocean cascade height diagnostics', simulations.map(
        (simulation, index) => ({ index, ...simulation.readHeightStats(gl, 1.0) }),
      ))
    }
    if (materialRef.current) {
      materialRef.current.uniforms.uVerticalWeights.value.set(
        controls.swellHeight, controls.windSeaHeight, controls.shortHeight, controls.detailHeight,
      )
      materialRef.current.uniforms.uChoppiness.value.set(
        controls.swellChoppiness, controls.windSeaChoppiness,
        controls.shortChoppiness, controls.detailChoppiness,
      )
      simulations.forEach((simulation, index) => {
        materialRef.current.uniforms[`uHeightSlopeX${index}`].value = simulation.outputTextures[0]
        materialRef.current.uniforms[`uSlopeZDisplacementX${index}`].value = simulation.outputTextures[1]
        materialRef.current.uniforms[`uDisplacementZ${index}`].value = simulation.outputTextures[2]
      })
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS]} />
      <CustomShaderMaterial
        ref={materialRef}
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
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
