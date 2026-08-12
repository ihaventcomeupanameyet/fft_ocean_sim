# Why One FFT Ocean Struggles to Show Both Large Swell and Fine Ripples

## Summary

An FFT ocean does not sample every possible wave. It samples a finite rectangular lattice in frequency space. The physical patch length (L) and FFT resolution (N) jointly decide the wavelength range available to the simulation.

The previous setup used

\[
L=2000\ \text{m}, \qquad N=256.
\]

That domain was large enough to hide repetition, but it allocated too little spectral resolution to short waves. The spatial interval was

\[
\Delta x=\frac{L}{N}=\frac{2000}{256}=7.8125\ \text{m}.
\]

The shortest representable wavelength was approximately the Nyquist wavelength:

\[
\lambda_{\min}=2\Delta x=15.625\ \text{m}.
\]

Therefore, waves shorter than about 15.6 meters did not exist in the simulation. Increasing mesh subdivisions could not restore them because the missing information was in the FFT spectrum, not the geometry.

The revised setup uses

\[
L=512\ \text{m}, \qquad N=256,
\]

giving

\[
\Delta x=2\ \text{m}, \qquad \lambda_{\min}\approx4\ \text{m}.
\]

This is a more useful compromise for a single FFT field: it retains broad wind waves while adding a meaningful intermediate ripple band.

## 1. The available frequency lattice

For a square periodic domain, the discrete wave vectors are

\[
\mathbf{k}_{n,m}=
\left(\frac{2\pi n}{L},\frac{2\pi m}{L}\right).
\]

The distance between neighboring frequency samples is

\[
\Delta k=\frac{2\pi}{L}.
\]

A larger (L) makes (\Delta k) smaller. This gives more closely spaced samples near low frequency and allows very long waves. However, if (N) remains fixed, those additional samples come at the cost of the maximum representable frequency.

The approximate range is

\[
k_{\min}=\frac{2\pi}{L},
\qquad
k_{\max}\approx\frac{\pi N}{L}.
\]

Equivalently, the wavelength range is approximately

\[
\frac{2L}{N}\lesssim\lambda\lesssim L.
\]

This relationship is the central tradeoff:

- larger (L): longer waves, less repetition, weaker short-wave coverage;
- smaller (L): better fine detail, but fewer long waves and more obvious tiling;
- larger (N): improves short-wave coverage without shrinking the domain, but costs more GPU memory and FFT passes.

## 2. Why a dense mesh does not create missing ripples

The plane currently has (512\times512) geometry segments, while the FFT has (256\times256) samples. The extra vertices interpolate the spatial FFT textures smoothly.

They do not add new wavelengths.

If the FFT contains no modes above a particular (k), every additional vertex samples the same band-limited surface. A million triangles cannot reconstruct frequencies that were never simulated.

The hierarchy of broad swell, medium waves, and fine ripples must originate in the frequency-domain data or in a separate normal/detail model.

## 3. Why the Phillips spectrum favors large waves

The baseline spectrum is

\[
P_h(\mathbf{k})=
A\frac{\exp[-1/(kL_w)^2]}{k^4}
|\hat{\mathbf{k}}\cdot\hat{\mathbf{w}}|^2
\exp(-k^2\ell^2),
\]

where

\[
L_w=\frac{V^2}{g}.
\]

The (1/k^4) term strongly favors low-frequency waves. The exponential containing (L_w) suppresses waves that are too long for the selected wind. The final exponential suppresses high-frequency waves.

Consequently, poor parameter balance can produce either of two failures:

1. Too much low-frequency energy creates rounded, thick, slowly varying blobs.
2. Too much high-frequency energy creates noisy normals and a crumpled-foil appearance.

The desired result lies between them: a clear large-scale structure with progressively weaker short-wave energy.

## 4. Why the 2 km patch became bubbly instead of detailed

With (L=2000\) m and (N=256), the spectrum contained long and medium waves but no waves below approximately 15.6 m. Horizontal displacement was then applied to this coarse field.

The displacement is

\[
\mathbf{D}(\mathbf{x},t)=
\sum_{\mathbf{k}}
-i\frac{\mathbf{k}}{k}
\tilde h(\mathbf{k},t)e^{i\mathbf{k}\cdot\mathbf{x}}.
\]

Strong displacement can sharpen crests, but it cannot manufacture missing short wavelengths. Applying too much displacement to a coarse spectrum compresses broad shapes into thick rounded crests. That explains the bubbly curvature.

The correction is not simply more geometry. It is:

- choose a domain with sufficient spectral bandwidth;
- reduce horizontal displacement;
- retain enough intermediate and high-frequency energy to break up broad curvature;
- use multiple FFT cascades when one domain cannot cover the required scale range.

## 5. Current JONSWAP configuration

The revised configuration is:

