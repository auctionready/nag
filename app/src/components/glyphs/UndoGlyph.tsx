import Svg, { Path } from "react-native-svg";

interface UndoGlyphProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

/** Curved arrow returning leftward — the "undo" affordance. */
export const UndoGlyph = ({
  color,
  size = 12,
  strokeWidth = 1.6,
}: UndoGlyphProps) => (
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
    <Path d="M3 5h6.5a3 3 0 0 1 0 6H6" />
    <Path d="M5 3L2.5 5L5 7" />
  </Svg>
);
