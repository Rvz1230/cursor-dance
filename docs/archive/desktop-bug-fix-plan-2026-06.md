# CursorDance 桌面版 Bug 修复文档

> 归档于 2026-08-06。本文记录 2026-06 的缺陷定位与验收，代码路径和领域命名保留历史原貌，不作为当前实现说明。

> 验收日期：2026-06-15
> 分支：desktop/phase-0
> 状态：验收发现 12 个 bug，按优先级和模块分组

---

## 模块依赖关系图

修复前必须理解数据流向，避免改 A 坏 B：

```
native-events.ts ──(NativeCursorEvent)──→ index.ts ──(IPC broadcast)──→ overlay/index.ts
                                                                      │
                          ┌─────────────────────────────────────────────┘
                          │ dispatch() 按事件类型分流
                          ▼
                 trigger-handlers.ts ──(triggerAction)──→ visual-effects.ts
                          │                                    │
              ┌───────────┼───────────┐                ┌───────┼───────┐
              ▼           ▼           ▼                ▼       ▼       ▼
         leftClick   rightClick   doubleClick    renderText  renderParticles  ...
         longPress   wheel                         renderRipple  renderOrbitalParticles
              │                                      │               │
              │  所有动作共用同一个                    │  背景色从未设置  │  orbitalGroups
              │  configStore 实例                     │  (Bug A2)     │  无 actionId 隔离
              │        │                              │               │  (Bug A3)
              ▼        ▼                              ▼               ▼
              config-store.ts ←── default-config.ts ── mergeActionConfig ── action-config.ts
                    │                                        │              │
                    │  getActiveScheme()                     │  BASE_ACTION  │  FIELD 列表
                    │  getActionConfig()                     │  _CONFIGS     │  (引擎 vs 工作台
                    │  resolveCursorStateId()                │               │   不一致 Bug B1)
                    │  getEffectiveCursorStateConfig()       │
                    │         ▲                              │
                    │         │ overlay/index.ts 从未调用     │
                    │         │ (Bug A1)                     │
                    ▼         │                              ▼
              cursor-overlay.ts                       workbenchSchema.ts
              syncStateCursorOverlay(x,y,             ACTIONS 包含 hover
                cursorState?) ←─ 始终 undefined         (Bug B2)
```

---

## A 组：Overlay 渲染链路 Bug（用户直接可见）

### A1. 自定义鼠标图标完全不工作

**严重程度**: P0 — 核心卖点功能

**现象**: 用户配置了自定义鼠标图片（cursorStates 中的 imageDataUrl），桌面上永远只显示系统原生光标

**根因分析**:

数据流断裂点在 `overlay/index.ts:174`：
```ts
engine.cursorOverlay.syncStateCursorOverlay(cursorEvent.x, cursorEvent.y, undefined);
//                                                                    ^^^^^^^^^ 永远 undefined
```

对比扩展端 `extension/content-runtime/cursor-overlay.js:33-61`，`syncStateCursorOverlay` 接收 DOM Event，内部自己解析光标状态：
```
event → configStore.getActiveScheme()
      → configStore.resolveCursorStateId(target)
      → configStore.getEffectiveCursorStateConfig(scheme, stateId)
      → 提取 imageDataUrl / size / hotspotX / hotspotY
      → 渲染软件光标 + 添加 HIDE_CURSOR_CLASS
```

桌面端迁移时把 `syncStateCursorOverlay` 改为纯参数传递模式（`cursorState?: CursorOverlayState` 从外部传入），设计意图是让上层负责解析，但 overlay 上层从未实现这个解析逻辑。

**上下游关系**:
- 上游：`configStore.getActiveScheme()` ✅ 可用（overlay 已有 configStore 实例）
- 上游：`configStore.resolveCursorStateId()` ✅ 可用（桌面端传 `null` 返回 `"default"`）
- 上游：`configStore.getEffectiveCursorStateConfig()` ✅ 可用
- 下游：`cursor-overlay.ts` 的 `syncStateCursorOverlay(x, y, cursorState)` ✅ 渲染逻辑正确
- 断裂点：仅是 overlay 上层没有调用上述三个函数

**关联 Bug**: 修复 A1 后，`HIDE_CURSOR_CLASS` 才会被添加到 overlay，此时 `renderCursorOverride` 中 `"切换到 pointer"` 模式（Bug A4）才有意义——否则 `cursor: pointer` 被 `cursor: none !important` 覆盖是正确的。

**修复方案**:

在 `overlay/index.ts` 的 mousemove 处理中，补全光标状态解析：

```ts
// 位置：overlay/index.ts，替换现有的 mousemove 分支
if (payload.type === "mousemove") {
  // 解析当前光标状态，构造 CursorOverlayState
  const scheme = configStore.getActiveScheme();
  const stateId = configStore.resolveCursorStateId(null);
  const cursorStateConfig = configStore.getEffectiveCursorStateConfig(scheme, stateId) as Record<string, unknown> | null;
  const imageDataUrl = cursorStateConfig?.imageDataUrl as string | undefined;
  const cursorState: CursorOverlayState | undefined = imageDataUrl
    ? {
        imageDataUrl,
        size: cursorStateConfig?.size as number | undefined,
        hotspotX: cursorStateConfig?.hotspotX as number | undefined,
        hotspotY: cursorStateConfig?.hotspotY as number | undefined,
      }
    : undefined;
  engine.cursorOverlay.syncStateCursorOverlay(cursorEvent.x, cursorEvent.y, cursorState);
  return;
}
```

