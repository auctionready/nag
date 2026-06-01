import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { dispatch } from "../../infrastructure/dispatch";
import { tokens } from "../theme";
import { HabitActionsMenu, type HabitActionItem } from "./HabitActionsMenu";
import { ArchiveGlyph, PauseGlyph, PlayGlyph, TrashGlyph } from "./glyphs";

export interface HabitActionsProps {
  habitId: string;
  paused: boolean;
}

/**
 * Smart wrapper around the dumb {@link HabitActionsMenu}. It owns the
 * habit-lifecycle logic and hands a ready-made list of items to the menu.
 *
 * Only reachable for active/paused habits — archived habits are read-only
 * and can't be opened in the editor (you unarchive them from the detail
 * screen's status banner), so there's no "unarchive" item here.
 *
 * - Pause / Resume.
 * - Archive (the edit screen navigates away once archived).
 * - Delete (destructive) — confirms, then navigates back to the board.
 */
export const HabitActions = ({ habitId, paused }: HabitActionsProps) => {
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

  const items: HabitActionItem[] = [
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
    {
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
  ];

  return <HabitActionsMenu items={items} />;
};
