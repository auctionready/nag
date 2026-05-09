import Svg, { Path } from "react-native-svg";

interface TrashGlyphProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

/** Trash-can glyph for destructive actions. */
export const TrashGlyph = ({
  color,
  size = 14,
  strokeWidth = 1.6,
}: TrashGlyphProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M2.5 3.5h9M5 3.5V2.5h4v1M3.5 3.5L4 12h6l.5-8.5M5.5 6v4M8.5 6v4" />
  </Svg>
);
