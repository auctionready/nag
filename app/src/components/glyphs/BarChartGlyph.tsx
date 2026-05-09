import Svg, { Path, Rect } from "react-native-svg";

interface BarChartGlyphProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

/** Three ascending bars on a baseline — the "history / progress" icon. */
export const BarChartGlyph = ({
  color,
  size = 14,
  strokeWidth = 1.6,
}: BarChartGlyphProps) => (
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
    <Path d="M2 12h10" />
    <Rect x={3} y={7.5} width={2} height={3.5} rx={0.4} />
    <Rect x={6} y={5} width={2} height={6} rx={0.4} />
    <Rect x={9} y={2.5} width={2} height={8.5} rx={0.4} />
  </Svg>
);
