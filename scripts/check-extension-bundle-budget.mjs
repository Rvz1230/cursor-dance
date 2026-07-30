import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = resolve(projectRoot, "dist");
const budgets = {
  popupInitialRawBytes: 370_000,
  popupInitialGzipBytes: 112_000,
  optionsInitialRawBytes: 650_000,
  optionsInitialGzipBytes: 200_000,
  largestJavaScriptChunkBytes: 350_000,
  contentRuntimeBytes: 100_000,
};

async function measureInitialAssets(entryName) {
  const htmlPath = resolve(distRoot, `${entryName}.html`);
  const html = await readFile(htmlPath, "utf8");
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.includes("assets/"))
    .map((path) => resolve(dirname(htmlPath), path));
  const contents = await Promise.all([...new Set(assetPaths)].map((path) => readFile(path)));
  return {
    rawBytes: contents.reduce((sum, content) => sum + content.byteLength, 0),
    gzipBytes: contents.reduce((sum, content) => sum + gzipSync(content).byteLength, 0),
  };
}

const [popup, options, assetNames, contentRuntime] = await Promise.all([
  measureInitialAssets("popup"),
  measureInitialAssets("index"),
  readdir(resolve(distRoot, "assets")),
  stat(resolve(distRoot, "content-runtime/content.js")),
]);
const javascriptSizes = await Promise.all(assetNames
  .filter((name) => extname(name) === ".js")
  .map(async (name) => (await stat(resolve(distRoot, "assets", name))).size));
const measurements = {
  popupInitialRawBytes: popup.rawBytes,
  popupInitialGzipBytes: popup.gzipBytes,
  optionsInitialRawBytes: options.rawBytes,
  optionsInitialGzipBytes: options.gzipBytes,
  largestJavaScriptChunkBytes: Math.max(0, ...javascriptSizes),
  contentRuntimeBytes: contentRuntime.size,
};

for (const [name, bytes] of Object.entries(measurements)) {
  const budget = budgets[name];
  console.log(`${bytes <= budget ? "PASS" : "FAIL"} ${name}: ${bytes} / ${budget} bytes`);
}

if (Object.entries(measurements).some(([name, bytes]) => bytes > budgets[name])) {
  process.exitCode = 1;
}
