import type { VideoMusicProfile, VideoTheme } from "./contracts";

// Twenty cover compositions x ten content compositions. These values drive
// geometry, type hierarchy and reading order, not just names or colours.
const FAMILIES = [
  ["航线日刊", "#09212C", "#173843", "#F0FAF7", "#AFCDD0", "#60E0CE", "#FFD390"],
  ["边注观察", "#F6F0E2", "#FFFDF6", "#283D43", "#526A6E", "#176A78", "#AD4F36"],
  ["档案索引", "#242035", "#37304E", "#F6F1FE", "#C4B7D8", "#D2AFFE", "#EDC585"],
  ["栏目透视", "#E9F0F5", "#FFFFFF", "#263747", "#556E85", "#215F9F", "#9F443A"],
  ["纸带纪要", "#30241F", "#49362D", "#FFF6E6", "#D1B6A4", "#F3BF7C", "#87CFC7"],
  ["晨光分栏", "#FFF2D7", "#FFFCF4", "#394332", "#697353", "#55772B", "#A54A30"],
  ["资料拼页", "#142F32", "#24464A", "#F1FAF5", "#A8CECA", "#88D8CB", "#EEC28A"],
  ["坐标侧记", "#EEF1E7", "#FCFEF7", "#334532", "#64775C", "#3D744A", "#965633"],
  ["快讯折页", "#243047", "#344560", "#F3F5FF", "#B4C7E2", "#A2C5FF", "#EDC995"],
  ["周界简讯", "#FAEDE8", "#FFFAF8", "#4D3836", "#836461", "#9D454B", "#306D72"],
  ["航线夜读", "#1F2536", "#313A52", "#F6F5FF", "#B3BDD6", "#B5C3FA", "#E4B784"],
  ["边注晚刊", "#E6EFEF", "#F9FFFF", "#284448", "#526E74", "#146E78", "#9A4D60"],
  ["档案复核", "#302333", "#4A344C", "#FFF2FA", "#D2B6CE", "#ECB5D7", "#94D0C4"],
  ["栏目交汇", "#EEF0FC", "#FDFDFF", "#383B59", "#686E91", "#555A9A", "#9D4E3D"],
  ["纸带终刊", "#263027", "#3A4639", "#F5FAE8", "#BACBB0", "#C2DC92", "#E1BBA0"],
  ["暮色分栏", "#F1E7EE", "#FFF8FE", "#4C344D", "#7A657D", "#885384", "#2F7372"],
  ["资料续页", "#1E2E3C", "#2F4556", "#EFF8FF", "#AECCD9", "#88CADA", "#E5C090"],
  ["坐标归档", "#F4EDD8", "#FFFCEF", "#49432C", "#797253", "#807023", "#376E81"],
  ["快讯对页", "#2D2535", "#45394D", "#FAF1FF", "#CDBBD5", "#D9BFE9", "#A4D3C3"],
  ["周界回望", "#E8EFF9", "#FAFCFF", "#2F435A", "#657B96", "#346BA2", "#A35349"],
] as const;

export const CONTENT_LAYOUT_NAMES = ["横向卡片", "主稿置顶", "主稿收束", "纵向时间线", "双栏索引", "错位阶梯", "边栏摘要", "对照便笺", "横带清单", "封签档案"] as const;

const MUSIC_STYLES: Array<Pick<VideoMusicProfile, "name" | "tempo" | "instrument" | "percussion" | "cue">> = [
  { name: "电钢与刷鼓", tempo: 82, instrument: "keys", percussion: "brush", cue: "wood" },
  { name: "拨弦与沙锤", tempo: 96, instrument: "pluck", percussion: "shaker", cue: "chime" },
  { name: "钟琴与暖垫", tempo: 74, instrument: "bell", percussion: "none", cue: "glass" },
  { name: "木琴与轻拍", tempo: 106, instrument: "mallet", percussion: "click", cue: "wood" },
  { name: "风琴与慢拍", tempo: 88, instrument: "reed", percussion: "pulse", cue: "drop" },
  { name: "夜色电钢", tempo: 78, instrument: "keys", percussion: "none", cue: "sweep" },
  { name: "切分拨弦", tempo: 112, instrument: "pluck", percussion: "brush", cue: "drop" },
  { name: "玻璃音阶", tempo: 92, instrument: "bell", percussion: "shaker", cue: "glass" },
  { name: "木质律动", tempo: 102, instrument: "mallet", percussion: "pulse", cue: "chime" },
  { name: "轻盈气息", tempo: 86, instrument: "reed", percussion: "click", cue: "sweep" },
];

