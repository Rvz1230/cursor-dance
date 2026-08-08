import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function run(command, args, description) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${description} exited with ${result.status}`);
}

export async function updateDmgMetadata(dmgPath, metadataPath) {
  const dmgName = basename(dmgPath);
  const [binary, stats, metadata] = await Promise.all([
    readFile(dmgPath),
    stat(dmgPath),
    readFile(metadataPath, "utf8"),
  ]);
  const sha512 = createHash("sha512").update(binary).digest("base64");
  const lines = metadata.split("\n");
  const artifactLine = lines.findIndex((line) => line.trim() === `- url: ${dmgName}`);
  if (artifactLine < 0) throw new Error(`${basename(metadataPath)} does not reference ${dmgName}`);

  let shaLine = -1;
  let sizeLine = -1;
  const artifactIndentation = lines[artifactLine].length - lines[artifactLine].trimStart().length;
  for (let index = artifactLine + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trimStart();
    const currentIndentation = lines[index].length - trimmed.length;
    if (trimmed && currentIndentation <= artifactIndentation) break;
    if (trimmed.startsWith("sha512:")) shaLine = index;
    if (trimmed.startsWith("size:")) sizeLine = index;
  }
  if (shaLine < 0 || sizeLine < 0) throw new Error(`${basename(metadataPath)} has an incomplete entry for ${dmgName}`);

  const indentation = (line) => line.slice(0, line.length - line.trimStart().length);
  lines[shaLine] = `${indentation(lines[shaLine])}sha512: ${sha512}`;
  lines[sizeLine] = `${indentation(lines[sizeLine])}size: ${stats.size}`;
  await writeFile(metadataPath, lines.join("\n"), "utf8");
  // electron-builder 在 stapling 前生成的 DMG blockmap 已失效；macOS updater 使用 ZIP，
  // Release 也只上传 ZIP blockmap，因此明确删除，避免留下看似可用的错误产物。
  await rm(`${dmgPath}.blockmap`, { force: true });
  return { sha512, size: stats.size };
}

async function notarizeDmg(outputDirectory) {
  const names = await readdir(outputDirectory);
  const dmgNames = names.filter((name) => name.toLowerCase().endsWith(".dmg"));
  if (dmgNames.length !== 1) throw new Error(`Expected exactly one DMG to notarize; found ${dmgNames.length}`);
  const dmgPath = join(outputDirectory, dmgNames[0]);
  const required = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing DMG notarization variables: ${missing.join(", ")}`);

  run("xcrun", [
    "notarytool",
    "submit",
    dmgPath,
    "--apple-id",
    process.env.APPLE_ID,
    "--password",
    process.env.APPLE_APP_SPECIFIC_PASSWORD,
    "--team-id",
    process.env.APPLE_TEAM_ID,
    "--wait",
  ], "DMG notarization");
  run("xcrun", ["stapler", "staple", dmgPath], "DMG ticket stapling");
  await updateDmgMetadata(dmgPath, join(outputDirectory, "latest-mac.yml"));
  console.info(`[desktop-package] notarized and stapled ${dmgNames[0]}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputDirectory = resolve(process.argv[2] || "");
  await notarizeDmg(outputDirectory);
}
