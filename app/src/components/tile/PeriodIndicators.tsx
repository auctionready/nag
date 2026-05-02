import { DayIndicators } from "./DayIndicators";
import { MonthIndicators } from "./MonthIndicators";

type WeeklyPeriodIndicatorsProps = {
  regularity: "day" | "week";
  scheduledDaysMask?: number;
  checkedInDaysMask?: number;
  partialDaysMask?: number;
  anyCheckInDaysMask?: number;
  todayColor?: string;
  partialColor?: string;
  missedColor?: string;
};

type MonthlyPeriodIndicatorsProps = {
  regularity: "month";
  checkIns: { timestamp: Date }[];
  now?: Date;
};

export type PeriodIndicatorsProps =
  | WeeklyPeriodIndicatorsProps
  | MonthlyPeriodIndicatorsProps;

export const PeriodIndicators = (props: PeriodIndicatorsProps) => {
  if (props.regularity === "month") {
    return <MonthIndicators checkIns={props.checkIns} now={props.now} />;
  }
  return (
    <DayIndicators
      scheduledDaysMask={props.scheduledDaysMask ?? 0}
      checkedInDaysMask={props.checkedInDaysMask ?? 0}
      partialDaysMask={props.partialDaysMask}
      anyCheckInDaysMask={props.anyCheckInDaysMask}
      todayColor={props.todayColor}
      partialColor={props.partialColor}
      missedColor={props.missedColor}
    />
  );
};
