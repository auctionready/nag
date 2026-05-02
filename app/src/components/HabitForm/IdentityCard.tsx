import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Controller, type Control } from "react-hook-form";
import { tokens } from "../theme";
import { HabitGlyph, type HabitIconKind } from "../HabitGlyph";
import { ErrorText } from "./ErrorText";
import { HABIT_ICON_KINDS, type HabitFormData } from "./shared";

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
                <Pressable
                  onPress={() => setPickerOpen((v) => !v)}
                  style={styles.iconSwatch}
                  accessibilityRole="button"
                  accessibilityLabel="Choose icon"
                >
                  <HabitGlyph
                    kind={value ?? "check"}
                    size={22}
                    color={tokens.cream}
                  />
                  <View
                    style={[
                      styles.iconChevron,
                      pickerOpen && styles.iconChevronActive,
                    ]}
                  >
                    <Text style={styles.iconChevronGlyph}>v</Text>
                  </View>
                </Pressable>
                <View style={styles.identityNameCol}>
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
                  <View style={styles.iconPicker}>
                    <Text style={styles.fieldLabel}>pick icon</Text>
                    <View style={styles.iconGrid}>
                      {HABIT_ICON_KINDS.map((kind) => {
                        const on = kind === value;
                        return (
                          <Pressable
                            key={kind}
                            onPress={() => onChange(on ? null : kind)}
                            style={[
                              styles.iconCell,
                              on && styles.iconCellActive,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Icon ${kind}`}
                          >
                            <HabitGlyph
                              kind={kind as HabitIconKind}
                              size={20}
                              color={on ? tokens.cream : tokens.ink}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
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

const SectionLabel = ({ children }: { children: string }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 10,
    color: tokens.mute,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
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
  iconSwatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  iconChevron: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: tokens.cream,
  },
  iconChevronActive: {
    backgroundColor: tokens.orange,
  },
  iconChevronGlyph: {
    color: tokens.cream,
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 10,
  },
  identityNameCol: {
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
  iconPicker: {
    flexBasis: "100%",
    gap: 8,
    paddingTop: 4,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  iconCell: {
    width: "15.4%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: tokens.inkTint,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCellActive: {
    backgroundColor: tokens.ink,
    borderWidth: 2,
    borderColor: tokens.orange,
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
