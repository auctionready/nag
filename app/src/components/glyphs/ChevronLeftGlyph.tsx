import Svg, { Path } from "react-native-svg";

interface ChevronLeftGlyphProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

/** Back-arrow chevron — the standard "back" affordance. */
export const ChevronLeftGlyph = ({
  color,
  size = 12,
  strokeWidth = 1.7,
}: ChevronLeftGlyphProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 11 11"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M7 1L2.5 5.5 7 10" />
  </Svg>
);