const PROGRESSIONS = [
  [0, 5, 3, 4], [0, 3, 5, 4], [5, 3, 0, 4], [0, 4, 5, 3], [3, 0, 4, 5],
  [0, 1, 3, 4], [5, 4, 3, 0], [3, 4, 0, 5], [0, 5, 1, 4], [1, 4, 0, 5],
];
const MELODIES = [
  [0, 2, 4, 2, 1, 4, 3, 2], [4, 2, 1, 0, 2, 3, 4, 6],
  [0, 4, 2, 6, 4, 3, 1, 2], [2, 3, 4, 6, 4, 2, 1, 0],
  [4, 6, 7, 4, 2, 1, 3, 2], [0, 1, 4, 2, 6, 4, 3, 1],
  [2, 4, 3, 1, 0, 2, 6, 4], [4, 3, 1, 2, 0, 4, 6, 7],
  [0, 2, 6, 4, 3, 4, 2, 1], [6, 4, 2, 0, 1, 3, 2, 4],
];
const RHYTHMS = [
  [0, 1.5, 3, 4, 5.5, 7, 9, 11], [0, 2, 3.5, 5, 6, 8.5, 10, 12],
  [0, 2.5, 4, 6, 8, 10.5, 12, 14], [0, 1, 2.5, 4.5, 6, 8, 9.5, 12],
  [0, 3, 4.5, 6, 8, 9, 11.5, 14], [0, 2, 5, 6.5, 8, 11, 12.5, 14],
  [0, 1.5, 2.5, 5, 7, 8.5, 11, 13], [0, 2.5, 3.5, 6, 8.5, 10, 12, 13.5],
  [0, 1, 3, 5.5, 8, 10, 11, 14], [0, 3, 5, 6, 8.5, 11, 13, 14.5],
];

export const REPORT_VIDEO_TEMPLATES: VideoTheme[] = FAMILIES.flatMap((family, familyIndex) =>
  CONTENT_LAYOUT_NAMES.map((contentName, content) => {
    const index = familyIndex * 10 + content;
    const musicStyle = MUSIC_STYLES[(familyIndex + content) % MUSIC_STYLES.length];
    const root = 48 + (familyIndex * 5 + content * 2) % 12;
    const id = `edition-${String(index + 1).padStart(3, "0")}`;
    return {
      id,
      name: `${family[0]} · ${contentName}`,
      background: family[1], surface: family[2], ink: family[3], muted: family[4], accent: family[5], secondary: family[6],
      morningLayout: `cover-${familyIndex}-stories-${content}`,
      closeLayout: `cover-${familyIndex}-ledger-${content}`,
      motion: (["grid", "ripple", "slices", "track", "editorial", "orbit", "calendar"] as const)[familyIndex % 7],
      sound: [0, 4, 7].map((semitone) => 440 * 2 ** ((root + 12 + semitone - 69) / 12)),
      layout: {
        cover: familyIndex,
        content,
        frame: (["rule", "panel", "tab", "outline", "stripe"] as const)[(familyIndex + content) % 5],
        transition: (["left", "up", "right", "down", "reveal"] as const)[(familyIndex * 3 + content) % 5],
        typography: (["sans", "serif", "mono"] as const)[familyIndex % 3],
        order: (["rankings-first", "accounts-first", "outflows-first"] as const)[content % 3],
      },
      music: {
        ...musicStyle,
        id: `score-${String(index + 1).padStart(3, "0")}`,
        name: `${musicStyle.name} · ${family[0]} ${content + 1}`,
        tempo: musicStyle.tempo + (familyIndex % 5) * 2,
        root,
        scale: familyIndex % 3 === 0 ? [0, 2, 3, 5, 7, 9, 10] : [0, 2, 4, 5, 7, 9, 11],
        progression: PROGRESSIONS[(familyIndex + content * 3) % 10],
        melody: MELODIES[content].map((degree) => degree + familyIndex % 3),
        rhythm: RHYTHMS[(content + Math.floor(familyIndex / 2)) % 10],
      },
    };
  })
);
