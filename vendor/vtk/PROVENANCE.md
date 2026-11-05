# vtk.js Gaussian mapper

The renderer is built from [Kitware vtk.js v38.0.5](https://github.com/Kitware/vtk-js/releases/tag/v38.0.5),
at commit [5d46987847429e1556b3c182d21bcb92f226d9e2](https://github.com/Kitware/vtk-js/tree/5d46987847429e1556b3c182d21bcb92f226d9e2),
with the [source patch in this repository](./point-gaussian.patch).
[vtk-source.json](../../vtk-source.json) pins the source revision and patch hash.

The patch adds the Gaussian and point sprite mappers, their OpenGL backend,
shader and profile registration, and the type declaration for a custom
translucent render pass. Gaussian rendering supports anisotropic scales and
rotations. An optional point order array updates draw order while keeping
per-point attributes in GPU textures. Sorting and alpha composition are supplied
by the demo. Other vtk.js source files and its dependency lockfile are unchanged.

Run `node scripts/prepareVtk.mjs` after installing the demo dependencies. It
fetches the pinned public source, applies the patch, runs `npm ci` and
`npm run build:esm`, and links `node_modules/@kitware/vtk.js` to the resulting
`.cache/vtk.js/dist/esm` package. The cache is generated build output. Its source
and artifact fingerprints are verified before reuse; changing the pinned source,
patch or preparation script rebuilds it.

vtk.js is distributed under the BSD 3-Clause license. Its [LICENSE](./LICENSE)
and [copyright notice](./Copyright.txt) are retained here and in the generated
ESM package. Model licenses are separate from the renderer's license.
