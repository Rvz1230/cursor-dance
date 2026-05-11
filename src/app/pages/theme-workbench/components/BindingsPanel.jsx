import { cn } from "@/components/ui/utils.js";
import { ACTIONS, getConflictsForAction } from "../model/workbenchSchema.js";
import { DataPill, Panel } from "./WorkbenchControls.jsx";

export function BindingsPanel({ actionConfigs, actionId, setActionId, currentConflicts }) {
  return (
    <div className="space-y-4">
      <Panel
        title="冲突检查"
        action={<DataPill tone={currentConflicts.length ? "amber" : "teal"}>{currentConflicts.length ? `${currentConflicts.length} 项待确认` : "无待确认项"}</DataPill>}
      >
        <div className={cn("rounded-2xl px-4 py-3 text-sm", currentConflicts.length ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-emerald-200 bg-emerald-50 text-emerald-800")}>
          {currentConflicts.length ? (
            <ul className="list-disc space-y-1 pl-4">
              {currentConflicts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            "当前没有冲突。"
          )}
        </div>
      </Panel>

      <Panel title="动作矩阵总览">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">动作</th>
                <th className="px-4 py-3 font-medium">飘字</th>
                <th className="px-4 py-3 font-medium">粒子</th>
                <th className="px-4 py-3 font-medium">波纹</th>
                <th className="px-4 py-3 font-medium">音效</th>
                <th className="px-4 py-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((action) => {
                const config = actionConfigs[action.id];
                const rowConflicts = getConflictsForAction(action.id, actionConfigs);
                const active = action.id === actionId;
                return (
                  <tr key={action.id} className={cn("border-t border-slate-100 transition-colors", active ? "bg-emerald-50/60" : "hover:bg-slate-50")}>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setActionId(action.id)} className="text-left">
                        <div className="font-medium text-slate-900">{action.label}</div>
                        <div className="mt-1 text-xs text-slate-500">{action.hint}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3"><DataPill tone={config.textEnabled ? "teal" : "slate"}>{config.textEnabled ? config.textStyle : "—"}</DataPill></td>
                    <td className="px-4 py-3"><DataPill tone={config.particle ? "teal" : "slate"}>{config.particle ? "开启" : "关闭"}</DataPill></td>
                    <td className="px-4 py-3"><DataPill tone={config.ripple ? "teal" : "slate"}>{config.ripple ? "开启" : "关闭"}</DataPill></td>
                    <td className="px-4 py-3"><DataPill tone={config.sound ? "amber" : "slate"}>{config.sound ? `${config.volume}%` : "静音"}</DataPill></td>
                    <td className="px-4 py-3">
                      {rowConflicts.length ? <DataPill tone="amber">待确认</DataPill> : <DataPill tone="teal">已配置</DataPill>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