需要额外 import `CursorOverlayState` 类型：
```ts
import type { CursorOverlayState } from "../engine/types";
```

**修复前的副作用分析**:

1. **缺少 `isCurrentSiteEnabled()` 检查**（扩展端有，桌面端缺失）：
   - 扩展端 `cursor-overlay.js:34` 在解析光标状态前调用 `configStore.isCurrentSiteEnabled()`
   - 桌面端如果只加光标解析不加 enabled 检查，用户通过托盘关闭效果后，自定义光标仍会显示在 mousemove 上
   - 虽然 `triggerAction` (line 133) 有 `isCurrentSiteEnabled` 保护会阻止点击效果，但光标图标本身不受保护
   - **必须同步添加 enabled 检查**

2. **默认主题无 imageDataUrl**：
   - 所有 4 个内置主题的 `cursorStates` 都是用 `createDefaultCursorStates()` 生成的
   - 其中 `imageDataUrl` 默认为空字符串 `""`
   - 修复后 `cursorState` 为 `undefined`（因为 `""` 是 falsy），`clearStateCursorOverlay()` 被调用，行为与修复前完全一致
   - **不影响未配置自定义光标的用户**

3. **每次 mousemove 都会调用 `clearStateCursorOverlay`**：
   - 当 `imageDataUrl` 为空时，`clearStateCursorOverlay()` 在每个 mousemove 上执行 `classList.remove(HIDE_CURSOR_CLASS)`
   - 与扩展端行为一致，不是回归，但是轻微性能浪费
   - 可优化：缓存上次 cursorState 是否有 imageDataUrl，相同则跳过

4. **桌面端光标状态永远为 "default"**：
   - `resolveCursorStateId(null)` 始终返回 `"default"`（因为桌面无 DOM target）
   - 用户为 "pointer"/"text" 等状态设置的自定义光标在桌面端永远不会显示
   - 这是架构限制（无 DOM 上下文），不是 bug，但应在文档中说明
   - 未来可通过 active-window 的窗口标题/进程名推断光标状态

5. **mousedown/mouseup/wheel 事件不更新光标位置**：
   - 当前 mousemove 分支 `return` 后，其他事件不更新光标位置
   - 这不是问题：mousedown/mouseup 发生时光标位置与上一个 mousemove 相同
   - 但如果未来支持按住拖动时光标状态切换（如按下变为 "pointer"），需要在 mousedown 中也更新光标状态

**改动文件**:
- `src/desktop/renderer/overlay/index.ts` — 补全 mousemove 中的光标状态解析 + enabled 检查

---

### A2. 粒子颜色从未渲染

**严重程度**: P0 — 视觉效果核心组件

**现象**: 所有粒子都是透明的，只能看到微弱 box-shadow 光晕。用户配置的粒子颜色（"跟随飘字色"、"随机轻变化"）完全不可见

**根因分析**:

`compute-specs.ts` 导出了 `getParticleTint(config, index)` 函数（line 383），根据 `particleColorMode` 返回 RGBA 颜色字符串。`action-config.ts` 也导出了 `getParticleColor(particleConfig, textConfig, index)` 函数（line 194），功能等价。

但 `visual-effects.ts` 中：
- `renderParticles` (line 425-508)：创建粒子 node 后只设置了 `width/height/borderRadius/clipPath/boxShadow`，**从未设置 `background`**
- `renderOrbitalParticles` (line 511-573)：同理，从未设置 `background`

`getParticleTint` / `getParticleColor` 已定义但从未被消费。

扩展端 `extension/content-runtime/visual-effects.js` 同样缺失此调用——这是从扩展端迁来的预存 bug。

**上下游关系**:
- 上游：`getParticleTint` / `getParticleColor` ✅ 函数已实现
- 上游：`particleConfig.particleColorMode` / `particlePalette` / `particleOpacity` ✅ 配置字段已就绪
- 下游：粒子 node 的 `style.background` ✅ CSS 属性可直接赋值
- 断裂点：仅是 renderParticles/renderOrbitalParticles 没有调用颜色函数

**修复方案**:

在 `visual-effects.ts` 中，创建粒子 node 后设置背景色：

1. 顶部添加 import：
```ts
import { getParticleTint } from "./compute-specs";
// 或者用 action-config.ts 的 getParticleColor——选一个，不要两个都用
```

2. `renderParticles` 中（约 line 444 后）：
```ts
const node = document.createElement("span");
node.className = "cd-effect cd-particle";
node.style.left = x + "px";
node.style.top = y + "px";
node.style.background = getParticleTint(actionConfig, index); // ← 新增
```

3. `renderOrbitalParticles` 中（约 line 532 后）：
```ts
const dot = document.createElement("span");
dot.className = "cd-effect cd-particle";
dot.style.left = x + "px";
dot.style.top = y + "px";
dot.style.background = getParticleTint(actionConfig, i); // ← 新增
```

4. 拖尾粒子同理（line 479 后的 trailNode）：
```ts
trailNode.style.background = getParticleTint(actionConfig, index + t); // ← 新增
```

**修复前的副作用分析**:

1. **不会覆盖现有 `background`**：`renderParticles` / `renderOrbitalParticles` / 拖尾粒子都从未设置 `node.style.background`。`getParticleShapeStyle` 返回 `{ width, height, borderRadius, rotation, clipPath, boxShadow }`，不含 `background`。**无冲突**

