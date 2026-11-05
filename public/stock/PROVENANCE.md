# Stock Gaussian splat viewer

The viewer is based on
[antimatter15/splat](https://github.com/antimatter15/splat/tree/ba182b51b7c2ad5738cdd6741cd63336d27470fb),
revision `ba182b51b7c2ad5738cdd6741cd63336d27470fb`. The upstream viewer is
copyright 2023 Kevin Kwok and distributed under the included MIT license.

Upstream file checksums:

| File         |  Bytes | SHA-256                                                            |
| ------------ | -----: | ------------------------------------------------------------------ |
| `index.html` |  5,723 | `42f8ee41d24ca4b1e8a5b0d78656127952b7909235195fa3c2bd4fb30228ff92` |
| `main.js`    | 51,459 | `b63e01a96e28d88039c2df5bc7ea33cacee13dea298cc2a357d284f4e7ca81a2` |
| `LICENSE`    |  1,067 | `7d62ca775042bb7182918e42e6bd7b8cac3462ceaf7717d7836ef0c0fce075ef` |

`index.html` and `LICENSE` are unchanged. The `main.js` loader reads the decoded
response into a Blob and allocates from `Blob.size`. Compressed HTTP responses
can have a smaller `Content-Length` than the decoded model. This change waits
for the complete download before rendering; shaders, sorting, compositing,
camera controls and the interface are unchanged.

The served `main.js` is 51,557 bytes, SHA-256
`bf5ac796bd1a1952900ae4c578d16910055438b607e6355390b2e2eb8687a4bf`.

These files are served from the site's `stock/` path without rewriting or
bundling them. Styles, shaders and
worker code are contained in the HTML and JavaScript; there are no other
runtime assets apart from the requested model. Author and repository links
remain in the original interface.

The viewer's `url` query parameter accepts an absolute model URL. Relative
values resolve against its upstream Hugging Face data directory, so links to
the site's models include the page's full origin and deployment base path.
With a same-origin model URL, loading uses a GET from this site and does not
upload the model elsewhere.
Omitting `url` loads upstream's default train model.

The model endpoint must return HTTP 200. Compressed responses and responses
without `Content-Length` are supported through the decoded response size.
The URL fragment accepts its native JSON view matrix and disables
the default camera animation. Camera transfer retains the stock viewer's own
projection and controls; it does not match another renderer's field of view.

Model licenses and attribution are separate from the viewer's license. See
[Urban drone survey](https://superspl.at/scene/e92a7e9b) and
[Knock Community Hall](https://superspl.at/scene/0ff2e6dc) for their authors and
CC BY 4.0 notices.
