import * as THREE from 'three'

const atlasShader = /* glsl */ `
uniform sampler2D uLayer0;
uniform sampler2D uLayer1;
uniform sampler2D uLayer2;
uniform sampler2D uLayer3;
varying vec2 vUv;
void main() {
  vec2 quadrant = floor(vUv * 2.0);
  vec2 localUv = fract(vUv * 2.0);
  vec4 value;
  if (quadrant.y < 0.5) {
    value = quadrant.x < 0.5 ? texture2D(uLayer0, localUv) : texture2D(uLayer1, localUv);
  } else {
    value = quadrant.x < 0.5 ? texture2D(uLayer2, localUv) : texture2D(uLayer3, localUv);
  }
  gl_FragColor = value;
}`

export class GPUOceanAtlas {
  constructor(renderer, simulations) {
    const resolution = simulations[0].size * 2
    const options = {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    }
    this.targets = [
      new THREE.WebGLRenderTarget(resolution, resolution, options),
      new THREE.WebGLRenderTarget(resolution, resolution, options),
    ]
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uLayer0: { value: null }, uLayer1: { value: null },
        uLayer2: { value: null }, uLayer3: { value: null },
      },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}',
      fragmentShader: atlasShader,
      depthTest: false,
      depthWrite: false,
    })
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.scene.add(this.mesh)
    this.update(renderer, simulations)
  }

  update(renderer, simulations) {
    const previousTarget = renderer.getRenderTarget()
    for (let field = 0; field < 2; field += 1) {
      simulations.forEach((simulation, index) => {
        this.material.uniforms[`uLayer${index}`].value = simulation.outputTextures[field]
      })
      renderer.setRenderTarget(this.targets[field])
      renderer.render(this.scene, this.camera)
    }
    renderer.setRenderTarget(previousTarget)
  }

  dispose() {
    this.targets.forEach((target) => target.dispose())
    this.material.dispose()
    this.mesh.geometry.dispose()
  }
}
