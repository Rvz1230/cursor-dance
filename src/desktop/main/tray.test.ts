// 任务 4.1：tray 单元测试
//
// 不构造真实 Tray（vitest node 环境无 electron），只验证：
//   1. buildMenuTemplate 在 enabled / disabled 两种状态下生成正确的 label
//   2. 各菜单项点击调用注入的回调
//   3. createTray 注册 onEnabledChange，回调里重建 menu；destroy 退订并销毁
//
// 同样套路：mock 'electron' 让 import 链路通过，handler 用 vi.fn 收集副作用。

import { describe, it, expect, vi, beforeEach } from "vitest";

const { buildFromTemplateSpy, FakeTrayCtor, getLastTray } = vi.hoisted(() => {
  const buildFromTemplateSpy = vi.fn((template: unknown) => ({ __template: template }));

  type Listener = (...args: unknown[]) => void;
  let lastInstance: FakeTrayInstance | null = null;

  interface FakeTrayInstance {
    image: unknown;
    destroyed: boolean;
    listeners: Map<string, Listener[]>;
    contextMenu: unknown;
    toolTip: string | null;
    setToolTip(text: string): void;
    setContextMenu(menu: unknown): void;
    on(event: string, handler: Listener): void;
    off(event: string, handler: Listener): void;
    isDestroyed(): boolean;
    destroy(): void;
  }

  class FakeTray implements FakeTrayInstance {
    destroyed = false;
    listeners = new Map<string, Listener[]>();
    contextMenu: unknown = null;
    toolTip: string | null = null;
    constructor(public image: unknown) {
      lastInstance = this;
    }
    setToolTip(text: string) {
      this.toolTip = text;
    }
    setContextMenu(menu: unknown) {
      this.contextMenu = menu;
    }
    on(event: string, handler: Listener) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event)!.push(handler);
    }
    off(event: string, handler: Listener) {
      const list = this.listeners.get(event);
      if (!list) return;
      this.listeners.set(
        event,
        list.filter((h) => h !== handler),
      );
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
    }
  }

  return {
    buildFromTemplateSpy,
    FakeTrayCtor: FakeTray,
    getLastTray: () => lastInstance,
  };
});

vi.mock("electron", () => ({
  Menu: { buildFromTemplate: buildFromTemplateSpy },
  Tray: FakeTrayCtor,
  nativeImage: {
    createFromPath: (path: string) => ({
      __path: path,
      isEmpty: () => false,
      getSize: () => ({ width: 16, height: 16 }),
      setTemplateImage: vi.fn(),
    }),
  },
}));

import { createTray, destroyTray, __testing__, type TrayDeps } from "./tray";

const { buildMenuTemplate } = __testing__;

beforeEach(() => {
  buildFromTemplateSpy.mockClear();
  destroyTray();
});

function makeDeps(overrides: Partial<TrayDeps> = {}): TrayDeps {
  return {
    iconPath: "/fake/icon-16.png",
    openWorkbench: vi.fn(),
    quitApp: vi.fn(),
    isEnabled: () => true,
    toggleEnabled: vi.fn(),
    onEnabledChange: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe("buildMenuTemplate", () => {
  it("enabled=true 时第一项 label 为「暂停效果」", () => {
    const deps = makeDeps({ isEnabled: () => true });
    const tpl = buildMenuTemplate(deps, true);
    expect(tpl[0]?.label).toBe("暂停效果");
  });

  it("enabled=false 时第一项 label 为「开启效果」", () => {
    const deps = makeDeps({ isEnabled: () => false });
    const tpl = buildMenuTemplate(deps, false);
    expect(tpl[0]?.label).toBe("开启效果");
  });

  it("结构：toggle / sep / openWorkbench / sep / quit", () => {
    const tpl = buildMenuTemplate(makeDeps(), true);
    expect(tpl).toHaveLength(5);
    expect(tpl[1]?.type).toBe("separator");
    expect(tpl[2]?.label).toBe("打开工作台");
    expect(tpl[3]?.type).toBe("separator");
    expect(tpl[4]?.label).toBe("退出 CursorDance");
  });

  it("点击 toggle 项调用 toggleEnabled", () => {
    const toggleEnabled = vi.fn();
    const tpl = buildMenuTemplate(makeDeps({ toggleEnabled }), true);
    (tpl[0] as { click: () => void }).click();
    expect(toggleEnabled).toHaveBeenCalledTimes(1);
  });

  it("点击 openWorkbench 项调用 deps.openWorkbench", () => {
    const openWorkbench = vi.fn();
    const tpl = buildMenuTemplate(makeDeps({ openWorkbench }), true);
    (tpl[2] as { click: () => void }).click();
    expect(openWorkbench).toHaveBeenCalledTimes(1);
  });

  it("点击 quit 项调用 deps.quitApp", () => {
    const quitApp = vi.fn();
    const tpl = buildMenuTemplate(makeDeps({ quitApp }), true);
    (tpl[4] as { click: () => void }).click();
    expect(quitApp).toHaveBeenCalledTimes(1);
  });
});

describe("createTray", () => {
  it("初次构建立即设置 contextMenu 和 tooltip", () => {
    createTray(makeDeps());
    const tray = getLastTray()!;
    expect(tray.toolTip).toBe("CursorDance");
    expect(tray.contextMenu).not.toBeNull();
    expect(buildFromTemplateSpy).toHaveBeenCalledTimes(1);
  });

  it("点击 tray 触发 openWorkbench", () => {
    const openWorkbench = vi.fn();
    createTray(makeDeps({ openWorkbench }));
    const tray = getLastTray()!;
    const click = tray.listeners.get("click")![0];
    click();
    expect(openWorkbench).toHaveBeenCalledTimes(1);
  });

  it("onEnabledChange 触发后重建菜单（buildFromTemplate 被再调一次）", () => {
    let storedCb: ((enabled: boolean) => void) | null = null;
    const onEnabledChange = vi.fn((cb: (enabled: boolean) => void) => {
      storedCb = cb;
      return () => {};
    });
    let enabled = true;
    createTray(
      makeDeps({
        isEnabled: () => enabled,
        onEnabledChange,
      }),
    );
    expect(buildFromTemplateSpy).toHaveBeenCalledTimes(1);

    enabled = false;
    storedCb!(false);
    expect(buildFromTemplateSpy).toHaveBeenCalledTimes(2);
    // 第二次模板首项 label 应反映 disabled 状态
    const lastTemplate = buildFromTemplateSpy.mock.calls[1]![0] as Array<{ label?: string }>;
    expect(lastTemplate[0]?.label).toBe("开启效果");
  });

  it("destroy 退订 + tray.destroy()，再次 destroy 是 noop", () => {
    const unsubscribe = vi.fn();
    const handle = createTray(
      makeDeps({
        onEnabledChange: () => unsubscribe,
      }),
    );
    handle.destroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(getLastTray()!.destroyed).toBe(true);
    // 再调 destroyTray 不应再触发任何动作
    destroyTray();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("重复 createTray 会先销毁上一个 handle", () => {
    const firstHandle = createTray(makeDeps());
    const firstTray = getLastTray()!;
    createTray(makeDeps());
    expect(firstTray.destroyed).toBe(true);
    // 当前 active 应是新的 handle，不再是第一个
    expect(__testing__.getActiveHandle()).not.toBe(firstHandle);
  });
});
