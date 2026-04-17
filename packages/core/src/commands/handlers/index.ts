import { handleCreateHabit } from "./CreateHabit";
import { handleUpdateHabit } from "./UpdateHabit";
import { handleDeleteHabit } from "./DeleteHabit";
import { handleCreateCheckIn } from "./CreateCheckIn";
import { handleDeleteCheckIn } from "./DeleteCheckIn";
import { handleUpdateCheckIn } from "./UpdateCheckIn";

export const handlers = {
  CreateHabit: handleCreateHabit,
  UpdateHabit: handleUpdateHabit,
  DeleteHabit: handleDeleteHabit,
  CreateCheckIn: handleCreateCheckIn,
  DeleteCheckIn: handleDeleteCheckIn,
  UpdateCheckIn: handleUpdateCheckIn,
};

export type HandlerMap = typeof handlers;
