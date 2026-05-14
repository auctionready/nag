import { DayIndicators } from "./DayIndicators";
import { MonthIndicators } from "./MonthIndicators";

type WeeklyPeriodIndicatorsProps = {
  regularity: "day" | "week";
  scheduledDaysMask?: number;
  checkedInDaysMask?: number;
  partialDaysMask?: number;
  skippedDaysMask?: number;
  anyCheckInDaysMask?: number;
  todayColor?: string;
  partialColor?: string;
  missedColor?: string;
};

type MonthlyPeriodIndicatorsProps = {
  regularity: "month";
  checkIns: { timestamp: Date }[];
};

export type PeriodIndicatorsProps =
  | WeeklyPeriodIndicatorsProps
  | MonthlyPeriodIndicatorsProps;

export const PeriodIndicators = (props: PeriodIndicatorsProps) => {
  if (props.regularity === "month") {
    return <MonthIndicators checkIns={props.checkIns} />;
  }
  return (
    <DayIndicators
      scheduledDaysMask={props.scheduledDaysMask ?? 0}
      checkedInDaysMask={props.checkedInDaysMask ?? 0}
      partialDaysMask={props.partialDaysMask}
      skippedDaysMask={props.skippedDaysMask}
      anyCheckInDaysMask={props.anyCheckInDaysMask}
      todayColor={props.todayColor}
      partialColor={props.partialColor}
      missedColor={props.missedColor}
    />
  );
};
