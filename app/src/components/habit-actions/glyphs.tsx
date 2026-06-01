import Svg, { Circle, Path, Rect } from "react-native-svg";
import { tokens } from "../theme";

interface GlyphProps {
  color?: string;
  size?: number;
}

/** Overflow menu trigger — horizontal ellipsis (three dots). */
export const MenuGlyph = ({ color = tokens.ink, size = 16 }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
    <Circle cx={3.2} cy={8} r={1.45} />
    <Circle cx={8} cy={8} r={1.45} />
    <Circle cx={12.8} cy={8} r={1.45} />
  </Svg>
);

/** Pause (two bars). */
export const PauseGlyph = ({ color = tokens.ink, size = 15 }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
    <Rect x={4.5} y={3} width={2.4} height={10} rx={1} />
    <Rect x={9.1} y={3} width={2.4} height={10} rx={1} />
  </Svg>
);

/** Resume (play triangle). */
export const PlayGlyph = ({ color = tokens.ink, size = 15 }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
    <Path d="M5 3.5v9l8-4.5z" />
  </Svg>
);

/** Archive box. */
export const ArchiveGlyph = ({ color = tokens.ink, size = 15 }: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Rect
      x={2.5}
      y={3}
      width={11}
      height={3}
      rx={1}
      stroke={color}
      strokeWidth={1.6}
    />
    <Path
      d="M3.5 6.5v6.5a1 1 0 001 1h7a1 1 0 001-1V6.5"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6.5 9h3"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Trash / delete. */
export const TrashGlyph = ({
  color = tokens.orange,
  size = 15,
}: GlyphProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path
      d="M2.5 4h11M5.5 4V2.5h5V4M4 4l.6 9.5h6.8L12 4M6.5 6.5v5M9.5 6.5v5"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
