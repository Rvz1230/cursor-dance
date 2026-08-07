import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";
import type {
  AudioOutput,
  EffectSurface,
  KeyboardEventPayload,
  RuntimeCursorEvent,
} from "@/shared/effect-runtime/contracts";
import type { ActionRuntimeState } from "@/shared/effect-runtime/action-state";
import type { GestureRuntimeState } from "@/shared/effect-runtime/gesture-state";
import type { VisualEffectsModule as SharedVisualEffectsModule } from "@/shared/effect-runtime/dom-effect-surface";
import type { CursorOverlayModule as SharedCursorOverlayModule } from "@/shared/effect-runtime/cursor-overlay";
import type { AudioRuntimeModule } from "@/shared/effect-runtime/audio-runtime";

// CursorDance 效果引擎共享类型
//
// 引擎的 DOM effect surface 由桌面端与扩展端共同使用；两端均通过 TypeScript
// composition root 注入 window/document/constants/state/configStore，让 overlay 渲染进程、
// Workbench 预览与扩展 content runtime 共享同一份核心代码。

/**
 * 引擎入口接收的结构化光标事件。
 * - extension：DOM pointerEvent 的薄封装；
 * - desktop：主进程通过 uiohook-napi 抓全局事件后，经 IPC 投递到 overlay。
 *
 * 字段刻意保持最小集合，避免 IPC 序列化负担。
 */
export type CursorEvent = RuntimeCursorEvent;

/**
 * DOM 元素 id / 类名常量。
 * 当前覆盖 visual-effects 的需求；2.2 cursor-overlay 之后视情况扩展。
 */
export interface EngineConstants {
  ROOT_ID: string;
  STYLE_ID: string;
  HIDE_CURSOR_CLASS: string;
}

/**
 * 引擎共享的可变状态切片。
 * 各子模块按需读写自己的字段；非自己的字段保持只读心态，避免互相踩。
 */
export interface EngineState extends ActionRuntimeState, GestureRuntimeState {
  /** visual-effects.animateNode 的并发计数 */
  activeEffects: number;
  /** cursor-overlay 复用的软件光标节点（首次同步时创建） */
  stateCursorNode?: HTMLElement | null;
  stateCursorImg?: HTMLImageElement | null;
  /** audio 子模块的节流时间戳（按 actionId 维度） */
  lastSoundAtByAction?: Record<string, number>;
  /** 懒创建的 AudioContext；首次 playSound 时建立 */
  audioContext?: AudioContext | null;
  /** trigger-handlers：是否已就绪，未就绪则吞掉所有触发 */
  ready?: boolean;
  /** trigger-handlers：滚轮 burst 检测的「上次滚轮事件时间」 */
  lastWheelEventAt?: number;
  /** key-feedback：per-keycode 冷却计时器 */
  lastKeydownAtByKeycode?: Map<number, number>;
  /** key-feedback：活动键盘效果计数 */
  activeKeyEffects?: number;
  /** key-feedback：连续输入节奏状态 */
  keyFeedbackCombo?: { count: number; lastAt: number };
  /** key-feedback：用于区分真实连按与系统长按自动重复 */
  pressedKeycodes?: Set<number>;
  /** overlay：上次鼠标全局 DIP 坐标（用于键盘事件多显示器路由） */
  lastMouseGlobalX?: number;
  lastMouseGlobalY?: number;
}

/**
 * configStore 暴露给引擎的最小接口。
 * 当前覆盖 visual-effects + cursor-overlay + audio + trigger-handlers 的需求。
 * 多数返回值/参数在桌面端没有 DOM 概念时会退化为 null/默认值，由 configStore 实现层处理。
 */
