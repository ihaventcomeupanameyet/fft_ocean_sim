import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { OceanScene } from './components/OceanScene.jsx'

export default function App() {
  return (
    <main className="app-shell">
      <Canvas
        camera={{ position: [0, 160, 175], fov: 48, near: 0.1, far: 3000 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 0.78
        }}
      >
        <OceanScene />
      </Canvas>
    </main>
  )
}
