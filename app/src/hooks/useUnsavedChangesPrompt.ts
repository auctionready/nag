import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";

/**
 * Guards a screen against losing unsaved edits. Track the form's dirty state
 * via `setDirty`; when the user tries to leave (header back, swipe gesture,
 * Android hardware back) with unsaved changes, a yes/no prompt is shown before
 * the navigation is allowed to proceed.
 *
 * For deliberate departures — pressing save or cancel — call `allowLeave()`
 * just before navigating so the prompt is skipped.
 */
export const useUnsavedChangesPrompt = () => {
  const navigation = useNavigation();
  const [dirty, setDirty] = useState(false);
  const bypass = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!dirty || bypass.current) return;
      e.preventDefault();
      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Leave without saving them?",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              bypass.current = true;
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, dirty]);

  const allowLeave = useCallback(() => {
    bypass.current = true;
  }, []);

  return { setDirty, allowLeave };
};
