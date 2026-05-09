import Svg, { Path } from "react-native-svg";

interface EditGlyphProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

/** Pencil glyph used by edit affordances (header button, swipe action). */
export const EditGlyph = ({
  color,
  size = 14,
  strokeWidth = 1.6,
}: EditGlyphProps) => (
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
    <Path d="M9 2.5l2.5 2.5L4.5 12 2 12.5l.5-2.5L9 2.5z" />
  </Svg>
);
