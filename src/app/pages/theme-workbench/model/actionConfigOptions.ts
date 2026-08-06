import { isDesktop } from "@/shared/runtime";
import { EASING_NAMES } from "@/components/ui/control-data";

export {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
  pickStoredActionConfigs as pickStoredWorkbenchActionConfigs,
} from "@/shared/effect-core/action-config";

const WEB_TRIGGER_OPTIONS = {
  leftClick: {
    timing: ["按下时", "抬起时"],
    zones: ["当前页面可点击区域", "仅按钮和链接", "全部可交互元素"],
  },
  rightClick: {
    timing: ["按下时", "菜单弹出前"],
    zones: ["右键菜单前", "可交互元素", "空白区域"],
  },
  doubleClick: {
    timing: ["第二次按下时", "第二次抬起后"],
    zones: ["双击命中区域", "主操作按钮", "内容卡片"],
  },
  longPress: {
    timing: ["按住达到阈值", "松开后触发"],
    zones: ["按住后释放", "长按可交互元素", "全局长按区"],
  },
  wheel: {
    timing: ["滚动开始时", "连续滚动中"],
    zones: ["向上 / 向下滚轮", "仅向上滚动", "仅向下滚动"],
  },
  hover: {
    timing: ["进入时", "停留后"],
    zones: ["进入可交互元素", "仅按钮和链接", "全页面 hover"],
  },
};

const DESKTOP_TRIGGER_OPTIONS = {
  leftClick: {
    timing: ["按下时", "抬起时"],
    zones: ["整屏", "中心区域", "屏幕边缘"],
  },
  rightClick: {
    timing: ["按下时", "菜单弹出前"],
    zones: ["整屏", "中心区域", "屏幕边缘"],
  },
  doubleClick: {
    timing: ["第二次按下时", "第二次抬起后"],
    zones: ["整屏", "中心区域", "屏幕边缘"],
  },
  longPress: {
    timing: ["按住达到阈值", "松开后触发"],
    zones: ["整屏", "中心区域", "屏幕边缘"],
  },
  wheel: {
    timing: ["滚动开始时", "连续滚动中"],
    zones: ["整屏", "仅向上滚动", "仅向下滚动"],
  },
};

/** The editor only offers trigger zones that the active runtime can actually resolve. */
export const TRIGGER_OPTIONS = isDesktop() ? DESKTOP_TRIGGER_OPTIONS : WEB_TRIGGER_OPTIONS;

export const SOUND_FILE_OPTIONS = ["woodfish-soft.wav", "woodfish-deep.wav", "tick-light.wav", "chime-bright.wav", "pop-soft.wav", "swipe-whoosh.wav"];

export const CURSOR_OVERRIDE_OPTIONS = [
  "跟随当前状态",
  "木鱼（继承默认）",
  "木鱼（增强态）",
  "木鱼（按压态）",
  "切换到 pointer",
];

export const TEXT_KIND_OPTIONS = ["数字飘字", "文本飘字"];
export const NUMBER_STYLE_OPTIONS = ["阿拉伯数字 (1, 2, 3)", "中文数字 (一, 二, 三)", "英文单词 (one, two, three)"];
export const TEXT_MODE_OPTIONS = ["默认模式 (+1)", "模板模式"];
export const TEXT_TAG_PLAY_OPTIONS = ["按顺序显示", "随机显示"];
export const TEXT_EASING_OPTIONS = [...EASING_NAMES];
export const TEXT_WEIGHT_OPTIONS = ["常规", "中等", "加粗"];
export const TEXT_SHADOW_OPTIONS = ["无", "柔和", "清晰"];
export const TEXT_FONT_PRESETS = ["系统默认", "苹方 / 微软雅黑", "宋体", "黑体", "楷体", "等宽字体", "自定义"];
export const PARTICLE_STYLE_OPTIONS = ["点状粒子", "碎屑粒子", "火花", "星光", "钻石", "心形", "方块", "三角"];
export const PARTICLE_DIRECTION_OPTIONS = ["四周扩散", "旋转扫射", "向上喷发", "随机散射"];
export const PARTICLE_COLOR_MODE_OPTIONS = ["跟随主题", "跟随飘字色", "随机轻变化"];
export const PARTICLE_MOTION_MODE_OPTIONS = [
  { value: "burst", label: "喷射扩散" },
  { value: "orbital", label: "轨道呼吸" },
];
export const RIPPLE_STYLE_OPTIONS = ["单环", "双环", "柔和面波", "脉冲波纹", "回声环", "能量脉冲"];
export const RIPPLE_EASING_OPTIONS = EASING_NAMES.filter((value) => ["线性", "缓出", "缓入缓出", "弹性"].includes(value));
export const AUDIO_TRIGGER_OPTIONS = ["每次触发", "连击叠加", "节流播放"];
export const AUDIO_BLEND_OPTIONS = ["保持原音量", "压低页面音频", "仅插件音效"];
export const ANIMATION_STYLE_OPTIONS = ["聚焦脉冲", "斜切闪片", "弹跳徽记", "漩涡旋转", "星光闪耀", "轨道环绕", "螺旋上升"];
export const ANIMATION_EASING_OPTIONS = [...RIPPLE_EASING_OPTIONS];
export const PARTICLE_PHYSICS_PRESET_OPTIONS = ["无", "重力飘落", "风场漂移", "弹跳迸发", "旋转扩散"];

export const PARTICLE_PHYSICS_PRESET_VALUES = {
  "无": { particleGravity: 0, particleWind: 0, particleBounce: 0, particleTrail: false },
  "重力飘落": { particleGravity: 24, particleWind: 4, particleBounce: 6, particleTrail: false },
  "风场漂移": { particleGravity: 6, particleWind: 22, particleBounce: 0, particleTrail: false },
  "弹跳迸发": { particleGravity: 14, particleWind: 0, particleBounce: 36, particleTrail: true },
  "旋转扩散": { particleGravity: -8, particleWind: 8, particleBounce: 0, particleTrail: true },
};

export const PARTICLE_PALETTE_PRESETS = {
  "暖金": ["#FBBF24", "#F59E0B", "#FDE68A", "#FCD34D", "#FEF3C7"],
  "青绿": ["#14B8A6", "#0F766E", "#5EEAD4", "#99F6E4", "#CCFBF1"],
  "紫韵": ["#A78BFA", "#7C3AED", "#C4B5FD", "#DDD6FE", "#EDE9FE"],
  "水墨": ["#334155", "#475569", "#64748B", "#94A3B8", "#CBD5E1"],
  "糖果": ["#F43F5E", "#FB923C", "#FACC15", "#34D399", "#60A5FA", "#C084FC"],
  "樱花": ["#FDA4AF", "#F9A8D4", "#FBCFE8", "#FCE7F3", "#FDF2F8"],
  "霓虹": ["#06B6D4", "#22D3EE", "#818CF8", "#A78BFA", "#38BDF8"],
  "日落": ["#F97316", "#FB923C", "#FBBF24", "#F59E0B", "#FCD34D"],
  "森林": ["#14532D", "#166534", "#22C55E", "#86EFAC", "#DCFCE7"],
  "海洋": ["#1E3A5F", "#1E40AF", "#3B82F6", "#93C5FD", "#DBEAFE"],
  "暮光": ["#4C1D95", "#7C3AED", "#C084FC", "#F59E0B", "#FDE68A"],
};
