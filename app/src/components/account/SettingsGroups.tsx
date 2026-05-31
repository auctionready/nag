import { router } from "expo-router";
import { Group, Row } from "./AccountUI";
import { iconAbout, iconAppearance, iconArchive, iconSkip } from "./icons";

// Shared settings groups — visible whether or not the user is linked, since
// the rows are local-only features (appearance, etc.) that don't require
// an account.
export const SettingsGroups = () => (
  <Group title="App settings">
    <Row icon={iconAppearance()} label="Appearance" disabled />
    <Row icon={iconSkip()} label="Enable skipping" toggle disabled />
    <Row
      icon={iconArchive()}
      label="Archived Habits"
      onPress={() => router.navigate("/account/archived-habits")}
    />
    <Row
      icon={iconAbout()}
      label="About"
      last
      onPress={() => router.navigate("/about")}
    />
  </Group>
);