export interface ConfigStore {
  getActionTextConfig(actionConfig: Record<string, unknown> | null | undefined): Record<string, unknown>;
  getActionRippleConfig(actionConfig: Record<string, unknown> | null | undefined): Record<string, unknown>;
  getActionParticleConfig(actionConfig: Record<string, unknown> | null | undefined): Record<string, unknown>;
  getActionAnimationConfig(actionConfig: Record<string, unknown> | null | undefined): Record<string, unknown>;
  getActionImageConfig(actionConfig: Record<string, unknown> | null | undefined): Record<string, unknown>;
  getActionCursorFeedbackConfig(actionConfig: Record<string, unknown> | null | undefined): Record<string, unknown>;
  getActionAudioConfig(actionConfig: Record<string, unknown> | null | undefined): Record<string, unknown>;
  getActionTriggerConfig(actionConfig: Record<string, unknown> | null | undefined): Record<string, unknown>;
  getMaxActiveEffects(): number;
  getKeyFeedbackConfig(): KeyFeedbackConfig;
  /** trigger-handlers：当前 theme（用户选中的方案） */
  getActiveTheme?(): unknown;
  /** trigger-handlers：站点/应用是否启用。桌面端由共享 app-rules 匹配器实现 */
  isCurrentSiteEnabled?(): boolean;
  /** trigger-handlers：根据 theme + actionId 取动作配置。两端实现在无 theme 时返回 null。 */
  getActionConfig?(theme: unknown, actionId: string): Record<string, unknown> | null | undefined;
  /** trigger-handlers：解析 cursor state 绑定到某个 actionId */
  getCursorStateBinding?(
    theme: unknown,
    cursorStateId: string,
    sourceActionId: string,
  ): { actionId: string; cursorStateId: string; inheritedFromDefault?: boolean };
  /** trigger-handlers：从目标元素解析 cursor state id（桌面端通常返回默认） */
  resolveCursorStateId?(target: unknown): string;
  /** cursor-overlay：获取指定 cursor state 的生效配置（含 imageDataUrl/size/hotspot） */
  getEffectiveCursorStateConfig?(theme: unknown, stateId: string): unknown;
  /** trigger-handlers：触发区域匹配。桌面端无 DOM target/event 时返回 true */
  matchesTriggerZone?(
    target: unknown,
    triggerZone: unknown,
    event: unknown,
    opts: { actionId: string; triggerSource: string },
  ): boolean;
}

/**
 * diagnostics 子模块对引擎暴露的接口。完整实现位于共享 effect runtime，
 * 桌面与扩展分别注入平台开关和持久化 adapter。
 * describeTarget 桌面端可返回 "no-target" 之类的占位字符串。
 */
export interface DiagnosticsModule {
  isEnabled(): boolean;
  log(scope: string, payload?: Record<string, unknown>): void;
  /** 桌面端可返回简短字符串；扩展端返回结构化描述。统一为 unknown，由调用方按需序列化。 */
  describeTarget?(target: unknown): unknown;
}

/**
 * 创建引擎需要的依赖。
 * 显式注入 window/document/constants/state/configStore，让引擎可以被 overlay 渲染进程、
 * Workbench 预览面板，甚至单元测试里的 jsdom 复用。
 */
export interface EngineDeps {
  window: Window;
  document: Document;
  constants: EngineConstants;
  state: EngineState;
  configStore: ConfigStore;
  /** key-feedback：当前前台窗口的全局 DIP 边界；缺失时窗口锚点回落到屏幕。 */
  getActiveWindowBounds?: () => { x: number; y: number; width: number; height: number } | null;
  diagnostics?: DiagnosticsModule;
  reportRuntimeError?: (scope: string, message: string) => void;
}

/**
 * visual-effects 子模块对外暴露的渲染 API。
 * 桌面端与扩展端共同使用 shared DOM effect surface。
 */
type VisualEffectsModule = SharedVisualEffectsModule;

/**
 * cursor-overlay 子模块对外暴露的 API。
 */
type CursorOverlayModule = SharedCursorOverlayModule;

/**
 * trigger-handlers 子模块对外暴露的 API。
 * 桌面端裁剪：移除 handlePointerOver / handlePointerOut（hover 不在桌面 5 个 trigger 之内）。
 * 输入从 DOM Event 切换为结构化的 CursorEvent —— 桌面 IPC 不再需要序列化整个 PointerEvent。
 */
export interface TriggerHandlersModule {
  handleLeftPointerDown(event: CursorEvent): void;
  handlePointerUp(event: CursorEvent): void;
  handlePointerCancel(): void;
  reset(): void;
  handleRightPointerDown(event: CursorEvent): void;
  handleContextMenu(event: CursorEvent): void;
  handleWheel(event: CursorEvent): void;
}

/**
 * 从主进程 IPC 投递的键盘事件（与 native-events.ts NativeKeyboardEvent 同形）。
 */
export type NativeKeyboardEvent = KeyboardEventPayload;

/**
 * key-feedback 子模块对外暴露的 API。
 */
export interface KeyFeedbackModule {
  handleKeyboardEvent(event: NativeKeyboardEvent): void;
}

export interface EffectEngine {
  visualEffects: VisualEffectsModule;
  effectSurface: EffectSurface;
  cursorOverlay: CursorOverlayModule;
  audioRuntime: AudioRuntimeModule;
  audioOutput: AudioOutput;
  triggerHandlers: TriggerHandlersModule;
  keyFeedback: KeyFeedbackModule;
}
