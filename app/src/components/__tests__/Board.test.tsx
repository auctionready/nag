import { render, fireEvent } from "@testing-library/react-native";
import { Board } from "../Board";

const mockHabits = [
  { id: 1, title: "Exercise" },
  { id: 2, title: "Read" },
];

describe("Board", () => {
  describe("when habits list is empty", () => {
    const onAddHabit = jest.fn();
    let utils: ReturnType<typeof render>;

    beforeEach(() => {
      onAddHabit.mockClear();
      utils = render(
        <Board habits={[]} onAddHabit={onAddHabit} renderTile={() => null} />,
      );
    });

    it("renders empty state message", () => {
      expect(utils.getByText("You have no habits set")).toBeTruthy();
    });

    it("renders Create Habit button", () => {
      expect(utils.getByText("Create Habit")).toBeTruthy();
    });

    it("calls onAddHabit when Create Habit is pressed", () => {
      fireEvent.press(utils.getByText("Create Habit"));
      expect(onAddHabit).toHaveBeenCalledTimes(1);
    });
  });

  describe("when habits exist", () => {
    const onAddHabit = jest.fn();
    const mockRenderTile = jest.fn(() => null);
    let utils: ReturnType<typeof render>;

    beforeEach(() => {
      onAddHabit.mockClear();
      mockRenderTile.mockClear();
      utils = render(
        <Board
          habits={mockHabits}
          onAddHabit={onAddHabit}
          renderTile={mockRenderTile}
        />,
      );
    });

    it("renders + Add Habit button", () => {
      expect(utils.getByText("+ Add Habit")).toBeTruthy();
    });

    it("calls onAddHabit when + Add Habit is pressed", () => {
      fireEvent.press(utils.getByText("+ Add Habit"));
      expect(onAddHabit).toHaveBeenCalledTimes(1);
    });

    it("calls renderTile for each habit", () => {
      expect(mockRenderTile).toHaveBeenCalledTimes(2);
      expect(mockRenderTile).toHaveBeenCalledWith({ id: 1, title: "Exercise" });
      expect(mockRenderTile).toHaveBeenCalledWith({ id: 2, title: "Read" });
    });
  });
});
