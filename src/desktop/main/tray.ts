// 系统托盘
//
// 托盘形态：
//   - 图标：extension/icon-16.png（构建时由 electron-vite 把 extension/ 映射到 out/renderer 与
//     resources/ 之外的位置；这里依赖运行时拿到一个绝对路径，由 createTray 调用方注入）
//   - 左键点击：打开 / 聚焦 workbench 窗口
//   - 右键菜单：[ 开启效果 / 暂停效果, 分隔线, 打开工作台, 分隔线, 退出 ]
//
// 「开启 / 暂停」的 label 跟 config.enabled 同步——通过 onEnabledChange 订阅 electron-store
// 的变更广播，每次 enabled 翻转时重建 ContextMenu 并替换。这里不直接读 / 写 store——
// 由 createTray 调用方通过 deps.toggleEnabled / deps.isEnabled 注入，保持本模块对存储无感。
//
// 销毁路径：destroyTray() 取消订阅 + 销毁 Tray 实例；before-quit 时调用，避免 macOS 残留
// 状态栏图标。

import { app, Menu, Tray, nativeImage, type MenuItemConstructorOptions } from "electron";
import { existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * 在 dev 与 prod 下分别尝试几个可能位置，返回第一个真实存在的图标路径。
 * 都不存在时返回第一个候选，让 nativeImage 走错误分支并打印日志。
 */
function resolveIconPath(): string {
  const candidates = [
    join(app.getAppPath(), "extension/icon-16.png"),
    join(app.getAppPath(), "../extension/icon-16.png"),
    join(app.getAppPath(), "../../extension/icon-16.png"),
    join(__dirname, "../../extension/icon-16.png"),
    join(process.resourcesPath ?? "", "extension/icon-16.png"),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return candidates[0]!;
}

export interface TrayDeps {
  /** 16×16 PNG 图标的绝对路径。省略时由 tray 内部 resolveIconPath() 自动探测。 */
  iconPath?: string;
  /** 打开或聚焦 workbench 窗口；不存在时由调用方创建。 */
  openWorkbench: () => void;
  /** 退出整个应用。注入而不是直接调 app.quit()，方便测试。 */
  quitApp: () => void;
  /** 取当前 enabled 状态。第一次菜单构建用。 */
  isEnabled: () => boolean;
  /** 切换 enabled。调用方负责写回 electron-store + 广播 + 同步 overlay 显隐。 */
  toggleEnabled: () => void;
  /** 订阅 enabled 变更，回调里 tray 自己重建菜单。返回 unsubscribe。 */
  onEnabledChange: (cb: (enabled: boolean) => void) => () => void;
}

export interface TrayHandle {
  tray: Tray;
  destroy: () => void;
}

let activeHandle: TrayHandle | null = null;

function buildMenuTemplate(deps: TrayDeps, enabled: boolean): MenuItemConstructorOptions[] {
  return [
    {
      // 一致用「⏸ 暂停效果 / ▶ 开启效果」这种动词式 label，避免「已开启」类陈述句让用户
      // 不确定点击后会发生什么。
      label: enabled ? "暂停效果" : "开启效果",
      click: () => deps.toggleEnabled(),
    },
    { type: "separator" },
    {
      label: "打开工作台",
      click: () => deps.openWorkbench(),
    },
    { type: "separator" },
    {
      label: "退出 CursorDance",
      role: "quit",
      // role:'quit' 在某些平台上会被菜单 system 接管，显式 click 兜底
      click: () => deps.quitApp(),
    },
  ];
}

/**
 * 创建系统托盘。返回 handle，调用方在 before-quit 时调 destroy。
 *
 * 单进程内只允许一个 tray；重复调用会先 destroy 上一个再建新的——这是为了
 * 兼容热重载场景下 main 进程被复用但 createTray 被再次调用的情形。
 */
export function createTray(deps: TrayDeps): TrayHandle {
  if (activeHandle) {
    activeHandle.destroy();
  }

  const iconPath = deps.iconPath ?? resolveIconPath();
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    console.error(
      `[CursorDance] tray icon load FAILED at: ${iconPath}. ` +
        `状态栏不会显示图标。请检查路径或图标文件本身。`,
    );
  } else {
    console.log(
      `[CursorDance] tray icon loaded: ${iconPath} (${image.getSize().width}x${
        image.getSize().height
      })`,
    );
  }
  // macOS：理论上应该用 setTemplateImage 让系统按状态栏明暗自动反色，
  // 但 template image 要求图标必须含 alpha 通道（透明 = 不显示，黑色 = 显示）。
  // 当前 extension/icon-16.png 是 RGB 无 alpha，标记为 template 后在 macOS 14+
  // 会被渲染成空——直接看不见，因此暂时按非 template 彩色图标渲染。
  // 打包资源补齐 template-friendly 单色图标后再启用自动反色。

  const tray = new Tray(image);
  tray.setToolTip("CursorDance");

  const rebuild = () => {
    if (tray.isDestroyed()) return;
    const template = buildMenuTemplate(deps, deps.isEnabled());
    tray.setContextMenu(Menu.buildFromTemplate(template));
  };

  rebuild();

  // 左键单击：打开 / 聚焦 workbench。macOS 默认行为是弹菜单，这里覆盖成与 Windows
  // 一致的「点击主操作」语义；右键 / 长按依然走 contextMenu。
  const onClick = () => deps.openWorkbench();
  tray.on("click", onClick);

  const unsubscribe = deps.onEnabledChange(() => rebuild());

  const handle: TrayHandle = {
    tray,
    destroy: () => {
      unsubscribe();
      tray.off("click", onClick);
      if (!tray.isDestroyed()) {
        tray.destroy();
      }
      if (activeHandle === handle) {
        activeHandle = null;
      }
    },
  };

  activeHandle = handle;
  return handle;
}

export function destroyTray(): void {
  if (activeHandle) {
    activeHandle.destroy();
  }
}

// 测试钩子：暴露内部 buildMenuTemplate，让单测断言菜单结构而不必构造真实 Tray。
export const __testing__ = {
  buildMenuTemplate,
  getActiveHandle: () => activeHandle,
};
