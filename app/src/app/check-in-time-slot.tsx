import { useLocalSearchParams, useRouter } from "expo-router";
import { TimeSlotCheckInContainer } from "../components/time-slot-check-in";

const CheckInTimeSlotScreen = () => {
  const {
    habitIds: rawIds,
    h: timeSlotHourRaw,
    m: timeSlotMinuteRaw,
  } = useLocalSearchParams<{ habitIds: string; h?: string; m?: string }>();
  const router = useRouter();

  const habitIds = (rawIds ?? "").split(",").filter((s) => s.length > 0);
  const timeSlotHour =
    timeSlotHourRaw !== undefined ? Number(timeSlotHourRaw) : undefined;
  const timeSlotMinute =
    timeSlotMinuteRaw !== undefined ? Number(timeSlotMinuteRaw) : undefined;

  return (
    <TimeSlotCheckInContainer
      habitIds={habitIds}
      timeSlotHour={timeSlotHour}
      timeSlotMinute={timeSlotMinute}
      onDone={() => router.replace("/(tabs)")}
    />
  );
};

export default CheckInTimeSlotScreen;
