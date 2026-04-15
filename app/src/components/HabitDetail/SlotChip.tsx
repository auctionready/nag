import { StyleSheet, Text, View } from "react-native";
import type { SlotStatus } from "@nag/core";
import { complianceColors } from "../getComplianceColor";
import { formatSlotTime } from "./formatSlotTime";

interface SlotChipProps {
  hour: number;
  minute: number;
  status: SlotStatus;
}

const glyph: Record<SlotStatus, string> = {
  done: "\u2713", // check mark
  skipped: "\u2013", // en dash
  missed: "\u2715", // cross
  upcoming: "\u25CB", // circle outline
};

export const SlotChip = ({ hour, minute, status }: SlotChipProps) => {
  const timeLabel = formatSlotTime(hour, minute);
  const styleForStatus = statusStyles[status];
  return (
    <View style={[styles.chip, styleForStatus.container]}>
      <Text style={[styles.glyph, styleForStatus.text]}>{glyph[status]}</Text>
      <Text style={[styles.label, styleForStatus.text]}>{timeLabel}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
  },
  glyph: {
    fontSize: 12,
    fontWeight: "700",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});

const statusStyles: Record<
  SlotStatus,
  { container: object; text: { color: string } }
> = {
  done: {
    container: {
      backgroundColor: complianceColors.compliant,
      borderColor: complianceColors.compliant,
    },
    text: { color: "#fff" },
  },
  skipped: {
    container: {
      backgroundColor: complianceColors.partial,
      borderColor: complianceColors.partial,
    },
    text: { color: "#fff" },
  },
  missed: {
    container: {
      backgroundColor: complianceColors.failing,
      borderColor: complianceColors.failing,
    },
    text: { color: "#fff" },
  },
  upcoming: {
    container: {
      backgroundColor: "#fff",
      borderColor: "#d0d0d0",
    },
    text: { color: "#666" },
  },
};
