# Sand / Water

A browser-playable, inland sand quarry: sculpt dunes, feed a perched basin, and watch water infiltrate, find a route downhill, cut the sand and leave sediment behind. Built with vanilla Three.js, Vite and an independent CPU physics worker. CC0 photographic sand and HDR daylight assets ship locally; no videos, copied research implementations or runtime network services.

**Credit: Garyck Arntzen — [@_mintydoge](https://x.com/_mintydoge).**

## Run

Node 20.19+ or 22.12+ (tested here with Node 24).

```sh
cd /workspace/sand-water-sandbox
npm install
npm run dev
```

Open the local URL Vite prints (normally **http://localhost:5173**). `npm run build` creates `dist/`; `npm run preview` serves the production build. Use a recent desktop browser with WebGL2 and hardware acceleration. The server binds to all interfaces so it can also be opened through a local port-forward; this does not deploy the app anywhere.

```sh
npm test                   # numerical / physical regression tests
npm run benchmark          # 500 water steps, each with three sand steps
STEPS=1500 npm run benchmark
npm run test:browser        # with the dev server already running
# or BASE_URL=http://localhost:4173 npm run test:browser against preview
```

The optional browser test uses Playwright and an installed `/usr/bin/google-chrome`, or `CHROME_PATH=/path/to/chrome`. If neither exists, install Playwright's browser separately with `npx playwright install chromium`. It exercises WebGL shader compilation, worker startup, pause, local water painting, the large pour, diagnostic views, keyboard modes, orbit and zoom. It creates **no screenshots or videos by default** (`SCREENSHOT=path.png` optionally saves a QA still). Its software WebGL renderer is a compatibility check, **not a hardware frame-rate benchmark**.

## Controls

| Action | Control |
|---|---|
| Paint the selected brush | **Left drag** |
| Orbit | **Right drag** |
| Pan | **Middle drag** |
| Zoom | **Wheel** |
| Raise / lower sand | **1 / 2** |
| Add / remove surface water | **3 / 4** |
| Temporarily invert a brush | Hold **Shift** |
| Brush radius | Slider or **[ / ]** |
| Pause / resume physics | **Space** or button |
| Reset the original quarry | **R** or button |
| Recover the original camera | **F** or button |
| Large, finite pour into the upper basin | **Large pour**, +45 m³ |

Left paint is intercepted before OrbitControls; sculpting cannot accidentally orbit. The pointer ring conforms to the actual displaced sand/water field, with height-field ray picking, rather than a flat interaction plane. Pausing freezes transport but still permits editing. Reset retains your spring, underdrain and erodibility settings. Navigation on a touchscreen uses one-finger orbit and two-finger pan/zoom; painting is designed for a mouse.

### First 30 seconds

The upper catchment already has water and the quarry spring is on. Water overflows the lip toward the lower depression; the thin opening is an initial terrain feature, **not** an animated channel. Erosion and deposition subsequently modify the actual sand field. A steady spring is approximately 4.7 m³/s at this scene scale.

- Switch to **Erosion / deposition**: orange shows a cut, green an accumulated deposit, relative to the original terrain. The HUD counts cumulative eroded solid volume.
- Use **Pore saturation** to see water migrate inside the sand, including places with no visible surface film.
- Raise a narrow bank beside the stream. A dry bank yields near 32°. Moderate pore moisture adds strength; repeatedly flooding it removes that cohesion and buoyancy reduces friction, allowing slumping.
- Turn off the spring and leave the permeable bed on to watch the basin drain. Remove-water is a local **surface** pump, not an instantaneous removal of groundwater.
- Use the erodibility slider to exaggerate or suppress hydraulic channel cutting without disabling sand slumping or seepage.

## What is actually simulated

### Representation

**192 × 192 cells**, over a nominal **60 × 60 m** square (sample spacing 60/191 ≈ 0.314 m). Four explicit fields are kept in `Simulation`:

- `H`: fixed, non-erodible bed elevation;
- `sand`: movable granular column thickness `hs` above H;
- `pore`: mixed / pore water volume per horizontal area, `h_wbar`;
- `water`: free surface layer depth `hw` above H + hs.

Sand sculpting edits **hs**, never H. There is also a conservative suspended-sediment field, separate horizontal velocities for surface water, pore water and sand, and a two-dimensional sand deformation state. Wetness history is a **rendering** field, not a hidden source of water.

### Operator-split update

1. **Sources and infiltration.** Compact brush kernels add/remove finite volume. Surface water enters available pore capacity at a finite rate. The illustrative capacity is `pore <= 0.5 hs`, equivalent to one-third pore volume in the fully saturated mixture. Water in excess of capacity emerges into the free layer. Transferred water carries its momentum into the pore phase. Optional underdrain removes pore water exponentially at 0.009/s and records it as discharged volume.
2. **Surface shallow flow.** Hydrostatic head is `eta = H + hs + hw`. Four persistent face fluxes accelerate under neighboring head differences, with a semi-Lagrangian velocity-advection correction and damping. Face depths prevent flow through a dry higher bank. Donor-cell outflow scaling guarantees non-negative depths. Water **and suspended sediment** use those same conservative upwind fluxes. Open outer water edges discharge to a tracked sink.
3. **Pore seepage.** A separate, much slower Darcy-type head-gradient flux and capillary diffusion move water *through* sand even without surface flow. The pore head uses H, stored pore water and a suction term; it is not tied to the visible sand surface. Donor limiting preserves volume. Pore velocities are obtained from these fluxes, a Darcy / overdamped approximation rather than a second fully inertial SWE solver.
4. **Three sand substeps per water step.** Semi-Lagrangian velocity prediction, shallow-sand gravitational pressure, surface-water loading, divergence of internal stress and two-way drag drive the granular phase. Conservative upwind fluxes transport sand, entrained pore water and mass-weighted constitutive attributes. Sand has closed outer walls, so grains are not silently discarded at the boundary.
5. **Friction and saturation strength.** Dry basal friction is `mu = 0.625` (about 32°). Pore saturation reduces that friction to model buoyancy. Cohesion uses the paper's piecewise regimes in mixture fraction `phi = (pore + surface water)/(hs + pore + surface water)`: rise to **phi1 = 0.20**, maintained/slightly increased strength to **phi2 = 0.25**, then collapse to zero at **phi3 = 0.33**. These phi values are **not** the HUD's percentage of filled pore capacity. A finite-depth cohesive yield resistance supplements the internal constitutive stress so modestly wet banks can hold slopes that dry banks cannot.
6. **Internal elastoplastic stress.** A **simplified 2D logarithmic-strain Drucker–Prager-like model**, not just an angle-of-repose filter: deformation evolves with the velocity gradient, is polar-decomposed into rotation theta and positive stretch P, and projected in principal log-strain space to a pressure-dependent shear-yield bound plus saturation cohesion. Rotation and stretch are advected separately with sand mass; angles are locally unwrapped to avoid false compression across rotations. The reconstructed stress is differentiated to push neighboring columns. Moduli are deliberately softened for browser time steps. This is **not an exact reproduction** of Su et al.'s constitutive model, CUDA kernels or return mapping.
7. **Momentum exchange.** An analytic relaxation transfers equal-and-opposite drag impulses between sand and pore water, and between the sand and a near-bed fraction of free water. It cannot become unstable merely because the drag coefficient is stiff. Water transfers momentum to moving sand; moving sand transfers momentum back to water, including feedback into persistent surface face fluxes. Friction, boundaries, semi-Lagrangian interpolation and velocity/flux caps mean the *whole simulation* is not exactly momentum-conservative.
8. **Hydraulic erosion / deposition.** Local bed slope, water speed and depth set a transport capacity. A bed-shear threshold that increases with cohesion resists entrainment. Erosion converts hs into suspended solid volume. The sediment follows water fluxes, then deposits back into hs where capacity falls or water dries up. This really changes geometry and subsequent flow, not just albedo. Sediment leaving an open boundary is counted separately.

### Stability and performance

The outer step is bounded by 1/45 s, a wave/velocity CFL estimate using `sqrt(g hw)` and measured component speeds, and a softened-elastic wave bound. Sand uses dt/3. Additional safety: water face transport is capped at 4 m/s per outgoing face, reconstructed water velocity at ±4 m/s per component, sand at ±5 m/s, deformation eigenvalues are limited, water painting is limited to 8 m local depth, and sculpted surface height to 16 m. These are real limitations, not claims of an unconditionally accurate solver. New pours update the CFL depth bound immediately.

The solver uses preallocated `Float32Array`s on the **CPU in a dedicated Web Worker**, not a GPU ping-pong solver. The worker sends planar packed snapshots at up to 30 Hz through a single, backpressured, transferable buffer (transferred in **both** directions, not structured-cloned on return); the main thread only uploads fields and handles interaction. It limits catch-up work rather than taking unsafe giant steps after a stall. The HUD displays achieved simulation-time/wall-time ratio: **slow machines may advance below 1×**, while the camera remains separate from physics. GPU rendering uses float height textures and vertex displacement, with finite-difference field normals; physics stays 192², and canvas pixel ratio stays `min(devicePixelRatio, 2)` regardless of frame rate. Exact-zero water cells skip outgoing transport; dry below-yield sand columns use the exact stationary Coulomb solution. Sand transport and plasticity use moving columns plus a neighbour halo, while the force/yield test still covers **every** column on **all three** substeps. New brush-made slope failures are never frozen out. No mass threshold discards thin films or pore water.

## What is actually shaded

- Poly Haven **Sand 01** CC0 photographic diffuse and OpenGL normal maps, at their measured **1.5 m** tile width, with mipmaps and anisotropic filtering. Additional original millimetre-scale grain normals and sparse grazing glints; low-amplitude, physically sampled initial quarry relief.
- Sand darkens to roughly 27–32% of its dry linear albedo when wet; roughness changes from 0.86 dry to 0.20 wet. Moisture history decays slowly after drainage.
- A lower directional sun and cool sky fill. Field normals and 12-tap terrain self-shadows are cached in a 192² GPU texture on snapshots, not recomputed in every terrain vertex on every display frame. Normals are interpolated per pixel.
- The water mesh follows the **simulated** surface. Screen-space refraction uses view-space normals; optical path length controls absorption, and suspended sediment increases turbidity. A local **CC0 HDR daylight environment** provides real cloud reflections. Its photographed sun is aligned with the direct light. An eight-step height-field ray query reflects nearby evolving banks, with sky on misses. This is approximate, not full ray tracing.
- Small, irregular-direction capillary/wind **normal detail only**, replacing the old coarse checkerboard ripples. Millimetre-depth shoreline fade, a dark meniscus and a little velocity-dependent contact foam, without splashes or invented breaking waves.
- Terrain color/depth render once into an offscreen target and are copied before water; no terrain rerender for refraction. ACES exposure 0.90; no bloom, video or web fonts. A closer, steeper default camera puts the quarry in the foreground.
- Canvas stays at native device pixel ratio, capped at **2**, with **no adaptive downscaling**. HUD names software WebGL when detected. Diagnostics distinguish CPU draw submission from asynchronous GPU timer results (`renderGpuMs`, where supported).

Assets, source URLs and CC0 terms: [`public/textures/LICENSE.txt`](public/textures/LICENSE.txt).

## Verification from this build

- `npm test`: **13/13 passing**. The original ten tests remain; new tests cover planar snapshot equivalence, sparse transport discovering a newly sculpted failure while conserving sand/pore water, and exact stationary deformation.
- `npm run build`: successful; Pages uses `BASE=/sand-water-sandbox/ npm run build`.
- `npm run test:browser`: dev and Pages-prefixed production preview both passed with zero JavaScript/shader errors. The isolated headless browser covers pause, painting, large pour, modes, orbit and zoom; no signed-in sessions are attached to. For Pages preview, run `BASE=/sand-water-sandbox/ npm run preview -- --port 5175`, then `BASE_URL=http://127.0.0.1:5175/sand-water-sandbox/ npm run test:browser`.
- Same-box 192² Node benchmark, 500 water steps / 1,500 sand substeps: original **20.46 ms/step**, optimized **5.76 ms/step** (about **3.6× faster**). Final run advanced **10.167 simulated seconds in 2.878 wall seconds**. Water accounting error **+0.00000244 m³**, solid error **+0.000000121 m³**. These validate this scenario's stability/accounting, not calibrated soil accuracy.
- `npm run test:performance`: a separate sustained browser measurement at **1440 × 900, DPR 1**, including a large pour, measured **1.008× simulated/wall time** over **12.276 s**. Canvas remained **1440 × 900**. Rendering was only **3.23 fps** with **600 ms p95 frame time** on **SwiftShader software WebGL**; a sampled GPU timer reported **296.9 ms**. This box has **no hardware GPU device**, so these are **not** native-GPU results. A 30–60 fps hardware target remains **unverified**, not certified or claimed achieved.
- Reproduce using `SOFTWARE=0 DPR=2 npm run test:performance` on a hardware-accelerated test computer. Set `BASE_URL` for a production preview or hosted build; `REPORT=path.json` saves raw diagnostics. `renderSubmitMs` is not GPU execution time.

## Known limits / next improvements

This is an original **interactive research-inspired approximation**, not a validated engineering tool, and not a claim of absolute physical or photographic realism.

- Height fields cannot represent breaking waves, waterfalls, splashes, true overhangs, undercut cavities, vertical grain separation, or spatially resolved layering inside a column. None are faked as 3D particles. Steep sculpting can violate the shallow assumption.
- Free and pore water have separate velocities and transport regimes, but this is **not Su et al.'s exact two-layer inertial SWE discretization**. The surface solver is a bounded, inertial virtual-pipe approximation, not a shock-resolving Riemann solver. Expect dissipation and grid bias in fast thin flow.
- Internal sand elasticity/plasticity is softened and simplified; cohesion is visually tuned, and includes an additional finite-depth yield term. There is no full MPM, calibrated grain-size rheology, dilatancy or exact stress/energy conservation.
- The pore layer is a vertically averaged reservoir with Darcy/capillary flow, not a full Richards-equation unsaturated soil model. Underdrain is a sink into a conceptual deep aquifer, not a simulated underground volume. No evaporation water loss; visual surface moisture alone dries slowly.
- Suspended sediment is a capacity-based scalar. It has no independently resolved settling velocity, grain-size distribution or three-dimensional particle-laden flow.
- Refraction is screen-space; HDR sky and coarse height-field bank reflections are approximations, not ray-traced caustics or exact terrain reflection. Small tributaries and very thin films are limited by the grid. Grain ripples are not transported bedforms.
- Software WebGL is visibly slower than hardware acceleration. CPU simulation can fall behind real time under heavy editing. The time ratio is visible rather than silently pretending to run in real time.
- Priorities next: GPU solver with well-balanced finite-volume SWE, better wet/dry fronts and momentum transport; exact paper return mapping and stress calibration; vertical pore profiles and seepage erosion; higher-resolution adaptive channels; measured-soil validation; terrain-aware refractive ray marching and temporal antialiasing.

## Layout

```text
index.html                 accessible minimal tools / status / control legend
src/main.js                input, HUD, worker connection, full-resolution diagnostics
src/simulation.js          four fields, flow, seepage, sand stress, drag, erosion
src/worker.js              split integration scheduling and transferable snapshots
src/rendering.js           Three.js scene, field shaders, refraction, picking
src/style.css              responsive minimal HUD (system-font fallbacks)
tests/simulation.test.js    mass, seepage, cohesion, drag, rotation, erosion tests
tests/benchmark.js          CPU timing and mass balance
tests/browser-smoke.js      browser integration / shader test
tests/browser-performance.js sustained fps, sim/wall ratio and native-DPR check
public/textures/           CC0 sand and daylight environment assets
package.json               dev / build / preview / test scripts
vite.config.js             separate cached Three.js / navigation chunks
```

## Sources (read / consulted, ideas reimplemented — no author code copied)

1. **Su, Zhang, Pan, Aanjaneya, Gao and Wu (2023), _Real-time Height-field Simulation of Sand and Water Mixtures_.** [DOI 10.1145/3610548.3618159](https://doi.org/10.1145/3610548.3618159), [author PDF](https://kuiwuchn.github.io/RTWaterAndSand.pdf), [project page](https://kuiwuchn.github.io/rtsw.html). Primary source: the paper, supplemental material bundled in the PDF and project page were read. Four-phase height representation, free/mixed separation, operator splitting, conservative mass transport, polar deformation attributes, saturation curve and reciprocal phase drag informed this implementation. Differences are explicit above. The downloaded research PDF/text are not shipped.
2. **Clawpack Riemann Book, _The shallow water equations_.** [Chapter](https://www.clawpack.org/riemann_book/html/Shallow_water.html). Depth averaging, hydrostatic head, mass/momentum distinction and gravity-wave speed for time-step reasoning. No Riemann solver code taken.
3. **Hassine (2013), _A review of depth-averaged models for dry granular flows: Savage–Hutter and mu(I)-rheology_.** [Review](https://ar5iv.labs.arxiv.org/html/1303.2838), discussing **Savage & Hutter (1989)** [DOI](https://doi.org/10.1017/S0022112089000340). Used to distinguish shallow granular pressure, Coulomb basal friction, static yield and the limits of a depth-averaged continuum. This demo does not implement full mu(I) rheology or variable earth-pressure coefficients.
4. **Tampubolon et al. (2017), _Multi-species simulation of porous sand and water mixtures_.** [DOI 10.1145/3072959.3073651](https://doi.org/10.1145/3072959.3073651), [author PDF](https://ken.museth.org/Publications_files/Pradhana-etal_SIG17.pdf). Conceptual mixture-theory reference: saturation-dependent cohesion and stiff reciprocal drag. The publication abstract and its discussion in Su et al. were used; no two-grid MPM implementation is claimed.
5. **Mei, Decaudin & Hu (2007), _Fast Hydraulic Erosion Simulation and Visualization on GPU_.** [Paper](http://www-evasion.imag.fr/Publications/2007/MDH07/FastErosion_PG07.pdf). The indexed paper's virtual-pipe outflow limiting and speed/slope capacity formulation informed the original water and erosion discretization. Here sediment is conservatively advected, rather than copied from the paper's semi-Lagrangian transport implementation.
6. **Zhu & Yang (2010), _Animating Sand as a Surface Flow_.** [Publication / abstract](https://diglib.eg.org/items/d58b304e-6042-4fc9-ab80-421a219f32df), [PDF](https://www.cs.dartmouth.edu/~bozhu/papers/sand_surface_flow.pdf). Conceptual motivation for a cheap height-field bulk. Its DEM surface layer / BCRE interface is **not** implemented.
7. **Zhu et al. (2021), _Shallow Sand Equations: Real-Time Height Field Simulation of Dry Granular Flows_.** [DOI 10.1109/TVCG.2019.2944172](https://doi.org/10.1109/TVCG.2019.2944172), [publication summary](https://www.physicsbasedanimation.com/2021/01/29/shallow-sand-equations-real-time-height-field-simulation-of-dry-granular-flows/). Its publication summary and the derivation discussed by Su et al. informed shallow pressure plus friction. No dense/dilute particle-tracking implementation is claimed.
8. **Chentanez & Müller (2010), _Real-time Simulation of Large Bodies of Water with Small Scale Details_.** [Publication](https://diglib.eg.org/items/d0320015-4b07-416b-8f41-047485c9f7f3). Wet/dry handling and separation of flow-scale transport from advected normal detail; its abstract / indexed paper sections and discussion in Su et al. were consulted. Its particle waterfall / breaking-wave extension is intentionally omitted.
9. **Št'ava, Beneš, Brisbin & Křivánek (2008), _Interactive Terrain Modeling Using Hydraulic Erosion_.** [Publication / abstract](https://diglib.eg.org/items/60afda0c-a666-4df8-90dd-9b80afc554c2). Layered erodible terrain, erosion/deposition feedback and collapsing banks, not an implementation of their tiled GPU or multi-material solver.
10. **Gao et al. (2018), _Animating Fluid Sediment Mixture in Particle-Laden Flows_.** [DOI 10.1145/3197517.3201309](https://doi.org/10.1145/3197517.3201309), [author PDF](https://mingg13.github.io/papers/2018_Fluid_Sediment.pdf). Publication abstract / indexed paper sections were consulted as context for reciprocal fluid–sediment coupling and the limitations of scalar suspended sediment. No MPM, locally averaged Navier–Stokes or multigrid solver is claimed.
11. **Edwards (2013), _Sand Rendering in Journey_, GDC.** [Talk listing](https://gdcvault.com/play/1017742/Sand-Rendering-in), supplemented by **Alan Zucconi (2019), _Journey Sand Shader: Glitter Reflection_**, [article](https://www.alanzucconi.com/2019/10/08/journey-sand-shader-5/). Procedural grain variation, broad specular and sparse view-dependent glints. New GLSL; no article shader copied.
12. **Three.js documentation**: [ShaderMaterial](https://threejs.org/docs/#api/en/materials/ShaderMaterial), [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls). Rendering API / navigation reference. Three.js and Vite are normal npm dependencies under their respective licenses.
