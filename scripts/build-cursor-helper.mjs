import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requestedArchitectures = process.argv
  .filter((argument) => argument.startsWith("--arch="))
  .map((argument) => argument.slice("--arch=".length));
const architectures = requestedArchitectures.length > 0 ? requestedArchitectures : [process.arch];
const clangArchitectures = { arm64: "arm64", x64: "x86_64" };

function runCompiler(command, args, architecture) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Failed to build cursor helper for ${process.platform}/${architecture}`);
  }
}

async function buildMacHelper(architecture) {
  if (!(architecture in clangArchitectures)) {
    throw new Error(`Unsupported macOS cursor helper architecture: ${architecture}`);
  }
  const output = join(projectRoot, "build", "native", architecture, "cursordance-cursor-helper");
  await mkdir(dirname(output), { recursive: true });
  runCompiler("xcrun", [
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
  ], architecture);
  console.info(`[cursor-helper] built darwin/${architecture}: ${output}`);
}

async function buildWindowsHelper(architecture) {
  if (architecture !== "x64") {
    throw new Error(`Unsupported Windows cursor helper architecture: ${architecture}`);
  }
  const output = join(projectRoot, "build", "native", architecture, "cursordance-cursor-helper.exe");
  const objectOutput = join(projectRoot, "build", "native", architecture, "cursor-visibility-helper.obj");
  await mkdir(dirname(output), { recursive: true });
  const compiler = process.env.CURSORDANCE_WINDOWS_CC || "cl.exe";
  runCompiler(compiler, [
    "/nologo",
    "/O2",
    "/W4",
    "/DUNICODE",
    "/D_UNICODE",
    join(projectRoot, "native", "windows", "cursor-visibility-helper.c"),
    `/Fe:${output}`,
    `/Fo:${objectOutput}`,
    "user32.lib",
  ], architecture);
  console.info(`[cursor-helper] built win32/${architecture}: ${output}`);
}

if (process.platform === "darwin") {
  for (const architecture of architectures) await buildMacHelper(architecture);
} else if (process.platform === "win32") {
  for (const architecture of architectures) await buildWindowsHelper(architecture);
} else {
  console.info(`[cursor-helper] skipped: no native helper for ${process.platform}`);
}