2. **`box-shadow` 的交互是正面的**：当前 `.cd-particle` 的 CSS `box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12)` 和 `getParticleShapeStyle` 覆盖的 `boxShadow` 都是画在元素边界外的阴影。目前粒子是透明的，阴影画在透明元素上效果微弱。添加 `background` 后，阴影会衬托在有色的填充上，视觉效果更好，不是退化

3. **`clipPath` 形状需要 `background` 才能渲染**：星光/钻石/心形/三角等 `clipPath` 形状会裁剪元素的渲染区域（包括 background）。当前这些形状因为 background 为透明，clipPath 裁剪后完全不可见。添加 background 是 `clipPath` 形状正常显示的**必要条件**，不是副作用

4. **`getParticleTint` 的 `particleOpacity` 未定义时会生成无效 CSS**：
   - `getParticleTint` 计算 `(particleConfig.particleOpacity as number) / 100`
   - 如果 `particleOpacity` 是 `undefined`，结果是 `undefined / 100 = NaN`
   - `rgba(r, g, b, NaN)` 是无效 CSS，浏览器会忽略 → 粒子无 background，回到当前行为
   - 对比 `getParticleColor` 用了 `((particleConfig.particleOpacity as number) || 88) / 100`，默认 88% 不透明度
   - **必须修复 `getParticleTint` 添加 `|| 88` 默认值**，否则新用户/未配置粒子透明度时粒子颜色仍然不可见

5. **扩展端同样存在此 bug**：`extension/content-runtime/visual-effects.js` 也没有设置粒子 background，且该文件没有 `getParticleTint` 可用。修复需要：
   - 在扩展端注册 `getParticleTint` 到 `CursorDanceConfigHelpers`
   - 在扩展端 `visual-effects.js` 中调用
   - **两端必须同步修复，否则扩展端的粒子仍然是透明的**

6. **`getParticleTint` 与 `getParticleColor` 的选择**：
   - `getParticleTint`（compute-specs.ts）：接受完整 `actionConfig`，内部自己提取 particleConfig/textConfig。签名简洁，推荐使用
   - `getParticleColor`（action-config.ts）：接受已提取的 `particleConfig` + `textConfig`。调用方需要先提取
   - **选 `getParticleTint`**：调用更简洁，且 compute-specs.ts 已被 visual-effects.ts import，无循环依赖风险

7. **循环依赖检查**：
   - `visual-effects.ts` → `compute-specs.ts` → `action-config.ts`：依赖链已存在
   - 添加 `getParticleTint` 作为额外命名 import 不会创建新的依赖边

**改动文件**:
- `src/desktop/renderer/engine/visual-effects.ts` — 添加粒子背景色
- `src/desktop/renderer/engine/compute-specs.ts` — 修复 `getParticleTint` 的 `particleOpacity` 默认值
- `extension/content-runtime/visual-effects.js` — 同步修复

---

### A2b. getParticleTint 的 particleOpacity 未定义时生成无效 CSS

**严重程度**: P1 — A2 修复的连带 bug，不修则 A2 修复无效

**现象**: `getParticleTint` 计算 `(particleConfig.particleOpacity as number) / 100`，当 `particleOpacity` 为 `undefined` 时结果为 `NaN`，生成的 `rgba(r, g, b, NaN)` 是无效 CSS，浏览器忽略，粒子仍无 background

**根因分析**:

`compute-specs.ts:387`:
```ts
return hexToRgba(textConfig.textColor as string | undefined, (particleConfig.particleOpacity as number) / 100);
```

对比 `action-config.ts:202` 的 `getParticleColor`:
```ts
const opacity = ((particleConfig.particleOpacity as number) || 88) / 100;  // 默认 88%
```

`getParticleTint` 缺少 `|| 88` 默认值。

**什么时候触发**: `BASE_ACTION_CONFIGS` 中 `particleOpacity` 默认为 `88`，所以内置主题不会触发。但如果 `pickActionConfigFields` 因为字段列表问题（Bug B1）丢失了 `particleOpacity`，或者用户清空了该字段，就会触发。

**修复方案**:

```ts
// compute-specs.ts — getParticleTint 中所有 opacity 计算都加默认值
const opacity = ((particleConfig.particleOpacity as number) || 88) / 100;
```

**改动文件**:
- `src/desktop/renderer/engine/compute-specs.ts` — getParticleTint 添加 opacity 默认值

---

### A3. 轨道粒子无 actionId 隔离

**严重程度**: P1 — 多动作场景下可见

**现象**: 当多个动作配置了 `particleMotionMode: "orbital"`（如 drift 主题的 leftClick 和 doubleClick），触发第二个轨道动作会清除第一个动作的活跃轨道粒子

**根因分析**:

`trigger-handlers.ts` line 256-259：
```ts
if (particleCfg.particleMotionMode === "orbital") {
  visualEffects.clearOrbitalParticles();  // ← 清除所有动作的轨道粒子
  visualEffects.renderOrbitalParticles(coords.x, coords.y, actionConfig, runIndex);
}
```

`visual-effects.ts` line 572-573：
```ts
state.orbitalGroups = state.orbitalGroups || [];
state.orbitalGroups.push(dots);  // ← 扁平数组，无 actionId 分组
```

`clearOrbitalParticles()` 清空整个 `state.orbitalGroups`，不区分来源动作。

