# Real-Time FFT Ocean

![Current GPU FFT ocean](assets/fft-ocean-demo.gif)

A real-time spectral ocean implemented with React Three Fiber, Three.js, and
WebGL2 render-to-texture passes. The simulation builds directional JONSWAP sea
states in frequency space, evolves them on the GPU, and reconstructs height,
slope, horizontal displacement, and displacement derivatives with two-dimensional
inverse FFTs.

## Main features

- Four independently seeded, band-limited $512^2$ spectral cascades:

  | Cascade | Periodic domain | Wavelength band |
  |---|---:|---:|
  | Swell | 400 m | 25--400 m |
  | Wind sea | 100 m | 8--100 m |
  | Short waves | 25 m | 2--25 m |
  | Detail | 6.25 m | 0.25--6.25 m |

- Two directional JONSWAP components per cascade, with separate wind speed,
  direction, fetch, peak enhancement, spreading, and energy.
- Seeded complex Gaussian initialization for deterministic sea realizations.
- Finite-depth dispersion, $d\omega/dk$, and TMA correction during spectrum
  initialization.
- Deep-water animation frequencies quantized to a 200-second common loop.
- GPU-resident phase evolution and radix-2 butterfly IFFT passes.
- Spectral slopes for surface normals and quarter-phase horizontal displacement
  for sharp, choppy crests.
- Spectral displacement derivatives and a Jacobian compression signal for
  breaking-wave detection.
- Persistent foam feedback with injection, exponential decay, four cascade
  histories packed into RGBA, and Gaussian reconstruction to soften foam texels.
- A smooth fold guard and front-face rendering to prevent visibly inverted
  triangles at highly compressed crests.
- A modified Three.js `MeshPhysicalMaterial` retaining PBR lighting while adding
  ocean displacement, water absorption/scattering, directional crest lighting,
  distance haze, and foam-dependent colour and roughness.
- HDR environment lighting, a directional sun aligned against the dominant wave
  travel direction, water IOR 1.333, and ACES tone mapping.
- Live controls for water depth, motion speed, per-cascade energy, height,
  choppiness, roughness, and environment intensity.

## Why four spectral domains?

For an $N\times N$ FFT over a periodic length $L$, the shortest representable
wavelength is approximately

$$
\lambda_{\min}\approx\frac{2L}{N}.
$$

A 400 m, $512^2$ spectrum therefore reaches only about 1.56 m. Representing both
400 m swells and 0.25 m detail in one radix-2 transform would require a practical
size of $4096^2$. Four $512^2$ transforms divide that range into efficient bands;
their spatial outputs are then combined on the rendered surface.

## Pipeline

```text
wind, fetch, depth
        ↓
directional JONSWAP + TMA
        ↓
seeded initial spectrum h₀(k)
        ↓
GPU phase evolution h(k,t)
        ↓
height / slope / displacement / derivative spectra
        ↓
horizontal and vertical butterfly IFFTs
        ↓
four spatial cascades packed into atlases
        ↓
mesh displacement + Jacobian foam + PBR rendering
```

WebGL2 has no general compute-shader stage. `GPUComputationRenderer` is used here
to schedule full-screen fragment-shader passes over floating-point render
targets. FFT intermediates use nearest filtering; finalized spatial fields use
linear filtering for smooth mesh sampling.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The presentation camera is constrained to preserve
the intended ocean/horizon composition; the mouse wheel controls viewing
distance. The Leva controls are hidden by default but remain wired into the
simulation.

For a production build:

```bash
npm run build
npm run preview
```

## Project structure

- [`src/ocean/GPUOceanSimulation.js`](src/ocean/GPUOceanSimulation.js) — spectrum
  initialization, phase evolution, derived spectral fields, and butterfly IFFTs.
- [`src/ocean/GPUFoamSimulation.js`](src/ocean/GPUFoamSimulation.js) — Jacobian
  foam source, accumulation, and decay.
- [`src/ocean/GPUOceanAtlas.js`](src/ocean/GPUOceanAtlas.js) — packs cascade
  outputs into texture atlases.
- [`src/components/Ocean.jsx`](src/components/Ocean.jsx) — cascade configuration,
  live controls, scheduling, and material setup.
- [`src/shaders/ocean.vert.glsl`](src/shaders/ocean.vert.glsl) — cascade sampling,
  displacement, fold protection, and normal construction.
- [`src/shaders/ocean.frag.glsl`](src/shaders/ocean.frag.glsl) — foam reconstruction
  and water shading.

## Scope and limitations

The ocean is still a linear, periodic surface model with one uniform water depth.
The TMA correction changes the initial spectral energy, but phase evolution uses
quantized deep-water frequencies. The Jacobian is a useful breaking proxy, not a
multiphase simulation of overturning water, entrained air, spray, or bubbles.
There is no shoreline interaction, spatially varying bathymetry, current field,
foam advection, wake solver, or two-way object coupling.

The repository also does not yet contain automated single-mode, Hermitian-residue,
CPU--GPU FFT comparison, GPU timing, or long-running memory tests.

## Reports and references

- [English project report](./report.pdf)
- [中文项目报告](./report_cn.pdf)
- [Jerry Tessendorf, *Simulating Ocean Water*](./tessendorf-ocean-course-notes-2004.pdf)
