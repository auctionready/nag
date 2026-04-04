import { render, fireEvent } from "@testing-library/react-native";
import { Board } from "../Board";

const mockHabits = [
  { id: 1, title: "Exercise" },
  { id: 2, title: "Read" },
];

describe("Board", () => {
  describe("when habits list is empty", () => {
    const onAddHabit = jest.fn();
    let view: ReturnType<typeof render>;

    beforeEach(() => {
      onAddHabit.mockClear();
      view = render(
        <Board habits={[]} onAddHabit={onAddHabit} renderTile={() => null} />,
      );
    });

    it("renders empty state message", () => {
      expect(view.getByText("You have no habits set")).toBeTruthy();
    });

    it("renders Create Habit button", () => {
      expect(view.getByText("Create Habit")).toBeTruthy();
    });

    it("calls onAddHabit when Create Habit is pressed", () => {
      fireEvent.press(view.getByText("Create Habit"));
      expect(onAddHabit).toHaveBeenCalledTimes(1);
    });
  });

  describe("when habits exist", () => {
    const onAddHabit = jest.fn();
    const mockRenderTile = jest.fn(() => null);
    let view: ReturnType<typeof render>;

    beforeEach(() => {
      onAddHabit.mockClear();
      mockRenderTile.mockClear();
      view = render(
        <Board
          habits={mockHabits}
          onAddHabit={onAddHabit}
          renderTile={mockRenderTile}
        />,
      );
    });

    it("renders + Add Habit button", () => {
      expect(view.getByText("+ Add Habit")).toBeTruthy();
    });

    it("calls onAddHabit when + Add Habit is pressed", () => {
      fireEvent.press(view.getByText("+ Add Habit"));
      expect(onAddHabit).toHaveBeenCalledTimes(1);
    });

    it("calls renderTile for each habit", () => {
      expect(mockRenderTile).toHaveBeenCalledTimes(2);
      expect(mockRenderTile).toHaveBeenCalledWith({ id: 1, title: "Exercise" });
      expect(mockRenderTile).toHaveBeenCalledWith({ id: 2, title: "Read" });
    });
  });
});