**上下游关系**:
- 上游：`triggerAction` 按 `resolvedActionId` 隔离了节流/连击/计数器 ✅
- 上游：`clearOrbitalParticles` 是渲染清理逻辑，与 triggerAction 的隔离机制独立
- 下游：轨道粒子是长时间存活的动画，不同于 burst 粒子（一次性），跨动作干扰风险高

**修复方案**:

方案 A（推荐 — 按 actionId 分组）：
1. `state.orbitalGroups` 改为 `Map<string, {dot: HTMLElement; anim: Animation}[]>`
2. `renderOrbitalParticles` 接收 `actionId` 参数，只推入对应 key
3. `triggerAction` 中调用 `clearOrbitalParticles(resolvedActionId)` 只清除同 actionId 的组
4. `clearOrbitalParticles()` 无参时清除全部（用于 overlay 退出清理）

具体改动：

```ts
// visual-effects.ts — 修改 state.orbitalGroups 类型
// EngineState 接口（types.ts）中：
orbitalGroups?: Map<string, { dot: HTMLElement; anim: Animation }[]>;

// renderOrbitalParticles 签名加 actionId：
function renderOrbitalParticles(
  x: number, y: number,
  actionConfig: Record<string, unknown>,
  runIndex: number,
  actionId: string,  // ← 新增
): void {
  // ...
  if (!state.orbitalGroups) state.orbitalGroups = new Map();
  const existing = state.orbitalGroups.get(actionId) || [];
  existing.push(...dots);
  state.orbitalGroups.set(actionId, existing);
}

// clearOrbitalParticles 支持 actionId 过滤：
function clearOrbitalParticles(actionId?: string): void {
  if (!state.orbitalGroups) return;
  if (actionId) {
    const groups = state.orbitalGroups.get(actionId);
    if (groups) {
      for (const item of groups.flat()) { item.anim.cancel(); item.dot.remove(); }
      state.orbitalGroups.delete(actionId);
    }
  } else {
    for (const groups of state.orbitalGroups.values()) {
      for (const item of groups.flat()) { item.anim.cancel(); item.dot.remove(); }
    }
    state.orbitalGroups.clear();
  }
}
```

```ts
// trigger-handlers.ts — 传递 actionId：
if (particleCfg.particleMotionMode === "orbital") {
  visualEffects.clearOrbitalParticles(resolvedActionId);  // ← 只清同 actionId
  visualEffects.renderOrbitalParticles(coords.x, coords.y, actionConfig, runIndex, resolvedActionId);
}
```

**注意事项**:
- `VisualEffectsModule` 接口需要更新 `renderOrbitalParticles` 和 `clearOrbitalParticles` 签名
- `overlay/index.ts` 的 `beforeunload` 调用 `clearOrbitalParticles()` 无参形式仍然正确
- Workbench 预览 `WorkbenchPreviewRail.tsx` 调用 `clearOrbitalParticles()` 也需要适配

**改动文件**:
- `src/desktop/renderer/engine/types.ts` — 修改 `orbitalGroups` 类型、接口签名
- `src/desktop/renderer/engine/visual-effects.ts` — 按 actionId 分组
- `src/desktop/renderer/engine/trigger-handlers.ts` — 传递 resolvedActionId
- `src/desktop/renderer/overlay/index.ts` — 适配新签名
- `src/app/pages/theme-workbench/components/WorkbenchPreviewRail.tsx` — 适配新签名

---

### A4. 右键 mouseup 取消左键长按

**严重程度**: P1 — 基本交互逻辑错误

**现象**: 左键按下后等待长按触发 → 期间右键点击 → 右键 mouseup → 长按被取消

**根因分析**:

`overlay/index.ts` line 190-192：
```ts
if (payload.type === "mouseup") {
  engine.triggerHandlers.handlePointerUp(cursorEvent);
  // ↑ 不区分左右键，直接调 handlePointerUp
}
```

`trigger-handlers.ts` line 401-409：
```ts
function handlePointerUp(event: CursorEvent): void {
  // ...
  finishLongPress(event);  // ← 右键 mouseup 也会执行这里
  // ...
}
```

`handlePointerUp` 没有 `buttons` 参数来区分是哪个键松开，一律取消长按。

**上下游关系**:
- 上游：`native-events.ts` 的 `onMouseUp` 在清除 button bit 后才触发回调，`buttons` 反映松开后的状态
- 上游：overlay dispatch 能拿到 `payload.buttons`（松开后状态），但无法直接判断是哪个键松开的
- 根本问题：uiohook 的 mouseup 事件有 `button` 字段（哪个键松开），但 `NativeCursorEvent` 接口只传了 `buttons`（当前按下状态），没有传 `button`

**修复方案**:

分两步走：

**第一步：NativeCursorEvent 增加 button 字段**

```ts
// native-events.ts — NativeCursorEvent 接口增加：
export interface NativeCursorEvent {
  type: "mousemove" | "mousedown" | "mouseup" | "wheel";
  x: number;
  y: number;
  buttons?: number;
  /** 哪个键触发此事件：1=left 2=right 3=middle（uiohook 原始值） */
  button?: number;
  deltaY?: number;
  timestamp: number;
}

// onMouseUp 中传递 button：
private onMouseUp = (e: UiohookMouseEvent): void => {
  const bit = uiohookButtonToBitmask(e.button);
  this.buttonsState &= ~bit;
  this.callback?.({
    type: "mouseup",
    x: e.x,
    y: e.y,
    buttons: this.buttonsState,
    button: e.button,  // ← 新增
    timestamp: e.time,
  });
};
```

