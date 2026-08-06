# CursorDance 当前进度

> 最后更新：2026-08-06
> 当前阶段：工程减负完成，开始正式落地新 UI

## 当前结论

项目已经具备基于真实功能替换 UI 原型稿的条件。后续实现以现有领域模型、Workbench 状态、repository、commands 和 shared effect runtime 为功能底座，以 `docs/ui-spec/` 为体验规格，不再从原型建立第二套业务代码。

当前分支：`desktop/phase-0`

## UI 升级前工程减负

- [x] 第 0 批：工程基线减负——统一 TypeScript、Lint、严格类型、测试、构建与体积门禁。
- [x] 第 1 批：建立唯一领域模型——配置与主题统一为 schema v4 canonical domain。
- [x] 主题领域统一——Workbench 不再维护与 runtime 分叉的主题状态。
- [x] 状态边界拆分——domain、editor、status、runtime 各自承担单一职责。
- [x] reducer 拆分——编辑器、生命周期、规则和主题状态变换分离。
- [x] 持久化拆分——水合、保存、Live Preview、editor state 与平台 repository 分离。
- [x] 命令与保存流程拆分——用户命令不再散落在页面与状态 hook 中。
- [x] 第 6 批：统一组件、命名和工程约束——删除 `WorkbenchControls` 混合入口，运行时统一使用 theme 命名，新增可执行 conventions 门禁。

最近完成提交：

- `aaf2ae1 refactor: 统一组件命名与工程约束`
- `c338830 refactor: 拆分工作台命令与保存流程`
- `1d9b955 refactor: 拆分工作台持久化职责`
- `c3d4d19 refactor: 拆分工作台状态归约器`
- `949e978 refactor: 拆分工作台状态边界`
- `c19d4b5 refactor: 统一主题领域状态`
- `d6d2672 refactor: establish canonical domain model`
- `e504b5f refactor: establish phase 0 engineering baseline`

## 当前质量基线

- Vitest：93 个测试文件、480 项测试通过。
- Web smoke：6/6 通过。
- Desktop smoke：1/1 通过。
- `typecheck`、渐进严格类型、ESLint、Knip、design-token、UI-spec 和 conventions 门禁通过。
- Web、MV3 content runtime、Electron main/preload/renderer 构建通过。
- 扩展与桌面 renderer 体积预算通过。
- schema v4 是唯一持久化格式；无旧配置双写和 runtime legacy model。
- Web 与桌面共享 effect core/runtime，平台层只保留输入、存储、窗口、IPC 与能力适配。

验证数量只记录最近一次完整本地基线；持续集成命令才是最终真值。

## 下一阶段：新 UI 落地

按可独立验证和回滚的批次推进：

1. 新工作台外壳、导航与整体布局。
2. 共享控件族和设计 Token 对齐。
3. 光标皮肤、应用规则、键盘动效和诊断界面。
4. 主题库、效果卡、实时预览舞台与时间轴。
5. AI 助手界面与提案交互。
6. 深色模式、全局动效一致性和旧 UI 最终删除。

每批都必须把原型交互接入真实状态和命令，不能用假数据或页内脚本代替生产链路。

## 发布与平台待办

- [ ] 接入 macOS Developer ID 与公证凭据，完成首个签名 tag 验收。
- [ ] 在 GitHub Actions 首次确认 Windows x64 完整打包路径。
- [ ] Windows 自定义光标真机验收；不阻塞首个 macOS Apple Silicon 版本。
- [ ] Intel Mac 支持延后评估。

## 当前有效文档

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)：当前代码与平台边界。
- [`DESIGN.md`](./DESIGN.md)：视觉与动效规则。
- [`docs/ui-spec/README.md`](./docs/ui-spec/README.md)：UI 原型映射与实施顺序。
- [`docs/ui-spec/DECISIONS.md`](./docs/ui-spec/DECISIONS.md)：产品冲突裁决。
- [`docs/config-schema-v4.md`](./docs/config-schema-v4.md)：持久化领域模型。
- [`docs/desktop-release.md`](./docs/desktop-release.md)：桌面发布、签名和回滚。
- [`docs/desktop-refactor-plan.md`](./docs/desktop-refactor-plan.md)：已完成桌面重构的历史与剩余发布事项。

已完成的迁移方案、Prompt、缺陷清单和稳定化待办统一保存在 `docs/archive/`，不再作为当前执行路线图。
