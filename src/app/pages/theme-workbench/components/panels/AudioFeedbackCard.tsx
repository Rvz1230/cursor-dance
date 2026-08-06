import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { FieldRow } from "@/components/ui/field-row";
import { Panel } from "@/components/ui/panel";
import { SectionTitle } from "@/components/ui/section-title";
import { Select } from "@/components/ui/select";
import {
  AUDIO_BLEND_OPTIONS,
  AUDIO_TRIGGER_OPTIONS,
  PANEL_META,
  SOUND_FILE_OPTIONS,
} from "../../model/workbenchSchema";
import { WorkbenchSettingSection } from "../WorkbenchSettingSection";
import { ResetCardButton } from "./ResetCardButton";

export function AudioFeedbackCard({ config, updateActionConfig, panelId, reset }) {
  return (
    <Panel
      id={panelId}
      title="音频反馈"
      icon={PANEL_META.audio.icon}
      collapsible
      defaultOpen={config.sound}
      enabled={config.sound}
      summary={config.sound ? `${config.soundFile} · ${config.volume}% · ${config.soundBlendMode}` : "关闭音频反馈"}
      action={
        <div className="flex items-center gap-2">
          {reset ? <ResetCardButton dirty={reset.dirty} onReset={reset.onReset} /> : null}
          <Switch checked={config.sound} onCheckedChange={(next) => updateActionConfig({ sound: next })} aria-label="音效播放开关" />
        </div>
      }
    >
      <div className="space-y-4">
        <WorkbenchSettingSection disabled={!config.sound}>
          <SectionTitle>素材</SectionTitle>
          <FieldRow
            label="音效素材"
            control={<Select value={config.soundFile} options={SOUND_FILE_OPTIONS} onChange={config.sound ? (value) => updateActionConfig({ soundFile: value, sound: true }) : undefined} />}
          />
          <FieldRow
            label="触发策略"
            control={<Select value={config.soundTriggerMode} options={AUDIO_TRIGGER_OPTIONS} onChange={config.sound ? (value) => updateActionConfig({ soundTriggerMode: value, sound: true }) : undefined} />}
          />
          <FieldRow
            label="混音方式"
            control={<Select value={config.soundBlendMode} options={AUDIO_BLEND_OPTIONS} onChange={config.sound ? (value) => updateActionConfig({ soundBlendMode: value, sound: true }) : undefined} />}
          />
        </WorkbenchSettingSection>

        <WorkbenchSettingSection disabled={!config.sound}>
          <SectionTitle>节奏</SectionTitle>
          <FieldRow
            label="音量"
            control={<Slider disabled={!config.sound} value={config.volume} min={0} max={100} onChange={(value) => updateActionConfig({ volume: value })} suffix="%" label="音量" />}
          />
          <FieldRow
            label="播放速度"
            control={<Slider disabled={!config.sound} value={config.playbackRate} min={80} max={130} onChange={(value) => updateActionConfig({ playbackRate: value })} suffix="%" label="播放速度" />}
          />
          <FieldRow
            label="启动延迟"
            control={<Slider disabled={!config.sound} value={config.soundDelay} min={0} max={240} onChange={(value) => updateActionConfig({ soundDelay: value })} suffix="ms" label="启动延迟" />}
          />
          <FieldRow
            label="淡出时长"
            control={<Slider disabled={!config.sound} value={config.soundFadeOut} min={0} max={240} onChange={(value) => updateActionConfig({ soundFadeOut: value })} suffix="ms" label="淡出时长" />}
          />
        </WorkbenchSettingSection>
      </div>
    </Panel>
  );
}
