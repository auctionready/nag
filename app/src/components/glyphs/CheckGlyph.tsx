import Svg, { Path } from "react-native-svg";

interface CheckGlyphProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Hand-tuned tick mark used across check-in surfaces (slot pills,
 * action popover, swatch badges, history-strip cells). Drawn in a
 * 10×10 viewBox so the stroke geometry stays consistent at any size.
 */
export const CheckGlyph = ({
  color,
  size = 11,
  strokeWidth = 1.7,
}: CheckGlyphProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 10 10"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M2 5.2L4.2 7.4L8 3.2" />
  </Svg>
);
