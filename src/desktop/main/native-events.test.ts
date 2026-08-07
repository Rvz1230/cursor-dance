import { describe, it, expect } from "vitest";
import {
  startGlobalMouseCapture,
  __testing__,
  type IInputSource,
  type NativeCursorEvent,
} from "./native-events";

const { uiohookButtonToBitmask, KeyRepeatTracker, WheelAccumulator } = __testing__;

describe("uiohookButtonToBitmask", () => {
  it("maps button 1 → left bit (1)", () => expect(uiohookButtonToBitmask(1)).toBe(1));
  it("maps button 2 → right bit (2)", () => expect(uiohookButtonToBitmask(2)).toBe(2));
  it("maps button 3 → middle bit (4)", () => expect(uiohookButtonToBitmask(3)).toBe(4));
  it("returns 0 for unknown button id", () => {
    expect(uiohookButtonToBitmask(0)).toBe(0);
    expect(uiohookButtonToBitmask(99)).toBe(0);
    expect(uiohookButtonToBitmask("left")).toBe(0);
    expect(uiohookButtonToBitmask(undefined)).toBe(0);
  });
});

describe("WheelAccumulator", () => {
  it("emits rotation × 100 once threshold is crossed", () => {
    // 透传：rotation=±1 → deltaY=±100。是否要在这里翻符号留待真机验证（见模块注释）。
    expect(new WheelAccumulator().feed(1)).toBe(100);
    expect(new WheelAccumulator().feed(-1)).toBe(-100);
  });

  it("accumulates sub-threshold rotations and emits when crossed", () => {
    const acc = new WheelAccumulator();
    expect(acc.feed(0.4)).toBeNull(); // 累积 0.4
    expect(acc.feed(0.4)).toBeNull(); // 累积 0.8
    expect(acc.feed(0.4)).not.toBeNull(); // 累积 1.2，越过阈值
  });

  it("resets accumulator after emit", () => {
    const acc = new WheelAccumulator();
    acc.feed(2);
    expect(acc.feed(0.5)).toBeNull(); // 上次已 reset，从 0 起累加
  });
});

describe("KeyRepeatTracker", () => {
  it("marks repeated keydown until the matching keyup", () => {
    const tracker = new KeyRepeatTracker();
    expect(tracker.keydown(30)).toBe(false);
    expect(tracker.keydown(30)).toBe(true);
    tracker.keyup(30);
    expect(tracker.keydown(30)).toBe(false);
  });

  it("tracks held keys independently", () => {
    const tracker = new KeyRepeatTracker();
    tracker.keydown(30);
    expect(tracker.keydown(37)).toBe(false);
    expect(tracker.keydown(30)).toBe(true);
  });
});

describe("startGlobalMouseCapture", () => {
  it("forwards events from a fake source to the callback", () => {
    const events: NativeCursorEvent[] = [];
    let started = false;
    // 用可变 holder 而不是 let：赋值发生在闭包里，TS 的线性流分析会把 let 收窄成 null。
    const captured: { cb: ((e: NativeCursorEvent) => void) | null } = { cb: null };
    const fakeSource: IInputSource = {
      start(cb) {
        started = true;
        captured.cb = cb;
      },
      stop() {
        started = false;
        captured.cb = null;
      },
    };

    const stop = startGlobalMouseCapture((e) => events.push(e), undefined, fakeSource);
    expect(started).toBe(true);

    captured.cb?.({ type: "mousedown", x: 10, y: 20, buttons: 1, timestamp: 1 });
    captured.cb?.({ type: "mousemove", x: 11, y: 21, buttons: 1, timestamp: 2 });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "mousedown", x: 10, y: 20 });

    stop();
    expect(started).toBe(false);
  });

  it("stops the previous source when started twice", () => {
    let firstStopped = false;
    const first: IInputSource = { start: () => {}, stop: () => { firstStopped = true; } };
    const second: IInputSource = { start: () => {}, stop: () => {} };

    const stop1 = startGlobalMouseCapture(() => {}, undefined, first);
    startGlobalMouseCapture(() => {}, undefined, second);
    expect(firstStopped).toBe(true);

    stop1(); // 已经被替换，调用应该是 no-op
  });
});
