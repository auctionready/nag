import { handleCreateHabit } from "./CreateHabit";
import { handleUpdateHabit } from "./UpdateHabit";
import { handleDeleteHabit } from "./DeleteHabit";
import { handleCreateCheckIn } from "./CreateCheckIn";
import { handleDeleteCheckIn } from "./DeleteCheckIn";

export const handlers = {
  CreateHabit: handleCreateHabit,
  UpdateHabit: handleUpdateHabit,
  DeleteHabit: handleDeleteHabit,
  CreateCheckIn: handleCreateCheckIn,
  DeleteCheckIn: handleDeleteCheckIn,
};

export type HandlerMap = typeof handlers;
