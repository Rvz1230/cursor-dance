import { describe, it, expect } from "vitest";

// screen-utils 依赖 electron 的 screen 模块，测试态用占位 Display 对象直接调函数。
// 仅测试纯计算辅助 screenPointToDisplayLocal——onDisplayChanges / getAllDisplays
// 走 screen API，需要 electron 运行时，留到 e2e。
import { screenPointToDisplayLocal } from "./screen-utils";

type FakeDisplay = {
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
};

describe("screenPointToDisplayLocal", () => {
  it("primary display @1x：device px = DIP", () => {
    const d: FakeDisplay = { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 };
    // @ts-expect-error -- 仅用 bounds + scaleFactor，与完整 Display 接口对齐由编译期保证
    expect(screenPointToDisplayLocal(d, 100, 200)).toEqual({ x: 100, y: 200 });
  });

  it("retina @2x：device px 折半为 DIP", () => {
    const d: FakeDisplay = { bounds: { x: 0, y: 0, width: 1440, height: 900 }, scaleFactor: 2 };
    // @ts-expect-error -- 同上
    expect(screenPointToDisplayLocal(d, 200, 400)).toEqual({ x: 100, y: 200 });
  });

  it("secondary display @1x：减去 display.bounds.x/y", () => {
    const d: FakeDisplay = { bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 };
    // @ts-expect-error -- 同上
    expect(screenPointToDisplayLocal(d, 2020, 200)).toEqual({ x: 100, y: 200 });
  });
});