**第二步：overlay dispatch 按按键分流 mouseup**

```ts
// overlay/index.ts — mouseup 分支：
if (payload.type === "mouseup") {
  const isLeftUp = payload.button === 1 || ((payload.buttons ?? 0) & 1) === 0 && /* 上一次有左键 */;
  // 简化：用 button 字段
  if (payload.button === 1) {
    engine.triggerHandlers.handlePointerUp(cursorEvent);
  }
  // 右键/中键 mouseup 不影响长按状态机，不需要调 handlePointerUp
  return;
}
```

**备选方案（更保守，不改 IPC 接口）**：

用 `buttons` 状态推断松开的键：mousedown 时记录 `buttonsBeforeDown`，mouseup 时比对。但这种方式不可靠（多键同时操作时状态混乱），不推荐。

**注意事项**:
- 增加 `button` 字段需要同步更新 `preload/index.ts` 的 `CursorEventPayload` 类型
- 扩展端不使用此字段（DOM PointerEvent 有自己的 button 属性），不影响
- `mousedown` 也可以加 `button` 字段，但 overlay dispatch 已经用 `buttons & 1/2` 区分了，改动不大
- `handlePointerUp` 内部的双击检测目前用 `state.lastLeftPointerUpAt`，只应在左键 mouseup 时更新——修复此 bug 后自动正确

**改动文件**:
- `src/desktop/main/native-events.ts` — NativeCursorEvent 增加 button 字段
- `src/shared/` 或 `src/desktop/preload/index.ts` — CursorEventPayload 增加 button 字段
- `src/desktop/renderer/overlay/index.ts` — mouseup 按按键分流

---

## B 组：配置模型 Bug（数据正确性）

### B1. 引擎 action-config 字段列表与 Workbench 不一致

**严重程度**: P1 — delay 字段全部丢失

**现象**: 用户在 Workbench 配置了动画延迟/涟漪延迟/图片延迟/文字延迟，overlay 引擎读取时这些字段被 pickActionConfigFields 丢弃

**对比**:

| 字段 | 引擎 ACTION_xxx_FIELDS | Workbench ACTION_xxx_FIELDS | BASE_ACTION_CONFIGS 默认值 |
|------|:---:|:---:|:---:|
| textDelay | ❌ | ✅ | 0 |
| rippleDelay | ❌ | ✅ | 100 |
| animationDelay | ❌ | ✅ | 0 |
| imageDelay | ❌ | ✅ | 0 |
| particleStagger | ✅(引擎) | ❌(工作台) | 26 |

**根因分析**:

引擎端 `src/desktop/renderer/engine/action-config.ts` 的字段列表是在迁移时手动编写的，与 Workbench 端 `src/app/pages/theme-workbench/model/actionConfigOptions.ts` 各自维护，没有同步机制。

`pickActionConfigFields(config, FIELD_LIST)` 只提取列表中的字段，列表外的字段被丢弃。

**上下游关系**:
- 上游：Workbench 保存配置时用 `ACTION_RUNTIME_FIELDS`（包含 delay 字段）→ 存入 electron-store ✅ 数据完整
- 中游：overlay 的 `configStore.setConfig()` 接收完整配置 → `normalizeConfig()` 保留所有字段 ✅
- 下游：引擎 `getActionXxxConfig()` 用 `pickActionConfigFields` 提取 → delay 字段被丢弃 ❌
- 下游：`renderText`/`renderRipple`/`renderAnimationEffect`/`renderImageEffect` 目前也不读取 delay 字段（所以即时修复字段列表不会立刻改变行为，但这是正确化的前提）

**修复方案**:

统一引擎和 Workbench 的字段列表。推荐做法：引擎直接从 Workbench 的 `actionConfigOptions.ts` 导入，不再维护独立副本。但如果循环依赖有问题，则手动同步补齐。

手动补齐方案：
```ts
// src/desktop/renderer/engine/action-config.ts

const ACTION_TEXT_FIELDS = [
  // ...existing...
  "comboWindowMs",
  "textDelay",       // ← 新增
];

const ACTION_RIPPLE_FIELDS = [
  // ...existing...
  "rippleColor",
  "rippleDelay",     // ← 新增
];

const ACTION_ANIMATION_FIELDS = [
  // ...existing...
  "animationGlow",
  "animationDelay",  // ← 新增
];

const ACTION_IMAGE_FIELDS = [
  // ...existing...
  "imageOffsetY",
  "imageDelay",      // ← 新增
];
```

Workbench 端补齐 `particleStagger`：
```ts
// src/app/pages/theme-workbench/model/actionConfigOptions.ts

export const ACTION_PARTICLE_FIELDS = [
  // ...existing...
  "orbitalSpeed",
  "particleStagger", // ← 新增
];
```

**注意事项**:
- 仅补齐字段列表不会改变渲染行为（renderXxx 函数目前不读取 delay），但确保后续实现 delay 功能时字段可用
- `particleStagger` 在 Workbench 端缺失意味着保存→重新加载后 stagger 会丢失。这个 bug 的实际影响是粒子间距重置，但当前 renderParticles 的 `computeParticleSpecs` 已经硬编码了 stagger 逻辑，所以视觉上可能不明显
- 修复后应运行 `actionConfigSync.test.js` 确认两端默认配置同步

**改动文件**:
- `src/desktop/renderer/engine/action-config.ts` — 补齐 4 个 delay 字段
- `src/app/pages/theme-workbench/model/actionConfigOptions.ts` — 补齐 particleStagger

