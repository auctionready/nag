import Svg, { Path } from "react-native-svg";

interface SkipGlyphProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Diagonal slash used to mark a skipped or missed slot. Same geometry
 * as the home-board "skip" cell — kept in a single 10×10 viewBox so
 * cap geometry survives any size.
 */
export const SkipGlyph = ({
  color,
  size = 11,
  strokeWidth = 1.7,
}: SkipGlyphProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 10 10"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
  >
    <Path d="M2.5 7.5L7.5 2.5" />
  </Svg>
);
