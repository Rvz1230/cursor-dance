import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKSUM_FILE = "SHA256SUMS.txt";

export function assertReleaseTag(tag, version) {
  const expected = `v${version}`;
  if (tag !== expected) {
    throw new Error(`Release tag ${JSON.stringify(tag)} does not match package version ${JSON.stringify(expected)}`);
  }
}

export function requiredSigningVariables(platform) {
  if (platform !== "darwin") throw new Error(`Unsupported release signing platform: ${platform}`);
  return [
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "CURSORDANCE_MAC_IDENTITY",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
  ];
}

export function assertSigningEnvironment(platform, environment = process.env) {
  const missing = requiredSigningVariables(platform).filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing ${platform} release signing variables: ${missing.join(", ")}`);
  }
}

async function listFilesRecursively(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listFilesRecursively(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function isReleaseArtifact(name) {
  return /\.(?:dmg|zip|blockmap)$/i.test(name) || name === "latest-mac.yml";
}

function assertArtifactSet(names) {
  const requireOne = (description, predicate) => {
    const matches = names.filter(predicate);
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one ${description}; found ${matches.length}: ${matches.join(", ") || "none"}`);
    }
  };

  requireOne("macOS DMG", (name) => name.toLowerCase().endsWith(".dmg"));
  requireOne("macOS ZIP", (name) => name.toLowerCase().endsWith(".zip"));
  requireOne("macOS update metadata", (name) => name === "latest-mac.yml");
  requireOne("macOS ZIP blockmap", (name) => name.endsWith(".zip.blockmap"));
}

export async function createReleaseChecksums(rootDirectory) {
  const root = resolve(rootDirectory);
  const paths = (await listFilesRecursively(root))
    .filter((path) => basename(path) !== CHECKSUM_FILE && isReleaseArtifact(basename(path)));
  const names = paths.map((path) => basename(path));
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    throw new Error(`Release artifacts must have unique filenames: ${[...new Set(duplicateNames)].join(", ")}`);
  }

  assertArtifactSet(names);
  const entries = await Promise.all(paths.map(async (path) => ({
    name: basename(path),
    digest: createHash("sha256").update(await readFile(path)).digest("hex"),
  })));
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const outputPath = join(root, CHECKSUM_FILE);
  await writeFile(outputPath, `${entries.map(({ digest, name }) => `${digest}  ${name}`).join("\n")}\n`, "utf8");
  return { outputPath, entries };
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (command === "verify-tag") {
    const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
    assertReleaseTag(argument || process.env.GITHUB_REF_NAME || "", packageJson.version);
    console.info(`[release] verified tag v${packageJson.version}`);
    return;
  }
  if (command === "verify-signing") {
    assertSigningEnvironment(argument || process.env.CURSORDANCE_PACKAGE_PLATFORM || process.platform);
    console.info("[release] required signing environment is present");
    return;
  }
  if (command === "checksums") {
    const result = await createReleaseChecksums(argument || join(projectRoot, "release-artifacts"));
    console.info(`[release] wrote ${result.entries.length} checksums to ${result.outputPath}`);
    return;
  }
  throw new Error("Usage: release-artifacts.mjs <verify-tag|verify-signing|checksums> [value]");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
