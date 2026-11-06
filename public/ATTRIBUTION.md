# Model and software attribution

The Gaussian models have their own licenses, separate from this demo's MIT
software license. The credits below apply to the downloadable `.splat` files
and to their display in either viewer.

## Urban drone survey

[PIX4D Urban Drone Sample - Reconstructed with Seeget3D](https://superspl.at/scene/e92a7e9b),
by **Seeget3D**, is published under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
The creator describes reconstructing the scene from 100 vertically captured
images from the PIX4D drone sample dataset.

The demo combines all six LOD 0 chunks (`0_0` through `0_5`) from version 1
and retains all **2,651,420 Gaussians** in this level. Conversion reduces
the source's degree-3 spherical harmonics to DC colors. [Published LOD manifest](https://d28zzqy0iyovbz.cloudfront.net/e92a7e9b/v1/lod-meta.json).

The initial camera uses the creator's pose and measures its 75° view angle
along the longer viewport dimension. [Source viewer camera settings](https://superspl.at/s?id=e92a7e9b).

`urban.splat` is 84,845,440 bytes with SHA-256
`1add4a271bfefa369f3504cd51156acbb05447126266abd7e18014dbc4a92d11`.
[Download provenance and source hashes](https://paulhax.github.io/vtkjs-gaussian-splats/data/urban.json).

## Knock Community Hall

[Knock Community Hall](https://superspl.at/scene/0ff2e6dc), by **scbenoit**
([creator profile](https://superspl.at/user?id=scbenoit)), is published under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
The creator describes a Phantom 4 drone capture using 185 images, processed
with Metashape and Brush.

This demo uses the [PlayCanvas sample](https://github.com/playcanvas/engine/blob/572145ab6df05e108fb75233c303e72ca08ae195/examples/assets/splats/knock-community-hall.sog)
at revision `572145ab6df05e108fb75233c303e72ca08ae195`. Its
[asset-specific notice](https://github.com/playcanvas/engine/blob/572145ab6df05e108fb75233c303e72ca08ae195/examples/assets/splats/knock-community-hall.txt)
also identifies scbenoit and CC BY 4.0. All **1,935,100 Gaussians** in this
source are retained. Its degree-1 spherical harmonics have been reduced to DC
colors and converted to the `.splat` representation described below.

Source: 27,830,709 bytes, SHA-256
`2c9ef67e619878cdb85d8f972cc6b1b8a8c76cbd7b4ed1137ac97bbd78785202`.

`hall.splat`: 61,923,200 bytes, SHA-256
`3edd070eb7ca56351cbdfe498608b4adde3e8021561a8fa213632ef59661730f`.
[Download provenance and source hashes](https://paulhax.github.io/vtkjs-gaussian-splats/data/hall.json).

## Conversion and comparison

Both conversions use the MIT-licensed
[@playcanvas/splat-transform](https://github.com/playcanvas/splat-transform)
version **3.10.3**, with `--filter-harmonics 0` and its native `.splat` writer.
The preparation script checks the downloaded source files and converted output
against their expected byte counts and SHA-256 hashes.

Each 32-byte `.splat` record stores three Float32 positions, three Float32
linear scales, four RGBA bytes, and four byte-quantized WXYZ quaternion
components. Conversion rounds colors and opacity to eight bits and quantizes
orientations. The VTK loader normalizes the stored quaternions. Higher
spherical harmonics are omitted, so these previews do not retain
view-dependent color. Coordinates remain local to each reconstruction;
no georeferencing or reliable metric scale is asserted.

The comparison viewer loads the same prepared model bytes as the VTK viewer.
Its camera projection, filtering, sorting and compositing remain its own, so
rendered images can differ. Creator pages may display higher-detail or
differently colored versions.

## Software licenses

The demo's MIT license retains the copyright of the pointcloud-lod contributors
and Paul Elliott. The model licenses above do not change the software license.

The stock comparison viewer is based on
[antimatter15/splat](https://github.com/antimatter15/splat/tree/ba182b51b7c2ad5738cdd6741cd63336d27470fb),
revision `ba182b51b7c2ad5738cdd6741cd63336d27470fb`, copyright 2023 Kevin Kwok.
Its loader uses the decoded response size to support compressed model downloads.
Its renderer and controls are unchanged. It is distributed under its included
[MIT license](https://github.com/antimatter15/splat/blob/ba182b51b7c2ad5738cdd6741cd63336d27470fb/LICENSE).

VTK.js is copyright Kitware Inc. and distributed under the
[BSD 3-Clause license](https://paulhax.github.io/vtkjs-gaussian-splats/licenses/vtk-BSD.txt), with its
[copyright notice](https://paulhax.github.io/vtkjs-gaussian-splats/licenses/vtk-copyright.txt). The demo's
[MIT license](https://paulhax.github.io/vtkjs-gaussian-splats/licenses/demo-MIT.txt) also accompanies this distribution.
