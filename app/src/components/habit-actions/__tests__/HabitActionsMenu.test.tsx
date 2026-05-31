import { render, fireEvent } from "@testing-library/react-native";
import { HabitActionsMenu, type HabitActionItem } from "../HabitActionsMenu";

const open = (view: ReturnType<typeof render>) =>
  fireEvent.press(view.getByLabelText("Habit actions"));

describe("HabitActionsMenu", () => {
  it("does not render items until opened", () => {
    const items: HabitActionItem[] = [
      { key: "pause", label: "Pause", onPress: jest.fn() },
    ];
    const view = render(<HabitActionsMenu items={items} />);
    expect(view.queryByText("Pause")).toBeNull();
  });

  it("renders the provided items when opened", () => {
    const items: HabitActionItem[] = [
      { key: "pause", label: "Pause", onPress: jest.fn() },
      { key: "archive", label: "Archive", onPress: jest.fn() },
      { key: "delete", label: "Delete", onPress: jest.fn(), danger: true },
    ];
    const view = render(<HabitActionsMenu items={items} />);
    open(view);
    expect(view.getByText("Pause")).toBeTruthy();
    expect(view.getByText("Archive")).toBeTruthy();
    expect(view.getByText("Delete")).toBeTruthy();
  });

  it("invokes an item's onPress when selected", () => {
    const onPress = jest.fn();
    const items: HabitActionItem[] = [
      { key: "archive", label: "Archive", onPress },
    ];
    const view = render(<HabitActionsMenu items={items} />);
    open(view);
    fireEvent.press(view.getByText("Archive"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("closes the menu after an item is selected", () => {
    const items: HabitActionItem[] = [
      { key: "archive", label: "Archive", onPress: jest.fn() },
    ];
    const view = render(<HabitActionsMenu items={items} />);
    open(view);
    fireEvent.press(view.getByText("Archive"));
    expect(view.queryByText("Archive")).toBeNull();
  });
});
