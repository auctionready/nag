import { Svg, Circle } from "react-native-svg";

interface ProgressRingProps {
  /** Value between 0 and 1, inclusive */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Filled-arc stroke color */
  color?: string;
  /** Unfilled-track stroke color */
  trackColor?: string;
  /** Optional solid fill color for the inside of the ring (acts as a badge backdrop) */
  backgroundColor?: string;
}

export const ProgressRing = ({
  progress,
  size = 28,
  strokeWidth = 4,
  color = "#fff",
  trackColor = "rgba(255, 255, 255, 0.35)",
  backgroundColor,
}: ProgressRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const cx = size / 2;
  const cy = size / 2;
  const transform = `rotate(-90, ${cx}, ${cy})`;

  return (
    <Svg width={size} height={size}>
      {backgroundColor && (
        <Circle cx={cx} cy={cy} r={radius} fill={backgroundColor} />
      )}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
        transform={transform}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
        transform={transform}
      />
    </Svg>
  );
};
