import { render, fireEvent } from "@testing-library/react-native";
import { Board } from "../Board";

const mockHabits = [
  { id: 1, title: "Exercise" },
  { id: 2, title: "Read" },
];

const renderTile = (habit: { id: number; title: string }) => null;

describe("Board", () => {
  describe("when habits list is empty", () => {
    it("renders empty state message", () => {
      const onAddHabit = jest.fn();
      const { getByText } = render(
        <Board habits={[]} onAddHabit={onAddHabit} renderTile={renderTile} />,
      );
      expect(getByText("You have no habits set")).toBeTruthy();
    });

    it("renders Create Habit button", () => {
      const onAddHabit = jest.fn();
      const { getByText } = render(
        <Board habits={[]} onAddHabit={onAddHabit} renderTile={renderTile} />,
      );
      expect(getByText("Create Habit")).toBeTruthy();
    });

    it("calls onAddHabit when Create Habit is pressed", () => {
      const onAddHabit = jest.fn();
      const { getByText } = render(
        <Board habits={[]} onAddHabit={onAddHabit} renderTile={renderTile} />,
      );
      fireEvent.press(getByText("Create Habit"));
      expect(onAddHabit).toHaveBeenCalledTimes(1);
    });
  });

  describe("when habits exist", () => {
    it("renders + Add Habit button", () => {
      const onAddHabit = jest.fn();
      const { getByText } = render(
        <Board
          habits={mockHabits}
          onAddHabit={onAddHabit}
          renderTile={renderTile}
        />,
      );
      expect(getByText("+ Add Habit")).toBeTruthy();
    });

    it("calls onAddHabit when + Add Habit is pressed", () => {
      const onAddHabit = jest.fn();
      const { getByText } = render(
        <Board
          habits={mockHabits}
          onAddHabit={onAddHabit}
          renderTile={renderTile}
        />,
      );
      fireEvent.press(getByText("+ Add Habit"));
      expect(onAddHabit).toHaveBeenCalledTimes(1);
    });

    it("calls renderTile for each habit", () => {
      const onAddHabit = jest.fn();
      const mockRenderTile = jest.fn(() => null);
      render(
        <Board
          habits={mockHabits}
          onAddHabit={onAddHabit}
          renderTile={mockRenderTile}
        />,
      );
      expect(mockRenderTile).toHaveBeenCalledTimes(2);
      expect(mockRenderTile).toHaveBeenCalledWith({ id: 1, title: "Exercise" });
      expect(mockRenderTile).toHaveBeenCalledWith({ id: 2, title: "Read" });
    });
  });
});
