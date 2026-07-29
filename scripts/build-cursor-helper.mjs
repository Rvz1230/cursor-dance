import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requestedArchitectures = process.argv
  .filter((argument) => argument.startsWith("--arch="))
  .map((argument) => argument.slice("--arch=".length));
const architectures = requestedArchitectures.length > 0 ? requestedArchitectures : [process.arch];
const supportedArchitectures = new Set(["arm64", "x64"]);
const clangArchitectures = { arm64: "arm64", x64: "x86_64" };

if (process.platform !== "darwin") {
  console.info("[cursor-helper] skipped: macOS helper is built only on Darwin");
  process.exit(0);
}

for (const architecture of architectures) {
  if (!supportedArchitectures.has(architecture)) {
    throw new Error(`Unsupported macOS cursor helper architecture: ${architecture}`);
  }

  const output = join(projectRoot, "build", "native", architecture, "cursordance-cursor-helper");
  await mkdir(dirname(output), { recursive: true });
  const result = spawnSync("xcrun", [
    "clang",
    "-arch",
    clangArchitectures[architecture],
    "-mmacosx-version-min=11.0",
    "-O2",
    "-Wall",
    "-Wextra",
    "-framework",
    "ApplicationServices",
    join(projectRoot, "native", "macos", "cursor-visibility-helper.c"),
    "-o",
    output,
  ], { stdio: "inherit" });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Failed to build macOS cursor helper for ${architecture}`);
  }
  console.info(`[cursor-helper] built ${architecture}: ${output}`);
}
