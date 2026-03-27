import type { AnyDb } from "../../db";
import type { Command } from "../schemas";
import { handleCreateHabit } from "./CreateHabit";
import { handleUpdateHabit } from "./UpdateHabit";
import { handleDeleteHabit } from "./DeleteHabit";
import { handleCreateCheckIn } from "./CreateCheckIn";
import { handleDeleteCheckIn } from "./DeleteCheckIn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (db: AnyDb, command: any) => Promise<any>;

export const handlers: Record<Command["type"], Handler> = {
  CreateHabit: handleCreateHabit,
  UpdateHabit: handleUpdateHabit,
  DeleteHabit: handleDeleteHabit,
  CreateCheckIn: handleCreateCheckIn,
  DeleteCheckIn: handleDeleteCheckIn,
};
