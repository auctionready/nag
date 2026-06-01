import { handleCreateHabit } from "./CreateHabit";
import { handleUpdateHabit } from "./UpdateHabit";
import { handleDeleteHabit } from "./DeleteHabit";
import { handleArchiveHabit } from "./ArchiveHabit";
import { handleUnarchiveHabit } from "./UnarchiveHabit";
import { handlePauseHabit } from "./PauseHabit";
import { handleUnpauseHabit } from "./UnpauseHabit";
import { handleCreateCheckIn } from "./CreateCheckIn";
import { handleDeleteCheckIn } from "./DeleteCheckIn";
import { handleUpdateCheckIn } from "./UpdateCheckIn";

export const handlers = {
  CreateHabit: handleCreateHabit,
  UpdateHabit: handleUpdateHabit,
  DeleteHabit: handleDeleteHabit,
  ArchiveHabit: handleArchiveHabit,
  UnarchiveHabit: handleUnarchiveHabit,
  PauseHabit: handlePauseHabit,
  UnpauseHabit: handleUnpauseHabit,
  CreateCheckIn: handleCreateCheckIn,
  DeleteCheckIn: handleDeleteCheckIn,
  UpdateCheckIn: handleUpdateCheckIn,
};

export type HandlerMap = typeof handlers;
