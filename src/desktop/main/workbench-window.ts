// CursorDance 桌面 — workbench 窗口管理
//
// macOS：titleBarStyle: 'hiddenInset' —— 系统仍渲染左上角红绿灯（trafficLights），
// 整个窗口顶部 40px 由 TitleBar 自绘且 -webkit-app-region: drag。trafficLightPosition
// 给红绿灯留 14/14 内边距，对齐 DESIGN-desktop.md 的「左侧 80px 留给红绿灯」。
//
// Windows / Linux：frame: false —— 完全无系统装饰，TitleBar 自绘 minimize / maximize /
// close 三个按钮（通过 cursordance:window-* IPC 调用 BrowserWindow 方法）。
//
// 两套都把 maximize/unmaximize/fullscreen 状态广播给 renderer，TitleBar 据此切换图标
// （最大化 ↔ 还原），见 window-controls.ts。

import { BrowserWindow } from "electron";
import { join } from "path";
import { fileURLToPath } from "url";
import { bindWindowStateBroadcast } from "./window-controls";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export function createWorkbenchWindow(): BrowserWindow {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 480,
    show: false,
    frame: isMac ? undefined : false,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
    backgroundColor: "#f1f5f9",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  const unbindStateBroadcast = bindWindowStateBroadcast(win);
  win.once("closed", () => {
    unbindStateBroadcast();
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    win.loadURL(`${devUrl}/workbench/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/workbench/index.html"));
  }

  return win;
}
