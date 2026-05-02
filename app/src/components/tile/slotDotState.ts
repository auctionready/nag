// Slot dot states used by tile progress dots:
//   done    — ink fill (slot complete)
//   ahead   — orange fill (more done than expected — e.g. extras)
//   pending — empty + faint ring (upcoming slot)
//   behind  — empty + orange ring (slot's time passed, action overdue)
//   missed  — faint solid fill (gone, no recovery expected)
export type SlotDotState = "done" | "ahead" | "pending" | "behind" | "missed";
