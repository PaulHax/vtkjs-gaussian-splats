# VTK.js Gaussian splat scenes

[Open the demo](https://paulhax.github.io/vtkjs-gaussian-splats/)

An experimental VTK.js Gaussian splat viewer with two drone reconstructions,
upright orbit and walking controls, and a point-cloud view. **View this model**
opens the same model in a separate
[antimatter15 viewer](public/stock/PROVENANCE.md). Its loader handles compressed
HTTP responses; its rendering and controls are unchanged. **Spark demos** opens the
[official Spark gallery](https://sparkjs.dev/examples/#hello-world).

The renderer uses anisotropic Gaussians, worker-based depth sorting, and
GPU-resident attributes with an index texture for draw order. Models load in
full; this demo does not stream tiles or provide georeferencing. The converted
models retain DC color and omit view-dependent spherical harmonics.

## Run

Use Node.js 22.12 or newer and Git:

```sh
npm ci
npm run prepare:vtk
npm run prepare:models
npm run dev
```

Open the `/vtkjs-gaussian-splats/` URL printed by Vite. The first preparation
builds the [pinned VTK.js source and Gaussian mapper patch](vendor/vtk/PROVENANCE.md)
and downloads and converts both models. Source and output hashes are checked.
Build products and model binaries are ignored by Git.

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm test
npm run preview
```

The build produces `dist/` with the repository path configured in
[vite.config.ts](vite.config.ts). GitHub Actions builds and checks the same
artifact, then deploys it to GitHub Pages on pushes to `main`.

## Models and licenses

- **Urban drone survey:** PIX4D sample reconstructed by Seeget3D, 662,479 Gaussians.
- **Knock Community Hall:** drone reconstruction by scbenoit, 1,935,100 Gaussians.

Both models are CC BY 4.0. [Attribution and conversion details](public/ATTRIBUTION.md)
include their sources and the changes made for this demo. Code is covered by
[MIT](LICENSE), with separate [VTK.js BSD terms](vendor/vtk/LICENSE) and the
[stock viewer MIT license](public/stock/LICENSE).
