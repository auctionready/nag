import Svg, { Circle, Path, Rect } from "react-native-svg";
import { tokens } from "../theme";

// ── Inline icon factories for placeholder rows ───────────────────
export const iconGrid = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
  >
    <Rect x={2} y={2} width={4} height={4} rx={1} />
    <Rect x={8} y={2} width={4} height={4} rx={1} />
    <Rect x={2} y={8} width={4} height={4} rx={1} />
    <Rect x={8} y={8} width={4} height={4} rx={1} />
  </Svg>
);
export const iconClock = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={7} cy={7} r={5} />
    <Path d="M7 4v3l2 2" />
  </Svg>
);
export const iconExport = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 5h8M3 8h8M3 5v6h8V5" />
    <Path d="M5 2v3M9 2v3" />
  </Svg>
);
export const iconAppearance = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={7} cy={7} r={3} />
    <Path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13" />
  </Svg>
);
export const iconNag = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M2 4h10M2 7h6M2 10h8" />
  </Svg>
);
export const iconAbout = () => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    stroke={tokens.ink}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Circle cx={7} cy={7} r={5} />
    <Path d="M7 6.5v3M7 4.5v.5" />
  </Svg>
);
