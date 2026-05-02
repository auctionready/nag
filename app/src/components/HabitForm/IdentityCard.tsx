import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Controller, type Control } from "react-hook-form";
import { tokens } from "../theme";
import { ErrorText } from "./ErrorText";
import { IconPickerGrid } from "./IconPickerGrid";
import { IconSwatch } from "./IconSwatch";
import { SectionLabel } from "./SectionLabel";
import { type HabitFormData } from "./shared";

interface IdentityCardProps {
  control: Control<HabitFormData>;
  titleError?: string;
}

export const IdentityCard = ({ control, titleError }: IdentityCardProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View>
      <SectionLabel>identity</SectionLabel>
      <View style={styles.card}>
        <View style={styles.identityRow}>
          <Controller
            control={control}
            name="icon"
            render={({ field: { value, onChange } }) => (
              <>
                <IconSwatch
                  icon={value}
                  open={pickerOpen}
                  onPress={() => setPickerOpen((v) => !v)}
                />
                <View style={styles.nameCol}>
                  <Text style={styles.fieldLabel}>name</Text>
                  <Controller
                    control={control}
                    name="title"
                    rules={{ required: "Title is required" }}
                    render={({
                      field: {
                        onChange: onTitleChange,
                        onBlur,
                        value: titleValue,
                      },
                    }) => (
                      <TextInput
                        style={styles.nameInput}
                        onBlur={onBlur}
                        onChangeText={onTitleChange}
                        value={titleValue}
                        placeholder="morning run"
                        placeholderTextColor={tokens.faint}
                      />
                    )}
                  />
                </View>
                {pickerOpen && (
                  <IconPickerGrid selected={value} onSelect={onChange} />
                )}
              </>
            )}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.descriptionRow}>
          <Text style={styles.fieldLabel}>note · optional</Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={styles.descriptionInput}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                placeholder="a short reason — why does this matter?"
                placeholderTextColor={tokens.faint}
                multiline
                textAlignVertical="top"
              />
            )}
          />
        </View>
      </View>
      {titleError && <ErrorText>{titleError}</ErrorText>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    overflow: "hidden",
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fieldLabel: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 9,
    color: tokens.mute,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  nameInput: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.ink,
    paddingVertical: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.border,
    marginHorizontal: 14,
  },
  descriptionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  descriptionInput: {
    fontSize: 13,
    lineHeight: 19,
    color: tokens.inkSoft,
    minHeight: 44,
    paddingVertical: 0,
  },
});
