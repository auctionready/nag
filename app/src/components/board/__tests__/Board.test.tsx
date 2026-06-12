import { render, fireEvent } from "@testing-library/react-native";
import { Board } from "../Board";

jest.mock("../useBoardProgress", () => ({
  useBoardProgress: () => ({
    doneCount: 0,
    totalCount: 0,
    percent: 0,
    line: "",
    dateLabel: "sat · 2 may",
  }),
}));

// The header's SyncDot pulls in the sync-status context and api client
// (which opens SQLite at import time) — stub the whole module out.
jest.mock("../../sync", () => ({
  SyncDot: () => null,
}));

const mockHabits = [
  { id: "h-1", title: "Exercise" },
  { id: "h-2", title: "Read" },
];

describe("Board", () => {
  describe("when habits list is empty", () => {
    const onAddHabit = jest.fn();
    let view: Awaited<ReturnType<typeof render>>;

    beforeEach(async () => {
      onAddHabit.mockClear();
      view = await render(
        <Board habits={[]} onAddHabit={onAddHabit} renderTile={() => null} />,
      );
    });

    it("renders empty state title", () => {
      expect(view.getByText("nothing to nag yet.")).toBeTruthy();
    });

    it("renders Create Habit button", () => {
      expect(view.getByText("Create Habit")).toBeTruthy();
    });

    it("calls onAddHabit when Create Habit is pressed", async () => {
      await fireEvent.press(view.getByText("Create Habit"));
      expect(onAddHabit).toHaveBeenCalledTimes(1);
    });
  });

  describe("when habits exist", () => {
    const onAddHabit = jest.fn();
    const mockRenderTile = jest.fn(() => null);
    let view: Awaited<ReturnType<typeof render>>;

    beforeEach(async () => {
      onAddHabit.mockClear();
      mockRenderTile.mockClear();
      view = await render(
        <Board
          habits={mockHabits}
          onAddHabit={onAddHabit}
          renderTile={mockRenderTile}
        />,
      );
    });

    it("renders the add-habit dashed tile", () => {
      expect(view.getByText("add habit")).toBeTruthy();
    });

    it("calls onAddHabit when the add tile is pressed", async () => {
      await fireEvent.press(view.getByText("add habit"));
      expect(onAddHabit).toHaveBeenCalledTimes(1);
    });

    it("calls renderTile for each habit", () => {
      expect(mockRenderTile).toHaveBeenCalledTimes(2);
      expect(mockRenderTile).toHaveBeenCalledWith({
        id: "h-1",
        title: "Exercise",
      });
      expect(mockRenderTile).toHaveBeenCalledWith({
        id: "h-2",
        title: "Read",
      });
    });
  });
});
