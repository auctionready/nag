import { Text } from "react-native";
import Svg, { Circle, Path, Rect, type NumberProp } from "react-native-svg";

export type HabitIconKind =
  | "run"
  | "walk"
  | "bike"
  | "gym"
  | "yoga"
  | "meditate"
  | "water"
  | "pill"
  | "sleep"
  | "book"
  | "pen"
  | "guitar"
  | "leaf"
  | "sun"
  | "fork"
  | "fast"
  | "coffee"
  | "phone"
  | "money"
  | "language"
  | "broom"
  | "heart"
  | "mountain"
  | "check";

type HabitIconStyle = "line" | "filled" | "emoji";

interface HabitGlyphProps {
  kind?: HabitIconKind | string | null;
  size?: number;
  style?: HabitIconStyle;
  color?: string;
  strokeWidth?: NumberProp;
}

const EMOJI_MAP: Record<string, string> = {
  run: "🏃",
  walk: "🚶",
  bike: "🚴",
  gym: "🏋️",
  yoga: "🧘",
  meditate: "🪷",
  water: "💧",
  pill: "💊",
  sleep: "😴",
  book: "📖",
  pen: "✍️",
  guitar: "🎸",
  leaf: "🌱",
  sun: "☀️",
  fork: "🍴",
  fast: "🥄",
  coffee: "☕",
  phone: "📵",
  money: "💰",
  language: "🈵",
  broom: "🧹",
  heart: "❤️",
  mountain: "⛰️",
  check: "✓",
};

type GlyphRenderer = (filled: boolean) => React.ReactNode;

const GLYPHS: Record<string, GlyphRenderer> = {
  run: () => (
    <>
      <Circle cx={16} cy={5} r={2} />
      <Path d="M7 21l3-5 3 2 1.5-3.5L18 12" />
      <Path d="M5 11l3.5-1 3 2.5L9 17" />
    </>
  ),
  walk: () => (
    <>
      <Circle cx={14} cy={4.5} r={1.8} />
      <Path d="M8 21l3-6 3 1 1 5" />
      <Path d="M6 12l3-3 4 2-2 4" />
    </>
  ),
  bike: () => (
    <>
      <Circle cx={6} cy={17} r={3.5} />
      <Circle cx={18} cy={17} r={3.5} />
      <Path d="M6 17l4-7h5l3 7" />
      <Path d="M11 10l2-3h2" />
    </>
  ),
  gym: () => (
    <>
      <Path d="M3 9v6M21 9v6" />
      <Path d="M6 7v10M18 7v10" />
      <Path d="M6 12h12" />
    </>
  ),
  yoga: () => (
    <>
      <Circle cx={12} cy={5} r={2} />
      <Path d="M12 7v6" />
      <Path d="M5 19c0-3 3-5 7-5s7 2 7 5" />
      <Path d="M5 19h14" />
    </>
  ),
  meditate: () => (
    <>
      <Circle cx={12} cy={6} r={2} />
      <Path d="M6 19c2-3 4-5 6-5s4 2 6 5" />
      <Path d="M3 19h18" />
      <Path d="M9 14l-3 1M15 14l3 1" />
    </>
  ),
  water: () => (
    <>
      <Path d="M12 3c-4 5-6 8-6 11a6 6 0 0012 0c0-3-2-6-6-11z" />
      <Path d="M9 14a3 3 0 003 3" />
    </>
  ),
  pill: () => (
    <>
      <Rect x={3} y={9} width={18} height={6} rx={3} />
      <Path d="M12 9v6" />
    </>
  ),
  sleep: () => <Path d="M21 14a9 9 0 11-11-11 7 7 0 0011 11z" />,
  book: () => (
    <>
      <Path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z" />
      <Path d="M19 17H6a2 2 0 00-2 2" />
    </>
  ),
  pen: () => (
    <>
      <Path d="M14 4l6 6L9 21H3v-6L14 4z" />
      <Path d="M13 5l6 6" />
    </>
  ),
  guitar: () => (
    <>
      <Circle cx={9} cy={16} r={4} />
      <Path d="M11.5 13.5l6-6" />
      <Path d="M16 6l3 3-1.5 1.5L14 7l2-1z" />
      <Circle cx={9} cy={16} r={1.2} />
    </>
  ),
  leaf: () => (
    <>
      <Path d="M5 19c0-9 6-15 15-15-1 9-6 15-15 15z" />
      <Path d="M5 19l9-9" />
    </>
  ),
  sun: () => (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5" />
    </>
  ),
  fork: () => (
    <>
      <Path d="M7 3v8a2 2 0 002 2v8" />
      <Path d="M11 3v6M15 3v6a3 3 0 01-3 3" />
      <Path d="M17 3c2 0 2 4 2 6s-1 3-2 3v9" />
    </>
  ),
  fast: () => (
    <>
      <Circle cx={12} cy={13} r={7} />
      <Path d="M12 13V9M12 13l3 2" />
      <Path d="M9 3h6" />
    </>
  ),
  coffee: () => (
    <>
      <Path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z" />
      <Path d="M17 10h2a2 2 0 010 4h-2" />
      <Path d="M8 3c0 1-1 1-1 2s1 1 1 2M12 3c0 1-1 1-1 2s1 1 1 2" />
    </>
  ),
  phone: () => (
    <>
      <Rect x={7} y={3} width={10} height={18} rx={2} />
      <Path d="M11 18h2" />
      <Path d="M5 5l14 14" />
    </>
  ),
  money: () => (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Path d="M15 9c-1-1-2-1.5-3-1.5-2 0-3 1-3 2.5s1 2 3 2.5 3 1 3 2.5-1 2.5-3 2.5c-1 0-2-.5-3-1.5" />
      <Path d="M12 6v2M12 16v2" />
    </>
  ),
  language: () => (
    <>
      <Path d="M3 6h10" />
      <Path d="M8 4v2" />
      <Path d="M5 10c2 4 5 6 8 6" />
      <Path d="M11 8c-2 4-5 6-8 6" />
      <Path d="M13 20l4-9 4 9" />
      <Path d="M14.5 17h5" />
    </>
  ),
  broom: () => (
    <>
      <Path d="M14 4l6 6" />
      <Path d="M11 7l6 6-3 3-7-2 4-7z" />
      <Path d="M7 14l-4 6" />
      <Path d="M9 16l-2 5" />
      <Path d="M11 17l1 4" />
    </>
  ),
  heart: () => (
    <Path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" />
  ),
  mountain: () => (
    <>
      <Path d="M3 19l6-10 4 6 2-3 6 7H3z" />
      <Circle cx={9} cy={6} r={1.5} />
    </>
  ),
  check: () => <Path d="M5 12l4 4 10-10" />,
};

export const HabitGlyph = ({
  kind,
  size = 18,
  style = "line",
  color = "currentColor",
  strokeWidth = 1.7,
}: HabitGlyphProps) => {
  const key = kind && GLYPHS[kind] ? kind : "check";

  if (style === "emoji") {
    const emoji = (kind && EMOJI_MAP[kind]) || "✦";
    return (
      <Text style={{ fontSize: size * 0.95, lineHeight: size }}>{emoji}</Text>
    );
  }

  const filled = style === "filled";
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : "none"}
      stroke={filled ? "none" : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[key](filled)}
    </Svg>
  );
};
