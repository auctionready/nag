import { router } from "expo-router";
import { Group, Row } from "./AccountUI";
import {
  iconAbout,
  iconAppearance,
  iconClock,
  iconExport,
  iconGrid,
  iconNag,
} from "./icons";

// Shared settings groups — visible whether or not the user is linked, since
// the rows are local-only features (habits, appearance, etc.) that don't
// require an account.
export const SettingsGroups = () => (
  <>
    <Group title="Habits">
      <Row icon={iconGrid()} label="Manage habits" disabled />
      <Row icon={iconClock()} label="Reminders" disabled />
      <Row icon={iconExport()} label="Export data" last disabled />
    </Group>

    <Group title="App">
      <Row icon={iconAppearance()} label="Appearance" disabled />
      <Row icon={iconNag()} label="Tone of nags" disabled />
      <Row
        icon={iconAbout()}
        label="About"
        last
        onPress={() => router.navigate("/about")}
      />
    </Group>
  </>
);
