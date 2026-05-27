import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex < 0) return null;
  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (!key) return null;
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

export function loadLocalEnv({ cwd = process.cwd(), files = [".env.local", ".env"] } = {}) {
  for (const fileName of files) {
    const filePath = resolve(cwd, fileName);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const entry = parseEnvLine(line);
      if (!entry) continue;
      const [key, value] = entry;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
