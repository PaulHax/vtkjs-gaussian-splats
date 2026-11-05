import { createReadStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

export const BASE_PATH = "/vtkjs-gaussian-splats/";

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json"],
  [".wasm", "application/wasm"],
]);

export type StaticServer = {
  readonly origin: string;
  close(): Promise<void>;
};

/** Serve the production artifact only beneath its deployment base path. */
export const startStaticServer = async (directory: string): Promise<StaticServer> => {
  const root = resolve(directory);
  const server = createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? "/", "http://localhost");
        const pathname = decodeURIComponent(url.pathname);
        if (!pathname.startsWith(BASE_PATH)) {
          response.writeHead(404).end();
          return;
        }
        let file = resolve(root, pathname.slice(BASE_PATH.length));
        if (file !== root && !file.startsWith(root + sep)) {
          response.writeHead(404).end();
          return;
        }
        let stat = await fs.stat(file);
        if (stat.isDirectory()) {
          file = join(file, "index.html");
          stat = await fs.stat(file);
        }
        if (!stat.isFile()) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          "content-type": contentTypes.get(extname(file)) ?? "application/octet-stream",
          "content-length": String(stat.size),
          "cache-control": "no-store",
        });
        if (request.method === "HEAD") response.end();
        else
          createReadStream(file)
            .on("error", () => response.destroy())
            .pipe(response);
      } catch {
        response.writeHead(404).end();
      }
    })();
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise<void>((done) => server.close(() => done()));
    throw new Error("The browser test server did not bind a port.");
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((done, fail) => server.close((error) => (error ? fail(error) : done()))),
  };
};
