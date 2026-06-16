import { ArrowRight, ImageIcon, MousePointer2, PackageSearch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPill, Panel } from "./WorkbenchControls";
import { buildAssetCenterSummary } from "../lib/assetCenter";

function AssetPreview({ asset, alt, className = "" }) {
  return (
    <div className={`flex items-center justify-center rounded-2xl border border-slate-200 bg-white ${className}`}>
      <img
        src={asset.imageDataUrl}
        alt={alt}
        className="object-contain"
        style={{ width: `${Math.min(asset.size ?? 96, 96)}px`, height: `${Math.min(asset.size ?? 96, 96)}px` }}
      />
    </div>
  );
}

export function AssetsPanel({
  actionId,
  config,
  cursorStateAssets,
  recentCursorAssets,
  setWorkspaceId,
  setActionId,
  setCursorStateId,
}) {
  const summary = buildAssetCenterSummary({
    actionId,
    actionConfig: config,
    cursorStateAssets,
    recentCursorAssets,
  });

  return (
    <div className="space-y-4">
      <Panel
        title="素材总览"
        icon={PackageSearch}
        iconTone="bg-sky-100 text-sky-700"
        action={<DataPill tone="teal">{summary.counts.total} 项可见素材</DataPill>}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">当前动作贴纸</div>
            <div className="mt-2 text-base font-semibold text-slate-900 tabular-nums">{summary.counts.hasActionImageAsset ? "1" : "0"}</div>
            <div className="mt-2 text-sm text-slate-600">集中查看当前动作是否绑定图片贴纸，以及它现在是否处于启用状态。</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">光标状态素材</div>
            <div className="mt-2 text-base font-semibold text-slate-900 tabular-nums">{summary.counts.cursor}</div>
            <div className="mt-2 text-sm text-slate-600">这里汇总当前主题里已经配置过图片的光标状态，方便快速排查继承链是否齐全。</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">最近导入素材</div>
            <div className="mt-2 text-base font-semibold text-slate-900 tabular-nums">{summary.counts.recent}</div>
            <div className="mt-2 text-sm text-slate-600">最近上传过的光标素材会保留在这里，方便回看和重复使用。</div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Panel
          title="当前动作图片贴纸"
          icon={Sparkles}
          iconTone="bg-amber-100 text-amber-700"
          action={
            <Button variant="ghost" className="rounded-2xl px-3 text-xs" onClick={() => {
              setWorkspaceId("workbench");
              setActionId(actionId);
            }}>
              返回编辑
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          }
        >
          {summary.actionImageAsset ? (
            <div className="grid gap-4 md:grid-cols-[132px_minmax(0,1fr)]">
              <AssetPreview asset={summary.actionImageAsset} alt={`${summary.actionImageAsset.actionLabel} sticker`} className="h-[132px] w-[132px]" />
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{summary.actionImageAsset.label}</div>
                  <div className="mt-1 text-sm text-slate-500">{summary.actionImageAsset.actionLabel}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DataPill tone={summary.actionImageAsset.enabled ? "teal" : "amber"}>
                    {summary.actionImageAsset.enabled ? "已启用" : "已配置但未启用"}
                  </DataPill>
                  <DataPill>{summary.actionImageAsset.size}px</DataPill>
                </div>
                <p className="text-sm leading-6 text-slate-600">这张贴纸来自当前动作卡片。素材中心只负责集中查看，具体替换或上传仍回到主题工作台里处理。</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-600">
              当前动作还没有图片贴纸。你可以回到主题工作台，为这个动作加一张图片反馈素材。
            </div>
          )}
        </Panel>

        <Panel
          title="最近导入素材"
          icon={ImageIcon}
          iconTone="bg-emerald-100 text-emerald-700"
          action={<DataPill>{summary.recentAssets.length} 条记录</DataPill>}
        >
          {summary.recentAssets.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {summary.recentAssets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <AssetPreview asset={asset} alt={asset.name} className="h-20 w-20 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-700">{asset.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{asset.mimeType}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <DataPill>{asset.size}px</DataPill>
                        <DataPill>{asset.hotspotX}, {asset.hotspotY}</DataPill>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-600">
              最近还没有导入过新的光标素材。后续在“光标状态”里上传后，这里会自动出现记录。
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="已配置光标状态素材"
        icon={MousePointer2}
        iconTone="bg-violet-100 text-violet-700"
        action={
          <Button variant="ghost" className="rounded-2xl px-3 text-xs" onClick={() => setWorkspaceId("states")}>
            前往光标状态
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        }
      >
        {summary.configuredCursorAssets.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summary.configuredCursorAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  setWorkspaceId("states");
                  setCursorStateId(asset.id);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <AssetPreview asset={asset} alt={`${asset.label} cursor`} className="h-20 w-20 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-600">{asset.label}</div>
                    <div className="mt-1 text-xs text-slate-500">热点 {asset.hotspotX}, {asset.hotspotY}</div>
                    <div className="mt-2">
                      <DataPill>{asset.size}px</DataPill>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-600">
            当前主题还没有配置任何光标状态图片。后续在“光标状态”里上传之后，这里会统一显示。
          </div>
        )}
      </Panel>
    </div>
  );
}
