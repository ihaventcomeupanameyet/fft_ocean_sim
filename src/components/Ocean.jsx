import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import CustomShaderMaterial from 'three-custom-shader-material'
import { GPUOceanSimulation } from '../ocean/GPUOceanSimulation.js'
import vertexShader from '../shaders/ocean.vert.glsl?raw'
import fragmentShader from '../shaders/ocean.frag.glsl?raw'

const PLANE_SIZE = 128
const SEGMENTS = 512

export function Ocean() {
  const materialRef = useRef()
  const loggedHeightStats = useRef(false)
  const { gl } = useThree()
  const simulation = useMemo(() => new GPUOceanSimulation(gl, {
    size: 256,
    patchLength: 128,
    windSpeed: 20.0,
    phillipsAmplitude: 0.0015,
    shortWaveDampingLength: 0.35,
    seed: 1701,
  }), [gl])
  const uniforms = useMemo(() => ({
    uHeightSlopeX: { value: simulation.outputTextures[0] },
    uSlopeZDisplacementX: { value: simulation.outputTextures[1] },
    uDisplacementZ: { value: simulation.outputTextures[2] },
    uVerticalScale: { value: 1.0 },
    uChoppiness: { value: 0.0 },
    uPatchRepeats: { value: PLANE_SIZE / simulation.patchLength },
  }), [simulation])

  useEffect(() => () => simulation.dispose(), [simulation])

  useFrame(({ clock }) => {
    simulation.update(clock.getElapsedTime() * 0.72)
    if (!loggedHeightStats.current && clock.getElapsedTime() > 1) {
      loggedHeightStats.current = true
      console.info('FFT ocean height diagnostics', simulation.readHeightStats(gl, 1.0))
    }
    if (materialRef.current) {
      materialRef.current.uniforms.uHeightSlopeX.value = simulation.outputTextures[0]
      materialRef.current.uniforms.uSlopeZDisplacementX.value = simulation.outputTextures[1]
      materialRef.current.uniforms.uDisplacementZ.value = simulation.outputTextures[2]
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
        roughness={0.22}
        metalness={0}
        ior={1.333}
        transmission={0}
        envMapIntensity={1.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