| Parameter | Value |
|---|---:|
| FFT resolution (N) | 256 |
| Physical patch (L) | 128 m |
| Spatial interval (L/N) | 0.5 m |
| Approximate minimum wavelength | 1 m |
| Rendered plane | 128 m |
| Wind speed | 8.5 m/s |
| Short-wave damping length (\ell) | 0.35 m |
| Frequency spectrum | JONSWAP |
| Fetch | 100 km |
| Peak enhancement (gamma) | 6.0 |
| Direction spread blend | 0.85 |
| Swell spread | 0.2 |
| Vertical scale | 1.0 |
| Choppiness | 0.0 |

The rendered plane covers exactly one FFT period, so the surface joins seamlessly at its edges without displaying several copies inside the plane. The active sampler now follows the NodeRenderPipeline reference's JONSWAP path rather than the simpler Phillips spectrum used during initial debugging.

Choppiness is disabled so the underlying height spectrum can be judged without horizontal-displacement artifacts. The stronger short-wave damping suppresses unstable energy near the Nyquist limit.

With 12 m/s wind, the Phillips wind length is

\[
L_w=V^2/g\approx14.7\ \text{m},
\]

and the approximate peak wavelength is

\[
\lambda_{peak}\approx2\pi\sqrt{2}L_w\approx131\ \text{m}.
\]

That analytical peak is close to the 128 m domain length. This is acceptable for the requested diagnostic configuration, but it means the longest modes still deserve careful inspection before artistic scaling is restored.

The implementation also converts continuous spectral density into variance for each discrete Fourier cell:

\[
\operatorname{Var}[\tilde h_0(\mathbf{k})]
=P_h(\mathbf{k})\,\Delta k_x\Delta k_z,
\qquad
\Delta k=\frac{2\pi}{L}.
\]

Without this bin-area factor, changing the domain size or FFT resolution changes the total simulated energy even if the physical spectrum parameters remain unchanged.

### Removed swell experiment

A previous experiment shaped the Phillips tail with a narrow directional swell lobe:

\[
P_{final}(\mathbf{k})=P_{Phillips}(\mathbf{k})
\left[1+s\,B(k)\,|\hat{\mathbf{k}}\cdot\hat{\mathbf{w}}|^8\right],
\]

where (B(k)) is a log-Gaussian band centered on a 110 m wavelength and (s=5.5). The narrow band makes a limited group of long, aligned modes visually dominant. The remaining Phillips energy provides intermediate and short-wave detail.

Although this remained a Gaussian random Fourier ocean, it created a dominant ridge close to the domain scale and made debugging difficult. The entire swell block has now been removed. The current code uses only the baseline Phillips spectrum, its directional term, backward-wave suppression, and the paper's short-wave damping term.

The clean baseline uses vertical scale 1.0 and horizontal choppiness 0.0. Amplitude was raised from the overly conservative debugging values while horizontal displacement remains disabled, allowing the underlying height spectrum to be judged directly.

## 6. Why one field still cannot reproduce every scale

The current field covers wavelengths from roughly 2 m to 128 m. Real ocean appearance includes structures much smaller than 2 m, including capillary and short gravity waves.

Increasing (N) could extend the range:

| (L) | (N) | Spatial interval | Approx. minimum wavelength |
|---:|---:|---:|---:|
| 512 m | 256 | 2 m | 4 m |
| 512 m | 512 | 1 m | 2 m |
| 512 m | 1024 | 0.5 m | 1 m |

However, a two-dimensional FFT becomes more expensive as (N^2\log N), and this project transforms several packed fields every frame.

The usual solution is spectral cascading rather than one enormous FFT.

## 7. Spectral cascades

A cascaded ocean uses multiple periodic FFT domains, each assigned a wavelength band. For example:

| Cascade | Patch | Resolution | Approximate role |
|---|---:|---:|---|
| Large | 2000 m | 256 | broad swell |
| Medium | 512 m | 256 | primary wind waves |
| Small | 128 m | 256 | short waves and detailed slopes |

Each cascade must be band-limited so the same wavelength energy is not counted repeatedly. Their spatial results can then be combined:

\[
h(\mathbf{x},t)=h_{large}+h_{medium}+h_{small},
\]

\[
\nabla h=\nabla h_{large}+\nabla h_{medium}+\nabla h_{small}.
\]

The large field supplies broad silhouette and motion. The small field contributes much more strongly to normals and highlights than to vertical height. This produces the desired hierarchy without forcing one FFT lattice to cover an impractically wide frequency range.

## 8. Recommended next step

First evaluate the revised 512 m single spectrum. It should show less repetition, thinner crests, and more intermediate-scale structure than the 2 km version.

If the target still requires visible sub-4-meter ripples, keep this 512 m field as the primary wave field and add a smaller independently seeded cascade. Do not restore excessive choppiness or high-frequency noise to the primary field; those approaches create artifacts rather than a physically readable scale hierarchy.