---

### B2. hover 动作泄漏到桌面端

**严重程度**: P1 — 用户配置无效功能

**现象**: Workbench 的 ACTIONS 列表包含 `{ id: "hover", label: "悬停" }`，桌面用户可以配置 hover 效果，但 overlay 引擎完全没有 hover 处理逻辑，效果永远不会触发

**根因分析**:

`workbenchSchema.ts` 的 `ACTIONS` 数组是扩展端和桌面端共用的。扩展端有 hover trigger（DOM pointerover/pointerout），桌面端不支持。

**上下游关系**:
- 上游：Workbench UI 渲染动作列表 → 用户选择 hover → 配置写入 ✅ 数据写入成功
- 中游：config-store 的 `BASE_ACTION_CONFIGS` 不包含 hover → `getActionConfig(scheme, "hover")` 返回 leftClick 回退 ⚠️
- 下游：overlay 无 `handlePointerOver`/`handlePointerOut` → hover 永远不触发 ❌
- 连带：`actionConfigPresets.ts` 包含 hover 预设 → 每个主题的 draft 包含 hover actionConfig → 增加存储体积

**修复方案**:

方案 A（推荐 — 运行时过滤）：

在 `workbenchSchema.ts` 导出桌面端专用列表：
```ts
import { ACTIONS } from "./workbenchSchema";

// 根据 cursorDanceApp 是否注入判断是否为桌面端
const isDesktop = typeof window !== "undefined" && !!window.cursorDanceApp;

export const DESKTOP_ACTIONS = ACTIONS.filter(a => a.id !== "hover");

// 使用方按 isDesktop 选择列表
export function getActionsForPlatform() {
  return isDesktop ? DESKTOP_ACTIONS : ACTIONS;
}
```

Workbench 中引用 ACTIONS 的地方改为 `getActionsForPlatform()`。

方案 B（构建时过滤）：

用 Vite define 注入 `__DESKTOP__` 常量，Workbench 中条件编译。但这样扩展端代码也会受影响，不推荐。

**注意事项**:
- 过滤 hover 后，`actionConfigPresets.ts` 的 hover 预设不应删除（扩展端仍需要），但桌面端 `buildDraftActionConfigs` 应跳过 hover
- 已保存的配置中可能包含 hover actionConfig，这不会导致 crash（引擎忽略未知 actionId），只是浪费存储
- `actionConfigSync.test.js` 需要确认过滤后不影响同步测试

**改动文件**:
- `src/app/pages/theme-workbench/model/workbenchSchema.ts` — 添加平台过滤
- `src/app/pages/theme-workbench/hooks/useThemeWorkbenchState.ts` — 引用过滤后的 ACTIONS
- `src/app/pages/theme-workbench/model/themeDraftAdapter.ts` — buildDraftActionConfigs 跳过 hover

---

### B3. getActionConfig 用 || 而非 ?? 做回退

**严重程度**: P2 — 潜在逻辑错误

**现象**: `config-store.ts:766` 中 `draft.actionConfigs?.[actionId] || draft.actionConfigs?.leftClick || null`，如果 actionId 对应的配置是一个所有字段为 falsy 的稀疏对象，`||` 会错误地回退到 leftClick

**根因分析**:

`mergeActionConfig` 使用 spread 合并，如果存储的覆盖层是一个空对象 `{}`，合并结果仍有来自 BASE 的真值字段，所以 `||` 短路不会触发。但如果未来有人手动写入了一个 `{ ripple: false, particle: false }` 的稀疏配置，`||` 会导致该动作错误地使用 leftClick 配置。

**修复方案**:

```ts
// config-store.ts:766
return draft.actionConfigs?.[actionId] ?? draft.actionConfigs?.leftClick ?? null;
```

**注意事项**:
- `??` 只对 `null`/`undefined` 短路，对 `0`/`false`/`""`/`{}` 不短路，语义更正确
- 当前无实际影响（mergeActionConfig 保证结果对象有真值字段），但防御性修复

**改动文件**:
- `src/desktop/renderer/engine/config-store.ts` — `||` 改 `??`

---

## C 组：交互逻辑 Bug

### C1. handlePointerUp 双击检测不受长按抑制保护

**严重程度**: P2 — 边缘场景

**现象**: 长按触发后的 release 可能被误判为双击的第二次抬起，导致 doubleClick 在 longPress 之后意外触发

**根因分析**:

`trigger-handlers.ts:401-443`：
```ts
function handlePointerUp(event: CursorEvent): void {
  const longPressFired = lpState && (lpState.triggered || ...);
  finishLongPress(event);  // 清除 longPressState

  if (!longPressFired) {
    // leftClick 逻辑（被 longPressFired 保护）✅
  }

  // 双击检测（不受 longPressFired 保护）❌
  if (doubleClickTriggerConfig.triggerTiming !== "第二次按下时") {
    if (now - (state.lastLeftPointerUpAt || 0) <= doubleClickInterval) {
      triggerAction("doubleClick", ...);  // ← 长按释放后可能误触发
    }
  }
}
```

**修复方案**:

双击检测加 `longPressFired` 保护：
```ts
if (!longPressFired) {
  // ...leftClick 逻辑...

  // 双击检测只在非长按触发后执行
  const doubleClickConfig = configStore.getActionConfig?.(scheme, "doubleClick");
  // ...existing double-click logic...
}
```

