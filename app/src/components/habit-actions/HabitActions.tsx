import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { dispatch } from "../../infrastructure/dispatch";
import { HabitActionsMenu, type HabitActionItem } from "./HabitActionsMenu";

export interface HabitActionsProps {
  habitId: string;
  archived: boolean;
  paused: boolean;
}

/**
 * Smart wrapper around the dumb {@link HabitActionsMenu}. It owns the
 * habit-lifecycle logic: which actions are valid for the current state
 * (so invalid commands are never dispatched) and what each one does.
 *
 * - Archived → Unarchive.
 * - Otherwise → Pause/Unpause + Archive.
 * - Delete (destructive) is always available; it confirms first and then
 *   navigates back to the board.
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

  const lifecycle: HabitActionItem[] = archived
    ? [
        {
          key: "unarchive",
          label: "Unarchive",
          onPress: () => dispatch({ type: "UnarchiveHabit", habitId }),
        },
      ]
    : [
        paused
          ? {
              key: "unpause",
              label: "Unpause",
              onPress: () => dispatch({ type: "UnpauseHabit", habitId }),
            }
          : {
              key: "pause",
              label: "Pause",
              onPress: () => dispatch({ type: "PauseHabit", habitId }),
            },
        {
          key: "archive",
          label: "Archive",
          onPress: () => dispatch({ type: "ArchiveHabit", habitId }),
        },
      ];

  const items: HabitActionItem[] = [
    ...lifecycle,
    { key: "delete", label: "Delete", onPress: confirmDelete, danger: true },
  ];

  return <HabitActionsMenu items={items} />;
};
