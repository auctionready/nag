import { Svg, Circle } from "react-native-svg";

interface ProgressRingProps {
  /** Value between 0 and 1 (exclusive on both ends) */
  progress: number;
  size?: number;
  strokeWidth?: number;
}

export const ProgressRing = ({
  progress,
  size = 36,
  strokeWidth = 4,
}: ProgressRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const cx = size / 2;
  const cy = size / 2;
  const transform = `rotate(-90, ${cx}, ${cy})`;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke="rgba(255, 255, 255, 0.25)"
        strokeWidth={strokeWidth}
        fill="none"
        transform={transform}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke="rgba(255, 255, 255, 0.85)"
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
