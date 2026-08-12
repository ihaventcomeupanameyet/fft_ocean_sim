# FFT Ocean visual milestone

A first runnable FFT-ocean study using:

- a seeded JONSWAP frequency spectrum converted to a directional 2D wavenumber spectrum;
- deep-water dispersion;
- `GPUComputationRenderer` evolving the Fourier spectrum every frame;
- packed GPU butterfly passes performing the 2D inverse FFT;
- paper-derived height, spectral slopes, and horizontal displacement;
- a `256 x 256` spectrum containing 65,536 frequency-domain modes;
- a `128 x 128 m` periodic physical FFT domain and matching rendered plane;
- `12 m/s` wind, `100 km` fetch, JONSWAP peak enhancement `6.0`, and `0.35 m` short-wave damping;
- frequency-dependent spreading, vertical display scale `1.0`, and choppiness disabled;
- no custom swell lobe or cross-wind energy floor;
- nearest-filtered FFT intermediates and linearly filtered final spatial fields;
- `three-custom-shader-material` extending `MeshStandardMaterial`;
- a dense `512 x 512` displaced plane;
- a single directional light over a solid atmospheric background.
- `citrus_orchard_puresky_1k.hdr` as a reflection/IBL environment without replacing the background.

The directional light is the only direct light. The HDRI supplies image-based lighting and reflections.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Drag to orbit and scroll to zoom.

## Current scope

After seeded Phillips-spectrum initialization, the simulation remains GPU-resident. `GPUComputationRenderer` evaluates equation 43 from the notes. Packed render-target butterfly passes then inverse-transform height, Fourier slopes, and equation 44 horizontal displacement. The next paper-derived field is the displacement Jacobian for folding and foam detection.
