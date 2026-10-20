import * as esbuild from "esbuild";
import { rm } from "node:fs/promises";

const isWatch = process.argv.includes("--watch");
const isProduction = process.argv.includes("--production");

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  platform: "node",
  format: "cjs",
  external: ["vscode"],
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
  entryPoints: { webview: "webview/main.ts" },
  outdir: "dist",
  platform: "browser",
  format: "esm",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  assetNames: "assets/[name]-[hash]",
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  loader: {
    ".css": "css",
    ".woff2": "file",
    ".woff": "file",
    ".ttf": "file",
  },
  define: {
    "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
  },
};

async function build() {
  if (isWatch) {
    const [extCtx, webviewCtx] = await Promise.all([
      esbuild.context(extensionConfig),
      esbuild.context(webviewConfig),
    ]);
    await Promise.all([extCtx.watch(), webviewCtx.watch()]);
    console.log("[watch] Build started — watching for changes...");
  } else {
    // Hashed chunks/assets from earlier builds must not accumulate in a VSIX.
    await Promise.all([
      rm("dist/chunks", { recursive: true, force: true }),
      rm("dist/assets", { recursive: true, force: true }),
    ]);
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);
    console.log("[build] Build complete.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
