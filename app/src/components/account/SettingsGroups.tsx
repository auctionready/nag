import { router } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { archivedHabits } from "@nag/core";
import { db } from "../../db";
import { Group, Row } from "./AccountUI";
import { iconAbout, iconAppearance, iconArchive, iconSkip } from "./icons";

// Shared settings groups — visible whether or not the user is linked, since
// the rows are local-only features (appearance, etc.) that don't require
// an account.
export const SettingsGroups = () => {
  const { data: archived } = useLiveQuery(archivedHabits(db));
  const archivedCount = archived?.length ?? 0;

  return (
    <Group title="App settings">
      <Row icon={iconAppearance()} label="Appearance" disabled />
      <Row icon={iconSkip()} label="Enable skipping" toggle disabled />
      <Row
        icon={iconArchive()}
        label="Archived Habits"
        detail={archivedCount > 0 ? String(archivedCount) : undefined}
        onPress={() => router.navigate("/archived-habits")}
      />
      <Row
        icon={iconAbout()}
        label="About"
        last
        onPress={() => router.navigate("/about")}
      />
    </Group>
  );
};