**注意事项**:
- 移动 `doubleClickConfig` 的声明到 `if (!longPressFired)` 块内，避免未使用变量
- 同时修复 A4 后，右键 mouseup 不会进入 handlePointerUp，进一步减少误触发风险

**改动文件**:
- `src/desktop/renderer/engine/trigger-handlers.ts` — 双击检测加 longPressFired 保护

---

### C2. 引擎 DI 缺失 — diagnostics / reportRuntimeError 未传递

**严重程度**: P2 — 排障能力缺失

**根因分析**:

`entry.ts:14-43` 中 `createEffectEngine` 不接受也不传递 `diagnostics` 和 `reportRuntimeError`：
```ts
const triggerHandlers = createTriggerHandlers({
  window: deps.window,
  document: deps.document,
  state: deps.state,
  configStore: deps.configStore,
  visualEffects,
  audioRuntime,
  cursorOverlay,
  // diagnostics ← 缺失
});
```

**修复方案**:

1. `EngineDeps` 接口增加可选字段：
```ts
interface EngineDeps {
  // ...existing...
  diagnostics?: DiagnosticsModule;
  reportRuntimeError?: (scope: string, message: string) => void;
}
```

2. `createEffectEngine` 传递给子模块：
```ts
const audioRuntime = createAudioRuntime({
  window: deps.window,
  state: deps.state,
  configStore: deps.configStore,
  reportRuntimeError: deps.reportRuntimeError,  // ← 新增
});

const triggerHandlers = createTriggerHandlers({
  // ...existing...
  diagnostics: deps.diagnostics,  // ← 新增
});
```

3. overlay/index.ts 创建引擎时传入：
```ts
const engine = createEffectEngine({
  window, document, constants, state, configStore,
  diagnostics,  // ← 已在 overlay 顶部创建
});
```

**注意事项**:
- overlay 已有 `diagnostics` 实例（line 59），只是没传给引擎
- Workbench 预览的 `WorkbenchPreviewRail.tsx` 创建引擎时不传 diagnostics（预览不需要诊断），保持不变

**改动文件**:
- `src/desktop/renderer/engine/types.ts` — EngineDeps 增加可选字段
- `src/desktop/renderer/engine/entry.ts` — 传递 diagnostics / reportRuntimeError
- `src/desktop/renderer/overlay/index.ts` — 创建引擎时传入 diagnostics

---

## D 组：Workbench 预览 Bug

### D1. 预览无法测试 doubleClick / longPress / 触发时机

**严重程度**: P2 — 功能不完整

**现象**: Workbench 预览使用 `previewAt()` 直接调用 `triggerAction(force: true)`，绕过了 `handleLeftPointerDown` 中的双击检测、长按状态机、触发时机逻辑。用户配置了双击/长按/延迟触发，预览永远只能看到即时 leftClick 效果

**根因分析**:

`trigger-handlers.ts:500-511`：
```ts
function previewAt(x, y, schemeId, previewScheme, actionId): void {
  triggerAction(actionId, {x, y, target: null, event: null}, scheme, { force: true, ... });
  // ↑ 直接触发，绕过所有 trigger timing / double-click / long-press 逻辑
}
```

这是设计选择而非 bug——预览的目的是快速验证视觉效果，不是模拟完整交互。

**修复方案**:

建议不改动 previewAt 本身（它的 force: true 语义是正确的），而是在 Workbench UI 上明确标注：

1. 双击/长按动作的预览按钮改为"测试视觉效果"而非"模拟触发"
2. 或增加一个"模拟触发"模式，在预览面板中实现简单的双击/长按模拟

当前阶段建议仅做 UI 标注，不改动引擎逻辑。

---

## 修复顺序建议

按依赖关系排序，避免改完一个引入新问题：

### 第一批（无相互依赖，可并行）

1. **A2 粒子颜色** — 纯渲染层修改，不影响其他模块
2. **B1 字段列表同步** — 纯配置修改，不影响运行时
3. **B3 || 改 ??** — 一行修改
4. **C2 引擎 DI** — 只增加可选参数传递

### 第二批（依赖第一批）

5. **A1 自定义鼠标图标** — 依赖 C2（diagnostics 传递）不阻塞，但建议先修 C2 让诊断更完善
6. **A4 右键 mouseup + 增加button字段** — 需要修改 IPC 接口，影响面较广
7. **C1 双击检测保护** — 依赖 A4（修复后右键不进 handlePointerUp，减少误触场景）

### 第三批（依赖第二批）

8. **A3 轨道粒子隔离** — 需要修改 EngineState 接口和 VisualEffectsModule 接口，影响 overlay + workbench preview
9. **B2 hover 过滤** — 需要协调 Workbench 多处引用

### 第四批（可选优化）

10. **D1 预览增强** — UI 层改进，不阻塞上架

---

---

## E 组：修复方案自身引入的风险

> 以下是每个修复方案中可能引入的新问题，必须在修复后回归验证。

### E1. A1 修复后自定义光标与 enabled 开关不同步

**问题**: 如果 A1 修复只添加光标状态解析，不添加 `isCurrentSiteEnabled()` 检查，用户通过托盘关闭效果后自定义光标仍会显示

**当前行为**: 主进程通过 `setOverlayVisibility(false)` 隐藏 overlay 窗口来停止所有渲染，`triggerAction` 也有 `isCurrentSiteEnabled` 检查。但 mousemove 走的是 `syncStateCursorOverlay` 路径，不走 `triggerAction`

