// AI 服务用户设置面板
//
// 桌面端由主进程直接调用模型 provider，需要一份用户的 API key。
// 这个 dialog 让用户填 / 改 / 清除 apiKey + baseUrl + model + apiMode。
// 数据通过 window.cursorDanceAi.setSettings 写入主进程，apiKey 走 safeStorage 加密。
//
// 安全：apiKey 字段是 password 输入；读出时只能拿到 hasApiKey 标记，
// 已配置时显示「••••••••（已设置）」占位文案，再次填入即覆盖。

import { useEffect, useState } from "react";
import { KeyRound, Server, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";

interface AiSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  apiKey: string;
  baseUrl: string;
  model: string;
  apiMode: string;
}

const EMPTY_FORM: FormState = {
  apiKey: "",
  baseUrl: "",
  model: "",
  apiMode: "",
};

const PROVIDER_PRESETS: Array<{ id: string; label: string; baseUrl: string; model: string }> = [
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "custom", label: "自定义", baseUrl: "", model: "" },
];

export function AiSettingsDialog({ open, onClose }: AiSettingsDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const bridge = typeof window !== "undefined" ? window.cursorDanceAi : undefined;
    if (!bridge) return;
    let cancelled = false;
    bridge
      .getSettings()
      .then((view) => {
        if (cancelled) return;
        setHasApiKey(view.hasApiKey);
        setForm({
          apiKey: "",
          baseUrl: view.baseUrl,
          model: view.model,
          apiMode: view.apiMode,
        });
        setError(null);
        setSavedAt(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "读取设置失败");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handlePreset = (presetId: string) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (!preset || preset.id === "custom") return;
    setForm((prev) => ({ ...prev, baseUrl: preset.baseUrl, model: preset.model }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const bridge = typeof window !== "undefined" ? window.cursorDanceAi : undefined;
    if (!bridge) return;
    setSaving(true);
    setError(null);
    try {
      // 仅当用户输入了新 apiKey 才写；为空保持原值不动（避免空字符串覆盖已有 key）。
      const patch: CursorDanceAiSettingsPatch = {
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        apiMode: form.apiMode.trim(),
      };
      if (form.apiKey.trim().length > 0) {
        patch.apiKey = form.apiKey.trim();
      }
      const next = await bridge.setSettings(patch);
      setHasApiKey(next.hasApiKey);
      setForm((prev) => ({ ...prev, apiKey: "" }));
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleClearApiKey = async () => {
    const bridge = typeof window !== "undefined" ? window.cursorDanceAi : undefined;
    if (!bridge) return;
    if (!hasApiKey) return;
    setSaving(true);
    setError(null);
    try {
      const next = await bridge.setSettings({ apiKey: "" });
      setHasApiKey(next.hasApiKey);
      setForm((prev) => ({ ...prev, apiKey: "" }));
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "清除失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent
        className="max-w-xl"
        title="AI 服务设置"
        titleId="ai-settings-title"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-7">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <h2 id="ai-settings-title" className="text-base font-semibold text-slate-900">AI 服务设置</h2>
              <p className="text-xs leading-relaxed text-slate-500">
                AI 助手由桌面主进程直接调用模型服务。填入模型 API key 后，工作台的「AI 设计助手」即可生成 / 修改配置。
                密钥使用系统 Keychain / DPAPI 加密保存，不会回传到 renderer。
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-600">服务商预设</label>
            <div className="flex gap-2">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePreset(preset.id)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                    "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ai-base-url" className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Server className="size-3.5" aria-hidden />
              Base URL
            </label>
            <Input
              id="ai-base-url"
              value={form.baseUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="https://api.deepseek.com/v1"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ai-model" className="text-xs font-medium text-slate-600">模型 ID</label>
            <Input
              id="ai-model"
              value={form.model}
              onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
              placeholder="deepseek-chat"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ai-api-key" className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <KeyRound className="size-3.5" aria-hidden />
              API Key
              {hasApiKey ? <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-2xs font-semibold text-emerald-700">已保存</span> : null}
            </label>
            <Input
              id="ai-api-key"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder={hasApiKey ? "输入新值以替换已保存的密钥" : "sk-..."}
              autoComplete="off"
            />
            {hasApiKey ? (
              <button
                type="button"
                onClick={handleClearApiKey}
                className="self-start text-xs font-medium text-rose-600 hover:text-rose-500 disabled:opacity-50"
                disabled={saving}
              >
                清除已保存的 API key
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">{error}</p>
          ) : null}
          {savedAt && !error ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-700">
              已保存。AI 助手会在下次请求时使用新配置。
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>关闭</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
