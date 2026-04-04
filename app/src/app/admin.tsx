import { useRouter } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { db } from "../db";
import { allHabits } from "@nag/core";
import { AdminList } from "../components/AdminList";

const AdminScreen = () => {
  const router = useRouter();
  const { data: habits } = useLiveQuery(allHabits(db));

  return (
    <AdminList
      habits={habits ?? []}
      onAddHabit={() => router.push("/add-habit")}
      onEditHabit={(id) => router.push(`/edit-habit/${id}`)}
    />
  );
};

export default AdminScreen;