**修复后必须验证**:
1. 托盘关闭 → overlay 窗口被 hide → mousemove 不再到达 → 自定义光标消失 ✅
2. 托盘关闭 → 如果窗口 hide 和 config change 存在时序差 → 短暂自定义光标残留 → 需要在 mousemove 中也加 enabled 检查作为防御

**验证步骤**: 快速连续点击托盘开关 10 次，观察是否有光标闪烁残留

### E2. A2 修复后 clipPath 形状的视觉差异

**问题**: 添加 `background` 后，所有 clipPath 形状（星光/钻石/心形）从不可见变为可见。这可能导致用户感觉"我的主题效果突然变了"

**当前行为**: clipPath 形状完全透明，只能靠微弱的 box-shadow 看到光晕
**修复后行为**: clipPath 形状有颜色填充，实际形状可见

**结论**: 这是正确行为（原来就是 bug），不是退化。但用户可能需要重新调整颜色配置

### E3. A3 修复后 orbitalGroups 类型变更的连锁影响

**问题**: `state.orbitalGroups` 从 `{ dot: HTMLElement; anim: Animation }[][]` 改为 `Map<string, { dot: HTMLElement; anim: Animation }[]>`，影响所有读取此字段的代码

**受影响方**:
- `visual-effects.ts`: `renderOrbitalParticles` / `clearOrbitalParticles` — 直接修改 ✅
- `overlay/index.ts`: `beforeunload` 调 `clearOrbitalParticles()` 无参形式 — 不需要改
- `WorkbenchPreviewRail.tsx`: unmount 清理调 `clearOrbitalParticles()` — 不需要改
- `types.ts`: `EngineState.orbitalGroups` 类型定义 — 必须改
- 扩展端 `extension/content-runtime/visual-effects.js`: 也有 orbitalGroups — 必须同步改

**风险**: 如果扩展端未同步修改，扩展端和桌面端的 orbitalGroups 类型不一致，`actionConfigSync.test.js` 可能无法覆盖此处

### E4. A4 修复后 IPC 协议变更的兼容性

**问题**: `NativeCursorEvent` 增加 `button` 字段，是 IPC 协议变更

**影响范围**:
- `native-events.ts` → 主进程内，无序列化问题 ✅
- `preload/index.ts` 的 `CursorEventPayload` 类型 → 需要加 `button?: number` ✅
- overlay 的 `dispatch` 函数 → 读取 `payload.button` ✅
- 扩展端 → 不使用 NativeCursorEvent，不受影响 ✅

**风险**: `button` 字段用 uiohook 原始值（1=left, 2=right, 3=middle），不是 W3C PointerEvent 的位掩码（1=left, 2=right, 4=middle）。如果后续有人混淆这两个编号体系（比如 `button === 2` 在 uiohook 是右键，在 W3C 也是右键，但 `button === 3` 在 uiohook 是中键，W3C 没有对应值），会出 bug

**预防**: 在 `button` 字段的注释中明确标注"uiohook 原始值：1=left 2=right 3=middle"

### E5. B1 修复后字段增多对 config 体积的影响

**问题**: 引擎端补齐 4 个 delay 字段 + 工作台端补齐 particleStagger，`ACTION_RUNTIME_FIELDS` 增加了 5 个字段

**影响**:
- `pickStoredWorkbenchActionConfigs` 用 `ACTION_RUNTIME_FIELDS` 过滤保存字段，字段增多意味着保存时多写 5 个字段
- 配置体积增加极小（每个动作多约 20 字节），不是问题
- 但如果旧版配置缺少这些字段，读取时 `mergeActionConfig` 的 spread 会用 BASE 的默认值填充，不存在数据丢失

**风险**: 无

---

## 修复风险矩阵

| Bug | 改动面 | 影响扩展端 | 需要 IPC 改动 | 需要改接口 | 回归风险 |
|-----|--------|-----------|:---:|:---:|:---:|
| A1 | overlay/index.ts | 否 | 否 | 否 | 低 |
| A2 | visual-effects.ts + compute-specs.ts | 是(同步修扩展) | 否 | 否 | 低 |
| A2b | compute-specs.ts | 否 | 否 | 否 | 极低 |
| A3 | types + visual-effects + trigger-handlers + overlay + preview | 是(同步修扩展) | 否 | 是 | 中 |
| A4 | native-events + preload + overlay | 否 | 是(增加button) | 否 | 中 |
| B1 | action-config.ts + actionConfigOptions.ts | 否 | 否 | 否 | 低 |
| B2 | workbenchSchema + stateStore + draftAdapter | 否 | 否 | 否 | 低 |
| B3 | config-store.ts | 否 | 否 | 否 | 极低 |
| C1 | trigger-handlers.ts | 否 | 否 | 否 | 低 |
| C2 | types + entry + overlay | 否 | 否 | 是(可选字段) | 低 |

---

## 验证检查清单

每个 Bug 修复后需要验证：

- [ ] `npm run test` 全绿
- [ ] `npm run build:electron` 通过
- [ ] `npm run dev:electron` 启动不 crash
- [ ] overlay 窗口可见且不抢焦点
- [ ] Workbench 窗口正常渲染
- [ ] 四套内置主题分别切换后效果正确
- [ ] 自定义鼠标图片显示且系统光标隐藏
- [ ] 粒子颜色可见且随 palette 配置变化
- [ ] 左键长按不被右键操作取消
- [ ] hover 不出现在桌面端 ACTIONS 列表
