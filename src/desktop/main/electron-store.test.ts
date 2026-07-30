import { describe, it, expect, beforeEach, vi } from "vitest";

// electron-store 在 import 阶段会 `import "electron"`，vitest node 环境里没有
// electron 模块，会直接挂掉。这里把整个包替换成一个最简的 stub class，
// 让 import 链路不真正触达 electron。运行时 store 会被 __testing__.injectStore
// 注入的 stub 接管，不会用到这个默认实现。
vi.mock("electron-store", () => ({
  default: class {
    private data = new Map<string, unknown>();
    get(key: string, fallback?: unknown) {
      return this.data.has(key) ? this.data.get(key) : fallback;
    }
    set(key: string, value: unknown) {
      this.data.set(key, value);
    }
  },
}));

import {
  readConfig,
  writeConfig,
  readLivePreview,
  writeLivePreview,
  clearLivePreview,
  onConfigChange,
  onLivePreviewChange,
  __testing__,
} from "./electron-store";

// 不实际构造 ElectronStore（它需要 electron app 上下文，这里跑在 vitest node 环境下）。
// 用 injectStore 注入一个 Map-backed stub，验证 read/write 往返 + listener 调度即可。

type StubStore = {
  get: (key: string, fallback?: unknown) => unknown;
  set: (key: string, value: unknown) => void;
};

function makeStubStore(): StubStore {
  const data = new Map<string, unknown>();
  return {
    get: (key, fallback) => (data.has(key) ? data.get(key) : fallback),
    set: (key, value) => {
      data.set(key, value);
    },
  };
}

beforeEach(() => {
  __testing__.reset();
});

describe("electron-store", () => {
  it("readConfig 默认返回 null（未写入过）", () => {
    __testing__.injectStore(makeStubStore() as never);
    expect(readConfig()).toBeNull();
  });

  it("writeConfig + readConfig 往返保留同一引用语义", () => {
    __testing__.injectStore(makeStubStore() as never);
    const sample = { enabled: true, themePacks: [{ id: "x" }] };
    writeConfig(sample);
    expect(readConfig()).toEqual(sample);
  });

  it("writeConfig 触发 onConfigChange 监听器，传递最新 payload", () => {
    __testing__.injectStore(makeStubStore() as never);
    const spy = vi.fn();
    const unsub = onConfigChange(spy);
    writeConfig({ enabled: false });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ enabled: false });
    unsub();
    writeConfig({ enabled: true });
    expect(spy).toHaveBeenCalledTimes(1); // 退订后不再触发
  });

  it("live preview 与持久化 config 互相隔离；clearLivePreview 还原到 null", () => {
    __testing__.injectStore(makeStubStore() as never);
    const previewSpy = vi.fn();
    onLivePreviewChange(previewSpy);

    expect(readLivePreview()).toBeNull();

    writeLivePreview({ accent: "#ff0" });
    expect(readLivePreview()).toEqual({ accent: "#ff0" });
    expect(readConfig()).toBeNull(); // 不污染持久化 config
    expect(previewSpy).toHaveBeenLastCalledWith({ accent: "#ff0" });

    clearLivePreview();
    expect(readLivePreview()).toBeNull();
    expect(previewSpy).toHaveBeenLastCalledWith(null);
  });
});
