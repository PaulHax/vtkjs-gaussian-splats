import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const vtkDirectory = dirname(require.resolve("@kitware/vtk.js/package.json"));
const glMatrixDirectory = dirname(
  require.resolve("gl-matrix/package.json", { paths: [vtkDirectory] }),
);

export default defineConfig({
  base: "/vtkjs-gaussian-splats/",
  plugins: [{
    name: "license-notices",
    generateBundle() {
      for (const [fileName, file] of [
        ["licenses/demo-MIT.txt", "LICENSE"],
        ["licenses/vtk-BSD.txt", "vendor/vtk/LICENSE"],
        ["licenses/vtk-copyright.txt", "vendor/vtk/Copyright.txt"],
      ]) {
        this.emitFile({ type: "asset", fileName, source: readFileSync(file!, "utf8") });
      }
    },
  }],
  resolve: {
    alias: [
      { find: /^@kitware\/vtk\.js\/(.+)$/, replacement: `${vtkDirectory}/$1.js` },
      { find: "@kitware/vtk.js", replacement: `${vtkDirectory}/index.js` },
      { find: "gl-matrix", replacement: glMatrixDirectory },
    ],
    dedupe: ["@kitware/vtk.js"],
  },
  build: { target: "esnext", sourcemap: true },
});
