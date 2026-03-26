import { Stack } from "expo-router";
import { DatabaseProvider } from "../db/DatabaseProvider";

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Habits" }} />
        <Stack.Screen name="add-habit" options={{ title: "Add Habit" }} />
        <Stack.Screen name="edit-habit/[id]" options={{ title: "Edit Habit" }} />
      </Stack>
    </DatabaseProvider>
  );
}
