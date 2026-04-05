import { useCallback, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { habitsByIds, processCommand } from "@nag/core";
import { SlotCheckIn, type SlotCheckInItem } from "../components/SlotCheckIn";

const CheckInSlotScreen = () => {
  const { habitIds: rawIds } = useLocalSearchParams<{ habitIds: string }>();
  const router = useRouter();
  const habitIds = (rawIds ?? "")
    .split(",")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);

  const { data: habits } = useLiveQuery(habitsByIds(db, habitIds), [rawIds]);

  const [actioned, setActioned] = useState<
    Record<number, "checkedIn" | "skipped">
  >({});

  const handleCheckIn = useCallback(async (habitId: number) => {
    await processCommand(db, { type: "CreateCheckIn", habitId });
    setActioned((prev) => ({ ...prev, [habitId]: "checkedIn" }));
  }, []);

  const handleSkip = useCallback(async (habitId: number) => {
    await processCommand(db, {
      type: "CreateCheckIn",
      habitId,
      skipped: true,
    });
    setActioned((prev) => ({ ...prev, [habitId]: "skipped" }));
  }, []);

  const handleDone = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

  const items: SlotCheckInItem[] = (habits ?? []).map((h) => ({
    id: h.id,
    title: h.title,
    checkedIn: actioned[h.id] === "checkedIn",
    skipped: actioned[h.id] === "skipped",
  }));

  return (
    <SlotCheckIn
      habits={items}
      onCheckIn={handleCheckIn}
      onSkip={handleSkip}
      onDone={handleDone}
    />
  );
};

export default CheckInSlotScreen;
