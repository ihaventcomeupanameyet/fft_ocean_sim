import { Environment, OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Ocean } from './Ocean.jsx'
import { MAJOR_WAVE_DIRECTION, SUN_POLAR_ANGLE_DEGREES } from '../ocean/oceanConfig.js'

const CAMERA_HEIGHT = 35
const CAMERA_SHORE_OFFSET = -150
const CAMERA_TARGET_HEIGHT = 15
const CAMERA_LOOK_DISTANCE = 120

function CameraRig() {
  const { camera } = useThree()
  useLayoutEffect(() => {
    // Look perpendicularly across the longest water distance. The elevated,
    // downward-pitched view reveals crest shapes while the narrow 30° FOV
    // keeps the plane's side corners outside a normal widescreen frustum.
    camera.position.set(0, CAMERA_HEIGHT, CAMERA_SHORE_OFFSET)
    camera.lookAt(0, CAMERA_TARGET_HEIGHT, CAMERA_LOOK_DISTANCE)
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
        target={[0, CAMERA_TARGET_HEIGHT, CAMERA_LOOK_DISTANCE]}
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
