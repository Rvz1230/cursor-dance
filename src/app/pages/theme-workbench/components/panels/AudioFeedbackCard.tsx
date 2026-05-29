import { Switch } from "@/components/ui/switch";
import {
  AUDIO_BLEND_OPTIONS,
  AUDIO_TRIGGER_OPTIONS,
  PANEL_META,
  SOUND_FILE_OPTIONS,
} from "../../model/workbenchSchema";
import {
  ControlSlider,
  FieldRow,
  Panel,
  SectionTitle,
  SettingSection,
  SmallSelect,
} from "../WorkbenchControls";

export function AudioFeedbackCard({ config, updateActionConfig, panelId }) {
  return (
    <Panel
      id={panelId}
      title="音频反馈"
      icon={PANEL_META.audio.icon}
      iconTone={PANEL_META.audio.tone}
      collapsible
      defaultOpen={config.sound}
      enabled={config.sound}
      summary={config.sound ? `${config.soundFile} · ${config.volume}% · ${config.soundBlendMode}` : "关闭音频反馈"}
      action={<Switch checked={config.sound} onCheckedChange={(next) => updateActionConfig({ sound: next })} aria-label="音效播放开关" />}
    >
      <div className="space-y-4">
        <SettingSection disabled={!config.sound}>
          <SectionTitle>素材</SectionTitle>
          <FieldRow
            label="音效素材"
            hint="音色。"
            control={<SmallSelect value={config.soundFile} options={SOUND_FILE_OPTIONS} onChange={config.sound ? (value) => updateActionConfig({ soundFile: value, sound: true }) : undefined} />}
          />
          <FieldRow
            label="触发策略"
            hint="播放策略。"
            control={<SmallSelect value={config.soundTriggerMode} options={AUDIO_TRIGGER_OPTIONS} onChange={config.sound ? (value) => updateActionConfig({ soundTriggerMode: value, sound: true }) : undefined} />}
          />
          <FieldRow
            label="混音方式"
            hint="与页面音频的关系。"
            control={<SmallSelect value={config.soundBlendMode} options={AUDIO_BLEND_OPTIONS} onChange={config.sound ? (value) => updateActionConfig({ soundBlendMode: value, sound: true }) : undefined} />}
          />
        </SettingSection>

        <SettingSection disabled={!config.sound}>
          <SectionTitle>节奏</SectionTitle>
          <FieldRow
            label="音量"
            hint="音量。"
            control={<ControlSlider disabled={!config.sound} value={config.volume} min={0} max={100} onValueChange={(value) => updateActionConfig({ volume: value[0] })} suffix="%" label="音量" />}
          />
          <FieldRow
            label="播放速度"
            hint="速度。"
            control={<ControlSlider disabled={!config.sound} value={config.playbackRate} min={80} max={130} onValueChange={(value) => updateActionConfig({ playbackRate: value[0] })} suffix="%" label="播放速度" />}
          />
          <FieldRow
            label="启动延迟"
            hint="延迟。"
            control={<ControlSlider disabled={!config.sound} value={config.soundDelay} min={0} max={240} onValueChange={(value) => updateActionConfig({ soundDelay: value[0] })} suffix="ms" label="启动延迟" />}
          />
          <FieldRow
            label="淡出时长"
            hint="淡出。"
            control={<ControlSlider disabled={!config.sound} value={config.soundFadeOut} min={0} max={240} onValueChange={(value) => updateActionConfig({ soundFadeOut: value[0] })} suffix="ms" label="淡出时长" />}
          />
        </SettingSection>
      </div>
    </Panel>
  );
}
