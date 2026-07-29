// CursorDance 桌面 — workbench 窗口管理
//
// macOS：titleBarStyle: 'hiddenInset' —— 系统仍渲染左上角红绿灯（trafficLights），
// 整个窗口顶部 32px 由 TitleBar 自绘且 -webkit-app-region: drag。红绿灯系统硬控大小
// (~12px 直径)，不可调；trafficLightPosition 控制的是红绿灯在窗口内的偏移。
// 收紧到 { x: 11, y: 7 } 让视觉比例和 Finder/Safari 等原生 32px 标题栏一致。
//
// Windows / Linux：frame: false —— 完全无系统装饰，TitleBar 自绘 minimize / maximize /
// close 三个按钮（通过 cursordance:window-* IPC 调用 BrowserWindow 方法）。
//
// 两套都把 maximize/unmaximize/fullscreen 状态广播给 renderer，TitleBar 据此切换图标
// （最大化 ↔ 还原），见 window-controls.ts。

import { BrowserWindow } from "electron";
import { join } from "path";
import { fileURLToPath } from "url";
import { registerIpcSender } from "./ipc-security";
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
    trafficLightPosition: isMac ? { x: 11, y: 7 } : undefined,
    backgroundColor: "#f1f5f9",
    webPreferences: {
      preload: join(__dirname, "../preload/workbench.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  const unregisterIpcSender = registerIpcSender(win.webContents, "workbench");

  win.on("ready-to-show", () => win.show());

  const unbindStateBroadcast = bindWindowStateBroadcast(win);
  win.once("closed", () => {
    unregisterIpcSender();
    unbindStateBroadcast();
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(`${devUrl}/workbench/index.html`);
  } else {
    void win.loadFile(join(__dirname, "../renderer/workbench/index.html"));
  }

  return win;
}
