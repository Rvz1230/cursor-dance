// 首次启动欢迎弹窗
//
// 桌面端首次启动时由 ThemeWorkbenchPage 在挂载后探测 `cursorDanceApp.getFirstRun()`，
// 返回 true 则展示本组件。用户关闭后写回 markFirstRunComplete()，下次启动直接跳过。
//
// 设计与扩展端 popup 引导分离：扩展端在浏览器 popup 里，桌面端是独立 dialog；
// 复用 components/ui/dialog（Radix Dialog 封装），不再引入新组件库。

import { Hand, MousePointer2, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface WelcomeDialogProps {
  open: boolean;
  /** 关闭弹窗（点击「打开工作台」/ 关闭按钮 / 遮罩）。父组件应在这里同步写 firstRun。 */
  onClose: () => void;
  /**
   * 平台 + 辅助功能授权状态。仅 macOS 未授权时显示「打开系统设置」CTA；
   * 其他场景（Windows/Linux 或 macOS 已授权）隐藏该按钮。
   * fallback：bridge 调用失败时默认 platform: "darwin"，但 needsAccessibility = false，
   * 不主动打扰用户。
   */
  platform: NodeJS.Platform;
  needsAccessibility: boolean;
  onRequestAccessibility?: () => void;
}

const TIPS: Array<{ icon: typeof Hand; title: string; body: string }> = [
  {
    icon: MousePointer2,
    title: "点击桌面任意位置试试效果",
    body: "默认主题下，单击会喷出粒子，长按可触发涟漪。",
  },
  {
    icon: Sparkles,
    title: "在工作台里调整粒子、文字、声音和光标",
    body: "5 个动作（左键 / 右键 / 双击 / 长按 / 滚轮）独立配置，所见即所得。",
  },
  {
    icon: Hand,
    title: "应用规则按需启停",
    body: "在「应用规则」里为某个应用单独禁用或切换主题——比如演示软件不需要分心。",
  },
];

export function WelcomeDialog({
  open,
  onClose,
  platform,
  needsAccessibility,
  onRequestAccessibility,
}: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="欢迎使用 CursorDance" titleId="cursordance-welcome-title">
        <div className="px-7 pb-2 pt-7">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id="cursordance-welcome-title" className="text-base font-semibold text-slate-900">
                CursorDance 已就绪
              </h2>
              <p className="text-xs text-slate-500">把鼠标变成你独有的视觉签名</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-7 pb-2">
          {TIPS.map((tip) => (
            <div
              key={tip.title}
              className="flex gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3"
            >
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <tip.icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-600">{tip.title}</div>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{tip.body}</p>
              </div>
            </div>
          ))}

          {platform === "darwin" && needsAccessibility ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <div className="flex items-start gap-2 text-xs text-amber-900">
                <SettingsIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <div className="font-semibold">桌面效果需要「辅助功能」权限</div>
                  <p className="mt-0.5 leading-5">
                    未授权时只能在工作台中预览。授权后全局鼠标与键盘效果会自动开始，无需重启应用。
                  </p>
                  {onRequestAccessibility ? (
                    <button
                      type="button"
                      onClick={onRequestAccessibility}
                      className="mt-1.5 text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
                    >
                      授予辅助功能权限
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 px-7 pb-7 pt-4">
          <Button variant="default" className="h-9 px-4 text-xs" onClick={onClose}>
            打开工作台
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
