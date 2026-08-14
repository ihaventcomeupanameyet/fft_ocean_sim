import { Environment, OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Ocean } from './Ocean.jsx'
import { MAJOR_WAVE_DIRECTION, SUN_POLAR_ANGLE_DEGREES } from '../ocean/oceanConfig.js'

const CAMERA_HEIGHT = 30

function CameraRig() {
  const { camera } = useThree()
  useLayoutEffect(() => {
    const wave = new THREE.Vector2(...MAJOR_WAVE_DIRECTION).normalize()
    camera.position.set(-wave.x * 175, CAMERA_HEIGHT, -wave.y * 175)
    camera.lookAt(0, CAMERA_HEIGHT, 0)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

export function OceanScene() {
  const sun = useMemo(() => {
    // The dominant waves travel along this XZ direction (see GPUOceanSimulation).
    // A DirectionalLight shines from its position toward the origin, so placing
    // the sun along the wave vector makes its rays travel against the waves.
    const majorWaveDirection = new THREE.Vector2(...MAJOR_WAVE_DIRECTION).normalize()
    const phi = THREE.MathUtils.degToRad(SUN_POLAR_ANGLE_DEGREES)
    const horizontal = Math.sin(phi)
    return new THREE.Vector3(
      majorWaveDirection.x * horizontal,
      Math.cos(phi),
      majorWaveDirection.y * horizontal,
    )
  }, [])

  return (
    <>
      <Environment
        files="/citrus_orchard_puresky_1k.hdr"
        background
        environmentIntensity={0.65}
      />
      <directionalLight
        position={[sun.x * 120, sun.y * 120, sun.z * 120]}
        color="#fff0d2"
        intensity={1.5}
      />

      <Ocean />
      <CameraRig />
      <OrbitControls
        makeDefault
        target={[0, CAMERA_HEIGHT, 0]}
        minDistance={8}
        maxDistance={1400}
        enableRotate={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
      />
    </>
  )
}
