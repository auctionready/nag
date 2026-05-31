import Svg, { Circle, Path } from "react-native-svg";
import { tokens } from "../theme";

// ── Inline icon factories for settings rows ──────────────────────
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
export const iconSkip = () => (
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
    <Path d="M3 7h6" />
    <Path d="M7 4l3 3-3 3" />
  </Svg>
);
export const iconArchive = () => (
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
    <Path d="M1.5 3.5h11v2.5h-11z" />
    <Path d="M2.5 6v6h9V6" />
    <Path d="M5.5 8.5h3" />
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
