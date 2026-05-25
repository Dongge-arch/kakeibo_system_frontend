/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Home Kakeibo System Contributors
 */

import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(rootDir, "dist");
const assetsDir = resolve(distDir, "assets");
const publicDir = resolve(rootDir, "public");
const entryPoint = resolve(rootDir, "src", "main.tsx");

await rm(distDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true, force: true }).catch(error => {
  if (error?.code !== "ENOENT") throw error;
});

const result = await build({
  absWorkingDir: rootDir,
  entryPoints: [entryPoint],
  bundle: true,
  splitting: true,
  format: "esm",
  target: ["es2020"],
  platform: "browser",
  outdir: assetsDir,
  entryNames: "[name]-[hash]",
  chunkNames: "chunks/[name]-[hash]",
  assetNames: "media/[name]-[hash]",
  minify: true,
  sourcemap: false,
  metafile: true,
  logLevel: "info",
  define: {
    "import.meta.env": JSON.stringify({
      BASE_URL: "/",
      DEV: false,
      MODE: "production",
      PROD: true,
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || "",
      VITE_API_KEY: process.env.VITE_API_KEY || ""
    }),
    "process.env.NODE_ENV": "\"production\""
  },
  loader: {
    ".avif": "file",
    ".bmp": "file",
    ".gif": "file",
    ".ico": "file",
    ".jpeg": "file",
    ".jpg": "file",
    ".png": "file",
    ".svg": "file",
    ".tif": "file",
    ".tiff": "file",
    ".webp": "file"
  }
});

const outputs = Object.keys(result.metafile.outputs);
const entryOutput = outputs.find(path => result.metafile.outputs[path].entryPoint);
if (!entryOutput) {
  throw new Error("React entry bundle was not generated.");
}

const cssOutput = outputs.find(path => path.endsWith(".css"));
const scriptPath = toPublicPath(entryOutput);
const cssPath = cssOutput ? toPublicPath(cssOutput) : "";
const template = await readFile(resolve(rootDir, "index.html"), "utf8");
const headInjection = cssPath ? `    <link rel="stylesheet" href="${cssPath}" />\n` : "";
const html = template
  .replace(/    <script type="module" src="\/src\/main\.tsx"><\/script>\n?/, "")
  .replace(
    "  </head>",
    `${headInjection}  </head>`
  )
  .replace(
    "  </body>",
    `    <script type="module" crossorigin src="${scriptPath}"></script>\n  </body>`
  );

await writeFile(resolve(distDir, "index.html"), html, "utf8");
console.log(`[React] static assets written to ${relative(rootDir, distDir)}`);

function toPublicPath(path) {
  const normalized = path.split("\\").join("/");
  const assetsIndex = normalized.lastIndexOf("/assets/");
  if (assetsIndex >= 0) {
    return normalized.slice(assetsIndex);
  }
  return `/${relative(distDir, path).split("\\").join("/")}`;
}
