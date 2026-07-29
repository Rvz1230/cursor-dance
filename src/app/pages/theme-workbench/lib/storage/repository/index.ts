import { getDefaultConfig, normalizeStoredConfig } from "../../runtimeConfig";
import { getChromeApi, getElectronStorageBridge } from "../chrome-api";
import { createChromeWorkbenchRepository } from "./chrome";
import { createDesktopWorkbenchRepository } from "./desktop";
import { createLocalWorkbenchRepository } from "./local";
import type { WorkbenchRepository, WorkbenchRepositoryCodec } from "./types";

const codec: WorkbenchRepositoryCodec = {
  getDefaultConfig,
  normalizeConfig: normalizeStoredConfig,
};

let cachedSource: object | null = null;
let cachedRepository: WorkbenchRepository | null = null;
const localSource = {};

export function getWorkbenchRepository(): WorkbenchRepository {
  const bridge = getElectronStorageBridge();
  const chromeApi = getChromeApi();
  const source = bridge ?? (chromeApi?.storage?.local ? chromeApi : localSource);
  if (cachedRepository && cachedSource === source) return cachedRepository;
  cachedSource = source;
  cachedRepository = bridge
    ? createDesktopWorkbenchRepository(bridge, codec)
    : chromeApi?.storage?.local
      ? createChromeWorkbenchRepository(chromeApi, codec)
      : createLocalWorkbenchRepository(codec);
  return cachedRepository;
}

export type { WorkbenchRepository } from "./types";

export const __testing__ = {
  reset(): void {
    cachedSource = null;
    cachedRepository = null;
  },
};
