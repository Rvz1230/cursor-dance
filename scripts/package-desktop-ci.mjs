import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.env.CURSORDANCE_PACKAGE_PLATFORM || process.platform;
const architecture = process.env.CURSORDANCE_PACKAGE_ARCH || process.arch;
const supportedTargets = new Map([
  ["darwin-arm64", ["--mac", "zip", "--arm64"]],
  ["win32-x64", ["--win", "nsis", "--x64"]],
]);
const targetKey = `${platform}-${architecture}`;
const builderTarget = supportedTargets.get(targetKey);

if (!builderTarget) {
  throw new Error(`Unsupported desktop CI package target: ${targetKey}`);
}
if (process.platform !== platform || process.arch !== architecture) {
  throw new Error(
    `Desktop package smoke requires a native runner; requested ${targetKey}, running ${process.platform}-${process.arch}`,
  );
}

const outputDirectory = join(projectRoot, "release", `ci-${targetKey}`);

function runNode(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${scriptPath} exited with ${result.status}`);
  }
}

await rm(outputDirectory, { recursive: true, force: true });
runNode(join(projectRoot, "scripts", "build-cursor-helper.mjs"), [`--arch=${architecture}`]);
runNode(join(projectRoot, "node_modules", "electron-vite", "bin", "electron-vite.js"), ["build"]);
const builderArguments = [
  ...builderTarget,
  "--publish",
  "never",
  `--config.directories.output=${outputDirectory}`,
];
if (platform === "darwin" && process.env.CURSORDANCE_MAC_IDENTITY) {
  builderArguments.push(`--config.mac.identity=${process.env.CURSORDANCE_MAC_IDENTITY}`);
}
if (platform === "darwin" && process.env.CURSORDANCE_REQUIRE_NOTARIZATION === "1") {
  if (!process.env.CURSORDANCE_MAC_IDENTITY) {
    throw new Error("CURSORDANCE_MAC_IDENTITY is required for notarized release builds");
  }
  builderArguments.push("--config.mac.notarize=true");
}
runNode(join(projectRoot, "node_modules", "electron-builder", "cli.js"), builderArguments);

console.info(`[desktop-package] built ${targetKey}: ${outputDirectory}`);
