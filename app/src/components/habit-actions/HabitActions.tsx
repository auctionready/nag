import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { dispatch } from "../../infrastructure/dispatch";
import { tokens } from "../theme";
import { HabitActionsMenu, type HabitActionItem } from "./HabitActionsMenu";
import { ArchiveGlyph, PauseGlyph, PlayGlyph, TrashGlyph } from "./glyphs";

export interface HabitActionsProps {
  habitId: string;
  archived: boolean;
  paused: boolean;
}

/**
 * Smart wrapper around the dumb {@link HabitActionsMenu}. It owns the
 * habit-lifecycle logic — which actions are valid for the current state
 * (so an invalid command is never dispatched) and what each one does —
 * and hands a ready-made list of items to the menu.
 *
 * - Pause / Resume — omitted entirely while archived (you can't pause an
 *   archived habit).
 * - Archive / Unarchive.
 * - Delete (destructive) — confirms, then navigates back to the board.
 */
export const HabitActions = ({
  habitId,
  archived,
  paused,
}: HabitActionsProps) => {
  const router = useRouter();

  const confirmDelete = () =>
    Alert.alert(
      "Delete Habit",
      "Are you sure? This will also delete all check-ins and goals for this habit.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await dispatch({ type: "DeleteHabit", habitId });
            router.replace("/(tabs)");
          },
        },
      ],
    );

  const items: HabitActionItem[] = [];

  // No pause control while archived.
  if (!archived) {
    items.push(
      paused
        ? {
            key: "pause",
            label: "resume habit",
            sub: "turn the nags back on",
            icon: <PlayGlyph color={tokens.ink} />,
            onPress: () => dispatch({ type: "UnpauseHabit", habitId }),
          }
        : {
            key: "pause",
            label: "pause habit",
            sub: "stop the nags, stays on your board",
            icon: <PauseGlyph color={tokens.ink} />,
            onPress: () => dispatch({ type: "PauseHabit", habitId }),
          },
    );
  }

  items.push(
    archived
      ? {
          key: "archive",
          label: "unarchive habit",
          sub: "put it back on your board",
          icon: <ArchiveGlyph color={tokens.ink} />,
          onPress: () => dispatch({ type: "UnarchiveHabit", habitId }),
        }
      : {
          key: "archive",
          label: "archive habit",
          sub: "hide from your board, keep its record",
          icon: <ArchiveGlyph color={tokens.ink} />,
          onPress: () => dispatch({ type: "ArchiveHabit", habitId }),
        },
    {
      key: "delete",
      label: "delete habit",
      sub: "removes it and its record for good",
      icon: <TrashGlyph color={tokens.orange} />,
      danger: true,
      onPress: confirmDelete,
    },
  );

  return <HabitActionsMenu items={items} />;
};
