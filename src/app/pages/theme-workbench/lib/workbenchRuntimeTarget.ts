export type WorkbenchRuntimeTarget = "desktop" | "extension" | "local";

export interface WorkbenchRuntimeCopy {
  readonly applyTheme: string;
  readonly applyGlobal: string;
  readonly applying: string;
  readonly pending: string;
  readonly appliedTheme: string;
  readonly restore: string;
  readonly restored: string;
  readonly success: string;
}

const RUNTIME_COPY: Record<WorkbenchRuntimeTarget, WorkbenchRuntimeCopy> = {
  desktop: {
    applyTheme: "应用到桌面",
    applyGlobal: "应用全局设置",
    applying: "应用中",
    pending: "未应用",
    appliedTheme: "已应用到桌面",
    restore: "恢复已应用版本",
    restored: "已恢复桌面正在使用的版本",
    success: "已应用到桌面",
  },
  extension: {
    applyTheme: "保存并应用",
    applyGlobal: "保存全局设置",
    applying: "保存中",
    pending: "未保存",
    appliedTheme: "已应用到网页",
    restore: "恢复已保存版本",
    restored: "已恢复网页正在使用的版本",
    success: "已保存并应用到网页",
  },
  local: {
    applyTheme: "保存到浏览器",
    applyGlobal: "保存全局设置",
    applying: "保存中",
    pending: "未保存",
    appliedTheme: "已保存到浏览器",
    restore: "恢复已保存版本",
    restored: "已恢复浏览器保存的版本",
    success: "已保存到浏览器",
  },
};

type RuntimeWindow = Pick<Window, "location"> & {
  cursorDanceApp?: unknown;
  cursorDanceStorage?: unknown;
  chrome?: { runtime?: { id?: string }; storage?: { local?: unknown } };
};

export function detectWorkbenchRuntimeTarget(
  platformWindow: RuntimeWindow | undefined = typeof window === "undefined" ? undefined : window,
): WorkbenchRuntimeTarget {
  if (platformWindow?.cursorDanceApp || platformWindow?.cursorDanceStorage) return "desktop";
  if (platformWindow?.chrome?.runtime?.id && platformWindow.chrome.storage?.local) return "extension";
  return "local";
}

export function getWorkbenchRuntimeCopy(target: WorkbenchRuntimeTarget): WorkbenchRuntimeCopy {
  return RUNTIME_COPY[target];
}

export function openLocalRuntimePreview(
  platformWindow: RuntimeWindow | undefined = typeof window === "undefined" ? undefined : window,
): boolean {
  if (!platformWindow) return false;
  const url = new URL("./runtime-preview.html", platformWindow.location.href).href;
  platformWindow.location.assign(url);
  return true;
}
