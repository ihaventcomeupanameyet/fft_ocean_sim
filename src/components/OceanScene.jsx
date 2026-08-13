import { Environment, OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Ocean } from './Ocean.jsx'

function CameraRig() {
  const { camera } = useThree()
  useFrame(() => {
    camera.position.y = Math.max(camera.position.y, 3.5)
  })
  return null
}

export function OceanScene() {
  const sun = useMemo(() => {
    const phi = THREE.MathUtils.degToRad(68)
    const theta = THREE.MathUtils.degToRad(128)
    return new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
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
        target={[0, 0, 0]}
        minDistance={8}
        maxDistance={1400}
        maxPolarAngle={Math.PI * 0.485}
        enableDamping
        dampingFactor={0.06}
      />
    </>
  )
}
